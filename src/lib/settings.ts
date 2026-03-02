import { getServerSupabase } from './supabase';

export async function getMyCashApiKey(): Promise<string> {
    const supabase = getServerSupabase();

    // 1. Try DB
    try {
        const { data, error } = await supabase
            .from('app_settings')
            .select('value')
            .eq('key', 'MYCASH_API_KEY')
            .single();

        if (!error && data?.value) {
            return data.value;
        }
    } catch (e) {
        // Table might not exist or other DB error
    }

    // 2. Fallback to Env
    return process.env.MYCASH_API_KEY || '';
}
