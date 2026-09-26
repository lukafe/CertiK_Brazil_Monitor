"""
Cliente Gemini compartilhado (google-genai) com saída JSON estruturada.

Usado pelos módulos de monitoramento contínuo (coletor_noticias, classificar,
coletor_site). Sempre com `response_schema` — nunca parsing de texto livre.
A chave vem de GEMINI_API_KEY no `.env` (python-dotenv).
"""
from __future__ import annotations

import json
import os
import time

from dotenv import load_dotenv
from google import genai
from google.genai import types

load_dotenv()

FLASH = "gemini-2.5-flash"
PRO = "gemini-2.5-pro"

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
            return json.loads(resp.text)
        except Exception as e:  # rede/quota/JSON truncado — retry com backoff
            if i == tentativas - 1:
                print(f"    gemini falhou ({modelo}): {e}")
                return None
            time.sleep(2 ** (i + 1))
    return None
