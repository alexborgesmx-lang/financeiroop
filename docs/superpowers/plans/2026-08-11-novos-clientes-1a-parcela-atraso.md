# Destaque de Clientes Novos com 1ª Parcela em Atraso — Plano de Implementação

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Na aba Cobrança do FinanceiroOp, destacar clientes que estão no primeiro
contrato da vida e cuja 1ª parcela está atrasada, com um card KPI clicável/filtrável,
badge inline na lista, e um botão de contato direto via WhatsApp com mensagem pronta.

**Architecture:** Tudo client-side em `src/main.jsx` (React, sem estado novo no Sheets).
Um novo `useMemo` deriva a contagem de contratos por cliente a partir do array
`contratos` já carregado; uma função pura `isNovoAtraso1(item)` combina essa contagem
com `item.parcelasAtrasadas` (já calculado por `cobItems`) para achar `NUM_PARCELA===1`.
O resultado alimenta um novo `KpiCard` (reaproveitando o padrão de filtro já existente em
`cobFiltro`/`toggleFiltro`/`filtroAtivo`), um badge inline nas duas renderizações da fila
(mobile card e desktop `Table`), e um novo botão de WhatsApp que chama uma função
dedicada `abrirWhatsAppNovoAtraso1`.

**Tech Stack:** React 18 + Vite, JSX inline styles, sem framework de testes automatizado
no projeto (verificação é manual via browser, conforme `CLAUDE.md` do projeto).

## Global Constraints

- Não criar nenhum campo novo no Google Sheets — toda a lógica é derivada client-side.
- Não alterar `abrirWhatsApp` (linha 5073) — é código morto (nunca chamado em nenhum
  outro ponto do arquivo) com mensagem hardcoded de "contrato finalizado", sem relação
  com esta feature. Criar função nova e independente.
- Seguir o padrão de cores já usado na aba Cobrança: `RED` para alerta/crítico (mesma
  cor da banda "Crítica").
- Sem comentários desnecessários no código — só o mínimo que explique o "porquê" quando
  não-óbvio (convenção do projeto, `CLAUDE.md`).
- Verificação pós-implementação: **Tier 2 — Standard** (`/review`), por ser lógica
  frontend nova sem cálculo financeiro nem mudança em GAS/Sheets — conforme
  `CLAUDE.md` do projeto.

---

### Task 1: `useMemo` de contagem de contratos por cliente + função `isNovoAtraso1`

**Files:**
- Modify: `src/main.jsx:6374` (logo após o fechamento do `useMemo` `cobItems`, antes de
  `cobKpis` na linha 6376)

**Interfaces:**
- Consumes: `contratos` (useMemo, `src/main.jsx:6153`, array de objetos com
  `ID_CLIENTE`); `cobItems` (useMemo, `src/main.jsx:6334-6374`, cada item tem
  `ID_CLIENTE` e `parcelasAtrasadas: Array<{NUM_PARCELA, ...}>`).
- Produces: `totalContratosPorCliente` (`Map<string, number>` — chave `String(ID_CLIENTE)`,
  valor = quantidade total de contratos daquele cliente na vida); `isNovoAtraso1(item)`
  (função pura, recebe um item de `cobItems`, retorna `boolean`). Ambos usados pela Task
  2 (KPI card), Task 3 (badge) e Task 4 (botão WhatsApp).

- [ ] **Step 1: Adicionar o `useMemo` de contagem e a função `isNovoAtraso1` logo após `cobItems`**

Ler o contexto atual em `src/main.jsx` ao redor da linha 6374-6376:

```javascript
    }).sort((a,b)=>(b.prioridade?.score||0)-(a.prioridade?.score||0));
  },[clientes,parcelas,contratos,eventos,contratosMap,cliMap]);

  const cobKpis=useMemo(()=>{
```

Inserir entre o fechamento de `cobItems` e a declaração de `cobKpis`:

```javascript
    }).sort((a,b)=>(b.prioridade?.score||0)-(a.prioridade?.score||0));
  },[clientes,parcelas,contratos,eventos,contratosMap,cliMap]);

  // ── clientes novos (1 único contrato na vida) com a parcela 1 em atraso ──
  const totalContratosPorCliente=useMemo(()=>{
    const m=new Map();
    (contratos||[]).forEach(c=>{
      const id=String(c.ID_CLIENTE);
      m.set(id,(m.get(id)||0)+1);
    });
    return m;
  },[contratos]);
  const isNovoAtraso1=item=>
    totalContratosPorCliente.get(String(item.ID_CLIENTE))===1 &&
    item.parcelasAtrasadas.some(p=>parseInt(p.NUM_PARCELA||0)===1);

  const cobKpis=useMemo(()=>{
```

- [ ] **Step 2: Verificar visualmente que não há erro de sintaxe**

Rodar:
```bash
npx vite build --mode development 2>&1 | head -30
```
Esperado: build conclui sem erro relacionado a `main.jsx` (nenhuma menção a
`totalContratosPorCliente` ou `isNovoAtraso1` na saída de erro). Se o build já falhava
por outro motivo pré-existente, ignorar — o que importa é não introduzir erro novo.

- [ ] **Step 3: Commit**

```bash
git add src/main.jsx
git commit -m "$(cat <<'EOF'
feat: deriva clientes novos com 1a parcela em atraso na aba Cobranca

useMemo totalContratosPorCliente (conta contratos na vida por ID_CLIENTE) +
isNovoAtraso1(item) combinando com item.parcelasAtrasadas do cobItems.
Base para o card KPI/badge/botao WhatsApp das proximas tasks.

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 2: Card KPI clicável "🆕 Novos em Atraso na 1ª Parcela"

**Files:**
- Modify: `src/main.jsx:7632-7644` (bloco de KPIs de Prioridade de Cobrança, dentro do
  render `tab==="cobranca"`)

**Interfaces:**
- Consumes: `cobItems` (Task existente), `isNovoAtraso1` (Task 1), `cobFiltro`/
  `setCobFiltro`/`toggleFiltro`/`filtroAtivo` (já existentes, `src/main.jsx:6024,
  7608-7609`), `KpiCard` (componente existente, `src/main.jsx:377-409`, props
  `{label,value,sub,color,onClick,active}`), `cobItemsFiltrados` (já existente,
  `src/main.jsx:7604-7607`).
- Produces: `cobItemsFiltrados` estendido para reconhecer `filtro:{tipo:"novoAtraso1"}`
  — consumido pela Task 3 (a lista renderizada abaixo já usa `cobItemsOrdenados`, que
  deriva de `cobItemsFiltrados`, então nenhuma mudança adicional é necessária na
  renderização da lista para o filtro funcionar).

- [ ] **Step 1: Estender `cobItemsFiltrados` para o novo tipo de filtro**

Ler o contexto atual em `src/main.jsx:7604-7607`:

```javascript
            const cobItemsFiltrados = !cobFiltro ? cobItems
              : cobFiltro.tipo==="banda" ? cobItems.filter(c=>c.prioridade?.banda===cobFiltro.valor)
              : cobFiltro.tipo==="ajuizamento" ? cobItems.filter(c=>c.prioridade?.jaRenegociado||c.prioridade?.jaTeveAcordoAssistido)
              : cobItems;
```

Substituir por:

```javascript
            const cobItemsFiltrados = !cobFiltro ? cobItems
              : cobFiltro.tipo==="banda" ? cobItems.filter(c=>c.prioridade?.banda===cobFiltro.valor)
              : cobFiltro.tipo==="ajuizamento" ? cobItems.filter(c=>c.prioridade?.jaRenegociado||c.prioridade?.jaTeveAcordoAssistido)
              : cobFiltro.tipo==="novoAtraso1" ? cobItems.filter(isNovoAtraso1)
              : cobItems;
```

- [ ] **Step 2: Estender `filtroLabel` para o novo tipo**

Ler o contexto atual em `src/main.jsx:7610`:

```javascript
            const filtroLabel = !cobFiltro ? "" : cobFiltro.tipo==="banda" ? cobFiltro.valor : "Elegíveis para Ajuizamento";
```

Substituir por:

```javascript
            const filtroLabel = !cobFiltro ? "" : cobFiltro.tipo==="banda" ? cobFiltro.valor : cobFiltro.tipo==="novoAtraso1" ? "Novos em Atraso na 1ª Parcela" : "Elegíveis para Ajuizamento";
```

- [ ] **Step 3: Adicionar o novo card ao array de KPIs clicáveis**

Ler o contexto atual em `src/main.jsx:7634-7638`:

```javascript
                {[
                  {label:"🔥 Crítica",value:cobKpis.critica,color:RED,filtro:{tipo:"banda",valor:"Crítica"}},
                  {label:"⚠ Forte",value:cobKpis.forte,color:ORG,filtro:{tipo:"banda",valor:"Forte"}},
                  {label:"🟡 Normal",value:cobKpis.normal,color:YEL,filtro:{tipo:"banda",valor:"Normal"}},
                  {label:"⚖ Elegíveis p/ ajuizamento",value:cobKpis.elegivelAjuizamento,color:PUR,filtro:{tipo:"ajuizamento"}},
                ].map(k=>(
```

Substituir por (novo card adicionado como primeiro item da lista, para máximo destaque):

```javascript
                {[
                  {label:"🆕 Novos em Atraso na 1ª Parcela",value:cobItems.filter(isNovoAtraso1).length,color:RED,filtro:{tipo:"novoAtraso1"}},
                  {label:"🔥 Crítica",value:cobKpis.critica,color:RED,filtro:{tipo:"banda",valor:"Crítica"}},
                  {label:"⚠ Forte",value:cobKpis.forte,color:ORG,filtro:{tipo:"banda",valor:"Forte"}},
                  {label:"🟡 Normal",value:cobKpis.normal,color:YEL,filtro:{tipo:"banda",valor:"Normal"}},
                  {label:"⚖ Elegíveis p/ ajuizamento",value:cobKpis.elegivelAjuizamento,color:PUR,filtro:{tipo:"ajuizamento"}},
                ].map(k=>(
```

Note: o grid do container pai (`src/main.jsx:7633`) usa
`gridTemplateColumns:mob?"repeat(2,1fr)":"repeat(4,1fr)"` para 4 cards — agora são 5.
Ajustar para 5 colunas no desktop mantendo 2 no mobile:

Ler o contexto atual em `src/main.jsx:7633`:

```javascript
              <div style={{display:"grid",gridTemplateColumns:mob?"repeat(2,1fr)":"repeat(4,1fr)",gap:14}}>
```

Substituir por:

```javascript
              <div style={{display:"grid",gridTemplateColumns:mob?"repeat(2,1fr)":"repeat(5,1fr)",gap:14}}>
```

- [ ] **Step 4: Testar visualmente no browser**

Rodar `npm run dev`, abrir a aba Cobrança logado no app. Confirmar:
- O novo card "🆕 Novos em Atraso na 1ª Parcela" aparece como primeiro card do grid, com
  a contagem correta (comparar manualmente com os dados reais: procurar na base algum
  cliente com 1 único contrato e a parcela 1 atrasada).
- Clicar no card filtra a lista abaixo (título muda para "Fila de Cobrança · Novos em
  Atraso na 1ª Parcela", aparece botão "Limpar filtro").
- Clicar de novo no card (ou em "Limpar filtro") volta a mostrar todos os clientes.
- Um cliente com 2+ contratos na vida (mesmo que só 1 ativo hoje) **não** aparece nesse
  card, mesmo que a parcela 1 do contrato atual esteja atrasada — checar
  `totalContratosPorCliente` desse cliente na base (via `ID_CLIENTE`) para confirmar que
  é >1 antes de validar que ele ficou de fora.
- Um cliente novo (1 único contrato) cuja parcela atrasada é a 2ª (não a 1ª — ou seja, a
  parcela 1 já foi paga) **não** aparece nesse card.
- Sem erros no console do navegador.

- [ ] **Step 5: Commit**

```bash
git add src/main.jsx
git commit -m "$(cat <<'EOF'
feat: adiciona card KPI clicavel de clientes novos com 1a parcela em atraso

Novo filtro novoAtraso1 em cobItemsFiltrados/filtroLabel, reaproveitando o
padrao existente de KpiCard clicavel + toggleFiltro. Grid ajustado de 4 para
5 colunas no desktop.

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 3: Badge inline "🆕 1ª parcela" na lista geral (mobile + desktop)

**Files:**
- Modify: `src/main.jsx:7669-7687` (renderização mobile, lista de cards)
- Modify: `src/main.jsx:7702-7718` (renderização desktop, `TableRow`)

**Interfaces:**
- Consumes: `isNovoAtraso1` (Task 1), `cobItemsOrdenados` (já existente,
  `src/main.jsx:7615-7622`), `Badge` (componente existente, usado em várias partes do
  arquivo com prop `c` para cor, ex. `<Badge c={RED}>{...}</Badge>`).
- Produces: nenhuma interface nova — puramente visual, consumido só pela Task 4 (que
  adiciona o botão de WhatsApp ao lado do mesmo badge).

- [ ] **Step 1: Badge na renderização mobile**

Ler o contexto atual em `src/main.jsx:7672-7680`:

```javascript
                        <div style={{flex:1,minWidth:0}}>
                          <div style={{fontWeight:700,fontSize:14,display:"flex",alignItems:"center",gap:6,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{nomeCliente(c)}{scoreBadge(c)}</div>
                          <div style={{fontSize:11,color:MUTED,marginTop:3,display:"flex",gap:8,alignItems:"center",flexWrap:"wrap"}}>
                            {prioridadeBadge(c.prioridade)}
                            <Badge c={c.maxAtraso>60?RED:c.maxAtraso>30?ORG:YEL}>{c.maxAtraso}d</Badge>
                            <span>{c.qtdContratos} contrato{c.qtdContratos>1?"s":""}</span>
                          </div>
                          {c.prioridade?.acao&&<div style={{fontSize:11,color:MUTED,marginTop:4,fontStyle:"italic"}}>→ {c.prioridade.acao}</div>}
                        </div>
```

Substituir por (badge condicional adicionado dentro da mesma `div` de metadados):

```javascript
                        <div style={{flex:1,minWidth:0}}>
                          <div style={{fontWeight:700,fontSize:14,display:"flex",alignItems:"center",gap:6,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{nomeCliente(c)}{scoreBadge(c)}</div>
                          <div style={{fontSize:11,color:MUTED,marginTop:3,display:"flex",gap:8,alignItems:"center",flexWrap:"wrap"}}>
                            {isNovoAtraso1(c)&&<Badge c={RED}>🆕 1ª parcela</Badge>}
                            {prioridadeBadge(c.prioridade)}
                            <Badge c={c.maxAtraso>60?RED:c.maxAtraso>30?ORG:YEL}>{c.maxAtraso}d</Badge>
                            <span>{c.qtdContratos} contrato{c.qtdContratos>1?"s":""}</span>
                          </div>
                          {c.prioridade?.acao&&<div style={{fontSize:11,color:MUTED,marginTop:4,fontStyle:"italic"}}>→ {c.prioridade.acao}</div>}
                        </div>
```

- [ ] **Step 2: Badge na renderização desktop**

Ler o contexto atual em `src/main.jsx:7704-7706`:

```javascript
                            <TableCell className="whitespace-normal">
                              <div style={{fontWeight:700,display:"flex",alignItems:"center",gap:8}}>{nomeCliente(c)}{scoreBadge(c)}</div>
                            </TableCell>
```

Substituir por:

```javascript
                            <TableCell className="whitespace-normal">
                              <div style={{fontWeight:700,display:"flex",alignItems:"center",gap:8,flexWrap:"wrap"}}>{nomeCliente(c)}{scoreBadge(c)}{isNovoAtraso1(c)&&<Badge c={RED}>🆕 1ª parcela</Badge>}</div>
                            </TableCell>
```

- [ ] **Step 3: Testar visualmente no browser**

Com `npm run dev` rodando, abrir a aba Cobrança. Confirmar:
- No mobile (redimensionar janela ou emular dispositivo), o cliente que aparece no card
  KPI da Task 2 também mostra o badge "🆕 1ª parcela" na lista geral (sem filtro ativo).
- No desktop, o mesmo cliente mostra o badge ao lado do nome na tabela.
- Clientes que não batem com o critério não mostram o badge.
- Sem erros no console do navegador.

- [ ] **Step 4: Commit**

```bash
git add src/main.jsx
git commit -m "$(cat <<'EOF'
feat: badge inline de cliente novo com 1a parcela em atraso na fila de Cobranca

Aplicado nas duas renderizacoes (mobile card + desktop Table), visivel mesmo
sem o filtro do card KPI ativo.

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 4: Botão de contato via WhatsApp com mensagem pronta

**Files:**
- Modify: `src/main.jsx:5079` (logo após o fechamento de `abrirWhatsApp`, para adicionar
  a nova função ao lado dela)
- Modify: `src/main.jsx` (linhas alteradas pela Task 3 — adicionar o botão ao lado do
  badge, nas duas renderizações)

**Interfaces:**
- Consumes: `isNovoAtraso1` (Task 1); campos de `cobItems`/`cobItemsOrdenados`:
  `TELEFONE`, `NOME_CLIENTE` (ambos já presentes no objeto retornado por `cobItems`,
  `src/main.jsx:6362-6372`), `maxAtraso`.
- Produces: `abrirWhatsAppNovoAtraso1(telefone, nome, dias)` (função pura no escopo do
  módulo, sem retorno — abre `window.open`). Não é consumida por nenhuma task futura,
  é o fim da cadeia desta feature.

- [ ] **Step 1: Criar a função `abrirWhatsAppNovoAtraso1`**

Ler o contexto atual em `src/main.jsx:5073-5079`:

```javascript
function abrirWhatsApp(telefone, nomeCliente) {
  const num = String(telefone||'').replace(/\D/g,'');
  if(!num || num.length < 10) { alert('Telefone do cliente não cadastrado.'); return; }
  const numFull = num.startsWith('55') ? num : '55' + num;
  const msg = encodeURIComponent("Parabens, seu contrato de emprestimo foi finalizado com sucesso!\n\nQuero agradecer pela confianca e pela seriedade em cumprir nosso acordo. Foi um prazer poder te ajudar!\nSempre que precisar, estarei a disposicao para um novo emprestimo.\n\nDesejo uma otima tarde e uma semana incrivel!");
  window.open(`https://wa.me/${numFull}?text=${msg}`,'_blank');
}
```

Adicionar logo abaixo (linha 5080):

```javascript

function abrirWhatsAppNovoAtraso1(telefone, nome, dias) {
  const num = String(telefone||'').replace(/\D/g,'');
  if(!num || num.length < 10) { alert('Telefone do cliente não cadastrado.'); return; }
  const numFull = num.startsWith('55') ? num : '55' + num;
  const msg = encodeURIComponent(`Olá ${nome}, tudo bem? Notei que a 1ª parcela do seu contrato venceu há ${dias} dia${dias>1?'s':''} e ainda não identificamos o pagamento. Pode verificar, por favor? Qualquer dúvida, estou à disposição.`);
  window.open(`https://wa.me/${numFull}?text=${msg}`,'_blank');
}
```

- [ ] **Step 2: Botão na renderização mobile, ao lado do badge**

Ler o contexto (já modificado pela Task 3) em `src/main.jsx`, dentro da `div` de
metadados do card mobile:

```javascript
                          <div style={{fontSize:11,color:MUTED,marginTop:3,display:"flex",gap:8,alignItems:"center",flexWrap:"wrap"}}>
                            {isNovoAtraso1(c)&&<Badge c={RED}>🆕 1ª parcela</Badge>}
                            {prioridadeBadge(c.prioridade)}
                            <Badge c={c.maxAtraso>60?RED:c.maxAtraso>30?ORG:YEL}>{c.maxAtraso}d</Badge>
                            <span>{c.qtdContratos} contrato{c.qtdContratos>1?"s":""}</span>
                          </div>
```

Substituir por (botão adicionado logo após o badge, com `stopPropagation` para não abrir
o `CobrancaModal` do clique no card ao redor):

```javascript
                          <div style={{fontSize:11,color:MUTED,marginTop:3,display:"flex",gap:8,alignItems:"center",flexWrap:"wrap"}}>
                            {isNovoAtraso1(c)&&<Badge c={RED}>🆕 1ª parcela</Badge>}
                            {isNovoAtraso1(c)&&<button onClick={e=>{e.stopPropagation();abrirWhatsAppNovoAtraso1(c.TELEFONE,nomeCliente(c),c.maxAtraso);}} style={{display:"flex",alignItems:"center",gap:4,padding:"3px 8px",borderRadius:9999,border:"none",background:"#25D366",color:"#fff",fontSize:11,fontWeight:700,cursor:"pointer"}}>WhatsApp</button>}
                            {prioridadeBadge(c.prioridade)}
                            <Badge c={c.maxAtraso>60?RED:c.maxAtraso>30?ORG:YEL}>{c.maxAtraso}d</Badge>
                            <span>{c.qtdContratos} contrato{c.qtdContratos>1?"s":""}</span>
                          </div>
```

- [ ] **Step 3: Botão na renderização desktop, ao lado do badge**

Ler o contexto (já modificado pela Task 3) em `src/main.jsx`, dentro do `TableCell` do
nome:

```javascript
                            <TableCell className="whitespace-normal">
                              <div style={{fontWeight:700,display:"flex",alignItems:"center",gap:8,flexWrap:"wrap"}}>{nomeCliente(c)}{scoreBadge(c)}{isNovoAtraso1(c)&&<Badge c={RED}>🆕 1ª parcela</Badge>}</div>
                            </TableCell>
```

Substituir por:

```javascript
                            <TableCell className="whitespace-normal">
                              <div style={{fontWeight:700,display:"flex",alignItems:"center",gap:8,flexWrap:"wrap"}}>
                                {nomeCliente(c)}{scoreBadge(c)}
                                {isNovoAtraso1(c)&&<Badge c={RED}>🆕 1ª parcela</Badge>}
                                {isNovoAtraso1(c)&&<button onClick={e=>{e.stopPropagation();abrirWhatsAppNovoAtraso1(c.TELEFONE,nomeCliente(c),c.maxAtraso);}} style={{display:"flex",alignItems:"center",gap:4,padding:"3px 8px",borderRadius:9999,border:"none",background:"#25D366",color:"#fff",fontSize:11,fontWeight:700,cursor:"pointer"}}>WhatsApp</button>}
                              </div>
                            </TableCell>
```

- [ ] **Step 4: Testar no browser — caminho feliz**

Com `npm run dev` rodando, abrir a aba Cobrança, localizar um cliente com o badge "🆕 1ª
parcela" (mobile e desktop). Clicar no botão "WhatsApp":
- Confirmar que abre uma nova aba/janela `wa.me` com o número do cliente (prefixado
  `55`) e o texto da mensagem contendo o nome correto e os dias de atraso corretos
  (comparar com o valor mostrado no badge de dias ao lado, ex. "15d" → mensagem deve
  dizer "há 15 dias").
- Confirmar que o clique no botão **não** abre o `CobrancaModal` (o `stopPropagation`
  deve impedir isso).
- Clicar em qualquer outro ponto da linha/card (fora do botão) e confirmar que o
  `CobrancaModal` abre normalmente (comportamento pré-existente preservado).

- [ ] **Step 5: Testar no browser — telefone ausente/inválido**

Se houver na base algum cliente sem telefone cadastrado que também bata com o critério
de "novo + 1ª parcela atrasada" (ou simular temporariamente removendo o telefone de um
cliente de teste), clicar no botão "WhatsApp" e confirmar que aparece o `alert`
"Telefone do cliente não cadastrado." em vez de abrir uma aba com URL quebrada.

- [ ] **Step 6: Commit**

```bash
git add src/main.jsx
git commit -m "$(cat <<'EOF'
feat: botao WhatsApp com mensagem pronta para clientes novos em atraso na 1a parcela

Nova funcao abrirWhatsAppNovoAtraso1 (independente da abrirWhatsApp existente,
que e codigo morto). Botao ao lado do badge nas duas renderizacoes, com
stopPropagation para nao abrir o CobrancaModal.

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 5: Verificação final (Tier 2 — Standard) e deploy

**Files:** nenhum arquivo novo — task de verificação/deploy.

**Interfaces:**
- Consumes: todo o trabalho das Tasks 1-4.
- Produces: nada — task terminal.

- [ ] **Step 1: Rodar o skill `/review` (Tier 2 — Standard)**

Conforme `CLAUDE.md` do projeto, antes de qualquer deploy de nova funcionalidade
frontend é obrigatório rodar o review Tier 2. Invocar o skill `review` cobrindo os
arquivos alterados nas Tasks 1-4 (só `src/main.jsx`).

- [ ] **Step 2: Corrigir qualquer item CRÍTICO ou BLOQUEANTE encontrado**

Se o review apontar algo crítico, corrigir antes de prosseguir. Itens não-críticos
(ex.: sugestões de estilo) podem ser avaliados caso a caso com o usuário.

- [ ] **Step 3: Deploy**

```bash
vercel deploy --prod
```

- [ ] **Step 4: Verificação funcional em produção (checklist Tier 2 do `CLAUDE.md`)**

No app em produção, aba Cobrança:
- Card "🆕 Novos em Atraso na 1ª Parcela" renderiza com contagem correta.
- Clique no card filtra/limpa filtro corretamente.
- Badge "🆕 1ª parcela" aparece nas linhas corretas (mobile e desktop).
- Botão WhatsApp abre `wa.me` com mensagem e número corretos, sem acionar o
  `CobrancaModal`.
- Funcionalidades adjacentes não quebraram: os outros cards de KPI (Crítica/Forte/
  Normal/Elegíveis p/ ajuizamento) continuam filtrando normalmente; clicar numa linha
  qualquer (fora do botão WhatsApp) ainda abre o `CobrancaModal` e permite registrar
  pagamento.
- Sem erros no console do navegador.

- [ ] **Step 5: Atualizar `CLAUDE.md` do projeto**

Adicionar uma entrada breve na seção "Abas do frontend (UI)" (tabela, linha da aba
Cobrança) mencionando o novo card, seguindo o mesmo estilo das entradas existentes
(ex.: a menção ao `AcaoEnvioManualRegua` na linha da Régua WPP).
