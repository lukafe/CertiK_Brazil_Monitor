"""
Etapa 9 — Validação do monitoramento contínuo.

Roda o pipeline completo para as 15 instituições de maior prioridade
(monitor_config.prioridade ASC, rating DESC) e gera
`out/validacao_monitor.csv` com uma linha por fato do monitoramento
(instituição, tipo, resumo, fonte, url, confiança) + coluna vazia
`validacao` para marcação manual (acerto/erro).

Uso: .venv/bin/python validar_monitor.py [--dry-run] [--top N] [--sem-pipeline]
  --sem-pipeline  só (re)gera o CSV a partir do banco, sem coletar nada
"""
from __future__ import annotations

import argparse
import csv
import sqlite3
import subprocess
import sys
from pathlib import Path

RAIZ = Path(__file__).parent
DB = RAIZ / "data" / "monitor.db"
SAIDA = RAIZ / "out" / "validacao_monitor.csv"

# fontes geradas pelo monitoramento contínuo (Etapas 2-5)
FONTES_MONITOR = ("monitor_noticias", "monitor_site", "gupy", "site")


def top_prioridade(con: sqlite3.Connection, n: int) -> list[sqlite3.Row]:
    return con.execute(
        """SELECT m.cnpj, COALESCE(NULLIF(i.nome_fantasia, ''), i.razao_social) nome
           FROM monitor_config m
           JOIN instituicoes i ON i.cnpj = m.cnpj
           LEFT JOIN ratings r ON r.cnpj = i.cnpj AND r.mes_ref = i.mes_ref
           WHERE m.ativo = 1
           ORDER BY m.prioridade ASC, r.rating DESC
           LIMIT ?""", (n,)).fetchall()


def exportar_csv(con: sqlite3.Connection, cnpjs: list[str]) -> int:
    marcas = ",".join("?" * len(cnpjs))
    rows = con.execute(
        f"""SELECT f.cnpj, COALESCE(NULLIF(i.nome_fantasia, ''), i.razao_social) instituicao,
                   f.tipo, COALESCE(f.data, substr(f.criado_em, 1, 10)) data,
                   f.descricao resumo, f.fonte, f.url, f.confianca, f.criado_em
            FROM fatos f
            JOIN instituicoes i ON i.cnpj = f.cnpj
            WHERE f.cnpj IN ({marcas}) AND f.fonte IN ({",".join("?" * len(FONTES_MONITOR))})
            ORDER BY instituicao, f.criado_em DESC""",
        (*cnpjs, *FONTES_MONITOR)).fetchall()

    SAIDA.parent.mkdir(exist_ok=True)
    with open(SAIDA, "w", newline="", encoding="utf-8-sig") as fh:
        w = csv.writer(fh)
        w.writerow(["cnpj", "instituicao", "tipo", "data", "resumo", "fonte", "url",
                    "confianca", "criado_em", "validacao"])
        for r in rows:
            w.writerow([*r, ""])  # coluna `validacao` vazia p/ marcação manual
    return len(rows)


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--dry-run", action="store_true", help="repassa ao pipeline; CSV não é gravado")
    ap.add_argument("--top", type=int, default=15, help="quantas instituições (padrão 15)")
    ap.add_argument("--sem-pipeline", action="store_true", help="só exporta o CSV do banco atual")
    args = ap.parse_args()

    con = sqlite3.connect(DB)
    con.row_factory = sqlite3.Row
    alvo = top_prioridade(con, args.top)
    print(f"{len(alvo)} instituições de maior prioridade:")
    for r in alvo:
        print(f"  {r['cnpj']}  {r['nome']}")

    if not args.sem_pipeline:
        for r in alvo:
            cmd = [sys.executable, str(RAIZ / "run_monitor.py"), "--cnpj", r["cnpj"], "--pular", "rating"]
            if args.dry_run:
                cmd.append("--dry-run")
            print(f"\n===== pipeline: {r['nome']} =====", flush=True)
            subprocess.run(cmd, cwd=RAIZ)  # falhas são retomáveis; segue adiante
        if not args.dry_run:
            print("\n===== rating (recompute único) =====", flush=True)
            subprocess.run([sys.executable, str(RAIZ / "rating.py")], cwd=RAIZ)

    if args.dry_run:
        print("\n[dry-run] CSV não gravado")
        return 0
    n = exportar_csv(con, [r["cnpj"] for r in alvo])
    con.close()
    print(f"\n{n} fatos exportados → {SAIDA.relative_to(RAIZ)}")
    print("Marque a coluna `validacao` com acerto/erro e devolva para iterarmos no prompt.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
