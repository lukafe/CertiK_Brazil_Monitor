import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import Sidebar from "@/components/sidebar";
import Topbar from "@/components/topbar";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "CertiK MONITOR Brasil",
  description: "Monitoramento do universo PSAV — Res. BCB 520",
  icons: {
    icon: "data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'><text y='.9em' font-size='90'>🛡️</text></svg>",
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR">
      <body className={`${inter.className} min-h-screen bg-ink-950 text-slate-200 antialiased`}>
        <Sidebar />
        <div className="pl-14 lg:pl-56">
          <Topbar />
          <main className="px-4 py-5 lg:px-6">{children}</main>
        </div>
      </body>
    </html>
  );
}
