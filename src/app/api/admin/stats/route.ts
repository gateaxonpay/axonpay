import { NextResponse } from 'next/server';
import { getServerSupabase } from '@/lib/supabase';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function GET(req: Request) {
    try {
        const supabase = getServerSupabase();

        // 0. Cancel expired pending transactions (> 30m)
        const thirtyMinutesAgo = new Date(Date.now() - 30 * 60 * 1000).toISOString();
        await supabase
            .from('transactions')
            .update({ status: 'cancelled', is_final: true })
            .eq('status', 'pending')
            .lt('created_at', thirtyMinutesAgo);

        // 1. Fetch all transactions (no RLS)
        const { data: txs, error: txsError } = await supabase
            .from('transactions')
            .select('*')
            .order('created_at', { ascending: false });

        if (txsError) throw txsError;

        // 2. Fetch all users from Auth (no RLS)
        const { data: { users: authUsers }, error: authError } = await supabase.auth.admin.listUsers();

        if (authError) throw authError;

        // 3. Fetch all profiles
        const { data: profiles, error: profilesError } = await supabase
            .from('profiles')
            .select('*');

        if (profilesError) throw profilesError;

        // Merge profiles with Auth users (Auth is the source of truth for login)
        const allUsers = authUsers.map(au => {
            const profile = profiles?.find(p => p.id === au.id);
            return {
                id: au.id,
                email: au.email?.split('@')[0] || 'N/A', // Oculta o domínio no relatório
                balance: profile?.balance || 0,
                full_name: au.user_metadata?.full_name || profile?.full_name || au.email?.split('@')[0] || 'N/A'
            };
        });

        // 3. Simple aggregate stats
        const totalPaid = txs
            .filter((t: any) => t.status === 'completed' && t.type === 'deposit')
            .reduce((sum: number, t: any) => sum + Number(t.amount_original), 0);

        const totalGenerated = txs
            .filter((t: any) => t.type === 'deposit' && t.status !== 'cancelled')
            .reduce((sum: number, t: any) => sum + Number(t.amount_original), 0);

        // 4. Per-user metrics
        const userMetrics = allUsers.map(profile => {
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
                full_name: profile.full_name,
                balance: profile.balance,
                totalGenerated: userGenerated,
                totalPaid: userPaid,
                totalWithdrawn: userWithdrawn,
                txCount: userTxs.length
            };
        }).sort((a, b) => b.totalGenerated - a.totalGenerated);

        // Include user info in transactions for display
        const enrichedTxs = txs.map(tx => {
            const user = allUsers.find(u => u.id === tx.user_id);
            return {
                ...tx,
                user_email: user?.email,
                user_name: user?.full_name
            };
        });

        return NextResponse.json({
            transactions: enrichedTxs,
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
