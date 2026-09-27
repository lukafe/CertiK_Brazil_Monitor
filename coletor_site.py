"""
Etapa 5 do monitoramento contínuo — coletor de mudanças no site.

Para cada instituição ativa em `monitor_config`, monitora `url_produtos` e
`url_blog`; se nenhuma estiver preenchida, monitora a home (`site`) — desvio
consciente da spec: hoje quase ninguém tem URLs específicas cadastradas.

Fluxo por URL:
  1. baixa a página, extrai o texto com trafilatura e calcula o hash;
  2. 1ª coleta → só grava o snapshot em `site_snapshots` (linha de base);
  3. hash mudou → diff textual e manda SÓ as linhas novas ao Gemini com o
     mesmo schema da classificação de notícias (classificar.py). Se for
     produto/projeto/parceria relacionado a ativos digitais →
     `fatos` tipo='site' (confianca = 0.8 × modelo) + `eventos` (timeline);
  4. hash igual → nada a fazer (não grava snapshot repetido).

Commit por instituição → run interrompido retoma de onde parou.

Uso:
  .venv/bin/python coletor_site.py                 # todas as ativas
  .venv/bin/python coletor_site.py --cnpj <cnpj>   # uma instituição
  Flags: --dry-run (não grava, não chama Gemini) | --limit N
"""
from __future__ import annotations

import argparse
import hashlib
import json
import re
import sqlite3
import time
from datetime import date
from pathlib import Path

import httpx
import trafilatura

from classificar import PROMPT_MD, SCHEMA_CLASSIFICACAO
from llm import FLASH, gemini_json

DB = Path("data/monitor.db")

UA = "Mozilla/5.0 (compatible; CertiKMonitorBrasil/1.0)"
HTTP = httpx.Client(headers={"User-Agent": UA}, timeout=15, follow_redirects=True)
PAUSA = 1.0
LIMITE_DIFF = 4000                  # chars de trecho novo enviados ao Gemini
TIPOS_RELEVANTES = ("produto", "projeto", "parceria")
FATOR_CONFIANCA = 0.8


def extrair(url: str) -> tuple[str, str] | None:
    """(hash, texto) da página, ou None se fora do ar / sem conteúdo."""
    try:
        r = HTTP.get(url)
        r.raise_for_status()
        texto = trafilatura.extract(r.text) or ""
    except Exception as e:
        print(f"    fora do ar: {url} ({type(e).__name__})", flush=True)
        return None
    texto = re.sub(r"[ \t]+", " ", texto).strip()
    if len(texto) < 80:  # página vazia/JS-only não serve de linha de base
        print(f"    sem conteúdo estático: {url}", flush=True)
        return None
    return hashlib.sha1(texto.encode()).hexdigest(), texto


def linhas_novas(antigo: str, novo: str) -> str:
    """Diff textual simples: linhas do texto novo que não existiam no antigo."""
    velhas = {l.strip() for l in antigo.splitlines() if l.strip()}
    novas = [l.strip() for l in novo.splitlines() if l.strip() and l.strip() not in velhas]
    return "\n".join(novas)[:LIMITE_DIFF]


def classificar_diff(nome: str, url: str, trecho: str) -> dict | None:
    prompt = (
        f"{PROMPT_MD.read_text(encoding='utf-8')}\n\n## Trecho a classificar\n\n"
        "O texto abaixo NÃO é uma matéria de imprensa: são os trechos NOVOS que "
        f"apareceram no site oficial da instituição monitorada \"{nome}\" ({url}) "
        "desde a última coleta. Avalie se indicam novidade relevante (produto, "
        "projeto, parceria). Menu, rodapé, aviso de cookies e texto institucional "
        "genérico são ruido.\n\n"
        f"INSTITUIÇÕES MONITORADAS ASSOCIADAS: {nome}\n"
        f"TRECHOS NOVOS:\n{trecho}"
    )
    return gemini_json(prompt, SCHEMA_CLASSIFICACAO, modelo=FLASH)


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--dry-run", action="store_true")
    ap.add_argument("--cnpj")
    ap.add_argument("--limit", type=int, help="máximo de instituições")
    args = ap.parse_args()
    dry = args.dry_run

    con = sqlite3.connect(DB)
    con.execute("""CREATE TABLE IF NOT EXISTS site_snapshots (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        cnpj TEXT, url TEXT, hash TEXT, texto TEXT,
        coletado_em TEXT DEFAULT (datetime('now')))""")
    con.execute("CREATE INDEX IF NOT EXISTS idx_snap_site ON site_snapshots(cnpj, url)")

    rows = con.execute(
        """SELECT m.cnpj, m.site, m.url_produtos, m.url_blog,
                  COALESCE(NULLIF(i.nome_fantasia,''), i.razao_social) nome
           FROM monitor_config m JOIN instituicoes i ON i.cnpj = m.cnpj
           WHERE m.ativo=1 AND (? IS NULL OR m.cnpj=?)
           ORDER BY m.prioridade, m.cnpj""", (args.cnpj, args.cnpj)).fetchall()
    if args.limit is not None:
        rows = rows[: args.limit]

    hoje = date.today().isoformat()
    stats = {"urls": 0, "baseline": 0, "sem_mudanca": 0, "mudou": 0, "fatos": 0}
    for cnpj, site, url_prod, url_blog, nome in rows:
        urls = [u for u in (url_prod, url_blog) if u] or ([site] if site else [])
        for url in urls:
            stats["urls"] += 1
            res = extrair(url)
            time.sleep(PAUSA)
            if res is None:
                continue
            h, texto = res
            ultimo = con.execute(
                "SELECT hash, texto FROM site_snapshots WHERE cnpj=? AND url=? "
                "ORDER BY id DESC LIMIT 1", (cnpj, url)).fetchone()

            if ultimo is None:                      # linha de base
                stats["baseline"] += 1
                if not dry:
                    con.execute("INSERT INTO site_snapshots (cnpj, url, hash, texto) VALUES (?,?,?,?)",
                                (cnpj, url, h, texto))
            elif ultimo[0] == h:
                stats["sem_mudanca"] += 1
            else:                                   # mudou → diff → Gemini
                stats["mudou"] += 1
                trecho = linhas_novas(ultimo[1], texto)
                print(f"  {nome}: mudança em {url} ({len(trecho)} chars novos)", flush=True)
                if not dry:
                    con.execute("INSERT INTO site_snapshots (cnpj, url, hash, texto) VALUES (?,?,?,?)",
                                (cnpj, url, h, texto))
                if trecho and not dry:
                    r = classificar_diff(nome, url, trecho)
                    if r and r.get("relacionado_ativos_digitais") and r["tipo_evento"] in TIPOS_RELEVANTES:
                        confianca = round(FATOR_CONFIANCA * float(r["confianca"]), 2)
                        descricao = f"[{r['tipo_evento']}] {r['resumo'][:240]}"
                        cur = con.execute(
                            "INSERT OR IGNORE INTO fatos (cnpj, tipo, fonte, url, data, confianca, descricao) "
                            "VALUES (?,?,?,?,?,?,?)",
                            (cnpj, "site", "monitor_site", url, hoje, confianca, descricao))
                        if cur.rowcount:
                            stats["fatos"] += 1
                            con.execute("INSERT INTO eventos (cnpj, mes_ref, tipo, descricao) VALUES (?,?,?,?)",
                                        (cnpj, hoje[:7], "site", descricao))
                            print(f"    fato: {descricao[:100]}", flush=True)
        if not dry:
            con.commit()

    print(f"\n{'[dry-run] ' if dry else ''}urls: {stats['urls']} | linha de base: {stats['baseline']} | "
          f"sem mudança: {stats['sem_mudanca']} | mudou: {stats['mudou']} | fatos novos: {stats['fatos']}")
    con.close()


if __name__ == "__main__":
    main()
