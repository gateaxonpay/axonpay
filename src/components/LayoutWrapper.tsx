'use client';

import { usePathname, useRouter } from 'next/navigation';
import { Sidebar } from "@/components/Sidebar";
import { cn } from '@/lib/utils';
import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { LayoutDashboard, ArrowUpCircle, ArrowDownCircle, Key } from 'lucide-react';
import Link from 'next/link';

export const NAV_ITEMS = [
    { label: 'Início', icon: LayoutDashboard, href: '/' },
    { label: 'Depositar', icon: ArrowUpCircle, href: '/deposit' },
    { label: 'Sacar', icon: ArrowDownCircle, href: '/withdraw' },
    { label: 'Chave PIX', icon: Key, href: '/pix-key' },
];

export function LayoutWrapper({ children }: { children: React.ReactNode }) {
    const pathname = usePathname();
    const router = useRouter();
    const [checking, setChecking] = useState(true);

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
            <div className="h-screen h-[100dvh] bg-[#0a0a0a] flex items-center justify-center">
                <div className="flex flex-col items-center gap-4">
                    <div className="w-10 h-10 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                    <p className="text-[10px] font-black uppercase tracking-[0.5em] text-muted-foreground animate-pulse">Sincronizando</p>
                </div>
            </div>
        );
    }

    return (
        <div className="flex h-screen h-[100dvh] bg-[#0a0a0a]">
            {!hideSidebar && <Sidebar />}

            {/* Mobile Bottom Navigation — Native App Style Tab Bar */}
            {!hideSidebar && (
                <nav className="md:hidden fixed bottom-0 left-0 right-0 z-[100]">
                    {/* Gradient fade above bar */}
                    <div className="h-8 bg-gradient-to-t from-[#0a0a0a] to-transparent pointer-events-none" />

                    <div className="bg-[#0f0f0f]/95 backdrop-blur-2xl border-t border-white/[0.06] px-2 pb-[max(8px,env(safe-area-inset-bottom))]">
                        <div className="flex items-center justify-around pt-2">
                            {NAV_ITEMS.map((item) => {
                                const isActive = pathname === item.href;
                                const Icon = item.icon;
                                return (
                                    <Link key={item.href} href={item.href} className="flex-1">
                                        <div className={cn(
                                            "flex flex-col items-center justify-center py-2 transition-all duration-200 relative",
                                            isActive ? "text-primary" : "text-white/30 active:text-white/50"
                                        )}>
                                            {isActive && (
                                                <div className="absolute -top-2 w-6 h-0.5 bg-primary rounded-full" />
                                            )}
                                            <Icon size={22} strokeWidth={isActive ? 2.5 : 1.8} />
                                            <span className={cn(
                                                "text-[9px] mt-1 tracking-wide",
                                                isActive ? "font-bold text-primary" : "font-medium"
                                            )}>
                                                {item.label}
                                            </span>
                                        </div>
                                    </Link>
                                );
                            })}
                        </div>
                    </div>
                </nav>
            )}

            <main className={cn(
                "flex-1 overflow-y-auto transition-all duration-500 min-h-screen min-h-[100dvh] relative",
                !hideSidebar ? "md:ml-64" : "ml-0"
            )}>
                <div className={cn(
                    "max-w-7xl mx-auto",
                    !hideSidebar ? "px-4 pt-2 pb-28 md:px-8 md:pt-8 md:pb-12 space-y-6 md:space-y-12" : "p-4 md:p-8 space-y-12"
                )}>
                    {children}
                </div>

                {/* Footer — hidden on mobile */}
                {!hideSidebar && (
                    <div className="hidden md:flex mt-20 py-8 border-t border-white/5 flex-col md:flex-row justify-between items-center gap-6 text-[10px] font-black tracking-[0.3em] uppercase opacity-30 italic px-8">
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
