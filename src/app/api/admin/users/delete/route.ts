import { NextResponse } from 'next/server';
import { getServerSupabase } from '@/lib/supabase';

// This API allows the Admin to delete a user and all their financial data.
// It requires the SUPABASE_SERVICE_ROLE_KEY to bypass RLS and delete from Auth.
export async function DELETE(req: Request) {
    try {
        const { userId } = await req.json();

        if (!userId) {
            return NextResponse.json({ error: "ID do usuário é obrigatório" }, { status: 400 });
        }

        const supabase = getServerSupabase();

        // 0. Check for balance before deleting
        const { data: profile, error: fetchError } = await supabase
            .from('profiles')
            .select('balance')
            .eq('id', userId)
            .single();

        if (fetchError && fetchError.code !== 'PGRST116') {
            return NextResponse.json({ error: "Erro ao consultar saldo do operador" }, { status: 500 });
        }

        if (profile && Number(profile.balance) > 0) {
            return NextResponse.json({
                error: `Impossível excluir: este operador possui saldo de ${new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(profile.balance)}. O saldo deve ser sacado ou zerado antes da exclusão.`
            }, { status: 400 });
        }

        // 1. Delete transactions (financial data)
        await supabase.from('transactions').delete().eq('user_id', userId);

        // 2. Delete user PIX keys
        await supabase.from('user_pix_keys').delete().eq('user_id', userId);

        // 3. Delete profile
        await supabase.from('profiles').delete().eq('id', userId);

        // 4. Delete from Auth (requires admin privileges)
        const { error: authError } = await supabase.auth.admin.deleteUser(userId);

        if (authError) {
            console.error("Auth Deletion Error:", authError);
            return NextResponse.json({ error: "Erro ao excluir conta de acesso (Auth). Verifique as permissões de Admin." }, { status: 500 });
        }

        return NextResponse.json({
            success: true,
            message: "Operador e dados financeiros excluídos com sucesso"
        });

    } catch (error: any) {
        console.error("Delete User API Error:", error);
        return NextResponse.json({
            error: error.message || "Erro interno ao excluir usuário"
        }, { status: 500 });
    }
}
