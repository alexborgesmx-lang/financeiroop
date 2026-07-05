# REGRAS DE CRÉDITO

## Contratos

Um cliente pode possuir diversos contratos ao longo da vida.

Um cliente nunca pode possuir mais de um contrato ativo simultaneamente.

A criação de um novo contrato deve validar previamente a inexistência de outro contrato ativo.

---

## Parcelas

Toda parcela deve pertencer a um contrato.

Toda parcela deve possuir:

- Número
- Valor
- Data de vencimento
- Status

Nenhuma parcela pode existir sem contrato.

---

## Pagamentos

Todo pagamento normal deve estar vinculado a:

- Cliente
- Contrato
- Parcela

**Exceção — Abatimento Assistido:** o tipo `abatimento_acordo_assistido` vincula a Cliente e Contrato, mas não a uma parcela específica (ID_PARCELA vazio). Esta é a única exceção permitida ao vínculo com parcela.

Nenhum pagamento pode existir sem rastreabilidade.

---

## Pagamento Parcial

Um pagamento parcial não encerra automaticamente uma parcela.

O saldo remanescente deve continuar sendo controlado.

A parcela somente será considerada quitada quando atingir os critérios financeiros definidos pela operação.

---

## Renegociação

Toda renegociação deve:

- Preservar histórico
- Preservar rastreabilidade
- Registrar data
- Registrar motivo

Nenhuma renegociação pode apagar dados históricos.

---

## Recuperação

Recebimentos após baixa devem ser classificados como recuperação.

A recuperação deve permanecer identificável para fins gerenciais.

---

## Cobrança

Cobrança é um estado operacional.

Não altera o histórico financeiro.

Não altera automaticamente valores financeiros.

---

## Acordo Assistido — Regras Específicas

Contratos em `acordo_assistido` seguem regras especiais que **sobrepõem** as regras de cobrança padrão:

1. **Exclusão da fila de cobrança**: contrato some de `parcelasAtrasadas` e da aba Cobrança automaticamente.
2. **Score congelado**: `calcularScore` não é chamado durante entrada, abatimento, ou permanência no status. Retoma cálculo normal somente após `sairDoAcordoAssistido`.
3. **Abatimento livre**: qualquer valor, qualquer frequência, sem vínculo com parcela específica.
4. **Contabilização separada**: abatimento é capital recuperado, nunca receita. O Dashboard e aba Financeiro devem excluir `abatimento_acordo_assistido` dos totais de receita.
5. **Bloqueio de pagamento normal**: contrato em `acordo_assistido` não pode receber pagamento de parcela normal. A UI deve exibir apenas o formulário de abatimento.
6. **Baixa usa VALOR_ABATIDO_ASSISTIDO**: ao calcular PREJUIZO_CAPITAL na baixa de um contrato `acordo_assistido`, usar `VALOR_ABATIDO_ASSISTIDO` como capital recuperado (não somar parcelas pagas, que serão zero).
7. **Expiração automática**: trigger diário verifica se passou 180 dias desde o último abatimento (ou desde DATA_ENTRADA_ACORDO_ASSISTIDO se não houver abatimentos). Se sim, move para `pre_prejuizo` e registra evento `ACORDO_ASSISTIDO_EXPIRADO`.
8. **Trigger diário não reverte**: o `atualizarStatusContratos` intercepta `acordo_assistido` antes do recálculo padrão e aplica apenas a regra dos 180 dias (+ `continue` para pular o restante do loop).

---

## Pagamento Somente Juros — Política Formalizada (2026-06-19)

O `somente_juros` é uma prorrogação da parcela: cliente paga apenas os juros do mês e o principal é rolado para uma nova parcela criada automaticamente no final do contrato.

### Regras obrigatórias

1. **Limite de 2 usos por contrato** — 3ª tentativa é bloqueada com erro claro. Campo `TOTAL_SOMENTE_JUROS` em CONTRATOS controla o contador.
2. **Fee de 5% sobre o principal** — cobrado junto com os juros no mesmo pagamento (`vlPago = juros + fee`). Registrado em `FEE_PRORROGACAO` (campo separado de `RECEITA_EXTRA_ATRASO`).
3. **Penalização no score: -10 pts por uso** — acumulativa sobre todos os contratos do cliente. Score recalculado após cada uso.
4. **Parcela nova gerada automaticamente** — criada com `ORIGEM_PARCELA = "gerada_por_pagamento_de_juros"` e `ID_PARCELA_ORIGEM` apontando para a parcela original.

> **Nota (2026-06-20):** Requisito de score mínimo 60 removido. Qualquer cliente pode usar somente_juros independente do score — preferível receber ao menos os juros a não receber nada.

### Contabilidade
- `RECEITA_EXTRA_ATRASO` = mora/multa de atraso real (zero em somente_juros)
- `FEE_PRORROGACAO` = fee de prorrogação (5% do principal)
- Somas financeiras usam `RECEITA_EXTRA_ATRASO + FEE_PRORROGACAO` para cobrir registros antigos e novos

### Reversão (reabertura)
Se a parcela for reaberta via `reabrirParcelaAPI`, a parcela gerada automaticamente é deletada e `TOTAL_SOMENTE_JUROS` é decrementado.

---

## Recuperação Judicial — Regras Específicas (2026-07-04)

`em_processo_judicial` **não é status final** — é o início de uma nova fase do ciclo de vida do contrato, com duas dimensões separadas:

- **Situação do processo** (`STATUS_PROCESSO`): EM_PREPARACAO → AJUIZADO → ... → ARQUIVADO/EXTINTO. Puramente processual.
- **Situação financeira** (`SITUACAO_FINANCEIRA_JUDICIAL`): EM_ABERTO → ACORDO_PARCELADO_ATIVO/ACORDO_QUEBRADO → QUITADO_JUDICIALMENTE / RECUPERADO_PARCIAL / PERDA_JUDICIAL_DEFINITIVA. Independente da situação processual.

`STATUS_CONTRATO` permanece `em_processo_judicial` durante toda a fase ativa. Só vira o status terminal `encerrado_judicialmente` quando a dívida é 100% resolvida (quitação/acordo pago) ou o processo é arquivado sem recuperação total. **Nunca reaproveita os status mortos `recuperado_parcialmente`/`em_recuperacao`** (ver `03-AI-FINANCIAL-CALCULATIONS.md` — esses status são ativamente revertidos por `corrigirStatusRecuperacao`).

### Regras obrigatórias

1. **Ajuizar não bloqueia ação futura** — após `ajuizarContrato`, é possível: registrar acordo judicial (parcelado ou à vista), registrar quitação judicial, adicionar movimentações, e eventualmente arquivar o processo. Nenhuma dessas ações estava disponível antes de 2026-07-04.
2. **Acordo judicial parcelado reaproveita a aba PARCELAS** — novas parcelas marcadas `ORIGEM_PARCELA = "acordo_judicial"`. As parcelas originais em aberto no momento do acordo são marcadas `renegociado` (superadas), mesmo padrão de `registrarAcordoComPerda`.
3. **Bloqueio de crédito é PERMANENTE** — `CLIENTE_JUDICIALIZADO = "SIM"` nunca é limpo, mesmo após quitação total do processo. `criarContrato` valida esse campo no backend (antes só havia bloqueio client-side em `NovoContrato`) e rejeita a criação com erro explícito.
4. **Score sempre bloqueado** — contratos em `em_processo_judicial` ou `encerrado_judicialmente` entram em `ST_PREJ` no `calcularScore`. Como nunca produzimos os status de `ST_RECUP` (dead statuses), `temPreju && !temRecup` fica permanentemente verdadeiro para esses clientes — bloqueio de score nunca é revertido, mesmo com recuperação total.
5. **`em_processo_judicial` não conta mais como "ativo"** — removido de `_ST_ATIVO_C` (GAS) e `_ST_ATIVOS` (frontend). Vira bucket próprio (`_ST_JUDICIAL_C`/`_ST_JUDICIAL`), com contador dedicado `CONTRATOS_EM_JUDICIAL` em CLIENTES.
