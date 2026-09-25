"""
Agrupador de entidades — detecta instituições do mesmo grupo econômico / mesmo nome
e grava grupo_id + grupo_nome em `instituicoes`.

Sinais de união (union-find):
  1) mesmo token distintivo inicial do nome (ex.: BRADESCO, BMG, INTER, ABC)
  2) sócio pessoa-física/jurídica idêntico entre duas instituições (nome >= 12 chars)

Só forma grupo com 2+ entidades; instituições solo ficam com grupo_id NULL.

Uso: .venv/bin/python grupos.py
"""
from __future__ import annotations

import re
import sqlite3
import unicodedata
from collections import Counter, defaultdict
from pathlib import Path

DB = Path("data/monitor.db")

GENERICAS = {"BANCO", "BANK", "BRASIL", "BRASILEIRA", "BRASILEIRO", "SOCIEDADE", "CORRETORA",
             "DISTRIBUIDORA", "CAMBIO", "TITULOS", "VALORES", "MOBILIARIOS", "CREDITO",
             "FINANCEIRA", "FINANCEIRO", "FINANCAS", "INVESTIMENTO", "INVESTIMENTOS", "GRUPO",
             "NOVA", "NOVO", "PRIMEIRA", "NACIONAL", "CAPITAL", "DIGITAL", "SERVICOS",
             "PRESTADORA", "PROVEDOR", "ATIVOS", "VIRTUAIS", "VIRTUAL", "PAGAMENTOS", "ASSET",
             "ASSETS", "GESTAO", "GESTORA", "ADMINISTRACAO", "ADMINISTRADORA", "PARTICIPACOES",
             "HOLDING", "CONSULTORIA", "TECNOLOGIA", "INTERMEDIACAO", "CORRETAGEM", "EXCHANGE",
             "INSTITUCIONAL", "COOPERATIVO", "COMERCIAL", "MULTIPLO", "CLEARING", "SECURITIES",
             "CAIXA", "ECONOMICA", "FEDERAL", "ESTADO", "INDUSTRIAL", "AMERICA", "GLOBAL",
             "INTERNACIONAL", "COMPANHIA", "ANONIMA", "LIMITADA", "FINANCEIROS", "FINANCEIRAS",
             "DE", "DO", "DA", "DOS", "DAS"}


def norm(s: str) -> str:
    s = unicodedata.normalize("NFKD", s.upper()).encode("ascii", "ignore").decode()
    s = re.sub(r"\b(S[/.]?A\.?|LTDA\.?|EIRELI|CIA\.?|DTVM|CTVM|CCVM|SCFI|SPSAV)\b", " ", s)
    return re.sub(r"[^A-Z0-9 ]", " ", s)


def chave(razao: str) -> str | None:
    """Primeiro token distintivo (>=2 chars, fora das genéricas).
    Tokens de 2 chars só valem se tiverem dígito (XP não, C6 sim) ou forem marca conhecida."""
    MARCAS_2 = {"XP", "BV", "JP", "BS", "VR", "BB"}
    AMBIGUAS = {"MERCADO", "GERAL", "TRUST", "PRIME", "UNIAO", "FIRST", "ONE"}  # exigem 2º token
    toks = [p for p in norm(razao).split() if p not in GENERICAS
            and (len(p) >= 3 or (len(p) == 2 and (any(ch.isdigit() for ch in p) or p in MARCAS_2)))]
    if not toks:
        return None
    if toks[0] in AMBIGUAS:
        return " ".join(toks[:2]) if len(toks) >= 2 else toks[0]
    return toks[0]


class UF:
    def __init__(self):
        self.pai: dict[str, str] = {}

    def find(self, x: str) -> str:
        self.pai.setdefault(x, x)
        while self.pai[x] != x:
            self.pai[x] = self.pai[self.pai[x]]
            x = self.pai[x]
        return x

    def union(self, a: str, b: str):
        ra, rb = self.find(a), self.find(b)
        if ra != rb:
            self.pai[rb] = ra


def main():
    con = sqlite3.connect(DB)
    con.row_factory = sqlite3.Row
    cols = {r[1] for r in con.execute("PRAGMA table_info(instituicoes)")}
    for c in ("grupo_id", "grupo_nome"):
        if c not in cols:
            con.execute(f"ALTER TABLE instituicoes ADD COLUMN {c} TEXT")

    insts = [dict(r) for r in con.execute(
        "SELECT cnpj, razao_social, nome_fantasia, socios FROM instituicoes")]

    uf = UF()
    # sinal 1: mesmo token distintivo inicial
    por_chave: dict[str, list[str]] = defaultdict(list)
    chaves: dict[str, str] = {}
    for i in insts:
        k = chave(i["razao_social"])
        if k:
            chaves[i["cnpj"]] = k
            por_chave[k].append(i["cnpj"])
    for k, cnpjs in por_chave.items():
        for c in cnpjs[1:]:
            uf.union(cnpjs[0], c)

    # sinal 2: sócio idêntico (nome >= 12 chars, evita homônimos curtos)
    por_socio: dict[str, list[str]] = defaultdict(list)
    for i in insts:
        for s in (i["socios"] or "").split(" | "):
            s = s.strip()
            if len(s) >= 12:
                por_socio[norm(s).strip()].append(i["cnpj"])
    for s, cnpjs in por_socio.items():
        if 2 <= len(cnpjs) <= 6:   # sócio em muitas empresas = provável gestor profissional, ignora
            for c in cnpjs[1:]:
                uf.union(cnpjs[0], c)

    # materializa grupos com 2+ membros
    membros: dict[str, list[str]] = defaultdict(list)
    for i in insts:
        membros[uf.find(i["cnpj"])].append(i["cnpj"])

    n_grupos = 0
    con.execute("UPDATE instituicoes SET grupo_id = NULL, grupo_nome = NULL")
    for raiz, cnpjs in membros.items():
        if len(cnpjs) < 2:
            continue
        # nome do grupo: token distintivo mais comum entre os membros
        toks = Counter(chaves[c] for c in cnpjs if c in chaves)
        if toks:
            nome = toks.most_common(1)[0][0].title()
        else:  # todos os nomes só têm palavras genéricas — usa 1ª palavra útil do 1º membro
            razao = next(i["razao_social"] for i in insts if i["cnpj"] == cnpjs[0])
            uteis = [p for p in norm(razao).split() if p not in {"BANCO", "DE", "DO", "DA", "DOS", "DAS"}]
            nome = uteis[0].title() if uteis else "Grupo"
        gid = f"g_{raiz}"
        for c in cnpjs:
            con.execute("UPDATE instituicoes SET grupo_id=?, grupo_nome=? WHERE cnpj=?",
                        (gid, nome, c))
        n_grupos += 1

    con.commit()
    print(f"{n_grupos} grupos formados")
    for r in con.execute("""SELECT grupo_nome, COUNT(*) n, GROUP_CONCAT(razao_social, ' || ')
                            FROM instituicoes WHERE grupo_id IS NOT NULL
                            GROUP BY grupo_id ORDER BY n DESC LIMIT 25"""):
        print(f"  {r[0]:<15} {r[1]:>2}: {r[2][:150]}")
    con.close()


if __name__ == "__main__":
    main()
