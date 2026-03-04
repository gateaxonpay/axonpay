import { NextResponse } from 'next/server';
import { getServerSupabase } from '@/lib/supabase';

// This API is for Admin to update user passwords.
// Requires SUPABASE_SERVICE_ROLE_KEY to work properly.
export async function POST(req: Request) {
    try {
        const { userId, newPassword } = await req.json();

        if (!userId || !newPassword) {
            return NextResponse.json({ error: "ID do usuário e nova senha são obrigatórios" }, { status: 400 });
        }

        if (newPassword.length < 6) {
            return NextResponse.json({ error: "A senha deve ter pelo menos 6 caracteres" }, { status: 400 });
        }

        const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
        if (!serviceKey || serviceKey.includes('your-service-role-key')) {
            return NextResponse.json({
                error: "Configuração incompleta: O 'SUPABASE_SERVICE_ROLE_KEY' não está configurado."
            }, { status: 500 });
        }

        const supabase = getServerSupabase();

        // Update the user's password using the admin API
        const { data, error: authError } = await supabase.auth.admin.updateUserById(
            userId,
            { password: newPassword }
        );

        if (authError) {
            console.error("Auth update error:", authError);
            throw authError;
        }

        return NextResponse.json({
            success: true,
            message: "Senha alterada com sucesso",
            user: data.user
        });

    } catch (error: any) {
        console.error("Update Password API Error:", error);
        return NextResponse.json({
            error: error.message || "Erro interno ao alterar senha"
        }, { status: 500 });
    }
}
