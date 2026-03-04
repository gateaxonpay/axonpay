'use client';

import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
    ArrowUpCircle,
    Info,
    CheckCircle2,
    Copy,
    RefreshCcw,
    Clock,
    QrCode as QrCodeIcon,
    AlertTriangle,
    ShieldCheck,
    Home,
    Ban
} from 'lucide-react';
import { cn, formatBRL } from '@/lib/utils';
import Decimal from 'decimal.js';
import { supabase } from '@/lib/supabase';
import { useRouter, useSearchParams } from 'next/navigation';

interface PixTransaction {
    id: string | null;
    external_id: string;
    tx_id: string;
    type: string;
    amount_original: number;
    amount_net: number;
    description: string;
    status: string;
    is_final: boolean;
    pix_copia_e_cola: string;
    qr_code_url: string;
    db_saved: boolean;
}

export default function DepositPage() {
    const [amount, setAmount] = useState('');
    const [isGenerating, setIsGenerating] = useState(false);
    const [transaction, setTransaction] = useState<PixTransaction | null>(null);
    const [copySuccess, setCopySuccess] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [isChecking, setIsChecking] = useState(false);
    const [penaltySeconds, setPenaltySeconds] = useState(0);
    const [penaltyMessage, setPenaltyMessage] = useState(false);
    const [recentTxs, setRecentTxs] = useState<any[]>([]);
    const [isLoadingTxs, setIsLoadingTxs] = useState(true);
    const [timeLeft, setTimeLeft] = useState<number | null>(null);
    const [taxRate, setTaxRate] = useState(0.30); // default, will be fetched from profile
    const router = useRouter();

    const fetchRecentTxs = async (uid: string) => {
        setIsLoadingTxs(true);
        try {
            // First, sync any pending status by calling our internal API
            const { data: pendingTxs } = await supabase
                .from('transactions')
                .select('external_id')
                .eq('user_id', uid)
                .eq('status', 'pending')
                .eq('type', 'deposit')
                .limit(3);

            if (pendingTxs && pendingTxs.length > 0) {
                await Promise.allSettled(
                    pendingTxs.map(tx => fetch(`/api/pix/status/${tx.external_id}`))
                );
            }

            // Now fetch the final transaction list
            const res = await fetch(`/api/user/transactions?userId=${uid}`);
            const data = await res.json();
            if (data.transactions) setRecentTxs(data.transactions);
        } catch (e) {
            console.error('Error fetching txs:', e);
        } finally {
            setIsLoadingTxs(false);
        }
    };

    const parsedAmount = parseFloat(amount) || 0;
    const netAmount = parsedAmount > 0
        ? new Decimal(parsedAmount).times(new Decimal(1).minus(taxRate)).toDecimalPlaces(2).toNumber()
        : 0;
    const taxAmount = parsedAmount > 0
        ? new Decimal(parsedAmount).times(taxRate).toDecimalPlaces(2).toNumber()
        : 0;

    const searchParams = useSearchParams();

    // Query Param loader
    useEffect(() => {
        const txId = searchParams.get('txId');
        if (txId) {
            async function loadTx() {
                const { data: tx, error } = await supabase
                    .from('transactions')
                    .select('*')
                    .eq('id', txId)
                    .single();

                if (tx && tx.status === 'pending') {
                    setTransaction({
                        id: tx.id,
                        external_id: tx.external_id,
                        tx_id: tx.id,
                        type: tx.type,
                        amount_original: tx.amount_original,
                        amount_net: tx.amount_net,
                        description: tx.description,
                        status: tx.status,
                        is_final: tx.is_final,
                        pix_copia_e_cola: tx.pix_copia_e_cola,
                        qr_code_url: tx.qr_code_url,
                        db_saved: true
                    });
                    setAmount(tx.amount_original.toString());

                    // Calculate time left based on created_at + 30 mins
                    const createdAt = new Date(tx.created_at).getTime();
                    const now = new Date().getTime();
                    const diffSeconds = Math.max(0, Math.floor((createdAt + (30 * 60 * 1000) - now) / 1000));
                    setTimeLeft(diffSeconds);
                }
            }
            loadTx();
        }
    }, [searchParams]);

    // Auth check + fetch tax_rate
    useEffect(() => {
        async function checkAuth() {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) {
                window.location.href = '/auth';
                return;
            }
            // Fetch user's tax_rate from profile (resilient if column doesn't exist)
            try {
                const { data: profile, error } = await supabase
                    .from('profiles')
                    .select('tax_rate')
                    .eq('id', user.id)
                    .single();

                if (!error && profile?.tax_rate != null) {
                    setTaxRate(profile.tax_rate);
                }
            } catch (e) {
                // Column might not exist yet, keep default
            }

            fetchRecentTxs(user.id);
        }
        checkAuth();
    }, []);;

    // Check payment status function
    const checkPaymentStatus = useCallback(async (): Promise<{ success: boolean, retryAfter?: boolean }> => {
        if (!transaction || transaction.is_final) return { success: false };

        try {
            const res = await fetch(`/api/pix/status/${transaction.external_id}`);
            const data = await res.json();

            if (res.ok && data.status) {
                // Save check time for persistence across page loads
                localStorage.setItem(`axonpay_last_check_${transaction.external_id}`, Date.now().toString());

                const isCompleted = data.status === 'completed';
                const isCancelled = data.status === 'cancelled';

                setTransaction(prev => {
                    if (!prev) return prev;
                    return {
                        ...prev,
                        status: data.status,
                        is_final: data.is_final || isCompleted || isCancelled,
                    };
                });

                return { success: isCompleted };
            } else if (data.error && data.error.toLowerCase().includes('rate limit')) {
                // Also store rate limit time
                localStorage.setItem(`axonpay_last_check_${transaction.external_id}`, Date.now().toString());
                return { success: false, retryAfter: true };
            }
        } catch (e) {
            console.error('Status check error:', e);
        }
        return { success: false };
    }, [transaction]);

    // Payment validity timer (30 mins)
    useEffect(() => {
        if (timeLeft === null || timeLeft <= 0 || !transaction || transaction.status !== 'pending') return;

        const timer = setInterval(() => {
            setTimeLeft(prev => {
                if (prev !== null && prev <= 1) {
                    clearInterval(timer);
                    return 0;
                }
                return prev !== null ? prev - 1 : null;
            });
        }, 1000);

        return () => clearInterval(timer);
    }, [timeLeft, transaction]);

    const formatTime = (seconds: number) => {
        const mins = Math.floor(seconds / 60);
        const secs = seconds % 60;
        return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    };

    // Penalty countdown timer
    useEffect(() => {
        if (penaltySeconds <= 0) return;

        const timer = setInterval(() => {
            setPenaltySeconds(prev => {
                if (prev <= 1) {
                    // Auto-check when penalty expires
                    setPenaltyMessage(false);
                    checkPaymentStatus();
                    return 0;
                }
                return prev - 1;
            });
        }, 1000);

        return () => clearInterval(timer);
    }, [penaltySeconds, checkPaymentStatus]);

    // Automated Polling every 61s (to safely respect MyCash 60s limit)
    const [nextCheckIn, setNextCheckIn] = useState(61);

    useEffect(() => {
        if (!transaction || transaction.is_final) return;

        const syncTimer = () => {
            const key = `axonpay_last_check_${transaction.external_id}`;
            const lastCheck = localStorage.getItem(key);
            const now = Date.now();

            if (lastCheck) {
                const elapsed = Math.floor((now - parseInt(lastCheck)) / 1000);
                if (elapsed < 61) {
                    setNextCheckIn(61 - elapsed);
                } else {
                    setNextCheckIn(0);
                    checkPaymentStatus();
                }
            } else {
                setNextCheckIn(0);
                checkPaymentStatus();
            }
        };

        syncTimer(); // Initial run on mount/load
        const interval = setInterval(syncTimer, 1000);
        return () => clearInterval(interval);
    }, [transaction?.external_id, transaction?.is_final, checkPaymentStatus]);

    // "Confirmar Pagamento" button handler
    const handleConfirmPayment = async () => {
        if (penaltySeconds > 0 || isChecking) return;

        setIsChecking(true);
        setPenaltyMessage(false);

        const result = await checkPaymentStatus();
        setIsChecking(false);

        if (result.success) {
            // Success! The API already handled the balance update
            setTimeout(() => {
                router.push('/');
            }, 2000);
        } else {
            // Payment not confirmed — apply 1 min penalty
            setPenaltySeconds(60);
            setPenaltyMessage(true);
        }

        setIsChecking(false);
    };

    const handleGenerate = async () => {
        if (!amount || parsedAmount < 20) {
            setError('Valor mínimo para depósito é R$ 20,00');
            return;
        }

        setIsGenerating(true);
        setError(null);

        try {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) {
                router.push('/auth');
                return;
            }

            const res = await fetch('/api/pix/generate', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    amount: parsedAmount,
                    user_id: user.id,
                }),
            });

            const data = await res.json();

            if (!res.ok) {
                throw new Error(data.error || 'Erro ao gerar PIX');
            }

            setTransaction(data as PixTransaction);
            // Refresh recent transactions list
            if (data.transaction) {
                setTransaction(data.transaction);
                setTimeLeft(30 * 60); // Reset timer to 30 mins
                fetchRecentTxs(user.id);
            }
        } catch (err: any) {
            setError(err.message || 'Erro ao gerar o pagamento.');
        } finally {
            setIsGenerating(false);
        }
    };

    const copyToClipboard = async () => {
        if (!transaction?.pix_copia_e_cola) return;
        try {
            await navigator.clipboard.writeText(transaction.pix_copia_e_cola);
            setCopySuccess(true);
            setTimeout(() => setCopySuccess(false), 2000);
        } catch {
            const input = document.createElement('textarea');
            input.value = transaction.pix_copia_e_cola;
            document.body.appendChild(input);
            input.select();
            document.execCommand('copy');
            document.body.removeChild(input);
            setCopySuccess(true);
            setTimeout(() => setCopySuccess(false), 2000);
        }
    };

    const resetTransaction = () => {
        setTransaction(null);
        setAmount('');
        setError(null);
        setPenaltySeconds(0);
        setPenaltyMessage(false);
    };

    return (
        <div className="max-w-4xl mx-auto px-0 md:px-0">
            <div className="flex items-center gap-3 mb-5 md:mb-10 px-1 md:px-0">
                <div className="p-2.5 md:p-3 bg-blue-500/10 border border-blue-500/20 rounded-xl md:rounded-2xl">
                    <ArrowUpCircle className="text-blue-400" size={22} />
                </div>
                <div>
                    <h1 className="text-lg md:text-3xl font-bold tracking-tight">Depósito PIX</h1>
                    <p className="text-muted-foreground text-[11px] md:text-sm">Rápido, seguro e irreversível</p>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-5 gap-5 md:gap-10">
                {/* Left: Form */}
                <div className="lg:col-span-3 space-y-4 md:space-y-8">
                    <div className="glass-card p-5 md:p-10 rounded-2xl md:rounded-3xl space-y-5 md:space-y-8 relative overflow-hidden group">
                        <div className="absolute top-0 right-0 w-64 h-64 bg-primary/5 rounded-full blur-[80px] -mr-32 -mt-32 hidden md:block" />

                        <div className="space-y-6">
                            <div className="space-y-2 md:space-y-3">
                                <label className="text-xs md:text-sm font-bold uppercase tracking-widest text-[#EAB308]">
                                    Valor do Depósito (R$)
                                </label>
                                <div className="relative group">
                                    <span className="absolute left-5 md:left-6 top-1/2 -translate-y-1/2 text-xl md:text-2xl font-bold opacity-30 group-focus-within:opacity-100 transition-opacity">
                                        R$
                                    </span>
                                    <input
                                        type="number"
                                        value={amount}
                                        onChange={(e) => {
                                            setAmount(e.target.value);
                                            setError(null);
                                        }}
                                        min="20"
                                        step="0.01"
                                        placeholder="20,00"
                                        disabled={!!transaction}
                                        className="w-full h-14 md:h-20 bg-white/5 border border-white/10 rounded-xl md:rounded-2xl pl-14 md:pl-16 pr-6 text-2xl md:text-3xl font-black outline-none focus:border-primary/50 focus:bg-white/10 transition-all disabled:opacity-50"
                                    />
                                </div>
                                <p className="text-[11px] text-muted-foreground ml-1">Mínimo: R$ 20,00</p>
                            </div>


                            {error && (
                                <div className="p-4 bg-red-500/10 border border-red-500/20 rounded-xl flex items-center gap-3 text-red-400 text-sm">
                                    <AlertTriangle size={18} />
                                    {error}
                                </div>
                            )}
                        </div>

                        {/* Tax Engine */}
                        <div className="p-4 md:p-6 bg-white/[0.03] rounded-xl md:rounded-2xl border border-white/5 space-y-3 md:space-y-4">
                            <div className="flex justify-between items-center text-xs md:text-sm">
                                <span className="text-muted-foreground flex items-center gap-2">
                                    <Info size={14} /> Taxa ({Math.round(taxRate * 100)}%)
                                    {taxRate < 0.30 && <span className="text-[9px] bg-primary/10 text-primary px-1.5 py-0.5 rounded font-bold">PREMIUM</span>}
                                </span>
                                <span className="font-mono text-red-400">-{formatBRL(taxAmount)}</span>
                            </div>
                            <div className="h-px bg-white/5" />
                            <div className="flex justify-between items-center font-bold">
                                <span className="text-sm md:text-lg">Crédito Líquido</span>
                                <span className="text-xl md:text-2xl text-[#EAB308]">{formatBRL(netAmount)}</span>
                            </div>
                        </div>

                        {!transaction ? (
                            <button
                                onClick={handleGenerate}
                                disabled={isGenerating || !amount || parsedAmount < 20}
                                className="w-full h-13 md:h-16 gold-gradient rounded-xl md:rounded-2xl font-bold md:font-black uppercase tracking-wider md:tracking-widest flex items-center justify-center gap-2 md:gap-3 active:scale-[0.97] md:hover:scale-[1.02] transition-all disabled:opacity-30 text-sm md:text-base"
                            >
                                {isGenerating ? (
                                    <RefreshCcw className="animate-spin" size={20} />
                                ) : (
                                    <QrCodeIcon size={20} />
                                )}
                                {isGenerating ? 'Gerando...' : 'Gerar PIX'}
                            </button>
                        ) : (
                            <button
                                onClick={resetTransaction}
                                className="w-full h-13 md:h-16 bg-white/5 border border-white/10 rounded-xl md:rounded-2xl font-bold text-muted-foreground active:bg-white/10 transition-all text-sm"
                            >
                                Nova Transação
                            </button>
                        )}
                    </div>

                    <div className="p-4 md:p-6 border border-yellow-600/20 bg-yellow-600/5 rounded-xl md:rounded-2xl flex gap-3 md:gap-4 items-start">
                        <AlertTriangle className="text-yellow-500 shrink-0" size={18} />
                        <p className="text-xs md:text-sm text-yellow-200/70 leading-relaxed">
                            <strong>Atenção:</strong> O valor será creditado após confirmação automática. Expira em 30 min.
                        </p>
                    </div>
                </div>

                {/* Right: QR Code / Status */}
                <div className="lg:col-span-2">
                    <AnimatePresence mode="wait">
                        {!transaction ? (
                            <motion.div
                                key="placeholder"
                                initial={{ opacity: 0 }}
                                animate={{ opacity: 1 }}
                                exit={{ opacity: 0 }}
                                className="h-full min-h-[300px] md:min-h-[400px] border-2 border-dashed border-white/10 rounded-3xl flex flex-col items-center justify-center p-6 md:p-10 text-center space-y-4"
                            >
                                <div className="w-16 h-16 md:w-20 md:h-20 rounded-full bg-white/5 flex items-center justify-center text-white/20">
                                    <QrCodeIcon size={32} />
                                </div>
                                <div className="px-4">
                                    <h3 className="font-bold text-lg md:text-xl opacity-40">Aguardando Valor</h3>
                                    <p className="text-xs md:text-sm text-muted-foreground opacity-30 max-w-[200px] mx-auto">
                                        Insira o valor e clique em gerar para ver o QR Code
                                    </p>
                                </div>
                            </motion.div>
                        ) : transaction.status === 'completed' ? (
                            /* CONFIRMED STATE */
                            <motion.div
                                key="confirmed"
                                initial={{ opacity: 0, scale: 0.9 }}
                                animate={{ opacity: 1, scale: 1 }}
                                className="glass-card p-10 rounded-3xl space-y-8 flex flex-col items-center text-center border-green-500/20"
                            >
                                <div className="w-28 h-28 rounded-full bg-green-500/10 border-2 border-green-500/30 flex items-center justify-center text-green-500 shadow-2xl shadow-green-500/20">
                                    <CheckCircle2 size={56} className="animate-bounce" />
                                </div>
                                <div className="space-y-2">
                                    <h3 className="text-3xl font-black italic uppercase tracking-tighter text-green-400">Pagamento Confirmado!</h3>
                                    <p className="text-muted-foreground text-sm">
                                        <span className="text-white font-bold">{formatBRL(transaction.amount_net)}</span> creditados no seu saldo.
                                    </p>
                                </div>
                                <div className="p-6 bg-green-500/5 rounded-2xl border border-green-500/10 w-full space-y-3">
                                    <div className="flex justify-between text-xs uppercase tracking-widest font-bold">
                                        <span className="text-muted-foreground">Valor Pago</span>
                                        <span className="text-white">{formatBRL(transaction.amount_original)}</span>
                                    </div>
                                    <div className="flex justify-between text-xs uppercase tracking-widest font-bold">
                                        <span className="text-muted-foreground">Creditado</span>
                                        <span className="text-green-400">{formatBRL(transaction.amount_net)}</span>
                                    </div>
                                    <div className="flex justify-between text-xs uppercase tracking-widest font-bold">
                                        <span className="text-muted-foreground">Status</span>
                                        <span className="text-green-400 flex items-center gap-1"><CheckCircle2 size={12} /> Finalizado</span>
                                    </div>
                                </div>
                                <button
                                    onClick={() => router.push('/')}
                                    className="w-full h-16 gold-gradient rounded-2xl font-black uppercase tracking-widest flex items-center justify-center gap-3 hover:scale-[1.02] transition-all"
                                >
                                    <Home size={20} />
                                    Ir para Dashboard
                                </button>
                            </motion.div>
                        ) : (
                            /* PENDING STATE — QR Code + Confirm Button */
                            <motion.div
                                key="qrcode"
                                initial={{ opacity: 0, scale: 0.95 }}
                                animate={{ opacity: 1, scale: 1 }}
                                className="glass-card p-10 rounded-3xl space-y-6 flex flex-col items-center"
                            >
                                <div className="text-center space-y-2">
                                    <div className="flex items-center justify-center gap-2 text-yellow-500 mb-2">
                                        <Clock size={16} className="animate-pulse" />
                                        <span className="text-xs font-bold uppercase tracking-widest">
                                            {timeLeft && timeLeft > 0 ? `Expira em ${formatTime(timeLeft)}` : 'Cobrança Expirada'}
                                        </span>
                                    </div>
                                    <h3 className="text-2xl font-black">{formatBRL(transaction.amount_original)}</h3>
                                </div>

                                {/* QR Code */}
                                <div className="relative p-6 bg-white rounded-3xl shadow-2xl shadow-white/5">
                                    <img
                                        src={transaction.qr_code_url}
                                        alt="PIX QR Code"
                                        className="w-56 h-56"
                                    />
                                </div>

                                {/* Copia e Cola */}
                                <div className="w-full space-y-3">
                                    <div className="space-y-2">
                                        <p className="text-xs font-bold uppercase text-muted-foreground ml-2">
                                            PIX Copia e Cola
                                        </p>
                                        <div className="relative">
                                            <textarea
                                                readOnly
                                                value={transaction.pix_copia_e_cola}
                                                rows={3}
                                                className="w-full bg-white/5 border border-white/10 rounded-xl py-3 pl-4 pr-12 text-xs font-mono resize-none"
                                            />
                                            <button
                                                onClick={copyToClipboard}
                                                className="absolute right-3 top-3 p-2 hover:bg-white/10 rounded-lg transition-all"
                                            >
                                                {copySuccess ? (
                                                    <CheckCircle2 size={20} className="text-green-500" />
                                                ) : (
                                                    <Copy size={20} className="text-muted-foreground" />
                                                )}
                                            </button>
                                        </div>
                                        {copySuccess && (
                                            <p className="text-xs text-green-400 ml-2">Copiado!</p>
                                        )}
                                    </div>

                                    <button
                                        onClick={copyToClipboard}
                                        className="w-full py-3 bg-primary/10 border border-primary/20 rounded-xl text-primary text-sm font-bold uppercase tracking-widest hover:bg-primary/20 transition-all flex items-center justify-center gap-2"
                                    >
                                        <Copy size={16} />
                                        Copiar Código PIX
                                    </button>
                                </div>

                                {transaction.status === 'pending' && (
                                    <div className="w-full flex flex-col items-center gap-4">
                                        <div className="flex items-center gap-3 py-2 px-5 bg-white/5 rounded-full border border-white/10 text-[10px] font-black uppercase tracking-widest text-muted-foreground/60 shadow-lg">
                                            <RefreshCcw size={12} className="animate-spin text-primary" />
                                            Sincronizando em {nextCheckIn}s
                                        </div>
                                        <p className="text-[10px] text-muted-foreground/40 text-center max-w-[200px]">
                                            O sistema verifica o pagamento automaticamente a cada minuto.
                                        </p>
                                    </div>
                                )}
                            </motion.div>
                        )}
                    </AnimatePresence>
                </div>
            </div>

            {/* RECENT TRANSACTIONS / FLOW */}
            <div className="mt-20 space-y-8 animate-in fade-in slide-in-from-bottom-5 duration-700">
                <div className="flex items-center justify-between">
                    <div>
                        <h2 className="text-xl font-black italic uppercase tracking-tighter">Fluxo de Protocolos Recentes</h2>
                        <p className="text-[10px] uppercase font-black tracking-widest text-muted-foreground/60">Últimos 5 depósitos registrados</p>
                    </div>
                    <button
                        onClick={async () => {
                            const { data: { user } } = await supabase.auth.getUser();
                            if (user) fetchRecentTxs(user.id);
                        }}
                        className="p-2 bg-white/5 rounded-xl border border-white/10 hover:bg-white/10 transition-all"
                    >
                        <RefreshCcw size={16} className={isLoadingTxs ? "animate-spin text-primary" : "text-muted-foreground"} />
                    </button>
                </div>

                <div className="glass-card rounded-[40px] overflow-hidden border-white/5 shadow-2xl">
                    <div className="overflow-x-auto">
                        <table className="w-full text-left">
                            <thead>
                                <tr className="border-b border-white/5 bg-white/[0.01]">
                                    <th className="px-8 py-4 text-[10px] font-black uppercase tracking-widest text-muted-foreground/40">ID Protocolo</th>
                                    <th className="px-8 py-4 text-[10px] font-black uppercase tracking-widest text-muted-foreground/40">Status</th>
                                    <th className="px-8 py-4 text-[10px] font-black uppercase tracking-widest text-muted-foreground/40 text-right">Valor Líquido</th>
                                    <th className="px-8 py-4 text-[10px] font-black uppercase tracking-widest text-muted-foreground/40 text-right">Ação</th>
                                </tr>
                            </thead>
                            <tbody>
                                {isLoadingTxs ? (
                                    <tr>
                                        <td colSpan={4} className="px-8 py-10 text-center animate-pulse">
                                            <p className="text-[10px] font-black uppercase tracking-[0.5em] text-muted-foreground">Sincronizando...</p>
                                        </td>
                                    </tr>
                                ) : recentTxs.length === 0 ? (
                                    <tr>
                                        <td colSpan={4} className="px-8 py-10 text-center">
                                            <p className="text-[10px] font-black uppercase tracking-[0.5em] text-muted-foreground/30 italic">Nenhum protocolo detectado.</p>
                                        </td>
                                    </tr>
                                ) : (
                                    recentTxs.filter(t => t.type === 'deposit').slice(0, 5).map((tx) => (
                                        <tr key={tx.id} className="border-b border-white/5 hover:bg-white/[0.02] transition-colors group">
                                            <td className="px-4 md:px-8 py-5 font-mono text-[10px] text-muted-foreground/60 group-hover:text-white transition-colors">#{tx.id.slice(0, 10)}...</td>
                                            <td className="px-4 md:px-8 py-5">
                                                {tx.status === 'completed' ? (
                                                    <span className="text-[9px] font-black uppercase tracking-widest text-green-500 bg-green-500/10 px-3 py-1 rounded-lg border border-green-500/20">Pago</span>
                                                ) : tx.status === 'pending' ? (
                                                    <span className="text-[9px] font-black uppercase tracking-widest text-yellow-500 bg-yellow-500/10 px-3 py-1 rounded-lg border border-yellow-500/20">Pendente</span>
                                                ) : (
                                                    <span className="text-[9px] font-black uppercase tracking-widest text-red-500 bg-red-500/10 px-3 py-1 rounded-lg border border-red-500/20">Abortado</span>
                                                )}
                                            </td>
                                            <td className="px-4 md:px-8 py-5 text-right font-black italic text-sm text-white">{formatBRL(tx.amount_net)}</td>
                                            <td className="px-4 md:px-8 py-5 text-right flex items-center justify-end gap-2">
                                                {tx.status === 'pending' && (
                                                    <>
                                                        <button
                                                            onClick={() => {
                                                                setTransaction({
                                                                    id: tx.id,
                                                                    external_id: tx.external_id,
                                                                    tx_id: tx.id,
                                                                    type: tx.type,
                                                                    amount_original: tx.amount_original,
                                                                    amount_net: tx.amount_net,
                                                                    description: tx.description,
                                                                    status: tx.status,
                                                                    is_final: tx.is_final,
                                                                    pix_copia_e_cola: tx.pix_copia_e_cola,
                                                                    qr_code_url: tx.qr_code_url,
                                                                    db_saved: true
                                                                });
                                                                window.scrollTo({ top: 0, behavior: 'smooth' });
                                                            }}
                                                            className="p-2 bg-blue-500/10 hover:bg-blue-500/20 rounded-lg text-blue-400 text-[8px] font-black uppercase tracking-widest transition-all"
                                                        >
                                                            Abrir
                                                        </button>
                                                        <button
                                                            onClick={async () => {
                                                                try {
                                                                    const res = await fetch(`/api/pix/status/${tx.external_id}`);
                                                                    const data = await res.json();
                                                                    if (data.status === 'completed') {
                                                                        alert('Pagamento confirmado e saldo atualizado!');
                                                                        const { data: { user } } = await supabase.auth.getUser();
                                                                        if (user) fetchRecentTxs(user.id);
                                                                    } else {
                                                                        alert('Pagamento ainda não detectado.');
                                                                    }
                                                                } catch (e) {
                                                                    alert('Erro ao verificar status.');
                                                                }
                                                            }}
                                                            className="p-2 bg-primary/10 hover:bg-primary/20 rounded-lg text-primary text-[8px] font-black uppercase tracking-widest transition-all"
                                                        >
                                                            Verificar
                                                        </button>
                                                    </>
                                                )}
                                            </td>
                                        </tr>
                                    ))
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>
        </div>
    );
}
