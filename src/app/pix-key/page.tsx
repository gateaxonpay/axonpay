'use client';

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
    Key,
    CheckCircle2,
    AlertTriangle,
    Loader2,
    ShieldCheck,
    Trash2,
    Plus,
    User as UserIcon
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

interface SavedPixKey {
    id: string;
    pix_type: string;
    pix_key: string;
    created_at: string;
}

export default function PixKeyPage() {
    const [pixType, setPixType] = useState('CPF');
    const [pixKey, setPixKey] = useState('');
    const [savedKeys, setSavedKeys] = useState<SavedPixKey[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isSaving, setIsSaving] = useState(false);
    const [isDeleting, setIsDeleting] = useState<string | null>(null);
    const [success, setSuccess] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [userId, setUserId] = useState<string | null>(null);
    const router = useRouter();

    const fetchSavedKeys = async (uid: string) => {
        const { data, error: fetchError } = await supabase
            .from('user_pix_keys')
            .select('*')
            .eq('user_id', uid)
            .order('created_at', { ascending: false });

        if (data) setSavedKeys(data);
    };

    useEffect(() => {
        async function loadData() {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) {
                router.push('/auth');
                return;
            }
            setUserId(user.id);

            // 1. Fetch current saved keys
            const { data: keys } = await supabase
                .from('user_pix_keys')
                .select('*')
                .eq('user_id', user.id)
                .order('created_at', { ascending: false });

            if (keys && keys.length > 0) {
                setSavedKeys(keys);
            } else {
                // 2. Migration Logic: If no keys in the new table, check the legacy profile table
                const { data: profile } = await supabase
                    .from('profiles')
                    .select('pix_key, pix_type')
                    .eq('id', user.id)
                    .single();

                if (profile?.pix_key) {
                    // Auto-migrate legacy key to new table
                    const { data: newKey, error: migrateError } = await supabase
                        .from('user_pix_keys')
                        .insert({
                            user_id: user.id,
                            pix_type: profile.pix_type || 'CPF',
                            pix_key: profile.pix_key
                        })
                        .select()
                        .single();

                    if (!migrateError && newKey) {
                        setSavedKeys([newKey]);
                        // Clean up legacy key to avoid re-migration
                        await supabase.from('profiles').update({ pix_key: null, pix_type: null }).eq('id', user.id);
                    }
                }
            }

            setIsLoading(false);
        }
        loadData();
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
            const { error: insertError } = await supabase
                .from('user_pix_keys')
                .insert({
                    user_id: userId,
                    pix_type: pixType,
                    pix_key: pixKey.trim()
                });

            if (insertError) throw insertError;

            setPixKey('');
            await fetchSavedKeys(userId);
            setSuccess(true);
            setTimeout(() => setSuccess(false), 3000);
        } catch (err: any) {
            setError(err.message || 'Erro ao salvar chave PIX.');
        } finally {
            setIsSaving(false);
        }
    };

    const handleDelete = async (id: string) => {
        if (!userId) return;
        setIsDeleting(id);
        setError(null);

        try {
            const { error: deleteError } = await supabase
                .from('user_pix_keys')
                .delete()
                .eq('id', id);

            if (deleteError) throw deleteError;

            await fetchSavedKeys(userId);
        } catch (err: any) {
            setError(err.message || 'Erro ao excluir chave PIX.');
        } finally {
            setIsDeleting(null);
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
        <div className="max-w-4xl mx-auto px-4 md:px-0 space-y-10">
            <div className="flex flex-col md:flex-row items-center md:items-center gap-4 text-center md:text-left">
                <div className="p-3 bg-[#EAB308]/10 border border-[#EAB308]/20 rounded-2xl shadow-2xl shadow-yellow-900/10">
                    <Key className="text-[#EAB308]" size={28} />
                </div>
                <div>
                    <h1 className="text-2xl md:text-3xl font-black tracking-tight text-white uppercase italic">Chaves PIX</h1>
                    <p className="text-muted-foreground text-[10px] md:text-sm uppercase tracking-widest font-bold">Gerenciamento de Recebimento</p>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-10">
                {/* Save New Key Form */}
                <motion.div
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    className="glass-card p-6 md:p-10 rounded-[30px] md:rounded-[40px] border-white/5 space-y-8 h-fit"
                >
                    <div className="flex items-center gap-3 text-[#EAB308] mb-2 font-black text-xs uppercase tracking-widest">
                        <Plus size={18} />
                        Nova Chave
                    </div>

                    <div className="space-y-3">
                        <h3 className="text-[10px] font-black uppercase tracking-widest text-muted-foreground/50">
                            Tipo de Chave
                        </h3>
                        <div className="flex gap-2 flex-wrap">
                            {PIX_TYPES.map(type => (
                                <button
                                    key={type.id}
                                    onClick={() => {
                                        setPixType(type.id);
                                        setError(null);
                                    }}
                                    className={cn(
                                        "px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all border",
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
                        <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground/50">
                            Dados da Chave {pixType}
                        </label>
                        <div className="relative group">
                            <div className="absolute left-6 top-1/2 -translate-y-1/2 text-muted-foreground/30">
                                <UserIcon size={20} />
                            </div>
                            <input
                                type="text"
                                value={pixKey}
                                onChange={(e) => {
                                    setPixKey(e.target.value);
                                    setError(null);
                                    setSuccess(false);
                                }}
                                placeholder={activePlaceholder}
                                className="w-full h-14 md:h-16 bg-white/5 border border-white/10 rounded-2xl pl-16 pr-8 text-xs md:text-sm font-bold outline-none focus:border-primary/50 focus:bg-white/10 transition-all font-mono tracking-wider md:tracking-widest placeholder:text-white/10"
                            />
                        </div>
                    </div>

                    {error && (
                        <div className="p-4 bg-red-500/10 border border-red-500/20 rounded-2xl flex items-center gap-3 text-red-400 text-[10px] font-black uppercase tracking-widest">
                            <AlertTriangle size={18} />
                            {error}
                        </div>
                    )}

                    {success && (
                        <motion.div
                            initial={{ opacity: 0, scale: 0.95 }}
                            animate={{ opacity: 1, scale: 1 }}
                            className="p-4 bg-green-500/10 border border-green-500/20 rounded-2xl flex items-center gap-3 text-green-400 text-[10px] font-black uppercase tracking-widest"
                        >
                            <CheckCircle2 size={18} />
                            Chave adicionada!
                        </motion.div>
                    )}

                    <button
                        onClick={handleSave}
                        disabled={isSaving || !pixKey.trim()}
                        className="w-full h-14 md:h-16 gold-gradient rounded-2xl font-black uppercase tracking-[0.2em] flex items-center justify-center gap-3 hover:scale-[1.02] active:scale-100 transition-all disabled:opacity-30 disabled:hover:scale-100 text-[10px] md:text-xs"
                    >
                        {isSaving ? (
                            <Loader2 size={18} className="animate-spin" />
                        ) : (
                            <Plus size={18} />
                        )}
                        Cadastrar Chave
                    </button>

                    <div className="p-6 border border-[#EAB308]/10 bg-[#EAB308]/5 rounded-2xl flex gap-4 items-start">
                        <ShieldCheck className="text-[#EAB308] shrink-0" size={24} />
                        <p className="text-[10px] text-yellow-200/50 leading-relaxed font-black uppercase tracking-widest">
                            Suas chaves são usadas para resgate de liquidez. Confira os dados antes de salvar.
                        </p>
                    </div>
                </motion.div>

                {/* Saved Keys List */}
                <motion.div
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    className="space-y-6"
                >
                    <div className="flex items-center justify-between mb-4">
                        <h3 className="text-sm font-black uppercase tracking-widest text-white/50">Chaves Salvas</h3>
                        <span className="text-[10px] font-black uppercase tracking-widest text-primary bg-primary/10 px-3 py-1 rounded-full">
                            {savedKeys.length} Cadastradas
                        </span>
                    </div>

                    <div className="space-y-4 max-h-[600px] overflow-y-auto pr-2 custom-scrollbar">
                        <AnimatePresence mode="popLayout">
                            {savedKeys.length === 0 ? (
                                <motion.div
                                    initial={{ opacity: 0 }}
                                    animate={{ opacity: 1 }}
                                    className="p-10 border-2 border-dashed border-white/5 rounded-[40px] text-center"
                                >
                                    <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground/30 italic">Nenhuma chave protocolada.</p>
                                </motion.div>
                            ) : (
                                savedKeys.map((k) => (
                                    <motion.div
                                        key={k.id}
                                        layout
                                        initial={{ opacity: 0, scale: 0.9 }}
                                        animate={{ opacity: 1, scale: 1 }}
                                        exit={{ opacity: 0, scale: 0.9 }}
                                        className="glass-card p-4 md:p-6 rounded-2xl md:rounded-3xl border-white/5 flex items-center justify-between group hover:border-primary/20 transition-all shadow-xl"
                                    >
                                        <div className="flex items-center gap-3 md:gap-4 overflow-hidden">
                                            <div className="w-10 h-10 md:w-12 md:h-12 rounded-xl md:rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center text-primary shadow-lg shrink-0">
                                                <Key size={18} className="md:w-5 md:h-5" />
                                            </div>
                                            <div className="overflow-hidden">
                                                <div className="flex items-center gap-2">
                                                    <span className="text-[8px] md:text-[10px] font-black uppercase tracking-widest text-primary">{k.pix_type}</span>
                                                    <div className="w-1 h-1 rounded-full bg-white/10" />
                                                    <span className="text-[7px] md:text-[8px] font-black uppercase tracking-widest text-muted-foreground/50">
                                                        {new Date(k.created_at).toLocaleDateString()}
                                                    </span>
                                                </div>
                                                <p className="text-xs md:text-sm font-bold text-white tracking-wider md:tracking-widest font-mono truncate">
                                                    {k.pix_key}
                                                </p>
                                            </div>
                                        </div>
                                        <button
                                            onClick={() => handleDelete(k.id)}
                                            disabled={isDeleting === k.id}
                                            className="p-2 md:p-3 bg-red-500/10 text-red-500 hover:bg-red-500/20 rounded-xl transition-all md:opacity-0 group-hover:opacity-100 disabled:opacity-50 shrink-0"
                                        >
                                            {isDeleting === k.id ? (
                                                <Loader2 size={16} className="animate-spin" />
                                            ) : (
                                                <Trash2 size={16} />
                                            )}
                                        </button>
                                    </motion.div>
                                ))
                            )}
                        </AnimatePresence>
                    </div>
                </motion.div>
            </div>
        </div>
    );
}
