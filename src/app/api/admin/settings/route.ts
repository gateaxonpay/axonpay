import { NextResponse } from 'next/server';
import { getServerSupabase } from '@/lib/supabase';

export async function GET() {
    try {
        const supabase = getServerSupabase();
        const { data, error } = await supabase
            .from('app_settings')
            .select('*');

        if (error) {
            // Table might not exist yet
            console.error("Settings fetch error:", error);
            return NextResponse.json({ settings: [] });
        }

        return NextResponse.json({ settings: data });
    } catch (error) {
        return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
    }
}

export async function POST(req: Request) {
    try {
        const { key, value } = await req.json();
        const supabase = getServerSupabase();

        const { error } = await supabase
            .from('app_settings')
            .upsert({ key, value, updated_at: new Date().toISOString() });

        if (error) throw error;

        return NextResponse.json({ success: true });
    } catch (error: any) {
        console.error("Settings update error:", error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
