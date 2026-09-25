"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import type { InstComRating } from "@/lib/db";

export const NOTAS = ["AAA", "AA", "A", "BBB", "BB", "B", "D"];

export function notaCor(nota: string) {
  if (nota === "AAA" || nota === "AA") return "bg-emerald-500/20 text-emerald-300 border-emerald-500/40";
  if (nota === "A" || nota === "BBB") return "bg-amber-500/15 text-amber-300 border-amber-500/40";
  if (nota === "BB" || nota === "B") return "bg-orange-500/15 text-orange-300 border-orange-500/40";
  return "bg-slate-800 text-slate-500 border-slate-700";
}

export function NotaBadge({ nota, rating }: { nota: string; rating: number }) {
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-md border px-2 py-0.5 ${notaCor(nota)}`}>
      <span className="text-sm font-bold">{nota}</span>
      <span className="text-xs opacity-80">{rating.toFixed(0)}</span>
    </span>
  );
}

function Sinal({ on, title, children }: { on: boolean; title: string; children: React.ReactNode }) {
  return (
    <span
      title={title}
      className={`inline-flex h-6 w-6 items-center justify-center rounded text-xs ${
        on ? "bg-emerald-500/20 text-emerald-300" : "bg-slate-800/60 text-slate-600"
      }`}
    >
      {children}
    </span>
  );
}

function capitalNum(c: string | null) {
  const n = Number((c ?? "0").replace(",", "."));
  return isNaN(n) ? 0 : n;
}

export default function Tabela({ rows }: { rows: InstComRating[] }) {
  const [busca, setBusca] = useState("");
  const [origem, setOrigem] = useState("");
  const [segmento, setSegmento] = useState("");
  const [uf, setUf] = useState("");
  const [via, setVia] = useState("");
  const [notaMin, setNotaMin] = useState("");
  const [capMin, setCapMin] = useState(0);
  const [soAtivas, setSoAtivas] = useState(false);
  const [comAssociacao, setComAssociacao] = useState(false);
  const [agrupar, setAgrupar] = useState(true);

  const segmentos = useMemo(() => Array.from(new Set(rows.map((r) => r.segmento))).sort(), [rows]);
  const ufs = useMemo(() => Array.from(new Set(rows.map((r) => r.uf).filter(Boolean))).sort() as string[], [rows]);

  const filtradas = useMemo(() => {
    const q = busca.toLowerCase();
    const notaIdx = notaMin ? NOTAS.indexOf(notaMin) : NOTAS.length - 1;
    return rows.filter(
      (r) =>
        (!q ||
          r.razao_social?.toLowerCase().includes(q) ||
          r.nome_fantasia?.toLowerCase().includes(q) ||
          r.cnpj.includes(q) ||
          r.socios?.toLowerCase().includes(q)) &&
        (!origem || r.origem === origem) &&
        (!segmento || r.segmento === segmento) &&
        (!uf || r.uf === uf) &&
        (!via || (r.via ?? "").startsWith(via)) &&
        NOTAS.indexOf(r.nota) <= notaIdx &&
        capitalNum(r.capital_social) >= capMin &&
        (!soAtivas || r.situacao === "02") &&
        (!comAssociacao || (r.ecossistema ?? 0) > 0)
    );
  }, [rows, busca, origem, segmento, uf, via, notaMin, capMin, soAtivas, comAssociacao]);

  // Unifica entidades do mesmo grupo: mantém a melhor ranqueada e conta as demais
  const exibidas = useMemo(() => {
    if (!agrupar) return filtradas.map((r) => ({ r, extras: 0 }));
    const nPorGrupo = new Map<string, number>();
    for (const r of filtradas) {
      if (r.grupo_id) nPorGrupo.set(r.grupo_id, (nPorGrupo.get(r.grupo_id) ?? 0) + 1);
    }
    const vistos = new Set<string>();
    const out: { r: InstComRating; extras: number }[] = [];
    for (const r of filtradas) {
      if (!r.grupo_id) {
        out.push({ r, extras: 0 });
      } else if (!vistos.has(r.grupo_id)) {
        vistos.add(r.grupo_id);
        out.push({ r, extras: (nPorGrupo.get(r.grupo_id) ?? 1) - 1 });
      }
    }
    return out;
  }, [filtradas, agrupar]);

  const sel = "rounded-lg border border-slate-800 bg-slate-900 px-3 py-2 text-sm outline-none focus:border-emerald-500";

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <input
          className={`${sel} w-64`}
          placeholder="Buscar nome, CNPJ ou sócio..."
          value={busca}
          onChange={(e) => setBusca(e.target.value)}
        />
        <select className={sel} value={origem} onChange={(e) => setOrigem(e.target.value)}>
          <option value="">Origem: todas</option>
          <option value="SPSAV">SPSAV</option>
          <option value="INCUMBENTE">Incumbente</option>
        </select>
        <select className={sel} value={via} onChange={(e) => setVia(e.target.value)}>
          <option value="">Via: todas</option>
          <option value="IN 701">IN 701 (comunicação)</option>
          <option value="IN 704">IN 704 (autorização)</option>
        </select>
        <select className={sel} value={notaMin} onChange={(e) => setNotaMin(e.target.value)}>
          <option value="">Nota: todas</option>
          {NOTAS.slice(0, 6).map((n) => (
            <option key={n} value={n}>
              ≥ {n}
            </option>
          ))}
        </select>
        <select className={sel} value={segmento} onChange={(e) => setSegmento(e.target.value)}>
          <option value="">Segmento: todos</option>
          {segmentos.map((s) => (
            <option key={s}>{s}</option>
          ))}
        </select>
        <select className={sel} value={uf} onChange={(e) => setUf(e.target.value)}>
          <option value="">UF: todas</option>
          {ufs.map((u) => (
            <option key={u}>{u}</option>
          ))}
        </select>
        <select className={sel} value={capMin} onChange={(e) => setCapMin(Number(e.target.value))}>
          <option value={0}>Capital: qualquer</option>
          <option value={1_000_000}>≥ R$ 1 mi</option>
          <option value={10_000_000}>≥ R$ 10 mi</option>
          <option value={100_000_000}>≥ R$ 100 mi</option>
          <option value={1_000_000_000}>≥ R$ 1 bi</option>
        </select>
        <label className="flex cursor-pointer items-center gap-1.5 text-sm text-slate-400">
          <input type="checkbox" checked={soAtivas} onChange={(e) => setSoAtivas(e.target.checked)} className="accent-emerald-400" />
          só ativas
        </label>
        <label className="flex cursor-pointer items-center gap-1.5 text-sm text-slate-400">
          <input type="checkbox" checked={comAssociacao} onChange={(e) => setComAssociacao(e.target.checked)} className="accent-emerald-400" />
          em associação
        </label>
        <label className="flex cursor-pointer items-center gap-1.5 text-sm text-slate-400">
          <input type="checkbox" checked={agrupar} onChange={(e) => setAgrupar(e.target.checked)} className="accent-emerald-400" />
          unificar grupos
        </label>
        <span className="ml-auto text-sm text-slate-500">
          {agrupar ? `${exibidas.length} grupos/instituições · ${filtradas.length} entidades` : `${filtradas.length} entidades`}
        </span>
      </div>

      <div className="overflow-x-auto rounded-xl border border-slate-800">
        <table className="w-full text-sm">
          <thead className="bg-slate-900/80 text-left text-xs uppercase tracking-wide text-slate-500">
            <tr>
              <th className="px-3 py-2">#</th>
              <th className="px-3 py-2">Instituição</th>
              <th className="px-3 py-2">Nota</th>
              <th className="px-3 py-2">Via BCB</th>
              <th className="px-3 py-2">Origem</th>
              <th className="px-3 py-2">Segmento</th>
              <th className="px-3 py-2">Sinais</th>
              <th className="px-3 py-2">UF</th>
            </tr>
          </thead>
          <tbody>
            {exibidas.map(({ r, extras }, i) => (
              <tr key={r.cnpj} className="border-t border-slate-800/60 hover:bg-slate-900/50">
                <td className="px-3 py-2 text-slate-600">{i + 1}</td>
                <td className="px-3 py-2">
                  <Link href={`/inst/${r.cnpj}`} className="font-medium text-slate-100 hover:text-emerald-400">
                    {r.razao_social}
                  </Link>
                  {extras > 0 && (
                    <span
                      className="ml-2 rounded-full border border-slate-700 bg-slate-800/80 px-2 py-0.5 text-xs text-slate-300"
                      title={`Grupo ${r.grupo_nome}: mais ${extras} entidade${extras > 1 ? "s" : ""} no universo`}
                    >
                      ⛓ +{extras} entidade{extras > 1 ? "s" : ""}
                    </span>
                  )}
                  {r.nome_fantasia && <div className="text-xs text-slate-500">{r.nome_fantasia}</div>}
                </td>
                <td className="px-3 py-2">
                  <NotaBadge nota={r.nota} rating={r.rating} />
                </td>
                <td className="px-3 py-2">
                  <span
                    className={`rounded px-1.5 py-0.5 text-xs ${
                      r.via?.startsWith("IN 701") ? "bg-cyan-500/10 text-cyan-400" : "bg-purple-500/10 text-purple-400"
                    }`}
                    title={r.via ?? ""}
                  >
                    {r.via?.startsWith("IN 701") ? "IN 701" : "IN 704"}
                  </span>
                </td>
                <td className="px-3 py-2">
                  <span
                    className={`rounded px-2 py-0.5 text-xs font-medium ${
                      r.origem === "SPSAV" ? "bg-emerald-500/15 text-emerald-300" : "bg-cyan-500/15 text-cyan-300"
                    }`}
                  >
                    {r.origem}
                  </span>
                </td>
                <td className="px-3 py-2 text-slate-400">{r.segmento}</td>
                <td className="px-3 py-2">
                  <div className="flex gap-1">
                    <Sinal on={(r.ecossistema ?? 0) > 0} title="Membro de associação do setor">🤝</Sinal>
                    <Sinal on={r.sinal_grupo_spsav === 1 || !!r.socio_comum} title="Grupo econômico / sócio ligado a SPSAV">🔗</Sinal>
                    <Sinal on={r.sinal_site === 1} title="Site menciona cripto/tokenização">🌐</Sinal>
                    <Sinal on={r.sinal_noticias === 1} title="Notícias de atividade em ativos virtuais">📰</Sinal>
                  </div>
                </td>
                <td className="px-3 py-2 text-slate-400">{r.uf}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
