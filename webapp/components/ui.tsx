import React from "react";

export const NOTAS = ["AAA", "AA", "A", "BBB", "BB", "B", "D"];

function semAcento(s: string) {
  return s.normalize("NFD").replace(/[̀-ͯ]/g, "").toUpperCase();
}

const SEG_CURTO: [string, string][] = [
  ["SPSAV", "SPSAV"],
  ["BANCO MULTIPLO", "Multiple Bank"],
  ["BANCO COMERCIAL", "Commercial Bank"],
  ["BANCO DE INVESTIMENTO", "Investment Bank"],
  ["BANCO DE CAMBIO", "FX Bank"],
  ["BANCO", "Bank"],
  ["CAIXA ECON", "Savings Bank"],
  ["CORRETORA DE TVM", "Securities Broker"],
  ["CORRETORA DE TITULOS", "Securities Broker"],
  ["DISTRIBUIDORA DE TVM", "Securities Dealer"],
  ["DISTRIBUIDORA DE TITULOS", "Securities Dealer"],
  ["CORRETORA DE CAMBIO", "FX Broker"],
  ["CREDITO DIRETO", "SCD"],
  ["EMPRESTIMO ENTRE PESSOAS", "SEP"],
  ["INSTITUICAO DE PAGAMENTO", "Payment Institution"],
  ["CREDITO, FINANCIAMENTO", "Finance Company"],
  ["CREDITO IMOBILIARIO", "Mortgage Company"],
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
  intermediacao: "Intermediation",
  custodia_propria: "Self-custody",
  custodia_terceirizada: "Third-party custody",
  otc: "OTC",
  tokenizacao: "Tokenization",
  pagamentos: "Payments",
  staking: "Staking",
  gestao_ativos: "Asset management",
  infraestrutura: "Infrastructure",
  banco_digital: "Digital banking",
  drex_cbdc: "Drex/CBDC",
  consultoria: "Consulting",
};

/* ---------------------------------------------------------------------------
 * Chip — gramática única de chips (3 tons). Tag/Origem/Via/Modelo/timeline
 * são escolhas de tom, nunca paletas próprias.
 * ------------------------------------------------------------------------- */
export type ChipTone = "accent" | "info" | "neutral";

const CHIP_TONE: Record<ChipTone, string> = {
  accent: "border-accent/25 bg-accent/10 text-accent",
  info: "border-info/25 bg-info/10 text-info",
  neutral: "border-edge bg-surface-raised text-fg-secondary",
};

export function Chip({
  tone = "neutral",
  mini = false,
  title,
  children,
}: {
  tone?: ChipTone;
  mini?: boolean;
  title?: string;
  children: React.ReactNode;
}) {
  return (
    <span
      title={title}
      className={`inline-flex items-center whitespace-nowrap rounded-full border font-medium ${CHIP_TONE[tone]} ${
        mini ? "px-1.5 py-px text-[10px]" : "px-2 py-0.5 text-[11px]"
      }`}
    >
      {children}
    </span>
  );
}

export function TagChip({ tag, mini = false }: { tag: string; mini?: boolean }) {
  return (
    <Chip tone="accent" mini={mini}>
      {TAG_LABEL[tag] ?? tag}
    </Chip>
  );
}

/* ---------------------------------------------------------------------------
 * Rampa de score Skynet (melhor → pior) — fonte única de verdade para cores
 * de notas e scores. Hex idênticos aos tokens --score-* / grade-* do tema.
 * ------------------------------------------------------------------------- */
const GRADE_HEX: Record<string, string> = {
  AAA: "#258c67",
  AA: "#4f9657",
  A: "#799f46",
  BBB: "#cdb225",
  BB: "#d99728",
  B: "#d97028",
  D: "#d94828",
};

export function gradeColor(nota: string): string {
  return GRADE_HEX[nota] ?? "#616161";
}

export function scoreColor(score: number): string {
  if (score >= 80) return "#258c67";
  if (score >= 60) return "#799f46";
  if (score >= 40) return "#cdb225";
  if (score >= 20) return "#d99728";
  return "#d94828";
}

export function gradeClasses(nota: string) {
  switch (nota) {
    case "AAA":
      return "bg-grade-aaa text-white";
    case "AA":
      return "border border-grade-aa/30 bg-grade-aa/15 text-grade-aa";
    case "A":
      return "border border-grade-a/30 bg-grade-a/15 text-grade-a";
    case "BBB":
      return "border border-grade-bbb/30 bg-grade-bbb/15 text-grade-bbb";
    case "BB":
      return "border border-grade-bb/30 bg-grade-bb/15 text-grade-bb";
    case "B":
      return "border border-grade-b/30 bg-grade-b/15 text-grade-b";
    case "D":
      return "border border-grade-d/30 bg-grade-d/15 text-grade-d";
    default:
      return "bg-surface-raised text-fg-muted";
  }
}

export function NotaBadge({ nota, size = "sm" }: { nota: string; size?: "sm" | "lg" }) {
  return (
    <span
      className={`inline-flex items-center justify-center rounded font-bold tracking-tight ${gradeClasses(nota)} ${
        size === "lg" ? "px-3 py-1 text-xl" : "px-1.5 py-0.5 text-[11px]"
      }`}
    >
      {nota}
    </span>
  );
}

export function ScoreChip({ score, size = "sm" }: { score: number; size?: "sm" | "lg" }) {
  const cor = scoreColor(score);
  return (
    <span
      className={`inline-flex items-center justify-center rounded font-mono font-semibold tabular-nums ${
        size === "lg" ? "px-3 py-1 text-4xl tracking-tight" : "px-1.5 py-0.5 text-[11px]"
      }`}
      style={{ color: cor, backgroundColor: `${cor}26` }}
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

export function Avatar({ nome, size = 32 }: { nome: string; size?: number }) {
  const limpo = nome.replace(/[^A-Za-zÀ-ú ]/g, " ").trim();
  const partes = limpo.split(/\s+/).filter((p) => p.length > 1);
  const ini = ((partes[0]?.[0] ?? "?") + (partes[1]?.[0] ?? "")).toUpperCase();
  return (
    <span
      className="inline-flex shrink-0 items-center justify-center rounded-md border border-edge-strong bg-surface-raised font-semibold text-fg-secondary"
      style={{ width: size, height: size, fontSize: size * 0.34 }}
    >
      {ini}
    </span>
  );
}

export function HexIcon({ score, size = 14 }: { score: number; size?: number }) {
  const cor = scoreColor(score);
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
    <section id={id} className={`rounded-lg border border-edge bg-surface ${className}`}>
      {titulo && (
        <div className="flex items-center justify-between border-b border-edge px-4 py-3">
          <h2 className="text-[13px] font-semibold uppercase tracking-wide text-fg-secondary">{titulo}</h2>
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
        origem === "SPSAV" ? "bg-accent/15 text-accent" : "bg-info/15 text-info"
      }`}
    >
      {origem === "INCUMBENTE" ? "INCUMBENT" : origem}
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
        in701 ? "bg-info/10 text-info" : "bg-surface-raised text-fg-secondary"
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
      className={`inline-flex items-center justify-center rounded-md border border-edge bg-surface-raised text-fg-muted transition-colors hover:border-accent/40 hover:text-accent ${
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
        <LinkIcone mini={mini} href={links.twitter} title="X profile">
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
          <LinkIcone mini={mini} href={`https://www.google.com/search?q=${q}`} title="Search on Google">
            <IconBusca size={s - 1} />
          </LinkIcone>
          <LinkIcone mini={mini} href={`https://x.com/search?q=${q}`} title="Search on X">
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
