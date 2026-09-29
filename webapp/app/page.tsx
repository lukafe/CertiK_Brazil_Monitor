import Link from "next/link";
import { Suspense } from "react";
import { getFeedFatos, getSetores, getStats, getUltimos7Dias, listInstituicoes } from "@/lib/db";
import { Avatar, NotaBadge, Painel, ScoreChip, limparDescricao, segCurto } from "@/components/ui";
import { TipoBadge } from "@/components/timeline";
import Tabela from "./tabela";
import Destaques from "./destaques";

function fmtFeedData(d: string) {
  // "YYYY-MM-DD HH:MM:SS" → "MM-DD HH:MM"
  const m = d.match(/^\d{4}-(\d{2})-(\d{2})[ T](\d{2}:\d{2})/);
  return m ? { dia: `${m[1]}/${m[2]}`, hora: m[3] } : { dia: d.slice(0, 10), hora: "" };
}

const TIPO_FEED: Record<string, string> = {
  noticia: "News",
  site: "Website",
  associacao: "Association",
  evento: "Event",
};

export default function Home() {
  const stats = getStats();
  const rows = listInstituicoes();
  const setores = getSetores();
  const feed = getFeedFatos(25);
  const ultimos7 = getUltimos7Dias(12);

  const mediaGeral = setores.reduce((s, x) => s + x.media * x.n, 0) / Math.max(1, setores.reduce((s, x) => s + x.n, 0));

  const miniStats = [
    { label: "SPSAVs", value: stats.spsav, accent: "text-accent" },
    { label: "Eligible incumbents", value: stats.incumbentes, accent: "text-info" },
    { label: "Incumbents with signal", value: stats.comSinal, accent: "text-score-3" },
    { label: "Reference month", value: stats.mesRef, accent: "text-fg-secondary" },
  ];

  return (
    <div className="grid gap-5 xl:grid-cols-[1fr_360px]">
      <div className="min-w-0 space-y-5">
        <Suspense>
          <Destaques rows={rows} />
        </Suspense>

        {ultimos7.length > 0 && (
          <Painel
            titulo={
              <span className="flex items-center gap-2">
                Last 7 days
                <span className="rounded-full border border-accent/25 bg-accent/10 px-2 py-0.5 text-[10px] font-semibold text-accent">
                  {ultimos7.length} facts
                </span>
              </span>
            }
            acao={<span className="text-[11px] text-fg-muted">Continuous monitoring</span>}
          >
            <ul className="divide-y divide-edge">
              {ultimos7.map((f, i) => (
                <li key={i} className="flex items-start gap-3 px-4 py-2.5">
                  <span className="mt-0.5 shrink-0 font-mono text-[10px] text-fg-muted">
                    {fmtFeedData(f.criado_em).dia}
                  </span>
                  <span className="shrink-0">
                    <TipoBadge tipo={f.tipo} />
                  </span>
                  <span className="min-w-0 flex-1 text-xs leading-relaxed text-fg-secondary">
                    <span className="line-clamp-2">{limparDescricao(f.descricao)}</span>
                    {f.url && (
                      <a
                        href={f.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-[11px] text-fg-muted hover:text-accent"
                      >
                        link ↗
                      </a>
                    )}
                  </span>
                  <Link
                    href={`/inst/${f.cnpj}`}
                    title={f.razao_social}
                    className="flex shrink-0 items-center gap-1.5 text-[11px] font-medium text-fg-secondary hover:text-accent"
                  >
                    <Avatar nome={f.nome_fantasia || f.razao_social} size={18} />
                    <span className="hidden max-w-[130px] truncate md:inline">{f.nome_fantasia || f.razao_social}</span>
                    <NotaBadge nota={f.nota} />
                  </Link>
                </li>
              ))}
            </ul>
          </Painel>
        )}

        <section className="space-y-3">
          <div className="flex flex-wrap items-center gap-4">
            <h2 className="text-lg font-semibold text-fg">Leaderboard</h2>
            <div className="ml-auto flex flex-wrap gap-4">
              {miniStats.map((c) => (
                <div key={c.label} className="text-right">
                  <div className="text-[10px] uppercase tracking-wider text-fg-muted">{c.label}</div>
                  <div className={`text-sm font-semibold ${c.accent}`}>{c.value}</div>
                </div>
              ))}
            </div>
          </div>
          <Suspense>
            <Tabela rows={rows} />
          </Suspense>
        </section>
      </div>

      <div className="hidden space-y-5 xl:block">
        <Painel titulo="Segments" acao={<span className="rounded border border-edge bg-surface-raised px-2 py-0.5 text-[10px] text-fg-muted">Avg rating</span>}>
          <div className="grid grid-cols-2 gap-2 p-3">
            {setores.slice(0, 10).map((s) => {
              const acima = s.media >= mediaGeral;
              return (
                <div key={s.segmento} className="rounded-md border border-edge bg-surface-raised px-3 py-2.5">
                  <div className="truncate text-xs text-fg-secondary" title={s.segmento}>
                    {segCurto(s.segmento)}
                  </div>
                  <div className={`mt-1 flex items-center gap-1 text-sm font-semibold ${acima ? "text-accent" : "text-score-4"}`}>
                    <span>{acima ? "↗" : "↘"}</span>
                    {s.media.toFixed(1)}
                    <span className="ml-auto font-mono text-[10px] font-normal text-fg-muted">{s.n}</span>
                  </div>
                </div>
              );
            })}
          </div>
        </Painel>

        <Painel
          titulo={
            <span className="flex items-center gap-2">
              OSINT Feed
              <span className="inline-flex items-center gap-1.5 rounded-full border border-edge bg-surface-raised px-2 py-0.5 text-[10px] font-semibold text-fg-secondary">
                <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-alert" />
                {feed.length}
              </span>
            </span>
          }
          acao={<span className="text-[11px] text-fg-muted">Latest</span>}
        >
          <ol className="relative m-4 space-y-5 border-l border-edge pl-4">
            {feed.map((f, i) => {
              const { dia, hora } = fmtFeedData(f.criado_em);
              return (
                <li key={i} className="relative">
                  <span className="absolute -left-[21.5px] top-1.5 h-2 w-2 rounded-full bg-accent/70" />
                  <div className="flex items-baseline gap-2 text-[10px] text-fg-muted">
                    <span className="font-mono">{hora || dia}</span>
                    <span className="uppercase tracking-wide">{TIPO_FEED[f.tipo] ?? f.tipo}</span>
                  </div>
                  <div className="mt-0.5 line-clamp-3 text-xs leading-relaxed text-fg-secondary">{limparDescricao(f.descricao)}</div>
                  <div className="mt-1.5 flex items-center gap-2">
                    <Avatar nome={f.nome_fantasia || f.razao_social} size={18} />
                    <Link
                      href={`/inst/${f.cnpj}`}
                      title={f.razao_social}
                      className="min-w-0 max-w-[150px] truncate text-[11px] font-medium text-fg-secondary hover:text-accent"
                    >
                      {f.nome_fantasia || f.razao_social}
                    </Link>
                    <ScoreChip score={f.rating} />
                    <NotaBadge nota={f.nota} />
                    {f.url && (
                      <a
                        href={f.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-[11px] text-fg-muted hover:text-accent"
                      >
                        ↗
                      </a>
                    )}
                  </div>
                </li>
              );
            })}
          </ol>
        </Painel>
      </div>
    </div>
  );
}
