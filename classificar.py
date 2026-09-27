"""
Etapa 3 do monitoramento contínuo — classificador de notícias.

Para cada item de `itens_brutos` não processado e com >= 1 instituição
associada (`itens_instituicao`):
  1. baixa o texto completo do artigo sob demanda (httpx + trafilatura);
     se falhar (paywall, redirect do Google News), usa o resumo do RSS;
  2. classifica com Gemini Flash + response_schema (prompts/classificador.md,
     few-shots brasileiros); confiança < 0.6 → reclassifica com Pro;
  3. grava resultado:
     * ruido / não relacionado → só marca processado=1;
     * fato real → `fatos` (tipo=noticia, confianca = 0.8 × modelo) +
       `fatos` tipo=pessoa para executivos citados + `eventos` (timeline);
       instituições do universo citadas em `entidades_envolvidas` ganham o
       fato espelhado e a associação ao item.

Commit por item → run interrompido retoma de onde parou.

Uso:
  .venv/bin/python classificar.py                # tudo que está pendente
  .venv/bin/python classificar.py --cnpj <cnpj>  # só itens de 1 instituição
  Flags: --dry-run (não grava, não chama Gemini) | --limit N
"""
from __future__ import annotations

import argparse
import json
import re
import sqlite3
import time
import unicodedata
from pathlib import Path

import httpx
import trafilatura
from rapidfuzz import fuzz

from llm import FLASH, PRO, gemini_json

DB = Path("data/monitor.db")
PROMPT_MD = Path("prompts/classificador.md")

UA = "Mozilla/5.0 (compatible; CertiKMonitorBrasil/1.0)"
HTTP = httpx.Client(headers={"User-Agent": UA}, timeout=10, follow_redirects=True)

LIMITE_TEXTO = 8000
CONFIANCA_MIN_FLASH = 0.6   # abaixo disso, reclassifica com Pro
FATOR_CONFIANCA = 0.8       # confianca do fato = 0.8 × confianca do modelo
PAUSA = 0.5

TIPOS_EVENTO = ("produto", "parceria", "contratacao", "regulatorio",
                "captacao_ma", "projeto", "ruido")

SCHEMA_CLASSIFICACAO = {
    "type": "object",
    "properties": {
        "relacionado_ativos_digitais": {"type": "boolean"},
        "tipo_evento": {"type": "string", "enum": list(TIPOS_EVENTO)},
        "resumo": {"type": "string"},
        "entidades_envolvidas": {"type": "array", "items": {"type": "string"}},
        "pessoas": {"type": "array", "items": {
            "type": "object",
            "properties": {"nome": {"type": "string"}, "cargo": {"type": "string"}},
            "required": ["nome"],
        }},
        "data_evento": {"type": "string", "nullable": True},
        "confianca": {"type": "number"},
    },
    "required": ["relacionado_ativos_digitais", "tipo_evento", "resumo",
                 "entidades_envolvidas", "pessoas", "confianca"],
}


def norm(s: str) -> str:
    s = unicodedata.normalize("NFKD", s or "").encode("ascii", "ignore").decode()
    return re.sub(r"\s+", " ", s.upper()).strip()


def texto_completo(url: str, fallback: str) -> str:
    """Baixa e extrai o artigo; qualquer falha devolve o resumo do RSS."""
    try:
        r = HTTP.get(url)
        r.raise_for_status()
        extraido = trafilatura.extract(r.text) or ""
        if len(extraido) > 200:
            return extraido[:LIMITE_TEXTO]
    except Exception:
        pass
    return (fallback or "")[:LIMITE_TEXTO]


def carregar_universo(con: sqlite3.Connection) -> dict[str, str]:
    """norm(alias) → cnpj, para TODO o universo (fatos espelhados)."""
    mapa: dict[str, str] = {}
    for cnpj, aliases in con.execute("SELECT cnpj, aliases FROM monitor_config"):
        for a in json.loads(aliases or "[]"):
            mapa.setdefault(norm(a), cnpj)
    return mapa


def resolver_entidade(nome: str, universo: dict[str, str]) -> str | None:
    cnpj = universo.get(norm(nome))
    if cnpj:
        return cnpj
    melhor = max(((c, fuzz.ratio(norm(nome), n)) for n, c in universo.items()),
                 key=lambda x: x[1], default=(None, 0))
    return melhor[0] if melhor[1] >= 95 else None


def nomes_das_instituicoes(con: sqlite3.Connection, cnpjs: list[str]) -> dict[str, str]:
    qs = ",".join("?" * len(cnpjs))
    return dict(con.execute(
        f"SELECT cnpj, COALESCE(NULLIF(nome_fantasia,''), razao_social) FROM instituicoes WHERE cnpj IN ({qs})",
        cnpjs))


def classificar_item(prompt_base: str, item: sqlite3.Row, nomes: list[str],
                     texto: str) -> tuple[dict | None, str]:
    prompt = (
        f"{prompt_base}\n\n## Matéria a classificar\n\n"
        f"INSTITUIÇÕES MONITORADAS ASSOCIADAS: {', '.join(nomes)}\n"
        f"FONTE: {item['fonte']} | PUBLICADO EM: {item['publicado_em'] or '?'}\n"
        f"TÍTULO: {item['titulo']}\n\nTEXTO:\n{texto}"
    )
    r = gemini_json(prompt, SCHEMA_CLASSIFICACAO, modelo=FLASH)
    modelo = "flash"
    if r and float(r.get("confianca") or 0) < CONFIANCA_MIN_FLASH:
        r_pro = gemini_json(prompt, SCHEMA_CLASSIFICACAO, modelo=PRO)
        if r_pro:
            r, modelo = r_pro, "pro"
    return r, modelo


def gravar(con: sqlite3.Connection, item: sqlite3.Row, cnpjs: list[str],
           r: dict, universo: dict[str, str]) -> int:
    """Grava fatos + eventos para os CNPJs associados e espelhados. Devolve nº de fatos."""
    confianca = round(FATOR_CONFIANCA * float(r["confianca"]), 2)
    data = (r.get("data_evento") or (item["publicado_em"] or "")[:10] or None)
    mes_ref = (data or "")[:7] or None
    descricao = f"[{r['tipo_evento']}] {r['resumo'][:240]}"

    espelhados = []
    for nome in r["entidades_envolvidas"]:
        c = resolver_entidade(nome, universo)
        if c and c not in cnpjs and c not in espelhados:
            espelhados.append(c)

    fatos = 0
    for cnpj in cnpjs + espelhados:
        cur = con.execute(
            "INSERT OR IGNORE INTO fatos (cnpj, tipo, fonte, url, data, confianca, descricao) "
            "VALUES (?,?,?,?,?,?,?)",
            (cnpj, "noticia", "monitor_noticias", item["url"], data, confianca, descricao))
        if cur.rowcount:
            fatos += 1
            con.execute("INSERT INTO eventos (cnpj, mes_ref, tipo, descricao) VALUES (?,?,?,?)",
                        (cnpj, mes_ref, "noticia", descricao))
        for p in r["pessoas"]:
            desc_p = f"{p['nome']} — {p.get('cargo') or 'cargo não informado'}"
            fatos += con.execute(
                "INSERT OR IGNORE INTO fatos (cnpj, tipo, fonte, url, data, confianca, descricao) "
                "VALUES (?,?,?,?,?,?,?)",
                (cnpj, "pessoa", "monitor_noticias", item["url"], data, confianca, desc_p)).rowcount
    for cnpj in espelhados:
        con.execute("INSERT OR IGNORE INTO itens_instituicao VALUES (?,?,?,?)",
                    (item["id"], cnpj, "classificador", None))
    return fatos


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--dry-run", action="store_true")
    ap.add_argument("--cnpj", help="só itens associados a esta instituição")
    ap.add_argument("--limit", type=int, help="máximo de itens a classificar")
    args = ap.parse_args()
    dry = args.dry_run

    prompt_base = PROMPT_MD.read_text(encoding="utf-8")
    con = sqlite3.connect(DB)
    con.row_factory = sqlite3.Row
    universo = carregar_universo(con)

    itens = con.execute(
        """SELECT DISTINCT b.* FROM itens_brutos b
           JOIN itens_instituicao a ON a.item_id = b.id
           WHERE b.processado = 0 AND (? IS NULL OR a.cnpj = ?)
           ORDER BY b.id""", (args.cnpj, args.cnpj)).fetchall()
    if args.limit is not None:
        itens = itens[: args.limit]
    print(f"{'[dry-run] ' if dry else ''}{len(itens)} itens pendentes de classificação")

    stats = {"fatos": 0, "ruido": 0, "falha": 0, "pro": 0}
    for n, item in enumerate(itens, 1):
        cnpjs = [c[0] for c in con.execute(
            "SELECT cnpj FROM itens_instituicao WHERE item_id=?", (item["id"],))]
        nomes = list(nomes_das_instituicoes(con, cnpjs).values())
        if dry:
            print(f"  [dry-run] {n}/{len(itens)} '{item['titulo'][:70]}' → {', '.join(nomes)}")
            continue

        texto = texto_completo(item["url"], item["texto"])
        r, modelo = classificar_item(prompt_base, item, nomes, texto)
        time.sleep(PAUSA)
        if r is None:
            stats["falha"] += 1
            continue  # falha de API — fica para o próximo run
        if modelo == "pro":
            stats["pro"] += 1

        if not r["relacionado_ativos_digitais"] or r["tipo_evento"] == "ruido":
            stats["ruido"] += 1
            con.execute("UPDATE itens_brutos SET processado=1 WHERE id=?", (item["id"],))
        else:
            novos = gravar(con, item, cnpjs, r, universo)
            stats["fatos"] += novos
            con.execute("UPDATE itens_brutos SET processado=1 WHERE id=?", (item["id"],))
            print(f"  {n}/{len(itens)} [{r['tipo_evento']}|{modelo}] {r['resumo'][:90]}", flush=True)
        con.commit()

    if not dry:
        print(f"\nclassificados: {len(itens) - stats['falha']} | fatos novos: {stats['fatos']} | "
              f"ruído: {stats['ruido']} | falhas (retomáveis): {stats['falha']} | via Pro: {stats['pro']}")
    con.close()


if __name__ == "__main__":
    main()
