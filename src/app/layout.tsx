import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { Sidebar } from "@/components/Sidebar";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "AxonPay | Gateway de Pagamentos PIX",
  description: "O gateway de pagamentos mais rápido e seguro do mercado.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="pt-BR">
      <body className={inter.className}>
        <div className="flex h-screen bg-[#0a0a0a]">
          <Sidebar />
          <main className="flex-1 ml-64 p-8 overflow-y-auto">
            <div className="max-w-7xl mx-auto space-y-8">
              {children}
            </div>
          </main>
        </div>

        {/* Footer legal */}
        <div className="fixed bottom-0 left-64 right-0 p-4 border-t border-white/5 bg-[#0a0a0a]/80 backdrop-blur-sm flex justify-center items-center gap-8 text-[11px] font-mono tracking-widest uppercase opacity-60 z-10">
          <span>Transações Irreversíveis</span>
          <span>Sem Reembolsos/MED</span>
          <span className="text-[#EAB308]">Liquidado em Crypto</span>
        </div>
      </body>
    </html>
  );
}
