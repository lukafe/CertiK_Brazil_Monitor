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

export function listInstituicoes(): InstComRating[] {
  return db()
    .prepare(
      `SELECT i.*, r.regulatorio, r.atividade, r.ecossistema, r.pessoas, r.solidez,
              COALESCE(r.rating, 0) rating, COALESCE(r.nota, 'D') nota, r.via
       FROM instituicoes i
       LEFT JOIN ratings r ON r.cnpj = i.cnpj AND r.mes_ref = i.mes_ref
       ORDER BY r.rating DESC, i.razao_social ASC`
    )
    .all() as InstComRating[];
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
