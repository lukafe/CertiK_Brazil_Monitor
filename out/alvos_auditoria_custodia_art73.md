# Alvos — Auditoria de custódia (Res. BCB 520, art. 73)

Atualizado em 2026-09-28 a partir de `data/monitor.db`. **Metodologia em 2 passadas**:

1. **Declarado** — enriquecimento Gemini com Google Search grounding + fatos OSINT
   (tags `custodia_propria`/`custodia_terceirizada` e menções de custódia em site/notícia).
2. **Verificado** — passada dedicada (`reclassificar_custodia.py`, tabela
   `custodia_verificacao`) perguntando especificamente *quem detém as chaves* e se há
   *custodiante terceiro nomeado*, exigindo evidência citável e permitindo
   "indeterminado". Resultado: das 40 empresas com custódia própria *declarada*,
   **só 13 foram verificadas como custódia própria de fato**.
3. **Validação manual (2026-09-28)** — as 13 de custódia própria foram checadas
   contra fontes primárias (ToS, políticas de custódia, docs oficiais):
   **11 confirmadas** (Santander confirmada em 2026-09-29 via FAQ oficial
   pós-integração Toro), **Bybit Brasil reclassificada
   para híbrida** (Zodia Custody no institucional) e **Ripple refutada** (vende
   *software* de custódia — os clientes detêm as chaves). Saldo final:
   **11 própria · 4 híbridas · 15 terceirizadas · 18 indeterminadas · 5 fora de escopo**.

Versão web: https://certik-monitor-brasil.vercel.app/custodia

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

---

## Tier 1 — Custódia própria VERIFICADA + VALIDADA (11 — obrigação direta, art. 73 §§ 4º-5º)

Ordenado por rating. **Validação** = checagem manual contra fonte primária
(2026-09-28). Ripple e Bybit Brasil saíram deste tier após a validação.

| # | Empresa (CNPJ) | Rating | Validação | Chaves/tecnologia | Evidência (fonte primária) |
|---|---|---|---|---|---|
| 1 | **Transfero** (34.882.109/0001-11) | 74.7 | ✅ confirmada | Fireblocks (como ferramenta) | Custódia "powered by Fireblocks" (transfero.com/solutions/crypto-infrastructure) — modelo direct custody |
| 2 | **Ripio** (23.351.302/0001-00) | 74.6 | ✅ c/ ressalva | MPC próprio | ToS: chaves "controladas pela Ripio e/ou afiliadas **e/ou terceiros**" (terms.ripio.com/br/wallet) — cláusula de possível sub-custódia |
| 3 | **Onda Finance** (54.049.320/0001-65) | 69.1 | ✅ confirmada | Fireblocks (como ferramenta) | Case oficial Fireblocks: wallet management institucional (fireblocks.com/customers/onda-finance) |
| 4 | **Payward/Kraken Brasil** (61.533.076/0001-77) | 68.0 | ✅ confirmada | própria | ToS Brasil: "shared blockchain addresses that they control" (kraken.com/legal/br-terms) |
| 5 | **OnilX** (65.024.286/0001-90) | 66.1 | ✅ confirmada | própria | "Possui custódia própria de ativos digitais" (onilx.com.br/onilx-e-exchange) |
| 6 | **Coinbase Brasil** (22.268.814/0001-44) | 65.8 | ✅ confirmada (grupo, revalidada 2026-09-29) | grupo Coinbase | Política legal própria: "Coinbase retains control over electronic private keys" (help.coinbase.com, legal-policies); custódia pela Coinbase, Inc. (Delaware, mesmo grupo) |
| 7 | **ASA Digital Assets** (60.483.028/0001-59) | 64.3 | ✅ confirmada | grupo ASA | "A custódia dos seus ativos será feita pelo ASA... carteiras segregadas" (asa.com.br/digital-assets) |
| 8 | **Bitso Brasil** (51.802.405/0001-84) | 63.8 | ✅ confirmada | MPC próprio (+ Coincover) | Coincover é explicitamente "non-custodial disaster recovery" integrado à infra MPC da Bitso |
| 9 | **Santander SPSAV** (12.455.479/0001-30) | 59.7 | ✅ confirmada (2026-09-29) | própria intra-grupo (closed-loop) | FAQ oficial pós-integração Toro: BTC/ETH direto no app, compras/vendas só em reais, sem depósito/saque cripto → grupo detém as chaves (ajuda.santandercorretora.com.br, art. 46842571446043) |
| 10 | **Itaú SPSAV / Itaú Digital Assets** (62.718.268/0001-10) | 54.6 | ✅ confirmada | infra própria (AWS Nitro Enclaves) | Case oficial AWS: chaves protegidas em Nitro Enclaves, stack próprio de custódia; "custódia própria" no íon |
| 11 | **1Money Brasil** (63.083.006/0001-90) | 54.3 | ✅ provisória | TSS-MPC próprio | "Regulated custody powered by TSS-MPC" (1money.com) — nenhum custodiante terceiro nomeado |

## Tier 1b — Modelo híbrido VERIFICADO (4 — obrigações dos dois lados)

| Empresa (CNPJ) | Rating | Conf. | Custodiante | Evidência |
|---|---|---|---|---|
| **Nu Crypto / Nubank** (44.342.498/0001-46) | 61.7 | 1.0 | Fireblocks | T&C: custódia pelo próprio Nubank OU custodiantes terceiros; parceria Fireblocks |
| **Bybit SPSAV** (35.491.577/0001-28) | 61.2 | 0.9 | Anchorage Digital (bbSOL) | Chaves próprias (multi-sig/TEE/TSS) + Anchorage para ativos específicos |
| **KuCoin Brasil** (61.147.857/0001-23) | 56.6 | 0.9 | BitGo (institucional) | ToS admite custodiante contratado; off-exchange com BitGo para institucional |
| **Bybit Brasil** (66.739.170/0001-09) | 55.8 | validada | Zodia Custody (institucional) | ⬇ do Tier 1 na validação manual: varejo com chaves próprias (multisig Safe + Ledger); institucional pode manter ativos na Zodia |

## Tier 2 — Custódia terceirizada VERIFICADA (15 — arts. 73 §6º, 74-75)

Oportunidade: asseguração da política de custódia + due diligence do custodiante.

| Empresa (CNPJ) | Rating | Conf. | Custodiante | Evidência |
|---|---|---|---|---|
| **Foxbit** (21.246.584/0001-50) | 75.6 | 0.9 | BitGo + Fireblocks | Declara custódia "garantida pelos maiores custodiantes do mundo: Fireblocks e BitGo" |
| **Lumx** (42.887.120/0001-00) | 68.7 | 1.0 | parceiros regulados | Aviso de privacidade: "não exerce custódia sobre os ativos" das carteiras custodiais |
| **Avenia** (50.224.164/0001-70) | 68.3 | 0.9 | Avenue Cash LLC | Política de custódia nomeia a Avenue Cash LLC como contratada |
| **Blind Pay** (57.599.376/0001-81) | 68.2 | 0.7 | payment vendors | Declara não deter fundos; custódia via "Payment Vendors" |
| **Coinext** (29.242.868/0001-80) | 64.4 | 0.9 | BitGo (+ Fireblocks) | "Carteira assegurada BitGo™" com seguro — ⚠️ encerrando varejo (set/2026) |
| **Webull SPSAV** (58.277.883/0001-61) | 64.1 | 1.0 | Coinbase, Inc. / Prime | Custódia "integral e exclusivamente pela Coinbase, Inc." |
| **Kast** (68.675.443/0001-16) | 63.3 | 1.0 | BitGo | ToS: custódia por parceiros licenciados como BitGo |
| **Inter Digital Assets** (60.442.459/0001-77) | 62.7 | 1.0 | B3 Digitas | Blog do Inter: "A custódia dos Criptoativos fica na parceira, B3 Digitas" |
| **Velaro Network** (63.964.774/0001-52) | 62.4 | 0.9 | terceiro (escrow) | "Secures funds in escrow via third-party custody" |
| **Akin** (34.385.695/0001-99) | 61.0 | 0.8 | provedores de infra | Política de privacidade cita "provedores de infraestrutura e custódia" |
| **Revolut Brasil** (59.505.905/0001-66) | 58.3 | 1.0 | custodiantes nomeados | Declara nomear custodiantes terceirizados para as chaves dos clientes |
| **Ambar Capital** (62.692.862/0001-80) | 55.8 | 1.0 | BitGo | Declara que ativos não ficam sob custódia direta; BitGo responsável |
| **Oxus** (64.509.594/0001-43) | 54.0 | 1.0 | VASPs parceiros | ToS: não detém custódia; carteiras mantidas por VASPs licenciados |
| **RedotX (Samba)** (62.279.050/0001-07) | 51.2 | 1.0 | Cactus Custody (HK) | Custódia institucional na Cactus Custody, carteiras segregadas + seguro |
| **Foxbit Invest** (18.997.925/0002-03) | 47.3 | 0.9 | Fireblocks + BitGo | ToS: custódia assegurada por Fireblocks e BitGo |

## Tier 3 — Custódia declarada, modelo NÃO VERIFICADO (18 — em escopo do art. 73)

Oferecem/indicam custódia mas a gestão de chaves não é pública. A conversa de
descoberta começa com: *quem guarda suas chaves?*

| Empresa (CNPJ) | Rating | Conf. | Situação |
|---|---|---|---|
| **Wynx Finance** (66.643.089/0001-12) | 66.2 | 0.6 | Plataforma implica custódia; chaves não divulgadas |
| **GoMoney** (30.359.852/0001-30) | 65.0 | 0.7 | ToS menciona storage na conta GoMoney; modelo não divulgado |
| **AVOI** (55.063.975/0001-50) | 64.3 | 0.7 | Compra/venda de cripto; políticas não detalham chaves |
| **Finbloom Brasil** (60.773.680/0001-08) | 62.5 | 0.6 | Site: "armazenamento seguro de criptoativos" |
| **Americans Business** (64.797.796/0001-38) | 59.0 | 0.1 | ⚠️ Site com cold wallet/multi-sig é de OUTRO CNPJ (Americans Intermediações) |
| **MasterPay** (61.575.252/0001-33) | 58.6 | 0.6 | USDT em carteira segregada; chaves não divulgadas |
| **Mazzera** (49.786.191/0001-58) | 57.5 | 0.4 | Carteiras segregadas; chaves não divulgadas |
| **Cross Intermediação** (52.006.135/0001-68) | 56.1 | 0.4 | "Carteira digital"; sem detalhe público |
| **BlockRiver** (32.113.577/0001-04) | 55.6 | 0.7 | Segregação patrimonial per Res. 520; chaves não divulgadas |
| **AndX** (62.444.884/0001-20) | 54.7 | 0.4 | BitGo citado só para a ANDX USA LLC, não para a entidade BR |
| **Ponte Global** (63.653.001/0001-55) | 52.4 | 0.7 | "Custódia de fundos regulada" via Manteca; modelo não explícito |
| **Nexos Global/IKKB** (59.799.474/0001-98) | 51.4 | 0.6 | Custódia via "parceiros"; sem nome/modelo |
| **Madison** (64.130.790/0001-02) | 50.7 | 0.6 | ⚠️ Encerrou atividades set/2026; ativos "sob custódia" até o fim |
| **BC Access Brasil** (60.441.260/0001-24) | 50.6 | 0.7 | Subsidiária Blockchain.com; modelo BR não divulgado |
| **TrkBit** (41.586.874/0001-50) | 49.8 | 0.6 | Corretagem implica guarda; sem detalhe |
| **Arca Eco/BTCBOX** (12.541.463/0001-40) | 45.8 | 0.1 | ⚠️ Nada citável encontrado para este CNPJ |
| **Liquid Gold** (63.539.643/0001-28) | 43.8 | 0.2 | ⚠️ Projeto "tokenized gold" não vinculável ao CNPJ |
| **Sphere Brasil** (63.593.618/0001-22) | 42.9 | 0.6 | API de pagamentos declara "custódia"; modelo não detalhado |

## Fora de escopo provável (5 — verificação não achou guarda de ativos de clientes)

| Empresa (CNPJ) | Rating | Conf. | Motivo |
|---|---|---|---|
| **Aurex Capital** (60.723.612/0001-34) | 64.2 | 0.9 | ToS: "não detém fundos de clientes"; nunca pede chaves privadas |
| **Ripple Brasil** (31.857.323/0001-20) | 52.3 | 0.9 | ⬇ REFUTADA na validação manual: vende *software* de custódia — "your keys run in your own infrastructure; Ripple can't sign, freeze, or access them". ⚠️ Pediu licença de PSAV (mar/2026): pode virar custodiante — monitorar |
| **4Pay Finance** (46.977.494/0001-60) | 62.9 | 1.0 | Ativos vão direto para carteira do cliente (autocustódia) |
| **Alfred Pay** (63.531.029/0001-10) | 57.4 | 1.0 | ToS: não atua como custodiante ou provedor de carteiras |
| **Sul Grande Digital** (61.461.894/0001-01) | 52.5 | 0.9 | Negociação com autocustódia — cliente guarda as chaves |

## Resumo

- **11 com custódia própria verificada E validada manualmente** → obrigação direta
  de auditoria independente **anual** (art. 73, §§ 4º-5º). Alvos âncora:
  **Kraken/Payward, Itaú, Coinbase, Bitso, Ripio, Transfero, Santander** — grandes,
  com evidência primária (ToS/docs) de que detêm as chaves.
- **4 híbridas** (Nubank, Bybit SPSAV, KuCoin, Bybit Brasil) → dupla frente:
  auditoria da custódia própria + avaliação do custodiante terceiro.
- **15 terceirizadas verificadas** → asseguração da política de custódia e due
  diligence do custodiante (arts. 74-75). Custodiantes recorrentes: **BitGo** (6x),
  **Fireblocks** (4x), Coinbase Prime, B3 Digitas, Cactus Custody, Zodia.
- **18 indeterminadas** → em escopo do art. 73 (declaram custódia), mas gestão de
  chaves não pública — segunda onda de prospecção; o gap de transparência é em si
  um argumento de venda da auditoria.
- **5 fora de escopo provável** (Aurex, 4Pay, Alfred Pay, Sul Grande, **Ripple**) —
  autocustódia/liquidação imediata/fornecedor de software; removidas da lista de
  alvos. Ripple em watchlist (pedido de licença PSAV mar/2026).
- ⚠️ Rebaixar/observar: **Madison** (encerrada set/2026) e **Coinext** (encerrando
  varejo — auditoria ainda relevante na transição/migração da custódia).

*Validação manual (2026-09-28) feita sobre fontes primárias indexadas (ToS,
políticas de custódia, cases oficiais AWS/Fireblocks/Coincover). Pendências
resolvidas em 2026-09-29: (1) Santander — FAQ oficial da Santander Corretora
(pós-integração Toro) confirma BTC/ETH direto no app em modelo closed-loop
(compras/vendas só em reais, sem depósito/saque cripto), i.e. o grupo detém as
chaves; entidade legal custodiante exata não divulgada. (2) Coinbase — política
legal própria ("What does Coinbase do with my digital assets") declara que a
Coinbase mantém controle das chaves privadas das carteiras hospedadas; custódia
pela Coinbase, Inc. (Delaware, mesmo grupo).*
