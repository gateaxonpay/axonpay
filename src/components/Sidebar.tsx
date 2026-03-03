'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import {
    LayoutDashboard,
    ArrowUpCircle,
    ArrowDownCircle,
    ShieldCheck,
    LogOut,
    Wallet,
    Key,
    User as UserIcon
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';

import { NAV_ITEMS } from './LayoutWrapper';

export function Sidebar() {
    const pathname = usePathname();
    const router = useRouter();
    const [userEmail, setUserEmail] = useState<string | null>(null);

    useEffect(() => {
        async function getSession() {
            const { data: { user } } = await supabase.auth.getUser();
            setUserEmail(user?.email || 'Guest');
        }
        getSession();
    }, [pathname]);

    const handleLogout = async () => {
        await supabase.auth.signOut();
        router.push('/auth');
        router.refresh();
    };

    if (pathname === '/auth') return null;

    return (
        <aside className="hidden md:flex w-64 h-screen fixed left-0 top-0 bg-[#0a0a0a] border-r border-white/5 flex-col p-8 z-50 backdrop-blur-xl shadow-2xl">
            <div className="flex items-center gap-4 mb-16 relative">
                <div className="p-3 bg-gradient-to-br from-[#EAB308] to-[#92400E] rounded-2xl shadow-xl shadow-yellow-600/20 group hover:scale-110 transition-transform cursor-pointer active:scale-95">
                    <Wallet size={24} className="text-black" />
                </div>
                <div className="flex flex-col">
                    <span className="text-2xl font-black tracking-tighter uppercase italic text-white">AxionPay</span>
                    <span className="text-[8px] font-black tracking-[0.4em] uppercase text-[#EAB308] opacity-50">Secure Gateway</span>
                </div>
            </div>

            <nav className="flex-1 space-y-3">
                {NAV_ITEMS.map((item) => {
                    const isActive = pathname === item.href;
                    return (
                        <Link key={item.href} href={item.href}>
                            <div className={cn(
                                "flex items-center gap-4 px-6 py-4 rounded-2xl transition-all duration-500 group relative",
                                isActive
                                    ? "bg-primary text-black font-black shadow-2xl shadow-primary/20 scale-105"
                                    : "text-muted-foreground hover:bg-white/5 hover:text-white"
                            )}>
                                {isActive && (
                                    <div className="absolute left-0 w-1.5 h-6 bg-black rounded-full" />
                                )}
                                <item.icon size={22} className={cn(
                                    "transition-all duration-500",
                                    isActive ? "scale-110 rotate-3" : "group-hover:scale-125 group-hover:-rotate-6"
                                )} />
                                <span className="text-xs uppercase tracking-widest font-black">{item.label}</span>
                            </div>
                        </Link>
                    );
                })}
            </nav>

            <div className="pt-8 border-t border-white/5 flex flex-col gap-6">
                <div className="flex items-center gap-4 px-2">
                    <div className="w-12 h-12 rounded-2xl bg-blue-600/10 border border-blue-500/20 flex items-center justify-center shadow-lg shadow-blue-500/10">
                        <UserIcon size={24} className="text-blue-400" />
                    </div>
                    <div className="flex-1 min-w-0">
                        <p className="text-[10px] text-muted-foreground uppercase font-black tracking-widest opacity-50">Acesso Ativo</p>
                        <p className="text-xs font-bold text-white truncate lowercase italic">{userEmail || '...'}</p>
                    </div>
                </div>
                <button
                    onClick={handleLogout}
                    className="flex items-center gap-4 px-6 py-4 text-muted-foreground hover:text-red-500 hover:bg-red-500/10 rounded-2xl transition-all duration-300 group shadow-lg"
                >
                    <LogOut size={22} className="group-hover:translate-x-1 group-hover:-translate-y-1 transition-transform" />
                    <span className="text-xs uppercase tracking-[0.2em] font-black">Encerrar Sessão</span>
                </button>
            </div>

            <div className="mt-8 text-center">
                <p className="text-[8px] font-black uppercase tracking-[0.5em] text-white opacity-10">Axion Protocol v3.0</p>
            </div>
        </aside>
    );
}
