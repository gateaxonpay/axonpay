'use client';

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
    ShieldCheck,
    Lock,
    Eye,
    EyeOff,
    TrendingUp,
    TrendingDown,
    CheckCircle2,
    ArrowUpCircle,
    ArrowDownCircle,
    RefreshCcw,
    Activity,
    History,
    Check,
    Search
} from 'lucide-react';
import { cn, formatBRL } from '@/lib/utils';
import { supabase } from '@/lib/supabase';
import { Transaction } from '@/types';

export default function AdminPage() {
    const [isAdmin, setIsAdmin] = useState(false);
    const [pin, setPin] = useState('');
    const [error, setError] = useState(false);
    const [showPin, setShowPin] = useState(false);

    const [stats, setStats] = useState({ generated: 0, paid: 0 });
    const [withdrawRequests, setWithdrawRequests] = useState<Transaction[]>([]);
    const [realTimeFeed, setRealTimeFeed] = useState<Transaction[]>([]);
    const [isLoading, setIsLoading] = useState(true);

    const correctPin = '171033';

    const handleLogin = (e: React.FormEvent) => {
        e.preventDefault();
        if (pin === correctPin) {
            setIsAdmin(true);
            setError(false);
        } else {
            setError(true);
            setPin('');
            setTimeout(() => setError(false), 2000);
        }
    };

    useEffect(() => {
        if (!isAdmin) return;

        async function fetchAdminData() {
            // 1. Fetch Stats
            const { data: allTxs } = await supabase.from('transactions').select('*');
            if (allTxs) {
                const generated = allTxs.filter(t => t.type === 'deposit').reduce((sum, t) => sum + Number(t.amount_original), 0);
                const paid = allTxs.filter(t => t.type === 'deposit' && t.status === 'completed').reduce((sum, t) => sum + Number(t.amount_original), 0);
                setStats({ generated, paid });
            }

            // 2. Fetch Withdraw Requests
            const { data: withdraws } = await supabase
                .from('transactions')
                .select('*')
                .eq('type', 'withdraw')
                .eq('status', 'processing')
                .order('created_at', { ascending: false });

            if (withdraws) setWithdrawRequests(withdraws);

            // 3. Fetch Real-time Feed (recent activities)
            const { data: feed } = await supabase
                .from('transactions')
                .select('*')
                .order('created_at', { ascending: false })
                .limit(20);

            if (feed) setRealTimeFeed(feed);

            setIsLoading(false);
        }

        fetchAdminData();
    }, [isAdmin]);

    const approveWithdraw = async (id: string) => {
        const { error: updateError } = await supabase
            .from('transactions')
            .update({ status: 'completed', is_final: true })
            .eq('id', id);

        if (!updateError) {
            setWithdrawRequests(prev => prev.filter(req => req.id !== id));
            // Add toast or notification here
        }
    };

    if (!isAdmin) {
        return (
            <div className="h-[70vh] flex flex-col items-center justify-center p-6">
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="glass-card p-10 rounded-[40px] w-full max-w-md space-y-8 flex flex-col items-center border-white/5"
                >
                    <div className="w-24 h-24 rounded-3xl bg-[#EAB308]/10 border-2 border-[#EAB308]/20 flex items-center justify-center text-[#EAB308] shadow-2xl shadow-yellow-500/10">
                        <ShieldCheck size={48} />
                    </div>

                    <div className="text-center space-y-2">
                        <h1 className="text-3xl font-black tracking-tight">Gatekeeper</h1>
                        <p className="text-muted-foreground">Área Restrita aos Administradores AxonPay.</p>
                    </div>

                    <form onSubmit={handleLogin} className="w-full space-y-6">
                        <div className="space-y-4">
                            <label className="text-xs font-bold uppercase tracking-[0.3em] text-muted-foreground/50 ml-2">Acesso por PIN</label>
                            <div className="relative group">
                                <div className="absolute left-6 top-1/2 -translate-y-1/2 text-muted-foreground group-focus-within:text-[#EAB308] transition-colors">
                                    <Lock size={20} />
                                </div>
                                <input
                                    type={showPin ? "text" : "password"}
                                    maxLength={6}
                                    value={pin}
                                    onChange={(e) => setPin(e.target.value)}
                                    placeholder="000 000"
                                    className={cn(
                                        "w-full h-20 bg-white/5 border border-white/10 rounded-[20px] pl-16 pr-16 text-3xl font-black outline-none transition-all text-center tracking-[1em] focus:bg-white/10",
                                        error ? "border-red-500 animate-shake" : "focus:border-[#EAB308]/50"
                                    )}
                                />
                                <button
                                    type="button"
                                    onClick={() => setShowPin(!showPin)}
                                    className="absolute right-6 top-1/2 -translate-y-1/2 p-2 text-muted-foreground hover:text-white transition-all"
                                >
                                    {showPin ? <EyeOff size={20} /> : <Eye size={20} />}
                                </button>
                            </div>
                        </div>

                        <button
                            type="submit"
                            className="w-full h-16 gold-gradient rounded-2xl font-black uppercase tracking-widest flex items-center justify-center gap-3 hover:scale-[1.02] active:scale-100 transition-all shadow-xl shadow-yellow-900/20"
                        >
                            Autenticar
                            <CheckCircle2 size={24} />
                        </button>
                    </form>

                    <p className="text-[10px] text-muted-foreground underline opacity-30 cursor-pointer uppercase font-bold tracking-[0.2em] hover:opacity-100 transition-all">
                        Protocolo de Segurança Ativo
                    </p>
                </motion.div>
            </div>
        );
    }

    return (
        <div className="space-y-10 pb-20">
            <div className="flex justify-between items-center bg-[#0a0a0a]/50 p-6 rounded-3xl border border-white/5 backdrop-blur-xl">
                <div className="flex items-center gap-4">
                    <div className="p-3 bg-red-600/20 rounded-2xl border border-red-600/30">
                        <ShieldCheck className="text-red-500" size={28} />
                    </div>
                    <div>
                        <h1 className="text-3xl font-black tracking-tight">Painel de Controle</h1>
                        <p className="text-muted-foreground">Monitoramento em Tempo Real de Transações.</p>
                    </div>
                </div>
                <div className="flex gap-4">
                    <div className="flex flex-col text-right">
                        <span className="text-[10px] font-black text-muted-foreground uppercase">Servidor</span>
                        <span className="text-green-500 font-bold flex items-center gap-1.5 justify-end">
                            <Activity size={14} className="animate-pulse" /> ONLINE
                        </span>
                    </div>
                </div>
            </div>

            {/* Stats Overview */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                <div className="glass-card p-8 rounded-3xl border-l-4 border-l-blue-500/50">
                    <p className="text-xs font-bold text-muted-foreground uppercase opacity-60 mb-2">Total Gerado (Depositos)</p>
                    <div className="flex justify-between items-end">
                        <h2 className="text-3xl font-black">{formatBRL(stats.generated)}</h2>
                        <div className="text-blue-500 flex items-center gap-1 bg-blue-500/10 px-2 py-1 rounded-lg text-xs font-bold">
                            <TrendingUp size={14} /> 100%
                        </div>
                    </div>
                </div>

                <div className="glass-card p-8 rounded-3xl border-l-4 border-l-green-500/50">
                    <p className="text-xs font-bold text-muted-foreground uppercase opacity-60 mb-2">Total Pago (PIX)</p>
                    <div className="flex justify-between items-end">
                        <h2 className="text-3xl font-black">{formatBRL(stats.paid)}</h2>
                        <div className="text-green-500 flex items-center gap-1 bg-green-500/10 px-2 py-1 rounded-lg text-xs font-bold">
                            <TrendingUp size={14} /> {stats.generated > 0 ? Math.round((stats.paid / stats.generated) * 100) : 0}%
                        </div>
                    </div>
                </div>

                <div className="glass-card p-8 rounded-3xl border-l-4 border-l-yellow-500/50">
                    <p className="text-xs font-bold text-muted-foreground uppercase opacity-60 mb-2">Pedidos de Saque</p>
                    <div className="flex justify-between items-end">
                        <h2 className="text-3xl font-black">{withdrawRequests.length}</h2>
                        <div className="text-yellow-500 flex items-center gap-1 bg-yellow-500/10 px-2 py-1 rounded-lg text-xs font-bold uppercase">
                            <History size={14} /> Urgentes
                        </div>
                    </div>
                </div>

                <div className="glass-card p-8 rounded-3xl border-l-4 border-l-[#EAB308]">
                    <p className="text-xs font-bold text-muted-foreground uppercase opacity-60 mb-2">Taxa Plataforma (30%)</p>
                    <div className="flex justify-between items-end">
                        <h2 className="text-3xl font-black text-[#EAB308]">{formatBRL(stats.paid * 0.3)}</h2>
                        <div className="text-[#EAB308] flex items-center gap-1 bg-primary/10 px-2 py-1 rounded-lg text-xs font-bold uppercase">
                            Profit
                        </div>
                    </div>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-10">
                {/* Withdraw Requests */}
                <div className="space-y-6">
                    <div className="flex items-center gap-3">
                        <ArrowDownCircle size={24} className="text-red-400" />
                        <h3 className="text-xl font-bold">Requisições de Saque</h3>
                        <span className="bg-red-500/20 text-red-500 px-3 py-1 rounded-full text-[10px] font-black">PENDENTE APROVAÇÃO</span>
                    </div>

                    <div className="space-y-4 max-h-[600px] overflow-y-auto pr-2 custom-scrollbar">
                        {isLoading ? <div className="animate-pulse h-40 bg-white/5 rounded-3xl" /> :
                            withdrawRequests.length === 0 ? (
                                <div className="glass-card p-12 rounded-3xl text-center opacity-40">Tudo limpo! Sem saques pendentes.</div>
                            ) :
                                withdrawRequests.map(req => (
                                    <motion.div
                                        layout
                                        key={req.id}
                                        className="glass-card p-6 rounded-3xl border border-white/5 hover:border-red-500/20 transition-all flex items-center justify-between group"
                                    >
                                        <div className="flex items-center gap-4">
                                            <div className="w-12 h-12 rounded-2xl bg-white/5 flex items-center justify-center text-muted-foreground group-hover:bg-red-500/10 group-hover:text-red-500 transition-all">
                                                <Activity size={24} />
                                            </div>
                                            <div>
                                                <p className="text-xs text-muted-foreground font-mono">#{req.id.slice(0, 8)}</p>
                                                <h4 className="font-black text-xl">{formatBRL(req.amount_original)}</h4>
                                                <p className="text-xs text-white/50 truncate w-40 font-mono">PIX: {req.pix_copia_e_cola || 'User ID Key'}</p>
                                            </div>
                                        </div>
                                        <button
                                            onClick={() => approveWithdraw(req.id)}
                                            className="p-4 bg-green-500/10 border border-green-500/20 rounded-2xl text-green-500 hover:bg-green-500 hover:text-black transition-all shadow-lg hover:shadow-green-500/20 flex gap-2 font-bold items-center"
                                        >
                                            <Check size={20} />
                                            <span>APROVAR</span>
                                        </button>
                                    </motion.div>
                                ))}
                    </div>
                </div>

                {/* Real-time platform feed */}
                <div className="space-y-6">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                            <Activity size={24} className="text-blue-400" />
                            <h3 className="text-xl font-bold">Fluxo Global PIX</h3>
                        </div>
                        <div className="text-[10px] bg-blue-500/10 text-blue-400 px-3 py-1 rounded-full font-black tracking-widest uppercase animate-pulse">Live Feed</div>
                    </div>

                    <div className="glass-card rounded-3xl overflow-hidden border-white/5">
                        <div className="p-4 bg-white/5 flex gap-4 overflow-x-auto whitespace-nowrap scrollbar-hide">
                            <button className="px-4 py-2 bg-primary text-black rounded-xl text-xs font-black uppercase tracking-widest">Tudo</button>
                            <button className="px-4 py-2 bg-white/5 hover:bg-white/10 rounded-xl text-xs font-bold uppercase tracking-widest text-muted-foreground">Depósitos</button>
                            <button className="px-4 py-2 bg-white/5 hover:bg-white/10 rounded-xl text-xs font-bold uppercase tracking-widest text-muted-foreground">Saques</button>
                        </div>

                        <div className="divide-y divide-white/5 max-h-[500px] overflow-y-auto">
                            {realTimeFeed.map(activity => (
                                <div key={activity.id} className="p-6 flex items-center justify-between hover:bg-white/[0.02] transition-all">
                                    <div className="flex items-center gap-4">
                                        {activity.type === 'deposit' ? (
                                            <ArrowUpCircle className="text-blue-400" size={20} />
                                        ) : (
                                            <ArrowDownCircle className="text-red-400" size={20} />
                                        )}
                                        <div>
                                            <div className="flex items-center gap-2">
                                                <span className="font-bold text-sm tracking-tight">{activity.type === 'deposit' ? 'Depósito PIX' : 'Saque Efetuado'}</span>
                                                <span className={cn(
                                                    "text-[10px] px-2 py-0.5 rounded-full font-black",
                                                    activity.status === 'completed' ? "bg-green-500/10 text-green-500" : "bg-yellow-500/10 text-yellow-500"
                                                )}>
                                                    {activity.status.toUpperCase()}
                                                </span>
                                            </div>
                                            <p className="text-[10px] text-muted-foreground font-mono mt-0.5 opacity-50">{new Date(activity.created_at).toLocaleString()}</p>
                                        </div>
                                    </div>
                                    <div className="text-right">
                                        <p className="font-black">{formatBRL(activity.amount_original)}</p>
                                        <p className="text-[10px] text-[#EAB308] font-bold">AxonPay Protocol</p>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
