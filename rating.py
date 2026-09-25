"""
Motor de rating v2 — 5 pilares (0-100) + nota AAA-D + via regulatória (IN 701/704).

Arquitetura "fatos → rating": coletores gravam fatos atômicos; este script
recomputa os pilares a partir dos fatos + dados cadastrais e grava em `ratings`.

Pilares e pesos:
  regulatorio 30% | atividade 25% | ecossistema 20% | pessoas 15% | solidez 10%

Uso: .venv/bin/python rating.py
"""
from __future__ import annotations

import math
import sqlite3
from datetime import date
from pathlib import Path

DB = Path("data/monitor.db")
PESOS = {"regulatorio": 0.30, "atividade": 0.25, "ecossistema": 0.20, "pessoas": 0.15, "solidez": 0.10}

SCHEMA = """
CREATE TABLE IF NOT EXISTS fatos (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    cnpj TEXT NOT NULL,
    tipo TEXT NOT NULL,          -- associacao | evento | noticia | site | pessoa | manual
    fonte TEXT,                  -- ex.: 'abcripto', 'gemini', 'manual'
    url TEXT,
    data TEXT,                   -- YYYY-MM-DD quando conhecida
    confianca REAL DEFAULT 1.0,  -- 0-1 (oficial=1, imprensa=0.8, IA=0.6)
    descricao TEXT,
    criado_em TEXT DEFAULT (datetime('now')),
    UNIQUE (cnpj, tipo, fonte, descricao)
);
CREATE TABLE IF NOT EXISTS ratings (
    cnpj TEXT, mes_ref TEXT,
    regulatorio REAL, atividade REAL, ecossistema REAL, pessoas REAL, solidez REAL,
    rating REAL, nota TEXT, via TEXT,
    PRIMARY KEY (cnpj, mes_ref)
);
CREATE INDEX IF NOT EXISTS idx_fatos_cnpj ON fatos(cnpj);
"""

# Res. BCB 520, arts. 19-20: segmentos já autorizados que apenas COMUNICAM (IN 701).
SEG_IN701 = ("BANCO", "CAIXA ECON", "CORRETORA DE TVM", "DISTRIBUIDORA DE TVM",
             "CORRETORA DE C", "CORRETORA DE TITULOS", "CORRETORA DE TÍTULOS",
             "DISTRIBUIDORA DE TITULOS", "DISTRIBUIDORA DE TÍTULOS")


def nota(r: float) -> str:
    for corte, n in ((85, "AAA"), (70, "AA"), (55, "A"), (40, "BBB"), (25, "BB"), (10, "B")):
        if r >= corte:
            return n
    return "D"


def via_regulatoria(origem: str, segmento: str) -> str:
    if origem == "SPSAV":
        return "IN 704 (autorização)"
    seg = (segmento or "").upper()
    if any(s in seg for s in SEG_IN701):
        return "IN 701 (comunicação)"
    return "IN 704 (autorização)"


def clamp(x: float) -> float:
    return max(0.0, min(100.0, x))


def idade_anos(data_inicio: str | None) -> float:
    if not data_inicio or len(data_inicio) != 8:
        return 0.0
    try:
        d = date(int(data_inicio[:4]), int(data_inicio[4:6]), int(data_inicio[6:8]))
        return max(0.0, (date.today() - d).days / 365.25)
    except ValueError:
        return 0.0


def capital_score(capital: str | None) -> float:
    """Escala log: R$100k→25, R$1M→50, R$10M→75, R$100M+→100."""
    try:
        v = float((capital or "0").replace(",", "."))
    except ValueError:
        v = 0.0
    if v < 1000:
        return 0.0
    return clamp((math.log10(v) - 3) / 5 * 100)  # 1e3→0 ... 1e8→100


def main():
    con = sqlite3.connect(DB)
    con.row_factory = sqlite3.Row
    con.executescript(SCHEMA)

    insts = [dict(r) for r in con.execute("SELECT * FROM instituicoes").fetchall()]
    mes = max(i["mes_ref"] for i in insts)

    # fatos agregados por cnpj/tipo (com confiança máxima)
    fatos: dict[str, dict[str, int]] = {}
    for r in con.execute("SELECT cnpj, tipo, COUNT(*) n FROM fatos GROUP BY cnpj, tipo"):
        fatos.setdefault(r["cnpj"], {})[r["tipo"]] = r["n"]

    for i in insts:
        f = fatos.get(i["cnpj"], {})
        spsav = i["origem"] == "SPSAV"

        # 1) Regulatório (30%) — SPSAV mudou razão social = aplicando; incumbente elegível parte de base
        if spsav:
            reg = 100.0
        else:
            reg = 40.0                                    # elegível Res. 520
            reg += 10.0 if i["situacao"] == "02" else 0   # cadastro ativo
            seg = (i["segmento"] or "").upper()
            reg += 10.0 if "BANCO" in seg or "CAIXA" in seg else 5.0  # full-service pesa mais
            reg += 20.0 if (i["sinal_site"] == 1 and i["sinal_noticias"] == 1) else 0  # forte indício de comunicação próxima

        # 2) Atividade pública (25%) — notícias + site + fatos de notícia/site coletados
        ativ = 0.0
        ativ += 55.0 if i["sinal_noticias"] == 1 else 0
        ativ += 35.0 if i["sinal_site"] == 1 else 0
        ativ += min(10.0, 5.0 * f.get("noticia", 0) + 5.0 * f.get("site", 0))
        if spsav and ativ == 0:
            ativ = 30.0  # constituir/renomear a empresa já é atividade pública

        # 3) Ecossistema (20%) — associações e eventos (fatos dos coletores)
        eco = clamp(30.0 * f.get("associacao", 0) + 20.0 * f.get("evento", 0))

        # 4) Pessoas (15%) — sócios em comum com SPSAV, grupo econômico, quadro societário
        pes = 0.0
        pes += 50.0 if i["socio_comum"] else 0
        pes += 30.0 if i["sinal_grupo_spsav"] == 1 and not i["socio_comum"] else 0
        n_socios = len((i["socios"] or "").split(" | ")) if i["socios"] else 0
        pes += min(20.0, n_socios * 5.0)                 # quadro societário identificado
        pes += min(20.0, 20.0 * f.get("pessoa", 0))      # decisores mapeados (coletor futuro)
        pes = clamp(pes)

        # 5) Solidez (10%) — capital social (70%), idade (20%), situação (10%)
        sol = 0.7 * capital_score(i["capital_social"]) + \
              0.2 * clamp(idade_anos(i["data_inicio"]) / 20 * 100) + \
              0.1 * (100.0 if i["situacao"] == "02" else 0.0)

        pilares = {"regulatorio": clamp(reg), "atividade": clamp(ativ),
                   "ecossistema": eco, "pessoas": pes, "solidez": clamp(sol)}
        total = round(sum(pilares[p] * w for p, w in PESOS.items()), 1)

        con.execute("""INSERT OR REPLACE INTO ratings VALUES (?,?,?,?,?,?,?,?,?,?)""",
                    (i["cnpj"], mes, *[round(pilares[p], 1) for p in
                     ("regulatorio", "atividade", "ecossistema", "pessoas", "solidez")],
                     total, nota(total), via_regulatoria(i["origem"], i["segmento"])))

    con.commit()
    print(f"ratings gravados para {len(insts)} instituições (mês {mes})")
    for r in con.execute("""SELECT nota, COUNT(*) FROM ratings WHERE mes_ref=? GROUP BY nota
                            ORDER BY CASE nota WHEN 'AAA' THEN 0 WHEN 'AA' THEN 1 WHEN 'A' THEN 2
                            WHEN 'BBB' THEN 3 WHEN 'BB' THEN 4 WHEN 'B' THEN 5 ELSE 6 END""", (mes,)):
        print(f"  {r[0]:>3}: {r[1]}")
    con.close()


if __name__ == "__main__":
    main()
