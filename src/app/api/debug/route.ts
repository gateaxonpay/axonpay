import { NextResponse } from 'next/server';
import { getServerSupabase } from '@/lib/supabase';
import { getMyCashApiKey } from '@/lib/settings';

export async function GET(req: Request) {
    const results: Record<string, any> = {};

    try {
        const supabase = getServerSupabase();

        // 1. Check if service role key is actually set
        results.hasServiceRoleKey = !!process.env.SUPABASE_SERVICE_ROLE_KEY;
        results.serviceRoleKeyLength = process.env.SUPABASE_SERVICE_ROLE_KEY?.length || 0;

        // 2. Check if MyCash API key is available
        const apiKey = await getMyCashApiKey();
        results.hasMyCashApiKey = !!apiKey;
        results.mycashKeySource = apiKey ? (apiKey.startsWith('sk_') ? 'valid_format' : 'unknown_format') : 'missing';

        // 3. Check transactions table
        const { data: txs, error: txError } = await supabase
            .from('transactions')
            .select('id, user_id, external_id, type, status, amount_original, amount_net, credited, created_at')
            .order('created_at', { ascending: false })
            .limit(5);

        results.transactions = {
            count: txs?.length || 0,
            error: txError?.message || null,
            data: txs || [],
        };

        // 4. Check profiles table
        const { data: profiles, error: profError } = await supabase
            .from('profiles')
            .select('id, balance, email, withdraw_lock_until')
            .limit(5);

        results.profiles = {
            count: profiles?.length || 0,
            error: profError?.message || null,
            data: profiles || [],
        };

        // 5. Check user_pix_keys table
        const { data: keys, error: keysError } = await supabase
            .from('user_pix_keys')
            .select('*')
            .limit(5);

        results.pixKeys = {
            count: keys?.length || 0,
            error: keysError?.message || null,
        };

        // 6. Check if "credited" column exists in transactions
        const { data: colTest, error: colError } = await supabase
            .from('transactions')
            .select('credited')
            .limit(1);

        results.creditedColumnExists = !colError;
        results.creditedColumnError = colError?.message || null;

    } catch (err: any) {
        results.fatalError = err.message;
    }

    return NextResponse.json(results, { status: 200 });
}
