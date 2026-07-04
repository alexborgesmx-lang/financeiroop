# DICIONÁRIO DE NEGÓCIOS — FinanceiroOp

Fonte oficial de termos e definições de negócio.
Toda análise, implementação ou refatoração deve respeitar estas definições.

---

## Cliente

Pessoa física que contrata empréstimo pessoal com a Borges Assessoria.

Possui cadastro único no sistema (aba CLIENTES).

Status possíveis: `aguardando_conferencia`, `ativo`, `inativo`, `bloqueado`.

---

## Perfil de Cobrança (PERFIL_COBRANCA)

Avaliação comportamental de como o cliente reage à cobrança — campo em CLIENTES.

Valores:

| Valor | Cor | Significado |
|---|---|---|
| COOPERATIVO | GRN (verde) | Responde às mensagens, cumpre promessas, tem boa-fé |
| NEUTRO | MUTED (cinza) | Resposta irregular, sem padrão claro |
| RESISTENTE | ORG (laranja) | Dificulta o contato, esquiva mas eventualmente paga |
| EVASIVO | RED (vermelho) | Não responde, some, risco elevado de prejuízo |

Editável no ClienteModal. Exibido como badge no ContratoModal e PerdaAcoesModal.

---

## Contrato

Acordo formal de empréstimo entre cliente e operação.

Possui parcelas vinculadas, prazo definido e taxa de juros.

---

## Contrato Ativo

São considerados contratos ativos:

- `ativo_em_dia`
- `ativo_em_atraso`
- `em_cobranca`
- `pre_prejuizo`
- `em_recuperacao`
- **`acordo_assistido`** — tratamento especial, mantém o cliente como ativo sem cobrança

Não são considerados ativos:

- `quitado`
- `cancelado`
- `baixado_como_prejuizo` definitivo

---

## Parcela

Unidade de pagamento periódico de um contrato.

Possui número, valor, data de vencimento e status.

Status terminais (nunca reabrir): `pago`, `quitacao_antecipada`, `baixado_como_prejuizo`, `cancelado`, `renegociado`.

**Parcelas em Acordo Assistido:** permanecem com status `atrasado` no Sheets. O sistema as exclui da aba Cobrança via filtro pelo STATUS_CONTRATO, não pelo status da parcela.

---

## Pagamento

Registro de valor recebido vinculado a cliente, contrato e parcela.

**Exceção — Abatimento Assistido:** o registro em PAGAMENTOS não tem vínculo com parcela específica (ID_PARCELA vazio). Rastreabilidade é mantida via ID_CONTRATO e TIPO_PAGAMENTO = `abatimento_acordo_assistido`.

---

## Pagamento Parcial

Pagamento inferior ao valor da parcela. Não encerra a parcela automaticamente. Saldo remanescente continua sendo controlado.

---

## Saldo Devedor

Valor que ainda falta ser recebido pela operação. Nunca pode ser negativo.

**Em Acordo Assistido:**
`Saldo Devedor = soma das parcelas abertas − VALOR_ABATIDO_ASSISTIDO`

---

## Antecipação / Quitação Antecipada

Liquidação do saldo devedor antes do vencimento final. Reduz saldo devedor e encerra o contrato.

Pode acontecer por dois canais: manual (Alex registra no ContratoModal) ou **via PIX** (2026-07-04) — o sistema gera uma proposta com TXID fixo por contrato, o cliente paga direto pelo PIX, e a Efí Bank confirma via webhook. Ambos os canais aplicam a mesma fórmula de desconto (ver `03-AI-FINANCIAL-CALCULATIONS.md`).

---

## Certificado de Quitação (2026-07-04)

Comprovante digital com link público, gerado automaticamente sempre que um contrato quita (por qualquer via). Mostra nome do cliente, valor total pago, data de quitação e CPF mascarado — nunca dados sensíveis completos. Enviado automaticamente por WhatsApp. Cada contrato tem apenas um certificado ativo (reenvio reaproveita o mesmo link).

---

## Renegociação

Revisão das condições do contrato ativo. Preserva histórico e rastreabilidade.

---

## Cobrança

Estado operacional de acompanhamento de parcelas em atraso. Não altera valores financeiros históricos.

**Exclusões da fila de Cobrança:** contratos em `acordo_assistido` e contratos com status terminal não aparecem na fila.

---

## Recuperação

Recebimento após baixa como prejuízo. Deve permanecer identificável para fins gerenciais.

Contabilizado como **Capital Recuperado** — não como receita.

---

## Acordo Assistido

Status especial de contrato para clientes que perderam renda temporariamente mas mantêm boa comunicação e intenção de pagar.

**Regras:**
- STATUS_CONTRATO = `"acordo_assistido"`
- Contrato some da aba Cobrança e de parcelasAtrasadas
- Parcelas abertas permanecem como estão no Sheets
- Score do cliente fica **congelado** — não penaliza na entrada, no abatimento ou na permanência
- Trigger diário não reverte o status (só aplica regra dos 180 dias)
- Contrato aparece na aba Perdas & Recuperação e no card "Acordo Assistido" do Dashboard

**Ciclo de vida:**
1. `moverParaAcordoAssistido` — entrada; inicializa VALOR_ABATIDO_ASSISTIDO = 0
2. `registrarAbatimentoAssistido` — pagamento livre, 100% capital
3. `sairDoAcordoAssistido` — saída manual ("normal" → recalcula status por dias; "baixa" → baixarContratoPrejuizo)
4. Expiração automática: 180 dias sem abatimento → `pre_prejuizo` (evento ACORDO_ASSISTIDO_EXPIRADO)

**Campos novos em CONTRATOS:**
- `DATA_ENTRADA_ACORDO_ASSISTIDO`
- `MOTIVO_ACORDO_ASSISTIDO` (Demissão / Afastamento INSS / Problema de saúde / Redução de renda / Outro)
- `OBSERVACAO_ACORDO_ASSISTIDO`
- `VALOR_ABATIDO_ASSISTIDO` (contador acumulado, incrementado a cada abatimento)

**Cor UI:** BLU = "#1B8A8F" para todos os elementos visuais do Acordo Assistido.

---

## Abatimento Assistido (abatimento_acordo_assistido)

Pagamento livre realizado durante o Acordo Assistido.

**Regras críticas:**
- Qualquer valor — sem vínculo com parcela específica
- 100% do valor vai para capital (nunca contabilizado como receita)
- TIPO_PAGAMENTO = `"abatimento_acordo_assistido"` em PAGAMENTOS
- Incrementa VALOR_ABATIDO_ASSISTIDO no contrato
- Score do cliente NÃO é recalculado
- Dashboard e Financeiro excluem explicitamente este tipo do total de receita

---

## Capital Recuperado Assistido

Soma de todos os abatimentos realizados durante o Acordo Assistido (VALOR_ABATIDO_ASSISTIDO).

É o valor de capital que retornou ao operador durante o período de assistência.

**Distinção contábil obrigatória:**
| Tipo | Conta como |
|---|---|
| Parcela paga (normal) | Receita |
| Abatimento Assistido | Capital Recuperado (nunca receita) |
| Recuperação após baixa | Capital Recuperado (nunca receita) |

---

## Lucro Potencial Remanescente (LUCRO_POTENCIAL_REMANESCENTE)

Soma de VALOR_JUROS de todas as parcelas abertas de um contrato em `acordo_assistido`.

É um campo **calculado** (não armazenado no Sheets) — indica o lucro potencial que o operador pode realizar se o cliente se recuperar e pagar todas as parcelas.

Exibido como "Juros suspensos (potencial)" no ContratoModal e AbatimentoAssistidoModal, em cor ORG.

---

## Higienização Cadastral (API Roadmap — 2026-06-20)

Enriquecimento automático dos dados do cliente via APIs externas, disparado no ClienteModal ao preencher o CEP ou CNPJ do empregador.

**Campos preenchidos automaticamente:**

| Campo | Fonte | Impacto no Score |
|---|---|---|
| `RUA`, `SETOR`, `CIDADE_ESTADO` | ViaCEP / BrasilAPI / AwesomeAPI | Nenhum |
| `CODIGO_IBGE` | ViaCEP (campo `ibge`) | Nenhum |
| `LATITUDE`, `LONGITUDE` | AwesomeAPI (nativo) ou Nominatim (fallback) | Nenhum |
| `CNPJ_EMPREGADOR` | Manual — usuário digita no ClienteModal | Nenhum |
| `SITUACAO_EMPREGADOR` | BrasilAPI/ReceitaWS via `/api/cnpj` | **−5 pts** se não "ATIVA" |
| `DATA_ABERTURA_EMPREGADOR` | BrasilAPI/ReceitaWS via `/api/cnpj` | **+2 pts** se ≥5 anos |

**Cadeia de fallback do CEP:**
1. ViaCEP → retorna `ibge`, sem coordenadas
2. BrasilAPI → sem `ibge`, sem coordenadas
3. AwesomeAPI → sem `ibge`, **com** `lat`/`lng` nativos

**Geocoding:**
- Se AwesomeAPI resolveu o CEP: usa `lat`/`lng` direto (sem Nominatim)
- Se ViaCEP ou BrasilAPI resolveu: dispara Nominatim em background (fire-and-forget)

---

## Recuperação Judicial (2026-07-04)

Fase do contrato após ajuizamento (`STATUS_CONTRATO = "em_processo_judicial"`). **Não é status final** — é o início de um novo ciclo de vida, com duas dimensões independentes:

- `STATUS_PROCESSO` — situação do processo (EM_PREPARACAO, AJUIZADO, ARQUIVADO...).
- `SITUACAO_FINANCEIRA_JUDICIAL` — situação financeira (EM_ABERTO, ACORDO_PARCELADO_ATIVO, QUITADO_JUDICIALMENTE, RECUPERADO_PARCIAL, PERDA_JUDICIAL_DEFINITIVA).

Só vira o status terminal `encerrado_judicialmente` quando a dívida é resolvida (quitação/acordo pago) ou o processo é arquivado sem recuperação total.

**Recebimentos judiciais** seguem cascata de alocação: custos do credor primeiro, depois principal, depois lucro; honorários/custas pagos pelo devedor são reembolso neutro (nem lucro, nem capital). Ver `03-AI-FINANCIAL-CALCULATIONS.md`.

**Bloqueio de crédito é permanente** — `CLIENTE_JUDICIALIZADO = "SIM"` nunca é revertido, mesmo com quitação total do processo. Ver `02-AI-CREDIT-RULES.md`.

---

## Padrinho

Cliente que indicou outro cliente. Referenciado no cadastro pelo nome. Lookup fuzzy por substring + normalização de acentos.

---

## Lead

Potencial cliente captado pelo bot WhatsApp. Estados: `EM_ANDAMENTO`, `FORMULARIO_ENVIADO`, `REPROVADO`, `COMPLETO`.

---

## Histórico Financeiro

Nenhum registro financeiro pode ser removido fisicamente.

Correções devem ocorrer por:

- Estorno
- Cancelamento lógico
- Ajuste auditável

Todo evento financeiro deve permanecer rastreável.

---

## PDD — Provisão para Devedores Duvidosos

**Implementado v1.0 — Jun/2026. Aba Carteira do frontend.**

PDD gerencial (não contábil) — gestão de risco interna, não reserva de caixa. Distribui o impacto do prejuízo ao longo do tempo.

**Percentuais v1.0** (calibrados sobre histórico real — 216 contratos, perda líquida 1,42%):

| Faixa | % Provisão |
|---|---|
| Em dia / 1–30 dias | 0% |
| 31–60 dias | 10% |
| 61–90 dias | 35% |
| 91–120 dias | 60% |
| 121–180 dias | 85% |
| 181+ dias | 100% |

**Carteira Ajustada** = Saldo Devedor − PDD total  
**Cobertura PDD** = PDD total ÷ Perda Histórica Líquida (R$ 7.275)

Próxima revisão de percentuais: 50 contratos encerrados ou Dez/2026.

Ver detalhes técnicos em `03-AI-FINANCIAL-CALCULATIONS.md`.
