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
  QrCode
} from 'lucide-react';
import { cn, formatBRL } from '@/lib/utils';
import Link from 'next/link';
import { supabase } from '@/lib/supabase';
import { Transaction } from '@/types';

export default function Dashboard() {
  const [balance, setBalance] = useState(0);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Simulated fetching for the layout preview
  useEffect(() => {
    async function fetchData() {
      // Fetch balance from profiles
      const { data: profile } = await supabase
        .from('profiles')
        .select('balance')
        .single();

      if (profile) setBalance(profile.balance);

      // Fetch recent transactions
      const { data: txs } = await supabase
        .from('transactions')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(10);

      if (txs) setTransactions(txs);

      setIsLoading(false);
    }

    fetchData();
  }, []);

  return (
    <div className="space-y-10 pb-20">
      {/* Welcome Header */}
      <div className="flex justify-between items-end">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Dashboard</h1>
          <p className="text-muted-foreground mt-1 text-lg">Seja bem-vindo de volta, AxonPay.</p>
        </div>
        <div className="text-right">
          <p className="text-xs text-muted-foreground uppercase tracking-widest mb-1">Status da Rede</p>
          <div className="flex items-center gap-2 text-green-400">
            <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
            <span className="text-sm font-medium">PIX Instantâneo Ativo</span>
          </div>
        </div>
      </div>

      {/* Hero Balance Card */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="lg:col-span-2 relative h-64 rounded-3xl overflow-hidden glass-card group"
        >
          {/* Background effects */}
          <div className="absolute top-0 right-0 w-96 h-96 bg-primary/10 rounded-full blur-[100px] -mr-32 -mt-32 transition-all group-hover:bg-primary/20" />
          <div className="absolute bottom-0 left-0 w-64 h-64 bg-blue-500/5 rounded-full blur-[80px] -ml-20 -mb-20" />

          <div className="relative h-full p-10 flex flex-col justify-between">
            <div className="flex justify-between items-start">
              <div>
                <p className="text-sm uppercase tracking-widest text-white/60 mb-2">Saldo Disponível</p>
                <h2 className="text-5xl font-black text-white tracking-tighter">
                  {formatBRL(balance)}
                </h2>
              </div>
              <div className="p-3 bg-white/5 rounded-2xl border border-white/10 group-hover:scale-110 group-hover:bg-white/10 transition-all">
                <Wallet className="text-primary" size={32} />
              </div>
            </div>

            <div className="flex gap-4">
              <Link href="/deposit" className="flex-1">
                <button className="w-full flex items-center justify-center gap-2 h-14 gold-gradient rounded-2xl font-bold uppercase tracking-wider hover:opacity-90 transition-all hover:scale-[1.02] active:scale-100 shadow-xl shadow-yellow-600/20">
                  <ArrowUpCircle size={22} />
                  Depositar
                </button>
              </Link>
              <Link href="/withdraw" className="flex-1">
                <button className="w-full h-14 bg-white/10 border border-white/10 text-white rounded-2xl font-bold uppercase tracking-wider hover:bg-white/15 transition-all hover:scale-[1.02] active:scale-100">
                  <ArrowDownCircle size={22} className="mr-2" />
                  Sacar
                </button>
              </Link>
            </div>
          </div>
        </motion.div>

        {/* Mini Stats Card */}
        <div className="space-y-6">
          <div className="glass-card p-6 rounded-3xl flex items-center gap-4">
            <div className="w-12 h-12 rounded-2xl bg-green-500/10 border border-green-500/20 flex items-center justify-center text-green-400">
              <TrendingUp size={24} />
            </div>
            <div>
              <p className="text-xs text-muted-foreground uppercase opacity-70">Taxa de Conversão</p>
              <h3 className="text-xl font-bold">100% Sucesso</h3>
            </div>
          </div>

          <div className="glass-card p-6 rounded-3xl flex items-center gap-4">
            <div className="w-12 h-12 rounded-2xl bg-primary/10 border border-primary/20 flex items-center justify-center text-primary">
              <QrCode size={24} />
            </div>
            <div>
              <p className="text-xs text-muted-foreground uppercase opacity-70">Tempo Médio PIX</p>
              <h3 className="text-xl font-bold">12 Segundos</h3>
            </div>
          </div>

          <div className="glass-card p-6 rounded-3xl flex items-center gap-4">
            <div className="w-12 h-12 rounded-2xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center text-blue-400">
              <History size={24} />
            </div>
            <div>
              <p className="text-xs text-muted-foreground uppercase opacity-70">Status Rede</p>
              <h3 className="text-xl font-bold">Operacional</h3>
            </div>
          </div>
        </div>
      </div>

      {/* Transaction Table */}
      <div className="glass-card rounded-3xl overflow-hidden border-white/5">
        <div className="p-8 border-b border-white/5 flex justify-between items-center">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-white/5 rounded-lg border border-white/10">
              <History size={20} className="text-muted-foreground" />
            </div>
            <h2 className="text-xl font-bold">Últimas Atividades</h2>
          </div>
          <button className="text-sm font-medium text-primary hover:underline transition-all">
            Ver Todas
          </button>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="border-b border-white/5 bg-white/[0.02]">
                <th className="px-8 py-5 text-xs font-semibold uppercase tracking-widest text-muted-foreground">ID Transação</th>
                <th className="px-8 py-5 text-xs font-semibold uppercase tracking-widest text-muted-foreground">Tipo</th>
                <th className="px-8 py-5 text-xs font-semibold uppercase tracking-widest text-muted-foreground">Valor Bruto</th>
                <th className="px-8 py-5 text-xs font-semibold uppercase tracking-widest text-muted-foreground">Valor Líquido</th>
                <th className="px-8 py-5 text-xs font-semibold uppercase tracking-widest text-muted-foreground">Status</th>
                <th className="px-8 py-5 text-xs font-semibold uppercase tracking-widest text-muted-foreground">Data</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {isLoading ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <tr key={i} className="animate-pulse">
                    <td colSpan={6} className="px-8 py-6 h-16 bg-white/5 bg-opacity-20" />
                  </tr>
                ))
              ) : transactions.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-8 py-20 text-center text-muted-foreground">
                    Nenhuma transação encontrada.
                  </td>
                </tr>
              ) : transactions.map((tx) => (
                <tr key={tx.id} className="hover:bg-white/[0.02] transition-colors">
                  <td className="px-8 py-5 font-mono text-xs opacity-60">#{tx.id.slice(0, 8)}...</td>
                  <td className="px-8 py-5">
                    <div className="flex items-center gap-2">
                      {tx.type === 'deposit' ? (
                        <span className="flex items-center gap-1.5 text-blue-400 text-sm font-medium">
                          <ArrowUpCircle size={14} /> DEPÓSITO
                        </span>
                      ) : (
                        <span className="flex items-center gap-1.5 text-red-400 text-sm font-medium">
                          <ArrowDownCircle size={14} /> SAQUE
                        </span>
                      )}
                    </div>
                  </td>
                  <td className="px-8 py-5 font-bold">{formatBRL(tx.amount_original)}</td>
                  <td className="px-8 py-5 text-[#EAB308] font-bold">{formatBRL(tx.amount_net)}</td>
                  <td className="px-8 py-5">
                    {tx.status === 'completed' && (
                      <span className="bg-green-500/10 text-green-400 px-3 py-1 rounded-full text-xs font-bold border border-green-500/20">
                        CONCLUÍDO
                      </span>
                    )}
                    {tx.status === 'pending' && (
                      <span className="bg-yellow-500/10 text-yellow-400 px-3 py-1 rounded-full text-xs font-bold border border-yellow-500/20">
                        PENDENTE
                      </span>
                    )}
                    {tx.status === 'processing' && (
                      <span className="bg-blue-500/10 text-blue-400 px-3 py-1 rounded-full text-xs font-bold border border-blue-500/20">
                        EM PROCESSAMENTO
                      </span>
                    )}
                    {tx.status === 'cancelled' && (
                      <span className="bg-red-500/10 text-red-400 px-3 py-1 rounded-full text-xs font-bold border border-red-500/20">
                        CANCELADO
                      </span>
                    )}
                  </td>
                  <td className="px-8 py-5 text-sm text-muted-foreground">
                    {new Date(tx.created_at).toLocaleString('pt-BR')}
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
