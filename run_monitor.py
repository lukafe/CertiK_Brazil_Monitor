"""
Orquestrador do monitoramento contínuo (Etapa 8).

Roda o ciclo completo em sequência e imprime um resumo ao final:

    coletor_noticias → classificar → coletor_vagas → coletor_site → rating

O "export" para o webapp é o próprio data/monitor.db — o build do Next.js
(webapp/scripts/prep.js) lê o banco; no GitHub Actions o commit do banco
atualizado dispara o deploy na Vercel.

Resumo final: itens novos coletados, fatos criados por tipo, eventos novos
e custo estimado dos tokens Gemini (tabela gemini_uso, alimentada por llm.py).

Uso: .venv/bin/python run_monitor.py [--dry-run] [--cnpj CNPJ] [--limit N] [--pular ETAPA,...]
"""
from __future__ import annotations

import argparse
import sqlite3
import subprocess
import sys
import time
from pathlib import Path

RAIZ = Path(__file__).parent
DB = RAIZ / "data" / "monitor.db"

# (nome, script, aceita --cnpj/--limit, roda em --dry-run)
ETAPAS: list[tuple[str, str, bool, bool]] = [
    ("noticias", "coletor_noticias.py", True, True),
    ("classificar", "classificar.py", True, True),
    ("vagas", "coletor_vagas.py", True, True),
    ("site", "coletor_site.py", True, True),
    ("rating", "rating.py", False, False),  # recomputa tudo; sem efeito em dry-run
]

# USD por 1M tokens (set/2026) — estimativa, não fatura
PRECOS = {"gemini-2.5-flash": (0.30, 2.50), "gemini-2.5-pro": (1.25, 10.00)}


def snapshot(con: sqlite3.Connection) -> dict:
    """Contagens usadas para calcular os deltas do ciclo."""

    def n(q: str) -> int:
        try:
            return con.execute(q).fetchone()[0] or 0
        except sqlite3.OperationalError:  # tabela ainda não existe
            return 0

    fatos = {}
    try:
        fatos = dict(con.execute("SELECT tipo, COUNT(*) FROM fatos GROUP BY tipo").fetchall())
    except sqlite3.OperationalError:
        pass
    uso = {}
    try:
        uso = {m: (e or 0, s or 0) for m, e, s in con.execute(
            "SELECT modelo, SUM(tokens_entrada), SUM(tokens_saida) FROM gemini_uso GROUP BY modelo")}
    except sqlite3.OperationalError:
        pass
    return {
        "itens": n("SELECT COUNT(*) FROM itens_brutos"),
        "fatos": fatos,
        "eventos": n("SELECT COUNT(*) FROM eventos"),
        "uso": uso,
    }


def resumo(antes: dict, depois: dict, duracoes: dict[str, float], falhas: list[str]) -> None:
    print("\n" + "=" * 56)
    print("RESUMO DO CICLO")
    print("=" * 56)
    print(f"itens novos coletados : {depois['itens'] - antes['itens']}")

    tipos = sorted(set(antes["fatos"]) | set(depois["fatos"]))
    novos = {t: depois["fatos"].get(t, 0) - antes["fatos"].get(t, 0) for t in tipos}
    novos = {t: d for t, d in novos.items() if d > 0}
    if novos:
        print("fatos criados por tipo:")
        for t, d in sorted(novos.items(), key=lambda x: -x[1]):
            print(f"    {t:<12} +{d}")
    else:
        print("fatos criados por tipo: nenhum")
    print(f"eventos novos         : {depois['eventos'] - antes['eventos']}")

    custo_total = 0.0
    linhas = []
    for modelo, (e1, s1) in depois["uso"].items():
        e0, s0 = antes["uso"].get(modelo, (0, 0))
        de, ds = e1 - e0, s1 - s0
        if de == 0 and ds == 0:
            continue
        p_in, p_out = PRECOS.get(modelo, (0.0, 0.0))
        custo = de / 1e6 * p_in + ds / 1e6 * p_out
        custo_total += custo
        linhas.append(f"    {modelo:<18} {de:>7} entrada / {ds:>7} saída  ≈ US$ {custo:.4f}")
    if linhas:
        print("tokens Gemini no ciclo:")
        print("\n".join(linhas))
        print(f"custo estimado        : US$ {custo_total:.4f}")
    else:
        print("tokens Gemini no ciclo: 0 (nenhuma chamada)")

    print("duração por etapa     : " + "  ".join(f"{k}={v:.0f}s" for k, v in duracoes.items()))
    if falhas:
        print(f"ETAPAS COM FALHA      : {', '.join(falhas)} (ciclo é retomável — rode de novo)")
    print("=" * 56)


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--dry-run", action="store_true", help="repassa aos coletores; pula o rating")
    ap.add_argument("--cnpj", help="restringe coletores a uma instituição")
    ap.add_argument("--limit", type=int, help="repassa --limit aos coletores")
    ap.add_argument("--pular", default="", help="etapas a pular, separadas por vírgula "
                                                f"({','.join(n for n, *_ in ETAPAS)})")
    args = ap.parse_args()
    pular = {p.strip() for p in args.pular.split(",") if p.strip()}

    con = sqlite3.connect(DB)
    antes = snapshot(con)
    con.close()

    falhas: list[str] = []
    duracoes: dict[str, float] = {}
    for nome, script, aceita_filtros, roda_dry in ETAPAS:
        if nome in pular:
            print(f"\n### {nome}: pulado (--pular)", flush=True)
            continue
        if args.dry_run and not roda_dry:
            print(f"\n### {nome}: pulado (--dry-run)", flush=True)
            continue
        cmd = [sys.executable, str(RAIZ / script)]
        if aceita_filtros:
            if args.dry_run:
                cmd.append("--dry-run")
            if args.cnpj:
                cmd += ["--cnpj", args.cnpj]
            if args.limit:
                cmd += ["--limit", str(args.limit)]
        print(f"\n### {nome}: {' '.join(cmd[1:])}", flush=True)
        t0 = time.time()
        rc = subprocess.run(cmd, cwd=RAIZ).returncode
        duracoes[nome] = time.time() - t0
        if rc != 0:
            print(f"### {nome}: FALHOU (rc={rc}) — seguindo para a próxima etapa")
            falhas.append(nome)

    con = sqlite3.connect(DB)
    depois = snapshot(con)
    con.close()
    resumo(antes, depois, duracoes, falhas)
    return 1 if falhas else 0


if __name__ == "__main__":
    raise SystemExit(main())
