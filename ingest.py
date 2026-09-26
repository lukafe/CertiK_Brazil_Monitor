"""
Ingestão: out/universo_YYYY-MM.csv → data/monitor.db (SQLite)

Modelo preparado para monitoramento on-going:
- instituicoes: estado atual (1 linha por CNPJ, sobrescrita a cada run)
- snapshots:    histórico mensal de score/sinais (1 linha por CNPJ × mês)
- eventos:      timeline estilo Skynet (score subiu, nova entrada, etc.)

Uso: .venv/bin/python ingest.py            # ingere todos os out/universo_*.csv
"""
from __future__ import annotations

import re
import sqlite3
from pathlib import Path

import polars as pl

OUT, DB = Path("out"), Path("data/monitor.db")

SCHEMA = """
CREATE TABLE IF NOT EXISTS instituicoes (
    cnpj TEXT PRIMARY KEY,
    origem TEXT, segmento TEXT, razao_social TEXT, nome_fantasia TEXT,
    uf TEXT, municipio TEXT, situacao TEXT, data_situacao TEXT, data_inicio TEXT,
    capital_social TEXT, cnae_principal TEXT, email TEXT, telefone TEXT,
    socios TEXT, socio_comum TEXT,
    score INTEGER, sinal_grupo_spsav INTEGER, sinal_site INTEGER,
    sinal_nome INTEGER, sinal_noticias INTEGER,
    evidencia_site TEXT, evidencia_noticias TEXT,
    mes_ref TEXT
);
CREATE TABLE IF NOT EXISTS snapshots (
    cnpj TEXT, mes_ref TEXT, score INTEGER,
    sinal_grupo_spsav INTEGER, sinal_site INTEGER, sinal_nome INTEGER, sinal_noticias INTEGER,
    PRIMARY KEY (cnpj, mes_ref)
);
CREATE TABLE IF NOT EXISTS eventos (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    cnpj TEXT, mes_ref TEXT, tipo TEXT, descricao TEXT,
    criado_em TEXT DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_snap_cnpj ON snapshots(cnpj);
CREATE INDEX IF NOT EXISTS idx_evt_cnpj ON eventos(cnpj);
CREATE TABLE IF NOT EXISTS enriquecimento (
    cnpj TEXT PRIMARY KEY,
    descricao TEXT, produtos TEXT,
    site TEXT, x TEXT, linkedin TEXT, instagram TEXT,
    fonte TEXT, confianca REAL,
    atualizado_em TEXT DEFAULT (datetime('now'))
);
CREATE TABLE IF NOT EXISTS tags (
    cnpj TEXT, tag TEXT, confianca REAL,
    UNIQUE (cnpj, tag)
);
CREATE INDEX IF NOT EXISTS idx_tags_cnpj ON tags(cnpj);
CREATE TABLE IF NOT EXISTS itens_brutos (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    url TEXT, url_hash TEXT UNIQUE,
    titulo TEXT, fonte TEXT, publicado_em TEXT,
    texto TEXT,
    coletado_em TEXT DEFAULT (datetime('now')),
    processado INTEGER DEFAULT 0
);
CREATE TABLE IF NOT EXISTS itens_instituicao (
    item_id INTEGER, cnpj TEXT, metodo TEXT, score_match REAL,
    UNIQUE (item_id, cnpj)
);
CREATE INDEX IF NOT EXISTS idx_itens_proc ON itens_brutos(processado);
CREATE INDEX IF NOT EXISTS idx_itens_inst_cnpj ON itens_instituicao(cnpj);
CREATE TABLE IF NOT EXISTS monitor_config (
    cnpj TEXT PRIMARY KEY,
    ativo INTEGER DEFAULT 0,       -- 1 = monitoramento contínuo ligado
    aliases TEXT,                  -- JSON: nomes pelos quais a empresa aparece na imprensa
    site TEXT, url_produtos TEXT, url_blog TEXT, url_carreiras TEXT,
    gupy_slug TEXT, linkedin_url TEXT,
    prioridade INTEGER DEFAULT 2,  -- 1 alta | 2 média | 3 baixa
    atualizado_em TEXT DEFAULT (datetime('now'))
);
"""


def ingest(csv: Path, con: sqlite3.Connection) -> None:
    mes = re.search(r"universo_(\d{4}-\d{2})", csv.name).group(1)
    df = pl.read_csv(csv, infer_schema_length=0).with_columns(
        pl.col("score").cast(pl.Int32, strict=False).fill_null(0))
    rows = df.to_dicts()

    scores_antigos = dict(con.execute("SELECT cnpj, score FROM instituicoes").fetchall())
    ja_ingerido = {r[0] for r in con.execute("SELECT DISTINCT mes_ref FROM snapshots").fetchall()}
    if mes in ja_ingerido:
        print(f"  {mes}: já ingerido, sobrescrevendo snapshot")

    for r in rows:
        tel = " ".join(filter(None, [r.get("ddd1"), r.get("tel1")])) or None
        sinais = {k: int(r[k]) if r.get(k) not in (None, "") else None
                  for k in ("sinal_grupo_spsav", "sinal_site", "sinal_nome", "sinal_noticias")}
        con.execute("""INSERT INTO instituicoes VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
                       ON CONFLICT(cnpj) DO UPDATE SET
                         origem=excluded.origem, segmento=excluded.segmento,
                         razao_social=excluded.razao_social, nome_fantasia=excluded.nome_fantasia,
                         uf=excluded.uf, municipio=excluded.municipio, situacao=excluded.situacao,
                         data_situacao=excluded.data_situacao, data_inicio=excluded.data_inicio,
                         capital_social=excluded.capital_social, cnae_principal=excluded.cnae_principal,
                         email=excluded.email, telefone=excluded.telefone, socios=excluded.socios,
                         socio_comum=excluded.socio_comum, score=excluded.score,
                         sinal_grupo_spsav=excluded.sinal_grupo_spsav, sinal_site=excluded.sinal_site,
                         sinal_nome=excluded.sinal_nome, sinal_noticias=excluded.sinal_noticias,
                         evidencia_site=excluded.evidencia_site, evidencia_noticias=excluded.evidencia_noticias,
                         mes_ref=excluded.mes_ref""",
                    (r["cnpj"], r["origem"], r["segmento"], r["razao_social"], r["nome_fantasia"],
                     r["uf"], r["municipio"], r["situacao"], r["data_situacao"], r["data_inicio"],
                     r["capital_social"], r["cnae_principal"], r["email"], tel,
                     r["socios"], r["socio_comum"], r["score"],
                     sinais["sinal_grupo_spsav"], sinais["sinal_site"], sinais["sinal_nome"],
                     sinais["sinal_noticias"], r["evidencia_site"], r["evidencia_noticias"], mes))
        con.execute("INSERT OR REPLACE INTO snapshots VALUES (?,?,?,?,?,?,?)",
                    (r["cnpj"], mes, r["score"], sinais["sinal_grupo_spsav"], sinais["sinal_site"],
                     sinais["sinal_nome"], sinais["sinal_noticias"]))
        # eventos (timeline)
        antigo = scores_antigos.get(r["cnpj"])
        if antigo is None and scores_antigos:
            con.execute("INSERT INTO eventos (cnpj, mes_ref, tipo, descricao) VALUES (?,?,?,?)",
                        (r["cnpj"], mes, "nova_entrada", f"Entrou no universo em {mes}"))
        elif antigo is not None and r["score"] > antigo:
            con.execute("INSERT INTO eventos (cnpj, mes_ref, tipo, descricao) VALUES (?,?,?,?)",
                        (r["cnpj"], mes, "score_subiu", f"Score subiu de {antigo} para {r['score']} em {mes}"))
    print(f"  {mes}: {len(rows)} instituições ingeridas")


def main():
    DB.parent.mkdir(exist_ok=True)
    con = sqlite3.connect(DB)
    con.executescript(SCHEMA)
    for csv in sorted(OUT.glob("universo_*.csv")):
        ingest(csv, con)
    con.commit()
    n, s = con.execute("SELECT COUNT(*), COUNT(DISTINCT mes_ref) FROM instituicoes").fetchone()
    print(f"banco {DB}: {n} instituições, meses: {s}")
    con.close()


if __name__ == "__main__":
    main()
