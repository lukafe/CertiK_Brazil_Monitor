"""
Cliente Gemini compartilhado (google-genai) com saída JSON estruturada.

Usado pelos módulos de monitoramento contínuo (coletor_noticias, classificar,
coletor_site). Sempre com `response_schema` — nunca parsing de texto livre.
A chave vem de GEMINI_API_KEY no `.env` (python-dotenv).
"""
from __future__ import annotations

import json
import os
import sqlite3
import time
from pathlib import Path

from dotenv import load_dotenv
from google import genai
from google.genai import types

load_dotenv()

FLASH = "gemini-2.5-flash"
PRO = "gemini-2.5-pro"

_DB_USO = Path(__file__).parent / "data" / "monitor.db"


def _registrar_uso(modelo: str, usage) -> None:
    """Grava tokens da chamada em `gemini_uso` (para o resumo de custo do
    run_monitor). Nunca propaga erro — telemetria não pode quebrar o pipeline."""
    try:
        entrada = getattr(usage, "prompt_token_count", 0) or 0
        saida = (getattr(usage, "candidates_token_count", 0) or 0) + \
                (getattr(usage, "thoughts_token_count", 0) or 0)
        con = sqlite3.connect(_DB_USO, timeout=30)
        con.execute("""CREATE TABLE IF NOT EXISTS gemini_uso (
                           ts TEXT DEFAULT (datetime('now')),
                           modelo TEXT, tokens_entrada INTEGER, tokens_saida INTEGER)""")
        con.execute("INSERT INTO gemini_uso (modelo, tokens_entrada, tokens_saida) VALUES (?,?,?)",
                    (modelo, entrada, saida))
        con.commit()
        con.close()
    except Exception:
        pass

_cliente: genai.Client | None = None


def cliente() -> genai.Client:
    global _cliente
    if _cliente is None:
        chave = os.environ.get("GEMINI_API_KEY")
        if not chave:
            raise SystemExit("GEMINI_API_KEY ausente — defina no .env na raiz do repo.")
        # timeout explícito — o padrão do google-genai é SEM timeout e uma
        # conexão morta trava o pipeline inteiro
        _cliente = genai.Client(api_key=chave,
                                http_options=types.HttpOptions(timeout=60_000))
    return _cliente


def gemini_json(prompt: str, schema: dict, modelo: str = FLASH,
                temperatura: float = 0.1, tentativas: int = 3) -> dict | None:
    """Chama o Gemini com response_schema e devolve o JSON (dict) ou None."""
    for i in range(tentativas):
        try:
            resp = cliente().models.generate_content(
                model=modelo,
                contents=prompt,
                config=types.GenerateContentConfig(
                    temperature=temperatura,
                    response_mime_type="application/json",
                    response_schema=schema,
                ),
            )
            _registrar_uso(modelo, resp.usage_metadata)
            return json.loads(resp.text)
        except Exception as e:  # rede/quota/JSON truncado — retry com backoff
            if i == tentativas - 1:
                print(f"    gemini falhou ({modelo}): {e}")
                return None
            time.sleep(2 ** (i + 1))
    return None
