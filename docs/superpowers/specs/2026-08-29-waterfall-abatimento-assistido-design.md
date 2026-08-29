# Waterfall capital-primeiro nos abatimentos de Acordo Assistido

## Contexto

Investigando por que o contrato PCL-106 (Jessica) mostrava `VALOR_TOTAL` divergente da soma
visível das parcelas, descobrimos que a causa não era dado desatualizado (já confirmado —
`recalcularTotaisContratosHistorico()` rodou e não mudou nada nesse contrato). A causa real:
`registrarAbatimentoAssistido` trata 100% de todo pagamento de abatimento como recuperação de
capital (`VALOR_ABATIDO_ASSISTIDO += valorPago`), sem nunca checar se o principal do contrato já
foi recuperado. Não existe hoje nenhuma lógica que reconheça lucro nos abatimentos, mesmo depois
do capital investido já ter voltado inteiro pro caixa.

## Decisão

O sistema já tem esse exato padrão implementado em outro módulo: `_alocarRecuperacaoJudicial`
(`appscript.gs:9137`), usado na Recuperação Judicial — cascata capital-primeiro, com o lucro
recuperado guardado **separado** de `LUCRO_TOTAL` operacional (comentário original do código:
"lucro recuperado judicialmente, separado do LUCRO_TOTAL operacional normal"). Vamos replicar
esse padrão 1:1 para Acordo Assistido, em vez de inventar um cálculo novo.

**Regra:** a cada abatimento assistido registrado, calcula-se quanto do principal do contrato
ainda está em aberto (`VALOR_PRINCIPAL` menos tudo que já voltou pro caixa até agora — parcelas
pagas integralmente, exceto `somente_juros`, que não devolve principal, mais abatimentos
anteriores). O pagamento recebido é alocado primeiro nesse principal em aberto; qualquer
excedente dentro do mesmo pagamento já é reconhecido como lucro. Uma vez o principal do contrato
100% recuperado, todo abatimento seguinte é 100% lucro.

Lucro recuperado via Acordo Assistido **nunca é somado a `LUCRO_TOTAL`** (mesma decisão já
tomada pro caso judicial) — fica em campo próprio, pra não poluir o indicador operacional
normal (usado em PDD Gerencial, ROI do cliente, Resultado Ajustado ao Risco).

**Escopo do cálculo de "capital já recuperado":** histórico inteiro do contrato, não só a partir
da entrada em Acordo Assistido — um contrato que já devolveu parte do principal via parcelas
normais antes da dificuldade começar não deve "recuperar esse principal de novo" antes de gerar
lucro reconhecido.

**Retroativo:** sim — inclui um backfill que recalcula os abatimentos já registrados (ordenando
cronologicamente por contrato e reaplicando a cascata), corrigindo os contratos que já têm
abatimento assistido, incluindo o caso motivador (PCL-106).

## Mudanças em `appscript.gs`

1. **`_alocarAbatimentoAssistido(valorPago, capitalJaRecuperado, valorPrincipal)`** — nova
   função pura, mesma lógica de `_alocarRecuperacaoJudicial` mas sem honorários/custas (não se
   aplicam aqui): `principalAberto = max(0, valorPrincipal - capitalJaRecuperado)`;
   `principalRecuperado = min(valorPago, principalAberto)`;
   `lucroRecuperado = max(0, valorPago - principalRecuperado)`.

2. **`_garantirColunasFinanceiroAssistido(abaC, cmC)`** — garante a coluna
   `LUCRO_RECUPERADO_ASSISTIDO` em CONTRATOS (mirror de `_garantirColunasFinanceiroJudicial`).

3. **`_garantirColunasPagamentoAssistido(abaPag, cmPag)`** — garante `CAPITAL_RECUPERADO_ASSISTIDO`
   e `LUCRO_RECUPERADO_ASSISTIDO` em PAGAMENTOS (mirror de `_garantirColunasPagamentoJudicial`).

4. **`registrarAbatimentoAssistido`** — reescrita:
   - Calcula `capitalJaRecuperado` = soma de `VALOR_PRINCIPAL` das parcelas do contrato com
     status pago/quitação antecipada e `TIPO_PAGAMENTO !== "somente_juros"`, mais
     `VALOR_ABATIDO_ASSISTIDO` atual (que passa a representar só a parte-principal já
     recuperada via abatimentos, não mais o pagamento cheio).
   - Chama `_alocarAbatimentoAssistido`.
   - `VALOR_ABATIDO_ASSISTIDO` incrementa só com `principalRecuperado` (não mais o `valorPago`
     inteiro).
   - `LUCRO_RECUPERADO_ASSISTIDO` (novo, em CONTRATOS) incrementa com `lucroRecuperado`.
   - Grava `CAPITAL_RECUPERADO_ASSISTIDO`/`LUCRO_RECUPERADO_ASSISTIDO` na linha de PAGAMENTOS.
   - Payload do Undo ganha `lucroRecuperadoAnterior` além de `valorAbatidoAnterior`.

5. **`_reverterAbatimentoAssistido`** — passa a restaurar também `LUCRO_RECUPERADO_ASSISTIDO`
   a partir do payload.

6. **`backfillAbatimentosAssistidosHistorico()`** (nova, menu "Manutenção") — recalcula do zero
   todos os abatimentos já registrados: zera `VALOR_ABATIDO_ASSISTIDO`/`LUCRO_RECUPERADO_ASSISTIDO`
   por contrato, reaplica a cascata em ordem cronológica (por `DATA_PAGAMENTO`) sobre cada
   pagamento `abatimento_acordo_assistido` existente, e regrava `CAPITAL_RECUPERADO_ASSISTIDO`/
   `LUCRO_RECUPERADO_ASSISTIDO` em cada linha de PAGAMENTOS histórica. Lê CONTRATOS/PARCELAS/
   PAGAMENTOS uma única vez cada (lição do timeout de `recalcularTotaisContratosHistorico`) —
   volume aqui é pequeno (só contratos que já passaram por Acordo Assistido), mas o padrão de
   leitura única fica consistente de qualquer forma.

## Frontend (`src/main.jsx`)

`ContratoModal` — ao lado do card "Capital recuperado" existente (linha ~4458), adicionar
"Lucro recuperado (Acordo Assistido)" quando `contrato.LUCRO_RECUPERADO_ASSISTIDO > 0`, mesmo
padrão visual dos outros cards da seção Acordo Assistido.

## Fora de escopo

- Não cria agregado em CLIENTES (ex: `LUCRO_RECUPERADO_ACORDO_ASSISTIDO` no nível cliente) —
  o padrão judicial que estamos espelhando também não tem esse agregado, só fica em
  CONTRATOS/PAGAMENTOS. Se fizer falta depois, é um passo separado.
- Não mexe em `_alocarRecuperacaoJudicial` nem no fluxo judicial.
- Não altera `LUCRO_TOTAL` nem sua fórmula.

## Verificação

Tier 3 (`appscript.gs`, regra de crédito/cálculo financeiro). Após implementar: rodar o backfill
e conferir no browser que o contrato PCL-106 (Jessica) passa a mostrar `LUCRO_RECUPERADO_ASSISTIDO`
> 0 (visto que ela já pagou mais que o suficiente pra ter superado parte do principal) e que
`VALOR_ABATIDO_ASSISTIDO` reflete só a parte-principal do R$1.600 já registrado.
