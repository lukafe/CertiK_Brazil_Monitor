import Link from "next/link";
import type { Metadata } from "next";
import { getAlvosCustodia, type AlvoCustodia } from "@/lib/db";
import { Avatar, NotaBadge, Painel, ScoreChip, limparDescricao, segCurto } from "@/components/ui";

export const metadata: Metadata = {
  title: "Custody Audit — CertiK Monitor Brasil",
  description: "Target list for independent custody audits under Res. BCB 520, art. 73",
};

function nomeInst(a: AlvoCustodia) {
  return a.nome_fantasia?.trim() || a.razao_social;
}

function CustodyChips({ tags }: { tags: string[] }) {
  return (
    <span className="flex flex-wrap gap-1">
      {tags.includes("custodia_propria") && (
        <span className="rounded bg-certik/15 px-1.5 py-0.5 text-[10px] font-semibold text-certik">
          Self-custody
        </span>
      )}
      {tags.includes("custodia_terceirizada") && (
        <span className="rounded bg-sky-400/15 px-1.5 py-0.5 text-[10px] font-semibold text-sky-400">
          Third-party
        </span>
      )}
    </span>
  );
}

function TabelaAlvos({ alvos }: { alvos: AlvoCustodia[] }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-left text-xs">
        <thead>
          <tr className="border-b border-edge text-[10px] uppercase tracking-wider text-slate-500">
            <th className="px-4 py-2.5">#</th>
            <th className="px-4 py-2.5">Institution</th>
            <th className="px-4 py-2.5">Rating</th>
            <th className="px-4 py-2.5">Custody</th>
            <th className="px-4 py-2.5">Evidence</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-edge/60">
          {alvos.map((a, i) => {
            const evid = limparDescricao(a.evidencia_fato) || limparDescricao(a.descricao);
            return (
              <tr key={a.cnpj} className="align-top hover:bg-ink-800/50">
                <td className="px-4 py-3 font-mono text-[10px] text-slate-600">{i + 1}</td>
                <td className="px-4 py-3">
                  <Link href={`/inst/${a.cnpj}`} className="flex items-center gap-2.5 hover:text-certik">
                    <Avatar nome={nomeInst(a)} size={28} />
                    <span className="min-w-0">
                      <span className="block truncate font-medium text-slate-200">{nomeInst(a)}</span>
                      <span className="block font-mono text-[10px] text-slate-600">
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
                  <CustodyChips tags={a.tags_custodia} />
                </td>
                <td className="max-w-[420px] px-4 py-3 text-slate-400">
                  <span className="line-clamp-3">{evid || "Tagged via Gemini enrichment (Google Search grounding)"}</span>
                  <span className="mt-1 flex items-center gap-2 text-[10px] text-slate-600">
                    {a.evidencia_fonte && <span>source: {a.evidencia_fonte}</span>}
                    {a.evidencia_url && (
                      <a
                        href={a.evidencia_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-slate-500 hover:text-certik"
                      >
                        link ↗
                      </a>
                    )}
                    {a.site && (
                      <a href={a.site} target="_blank" rel="noopener noreferrer" className="text-slate-500 hover:text-certik">
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
  const propria = alvos.filter((a) => a.tags_custodia.includes("custodia_propria"));
  const terceirizada = alvos.filter(
    (a) => a.tags_custodia.includes("custodia_terceirizada") && !a.tags_custodia.includes("custodia_propria")
  );

  return (
    <div className="space-y-5">
      <Painel titulo="Custody Audit — Res. BCB 520, art. 73">
        <div className="space-y-3 px-4 py-4 text-xs leading-relaxed text-slate-400">
          <p>
            Target list of PSAVs that fall under the <span className="text-slate-200">independent custody audit</span>{" "}
            requirement. Evidence column shows what placed each company on the list (news, website snapshot or
            Gemini-grounded enrichment).
          </p>
          <ul className="list-disc space-y-1 pl-5">
            <li>
              <span className="font-semibold text-slate-300">Art. 73, caput, X</span> — the custody agreement must
              describe the custodian&apos;s internal controls and the{" "}
              <span className="text-slate-200">independent audit of the custody service</span>.
            </li>
            <li>
              <span className="font-semibold text-slate-300">Art. 73, §§ 4º–5º</span> — the audit covers key/wallet
              safeguarding, risk mitigation, custodian systems and fork/airdrop events, and{" "}
              <span className="text-slate-200">must be performed at least annually</span>.
            </li>
            <li>
              <span className="font-semibold text-slate-300">Art. 73 § 6º + arts. 74–75</span> — PSAVs using a
              third-party custodian share the custodian&apos;s responsibilities and must evaluate its custody policy and
              monitor it continuously (incl. the custodian&apos;s audit).
            </li>
          </ul>
        </div>
      </Painel>

      <Painel
        titulo={
          <span className="flex items-center gap-2">
            Tier 1 — Self-custody
            <span className="rounded-full bg-certik/15 px-2 py-0.5 text-[10px] font-semibold text-certik">
              {propria.length} companies · direct annual audit obligation
            </span>
          </span>
        }
      >
        <TabelaAlvos alvos={propria} />
      </Painel>

      <Painel
        titulo={
          <span className="flex items-center gap-2">
            Tier 2 — Third-party custody
            <span className="rounded-full bg-sky-400/15 px-2 py-0.5 text-[10px] font-semibold text-sky-400">
              {terceirizada.length} companies · must evaluate the custodian&apos;s audit
            </span>
          </span>
        }
      >
        <TabelaAlvos alvos={terceirizada} />
      </Painel>

      <p className="px-1 text-[11px] text-slate-600">
        Generated from monitor.db (Gemini enrichment with Google Search grounding + OSINT facts). Validate manually
        before outreach — e.g. companies that announced shutdown may still need transition/migration assurance.
      </p>
    </div>
  );
}
