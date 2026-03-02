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
    Loader2
} from 'lucide-react';
import { cn, formatBRL } from '@/lib/utils';
import Decimal from 'decimal.js';
import { supabase } from '@/lib/supabase';

export default function WithdrawPage() {
    const [balance, setBalance] = useState(0);
    const [pixKey, setPixKey] = useState('');
    const [amount, setAmount] = useState('');
    const [isLoading, setIsLoading] = useState(true);
    const [isProcessing, setIsProcessing] = useState(false);
    const [success, setSuccess] = useState(false);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        async function fetchProfile() {
            const { data } = await supabase.from('profiles').select('*').single();
            if (data) {
                setBalance(data.balance);
                setPixKey(data.pix_key || '');
            }
            setIsLoading(false);
        }
        fetchProfile();
    }, []);

    const handleWithdraw = async () => {
        if (!amount || parseFloat(amount) <= 0) {
            setError('Insira um valor válido para o saque.');
            return;
        }

        if (parseFloat(amount) > balance) {
            setError('Saldo insuficiente para realizar esta operação.');
            return;
        }

        if (!pixKey) {
            setError('Chave PIX não configurada ou inválida.');
            return;
        }

        setIsProcessing(true);
        setError(null);

        try {
            // 1. Create withdrawal transaction
            const { error: txError } = await supabase
                .from('transactions')
                .insert({
                    type: 'withdraw',
                    amount_original: parseFloat(amount),
                    amount_net: parseFloat(amount), // No tax for withdraw in this spec (unless specified)
                    description: 'Saque AxonPay',
                    status: 'processing',
                    pix_copia_e_cola: pixKey // Store the key here for reference
                });

            if (txError) throw txError;

            // 2. Reduce balance (this should be a trigger in DB, but doing it here for demo or if no trigger)
            const { error: profileError } = await supabase
                .from('profiles')
                .update({ balance: new Decimal(balance).minus(amount).toNumber() })
                .eq('id', (await supabase.auth.getUser()).data.user?.id);

            if (profileError) throw profileError;

            setSuccess(true);
            setBalance(b => b - parseFloat(amount));
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

    return (
        <div className="max-w-4xl mx-auto pb-20">
            <div className="flex items-center gap-4 mb-10">
                <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-2xl">
                    <ArrowDownCircle className="text-red-400" size={28} />
                </div>
                <div>
                    <h1 className="text-3xl font-bold tracking-tight">Solicitar Saque</h1>
                    <p className="text-muted-foreground mt-1">Retirada instantânea para sua chave PIX principal.</p>
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
                                className="glass-card p-10 rounded-3xl space-y-8"
                            >
                                <div className="space-y-6">
                                    <div className="grid grid-cols-2 gap-4">
                                        <div className="p-6 bg-white/[0.03] border border-white/5 rounded-2xl">
                                            <p className="text-xs font-bold text-muted-foreground flex items-center gap-2 mb-2">
                                                <Wallet size={12} /> SALDO ATUAL
                                            </p>
                                            <h2 className="text-xl font-black text-white">{formatBRL(balance)}</h2>
                                        </div>
                                        <div className="p-6 bg-[#EAB308]/5 border border-[#EAB308]/20 rounded-2xl">
                                            <p className="text-xs font-bold text-[#EAB308]/70 flex items-center gap-2 mb-2">
                                                <ShieldCheck size={12} /> LIMITE DISPONÍVEL
                                            </p>
                                            <h2 className="text-xl font-black text-[#EAB308]">{formatBRL(balance)}</h2>
                                        </div>
                                    </div>

                                    <div className="space-y-3">
                                        <label className="text-sm font-bold uppercase tracking-widest text-muted-foreground">Valor do Saque (R$)</label>
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
                                                className="w-full h-20 bg-white/5 border border-white/10 rounded-2xl pl-16 pr-24 text-3xl font-black outline-none focus:border-red-500/50 focus:bg-white/10 transition-all font-mono"
                                            />
                                            <button
                                                onClick={() => setAmount(balance.toString())}
                                                className="absolute right-6 top-1/2 -translate-y-1/2 px-4 py-2 bg-white/10 hover:bg-white/20 rounded-xl text-xs font-bold uppercase tracking-widest transition-all"
                                            >
                                                Máximo
                                            </button>
                                        </div>
                                    </div>

                                    <div className="space-y-3">
                                        <label className="text-sm font-bold uppercase tracking-widest text-muted-foreground">Destinatário (Chave PIX)</label>
                                        <div className="w-full h-16 bg-white/[0.03] border border-white/5 rounded-2xl flex items-center px-6 gap-4 border-l-4 border-l-blue-500">
                                            <div className="w-10 h-10 rounded-full bg-blue-500/10 flex items-center justify-center text-blue-400">
                                                <UserIcon size={20} />
                                            </div>
                                            <div className="flex-1">
                                                <p className="text-[10px] font-bold text-muted-foreground uppercase">Sua Chave Salva</p>
                                                <p className="font-mono font-bold text-white tracking-widest">{pixKey || 'Nenhuma chave configurada'}</p>
                                            </div>
                                        </div>
                                    </div>

                                    {error && (
                                        <div className="p-4 bg-red-500/10 border border-red-500/20 rounded-xl flex items-center gap-3 text-red-500 font-bold text-sm">
                                            <AlertTriangle size={18} />
                                            {error}
                                        </div>
                                    )}

                                    <button
                                        onClick={handleWithdraw}
                                        disabled={isProcessing || !amount || parseFloat(amount) <= 0}
                                        className="w-full h-16 bg-gradient-to-r from-red-600 to-orange-600 rounded-2xl font-black uppercase tracking-widest flex items-center justify-center gap-3 hover:scale-[1.02] active:scale-100 transition-all shadow-xl shadow-red-900/20 disabled:opacity-30"
                                    >
                                        {isProcessing ? (
                                            <Loader2 size={24} className="animate-spin" />
                                        ) : (
                                            <>
                                                Confirmar Saque
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
                                className="glass-card p-12 rounded-3xl text-center space-y-6 flex flex-col items-center justify-center min-h-[500px]"
                            >
                                <div className="w-24 h-24 rounded-full bg-green-500/10 border-2 border-green-500/30 flex items-center justify-center text-green-500 mb-4">
                                    <ShieldCheck size={48} className="animate-bounce" />
                                </div>
                                <div className="space-y-2">
                                    <h2 className="text-3xl font-black">Pedido Enviado!</h2>
                                    <p className="text-muted-foreground text-lg max-w-[300px]">Seu saque de <span className="text-white font-bold">{formatBRL(amount)}</span> está sendo processado com prioridade.</p>
                                </div>

                                <div className="w-full p-6 bg-white/5 rounded-2xl border border-white/5 mt-4">
                                    <div className="flex justify-between items-center text-sm opacity-50 mb-4 uppercase font-bold tracking-widest">
                                        <span>Status</span>
                                        <span className="text-blue-400">EM PROCESSAMENTO</span>
                                    </div>
                                    <div className="h-1 bg-white/5 rounded-full overflow-hidden">
                                        <motion.div
                                            initial={{ width: 0 }}
                                            animate={{ width: "60%" }}
                                            transition={{ duration: 2, repeat: Infinity }}
                                            className="h-full bg-blue-500"
                                        />
                                    </div>
                                </div>

                                <button
                                    onClick={() => {
                                        setSuccess(false);
                                        setAmount('');
                                    }}
                                    className="mt-6 text-primary font-bold uppercase tracking-widest hover:underline text-sm"
                                >
                                    Realizar outro saque
                                </button>
                            </motion.div>
                        )}
                    </AnimatePresence>
                </div>

                <div className="lg:col-span-2 space-y-6">
                    <div className="glass-card p-8 rounded-3xl space-y-6">
                        <h3 className="font-bold flex items-center gap-2 text-white">
                            <Info size={18} className="text-primary" />
                            Segurança AxonPay
                        </h3>
                        <ul className="space-y-4 text-sm text-muted-foreground">
                            <li className="flex gap-3">
                                <div className="w-1.5 h-1.5 rounded-full bg-primary shrink-0 mt-1.5" />
                                <p>Saques são liquidados através de nossos pools de criptomoedas para maior velocidade.</p>
                            </li>
                            <li className="flex gap-3">
                                <div className="w-1.5 h-1.5 rounded-full bg-primary shrink-0 mt-1.5" />
                                <p>Tempo médio de recebimento: <strong>5 a 30 minutos</strong> dependendo da carga da rede.</p>
                            </li>
                            <li className="flex gap-3">
                                <div className="w-1.5 h-1.5 rounded-full bg-primary shrink-0 mt-1.5" />
                                <p>Certifique-se de que sua chave PIX está correta. Transações na rede AxonPay são <strong>definitivas</strong>.</p>
                            </li>
                        </ul>
                    </div>

                    <div className="bg-gradient-to-br from-blue-600/10 to-indigo-600/10 border border-blue-500/20 p-8 rounded-3xl space-y-4">
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-xl bg-blue-500/20 flex items-center justify-center text-blue-400">
                                <Send size={18} />
                            </div>
                            <h4 className="font-bold text-blue-400">Precisa de Ajuda?</h4>
                        </div>
                        <p className="text-sm text-blue-200/50">Suporte especializado 24/7 para grandes retiradas acima de R$ 50.000,00.</p>
                        <button className="w-full py-3 bg-blue-600/20 border border-blue-600/30 rounded-xl text-blue-400 text-xs font-bold uppercase tracking-widest hover:bg-blue-600/30 transition-all">
                            Falar com Suporte
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}
