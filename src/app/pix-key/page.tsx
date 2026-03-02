'use client';

import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import {
    Key,
    CheckCircle2,
    AlertTriangle,
    Loader2,
    ShieldCheck
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { supabase } from '@/lib/supabase';
import { useRouter } from 'next/navigation';

const PIX_TYPES = [
    { id: 'CPF', label: 'CPF', placeholder: '123.456.789-00' },
    { id: 'CNPJ', label: 'CNPJ', placeholder: '12.345.678/0001-00' },
    { id: 'PHONE', label: 'Telefone', placeholder: '+55 11 99999-8888' },
    { id: 'EMAIL', label: 'E-mail', placeholder: 'cliente@provedor.com' },
    { id: 'EVP', label: 'Aleatória', placeholder: '00000000-0000-0000-0000-000000000000' },
];

export default function PixKeyPage() {
    const [pixType, setPixType] = useState('CPF');
    const [pixKey, setPixKey] = useState('');
    const [isLoading, setIsLoading] = useState(true);
    const [isSaving, setIsSaving] = useState(false);
    const [success, setSuccess] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [userId, setUserId] = useState<string | null>(null);
    const router = useRouter();

    useEffect(() => {
        async function loadProfile() {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) {
                router.push('/auth');
                return;
            }
            setUserId(user.id);

            const { data: profile } = await supabase
                .from('profiles')
                .select('pix_key, pix_type')
                .eq('id', user.id)
                .single();

            if (profile) {
                if (profile.pix_key) setPixKey(profile.pix_key);
                if (profile.pix_type) setPixType(profile.pix_type);
            }
            setIsLoading(false);
        }
        loadProfile();
    }, []);

    const handleSave = async () => {
        if (!pixKey.trim()) {
            setError('Preencha a chave PIX.');
            return;
        }
        if (!userId) return;

        setIsSaving(true);
        setError(null);
        setSuccess(false);

        try {
            const { error: updateError } = await supabase
                .from('profiles')
                .update({ pix_key: pixKey.trim(), pix_type: pixType })
                .eq('id', userId);

            if (updateError) throw updateError;

            setSuccess(true);
            setTimeout(() => setSuccess(false), 3000);
        } catch (err: any) {
            setError(err.message || 'Erro ao salvar chave PIX.');
        } finally {
            setIsSaving(false);
        }
    };

    const activePlaceholder = PIX_TYPES.find(t => t.id === pixType)?.placeholder;

    if (isLoading) {
        return (
            <div className="h-[60vh] flex items-center justify-center">
                <Loader2 className="animate-spin text-primary" size={40} />
            </div>
        );
    }

    return (
        <div className="max-w-3xl mx-auto pb-20">
            <div className="flex items-center gap-4 mb-10">
                <div className="p-3 bg-[#EAB308]/10 border border-[#EAB308]/20 rounded-2xl shadow-2xl shadow-yellow-900/10">
                    <Key className="text-[#EAB308]" size={28} />
                </div>
                <div>
                    <h1 className="text-3xl font-black tracking-tight text-white uppercase italic">Chave PIX</h1>
                    <p className="text-muted-foreground text-sm uppercase tracking-widest font-bold">Cadastro de Recebimento</p>
                </div>
            </div>

            <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="glass-card p-10 rounded-[40px] border-white/5 space-y-8"
            >
                <div className="space-y-3">
                    <h3 className="text-sm font-black uppercase tracking-widest text-[#EAB308]">
                        Tipo de Chave
                    </h3>
                    <div className="flex gap-2 flex-wrap">
                        {PIX_TYPES.map(type => (
                            <button
                                key={type.id}
                                onClick={() => setPixType(type.id)}
                                className={cn(
                                    "px-5 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all border",
                                    pixType === type.id
                                        ? "bg-primary text-black border-primary shadow-lg shadow-yellow-500/20"
                                        : "bg-white/5 text-muted-foreground border-white/5 hover:bg-white/10"
                                )}
                            >
                                {type.label}
                            </button>
                        ))}
                    </div>
                </div>

                <div className="space-y-3">
                    <label className="text-sm font-black uppercase tracking-widest text-muted-foreground">
                        Sua Chave {pixType}
                    </label>
                    <input
                        type="text"
                        value={pixKey}
                        onChange={(e) => {
                            setPixKey(e.target.value);
                            setError(null);
                            setSuccess(false);
                        }}
                        placeholder={activePlaceholder}
                        className="w-full h-20 bg-white/5 border border-white/10 rounded-[28px] px-8 text-lg font-bold outline-none focus:border-primary/50 focus:bg-white/10 transition-all font-mono tracking-widest placeholder:text-white/10"
                    />
                </div>

                {error && (
                    <div className="p-4 bg-red-500/10 border border-red-500/20 rounded-2xl flex items-center gap-3 text-red-400 text-sm font-bold">
                        <AlertTriangle size={18} />
                        {error}
                    </div>
                )}

                {success && (
                    <motion.div
                        initial={{ opacity: 0, scale: 0.95 }}
                        animate={{ opacity: 1, scale: 1 }}
                        className="p-4 bg-green-500/10 border border-green-500/20 rounded-2xl flex items-center gap-3 text-green-400 text-sm font-bold"
                    >
                        <CheckCircle2 size={18} />
                        Chave PIX salva com sucesso!
                    </motion.div>
                )}

                <button
                    onClick={handleSave}
                    disabled={isSaving || !pixKey.trim()}
                    className="w-full h-20 gold-gradient rounded-[28px] font-black uppercase tracking-[0.2em] flex items-center justify-center gap-3 hover:scale-[1.02] active:scale-100 transition-all disabled:opacity-30 disabled:hover:scale-100 text-sm"
                >
                    {isSaving ? (
                        <Loader2 size={24} className="animate-spin" />
                    ) : (
                        <Key size={20} />
                    )}
                    {isSaving ? 'Salvando...' : 'Salvar Chave PIX'}
                </button>

                <div className="p-6 border border-[#EAB308]/10 bg-[#EAB308]/5 rounded-2xl flex gap-4 items-start">
                    <ShieldCheck className="text-[#EAB308] shrink-0" size={24} />
                    <p className="text-sm text-yellow-200/70 leading-relaxed">
                        <strong>Segurança:</strong> Sua chave PIX será usada exclusivamente para receber os saques.
                        Confira os dados antes de salvar. Uma chave incorreta pode causar atrasos no recebimento.
                    </p>
                </div>
            </motion.div>
        </div>
    );
}
