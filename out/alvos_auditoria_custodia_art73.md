# Alvos — Auditoria de custódia (Res. BCB 520, art. 73)

Gerado em 2026-09-28 a partir de `data/monitor.db` (tags do enriquecimento Gemini
com Google Search grounding + fatos OSINT). Planilha completa:
`out/alvos_auditoria_custodia_art73.csv`.

## O que a norma exige (base legal)

**Res. BCB nº 520/2025** (DOU 11/11/2025), Capítulo de custódia:

- **Art. 73, caput, X** — o contrato de custódia deve descrever "os mecanismos de
  controles internos adotados pelo custodiante dos ativos virtuais e **da auditoria
  independente a ser realizada sobre o serviço de custódia** de ativos virtuais".
- **Art. 73, § 4º** — a auditoria deve considerar, no mínimo: (I) a guarda do
  instrumento de controle (chaves) e das carteiras; (II) os procedimentos de
  mitigação de riscos da custódia; (III) o funcionamento dos sistemas do
  custodiante; (IV) o tratamento dos eventos do art. 9º, IV (forks, airdrops etc.).
- **Art. 73, § 5º** — "**A auditoria independente de que trata o § 4º deve ser
  realizada, no mínimo, anualmente.**"
- **Art. 73, § 6º + arts. 74 e 75** — quando a PSAV contrata custodiante terceiro,
  ela **compartilha as responsabilidades do custodiante** perante o titular e deve
  avaliar a política de custódia e monitorar continuamente o contratado (incl.
  recepcionar testes de estresse do art. 82). Ou seja: quem terceiriza também
  precisa de asseguração/auditoria sobre o custodiante.

**Quem se enquadra**: qualquer prestadora que ofereça **custódia de ativos
virtuais** (custódia própria → obrigação direta de auditoria independente anual;
custódia terceirizada → dever de avaliar/monitorar a auditoria do custodiante).

---

## Tier 1 — Custódia própria (obrigação direta, art. 73 §§ 4º-5º)

Ordenado por rating. **Evidência** = o que mostrou que a empresa se enquadra.

| # | Empresa (CNPJ) | Rating | Evidência (fonte → o que diz) |
|---|---|---|---|
| 1 | **Foxbit** (21.246.584/0001-50) | 75.6 | Enriquecimento (conf. 1.0): "ecossistema completo de compra, venda e **custódia** de mais de 100 criptoativos"; site foxbit.com.br |
| 2 | **Transfero** (34.882.109/0001-11) | 74.7 | Enriquecimento (conf. 1.0): "soluções para empresas... incluindo pagamentos, **custódia** e tokenização" |
| 3 | **Ripio** (23.351.302/0001-00) | 74.6 | Site oficial (osint_dominio, 2026-09-24): ripio.com menciona custódia; enriquecimento: "plataforma completa para compra, venda, **custódia** e gestão de +100 ativos" |
| 4 | **Onda Finance** (54.049.320/0001-65) | 69.1 | Notícia Livecoins (2026-09-25): "liquidação em stablecoins e **custódia de criptoativos**, primeira SPSAV..." — https://www.livecoins.com.br/onda-finance-primeira-empresa-criptomoedas-autorizacao-banco-central/ |
| 5 | **Avenia** (50.224.164/0001-70) | 68.3 | Tag custódia própria (enriquecimento Gemini grounding) |
| 6 | **Blind Pay** (57.599.376/0001-81) | 68.2 | Enriquecimento (conf. 0.9): infraestrutura de pagamentos com stablecoins + custódia |
| 7 | **Payward/Kraken Brasil** (61.533.076/0001-77) | 68.0 | Enriquecimento (conf. 1.0): entidade brasileira da Kraken — exchange com custódia |
| 8 | **Wynx Finance** (66.643.089/0001-12) | 66.2 | Tag custódia própria (enriquecimento) |
| 9 | **OnilX** (65.024.286/0001-90) | 66.1 | Site onilx.com.br (osint_dominio): menciona custódia; notícia própria sobre alerta CVM cita "intermediação e **custódia** de criptoativos" |
| 10 | **Coinbase Brasil** (22.268.814/0001-44) | 65.8 | Tag custódia própria (enriquecimento) |
| 11 | **GoMoney** (30.359.852/0001-30) | 65.0 | Site gomoney.me (osint_dominio, 2026-09-24): menciona custódia |
| 12 | **ASA Digital Assets** (60.483.028/0001-59) | 64.3 | Site asa.com.br (osint_dominio, 2026-09-25): "menciona custódia, defi, digital assets"; enriquecimento: "custódia segura e gestão de portfólio" |
| 13 | **Bitso Brasil** (51.802.405/0001-84) | 63.9 | Tag custódia própria (enriquecimento) |
| 14 | **Kast** (68.675.443/0001-16) | 63.3 | Tags custódia própria **e** terceirizada — modelo híbrido |
| 15 | **4Pay Finance** (46.977.494/0001-60) | 62.9 | Tag custódia própria (enriquecimento) |
| 16 | **Finbloom Brasil** (60.773.680/0001-08) | 62.5 | Tag custódia própria (enriquecimento) |
| 17 | **Nu Crypto / Nubank** (44.342.498/0001-46) | 61.8 | Notícia (web_osint, 2026-09-25): "plataforma que permite compra, venda e **custódia** de ativos virtuais" |
| 18 | **Bybit SPSAV** (35.491.577/0001-28) | 61.3 | Tag custódia própria (enriquecimento) |
| 19 | **Akin** (34.385.695/0001-99) | 61.0 | Tag custódia própria — ⚠️ alias genérico, validar manualmente |
| 20 | **Santander Investimentos SPSAV** (12.455.479/0001-30) | 59.7 | Tag custódia própria — grupo Santander entrando via SPSAV |
| 21 | **KuCoin Brasil** (61.147.857/0001-23) | 56.6 | Notícia (web_osint, 2026-09-25): "serviços de intermediação e **custódia** de ativos virtuais" |
| 22 | **Itaú SPSAV / Itaú Digital Assets** (62.718.268/0001-10) | 54.6 | Notícia (web_osint, 2026-09-25): "unidade criada em 2022 para tokenização, **custódia** e negociação" — alvo âncora (custódia institucional) |
| 23 | **Ripple Brasil** (31.857.323/0001-20) | 52.3 | Notícia (web_osint): expansão no Brasil com "pagamentos internacionais, **custódia**..." |
| 24 | **BC Access Brasil** (60.441.260/0001-24) | 50.7 | Tag custódia própria (enriquecimento) |
| 25 | **Madison** (64.130.790/0001-02) | 50.7 | Razão social literal: "INTERMEDIACAO E **CUSTODIA** DE ATIVOS VIRTUAIS" — ⚠️ **encerrou atividades em set/2026** (notícia web_osint) |

Demais Tier 1 (tag custódia própria, evidência = enriquecimento Gemini): Americans
Business, MasterPay, Mazzera, Cross Intermediação, Bybit Brasil (2ª entidade),
BlockRiver (OTC institucional + custódia), 1Money Brasil, Sul Grande Digital
("autocustódia" — validar se é custódia de fato), RedotX (Samba), Nexos Global,
TrkBit, Foxbit Invest (OTC do grupo), Arca Eco/BTCBOX, Sphere Brasil.

⚠️ **Excluir/rebaixar**: Madison (encerrada) e **Coinext** (64.5 — anunciou
encerramento do varejo em set/2026 por não adequação ao capital regulatório;
ainda pode precisar de auditoria na transição/migração de custódia).

## Tier 2 — Custódia terceirizada (arts. 73 §6º, 74 e 75 — devem avaliar/monitorar a auditoria do custodiante)

Oportunidade: asseguração da política de custódia + due diligence do custodiante.

| Empresa (CNPJ) | Rating | Evidência |
|---|---|---|
| **Webull SPSAV** (58.277.883/0001-61) | 64.1 | Site webull.com.br menciona custódia/exchange (osint_dominio 2026-09-25) |
| **Inter Digital Assets** (60.442.459/0001-77) | 62.7 | Tag custódia terceirizada — grupo Banco Inter |
| **Velaro Network** (63.964.774/0001-52) | 62.4 | Tag custódia terceirizada (enriquecimento) |
| **Revolut Brasil** (59.505.905/0001-66) | 58.3 | Tag custódia terceirizada (enriquecimento) |
| **Alfred Pay** (63.531.029/0001-10) | 57.5 | Tag custódia terceirizada (enriquecimento) |
| **Ambar Capital** (62.692.862/0001-80) | 55.9 | Tag custódia terceirizada (enriquecimento) |
| **AndX** (62.444.884/0001-20) | 54.7 | Tag custódia terceirizada (enriquecimento) |
| **Oxus** (64.509.594/0001-43) | 54.1 | Tag custódia terceirizada (enriquecimento) |
| (+ Foxbit e Kast, já no Tier 1, também terceirizam parte) | | |

## Tier 3 — Menções de custódia no site sem tag (validar)

Fatos `osint_dominio` com "custodia" no site, mas sem tag de custódia no
enriquecimento — podem ser menções genéricas:

- **Aurex Capital** — aurex.capital menciona "custodia, exchange, stablecoin"
- **AVOI** — avoi.com.br menciona "custodia" entre vários termos
- **Liquid Gold** — liquidgold.com.br menciona "custodia"
- **Lumx** — lumx.io menciona "custodia, defi, exchange" (API de stablecoin)
- **Ponte Global** (63.653.001/0001-55) — notícia: infraestrutura c/ Manteca

## Resumo

- **40 empresas** com custódia própria (obrigação direta de auditoria independente
  **anual** — art. 73, §§ 4º-5º), sendo ~25 com evidência forte (notícia/site).
- **10 empresas** com custódia terceirizada (dever de avaliar a auditoria do
  custodiante — arts. 74-75).
- Alvos âncora sugeridos: **Itaú Digital Assets, Foxbit, Transfero, Ripio,
  Nu Crypto, Payward/Kraken, Coinbase, Bitso, Santander SPSAV** — grandes,
  custódia própria declarada e sob pressão regulatória de autorização.
