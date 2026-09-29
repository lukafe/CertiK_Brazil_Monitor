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
    <header className="sticky top-0 z-20 border-b border-edge bg-surface/90 backdrop-blur">
      <div className="flex items-center gap-3 px-4 py-2.5 lg:px-6">
        <form action="/" className="relative w-full max-w-2xl">
          <svg
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.2"
            className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-fg-muted"
          >
            <circle cx="11" cy="11" r="7" />
            <path d="m20 20-3.5-3.5" />
          </svg>
          <input
            ref={inputRef}
            name="q"
            placeholder="Search by institution, CNPJ or partner..."
            className="w-full rounded-md border border-edge bg-surface-raised py-2 pl-10 pr-10 text-sm text-fg outline-none placeholder:text-fg-muted focus:border-accent/50"
          />
          <kbd className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 rounded border border-edge bg-surface-overlay px-1.5 py-0.5 text-[10px] text-fg-muted">
            /
          </kbd>
        </form>
        <div className="ml-auto flex shrink-0 items-center gap-2">
          <span className="hidden h-9 w-9 items-center justify-center rounded-md border border-edge bg-surface-raised text-fg-muted md:flex" title="Dark theme">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
              <path d="M21 12.8A9 9 0 1 1 11.2 3 7 7 0 0 0 21 12.8Z" />
            </svg>
          </span>
          <span className="rounded-md border border-edge px-3 py-2 text-xs font-medium text-fg-muted">
            Internal use
          </span>
        </div>
      </div>
    </header>
  );
}
