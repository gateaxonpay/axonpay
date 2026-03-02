'use client';

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
    ArrowUpCircle,
    Info,
    CheckCircle2,
    Copy,
    RefreshCcw,
    Clock,
    QrCode as QrCodeIcon,
    AlertTriangle
} from 'lucide-react';
import { cn, formatBRL } from '@/lib/utils';
import Decimal from 'decimal.js';
import { supabase } from '@/lib/supabase';
import { useRouter } from 'next/navigation';

// Shape of what our API returns
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
    const [description, setDescription] = useState('Pagamento');
    const [isGenerating, setIsGenerating] = useState(false);
    const [transaction, setTransaction] = useState<PixTransaction | null>(null);
    const [copySuccess, setCopySuccess] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const router = useRouter();

    // Real-time tax calculation
    const parsedAmount = parseFloat(amount) || 0;
    const netAmount = parsedAmount > 0
        ? new Decimal(parsedAmount).times(0.7).toDecimalPlaces(2).toNumber()
        : 0;
    const taxAmount = parsedAmount > 0
        ? new Decimal(parsedAmount).times(0.3).toDecimalPlaces(2).toNumber()
        : 0;

    // Auth check
    useEffect(() => {
        async function checkAuth() {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) {
                window.location.href = '/auth';
            }
        }
        checkAuth();
    }, []);

    // Polling: check MyCash status every 60s until is_final
    useEffect(() => {
        let interval: NodeJS.Timeout;

        if (transaction && !transaction.is_final) {
            interval = setInterval(async () => {
                try {
                    // Use external_id (MyCash ID) for status check
                    const res = await fetch(`/api/pix/status/${transaction.external_id}`);
                    const data = await res.json();

                    if (res.ok && data.status) {
                        setTransaction(prev => {
                            if (!prev) return prev;
                            return {
                                ...prev,
                                status: data.status,
                                is_final: data.is_final,
                            };
                        });
                    }
                } catch (e) {
                    console.error('Polling error:', e);
                }
            }, 60000); // 60 seconds — rate-limit safe
        }

        return () => {
            if (interval) clearInterval(interval);
        };
    }, [transaction]);

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
            const userId = user.id;

            const res = await fetch('/api/pix/generate', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    amount: parsedAmount,
                    description: description || 'Depósito',
                    user_id: userId,
                }),
            });

            const data = await res.json();

            if (!res.ok) {
                throw new Error(data.error || 'Erro ao gerar PIX');
            }

            // data = { id, external_id, pix_copia_e_cola, qr_code_url, status, ... }
            setTransaction(data as PixTransaction);
        } catch (err: any) {
            setError(err.message || 'Erro ao gerar o PIX. Tente novamente.');
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
            // Fallback
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
        setDescription('Pagamento');
        setError(null);
    };

    return (
        <div className="max-w-4xl mx-auto pb-20">
            <div className="flex items-center gap-4 mb-10">
                <div className="p-3 bg-blue-500/10 border border-blue-500/20 rounded-2xl">
                    <ArrowUpCircle className="text-blue-400" size={28} />
                </div>
                <div>
                    <h1 className="text-3xl font-bold tracking-tight">Gerar Depósito PIX</h1>
                    <p className="text-muted-foreground mt-1">Transações rápidas, seguras e irreversíveis.</p>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-5 gap-10">
                {/* Left: Form */}
                <div className="lg:col-span-3 space-y-8">
                    <div className="glass-card p-10 rounded-3xl space-y-8 relative overflow-hidden group">
                        <div className="absolute top-0 right-0 w-64 h-64 bg-primary/5 rounded-full blur-[80px] -mr-32 -mt-32" />

                        <div className="space-y-6">
                            <div className="space-y-3">
                                <label className="text-sm font-bold uppercase tracking-widest text-[#EAB308]">
                                    Valor do Depósito (R$)
                                </label>
                                <div className="relative group">
                                    <span className="absolute left-6 top-1/2 -translate-y-1/2 text-2xl font-bold opacity-30 group-focus-within:opacity-100 transition-opacity">
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
                                        className="w-full h-20 bg-white/5 border border-white/10 rounded-2xl pl-16 pr-6 text-3xl font-black outline-none focus:border-primary/50 focus:bg-white/10 transition-all disabled:opacity-50"
                                    />
                                </div>
                                <p className="text-xs text-muted-foreground ml-2">Mínimo: R$ 20,00</p>
                            </div>

                            <div className="space-y-3">
                                <label className="text-sm font-bold uppercase tracking-widest text-muted-foreground">
                                    Descrição (Opcional)
                                </label>
                                <input
                                    type="text"
                                    value={description}
                                    onChange={(e) => setDescription(e.target.value)}
                                    placeholder="Pagamento"
                                    disabled={!!transaction}
                                    className="w-full h-14 bg-white/5 border border-white/10 rounded-xl px-6 outline-none focus:border-primary/30 transition-all disabled:opacity-50"
                                />
                            </div>

                            {error && (
                                <div className="p-4 bg-red-500/10 border border-red-500/20 rounded-xl flex items-center gap-3 text-red-400 text-sm">
                                    <AlertTriangle size={18} />
                                    {error}
                                </div>
                            )}
                        </div>

                        {/* Tax Engine — Real-time */}
                        <div className="p-6 bg-white/[0.03] rounded-2xl border border-white/5 space-y-4">
                            <div className="flex justify-between items-center text-sm">
                                <span className="text-muted-foreground flex items-center gap-2">
                                    <Info size={14} /> Taxa Operacional (30%)
                                </span>
                                <span className="font-mono text-red-400">-{formatBRL(taxAmount)}</span>
                            </div>
                            <div className="h-px bg-white/5" />
                            <div className="flex justify-between items-center font-bold">
                                <span className="text-lg">Crédito Líquido</span>
                                <span className="text-2xl text-[#EAB308]">{formatBRL(netAmount)}</span>
                            </div>
                        </div>

                        {!transaction ? (
                            <button
                                onClick={handleGenerate}
                                disabled={isGenerating || !amount || parsedAmount < 20}
                                className="w-full h-16 gold-gradient rounded-2xl font-black uppercase tracking-widest flex items-center justify-center gap-3 hover:scale-[1.02] active:scale-100 transition-all disabled:opacity-30 disabled:hover:scale-100"
                            >
                                {isGenerating ? (
                                    <RefreshCcw className="animate-spin" size={24} />
                                ) : (
                                    <QrCodeIcon size={24} />
                                )}
                                {isGenerating ? 'Gerando...' : 'Gerar Cobrança PIX'}
                            </button>
                        ) : (
                            <button
                                onClick={resetTransaction}
                                className="w-full h-16 bg-white/5 border border-white/10 rounded-2xl font-bold text-muted-foreground hover:bg-white/10 transition-all"
                            >
                                Nova Transação
                            </button>
                        )}
                    </div>

                    <div className="p-6 border border-yellow-600/20 bg-yellow-600/5 rounded-2xl flex gap-4 items-start">
                        <AlertTriangle className="text-yellow-500 shrink-0" size={24} />
                        <p className="text-sm text-yellow-200/70 leading-relaxed">
                            <strong>Atenção:</strong> O valor será creditado após a confirmação automática na rede PIX.
                            O processo geralmente leva menos de 10 segundos. O QR Code expira em 60 minutos.
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
                                className="h-full min-h-[400px] border-2 border-dashed border-white/10 rounded-3xl flex flex-col items-center justify-center p-10 text-center space-y-4"
                            >
                                <div className="w-20 h-20 rounded-full bg-white/5 flex items-center justify-center text-white/20">
                                    <QrCodeIcon size={40} />
                                </div>
                                <div>
                                    <h3 className="font-bold text-xl opacity-40">Aguardando Valor</h3>
                                    <p className="text-sm text-muted-foreground opacity-30 max-w-[200px] mx-auto">
                                        Insira o valor e clique em gerar para ver o QR Code
                                    </p>
                                </div>
                            </motion.div>
                        ) : (
                            <motion.div
                                key="qrcode"
                                initial={{ opacity: 0, scale: 0.95 }}
                                animate={{ opacity: 1, scale: 1 }}
                                className="glass-card p-10 rounded-3xl space-y-8 flex flex-col items-center"
                            >
                                {/* Status Header */}
                                <div className="text-center space-y-2">
                                    {transaction.status === 'completed' ? (
                                        <div className="flex items-center justify-center gap-2 text-green-500 mb-2">
                                            <CheckCircle2 size={16} />
                                            <span className="text-xs font-bold uppercase tracking-widest">Pagamento Confirmado!</span>
                                        </div>
                                    ) : (
                                        <div className="flex items-center justify-center gap-2 text-yellow-500 mb-2">
                                            <Clock size={16} className="animate-pulse" />
                                            <span className="text-xs font-bold uppercase tracking-widest">Aguardando Pagamento</span>
                                        </div>
                                    )}
                                    <h3 className="text-2xl font-black">{formatBRL(transaction.amount_original)}</h3>
                                </div>

                                {/* QR Code */}
                                <div className="relative p-6 bg-white rounded-3xl shadow-2xl shadow-white/5">
                                    <img
                                        src={transaction.qr_code_url}
                                        alt="PIX QR Code"
                                        className="w-56 h-56"
                                    />
                                    {transaction.status === 'completed' && (
                                        <div className="absolute inset-0 bg-green-500/90 flex flex-col items-center justify-center text-white p-6 rounded-3xl">
                                            <CheckCircle2 size={64} className="mb-4 animate-bounce" />
                                            <span className="font-black text-xl">PAGO!</span>
                                        </div>
                                    )}
                                </div>

                                {/* Copia e Cola */}
                                <div className="w-full space-y-4">
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
                                        className="w-full py-4 bg-primary/10 border border-primary/20 rounded-xl text-primary text-sm font-bold uppercase tracking-widest hover:bg-primary/20 transition-all flex items-center justify-center gap-2"
                                    >
                                        <Copy size={16} />
                                        Copiar Código PIX
                                    </button>

                                    {transaction.status !== 'completed' && (
                                        <div className="flex items-center justify-center gap-3 py-2 text-xs text-muted-foreground">
                                            <RefreshCcw size={14} className="animate-spin" />
                                            Verificando pagamento automaticamente...
                                        </div>
                                    )}
                                </div>
                            </motion.div>
                        )}
                    </AnimatePresence>
                </div>
            </div>
        </div>
    );
}
