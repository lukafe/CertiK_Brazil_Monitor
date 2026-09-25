import Link from "next/link";
import { notFound } from "next/navigation";
import { getEventos, getFatos, getGrupoMembros, getInstituicao, getSnapshots } from "@/lib/db";
import { NotaBadge } from "../../tabela";

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
  return isNaN(n)
    ? c
    : n.toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });
}

function Campo({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="text-xs uppercase tracking-wide text-slate-500">{label}</div>
      <div className="mt-0.5 text-sm text-slate-200">{children || "—"}</div>
    </div>
  );
}

function PilarBar({ nome, peso, valor }: { nome: string; peso: number; valor: number | null }) {
  const v = valor ?? 0;
  const cor = v >= 70 ? "bg-emerald-400" : v >= 40 ? "bg-amber-400" : "bg-slate-600";
  return (
    <div>
      <div className="mb-1 flex items-baseline justify-between text-xs">
        <span className="text-slate-300">
          {nome} <span className="text-slate-600">({(peso * 100).toFixed(0)}%)</span>
        </span>
        <span className="font-mono text-slate-400">{v.toFixed(0)}</span>
      </div>
      <div className="h-1.5 w-full rounded bg-slate-800">
        <div className={`h-1.5 rounded ${cor}`} style={{ width: `${Math.min(100, v)}%` }} />
      </div>
    </div>
  );
}

function SinalLinha({ nome, on, evidencia }: { nome: string; on: boolean | null; evidencia?: string | null }) {
  return (
    <div className="flex items-start gap-3 rounded-lg border border-slate-800 bg-slate-900/40 p-3">
      <span
        className={`mt-0.5 inline-flex h-5 w-5 items-center justify-center rounded-full text-xs ${
          on ? "bg-emerald-500/20 text-emerald-300" : "bg-slate-800 text-slate-600"
        }`}
      >
        {on ? "✓" : "–"}
      </span>
      <div className="min-w-0">
        <div className="text-sm font-medium text-slate-200">{nome}</div>
        {evidencia && <div className="mt-1 break-words text-xs text-slate-400">{evidencia}</div>}
      </div>
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

  return (
    <div className="space-y-6">
      <Link href="/" className="text-sm text-slate-500 hover:text-emerald-400">
        ← voltar à listagem
      </Link>

      <div className="flex flex-wrap items-start justify-between gap-4 rounded-xl border border-slate-800 bg-slate-900/50 p-5">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-xl font-semibold text-white">{inst.razao_social}</h1>
            <span
              className={`rounded px-2 py-0.5 text-xs font-medium ${
                inst.origem === "SPSAV" ? "bg-emerald-500/15 text-emerald-300" : "bg-cyan-500/15 text-cyan-300"
              }`}
            >
              {inst.origem}
            </span>
          </div>
          {inst.nome_fantasia && <div className="text-sm text-slate-400">{inst.nome_fantasia}</div>}
          <div className="mt-1 font-mono text-sm text-slate-500">{fmtCnpj(inst.cnpj)}</div>
          {inst.grupo_id && (
            <span className="mt-2 mr-2 inline-block rounded-full border border-slate-700 bg-slate-800/80 px-2 py-0.5 text-xs text-slate-300">
              ⛓ Grupo {inst.grupo_nome} · {grupo.length + 1} entidades no universo
            </span>
          )}
          {inst.via && (
            <span
              className={`mt-2 inline-block rounded px-2 py-0.5 text-xs ${
                inst.via.startsWith("IN 701") ? "bg-cyan-500/10 text-cyan-400" : "bg-purple-500/10 text-purple-400"
              }`}
            >
              {inst.via}
            </span>
          )}
        </div>
        <div className="text-right">
          <div className="text-xs uppercase tracking-wide text-slate-500">Rating</div>
          <div className="mt-1">
            <NotaBadge nota={inst.nota} rating={inst.rating} />
          </div>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-4 lg:col-span-2">
          <section className="rounded-xl border border-slate-800 bg-slate-900/50 p-5">
            <h2 className="mb-4 text-sm font-semibold uppercase tracking-wide text-slate-400">
              Pilares do rating
            </h2>
            <div className="space-y-3">
              {pilares.map(([nome, peso, valor]) => (
                <PilarBar key={nome} nome={nome} peso={peso} valor={valor} />
              ))}
            </div>
          </section>

          {grupo.length > 0 && (
            <section className="rounded-xl border border-slate-800 bg-slate-900/50 p-5">
              <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-400">
                Grupo {inst.grupo_nome} — outras entidades ({grupo.length})
              </h2>
              <ul className="space-y-2">
                {grupo.map((m) => (
                  <li key={m.cnpj} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-slate-800 bg-slate-900/40 p-3">
                    <div className="min-w-0">
                      <Link href={`/inst/${m.cnpj}`} className="text-sm font-medium text-slate-200 hover:text-emerald-400">
                        {m.razao_social}
                      </Link>
                      <div className="text-xs text-slate-500">
                        {m.segmento} · {fmtCnpj(m.cnpj)}
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <span
                        className={`rounded px-1.5 py-0.5 text-xs ${
                          m.origem === "SPSAV" ? "bg-emerald-500/15 text-emerald-300" : "bg-cyan-500/15 text-cyan-300"
                        }`}
                      >
                        {m.origem}
                      </span>
                      <NotaBadge nota={m.nota} rating={m.rating} />
                    </div>
                  </li>
                ))}
              </ul>
            </section>
          )}

          <section className="rounded-xl border border-slate-800 bg-slate-900/50 p-5">
            <h2 className="mb-4 text-sm font-semibold uppercase tracking-wide text-slate-400">Cadastro</h2>
            <div className="grid grid-cols-2 gap-4 md:grid-cols-3">
              <Campo label="Segmento">{inst.segmento}</Campo>
              <Campo label="Situação">{inst.situacao === "02" ? "Ativa" : inst.situacao}</Campo>
              <Campo label="Início de atividade">{fmtData(inst.data_inicio)}</Campo>
              <Campo label="Capital social">{fmtCapital(inst.capital_social)}</Campo>
              <Campo label="CNAE principal">{inst.cnae_principal}</Campo>
              <Campo label="Localização">
                {[inst.municipio, inst.uf].filter(Boolean).join(" / ")}
              </Campo>
              <Campo label="E-mail">{inst.email?.toLowerCase()}</Campo>
              <Campo label="Telefone">{inst.telefone}</Campo>
              <Campo label="Mês de referência">{inst.mes_ref}</Campo>
            </div>
          </section>

          {inst.origem === "INCUMBENTE" && (
            <section className="rounded-xl border border-slate-800 bg-slate-900/50 p-5">
              <h2 className="mb-4 text-sm font-semibold uppercase tracking-wide text-slate-400">
                Sinais de movimento em ativos virtuais
              </h2>
              <div className="space-y-2">
                <SinalLinha
                  nome="Grupo econômico ligado a SPSAV"
                  on={inst.sinal_grupo_spsav === 1}
                  evidencia={inst.socio_comum ? `Sócio em comum: ${inst.socio_comum}` : null}
                />
                <SinalLinha nome="Site menciona cripto/tokenização" on={inst.sinal_site === 1} evidencia={inst.evidencia_site} />
                <SinalLinha nome="Notícias de atividade" on={inst.sinal_noticias === 1} evidencia={inst.evidencia_noticias} />
                <SinalLinha nome="Nome sugere digital assets" on={inst.sinal_nome === 1} />
              </div>
            </section>
          )}

          {fatos.length > 0 && (
            <section className="rounded-xl border border-slate-800 bg-slate-900/50 p-5">
              <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-400">
                Fatos coletados
              </h2>
              <ul className="space-y-2">
                {fatos.map((f, i) => (
                  <li key={i} className="flex items-start gap-3 rounded-lg border border-slate-800 bg-slate-900/40 p-3 text-sm">
                    <span className="whitespace-nowrap text-xs text-slate-400">
                      {TIPO_FATO[f.tipo] ?? f.tipo}
                    </span>
                    <div className="min-w-0">
                      <div className="text-slate-300">{f.descricao}</div>
                      <div className="mt-0.5 flex flex-wrap gap-2 text-xs text-slate-500">
                        {f.fonte && <span>fonte: {f.fonte}</span>}
                        {f.url && (
                          <a href={f.url} target="_blank" rel="noopener noreferrer" className="text-emerald-500/80 hover:text-emerald-400">
                            link ↗
                          </a>
                        )}
                        <span>confiança {(f.confianca * 100).toFixed(0)}%</span>
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            </section>
          )}

          {inst.socios && (
            <section className="rounded-xl border border-slate-800 bg-slate-900/50 p-5">
              <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-400">Sócios</h2>
              <ul className="space-y-1 text-sm text-slate-300">
                {inst.socios.split(" | ").map((s, i) => (
                  <li key={i} className="border-b border-slate-800/50 pb-1 last:border-0">
                    {s}
                  </li>
                ))}
              </ul>
            </section>
          )}
        </div>

        <div className="space-y-4">
          <section className="rounded-xl border border-slate-800 bg-slate-900/50 p-5">
            <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-400">Histórico</h2>
            {snapshots.length ? (
              <ul className="space-y-2">
                {snapshots.map((s) => (
                  <li key={s.mes_ref} className="flex items-center justify-between text-sm">
                    <span className="text-slate-400">{s.mes_ref}</span>
                    <span className="font-mono text-slate-300">score {s.score}</span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-slate-500">Sem histórico ainda.</p>
            )}
          </section>

          <section className="rounded-xl border border-slate-800 bg-slate-900/50 p-5">
            <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-400">Timeline</h2>
            {eventos.length ? (
              <ul className="space-y-3">
                {eventos.map((e, i) => (
                  <li key={i} className="border-l-2 border-emerald-500/40 pl-3">
                    <div className="text-xs text-slate-500">{e.mes_ref}</div>
                    <div className="text-sm text-slate-300">{e.descricao}</div>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-slate-500">
                Nenhum evento — a timeline será populada nos próximos runs mensais.
              </p>
            )}
          </section>
        </div>
      </div>
    </div>
  );
}
