"use client";

import { useEffect, useRef } from "react";

export default function Topbar() {
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      if (e.key === "/" && document.activeElement?.tagName !== "INPUT") {
        e.preventDefault();
        inputRef.current?.focus();
      }
    };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, []);

  return (
    <header className="sticky top-0 z-20 border-b border-edge bg-ink-950/90 backdrop-blur">
      <div className="flex items-center gap-3 px-4 py-2.5 lg:px-6">
        <form action="/" className="relative w-full max-w-2xl">
          <svg
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="#f43f5e"
            strokeWidth="2.2"
            className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2"
          >
            <circle cx="11" cy="11" r="7" />
            <path d="m20 20-3.5-3.5" />
          </svg>
          <input
            ref={inputRef}
            name="q"
            placeholder="Buscar por instituição, CNPJ ou sócio..."
            className="w-full rounded-xl border border-edge bg-ink-900 py-2 pl-10 pr-10 text-sm text-slate-200 outline-none placeholder:text-slate-500 focus:border-certik/50"
          />
          <kbd className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 rounded border border-edge bg-ink-800 px-1.5 py-0.5 text-[10px] text-slate-500">
            /
          </kbd>
        </form>
        <a
          href="/aleatoria"
          className="flex shrink-0 items-center gap-1.5 rounded-xl border border-edge bg-ink-900 px-3 py-2 text-xs font-medium text-slate-300 transition-colors hover:border-certik/40 hover:text-certik"
        >
          ✨ Surprise Me
        </a>
        <div className="ml-auto flex shrink-0 items-center gap-2">
          <span className="hidden h-9 w-9 items-center justify-center rounded-xl border border-edge bg-ink-900 text-slate-500 md:flex" title="Tema escuro">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
              <path d="M21 12.8A9 9 0 1 1 11.2 3 7 7 0 0 0 21 12.8Z" />
            </svg>
          </span>
          <span className="hidden h-9 w-9 items-center justify-center rounded-xl border border-edge bg-ink-900 text-slate-500 md:flex" title="pt-BR">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6">
              <circle cx="12" cy="12" r="9" />
              <path d="M3 12h18M12 3c2.8 2.6 4 5.7 4 9s-1.2 6.4-4 9c-2.8-2.6-4-5.7-4-9s1.2-6.4 4-9Z" />
            </svg>
          </span>
          <span className="rounded-xl border border-edge bg-ink-900 px-3 py-2 text-xs font-medium text-slate-300">
            Uso interno
          </span>
        </div>
      </div>
    </header>
  );
}
