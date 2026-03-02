import { NextResponse } from 'next/server';
import { getServerSupabase } from '@/lib/supabase';

export async function POST(req: Request) {
    try {
        const supabase = getServerSupabase();

        // 1. Delete all transactions
        const { error: txError } = await supabase
            .from('transactions')
            .delete()
            .neq('id', '00000000-0000-0000-0000-000000000000'); // Delete all

        if (txError) throw txError;

        // 2. Reset all balances to 0
        const { error: profileError } = await supabase
            .from('profiles')
            .update({ balance: 0 })
            .neq('id', '00000000-0000-0000-0000-000000000000'); // Affect all

        if (profileError) throw profileError;

        // 3. Clear all user PIX keys (optional but requested for "clean Slate")
        await supabase.from('user_pix_keys').delete().neq('user_id', '0');

        return NextResponse.json({
            success: true,
            message: "Sistema resetado com sucesso. Todos os dados financeiros foram limpos."
        });

    } catch (error: any) {
        console.error("Reset Data Error:", error);
        return NextResponse.json({ error: error.message || "Erro ao resetar dados" }, { status: 500 });
    }
}
