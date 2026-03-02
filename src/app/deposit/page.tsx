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

export default function DepositPage() {
    const [amount, setAmount] = useState('');
    const [description, setDescription] = useState('Pagamento');
    const [isGenerating, setIsGenerating] = useState(false);
    const [transaction, setTransaction] = useState<any>(null);
    const [copySuccess, setCopySuccess] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const netAmount = amount ? new Decimal(amount || 0).times(0.7).toDecimalPlaces(2).toString() : '0.00';
    const taxAmount = amount ? new Decimal(amount || 0).times(0.3).toDecimalPlaces(2).toString() : '0.00';

    // Polling logic
    useEffect(() => {
        let interval: NodeJS.Timeout;

        if (transaction && !transaction.is_final) {
            interval = setInterval(async () => {
                const { data, error: pollError } = await supabase
                    .from('transactions')
                    .select('*')
                    .eq('id', transaction.id)
                    .single();

                if (data) {
                    setTransaction(data);
                    if (data.is_final) {
                        clearInterval(interval);
                    }
                }
            }, 60000); // 60 seconds as per spec
        }

        return () => clearInterval(interval);
    }, [transaction]);

    const handleGenerate = async () => {
        if (!amount || parseFloat(amount) <= 0) {
            setError('Por favor, insira um valor válido.');
            return;
        }

        setIsGenerating(true);
        setError(null);

        try {
            // Create transaction in Supabase
            const { data, error: insertError } = await supabase
                .from('transactions')
                .insert({
                    type: 'deposit',
                    amount_original: parseFloat(amount),
                    amount_net: parseFloat(netAmount),
                    description: description || 'Pagamento',
                    status: 'pending',
                    is_final: false,
                    pix_copia_e_cola: `00020101021126580014BR.GOV.BCB.PIX0136e0a0a0a0-0a0a-0a0a-0a0a-0a0a0a0a0a0a5204000053039865405${amount}5802BR5913AXONPAY LTDA6009SAO PAULO62070503***6304ABCD`,
                    qr_code_url: 'https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=AXONPAY-PIX-EXAMPLE',
                })
                .select()
                .single();

            if (insertError) throw insertError;
            setTransaction(data);
        } catch (err: any) {
            setError(err.message || 'Erro ao gerar o PIX. Tente novamente.');
        } finally {
            setIsGenerating(false);
        }
    };

    const copyToClipboard = () => {
        if (!transaction?.pix_copia_e_cola) return;
        navigator.clipboard.writeText(transaction.pix_copia_e_cola);
        setCopySuccess(true);
        setTimeout(() => setCopySuccess(false), 2000);
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
                <div className="lg:col-span-3 space-y-8">
                    {/* Input Section */}
                    <div className="glass-card p-10 rounded-3xl space-y-8 relative overflow-hidden group">
                        <div className="absolute top-0 right-0 w-64 h-64 bg-primary/5 rounded-full blur-[80px] -mr-32 -mt-32" />

                        <div className="space-y-6">
                            <div className="space-y-3">
                                <label className="text-sm font-bold uppercase tracking-widest text-[#EAB308]">Valor do Depósito (R$)</label>
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
                                        disabled={!!transaction}
                                        className="w-full h-20 bg-white/5 border border-white/10 rounded-2xl pl-16 pr-6 text-3xl font-black outline-none focus:border-primary/50 focus:bg-white/10 transition-all disabled:opacity-50"
                                    />
                                </div>
                            </div>

                            <div className="space-y-3">
                                <label className="text-sm font-bold uppercase tracking-widest text-muted-foreground">Descrição (Opcional)</label>
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

                        {/* Tax Real-time Info */}
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
                                disabled={isGenerating || !amount}
                                className="w-full h-16 gold-gradient rounded-2xl font-black uppercase tracking-widest flex items-center justify-center gap-3 hover:scale-[1.02] active:scale-100 transition-all disabled:opacity-30 disabled:hover:scale-100"
                            >
                                {isGenerating ? (
                                    <RefreshCcw className="animate-spin" />
                                ) : (
                                    <QrCodeIcon size={24} />
                                )}
                                Gerar Cobrança PIX
                            </button>
                        ) : (
                            <button
                                onClick={() => setTransaction(null)}
                                className="w-full h-16 bg-white/5 border border-white/10 rounded-2xl font-bold text-muted-foreground hover:bg-white/10 transition-all"
                            >
                                Nova Transação
                            </button>
                        )}
                    </div>

                    <div className="p-6 border border-yellow-600/20 bg-yellow-600/5 rounded-2xl flex gap-4 items-start">
                        <AlertTriangle className="text-yellow-500 shrink-0" size={24} />
                        <p className="text-sm text-yellow-200/70 leading-relaxed">
                            <strong>Atenção:</strong> O valor será creditado após a confirmação automática na rede PIX. O processo geralmente leva menos de 10 segundos. O QR Code expira em 30 minutos.
                        </p>
                    </div>
                </div>

                {/* Status/Output Section */}
                <div className="lg:col-span-2">
                    <AnimatePresence mode="wait">
                        {!transaction ? (
                            <motion.div
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
                                    <p className="text-sm text-muted-foreground opacity-30 max-w-[200px] mx-auto">Insira o valor e clique em gerar para ver o QR Code</p>
                                </div>
                            </motion.div>
                        ) : (
                            <motion.div
                                initial={{ opacity: 0, scale: 0.95 }}
                                animate={{ opacity: 1, scale: 1 }}
                                className="glass-card p-10 rounded-3xl space-y-8 flex flex-col items-center"
                            >
                                <div className="text-center space-y-2">
                                    <div className="flex items-center justify-center gap-2 text-yellow-500 mb-2">
                                        <Clock size={16} className="animate-pulse" />
                                        <span className="text-xs font-bold uppercase tracking-widest">Aguardando Pagamento</span>
                                    </div>
                                    <h3 className="text-2xl font-black">{formatBRL(transaction.amount_original)}</h3>
                                </div>

                                {/* Simulated QR Code */}
                                <div className="relative p-6 bg-white rounded-3xl shadow-2xl shadow-white/5 group">
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

                                <div className="w-full space-y-4">
                                    <div className="space-y-2">
                                        <p className="text-xs font-bold uppercase text-muted-foreground ml-2">Copia e Cola</p>
                                        <div className="relative">
                                            <input
                                                readOnly
                                                value={transaction.pix_copia_e_cola}
                                                className="w-full bg-white/5 border border-white/10 rounded-xl py-4 pl-4 pr-12 text-sm font-mono truncate"
                                            />
                                            <button
                                                onClick={copyToClipboard}
                                                className="absolute right-3 top-1/2 -translate-y-1/2 p-2 hover:bg-white/10 rounded-lg transition-all"
                                            >
                                                {copySuccess ? <CheckCircle2 size={20} className="text-green-500" /> : <Copy size={20} className="text-muted-foreground" />}
                                            </button>
                                        </div>
                                    </div>

                                    <div className="flex items-center justify-center gap-3 py-2 text-xs text-muted-foreground">
                                        <RefreshCcw size={14} className="animate-spin" />
                                        Sincronizando com Banco Central...
                                    </div>
                                </div>
                            </motion.div>
                        )}
                    </AnimatePresence>
                </div>
            </div>
        </div>
    );
}
