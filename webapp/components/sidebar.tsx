"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { Suspense } from "react";
import { ShieldLogo } from "./ui";

const ITENS = [
  {
    href: "/",
    chave: "",
    label: "Discovery",
    icone: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
        <circle cx="12" cy="12" r="9" />
        <path d="M15.5 8.5 L13.5 13.5 L8.5 15.5 L10.5 10.5 Z" fill="currentColor" stroke="none" />
      </svg>
    ),
  },
  {
    href: "/?origem=SPSAV",
    chave: "SPSAV",
    label: "SPSAVs",
    icone: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
        <path d="M12 3 L20 6.5 V12 C20 16.5 16.5 19.8 12 21 C7.5 19.8 4 16.5 4 12 V6.5 Z" />
      </svg>
    ),
  },
  {
    href: "/?origem=INCUMBENTE",
    chave: "INCUMBENTE",
    label: "Incumbentes",
    icone: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
        <path d="M3 21h18M5 21V9l7-5 7 5v12M9 21v-6h6v6" />
      </svg>
    ),
  },
  {
    href: "/?grupos=1",
    chave: "grupos",
    label: "Grupos",
    icone: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
        <circle cx="7" cy="8" r="3" />
        <circle cx="17" cy="8" r="3" />
        <path d="M2.5 20c.6-3 2.4-4.5 4.5-4.5S11 17 11.5 20M12.5 20c.6-3 2.4-4.5 4.5-4.5s4.4 1.5 4.5 4.5" />
      </svg>
    ),
  },
];

function Nav() {
  const pathname = usePathname();
  const params = useSearchParams();
  const origem = params.get("origem") ?? "";
  const grupos = params.get("grupos");

  return (
    <nav className="mt-4 space-y-1 px-2">
      <div className="px-2 pb-1 text-[10px] font-semibold uppercase tracking-widest text-slate-600">
        Universo
      </div>
      {ITENS.map((it) => {
        const ativo =
          pathname === "/" &&
          (it.chave === ""
            ? !origem && !grupos
            : it.chave === "grupos"
            ? grupos === "1"
            : origem === it.chave);
        return (
          <Link
            key={it.label}
            href={it.href}
            className={`relative flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors ${
              ativo ? "bg-ink-700 text-white" : "text-slate-400 hover:bg-ink-800 hover:text-slate-200"
            }`}
          >
            {ativo && <span className="absolute left-0 top-1/2 h-5 w-0.5 -translate-y-1/2 rounded bg-brand" />}
            <span className={ativo ? "text-brand-bright" : ""}>{it.icone}</span>
            <span className="hidden lg:inline">{it.label}</span>
          </Link>
        );
      })}
    </nav>
  );
}

export default function Sidebar() {
  return (
    <aside className="fixed inset-y-0 left-0 z-30 flex w-14 flex-col border-r border-edge bg-ink-950 lg:w-56">
      <Link href="/" className="flex items-center gap-2.5 px-3 pt-4 lg:px-4">
        <ShieldLogo />
        <span className="hidden leading-tight lg:block">
          <span className="block text-[13px] font-bold tracking-[0.2em] text-white">CERTIK</span>
          <span className="block text-[9px] font-medium tracking-[0.35em] text-slate-500">— SKYNET —</span>
        </span>
      </Link>
      <div className="hidden px-4 pt-2 text-[10px] font-medium uppercase tracking-widest text-brand-bright lg:block">
        Monitor Brasil
      </div>
      <Suspense fallback={null}>
        <Nav />
      </Suspense>
      <div className="mt-auto hidden border-t border-edge px-4 py-3 text-[10px] leading-relaxed text-slate-600 lg:block">
        Universo PSAV
        <br />
        Res. BCB 520 · uso interno
      </div>
    </aside>
  );
}
