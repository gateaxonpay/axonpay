'use client';

import { useState } from 'react';
import { motion } from 'framer-motion';
import { supabase } from '@/lib/supabase';
import { User as UserIcon, Lock, LogIn, ShieldCheck, AlertCircle, RefreshCcw } from 'lucide-react';
import { useRouter } from 'next/navigation';

export default function AuthPage() {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const router = useRouter();

    const handleAuth = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setError(null);

        try {
            // Se o usuário não digitar o domínio, adiciona internamente para o Supabase Auth
            const formattedEmail = email.includes('@') ? email : `${email.trim().toLowerCase()}@axon.pay`;

            const { error: loginError } = await supabase.auth.signInWithPassword({
                email: formattedEmail,
                password
            });
            if (loginError) throw loginError;

            router.push('/');
            router.refresh();
        } catch (err: any) {
            setError(err.message || 'Erro na autenticação. Verifique suas credenciais.');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-[80vh] flex items-center justify-center p-6">
            <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                className="glass-card w-full max-w-md p-10 rounded-[40px] border-white/5 space-y-8 relative overflow-hidden"
            >
                {/* Background decoration */}
                <div className="absolute top-0 right-0 w-32 h-32 bg-primary/20 blur-[60px] -mr-16 -mt-16" />
                <div className="absolute bottom-0 left-0 w-32 h-32 bg-blue-500/10 blur-[60px] -ml-16 -mb-16" />

                <div className="text-center space-y-3 relative">
                    <div className="w-20 h-20 bg-primary/10 border-2 border-primary/20 rounded-3xl flex items-center justify-center text-primary mx-auto mb-6 shadow-2xl shadow-yellow-500/20">
                        <LogIn size={40} />
                    </div>
                    <h1 className="text-3xl font-black tracking-tight tracking-tighter">Acesso Protocolado</h1>
                    <p className="text-muted-foreground text-[10px] uppercase tracking-[0.3em] font-black">AxionPay Secure Node v3</p>
                </div>

                <form onSubmit={handleAuth} className="space-y-6 relative">
                    <div className="space-y-4">
                        <div className="relative group">
                            <UserIcon className="absolute left-6 top-1/2 -translate-y-1/2 text-muted-foreground group-focus-within:text-primary transition-colors" size={20} />
                            <input
                                type="text"
                                required
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                placeholder="Digite seu Usuário"
                                className="w-full h-16 bg-white/5 border border-white/10 rounded-2xl pl-16 pr-6 outline-none focus:border-primary/50 focus:bg-white/10 transition-all font-bold placeholder:opacity-20 uppercase"
                            />
                        </div>

                        <div className="relative group">
                            <Lock className="absolute left-6 top-1/2 -translate-y-1/2 text-muted-foreground group-focus-within:text-primary transition-colors" size={20} />
                            <input
                                type="password"
                                required
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                placeholder="••••••••"
                                className="w-full h-16 bg-white/5 border border-white/10 rounded-2xl pl-16 pr-6 outline-none focus:border-primary/50 focus:bg-white/10 transition-all font-bold placeholder:opacity-20"
                            />
                        </div>
                    </div>

                    {error && (
                        <div className="p-4 bg-red-500/10 border border-red-500/20 rounded-2xl flex items-center gap-3 text-red-500 text-[10px] font-black uppercase tracking-widest leading-relaxed">
                            <AlertCircle size={16} className="shrink-0" />
                            {error}
                        </div>
                    )}

                    <button
                        disabled={loading}
                        className="w-full h-16 gold-gradient rounded-2xl font-black uppercase tracking-[0.2em] flex items-center justify-center gap-3 hover:scale-[1.02] active:scale-100 transition-all shadow-xl shadow-yellow-900/20 disabled:opacity-50 italic"
                    >
                        {loading ? <RefreshCcw className="animate-spin" /> : 'Autenticar Protocolo'}
                    </button>

                    <p className="text-center text-[9px] font-black uppercase tracking-[0.2em] text-muted-foreground/30 px-6 leading-relaxed">
                        Acesso restrito. Se você esqueceu seus dados ou precisa de acesso, contate o administrador do sistema.
                    </p>
                </form>

                <div className="pt-6 border-t border-white/5 text-center">
                    <div className="flex items-center justify-center gap-2 text-[10px] text-muted-foreground font-bold tracking-widest uppercase">
                        <ShieldCheck size={12} className="text-primary" />
                        Firewall Axion Ativo
                    </div>
                </div>
            </motion.div>
        </div>
    );
}
