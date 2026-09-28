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

export type InstComLinks = InstComRating & { links: LinksInst; tags: string[] };

export type Enriquecimento = {
  cnpj: string;
  descricao: string | null;
  produtos: string | null;
  site: string | null;
  x: string | null;
  linkedin: string | null;
  instagram: string | null;
  fonte: string | null;
  confianca: number | null;
  atualizado_em: string;
};

export function getEnriquecimento(cnpj: string): (Enriquecimento & { tags: string[] }) | undefined {
  const e = db().prepare("SELECT * FROM enriquecimento WHERE cnpj = ?").get(cnpj) as Enriquecimento | undefined;
  if (!e) return undefined;
  const tags = (db().prepare("SELECT tag FROM tags WHERE cnpj = ? ORDER BY tag").all(cnpj) as { tag: string }[]).map(
    (t) => t.tag
  );
  return { ...e, tags };
}

export function listInstituicoes(): InstComLinks[] {
  const rows = db()
    .prepare(
      `SELECT i.*, r.regulatorio, r.atividade, r.ecossistema, r.pessoas, r.solidez,
              COALESCE(r.rating, 0) rating, COALESCE(r.nota, 'D') nota, r.via,
              l.links_osint,
              e.site e_site, e.x e_x, e.linkedin e_linkedin, e.instagram e_instagram,
              t.tags_csv
       FROM instituicoes i
       LEFT JOIN ratings r ON r.cnpj = i.cnpj AND r.mes_ref = i.mes_ref
       LEFT JOIN enriquecimento e ON e.cnpj = i.cnpj
       LEFT JOIN (
         SELECT cnpj, GROUP_CONCAT(tag, ',') tags_csv FROM (SELECT cnpj, tag FROM tags ORDER BY tag) GROUP BY cnpj
       ) t ON t.cnpj = i.cnpj
       LEFT JOIN (
         SELECT cnpj, GROUP_CONCAT(fonte || '|' || url, ';;') links_osint
         FROM fatos WHERE url IS NOT NULL AND fonte LIKE 'osint_%'
         GROUP BY cnpj
       ) l ON l.cnpj = i.cnpj
       ORDER BY r.rating DESC, i.razao_social ASC`
    )
    .all() as (InstComRating & {
    links_osint: string | null;
    e_site: string | null;
    e_x: string | null;
    e_linkedin: string | null;
    e_instagram: string | null;
    tags_csv: string | null;
  })[];
  return rows.map((r) => {
    const pares = (r.links_osint ?? "")
      .split(";;")
      .filter(Boolean)
      .map((p) => {
        const i = p.indexOf("|");
        return { fonte: p.slice(0, i), url: p.slice(i + 1) };
      });
    const { links_osint: _a, e_site, e_x, e_linkedin, e_instagram, tags_csv, ...resto } = r;
    void _a;
    const links = montarLinks(pares, r.email);
    if (e_site) links.site = e_site;
    if (e_x) links.twitter = e_x;
    if (e_linkedin) links.linkedin = e_linkedin;
    if (e_instagram) links.instagram = e_instagram;
    return { ...resto, links, tags: (tags_csv ?? "").split(",").filter(Boolean) };
  });
}

export type ModeloCustodia = "propria" | "terceirizada" | "hibrida" | "indeterminado" | "sem_custodia";

export type AlvoCustodia = {
  cnpj: string;
  razao_social: string;
  nome_fantasia: string | null;
  segmento: string;
  origem: string;
  situacao: string | null;
  rating: number;
  nota: string;
  tags_custodia: string[];
  confianca: number | null;
  descricao: string | null;
  evidencia_fato: string | null;
  evidencia_fonte: string | null;
  evidencia_url: string | null;
  site: string | null;
  // verificação dedicada do modelo de custódia (tabela custodia_verificacao)
  verif_modelo: ModeloCustodia | null;
  verif_custodiante: string | null;
  verif_justificativa: string | null;
  verif_url: string | null;
  verif_confianca: number | null;
};

/** Alvos de auditoria de custódia (Res. BCB 520, art. 73): PSAVs com tag de custódia própria/terceirizada. */
export function getAlvosCustodia(): AlvoCustodia[] {
  const rows = db()
    .prepare(
      `SELECT i.cnpj, i.razao_social, i.nome_fantasia, i.segmento, i.origem, i.situacao,
              COALESCE(r.rating, 0) rating, COALESCE(r.nota, 'D') nota,
              GROUP_CONCAT(DISTINCT t.tag) tags_csv,
              MAX(e.confianca) confianca, MAX(e.descricao) descricao,
              (SELECT f.descricao FROM fatos f
                WHERE f.cnpj = i.cnpj AND (lower(f.descricao) LIKE '%custod%' OR lower(f.descricao) LIKE '%custód%')
                ORDER BY (f.url IS NOT NULL AND f.url NOT LIKE '%vertexaisearch%') DESC, f.confianca DESC
                LIMIT 1) evidencia_fato,
              (SELECT f.fonte FROM fatos f
                WHERE f.cnpj = i.cnpj AND (lower(f.descricao) LIKE '%custod%' OR lower(f.descricao) LIKE '%custód%')
                ORDER BY (f.url IS NOT NULL AND f.url NOT LIKE '%vertexaisearch%') DESC, f.confianca DESC
                LIMIT 1) evidencia_fonte,
              (SELECT f.url FROM fatos f
                WHERE f.cnpj = i.cnpj AND (lower(f.descricao) LIKE '%custod%' OR lower(f.descricao) LIKE '%custód%')
                  AND f.url IS NOT NULL AND f.url NOT LIKE '%vertexaisearch%'
                ORDER BY f.confianca DESC LIMIT 1) evidencia_url,
              MAX(e.site) site,
              MAX(v.modelo) verif_modelo, MAX(v.custodiante) verif_custodiante,
              MAX(v.justificativa) verif_justificativa, MAX(v.evidencia_url) verif_url,
              MAX(v.confianca) verif_confianca
       FROM tags t
       JOIN instituicoes i ON i.cnpj = t.cnpj
       LEFT JOIN ratings r ON r.cnpj = i.cnpj AND r.mes_ref = i.mes_ref
       LEFT JOIN enriquecimento e ON e.cnpj = i.cnpj
       LEFT JOIN custodia_verificacao v ON v.cnpj = i.cnpj
       WHERE t.tag IN ('custodia_propria', 'custodia_terceirizada')
       GROUP BY i.cnpj
       ORDER BY r.rating DESC, i.razao_social ASC`
    )
    .all() as (Omit<AlvoCustodia, "tags_custodia"> & { tags_csv: string | null })[];
  return rows.map((r) => {
    const { tags_csv, ...resto } = r;
    return { ...resto, tags_custodia: (tags_csv ?? "").split(",").filter(Boolean) };
  });
}

export function getTodosCnpjs(): string[] {
  return (db().prepare("SELECT cnpj FROM instituicoes").all() as { cnpj: string }[]).map((r) => r.cnpj);
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
       WHERE f.tipo IN ('noticia', 'site', 'associacao', 'evento', 'vaga')
       ORDER BY f.criado_em DESC, f.rowid DESC
       LIMIT ?`
    )
    .all(limit) as FeedItem[];
}

/** Fatos do monitoramento contínuo dos últimos 7 dias (bloco da home). */
export function getUltimos7Dias(limit = 12): FeedItem[] {
  return db()
    .prepare(
      `SELECT f.criado_em, f.tipo, f.descricao, f.url, f.fonte, i.cnpj, i.razao_social, i.nome_fantasia,
              COALESCE(r.nota, 'D') nota, COALESCE(r.rating, 0) rating
       FROM fatos f
       JOIN instituicoes i ON i.cnpj = f.cnpj
       LEFT JOIN ratings r ON r.cnpj = i.cnpj AND r.mes_ref = i.mes_ref
       WHERE f.tipo IN ('noticia', 'site', 'vaga', 'pessoa')
         AND COALESCE(f.data, substr(f.criado_em, 1, 10)) >= date('now', '-7 day')
       ORDER BY COALESCE(f.data, substr(f.criado_em, 1, 10)) DESC, f.rowid DESC
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
