"""
Enriquecimento das instituições — descrição, tags de atividade e links validados.

1 chamada Gemini (2.5-flash + Google Search grounding) por instituição pedindo
JSON estrito: descrição 2-3 frases, tags (taxonomia fechada), site/x/linkedin/
instagram, produtos e confiança. Merge conservador: links já coletados em
`fatos` (fontes osint_*) têm prioridade; URLs novas do Gemini passam por
validação HEAD antes de gravar. Resultado nas tabelas `enriquecimento` e `tags`.

Origens:
  SPSAV (default)  — prompt geral sobre a empresa.
  INCUMBENTE       — prompt focado EXCLUSIVAMENTE em atuação com ativos
                     virtuais (produtos cripto, tokenização, Drex, custódia,
                     parcerias, pedido PSAV). `atuacao_cripto=false` zera
                     tags/produtos; fonte gravada = gemini_grounding_incumbente.

Cache: pula CNPJ com atualizado_em < 30 dias (use --force para reprocessar).
Tokens de cada chamada são registrados em `gemini_uso`.

Uso: GEMINI_API_KEY=... .venv/bin/python enriquecer_spsav.py
       [--origem SPSAV|INCUMBENTE] [--so-com-sinal] [--limit N] [--force]
"""
from __future__ import annotations

import argparse
import json
import os
import re
import sqlite3
import sys
import time
from pathlib import Path

import requests
from requests.adapters import HTTPAdapter
from urllib3.util.retry import Retry

DB = Path("data/monitor.db")
UA = {"User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124 Safari/537.36"}

SESS = requests.Session()
SESS.mount("https://", HTTPAdapter(max_retries=Retry(total=3, backoff_factor=2, status_forcelist=[429, 500, 502, 503])))

TAXONOMIA = [
    "intermediacao", "custodia_propria", "custodia_terceirizada", "otc",
    "tokenizacao", "pagamentos", "staking", "gestao_ativos",
    "infraestrutura", "banco_digital", "drex_cbdc", "consultoria",
]

PROMPT_SPSAV = (
    'Pesquise na web sobre a empresa brasileira "{nome}" '
    '(razão social: {razao}, CNPJ {cnpj}), uma sociedade prestadora de serviços '
    "de ativos virtuais (SPSAV/VASP) autorizada no Brasil. "
    "Responda APENAS um JSON válido, sem markdown, no formato: "
    '{{"descricao": "2-3 frases em pt-BR sobre o que a empresa faz", '
    '"tags": ["subconjunto de: ' + ", ".join(TAXONOMIA) + '"], '
    '"site": "url oficial ou null", "x": "url do perfil X/Twitter ou null", '
    '"linkedin": "url do LinkedIn ou null", "instagram": "url do Instagram ou null", '
    '"produtos": ["nomes de produtos/serviços"], '
    '"confianca": 0.0 a 1.0 conforme a qualidade das fontes}} '
    "Significado das tags: intermediacao=corretagem/exchange, custodia_propria=custódia "
    "própria de cripto, custodia_terceirizada=custódia via terceiros, otc=mesa OTC, "
    "tokenizacao=emissão/tokenização de ativos, pagamentos=pagamentos/remessas em cripto, "
    "staking=staking/rendimento, gestao_ativos=gestão de fundos/carteiras, "
    "infraestrutura=tecnologia/API/white-label, banco_digital=banco ou conta digital, "
    "drex_cbdc=projetos Drex/CBDC, consultoria=consultoria/educação. "
    "Use apenas tags com evidência real. Se não encontrar nada confiável sobre ESTA "
    "empresa específica, use descricao=null, listas vazias e confianca=0. Não invente."
)

GLOSSARIO_TAGS = (
    "Significado das tags: intermediacao=corretagem/exchange, custodia_propria=custódia "
    "própria de cripto, custodia_terceirizada=custódia via terceiros, otc=mesa OTC, "
    "tokenizacao=emissão/tokenização de ativos, pagamentos=pagamentos/remessas em cripto, "
    "staking=staking/rendimento, gestao_ativos=gestão de fundos/carteiras DE CRIPTO, "
    "infraestrutura=tecnologia/API/white-label, banco_digital=banco ou conta digital COM "
    "produto cripto, drex_cbdc=projetos Drex/CBDC, consultoria=consultoria/educação em cripto. "
)

PROMPT_INCUMBENTE = (
    'Pesquise na web sobre a instituição financeira brasileira "{nome}" '
    "(razão social: {razao}, CNPJ {cnpj}), um(a) {segmento} regulado(a) pelo "
    "Banco Central do Brasil. O foco é EXCLUSIVAMENTE a atuação dela em ATIVOS "
    "VIRTUAIS/criptoativos: produtos cripto lançados ou anunciados, tokenização "
    "de ativos, participação no Drex/piloto de CBDC, custódia de criptoativos, "
    "parcerias com exchanges ou custodiantes, fundos/ETFs cripto, pedido de "
    "autorização como PSAV (Resolução BCB 520). "
    "Responda APENAS um JSON válido, sem markdown, no formato: "
    '{{"atuacao_cripto": true ou false, '
    '"descricao": "2-3 frases em pt-BR sobre a atuação em ativos virtuais; se '
    'atuacao_cripto=false, 1 frase sobre o que a instituição faz seguida da '
    'afirmação de que não foi encontrada atuação em criptoativos", '
    '"tags": ["subconjunto de: ' + ", ".join(TAXONOMIA) + '"], '
    '"site": "url oficial ou null", "x": "url do perfil X/Twitter ou null", '
    '"linkedin": "url do LinkedIn ou null", "instagram": "url do Instagram ou null", '
    '"produtos": ["apenas produtos/serviços DE CRIPTO"], '
    '"confianca": 0.0 a 1.0 conforme a qualidade das fontes}} '
    + GLOSSARIO_TAGS +
    'MUITO IMPORTANTE: "atuacao_cripto": false com tags=[] e produtos=[] é uma '
    "resposta correta e esperada para a maioria dos bancos e corretoras "
    "tradicionais. NÃO atribua tags por atividade financeira tradicional "
    "(gestão de fundos comuns NÃO é gestao_ativos; ser banco NÃO é banco_digital "
    "sem produto cripto; corretagem de ações NÃO é intermediacao). Só use tags "
    "com evidência específica em cripto/ativos virtuais. Não invente."
)


def registrar_uso(con: sqlite3.Connection, usage: dict | None) -> None:
    """Grava tokens da chamada em gemini_uso (telemetria de custo; erros ignorados)."""
    if not usage:
        return
    try:
        entrada = int(usage.get("promptTokenCount") or 0)
        saida = int(usage.get("candidatesTokenCount") or 0) + int(usage.get("thoughtsTokenCount") or 0)
        con.execute(
            "INSERT INTO gemini_uso (modelo, tokens_entrada, tokens_saida) VALUES (?,?,?)",
            ("gemini-2.5-flash", entrada, saida))
        con.commit()
    except Exception:
        pass


def gemini(inst: dict, key: str, prompt: str, con: sqlite3.Connection) -> dict | None:
    nome = inst["nome_fantasia"] or inst["razao_social"]
    body = {
        "contents": [{"parts": [{"text": prompt.format(
            nome=nome, razao=inst["razao_social"], cnpj=inst["cnpj"],
            segmento=inst.get("segmento") or "instituição financeira")}]}],
        "tools": [{"google_search": {}}],
        "generationConfig": {"temperature": 0.1},
    }
    try:
        r = SESS.post(
            f"https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key={key}",
            json=body, timeout=120)
        r.raise_for_status()
        data = r.json()
        registrar_uso(con, data.get("usageMetadata"))
        txt = data["candidates"][0]["content"]["parts"][0]["text"]
        m = re.search(r"\{.*\}", txt, flags=re.S)
        return json.loads(m.group(0)) if m else None
    except Exception as e:
        detail = getattr(getattr(e, "response", None), "text", "")[:200]
        print(f"    gemini erro: {type(e).__name__}: {e} {detail}")
        return None


def url_valida(url: str) -> bool:
    try:
        r = SESS.head(url, headers=UA, timeout=10, allow_redirects=True)
        if r.status_code in (405, 403):  # alguns sites bloqueiam HEAD
            r = SESS.get(url, headers=UA, timeout=10, allow_redirects=True, stream=True)
            r.close()
        return r.status_code < 400
    except requests.RequestException:
        return False


def normaliza_url(u) -> str | None:
    if not isinstance(u, str):
        return None
    u = u.strip()
    if not u or u.lower() in ("null", "none", "n/a"):
        return None
    if not u.startswith("http"):
        u = "https://" + u
    return u


def links_fatos(con: sqlite3.Connection, cnpj: str) -> dict:
    """Links já coletados pelo OSINT (prioridade sobre Gemini)."""
    mapa = {"osint_dominio": "site", "osint_twitter": "x",
            "osint_linkedin": "linkedin", "osint_instagram": "instagram"}
    out: dict = {}
    for fonte, url in con.execute(
            "SELECT fonte, url FROM fatos WHERE cnpj=? AND url IS NOT NULL AND fonte LIKE 'osint_%'", (cnpj,)):
        campo = mapa.get(fonte)
        if campo and campo not in out:
            out[campo] = url
    return out


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--origem", choices=["SPSAV", "INCUMBENTE"], default="SPSAV")
    ap.add_argument("--so-com-sinal", action="store_true",
                    help="apenas instituições com score>0 ou fatos coletados")
    ap.add_argument("--limit", type=int, default=0)
    ap.add_argument("--force", action="store_true")
    args = ap.parse_args()

    key = os.getenv("GEMINI_API_KEY")
    if not key:
        sys.exit("GEMINI_API_KEY não definida")

    con = sqlite3.connect(DB)
    con.row_factory = sqlite3.Row
    sql = "SELECT cnpj, razao_social, nome_fantasia, segmento FROM instituicoes i WHERE origem=?"
    if args.so_com_sinal:
        sql += " AND (score > 0 OR EXISTS (SELECT 1 FROM fatos f WHERE f.cnpj = i.cnpj))"
    sql += " ORDER BY cnpj"
    insts = [dict(r) for r in con.execute(sql, (args.origem,))]

    incumbente = args.origem == "INCUMBENTE"
    prompt = PROMPT_INCUMBENTE if incumbente else PROMPT_SPSAV
    fonte = "gemini_grounding_incumbente" if incumbente else "gemini_grounding"

    recentes = set() if args.force else {
        r[0] for r in con.execute(
            "SELECT cnpj FROM enriquecimento WHERE atualizado_em > datetime('now', '-30 days')")}
    fila = [i for i in insts if i["cnpj"] not in recentes]
    if args.limit:
        fila = fila[:args.limit]
    print(f"{len(insts)} {args.origem} | {len([i for i in insts if i['cnpj'] in recentes])} em cache | processando {len(fila)}")

    ok = 0
    for n, i in enumerate(fila, 1):
        nome = i["nome_fantasia"] or i["razao_social"]
        print(f"[{n}/{len(fila)}] {nome[:60]}")
        g = gemini(i, key, prompt, con)
        time.sleep(1.5)
        if not g:
            continue

        if incumbente and not g.get("atuacao_cripto"):
            # sem atuação cripto confirmada → nunca gravar tags/produtos (anti-alucinação)
            g["tags"] = []
            g["produtos"] = []

        conf = float(g.get("confianca") or 0)
        links = links_fatos(con, i["cnpj"])
        for campo in ("site", "x", "linkedin", "instagram"):
            if campo in links:
                continue
            u = normaliza_url(g.get(campo))
            if u and url_valida(u):
                links[campo] = u

        descricao = g.get("descricao") if isinstance(g.get("descricao"), str) else None
        produtos = [p for p in (g.get("produtos") or []) if isinstance(p, str)][:10]
        tags = [t for t in (g.get("tags") or []) if t in TAXONOMIA]

        con.execute(
            """INSERT INTO enriquecimento (cnpj, descricao, produtos, site, x, linkedin, instagram, fonte, confianca, atualizado_em)
               VALUES (?,?,?,?,?,?,?,?,?,datetime('now'))
               ON CONFLICT(cnpj) DO UPDATE SET descricao=excluded.descricao, produtos=excluded.produtos,
                 site=excluded.site, x=excluded.x, linkedin=excluded.linkedin, instagram=excluded.instagram,
                 fonte=excluded.fonte, confianca=excluded.confianca, atualizado_em=excluded.atualizado_em""",
            (i["cnpj"], descricao, json.dumps(produtos, ensure_ascii=False) if produtos else None,
             links.get("site"), links.get("x"), links.get("linkedin"), links.get("instagram"),
             fonte, conf))
        con.execute("DELETE FROM tags WHERE cnpj=?", (i["cnpj"],))
        for t in tags:
            con.execute("INSERT OR IGNORE INTO tags (cnpj, tag, confianca) VALUES (?,?,?)", (i["cnpj"], t, conf))
        con.commit()
        ok += 1
        extra = f" cripto={'sim' if g.get('atuacao_cripto') else 'não'}" if incumbente else ""
        print(f"    desc={'sim' if descricao else 'não'}{extra} tags={tags} links={sorted(links)}")

    tot = con.execute("SELECT COUNT(*) FROM enriquecimento").fetchone()[0]
    ntags = con.execute("SELECT COUNT(DISTINCT cnpj) FROM tags").fetchone()[0]
    print(f"\nfeito: {ok}/{len(fila)} nesta rodada | {tot} enriquecidas no total | {ntags} com tags")
    con.close()


if __name__ == "__main__":
    main()
