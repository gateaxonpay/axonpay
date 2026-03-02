import { NextResponse } from 'next/server';
import { getServerSupabase } from '@/lib/supabase';
import { getMyCashApiKey } from '@/lib/settings';

export async function POST(req: Request) {
    try {
        const { userId } = await req.json();
        if (!userId) return NextResponse.json({ error: 'User ID required' }, { status: 400 });

        const supabase = getServerSupabase(); // Bypass RLS
        const apiKey = await getMyCashApiKey();

        if (!apiKey) {
            return NextResponse.json({ error: 'API Key não configurada no Admin' }, { status: 503 });
        }

        // 1. Check rate limit in DB (profiles table must have last_balance_sync)
        const { data: profile } = await supabase
            .from('profiles')
            .select('last_balance_sync')
            .eq('id', userId)
            .single();

        if (profile?.last_balance_sync) {
            const lastSync = new Date(profile.last_balance_sync).getTime();
            const now = Date.now();
            const diffSeconds = Math.floor((now - lastSync) / 1000);

            if (diffSeconds < 600) { // 10 minutes = 600 seconds
                return NextResponse.json({
                    error: `Rate limit excedido. Tente novamente em ${600 - diffSeconds}s`
                }, { status: 429 });
            }
        }

        // 2. Call MyCash Balance API
        const res = await fetch('https://mycash.cc/api/v1/balance', {
            method: 'GET',
            headers: {
                'Authorization': apiKey,
                'Content-Type': 'application/json'
            }
        });

        const data = await res.json();

        if (!res.ok) {
            return NextResponse.json({
                error: data.error || 'Erro interno de conexão',
                details: data.details || 'Não foi possível conectar ao servidor.'
            }, { status: res.status });
        }

        // 3. Update local balance and sync timestamp
        // we use the return from MyCash to update our local source of truth
        const { error: updateError } = await supabase
            .from('profiles')
            .update({
                balance: data.balance,
                last_balance_sync: new Date().toISOString()
            })
            .eq('id', userId);

        if (updateError) {
            console.error('Update Profile Balance Error:', updateError.message);
            // Even if update fails, return the data we got
        }

        return NextResponse.json({
            username: data.username,
            balance: data.balance,
            currency: data.currency
        });

    } catch (err: any) {
        console.error('Sync Balance API Error:', err);
        return NextResponse.json({ error: 'Erro interno de servidor' }, { status: 500 });
    }
}
