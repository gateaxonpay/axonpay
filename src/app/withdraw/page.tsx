'use client';

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
    ArrowDownCircle,
    Wallet,
    Info,
    ShieldCheck,
    ArrowRight,
    User as UserIcon,
    AlertTriangle,
    Send,
    Loader2,
    RefreshCcw,
    CheckCircle2,
    Menu
} from 'lucide-react';
import { cn, formatBRL } from '@/lib/utils';
import { supabase } from '@/lib/supabase';
import { useRouter } from 'next/navigation';

const PIX_TYPES = [
    { id: 'CPF', label: 'CPF', placeholder: '123.456.789-00' },
    { id: 'CNPJ', label: 'CNPJ', placeholder: '12.345.678/0001-00' },
    { id: 'PHONE', label: 'Telefone', placeholder: '+55 11 99999-8888' },
    { id: 'EMAIL', label: 'E-mail', placeholder: 'cliente@provedor.com' },
    { id: 'EVP', label: 'Aleatória', placeholder: '00000000-0000-0000-0000-000000000000' },
];

export default function WithdrawPage() {
    const [balance, setBalance] = useState(0);
    const [pixType, setPixType] = useState('CPF');
    const [pixKey, setPixKey] = useState('');
    const [amount, setAmount] = useState('');
    const [isLoading, setIsLoading] = useState(true);
    const [isProcessing, setIsProcessing] = useState(false);
    const [success, setSuccess] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const router = useRouter();

    const [lockUntil, setLockUntil] = useState<string | null>(null);

    const fetchProfile = async () => {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) {
            router.push('/auth');
            return;
        }

        const { data: profile } = await supabase.from('profiles').select('*').eq('id', user.id).single();
        if (profile) {
            setBalance(profile.balance);
            if (profile.pix_key) setPixKey(profile.pix_key);
            if (profile.pix_type) setPixType(profile.pix_type);
            if (profile.withdraw_lock_until) setLockUntil(profile.withdraw_lock_until);
        }
        setIsLoading(false);
    };

    useEffect(() => {
        fetchProfile();
    }, []);

    const requestedValue = parseFloat(amount) || 0;
    const netValue = requestedValue > 0 ? (requestedValue * 0.7) : 0;
    const feeValue = requestedValue > 0 ? (requestedValue * 0.3) : 0;

    const handleWithdraw = async () => {
        if (!amount || requestedValue <= 0) {
            setError('Insira um valor válido para o saque.');
            return;
        }

        if (requestedValue > balance) {
            setError('Saldo insuficiente.');
            return;
        }

        if (!pixKey) {
            setError('Preencha a chave PIX.');
            return;
        }

        setIsProcessing(true);
        setError(null);

        try {
            const { data: { user } } = await supabase.auth.getUser();

            const res = await fetch('/api/pix/withdraw', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    amount: requestedValue,
                    pix_type: pixType,
                    pix_key: pixKey.replace(/[^\d+a-zA-Z-@.]/g, ''), // Basic cleanup
                    user_id: user?.id
                })
            });

            const data = await res.json();

            if (!res.ok) {
                throw new Error(data.error || 'Erro ao processar saque');
            }

            setSuccess(true);
            setBalance(b => b - requestedValue);
        } catch (err: any) {
            setError(err.message || 'Erro ao processar o saque.');
        } finally {
            setIsProcessing(false);
        }
    };

    if (isLoading) {
        return (
            <div className="h-[60vh] flex items-center justify-center">
                <Loader2 className="animate-spin text-primary" size={40} />
            </div>
        );
    }

    const activePlaceholder = PIX_TYPES.find(t => t.id === pixType)?.placeholder;

    return (
        <div className="max-w-4xl mx-auto pb-20">
            <div className="flex items-center gap-4 mb-10">
                <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-2xl shadow-2xl shadow-red-900/10">
                    <ArrowDownCircle className="text-red-400" size={28} />
                </div>
                <div>
                    <h1 className="text-3xl font-black tracking-tight text-white uppercase italic">Resgate de Saldo</h1>
                    <p className="text-muted-foreground text-sm uppercase tracking-widest font-bold">Protocolo de Saque Prioritário</p>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-5 gap-10">
                <div className="lg:col-span-3 space-y-8">
                    <AnimatePresence mode="wait">
                        {!success ? (
                            <motion.div
                                initial={{ opacity: 0, x: -20 }}
                                animate={{ opacity: 1, x: 0 }}
                                exit={{ opacity: 0, scale: 0.9 }}
                                className="glass-card p-10 rounded-[40px] border-white/5 space-y-8"
                            >
                                <div className="space-y-6">
                                    <div className="grid grid-cols-2 gap-4">
                                        <div className="p-6 bg-white/[0.03] border border-white/5 rounded-3xl">
                                            <p className="text-[10px] font-black text-muted-foreground uppercase tracking-widest mb-2 flex items-center gap-2">
                                                <Wallet size={12} /> Saldo Protocolo
                                            </p>
                                            <h2 className="text-xl font-black text-white">{formatBRL(balance)}</h2>
                                        </div>
                                        <div className="p-6 bg-[#EAB308]/5 border border-[#EAB308]/20 rounded-3xl">
                                            <p className="text-[10px] font-black text-[#EAB308]/70 uppercase tracking-widest mb-2 flex items-center gap-2">
                                                <ShieldCheck size={12} /> Limite Bruto
                                            </p>
                                            <h2 className="text-xl font-black text-[#EAB308]">{formatBRL(balance)}</h2>
                                        </div>
                                    </div>

                                    <div className="space-y-4">
                                        <label className="text-[10px] font-black uppercase tracking-widest text-[#EAB308] ml-2">Total a Deduzir (R$)</label>
                                        <div className="relative group">
                                            <span className="absolute left-6 top-1/2 -translate-y-1/2 text-2xl font-bold opacity-30 group-focus-within:opacity-100 transition-opacity">R$</span>
                                            <input
                                                type="number"
                                                value={amount}
                                                onChange={(e) => {
                                                    setAmount(e.target.value);
                                                    setError(null);
                                                }}
                                                placeholder="0,00"
                                                className="w-full h-20 bg-white/5 border border-white/10 rounded-[28px] pl-16 pr-24 text-3xl font-black outline-none focus:border-red-500/50 focus:bg-white/10 transition-all font-mono shadow-inner"
                                            />
                                            <button
                                                onClick={() => setAmount(balance.toString())}
                                                className="absolute right-6 top-1/2 -translate-y-1/2 px-4 py-2 bg-white/10 hover:bg-white/20 rounded-xl text-xs font-bold uppercase tracking-widest transition-all text-white/50 hover:text-white"
                                            >
                                                Máximo
                                            </button>
                                        </div>
                                    </div>

                                    <div className="space-y-6 pt-4 border-t border-white/5">
                                        <div className="flex gap-2 mb-2 overflow-x-auto pb-2 custom-scrollbar">
                                            {PIX_TYPES.map(type => (
                                                <button
                                                    key={type.id}
                                                    onClick={() => setPixType(type.id)}
                                                    className={cn(
                                                        "px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all whitespace-nowrap border",
                                                        pixType === type.id
                                                            ? "bg-primary text-black border-primary shadow-lg shadow-yellow-500/20"
                                                            : "bg-white/5 text-muted-foreground border-white/5 hover:bg-white/10"
                                                    )}
                                                >
                                                    {type.label}
                                                </button>
                                            ))}
                                        </div>

                                        <div className="relative group">
                                            <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground/50 ml-2 mb-2 block">DADOS DA CHAVE {pixType}</label>
                                            <div className="flex items-center bg-white/5 border border-white/10 rounded-[24px] focus-within:border-blue-500/50 transition-all">
                                                <div className="pl-6 text-muted-foreground">
                                                    <UserIcon size={20} />
                                                </div>
                                                <input
                                                    type="text"
                                                    value={pixKey}
                                                    onChange={(e) => setPixKey(e.target.value)}
                                                    placeholder={activePlaceholder}
                                                    className="w-full h-16 bg-transparent px-4 outline-none font-bold placeholder:text-white/10 tracking-widest"
                                                />
                                            </div>
                                        </div>
                                    </div>

                                    {/* Tax Engine Visual */}
                                    <div className="p-6 bg-white/[0.03] rounded-3xl border border-white/5 space-y-4 shadow-inner">
                                        <div className="flex justify-between items-center text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
                                            <span className="flex items-center gap-2">
                                                <Info size={12} /> Taxa de Liquidação (30%)
                                            </span>
                                            <span className="text-red-400">-{formatBRL(feeValue)}</span>
                                        </div>
                                        <div className="h-px bg-white/5" />
                                        <div className="flex justify-between items-center">
                                            <span className="text-xs font-black uppercase tracking-widest text-[#EAB308]">Crédito em Conta (70%)</span>
                                            <span className="text-2xl font-black text-white">{formatBRL(netValue)}</span>
                                        </div>
                                    </div>

                                    {lockUntil && new Date() < new Date(lockUntil) && (
                                        <div className="p-6 bg-yellow-500/10 border border-yellow-500/20 rounded-3xl space-y-3 shadow-xl">
                                            <div className="flex items-center gap-3 text-yellow-500 font-black text-xs uppercase tracking-[0.2em] italic">
                                                <AlertTriangle size={20} /> ALERTA DE CONFORMIDADE
                                            </div>
                                            <p className="text-[10px] text-white/60 font-black uppercase tracking-widest leading-relaxed">
                                                Saque bloqueado temporariamente (Restam {Math.ceil((new Date(lockUntil).getTime() - new Date().getTime()) / 60000)} min).
                                                O sistema detectou comportamento suspeito de <span className="text-yellow-500">lavagem de dinheiro</span>.
                                                Aguarde a análise de liquidez antes de liberar o resgate.
                                            </p>
                                        </div>
                                    )}

                                    {error && (
                                        <div className="p-4 bg-red-500/10 border border-red-500/20 rounded-2xl flex items-center gap-3 text-red-500 font-bold text-xs uppercase tracking-widest shadow-lg shadow-red-900/10">
                                            <AlertTriangle size={18} />
                                            {error}
                                        </div>
                                    )}

                                    <button
                                        onClick={handleWithdraw}
                                        disabled={isProcessing || !amount || requestedValue <= 0 || (!!lockUntil && new Date() < new Date(lockUntil))}
                                        className="w-full h-20 bg-gradient-to-r from-red-600 to-orange-600 rounded-[28px] font-black uppercase tracking-[0.2em] flex items-center justify-center gap-3 hover:scale-[1.02] active:scale-100 transition-all shadow-2xl shadow-red-900/30 disabled:opacity-30 disabled:grayscale"
                                    >
                                        {isProcessing ? (
                                            <Loader2 size={24} className="animate-spin" />
                                        ) : (
                                            <>
                                                Confirmar Resgate
                                                <ArrowRight size={20} />
                                            </>
                                        )}
                                    </button>
                                </div>
                            </motion.div>
                        ) : (
                            <motion.div
                                initial={{ opacity: 0, scale: 0.9 }}
                                animate={{ opacity: 1, scale: 1 }}
                                className="glass-card p-12 rounded-[40px] text-center space-y-8 flex flex-col items-center justify-center min-h-[500px] border-green-500/10"
                            >
                                <div className="w-32 h-32 rounded-full bg-green-500/10 border-2 border-green-500/20 flex items-center justify-center text-green-500 mb-4 shadow-2xl shadow-green-500/20">
                                    <CheckCircle2 size={64} className="animate-bounce" />
                                </div>
                                <div className="space-y-4">
                                    <h2 className="text-4xl font-black italic tracking-tighter uppercase">Transferência Solicitada</h2>
                                    <p className="text-muted-foreground text-lg max-w-[320px] mx-auto leading-relaxed">
                                        Liquidação de <span className="text-white font-bold">{formatBRL(netValue)}</span> enviada com prioridade para <span className="text-white font-mono">{pixKey}</span>.
                                    </p>
                                </div>

                                <div className="w-full p-8 bg-white/5 rounded-3xl border border-white/5 space-y-4 max-w-sm">
                                    <div className="flex justify-between items-center text-[10px] font-black uppercase tracking-widest">
                                        <span className="text-muted-foreground">Status do Protocolo</span>
                                        <span className="text-blue-400 flex items-center gap-1">
                                            <RefreshCcw size={10} className="animate-spin" /> EM PROCESSAMENTO
                                        </span>
                                    </div>
                                    <div className="h-1 bg-white/5 rounded-full overflow-hidden">
                                        <motion.div
                                            initial={{ x: "-100%" }}
                                            animate={{ x: "100%" }}
                                            transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
                                            className="w-1/2 h-full bg-blue-500 shadow-[0_0_15px_rgba(59,130,246,0.5)]"
                                        />
                                    </div>
                                </div>

                                <button
                                    onClick={() => {
                                        setSuccess(false);
                                        setAmount('');
                                    }}
                                    className="mt-6 text-primary font-black uppercase tracking-[0.2em] hover:underline text-xs"
                                >
                                    Realizar novo protocolo
                                </button>
                            </motion.div>
                        )}
                    </AnimatePresence>
                </div>

                <div className="lg:col-span-2 space-y-6">
                    <div className="glass-card p-8 rounded-[40px] space-y-6 border-white/5 relative overflow-hidden group">
                        <div className="absolute top-0 right-0 w-32 h-32 bg-primary/5 blur-[50px] -mr-16 -mt-16 group-hover:bg-primary/10 transition-all" />
                        <h3 className="font-black flex items-center gap-3 text-white text-sm uppercase tracking-widest">
                            <ShieldCheck size={20} className="text-primary" />
                            Security Protocol 303
                        </h3>
                        <div className="space-y-6 text-xs text-muted-foreground leading-relaxed">
                            <div className="flex gap-4">
                                <div className="w-1.5 h-1.5 rounded-full bg-primary shrink-0 mt-2 shadow-[0_0_8px_rgba(234,179,8,0.5)]" />
                                <p>Os saques são liquidados através de pools descentralizados de liquidez para garantir <strong>anonimato e velocidade</strong>.</p>
                            </div>
                            <div className="flex gap-4">
                                <div className="w-1.5 h-1.5 rounded-full bg-primary shrink-0 mt-2" />
                                <p>O desconto de <strong>30%</strong> é destinado à manutenção da infraestrutura e taxas de transação da rede.</p>
                            </div>
                            <div className="flex gap-4">
                                <div className="w-1.5 h-1.5 rounded-full bg-primary shrink-0 mt-2" />
                                <p><strong>IMPORTANTE:</strong> Confira sua chave. Uma vez disparado o protocolo, a transação torna-se parte imutável da rede.</p>
                            </div>
                        </div>
                    </div>

                    <div className="bg-gradient-to-br from-blue-600/10 to-indigo-600/10 border border-blue-500/20 p-10 rounded-[40px] space-y-6 group">
                        <div className="flex items-center gap-4">
                            <div className="w-14 h-14 rounded-2xl bg-blue-500/10 flex items-center justify-center text-blue-400 group-hover:scale-110 transition-transform shadow-2xl shadow-blue-500/10">
                                <Send size={24} />
                            </div>
                            <div>
                                <h4 className="font-black text-blue-400 uppercase tracking-widest">Suporte Black</h4>
                                <p className="text-[10px] text-blue-200/40 uppercase font-bold tracking-widest">Disponível 24/7</p>
                            </div>
                        </div>
                        <p className="text-xs text-blue-200/50 leading-relaxed font-bold italic">Saques acima de R$ 50.000,00 contam com um gerente exclusivo de conta.</p>
                        <button className="w-full h-14 bg-blue-600/20 border border-blue-600/30 rounded-2xl text-blue-400 text-[10px] font-black uppercase tracking-[0.2em] hover:bg-blue-600/30 transition-all">
                            Prioridade VIP Support
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}
