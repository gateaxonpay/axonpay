import { NextResponse } from 'next/server';
import { getServerSupabase } from '@/lib/supabase';

// This API is for Admin to create users. 
// Requires SUPABASE_SERVICE_ROLE_KEY to work properly.
export async function POST(req: Request) {
    try {
        const { email, password, name } = await req.json();

        if (!email || !password || !name) {
            return NextResponse.json({ error: "E-mail, senha e nome são obrigatórios" }, { status: 400 });
        }

        const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
        const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;

        if (!serviceKey || serviceKey.includes('your-service-role-key')) {
            return NextResponse.json({
                error: "Configuração incompleta: O 'SUPABASE_SERVICE_ROLE_KEY' não foi configurado nas variáveis de ambiente da Vercel."
            }, { status: 500 });
        }

        const supabase = getServerSupabase();

        // 1. Create the user in Auth
        const { data: authData, error: authError } = await supabase.auth.admin.createUser({
            email,
            password,
            email_confirm: true // Auto confirm
        });

        if (authError) throw authError;

        // 2. Create the associated profile
        // Usually handled by a SQL trigger "on_auth_user_created", 
        // but we ensure it here if that trigger doesn't exist.
        const { error: profileError } = await supabase
            .from('profiles')
            .upsert({
                id: authData.user.id,
                email: email,
                full_name: name,
                balance: 0,
                pix_key: null,
                pix_type: null
            }, { onConflict: 'id' });

        if (profileError) {
            console.error("Profile creation error:", profileError);
            // Don't fail the whole user creation if just profile failed, but it's important.
        }

        return NextResponse.json({
            success: true,
            message: "Usuário criado com sucesso",
            user: authData.user
        });

    } catch (error: any) {
        console.error("Create User API Error:", error);
        return NextResponse.json({
            error: error.message || "Erro interno ao criar usuário"
        }, { status: 500 });
    }
}
