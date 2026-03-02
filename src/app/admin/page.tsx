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
    Check,
    UserPlus,
    Users,
    ChevronRight,
    Settings,
    Database,
    Search,
    Wallet,
    Trash2,
    AlertTriangle
} from 'lucide-react';
import { cn, formatBRL } from '@/lib/utils';
import { supabase } from '@/lib/supabase';
import { Transaction } from '@/types';

interface UserMetric {
    id: string;
    email: string;
    full_name: string;
    balance: number;
    totalGenerated: number;
    totalPaid: number;
    totalWithdrawn: number;
    txCount: number;
}

export default function AdminPage() {
    const [isAdmin, setIsAdmin] = useState(false);
    const [pin, setPin] = useState('');
    const [error, setError] = useState(false);
    const [showPin, setShowPin] = useState(false);

    const [activeTab, setActiveTab] = useState<'overview' | 'users' | 'settings'>('overview');
    const [stats, setStats] = useState({ generated: 0, paid: 0 });
    const [withdrawRequests, setWithdrawRequests] = useState<Transaction[]>([]);
    const [realTimeFeed, setRealTimeFeed] = useState<Transaction[]>([]);
    const [userMetrics, setUserMetrics] = useState<UserMetric[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [mycashApiKey, setMycashApiKey] = useState('');
    const [isUserModalOpen, setIsUserModalOpen] = useState(false);
    const [isCreatingUser, setIsCreatingUser] = useState(false);
    const [modalError, setModalError] = useState<string | null>(null);
    const [settingsStatus, setSettingsStatus] = useState<{ type: 'success' | 'error', message: string } | null>(null);
    const [showUserPassword, setShowUserPassword] = useState(false);

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
        setIsLoading(true);
        try {
            const res = await fetch(`/api/admin/stats?t=${Date.now()}`, {
                cache: 'no-store',
                headers: { 'Cache-Control': 'no-cache' }
            });
            const data = await res.json();

            if (res.ok) {
                setStats({ generated: data.stats.totalGenerated, paid: data.stats.totalPaid });

                // Filter out cancelled transactions and limit feed
                const filteredFeed = (data.transactions || []).filter((tx: any) => tx.status !== 'cancelled');
                setRealTimeFeed(filteredFeed);

                setUserMetrics(data.userMetrics || []);

                const withdraws = (data.transactions || []).filter((tx: Transaction) =>
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

    const fetchSettings = async () => {
        try {
            const res = await fetch('/api/admin/settings');
            const data = await res.json();
            if (res.ok && data.settings) {
                const apiKeyItem = data.settings.find((s: any) => s.key === 'MYCASH_API_KEY');
                if (apiKeyItem) setMycashApiKey(apiKeyItem.value);
            }
        } catch (err) {
            console.error("Failed to fetch settings", err);
        }
    };

    useEffect(() => {
        if (!isAdmin) return;
        fetchAdminData();
        fetchSettings();
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

    const handleDeleteUser = async (userId: string, email: string) => {
        if (!confirm(`TEM CERTEZA? Isso excluirá o operador ${email} e TODOS os dados financeiros associados (transações, histórico, saldo). Esta ação não pode ser desfeita.`)) {
            return;
        }

        try {
            setIsLoading(true);
            const res = await fetch('/api/admin/users/delete', {
                method: 'DELETE',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ userId })
            });
            const data = await res.json();

            if (res.ok) {
                alert("Operador e dados financeiros excluídos com sucesso.");
                await fetchAdminData();
            } else {
                alert("ERRO ao excluir: " + (data.error || "Tente novamente mais tarde."));
            }
        } catch (err) {
            alert("Erro crítico ao tentar excluir o usuário.");
        } finally {
            setIsLoading(false);
        }
    };

    const handleResetSystem = async () => {
        if (!confirm("⚠️ ATENÇÃO: Isso apagará TODAS as transações e zerará o saldo de TODOS os operadores. Esta ação é irreversível. CONFIRMAR RESET?")) {
            return;
        }

        try {
            setIsLoading(true);
            const res = await fetch('/api/admin/reset-data', { method: 'POST' });
            const data = await res.json();
            if (res.ok) {
                alert("SISTEMA RESETADO COM SUCESSO!");
                await fetchAdminData();
            } else {
                alert("ERRO: " + data.error);
            }
        } catch (err) {
            alert("Falha crítica ao resetar.");
        } finally {
            setIsLoading(false);
        }
    };

    const filteredUsers = userMetrics.filter(u =>
        u.email?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (u.full_name || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
        u.id.toLowerCase().includes(searchTerm.toLowerCase())
    );

    if (!isAdmin) {
        return (
            <div className="h-screen bg-[#060606] flex flex-col items-center justify-center p-6 overflow-hidden">
                <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(234,179,8,0.03)_0%,transparent_70%)]" />
                <motion.div
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    className="glass-card p-12 rounded-[50px] w-full max-w-lg space-y-10 flex flex-col items-center border-white/5 shadow-2xl relative z-10"
                >
                    <div className="w-28 h-28 rounded-[35px] bg-[#EAB308]/5 border-2 border-[#EAB308]/20 flex items-center justify-center text-[#EAB308] shadow-[0_20px_50px_rgba(234,179,8,0.15)] relative overflow-hidden group">
                        <div className="absolute inset-0 bg-gradient-to-tr from-transparent via-[#EAB308]/10 to-transparent translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-1000" />
                        <ShieldCheck size={56} className="relative z-10" />
                    </div>
                    <div className="text-center space-y-3">
                        <h1 className="text-4xl font-black tracking-tighter italic text-white">AxionPay</h1>
                        <p className="text-[10px] text-[#EAB308] font-black uppercase tracking-[0.5em] opacity-80">Protocolo de Segurança Nível 5</p>
                    </div>
                    <form onSubmit={handleLogin} className="w-full space-y-8">
                        <div className="space-y-4">
                            <label className="text-[11px] font-black uppercase tracking-[0.4em] text-muted-foreground/40 ml-4">Codificação de Acesso (PIN)</label>
                            <div className="relative group">
                                <div className="absolute left-8 top-1/2 -translate-y-1/2 text-muted-foreground group-focus-within:text-[#EAB308] transition-colors">
                                    <Lock size={22} />
                                </div>
                                <input
                                    type={showPin ? "text" : "password"}
                                    maxLength={6}
                                    value={pin}
                                    onChange={(e) => setPin(e.target.value)}
                                    placeholder="••••••"
                                    className={cn(
                                        "w-full h-24 bg-white/[0.03] border border-white/10 rounded-[30px] pl-20 pr-20 text-4xl font-black outline-none transition-all text-center tracking-[0.6em] focus:bg-white/5",
                                        error ? "border-red-500 animate-shake" : "focus:border-[#EAB308]/40"
                                    )}
                                />
                                <button
                                    type="button"
                                    onClick={() => setShowPin(!showPin)}
                                    className="absolute right-8 top-1/2 -translate-y-1/2 p-2 text-muted-foreground hover:text-white transition-all"
                                >
                                    {showPin ? <EyeOff size={22} /> : <Eye size={22} />}
                                </button>
                            </div>
                        </div>
                        <button
                            type="submit"
                            className="w-full h-20 gold-gradient rounded-[25px] font-black uppercase tracking-[0.3em] flex items-center justify-center gap-4 hover:scale-[1.02] active:scale-95 transition-all shadow-[0_20px_40px_rgba(234,179,8,0.2)]"
                        >
                            Validar Protocolo <ChevronRight size={24} />
                        </button>
                    </form>
                </motion.div>
            </div>
        );
    }

    return (
        <div className="space-y-12 pb-20">
            {/* Super Admin Header */}
            <div className="flex justify-between items-center bg-[#0a0a0a]/50 p-10 rounded-[50px] border border-white/5 backdrop-blur-3xl shadow-3xl relative overflow-hidden">
                <div className="absolute top-0 left-0 w-96 h-96 bg-red-600/5 blur-[120px] -ml-40 -mt-40" />
                <div className="flex items-center gap-8 relative z-10">
                    <div className="p-5 bg-red-600/10 rounded-3xl border border-red-500/20 shadow-2xl shadow-red-500/10">
                        <ShieldCheck className="text-red-500" size={36} />
                    </div>
                    <div>
                        <h1 className="text-4xl font-black tracking-tighter uppercase italic text-white flex items-center gap-4">
                            Axion Central
                            <div className="w-2.5 h-2.5 rounded-full bg-red-500 animate-pulse shadow-[0_0_15px_rgba(239,68,68,0.5)]" />
                        </h1>
                        <div className="flex items-center gap-4 mt-1">
                            <p className="text-muted-foreground text-[10px] uppercase tracking-[0.4em] font-black">Raiz do Sistema</p>
                            <div className="h-4 w-px bg-white/10" />
                            <p className="text-[#EAB308] text-[10px] uppercase tracking-[0.4em] font-black italic">V.3.1 - Alpha 2026</p>
                        </div>
                    </div>
                </div>
                <div className="flex items-center gap-4 relative z-10">
                    <div className="flex bg-white/5 p-2 rounded-2xl border border-white/5">
                        <button
                            onClick={() => setActiveTab('overview')}
                            className={cn(
                                "px-6 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all",
                                activeTab === 'overview' ? "bg-white/10 text-white shadow-lg" : "text-muted-foreground hover:text-white"
                            )}
                        >
                            Overview
                        </button>
                        <button
                            onClick={() => setActiveTab('users')}
                            className={cn(
                                "px-6 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all",
                                activeTab === 'users' ? "bg-white/10 text-white shadow-lg" : "text-muted-foreground hover:text-white"
                            )}
                        >
                            Usuários
                        </button>
                        <button
                            onClick={() => setActiveTab('settings')}
                            className={cn(
                                "px-6 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all",
                                activeTab === 'settings' ? "bg-white/10 text-white shadow-lg" : "text-muted-foreground hover:text-white"
                            )}
                        >
                            Configurações
                        </button>
                    </div>
                    <button
                        onClick={() => setIsAdmin(false)}
                        className="px-6 py-4 bg-red-600/10 hover:bg-red-600 border border-red-600/20 text-red-500 hover:text-white rounded-[20px] transition-all font-black uppercase tracking-[0.2em] text-[10px] italic shadow-xl shadow-red-900/10"
                    >
                        LOCK
                    </button>
                </div>
            </div>

            <AnimatePresence mode="wait">
                {activeTab === 'overview' ? (
                    <motion.div
                        key="overview"
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -20 }}
                        className="space-y-12"
                    >
                        {/* Top Metrics Row */}
                        <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
                            {[
                                {
                                    label: "Protocolar Operador",
                                    value: userMetrics.length,
                                    color: "yellow",
                                    sub: "Gestão Ativa",
                                    noFormat: true,
                                    action: () => setIsUserModalOpen(true),
                                    buttonLabel: "ADICIONAR",
                                    icon: <UserPlus size={18} />
                                },
                                { label: "Liquidez Total", value: stats.generated, color: "blue", sub: "Fluxo de Entrada" },
                                { label: "Volume Liquidado", value: stats.paid, color: "green", sub: "Finalizados com Sucesso" },
                                { label: "Axion Profit (30%)", value: stats.paid * 0.3, color: "primary", sub: "Lucro Estimado" }
                            ].map((s, idx) => (
                                <div key={idx} className={cn(
                                    "glass-card p-10 rounded-[45px] border-white/5 shadow-2xl transition-all hover:translate-y-[-8px] cursor-default group border-b-8 shadow-inner flex flex-col justify-between",
                                    idx === 0 ? "border-b-[#EAB308]/30" : idx === 1 ? "border-b-blue-500/30" : idx === 2 ? "border-b-green-500/30" : "border-b-[#EAB308]/30"
                                )}>
                                    <div>
                                        <p className="text-[10px] font-black uppercase tracking-[0.3em] text-muted-foreground/40 mb-5 group-hover:text-white transition-colors">{s.label}</p>
                                        <h3 className="text-4xl font-black italic tracking-tighter">
                                            {s.noFormat ? s.value : formatBRL(s.value)}
                                        </h3>
                                        <p className="text-[9px] font-bold uppercase tracking-[0.3em] text-[#EAB308]/60 mt-4 italic">{s.sub}</p>
                                    </div>

                                    {(s as any).action && (
                                        <button
                                            onClick={(s as any).action}
                                            className="mt-8 w-full h-14 bg-white/5 hover:bg-primary hover:text-black border border-white/10 rounded-2xl flex items-center justify-center gap-4 transition-all font-black uppercase tracking-[0.3em] text-[10px]"
                                        >
                                            {(s as any).buttonLabel} {(s as any).icon}
                                        </button>
                                    )}
                                </div>
                            ))}
                        </div>

                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-12">
                            {/* Withdraw Control */}
                            <div className="space-y-10">
                                <div className="flex items-center gap-5 px-4">
                                    <div className="p-4 bg-red-500/10 rounded-3xl border border-red-500/20">
                                        <ArrowDownCircle size={32} className="text-red-500" />
                                    </div>
                                    <div>
                                        <h3 className="text-3xl font-black italic uppercase tracking-tighter text-white">Pending Clearances</h3>
                                        <p className="text-[10px] uppercase font-black tracking-widest text-[#EAB308]/40">Aprovação Manual de Resgates</p>
                                    </div>
                                </div>

                                <div className="space-y-6 max-h-[700px] overflow-y-auto pr-4 custom-scrollbar">
                                    {withdrawRequests.length === 0 ? (
                                        <div className="glass-card p-32 rounded-[60px] text-center border-dashed border-2 border-white/5 opacity-40">
                                            <Activity size={64} className="mx-auto mb-6 text-muted-foreground" />
                                            <p className="text-[11px] uppercase font-black tracking-[0.5em] italic">Network Clean: No Pendency</p>
                                        </div>
                                    ) : withdrawRequests.map(req => (
                                        <motion.div key={req.id} layout className="glass-card p-10 rounded-[40px] border-white/5 flex items-center justify-between group hover:bg-white/[0.04] transition-all border-l-4 border-l-red-500/20">
                                            <div className="space-y-3">
                                                <p className="text-[10px] font-mono text-muted-foreground uppercase tracking-[0.2em] opacity-50">Protocol ID: {req.id.slice(0, 16).toUpperCase()}</p>
                                                <h4 className="text-3xl font-black text-white italic">{formatBRL(req.amount_original as any)}</h4>
                                                <div className="flex items-center gap-4">
                                                    <div className="flex items-center gap-2 bg-blue-500/10 px-3 py-1 rounded-full border border-blue-500/20">
                                                        <div className="w-1.5 h-1.5 rounded-full bg-blue-500 animate-pulse" />
                                                        <span className="text-[10px] font-black uppercase tracking-widest text-blue-400">Canal: PIX-GATE</span>
                                                    </div>
                                                </div>
                                            </div>
                                            <button
                                                onClick={() => approveWithdraw(req.id)}
                                                className="px-12 h-20 bg-green-500/10 hover:bg-green-500 border border-green-500/20 text-green-500 hover:text-black rounded-[25px] transition-all font-black uppercase tracking-[0.3em] text-xs flex items-center gap-4 active:scale-95 shadow-2xl shadow-green-500/10"
                                            >
                                                LIBERAR <Check size={24} />
                                            </button>
                                        </motion.div>
                                    ))}
                                </div>
                            </div>

                            {/* Global Live Feed */}
                            <div className="space-y-10">
                                <div className="flex items-center gap-5 px-4">
                                    <div className="p-4 bg-blue-500/10 rounded-3xl border border-blue-500/20">
                                        <Activity size={32} className="text-blue-500" />
                                    </div>
                                    <div>
                                        <h3 className="text-3xl font-black italic uppercase tracking-tighter text-white">Live Operations</h3>
                                        <p className="text-[10px] uppercase font-black tracking-widest text-blue-500/40">Monitoramento de Protocolos em Tempo Real</p>
                                    </div>
                                </div>

                                <div className="glass-card rounded-[60px] overflow-hidden border-white/5 shadow-inner">
                                    <div className="divide-y divide-white/5 max-h-[700px] overflow-y-auto custom-scrollbar">
                                        {realTimeFeed.map(activity => (
                                            <div key={activity.id} className="p-10 flex items-center justify-between hover:bg-white/[0.03] transition-colors border-l-4 border-l-transparent hover:border-l-blue-500/50">
                                                <div className="flex items-center gap-6">
                                                    <div className={cn(
                                                        "w-14 h-14 rounded-2xl flex items-center justify-center border",
                                                        activity.type === 'deposit' ? "bg-blue-500/10 border-blue-500/20 text-blue-400" : "bg-green-500/10 border-green-500/20 text-green-400"
                                                    )}>
                                                        {activity.type === 'deposit' ? <ArrowUpCircle size={26} /> : <ArrowDownCircle size={26} />}
                                                    </div>
                                                    <div>
                                                        <h5 className="font-black text-base italic uppercase tracking-tighter">
                                                            {activity.type === 'deposit'
                                                                ? `Depósito de ${activity.user_name || 'Operador'}`
                                                                : 'Resgate Protocolado'}
                                                        </h5>
                                                        <div className="flex items-center gap-4 mt-1.5">
                                                            <span className="text-[10px] font-black font-mono text-muted-foreground opacity-40 uppercase">{new Date(activity.created_at).toLocaleTimeString()}</span>
                                                            <div className={cn(
                                                                "text-[9px] px-3 py-1 rounded-full font-black uppercase tracking-[0.2em] shadow-sm",
                                                                activity.status === 'completed' ? "bg-green-500/5 text-green-500 border border-green-500/10" : "bg-yellow-500/5 text-yellow-500 border border-yellow-500/10"
                                                            )}>
                                                                {activity.status === 'completed' ? 'Finalizado' : 'Em Trânsito'}
                                                            </div>
                                                        </div>
                                                    </div>
                                                </div>
                                                <div className="text-right">
                                                    <p className="text-2xl font-black italic tracking-tighter text-white">
                                                        {formatBRL(activity.amount_original as any)}
                                                    </p>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            </div>
                        </div>
                    </motion.div>
                ) : activeTab === 'users' ? (
                    <motion.div
                        key="users"
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -20 }}
                        className="space-y-10"
                    >
                        <div className="flex justify-between items-center px-6">
                            <div className="flex items-center gap-4">
                                <Users size={32} className="text-[#EAB308]" />
                                <h3 className="text-3xl font-black italic uppercase tracking-tighter">Relatório de Operadores</h3>
                            </div>
                            <div className="flex items-center gap-6">
                                <div className="relative">
                                    <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground" size={18} />
                                    <input
                                        type="text"
                                        placeholder="Localizar Operador..."
                                        value={searchTerm}
                                        onChange={(e) => setSearchTerm(e.target.value)}
                                        className="h-14 bg-white/5 border border-white/10 rounded-2xl pl-12 pr-6 outline-none focus:border-primary/50 transition-all text-sm font-bold w-80"
                                    />
                                </div>
                                <button
                                    onClick={fetchAdminData}
                                    disabled={isLoading}
                                    className="h-14 px-8 bg-blue-500/10 hover:bg-blue-500/20 border border-blue-500/20 rounded-2xl flex items-center gap-3 transition-all active:scale-95 text-blue-400 group"
                                >
                                    <Activity size={18} className={cn(isLoading && "animate-spin")} />
                                    <span className="text-[10px] font-black uppercase tracking-widest">Sincronizar Cluster</span>
                                </button>
                            </div>
                        </div>

                        <div className="glass-card rounded-[50px] border-white/5 overflow-hidden shadow-3xl min-h-[400px]">
                            <div className="overflow-x-auto">
                                <table className="w-full text-left border-collapse">
                                    <thead>
                                        <tr className="bg-white/[0.03] border-b border-white/5">
                                            <th className="p-8 text-[11px] font-black uppercase tracking-widest text-muted-foreground">Operador</th>
                                            <th className="p-8 text-[11px] font-black uppercase tracking-widest text-[#EAB308] text-center">Protocolos</th>
                                            <th className="p-8 text-[11px] font-black uppercase tracking-widest text-blue-400 text-center">Liquidez Bruta</th>
                                            <th className="p-8 text-[11px] font-black uppercase tracking-widest text-green-400 text-center">Depósitos Pagos</th>
                                            <th className="p-8 text-[11px] font-black uppercase tracking-widest text-red-400 text-center">Saques Finalizados</th>
                                            <th className="p-8 text-[11px] font-black uppercase tracking-widest text-white text-right">Saldo Ativo</th>
                                            <th className="p-8 text-[11px] font-black uppercase tracking-widest text-muted-foreground text-center">Ação</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-white/5">
                                        {isLoading ? (
                                            <tr>
                                                <td colSpan={6} className="p-20 text-center">
                                                    <div className="flex flex-col items-center gap-4 opacity-50">
                                                        <Activity className="animate-spin text-primary" size={32} />
                                                        <p className="text-[10px] uppercase font-black tracking-widest">Sincronizando Database...</p>
                                                    </div>
                                                </td>
                                            </tr>
                                        ) : filteredUsers.length === 0 ? (
                                            <tr>
                                                <td colSpan={7} className="p-20 text-center">
                                                    <div className="flex flex-col items-center gap-4 opacity-30">
                                                        <Search size={48} />
                                                        <p className="text-[10px] uppercase font-black tracking-widest italic">Nenhum operador localizado no cluster</p>
                                                    </div>
                                                </td>
                                            </tr>
                                        ) : filteredUsers.map((user) => (
                                            <tr key={user.id} className="hover:bg-white/[0.02] transition-colors group">
                                                <td className="p-8">
                                                    <div className="flex items-center gap-4">
                                                        <div className="w-12 h-12 rounded-2xl bg-white/5 flex items-center justify-center text-muted-foreground group-hover:bg-primary/10 group-hover:text-primary transition-all">
                                                            <Users size={20} />
                                                        </div>
                                                        <div>
                                                            <p className="text-sm font-black text-white group-hover:text-primary transition-colors uppercase tracking-tight italic">{user.full_name || 'Protocolo Ativo'}</p>
                                                            <p className="text-[10px] font-mono text-muted-foreground uppercase opacity-40">USUÁRIO: {user.email?.split('@')[0]}</p>
                                                        </div>
                                                    </div>
                                                </td>
                                                <td className="p-8 text-center text-sm font-bold font-mono opacity-60">
                                                    {user.txCount}
                                                </td>
                                                <td className="p-8 text-center">
                                                    <p className="text-base font-black italic text-blue-400">{formatBRL(user.totalGenerated)}</p>
                                                </td>
                                                <td className="p-8 text-center">
                                                    <p className="text-base font-black italic text-green-400">{formatBRL(user.totalPaid)}</p>
                                                </td>
                                                <td className="p-8 text-center">
                                                    <p className="text-base font-black italic text-red-400">{formatBRL(user.totalWithdrawn)}</p>
                                                </td>
                                                <td className="p-8 text-right">
                                                    <div className="flex flex-col items-end gap-1">
                                                        <div className="flex items-center gap-2 px-3 py-1 bg-white/5 rounded-lg border border-white/5">
                                                            <Wallet size={12} className="text-[#EAB308]" />
                                                            <span className="text-lg font-black italic text-white">{formatBRL(user.balance)}</span>
                                                        </div>
                                                    </div>
                                                </td>
                                                <td className="p-8 text-center">
                                                    <button
                                                        onClick={() => handleDeleteUser(user.id, user.email)}
                                                        className="p-3 bg-red-500/10 text-red-500 hover:bg-red-500 hover:text-black rounded-xl border border-red-500/20 transition-all active:scale-95 group-hover:shadow-[0_0_15px_rgba(239,68,68,0.2)]"
                                                        title="Excluir Operador e seus dados financeiros"
                                                    >
                                                        <Trash2 size={18} />
                                                    </button>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    </motion.div>
                ) : (
                    <motion.div
                        key="settings"
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -20 }}
                        className="space-y-12"
                    >
                        <div className="flex items-center gap-5 px-6">
                            <div className="p-4 bg-[#EAB308]/10 rounded-3xl border border-[#EAB308]/20 text-[#EAB308]">
                                <Settings size={32} />
                            </div>
                            <div>
                                <h3 className="text-3xl font-black italic uppercase tracking-tighter text-white">Configurações Base</h3>
                                <p className="text-[10px] uppercase font-black tracking-widest text-[#EAB308]/40">Gerenciamento de Integrações e Gateway</p>
                            </div>
                        </div>

                        <div className="glass-card p-12 rounded-[60px] border-white/5 space-y-10">
                            <div className="space-y-8">
                                <div className="flex items-center gap-4">
                                    <Database className="text-[#EAB308]" size={24} />
                                    <h4 className="text-xl font-black italic uppercase">Gateway MyCash</h4>
                                </div>

                                <div className="space-y-4">
                                    <label className="text-[11px] font-black uppercase tracking-[0.3em] text-muted-foreground/60 ml-4">API KEY (MYCASH.CC)</label>
                                    <div className="relative">
                                        <input
                                            type="password"
                                            value={mycashApiKey}
                                            onChange={(e) => setMycashApiKey(e.target.value)}
                                            placeholder="sk_live_..."
                                            className="w-full h-20 bg-white/[0.02] border border-white/10 rounded-[28px] px-10 outline-none focus:border-primary/40 focus:bg-white/5 transition-all font-mono text-sm text-[#EAB308]"
                                        />
                                    </div>
                                    <p className="text-[9px] text-muted-foreground/40 italic ml-4">* Esta chave é usada para gerar todos os PIX da plataforma.</p>
                                </div>

                                <div className="flex flex-wrap gap-6 pt-10">
                                    <button
                                        onClick={async () => {
                                            try {
                                                const res = await fetch('/api/admin/settings', {
                                                    method: 'POST',
                                                    headers: { 'Content-Type': 'application/json' },
                                                    body: JSON.stringify({ key: 'MYCASH_API_KEY', value: mycashApiKey })
                                                });
                                                if (res.ok) {
                                                    setSettingsStatus({ type: 'success', message: "CONFIGURAÇÕES SALVAS COM SUCESSO!" });
                                                    setTimeout(() => setSettingsStatus(null), 3000);
                                                } else {
                                                    const d = await res.json();
                                                    setSettingsStatus({ type: 'error', message: "ERRO: " + d.error });
                                                }
                                            } catch (err) {
                                                setSettingsStatus({ type: 'error', message: "Falha ao salvar configurações." });
                                            }
                                        }}
                                        className="h-20 px-12 bg-white/5 hover:bg-white/10 border border-white/10 rounded-[28px] font-black uppercase tracking-[0.3em] transition-all text-xs italic"
                                    >
                                        Salvar Alterações
                                    </button>

                                    <button
                                        onClick={handleResetSystem}
                                        className="h-20 px-12 bg-red-600/10 hover:bg-red-600 border border-red-600/20 text-red-500 hover:text-white rounded-[28px] font-black uppercase tracking-[0.3em] transition-all text-xs italic flex items-center gap-4"
                                    >
                                        Limpar Sistema (Zerar Tudo) <Trash2 size={20} />
                                    </button>
                                </div>

                                {settingsStatus && (
                                    <div className={cn(
                                        "p-6 rounded-3xl border font-black text-[10px] uppercase tracking-widest",
                                        settingsStatus.type === 'success' ? "bg-green-500/10 border-green-500/20 text-green-500" : "bg-red-500/10 border-red-500/20 text-red-500"
                                    )}>
                                        {settingsStatus.message}
                                    </div>
                                )}
                            </div>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* Create User Modal - GLOBAL LEVEL */}
            <AnimatePresence>
                {isUserModalOpen && (
                    <div className="fixed inset-0 z-[200] flex items-center justify-center p-6">
                        <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            onClick={() => !isCreatingUser && setIsUserModalOpen(false)}
                            className="absolute inset-0 bg-black/95 backdrop-blur-md"
                        />

                        <motion.div
                            initial={{ opacity: 0, scale: 0.9, y: 30 }}
                            animate={{ opacity: 1, scale: 1, y: 0 }}
                            exit={{ opacity: 0, scale: 0.9, y: 30 }}
                            className="glass-card w-full max-w-xl p-12 rounded-[60px] border-white/5 shadow-2xl relative z-10"
                        >
                            <div className="flex items-center gap-6 mb-12">
                                <div className="w-20 h-20 rounded-[30px] bg-primary/10 border border-primary/20 flex items-center justify-center text-primary shadow-2xl shadow-primary/10">
                                    <UserPlus size={40} />
                                </div>
                                <div>
                                    <h2 className="text-4xl font-black italic uppercase tracking-tighter">Novo Protocolo</h2>
                                    <p className="text-[11px] text-muted-foreground uppercase font-black tracking-[0.3em] mt-1 opacity-50">Inserção de Operador na Rede</p>
                                </div>
                            </div>

                            {modalError && (
                                <div className="mb-10 p-6 bg-red-500/10 border border-red-500/20 rounded-3xl flex items-center gap-4 text-red-500 font-black text-xs uppercase tracking-widest animate-shake">
                                    <AlertTriangle size={20} />
                                    <span>{modalError}</span>
                                </div>
                            )}

                            <form className="space-y-10" onSubmit={async (e) => {
                                e.preventDefault();
                                const formData = new FormData(e.currentTarget);
                                const username = formData.get('username') as string;
                                const password = formData.get('password') as string;
                                const name = formData.get('name') as string;

                                if (!username || !password || !name) return;

                                setIsCreatingUser(true);
                                try {
                                    const res = await fetch('/api/admin/users/create', {
                                        method: 'POST',
                                        headers: { 'Content-Type': 'application/json' },
                                        body: JSON.stringify({ username, password, name }),
                                    });

                                    const data = await res.json();
                                    if (res.ok) {
                                        setIsUserModalOpen(false);
                                        setModalError(null);
                                        setActiveTab('users');
                                        await fetchAdminData();
                                    } else {
                                        setModalError(data.error);
                                    }
                                } catch (err) {
                                    setModalError("ERRO DE CONEXÃO COM O SERVIDOR");
                                } finally {
                                    setIsCreatingUser(false);
                                }
                            }}>
                                <div className="space-y-4">
                                    <label className="text-[11px] font-black uppercase tracking-[0.4em] text-muted-foreground/40 ml-6">Nome do Operador</label>
                                    <input
                                        name="name"
                                        type="text"
                                        required
                                        disabled={isCreatingUser}
                                        placeholder="ex: Renato Régis"
                                        className="w-full h-24 bg-white/[0.03] border border-white/10 rounded-[35px] px-12 outline-none focus:border-primary/40 focus:bg-white/5 transition-all font-bold text-white text-xl placeholder:opacity-20"
                                    />
                                </div>

                                <div className="space-y-4">
                                    <label className="text-[11px] font-black uppercase tracking-[0.4em] text-muted-foreground/40 ml-6">Login de Acesso (Usuário)</label>
                                    <input
                                        name="username"
                                        type="text"
                                        required
                                        disabled={isCreatingUser}
                                        placeholder="ex: renato.regis"
                                        className="w-full h-24 bg-white/[0.03] border border-white/10 rounded-[35px] px-12 outline-none focus:border-primary/40 focus:bg-white/5 transition-all font-bold text-white text-xl placeholder:opacity-20 uppercase"
                                    />
                                </div>

                                <div className="space-y-4">
                                    <label className="text-[11px] font-black uppercase tracking-[0.4em] text-muted-foreground/40 ml-6">Chave de Acesso (Senha)</label>
                                    <div className="relative group">
                                        <input
                                            name="password"
                                            type={showUserPassword ? "text" : "password"}
                                            required
                                            disabled={isCreatingUser}
                                            placeholder="••••••••"
                                            className="w-full h-24 bg-white/[0.03] border border-white/10 rounded-[35px] px-12 pr-24 outline-none focus:border-primary/40 focus:bg-white/5 transition-all font-bold text-xl"
                                        />
                                        <button
                                            type="button"
                                            onClick={() => setShowUserPassword(!showUserPassword)}
                                            className="absolute right-10 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-white transition-all"
                                        >
                                            {showUserPassword ? <EyeOff size={24} /> : <Eye size={24} />}
                                        </button>
                                    </div>
                                </div>

                                <div className="flex gap-6 pt-10">
                                    <button
                                        type="button"
                                        disabled={isCreatingUser}
                                        onClick={() => setIsUserModalOpen(false)}
                                        className="flex-1 h-24 bg-white/5 border border-white/10 rounded-[35px] font-black uppercase tracking-[0.3em] transition-all hover:bg-white/10 text-[10px]"
                                    >
                                        Abortar
                                    </button>
                                    <button
                                        type="submit"
                                        disabled={isCreatingUser}
                                        className="flex-[2] h-24 gold-gradient rounded-[35px] font-black uppercase tracking-[0.4em] flex items-center justify-center gap-6 hover:scale-[1.02] active:scale-95 transition-all text-base italic shadow-2xl shadow-yellow-900/30 disabled:opacity-50 disabled:grayscale"
                                    >
                                        {isCreatingUser ? "Sincronizando..." : "Validar Operador"} <CheckCircle2 size={30} />
                                    </button>
                                </div>
                            </form>
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>
        </div>
    );
}
