import Database from "better-sqlite3";
import fs from "fs";
import path from "path";

const DB_PATH =
  process.env.DB_PATH ??
  [path.join(process.cwd(), "data", "monitor.db"), path.join(process.cwd(), "..", "data", "monitor.db")].find(
    (p) => fs.existsSync(p)
  ) ??
  path.join(process.cwd(), "data", "monitor.db");

let _db: Database.Database | null = null;
function db() {
  if (!_db) _db = new Database(DB_PATH, { readonly: true, fileMustExist: true });
  return _db;
}

export type Instituicao = {
  cnpj: string;
  origem: "SPSAV" | "INCUMBENTE";
  segmento: string;
  razao_social: string;
  nome_fantasia: string | null;
  uf: string | null;
  municipio: string | null;
  situacao: string | null;
  data_situacao: string | null;
  data_inicio: string | null;
  capital_social: string | null;
  cnae_principal: string | null;
  email: string | null;
  telefone: string | null;
  socios: string | null;
  socio_comum: string | null;
  score: number;
  sinal_grupo_spsav: number | null;
  sinal_site: number | null;
  sinal_nome: number | null;
  sinal_noticias: number | null;
  evidencia_site: string | null;
  evidencia_noticias: string | null;
  mes_ref: string;
  grupo_id: string | null;
  grupo_nome: string | null;
};

export type Snapshot = {
  mes_ref: string;
  score: number;
};

export type Evento = {
  mes_ref: string;
  tipo: string;
  descricao: string;
  criado_em: string;
};

export type Rating = {
  regulatorio: number;
  atividade: number;
  ecossistema: number;
  pessoas: number;
  solidez: number;
  rating: number;
  nota: string;
  via: string;
};

export type Fato = {
  tipo: string;
  fonte: string | null;
  url: string | null;
  data: string | null;
  confianca: number;
  descricao: string | null;
  criado_em: string;
};

export type InstComRating = Instituicao & Rating;

export type LinksInst = {
  site?: string;
  twitter?: string;
  linkedin?: string;
  instagram?: string;
};

const GENERIC_MAIL = new Set([
  "gmail.com", "hotmail.com", "outlook.com", "yahoo.com", "yahoo.com.br",
  "uol.com.br", "bol.com.br", "terra.com.br", "icloud.com", "live.com",
  "msn.com", "globo.com", "ig.com.br", "protonmail.com", "proton.me",
]);
const TERCEIROS = ["contab", "advocacia", "advogad", "juridic", "adv.br", "escritorio", "assessoria"];

export function siteFromEmail(email: string | null): string | undefined {
  const e = (email ?? "").toLowerCase().trim();
  if (!e.includes("@")) return undefined;
  const dom = e.split("@").pop()!;
  if (!dom.includes(".") || GENERIC_MAIL.has(dom) || TERCEIROS.some((t) => dom.includes(t))) return undefined;
  return `https://${dom}`;
}

export function montarLinks(pares: { fonte: string | null; url: string | null }[], email: string | null): LinksInst {
  const links: LinksInst = {};
  for (const { fonte, url } of pares) {
    if (!url) continue;
    if (fonte === "osint_dominio" && !links.site) links.site = url;
    else if (fonte === "osint_twitter" && !links.twitter) links.twitter = url;
    else if (fonte === "osint_linkedin" && !links.linkedin) links.linkedin = url;
    else if (fonte === "osint_instagram" && !links.instagram) links.instagram = url;
  }
  if (!links.site) links.site = siteFromEmail(email);
  return links;
}

export type InstComLinks = InstComRating & { links: LinksInst };

export function listInstituicoes(): InstComLinks[] {
  const rows = db()
    .prepare(
      `SELECT i.*, r.regulatorio, r.atividade, r.ecossistema, r.pessoas, r.solidez,
              COALESCE(r.rating, 0) rating, COALESCE(r.nota, 'D') nota, r.via,
              l.links_osint
       FROM instituicoes i
       LEFT JOIN ratings r ON r.cnpj = i.cnpj AND r.mes_ref = i.mes_ref
       LEFT JOIN (
         SELECT cnpj, GROUP_CONCAT(fonte || '|' || url, ';;') links_osint
         FROM fatos WHERE url IS NOT NULL AND fonte LIKE 'osint_%'
         GROUP BY cnpj
       ) l ON l.cnpj = i.cnpj
       ORDER BY r.rating DESC, i.razao_social ASC`
    )
    .all() as (InstComRating & { links_osint: string | null })[];
  return rows.map((r) => {
    const pares = (r.links_osint ?? "")
      .split(";;")
      .filter(Boolean)
      .map((p) => {
        const i = p.indexOf("|");
        return { fonte: p.slice(0, i), url: p.slice(i + 1) };
      });
    const { links_osint: _drop, ...resto } = r;
    void _drop;
    return { ...resto, links: montarLinks(pares, r.email) };
  });
}

export function getRandomCnpj(): string {
  return (db().prepare("SELECT cnpj FROM instituicoes ORDER BY RANDOM() LIMIT 1").get() as { cnpj: string }).cnpj;
}

export function getInstituicao(cnpj: string): InstComRating | undefined {
  return db()
    .prepare(
      `SELECT i.*, r.regulatorio, r.atividade, r.ecossistema, r.pessoas, r.solidez,
              COALESCE(r.rating, 0) rating, COALESCE(r.nota, 'D') nota, r.via
       FROM instituicoes i
       LEFT JOIN ratings r ON r.cnpj = i.cnpj AND r.mes_ref = i.mes_ref
       WHERE i.cnpj = ?`
    )
    .get(cnpj) as InstComRating | undefined;
}

export function getGrupoMembros(grupoId: string): InstComRating[] {
  return db()
    .prepare(
      `SELECT i.*, r.regulatorio, r.atividade, r.ecossistema, r.pessoas, r.solidez,
              COALESCE(r.rating, 0) rating, COALESCE(r.nota, 'D') nota, r.via
       FROM instituicoes i
       LEFT JOIN ratings r ON r.cnpj = i.cnpj AND r.mes_ref = i.mes_ref
       WHERE i.grupo_id = ?
       ORDER BY r.rating DESC, i.razao_social ASC`
    )
    .all(grupoId) as InstComRating[];
}

export function getFatos(cnpj: string): Fato[] {
  return db()
    .prepare(
      "SELECT tipo, fonte, url, data, confianca, descricao, criado_em FROM fatos WHERE cnpj = ? ORDER BY criado_em DESC"
    )
    .all(cnpj) as Fato[];
}

export function getSnapshots(cnpj: string): Snapshot[] {
  return db()
    .prepare("SELECT mes_ref, score FROM snapshots WHERE cnpj = ? ORDER BY mes_ref")
    .all(cnpj) as Snapshot[];
}

export function getEventos(cnpj: string): Evento[] {
  return db()
    .prepare(
      "SELECT mes_ref, tipo, descricao, criado_em FROM eventos WHERE cnpj = ? ORDER BY criado_em DESC"
    )
    .all(cnpj) as Evento[];
}

export type FeedItem = {
  criado_em: string;
  tipo: string;
  descricao: string | null;
  url: string | null;
  fonte: string | null;
  cnpj: string;
  razao_social: string;
  nome_fantasia: string | null;
  nota: string;
  rating: number;
};

export function getFeedFatos(limit = 30): FeedItem[] {
  return db()
    .prepare(
      `SELECT f.criado_em, f.tipo, f.descricao, f.url, f.fonte, i.cnpj, i.razao_social, i.nome_fantasia,
              COALESCE(r.nota, 'D') nota, COALESCE(r.rating, 0) rating
       FROM fatos f
       JOIN instituicoes i ON i.cnpj = f.cnpj
       LEFT JOIN ratings r ON r.cnpj = i.cnpj AND r.mes_ref = i.mes_ref
       WHERE f.tipo IN ('noticia', 'site', 'associacao', 'evento')
       ORDER BY f.criado_em DESC, f.rowid DESC
       LIMIT ?`
    )
    .all(limit) as FeedItem[];
}

export type Setor = { segmento: string; n: number; media: number };

export function getSetores(): Setor[] {
  return db()
    .prepare(
      `SELECT i.segmento, COUNT(*) n, AVG(COALESCE(r.rating, 0)) media
       FROM instituicoes i
       LEFT JOIN ratings r ON r.cnpj = i.cnpj AND r.mes_ref = i.mes_ref
       GROUP BY i.segmento
       ORDER BY n DESC`
    )
    .all() as Setor[];
}

export function getStats() {
  const d = db();
  const row = (q: string) => d.prepare(q).get() as Record<string, number>;
  return {
    spsav: row("SELECT COUNT(*) n FROM instituicoes WHERE origem='SPSAV'").n,
    incumbentes: row("SELECT COUNT(*) n FROM instituicoes WHERE origem='INCUMBENTE'").n,
    comSinal: row(
      "SELECT COUNT(*) n FROM instituicoes WHERE origem='INCUMBENTE' AND score > 0"
    ).n,
    mesRef: (d.prepare("SELECT MAX(mes_ref) m FROM instituicoes").get() as { m: string }).m,
  };
}
