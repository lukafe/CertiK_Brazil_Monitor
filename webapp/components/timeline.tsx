"use client";

import { useMemo, useState } from "react";
import type { Fato } from "@/lib/db";
import { limparDescricao } from "@/components/ui";

/** Badge por tipo de fato — gramática de 3 tons (accent/info/neutral). */
const TOM = {
  accent: "border-accent/25 bg-accent/10 text-accent",
  info: "border-info/25 bg-info/10 text-info",
  neutral: "border-edge bg-surface-raised text-fg-secondary",
};

export const TIPO_BADGE: Record<string, { rotulo: string; cls: string }> = {
  noticia: { rotulo: "News", cls: TOM.info },
  site: { rotulo: "Website", cls: TOM.neutral },
  vaga: { rotulo: "Job opening", cls: TOM.neutral },
  pessoa: { rotulo: "Person", cls: TOM.info },
  associacao: { rotulo: "Association", cls: TOM.accent },
  evento: { rotulo: "Event", cls: TOM.neutral },
  manual: { rotulo: "Curation", cls: TOM.neutral },
};

const PERIODOS: [string, number | null][] = [
  ["7 days", 7],
  ["30 days", 30],
  ["90 days", 90],
  ["All", null],
];

export function TipoBadge({ tipo }: { tipo: string }) {
  const b = TIPO_BADGE[tipo] ?? { rotulo: tipo, cls: TOM.neutral };
  return (
    <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-medium ${b.cls}`}>
      {b.rotulo}
    </span>
  );
}

function dataDoFato(f: Fato): string {
  return (f.data && f.data.length >= 10 ? f.data : f.criado_em ?? "").slice(0, 10);
}

export default function Timeline({ fatos }: { fatos: Fato[] }) {
  const [tipo, setTipo] = useState<string | null>(null);
  const [dias, setDias] = useState<number | null>(null);

  const tiposPresentes = useMemo(
    () => Object.keys(TIPO_BADGE).filter((t) => fatos.some((f) => f.tipo === t)),
    [fatos]
  );

  const visiveis = useMemo(() => {
    let corte = "";
    if (dias !== null) {
      const d = new Date();
      d.setDate(d.getDate() - dias);
      corte = d.toISOString().slice(0, 10);
    }
    return fatos.filter((f) => (!tipo || f.tipo === tipo) && (!corte || dataDoFato(f) >= corte));
  }, [fatos, tipo, dias]);

  return (
    <div>
      <div className="flex flex-wrap items-center gap-1.5 border-b border-edge px-4 py-3">
        <button
          onClick={() => setTipo(null)}
          className={`rounded-full border px-2.5 py-1 text-[11px] transition-colors ${
            tipo === null ? "border-accent/50 bg-accent/15 text-accent" : "border-edge bg-surface-raised text-fg-secondary hover:text-fg"
          }`}
        >
          All ({fatos.length})
        </button>
        {tiposPresentes.map((t) => (
          <button
            key={t}
            onClick={() => setTipo(tipo === t ? null : t)}
            className={`rounded-full border px-2.5 py-1 text-[11px] transition-colors ${
              tipo === t ? "border-accent/50 bg-accent/15 text-accent" : "border-edge bg-surface-raised text-fg-secondary hover:text-fg"
            }`}
          >
            {TIPO_BADGE[t].rotulo} ({fatos.filter((f) => f.tipo === t).length})
          </button>
        ))}
        <div className="ml-auto flex gap-1">
          {PERIODOS.map(([rotulo, d]) => (
            <button
              key={rotulo}
              onClick={() => setDias(d)}
              className={`rounded px-2 py-1 text-[11px] transition-colors ${
                dias === d ? "bg-accent/15 text-accent" : "text-fg-muted hover:text-fg-secondary"
              }`}
            >
              {rotulo}
            </button>
          ))}
        </div>
      </div>

      {visiveis.length ? (
        <ol className="relative m-4 space-y-5 border-l border-edge pl-4">
          {visiveis.map((f, i) => (
            <li key={i} className="relative">
              <span className="absolute -left-[21.5px] top-1.5 h-2 w-2 rounded-full bg-accent/70" />
              <div className="flex flex-wrap items-center gap-2 text-[10px] text-fg-muted">
                <span className="font-mono">{dataDoFato(f)}</span>
                <TipoBadge tipo={f.tipo} />
                {f.fonte && <span>source: {f.fonte}</span>}
                <span>confidence {(f.confianca * 100).toFixed(0)}%</span>
              </div>
              <div className="mt-0.5 text-sm leading-relaxed text-fg-secondary">
                {limparDescricao(f.descricao)}
                {f.url && (
                  <a href={f.url} target="_blank" rel="noopener noreferrer" className="ml-2 text-accent/80 hover:text-accent">
                    link ↗
                  </a>
                )}
              </div>
            </li>
          ))}
        </ol>
      ) : (
        <p className="p-4 text-sm text-fg-muted">No facts match the selected filter.</p>
      )}
    </div>
  );
}
