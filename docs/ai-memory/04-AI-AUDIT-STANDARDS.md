# PADRÕES DE AUDITORIA — FINANCEIROOP

## Contexto Obrigatório — Leia antes de auditar

| Item | Realidade do projeto |
|---|---|
| Linguagem | **JavaScript** (não TypeScript). Arquivos `.jsx` e `.js`. Sem tipos, interfaces ou `any`. |
| Banco de dados | **Google Sheets** (não Supabase, não SQL). RLS/Policies não existem ainda. |
| Uploads | **Não há uploads**. Sistema gera PDFs via jsPDF e lê/escreve Google Sheets. |
| Arquitetura frontend | **Monolito intencional** — tudo em `src/main.jsx`. Não sugerir splits em libs/services/containers. |
| Estado | **useState local** por design. Não sugerir Zustand ou Context migration sem pedido explícito. |

---

Sempre que analisar qualquer funcionalidade, módulo, componente, API, página, hook, serviço ou fluxo do sistema, execute obrigatoriamente todas as verificações abaixo.

Não faça análises superficiais.

Percorra todos os arquivos relacionados direta e indiretamente.

Mapeie dependências, impactos e possíveis efeitos colaterais.

Para cada problema encontrado informe:

- Severidade
- Localização
- Impacto
- Solução recomendada
- Esforço estimado
- Arquivos afetados

---

## MÓDULO 1 — ARQUITETURA REACT

Verifique:

- Hooks chamados condicionalmente
- Hooks dentro de loops
- Dependências incorretas em useEffect
- Dependências incorretas em useMemo
- Dependências incorretas em useCallback
- Excesso de useState
- Casos que deveriam utilizar useReducer
- Hooks reutilizáveis não extraídos

Identifique oportunidades para:

- Custom Hooks
- Separação de responsabilidades
- Componentização
- Melhor testabilidade

---

## MÓDULO 2 — QUALIDADE DE CÓDIGO JAVASCRIPT

⚠️ Projeto usa JavaScript puro (não TypeScript). Não recomendar migração TS salvo pedido explícito.

Audite:

- JSDoc ausente em funções críticas de negócio
- Variáveis sem nome descritivo (`x`, `tmp`, `data2`)
- Funções com mais de 40 linhas sem justificativa
- Callbacks aninhados além de 3 níveis
- Uso de `eval()` ou construção dinâmica de código

Recomende:

- Nomes de variáveis autodocumentados
- Extração de funções utilitárias quando há lógica repetida
- JSDoc em funções de cálculo financeiro

---

## MÓDULO 3 — SEPARAÇÃO DE RESPONSABILIDADES

⚠️ A arquitetura do projeto é **monolítica por decisão**: tudo fica em `src/main.jsx`. Não sugerir extração para arquivos separados, containers ou camadas de serviço salvo pedido explícito.

Dentro do monolito, identifique:

- Regras de negócio misturadas com lógica de renderização (extrair para funções utilitárias dentro do mesmo arquivo)
- Chamadas `postAction()` duplicadas sem abstração
- Validações repetidas sem função utilitária comum
- Cálculos financeiros espalhados em múltiplos handlers

Sugira apenas:

- Funções utilitárias dentro de `src/main.jsx`
- Agrupamento lógico de handlers relacionados
- Constantes extraídas para o topo do arquivo

---

## MÓDULO 4 — GERENCIAMENTO DE ESTADO

⚠️ Projeto usa `useState` local por convenção. Não sugerir Zustand, Redux, Context API ou migração de estado sem pedido explícito.

Verifique:

- Estado duplicado (mesma informação em dois `useState` diferentes)
- Estado derivado sendo armazenado (calcular no render, não armazenar)
- `useEffect` desnecessário para atualizar estado a partir de props
- Re-renders excessivos por estado mal posicionado

Sugira apenas:

- Consolidação de estados relacionados em um único objeto `useState`
- Extração de estado derivado para variáveis computadas no render
- `useMemo` para cálculos pesados baseados em estado

---

## MÓDULO 5 — TRATAMENTO DE ERROS

Verifique:

- APIs sem try/catch
- Erros silenciosos
- Logs insuficientes
- Falta de feedback visual
- Fluxos sem recuperação

Sugira:

- Error Boundaries
- Tratamento centralizado
- Estratégias de fallback

---

## MÓDULO 6 — CÓDIGO MORTO

Identifique:

- Imports não utilizados
- Componentes abandonados
- Funções sem uso
- Estados inúteis
- Código comentado

Gerar plano de remoção segura.

---

## MÓDULO 7 — REFATORAÇÃO DRY

Identifique:

- Funções duplicadas
- Componentes duplicados
- Validações repetidas
- Consultas repetidas
- Cálculos repetidos

Para cada ocorrência:

- Localização
- Quantidade de repetições
- Estratégia de unificação

Sugira:

- Utilitários
- Hooks
- Componentes compartilhados

---

## MÓDULO 8 — SEGURANÇA

⚠️ Projeto não usa SQL. Vetores relevantes são diferentes dos sistemas tradicionais.

Auditar:

- **Hardcoded secrets**: tokens, chaves de API, senhas em código-fonte ou comentários
- **Credenciais em repositório**: `producao-849675-financeiroop.p12`, `twilio_2FA_recovery_code.txt` (devem estar no `.gitignore`)
- **XSS**: conteúdo do Sheets renderizado sem sanitização no frontend
- **CSRF**: endpoints Vercel sem validação de origem
- **Exposição de dados sensíveis**: CPF, RG, dados financeiros logados no console ou retornados desnecessariamente
- **Injeção no GAS**: fórmulas ou expressões injetadas via dados do formulário que o GAS executa
- **Env vars**: `EFI_CLIENT_ID`, `EFI_CLIENT_SECRET`, `LOGIN_PASSWORD`, `LOGIN_SECRET`, `TWILIO_*`, `ANTHROPIC_API_KEY` — nunca em código, sempre em Vercel env

Verificar:

- `.gitignore` cobre certificado P12 e arquivo de recovery 2FA
- Middleware protege todas as rotas exceto `/api/login`, `/api/logout`, `/api/whatsapp`
- Cookie `fp_session` usa HMAC-SHA256 e tem `httpOnly`, `secure`, `sameSite`

---

## MÓDULO 9 — AUTENTICAÇÃO E AUTORIZAÇÃO

Validar:

- Controle de acesso
- Roles
- Permissões
- Ownership
- Expiração de sessão
- Logout seguro
- Middleware de proteção

Aplicar princípio do menor privilégio.

---

## MÓDULO 10 — GERAÇÃO DE DOCUMENTOS

⚠️ O sistema não tem upload de arquivos. O vetor relevante é a geração de PDFs e documentos.

Verificar:

- **jsPDF**: dados do Sheets (nomes, valores, datas) renderizados corretamente sem truncamento
- **Comprovantes PDF**: padrão de timing pré/pós-pagamento respeitado (ver `07-AI-KNOWN-ISSUES.md`)
- **Google Docs (ZapSign)**: exportação PDF do template do contrato sem dados corrompidos
- **Carnê PIX (Efí)**: geração de `cobv` com CPF sempre 11 dígitos (`padStart(11, "0")`)
- **Dados sensíveis em PDF**: CPF, RG aparecem apenas onde necessário

---

## MÓDULO 11 — BANCO DE DADOS (GOOGLE SHEETS)

⚠️ Banco de dados atual é Google Sheets via Google Apps Script. Supabase está planejado para Fase 3 (pendente) — não recomendar configuração Supabase como se já existisse.

Auditar:

- **Índice fixo de coluna**: código que usa posição numérica em vez de `buildColMap()` + nome
- **Datas sem `parseDateLocal`**: qualquer `new Date("YYYY-MM-DD")` que cause bug de timezone
- **IDs manuais**: geração de ID sem `proximoIdSeq()` (risco de duplicata)
- **Leitura de linha sem `buildColMap`**: acesso a `row[n]` em vez de `row[cm["COLUNA"]]`
- **Integridade relacional**: parcela sem contrato, pagamento sem parcela — verificar no GAS
- **Escrita sem `setCel`**: modificação direta de célula por índice numérico
- **Trigger diário**: `atualizarStatusParcelas()` + `atualizarStatusContratos()` devem estar ativos às 7h

Gerar código GAS corretivo quando necessário (não SQL).

---

## MÓDULO 12 — TESTES

Identificar áreas sem cobertura.

Priorizar:

- Contratos
- Parcelas
- Pagamentos
- Cobranças
- Dashboard
- Autenticação
- Fluxos financeiros

Gerar:

- Testes unitários
- Testes integração
- Testes regressão

---

## MÓDULO 13 — OBSERVABILIDADE

Verificar:

- Logging
- Monitoramento
- Request ID
- Health Checks
- Métricas
- Performance
- Alertas

Sugira melhorias de rastreabilidade.

---

## MÓDULO 14 — PRODUCTION READINESS

Antes de qualquer deploy:

Verificar:

- Dependências vulneráveis
- Rotas de teste
- Mocks esquecidos
- Credenciais expostas
- Código temporário
- Bypass de segurança

Gerar checklist de deploy.

---

## MÓDULO 15 — FINANCEIROOP (ESPECÍFICO)

Toda análise deve considerar:

- Integridade financeira
- Integridade dos contratos
- Integridade das parcelas
- Integridade dos pagamentos
- Consistência de saldos
- Histórico financeiro
- Auditoria das operações

Nenhuma alteração pode modificar cálculos financeiros sem validação explícita.

**Auditoria automática complementar (2026-07-04):** `auditarIntegridadeSistema()` no GAS roda todo dia às 07:05 e varre relacionamentos órfãos, status de parcela/contrato inconsistente, duplicidade de pagamento, TXID Efí duplicado, matemática de contrato (`VALOR_TOTAL` vs soma das parcelas) e campos derivados de CLIENTES. Gera score 0–100 e grava tudo na aba `AUDITORIA` — mesma escala de severidade (CRITICO/ALTO/MEDIO/BAIXO) usada nos critérios abaixo. É diagnóstico automático contínuo, não substitui o audit manual (`/ultrareview-financeiroop`) nem corrige nada sozinho — sempre checar a aba `AUDITORIA` antes de auditorias manuais para não repetir achado já conhecido.

Sempre apresentar:

1. Problemas encontrados
2. Riscos
3. Melhorias recomendadas
4. Refatorações DRY
5. Plano de implementação
6. Checklist de testes
7. Impacto no negócio

---

## Critérios de Severidade

| Severidade | Descrição |
|---|---|
| Crítico | Afeta integridade financeira ou histórico |
| Alto | Afeta operação do sistema |
| Médio | Afeta dados mas não financeiro |
| Baixo | Inconsistência cosmética ou de processo |

---

## Histórico de Incidentes

<!-- Registrar aqui incidentes encontrados nas auditorias -->
