"use client";

import { useMemo, useState } from "react";
import type { Fato } from "@/lib/db";
import { limparDescricao } from "@/components/ui";

/** Badge de cor por tipo de fato (Etapa 7 — timeline filtrável). */
export const TIPO_BADGE: Record<string, { rotulo: string; cls: string }> = {
  noticia: { rotulo: "📰 Notícia", cls: "bg-amber-500/15 text-amber-300 border-amber-500/30" },
  site: { rotulo: "🌐 Site", cls: "bg-sky-500/15 text-sky-300 border-sky-500/30" },
  vaga: { rotulo: "💼 Vaga", cls: "bg-violet-500/15 text-violet-300 border-violet-500/30" },
  pessoa: { rotulo: "👤 Pessoa", cls: "bg-rose-500/15 text-rose-300 border-rose-500/30" },
  associacao: { rotulo: "🤝 Associação", cls: "bg-emerald-500/15 text-emerald-300 border-emerald-500/30" },
  evento: { rotulo: "🎤 Evento", cls: "bg-orange-500/15 text-orange-300 border-orange-500/30" },
  manual: { rotulo: "✍️ Curadoria", cls: "bg-ink-700 text-slate-400 border-edge" },
};

const PERIODOS: [string, number | null][] = [
  ["7 dias", 7],
  ["30 dias", 30],
  ["90 dias", 90],
  ["Tudo", null],
];

export function TipoBadge({ tipo }: { tipo: string }) {
  const b = TIPO_BADGE[tipo] ?? { rotulo: tipo, cls: "bg-ink-700 text-slate-400 border-edge" };
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
      <div className="flex flex-wrap items-center gap-1.5 border-b border-edge/60 px-4 py-3">
        <button
          onClick={() => setTipo(null)}
          className={`rounded-full border px-2.5 py-1 text-[11px] transition-colors ${
            tipo === null ? "border-certik/50 bg-certik/15 text-certik" : "border-edge bg-ink-800 text-slate-400 hover:text-slate-200"
          }`}
        >
          Todos ({fatos.length})
        </button>
        {tiposPresentes.map((t) => (
          <button
            key={t}
            onClick={() => setTipo(tipo === t ? null : t)}
            className={`rounded-full border px-2.5 py-1 text-[11px] transition-colors ${
              tipo === t ? "border-certik/50 bg-certik/15 text-certik" : "border-edge bg-ink-800 text-slate-400 hover:text-slate-200"
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
                dias === d ? "bg-certik/15 text-certik" : "text-slate-500 hover:text-slate-300"
              }`}
            >
              {rotulo}
            </button>
          ))}
        </div>
      </div>

      {visiveis.length ? (
        <ol className="relative m-4 space-y-5 border-l border-dashed border-rose-500/30 pl-4">
          {visiveis.map((f, i) => (
            <li key={i} className="relative">
              <span className="absolute -left-[21.5px] top-1.5 h-2 w-2 rounded-full bg-rose-500/70" />
              <div className="flex flex-wrap items-center gap-2 text-[10px] text-slate-500">
                <span className="font-mono text-rose-400/80">{dataDoFato(f)}</span>
                <TipoBadge tipo={f.tipo} />
                {f.fonte && <span>fonte: {f.fonte}</span>}
                <span>confiança {(f.confianca * 100).toFixed(0)}%</span>
              </div>
              <div className="mt-0.5 text-sm leading-relaxed text-slate-300">
                {limparDescricao(f.descricao)}
                {f.url && (
                  <a href={f.url} target="_blank" rel="noopener noreferrer" className="ml-2 text-certik/80 hover:text-certik">
                    link ↗
                  </a>
                )}
              </div>
            </li>
          ))}
        </ol>
      ) : (
        <p className="p-4 text-sm text-slate-500">Nenhum fato no filtro selecionado.</p>
      )}
    </div>
  );
}
