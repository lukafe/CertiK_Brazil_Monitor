"""
OSINT das SPSAVs — enriquece as 165 SPSAVs com fontes abertas e grava fatos.

Fase A (domínio): deriva domínio do e-mail cadastral (ignora provedores genéricos
e escritórios de contabilidade/advocacia), visita o site, procura keywords de
cripto, extrai título e links de redes sociais (LinkedIn/Instagram/X).

Fase B (Gemini + Google Search grounding): 1 consulta por SPSAV pedindo JSON com
notícias, fundadores/executivos e produto. Grava fatos 'noticia' e 'pessoa'
(confiança 0.6) e atualiza sinal_noticias/evidencia_noticias.

Checkpoint em out/osint_spsav.json (retomável). Ao final, roda rating.py à parte.

Uso: GEMINI_API_KEY=... .venv/bin/python osint_spsav.py
"""
from __future__ import annotations

import json
import os
import re
import sqlite3
import time
import unicodedata
from pathlib import Path

import requests
from requests.adapters import HTTPAdapter
from urllib3.util.retry import Retry

DB = Path("data/monitor.db")
CKPT = Path("out/osint_spsav.json")
UA = {"User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124 Safari/537.36"}

SESS = requests.Session()
SESS.mount("https://", HTTPAdapter(max_retries=Retry(total=3, backoff_factor=2, status_forcelist=[429, 500, 502, 503])))

GENERIC_MAIL = {"gmail.com", "hotmail.com", "outlook.com", "yahoo.com", "yahoo.com.br",
                "uol.com.br", "bol.com.br", "terra.com.br", "icloud.com", "live.com",
                "msn.com", "globo.com", "ig.com.br", "protonmail.com", "proton.me"}
TERCEIROS = ("contab", "advocacia", "advogad", "juridic", "adv.br", "escritorio", "assessoria")

KW_CRIPTO = ("cripto", "crypto", "bitcoin", "btc", "stablecoin", "token", "blockchain",
             "exchange", "ativos virtuais", "ativos digitais", "digital assets", "web3",
             "custódia", "custodia", "defi", "drex")


def norm_txt(html: str) -> str:
    txt = re.sub(r"<script[^>]*>.*?</script>|<style[^>]*>.*?</style>", " ", html, flags=re.S | re.I)
    txt = re.sub(r"<[^>]+>", " ", txt)
    return unicodedata.normalize("NFKD", txt).encode("ascii", "ignore").decode().lower()


def fase_a(inst: dict) -> list[tuple]:
    """Retorna lista de fatos (tipo, fonte, url, confianca, descricao) do site."""
    email = (inst["email"] or "").lower().strip()
    if "@" not in email:
        return []
    dom = email.split("@")[-1]
    if dom in GENERIC_MAIL or any(t in dom for t in TERCEIROS):
        return []
    url = f"https://{dom}"
    try:
        r = SESS.get(url, headers=UA, timeout=15, allow_redirects=True)
        if r.status_code >= 400:
            return []
        html = r.text
    except requests.RequestException:
        return []

    fatos = []
    titulo = re.search(r"<title[^>]*>(.*?)</title>", html, flags=re.S | re.I)
    titulo = re.sub(r"\s+", " ", titulo.group(1)).strip()[:120] if titulo else ""
    txt = norm_txt(html)
    kws = sorted({k for k in KW_CRIPTO if k in txt})
    if kws:
        fatos.append(("site", "osint_dominio", r.url, 0.7,
                      f"Site ativo ({titulo or dom}) menciona: {', '.join(kws[:8])}"))
    elif titulo:
        fatos.append(("site", "osint_dominio", r.url, 0.5, f"Site ativo: {titulo}"))

    for rede, pat in (("linkedin", r"linkedin\.com/(?:company|in)/[\w\-%.]+"),
                      ("instagram", r"instagram\.com/[\w\-.%]+"),
                      ("twitter", r"(?:twitter|x)\.com/[\w\-%.]+")):
        m = re.search(pat, html)
        if m:
            u = "https://" + m.group(0)
            if not re.search(r"/(share|intent|p)/?$", u):
                fatos.append(("site", f"osint_{rede}", u, 0.6, f"Perfil {rede} vinculado no site"))
    return fatos


def fase_b(inst: dict, key: str) -> dict | None:
    nome = inst["nome_fantasia"] or inst["razao_social"]
    prompt = (
        f'Pesquise na web sobre a empresa brasileira "{nome}" '
        f'(razão social: {inst["razao_social"]}, CNPJ {inst["cnpj"]}), uma sociedade '
        "prestadora de serviços de ativos virtuais (SPSAV/VASP) no Brasil. "
        "Responda APENAS um JSON válido, sem markdown, no formato: "
        '{"tem_noticias": bool, "resumo": "1-2 frases sobre o que a empresa faz e fatos recentes", '
        '"urls_noticias": ["até 3 urls de notícias/fontes"], '
        '"pessoas": [{"nome": "...", "cargo": "..."}], '
        '"grupo_controlador": "nome do grupo/empresa controladora ou null"} '
        "Se não encontrar nada confiável sobre ESTA empresa específica, use tem_noticias=false e listas vazias. "
        "Não invente informações."
    )
    body = {"contents": [{"parts": [{"text": prompt}]}],
            "tools": [{"google_search": {}}],
            "generationConfig": {"temperature": 0.1}}
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


def main():
    key = os.getenv("GEMINI_API_KEY")
    con = sqlite3.connect(DB)
    con.row_factory = sqlite3.Row
    insts = [dict(r) for r in con.execute(
        "SELECT cnpj, razao_social, nome_fantasia, email FROM instituicoes WHERE origem='SPSAV' ORDER BY cnpj")]

    ckpt = json.loads(CKPT.read_text()) if CKPT.exists() else {}
    print(f"{len(insts)} SPSAVs | {len(ckpt)} já processadas | web-search={'ON' if key else 'OFF'}")

    for n, i in enumerate(insts, 1):
        if i["cnpj"] in ckpt:
            continue
        nome = i["nome_fantasia"] or i["razao_social"]
        print(f"[{n}/{len(insts)}] {nome[:60]}")
        rec: dict = {"fatos": []}

        for f in fase_a(i):
            rec["fatos"].append(f)

        if key:
            g = fase_b(i, key)
            if g:
                rec["web"] = g
                if g.get("tem_noticias") and g.get("resumo"):
                    urls = g.get("urls_noticias") or [None]
                    rec["fatos"].append(("noticia", "web_osint", urls[0], 0.6, g["resumo"][:400]))
                    for u in urls[1:3]:
                        if u:
                            rec["fatos"].append(("noticia", "web_osint", u, 0.6, f"Cobertura adicional: {u}"))
                for p in (g.get("pessoas") or [])[:5]:
                    if isinstance(p, dict) and p.get("nome"):
                        rec["fatos"].append(("pessoa", "web_osint", None, 0.6,
                                             f"{p['nome']} — {p.get('cargo') or 'cargo não informado'}"))
                if g.get("grupo_controlador"):
                    rec["fatos"].append(("manual", "web_osint", None, 0.6,
                                         f"Grupo controlador citado: {g['grupo_controlador']}"))
            time.sleep(1.5)

        for tipo, fonte, url, conf, desc in rec["fatos"]:
            con.execute("""INSERT OR IGNORE INTO fatos (cnpj, tipo, fonte, url, confianca, descricao)
                           VALUES (?,?,?,?,?,?)""", (i["cnpj"], tipo, fonte, url, conf, desc))

        # atualiza sinais no cadastro
        tem_site_cripto = any(f[0] == "site" and f[3] >= 0.7 for f in rec["fatos"])
        tem_noticia = any(f[0] == "noticia" for f in rec["fatos"])
        if tem_site_cripto:
            ev = next(f[4] for f in rec["fatos"] if f[0] == "site" and f[3] >= 0.7)
            con.execute("UPDATE instituicoes SET sinal_site=1, evidencia_site=? WHERE cnpj=?", (ev, i["cnpj"]))
        if tem_noticia:
            ev = next(f[4] for f in rec["fatos"] if f[0] == "noticia")
            con.execute("UPDATE instituicoes SET sinal_noticias=1, evidencia_noticias=? WHERE cnpj=?", (ev, i["cnpj"]))

        con.commit()
        ckpt[i["cnpj"]] = {"n_fatos": len(rec["fatos"])}
        CKPT.parent.mkdir(exist_ok=True)
        CKPT.write_text(json.dumps(ckpt))

    tot = con.execute("""SELECT tipo, COUNT(*) FROM fatos WHERE fonte LIKE 'osint%' OR fonte='web_osint'
                         GROUP BY tipo""").fetchall()
    print("fatos OSINT no banco:", {r[0]: r[1] for r in tot})
    con.close()


if __name__ == "__main__":
    main()
