# CÁLCULOS FINANCEIROS

Toda alteração financeira exige análise de impacto.

---

## Saldo Devedor

Representa o valor que ainda falta ser recebido pela operação.

Regras:

- Nunca pode ser negativo.
- Deve ser recalculado após cada pagamento.
- Deve refletir renegociações válidas.
- Deve refletir antecipações válidas.

**Em Acordo Assistido:**
```
Saldo Devedor = soma(VALOR_PARCELA das parcelas abertas) − VALOR_ABATIDO_ASSISTIDO
```

---

## Pagamentos

Todo pagamento deve:

- Possuir valor
- Possuir data
- Possuir origem rastreável

Nenhum pagamento pode existir sem vínculo financeiro (cliente + contrato; parcela opcional apenas para `abatimento_acordo_assistido`).

---

## Antecipação

Antecipações devem:

- Reduzir saldo devedor
- Atualizar indicadores
- Preservar histórico

---

## Quitação

Ao quitar um contrato:

- Saldo devedor deve ser zero.
- Contrato deve ser encerrado.
- Histórico deve permanecer preservado.

### Fórmula da Quitação Antecipada (manual e via PIX, 2026-07-04)

Ambos os caminhos — quitação manual (Alex registra direto) e quitação via PIX (`gerarPropostaQuitacaoPix` → `pagamentoQuitacaoWebhook`) — usam a mesma função de registro (`registrarQuitacaoAntecipada`) e a mesma fórmula:

```
desconto      = min(descontoInformado, soma(VALOR_JUROS das parcelas selecionadas))  // nunca desconta no principal
valorFinal    = soma(VALOR_PRINCIPAL) + soma(VALOR_JUROS) − desconto
```

O desconto é rateado por parcela proporcionalmente ao juros dela: `descontoParcela = desconto × (jurosParcela / totalJurosSelecionados)`.

**Se um novo canal de quitação antecipada for adicionado**, ele deve calcular o preview com essa mesma fórmula (`gerarPropostaQuitacaoPix` já faz isso) — nunca reimplementar o cálculo de desconto separadamente, para não divergir do valor que `registrarQuitacaoAntecipada` efetivamente grava.

---

## Capital Recuperado vs Receita — Distinção Obrigatória

| Tipo de recebimento | Conta como | Onde aparece |
|---|---|---|
| Parcela paga (qualquer tipo normal) | **Receita** | Totais de receita no Dashboard, Financeiro, DRE |
| Extra de atraso (DIFERENCA_RECEBIDA) | **Receita extra** | Receita extra no Dashboard |
| `abatimento_acordo_assistido` | **Capital Recuperado** | Linha separada no Financeiro — NUNCA soma à receita |
| `recuperacao_apos_baixa` | **Capital Recuperado** | Linha separada — NUNCA soma à receita |
| `acordo_com_perda` | **Capital Recuperado** (+ eventual receita no que exceder o capital perdido) | Linha separada |
| `recuperacao_judicial` | **Capital Recuperado (principal) + Lucro Recuperado Judicial (separado)** | `CAPITAL_RECUPERADO_JUDICIAL`/`LUCRO_RECUPERADO_JUDICIAL` em PAGAMENTOS — nunca soma a `LUCRO_TOTAL` operacional nem a receita normal |

**Regra crítica:** qualquer consulta que some VALOR_PAGO de PAGAMENTOS para calcular "receita" DEVE filtrar explicitamente `TIPO_PAGAMENTO != "abatimento_acordo_assistido"`.

---

## Cálculo do Abatimento Assistido

```
VALOR_ABATIDO_ASSISTIDO_novo = VALOR_ABATIDO_ASSISTIDO_anterior + valor_do_abatimento
capitalRestante = VALOR_PRINCIPAL − VALOR_ABATIDO_ASSISTIDO_novo
```

O abatimento reduz o capital devedor diretamente. Nunca é distribuído entre parcelas.

---

## Cálculo de Prejuízo na Baixa de Acordo Assistido

```
PREJUIZO_CAPITAL = VALOR_PRINCIPAL − VALOR_ABATIDO_ASSISTIDO
JUROS_NAO_REALIZADOS = soma(VALOR_JUROS das parcelas abertas)
```

Não usar `pagasPs.reduce(...)` para calcular capital recuperado em contratos `acordo_assistido` — o resultado seria zero (nenhuma parcela tem status "pago"). Usar diretamente `VALOR_ABATIDO_ASSISTIDO`.

---

## Cascata de Alocação — Recuperação Judicial (2026-07-04)

Toda vez que dinheiro entra via ação judicial (parcela de acordo, quitação à vista, entrada), a ordem de alocação é fixa, implementada em `_alocarRecuperacaoJudicial` (appscript.gs):

```
1. Custos que o CREDOR está pagando neste recebimento (honorários/custas com quemPaga="CREDOR")
   → deduzidos do valor recebido antes de qualquer outra coisa
2. Valor líquido restante → principal (até zerar PREJUIZO_CAPITAL/principal em aberto)
3. Sobra → lucro recuperado judicialmente (VALOR_RECUPERADO_JUDICIAL_LUCRO — nunca soma a LUCRO_TOTAL)
4. Honorários/custas pagos pelo DEVEDOR → reembolso, bucket neutro (não é lucro nem capital, só repasse)
```

**Nunca overload de coluna existente** — `CAPITAL_RECUPERADO_JUDICIAL`, `LUCRO_RECUPERADO_JUDICIAL`, `HONORARIOS_VALOR`/`HONORARIOS_PAGO_POR`, `CUSTAS_VALOR`/`CUSTAS_PAGO_POR` são colunas novas e exclusivas em PAGAMENTOS, mesmo padrão de `FEE_PRORROGACAO` vs `RECEITA_EXTRA_ATRASO`.

`PREJUIZO_CAPITAL` é decrementado a cada recuperação de principal (mesmo padrão de `registrarRecuperacaoAposBaixa`) — `VALOR_RECUPERADO_JUDICIAL_PRINCIPAL`/`VALOR_RECUPERADO_JUDICIAL_LUCRO` são acumuladores em CONTRATOS, nunca recalculados do zero.

**Acordo judicial parcelado**: honorários/custas são liquidados uma única vez (na entrada ou na quitação), nunca repetidos por parcela — cada parcela do acordo carrega apenas principal/lucro pré-divididos na proporção do momento da negociação (snapshot).

---

## Lucro do Período (aba Financeiro)

**Fonte de dados**: aba **PARCELAS** (não PAGAMENTOS).

**Lógica**: filtra parcelas com `STATUS = "pago"` ou `"quitacao_antecipada"` cuja `DATA_PAGAMENTO` esteja dentro do período selecionado. Para cada parcela encontrada, soma:

```
Lucro = Σ (VALOR_JUROS − DESCONTO_APLICADO) + Σ DIFERENCA_PAGA
```

- `VALOR_JUROS − DESCONTO_APLICADO` = juros contratuais líquidos de desconto aplicado
- `DIFERENCA_PAGA` = extra cobrado por atraso (quando cliente pagou mais do que o valor original da parcela)

**Por que PARCELAS e não PAGAMENTOS**: a aba PAGAMENTOS no Sheets não tem coluna `ID_PARCELA` (foi criada antes de `criarAbaPagamentos()` incluir essa coluna). Um join PAGAMENTOS→PARCELAS via `pag.ID_PARCELA` sempre falha silenciosamente → `jurosEfetivos = 0` → Lucro = só mora. O mesmo se aplica a `resultado12m.receitaContratual` e aos totais do PDF Financeiro — todos usam PARCELAS diretamente.

---

## Lucro Potencial Remanescente

Campo calculado, não armazenado:

```javascript
const lucroRemanescente = ps
  .filter(p => !_ST_TERMINAL.has(String(p.STATUS || "").toLowerCase()))
  .reduce((s, p) => s + parseFloat(p.VALOR_JUROS || 0), 0);
```

Onde `_ST_TERMINAL = new Set(["pago","quitacao_antecipada","baixado_como_prejuizo","cancelado","renegociado"])`.

Representa o lucro potencial se o cliente se recuperar e pagar todas as parcelas abertas.

---

## Integridade Financeira

Nunca permitir:

- Saldo negativo
- Recebimento duplicado
- Contrato ativo duplicado
- Parcela duplicada
- Perda de histórico
- Abatimento assistido contabilizado como receita

Toda inconsistência financeira deve ser tratada como erro crítico.

---

## Cenários Obrigatórios

Sempre testar:

- Contrato novo
- Contrato em atraso
- Pagamento parcial
- Pagamento integral
- Antecipação
- Quitação
- Renegociação
- Recuperação
- **Abatimento em Acordo Assistido**
- **Baixa após Acordo Assistido** (com VALOR_ABATIDO_ASSISTIDO > 0)
- **Acordo Judicial Parcelado** (entrada com honorários/custas + parcelas subsequentes)
- **Quitação Judicial** (com honorários/custas pagos pelo devedor E pelo credor, separadamente)
- **Arquivamento de Processo** sem recuperação total (deve virar PERDA_JUDICIAL_DEFINITIVA)

---

## Datas — Armadilha de Timezone

`new Date("2026-05-30")` retorna UTC midnight → no Brasil (UTC-3) vira 29/05.

Sempre usar `parseDateLocal(s)` que cria `new Date(y, m, d, 12, 0, 0)`.

Aplicável em todo código que manipula datas no GAS e no frontend.

---

## PDD — Provisão para Devedores Duvidosos (implementado v1.0 — Jun/2026)

Implementado em 2026-06-14 na aba **Carteira** do frontend. PDD gerencial (não contábil) — serve para gestão de risco, não é reserva de caixa.

### Percentuais v1.0 (baseados em histórico real da carteira — 216 contratos)

```
Em dia (0 dias):    0%
1–30 dias:          0%
31–60 dias:        10%
61–90 dias:        35%
91–120 dias:       60%
121–180 dias:      85%
181+ dias:        100%
```

Calibrados sobre perda histórica líquida de 1,42% (R$ 7.275). Padrão binário confirmado: 0% perda real até 90d, salto abrupto acima de 91d.

### Próxima revisão

Após 50 contratos encerrados ou Dez/2026 (o que vier primeiro).

### Função `pddPct(d)` no frontend

```javascript
const pddPct = d => d <= 0 ? 0 : d <= 30 ? 0 : d <= 60 ? 0.10 : d <= 90 ? 0.35 : d <= 120 ? 0.60 : d <= 180 ? 0.85 : 1.00;
```

### Campos calculados no `carteira` useMemo

```javascript
saldoDevedor    // soma de VALOR_PARCELA (principal + juros) das parcelas pendentes — total a receber
principalTotal  // soma de VALOR_PRINCIPAL das parcelas pendentes — capital ainda na rua (base do PDD)
totalPDD        // soma de principalAberto × pddPct(diasAtraso) por contrato
carteiraAjustada = saldoDevedor - totalPDD
perdaHistoricaLiq = capitalPerdidoLiquido  // baseado em PREJUIZO_CAPITAL dos contratos baixados
coberturaPDD = totalPDD / perdaHistoricaLiq
pddFaixas       // array de 7 objetos {label, lo, hi, pct, qtd, saldo, pdd}
                // f.saldo = principalAberto per faixa (não mais VALOR_PARCELA)
```

### Base do PDD — principal remanescente (não saldo devedor)

PDD é calculado sobre **`principalAberto`** = Σ `VALOR_PRINCIPAL` das parcelas pendentes por contrato (via `perdaInfoMap`). Isso representa o capital ainda não recuperado — a perda real em caso de calote.

Motivo: `VALOR_PARCELA` inclui juros futuros que nunca foram caixa. O capital em risco é só o principal não devolvido.

`saldoDevedor` (Σ `VALOR_PARCELA` pendentes = principal + juros) permanece disponível no retorno do useMemo para exibir o total "a receber", mas **não é mais a base do PDD**.

### `capitalCirculacao` / `capitalEmRisco` / `capitalAssistido` (carteira useMemo)

Também corrigidos para usar `principalAberto` de `perdaInfoMap` em vez de `VALOR_PRINCIPAL` do contrato (que era o capital original, sem considerar pagamentos já feitos).

```javascript
capitalCirculacao = Σ perdaInfoMap[c.ID_CONTRATO].principalAberto  // contratos ativo_em_dia, ativo_em_atraso, renegociado
capitalEmRisco    = Σ perdaInfoMap[c.ID_CONTRATO].principalAberto  // contratos em_cobranca, pre_prejuizo
capitalAssistido  = Σ perdaInfoMap[c.ID_CONTRATO].principalAberto  // contratos acordo_assistido
```

O mesmo vale para `M.vAtivos` (Dashboard "Carteira Total") e `vAtivosG` (Gestão).

---

## Resultado Ajustado ao Risco (implementado — Jun/2026)

Seção na aba Carteira após o PDD. DRE simplificado sobre os últimos 12 meses.

### useMemo `resultado12m`

```javascript
// Depende de: pagamentos, parcelas
// Exclui abatimento_acordo_assistido
// Janela: Date.now() - 12 meses
resultado12m = {
  receitaContratual,  // soma(VALOR_JUROS - DESCONTO_APLICADO) das parcelas pagas nos últimos 12m
  receitaAtraso,      // soma(RECEITA_EXTRA_ATRASO) dos pagamentos nos últimos 12m — apenas mora/multa real
  receitaBruta,       // soma(VALOR_PAGO) de todos os pagamentos nos últimos 12m (excl. abatimentos)
}
// NOTA: FEE_PRORROGACAO (fee somente_juros) NÃO está em receitaAtraso — é receita separada
// Para total de receita extra: RECEITA_EXTRA_ATRASO + FEE_PRORROGACAO
```

### KPIs derivados

```javascript
recTotal      = receitaContratual + receitaAtraso
resultAjust   = recTotal - carteira.totalPDD
roiBruto      = recTotal / carteira.capitalTotal * 100
roiAjust      = resultAjust / carteira.capitalTotal * 100
margemAjust   = resultAjust / recTotal * 100
```

### Semáforos de cor

| KPI | Verde | Amarelo | Vermelho |
|---|---|---|---|
| ROI Bruto | ≥ 15% | ≥ 5% | < 5% |
| ROI Ajustado | ≥ 12% | ≥ 0% | < 0% |
| Margem | ≥ 80% | ≥ 50% | < 50% |
