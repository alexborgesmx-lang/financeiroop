# Análise do Modelo "Somente Juros" — Borges Assessoria

> **Propósito:** Documento completo para análise por agente de IA externo.  
> **Negócio:** Borges Assessoria — financeira informal de crédito pessoal, capital 100% próprio.  
> **Operador:** Alex Borges (solo, sem equipe).

---

## 1. O Negócio em 60 segundos

Alex empresta dinheiro próprio para trabalhadores CLT (carteira assinada), cobra juros mensais e recebe via PIX. Cada contrato tem:

- **Principal** (VALOR_PRINCIPAL): capital emprestado, ex: R$ 600
- **Taxa mensal** (TAXA_JUROS_MENSAL): ex: 18% ao mês
- **N parcelas** (NUM_PARCELAS): ex: 3x
- **Juros total** = principal × taxa × n = 600 × 0,18 × 3 = R$ 324
- **Valor total** = principal + juros = R$ 924
- **Valor por parcela** = valor total / n = R$ 308
- Cada parcela tem **parte principal** (R$ 200) + **parte de juros** (R$ 108) — ambas iguais em todas as parcelas (modelo price simplificado)

Os contratos são formais (documento + assinatura eletrônica ZapSign), pagamentos via PIX. Banco de dados = Google Sheets. Sistema de gestão = React SPA no Vercel.

---

## 2. O Modelo "Somente Juros" — O que é

### Conceito de negócio

Quando um cliente **não consegue pagar a parcela completa** (principal + juros), Alex pode aceitar receber **apenas os juros daquele mês**. O principal não é pago — ele é "rolado" para o final do contrato como uma nova parcela adicional.

**Na prática:**
- Cliente devia: R$ 308 (R$ 200 principal + R$ 108 juros)
- Alex aceita: R$ 108 (só os juros)
- O principal de R$ 200 vira uma nova parcela no final do carnê

### Nomenclatura no sistema

| Onde | Nome |
|---|---|
| `TIPO_PAGAMENTO` (aba PARCELAS e PAGAMENTOS) | `somente_juros` |
| `ORIGEM_PARCELA` da nova parcela | `gerada_por_pagamento_de_juros` |
| Ação GAS | `pagamentoParcial` |
| Função GAS | `registrarPagamentoParcial()` |
| Label na UI | "Somente Juros" |

---

## 3. Fluxo Técnico Completo

### 3.1 Como o usuário aciona

O tipo "Somente Juros" aparece como opção no seletor de tipo de pagamento em **3 lugares** da interface:

1. **Aba Cobrança** → `PagamentoDrop` (modal de pagamento rápido por cliente inadimplente)
2. **ContratoModal** → `PagamentoParcelaModal` (modal de pagamento dentro do detalhe do contrato)
3. **Aba Cobrança** → modal de pagamento simples por parcela

Quando o usuário seleciona "Somente Juros", o campo de valor é automaticamente preenchido com `VALOR_JUROS` da parcela selecionada.

### 3.2 O que o frontend envia ao GAS

```javascript
// action = "pagamentoParcial" (diferente de "pagamento" para tipo normal)
{
  action: "pagamentoParcial",
  idParcela: "00042",        // ID da parcela (pode ser vazio em parcelas legadas)
  idContrato: "PCL-Nº 42",  // sempre enviado
  numParcela: 2,             // sempre enviado (fallback se idParcela vazio)
  valor: 108.00,             // valor dos juros
  data: "2026-06-19"
}
```

### 3.3 O que o GAS executa (`registrarPagamentoParcial`)

**Passo 1 — Localiza a parcela**
- Busca por `ID_PARCELA` primeiro
- Se `ID_PARCELA` vazio (parcelas legadas sem essa coluna), busca por `ID_CONTRATO + NUM_PARCELA + STATUS não-terminal`

**Passo 2 — Grava pagamento em PAGAMENTOS**
```
TIPO_PAGAMENTO = "somente_juros"
VALOR_PAGO = valorRecebido (ou VALOR_JUROS se não informado)
RECEITA_EXTRA_ATRASO = max(0, valorRecebido - VALOR_JUROS)  ← se pagou mais que juros
OBSERVACOES = "Somente juros. Principal R$ X rolado."
```

**Passo 3 — Atualiza a parcela paga (STATUS = "pago")**
```
DATA_PAGAMENTO = data informada
VALOR_PAGO = valor dos juros
VALOR_RECEBIDO = valor dos juros
DIFERENCA_PAGA = 0
TIPO_PAGAMENTO = "somente_juros"
STATUS = "pago"   ← terminal! nunca reaberta automaticamente
```

**Passo 4 — Cria NOVA parcela no final do carnê**
```
ID_PARCELA = próximo sequencial disponível (ex: "00087")
NUM_PARCELA = maxNP + 1  (maior NUM_PARCELA do contrato + 1)
TOTAL_PARCELAS = maxNP + 1
DATA_VENCIMENTO = data da última parcela existente + 1 mês
VALOR_PARCELA = mesmo da parcela original (principal + juros)
VALOR_PRINCIPAL = mesmo da parcela original
VALOR_JUROS = mesmo da parcela original
STATUS = "pendente"
ORIGEM_PARCELA = "gerada_por_pagamento_de_juros"
ID_PARCELA_ORIGEM = ID da parcela que gerou esta
```

**Passo 5 — Atualiza TOTAL_PARCELAS em TODAS as parcelas do contrato**
- Percorre todas as linhas da aba PARCELAS onde `ID_CONTRATO` bate
- Grava `maxNP + 1` na coluna `TOTAL_PARCELAS` de cada linha

**Passo 6 — Atualiza totais do CONTRATO (`atualizarTotaisContrato`)**
```
NUM_PARCELAS = contagem total de parcelas (agora N+1)
JUROS_TOTAL = soma de VALOR_JUROS de todas as parcelas
VALOR_TOTAL = VALOR_PRINCIPAL_original + JUROS_TOTAL_recalculado
VALOR_PARCELA = VALOR_TOTAL / NUM_PARCELAS  ← MÉDIA (não valor real de cada parcela)
PARCELA_PRINCIPAL = VALOR_PRINCIPAL_original / NUM_PARCELAS  ← MÉDIA
PARCELA_JUROS = JUROS_TOTAL / NUM_PARCELAS  ← MÉDIA
```

**Passo 7 — Calcula score e métricas do cliente**

**Passo 8 — Registra evento PAGAMENTO_SOMENTE_JUROS em EVENTOS**

---

## 4. Efeito Financeiro — Antes e Depois

### Exemplo concreto: contrato de R$ 600 em 3x a 18% a.m.

**Parcelas originais:**
| Parcela | Vencimento | Principal | Juros | Total |
|---|---|---|---|---|
| P1 | 2026-07-01 | R$ 200 | R$ 108 | R$ 308 |
| P2 | 2026-08-01 | R$ 200 | R$ 108 | R$ 308 |
| P3 | 2026-09-01 | R$ 200 | R$ 108 | R$ 308 |

**Contrato original:** VALOR_TOTAL = R$ 924, NUM_PARCELAS = 3

---

**Depois de somente_juros em P1 (Alex recebe R$ 108):**

| Parcela | Vencimento | Principal | Juros | Total | Status | Origem |
|---|---|---|---|---|---|---|
| P1 | 2026-07-01 | R$ 200 | R$ 108 | R$ 308 | **pago (somente_juros)** | original |
| P2 | 2026-08-01 | R$ 200 | R$ 108 | R$ 308 | pendente | original |
| P3 | 2026-09-01 | R$ 200 | R$ 108 | R$ 308 | pendente | original |
| **P4** | **2026-10-01** | **R$ 200** | **R$ 108** | **R$ 308** | **pendente** | **gerada_por_pagamento_de_juros** |

**Contrato atualizado:**
| Campo | Antes | Depois | Variação |
|---|---|---|---|
| NUM_PARCELAS | 3 | 4 | +1 |
| JUROS_TOTAL | R$ 324 | R$ 432 | +R$ 108 (nova parcela de juros) |
| VALOR_TOTAL | R$ 924 | R$ 1.032 | +R$ 108 |
| VALOR_PARCELA | R$ 308 | R$ 258 (MÉDIA enganosa) | — |
| PARCELA_PRINCIPAL | R$ 200 | R$ 150 (MÉDIA enganosa) | — |
| PARCELA_JUROS | R$ 108 | R$ 108 (MÉDIA) | = |

> ⚠️ **ATENÇÃO:** VALOR_PARCELA, PARCELA_PRINCIPAL e PARCELA_JUROS viram **médias** no registro do CONTRATO após somente_juros. As parcelas reais no Sheets ainda têm R$ 308 cada. O contrato mostra valores agregados distorcidos — issue conhecido.

---

## 5. Impacto no Saldo Devedor Real do Cliente

Após somente_juros em P1:
- Cliente pagou: R$ 108
- Principal ainda devido: R$ 600 (inalterado — P1 tinha R$ 200 que viraram P4)
- Juros ainda pendentes: P2 + P3 + P4 = 3 × R$ 108 = R$ 324
- Total ainda devido: R$ 600 + R$ 324 = R$ 924

> Matematicamente correto: o cliente não reduziu o saldo devedor — apenas pagou os juros do mês e ganhou mais 1 mês de prazo. O total a pagar aumentou em R$ 108 (os juros da nova parcela P4).

**Custo total do contrato após N aplicações de somente_juros:**
```
Custo_original = principal + (principal × taxa × n)
Custo_com_K_somente_juros = principal + (principal × taxa × (n + K))
Acréscimo = K × principal × taxa
```

Para o exemplo: cada somente_juros adiciona R$ 108 ao custo total do contrato.

---

## 6. Impacto nas Métricas do Sistema

### 6.1 Dashboard e KPIs financeiros

- **Receita realizada**: o `VALOR_PAGO` de tipo `somente_juros` **entra como receita** (correto — juros foram recebidos)
- **RECEITA_EXTRA_ATRASO**: captura qualquer valor acima dos juros (multa)
- **Capital em circulação (Carteira)**: usa `principalAberto` = soma de `VALOR_PRINCIPAL` das parcelas pendentes — inclui corretamente a parcela P4 gerada

### 6.2 Score do cliente

Score é recalculado após cada somente_juros. O sistema trata como pagamento (parcela fica `pago`), mas o tipo `somente_juros` é diferenciado na lógica:
- Não há penalização explícita de score por tipo somente_juros no código atual
- A parcela paga com somente_juros conta como "parcela paga" para o score
- A nova parcela criada vence no futuro — não conta como atraso imediato

### 6.3 Aba Cobrança

Após somente_juros:
- P1: status `pago` (terminal) → some da fila de cobrança ✓
- P2, P3: status inalterado — permanecem na fila se vencidas
- P4 (nova): status `pendente` → aparecerá na fila quando vencer ✓

### 6.4 Aba Financeiro — Lucro do Período

O lucro é calculado sobre PARCELAS (não PAGAMENTOS):
```javascript
Lucro = Σ (VALOR_JUROS − DESCONTO_APLICADO) + Σ DIFERENCA_PAGA
// de parcelas com STATUS "pago" ou "quitacao_antecipada" no período
```

Para somente_juros: `VALOR_JUROS` da P1 entra no lucro do período, `DESCONTO_APLICADO = 0`. ✓

### 6.5 Comprovante PDF

O comprovante detecta `isSomenteJuros` e exibe um banner amarelo:
```
"CONTRATO ATUALIZADO
Original: N parcelas. Adicionadas X por somente juros (principal rolado). Total atual: M parcelas."
```

---

## 7. Carnê PIX após Somente Juros

**Situação atual:**
- As parcelas originais (P1, P2, P3) tiveram PIX `cobv` gerado na criação do contrato → salvo em `PIX_TXID` / `EFI_PIX_CODE` na parcela
- A **nova parcela P4** criada pelo somente_juros **não tem PIX** gerado automaticamente
- O PIX para P4 precisaria ser gerado manualmente (via carnê PIX no frontend ou pela régua de cobrança automática, que gera PIX avulso quando necessário)

A régua de cobrança (`enviarReguaCobranca`) gera PIX avulso via `api/efi-pix-avulso.js` para parcelas sem PIX — então P4 receberá PIX quando a régua rodar próximo ao vencimento. ✓

---

## 8. Reabertura após Somente Juros

Se Alex precisar desfazer um somente_juros (erro de registro):

**Código GAS `reabrirParcelaAPI` (linha ~1039):**
```javascript
// Se era somente_juros, deletar parcela gerada automaticamente
if (tipoAnterior === "somente_juros" && idParcelaOriginal) {
  // busca e deleta a parcela com ORIGEM_PARCELA = "gerada_por_pagamento_de_juros"
  // onde ID_PARCELA_ORIGEM = idParcelaOriginal
  // após deleção, recalcula TOTAL_PARCELAS de todas as parcelas
}
```

A reabertura é suportada e reverte corretamente: deleta P4, decrementa TOTAL_PARCELAS e reverte P1 para status não-terminal.

---

## 9. Fluxos do Frontend — Onde e Como o Usuário Aciona

O modelo somente_juros pode ser acionado em **3 pontos distintos** da interface. Os três enviam a mesma ação ao GAS (`pagamentoParcial`), mas têm layout, contexto e comportamento pós-confirmação diferentes.

---

### 9.1 CobrancaModal — Aba "Cobrança" (fluxo principal)

**Onde:** Aba Cobrança → clicar em qualquer linha de cliente inadimplente → abre modal de 2 colunas.

**Contexto:** Este é o fluxo mais completo. É o ponto de trabalho diário de cobrança — todas as parcelas vencidas do cliente ficam na coluna esquerda; o formulário de pagamento fica na coluna direita.

**Como o somente_juros aparece:**

O tipo de pagamento é selecionado via **4 cards clicáveis** (grid 2×2):

```
┌─────────────────────┬─────────────────────┐
│  Pagamento Total    │  Total + Encargos   │
│  Valor original     │  Multa + juros mora │
│  da parcela         │                     │
├─────────────────────┼─────────────────────┤
│  Somente Juros  ◄── │  Personalizado      │
│  Principal rolado   │  Informe o valor    │
│  p/ nova parcela    │  manualmente        │
└─────────────────────┴─────────────────────┘
```

O card selecionado fica com borda verde (`GRN`) e fundo levemente laranja.

**O que acontece ao selecionar "Somente Juros":**
- Campo "Valor (R$)" é preenchido automaticamente com `VALOR_JUROS` da parcela selecionada
- Campo Valor fica em modo `readOnly` (não é "personalizado")
- **Campo "Desconto nos Juros" fica oculto** — desconto só aparece no tipo "total"
- Campo de data permanece editável (padrão: hoje)

**Resumo da parcela exibido acima do seletor:**

```
PCL-Nº 42 · Parcela 2/6
┌──────────────┬──────────────┐
│  PRINCIPAL   │  JUROS       │
│  R$ 200,00   │  R$ 108,00   │
├──────────────┼──────────────┤
│  PARCELA     │  COM ENC.(7d)│
│  ORIGINAL    │              │
│  R$ 308,00   │  R$ 358,90 ◄─┼── vermelho (em atraso)
└──────────────┴──────────────┘
Multa (10%): R$ 30,80 · Mora (7d × 0.033%): R$ 7,12
```

**Comportamento pós-confirmação:**
- Parcela paga some da coluna esquerda (lista de inadimplentes)
- `ComprovanteEnvioModal` abre com opção de salvar PDF e enviar pelo WhatsApp

**Inconsistência técnica:** Neste modal, o tipo somente_juros é representado pelo valor `"somente_juros"` na variável `tipo`. Já nos outros dois modais (PagamentoDrop e PagamentoParcelaModal), o mesmo fluxo usa o valor `"parcial"`. Ambos mapeiam para `action: "pagamentoParcial"` no GAS — o resultado final é idêntico, mas o código tem essa inconsistência de nomenclatura interna.

---

### 9.2 PagamentoDrop — Widget Rápido (Dashboard + modal Registrar Pagamento)

**Onde:** 
- Dashboard → botão "Registrar Pagamento" → abre modal → contém o widget `PagamentoDrop`
- Aba Dashboard → card de atraso rápido

**Contexto:** Widget compacto para registrar pagamentos sem sair do Dashboard. Voltado para registros rápidos durante o dia. Tem busca de cliente por nome/ID com autocomplete.

**Como o somente_juros aparece:**

Após selecionar o cliente e a parcela, aparece um `<select>` simples:

```
Tipo
┌─────────────────────────┐
│ ▾ Selecione...          │  ← estado inicial
│   Total                 │
│   Somente Juros         │
└─────────────────────────┘
```

**O que acontece ao selecionar "Somente Juros":**
- Campo Valor preenchido automaticamente com `VALOR_JUROS` da parcela
- Campo "Desconto nos Juros" fica oculto (só aparece em "Total")
- Campo de data e botão Confirmar permanecem

**Informação extra do widget:** quando a parcela selecionada é a última do contrato, aparece badge verde "última" no seletor. Parcelas atrasadas ficam com fundo vermelho claro e ícone `⚠`.

**Comportamento pós-confirmação:**
- Msg de sucesso: `"Juros registrados. Principal rolado para nova parcela."` (mensagem vinda do GAS)
- `gerarEEnviarComprovante` é chamado automaticamente — gera PDF e oferece envio por WhatsApp
- Após 1,5s: fecha o widget e chama `onSucesso` → `carregar()` sincroniza os dados

**Particularidade:** se o cliente tem contrato em `acordo_assistido` E tem parcelas normais pendentes, o widget exibe um toggle "Pagamento Normal / Abatimento" para escolher o modo. Somente_juros só aparece no modo "Pagamento Normal".

---

### 9.3 PagamentoParcelaModal — Modal Simples (ContratoModal + Dashboard)

**Onde:**
- ContratoModal → aba Parcelas → clicar no botão de pagamento de qualquer parcela não-terminal
- Dashboard → clicar na linha de uma parcela em atraso → abre diretamente este modal

**Contexto:** Modal compacto (420px de largura) focado em uma única parcela. Usado dentro do ContratoModal quando Alex está revisando o contrato completo e quer pagar uma parcela específica.

**Como o somente_juros aparece:**

`<select>` com 2 opções:

```
Tipo
┌─────────────────────────┐
│ ▾ Pagamento total       │
│   Pagamento total       │
│   Somente juros         │
└─────────────────────────┘
```

**O que acontece ao selecionar "Somente juros":**
- Campo Valor substituído pelo `VALOR_JUROS` da parcela
- Campo "Desconto nos Juros" fica oculto (só aparece em "Pagamento total")
- Modal tem também botão "Reagendar" que muda para modo de registro de promessa

**Fluxo pós-confirmação (diferente dos outros dois):**

Este é o único dos três que usa um estado intermediário antes de fechar:
1. GAS responde com sucesso
2. O próprio modal **troca de tela** — renderiza `ComprovanteEnvioModal` no lugar (sem abrir novo modal sobre o atual)
3. `ComprovanteEnvioModal` mostra: valor pago, data, tipo ("Somente Juros"), vencimento original
4. Botões: "Salvar comprovante (PDF)" e "Enviar pelo WhatsApp"
5. Ao fechar o comprovante: `onConfirmar(res)` é chamado → atualiza estado otimista (parcela vira `STATUS: "pago"`) → `carregar()` em background

**Atualização otimista do estado:**
```javascript
// Ao confirmar o modal
onConfirmar={()=>{
  const p = pagamentoHoje;
  setPagamentoHoje(null);
  setRaw(prev => ({
    ...prev,
    PARCELAS: (prev.PARCELAS||[]).map(par =>
      String(par.ID_PARCELA) === String(p.ID_PARCELA)
        ? {...par, STATUS: "pago"}  // ← parcela some da lista imediatamente
        : par
    )
  }));
  carregar(); // sincroniza a nova parcela P4 em background
}}
```

> **Limitação do optimistic update:** O update otimista marca a parcela paga como `STATUS: "pago"`, mas a nova parcela criada pelo somente_juros (P4) só aparece na UI após o `carregar()` completar. Há uma janela curta onde o total de parcelas mostrado pode estar desatualizado.

---

### 9.4 Tabela comparativa dos 3 fluxos

| Aspecto | CobrancaModal | PagamentoDrop | PagamentoParcelaModal |
|---|---|---|---|
| **Onde fica** | Aba Cobrança | Dashboard / modal Reg. Pagamento | ContratoModal / Dashboard parcela |
| **Seletor de tipo** | 4 cards clicáveis | `<select>` 2 opções | `<select>` 2 opções |
| **Label "somente juros"** | "Somente Juros" | "Somente Juros" | "Somente juros" |
| **Variável interna `tipo`** | `"somente_juros"` | `"parcial"` | `"parcial"` |
| **Action enviado ao GAS** | `"pagamentoParcial"` | `"pagamentoParcial"` | `"pagamentoParcial"` |
| **Valor preenchido auto** | `VALOR_JUROS` | `VALOR_JUROS` | `VALOR_JUROS` |
| **Campo Valor editável** | Não (readOnly) | Sim | Sim |
| **Desconto nos juros** | Oculto | Oculto | Oculto |
| **Resumo da parcela** | Sim (com encargos detalhados) | Parcial (valor + atraso) | Não (só header) |
| **Comprovante PDF** | Via `ComprovanteEnvioModal` | Automático + `ComprovanteEnvioModal` | Substitui o modal (inplace) |
| **Após confirmar** | Parcela some da lista | Fecha widget, chama `onSucesso` | Mostra comprovante inplace → `onConfirmar` |
| **Optimistic UI** | Não implementado | Não implementado | `STATUS: "pago"` imediato |
| **Modo alternativo** | "Reagendar" (promessa) | "Abatimento" (acordo assistido) | "Reagendar" (promessa) |

---

### 9.5 Geração do comprovante PDF para somente_juros

A função `gerarEEnviarComprovante` tem lógica específica para somente_juros (`isSomenteJuros = tipoLabel === "Somente Juros"`):

**Problema de timing:** o comprovante pode ser gerado em dois estados:
- **Pré-sincronização:** `hist` (parcelas do contrato) ainda não foi recarregado — a nova parcela P4 não existe em `hist` ainda
- **Pós-sincronização:** `carregar()` já completou — `hist` inclui P4

O código detecta automaticamente qual estado está ativo:
```javascript
const currentInHist = hist.find(p => p.ID_PARCELA === parcela.ID_PARCELA);
const isAlreadyProcessed = isSomenteJuros && !!currentInHist
  && currentInHist.TIPO_PAGAMENTO === "somente_juros";

// Pré-sincronização: soma +1 ao total
const totalParcEfetivo = (isSomenteJuros && !isAlreadyProcessed)
  ? hist.length + 1
  : hist.length;
```

**Banner amarelo no PDF** (exclusivo do somente_juros):
```
┌─────────────────────────────────────────────────┐
│ CONTRATO ATUALIZADO                              │
│ Original: 3 parcelas. Adicionadas 1 por somente │
│ juros (principal rolado). Total atual: 4 parcelas│
└─────────────────────────────────────────────────┘
```

---

### 9.6 Como somente_juros aparece nas telas de leitura

**Aba Financeiro — tabela de pagamentos:**
- Linha com badge vermelho (`RED`) e label "Somente Juros"
- Contador `pagJuros` no período exibido nas métricas
- Filtro "Somente Juros" disponível na barra de filtros da tabela

**ContratoModal — linha da parcela na tabela:**
- Parcela paga aparece com `TIPO_PAGAMENTO` = "Só Juros" em badge vermelho
- Parcela gerada (P4) aparece como "pendente" com `ORIGEM_PARCELA` = "gerada_por_pagamento_de_juros" (sem badge especial na linha)

**ClienteModal — histórico de pagamentos:**
- Linha do pagamento aparece com cor vermelha (`RED`) e label "Somente Juros"

**Dashboard — card "Em Atraso":**
- Após somente_juros em P1: P1 some da lista (status pago); P4 aparece na lista quando vencer

---

## 10. Limitações e Questões em Aberto (Análise)

### 9.1 Sem limite de recorrência
O sistema permite somente_juros ilimitado: o cliente pode pagar só juros todo mês indefinidamente, nunca reduzindo o principal. Não há:
- Teto de quantas vezes pode ser aplicado por contrato
- Alerta ao operador quando somente_juros é usado repetidamente
- Diferenciação no score entre 1x somente_juros (dificuldade pontual) vs. 5x seguidos (padrão problemático)

### 9.2 Distorção nos campos resumo do CONTRATO
Após somente_juros, os campos `VALOR_PARCELA`, `PARCELA_PRINCIPAL`, `PARCELA_JUROS` no registro CONTRATOS viram **médias aritméticas** (não o valor real de cada parcela). Isso afeta:
- Relatórios que usem esses campos do CONTRATOS diretamente
- O documento Google Docs do contrato, se atualizado com esses campos
- Analytics que calculam `parcela × n` para projeções

As parcelas reais na aba PARCELAS têm os valores corretos (R$ 308 cada), então a operação diária não é afetada. Mas os campos de resumo do CONTRATOS ficam enganosos.

### 9.3 Não há "taxa de prorrogação" diferente
O somente_juros rola o principal com **a mesma taxa** do contrato original. Alguns credores cobram taxa maior ou taxa de prorrogação específica. Atualmente não é possível fazer isso no sistema.

### 9.4 Contabilidade — ciclo de caixa vs. accrual
O sistema usa regime de **caixa**: receita reconhecida quando recebida. Para somente_juros:
- Receita de juros: reconhecida no mês do pagamento ✓
- Custo de oportunidade do principal rolado: não calculado
- Não há diferença explícita no DRE entre "receita normal" e "receita de somente_juros"

### 9.5 Impacto na taxa de adimplência (score)
A parcela P1 vai para `pago` (status terminal) com `somente_juros`. O motor de score pode estar tratando isso como "parcela paga em dia" mesmo quando foi paga com atraso (não há verificação de se o somente_juros foi feito antes ou depois do vencimento). Isso pode inflar `TAXA_ADIMPLENCIA` do cliente.

### 9.6 Exposição total no PDD (Provisão para Devedores Duvidosos)
O PDD é calculado sobre `principalAberto` = soma de VALOR_PRINCIPAL das parcelas pendentes. Após somente_juros:
- P4 tem VALOR_PRINCIPAL = R$ 200 → entra no PDD
- Mas P2 e P3 também têm VALOR_PRINCIPAL = R$ 200 cada
- Total de principal no PDD = R$ 600 (correto — o capital em risco não mudou)

O PDD está correto para somente_juros. ✓

---

## 11. Perguntas para Análise Estratégica

Este documento foi gerado para que outro agente de IA possa ajudar a responder:

### A. Estratégia de negócio
1. O modelo somente_juros é saudável para uma financeira informal? Quais são os benchmarks do setor?
2. Devo cobrar uma taxa de prorrogação (fee) ao aceitar somente_juros, além dos juros normais?
3. Faz sentido ter um limite de somente_juros por contrato (ex: máximo 2x)?
4. Somente_juros deve ser refletido no score do cliente? Como? (penalização parcial? apenas se repetido?)
5. Qual a diferença entre somente_juros e uma "renegociação branda"? Quando usar cada um?

### B. Impacto contábil e financeiro
6. O somente_juros é receita ou receita diferida? Como devo classificar no meu DRE?
7. Como calcular o custo real do capital imobilizado quando o principal é rolado?
8. Devo ter uma linha separada no Financeiro para "Receita de Prorrogação (somente_juros)" vs. "Receita Normal"?

### C. Riscos operacionais
9. Qual o risco de um cliente usar somente_juros repetidamente para nunca pagar o principal?
10. O somente_juros aumenta o risco de inadimplência futura? Existe evidência empírica disso?
11. Devo limitar o somente_juros a contratos em situação específica (ex: apenas para clientes com score ≥ 60)?

### D. Implementação técnica (possíveis melhorias)
12. Devo registrar no score que aquela parcela foi paga como somente_juros (diferente de pagamento normal)?
13. O campo `TIPO_PAGAMENTO = "somente_juros"` deveria gerar um alerta visual diferente na aba Financeiro e no Dashboard?
14. Faz sentido adicionar um contador `TOTAL_SOMENTE_JUROS` no CONTRATO para rastrear quantas vezes foi usado?

---

## 12. Dados do Sistema (contexto quantitativo)

Para dar escala ao agente de IA:
- **Clientes ativos**: ~130+ clientes na base
- **Contratos históricos**: ~216 contratos registrados
- **Ticket médio**: entre R$ 500 e R$ 1.500 (1º contrato), até R$ 4.000 em contratos subsequentes
- **Taxas**: 14% a 22% ao mês (fixas por contrato, sem juros compostos)
- **Prazos**: 1x a 12x
- **Modelo de juros**: Price simplificado — juros iguais em todas as parcelas (não decrescentes)
- **Perdas históricas**: R$ 7.275 líquidos (1,42% do capital emprestado histórico)
- **PDD**: calibrado com 0% de provisão até 90 dias, depois 35%, 60%, 85%, 100% (baseado no histórico real)

---

## 13. Resumo executivo para o agente

**O que existe hoje:**
- O sistema tem um mecanismo funcional de "somente_juros" que rola o principal para o final do contrato
- Matematicamente correto: o cliente paga apenas os juros, a parcela de principal é replicada como nova parcela futura
- Contabilizado como receita (correto — juros foram recebidos)
- Sem limite de uso por contrato
- Sem custo extra ao cliente (além dos juros normais da nova parcela)
- Sem diferenciação de score entre pagamento normal e somente_juros

**O que não existe:**
- Política formalizada de quando aceitar (fica a critério do Alex)
- Limite de recorrência
- Taxa de prorrogação ou fee adicional
- Alerta/controle no sistema para múltiplos somente_juros no mesmo contrato
- Separação contábil entre receita normal e receita de prorrogação

**A principal pergunta do operador (Alex):**
> "Esse modelo faz sentido para o meu negócio? É uma boa estratégia? O que eu deveria mudar ou formalizar?"

---

*Gerado pelo Claude Code — FinanceiroOp — 2026-06-19*
