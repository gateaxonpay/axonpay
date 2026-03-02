import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function checkColumns() {
    const { data, error } = await supabase
        .from('transactions')
        .select('*')
        .limit(1);

    if (error) {
        console.error('Error fetching transactions:', error.message);
        return;
    }

    if (data && data.length > 0) {
        console.log('Columns in transactions:', Object.keys(data[0]));
    } else {
        console.log('No transactions found.');
    }

    const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('*')
        .limit(1);

    if (profileError) {
        console.error('Error fetching profiles:', profileError.message);
        return;
    }

    if (profile && profile.length > 0) {
        console.log('Columns in profiles:', Object.keys(profile[0]));
    } else {
        console.log('No profiles found.');
    }
}

checkColumns();
