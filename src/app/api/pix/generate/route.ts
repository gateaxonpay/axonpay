import { NextResponse } from 'next/server';
import { getServerSupabase } from '@/lib/supabase';
import Decimal from 'decimal.js';
import { getMyCashApiKey } from '@/lib/settings';

const MYCASH_API_URL = 'https://mycash.cc/api/v1/pix/generate';

export async function POST(req: Request) {
    try {
        const body = await req.json();
        const { amount, description, user_id } = body;
        const apiKey = await getMyCashApiKey();

        // 1. Validate minimum amount
        const parsedAmount = parseFloat(amount);
        if (!amount || isNaN(parsedAmount) || parsedAmount < 20) {
            return NextResponse.json(
                { error: 'Valor mínimo é R$ 20.00' },
                { status: 400 }
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
                description: description || 'Depósito',
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
        const externalId = mycashData.id; // numeric ID from MyCash
        const qrCodeUrl = `https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(pixCode)}`;

        // 3. Try to save to Supabase (server-side with service role to bypass RLS)
        const supabase = getServerSupabase();
        let dbRecord = null;

        const { data: dbTx, error: dbError } = await supabase
            .from('transactions')
            .insert({
                user_id: user_id || null,
                external_id: String(externalId),
                type: 'deposit',
                amount_original: parsedAmount,
                amount_net: netAmount,
                description: description || 'Depósito',
                status: 'pending',
                is_final: false,
                pix_copia_e_cola: pixCode,
                qr_code_url: qrCodeUrl,
            })
            .select()
            .single();

        if (dbError) {
            console.error('Supabase insert error:', dbError.message);
            // DB failed but PIX was generated — still return PIX data to user
        } else {
            dbRecord = dbTx;
        }

        // 4. Return result — always include PIX data even if DB failed
        return NextResponse.json({
            id: dbRecord?.id || null,
            external_id: String(externalId),
            tx_id: mycashData.tx_id,
            type: 'deposit',
            amount_original: parsedAmount,
            amount_net: netAmount,
            description: description || 'Depósito',
            status: 'pending',
            is_final: false,
            pix_copia_e_cola: pixCode,
            qr_code_url: qrCodeUrl,
            db_saved: !dbError,
        });

    } catch (error: any) {
        console.error('Generate API Error:', error);
        return NextResponse.json(
            { error: 'Erro interno do servidor' },
            { status: 500 }
        );
    }
}
