import { createClient } from '@supabase/supabase-js';
import * as fs from 'fs';
import * as path from 'path';

function loadEnv() {
    const envPath = path.resolve(process.cwd(), '.env.local');
    if (fs.existsSync(envPath)) {
        const content = fs.readFileSync(envPath, 'utf-8');
        content.split(/\r?\n/).forEach(line => {
            const trimmed = line.trim();
            if (!trimmed || trimmed.startsWith('#')) return;
            const match = trimmed.match(/^([^=]+)=(.*)$/);
            if (match) {
                const key = match[1].trim();
                const value = match[2].trim().replace(/^["']|["']$/g, '');
                process.env[key] = value;
            }
        });
    }
}
loadEnv();

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

async function check() {
    const tables = ['transactions', 'profiles', 'app_settings'];
    for (const t of tables) {
        const { data, error } = await supabase.from(t).select('*').limit(1);
        if (error) {
            console.log(`Error on ${t}:`, error.message);
        } else if (data && data.length > 0) {
            console.log(`Columns in ${t}:`, Object.keys(data[0]));
        } else {
            console.log(`No data in ${t}`);
        }
    }
}
check();
