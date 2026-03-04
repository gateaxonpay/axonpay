import { createClient } from '@supabase/supabase-js';
import * as fs from 'fs';
import * as path from 'path';

// Manual env loader for standalone script
function loadEnv() {
    try {
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
            console.log('✅ Loaded .env.local');
        }
    } catch (e) {
        console.error('Error loading .env.local', e);
    }
}

loadEnv();

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const API_KEY = process.env.MYCASH_API_KEY;

// User Session Cookie for Scraping
const COOKIE = 'session=.eJwljrFOwzAQQP_FK0i1z87ZqcSABANkYWBiie7Od22gBTVpBBTx71hie-9N78eNNuuyd1ujw6LXbpyq2zoMMZqhQuIQkUMuFWohAcYepBRJCXwHhmKxU2GggCSoMWYO2CfO1qgW7rNYVe1zJVKEUDACehNjzRmMOCYRahp86aWEpB2xV9dG1kXn_5sOmtsyru_TaZ1s0rlFGs67z8P5uPObBxR-fXwa4vFuf_91G3SzfnwPp8vV_ALPF3q7cb9_M6hG5Q.aabYfw.4VEiCQLpmFAvHmFsq6pMramZ5zM; cf_clearance=rmZn52X7XHB7ogidSjTl3aEi2FfiHta2Xj4OYdU4gUA-1772547462-1.2.1.1-AicUzPAyaTpwNqtBN6e6pwg7FkGHYu17f8HH7U84FZmvy_jnoul7UilyDD2Q0ra3QLfkQclOHB6GL3Zgwtzh5LXuDGMXyPZ1z3KHYD.bZIS0XXIkDLGsLcoVW5O3K6kJTjDvbpS0q85_4I6KrgPMRjc3ftyWFvsuwmPJx7w0dz.jhVkdD0L1dmOF7.nAfkF3Skoeu0oKbX1o_QFfAd570gY1zCbP3Pciw5IE0HgHryI';

if (!supabaseUrl || !serviceKey) {
    console.error('❌ Missing Supabase configuration.');
    process.exit(1);
}

const supabase = createClient(supabaseUrl!, serviceKey!);

const normalizeStatus = (status: string): string => {
    const s = (status || '').toLowerCase().trim();
    if (['paid', 'completed', 'approved', 'success', 'confirmed', 'settled', 'concluido', 'concluído', 'pago', 'sucesso'].includes(s)) return 'completed';
    if (['cancelled', 'canceled', 'failed', 'rejected', 'error', 'expired', 'cancelado', 'falhou', 'erro'].includes(s)) return 'cancelled';
    if (['processing', 'busy', 'sending', 'queued', 'in_progress', 'processando'].includes(s)) return 'processing';
    return 'pending';
};

/**
 * HIGH-SPEED SYNC: Fetches the last 20 transactions from the dashboard directly.
 */
async function syncGlobalTransactions() {
    try {
        const res = await fetch('https://mycash.cc/api/check-reload', {
            headers: {
                'cookie': COOKIE,
                'user-agent': 'Mozilla/5.0 (Linux; Android 6.0; Nexus 5 Build/MRA58N) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/145.0.0.0 Mobile Safari/537.36',
                'referer': 'https://mycash.cc/transactions',
                'accept': '*/*'
            }
        });

        if (!res.ok) {
            console.error(`\n[ERR] Session fetch failed (${res.status}). Cookie might be expired.`);
            return false;
        }

        const data: any = await res.json();
        const rawHistory = data.history || [];

        if (rawHistory.length === 0) return true;

        for (const item of rawHistory) {
            const externalId = String(item.id);
            const rawStatus = item.status;
            const remoteStatus = normalizeStatus(rawStatus);
            const isFinal = remoteStatus === 'completed' || remoteStatus === 'cancelled';

            // Find matching transaction in OUR database
            const { data: tx } = await supabase
                .from('transactions')
                .select('*')
                .eq('external_id', externalId)
                .is('is_final', false)
                .single();

            if (tx) {
                console.log(`\n[MATCH FOUND] ID:${tx.id} Ext:${externalId} Status: ${tx.status} -> ${remoteStatus}`);

                const updatePayload: any = {
                    status: remoteStatus,
                    is_final: isFinal,
                    updated_at: new Date().toISOString()
                };

                const { error: updateError } = await supabase
                    .from('transactions')
                    .update(updatePayload)
                    .eq('id', tx.id);

                if (!updateError && remoteStatus === 'completed' && tx.type === 'deposit' && !tx.credited) {
                    console.log(`💰 PAYOUT: Crediting user ${tx.user_id} amount ${tx.amount_net}`);
                    const { data: prof } = await supabase.from('profiles').select('balance').eq('id', tx.user_id).single();
                    if (prof) {
                        const newBalance = Number(prof.balance) + Number(tx.amount_net);
                        await supabase.from('profiles').update({ balance: newBalance }).eq('id', tx.user_id);
                        await supabase.from('transactions').update({ credited: true }).eq('id', tx.id);
                        console.log(`✅ Balance Updated! User ${tx.user_id} now has ${newBalance}`);
                    }
                }
            }
        }
        return true;
    } catch (e: any) {
        console.error(`\n[FATAL ERR] Global Sync: ${e.message}`);
        return false;
    }
}

async function individualBackupSync() {
    try {
        const sixtySecondsAgo = new Date(Date.now() - 61000).toISOString();
        const { data: readyTxs } = await supabase
            .from('transactions')
            .select('*')
            .eq('is_final', false)
            .or(`updated_at.lt.${sixtySecondsAgo},updated_at.is.null`)
            .order('updated_at', { ascending: true })
            .limit(1);

        if (readyTxs && readyTxs.length > 0) {
            const tx = readyTxs[0];
            if (!API_KEY) return;
            const statusUrl = `https://mycash.cc/api/v1/pix/status/${tx.external_id}`;
            const res = await fetch(statusUrl, { headers: { 'Authorization': API_KEY } });

            if (res.ok) {
                const mycashData: any = await res.json();
                const remoteStatus = normalizeStatus(mycashData.status);
                const isFinal = mycashData.is_final || remoteStatus === 'completed' || remoteStatus === 'cancelled';

                await supabase.from('transactions').update({
                    status: remoteStatus,
                    is_final: isFinal,
                    updated_at: new Date().toISOString()
                }).eq('id', tx.id);
            }
        }
    } catch (e) { }
}

async function loop() {
    const isSessionOk = await syncGlobalTransactions();
    await individualBackupSync();

    const { data: allActive } = await supabase.from('transactions').select('id').eq('is_final', false);
    const activeCount = allActive?.length || 0;
    const time = new Date().toLocaleTimeString();

    // Using \r to rewrite the line and keep the terminal clean
    const statusMsg = isSessionOk ? '✅ Session: Active' : '❌ Session: Link Broken';
    process.stdout.write(`\r[${time}] ${statusMsg} | Monitoring: ${activeCount} transactions...         `);

    setTimeout(loop, 10000);
}

console.log('🚀 AxonPay FLASH SYNC (V3) Started!');
console.log('--- Terminal Clean Mode Active ---');
loop();
