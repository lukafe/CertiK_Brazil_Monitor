# CertiK MONITOR Brasil — universo PSAV/VASP

Monitoramento do universo de prestadoras de serviços de ativos virtuais no
Brasil (Res. BCB 520): as SPSAVs em constituição e as instituições
incumbentes elegíveis. Pipeline em Python + SQLite gera `data/monitor.db`;
um webapp Next.js 100% estático publica os dados em
<https://certik-monitor-brasil.vercel.app>.

## Arquitetura

```
coletores ──> fatos/eventos (data/monitor.db) ──> rating.py ──> webapp (build estático)
```

Tudo gira em torno de **fatos atômicos** (tabela `fatos`, com
`UNIQUE(cnpj, tipo, fonte, descricao)` — reprocessar nunca duplica). O rating
é recomputado a partir dos fatos, e o webapp lê o banco no build.

## Monitoramento contínuo

| Script | O que faz |
|---|---|
| `coletor_noticias.py` | Google News RSS por alias + feeds setoriais (`data/feeds.yaml`) → `itens_brutos`; associação por fuzzy matching com fallback Gemini |
| `classificar.py` | Classifica itens associados (Gemini Flash, escalada p/ Pro se confiança < 0.6) → fatos `noticia`/`pessoa` + `eventos` |
| `coletor_vagas.py` | Vagas em ativos digitais: Gupy (`__NEXT_DATA__`) e páginas de carreiras → fatos `vaga` |
| `coletor_site.py` | Snapshot de páginas de produtos/blog/home; diff → Gemini → fatos `site` |
| `rating.py` | Recomputa os 5 pilares (regulatório 30%, atividade 25%, ecossistema 20%, pessoas 15%, solidez 10%); fatos recentes valem 90 dias com decaimento linear |
| `run_monitor.py` | Orquestra o ciclo completo e imprime resumo (itens novos, fatos por tipo, custo Gemini) |

Todos os scripts aceitam `--dry-run` e `--cnpj`, e são **retomáveis**: itens
processados são marcados, falhas ficam pendentes para o próximo ciclo.

```bash
# ciclo completo
.venv/bin/python run_monitor.py

# testes pontuais
.venv/bin/python run_monitor.py --dry-run --cnpj 21246584000150   # Foxbit
.venv/bin/python run_monitor.py --pular noticias,classificar
```

### Automação (GitHub Actions)

`.github/workflows/monitor.yml` roda o ciclo a cada 4 horas e commita o
`data/monitor.db` atualizado — o push dispara o deploy do webapp na Vercel.
Configure o secret **`GEMINI_API_KEY`** no repositório.

## Configuração

1. Python 3.12 em `.venv` (sem pip embutido — use `uv pip install --python .venv/bin/python <pkg>`).
   Dependências: `feedparser trafilatura rapidfuzz httpx google-genai python-dotenv` (+ `polars` no pipeline base).
2. `cp .env.example .env` e preencha `GEMINI_API_KEY`.
3. Curadoria por instituição em `data/monitor_config.csv` (aliases, `gupy_slug`,
   `url_carreiras`, `url_produtos`, `url_blog`) — importe com
   `.venv/bin/python config_monitor.py --importar`.

## Pipeline base (mensal)

`spsav_scraper.py` (universo SPSAV/incumbentes) → `ingest.py` (schema + carga)
→ `grupos.py` / `osint_spsav.py` / `enriquecer_spsav.py` (enriquecimento) →
`rating.py`.

## Webapp

```bash
cd webapp && npm run build   # prebuild copia o data/monitor.db
```

Next.js estático (SSG): home com leaderboard, rankings, feed OSINT e bloco
"últimos 7 dias"; página por CNPJ com radar de pilares, timeline de fatos
filtrável por tipo/período e dados cadastrais.
