"""
Etapa 1 do monitoramento contínuo — cadastro de monitoramento (`monitor_config`).

Gera a configuração inicial de monitoramento por instituição:
  * aliases automáticos a partir de razão social e nome fantasia (remove sufixos
    societários e "SPSAV"/"prestadora de serviços de ativos virtuais", normaliza
    acentos e caixa);
  * ativo=1 para origem='SPSAV' ou rating >= BBB no mês mais recente;
  * prioridade: 1 (rating >= A), 2 (demais ativos), 3 (inativos);
  * semeia site/linkedin_url a partir da tabela `enriquecimento` (links já
    validados) e, na falta, do domínio do e-mail cadastral.

Nunca sobrescreve valores já preenchidos no banco (manuais ou importados);
aliases são unidos (união de conjuntos).

Uso:
  .venv/bin/python config_monitor.py                # semeia + exporta CSV
  .venv/bin/python config_monitor.py --exportar     # só exporta data/monitor_config.csv
  .venv/bin/python config_monitor.py --importar     # reimporta o CSV editado (CSV vence)
  Flags: --dry-run (não grava) | --cnpj <cnpj> (uma instituição só)

No CSV, o campo `aliases` usa " | " como separador para facilitar a edição.
"""
from __future__ import annotations

import argparse
import csv
import json
import re
import sqlite3
import unicodedata
from pathlib import Path

DB = Path("data/monitor.db")
CSV_PATH = Path("data/monitor_config.csv")

NOTAS_BBB_OU_MELHOR = ("AAA", "AA", "A", "BBB")
NOTAS_A_OU_MELHOR = ("AAA", "AA", "A")

# Sufixos/termos societários removidos do fim (e do meio, no caso dos longos).
SUFIXOS_LONGOS = [
    "SOCIEDADE PRESTADORA DE SERVICOS DE ATIVOS VIRTUAIS",
    "PRESTADORA DE SERVICOS DE ATIVOS VIRTUAIS",
    "SERVICOS DE ATIVOS VIRTUAIS",
    "SOCIEDADE ANONIMA",
    "INSTITUICAO DE PAGAMENTO",
    "SOCIEDADE DE CREDITO DIRETO",
    "CORRETORA DE TITULOS E VALORES MOBILIARIOS",
    "DISTRIBUIDORA DE TITULOS E VALORES MOBILIARIOS",
    "CORRETORA DE CAMBIO",
]
SUFIXOS_CURTOS = ["S.A.", "S.A", "S/A", "SA", "LTDA.", "LTDA", "EIRELI", "ME", "EPP", "SPSAV", "-", "–"]

GENERIC_MAIL = {"gmail.com", "hotmail.com", "outlook.com", "yahoo.com", "yahoo.com.br",
                "uol.com.br", "bol.com.br", "terra.com.br", "icloud.com", "live.com",
                "msn.com", "globo.com", "ig.com.br", "protonmail.com", "proton.me"}
TERCEIROS = ("contab", "advocacia", "advogad", "juridic", "adv.br", "escritorio", "assessoria")

CAMPOS_URL = ("site", "url_produtos", "url_blog", "url_carreiras", "gupy_slug", "linkedin_url")


def sem_acento(s: str) -> str:
    return unicodedata.normalize("NFKD", s).encode("ascii", "ignore").decode()


def limpar_nome(nome: str) -> str:
    """Remove sufixos societários e normaliza um nome para virar alias."""
    n = sem_acento(nome or "").upper()
    n = re.sub(r"[,;]+", " ", n)
    n = re.sub(r"\s+", " ", n).strip()
    for suf in SUFIXOS_LONGOS:
        n = n.replace(suf, " ")
    # sufixos curtos só no fim, repetidamente ("... PAGAMENTOS LTDA ME")
    mudou = True
    while mudou:
        mudou = False
        n = n.strip(" -–,.")
        for suf in SUFIXOS_CURTOS:
            if n.endswith(" " + suf) or n == suf:
                n = n[: len(n) - len(suf)].strip()
                mudou = True
    n = re.sub(r"\s+", " ", n).strip(" -–.")
    return n.title()


def gerar_aliases(razao: str | None, fantasia: str | None) -> list[str]:
    out: list[str] = []
    for nome in (fantasia, razao):
        if not nome:
            continue
        limpo = limpar_nome(nome)
        if len(limpo) >= 4 and limpo not in out:
            out.append(limpo)
    return out


def site_do_email(email: str | None) -> str | None:
    e = (email or "").lower().strip()
    if "@" not in e:
        return None
    dom = e.split("@")[-1]
    if "." not in dom or dom in GENERIC_MAIL or any(t in dom for t in TERCEIROS):
        return None
    return f"https://{dom}"


def conectar() -> sqlite3.Connection:
    con = sqlite3.connect(DB)
    con.row_factory = sqlite3.Row
    con.executescript("""
        CREATE TABLE IF NOT EXISTS monitor_config (
            cnpj TEXT PRIMARY KEY,
            ativo INTEGER DEFAULT 0,
            aliases TEXT,
            site TEXT, url_produtos TEXT, url_blog TEXT, url_carreiras TEXT,
            gupy_slug TEXT, linkedin_url TEXT,
            prioridade INTEGER DEFAULT 2,
            atualizado_em TEXT DEFAULT (datetime('now'))
        );
    """)
    return con


def semear(con: sqlite3.Connection, dry: bool, so_cnpj: str | None) -> None:
    mes = con.execute("SELECT MAX(mes_ref) FROM ratings").fetchone()[0]
    insts = con.execute(
        """SELECT i.cnpj, i.origem, i.razao_social, i.nome_fantasia, i.email,
                  r.nota, e.site e_site, e.linkedin e_linkedin
           FROM instituicoes i
           LEFT JOIN ratings r ON r.cnpj = i.cnpj AND r.mes_ref = ?
           LEFT JOIN enriquecimento e ON e.cnpj = i.cnpj
           WHERE ? IS NULL OR i.cnpj = ?""",
        (mes, so_cnpj, so_cnpj),
    ).fetchall()

    existentes = {r["cnpj"]: dict(r) for r in con.execute("SELECT * FROM monitor_config")}
    novos = atualizados = 0
    for i in insts:
        ativo = 1 if (i["origem"] == "SPSAV" or (i["nota"] or "") in NOTAS_BBB_OU_MELHOR) else 0
        prioridade = 1 if (i["nota"] or "") in NOTAS_A_OU_MELHOR else (2 if ativo else 3)
        aliases_auto = gerar_aliases(i["razao_social"], i["nome_fantasia"])
        site = i["e_site"] or site_do_email(i["email"])
        linkedin = i["e_linkedin"]

        atual = existentes.get(i["cnpj"])
        if atual is None:
            novos += 1
            if not dry:
                con.execute(
                    """INSERT INTO monitor_config (cnpj, ativo, aliases, site, linkedin_url, prioridade)
                       VALUES (?,?,?,?,?,?)""",
                    (i["cnpj"], ativo, json.dumps(aliases_auto, ensure_ascii=False), site, linkedin, prioridade),
                )
        else:
            # não sobrescreve nada preenchido; aliases = união
            uniao = list(dict.fromkeys(json.loads(atual["aliases"] or "[]") + aliases_auto))
            sets, vals = ["aliases=?"], [json.dumps(uniao, ensure_ascii=False)]
            if not atual["site"] and site:
                sets.append("site=?"); vals.append(site)
            if not atual["linkedin_url"] and linkedin:
                sets.append("linkedin_url=?"); vals.append(linkedin)
            atualizados += 1
            if not dry:
                con.execute(f"UPDATE monitor_config SET {', '.join(sets)}, atualizado_em=datetime('now') WHERE cnpj=?",
                            (*vals, i["cnpj"]))
    if not dry:
        con.commit()
    tag = "[dry-run] " if dry else ""
    print(f"{tag}semear: {novos} novas, {atualizados} atualizadas (mês ref. ratings: {mes})")


def exportar(con: sqlite3.Connection) -> None:
    rows = con.execute(
        """SELECT m.cnpj, i.razao_social, i.origem, COALESCE(r.nota,'D') nota,
                  m.ativo, m.prioridade, m.aliases,
                  m.site, m.url_produtos, m.url_blog, m.url_carreiras, m.gupy_slug, m.linkedin_url
           FROM monitor_config m
           JOIN instituicoes i ON i.cnpj = m.cnpj
           LEFT JOIN ratings r ON r.cnpj = m.cnpj AND r.mes_ref = (SELECT MAX(mes_ref) FROM ratings)
           ORDER BY m.ativo DESC, m.prioridade ASC, i.razao_social"""
    ).fetchall()
    CSV_PATH.parent.mkdir(exist_ok=True)
    with CSV_PATH.open("w", newline="", encoding="utf-8") as f:
        w = csv.writer(f)
        w.writerow(["cnpj", "razao_social", "origem", "nota", "ativo", "prioridade", "aliases",
                    "site", "url_produtos", "url_blog", "url_carreiras", "gupy_slug", "linkedin_url"])
        for r in rows:
            aliases = " | ".join(json.loads(r["aliases"] or "[]"))
            w.writerow([r["cnpj"], r["razao_social"], r["origem"], r["nota"], r["ativo"], r["prioridade"],
                        aliases, r["site"], r["url_produtos"], r["url_blog"], r["url_carreiras"],
                        r["gupy_slug"], r["linkedin_url"]])
    print(f"exportado: {CSV_PATH} ({len(rows)} linhas)")


def importar(con: sqlite3.Connection, dry: bool, so_cnpj: str | None) -> None:
    if not CSV_PATH.exists():
        raise SystemExit(f"{CSV_PATH} não existe — rode sem flags primeiro para gerar.")
    n = 0
    with CSV_PATH.open(newline="", encoding="utf-8") as f:
        for row in csv.DictReader(f):
            if so_cnpj and row["cnpj"] != so_cnpj:
                continue
            aliases = [a.strip() for a in (row.get("aliases") or "").split("|") if a.strip()]
            vals = {c: (row.get(c) or "").strip() or None for c in CAMPOS_URL}
            n += 1
            if not dry:
                con.execute(
                    """UPDATE monitor_config SET ativo=?, prioridade=?, aliases=?,
                         site=?, url_produtos=?, url_blog=?, url_carreiras=?, gupy_slug=?, linkedin_url=?,
                         atualizado_em=datetime('now')
                       WHERE cnpj=?""",
                    (int(row.get("ativo") or 0), int(row.get("prioridade") or 2),
                     json.dumps(aliases, ensure_ascii=False),
                     vals["site"], vals["url_produtos"], vals["url_blog"], vals["url_carreiras"],
                     vals["gupy_slug"], vals["linkedin_url"], row["cnpj"]),
                )
    if not dry:
        con.commit()
    print(f"{'[dry-run] ' if dry else ''}importadas {n} linhas do CSV (CSV vence sobre o banco)")


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--exportar", action="store_true", help="só exporta o CSV")
    ap.add_argument("--importar", action="store_true", help="reimporta o CSV editado")
    ap.add_argument("--dry-run", action="store_true")
    ap.add_argument("--cnpj")
    args = ap.parse_args()

    con = conectar()
    if args.importar:
        importar(con, args.dry_run, args.cnpj)
    elif args.exportar:
        exportar(con)
    else:
        semear(con, args.dry_run, args.cnpj)
        if not args.dry_run:
            exportar(con)

    tot = con.execute("SELECT COUNT(*), SUM(ativo) FROM monitor_config").fetchone()
    p = dict(con.execute("SELECT prioridade, COUNT(*) FROM monitor_config WHERE ativo=1 GROUP BY prioridade"))
    print(f"monitor_config: {tot[0] or 0} instituições | {tot[1] or 0} ativas | prioridades ativas: {p}")
    con.close()


if __name__ == "__main__":
    main()
