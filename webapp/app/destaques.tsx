"use client";

import Link from "next/link";
import { useMemo } from "react";
import { useSearchParams } from "next/navigation";
import type { InstComLinks, InstComRating } from "@/lib/db";
import { Avatar, HexIcon, NotaBadge, Painel, ScoreChip, TagChip, segCurto } from "@/components/ui";

function TrendingCard({ r }: { r: InstComLinks }) {
  const nome = r.nome_fantasia || r.razao_social;
  return (
    <Link
      href={`/inst/${r.cnpj}`}
      className="rounded-xl border border-edge bg-ink-900 p-3.5 transition-colors hover:border-certik/40 hover:bg-ink-800"
    >
      <div className="flex items-start gap-2.5">
        <Avatar nome={nome} size={34} />
        <div className="min-w-0">
          <div className="line-clamp-2 min-h-[2.5em] text-sm font-semibold leading-tight text-white" title={r.razao_social}>
            {nome}
          </div>
          <div className="truncate text-[11px] text-slate-500" title={r.segmento}>
            {segCurto(r.segmento)}
          </div>
        </div>
      </div>
      <div className="mt-3 flex items-center gap-1.5">
        <ScoreChip score={r.rating} />
        <HexIcon score={r.rating} />
        <NotaBadge nota={r.nota} />
      </div>
      {r.tags.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-1">
          {r.tags.slice(0, 2).map((t) => (
            <TagChip key={t} tag={t} mini />
          ))}
        </div>
      )}
    </Link>
  );
}

function Ranking({ titulo, itens }: { titulo: string; itens: InstComRating[] }) {
  return (
    <Painel titulo={titulo}>
      <ul className="divide-y divide-edge/60">
        {itens.map((r, i) => (
          <li key={r.cnpj}>
            <Link href={`/inst/${r.cnpj}`} className="flex items-center gap-2.5 px-4 py-2.5 transition-colors hover:bg-ink-800">
              <span className="inline-flex min-w-[26px] justify-center rounded bg-ink-700 px-1 py-0.5 text-[11px] text-slate-500">
                {i + 1}
              </span>
              <Avatar nome={r.nome_fantasia || r.razao_social} size={26} />
              <span className="min-w-0 flex-1 truncate text-sm font-medium text-slate-200" title={r.razao_social}>
                {r.nome_fantasia || r.razao_social}
              </span>
              <ScoreChip score={r.rating} />
              <span className="hidden lg:inline-flex">
                <HexIcon score={r.rating} />
              </span>
              <NotaBadge nota={r.nota} />
            </Link>
          </li>
        ))}
      </ul>
    </Painel>
  );
}

const UNIVERSO_LABEL: Record<string, string> = {
  SPSAV: "SPSAVs",
  INCUMBENTE: "Incumbents",
};

/** Featured cards + rankings that react to the sidebar filters (?origem=, ?grupos=1). */
export default function Destaques({ rows }: { rows: InstComLinks[] }) {
  const params = useSearchParams();
  const origem = params.get("origem") ?? "";
  const soGrupos = params.get("grupos") === "1";

  const filtradas = useMemo(() => {
    let out = rows;
    if (origem) out = out.filter((r) => r.origem === origem);
    if (soGrupos) {
      const vistos = new Set<string>();
      out = out.filter((r) => {
        if (!r.grupo_id || vistos.has(r.grupo_id)) return false;
        vistos.add(r.grupo_id);
        return true;
      });
    }
    return out;
  }, [rows, origem, soGrupos]);

  const destaque = filtradas.slice(0, 8);
  const topSpsav = rows.filter((r) => r.origem === "SPSAV").slice(0, 5);
  const topInc = rows.filter((r) => r.origem === "INCUMBENTE").slice(0, 5);
  const sinalizadas = rows.filter((r) => r.origem === "INCUMBENTE" && r.score > 0).slice(0, 5);

  const sufixo = soGrupos ? "Economic groups" : origem ? UNIVERSO_LABEL[origem] ?? origem : "";

  return (
    <>
      <section>
        <div className="mb-3 flex items-center gap-2">
          <h2 className="text-lg font-semibold text-white">Featured institutions</h2>
          {sufixo && (
            <span className="rounded-full border border-certik/40 bg-certik/10 px-2.5 py-0.5 text-[11px] font-medium text-certik">
              {sufixo}
            </span>
          )}
          <span className="text-slate-600">›</span>
        </div>
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          {destaque.map((r) => (
            <TrendingCard key={r.cnpj} r={r} />
          ))}
        </div>
      </section>

      <div className="grid gap-3 lg:grid-cols-3">
        {soGrupos ? (
          <Ranking titulo="Top economic groups" itens={filtradas.slice(0, 5)} />
        ) : origem === "SPSAV" ? (
          <Ranking titulo="Top SPSAVs" itens={topSpsav} />
        ) : origem === "INCUMBENTE" ? (
          <>
            <Ranking titulo="Top incumbents" itens={topInc} />
            <Ranking titulo="Flagged incumbents" itens={sinalizadas} />
          </>
        ) : (
          <>
            <Ranking titulo="Top SPSAVs" itens={topSpsav} />
            <Ranking titulo="Top incumbents" itens={topInc} />
            <Ranking titulo="Flagged incumbents" itens={sinalizadas} />
          </>
        )}
      </div>
    </>
  );
}
