import { NextResponse } from 'next/server';
import { getServerSupabase } from '@/lib/supabase';

export async function GET(req: Request) {
    try {
        const supabase = getServerSupabase();

        // 1. Fetch all transactions (no RLS)
        const { data: txs, error: txsError } = await supabase
            .from('transactions')
            .select('*')
            .order('created_at', { ascending: false });

        if (txsError) throw txsError;

        // 2. Fetch all users to map them in the report
        const { data: profiles, error: profilesError } = await supabase
            .from('profiles')
            .select('*');

        if (profilesError) throw profilesError;

        // 3. Simple aggregate stats
        const totalPaid = txs
            .filter((t: any) => t.status === 'completed' && t.type === 'deposit')
            .reduce((sum: number, t: any) => sum + Number(t.amount_original), 0);

        const totalGenerated = txs
            .filter((t: any) => t.type === 'deposit')
            .reduce((sum: number, t: any) => sum + Number(t.amount_original), 0);

        // 4. Per-user metrics
        const userMetrics = profiles.map(profile => {
            const userTxs = txs.filter(t => t.user_id === profile.id);
            const userGenerated = userTxs
                .filter(t => t.type === 'deposit')
                .reduce((sum, t) => sum + Number(t.amount_original), 0);
            const userPaid = userTxs
                .filter(t => t.status === 'completed' && t.type === 'deposit')
                .reduce((sum, t) => sum + Number(t.amount_original), 0);
            const userWithdrawn = userTxs
                .filter(t => t.status === 'completed' && t.type === 'withdraw')
                .reduce((sum, t) => sum + Number(t.amount_original), 0);

            return {
                id: profile.id,
                email: profile.email,
                balance: profile.balance,
                totalGenerated: userGenerated,
                totalPaid: userPaid,
                totalWithdrawn: userWithdrawn,
                txCount: userTxs.length
            };
        }).sort((a, b) => b.totalGenerated - a.totalGenerated);

        return NextResponse.json({
            transactions: txs,
            userMetrics,
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
