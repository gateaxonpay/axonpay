import { NextResponse } from 'next/server';
import { getServerSupabase } from '@/lib/supabase';

// One-time migration endpoint to add tax_rate column to profiles table.
// Access via: GET /api/admin/migrate-tax-rate
// This is idempotent — safe to run multiple times.
export async function GET() {
    try {
        const supabase = getServerSupabase();

        // Try to add the tax_rate column using raw SQL via Supabase's rpc
        // If the column already exists, this will fail silently
        const { error } = await supabase.rpc('exec_sql', {
            query: `
                ALTER TABLE profiles 
                ADD COLUMN IF NOT EXISTS tax_rate NUMERIC(4,2) DEFAULT 0.30;
            `
        });

        if (error) {
            // If rpc doesn't exist, try a different approach: just update existing profiles
            console.log('[MIGRATE] RPC not available, trying direct approach...');

            // Test if column exists by trying to select it
            const { data: testData, error: testError } = await supabase
                .from('profiles')
                .select('tax_rate')
                .limit(1);

            if (testError && testError.message.includes('tax_rate')) {
                return NextResponse.json({
                    success: false,
                    message: 'A coluna tax_rate NÃO existe na tabela profiles. Você precisa adicioná-la manualmente no Supabase Dashboard.',
                    instructions: [
                        '1. Acesse o painel do Supabase (https://supabase.com/dashboard)',
                        '2. Vá em Table Editor → profiles',
                        '3. Clique em "+" para adicionar coluna',
                        '4. Nome: tax_rate',
                        '5. Tipo: numeric',
                        '6. Default: 0.30',
                        '7. Salve e pronto!'
                    ],
                    sql: 'ALTER TABLE profiles ADD COLUMN tax_rate NUMERIC(4,2) DEFAULT 0.30;'
                });
            }

            // Column exists! Make sure all null values get the default
            const { error: updateError } = await supabase
                .from('profiles')
                .update({ tax_rate: 0.30 })
                .is('tax_rate', null);

            return NextResponse.json({
                success: true,
                message: 'Coluna tax_rate já existe. Valores nulos atualizados para 0.30 (padrão).',
                updated_nulls: !updateError
            });
        }

        return NextResponse.json({
            success: true,
            message: 'Coluna tax_rate adicionada com sucesso! Default: 0.30'
        });

    } catch (error: any) {
        console.error('[MIGRATE] Error:', error);
        return NextResponse.json({
            success: false,
            error: error.message
        }, { status: 500 });
    }
}
