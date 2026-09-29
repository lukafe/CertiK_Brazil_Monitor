import type { Metadata } from "next";
import { Inter } from "next/font/google";
import localFont from "next/font/local";
import "./globals.css";
import Sidebar from "@/components/sidebar";
import Topbar from "@/components/topbar";

const inter = Inter({ subsets: ["latin"], variable: "--font-sans" });
const mono = localFont({
  src: "./fonts/GeistMonoVF.woff",
  variable: "--font-mono",
  weight: "100 900",
});

export const metadata: Metadata = {
  title: "CertiK MONITOR Brasil",
  description: "Monitoring of the Brazilian PSAV universe — Res. BCB 520",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body
        className={`${inter.variable} ${mono.variable} font-sans min-h-screen bg-surface-sunken text-fg antialiased`}
      >
        <Sidebar />
        <div className="pl-14 lg:pl-56">
          <Topbar />
          <main className="px-4 py-5 lg:px-6">{children}</main>
        </div>
      </body>
    </html>
  );
}
