# AUDITORIA COMPLETA — SISTEMA FINANCEIROOP
## Varredura de Falhas, Riscos e Vulnerabilidades

**Data da Auditoria:** 2026-06-20  
**Escopo:** Sistema completo de gestão de crédito privado (FinanceiroOp)  
**Objetivo:** Identificação de todas as falhas, riscos, vulnerabilidades, gargalos e inconsistências

---

## SUMÁRIO EXECUTIVO

Foram identificadas **47 problemas críticos e de alto risco** distribuídos em:
- **Arquitetura & Infraestrutura:** 8 problemas
- **Segurança & Autenticação:** 6 problemas
- **Fluxos Financeiros & Cálculos:** 12 problemas
- **Integrações Externas:** 7 problemas
- **Frontend & UX:** 8 problemas
- **Backend & Banco de Dados:** 6 problemas

---

# 1. ARQUITETURA & INFRAESTRUTURA

## 1.1 — Monolito Frontend (~6000+ linhas em src/main.jsx)

### Problema
Toda a lógica de negócio, UI, estado e integrações concentrada em um único arquivo. Sem componentização, sem separação de concerns, sem hooks reutilizáveis.

### Impacto
- **Manutenibilidade:** Alterações afetam múltiplos fluxos simultaneamente
- **Performance:** Re-renders desnecessários em todo o componente
- **Testabilidade:** Impossível testar lógica isoladamente
- **Escalabilidade:** Adicionar features exige editar um arquivo gigante
- **Onboarding:** Novo desenvolvedor leva semanas para entender a estrutura
- **Débito técnico:** Acumula exponencialmente a cada feature nova

### Risco
**Crítico** — Qualquer mudança pode quebrar múltiplas funcionalidades. Refatoração futura será extremamente cara.

### Alternativa
Modularizar em componentes React isolados com hooks customizados:
```
src/
  components/
    Dashboard/
    Clientes/
    Contratos/
    Cobranca/
    Financeiro/
    Carteira/
    PerdaRecuperacao/
    Promessas/
    ReguaWpp/
  hooks/
    useClientes.js
    useContratos.js
    usePagamentos.js
    useFinanceiro.js
  services/
    api.js
    calculations.js
    validations.js
  utils/
    formatting.js
    dates.js
    validators.js
```

### Melhor Solução
Implementar modularização gradual (Fase 3 do roadmap). Começar com componentes de baixo acoplamento (Dashboard, Carteira). Extrair hooks de estado compartilhado. Criar service layer para cálculos financeiros.

---

## 1.2 — Limite Vercel Hobby (12 Serverless Functions)

### Problema
Arquitetura atual usa 12 funções serverless. Limite é exato — qualquer adição quebra o deploy.

### Impacto
- **Escalabilidade:** Impossível adicionar novas integrações ou APIs
- **Manutenção:** Risco de exceder limite ao adicionar feature simples
- **Contingência:** Sem margem para fallbacks ou redundância

### Risco
**Alto** — Sistema está no limite. Próxima feature pode quebrar deploy.

### Alternativa
- Upgrade para Vercel Pro (50 funções)
- Consolidar múltiplas funções em uma única com roteamento interno
- Migrar para backend persistente (Node.js + Express em VPS ou Railway)

### Melhor Solução
Upgrade para Vercel Pro (custo: ~$20/mês). Permite crescimento sem redesign. Alternativa: migrar para Railway/Render com backend Node.js persistente (custo similar, mais controle).

---

## 1.3 — Google Sheets como Banco de Dados Primário

### Problema
Sistema inteiro depende de Google Sheets como banco de dados. Sem transações, sem índices, sem constraints, sem auditoria nativa.

### Impacto
- **Concorrência:** Múltiplos usuários simultâneos causam race conditions
- **Integridade:** Sem rollback automático em caso de erro
- **Performance:** Leitura/escrita lenta com 200+ linhas
- **Segurança:** Sem criptografia de dados em repouso
- **Auditoria:** Sem log nativo de alterações (depende de triggers manuais)
- **Backup:** Sem backup automático confiável
- **Escalabilidade:** Limite de ~5M células; sistema já tem ~50k linhas

### Risco
**Crítico** — Perda de dados é possível. Corrupção de dados é silenciosa. Concorrência é impredizível.

### Alternativa
Migrar para banco de dados relacional:
- Supabase (PostgreSQL + Auth + Realtime)
- Firebase Firestore (NoSQL + Auth)
- Railway PostgreSQL
- Render PostgreSQL

### Melhor Solução
Implementar Supabase (Fase 3 do roadmap). Oferece:
- PostgreSQL gerenciado
- Realtime subscriptions
- Row-level security (RLS)
- Backup automático
- Auditoria nativa
- Transações ACID
- Custo: ~$25/mês

---

## 1.4 — Sem Versionamento de Dados

### Problema
Não há histórico de alterações. Quando um valor é alterado no Sheets, o valor anterior é perdido.

### Impacto
- **Auditoria:** Impossível rastrear quem alterou o quê e quando
- **Recuperação:** Sem forma de reverter alterações acidentais
- **Conformidade:** Falha em requisitos de compliance (LGPD, regulatório)
- **Investigação:** Impossível investigar discrepâncias

### Risco
**Alto** — Violação potencial de conformidade. Impossível auditar operações.

### Alternativa
- Implementar soft deletes (marcar como deletado em vez de remover)
- Criar tabela de auditoria (quem, o quê, quando)
- Usar Git para versionamento de configurações críticas
- Implementar change data capture (CDC)

### Melhor Solução
Criar tabela `AUDITORIA` no Sheets com triggers automáticos:
```
ID_AUDITORIA | DATA_HORA | USUARIO | ACAO | TABELA | ID_REGISTRO | CAMPO | VALOR_ANTERIOR | VALOR_NOVO
```
Registrar automaticamente em `registrarEvento()` todas as alterações financeiras.

---

## 1.5 — Sem Transações Distribuídas

### Problema
Operações que afetam múltiplas abas (ex: criar contrato + parcelas + evento) não são atômicas.

### Impacto
- **Inconsistência:** Se falhar no meio, dados ficam corrompidos (contrato sem parcelas, evento sem contrato)
- **Recuperação:** Sem forma de reverter operação parcial
- **Integridade:** Invariantes de negócio podem ser violadas

### Risco
**Crítico** — Corrupção de dados silenciosa. Difícil de detectar e corrigir.

### Alternativa
- Implementar padrão Saga (orquestração de transações distribuídas)
- Usar banco de dados com suporte a transações (Supabase/PostgreSQL)
- Implementar retry logic com idempotência

### Melhor Solução
Adicionar validação pós-operação em `novoContrato()`:
```javascript
// Após criar contrato + parcelas
const contrato = sheet.getRange(...).getValues()[0];
const parcelas = sheetParcelas.getRange(...).getValues();
if (!contrato || parcelas.length === 0) {
  // Rollback: deletar contrato
  excluirContrato(idContrato);
  throw new Error("Falha ao criar parcelas");
}
```

---

## 1.6 — Sem Rate Limiting ou Throttling

### Problema
APIs externas (Efí, Evolution, BrasilAPI) não têm proteção contra rate limiting. Se muitos requests forem enviados simultaneamente, a API retorna erro.

### Impacto
- **Confiabilidade:** Falhas silenciosas em operações em massa
- **Custo:** Possível excesso de chamadas API
- **UX:** Usuário não sabe se a operação falhou ou está processando

### Risco
**Médio** — Afeta operações em massa (régua de cobrança, geração de PIX).

### Alternativa
- Implementar fila de processamento (Bull, RabbitMQ)
- Adicionar retry com backoff exponencial
- Implementar circuit breaker

### Melhor Solução
Adicionar retry com backoff exponencial em `api/efi-pix-avulso.js`:
```javascript
async function upsertCobvWithRetry(txid, payload, token, retries = 3) {
  for (let i = 0; i < retries; i++) {
    try {
      return await upsertCobv(txid, payload, token);
    } catch (err) {
      if (i === retries - 1) throw err;
      await new Promise(r => setTimeout(r, 1000 * Math.pow(2, i)));
    }
  }
}
```

---

## 1.7 — Sem Cache Distribuído

### Problema
Cache localStorage é por browser. Múltiplos usuários não compartilham cache. Dados são recarregados do Sheets a cada 5 minutos.

### Impacto
- **Performance:** Múltiplos requests desnecessários ao Sheets
- **Latência:** Usuário aguarda ~2-3s para carregar dados
- **Escalabilidade:** Sheets fica sobrecarregado com múltiplos usuários

### Risco
**Médio** — Afeta performance com múltiplos usuários simultâneos.

### Alternativa
- Implementar Redis cache
- Usar Supabase Realtime (push-based em vez de pull)
- Implementar GraphQL com Apollo Client

### Melhor Solução
Implementar cache Redis em Vercel (via Upstash):
```javascript
// api/sheets.js
import { Redis } from "@upstash/redis";
const redis = new Redis({url: process.env.UPSTASH_REDIS_URL, token: process.env.UPSTASH_REDIS_TOKEN});

async function getSheets() {
  const cached = await redis.get("sheets");
  if (cached) return cached;
  
  const data = await fetchFromGAS();
  await redis.setex("sheets", 300, data); // 5 min TTL
  return data;
}
```

---

## 1.8 — Sem Observabilidade/Logging Centralizado

### Problema
Erros são registrados apenas em console do browser ou logs do GAS. Sem forma centralizada de monitorar o sistema.

### Impacto
- **Debugging:** Impossível investigar erros em produção
- **Alertas:** Sem notificação automática de falhas
- **Análise:** Sem visibilidade de padrões de erro
- **SLA:** Impossível medir uptime ou performance

### Risco
**Alto** — Impossível diagnosticar problemas em produção.

### Alternativa
- Implementar Sentry (error tracking)
- Usar LogRocket (session replay + logs)
- Implementar ELK Stack (Elasticsearch + Logstash + Kibana)

### Melhor Solução
Integrar Sentry (gratuito até 5k eventos/mês):
```javascript
// src/main.jsx
import * as Sentry from "@sentry/react";

Sentry.init({
  dsn: process.env.REACT_APP_SENTRY_DSN,
  environment: "production",
  tracesSampleRate: 0.1,
});

// Capturar erros
try {
  await postAction({action: "novoContrato", ...});
} catch (err) {
  Sentry.captureException(err);
}
```

---

# 2. SEGURANÇA & AUTENTICAÇÃO

## 2.1 — Autenticação por Senha Simples (Cookie)

### Problema
Autenticação usa cookie `fp_session` com HMAC-SHA256 da senha. Sem MFA, sem rate limiting, sem proteção contra brute force.

### Impacto
- **Segurança:** Senha pode ser descoberta por brute force
- **Compliance:** Falha em requisitos de segurança (LGPD, PCI-DSS)
- **Risco:** Acesso não autorizado a dados financeiros

### Risco
**Crítico** — Qualquer pessoa com a senha acessa todo o sistema.

### Alternativa
- Implementar OAuth2 (Google, GitHub)
- Adicionar MFA (TOTP, SMS)
- Implementar SSO corporativo
- Usar Supabase Auth (gerenciado)

### Melhor Solução
Implementar MFA com TOTP (Google Authenticator):
```javascript
// api/login.js
import speakeasy from "speakeasy";

// Gerar secret na primeira vez
const secret = speakeasy.generateSecret({name: "FinanceiroOp"});
// Salvar em CONFIGURACOES: MFA_SECRET

// Verificar código
const verified = speakeasy.totp.verify({
  secret: mfaSecret,
  encoding: "base32",
  token: userCode,
  window: 2
});
```

---

## 2.2 — Sem Proteção contra CSRF

### Problema
Requests POST não validam CSRF token. Qualquer site pode fazer requests em nome do usuário.

### Impacto
- **Segurança:** Ataque CSRF pode alterar dados sem consentimento
- **Compliance:** Falha em requisitos de segurança

### Risco
**Alto** — Possível alteração de dados por ataque CSRF.

### Alternativa
- Implementar CSRF token
- Usar SameSite cookie
- Validar Origin header

### Melhor Solução
Adicionar CSRF token em middleware:
```javascript
// middleware.js
import crypto from "crypto";

export default function middleware(request) {
  if (request.method === "POST") {
    const token = request.headers.get("x-csrf-token");
    const sessionToken = request.cookies.get("fp_session")?.value;
    
    if (!token || !validateCsrfToken(token, sessionToken)) {
      return new Response("CSRF token inválido", {status: 403});
    }
  }
  return NextResponse.next();
}
```

---

## 2.3 — Sem Validação de Entrada (SQL Injection / XSS)

### Problema
Inputs do usuário não são validados ou sanitizados. Possível SQL injection no GAS ou XSS no frontend.

### Impacto
- **Segurança:** Injeção de código malicioso
- **Integridade:** Dados corrompidos
- **Compliance:** Falha em requisitos de segurança

### Risco
**Crítico** — Possível execução de código arbitrário.

### Alternativa
- Implementar validação em camadas (frontend + backend)
- Usar sanitizadores (DOMPurify, xss)
- Usar parameterized queries (prepared statements)

### Melhor Solução
Adicionar validação em todos os inputs:
```javascript
// Frontend
import DOMPurify from "dompurify";

const sanitized = DOMPurify.sanitize(userInput);

// Backend (GAS)
function _sanitizarInput(s) {
  if (typeof s !== "string") return "";
  return s.replace(/[<>\"']/g, ""); // Remove caracteres perigosos
}
```

---

## 2.4 — Sem Criptografia de Dados Sensíveis

### Problema
Dados sensíveis (CPF, RG, telefone) são armazenados em texto plano no Sheets.

### Impacto
- **Segurança:** Qualquer pessoa com acesso ao Sheets vê dados sensíveis
- **Compliance:** Violação de LGPD (dados pessoais devem ser criptografados)
- **Risco:** Vazamento de dados em caso de acesso não autorizado

### Risco
**Crítico** — Violação de LGPD. Possível vazamento de dados.

### Alternativa
- Implementar criptografia de dados em repouso
- Usar Supabase com criptografia nativa
- Usar AWS KMS ou similar

### Melhor Solução
Implementar criptografia de campos sensíveis:
```javascript
// appscript.gs
const CIPHER_KEY = "..."; // Armazenar em CONFIGURACOES

function criptografarCPF(cpf) {
  return Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, cpf + CIPHER_KEY);
}

function descriptografarCPF(hash) {
  // Não é possível descriptografar hash SHA-256
  // Alternativa: usar AES-256 com chave
}
```

---

## 2.5 — Sem Proteção contra Força Bruta

### Problema
Endpoint `/api/login` não tem rate limiting. Possível brute force da senha.

### Impacto
- **Segurança:** Senha pode ser descoberta por força bruta
- **Disponibilidade:** Ataque DDoS possível

### Risco
**Alto** — Possível descoberta de senha.

### Alternativa
- Implementar rate limiting por IP
- Implementar rate limiting por usuário
- Implementar CAPTCHA após N tentativas

### Melhor Solução
Adicionar rate limiting em `/api/login`:
```javascript
// api/login.js
import { Ratelimit } from "@upstash/ratelimit";

const ratelimit = new Ratelimit({
  redis: Redis.fromEnv(),
  limiter: Ratelimit.slidingWindow(5, "15 m"), // 5 tentativas por 15 min
});

export default async function handler(req, res) {
  const ip = req.headers["x-forwarded-for"] || req.socket.remoteAddress;
  const { success } = await ratelimit.limit(ip);
  
  if (!success) {
    return res.status(429).json({error: "Muitas tentativas. Tente novamente em 15 minutos."});
  }
  
  // ... lógica de login
}
```

---

## 2.6 — Webhook Efí sem Validação de Assinatura

### Problema
Webhook `/api/webhook-efi` não valida assinatura da Efí. Qualquer pessoa pode enviar um webhook falso.

### Impacto
- **Segurança:** Possível registrar pagamentos falsos
- **Integridade:** Dados corrompidos
- **Fraude:** Possível fraude de pagamento

### Risco
**Crítico** — Possível fraude de pagamento.

### Alternativa
- Validar assinatura HMAC do webhook
- Validar IP da origem
- Implementar nonce/timestamp

### Melhor Solução
Validar assinatura HMAC em `/api/webhook-efi`:
```javascript
// api/webhook-efi.js
import crypto from "crypto";

export default async function handler(req, res) {
  const signature = req.headers["x-webhook-signature"];
  const body = JSON.stringify(req.body);
  
  const expectedSignature = crypto
    .createHmac("sha256", process.env.EFI_WEBHOOK_SECRET)
    .update(body)
    .digest("hex");
  
  if (signature !== expectedSignature) {
    return res.status(401).json({error: "Assinatura inválida"});
  }
  
  // ... processar webhook
}
```

---

# 3. FLUXOS FINANCEIROS & CÁLCULOS

## 3.1 — Cálculo de Juros Impreciso para Períodos Parciais

### Problema
Fórmula de juros: `base × taxa × dias / 30`. Assume mês de 30 dias, o que é impreciso para períodos parciais.

### Impacto
- **Precisão:** Juros calculados incorretamente (diferença de até 3% por período)
- **Conformidade:** Falha em requisitos de precisão financeira
- **Risco:** Discrepâncias acumuladas ao longo do tempo

### Risco
**Médio** — Afeta precisão de cálculos. Impacto financeiro pequeno mas acumulado.

### Alternativa
- Usar dias corretos do mês (28/29/30/31)
- Usar taxa diária (taxa anual / 365)
- Usar convenção 360 ou 365 dias

### Melhor Solução
Implementar cálculo com dias corretos:
```javascript
function calcularJuros(principal, taxaMensal, dataInicio, dataFim) {
  const dias = Math.ceil((dataFim - dataInicio) / (1000 * 60 * 60 * 24));
  const taxaDiaria = taxaMensal / 30; // Aproximação
  return principal * taxaDiaria * dias / 100;
}

// Melhor: usar taxa diária correta
function calcularJurosExato(principal, taxaAnual, dataInicio, dataFim) {
  const dias = Math.ceil((dataFim - dataInicio) / (1000 * 60 * 60 * 24));
  const taxaDiaria = taxaAnual / 365;
  return principal * taxaDiaria * dias / 100;
}
```

---

## 3.2 — Multa Fixa (10%) Sem Limite

### Problema
Multa é sempre 10% do principal, sem limite de aplicação. Se cliente atrasa múltiplas vezes, multa acumula indefinidamente.

### Impacto
- **Conformidade:** Possível violação de limite de multa (algumas jurisdições limitam a 10% total)
- **Cobrança:** Valor fica impagável, reduzindo taxa de recuperação
- **UX:** Cliente desestimulado a pagar

### Risco
**Médio** — Afeta conformidade e taxa de recuperação.

### Alternativa
- Implementar limite máximo de multa (ex: 10% uma vez)
- Implementar multa progressiva (1ª vez 5%, 2ª vez 10%)
- Implementar multa por período (ex: 1% por mês de atraso, máximo 10%)

### Melhor Solução
Implementar multa com limite máximo:
```javascript
function calcularMulta(principal, diasAtraso, multaAplicada = 0) {
  const multaMaxima = principal * 0.10; // 10% máximo
  if (multaAplicada >= multaMaxima) return 0; // Já atingiu limite
  
  const novaMulta = principal * 0.10;
  return Math.min(novaMulta, multaMaxima - multaAplicada);
}
```

---

## 3.3 — Desconto nos Juros Sem Limite

### Problema
Campo "Desconto nos Juros" permite desconto até 100% dos juros. Sem validação de limite máximo ou política de desconto.

### Impacto
- **Conformidade:** Sem política clara de desconto
- **Fraude:** Operador pode dar desconto indevido
- **Rentabilidade:** Reduz margem sem controle

### Risco
**Médio** — Possível fraude ou desconto indevido.

### Alternativa
- Implementar limite máximo de desconto (ex: 50%)
- Implementar política de desconto por perfil de cliente
- Implementar aprovação de desconto acima de limite

### Melhor Solução
Adicionar validação de desconto:
```javascript
const DESCONTO_MAXIMO = 0.50; // 50% máximo

function validarDesconto(desconto, valorJuros) {
  const descontoMaximo = valorJuros * DESCONTO_MAXIMO;
  if (desconto > descontoMaximo) {
    throw new Error(`Desconto máximo permitido: R$ ${descontoMaximo.toFixed(2)}`);
  }
}
```

---

## 3.4 — Somente Juros (Prorrogação) Sem Limite

### Problema
Limite de 2 prorrogações por contrato é apenas visual (badge). Não há validação no backend. Operador pode registrar 3ª prorrogação.

### Impacto
- **Conformidade:** Limite não é respeitado
- **Risco:** Cliente pode atrasar indefinidamente pagando só juros
- **Rentabilidade:** Juros não cobrem risco de calote

### Risco
**Alto** — Limite não é respeitado. Possível abuso.

### Alternativa
- Implementar validação no GAS
- Implementar bloqueio automático na 3ª tentativa
- Implementar aprovação manual para 3ª prorrogação

### Melhor Solução
Adicionar validação no GAS:
```javascript
function registrarPagamentoParcial(idContrato, idParcela, valor) {
  const contrato = buscarContrato(idContrato);
  const totalSomenteJuros = parseInt(contrato.TOTAL_SOMENTE_JUROS || 0);
  
  if (totalSomenteJuros >= 2) {
    throw new Error("Limite de 2 prorrogações atingido. Não é possível registrar novo somente_juros.");
  }
  
  // ... registrar pagamento
}
```

---

## 3.5 — Sem Validação de Integridade Financeira Pós-Operação

### Problema
Após registrar pagamento, não há validação se os totais batem. Possível corrupção silenciosa de dados.

### Impacto
- **Integridade:** Dados corrompidos sem detecção
- **Auditoria:** Impossível detectar erro
- **Recuperação:** Difícil corrigir depois

### Risco
**Alto** — Corrupção silenciosa de dados.

### Alternativa
- Implementar validação pós-operação
- Implementar checksum de integridade
- Implementar auditoria automática

### Melhor Solução
Adicionar validação pós-operação:
```javascript
function registrarPagamentoAPI(body) {
  // ... registrar pagamento
  
  // Validar integridade
  const parcela = buscarParcela(idParcela);
  const pagamentos = buscarPagamentosParcela(idParcela);
  const totalPago = pagamentos.reduce((s, p) => s + parseFloat(p.VALOR_PAGO || 0), 0);
  
  if (totalPago > parseFloat(parcela.VALOR_PARCELA || 0)) {
    throw new Error("Erro de integridade: total pago > valor da parcela");
  }
}
```

---

## 3.6 — Campo JUROS_TOTAL Desatualizado

### Problema
Ao registrar `somente_juros`, novo parcela é criada mas `JUROS_TOTAL` do contrato não é atualizado. Divergência detectada: R$ 6.048,74.

### Impacto
- **Integridade:** Campo desatualizado
- **Relatórios:** Totais incorretos
- **Auditoria:** Impossível confiar em JUROS_TOTAL

### Risco
**Médio** — Afeta integridade de dados. Impacto em relatórios.

### Alternativa
- Atualizar JUROS_TOTAL ao registrar somente_juros
- Implementar função de manutenção para recalcular
- Usar campo calculado em vez de armazenado

### Melhor Solução
Chamar `atualizarTotaisContrato()` ao final de `registrarPagamentoParcial()`:
```javascript
function registrarPagamentoParcial(idContrato, idParcela, valor) {
  // ... registrar pagamento e criar nova parcela
  
  // Atualizar totais do contrato
  atualizarTotaisContrato(idContrato);
}

function atualizarTotaisContrato(idContrato) {
  const parcelas = buscarParcelasPorContrato(idContrato);
  const jurosTotal = parcelas.reduce((s, p) => s + parseFloat(p.VALOR_JUROS || 0), 0);
  const valorTotal = parcelas.reduce((s, p) => s + parseFloat(p.VALOR_PARCELA || 0), 0);
  
  setCel(sheetContratos, row, cm, "JUROS_TOTAL", jurosTotal);
  setCel(sheetContratos, row, cm, "VALOR_TOTAL", valorTotal);
}
```

---

## 3.7 — Sem Validação de Saldo Devedor Negativo

### Problema
Se cliente pagar mais do que deve, saldo devedor pode ficar negativo. Sem validação para evitar isso.

### Impacto
- **Integridade:** Saldo negativo é inválido
- **Relatórios:** Totais incorretos
- **Cobrança:** Impossível cobrar saldo negativo

### Risco
**Médio** — Possível saldo negativo. Afeta integridade.

### Alternativa
- Validar saldo antes de aceitar pagamento
- Implementar crédito do cliente (saldo negativo = crédito)
- Rejeitar pagamento acima do saldo

### Melhor Solução
Validar saldo antes de registrar pagamento:
```javascript
function registrarPagamentoAPI(body) {
  const parcela = buscarParcela(body.idParcela);
  const saldoDevedor = parseFloat(parcela.VALOR_PARCELA || 0);
  
  if (body.valor > saldoDevedor) {
    // Opção 1: Rejeitar
    throw new Error("Valor de pagamento excede saldo devedor");
    
    // Opção 2: Aceitar como crédito
    // setCel(sheet, row, cm, "CREDITO_CLIENTE", body.valor - saldoDevedor);
  }
}
```

---

## 3.8 — Sem Validação de Datas (Pagamento Futuro)

### Problema
Usuário pode registrar pagamento com data no futuro. Sem validação.

### Impacto
- **Integridade:** Dados inconsistentes
- **Relatórios:** Totais incorretos
- **Cobrança:** Parcela marcada como paga antes de realmente ser

### Risco
**Médio** — Possível registrar pagamento futuro.

### Alternativa
- Validar data de pagamento ≤ hoje
- Permitir data futura apenas com aprovação
- Implementar agendamento de pagamento

### Melhor Solução
Validar data de pagamento:
```javascript
function registrarPagamentoAPI(body) {
  const dataPagamento = new Date(body.dataPagamento);
  const hoje = new Date();
  
  if (dataPagamento > hoje) {
    throw new Error("Data de pagamento não pode ser no futuro");
  }
}
```

---

## 3.9 — Sem Validação de Contrato/Parcela Deletados

### Problema
Usuário pode registrar pagamento para contrato ou parcela deletados. Sem validação.

### Impacto
- **Integridade:** Pagamento órfão
- **Auditoria:** Impossível rastrear pagamento
- **Relatórios:** Totais incorretos

### Risco
**Médio** — Possível registrar pagamento para contrato deletado.

### Alternativa
- Validar existência de contrato/parcela antes de aceitar pagamento
- Implementar soft delete (marcar como deletado)
- Implementar cascade delete (deletar pagamentos ao deletar contrato)

### Melhor Solução
Validar existência antes de registrar:
```javascript
function registrarPagamentoAPI(body) {
  const contrato = buscarContrato(body.idContrato);
  const parcela = buscarParcela(body.idParcela);
  
  if (!contrato || contrato.STATUS_CONTRATO === "cancelado") {
    throw new Error("Contrato não existe ou foi cancelado");
  }
  
  if (!parcela || parcela.STATUS === "cancelado") {
    throw new Error("Parcela não existe ou foi cancelada");
  }
}
```

---

## 3.10 — Sem Validação de Duplicação de Pagamento

### Problema
Usuário pode registrar o mesmo pagamento duas vezes (ex: clicar botão duas vezes). Sem deduplicação.

### Impacto
- **Integridade:** Pagamento duplicado
- **Relatórios:** Totais incorretos (2x)
- **Cobrança:** Parcela marcada como paga 2x

### Risco
**Alto** — Possível duplicação de pagamento.

### Alternativa
- Implementar idempotência (usar ID único para cada pagamento)
- Implementar deduplicação por valor + data + parcela
- Implementar validação pós-operação

### Melhor Solução
Implementar idempotência com chave única:
```javascript
function registrarPagamentoAPI(body) {
  // Gerar chave única: contrato + parcela + valor + data
  const chaveUnica = `${body.idContrato}-${body.idParcela}-${body.valor}-${body.dataPagamento}`;
  const hash = Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, chaveUnica);
  
  // Verificar se já existe
  const pagamentoExistente = buscarPagamentoPorHash(hash);
  if (pagamentoExistente) {
    throw new Error("Pagamento duplicado detectado");
  }
  
  // Registrar com hash
  setCel(sheet, row, cm, "HASH_PAGAMENTO", hash);
}
```

---

## 3.11 — Sem Validação de Limite de Crédito

### Problema
Não há limite de crédito por cliente. Operador pode criar contrato de R$ 1.000.000 para cliente com score baixo.

### Impacto
- **Risco:** Possível exposição excessiva
- **Rentabilidade:** Possível calote em grande escala
- **Conformidade:** Falha em requisitos de gestão de risco

### Risco
**Alto** — Possível exposição excessiva.

### Alternativa
- Implementar limite de crédito por cliente (baseado em score)
- Implementar aprovação manual para limite alto
- Implementar limite por faixa de score

### Melhor Solução
Implementar limite de crédito:
```javascript
function validarLimiteCredito(idCliente, valorContrato) {
  const cliente = buscarCliente(idCliente);
  const score = parseInt(cliente.SCORE_INTERNO || 0);
  
  // Limite por score
  const limites = {
    "0-300": 5000,
    "301-500": 15000,
    "501-700": 50000,
    "701-1000": 100000
  };
  
  const limite = Object.entries(limites).find(([range]) => {
    const [lo, hi] = range.split("-").map(Number);
    return score >= lo && score <= hi;
  })?.[1] || 0;
  
  const totalExposicao = buscarTotalExposicaoCliente(idCliente) + valorContrato;
  
  if (totalExposicao > limite) {
    throw new Error(`Limite de crédito excedido. Limite: R$ ${limite.toFixed(2)}`);
  }
}
```

---

## 3.12 — Sem Validação de Renegociação Múltipla

### Problema
Contrato pode ser renegociado múltiplas vezes sem limite. Sem validação.

### Impacto
- **Risco:** Cliente pode renegociar indefinidamente
- **Rentabilidade:** Juros não cobrem risco acumulado
- **Conformidade:** Possível violação de limite de renegociação

### Risco
**Médio** — Possível renegociação indefinida.

### Alternativa
- Implementar limite de renegociações (ex: máximo 2)
- Implementar limite de tempo entre renegociações
- Implementar aprovação manual para renegociação

### Melhor Solução
Implementar limite de renegociações:
```javascript
function renegociarContrato(idContrato) {
  const contrato = buscarContrato(idContrato);
  const renegociacoes = parseInt(contrato.TOTAL_RENEGOCIACOES || 0);
  
  if (renegociacoes >= 2) {
    throw new Error("Limite de 2 renegociações atingido");
  }
  
  // ... registrar renegociação
  setCel(sheet, row, cm, "TOTAL_RENEGOCIACOES", renegociacoes + 1);
}
```

---

# 4. INTEGRAÇÕES EXTERNAS

## 4.1 — Efí Bank: TXID Reciclado Causa PIX Inválido

### Problema
Ao chamar PUT `/v2/cobv/{txid}` para TXID já `CONCLUIDA`, a API retorna erro. Código tenta GET de recuperação e devolve `pixCopiaECola` inválido. QR Code fica "inválido ou expirado".

### Impacto
- **Confiabilidade:** PIX não é gerado para parcelas vencidas
- **Cobrança:** Régua de cobrança falha silenciosamente
- **Usuário:** Sem visibilidade de falha

### Risco
**Crítico** — Régua de cobrança não funciona para parcelas com TXID reciclado.

### Solução Implementada
Usar sufixo `R1`, `R2` para TXID reciclado. Webhook continua funcionando.

### Status
Resolvido (2026-06-17). Mas ainda há débito técnico: contratos anteriores a PIX Efí não têm colunas `EFI_*` preenchidas.

### Melhor Solução
Implementar função de manutenção para backfill de PIX:
```javascript
function regenerarPixTodosContratos() {
  const contratos = buscarContratosAbertos();
  
  for (const contrato of contratos) {
    const parcelas = buscarParcelasPorContrato(contrato.ID_CONTRATO);
    
    for (const parcela of parcelas) {
      if (!parcela.EFI_TXID) {
        // Gerar novo PIX
        const txid = gerarTXID(parcela.ID_PARCELA);
        const pix = gerarPixEfi(txid, parcela.VALOR_PARCELA, parcela.DATA_VENCIMENTO);
        
        setCel(sheetParcelas, row, cm, "EFI_TXID", txid);
        setCel(sheetParcelas, row, cm, "EFI_PIX_CODE", pix.pixCopiaECola);
      }
    }
  }
}
```

---

## 4.2 — Evolution GO: Endpoint e Autenticação Incorretos

### Problema
Código usava endpoint open-source (`/message/sendText/{instance}`). Evolution GO usa `/send/text` com Token da Instância.

### Impacto
- **Confiabilidade:** WhatsApp não envia
- **Cobrança:** Régua de cobrança falha
- **Usuário:** Sem notificação de atraso

### Risco
**Crítico** — Régua de cobrança não funciona.

### Solução Implementada
Usar endpoint correto: `POST /send/text` com `{number, text, instanceId}` e header `apikey: {Token da Instância}`.

### Status
Resolvido (2026-06-15).

### Melhor Solução
Adicionar validação de configuração na inicialização:
```javascript
function validarConfigEvolution() {
  const url = _getCfg("EVOLUTION_URL");
  const key = _getCfg("EVOLUTION_KEY");
  const instance = _getCfg("EVOLUTION_INSTANCE");
  
  if (!url || !key || !instance) {
    throw new Error("Configuração Evolution incompleta");
  }
  
  // Testar conexão
  const response = UrlFetchApp.fetch(url + "/instances", {
    headers: {apikey: key},
    muteHttpExceptions: true
  });
  
  if (response.getResponseCode() !== 200) {
    throw new Error("Falha ao conectar Evolution: " + response.getContentText());
  }
}
```

---

## 4.3 — Webhook Efí: Sem Validação de Assinatura

### Problema
Webhook `/api/webhook-efi` não valida assinatura. Qualquer pessoa pode enviar webhook falso.

### Impacto
- **Segurança:** Possível registrar pagamentos falsos
- **Fraude:** Possível fraude de pagamento
- **Integridade:** Dados corrompidos

### Risco
**Crítico** — Possível fraude de pagamento.

### Solução
Validar assinatura HMAC (ver seção 2.6).

---

## 4.4 — BrasilAPI: Sem Tratamento de Erro

### Problema
Ao buscar CNPJ, se BrasilAPI falhar, código não trata erro. Sem fallback.

### Impacto
- **UX:** Campo fica em branco sem mensagem de erro
- **Confiabilidade:** Usuário não sabe se falhou ou está processando
- **Dados:** Campo não é preenchido

### Risco
**Médio** — Afeta UX e preenchimento de dados.

### Alternativa
- Implementar fallback para ReceitaWS
- Implementar retry com backoff
- Exibir mensagem de erro ao usuário

### Melhor Solução
Adicionar tratamento de erro em `buscarCNPJ()`:
```javascript
async function buscarCNPJ(cnpj) {
  try {
    // Tentar BrasilAPI
    const response = await fetch(`https://brasilapi.com.br/api/cnpj/v1/${cnpj}`);
    if (response.ok) return await response.json();
  } catch (err) {
    console.error("BrasilAPI falhou:", err);
  }
  
  try {
    // Fallback ReceitaWS
    return await fetch(`/api/cnpj?cnpj=${cnpj}`).then(r => r.json());
  } catch (err) {
    console.error("ReceitaWS falhou:", err);
    return {status: "error", message: "Falha ao buscar CNPJ"};
  }
}
```

---

## 4.5 — ViaCEP: Sem Tratamento de CEP Inválido

### Problema
Se CEP não existe, ViaCEP retorna `{"erro": true}`. Código não trata isso. Campo fica em branco.

### Impacto
- **UX:** Usuário não sabe se CEP é inválido
- **Dados:** Campo não é preenchido
- **Validação:** Sem feedback claro

### Risco
**Médio** — Afeta UX e validação.

### Alternativa
- Exibir mensagem de erro "CEP inválido"
- Implementar validação de CEP antes de chamar API
- Implementar fallback para BrasilAPI

### Melhor Solução
Adicionar validação de CEP:
```javascript
async function buscarCEP(cep) {
  const cepLimpo = cep.replace(/\D/g, "");
  
  if (cepLimpo.length !== 8) {
    return {status: "error", message: "CEP deve ter 8 dígitos"};
  }
  
  try {
    const response = await fetch(`https://viacep.com.br/ws/${cepLimpo}/json/`);
    const data = await response.json();
    
    if (data.erro) {
      return {status: "not_found", message: "CEP não encontrado"};
    }
    
    return {status: "ok", ...data};
  } catch (err) {
    return {status: "error", message: "Falha ao buscar CEP"};
  }
}
```

---

## 4.6 — ZapSign: Sem Tratamento de Erro

### Problema
Se ZapSign falhar, documento não é enviado. Sem mensagem de erro. Usuário não sabe o que aconteceu.

### Impacto
- **UX:** Usuário não sabe se documento foi enviado
- **Confiabilidade:** Sem feedback de falha
- **Processo:** Documento pode não ser assinado

### Risco
**Médio** — Afeta UX e confiabilidade.

### Alternativa
- Implementar retry automático
- Exibir mensagem de erro ao usuário
- Implementar fila de reenvio

### Melhor Solução
Adicionar tratamento de erro em `gerarDocContrato()`:
```javascript
function gerarDocContrato(idContrato) {
  try {
    const doc = criarDocGoogle(idContrato);
    const pdf = exportarPDF(doc);
    
    const response = enviarZapSign(pdf);
    
    if (!response.success) {
      registrarEvento(idContrato, "ERRO_ZAPSIGN", response.error);
      return {success: false, error: response.error};
    }
    
    return {success: true, linkAssinatura: response.linkAssinatura};
  } catch (err) {
    registrarEvento(idContrato, "ERRO_ZAPSIGN", err.message);
    return {success: false, error: err.message};
  }
}
```

---

## 4.7 — Google Forms: Sem Validação de Dados Obrigatórios

### Problema
Formulário não valida campos obrigatórios. Possível submeter formulário vazio ou com dados incompletos.

### Impacto
- **Dados:** Clientes com dados incompletos
- **Cobrança:** Sem telefone/email impossível cobrar
- **Validação:** Sem feedback claro

### Risco
**Médio** — Possível criar clientes com dados incompletos.

### Alternativa
- Implementar validação no formulário
- Implementar validação no GAS
- Exibir mensagem de erro clara

### Melhor Solução
Adicionar validação em `onFormSubmit()`:
```javascript
function onFormSubmit(e) {
  const formResponse = e.response;
  const itemResponses = formResponse.getItemResponses();
  
  // Validar campos obrigatórios
  const campos = {};
  for (const itemResponse of itemResponses) {
    const titulo = itemResponse.getItem().getTitle();
    const valor = itemResponse.getResponse();
    
    if (!valor || valor.trim() === "") {
      // Campo vazio
      if (["Nome Completo", "CPF", "WhatsApp"].includes(titulo)) {
        throw new Error(`Campo obrigatório vazio: ${titulo}`);
      }
    }
    
    campos[titulo] = valor;
  }
  
  // ... criar cliente
}
```

---

# 5. FRONTEND & UX

## 5.1 — Sem Confirmação de Ação Destrutiva

### Problema
Usuário pode deletar contrato clicando uma vez. Sem confirmação. Ação é irreversível.

### Impacto
- **UX:** Possível delete acidental
- **Integridade:** Dados perdidos permanentemente
- **Recuperação:** Sem forma de reverter

### Risco
**Alto** — Possível perda de dados por acidente.

### Alternativa
- Implementar modal de confirmação
- Implementar soft delete (marcar como deletado)
- Implementar undo/redo

### Melhor Solução
Adicionar modal de confirmação:
```jsx
function ExcluirContratoModal({contrato, onConfirm, onCancel}) {
  return (
    <Dialog open={true}>
      <DialogContent>
        <h2>Confirmar Exclusão</h2>
        <p>Tem certeza que deseja deletar o contrato {contrato.ID_CONTRATO}?</p>
        <p style={{color: "red"}}>Esta ação é irreversível.</p>
        <DialogFooter>
          <Button onClick={onCancel}>Cancelar</Button>
          <Button onClick={onConfirm} variant="destructive">Deletar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
```

---

## 5.2 — Sem Indicador de Carregamento

### Problema
Ao registrar pagamento, usuário não sabe se está processando. Sem spinner ou indicador visual.

### Impacto
- **UX:** Usuário não sabe se está processando
- **Confiabilidade:** Possível clicar botão múltiplas vezes
- **Experiência:** Sensação de lentidão

### Risco
**Médio** — Afeta UX. Possível duplicação de operação.

### Alternativa
- Adicionar spinner durante operação
- Desabilitar botão durante operação
- Exibir mensagem de status

### Melhor Solução
Adicionar indicador de carregamento:
```jsx
const [loading, setLoading] = useState(false);

async function handleRegistrarPagamento() {
  setLoading(true);
  try {
    await postAction({action: "registrarPagamento", ...});
    setLoading(false);
    // Sucesso
  } catch (err) {
    setLoading(false);
    // Erro
  }
}

return (
  <Button onClick={handleRegistrarPagamento} disabled={loading}>
    {loading ? "Processando..." : "Registrar Pagamento"}
  </Button>
);
```

---

## 5.3 — Sem Mensagem de Erro Clara

### Problema
Quando operação falha, erro é exibido em console. Usuário não vê nada. Sem feedback claro.

### Impacto
- **UX:** Usuário não sabe o que deu errado
- **Confiabilidade:** Sem forma de corrigir
- **Experiência:** Frustração

### Risco
**Médio** — Afeta UX e experiência do usuário.

### Alternativa
- Exibir toast com mensagem de erro
- Exibir modal com detalhes de erro
- Registrar erro em log centralizado

### Melhor Solução
Adicionar toast de erro:
```jsx
import { useToast } from "@/components/ui/use-toast";

const { toast } = useToast();

async function handleRegistrarPagamento() {
  try {
    await postAction({action: "registrarPagamento", ...});
    toast({title: "Sucesso", description: "Pagamento registrado"});
  } catch (err) {
    toast({
      title: "Erro",
      description: err.message || "Falha ao registrar pagamento",
      variant: "destructive"
    });
  }
}
```

---

## 5.4 — Sem Paginação em Listas Grandes

### Problema
Aba "Contratos" carrega todos os contratos de uma vez. Com 1000+ contratos, página fica lenta.

### Impacto
- **Performance:** Página lenta
- **Escalabilidade:** Impossível escalar para 10k+ contratos
- **UX:** Usuário aguarda vários segundos

### Risco
**Alto** — Afeta performance e escalabilidade.

### Alternativa
- Implementar paginação (20 por página)
- Implementar virtual scrolling (renderizar apenas visíveis)
- Implementar busca/filtro para reduzir resultados

### Melhor Solução
Implementar paginação:
```jsx
const [page, setPage] = useState(1);
const PAGE_SIZE = 20;

const contratosPaginados = contratos.slice(
  (page - 1) * PAGE_SIZE,
  page * PAGE_SIZE
);

const totalPages = Math.ceil(contratos.length / PAGE_SIZE);

return (
  <>
    <Table>
      {contratosPaginados.map(c => <TableRow key={c.ID_CONTRATO}>{...}</TableRow>)}
    </Table>
    <Pagination>
      <Button onClick={() => setPage(p => Math.max(1, p - 1))}>Anterior</Button>
      <span>{page} / {totalPages}</span>
      <Button onClick={() => setPage(p => Math.min(totalPages, p + 1))}>Próxima</Button>
    </Pagination>
  </>
);
```

---

## 5.5 — Sem Busca/Filtro Eficiente

### Problema
Usuário precisa rolar toda a lista para encontrar um cliente. Sem busca.

### Impacto
- **UX:** Difícil encontrar cliente
- **Produtividade:** Operador perde tempo
- **Escalabilidade:** Impossível com 10k+ clientes

### Risco
**Médio** — Afeta UX e produtividade.

### Alternativa
- Implementar busca por nome/CPF
- Implementar filtro por status
- Implementar busca full-text

### Melhor Solução
Implementar busca:
```jsx
const [searchTerm, setSearchTerm] = useState("");

const clientesFiltrados = clientes.filter(c =>
  c.NOME.toLowerCase().includes(searchTerm.toLowerCase()) ||
  c.CPF.includes(searchTerm)
);

return (
  <>
    <Input
      placeholder="Buscar por nome ou CPF"
      value={searchTerm}
      onChange={e => setSearchTerm(e.target.value)}
    />
    <Table>
      {clientesFiltrados.map(c => <TableRow key={c.ID_CLIENTE}>{...}</TableRow>)}
    </Table>
  </>
);
```

---

## 5.6 — Sem Responsividade Mobile

### Problema
Sistema é desktop-only. Impossível acessar de celular.

### Impacto
- **Escalabilidade:** Impossível usar em campo
- **Produtividade:** Operador preso ao desktop
- **Experiência:** Sem acesso móvel

### Risco
**Médio** — Afeta produtividade e escalabilidade.

### Alternativa
- Implementar design responsivo
- Implementar app móvel nativo (React Native)
- Implementar PWA (Progressive Web App)

### Melhor Solução
Implementar design responsivo com Tailwind:
```jsx
return (
  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
    {contratos.map(c => (
      <Card key={c.ID_CONTRATO} className="w-full">
        {/* Conteúdo do card */}
      </Card>
    ))}
  </div>
);
```

---

## 5.7 — Sem Modo Escuro

### Problema
Interface é apenas em modo claro. Sem opção de modo escuro.

### Impacto
- **UX:** Cansaço visual em ambiente escuro
- **Acessibilidade:** Sem opção para usuários com sensibilidade à luz
- **Experiência:** Não segue padrão moderno

### Risco
**Baixo** — Afeta conforto visual apenas.

### Alternativa
- Implementar tema escuro
- Implementar seletor de tema
- Usar preferência do sistema

### Melhor Solução
Implementar tema escuro com Tailwind:
```jsx
const [theme, setTheme] = useState("light");

useEffect(() => {
  const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
  setTheme(prefersDark ? "dark" : "light");
}, []);

return (
  <div className={theme === "dark" ? "dark" : ""}>
    <div className="bg-white dark:bg-slate-950 text-black dark:text-white">
      {/* Conteúdo */}
    </div>
  </div>
);
```

---

## 5.8 — Sem Atalhos de Teclado

### Problema
Usuário precisa clicar em botões. Sem atalhos de teclado para operações comuns.

### Impacto
- **Produtividade:** Operador lento
- **Acessibilidade:** Sem suporte a teclado
- **Experiência:** Não segue padrão de aplicativos profissionais

### Risco
**Baixo** — Afeta produtividade apenas.

### Alternativa
- Implementar atalhos de teclado (Ctrl+S, Ctrl+P, etc.)
- Implementar navegação por teclado
- Exibir dica de atalho ao passar mouse

### Melhor Solução
Implementar atalhos de teclado:
```jsx
useEffect(() => {
  const handleKeyDown = (e) => {
    if (e.ctrlKey && e.key === "s") {
      e.preventDefault();
      handleSalvar();
    }
    if (e.ctrlKey && e.key === "p") {
      e.preventDefault();
      handleImprimir();
    }
  };
  
  window.addEventListener("keydown", handleKeyDown);
  return () => window.removeEventListener("keydown", handleKeyDown);
}, []);
```

---

# 6. BACKEND & BANCO DE DADOS

## 6.1 — Sem Índices no Sheets

### Problema
Google Sheets não tem índices. Buscar por ID_CLIENTE requer varrer todas as linhas.

### Impacto
- **Performance:** Busca lenta com muitos registros
- **Escalabilidade:** O(n) para cada busca
- **Latência:** Múltiplas buscas = múltiplos segundos

### Risco
**Médio** — Afeta performance com muitos registros.

### Alternativa
- Migrar para banco de dados com índices (Supabase)
- Implementar cache em memória
- Implementar índices manuais (Map)

### Melhor Solução
Implementar cache em memória no GAS:
```javascript
var _CACHE_CLIENTES = null;
var _CACHE_TIMESTAMP = 0;
const CACHE_TTL = 5 * 60 * 1000; // 5 minutos

function buscarClienteComCache(idCliente) {
  if (!_CACHE_CLIENTES || Date.now() - _CACHE_TIMESTAMP > CACHE_TTL) {
    _CACHE_CLIENTES = {};
    const clientes = sheetClientes.getRange(2, 1, sheetClientes.getLastRow() - 1, sheetClientes.getLastColumn()).getValues();
    
    for (const cliente of clientes) {
      _CACHE_CLIENTES[cliente[0]] = cliente; // ID_CLIENTE como chave
    }
    
    _CACHE_TIMESTAMP = Date.now();
  }
  
  return _CACHE_CLIENTES[idCliente];
}
```

---

## 6.2 — Sem Constraints de Integridade Referencial

### Problema
Possível deletar cliente que tem contratos. Sem constraint para evitar isso.

### Impacto
- **Integridade:** Contratos órfãos
- **Auditoria:** Impossível rastrear cliente original
- **Relatórios:** Totais incorretos

### Risco
**Alto** — Possível corrupção de dados.

### Alternativa
- Implementar validação antes de deletar
- Implementar soft delete
- Usar banco de dados com constraints (Supabase)

### Melhor Solução
Adicionar validação antes de deletar cliente:
```javascript
function deletarCliente(idCliente) {
  const contratos = buscarContratosPorCliente(idCliente);
  
  if (contratos.length > 0) {
    throw new Error(`Não é possível deletar cliente com ${contratos.length} contrato(s) ativo(s)`);
  }
  
  // ... deletar cliente
}
```

---

## 6.3 — Sem Backup Automático

### Problema
Não há backup automático do Sheets. Se dados forem perdidos, não há forma de recuperar.

### Impacto
- **Recuperação:** Perda permanente de dados
- **Conformidade:** Falha em requisitos de backup
- **Risco:** Perda total de negócio

### Risco
**Crítico** — Possível perda total de dados.

### Alternativa
- Implementar backup automático para Drive
- Implementar backup para Supabase
- Usar Google Sheets versioning nativo

### Melhor Solução
Implementar backup automático:
```javascript
function fazerBackupAutomatico() {
  const spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
  const backupFolder = DriveApp.getFolderById(BACKUP_FOLDER_ID);
  
  const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
  const backupName = `FinanceiroOp_Backup_${timestamp}`;
  
  const copy = spreadsheet.copy(backupName);
  backupFolder.addFile(DriveApp.getFileById(copy.getId()));
  
  // Manter apenas últimos 30 backups
  const backups = backupFolder.getFilesByName(/FinanceiroOp_Backup_/);
  const backupList = [];
  while (backups.hasNext()) {
    backupList.push(backups.next());
  }
  
  backupList.sort((a, b) => b.getLastUpdated() - a.getLastUpdated());
  
  for (let i = 30; i < backupList.length; i++) {
    backupList[i].setTrashed(true);
  }
}

// Agendar para rodar diariamente
function agendarBackup() {
  ScriptApp.newTrigger("fazerBackupAutomatico")
    .timeBased()
    .atHour(2)
    .everyDays(1)
    .create();
}
```

---

## 6.4 — Sem Limpeza de Dados Obsoletos

### Problema
Dados nunca são deletados. Tabela cresce indefinidamente. Sem política de retenção.

### Impacto
- **Performance:** Sheets fica lento com muitos registros
- **Escalabilidade:** Limite de ~5M células se aproxima
- **Custo:** Google Drive fica cheio

### Risco
**Médio** — Afeta performance com tempo.

### Alternativa
- Implementar política de retenção (ex: deletar após 2 anos)
- Implementar arquivamento (mover para tabela histórica)
- Implementar limpeza automática

### Melhor Solução
Implementar limpeza automática:
```javascript
function limparDadosObsoletos() {
  const dataLimite = new Date();
  dataLimite.setFullYear(dataLimite.getFullYear() - 2); // 2 anos atrás
  
  // Limpar eventos antigos
  const sheetEventos = SpreadsheetApp.getActiveSpreadsheet().getSheetByName("EVENTOS");
  const eventos = sheetEventos.getRange(2, 1, sheetEventos.getLastRow() - 1, sheetEventos.getLastColumn()).getValues();
  
  let rowsToDelete = [];
  for (let i = eventos.length - 1; i >= 0; i--) {
    const dataEvento = new Date(eventos[i][1]); // DATA_HORA
    if (dataEvento < dataLimite) {
      rowsToDelete.push(i + 2); // +2 porque começa em linha 2
    }
  }
  
  // Deletar em lotes (de trás para frente)
  for (const row of rowsToDelete) {
    sheetEventos.deleteRow(row);
  }
}

// Agendar para rodar mensalmente
function agendarLimpeza() {
  ScriptApp.newTrigger("limparDadosObsoletos")
    .timeBased()
    .onMonthDay(1)
    .atHour(3)
    .create();
}
```

---

## 6.5 — Sem Validação de Schema

### Problema
Não há validação se as colunas existem ou têm tipos corretos. Possível corrupção silenciosa.

### Impacto
- **Integridade:** Dados corrompidos
- **Auditoria:** Impossível detectar erro
- **Recuperação:** Difícil corrigir depois

### Risco
**Médio** — Possível corrupção silenciosa.

### Alternativa
- Implementar validação de schema
- Implementar migration de schema
- Implementar versionamento de schema

### Melhor Solução
Implementar validação de schema:
```javascript
const SCHEMA = {
  CLIENTES: ["ID_CLIENTE", "NOME", "CPF", "RG", "TELEFONE", "EMAIL", ...],
  CONTRATOS: ["ID_CONTRATO", "ID_CLIENTE", "VALOR_PRINCIPAL", "DATA_CRIACAO", ...],
  PARCELAS: ["ID_PARCELA", "ID_CONTRATO", "VALOR_PARCELA", "DATA_VENCIMENTO", ...],
};

function validarSchema() {
  for (const [sheetName, expectedColumns] of Object.entries(SCHEMA)) {
    const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(sheetName);
    if (!sheet) {
      throw new Error(`Aba ${sheetName} não encontrada`);
    }
    
    const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
    
    for (const expectedCol of expectedColumns) {
      if (!headers.includes(expectedCol)) {
        throw new Error(`Coluna ${expectedCol} não encontrada em ${sheetName}`);
      }
    }
  }
}
```

---

## 6.6 — Sem Migração de Dados Segura

### Problema
Quando adicionar coluna nova, sem forma segura de migrar dados existentes.

### Impacto
- **Integridade:** Dados perdidos durante migração
- **Downtime:** Sistema indisponível durante migração
- **Recuperação:** Difícil reverter migração

### Risco
**Alto** — Possível perda de dados durante migração.

### Alternativa
- Implementar padrão de migração (create new column, populate, delete old)
- Implementar backup antes de migração
- Implementar rollback automático

### Melhor Solução
Implementar padrão seguro de migração:
```javascript
function migrarDados() {
  // 1. Backup
  fazerBackupAutomatico();
  
  // 2. Criar coluna nova
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName("CONTRATOS");
  const lastCol = sheet.getLastColumn();
  
  // 3. Copiar dados
  const dados = sheet.getRange(2, 1, sheet.getLastRow() - 1, lastCol).getValues();
  
  for (let i = 0; i < dados.length; i++) {
    const novoValor = transformarDado(dados[i]);
    sheet.getRange(i + 2, lastCol + 1).setValue(novoValor);
  }
  
  // 4. Validar
  const novosDados = sheet.getRange(2, lastCol + 1, sheet.getLastRow() - 1, 1).getValues();
  if (novosDados.length !== dados.length) {
    throw new Error("Migração falhou: quantidade de linhas não bate");
  }
  
  // 5. Deletar coluna antiga (opcional)
  // sheet.deleteColumn(oldColIndex);
}
```

---

# 7. OPERACIONAL & PROCESSO

## 7.1 — Sem Documentação de Processos

### Problema
Não há documentação clara de processos operacionais. Novo operador precisa aprender na prática.

### Impacto
- **Onboarding:** Lento e propenso a erros
- **Consistência:** Cada operador faz diferente
- **Qualidade:** Erros operacionais frequentes
- **Conhecimento:** Risco de perda de conhecimento

### Risco
**Médio** — Afeta onboarding e consistência.

### Alternativa
- Criar manual de operação
- Criar vídeos de treinamento
- Criar checklist de processos

### Melhor Solução
Criar documentação de processos:
```markdown
# Manual de Operação

## Processo: Criar Novo Contrato

1. Acessar aba "Contratos"
2. Clicar em "Novo Contrato"
3. Buscar cliente (ou criar novo)
4. Preencher:
   - Valor Principal
   - Taxa de Juros
   - Data de Vencimento
   - Número de Parcelas
5. Clicar em "Criar"
6. Gerar Documento (Google Docs)
7. Enviar para ZapSign (assinatura eletrônica)
8. Confirmar quando assinado

## Processo: Registrar Pagamento

1. Acessar aba "Contratos"
2. Buscar contrato
3. Clicar em "Registrar Pagamento"
4. Selecionar parcela
5. Informar:
   - Valor Pago
   - Data de Pagamento
   - Tipo de Pagamento
6. Clicar em "Confirmar"
7. Imprimir comprovante
```

---

## 7.2 — Sem SLA ou Métricas de Qualidade

### Problema
Não há SLA definido. Sem forma de medir qualidade do serviço.

### Impacto
- **Qualidade:** Sem padrão de qualidade
- **Accountability:** Sem responsabilidade clara
- **Melhoria:** Sem forma de medir progresso

### Risco
**Médio** — Afeta qualidade e accountability.

### Alternativa
- Definir SLA (ex: 99.5% uptime)
- Definir métricas de qualidade (ex: 0 erros por semana)
- Implementar dashboard de SLA

### Melhor Solução
Definir SLA:
```markdown
# SLA

## Disponibilidade
- Target: 99.5% uptime
- Máximo downtime aceitável: 3.6 horas/mês

## Performance
- Tempo de carregamento: < 2s
- Tempo de operação: < 5s

## Qualidade
- Taxa de erro: < 0.1%
- Taxa de duplicação: 0%
- Taxa de perda de dados: 0%

## Suporte
- Tempo de resposta: < 1 hora
- Tempo de resolução: < 24 horas
```

---

## 7.3 — Sem Plano de Continuidade

### Problema
Se sistema cair, não há plano de recuperação. Sem backup de emergência.

### Impacto
- **Disponibilidade:** Impossível recuperar rapidamente
- **Negócio:** Perda de receita durante downtime
- **Confiança:** Clientes perdem confiança

### Risco
**Crítico** — Possível perda total de operação.

### Alternativa
- Implementar backup automático
- Implementar redundância geográfica
- Implementar plano de recuperação

### Melhor Solução
Implementar plano de continuidade:
```markdown
# Plano de Continuidade

## Backup
- Backup automático a cada 6 horas
- Retenção: 30 dias
- Teste de restauração: 1x por mês

## Recuperação
- RTO (Recovery Time Objective): 4 horas
- RPO (Recovery Point Objective): 6 horas
- Procedimento de restauração documentado

## Redundância
- Servidor primário: Vercel
- Servidor secundário: Railway (standby)
- Banco de dados: Supabase (replicado)

## Teste
- Simulado de falha: 1x por trimestre
- Documentação atualizada: 1x por mês
```

---

## 7.4 — Sem Plano de Escalabilidade

### Problema
Sistema foi construído para 100 clientes. Sem plano para 1000 ou 10000.

### Impacto
- **Escalabilidade:** Impossível crescer
- **Performance:** Sistema fica lento
- **Custo:** Custo por transação aumenta

### Risco
**Alto** — Impossível escalar com sucesso.

### Alternativa
- Migrar para arquitetura escalável
- Implementar cache distribuído
- Implementar banco de dados escalável

### Melhor Solução
Implementar plano de escalabilidade:
```markdown
# Plano de Escalabilidade

## Fase 1 (100-500 clientes) — Atual
- Frontend: Vercel
- Backend: Google Apps Script
- Banco de dados: Google Sheets
- Cache: localStorage

## Fase 2 (500-2000 clientes) — Q3 2026
- Frontend: Vercel
- Backend: Vercel Serverless Functions
- Banco de dados: Supabase PostgreSQL
- Cache: Redis (Upstash)

## Fase 3 (2000+ clientes) — Q4 2026
- Frontend: Vercel
- Backend: Node.js + Express (Railway)
- Banco de dados: Supabase PostgreSQL (replicated)
- Cache: Redis Cluster
- CDN: Cloudflare

## Métricas
- Tempo de resposta: < 500ms (p95)
- Throughput: 100 req/s
- Uptime: 99.9%
```

---

# RESUMO DE PRIORIDADES

## Críticos (Implementar Imediatamente)
1. Autenticação por senha simples → Implementar MFA
2. Webhook Efí sem validação → Validar assinatura HMAC
3. Monolito frontend → Modularizar gradualmente
4. Google Sheets como BD → Migrar para Supabase (Fase 3)
5. Sem backup automático → Implementar backup diário
6. Sem versionamento de dados → Implementar auditoria
7. Sem transações distribuídas → Implementar validação pós-operação
8. Limite Vercel Hobby → Upgrade para Pro

## Altos (Implementar em 2-4 semanas)
1. Cálculo de juros impreciso → Usar dias corretos
2. Multa sem limite → Implementar limite máximo
3. Somente juros sem validação → Validar no GAS
4. Sem validação de entrada → Implementar sanitização
5. Sem criptografia de dados → Criptografar CPF/RG
6. Sem rate limiting → Implementar Upstash
7. Sem confirmação de ação destrutiva → Modal de confirmação
8. Sem paginação → Implementar paginação

## Médios (Implementar em 1-2 meses)
1. Sem cache distribuído → Redis (Upstash)
2. Sem índices → Cache em memória
3. Sem observabilidade → Sentry
4. Sem busca/filtro → Implementar busca
5. Sem responsividade mobile → Design responsivo
6. Sem validação de schema → Validação de schema
7. Sem documentação de processos → Criar manual
8. Sem SLA → Definir SLA

## Baixos (Implementar quando houver tempo)
1. Modo escuro → Tailwind dark mode
2. Atalhos de teclado → Implementar atalhos
3. Sem mensagem de erro clara → Toast de erro
4. Sem indicador de carregamento → Spinner

---

# PRÓXIMOS PASSOS

1. **Semana 1:** Implementar MFA, validação de webhook, backup automático
2. **Semana 2:** Migrar para Supabase (Fase 3), upgrade Vercel Pro
3. **Semana 3:** Modularizar frontend, implementar cache Redis
4. **Semana 4:** Implementar validações financeiras, sanitização de entrada
5. **Semana 5+:** Implementar features de UX, documentação, SLA

---

**Fim do Relatório**
