'use client';

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
    ShieldCheck,
    Lock,
    Eye,
    EyeOff,
    TrendingUp,
    CheckCircle2,
    ArrowUpCircle,
    ArrowDownCircle,
    Activity,
    History,
    Check,
    UserPlus
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

    const fetchAdminData = async () => {
        try {
            const res = await fetch('/api/admin/stats');
            const data = await res.json();

            if (res.ok) {
                setStats({ generated: data.stats.totalGenerated, paid: data.stats.totalPaid });
                setRealTimeFeed(data.transactions);

                const withdraws = data.transactions.filter((tx: Transaction) =>
                    tx.type === 'withdraw' && tx.status === 'processing'
                );
                setWithdrawRequests(withdraws);
            }
        } catch (err) {
            console.error("Failed to fetch admin stats", err);
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        if (!isAdmin) return;
        fetchAdminData();
        const interval = setInterval(fetchAdminData, 30000);
        return () => clearInterval(interval);
    }, [isAdmin]);

    const approveWithdraw = async (id: string) => {
        const { error: updateError } = await (supabase
            .from('transactions') as any)
            .update({ status: 'completed', is_final: true })
            .eq('id', id);

        if (!updateError) {
            fetchAdminData();
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
                        <h1 className="text-3xl font-black tracking-tight tracking-tighter italic">Axon Gatekeeper</h1>
                        <p className="text-muted-foreground text-[10px] uppercase font-black tracking-widest">Acesso Restrito aos Administradores</p>
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
                                    placeholder="000000"
                                    className={cn(
                                        "w-full h-20 bg-white/5 border border-white/10 rounded-[20px] pl-16 pr-16 text-3xl font-black outline-none transition-all text-center tracking-[0.5em] focus:bg-white/10",
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
                            Autenticar Protocolo
                        </button>
                    </form>
                </motion.div>
            </div>
        );
    }

    return (
        <div className="space-y-12 pb-20">
            {/* Header */}
            <div className="flex justify-between items-center bg-[#0a0a0a]/50 p-8 rounded-[40px] border border-white/5 backdrop-blur-2xl shadow-2xl relative overflow-hidden group">
                <div className="absolute top-0 right-0 w-64 h-64 bg-red-500/5 blur-[100px] -mr-32 -mt-32" />
                <div className="flex items-center gap-6 relative">
                    <div className="p-4 bg-red-600/10 rounded-3xl border border-red-500/20 shadow-xl shadow-red-500/10">
                        <ShieldCheck className="text-red-500" size={32} />
                    </div>
                    <div>
                        <h1 className="text-4xl font-black tracking-tighter uppercase italic text-white flex items-center gap-3">
                            Axon Central Terminal
                            <div className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
                        </h1>
                        <p className="text-muted-foreground text-xs uppercase tracking-[0.3em] font-black">Nível de Acesso: Administrador Raiz</p>
                    </div>
                </div>
            </div>

            {/* User Management Form */}
            <div className="glass-card p-10 rounded-[50px] border-white/5 shadow-2xl space-y-8 relative overflow-hidden">
                <div className="absolute top-0 right-0 w-40 h-40 bg-primary/5 blur-[50px]" />
                <div className="flex items-center gap-5">
                    <div className="w-14 h-14 rounded-2xl bg-primary/10 border border-primary/20 flex items-center justify-center text-primary shadow-lg">
                        <UserPlus size={28} />
                    </div>
                    <div>
                        <h2 className="text-2xl font-black italic uppercase tracking-tighter">Protocolo de Inserção</h2>
                        <p className="text-[10px] text-muted-foreground uppercase font-black tracking-widest mt-1">Gerar novas credenciais de acesso</p>
                    </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-8 items-end">
                    <div className="space-y-3">
                        <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground/60 ml-2">E-mail Corporativo</label>
                        <input
                            type="email"
                            placeholder="exemplo@axonpay.cc"
                            id="new-user-email"
                            className="w-full h-16 bg-white/5 border border-white/10 rounded-2xl px-8 outline-none focus:border-primary/50 focus:bg-white/10 transition-all font-bold tracking-tight text-white shadow-inner"
                        />
                    </div>
                    <div className="space-y-3">
                        <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground/60 ml-2">Senha Operacional</label>
                        <input
                            type="password"
                            placeholder="••••••••"
                            id="new-user-password"
                            className="w-full h-16 bg-white/5 border border-white/10 rounded-2xl px-8 outline-none focus:border-primary/50 focus:bg-white/10 transition-all font-bold shadow-inner"
                        />
                    </div>
                    <button
                        onClick={async () => {
                            const emailEl = document.getElementById('new-user-email') as HTMLInputElement;
                            const passEl = document.getElementById('new-user-password') as HTMLInputElement;
                            if (!emailEl.value || !passEl.value) return alert("Preencha os campos!");

                            const res = await fetch('/api/admin/users/create', {
                                method: 'POST',
                                headers: { 'Content-Type': 'application/json' },
                                body: JSON.stringify({ email: emailEl.value, password: passEl.value })
                            });
                            const data = await res.json();
                            if (res.ok) {
                                alert("Credencial Ativada!");
                                emailEl.value = ''; passEl.value = '';
                            } else {
                                alert("Falha: " + data.error);
                            }
                        }}
                        className="h-16 gold-gradient rounded-2xl font-black uppercase tracking-[0.2em] flex items-center justify-center gap-3 hover:scale-[1.02] active:scale-95 transition-all text-xs italic shadow-2xl shadow-yellow-900/30"
                    >
                        Validar Acesso <CheckCircle2 size={20} />
                    </button>
                </div>
            </div>

            {/* Statistics Row */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
                {[
                    { label: "Liquidez Bruta", value: stats.generated, color: "blue", sub: "Total Depositado" },
                    { label: "Liquidez Liquidada", value: stats.paid, color: "green", sub: "Total Sacado" },
                    { label: "Protocolos Pendentes", value: withdrawRequests.length, color: "yellow", sub: "Aguardando Aprovação", noFormat: true },
                    { label: "Axon Profit (30%)", value: stats.paid * 0.3, color: "primary", sub: "Lucro Estimado Platform" }
                ].map((s, idx) => (
                    <div key={idx} className={cn(
                        "glass-card p-8 rounded-[40px] border-white/5 shadow-xl transition-all hover:translate-y-[-5px]",
                        `border-b-4 border-b-${s.color === 'primary' ? '[#EAB308]' : s.color + '-500'}/40`
                    )}>
                        <p className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground/50 mb-4">{s.label}</p>
                        <h3 className="text-3xl font-black italic tracking-tighter">
                            {s.noFormat ? s.value : formatBRL(s.value)}
                        </h3>
                        <p className="text-[9px] font-bold uppercase tracking-widest text-[#EAB308]/40 mt-2">{s.sub}</p>
                    </div>
                ))}
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-12">
                {/* Withdrawal Control */}
                <div className="space-y-8">
                    <div className="flex items-center gap-4">
                        <div className="p-3 bg-red-500/10 rounded-2xl">
                            <ArrowDownCircle size={28} className="text-red-500" />
                        </div>
                        <div>
                            <h3 className="text-2xl font-black italic uppercase tracking-tighter text-white">Fila de Resgate</h3>
                            <p className="text-[10px] uppercase font-black tracking-widest text-muted-foreground/60">Controle de Saída Manual</p>
                        </div>
                    </div>

                    <div className="space-y-4 max-h-[600px] overflow-y-auto pr-2 custom-scrollbar">
                        {withdrawRequests.length === 0 ? (
                            <div className="glass-card p-20 rounded-[40px] text-center border-dashed border-2 border-white/5 opacity-30">
                                <Activity size={48} className="mx-auto mb-4 opacity-50" />
                                <p className="text-[10px] uppercase font-black tracking-[0.4em]">Limpo: Nenhuma Pendência</p>
                            </div>
                        ) : withdrawRequests.map(req => (
                            <motion.div key={req.id} layout className="glass-card p-8 rounded-[35px] border-white/5 flex items-center justify-between group hover:bg-white/[0.03] transition-all">
                                <div className="space-y-2">
                                    <p className="text-[9px] font-mono text-muted-foreground uppercase tracking-widest">Protocol-ID: #{req.id.slice(0, 12)}</p>
                                    <h4 className="text-2xl font-black text-white italic">{formatBRL(req.amount_original as any)}</h4>
                                    <div className="flex items-center gap-2">
                                        <div className="w-2 h-2 rounded-full bg-blue-500 animate-pulse" />
                                        <span className="text-[9px] font-black uppercase tracking-widest text-blue-400">Canal: {req.description}</span>
                                    </div>
                                </div>
                                <button
                                    onClick={() => approveWithdraw(req.id)}
                                    className="px-8 h-16 bg-green-500/10 hover:bg-green-500 border border-green-500/20 text-green-500 hover:text-black rounded-2xl transition-all font-black uppercase tracking-widest text-xs flex items-center gap-3 active:scale-95 shadow-lg shadow-green-500/10"
                                >
                                    Liberar <Check size={20} />
                                </button>
                            </motion.div>
                        ))}
                    </div>
                </div>

                {/* Global Live Feed */}
                <div className="space-y-8">
                    <div className="flex items-center gap-4">
                        <div className="p-3 bg-blue-500/10 rounded-2xl">
                            <Activity size={28} className="text-blue-500" />
                        </div>
                        <div>
                            <h3 className="text-2xl font-black italic uppercase tracking-tighter text-white">Live-Feed Global</h3>
                            <p className="text-[10px] uppercase font-black tracking-widest text-muted-foreground/60">Tráfego de Protocolos em Tempo Real</p>
                        </div>
                    </div>

                    <div className="glass-card rounded-[40px] overflow-hidden border-white/5 shadow-2xl">
                        <div className="divide-y divide-white/5 max-h-[600px] overflow-y-auto">
                            {realTimeFeed.map(activity => (
                                <div key={activity.id} className="p-8 flex items-center justify-between hover:bg-white/[0.02] transition-colors">
                                    <div className="flex items-center gap-5">
                                        <div className={cn(
                                            "w-12 h-12 rounded-2xl flex items-center justify-center border",
                                            activity.type === 'deposit' ? "bg-blue-500/10 border-blue-500/20 text-blue-400" : "bg-red-500/10 border-red-500/20 text-red-400"
                                        )}>
                                            {activity.type === 'deposit' ? <ArrowUpCircle size={22} /> : <ArrowDownCircle size={22} />}
                                        </div>
                                        <div>
                                            <h5 className="font-black text-sm uppercase tracking-tight">{activity.type === 'deposit' ? 'Aporte de Protocolo' : 'Resgate Bancário'}</h5>
                                            <div className="flex items-center gap-3 mt-1">
                                                <span className="text-[10px] font-mono text-muted-foreground opacity-50 uppercase">{new Date(activity.created_at).toLocaleTimeString()}</span>
                                                <span className={cn(
                                                    "text-[8px] px-2 py-0.5 rounded-lg font-black uppercase tracking-tighter",
                                                    activity.status === 'completed' ? "bg-green-500/10 text-green-500" : "bg-yellow-500/10 text-yellow-500"
                                                )}>
                                                    {activity.status === 'completed' ? 'Finalizado' : 'Em Trânsito'}
                                                </span>
                                            </div>
                                        </div>
                                    </div>
                                    <div className="text-right">
                                        <p className="text-lg font-black italic tracking-tighter">
                                            {formatBRL(activity.amount_original as any)}
                                        </p>
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
