'use client';

import { usePathname, useRouter } from 'next/navigation';
import { Sidebar } from "@/components/Sidebar";
import { cn } from '@/lib/utils';
import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { LayoutDashboard, ArrowUpCircle, ArrowDownCircle, Key } from 'lucide-react';
import Link from 'next/link';

export const NAV_ITEMS = [
    { label: 'Dash Protocol', icon: LayoutDashboard, href: '/' },
    { label: 'Aportar PIX', icon: ArrowUpCircle, href: '/deposit' },
    { label: 'Resgatar PIX', icon: ArrowDownCircle, href: '/withdraw' },
    { label: 'Chave PIX', icon: Key, href: '/pix-key' },
];

export function LayoutWrapper({ children }: { children: React.ReactNode }) {
    const pathname = usePathname();
    const router = useRouter();
    const [checking, setChecking] = useState(true);

    // Auth page and THE PIN ENTRY SCREEN of admin should not show sidebar
    const isAuthPage = pathname === '/auth';
    const isAdminPinScreen = pathname === '/admin';
    const hideSidebar = isAuthPage || isAdminPinScreen;

    useEffect(() => {
        async function checkUser() {
            const isAdminPage = pathname.startsWith('/admin');

            if (isAuthPage || isAdminPage) {
                setChecking(false);
                return;
            }

            const { data: { user } } = await supabase.auth.getUser();

            if (!user) {
                router.push('/auth');
            } else {
                setChecking(false);
            }
        }
        checkUser();
    }, [pathname, isAuthPage, router]);

    if (checking && !isAuthPage && !isAdminPinScreen) {
        return (
            <div className="h-screen bg-[#0a0a0a] flex items-center justify-center">
                <div className="flex flex-col items-center gap-4">
                    <div className="w-10 h-10 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                    <p className="text-[10px] font-black uppercase tracking-[0.5em] text-muted-foreground animate-pulse">Sincronizando Nodes</p>
                </div>
            </div>
        );
    }

    return (
        <div className="flex h-screen bg-[#0a0a0a]">
            {!hideSidebar && <Sidebar />}

            {/* Mobile Bottom Navigation */}
            {!hideSidebar && (
                <div className="md:hidden fixed bottom-6 left-6 right-6 h-20 glass-card rounded-[30px] border-white/10 z-[100] flex items-center justify-around px-6 shadow-2xl shadow-black/50 backdrop-blur-3xl border border-white/5">
                    {NAV_ITEMS.map((item) => {
                        const isActive = pathname === item.href;
                        const Icon = item.icon;
                        return (
                            <Link key={item.href} href={item.href} className="flex-1">
                                <div className={cn(
                                    "flex flex-col items-center justify-center gap-1 transition-all duration-300",
                                    isActive ? "text-primary scale-110" : "text-muted-foreground opacity-50"
                                )}>
                                    <Icon size={isActive ? 24 : 20} className={cn(isActive && "animate-pulse")} />
                                    <span className="text-[8px] font-black uppercase tracking-widest">{item.label.split(' ')[0]}</span>
                                </div>
                            </Link>
                        );
                    })}
                </div>
            )}

            <main className={cn(
                "flex-1 p-4 md:p-8 overflow-y-auto transition-all duration-500 min-h-screen relative",
                !hideSidebar ? "md:ml-64" : "ml-0"
            )}>
                <div className="max-w-7xl mx-auto space-y-12 pb-32">
                    {children}
                </div>

                {!hideSidebar && (
                    <div className="mt-20 py-8 border-t border-white/5 flex flex-col md:flex-row justify-between items-center gap-6 text-[10px] font-black tracking-[0.3em] uppercase opacity-30 italic">
                        <div className="flex gap-8">
                            <span>Protocolo Axion-301</span>
                            <span>Liquidez Descentralizada</span>
                        </div>
                        <div className="flex gap-8 text-[#EAB308]">
                            <span>Criptografia Militar Quantum-Safe</span>
                            <span>AxionPay Gateway 2026</span>
                        </div>
                    </div>
                )}
            </main>
        </div>
    );
}
