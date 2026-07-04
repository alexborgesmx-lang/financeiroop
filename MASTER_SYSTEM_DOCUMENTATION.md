# MASTER SYSTEM DOCUMENTATION — FinanceiroOp

> **Versão:** 1.0  
> **Última atualização:** 2026-07-04  
> **Responsável:** Alex Borges (alexborges.mx@gmail.com)  
> **Natureza:** Documento vivo — atualizar sempre que o sistema evoluir.

---

## ÍNDICE

1. [Visão Geral do Sistema](#visão-geral-do-sistema)
2. [Objetivo do Produto](#objetivo-do-produto)
3. [Arquitetura Geral](#arquitetura-geral)
4. [Tecnologias Utilizadas](#tecnologias-utilizadas)
5. [Módulos do Sistema](#módulos-do-sistema)
6. [Páginas e Telas](#páginas-e-telas)
7. [Componentes Reutilizáveis](#componentes-reutilizáveis)
8. [Banco de Dados](#banco-de-dados)
9. [APIs e Integrações](#apis-e-integrações)
10. [Automações](#automações)
11. [Sistema de Permissões](#sistema-de-permissões)
12. [Fluxos Operacionais Implementados](#fluxos-operacionais-implementados)
13. [Fluxos Financeiros Implementados](#fluxos-financeiros-implementados)
14. [Processos de Cobrança Implementados](#processos-de-cobrança-implementados)
15. [Dashboards e Indicadores](#dashboards-e-indicadores)
16. [Relatórios](#relatórios)
17. [Segurança](#segurança)
18. [Padrões de UI/UX](#padrões-de-uiux)
19. [Padrões de Código](#padrões-de-código)
20. [Dependências Externas](#dependências-externas)
21. [Limitações Identificadas](#limitações-identificadas)
22. [Oportunidades de Melhoria](#oportunidades-de-melhoria)
23. [Última Auditoria do Sistema](#última-auditoria-do-sistema)

---

## VISÃO GERAL DO SISTEMA

**Nome:** FinanceiroOp  
**Operado por:** Borges Assessoria — financeira informal de crédito pessoal  
**Proprietário único:** Alex Borges  
**Ambiente de produção:** Vercel (SPA React + Serverless API)  
**Banco de dados:** Google Sheets via Google Apps Script  

O FinanceiroOp é um sistema de gestão operacional completo para uma financeira informal de crédito pessoal. Cobre 100% do ciclo: captação de leads → triagem → cadastro → aprovação → geração de contrato → geração de carnê PIX → gestão de pagamentos → cobrança automática → renegociação → inadimplência → recuperação.

Opera em modo single-user — apenas o proprietário Alex Borges acessa o painel. Todo o capital emprestado é próprio (sem investidores, sem CNPJ de crédito).

---

## OBJETIVO DO PRODUTO

Substituir planilhas manuais e processos ad-hoc por um sistema integrado que permita:

- Cadastrar e aprovar clientes com suporte de score de crédito
- Criar contratos com parcelas automáticas e carnê PIX (Efí Bank)
- Registrar e rastrear pagamentos com comprovante PDF
- Gerenciar inadimplência com fila de cobrança inteligente
- Enviar cobrança automática por WhatsApp com PIX no gatilho certo
- Gerar relatórios financeiros com DRE simplificado
- Monitorar a carteira de crédito com PDD (Provisão para Devedores Duvidosos)
- Triagem automática de leads via bot WhatsApp + Claude AI

---

## ARQUITETURA GERAL

```
USUÁRIO (navegador)
       │
       ▼
  Vercel CDN / Edge
  ┌─────────────────────────────────────────┐
  │  SPA React 18 + Vite (build estático)  │
  │  src/main.jsx (~6.200 linhas)          │
  └────────────┬────────────────────────────┘
               │  fetch
       ┌───────┴───────────────────────────────┐
       │       Vercel Serverless Functions      │
       │  ┌──────────┐  ┌────────────────────┐ │
       │  │/api/action│  │/api/sheets (rewrite│ │
       │  │ (POST→GAS)│  │  →GAS doGet URL)  │ │
       │  └──────────┘  └────────────────────┘ │
       │  ┌──────────────┐ ┌────────────────┐  │
       │  │/api/efi-*    │ │/api/whatsapp   │  │
       │  │(Efí Bank PIX)│ │(Bot WhatsApp)  │  │
       │  └──────────────┘ └────────────────┘  │
       │  ┌────────────────────────────────┐   │
       │  │/api/webhook-efi (Efí callback) │   │
       │  └────────────────────────────────┘   │
       └───────────────────────────────────────┘
               │                    │
               ▼                    ▼
  Google Apps Script (GAS)    Serviços Externos
  appscript.gs (~5.557 linhas) ┌─────────────┐
  ┌───────────────────────┐    │ Efí Bank    │
  │ doGet() — lê Sheets   │    │ ZapSign     │
  │ doPost() — escreve    │    │ Evolution GO│
  │ Trigger diário 7h     │    │ Claude AI   │
  └──────────┬────────────┘    └─────────────┘
             │
             ▼
     Google Sheets (DB)
     12 abas / planilhas
```

**Fluxo de dados de leitura:**  
`Frontend → GET /api/sheets → rewrite Vercel → GAS doGet() → todas as abas como JSON`

**Fluxo de dados de escrita:**  
`Frontend → POST /api/action → Vercel Function → GAS doPost() → escrita no Sheets`

**Fluxo de pagamento automático PIX:**  
`Efí Bank → POST /api/webhook-efi → Vercel Function → GAS pagamentoAutomatico() → Sheets`

---

## TECNOLOGIAS UTILIZADAS

### Frontend

| Tecnologia | Versão | Uso |
|---|---|---|
| React | 18.2.0 | Framework principal da SPA |
| Vite | 4.4.0 | Build tool + dev server |
| Recharts | 2.8.0 | Gráficos (BarChart no Dashboard e Gestão) |
| jsPDF | 4.2.1 | Geração de comprovantes e relatórios PDF |
| shadcn/ui | 4.8.0 | Componentes UI reutilizáveis (Button, Card, Dialog...) |
| Tailwind CSS | 4.3.0 | Classes utilitárias de layout |
| clsx + tailwind-merge | — | Utilitário `cn()` para classes condicionais |
| lucide-react | 1.16.0 | Ícones SVG |
| cmdk | 1.1.1 | Command palette (instalado, não usado em produção) |

### Backend / Infraestrutura

| Tecnologia | Uso |
|---|---|
| Google Apps Script (GAS) | Backend principal — lógica de negócio, leitura/escrita no Sheets |
| Google Sheets | Banco de dados (12 abas) |
| Vercel Serverless Functions | Proxy HTTP + integrações externas |
| Node.js (Vercel) | Runtime das serverless functions |

### Integrações Externas

| Serviço | Propósito |
|---|---|
| Efí Bank | Geração de cobranças PIX com vencimento (cobv) |
| ZapSign | Assinatura eletrônica de contratos |
| Evolution GO (WhatsApp) | Envio de mensagens de cobrança automática |
| Google Forms | Cadastro autônomo de novos clientes |
| Claude AI (Anthropic) | Bot de triagem de leads via WhatsApp |
| Google Docs | Template de contrato para impressão/PDF |

---

## MÓDULOS DO SISTEMA

### 1. Módulo de Clientes

**Objetivo:** Cadastro, gestão e monitoramento de todos os clientes.

**Funcionalidades:**
- Listagem com busca por nome, CPF, telefone
- Filtros por status (`ativo`, `aguardando_conferencia`, `bloqueado`, `inativo`)
- Cadastro manual pelo painel ou automático via Google Forms
- Score de crédito automático (0–100 pontos)
- Visualização de histórico de contratos
- Edição de perfil com auto-correções (nome em title case, telefone normalizado, email fixado)
- Badge de Perfil de Cobrança (COOPERATIVO / NEUTRO / RESISTENTE / EVASIVO)
- Métricas por cliente: LTV, ROI, taxa de adimplência, atraso médio/máximo

**Arquivos:**  
- `src/main.jsx` — componentes `ClienteModal`, `NovoCliente`, listagem de clientes
- `appscript.gs` — `onFormSubmit`, `salvarCliente`, `calcularScore`, `calcularMetricasCliente`

### 2. Módulo de Contratos

**Objetivo:** Criação, gestão e ciclo de vida completo de contratos de empréstimo.

**Funcionalidades:**
- Criação de contrato com cálculo automático de parcelas
- Geração de documento Google Docs via template
- Envio para assinatura eletrônica (ZapSign)
- Geração de carnê PIX em lote (Efí Bank)
- Visualização de parcelas no `ContratoModal` com tabela completa
- Ações disponíveis: pagar parcela, reagendar, quitar antecipado, baixar como prejuízo, Acordo Assistido, Ajuizar/Recuperação Judicial
- Status automático atualizado diariamente pelo trigger das 7h (não se aplica a `em_processo_judicial`/`encerrado_judicialmente`)

**Arquivos:**  
- `src/main.jsx` — `ContratoModal`, `NovoContrato`, `QuitacaoAntecipadaModal`, `BaixaModal`
- `appscript.gs` — `novoContrato`, `gerarDoc`, `baixarContratoPrejuizo`, `moverParaAcordoAssistido`

### 3. Módulo de Pagamentos

**Objetivo:** Registro, rastreamento e comprovação de todos os recebimentos.

**Funcionalidades:**
- Registro de pagamento normal, com atraso, antecipado
- Pagamento somente juros (rola principal para parcela extra)
- Quitação antecipada com desconto opcional nos juros
- Recuperação após baixa
- Acordo com perda (renegociação)
- Abatimento em Acordo Assistido
- Geração de comprovante PDF via jsPDF
- Envio do comprovante por WhatsApp
- Score recalculado automaticamente após cada pagamento

**Arquivos:**  
- `src/main.jsx` — `PagamentoDrop`, `PagamentoParcelaModal`, `ComprovanteEnvioModal`, `PagamentoDetalheModal`
- `appscript.gs` — `registrarPagamentoAPI`, `registrarPagamentoParcial`, `registrarAbatimentoAssistido`

### 4. Módulo de Cobrança

**Objetivo:** Gestão da fila de inadimplentes e ações de cobrança.

**Funcionalidades:**
- Lista de parcelas vencidas agrupadas por cliente
- Exclusão automática de contratos em status terminal e `acordo_assistido`
- Ações por parcela: pagar, reagendar, enviar WhatsApp, gerar PIX
- Regime de promessas (cliente promete data futura → parcela aparece como "reagendado")
- Régua de cobrança automática via WhatsApp (Evolution GO)
- PIX avulso gerado por parcela (Efí Bank)

**Arquivos:**  
- `src/main.jsx` — aba Cobrança, `CobrancaModal`, `NovaPromessaModal`
- `appscript.gs` — `enviarReguaCobranca`, `_enviarWppRegua`, `_gerarPixAvulso`
- `api/efi-pix-avulso.js` — endpoint chamado pelo GAS para gerar PIX por parcela

### 5. Módulo Financeiro

**Objetivo:** Demonstrativo financeiro por período com KPIs e exportação PDF.

**Funcionalidades:**
- Filtro por período (padrão: mês atual)
- KPIs: receita realizada, receita extra de atraso, capital recuperado assistido
- Tabela de pagamentos do período
- Linha separada para abatimentos em Acordo Assistido (nunca somados à receita)
- Exportação PDF do relatório financeiro via jsPDF

**Arquivos:**  
- `src/main.jsx` — aba Financeiro

### 6. Módulo de Carteira

**Objetivo:** Visão gerencial da carteira de crédito com PDD e resultado ajustado ao risco.

**Funcionalidades:**
- KPIs: capital em circulação, saldo devedor total, PDD total, carteira ajustada
- Distribuição por faixa de atraso (7 faixas)
- PDD Gerencial v1.0 (percentuais calibrados sobre histórico real de 216 contratos)
- Resultado Ajustado ao Risco (últimos 12 meses)
- Semáforos de cor para ROI bruto, ROI ajustado e margem

**Arquivos:**  
- `src/main.jsx` — aba Carteira, `useMemo carteira`, `useMemo resultado12m`

### 7. Módulo de Perdas & Recuperação

**Objetivo:** Gestão de contratos baixados, em recuperação e em Acordo Assistido.

**Funcionalidades:**
- Lista de contratos em status de perda (`baixado_como_prejuizo`, `em_recuperacao`, `recuperado_parcialmente`, `encerrado_sem_recuperacao`, `acordo_assistido`, `em_processo_judicial`, `encerrado_judicialmente`)
- Ações: registrar recuperação, registrar acordo com perda, encerrar sem recuperação, retornar para cobrança
- Exibição de PERFIL_COBRANCA do cliente
- Controle de Acordo Assistido: capital abatido vs capital restante vs juros suspensos
- KPIs de Recuperação Judicial: contratos em judicial, valor executado total, recuperado (principal+lucro), índice de recuperação

**Arquivos:**  
- `src/main.jsx` — aba Perdas & Recuperação, `PerdaAcoesModal`, `RecuperacaoModal`, `ModalAcordoPerda`
- `appscript.gs` — `registrarRecuperacaoAposBaixa`, `registrarAcordoComPerda`, `sairDoAcordoAssistido`

### 8. Módulo de Promessas

**Objetivo:** Rastreamento de promessas de pagamento futuras.

**Funcionalidades:**
- Listagem de promessas por status (PENDENTE / CUMPRIDA / QUEBRADA)
- Vencimento automático: promessas com data vencida viram QUEBRADA às 7h
- Cancelamento automático ao registrar pagamento: promessas PENDENTE do contrato viram CUMPRIDA

**Arquivos:**  
- `src/main.jsx` — aba Promessas
- `appscript.gs` — `verificarPromessasVencidas`, `_cancelarPromessasPorContrato`

### 9. Módulo Inteligência

**Objetivo:** Painel analítico com KPIs avançados, rankings e análise de portfólio.

**Funcionalidades:**
- Top/bottom clientes por LTV, ROI, adimplência
- Análise de padrinhos (score do padrinho, indicados ativos, qualidade dos indicados)
- Análise de empregadores (score do empregador, taxa de adimplência média)
- Análise de profissões
- Score vs realidade (correlação entre score e desempenho)

**Arquivos:**  
- `src/main.jsx` — aba Inteligência
- `appscript.gs` — `atualizarTabelaPadrinhos`, `atualizarTabelaEmpregadores`, `calcularScorePadrinho`, `calcularScoreEmpregador`

### 10. Módulo Régua WPP

**Objetivo:** Monitoramento e configuração da régua de cobrança WhatsApp.

**Funcionalidades:**
- Log de todos os disparos com filtros por gatilho e status
- KPIs: total enviado, taxa de sucesso, erros
- Editor de templates de mensagem (10 templates: 9 régua + 1 confirmação)
- Salvamento de templates no CONFIGURACOES do Sheets (sem acessar planilha)

**Arquivos:**  
- `src/main.jsx` — aba Régua WPP, `TemplatesReguaModal`
- `appscript.gs` — `buscarTemplatesRegua`, `salvarTemplateRegua`, `_garantirConfigsRegua`

### 11. Módulo Simulador

**Objetivo:** Simulação de empréstimo antes da criação do contrato.

**Status:** Em desenvolvimento — disponível mas incompleto.

**Funcionalidades implementadas:**
- Entrada de valor, prazo e taxa
- Cálculo automático de parcela, juros total, valor total
- Visualização da tabela de parcelas
- Compartilhamento via WhatsApp (`wa.me`)

### 12. Módulo Recuperação Judicial (implementado 2026-07-04)

**Objetivo:** Gerir o ciclo de vida completo de um contrato após o ajuizamento — que deixou de ser um status final para ser o início de uma nova fase.

**Funcionalidades:**
- Duas dimensões independentes: `STATUS_PROCESSO` (situação processual: EM_PREPARACAO → AJUIZADO → ... → ARQUIVADO/EXTINTO) e `SITUACAO_FINANCEIRA_JUDICIAL` (EM_ABERTO → ACORDO_PARCELADO_ATIVO/ACORDO_QUEBRADO → QUITADO_JUDICIALMENTE / RECUPERADO_PARCIAL / PERDA_JUDICIAL_DEFINITIVA)
- Acordo Judicial Parcelado — gera novas parcelas na aba PARCELAS (`ORIGEM_PARCELA="acordo_judicial"`), reaproveitando o motor de vencimento/pagamento já existente
- Acordo Judicial à Vista e Quitação Judicial — liquidação em parcela única
- Arquivamento de Processo — encerra o processo; sem recuperação total vira `PERDA_JUDICIAL_DEFINITIVA`
- Cascata de alocação de valores recebidos (`_alocarRecuperacaoJudicial`): custo do credor (honorários/custas) → principal → lucro → reembolso ao devedor
- Bloqueio de crédito permanente: `CLIENTE_JUDICIALIZADO` nunca é revertido, validado no backend (`criarContrato`)
- Status terminal único `encerrado_judicialmente` — nunca reaproveita os status mortos `recuperado_parcialmente`/`em_recuperacao`

**Arquivos:**
- `src/main.jsx` — aba Jurídico no `ContratoModal`, `AcordoJudicialModal`, `QuitacaoJudicialModal`, `ArquivarProcessoModal`
- `appscript.gs` — `ajuizarContrato`, `registrarAcordoJudicial`, `registrarQuitacaoJudicial`, `arquivarProcessoJudicial`, `_alocarRecuperacaoJudicial`

---

### 13. Módulo Quitação Antecipada via PIX + Certificado de Quitação (implementado 2026-07-04)

**Objetivo:** Permitir que o cliente quite o contrato pagando via PIX diretamente, sem depender de Alex registrar manualmente, e emitir automaticamente um comprovante público de quitação.

**Funcionalidades:**
- `gerarPropostaQuitacaoPix` calcula principal+juros das parcelas selecionadas, aplica desconto (limitado ao total de juros), gera TXID fixo por contrato e grava proposta `PENDENTE` na aba QUITACOES — expira em 48h (`verificarQuitacoesExpiradas`)
- Reaproveita proposta `PENDENTE` existente em vez de duplicar
- `pagamentoQuitacaoWebhook` (disparado pelo webhook da Efí) chama a mesma `registrarQuitacaoAntecipada` do fluxo manual — mesma fórmula de desconto, sem divergência — protegido por idempotência (chave `QUIT_<txid>`, com sufixo de retry R1/R2 removido antes de checar)
- Ao quitar (por qualquer via), `gerarCertificadoQuitacao` gera um certificado com código único e `_gerarEEnviarCertificado` envia o link por WhatsApp automaticamente
- Certificado é público (`/c/:codigo` → `api/cert.js`), sem login, com CPF sempre mascarado
- Dedup: contrato com certificado "ativo" sempre retorna o mesmo link, nunca duplica

**Arquivos:**
- `appscript.gs` — `gerarPropostaQuitacaoPix`, `salvarPixQuitacao`, `cancelarPropostaQuitacao`, `pagamentoQuitacaoWebhook`, `verificarQuitacoesExpiradas`, `gerarCertificadoQuitacao`, `buscarCertificadoPublico`, `_gerarEEnviarCertificado`
- `api/cert.js` — página pública do certificado

**Gap conhecido:** sem UI própria no `main.jsx` para iniciar a proposta de quitação PIX (só acionável via API); `TemplatesReguaModal` não expõe o template `TEMPLATE_CERTIFICADO_QUITACAO` para edição.

---

### 14. Motor de Undo, Auditoria Automática e Backup (implementado 2026-07-04)

**Objetivo:** Camadas de segurança operacional — desfazer erro recente, diagnosticar inconsistência de dados e proteger contra perda total.

**Funcionalidades:**
- **Undo (15 min):** `registrarUndo` grava o estado anterior de toda operação financeira reversível (pagamento normal, somente juros, quitação antecipada, acordo com perda, recuperação após baixa, abatimento assistido, baixa por prejuízo); `reverterOperacao` desfaz via handler `_reverter*` dedicado por tipo, respeitando TTL de 15 min e ordem (só a mais recente do contrato)
- **Idempotência:** `_idem_check`/`_idem_reg` protegem os webhooks Efí (pagamento normal e quitação) contra reentrega duplicada
- **Auditoria automática:** `auditarIntegridadeSistema` roda diariamente às 07:05, varre relacionamentos/status/matemática de todas as tabelas principais, calcula score de integridade 0–100 e grava na aba AUDITORIA — só diagnostica, não corrige
- **Backup automático:** `fazerBackupAutomatico` copia a planilha inteira para o Drive todo dia às 2h, retendo as últimas 30 cópias

**Arquivos:**
- `appscript.gs` — `registrarUndo`, `reverterOperacao`, `_reverter*` (7 handlers), `_idem_check`, `_idem_reg`, `auditarIntegridadeSistema`, `fazerBackupAutomatico`

**Gap conhecido:** nenhum desses três recursos tem UI no `main.jsx` — undo não tem botão "Desfazer", auditoria e backup só são visíveis abrindo a planilha diretamente. Confirmar em Extensões → Apps Script → Gatilhos que `configurarTriggerAuditoria`/`configurarTriggerBackup` foram rodados 1x — sem isso os triggers diários não existem.

---

## PÁGINAS E TELAS

### Dashboard

| Item | Detalhe |
|---|---|
| **Finalidade** | Visão executiva do negócio em tempo real |
| **KPIs hero** | Capital Emprestado, Capital Recebido, A Receber, Em Atraso |
| **Gráfico** | BarChart de recebimentos mensais (últimos 6 meses) |
| **Seção Em Atraso** | Lista de parcelas atrasadas com dias de atraso |
| **Seção Promessas** | Promessas PENDENTE com data e valor |
| **Card Acordo Assistido** | Contratos em `acordo_assistido` com capital abatido e restante |
| **Componentes** | `InfoTooltip` em 5 cards, gradiente hero, BarChart Recharts |
| **Permissões** | Autenticado |

### Clientes

| Item | Detalhe |
|---|---|
| **Finalidade** | Gestão completa da base de clientes |
| **Busca** | Por nome, CPF, telefone (filtro em tempo real) |
| **Filtros** | Por status do cliente |
| **Ações** | Ver perfil, editar, criar contrato, ver contratos |
| **ClienteModal** | 4 abas: Perfil, Editar, Contratos, Score |
| **Permissões** | Autenticado |

### Contratos

| Item | Detalhe |
|---|---|
| **Finalidade** | Gestão de todos os contratos e parcelas |
| **Filtros** | Por status do contrato, por cliente |
| **ContratoModal** | Tabela de parcelas, timeline, ações por parcela |
| **Ações** | Pagar, reagendar, quitar antecipado, baixar, Acordo Assistido, abatimento, retornar |
| **Permissões** | Autenticado |

### Cobrança

| Item | Detalhe |
|---|---|
| **Finalidade** | Fila de cobrança de parcelas vencidas |
| **Exclusões** | Contratos em `acordo_assistido` e status terminais |
| **Agrupamento** | Por cliente (sidebar) |
| **Ações** | Pagar, reagendar, WhatsApp, gerar PIX |
| **Badge sidebar** | Número de parcelas atrasadas |
| **Subtítulo** | "X clientes · Y parcelas" |
| **Permissões** | Autenticado |

### Financeiro

| Item | Detalhe |
|---|---|
| **Finalidade** | DRE simplificado por período |
| **Filtro** | Período (padrão: mês atual) |
| **KPIs** | Receita realizada, receita extra atraso, capital recuperado assistido |
| **Tabela** | Pagamentos do período com tipo e forma |
| **Exportação** | PDF via jsPDF |
| **Permissões** | Autenticado |

### Carteira

| Item | Detalhe |
|---|---|
| **Finalidade** | Risco da carteira com PDD gerencial |
| **KPIs** | Capital circulação, saldo devedor, PDD, carteira ajustada, cobertura PDD |
| **Distribuição** | 7 faixas de atraso com saldo e PDD por faixa |
| **Resultado 12m** | ROI bruto, ROI ajustado, margem ajustada com semáforos de cor |
| **Permissões** | Autenticado |

### Perdas & Recuperação

| Item | Detalhe |
|---|---|
| **Finalidade** | Gestão de carteira problemática |
| **Filtro** | Status (baixado, em recuperação, recuperado, acordo_assistido) |
| **Ações** | Registrar recuperação, registrar acordo com perda, encerrar, retornar |
| **Permissões** | Autenticado |

### Promessas

| Item | Detalhe |
|---|---|
| **Finalidade** | Acordos de pagamento futuros |
| **Filtros** | PENDENTE / CUMPRIDA / QUEBRADA |
| **Permissões** | Autenticado |

### Inteligência

| Item | Detalhe |
|---|---|
| **Finalidade** | Análise avançada de portfólio e clientes |
| **Seções** | Rankings, padrinhos, empregadores, score vs realidade |
| **Permissões** | Autenticado |

### Régua WPP

| Item | Detalhe |
|---|---|
| **Finalidade** | Log e configuração da cobrança automática WhatsApp |
| **Log** | Tabela com todos os disparos, filtros por gatilho e status |
| **Templates** | Editor de 10 templates (modal `TemplatesReguaModal`) |
| **Permissões** | Autenticado |

### Simulador

| Item | Detalhe |
|---|---|
| **Finalidade** | Simulação de empréstimo antes de formalizar |
| **Status** | Em desenvolvimento |
| **Permissões** | Autenticado |

---

## COMPONENTES REUTILIZÁVEIS

### Componentes shadcn/ui (em `src/components/ui/`)

| Componente | Uso principal |
|---|---|
| `Button` | Botões padronizados com variantes |
| `Card` | Container de cards |
| `Dialog` | Modais overlay |
| `Select` | Dropdowns de seleção |
| `Tabs` | Navegação por abas (ClienteModal) |
| `Badge` | Tags de status |
| `Input` | Campos de texto padronizados |
| `Label` | Rótulos de campo |
| `Separator` | Divisores |
| `Table` | Tabelas estruturadas |
| `Tooltip` | Tooltips hover |
| `Avatar` | Ícones de usuário |
| `Popover` | Popovers contextuais |
| `Command` | Paleta de comandos |
| `Checkbox` | Caixas de seleção |
| `RadioGroup` | Seleção exclusiva |
| `Switch` | Toggle on/off |
| `Textarea` | Área de texto multilinha |
| `Slider` | Controle deslizante |
| `Progress` | Barra de progresso |
| `Alert` | Alertas e avisos |

### Componentes internos de negócio (em `src/main.jsx`)

| Componente | Propósito |
|---|---|
| `CampoEdit` | Campo editável com suporte a `fixup` no blur |
| `InfoTooltip` | Tooltip de informação com `getBoundingClientRect` (position:fixed) |
| `ClienteModal` | Modal completo de perfil/edição do cliente |
| `ContratoModal` | Modal de parcelas, pagamentos e ações do contrato |
| `NovoContrato` | Formulário de criação de contrato |
| `PagamentoDrop` | Dropdown inline de pagamento (Dashboard/Cobrança) |
| `PagamentoParcelaModal` | Modal de registro de pagamento |
| `CobrancaModal` | Modal de ação de cobrança por parcela |
| `QuitacaoAntecipadaModal` | Modal de quitação antecipada com desconto |
| `BaixaModal` | Modal de baixa como prejuízo |
| `RecuperacaoModal` | Modal de recuperação após baixa |
| `ModalAcordoPerda` | Modal de acordo com perda/desconto |
| `PerdaAcoesModal` | Hub de ações para contratos em perda |
| `AbatimentoAssistidoModal` | Modal de abatimento em Acordo Assistido |
| `NovaPromessaModal` | Modal de registro de promessa de pagamento |
| `ComprovanteEnvioModal` | Modal de envio de comprovante por WhatsApp/PDF |
| `PagamentoDetalheModal` | Detalhe de pagamento histórico com reabrir parcela |
| `TemplatesReguaModal` | Editor dos 10 templates da régua WPP |
| `PerdaInfoModal` | Detalhe de contrato em perda |

### Funções utilitárias (`src/main.jsx` — topo do arquivo)

| Função | Retorno |
|---|---|
| `postAction(body)` | `Promise<JSON>` — POST para `/api/action` → GAS |
| `statusEfetivo(parcela)` | Status calculado pela data (ignora valor gravado) |
| `parseDate(s)` | `Date` — parse seguro sem bug de timezone |
| `fmtR(valor)` | `"R$ 1.234,56"` — formatação monetária pt-BR |
| `fmtDt(data)` | `"17/06/2026"` — formatação de data pt-BR |
| `hojeStr()` | `"2026-06-17"` — data de hoje como string |
| `apiDateStr(s)` | Converte input date → `"YYYY-MM-DDT12:00:00"` para GAS |
| `calcProxVenc(diaVenc)` | Próximo vencimento = mês seguinte ao dia preferido |
| `titleCasePT(s)` | Title case respeitando preposições PT |
| `normTel(s)` | Normaliza telefone: 10→11 dígitos |
| `fixEmail(s)` | Lowercase + corrige `@gmail.com.br` |
| `mesAtualRange()` | `{ini, fim}` — primeiro e último dia do mês atual |
| `pddPct(d)` | Percentual de PDD dado `d` dias de atraso |

---

## BANCO DE DADOS

O banco de dados é composto por **17 abas** no Google Sheets (12 originais + UNDO_LOG, QUITACOES, CERTIFICADOS, AUDITORIA e OPERACOES_PROCESSADAS, adicionadas 2026-07-04). Cada aba é uma tabela com cabeçalho na linha 1 e dados a partir da linha 2.

### Tabelas

#### CLIENTES

| Coluna | Tipo | Descrição |
|---|---|---|
| ID_CLIENTE | Sequencial (001, 002...) | PK — identificador único |
| NOME | Texto | Title case, sem dígitos |
| CPF | Texto | 11 dígitos |
| RG | Texto | Somente dígitos |
| NACIONALIDADE | Texto | |
| ESTADO_CIVIL | Texto | |
| PROFISSAO | Texto | Somente letras |
| TELEFONE_WPP | Texto | 11 dígitos (DDD + 9 + número) |
| EMAIL | Texto | Lowercase |
| CEP / RUA / NUMERO / QUADRA / LOTE / SETOR / COMPLEMENTO / CIDADE_ESTADO | Texto | Endereço completo |
| CONTATO_CONFIANCA_1 / TEL_CONFIANCA_1 | Texto | Pessoa de confiança 1 |
| CONTATO_CONFIANCA_2 / TEL_CONFIANCA_2 | Texto | Pessoa de confiança 2 |
| DIA_VENCIMENTO_PREFERIDO | Número (1–31) | Dia preferido para vencimento |
| PADRINHO | Texto | Nome do cliente que indicou |
| TEL_PADRINHO | Texto | Preenchido por fuzzy match no onFormSubmit |
| DATA_CADASTRO | Data | |
| STATUS_CLIENTE | Enum | `aguardando_conferencia` / `ativo` / `inativo` / `bloqueado` |
| QUALIDADE_COMUNICACAO | Enum | `Boa` / `Regular` / `Ruim` |
| PERFIL_COBRANCA | Enum | `COOPERATIVO` / `NEUTRO` / `RESISTENTE` / `EVASIVO` |
| OBSERVACOES | Texto | |
| SCORE | Número (0–100) | Score de crédito calculado |
| SCORE_FAIXA | Texto | Excelente / Bom / Médio / Atenção / Alto risco / Bloqueado |
| SCORE_DECISAO | Texto | Aprovado / Aprovado com restrição / Análise manual / Recusado / Bloqueado |
| SCORE_LIMITE_SUGERIDO | Moeda | Limite de crédito sugerido pelo score |
| SCORE_PARCELA_MAX | Moeda | Parcela máxima mensal sugerida |
| SCORE_TAXA_LABEL | Texto | Mínima / Padrão baixa / Padrão / Alta / Máxima |
| SCORE_TAXA_PCT | Decimal | Taxa sugerida (ex: 0.18 = 18%) |
| SCORE_PRAZO_MAX | Número | Prazo máximo sugerido |
| SCORE_PADRINHO | Número (0–100) | Score do padrinho indicador |
| SCORE_EMPREGADOR | Número (0–100) | Score do empregador |
| SCORE_BLOQUEADO | Texto | `SIM` / `NAO` |
| SCORE_MOTIVOS | Texto | Fatores que impactaram o score |
| SCORE_DATA | Data | Data do último cálculo de score |
| RENDA_MENSAL | Moeda | Renda operacional usada no score |
| RENDA_LIQUIDA | Moeda | Renda líquida do contracheque |
| RENDA_BRUTA | Moeda | Renda bruta do contracheque |
| EMPREGADOR | Texto | Nome do empregador |
| DATA_ADMISSAO | Data | Data de admissão na empresa |
| LTV_CLIENTE | Moeda | Soma de todos os juros pagos |
| LUCRO_TOTAL | Moeda | LTV + receita extra de atraso |
| PREJUIZO_TOTAL | Moeda | Capital perdido em contratos baixados |
| ROI_CLIENTE | Decimal | LUCRO_TOTAL / capital total emprestado |
| ATRASO_MEDIO | Número | Média de dias de atraso em pagamentos |
| ATRASO_MAXIMO | Número | Maior atraso já registrado |
| PROMESSAS_QUEBRADAS | Número | Quantidade de promessas QUEBRADA |
| TAXA_ADIMPLENCIA | Decimal | % de parcelas pagas pontualmente |
| TOTAL_EMPRESTADO | Moeda | Soma de VALOR_PRINCIPAL dos contratos |
| TOTAL_PAGO | Moeda | Soma de VALOR_PAGO dos pagamentos |
| CONTRATOS_ATIVOS | Número | Quantidade de contratos ativos |
| CONTRATOS_BAIXADOS | Número | Quantidade de contratos baixados |

#### CONTRATOS

| Coluna | Descrição |
|---|---|
| ID_CONTRATO | `PCL-Nº NNN` — identificador único |
| ID_CLIENTE | FK → CLIENTES |
| NOME_CLIENTE | Desnormalizado |
| DATA_EMPRESTIMO | Data da liberação |
| DATA_PRIMEIRA_PARCELA | Vencimento da parcela 1 |
| VALOR_PRINCIPAL | Capital emprestado |
| NUM_PARCELAS | Quantidade de parcelas |
| TAXA_JUROS_MENSAL | Ex: 0.18 = 18% |
| TAXA_JUROS_TOTAL | Taxa total acumulada |
| JUROS_TOTAL | Valor total de juros |
| VALOR_TOTAL | Principal + juros |
| VALOR_PARCELA | Valor médio por parcela |
| PARCELA_PRINCIPAL | Parte principal por parcela |
| PARCELA_JUROS | Parte de juros por parcela |
| STATUS_CONTRATO | Ver ciclo de status abaixo — **fonte única de verdade** |
| STATUS_CARTEIRA | Auxiliar/legado — não usar em lógica de negócio |
| SUBSTATUS_PREJUIZO | Detalhe em contratos baixados |
| DATA_BAIXA_PREJUIZO | Data da baixa |
| MOTIVO_BAIXA_PREJUIZO | Motivo declarado |
| POSSIBILIDADE_RECUPERACAO | `ALTA` / `MEDIA` / `BAIXA` |
| VALOR_RECUPERADO_APOS_BAIXA | Capital recuperado pós-baixa |
| PREJUIZO_CAPITAL | Capital ainda a perder |
| JUROS_NAO_REALIZADOS | Juros que não serão recebidos |
| DIAS_ATRASO_NA_BAIXA | Dias de atraso no momento da baixa |
| BLOQUEADO_PARA_NOVO_CREDITO | `SIM` / `NAO` |
| MOTIVO_BLOQUEIO_CREDITO | Motivo do bloqueio |
| STATUS_JURIDICO | `NAO_ANALISADO` / outros |
| PROXIMA_PROVIDENCIA | Ação planejada |
| OBSERVACAO_BAIXA | Texto livre |
| VALOR_ACORDO | Valor acordado em renegociação |
| DATA_ACORDO | Data do acordo formal |
| DESCONTO_PRINCIPAL_ACORDO | Desconto no principal |
| DESCONTO_JUROS_ACORDO | Desconto nos juros |
| DATA_ENTRADA_ACORDO_ASSISTIDO | Data de entrada no Acordo Assistido |
| MOTIVO_ACORDO_ASSISTIDO | Demissão / Afastamento INSS / Saúde / Redução renda / Outro |
| OBSERVACAO_ACORDO_ASSISTIDO | Texto livre sobre o acordo |
| VALOR_ABATIDO_ASSISTIDO | Acumulado de abatimentos durante o Acordo Assistido |
| NUMERO_PROCESSO / DATA_AJUIZAMENTO / VARA / COMARCA | Dados do processo judicial |
| STATUS_PROCESSO | Situação processual: EM_PREPARACAO → AJUIZADO → ... → ARQUIVADO/EXTINTO |
| VALOR_EXECUTADO | Valor pleiteado na ação judicial |
| SITUACAO_FINANCEIRA_JUDICIAL *(2026-07-04)* | EM_ABERTO / ACORDO_PARCELADO_ATIVO / ACORDO_QUEBRADO / QUITADO_JUDICIALMENTE / RECUPERADO_PARCIAL / PERDA_JUDICIAL_DEFINITIVA |
| VALOR_RECUPERADO_JUDICIAL_PRINCIPAL / _LUCRO *(2026-07-04)* | Acumuladores de recuperação judicial |
| HONORARIOS_JUDICIAIS / CUSTAS_JUDICIAIS + QUEM_PAGA_* *(2026-07-04)* | Valor e responsável (DEVEDOR/CREDOR) |
| DATA_ARQUIVAMENTO_PROCESSO / MOTIVO_ARQUIVAMENTO *(2026-07-04)* | Preenchidos ao arquivar o processo |

**STATUS_CONTRATO — Ciclo de vida:**

```
ativo_em_dia
    ├─ (atraso 1–30d)   → ativo_em_atraso
    ├─ (atraso 31–60d)  → em_cobranca
    ├─ (atraso 61+d)    → pre_prejuizo
    ├─ [manual]         → acordo_assistido
    │       └─ (180d sem abatimento) → pre_prejuizo
    ├─ [manual: ajuizar] → em_processo_judicial (NÃO é status final — ver Módulo 12)
    │       └─ [acordo/quitação/arquivamento] → encerrado_judicialmente
    └─ [manual]         → baixado_como_prejuizo
                               ├─ em_recuperacao
                               │   ├─ recuperado_parcialmente
                               │   └─ recuperado_integralmente
                               └─ encerrado_sem_recuperacao

quitado            — todas parcelas pagas
cancelado          — contrato cancelado
renegociado        — acordo com perda formalizado
```

**Status que o trigger diário NÃO reverte:**  
`baixado_como_prejuizo`, `em_recuperacao`, `recuperado_parcialmente`, `recuperado_integralmente`, `encerrado_sem_recuperacao`, `cancelado`, `renegociado`, `quitado`, `acordo_assistido`, `em_processo_judicial`, `encerrado_judicialmente`

#### PARCELAS

| Coluna | Descrição |
|---|---|
| ID_PARCELA | Sequencial 5 dígitos (ex: 00042) |
| ID_CONTRATO | FK → CONTRATOS |
| ID_CLIENTE | FK → CLIENTES |
| NOME_CLIENTE | Desnormalizado |
| NUM_PARCELA | Número da parcela (1, 2, 3...) |
| TOTAL_PARCELAS | Total de parcelas do contrato |
| DATA_VENCIMENTO | Data de vencimento |
| VALOR_PARCELA | Valor original da parcela |
| VALOR_PRINCIPAL | Parte principal |
| VALOR_JUROS | Parte de juros |
| STATUS | Status atual da parcela |
| DATA_PAGAMENTO | Data em que foi paga |
| VALOR_PAGO | Valor recebido |
| DIFERENCA_PAGA | Extra pago (legado — usar RECEITA_EXTRA_ATRASO) |
| TIPO_PAGAMENTO | Ver lista abaixo |
| ORIGEM_PARCELA | `original` / `gerada_por_pagamento_de_juros` |
| ID_PARCELA_ORIGEM | ID da parcela que gerou esta (somente_juros) |
| DATA_ACORDO | Data de reagendamento (promessa) |
| VALOR_RECEBIDO | Valor líquido recebido |
| DESCONTO_APLICADO | Desconto concedido nos juros |
| DIAS_ATRASO | Dias de atraso no pagamento |
| DIAS_ANTECIPACAO | Dias de antecipação |
| OBSERVACOES | Texto livre |
| PIX_TXID | ID da cobrança na Efí Bank |

**Status de parcela:**

| Status | Terminal? |
|---|---|
| `pendente` | Não |
| `vence_hoje` | Não |
| `atrasado` | Não |
| `reagendado` | Não |
| `pago` | **Sim** |
| `quitacao_antecipada` | **Sim** |
| `baixado_como_prejuizo` | **Sim** |
| `cancelado` | **Sim** |
| `renegociado` | **Sim** |

**Tipos de pagamento:**

| Tipo | Quando |
|---|---|
| `pagamento_normal` | Pago na data |
| `pagamento_antecipado` | Pago antes do vencimento |
| `pagamento_com_atraso` | Pago após o vencimento |
| `somente_juros` | Só juros pagos; cria parcela extra |
| `quitacao_antecipada` | Liquidação total antecipada |
| `recuperacao_apos_baixa` | Recebimento pós-baixa |
| `acordo_com_perda` | Valor menor que a dívida total |
| `abatimento_acordo_assistido` | Pagamento livre no Acordo Assistido |
| `recuperacao_judicial` *(2026-07-04)* | Recebimento via acordo/quitação judicial — split principal/lucro via `_alocarRecuperacaoJudicial` |

#### PAGAMENTOS

| Coluna | Descrição |
|---|---|
| ID_PAGAMENTO | `PAG00001`, `PAG00002`... |
| ID_PARCELA | FK → PARCELAS (vazio para abatimento_acordo_assistido) |
| ID_CONTRATO | FK → CONTRATOS |
| ID_CLIENTE | FK → CLIENTES |
| NOME_CLIENTE | Desnormalizado |
| DATA_PAGAMENTO | Data do recebimento |
| VALOR_ORIGINAL_PARCELA | Valor original da parcela |
| VALOR_PAGO | Valor recebido |
| DIFERENCA_RECEBIDA | Extra recebido — campo legado (81 registros históricos) |
| RECEITA_EXTRA_ATRASO | Extra recebido — campo oficial atual |
| TIPO_PAGAMENTO | Ver lista de tipos |
| FORMA_PAGAMENTO | `dinheiro` / `pix` / `transferencia` / `pix_efi` |
| OBSERVACOES | Texto livre |
| CAPITAL_RECUPERADO_JUDICIAL / LUCRO_RECUPERADO_JUDICIAL *(2026-07-04)* | Split de recuperação judicial (nunca soma a LUCRO_TOTAL operacional) |
| HONORARIOS_VALOR / HONORARIOS_PAGO_POR *(2026-07-04)* | Valor e responsável (DEVEDOR/CREDOR) |
| CUSTAS_VALOR / CUSTAS_PAGO_POR *(2026-07-04)* | Valor e responsável (DEVEDOR/CREDOR) |

#### PROMESSAS

| Coluna | Descrição |
|---|---|
| ID_PROMESSA | `PRM00001`... |
| ID_CONTRATO / ID_CLIENTE / NOME_CLIENTE | FKs |
| DATA_PROMESSA | Quando o acordo foi feito |
| DATA_PREVISTA_PAGAMENTO | Data prometida |
| VALOR_PROMETIDO | Valor prometido |
| STATUS_PROMESSA | `PENDENTE` / `CUMPRIDA` / `QUEBRADA` — sempre UPPERCASE |
| DATA_CUMPRIMENTO | Quando foi cumprida |
| VALOR_PAGO | Valor efetivamente pago |
| OBSERVACAO | Texto livre |

#### EVENTOS

| Coluna | Descrição |
|---|---|
| ID_EVENTO | `EVT00001`... |
| DATA_EVENTO | Timestamp |
| ID_CONTRATO / ID_CLIENTE / NOME_CLIENTE / ID_PARCELA | FKs |
| TIPO_EVENTO | CRIACAO_CONTRATO, PAGAMENTO, QUITACAO_ANTECIPADA, ACORDO_ASSISTIDO_ENTRADA, ABATIMENTO_ACORDO_ASSISTIDO, ACORDO_ASSISTIDO_EXPIRADO... |
| VALOR_PRINCIPAL / VALOR_JUROS / VALOR_TOTAL / VALOR_EXTRA_ATRASO | Valores |
| STATUS_ANTERIOR / STATUS_NOVO | Transição |
| OBSERVACOES | Texto livre |

#### ACORDOS

| Coluna | Descrição |
|---|---|
| ID_ACORDO | `ACO00001`... |
| ID_CONTRATO / ID_CLIENTE / NOME_CLIENTE | FKs |
| DATA | Data do acordo |
| VALOR_DIVIDA_ORIGINAL | Dívida total original |
| VALOR_ACORDADO | Valor aceito |
| DESCONTO_PRINCIPAL | Capital perdido |
| DESCONTO_JUROS | Juros cancelados |
| STATUS | `QUITADO` |
| OBSERVACOES | Texto livre |

#### MENSAGENS

| Coluna | Descrição |
|---|---|
| ID_MENSAGEM | `MSG00001`... |
| DATA_ENVIO | Timestamp |
| ID_CLIENTE / ID_CONTRATO / ID_PARCELA | FKs |
| TELEFONE | Número do destinatário |
| GATILHO | D-5 / D-1 / D0 / D+1 / D+3 / D+7 / PROMESSA_D-1 / PROMESSA_D0 / PROMESSA_D+1 / CONFIRMACAO_PAGAMENTO |
| CONTEUDO | Texto da mensagem |
| STATUS_ENVIO | `ENVIADO` / `ERRO_ENVIO` / `ERRO_SEM_PIX` |

#### CONFIGURACOES

Pares chave-valor globais editáveis.

| Chave | Padrão | Descrição |
|---|---|---|
| TAXA_MINIMA_MENSAL | 0.14 | Taxa para score ≥ 90 |
| TAXA_PADRAO_BAIXA_MENSAL | 0.16 | Taxa para score ≥ 75 |
| TAXA_PADRAO_MENSAL | 0.18 | Taxa para score ≥ 60 |
| TAXA_ALTA_MENSAL | 0.22 | Taxa para score ≥ 45 |
| TAXA_MAXIMA_MENSAL | 0.25 | Taxa para score < 45 |
| COMPROMETIMENTO_MAX_PCT | 0.35 | Máximo 35% da renda comprometida |
| LIMITE_PRIMEIRO_EMPRESTIMO | 1500 | Teto absoluto para 1º contrato |
| LIMITE_SCORE_EXCELENTE | 4000 | Teto para score 90–100 (2º+) |
| LIMITE_SCORE_BOM | 3000 | Teto para score 75–89 (2º+) |
| LIMITE_SCORE_MEDIO | 1500 | Teto para score 60–74 (2º+) |
| LIMITE_SCORE_ATENCAO | 1000 | Teto para score 45–59 (2º+) |
| PRAZO_MAX_EXCELENTE | 12 | Prazo máximo — score ≥ 90 |
| PRAZO_MAX_BOM | 10 | Prazo máximo — score ≥ 75 |
| PRAZO_MAX_MEDIO | 6 | Prazo máximo — score ≥ 60 |
| PRAZO_MAX_ATENCAO | 3 | Prazo máximo — score ≥ 45 |
| EVOLUTION_URL | — | URL da instância Evolution GO |
| EVOLUTION_KEY | — | Token da Instância (não API key global) |
| EVOLUTION_INSTANCE | — | ID da instância |
| COBRANCA_SECRET | — | Auth de `api/efi-pix-avulso.js` (header `x-cobranca-secret`) |
| VERCEL_URL | `https://financeiroop.vercel.app` | Base usada para montar o link do certificado de quitação |
| TEMPLATE_D-5 | texto | Template de mensagem 5 dias antes do vencimento |
| TEMPLATE_D-1 | texto | Template 1 dia antes |
| TEMPLATE_D0 | texto | Template no dia do vencimento |
| TEMPLATE_D+1 | texto | Template 1 dia após |
| TEMPLATE_D+3 | texto | Template 3 dias após |
| TEMPLATE_D+7 | texto | Template 7 dias após |
| TEMPLATE_PROMESSA_D-1 | texto | Template véspera da promessa |
| TEMPLATE_PROMESSA_D0 | texto | Template dia da promessa |
| TEMPLATE_PROMESSA_D+1 | texto | Template dia seguinte da promessa |
| TEMPLATE_CONFIRMACAO | texto | Template de confirmação de pagamento |
| TEMPLATE_CERTIFICADO_QUITACAO | texto | Template de envio do link do certificado — sem edição na UI (`TemplatesReguaModal` não inclui essa chave) |

#### LEADS

| Coluna | Descrição |
|---|---|
| TELEFONE | Número do lead (formato internacional) |
| NOME / CPF / RENDA | Dados coletados na triagem |
| EMPREGADOR / DATA_ADMISSAO | Extraídos do contracheque por Claude Sonnet |
| RENDA_BRUTA / RENDA_LIQUIDA | Extraídas do contracheque |
| PADRINHO | Nome do padrinho informado |
| STATUS_LEAD | `EM_ANDAMENTO` / `FORMULARIO_ENVIADO` / `REPROVADO` / `COMPLETO` |
| HISTORICO_CONVERSA | JSON com troca de mensagens |

#### PADRINHOS (tabela analítica — não editar)

| Coluna | Descrição |
|---|---|
| NOME_PADRINHO | Nome |
| TEL_PADRINHO | Telefone |
| TOTAL_INDICADOS | Quantidade de indicados |
| INDICADOS_ATIVOS | Indicados com contratos ativos |
| LTV_MEDIO | LTV médio dos indicados |
| ROI_MEDIO | ROI médio |
| TAXA_ADIMPLENCIA_MEDIA | % adimplência |
| ATRASO_MEDIO | Dias médios de atraso |
| SCORE_PADRINHO | Score 0–100 da qualidade dos indicados |
| DATA_ATUALIZACAO | Última atualização |

#### EMPREGADORES (tabela analítica — não editar)

| Coluna | Descrição |
|---|---|
| EMPREGADOR | Nome |
| TOTAL_CLIENTES | Total de clientes |
| LTV_MEDIO | LTV médio |
| ROI_MEDIO | ROI médio |
| TAXA_ADIMPLENCIA_MEDIA | % adimplência |
| ATRASO_MEDIO | Dias médios de atraso |
| SCORE_EMPREGADOR | Score 0–100 |
| DATA_ATUALIZACAO | Última atualização |

#### UNDO_LOG (2026-07-04)

| Coluna | Descrição |
|---|---|
| ID_UNDO | `UND00001`... |
| DATA_HORA | Timestamp da operação original |
| TIPO_OPERACAO | `PAGAMENTO_NORMAL` / `SOMENTE_JUROS` / `QUITACAO_ANTECIPADA` / `ACORDO_COM_PERDA` / `RECUPERACAO_APOS_BAIXA` / `ABATIMENTO_ASSISTIDO` / `BAIXA_PREJUIZO` |
| ID_CONTRATO / ID_CLIENTE / NOME_CLIENTE | FKs |
| PAYLOAD_JSON | Estado anterior necessário pra reverter |
| STATUS | `ATIVO` / `EXPIRADO` / `REVERTIDO` |
| DATA_REVERSAO / MOTIVO_REVERSAO | Preenchidos ao reverter |

#### QUITACOES (2026-07-04)

| Coluna | Descrição |
|---|---|
| ID_QUITACAO | `QUI00001`... |
| ID_CONTRATO / ID_CLIENTE / NOME_CLIENTE | FKs |
| DATA_GERACAO | Timestamp da proposta |
| VALOR_ORIGINAL / DESCONTO / VALOR_FINAL | Cálculo da quitação (mesma fórmula da quitação manual) |
| TXID | Fixo por contrato — `FOQT<idContrato>Q00001` |
| EFI_PIX_CODE | Copia-e-cola do PIX |
| STATUS | `PENDENTE` / `PAGO` / `CANCELADO` / `EXPIRADO` |
| DATA_EXPIRACAO | Geração + 48h |
| DATA_PAGAMENTO | Preenchida ao confirmar |
| PARCELAS_IDS | JSON com IDs das parcelas selecionadas |

#### CERTIFICADOS (2026-07-04)

| Coluna | Descrição |
|---|---|
| ID_CERTIFICADO | `CERT00001`... |
| ID_CONTRATO / ID_CLIENTE / NOME_CLIENTE / CPF | Dados do cliente na quitação |
| VALOR_TOTAL_PAGO / DATA_QUITACAO | Snapshot no momento da geração |
| CODIGO_VALIDACAO | `CERT-<ano>-<uuid>` — usado na URL pública `/c/:codigo` |
| DATA_GERACAO | Timestamp |
| STATUS | `ativo` (dedup — só existe 1 por contrato) |

#### AUDITORIA (2026-07-04 — criada sob demanda, fora de `ABAS`)

| Coluna | Descrição |
|---|---|
| DATA_HORA | Timestamp do achado |
| SEVERIDADE | `CRITICO` / `ALTO` / `MEDIO` / `BAIXO` / `INFO` |
| TIPO | `RELACIONAMENTO` / `STATUS_PARCELA` / `STATUS_CONTRATO` / `MATEMATICA` / `DUPLICIDADE` / `PIX` / `PROMESSA` / `EVENTO` / `SESSAO_INICIO` / `SESSAO_FIM` |
| TABELA / ID_REGISTRO | Onde o problema foi encontrado |
| DESCRICAO / DETALHES | Texto do achado |
| AUTO_CORRIGIDO | Sempre `NAO` hoje — auditoria só diagnostica |

#### OPERACOES_PROCESSADAS (2026-07-04 — criada sob demanda, fora de `ABAS`)

| Coluna | Descrição |
|---|---|
| ID_OPERACAO | `OP00001`... |
| CHAVE_IDEMPOTENCIA | Prefixo fixo + identificador do evento (ex: `WEBHOOK_EFI_<txid>`, `QUIT_<txid>`) |
| TIPO_OPERACAO | Tipo do webhook processado |
| DATA_HORA | Timestamp |
| STATUS | `PROCESSADO` / `DUPLICATA_BLOQUEADA` |
| ORIGEM / ID_CLIENTE / ID_CONTRATO / ID_PARCELA | Metadados da operação |

### Relacionamentos

```
CLIENTES (1) ──────────── (N) CONTRATOS
                                   │
                                   ├── (N) PARCELAS
                                   ├── (N) PAGAMENTOS
                                   ├── (N) PROMESSAS
                                   ├── (N) EVENTOS
                                   ├── (0..1) ACORDOS
                                   └── (N) MENSAGENS

PARCELAS (1) ──────────── (N) PAGAMENTOS (exceto abatimento_acordo_assistido)
PARCELAS (0..1) ────────── (N) MENSAGENS

LEADS — tabela independente (dados de pré-cadastro)
PADRINHOS / EMPREGADORES — tabelas analíticas derivadas (sem FK explícita)
CONFIGURACOES — tabela de configurações (pares chave-valor)
```

### Índices

Google Sheets não possui índices nativos. Toda busca é feita por varredura linear via `buildColMap()` + loop sobre as linhas. O GAS lê todas as abas de uma vez (`doGet`) e retorna como JSON para o frontend. O frontend realiza filtros em memória com `Array.filter()` e `Array.find()`.

### Regras de Integridade

1. **Nenhum registro financeiro pode ser deletado fisicamente** — exceto linhas de CONTRATOS e PARCELAS ao executar `excluirContrato()` (somente quando não há PAGAMENTOS vinculados)
2. **Status terminais de parcela nunca são reabertos automaticamente** — apenas via ação manual com `reabrirParcela()`
3. **Um cliente não pode ter dois contratos ativos simultaneamente**
4. **Todo pagamento normal deve ter ID_PARCELA** — exceto `abatimento_acordo_assistido`
5. **`STATUS_CONTRATO` é a única fonte de verdade** — `STATUS_CARTEIRA` é auxiliar e nunca deve ser usada em lógica
6. **IDs gerados por `proximoIdSeq()`** — nunca manuais (risco de duplicata)
7. **Datas sempre via `parseDateLocal()`** — nunca `new Date("YYYY-MM-DD")` (bug UTC-3)
8. **Colunas sempre por nome via `buildColMap()`** — nunca por índice numérico
9. **`STATUS_PROMESSA` sempre UPPERCASE no Sheets** — filtros usam `.toUpperCase() === "PENDENTE"`

---

## APIS E INTEGRAÇÕES

### API Routes Vercel

| Rota | Método | Auth | Função |
|---|---|---|---|
| `/api/sheets` | GET | Cookie `fp_session` | Rewrite para GAS doGet — retorna todas as abas como JSON |
| `/api/action` | POST | Cookie `fp_session` | Proxy para GAS doPost — executa ações de escrita |
| `/api/login` | POST | Pública | Autentica e seta cookie `fp_session` |
| `/api/logout` | POST | Pública | Limpa cookie `fp_session` |
| `/api/whatsapp` | POST | Header `apikey` | Webhook do bot de triagem WhatsApp |
| `/api/webhook-efi` | POST | Pública (Efí autentica) | Confirmação de pagamento PIX da Efí Bank |
| `/api/efi-charges` | POST | Cookie `fp_session` | Gera cobranças PIX em lote (carnê) na Efí Bank |
| `/api/efi-pix-avulso` | POST | Header `x-cobranca-secret` | Gera PIX avulso por parcela (chamado pelo GAS) |
| `/api/efi-check-payments` | GET/POST | Cookie `fp_session` | Consulta status de cobranças na Efí Bank |
| `/api/efi-test-webhook` | POST | Cookie `fp_session` | Testa webhook Efí em ambiente de desenvolvimento |

### GAS Actions (doPost)

Todas as ações passam por `POST /api/action → GAS doPost()` com o campo `action`:

| action | Função GAS | Descrição |
|---|---|---|
| `novoContrato` | `novoContrato()` | Cria contrato + parcelas |
| `gerarDoc` | `gerarDocContrato()` | Gera Google Doc do contrato |
| `salvarCliente` | `salvarCliente()` | Salva ou atualiza dados do cliente |
| `registrarPagamento` | `registrarPagamentoAPI()` | Registra pagamento de parcela |
| `registrarPagamentoParcial` | `registrarPagamentoParcial()` | Paga somente juros (cria parcela extra) |
| `registrarQuitacaoAntecipada` | `registrarQuitacaoAntecipadaAPI()` | Quita parcelas antecipadamente |
| `reabrirParcela` | `reabrirParcela()` | Reverte pagamento registrado por engano |
| `baixarContrato` | `baixarContratoPrejuizo()` | Baixa contrato como prejuízo |
| `moverParaAcordoAssistido` | `moverParaAcordoAssistido()` | Entra no Acordo Assistido |
| `registrarAbatimento` | `registrarAbatimentoAssistido()` | Abatimento no Acordo Assistido |
| `sairDoAcordoAssistido` | `sairDoAcordoAssistido()` | Retorna à cobrança normal ou baixa |
| `registrarRecuperacao` | `registrarRecuperacaoAposBaixa()` | Recuperação pós-baixa |
| `registrarAcordoPerda` | `registrarAcordoComPerda()` | Acordo com desconto/perda |
| `registrarPromessa` | `registrarPromessa()` | Registra promessa de pagamento |
| `alterarVencimento` | `alterarVencimentoContrato()` | Altera data de vencimento |
| `excluirContrato` | `excluirContrato()` | Exclusão física (apenas sem pagamentos) |
| `salvarTemplates` | `salvarTemplateRegua()` | Salva templates da régua no CONFIGURACOES |
| `buscarTemplates` | `buscarTemplatesRegua()` | Retorna templates atuais |
| `calcularScore` | `calcularScore()` | Recalcula score de um cliente |
| `pagamentoAutomatico` | `pagamentoAutomatico()` | Pagamento via webhook Efí Bank |
| `gerarZapSign` | `gerarDocZapSign()` | Exporta PDF + envia para ZapSign |
| `ajuizarContrato` | `ajuizarContrato()` | Ajuíza contrato — entra em `em_processo_judicial` |
| `atualizarDadosJuridicos` | `atualizarDadosJuridicos()` | Edita dados do processo (`_JURI_COLS`) |
| `adicionarMovimentacaoJuridica` | `adicionarMovimentacaoJuridica()` | Registra movimentação no histórico judicial |
| `registrarAcordoJudicial` *(2026-07-04)* | `registrarAcordoJudicial()` | Acordo judicial parcelado ou à vista |
| `registrarQuitacaoJudicial` *(2026-07-04)* | `registrarQuitacaoJudicial()` | Quitação judicial em parcela única |
| `arquivarProcessoJudicial` *(2026-07-04)* | `arquivarProcessoJudicial()` | Arquiva o processo; encerra o contrato |
| `gerarPropostaQuitacaoPix` *(2026-07-04)* | `gerarPropostaQuitacaoPix()` | Gera proposta de quitação antecipada via PIX (48h) |
| `salvarPixQuitacao` *(2026-07-04)* | `salvarPixQuitacao()` | Grava o copia-e-cola do PIX na proposta |
| `cancelarPropostaQuitacao` *(2026-07-04)* | `cancelarPropostaQuitacao()` | Cancela proposta pendente |
| `buscarCertificado` *(2026-07-04)* | `buscarCertificadoPublico()` | Retorna dados do certificado (CPF mascarado) — usado por `api/cert.js` |
| `pagamentoQuitacaoWebhook` *(2026-07-04)* | `pagamentoQuitacaoWebhook()` | Chamada por `api/webhook-efi.js` ao confirmar pagamento de uma proposta de quitação PIX; protegida por idempotência |

### Integração Efí Bank (PIX cobv)

| Parâmetro | Valor |
|---|---|
| Tipo | `cobv` — cobrança com vencimento |
| Ambiente | Produção |
| Autenticação | OAuth2 + certificado P12 |
| Multa | 2% (modalidade percentual) — configurável via env `EFI_MULTA_PCT` |
| Juros | 0,03% ao dia (modalidade percentual) — configurável via env `EFI_JUROS_DIARIO` |
| Validade pós-vencimento | 30 dias |
| TXID | `FOP` + contractNum (16 dígitos) + `P` + parcelaNum (6 dígitos) = 26 chars |
| CPF | Sempre 11 dígitos (`padStart(11, "0")`) — se inválido, omite `devedor` |
| Fallback data vencida | Se `dataVenc < hoje (BR)`, usa hoje como data de vencimento |

**Arquivos:**  
- `api/efi-auth.js` — OAuth2 + certificado P12
- `api/efi-charges.js` — geração em lote (carnê)
- `api/efi-pix-avulso.js` — geração unitária (régua de cobrança)
- `api/webhook-efi.js` — callback de confirmação de pagamento

**Variáveis de ambiente Vercel:**  
`EFI_CLIENT_ID`, `EFI_CLIENT_SECRET`, `EFI_PIX_KEY`, `EFI_CERT_P12_BASE64`

### Integração Evolution GO (WhatsApp)

| Parâmetro | Valor |
|---|---|
| Produto | Evolution GO (versão comercial — diferente da open-source) |
| Endpoint de envio | `POST {EVOLUTION_URL}/send/text` |
| Body | `{ number: "5562...", text: "mensagem", instanceId: "..." }` |
| Autenticação | Header `apikey: {Token da Instância}` — NÃO é a API key global |
| Números | DDI 55 + DDD + 9 dígitos = 13 dígitos total |
| Configs | Lidas do CONFIGURACOES: `EVOLUTION_URL`, `EVOLUTION_KEY`, `EVOLUTION_INSTANCE` |

**Uso duplo:**  
1. **Régua automática** — GAS `_enviarWppRegua()` chama via `UrlFetchApp.fetch()`
2. **Bot de triagem** — `api/whatsapp.js` (frontend trigger) via `fetch()`

**Variáveis de ambiente Vercel:**  
`EVOLUTION_API_URL`, `EVOLUTION_API_KEY`, `EVOLUTION_INSTANCE`, `EVOLUTION_WEBHOOK_SECRET`

### Integração ZapSign (Assinatura Eletrônica)

| Parâmetro | Valor |
|---|---|
| Ambiente | Produção |
| Token | Hardcoded em `appscript.gs` linha ~16 (`ZAPSIGN_TOKEN`) |
| Signatários | Alex Borges (credor), Cliente (devedor), 2 testemunhas |
| Fluxo | Google Docs → exportar PDF → ZapSign API → link de assinatura |
| Selfie | Obrigatória para o cliente |

### Integração Google Forms (Cadastro)

Formulário público → trigger `onFormSubmit` no GAS → cria linha em CLIENTES com `STATUS_CLIENTE = aguardando_conferencia`.

**Mapeamento de perguntas (títulos exatos):**

| Pergunta no Form | Campo CLIENTES |
|---|---|
| Nome Completo | NOME |
| CPF (somente numeros) | CPF |
| RG (somente numeros) | RG |
| WhatsApp com DDD (Somente números) | TELEFONE_WPP |
| E-mail (tudo minúsculo) | EMAIL |
| Nome de Pessoa de confiança 1 | CONTATO_CONFIANCA_1 |
| Telefone de Pessoa de confiança 1 | TEL_CONFIANCA_1 |
| Nome de Pessoa de confiança 2 | CONTATO_CONFIANCA_2 |
| Telefone de Pessoa de confiança 2 | TEL_CONFIANCA_2 |
| Digite aqui a Data de vencimento... | DIA_VENCIMENTO_PREFERIDO |
| Nome da pessoa que te indicou... | PADRINHO |

**Observação:** NUMERO, QUADRA, LOTE **não** usam `_soDigitos` — clientes digitam "Sem Número" / "Não consta".

### Integração Claude AI (Bot WhatsApp)

| Parâmetro | Valor |
|---|---|
| Triagem | `claude-haiku-4-5-20251001` |
| Extração de contracheque | `claude-sonnet-4-6` |
| Ferramentas (Tools) | `verificar_padrinho`, `avancar_para_formulario`, `encerrar_reprovado` |
| Arquivo | `api/whatsapp.js` |

**Variável de ambiente:** `ANTHROPIC_API_KEY`

---

## AUTOMAÇÕES

### Trigger Diário — 7h (Google Apps Script)

Execução automática às 7h, todos os dias, via trigger do GAS:

| Ordem | Função | O que faz |
|---|---|---|
| 1 | `atualizarStatusParcelas()` | Recalcula status de todas as parcelas não terminais pela data atual |
| 2 | `atualizarStatusContratos()` | Recalcula status de todos os contratos ativos; para `acordo_assistido`, aplica regra dos 180 dias |
| 3 | `verificarPromessasVencidas()` | Marca como QUEBRADA promessas com data vencida e STATUS = PENDENTE |
| 4 | `_atualizarScoresDiario()` | Recalcula score + métricas analíticas de todos os clientes com STATUS_CLIENTE = ativo |
| 5 | `atualizarTabelaPadrinhos()` | Reconsolida a aba PADRINHOS |
| 6 | `atualizarTabelaEmpregadores()` | Reconsolida a aba EMPREGADORES |
| 7 | `enviarReguaCobranca()` | Dispara régua de cobrança WhatsApp para todos os clientes elegíveis |

### Trigger Diário — 07:05, Auditoria de Integridade (2026-07-04)

Trigger próprio (não faz parte da lista acima), configurado via `configurarTriggerAuditoria()` — **rodar 1x manual** para ativar. Executa `auditarIntegridadeSistema()`: varre CLIENTES/CONTRATOS/PARCELAS/PAGAMENTOS/PROMESSAS/EVENTOS/OPERACOES_PROCESSADAS em busca de inconsistências, calcula score de integridade 0–100 e grava tudo na aba AUDITORIA. Só diagnostica — não corrige nada automaticamente.

### Trigger Diário — 2h, Backup Automático (2026-07-04)

Trigger próprio, configurado via `configurarTriggerBackup()` — **rodar 1x manual** para ativar. Executa `fazerBackupAutomatico()`: copia a planilha inteira para a pasta "FinanceiroOp Backups" no Google Drive, mantendo sempre as últimas 30 cópias.

### Trigger por Evento — Pagamento

Após cada pagamento registrado (`registrarPagamentoAPI`):

1. Atualiza STATUS da parcela
2. Verifica se contrato foi quitado (atualiza STATUS_CONTRATO)
3. Chama `calcularMetricasCliente()` — atualiza métricas do cliente
4. Chama `_enviarConfirmacaoPagamento()` — envia WhatsApp de confirmação
5. Chama `_cancelarPromessasPorContrato()` — cancela promessas pendentes do contrato

**Exceção:** `moverParaAcordoAssistido` e `registrarAbatimentoAssistido` **não** chamam `calcularScore` ou `calcularMetricasCliente` — score permanece congelado.

### Régua de Cobrança Automática

Função `enviarReguaCobranca()` — disparada pelo trigger das 7h.

**Gatilhos:**

| Gatilho | Quando |
|---|---|
| D-5 | 5 dias antes do vencimento |
| D-1 | 1 dia antes do vencimento |
| D0 | Dia do vencimento |
| D+1 | 1 dia após o vencimento |
| D+3 | 3 dias após o vencimento |
| D+7 | 7 dias após o vencimento |
| PROMESSA_D-1 | Véspera da data prometida |
| PROMESSA_D0 | Dia da promessa |
| PROMESSA_D+1 | Dia seguinte da promessa não cumprida |

**Regras de envio:**
- Máximo 1 mensagem por cliente por dia
- Clientes `PERFIL_COBRANCA = EVASIVO` são pulados
- Contratos em status terminal são ignorados
- Contratos em `acordo_assistido` são ignorados
- Se há promessa ativa, régua normal suspensa (apenas gatilhos de promessa)
- Cada mensagem acompanhada de segunda mensagem com código PIX

**Deduplicação:** `_jaEnviouHoje()` bloqueia reenvio apenas se já houver linha com `STATUS_ENVIO = "ENVIADO"` no dia. Erros (`ERRO_ENVIO`, `ERRO_SEM_PIX`) não bloqueiam reenvio.

**Modo dry-run:** `testarReguaCobranca()` — não envia, não loga em MENSAGENS.

### Confirmação Automática de Pagamento

Disparada ao final de `registrarPagamentoAPI` (cobre pagamentos manuais E via webhook Efí):

1. Lê template `TEMPLATE_CONFIRMACAO` do CONFIGURACOES
2. Busca `TELEFONE_WPP` do cliente
3. Conta parcelas restantes e próximo vencimento
4. Envia via Evolution GO
5. Loga em MENSAGENS com `GATILHO = "CONFIRMACAO_PAGAMENTO"`

**Deduplicação:** não reenvia se já houver linha com `GATILHO = "CONFIRMACAO_PAGAMENTO"` + `ID_PARCELA` + `STATUS_ENVIO = "ENVIADO"`.

**Variáveis disponíveis no template:**  
`{NOME}`, `{NUM_PARCELA}`, `{TOTAL_PARCELAS}`, `{VALOR_PAGO}`, `{PARCELAS_RESTANTES}`, `{PROXIMO_VENCIMENTO}`

### Acordo Assistido — Expiração Automática

O trigger das 7h verifica contratos em `acordo_assistido`:
- Se passou 180+ dias desde o último abatimento (ou desde `DATA_ENTRADA_ACORDO_ASSISTIDO` se nunca houve abatimento)
- Move automaticamente para `pre_prejuizo`
- Registra evento `ACORDO_ASSISTIDO_EXPIRADO` na aba EVENTOS

### Funções de Manutenção Manual (menu GAS)

| Função | Propósito |
|---|---|
| `recalcularTodasMetricas()` | Reconstrói métricas de todos os clientes (LUCRO_TOTAL, TOTAL_PAGO, etc.) |
| `renumerarPagamentos()` | Renumera PAG00001..N com lock atômico |
| `garantirColunasAcordoAssistido()` | Cria colunas ausentes em CONTRATOS |
| `backfillReceitaExtraAtraso()` | Copia DIFERENCA_RECEBIDA → RECEITA_EXTRA_ATRASO nos registros históricos |
| `diagnosticarLegado()` | READ-ONLY: conta valores legado no banco |
| `normalizarTipoPagamento()` | Migra valores curtos para formas longas |
| `normalizarStatusParcela()` | Migra variantes legado para valores canônicos |
| `corrigirStatusRecuperacao()` | Corrige contratos com status de recuperação indevido |

---

## SISTEMA DE PERMISSÕES

### Modelo de acesso

Single-user — apenas Alex Borges acessa o painel. Não há roles, perfis ou multi-usuário implementados.

### Autenticação

| Mecanismo | Detalhe |
|---|---|
| Método | Senha única |
| Cookie | `fp_session` = HMAC-SHA256 da senha com `LOGIN_SECRET` |
| Duração | 30 dias (`Max-Age`) |
| Flags | `HttpOnly; Secure; SameSite=Strict` |
| Validação | Middleware verifica cookie em cada request |

### Middleware de proteção

Arquivo `middleware.js` protege todas as rotas, **exceto**:

| Rota liberada | Motivo |
|---|---|
| `/api/login` | Endpoint de autenticação |
| `/api/logout` | Endpoint de logout |
| `/api/whatsapp` | Webhook do bot (autenticado por `apikey` no header) |
| `/api/webhook-efi` | Webhook da Efí Bank (autenticação própria da Efí) |
| `/api/efi-check-payments` | Consultado por automação |
| `/api/efi-pix-avulso` | Chamado pelo GAS com `x-cobranca-secret` |

**Comportamento do middleware:**
- Request de API sem token → `401 JSON`
- Request de página sem token → HTML da página de login
- Sem `LOGIN_PASSWORD` configurado (dev local) → passa sem autenticação

### Proteção de rotas de API internas

`/api/efi-pix-avulso` usa `x-cobranca-secret` (env `COBRANCA_SECRET`) — autenticação própria para o GAS.

---

## FLUXOS OPERACIONAIS IMPLEMENTADOS

### Fluxo 1 — Cadastro de Novo Cliente

```
1. Lead indica interesse (WhatsApp ou presencial)
2. Alex abre Clientes → Novo Cadastro (painel)
   OU
   Lead preenche Google Form → onFormSubmit GAS → CLIENTES (status: aguardando_conferencia)
3. Alex abre ClienteModal → aba Editar → preenche campos faltantes
4. Salva → status vira "ativo"
5. Na 1ª aprovação: observação padrão "Cadastro via formulário..." é apagada
6. Score calculado automaticamente
```

### Fluxo 2 — Criação de Contrato

```
1. Alex acessa NovoContrato no painel
2. Busca o cliente por nome
3. Sistema pré-preenche 1º vencimento = dia preferido do cliente no mês seguinte
4. Alex informa: valor, parcelas, taxa
5. Sistema calcula: juros, total, valor da parcela
6. POST /api/action → action:"novoContrato" → GAS
   → Cria linha em CONTRATOS
   → Cria N linhas em PARCELAS
   → Retorna idContrato em ~1-2s
7. Modal de sucesso abre imediatamente
8. GAS gera Google Doc em background (action:"gerarDoc")
9. Botões aparecem: Abrir no Google Docs / Enviar ZapSign / Gerar Carnê PIX / Enviar WhatsApp
```

### Fluxo 3 — Geração de Carnê PIX

```
1. Após criar contrato (ou a qualquer momento via ContratoModal)
2. Frontend monta lista de parcelas com valores e datas
3. POST /api/efi-charges com { idContrato, parcelas, cliente }
4. Vercel function autentica na Efí Bank (OAuth2 + P12)
5. PUT /v2/cobv/{txid} para cada parcela em paralelo (Promise.all)
6. Retorna pixCopiaECola por parcela
7. Frontend salva PIX no Sheets (action:"salvarPixCodes")
```

### Fluxo 4 — Registro de Pagamento

```
1. Alex acessa a parcela via Dashboard / Cobrança / ContratoModal
2. Seleciona forma de pagamento e valor
3. POST /api/action → action:"registrarPagamento"
4. GAS registra em PARCELAS (status → "pago")
5. GAS registra em PAGAMENTOS (novo registro)
6. GAS registra em EVENTOS
7. GAS verifica se todas as parcelas terminais → atualiza STATUS_CONTRATO
8. GAS chama calcularMetricasCliente()
9. GAS chama _enviarConfirmacaoPagamento() → WhatsApp ao cliente
10. GAS chama _cancelarPromessasPorContrato()
11. Frontend: optimistic UI (setRaw local) → modal fecha → carregar() em background
12. Modal de comprovante PDF abre para envio
```

### Fluxo 5 — Quitação Antecipada

```
1. Alex abre ContratoModal → botão "Quitar Antecipadamente"
2. QuitacaoAntecipadaModal lista parcelas abertas
3. Alex seleciona parcelas e define desconto opcional nos juros
4. Cada parcela gera registro em PAGAMENTOS com TIPO = "quitacao_antecipada"
5. Comprovante de quitação (certificado A4) gerado e enviado por WhatsApp
```

### Fluxo 6 — Triagem de Lead via WhatsApp (Bot)

```
1. Lead manda mensagem para WhatsApp da empresa
2. Evolution GO encaminha via webhook → POST /api/whatsapp
3. Claude Haiku faz triagem: verifica CLT, coleta dados
4. Ferramentas (Tools): verificar_padrinho, avancar_para_formulario, encerrar_reprovado
5. Se aprovado: envia link do Google Form + solicita contracheque
6. Lead envia foto do contracheque → Claude Sonnet extrai dados financeiros
7. Alex recebe notificação com resumo
8. Dados salvos em LEADS
```

---

## FLUXOS FINANCEIROS IMPLEMENTADOS

### Classificação de Recebimentos

| Tipo | Conta como | Onde aparece |
|---|---|---|
| Parcela paga (qualquer tipo normal) | Receita | Dashboard, Financeiro, DRE |
| Extra de atraso (RECEITA_EXTRA_ATRASO) | Receita extra | Dashboard, Financeiro |
| `abatimento_acordo_assistido` | Capital Recuperado | Linha separada no Financeiro — NUNCA receita |
| `recuperacao_apos_baixa` | Capital Recuperado | Linha separada |
| `acordo_com_perda` | Capital Recuperado + eventual receita | Linha separada |

### Cálculo de Parcelas

```
Juros total = VALOR_PRINCIPAL × TAXA_JUROS_MENSAL × NUM_PARCELAS
Valor total = VALOR_PRINCIPAL + Juros total
Valor parcela = Valor total / NUM_PARCELAS
Parcela principal = VALOR_PRINCIPAL / NUM_PARCELAS
Parcela juros = Juros total / NUM_PARCELAS
```

### Cálculo de Score de Crédito (0–100 pontos)

| Bloco | Peso | O que avalia |
|---|---|---|
| A — Histórico de contratos | 25 pts | Quitados, antecipações, renegociações, prejuízos |
| B — Comportamento de pagamento | 30 pts | % em dia, atrasos leves/graves, qualidade comunicação |
| C — Perfil financeiro | 20 pts | Renda, tipo emprego, comprometimento % |
| D — Relacionamento | 15 pts | Tempo de cliente, padrinho, indicados, recuperação |
| E — Risco atual | 10 pts | Atraso atual, renegociação ativa, concentração |

**Bônus** (máx +10): antecipação, 3+ quitados sem atraso grave, >12 meses sem prejuízo, boa comunicação, indicou clientes.

**Penalizações:** atraso >7d (−5 a −25), renegociação ativa (−10), comunicação ruim + atraso (−20), prejuízo não recuperado (−30).

### PDD — Provisão para Devedores Duvidosos (v1.0 — Jun/2026)

| Faixa de atraso | % Provisão |
|---|---|
| Em dia / 1–30 dias | 0% |
| 31–60 dias | 10% |
| 61–90 dias | 35% |
| 91–120 dias | 60% |
| 121–180 dias | 85% |
| 181+ dias | 100% |

Calibrado sobre perda histórica líquida de 1,42% (R$ 7.275). Próxima revisão: 50 contratos encerrados ou Dez/2026.

### Resultado Ajustado ao Risco (últimos 12 meses)

```
receitaContratual = soma(VALOR_JUROS - DESCONTO_APLICADO) das parcelas pagas
receitaAtraso     = soma(RECEITA_EXTRA_ATRASO) dos pagamentos
recTotal          = receitaContratual + receitaAtraso
resultAjust       = recTotal - totalPDD
roiBruto          = recTotal / capitalTotal × 100
roiAjust          = resultAjust / capitalTotal × 100
margemAjust       = resultAjust / recTotal × 100
```

### Acordo Assistido — Cálculos

```
capitalRestante = VALOR_PRINCIPAL − VALOR_ABATIDO_ASSISTIDO
saldoDevedor    = soma(VALOR_PARCELA das parcelas abertas) − VALOR_ABATIDO_ASSISTIDO
lucroRemanescente = soma(VALOR_JUROS das parcelas abertas)  ← não armazenado
```

### Baixa como Prejuízo — Cálculos

```
Contrato normal:
  PREJUIZO_CAPITAL = VALOR_PRINCIPAL − soma(PARCELA_PRINCIPAL das parcelas pagas)

Contrato em acordo_assistido:
  PREJUIZO_CAPITAL = VALOR_PRINCIPAL − VALOR_ABATIDO_ASSISTIDO

JUROS_NAO_REALIZADOS = soma(VALOR_JUROS das parcelas abertas)
```

---

## PROCESSOS DE COBRANÇA IMPLEMENTADOS

### Ciclo de Inadimplência

| Dias de atraso | STATUS_CONTRATO | Ação sugerida |
|---|---|---|
| 1–30 | `ativo_em_atraso` | Cobrança WhatsApp, registrar promessa |
| 31–60 | `em_cobranca` | Intensificar contato, enviar PIX, negociar |
| 61–120 | `pre_prejuizo` | Contatar pessoas de confiança, propor acordo |
| > 120 | `pre_prejuizo` | Avaliar baixa ou Acordo Assistido |
| Manual | `acordo_assistido` | Cliente cooperativo em dificuldade temporária |
| Manual | `baixado_como_prejuizo` | Tentativa de recuperação pós-baixa |

### Régua de Cobrança Automática

Descrita na seção [Automações](#automações). Implementada e em produção desde 2026-06-15.

### Templates de Mensagem

10 templates editáveis pelo painel (aba Régua WPP → ⚙️ Templates):

**Variáveis disponíveis (régua):**  
`{NOME}`, `{VALOR_PARCELA}`, `{NUM_PARCELA}`, `{TOTAL_PARCELAS}`, `{DATA_VENCIMENTO}`, `{VALOR_COMBINADO}`, `{DATA_PROMESSA}`

**Variáveis disponíveis (confirmação):**  
`{NOME}`, `{NUM_PARCELA}`, `{TOTAL_PARCELAS}`, `{VALOR_PAGO}`, `{PARCELAS_RESTANTES}`, `{PROXIMO_VENCIMENTO}`

### Bloqueio Automático de Crédito

Cliente bloqueado automaticamente para novo crédito se:
- Atraso atual > 30 dias
- Comunicação ruim + qualquer atraso
- Prejuízo registrado e não recuperado
- Renegociação ativa + inadimplente
- Score final < 30

---

## DASHBOARDS E INDICADORES

### Dashboard Principal

| Indicador | Fórmula / Fonte |
|---|---|
| Capital Emprestado | Soma de VALOR_PRINCIPAL dos contratos ativos |
| Capital Recebido | Soma de VALOR_PAGO de todos os pagamentos (excl. abatimento_acordo_assistido) |
| A Receber | Soma de VALOR_PARCELA das parcelas abertas em contratos ativos |
| Em Atraso | Soma de VALOR_PARCELA das parcelas com status atrasado |
| Gráfico mensal | VALOR_PAGO agrupado por mês — BarChart Recharts |

### Aba Carteira — KPIs

| Indicador | Fórmula |
|---|---|
| Capital em Circulação | Soma de VALOR_PRINCIPAL dos contratos em `_ST_ATIVOS` (excl. `baixado_como_prejuizo`) |
| Saldo Devedor Total | Soma de saldo aberto por contrato (perdaInfoMap) |
| PDD Total | Soma de `saldo × pddPct(diasAtraso)` por contrato |
| Carteira Ajustada | Saldo Devedor − PDD Total |
| Cobertura PDD | PDD Total ÷ Perda Histórica Líquida (R$ 7.275) |

### Score de Crédito — Classificação

| Score | Faixa | Decisão | Taxa |
|---|---|---|---|
| 90–100 | Excelente | Aprovado | Mínima (14%) |
| 75–89 | Bom | Aprovado | Padrão baixa (16%) |
| 60–74 | Médio | Aprovado com restrição | Padrão (18%) |
| 45–59 | Atenção | Análise manual | Alta (22%) |
| 30–44 | Alto risco | Recusado | — |
| < 30 | Bloqueado | Recusado | — |

### Semáforos de ROI (aba Carteira)

| KPI | Verde | Amarelo | Vermelho |
|---|---|---|---|
| ROI Bruto | ≥ 15% | ≥ 5% | < 5% |
| ROI Ajustado | ≥ 12% | ≥ 0% | < 0% |
| Margem Ajustada | ≥ 80% | ≥ 50% | < 50% |

---

## RELATÓRIOS

### Comprovante de Pagamento (PDF)

- **Geração:** jsPDF — `src/main.jsx`
- **Formato:** 440px de largura (recibo compacto)
- **Conteúdo:** dados do cliente, contrato, parcela, valor pago, saldo devedor após
- **Envio:** WhatsApp via Evolution GO ou download direto
- **Timing:** pode ser gerado pré ou pós-`carregar()` — detectado via `isAlreadyProcessed`

### Comprovante de Quitação (PDF)

- **Formato:** A4 (794px) — certificado oficial
- **Conteúdo:** declaração de quitação integral, resumo do contrato, assinatura digital
- **Elemento:** Selo "QUITAÇÃO TOTAL" rotacionado −11°

### Extrato do Contrato (PDF) — redesenhado 2026-07-04

- **Geração:** jsPDF — `gerarExtratoPDF` em `src/main.jsx`, disponível via "Mais Ações" no `ContratoModal`
- **Formato:** A4, com paginação automática
- **Conteúdo:** banner de status (6 variantes, incluindo os 3 desfechos de Recuperação Judicial), dados do cliente/contrato, dados do processo judicial (condicional), resumo, situação financeira, bloco de recuperação judicial (condicional), **"Percurso do Contrato"** (timeline completa desde a criação até o encerramento, mesclando eventos financeiros e judiciais), histórico de pagamentos, parcelas em aberto
- **Detalhamento completo:** `DESIGN_SYSTEM.md` §20

### Relatório Financeiro (PDF)

- **Geração:** jsPDF — aba Financeiro
- **Conteúdo:** KPIs do período, tabela de pagamentos, DRE simplificado

### Carnê PIX

- **Geração:** Efí Bank API (cobv por parcela)
- **Distribuição:** código `pixCopiaECola` salvo no Sheets + exibido no modal do contrato

---

## SEGURANÇA

### Mecanismos de Segurança Implementados

| Mecanismo | Implementação |
|---|---|
| Autenticação | Cookie `fp_session` = HMAC-SHA256 (SHA-256, Web Crypto API) |
| Duração da sessão | 30 dias com renovação automática |
| Flags do cookie | `HttpOnly; Secure; SameSite=Strict` |
| Proteção de rotas | Middleware Vercel — verifica token em toda request |
| Proteção de API interna | `x-cobranca-secret` em `/api/efi-pix-avulso` |
| Webhook WhatsApp | Header `apikey` verificado |
| Certificado Efí | P12 armazenado como base64 em env var (`EFI_CERT_P12_BASE64`) |

### Variáveis de Ambiente (nunca no código)

| Variável | Uso |
|---|---|
| `LOGIN_PASSWORD` | Senha do painel |
| `LOGIN_SECRET` | Chave HMAC da sessão |
| `EFI_CLIENT_ID` | Efí Bank OAuth2 |
| `EFI_CLIENT_SECRET` | Efí Bank OAuth2 |
| `EFI_PIX_KEY` | Chave PIX cadastrada na Efí |
| `EFI_CERT_P12_BASE64` | Certificado P12 em base64 |
| `EFI_MULTA_PCT` | Percentual de multa (padrão: 2.00) |
| `EFI_JUROS_DIARIO` | Juros diários (padrão: 0.03) |
| `COBRANCA_SECRET` | Segredo para `/api/efi-pix-avulso` |
| `EVOLUTION_API_URL` | URL da Evolution GO |
| `EVOLUTION_API_KEY` | API key do Evolution (bot de triagem) |
| `EVOLUTION_INSTANCE` | ID da instância Evolution |
| `EVOLUTION_WEBHOOK_SECRET` | Segredo do webhook Evolution |
| `ANTHROPIC_API_KEY` | Claude AI (bot WhatsApp) |
| `FORMS_URL` | URL do Google Form (enviado no bot) |
| `ALEX_WHATSAPP_NUMBER` | Número do Alex para notificações |

### Arquivos NUNCA commitar

- `producao-849675-financeiroop.p12` — certificado Efí Bank (está no `.gitignore`)

### Riscos Identificados

| Risco | Nível | Status |
|---|---|---|
| Token ZapSign hardcoded em `appscript.gs` | Médio | Aberto — migrar para CONFIGURACOES |
| GAS Web App URL pública sem autenticação adicional | Médio | Aceitável — URL obscura + CORS |
| Sem rate limiting nas APIs | Médio | Aberto |
| Sem sanitização de dados do Sheets antes de renderizar | Baixo | Aberto (sem histórico de XSS) |
| Sessão única — sem revogação remota | Baixo | Aceitável para single-user |

---

## PADRÕES DE UI/UX

### Design System

Sistema visual baseado na identidade visual da **Borges Assessoria** com referência de acabamento em Wise · Stripe · Mercury.

**Três verdes da marca (papéis invioláveis):**

| Verde | Hex | Papel |
|---|---|---|
| Verde Borges | `#0B3D2E` | Institucional, ações positivas (light mode) |
| Verde-sinal | `#1FB877` | Dados, gráficos, progresso |
| Verde-limão (ACC) | `#A8E03F` | CTAs primários exclusivamente |

**Paleta completa:**

| Variável | Light | Dark | Uso |
|---|---|---|---|
| `BG` | `#F7F9F8` | `#0A0F0D` | Fundo da página |
| `CARD` | `#FFFFFF` | `#121815` | Cards e modais |
| `BD` | `#DDE3E0` | `#1F2624` | Bordas e divisores |
| `TEXT` | `#121815` | `#ECEFEE` | Texto principal |
| `MUTED` | `#6E7975` | `#6E7975` | Texto secundário |
| `GRN` | `#0B3D2E` | `#A8E03F` | Positivo/institucional |
| `SIG` | `#1FB877` | `#1FB877` | Gráficos/dados |
| `OK` | `#15A06A` | `#46CB92` | Delta positivo texto pequeno |
| `RED` | `#D64545` | `#D64545` | Erros, atrasos |
| `BLU` | `#1B8A8F` | `#1B8A8F` | Informação, Acordo Assistido |
| `YEL` | `#E0A030` | `#E0A030` | Avisos |
| `PUR` | `#221d9a` | `#7b74e6` | Renegociação, especial |
| `ORG` | `#FF7700` | `#FF7700` | Atraso/alerta |
| `ACC` | `#A8E03F` | `#A8E03F` | CTAs primários |

**Dark mode:** ativa às 18h, desativa às 6h — automático via `setTimeout`. Toggle manual é session-only.

### Tipografia

| Papel | Família | Peso |
|---|---|---|
| UI e texto geral | `"Helvetica Neue", Helvetica, Arial` | 400/600/700/800 |
| **Números financeiros** | `FONT.sans` + `tabular-nums` | **700–900** — NUNCA monoespaçado |
| Códigos/IDs/PIX/rótulos técnicos | `"IBM Plex Mono"` | 500 |

### 7 Tipos de Botões

| Tipo | Visual | Uso |
|---|---|---|
| 1 — CTA Primário | `ACC` pill 9999 + texto `#07241B` | Ação principal que completa fluxo |
| 2 — WhatsApp | `#25D366` pill | Quando WA é a ação principal |
| 3 — Ghost Secundário | Borda `BD`, fundo `CARD`, pill | Ação de suporte ao lado do CTA |
| 4 — Destrutivo | `RED` fundo, border-radius 8 | Ações irreversíveis |
| 5 — Contextual | Tint `COR`08 + borda `COR`40 | Ações de segundo plano semânticas |
| 6 — Cancelar/Fechar | `CARD` fundo, `MUTED` texto, border-radius 8 | Saída sem consequência |
| 7 — Micro Tabela | Tint + border-radius 6, 10px | Ações inline em tabelas |

### Padrões UX consolidados

- Sem informação duplicada na mesma tela
- Badges de score: formato `"X · Faixa"` (ex: "68 · Médio")
- Grids de KPIs: `repeat(N,1fr)` fixo — evita cards órfãos
- `finDe`/`finAte` iniciam com `mesAtualRange()` — sempre mês atual
- Cobrança: sidebar badge = parcelas; subtítulo = "X clientes · Y parcelas"
- `InfoTooltip` com `position:fixed` via `getBoundingClientRect` — não corta em containers overflow

---

## PADRÕES DE CÓDIGO

### Frontend (`src/main.jsx`)

```javascript
// Busca de dados
fetch("/api/sheets")  // GET → GAS doGet → todas as abas como JSON

// Escrita
postAction({ action: "nomeAcao", ...dados })  // POST → GAS doPost

// Cores do tema — sempre variáveis, nunca hex hardcoded
// Exceções documentadas: #25D366 (WhatsApp), #6C3FC5 (ZapSign), #B8860B (PIX), #07241B (texto sobre ACC)

// Constantes globais — NUNCA redefinir localmente
const _ST_TERMINAL = new Set([...])    // parcelas terminais
const _ST_ATIVOS   = new Set([...])    // contratos ativos
const _ST_CONTRATO_EXCLUIDO = new Set([...])  // excluídos da cobrança

// Status formatado pela data (não pelo valor gravado)
statusEfetivo(parcela)

// Cache localStorage com TTL 5 minutos
// {data: d, ts: Date.now()} — suporta formato antigo (sem ts)

// AbortController — cancela fetch anterior ao iniciar novo
// AbortError é silencioso (não reseta loading)

// Optimistic UI — setRaw imediato → modal fecha → carregar() em background
```

### Backend (`appscript.gs`)

```javascript
// Mapa dinâmico de colunas — SEMPRE
var cm = buildColMap(sheet);
setCel(sheet, row, cm, "NOME_COLUNA", value);

// Datas — SEMPRE parseDateLocal, nunca new Date("YYYY-MM-DD")
parseDateLocal("2026-06-17")  // retorna new Date(2026, 5, 17, 12, 0, 0)

// IDs sequenciais
proximoIdSeq(sheet, "PAG")  // → "PAG00001"

// Status terminais de parcela (global — nunca redefinir localmente)
var STATUS_TERMINAL = { pago:1, quitacao_antecipada:1, baixado_como_prejuizo:1, cancelado:1, renegociado:1 };

// Configurações globais
_getCfg("CHAVE")        // lê valor do CONFIGURACOES
_setCfg("CHAVE", valor) // escreve/cria chave no CONFIGURACOES
```

### Convenções

- Commits em português, prefixo `feat:` / `fix:` / `refactor:`
- Sem CSS externo em `main.jsx` — 100% inline styles + variáveis de tema
- Sem componentes separados — tudo em `main.jsx` (exceto shadcn/ui)
- Sem comentários desnecessários
- Deploy automático após editar `src/main.jsx` ou `api/*.js`: `vercel deploy --prod`
- Após editar `appscript.gs`: abrir TextEdit + instruir Cmd+A → Cmd+C → colar no GAS → publicar nova versão

---

## DEPENDÊNCIAS EXTERNAS

### Produção — npm

| Pacote | Versão | Propósito |
|---|---|---|
| `react` | 18.2.0 | Framework UI |
| `react-dom` | 18.2.0 | Renderização DOM |
| `recharts` | 2.8.0 | Gráficos |
| `jspdf` | 4.2.1 | Geração de PDF |
| `lucide-react` | 1.16.0 | Ícones |
| `shadcn` | 4.8.0 | Componentes UI |
| `clsx` | 2.1.1 | Utilitário de classes |
| `tailwind-merge` | 3.6.0 | Merge de classes Tailwind |
| `class-variance-authority` | 0.7.1 | Variantes de componentes |
| `tw-animate-css` | 1.4.0 | Animações CSS |
| `cmdk` | 1.1.1 | Command palette (instalado, uso futuro) |

### Dev — npm

| Pacote | Versão | Propósito |
|---|---|---|
| `vite` | 4.4.0 | Build tool |
| `@vitejs/plugin-react` | 4.0.0 | Plugin React para Vite |
| `tailwindcss` | 4.3.0 | CSS utilitário |
| `postcss` | 8.5.15 | Processador CSS |
| `autoprefixer` | 10.5.0 | Prefixos CSS |

### Serviços externos

| Serviço | Custo | Criticidade |
|---|---|---|
| Vercel | Free/Pro | Crítico — hosting |
| Google Sheets + GAS | Gratuito | Crítico — banco de dados |
| Efí Bank | Por transação | Crítico — PIX |
| Evolution GO | Pago | Alto — WhatsApp cobrança |
| ZapSign | Pago | Médio — assinatura |
| Anthropic (Claude AI) | Por token | Médio — bot triagem |
| Google Forms | Gratuito | Médio — cadastro clientes |

---

## LIMITAÇÕES IDENTIFICADAS

### Técnicas

| Limitação | Impacto | Prioridade para resolver |
|---|---|---|
| Google Sheets como banco de dados — sem transações atômicas, sem joins nativos, sem índices | Performance degrada com >10.000 linhas; risco de race condition em escritas simultâneas | Alta — migração para Supabase (Fase 3) |
| `src/main.jsx` com ~6.200 linhas — monolito intencional | Difícil manutenção a longo prazo; tempo de build cresce | Média — modularização na Fase 3 |
| GAS sem versionamento de histórico automático | Erros de edição podem sobrescrever código sem backup | Média |
| Single-user — sem multi-usuário | Alex não pode delegar acesso parcial | Baixa — futuro com Supabase |
| Sem testes automatizados | Regressões detectadas apenas manualmente | Média |
| Token ZapSign hardcoded no GAS | Risco de exposição se o código for compartilhado | Baixa |
| Cache localStorage sem invalidação por evento | Após pagamento via webhook, frontend pode exibir dados desatualizados até o TTL expirar | Baixa |

### Operacionais

| Limitação | Impacto |
|---|---|
| `JUROS_TOTAL` do contrato não atualiza ao registrar somente_juros | Divergência de R$ 6.048,74 detectada (2026-06-15) — campo subestimado |
| Contratos anteriores ao PIX Efí sem colunas EFI_* preenchidas | Sem backfill histórico |
| Contratos em `acordo_assistido` antes de 2026-06-14 sem DATA_ENTRADA | Regra dos 180 dias pode ser imprecisa para contratos antigos |
| `DIFERENCA_RECEBIDA` — 81 registros históricos com o campo legado | Dupla contagem se código legado for reativado |

---

## OPORTUNIDADES DE MELHORIA

### Alta prioridade

| Melhoria | Esforço | Impacto |
|---|---|---|
| PDD v2.0 — revisão de percentuais após 50 contratos | Baixo | Alto — DRE mais preciso |
| Corrigir JUROS_TOTAL do contrato ao registrar somente_juros | Médio | Médio — integridade financeira |
| Portal do cliente (PWA) — visualizar parcelas, baixar comprovantes | Alto | Alto — experiência do cliente |
| Migração Google Sheets → Supabase | Muito alto | Muito alto — escala e performance |
| Token ZapSign movido para CONFIGURACOES | Baixo | Médio — segurança |

### Média prioridade

| Melhoria | Esforço | Impacto |
|---|---|---|
| Formulário de cadastro standalone (não depender do Google Forms) | Médio | Médio — UX do cliente |
| Rate limiting nas API routes | Baixo | Médio — segurança |
| Testes automatizados para cálculos financeiros | Médio | Alto — confiabilidade |
| Webhook de confirmação de leitura do WhatsApp | Médio | Médio — visibilidade da cobrança |
| Relatório de adimplência por faixa de tempo | Médio | Médio — gestão |
| Alertas automáticos para Alex (acordos próximos de expirar 180d) | Baixo | Médio — controle |

### Baixa prioridade / Ideias futuras

| Melhoria | Esforço | Impacto |
|---|---|---|
| Multi-usuário com roles (para eventual equipe) | Alto | Médio |
| Integração com bureau de crédito (SPC/Serasa) | Muito alto | Alto |
| App mobile nativo | Muito alto | Médio |
| Negativação/protesto automatizados | Alto | Alto |
| Dashboard para padrinhos (portal de indicações) | Médio | Médio |

---

## ÚLTIMA AUDITORIA DO SISTEMA

### Auditoria Forense — 2026-06-15

**Escopo:** Integridade de dados, constantes duplicadas, campos legado, automações.

**Resultado:** 11 problemas encontrados, 10 corrigidos.

| # | Problema | Severidade | Status |
|---|---|---|---|
| F1 | Régua enviava valor errado (R$ 5/7) — coluna VALOR inexistente | Alto | Resolvido |
| F2 | PIX rejeitado (500) para parcelas vencidas | Alto | Resolvido |
| F3 | Dry-run gravava erros no MENSAGENS | Médio | Resolvido |
| F4 | `_jaEnviouHoje` bloqueava após erros | Médio | Resolvido |
| F5 | Evolution GO com endpoint/autenticação incorretos | Crítico | Resolvido |
| F6 | `recuperado_parcialmente` sumia do monitoramento | Alto | Resolvido |
| F7 | `JUROS_TOTAL` não atualiza em somente_juros | Médio | **Aberto** |
| F8 | Template CONFIRMACAO ausente em `buscarTemplatesRegua()` | Médio | Resolvido |
| F9 | `acordo_assistido` revertido pelo trigger diário | Crítico | Resolvido |
| F10 | BaixaModal com capital recuperado zero em acordo_assistido | Alto | Resolvido |
| F11 | Simulador: valor revertia para múltiplo de 50 | Baixo | Resolvido |

### Auditoria Estrutural — 2026-06-15

**Escopo:** Constantes duplicadas, aliases legado, campos redundantes.

**Resultado:** 10 inconsistências, todas corrigidas.

| # | Inconsistência | Status |
|---|---|---|
| A1 | `_ST_ATIVOS` definido em 3 locais diferentes | Resolvido — constante global única |
| A2 | `_stTermLeg` com variantes legado (paga, quitado...) | Resolvido — removido |
| A3 | `statusPago` com variantes legado | Resolvido |
| A4 | `DIFERENCA_RECEBIDA` sendo gravada duplicada | Resolvido — campo oficial: `RECEITA_EXTRA_ATRASO` |
| A5 | `LUCRO_JUROS` duplicando `LUCRO_TOTAL` | Resolvido — apenas `LUCRO_TOTAL` |
| A6 | TOTAL_PAGO, CONTRATOS_ATIVOS, CONTRATOS_BAIXADOS nunca calculados | Resolvido — 132 clientes atualizados |
| A7 | STATUS_PROMESSA filtrado com exclusão lowercase | Resolvido — whitelist `.toUpperCase() === "PENDENTE"` |
| A8 | `var TERMINAL/ST_FIM` redefinidos localmente no GAS | Resolvido — usar global `STATUS_TERMINAL` |
| A9 | Aliases curtos em tipoMap (normal, com_atraso...) | Resolvido — zero ocorrências no banco |
| A10 | `M.lucroTotal` = `receitaExtra` (nomenclatura enganosa) | Resolvido — removido |

### Estado atual do banco (diagnóstico `diagnosticarLegado()` — 2026-06-15)

- **0 ocorrências** de valores legado em PAGAMENTOS e PARCELAS
- Banco considerado **limpo** — apenas valores canônicos

---

*Documento gerado e mantido pelo Claude Code. Atualizar sempre que o sistema evoluir.*  
*Última auditoria completa: 2026-06-15. Próxima revisão de PDD: Dez/2026 ou após 50 contratos encerrados.*
