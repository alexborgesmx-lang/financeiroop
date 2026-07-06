# FinanceiroOp — Instruções para Claude

Sistema de gestão de empréstimos pessoais (financeira informal). Proprietário: Alex Borges (alexborges.mx@gmail.com).

---

## Diretriz de comunicação e colaboração — SEMPRE seguir

O usuário (Alex) tem visão de negócio mas não tem formação técnica em UX, front-end ou programação. Claude tem o conhecimento técnico completo do sistema. Essa assimetria cria uma responsabilidade ativa para Claude:

1. **Perguntar antes de executar** — quando um pedido for ambíguo ou incompleto, fazer as perguntas necessárias para entender o objetivo real antes de escrever qualquer código.

2. **Propor o caminho melhor** — se o usuário pede X mas existe uma solução Y mais correta, explicar: *"Posso fazer X, mas Y resolveria melhor porque…"* e deixar o usuário decidir. Nunca executar cegamente.

3. **Distinguir tipos de tarefa** — quando o usuário pede "verifique o sistema", perguntar se quer: audit técnico (bugs, funcionalidade), audit de UX (fluxo, hierarquia, redundância visual), ou ambos. Não assumir.

4. **Ser direto sobre lacunas** — se uma tarefa ficou incompleta ou rasa, reconhecer sem rodeios e propor como cobrir o que ficou faltando.

5. **Educar pelo caminho** — ao explicar uma decisão técnica ou de UX, usar linguagem simples e contextualizar o porquê, não apenas o o quê.

---

## REGRA MESTRE — Obrigatória em toda alteração

**Antes de qualquer mudança no sistema** — seja por sugestão do usuário ou iniciativa própria — leia obrigatoriamente todos os arquivos abaixo, nesta ordem:

```
1. CLAUDE.md                              ← este arquivo (stack, URLs, convenções operacionais)
2. MANUAL_OPERACIONAL.md                  ← motor de crédito, score, limites, fluxos, estrutura de dados
3. BUSINESS_CONTEXT.md                   ← contexto completo do negócio, clientes, produto
4. DESIGN_SYSTEM.md                      ← paleta canônica, botões, tokens, gradientes, UX
5. docs/ai-memory/01-AI-BUSINESS-DICTIONARY.md
6. docs/ai-memory/02-AI-CREDIT-RULES.md
7. docs/ai-memory/03-AI-FINANCIAL-CALCULATIONS.md
8. docs/ai-memory/04-AI-AUDIT-STANDARDS.md
9. docs/ai-memory/05-AI-ARCHITECTURE-RULES.md
10. docs/ai-memory/06-AI-IMPLEMENTATION-RULES.md
11. docs/ai-memory/07-AI-KNOWN-ISSUES.md
```

Depois de ler, verifique se a alteração proposta:

- [ ] Respeita as regras de crédito (06)
- [ ] Não quebra integridade financeira (07)
- [ ] Não contradiz a arquitetura definida (09)
- [ ] Não repete bug conhecido (11)
- [ ] Segue a paleta e tokens do DESIGN_SYSTEM.md (alterações de UI)

Se qualquer verificação falhar, **interrompa e informe o usuário antes de escrever código**.

Hierarquia de prioridade quando houver conflito:

1. Regras de negócio (docs/ai-memory)
2. Cálculos financeiros
3. Banco de dados (Google Sheets)
4. Código

Esta regra se aplica a **toda e qualquer alteração**: código, GAS, configuração, API, design, fluxo.

---

## Stack

```
React 18 + Vite
    │
    ├── src/main.jsx          — UI principal (~5900+ linhas, lógica de negócio)
    ├── src/index.css         — Tailwind v4 + shadcn tokens + animações CSS
    ├── src/components/ui/    — 21 componentes shadcn/ui (Button, Card, Dialog...)
    ├── src/lib/utils.js      — cn() utility (clsx + tailwind-merge)
    │
    ├── GET  /api/sheets  → GAS doGet()   → lê todas as abas do Sheets
    └── POST /api/action  → GAS doPost()  → executa todas as ações de escrita
                                │
                         Google Sheets (banco de dados)
```

**Arquitetura de estilos híbrida:**
- `src/main.jsx`: inline styles com variáveis de tema (BG, CARD, TEXT, etc.) para a maioria dos componentes
- `src/components/ui/`: componentes shadcn com Tailwind classes (Button, Card, Dialog, Select, etc.)
- Quando adicionar novos componentes UI reutilizáveis: usar shadcn. Para lógica e views específicas: inline styles.

---

## Arquivos críticos

| Arquivo | Papel |
|---|---|
| `src/main.jsx` | UI React principal (~5900+ linhas) — lógica de negócio e a maioria das views |
| `src/index.css` | Tailwind v4 + shadcn tokens + animações CSS |
| `src/components/ui/` | 21 componentes shadcn/ui (Button, Card, Dialog, Select, Tabs, etc.) |
| `src/lib/utils.js` | cn() utility — combina clsx + tailwind-merge |
| `appscript.gs` | Backend Google Apps Script — doGet, doPost, triggers, helpers |
| `api/action.js` | Proxy Vercel → GAS (POST). GAS_URL hardcoded neste arquivo. |
| `api/whatsapp.js` | Webhook Evolution API — recebe e envia mensagens WhatsApp |
| `api/efi-charges.js` | Geração de cobranças PIX com vencimento (cobv) na Efí Bank |
| `api/efi-auth.js` | OAuth2 Efí Bank |
| `api/webhook-efi.js` | Webhook de confirmação de pagamento Efí |
| `api/login.js` | Autenticação por senha (cookie `fp_session`) |
| `api/logout.js` | Limpa cookie de sessão |
| `api/efi-pix-avulso.js` | Geração de PIX avulso por parcela (usado pela régua de cobrança no GAS) |
| `api/efi-setup-webhook.js` | Registra/renova URL do webhook PIX na Efí Bank. Sempre deployado. Auth via `x-cobranca-secret`. Chamado automaticamente pelo GAS toda segunda-feira via `_reRegistrarWebhookEfi()`. Manual: menu GAS → "PIX: Re-registrar Webhook Efí" |
| `api/cert.js` | Página HTML pública (fora do React) do certificado de quitação — serve `/c/:code`, chama a action `buscarCertificado` no GAS |
| `middleware.js` | Protege todas as rotas exceto /api/login, /api/whatsapp, /api/webhook-efi, /api/efi-check-payments, /api/efi-pix-avulso, /api/efi-setup-webhook, /api/cert e /c/ (matcher em `middleware.js`; /api/logout tem early-return próprio dentro da função) |
| `vercel.json` | Rewrite: `/api/sheets` → GAS doGet URL; `/c/:code` → `/api/cert?c=:code` |

**GAS Web App URL** (mesma em `api/action.js` e `vercel.json`):
```
https://script.google.com/macros/s/AKfycbynQKpafDbaBTT-jqs4nCSzbbx8A72MAqDyGxwy86lIt0ykZxeFT8IdlO7zjj0rJEHy7Q/exec
```

---

## Regras de deploy — SEMPRE seguir

### Fluxo obrigatório antes de qualquer deploy

**Nunca rodar `vercel deploy --prod` sem antes executar o review correspondente:**

| Tipo de mudança | Review obrigatório | Depois |
|---|---|---|
| UI, texto, cor, estilo | `Skill("quickreview")` | deploy |
| Nova funcionalidade, novo componente, nova rota | `Skill("review")` | deploy |
| GAS, cálculo financeiro, integração, schema | `Skill("ultrareview-financeiroop")` | deploy |

Se o review retornar item CRÍTICO ou BLOQUEANTE → **corrigir antes de deployar**.

### Após editar `src/main.jsx` ou qualquer arquivo em `api/`:
```bash
vercel deploy --prod
```
Executar via Bash após o review correspondente acima. Não esperar o usuário pedir.

**Limite Vercel Hobby: 12 Serverless Functions.** Arquivo excluído via `.vercelignore`: `api/efi-test-webhook.js` (utilitário de dev). `api/efi-setup-webhook.js` está deployado permanentemente (necessário para auto-renovação do webhook Efí). Ao adicionar novo arquivo em `api/`, verificar se ultrapassa o limite — se sim, avaliar se algum arquivo existente pode ser excluído do deploy.

### Após editar `appscript.gs`:
```bash
open -a "TextEdit" /Users/alexborges/financeiroop/appscript.gs
```
Depois instruir o usuário: **Cmd+A → Cmd+C → colar no editor do Google Apps Script → publicar nova versão do Web App**. Fazer isso automaticamente, sem esperar o usuário pedir. NUNCA entregar só o trecho alterado — o GAS exige substituição do arquivo completo.

---

## Protocolo de Verificação Pós-Implementação

Aplicável a **toda** mudança — código, GAS, configuração, design, fluxo. Selecionar o tier pelo tipo de mudança, não pelo tamanho.

**Slash commands disponíveis** (atalhos para os tiers):
- `/quickreview` → Tier 1 (5 min)
- `/review` → Tier 2 (15 min)
- `/ultrareview-financeiroop` → Tier 3 completo (30–45 min) — usar antes de deploys importantes, não semanalmente

### Como classificar o tier

| Tier | Slash command | Quando usar | Exemplos |
|---|---|---|---|
| **1 — Quick** | `/quickreview` | UI apenas: texto, label, cor, estilo, tooltip | Mudar texto de botão, ajustar cor, corrigir typo |
| **2 — Standard** | `/review` | Lógica frontend, novo componente, nova rota API sem cálculo financeiro | Novo modal, novo filtro, nova aba, refactor de componente |
| **3 — Full** | `/ultrareview-financeiroop` | GAS, cálculo financeiro, schema do Sheets, integrações, status/transições | Qualquer mudança em `appscript.gs`, novo campo no Sheets, PIX, webhooks, score |

---

### Tier 1 — Quick

```
☐ 1. Deploy → vercel deploy --prod
☐ 2. Abrir app no browser (skill browser)
☐ 3. Verificar que o elemento alterado renderiza correto
☐ 4. Confirmar: sem erros de console JavaScript
```

Tempo estimado: 5–10 min.

---

### Tier 2 — Standard

```
☐ 1. Antes do código:
   ☐ Identificar funcionalidades adjacentes que podem ter sido afetadas
   ☐ Se tocou em _ST_ATIVOS ou _ST_TERMINAL: confirmar que não foram redefinidos localmente

☐ 2. Deploy → vercel deploy --prod

☐ 3. Testar no browser (skill browser):
   ☐ Happy path da funcionalidade nova
   ☐ Cenário de dado inválido / campo vazio
   ☐ Testar cada funcionalidade adjacente identificada no passo 1
   ☐ Sem erros de console

☐ 4. Documentação (somente se estrutura ou fluxo mudou):
   ☐ CLAUDE.md > "Bugs conhecidos" — adicionar se bug novo foi descoberto e corrigido
   ☐ docs/ai-memory/07-AI-KNOWN-ISSUES.md — espelhar o mesmo bug se relevante para futuras sessões
```

Tempo estimado: 20–30 min.

---

### Tier 3 — Full

```
☐ 1. Antes do código:
   ☐ Identificar todas as abas do Sheets tocadas
   ☐ Identificar todos os fluxos de negócio que passam por essa lógica
   ☐ Verificar se backfill em dados existentes é necessário (novo campo = backfill obrigatório)

☐ 2. Checklist de integridade GAS (se appscript.gs foi editado):
   ☐ Datas usam parseDateLocal — nunca new Date("YYYY-MM-DD")
   ☐ Colunas lidas via buildColMap / setCel — nunca índice fixo
   ☐ STATUS_TERMINAL global (linha ~27) — nunca redefinido localmente como var TERMINAL={} ou var ST_FIM={}
   ☐ Status terminais não são reabertos em nenhum caminho

☐ 3. Checklist financeiro (se cálculo foi alterado):
   ☐ Juros: base × taxa × dias / 30 — confirmar fórmula inalterada
   ☐ Multa: 2% do principal (cobrada via PIX Efí Bank no campo `multa.valor`), uma vez por contrato, após carência
   ☐ VALOR_PAGO = principal + max(0, juros − desconto)
   ☐ FEE_PRORROGACAO e RECEITA_EXTRA_ATRASO são campos separados — nunca somar ao mesmo destino
   ☐ somente_juros: máx 2 por contrato (TOTAL_SOMENTE_JUROS)

☐ 4. Deploy → vercel deploy --prod

☐ 5. Testar no browser (skill browser) — fluxos críticos afetados:
   ☐ Registrar pagamento → parcela some de "Em Atraso" → EVENTOS registrado
   ☐ Criar contrato → parcelas geradas → datas corretas (sem UTC -1 dia)
   ☐ KPIs do Dashboard refletem o estado correto
   ☐ Integração afetada (Efí / Evolution / ZapSign / Forms) — testar o fluxo completo
   ☐ Sem erros de console

☐ 6. Documentação (obrigatório no Tier 3):
   ☐ CLAUDE.md > "Bugs conhecidos" — adicionar bug + causa + solução se aplicável
   ☐ docs/ai-memory/07-AI-KNOWN-ISSUES.md — espelhar
   ☐ MANUAL_OPERACIONAL.md — atualizar SOMENTE se estrutura de dados ou fluxo operacional mudou
   ☐ docs/ai-memory/02-AI-CREDIT-RULES.md — atualizar SOMENTE se regras de crédito/score mudaram
   ☐ docs/ai-memory/03-AI-FINANCIAL-CALCULATIONS.md — atualizar SOMENTE se cálculos mudaram
   ☐ CLAUDE.md > seção relevante — atualizar se padrão ou convenção mudou
```

Tempo estimado: 45–90 min.

---

### Critérios de rollback

Reverter imediatamente (sem aguardar instrução) se:
- Sistema não carrega ou autenticação quebrada
- Cálculo financeiro produz valor errado (juros, multa, VALOR_PAGO)
- Dado perdido no Sheets (linha deletada, coluna zerada indevidamente)
- Integração crítica quebrada (Efí Bank não gera PIX, webhook não processa pagamento)

Não reverter automaticamente — documentar e aguardar instrução se:
- Bug visual sem impacto financeiro
- Feature nova com comportamento inesperado mas sem perda de dado
- Performance degradada sem indisponibilidade

---

## Abas do Google Sheets (banco de dados)

| Aba | Função |
|---|---|
| `CLIENTES` | Cadastro completo dos clientes |
| `CONTRATOS` | Um registro por contrato |
| `PARCELAS` | Uma linha por parcela de cada contrato |
| `PAGAMENTOS` | Registro de cada pagamento efetuado |
| `PROMESSAS` | Acordos/promessas de pagamento com data prevista |
| `EVENTOS` | Log de todas as ações do sistema |
| `CONFIGURACOES` | Parâmetros globais (taxa padrão, limites, etc.) |
| `ACORDOS` | Registros de acordos formais |
| `MENSAGENS` | Log de disparos da régua de cobrança WhatsApp + confirmações de pagamento (`GATILHO = "CONFIRMACAO_PAGAMENTO"`) |
| `UNDO_LOG` | Motor de undo — operações reversíveis por até 15 min (`registrarUndo`/`reverterOperacao`) |
| `QUITACOES` | Propostas de quitação antecipada via PIX (`gerarPropostaQuitacaoPix`) — expira em 48h |
| `CERTIFICADOS` | Certificados públicos de quitação (`gerarCertificadoQuitacao`/`buscarCertificadoPublico`) |
| `AUDITORIA` | Log da auditoria automática diária de integridade (`auditarIntegridadeSistema`) — criada sob demanda, não faz parte de `ABAS` |
| `OPERACOES_PROCESSADAS` | Log de idempotência (`_idem_check`/`_idem_reg`) — evita processar o mesmo webhook 2x. Criada sob demanda, não faz parte de `ABAS` |

---

## Padrões do GAS (`appscript.gs`)

```javascript
// Mapa dinâmico de colunas — nunca usar índice fixo
var cm = buildColMap(sheet);

// Escrever por nome de coluna
setCel(sheet, row, cm, "NOME_COLUNA", value);

// IDs sequenciais
var id = proximoIdSeq(sheet, "PAG"); // → PAG00001

// Datas sem bug de timezone (UTC-3)
// SEMPRE usar parseDateLocal — new Date("2026-05-30") dá dia 29 no Brasil
function parseDateLocal(s) {
  var p = String(s || "").split(/[\/\-T ]/);
  if (p.length >= 3 && p[0].length === 4)
    return new Date(parseInt(p[0]), parseInt(p[1]) - 1, parseInt(p[2]), 12, 0, 0);
  return new Date(s);
}

// Status terminais de parcela (nunca reabrir)
// pago | quitacao_antecipada | baixado_como_prejuizo | cancelado | renegociado
// Global: STATUS_TERMINAL (linha ~27) — NUNCA redefinir localmente como var TERMINAL={} ou var ST_FIM={}
```

**Trigger diário** — 7h: `atualizarStatusParcelas()` + `atualizarStatusContratos()`

**Exclusão física de contrato** — `excluirContrato(idContrato)`:
- Bloqueia se há PAGAMENTOS registrados no contrato
- Deleta linha de CONTRATOS (`deleteRow`)
- Deleta linhas de PARCELAS bottom-up (loop reverso)
- Deleta linhas de EVENTOS vinculados ao contrato
- Deleta linhas de PROMESSAS vinculadas ao contrato
- Nenhum `registrarEvento` — contrato some sem rastros
- **Nunca** marcar como "cancelado" — deleção é irrevogável

**novoContrato + gerarDoc separados**:
- `action:"novoContrato"` → cria contrato + parcelas + retorna `idContrato` (sem gerar doc)
- `action:"gerarDoc"` → chama `gerarDocContrato()` separadamente (Google Docs)
- Frontend: sucesso em ~1-2s, botões de doc aparecem assincronamente quando prontos

**Sanitizadores** disponíveis no GAS:
```javascript
_sanitNome(s)   // título case + remove dígitos
_soDigitos(s)   // só números
_soLetras(s)    // só letras
_emailFix(s)    // lowercase + remove espaços
```

**CONFIGURACOES — leitura e escrita:**
```javascript
// Ler chave do Sheets
_getCfg("CHAVE")           // retorna valor ou "" se não encontrado

// Escrever chave (cria se não existir)
_setCfg("CHAVE", valor)    // atualiza linha existente ou appenda nova linha
```

**Templates da régua — carregados do CONFIGURACOES:**
```javascript
buscarTemplatesRegua()           // retorna objeto com todos os TEMPLATE_* do CONFIGURACOES
                                 // fallback para _MSG_TEMPLATES hardcoded se chave ausente
salvarTemplateRegua(templates)   // persiste cada chave como TEMPLATE_<gatilho> no CONFIGURACOES
```
Chaves: `TEMPLATE_D-5`, `TEMPLATE_D-1`, `TEMPLATE_D0`, `TEMPLATE_D+1`, `TEMPLATE_D+3`, `TEMPLATE_D+7`, `TEMPLATE_PROMESSA_D-1`, `TEMPLATE_PROMESSA_D0`, `TEMPLATE_PROMESSA_D+1`, `TEMPLATE_CONFIRMACAO`, `TEMPLATE_CERTIFICADO_QUITACAO`

`_garantirConfigsRegua()` — chamada no início de `enviarReguaCobranca` — popula todas as chaves TEMPLATE_* no CONFIGURACOES se ainda não existirem.

**Gap conhecido:** `TemplatesReguaModal` (`main.jsx`) tem `LABELS`/`ORDEM` hardcoded com só 10 chaves — `CERTIFICADO_QUITACAO` existe no backend (`_MSG_TEMPLATES`, `_garantirConfigsRegua`, `buscarTemplatesRegua`) mas não aparece na UI. Pra editar o texto desse template hoje só mexendo direto na aba CONFIGURACOES (`TEMPLATE_CERTIFICADO_QUITACAO`).

**Confirmação automática de pagamento:**
```javascript
// Chamado ao final de registrarPagamentoAPI (cobre pagamentos manuais E webhook Efí)
_enviarConfirmacaoPagamento({idParcela, idContrato, idCliente, nomeCliente, numParcela, totalParcelas, vlPago})

// Cancela PROMESSAS PENDENTE do contrato (status → "CUMPRIDA")
_cancelarPromessasPorContrato(idContrato)
```
- Dedup: checa MENSAGENS por `GATILHO="CONFIRMACAO_PAGAMENTO"` + `ID_PARCELA` + `STATUS_ENVIO="ENVIADO"` — nunca reenvia
- Template: `TEMPLATE_CONFIRMACAO` do CONFIGURACOES; variáveis: `{NOME}`, `{NUM_PARCELA}`, `{TOTAL_PARCELAS}`, `{VALOR_PAGO}`, `{PARCELAS_RESTANTES}`, `{PROXIMO_VENCIMENTO}`
- Log em MENSAGENS com `GATILHO = "CONFIRMACAO_PAGAMENTO"`

**Funções de manutenção do banco (menu GAS "Manutenção"):**
```javascript
recalcularTodasMetricas()        // reconstrói métricas de todos os clientes (LUCRO_TOTAL, TOTAL_PAGO, CONTRATOS_ATIVOS, etc.)
renumerarPagamentos()            // renumera PAG00001..N com lock atômico (pede confirmação)
garantirColunasAcordoAssistido() // cria colunas ACORDO_ASSISTIDO ausentes em CONTRATOS
backfillReceitaExtraAtraso()     // copia DIFERENCA_RECEBIDA → RECEITA_EXTRA_ATRASO nos registros históricos
backfillTotalSomenteJuros()      // popula TOTAL_SOMENTE_JUROS em CONTRATOS contando pagamentos somente_juros (rodar 1x após deploy)
diagnosticarLegado()             // READ-ONLY: conta valores legado; confirma "banco limpo" se tudo zero
normalizarTipoPagamento()        // migra valores curtos (normal, com_atraso, antecipado) para formas longas
normalizarStatusParcela()        // migra variantes legado (paga, quitado, baixado) para valores canônicos
```

**Campos CLIENTES calculados por `calcularMetricasCliente`:**
- `TOTAL_EMPRESTADO` — soma de VALOR_PRINCIPAL dos contratos do cliente
- `TOTAL_PAGO` — soma de VALOR_PAGO dos pagamentos (exceto abatimento_acordo_assistido)
- `CONTRATOS_ATIVOS` — contratos com status em `_ST_ATIVO_C`
- `CONTRATOS_BAIXADOS` — contratos com status em `_ST_BAIXADO_C`
- `LUCRO_TOTAL` — soma de juros recebidos
- `PREJUIZO_TOTAL` — soma de prejuízo líquido declarado

**Campos de higienização cadastral em CLIENTES (adicionados 2026-06-20 — Sprint 1/1.5/3):**
- `CNPJ_EMPREGADOR` — CNPJ do empregador (preenchido via lookup BrasilAPI no ClienteModal)
- `SITUACAO_EMPREGADOR` — situação cadastral: "ATIVA", "INAPTA", etc. (impacta score: -5 pts se não ATIVA)
- `DATA_ABERTURA_EMPREGADOR` — data de abertura da empresa (impacta score: +2 pts se 5+ anos)
- `CODIGO_IBGE` — código IBGE do município (preenchido via ViaCEP junto com o endereço)
- Criar colunas: menu GAS → "Criar Colunas Empregador CNPJ (rodar 1x)" → `_garantirColunasEmpregadorClientes()`

**Campos PAROU de gravar (evitar em código novo):**
- `DIFERENCA_RECEBIDA` — campo legado em PAGAMENTOS; use `RECEITA_EXTRA_ATRASO`
- `LUCRO_JUROS` — campo legado em CLIENTES; duplicata de `LUCRO_TOTAL`

**Campo `FEE_PRORROGACAO` em PAGAMENTOS (adicionado 2026-06-19):**
- Registra o fee de 5% do principal cobrado em pagamentos `somente_juros`
- **Separado de `RECEITA_EXTRA_ATRASO`**: RECEITA_EXTRA_ATRASO = mora/multa de atraso real; FEE_PRORROGACAO = custo da prorrogação
- Backward compat: registros antigos têm fee em RECEITA_EXTRA_ATRASO (FEE_PRORROGACAO = 0). Somas financeiras usam `RECEITA_EXTRA_ATRASO + FEE_PRORROGACAO` para cobrir ambos

**Campo `TOTAL_SOMENTE_JUROS` em CONTRATOS:**
- Contador de quantas vezes o contrato usou `somente_juros` (máx 2)
- Incrementado em `registrarPagamentoParcial`, decrementado em `reabrirParcelaAPI`
- Visível no ContratoModal como badge "X/2 prorrogações" (amarelo=1, vermelho=2)

**Módulo Recuperação Judicial (2026-07-04):** `em_processo_judicial` não é status final — é o início de uma fase com duas dimensões independentes: `STATUS_PROCESSO` (situação processual, já existia) e `SITUACAO_FINANCEIRA_JUDICIAL` (situação financeira, novo). Só vira o status terminal `encerrado_judicialmente` quando resolvido. Ações disponíveis:
```javascript
registrarAcordoJudicial(idContrato, dados)      // acordo parcelado (gera PARCELAS ORIGEM_PARCELA="acordo_judicial") ou à vista
registrarQuitacaoJudicial(idContrato, dados)    // quitação em uma parcela única
arquivarProcessoJudicial(idContrato, dados)     // encerra o processo; sem recuperação total → PERDA_JUDICIAL_DEFINITIVA
_alocarRecuperacaoJudicial(...)                 // cascata: custo do credor → principal → lucro → reembolso ao devedor
```
Pagamento de parcela `acordo_judicial` passa pelo `registrarPagamentoAPI` normal (auto-detecta `ORIGEM_PARCELA`) — não tem action própria. `CLIENTE_JUDICIALIZADO` nunca é limpo (bloqueio permanente, validado em `criarContrato`). Detalhes completos em `docs/ai-memory/02-AI-CREDIT-RULES.md` e `03-AI-FINANCIAL-CALCULATIONS.md`.

**Motor de Undo (15 min) — compensating transactions:**
```javascript
registrarUndo(tipo, idContrato, idCliente, nomeCli, payload)  // chamar logo após qualquer operação reversível
reverterOperacao(idUndo, motivo)                              // desfaz — dispatch por TIPO_OPERACAO
listarUndosAtivos(idContrato)                                 // undos ATIVO e dentro do TTL, com segundosRestantes
expirarUndosAntigos()                                         // marca EXPIRADO os que passaram de 15 min (rodar via trigger/rotina)
```
- Tipos suportados hoje: `PAGAMENTO_NORMAL`, `SOMENTE_JUROS`, `QUITACAO_ANTECIPADA`, `ACORDO_COM_PERDA`, `RECUPERACAO_APOS_BAIXA`, `ABATIMENTO_ASSISTIDO`, `BAIXA_PREJUIZO` — cada um com handler `_reverter*` próprio em `appscript.gs`
- `reverterOperacao` bloqueia se: status não é `ATIVO`, TTL de 15 min estourou, ou existe operação **mais recente** no mesmo contrato ainda ativa (força reverter na ordem inversa)
- Todo `_reverter*` grava evento `UNDO_REVERTIDO` em EVENTOS e recalcula score/métricas do cliente quando aplicável
- **Ainda sem entrada no frontend** — só é acionável chamando a action correspondente direto na API; não existe botão "Desfazer" no `main.jsx`

**Idempotência — proteção contra webhook duplicado:**
```javascript
_idem_check(chave)              // true se a chave já foi PROCESSADO
_idem_reg(chave, tipo, meta)     // registra chave como PROCESSADO
_idem_registrar_tentativa_dupla(chave, tipo)  // loga tentativa bloqueada (não impede o fluxo, só audita)
```
- Hoje só protege os dois webhooks Efí: pagamento normal (`WEBHOOK_EFI_<txid>`) e quitação antecipada (`QUIT_<txid>`, com sufixo `R1`/`R2` de retry removido antes de checar)
- Chave incorreta quebra a proteção silenciosamente — sempre usar prefixo fixo + txid, nunca só o txid

**Auditoria automática de integridade (diária, 07:05):**
```javascript
auditarIntegridadeSistema()      // varre CLIENTES/CONTRATOS/PARCELAS/PAGAMENTOS/PROMESSAS/EVENTOS/OPERACOES_PROCESSADAS
configurarTriggerAuditoria()     // registra o trigger diário (rodar 1x manual)
```
- Verifica: relacionamentos órfãos, parcela/status inconsistente com PAGAMENTOS, duplicidade de pagamento (mesma parcela+data+valor), TXID Efí duplicado, promessa órfã/inconsistente, `VALOR_TOTAL`/`JUROS_TOTAL` do contrato divergente da soma das parcelas, `TOTAL_PAGO`/`CONTRATOS_ATIVOS` do cliente divergente do real, chave de idempotência duplicada
- Gera **score de 0–100** (desconta por severidade CRITICO/ALTO/MEDIO/BAIXO) e grava tudo na aba `AUDITORIA` com marcador de início/fim de sessão
- Não corrige nada automaticamente — é só diagnóstico (`AUTO_CORRIGIDO` sempre "NAO" hoje)

**Backup automático (diário, 2h):**
```javascript
fazerBackupAutomatico()     // copia a planilha inteira para pasta "FinanceiroOp Backups" no Drive, mantém só as últimas 30
configurarTriggerBackup()   // registra o trigger diário (rodar 1x manual)
```

---

## Padrões do frontend (`src/main.jsx`)

> **Design system completo em `DESIGN_SYSTEM.md`** — paleta canônica, botões, tokens, gradientes. Leia antes de qualquer alteração de UI.

### Padrão de timing — comprovante PDF
O `hist` (parcelas do contrato) pode estar em dois estados ao gerar o PDF:
- **Pré-pagamento**: gerado imediatamente após registrar, antes do `carregar()`. Parcela ainda não tem `TIPO_PAGAMENTO` atualizado.
- **Pós-pagamento**: gerado via Financeiro, ContratoModal etc., depois do `carregar()`. Parcela já marcada.

Detectar o estado antes de derivar totais/contagens:
```javascript
const currentInHist = hist.find(p => p.ID_PARCELA === parcela.ID_PARCELA);
const isAlreadyProcessed = isSomenteJuros && !!currentInHist && currentInHist.TIPO_PAGAMENTO === "somente_juros";
const totalParcEfetivo = (isSomenteJuros && !isAlreadyProcessed) ? hist.length + 1 : hist.length;
```

### Funções utilitárias importantes
```javascript
postAction(body)          // POST para /api/action → GAS doPost
statusEfetivo(parcela)    // calcula status real pela data (não pelo valor gravado)
parseDate(s)              // parse de datas do Sheets
fmtR(valor)               // formata valor em R$
fmtDt(data)               // formata data pt-BR
hojeStr()                 // data de hoje no formato YYYY-MM-DD
apiDateStr(s)             // converte input date → YYYY-MM-DD para o GAS
calcProxVenc(diaVenc)     // próximo vencimento = sempre mês seguinte ao dia preferido
ajustarDiaUtil(dateStr, feriadosSet)  // avança data para próximo dia útil (pula fins de semana + feriados nacionais)
buscarCEP(cep)            // ViaCEP first + BrasilAPI + AwesomeAPI fallback; retorna {status, rua, setor, cidadeEstado, ibge, lat?, lng?}
buscarCNPJ(cnpj)          // chama /api/utils?t=cnpj (proxy BrasilAPI+ReceitaWS); retorna {status, razaoSocial, situacao, dataAbertura, porte}
titleCasePT(s)            // title case respeitando preposições PT (de, da, do, dos, das, e...)
normTel(s)                // normaliza telefone: remove não-dígitos, 10→11 dígitos (add 9)
fixEmail(s)               // lowercase + corrige @gmail.com.br → @gmail.com
```

### Constantes de status globais — NUNCA redefinir localmente
```javascript
// main.jsx linha ~67 — parcelas terminais
const _ST_TERMINAL = new Set([
  "pago", "quitacao_antecipada", "baixado_como_prejuizo", "cancelado", "renegociado"
]);

// main.jsx linha ~69 — contratos ativos (Dashboard, Gestão, M useMemo, PagamentoDrop, etc.)
const _ST_ATIVOS = new Set([
  "ativo","ativo_em_dia","ativo_em_atraso","em_cobranca","pre_prejuizo",
  "renegociado","em_recuperacao","recuperado_parcialmente","acordo_assistido"
]);
// Usar: _ST_ATIVOS.has(String(c.STATUS_CONTRATO||"").toLowerCase())
// Nunca: const ST_ATIVOS_G=[...] / const ST_ATIVOS_PAG=new Set([...])

// main.jsx — contratos em Recuperação Judicial (bucket próprio, NUNCA "ativo")
const _ST_JUDICIAL = new Set(["em_processo_judicial"]);
// Status terminal da fase judicial: "encerrado_judicialmente" (único — detalhe do
// resultado fica em SITUACAO_FINANCEIRA_JUDICIAL, nunca reviva recuperado_parcialmente/em_recuperacao)
```

### STATUS_PROMESSA — sempre UPPERCASE no Sheets
```javascript
// Valores reais: "PENDENTE" | "CUMPRIDA" | "QUEBRADA"
// CORRETO (whitelist explícita):
.filter(p => String(p.STATUS_PROMESSA||"").toUpperCase() === "PENDENTE")
// ERRADO (lowercase exclusion inclui QUEBRADA indevidamente):
.filter(p => !["cumprida","cancelada"].includes(...))
```

### Componente `CampoEdit`
```jsx
// Suporta prop fixup: função aplicada no onBlur
<CampoEdit
  field="NOME"
  edit={edit}
  setEdit={setEdit}
  erros={erros}
  fixup={titleCasePT}   // auto-corrige ao sair do campo
/>
```

### Auto-correções nos campos do ClienteModal
- Nome/contatos: `titleCasePT` no blur
- Telefones: `normTel` no blur (remove não-dígitos, 10→11 add 9 após DDD)
- Email: `fixEmail` no blur (@gmail.com.br → @gmail.com)
- Observações: limpa texto padrão "Cadastro via formulario..." SOMENTE na primeira aprovação (`STATUS_CLIENTE === "aguardando_conferencia"`) — lógica no `salvar`, não no blur

### Optimistic UI — padrão de escrita
Após qualquer write bem-sucedido, atualizar `setRaw` localmente antes de fechar o modal. `carregar()` roda em background para sincronizar.

```javascript
// Padrão: setRaw imediato → modal fecha → carregar() em background
onOptimisticUpdate={(campos, idCliente) => {
  setRaw(prev => ({
    ...prev,
    CLIENTES: (prev.CLIENTES||[]).map(c =>
      String(c.ID_CLIENTE) === String(idCliente) ? {...c, ...campos} : c
    )
  }));
  carregar();
}}
// Para exclusão: usar .filter() em vez de .map()
// Para pagamento: .map() substituindo parcela com STATUS:"pago"
```

Fluxos com optimistic UI implementados: salvar cliente, registrar pagamento, excluir contrato.

### AbortController em `carregar()`
```javascript
const _abortCtrl = useRef(null);
// ao iniciar novo fetch:
if (_abortCtrl.current) _abortCtrl.current.abort();
const ctrl = new AbortController();
_abortCtrl.current = ctrl;
fetch(API_URL, {signal: ctrl.signal})...
// AbortError é silencioso (não reseta loading)
// cleanup no unmount: useEffect(()=>()=>{if(_abortCtrl.current)_abortCtrl.current.abort();},[])
```

### TTL no cache localStorage (5 minutos)
```javascript
const CACHE_TTL = 5 * 60 * 1000;
// salva: {data: d, ts: Date.now()}
// carrega: entry?.data ?? entry  ← suporta formato antigo (sem ts)
// cache fresco (< 5min) → usa sem fetch
// cache velho → usa para exibir + dispara carregar() em background
```

### Desconto nos Juros — campo nos modais de pagamento
Campo "Desconto nos Juros (R$)" aparece somente quando:
- Tipo de pagamento = "Pagamento Total"
- Parcela tem `VALOR_JUROS > 0`

Regras:
- Limitado ao valor máximo de `VALOR_JUROS` (nunca desconta no principal)
- `VALOR_PAGO` = `Principal + max(0, Juros − Desconto)`
- `TIPO_PAGAMENTO` não muda — `DESCONTO_APLICADO` é campo separado na aba PARCELAS
- Implementado nos 3 pontos: `PagamentoDrop` (Dashboard), `PagamentoParcelaModal` simples (ContratoModal), `PagamentoParcelaModal` complexo (Cobrança)

---

## Integrações externas

### APIs de higienização cadastral (Sprint 1/1.5/2/3/4/5 — 2026-06-20)

**CEP (`buscarCEP`):**
- ViaCEP: `https://viacep.com.br/ws/{cep}/json/` (browser direto — suporta CORS)
- Fallback BrasilAPI: `https://brasilapi.com.br/api/cep/v1/{cep}` (browser direto)
- Fallback AwesomeAPI: `https://cep.awesomeapi.com.br/json/{cep}` (browser direto — retorna `lat`/`lng`)
- Preenche: `RUA`, `SETOR`, `CIDADE_ESTADO`, `CODIGO_IBGE`
- CEP inválido bloqueia save (via `cepStatus === "not_found"` → `erros.CEP`)

**Geocoding (`buscarCoordenadas`):**
- AwesomeAPI retorna `lat`/`lng` diretamente quando é o fallback — sem chamada extra ao Nominatim
- Nominatim: `https://nominatim.openstreetmap.org/search?format=json&limit=1&countrycodes=br&q={query}` (browser direto, CORS OK, Referer identifica o app)
- Preenche: `LATITUDE`, `LONGITUDE` no `edit` do ClienteModal (fire-and-forget após CEP fill)
- Indicador visual "📍 Geolocalizado" abaixo do campo CEP quando encontrado

**CNPJ (`buscarCNPJ`):**
- Proxy Vercel `api/utils.js?t=cnpj&cnpj=...` (BrasilAPI primeiro + ReceitaWS fallback — CORS bloqueado no browser)
- Preenche: `CNPJ_EMPREGADOR`, `SITUACAO_EMPREGADOR`, `DATA_ABERTURA_EMPREGADOR`
- Dados usados em `calcularScore` GAS (-5 pts situação não ATIVA, +2 pts ≥5 anos)

**Feriados (`api/utils.js?t=feriados`):**
- Nager.Date: `https://date.nager.at/api/v3/PublicHolidays/{ano}/BR` (ano atual + próximo)
- Cache Vercel: `Cache-Control: public, max-age=86400`
- Usado por `ajustarDiaUtil` em `NovoContrato` para pular fins de semana + feriados no 1º Vencimento

### Efí Bank (PIX)
- **Tipo**: `cobv` (cobrança com vencimento)
- **Credenciais** (env Vercel): `EFI_CLIENT_ID`, `EFI_CLIENT_SECRET`, `EFI_PIX_KEY`
- **Certificado**: `producao-849675-financeiroop.p12` (raiz do repo)
- **Ambiente**: produção (`sandbox: false`)
- CPF deve ter sempre 11 dígitos com `padStart(11, "0")`
- **Webhook URL**: `https://financeiroop.vercel.app/api/webhook-efi?sk=<EFI_WEBHOOK_SECRET>` — registrada na Efí Bank via `api/efi-setup-webhook.js`
- **IMPORTANTE — A Efí Bank NÃO tem painel para configurar webhook.** A URL é registrada via API (PUT /v2/webhook/{chave}). A Efí Bank perde o registro periodicamente.
- **Auto-renovação**: GAS re-registra toda segunda-feira às 7h via `_reRegistrarWebhookEfi()` na `rotinaDiaria`
- **Re-registro manual**: menu GAS → "PIX: Re-registrar Webhook Efí" (ou rodar `reRegistrarWebhookEfiManual()`)
- **Fallback pagamentos perdidos**: se webhook ficou quebrado por algum período, rodar `verificarPagamentosEfi()` no GAS — faz polling de todos os TXIDs e registra os CONCLUÍDOS

**Quitação antecipada via PIX:**
```javascript
gerarPropostaQuitacaoPix(dados)   // calcula principal+juros das parcelas selecionadas, aplica desconto (limitado ao total de juros), grava em QUITACOES, expira em 48h
salvarPixQuitacao(dados)          // grava o copia-e-cola gerado pela Efí na proposta
cancelarPropostaQuitacao(dados)   // status → CANCELADO
pagamentoQuitacaoWebhook(txid, valor, data)  // recebido via webhook Efí — protegido por idempotência (chave QUIT_<txidBase>, remove sufixo R1/R2), chama registrarQuitacaoAntecipada e envia confirmação WPP
verificarQuitacoesExpiradas()     // marca EXPIRADO propostas PENDENTE vencidas — rodar via rotina
```
- Se já existe proposta `PENDENTE` para o contrato, `gerarPropostaQuitacaoPix` retorna ela (não duplica)
- TXID fixo por contrato: `_txidQuitacao(idContrato)` = `FOQT<idContrato zero-padded>Q00001`

**Certificado de quitação (link público):**
```javascript
gerarCertificadoQuitacao(params)   // grava em CERTIFICADOS com CODIGO_VALIDACAO único (CERT-<ano>-<uuid>); dedup — contrato com certificado "ativo" retorna o mesmo link
buscarCertificadoPublico(codigo)   // usado pela rota pública (sem auth) — retorna CPF mascarado (***.XXX.XXX-XX), nunca o completo
_gerarEEnviarCertificado(idContrato, idCliente, nomeCliente, datPagamento)  // gera + dispara WhatsApp com o link — chamado automaticamente ao final de registrarQuitacaoAntecipada/registrarPagamentoAPI quando o contrato quita; não tem botão próprio no frontend
```
- Link público: `vercel.json` reescreve `/c/:code` → `api/cert.js?c=:code` (página HTML server-side própria, fora do React — chama a action `buscarCertificado` no GAS)
- Envio WPP deduplicado por `GATILHO="CERTIFICADO_QUITACAO"` em MENSAGENS — nunca reenvia pro mesmo contrato

### ZapSign (assinatura eletrônica)
- **Token**: hardcoded em `appscript.gs` linha ~16 (`ZAPSIGN_TOKEN`)
- **Ambiente**: produção (`sandbox: false`)
- Fluxo: exporta contrato Google Docs como PDF → envia para ZapSign → retorna link de assinatura do credor

### Google Forms (cadastro de clientes)
- Trigger `onFormSubmit` no GAS processa o formulário e cria linha em CLIENTES
- Títulos EXATOS das perguntas (o `v()` normaliza trim+lowercase+acento como fallback, mas manter os títulos corretos):
  - `"Nome Completo"`, `"CPF (somente numeros)"`, `"RG (somente numeros)"`
  - `"WhatsApp com DDD (Somente números)"`, `"E-mail (tudo minúsculo)"`
  - `"Nome de Pessoa de confiança 1"`, `"Telefone de Pessoa de confiança 1"`
  - `"Nome de Pessoa de confiança 2"`, `"Telefone de Pessoa de confiança 2"`
  - `"Digite aqui a Data de vencimento da primeira parcela. Do dia 01 ao dia 31 (ex:  05,  08, 10, 20)"` (campo TEXTO, retorna número 1–31)
  - `"Nome da pessoa que te indicou nossos serviços"` (padrinho)
- NUMERO, QUADRA, LOTE **não usam `_soDigitos`** — clientes digitam "Sem Número" / "Não consta" e o sanitizador apagaria o valor
- Status inicial do cliente: `aguardando_conferencia`
- TEL_PADRINHO: lookup automático no CLIENTES por nome fuzzy (normaliza acentos, busca substring)

### Autenticação
- Cookie `fp_session` = HMAC-SHA256 da senha com `LOGIN_SECRET`
- Env vars Vercel: `LOGIN_PASSWORD`, `LOGIN_SECRET`
- Sessão dura 30 dias

### Evolution GO API (WhatsApp)
- **Versão**: Evolution GO (versão comercial) — API diferente da open-source
- **Stack**: Evolution GO → webhook → `api/whatsapp.js` (bot triagem) | GAS → `_enviarWppRegua()` (régua automática)
- **Env vars Vercel**: `EVOLUTION_API_URL`, `EVOLUTION_API_KEY`, `EVOLUTION_INSTANCE`, `EVOLUTION_WEBHOOK_SECRET`, `ANTHROPIC_API_KEY`, `FORMS_URL`, `ALEX_WHATSAPP_NUMBER`
- **Webhook**: `/api/whatsapp` — rota liberada no middleware (autenticação via header `apikey`)
- **Números formato**: formato completo com DDI 55 + DDD + número (13 dígitos total)
- **Endpoint envio**: `POST /send/text` com body `{ number, text, instanceId }` e header `apikey: <token_instancia>`
- **ATENÇÃO**: Evolution GO usa **Token da Instância** (por instância), não API key global. Obtido em Instâncias → Configurações no painel.
- **Configs no Sheets (CONFIGURACOES)**: `EVOLUTION_URL`, `EVOLUTION_KEY` (= Token da Instância), `EVOLUTION_INSTANCE`

---

## Abas do frontend (UI)

| Aba | Conteúdo |
|---|---|
| Dashboard | KPIs, Em Atraso, últimos pagamentos |
| Clientes | Lista + ClienteModal (perfil/editar/contratos/todos os dados) |
| Contratos | Lista + ContratoModal (parcelas com dias de atraso/pagamentos) |
| Cobrança | Parcelas vencidas agrupadas por cliente |
| Financeiro | Histórico de pagamentos filtrado por período |
| Carteira | Carteira de crédito: KPIs, distribuição por faixa de atraso, PDD Gerencial v1.0, Resultado Ajustado ao Risco |
| Perdas & Recuperação | Contratos baixados, acordos, recuperações |
| Promessas | Acordos de pagamento futuros |
| Régua WPP | Logs de envio da régua automática: KPIs, filtros por gatilho, tabela de status. Botão ⚙️ "Templates" → `TemplatesReguaModal` para editar 10 dos 11 templates (9 régua + 1 confirmação; falta `CERTIFICADO_QUITACAO` na UI) sem acessar o Sheets |
| Simulador | (em desenvolvimento) |

---

## Convenções de código

- **Sem CSS externo** — 100% inline styles com variáveis de tema
- **Sem componentes separados** — tudo em `src/main.jsx`
- **Sem comentários** desnecessários — código autodocumentado
- **Sem features extras** além do solicitado
- Commits em **português** com prefixo `feat:` / `fix:` / `refactor:`
- Quando alterar um componente, verificar se há componentes semelhantes que precisam da mesma mudança

---

## Fluxo de novo contrato

1. Usuário busca cliente no `NovoContrato`
2. Sistema preenche automaticamente `1º Vencimento` = dia preferido do cliente no **próximo mês**
3. GAS cria contrato + parcelas (`action:"novoContrato"`) — retorna em ~1-2s
4. Modal de sucesso abre imediatamente; doc Google Docs gerado em background (`action:"gerarDoc"`)
5. Botões "Abrir no Google Docs" / "Enviar ZapSign" aparecem quando doc fica pronto; placeholder "Gerando contrato..." enquanto processa
6. Modal de sucesso oferece: abrir doc, enviar ZapSign, gerar Carnê PIX (Efí), enviar WhatsApp

---

## Fluxo de novo cliente (formulário)

1. Cliente preenche Google Form
2. `onFormSubmit` cria linha em CLIENTES com `STATUS_CLIENTE = aguardando_conferencia`
3. Admin abre `ClienteModal` → aba Editar → preenche campos faltantes → salva → status vira `ativo`
4. Observação padrão do formulário é apagada automaticamente na primeira aprovação

---

## Ativação automática de skills (ruflo)

As skills abaixo devem ser invocadas automaticamente via `Skill` tool nos cenários descritos. Não esperar o usuário pedir — ativar antes de executar a tarefa.

| Cenário | Skill / Command | Quando ativar |
|---|---|---|
| Implementar nova feature em `main.jsx` ou `appscript.gs` | `pair-programming` | Antes de escrever qualquer código novo |
| Planejar feature complexa, refactor grande, novo módulo | `sparc-methodology` | Quando a tarefa envolve múltiplos arquivos ou etapas |
| Antes de `vercel deploy --prod` (mudança pequena) | `/quickreview` ou `verification-quality` | Sempre antes de qualquer deploy |
| Antes de `vercel deploy --prod` (nova funcionalidade) | `/review` ou `github-code-review` | Antes de commit em `main.jsx`, `appscript.gs` ou `api/*.js` |
| Antes de deploy importante / suspeita de regressão | `/ultrareview-financeiroop` | Feature grande, refactor GAS, nova integração |
| UI React lenta ou muitos re-renders | `performance-analysis` | Quando o usuário reportar lentidão ou ao otimizar componentes |
| Testar o app em produção via browser | `browser` | Quando precisar verificar comportamento no app ao vivo |
| Configurar novos hooks do Claude Code | `hooks-automation` | Ao criar ou editar hooks no projeto |

### Regras de ativação

- `pair-programming`: ativar em toda tarefa de código com mais de 20 linhas alteradas
- `sparc-methodology`: ativar quando a tarefa tiver mais de 3 etapas distintas ou envolver design de sistema
- `/quickreview`: mudanças pequenas (Tier 1) — 5 min
- `/review`: novas funcionalidades (Tier 2) — 15 min
- `/ultrareview-financeiroop`: deploys importantes, features de GAS ou integrações (Tier 3) — 30–45 min. **Não usar semanalmente por rotina — use event-based.**

---

## Roadmap do produto

| Fase | Descrição | Estado |
|---|---|---|
| 1A.1 | Design System Wise completo | Concluído |
| 1A.2 | Refatoração shadcn (Dashboard primeiro, demais telas em sequência) | Em andamento |
| 1B | Régua de cobrança automática D-5/D-1/D0/D+1/D+3/D+7 + PIX avulso Efí + log MENSAGENS | **Concluído (2026-06-15)** |
| 1C | API Roadmap: CEP auto-fill + CNPJ empregador + score empregador + feriados + IBGE (Sprints 1/1.5/2/3) | **Concluído (2026-06-20)** |
| 1C-pend | API Roadmap: OpenStreetMap Nominatim (Sprint 4) + AwesomeAPI fallback CEP (Sprint 5) | **Concluído (2026-06-20)** |
| 2 | Portal do cliente (PWA) | Pendente (pós-Supabase) |
| 3 | Migração Google Sheets → Supabase | Pendente |

---

## Segurança — NUNCA commitar

- `producao-849675-financeiroop.p12` — certificado Efí Bank (raiz do repo, no `.gitignore`)
- Antes de qualquer commit, verificar `git status` para confirmar que esses arquivos não aparecem staged

---

## Bugs conhecidos / armadilhas

> Lista completa com causa e solução detalhada em `docs/ai-memory/07-AI-KNOWN-ISSUES.md`. Leia obrigatoriamente antes de qualquer alteração em GAS, cálculos financeiros ou lógica de status.

---

## Padrões de UX

> Convenções consolidadas em `DESIGN_SYSTEM.md` seção 12. Leia antes de qualquer alteração de UI.
