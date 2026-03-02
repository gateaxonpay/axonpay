'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
    LayoutDashboard,
    ArrowUpCircle,
    ArrowDownCircle,
    Settings,
    ShieldCheck,
    LogOut,
    Wallet,
    Activity,
    User as UserIcon
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { motion } from 'framer-motion';

const NAV_ITEMS = [
    { label: 'Dashboard', icon: LayoutDashboard, href: '/' },
    { label: 'Depositar', icon: ArrowUpCircle, href: '/deposit' },
    { label: 'Sacar', icon: ArrowDownCircle, href: '/withdraw' },
    { label: 'Admin', icon: ShieldCheck, href: '/admin' },
];

export function Sidebar() {
    const pathname = usePathname();

    return (
        <aside className="w-64 h-screen fixed left-0 top-0 bg-[#0a0a0a] border-r border-white/5 flex flex-col p-6 z-50">
            <div className="flex items-center gap-3 mb-10 text-[#EAB308]">
                <div className="p-2 bg-gradient-to-br from-[#EAB308] to-[#92400E] rounded-xl shadow-lg shadow-yellow-600/20">
                    <Wallet size={24} className="text-black" />
                </div>
                <span className="text-xl font-bold tracking-tight uppercase">AxonPay</span>
            </div>

            <nav className="flex-1 space-y-2">
                {NAV_ITEMS.map((item) => {
                    const isActive = pathname === item.href;
                    return (
                        <Link key={item.href} href={item.href}>
                            <div className={cn(
                                "flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-300 group",
                                isActive
                                    ? "bg-primary text-black font-semibold shadow-lg shadow-primary/20"
                                    : "text-muted-foreground hover:bg-white/5 hover:text-white"
                            )}>
                                <item.icon size={20} className={cn(
                                    "transition-all",
                                    isActive ? "scale-110" : "group-hover:scale-110"
                                )} />
                                <span>{item.label}</span>
                            </div>
                        </Link>
                    );
                })}
            </nav>

            <div className="pt-6 border-t border-white/5 flex flex-col gap-4">
                <div className="flex items-center gap-3 px-4">
                    <div className="w-10 h-10 rounded-full bg-blue-600/20 border border-blue-500/30 flex items-center justify-center">
                        <UserIcon size={20} className="text-blue-400" />
                    </div>
                    <div>
                        <p className="text-xs text-muted-foreground">Logado como</p>
                        <p className="text-sm font-medium">usuario@email.com</p>
                    </div>
                </div>
                <button className="flex items-center gap-3 px-4 py-3 text-muted-foreground hover:text-red-400 transition-colors">
                    <LogOut size={20} />
                    <span>Sair</span>
                </button>
            </div>
        </aside>
    );
}
