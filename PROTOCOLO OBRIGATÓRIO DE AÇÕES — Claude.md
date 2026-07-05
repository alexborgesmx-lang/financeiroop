# PROTOCOLO OBRIGATÓRIO DE AÇÕES — Claude
## Sequência de Execução ao Final de Cada Implementação/Mudança

> **Aplicável a:** Todas as mudanças, implementações, correções e otimizações solicitadas pelo usuário.
> **Escopo:** Garantir qualidade, segurança, regressão zero e documentação atualizada.
> **Data de criação:** 2026-06-20

---

## FASE 1: PRÉ-TESTE (Antes de qualquer ação)

### 1.1 Backup e Snapshot
- [ ] **Backup automático do Google Sheets**
  - Executar: `gws sheets export <sheet-id> --format xlsx --output /home/ubuntu/backups/pre-impl-$(date +%Y%m%d-%H%M%S).xlsx`
  - Armazenar caminho do backup para possível rollback
  - Registrar timestamp exato do backup

- [ ] **Snapshot do código (Git)**
  - Se repositório Git existe: `git status && git diff > /tmp/changes-$(date +%s).patch`
  - Commit com mensagem: `[PRE-IMPL] Snapshot antes de mudança: <descrição>`
  - Armazenar hash do commit para rollback

- [ ] **Documentar estado inicial**
  - Listar todas as abas do Sheets afetadas
  - Registrar valores críticos (totalizadores, contadores, saldos)
  - Capturar screenshot do estado atual (se interface)

---

## FASE 2: EXECUÇÃO DA IMPLEMENTAÇÃO

### 2.1 Durante a implementação
- [ ] Seguir rigorosamente a especificação técnica
- [ ] Aplicar princípios: Clean Architecture, DDD, SOLID, KISS, DRY
- [ ] Adicionar logs/comentários explicativos no código
- [ ] Validar sintaxe antes de commitar

### 2.2 Após implementação (antes de testes)
- [ ] Commit com mensagem descritiva: `[IMPL] <descrição da mudança>`
- [ ] Verificar se há erros óbvios no console/logs
- [ ] Confirmar que nenhum arquivo crítico foi deletado

---

## FASE 3: TESTES FUNCIONAIS COMPLETOS

### 3.1 Teste da funcionalidade principal
- [ ] **Cenário Happy Path**
  - Executar fluxo principal com dados válidos
  - Verificar resultado esperado
  - Confirmar mensagens de sucesso

- [ ] **Cenários de erro**
  - Dados inválidos (vazio, formato errado, valores extremos)
  - Campos obrigatórios faltando
  - Limites de tamanho/quantidade
  - Caracteres especiais, acentos, emojis
  - Valores negativos, zero, muito grandes

- [ ] **Cenários de borda**
  - Primeiro registro da tabela
  - Último registro da tabela
  - Registro duplicado
  - Valores no limite exato (ex: comprometimento 35.00%)
  - Datas limítrofes (primeiro dia, último dia do mês/ano)

### 3.2 Teste de regressão (TODAS as funcionalidades afetadas)
- [ ] **Listar todas as funcionalidades que podem ser impactadas**
  - Diretas: módulos modificados
  - Indiretas: módulos que dependem dos modificados
  - Cascata: módulos que dependem dos indiretos

- [ ] **Para cada funcionalidade afetada:**
  - [ ] Executar fluxo completo
  - [ ] Verificar integridade de dados
  - [ ] Confirmar cálculos (se houver)
  - [ ] Validar status/estados
  - [ ] Testar permissões/acesso
  - [ ] Verificar relatórios/dashboards

### 3.3 Teste de integrações externas
- [ ] **Efí Bank (PIX)**
  - [ ] Gerar cobrança PIX (cobv)
  - [ ] Validar txid (formato 26 chars: FOP + contrato + P + parcela)
  - [ ] Verificar webhook de confirmação de pagamento
  - [ ] Testar com certificado correto (producao-849675-financeiroop.p12)
  - [ ] Validar juros (0,03% ao dia) e multa (10%)
  - [ ] Confirmar validade pós-vencimento (30 dias)

- [ ] **ZapSign (Assinatura eletrônica)**
  - [ ] Exportar contrato como PDF
  - [ ] Enviar para assinatura
  - [ ] Verificar link de assinatura
  - [ ] Confirmar que todos os 4 signatários recebem convite
  - [ ] Validar que selfie é obrigatória

- [ ] **Evolution API + Claude AI (WhatsApp)**
  - [ ] Triagem de lead: validar fluxo completo
  - [ ] Extração de contracheque: testar com diferentes formatos
  - [ ] Fuzzy match de padrinho: validar acurácia
  - [ ] Envio de mensagens: confirmar entrega
  - [ ] Webhook de resposta: processar corretamente

- [ ] **Google Forms (Cadastro)**
  - [ ] Submeter formulário
  - [ ] Verificar trigger onFormSubmit
  - [ ] Confirmar que linha é criada em CLIENTES com status `aguardando_conferencia`
  - [ ] Validar mapeamento de campos (sensível a acentos/case)

- [ ] **APIs externas (ViaCEP, BrasilAPI, AwesomeAPI, Nominatim)**
  - [ ] CEP → endereço (ViaCEP)
  - [ ] CNPJ → situação cadastral (BrasilAPI/ReceitaWS)
  - [ ] Coordenadas geográficas (AwesomeAPI ou Nominatim)
  - [ ] Tratamento de erros (API indisponível, dados não encontrados)

### 3.4 Teste de dados e integridade
- [ ] **Validar estrutura de dados**
  - [ ] Nenhuma coluna foi deletada
  - [ ] Nenhuma linha foi perdida
  - [ ] Tipos de dados estão corretos (texto, número, data, moeda)
  - [ ] Referências estrangeiras (FKs) ainda válidas

- [ ] **Validar cálculos financeiros**
  - [ ] Juros calculados corretamente
  - [ ] Multas calculadas corretamente
  - [ ] Totalizadores (TOTAL_PAGO, TOTAL_EMPRESTADO, etc) consistentes
  - [ ] ROI, LTV, ATRASO_MEDIO recalculados corretamente
  - [ ] Score recalculado corretamente

- [ ] **Validar status e transições**
  - [ ] Status de parcela válidos (nunca status terminal reaberto)
  - [ ] Status de contrato segue ciclo correto
  - [ ] Transições de status são válidas
  - [ ] Acordo Assistido: score congelado, parcelas não em cobrança

- [ ] **Validar audit trail**
  - [ ] Todos os eventos registrados em EVENTOS
  - [ ] Timestamp correto (UTC-3)
  - [ ] Valores antes/depois registrados
  - [ ] Nenhum registro deletado

### 3.5 Teste de performance
- [ ] **Tempo de resposta**
  - [ ] GAS doGet: < 5 segundos
  - [ ] GAS doPost: < 3 segundos
  - [ ] Frontend: carregamento < 2 segundos
  - [ ] Cálculos de score: < 1 segundo por cliente

- [ ] **Escalabilidade**
  - [ ] Testar com 100+ clientes
  - [ ] Testar com 1000+ parcelas
  - [ ] Testar com 10000+ eventos
  - [ ] Verificar se há slowdown progressivo

### 3.6 Teste de segurança
- [ ] **Autenticação**
  - [ ] Cookie `fp_session` válido (HMAC-SHA256)
  - [ ] Sessão dura 30 dias
  - [ ] Logout limpa cookie
  - [ ] Acesso sem sessão é bloqueado

- [ ] **Autorização**
  - [ ] Apenas Alex pode acessar (usuário único)
  - [ ] Rotas protegidas: login, logout, whatsapp, webhook-efi são exceções
  - [ ] Middleware bloqueia rotas desprotegidas

- [ ] **Dados sensíveis**
  - [ ] CPF, RG, telefone não são expostos em logs públicos
  - [ ] Certificado Efí Bank não é commitado (gitignore)
  - [ ] Tokens de API não são hardcoded (env vars)
  - [ ] ZapSign token está seguro

- [ ] **Validação de entrada**
  - [ ] SQL injection: impossível (Google Sheets não é SQL)
  - [ ] XSS: validar que inputs são escapados
  - [ ] CSRF: validar tokens se aplicável
  - [ ] Rate limiting: proteger endpoints públicos (whatsapp, webhook)

### 3.7 Teste de UX
- [ ] **Interface**
  - [ ] Componentes renderizam corretamente
  - [ ] Cores seguem semântica (GRN=positivo, RED=negativo, etc)
  - [ ] Dark/light mode funciona (toggle às 18h)
  - [ ] Responsividade (mobile, tablet, desktop)
  - [ ] Sem erros de console

- [ ] **Fluxo do usuário**
  - [ ] Ações são intuitivas
  - [ ] Mensagens de erro são claras
  - [ ] Estados vazios têm placeholder
  - [ ] Estados de carregamento são visíveis
  - [ ] Confirmações antes de ações destrutivas

- [ ] **Acessibilidade**
  - [ ] Contraste suficiente
  - [ ] Inputs têm labels
  - [ ] Navegação por teclado funciona
  - [ ] Sem erros de a11y

---

## FASE 4: VALIDAÇÃO DE CENÁRIOS REAIS

### 4.1 Fluxos completos de negócio
- [ ] **Captação → Cadastro → Contrato → Pagamento → Quitação**
  - Executar fluxo completo com dados reais
  - Verificar cada etapa

- [ ] **Inadimplência → Cobrança → Acordo Assistido**
  - Simular atraso
  - Testar régua de cobrança
  - Testar entrada em Acordo Assistido
  - Testar abatimento
  - Testar retorno à cobrança

- [ ] **Baixa como Prejuízo → Recuperação**
  - Simular baixa
  - Registrar recuperação parcial
  - Verificar cálculos

- [ ] **Renegociação com Desconto**
  - Criar acordo com perda
  - Validar descontos
  - Verificar registro em ACORDOS

### 4.2 Cenários de concorrência
- [ ] **Múltiplos pagamentos simultâneos**
  - Simular 2+ pagamentos do mesmo cliente ao mesmo tempo
  - Verificar se há race condition
  - Validar integridade de dados

- [ ] **Trigger diário + ação manual simultânea**
  - Simular trigger às 7h enquanto Alex registra pagamento
  - Verificar se há conflito
  - Validar que dados finais estão corretos

### 4.3 Cenários de exceção
- [ ] **Cliente sem contratos**
- [ ] **Contrato sem parcelas (erro de criação)**
- [ ] **Parcela sem cliente (FK quebrada)**
- [ ] **Pagamento duplicado**
- [ ] **Valor pago maior que dívida total**
- [ ] **Data de pagamento no futuro**
- [ ] **Status inválido**

---

## FASE 5: ROLLBACK (Se falhas críticas)

### 5.1 Critério de rollback automático
Reverter automaticamente se:
- [ ] Falha que impede operação normal (ex: sistema não carrega)
- [ ] Perda de dados (ex: coluna deletada, registros zerados)
- [ ] Erro de cálculo financeiro (ex: juros calculados errado)
- [ ] Falha de integração crítica (ex: Efí Bank não funciona)
- [ ] Segurança comprometida (ex: autenticação quebrada)

### 5.2 Procedimento de rollback
- [ ] Restaurar backup do Google Sheets: `gws sheets import <backup-file>`
- [ ] Reverter código: `git revert <commit-hash>`
- [ ] Verificar que sistema voltou ao estado anterior
- [ ] Registrar motivo do rollback
- [ ] Notificar usuário com relatório de falha

### 5.3 Falhas não-críticas
- [ ] Documentar em relatório
- [ ] Não reverter automaticamente
- [ ] Aguardar instrução do usuário
- [ ] Sugerir correção

---

## FASE 6: ATUALIZAÇÃO DE DOCUMENTAÇÃO

### 6.1 Atualizar BUSINESS_CONTEXT.md
- [ ] Adicionar/atualizar descrição da funcionalidade
- [ ] Atualizar stack tecnológico se houve mudança
- [ ] Atualizar integrações se houve mudança
- [ ] Atualizar roadmap se aplicável
- [ ] Atualizar data de referência

### 6.2 Atualizar MANUAL_OPERACIONAL.md
- [ ] Adicionar/atualizar fluxo operacional
- [ ] Adicionar/atualizar estrutura de dados (colunas novas)
- [ ] Adicionar/atualizar regras de negócio
- [ ] Adicionar/atualizar ciclo de status
- [ ] Adicionar/atualizar operações de pagamento
- [ ] Atualizar data de referência

### 6.3 Atualizar 02-AI-CREDIT-RULES.md
- [ ] Se houver mudança em regras de crédito/score

### 6.4 Atualizar 03-AI-FINANCIAL-CALCULATIONS.md
- [ ] Se houver mudança em cálculos financeiros

### 6.5 Atualizar 07-AI-KNOWN-ISSUES.md
- [ ] Adicionar issues encontradas durante testes
- [ ] Adicionar workarounds se houver

### 6.6 Commit de documentação
- [ ] `git add docs/`
- [ ] `git commit -m "[DOCS] Atualizar documentação após mudança: <descrição>"`

---

## FASE 7: RELATÓRIO FINAL (Checklist)

### 7.1 Estrutura do relatório
```
RELATÓRIO DE IMPLEMENTAÇÃO — [Data/Hora]
═══════════════════════════════════════════

📋 RESUMO EXECUTIVO
├─ Funcionalidade: [descrição]
├─ Status: ✅ SUCESSO / ⚠️ SUCESSO COM AVISOS / ❌ FALHA
├─ Tempo total: [X minutos]
└─ Rollback necessário: SIM / NÃO

✅ TESTES FUNCIONAIS
├─ Happy Path: ✅ PASSOU
├─ Cenários de erro: ✅ PASSOU (X testes)
├─ Cenários de borda: ✅ PASSOU (X testes)
└─ Resultado: ✅ 100% passou

🔄 TESTES DE REGRESSÃO
├─ Funcionalidades afetadas: [lista]
├─ Testes executados: X
├─ Testes falhados: 0
└─ Resultado: ✅ 100% passou

🔗 TESTES DE INTEGRAÇÃO
├─ Efí Bank: ✅ PASSOU
├─ ZapSign: ✅ PASSOU
├─ Evolution API: ✅ PASSOU
├─ Google Forms: ✅ PASSOU
├─ APIs externas: ✅ PASSOU
└─ Resultado: ✅ 100% passou

📊 TESTES DE DADOS
├─ Integridade: ✅ PASSOU
├─ Cálculos: ✅ PASSOU
├─ Status/transições: ✅ PASSOU
├─ Audit trail: ✅ PASSOU
└─ Resultado: ✅ 100% passou

⚡ PERFORMANCE
├─ GAS doGet: [X]ms (< 5s) ✅
├─ GAS doPost: [X]ms (< 3s) ✅
├─ Frontend: [X]ms (< 2s) ✅
├─ Score: [X]ms (< 1s) ✅
└─ Escalabilidade: ✅ OK

🔒 SEGURANÇA
├─ Autenticação: ✅ OK
├─ Autorização: ✅ OK
├─ Dados sensíveis: ✅ OK
├─ Validação: ✅ OK
└─ Resultado: ✅ 100% passou

🎨 UX
├─ Interface: ✅ OK
├─ Fluxo: ✅ OK
├─ Acessibilidade: ✅ OK
└─ Resultado: ✅ 100% passou

🔀 CENÁRIOS REAIS
├─ Fluxo captação→quitação: ✅ PASSOU
├─ Fluxo inadimplência: ✅ PASSOU
├─ Fluxo baixa→recuperação: ✅ PASSOU
├─ Concorrência: ✅ OK
└─ Exceções: ✅ OK

📝 DOCUMENTAÇÃO
├─ BUSINESS_CONTEXT.md: ✅ Atualizado
├─ MANUAL_OPERACIONAL.md: ✅ Atualizado
├─ 02-AI-CREDIT-RULES.md: ✅ Atualizado
├─ 03-AI-FINANCIAL-CALCULATIONS.md: ✅ Atualizado
├─ 07-AI-KNOWN-ISSUES.md: ✅ Atualizado
└─ Git commit: ✅ [hash]

⚠️ AVISOS / OBSERVAÇÕES
├─ [Se houver]
└─ [Se houver]

🐛 ISSUES ENCONTRADAS
├─ [Se houver]
└─ [Se houver]

✨ PRÓXIMOS PASSOS
├─ [Se houver]
└─ [Se houver]

═══════════════════════════════════════════
Gerado em: [timestamp]
Backup: /path/to/backup.xlsx
Git commit: [hash]
```

### 7.2 Enviar relatório
- [ ] Salvar em `/home/ubuntu/projects/conselho-estrat-gico-do-sistema--3c0884ca/relatorios/impl-[data-hora].md`
- [ ] Exibir para usuário via `message` tool com tipo `result`

---

## FASE 8: PÓS-IMPLEMENTAÇÃO

### 8.1 Monitoramento
- [ ] Observar sistema por 24h
- [ ] Registrar qualquer comportamento anômalo
- [ ] Estar pronto para rollback rápido

### 8.2 Feedback do usuário
- [ ] Aguardar feedback do usuário
- [ ] Se houver problemas: executar rollback + análise de causa raiz

---

## RESUMO RÁPIDO (Checklist para usar em cada sessão)

```
☐ PRÉ-TESTE
  ☐ Backup Google Sheets
  ☐ Snapshot Git
  ☐ Documentar estado inicial

☐ IMPLEMENTAÇÃO
  ☐ Executar mudança
  ☐ Commit Git
  ☐ Verificar erros óbvios

☐ TESTES (Completos)
  ☐ Happy Path
  ☐ Erros
  ☐ Borda
  ☐ Regressão (TODAS funcionalidades)
  ☐ Integrações (Efí, ZapSign, Evolution, Forms, APIs)
  ☐ Dados e integridade
  ☐ Performance
  ☐ Segurança
  ☐ UX
  ☐ Cenários reais
  ☐ Concorrência
  ☐ Exceções

☐ ROLLBACK (Se necessário)
  ☐ Restaurar backup
  ☐ Reverter Git
  ☐ Verificar estado anterior

☐ DOCUMENTAÇÃO
  ☐ Atualizar BUSINESS_CONTEXT.md
  ☐ Atualizar MANUAL_OPERACIONAL.md
  ☐ Atualizar 02-AI-CREDIT-RULES.md
  ☐ Atualizar 03-AI-FINANCIAL-CALCULATIONS.md
  ☐ Atualizar 07-AI-KNOWN-ISSUES.md
  ☐ Commit documentação

☐ RELATÓRIO
  ☐ Gerar checklist completo
  ☐ Enviar para usuário
```

---

## NOTAS IMPORTANTES

- **Execução obrigatória**: Este protocolo é executado ao final de TODA implementação/mudança.
- **Sem exceções**: Não pular etapas, mesmo que pareçam triviais.
- **Automatização**: Máximo de automação possível (scripts, APIs, etc).
- **Documentação**: Sempre atualizar documentos do projeto.
- **Segurança**: Nunca commitar dados sensíveis ou credenciais.
- **Comunicação**: Informar usuário de qualquer desvio ou problema.
- **Rollback**: Sempre reverter em caso de falha crítica.

---

**Versão:** 1.0  
**Data de criação:** 2026-06-20  
**Última atualização:** 2026-06-20  
**Responsável:** Claude (Manus)
