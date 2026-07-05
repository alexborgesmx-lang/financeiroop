# Borges Assessoria — Manual de Identidade Visual

> **Versão 1.0 — 2026**
> Infraestrutura de crédito privado. *Crédito operado com precisão.*

Este manual define a identidade visual da Borges Assessoria. Para a especificação técnica de UI/código (tokens em JavaScript, componentes, motion, jsPDF), consulte o documento complementar `DESIGN_SYSTEM.md`.

---

## 1. Conceito estratégico

A Borges Assessoria não é uma financeira de esquina nem um banco. É a **infraestrutura** sobre a qual operações de crédito privado são conduzidas — captação, análise, contratos, parcelas, cobrança e recuperação — com a seriedade de quem move dinheiro de verdade.

**Posicionamento:** Financial Operating System · Credit Infrastructure.

**Sensação-guia:** *"Essa empresa controla dinheiro de forma séria."*

### As quatro essências

| Essência | Significado |
|---|---|
| **Controle** | Cada real é rastreável. Domínio total da operação, do primeiro contato à recuperação. |
| **Precisão** | Números tabulares, hierarquia clara, zero ruído. A estética serve à leitura rápida de indicadores. |
| **Confiança** | Verde institucional, espaçamento generoso, discrição premium. Solidez sem ostentação. |
| **Sistema** | Módulos que se encaixam. O símbolo são duas peças sobrepostas — operações que se conectam. |

### A marca É / NÃO é

| A marca É | A marca NÃO é |
|---|---|
| Minimalista | Banco tradicional |
| Premium | Cobrança agressiva |
| Institucional | Startup colorida |
| Tecnológica | Ostentação / dourado |
| Atemporal | Genérica |

**Referências de acabamento:** Wise · Stripe · Mercury · Brex.

---

## 2. Storytelling da marca

> **Crédito é confiança transformada em operação.**

Por muito tempo, quem operava crédito privado fazia isso no improviso: planilhas soltas, cobranças no caderno, contratos sem rastro. O dinheiro estava lá, mas o *controle* não.

A Borges Assessoria nasce para encerrar esse improviso. Reúne a jornada inteira do crédito — captação, análise, aprovação, contrato, parcela, PIX, cobrança e recuperação — em um único sistema operacional, com a clareza de um painel e a seriedade de uma instituição.

Não prometemos atalhos. Prometemos **precisão**: cada operação visível, cada número confiável, cada decisão amparada por dados. É assim que profissionais de crédito deixam de administrar planilhas e passam a operar um negócio.

---

## 3. Logotipo

### Símbolo

Dois módulos arredondados sobrepostos representam **estrutura, sistema e conexão de operações**. A interseção mais escura cria profundidade.

**Construção (SVG — viewBox `0 0 68 68`):**

```html
<svg viewBox="0 0 68 68">
  <rect x="3"  y="3"  width="40" height="40" rx="9" fill="#1FB877"/>  <!-- módulo verde-sinal -->
  <rect x="25" y="25" width="40" height="40" rx="9" fill="#0B3D2E"/>  <!-- módulo verde Borges -->
  <path d="M25 25 H43 V43 H25 Z" fill="#07241B"/>                     <!-- interseção -->
</svg>
```

### Versões oficiais

| Versão | Módulo 1 | Módulo 2 | Interseção | Fundo |
|---|---|---|---|---|
| **Principal** (sobre claro) | `#1FB877` | `#0B3D2E` | `#07241B` | claro |
| **Dark mode** | `#1FB877` | `#FFFFFF` | `#0E5C44` | `#07241B` |
| **Monocromático** | `#121815` | `#121815` | `#FFFFFF` (vazado) | qualquer |
| **Sobre lima** | `#FFFFFF` | `#07241B` | `#0B3D2E` | `#A8E03F` |

### Lockup horizontal

Símbolo + nome em duas linhas: **"Borges"** (peso 700) sobre **"Assessoria"** (peso 400, cor neutra `#4E5854`). Família Helvetica Neue. Gap símbolo↔texto = ½ módulo.

### Regras de uso

- **Área de respiro** mínima = altura de 1 módulo do símbolo, em todos os lados.
- **Escala mínima**: símbolo legível até **16px** (favicon); lockup até ~120px de largura.
- **Nunca**: distorcer, girar, aplicar sombra, recolorir fora da paleta, ou usar sobre fundo de baixo contraste.

### Arquivos em alta definição

`borges-simbolo.png` (1024²) · `borges-simbolo-verde.png` · `borges-favicon-256.png` · `borges-logo-horizontal.png` (2600×820) · `borges-logo-horizontal-branco.png`.

---

## 4. Paleta de cores

Verde floresta como assinatura institucional; verde-sinal para dados; verde-limão para ação. Neutros com leve subtom verde. **Sem azul bancário, sem dourado, sem vermelho dominante.**

### Hierarquia de marca — três verdes, três papéis

| Papel | Cor | HEX | Uso |
|---|---|---|---|
| **Institucional** | Verde Borges | `#0B3D2E` | Marca, ações positivas, "em dia", tab ativa |
| **Dados** | Verde-sinal | `#1FB877` | Gráficos, progresso, acentos positivos grandes |
| **Ação** | Verde-limão | `#A8E03F` | CTAs primários (texto sempre `#07241B`) |

### Cores primárias

| Cor | HEX | Função |
|---|---|---|
| Verde Borges | `#0B3D2E` | Primária / institucional |
| Verde-sinal | `#1FB877` | Destaque / dados |
| Verde-floresta | `#07241B` | Fundo escuro |
| Off-white | `#F7F9F8` | Fundo claro |

### Escala de verde

| Token | HEX | | Token | HEX |
|---|---|---|---|---|
| g-100 | `#E6F8EF` | | g-600 | `#11805E` |
| g-200 | `#C2EFD8` | | g-700 | `#0E5C44` |
| g-300 | `#87DFB6` | | g-800 | `#0B3D2E` |
| g-400 | `#46CB92` | | g-900 | `#07241B` |
| g-500 | `#1FB877` | | lima | `#A8E03F` |

### Escala de neutros (subtom verde)

| Token | HEX | | Token | HEX |
|---|---|---|---|---|
| n-0 | `#FFFFFF` | | n-500 | `#6E7975` |
| n-50 | `#F6F8F7` | | n-600 | `#4E5854` |
| n-100 | `#ECEFEE` | | n-700 | `#353D3A` |
| n-200 | `#DDE3E0` | | n-800 | `#1F2624` |
| n-300 | `#C4CCC8` | | n-900 | `#121815` |
| n-400 | `#9AA5A0` | | n-950 | `#0A0F0D` |

### Cores semânticas

| Cor | HEX | Uso |
|---|---|---|
| Sucesso | `#15A06A` | Confirmações, delta positivo em texto |
| Alerta | `#E0A030` / `#A9761A` | Avisos, pendente |
| Erro | `#D64545` / `#C0322F` | Erros, atrasos, destrutivo |
| Informação | `#1B8A8F` / `#176C70` | Links, badges informativos (teal, não azul) |

> **Texto sobre verde-limão é sempre `#07241B`** (verde-900) — nunca branco.

---

## 5. Tipografia

Uma única neo-grotesca para tudo — texto, interface e números. O monoespaçado fica **só** para rótulos técnicos e códigos.

| Papel | Família | Observação |
|---|---|---|
| Interface e texto | **Helvetica Neue** / Arial | Pesos 400 / 500 / 700 / 800 |
| **Números financeiros** | Helvetica Neue + `tabular-nums` | Peso **700–900**. **Nunca monoespaçado.** |
| Rótulos / códigos | **IBM Plex Mono** | Labels uppercase, PIX, HEX, IDs |

### Escala tipográfica

| Uso | Tamanho | Peso |
|---|---|---|
| Display | 56px | 700 |
| Título | 32px | 700 |
| Subtítulo | 21px | 600 |
| Corpo | 17px | 400 |
| Rótulo (mono) | 12px | uppercase, `letter-spacing .1em` |
| KPI / valor | 22–28px | 800–900, tabular |

> **Regra de números:** todo valor monetário, taxa, data ou contador usa Helvetica com `tabular-nums` para alinhar colunas. Monoespaçado nunca em valor financeiro — só em código/ID.

---

## 6. Diretrizes de interface (resumo)

A interface deve parecer um software de alto padrão usado diariamente por operadores financeiros. Especificação completa em `DESIGN_SYSTEM.md`.

- **Botões** — CTA primário em lima (`#A8E03F`, pill, texto `#07241B`); secundários ghost; destrutivos em vermelho. Um único CTA por contexto.
- **Inputs** — raio 10px, foco com halo lima, erro com borda vermelha.
- **Tabelas** — cabeçalho em verde sobre tint 10%, linhas alternadas, valores tabulares à direita.
- **Cards** — raio 16px, sombra sutil, padding generoso (20–28px).
- **Badges** — pill com fundo `rgba(cor, .10)`, nunca sólido.
- **Indicadores** — valor grande tabular + delta pequeno (verde positivo / vermelho negativo).
- **Gráficos** — receita em verde-sinal `#1FB877`; previsto em `#C2EFD8`; nunca azul para receita.

---

## 7. Aplicações da marca

### 7.1 Dashboard SaaS
Sidebar escura institucional (`#07241B`), conteúdo claro para leitura prolongada, KPIs tabulares e verde-limão reservado para ação. Hero com gradiente verde (lima → floresta).

### 7.2 App mobile
Hierarquia clara, valor em destaque tabular, ações primárias em verde-limão. Alvos de toque ≥ 44px. Telas-chave: home do operador, detalhe de contrato, pagamento PIX.

### 7.3 Login
Split institucional: painel verde-floresta com símbolo e tagline + painel branco com formulário. CTA "Acessar operação" em verde Borges.

### 7.4 Comprovante de pagamento (parcela)
Recibo compacto (440px): header verde-escuro, selo de confirmação (check em `#15A06A`), valor em destaque tabular, linhas de detalhe (cliente, CPF, contrato, PIX, data, saldo, ID), rodapé com autenticação. *Arquivo: `Comprovante de Pagamento.html`.*

### 7.5 Comprovante de quitação (contrato)
Certificado A4: letterhead, selo circular **"QUITAÇÃO TOTAL · NADA CONSTA"** (borda `#11805E`, rotação −11°), parágrafo declaratório, box-resumo verde-claro, QR de autenticação + assinatura digital. *Arquivo: `Comprovante de Quitação.html`.*

### 7.6 Timbre de contrato (PDF)
Página A4 com cabeçalho/rodapé de marca, régua verde, marca d'água do símbolo (`opacity .035`) e corpo de cláusulas. *Arquivo: `Timbre de Contrato.html`.*

### 7.7 WhatsApp Business
Mensagens com avatar do símbolo, nome em verde Borges, botão de ação "Pagar agora" em verde. Verde do WhatsApp (`#25D366`) só quando enviar pelo WhatsApp é a ação principal.

### 7.8 Assinatura de e-mail
Nome + cargo, lockup horizontal reduzido, dados de contato em neutro, divisor vertical em verde-sinal.

---

## 8. Personalidade da marca

| A marca é | A marca não é |
|---|---|
| Inteligente | Agressiva |
| Confiável | Ostentadora |
| Organizada | Popular |
| Moderna · discreta · profissional | Amadora |

---

## 9. Referência rápida

```
NOME            Borges Assessoria
DESCRITOR       Infraestrutura de crédito privado
TAGLINE         Crédito operado com precisão

INSTITUCIONAL   #0B3D2E   (Verde Borges)
DADOS           #1FB877   (Verde-sinal)
AÇÃO            #A8E03F   (Verde-limão · texto #07241B)
FUNDO ESCURO    #07241B
FUNDO CLARO     #F7F9F8

SUCESSO         #15A06A     ERRO       #D64545
ALERTA          #E0A030     INFO       #1B8A8F

TIPOGRAFIA      Helvetica Neue (texto + números tabulares)
                IBM Plex Mono (rótulos e códigos)
```

---

*Manual de Identidade Visual da Borges Assessoria · v1.0 · 2026. Documento complementar técnico: `DESIGN_SYSTEM.md`.*
