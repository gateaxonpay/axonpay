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

        console.log('[STATUS] Checking status for external_id:', externalId);

        // 1. Find the local transaction
        const { data: localTx, error: localTxError } = await supabase
            .from('transactions')
            .select('*')
            .eq('external_id', String(externalId))
            .single();

        if (localTxError) {
            console.error('[STATUS] Local TX lookup error:', localTxError.message);
        }

        console.log('[STATUS] Local TX found:', localTx ? `id=${localTx.id}, user_id=${localTx.user_id}, status=${localTx.status}, credited=${localTx.credited}` : 'NOT FOUND');

        // 2. Check for PIX expiration (>60 min)
        if (localTx && localTx.status === 'pending') {
            const createdAt = new Date(localTx.created_at).getTime();
            const now = Date.now();
            const diffMinutes = (now - createdAt) / (1000 * 60);

            if (diffMinutes > 60) {
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

        // 3. Call MyCash status API (Check if it's deposit or withdraw)
        const isWithdraw = localTx?.type === 'withdraw';
        const statusUrl = isWithdraw
            ? `https://mycash.cc/api/v1/withdraw/status/${externalId}`
            : `https://mycash.cc/api/v1/pix/status/${externalId}`;

        console.log(`[STATUS] Calling MyCash API (${localTx?.type || 'unknown'}):`, statusUrl);
        const mycashRes = await fetch(
            statusUrl,
            {
                method: 'GET',
                headers: {
                    'Authorization': apiKey,
                },
            }
        );

        const mycashData = await mycashRes.json();
        console.log('[STATUS] MyCash RAW response:', JSON.stringify(mycashData));

        if (!mycashRes.ok) {
            console.error('[STATUS] MyCash API error:', mycashRes.status, mycashData);
            return NextResponse.json(
                { error: mycashData.error || 'Erro ao consultar status' },
                { status: mycashRes.status }
            );
        }

        // Normalize MyCash status — they may return different strings for withdrawals vs deposits
        const rawStatus = (mycashData.status || '').toLowerCase().trim();

        // Map known MyCash status variants to our internal statuses
        const normalizeStatus = (status: string, txType: string): string => {
            // Completed variants
            if (['completed', 'paid', 'done', 'approved', 'success', 'settled', 'confirmed'].includes(status)) {
                return 'completed';
            }
            // Failed variants
            if (['cancelled', 'canceled', 'failed', 'rejected', 'declined', 'error', 'expired'].includes(status)) {
                return status === 'expired' ? 'cancelled' : 'failed';
            }
            // Processing variants
            if (['processing', 'busy', 'in_progress', 'sending', 'queued'].includes(status)) {
                return 'processing';
            }
            // Pending variants
            if (['pending', 'waiting', 'awaiting', 'created'].includes(status)) {
                return 'pending';
            }
            // Return as-is if unknown
            return status;
        };

        const remoteStatus = normalizeStatus(rawStatus, localTx?.type || 'deposit');
        console.log('[STATUS] Normalized status:', rawStatus, '->', remoteStatus);

        const isFinal = mycashData.is_final || remoteStatus === 'completed' || remoteStatus === 'cancelled' || remoteStatus === 'failed';

        // 4. Update local transaction status if changed
        if (localTx && localTx.status !== remoteStatus) {
            console.log('[STATUS] Updating local status from', localTx.status, 'to', remoteStatus);
            const { error: updateError } = await supabase
                .from('transactions')
                .update({
                    status: remoteStatus,
                    is_final: isFinal,
                })
                .eq('external_id', String(externalId));

            if (updateError) {
                console.error('[STATUS] Update TX error:', updateError.message);
            }
        }

        // 5. CREDIT BALANCE if deposit is completed and not yet credited
        if (remoteStatus === 'completed' && localTx && localTx.type === 'deposit' && !localTx.credited) {
            console.log('[STATUS] Payment COMPLETED! Crediting user:', localTx.user_id, 'amount_net:', localTx.amount_net);

            if (localTx.user_id) {
                // Get current balance
                const { data: profile, error: profileError } = await supabase
                    .from('profiles')
                    .select('balance')
                    .eq('id', localTx.user_id)
                    .single();

                if (profileError) {
                    console.error('[STATUS] Profile fetch error:', profileError.message);

                    // Profile might not exist — auto-create it
                    const { error: createError } = await supabase
                        .from('profiles')
                        .insert({
                            id: localTx.user_id,
                            balance: Number(localTx.amount_net),
                        });

                    if (createError) {
                        console.error('[STATUS] Profile auto-create error:', createError.message);
                    } else {
                        console.log('[STATUS] Profile created with initial balance:', localTx.amount_net);
                        // Mark as credited
                        await supabase
                            .from('transactions')
                            .update({ credited: true })
                            .eq('external_id', String(externalId));
                    }
                } else if (profile) {
                    const newBalance = Number(profile.balance) + Number(localTx.amount_net);

                    console.log('[STATUS] Updating balance:', profile.balance, '->', newBalance);

                    const { error: balanceError } = await supabase
                        .from('profiles')
                        .update({
                            balance: newBalance
                        })
                        .eq('id', localTx.user_id);

                    if (balanceError) {
                        console.error('[STATUS] Balance update error:', balanceError.message);
                    } else {
                        console.log('[STATUS] Balance updated successfully! Marking as credited.');
                        // Mark transaction as credited
                        await supabase
                            .from('transactions')
                            .update({ credited: true })
                            .eq('external_id', String(externalId));
                    }
                }
            } else {
                console.error('[STATUS] CRITICAL: Transaction has no user_id! Cannot credit balance.');
            }
        }

        return NextResponse.json({
            status: remoteStatus,
            is_final: isFinal,
            amount: mycashData.amount,
            type: mycashData.type,
        });

    } catch (error: any) {
        console.error('[STATUS] Fatal Error:', error);
        return NextResponse.json(
            { error: 'Erro interno do servidor' },
            { status: 500 }
        );
    }
}
