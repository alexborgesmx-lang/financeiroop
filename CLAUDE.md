# FinanceiroOp — Instruções para Claude

Sistema de gestão de empréstimos pessoais (financeira informal). Proprietário: Alex Borges (alexborges.mx@gmail.com).

---

## Stack

```
React 18 + Vite  (src/main.jsx — arquivo único)
    │
    ├── GET  /api/sheets  → GAS doGet()   → lê todas as abas do Sheets
    └── POST /api/action  → GAS doPost()  → executa todas as ações de escrita
                                │
                         Google Sheets (banco de dados)
```

---

## Arquivos críticos

| Arquivo | Papel |
|---|---|
| `src/main.jsx` | Toda a UI React (~3500+ linhas). Um único arquivo — sem componentes externos. |
| `appscript.gs` | Backend Google Apps Script — doGet, doPost, triggers, helpers |
| `api/action.js` | Proxy Vercel → GAS (POST). GAS_URL hardcoded neste arquivo. |
| `api/efi-charges.js` | Geração de cobranças PIX com vencimento (cobv) na Efí Bank |
| `api/efi-auth.js` | OAuth2 Efí Bank |
| `api/webhook-efi.js` | Webhook de confirmação de pagamento Efí |
| `api/login.js` | Autenticação por senha (cookie `fp_session`) |
| `api/logout.js` | Limpa cookie de sessão |
| `middleware.js` | Protege todas as rotas exceto /api/login e /api/logout |
| `vercel.json` | Rewrite: `/api/sheets` → GAS doGet URL |

**GAS Web App URL** (mesma em `api/action.js` e `vercel.json`):
```
https://script.google.com/macros/s/AKfycbynQKpafDbaBTT-jqs4nCSzbbx8A72MAqDyGxwy86lIt0ykZxeFT8IdlO7zjj0rJEHy7Q/exec
```

---

## Regras de deploy — SEMPRE seguir

### Após editar `src/main.jsx` ou qualquer arquivo em `api/`:
```bash
vercel deploy --prod
```
Executar via Bash imediatamente após salvar. Não esperar o usuário pedir.

### Após editar `appscript.gs`:
```bash
open -a "TextEdit" /Users/alexborges/financeiroop/appscript.gs
```
Depois instruir o usuário: **Cmd+A → Cmd+C → colar no editor do Google Apps Script → publicar nova versão do Web App**. Fazer isso automaticamente, sem esperar o usuário pedir. NUNCA entregar só o trecho alterado — o GAS exige substituição do arquivo completo.

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
```

**Trigger diário** — 7h: `atualizarStatusParcelas()` + `atualizarStatusContratos()`

**Sanitizadores** disponíveis no GAS:
```javascript
_sanitNome(s)   // título case + remove dígitos
_soDigitos(s)   // só números
_soLetras(s)    // só letras
_emailFix(s)    // lowercase + remove espaços
```

---

## Padrões do frontend (`src/main.jsx`)

### Sistema de tema (dark/light)
```javascript
// Variáveis de cor no módulo — reavaliadas a cada render via IS()/LS()
let BG, CARD, TEXT, MUTED, BD, ORG, GRN, RED, YEL, BLU, PUR

applyTheme(dark)   // atualiza todas as variáveis de cor
IS()               // inline style para inputs — usa cores atuais
LS()               // inline style para labels — usa cores atuais

// Dark mode: ativa às 18h, desativa às 6h (automático por setTimeout)
// Toggle manual é session-only (sem localStorage)
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
titleCasePT(s)            // title case respeitando preposições PT (de, da, do, dos, das, e...)
normTel(s)                // normaliza telefone: remove não-dígitos, 10→11 dígitos (add 9)
fixEmail(s)               // lowercase + corrige @gmail.com.br → @gmail.com
```

### Status terminais de parcela
```javascript
const _ST_TERMINAL = new Set([
  "pago", "quitacao_antecipada", "baixado_como_prejuizo", "cancelado", "renegociado"
]);
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

---

## Integrações externas

### Efí Bank (PIX)
- **Tipo**: `cobv` (cobrança com vencimento)
- **Credenciais** (env Vercel): `EFI_CLIENT_ID`, `EFI_CLIENT_SECRET`, `EFI_PIX_KEY`
- **Certificado**: `producao-849675-financeiroop.p12` (raiz do repo)
- **Ambiente**: produção (`sandbox: false`)
- CPF deve ter sempre 11 dígitos com `padStart(11, "0")`

### ZapSign (assinatura eletrônica)
- **Token**: hardcoded em `appscript.gs` linha ~16 (`ZAPSIGN_TOKEN`)
- **Ambiente**: produção (`sandbox: false`)
- Fluxo: exporta contrato Google Docs como PDF → envia para ZapSign → retorna link de assinatura do credor

### Google Forms (cadastro de clientes)
- Trigger `onFormSubmit` no GAS processa o formulário e cria linha em CLIENTES
- Títulos EXATOS das perguntas (case-sensitive, acentos importam):
  - `"Nome Completo"`, `"CPF (somente numeros)"`, `"RG (somente numeros)"`
  - `"WhatsApp com DDD (Somente números)"`, `"E-mail (tudo minúsculo)"`
  - `"Nome de Pessoa de confiança 1"`, `"Telefone de Pessoa de confiança 1"`
  - `"Nome de Pessoa de confiança 2"`, `"Telefone de Pessoa de confiança 2"`
  - `"Data de vencimento da primeira parcela"` (campo TEXTO, retorna número 1–31)
  - `"Nome da pessoa que te indicou nossos serviços"` (padrinho)
- Status inicial do cliente: `aguardando_conferencia`
- TEL_PADRINHO: lookup automático no CLIENTES por nome fuzzy (normaliza acentos, busca substring)

### Autenticação
- Cookie `fp_session` = HMAC-SHA256 da senha com `LOGIN_SECRET`
- Env vars Vercel: `LOGIN_PASSWORD`, `LOGIN_SECRET`
- Sessão dura 30 dias

---

## Abas do frontend (UI)

| Aba | Conteúdo |
|---|---|
| Dashboard | KPIs, Em Atraso, últimos pagamentos |
| Clientes | Lista + ClienteModal (perfil/editar/contratos/todos os dados) |
| Contratos | Lista + ContratoModal (parcelas/pagamentos) |
| Cobrança | Parcelas vencidas agrupadas por cliente |
| Financeiro | Histórico de pagamentos filtrado por período |
| Perdas & Recuperação | Contratos baixados, acordos, recuperações |
| Promessas | Acordos de pagamento futuros |
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
3. GAS cria contrato + parcelas + gera doc Google Docs a partir do template
4. Modal de sucesso oferece: abrir doc, enviar ZapSign, gerar Carnê PIX (Efí), enviar WhatsApp

---

## Fluxo de novo cliente (formulário)

1. Cliente preenche Google Form
2. `onFormSubmit` cria linha em CLIENTES com `STATUS_CLIENTE = aguardando_conferencia`
3. Admin abre `ClienteModal` → aba Editar → preenche campos faltantes → salva → status vira `ativo`
4. Observação padrão do formulário é apagada automaticamente na primeira aprovação

---

## Bugs conhecidos / armadilhas

| Problema | Causa | Solução |
|---|---|---|
| Data um dia antes no Sheets | `new Date("2026-05-30")` = UTC midnight → UTC-3 = 29/05 | Sempre usar `parseDateLocal(s)` que cria `new Date(y, m, d, 12, 0, 0)` |
| Parcela não some de "Em Atraso" | `DATA_ACORDO` não foi limpa no pagamento | `registrarPagamentoAPI` limpa `DATA_ACORDO` ao pagar |
| Contrato baixado ainda aparece em atraso | Só verificava STATUS da parcela, não do contrato | `parcelasAtrasadas` filtra contratos com status terminal |
| TEL_PADRINHO vazio | Nome digitado no form não bate exato com CLIENTES | Lookup fuzzy por substring + normalização de acentos |
| Campos de confiança não preenchidos | GAS com título errado da pergunta do formulário | Títulos exatos com acentos e números (ver seção Forms acima) |
