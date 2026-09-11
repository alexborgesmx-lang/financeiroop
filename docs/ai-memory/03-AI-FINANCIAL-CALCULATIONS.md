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

## PIX — Encargos de Mora ao Regenerar Cobrança Vencida (2026-08-10)

Cobv Efí normal (parcela regular, não somente_juros) é criado com `validadeAposVencimento: 30`
(`api/efi-charges.js`, `api/efi-pix-avulso.js`) — passados 30 dias de atraso a Efí recusa o pagamento
mesmo com o código antigo ainda salvo na planilha, e a Efí calcula multa/juros de mora **dinamicamente**
(payload `valor.multa`/`valor.juros`, modalidade 2) em cima de `calendario.dataDeVencimento`.

**O problema**: pra criar/atualizar um cobv, `calendario.dataDeVencimento` precisa ser hoje-ou-futuro
(uma data no passado faria a cobv nascer com a janela de validade já expirada). Isso significa que toda
vez que uma parcela vencida é regenerada, a data é adiantada pra hoje — o que reseta o "relógio" que a
Efí usaria pra calcular a mora dinamicamente. Sem correção, o cliente pagaria só o valor base da parcela,
sem nenhum encargo, mesmo estando há dezenas de dias em atraso.

**A regra**, aplicada em `api/efi-charges.js` e `api/efi-pix-avulso.js`:

```
diasAtraso = hoje − DATA_VENCIMENTO original da parcela   (nunca DATA_ACORDO — ver abaixo)

se diasAtraso > 30:
    multaValor = valorParcela × (EFI_MULTA_PCT / 100)              // 2% (default)
    jurosValor = valorParcela × (EFI_JUROS_DIARIO / 100) × diasAtraso  // 0,03%/dia (default)
    valor.original = valorParcela + multaValor + jurosValor        // embute os encargos, valor fixo
    → NÃO inclui valor.multa/valor.juros dinâmicos (evitaria cobrar 2×)
senão:
    valor.original = valorParcela                                  // sem alteração
    → mantém valor.multa/valor.juros dinâmicos normalmente
```

`EFI_MULTA_PCT`/`EFI_JUROS_DIARIO` são os MESMOS valores (env vars) que a Efí já usava no cálculo
dinâmico — a fórmula manual só replica o que a Efí faria, ela não introduz uma taxa nova.

**`DATA_ACORDO` (reagendamento) é sempre ignorada nesse cálculo.** Reagendamento é só o registro da
promessa do cliente (perceção de honestidade/relacionamento) — não altera a dívida real nem a data de
referência da cobrança. Isso vale tanto pra detecção de "PIX expirado" no `ContratoModal` quanto pra
`_regenerarPixVencidos` (rotina automática, `appscript.gs`).

**Escopo da regeneração** — botão "Gerar PIX novamente" (`ContratoModal`, `main.jsx`): avalia cada
parcela em aberto do contrato independentemente pela própria `DATA_VENCIMENTO`; só regenera as que estão
com mais de 30 dias de atraso, ignora as demais (o PIX delas ainda é válido na Efí — recalcular sem
necessidade quebraria o cálculo dinâmico de mora que já estava correto). Detalhes completos e histórico
do bug em `docs/ai-memory/07-AI-KNOWN-ISSUES.md` (2026-08-10).

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

## Renegociação — Alocação da Entrada e Sugestão de Parcelamento (2026-08-06)

A entrada obrigatória da Renegociação Estrutural (`gerarPropostaRenegociacao`/`renegociarContrato`, ver `MANUAL_OPERACIONAL.md` 5.9) é dinheiro real recebido, não um desconto — por isso abate o **saldo devedor diretamente**, capital primeiro e só o excedente nos juros (nunca o inverso, mesma regra de nunca descontar principal):

```
entradaSobreCapital = min(valorEntrada, capitalFaltante)
entradaSobreJuros   = min(max(0, valorEntrada - entradaSobreCapital), jurosEmAberto)
capitalFaltante_novo = capitalFaltante - entradaSobreCapital
jurosEmAberto_novo   = jurosEmAberto   - entradaSobreJuros
saldoRestante         = capitalFaltante_novo + jurosEmAberto_novo
```

Sugestão de parcelamento (sem teto de quantidade — decisão consciente, ver `02-AI-CREDIT-RULES.md`), a partir do valor que o cliente disse que consegue pagar por mês:

```
qtdSugerida       = max(1, ceil(saldoRestante / valorDesejadoPeloCliente))
valorParcelaFinal = ceil(saldoRestante / qtdSugerida)   // arredonda pra cima, igual entre todas as parcelas
```

**Guarda-corpo obrigatório:** `valorEntrada` deve ser estritamente menor que o saldo total (`capitalFaltante + jurosEmAberto`), nunca `>=`. Se fosse igual, `saldoRestante` ficaria zero e a fórmula geraria uma "parcela de R$0" — que `renegociarContrato` rejeita (`novaValorParcela <= 0`), só que **depois** da entrada já ter sido confirmada paga pelo webhook, deixando dinheiro recebido sem uma renegociação correspondente. Contrato que teria entrada cobrindo o saldo inteiro deve usar Quitação Antecipada, não Renegociação.

**Snapshot de atraso pré-renegociação (2026-09-01):** antes de fechar as parcelas abertas como `renegociado`, `renegociarContrato` calcula o pior atraso entre elas e acumula em `CONTRATOS.ATRASO_MAX_PRE_RENEGOCIACAO`:

```
piorAtrasoRolado = max, sobre as parcelas que serão fechadas como "renegociado", de
                   max(DIAS_ATRASO gravado, floor((hoje − DATA_VENCIMENTO) / 1 dia))
ATRASO_MAX_PRE_RENEGOCIACAO_novo = max(ATRASO_MAX_PRE_RENEGOCIACAO_anterior, piorAtrasoRolado)
```

Serve só ao `calcularScore` (`max(atraso atual, ATRASO_MAX_PRE_RENEGOCIACAO)` na penalização por atraso — ver `02-AI-CREDIT-RULES.md`). Não entra em nenhum cálculo financeiro (saldo, lucro, prejuízo). Backfill de contratos já renegociados: `backfillAtrasoMaxPreRenegociacao()` (menu Manutenção) reconstrói o campo a partir do `DIAS_ATRASO` das parcelas com status `renegociado`.

**Guard de 1º vencimento no passado (2026-09-01):** se `novoVencimento` recebido cair antes de hoje (proposta gerada dias antes, dia preferido do cliente já passado no mês), `renegociarContrato` avança mês a mês preservando o dia até cair em data futura — a 1ª parcela renegociada nunca nasce vencida (senão a Efí recusa gerar o cobv e a parcela entra em atraso no mesmo dia).

O pagamento da entrada é registrado em PAGAMENTOS com `TIPO_PAGAMENTO = "entrada_renegociacao"` e `ID_PARCELA` vazio — mesmo padrão do `abatimento_acordo_assistido` (não fica preso a uma parcela específica, já que todas as parcelas antigas serão fechadas como `renegociado` de qualquer forma). Consequência: `calcularMetricasCliente` inclui esse valor em `TOTAL_PAGO` (só exclui `abatimento_acordo_assistido`), mas **não** em `LUCRO_TOTAL` — o lucro de juros só é reconhecido quando a parcela correspondente é efetivamente paga com `STATUS = pago`, e a parte de juros que a entrada cobriu já está refletida no `VALOR_JUROS` menor das novas parcelas (`novoJurosParcela = max(0, (totalRenegociado - capitalFaltante_novo) / qtdSugerida)`). Não há double-count nem perda de rastreio, só diferimento — mesmo raciocínio já usado pelo abatimento de Acordo Assistido.

---

## Capital Recuperado vs Receita — Distinção Obrigatória

| Tipo de recebimento | Conta como | Onde aparece |
|---|---|---|
| Parcela paga (qualquer tipo normal) | **Receita** | Totais de receita no Dashboard, Financeiro, DRE |
| Extra de atraso (DIFERENCA_RECEBIDA) | **Receita extra** | Receita extra no Dashboard |
| `abatimento_acordo_assistido` | **Capital Recuperado (principal) + Lucro Recuperado Assistido (separado, a partir de 2026-08-29)** | `CAPITAL_RECUPERADO_ASSISTIDO`/`LUCRO_RECUPERADO_ASSISTIDO` em PAGAMENTOS — nunca soma a `LUCRO_TOTAL` operacional nem a receita normal (mesmo padrão da recuperação judicial) |
| `recuperacao_apos_baixa` | **Capital Recuperado** | Linha separada — NUNCA soma à receita |
| `acordo_com_perda` | **Capital Recuperado** (+ eventual receita no que exceder o capital perdido) | Linha separada |
| `recuperacao_judicial` | **Capital Recuperado (principal) + Lucro Recuperado Judicial (separado)** | `CAPITAL_RECUPERADO_JUDICIAL`/`LUCRO_RECUPERADO_JUDICIAL` em PAGAMENTOS — nunca soma a `LUCRO_TOTAL` operacional nem a receita normal |

**Regra crítica:** qualquer consulta que some VALOR_PAGO de PAGAMENTOS para calcular "receita" DEVE filtrar explicitamente `TIPO_PAGAMENTO != "abatimento_acordo_assistido"`.

---

## Cascata de Alocação — Abatimento Assistido (2026-08-29)

Mesmo princípio da Recuperação Judicial abaixo, sem honorários/custas (não se aplicam aqui) —
implementado em `_alocarAbatimentoAssistido` (appscript.gs). Objetivo: preservar caixa e
patrimônio investido primeiro — só reconhecer lucro depois do capital 100% recuperado.

```
capitalJaRecuperado = Σ VALOR_PRINCIPAL das parcelas do contrato pagas integralmente
                       (STATUS = pago/quitacao_antecipada, TIPO_PAGAMENTO ≠ somente_juros —
                       essa exclusão é porque somente_juros rola o principal pra uma parcela
                       nova em vez de devolvê-lo)
                     + VALOR_ABATIDO_ASSISTIDO acumulado até agora (só a parte-principal)

principalAberto     = max(0, VALOR_PRINCIPAL − capitalJaRecuperado)
principalRecuperado = min(valor_do_abatimento, principalAberto)
lucroRecuperado     = max(0, valor_do_abatimento − principalRecuperado)

VALOR_ABATIDO_ASSISTIDO_novo    = VALOR_ABATIDO_ASSISTIDO_anterior    + principalRecuperado
LUCRO_RECUPERADO_ASSISTIDO_novo = LUCRO_RECUPERADO_ASSISTIDO_anterior + lucroRecuperado
capitalRestante = VALOR_PRINCIPAL − VALOR_ABATIDO_ASSISTIDO_novo
```

`capitalJaRecuperado` considera o **histórico inteiro do contrato**, não só a partir da entrada
em Acordo Assistido — um contrato que já devolveu parte do principal via parcelas normais antes
da dificuldade começar não "recupera esse principal de novo" antes de gerar lucro reconhecido.

`LUCRO_RECUPERADO_ASSISTIDO` (novo campo em CONTRATOS) **nunca é somado a `LUCRO_TOTAL`**
operacional — mesma decisão já tomada pra `VALOR_RECUPERADO_JUDICIAL_LUCRO` (ver cascata
judicial abaixo). `CAPITAL_RECUPERADO_ASSISTIDO`/`LUCRO_RECUPERADO_ASSISTIDO` (novos campos em
PAGAMENTOS) guardam o detalhe de cada abatimento individual, mesmo padrão de
`CAPITAL_RECUPERADO_JUDICIAL`/`LUCRO_RECUPERADO_JUDICIAL`.

**Backfill:** `backfillAbatimentosAssistidosHistorico()` (menu Manutenção) reaplica essa cascata
sobre os abatimentos já registrados antes dessa mudança, em ordem cronológica por contrato —
necessário rodar 1x depois de publicar, senão os contratos que já tinham abatimento continuam
com os valores antigos (100% capital, nunca lucro).

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

## Taxa de Inadimplência — padronizada como NPL 90+ dias (2026-07-29)

Antes de 2026-07-29, o card "Taxa de Adimplência" do Dashboard misturava bases diferentes: numerador
era o valor (`VALOR_PARCELA`, com juros) das parcelas vencidas **dentro do período do filtro do
Dashboard** ("Este mês"/"30 dias"/"90 dias"), denominador era o principal total da carteira **sem
filtro de período**. Resultado: o texto de apoio ("29 parc. em atraso de 111 no período") misturava
contagem global com contagem filtrada por período, e o percentual não correspondia a nenhuma das
duas contagens exibidas — confuso mesmo para quem entende o sistema.

Padronizado (decisão do Alex, 2026-07-29) para seguir a mesma convenção usada pelo mercado
financeiro/BACEN (Resolução 2682/99, Basileia) e já parcialmente usada na PDD deste sistema:

```
Taxa de Inadimplência (NPL) = principal em aberto de contratos com 90+ dias de atraso
                               ÷ principal em aberto de todos os contratos ativos × 100
Taxa de Adimplência = 100% − Taxa de Inadimplência
```

Três decisões de modelagem, todas definidas nesta data:

1. **Corte de 90+ dias** (não 1+ dia) — é o padrão NPL/Basileia, e coincide com o ponto em que a
   própria PDD do sistema salta de 35%→60% (faixa "91–120 dias" acima). Abaixo de 90 dias a chance
   de recuperação ainda é alta; não deveria contar como "inadimplência real" para efeito de reporte.
2. **Base = principal (`principalAberto`), nunca saldo devedor com juros** — mesma base já usada na
   PDD e no `capitalEmRisco`/`capitalCirculacao` da aba Carteira. Motivo: mede o capital que
   efetivamente está em risco de não voltar, não o "a receber" incluindo juros que nunca viraram caixa.
3. **Foto de hoje, nunca filtrada por período** — é uma métrica de estoque (quanto da carteira está
   em atraso agora), não de fluxo (quanto venceu neste mês). O filtro "Este mês/30 dias/90 dias" do
   Dashboard não afeta mais este card — só afeta os KPIs que já eram de período (Recebido, A Receber).

### Implementação

```javascript
// Dashboard — M useMemo (main.jsx)
const contratosNPL90 = ativos.filter(c => (perdaInfoMap[c.ID_CONTRATO]?.diasAtraso||0) >= 91);
const principalInadNPL = contratosNPL90.reduce((s,c) => s + perdaInfoMap[c.ID_CONTRATO].principalAberto, 0);
const taxaInadNPL = vAtivos>0 ? (principalInadNPL/vAtivos*100) : 0;
// Taxa de Adimplência exibida = 100 - taxaInadNPL
```

Substituiu `taxaInad`/`vAtrasoTotal` (removidos — não tinham outro uso no código).

**Aba Carteira, "Painel de Inadimplência" (`Inadimplência Real (por valor)` e `Inadimplência por
Contratos`):** usava o mesmo conceito mas com corte de **31+ dias**, e o texto dizia "Padrão BCB"
incorretamente (31d não é o padrão BCB/Basileia — 90d é). Alinhado para 90+ dias nesta mesma data,
para que as duas telas do sistema não reportem números diferentes com o mesmo nome. Os thresholds de
cor (`< 20%` bom, `20-25%` atenção, `25%+` crítico) **não foram recalibrados** — só a definição do
corte de dias mudou. Recalibrar esses thresholds para o novo corte de 90d é uma decisão de política de
risco separada, ainda pendente (mesma revisão programada da PDD — ver seção acima, "após 50 contratos
encerrados ou Dez/2026").

**Não alterado:** a distribuição por faixa de atraso (`carteira.dist`, buckets 0/1-30/31-60/61-120/>120,
usada no gráfico "Distribuição por Faixa de Atraso") e as faixas da PDD (0/1-30/31-60/61-90/91-120/
121-180/181+) — ambas são visões de aging completo, não o indicador único de "inadimplência real".

**Bug de escopo encontrado e corrigido no mesmo dia (ultra review):** a primeira versão deste fix
(no painel da aba Carteira) filtrava o numerador (`contratosNPL90`) sobre `(contratos||[])` — todos os
contratos, sem exclusão de status — enquanto o denominador `carteira.principalTotal` é somado só sobre
`abertos` (exclui `EXCL` = `quitado/cancelado/encerrado_sem_recuperacao/recuperado_integralmente/
em_processo_judicial/encerrado_judicialmente` + `baixado_como_prejuizo`). Como `atualizarStatusParcelas()`
no GAS segue atualizando `DIAS_ATRASO`/status de parcela normalmente mesmo com o contrato em
`em_processo_judicial` (só o `STATUS_CONTRATO` é "congelado", não a parcela), um contrato judicializado
com parcela antiga não fechada entrava no numerador sem nunca poder entrar no denominador — inflando
artificialmente o percentual. Corrigido trocando a base do numerador para `carteira.abertos` (array agora
exposto no retorno do `useMemo` de `carteira`), igualando à população do denominador. O card do Dashboard
(`M.taxaInadNPL`, que usa `ativos` = `_ST_ATIVOS`) nunca teve esse problema — `_ST_ATIVOS` já exclui
judicial/baixado corretamente.

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
