"use client";

import { useState } from "react";

export default function Share() {
  const [copiado, setCopiado] = useState(false);
  return (
    <span className="inline-flex items-center gap-1.5">
      <button
        title="Favoritar"
        className="inline-flex h-7 w-7 items-center justify-center rounded-lg border border-edge bg-ink-800 text-slate-500 transition-colors hover:border-amber-500/40 hover:text-amber-300"
      >
        ☆
      </button>
      <button
        title="Copiar link"
        onClick={() => {
          navigator.clipboard?.writeText(window.location.href);
          setCopiado(true);
          setTimeout(() => setCopiado(false), 1500);
        }}
        className="inline-flex h-7 items-center justify-center gap-1 rounded-lg border border-edge bg-ink-800 px-2 text-xs text-slate-500 transition-colors hover:border-certik/40 hover:text-certik"
      >
        {copiado ? "✓ copiado" : "⤴ compartilhar"}
      </button>
    </span>
  );
}
