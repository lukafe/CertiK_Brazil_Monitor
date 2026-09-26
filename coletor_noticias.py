"""
Etapa 2 do monitoramento contínuo — coletor de notícias.

Fontes:
  1. Google News RSS por alias de cada instituição ativa em `monitor_config`
     (busca exata: https://news.google.com/rss/search?q="<alias>"...)
  2. Feeds setoriais fixos em `data/feeds.yaml` (formato simples nome: url)

Grava em:
  * itens_brutos       — 1 linha por URL (url_hash UNIQUE = idempotente);
                         `texto` = resumo do RSS (o texto completo do artigo é
                         baixado sob demanda em classificar.py, só p/ associados).
  * itens_instituicao  — associação item → CNPJ. Métodos:
                         'fuzzy'  rapidfuzz partial_ratio >= 90 em título+lead
                                  (aliases < 4 chars exigem match exato de palavra)
                         'gemini' fallback p/ itens órfãos de feeds setoriais
                                  (Flash + response_schema, lista de nomes ativos)

Uso:
  .venv/bin/python coletor_noticias.py                 # tudo (aliases + setoriais)
  .venv/bin/python coletor_noticias.py --cnpj <cnpj>   # só os aliases de 1 instituição
  .venv/bin/python coletor_noticias.py --limit 10      # só as 10 primeiras (por prioridade)
  Flags: --dry-run (não grava, não chama Gemini) | --sem-gemini
"""
from __future__ import annotations

import argparse
import hashlib
import json
import re
import socket
import sqlite3
import time
import unicodedata
from datetime import datetime, timedelta, timezone
from pathlib import Path
from urllib.parse import quote

import feedparser
import httpx
from rapidfuzz import fuzz

from llm import FLASH, gemini_json

DB = Path("data/monitor.db")
FEEDS_YAML = Path("data/feeds.yaml")

UA = "Mozilla/5.0 (compatible; CertiKMonitorBrasil/1.0)"
GNEWS = 'https://news.google.com/rss/search?q="{alias}"&hl=pt-BR&gl=BR&ceid=BR:pt-419'
LIMITE_TEXTO = 8000
LEAD_CHARS = 400
LIMIAR_FUZZY = 90
DIAS_MAX = 30           # janela padrão; ajuste com --dias (backfill do 1º run)
PAUSA = 1.0             # segundos entre requests HTTP

socket.setdefaulttimeout(30)  # trafilatura/urllib nunca podem travar o run

# client único: reusa conexões (keep-alive) e o contexto SSL — criar um client
# por request custava segundos por artigo em feeds grandes
HTTP = httpx.Client(headers={"User-Agent": UA}, timeout=10, follow_redirects=True)

SCHEMA = """
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
"""

SCHEMA_GEMINI = {
    "type": "object",
    "properties": {"nomes": {"type": "array", "items": {"type": "string"}}},
    "required": ["nomes"],
}


def sem_acento(s: str) -> str:
    return unicodedata.normalize("NFKD", s or "").encode("ascii", "ignore").decode()


def norm(s: str) -> str:
    return re.sub(r"\s+", " ", sem_acento(s).upper()).strip()


def carregar_feeds() -> dict[str, str]:
    """Lê data/feeds.yaml (mapa simples `nome: url`) sem depender de PyYAML."""
    feeds: dict[str, str] = {}
    if not FEEDS_YAML.exists():
        return feeds
    for linha in FEEDS_YAML.read_text(encoding="utf-8").splitlines():
        linha = linha.strip()
        if not linha or linha.startswith("#") or ":" not in linha:
            continue
        nome, url = linha.split(":", 1)
        feeds[nome.strip()] = url.strip()
    return feeds


def url_hash(url: str) -> str:
    return hashlib.sha1(url.encode()).hexdigest()


def publicado_iso(entry) -> str | None:
    t = entry.get("published_parsed") or entry.get("updated_parsed")
    if not t:
        return None
    return datetime(*t[:6], tzinfo=timezone.utc).strftime("%Y-%m-%d %H:%M")


def muito_antigo(pub: str | None, dias: int) -> bool:
    if not pub:
        return False
    corte = datetime.now(timezone.utc) - timedelta(days=dias)
    return datetime.strptime(pub, "%Y-%m-%d %H:%M").replace(tzinfo=timezone.utc) < corte


def limpar_resumo(fallback: str) -> str:
    """Título + resumo do RSS bastam aqui (matching e fallback Gemini usam só
    isso). O texto completo do artigo é baixado sob demanda na classificação
    (classificar.py), apenas para itens associados — baixar tudo na coleta
    custava dezenas de minutos por run e martelava os sites à toa."""
    return re.sub(r"<[^>]+>", " ", fallback or "")[:LIMITE_TEXTO].strip()


def ler_feed(url: str):
    # download via httpx com timeout — feedparser.parse(url) usa urllib sem
    # timeout e pode travar o run inteiro numa fonte lenta
    try:
        r = HTTP.get(url, timeout=20)
        r.raise_for_status()
        return feedparser.parse(r.text).entries or []
    except Exception as e:
        print(f"    feed fora do ar: {url} ({type(e).__name__}: {e})", flush=True)
        return []


def coletar(con: sqlite3.Connection, fonte: str, feed_url: str,
            hashes: set[str], dry: bool, dias: int) -> list[dict]:
    """Baixa um feed e devolve os itens novos (inserindo se não for dry-run)."""
    t0 = time.time()
    entries = ler_feed(feed_url)
    time.sleep(PAUSA)
    novos: list[dict] = []
    ultimo_log = 0
    for e in entries:
        if len(novos) - ultimo_log >= 20:
            ultimo_log = len(novos)
            print(f"    ... {fonte}: {len(novos)} novos ({round(time.time()-t0)}s)", flush=True)
        url = e.get("link") or ""
        if not url:
            continue
        h = url_hash(url)
        if h in hashes:
            continue
        pub = publicado_iso(e)
        if muito_antigo(pub, dias):
            continue
        hashes.add(h)
        titulo = (e.get("title") or "").strip()
        texto = limpar_resumo(e.get("summary", ""))
        item = {"url": url, "hash": h, "titulo": titulo, "fonte": fonte,
                "pub": pub, "texto": texto, "id": None}
        if not dry:
            cur = con.execute(
                "INSERT OR IGNORE INTO itens_brutos (url, url_hash, titulo, fonte, publicado_em, texto) "
                "VALUES (?,?,?,?,?,?)", (url, h, titulo, fonte, pub, texto))
            item["id"] = cur.lastrowid
        novos.append(item)
    print(f"  {fonte}: {len(entries)} no feed, {len(novos)} novos ({round(time.time()-t0)}s)", flush=True)
    return novos


def casar_aliases(item: dict, ativos: dict[str, list[str]]) -> list[tuple[str, float]]:
    """CNPJs cujo alias aparece no título+lead (fuzzy >= 90 ou palavra exata)."""
    alvo = norm(item["titulo"] + " " + (item["texto"] or "")[:LEAD_CHARS])
    hits: list[tuple[str, float]] = []
    for cnpj, aliases in ativos.items():
        melhor = 0.0
        for alias in aliases:
            a = norm(alias)
            if not a:
                continue
            if len(a) < 4:
                if re.search(rf"\b{re.escape(a)}\b", alvo):
                    melhor = max(melhor, 100.0)
            else:
                melhor = max(melhor, fuzz.partial_ratio(a, alvo))
        if melhor >= LIMIAR_FUZZY:
            hits.append((cnpj, round(melhor, 1)))
    return hits


def orfaos_setoriais_do_banco(con: sqlite3.Connection) -> list[dict]:
    """Itens setoriais sem associação e ainda não avaliados — inclui sobras de
    runs anteriores interrompidos (o fallback é retomável)."""
    return [{"id": r[0], "titulo": r[1], "texto": r[2]} for r in con.execute(
        """SELECT id, titulo, texto FROM itens_brutos
           WHERE fonte NOT LIKE 'gnews:%' AND processado = 0
             AND id NOT IN (SELECT item_id FROM itens_instituicao)""")]


def fallback_gemini(orfaos: list[dict], ativos: dict[str, list[str]],
                    con: sqlite3.Connection, dry: bool) -> int:
    """Itens de feed setorial sem alias casado: pergunta ao Flash se a matéria
    cita alguma instituição ativa (título + lead, custo baixo). Órfão avaliado
    sem instituição vira processado=1 (nunca será classificado, nada a fazer);
    com instituição, ganha a associação e segue processado=0 p/ classificar.py."""
    nome_para_cnpj = {norm(a): c for c, als in ativos.items() for a in als}
    nomes = sorted({a for als in ativos.values() for a in als})
    achados = 0
    for item in orfaos:
        prompt = (
            "Você monitora instituições brasileiras do mercado de ativos virtuais.\n"
            "Abaixo, o título e o início de uma matéria. Responda APENAS com os nomes "
            "da lista que a matéria cita diretamente (empresa protagonista ou envolvida). "
            "Se nenhuma for citada, devolva lista vazia. Não invente nomes fora da lista.\n\n"
            f"LISTA DE INSTITUIÇÕES:\n{'; '.join(nomes)}\n\n"
            f"TÍTULO: {item['titulo']}\n"
            f"LEAD: {(item['texto'] or '')[:LEAD_CHARS]}"
        )
        r = gemini_json(prompt, SCHEMA_GEMINI, modelo=FLASH)
        time.sleep(0.5)
        if r is None:
            continue  # falha de API — fica para o próximo run
        if not r.get("nomes"):
            if not dry and item["id"]:
                con.execute("UPDATE itens_brutos SET processado=1 WHERE id=?", (item["id"],))
                con.commit()
            continue
        for nome in r["nomes"]:
            cnpj = nome_para_cnpj.get(norm(nome))
            if not cnpj:  # nome fora da lista ou grafia diferente → fuzzy exato
                melhor = max(((c, fuzz.ratio(norm(nome), n)) for n, c in nome_para_cnpj.items()),
                             key=lambda x: x[1], default=(None, 0))
                cnpj = melhor[0] if melhor[1] >= 95 else None
            if cnpj:
                achados += 1
                print(f"    gemini: '{item['titulo'][:60]}' → {nome}", flush=True)
                if not dry and item["id"]:
                    con.execute("INSERT OR IGNORE INTO itens_instituicao VALUES (?,?,?,?)",
                                (item["id"], cnpj, "gemini", None))
                    con.commit()
    return achados


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--dry-run", action="store_true")
    ap.add_argument("--cnpj", help="coleta só os aliases desta instituição (sem feeds setoriais)")
    ap.add_argument("--limit", type=int, help="limita a N instituições (por prioridade)")
    ap.add_argument("--sem-gemini", action="store_true", help="desliga o fallback Gemini")
    ap.add_argument("--dias", type=int, default=DIAS_MAX, help=f"janela em dias (padrão {DIAS_MAX})")
    args = ap.parse_args()
    dry = args.dry_run

    con = sqlite3.connect(DB)
    con.executescript(SCHEMA)

    rows = con.execute(
        """SELECT cnpj, aliases FROM monitor_config
           WHERE ativo=1 AND (? IS NULL OR cnpj=?)
           ORDER BY prioridade, cnpj""", (args.cnpj, args.cnpj)).fetchall()
    if args.limit is not None:
        rows = rows[: args.limit]
    ativos = {c: json.loads(a or "[]") for c, a in rows}
    if not ativos:
        raise SystemExit("nenhuma instituição ativa encontrada (rode config_monitor.py antes)")

    hashes = {r[0] for r in con.execute("SELECT url_hash FROM itens_brutos")}
    print(f"{'[dry-run] ' if dry else ''}{len(ativos)} instituições ativas | {len(hashes)} itens já no banco")

    # coleta + matching + commit por feed (run interrompido não perde nada)
    total_novos = 0
    assoc_fuzzy = 0
    orfaos_setoriais: list[dict] = []

    def processar(fonte: str, feed_url: str, setorial: bool) -> None:
        nonlocal total_novos, assoc_fuzzy
        itens = coletar(con, fonte, feed_url, hashes, dry, args.dias)
        total_novos += len(itens)
        for item in itens:
            hits = casar_aliases(item, ativos)
            for cnpj_hit, score in hits:
                assoc_fuzzy += 1
                if not dry and item["id"]:
                    con.execute("INSERT OR IGNORE INTO itens_instituicao VALUES (?,?,?,?)",
                                (item["id"], cnpj_hit, "fuzzy", score))
            if not hits and setorial:
                orfaos_setoriais.append(item)
        if not dry:
            con.commit()

    # 1) Google News por alias
    print("Google News por alias:")
    for cnpj, aliases in ativos.items():
        for alias in aliases:
            processar(f"gnews:{alias}", GNEWS.format(alias=quote(alias)), setorial=False)

    # 2) feeds setoriais (pulados no modo --cnpj)
    if not args.cnpj:
        print("Feeds setoriais:")
        for nome, url in carregar_feeds().items():
            processar(nome, url, setorial=True)

    # 4) fallback Gemini só para órfãos setoriais — lidos do banco, para
    #    retomar também as sobras de runs anteriores interrompidos
    assoc_gemini = 0
    if not args.sem_gemini and not args.cnpj:
        if dry:
            print(f"[dry-run] {len(orfaos_setoriais)} órfãos setoriais iriam ao Gemini (pulado)")
        else:
            orfaos = orfaos_setoriais_do_banco(con)
            if orfaos:
                print(f"Fallback Gemini: {len(orfaos)} órfãos setoriais")
                assoc_gemini = fallback_gemini(orfaos, ativos, con, dry)

    if not dry:
        con.commit()
    tot_i, tot_a = con.execute(
        "SELECT (SELECT COUNT(*) FROM itens_brutos), (SELECT COUNT(*) FROM itens_instituicao)").fetchone()
    print(f"\n{'[dry-run] ' if dry else ''}novos: {total_novos} itens | "
          f"associações: {assoc_fuzzy} fuzzy + {assoc_gemini} gemini | "
          f"banco: {tot_i} itens, {tot_a} associações")
    con.close()


if __name__ == "__main__":
    main()
