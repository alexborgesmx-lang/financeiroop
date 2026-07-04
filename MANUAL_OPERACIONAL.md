# Manual Operacional e Estratégico — Borges Assessoria

> **Operador:** Alex Borges (alexborges.mx@gmail.com)
> **Referência:** 2026-06-14
> **Natureza:** Financeira informal de crédito pessoal. Capital 100% próprio.

---

## 1. O Negócio

**Borges Assessoria** empresta dinheiro próprio para trabalhadores com carteira assinada (CLT), cobra juros mensais, gerencia parcelas e recebe via PIX. O modelo é completamente informal — sem CNPJ de crédito, sem investidores, sem banco. Todo o risco e capital são do proprietário.

**Público-alvo:** Trabalhadores CLT captados exclusivamente por indicação de clientes existentes (modelo padrinho/madrinha).

**Receita:** Juros sobre principal emprestado. Receita adicional em pagamentos com atraso (juros/multa).

**Moeda:** BRL. **Fuso:** UTC-3 (Brasil).

---

## 2. Fluxo Completo da Operação

```
CAPTAÇÃO → CADASTRO → APROVAÇÃO → CONTRATO → CARNÊ PIX → PAGAMENTOS → QUITAÇÃO
                                                                    ↓
                                                             INADIMPLÊNCIA → RECUPERAÇÃO
                                                                    ↓
                                                          ACORDO ASSISTIDO (dificuldade temporária)
```

### 2.1 Captação

- Leads chegam por indicação direta (WhatsApp, pessoalmente).
- Requisito obrigatório: **CLT** (carteira assinada). Sem CLT, reprovado imediatamente.
- Requisito de indicação: lead deve informar nome de um cliente existente como **padrinho**. O padrinho precisa ter ao menos um contrato quitado para qualificar.
- Limite no primeiro empréstimo: **R$ 1.500**.
- Prazo: de **1x a 12x**.
- Bot de triagem via WhatsApp (Evolution API + Claude AI) — em implementação (Fase 1B).

### 2.2 Cadastro

- Alex abre o FinanceiroOp → aba **Clientes** → novo cadastro manual, ou o cliente preenche o **Google Form**.
- Quando via formulário: trigger automático no Google Apps Script cria linha em CLIENTES com `STATUS_CLIENTE = aguardando_conferencia`.
- Alex confere os dados no ClienteModal → preenche campos faltantes → salva → status vira `ativo`.
- Na primeira aprovação, a observação padrão "Cadastro via formulário..." é apagada automaticamente.

**Campos do cadastro:**
| Campo | Regra |
|---|---|
| NOME | Title case, sem dígitos |
| CPF | Somente dígitos, 11 caracteres |
| RG | Somente dígitos |
| TELEFONE_WPP | Somente dígitos, 11 dígitos (DDD + 9 dígitos) |
| EMAIL | Lowercase, sem espaços |
| DIA_VENCIMENTO_PREFERIDO | Número 1–31 (dia do mês) |
| PADRINHO | Nome do cliente que indicou |
| TEL_PADRINHO | Preenchido automaticamente por fuzzy match no onFormSubmit |
| QUALIDADE_COMUNICACAO | Boa / Regular / Ruim |
| PERFIL_COBRANCA | COOPERATIVO / NEUTRO / RESISTENTE / EVASIVO — avaliação comportamental |
| STATUS_CLIENTE | `aguardando_conferencia` → `ativo` → `bloqueado` / `inativo` |
| CEP | Preenchido manualmente ou via Google Form. onBlur dispara busca automática → preenche RUA, SETOR, CIDADE_ESTADO, CODIGO_IBGE, LATITUDE, LONGITUDE |
| CNPJ_EMPREGADOR | CNPJ do empregador preenchido no ClienteModal → API BrasilAPI/ReceitaWS preenche SITUACAO_EMPREGADOR e DATA_ABERTURA_EMPREGADOR automaticamente |
| CODIGO_IBGE | Código IBGE do município — preenchido automaticamente junto com o CEP via ViaCEP |
| LATITUDE / LONGITUDE | Coordenadas geográficas — preenchidas automaticamente após CEP (via AwesomeAPI ou Nominatim) |

### 2.3 Análise e Aprovação

A aprovação é manual — Alex decide. O sistema fornece o **Score** como apoio à decisão.

#### Score de crédito (0–100 pontos)

Calculado automaticamente a cada pagamento, cadastro, ou diariamente às 7h para clientes ativos.

| Bloco | Peso | O que avalia |
|---|---|---|
| A — Histórico de contratos | 25 pts | Quantidade quitados, antecipações, renegociações, prejuízos |
| B — Comportamento de pagamento | 30 pts | % em dia, atrasos leves/graves, qualidade de comunicação |
| C — Perfil financeiro | 20 pts | Renda comprovada, tipo (CLT/servidor/autônomo), comprometimento % |
| D — Relacionamento | 15 pts | Tempo como cliente, padrinho, indicou bons clientes, recuperação |
| E — Risco atual | 10 pts | Atraso atual, renegociação ativa, concentração de contratos |

**Bônus** (máx +10 pts): antecipação de pagamento, 3+ quitados sem atraso grave, >12 meses sem prejuízo, boa comunicação, indicou clientes. **+2 pts** se empregador ativo há 5+ anos (`DATA_ABERTURA_EMPREGADOR`).

**Penalizações:** atraso atual >7d (−5 a −25), renegociação ativa (−10), comunicação ruim com atraso (−20), prejuízo não recuperado (−30). **−5 pts** se situação cadastral do empregador não for "ATIVA" (`SITUACAO_EMPREGADOR`).

**Score em Acordo Assistido:** o score fica **congelado** — não penaliza na entrada, no abatimento ou na permanência. Retoma o cálculo normal quando o cliente retorna à cobrança regular.

#### Classificação e decisão automática

| Score | Faixa | Decisão |
|---|---|---|
| 90–100 | Excelente | Aprovado |
| 75–89 | Bom | Aprovado |
| 60–74 | Médio | Aprovado com restrição |
| 45–59 | Atenção | Análise manual |
| 30–44 | Alto risco | Recusado |
| < 30 | Bloqueado | Recusado |

#### Limites por score

A lógica de limite tem **duas camadas** — ambas devem ser respeitadas:

1. **Teto absoluto por faixa** — valor máximo permitido independente da renda
2. **Comprometimento máximo** — parcela mensal não pode superar 35% da renda líquida

O limite efetivo é sempre o **menor** entre o teto da faixa e o que a renda comporta.

**Progressão por histórico:**

| Score | Faixa | 1º contrato | 2º+ contrato | Prazo máx | Taxa |
|---|---|---|---|---|---|
| 90–100 | Excelente | R$ 1.500 | **R$ 4.000** | 12x | Mínima (14%) |
| 75–89 | Bom | R$ 1.500 | **R$ 3.000** | 10x | Padrão baixa (16%) |
| 60–74 | Médio | R$ 1.500 | **R$ 1.500** | 6x | Padrão (18%) |
| 45–59 | Atenção | Não emprestar | **R$ 1.000** (análise manual obrigatória) | 3x | Alta (22%) |
| < 45 | Alto risco / Bloqueado | Recusado | Recusado | — | — |

> **Regra do 1º contrato:** R$ 1.500 máximo para qualquer cliente novo, independente do score. Score alto no papel não substitui histórico real com a casa.
>
> **Faixa Atenção (45–59):** Só emprestar no 2º+ contrato se houver justificativa explícita. O limite de R$ 1.000 é um teto, não uma meta.
>
> **Freio de segurança sempre ativo:** comprometimento máximo de 35% da renda — prevalece sobre qualquer limite acima.

#### Bloqueio automático de crédito

Cliente é **bloqueado para novo crédito** automaticamente se:
- Atraso atual > 30 dias
- Comunicação ruim + qualquer atraso
- Prejuízo registrado e não recuperado
- Renegociação ativa + inadimplente
- Score final < 30

### 2.4 Criação do Contrato

1. Alex acessa **Novo Contrato** no FinanceiroOp.
2. Sistema pré-preenche o **1º vencimento** = dia preferido do cliente no **mês seguinte**.
3. Alex informa: valor principal, número de parcelas, taxa mensal.
4. Sistema calcula automaticamente:
   - `Juros total = principal × taxa × n_parcelas`
   - `Valor total = principal + juros total`
   - `Valor parcela = valor total / n_parcelas`
   - `Parcela principal = principal / n_parcelas`
   - `Parcela juros = juros total / n_parcelas`
5. GAS cria: **linha em CONTRATOS** + **todas as parcelas em PARCELAS** + **documento Google Docs** a partir do template.
6. Modal de sucesso oferece: abrir doc, enviar para assinatura (ZapSign), gerar carnê PIX (Efí Bank), enviar WhatsApp.

**Formato do ID de contrato:** `PCL-Nº NNN` (ex: `PCL-Nº 42`).

**Status inicial do contrato:** `ativo_em_dia`.

### 2.5 Assinatura Eletrônica (ZapSign)

Fluxo acionado opcionalmente após criação do contrato:
1. GAS exporta o Google Doc do contrato como PDF.
2. Envia para a API ZapSign com 4 signatários:
   - **Alex Moreira Borges** (credor)
   - **Cliente** (devedor) — recebe link por email automático
   - **Geovanna Alves Bueno** (testemunha)
   - **Mariely Moreira Borges** (testemunha)
3. Todos assinam digitalmente via tela.
4. Selfie obrigatória do cliente.

### 2.6 Carnê PIX — Efí Bank

Gera uma cobrança `cobv` (PIX com vencimento) por parcela, em produção.

| Parâmetro | Valor |
|---|---|
| Tipo | cobv (cobrança com vencimento) |
| Multa | 2% (modalidade percentual) |
| Juros | 0,03% ao dia (modalidade percentual) |
| Validade pós-vencimento | 30 dias |
| Txid | `FOP` + número do contrato (16 dígitos) + `P` + número da parcela (6 dígitos) = 26 chars |

O CPF deve ter sempre 11 dígitos. Se o CPF tiver menos de 11 dígitos, o campo `devedor` é omitido da cobrança (sem rejeição pela Efí).

---

## 3. Estrutura de Dados — Google Sheets

O banco de dados é composto por **11 abas** no Google Sheets.

### 3.1 CLIENTES

Um registro por cliente.

| Coluna | Tipo | Descrição |
|---|---|---|
| ID_CLIENTE | Sequencial (001, 002...) | Identificador único |
| NOME | Texto | Title case, sem dígitos |
| CPF | Texto | 11 dígitos |
| RG | Texto | Somente dígitos |
| NACIONALIDADE | Texto | |
| ESTADO_CIVIL | Texto | |
| PROFISSAO | Texto | Somente letras |
| TELEFONE_WPP | Texto | 11 dígitos (com nono dígito) |
| EMAIL | Texto | Lowercase |
| CEP / RUA / NUMERO / QUADRA / LOTE / SETOR / COMPLEMENTO / CIDADE_ESTADO | Texto | Endereço completo |
| CONTATO_CONFIANCA_1 / TEL_CONFIANCA_1 | Texto | Pessoa de confiança 1 |
| CONTATO_CONFIANCA_2 / TEL_CONFIANCA_2 | Texto | Pessoa de confiança 2 |
| DIA_VENCIMENTO_PREFERIDO | Número | Dia do mês (1–31) |
| PADRINHO | Texto | Nome do cliente que indicou |
| TEL_PADRINHO | Texto | Preenchido por fuzzy match |
| DATA_CADASTRO | Data | |
| STATUS_CLIENTE | Enum | `ativo` / `inativo` / `aguardando_conferencia` / `bloqueado` |
| QUALIDADE_COMUNICACAO | Enum | `Boa` / `Regular` / `Ruim` |
| PERFIL_COBRANCA | Enum | `COOPERATIVO` / `NEUTRO` / `RESISTENTE` / `EVASIVO` — avaliação comportamental de como o cliente reage à cobrança |
| OBSERVACOES | Texto | |
| SCORE | Número | 0–100 |
| SCORE_FAIXA | Texto | Excelente / Bom / Médio / Atenção / Alto risco / Bloqueado |
| SCORE_DECISAO | Texto | Aprovado / Aprovado com restrição / Análise manual / Recusado / Bloqueado: motivo |
| SCORE_LIMITE_SUGERIDO | Moeda | Limite de crédito sugerido |
| SCORE_PARCELA_MAX | Moeda | Valor máximo de parcela mensal |
| SCORE_TAXA_LABEL | Texto | Mínima / Padrão baixa / Padrão / Alta / Máxima |
| SCORE_TAXA_PCT | % | Taxa sugerida em % |
| SCORE_PRAZO_MAX | Número | Prazo máximo em parcelas |
| SCORE_PADRINHO | Número | Score agregado do padrinho (0–100) |
| SCORE_EMPREGADOR | Número | Score agregado do empregador (0–100) |
| SCORE_BLOQUEADO | Texto | SIM / NAO |
| SCORE_MOTIVOS | Texto | Lista de fatores do score |
| SCORE_DATA | Data | Data do último cálculo |
| RENDA_MENSAL | Moeda | Renda operacional usada em `calcularScore` |
| RENDA_LIQUIDA | Moeda | Renda líquida do contracheque (referência) |
| RENDA_BRUTA | Moeda | Renda bruta do contracheque (referência apenas) |
| EMPREGADOR | Texto | Nome do empregador |
| DATA_ADMISSAO | Data | Data de admissão na empresa |
| LTV_CLIENTE | Moeda | Soma de todos os juros já pagos |
| LUCRO_TOTAL | Moeda | LTV_CLIENTE + receita de atraso |
| PREJUIZO_TOTAL | Moeda | Capital perdido + juros não realizados em contratos baixados |
| ROI_CLIENTE | % | LUCRO_TOTAL / capital total emprestado |
| ATRASO_MEDIO | Número | Média de dias de atraso em todos os pagamentos |
| ATRASO_MAXIMO | Número | Maior atraso já registrado em qualquer parcela |
| PROMESSAS_QUEBRADAS | Número | Quantidade de promessas com STATUS = QUEBRADA |
| TAXA_ADIMPLENCIA | % | % de parcelas pagas pontualmente |
| TOTAL_EMPRESTADO / TOTAL_PAGO / CONTRATOS_ATIVOS / CONTRATOS_BAIXADOS | Número | Totalizadores |

### 3.2 CONTRATOS

Um registro por contrato.

| Coluna | Descrição |
|---|---|
| ID_CONTRATO | PCL-Nº NNN |
| ID_CLIENTE | FK → CLIENTES |
| NOME_CLIENTE | Desnormalizado |
| DATA_EMPRESTIMO | Data da liberação do dinheiro |
| DATA_PRIMEIRA_PARCELA | Vencimento da parcela 1 |
| VALOR_PRINCIPAL | Capital emprestado |
| NUM_PARCELAS | Quantidade de parcelas |
| TAXA_JUROS_MENSAL | Taxa mensal (ex: 0.18 = 18%) |
| TAXA_JUROS_TOTAL | Taxa total acumulada |
| JUROS_TOTAL | Valor total de juros |
| VALOR_TOTAL | Principal + juros total |
| VALOR_PARCELA | Valor médio por parcela |
| PARCELA_PRINCIPAL | Parte principal por parcela |
| PARCELA_JUROS | Parte de juros por parcela |
| STATUS_CONTRATO | Ver ciclo de status abaixo |
| SUBSTATUS_PREJUIZO | Detalhe do substatus em baixa |
| DATA_BAIXA_PREJUIZO | Data da baixa como prejuízo |
| MOTIVO_BAIXA_PREJUIZO | Motivo |
| POSSIBILIDADE_RECUPERACAO | ALTA / MEDIA / BAIXA |
| VALOR_RECUPERADO_APOS_BAIXA | Valor já recuperado após baixa formal |
| PREJUIZO_CAPITAL | Capital ainda a perder |
| JUROS_NAO_REALIZADOS | Juros não recebidos |
| DIAS_ATRASO_NA_BAIXA | Dias de atraso ao baixar |
| BLOQUEADO_PARA_NOVO_CREDITO | SIM / NAO |
| MOTIVO_BLOQUEIO_CREDITO | Motivo do bloqueio |
| STATUS_JURIDICO | NAO_ANALISADO / outros |
| PROXIMA_PROVIDENCIA | Ação planejada |
| OBSERVACAO_BAIXA | Texto livre |
| STATUS_CARTEIRA | ativa / baixada / quitada / renegociada / acordo_assistido *(auxiliar — nunca usar em lógica)* |
| VALOR_ACORDO | Valor acordado em renegociação |
| DATA_ACORDO | Data do acordo |
| DESCONTO_PRINCIPAL_ACORDO | Desconto no principal |
| DESCONTO_JUROS_ACORDO | Desconto nos juros |
| **DATA_ENTRADA_ACORDO_ASSISTIDO** | Data em que o contrato entrou em Acordo Assistido |
| **MOTIVO_ACORDO_ASSISTIDO** | Motivo declarado (Demissão / Afastamento INSS / Problema de saúde / Redução de renda / Outro) |
| **OBSERVACAO_ACORDO_ASSISTIDO** | Observação livre ao entrar no acordo |
| **VALOR_ABATIDO_ASSISTIDO** | Contador acumulado de abatimentos recebidos durante o Acordo Assistido (100% capital) |
| **NUMERO_PROCESSO** | Nº do processo judicial (CNJ) |
| **DATA_AJUIZAMENTO** | Data em que o contrato foi ajuizado |
| **VARA / COMARCA** | Dados do foro |
| **STATUS_PROCESSO** | Situação processual: EM_PREPARACAO → AJUIZADO → CITACAO_PENDENTE → ... → ARQUIVADO/EXTINTO |
| **VALOR_EXECUTADO** | Valor pleiteado na ação |
| **OBSERVACOES_JURIDICAS / LINK_PROCESSO / CODIGO_ACESSO_PROCESSO** | Dados de acompanhamento |
| **PROXIMA_ACAO / DATA_PROXIMA_ACAO** | Próximo passo processual |
| **ULTIMA_MOVIMENTACAO / DATA_ULTIMA_MOVIMENTACAO** | Última movimentação registrada (histórico completo fica em EVENTOS, tipo `MOVIMENTACAO_JURIDICA`) |
| **SITUACAO_FINANCEIRA_JUDICIAL** *(2026-07-04)* | Situação financeira, independente do processo: EM_ABERTO / ACORDO_PARCELADO_ATIVO / ACORDO_QUEBRADO / QUITADO_JUDICIALMENTE / RECUPERADO_PARCIAL / PERDA_JUDICIAL_DEFINITIVA |
| **DATA_ACORDO_JUDICIAL / VALOR_ACORDO_JUDICIAL** *(2026-07-04)* | Dados do acordo judicial firmado |
| **HONORARIOS_JUDICIAIS / QUEM_PAGA_HONORARIOS** *(2026-07-04)* | Valor e responsável (DEVEDOR/CREDOR) |
| **CUSTAS_JUDICIAIS / QUEM_PAGA_CUSTAS** *(2026-07-04)* | Valor e responsável (DEVEDOR/CREDOR) |
| **VALOR_RECUPERADO_JUDICIAL_PRINCIPAL / VALOR_RECUPERADO_JUDICIAL_LUCRO** *(2026-07-04)* | Acumuladores de recuperação judicial, mesmo padrão de VALOR_RECUPERADO_APOS_BAIXA |
| **DATA_ARQUIVAMENTO_PROCESSO / MOTIVO_ARQUIVAMENTO** *(2026-07-04)* | Preenchidos ao arquivar o processo |

### 3.3 PARCELAS

Uma linha por parcela de cada contrato.

| Coluna | Descrição |
|---|---|
| ID_PARCELA | Sequencial de 5 dígitos (ex: 00042) |
| ID_CONTRATO | FK → CONTRATOS |
| ID_CLIENTE | FK → CLIENTES |
| NOME_CLIENTE | Desnormalizado |
| NUM_PARCELA | Número desta parcela (1, 2, 3...) |
| TOTAL_PARCELAS | Total de parcelas do contrato |
| DATA_VENCIMENTO | Data de vencimento |
| VALOR_PARCELA | Valor original da parcela |
| VALOR_PRINCIPAL | Parte principal |
| VALOR_JUROS | Parte de juros |
| STATUS | Status atual — ver lista abaixo |
| DATA_PAGAMENTO | Data em que foi paga |
| VALOR_PAGO | Valor efetivamente pago |
| DIFERENCA_PAGA | Valor extra pago (juros/multa de atraso) |
| TIPO_PAGAMENTO | Tipo — ver lista abaixo |
| ORIGEM_PARCELA | `original` ou `gerada_por_pagamento_de_juros` |
| ID_PARCELA_ORIGEM | ID da parcela que gerou esta (somente_juros) |
| DATA_ACORDO | Data do acordo/promessa (quando reagendada) |
| VALOR_RECEBIDO | Valor líquido recebido |
| DESCONTO_APLICADO | Desconto concedido nos juros |
| DIAS_ATRASO | Dias de atraso no pagamento |
| DIAS_ANTECIPACAO | Dias de antecipação |
| OBSERVACOES | Texto livre |
| PIX_TXID | ID da cobrança na Efí Bank |

**Status de parcela:**
| Status | Terminal? | Descrição |
|---|---|---|
| `pendente` | Não | Ainda dentro do prazo |
| `vence_hoje` | Não | Vence no dia atual |
| `atrasado` | Não | Passou do vencimento, não paga |
| `reagendado` | Não | Tem DATA_ACORDO futura — não aparece em atraso |
| `pago` | **Sim** | Paga normalmente |
| `quitacao_antecipada` | **Sim** | Paga antecipadamente |
| `baixado_como_prejuizo` | **Sim** | Baixada como perda |
| `cancelado` | **Sim** | Cancelada |
| `renegociado` | **Sim** | Incluída em acordo com perda |

> **Regra crítica:** Status terminais **nunca** são reabertos automaticamente.

> **Parcelas em Acordo Assistido:** quando o contrato está em `acordo_assistido`, suas parcelas permanecem abertas (`atrasado`/`pendente`) no Sheets. O sistema exclui essas parcelas da aba Cobrança pelo filtro do STATUS_CONTRATO, não pelo status da parcela.

**Tipos de pagamento (TIPO_PAGAMENTO):**
| Tipo | Quando ocorre | Contabilização |
|---|---|---|
| `pagamento_normal` | Pago na data ou no mesmo dia | Receita |
| `pagamento_antecipado` | Pago antes do vencimento | Receita |
| `pagamento_com_atraso` | Pago após o vencimento | Receita |
| `somente_juros` | Só os juros são pagos; principal é rolado | Receita (juros) |
| `quitacao_antecipada` | Liquidação antecipada com desconto | Receita |
| `recuperacao_apos_baixa` | Recebimento após baixa como prejuízo | Capital recuperado |
| `acordo_com_perda` | Valor menor do que a dívida total | Capital recuperado + receita parcial |
| **`abatimento_acordo_assistido`** | Pagamento livre durante Acordo Assistido | **Capital recuperado** (nunca receita) |

### 3.4 PAGAMENTOS

Registro **imutável** de cada transação financeira.

| Coluna | Descrição |
|---|---|
| ID_PAGAMENTO | PAG00001, PAG00002... |
| ID_PARCELA | FK → PARCELAS *(vazio para abatimentos de acordo assistido)* |
| ID_CONTRATO | FK → CONTRATOS |
| ID_CLIENTE | FK → CLIENTES |
| NOME_CLIENTE | Desnormalizado |
| DATA_PAGAMENTO | Data |
| VALOR_ORIGINAL_PARCELA | Valor original da parcela |
| VALOR_PAGO | Valor recebido |
| DIFERENCA_RECEBIDA | Extra recebido (juros/multa) |
| RECEITA_EXTRA_ATRASO | Receita de atraso |
| TIPO_PAGAMENTO | Ver lista acima |
| FORMA_PAGAMENTO | `dinheiro` / `pix` / `transferencia` / `pix_efi` |
| OBSERVACOES | Texto livre |

### 3.5 PROMESSAS

Acordos de pagamento futuros que o cliente comprometeu verbalmente.

| Coluna | Descrição |
|---|---|
| ID_PROMESSA | PRM00001... |
| ID_CONTRATO / ID_CLIENTE / NOME_CLIENTE | FKs |
| DATA_PROMESSA | Quando o acordo foi feito |
| DATA_PREVISTA_PAGAMENTO | Data prometida para pagar |
| VALOR_PROMETIDO | Valor prometido |
| STATUS_PROMESSA | `PENDENTE` → `CUMPRIDA` / `QUEBRADA` |
| DATA_CUMPRIMENTO | Quando foi cumprida |
| VALOR_PAGO | Valor efetivamente pago |
| OBSERVACAO | Texto livre |

> A DATA_ACORDO da parcela correspondente é preenchida com DATA_PREVISTA_PAGAMENTO.
> A rotina diária verifica promessas `PENDENTE` com data vencida e as marca como `QUEBRADA`.

### 3.6 EVENTOS

Audit log completo de todas as ações. **Nunca deletar.**

| Coluna | Descrição |
|---|---|
| ID_EVENTO | EVT00001... |
| DATA_EVENTO | Timestamp |
| ID_CONTRATO / ID_CLIENTE / NOME_CLIENTE / ID_PARCELA | FKs |
| TIPO_EVENTO | CRIACAO_CONTRATO, PAGAMENTO, QUITACAO_ANTECIPADA, ACORDO_ASSISTIDO_ENTRADA, ABATIMENTO_ACORDO_ASSISTIDO, ACORDO_ASSISTIDO_EXPIRADO, etc. |
| VALOR_PRINCIPAL / VALOR_JUROS / VALOR_TOTAL / VALOR_EXTRA_ATRASO | Valores |
| STATUS_ANTERIOR / STATUS_NOVO | Transição de status |
| OBSERVACOES | Texto livre |

### 3.7 ACORDOS

Registros de acordos formais com desconto (quando dívida é renegociada com perda).

| Coluna | Descrição |
|---|---|
| ID_ACORDO | ACO00001... |
| ID_CONTRATO / ID_CLIENTE / NOME_CLIENTE | FKs |
| DATA | Data do acordo |
| VALOR_DIVIDA_ORIGINAL | Soma do que era devido |
| VALOR_ACORDADO | O que foi aceito receber |
| DESCONTO_PRINCIPAL | Quanto do capital foi perdido |
| DESCONTO_JUROS | Quanto dos juros foi cancelado |
| STATUS | QUITADO |
| OBSERVACOES | Texto livre |

### 3.8 MENSAGENS

Log de todos os disparos da régua de cobrança WhatsApp. **Nunca deletar em produção normal** — deletar apenas em caso de reenvio manual forçado.

| Coluna | Descrição |
|---|---|
| ID_MENSAGEM | MSG00001... |
| DATA_ENVIO | Timestamp do envio |
| ID_CLIENTE | FK → CLIENTES |
| ID_CONTRATO | FK → CONTRATOS |
| ID_PARCELA | FK → PARCELAS (vazio para promessas) |
| TELEFONE | Número do destinatário |
| GATILHO | D-5 / D-1 / D0 / D+1 / D+3 / D+7 / PROMESSA_D-1 / PROMESSA_D0 / PROMESSA_D+1 / CONFIRMACAO_PAGAMENTO |
| CONTEUDO | Texto da mensagem enviada |
| STATUS_ENVIO | `ENVIADO` / `ERRO_ENVIO` / `ERRO_SEM_PIX` |

> **Regra de deduplicação:** `_jaEnviouHoje(idCliente)` bloqueia reenvio apenas se já houver linha com `STATUS_ENVIO = "ENVIADO"` no mesmo dia. Erros não bloqueiam reenvio.

### 3.9 PADRINHOS

Tabela agregada gerada automaticamente — **não editar manualmente**.

| Coluna | Descrição |
|---|---|
| NOME_PADRINHO | Nome do cliente-padrinho |
| TEL_PADRINHO | Telefone |
| TOTAL_INDICADOS | Quantidade de clientes indicados |
| INDICADOS_ATIVOS | Indicados com contratos ativos |
| LTV_MEDIO | LTV médio dos indicados |
| ROI_MEDIO | ROI médio dos indicados |
| TAXA_ADIMPLENCIA_MEDIA | % adimplência média dos indicados |
| ATRASO_MEDIO | Média de dias de atraso dos indicados |
| SCORE_PADRINHO | Score 0–100 calculado pela qualidade dos indicados |
| DATA_ATUALIZACAO | Data do último recálculo |

### 3.10 EMPREGADORES

Tabela agregada gerada automaticamente — **não editar manualmente**.

| Coluna | Descrição |
|---|---|
| EMPREGADOR | Nome do empregador |
| TOTAL_CLIENTES | Total de clientes com este empregador |
| LTV_MEDIO | LTV médio dos clientes do empregador |
| ROI_MEDIO | ROI médio |
| TAXA_ADIMPLENCIA_MEDIA | % adimplência média |
| ATRASO_MEDIO | Média de atraso |
| SCORE_EMPREGADOR | Score 0–100 calculado pela qualidade dos clientes do empregador |
| DATA_ATUALIZACAO | Data do último recálculo |

### 3.11 CONFIGURACOES

Parâmetros globais editáveis no Sheets.

| Chave | Padrão | Descrição |
|---|---|---|
| TAXA_MINIMA_MENSAL | 0,14 | 14% — score ≥ 90 |
| TAXA_PADRAO_BAIXA_MENSAL | 0,16 | 16% — score ≥ 75 |
| TAXA_PADRAO_MENSAL | 0,18 | 18% — score ≥ 60 |
| TAXA_ALTA_MENSAL | 0,22 | 22% — score ≥ 45 |
| TAXA_MAXIMA_MENSAL | 0,25 | 25% — score < 45 |
| COMPROMETIMENTO_MAX_PCT | 0,35 | Máximo 35% da renda comprometida |
| LIMITE_PRIMEIRO_EMPRESTIMO | 1.500 | Teto absoluto para qualquer primeiro contrato |
| SCORE_MIN_APROVACAO | 60 | Score mínimo para aprovação normal |
| LIMITE_SCORE_EXCELENTE | 4.000 | Teto para score 90–100 (2º+ contrato) |
| LIMITE_SCORE_BOM | 3.000 | Teto para score 75–89 (2º+ contrato) |
| LIMITE_SCORE_MEDIO | 1.500 | Teto para score 60–74 (2º+ contrato) |
| LIMITE_SCORE_ATENCAO | 1.000 | Teto para score 45–59 (2º+ contrato, análise manual) |
| PRAZO_MAX_EXCELENTE | 12 | Prazo máximo em parcelas — score ≥ 90 |
| PRAZO_MAX_BOM | 10 | Prazo máximo — score ≥ 75 |
| PRAZO_MAX_MEDIO | 6 | Prazo máximo — score ≥ 60 |
| PRAZO_MAX_ATENCAO | 3 | Prazo máximo — score ≥ 45 |

### 3.12 LEADS

Leads captados pelo bot WhatsApp de triagem. Um registro por conversa.

| Campo | Descrição |
|---|---|
| TELEFONE | Número do lead (formato internacional) |
| NOME / CPF / RENDA | Dados coletados durante a triagem |
| EMPREGADOR / DATA_ADMISSAO | Extraídos do contracheque por Claude Sonnet |
| RENDA_BRUTA / RENDA_LIQUIDA | Extraídas do contracheque |
| PADRINHO | Nome informado pelo lead |
| STATUS_LEAD | `EM_ANDAMENTO` → `FORMULARIO_ENVIADO` / `REPROVADO` / `COMPLETO` |
| HISTORICO_CONVERSA | JSON com toda a troca de mensagens |

---

## 4. Ciclo de Status dos Contratos

### Status e transições

```
ativo_em_dia
    │
    ├─ (atraso 1–30d)  ──→ ativo_em_atraso
    ├─ (atraso 31–60d) ──→ em_cobranca
    ├─ (atraso 61–120d)──→ pre_prejuizo
    ├─ (atraso >120d)  ──→ [permanece pre_prejuizo — baixa é manual]
    │
    ├─ [ajuizar manual] ──→ em_processo_judicial (não é final — ver seção 4.1)
    │                            │
    │                    [acordo/quitação/arquivamento]
    │                            ↓
    │                    encerrado_judicialmente
    │
    ├─ [ação manual]   ──→ acordo_assistido ←──────────────────────────────┐
    │                          │                                            │
    │                    ┌─────┴─────────────┐                             │
    │                    ↓                   ↓                             │
    │              [180d sem abat.]    [retorno manual]                    │
    │                    ↓                   ↓                             │
    │              pre_prejuizo        recalcula por dias ──────────────────┘
    │
    └─ [baixa manual]  ──→ baixado_como_prejuizo
                                   │
                              ──→ em_recuperacao
                                   │
                    ┌──────────────┴──────────────┐
                    ↓                             ↓
        recuperado_parcialmente    recuperado_integralmente
                    │
                    └──→ encerrado_sem_recuperacao
```

**Status finais (não recalculados automaticamente pelo trigger diário):**
`baixado_como_prejuizo`, `em_recuperacao`, `recuperado_parcialmente`, `recuperado_integralmente`, `encerrado_sem_recuperacao`, `cancelado`, `renegociado`, `em_processo_judicial`, `encerrado_judicialmente`

### 4.1 `em_processo_judicial` — não é status final (2026-07-04)

Ao contrário dos demais itens da lista acima, `em_processo_judicial` **é uma fase ativa**, não um estado congelado: o contrato permanece nesse status durante toda a Recuperação Judicial (acordos, pagamentos, movimentações) e só transiciona para o status terminal `encerrado_judicialmente` quando a dívida é resolvida ou o processo é arquivado. A situação financeira detalhada (quitado / recuperado parcial / perda definitiva) fica em `SITUACAO_FINANCEIRA_JUDICIAL`, campo independente de `STATUS_CONTRATO`. Ver Módulo Jurídico em `appscript.gs` e `02-AI-CREDIT-RULES.md`.

Não é recalculado por dias de atraso (aging normal não se aplica à fase judicial) — só muda de status via `registrarAcordoJudicial` (quitação à vista), `registrarQuitacaoJudicial`, `arquivarProcessoJudicial` ou pagamento da última parcela de um acordo judicial parcelado.

**`acordo_assistido`** — tratamento especial:
- Não é recalculado pelo trigger diário
- Se ficar **180 dias sem nenhum abatimento**, o trigger move automaticamente para `pre_prejuizo`
- Score permanece congelado durante todo o período
- Parcelas não aparecem na aba Cobrança
- Contrato aparece na aba Perdas & Recuperação

**Status `quitado`** é recalculado se houver reabertura de parcela.

**Bloqueio de crédito** é aplicado automaticamente nos status:
`em_cobranca`, `pre_prejuizo`, `baixado_como_prejuizo`, `em_recuperacao`, `recuperado_parcialmente`, `encerrado_sem_recuperacao`, `em_processo_judicial`, `encerrado_judicialmente`

**Bloqueio permanente por judicialização** (2026-07-04): além do bloqueio por status acima (que pode variar ao longo do ciclo do contrato), um cliente que já foi ajuizado (`CLIENTE_JUDICIALIZADO = "SIM"` em CLIENTES) fica **permanentemente** impedido de novo crédito — esse flag nunca é revertido, mesmo com quitação total do processo. Validado tanto no frontend (`NovoContrato`) quanto no backend (`criarContrato` rejeita a criação com erro).

### Atualização automática

A rotina diária (7h) recalcula o status de todos os contratos que **não** estão em status final, baseando-se nos dias de atraso da parcela mais velha em aberto. Para contratos em `acordo_assistido`, aplica apenas a regra dos 180 dias.

---

## 5. Operações de Pagamento — Regras Detalhadas

### 5.1 Pagamento Normal

- Registra DATA_PAGAMENTO, VALOR_PAGO, TIPO_PAGAMENTO.
- Se VALOR_PAGO > VALOR_PARCELA → diferença vai para DIFERENCA_PAGA (receita de juros/multa).
- DATA_ACORDO da parcela é apagada (promessa cumprida).
- Se todas as parcelas do contrato ficarem em status terminal → contrato vira `quitado` automaticamente.
- Score do cliente é recalculado imediatamente.

### 5.2 Pagamento Somente Juros

**Política formalizada em 2026-06-19.**

Permite que o cliente pague apenas os juros da parcela, prorrogando o principal por mais um mês.

**Regras obrigatórias:**
- **Limite**: máximo 2 usos por contrato (TOTAL_SOMENTE_JUROS ≤ 2). Bloqueado após atingir o limite.
- **Fee de prorrogação**: 5% do VALOR_PRINCIPAL da parcela. Cobrado junto com os juros no momento do pagamento.
  - Valor pago = `VALOR_JUROS + (VALOR_PRINCIPAL × 0.05)`
  - Contabilizado em campo separado `FEE_PRORROGACAO` em PAGAMENTOS (não em `RECEITA_EXTRA_ATRASO`)
- **Penalização de score**: −10 pontos a cada uso (acumulativo; cobre todos os contratos do cliente)

**Fluxo:**
1. Parcela atual vai para status `pago` com `TIPO_PAGAMENTO = "somente_juros"`.
2. `RECEITA_EXTRA_ATRASO = 0` (fee não é mora/multa — vai em FEE_PRORROGACAO).
3. Uma **nova parcela** é criada no final do carnê com o mesmo VALOR_PRINCIPAL e VALOR_JUROS originais; vencimento = último vencimento + 1 mês; `ORIGEM_PARCELA = "gerada_por_pagamento_de_juros"`.
4. `TOTAL_PARCELAS` de todas as parcelas do contrato é incrementado.
5. `TOTAL_SOMENTE_JUROS` no CONTRATOS é incrementado.
6. Score do cliente é recalculado (−10 pts aplicado via `calcularScore`).

**Somas financeiras com backward compat:**
Cálculos de receita extra sempre usam `RECEITA_EXTRA_ATRASO + FEE_PRORROGACAO` — registros antigos têm fee em `RECEITA_EXTRA_ATRASO` (FEE_PRORROGACAO = 0); novos têm em `FEE_PRORROGACAO` (RECEITA_EXTRA_ATRASO = 0).

### 5.3 Quitação Antecipada

- Alex seleciona quais parcelas futuras serão liquidadas.
- Pode conceder desconto nos juros (distribuído proporcionalmente entre as parcelas selecionadas).
- Cada parcela gera um registro separado em PAGAMENTOS.
- VALOR_RECEBIDO = principal + juros − desconto proporcional.
- Se todas ficarem pagas → contrato vira `quitado`.

### 5.3.1 Quitação Antecipada via PIX (2026-07-04)

Canal alternativo à quitação manual acima — o cliente paga via PIX em vez de Alex registrar manualmente:

1. Sistema gera uma **proposta de quitação** (`gerarPropostaQuitacaoPix`) a partir das parcelas selecionadas + desconto: calcula o valor final (principal + juros − desconto) e gera um TXID fixo para o contrato.
2. Proposta expira em **48h** — se não pago, `verificarQuitacoesExpiradas` marca como `EXPIRADO`.
3. Se já existe proposta pendente para o contrato, o sistema reaproveita a mesma (não duplica cobrança).
4. Ao ser paga, o webhook da Efí Bank chama `pagamentoQuitacaoWebhook`, que executa a mesma `registrarQuitacaoAntecipada` da quitação manual (5.3) e dispara confirmação por WhatsApp.
5. Proteção contra reentrega duplicada do webhook (idempotência) — o mesmo pagamento nunca é processado duas vezes mesmo se a Efí reenviar a notificação.
6. Alex pode cancelar uma proposta pendente manualmente.

### 5.3.2 Certificado de Quitação (link público)

Quando um contrato quita (por qualquer via — normal, PIX ou judicial), o sistema gera automaticamente um **certificado digital** com código de validação único e envia o link por WhatsApp ao cliente. O link é uma página pública (sem necessidade de login) que mostra nome, valor total pago, data de quitação e CPF mascarado — sem expor dados sensíveis completos. Cada contrato tem apenas um certificado ativo (reenvios reaproveitam o mesmo link, nunca duplicam).

### 5.4 Baixa como Prejuízo

- Ação manual no FinanceiroOp (aba Perdas & Recuperação ou ContratoModal).
- Alex informa: motivo, possibilidade de recuperação, substatus, próxima providência.
- Parcelas abertas marcadas como `baixado_como_prejuizo`.
- **PREJUIZO_CAPITAL** calculado:
  - Contratos normais: `VALOR_PRINCIPAL − capital_recuperado_pelas_parcelas_pagas`
  - Contratos em `acordo_assistido`: `VALOR_PRINCIPAL − VALOR_ABATIDO_ASSISTIDO` (usa o abatido como capital recuperado)
- JUROS_NAO_REALIZADOS = juros que não serão recebidos.
- Cliente é bloqueado automaticamente (`STATUS_CLIENTE = bloqueado`).
- Score recalculado (penalização −30 por prejuízo não recuperado).

### 5.5 Recuperação Após Baixa

- Registra valor recebido parcialmente após a baixa.
- VALOR_RECUPERADO_APOS_BAIXA acumula a cada recuperação.
- PREJUIZO_CAPITAL é reduzido.
- Status do contrato:
  - `recuperado_integralmente` se prejuízo chegar a zero
  - `recuperado_parcialmente` caso contrário

### 5.6 Acordo com Perda

- Formaliza acordo onde o cliente paga menos do que deve.
- Calcula DESCONTO_PRINCIPAL e DESCONTO_JUROS com base no valor acordado.
- Parcelas abertas marcadas como `renegociado`.
- Contrato vira `renegociado`.
- Registro criado em ACORDOS.
- Um registro em PAGAMENTOS do tipo `acordo_com_perda` documenta o recebimento.

### 5.7 Reabertura de Parcela

Ação de correção manual quando um pagamento foi registrado por engano:
- Parcela volta ao status anterior (pendente/atrasado).
- Pagamento correspondente é deletado de PAGAMENTOS.
- Se era `somente_juros`: a parcela gerada automaticamente também é deletada.
- TOTAL_PARCELAS recalculado.
- Score do cliente recalculado.

### 5.7.1 Desfazer uma Operação (Undo, 2026-07-04)

Camada de segurança adicional além da reabertura manual (5.7): toda operação financeira reversível (pagamento normal, somente juros, quitação antecipada, acordo com perda, recuperação após baixa, abatimento assistido, baixa por prejuízo) fica disponível para **desfazer em até 15 minutos** após ser feita. Passado esse prazo, a operação não pode mais ser desfeita por esse mecanismo — só pela reabertura manual de parcela (5.7), que continua existindo separadamente.

Regra de segurança: só é possível desfazer a operação **mais recente** de um contrato — se houver algo mais novo pendente, é preciso desfazer na ordem inversa (a mais recente primeiro).

**Ainda não tem botão no app** — hoje só é acionável tecnicamente, não pela interface que Alex usa no dia a dia.

### 5.8 Acordo Assistido e Abatimento

Para clientes que perderam renda temporariamente mas mantêm boa comunicação:

**Entrada no Acordo Assistido:**
- Ação manual: Alex clica em "Acordo Assistido" no ContratoModal ou PerdaAcoesModal.
- GAS executa `moverParaAcordoAssistido`: seta STATUS_CONTRATO = `acordo_assistido`, inicializa VALOR_ABATIDO_ASSISTIDO = 0, registra motivo/observação.
- Score **não** é recalculado.
- Contrato some da aba Cobrança, aparece em Perdas & Recuperação.

**Abatimento (pagamento durante o acordo):**
- Valor livre — qualquer quantia.
- GAS executa `registrarAbatimentoAssistido`: incrementa VALOR_ABATIDO_ASSISTIDO + registra em PAGAMENTOS com TIPO = `abatimento_acordo_assistido`.
- **100% do valor vai para capital** (nunca contabilizado como receita).
- Score **não** é recalculado.
- Parcelas originais não são alteradas.

**Capital Restante:**
`capitalRestante = VALOR_PRINCIPAL − VALOR_ABATIDO_ASSISTIDO`

**Juros Suspensos (Potencial):**
Soma de VALOR_JUROS das parcelas abertas — indica o lucro potencial se o cliente se recuperar e pagar tudo.

**Retorno à Cobrança Normal:**
- Alex clica em "Retornar" → GAS executa `sairDoAcordoAssistido(destino="normal")`.
- Status do contrato é recalculado pelos dias de atraso reais.
- Score volta a ser calculado.

**Encaminhamento para Baixa:**
- Alex clica em "Baixar" → BaixaModal → `baixarContratoPrejuizo`.
- PREJUIZO_CAPITAL = VALOR_PRINCIPAL − VALOR_ABATIDO_ASSISTIDO.

**Expiração automática (180 dias):**
- Se o contrato ficar 180+ dias sem nenhum abatimento (ou desde a data de entrada, se nunca houve abatimento), o trigger das 7h move automaticamente para `pre_prejuizo` e registra evento `ACORDO_ASSISTIDO_EXPIRADO`.

---

## 6. Inadimplência e Cobrança

### 6.1 Fila de Cobrança

A aba **Cobrança** no FinanceiroOp exibe todas as parcelas vencidas agrupadas por cliente. Parcelas com DATA_ACORDO futura aparecem como `reagendado` e não entram na fila. **Contratos em `acordo_assistido` e outros status terminais são excluídos automaticamente da fila.**

**Ações disponíveis por parcela:**
- Registrar pagamento
- Registrar promessa (reagendamento)
- Enviar mensagem WhatsApp
- Gerar PIX cobv

### 6.2 Promessas de Pagamento

Quando o cliente promete pagar em determinada data:
- Alex registra a promessa no sistema com data prevista e valor prometido.
- A parcela passa a mostrar status `reagendado` até aquela data.
- Se a data passar sem pagamento → promessa vira `QUEBRADA` automaticamente (rotina diária às 7h).

### 6.3 Régua de Cobrança Automática (WhatsApp)

Executa automaticamente às 7h via trigger do GAS. Envia mensagens e PIX por WhatsApp para clientes com parcelas nos gatilhos D-5, D-1, D0, D+1, D+3, D+7.

**Função GAS:** `enviarReguaCobranca()` — chamada pelo trigger diário e disponível para execução manual no editor do GAS.

**Gatilhos:**
| Gatilho | Quando |
|---|---|
| D-5 | 5 dias antes do vencimento |
| D-1 | 1 dia antes do vencimento |
| D0 | Dia do vencimento |
| D+1 | 1 dia após o vencimento |
| D+3 | 3 dias após o vencimento |
| D+7 | 7 dias após o vencimento |
| PROMESSA_D-1 | Véspera da data prometida pelo cliente |
| PROMESSA_D0 | Dia da promessa |
| PROMESSA_D+1 | Dia seguinte da promessa (não cumprida) |

**Regras de envio:**
- No máximo 1 mensagem por cliente por dia
- Clientes com `PERFIL_COBRANCA = EVASIVO` são pulados
- Contratos em status terminal (quitado, baixado, etc.) são ignorados
- Contratos em `acordo_assistido` são ignorados
- Se há promessa ativa, a régua normal é suspensa — só envia gatilhos de promessa
- Cada mensagem é seguida de uma segunda mensagem com o código PIX (para fácil cópia)
- PIX gerado via `api/efi-pix-avulso.js` → Efí Bank cobv — se parcela estiver vencida, usa a data de hoje como dataDeVencimento
- PIX gerado é salvo em `EFI_PIX_CODE` na aba PARCELAS (reutilizado nas execuções seguintes)
- Todos os disparos são logados na aba MENSAGENS

**Teste manual:** rodar `testarReguaCobranca()` no GAS (dry-run — não envia, só loga).

**Integração Evolution GO:**
- Endpoint: `POST {EVOLUTION_URL}/send/text`
- Body: `{ number, text, instanceId }`
- Header: `apikey: {EVOLUTION_KEY}` (Token da Instância, não API key global)
- Configs em CONFIGURACOES: `EVOLUTION_URL`, `EVOLUTION_KEY`, `EVOLUTION_INSTANCE`

### 6.3.1 Editor de Templates (painel)

Os textos das mensagens da régua e da confirmação de pagamento são editáveis diretamente no painel, sem acessar o Sheets.

- **Onde:** aba Régua WPP → botão ⚙️ "Templates"
- **Como funciona:** templates ficam salvos na aba CONFIGURACOES com chaves `TEMPLATE_D-5`, `TEMPLATE_CONFIRMACAO`, etc.
- **Fallback:** se a chave não existir no CONFIGURACOES, o sistema usa o texto padrão hardcoded em `_MSG_TEMPLATES` no GAS.
- **Variáveis disponíveis (régua):** `{NOME}`, `{VALOR_PARCELA}`, `{NUM_PARCELA}`, `{TOTAL_PARCELAS}`, `{DATA_VENCIMENTO}`, `{VALOR_COMBINADO}`, `{DATA_PROMESSA}`
- **Variáveis disponíveis (confirmação):** `{NOME}`, `{NUM_PARCELA}`, `{TOTAL_PARCELAS}`, `{VALOR_PAGO}`, `{PARCELAS_RESTANTES}`, `{PROXIMO_VENCIMENTO}`

### 6.3.2 Confirmação Automática de Pagamento

Após cada pagamento registrado (manual pelo painel **ou** automático via webhook Efí Bank), o sistema envia automaticamente uma mensagem de confirmação por WhatsApp ao cliente.

**Fluxo:**
1. Pagamento registrado via `registrarPagamentoAPI` (GAS)
2. `_enviarConfirmacaoPagamento` é chamado ao final da função
3. Lê template `TEMPLATE_CONFIRMACAO` do CONFIGURACOES
4. Busca `TELEFONE_WPP` do cliente na aba CLIENTES
5. Conta parcelas restantes e próximo vencimento na aba PARCELAS
6. Envia mensagem via Evolution GO (`_enviarWppRegua`)
7. Loga em MENSAGENS com `GATILHO = "CONFIRMACAO_PAGAMENTO"`
8. Chama `_cancelarPromessasPorContrato` → todas as PROMESSAS PENDENTE do contrato viram "CUMPRIDA"

**Deduplicação:** não reenvia se já houver linha em MENSAGENS com `GATILHO = "CONFIRMACAO_PAGAMENTO"` + `ID_PARCELA` + `STATUS_ENVIO = "ENVIADO"`.

**Cobertura:** funciona para pagamentos manuais (frontend → GAS) e automáticos (Efí webhook → GAS) pois ambos passam por `registrarPagamentoAPI`.

### 6.4 Ciclo de Inadimplência

| Dias de atraso | Status do contrato | Ação sugerida |
|---|---|---|
| 1–30 | `ativo_em_atraso` | Cobrança por WhatsApp, registrar promessa |
| 31–60 | `em_cobranca` | Intensificar contato, enviar PIX, negociar |
| 61–120 | `pre_prejuizo` | Contato com pessoas de confiança, propor acordo |
| > 120 | `pre_prejuizo` | Avaliar baixa ou Acordo Assistido |
| Manual | `acordo_assistido` | Cliente cooperativo em dificuldade temporária |
| Manual | `baixado_como_prejuizo` | Tentativa de recuperação pós-baixa |

---

## 7. Automação Diária

### Rotina às 7h (trigger automático no GAS)

1. `atualizarStatusParcelas()` — atualiza status de todas as parcelas não terminais com base na data de hoje.
2. `atualizarStatusContratos()` — recalcula status de todos os contratos ativos com base nos dias de atraso da parcela mais velha. Para contratos em `acordo_assistido`: aplica regra dos 180 dias de inatividade.
3. `verificarPromessasVencidas()` — marca como `QUEBRADA` as promessas com data vencida e status `PENDENTE`.
4. `_atualizarScoresDiario()` — recalcula score + métricas analíticas de todos os clientes com `STATUS_CLIENTE = ativo`.
5. `atualizarTabelaPadrinhos()` — reconsolida a aba PADRINHOS.
6. `atualizarTabelaEmpregadores()` — reconsolida a aba EMPREGADORES.
7. `enviarReguaCobranca()` — dispara régua de cobrança WhatsApp para todos os clientes elegíveis do dia.

### Atualização em tempo real (por pagamento)

A cada pagamento registrado (normal, parcial, quitação, recuperação, acordo), o GAS chama `calcularMetricasCliente()` imediatamente.

> **Exceção — Acordo Assistido:** `moverParaAcordoAssistido` e `registrarAbatimentoAssistido` **não** chamam `calcularScore` ou `calcularMetricasCliente`. Score permanece congelado.

### Auditoria automática de integridade (2026-07-04) — trigger próprio, todo dia às 07:05

Roda `auditarIntegridadeSistema()`, separado da rotina das 7h acima. Varre todas as abas principais em busca de inconsistências (parcela órfã, status divergente de PAGAMENTOS, duplicidade, matemática de contrato errada, etc.), calcula um **score de integridade de 0 a 100** e grava tudo na aba `AUDITORIA`. É só diagnóstico — não corrige nada sozinho. Vale conferir essa aba periodicamente ou antes de um audit manual grande.

### Backup automático (2026-07-04) — trigger próprio, todo dia às 2h

Copia a planilha inteira para a pasta "FinanceiroOp Backups" no Google Drive. Mantém sempre as últimas 30 cópias (a mais antiga é apagada quando passa desse número). Serve como rede de segurança contra perda de dado — não é um mecanismo de undo, é recuperação de desastre.

---

## 8. Contabilidade e DRE

### 8.1 Classificação dos recebimentos

| Tipo de recebimento | Entra como |
|---|---|
| Parcela paga (qualquer tipo normal) | **Receita** — DRE e Dashboard |
| Extra de atraso (DIFERENCA_RECEBIDA) | **Receita extra** — DRE e Dashboard |
| Abatimento em Acordo Assistido | **Capital recuperado** — linha separada no DRE |
| Recuperação após baixa | **Capital recuperado** — linha separada |

### 8.2 DRE Mensal atual

O sistema exibe, na aba Financeiro e no Dashboard, os seguintes totalizadores por período:

```
Receita realizada               = soma de VALOR_PAGO (excluindo abatimento_acordo_assistido)
Receita extra de atraso         = soma de DIFERENCA_RECEBIDA
Capital recuperado (Assistido)  = soma de VALOR_PAGO onde TIPO = abatimento_acordo_assistido
```

### 8.3 PDD — Provisão para Devedores Duvidosos (conceito pendente)

Conceito discutido e validado pela operação. **Ainda não implementado.**

Ideia: em vez de aguardar 180 dias para registrar o prejuízo total de uma só vez, o sistema provisionaria mensalmente um percentual crescente das parcelas em atraso, distribuindo o impacto ao longo do tempo — exatamente como fazem bancos e financeiras (BACEN Resolução 2682/99).

Modelo sugerido:
- 0–30 dias: 0% provisão
- 31–60 dias: 25% da parcela atrasada
- 61–90 dias: 50%
- 91–120 dias: 75%
- 121+ dias: 100%

**Impacto:** DRE mensal mostraria resultado provisionado mais realista. Se o cliente pagar após provisão, o recebimento aparece como receita "acima do esperado". Implementação pendente definição dos percentuais pelo operador.

---

## 9. Interface do FinanceiroOp

Sistema web acessado via navegador (Vercel). Autenticação por senha com sessão de 30 dias.

### Abas e funcionalidades

| Aba | O que faz |
|---|---|
| **Dashboard** | KPIs financeiros (capital emprestado, recebido, a receber, em atraso), gráfico mensal, lista de atrasos, promessas pendentes, card de Acordo Assistido |
| **Clientes** | Lista completa de clientes com busca, filtros e score. ClienteModal: perfil completo, edição (inclui PERFIL_COBRANCA), lista de contratos, histórico |
| **Contratos** | Lista de contratos com filtros por status. ContratoModal: tabela de parcelas, timeline, ações (pagamento, quitação, acordo assistido, abatimento, retornar, baixar) |
| **Cobrança** | Fila de parcelas vencidas agrupadas por cliente (exclui acordo_assistido e status terminais) |
| **Financeiro** | KPIs do período + tabela de pagamentos (inclui linha Capital Recuperado Assistido quando houver) + exportação PDF |
| **Perdas & Recuperação** | Contratos baixados, acordos, recuperações, Acordo Assistido. Filtro inclui `acordo_assistido` |
| **Promessas** | Acordos futuros registrados com status |
| **Inteligência** | Painel analítico com KPIs, top/bottom clientes, padrinhos, profissões, prazos, score vs realidade, empregadores |
| **Simulador** | Em desenvolvimento |

---

## 10. Integrações Externas

### 10.1 Evolution GO — WhatsApp (Régua de Cobrança)

- **Produto:** Evolution GO (versão comercial — diferente da open-source)
- **Uso:** envio automático de mensagens de cobrança pela régua (`enviarReguaCobranca` no GAS)
- **Endpoint:** `POST {EVOLUTION_URL}/send/text`
- **Autenticação:** header `apikey: {Token da Instância}` — obtido em Instâncias → Configurações no painel
- **Body:** `{ number: "5562...", text: "mensagem", instanceId: "..." }`
- **Números:** DDI 55 + DDD + 9 dígitos = 13 dígitos total
- **Configs (CONFIGURACOES no Sheets):** `EVOLUTION_URL`, `EVOLUTION_KEY`, `EVOLUTION_INSTANCE`

> **ATENÇÃO:** Evolution GO usa Token da Instância (por instância), NÃO a API key global. Usar a key errada → HTTP 401. Usar endpoint `/message/sendText/{instance}` → HTTP 404.

### 10.2 Efí Bank — PIX com Vencimento

- **Produto:** cobv (cobrança com vencimento)
- **Ambiente:** Produção
- **Autenticação:** OAuth2 com certificado `.p12`
- **Credenciais:** variáveis de ambiente no Vercel
- **Fluxo:** Frontend chama `/api/efi-charges` → autenticação → cria cobranças em lote → retorna `pixCopiaECola` por parcela.
- **Webhook:** `/api/webhook-efi` recebe confirmação de pagamento e chama `pagamentoAutomatico()` no GAS.

### 10.3 ZapSign — Assinatura Eletrônica

- **Ambiente:** Produção
- **Token:** hardcoded em `appscript.gs`
- **Fluxo:** Google Docs → exportar como PDF → enviar para ZapSign API com 4 signatários → retorna link de assinatura do credor

### 10.4 Google Forms — Cadastro de Clientes

- Formulário público para novos clientes preencherem.
- Trigger `onFormSubmit` no GAS processa automaticamente.
- Cria linha em CLIENTES com `STATUS_CLIENTE = aguardando_conferencia`.

**Títulos exatos das perguntas do formulário:**
- `Nome Completo`
- `CPF (somente numeros)`
- `RG (somente numeros)`
- `WhatsApp com DDD (Somente números)`
- `E-mail (tudo minúsculo)`
- `Nome de Pessoa de confiança 1`
- `Telefone de Pessoa de confiança 1`
- `Nome de Pessoa de confiança 2`
- `Telefone de Pessoa de confiança 2`
- `Digite aqui a Data de vencimento da primeira parcela. Do dia 01 ao dia 31 (ex: 05, 08, 10, 20)` ← campo texto, retorna número 1–31
- `Nome da pessoa que te indicou nossos serviços`

---

## 11. Autenticação e Segurança

- **Acesso ao painel:** senha única, protegida por cookie `fp_session` = HMAC-SHA256 da senha com `LOGIN_SECRET`.
- **Sessão:** 30 dias.
- **Middleware:** todas as rotas protegidas, exceto `/api/login`, `/api/logout` e `/api/webhook-efi`.
- **Certificado Efí:** `producao-849675-financeiroop.p12` — **nunca commitar no git**.
- **Variáveis de ambiente** (Vercel — nunca no código):

| Variável | Uso |
|---|---|
| `LOGIN_PASSWORD` | Senha do painel |
| `LOGIN_SECRET` | Chave HMAC da sessão |
| `EFI_CLIENT_ID` | Efí Bank OAuth2 |
| `EFI_CLIENT_SECRET` | Efí Bank OAuth2 |
| `EFI_PIX_KEY` | Chave PIX cadastrada na Efí |
| `EFI_CERT_P12_BASE64` | Certificado .p12 em base64 |

---

## 12. Armadilhas e Regras de Integridade

| Problema | Causa | Regra |
|---|---|---|
| Data um dia antes no Sheets | `new Date("YYYY-MM-DD")` = UTC midnight → UTC-3 = dia anterior | Sempre usar `parseDateLocal(s)` |
| Parcela não some de "Em Atraso" | DATA_ACORDO não foi limpa ao pagar | `registrarPagamentoAPI` sempre limpa DATA_ACORDO |
| Contrato baixado aparece em atraso | Verificava só status da parcela, não do contrato | Filtros excluem contratos com status terminal |
| TEL_PADRINHO vazio | Nome digitado no form não bate exato com CLIENTES | Lookup por fuzzy match |
| Abatimento contabilizado como receita | TIPO_PAGAMENTO = `abatimento_acordo_assistido` incluso em totais | Dashboard e Financeiro excluem explicitamente este tipo da receita |
| BaixaModal subestimando capital recuperado em acordo_assistido | Somava parcelas pagas (zero) em vez de VALOR_ABATIDO_ASSISTIDO | Frontend usa VALOR_ABATIDO_ASSISTIDO como capitalRecuperado quando isAcordoAssistido |
| Acordo Assistido eterno sem atividade | Nenhuma regra de expiração | Trigger 7h verifica última data de abatimento — 180+ dias → move para pre_prejuizo |
| Régua: valor errado nas mensagens e PIX (R$ 5/7) | GAS lia coluna `VALOR` (inexistente) → fallback incorreto para TOTAL_PARCELAS | `ipVal = (cmP["VALOR_PARCELA"] \|\| cmP["VALOR"] \|\| 8)-1` — nome de coluna tem prioridade |
| Régua: PIX 500 para parcelas vencidas | Efí rejeita cobv com data de vencimento no passado | `api/efi-pix-avulso.js`: usa data de hoje (BR) quando dataVenc < today |
| Régua: reenvio bloqueado após erro do dia | `_jaEnviouHoje` bloqueava em qualquer log, incluindo ERRO | Agora só bloqueia se `STATUS_ENVIO = "ENVIADO"` |
| Simulador: valor revertia para múltiplo de 50 | `step={50}` + `Math.round(value/50)*50` arredondava 1360 → 1350 | `step={1}` sem snap para múltiplo de 50 |

---

## 13. Roadmap Estratégico

| Fase | Descrição | Prioridade | Estado |
|---|---|---|---|
| 0 | Formalização jurídica + conta Google corporativa | Alta (blocker legal) | Pendente |
| 1A | Motor analítico: LTV, ROI, tab Inteligência, PADRINHOS, EMPREGADORES | Alta | **Concluído** |
| 1A.1 | Design System + refatoração shadcn | Alta | **Concluído** |
| 1A.2 | Carteira de Recuperação Assistida (acordo_assistido + PERFIL_COBRANCA) | Alta | **Concluído (2026-06-14)** |
| 1B | Régua de cobrança automática (Evolution GO + PIX Efí + log MENSAGENS) | Alta | **Concluído (2026-06-15)** |
| 1B.1 | Editor de templates de mensagem no painel + confirmação automática de pagamento via WPP | Alta | **Concluído (2026-06-15)** |
| PDD | Provisão para Devedores Duvidosos — DRE provisionado mensal | Média | **Pendente decisão de percentuais** |
| 2 | Portal do cliente (PWA) | Baixa | Pendente (pós-Supabase) |
| 3 | Migração Google Sheets → Supabase | Baixa | Pendente |

---

*Gerado pelo Claude Code. Última atualização: 2026-06-15.*
