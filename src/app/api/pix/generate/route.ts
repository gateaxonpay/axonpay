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

        // 2. Fetch user profile to get their tax_rate
        const supabase = getServerSupabase();

        const { data: existingProfile } = await supabase
            .from('profiles')
            .select('id, tax_rate')
            .eq('id', user_id)
            .single();

        // Determine tax rate: default 0.30 (standard), 0.25 (premium)
        const taxRate = existingProfile?.tax_rate ?? 0.30;
        const netMultiplier = new Decimal(1).minus(taxRate);
        const netAmount = new Decimal(parsedAmount).times(netMultiplier).toDecimalPlaces(2).toNumber();

        console.log(`[GENERATE] User ${user_id} tax_rate=${taxRate}, amount=${parsedAmount}, netAmount=${netAmount}`);

        if (!existingProfile) {
            // Auto-create profile for this user
            const { error: profileCreateError } = await supabase
                .from('profiles')
                .insert({
                    id: user_id,
                    balance: 0,
                    email: null,
                    tax_rate: 0.30, // default tax rate for new profiles
                })
                .select()
                .single();

            if (profileCreateError) {
                console.error('Profile auto-create error:', profileCreateError.message);
            }
        }

        // 3. Call MyCash API to generate PIX QR Code
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

        const pixCode = mycashData.pix_code;
        const externalId = String(mycashData.id);
        const qrCodeUrl = `https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(pixCode)}`;

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

        // 5. Return result (include tax_rate so frontend can display correctly)
        return NextResponse.json({
            id: dbTx?.id || null,
            external_id: externalId,
            tx_id: mycashData.tx_id,
            type: 'deposit',
            amount_original: parsedAmount,
            amount_net: netAmount,
            tax_rate: taxRate,
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
