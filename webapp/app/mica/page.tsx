import Link from "next/link";
import type { Metadata } from "next";
import { getMicaLicencas, type MicaLicenca } from "@/lib/db";
import { Avatar, NotaBadge, Painel, ScoreChip, segCurto } from "@/components/ui";

export const metadata: Metadata = {
  title: "MiCA Licenses — CertiK Monitor Brasil",
  description: "Brazilian PSAV universe companies whose groups hold EU MiCA authorizations",
};

function nomeInst(m: MicaLicenca) {
  return m.nome_fantasia?.trim() || m.razao_social;
}

function TipoChip({ tipo }: { tipo: string | null }) {
  if (!tipo) return null;
  const emi = tipo.toUpperCase().includes("EMI");
  const cls = emi ? "bg-info/15 text-info" : "bg-accent/15 text-accent";
  return <span className={`rounded px-1.5 py-0.5 text-[10px] font-semibold ${cls}`}>{tipo}</span>;
}

function fmtData(d: string | null) {
  if (!d) return "—";
  const [y, m, day] = d.split("-");
  if (!m) return y;
  const meses = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];
  const mes = meses[Number(m) - 1] ?? m;
  return day ? `${day} ${mes} ${y}` : `${mes} ${y}`;
}

function TabelaMica({ licencas }: { licencas: MicaLicenca[] }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-left text-xs">
        <thead>
          <tr className="border-b border-edge text-[10px] uppercase tracking-wider text-fg-muted">
            <th className="px-4 py-2.5">#</th>
            <th className="px-4 py-2.5">Institution (BR)</th>
            <th className="px-4 py-2.5">Rating</th>
            <th className="px-4 py-2.5">Group / EU entity</th>
            <th className="px-4 py-2.5">License</th>
            <th className="px-4 py-2.5">Country / regulator</th>
            <th className="px-4 py-2.5">Notes</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-edge">
          {licencas.map((m, i) => (
            <tr key={m.cnpj} className="align-top hover:bg-surface-raised">
              <td className="px-4 py-3 font-mono text-[10px] text-fg-muted">{i + 1}</td>
              <td className="px-4 py-3">
                <Link href={`/inst/${m.cnpj}`} className="flex items-center gap-2.5 hover:text-accent">
                  <Avatar nome={nomeInst(m)} size={28} />
                  <span className="min-w-0">
                    <span className="block truncate font-medium text-fg">{nomeInst(m)}</span>
                    <span className="block font-mono text-[10px] text-fg-muted">
                      {m.cnpj} · {segCurto(m.segmento)}
                    </span>
                  </span>
                </Link>
              </td>
              <td className="whitespace-nowrap px-4 py-3">
                <span className="flex items-center gap-1.5">
                  <ScoreChip score={m.rating} />
                  <NotaBadge nota={m.nota} />
                </span>
              </td>
              <td className="px-4 py-3">
                <span className="block font-medium text-fg">{m.grupo}</span>
                {m.entidade_ue && <span className="block text-[10px] text-fg-muted">{m.entidade_ue}</span>}
              </td>
              <td className="px-4 py-3">
                <span className="flex flex-col items-start gap-1">
                  <TipoChip tipo={m.tipo} />
                  <span className="text-[10px] text-fg-muted">since {fmtData(m.data_autorizacao)}</span>
                  {m.confianca != null && (
                    <span className="text-[10px] text-fg-muted">confidence {Math.round(m.confianca * 100)}%</span>
                  )}
                </span>
              </td>
              <td className="px-4 py-3 text-fg-secondary">
                <span className="block">{m.pais ?? "—"}</span>
                {m.regulador && <span className="block text-[10px] text-fg-muted">{m.regulador}</span>}
              </td>
              <td className="max-w-[360px] px-4 py-3 text-fg-secondary">
                {m.observacao && <span className="line-clamp-3">{m.observacao}</span>}
                <span className="mt-1 flex items-center gap-2 text-[10px] text-fg-muted">
                  {m.fonte_url && (
                    <a
                      href={m.fonte_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-fg-muted hover:text-accent"
                    >
                      source ↗
                    </a>
                  )}
                  {m.site && (
                    <a href={m.site} target="_blank" rel="noopener noreferrer" className="text-fg-muted hover:text-accent">
                      site ↗
                    </a>
                  )}
                </span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default function MicaPage() {
  const licencas = getMicaLicencas();
  const grupos = new Set(licencas.map((m) => m.grupo)).size;

  return (
    <div className="space-y-5">
      <Painel titulo="MiCA Licenses — EU authorizations in the BR universe">
        <div className="space-y-3 px-4 py-4 text-xs leading-relaxed text-fg-secondary">
          <p>
            Companies in the Brazilian PSAV universe whose <span className="text-fg">global group holds a MiCA
            authorization</span> in the European Union — CASP licenses under Title V of Regulation (EU) 2023/1114
            and/or EMI licenses for e-money token (stablecoin) issuance. A MiCA license grants passporting across the
            30 EEA countries and signals a materially higher regulatory bar (governance, prudential safeguards,
            custody segregation) than unlicensed operation.
          </p>
          <p>
            Mapping is at the <span className="text-fg">group level</span>: the license belongs to an EU entity of the
            same group, not to the Brazilian CNPJ. Sources: ESMA interim register, national regulators (AMF, FMA,
            CSSF, CBI, CySEC, MFSA, CNMV/BdE, AFM) and official announcements, researched 2026-09-30.
          </p>
        </div>
      </Painel>

      <Painel
        titulo={
          <span className="flex items-center gap-2">
            Licensed groups
            <span className="rounded-full bg-accent/15 px-2 py-0.5 text-[10px] font-semibold text-accent">
              {grupos} groups · {licencas.length} BR entities
            </span>
          </span>
        }
      >
        <TabelaMica licencas={licencas} />
      </Painel>

      <p className="px-1 text-[11px] text-fg-muted">
        Sources: web research against ESMA&apos;s interim MiCA register, national regulator white lists and official
        press releases (2026-09-30). Group-to-CNPJ mapping and license status are automated research — validate
        manually before regulatory use. Notable absences: Binance (withdrew its EU application) and Bitget (in
        process) hold no MiCA license to date.
      </p>
    </div>
  );
}
