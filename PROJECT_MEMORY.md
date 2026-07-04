# PROJECT MEMORY — FinanceiroOp / Borges Assessoria

> **Documento vivo.** Preservar histórico. Nunca apagar decisões antigas. Atualizar status continuamente.  
> **Última atualização:** 2026-07-04  
> **Proprietário:** Alex Borges (alexborges.mx@gmail.com)

---

## VISÃO DO NEGÓCIO

### Modelo de Negócio

**Borges Assessoria** é uma financeira informal de crédito pessoal operada por Alex Borges com capital próprio.

- Empresta dinheiro para trabalhadores CLT (carteira assinada)
- Cobra juros mensais simples sobre o principal
- Gerencia parcelas e recebe via PIX
- Modelo de captação: 100% por indicação (padrinho/madrinha)
- Sem CNPJ de crédito, sem investidores, sem banco
- Todo o risco e capital são do proprietário

**Receita principal:** juros sobre empréstimos  
**Receita adicional:** multa e juros de atraso sobre parcelas vencidas  
**Moeda:** BRL (R$) — Fuso: UTC-3 (Brasil)

### Público-Alvo

**Tomadores de crédito:**
- Trabalhadores com carteira assinada (CLT)
- Renda comprovada por contracheque
- Captados exclusivamente via indicação de clientes ativos
- Requisito de padrinho: o indicador deve ter ao menos um contrato quitado

**Operador do sistema:**
- Alex Borges — único usuário do painel FinanceiroOp
- Opera o negócio sozinho, sem equipe
- Acessa via navegador (Vercel production URL)

### Objetivos da Empresa

1. **Curto prazo:** Formalizar operação jurídica (conta Google corporativa, CNPJ)
2. **Médio prazo:** Escalar carteira com gestão de risco disciplinada e cobrança automatizada
3. **Longo prazo:** Portal do cliente, migração para banco de dados escalável (Supabase), potencial expansão de equipe

### Metas de Curto Prazo

- [ ] Formalização jurídica + conta Google corporativa — **blocker legal** (Fase 0)
- [ ] Revisão dos percentuais de PDD v1.0 após 50 contratos encerrados ou Dez/2026
- [ ] Corrigir bug de JUROS_TOTAL não atualizar em registros de somente_juros

### Metas de Médio Prazo

- [ ] Formulário de cadastro standalone (não depender do Google Forms) — Fase 1.5
- [ ] PDD v2.0 com percentuais revisados
- [ ] Relatórios gerenciais avançados (DRE mensal provisionado)

### Metas de Longo Prazo

- [ ] Portal do cliente PWA — Fase 2 (dependente de Supabase)
- [ ] Migração Google Sheets → Supabase — Fase 3
- [ ] Multi-usuário com roles para eventual equipe

---

## REGRAS DE NEGÓCIO

### Política de Crédito

- **Requisito obrigatório:** CLT — sem carteira assinada, reprovado imediatamente
- **Requisito de indicação:** padrinho com ao menos um contrato quitado
- **Limite do 1º contrato:** R$ 1.500 para qualquer cliente novo, independente do score
- **Score mínimo para aprovação:** 60 pontos
- **Um contrato ativo por cliente** — proibido criar novo enquanto há contrato ativo
- **Comprometimento máximo:** 35% da renda líquida mensal
- **Prazo máximo:** 1x a 12x (depende do score)

### Critérios de Aprovação

| Score | Faixa | 1º Contrato | 2º+ Contrato | Prazo máx |
|---|---|---|---|---|
| 90–100 | Excelente | R$ 1.500 | R$ 4.000 | 12x |
| 75–89 | Bom | R$ 1.500 | R$ 3.000 | 10x |
| 60–74 | Médio | R$ 1.500 | R$ 1.500 | 6x |
| 45–59 | Atenção | Não emprestar | R$ 1.000 (análise manual) | 3x |
| < 45 | Alto risco | Recusado | Recusado | — |

### Critérios de Reprovação

- Sem CLT
- Score < 45 (2º+ contrato) ou score < 60 (1º contrato)
- Atraso atual > 30 dias
- Comunicação ruim + qualquer atraso
- Prejuízo registrado e não recuperado
- Renegociação ativa + inadimplente
- Score final < 30 (bloqueio automático)
- Sem padrinho válido (com contrato quitado)

### Taxas de Juros

| Faixa de Score | Taxa mensal |
|---|---|
| Excelente (90–100) | 14% ao mês |
| Bom (75–89) | 16% ao mês |
| Médio (60–74) | 18% ao mês |
| Atenção (45–59) | 22% ao mês |
| Alto risco (< 45) | 25% ao mês (máxima) |

Taxas armazenadas e editáveis no CONFIGURACOES do Sheets.

### Multas e Juros de Atraso (PIX cobv)

- **Multa:** 2% (modalidade percentual) — padrão configurável via env `EFI_MULTA_PCT`
- **Juros:** 0,03% ao dia (modalidade percentual) — padrão configurável via env `EFI_JUROS_DIARIO`
- **Validade pós-vencimento:** 30 dias

### Renegociações

- **Acordo com Perda:** formalizado via `ModalAcordoPerda` → GAS `registrarAcordoComPerda()`
  - Cliente paga valor menor que a dívida total
  - Registrado em ACORDOS
  - Parcelas abertas viram status `renegociado`
  - Contrato vira `renegociado`
  - Contabilizado como Capital Recuperado (não receita)

- **Acordo Assistido:** para clientes que perderam renda temporariamente mas mantêm boa comunicação
  - Score congelado durante todo o período
  - Abatimento livre — qualquer valor, sem vínculo com parcela específica
  - 100% do abatimento é Capital Recuperado (nunca receita)
  - Expiração automática: 180 dias sem abatimento → `pre_prejuizo`

- **Quitação Antecipada:** liquidação total com possível desconto nos juros
  - Desconto vai apenas nos juros — nunca no principal
  - Registrado como `quitacao_antecipada` em PAGAMENTOS

### Cobrança

- Aba Cobrança: fila de parcelas vencidas agrupadas por cliente
- Exclusões automáticas: `acordo_assistido`, status terminais
- Ações disponíveis: registrar pagamento, reagendar (promessa), WhatsApp, gerar PIX
- Régua automática: 9 gatilhos (D-5 a D+7 + promessas)
- Clientes `PERFIL_COBRANCA = EVASIVO` são pulados na régua
- Máximo 1 mensagem por cliente por dia

### Inadimplência

| Dias de atraso | Status | Ação |
|---|---|---|
| 1–30d | `ativo_em_atraso` | Cobrança WhatsApp |
| 31–60d | `em_cobranca` | Intensificar contato, PIX |
| 61–120d | `pre_prejuizo` | Pessoas de confiança, acordo |
| > 120d | `pre_prejuizo` | Avaliar baixa ou Acordo Assistido |

Atualização automática às 7h pelo trigger do GAS.

### Protesto / Negativação

**Não implementado.** Operação informal — sem acesso a bureau de crédito (SPC/Serasa). A "negativação" é operacional: o cliente fica bloqueado no sistema para novo crédito (`STATUS_CLIENTE = bloqueado`).

---

## DECISÕES IMPORTANTES

### 2026-01 — Adoção de Google Sheets como banco de dados

- **Decisão:** Usar Google Sheets + Google Apps Script como backend e banco de dados
- **Motivo:** Custo zero, familiaridade do operador com Sheets, facilidade de manutenção sem equipe técnica
- **Impacto:** Performance limitada para grandes volumes; sem transações atômicas; migração futura necessária
- **Status:** Em produção — migração para Supabase planejada como Fase 3

### 2026-04 — Arquitetura monolítica do frontend

- **Decisão:** Todo o frontend em um único arquivo `src/main.jsx` (~6.200 linhas)
- **Motivo:** Simplicidade de manutenção para operador solo sem equipe; facilidade de deploy
- **Impacto:** Dificuldade crescente de manutenção; modularização futura necessária
- **Status:** Mantido — modularização planejada na Fase 3

### 2026-05 — Adoção do Design System Borges (Wise-inspired)

- **Decisão:** Criar design system próprio baseado na identidade visual da Borges Assessoria
- **Motivo:** Profissionalismo, coerência visual, identidade de marca clara
- **Impacto:** UI significativamente mais refinada; paleta de três verdes estabelecida
- **Status:** Em produção desde 2026-05 (concluído 2026-06-09)

### 2026-06-09 — Lima canônica fixada em `#A8E03F`

- **Decisão:** Lima oficial é `#A8E03F` — substitui `#A8E040` e `#9fe870` em todos os contextos
- **Motivo:** Consistência com o Manual de Identidade Visual oficial
- **Impacto:** Todos os CTAs primários e ACC usam `#A8E03F`
- **Status:** Implementado

### 2026-06-14 — Implementação do Acordo Assistido

- **Decisão:** Criar status especial para clientes em dificuldade temporária com boa comunicação
- **Motivo:** Alternativa ao binário "em cobrança / baixado" — preserva relacionamento e recupera capital
- **Impacto:** Score congelado durante o período; capital recuperado diferenciado da receita; 180d de expiração
- **Status:** Em produção

### 2026-06-14 — PDD Gerencial v1.0 implementado

- **Decisão:** Implementar Provisão para Devedores Duvidosos gerencial (não contábil) na aba Carteira
- **Motivo:** Gestão de risco mais realista; DRE ajustado ao risco sem esperar a baixa formal
- **Impacto:** Percentuais calibrados sobre histórico real de 216 contratos; perda histórica 1,42%
- **Status:** Em produção — revisão de percentuais em Dez/2026 ou após 50 contratos

### 2026-06-15 — Régua de Cobrança Automática em produção

- **Decisão:** Implementar régua de cobrança automática via WhatsApp com PIX integrado
- **Motivo:** Eliminar trabalho manual diário de envio de cobranças; escalar sem aumentar tempo operacional
- **Impacto:** 9 gatilhos automáticos; PIX avulso gerado pela Efí Bank; 8 bugs corrigidos na implementação
- **Status:** Em produção desde 2026-06-15

### 2026-06-15 — Evolution GO vs Evolution Open-Source

- **Decisão:** Confirmar uso do Evolution GO (versão comercial) com API diferente da open-source
- **Motivo:** A versão GO tem endpoint `/send/text` (sem instância na URL) e autentica com Token da Instância (não API key global)
- **Impacto:** 3 tentativas de endpoint/autenticação antes de encontrar o correto; documentado em BUGS CONHECIDOS
- **Status:** Resolvido — endpoint e autenticação corretos documentados

### 2026-06-15 — `STATUS_CARTEIRA` declarada auxiliar/legado

- **Decisão:** `STATUS_CARTEIRA` em CONTRATOS não deve ser usada em nenhuma lógica de negócio
- **Motivo:** `STATUS_CONTRATO` é a única fonte de verdade; `STATUS_CARTEIRA` era inconsistente
- **Impacto:** Todo o frontend e GAS usam apenas `STATUS_CONTRATO`
- **Status:** Implementado — `STATUS_CARTEIRA` mantida apenas como label visual na planilha

### 2026-06-15 — Constantes de status consolidadas

- **Decisão:** Criar constantes globais canônicas `_ST_TERMINAL`, `_ST_ATIVOS`, `_ST_CONTRATO_EXCLUIDO` no frontend e `STATUS_TERMINAL` no GAS — nunca redefinir localmente
- **Motivo:** 3 definições divergentes do mesmo conceito causavam bugs silenciosos em filtros
- **Status:** Implementado

### 2026-07-04 — "Ajuizar" deixa de ser status final

- **Decisão:** `em_processo_judicial` não é mais um beco sem saída — é o início de uma nova fase com duas dimensões independentes: `STATUS_PROCESSO` (situação processual, já existia) e `SITUACAO_FINANCEIRA_JUDICIAL` (situação financeira, novo campo). Só transiciona para o status terminal `encerrado_judicialmente` quando resolvido.
- **Motivo:** Antes do módulo, não existia nenhuma ação disponível para um contrato ajuizado — sem como registrar acordo, pagamento ou quitação judicial.
- **Impacto:** Recuperação judicial modelada como contador (`VALOR_RECUPERADO_JUDICIAL_PRINCIPAL`/`_LUCRO` vs `PREJUIZO_CAPITAL`), nunca reaproveitando os status mortos `recuperado_parcialmente`/`em_recuperacao` (que são ativamente revertidos por `corrigirStatusRecuperacao`).
- **Status:** Implementado

### 2026-07-04 — Bloqueio de crédito por judicialização é permanente

- **Decisão:** `CLIENTE_JUDICIALIZADO="SIM"` nunca é revertido, mesmo com quitação total do processo judicial. Validado tanto no frontend quanto no backend (`criarContrato` rejeita a criação com erro).
- **Motivo:** Regra de negócio explícita do usuário — cliente que já foi ajuizado nunca mais pode contratar, independente do desfecho.
- **Status:** Implementado

---

## HISTÓRICO DE EVOLUÇÃO

### 2026-01 — MVP inicial

- **Alteração:** Sistema básico de contratos, parcelas e pagamentos
- **Objetivo:** Substituir planilha manual por sistema estruturado
- **Resultado:** Base funcional de gestão financeira em produção

### 2026-04 — Motor analítico (Fase 1A)

- **Alteração:** LTV, ROI, aba Inteligência, PADRINHOS, EMPREGADORES
- **Objetivo:** Visibilidade gerencial da carteira e qualidade dos clientes
- **Resultado:** Dashboard com KPIs completos; análise de padrinhos e empregadores

### 2026-05 a 2026-06-09 — Design System Borges (Fase 1A.1)

- **Alteração:** Design system completo (brand.css, DESIGN_SYSTEM.md), refatoração shadcn
- **Objetivo:** UI premium com identidade de marca profissional
- **Resultado:** Sistema visual coerente com 3 verdes, 7 tipos de botão, dark/light automático

### 2026-06-09 — Correções QA (9 bugs)

- **Alteração:** Simulador (5 bugs), Acordo Assistido UI, Quitação Antecipada modal
- **Objetivo:** Qualidade pré-release
- **Resultado:** 9 bugs críticos corrigidos, UX melhorada

### 2026-06-14 — Acordo Assistido + Auditoria Financeira (Fase 1A.2)

- **Alteração:** Status `acordo_assistido` completo + PERFIL_COBRANCA + PDD v1.0 + Resultado Ajustado ao Risco
- **Objetivo:** Carteira de Recuperação Assistida + gestão de risco com provisão
- **Resultado:** Fluxo completo de acordo assistido em produção; 5 bugs financeiros corrigidos

### 2026-06-15 — Régua de Cobrança Automática (Fase 1B)

- **Alteração:** `enviarReguaCobranca()` com 9 gatilhos, PIX avulso Efí, confirmação automática de pagamento, editor de templates
- **Objetivo:** Eliminar trabalho manual de cobrança diária
- **Resultado:** Régua 100% operacional; 8 bugs corrigidos durante a implementação

### 2026-06-15 — Auditoria Estrutural (10 inconsistências)

- **Alteração:** Constantes duplicadas eliminadas, campos legado marcados, colunas zeradas recalculadas
- **Objetivo:** Limpar débito técnico acumulado na base de código
- **Resultado:** 10 inconsistências resolvidas; banco diagnosticado como limpo

### 2026-07-04 — Módulo Recuperação Judicial

- **Alteração:** `registrarAcordoJudicial` (parcelado ou à vista), `registrarQuitacaoJudicial`, `arquivarProcessoJudicial`, helper `_alocarRecuperacaoJudicial` (cascata: custo do credor → principal → lucro → reembolso ao devedor). Novo campo `SITUACAO_FINANCEIRA_JUDICIAL`. Bloqueio de crédito permanente validado no backend. 3 modais novos no ContratoModal, KPI "Capital em Judicial" na Carteira, KPIs de recuperação em Perdas & Recuperação.
- **Objetivo:** Fechar o gap onde contratos ajuizados ficavam sem nenhuma ação disponível no sistema
- **Resultado:** Módulo completo em produção. 7 bugs encontrados e corrigidos em auto-revisão antes do deploy (ver `docs/ai-memory/07-AI-KNOWN-ISSUES.md`, entradas 2026-07-04)

### 2026-07-04 — Redesign do Extrato do Contrato (PDF)

- **Alteração:** `gerarExtratoPDF` ganhou consciência do módulo judicial (dados do processo, recuperação judicial, badge de status para os 3 desfechos) + timeline "Percurso do Contrato" mesclando eventos financeiros e judiciais. Corrigidos telefone sem formatação e símbolos Unicode (✓/⚠) quebrados no jsPDF.
- **Objetivo:** Documento de quitação/extrato não refletia o módulo judicial implementado no mesmo dia — cliente recebia PDF com dados zerados e formatação quebrada
- **Resultado:** Testado com PDF real gerado (contrato judicial + contrato normal, sem regressão). Padrão documentado em `DESIGN_SYSTEM.md` §20

### 2026-07-04 — Motor de Undo, Quitação PIX, Certificado de Quitação, Auditoria e Backup automáticos

- **Alteração:** Grande volume de backend acumulado sem commit por semanas, commitado de uma vez (`98afd35`): motor de undo com TTL de 15 min (`registrarUndo`/`reverterOperacao` + 7 handlers `_reverter*`), quitação antecipada via PIX (`gerarPropostaQuitacaoPix`/`pagamentoQuitacaoWebhook`, expira em 48h), certificado público de quitação (`gerarCertificadoQuitacao`/`api/cert.js`, rota `/c/:codigo`), idempotência de webhook (`_idem_check`/`_idem_reg`), auditoria automática de integridade com score 0–100 (`auditarIntegridadeSistema`, trigger diário 07:05) e backup automático da planilha no Drive (`fazerBackupAutomatico`, trigger diário 2h, retém 30 cópias). 5 abas novas no Sheets: UNDO_LOG, QUITACOES, CERTIFICADOS, AUDITORIA, OPERACOES_PROCESSADAS. Removida `alterarDiaVencimentoContrato` — função órfã desde 22/05 que nunca teve entrada no frontend.
- **Objetivo:** Fechar gaps de segurança operacional (erro de digitação sem volta, webhook duplicado, perda total de dado) e abrir canal de quitação self-service para o cliente
- **Resultado:** Tudo commitado e documentado; **undo e quitação PIX ainda sem botão no `main.jsx`** (só acionável via API) — certificado já dispara automático ao quitar. Triggers de auditoria/backup precisam ser ativados 1x manual no editor do GAS (`configurarTriggerAuditoria`/`configurarTriggerBackup`) — não há confirmação de que já rodaram em produção. Ver `docs/ai-memory/07-AI-KNOWN-ISSUES.md`, entrada 2026-07-04.

---

## ROADMAP

### Em Produção

| Feature | Data | Status |
|---|---|---|
| Sistema de contratos e parcelas | 2026-01 | ✅ Produção |
| Motor de score de crédito | 2026-03 | ✅ Produção |
| Carnê PIX Efí Bank | 2026-04 | ✅ Produção |
| Assinatura ZapSign | 2026-04 | ✅ Produção |
| Bot WhatsApp triagem (Evolution + Claude) | 2026-05 | ✅ Produção |
| Design System Borges + shadcn | 2026-06-09 | ✅ Produção |
| Motor analítico (LTV, ROI, Inteligência) | 2026-06-09 | ✅ Produção |
| Acordo Assistido + PERFIL_COBRANCA | 2026-06-14 | ✅ Produção |
| PDD Gerencial v1.0 + Resultado Ajustado | 2026-06-14 | ✅ Produção |
| Régua de Cobrança Automática (WhatsApp + PIX) | 2026-06-15 | ✅ Produção |
| Editor de Templates de Mensagem (painel) | 2026-06-15 | ✅ Produção |
| Confirmação automática de pagamento (WhatsApp) | 2026-06-15 | ✅ Produção |
| Módulo Recuperação Judicial (acordo, quitação, arquivamento) | 2026-07-04 | ✅ Produção |
| Extrato do Contrato redesenhado (consciente do judicial + timeline) | 2026-07-04 | ✅ Produção |
| Certificado de Quitação (link público automático via WhatsApp) | 2026-07-04 | ✅ Produção |

### Em Desenvolvimento

| Feature | Fase | Prioridade |
|---|---|---|
| Simulador de empréstimo | — | Média (UI existe, incompleto) |
| Motor de Undo (15 min) | — | Média (backend completo, sem botão "Desfazer" no app) |
| Quitação Antecipada via PIX | — | Média (backend completo, sem UI pra iniciar a proposta) |
| Auditoria automática + Backup automático | — | Alta (funções prontas; confirmar se `configurarTriggerAuditoria`/`configurarTriggerBackup` já rodaram 1x em produção) |

### Próximas Implementações

| Feature | Fase | Prioridade | Blocker |
|---|---|---|---|
| Formalização jurídica + conta Google corporativa | 0 | Crítico | — |
| PDD v2.0 (revisão percentuais) | PDD | Médio | 50 contratos ou Dez/2026 |
| Corrigir JUROS_TOTAL em somente_juros | — | Médio | — |
| Formulário de cadastro standalone | 1.5 | Médio | — |
| DRE mensal provisionado | PDD | Médio | — |

### Ideias Futuras

| Ideia | Fase | Complexidade |
|---|---|---|
| Portal do cliente (PWA) | 2 | Alta — dependente de Supabase |
| Migração Google Sheets → Supabase | 3 | Muito alta |
| Multi-usuário com roles | 4 | Alta |
| Integração SPC/Serasa | 5 | Muito alta |
| Negativação/protesto automatizado | 5 | Alta |
| Dashboard de padrinhos (portal de indicações) | 3 | Média |

---

## PROBLEMAS CONHECIDOS

| ID | Descrição | Impacto | Prioridade | Status |
|---|---|---|---|---|
| BUG-01 | JUROS_TOTAL do contrato não atualiza ao registrar somente_juros | Divergência R$ 6.048,74 detectada em 2026-06-15 — campo subestimado | Médio | **Aberto** |
| BUG-02 | Contratos em acordo_assistido antes de 2026-06-14 sem DATA_ENTRADA_ACORDO_ASSISTIDO | Regra dos 180 dias imprecisa para contratos antigos | Baixo | Aberto |
| BUG-03 | Token ZapSign hardcoded em appscript.gs | Risco de exposição se código for compartilhado | Médio | Aberto |
| BUG-04 | Cache localStorage sem invalidação por evento externo | Frontend pode exibir dados desatualizados por até 5 min após pagamento via webhook | Baixo | Aberto |

### Bugs Resolvidos (histórico)

| Data | Bug | Resolução |
|---|---|---|
| 2026-06-03 | Data um dia antes no Sheets (bug UTC-3) | `parseDateLocal()` — `new Date(y, m, d, 12, 0, 0)` |
| 2026-06-03 | Parcela não some de "Em Atraso" após acordo | `registrarPagamentoAPI` limpa `DATA_ACORDO` |
| 2026-06-03 | TEL_PADRINHO vazio no cadastro via Form | Lookup fuzzy por substring + normalização de acentos |
| 2026-06-05 | Campos de endereço e contatos não chegavam via Form | Títulos exatos + função `v()` com fallback NFD + remoção de `_soDigitos` em campos textuais |
| 2026-06-10 | STATUS_CONTRATO preso em "ativo_em_dia" com todas parcelas pagas | Fix em `atualizarStatusContratos`: detecta `todasTerminal` antes de calcular dias |
| 2026-06-14 | `acordo_assistido` revertido pelo trigger diário | Interceptação antes de `statusFinais` com regra própria dos 180 dias |
| 2026-06-14 | BaixaModal zerava capital recuperado em acordo_assistido | Usa `VALOR_ABATIDO_ASSISTIDO` quando `isAcordoAssistido` |
| 2026-06-14 | `recuperado_parcialmente` sumia do monitoramento | Parcial mantém `baixado_como_prejuizo`; só muda ao zerar prejuízo |
| 2026-06-15 | Régua enviava valor R$ 5/7 (coluna VALOR inexistente) | `cmP["VALOR_PARCELA"] \|\| cmP["VALOR"] \|\| 8` — nome de coluna tem prioridade |
| 2026-06-15 | PIX rejeitado (500) para parcelas vencidas | `if (dataVenc < todayStr) dataVenc = todayStr` em `efi-pix-avulso.js` |
| 2026-06-15 | Dry-run gravava erros no MENSAGENS | Guard `if (!dryRun)` em todos os `_logMensagem` de erro |
| 2026-06-15 | `_jaEnviouHoje` bloqueava após erros do dia | Verifica `STATUS_ENVIO === "ENVIADO"` — erros não bloqueiam |
| 2026-06-15 | Evolution GO com endpoint/autenticação incorretos | Endpoint `/send/text`; body `{number, text, instanceId}`; Token da Instância |
| 2026-06-15 | Template CONFIRMACAO ausente em `buscarTemplatesRegua()` | Adicionado a `_MSG_TEMPLATES`; fallback automático |
| 2026-06-15 | Simulador: valor revertia para múltiplo de 50 | `step={1}` sem snap para múltiplo de 50 |
| 2026-07-04 | PREJUIZO_CAPITAL não calculado se ajuizado sem baixa prévia | `ajuizarContrato` calcula a partir do principal aberto quando vazio |
| 2026-07-04 | Datas de acordo/quitação judicial um dia antes (timezone) | `parseDateLocal` em vez de `new Date(dados.data)` |
| 2026-07-04 | Parcelas órfãs em acordo à vista / arquivamento judicial | Fecham como `renegociado`/`baixado_como_prejuizo` antes de finalizar |
| 2026-07-04 | `arquivarProcessoJudicial` sem guarda de status | Só permite se já `em_processo_judicial`/`encerrado_judicialmente` |
| 2026-07-04 | Quitação judicial com desconto marcava status errado | Checa `PREJUIZO_CAPITAL` residual antes de decidir quitado/parcial |
| 2026-07-04 | Telefone garbled no Extrato do Contrato (PDF) | `fmtTel` extraído para escopo de módulo e aplicado |
| 2026-07-04 | Símbolos ✓/⚠ quebrados no jsPDF (Extrato do Contrato) | Removidos — Helvetica padrão não suporta fora de WinAnsi |

---

## DÉBITOS TÉCNICOS

| ID | Descrição | Prioridade | Estimativa |
|---|---|---|---|
| DT-01 | `src/main.jsx` com ~6.200 linhas — modularização | Baixa (intencionalmente monolítico) | Alto esforço |
| DT-02 | Sem testes automatizados para cálculos financeiros | Média | Médio esforço |
| DT-03 | Google Sheets como banco — sem transações, sem índices | Alta (estrutural) | Migração Fase 3 |
| DT-04 | `DIFERENCA_RECEBIDA` — 81 registros históricos com campo legado | Baixa (documentado, não causa problemas) | Baixo |
| DT-05 | GAS sem versionamento automático | Média | Médio |
| DT-06 | EFI_* colunas sem backfill em contratos anteriores ao PIX | Baixa | Médio |
| DT-07 | Rate limiting ausente nas API routes | Média | Baixo |
| DT-08 | Token ZapSign hardcoded no GAS | Média | Baixo |

---

## MELHORIAS IDENTIFICADAS

### UX

- Formulário de cadastro standalone (não depender do Google Forms)
- Confirmação visual após cada ação de cobrança (toast)
- Modo de visualização mobile aprimorado (atualmente funcional mas não otimizado)
- Filtros salvos por sessão (cobrança, contratos)

### Financeiras

- DRE mensal provisionado (com PDD distribuído mês a mês)
- Relatório de fluxo de caixa projetado (parcelas futuras)
- Alertas automáticos para contratos em acordo_assistido próximos de expirar (160+ dias)
- Exportação de dados para análise externa (CSV)

### Operacionais

- Backfill de JUROS_TOTAL nos contratos com histórico de somente_juros
- Alertas para parcelas que vencerão nos próximos 7 dias (notificação no Dashboard)
- Log de auditoria visível no painel (aba EVENTOS)
- Campo "Próxima Ação" editável diretamente na aba Cobrança

### Técnicas

- Migração para Supabase (banco relacional com RLS, triggers, funções)
- Separação de `main.jsx` em módulos por domínio (Fase 3)
- Testes automatizados para cálculos financeiros críticos
- Rate limiting nas API routes
- Invalidação de cache após webhook de pagamento

---

## OPORTUNIDADES DE CRESCIMENTO

| Oportunidade | Descrição | Complexidade | Impacto |
|---|---|---|---|
| Portal do cliente | PWA para clientes verem parcelas e baixar comprovantes | Alta | Alto |
| Negativação/protesto | Integração com SPC/Serasa via API | Muito alta | Alto |
| Programa de padrinhos | Dashboard para padrinhos acompanharem indicações | Média | Médio |
| Expansão de produtos | Crédito consignado, empréstimo com garantia | Alta | Muito alto |
| Equipe operacional | Multi-usuário com roles (consultor, operador) | Alta | Alto |
| API pública | Integração com outros sistemas financeiros | Muito alta | Médio |

---

## AUDITORIAS REALIZADAS

### Auditoria QA UI — 2026-06-09

**Escopo:** Interface completa, UX, componentes visuais  
**Resultado:** 9 bugs corrigidos (Simulador ×5, Acordo Assistido UI, ContratoModal, Quitação Antecipada)  
**Responsável:** Claude Code

### Auditoria Financeira — 2026-06-14

**Escopo:** Cálculos financeiros, KPIs, totalizadores  
**Resultado:** 5 bugs corrigidos (chartData, totaisFin, LUCRO_TOTAL, TAXA_ADIMPLENCIA_REAL, vAtrasoTotal)  
**Responsável:** Claude Code

### Auditoria Forense — 2026-06-15

**Escopo:** Integridade de dados, automações, integração Evolution GO  
**Resultado:** 11 problemas encontrados, 10 resolvidos, 1 aberto (BUG-01 JUROS_TOTAL)  
**Responsável:** Claude Code

### Auditoria Estrutural — 2026-06-15

**Escopo:** Constantes duplicadas, campos legado, colunas nunca calculadas  
**Resultado:** 10 inconsistências, todas resolvidas  
**Responsável:** Claude Code  
**Diagnóstico banco:** 0 ocorrências de valores legado — banco limpo

### Próxima auditoria planejada

- **Quando:** Dez/2026 (revisão de PDD) ou após próxima feature significativa
- **Escopo sugerido:** Performance da régua de cobrança, integridade de novos registros, revisão de percentuais PDD

---

## LIÇÕES APRENDIDAS

### Técnicas

1. **`new Date("YYYY-MM-DD")` em JavaScript causa bug de timezone no Brasil (UTC-3)** — sempre usar `parseDateLocal()` no GAS e `parseDate()` no frontend. Esta armadilha voltou a surgir 3 vezes durante o desenvolvimento.

2. **Colunas no GAS devem sempre ser acessadas por nome (`buildColMap`), nunca por índice numérico** — um índice errado (`VALOR` em vez de `VALOR_PARCELA`) causou o bug mais grave da régua de cobrança (valores R$ 5/7 nas mensagens).

3. **Evolution GO tem API completamente diferente da versão open-source** — endpoint, body e autenticação diferentes. Documentar isso claramente evita horas de debug futuro.

4. **Status terminais de parcela nunca devem ser reabertos automaticamente** — a regra parece óbvia mas esquecê-la causa inconsistências difíceis de detectar.

5. **Constantes de status definidas em múltiplos lugares causam bugs silenciosos** — sempre usar constante global única `_ST_ATIVOS`, `_ST_TERMINAL`, etc.

6. **Cache sem TTL faz o usuário trabalhar com dados stale** — o bug de dados antigos foi descoberto tarde; TTL de 5 minutos é o mínimo aceitável.

7. **AbortController é essencial em fetches concorrentes** — sem ele, uma resposta antiga pode sobrescrever o estado atual com dados desatualizados.

### Operacionais

1. **Deduplicação de mensagens WhatsApp deve bloquear apenas envios bem-sucedidos, não erros** — `_jaEnviouHoje()` bloqueando em `ERRO_ENVIO` impediu reenvio para clientes que deveriam receber a cobrança.

2. **Dry-run precisa de guard explícito em todos os logs** — um `_logMensagem` sem `if (!dryRun)` poluiu o MENSAGENS e bloqueou envios reais.

3. **A Efí Bank rejeita `cobv` com data de vencimento no passado** — usar data de hoje como fallback quando a parcela já venceu.

4. **O Acordo Assistido não pode ser revertido automaticamente pelo trigger diário** — a lógica de recálculo de status por dias de atraso deve interceptar `acordo_assistido` antes de processar.

5. **`abatimento_acordo_assistido` nunca deve ser contabilizado como receita** — esta distinção contábil é crítica e foi violada em filtros que somavam todo o VALOR_PAGO de PAGAMENTOS.

### De Negócio

1. **O 1º contrato sempre tem limite de R$ 1.500, independente do score** — score alto no papel não substitui histórico real com a casa.

2. **Clientes `PERFIL_COBRANCA = EVASIVO` não devem receber mensagens automáticas** — a régua intensificaria o comportamento evasivo e desperdiçaria o canal de comunicação.

3. **Abatimentos em Acordo Assistido são Capital Recuperado, não receita** — esta distinção impacta o DRE e a gestão de risco da carteira.

---

## RECOMENDAÇÕES ESTRATÉGICAS

### Imediatas (0–30 dias)

1. **Formalizar juridicamente a operação** (Fase 0) — blocker legal que limita crescimento e expõe o operador
2. **Corrigir bug BUG-01** — atualizar JUROS_TOTAL ao registrar somente_juros; fazer backfill
3. **Mover token ZapSign do código para CONFIGURACOES** — reduz risco de exposição

### Curto prazo (1–3 meses)

4. **Implementar formulário de cadastro standalone** — remover dependência do Google Forms, que tem limitações de UX e não permite customização
5. **Criar alertas automáticos para acordos assistidos próximos de expirar** — contratos com 160+ dias sem abatimento devem alertar o operador
6. **Revisar percentuais de PDD v1.0** após 50 contratos encerrados — calibrar com dados mais recentes

### Médio prazo (3–6 meses)

7. **Iniciar planejamento da migração Supabase** — o Google Sheets atingirá seus limites operacionais com o crescimento da carteira; planejar antecipadamente evita crise
8. **Implementar testes automatizados** para os cálculos financeiros críticos (score, PDD, saldo devedor, baixa de prejuízo)
9. **Criar dashboard de acompanhamento da régua de cobrança** com métricas de conversão (mensagem → pagamento)

### Longo prazo (6–12 meses)

10. **Portal do cliente PWA** — com Supabase, viabilizar visualização de parcelas e download de comprovantes sem intermediação do Alex
11. **Avaliar integração com bureau de crédito** — mesmo que informal, ter acesso a dados de inadimplência melhora a qualidade da aprovação
12. **Programa formal de padrinhos** — dashboard para padrinhos acompanharem o status dos seus indicados; incentivo para novas captações

---

*Documento criado em 2026-06-17 pelo Claude Code. Atualizar continuamente com cada evolução do sistema.*  
*Preservar histórico. Nunca remover decisões antigas. Sempre registrar o motivo das mudanças.*
