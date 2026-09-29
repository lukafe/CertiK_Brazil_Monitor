"use client";

import { useState } from "react";

export default function Share() {
  const [copiado, setCopiado] = useState(false);
  return (
    <span className="inline-flex items-center gap-1.5">
      <button
        title="Favorite"
        className="inline-flex h-7 w-7 items-center justify-center rounded-md border border-edge bg-surface-raised text-fg-muted transition-colors hover:border-accent/40 hover:text-accent"
      >
        ☆
      </button>
      <button
        title="Copy link"
        onClick={() => {
          navigator.clipboard?.writeText(window.location.href);
          setCopiado(true);
          setTimeout(() => setCopiado(false), 1500);
        }}
        className="inline-flex h-7 items-center justify-center gap-1 rounded-md border border-edge bg-surface-raised px-2 text-xs text-fg-muted transition-colors hover:border-accent/40 hover:text-accent"
      >
        {copiado ? "✓ copied" : "⤴ share"}
      </button>
    </span>
  );
}
