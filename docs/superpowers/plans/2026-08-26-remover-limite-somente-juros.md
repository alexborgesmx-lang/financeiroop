# Remover limite de 2 usos de "somente_juros" por contrato — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Remover a trava de "máximo 2 usos de somente_juros por contrato" em `appscript.gs`, ajustar o badge correspondente em `src/main.jsx`, e atualizar a documentação de regras de crédito (`CLAUDE.md` + `docs/ai-memory/02-AI-CREDIT-RULES.md`) pra refletir que o freio econômico agora é só o fee de 5% + a penalização de score sem teto.

**Architecture:** Mudança cirúrgica em 4 arquivos, sem novos componentes nem novos campos no Sheets. `TOTAL_SOMENTE_JUROS` continua existindo e sendo incrementado/decrementado exatamente como hoje — só para de ser usado como gatilho de bloqueio.

**Tech Stack:** Google Apps Script (`appscript.gs`), React 18 (`src/main.jsx`), Markdown (docs).

## Global Constraints

- Fee de `FEE_PRORROGACAO` permanece em 5% do principal rolado — **não alterar** o valor `0.05` em `appscript.gs:3734`.
- Nenhum teto substituto (nem 5, nem qualquer outro número) — remoção total, conforme spec.
- Mensagem de erro é removida por completo, sem virar aviso não-bloqueante.
- Este projeto **não tem suite de testes automatizados** — a verificação é o checklist manual Tier 3 do `CLAUDE.md` (GAS alterado = regra de crédito), incluindo teste no browser em produção. Os passos de "teste" abaixo seguem esse padrão em vez de TDD com testes automatizados.
- Spec de referência: `docs/superpowers/specs/2026-08-26-remover-limite-somente-juros-design.md`.

---

### Task 1: Remover a trava em `appscript.gs`

**Files:**
- Modify: `appscript.gs:3731-3733`

**Interfaces:**
- Consumes: nada de tarefas anteriores.
- Produces: `registrarPagamentoParcial` (a função que contém o bloco) passa a aceitar somente_juros sem checar `totalSJAtual`. `totalSJAtual` continua sendo lido logo acima (linha 3723-3729) e usado só para o incremento em `appscript.gs:3800` (`abaC.getRange(contratSJLin, ccm["TOTAL_SOMENTE_JUROS"]).setValue(totalSJAtual + 1)`) — esse uso **não muda** e não deve ser tocado.

- [ ] **Step 1: Localizar e remover o bloco de validação**

Em `appscript.gs`, encontrar (por volta da linha 3731):

```javascript
  if (totalSJAtual >= 2) {
    throw new Error("Limite de 2 prorrogações por contrato atingido. Cliente deve quitar a parcela completa ou formalizar um acordo.");
  }
  var feeProrrogacao = Math.round(parcelPrinc * 0.05 * 100) / 100;
```

Substituir por (remove só as 3 linhas do `if`, mantém a linha do fee intacta):

```javascript
  var feeProrrogacao = Math.round(parcelPrinc * 0.05 * 100) / 100;
```

- [ ] **Step 2: Conferir que não sobrou referência órfã**

Rodar (a partir da raiz do repo):
```bash
grep -n "Limite de 2 prorrog" appscript.gs
```
Esperado: nenhuma linha retornada (string não existe mais no arquivo).

- [ ] **Step 3: Confirmar que `totalSJAtual` ainda é usado no incremento (não removê-lo)**

Rodar:
```bash
grep -n "totalSJAtual" appscript.gs
```
Esperado: 3 ocorrências — declaração (`var totalSJAtual = 0;`), atribuição dentro do loop de busca do contrato, e o uso em `totalSJAtual + 1` no incremento. Se aparecer só 2 ocorrências, o incremento foi removido por engano — reverter.

- [ ] **Step 4: Commit**

```bash
git add appscript.gs
git commit -m "$(cat <<'EOF'
feat: remove limite de 2 usos de somente_juros por contrato

Fee de 5% (FEE_PRORROGACAO) + penalização de score sem teto (-10pts/uso)
já cobrem o risco que a trava existia pra evitar. Análise da mecânica de
geração da parcela nova confirma que o lucro do contrato nunca cai com
o uso — sempre sobe (JUROS_TOTAL soma o juro de todas as parcelas,
inclusive as geradas por somente_juros).
EOF
)"
```

---

### Task 2: Ajustar badge "Prorrogações usadas" em `src/main.jsx`

**Files:**
- Modify: `src/main.jsx:4463-4467`

**Interfaces:**
- Consumes: `contrato.TOTAL_SOMENTE_JUROS` (string/número vindo do Sheets, já usado hoje).
- Produces: nada consumido por outras tasks.

- [ ] **Step 1: Editar o objeto do badge**

Localizar em `src/main.jsx` (dentro do `ContratoModal`, por volta da linha 4463):

```javascript
                ...(parseInt(contrato.TOTAL_SOMENTE_JUROS||0)>0?[{
                  l:"Prorrogações usadas",
                  v:`${contrato.TOTAL_SOMENTE_JUROS}/2`,
                  c:parseInt(contrato.TOTAL_SOMENTE_JUROS)>=2?RED:YEL
                }]:[]),
```

Substituir por:

```javascript
                ...(parseInt(contrato.TOTAL_SOMENTE_JUROS||0)>0?[{
                  l:"Prorrogações usadas",
                  v:`${contrato.TOTAL_SOMENTE_JUROS}`,
                  c:parseInt(contrato.TOTAL_SOMENTE_JUROS)>=3?RED:YEL
                }]:[]),
```

Mudanças: `v` perde o `/2` (mostra só o número); `c` (cor) passa a virar vermelho a partir de 3 usos em vez de 2 (antes o vermelho marcava "no teto"; agora marca "uso frequente", sem teto associado). Condição de exibição (`>0`) e cor amarela como padrão abaixo de 3 não mudam.

- [ ] **Step 2: Conferir visualmente no browser (skill browser)**

Depois do deploy (Task 5), abrir um contrato com `TOTAL_SOMENTE_JUROS` preenchido (ex: PCL-106, que tem 3) e confirmar:
- Badge mostra `"3"` (não `"3/2"`)
- Cor do valor é vermelha (≥3)

- [ ] **Step 3: Commit**

```bash
git add src/main.jsx
git commit -m "feat: remove teto visual do badge de prorrogações somente_juros"
```

---

### Task 3: Atualizar `CLAUDE.md`

**Files:**
- Modify: `CLAUDE.md:219` (checklist Tier 3)
- Modify: `CLAUDE.md:444-447` (bloco "Campo TOTAL_SOMENTE_JUROS em CONTRATOS")

**Interfaces:**
- Consumes: nada.
- Produces: nada (documentação).

- [ ] **Step 1: Remover a linha do checklist Tier 3**

Em `CLAUDE.md`, remover a linha 219:

```
   ☐ somente_juros: máx 2 por contrato (TOTAL_SOMENTE_JUROS)
```

O bloco resultante (linhas 214-220) fica:

```
☐ 3. Checklist financeiro (se cálculo foi alterado):
   ☐ Juros: base × taxa × dias / 30 — confirmar fórmula inalterada
   ☐ Multa: 2% do principal (cobrada via PIX Efí Bank no campo `multa.valor`), uma vez por contrato, após carência
   ☐ VALOR_PAGO = principal + max(0, juros − desconto)
   ☐ FEE_PRORROGACAO e RECEITA_EXTRA_ATRASO são campos separados — nunca somar ao mesmo destino
```

- [ ] **Step 2: Atualizar o bloco "Campo `TOTAL_SOMENTE_JUROS` em CONTRATOS"**

Substituir (linhas 444-447):

```
**Campo `TOTAL_SOMENTE_JUROS` em CONTRATOS:**
- Contador de quantas vezes o contrato usou `somente_juros` (máx 2)
- Incrementado em `registrarPagamentoParcial`, decrementado em `reabrirParcelaAPI`
- Visível no ContratoModal como badge "X/2 prorrogações" (amarelo=1, vermelho=2)
```

Por:

```
**Campo `TOTAL_SOMENTE_JUROS` em CONTRATOS:**
- Contador de quantas vezes o contrato usou `somente_juros` — **sem limite** (removido em 2026-08-26; fee de 5% + penalização de score sem teto já cobrem o risco que a trava existia pra evitar — detalhes em `docs/ai-memory/02-AI-CREDIT-RULES.md`)
- Incrementado em `registrarPagamentoParcial`, decrementado em `reabrirParcelaAPI`
- Visível no ContratoModal como badge "X prorrogações" (amarelo a partir de 1 uso, vermelho a partir de 3+)
```

- [ ] **Step 3: Commit**

```bash
git add CLAUDE.md
git commit -m "docs: remove limite de 2 usos de somente_juros do CLAUDE.md"
```

---

### Task 4: Atualizar `docs/ai-memory/02-AI-CREDIT-RULES.md`

**Files:**
- Modify: `docs/ai-memory/02-AI-CREDIT-RULES.md:106-126`

**Interfaces:**
- Consumes: nada.
- Produces: nada (documentação).

- [ ] **Step 1: Substituir a seção "Pagamento Somente Juros — Política Formalizada"**

Substituir o bloco inteiro (linhas 106-126):

```markdown
## Pagamento Somente Juros — Política Formalizada (2026-06-19)

O `somente_juros` é uma prorrogação da parcela: cliente paga apenas os juros do mês e o principal é rolado para uma nova parcela criada automaticamente no final do contrato.

### Regras obrigatórias

1. **Limite de 2 usos por contrato** — 3ª tentativa é bloqueada com erro claro. Campo `TOTAL_SOMENTE_JUROS` em CONTRATOS controla o contador.
2. **Fee de 5% sobre o principal** — cobrado junto com os juros no mesmo pagamento (`vlPago = juros + fee`). Registrado em `FEE_PRORROGACAO` (campo separado de `RECEITA_EXTRA_ATRASO`).
3. **Penalização no score: -10 pts por uso** — acumulativa sobre todos os contratos do cliente. Score recalculado após cada uso.
4. **Parcela nova gerada automaticamente** — criada com `ORIGEM_PARCELA = "gerada_por_pagamento_de_juros"` e `ID_PARCELA_ORIGEM` apontando para a parcela original.

> **Nota (2026-06-20):** Requisito de score mínimo 60 removido. Qualquer cliente pode usar somente_juros independente do score — preferível receber ao menos os juros a não receber nada.

### Contabilidade
- `RECEITA_EXTRA_ATRASO` = mora/multa de atraso real (zero em somente_juros)
- `FEE_PRORROGACAO` = fee de prorrogação (5% do principal)
- Somas financeiras usam `RECEITA_EXTRA_ATRASO + FEE_PRORROGACAO` para cobrir registros antigos e novos

### Reversão (reabertura)
Se a parcela for reaberta via `reabrirParcelaAPI`, a parcela gerada automaticamente é deletada e `TOTAL_SOMENTE_JUROS` é decrementado.
```

Por:

```markdown
## Pagamento Somente Juros — Política Formalizada (2026-06-19, revisada 2026-08-26)

O `somente_juros` é uma prorrogação da parcela: cliente paga apenas os juros do mês e o principal é rolado para uma nova parcela criada automaticamente no final do contrato.

### Regras obrigatórias

1. **Sem limite de usos por contrato** (removido em 2026-08-26 — ver nota abaixo). Campo `TOTAL_SOMENTE_JUROS` em CONTRATOS continua contando quantas vezes o contrato usou a função, só que sem bloquear.
2. **Fee de 5% sobre o principal** — cobrado junto com os juros no mesmo pagamento (`vlPago = juros + fee`). Registrado em `FEE_PRORROGACAO` (campo separado de `RECEITA_EXTRA_ATRASO`).
3. **Penalização no score: -10 pts por uso** — acumulativa sobre todos os contratos do cliente, **sem teto**. Score recalculado após cada uso.
4. **Parcela nova gerada automaticamente** — criada com `ORIGEM_PARCELA = "gerada_por_pagamento_de_juros"` e `ID_PARCELA_ORIGEM` apontando para a parcela original. A parcela nova herda o **mesmo principal e o mesmo juros** da parcela original adiada (`appscript.gs:3788`) — ou seja, o principal continua rendendo juro normalmente enquanto está em aberto, igual um empréstimo comum. Isso é o motivo pelo qual a função nunca reduz o lucro projetado do contrato: `JUROS_TOTAL` soma o juro de todas as parcelas (inclusive as geradas), então sobe a cada uso, nunca cai — o fee de 5% é margem adicional por cima disso.

> **Nota (2026-06-20):** Requisito de score mínimo 60 removido. Qualquer cliente pode usar somente_juros independente do score — preferível receber ao menos os juros a não receber nada.

> **Nota (2026-08-26):** Limite de 2 usos por contrato removido. A regra original existia pra evitar que o cliente criasse hábito de sempre prorrogar, corroendo o lucro do contrato — mas o fee de 5% (regra 2) e a penalização de score sem teto (regra 3), ambos adicionados depois da regra original, já cobrem esse risco de forma proporcional (quanto mais usa, pior fica score/taxa em contratos futuros) em vez de travar seco no 3º uso. Motivador: contrato PCL-106 (Acordo Assistido) já tinha 3 usos históricos, e travar contradiz o princípio da nota de 2026-06-20 ("preferível receber ao menos os juros a não receber nada"). Nenhuma ação retroativa necessária — `TOTAL_SOMENTE_JUROS` é só um contador, não há outro estado bloqueando contratos que já estavam no teto antigo.

### Contabilidade
- `RECEITA_EXTRA_ATRASO` = mora/multa de atraso real (zero em somente_juros)
- `FEE_PRORROGACAO` = fee de prorrogação (5% do principal)
- Somas financeiras usam `RECEITA_EXTRA_ATRASO + FEE_PRORROGACAO` para cobrir registros antigos e novos

### Reversão (reabertura)
Se a parcela for reaberta via `reabrirParcelaAPI`, a parcela gerada automaticamente é deletada e `TOTAL_SOMENTE_JUROS` é decrementado.
```

- [ ] **Step 2: Commit**

```bash
git add docs/ai-memory/02-AI-CREDIT-RULES.md
git commit -m "docs: registra remoção do limite de 2 usos de somente_juros nas regras de crédito"
```

---

### Task 5: Review, deploy e verificação Tier 3

**Files:** nenhum arquivo novo — só execução de comandos e checklist manual.

**Interfaces:**
- Consumes: mudanças das Tasks 1-4, já commitadas.
- Produces: mudanças em produção (Vercel + Apps Script publicado).

- [ ] **Step 1: Rodar o review obrigatório**

`appscript.gs` foi alterado (regra de crédito) → Tier 3. Invocar a skill:
```
Skill("ultrareview-financeiroop")
```
Se retornar item CRÍTICO ou BLOQUEANTE, corrigir antes de prosseguir.

- [ ] **Step 2: Abrir o `appscript.gs` pra colar no Apps Script**

```bash
open -a "TextEdit" /Users/alexborges/financeiroop/appscript.gs
```
Instruir o usuário: Cmd+A → Cmd+C → colar no editor do Google Apps Script → publicar nova versão do Web App.

- [ ] **Step 3: Deploy do frontend**

```bash
vercel deploy --prod
```

- [ ] **Step 4: Teste manual no browser (skill browser)**

Abrir o app em produção, ir em Contratos → abrir o contrato PCL-106 (cliente Jessica Vilas Boas de Abreu, já tem 3 usos históricos):
- Confirmar que o badge "Prorrogações usadas" mostra `"3"` (sem `/2`), na cor vermelha.
- Abrir o modal de pagamento de uma parcela em aberto desse contrato, selecionar "somente juros", confirmar que **não aparece mais** a mensagem de erro de limite e que o pagamento é registrado normalmente (gera a parcela nova no fim do carnê, incrementa `TOTAL_SOMENTE_JUROS` pra 4).
- Sem erros de console JavaScript.

- [ ] **Step 5: Confirmar checklist Tier 3 do CLAUDE.md**

- [ ] Datas usam `parseDateLocal` — não alterado nesta mudança, mas confirmar que o diff de `appscript.gs` não tocou em nenhuma linha de data.
- [ ] Colunas lidas via `buildColMap`/`setCel` — não alterado.
- [ ] `STATUS_TERMINAL` global não redefinido — não alterado.
- [ ] Status terminais não reabertos em nenhum caminho — não alterado.
- [ ] `FEE_PRORROGACAO` continua em 5%, intacto (Step 1 do Task 1 confirmou isso).

- [ ] **Step 6: Nenhum commit adicional necessário**

Todas as mudanças de código e doc já foram commitadas nas Tasks 1-4. Este task só produz side-effects de deploy (Vercel + Apps Script), que não são commits git.
