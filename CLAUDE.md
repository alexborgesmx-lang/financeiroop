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
| `PROPOSTAS_RENEGOCIACAO` | Propostas de renegociação com entrada obrigatória via PIX (`gerarPropostaRenegociacao`) — expira em 48h |
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

**Rotinas automáticas e triggers ativos:**
```javascript
rotinaDiaria()              // 7h — webhook Efí, verificação pagamentos, régua, status parcelas/contratos,
                            // promessas vencidas, auditoria, expiração undo/quitações
rotinaRegua()                // 8h — trigger de backup só da régua (redundância se rotinaDiaria travar antes)
rotinaVerificarPagamentos()  // a cada 1h — polling de pagamentos Efí (fallback do webhook)
rotinaAnalitica()            // a cada 2h (configurarTriggerAnalitica) — score/métricas em lote + tabelas
                            // EMPREGADORES/PADRINHOS
```

**Processamento em lote com cursor — evita "Exceeded maximum execution time" (2026-08-01):**
`_atualizarScoresDiario` (chamada por `rotinaAnalitica`) recalcula score+métricas de todos os clientes
ativos, mas `calcularScore`/`calcularMetricasCliente` variam linearmente com o tamanho de
CONTRATOS/PARCELAS/PAGAMENTOS — processar a carteira inteira numa execução só passou a estourar o limite
de 6min do Apps Script. Padrão adotado: cursor persistido em CONFIGURACOES (`CURSOR_SCORE_DIARIO` via
`_getCfg`/`_setCfg`) + orçamento de tempo (`Date.now()` vs início, 4,5min) — cada execução processa a
partir de onde a anterior parou e nunca estoura o limite, completando o ciclo pela carteira ao longo de
várias execuções. **Reaproveitar esse padrão** (cursor em CONFIGURACOES + orçamento de tempo) em qualquer
rotina automática nova cujo custo cresça com o volume de dados — não só aumentar a frequência do trigger.
Detalhes em `docs/ai-memory/07-AI-KNOWN-ISSUES.md` (2026-08-01).

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

**Notificação de erro de sistema (2026-07-31):**
```javascript
_notificarErroSistema(origem, mensagem)   // e-mail (GmailApp → EMAIL_ADMIN, canal garantido) + WhatsApp
                                          // best-effort (TEL_ALEX_NOTIFICACOES) — chamar em catch de
                                          // rotinas automáticas (triggers/rotinaDiaria), NUNCA em ações
                                          // interativas da UI (doPost) — o Alex já vê erro de UI na hora,
                                          // notificar ali também só geraria ruído
```
Já plugada em todos os sub-processos de `rotinaDiaria()`/`rotinaRegua()`, no resumo de falhas de
`enviarReguaCobranca()` (1 aviso por execução, não por cliente) e em `_enviarConfirmacaoPagamento()`.
Ao adicionar uma nova rotina automática (trigger diário/backup), envolver com `try/catch` chamando
`_notificarErroSistema("<nomeFuncao>", e.message)` no catch, seguindo o mesmo padrão. Detalhes e
motivação (WhatsApp sozinho falha como canal de alerta quando o próprio WhatsApp é a causa do erro) em
`docs/ai-memory/07-AI-KNOWN-ISSUES.md` (entrada 2026-07-31).

Também plugada em `pagamentoAutomatico` (2026-08-01) — não é um catch de erro, mas o mesmo raciocínio
de "fluxo automático sem UI, ninguém veria isso na hora" se aplica: se um pagamento via PIX cai numa
parcela enquanto outra mais antiga do mesmo contrato segue `atrasado`, avisa o Alex no mesmo dia em vez
de só a auditoria das 7h05 (ou o próprio Alex, meses depois) pegar. Não bloqueia o pagamento — só avisa.

**Templates da régua — carregados do CONFIGURACOES:**
```javascript
buscarTemplatesRegua()           // retorna objeto com todos os TEMPLATE_* do CONFIGURACOES
                                 // fallback para _MSG_TEMPLATES hardcoded se chave ausente
salvarTemplateRegua(templates)   // persiste cada chave como TEMPLATE_<gatilho> no CONFIGURACOES
```
Chaves: `TEMPLATE_D-5`, `TEMPLATE_D-1`, `TEMPLATE_D0`, `TEMPLATE_D+1`, `TEMPLATE_D+3`, `TEMPLATE_D+7`, `TEMPLATE_PROMESSA_D-1`, `TEMPLATE_PROMESSA_D0`, `TEMPLATE_PROMESSA_D+1`, `TEMPLATE_CONFIRMACAO`, `TEMPLATE_CERTIFICADO_QUITACAO`

`_garantirConfigsRegua()` — chamada no início de `enviarReguaCobranca` — popula todas as chaves TEMPLATE_* no CONFIGURACOES se ainda não existirem.

**Gap conhecido:** `TemplatesReguaModal` (`main.jsx`) tem `LABELS`/`ORDEM` hardcoded com só 10 chaves — `CERTIFICADO_QUITACAO` existe no backend (`_MSG_TEMPLATES`, `_garantirConfigsRegua`, `buscarTemplatesRegua`) mas não aparece na UI. Pra editar o texto desse template hoje só mexendo direto na aba CONFIGURACOES (`TEMPLATE_CERTIFICADO_QUITACAO`).

**Nunca avança pra parcela nova com atrasada em aberto (2026-08-01):** dentro de `enviarReguaCobranca`, se existe outra parcela do mesmo contrato mais antiga e ainda em atraso (`atrasoMaisAntigoPorContrato`, calculado no início da função), a parcela sendo avaliada só entra na fila de disparo se ela mesma for essa mais antiga — nunca manda mensagem/gera PIX pra parcela seguinte enquanto a mais velha segue em aberto. Corrige o cenário em que o cliente tinha dois códigos PIX simultaneamente válidos no histórico do WhatsApp (um de cada parcela, cada um gerado em dia diferente) e pagou o errado. Mensagens de atraso (`D+1`/`D+3`/`D+7`) também ganharam um aviso fixo no texto: "Use apenas o código PIX enviado nesta mensagem". **Efeito colateral sabido:** os gatilhos são únicos (D-5 a D+7) — uma parcela que passou de D+7 sem pagar já não recebe mais nenhuma mensagem, e agora isso também segura a mensagem da parcela seguinte. Contrato fica sem cobrança automática até ação manual; resolver esse gap (recorrência além de D+7) é um follow-up separado, não implementado ainda.

**Confirmação automática de pagamento:**
```javascript
// Chamado ao final de registrarPagamentoAPI (cobre pagamentos manuais E webhook Efí)
_enviarConfirmacaoPagamento({idParcela, idContrato, idCliente, nomeCliente, numParcela, totalParcelas, vlPago})

// Resolve PROMESSAS PENDENTE do contrato com status de destino explícito
_resolverPromessasContrato(idContrato, novoStatus, dataRef, motivo)  // "CUMPRIDA" | "QUEBRADA" | "CANCELADA"
_cancelarPromessasPorContrato(idContrato)  // wrapper: _resolverPromessasContrato(id, "CUMPRIDA", hoje)
```
- **`_cancelarPromessasPorContrato` também é chamada no ramo `todasPagas` de `registrarPagamentoAPI` e `registrarQuitacaoAntecipada`** (2026-08-29) — quando o pagamento quita o contrato, esses caminhos enviam só o certificado e pulam `_enviarConfirmacaoPagamento`, então sem essa chamada extra a promessa ficava `PENDENTE` pra sempre e a régua disparava `PROMESSA_D+1` no dia seguinte contra um contrato sem parcela em aberto (`ERRO_SEM_PIX`). Defesa adicional na régua: o loop de promessas de `enviarReguaCobranca` pula (e resolve) promessa cujo contrato não tem mais parcela fora de `ST_SKIP_P`. Correção histórica: menu GAS → "Régua: Corrigir Promessas Quebradas Indevidamente". Ver `docs/ai-memory/07-AI-KNOWN-ISSUES.md` (2026-08-29).
- **Promessas órfãs de contrato renegociado/baixado/judicial (2026-09-01)** — `renegociarContrato`, `registrarAcordoComPerda`, `baixarContratoPrejuizo` e `ajuizarContrato` chamam `_resolverPromessasContrato(id, "QUEBRADA", ...)` (a promessa não foi cumprida — o cliente renegociou/quebrou em vez de pagar). A régua (`enviarReguaCobranca`, ramo de promessa) e `verificarPromessasVencidas` passaram a checar o `STATUS_CONTRATO` / `DATA_RENEGOCIACAO` antes de disparar ou marcar `QUEBRADA` cega. Limpeza histórica: menu GAS → **"Régua: Corrigir Promessas Órfãs (contratos renegociados/baixados/judiciais)"** (`corrigirPromessasOrfasReorganizadas`). `renegociarContrato` também: (a) grava `CONTRATOS.ATRASO_MAX_PRE_RENEGOCIACAO` (snapshot do pior atraso das parcelas roladas — o `calcularScore` usa pra não anistiar a inadimplência) e (b) avança `novoVencimento` pra frente se cair no passado. Score: renegociação estrutural (`DATA_RENEGOCIACAO` preenchida) passou a disparar as mesmas penalidades do `acordoComPerda`, e `calcularScore` agora penaliza promessa `QUEBRADA` (−4/−8/−12). Ver `07-AI-KNOWN-ISSUES.md` e `02-AI-CREDIT-RULES.md` (2026-09-01).
- Dedup: bloqueia reenvio só se já existir em MENSAGENS uma linha `GATILHO="CONFIRMACAO_PAGAMENTO"` + `ID_PARCELA` + `STATUS_ENVIO="ENVIADO"` enviada no mesmo dia (ou depois) da `DATA_PAGAMENTO` **vigente** da parcela — não é mais "nunca reenvia" incondicional por `ID_PARCELA`. Helper `_dataPagamentoAtualParcela` + `_apenasData` (appscript.gs ~6602). Motivo: `reabrirParcelaAPI` reseta a parcela mas não limpa MENSAGENS, então uma confirmação antiga (de um pagamento revertido) não pode bloquear o pagamento real seguinte na mesma parcela. Ver `docs/ai-memory/07-AI-KNOWN-ISSUES.md` (2026-07-20).
- Template: `TEMPLATE_CONFIRMACAO` do CONFIGURACOES; variáveis: `{NOME}`, `{NUM_PARCELA}`, `{TOTAL_PARCELAS}`, `{VALOR_PAGO}`, `{PARCELAS_RESTANTES}`, `{PROXIMO_VENCIMENTO}`
- Log em MENSAGENS com `GATILHO = "CONFIRMACAO_PAGAMENTO"`
- **Blindagem contra falha silenciosa (2026-07-13):** todo o corpo de `_enviarConfirmacaoPagamento` roda dentro de try/catch — qualquer exceção grava `ERRO_ENVIO` em MENSAGENS em vez de desaparecer sem rastro. `_logMensagem` usa `LockService.getScriptLock()` (mesmo padrão de `proximoIdSeq`) porque `rotinaDiaria` (7h) e o trigger backup `rotinaRegua` (8h) podem chamar a régua em execuções concorrentes, e sem lock uma escrita podia sobrescrever a outra. Ver `docs/ai-memory/07-AI-KNOWN-ISSUES.md` (2026-07-13). **Nota (2026-07-20):** esse fix não cobria o caso do dedup por data acima — o dedup roda *antes* do try/catch e retorna via `return` simples, nunca lança exceção, então uma confirmação bloqueada por dedup nunca aparecia como `ERRO_ENVIO`.
- Se uma confirmação ficar sem enviar mesmo assim: menu GAS → **"Régua: Reenviar Confirmações de Pagamento Perdidas (7 dias)"** (`reenviarConfirmacoesPendentes()`) — varre todas as parcelas pagas nos últimos 7 dias (sem pré-filtro próprio) e delega o dedup inteiramente pra `_enviarConfirmacaoPagamento`; seguro rodar mais de uma vez.

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
recalcularTotaisContratosHistorico()      // recalcula NUM_PARCELAS/JUROS_TOTAL/VALOR_TOTAL de todos os contratos
                                          // somando as parcelas reais (1 leitura de cada aba + 2 setValues em lote —
                                          // reescrito em 2026-08-29 após estourar 6min chamando atualizarTotaisContrato em loop)
backfillAbatimentosAssistidosHistorico() // reaplica a cascata capital-primeiro (_alocarAbatimentoAssistido) sobre os
                                          // abatimentos de Acordo Assistido já registrados, em ordem cronológica por
                                          // contrato — rodar 1x após publicar a mudança de 2026-08-29
corrigirPromessasOrfasReorganizadas()     // marca QUEBRADA promessas PENDENTE de contratos renegociados/baixados/
                                          // judiciais que ficaram órfãs; recalcula score/métricas — rodar 1x (2026-09-01)
backfillAtrasoMaxPreRenegociacao()        // reconstrói CONTRATOS.ATRASO_MAX_PRE_RENEGOCIACAO nos contratos já
                                          // renegociados a partir do DIAS_ATRASO das parcelas "renegociado" — rodar 1x
                                          // depois recalcular score (2026-09-01)
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
- Contador de quantas vezes o contrato usou `somente_juros` — **sem limite** (removido em 2026-08-26; fee de 5% + penalização de score sem teto já cobrem o risco que a trava existia pra evitar — detalhes em `docs/ai-memory/02-AI-CREDIT-RULES.md`)
- Incrementado em `registrarPagamentoParcial`, decrementado em `reabrirParcelaAPI`
- Visível no ContratoModal como badge "X prorrogações" (amarelo a partir de 1 uso, vermelho a partir de 3+)

**Módulo Recuperação Judicial (2026-07-04):** `em_processo_judicial` não é status final — é o início de uma fase com duas dimensões independentes: `STATUS_PROCESSO` (situação processual, já existia) e `SITUACAO_FINANCEIRA_JUDICIAL` (situação financeira, novo). Só vira o status terminal `encerrado_judicialmente` quando resolvido. Ações disponíveis:
```javascript
registrarAcordoJudicial(idContrato, dados)      // acordo parcelado (gera PARCELAS ORIGEM_PARCELA="acordo_judicial") ou à vista
registrarQuitacaoJudicial(idContrato, dados)    // quitação em uma parcela única
arquivarProcessoJudicial(idContrato, dados)     // encerra o processo; sem recuperação total → PERDA_JUDICIAL_DEFINITIVA
_alocarRecuperacaoJudicial(...)                 // cascata: custo do credor → principal → lucro → reembolso ao devedor
```
Pagamento de parcela `acordo_judicial` passa pelo `registrarPagamentoAPI` normal (auto-detecta `ORIGEM_PARCELA`) — não tem action própria. `CLIENTE_JUDICIALIZADO` nunca é limpo (bloqueio permanente, validado em `criarContrato`). Detalhes completos em `docs/ai-memory/02-AI-CREDIT-RULES.md` e `03-AI-FINANCIAL-CALCULATIONS.md`.

**Acordo Assistido — cascata capital-primeiro (2026-08-29):** cada abatimento assistido é alocado primeiro pro principal do contrato ainda em aberto (histórico inteiro — parcelas pagas integralmente, exceto `somente_juros`, mais abatimentos anteriores); só o excedente depois do principal 100% recuperado é reconhecido como lucro. Mesmo padrão da cascata judicial acima, sem honorários/custas.
```javascript
registrarAbatimentoAssistido(idContrato, dados)   // aplica a cascata e grava o pagamento
_alocarAbatimentoAssistido(valorPago, capitalJaRecuperado, valorPrincipal)  // cascata pura: principal primeiro, sobra vira lucro
_capitalRecuperadoParcelas(idContrato, dadosP, cmP)  // soma o principal já devolvido via parcelas (exceto somente_juros)
```
`VALOR_ABATIDO_ASSISTIDO` (CONTRATOS) guarda só a parte-principal acumulada dos abatimentos (não mais o pagamento cheio); `LUCRO_RECUPERADO_ASSISTIDO` (CONTRATOS, novo) guarda a parte-lucro — **nunca somado a `LUCRO_TOTAL`** operacional, mesmo padrão de `VALOR_RECUPERADO_JUDICIAL_LUCRO`. Por pagamento, `CAPITAL_RECUPERADO_ASSISTIDO`/`LUCRO_RECUPERADO_ASSISTIDO` (PAGAMENTOS) guardam o detalhe individual. Visível no `ContratoModal` como card "Lucro recuperado (Acordo Assistido)" quando > 0, ao lado de "Capital recuperado"/"Capital restante". Motivador: investigação do contrato PCL-106 (Jessica) — detalhes completos em `docs/ai-memory/07-AI-KNOWN-ISSUES.md` (2026-08-29) e fórmula em `docs/ai-memory/03-AI-FINANCIAL-CALCULATIONS.md`.

**Bloqueio Manual de Cliente (2026-07-09):** decisão subjetiva do dono do negócio (ex: cliente usou nome de terceiro em outro contrato) — independente de `CLIENTE_JUDICIALIZADO` (permanente) e `SCORE_BLOQUEADO` (automático). Campos em CLIENTES: `CLIENTE_BLOQUEADO_MANUAL` (`"SIM"`/vazio), `MOTIVO_BLOQUEIO_MANUAL`, `DATA_BLOQUEIO_MANUAL`.
```javascript
bloquearClienteManual(idCliente, motivo)   // motivo obrigatório (min. 5 chars); registra evento BLOQUEIO_MANUAL_CLIENTE
desbloquearClienteManual(idCliente)        // reversível — MOTIVO/DATA do último bloqueio ficam como histórico
```
Validado em `criarContrato` (mesmo bloco de checagem de `CLIENTE_JUDICIALIZADO`) — bloqueia só **novos** contratos, contratos já ativos seguem normalmente. Botão "Bloquear/Desbloquear Cliente" no `ClienteModal`; badge vermelho "BLOQUEADO" no `ClienteModal`, na listagem de Clientes e no dropdown de busca do `NovoContrato`.

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

**Realocar pagamento entre parcelas (2026-08-01):** corrige o cliente ter pago a parcela errada (ex: usou um PIX antigo do WhatsApp e pagou a parcela do mês corrente em vez da atrasada). Não existe fora do TTL de 15 min do Motor de Undo acima — cobre qualquer pagamento, de qualquer data.
```javascript
realocarPagamentoAPI({idContrato, idCliente, numParcelaOrigem, numParcelaDestino, idPagamento, motivo})
```
- Reaproveita os primitivos existentes em vez de tocar direto na célula `ID_PARCELA` de PAGAMENTOS (isso deixaria `PARCELAS`/`EVENTOS`/`TOTAL_SOMENTE_JUROS`/`STATUS_CONTRATO` inconsistentes): valida a parcela de destino primeiro (existe e não está em `STATUS_TERMINAL` — falha aqui antes de mexer em qualquer coisa), depois chama `reabrirParcelaAPI` na origem e `registrarPagamentoAPI` no destino com a mesma data/valor/forma do pagamento original
- Grava evento `REALOCACAO_PAGAMENTO` em EVENTOS além dos que os dois primitivos já geram — não precisa de colunas novas em nenhuma aba
- **Não corrige juros/multa automaticamente** — se a parcela de destino tinha mais dias de atraso do que o valor pago cobre, a diferença fica como está; avaliar desconto ou cobrança complementar manualmente
- Botão "Realocar" no `PagamentoDetalheModal` (`main.jsx`), ao lado do "Reabrir" já existente
- **`reabrirParcelaAPI` agora também limpa `EFI_TXID`/`EFI_PIX_CODE`/`EFI_LINK`/`EFI_STATUS` da parcela reaberta** (fix no mesmo dia, achado testando o botão "Realocar" pela primeira vez): o TXID é determinístico por parcela (`FOP<contrato>P<numParcela>`) e o cobv correspondente já foi marcado `CONCLUIDA` na Efí quando a parcela foi paga — sem limpar essas colunas, a próxima cobrança (régua ou manual) reenviaria o mesmo código já pago, e se o cliente conseguisse pagar de novo mesmo assim, o webhook bloquearia por idempotência (TXID já `PROCESSADO`) e o dinheiro recebido não seria creditado em lugar nenhum. `_gerarPixAvulso` já sabia criar TXID novo com sufixo `R1`/`R2` quando o base está terminal na Efí (ver `docs/ai-memory/07-AI-KNOWN-ISSUES.md`) — só faltava limpar as colunas pra essa lógica disparar de novo. Afeta também o botão "Reabrir" simples e o Motor de Undo (`_reverterPagamentoNormal`/`_reverterSomenteJuros`), que chamam `reabrirParcelaAPI` por baixo — ambos ganharam o fix de graça. Existia uma ferramenta manual pra isso (`limparPixAbertosParaRegeneracao`, menu GAS, varre TODAS as parcelas abertas de uma vez) — ainda útil pra limpeza em lote de dados antigos, mas agora o caso comum (reabrir 1 parcela) já sai limpo sozinho.

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
- Verifica: relacionamentos órfãos, parcela/status inconsistente com PAGAMENTOS, duplicidade de pagamento (mesma parcela+data+valor), TXID Efí duplicado, promessa órfã/inconsistente, `VALOR_TOTAL`/`JUROS_TOTAL` do contrato divergente da soma das parcelas, `TOTAL_PAGO`/`CONTRATOS_ATIVOS` do cliente divergente do real, chave de idempotência duplicada, **sequência de pagamento** (2026-08-01: severidade ALTO se uma parcela mais nova está `pago` enquanto outra do mesmo contrato, mais antiga, segue `atrasado` — backstop diário caso o cliente pague a parcela errada e as defesas da régua/webhook não peguem)
- Gera **score de 0–100** (desconta por severidade CRITICO/ALTO/MEDIO/BAIXO) e grava tudo na aba `AUDITORIA` com marcador de início/fim de sessão
- Não corrige nada automaticamente — é só diagnóstico (`AUTO_CORRIGIDO` sempre "NAO" hoje)

**Backup automático (diário, 2h):**
```javascript
fazerBackupAutomatico()     // copia a planilha inteira para pasta "FinanceiroOp Backups" no Drive, mantém só as últimas 30
configurarTriggerBackup()   // registra o trigger diário (rodar 1x manual)
```

**Relatório Automático de Contabilidade (dia 20, criado 2026-07-22, movido de dia 22 → dia 20 em 2026-08-21):** todo dia 20 às 8h, gera o mesmo CSV do botão manual "Contabilidade" (aba Contratos) cobrindo do dia 1 ao dia 20 do mês corrente (corte parcial — contratos feitos depois do dia 20 não entram, complementar via botão manual). Entrega **só por WhatsApp** (sem e-mail) pro Alex e direto pro contador, com link do arquivo no Drive.
```javascript
gerarRelatorioContabilidadeMensal()          // gera CSV + salva no Drive ("Relatórios Contabilidade", últimas 12) + WhatsApp pros dois
configurarTriggerRelatorioContabilidade()    // registra o trigger dia 20 às 8h (rodar 1x manual)
testarRelatorioContabilidadeMensal()         // wrapper de teste manual, com alert() de resultado (a função principal não pode chamar getUi() pois roda também via trigger sem UI)
```
Config em CONFIGURACOES: `TEL_ALEX_NOTIFICACOES`, `TEL_CONTADOR`, `ULTIMO_MES_RELATORIO_CONTABIL` (trava de idempotência). Arquivo no Drive compartilhado como `DriveApp.Access.ANYONE_WITH_LINK` — decisão consciente do Alex (simplicidade > restringir por conta Google do contador), CPF/RG/endereço dos clientes ficam expostos a quem tiver o link. Detalhes e gotcha de permissão OAuth (`script.scriptapp` em `appsscript.json`) em `docs/ai-memory/07-AI-KNOWN-ISSUES.md` (2026-07-22).

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

### Documentos do cliente — migração jsPDF → HTML+print (em andamento, 2026-07-15)

Documentos client-facing estão sendo migrados de jsPDF (desenho client-side em canvas)
para **HTML renderizado + `window.print()`** — mesmo padrão já usado em `api/cert.js`,
permite fidelidade real ao handoff de design (`Borges Assessoria/design_handoff_rede_borges/`)
sem reimplementar CSS em canvas. Migração é **um documento por vez**, plano documentado em
`docs/superpowers/specs/` e `docs/superpowers/plans/` (prefixo `2026-07-15-comprovante-*`).

**Concluído:**
- Comprovante de Pagamento (parcela não-final) — `abrirComprovantePagamento` (`main.jsx:638`) +
  template `_comprovantePagamentoHTML` (`main.jsx:546`)
- Comprovante de Quitação (parcela final / contrato quitado) — `abrirComprovanteQuitacao`
  (`main.jsx:767`) + template `_comprovanteQuitacaoHTML` (`main.jsx:650`); `gerarComprovante`
  (`main.jsx:4779`) virou wrapper fino sobre essa função

**Ainda em jsPDF (backlog, mesma migração pendente):** `gerarExtratoPDF` (Extrato do
Contrato, `main.jsx:860`). Timbre de Contrato **não** entra nessa migração — decisão
explícita de manter o fluxo Google Docs + ZapSign como está.

**Padrão de implementação:**
```javascript
// Síncrono (sem dado de servidor) — abrir a janela DENTRO do clique síncrono do usuário,
// nunca depois de um await, senão o navegador bloqueia o pop-up:
function abrirComprovantePagamento(dados){
  const win = window.open("", "_blank");
  if(!win){ alert("Pop-up bloqueado — permita pop-ups e tente novamente."); return null; }
  win.document.write(_comprovantePagamentoHTML(dados));
  win.document.close();
  return win;
}

// Assíncrono (precisa buscar dado no GAS, ex.: QR do certificado) — abrir a janela
// IMEDIATAMENTE com um placeholder, e só then fazer o document.write real:
async function abrirComprovanteQuitacao(dados){
  const win = window.open("", "_blank");
  if(!win){ alert("Pop-up bloqueado..."); return null; }
  win.document.write("<p>Gerando comprovante...</p>");
  try {
    const r = await postAction({action:"garantirCertificadoQuitacao", ...});
    // sucesso: usa r.link/r.codigo — falha: cai no fallback (dados.autenticacaoFallback,
    // sem QR) e loga via console.error — NUNCA catch vazio, mesmo sendo um caminho de
    // "degradação graciosa" (documento tem que abrir de qualquer forma)
  } catch(e){ console.error("garantirCertificadoQuitacao falhou, documento abre sem QR:", e); }
  win.document.write(_comprovanteQuitacaoHTML({...dados, ...}));
  win.document.close();
}
```
- Linha de Confiança (elemento de assinatura da marca) dentro de template string HTML:
  usar `_linhaConfiancaSVG(w,h,n,sw,amp,color)` (`main.jsx:536`) — gerador de string SVG
  separado do componente React `LinhaConfianca` (Fase 1); duplicação intencional de ~10
  linhas para não acoplar o template de documento ao componente React já em produção.
- Documentos que precisam de dado do GAS custam uma chamada de rede a mais que a versão
  jsPDF não tinha — cobrir sempre com fallback gracioso (nunca travar o documento
  esperando o servidor, nunca `catch` vazio).

### Rollout design v3 nas abas — `KpiCard` + `Table` (em andamento, 2026-07-17)

Continuação da Fase 1 (que só cobriu tokens + Dashboard): levar o mesmo padrão visual
de KPI card e tabela pras outras 8 abas (Clientes, Contratos, Financeiro, Carteira,
Perdas & Recuperação, Promessas, Régua WPP, Simulador), uma aba por vez (spec +
plano próprios em `docs/superpowers/`, prefixo `2026-07-17-rollout-*`).

**Componentes reutilizáveis já existem — não recriar:**
- `KpiCard({label,value,sub,color,icon,iconBg,tip,delta,badge,onClick,active})`
  (`main.jsx:340`, logo após `Badge`) — chama `useIsMobile()` internamente, não
  precisa de prop `mob`. `onClick` ausente = card não-interativo (sem hover/cursor).
- Primitivo shadcn `Table/TableHeader/TableRow/TableHead/TableBody/TableCell`
  (`src/components/ui/table.jsx`, já existia desde a Fase 1, só nunca tinha sido usado
  — primeiro uso real foi na aba Cobrança). **Gotcha:** `TableHead`/`TableCell`
  aplicam `whitespace-nowrap` por padrão — colunas com texto que pode quebrar em mais
  de uma linha (nome+subtítulo, texto livre longo) precisam de
  `className="whitespace-normal"` explícito, senão cortam/overflow.

**Concluído:** aba Cobrança (KPIs + tabela desktop + zebra mobile).
**Backlog:** as outras 8 abas — 14 ocorrências restantes de `<table>` cru no arquivo.

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
parseValorColado(texto)   // converte texto colado no formato BR ("2.000,00") para número JS válido; null se não parseável
pasteMoeda(e, setter)     // onPaste handler — usa parseValorColado e chama setter(String(n)); ver "Campos monetários — colagem BR" abaixo
```

### Campos monetários — colagem BR (adicionado 2026-07-15)
Todo `<input type="number">` que representa **valor em reais** precisa de `onPaste={e=>pasteMoeda(e,<setter>)}` — sem isso, colar um valor no formato BR (ex: `2.000,00` copiado de PDF/comprovante) faz o navegador descartar a vírgula e gerar um valor errado (`2.00000`). Não é automático — **todo campo novo de R$ precisa desse `onPaste` adicionado manualmente**.

```javascript
// padrão simples (setter direto, ex: useState)
<input type="number" value={valor} onChange={e=>setValor(e.target.value)} onPaste={e=>pasteMoeda(e,setValor)} .../>

// padrão com state composto (objeto "dados" com set=f=>e=>setDados(...))
// adicionar ao lado do "set" existente:
const setF=f=>v=>setDados(p=>({...p,[f]:v}));
// e usar: onPaste={e=>pasteMoeda(e,setF("campo"))}

// CampoEdit (ClienteModal): passar a prop moeda
<CampoEdit ... field="RENDA_BRUTA" tipo="number" moeda/>
```

Campos de percentual (`Taxa Mensal %`) e quantidade (`Nº de Parcelas`) ficam de fora deliberadamente — não é o problema que esse padrão resolve. A exibição do campo com vírgula decimal (ex: `2670,15`) é comportamento nativo do Chrome em pt-BR, não algo implementado por nós; separador de milhar (`1.000`) nunca aparece em `type="number"` nativo, em nenhum idioma — formatação visual completa (`R$ 2.000,00` ao vivo) exigiria trocar o input por um componente de máscara de moeda, avaliado e descartado por ora (ver spec).

**Teto de sanidade (adicionado 2026-07-28):** `pasteMoeda`/`normMoedaSheet` (`main.jsx`, perto de `parseValorColado`) rejeitam qualquer valor colado/normalizado ≥ `MOEDA_TETO` (R$10.000.000 — bem acima de qualquer valor real do negócio). `pasteMoeda` recusa o paste com um alerta explicando o motivo; `normMoedaSheet` (usado ao ler o valor vindo do Sheets, ex: init do `edit` do `ClienteModal`) devolve `""` em vez do número implausível. Existe pra impedir que uma colagem errada (ex: bloco de texto inteiro colado numa célula, concatenando vários números) vire um valor "confiável" e gigante que contamina cálculos derivados (ex: Limite de Crédito). Ver `docs/ai-memory/07-AI-KNOWN-ISSUES.md` (2026-07-28).

**Conversão explícita a Number no GAS (adicionado 2026-07-28):** o frontend sempre manda o valor já limpo (string com ponto decimal), mas isso sozinho não garante que a célula do Sheets vire um Number de verdade — o `setValue()` do Apps Script decide o tipo tentando "adivinhar" a partir da string, dependente do locale pt-BR da planilha. Pra fechar essa ambiguidade, `atualizarDadosCliente` (appscript.gs) usa `_toMoneyNumber()` + o mapa `_CAMPOS_MONEY_CLIENTES` (`RENDA_BRUTA`, `RENDA_LIQUIDA`, `RENDA_MENSAL`, `LIMITE_CREDITO`) pra converter explicitamente pra `Number` do JS antes de gravar — nunca deixa o Sheets adivinhar. Se um novo campo monetário for adicionado em CLIENTES, incluir no mapa; se for adicionado em outra aba, replicar o padrão no ponto de escrita correspondente do GAS.

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
- **Timeout de 20s em toda chamada HTTPS pro Efí** (`api/efi-auth.js`, `getEfiToken`/`efiRequest`, compartilhado por todos os `api/efi-*.js`) — sem isso, uma resposta travada do Efí prendia a função Vercel até o limite de 300s, que devolve página de erro em texto (não JSON) e quebra quem espera JSON do outro lado (ex: GAS). Ver `docs/ai-memory/07-AI-KNOWN-ISSUES.md` (2026-08-01). Replicar esse padrão em qualquer chamada HTTPS externa nova que não use uma lib com timeout embutido.

**PIX vencido (>30 dias de atraso) — detecção e regeneração (2026-08-10):**
```javascript
_regenerarPixVencidos()   // GAS, chamada em rotinaDiaria() após enviarReguaCobranca() — roda a cada 25
                           // dias de atraso (25, 50, 75...), renova o EFI_PIX_CODE/EFI_TXID de parcelas
                           // em aberto silenciosamente (sem WhatsApp), pela DATA_VENCIMENTO original
```
- Cobv normal tem `validadeAposVencimento: 30` — passado esse prazo a Efí recusa o código antigo. A régua já
  parou de tocar na parcela bem antes disso (D+7); sem essa rotina, ninguém percebia até o cliente tentar
  pagar e falhar.
- **`DATA_ACORDO` (reagendamento) é sempre ignorada** nessa lógica inteira (detecção + regeneração,
  frontend + GAS) — é só o registro da promessa do cliente, não altera a dívida real. Só `DATA_VENCIMENTO`
  importa.
- Frontend (`ContratoModal`, `main.jsx`): aviso vermelho + botão "Gerar novo PIX" quando `proxParcela` tem
  mais de 30 dias de atraso; botão "Gerar PIX novamente" sempre disponível em "Mais ações" (força
  regeneração mesmo sem o aviso — cobre o caso do código já ter sido gerado errado antes de um fix).
  Avalia cada parcela em aberto do contrato independentemente pela própria `DATA_VENCIMENTO`; só regenera
  as com mais de 30 dias — as demais não são tocadas (regenerar sem necessidade quebraria o cálculo
  dinâmico de mora que a Efí já vinha fazendo certo nelas).
- Cálculo de encargo (`api/efi-charges.js`, `api/efi-pix-avulso.js`): regenerar uma cobv vencida exige
  mandar `calendario.dataDeVencimento` hoje-ou-futuro pra Efí, o que reseta o cálculo dinâmico de
  multa/juros dela. Pra parcela com >30 dias de atraso, calcula multa (`EFI_MULTA_PCT`) + juros de mora
  (`EFI_JUROS_DIARIO` × dias reais de atraso) e embute como `valor.original` fixo, removendo os campos
  dinâmicos do payload (evita cobrar 2×). Fórmula completa em `docs/ai-memory/03-AI-FINANCIAL-CALCULATIONS.md`;
  histórico do bug (3 causas raiz encadeadas) em `docs/ai-memory/07-AI-KNOWN-ISSUES.md`.
- **Gap conhecido**: `_regenerarPixVencidos` dispara pela primeira vez aos 25 dias (antes do limite de 30
  do cálculo de encargo) — o primeiro refresh automático de cada parcela ainda perde os dias de mora já
  acumulados até então. Não estendido pra rotina automática por decisão do Alex (ver known issues).

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

**Renegociação com entrada obrigatória via PIX (2026-08-06):** mesmo esqueleto de proposta pendente da Quitação Antecipada acima — `renegociarContrato` (5.9 no `MANUAL_OPERACIONAL.md`) só executa depois que a entrada é confirmada paga.
```javascript
gerarPropostaRenegociacao(dados)     // valida elegibilidade (_validarElegibilidadeRenegociacao), calcula saldo (_saldoDevedorAbertoContrato), abate a entrada (capital primeiro, depois juros) e sugere qtd/valor de parcela sem teto (arredonda pra cima, igual entre todas); grava em PROPOSTAS_RENEGOCIACAO
salvarPixEntradaRenegociacao(dados)  // grava o copia-e-cola gerado pela Efí na proposta
cancelarPropostaRenegociacao(dados)  // status → CANCELADO
pagamentoRenegociacaoWebhook(txid, valor, data)  // recebido via webhook Efí — protegido por idempotência (chave RENEG_<txidBase>, remove sufixo R1/R2), chama renegociarContrato com os valores congelados na proposta + valorEntradaRecebida, e envia confirmação WPP
verificarPropostasRenegociacaoExpiradas()  // marca EXPIRADO propostas PENDENTE vencidas — plugada na rotinaDiaria
```
- TXID fixo por contrato: `_txidRenegociacaoEntrada(idContrato)` = `FOEN<idContrato zero-padded>E00001` — `parseTxid` em `api/webhook-efi.js` reconhece o prefixo `FOEN`
- `renegociarContrato` aceita `dados.valorEntradaRecebida` (abate saldo, registra PAGAMENTOS com `TIPO_PAGAMENTO="entrada_renegociacao"` sem `ID_PARCELA`) e gera o PIX das novas parcelas automaticamente via `UrlFetchApp` pro `/api/efi-charges` (mesmo padrão de `gerarPixTodosContratos`) — não depende do frontend estar aberto quando a entrada cai
- **Nenhum arquivo novo em `api/`** (teto de 12 Serverless Functions no Hobby) — `api/efi-quitacao.js` foi generalizado pra aceitar `callbackAction` (default `"salvarPixQuitacao"`, renegociação usa `"salvarPixEntradaRenegociacao"`) e `descricaoPix`, reaproveitado pelos dois fluxos
- **Entrada mínima dinâmica (2026-08-10, substitui o piso fixo R$200 original):** calculada por contrato em `gerarPropostaRenegociacao` = `VALOR_JUROS` da parcela em aberto com menor `NUM_PARCELA` (1 mês de juros daquele contrato específico) — sem chave em CONFIGURACOES. Checkbox "Assumir o risco e dispensar a entrada mínima" no `RenegociacaoModal` envia `assumirRisco:true`, que pula essa checagem mas nunca aceita `valorEntrada <= 0`. Entrada `R$0` (checkbox marcado, campo vazio) pula a proposta/PIX inteiramente e chama `renegociarContrato` direto, sem Motor de Undo, com prefixo `"[SEM ENTRADA - RISCO ASSUMIDO] "` na observação
- Detalhes da fórmula de alocação/arredondamento em `docs/ai-memory/03-AI-FINANCIAL-CALCULATIONS.md`; racional de negócio (por que entrada obrigatória, por que sem teto de parcelas) em `docs/ai-memory/02-AI-CREDIT-RULES.md`
- **Mensagem WPP de confirmação da entrada (reformulada 2026-08-21):** texto hardcoded (não é `TEMPLATE_*` do CONFIGURACOES) em `pagamentoRenegociacaoWebhook` (~linha 926 de `appscript.gs`) e replicado em `_testarConfirmacaoRenegociacao` (~linha 978, teste manual via menu GAS) — editar as duas juntas. Usa `*texto*` para negrito (sintaxe do WhatsApp — `**texto**` não funciona lá), moeda em vírgula BR via `.toFixed(2).replace(".", ",")`, e mostra a data de vencimento do novo carnê (`novoVencimento`, mesma data usada por `renegociarContrato` para gerar a 1ª parcela real, formatada com `parseDateLocal` + `Utilities.formatDate(...,"dd/MM/yyyy")`) para dar ao cliente uma visão geral do acordo

### ZapSign (assinatura eletrônica)
- **Token**: hardcoded em `appscript.gs` linha ~16 (`ZAPSIGN_TOKEN`)
- **Ambiente**: produção (`sandbox: false`)
- Fluxo: exporta contrato Google Docs como PDF → envia para ZapSign → retorna link de assinatura do credor
- **Retry de link + evento de falha (2026-09-09):** `sign_url`/`token` do signatário credor às vezes vêm
  vazios na resposta de criação (ZapSign materializa depois, assíncrono sob carga). `enviarParaZapSign`
  tenta `GET /docs/{token}/` (3s, 5s) antes de desistir; sem sucesso, grava evento
  `ZAPSIGN_ENVIADO_SEM_LINK` em EVENTOS. Retorna objeto `{zapUrl, enviado, docToken}` (não mais string).
  Action `buscarLinkZapSign(docToken)` — consulta pura, nunca cria documento — alimenta o botão "Buscar
  o link novamente" do estado amarelo no `NovoContrato` (`main.jsx`), que substitui o erro vermelho
  falso quando o documento já foi criado com sucesso. Ponto de entrada único: só `_enviarZapSign`/
  `_buscarLinkZapSign` no `NovoContrato` chamam essas actions — sem botão ZapSign em nenhum outro
  componente. Ver `docs/ai-memory/07-AI-KNOWN-ISSUES.md` (2026-09-09/11).
- **`gerarDoc` falhando em silêncio (2026-09-09):** achado testando o retry acima — o `.then(d=>{...})`
  de `criar()` (`NovoContrato`) só tratava sucesso; sem `else`, uma falha de `gerarDocContrato` deixava
  `docUrl`/`docId` vazios pra sempre e os botões condicionados a eles ("Abrir no Google Docs", "Enviar
  para ZapSign") simplesmente desapareciam, sem erro visível. Agora grava `docErro` (usado pelo bloco de
  erro que já existia no JSX) e oferece botão "Tentar gerar documento novamente" (`_gerarDocRetry`, reusa
  `contratoOk._dadosDoc` sem recriar o contrato). `doPost` também ganhou `Logger.log` no catch global —
  antes engolia qualquer exceção sem registrar nada, e a execução aparecia "Concluído" nas Execuções do
  Apps Script mesmo tendo falhado por dentro.

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
- **Instância atual (desde 2026-08-13)**: `borges-fp2`, VPS `76.13.228.217`, porta `32776` — porta e nome de
  instância já mudaram sozinhos mais de uma vez (histórico completo e causa em
  `docs/ai-memory/07-AI-KNOWN-ISSUES.md`, entradas 2026-07-31 e 2026-08-13). Se a régua parar de enviar, checar primeiro
  se a porta do container `evolution-go-oizv-api-1` ainda bate com `EVOLUTION_URL` (Sheets) e
  `EVOLUTION_API_URL` (Vercel) antes de qualquer outro diagnóstico.
- **Qualquer falha na automação de WhatsApp (régua, confirmação de pagamento, bot de triagem)**: seguir
  `docs/ai-memory/08-AI-INCIDENT-PROTOCOL-WHATSAPP.md` — protocolo completo de diagnóstico (trigger → regra
  → dados → infraestrutura Evolution GO) e registro de incidente. Não fazer diagnóstico ad-hoc quando esse
  protocolo já existe.

---

## Abas do frontend (UI)

| Aba | Conteúdo |
|---|---|
| Dashboard | KPIs, Em Atraso, últimos pagamentos |
| Clientes | Lista + ClienteModal (perfil/editar/contratos/todos os dados) |
| Contratos | Lista + ContratoModal (parcelas com dias de atraso/pagamentos). Botão "Contabilidade" exporta CSV (ID/nome/CPF/RG/e-mail/telefone/CEP/endereço/valor total) por período escolhido, pro contador emitir nota fiscal — mesma lógica do relatório automático do dia 20 (ver "Padrões do GAS") |
| Cobrança | Parcelas vencidas agrupadas por cliente. Card KPI clicável "🆕 Novos em Atraso na 1ª Parcela" (2026-08-11) destaca clientes com 1 único contrato na vida cuja `NUM_PARCELA===1` está atrasada — sinal de maior risco (cliente novo que já falhou na primeira cobrança). Badge inline "🆕 1ª parcela" nessas linhas mesmo sem o filtro ativo, mobile e desktop, + botão verde "WhatsApp" que abre `wa.me` com mensagem pronta via `abrirWhatsAppNovoAtraso1` (`main.jsx`, independente da `abrirWhatsApp` legada — essa é código morto, nunca chamada em nenhum outro ponto do arquivo). Lógica deriva 100% client-side (`totalContratosPorCliente` + `isNovoAtraso1`), sem campo novo no Sheets; usa a mesma fonte de atraso (`STATUS` da planilha) que o resto da fila `cobItems`, não `statusEfetivo()`, pra evitar divergência entre o card e a lista geral |
| Financeiro | Histórico de pagamentos filtrado por período |
| Carteira | Carteira de crédito: KPIs, distribuição por faixa de atraso, PDD Gerencial v1.0, Resultado Ajustado ao Risco |
| Perdas & Recuperação | Contratos baixados, acordos, recuperações |
| Promessas | Acordos de pagamento futuros |
| Régua WPP | Logs de envio da régua automática: KPIs, filtros por gatilho, tabela de status. Botão ⚙️ "Templates" → `TemplatesReguaModal` para editar 10 dos 11 templates (9 régua + 1 confirmação; falta `CERTIFICADO_QUITACAO` na UI) sem acessar o Sheets. Linhas com falha de envio (`ERRO_ENVIO`/`ERRO_PIX`) mostram botão de envio manual via WhatsApp (`AcaoEnvioManualRegua`, `main.jsx`) — fallback pra quando a automação (Evolution GO) cair; marca `STATUS_ENVIO="REENVIADO_MANUAL"` via action `marcarEnvioManualRegua` no GAS. `_jaEnviouHoje` trata `REENVIADO_MANUAL` igual a `ENVIADO` pra não duplicar envio se a régua automática voltar no mesmo dia |
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
| Qualquer trabalho criativo: nova feature, novo componente, nova funcionalidade, mudança de comportamento | `brainstorming` | **Sempre primeiro**, antes de qualquer código. Explora intenção/requisitos, propõe 2-3 abordagens, só avança com design aprovado pelo usuário |
| Design aprovado no brainstorming, pronto para virar plano | `writing-plans` | Logo em seguida ao brainstorming — transforma a spec aprovada em plano de implementação passo a passo, antes de tocar em código |
| Implementar nova feature em `main.jsx` ou `appscript.gs` | `pair-programming` | Na etapa de escrita do código, depois que `writing-plans` já produziu o plano |
| Planejar feature complexa, refactor grande, novo módulo | `sparc-methodology` | Alternativa ao par `brainstorming` + `writing-plans` — usar UM dos dois fluxos, nunca os dois na mesma tarefa |
| Antes de `vercel deploy --prod` (mudança pequena) | `/quickreview` ou `verification-quality` | Sempre antes de qualquer deploy |
| Antes de `vercel deploy --prod` (nova funcionalidade) | `/review` ou `github-code-review` | Antes de commit em `main.jsx`, `appscript.gs` ou `api/*.js` |
| Antes de deploy importante / suspeita de regressão | `/ultrareview-financeiroop` | Feature grande, refactor GAS, nova integração |
| UI React lenta ou muitos re-renders | `performance-analysis` | Quando o usuário reportar lentidão ou ao otimizar componentes |
| Testar o app em produção via browser | `browser` | Quando precisar verificar comportamento no app ao vivo |
| Configurar novos hooks do Claude Code | `hooks-automation` | Ao criar ou editar hooks no projeto |

### Regras de ativação

- `brainstorming`: ativar ANTES de qualquer trabalho criativo (feature nova, componente novo, mudança de comportamento) — inclusive tarefas que "parecem simples". Só pular para mudanças puramente mecânicas de Tier 1 (texto, cor, typo). Gate rígido: nenhum código antes do design ser apresentado e aprovado pelo usuário
- `writing-plans`: ativar assim que o usuário aprovar o design/spec do `brainstorming`, antes de escrever qualquer código
- `pair-programming`: ativar na etapa de implementação (depois do plano do `writing-plans` pronto) em toda tarefa de código com mais de 20 linhas alteradas
- `sparc-methodology`: usar como alternativa a `brainstorming` + `writing-plans` quando a tarefa tiver mais de 3 etapas distintas ou envolver design de sistema — escolher um fluxo só, não rodar os dois
- `/quickreview`: mudanças pequenas (Tier 1) — 5 min
- `/review`: novas funcionalidades (Tier 2) — 15 min
- `/ultrareview-financeiroop`: deploys importantes, features de GAS ou integrações (Tier 3) — 30–45 min. **Não usar semanalmente por rotina — use event-based.**

---

## Roadmap do produto

| Fase | Descrição | Estado |
|---|---|---|
| 1A.1 | Design System Wise completo | Concluído |
| 1A.2 | Refatoração shadcn (Dashboard ✅, Cobrança ✅, demais 8 abas em sequência) | Em andamento |
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
