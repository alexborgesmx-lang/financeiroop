# Rollout Design v3 — Aba Cobrança — Design

Data: 2026-07-17
Status: Aprovado pelo usuário
Fase: 1 continuação — rollout do design v3 (tokens já aplicados globalmente em
2026-07-14/15; refactor visual completo até agora só no Dashboard) — primeiro de
uma série de sub-projetos, um por aba.

## Problema

A Fase 1 do design v3 (Rede Borges) trocou a paleta globalmente e fez o refactor
visual completo (hierarquia de KPI, tabela com header mono uppercase + zebra, chip de
severidade) só no **Dashboard**. As outras 9 abas (Clientes, Contratos, **Cobrança**,
Financeiro, Carteira, Perdas & Recuperação, Promessas, Régua WPP, Simulador) herdam as
cores novas por baixo (variáveis de tema são globais), mas o *padrão de componente*
continua o antigo: KPI cards sem ícone/badge/tooltip, tabelas `<table>` cruas com
header verde sólido e sem zebra.

Levantamento por grep: **15 ocorrências de `<table>` cru** espalhadas pelo app, cada
aba com seu próprio bloco de KPI cards quase-igual-mas-não-igual ao do Dashboard.
Rolar isso pra todas as 9 abas de uma vez é grande demais pra uma spec — decompõe em
sub-projetos, um por aba, mesmo padrão já usado nos documentos (Comprovante de
Pagamento → Comprovante de Quitação). Este documento cobre só a **aba Cobrança**,
escolhida como primeira por ser a mais usada no dia a dia de cobrança de atraso.

## Decisão de arquitetura (vale para todos os sub-projetos seguintes)

Hoje nenhum componente de KPI card ou tabela foi extraído — o Dashboard, a Carteira e
a Cobrança têm cada um seu próprio bloco de JSX inline quase idêntico. Replicar esse
padrão inline em mais 8 abas significaria ~9x a mesma duplicação de ~30 linhas.

**Decisão:** extrair `KpiCard` como função local reutilizável dentro de `main.jsx`
(não viola a convenção "sem componentes separados em arquivo próprio" — continua tudo
em `main.jsx`, só deixa de estar duplicado). Para tabelas, **reusar o primitivo
shadcn já existente** em `src/components/ui/table.jsx` (`Table`, `TableHeader`,
`TableRow`, `TableHead`, `TableBody`, `TableCell`) — ele já foi construído na Fase 1
com exatamente o visual v3 desejado (header mono uppercase sobre `--surface-2`, zebra
`odd/even`) e simplesmente nunca foi usado em lugar nenhum ainda. Importar shadcn
dentro do JSX majoritariamente inline de `main.jsx` não é um padrão novo — `<Card>` já
é importado e usado 7x hoje (`main.jsx:5`, usos a partir da linha ~5426).

## Escopo desta spec — só a aba Cobrança (`main.jsx:7217-7343`)

### A — Componente `KpiCard` (novo)

Local: perto do helper `Badge` existente (`main.jsx:338`).

```jsx
function KpiCard({label, value, sub, color=TEXT, icon, iconBg, tip, delta, badge, onClick, active}) {
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

Nota: `mob` é uma variável já disponível no escopo do componente `App` (usada em todo
o `main.jsx` hoje) — `KpiCard` fica definido como função top-level fora do `App`, então
**não tem acesso a `mob`** diretamente. Ajuste: `value` recebe o `fontSize` já resolvido
pelo chamador, ou `KpiCard` aceita um prop opcional `compact` — ver Task 1 do plano
para a resolução exata (evitar ambiguidade: **decisão tomada aqui** — `KpiCard` aceita
prop `mob` explícito, repassado pelo chamador como `<KpiCard mob={mob} .../>`, já que
`main.jsx` não usa Context/hooks compartilhados entre funções-irmãs).

**Fora de escopo:** o "hero banner" em gradiente `GRN`/`ONBRAND` do Dashboard (KPI
único em destaque) não se replica na Cobrança — a Cobrança não tem "um KPI do dia",
tem uma grade de filtros clicáveis. `KpiCard` cobre o card individual, não o hero.

### Aplicação em Cobrança — os dois grids de KPI

**Grid 1 (4 cards clicáveis, filtro de banda/ajuizamento)** — `main.jsx:7235-7252`:
```jsx
<div style={{display:"grid",gridTemplateColumns:mob?"repeat(2,1fr)":"repeat(4,1fr)",gap:14}}>
  {[
    {label:"🔥 Crítica",value:cobKpis.critica,color:RED,filtro:{tipo:"banda",valor:"Crítica"}},
    {label:"⚠ Forte",value:cobKpis.forte,color:ORG,filtro:{tipo:"banda",valor:"Forte"}},
    {label:"🟡 Normal",value:cobKpis.normal,color:YEL,filtro:{tipo:"banda",valor:"Normal"}},
    {label:"⚖ Elegíveis p/ ajuizamento",value:cobKpis.elegivelAjuizamento,color:PUR,filtro:{tipo:"ajuizamento"}},
  ].map(k=>(
    <KpiCard key={k.label} mob={mob} label={k.label} value={k.value} color={k.color}
      active={filtroAtivo(k)} onClick={()=>toggleFiltro(k.filtro)}
      sub={filtroAtivo(k)?"clique p/ limpar filtro":"clique p/ filtrar"}/>
  ))}
</div>
```
`sub` aqui reaproveita o texto de instrução que já existia (antes era uma linha
separada de 9px, vira o `sub` padrão de 11px do `KpiCard` — leve aumento visual,
intencional, consistente com o resto do componente).

**Grid 2 (3 cards não-clicáveis)** — `main.jsx:7253-7264`:
```jsx
<div style={{display:"grid",gridTemplateColumns:mob?"repeat(2,1fr)":"repeat(3,1fr)",gap:14}}>
  {[
    {label:"📅 Promessas hoje",value:cobKpis.promessasHoje,color:BLU},
    {label:"❌ Promessas quebradas",value:cobKpis.promessasQuebradas,color:RED},
    {label:"💰 Valor total em risco",value:fmtR(cobKpis.valorRisco),color:ORG},
  ].map(k=>(<KpiCard key={k.label} mob={mob} label={k.label} value={k.value} color={k.color}/>))}
</div>
```

### B — Tabela "Fila de Cobrança" (desktop) → primitivo shadcn `<Table>`

Local: `main.jsx:7301-7338` (branch desktop do `{mob ? ... : ...}`).

```jsx
import { Table, TableHeader, TableRow, TableHead, TableBody, TableCell } from "./components/ui/table";
// ...
<div style={{overflowX:"auto"}}>
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

**Gotcha confirmado por leitura de `table.jsx`:** `TableCell`/`TableHead` do shadcn
aplicam `whitespace-nowrap` por padrão — quebraria a coluna "Cliente" (2 linhas:
nome+badge, depois ID/tel) e "Próxima Ação" (`maxWidth:200`, texto variável). Fix:
`className="whitespace-normal"` nessas duas células especificamente, mantendo
`whitespace-nowrap` (padrão) nas demais.

O header do `<thead>` deixa de ser verde sólido (`background:GRN+"10",color:GRN`) e
passa a ser o padrão v3 (`--surface-2` + mono uppercase `--ink-faint`) — mesma mudança
já aplicada em todo lugar que usa esse componente. `onMouseEnter`/`onMouseLeave`
manuais de hover (`main.jsx:7318-7319`) são removidos — o hover já vem de
`TableRow`'s `hover:bg-muted/50` do Tailwind.

### C — Lista mobile ganha zebra

Local: `main.jsx:7281-7300` (branch mobile). Único ajuste:
```jsx
{cobItemsFiltrados.map((c,i)=>(
  <div key={c.ID_CLIENTE} onClick={()=>setCobModal(c)}
    style={{padding:"14px 16px",borderBottom:`1px solid ${BD}`,cursor:"pointer",display:"flex",justifyContent:"space-between",alignItems:"center",gap:12,background:i%2===1?CARD2:"transparent"}}>
```
Só adiciona `background:i%2===1?CARD2:"transparent"` (mesmo padrão do painel "Em
Atraso" do Dashboard, `main.jsx:6971`) — nenhuma outra mudança na lista mobile.

## Fora de escopo

- Lógica de `cobKpis`, `cobItems`, `cobFiltro`, `toggleFiltro`, `filtroAtivo` — zero
  mudança, só a casca visual dos cards/tabela.
- `CobModal` (modal de registrar pagamento aberto pelo clique na linha) — não tocado.
- As outras 8 abas (Clientes, Contratos, Financeiro, Carteira, Perdas & Recuperação,
  Promessas, Régua WPP, Simulador) — cada uma vira seu próprio sub-projeto depois,
  reaproveitando o `KpiCard` já existente (não precisa recriar) e o mesmo padrão de
  `<Table>` para as 14 outras ocorrências de `<table>` cru.
- `PUR` (roxo, usado no card "Elegíveis p/ ajuizamento") não faz parte da paleta v3
  formal (é cor de apoio, conforme já documentado no plano da Fase 1) — mantido como
  está, sem mudança de valor hex.

## Teste manual pós-implementação

Em produção, na aba Cobrança:
1. Grid de 4 KPIs clicáveis: clicar em cada um alterna o filtro da fila abaixo
   (comportamento idêntico a hoje); borda muda pra cor do card quando ativo.
2. Grid de 3 KPIs não-clicáveis: renderizam sem cursor de clique, sem quebrar layout.
3. Tabela desktop: header cinza mono uppercase (não mais verde), zebra visível,
   coluna "Cliente" e "Próxima Ação" continuam quebrando texto em 2 linhas quando
   necessário (não cortam/overflow).
4. Clicar numa linha da tabela abre `CobModal` igual a hoje.
5. Lista mobile: zebra visível, clique abre `CobModal` igual a hoje.
6. Claro e escuro — conferir contraste do header da tabela e do zebra em ambos os
   temas.
7. Sem erros de console.
