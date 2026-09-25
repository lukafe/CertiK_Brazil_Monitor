import { getStats, listInstituicoes } from "@/lib/db";
import Tabela from "./tabela";

export const dynamic = "force-dynamic";

export default function Home() {
  const stats = getStats();
  const rows = listInstituicoes();

  const cards = [
    { label: "SPSAV (razão social)", value: stats.spsav, accent: "text-emerald-400" },
    { label: "Incumbentes elegíveis", value: stats.incumbentes, accent: "text-cyan-400" },
    { label: "Incumbentes com sinal", value: stats.comSinal, accent: "text-amber-400" },
    { label: "Mês de referência", value: stats.mesRef, accent: "text-slate-300" },
  ];

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        {cards.map((c) => (
          <div key={c.label} className="rounded-xl border border-slate-800 bg-slate-900/50 p-4">
            <div className="text-xs uppercase tracking-wide text-slate-500">{c.label}</div>
            <div className={`mt-1 text-2xl font-semibold ${c.accent}`}>{c.value}</div>
          </div>
        ))}
      </div>
      <Tabela rows={rows} />
    </div>
  );
}
