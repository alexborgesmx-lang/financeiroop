# Rollout Design v3 — Aba Cobrança Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Levar o padrão visual v3 (já aplicado no Dashboard) para a aba Cobrança —
KPI cards consistentes via componente reutilizável `KpiCard`, tabela desktop migrada
pro primitivo shadcn `Table`, zebra na lista mobile.

**Architecture:** Extrair `KpiCard` como função top-level em `src/main.jsx` (mesmo
arquivo, sem criar componente separado — convenção do projeto). Reusar o primitivo
`Table`/`TableHeader`/`TableRow`/`TableHead`/`TableBody`/`TableCell` já existente em
`src/components/ui/table.jsx` (construído na Fase 1, nunca usado até agora). Zero
mudança de lógica de negócio — só a casca visual de JSX já renderizado.

**Tech Stack:** React 18 (function components, hooks), Tailwind v4 (classes utilitárias
nos primitivos shadcn), variáveis de tema globais (`let TEXT, MUTED, CARD, BD, SHD,
GRN, RED, ORG, YEL, BLU, PUR, CARD2` — reatribuídas por `applyTheme()`, acessíveis em
qualquer função top-level do arquivo sem prop-drilling).

## Global Constraints

- Não muda nenhuma lógica de `cobKpis`, `cobItems`, `cobFiltro`, `toggleFiltro`,
  `filtroAtivo` — só a casca visual.
- Não toca `CobModal` nem nenhuma outra aba.
- `KpiCard` fica em `src/main.jsx` (sem arquivo separado — convenção do projeto).
- Import do primitivo `Table` segue o padrão já usado para `Card`/`Button`
  (`src/main.jsx:5-6`): `import { X } from "./components/ui/table"`.
- Build de verificação em toda etapa: `npx vite build` (sem servidor de dev rodando —
  só checa erros de sintaxe/import).
- Refinamento em relação à spec: a spec (`docs/superpowers/specs/2026-07-17-rollout-cobranca-v3-design.md`)
  cogitava passar `mob` como prop explícito pro `KpiCard`. Investigação nesta sessão
  achou um caminho mais simples e já usado 6x no arquivo: o hook `useIsMobile()`
  (`main.jsx:4810`, função `function`, hoisted — chamável de qualquer função top-level
  independente de posição no arquivo). `KpiCard` chama `useIsMobile()` internamente
  em vez de receber `mob` como prop — elimina a necessidade de `mob={mob}` em cada
  call site. Esta decisão substitui a da spec.

---

### Task 1: Componente `KpiCard`

**Files:**
- Modify: `src/main.jsx:338` (logo após a função `Badge`, antes de `isUltima`)

**Interfaces:**
- Consumes: variáveis de tema globais (`TEXT`, `MUTED`, `CARD`, `BD`, `SHD`, `GRN`,
  `RED`), hook `useIsMobile()` (`main.jsx:4810`), componente `InfoTooltip`
  (`main.jsx:2918`, prop `{text}`).
- Produces: `function KpiCard({label, value, sub, color, icon, iconBg, tip, delta, badge, onClick, active})`
  — usado pelas Tasks 2 e 3, e por qualquer rollout futuro de outra aba.

- [ ] **Step 1: Inserir o componente**

Local exato — depois desta linha (`main.jsx:338`):
```javascript
function Badge({c,children,size="sm"}){ const p=size==="md"?"4px 12px":"3px 10px",fs=size==="md"?11:10; return <span style={{display:"inline-flex",alignItems:"center",gap:4,padding:p,borderRadius:9999,fontSize:fs,fontWeight:700,background:c+"18",color:c,border:`1px solid ${c}28`,lineHeight:1.3,whiteSpace:"nowrap"}}>{children}</span>; }
```

Inserir o bloco abaixo logo depois (antes de `function isUltima`):

```javascript
function KpiCard({label,value,sub,color=TEXT,icon,iconBg,tip,delta,badge,onClick,active}){
  const mob=useIsMobile();
  return (
    <div
      onClick={onClick}
      style={{
        background:CARD, padding:16, borderRadius:16,
        border:`1px solid ${active?color:BD}`,
        boxShadow:SHD, position:"relative", overflow:"hidden",
        cursor:onClick?"pointer":"default",
        transition:"transform 180ms cubic-bezier(0.34,1.56,0.64,1),box-shadow 180ms ease"
      }}
      onMouseEnter={onClick?e=>{e.currentTarget.style.transform="translateY(-2px)";e.currentTarget.style.boxShadow="0 8px 24px rgba(0,0,0,0.13)";}:undefined}
      onMouseLeave={onClick?e=>{e.currentTarget.style.transform="";e.currentTarget.style.boxShadow=SHD;}:undefined}
    >
      <div style={{display:"flex",alignItems:"flex-start",justifyContent:"space-between",marginBottom:icon?12:4}}>
        <div style={{fontSize:10,fontWeight:600,color:MUTED,textTransform:"uppercase",letterSpacing:"0.08em",lineHeight:1.3,display:"flex",alignItems:"center",flex:1,minWidth:0}}>
          {label}{tip&&<InfoTooltip text={tip}/>}
        </div>
        {icon&&<div style={{width:30,height:30,borderRadius:8,background:iconBg||color+"18",display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0,marginLeft:6}}>{icon}</div>}
      </div>
      <div style={{fontSize:mob?17:22,fontWeight:800,color:color}}>{value}</div>
      {(sub||delta!=null||badge)&&
        <div style={{display:"flex",alignItems:"center",gap:6,marginTop:5,flexWrap:"wrap"}}>
          {sub&&<div style={{fontSize:11,color:MUTED,fontWeight:500}}>{sub}</div>}
          {delta!=null&&<div style={{fontSize:10,fontWeight:700,color:delta>=0?GRN:RED,background:delta>=0?GRN+"14":RED+"14",padding:"1px 5px",borderRadius:4}}>{delta>=0?"▲":"▼"} {Math.abs(delta).toFixed(1)}%</div>}
          {badge&&<div style={{fontSize:10,fontWeight:700,color:RED,background:RED+"14",padding:"1px 5px",borderRadius:4}}>{badge}</div>}
        </div>
      }
      <div style={{position:"absolute",bottom:0,left:0,right:0,height:3,background:color,borderRadius:"0 0 14px 14px",opacity:onClick?0.6:1}}/>
    </div>
  );
}
```

- [ ] **Step 2: Verificar o build**

Run: `npx vite build`
Expected: build termina sem erro (componente ainda não é usado em lugar nenhum —
é código morto até a Task 2, isso é esperado e não gera warning de build no Vite).

- [ ] **Step 3: Commit**

```bash
git add src/main.jsx
git commit -m "feat: adiciona componente KpiCard reutilizável (rollout design v3)"
```

---

### Task 2: Migrar os 2 grids de KPI da aba Cobrança para `KpiCard`

**Files:**
- Modify: `src/main.jsx` — bloco da aba Cobrança, dentro de `{tab==="cobranca"&&...}`
  (localizar pelo texto âncora abaixo, não pelo número de linha — a Task 1 já deslocou
  todo o arquivo a partir da linha 338).

**Interfaces:**
- Consumes: `KpiCard` (Task 1).
- Produces: nenhuma interface nova — mudança folha, nada depende disso depois.

- [ ] **Step 1: Localizar o bloco pelo texto âncora**

Buscar por `{/* KPIs de Prioridade de Cobrança` em `src/main.jsx`. O bloco a substituir
(dois grids seguidos, do `<div style={{display:"grid"...4,1fr)"` até o fechamento do
segundo grid, logo antes de `<div style={{background:CARD,borderRadius:16,border:`1px solid ${BD}`,overflow:"hidden",boxShadow:SHD}}>` que abre o painel "Fila de Cobrança") é:

```javascript
              {/* KPIs de Prioridade de Cobrança — Fase 1, calculado 100% no navegador */}
              <div style={{display:"grid",gridTemplateColumns:mob?"repeat(2,1fr)":"repeat(4,1fr)",gap:14}}>
                {[
                  {label:"🔥 Crítica",val:cobKpis.critica,c:RED,filtro:{tipo:"banda",valor:"Crítica"}},
                  {label:"⚠ Forte",val:cobKpis.forte,c:ORG,filtro:{tipo:"banda",valor:"Forte"}},
                  {label:"🟡 Normal",val:cobKpis.normal,c:YEL,filtro:{tipo:"banda",valor:"Normal"}},
                  {label:"⚖ Elegíveis p/ ajuizamento",val:cobKpis.elegivelAjuizamento,c:PUR,filtro:{tipo:"ajuizamento"}},
                ].map(k=>(
                  <div key={k.label} onClick={()=>toggleFiltro(k.filtro)}
                    style={{background:CARD,padding:16,borderRadius:16,border:`1px solid ${filtroAtivo(k)?k.c:BD}`,boxShadow:SHD,position:"relative",overflow:"hidden",cursor:"pointer",transition:"transform 180ms cubic-bezier(0.34,1.56,0.64,1),box-shadow 180ms ease"}}
                    onMouseEnter={e=>{e.currentTarget.style.transform="translateY(-2px)";e.currentTarget.style.boxShadow="0 8px 24px rgba(0,0,0,0.13)";}}
                    onMouseLeave={e=>{e.currentTarget.style.transform="";e.currentTarget.style.boxShadow=SHD;}}>
                    <div style={{fontSize:10,color:MUTED,fontWeight:600,textTransform:"uppercase",marginBottom:4}}>{k.label}</div>
                    <div style={{fontSize:mob?17:22,fontWeight:800,color:k.c}}>{k.val}</div>
                    <div style={{fontSize:9,color:k.c,marginTop:5,fontWeight:600,opacity:0.7}}>{filtroAtivo(k)?"clique p/ limpar filtro":"clique p/ filtrar"}</div>
                    <div style={{position:"absolute",bottom:0,left:0,right:0,height:3,background:k.c,borderRadius:"0 0 14px 14px",opacity:0.6}}/>
                  </div>
                ))}
              </div>
              <div style={{display:"grid",gridTemplateColumns:mob?"repeat(2,1fr)":"repeat(3,1fr)",gap:14}}>
                {[
                  {label:"📅 Promessas hoje",val:cobKpis.promessasHoje,c:BLU},
                  {label:"❌ Promessas quebradas",val:cobKpis.promessasQuebradas,c:RED},
                  {label:"💰 Valor total em risco",val:fmtR(cobKpis.valorRisco),c:ORG},
                ].map(k=>(
                  <div key={k.label} style={{background:CARD,padding:16,borderRadius:16,border:`1px solid ${BD}`,boxShadow:SHD}}>
                    <div style={{fontSize:10,color:MUTED,fontWeight:600,textTransform:"uppercase",marginBottom:4}}>{k.label}</div>
                    <div style={{fontSize:mob?17:20,fontWeight:800,color:k.c}}>{k.val}</div>
                  </div>
                ))}
              </div>
```

- [ ] **Step 2: Substituir pelo bloco novo**

```javascript
              {/* KPIs de Prioridade de Cobrança — Fase 1, calculado 100% no navegador */}
              <div style={{display:"grid",gridTemplateColumns:mob?"repeat(2,1fr)":"repeat(4,1fr)",gap:14}}>
                {[
                  {label:"🔥 Crítica",value:cobKpis.critica,color:RED,filtro:{tipo:"banda",valor:"Crítica"}},
                  {label:"⚠ Forte",value:cobKpis.forte,color:ORG,filtro:{tipo:"banda",valor:"Forte"}},
                  {label:"🟡 Normal",value:cobKpis.normal,color:YEL,filtro:{tipo:"banda",valor:"Normal"}},
                  {label:"⚖ Elegíveis p/ ajuizamento",value:cobKpis.elegivelAjuizamento,color:PUR,filtro:{tipo:"ajuizamento"}},
                ].map(k=>(
                  <KpiCard key={k.label} label={k.label} value={k.value} color={k.color}
                    active={filtroAtivo(k)} onClick={()=>toggleFiltro(k.filtro)}
                    sub={filtroAtivo(k)?"clique p/ limpar filtro":"clique p/ filtrar"}/>
                ))}
              </div>
              <div style={{display:"grid",gridTemplateColumns:mob?"repeat(2,1fr)":"repeat(3,1fr)",gap:14}}>
                {[
                  {label:"📅 Promessas hoje",value:cobKpis.promessasHoje,color:BLU},
                  {label:"❌ Promessas quebradas",value:cobKpis.promessasQuebradas,color:RED},
                  {label:"💰 Valor total em risco",value:fmtR(cobKpis.valorRisco),color:ORG},
                ].map(k=>(<KpiCard key={k.label} label={k.label} value={k.value} color={k.color}/>))}
              </div>
```

- [ ] **Step 3: Verificar o build**

Run: `npx vite build`
Expected: build termina sem erro.

- [ ] **Step 4: Commit**

```bash
git add src/main.jsx
git commit -m "feat: migra KPI cards da aba Cobrança para o componente KpiCard"
```

---

### Task 3: Migrar a tabela desktop da Fila de Cobrança para o primitivo shadcn `Table`

**Files:**
- Modify: `src/main.jsx:5-6` (bloco de imports, adicionar import novo)
- Modify: `src/main.jsx` — branch desktop dentro de `{tab==="cobranca"&&...}` (localizar
  por texto âncora)

**Interfaces:**
- Consumes: `Table, TableHeader, TableRow, TableHead, TableBody, TableCell` de
  `src/components/ui/table.jsx` (já existem, não precisam ser criados — ver definição
  completa em `src/components/ui/table.jsx:1-121`).
- Produces: nenhuma interface nova.

- [ ] **Step 1: Adicionar o import**

Depois desta linha (`main.jsx:6`):
```javascript
import { Button } from "./components/ui/button";
```
Adicionar:
```javascript
import { Table, TableHeader, TableRow, TableHead, TableBody, TableCell } from "./components/ui/table";
```

- [ ] **Step 2: Localizar o bloco pelo texto âncora**

Buscar por `<table style={{width:"100%",borderCollapse:"collapse",textAlign:"left"}}>`
dentro do branch `{tab==="cobranca"...}` — é o único `<table>` dessa aba (a lista mobile
usa `<div>`, não `<table>`). O bloco completo a substituir, do `: <div style={{overflowX:"auto"}}>`
até o `}` que fecha o `mob ? ... : ...` ternário, é:

```javascript
                : <div style={{overflowX:"auto"}}>
                    <table style={{width:"100%",borderCollapse:"collapse",textAlign:"left"}}>
                      <thead>
                        <tr style={{background:GRN+"10",fontSize:11,color:GRN,fontWeight:700,textTransform:"uppercase"}}>
                          <th style={{padding:"10px 18px"}}>Cliente</th>
                          <th>Prioridade</th>
                          <th>Nível</th>
                          <th>Atraso Máx</th>
                          <th>Valor</th>
                          <th>Próxima Ação</th>
                          <th style={{padding:"10px 18px",textAlign:"right"}}>Ação</th>
                        </tr>
                      </thead>
                      <tbody>
                        {cobItemsFiltrados.map(c=>(
                          <tr key={c.ID_CLIENTE} onClick={()=>setCobModal(c)}
                            style={{borderBottom:`1px solid ${BD}`,fontSize:13,cursor:"pointer",transition:"background 0.1s"}}
                            onMouseEnter={e=>e.currentTarget.style.background=BG}
                            onMouseLeave={e=>e.currentTarget.style.background="transparent"}>
                            <td style={{padding:"13px 18px"}}>
                              <div style={{fontWeight:700,display:"flex",alignItems:"center",gap:8}}>{nomeCliente(c)}{scoreBadge(c)}</div>
                              <div style={{fontSize:11,color:MUTED}}>ID {c.ID_CLIENTE||"—"} · {telCliente(c)}</div>
                            </td>
                            <td>{prioridadeBadge(c.prioridade)}</td>
                            <td style={{fontSize:12,color:MUTED,fontWeight:600}}>{c.prioridade?.nivelLabel||"—"}</td>
                            <td><Badge c={c.maxAtraso>60?RED:c.maxAtraso>30?ORG:YEL}>{c.maxAtraso} dias</Badge></td>
                            <td style={{fontWeight:700,color:RED}}>{fmtR(c.vAtraso)}</td>
                            <td style={{fontSize:12,color:MUTED,maxWidth:200}}>{c.prioridade?.acao||"—"}</td>
                            <td style={{padding:"13px 18px",textAlign:"right"}}>
                              <button onClick={e=>{e.stopPropagation();setCobModal(c);}} style={{...BTN7(GRN),padding:"5px 12px",fontSize:11,display:"flex",alignItems:"center",gap:4}}>
                                {IcoPag} Registrar
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
```

- [ ] **Step 3: Substituir pelo bloco novo**

```javascript
                : <div style={{overflowX:"auto"}}>
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Cliente</TableHead>
                          <TableHead>Prioridade</TableHead>
                          <TableHead>Nível</TableHead>
                          <TableHead>Atraso Máx</TableHead>
                          <TableHead>Valor</TableHead>
                          <TableHead>Próxima Ação</TableHead>
                          <TableHead className="text-right">Ação</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {cobItemsFiltrados.map(c=>(
                          <TableRow key={c.ID_CLIENTE} onClick={()=>setCobModal(c)} style={{cursor:"pointer"}}>
                            <TableCell className="whitespace-normal">
                              <div style={{fontWeight:700,display:"flex",alignItems:"center",gap:8}}>{nomeCliente(c)}{scoreBadge(c)}</div>
                              <div style={{fontSize:11,color:MUTED}}>ID {c.ID_CLIENTE||"—"} · {telCliente(c)}</div>
                            </TableCell>
                            <TableCell>{prioridadeBadge(c.prioridade)}</TableCell>
                            <TableCell style={{fontSize:12,color:MUTED,fontWeight:600}}>{c.prioridade?.nivelLabel||"—"}</TableCell>
                            <TableCell><Badge c={c.maxAtraso>60?RED:c.maxAtraso>30?ORG:YEL}>{c.maxAtraso} dias</Badge></TableCell>
                            <TableCell style={{fontWeight:700,color:RED}}>{fmtR(c.vAtraso)}</TableCell>
                            <TableCell className="whitespace-normal" style={{fontSize:12,color:MUTED,maxWidth:200}}>{c.prioridade?.acao||"—"}</TableCell>
                            <TableCell className="text-right">
                              <button onClick={e=>{e.stopPropagation();setCobModal(c);}} style={{...BTN7(GRN),padding:"5px 12px",fontSize:11,display:"flex",alignItems:"center",gap:4}}>
                                {IcoPag} Registrar
                              </button>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
```

Nota: `TableHead`/`TableCell` do shadcn aplicam `whitespace-nowrap` por padrão (ver
`src/components/ui/table.jsx:78,93`) — por isso a célula "Cliente" (2 linhas de texto)
e "Próxima Ação" (`maxWidth:200`, texto variável) recebem `className="whitespace-normal"`
pra não cortar/overflow. As demais colunas mantêm o `whitespace-nowrap` padrão (correto
pra elas — valores curtos). O `onMouseEnter`/`onMouseLeave` manual de hover do `<tr>`
antigo foi removido — `TableRow` já tem `hover:bg-muted/50` embutido
(`src/components/ui/table.jsx:63`).

- [ ] **Step 4: Verificar o build**

Run: `npx vite build`
Expected: build termina sem erro.

- [ ] **Step 5: Commit**

```bash
git add src/main.jsx
git commit -m "feat: migra tabela desktop da Fila de Cobrança para o primitivo shadcn Table"
```

---

### Task 4: Zebra na lista mobile

**Files:**
- Modify: `src/main.jsx` — branch mobile dentro de `{tab==="cobranca"&&...}`

**Interfaces:**
- Consumes: nenhuma (mudança isolada de estilo).
- Produces: nenhuma.

- [ ] **Step 1: Localizar e editar**

Buscar por `{cobItemsFiltrados.map(c=>(` dentro do branch mobile (`mob ? <div ...>` —
é o primeiro `.map(c=>` da aba Cobrança, ANTES do que a Task 2/3 já tocaram; distinto
do `.map(c=>` de dentro do `TableBody` da Task 3). Trecho atual:

```javascript
                ? <div style={{display:"flex",flexDirection:"column"}}>
                    {cobItemsFiltrados.map(c=>(
                      <div key={c.ID_CLIENTE} onClick={()=>setCobModal(c)}
                        style={{padding:"14px 16px",borderBottom:`1px solid ${BD}`,cursor:"pointer",display:"flex",justifyContent:"space-between",alignItems:"center",gap:12}}>
```

Substituir por (adiciona índice `i` no `.map` e `background` no `style`):

```javascript
                ? <div style={{display:"flex",flexDirection:"column"}}>
                    {cobItemsFiltrados.map((c,i)=>(
                      <div key={c.ID_CLIENTE} onClick={()=>setCobModal(c)}
                        style={{padding:"14px 16px",borderBottom:`1px solid ${BD}`,cursor:"pointer",display:"flex",justifyContent:"space-between",alignItems:"center",gap:12,background:i%2===1?CARD2:"transparent"}}>
```

- [ ] **Step 2: Verificar o build**

Run: `npx vite build`
Expected: build termina sem erro.

- [ ] **Step 3: Commit**

```bash
git add src/main.jsx
git commit -m "feat: adiciona zebra na lista mobile da Fila de Cobrança"
```

---

### Task 5: Review, deploy e QA manual

**Files:** none (verificação apenas).

- [ ] **Step 1: Rodar o review do projeto**

Mudança introduz componente novo (`KpiCard`) e primeiro uso real do primitivo
`Table` — por `CLAUDE.md` ("novo componente" = Tier 2), invocar o skill `review`
(não o `quickreview`, mais leve, nem o `ultrareview-financeiroop`, que é só pra
GAS/financeiro/integração — nada disso é tocado aqui). Corrigir qualquer item 🔴
antes de continuar.

- [ ] **Step 2: Deploy pra produção**

```bash
vercel deploy --prod
```

- [ ] **Step 3: QA manual no browser (skill `browser`)**

Contra `https://financeiroop.vercel.app`, na aba Cobrança:
1. Grid de 4 KPIs clicáveis — clicar em cada um alterna o filtro da fila abaixo
   (mesmo comportamento de antes); borda muda pra cor do card quando ativo.
2. Grid de 3 KPIs não-clicáveis — renderizam sem cursor de ponteiro, sem quebrar
   layout.
3. Tabela desktop — header cinza mono uppercase (não mais verde sólido), zebra
   visível, coluna "Cliente" e "Próxima Ação" continuam quebrando texto em 2 linhas
   quando necessário (não cortam/overflow).
4. Clicar numa linha da tabela abre `CobModal` igual a antes.
5. Reduzir a largura da janela (ou emulador mobile) — lista mobile com zebra visível,
   clique abre `CobModal` igual a antes.
6. Alternar claro/escuro — conferir contraste do header da tabela e do zebra nos
   dois temas.
7. Console sem erros em todos os passos acima.

- [ ] **Step 4: Documentar (somente se necessário)**

Se algo relevante para sessões futuras foi descoberto durante a implementação (ex.:
comportamento do `whitespace-nowrap` do shadcn `TableCell`/`TableHead` já foi
documentado nesta spec/plano — só adicionar a `docs/ai-memory/07-AI-KNOWN-ISSUES.md`
se surgir algo novo além disso). Pular se nada de novo surgiu.

- [ ] **Step 5: Commit final (se o Step 4 produziu mudanças)**

```bash
git add docs/ai-memory/07-AI-KNOWN-ISSUES.md
git commit -m "docs: registra aprendizados do rollout design v3 na aba Cobrança"
```
