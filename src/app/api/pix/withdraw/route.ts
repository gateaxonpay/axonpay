import { NextResponse } from 'next/server';
import { getServerSupabase } from '@/lib/supabase';
import Decimal from 'decimal.js';
import { getMyCashApiKey } from '@/lib/settings';

const MYCASH_WITHDRAW_URL = 'https://mycash.cc/api/v1/withdraw';

export async function POST(req: Request) {
    try {
        const { amount, pix_type, pix_key, user_id } = await req.json();
        const apiKey = await getMyCashApiKey();

        if (!amount || parseFloat(amount) <= 0) {
            return NextResponse.json({ error: "Valor inválido" }, { status: 400 });
        }

        if (!pix_type || !pix_key) {
            return NextResponse.json({ error: "Dados PIX ausentes" }, { status: 400 });
        }

        if (!user_id) {
            return NextResponse.json({ error: "Usuário não autenticado" }, { status: 401 });
        }

        const supabase = getServerSupabase();

        // 1. Fetch user profile
        const { data: profile, error: profileError } = await supabase
            .from('profiles')
            .select('balance, withdraw_lock_until')
            .eq('id', user_id)
            .single();

        if (profileError || !profile) {
            return NextResponse.json({ error: "Perfil não encontrado" }, { status: 404 });
        }

        const requestedNet = new Decimal(amount);
        // User only needs to have 'amount' in their balance.
        if (new Decimal(profile.balance).lessThan(requestedNet)) {
            return NextResponse.json({ error: "Saldo insuficiente para o resgate." }, { status: 400 });
        }

        // Calculate internal amount needed to cover 8% fee for MyCash API.
        // Formula: x * 0.92 = requestedNet => x = requestedNet / 0.92
        const withdrawGrossAmount = requestedNet.div(0.92).toDecimalPlaces(2, Decimal.ROUND_UP).toNumber();
        const withdrawNetAmount = requestedNet.toNumber();

        // 3. Call MyCash External API for Withdrawal (Send PIX) — gross amount
        console.log('[WITHDRAW] Sending', withdrawGrossAmount, 'to MyCash. User wants net', withdrawNetAmount);

        const mycashRes = await fetch(MYCASH_WITHDRAW_URL, {
            method: 'POST',
            headers: {
                'Authorization': apiKey,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                amount: withdrawGrossAmount,
                pix_type: pix_type,
                pix_key: pix_key
            })
        });

        const mycashData = await mycashRes.json();

        if (!mycashRes.ok || !mycashData.success) {
            return NextResponse.json({
                error: mycashData.error || "Erro no gateway de saque"
            }, { status: mycashRes.status || 500 });
        }

        // 4. Create the transaction in Supabase
        const { data: tx, error: txError } = await supabase
            .from('transactions')
            .insert({
                user_id,
                external_id: String(mycashData.id || mycashData.withdraw_id),
                type: 'withdraw',
                amount_original: withdrawGrossAmount,
                amount_net: withdrawNetAmount, // The amount user actually requested/received
                description: `Saque PIX (${pix_type})`,
                status: 'processing',
                is_final: false,
                pix_copia_e_cola: pix_key,
                credited: false,
            })
            .select()
            .single();

        if (txError) {
            console.error("[WITHDRAW] Supabase Error recording withdraw:", txError.message);
        }

        // 5. Deduct ONLY the requested net amount from user balance
        const newBalance = new Decimal(profile.balance).minus(requestedNet).toNumber();
        await supabase
            .from('profiles')
            .update({ balance: newBalance })
            .eq('id', user_id);

        console.log('[WITHDRAW] Success! New balance:', newBalance);

        return NextResponse.json({
            success: true,
            transaction: tx,
            mycash: mycashData
        });

    } catch (error: any) {
        console.error("[WITHDRAW] Fatal Error:", error);
        return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
    }
}
