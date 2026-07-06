# FinanceiroOp — Contexto Completo do Negócio

> **Uso:** Cole este documento como contexto inicial para qualquer IA antes de trabalhar no projeto.
> **Data de referência:** 2026-06-14

---

## 1. O que é este negócio

**Borges Assessoria** é uma financeira informal de crédito pessoal operada por **Alex Borges** (alexborges.mx@gmail.com). O modelo é simples: Alex empresta dinheiro próprio para trabalhadores CLT (carteira assinada), cobra juros, gerencia parcelas e recebe via PIX.

O software **FinanceiroOp** é o sistema de gestão que Alex construiu do zero para operar este negócio — CRM, gestão de contratos, controle de parcelas, cobrança, geração de carnê PIX, assinatura eletrônica e triagem automática de leads pelo WhatsApp.

### Público-alvo dos empréstimos
- Trabalhadores com carteira assinada (CLT)
- Captados via WhatsApp por indicação de clientes existentes (modelo de padrinho/madrinha)
- Triagem automática via bot de IA antes de qualquer contato humano

---

## 2. Fluxo completo do negócio

```
CAPTAÇÃO → TRIAGEM → CADASTRO → CONTRATO → CARNÊ PIX → PAGAMENTOS → QUITAÇÃO/PERDA
                                                                ↓
                                                         INADIMPLÊNCIA
                                                                ↓
                                                    ACORDO ASSISTIDO (temporário)
                                                         OU  BAIXA (definitivo)
```

### 2.1 Captação e triagem
1. Lead manda mensagem para o WhatsApp da empresa
2. Bot de IA (Evolution API + Claude AI) faz a triagem — **em implementação**:
   - Verifica se tem CLT
   - Coleta: valor desejado, prazo, tempo de empresa, nome do padrinho
   - Valida o padrinho contra a base de clientes (fuzzy match)
   - Se aprovado → envia link do Google Form e pede contracheque
   - Se reprovado → encerra educadamente
3. Lead manda foto/PDF do contracheque → Claude Sonnet extrai RENDA_BRUTA, RENDA_LIQUIDA, EMPREGADOR, DATA_ADMISSAO
4. Alex recebe notificação no WhatsApp com resumo financeiro completo
5. Todos os dados ficam salvos na aba LEADS do Google Sheets

### 2.2 Cadastro e aprovação
1. Alex abre o FinanceiroOp → aba Clientes
2. Novo cliente aparece com STATUS = `aguardando_conferencia`
3. Alex confere e preenche campos faltantes → salva → status vira `ativo`

### 2.3 Criação de contrato
1. Alex busca o cliente em "Novo Contrato"
2. Sistema pré-preenche valores do último contrato (se houver) e calcula 1º vencimento = dia preferido do cliente no mês seguinte
3. GAS cria: contrato + todas as parcelas + documento Google Docs a partir de template
4. Modal de sucesso oferece: abrir doc, enviar para assinatura (ZapSign), gerar carnê PIX (Efí Bank), enviar WhatsApp

### 2.4 Carnê PIX (Efí Bank)
- Gera uma cobrança `cobv` (PIX com vencimento) por parcela
- Juros: 0,03% ao dia (modalidade percentual)
- Multa: 10% (modalidade percentual)
- Validade após vencimento: 30 dias
- Identificador único: `FOP` + número do contrato (16 dígitos) + `P` + número da parcela (6 dígitos)

### 2.5 Gestão de pagamentos
- Parcelas registradas manualmente via FinanceiroOp
- Tipos de pagamento: `pagamento_normal`, `pagamento_antecipado`, `pagamento_com_atraso`, `somente_juros`, `quitacao_antecipada`, `recuperacao_apos_baixa`, `acordo_com_perda`, **`abatimento_acordo_assistido`**
- Comprovante PDF gerado automaticamente (jsPDF) e enviado pelo WhatsApp
- Sistema rastreia: valor pago, juros, taxa de atraso, data de pagamento

### 2.6 Cobrança e inadimplência
- Aba "Cobrança": fila de parcelas vencidas agrupadas por cliente (exclui contratos em `acordo_assistido` e status terminais)
- Ações disponíveis: Registrar Pagamento, Reagendar (promessa), enviar WhatsApp, gerar PIX
- **Ciclo de inadimplência:**
  - `ativo_em_dia` → `ativo_em_atraso` (>0d) → `em_cobranca` (>30d) → `pre_prejuizo` (>60d)
  - `pre_prejuizo` → `acordo_assistido` (manual, dificuldade temporária com boa comunicação)
  - `acordo_assistido` → `pre_prejuizo` (automático se 180 dias sem abatimento)
  - `pre_prejuizo` → `baixado_como_prejuizo` (manual)
  - Contratos baixados entram em recuperação: `em_recuperacao` → `recuperado_parcialmente` / `recuperado_integralmente` / `encerrado_sem_recuperacao`
- Aba "Perdas & Recuperação": rastreia acordos, valores recuperados e contratos em Acordo Assistido

### 2.7 Acordo Assistido
Para clientes que perderam renda temporariamente mas mantêm boa comunicação:
- Contrato sai da fila de Cobrança
- Score do cliente fica congelado (não penaliza, não beneficia)
- Cliente pode pagar qualquer valor como "abatimento" (100% capital, nunca receita)
- Alex pode retornar o contrato à cobrança normal ou baixar como prejuízo
- Se 180 dias sem nenhum abatimento: sistema move automaticamente para `pre_prejuizo`

### 2.8 Ajuizamento em reincidência (2026-07-05/06)
Um contrato que já foi renegociado ou já passou por Acordo Assistido e volta a atrasar (`ativo_em_atraso`) libera a opção "Ajuizar contrato" imediatamente — sem esperar os 30 dias normais até `em_cobranca`. Reincidência pós-renegociação/acordo já é uma 2ª chance não cumprida, tratada como situação agravada.

---

## 3. Stack tecnológico

### Frontend
```
React 18 + Vite → build estático → Vercel CDN
src/main.jsx (~5500+ linhas, arquivo único)
```
- **UI**: inline styles com variáveis de tema + componentes shadcn/ui
- **Design System**: Borges (brand.css) — paleta dark/light, toggle automático às 18h
- **Gráficos**: Recharts (BarChart)
- **PDF**: jsPDF (comprovantes de pagamento, relatório financeiro, carnê)
- **Routing**: estado local (tab ativa), sem React Router

### Backend
```
Google Apps Script (GAS) → Web App publicado como URL pública
```
- **doGet**: retorna todas as abas do Sheets como JSON
- **doPost**: executa todas as ações de escrita (criar contrato, registrar pagamento, etc.)
- Trigger diário às 7h: atualiza status de parcelas, contratos, verifica Acordo Assistido 180 dias
- Assinatura via ZapSign: exporta Google Docs como PDF → envia para ZapSign → retorna link

### Banco de dados
```
Google Sheets (11 abas)
```

| Aba | Função |
|---|---|
| CLIENTES | Cadastro completo — nome, CPF, RG, WhatsApp, email, PERFIL_COBRANCA, score, padrinho |
| CONTRATOS | Um registro por contrato — cliente, valores, taxa, status, colunas de acordo_assistido |
| PARCELAS | Uma linha por parcela — vencimento, valor, status, PIX txid |
| PAGAMENTOS | Registro imutável de cada pagamento (inclui abatimento_acordo_assistido) |
| PROMESSAS | Acordos de pagamento com data prevista |
| EVENTOS | Audit log de todas as ações |
| CONFIGURACOES | Parâmetros globais (taxa padrão, etc.) |
| ACORDOS | Acordos formais de parcelamento de dívida |
| LEADS | Leads do bot WhatsApp com histórico completo da conversa |
| PADRINHOS | Tabela analítica de padrinhos (gerada automaticamente) |
| EMPREGADORES | Tabela analítica de empregadores (gerada automaticamente) |

### Hosting e infraestrutura
```
Vercel (produção)
├── /               → SPA React (Vite build)
├── /api/sheets     → rewrite para GAS doGet
├── /api/action     → proxy para GAS doPost
├── /api/whatsapp   → bot WhatsApp (público, sem auth)
├── /api/efi-*      → integração Efí Bank PIX
├── /api/login      → autenticação por senha
└── /api/logout     → limpar sessão
middleware.js       → protege todas as rotas exceto login/logout/whatsapp/webhook-efi
```

Autenticação: cookie `fp_session` = HMAC-SHA256 da senha. Sessão dura 30 dias.

---

## 4. Integrações externas

### Efí Bank (PIX)
- Tipo: `cobv` (cobrança com vencimento)
- Ambiente: produção
- Credenciais: `EFI_CLIENT_ID`, `EFI_CLIENT_SECRET`, `EFI_PIX_KEY` (env Vercel)
- Certificado: `producao-849675-financeiroop.p12` (no .gitignore — nunca commitar)

### ZapSign (assinatura eletrônica)
- Token hardcoded no `appscript.gs`
- Fluxo: Google Docs → PDF → ZapSign → link para assinar

### Evolution API + Claude AI (bot WhatsApp) — em implementação
- **Stack**: Evolution API (self-hosted) → webhook → `api/whatsapp.js` → Claude AI → Evolution API REST
- **Motor**: Claude Haiku (triagem) + Claude Sonnet (extração de contracheque)
- **Vantagem**: número permanece no celular; sem dependência de Twilio/Meta
- **Env vars**: `EVOLUTION_API_URL`, `EVOLUTION_API_KEY`, `EVOLUTION_INSTANCE`, `ANTHROPIC_API_KEY`

### Google Forms (cadastro de novos clientes)
- Trigger `onFormSubmit` no GAS cria linha em CLIENTES com status `aguardando_conferencia`
- Campos mapeados com títulos exatos (sensível a acentos e case)

---

## 5. Abas da interface (FinanceiroOp)

| Aba | O que faz |
|---|---|
| Dashboard | KPIs financeiros, gráfico mensal, lista de atrasos, promessas, card de Acordo Assistido |
| Clientes | Lista completa + ClienteModal (perfil, edição com PERFIL_COBRANCA, contratos, histórico) |
| Contratos | Lista de contratos + ContratoModal (parcelas com dias de atraso por linha, timeline com dias de atraso por pagamento, ações incluindo Acordo Assistido e Recuperação Judicial) |
| Cobrança | Fila de parcelas vencidas (exclui acordo_assistido, em_processo_judicial e status terminais) |
| Financeiro | KPIs do período + tabela de pagamentos (inclui Capital Recuperado Assistido) + PDF |
| Perdas & Recuperação | Contratos baixados, acordos, recuperações, Acordo Assistido e Recuperação Judicial (KPIs de valor executado/recuperado/índice de recuperação) |
| Promessas | Acordos de pagamento futuros registrados |
| Inteligência | Painel analítico com KPIs, padrinhos, empregadores, score vs realidade |
| Simulador | Em desenvolvimento |

---

## 6. Modelo de negócio e dados financeiros

- **Receita**: juros sobre empréstimos pessoais
- **Capital Recuperado Assistido**: abatimentos durante Acordo Assistido — classificação separada (não é receita)
- **Moeda**: BRL (R$)
- **Fuso**: UTC-3 (Brasil)
- **Inadimplência**: rastreada, contratos podem entrar em Acordo Assistido (temporário) ou ser baixados como prejuízo (definitivo)
- **Recuperação**: acordos com desconto pós-baixa são registrados e rastreados
- **Score de cliente**: calculado automaticamente (critérios no GAS), congelado durante Acordo Assistido
- **PERFIL_COBRANCA**: avaliação comportamental do cliente (COOPERATIVO/NEUTRO/RESISTENTE/EVASIVO)
- **Capital em circulação**: totalmente do próprio Alex (financeira informal — sem investidores ou banco)

---

## 7. Estado atual do produto (atualizado 2026-07-04)

### Em produção e funcionando
- Sistema completo de contratos, parcelas e pagamentos
- Bot WhatsApp de triagem de leads (Evolution API)
- PIX carnê Efí Bank (geração manual ao criar contrato)
- Assinatura eletrônica via ZapSign
- Autenticação com sessão segura
- Comprovante PDF por pagamento e por quitação antecipada
- **Extrato do Contrato (PDF) redesenhado (2026-07-04)** — consciente de recuperação judicial (dados do processo, principal/lucro recuperado, honorários/custas), com "Percurso do Contrato" (timeline completa desde a criação até o encerramento)
- Relatório financeiro PDF por período
- Régua de cobrança automática D-5/D-1/D0/D+1/D+3/D+7 + PIX avulso Efí (concluída 2026-06-15)
- Design System Borges (dark/light mode, toggle automático)
- Motor analítico: LTV, ROI, aba Inteligência, PADRINHOS, EMPREGADORES
- Carteira de Recuperação Assistida (Acordo Assistido + PERFIL_COBRANCA — implementado 2026-06-14)
- **Módulo Recuperação Judicial (implementado 2026-07-04)** — ajuizamento deixa de ser status final; acordo judicial (parcelado ou à vista), quitação judicial e arquivamento de processo, com cascata de alocação (custo do credor → principal → lucro → reembolso ao devedor) e bloqueio de crédito permanente
- **Quitação Antecipada via PIX (implementado 2026-07-04)** — cliente paga a quitação direto por PIX (webhook Efí), sem precisar que Alex registre manualmente; proposta expira em 48h
- **Certificado de Quitação (implementado 2026-07-04)** — link público automático (sem login) enviado por WhatsApp quando o contrato quita, com CPF sempre mascarado
- **Motor de Undo — 15 min (implementado 2026-07-04)** — pagamentos e outras operações financeiras reversíveis podem ser desfeitas em até 15 minutos; **ainda sem botão no app**, só acionável via API
- **Auditoria automática de integridade + backup automático (implementado 2026-07-04)** — score diário de integridade dos dados (07:05) e cópia de segurança diária da planilha no Drive (2h, retém 30 cópias)

### Em andamento
- Bot triagem WhatsApp (Evolution API + Claude AI) — Fase 1B

### Pendente / próximos passos (roadmap)
| Fase | Descrição | Prioridade |
|---|---|---|
| 0 | Formalização jurídica + conta Google corporativa | Alta (blocker legal) |
| 1B | Régua de cobrança automática WhatsApp | Alta (próximo) |
| PDD | Provisão para Devedores Duvidosos — DRE mensal provisionado | Média (pendente decisão de percentuais) |
| 2 | Portal do cliente (PWA) | Baixa (pós-Supabase) |
| 3 | Migrar banco de dados de Google Sheets → Supabase | Baixa |

---

## 8. Convenções técnicas importantes

### GAS (appscript.gs)
- Mapa dinâmico de colunas (`buildColMap`) — nunca usar índice fixo
- Datas: sempre `parseDateLocal(s)` — `new Date("2026-05-30")` dá dia 29 no Brasil (bug de timezone UTC)
- IDs sequenciais: `proximoIdSeq(sheet, "PREFIXO")` → ex: `PAG00001`
- Status terminais de parcela (nunca reabrir): `pago | quitacao_antecipada | baixado_como_prejuizo | cancelado | renegociado`
- Status `acordo_assistido` no contrato: trigger diário não reverte; aplica apenas regra dos 180 dias

### Frontend (src/main.jsx)
- Arquivo único, sem componentes separados em arquivos externos (exceto shadcn/ui)
- Tema: variáveis globais `BG, CARD, BD, TEXT, MUTED, GRN, RED, BLU, YEL, PUR, ORG, ACC, SHD`
- `applyTheme(dark)` atualiza todas as variáveis + classe `dark` no `<html>`
- `IS()` / `LS()` = inline styles para inputs / labels usando cores atuais
- `postAction(body)` = POST para /api/action → GAS

### Semântica de cores (não desviar)
| Cor | Var | Uso |
|---|---|---|
| Forest Green | GRN | Ações primárias, valores positivos, receita |
| Alert Red | RED | Erros, atrasos, negativos |
| Deep Teal | BLU | Informação, links, Acordo Assistido |
| Amber | YEL | Avisos moderados |
| Warm Orange | ORG | Atraso/alerta, juros suspensos |
| Violet | PUR | Status especiais, renegociação |
| Lime Accent | ACC | Botões CTA primários |

### Segurança — NUNCA commitar
- `producao-849675-financeiroop.p12` — certificado Efí Bank
- Ambos no `.gitignore`

---

## 9. O dono do negócio

**Alex Borges**
- Email: alexborges.mx@gmail.com
- Opera o negócio sozinho (sem equipe)
- Acessa o sistema via navegador (Vercel production URL)
- Usa o FinanceiroOp como ferramenta operacional diária
- Usa Claude Code como co-desenvolvedor do sistema

---

*Este arquivo é gerado e mantido pelo Claude Code. Última atualização: 2026-06-14.*
