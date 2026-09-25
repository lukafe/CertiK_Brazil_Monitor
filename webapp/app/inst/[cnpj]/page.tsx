import Link from "next/link";
import { notFound } from "next/navigation";
import { getEventos, getFatos, getGrupoMembros, getInstituicao, getSnapshots, montarLinks } from "@/lib/db";
import { Avatar, LinksExternos, NotaBadge, OrigemChip, Painel, ViaChip, limparDescricao, segCurto } from "@/components/ui";
import Radar from "@/components/radar";
import Sparkline from "@/components/sparkline";
import Share from "@/components/share";

export const dynamic = "force-dynamic";

function fmtCnpj(c: string) {
  return c.length === 14
    ? `${c.slice(0, 2)}.${c.slice(2, 5)}.${c.slice(5, 8)}/${c.slice(8, 12)}-${c.slice(12)}`
    : c;
}

function fmtData(d: string | null) {
  return d && d.length === 8 ? `${d.slice(6)}/${d.slice(4, 6)}/${d.slice(0, 4)}` : d ?? "—";
}

function fmtCapital(c: string | null) {
  if (!c) return "—";
  const n = Number(c.replace(",", "."));
  if (isNaN(n)) return c;
  if (n >= 1e9) return `R$ ${(n / 1e9).toFixed(2)}B`;
  if (n >= 1e6) return `R$ ${(n / 1e6).toFixed(1)}M`;
  return n.toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });
}

function Campo({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="text-[10px] uppercase tracking-wider text-slate-600">{label}</div>
      <div className="mt-0.5 text-sm text-slate-200">{children || "—"}</div>
    </div>
  );
}

function PilarBar({ nome, peso, valor }: { nome: string; peso: number; valor: number | null }) {
  const v = valor ?? 0;
  const cor = v >= 70 ? "bg-certik" : v >= 40 ? "bg-amber-400" : "bg-ink-600";
  return (
    <div>
      <div className="mb-1 flex items-baseline justify-between text-xs">
        <span className="text-slate-300">
          {nome} <span className="text-slate-600">({(peso * 100).toFixed(0)}%)</span>
        </span>
        <span className="font-mono text-slate-400">{v.toFixed(0)}</span>
      </div>
      <div className="h-1.5 w-full rounded bg-ink-700">
        <div className={`h-1.5 rounded ${cor}`} style={{ width: `${Math.min(100, v)}%` }} />
      </div>
    </div>
  );
}

function SinalLinha({ nome, on, evidencia }: { nome: string; on: boolean | null; evidencia?: string | null }) {
  return (
    <div className="flex items-start justify-between gap-3 border-b border-edge/60 py-2.5 last:border-0">
      <div className="min-w-0">
        <div className="text-sm text-slate-300">{nome}</div>
        {evidencia && <div className="mt-1 break-words text-xs text-slate-500">{evidencia}</div>}
      </div>
      <span
        className={`inline-flex shrink-0 items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium ${
          on ? "bg-certik/15 text-certik" : "bg-ink-700 text-slate-500"
        }`}
      >
        <span
          className={`inline-flex h-3.5 w-3.5 items-center justify-center rounded-full text-[9px] ${
            on ? "bg-certik text-black" : "bg-ink-600 text-slate-500"
          }`}
        >
          {on ? "✓" : "–"}
        </span>
        {on ? "Detectado" : "Não detectado"}
      </span>
    </div>
  );
}

const TIPO_FATO: Record<string, string> = {
  associacao: "🤝 Associação",
  evento: "🎤 Evento",
  noticia: "📰 Notícia",
  site: "🌐 Site",
  pessoa: "👤 Pessoa-chave",
  manual: "✍️ Curadoria",
};

const TABS: [string, string][] = [
  ["#visao", "Pulse Feed"],
  ["#regulatorio", "Regulatório"],
  ["#sinais", "Sinais"],
  ["#cadastro", "Cadastro"],
  ["#grupo", "Grupo"],
  ["#socios", "Sócios"],
];

export default function InstituicaoPage({ params }: { params: { cnpj: string } }) {
  const inst = getInstituicao(params.cnpj);
  if (!inst) notFound();
  const snapshots = getSnapshots(params.cnpj);
  const eventos = getEventos(params.cnpj);
  const fatos = getFatos(params.cnpj);
  const grupo = inst.grupo_id ? getGrupoMembros(inst.grupo_id).filter((m) => m.cnpj !== inst.cnpj) : [];

  const pilares: [string, number, number | null][] = [
    ["Regulatório", 0.3, inst.regulatorio],
    ["Atividade pública", 0.25, inst.atividade],
    ["Ecossistema", 0.2, inst.ecossistema],
    ["Pessoas", 0.15, inst.pessoas],
    ["Solidez", 0.1, inst.solidez],
  ];

  const nNoticias = fatos.filter((f) => f.tipo === "noticia").length;
  const nPessoas = fatos.filter((f) => f.tipo === "pessoa").length;
  const nSinais = [inst.sinal_grupo_spsav, inst.sinal_site, inst.sinal_noticias, inst.sinal_nome].filter(
    (s) => s === 1
  ).length;

  const nome = inst.nome_fantasia || inst.razao_social;
  const links = montarLinks(fatos.map((f) => ({ fonte: f.fonte, url: f.url })), inst.email);

  return (
    <div className="grid gap-5 xl:grid-cols-[1fr_400px]">
      {/* ============ coluna esquerda ============ */}
      <div className="min-w-0 space-y-5">
        <div className="flex flex-wrap items-center gap-1 border-b border-edge pb-0">
          <Link href="/" className="mr-3 flex items-center gap-1.5 pb-3 text-sm text-slate-500 hover:text-white">
            ← Back
          </Link>
          {TABS.filter(([href]) => {
            if (href === "#sinais") return inst.origem === "INCUMBENTE";
            if (href === "#grupo") return grupo.length > 0;
            if (href === "#socios") return !!inst.socios;
            return true;
          }).map(([href, label], i) => (
            <a
              key={href}
              href={href}
              className={`border-b-2 px-3 pb-3 text-sm font-medium transition-colors ${
                i === 0
                  ? "border-white text-white"
                  : "border-transparent text-slate-500 hover:border-slate-600 hover:text-slate-300"
              }`}
            >
              {label}
            </a>
          ))}
        </div>

        <Painel
          id="visao"
          className="scroll-mt-20"
          titulo={
            <span className="flex items-center gap-2">
              Pulse Feed & Fatos
              <span className="rounded-full bg-rose-500/15 px-2 py-0.5 text-[10px] font-semibold text-rose-400">
                {fatos.length}
              </span>
            </span>
          }
        >
          {fatos.length ? (
            <ol className="relative m-4 space-y-5 border-l border-dashed border-rose-500/30 pl-4">
              {fatos.map((f, i) => (
                <li key={i} className="relative">
                  <span className="absolute -left-[21.5px] top-1.5 h-2 w-2 rounded-full bg-rose-500/70" />
                  <div className="flex flex-wrap items-baseline gap-2 text-[10px] text-slate-500">
                    <span className="font-mono text-rose-400/80">{f.criado_em?.slice(0, 16)}</span>
                    <span className="uppercase tracking-wide">{TIPO_FATO[f.tipo] ?? f.tipo}</span>
                    {f.fonte && <span>fonte: {f.fonte}</span>}
                    <span>confiança {(f.confianca * 100).toFixed(0)}%</span>
                  </div>
                  <div className="mt-0.5 text-sm leading-relaxed text-slate-300">
                    {limparDescricao(f.descricao)}
                    {f.url && (
                      <a
                        href={f.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="ml-2 text-certik/80 hover:text-certik"
                      >
                        link ↗
                      </a>
                    )}
                  </div>
                </li>
              ))}
            </ol>
          ) : (
            <p className="p-4 text-sm text-slate-500">Nenhum fato coletado ainda para esta instituição.</p>
          )}
        </Painel>

        <section id="regulatorio" className="scroll-mt-20 overflow-hidden rounded-xl border border-edge bg-ink-900">
          <div className="flex items-center gap-3 border-b border-edge bg-gradient-to-r from-certik-deep/60 to-transparent px-4 py-4">
            <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-certik/15 text-lg">🛡️</span>
            <h2 className="text-lg font-semibold text-white">Pilares do Rating</h2>
            <span className="ml-auto flex items-center gap-1.5 text-certik">
              <span className="text-xl font-bold">{inst.rating.toFixed(0)}</span>
              <span className="text-xs text-slate-500">/100</span>
            </span>
          </div>
          <div className="space-y-3 p-4">
            {pilares.map(([n, peso, valor]) => (
              <PilarBar key={n} nome={n} peso={peso} valor={valor} />
            ))}
            <div className="mt-2 rounded-lg border border-edge bg-ink-800 px-3 py-2.5 text-xs text-slate-400">
              Via regulatória: <span className="text-slate-200">{inst.via ?? "—"}</span>
              {inst.via?.startsWith("IN 701")
                ? " — instituição já autorizada pelo BCB; entrada em ativos virtuais por comunicação."
                : " — nova entrante; requer autorização prévia do BCB."}
            </div>
          </div>
        </section>

        {inst.origem === "INCUMBENTE" && (
          <Painel id="sinais" className="scroll-mt-20" titulo="Sinais de movimento em ativos virtuais" acao={<span className="text-[11px] text-slate-500">{nSinais} ativo{nSinais === 1 ? "" : "s"}</span>}>
            <div className="px-4 py-1.5">
              <SinalLinha
                nome="Grupo econômico ligado a SPSAV"
                on={inst.sinal_grupo_spsav === 1}
                evidencia={inst.socio_comum ? `Sócio em comum: ${inst.socio_comum}` : null}
              />
              <SinalLinha nome="Site menciona cripto/tokenização" on={inst.sinal_site === 1} evidencia={inst.evidencia_site} />
              <SinalLinha nome="Notícias de atividade" on={inst.sinal_noticias === 1} evidencia={inst.evidencia_noticias} />
              <SinalLinha nome="Nome sugere digital assets" on={inst.sinal_nome === 1} />
            </div>
          </Painel>
        )}

        <Painel id="cadastro" className="scroll-mt-20" titulo="Cadastro">
          <div className="grid grid-cols-2 gap-4 p-4 md:grid-cols-3">
            <Campo label="Segmento">{inst.segmento}</Campo>
            <Campo label="Situação">{inst.situacao === "02" ? "Ativa" : inst.situacao}</Campo>
            <Campo label="Início de atividade">{fmtData(inst.data_inicio)}</Campo>
            <Campo label="Capital social">{fmtCapital(inst.capital_social)}</Campo>
            <Campo label="CNAE principal">{inst.cnae_principal}</Campo>
            <Campo label="Localização">{[inst.municipio, inst.uf].filter(Boolean).join(" / ")}</Campo>
            <Campo label="E-mail">{inst.email?.toLowerCase()}</Campo>
            <Campo label="Telefone">{inst.telefone}</Campo>
            <Campo label="Mês de referência">{inst.mes_ref}</Campo>
          </div>
        </Painel>

        {grupo.length > 0 && (
          <Painel id="grupo" className="scroll-mt-20" titulo={`Grupo ${inst.grupo_nome} — outras entidades (${grupo.length})`}>
            <ul className="divide-y divide-edge/60">
              {grupo.map((m) => (
                <li key={m.cnpj}>
                  <Link href={`/inst/${m.cnpj}`} className="flex items-center gap-3 px-4 py-2.5 transition-colors hover:bg-ink-800">
                    <Avatar nome={m.nome_fantasia || m.razao_social} size={28} />
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-sm font-medium text-slate-200">{m.razao_social}</div>
                      <div className="truncate text-xs text-slate-500" title={m.segmento}>
                        {segCurto(m.segmento)} · {fmtCnpj(m.cnpj)}
                      </div>
                    </div>
                    <OrigemChip origem={m.origem} />
                    <NotaBadge nota={m.nota} />
                  </Link>
                </li>
              ))}
            </ul>
          </Painel>
        )}

        {inst.socios && (
          <Painel id="socios" className="scroll-mt-20" titulo="Sócios">
            <ul className="divide-y divide-edge/60 text-sm text-slate-300">
              {inst.socios.split(" | ").map((s, i) => (
                <li key={i} className="flex items-center gap-3 px-4 py-2">
                  <Avatar nome={s} size={22} />
                  {s}
                </li>
              ))}
            </ul>
          </Painel>
        )}

        <div className="grid gap-5 md:grid-cols-2">
          <Painel titulo="Histórico de score">
            {snapshots.length ? (
              <div className="p-4">
                <div className="flex items-baseline justify-between text-xs text-slate-500">
                  <span>{snapshots[0].mes_ref}</span>
                  <span className="font-mono text-sm text-certik">{snapshots[snapshots.length - 1].score}</span>
                  <span>{snapshots[snapshots.length - 1].mes_ref}</span>
                </div>
                <div className="mt-2">
                  <Sparkline valores={snapshots.map((s) => s.score)} />
                </div>
              </div>
            ) : (
              <p className="p-4 text-sm text-slate-500">Sem histórico ainda.</p>
            )}
          </Painel>
          <Painel titulo="Timeline">
            {eventos.length ? (
              <ul className="space-y-3 p-4">
                {eventos.map((e, i) => (
                  <li key={i} className="border-l-2 border-certik/40 pl-3">
                    <div className="text-xs text-slate-500">{e.mes_ref}</div>
                    <div className="text-sm text-slate-300">{e.descricao}</div>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="p-4 text-sm text-slate-500">Nenhum evento — será populada nos próximos runs mensais.</p>
            )}
          </Painel>
        </div>
      </div>

      {/* ============ coluna direita: card de perfil ============ */}
      <div className="space-y-4 xl:sticky xl:top-[70px] xl:self-start">
        <Painel>
          <div className="p-5">
            <div className="flex items-center gap-3.5">
              <Avatar nome={nome} size={52} />
              <div className="min-w-0">
                <div className="flex items-start gap-2">
                  <h1 className="line-clamp-2 min-w-0 text-xl font-bold leading-tight text-white" title={inst.razao_social}>
                    {nome}
                  </h1>
                  <span className="mt-0.5 shrink-0">
                    <Share />
                  </span>
                </div>
                <div className="mt-1 flex flex-wrap items-center gap-1.5">
                  <span className="inline-flex items-center gap-1 rounded-full border border-amber-500/40 bg-amber-500/10 px-2 py-0.5 text-[10px] font-semibold text-amber-300">
                    🏅 {inst.origem === "SPSAV" ? "SPSAV" : "Incumbente"} · {inst.via?.startsWith("IN 701") ? "IN 701" : "IN 704"}
                  </span>
                  <OrigemChip origem={inst.origem} />
                  <ViaChip via={inst.via} />
                </div>
              </div>
            </div>
            {inst.nome_fantasia && <div className="mt-2 truncate text-xs text-slate-500">{inst.razao_social}</div>}
            <div className="mt-1 font-mono text-xs text-slate-500">{fmtCnpj(inst.cnpj)}</div>

            <div className="mt-4 grid grid-cols-4 gap-2 border-t border-edge pt-4">
              {[
                ["Capital", fmtCapital(inst.capital_social)],
                ["UF", inst.uf ?? "—"],
                ["Início", fmtData(inst.data_inicio)?.slice(-4) ?? "—"],
                ["Situação", inst.situacao === "02" ? "Ativa" : inst.situacao ?? "—"],
              ].map(([l, v]) => (
                <div key={l as string}>
                  <div className="text-[10px] uppercase tracking-wider text-slate-600">{l}</div>
                  <div className="mt-0.5 truncate text-sm font-semibold text-slate-200">{v}</div>
                </div>
              ))}
            </div>
          </div>
        </Painel>

        <Painel>
          <div className="p-5">
            <div className="flex items-center gap-2 text-sm font-semibold text-white">
              CertiK Skynet Score <span className="rounded bg-certik/15 px-1 text-[10px] text-certik">β</span>
            </div>
            <div className="mt-3 flex items-center justify-center gap-3 rounded-xl bg-gradient-to-br from-certik-deep/80 to-ink-800 py-4">
              <span className="text-5xl font-bold tracking-tight text-certik">{inst.rating.toFixed(2)}</span>
              <NotaBadge nota={inst.nota} size="lg" />
            </div>
            <Radar
              size={320}
              eixos={pilares.map(([label, , valor]) => ({
                label: label === "Atividade pública" ? "Atividade" : label,
                valor: valor ?? 0,
              }))}
            />
            <div className="mb-3 flex items-center justify-between rounded-lg border border-edge bg-ink-800 px-3 py-2.5">
              <span className="text-[10px] uppercase tracking-wider text-slate-500">Presença online</span>
              <LinksExternos links={links} nome={inst.razao_social} />
            </div>
            <div className="grid grid-cols-4 gap-2">
              {[
                { n: fatos.length, cls: "bg-certik/10 text-certik", icone: "🛡", t: "Fatos coletados" },
                { n: nPessoas, cls: "bg-sky-500/10 text-sky-300", icone: "ℹ", t: "Pessoas-chave" },
                { n: nNoticias, cls: "bg-amber-500/10 text-amber-300", icone: "!", t: "Notícias" },
                { n: nSinais, cls: "bg-ink-700 text-slate-400", icone: "⚠", t: "Sinais ativos" },
              ].map((c, i) => (
                <div key={i} title={c.t} className={`flex items-center justify-center gap-1.5 rounded-lg py-2 text-sm font-semibold ${c.cls}`}>
                  <span className="text-xs opacity-80">{c.icone}</span>
                  {c.n}
                </div>
              ))}
            </div>
          </div>
        </Painel>

        {grupo.length > 0 && (
          <Painel titulo="Grupo econômico">
            <div className="flex flex-wrap gap-2 p-4">
              <span className="rounded-lg border border-edge bg-ink-800 px-2.5 py-1.5 text-xs text-slate-400">
                ⛓ {inst.grupo_nome} · {grupo.length + 1} entidades
              </span>
              {grupo.slice(0, 6).map((m) => (
                <Link
                  key={m.cnpj}
                  href={`/inst/${m.cnpj}`}
                  className="flex items-center gap-1.5 rounded-lg border border-edge bg-ink-800 px-2.5 py-1.5 text-xs text-slate-300 transition-colors hover:border-certik/40 hover:text-white"
                >
                  <Avatar nome={m.nome_fantasia || m.razao_social} size={16} />
                  <span className="max-w-[140px] truncate">{m.nome_fantasia || m.razao_social}</span>
                </Link>
              ))}
            </div>
          </Painel>
        )}
      </div>
    </div>
  );
}
