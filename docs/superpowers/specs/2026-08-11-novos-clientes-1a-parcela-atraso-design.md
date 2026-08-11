# Destaque de clientes novos com 1ª parcela em atraso — Design

Data: 2026-08-11
Status: Aprovado pelo usuário

## Problema

Alex (dono do negócio) não tem hoje uma forma direta de identificar, dentro da aba
Cobrança, os casos de maior risco: clientes que estão no **primeiro contrato da vida**
e já falharam na **primeira parcela**. Esse padrão é um sinal forte de risco (cliente
novo, sem histórico de confiança construído, que já não paga a primeira cobrança) e
merece contato imediato — mas hoje fica misturado no meio de toda a fila de Cobrança,
exigindo garimpo manual linha a linha.

Objetivo: destacar esses casos de forma clara e acionável, direto na tela que Alex já
usa todo dia, sem precisar caçar.

## Escopo

Aplica-se à aba **Cobrança** (`tab==="cobranca"` em `src/main.jsx`), reaproveitando a
infraestrutura já existente: o `useMemo` `cobItems` (linhas ~6334–6374, agrupa parcelas
atrasadas por cliente), o array de `KpiCard`s clicáveis com filtro (linhas ~7632–7644,
padrão `toggleFiltro`/`filtroAtivo`/`cobItemsFiltrados`), e a função `abrirWhatsApp`
(linhas ~5073–5079).

### Fora de escopo

- Não altera a definição de "cliente novo" para outras partes do sistema (score,
  crédito, etc.) — é uma derivação local, só para esta feature.
- Não cria campo novo em CLIENTES/CONTRATOS no Sheets — tudo é calculado client-side a
  partir de dados já carregados (`contratos`, `cobItems`).
- Não adiciona botão de WhatsApp às demais linhas da fila de Cobrança (só às linhas que
  batem com o critério "cliente novo + 1ª parcela atrasada").
- Não mexe nos Templates da Régua nem no fluxo automático de cobrança — a mensagem de
  WhatsApp aqui é um texto fixo no frontend, editável só no código.
- Não recalcula atraso em tempo real (`statusEfetivo`) — ver decisão abaixo.

## Definições

### Cliente novo

Cliente cujo **histórico completo de contratos** (qualquer status, incluindo já
quitados/baixados) tem exatamente 1 registro em `contratos` para aquele `ID_CLIENTE`.
Isto é: esse é o único contrato que esse cliente já teve na vida, não apenas o único
contrato ativo no momento.

```javascript
const totalContratosPorCliente = useMemo(() => {
  const m = new Map();
  (contratos||[]).forEach(c => {
    const id = String(c.ID_CLIENTE);
    m.set(id, (m.get(id)||0) + 1);
  });
  return m;
}, [contratos]);
```

### 1ª parcela em atraso

Dentro do array `parcelasAtrasadas` que `cobItems` já calcula por cliente, existe pelo
menos uma parcela com `parseInt(NUM_PARCELA) === 1`.

### Decisão: fonte do status de atraso

`cobItems` já filtra parcelas pelo campo `STATUS` gravado na planilha (atualizado 1x/dia
pelo trigger `atualizarStatusParcelas`), **não** por `statusEfetivo()` calculado na hora.
Esta feature usa a mesma fonte (o `cobItems` já existente) — não recalcula atraso de
forma diferente do resto da aba. Motivo: evitar que um cliente apareça no novo card mas
não na lista geral (ou vice-versa) por usarem lógicas de atraso distintas. Consequência
aceita: como o resto da aba Cobrança, há uma defasagem de até 1 dia entre o vencimento
real e o card refletir o atraso (mesmo comportamento que já existe hoje).

### Combinação final

```javascript
const isNovoAtraso1 = (item) =>
  totalContratosPorCliente.get(String(item.ID_CLIENTE)) === 1 &&
  item.parcelasAtrasadas.some(p => parseInt(p.NUM_PARCELA||0) === 1);
```

## UI

### 1. Card KPI clicável

Novo item no array de `KpiCard`s já existente no topo da aba Cobrança (mesmo padrão dos
cards atuais: `onClick={()=>toggleFiltro(...)}`, `active={filtroAtivo(...)}`, `sub`
mudando entre "clique p/ filtrar" / "clique p/ limpar filtro").

- Label: "🆕 Novos em Atraso na 1ª Parcela"
- Value: contagem de `cobItems.filter(isNovoAtraso1).length`
- Cor: vermelho/alerta (mesma família de cor usada hoje para a banda "Crítica" de
  prioridade), para destacar como o cenário de maior risco.
- Clique aplica `filtro:{tipo:"novoAtraso1"}` — estende `cobItemsFiltrados` para tratar
  esse tipo filtrando por `isNovoAtraso1(item)`.

### 2. Badge inline na lista geral

Mesmo sem o filtro ativo, toda linha (mobile: card; desktop: linha de `Table`) cujo
cliente bate com `isNovoAtraso1` ganha um badge visual "🆕 1ª parcela" ao lado do nome —
para Alex reconhecer o caso mesmo navegando na lista completa, sem precisar clicar no
card.

### 3. Botão de contato via WhatsApp

Nas linhas marcadas com o badge acima (e apenas nelas — não em todas as linhas da fila),
um botão verde de WhatsApp que chama `abrirWhatsApp(telefone, nomeCliente)`, adaptado
para aceitar uma mensagem customizada (hoje a função tem texto fixo; passa a receber um
parâmetro opcional de mensagem, mantendo o texto atual como default para as outras
chamadas existentes no arquivo).

Mensagem sugerida para este caso:

> "Olá {nome}, tudo bem? Notei que a 1ª parcela do seu contrato venceu há {dias} dia(s) e
> ainda não identificamos o pagamento. Pode verificar, por favor? Qualquer dúvida, estou
> à disposição."

`{dias}` = `item.maxAtraso` (já calculado em `cobItems` para aquele cliente).

## Edge cases

- Cliente com 1 contrato total, mas esse contrato está em status terminal/excluído da
  fila (`_ST_CONTRATO_EXCLUIDO`) — nunca aparece em `cobItems`, então nunca aparece nesta
  feature também. Comportamento consistente com o resto da aba (nada de especial a
  tratar).
- Cliente com 1 contrato e mais de uma parcela atrasada simultaneamente (ex.: parcela 1 e
  2 ambas atrasadas) — conta como `isNovoAtraso1` normalmente, pois o critério é "existe
  uma atrasada com `NUM_PARCELA===1`", não "só a parcela 1 está atrasada".
- Cliente com `DATA_ACORDO` (reagendamento) futura na parcela 1 — como `cobItems` usa o
  campo `STATUS` da planilha (não `statusEfetivo`), o comportamento aqui replica
  exatamente o que já acontece hoje na fila geral para esse mesmo cenário (não é uma
  regressão nem uma melhoria introduzida por esta feature).
- Cliente sem telefone cadastrado — `abrirWhatsApp` já trata isso hoje com
  `alert('Telefone do cliente não cadastrado.')`; nenhuma mudança necessária.

## Testes manuais pós-implementação

1. Identificar (ou criar em ambiente de teste) um cliente com exatamente 1 contrato na
   vida e a parcela 1 desse contrato atrasada. Confirmar que:
   - O card "🆕 Novos em Atraso na 1ª Parcela" mostra a contagem correta.
   - Clicar no card filtra a lista mostrando só esse(s) cliente(s).
   - Clicar de novo no card limpa o filtro.
2. Na lista geral (sem filtro), confirmar que a linha desse cliente tem o badge "🆕 1ª
   parcela" visível.
3. Clicar no botão de WhatsApp da linha e confirmar que abre `wa.me` com o número certo
   e a mensagem com nome e dias de atraso corretos.
4. Confirmar que um cliente com 2+ contratos na vida (mesmo que só 1 ativo hoje) **não**
   aparece nesse card, mesmo com a parcela 1 do contrato atual atrasada.
5. Confirmar que um cliente novo (1 contrato) com a parcela 2 atrasada (mas parcela 1 já
   paga) **não** aparece nesse card.
6. Sem erros no console do navegador.
