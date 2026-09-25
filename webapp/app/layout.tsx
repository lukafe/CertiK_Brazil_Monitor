import type { Metadata } from "next";
import { Inter } from "next/font/google";
import Link from "next/link";
import "./globals.css";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "CertiK MONITOR Brasil",
  description: "Monitoramento do universo PSAV — Res. BCB 520",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR">
      <body className={`${inter.className} bg-[#0b0e14] text-slate-200 min-h-screen antialiased`}>
        <header className="sticky top-0 z-20 border-b border-slate-800 bg-[#0b0e14]/90 backdrop-blur">
          <div className="mx-auto max-w-7xl px-4 py-3 flex items-center gap-3">
            <Link href="/" className="flex items-center gap-2">
              <span className="inline-block h-7 w-7 rounded bg-gradient-to-br from-emerald-400 to-cyan-500" />
              <span className="text-lg font-semibold tracking-tight text-white">
                CertiK <span className="text-emerald-400">MONITOR</span> Brasil
              </span>
            </Link>
            <span className="ml-auto text-xs text-slate-500">
              Universo PSAV · Res. BCB 520 · uso interno
            </span>
          </div>
        </header>
        <main className="mx-auto max-w-7xl px-4 py-6">{children}</main>
      </body>
    </html>
  );
}
