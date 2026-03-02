'use client';

import { usePathname, useRouter } from 'next/navigation';
import { Sidebar } from "@/components/Sidebar";
import { cn } from '@/lib/utils';
import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';

export function LayoutWrapper({ children }: { children: React.ReactNode }) {
    const pathname = usePathname();
    const router = useRouter();
    const [checking, setChecking] = useState(true);
    const isAuthPage = pathname === '/auth';

    useEffect(() => {
        async function checkUser() {
            // Admin page is exempt from global auth check so it can handle its own PIN security.
            // Auth page is obviously exempt.
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

    // Simple loading screen
    if (checking && !isAuthPage) {
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
            {!isAuthPage && <Sidebar />}
            <main className={cn(
                "flex-1 p-8 overflow-y-auto transition-all duration-500 min-h-screen relative",
                !isAuthPage ? "ml-64" : "ml-0"
            )}>
                <div className="max-w-7xl mx-auto space-y-12 pb-20">
                    {children}
                </div>

                {/* Universal Footer for Logged In Pages */}
                {!isAuthPage && (
                    <div className="mt-20 py-8 border-t border-white/5 flex flex-col md:flex-row justify-between items-center gap-6 text-[10px] font-black tracking-[0.3em] uppercase opacity-30 italic">
                        <div className="flex gap-8">
                            <span>Protocolo Axon-301</span>
                            <span>Liquidez Descentralizada</span>
                        </div>
                        <div className="flex gap-8 text-[#EAB308]">
                            <span>Criptografia Militar Quantum-Safe</span>
                            <span>AxonPay Gateway 2026</span>
                        </div>
                    </div>
                )}
            </main>
        </div>
    );
}
