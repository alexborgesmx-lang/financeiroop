# Plano de Reformulação de PDFs — Borges Assessoria

Este documento estabelece as diretrizes e a estrutura para a reformulação dos 5 PDFs gerados pelo sistema, alinhando-os ao Manual de Identidade Visual e ao DESIGN_SYSTEM.md.

> **Status (2026-07-04):** o acesso a `src/main.jsx` deixou de ser uma lacuna — os 5 PDFs já existiam em produção antes deste documento ser escrito (ver `BUSINESS_CONTEXT.md` §7). O **Extrato do Contrato (§3.3)** foi redesenhado nesta data seguindo exatamente esta diretriz, com extensões além do escopo original aqui descrito (consciência do módulo de Recuperação Judicial + timeline "Percurso do Contrato"). Padrão final documentado em `DESIGN_SYSTEM.md` §20.

## 1. Diagnóstico Atual
- **Problema:** O sistema gera 5 PDFs diferentes via jsPDF (`main.jsx`), sem padronização visual clara ou aderência total à nova identidade "Premium" da Borges Assessoria.
- **Inconsistências:** Os documentos não transmitem a "sensação de controle e precisão" exigida pelo manual. A hierarquia de informações pode estar confusa e o uso da paleta de cores (Verde Borges, Verde-sinal, Verde-limão) não está padronizado.
- **Lacuna Crítica:** Falta o código-fonte `main.jsx` no ambiente atual para realizar a implementação técnica, mas o padrão visual e estrutural pode ser definido imediatamente com base nos HTMLs de referência.

## 2. Padrão Único de Design (Diretrizes)

Todos os PDFs devem seguir estritamente o "Padrão Premium" da marca:
- **Limpeza:** Fundo branco (`#FFFFFF`) para impressão limpa. Máximo de 3 cores semânticas. Sem bordas desnecessárias.
- **Organização:** 
  - Cabeçalho padronizado (Logo + "Borges Assessoria" + Subtítulo do documento).
  - Informações em blocos/grids lógicos (ex: dados do cliente separados dos dados financeiros).
  - Rodapé padronizado (CNPJ, site, autenticação digital, paginação).
- **Hierarquia Tipográfica:**
  - Valores financeiros em destaque (maior peso, tabular-nums).
  - Labels em uppercase, fonte menor e cor `MUTED` (`#6E7975`).
  - Fonte base: Helvetica Neue (simulada no jsPDF).
- **Cores (Paleta Canônica):**
  - Institucional/Cabeçalhos: Verde Borges (`#0B3D2E`).
  - Destaques Positivos/Dados: Verde-sinal (`#1FB877`).
  - Alertas/Atrasos: Alert Red (`#D64545` ou `#C0322F`).
  - Texto principal: Ink (`#121815`).
  - Texto secundário/Labels: Muted (`#6E7975`).

## 3. Estrutura de Conteúdo por PDF

### 3.1. Comprovante de Pagamento de Parcela
- **Objetivo:** Atestar o recebimento de uma parcela específica.
- **Estrutura:**
  1. **Cabeçalho:** Logo + "Comprovante de Pagamento".
  2. **Destaque Central:** Ícone de sucesso (Verde-OK), "Pagamento confirmado", Valor Pago em destaque, "Parcela X de Y".
  3. **Bloco de Dados (Grid/Linhas):** Cliente, CPF, Contrato, Forma de Pagamento, Data/Hora, Vencimento Original, Saldo Devedor Após, ID da Transação.
  4. **Rodapé:** Dados da empresa, hash de autenticação, aviso legal.

### 3.2. Comprovante de Quitação
- **Objetivo:** Atestar a quitação total do contrato (Nada Consta).
- **Estrutura:**
  1. **Cabeçalho:** Logo + "Comprovante de Quitação".
  2. **Marca d'água/Carimbo:** "QUITAÇÃO TOTAL - NADA CONSTA" (com leve rotação, Verde-sinal ou Verde Borges).
  3. **Declaração Legal:** Texto formal atestando a quitação.
  4. **Bloco de Resumo:** Cliente, Contrato, Valor Principal, Total Pago, Parcelas (ex: 12 de 12), Período, Data da Quitação.
  5. **Rodapé:** Assinatura digital/autenticação, dados da empresa.

### 3.3. Extrato do Contrato — ✅ Implementado (2026-07-04)
- **Objetivo:** Visão completa do andamento do contrato (parcelas pagas, abertas, atrasadas) — e, quando aplicável, de toda a jornada até um encerramento judicial.
- **Estrutura final** (ver `DESIGN_SYSTEM.md` §20 para o detalhamento completo): Cabeçalho + banner de status (6 variantes, incluindo os 3 desfechos de Recuperação Judicial) + Dados do Cliente/Contrato + Dados do Processo Judicial (condicional) + Resumo do Contrato + Situação Financeira + Recuperação Judicial (condicional) + **Percurso do Contrato** (timeline cronológica completa, não previsto no escopo original) + Histórico de Pagamentos + Parcelas em Aberto + Rodapé.
- **Função:** `gerarExtratoPDF` em `src/main.jsx`.

### 3.4. Comprovante via Aba Financeiro
- **Objetivo:** Comprovante genérico de movimentação financeira.
- **Estrutura:** Similar ao Comprovante de Pagamento, mas adaptado para refletir a transação específica filtrada na aba Financeiro (pode incluir recebimentos extras ou abatimentos).

### 3.5. Relatório Financeiro
- **Objetivo:** Visão agregada de um período (DRE simplificado).
- **Estrutura:**
  1. **Cabeçalho:** Logo + "Relatório Financeiro" + Período de Referência.
  2. **KPIs Principais (Cards visuais):** Receita Total, Capital Recuperado, PDD (se aplicável), Lucro/Resultado.
  3. **Tabela Analítica:** Detalhamento das transações do período.
  4. **Rodapé:** Dados da empresa, paginação.

## 4. Plano de Implementação Técnica (jsPDF)

Como os PDFs são gerados via `jsPDF` no frontend (`main.jsx`), a implementação exigirá:
1. **Padronização de Fontes:** Garantir o uso de fontes sans-serif (Helvetica) e pesos adequados (normal, bold).
2. **Funções Auxiliares de Desenho:** Criar helpers no `main.jsx` para desenhar o cabeçalho padronizado, rodapé e blocos de dados (linhas zebradas ou com bordas sutis).
3. **Inclusão do Logo:** Usar a versão em base64 do símbolo ou logo horizontal para injetar no `jsPDF`.
4. **Cores:** Mapear os hexadecimais da paleta canônica para RGB no `jsPDF`.

## 5. Riscos e Alternativas
- **Risco:** O `jsPDF` puro é verboso e difícil de manter para layouts complexos.
- **Alternativa:** Se o layout ficar muito complexo para desenhar linha a linha no `jsPDF`, considerar a abordagem de gerar HTML oculto na tela e usar `html2canvas` + `jsPDF` (embora possa perder qualidade de texto selecionável). A recomendação primária é manter `jsPDF` nativo usando helpers estruturados para garantir texto vetorizado e leveza.

## Próximos Passos
Extrato do Contrato (§3.3) concluído em 2026-07-04. Restam, se desejado, revisões equivalentes dos demais PDFs (§3.1, 3.2, 3.4, 3.5) contra este mesmo padrão — nenhum deles foi tocado nesta rodada.
