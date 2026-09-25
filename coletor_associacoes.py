"""
Coletor de associações — raspa páginas públicas de membros/associados e grava fatos.

Matching: normaliza nomes (remove S.A., LTDA, acentos) e procura o "nome-núcleo"
da instituição no texto da página da associação. Conservador: exige nome com 2+
palavras ou 1 palavra distintiva (>= 5 letras, não genérica).

Uso: .venv/bin/python coletor_associacoes.py
"""
from __future__ import annotations

import re
import sqlite3
import unicodedata
from pathlib import Path

import requests

DB = Path("data/monitor.db")
UA = {"User-Agent": "Mozilla/5.0 (universo-psav-research)"}

ASSOCIACOES = {
    "abcripto": "https://www.abcripto.com.br/associados",
    # "abfintechs": página é JS-rendered — precisa de headless browser (pendente)
    "abbi": "https://www.abbi.com.br/associados",
    "abtoken": "https://abtoken.com.br/",
    "febraban": "https://portal.febraban.org.br/paginas/91/pt-br/",
    # "fenasbac": sem lista pública de membros (relação com o setor é via LIFT Lab) — curadoria manual
    "zetta": "https://www.somoszetta.org.br/associados",
    "anbima": "https://www.anbima.com.br/pt_br/institucional/associados",
}

GENERICAS = {"BANCO", "BANK", "BRASIL", "SOCIEDADE", "CORRETORA", "DISTRIBUIDORA", "CAMBIO",
             "TITULOS", "VALORES", "MOBILIARIOS", "CREDITO", "FINANCEIRA", "INVESTIMENTO",
             "INVESTIMENTOS", "GRUPO", "NOVA", "NOVO", "PRIMEIRA", "NACIONAL", "CAPITAL",
             "DIGITAL", "SERVICOS", "PRESTADORA", "ATIVOS", "VIRTUAIS", "PAGAMENTOS", "ASSET",
             "GESTAO", "GESTORA", "ADMINISTRACAO", "ADMINISTRADORA", "PARTICIPACOES", "HOLDING",
             "CONSULTORIA", "TECNOLOGIA", "INTERMEDIACAO", "CORRETAGEM", "EXCHANGE", "FINANCAS",
             "FINANCEIRO", "FINANCEIRA", "BRASILEIRA", "BRASILEIRO", "INSTITUCIONAL"}


def norm(s: str) -> str:
    s = unicodedata.normalize("NFKD", s.upper()).encode("ascii", "ignore").decode()
    s = re.sub(r"\b(S[/.]?A\.?|LTDA\.?|EIRELI|S\.?A\.?|CIA\.?|DTVM|CTVM|CCVM|SCFI)\b", " ", s)
    return re.sub(r"[^A-Z0-9 ]", " ", s)


def nucleo(razao: str) -> list[str]:
    """Palavras distintivas do início do nome (>=3 letras, até achar genérica)."""
    palavras = [p for p in norm(razao).split() if len(p) >= 3]
    out = []
    for p in palavras:
        if p in GENERICAS:
            if out:
                break
            continue
        out.append(p)
        if len(out) == 3:
            break
    return out


def match(nuc: list[str], texto: str) -> bool:
    if not nuc:
        return False
    if len(nuc) >= 2:
        frase = " ".join(nuc[:2])
        return len(frase) >= 8 and frase in texto
    p = nuc[0]
    return len(p) >= 5 and f" {p} " in texto


def main():
    con = sqlite3.connect(DB)
    insts = con.execute("SELECT cnpj, razao_social, nome_fantasia FROM instituicoes").fetchall()

    for nome_assoc, url in ASSOCIACOES.items():
        try:
            html = requests.get(url, headers=UA, timeout=30).text
        except requests.RequestException as e:
            print(f"  {nome_assoc}: FALHOU ({type(e).__name__}) — {url}")
            continue
        texto = " " + norm(re.sub(r"<[^>]+>", " ", html)) + " "
        hits = 0
        for cnpj, razao, fantasia in insts:
            achou = match(nucleo(razao), texto) or (fantasia and match(nucleo(fantasia), texto))
            if achou:
                con.execute("""INSERT OR IGNORE INTO fatos (cnpj, tipo, fonte, url, confianca, descricao)
                               VALUES (?, 'associacao', ?, ?, 0.9, ?)""",
                            (cnpj, nome_assoc, url, f"Listada como associada da {nome_assoc.upper()}"))
                hits += 1
        print(f"  {nome_assoc}: {hits} instituições encontradas")
    con.commit()
    n = con.execute("SELECT COUNT(*) FROM fatos WHERE tipo='associacao'").fetchone()[0]
    print(f"total de fatos de associação no banco: {n}")
    con.close()


if __name__ == "__main__":
    main()
