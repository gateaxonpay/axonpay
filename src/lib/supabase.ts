import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

// Client-side (browser) — respects RLS
export const supabase = createClient(supabaseUrl, supabaseAnonKey);

// Server-side — bypasses RLS for API routes
// Uses service role key if available, otherwise falls back to anon key
export function getServerSupabase() {
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    return createClient(supabaseUrl, serviceKey || supabaseAnonKey, {
        auth: { persistSession: false }
    });
}
