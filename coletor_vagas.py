"""
Etapa 4 do monitoramento contínuo — coletor de vagas.

Para cada instituição ativa em `monitor_config`:
  * com `gupy_slug`: baixa https://<slug>.gupy.io/ e lê as vagas do JSON
    embutido (__NEXT_DATA__ → props.pageProps.jobs) — a API pública antiga
    (portal.api.gupy.io) foi desligada;
  * senão, com `url_carreiras`: baixa a página, extrai o texto com
    trafilatura e usa heurística (linhas curtas que parecem título de vaga).

Filtra vagas cujo título contém termos de ativos digitais
(`data/termos_digital_assets.yaml`; sem acento/caixa, termos < 6 chars
exigem palavra exata) e grava:
  * `fatos`  tipo='vaga', fonte='gupy'|'site', descricao = título da vaga
             (UNIQUE cnpj+tipo+fonte+descricao → idempotente);
  * `eventos` tipo='contratacao' SÓ na primeira vez que a vaga aparece.

Uso:
  .venv/bin/python coletor_vagas.py                 # todas as configuradas
  .venv/bin/python coletor_vagas.py --cnpj <cnpj>   # uma instituição
  Flags: --dry-run (não grava) | --limit N | --todas (mostra vagas sem termo)
"""
from __future__ import annotations

import argparse
import json
import re
import sqlite3
import time
import unicodedata
from datetime import date
from pathlib import Path

import httpx
import trafilatura

DB = Path("data/monitor.db")
TERMOS_YAML = Path("data/termos_digital_assets.yaml")

UA = "Mozilla/5.0 (compatible; CertiKMonitorBrasil/1.0)"
HTTP = httpx.Client(headers={"User-Agent": UA}, timeout=15, follow_redirects=True)
PAUSA = 1.0
CONFIANCA = {"gupy": 0.9, "site": 0.7}  # API estruturada > heurística de página


def sem_acento(s: str) -> str:
    return unicodedata.normalize("NFKD", s or "").encode("ascii", "ignore").decode()


def norm(s: str) -> str:
    return re.sub(r"\s+", " ", sem_acento(s).lower()).strip()


def carregar_termos() -> list[str]:
    """Lê data/termos_digital_assets.yaml (lista "- termo") sem PyYAML."""
    termos: list[str] = []
    for linha in TERMOS_YAML.read_text(encoding="utf-8").splitlines():
        linha = linha.strip()
        if linha.startswith("- "):
            t = norm(linha[2:])
            if t and t not in termos:
                termos.append(t)
    return termos


def termo_presente(titulo: str, termos: list[str]) -> str | None:
    alvo = norm(titulo)
    for t in termos:
        if len(t) < 6:  # 'drex', 'web3', 'token', 'vasp'… → palavra exata
            if re.search(rf"\b{re.escape(t)}\b", alvo):
                return t
        elif t in alvo:
            return t
    return None


def vagas_gupy(slug: str) -> list[dict]:
    """Vagas do JSON embutido na página de carreiras Gupy."""
    r = HTTP.get(f"https://{slug}.gupy.io/")
    r.raise_for_status()
    m = re.search(r'__NEXT_DATA__"\s+type="application/json">(.*?)</script>', r.text, re.S)
    if not m:
        return []
    jobs = json.loads(m.group(1)).get("props", {}).get("pageProps", {}).get("jobs", []) or []
    return [{"titulo": j.get("title", "").strip(),
             "url": f"https://{slug}.gupy.io/jobs/{j['id']}"}
            for j in jobs if j.get("title") and j.get("id")]


# palavras que denunciam um título de vaga (evita pegar slogans da página)
CARGOS = re.compile(
    r"\b(analista|desenvolvedor|engenheir|arquitet|gerente|coordenador|especialista|"
    r"consultor|assistente|estagiari|estagio|trainee|designer|advogad|contador|"
    r"analyst|developer|engineer|manager|specialist|lead|head|tech|dev|devops|"
    r"product|scrum|agile|qa|sre|cientista|scientist|jr|junior|pleno|sr|senior)\b")


def vagas_pagina(url: str) -> list[dict]:
    """Heurística p/ páginas de carreira genéricas: linhas curtas do texto
    extraído que parecem título de vaga (contêm palavra de cargo)."""
    r = HTTP.get(url)
    r.raise_for_status()
    texto = trafilatura.extract(r.text) or ""
    vagas, vistos = [], set()
    for linha in texto.splitlines():
        linha = linha.strip(" -•·|")
        if not (8 <= len(linha) <= 90) or linha.endswith((".", "!", "?", ":")):
            continue
        if not CARGOS.search(norm(linha)):
            continue
        if linha.lower() in vistos:
            continue
        vistos.add(linha.lower())
        vagas.append({"titulo": linha, "url": url})
    return vagas


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--dry-run", action="store_true")
    ap.add_argument("--cnpj")
    ap.add_argument("--limit", type=int, help="máximo de instituições")
    ap.add_argument("--todas", action="store_true", help="lista também vagas sem termo (debug)")
    args = ap.parse_args()
    dry = args.dry_run

    termos = carregar_termos()
    con = sqlite3.connect(DB)
    rows = con.execute(
        """SELECT cnpj, gupy_slug, url_carreiras FROM monitor_config
           WHERE ativo=1 AND (gupy_slug IS NOT NULL OR url_carreiras IS NOT NULL)
             AND (? IS NULL OR cnpj=?)
           ORDER BY prioridade, cnpj""", (args.cnpj, args.cnpj)).fetchall()
    if args.limit is not None:
        rows = rows[: args.limit]
    print(f"{'[dry-run] ' if dry else ''}{len(rows)} instituições com gupy_slug/url_carreiras | "
          f"{len(termos)} termos")

    hoje = date.today().isoformat()
    novos_fatos = total_vagas = 0
    for cnpj, slug, url_carr in rows:
        try:
            if slug:
                fonte, vagas = "gupy", vagas_gupy(slug)
            else:
                fonte, vagas = "site", vagas_pagina(url_carr)
        except Exception as e:
            print(f"  {cnpj}: fonte fora do ar ({type(e).__name__}: {e})", flush=True)
            continue
        time.sleep(PAUSA)
        total_vagas += len(vagas)
        relevantes = [(v, termo_presente(v["titulo"], termos)) for v in vagas]
        relevantes = [(v, t) for v, t in relevantes if t]
        print(f"  {cnpj} [{fonte}]: {len(vagas)} vagas, {len(relevantes)} com termo", flush=True)
        if args.todas:
            for v in vagas:
                print(f"      . {v['titulo'][:80]}")
        for v, t in relevantes:
            print(f"      + '{v['titulo'][:70]}' (termo: {t})", flush=True)
            if dry:
                continue
            cur = con.execute(
                "INSERT OR IGNORE INTO fatos (cnpj, tipo, fonte, url, data, confianca, descricao) "
                "VALUES (?,?,?,?,?,?,?)",
                (cnpj, "vaga", fonte, v["url"], hoje, CONFIANCA[fonte], v["titulo"][:240]))
            if cur.rowcount:  # primeira vez que a vaga aparece
                novos_fatos += 1
                con.execute("INSERT INTO eventos (cnpj, mes_ref, tipo, descricao) VALUES (?,?,?,?)",
                            (cnpj, hoje[:7], "contratacao", f"Vaga aberta: {v['titulo'][:200]}"))
        if not dry:
            con.commit()

    print(f"\n{'[dry-run] ' if dry else ''}vagas vistas: {total_vagas} | fatos novos: {novos_fatos}")
    con.close()


if __name__ == "__main__":
    main()
