'use client';

import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import {
  Wallet,
  ArrowUpCircle,
  ArrowDownCircle,
  History,
  TrendingUp,
  CheckCircle2,
  Clock,
  XCircle,
  QrCode,
  LogOut,
  User as UserIcon,
  RefreshCcw,
  ShieldCheck,
  Activity
} from 'lucide-react';
import { cn, formatBRL } from '@/lib/utils';
import Link from 'next/link';
import { supabase } from '@/lib/supabase';
import { Transaction } from '@/types';
import { useRouter } from 'next/navigation';

export default function Dashboard() {
  const [balance, setBalance] = useState(0);
  const [email, setEmail] = useState('');
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const router = useRouter();

  const fetchData = async (userId: string) => {
    try {
      // 1. Sync any pending/processing transactions (both deposit and withdraw)
      const { data: pendingTxs } = await supabase
        .from('transactions')
        .select('external_id, type, status')
        .eq('user_id', userId)
        .in('status', ['pending', 'processing', 'busy'])
        .order('created_at', { ascending: false })
        .limit(10);

      if (pendingTxs && pendingTxs.length > 0) {
        console.log(`[DASHBOARD] Syncing ${pendingTxs.length} protocols...`);
        await Promise.allSettled(
          pendingTxs.map(tx => fetch(`/api/pix/status/${tx.external_id}`))
        );
      }

      // 2. Fetch profile balance
      const { data: profile } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .single();

      if (profile) setBalance(profile.balance);

      // 3. Fetch recent transactions
      const txRes = await fetch(`/api/user/transactions?userId=${userId}`);
      const txData = await txRes.json();

      if (txRes.ok && txData.transactions) {
        setTransactions(txData.transactions as Transaction[]);
      }
    } catch (err) {
      console.error('Data fetch error:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    let userId: string | null = null;
    async function checkUser() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        router.push('/auth');
        return;
      }
      userId = user.id;
      setEmail(user.email || '');
      fetchData(user.id);
    }

    checkUser();

    // Polling interval for real-time updates every 60s
    const interval = setInterval(() => {
      if (userId) fetchData(userId);
    }, 60000);

    return () => clearInterval(interval);
  }, []);

  const handleManualCheck = async (externalId: string) => {
    setIsLoading(true);
    await fetch(`/api/pix/status/${externalId}`);
    const { data: { user } } = await supabase.auth.getUser();
    if (user) await fetchData(user.id);
    setIsLoading(false);
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    router.push('/auth');
  };

  if (isLoading) {
    return (
      <div className="h-[60vh] flex flex-col items-center justify-center space-y-4">
        <RefreshCcw className="animate-spin text-primary" size={40} />
        <p className="text-[10px] uppercase font-black tracking-[0.5em] text-muted-foreground animate-pulse">Sincronizando Protocolos</p>
      </div>
    );
  }

  return (
    <div className="space-y-12 pb-20">
      {/* Welcome Header */}
      <div className="flex flex-col md:flex-row justify-between items-center bg-[#0a0a0a]/40 p-6 md:p-10 rounded-[40px] border border-white/5 backdrop-blur-3xl shadow-2xl relative overflow-hidden group gap-6">
        <div className="absolute top-0 right-0 w-64 h-64 bg-primary/5 blur-[80px] -mr-32 -mt-32 group-hover:bg-primary/10 transition-all duration-700" />

        <div className="flex flex-col md:flex-row items-center gap-6 relative text-center md:text-left">
          <div className="w-16 h-16 rounded-3xl bg-white/5 flex items-center justify-center text-primary border border-white/10 shadow-xl shadow-yellow-500/10">
            <UserIcon size={32} />
          </div>
          <div>
            <h1 className="text-2xl md:text-3xl font-black tracking-tighter uppercase italic text-white flex items-center justify-center md:justify-start gap-3">
              Axion Dashboard
              <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse shadow-[0_0_10px_rgba(34,197,94,0.5)]" />
            </h1>
            <p className="text-muted-foreground text-[10px] md:text-sm uppercase tracking-widest font-bold flex flex-wrap items-center justify-center md:justify-start gap-2">
              Usuário: <span className="text-white font-mono lowercase tracking-normal bg-white/5 px-2 py-0.5 rounded-lg break-all">{email}</span>
            </p>
          </div>
        </div>

        <button
          onClick={handleLogout}
          className="w-full md:w-14 h-14 bg-white/5 hover:bg-red-500/10 border border-white/10 rounded-2xl flex items-center justify-center text-muted-foreground hover:text-red-500 transition-all group/logout shadow-lg font-bold text-xs uppercase md:text-base"
        >
          <span className="md:hidden mr-2">Sair do Protocolo</span>
          <LogOut size={24} className="group-hover/logout:scale-110 transition-transform" />
        </button>
      </div>

      {/* Hero Balance Card */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 md:gap-10">
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="lg:col-span-2 relative h-auto md:h-80 rounded-[40px] md:rounded-[50px] overflow-hidden glass-card group shadow-2xl shadow-yellow-900/10 border-white/5"
        >
          {/* Background effects */}
          <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-primary/10 rounded-full blur-[120px] -mr-48 -mt-48 transition-all group-hover:bg-primary/20 duration-1000" />
          <div className="absolute bottom-0 left-0 w-96 h-96 bg-blue-500/5 rounded-full blur-[100px] -ml-28 -mb-28" />

          <div className="relative h-full p-8 md:p-12 flex flex-col justify-between space-y-10 md:space-y-0">
            <div className="flex justify-between items-start">
              <div className="space-y-2">
                <p className="text-[9px] md:text-[10px] uppercase font-black tracking-[0.4em] text-muted-foreground italic flex items-center gap-2">
                  <ShieldCheck size={12} className="text-primary" /> Liquidez Protocolar AXION
                </p>
                <h2 className="text-4xl md:text-6xl font-black text-white tracking-tighter italic">
                  {formatBRL(balance)}
                </h2>
                <div className="flex items-center gap-2 py-1 px-3 bg-white/5 rounded-full w-fit border border-white/5">
                  <div className="w-1.5 h-1.5 rounded-full bg-green-500" />
                  <span className="text-[9px] md:text-[10px] font-black uppercase tracking-widest text-green-500 italic">Disponível para Resgate</span>
                </div>
              </div>
              <div className="p-3 md:p-4 bg-white/5 rounded-2xl border border-white/10 group-hover:scale-110 group-hover:bg-white/10 transition-all shadow-xl shadow-yellow-500/10 active:scale-95 hidden sm:block">
                <Wallet className="text-primary" size={28} />
              </div>
            </div>

            <div className="flex flex-col sm:flex-row gap-4 md:gap-6">
              <Link href="/deposit" className="flex-1">
                <button className="w-full h-16 md:h-20 gold-gradient rounded-3xl font-black uppercase tracking-[0.2em] hover:scale-[1.02] active:scale-100 transition-all shadow-2xl shadow-yellow-600/30 flex items-center justify-center gap-3 italic text-xs md:text-base">
                  <ArrowUpCircle size={24} />
                  Aportar
                </button>
              </Link>
              <Link href="/withdraw" className="flex-1">
                <button className="w-full h-16 md:h-20 bg-white/5 border border-white/10 text-white rounded-3xl font-black uppercase tracking-[0.2em] hover:bg-white/10 transition-all hover:scale-[1.02] active:scale-100 italic flex items-center justify-center gap-3 text-xs md:text-base">
                  <ArrowDownCircle size={24} className="text-red-500" />
                  Resgatar
                </button>
              </Link>
            </div>
          </div>
        </motion.div>

        {/* Mini Stats Card */}
        <div className="space-y-6">
          <div className="glass-card p-8 rounded-[40px] border-white/5 flex items-center gap-5 hover:translate-x-2 transition-transform shadow-xl shadow-green-900/5">
            <div className="w-14 h-14 rounded-2xl bg-green-500/10 border border-green-500/20 flex items-center justify-center text-green-400 shadow-xl shadow-green-500/10">
              <TrendingUp size={24} />
            </div>
            <div>
              <p className="text-[10px] text-muted-foreground uppercase font-black tracking-widest">Network Speed</p>
              <h3 className="text-xl font-black italic">ULTRA FAST</h3>
            </div>
          </div>

          <div className="glass-card p-8 rounded-[40px] border-white/5 flex items-center gap-5 hover:translate-x-2 transition-transform shadow-xl shadow-yellow-900/5">
            <div className="w-14 h-14 rounded-2xl bg-primary/10 border border-primary/20 flex items-center justify-center text-primary shadow-xl shadow-yellow-500/10">
              <QrCode size={24} />
            </div>
            <div>
              <p className="text-[10px] text-muted-foreground uppercase font-black tracking-widest">Protocol Version</p>
              <h3 className="text-xl font-black italic">v3.0.1 ALPHA</h3>
            </div>
          </div>

          <div className="glass-card p-8 rounded-[40px] border-white/5 flex items-center gap-5 hover:translate-x-2 transition-transform shadow-xl shadow-blue-900/5">
            <div className="w-14 h-14 rounded-2xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center text-blue-400 shadow-xl shadow-blue-500/10">
              <History size={24} />
            </div>
            <div>
              <p className="text-[10px] text-muted-foreground uppercase font-black tracking-widest">Blockchain Node</p>
              <h3 className="text-xl font-black italic text-blue-400">ACTIVE</h3>
            </div>
          </div>
        </div>
      </div>

      {/* Transaction Table */}
      <div className="glass-card rounded-[40px] md:rounded-[50px] overflow-hidden border-white/5 shadow-2xl">
        <div className="p-6 md:p-10 border-b border-white/5 flex flex-col md:flex-row justify-between items-center bg-white/[0.02] gap-6">
          <div className="flex items-center gap-4 text-center md:text-left">
            <div className="p-3 bg-white/5 rounded-2xl border border-white/10 shadow-lg hidden sm:block">
              <History size={24} className="text-muted-foreground" />
            </div>
            <div>
              <h2 className="text-xl md:text-2xl font-black italic uppercase tracking-tighter">Fluxo de Protocolos</h2>
              <p className="text-[9px] md:text-[10px] uppercase font-black tracking-widest text-muted-foreground/60">Últimas 10 Atividades Registradas</p>
            </div>
          </div>
          <button className="text-[10px] md:text-xs font-black uppercase tracking-[0.3em] text-primary hover:text-white transition-all underline outline-none">
            Auditar Tudo
          </button>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="border-b border-white/5 bg-white/[0.01]">
                <th className="px-6 md:px-10 py-6 text-[9px] md:text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground/50">ID Transação</th>
                <th className="px-6 md:px-10 py-6 text-[9px] md:text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground/50">Operação</th>
                <th className="px-6 md:px-10 py-6 text-[9px] md:text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground/50 hidden md:table-cell">Valor Bruto</th>
                <th className="px-6 md:px-10 py-6 text-[9px] md:text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground/50">Valor Real</th>
                <th className="px-6 md:px-10 py-6 text-[9px] md:text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground/50">Status</th>
                <th className="px-6 md:px-10 py-6 text-[9px] md:text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground/50 hidden lg:table-cell">Timestamp</th>
                <th className="px-6 md:px-10 py-6 text-[9px] md:text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground/50">Ação</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {transactions.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-10 py-24 text-center">
                    <div className="opacity-20 space-y-4">
                      <Activity className="mx-auto" size={48} />
                      <p className="text-xs font-black uppercase tracking-[0.3em]">Nenhum protocolo detectado.</p>
                    </div>
                  </td>
                </tr>
              ) : transactions.map((tx) => (
                <tr key={tx.id} className="hover:bg-white/[0.03] transition-all group">
                  <td className="px-6 md:px-10 py-6 font-mono text-[9px] md:text-[10px] opacity-40 group-hover:opacity-100 transition-opacity tracking-widest uppercase">#{tx.id.slice(0, 8)}...</td>
                  <td className="px-6 md:px-10 py-6">
                    <div className="flex items-center gap-3">
                      {tx.type === 'deposit' ? (
                        <div className="flex items-center gap-2 bg-blue-500/10 text-blue-400 px-2 md:px-3 py-1.5 rounded-xl border border-blue-500/20 text-[8px] md:text-[10px] font-black italic">
                          <ArrowUpCircle size={12} className="md:w-[14px] md:h-[14px]" /> <span className="hidden sm:inline">APORTE</span><span className="sm:hidden">DEP</span>
                        </div>
                      ) : (
                        <div className="flex items-center gap-2 bg-green-500/10 text-green-400 px-2 md:px-3 py-1.5 rounded-xl border border-green-500/20 text-[8px] md:text-[10px] font-black italic">
                          <ArrowDownCircle size={12} className="md:w-[14px] md:h-[14px]" /> <span className="hidden sm:inline">RESGATE</span><span className="sm:hidden">SAQ</span>
                        </div>
                      )}
                    </div>
                  </td>
                  <td className="px-6 md:px-10 py-6 font-bold text-xs md:text-sm hidden md:table-cell">{formatBRL(tx.amount_original as any)}</td>
                  <td className="px-6 md:px-10 py-6 text-[#EAB308] font-black text-xs md:text-sm italic">{formatBRL(tx.amount_net as any)}</td>
                  <td className="px-6 md:px-10 py-6">
                    {tx.status === 'completed' && (
                      <span className="bg-green-500/10 text-green-500 px-2 md:px-4 py-1.5 rounded-xl text-[8px] md:text-[10px] font-black border border-green-500/20 italic tracking-widest uppercase">
                        OK
                      </span>
                    )}
                    {tx.status === 'pending' && (
                      <span className="bg-yellow-500/10 text-yellow-500 px-2 md:px-4 py-1.5 rounded-xl text-[8px] md:text-[10px] font-black border border-yellow-500/20 italic tracking-widest uppercase">
                        PEND
                      </span>
                    )}
                    {(tx.status === 'processing' || tx.status === 'busy') && (
                      <span className="bg-blue-500/10 text-blue-400 px-2 md:px-4 py-1.5 rounded-xl text-[8px] md:text-[8px] font-black border border-blue-500/20 italic tracking-widest animate-pulse uppercase leading-tight text-center flex items-center">
                        Saque em Andamento
                      </span>
                    )}
                    {(tx.status === 'cancelled' || tx.status === 'failed') && (
                      <span className="bg-red-500/10 text-red-500 px-2 md:px-4 py-1.5 rounded-xl text-[8px] md:text-[10px] font-black border border-red-500/20 italic tracking-widest uppercase">
                        FAIL
                      </span>
                    )}
                  </td>
                  <td className="px-10 py-6 text-[10px] text-muted-foreground font-black uppercase tracking-widest hidden lg:table-cell opacity-50">
                    {new Date(tx.created_at).toLocaleString('pt-BR')}
                  </td>
                  <td className="px-6 md:px-10 py-6">
                    {tx.status === 'pending' && tx.type === 'deposit' && (
                      <div className="flex items-center gap-2">
                        <Link href={`/deposit?txId=${tx.id || ''}`}>
                          <button className="bg-primary/10 text-primary hover:bg-primary border border-primary/20 hover:text-black px-3 py-1 rounded-lg text-[8px] font-black transition-all">
                            ABRIR
                          </button>
                        </Link>
                        <button
                          onClick={() => handleManualCheck(tx.external_id || '')}
                          className="bg-white/5 text-muted-foreground hover:bg-white/10 p-1.5 rounded-lg border border-white/10 transition-all"
                          title="Verificar Status"
                        >
                          <RefreshCcw size={12} className={isLoading ? "animate-spin" : ""} />
                        </button>
                      </div>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
