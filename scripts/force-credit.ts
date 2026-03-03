import { createClient } from '@supabase/supabase-js';
import Decimal from 'decimal.js';

const SUPABASE_URL = 'https://rscqvvpymbvfwywoapig.supabase.co';
const SERVICE_ROLE = 'REDACTED'; // This should be in the environment

async function forceCredit(id: string) {
    const supabase = createClient(SUPABASE_URL, SERVICE_ROLE);

    // 1. Get the transaction
    const { data: tx, error: txErr } = await supabase
        .from('transactions')
        .select('*')
        .eq('external_id', id)
        .single();

    if (txErr || !tx) {
        console.error("Transação não encontrada:", id);
        return;
    }

    if (tx.credited) {
        console.log("Transação já foi creditada!");
        return;
    }

    // 2. Get user profile
    const { data: profile } = await supabase
        .from('profiles')
        .select('balance')
        .eq('id', tx.user_id)
        .single();

    // 3. Update balance and mark as credited
    const newBalance = new Decimal(profile?.balance || 0).plus(tx.amount_net).toNumber();

    await supabase.from('profiles')
        .update({ balance: newBalance })
        .eq('id', tx.user_id);

    await supabase.from('transactions')
        .update({ status: 'completed', credited: true, is_final: true })
        .eq('external_id', id);

    console.log(`CRÉDITO MANUAL OK! Usuário: ${tx.user_id}, Valor: ${tx.amount_net}, Novo Saldo: ${newBalance}`);
}

forceCredit('167');
