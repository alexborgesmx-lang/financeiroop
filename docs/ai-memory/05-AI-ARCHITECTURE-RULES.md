# ARQUITETURA

Sempre verificar:

- DRY
- SOLID
- KISS
- Separation of Concerns

---

## Refatoração

Identificar:

- Código duplicado
- Componentes duplicados
- Hooks duplicados
- Consultas duplicadas
- Validações duplicadas

Sempre sugerir unificação.

---

## Componentização

Priorizar:

- Componentes reutilizáveis
- Hooks reutilizáveis
- Utilitários reutilizáveis

---

## Regras de Negócio

Nenhuma regra financeira deve ficar espalhada em múltiplos locais.

Toda regra crítica deve possuir fonte única de verdade.

---

## Stack — Regras Específicas

### Frontend (`src/main.jsx`)

- Sem CSS externo — 100% inline styles com variáveis de tema.
- Sem componentes separados — tudo em `src/main.jsx`.
- Componentes shadcn/ui usados para estrutura (`Card`, `Button`, `Dialog`, `Table`).
- Inline styles para cores semânticas dinâmicas (GRN, RED, YEL, BLU, ORG, etc.).
- Layout via Tailwind classes (`flex`, `grid`, `gap-*`).

### Backend (`appscript.gs`)

- Mapa dinâmico de colunas — nunca usar índice fixo. Sempre `buildColMap(sheet)`.
- Escrever por nome de coluna via `setCel(sheet, row, cm, "NOME_COLUNA", value)`.
- IDs sequenciais via `proximoIdSeq(sheet, "PREFIX")`.
- Datas via `parseDateLocal(s)` — nunca `new Date("YYYY-MM-DD")`.

### API (`api/*.js`)

- Proxies Vercel simples → GAS ou serviços externos.
- Middleware protege todas as rotas exceto `/api/login`, `/api/whatsapp`, `/api/webhook-efi`, `/api/efi-check-payments`, `/api/efi-pix-avulso`, `/api/efi-setup-webhook`, `/api/cert`, `/c/` (matcher em `middleware.js`; `/api/logout` tem early-return dentro da função, não está no matcher).
- `api/cert.js` — página HTML pública (fora do React), serve `/c/:code` via rewrite em `vercel.json`. Renderiza o certificado de quitação chamando a action `buscarCertificado` no GAS. Sem auth — CPF sempre mascarado.
- `api/efi-pix-avulso.js` — chamado pelo GAS (não pelo frontend) para gerar PIX avulso por parcela na régua de cobrança. Autenticado via header `x-cobranca-secret` (env `COBRANCA_SECRET`).
- **Limite Hobby: 12 Serverless Functions.** `.vercelignore` exclui `api/efi-setup-webhook.js` e `api/efi-test-webhook.js`. Ao adicionar novo arquivo em `api/`, verificar se ultrapassa o limite.
- **APIs chamadas diretamente do browser** (sem proxy): ViaCEP, BrasilAPI CEP, AwesomeAPI CEP, Nominatim — todas suportam CORS.
- **APIs que exigem proxy Vercel**: BrasilAPI CNPJ, ReceitaWS — CORS bloqueado no browser.
- **`api/feriados.js`** — proxy para Nager.Date, retorna feriados BR ano atual + próximo. Cache 24h.

---

## Banco de Dados (Google Sheets)

| Aba | Função |
|---|---|
| `CLIENTES` | Cadastro completo dos clientes (inclui PERFIL_COBRANCA, CNPJ_EMPREGADOR, SITUACAO_EMPREGADOR, DATA_ABERTURA_EMPREGADOR, CODIGO_IBGE, LATITUDE, LONGITUDE) |
| `CONTRATOS` | Um registro por contrato (inclui colunas DATA_ENTRADA_ACORDO_ASSISTIDO, MOTIVO_ACORDO_ASSISTIDO, OBSERVACAO_ACORDO_ASSISTIDO, VALOR_ABATIDO_ASSISTIDO) |
| `PARCELAS` | Uma linha por parcela de cada contrato |
| `PAGAMENTOS` | Registro de cada pagamento efetuado (inclui abatimento_acordo_assistido sem ID_PARCELA) |
| `PROMESSAS` | Acordos/promessas de pagamento com data prevista |
| `EVENTOS` | Log de todas as ações do sistema |
| `CONFIGURACOES` | Parâmetros globais |
| `ACORDOS` | Registros de acordos formais |
| `LEADS` | Leads captados pelo bot WhatsApp |
| `MENSAGENS` | Log de disparos da régua de cobrança WhatsApp (STATUS_ENVIO: ENVIADO/ERRO_ENVIO/ERRO_SEM_PIX) |
| `PADRINHOS` | Tabela analítica de padrinhos (gerada automaticamente) |
| `EMPREGADORES` | Tabela analítica de empregadores (gerada automaticamente) |
| `UNDO_LOG` | Motor de undo (2026-07-04) — operações reversíveis por até 15 min |
| `QUITACOES` | Propostas de quitação antecipada via PIX (2026-07-04) — expira em 48h |
| `CERTIFICADOS` | Certificados públicos de quitação (2026-07-04) |
| `AUDITORIA` | Log da auditoria diária de integridade (2026-07-04) — fora de `ABAS`, criada sob demanda |
| `OPERACOES_PROCESSADAS` | Log de idempotência de webhooks (2026-07-04) — fora de `ABAS`, criada sob demanda |

Nenhuma linha pode ser deletada fisicamente — apenas cancelamentos/estornos lógicos.

---

## Padrão de Compensating Transactions (Undo)

Operações financeiras reversíveis (pagamento, quitação antecipada, acordo com perda, recuperação pós-baixa, abatimento assistido, baixa por prejuízo) seguem o padrão:

1. Ao concluir a operação, chamar `registrarUndo(tipo, idContrato, idCliente, nomeCli, payload)` — `payload` guarda o estado anterior suficiente para reverter (ex: valores de contrato antes da mudança, IDs de linhas criadas).
2. `reverterOperacao(idUndo, motivo)` faz dispatch por `tipo` para um handler `_reverter<Tipo>` dedicado, que desfaz exatamente o que a operação fez (reabre parcela, deleta linha criada, restaura valores do `payload`).
3. TTL fixo de 15 min (`UNDO_TTL_MS`). Fora da janela, `reverterOperacao` marca `EXPIRADO` e recusa.
4. Trava de ordem: só reverte a operação mais recente do contrato — se existir uma mais nova ainda `ATIVO`, bloqueia e exige reverter na ordem inversa (evita corromper estado intermediário).
5. Toda reversão grava evento `UNDO_REVERTIDO` em EVENTOS com o motivo.

**Nova operação reversível → sempre seguir esse padrão** (registrar undo + handler `_reverter*` dedicado), nunca implementar reversão ad-hoc dentro da função principal.

---

## Padrão de Idempotência (webhooks)

Webhooks externos (Efí Bank) podem reentregar o mesmo evento mais de uma vez. Padrão:

```javascript
if (_idem_check(chave)) { /* já processado — noop ou log de duplicata */ }
// ...processa a operação...
_idem_reg(chave, tipo, meta);
```

- `chave` deve ser prefixo fixo + identificador do evento (ex: `"WEBHOOK_EFI_" + txid`, `"QUIT_" + txidBase`), nunca só o identificador cru — evita colisão entre fluxos diferentes que reaproveitam o mesmo TXID.
- Sufixos de retry do provedor (ex: `R1`/`R2` da Efí) devem ser removidos da chave antes de checar, senão cada retry vira "novo" evento.
- Toda nova integração por webhook que grava dado financeiro **deve** passar por `_idem_check`/`_idem_reg` antes de processar — sem isso, reentrega duplica pagamento/quitação.

---

## STATUS_CONTRATO é a única fonte de verdade de status de contrato

**Regra inviolável:** toda lógica de filtragem, exibição, KPIs, contadores e decisões de negócio usa **exclusivamente `STATUS_CONTRATO`**.

A coluna `STATUS_CARTEIRA` existe na aba CONTRATOS mas é **coluna auxiliar/legado** — não é lida em nenhum lugar do frontend (`src/main.jsx`) e não deve ser usada em nenhuma lógica nova. Ela serve apenas como label complementar visível ao ler o Sheets diretamente.

**Nunca construir lógica em `STATUS_CARTEIRA`.** Se houver dúvida sobre status de um contrato, consultar `STATUS_CONTRATO`.

Valores válidos de `STATUS_CONTRATO`:
```
ativo_em_dia | ativo_em_atraso | em_cobranca | pre_prejuizo
acordo_assistido | renegociado | quitado | cancelado
em_recuperacao | recuperado_parcialmente | recuperado_integralmente
baixado_como_prejuizo | encerrado_sem_recuperacao
em_processo_judicial | encerrado_judicialmente
```
`em_processo_judicial` **não é status final** — é uma fase ativa (Recuperação Judicial, implementado 2026-07-04) que só transiciona para o status terminal `encerrado_judicialmente` quando a dívida é resolvida ou o processo é arquivado. O detalhe do desfecho fica em `SITUACAO_FINANCEIRA_JUDICIAL` (campo independente), nunca em `STATUS_CONTRATO`. Ver `02-AI-CREDIT-RULES.md` e `03-AI-FINANCIAL-CALCULATIONS.md`.

---

## Constantes de Status no Frontend

**REGRA INVIOLÁVEL:** Nunca redefinir localmente. Usar sempre as constantes globais canônicas.

### Parcelas terminais — `_ST_TERMINAL` (main.jsx linha ~67)
```javascript
const _ST_TERMINAL = new Set([
  "pago","quitacao_antecipada","baixado_como_prejuizo","cancelado","renegociado"
]);
```

### Contratos ativos — `_ST_ATIVOS` (main.jsx linha ~69)
```javascript
const _ST_ATIVOS = new Set([
  "ativo","ativo_em_dia","ativo_em_atraso","em_cobranca","pre_prejuizo",
  "renegociado","em_recuperacao","recuperado_parcialmente",
  "acordo_assistido"  // score congelado mas capital ainda em circulação
]);
```
Usar em todo filtro de "contratos ativos": Dashboard, Gestão, M useMemo, PagamentoDrop, etc.
**Nunca** redefinir como array local (`ST_ATIVOS_G`, `ST_ATIVOS_PAG`, etc.) — usa-se `_ST_ATIVOS.has(...)`.

**`em_processo_judicial` propositalmente NÃO está em `_ST_ATIVOS`** — vive em bucket próprio `_ST_JUDICIAL` (abaixo), para não contaminar KPIs de "capital em circulação" com dívida em fase judicial.

### Contratos em Recuperação Judicial — `_ST_JUDICIAL` (main.jsx, adicionado 2026-07-04)
```javascript
const _ST_JUDICIAL = new Set(["em_processo_judicial"]);
```
Bucket próprio, separado de ativos/baixados/perdas. Usado na Carteira para o card "Capital em Judicial" (base = `PREJUIZO_CAPITAL`/`VALOR_EXECUTADO`, nunca `principalAberto` de `perdaInfoMap`, que não é confiável para contratos judiciais).

### Contratos excluídos da Cobrança — `_ST_CONTRATO_EXCLUIDO` (main.jsx linha ~68)
```javascript
const _ST_CONTRATO_EXCLUIDO = new Set([
  "acordo_assistido",  // ← excluído da fila de cobrança
  "baixado_como_prejuizo","em_recuperacao","recuperado_parcialmente",
  "recuperado_integralmente","encerrado_sem_recuperacao","cancelado","quitado","renegociado",
  "em_processo_judicial","encerrado_judicialmente"
]);
```

### Contratos em Perdas & Recuperação — `STATUS_PERDA`
```javascript
const STATUS_PERDA = [
  "em_cobranca","pre_prejuizo","baixado_como_prejuizo","em_recuperacao","recuperado_parcialmente",
  "encerrado_sem_recuperacao","acordo_assistido","em_processo_judicial","encerrado_judicialmente"
];
```

### Parcelas de acordo judicial — `ORIGEM_PARCELA = "acordo_judicial"` (adicionado 2026-07-04)
Parcelas geradas por `registrarAcordoJudicial` (acordo parcelado) reaproveitam a aba PARCELAS normal, marcadas com `ORIGEM_PARCELA="acordo_judicial"` — mesmo padrão de `"gerada_por_pagamento_de_juros"` (somente_juros) e `"renegociada"`. `registrarPagamentoAPI` detecta essa origem automaticamente e desvia para a cascata de recuperação judicial (`_alocarRecuperacaoJudicial`) em vez do fluxo normal de receita — **não existe action própria para pagar parcela de acordo judicial**, é o mesmo `action:"pagamento"` de sempre.

### STATUS_PROMESSA — sempre UPPERCASE no Sheets
```javascript
// Valores reais gravados no Sheets: "PENDENTE" | "CUMPRIDA" | "QUEBRADA"
// CORRETO (whitelist explícita):
.filter(p => String(p.STATUS_PROMESSA||"").toUpperCase() === "PENDENTE")
// ERRADO (exclusão com toLowerCase inclui QUEBRADA indevidamente como "ativa"):
.filter(p => !["cumprida","cancelada"].includes(String(p.STATUS_PROMESSA||"").toLowerCase()))
```

### Status terminais de contrato no GAS (trigger diário não reverte)
```javascript
// Variável global em appscript.gs (linha ~27): STATUS_TERMINAL
// Nunca redefinir localmente como var TERMINAL={} ou var ST_FIM={} — usar STATUS_TERMINAL diretamente
var STATUS_TERMINAL = {
  pago:1, quitacao_antecipada:1, baixado_como_prejuizo:1, cancelado:1, renegociado:1
};
// statusFinais em atualizarStatusContratos (lista para o trigger):
const statusFinais = [
  "baixado_como_prejuizo","em_recuperacao","recuperado_parcialmente",
  "recuperado_integralmente","encerrado_sem_recuperacao","cancelado","renegociado","quitado",
  "acordo_assistido","em_processo_judicial","encerrado_judicialmente"
];
// acordo_assistido é interceptado ANTES de statusFinais (regra própria dos 180 dias)
// em_processo_judicial/encerrado_judicialmente: aging normal (statusPorDias) nunca se aplica —
// só transicionam via registrarAcordoJudicial/registrarQuitacaoJudicial/arquivarProcessoJudicial
// ou pagamento da última parcela de um acordo judicial parcelado.
```

---

## Constantes de Perfil de Cobrança

```javascript
const PERFIL_COR = {
  COOPERATIVO: GRN,      // verde
  NEUTRO: MUTED,         // cinza
  RESISTENTE: ORG,       // laranja
  EVASIVO: RED           // vermelho
};

const PERFIL_LABEL = {
  COOPERATIVO: "Cooperativo",
  NEUTRO: "Neutro",
  RESISTENTE: "Resistente",
  EVASIVO: "Evasivo"
};
```

Estas constantes ficam após `STATUS_PERDA` em `src/main.jsx` (~linha 128).

---

## Cor do Acordo Assistido

```javascript
const BLU = "#1B8A8F"; // Deep Teal — cor de todos os elementos UI do Acordo Assistido
```

Usar BLU para: badges, cards, botões e labels relacionados ao `acordo_assistido`.
