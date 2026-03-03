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

        // 3. Call MyCash status API (same endpoint for deposit AND withdraw per their docs)
        const statusUrl = `https://mycash.cc/api/v1/pix/status/${externalId}`;

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
        console.log(`[STATUS] MyCash API Response for ${externalId}:`, JSON.stringify(mycashData));

        // 4. Handle API Errors (including 200 OK with error field)
        if (!mycashRes.ok || mycashData.error) {
            console.error('[STATUS] MyCash API Error details:', mycashRes.status, mycashData.error);
            return NextResponse.json(
                { error: mycashData.error || 'Erro ao consultar status no gateway' },
                { status: mycashRes.status === 200 ? 400 : mycashRes.status }
            );
        }

        // 5. Normalize Status according to User Dictionary
        const rawStatus = (mycashData.status || '').toLowerCase().trim();

        const normalizeStatus = (status: string): string => {
            const s = (status || '').toLowerCase().trim();

            // SUCCESS: paid (deposit) or completed (withdraw)
            if (['paid', 'completed', 'approved', 'success', 'confirmed', 'settled', 'concluido', 'concluído', 'pago', 'sucesso'].includes(s)) {
                return 'completed';
            }

            // CANCELLED: failed or expired
            if (['cancelled', 'canceled', 'failed', 'rejected', 'error', 'expired', 'cancelado', 'falhou', 'erro'].includes(s)) {
                return 'cancelled';
            }

            // PROCESSING: strictly for withdrawals being sent
            if (['processing', 'busy', 'sending', 'queued', 'in_progress', 'processando'].includes(s)) {
                return 'processing';
            }

            return 'pending';
        };

        const remoteStatus = normalizeStatus(rawStatus);
        console.log(`[STATUS] Mapping: "${rawStatus}" -> "${remoteStatus}"`);

        const isFinal = mycashData.is_final === true || remoteStatus === 'completed' || remoteStatus === 'cancelled';

        // 6. Update local transaction
        if (localTx && localTx.status !== remoteStatus) {
            console.log(`[STATUS] State Change: ${localTx.status} -> ${remoteStatus} (is_final: ${isFinal})`);
            const { error: updateError } = await supabase
                .from('transactions')
                .update({
                    status: remoteStatus,
                    is_final: isFinal,
                })
                .eq('external_id', String(externalId));

            if (updateError) console.error('[STATUS] DB Update Error:', updateError.message);
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
