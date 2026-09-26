import React from "react";

export const NOTAS = ["AAA", "AA", "A", "BBB", "BB", "B", "D"];

function semAcento(s: string) {
  return s.normalize("NFD").replace(/[̀-ͯ]/g, "").toUpperCase();
}

const SEG_CURTO: [string, string][] = [
  ["SPSAV", "SPSAV"],
  ["BANCO MULTIPLO", "Banco Múltiplo"],
  ["BANCO COMERCIAL", "Banco Comercial"],
  ["BANCO DE INVESTIMENTO", "Banco de Investimento"],
  ["BANCO DE CAMBIO", "Banco de Câmbio"],
  ["BANCO", "Banco"],
  ["CAIXA ECON", "Caixa Econômica"],
  ["CORRETORA DE TVM", "Corretora TVM"],
  ["CORRETORA DE TITULOS", "Corretora TVM"],
  ["DISTRIBUIDORA DE TVM", "Distribuidora TVM"],
  ["DISTRIBUIDORA DE TITULOS", "Distribuidora TVM"],
  ["CORRETORA DE CAMBIO", "Corretora de Câmbio"],
  ["CREDITO DIRETO", "SCD"],
  ["EMPRESTIMO ENTRE PESSOAS", "SEP"],
  ["INSTITUICAO DE PAGAMENTO", "IP"],
  ["CREDITO, FINANCIAMENTO", "Financeira"],
  ["CREDITO IMOBILIARIO", "Cia. Crédito Imobiliário"],
];

export function segCurto(seg: string | null) {
  if (!seg) return "—";
  const n = semAcento(seg);
  for (const [pat, curto] of SEG_CURTO) if (n.includes(pat)) return curto;
  const palavras = seg.toLowerCase().split(/\s+/).slice(0, 3).join(" ");
  return palavras.replace(/\b\w/g, (c) => c.toUpperCase());
}

export function limparDescricao(d: string | null) {
  if (!d) return "";
  const semUrl = d.replace(/https?:\/\/\S+/g, "").replace(/\s{2,}/g, " ").replace(/[:—-]\s*$/, "").trim();
  return semUrl || d;
}

export const TAG_LABEL: Record<string, string> = {
  intermediacao: "Intermediação",
  custodia_propria: "Custódia própria",
  custodia_terceirizada: "Custódia terceirizada",
  otc: "OTC",
  tokenizacao: "Tokenização",
  pagamentos: "Pagamentos",
  staking: "Staking",
  gestao_ativos: "Gestão de ativos",
  infraestrutura: "Infraestrutura",
  banco_digital: "Banco digital",
  drex_cbdc: "Drex/CBDC",
  consultoria: "Consultoria",
};

export function TagChip({ tag, mini = false }: { tag: string; mini?: boolean }) {
  return (
    <span
      className={`inline-flex items-center whitespace-nowrap rounded-full border border-certik/25 bg-certik/10 font-medium text-certik ${
        mini ? "px-1.5 py-px text-[10px]" : "px-2 py-0.5 text-[11px]"
      }`}
    >
      {TAG_LABEL[tag] ?? tag}
    </span>
  );
}

export function notaClasses(nota: string) {
  switch (nota) {
    case "AAA":
      return "bg-certik text-black";
    case "AA":
      return "bg-certik/25 text-certik-bright";
    case "A":
      return "bg-lime-500/20 text-lime-300";
    case "BBB":
      return "bg-sky-500/20 text-sky-300";
    case "BB":
      return "bg-amber-500/20 text-amber-300";
    case "B":
      return "bg-orange-500/20 text-orange-300";
    default:
      return "bg-ink-700 text-slate-500";
  }
}

export function NotaBadge({ nota, size = "sm" }: { nota: string; size?: "sm" | "lg" }) {
  return (
    <span
      className={`inline-flex items-center justify-center rounded font-bold tracking-tight ${notaClasses(nota)} ${
        size === "lg" ? "px-3 py-1 text-xl" : "px-1.5 py-0.5 text-[11px]"
      }`}
    >
      {nota}
    </span>
  );
}

export function ScoreChip({ score, size = "sm" }: { score: number; size?: "sm" | "lg" }) {
  return (
    <span
      className={`inline-flex items-center justify-center rounded bg-certik-deep font-semibold tabular-nums text-certik ${
        size === "lg" ? "px-3 py-1 text-4xl tracking-tight" : "px-1.5 py-0.5 text-[11px]"
      }`}
    >
      {score.toFixed(2)}
    </span>
  );
}

export function ScoreNota({ score, nota }: { score: number; nota: string }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <ScoreChip score={score} />
      <HexIcon score={score} />
      <NotaBadge nota={nota} />
    </span>
  );
}

const GRADS = [
  "from-emerald-400 to-cyan-600",
  "from-sky-400 to-indigo-600",
  "from-fuchsia-400 to-purple-600",
  "from-amber-400 to-orange-600",
  "from-rose-400 to-red-600",
  "from-teal-400 to-emerald-600",
  "from-violet-400 to-blue-600",
  "from-lime-400 to-green-600",
];

export function Avatar({ nome, size = 32 }: { nome: string; size?: number }) {
  const limpo = nome.replace(/[^A-Za-zÀ-ú ]/g, " ").trim();
  const partes = limpo.split(/\s+/).filter((p) => p.length > 1);
  const ini = ((partes[0]?.[0] ?? "?") + (partes[1]?.[0] ?? "")).toUpperCase();
  let h = 0;
  for (let i = 0; i < nome.length; i++) h = (h * 31 + nome.charCodeAt(i)) >>> 0;
  return (
    <span
      className={`inline-flex shrink-0 items-center justify-center rounded-full bg-gradient-to-br font-bold text-black/80 ${GRADS[h % GRADS.length]}`}
      style={{ width: size, height: size, fontSize: size * 0.34 }}
    >
      {ini}
    </span>
  );
}

export function HexIcon({ score, size = 14 }: { score: number; size?: number }) {
  const cor = score >= 55 ? "#3fe0a8" : score >= 25 ? "#fbbf24" : "#475569";
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" className="shrink-0">
      <polygon
        points="12,2 21,7 21,17 12,22 3,17 3,7"
        fill={cor}
        fillOpacity="0.25"
        stroke={cor}
        strokeWidth="1.6"
      />
      <polygon points="12,7 16.5,9.5 16.5,14.5 12,17 7.5,14.5 7.5,9.5" fill={cor} fillOpacity="0.8" />
    </svg>
  );
}

export function Painel({
  titulo,
  acao,
  children,
  className = "",
  id,
}: {
  titulo?: React.ReactNode;
  acao?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
  id?: string;
}) {
  return (
    <section id={id} className={`rounded-xl border border-edge bg-ink-900 ${className}`}>
      {titulo && (
        <div className="flex items-center justify-between border-b border-edge px-4 py-3">
          <h2 className="text-sm font-semibold text-white">{titulo}</h2>
          {acao}
        </div>
      )}
      {children}
    </section>
  );
}

export function OrigemChip({ origem }: { origem: string }) {
  return (
    <span
      className={`rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${
        origem === "SPSAV" ? "bg-certik/15 text-certik" : "bg-sky-500/15 text-sky-300"
      }`}
    >
      {origem}
    </span>
  );
}

export function ViaChip({ via }: { via: string | null }) {
  if (!via) return null;
  const in701 = via.startsWith("IN 701");
  return (
    <span
      title={via}
      className={`rounded px-1.5 py-0.5 text-[10px] font-medium ${
        in701 ? "bg-cyan-500/10 text-cyan-400" : "bg-purple-500/10 text-purple-400"
      }`}
    >
      {in701 ? "IN 701" : "IN 704"}
    </span>
  );
}

export type LinksInst = {
  site?: string;
  twitter?: string;
  linkedin?: string;
  instagram?: string;
};

export function IconGlobo({ size = 15 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7">
      <circle cx="12" cy="12" r="9" />
      <path d="M3 12h18M12 3c2.8 2.6 4 5.7 4 9s-1.2 6.4-4 9c-2.8-2.6-4-5.7-4-9s1.2-6.4 4-9Z" />
    </svg>
  );
}

export function IconX({ size = 13 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor">
      <path d="M18.9 2H22l-6.8 7.8L23.3 22h-6.3l-4.9-6.4L6.5 22H3.4l7.3-8.3L1.1 2h6.5l4.4 5.9L18.9 2Zm-1.1 18.1h1.7L7 3.8H5.1l12.7 16.3Z" />
    </svg>
  );
}

export function IconLinkedIn({ size = 14 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor">
      <path d="M4.98 3.5a2.5 2.5 0 1 1 0 5 2.5 2.5 0 0 1 0-5ZM3 9h4v12H3V9Zm7 0h3.8v1.7h.1c.5-1 1.8-2 3.7-2 4 0 4.7 2.6 4.7 6V21h-4v-5.5c0-1.3 0-3-1.9-3s-2.1 1.4-2.1 2.9V21h-4V9Z" />
    </svg>
  );
}

export function IconInstagram({ size = 14 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
      <rect x="3" y="3" width="18" height="18" rx="5" />
      <circle cx="12" cy="12" r="4" />
      <circle cx="17.2" cy="6.8" r="1" fill="currentColor" stroke="none" />
    </svg>
  );
}

export function IconBusca({ size = 14 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <circle cx="11" cy="11" r="7" />
      <path d="m20 20-3.5-3.5" />
    </svg>
  );
}

function LinkIcone({
  href,
  title,
  children,
  mini = false,
}: {
  href: string;
  title: string;
  children: React.ReactNode;
  mini?: boolean;
}) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      title={title}
      className={`inline-flex items-center justify-center rounded-lg border border-edge bg-ink-800 text-slate-400 transition-colors hover:border-certik/40 hover:text-certik ${
        mini ? "h-6 w-6" : "h-9 w-9"
      }`}
    >
      {children}
    </a>
  );
}

export function LinksExternos({
  links,
  nome,
  mini = false,
  fallback = true,
}: {
  links: LinksInst;
  nome: string;
  mini?: boolean;
  fallback?: boolean;
}) {
  const temReal = links.site || links.twitter || links.linkedin || links.instagram;
  const q = encodeURIComponent(`"${nome}"`);
  const s = mini ? 12 : 15;
  return (
    <div className={`flex items-center ${mini ? "gap-1" : "gap-2"}`}>
      {links.site && (
        <LinkIcone mini={mini} href={links.site} title={`Website: ${links.site}`}>
          <IconGlobo size={s} />
        </LinkIcone>
      )}
      {links.twitter && (
        <LinkIcone mini={mini} href={links.twitter} title="Perfil no X">
          <IconX size={s - 2} />
        </LinkIcone>
      )}
      {links.linkedin && (
        <LinkIcone mini={mini} href={links.linkedin} title="LinkedIn">
          <IconLinkedIn size={s - 1} />
        </LinkIcone>
      )}
      {links.instagram && (
        <LinkIcone mini={mini} href={links.instagram} title="Instagram">
          <IconInstagram size={s - 1} />
        </LinkIcone>
      )}
      {!temReal && fallback && (
        <>
          <LinkIcone mini={mini} href={`https://www.google.com/search?q=${q}`} title="Buscar no Google">
            <IconBusca size={s - 1} />
          </LinkIcone>
          <LinkIcone mini={mini} href={`https://x.com/search?q=${q}`} title="Buscar no X">
            <IconX size={s - 2} />
          </LinkIcone>
        </>
      )}
    </div>
  );
}

export function ShieldLogo({ size = 28, cor = "#d5114d" }: { size?: number; cor?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 200 212" fill="none" stroke={cor} strokeWidth="17">
      <path d="M40 35 L100 12 L160 35" />
      <path d="M15 33 C8 120 38 182 100 204" />
      <path d="M185 33 C192 120 162 182 100 204" />
      <path d="M25 62 L100 204 L175 62" />
      <path d="M56 108 H144" />
    </svg>
  );
}
