"""
Universo PSAV Brasil — pipeline de 2 módulos

Módulo 1 (SPSAV):      Dados Abertos do CNPJ (Receita Federal) — quem pôs "ativos virtuais" na razão social.
Módulo 2 (INCUMBENTE): Cadastro Unicad do BCB (API OData, diária) — bancos, CEF, CTVM, DTVM e corretoras
                       de câmbio elegíveis pela Res. BCB 520, pontuados por sinais públicos de que vão
                       comunicar a prestação de serviços de ativos virtuais.

Uso:
    pip install polars requests
    python spsav_scraper.py                 # mês mais recente da Receita
    python spsav_scraper.py 2026-08         # força um mês
    GEMINI_API_KEY=... python spsav_scraper.py   # habilita o sinal de notícias (opcional)

Requisitos: ~40 GB de disco para o dump da Receita (zips + CSVs convertidos).
"""
from __future__ import annotations

import os
import re
import sys
import json
import zipfile
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path

import polars as pl
import requests
from requests.adapters import HTTPAdapter
from urllib3.util.retry import Retry

# ----------------------------------------------------------------------------- config
# A Receita migrou os Dados Abertos do CNPJ para um share Nextcloud (SERPRO); acesso via WebDAV público.
RECEITA = "https://arquivos.receitafederal.gov.br/public.php/webdav/"
RECEITA_AUTH = ("YggdBLfdninEJX9", "")  # token público do share, senha vazia
BCB_ODATA = "https://olinda.bcb.gov.br/olinda/servico/Instituicoes_em_funcionamento/versao/v1/odata/"
WORK, OUT = Path("cnpj_data"), Path("out")
UA = {"User-Agent": "Mozilla/5.0 (universo-psav-research)"}

SESS = requests.Session()
SESS.headers.update(UA)
SESS.mount("https://", HTTPAdapter(max_retries=Retry(total=5, backoff_factor=2,
                                                     status_forcelist=[429, 500, 502, 503, 504])))

PAT_SPSAV = r"ATIVOS?\s+VIRTUA[IL]S?"                       # razão social do módulo 1
PAT_NOME = r"DIGITAL|CRIPTO|CRYPTO|BITCOIN|TOKEN|BLOCKCHAIN|\bASSET"  # sinal fraco no nome
RAIZ_GENERICA = {"BANCO", "BANK", "SOCIEDADE", "BRASIL", "COMPANHIA", "CIA", "GRUPO", "NOVA", "NOVO", "PRIMEIRA"}
PAT_SITE = r"ativos? virtuais|cripto|crypto|bitcoin|tokeniza|stablecoin|blockchain|web3"
DOMINIOS_GENERICOS = {"gmail.com", "hotmail.com", "outlook.com", "yahoo.com.br", "yahoo.com",
                      "uol.com.br", "terra.com.br", "bol.com.br"}

# Segmentos elegíveis (Res. BCB 520, arts. 19-20). Instituições de pagamento NÃO são elegíveis.
SEG_ELEGIVEIS = {
    "BANCO COMERCIAL", "BANCO MULTIPLO", "BANCO MÚLTIPLO", "CAIXA ECONOMICA", "CAIXA ECONÔMICA",
    "BANCO DE INVESTIMENTO", "BANCO DE CAMBIO", "BANCO DE CÂMBIO",
    "CORRETORA DE TVM", "DISTRIBUIDORA DE TVM",
    "CORRETORA DE TITULOS", "CORRETORA DE TÍTULOS",
    "DISTRIBUIDORA DE TITULOS", "DISTRIBUIDORA DE TÍTULOS",
    "CORRETORA DE CAMBIO", "CORRETORA DE CÂMBIO",
}
PESOS = {"sinal_grupo_spsav": 5, "sinal_site": 3, "sinal_nome": 1, "sinal_noticias": 2}

COLS_EMP = ["cnpj_basico", "razao_social", "natureza_juridica", "qualif_responsavel",
            "capital_social", "porte", "ente_federativo"]
COLS_EST = ["cnpj_basico", "cnpj_ordem", "cnpj_dv", "matriz_filial", "nome_fantasia",
            "situacao", "data_situacao", "motivo_situacao", "cidade_exterior", "pais",
            "data_inicio", "cnae_principal", "cnae_secundaria", "tipo_logradouro",
            "logradouro", "numero", "complemento", "bairro", "cep", "uf", "municipio",
            "ddd1", "tel1", "ddd2", "tel2", "ddd_fax", "fax", "email", "situacao_especial",
            "data_situacao_especial"]
COLS_SOC = ["cnpj_basico", "tipo_socio", "nome_socio", "cpf_cnpj_socio", "qualif_socio",
            "data_entrada", "pais", "representante", "nome_representante",
            "qualif_representante", "faixa_etaria"]


# ----------------------------------------------------------------------------- receita
def _webdav_ls(path: str) -> list[str]:
    r = SESS.request("PROPFIND", f"{RECEITA}{path}", auth=RECEITA_AUTH,
                     headers={"Depth": "1"}, timeout=300)
    r.raise_for_status()
    return re.findall(r"<d:href>([^<]+)</d:href>", r.text)


def latest_month() -> str:
    months = sorted({m for h in _webdav_ls("") for m in re.findall(r"/(\d{4}-\d{2})/$", h)})
    if not months:
        raise SystemExit("Não achei pastas mensais em " + RECEITA)
    return months[-1]


def download(month: str, prefix: str) -> list[Path]:
    folder = WORK / month
    folder.mkdir(parents=True, exist_ok=True)
    listing = folder / "_listing.txt"
    if not listing.exists():
        listing.write_text("\n".join(_webdav_ls(f"{month}/")))
    names = sorted(set(re.findall(rf"({prefix}\d*\.zip)", listing.read_text())))
    if not names:
        raise SystemExit(f"Nenhum arquivo {prefix}*.zip em {RECEITA}{month}/")
    paths = []
    for name in names:
        dest = folder / name
        tmp = folder / (name + ".part")
        if not dest.exists():
            print(f"  baixando {name} ...", flush=True)
            for tentativa in range(1, 11):
                ja_tem = tmp.stat().st_size if tmp.exists() else 0
                headers = {"Range": f"bytes={ja_tem}-"} if ja_tem else {}
                try:
                    with SESS.get(f"{RECEITA}{month}/{name}", auth=RECEITA_AUTH, stream=True,
                                  timeout=(60, 300), headers=headers) as r:
                        if ja_tem and r.status_code == 200:   # servidor ignorou o Range
                            ja_tem = 0
                        r.raise_for_status()
                        with open(tmp, "ab" if ja_tem else "wb") as f:
                            for chunk in r.iter_content(1 << 20):
                                f.write(chunk)
                    tmp.rename(dest)
                    break
                except (requests.RequestException, OSError) as e:
                    print(f"    conexão caiu ({type(e).__name__}), retomando de "
                          f"{tmp.stat().st_size if tmp.exists() else 0} bytes (tentativa {tentativa}/10)", flush=True)
            else:
                raise SystemExit(f"Falha ao baixar {name} após 10 tentativas")
        paths.append(dest)
    return paths


def read_zip_csv(path: Path, cols: list[str]) -> pl.LazyFrame:
    """Extrai o CSV (latin-1) e converte uma única vez para UTF-8, que é o que o polars lê."""
    with zipfile.ZipFile(path) as z:
        inner = z.namelist()[0]
        csv_path = path.parent / (inner + ".utf8.csv")
        if not csv_path.exists():
            print(f"  convertendo {inner} para UTF-8 ...", flush=True)
            tmp = csv_path.with_suffix(".tmp")
            with z.open(inner) as src, open(tmp, "wb") as dst:
                while chunk := src.read(1 << 24):
                    dst.write(chunk.decode("latin-1").encode("utf-8"))
            tmp.rename(csv_path)
    return pl.scan_csv(csv_path, separator=";", has_header=False, new_columns=cols,
                       infer_schema_length=0, quote_char='"', ignore_errors=True, truncate_ragged_lines=True)


def receita_enrich(month: str, keys: list[str]) -> tuple[pl.DataFrame, pl.DataFrame]:
    """Estabelecimento-matriz e sócios para uma lista de cnpj_basico."""
    est = pl.concat([read_zip_csv(p, COLS_EST)
                     .filter(pl.col("cnpj_basico").is_in(keys) & (pl.col("matriz_filial") == "1"))
                     .collect() for p in download(month, "Estabelecimentos")])
    soc = pl.concat([read_zip_csv(p, COLS_SOC).filter(pl.col("cnpj_basico").is_in(keys)).collect()
                     for p in download(month, "Socios")])
    return est.unique("cnpj_basico"), soc


# ----------------------------------------------------------------------------- módulo 1
def modulo_spsav(month: str) -> tuple[pl.DataFrame, pl.DataFrame]:
    print("[1/2] SPSAV — filtrando razão social na Receita")
    emp = pl.concat([read_zip_csv(p, COLS_EMP)
                     .filter(pl.col("razao_social").str.contains(PAT_SPSAV)).collect()
                     for p in download(month, "Empresas")]).unique("cnpj_basico")
    print(f"  {emp.height} empresas com 'ativos virtuais' na razão social")
    est, soc = receita_enrich(month, emp["cnpj_basico"].to_list())
    df = (emp.join(est, on="cnpj_basico", how="left")
             .join(soc.group_by("cnpj_basico").agg(pl.col("nome_socio").str.join(" | ").alias("socios")),
                   on="cnpj_basico", how="left")
             .with_columns(origem=pl.lit("SPSAV"), segmento=pl.lit("SPSAV"),
                           cnpj=pl.col("cnpj_basico") + pl.col("cnpj_ordem") + pl.col("cnpj_dv")))
    return df, soc


# ----------------------------------------------------------------------------- módulo 2
def _pick(cols: list[str], *needles: str) -> str | None:
    for n in needles:
        for c in cols:
            if n in c.upper():
                return c
    return None


def bcb_universo() -> pl.DataFrame:
    """Baixa Unicad (OData) e normaliza para cnpj_basico / nome / segmento / site / e-mail."""
    print("[2/2] INCUMBENTES — baixando cadastro Unicad do BCB")
    frames = []
    for recurso in ("SedesBancoComMultCE", "SedesSociedades"):
        url = f"{BCB_ODATA}{recurso}?$format=json&$top=100000"
        data = SESS.get(url, timeout=120).json()["value"]
        if not data:
            continue
        df = pl.DataFrame(data, infer_schema_length=None).cast(pl.Utf8)
        cols = df.columns
        c_cnpj, c_nome = _pick(cols, "CNPJ"), _pick(cols, "NOME", "INSTITUI")
        c_seg = _pick(cols, "SEGMENTO", "TIPO", "NATUREZA")
        c_site, c_mail = _pick(cols, "SITIO", "SITE"), _pick(cols, "MAIL")
        if not (c_cnpj and c_nome):
            raise SystemExit(f"Layout inesperado em {recurso}: {cols}")
        print(f"  {recurso}: {df.height} linhas | cnpj={c_cnpj} nome={c_nome} seg={c_seg} site={c_site}")
        frames.append(df.select(
            cnpj_basico=pl.when(pl.col(c_cnpj).str.replace_all(r"\D", "").str.len_chars() > 8)
                          .then(pl.col(c_cnpj).str.replace_all(r"\D", "").str.zfill(14).str.slice(0, 8))
                          .otherwise(pl.col(c_cnpj).str.replace_all(r"\D", "").str.zfill(8)),
            nome_bcb=pl.col(c_nome),
            segmento=pl.col(c_seg) if c_seg else pl.lit(recurso),
            site_bcb=pl.col(c_site) if c_site else pl.lit(None, dtype=pl.Utf8),
            email_bcb=pl.col(c_mail) if c_mail else pl.lit(None, dtype=pl.Utf8),
        ))
    uni = pl.concat(frames).unique("cnpj_basico")
    seg_ok = pl.any_horizontal([pl.col("segmento").str.to_uppercase().str.contains(s, literal=True)
                                for s in SEG_ELEGIVEIS])
    eleg = uni.filter(seg_ok)
    print(f"  {uni.height} instituições no Unicad → {eleg.height} elegíveis (Res. 520)")
    if eleg.height == 0:
        print("  AVISO: nenhum segmento bateu — confira os valores de 'segmento':", uni["segmento"].unique().to_list()[:30])
    return eleg


def sinal_site(site: str | None, *emails: str | None) -> tuple[int, str]:
    """Site cadastral do BCB (ou domínio de e-mail) → home do site → busca por termos cripto."""
    candidatos: list[str] = []
    if site and "." in site:
        dom = site.strip().lower().removeprefix("https://").removeprefix("http://").split("/")[0]
        candidatos += [f"https://{dom}", f"https://www.{dom.removeprefix('www.')}"]
    for email in emails:
        if email and "@" in email:
            dom = email.split("@")[-1].strip().lower()
            if dom not in DOMINIOS_GENERICOS:
                candidatos += [f"https://www.{dom}", f"https://{dom}"]
    ultimo_ok = ""
    for url in dict.fromkeys(candidatos):
        try:
            html = requests.get(url, headers=UA, timeout=10).text.lower()
        except Exception:
            continue
        m = re.findall(PAT_SITE, html)
        if m:
            return 1, url + " :: " + ",".join(sorted(set(m))[:5])
        ultimo_ok = ultimo_ok or url
    return 0, ultimo_ok


def sinal_noticias(nome: str) -> tuple[int, str]:
    """Opcional: pergunta ao Gemini (com busca) se a instituição anunciou algo em ativos virtuais."""
    key = os.getenv("GEMINI_API_KEY")
    if not key:
        return 0, ""
    prompt = (f"A instituição financeira brasileira '{nome}' anunciou, lançou ou está construindo algo em "
              "criptoativos, ativos virtuais, tokenização, stablecoin ou Drex (2024-2026)? Responda SOMENTE um JSON: "
              '{"sim": true|false, "evidencia": "uma frase com fonte"}')
    try:
        r = SESS.post(
            f"https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key={key}",
            json={"contents": [{"parts": [{"text": prompt}]}], "tools": [{"google_search": {}}]}, timeout=60)
        txt = r.json()["candidates"][0]["content"]["parts"][0]["text"]
        j = json.loads(re.sub(r"```json|```", "", txt).strip())
        return (1 if j.get("sim") else 0), j.get("evidencia", "")
    except Exception as e:
        return 0, f"erro: {e}"


def modulo_incumbentes(month: str, spsav: pl.DataFrame, soc_spsav: pl.DataFrame) -> pl.DataFrame:
    eleg = bcb_universo()
    keys = eleg["cnpj_basico"].to_list()
    est, soc = receita_enrich(month, keys)

    # Sinal 1 — grupo econômico: sócio (CPF/CNPJ) em comum com alguma SPSAV, ou raiz de nome em comum
    socios_spsav = set(soc_spsav["cpf_cnpj_socio"].drop_nulls().to_list()) - {""}
    raizes_spsav = {r for r in spsav["razao_social"].str.extract(r"^(\w+(?:\s\w+)?)").drop_nulls().to_list()
                    if r.split()[0] not in RAIZ_GENERICA and len(r) > 4}
    grupo = (soc.filter(pl.col("cpf_cnpj_socio").is_in(list(socios_spsav)))
                .group_by("cnpj_basico").agg(pl.col("nome_socio").str.join(" | ").alias("socio_comum")))

    df = (eleg.join(est, on="cnpj_basico", how="left")
              .join(soc.group_by("cnpj_basico").agg(pl.col("nome_socio").str.join(" | ").alias("socios")),
                    on="cnpj_basico", how="left")
              .join(grupo, on="cnpj_basico", how="left")
              .with_columns(
                  razao_social=pl.col("nome_bcb"),
                  cnpj=pl.when(pl.col("cnpj_dv").is_null()).then(pl.col("cnpj_basico"))
                         .otherwise(pl.col("cnpj_basico") + pl.col("cnpj_ordem") + pl.col("cnpj_dv")),
                  origem=pl.lit("INCUMBENTE"),
                  sinal_grupo_spsav=(pl.col("socio_comum").is_not_null()
                                     | pl.col("nome_bcb").str.extract(r"^(\w+(?:\s\w+)?)").is_in(list(raizes_spsav))).cast(pl.Int8),
                  sinal_nome=(pl.col("nome_bcb") + " " + pl.col("nome_fantasia").fill_null("")).str.to_uppercase()
                              .str.contains(PAT_NOME).cast(pl.Int8),
              ))

    # Sinais 2 e 3 — site e notícias (rede; roda só para os elegíveis, algumas centenas)
    print(f"  checando site de {df.height} instituições (paralelo) ...", flush=True)
    with ThreadPoolExecutor(max_workers=16) as ex:
        sites = list(ex.map(sinal_site, df["site_bcb"].to_list(), df["email_bcb"].to_list(), df["email"].to_list()))
    df = df.with_columns(sinal_site=pl.Series([s[0] for s in sites], dtype=pl.Int8),
                         evidencia_site=pl.Series([s[1] for s in sites]))
    if os.getenv("GEMINI_API_KEY"):
        # checkpoint: salva cada resposta em disco; reexecução só consulta o que falta
        ckpt = OUT / f"noticias_{month}.json"
        cache: dict[str, list] = json.loads(ckpt.read_text()) if ckpt.exists() else {}
        nomes = df["nome_bcb"].to_list()
        faltam = [n for n in dict.fromkeys(nomes) if n not in cache]
        print(f"  consultando notícias via Gemini ({len(faltam)} faltantes de {len(nomes)}) ...", flush=True)
        for i, nome in enumerate(faltam, 1):
            cache[nome] = list(sinal_noticias(nome))
            ckpt.write_text(json.dumps(cache, ensure_ascii=False))
            if i % 25 == 0:
                print(f"    {i}/{len(faltam)} consultas feitas", flush=True)
        news = [tuple(cache[n]) for n in nomes]
    else:
        news = [(0, "")] * df.height
    df = df.with_columns(sinal_noticias=pl.Series([n[0] for n in news], dtype=pl.Int8),
                         evidencia_noticias=pl.Series([n[1] for n in news]))
    return df


# ----------------------------------------------------------------------------- main
FINAL = ["origem", "segmento", "cnpj", "razao_social", "nome_fantasia", "uf", "municipio", "situacao",
         "data_situacao", "data_inicio", "capital_social", "cnae_principal", "email", "ddd1", "tel1",
         "socios", "score", "sinal_grupo_spsav", "sinal_site", "sinal_nome", "sinal_noticias",
         "socio_comum", "evidencia_site", "evidencia_noticias"]


def main():
    month = sys.argv[1] if len(sys.argv) > 1 else latest_month()
    print(f"mês de referência da Receita: {month}")
    OUT.mkdir(exist_ok=True)

    spsav, soc_spsav = modulo_spsav(month)
    inc = modulo_incumbentes(month, spsav, soc_spsav)

    # SPSAV tem score máximo por definição (mudou a razão social = está aplicando); sinais ficam nulos
    spsav = spsav.with_columns(score=pl.lit(sum(PESOS.values())))
    inc = inc.with_columns(score=sum(pl.col(s) * w for s, w in PESOS.items()))

    def padronizar(df: pl.DataFrame) -> pl.DataFrame:
        faltam = [pl.lit(None, dtype=pl.Utf8).alias(c) for c in FINAL if c not in df.columns]
        return df.with_columns(faltam).select(FINAL).cast({c: pl.Utf8 for c in FINAL})

    universo = (pl.concat([padronizar(spsav), padronizar(inc)])
                  .with_columns(pl.col("score").cast(pl.Int32))
                  .sort(["score", "razao_social"], descending=[True, False]))
    out_file = OUT / f"universo_{month}.csv"
    universo.write_csv(out_file)
    print(f"\ngravado {out_file}: {spsav.height} SPSAV + {inc.height} incumbentes "
          f"({(inc['score'].cast(pl.Int32) > 0).sum()} incumbentes com algum sinal)")

    prev = [p for p in sorted(OUT.glob("universo_*.csv")) if p != out_file]
    if prev:
        old = pl.read_csv(prev[-1], infer_schema_length=0)
        novas = universo.filter(~pl.col("cnpj").is_in(old["cnpj"].to_list()))
        subiu = (universo.join(old.select("cnpj", score_antigo=pl.col("score")), on="cnpj")
                         .filter(pl.col("score").cast(pl.Int32) > pl.col("score_antigo").cast(pl.Int32)))
        novas.write_csv(OUT / f"novas_{month}.csv")
        subiu.write_csv(OUT / f"score_subiu_{month}.csv")
        print(f"{novas.height} entradas novas e {subiu.height} com score maior desde {prev[-1].name}")


if __name__ == "__main__":
    main()
