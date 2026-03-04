'use client';

import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
    ArrowDownCircle,
    Wallet,
    Info,
    ShieldCheck,
    ArrowRight,
    AlertTriangle,
    Loader2,
    RefreshCcw,
    CheckCircle2,
    Key,
    Clock,
    Ban,
    Home
} from 'lucide-react';
import { cn, formatBRL } from '@/lib/utils';
import { supabase } from '@/lib/supabase';
import { useRouter, useSearchParams } from 'next/navigation';

interface SavedPixKey {
    id: string;
    pix_type: string;
    pix_key: string;
}

interface WithdrawTransaction {
    id: string;
    external_id: string;
    status: string;
    is_final: boolean;
    amount_original: number;
    amount_net: number;
    pix_copia_e_cola: string;
}

export default function WithdrawPage() {
    const [balance, setBalance] = useState(0);
    const [pixType, setPixType] = useState('CPF');
    const [pixKey, setPixKey] = useState('');
    const [amount, setAmount] = useState('');
    const [savedKeys, setSavedKeys] = useState<SavedPixKey[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isProcessing, setIsProcessing] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const router = useRouter();

    // Polling state
    const [withdrawTx, setWithdrawTx] = useState<WithdrawTransaction | null>(null);
    const [isChecking, setIsChecking] = useState(false);
    const [penaltySeconds, setPenaltySeconds] = useState(0);
    const [penaltyMessage, setPenaltyMessage] = useState(false);
    const searchParams = useSearchParams();

    // Load existing withdraw transaction from URL query param
    useEffect(() => {
        const txId = searchParams.get('txId');
        if (txId) {
            async function loadTx() {
                const { data: tx } = await supabase
                    .from('transactions')
                    .select('*')
                    .eq('id', txId)
                    .single();

                if (tx && tx.type === 'withdraw' && !tx.is_final) {
                    setWithdrawTx({
                        id: tx.id,
                        external_id: tx.external_id,
                        status: tx.status,
                        is_final: tx.is_final,
                        amount_original: tx.amount_original,
                        amount_net: tx.amount_net,
                        pix_copia_e_cola: tx.pix_copia_e_cola || '',
                    });
                    setAmount(tx.amount_net.toString());
                }
            }
            loadTx();
        }
    }, [searchParams]);

    useEffect(() => {
        async function loadData() {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) {
                router.push('/auth');
                return;
            }

            // Fetch balance
            const { data: profile } = await supabase
                .from('profiles')
                .select('balance')
                .eq('id', user.id)
                .single();

            if (profile) {
                setBalance(profile.balance || 0);
            }

            // Fetch saved keys
            const { data: keys } = await supabase
                .from('user_pix_keys')
                .select('*')
                .eq('user_id', user.id)
                .order('created_at', { ascending: false });

            if (keys) {
                setSavedKeys(keys);
                if (keys.length > 0) {
                    setPixKey(keys[0].pix_key);
                    setPixType(keys[0].pix_type);
                }
            }

            setIsLoading(false);
        }
        loadData();
    }, []);

    const requestedValue = parseFloat(amount) || 0;
    const netValue = requestedValue;

    // Check withdraw status via the existing status API
    const checkWithdrawStatus = useCallback(async (): Promise<{ success: boolean, retryAfter?: boolean }> => {
        if (!withdrawTx || withdrawTx.is_final) return { success: false };

        try {
            const res = await fetch(`/api/pix/status/${withdrawTx.external_id}`);
            const data = await res.json();

            if (res.ok && data.status) {
                // Save check time for persistence
                localStorage.setItem(`axonpay_last_withdraw_check_${withdrawTx.external_id}`, Date.now().toString());

                const isCompleted = data.status === 'completed';
                const isFailed = data.status === 'cancelled' || data.status === 'failed';

                setWithdrawTx(prev => {
                    if (!prev) return prev;
                    return {
                        ...prev,
                        status: data.status,
                        is_final: data.is_final || isCompleted || isFailed,
                    };
                });

                return { success: isCompleted };
            } else if (data.error && data.error.toLowerCase().includes('rate limit')) {
                // Save rate limit time
                localStorage.setItem(`axonpay_last_withdraw_check_${withdrawTx.external_id}`, Date.now().toString());
                return { success: false, retryAfter: true };
            }
        } catch (e) {
            console.error('Withdraw status check error:', e);
        }
        return { success: false };
    }, [withdrawTx]);

    // Automated Polling every 61s
    const [nextCheckIn, setNextCheckIn] = useState(61);

    useEffect(() => {
        if (!withdrawTx || withdrawTx.is_final) return;

        const syncTimer = () => {
            const key = `axonpay_last_withdraw_check_${withdrawTx.external_id}`;
            const lastCheck = localStorage.getItem(key);
            const now = Date.now();

            if (lastCheck) {
                const elapsed = Math.floor((now - parseInt(lastCheck)) / 1000);
                if (elapsed < 61) {
                    setNextCheckIn(61 - elapsed);
                } else {
                    setNextCheckIn(0);
                    checkWithdrawStatus();
                }
            } else {
                setNextCheckIn(0);
                checkWithdrawStatus();
            }
        };

        syncTimer(); // Initial run on mount/load
        const interval = setInterval(syncTimer, 1000);
        return () => clearInterval(interval);
    }, [withdrawTx?.external_id, withdrawTx?.is_final, checkWithdrawStatus]);

    // Manual "Confirmar Saque" button handler
    const handleConfirmWithdraw = async () => {
        if (penaltySeconds > 0 || isChecking) return;

        setIsChecking(true);
        setPenaltyMessage(false);

        const result = await checkWithdrawStatus();
        setIsChecking(false);

        if (!result.success) {
            // Apply a short penalty or inform about rate limit
            setPenaltySeconds(60);
            setPenaltyMessage(true);
        }
    };

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
            setError('Selecione ou preencha a chave PIX.');
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
                    pix_key: pixKey.replace(/[^\d+a-zA-Z-@.]/g, ''),
                    user_id: user?.id
                })
            });

            const data = await res.json();

            if (!res.ok) {
                throw new Error(data.error || 'Erro ao processar saque');
            }

            // Save the transaction for polling
            if (data.transaction) {
                setWithdrawTx({
                    id: data.transaction.id,
                    external_id: data.transaction.external_id,
                    status: data.transaction.status || 'processing',
                    is_final: false,
                    amount_original: data.transaction.amount_original,
                    amount_net: data.transaction.amount_net,
                    pix_copia_e_cola: data.transaction.pix_copia_e_cola || pixKey,
                });
                // Immediate check skip to start polling cycle
                setNextCheckIn(61);
            }

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

    // Determine which view to show
    const hasActiveWithdraw = withdrawTx !== null;
    const isWithdrawCompleted = withdrawTx?.status === 'completed';
    const isWithdrawFailed = withdrawTx?.status === 'cancelled' || withdrawTx?.status === 'failed';
    const isWithdrawProcessing = hasActiveWithdraw && !isWithdrawCompleted && !isWithdrawFailed;

    return (
        <div className="max-w-4xl mx-auto px-0 md:px-0">
            <div className="flex items-center gap-3 mb-5 md:mb-10 px-1 md:px-0">
                <div className="p-2.5 md:p-3 bg-red-500/10 border border-red-500/20 rounded-xl md:rounded-2xl">
                    <ArrowDownCircle className="text-red-400" size={22} />
                </div>
                <div>
                    <h1 className="text-lg md:text-3xl font-bold tracking-tight text-white">Saque PIX</h1>
                    <p className="text-muted-foreground text-[11px] md:text-sm">Resgate de saldo via PIX</p>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-5 gap-5 md:gap-10">
                <div className="lg:col-span-3 space-y-4 md:space-y-8">
                    <AnimatePresence mode="wait">
                        {!hasActiveWithdraw ? (
                            /* FORM STATE — no active withdraw */
                            <motion.div
                                key="form"
                                initial={{ opacity: 0, x: -20 }}
                                animate={{ opacity: 1, x: 0 }}
                                exit={{ opacity: 0, scale: 0.9 }}
                                className="glass-card p-5 md:p-10 rounded-2xl md:rounded-[40px] border-white/5 space-y-5 md:space-y-8"
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

                                    <div className="space-y-3 md:space-y-4">
                                        <label className="text-[10px] font-bold uppercase tracking-widest text-[#EAB308] ml-1 md:ml-2">Total a Deduzir (R$)</label>
                                        <div className="relative group">
                                            <span className="absolute left-5 md:left-6 top-1/2 -translate-y-1/2 text-lg md:text-2xl font-bold opacity-30 group-focus-within:opacity-100 transition-opacity">R$</span>
                                            <input
                                                type="number"
                                                value={amount}
                                                onChange={(e) => {
                                                    setAmount(e.target.value);
                                                    setError(null);
                                                }}
                                                placeholder="0,00"
                                                className="w-full h-14 md:h-20 bg-white/5 border border-white/10 rounded-xl md:rounded-[28px] pl-12 md:pl-16 pr-16 md:pr-24 text-2xl md:text-3xl font-black outline-none focus:border-red-500/50 focus:bg-white/10 transition-all font-mono shadow-inner"
                                            />
                                            <button
                                                onClick={() => setAmount(balance.toString())}
                                                className="absolute right-3 md:right-6 top-1/2 -translate-y-1/2 px-2.5 md:px-4 py-1.5 md:py-2 bg-white/10 active:bg-white/20 rounded-lg md:rounded-xl text-[9px] md:text-xs font-bold uppercase tracking-widest transition-all text-white/50 active:text-white"
                                            >
                                                MÁX
                                            </button>
                                        </div>
                                    </div>

                                    <div className="space-y-6 pt-4 border-t border-white/5">
                                        <div className="space-y-3">
                                            <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground/50 ml-2">Escolha uma Chave Salva</label>
                                            <div className="grid grid-cols-1 gap-3">
                                                {savedKeys.length === 0 ? (
                                                    <button
                                                        onClick={() => router.push('/pix-key')}
                                                        className="p-6 border-2 border-dashed border-white/5 rounded-3xl text-center hover:bg-white/5 transition-all group"
                                                    >
                                                        <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground group-hover:text-primary transition-colors">Nenhuma chave cadastrada. Clique para cadastrar.</p>
                                                    </button>
                                                ) : (
                                                    savedKeys.map((k) => (
                                                        <button
                                                            key={k.id}
                                                            onClick={() => {
                                                                setPixKey(k.pix_key);
                                                                setPixType(k.pix_type);
                                                            }}
                                                            className={cn(
                                                                "p-4 rounded-2xl border text-left transition-all flex items-center justify-between",
                                                                pixKey === k.pix_key
                                                                    ? "bg-primary/10 border-primary/40"
                                                                    : "bg-white/5 border-white/5 hover:bg-white/10"
                                                            )}
                                                        >
                                                            <div className="flex items-center gap-4">
                                                                <div className={cn(
                                                                    "w-10 h-10 rounded-xl flex items-center justify-center transition-colors",
                                                                    pixKey === k.pix_key ? "bg-primary text-black" : "bg-white/10 text-muted-foreground"
                                                                )}>
                                                                    <Key size={18} />
                                                                </div>
                                                                <div>
                                                                    <p className="text-[8px] font-black uppercase tracking-widest text-muted-foreground/50">{k.pix_type}</p>
                                                                    <p className="text-xs font-bold text-white font-mono">{k.pix_key}</p>
                                                                </div>
                                                            </div>
                                                            {pixKey === k.pix_key && (
                                                                <CheckCircle2 size={18} className="text-primary" />
                                                            )}
                                                        </button>
                                                    ))
                                                )}
                                            </div>
                                        </div>
                                    </div>

                                    {/* Tax Engine Visual */}
                                    <div className="p-6 bg-white/[0.03] rounded-3xl border border-white/5 space-y-4 shadow-inner">
                                        <div className="flex justify-between items-center text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
                                            <span className="flex items-center gap-2">
                                                <Info size={12} /> Taxa de Saque
                                            </span>
                                            <span className="text-green-400">ISENTO (0%)</span>
                                        </div>
                                        <div className="h-px bg-white/5" />
                                        <div className="flex justify-between items-center">
                                            <span className="text-xs font-black uppercase tracking-widest text-[#EAB308]">Valor a Receber (100%)</span>
                                            <span className="text-2xl font-black text-white">{formatBRL(netValue)}</span>
                                        </div>
                                    </div>

                                    {error && (
                                        <div className="p-4 bg-red-500/10 border border-red-500/20 rounded-2xl flex items-center gap-3 text-red-500 font-bold text-xs uppercase tracking-widest shadow-lg shadow-red-900/10">
                                            <AlertTriangle size={18} />
                                            {error}
                                        </div>
                                    )}

                                    <button
                                        onClick={handleWithdraw}
                                        disabled={isProcessing || !amount || requestedValue <= 0 || requestedValue > balance}
                                        className="w-full h-14 md:h-20 bg-gradient-to-r from-red-600 to-orange-600 rounded-xl md:rounded-[28px] font-bold md:font-black uppercase tracking-wider md:tracking-[0.2em] flex items-center justify-center gap-2 md:gap-3 active:scale-[0.97] md:hover:scale-[1.02] transition-all shadow-2xl shadow-red-900/30 disabled:opacity-30 disabled:grayscale text-sm md:text-base"
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
                        ) : isWithdrawCompleted ? (
                            /* COMPLETED STATE */
                            <motion.div
                                key="completed"
                                initial={{ opacity: 0, scale: 0.9 }}
                                animate={{ opacity: 1, scale: 1 }}
                                className="glass-card p-10 md:p-12 rounded-[40px] text-center space-y-8 flex flex-col items-center justify-center min-h-[500px] border-green-500/10"
                            >
                                <div className="w-32 h-32 rounded-full bg-green-500/10 border-2 border-green-500/20 flex items-center justify-center text-green-500 mb-4 shadow-2xl shadow-green-500/20">
                                    <CheckCircle2 size={64} className="animate-bounce" />
                                </div>
                                <div className="space-y-4">
                                    <h2 className="text-2xl md:text-4xl font-black italic tracking-tighter uppercase text-green-400">Saque Confirmado!</h2>
                                    <p className="text-muted-foreground text-base md:text-lg max-w-[320px] mx-auto leading-relaxed">
                                        <span className="text-white font-bold">{formatBRL(withdrawTx.amount_net)}</span> enviados com sucesso para <span className="text-white font-mono break-all">{withdrawTx.pix_copia_e_cola}</span>.
                                    </p>
                                </div>

                                <div className="w-full p-6 md:p-8 bg-green-500/5 rounded-3xl border border-green-500/10 space-y-3 max-w-sm">
                                    <div className="flex justify-between text-xs uppercase tracking-widest font-bold">
                                        <span className="text-muted-foreground">Valor Solicitado</span>
                                        <span className="text-white">{formatBRL(withdrawTx.amount_net)}</span>
                                    </div>
                                    <div className="flex justify-between text-xs uppercase tracking-widest font-bold">
                                        <span className="text-muted-foreground">Status</span>
                                        <span className="text-green-400 flex items-center gap-1"><CheckCircle2 size={12} /> Finalizado</span>
                                    </div>
                                </div>

                                <button
                                    onClick={() => router.push('/')}
                                    className="w-full max-w-sm h-16 gold-gradient rounded-2xl font-black uppercase tracking-widest flex items-center justify-center gap-3 hover:scale-[1.02] transition-all"
                                >
                                    <Home size={20} />
                                    Ir para Dashboard
                                </button>
                            </motion.div>
                        ) : isWithdrawFailed ? (
                            /* FAILED STATE */
                            <motion.div
                                key="failed"
                                initial={{ opacity: 0, scale: 0.9 }}
                                animate={{ opacity: 1, scale: 1 }}
                                className="glass-card p-10 md:p-12 rounded-[40px] text-center space-y-8 flex flex-col items-center justify-center min-h-[500px] border-red-500/10"
                            >
                                <div className="w-32 h-32 rounded-full bg-red-500/10 border-2 border-red-500/20 flex items-center justify-center text-red-500 mb-4 shadow-2xl shadow-red-500/20">
                                    <AlertTriangle size={64} />
                                </div>
                                <div className="space-y-4">
                                    <h2 className="text-2xl md:text-4xl font-black italic tracking-tighter uppercase text-red-400">Saque Falhou</h2>
                                    <p className="text-muted-foreground text-base md:text-lg max-w-[320px] mx-auto leading-relaxed">
                                        Detectamos um problema no processamento do seu saque. O valor retornará ao seu saldo caso não seja liquidado pela MyCash.
                                    </p>
                                </div>
                                <button
                                    onClick={() => {
                                        setWithdrawTx(null);
                                        setAmount('');
                                        setNextCheckIn(61);
                                    }}
                                    className="px-8 py-4 bg-white/5 border border-white/10 rounded-2xl text-white font-black uppercase tracking-widest text-xs"
                                >
                                    Tentar Novamente
                                </button>
                            </motion.div>
                        ) : (
                            /* PROCESSING STATE — polling */
                            <motion.div
                                key="processing"
                                initial={{ opacity: 0, scale: 0.9 }}
                                animate={{ opacity: 1, scale: 1 }}
                                className="glass-card p-10 md:p-12 rounded-[40px] text-center space-y-8 flex flex-col items-center justify-center min-h-[500px] border-blue-500/10"
                            >
                                <div className="w-32 h-32 rounded-full bg-blue-500/10 border-2 border-blue-500/20 flex items-center justify-center text-blue-400 mb-4 shadow-2xl shadow-blue-500/20">
                                    <RefreshCcw size={56} className="animate-spin" />
                                </div>
                                <div className="space-y-4">
                                    <h2 className="text-2xl md:text-4xl font-black italic tracking-tighter uppercase">Saque em Processamento</h2>
                                    <p className="text-muted-foreground text-base md:text-lg max-w-[340px] mx-auto leading-relaxed">
                                        Liquidação de <span className="text-white font-bold">{formatBRL(withdrawTx!.amount_net)}</span> enviada para <span className="text-white font-mono break-all">{withdrawTx!.pix_copia_e_cola}</span>.
                                    </p>
                                </div>

                                <div className="w-full max-w-sm p-6 md:p-8 bg-white/5 rounded-3xl border border-white/5 space-y-4">
                                    <div className="flex justify-between items-center text-[9px] md:text-[10px] font-black uppercase tracking-widest">
                                        <span className="text-muted-foreground">Status do Protocolo</span>
                                        <span className="text-blue-400 flex items-center gap-1 uppercase">
                                            <RefreshCcw size={10} className="animate-spin" /> {withdrawTx?.status || 'PROCESSANDO'}
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

                                {isWithdrawProcessing && (
                                    <div className="w-full flex flex-col items-center gap-4">
                                        <div className="flex items-center gap-3 py-2 px-5 bg-white/5 rounded-full border border-white/10 text-[10px] font-black uppercase tracking-widest text-muted-foreground/60 shadow-lg">
                                            <RefreshCcw size={12} className="animate-spin text-blue-400" />
                                            Sincronizando em {nextCheckIn}s
                                        </div>
                                        <p className="text-[10px] text-muted-foreground/40 text-center max-w-[240px]">
                                            O sistema detectará o fechamento automático da transação via MyCash.
                                        </p>
                                    </div>
                                )}

                                <button
                                    onClick={() => {
                                        setWithdrawTx(null);
                                        setAmount('');
                                        setNextCheckIn(61);
                                    }}
                                    className="mt-2 text-primary font-black uppercase tracking-[0.2em] hover:underline text-xs"
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
                </div>
            </div>
        </div>
    );
}
