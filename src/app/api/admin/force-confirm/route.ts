import { NextResponse } from 'next/server';
import { getServerSupabase } from '@/lib/supabase';
import Decimal from 'decimal.js';

export async function GET(req: Request) {
    const { searchParams } = new URL(req.url);
    const externalId = searchParams.get('id');

    if (!externalId) return NextResponse.json({ error: 'ID missing' }, { status: 400 });

    try {
        const supabase = getServerSupabase();

        // 1. Find transaction
        const { data: tx, error: txErr } = await supabase
            .from('transactions')
            .select('*')
            .eq('external_id', externalId)
            .single();

        if (txErr || !tx) {
            return NextResponse.json({ error: `TX ${externalId} not found in database: ${txErr?.message}` }, { status: 404 });
        }

        if (tx.credited) {
            return NextResponse.json({ message: 'Transaction already credited to balance' });
        }

        // 2. Get profile balance
        const { data: profile, error: profErr } = await supabase
            .from('profiles')
            .select('balance')
            .eq('id', tx.user_id)
            .single();

        if (profErr) {
            // Auto-create profile if missing
            await supabase.from('profiles').insert({ id: tx.user_id, balance: 0 });
        }

        // 3. Update balance and mark as credited
        const netAmount = Number(tx.amount_net);
        const currentBalance = Number(profile?.balance || 0);
        const newBalance = new Decimal(currentBalance).plus(netAmount).toNumber();

        const { error: balErr } = await supabase.from('profiles')
            .update({ balance: newBalance })
            .eq('id', tx.user_id);

        if (balErr) throw new Error(`Balance update failed: ${balErr.message}`);

        const { error: txUpdErr } = await supabase.from('transactions')
            .update({
                status: 'completed',
                credited: true,
                is_final: true,
                amount_net: netAmount // ensuring it's correct
            })
            .eq('external_id', externalId);

        if (txUpdErr) throw new Error(`Transaction update failed: ${txUpdErr.message}`);

        return NextResponse.json({
            success: true,
            message: `FORCE CREDIT SUCCESS: R$ ${netAmount} added to user ${tx.user_id}`,
            tx_id: externalId,
            new_balance: newBalance
        });

    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
