# Brief Completo — Fluxo de Pagamentos, Renegociação e Baixa de Contratos
## Borges Assessoria — FinanceiroOp

> **Para:** Agente de IA externo  
> **Objetivo:** Entender o sistema completo de gestão de contratos para assessorar o operador (Alex Borges) no desenho de um fluxo de renegociação de contratos em atraso.  
> **Data de referência:** 2026-06-20

---

## 1. O Negócio em 30 Segundos

**Borges Assessoria** é uma financeira informal operada por Alex Borges. Capital 100% próprio. Empresta para trabalhadores CLT captados por indicação. Cobra juros mensais. Recebe via PIX.

**Modelo financeiro:**
- Principal emprestado: R$ 500 a R$ 4.000 (depende do score e histórico do cliente)
- Prazo: 1x a 12x
- Taxa: 14% a 25% ao mês (depende do score)
- Receita = juros mensais
- Risco = inadimplência e baixa como prejuízo

**Por que renegociação importa:** no crédito pessoal informal, o pior cenário não é o cliente pagar menos — é o cliente parar de pagar e desaparecer. Um cliente pagando parcelas reduzidas por mais tempo mantém o relacionamento, gera receita e evita a perda total do capital.

---

## 2. Ciclo Completo do Contrato

```
CAPTAÇÃO → CADASTRO → APROVAÇÃO → CONTRATO → CARNÊ PIX → PAGAMENTOS → QUITAÇÃO
                                                                 │
                                                         INADIMPLÊNCIA
                                                                 │
                                          ┌──────────────────────────────────────┐
                                          │                                      │
                                   ACORDO ASSISTIDO                    RENEGOCIAÇÃO (NOVO)
                                   (dificuldade temp.)            (alterar parcelas/prazo)
                                          │                                      │
                                          └──────────────┬───────────────────────┘
                                                         │
                                                    BAIXA COMO PREJUÍZO
                                                         │
                                                    RECUPERAÇÃO PÓS-BAIXA
```

---

## 3. Estrutura de Dados (Banco de Dados = Google Sheets)

### 3.1 CONTRATOS — campos-chave

| Campo | Tipo | Descrição |
|---|---|---|
| ID_CONTRATO | Texto | `PCL-Nº NNN` (ex: PCL-Nº 42) |
| ID_CLIENTE | Texto | FK para CLIENTES |
| DATA_EMPRESTIMO | Data | Data da liberação do dinheiro |
| DATA_PRIMEIRA_PARCELA | Data | Vencimento da 1ª parcela |
| VALOR_PRINCIPAL | Moeda | Capital emprestado |
| NUM_PARCELAS | Número | Quantidade total de parcelas |
| TAXA_JUROS_MENSAL | Decimal | Ex: 0.18 = 18% ao mês |
| TAXA_JUROS_TOTAL | Decimal | Taxa total acumulada |
| JUROS_TOTAL | Moeda | Valor total de juros do contrato |
| VALOR_TOTAL | Moeda | Principal + juros total |
| VALOR_PARCELA | Moeda | Valor médio por parcela |
| PARCELA_PRINCIPAL | Moeda | Parte principal por parcela |
| PARCELA_JUROS | Moeda | Parte de juros por parcela |
| STATUS_CONTRATO | Enum | Ver seção 4 |
| VALOR_ACORDO | Moeda | Preenchido em renegociação com perda |
| DATA_ACORDO | Data | Data do acordo formal |
| DESCONTO_PRINCIPAL_ACORDO | Moeda | Desconto no principal em acordo com perda |
| DESCONTO_JUROS_ACORDO | Moeda | Desconto nos juros em acordo com perda |
| DATA_ENTRADA_ACORDO_ASSISTIDO | Data | Data de entrada no Acordo Assistido |
| MOTIVO_ACORDO_ASSISTIDO | Enum | Demissão / Afastamento INSS / Problema de saúde / Redução de renda / Outro |
| VALOR_ABATIDO_ASSISTIDO | Moeda | Acumulado de abatimentos durante Acordo Assistido |

### 3.2 PARCELAS — campos-chave

| Campo | Tipo | Descrição |
|---|---|---|
| ID_PARCELA | Texto | Sequencial 5 dígitos (ex: 00042) |
| ID_CONTRATO | Texto | FK → CONTRATOS |
| ID_CLIENTE | Texto | FK → CLIENTES |
| NUM_PARCELA | Número | Número desta parcela (1, 2, 3...) |
| TOTAL_PARCELAS | Número | Total de parcelas **deste contrato** — atualizado se o número mudar |
| DATA_VENCIMENTO | Data | Data de vencimento original |
| VALOR_PARCELA | Moeda | Valor original desta parcela |
| VALOR_PRINCIPAL | Moeda | Parte principal |
| VALOR_JUROS | Moeda | Parte de juros |
| STATUS | Enum | Ver seção 5 |
| DATA_PAGAMENTO | Data | Data efetiva do pagamento |
| VALOR_PAGO | Moeda | Valor efetivamente pago |
| TIPO_PAGAMENTO | Enum | Ver seção 6 |
| ORIGEM_PARCELA | Enum | `original` / `gerada_por_pagamento_de_juros` |
| DATA_ACORDO | Data | Data prometida para pagar (promessa) |
| DESCONTO_APLICADO | Moeda | Desconto concedido nos juros |
| RECEITA_EXTRA_ATRASO | Moeda | Valor extra recebido por juros/multa de atraso |
| EFI_PIX_CODE | Texto | Código PIX cobv salvo (reutilizado na régua) |
| EFI_TXID | Texto | ID da cobrança na Efí Bank |

### 3.3 PAGAMENTOS — campos-chave

Registro **imutável** de cada transação financeira.

| Campo | Tipo | Descrição |
|---|---|---|
| ID_PAGAMENTO | Texto | PAG00001, PAG00002... |
| ID_PARCELA | Texto | FK → PARCELAS (vazio para abatimento_acordo_assistido) |
| ID_CONTRATO | Texto | FK → CONTRATOS |
| ID_CLIENTE | Texto | FK → CLIENTES |
| DATA_PAGAMENTO | Data | Data do recebimento |
| VALOR_ORIGINAL_PARCELA | Moeda | Valor original da parcela |
| VALOR_PAGO | Moeda | Valor recebido |
| RECEITA_EXTRA_ATRASO | Moeda | Extra por mora/multa |
| TIPO_PAGAMENTO | Enum | Ver seção 6 |
| FORMA_PAGAMENTO | Enum | `dinheiro` / `pix` / `transferencia` / `pix_efi` |

### 3.4 ACORDOS — renegociação formal com perda

| Campo | Descrição |
|---|---|
| ID_ACORDO | ACO00001... |
| ID_CONTRATO / ID_CLIENTE | FKs |
| DATA | Data do acordo |
| VALOR_DIVIDA_ORIGINAL | Soma do que era devido |
| VALOR_ACORDADO | O que foi aceito receber |
| DESCONTO_PRINCIPAL | Quanto do capital foi perdido |
| DESCONTO_JUROS | Quanto dos juros foi cancelado |
| STATUS | QUITADO |

### 3.5 PROMESSAS

| Campo | Descrição |
|---|---|
| ID_PROMESSA | PRM00001... |
| DATA_PREVISTA_PAGAMENTO | Data prometida |
| VALOR_PROMETIDO | Valor prometido |
| STATUS_PROMESSA | `PENDENTE` → `CUMPRIDA` / `QUEBRADA` |

### 3.6 CLIENTES — campos relevantes para cobrança/renegociação

| Campo | Descrição |
|---|---|
| PERFIL_COBRANCA | `COOPERATIVO` / `NEUTRO` / `RESISTENTE` / `EVASIVO` — comportamento de resposta à cobrança |
| QUALIDADE_COMUNICACAO | `Boa` / `Regular` / `Ruim` |
| SCORE | 0–100 — score de crédito calculado automaticamente |
| SCORE_BLOQUEADO | `SIM` / `NAO` — bloqueado para novo crédito |

---

## 4. Ciclo de Status dos Contratos

### Diagrama de transições

```
ativo_em_dia
    │
    ├─ (atraso 1–30d)   ──→ ativo_em_atraso
    ├─ (atraso 31–60d)  ──→ em_cobranca
    ├─ (atraso 61–120d) ──→ pre_prejuizo
    ├─ (atraso >120d)   ──→ permanece em pre_prejuizo (baixa é manual)
    │
    ├─ [ação manual]    ──→ acordo_assistido ─────────────────────────────────┐
    │                             │                                           │
    │                     ┌───────┴────────────┐                             │
    │                     ↓                    ↓                             │
    │               [180d sem abat.]     [retorno manual]                    │
    │                     ↓                    ↓                             │
    │               pre_prejuizo         recalcula por dias ──────────────────┘
    │
    ├─ [NOVO — não existe ainda] ──→ renegociado_ativo (alterar parcelas/prazo)
    │                                       │
    │                                  continua pagando
    │                                  parcelas novas
    │
    └─ [baixa manual]   ──→ baixado_como_prejuizo
                                    │
                               em_recuperacao
                                    │
                    ┌───────────────┴───────────────────┐
                    ↓                                   ↓
        recuperado_parcialmente          recuperado_integralmente
                    │
                    └──→ encerrado_sem_recuperacao
```

### Critério de dias de atraso por status

| Dias de atraso | Status do contrato | Ação sugerida pelo sistema |
|---|---|---|
| 0 | `ativo_em_dia` | Régua preventiva D-5/D-1/D0 |
| 1–30 | `ativo_em_atraso` | Régua D+1/D+3/D+7 via WhatsApp + PIX |
| 31–60 | `em_cobranca` | Intensificar contato, registrar promessa |
| 61–120 | `pre_prejuizo` | Contato com pessoas de confiança, propor acordo |
| > 120 | `pre_prejuizo` | Avaliar baixa, Acordo Assistido, ou **Renegociação** |

### Regras importantes

- **Atualização automática:** trigger diário às 7h recalcula status de todos os contratos não terminais com base nos dias de atraso da parcela mais velha aberta.
- **Status terminais** (trigger diário não reverte): `baixado_como_prejuizo`, `em_recuperacao`, `recuperado_parcialmente`, `recuperado_integralmente`, `encerrado_sem_recuperacao`, `cancelado`, `renegociado`, `quitado`
- **`acordo_assistido`:** não é recalculado pelo trigger; só aplica regra de 180 dias de inatividade.

---

## 5. Status de Parcelas

| Status | Terminal? | Descrição |
|---|---|---|
| `pendente` | Não | Dentro do prazo |
| `vence_hoje` | Não | Vence hoje |
| `atrasado` | Não | Passou do vencimento |
| `reagendado` | Não | Tem DATA_ACORDO futura — não aparece em atraso |
| `pago` | **Sim** | Paga normalmente |
| `quitacao_antecipada` | **Sim** | Paga antecipadamente |
| `baixado_como_prejuizo` | **Sim** | Baixada como perda |
| `cancelado` | **Sim** | Cancelada |
| `renegociado` | **Sim** | Incluída em acordo com perda (contrato encerrado) |

**Regra crítica:** status terminais **nunca** são reabertos automaticamente.

---

## 6. Tipos de Pagamento (TIPO_PAGAMENTO)

| Tipo | Quando | Contabilização |
|---|---|---|
| `pagamento_normal` | Pago na data ou antes do atraso | Receita |
| `pagamento_antecipado` | Pago antes do vencimento | Receita |
| `pagamento_com_atraso` | Pago após o vencimento | Receita |
| `somente_juros` | Só juros pagos; principal é rolado para nova parcela | Receita (só juros) |
| `quitacao_antecipada` | Liquidação antecipada com desconto possível | Receita |
| `recuperacao_apos_baixa` | Recebimento após baixa como prejuízo | Capital recuperado |
| `acordo_com_perda` | Valor menor do que a dívida total | Capital recuperado |
| `abatimento_acordo_assistido` | Pagamento livre durante Acordo Assistido | Capital recuperado (nunca receita) |

---

## 7. Operações de Pagamento Atuais — Fluxos Detalhados

### 7.1 Pagamento Normal / Com Atraso / Antecipado

**Frontend (ContratoModal ou PagamentoDrop no Dashboard/Cobrança):**
1. Alex seleciona a parcela → clica em "Registrar Pagamento"
2. Modal exibe: valor da parcela, data sugerida (hoje), forma de pagamento
3. Campo "Desconto nos Juros" aparece SOMENTE se `TIPO = Pagamento Total` e parcela tem `VALOR_JUROS > 0`
4. Alex confirma → `postAction({ action: "registrarPagamento", ... })` → GAS

**Backend (GAS `registrarPagamentoAPI`):**
1. Marca parcela com `STATUS = pago` / `DATA_PAGAMENTO` / `VALOR_PAGO` / `TIPO_PAGAMENTO`
2. Limpa `DATA_ACORDO` da parcela (promessa cumprida)
3. Registra linha em PAGAMENTOS
4. Registra evento em EVENTOS
5. Se todas as parcelas do contrato ficarem terminais → contrato vira `quitado`
6. Recalcula `calcularMetricasCliente()` imediatamente
7. Cancela PROMESSAS PENDENTE do contrato
8. Envia mensagem de confirmação por WhatsApp (`_enviarConfirmacaoPagamento`)

### 7.2 Pagamento Somente Juros

Usado quando o cliente consegue pagar apenas os juros desta parcela.

**Frontend:** opção no seletor de tipo de pagamento.

**Backend (GAS `registrarPagamentoParcial`):**
1. Marca parcela atual como `pago` com `TIPO = somente_juros`
2. Cria **nova parcela** no final do carnê com o mesmo valor original, vencimento = último vencimento + 1 mês
3. Incrementa `TOTAL_PARCELAS` em TODAS as parcelas do contrato
4. Registra em PAGAMENTOS
5. Registra evento

**Efeito:** o principal é rolado. O cliente pagou os juros mas o capital continua devendo. O carnê fica uma parcela maior.

### 7.3 Quitação Antecipada

**Frontend:** Alex seleciona quais parcelas futuras liquidar + desconto opcional nos juros.

**Backend:**
1. Distribui o desconto proporcionalmente entre as parcelas selecionadas
2. Cada parcela gera um registro separado em PAGAMENTOS
3. `TIPO_PAGAMENTO = quitacao_antecipada`
4. Se todas ficarem pagas → contrato vira `quitado`

### 7.4 Acordo Assistido (status especial para dificuldade temporária)

Para clientes que perderam renda mas mantêm boa comunicação e intenção de pagar.

**Entrada:**
- Alex clica "Acordo Assistido" no ContratoModal
- GAS executa `moverParaAcordoAssistido`: STATUS_CONTRATO = `acordo_assistido`, VALOR_ABATIDO_ASSISTIDO = 0, registra motivo/observação
- Score **não** é recalculado — fica congelado
- Contrato some da aba Cobrança
- Parcelas originais permanecem no status que estavam (atrasado/pendente)

**Durante o Acordo — Abatimento:**
- Alex registra qualquer valor recebido como "Abatimento"
- GAS executa `registrarAbatimentoAssistido`: incrementa VALOR_ABATIDO_ASSISTIDO
- 100% do valor vai para capital (nunca receita)
- Score permanece congelado
- Parcelas originais não são alteradas

**Capital Restante:**  
`capitalRestante = VALOR_PRINCIPAL − VALOR_ABATIDO_ASSISTIDO`

**Saída:**
- Retorno normal: recalcula status pelos dias de atraso reais → volta ao ciclo de cobrança
- Encaminhamento para baixa: `PREJUIZO_CAPITAL = VALOR_PRINCIPAL − VALOR_ABATIDO_ASSISTIDO`

**Expiração automática:** 180 dias sem abatimento → move para `pre_prejuizo`

### 7.5 Acordo com Perda (renegociação com desconto definitivo)

Para contratos irrecuperáveis onde o cliente paga um valor menor e encerra a dívida.

**O que acontece:**
1. Alex informa valor acordado (menor que a dívida total)
2. GAS calcula DESCONTO_PRINCIPAL e DESCONTO_JUROS
3. Parcelas abertas → status `renegociado` (terminal)
4. Contrato → status `renegociado`
5. Registro criado em ACORDOS
6. Registro em PAGAMENTOS com `TIPO = acordo_com_perda`

**Limitação:** o contrato é encerrado. Não há como continuar pagando parcelado com condições novas.

### 7.6 Baixa como Prejuízo

**Ação:** Alex clica em "Baixar como Prejuízo" no ContratoModal ou PerdaAcoesModal.

**Alex informa:**
- Motivo da baixa
- Possibilidade de recuperação (ALTA/MEDIA/BAIXA)
- Próxima providência

**Backend:**
1. Parcelas abertas → `baixado_como_prejuizo`
2. Contrato → `baixado_como_prejuizo`
3. `PREJUIZO_CAPITAL = VALOR_PRINCIPAL − (capital recuperado pelas parcelas pagas)`
4. Para contratos em `acordo_assistido`: `PREJUIZO_CAPITAL = VALOR_PRINCIPAL − VALOR_ABATIDO_ASSISTIDO`
5. `JUROS_NAO_REALIZADOS` = juros que não serão recebidos
6. Cliente → `STATUS_CLIENTE = bloqueado`
7. Score recalculado (penalização −30)

### 7.7 Recuperação Após Baixa

Para contratos baixados que o cliente decide pagar depois.

**Backend:**
- VALOR_RECUPERADO_APOS_BAIXA acumula
- PREJUIZO_CAPITAL é reduzido
- Se prejuízo zera → `recuperado_integralmente`; senão → mantém `baixado_como_prejuizo` (monitorado)

---

## 8. O que NÃO Existe Hoje: Renegociação Estrutural

### Lacuna identificada

O sistema atual tem duas alternativas para contratos em dificuldade:

| Opção | O que faz | Problema |
|---|---|---|
| Acordo Assistido | Pausa a cobrança, aceita abatimentos livres | Não altera as parcelas nem o carnê; capital devedor só reduz com abatimentos; prazo original permanece |
| Acordo com Perda | Encerra o contrato com desconto | Perde o relacionamento com o cliente; desconto definitivo; sem continuidade de pagamentos parcelados |

**O que falta:** uma renegociação que **mantém o contrato ativo** mas altera as condições — novo valor de parcela e/ou nova quantidade de parcelas — para que o cliente consiga continuar pagando de forma sustentável.

### Cenário típico de uso

Cliente deve 6 parcelas restantes de R$ 350 cada (R$ 2.100 total). Perdeu emprego, está devendo 2 meses. Não consegue pagar R$ 350 mas consegue R$ 180/mês.

**Hoje:** Alex só pode:
- Colocar em Acordo Assistido (pausa, sem carnê claro para o cliente)
- Fazer Acordo com Perda (perde parte, encerra)
- Esperar e pressionar (risco de fuga)

**O que Alex quer:** criar um novo carnê com 10 parcelas de R$ 200 (por exemplo), mantendo o total a receber próximo do original, e continuar a régua automática de cobrança normalmente.

---

## 9. Fluxos do Frontend (Interface do Usuário)

### 9.1 Aba Cobrança

**O que exibe:**
- Todas as parcelas vencidas agrupadas por cliente
- Exclui automaticamente: contratos em `acordo_assistido`, `baixado_como_prejuizo`, `em_recuperacao`, `recuperado_parcialmente`, `recuperado_integralmente`, `encerrado_sem_recuperacao`, `cancelado`, `quitado`, `renegociado`

**Ações disponíveis por parcela:**
- Registrar Pagamento → `PagamentoParcelaModal` (complexo)
- Reagendar (Promessa) → define DATA_ACORDO na parcela, registra em PROMESSAS
- Enviar WhatsApp (manual)
- Gerar PIX cobv

**Como agir em contratos em atraso:**
1. Alex vê a parcela na lista
2. Tenta registrar pagamento ou registrar promessa
3. Se o cliente não responde → perfil muda para RESISTENTE ou EVASIVO
4. Cliente EVASIVO → régua automática o pula
5. Após 60+ dias → ContratoModal → opções de Acordo Assistido ou Baixa

### 9.2 ContratoModal

**Exibe:**
- Tabela de todas as parcelas (com status visual por cor)
- Timeline de eventos do contrato
- KPIs: capital restante, juros pendentes, atraso máximo

**Ações disponíveis (botões):**
- Por parcela individual: Registrar Pagamento, Somente Juros, Reabrir Parcela
- Por contrato: Quitação Antecipada, Acordo Assistido, Abatimento (se em acordo_assistido), Retornar ao Normal, Baixar como Prejuízo

### 9.3 Aba Perdas & Recuperação

**Exibe:**
- Contratos em `acordo_assistido`
- Contratos em `baixado_como_prejuizo`
- Contratos em recuperação

**Ações via `PerdaAcoesModal`:**
- Entrar em Acordo Assistido
- Registrar Abatimento
- Retornar à Cobrança Normal
- Baixar como Prejuízo
- Registrar Recuperação Pós-Baixa

### 9.4 Régua de Cobrança Automática (WhatsApp)

Executa automaticamente às 7h via trigger do GAS.

**Gatilhos:**

| Gatilho | Quando |
|---|---|
| D-5 | 5 dias antes do vencimento |
| D-1 | 1 dia antes |
| D0 | Dia do vencimento |
| D+1 | 1 dia após |
| D+3 | 3 dias após |
| D+7 | 7 dias após |
| PROMESSA_D-1 | Véspera da promessa |
| PROMESSA_D0 | Dia da promessa |
| PROMESSA_D+1 | Dia seguinte da promessa (não cumprida) |

**Regras:**
- Máximo 1 mensagem por cliente por dia
- EVASIVO → pula
- Contratos terminais → ignorados
- Contratos em `acordo_assistido` → ignorados
- Cada mensagem + segundo envio com código PIX (cobv Efí Bank)

---

## 10. Score de Crédito (impacto na renegociação)

| Bloco | Peso | O que avalia |
|---|---|---|
| A — Histórico | 25 pts | Quitados, antecipações, renegociações, prejuízos |
| B — Comportamento | 30 pts | % em dia, atrasos, qualidade comunicação |
| C — Perfil financeiro | 20 pts | Renda, tipo, comprometimento % |
| D — Relacionamento | 15 pts | Tempo como cliente, padrinho, recuperação |
| E — Risco atual | 10 pts | Atraso atual, renegociação ativa, concentração |

**Penalizações relevantes:**
- Atraso atual >7d: −5 a −25
- Renegociação ativa: −10
- Comunicação ruim + atraso: −20
- Prejuízo não recuperado: −30

**Em Acordo Assistido:** score congelado (não penaliza na entrada nem durante o período).

---

## 11. Regras de Integridade Financeiras (invioláveis)

1. **Nenhum dado financeiro pode ser apagado fisicamente** — apenas cancelamentos lógicos
2. **`abatimento_acordo_assistido` nunca é receita** — sempre capital recuperado
3. **`recuperacao_apos_baixa` nunca é receita** — sempre capital recuperado
4. **STATUS terminais de parcela nunca são reabertos automaticamente**
5. **Um cliente nunca pode ter mais de um contrato ativo simultaneamente**
6. **Saldo devedor nunca pode ser negativo**
7. **Toda renegociação deve: preservar histórico, preservar rastreabilidade, registrar data e motivo**
8. **`STATUS_CONTRATO` é a única fonte de verdade** — campo `STATUS_CARTEIRA` é auxiliar/ignorado

---

## 12. O Que Existe no GAS que Pode Ser Reutilizado

### Funções existentes relevantes

```javascript
// Cria contrato + parcelas do zero
novoContrato({ idCliente, valorPrincipal, numParcelas, taxaJuros, dataPrimeiraParcela })

// Marca parcelas com status terminal
// Usado em: acordoComPerda, baixarContratoPrejuizo
setCel(sheet, row, cm, "STATUS", "renegociado")

// Cria parcela avulsa (usada em somente_juros)
// appscript.gs — função _criarParcelaSomenteJuros
// Cria nova linha em PARCELAS com NUM_PARCELA = max(atual) + 1

// Incrementa TOTAL_PARCELAS em todas as parcelas do contrato
// Usado em somente_juros
// loop em todas as parcelas do contrato → setCel TOTAL_PARCELAS novo valor

// Registra evento no audit log
registrarEvento({ idContrato, idCliente, tipoEvento, statusAnterior, statusNovo, ... })

// Calcula métricas do cliente (chamado após toda operação de pagamento)
calcularMetricasCliente(idCliente)

// Recalcula score
calcularScore(idCliente)
```

### Colunas relevantes em PARCELAS que precisariam ser criadas/ajustadas em uma renegociação

- `NUM_PARCELA`: renumerar se as parcelas originais forem encerradas
- `TOTAL_PARCELAS`: atualizar em todas as parcelas novas
- `DATA_VENCIMENTO`: definir nova sequência de datas
- `VALOR_PARCELA`, `VALOR_PRINCIPAL`, `VALOR_JUROS`: novos valores calculados
- `ORIGEM_PARCELA`: novo valor sugerido → `gerada_por_renegociacao`
- `STATUS`: parcelas antigas abertas → `renegociado`

---

## 13. Especificação Final da Renegociação Estrutural

Decisões confirmadas pelo operador em 2026-06-20. Seção está pronta para implementação.

### 13.1 Premissas de Negócio (confirmadas)

- **Manter o cliente pagando é prioridade** — renegociação preferível à baixa como prejuízo
- A renegociação **não é perdão de dívida** — é redistribuição do saldo em novas condições
- Desconto nos juros é possível (opcional), mas nunca no principal
- Máximo 1 renegociação por contrato
- Histórico original preservado (parcelas antigas marcadas como `renegociado`, não deletadas)
- Régua automática de cobrança funciona normalmente para as novas parcelas

### 13.2 Dados Exibidos no Modal

```
── Resumo do Contrato ──
Capital original emprestado:   R$ 2.000,00
Capital já recuperado:         R$ 800,00    (parcelas pagas — parte principal)
Capital ainda faltando:        R$ 1.200,00  ← piso mínimo do acordo

Parcelas abertas: 4 (atrasadas: 2, futuras: 2)
  Principal em aberto: R$ 1.200,00
  Juros em aberto:     R$ 432,00
  Mora estimada:       R$ 38,40
  Saldo total:         R$ 1.670,40

── Condições da Renegociação ──
Valor total renegociado: [R$ 1.632,00] ← editável (sugerido = saldo contratual sem mora)
Desconto nos juros:      [R$ ________] ← opcional; máximo = MIN(R$ 432,00, R$ 432,00) = R$ 432,00
Valor efetivo a receber: [R$ 1.632,00] ← calculado = total renegociado − desconto

⚠️  [aparece se valor_efetivo < capital_faltante]
"Este acordo não cobre o capital investido. Faltam R$ X para recuperar o principal.
 Considere ajuizar a ação antes de aceitar."

✅  [aparece se valor_efetivo >= capital_faltante]
"Acordo cobre o capital. Lucro estimado: R$ X"

── Nova Tabela de Parcelas ──
Novo valor de parcela: [R$ ______] ← editável
Nova quantidade:       [______]    ← editável
  (editar um campo → recalcula o outro automaticamente)

Data da 1ª nova parcela: [dd/mm/aaaa]

── Simulação ──
"10 parcelas de R$ 163,20 com 1ª em 10/07/2026"
```

### 13.3 Cálculos

```
// Resumo financeiro
juros_em_aberto        = Σ VALOR_JUROS das parcelas abertas
principal_em_aberto    = Σ VALOR_PRINCIPAL das parcelas abertas
saldo_contratual       = principal_em_aberto + juros_em_aberto

// Piso de segurança do capital
capital_investido      = VALOR_PRINCIPAL do contrato (campo CONTRATOS)
capital_já_recuperado  = capital_investido − principal_em_aberto
capital_faltante       = principal_em_aberto  (matematicamente equivalente)

// Teto do desconto — dois limitantes simultâneos
desconto_max = MIN(
  juros_em_aberto,                              // Teto 1: nunca desconta no principal
  valor_total_renegociado − capital_faltante    // Teto 2: não pode ir abaixo do piso de capital
)
// Se valor_total_renegociado < capital_faltante → desconto_max = 0, exibe alerta vermelho

// Valor efetivo e novas parcelas
valor_efetivo       = valor_total_renegociado − desconto_aplicado
nova_parcela_total  = valor_efetivo / nova_quantidade
nova_parcela_princ  = principal_em_aberto / nova_quantidade
nova_parcela_juros  = nova_parcela_total − nova_parcela_princ

// Cálculo cruzado (editar um → recalcula o outro):
se editou valor_parcela:  nova_quantidade    = CEIL(valor_efetivo / novo_valor_parcela)
se editou quantidade:     nova_parcela_total = valor_efetivo / nova_quantidade

// Indicador de viabilidade (exibido no modal em tempo real):
lucro_estimado = valor_efetivo − capital_faltante
// Se lucro_estimado >= 0 → verde "Acordo cobre o capital. Lucro estimado: R$ X"
// Se lucro_estimado < 0  → vermelho "Faltam R$ |lucro| para cobrir o capital. Considere ajuizar."
```

### 13.4 Fluxo Técnico Completo (implementar nesta ordem)

**Etapa 1 — Validação no GAS antes de aceitar:**
```javascript
// 1. Verifica se contrato existe e está ativo
// 2. Verifica se não foi renegociado antes:
var jaRenegociado = parcelasDoContrato.some(p => p.ORIGEM_PARCELA === "renegociada");
if (jaRenegociado) throw new Error("Contrato já foi renegociado anteriormente.");
// 3. Verifica se há parcelas abertas
```

**Etapa 2 — GAS `renegociarContrato(dados)` executa:**
```javascript
// 1. Marca parcelas abertas como "renegociado" (status terminal)
//    Salva DESCONTO_APLICADO = proporção do desconto em cada parcela (para rastreabilidade)

// 2. Descobre o maior NUM_PARCELA atual do contrato (incluindo terminais)
var maxNum = MAX(NUM_PARCELA de todas as parcelas do contrato);

// 3. Cria N novas parcelas com:
//    NUM_PARCELA: maxNum+1, maxNum+2, ..., maxNum+N
//    TOTAL_PARCELAS: maxNum+N  (em TODAS as parcelas novas)
//    VALOR_PARCELA: nova_parcela_total
//    VALOR_PRINCIPAL: nova_parcela_princ
//    VALOR_JUROS: nova_parcela_juros
//    DATA_VENCIMENTO: data_primeira + k meses
//    STATUS: "pendente"
//    ORIGEM_PARCELA: "renegociada"
//    EFI_TXID: vazio (será preenchido depois pelo frontend)

// 4. Atualiza CONTRATOS:
//    STATUS_CONTRATO = "ativo_em_dia"
//    DATA_RENEGOCIACAO = hoje
//    NUM_PARCELAS = maxNum+N  (novo total)
//    VALOR_PARCELA = nova_parcela_total
//    PARCELA_PRINCIPAL = nova_parcela_princ
//    PARCELA_JUROS = nova_parcela_juros

// 5. Registra em EVENTOS:
//    tipoEvento = "RENEGOCIACAO_ESTRUTURAL"
//    statusAnterior = status anterior do contrato
//    statusNovo = "ativo_em_dia"
//    valorPrincipal = principal_em_aberto
//    valorJuros = juros_em_aberto - desconto_concedido
//    valorTotal = valor_efetivo

// 6. Recalcula score (penaliza -10 por renegociação ativa — já na lógica existente)
calcularScore(idCliente);
```

**Retorno do GAS para o frontend:**
```json
{
  "ok": true,
  "novasParcelas": [
    { "idParcela": "00087", "numParcela": 7, "totalParcelas": 16, 
      "dataVencimento": "2026-07-10", "valorParcela": 163.20 },
    ...
  ],
  "cliente": { "cpf": "12345678901", "nome": "João Silva" }
}
```

**Etapa 3 — Frontend gera PIX para as novas parcelas:**
```javascript
// Chama POST /api/efi-charges com as novas parcelas retornadas
// Recebe { boletos: [{ numParcela, txid, pixCopiaECola, ok }] }
// Chama postAction({ action: "salvarCobrancasEfi", cobracas: boletos })
// GAS salva EFI_TXID e EFI_PIX_CODE em cada nova parcela da aba PARCELAS
```

**Etapa 4 — Sistema continua funcionando normalmente:**
- Régua automática (7h) detecta as novas parcelas e envia WhatsApp + PIX nos gatilhos D-5, D-1, D0...
- Webhook Efí identifica pagamento por `contractNum + numParcela` → encontra as novas parcelas
- Polling diário verifica cobranças pendentes

---

## 14. Fluxo Técnico Completo — Geração de PIX e Identificação de Pagamento

Esta seção documenta como o sistema existente trata PIX de ponta a ponta, para que a renegociação seja construída de forma compatível.

### 14.1 Como o TXID é Construído

```
TXID = "FOP" + contractNum (16 dígitos, zero-padded) + "P" + parcelaNum (6 dígitos, zero-padded)
Tamanho: 26 caracteres
Limite da Efí: 35 caracteres

Exemplo: FOP0000000000000042P000003
         = contrato PCL-Nº 42, parcela 3

Fallback: se o TXID base está CONCLUIDA ou REMOVIDA na Efí:
  Tenta: FOP0000000000000042P000003R1  (28 chars)
  Tenta: FOP0000000000000042P000003R2  (30 chars)
```

A função `buildTxid(idContrato, numParcela)` extrai o número do contrato com `parseInt(idContrato.replace(/\D/g,""))`.

### 14.2 Como a Efí Bank Recebe o PIX

**Endpoint:** `POST /api/efi-charges` (lote) ou `POST /api/efi-pix-avulso` (individual via régua)

**Payload por parcela:**
```json
{
  "calendario": { "dataDeVencimento": "2026-07-10", "validadeAposVencimento": 30 },
  "devedor": { "cpf": "12345678901", "nome": "João Silva" },
  "valor": {
    "original": "350.00",
    "multa":  { "modalidade": 2, "valorPerc": "2.00" },
    "juros":  { "modalidade": 2, "valorPerc": "0.03" }
  },
  "chave": "<EFI_PIX_KEY>",
  "solicitacaoPagador": "Parcela 3 de 6 - PCL-Nº 42"
}
```

**Método Efí:** `PUT /v2/cobv/{txid}` — cria ou atualiza cobv (idempotente por TXID)

**Retorno guardado em PARCELAS:**
- `EFI_TXID` = txid usado (pode ter R1/R2 sufixo)
- `EFI_PIX_CODE` = código Pix Copia e Cola
- `EFI_LINK` = link da cobrança
- `EFI_STATUS` = "ativo"

**Quando a parcela venceu:** `api/efi-charges.js` e `api/efi-pix-avulso.js` verificam se `dataVencimento < hoje (BR)` e substituem por hoje — Efí rejeita cobv com data no passado.

### 14.3 Como o Webhook Identifica o Pagamento

**Fluxo:**
```
Cliente paga PIX  →  Efí Bank  →  POST /api/webhook-efi  →  GAS pagamentoAutomatico()
```

**`/api/webhook-efi.js` — função `parseTxid(txid)`:**
```javascript
// Extrai contractNum e parcelaNum do TXID independente do sufixo R1/R2
contractNum = parseInt(txid.slice(3, 19))   // posições 3-19
parcelaNum  = parseInt(txid.slice(20, 26))  // posições 20-26
// Sufixo "R1"/"R2" é ignorado — parsing para em 26 chars
```

Chama GAS com: `action: "pagamentoAutomatico", contractNum, numParcela, valor, data, txid`

**`pagamentoAutomatico()` no GAS:**
```javascript
// Busca parcela na aba PARCELAS por:
//   1. ID_CONTRATO numérico === contractNum
//   2. NUM_PARCELA === numParcela
//   3. STATUS não-terminal (não está pago/cancelado/renegociado/etc)
// Encontra o ID_PARCELA real → chama registrarPagamentoAPI(idParcela, ...)
```

**Proteção de idempotência:** checa `OPERACOES_PROCESSADAS` antes de registrar. Se TXID já foi processado, bloqueia.

### 14.4 Segundo Caminho — Polling Diário

Além do webhook, o trigger das 7h chama `verificarPagamentosEfi()` que:
1. Lê todas as parcelas com `EFI_TXID` preenchido e status não-terminal
2. Consulta `POST /api/efi-check-payments` com lista de TXIDs
3. Para cada cobv `CONCLUIDA` na Efí, chama `pagamentoAutomatico()` localmente
4. Garante que pagamentos cuja notificação webhook falhou sejam processados

### 14.5 O Ponto Crítico para a Renegociação: TXID não pode colidir

**Cenário:** Contrato PCL-Nº 42 tinha 6 parcelas. 3 já foram pagas (parcelas 1, 2, 3 → TXIDs `...P000001/2/3` com status CONCLUIDA na Efí). Parcelas 4, 5, 6 estão em aberto.

**Ao renegociar:** Alex quer cancelar as parcelas 4, 5, 6 e criar 10 parcelas novas com valor menor.

**Solução:** as novas parcelas devem continuar a numeração a partir do máximo existente + 1.

```
Parcelas originais:  1, 2, 3 (pagas)  4, 5, 6 (abertas → renegociado)
Parcelas novas:      7, 8, 9, 10, 11, 12, 13, 14, 15, 16

TXIDs novos:
  FOP0000000000000042P000007  ← sem conflito com originais!
  FOP0000000000000042P000008
  ...
  FOP0000000000000042P000016
```

**Por que isso funciona:**
- `pagamentoAutomatico()` busca por `contractNum + numParcela` na aba PARCELAS, onde `numParcela` é o `NUM_PARCELA` da linha
- Quando o cliente paga parcela 7 via PIX, o webhook recebe o TXID `...P000007`, extrai parcelaNum=7, busca no Sheets a linha com `NUM_PARCELA=7` do contrato 42 → encontra corretamente
- As parcelas antigas (1-6) têm TXIDs completamente diferentes → sem ambiguidade

**TOTAL_PARCELAS:** precisa ser atualizado em TODAS as parcelas do contrato para refletir o novo total (incluindo as renegociadas, pagas e as novas).

### 14.6 Fluxo Técnico Completo da Renegociação — Passo a Passo

**Etapa 1 — GAS: `renegociarContrato(dados)`** (função a criar)

```javascript
// Input:
// dados.idContrato         = "PCL-Nº 42"
// dados.novoValorParcela   = 200.00  (ou)
// dados.novoNumParcelas    = 10
// dados.dataPrimeiraNovaParcela = "2026-07-20"
// dados.taxaJurosNova      = 0.18  (opcional, pode manter a original)
// dados.observacao         = "Renegociação: cliente pediu redução de parcelas"

// Passo 1: busca parcelas abertas do contrato
// → soma VALOR_PARCELA de todas as abertas = saldo_devedor
// → soma VALOR_PRINCIPAL das abertas = capital_em_aberto

// Passo 2: marca parcelas abertas como "renegociado"
// → setCel STATUS = "renegociado" em cada linha

// Passo 3: calcula novos valores
// → novo_total = saldo_devedor (ou outro valor acordado)
// → novo_valor_parcela = novo_total / novoNumParcelas
// → nova_parcela_principal = capital_em_aberto / novoNumParcelas
// → nova_parcela_juros = (novo_total - capital_em_aberto) / novoNumParcelas

// Passo 4: cria novas parcelas (continuando numeração)
// → max_num_parcela = MAX(NUM_PARCELA) de todas as parcelas do contrato (incluindo terminais)
// → novas parcelas com NUM_PARCELA = max+1, max+2, ..., max+novoNumParcelas
// → TOTAL_PARCELAS nas novas = max+novoNumParcelas
// → ORIGEM_PARCELA = "renegociada"
// → STATUS = "pendente"

// Passo 5: atualiza TOTAL_PARCELAS em TODAS as parcelas do contrato
// (para refletir o novo total incluindo as renegociadas)

// Passo 6: atualiza CONTRATOS
// → STATUS_CONTRATO = "ativo_em_dia" (resetar pelo trigger ou manualmente)
// → NUM_PARCELAS = max+novoNumParcelas
// → VALOR_PARCELA = novo_valor_parcela
// → DATA_RENEGOCIACAO = hoje  (campo novo, ou usar DATA_ACORDO)
// → OBSERVACAO_RENEGOCIACAO = dados.observacao

// Passo 7: registra em EVENTOS
// → tipoEvento = "RENEGOCIACAO_ESTRUTURAL"
// → valorTotal = novo_total

// Passo 8: penaliza score
// → calcularScore(idCliente)  // score já penaliza -10 por renegociação ativa
```

**Etapa 2 — Frontend: após GAS confirmar OK**

```javascript
// Pega as novas parcelas retornadas pelo GAS
// Chama POST /api/efi-charges com:
//   { idContrato, parcelas: novasParcelas, cliente }
// Recebe { boletos: [{ numParcela, txid, pixCopiaECola, ok }] }
// Chama postAction({ action: "salvarCobrancasEfi", cobracas: boletos })
// → GAS salva EFI_TXID e EFI_PIX_CODE em cada nova parcela
```

**Etapa 3 — Pagamento pelo cliente**

```
Cliente paga PIX da parcela 7
→ Efí Bank dispara webhook → /api/webhook-efi
→ parseTxid extrai: contractNum=42, parcelaNum=7
→ pagamentoAutomatico(42, 7, 350.00, "2026-07-10")
→ busca linha com ID_CONTRATO="PCL-Nº 42" + NUM_PARCELA=7 + status não-terminal
→ encontra a nova parcela renegociada
→ registrarPagamentoAPI(idParcela, data, valor, "pix_efi")
→ envia confirmação WhatsApp ao cliente
```

---

## 15. Decisões de Negócio — FINALIZADAS pelo Operador

As decisões abaixo foram confirmadas pelo operador (Alex Borges) em 2026-06-20. **Implementar conforme especificado aqui.**

---

**Decisão 1 — O que entra no saldo da renegociação: FLEXÍVEL**

O operador define caso a caso. O modal deve exibir:
- Saldo devedor contratual = `Σ VALOR_PARCELA` das parcelas abertas (principal + juros contratuais)
- Mora/multa acumulada = `Σ RECEITA_EXTRA_ATRASO` não cobrada ainda (estimativa)
- Campo "Valor Total Renegociado" editável — Alex pode aceitar o saldo cheio ou um valor menor

Ou seja: o modal mostra o saldo completo como referência, mas Alex tem controle total sobre o valor que vai entrar na renegociação.

---

**Decisão 2 — Taxa de juros: NÃO MUDA. Desconto nos juros: SIM, com dois tetos simultâneos**

A taxa de juros permanece a mesma do contrato original. A renegociação não cria novos juros — redistribui o saldo devedor existente em novas parcelas.

Alex pode conceder um **desconto nos juros** como incentivo ao acordo. As regras são:

**Teto 1 — nunca desconta no principal:**
- Desconto se aplica SOMENTE sobre `VALOR_JUROS` das parcelas abertas
- Desconto máximo absoluto = `Σ VALOR_JUROS das parcelas abertas`

**Teto 2 — o acordo deve cobrir no mínimo o capital investido ainda não recuperado:**
```
capital_investido      = VALOR_PRINCIPAL do contrato (o que Alex emprestou)
capital_já_recuperado  = Σ VALOR_PRINCIPAL das parcelas já pagas
capital_faltante       = capital_investido − capital_já_recuperado
                       (= principal_em_aberto matematicamente)

desconto_máximo_real   = MIN(
  juros_em_aberto,                             ← Teto 1
  valor_total_renegociado − capital_faltante   ← Teto 2
)
```

**Alerta de inviabilidade:** se o valor total renegociado (mesmo sem nenhum desconto) for menor que `capital_faltante`, o modal exibe:

> ⚠️ "Este acordo não cobre o capital investido. Faltam R$ [X] para recuperar o principal. Considere ajuizar a ação antes de aceitar."

Nesse caso, o campo de desconto é desabilitado (não há margem para desconto) e Alex pode ainda assim confirmar o acordo (decisão dele), mas com o alerta visível.

**Rastreabilidade:**
- Desconto registrado como `DESCONTO_APLICADO` nas parcelas encerradas (marcadas como `renegociado`)
- Distribuído proporcionalmente entre as parcelas abertas (mesmo padrão da Quitação Antecipada)

---

**Decisão 3 — Máximo de renegociações: 1 por contrato**

Um contrato só pode ser renegociado uma vez. Antes de abrir o modal, o GAS valida:
```javascript
// Bloqueia se já existe qualquer parcela com ORIGEM_PARCELA = "renegociada" neste contrato
var jaRenegociado = parcelas.some(p => p.idContrato === idContrato && p.origemParcela === "renegociada");
if (jaRenegociado) throw new Error("Contrato já foi renegociado anteriormente.");
```

---

**Decisão 4 — Interface: AMBOS os campos editáveis com cálculo automático cruzado**

O modal exibe dois campos simultâneos:
- **Novo valor de parcela (R$)** — Alex edita → sistema calcula quantas parcelas resultam
- **Nova quantidade de parcelas** — Alex edita → sistema calcula o valor de cada parcela

Comportamento: ao editar um campo, o outro é recalculado automaticamente. Alex pode ajustar iterativamente até chegar no acordo ideal com o cliente.

Fórmula base:
```
novo_valor_parcela = valor_total_renegociado / nova_quantidade_parcelas
nova_quantidade_parcelas = CEIL(valor_total_renegociado / novo_valor_parcela)
```

---

**Decisão 5 — STATUS_CONTRATO após renegociação: `ativo_em_dia` + campo DATA_RENEGOCIACAO**

O STATUS_CONTRATO volta para `ativo_em_dia`. O trigger diário recalcula normalmente pelas datas das novas parcelas.

Para manter visibilidade, dois elementos são adicionados:
1. Campo `DATA_RENEGOCIACAO` em CONTRATOS — preenchido com a data do acordo
2. Badge "Renegociado" no ContratoModal — detectado por `parcelas.some(p => p.ORIGEM_PARCELA === "renegociada")` — sem criar novo status

Razão: criar um status `renegociado_ativo` quebraria 7+ pontos no código (trigger, `_ST_ATIVOS`, cobrança, score, etc.) sem benefício real. A rastreabilidade está garantida pelos campos `DATA_RENEGOCIACAO` + `ORIGEM_PARCELA = "renegociada"` + evento `RENEGOCIACAO_ESTRUTURAL` em EVENTOS.

---

## 16. Stack Técnico (Para o Agente de IA que For Implementar)

### Frontend
- React 18 + Vite
- Arquivo único: `src/main.jsx` (~6000 linhas)
- Sem componentes separados (exceto `src/components/ui/` com shadcn)
- 100% inline styles com variáveis de tema (BG, CARD, TEXT, GRN, RED, BLU, etc.)
- `postAction(body)` → POST para `/api/action` → GAS

### Backend
- Google Apps Script (`appscript.gs`)
- `doPost(e)` → switch por `action` → executa função
- Banco de dados: Google Sheets (11 abas)
- `buildColMap(sheet)` → mapa dinâmico de colunas (nunca usar índice fixo)
- `setCel(sheet, row, cm, "COLUNA", value)` → escrever por nome
- `parseDateLocal(s)` → datas sem bug de timezone UTC-3
- `proximoIdSeq(sheet, "PREFIX")` → IDs sequenciais

### Hospedagem
- Vercel (frontend + APIs proxy)
- `vercel deploy --prod` após qualquer mudança em `src/main.jsx` ou `api/*.js`
- GAS: substituição completa do arquivo + publicar nova versão do Web App

### Integração PIX (Efí Bank)
- Tipo cobv (PIX com vencimento)
- Para parcelas novas em renegociação: gerar novo cobv por parcela via `api/efi-charges.js`
- TXID: `FOP` + número do contrato (16 dígitos) + `P` + número da parcela (6 dígitos)

---

## 17. Resumo — O Que Existe vs O Que Precisa Ser Criado

### O que já existe e funciona sem mudança

| Componente | Status | Como aproveitar na renegociação |
|---|---|---|
| `api/efi-charges.js` | Pronto | Chamado com as novas parcelas — gera cobv por parcela |
| `api/efi-pix-avulso.js` | Pronto | Régua de cobrança vai cobrar as novas parcelas automaticamente |
| `api/webhook-efi.js` | Pronto | Identifica pagamento por contractNum + parcelaNum (extraído do TXID) — funciona para parcelas novas sem mudança de código |
| `pagamentoAutomatico()` no GAS | Pronto | Busca parcela por contractNum + NUM_PARCELA — funciona para parcelas novas sem mudança |
| `registrarPagamentoAPI()` no GAS | Pronto | Registra pagamento, envia confirmação WhatsApp, recalcula score |
| `salvarCobrancasEfi()` no GAS | Pronto | Salva EFI_TXID e EFI_PIX_CODE nas parcelas |
| Régua automática WhatsApp | Pronto | Vai cobrar as novas parcelas automaticamente nas datas certas |
| `verificarPagamentosEfi()` | Pronto | Polling diário — detecta pagamentos mesmo se webhook falhar |

### O que precisa ser criado

| O que criar | Onde | Descrição |
|---|---|---|
| `renegociarContrato(dados)` | `appscript.gs` | Nova função GAS: fecha parcelas abertas, cria parcelas novas, atualiza contrato, loga evento |
| `case "renegociarContrato"` | `appscript.gs` `doPost()` | Switch para a nova action |
| `RenegociacaoModal` | `src/main.jsx` | Modal de renegociação: mostra saldo devedor, campos de entrada, simulação, confirmação |
| Botão "Renegociar" | `src/main.jsx` `ContratoModal` | Abre o modal — só visível para contratos com parcelas abertas e status ativo/em atraso |
| Geração de PIX pós-renegociação | `src/main.jsx` | Após GAS confirmar OK: chama `/api/efi-charges` com as novas parcelas + salva no GAS |

### Estimativa de complexidade

| Parte | Esforço |
|---|---|
| Função GAS `renegociarContrato` | Médio (~80 linhas, baseado em `registrarAcordoComPerda` + `gerarParcelas`) |
| Frontend `RenegociacaoModal` | Médio (~150 linhas, baseado em `QuitacaoAntecipadaModal` existente) |
| Integração PIX pós-renegociação | Baixo (reuso total de código existente) |
| Testes e validação | Médio |

---

## 18. Documentos Disponíveis no Projeto

Para leitura completa (caso o agente precise de mais detalhes):

| Arquivo | Conteúdo |
|---|---|
| `MANUAL_OPERACIONAL.md` | Motor de crédito, score, limites, fluxos, estrutura de dados completa |
| `BUSINESS_CONTEXT.md` | Contexto do negócio, stack, integrações, estado atual |
| `docs/ai-memory/01-AI-BUSINESS-DICTIONARY.md` | Dicionário de termos e definições |
| `docs/ai-memory/02-AI-CREDIT-RULES.md` | Regras de crédito (invioláveis) |
| `docs/ai-memory/03-AI-FINANCIAL-CALCULATIONS.md` | Fórmulas e cálculos financeiros |
| `docs/ai-memory/05-AI-ARCHITECTURE-RULES.md` | Arquitetura, constantes de status, padrões de código |
| `docs/ai-memory/06-AI-IMPLEMENTATION-RULES.md` | Checklist de implementação |
| `docs/ai-memory/07-AI-KNOWN-ISSUES.md` | Bugs conhecidos e débitos técnicos |
| `CLAUDE.md` | Instruções completas para o Claude Code (stack, padrões, convenções) |
| `src/main.jsx` | Frontend completo (~6000 linhas) |
| `appscript.gs` | Backend completo (Google Apps Script) |

---

*Documento gerado em 2026-06-20 para assessorar análise do fluxo de renegociação do FinanceiroOp.*
