# Score — Tempo de Casa do Cliente Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Trocar, no cálculo de score de crédito (`calcularScore`), a fonte do bônus de
+2 pts de "idade da empresa do empregador" para "tempo de casa do próprio cliente".

**Architecture:** Edição pontual em uma função existente (`appscript.gs`), sem mudança de
schema. Não há framework de testes automatizados no GAS deste projeto — verificação é
manual, via execução da função e via browser na aba Perfil do cliente.

**Tech Stack:** Google Apps Script (`appscript.gs`), Google Sheets (aba CLIENTES, campo
`DATA_ADMISSAO` já existente).

## Global Constraints

- Datas devem sempre ser parseadas com `parseDateLocal` — nunca `new Date(string)` direto
  (bug de timezone UTC-3 documentado no CLAUDE.md).
- Não redefinir `STATUS_TERMINAL` nem tocar em status terminais — fora de escopo aqui.
- Nenhuma mudança de schema/backfill — `DATA_ADMISSAO` já existe e já é preenchida hoje.
- `SITUACAO_EMPREGADOR` e sua penalização de -5 pts permanecem inalterados.

---

### Task 1: Editar `calcularScore` em `appscript.gs`

**Files:**
- Modify: `appscript.gs:1505-1514` (bloco `// ── FATOR EMPREGADOR ──`)

**Interfaces:**
- Consumes: `gv(cmCli, rowCli, "DATA_ADMISSAO")` — já disponível, mesmo padrão de leitura
  usado para `DATA_ABERTURA_EMPREGADOR` na mesma função.
- Produces: variável local `tempoCasaAnos` (substitui `empAnosExist`) e ajuste em
  `scoreFinal` e no array `motivos` — nenhum outro código depende dessas variáveis locais
  fora desta função.

- [ ] **Step 1: Ler o bloco atual para confirmar linhas exatas**

Abrir `appscript.gs` e localizar (dentro de `calcularScore`):

```javascript
  // ── FATOR EMPREGADOR ──
  var sitEmp = String(gv(cmCli, rowCli, "SITUACAO_EMPREGADOR")||"").trim().toUpperCase();
  var dtAbEmpStr = String(gv(cmCli, rowCli, "DATA_ABERTURA_EMPREGADOR")||"").trim();
  var empAnosExist = 0;
  if (dtAbEmpStr) {
    var dtAbObj = new Date(dtAbEmpStr);
    if (!isNaN(dtAbObj.getTime())) empAnosExist = (hoje.getTime() - dtAbObj.getTime()) / (365.25*24*60*60*1000);
  }
  if (sitEmp && sitEmp !== "ATIVA") scoreFinal = Math.max(0, scoreFinal - 5);
  if (empAnosExist >= 5) scoreFinal = Math.min(100, scoreFinal + 2);
```

- [ ] **Step 2: Substituir pelo novo bloco**

```javascript
  // ── FATOR EMPREGADOR ──
  var sitEmp = String(gv(cmCli, rowCli, "SITUACAO_EMPREGADOR")||"").trim().toUpperCase();
  if (sitEmp && sitEmp !== "ATIVA") scoreFinal = Math.max(0, scoreFinal - 5);

  // ── FATOR TEMPO DE CASA (tempo de vínculo do cliente na empresa) ──
  var dtAdmStr = String(gv(cmCli, rowCli, "DATA_ADMISSAO")||"").trim();
  var tempoCasaAnos = 0;
  if (dtAdmStr) {
    var dtAdmObj = parseDateLocal(dtAdmStr);
    if (!isNaN(dtAdmObj.getTime())) tempoCasaAnos = (hoje.getTime() - dtAdmObj.getTime()) / (365.25*24*60*60*1000);
  }
  if (tempoCasaAnos >= 5) scoreFinal = Math.min(100, scoreFinal + 2);
```

Nota: `parseDateLocal` já existe no arquivo (função utilitária global usada em todo o
GAS) — não precisa ser criada.

- [ ] **Step 3: Atualizar o texto do motivo em `SCORE_MOTIVOS`**

Localizar, mais abaixo na mesma função (bloco `// ── MOTIVOS ──`):

```javascript
  if (sitEmp && sitEmp !== "ATIVA") motivos.push("-Empregador "+sitEmp+" (-5pts)");
  if (empAnosExist >= 5) motivos.push("+Empregador 5+ anos (+2pts)");
```

Substituir por:

```javascript
  if (sitEmp && sitEmp !== "ATIVA") motivos.push("-Empregador "+sitEmp+" (-5pts)");
  if (tempoCasaAnos >= 5) motivos.push("+Tempo de casa 5+ anos (+2pts)");
```

- [ ] **Step 4: Verificar que nenhuma outra referência a `empAnosExist` sobrou**

Run: `grep -n "empAnosExist" appscript.gs`
Expected: nenhum resultado (todas as ocorrências foram substituídas por `tempoCasaAnos`).

- [ ] **Step 5: Verificar manualmente no editor do GAS**

Abrir o Google Apps Script (mesma conta do projeto), colar o arquivo atualizado, e no
editor rodar `calcularScore("<algum ID_CLIENTE de teste>")` pela aba de execução, ou usar
o menu do app → recalcular score de um cliente com `DATA_ADMISSAO` preenchida há 5+ anos
e outro com menos de 5 anos / vazio. Confirmar:
- Cliente com 5+ anos de casa ganha os +2 pts.
- Cliente com menos de 5 anos ou sem `DATA_ADMISSAO` não ganha nem perde pontos por este
  fator.
- `SCORE_MOTIVOS` mostra o novo texto quando aplicável.

---

### Task 2: Atualizar documentação de regras de crédito

**Files:**
- Modify: `docs/ai-memory/02-AI-CREDIT-RULES.md`
- Modify: `MANUAL_OPERACIONAL.md:82`

**Interfaces:**
- Consumes: nenhuma (documentação pura).
- Produces: nenhuma (não afeta código).

- [ ] **Step 1: Adicionar seção em `docs/ai-memory/02-AI-CREDIT-RULES.md`**

Adicionar ao final do arquivo (após a seção "Bloqueio Manual de Cliente"):

```markdown
---

## Fator de Estabilidade Profissional no Score (2026-07-24)

O bônus de +2 pts em `calcularScore` por vínculo empregatício estável usa
`DATA_ADMISSAO` (tempo de casa do próprio cliente na empresa) — não mais
`DATA_ABERTURA_EMPREGADOR` (idade do CNPJ do empregador). Motivo: tempo de casa é sinal
mais direto do perfil de estabilidade do tomador do que a idade da empresa onde trabalha.

- **+2 pts** se `DATA_ADMISSAO` ≥ 5 anos atrás.
- `DATA_ADMISSAO` vazia ou inválida (ex: autônomo sem vínculo CLT) → neutro, 0 pontos,
  sem penalidade.
- `SITUACAO_EMPREGADOR` (checagem de idoneidade do CNPJ do empregador, -5 pts se não
  `"ATIVA"`) **não muda** — é sinal separado (existência/regularidade da empresa), não
  relacionado ao tempo de casa do cliente.
- `DATA_ABERTURA_EMPREGADOR` continua no cadastro e ainda alimenta `SCORE_EMPREGADOR`
  (métrica agregada por empregador, `appscript.gs` ~linha 4051) — só saiu do cálculo
  individual do score do cliente.
```

- [ ] **Step 2: Atualizar `MANUAL_OPERACIONAL.md:82`**

Trecho atual:

```
**Bônus** (máx +10 pts): antecipação de pagamento, 3+ quitados sem atraso grave, >12 meses sem prejuízo, boa comunicação, indicou clientes. **+2 pts** se empregador ativo há 5+ anos (`DATA_ABERTURA_EMPREGADOR`).
```

Substituir por:

```
**Bônus** (máx +10 pts): antecipação de pagamento, 3+ quitados sem atraso grave, >12 meses sem prejuízo, boa comunicação, indicou clientes. **+2 pts** se o cliente tem 5+ anos de tempo de casa no emprego atual (`DATA_ADMISSAO`).
```

- [ ] **Step 3: Commit (somente se o usuário pedir explicitamente)**

Este projeto só cria commits quando o usuário pede — não commitar automaticamente ao
final desta task. Se solicitado:

```bash
git add appscript.gs docs/ai-memory/02-AI-CREDIT-RULES.md MANUAL_OPERACIONAL.md docs/superpowers/specs/2026-07-24-score-tempo-casa-cliente-design.md docs/superpowers/plans/2026-07-24-score-tempo-casa-cliente.md
git commit -m "feat: score usa tempo de casa do cliente (DATA_ADMISSAO) em vez de idade da empresa do empregador"
```

---

### Task 3: Publicar no Google Apps Script

**Files:** nenhum arquivo novo — apenas o fluxo operacional de publicação do GAS.

- [ ] **Step 1: Abrir o arquivo local para cópia**

```bash
open -a "TextEdit" /Users/alexborges/financeiroop/appscript.gs
```

- [ ] **Step 2: Instruir o usuário**

Pedir para: Cmd+A → Cmd+C no TextEdit → colar no editor do Google Apps Script,
substituindo o conteúdo inteiro → publicar nova versão do Web App. Não há deploy Vercel
envolvido nesta mudança (é puramente GAS).
