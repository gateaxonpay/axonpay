import { NextResponse } from 'next/server';
import { getServerSupabase } from '@/lib/supabase';

const MYCASH_API_KEY = process.env.MYCASH_API_KEY || '';

export async function GET(
    req: Request,
    { params }: { params: { id: string } }
) {
    try {
        const externalId = params.id;

        // Call MyCash status API directly using the external_id
        const mycashRes = await fetch(
            `https://mycash.cc/api/v1/pix/status/${externalId}`,
            {
                method: 'GET',
                headers: {
                    'Authorization': MYCASH_API_KEY,
                },
            }
        );

        const mycashData = await mycashRes.json();

        if (!mycashRes.ok) {
            return NextResponse.json(
                { error: mycashData.error || 'Erro ao consultar status' },
                { status: mycashRes.status }
            );
        }

        // mycashData: { id: 450, status: "completed", is_final: true, amount: 50.00, type: "withdraw" }

        // Try to sync status back to Supabase
        const supabase = getServerSupabase();
        const isFinal = mycashData.is_final || mycashData.status === 'completed' || mycashData.status === 'cancelled';

        await supabase
            .from('transactions')
            .update({
                status: mycashData.status,
                is_final: isFinal,
            })
            .eq('external_id', String(externalId));

        // If completed deposit, credit user balance AND set withdrawal lock
        if (mycashData.status === 'completed' && mycashData.type === 'deposit') {
            const { data: tx } = await supabase
                .from('transactions')
                .select('user_id, amount_net')
                .eq('external_id', String(externalId))
                .single();

            if (tx && tx.user_id) {
                // Get current balance
                const { data: profile } = await supabase
                    .from('profiles')
                    .select('balance')
                    .eq('id', tx.user_id)
                    .single();

                if (profile) {
                    const newBalance = Number(profile.balance) + Number(tx.amount_net);
                    // Lock withdrawal for 10 minutes
                    const lockUntil = new Date(Date.now() + 10 * 60 * 1000).toISOString();

                    await supabase
                        .from('profiles')
                        .update({
                            balance: newBalance,
                            withdraw_lock_until: lockUntil
                        })
                        .eq('id', tx.user_id);
                }
            }
        }

        return NextResponse.json({
            status: mycashData.status,
            is_final: isFinal,
            amount: mycashData.amount,
            type: mycashData.type,
        });

    } catch (error: any) {
        console.error('Status API Error:', error);
        return NextResponse.json(
            { error: 'Erro interno do servidor' },
            { status: 500 }
        );
    }
}
