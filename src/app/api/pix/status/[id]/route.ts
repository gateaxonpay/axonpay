import { NextResponse } from 'next/server';
import { getServerSupabase } from '@/lib/supabase';
import { getMyCashApiKey } from '@/lib/settings';

export async function GET(
    req: Request,
    { params }: { params: { id: string } }
) {
    try {
        const externalId = params.id;
        const supabase = getServerSupabase();
        const apiKey = await getMyCashApiKey();

        // 1. Check local DB for expiration
        const { data: dbTx } = await supabase
            .from('transactions')
            .select('created_at, status')
            .eq('external_id', String(externalId))
            .single();

        if (dbTx && dbTx.status === 'pending') {
            const createdAt = new Date(dbTx.created_at).getTime();
            const now = Date.now();
            const diffMinutes = (now - createdAt) / (1000 * 60);

            if (diffMinutes > 60) {
                // Mark as cancelled locally
                await supabase
                    .from('transactions')
                    .update({ status: 'cancelled', is_final: true })
                    .eq('external_id', String(externalId));

                return NextResponse.json({
                    status: 'cancelled',
                    is_final: true,
                    message: "PIX expirado (Excedeu 60 minutos)"
                });
            }
        }

        // 2. Call MyCash status API directly using the external_id
        const mycashRes = await fetch(
            `https://mycash.cc/api/v1/pix/status/${externalId}`,
            {
                method: 'GET',
                headers: {
                    'Authorization': apiKey,
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
        const currentMyCashStatus = mycashData.status; // from remote MyCash API
        const isFinal = mycashData.is_final || currentMyCashStatus === 'completed' || currentMyCashStatus === 'cancelled';

        // 3. Get full local transaction data to check "credited" status
        const { data: tx } = await supabase
            .from('transactions')
            .select('*')
            .eq('external_id', String(externalId))
            .single();

        if (tx) {
            // Update local status if it changed
            if (tx.status !== currentMyCashStatus) {
                await supabase
                    .from('transactions')
                    .update({
                        status: currentMyCashStatus,
                        is_final: isFinal,
                    })
                    .eq('external_id', String(externalId));
            }

            // CRITICAL: Credit balance ONLY IF it's a deposit AND it just reached 'completed' status AND IT WASN'T CREDITED ALREADY
            if (currentMyCashStatus === 'completed' && tx.type === 'deposit' && !tx.credited) {
                if (tx.user_id) {
                    // Fetch profile to update balance (or use atomic update if we had an RPC)
                    const { data: profile } = await supabase
                        .from('profiles')
                        .select('balance')
                        .eq('id', tx.user_id)
                        .single();

                    if (profile) {
                        const newBalance = Number(profile.balance) + Number(tx.amount_net);
                        const lockUntil = new Date(Date.now() + 10 * 60 * 1000).toISOString();

                        // Use a simple update for now, but mark 'credited' to prevent double-spending
                        const { error: balanceError } = await supabase
                            .from('profiles')
                            .update({
                                balance: newBalance,
                                withdraw_lock_until: lockUntil
                            })
                            .eq('id', tx.user_id);

                        if (!balanceError) {
                            // Mark transaction as credited ONLY ON SUCCESSFUL update
                            await supabase
                                .from('transactions')
                                .update({ credited: true })
                                .eq('external_id', String(externalId));
                        }
                    }
                }
            }
        }

        return NextResponse.json({
            status: currentMyCashStatus,
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
