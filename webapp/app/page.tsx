import Link from "next/link";
import { getFeedFatos, getSetores, getStats, listInstituicoes, type InstComRating } from "@/lib/db";
import { Avatar, HexIcon, NotaBadge, Painel, ScoreChip, limparDescricao, segCurto } from "@/components/ui";
import Tabela from "./tabela";

export const dynamic = "force-dynamic";

function fmtFeedData(d: string) {
  // "YYYY-MM-DD HH:MM:SS" → "MM-DD HH:MM"
  const m = d.match(/^\d{4}-(\d{2})-(\d{2})[ T](\d{2}:\d{2})/);
  return m ? { dia: `${m[1]}/${m[2]}`, hora: m[3] } : { dia: d.slice(0, 10), hora: "" };
}

const TIPO_FEED: Record<string, string> = {
  noticia: "Notícia",
  site: "Site",
  associacao: "Associação",
  evento: "Evento",
};

function TrendingCard({ r }: { r: InstComRating }) {
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

export default function Home({ searchParams }: { searchParams: { q?: string; origem?: string; grupos?: string } }) {
  const stats = getStats();
  const rows = listInstituicoes();
  const setores = getSetores();
  const feed = getFeedFatos(25);

  const destaque = rows.slice(0, 8);
  const topSpsav = rows.filter((r) => r.origem === "SPSAV").slice(0, 5);
  const topInc = rows.filter((r) => r.origem === "INCUMBENTE").slice(0, 5);
  const sinalizadas = rows.filter((r) => r.origem === "INCUMBENTE" && r.score > 0).slice(0, 5);

  const mediaGeral = setores.reduce((s, x) => s + x.media * x.n, 0) / Math.max(1, setores.reduce((s, x) => s + x.n, 0));

  const miniStats = [
    { label: "SPSAVs", value: stats.spsav, accent: "text-certik" },
    { label: "Incumbentes elegíveis", value: stats.incumbentes, accent: "text-sky-400" },
    { label: "Incumbentes com sinal", value: stats.comSinal, accent: "text-amber-400" },
    { label: "Mês de referência", value: stats.mesRef, accent: "text-slate-300" },
  ];

  return (
    <div className="grid gap-5 xl:grid-cols-[1fr_360px]">
      <div className="min-w-0 space-y-5">
        <section>
          <div className="mb-3 flex items-center gap-2">
            <h2 className="text-lg font-semibold text-white">Instituições em destaque</h2>
            <span className="text-slate-600">›</span>
          </div>
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
            {destaque.map((r) => (
              <TrendingCard key={r.cnpj} r={r} />
            ))}
          </div>
        </section>

        <div className="grid gap-3 lg:grid-cols-3">
          <Ranking titulo="Top SPSAVs" itens={topSpsav} />
          <Ranking titulo="Top Incumbentes" itens={topInc} />
          <Ranking titulo="Incumbentes sinalizadas" itens={sinalizadas} />
        </div>

        <section className="space-y-3">
          <div className="flex flex-wrap items-center gap-4">
            <h2 className="text-lg font-semibold text-white">Leaderboard</h2>
            <div className="ml-auto flex flex-wrap gap-4">
              {miniStats.map((c) => (
                <div key={c.label} className="text-right">
                  <div className="text-[10px] uppercase tracking-wider text-slate-600">{c.label}</div>
                  <div className={`text-sm font-semibold ${c.accent}`}>{c.value}</div>
                </div>
              ))}
            </div>
          </div>
          <Tabela
            rows={rows}
            buscaInicial={searchParams.q ?? ""}
            origemInicial={searchParams.origem ?? ""}
            soGrupos={searchParams.grupos === "1"}
          />
        </section>
      </div>

      <div className="hidden space-y-5 xl:block">
        <Painel titulo="Segmentos" acao={<span className="rounded border border-edge bg-ink-800 px-2 py-0.5 text-[10px] text-slate-500">Rating médio</span>}>
          <div className="grid grid-cols-2 gap-2 p-3">
            {setores.slice(0, 10).map((s) => {
              const acima = s.media >= mediaGeral;
              return (
                <div key={s.segmento} className="rounded-lg border border-edge bg-ink-800 px-3 py-2.5">
                  <div className="truncate text-xs text-slate-300" title={s.segmento}>
                    {segCurto(s.segmento)}
                  </div>
                  <div className={`mt-1 flex items-center gap-1 text-sm font-semibold ${acima ? "text-certik" : "text-rose-400"}`}>
                    <span>{acima ? "↗" : "↘"}</span>
                    {s.media.toFixed(1)}
                    <span className="ml-auto text-[10px] font-normal text-slate-600">{s.n}</span>
                  </div>
                </div>
              );
            })}
          </div>
        </Painel>

        <Painel
          titulo={
            <span className="flex items-center gap-2">
              Feed OSINT
              <span className="rounded-full bg-rose-500/15 px-2 py-0.5 text-[10px] font-semibold text-rose-400">
                ((•)) {feed.length}
              </span>
            </span>
          }
          acao={<span className="text-[11px] text-slate-500">Mais recentes</span>}
        >
          <ol className="relative m-4 space-y-5 border-l border-dashed border-rose-500/30 pl-4">
            {feed.map((f, i) => {
              const { dia, hora } = fmtFeedData(f.criado_em);
              return (
                <li key={i} className="relative">
                  <span className="absolute -left-[21.5px] top-1.5 h-2 w-2 rounded-full bg-rose-500/70" />
                  <div className="flex items-baseline gap-2 text-[10px] text-slate-500">
                    <span className="font-mono text-rose-400/80">{hora || dia}</span>
                    <span className="uppercase tracking-wide">{TIPO_FEED[f.tipo] ?? f.tipo}</span>
                  </div>
                  <div className="mt-0.5 line-clamp-3 text-xs leading-relaxed text-slate-300">{limparDescricao(f.descricao)}</div>
                  <div className="mt-1.5 flex items-center gap-2">
                    <Avatar nome={f.nome_fantasia || f.razao_social} size={18} />
                    <Link
                      href={`/inst/${f.cnpj}`}
                      title={f.razao_social}
                      className="min-w-0 max-w-[150px] truncate text-[11px] font-medium text-slate-400 hover:text-certik"
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
                        className="text-[11px] text-slate-600 hover:text-certik"
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
