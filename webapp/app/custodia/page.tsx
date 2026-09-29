import Link from "next/link";
import type { Metadata } from "next";
import { getAlvosCustodia, type AlvoCustodia, type ModeloCustodia } from "@/lib/db";
import { Avatar, NotaBadge, Painel, ScoreChip, limparDescricao, segCurto } from "@/components/ui";

export const metadata: Metadata = {
  title: "Custody Audit — CertiK Monitor Brasil",
  description: "Target list for independent custody audits under Res. BCB 520, art. 73",
};

function nomeInst(a: AlvoCustodia) {
  return a.nome_fantasia?.trim() || a.razao_social;
}

const MODELO_CHIP: Record<string, { label: string; cls: string }> = {
  propria: { label: "Self-custody · verified", cls: "bg-accent/15 text-accent" },
  terceirizada: { label: "Third-party · verified", cls: "bg-info/15 text-info" },
  hibrida: { label: "Hybrid · verified", cls: "bg-info/15 text-info" },
  indeterminado: { label: "Model unverified", cls: "bg-score-3/15 text-score-3" },
  sem_custodia: { label: "No custody found", cls: "bg-surface-raised text-fg-secondary" },
};

function ModeloChip({ modelo }: { modelo: ModeloCustodia | null }) {
  const m = MODELO_CHIP[modelo ?? "indeterminado"] ?? MODELO_CHIP.indeterminado;
  return <span className={`rounded px-1.5 py-0.5 text-[10px] font-semibold ${m.cls}`}>{m.label}</span>;
}

function TabelaAlvos({ alvos }: { alvos: AlvoCustodia[] }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-left text-xs">
        <thead>
          <tr className="border-b border-edge text-[10px] uppercase tracking-wider text-fg-muted">
            <th className="px-4 py-2.5">#</th>
            <th className="px-4 py-2.5">Institution</th>
            <th className="px-4 py-2.5">Rating</th>
            <th className="px-4 py-2.5">Custody model</th>
            <th className="px-4 py-2.5">Evidence / rationale</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-edge">
          {alvos.map((a, i) => {
            const evid =
              limparDescricao(a.verif_justificativa) || limparDescricao(a.evidencia_fato) || limparDescricao(a.descricao);
            return (
              <tr key={a.cnpj} className="align-top hover:bg-surface-raised">
                <td className="px-4 py-3 font-mono text-[10px] text-fg-muted">{i + 1}</td>
                <td className="px-4 py-3">
                  <Link href={`/inst/${a.cnpj}`} className="flex items-center gap-2.5 hover:text-accent">
                    <Avatar nome={nomeInst(a)} size={28} />
                    <span className="min-w-0">
                      <span className="block truncate font-medium text-fg">{nomeInst(a)}</span>
                      <span className="block font-mono text-[10px] text-fg-muted">
                        {a.cnpj} · {segCurto(a.segmento)}
                      </span>
                    </span>
                  </Link>
                </td>
                <td className="whitespace-nowrap px-4 py-3">
                  <span className="flex items-center gap-1.5">
                    <ScoreChip score={a.rating} />
                    <NotaBadge nota={a.nota} />
                  </span>
                </td>
                <td className="px-4 py-3">
                  <span className="flex flex-col items-start gap-1">
                    <ModeloChip modelo={a.verif_modelo} />
                    {a.verif_custodiante && (
                      <span className="text-[10px] text-fg-muted">via {a.verif_custodiante}</span>
                    )}
                    {a.verif_confianca != null && (
                      <span className="text-[10px] text-fg-muted">confidence {Math.round(a.verif_confianca * 100)}%</span>
                    )}
                  </span>
                </td>
                <td className="max-w-[420px] px-4 py-3 text-fg-secondary">
                  <span className="line-clamp-3">{evid || "Custody declared via Gemini enrichment — no independent evidence yet"}</span>
                  <span className="mt-1 flex items-center gap-2 text-[10px] text-fg-muted">
                    {(a.verif_url || a.evidencia_url) && (
                      <a
                        href={a.verif_url ?? a.evidencia_url ?? "#"}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-fg-muted hover:text-accent"
                      >
                        source ↗
                      </a>
                    )}
                    {a.site && (
                      <a href={a.site} target="_blank" rel="noopener noreferrer" className="text-fg-muted hover:text-accent">
                        site ↗
                      </a>
                    )}
                  </span>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

export default function CustodiaPage() {
  const alvos = getAlvosCustodia();
  const porModelo = (m: ModeloCustodia | null) => alvos.filter((a) => (a.verif_modelo ?? "indeterminado") === (m ?? "indeterminado"));
  const propria = porModelo("propria");
  const terceirizada = [...porModelo("terceirizada"), ...porModelo("hibrida")];
  const indeterminado = alvos.filter((a) => !a.verif_modelo || a.verif_modelo === "indeterminado");
  const semCustodia = porModelo("sem_custodia");

  return (
    <div className="space-y-5">
      <Painel titulo="Custody Audit — Res. BCB 520, art. 73">
        <div className="space-y-3 px-4 py-4 text-xs leading-relaxed text-fg-secondary">
          <p>
            PSAVs in scope for the <span className="text-fg">independent custody audit</span> requirement. All
            companies below <span className="text-fg">declare offering custody</span> of virtual assets. The
            custody <em>model</em> (who actually controls the keys) was verified in a second, dedicated web-research
            pass that requires citable evidence and allows &quot;indeterminate&quot; — because marketing copy saying
            &quot;we offer custody&quot; does not prove self-custody.
          </p>
          <ul className="list-disc space-y-1 pl-5">
            <li>
              <span className="font-semibold text-fg-secondary">Art. 73, caput, X</span> — the custody agreement must
              describe the custodian&apos;s internal controls and the{" "}
              <span className="text-fg">independent audit of the custody service</span>.
            </li>
            <li>
              <span className="font-semibold text-fg-secondary">Art. 73, §§ 4º–5º</span> — the audit covers key/wallet
              safeguarding, risk mitigation, custodian systems and fork/airdrop events, and{" "}
              <span className="text-fg">must be performed at least annually</span>.
            </li>
            <li>
              <span className="font-semibold text-fg-secondary">Art. 73 § 6º + arts. 74–75</span> — PSAVs using a
              third-party custodian share the custodian&apos;s responsibilities and must evaluate its custody policy and
              monitor it continuously (incl. the custodian&apos;s audit).
            </li>
          </ul>
        </div>
      </Painel>

      {propria.length > 0 && (
        <Painel
          titulo={
            <span className="flex items-center gap-2">
              Self-custody — verified
              <span className="rounded-full bg-accent/15 px-2 py-0.5 text-[10px] font-semibold text-accent">
                {propria.length} companies · direct annual audit obligation (art. 73 §§ 4º–5º)
              </span>
            </span>
          }
        >
          <TabelaAlvos alvos={propria} />
        </Painel>
      )}

      {terceirizada.length > 0 && (
        <Painel
          titulo={
            <span className="flex items-center gap-2">
              Third-party / hybrid custody — verified
              <span className="rounded-full bg-info/15 px-2 py-0.5 text-[10px] font-semibold text-info">
                {terceirizada.length} companies · must evaluate the custodian&apos;s audit (arts. 74–75)
              </span>
            </span>
          }
        >
          <TabelaAlvos alvos={terceirizada} />
        </Painel>
      )}

      {indeterminado.length > 0 && (
        <Painel
          titulo={
            <span className="flex items-center gap-2">
              Custody declared — model unverified
              <span className="rounded-full bg-score-3/15 px-2 py-0.5 text-[10px] font-semibold text-score-3">
                {indeterminado.length} companies · in scope of art. 73, key management not public
              </span>
            </span>
          }
        >
          <TabelaAlvos alvos={indeterminado} />
        </Painel>
      )}

      {semCustodia.length > 0 && (
        <Painel
          titulo={
            <span className="flex items-center gap-2">
              Likely out of scope
              <span className="rounded-full border border-edge bg-surface-raised px-2 py-0.5 text-[10px] font-semibold text-fg-secondary">
                {semCustodia.length} companies · verification found no client-asset custody
              </span>
            </span>
          }
        >
          <TabelaAlvos alvos={semCustodia} />
        </Painel>
      )}

      <p className="px-1 text-[11px] text-fg-muted">
        Sources: Gemini enrichment with Google Search grounding (declared custody) + dedicated custody-model
        verification pass requiring citable evidence, cross-checked with OSINT facts in monitor.db. Verified labels
        are still automated research — validate manually before outreach.
      </p>
    </div>
  );
}
