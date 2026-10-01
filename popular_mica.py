"""
Popula a tabela `mica_licencas` — grupos do universo com autorização MiCA na UE.

Fonte: pesquisa web 2026-09-30 (registro interino ESMA, reguladores nacionais,
anúncios oficiais e imprensa especializada). Verificação manual recomendada
antes de uso regulatório. Rode novamente após editar DADOS (idempotente).

Uso: .venv/bin/python popular_mica.py
"""
from __future__ import annotations

import sqlite3
from pathlib import Path

DB = Path("data/monitor.db")

# (cnpj, grupo, entidade_ue, tipo, pais, regulador, data_autorizacao, status, fonte_url, confianca, observacao)
DADOS = [
    ("22268814000144", "Coinbase", "Coinbase Luxembourg S.A.", "CASP", "Luxemburgo", "CSSF",
     "2025-06-20", "autorizada",
     "https://www.amf-france.org/en/warnings/white-lists/daspcasp/coinbase-luxembourg-sa", 0.95,
     "Hub europeu em Luxemburgo; consta na white list CASP da AMF."),
    ("61533076000177", "Kraken (Payward)", "Payward Europe Solutions Limited", "CASP", "Irlanda",
     "Central Bank of Ireland", "2025-06-25", "autorizada",
     "https://www.businesswire.com/news/home/20250625529871/en/Kraken-Secures-MiCA-License-from-Central-Bank-of-Ireland-Cementing-Leadership-in-European-Crypto-Markets",
     0.95, "Duas entidades irlandesas autorizadas; grupo detém EMI/MiFID separadas."),
    ("66739170000109", "Bybit", "Bybit EU GmbH", "CASP", "Áustria", "FMA",
     "2025-05-28", "autorizada",
     "https://www.fma.gv.at/en/granting-of-authorisation-bybit-eu-gmbh/", 0.95,
     "Autorização art. 63 MiCAR confirmada pela FMA; Bybit Payments GmbH tem EMI adicional."),
    ("35491577000128", "Bybit", "Bybit EU GmbH", "CASP", "Áustria", "FMA",
     "2025-05-28", "autorizada",
     "https://www.fma.gv.at/en/granting-of-authorisation-bybit-eu-gmbh/", 0.95,
     "Segunda entidade Bybit no Brasil; mesma licença do grupo na UE."),
    ("68837035000113", "Circle", "Circle Internet Financial Europe SAS", "EMI (EMT: USDC/EURC) + CASP",
     "França", "ACPR (EMI) / AMF (CASP)", "2024-07-01", "autorizada",
     "https://www.circle.com/pressroom/circle-is-first-global-stablecoin-issuer-to-comply-with-mica-eus-landmark-crypto-law",
     0.9, "Primeiro emissor global de stablecoin conforme MiCA (jul/2024); CASP pela AMF em abr/2026."),
    ("46532664000100", "Gate Group", "Gate Technology Ltd (Gate Europe)", "CASP", "Malta", "MFSA",
     "2025-09-29", "autorizada",
     "https://www.theblock.co/press-releases/373025/gate-group-announces-gate-technology-ltd-received-the-mica-license-from-malta-financial-services-authority-mfsa-extends-its-compliance-footprint-in-europe",
     0.85, "CASP em Malta cobrindo 6 serviços; Payment Institution (PSD2) em fev/2026."),
    ("61147857000123", "KuCoin", "KuCoin EU Exchange GmbH", "CASP", "Áustria", "FMA",
     "2025-11-27", "autorizada",
     "https://www.coindesk.com/policy/2025/11/28/crypto-exchange-kucoin-s-european-arm-wins-mica-license-in-austria",
     0.85, "ATENÇÃO: FMA proibiu onboarding de novos clientes em fev/2026 (falhas AML/compliance) — licença vigente, operação restrita."),
    ("59505905000166", "Revolut", "Revolut Digital Assets Europe Ltd", "CASP", "Chipre",
     "CySEC (nº 001/2025)", "2025-10-23", "autorizada",
     "https://www.coindesk.com/policy/2025/10/23/revolut-secures-mica-license-in-cyprus-expanding-regulated-crypto-services-across-europe",
     0.9, "Passaporte para os 30 países do EEE; plataforma Crypto 2.0."),
    ("63083023000127", "Keyrock", "Keyrock FR SAS", "CASP", "França", "AMF (A2026-017)",
     "2026-06-12", "autorizada",
     "https://www.amf-france.org/en/warnings/white-lists/casp/keyrock-fr-sas", 0.95,
     "Market maker autorizado via entidade francesa; consta na white list da AMF."),
    ("62845739000151", "OSL Group", "OSL EU1 (Áustria) + EU Internet Ventures B.V. (Holanda, via Banxa)",
     "CASP", "Áustria / Holanda", "FMA / AFM", "2026-07", "autorizada",
     "https://fintechnews.hk/39630/blockchain/osl-group-micar-authorisation-austria/", 0.8,
     "Grupo de HK; segunda licença na Holanda herdada da aquisição da Banxa (jan/2026)."),
    ("31857323000120", "Ripple", "Ripple (entidade luxemburguesa)", "CASP + EMI", "Luxemburgo", "CSSF",
     "2026-07-06", "autorizada",
     "https://ripple.com/ripple-press/ripple-receives-full-eu-mica-casp-license/", 0.85,
     "Aprovação preliminar (jun/2026) elevada a autorização CASP plena; EMI já detida."),
    ("58277883000161", "Webull", "Webull EU (unidade holandesa)", "CASP", "Holanda", "AFM",
     "2026", "autorizada",
     "https://www.financemagnates.com/cryptocurrency/webull-eu-secures-mica-authorisation-as-eu-targets-post-regulation-gaps/",
     0.7, "Autorização obtida mas operação na UE ainda não lançada; aguardava passaporte."),
    ("12455479000130", "Santander (Openbank)", "Open Bank, S.A. (Openbank)", "CASP", "Espanha",
     "CNMV / Banco de España", "2025-07", "autorizada",
     "https://www.santander.com/en/press-room/press-releases/2025/09/openbank-launches-cryptocurrency-trading-service",
     0.75, "Openbank (grupo Santander) com licença MiCA espanhola; trading cripto lançado na Alemanha via passaporte (set/2025)."),
]


def main() -> None:
    con = sqlite3.connect(DB)
    con.execute(
        """CREATE TABLE IF NOT EXISTS mica_licencas (
             cnpj TEXT PRIMARY KEY,
             grupo TEXT NOT NULL,
             entidade_ue TEXT,
             tipo TEXT,
             pais TEXT,
             regulador TEXT,
             data_autorizacao TEXT,
             status TEXT,
             fonte_url TEXT,
             confianca REAL,
             observacao TEXT,
             atualizado_em TEXT DEFAULT (datetime('now'))
           )""")
    for row in DADOS:
        con.execute(
            """INSERT INTO mica_licencas
               (cnpj, grupo, entidade_ue, tipo, pais, regulador, data_autorizacao, status,
                fonte_url, confianca, observacao, atualizado_em)
               VALUES (?,?,?,?,?,?,?,?,?,?,?,datetime('now'))
               ON CONFLICT(cnpj) DO UPDATE SET grupo=excluded.grupo, entidade_ue=excluded.entidade_ue,
                 tipo=excluded.tipo, pais=excluded.pais, regulador=excluded.regulador,
                 data_autorizacao=excluded.data_autorizacao, status=excluded.status,
                 fonte_url=excluded.fonte_url, confianca=excluded.confianca,
                 observacao=excluded.observacao, atualizado_em=excluded.atualizado_em""",
            row)
    con.commit()
    n = con.execute("SELECT COUNT(*) FROM mica_licencas").fetchone()[0]
    orfas = con.execute(
        "SELECT cnpj FROM mica_licencas WHERE cnpj NOT IN (SELECT cnpj FROM instituicoes)").fetchall()
    print(f"{n} licenças MiCA gravadas | CNPJs fora do universo: {[r[0] for r in orfas] or 'nenhum'}")
    con.close()


if __name__ == "__main__":
    main()
