import { NextResponse } from 'next/server';
import { getServerSupabase } from '@/lib/supabase';
import Decimal from 'decimal.js';

const MYCASH_WITHDRAW_URL = 'https://mycash.cc/api/v1/withdraw';
const MYCASH_API_KEY = process.env.MYCASH_API_KEY || 'sk_live_eVksnZZG4sfrr2eupd9JhGJjc3Qarq0c';

export async function POST(req: Request) {
    try {
        const { amount, pix_type, pix_key, user_id } = await req.json();

        if (!amount || parseFloat(amount) <= 0) {
            return NextResponse.json({ error: "Valor inválido" }, { status: 400 });
        }

        if (!pix_type || !pix_key) {
            return NextResponse.json({ error: "Dados PIX ausentes" }, { status: 400 });
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

        // Check if withdrawal is locked
        if (profile.withdraw_lock_until) {
            const lockUntil = new Date(profile.withdraw_lock_until);
            if (new Date() < lockUntil) {
                const diff = Math.ceil((lockUntil.getTime() - new Date().getTime()) / 60000);
                return NextResponse.json({
                    error: `Saque bloqueado temporariamente (Restam ${diff} min). O sistema detectou comportamento suspeito de lavagem de dinheiro. Aguarde a análise de conformidade.`
                }, { status: 403 });
            }
        }

        const requestedAmount = new Decimal(amount);
        if (new Decimal(profile.balance).lessThan(requestedAmount)) {
            return NextResponse.json({ error: "Saldo insuficiente" }, { status: 400 });
        }

        // 2. Calculate the "Net Amount" (70% for the user)
        // The user pays R$ 100,00 from balance, gets R$ 70,00 in bank. 30% is platform profit.
        const netAmount = requestedAmount.times(0.7).toDecimalPlaces(2).toNumber();

        // 3. Call MyCash External API for Withdrawal (Send PIX)
        const mycashRes = await fetch(MYCASH_WITHDRAW_URL, {
            method: 'POST',
            headers: {
                'Authorization': MYCASH_API_KEY,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                amount: netAmount, // 70% goes to the bank
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
                external_id: String(mycashData.id),
                type: 'withdraw',
                amount_original: requestedAmount.toNumber(), // 100% deducible
                amount_net: netAmount, // 70% sent
                description: `Saque PIX (${pix_type})`,
                status: 'processing',
                is_final: false,
                pix_copia_e_cola: pix_key // Store the key here for reference
            })
            .select()
            .single();

        if (txError) {
            console.error("Supabase Error recording withdraw:", txError);
        }

        // 5. Deduct 100% of the requested amount from user balance
        const newBalance = new Decimal(profile.balance).minus(requestedAmount).toNumber();
        await supabase
            .from('profiles')
            .update({ balance: newBalance })
            .eq('id', user_id);

        return NextResponse.json({
            success: true,
            transaction: tx,
            mycash: mycashData
        });

    } catch (error: any) {
        console.error("Withdraw API Error:", error);
        return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
    }
}
