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

        // 1. Delete transactions (financial data)
        const { error: txError } = await supabase
            .from('transactions')
            .delete()
            .eq('user_id', userId);

        if (txError) {
            console.error("Error deleting transactions:", txError);
            // We continue anyway to try and delete the user
        }

        // 2. Delete user PIX keys
        const { error: keysError } = await supabase
            .from('user_pix_keys')
            .delete()
            .eq('user_id', userId);

        if (keysError) {
            console.error("Error deleting PIX keys:", keysError);
        }

        // 3. Delete profile
        const { error: profileError } = await supabase
            .from('profiles')
            .delete()
            .eq('id', userId);

        if (profileError) {
            console.error("Error deleting profile:", profileError);
        }

        // 4. Delete from Auth (the most critical part, requires admin privileges)
        const { error: authError } = await supabase.auth.admin.deleteUser(userId);

        if (authError) {
            throw authError;
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
