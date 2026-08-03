# Rede Borges — Manual de Design · v3.0 (2026)

> **A Borges não vende crédito. Constrói confiança.**
> O crédito é apenas a forma como essa confiança vira oportunidade.

Este é o companheiro em texto do "Manual de Design v3" (HTML). Serve de fonte única para colar em wikis, briefings e prompts. Quando uma cor, fonte ou regra faltar aqui, **proponha a adição ao manual — nunca invente um valor de memória.**

Valores da marca: **Confiança · Respeito · Responsabilidade compartilhada · Atendimento humano · Compromisso · Simplicidade.**

---

## 01 · Fundamentos

### O grande conceito
A Borges empresta dinheiro — mas o produto não é o ponto. O que a Borges constrói é uma **rede privada de confiança** que cresce só por indicação: pessoas responsáveis apadrinham pessoas responsáveis. O crédito é a consequência da confiança, nunca o contrário.

> A Borges não vende crédito. A Borges constrói confiança. O crédito é apenas a forma como essa confiança se transforma em *oportunidade.*

- **A sensação a criar:** quando perguntarem "onde você conseguiu esse empréstimo?", a resposta é "na Borges" — dita como quem diz "foi meu médico", "foi meu advogado". Não uma financeira. Um contato de confiança.
- **A promessa:** conseguir crédito deve ser uma experiência digna, respeitosa e segura — sem burocracia e sem que ninguém tenha vergonha de dizer que faz parte da Rede Borges.

### Valores & princípios visuais
1. **Confiança acima de tudo** — a confiança vem antes do contrato.
2. **Respeito pelas pessoas** — toda história merece ser ouvida.
3. **Responsabilidade compartilhada** — cada membro protege a qualidade da rede.
4. **Atendimento humano** — pessoas são atendidas por pessoas.
5. **Compromisso** — honramos a palavra dada, dos dois lados.
6. **Simplicidade** — resolver dinheiro não precisa ser complicado.

Cada princípio visual traz o seu anti-exemplo:

| Princípio | Nunca |
|---|---|
| Digno como um documento que se guarda (serif editorial, marfim quente, respiro) | Cinza de banco, plástico de fintech, ar clínico |
| Firme com o fato, gentil com a pessoa (vermelho que sinaliza sem gritar) | Vermelho berrante, caixa-alta agressiva, tom de ameaça |
| Dinheiro é o protagonista (tabular, peso forte, à direita) | Valor em fonte fina, monoespaçada ou desalinhado |
| Um sistema, todas as superfícies (o certificado usa os tokens da UI) | Neutro inventado, azul de planilha, cor fora da tabela |

**A marca nunca parece:** banco burocrático e cinza · agiota / cobrança agressiva · startup arco-íris · ostentação, dourado, "dinheiro fácil" · template de IA (glow, glass, mesh).

---

## 02 · Identidade

### Logo & símbolo
O símbolo — dois módulos que se sobrepõem — significa **duas pessoas de confiança se conectando**: o padrinho e quem ele traz. A interseção sólida é o vínculo.

Variantes: **Principal** (sobre marfim) · **Escuro** (sobre floresta) · **Sobre ação** (verde-limão) · **Favicon** (legível ≥16px).

### A Linha de Confiança (elemento de assinatura)
Uma linha contínua que costura nós — cada nó é um membro; o nó central, maior, é quem você é na rede. É **a marca sem o logo**. Aparece no topo do certificado, no rodapé dos PDFs, no header do app e como divisor de seção. Ninguém tem essa linha — só a Borges.
- Nunca vira ornamento denso: sempre fina, respirada, legível.

### Regras da marca
- Área de respiro = altura de 1 módulo em todos os lados.
- Nunca distorcer, girar, sombrear ou recolorir fora da tabela de tokens.

---

## 2.2 · Tabela de tokens

**Regra nº 1 do sistema: nunca digite um hex de memória — sempre copie desta tabela.** Cada cor tem nome, um hex por tema, papel e contraste WCAG verificado.

| Token | Claro | Escuro | Papel | Contraste |
|---|---|---|---|---|
| `--bg` | `#F7F5EF` | `#06231A` | Marfim quente · fundo da página | — |
| `--surface` | `#FFFDF9` | `#0B3227` | Cards, modais, tabelas | — |
| `--surface-2` | `#F0EDE4` | `#123B2E` | Zebra de tabela, insets | — |
| `--ink` | `#1A1712` | `#EFF3EC` | Texto principal | 15.6:1 AAA |
| `--ink-soft` | `#57514A` | `#AEBAB0` | Texto secundário | 7.1:1 AAA |
| `--ink-faint` | `#7C756B` | `#7F8C82` | Rótulos, legendas | 4.6:1 AA |
| `--brand` | `#0B3D2E` | `#5AD09B` | Confiança · marca · "em dia" | 9.6:1 AAA |
| `--signal` | `#127A57` | `#43D69C` | Dados · progresso (texto) | 4.7:1 AA |
| `--action` | `#A8E03F` | `#A8E03F` | Ação · CTA (texto `#07241B`) | 9.1:1 AAA |
| `--success` | `#15805A` | `#5AD09B` | Confirmação · positivo | 4.9:1 AA |
| `--warning` | `#9A6510` | `#E3A93A` | Aviso · pendente | 4.8:1 AA |
| `--error` | `#C0322F` | `#F0716E` | Erro · atraso · destrutivo | 5.1:1 AA |
| `--info` | `#166C70` | `#5FC2C6` | Informação · link | 5.3:1 AA |

**Tokens de apoio:** `--brand-2` (`#0E5C44`/`#46CB92`, faixas/hovers) · `--signal-viz` (`#1FB877`, preenchimento gráfico ≥24px) · `--action-ink` (`#07241B`, texto sobre o limão, fixo nos dois temas) · `--on-brand` (`#EAF6EF`/`#06231A`, texto sobre `--brand`) · `--on-brand-soft` (`#8FE3C0`/`#0B3D2E`, rótulo secundário sobre `--brand`) · `--line` / `--line-soft` (bordas).

> **Regra de contraste sobre `--brand`:** no escuro o `--brand` clareia para mint, então texto/rótulos usam `--on-brand` / `--on-brand-soft` (tinta escura). Nunca fixe `#fff` sobre `--brand`.

Contraste medido contra a superfície de uso. Texto normal ≥ 4.5:1 (AA); gráficos e texto grande ≥ 3:1.

---

## 2.3 · Tipografia

Três pilhas, cada uma com papel exclusivo e fallbacks exatos — para valer em toda superfície, inclusive PDF e páginas públicas.

| Papel | Fonte | Stack |
|---|---|---|
| Display · títulos, certificado | **Newsreader** (serif) | `"Newsreader", Georgia, "Times New Roman", serif` |
| Interface, texto e números | **Helvetica Neue** | `"Helvetica Neue", Helvetica, Arial, "Segoe UI", sans-serif` |
| Códigos, IDs, rótulos | **IBM Plex Mono** | `"IBM Plex Mono", ui-monospace, Menlo, monospace` |

**Regra dos números financeiros — inegociável:** todo valor em Helvetica com `font-variant-numeric: tabular-nums`, peso 700–900. **Nunca monoespaçado** — o mono é só para código (PIX, CPF, autenticação, IDs). É a assinatura tipográfica do dinheiro na Borges.

---

## 2.4 · Forma & espaço

- **Grade base 4.** Espaçamentos: 8 · 12 · 16 · 24 · 32.
- **Raios:** `8px` input/botão · `16px` card · `999px` CTA/badge (pill).
- **Elevação:** duas sombras apenas — `--shadow` (cards) e `--shadow-lg` (modais). Sutis, nunca duras.
- A forma reforça o sistema: tudo se alinha, nada é arbitrário — há ritmo, não simetria burocrática.

---

## 03 · Componentes

Hierarquia de ação clara: **um único CTA primário (limão) por contexto**; o resto recua. Tudo existe em claro e escuro.

- **Primário · CTA** — limão, pill, texto escuro (`--action` / `--action-ink`). Um por contexto.
- **Secundário · ghost** — superfície + borda; ao lado do CTA, sem competir.
- **Institucional** — `--brand`, cantos 8px; ações de marca (login, envio).
- **Contextual · aviso** — tint semântico (`--warning-bg`/`--warning`), segundo plano.
- **Destrutivo** — `--error`, **não é pill** (distinção intencional).
- **Desabilitado** — `--surface-2`, `--ink-faint`, opacidade reduzida.

**KPI com hierarquia:** não uma grade de cards iguais. O KPI de "ação do dia" ganha peso (fundo `--brand`), os demais recuam para `--surface`. Rótulos em mono minúsculo; valor em `.num` grande.

**Tabela:** cabeçalho em mono maiúsculo `--ink-faint` sobre `--surface-2`; zebra sutil; valores tabulares alinhados à direita; status em chips semânticos.

---

## 04 · UI/UX — direcionamento do sistema

1. **Interação impecável** — todo clicável tem `cursor:pointer` e hover; alvos de toque ≥ 44px; foco visível para teclado; botão desabilita durante operação assíncrona.
2. **Ergonomia claro/escuro** — os dois modos são especificados com o mesmo rigor e **testados nos dois** antes de qualquer entrega. Sem cinza ilegível, borda invisível ou vidro transparente demais.
3. **Motion confirma ação — nunca decora.** `prefers-reduced-motion` respeitado.

---

## 05 · Aplicações

- **FinanceiroOp** — o sistema operacional interno (10 abas), claro e escuro. Aplica toda a hierarquia de componentes.
- **Certificado de quitação — a peça-vitrine.** Numa rede que cresce por indicação, é o material de marketing mais importante: o momento em que o cliente sente orgulho e mostra a Borges a alguém de fora. Serif de diploma, Linha de Confiança, convite honesto à indicação, mesmos tokens da UI.
- **Documentos** — comprovante de pagamento, comprovante de quitação, timbre de contrato, extrato do contrato. Todos em marfim + serif + Linha de Confiança.
- **Papelaria & canais** — assinatura de e-mail, régua de WhatsApp, Google Sheets. A marca acompanha até a planilha e a mensagem.

---

## 06 · Tom de voz & WhatsApp

**Sério-humano:** firme nos fatos, respeitoso com a pessoa. Direto sem ser seco, nunca ameaçador, nunca bajulador. Português brasileiro, sempre.

- **Firme no fato** — datas, valores e prazos exatos.
- **Respeitoso na forma** — trata por nome, oferece caminho, preserva a dignidade. Cobra sem humilhar.
- **Curto e humano** — uma ideia por mensagem, um próximo passo óbvio. Sem juridiquês, sem emoji em excesso.

A régua de mensagens completa (lembrete, vencimento, atraso, acordo, quitação, boas-vindas de indicado) está em **`Régua WhatsApp.html`**.

---

## 07 · Governança

Este manual é a **fonte única**. Quando falta algo, não se inventa — **propõe-se uma adição.** Foi a ausência dessa regra que matou o sistema anterior.

**Quando falta um token:**
1. Confirme que a cor realmente não existe na tabela (2.2).
2. Verifique se um token semântico existente cobre o caso.
3. Se ainda faltar, proponha a adição ao manual — com nome, par claro/escuro e contraste — antes de usar.
4. Nunca hardcode um hex "provisório". Provisório vira permanente.

**Como o manual evolui:** mudança de token é versionada aqui e propagada a todas as superfícies de uma vez. Um valor, um lugar. Se três documentos discordam de uma cor, este arquivo vence.

### Checklist de conformidade — antes de publicar qualquer coisa
- [ ] Toda cor vem da tabela de tokens (nenhum hex avulso)
- [ ] Especificado em claro **e** escuro
- [ ] Números financeiros em Helvetica tabular, peso forte
- [ ] Contraste ≥ AA em todo par texto/fundo
- [ ] No máximo 3 cores semânticas na tela
- [ ] Um único CTA primário por contexto
- [ ] A Linha de Confiança presente onde couber
- [ ] Sem cara de template de IA (glow, glass, mesh)
- [ ] Passa no teste: "sem o logo, ainda é Borges?"
- [ ] Passa no teste: "um cliente teria orgulho de mostrar?"

---

## 7.2 · Justificativas das decisões centrais

- **Paleta** — mantidos os três verdes, mas os neutros foram aquecidos para **marfim**: o "papel" de uma instituição em que se confia, não o cinza de um banco. Verde é Confiança e raiz; o marfim traz Respeito e Atendimento humano.
- **Tipografia** — a serif **Newsreader** dá à marca a dignidade de um documento que se guarda (orgulho de pertencer, Compromisso). Helvetica tabular mantém o dinheiro preciso. É serif por decisão, não Inter por inércia.
- **Forma** — o símbolo de módulos sobrepostos vira duas pessoas se conectando. A grade base-4 diz Simplicidade e Responsabilidade.
- **Assinatura** — a Linha de Confiança é a rede desenhada: cada membro um nó, cada indicação estende a linha. É a marca sem o logo.
- **Linguagem** — o tom sério-humano protege a Confiança: firme no fato, sem a frieza de banco nem a agressão de cobrador.

---

## Dados oficiais da empresa
**Borges Assessoria Financeira** · CNPJ **63.124.205/0001-07** · borgesassessoriafinanceira@gmail.com · **(62) 98487-7843**

*Manual de Design — Rede Borges · v3.0 · 2026. Fonte única de verdade.*
