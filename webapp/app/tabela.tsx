"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import type { InstComLinks } from "@/lib/db";
import { Avatar, LinksExternos, NOTAS, NotaBadge, OrigemChip, ScoreChip, ViaChip, segCurto } from "@/components/ui";

function Sinal({ on, title, children }: { on: boolean; title: string; children: React.ReactNode }) {
  return (
    <span
      title={title}
      className={`inline-flex h-6 w-6 items-center justify-center rounded text-xs ${
        on ? "bg-certik/15 text-certik" : "bg-ink-700 text-slate-600"
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

type ColOrd = "rating" | "razao_social" | "segmento" | "uf";
const PAGINA = 50;

export default function Tabela({
  rows,
  buscaInicial = "",
  origemInicial = "",
  soGrupos = false,
}: {
  rows: InstComLinks[];
  buscaInicial?: string;
  origemInicial?: string;
  soGrupos?: boolean;
}) {
  const [busca, setBusca] = useState(buscaInicial);
  const [origem, setOrigem] = useState(origemInicial);
  const [segmento, setSegmento] = useState("");
  const [uf, setUf] = useState("");
  const [via, setVia] = useState("");
  const [notaMin, setNotaMin] = useState("");
  const [capMin, setCapMin] = useState(0);
  const [soAtivas, setSoAtivas] = useState(false);
  const [comAssociacao, setComAssociacao] = useState(false);
  const [agrupar, setAgrupar] = useState(true);
  const [ordCol, setOrdCol] = useState<ColOrd>("rating");
  const [ordAsc, setOrdAsc] = useState(false);
  const [limite, setLimite] = useState(PAGINA);

  useEffect(() => setBusca(buscaInicial), [buscaInicial]);
  useEffect(() => setOrigem(origemInicial), [origemInicial]);

  const segmentos = useMemo(() => Array.from(new Set(rows.map((r) => r.segmento))).sort(), [rows]);
  const ufs = useMemo(() => Array.from(new Set(rows.map((r) => r.uf).filter(Boolean))).sort() as string[], [rows]);

  const filtradas = useMemo(() => {
    const q = busca.toLowerCase();
    const notaIdx = notaMin ? NOTAS.indexOf(notaMin) : NOTAS.length - 1;
    const out = rows.filter(
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
        (!comAssociacao || (r.ecossistema ?? 0) > 0) &&
        (!soGrupos || !!r.grupo_id)
    );
    const dir = ordAsc ? 1 : -1;
    out.sort((a, b) => {
      if (ordCol === "rating") return dir * (a.rating - b.rating);
      const va = (a[ordCol] ?? "") as string;
      const vb = (b[ordCol] ?? "") as string;
      return dir * va.localeCompare(vb, "pt-BR");
    });
    return out;
  }, [rows, busca, origem, segmento, uf, via, notaMin, capMin, soAtivas, comAssociacao, soGrupos, ordCol, ordAsc]);

  // Unifica entidades do mesmo grupo: mantém a primeira (melhor na ordenação) e conta as demais
  const exibidas = useMemo(() => {
    if (!agrupar) return filtradas.map((r) => ({ r, extras: 0 }));
    const nPorGrupo = new Map<string, number>();
    for (const r of filtradas) {
      if (r.grupo_id) nPorGrupo.set(r.grupo_id, (nPorGrupo.get(r.grupo_id) ?? 0) + 1);
    }
    const vistos = new Set<string>();
    const out: { r: InstComLinks; extras: number }[] = [];
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

  useEffect(() => setLimite(PAGINA), [busca, origem, segmento, uf, via, notaMin, capMin, soAtivas, comAssociacao, agrupar, soGrupos]);

  const pagina = exibidas.slice(0, limite);

  function ordenar(col: ColOrd) {
    if (ordCol === col) setOrdAsc(!ordAsc);
    else {
      setOrdCol(col);
      setOrdAsc(col !== "rating");
    }
  }

  function Th({ col, children }: { col?: ColOrd; children: React.ReactNode }) {
    return (
      <th className="px-3 py-2.5 font-medium">
        {col ? (
          <button
            onClick={() => ordenar(col)}
            className={`inline-flex items-center gap-1 uppercase tracking-wider transition-colors hover:text-slate-300 ${
              ordCol === col ? "text-certik" : ""
            }`}
          >
            {children}
            {ordCol === col && <span className="text-[9px]">{ordAsc ? "▲" : "▼"}</span>}
          </button>
        ) : (
          children
        )}
      </th>
    );
  }

  const sel =
    "rounded-lg border border-edge bg-ink-900 px-2.5 py-1.5 text-xs text-slate-300 outline-none focus:border-certik/50";
  const chk = "flex cursor-pointer items-center gap-1.5 text-xs text-slate-400";

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <input
          className={`${sel} w-56`}
          placeholder="Filtrar nome, CNPJ ou sócio..."
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
            <option key={s} value={s}>
              {segCurto(s)}
            </option>
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
        <label className={chk}>
          <input type="checkbox" checked={soAtivas} onChange={(e) => setSoAtivas(e.target.checked)} className="accent-[#3fe0a8]" />
          só ativas
        </label>
        <label className={chk}>
          <input type="checkbox" checked={comAssociacao} onChange={(e) => setComAssociacao(e.target.checked)} className="accent-[#3fe0a8]" />
          em associação
        </label>
        <label className={chk}>
          <input type="checkbox" checked={agrupar} onChange={(e) => setAgrupar(e.target.checked)} className="accent-[#3fe0a8]" />
          unificar grupos
        </label>
        <span className="ml-auto text-xs tabular-nums text-slate-500">
          {agrupar ? `${exibidas.length} grupos/instituições · ${filtradas.length} entidades` : `${filtradas.length} entidades`}
        </span>
      </div>

      <div className="overflow-x-auto rounded-xl border border-edge bg-ink-900">
        <table className="w-full text-sm">
          <thead className="sticky top-0 z-10 bg-ink-900 text-left text-[11px] uppercase tracking-wider text-slate-500">
            <tr className="border-b border-edge">
              <th className="px-3 py-2.5 font-medium">#</th>
              <Th col="razao_social">Instituição</Th>
              <Th col="rating">Score</Th>
              <th className="px-3 py-2.5 font-medium">Via BCB</th>
              <th className="px-3 py-2.5 font-medium">Origem</th>
              <Th col="segmento">Segmento</Th>
              <th className="px-3 py-2.5 font-medium">Sinais</th>
              <th className="px-3 py-2.5 font-medium">Links</th>
              <Th col="uf">UF</Th>
            </tr>
          </thead>
          <tbody>
            {pagina.map(({ r, extras }, i) => (
              <tr key={r.cnpj} className="border-t border-edge/60 transition-colors even:bg-ink-800/30 hover:bg-ink-800">
                <td className="px-3 py-2 text-xs tabular-nums text-slate-600">
                  <span className="inline-flex min-w-[26px] justify-center rounded bg-ink-700 px-1 py-0.5">{i + 1}</span>
                </td>
                <td className="px-3 py-2">
                  <div className="flex items-center gap-2.5">
                    <Avatar nome={r.nome_fantasia || r.razao_social} size={28} />
                    <div className="min-w-0">
                      <Link href={`/inst/${r.cnpj}`} title={r.razao_social} className="font-medium text-slate-100 hover:text-certik">
                        {r.razao_social}
                      </Link>
                      {extras > 0 && (
                        <span
                          className="ml-2 rounded-full border border-edge bg-ink-700 px-2 py-0.5 text-[10px] text-slate-300"
                          title={`Grupo ${r.grupo_nome}: mais ${extras} entidade${extras > 1 ? "s" : ""} no universo`}
                        >
                          ⛓ +{extras}
                        </span>
                      )}
                      {r.nome_fantasia && <div className="truncate text-xs text-slate-500">{r.nome_fantasia}</div>}
                    </div>
                  </div>
                </td>
                <td className="px-3 py-2">
                  <span className="inline-flex items-center gap-1.5">
                    <ScoreChip score={r.rating} />
                    <NotaBadge nota={r.nota} />
                  </span>
                </td>
                <td className="px-3 py-2">
                  <ViaChip via={r.via} />
                </td>
                <td className="px-3 py-2">
                  <OrigemChip origem={r.origem} />
                </td>
                <td className="px-3 py-2 text-xs text-slate-400" title={r.segmento}>
                  {segCurto(r.segmento)}
                </td>
                <td className="px-3 py-2">
                  <div className="flex gap-1">
                    <Sinal on={(r.ecossistema ?? 0) > 0} title="Membro de associação do setor">🤝</Sinal>
                    <Sinal on={r.sinal_grupo_spsav === 1 || !!r.socio_comum} title="Grupo econômico / sócio ligado a SPSAV">🔗</Sinal>
                    <Sinal on={r.sinal_site === 1} title="Site menciona cripto/tokenização">🌐</Sinal>
                    <Sinal on={r.sinal_noticias === 1} title="Notícias de atividade em ativos virtuais">📰</Sinal>
                  </div>
                </td>
                <td className="px-3 py-2">
                  <LinksExternos mini fallback={false} links={r.links} nome={r.razao_social} />
                </td>
                <td className="px-3 py-2 text-xs text-slate-400">{r.uf}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {limite < exibidas.length && (
          <div className="border-t border-edge p-3 text-center">
            <button
              onClick={() => setLimite(limite + PAGINA)}
              className="rounded-lg border border-edge bg-ink-800 px-4 py-2 text-xs font-medium text-slate-300 transition-colors hover:border-certik/40 hover:text-certik"
            >
              Mostrar mais ({exibidas.length - limite} restantes)
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
