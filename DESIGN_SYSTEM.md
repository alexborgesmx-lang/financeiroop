# Borges Assessoria — Design System v3 (Rede Borges)

> **Referência canônica única.** Todo código de UI deve seguir este documento.
> Derivado do handoff **Rede Borges v3** (`Borges Assessoria/design_handoff_rede_borges/`) — paleta ivory/verde-floresta, serifa Newsreader para peças de destaque, elemento de assinatura "Linha de Confiança" — portado para os tokens já existentes do app (mesmos nomes de variável, valores atualizados) em 2026-07-15.
> **Lima canônica do sistema: `#A8E03F`** — fonte única; substitui `#A8E040` e `#9fe870` em todos os contextos.
> **Marca:** Borges Assessoria — *rede privada de crédito baseada em confiança.*

---

## 1. Paleta Canônica — Variáveis JavaScript

> Hierarquia de marca (três verdes, cada um com um papel inviolável):
> **Verde Borges `#0B3D2E`** = institucional (`GRN`) · **Verde-sinal `#127A57`** = dados/texto (`SIG`) · **Verde-limão `#A8E03F`** = ação/CTA (`ACC`).
> ⚠️ **No escuro, `GRN` deixa de ser lima e vira verde-menta (`#5AD09B`)** — antes disso, `GRN` e `ACC` eram idênticos no dark (bug latente, corrigido em 2026-07-15). Qualquer texto sobre fundo `GRN` sólido usa `ONBRAND`/`ONBRANDSOFT` — nunca branco fixo.

```javascript
// src/main.jsx — declaração no topo do arquivo
let BG, CARD, CARD2, BD, LINESOFT, TEXT, MUTED, FAINT,
    GRN, GRN2, SIG, SIGVIZ, OK, RED, BLU, YEL, PUR, ORG,
    ACC, ACCINK, ONBRAND, ONBRANDSOFT, SHD, SHDLG;

const LIGHT = {
  BG:   "#F7F5EF",   // ivory quente — fundo de página
  CARD: "#FFFDF9",   // surface — cards, modais, tabelas
  CARD2:"#F0EDE4",   // surface-2 — zebra de tabela, insets
  BD:   "#E2DDD1",   // bordas e divisores
  LINESOFT:"#EEEAE0",// divisores sutis
  TEXT: "#1A1712",   // ink — texto principal (15.6:1 AAA)
  MUTED:"#57514A",   // ink-soft — texto secundário (7.1:1 AAA)
  FAINT:"#7C756B",   // ink-faint — labels, captions (4.6:1 AA)
  GRN:  "#0B3D2E",   // brand — institucional, "em dia", tab ativa
  GRN2: "#0E5C44",   // brand-2 — faixas, hovers
  SIG:  "#127A57",   // signal — texto de dado/progresso (4.7:1 AA)
  SIGVIZ:"#1FB877",  // signal-viz — preenchimento de gráfico ≥24px (igual nos 2 temas)
  OK:   "#15805A",   // success — confirmações, delta positivo
  RED:  "#C0322F",   // error — erros, atrasos, destrutivo (5.1:1 AA)
  BLU:  "#166C70",   // info — informação, links (5.3:1 AA)
  YEL:  "#9A6510",   // warning — avisos, pendente (4.8:1 AA)
  PUR:  "#221d9a",   // Violet — status especiais (fora do sistema v3, mantido)
  ORG:  "#ff7700",   // Warm Orange — acento funcional (fora do sistema v3, mantido)
  ACC:  "#A8E03F",   // action — exclusivo para CTAs primários
  ACCINK:"#07241B",  // action-ink — texto sobre ACC, fixo nos 2 temas
  ONBRAND:"#EAF6EF",     // texto sobre fundo GRN sólido
  ONBRANDSOFT:"#8FE3C0", // texto secundário sobre fundo GRN sólido
  SHD:  "0 1px 2px rgba(40,30,15,.05),0 8px 22px rgba(40,30,15,.06)",   // cards
  SHDLG:"0 20px 52px rgba(11,61,46,.14),0 6px 16px rgba(11,61,46,.08)" // modais / hero
};

const DARK = {
  BG:   "#06231A",
  CARD: "#0B3227",
  CARD2:"#123B2E",
  BD:   "#1B4234",
  LINESOFT:"#153328",
  TEXT: "#EFF3EC",
  MUTED:"#AEBAB0",
  FAINT:"#7F8C82",
  GRN:  "#5AD09B",   // ⚠️ menta clara — NÃO é mais igual a ACC no dark
  GRN2: "#46CB92",
  SIG:  "#43D69C",
  SIGVIZ:"#1FB877",  // igual ao light
  OK:   "#5AD09B",
  RED:  "#F0716E",
  BLU:  "#5FC2C6",
  YEL:  "#E3A93A",
  PUR:  "#7b74e6",
  ORG:  "#ff7700",
  ACC:  "#A8E03F",   // igual ao light
  ACCINK:"#07241B",  // igual ao light
  ONBRAND:"#06231A",     // ink escuro — GRN no dark é claro, texto precisa ser escuro
  ONBRANDSOFT:"#0B3D2E",
  SHD:  "0 4px 12px rgba(0,0,0,0.20),0 2px 4px rgba(0,0,0,0.10)",
  SHDLG:"0 24px 60px rgba(0,0,0,0.40),0 8px 20px rgba(0,0,0,0.20)"
};
```

### Escalas de referência (tokens da marca)

```
/* Verdes */            /* Neutros (subtom ivory) */
g-100 #E6F8EF           n-0   #FFFDF9
g-200 #C2EFD8           n-50  #F7F5EF
g-300 #87DFB6           n-100 #F0EDE4
g-400 #46CB92           n-200 #E2DDD1
g-500 #1FB877 (SIGVIZ)  n-300 #C7C0B2
g-600 #11805E           n-400 #9B9384
g-700 #0E5C44 (GRN2)    n-500 #7C756B (FAINT)
g-800 #0B3D2E (GRN)     n-600 #57514A (MUTED)
g-900 #07241B (ACCINK)  n-700 #3A352E
                        n-800 #24201A
lima  #A8E03F (ACC)     n-900 #1A1712 (TEXT light)
```

> **Texto sobre `ACC` (lima) é sempre `ACCINK` (`#07241B`)** — contraste fixo, nunca branco, nos dois temas.
> **Texto sobre `GRN` sólido é sempre `ONBRAND`/`ONBRANDSOFT`** — nunca branco fixo (crítico no dark, onde `GRN` é claro).

---

## 2. Semântica de Cores — NUNCA desviar

| Variável | Papel v3 | Uso correto | Nunca usar para |
|---|---|---|---|
| `GRN` | `--brand` | Institucional, "em dia", tab ativa, hero/KPI do dia | Status de alerta, atraso |
| `GRN2` | `--brand-2` | Faixas, hovers sobre elementos de marca | Texto de corpo |
| `SIG` | `--signal` (texto) | Texto de dado/progresso, valores de destaque pequenos | Preenchimento de área/gráfico ≥24px (usar `SIGVIZ`) |
| `SIGVIZ` | `--signal-viz` | Preenchimento de barra/gráfico ≥24px | Texto pequeno |
| `OK` | `--success` | Delta positivo em texto pequeno (▲ 8,3%), confirmações | Áreas grandes / fundos |
| `RED` | `--error` | Erros, atrasos, ações destrutivas, "em atraso" | CTAs normais, informação |
| `BLU` | `--info` | Informação, links, badges informativos | Valores monetários |
| `YEL` | `--warning` | Avisos moderados, pendente, atenção | — |
| `ORG` | fora do v3 | Atraso/alerta, cobrança, reagendamento (mantido do sistema anterior) | Botões de ação primários |
| `PUR` | fora do v3 | Status especiais, renegociação, recuperação (mantido do sistema anterior) | — |
| `ACC` | `--action` | **Exclusivo** para CTAs primários (sempre pill `borderRadius:9999`) | Texto sobre fundo claro — usar `ACCINK` no texto |
| `CARD` | `--surface` | Cards, modais, tabelas | — |
| `CARD2` | `--surface-2` | Zebra de tabela, insets | Card principal |
| `MUTED` | `--ink-soft` | Texto secundário, subtítulos | Labels muito pequenos (usar `FAINT`) |
| `FAINT` | `--ink-faint` | Labels uppercase, captions, header de tabela | Texto de leitura corrida |
| `ONBRAND`/`ONBRANDSOFT` | `--on-brand`/`--on-brand-soft` | Texto sobre fundo `GRN` sólido | Texto sobre `CARD`/`BG` |

**Cores de serviços externos (hardcoded — não usar variável):**
- `#25D366` — WhatsApp verde
- `#6C3FC5` — ZapSign roxo
- `#B8860B` — Carnê PIX âmbar
- `ACCINK` (`#07241B`) — Texto em fundo `ACC`, contraste fixo, sempre

---

## 3. Filosofia Visual — "Padrão Premium"

> **O sistema deve ser limpo, organizado, hierárquico e bonito.**
> Cada tela deve parecer que foi desenhada com intenção — não montada. Referência de acabamento: Wise · Stripe · Mercury.
> Sensação-guia da marca: *"Essa empresa controla dinheiro de forma séria."*

### Os 4 Princípios

**1. Limpeza — "Menos é mais"**
- Cada tela tem **uma** hierarquia principal — o olho sabe onde ir primeiro
- Nenhum elemento decorativo sem função; sem bordas desnecessárias
- Fundo (`BG`) sempre neutro — a informação contrasta, não compete
- Máximo de **3 cores semânticas visíveis por tela** ao mesmo tempo

**2. Organização — "Tudo no lugar certo"**
- Hierarquia tipográfica rígida: título → subtítulo → label → valor → detalhe
- Cards agrupam informação relacionada — nunca misturar contextos no mesmo card
- Ações (botões) sempre no **rodapé** de modais ou **cabeçalho** de páginas
- Tabelas: cabeçalho `GRN+"10"` uniforme; linhas alternam `CARD`/`BG`; `RED+"05"` só para itens críticos

**3. Hierarquia — "O importante aparece primeiro"**

| Nível | Tamanho | Peso | Cor | Uso |
|---|---|---|---|---|
| H1 — título de aba | 22px (mob: 18px) | 800 | `TEXT` | Cabeçalho da aba |
| H2 — título de card/modal | 15–16px | 700 | `TEXT` | Cabeçalho de seção |
| H3 — subtítulo | 13px | 600 | `TEXT` | Rótulo de grupo |
| Label de campo | 11px uppercase | 700 | `MUTED` | Via `LS()` |
| Valor destaque (KPI principal) | 20–28px | 800–900 | semântico | Helvetica tabular |
| Valor secundário (KPI apoio) | 15–18px | 700 | semântico | Helvetica tabular |
| Corpo de tabela | 13px | 400–600 | `TEXT`/`MUTED` | — |
| Badge/tag | 10–11px | 700 | semântico | Status |

**4. Beleza — "Refinamento nos detalhes"**
- Sombras sutis: `SHD` nos cards — nunca sombras duras ou excessivas
- Espaçamento generoso: `gap` mínimo 14px entre cards, 24px entre seções
- Transições suaves: `transition:"background 0.15s"` em hovers, `"fadeUp"` em entradas de aba
- Gradiente verde do Dashboard é o único elemento "rico" permitido — demais seções são planas
- Frosted glass no hero: botões sobre gradiente usam `rgba(255,255,255,0.15)` — nunca cor sólida
- Tipografia como hierarquia: valores KPI grandes (22–28px, fontWeight 900) comunicam importância mais que cor

### Regras de Ouro (invioláveis)

1. **Nunca usar hex hardcoded** no JSX — sempre variável de tema. Exceções documentadas: `#25D366`, `#6C3FC5`, `#B8860B`, `#07241B`
2. **Cor semântica nunca muda de significado**: `GRN` = positivo, `RED` = negativo, `ORG` = alerta, `BLU` = informação neutra
3. **Um CTA por contexto**: nunca dois botões `ACC` no mesmo rodapé — o segundo é sempre ghost ou contextual
4. **Hierarquia de contraste**: texto mais importante tem maior peso e contraste; labels em `MUTED`
5. **Espaço em branco é conteúdo**: padding generoso não é desperdício — é o que faz o sistema parecer premium
6. **Três verdes, três papéis**: institucional (`GRN`), dados/sucesso (`SIG`/`OK`), ação (`ACC`) — nunca trocar os papéis

---

## 4. Tokens de Design

### Famílias tipográficas

> Neo-grotesca para UI e números; serifa **só** em peças de destaque; monoespaçado **só** para rótulos técnicos e códigos.

```javascript
const FONT = {
  sans:  `"Helvetica Neue", Helvetica, Arial, "Segoe UI", sans-serif`,  // UI, texto e NÚMEROS
  serif: `"Newsreader", Georgia, "Times New Roman", serif`,            // títulos de destaque, certificados, documentos
  mono:  `"IBM Plex Mono", ui-monospace, "SFMono-Regular", Menlo, monospace`, // rótulos técnicos, códigos
};
```

| Papel | Família | Observação |
|---|---|---|
| Interface e texto | `FONT.sans` | Pesos 400 / 600 / 700 / 800 |
| **Números financeiros** | `FONT.sans` + `fontVariantNumeric:"tabular-nums"` | Peso **700–900**. **NUNCA monoespaçado nem serifa** — usar Helvetica tabular (classe utilitária `.num` em `index.css`) |
| Títulos de destaque, certificados, documentos | `FONT.serif` (Newsreader) | Peso 400/500/600, uso pontual — não é a fonte de UI (classe `.serif`) |
| Rótulos uppercase / códigos | `FONT.mono` | PIX, HEX, IDs de transação, autenticação, labels `LS()` técnicas (classe `.mono`) |

> **Regra de números:** todo valor monetário, taxa, data ou contador usa `FONT.sans` com `tabular-nums` para alinhar colunas. O monoespaçado e a serifa nunca são usados em valor financeiro — mono é só código/ID, serifa é só título de destaque.

### Tipografia

| Uso | Tamanho | Peso | Cor |
|---|---|---|---|
| Body padrão | 14px | 400 | `TEXT` |
| Labels de campo via `LS()` | 11px uppercase | 700 | `MUTED` |
| Tabela `thead` (inline style, ad hoc — maioria das telas) | 11px uppercase | 700 | `GRN` + bg `GRN+"10"` |
| Tabela `thead` (componente `<Table>` de `components/ui/`, v3) | 11px uppercase, mono | 600 | `FAINT` + bg `CARD2` |
| Título de modal | 16–18px | 800 | `TEXT` |
| Subtítulo de modal | 12px | 400 | `MUTED` |
| Valor monetário destaque | 20–30px | 900 (tabular) | contextual |
| Badge de status | 10px | 700 | variável de cor |

> As duas convenções de tabela coexistem por ora — `<Table>` (v3, `FAINT`/`CARD2`) é o padrão para telas novas; as tabelas inline existentes (`GRN`/`GRN+"10"`) não são retrofitadas nesta fase.

### Espaçamento

| Elemento | Valor |
|---|---|
| Card padding (desktop) | 20–28px |
| Card padding (mobile) | 12–16px |
| Section gap (Dashboard) | 28px |
| Section gap (demais telas) | 24px |
| Gap entre campos de formulário | 12–16px |
| Modal footer padding | `14px 20px` |
| Mobile geral | `12px 10px` |

### Border Radius

| Elemento | Valor |
|---|---|
| Cards e modais | 16px |
| CTA primário (ACC pill) | 9999 |
| Ghost secundário ao lado de CTA | 9999 — pill para consistência visual |
| Botões secondary/destrutivos isolados | 8px |
| Botões cancelar/fechar | 8px |
| Inputs | 10px — via `IS()` |
| Badges e status tags | 9999 — pill |
| Botões micro de tabela | 5px |

### Sombras

Par de dois níveis (v3) — nunca um terceiro nível intermediário:

| Elemento | Valor |
|---|---|
| Cards | `SHD` (variável de tema — sutil) |
| Modais, hero/KPI do dia | `SHDLG` (variável de tema — mais profunda) |
| Overlay de modal | `rgba(0,0,0,0.55)` |
| Sidebar mobile | `0 0 40px rgba(0,0,0,0.18)` |
| Sidebar desktop | `2px 0 12px rgba(7,36,27,0.07)` |

> `src/index.css` — o reset global (`* { animation:none; transition:none }`) **não** zera `box-shadow`; corrigido em 2026-07-15 (zerava `SHD`/`SHDLG` mesmo com o inline style aplicado).

### Linha de Confiança

Elemento de assinatura da marca — nós ligados por um fio (a rede de indicações que sustenta a marca). É a marca *sem o logo*. Sempre fina, arejada, legível — nunca um ornamento denso.

```jsx
<LinhaConfianca w={188} h={20} n={6} sw={1.5} color="rgba(168,224,63,0.4)"/>
```

Componente local em `main.jsx` (perto do bloco de ícones), porta a lógica de `brand-v3.js`: `n` nós ao longo de uma senoide, ligados por um path cubic-bezier, cor via `currentColor`/prop `color`. Uso atual: cabeçalho da sidebar. Uso futuro (Fase 2): rodapé dos documentos (Comprovante, Extrato, Certificado), divisor de seção.

---

## 5. Sistema de Tema — Dark/Light

```javascript
applyTheme(dark)   // atualiza todas as variáveis + toggle class 'dark'/data-theme no <html>
IS()               // inline style padrão para inputs (usa cores do tema atual)
LS()               // inline style padrão para labels (usa cores do tema atual)

// Dark mode: ativa às 18h, desativa às 6h — automático por setTimeout
// Toggle manual é session-only (sem localStorage)
```

> **Regra crítica do dark mode:** `GRN` (`--brand`) no escuro é claro (verde-menta `#5AD09B`), não escuro. Qualquer texto/ícone posicionado sobre um fundo `GRN` sólido usa `ONBRAND`/`ONBRANDSOFT` — **nunca `"#fff"`/`"#FFF"` hardcoded**. Isso já causou headers de modal ilegíveis no dark antes da correção de 2026-07-15 (headers de "Registrar Pagamento", "Novo Contrato", "Contrato criado" etc.) — ao criar um novo header/banner com fundo `GRN`, sempre usar `ONBRAND` para o texto.

---

## 6. Motion & Interações

> **Princípio mestre**: motion comunica, não decora. Cada animação deve ter uma razão — mostrar origem, confirmar ação, indicar estado. Se a animação não ensina algo ao usuário, ela não existe.

### 6.1 Filosofia de Motion (nível premium)

| Princípio | Significado prático |
|---|---|
| **Purposeful** | Toda animação conta onde um elemento veio ou vai — nunca anima por estética |
| **Responsive** | Feedback de toque em ≤ 100ms — o usuário sente que o sistema ouviu |
| **Continuous** | Movimento nunca interrompe — uma ação completa antes da próxima começa |
| **Natural** | Física real: objetos desaceleram ao chegar (ease-out), aceleram ao sair (ease-in) |
| **Economical** | Máximo 2–3 animações simultâneas na tela — mais que isso é ruído |

---

### 6.2 Sistema de Timing

```javascript
// Referência global — usar estes valores em todos os transition/animation
const MOTION = {
  micro:  100,   // press, active states — imperceptível mas presente
  fast:   150,   // hover, focus, cor — rápido e limpo
  base:   250,   // entradas de componente — modal desktop, tab content
  modal:  300,   // bottom sheets mobile, sidebar — com spring
  slow:   350,   // page-level reveals — reservado
};
```

**Regra**: nunca ultrapassar 400ms em animações de UI. Acima disso o usuário percebe lentidão.

---

### 6.3 Curvas de Easing Canônicas

```css
/* Colar em :root no src/index.css */
:root {
  --ease-spring:   cubic-bezier(0.16, 1, 0.3, 1);      /* iOS spring — modais, sidebar, bottom sheets */
  --ease-bounce:   cubic-bezier(0.34, 1.56, 0.64, 1);  /* overshoot suave — CTA confirmado, badge novo */
  --ease-out:      cubic-bezier(0, 0, 0.2, 1);          /* decelera ao chegar — entradas de conteúdo */
  --ease-in:       cubic-bezier(0.4, 0, 1, 1);          /* acelera ao sair — dismissals, saídas */
  --ease-standard: cubic-bezier(0.25, 0.46, 0.45, 0.94);/* hover, cor, sombra — transições gerais */
}
```

**Guia rápido de uso:**
- Algo **entra** na tela → `--ease-spring` ou `--ease-out`
- Algo **sai** da tela → `--ease-in`
- **Hover / cor / sombra** → `--ease-standard`
- **Confirmação de ação positiva** → `--ease-bounce`

---

### 6.4 Keyframes CSS — `src/index.css`

> Todos os `@keyframes` ficam em `src/index.css`. O `animation` property vai inline no componente.

```css
/* ── Entradas ── */
@keyframes fadeUp {
  from { opacity: 0; transform: translateY(12px); }
  to   { opacity: 1; transform: translateY(0); }
}

@keyframes fadeIn {
  from { opacity: 0; }
  to   { opacity: 1; }
}

@keyframes scaleIn {
  from { opacity: 0; transform: scale(0.95); }
  to   { opacity: 1; transform: scale(1); }
}

@keyframes slideUp {
  from { opacity: 0; transform: translateY(100%); }
  to   { opacity: 1; transform: translateY(0); }
}

@keyframes slideDown {
  from { opacity: 0; transform: translateY(-10px); }
  to   { opacity: 1; transform: translateY(0); }
}

/* ── Loading ── */
@keyframes spin {
  from { transform: rotate(0deg); }
  to   { transform: rotate(360deg); }
}

@keyframes shimmer {
  from { background-position: -200% 0; }
  to   { background-position:  200% 0; }
}

@keyframes pulse {
  0%, 100% { opacity: 1; }
  50%       { opacity: 0.45; }
}

/* ── Feedback ── */
@keyframes shake {
  0%, 100% { transform: translateX(0); }
  20%, 60% { transform: translateX(-5px); }
  40%, 80% { transform: translateX(5px); }
}

/* ── Acessibilidade ── */
@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after {
    animation-duration:   0.01ms !important;
    transition-duration:  0.01ms !important;
    animation-iteration-count: 1 !important;
  }
}
```

---

### 6.5 Especificações por Componente

#### Modais e Overlays

```javascript
// Overlay (fundo escurecido)
overlay: {
  animation: "fadeIn 200ms var(--ease-out) forwards",
  background: "rgba(0,0,0,0.55)",
  backdropFilter: "blur(4px)",
  WebkitBackdropFilter: "blur(4px)",
}

// Modal desktop — aparece do centro
modalContent: {
  animation: "scaleIn 250ms var(--ease-spring) forwards",
  // transform-origin: center center (padrão)
}

// Bottom sheet mobile — sobe de baixo
bottomSheet: {
  animation: "slideUp 300ms var(--ease-spring) forwards",
  borderRadius: "24px 24px 0 0",
}

// Saída (aplicar na classe de exit antes de remover do DOM)
// overlay exit:  fadeIn reverse 200ms var(--ease-in)
// modal exit:    scaleIn reverse 200ms var(--ease-in)
// sheet exit:    slideUp reverse 250ms var(--ease-in)
```

---

#### Cards (contratos, KPIs, clientes)

```javascript
// Hover — levitar levemente
card: {
  transition: `transform 150ms var(--ease-standard), box-shadow 150ms var(--ease-standard)`,
}
cardHover: {
  transform: "translateY(-2px)",
  boxShadow: "0 8px 24px rgba(0,0,0,0.18)",   // dark
  // light: "0 8px 24px rgba(7,36,27,0.10)"
}

// Press / active
cardActive: {
  transform: "scale(0.98)",
  transition: "transform 100ms var(--ease-in)",
}

// Entrada de card (no carregamento inicial da tela)
// Usar stagger: cada card com delay += 60ms (max 5 cards — após isso sem delay)
cardEntrance: {
  animation: `fadeUp 250ms var(--ease-out) ${index * 60}ms forwards`,
  opacity: 0,   // estado inicial antes da animação
}
```

---

#### Botões

```javascript
// Todos os botões — base
btnBase: {
  transition: `background 150ms var(--ease-standard),
               transform  100ms var(--ease-standard),
               opacity    150ms var(--ease-standard),
               box-shadow 150ms var(--ease-standard)`,
  cursor: "pointer",
}

// Active (todos os tipos)
btnActive: { transform: "scale(0.97)" }

// CTA primário (ACC) hover
btnCTAHover: { filter: "brightness(1.08)" }   // lima fica ligeiramente mais viva

// Ghost hover
btnGhostHover: { background: `${BD}` }         // borda vira fundo sutil

// Destrutivo hover
btnDestructiveHover: { filter: "brightness(1.12)" }

// Loading state
btnLoading: {
  opacity: 0.75,
  cursor: "not-allowed",
  // spinner inline: animation: "spin 600ms linear infinite"
}

// Disabled
btnDisabled: {
  opacity: 0.5,
  cursor: "not-allowed",
  pointerEvents: "none",
}
```

---

#### Sidebar

```javascript
// Mobile — entra da esquerda
sidebarMobile: {
  animation: "none",   // usar transform diretamente via estado JS
  transform: open ? "translateX(0)" : "translateX(-100%)",
  transition: `transform 300ms var(--ease-spring)`,
  willChange: "transform",   // hint de GPU apenas aqui
}

// Overlay da sidebar mobile
sidebarOverlay: {
  animation: open ? "fadeIn 200ms var(--ease-out) forwards"
                  : "fadeIn 200ms var(--ease-in) reverse forwards",
}

// Desktop — sempre visível, sem animação de entrada
```

---

#### Navegação entre abas

```javascript
// Conteúdo da aba — entra com fadeUp
tabContent: {
  animation: "fadeUp 200ms var(--ease-out) forwards",
}

// Tab indicator (linha verde embaixo da tab ativa)
// Transição via CSS — não JS
tabIndicator: {
  transition: `left 200ms var(--ease-out), width 200ms var(--ease-out)`,
}
```

---

#### Inputs e formulários

```javascript
// Focus — borda verde acende suavemente
inputBase: {
  transition: `border-color 150ms var(--ease-standard),
               box-shadow   150ms var(--ease-standard)`,
}
inputFocus: {
  borderColor: ACC,
  boxShadow: `0 0 0 3px ${ACC}20`,   // halo lima sutil
}

// Erro — shake após submit inválido
inputError: {
  animation: "shake 300ms var(--ease-standard)",
  borderColor: RED,
}
```

---

#### Tabelas

```javascript
// Row hover — instantâneo quase (100ms)
tableRow: {
  transition: "background 100ms var(--ease-standard)",
}
tableRowHover: {
  background: `${GRN}08`,   // tint verde ultra-sutil
}

// Entrada das linhas no carregamento (stagger leve)
// Aplicar apenas nas primeiras 6 linhas visíveis
tableRowEntrance: {
  animation: `fadeIn 200ms var(--ease-out) ${Math.min(index,5) * 40}ms forwards`,
  opacity: 0,
}
```

---

#### KPIs — Entrada de tela

```javascript
// Cards de KPI entram em cascata
// index = posição do card no grid (0, 1, 2, 3...)
kpiCard: {
  animation: `fadeUp 250ms var(--ease-out) ${index * 60}ms forwards`,
  opacity: 0,
}

// Valores numéricos — SEM counter animation
// Razão: fintech exige exatidão percebida. Counter obscurece o valor real por 300ms+.
// A chegada do card via fadeUp já comunica "novo dado".
```

---

#### Notificações / Toast

```javascript
// Entrada — cai de cima
toast: {
  animation: "slideDown 250ms var(--ease-spring) forwards",
  position: "fixed",
  top: 20, right: 20,
  zIndex: 9999,
}

// Saída — desvanece (após 4s)
toastExit: {
  animation: "fadeIn 200ms var(--ease-in) reverse forwards",
}
```

---

#### Loading States

```javascript
// Skeleton — shimmer horizontal
skeleton: {
  background: `linear-gradient(90deg, ${BD} 25%, ${CARD} 50%, ${BD} 75%)`,
  backgroundSize: "200% 100%",
  animation: "shimmer 1.5s linear infinite",
  borderRadius: 8,
}

// Spinner inline (dentro de botão)
spinner: {
  width: 16, height: 16,
  border: `2px solid ${ACC}30`,
  borderTop: `2px solid ${ACC}`,
  borderRadius: "50%",
  animation: "spin 600ms linear infinite",
  display: "inline-block",
}

// Pulse (texto de loading)
pulseText: {
  animation: "pulse 1.5s var(--ease-standard) infinite",
}
```

---

#### Glassmorphism — Hero card e Bottom Sheets

```javascript
// Botões de ação sobre o hero gradient
glassButton: {
  background: "rgba(255,255,255,0.10)",
  backdropFilter: "blur(12px)",
  WebkitBackdropFilter: "blur(12px)",       // Safari obrigatório
  border: "1px solid rgba(255,255,255,0.18)",
  transition: `background 150ms var(--ease-standard),
               border-color 150ms var(--ease-standard)`,
}
glassButtonHover: {
  background: "rgba(255,255,255,0.16)",
  borderColor: "rgba(255,255,255,0.28)",
}

// Handle do bottom sheet
bottomSheetHandle: {
  width: 36, height: 4,
  background: "rgba(168,224,63,0.25)",   // lima sutil
  borderRadius: 2,
  margin: "0 auto 20px",
}
```

---

### 6.6 Regras de Implementação de Motion

1. **GPU first** — animar apenas `transform` e `opacity`. Nunca `width`, `height`, `top`, `left`, `margin`, `padding`
2. **`will-change` com parcimônia** — usar só em sidebar mobile e modais, nunca em cards de lista
3. **`transition` inline, `@keyframes` no CSS** — `transition` vai no style object do componente; keyframes nomeados vão em `src/index.css`
4. **`-webkit-backdrop-filter`** — sempre junto com `backdrop-filter` (Safari exige o prefixo)
5. **Stagger máximo de 5 itens** — para listas com mais de 5 itens, animar só os 5 primeiros; o resto aparece junto
6. **Saídas com reverse** — para exit animations, usar `animation-direction: reverse` ou duplicar o keyframe invertido; não remover o DOM imediatamente
7. **Infinite loops** — exclusivos para: `spin` (loading), `shimmer` (skeleton), `pulse` (texto aguardando). Nunca para decoração

---

### 6.7 Regras de Ouro de Motion (invioláveis)

1. **Entrada ease-out, saída ease-in** — nunca linear em UI
2. **< 100ms para toque** — o usuário deve sentir resposta antes de piscar
3. **< 300ms para modais** — acima disso parece lento
4. **Nunca animar cor e transform simultaneamente em tabelas** — lagga em mobile
5. **Glass sempre com -webkit-backdrop-filter** — sem isso quebra em Safari (iOS)
6. **prefers-reduced-motion é obrigatório** — o reset em `index.css` já cobre, não remover
7. **Counter animation proibida em valores financeiros** — exatidão > efeito

---

## 7. Gradientes

> Stops derivados da escala de verdes da marca (lima → sinal → floresta → verde-900).

### Hero Card — Dashboard

```javascript
// Versão performática — USAR ESTA
background: "linear-gradient(145deg, #A8E03F 0%, #11805E 38%, #0B3D2E 68%, #07241B 100%)"
```

### Cards de Contrato (por status)

```javascript
// Ativo (brand completo: lima → floresta)
background: "linear-gradient(135deg, #A8E03F 0%, #0B3D2E 100%)"

// Em dia / bom pagador (verde-sinal → verde-900)
background: "linear-gradient(135deg, #11805E 0%, #07241B 100%)"

// Em atraso (vermelho — status crítico, não brand)
background: "linear-gradient(135deg, #D64545 0%, #7B1010 100%)"

// Quitado / encerrado (neutro esverdeado)
background: "linear-gradient(135deg, #353D3A 0%, #1F2624 100%)"

// Renegociado (âmbar)
background: "linear-gradient(135deg, #A07820 0%, #604A10 100%)"
```

### Seções com tint verde (atenção positiva)

```javascript
background: "linear-gradient(180deg, rgba(168,224,63,0.06) 0%, transparent 100%)"
```

---

## 8. Inventário de Botões — 7 Tipos

> Para transições de hover/active em cada tipo, consultar **Seção 6.5 — Botões**.

### Tipo 1 — CTA Primário (ACC)
> Ação principal que completa um fluxo. **Sempre pill 9999.**

```javascript
{
  background: ACC,
  color: "#07241B",       // texto sempre verde-900 sobre lima
  borderRadius: 9999,
  padding: "13px 16px",
  border: "none",
  fontWeight: 800,
  fontSize: 14,
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  gap: 7,
  cursor: "pointer",
  opacity: disabled ? 0.6 : 1
}
```

Instâncias obrigatórias: ContratoModal "✓ Registrar Pagamento", "Enviar Comprovante" (quitado), CobrancaModal "Confirmar Pagamento", QuitacaoAntecipadaModal "Confirmar Quitação", ModalAcordoPerda "Confirmar Acordo", RecuperacaoModal "Confirmar Recuperação", PagamentoParcelaModal "Confirmar", PagamentoDrop "Confirmar", NovaPromessaModal "Registrar Promessa", ClienteModal "Salvar e Ativar Cliente", ClienteModal header "Novo Contrato" (`padding:"7px 13px"` compacto), NovoContrato "Gerar Contrato".

---

### Tipo 2 — WhatsApp (ação principal)
> Quando enviar pelo WhatsApp É a ação principal. **Sempre `#25D366`.**

```javascript
{
  background: "#25D366",
  color: "#FFF",
  borderRadius: 9999,
  padding: "12px 16px",
  border: "none",
  fontWeight: 800,
  fontSize: 13,
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  gap: 7,
  cursor: "pointer"
}
```

Instâncias: ComprovanteEnvioModal "Enviar pelo WhatsApp", PagamentoDetalheModal "Enviar pelo WhatsApp", NovoContrato "Enviar boas-vindas WA", NovoContrato "Enviar assinatura WA".

---

### Tipo 3 — Ghost Secundário (ao lado de CTA)
> Ação de suporte ao fluxo. Pill quando agrupado com CTA primário.

```javascript
{
  background: CARD,
  color: TEXT,
  borderRadius: 9999,       // pill quando ao lado de CTA
  padding: "12px 16px",
  border: `1.5px solid ${BD}`,
  fontWeight: 600,
  fontSize: 14,
  cursor: "pointer"
}
```

> **Regra WhatsApp no ContratoModal**: quando aparece junto com "Registrar Pagamento" é ghost (branco) — ação secundária. Verde (`#25D366`) só quando WA é a ação principal (Tipo 2).

Instâncias: ContratoModal "PIX" e "WhatsApp" (footer ao lado de pagar), ClienteModal "Abrir →" (lista de contratos).

---

### Tipo 4 — Destrutivo (RED)
> Ações irreversíveis com consequência negativa. **NÃO é pill** — distinção visual intencional.

```javascript
{
  background: RED,
  color: "#FFF",
  borderRadius: 8,
  padding: "12px 16px",
  border: "none",
  fontWeight: 700,
  cursor: "pointer"
}
```

Instância: BaixaModal "Confirmar Baixa".

---

### Tipo 5 — Contextual Colorido (Warning/Info)
> Ações de segundo plano com cor semântica. Usa tint como fundo.

```javascript
{
  background: `${COR}08`,
  color: COR,
  borderRadius: 9,
  padding: "13px 16px",
  border: `1px solid ${COR}40`,
  fontWeight: 700,
  fontSize: 13,
  display: "flex",
  alignItems: "center",
  gap: 8,
  cursor: "pointer"
}
```

Mapeamento de `COR`:
- `ORG` — Registrar Promessa (reagendar), reagendar em cobrança
- `RED` — Baixar como Prejuízo (PerdaAcoesModal), Reabrir parcela
- `PUR` — Registrar Recuperação (PerdaAcoesModal)
- `ORG` — Registrar Acordo (PerdaAcoesModal)

---

### Tipo 6 — Cancelar / Fechar / Voltar
> Saída do fluxo sem consequências.

```javascript
{
  background: CARD,
  color: MUTED,
  borderRadius: 8,
  padding: "10px 14px",
  border: `1px solid ${BD}`,
  fontWeight: 600,
  cursor: "pointer"
}
```

Instâncias: Cancelar, Fechar, Voltar — em todos os modais.

---

### Tipo 7 — Micro (Tabela)
> Botões compactos dentro de linhas de tabela.

```javascript
// Pagar:
{ padding:"3px 7px", borderRadius:5, border:"none", background:`${GRN}18`, color:GRN, fontWeight:700, fontSize:10 }

// Reagendar:
{ padding:"3px 7px", borderRadius:5, border:"none", background:`${ORG}18`, color:ORG, fontWeight:700, fontSize:10 }
```

---

## 9. Mapeamento Modal → Botão

| Modal | Botão | Tipo |
|---|---|---|
| **ContratoModal** | ✓ Registrar Pagamento | 1 — CTA ACC pill |
| | PIX | 3 — Ghost pill |
| | WhatsApp | 3 — Ghost pill (NÃO verde) |
| | Enviar Comprovante (quitado) | 1 — CTA ACC pill |
| | Alt. Vcto / Quitar (secondary bar) | Ghost compact |
| | Baixar (secondary bar) | RED outline compact |
| | Pagar (tabela) | 7 — Micro GRN |
| | Reagendar (tabela) | 7 — Micro ORG |
| **CobrancaModal** | Confirmar Pagamento | 1 — CTA ACC pill |
| | Reagendar | 5 — ORG contextual |
| | Registrar Promessa (modo agenda) | 5 — ORG contextual |
| | Voltar / Outra parcela | 6 — Cancelar |
| **ClienteModal** | Novo Contrato (header) | 1 — CTA ACC compacto |
| | Salvar e Ativar Cliente | 1 — CTA ACC pill |
| | Abrir → (contratos) | 3 — Ghost |
| **QuitacaoAntecipadaModal** | Confirmar Quitação | 1 — CTA ACC pill |
| | Cancelar | 6 — Cancelar |
| **BaixaModal** | Confirmar Baixa | 4 — Destrutivo RED |
| | Cancelar | 6 — Cancelar |
| **RecuperacaoModal** | Confirmar Recuperação | 1 — CTA ACC pill |
| | Cancelar | 6 — Cancelar |
| **ModalAcordoPerda** | Confirmar Acordo | 1 — CTA ACC pill |
| | Cancelar | 6 — Cancelar |
| **PerdaAcoesModal** | Baixar como Prejuízo | 5 — RED contextual |
| | Registrar Acordo | 5 — ORG contextual |
| | Registrar Recuperação | 5 — PUR contextual |
| | Fechar | 6 — Cancelar |
| **ComprovanteEnvioModal** | Enviar pelo WhatsApp | 2 — WA verde |
| | Salvar PDF | 3 — Ghost |
| | Fechar | 6 — Cancelar |
| **PagamentoDetalheModal** | Enviar pelo WhatsApp | 2 — WA verde |
| | Reabrir | 5 — RED contextual |
| **NovoContrato (success)** | Abrir no Google Docs | Serviço externo (TEXT bg) |
| | Enviar para ZapSign | `#6C3FC5` |
| | Gerar Carnê PIX | `#B8860B` |
| | Enviar boas-vindas WA | 2 — WA verde |
| | Fechar | 6 — Cancelar |
| **PagamentoDrop** | Confirmar | 1 — CTA ACC pill |
| **PagamentoParcelaModal** | Confirmar | 1 — CTA ACC pill |
| | Reagendar | 5 — ORG contextual |
| | Registrar Promessa | 1 — CTA ACC pill |
| | Cancelar / Voltar | 6 — Cancelar |

**Regra de propagação**: mudança em qualquer botão afeta TODAS as instâncias do mesmo Tipo.

---

## 10. Cores de Gráficos e Valores Monetários

### Gráficos (Recharts)

| Dado | Cor | Justificativa |
|---|---|---|
| Receita / recebimentos / pagamentos | `SIG` | Verde-sinal — valor positivo da marca, brilho ideal para gráfico |
| Previsto / meta (linha de apoio) | `g-200 #C2EFD8` | Verde claro, secundário ao recebido |
| Extra por atraso / alertas secundários | `ORG` | Dado de alerta, não primário |
| Prejuízo / inadimplência | `RED` | Negativo |
| Dados informativos neutros | `BLU` | Apenas sem semântica positiva/negativa |
| Recuperação / especial | `PUR` | — |

> `SIG` (não `GRN`) é o verde de receita em gráficos — mais legível que o floresta institucional.
> `BLU` nunca representa receita — rompe a identidade verde da marca.

### Semântica de Valores Monetários (tabelas e cards)

| Tipo de valor | Cor | Exemplo |
|---|---|---|
| Receita / pago / positivo (destaque) | `GRN` | Valor Pago, Receita Total, Lucro |
| Delta / variação positiva (texto pequeno) | `OK` | ▲ 8,3%, +R$ 1.2k |
| Em atraso / negativo | `RED` | Valor em atraso, saldo devedor vencido |
| Alerta moderado / extra | `ORG` | Receita extra por atraso, diferença |
| Valor prometido (futuro) | `GRN` | Valor em Promessas |
| Valor neutro / informativo | `TEXT` ou `MUTED` | Valor original da parcela, datas |
| Capital emprestado / principal | `TEXT` | VALOR_PRINCIPAL |

> Todo valor usa `FONT.sans` + `tabular-nums`, peso 700–900. **Nunca monoespaçado.**
> `BLU` não para valores monetários em tabelas — `BLU` = informação/link, não dinheiro.

---

## 11. Regras de Implementação

### Arquitetura de estilos híbrida

- `src/main.jsx`: **inline styles** com variáveis de tema — para toda lógica e views específicas do negócio
- `src/components/ui/`: componentes **shadcn** com Tailwind classes — para componentes UI reutilizáveis (Button, Card, Dialog, Select, etc.)

### Quando usar cada abordagem

| Situação | Abordagem |
|---|---|
| Novo componente UI reutilizável | shadcn — `<Card>`, `<Button>`, `<Table>`, `<Input>`, `<Badge>` |
| Cores semânticas dinâmicas (GRN, SIG, RED, YEL…) | Inline styles — variáveis JS |
| Gradientes, sombras `SHD` | Inline styles |
| Layout: flex/grid, gap | Tailwind (`flex`, `grid`, `gap-*`) |
| Texto fixo: tamanho, peso | Tailwind (`text-xs`, `font-bold`) |
| View específica de negócio | Inline styles |

### Padrão de botões de filtro (Tab Filters)

```javascript
// Ativo:
{ background: `${COR}08`, color: COR, border: `1px solid ${COR}40`, borderRadius: 9 }

// Inativo:
{ background: CARD, color: MUTED, border: `1px solid ${BD}`, borderRadius: 9 }
```

### Banner de destaque (Hero de KPI)

```jsx
<div style={{
  background: CARD,
  borderRadius: 16,
  padding: "18px 24px",
  border: `1px solid ${BD}`,
  borderLeft: `3px solid ${GRN}`,
  boxShadow: SHD
}}>
  <p style={{color:MUTED, fontSize:10, fontWeight:700, textTransform:"uppercase", letterSpacing:"0.7px"}}>
    LABEL DA MÉTRICA
  </p>
  <p style={{color:GRN, fontSize:28, fontWeight:800, fontVariantNumeric:"tabular-nums"}}>
    {valor}
  </p>
</div>
```

| Aba | Métrica do banner | Cor |
|---|---|---|
| Dashboard | Banner gradient verde (já existente) | — |
| Financeiro | Lucro do Período | `GRN` |
| Perdas & Recup. | Capital em Risco | `ORG` |
| Cobrança | Cabeçalho da tabela | `RED` |

---

## 12. RGB para jsPDF

> jsPDF exige arrays RGB — não aceita variáveis CSS. Valores derivados da paleta da marca.

```javascript
// Comprovantes de pagamento e quitação antecipada:
const G=[11,61,46], SIG=[31,184,119], GL=[110,121,117], DK=[18,24,21], MT=[110,121,117], BDC=[221,227,224];
// lima (carimbos/realces): LM=[168,224,63]; texto sobre lima: LMK=[7,36,27]

// Relatório financeiro:
const NAV=[7,36,27], G=[11,61,46], SIG=[31,184,119], B=[23,108,112], O=[255,119,0], R=[192,50,47], P=[34,29,154];
const DK=[18,24,21], MUT=[110,121,117], BDC=[221,227,224], LGR=[247,249,248], WH=[255,255,255];
```

---

## 13. Padrões de UX — Convenções Estabelecidas

Regras consolidadas após audit completo. Não regredir:

- **Sem informação duplicada na mesma tela** — se um valor já aparece em card/KPI, não repetir em outro elemento
- **Badges de score**: formato `"X · Faixa"` (ex: "68 · Médio") — nunca abreviação redundante
- **Subtítulos de tela** devem conter informação única — não repetir o que os cards já mostram
- **Grids de KPIs**: `repeat(N,1fr)` fixo — evita cards órfãos em linhas separadas quando N é conhecido
- **Siglas técnicas** (LTV, ROI) devem ter nome completo no label ou subtítulo explicativo
- **Cobrança**: sidebar badge = `parcelasAtrasadas.length` (parcelas); subtítulo = `cobItems.length` (clientes), com contexto: "X clientes · Y parcelas"
- **Financeiro**: `finDe`/`finAte` iniciam com `mesAtualRange()` — sempre abrir no mês atual
- **Nomes de colunas** refletem exatamente o que mostram (coluna com data = "Data", não "Empréstimo")
- **Grids de KPIs**: usar `repeat(N,1fr)` fixo, não `auto-fit`

---

## 14. Checklist de Qualidade Visual

Antes de qualquer entrega de UI, verificar:

- [ ] Nenhum hex hardcoded no JSX além das exceções documentadas (`#25D366`, `#6C3FC5`, `#B8860B`, `#07241B`)
- [ ] `ACC` = `#A8E03F` em todos os CTAs primários
- [ ] Texto sobre `ACC` sempre `"#07241B"` — nunca branco
- [ ] Três verdes nos papéis certos: `GRN` institucional, `SIG`/`OK` dados/sucesso, `ACC` ação
- [ ] `GRN` nunca invertido: positivo = GRN/SIG, negativo = RED
- [ ] Números em **Helvetica tabular** (`FONT.sans` + `tabular-nums`), peso 700–900 — **nunca monoespaçado**
- [ ] Monoespaçado (`FONT.mono`) só em códigos/IDs (PIX, HEX, autenticação)
- [ ] Valores monetários: `fontWeight:900`, `letterSpacing:"-0.03em"`, fontSize mínimo 20px para destaque
- [ ] Botão CTA primário: `ACC` pill `9999` + texto `#07241B`
- [ ] Status pills: `background:rgba(cor,0.10)`, não sólido
- [ ] Cards de contrato com gradiente — não fundo sólido
- [ ] Tab ativa: `GRN` (dark: lima, light: floresta)
- [ ] Input em foco: border `ACC`
- [ ] Um CTA ACC por contexto de ação
- [ ] Máximo 3 cores semânticas visíveis por tela
- [ ] `BLU` nunca em valores monetários ou gráficos de receita; receita em gráfico = `SIG`
- [ ] Mobile: padding `12px 10px`, fontes menores proporcionais

**Motion:**
- [ ] `transition` usa variáveis `--ease-*` canônicas (não `ease` genérico)
- [ ] `@keyframes` definidos em `src/index.css`, não inline
- [ ] Apenas `transform` e `opacity` sendo animados (nunca `width`/`height`/`top`)
- [ ] `-webkit-backdrop-filter` presente junto com `backdrop-filter`
- [ ] Stagger limitado a 5 itens em listas
- [ ] `@media (prefers-reduced-motion)` não foi removido do `index.css`
- [ ] Nenhuma animação `infinite` decorativa (só loading/skeleton/spinner)
- [ ] Duração de modal ≤ 300ms, hover ≤ 150ms, press ≤ 100ms

---

## 15. Logomarca

> Símbolo: dois módulos arredondados sobrepostos (estrutura · sistema · conexão de operações). Sem moedas, cifrão, casas ou apertos de mão.

### Construção (SVG inline — viewBox 0 0 68 68)

```html
<!-- Símbolo principal (sobre claro) -->
<svg viewBox="0 0 68 68">
  <rect x="3"  y="3"  width="40" height="40" rx="9" fill="#1FB877"/>  <!-- módulo SIG -->
  <rect x="25" y="25" width="40" height="40" rx="9" fill="#0B3D2E"/>  <!-- módulo GRN -->
  <path d="M25 25 H43 V43 H25 Z" fill="#07241B"/>                     <!-- interseção g-900 -->
</svg>
```

### Versões oficiais

| Versão | Módulo SIG | Módulo GRN | Interseção | Fundo |
|---|---|---|---|---|
| Principal (claro) | `#1FB877` | `#0B3D2E` | `#07241B` | claro |
| Dark mode | `#1FB877` | `#FFFFFF` | `#0E5C44` | `#07241B` |
| Monocromático | `#121815` | `#121815` | `#FFFFFF` (vazado) | qualquer |
| Sobre lima | `#FFFFFF` | `#07241B` | `#0B3D2E` | `#A8E03F` |

### Lockup horizontal

- Símbolo + nome em duas linhas: **"Borges"** (peso 700) sobre **"Assessoria"** (peso 400, cor `MUTED`/`#4E5854`).
- Família: Helvetica Neue. Gap símbolo↔texto = altura de ½ módulo.

### Regras de uso

- **Área de respiro** mínima = altura de 1 módulo (x) em todos os lados.
- **Escala mínima**: símbolo legível até **16px** (favicon); lockup até 120px de largura.
- **Nunca**: distorcer, girar, aplicar sombra, recolorir fora da paleta, ou colocar sobre fundo de baixo contraste.
- **Arquivos HD**: `assets/borges-simbolo.png` (1024²), `borges-simbolo-verde.png`, `borges-favicon-256.png`, `borges-logo-horizontal.png` (2600×820), `borges-logo-horizontal-branco.png`.

---

## 16. Documentos — Princípios comuns

Comprovantes, recibos e contratos compartilham um sistema de timbre:

- **Largura de tela**: recibo compacto = 440px; documento A4 = 794px (`min-height` 1080–1123px).
- **Cabeçalho**: símbolo + "Borges Assessoria" + descritor `mono` "Infraestrutura de crédito privado"; dados do CNPJ/endereço à direita (10–11px `MUTED`).
- **Régua do cabeçalho**: 2px com 64px iniciais em `GRN` e o resto em `BD` (`linear-gradient(90deg, GRN 0 64px, BD 64px)`).
- **Números**: `FONT.sans` + `tabular-nums`, peso 600–900. Códigos/IDs/PIX em `FONT.mono`.
- **Rodapé**: CNPJ · domínio · e-mail (10–11px `MUTED`) + paginação `mono` à direita.
- **Print**: `@page { size:A4; margin:0 }`, `-webkit-print-color-adjust:exact`. Botões/toolbars com `@media print { display:none }`.
- **jsPDF**: usar arrays RGB da **Seção 12** — `G=[11,61,46]`, `SIG=[31,184,119]`, lima `LM=[168,224,63]`, texto-sobre-lima `LMK=[7,36,27]`, `MT=[110,121,117]`, `BDC=[221,227,224]`, `LGR=[247,249,248]`.

---

## 17. Comprovante de Pagamento (parcela)

> Recibo compacto (440px) enviado ao cliente a cada parcela paga. Arquivo de referência: `Comprovante de Pagamento.html`.

**Estrutura (topo → base):**
1. **Header** `GRN`/`#07241B` (verde-900): símbolo dark + "Comprovante de pagamento".
2. **Selo de confirmação**: círculo `g-100 #E6F8EF` com check em `OK #15A06A`.
3. **Valor em destaque**: `R$ 1.250,00` — `num`, 40px, peso 700; abaixo "Parcela 06 de 12" em `g-700`.
4. **Linhas de detalhe** (label `MUTED` à esquerda, valor peso 500 à direita): Cliente, CPF, Contrato, Forma de pagamento (PIX), Pago em, Vencimento original, Saldo devedor após, ID da transação (`mono`).
5. **Rodapé** `n-50`: CNPJ, domínio, autenticação `mono` + aviso "não constitui documento fiscal".

```javascript
// tokens-chave
header:  { background: GRN, color: "#fff" }          // light → usar #07241B fixo
check:   { background: "#E6F8EF", icon: "#15A06A" }   // OK
valor:   { className: "num", fontSize: 40, fontWeight: 700 }
row:     { label: MUTED, value: { fontWeight: 500 } }
```

---

## 18. Comprovante de Quitação (contrato)

> Certificado A4 (794px) emitido ao quitar integralmente um contrato. Arquivo: `Comprovante de Quitação.html`.

**Estrutura:**
1. **Letterhead**: símbolo principal + "Borges Assessoria" + descritor; bloco CNPJ/endereço à direita; borda inferior 2px `GRN`.
2. **Selo "QUITAÇÃO TOTAL"**: círculo Ø150px, borda 3px `g-600 #11805E`, texto `g-700`, rotação `-11deg`, `opacity:.92`, com micro-rótulo `mono` "NADA CONSTA".
3. **Título**: kicker `mono` `g-700` + H1 "Contrato integralmente quitado".
4. **Parágrafo declaratório** (`ink-soft`), com "integralmente quitado" em `g-700`.
5. **Box-resumo** `g-100`/borda `g-200`: Cliente+CPF, Contrato, Valor principal, Total pago, Parcelas (12/12), Período, Data da quitação — valores `num` peso 600.
6. **Assinatura**: QR `mono` de autenticação à esquerda + linha de assinatura "Borges Assessoria · Assinado digitalmente" à direita.

```javascript
selo:   { border: `3px solid #11805E`, color: "#0E5C44", transform: "rotate(-11deg)" }
box:    { background: "#E6F8EF", border: `1px solid #C2EFD8` }   // g-100 / g-200
destaque: { color: "#0E5C44" }                                   // g-700
```

---

## 19. Timbre de Contrato (PDF)

> Página A4 (794px) com cabeçalho/rodapé de marca + marca d'água, para cédulas e contratos. Arquivo: `Timbre de Contrato.html`.

**Elementos do timbre:**
- **Cabeçalho**: símbolo principal + "Borges Assessoria" + descritor `mono` `g-700`; CNPJ/endereço/contato à direita (`MUTED`). Régua 2px `GRN→BD`.
- **Marca d'água**: símbolo central, `width:380px`, `opacity:.035`, ambos os módulos em `GRN` (`pointer-events:none`).
- **Corpo de exemplo** (substituível): título centralizado, grid 2-col `g-100` com partes (Credor/Devedor/Emissão/Praça), cláusulas com rótulo `cl` peso 700.
- **Rodapé**: domínio/e-mail à esquerda + "Página X de Y · CON-AAAA-NNNN" (`num`) à direita; régua superior 1px `BD`.

```javascript
watermark: { width: 380, opacity: 0.035, fill: GRN }
ruleTop:   "linear-gradient(90deg, #0B3D2E 0 64px, #DDE3E0 64px)"   // GRN → BD
clausula:  { label: { fontWeight: 700, color: TEXT }, body: { color: MUTED, lineHeight: 1.85 } }
```

---

## 20. Extrato do Contrato (PDF)

> Documento A4 gerado via jsPDF (`gerarExtratoPDF`, `src/main.jsx`) com a posição completa de um contrato — do dia da criação até o encerramento. Substitui/complementa o Comprovante de Quitação (§18) quando o contrato não foi resolvido por quitação simples (em atraso, acordo assistido, ou qualquer fase de recuperação judicial). Implementado 2026-07-04.

**Estrutura:**
1. **Cabeçalho de marca** — via `_pdfBrandHeader` (símbolo, "BORGES ASSESSORIA", descritor, dados da empresa à direita, régua bicolor 2px `GRN`+`BDC`), igual ao padrão de §16.
2. **Banner de status** (pill `roundedRect` full-width, 11mm altura) — cor e texto variam pelo estado do contrato:
   - Quitado → `SIG` verde, "CONTRATO QUITADO"
   - Parcelas em atraso → `RL` vermelho claro, "PARCELAS EM ATRASO — N parc. · Maior atraso: X dias"
   - Acordo Assistido → `BLL` azul claro, "CONTRATO EM ACORDO ASSISTIDO"
   - Em Processo Judicial → `RL` vermelho claro, "CONTRATO EM PROCESSO JUDICIAL"
   - Encerrado Judicialmente + `SITUACAO_FINANCEIRA_JUDICIAL`: `QUITADO_JUDICIALMENTE` → verde; `RECUPERADO_PARCIAL` → âmbar `#E0A030`/`#FDF0D6`; `PERDA_JUDICIAL_DEFINITIVA` → vermelho
   - **Nunca usar glifos Unicode fora de WinAnsi no texto do banner** (ex: `✓`, `⚠`) — o Helvetica padrão do jsPDF não renderiza esses caracteres e produz símbolos quebrados (`'`, `&`). Usar texto puro.
3. **Dados do Cliente / Dados do Contrato** — 2 caixas lado a lado, fundo `LGR`, borda `BDC`, radius 2. Telefone sempre formatado via `fmtTel` (nunca `String(v)` cru).
4. **Dados do Processo Judicial** (condicional — contrato já ajuizado em algum momento) — caixa full-width, borda `RC` vermelha: Nº Processo (CNJ), Vara/Comarca, Data Ajuizamento, Valor Executado, Status Processual, Data Arquivamento.
5. **Resumo do Contrato** — 6 KPIs em grid 3-col (parcelas totais/pagas/abertas/atraso/próx. vencimento/maior atraso) + nota itálica quando encerrado judicialmente ("parcelas originais substituídas/renegociadas").
6. **Situação Financeira** — principal/juros contratado vs. recuperado vs. pendente, total recebido, saldo devedor.
7. **Recuperação Judicial** (condicional) — valor executado, principal e lucro recuperados judicialmente (campos `VALOR_RECUPERADO_JUDICIAL_PRINCIPAL`/`_LUCRO`), honorários e custas com indicação de quem pagou, prejuízo remanescente, e badge de "Situação Financeira Final".
8. **Percurso do Contrato** — tabela cronológica (mais antigo → mais recente) mesclando eventos financeiros (criação, pagamentos) com a jornada judicial (`EVENTOS` do tipo `AJUIZAMENTO`, `MOVIMENTACAO_JURIDICA`, `ACORDO_JUDICIAL_FIRMADO`, `QUITACAO_JUDICIAL`, `ARQUIVAMENTO_PROCESSO`). Coluna "Detalhe" trunca com reticências (`…`) via `doc.getTextWidth`, nunca corta a frase sem indicação.
9. **Histórico de Pagamentos / Parcelas em Aberto** — tabelas via `_renderHistParcelas` (histórico) e tabela própria zebrada (abertas/atrasadas), ambas com paginação automática (`addPage` quando `y+altura>285`).
10. **Rodapé** — disclaimer + CNPJ/e-mail, igual §16.

```javascript
// Paleta específica deste documento (além de _PDF_CLR)
const SIG=[31,184,119], G7=[14,92,68], LGR=[247,249,248], SEP=[236,239,238];
const RC=[220,38,38], RL=[254,226,226], BLC=[27,138,143], BLL=[207,250,254];
const AMB=[224,160,48], AML=[253,240,214]; // âmbar — recuperação judicial parcial
```

---

*Documento consolidado a partir do **Manual de Identidade Visual da Borges Assessoria** (capa, conceito, logotipo, paleta de três verdes, tipografia Helvetica tabular + IBM Plex Mono, design system e aplicações) e da estrutura técnica/UX anterior.*
*Lima canônica: `#A8E03F` — fonte única, substitui `#A8E040` e `#9fe870` em toda a base de código.*
*Hierarquia de marca: Verde Borges `#0B3D2E` (institucional) · Verde-sinal `#1FB877` (dados) · Verde-limão `#A8E03F` (ação).*
