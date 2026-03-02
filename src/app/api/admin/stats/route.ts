import { NextResponse } from 'next/server';
import { getServerSupabase } from '@/lib/supabase';

export async function GET(req: Request) {
    try {
        const supabase = getServerSupabase();

        // Buscar todas as transações sem RLS (usando service role)
        const { data: txs, error: txsError } = await supabase
            .from('transactions')
            .select('*')
            .order('created_at', { ascending: false });

        if (txsError) throw txsError;

        // Calcular estatísticas simples
        const totalPaid = txs
            .filter((t: any) => t.status === 'completed' && t.type === 'deposit')
            .reduce((sum: number, t: any) => sum + Number(t.amount_original), 0);

        const totalGenerated = txs
            .filter((t: any) => t.type === 'deposit')
            .reduce((sum: number, t: any) => sum + Number(t.amount_original), 0);

        return NextResponse.json({
            transactions: txs,
            stats: {
                totalPaid,
                totalGenerated
            }
        });

    } catch (error: any) {
        console.error("Admin API Error:", error);
        return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
    }
}
