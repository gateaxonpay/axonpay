import { NextResponse } from 'next/server';
import { getServerSupabase } from '@/lib/supabase';
import Decimal from 'decimal.js';
import { getMyCashApiKey } from '@/lib/settings';

const MYCASH_API_URL = 'https://mycash.cc/api/v1/pix/generate';

export async function POST(req: Request) {
    try {
        const body = await req.json();
        const { amount, user_id } = body;
        const apiKey = await getMyCashApiKey();

        if (!apiKey) {
            return NextResponse.json(
                { error: 'Chave API MyCash não configurada. Vá em /admin → Configurações e insira a API Key.' },
                { status: 503 }
            );
        }

        // 1. Validate minimum amount
        const parsedAmount = parseFloat(amount);
        if (!amount || isNaN(parsedAmount) || parsedAmount < 20) {
            return NextResponse.json(
                { error: 'Valor mínimo é R$ 20.00' },
                { status: 400 }
            );
        }

        if (!user_id) {
            return NextResponse.json(
                { error: 'Usuário não autenticado.' },
                { status: 401 }
            );
        }

        const netAmount = new Decimal(parsedAmount).times(0.7).toDecimalPlaces(2).toNumber();

        // 2. Call MyCash API to generate PIX QR Code
        const mycashRes = await fetch(MYCASH_API_URL, {
            method: 'POST',
            headers: {
                'Authorization': apiKey,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                amount: parsedAmount,
            }),
        });

        const mycashData = await mycashRes.json();

        if (!mycashRes.ok || !mycashData.success) {
            return NextResponse.json(
                { error: mycashData.error || 'Gateway indisponível. Tente novamente.' },
                { status: mycashRes.status || 502 }
            );
        }

        // mycashData structure:
        // { success: true, id: 451, tx_id: "vp_98...", pix_code: "000201...", status: "pending" }

        const pixCode = mycashData.pix_code;
        const externalId = String(mycashData.id); // numeric ID from MyCash
        const qrCodeUrl = `https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(pixCode)}`;

        // 3. Ensure user profile exists (auto-create if missing)
        const supabase = getServerSupabase();

        const { data: existingProfile } = await supabase
            .from('profiles')
            .select('id')
            .eq('id', user_id)
            .single();

        if (!existingProfile) {
            // Auto-create profile for this user
            const { error: profileCreateError } = await supabase
                .from('profiles')
                .insert({
                    id: user_id,
                    balance: 0,
                    email: null,
                })
                .select()
                .single();

            if (profileCreateError) {
                console.error('Profile auto-create error:', profileCreateError.message);
            }
        }

        // 4. Save transaction to Supabase
        const insertPayload = {
            user_id: user_id,
            external_id: externalId,
            type: 'deposit',
            amount_original: parsedAmount,
            amount_net: netAmount,
            description: 'Recarga Axon',
            status: 'pending',
            is_final: false,
            pix_copia_e_cola: pixCode,
            qr_code_url: qrCodeUrl,
            credited: false,
        };

        console.log('[GENERATE] Inserting transaction:', JSON.stringify(insertPayload));

        const { data: dbTx, error: dbError } = await supabase
            .from('transactions')
            .insert(insertPayload)
            .select()
            .single();

        if (dbError) {
            console.error('[GENERATE] Supabase insert error:', dbError.message, dbError.details, dbError.hint);
        } else {
            console.log('[GENERATE] Transaction saved successfully:', dbTx.id, 'user_id:', dbTx.user_id, 'external_id:', dbTx.external_id);
        }

        // 5. Return result
        return NextResponse.json({
            id: dbTx?.id || null,
            external_id: externalId,
            tx_id: mycashData.tx_id,
            type: 'deposit',
            amount_original: parsedAmount,
            amount_net: netAmount,
            description: 'Recarga Axon',
            status: 'pending',
            is_final: false,
            pix_copia_e_cola: pixCode,
            qr_code_url: qrCodeUrl,
            db_saved: !dbError,
            db_error: dbError?.message || null,
        });

    } catch (error: any) {
        console.error('[GENERATE] Fatal Error:', error);
        return NextResponse.json(
            { error: 'Erro interno do servidor' },
            { status: 500 }
        );
    }
}
