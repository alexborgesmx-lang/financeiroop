# Remover limite de 2 usos de "somente_juros" por contrato

## Contexto

`somente_juros` é a prorrogação onde o cliente paga só o juro da parcela e o principal
rola pra uma parcela nova, criada automaticamente no fim do contrato. A regra de
"máximo 2 usos por contrato" (`appscript.gs:3731`) foi criada pra evitar que o cliente
criasse hábito de sempre prorrogar, corroendo o lucro do contrato.

Desde então dois mecanismos foram adicionados que já cobrem esse risco:

1. **Fee de 5% do principal rolado** (`FEE_PRORROGACAO`, `appscript.gs:3734`), cobrado
   junto com o juro no mesmo pagamento.
2. **Penalização de score sem teto** (`calcularScore`, `appscript.gs:1846-1855`):
   `-10 pontos por uso de somente_juros`, somando todos os contratos do cliente, sem
   limite — cascateia pra taxa e limite de crédito em contratos futuros.

Análise da mecânica de geração da parcela nova (`appscript.gs:3707-3792`) confirma que
o mecanismo já garante lucro igual ou maior ao projetado originalmente, nunca prejuízo:
a parcela nova criada no fim do contrato tem o mesmo principal e o mesmo juros da
parcela original adiada — ou seja, o juro daquele período é cobrado normalmente na
parcela nova (o principal continua rendendo juro enquanto está em aberto, igual um
empréstimo comum), e o fee de 5% é margem adicional por cima disso. Como
`atualizarTotaisContrato` soma o `VALOR_JUROS` de todas as parcelas (inclusive as
geradas), `JUROS_TOTAL` do contrato sobe a cada uso, nunca cai.

Motivador real: o contrato PCL-106 (cliente em Acordo Assistido) já tem 3 usos
históricos de `somente_juros` — o contador `TOTAL_SOMENTE_JUROS` mostra 3, acima do
teto de 2 hoje documentado. Isso reforça que travar no 3º uso vai contra o princípio já
adotado no `docs/ai-memory/02-AI-CREDIT-RULES.md`: "preferível receber ao menos os
juros a não receber nada".

## Decisão

Remover o limite de 2 usos por contrato. Sem substituto por teto mais alto — o fee de
5% e a penalização de score sem teto já são o freio econômico suficiente. A taxa de
5% do fee permanece inalterada (mecanismo já garante lucro ≥ projetado, sem
necessidade de ajuste).

## Mudanças

### 1. `appscript.gs` — remover a trava

Em `registrarPagamentoParcial` (função que processa o pagamento somente_juros), remover
o bloco:

```javascript
if (totalSJAtual >= 2) {
  throw new Error("Limite de 2 prorrogações por contrato atingido. Cliente deve quitar a parcela completa ou formalizar um acordo.");
}
```

`totalSJAtual` continua sendo lido (usado só pra incrementar o contador
`TOTAL_SOMENTE_JUROS` logo depois, em `appscript.gs:3800`) — nenhuma outra lógica
depende do valor de `totalSJAtual` além do incremento, então a remoção do `if` é
isolada e não quebra nada mais na função.

Nenhuma ação retroativa é necessária nos dados: `TOTAL_SOMENTE_JUROS` é só um contador
informativo, não existe nenhum outro campo/estado gravado bloqueando o contrato.
Contratos que já estão em 2 ou 3 (como o PCL-106) voltam a poder usar a função
normalmente assim que o `if` sair do código.

### 2. `src/main.jsx` — badge "Prorrogações usadas" no ContratoModal

Local: `main.jsx:4463-4467`, dentro do `ContratoModal`.

Antes:
```javascript
...(parseInt(contrato.TOTAL_SOMENTE_JUROS||0)>0?[{
  l:"Prorrogações usadas",
  v:`${contrato.TOTAL_SOMENTE_JUROS}/2`,
  c:parseInt(contrato.TOTAL_SOMENTE_JUROS)>=2?RED:YEL
}]:[]),
```

Depois:
```javascript
...(parseInt(contrato.TOTAL_SOMENTE_JUROS||0)>0?[{
  l:"Prorrogações usadas",
  v:`${contrato.TOTAL_SOMENTE_JUROS}`,
  c:parseInt(contrato.TOTAL_SOMENTE_JUROS)>=3?RED:YEL
}]:[]),
```

Sem "/2" (não existe mais teto pra referenciar). Cor: amarelo a partir de 1 uso
(comportamento já existente, condição `>0` do array), vermelho a partir de 3+ usos —
mantém o alerta visual pra identificar cliente que usa muito, sem sugerir limite.

### 3. Documentação

- `CLAUDE.md`: remover a linha do checklist Tier 3 ("somente_juros: máx 2 por
  contrato (TOTAL_SOMENTE_JUROS)") e a menção "(máx 2)" no bloco `TOTAL_SOMENTE_JUROS
  em CONTRATOS`. Adicionar nota curta explicando que o limite foi removido e por quê
  (fee 5% + penalização de score sem teto já cobrem o risco).
- `docs/ai-memory/02-AI-CREDIT-RULES.md`: remover a bullet "Limite de 2 usos por
  contrato — 3ª tentativa é bloqueada com erro claro", atualizar a numeração/texto ao
  redor, e registrar a decisão com data (2026-08-26) e o racional acima.

## Fora de escopo

- Não altera o fee de 5% (`FEE_PRORROGACAO`).
- Não adiciona teto alternativo (ex: 5 como rede de segurança).
- Não altera a mensagem de erro pra um aviso não-bloqueante — é remoção completa, sem
  substituto.
- Não mexe em `backfillTotalSomenteJuros()` nem em nenhuma lógica de reabertura
  (`reabrirParcelaAPI` continua decrementando o contador normalmente).

## Verificação

Tier 3 (`appscript.gs` alterado, regra de crédito) — checklist completo do
`CLAUDE.md`, incluindo teste manual no browser: registrar um 3º pagamento
somente_juros num contrato de teste e confirmar que não é mais bloqueado, e que o
badge mostra o número sem "/2".
