"""
Reclassificação rigorosa do modelo de custódia (Res. BCB 520, art. 73).

Para cada empresa com tag custodia_propria/custodia_terceirizada, faz 1 chamada
Gemini 2.5-flash com Google Search grounding perguntando especificamente:
quem detém/gerencia as chaves? há custodiante terceiro NOMEADO? A resposta
"indeterminado" é permitida e esperada quando a informação não é pública.

Resultado na tabela `custodia_verificacao` (separada de `tags`, que continua
sendo a classificação declarada/original do enriquecimento).

Uso: GEMINI_API_KEY=... .venv/bin/python reclassificar_custodia.py [--limit N] [--force]
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

MODELOS = ("propria", "terceirizada", "hibrida", "indeterminado", "sem_custodia")

PROMPT = (
    'Pesquise na web sobre a empresa brasileira "{nome}" '
    "(razão social: {razao}, CNPJ {cnpj}), uma prestadora de serviços de ativos "
    "virtuais (PSAV/VASP). Preciso saber o MODELO DE CUSTÓDIA de criptoativos dela, "
    "com rigor — isto será usado para fins regulatórios (Res. BCB 520, art. 73). "
    "Perguntas: (1) A empresa oferece custódia de ativos virtuais a clientes? "
    "(2) Quem detém/gerencia as chaves privadas: a própria empresa (mesmo usando "
    "tecnologia de terceiros como Fireblocks/BitGo como ferramenta) ou um "
    "CUSTODIANTE TERCEIRO contratado que assume a guarda (ex.: BitGo Trust, "
    "Coinbase Custody, Zodia, Liminal, Copper)? (3) Qual o nome do custodiante ou "
    "da tecnologia usada, se divulgado? "
    "Responda APENAS um JSON válido, sem markdown: "
    '{{"oferece_custodia": true|false|null, '
    '"modelo": "propria|terceirizada|hibrida|indeterminado|sem_custodia", '
    '"custodiante": "nome do custodiante/tecnologia ou null", '
    '"justificativa": "1-2 frases citando a fonte concreta (página de termos, notícia, docs)", '
    '"evidencia_url": "URL da fonte primária ou null", '
    '"confianca": 0.0 a 1.0}} '
    "REGRAS: use 'propria' ou 'terceirizada' SOMENTE com evidência explícita e "
    "citável sobre quem guarda as chaves. Texto de marketing genérico dizendo "
    "'oferecemos custódia' NÃO prova custódia própria — nesse caso use "
    "'indeterminado' e explique. Use 'sem_custodia' se a empresa claramente não "
    "guarda ativos de clientes (ex.: só faz pagamentos com liquidação imediata, "
    "consultoria, software). NÃO invente. É melhor responder 'indeterminado' com "
    "confianca baixa do que chutar."
)


def gemini(inst: dict, key: str) -> dict | None:
    nome = inst["nome_fantasia"] or inst["razao_social"]
    body = {
        "contents": [{"parts": [{"text": PROMPT.format(nome=nome, razao=inst["razao_social"], cnpj=inst["cnpj"])}]}],
        "tools": [{"google_search": {}}],
        "generationConfig": {"temperature": 0.1},
    }
    try:
        r = SESS.post(
            f"https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key={key}",
            json=body, timeout=120)
        r.raise_for_status()
        txt = r.json()["candidates"][0]["content"]["parts"][0]["text"]
        m = re.search(r"\{.*\}", txt, flags=re.S)
        return json.loads(m.group(0)) if m else None
    except Exception as e:
        detail = getattr(getattr(e, "response", None), "text", "")[:200]
        print(f"    gemini erro: {type(e).__name__}: {e} {detail}")
        return None


def url_valida(url: str) -> bool:
    try:
        r = SESS.head(url, headers=UA, timeout=10, allow_redirects=True)
        if r.status_code in (405, 403):
            r = SESS.get(url, headers=UA, timeout=10, allow_redirects=True, stream=True)
            r.close()
        return r.status_code < 400
    except requests.RequestException:
        return False


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--limit", type=int, default=0)
    ap.add_argument("--force", action="store_true")
    args = ap.parse_args()

    key = os.getenv("GEMINI_API_KEY")
    if not key:
        sys.exit("GEMINI_API_KEY não definida")

    con = sqlite3.connect(DB)
    con.row_factory = sqlite3.Row
    con.execute(
        """CREATE TABLE IF NOT EXISTS custodia_verificacao (
             cnpj TEXT PRIMARY KEY,
             oferece_custodia INTEGER,
             modelo TEXT,
             custodiante TEXT,
             justificativa TEXT,
             evidencia_url TEXT,
             confianca REAL,
             atualizado_em TEXT
           )""")

    insts = [dict(r) for r in con.execute(
        """SELECT DISTINCT i.cnpj, i.razao_social, i.nome_fantasia
           FROM instituicoes i
           WHERE i.cnpj IN (
             SELECT cnpj FROM tags WHERE tag IN ('custodia_propria', 'custodia_terceirizada')
             UNION
             -- Tier 3: menção de custódia em fato OSINT (site/notícia) sem tag
             SELECT cnpj FROM fatos
             WHERE lower(descricao) LIKE '%custod%' OR lower(descricao) LIKE '%custód%'
           )
           ORDER BY i.cnpj""")]

    feitos = set() if args.force else {
        r[0] for r in con.execute("SELECT cnpj FROM custodia_verificacao")}
    fila = [i for i in insts if i["cnpj"] not in feitos]
    if args.limit:
        fila = fila[:args.limit]
    print(f"{len(insts)} empresas com tag de custódia | {len(feitos)} já verificadas | processando {len(fila)}")

    ok = 0
    for n, i in enumerate(fila, 1):
        nome = i["nome_fantasia"] or i["razao_social"]
        print(f"[{n}/{len(fila)}] {nome[:60]}")
        g = gemini(i, key)
        time.sleep(1.5)
        if not g:
            continue

        modelo = g.get("modelo") if g.get("modelo") in MODELOS else "indeterminado"
        oferece = g.get("oferece_custodia")
        oferece = 1 if oferece is True else 0 if oferece is False else None
        custodiante = g.get("custodiante") if isinstance(g.get("custodiante"), str) else None
        just = g.get("justificativa") if isinstance(g.get("justificativa"), str) else None
        conf = float(g.get("confianca") or 0)
        url = g.get("evidencia_url") if isinstance(g.get("evidencia_url"), str) else None
        if url and (not url.startswith("http") or "vertexaisearch" in url or not url_valida(url)):
            url = None

        con.execute(
            """INSERT INTO custodia_verificacao
               (cnpj, oferece_custodia, modelo, custodiante, justificativa, evidencia_url, confianca, atualizado_em)
               VALUES (?,?,?,?,?,?,?,datetime('now'))
               ON CONFLICT(cnpj) DO UPDATE SET oferece_custodia=excluded.oferece_custodia,
                 modelo=excluded.modelo, custodiante=excluded.custodiante,
                 justificativa=excluded.justificativa, evidencia_url=excluded.evidencia_url,
                 confianca=excluded.confianca, atualizado_em=excluded.atualizado_em""",
            (i["cnpj"], oferece, modelo, custodiante, just, url, conf))
        con.commit()
        ok += 1
        print(f"    modelo={modelo} conf={conf} custodiante={custodiante or '-'} url={'sim' if url else 'não'}")

    print(f"\nfeito: {ok}/{len(fila)}")
    for r in con.execute("SELECT modelo, COUNT(*) FROM custodia_verificacao GROUP BY modelo"):
        print(f"  {r[0]}: {r[1]}")
    con.close()


if __name__ == "__main__":
    main()
