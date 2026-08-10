# PROBLEMAS CONHECIDOS

Utilize este arquivo para registrar:

- Bugs conhecidos
- Decisões arquiteturais
- Limitações atuais
- Débitos técnicos
- Melhorias futuras

---

## Formato

```
## YYYY-MM-DD — Nome do Problema

### Problema
Descrição.

### Impacto
Descrição.

### Solução
Descrição.

### Status
Aberto | Em andamento | Resolvido
```

---

## Registro Ativo

## 2026-08-10 — rotinaDiaria falhou em cascata: "You do not have permission to access the requested document."

### Problema
Alex recebeu por WhatsApp (via `_notificarErroSistema`) 4+ avisos de erro seguidos às 07:09-07:10, todas com origem em sub-etapas de `rotinaDiaria` (`enviarReguaCobranca`, `atualizarStatusContratos`, `auditarIntegridadeSistema`, `verificarQuitacoesExpiradas`) e a mesma mensagem genérica do Google: `"You do not have permission to access the requested document."` — texto que não existe em nenhum lugar do nosso código (confirmado via grep em `appscript.gs`/`api/*.js`/`main.jsx`), ou seja, é erro nativo do Google, não bug de lógica nossa.

### Causa raiz
Conta Google do Alex estava com o **Drive 100% cheio**. O Google bloqueia qualquer gravação em Sheets/Docs/Slides (mesmo que a edição não use espaço extra) quando a cota de armazenamento estoura, e devolve um erro genérico de permissão em vez de identificar a causa como "sem espaço". Explica o padrão observado no log de Execuções (Apps Script): as duas primeiras etapas de `rotinaDiaria` (`_reRegistrarWebhookEfi`, `verificarPagamentosEfi`) rodaram normalmente porque não escrevem pesado na planilha logo de cara; as etapas seguintes, que gravam status/log/expiração em massa, foram bloqueadas em sequência.

### Solução
Alex comprou mais armazenamento Google e rodou `rotinaDiaria` manualmente pelo editor do Apps Script — concluiu em 45s sem erro, confirmando a causa. Nenhuma mudança de código foi necessária.

### Nota para o futuro
Se `_notificarErroSistema` disparar essa mensagem exata (`"You do not have permission to access the requested document."`) de novo, em qualquer função que grave no Sheets — **checar cota do Google Drive da conta antes de investigar como bug de código.** Não confundir com o gotcha de escopo OAuth (`script.scriptapp`, entrada 2026-07-22 abaixo) — mensagem de erro diferente (aquela cita explicitamente a permissão/escopo faltante).

### Status
Resolvido (2026-08-10)

---

## 2026-08-07 — Confirmação WPP da Renegociação falhava em silêncio

### Problema
`pagamentoRenegociacaoWebhook` (renegociação com entrada via PIX, ver `02-AI-CREDIT-RULES.md` e `03-AI-FINANCIAL-CALCULATIONS.md`) enviava a confirmação de WhatsApp pro cliente chamando `_enviarWppRegua(tel, texto)` direto, sem checar o valor de retorno (`true`/`false`) e sem logar em MENSAGENS. Primeiro uso em produção (contrato do Ronan Cássio Covolo da Silva, PCL-210): a renegociação foi processada corretamente (parcelas fechadas, carnê novo criado), mas a mensagem de confirmação não chegou ao cliente — e não havia nenhum rastro em lugar nenhum do sistema (só `Logger.log`, invisível pra qualquer um) pra saber que tinha falhado, muito menos por quê.

Efeito colateral relacionado: o GATILHO `"CONFIRMACAO_RENEGOCIACAO"` também não estava mapeado em `categG` (`src/main.jsx`, aba Régua WPP) — cairia no default vermelho "Erro" mesmo quando o envio desse certo, confundindo ainda mais o diagnóstico (mesmo problema visual que já existia pra qualquer GATILHO não mapeado, ex: `PIX_MANUAL`).

### Impacto
Cliente não avisado que a renegociação foi concluída e que vai receber PIX das novas parcelas. Sem visibilidade da falha, dependia do Alex notar a ausência da mensagem por conta própria (como aconteceu).

### Solução
`pagamentoRenegociacaoWebhook` agora: (1) checa o retorno de `_enviarWppRegua`; (2) loga em MENSAGENS via `_logMensagem` com `GATILHO="CONFIRMACAO_RENEGOCIACAO"` e `STATUS_ENVIO` `"ENVIADO"`/`"ERRO_ENVIO"` (mesmo padrão de toda outra mensagem do sistema — fica visível na aba Régua WPP); (3) chama `_notificarErroSistema` se o telefone não for encontrado ou se o envio falhar, avisando o Alex por e-mail (garantido) + WhatsApp (best-effort), mesmo padrão já usado em `enviarReguaCobranca`/`_enviarConfirmacaoPagamento`. `categG` no frontend passou a reconhecer `CONFIRMACAO_RENEGOCIACAO` como categoria "Confirmação" (verde), não mais "Erro" (vermelho) por default.

**Padrão a replicar:** qualquer envio de WhatsApp novo em fluxo automático (sem UI, sem alguém olhando na hora) deve sempre checar o retorno de `_enviarWppRegua`, logar em MENSAGENS via `_logMensagem`, e chamar `_notificarErroSistema` em caso de falha. Nunca disparar `_enviarWppRegua` "solto" só dentro de um `try/catch` com `Logger.log` — isso é invisível em produção.

### Status
Resolvido (2026-08-07) — ainda não existe um "reenviar confirmação de renegociação perdida" equivalente ao `reenviarConfirmacoesPendentes()` de pagamentos normais; se acontecer de novo, reenviar manualmente pelo WhatsApp do contrato.

---

## 2026-06-03 — Data um dia antes no Sheets

### Problema
`new Date("2026-05-30")` retorna UTC midnight → no Brasil (UTC-3) vira 29/05.

### Impacto
Datas de vencimento e pagamento gravadas com um dia a menos no Sheets.

### Solução
Sempre usar `parseDateLocal(s)` que cria `new Date(y, m, d, 12, 0, 0)`.

### Status
Resolvido (workaround em produção)

---

## 2026-06-03 — Parcela não some de "Em Atraso" após acordo

### Problema
`DATA_ACORDO` não era limpa no momento do pagamento.

### Impacto
Parcelas pagas continuavam aparecendo na aba de atraso.

### Solução
`registrarPagamentoAPI` limpa `DATA_ACORDO` ao pagar.

### Status
Resolvido

---

## 2026-06-03 — Contrato baixado ainda aparece em atraso

### Problema
Filtro `parcelasAtrasadas` verificava apenas STATUS da parcela, não do contrato.

### Impacto
Contratos com status terminal apareciam incorretamente na cobrança.

### Solução
`parcelasAtrasadas` filtra contratos com status terminal antes de listar parcelas.

### Status
Resolvido

---

## 2026-06-03 — TEL_PADRINHO vazio

### Problema
Nome digitado no formulário não bate exato com CLIENTES.

### Impacto
Campo TEL_PADRINHO fica vazio no cadastro do cliente indicado.

### Solução
Lookup fuzzy por substring + normalização de acentos no `onFormSubmit`.

### Status
Resolvido

---

## 2026-06-03 — Comprovante PDF — Timing do hist

### Problema
`hist` (parcelas do contrato) pode estar em dois estados ao gerar o PDF: pré-pagamento (antes do `carregar()`) ou pós-pagamento (depois do `carregar()`).

### Impacto
Contagens e totais incorretos no comprovante dependendo do contexto de geração.

### Solução
Detectar estado com `isAlreadyProcessed` antes de derivar totais:
```javascript
const currentInHist = hist.find(p => p.ID_PARCELA === parcela.ID_PARCELA);
const isAlreadyProcessed = isSomenteJuros && !!currentInHist && currentInHist.TIPO_PAGAMENTO === "somente_juros";
const totalParcEfetivo = (isSomenteJuros && !isAlreadyProcessed) ? hist.length + 1 : hist.length;
```

### Status
Resolvido

---

## 2026-06-05 — onFormSubmit: campos de endereço e contatos não chegavam em CLIENTES

### Problema
Três causas simultâneas impediam campos de chegar na aba CLIENTES:
1. Título da pergunta `DIA_VENCIMENTO_PREFERIDO` completamente diferente no Form vs GAS
2. Perguntas de contatos de confiança 1 tinham espaço extra no final do título no Form
3. `_soDigitos` apagava valores textuais legítimos como "Sem Número" e "Não consta" nos campos NUMERO, QUADRA, LOTE

### Impacto
Campos NUMERO, QUADRA, LOTE, CONTATO_CONFIANCA_1, TEL_CONFIANCA_1, DIA_VENCIMENTO_PREFERIDO chegavam vazios em CLIENTES mesmo com o cliente preenchendo o formulário completo.

### Solução
1. Função `v()` melhorada com fallback trim+lowercase+NFD (normaliza acentos) para tolerância a variações de título
2. Título de `DIA_VENCIMENTO_PREFERIDO` atualizado para o título real do formulário
3. `_soDigitos` removido de NUMERO, QUADRA, LOTE — esses campos aceitam texto

### Status
Resolvido (2026-06-05)

---

## 2026-06-10 — STATUS_CONTRATO preso em "ativo_em_dia" com todas parcelas pagas

### Problema
`atualizarStatusContratos` (trigger diário 7h) chama `maxDiasAtraso()`, que pula parcelas com status terminal ("pago", etc.). Se todas as parcelas estão pagas, retorna 0 dias → `statusPorDias(0)` = "ativo_em_dia" → nenhuma mudança. Contrato fica travado como ativo para sempre. Afetou PCL-92 (Pedro Henrique Gomes) e potencialmente outros contratos cujas parcelas foram marcadas diretamente no Sheets.

### Impacto
Divergência entre "Contratos Ativos" e "Clientes Ativos" na aba Gestão (104 vs 103 ativos). Contrato aparecia como ativo mesmo quitado.

### Solução
Fix em `atualizarStatusContratos` (appscript.gs): antes de chamar `maxDiasAtraso`, verificar se `parEncontradas > 0 && todasTerminal`. Se sim, setar STATUS_CONTRATO = "quitado" + STATUS_CARTEIRA = "quitada" e continuar. O trigger das 7h agora autocorrige contratos neste estado.

### Status
Resolvido (2026-06-10)

---

## 2026-06-10 — STATUS_CARTEIRA desatualizada em contratos quitados

### Problema
`registrarPagamentoAPI` setava `STATUS_CONTRATO = "quitado"` corretamente ao pagar a última parcela, mas nunca atualizava `STATUS_CARTEIRA`. Coluna ficava com valor "ativa" mesmo após quitação. Afetou PCL-31 (Eugênio de Sousa).

### Impacto
Inconsistência visual na planilha. Não impactava o sistema (STATUS_CARTEIRA não é lida em nenhuma lógica).

### Solução
Fix em `registrarPagamentoAPI`: `setCel STATUS_CARTEIRA "quitada"` junto com STATUS_CONTRATO ao detectar todasPagas. Fix adicional em `atualizarStatusContratos`: sincroniza STATUS_CARTEIRA para contratos já "quitados" que ainda tinham STATUS_CARTEIRA desatualizada.

### Status
Resolvido (2026-06-10)

---

## 2026-06-14 — BaixaModal subestimava capital recuperado em contrato acordo_assistido

### Problema
`BaixaModal` calculava `capitalRecuperado` somando parcelas com status "pago" via `pagasPs.reduce(...)`. Para contratos em `acordo_assistido`, nenhuma parcela tem status "pago" (abatimentos não alteram parcelas) — resultado era sempre zero.

### Impacto
PREJUIZO_CAPITAL ficava superestimado ao baixar um contrato em acordo_assistido. O operador via capital recuperado = R$0 mesmo tendo recebido abatimentos.

### Solução
`BaixaModal` detecta `isAcordoAssistido = contrato.STATUS_CONTRATO === "acordo_assistido"` e usa `VALOR_ABATIDO_ASSISTIDO` como `capitalRecuperado` nesse caso. Label do campo muda para "Capital Abatido (Acordo)" em BLU.

### Status
Resolvido (2026-06-14)

---

## 2026-06-14 — acordo_assistido sendo revertido pelo trigger diário

### Problema
O array `statusFinais` em `atualizarStatusContratos` não incluía `acordo_assistido`, então o loop de recálculo de status calculava os dias de atraso das parcelas abertas e movia o contrato de volta para `em_cobranca` ou `pre_prejuizo` automaticamente às 7h.

### Impacto
Contratos em acordo_assistido voltavam ao ciclo de cobrança no dia seguinte, desfazendo a ação manual do operador.

### Solução
Em `atualizarStatusContratos`, interceptar `acordo_assistido` **antes** do check de statusFinais:
```javascript
if (stAtual === "acordo_assistido") {
  // aplicar regra dos 180 dias
  // ... verificar último abatimento / DATA_ENTRADA_ACORDO_ASSISTIDO
  if (diasSem180 >= 180) {
    // mover para pre_prejuizo + registrar evento ACORDO_ASSISTIDO_EXPIRADO
  }
  continue; // pula o restante do loop — nunca recalcular por dias
}
```

### Status
Resolvido (2026-06-14)

---

## 2026-06-14 — PerdaAcoesModal não tinha acesso a dados do cliente

### Problema
`PerdaAcoesModal` recebia apenas `contrato` e `parcelas`. Não havia acesso ao PERFIL_COBRANCA do cliente para exibir o badge.

### Impacto
Badge de Perfil de Cobrança ausente no modal de perdas, prejudicando a visibilidade do perfil ao tomar decisões de cobrança.

### Solução
Adicionada prop `clientes` à assinatura de `PerdaAcoesModal`. Lookup interno:
```javascript
const cliPA = (clientes||[]).find(c => String(c.ID_CLIENTE) === String(contrato.ID_CLIENTE)) || null;
```
Chamada atualizada para passar `clientes={clientes||[]}`.

### Status
Resolvido (2026-06-14)

---

## 2026-06-14 — `recuperado_parcialmente` removia contrato do monitoramento diário

### Problema
`registrarRecuperacaoAposBaixa()` movia STATUS_CONTRATO para `recuperado_parcialmente` após qualquer recuperação parcial. Esse status estava em `statusFinais` em `atualizarStatusContratos()`, então o trigger das 7h pulava o contrato indefinidamente. PCL-85 e PCL-105 acumularam 142-234 dias de atraso sem nenhum alerta.

### Impacto
Contratos baixados com recuperação parcial desapareciam do radar de monitoramento. Prejuízo podia continuar crescendo sem visibilidade.

### Solução
`registrarRecuperacaoAposBaixa()`: recuperação parcial mantém `baixado_como_prejuizo`; só muda para `recuperado_integralmente` quando `novoPrejuizo <= 0`. Função `corrigirStatusRecuperacao()` adicionada para correção manual de contratos existentes. PCL-85 e PCL-105 corrigidos em 2026-06-14.

Frontend: `carteira` useMemo removeu `em_recuperacao`/`recuperado_parcialmente` de `cCirc` — contratos baixados não contam como capital em circulação.

### Status
Resolvido (2026-06-14)

---

## 2026-06-15 — Régua: valor errado nas mensagens e PIX

### Problema
`enviarReguaCobranca` lia `cmP["VALOR"]` para obter o valor da parcela. Como não existe coluna "VALOR" na aba PARCELAS (a coluna se chama "VALOR_PARCELA"), o índice caía para fallback incorreto — em alguns contextos lendo TOTAL_PARCELAS (5, 7, etc.). O mesmo valor errado era enviado para `_gerarPixAvulso` → PIX gerado com valor incorreto.

### Impacto
Primeiros envios reais tiveram valores "R$ 5,00" / "R$ 7,00" nas mensagens e PIX gerados com esses valores na Efí Bank.

### Solução
`ipVal = (cmP["VALOR_PARCELA"] || cmP["VALOR"] || 8)-1` — VALOR_PARCELA tem prioridade; fallback col 8 (posição padrão de VALOR_PARCELA no schema).

### Status
Resolvido (2026-06-15)

---

## 2026-06-15 — Régua: PIX 500 para parcelas vencidas

### Problema
`api/efi-pix-avulso.js` enviava `dataDeVencimento` com a data original da parcela. Para parcelas já vencidas, a Efí Bank rejeita cobv com data no passado (HTTP 500, `CobVOperacaoInvalida`).

### Impacto
PIX não era gerado para parcelas com D+1, D+3, D+7 — mensagem era enviada sem código PIX ou pulada com ERRO_SEM_PIX.

### Solução
Em `api/efi-pix-avulso.js`: `if (dataVenc < todayStr) dataVenc = todayStr` — usa data de hoje (horário BR: `Date.now() - 3h`) quando a parcela já venceu.

### Status
Resolvido (2026-06-15)

---

## 2026-06-15 — Régua: dry-run gravava erros no MENSAGENS

### Problema
O bloco `ERRO_SEM_PIX` em `enviarReguaCobranca` chamava `_logMensagem` sem verificar `dryRun`. No dry-run, erros eram gravados na aba MENSAGENS, fazendo os clientes aparecerem como "já recebeu hoje" nas execuções seguintes.

### Solução
`if (!dryRun) _logMensagem(...)` em todos os blocos de log de erro.

### Status
Resolvido (2026-06-15)

---

## 2026-06-15 — Régua: `_jaEnviouHoje` bloqueava reenvio após erro

### Problema
`_jaEnviouHoje` retornava `true` para qualquer linha do cliente no dia — incluindo `STATUS_ENVIO = "ERRO_ENVIO"`. Isso impedia reenvio mesmo quando o envio anterior tinha falhado.

### Solução
Adicionada verificação de STATUS_ENVIO: só bloqueia se `String(vals[i][cSt]).trim() === "ENVIADO"`. Erros não bloqueiam reenvio.

### Status
Resolvido (2026-06-15)

---

## 2026-06-15 — Evolution GO: endpoint e autenticação incorretos

### Problema
Código usava o endpoint e formato da versão open-source da Evolution API (`/message/sendText/{instance}` com body `{phone, message}`). A versão GO (comercial) tem API completamente diferente. Além disso, usava a API key global em vez do Token da Instância (por instância).

### Impacto
HTTP 404 no endpoint, depois HTTP 401 com key global, depois HTTP 400 com body errado.

### Solução
- Endpoint correto: `POST /send/text` (sem instância na URL)
- Body correto: `{ number, text, instanceId }`
- Autenticação: `apikey: {Token da Instância}` — obtido em Instâncias → Configurações

### Status
Resolvido (2026-06-15)

---

## 2026-06-15 — Simulador: valor revertia para múltiplo de 50

### Problema
Input do Simulador tinha `step={50}` + `onBlur` com `Math.round(value/50)*50`. Qualquer valor digitado (ex: 1360) era arredondado para o múltiplo de 50 mais próximo (1350) ao sair do campo.

### Impacto
Impossível simular valores que não sejam múltiplos de 50 (ex: R$ 1.360).

### Solução
`step={1}` + `Math.max(100, Math.min(100000, Math.round(Number(e.target.value))))` — sem snap para múltiplo de 50. Mantém apenas o arredondamento para inteiro e clamping no intervalo [100, 100000].

### Status
Resolvido (2026-06-15)

---

## 2026-06-15 — Template CONFIRMACAO ausente em buscarTemplatesRegua()

### Problema
`CONFIRMACAO` não estava no objeto `_MSG_TEMPLATES`. O texto padrão estava definido como variável local `_TMPL_CONF` dentro de `_garantirConfigsRegua()`, que só roda quando a régua de cobrança executa (trigger 7h). `buscarTemplatesRegua()` usava `_MSG_TEMPLATES` como único fallback, então se o Sheets não tivesse a linha `TEMPLATE_CONFIRMACAO`, o campo aparecia em branco no `TemplatesReguaModal`.

### Impacto
Campo "CONFIRMACAO" sempre em branco no painel ao abrir Templates pela primeira vez (antes da primeira execução da régua).

### Solução
Adicionado `"CONFIRMACAO": "Olá, {NOME}..."` diretamente a `_MSG_TEMPLATES`. Simplificado `_garantirConfigsRegua()` para usar `_MSG_TEMPLATES["CONFIRMACAO"]` em vez de variável local redundante. `buscarTemplatesRegua()` agora inclui CONFIRMACAO no fallback automaticamente.

### Status
Resolvido (2026-06-15)

---

## 2026-06-15 — Auditoria Estrutural — 10 inconsistências arquiteturais

### Problema
Audit sistemático identificou constantes de status duplicadas em múltiplos pontos, valores legado em filtros, campos obsoletos ainda sendo gravados, e campos novos nunca calculados.

### Itens corrigidos

**A1 — `_ST_ATIVOS` duplicado em 3 locais** (Resolvido)
- `ST_ATIVOS_G` (Gestão), `ST_ATIVOS_PAG` (PagamentoDrop), array inline (M useMemo) — todos diferentes
- Fix: nova constante global `_ST_ATIVOS = new Set([...])` em main.jsx linha ~69; todos os pontos migrados

**A2 — `_stTermLeg` com variantes legado** (Resolvido)
- `const _stTermLeg = new Set([..._ST_TERMINAL,"paga","quitado","quitada","baixado","baixada"])` — variantes que não existem no banco
- Fix: removido; filtro `aReceber30` usa `_ST_TERMINAL` diretamente

**A3 — `statusPago` com variantes legado** (Resolvido)
- `["pago","paga","quitado","quitada","baixado","baixada"].includes(...)` — variantes nunca gravadas no banco atual
- Fix: `["pago","quitacao_antecipada"].includes(String(p.STATUS||"").toLowerCase())`

**A4 — `DIFERENCA_RECEBIDA` ainda sendo gravada** (Resolvido)
- `registrarPagamentoAPI` e `registrarPagamentoParcial` gravavam tanto `DIFERENCA_RECEBIDA` quanto `RECEITA_EXTRA_ATRASO` (mesma informação em dois campos)
- Fix: parou de gravar `DIFERENCA_RECEBIDA` em novos registros; apenas `RECEITA_EXTRA_ATRASO` é o campo oficial

**A5 — `LUCRO_JUROS` duplicado de `LUCRO_TOTAL`** (Resolvido)
- `calcularMetricasCliente` gravava `LUCRO_JUROS` com exatamente o mesmo valor de `LUCRO_TOTAL`
- Fix: parou de gravar `LUCRO_JUROS`; apenas `LUCRO_TOTAL` persiste

**A6 — `TOTAL_PAGO`, `CONTRATOS_ATIVOS`, `CONTRATOS_BAIXADOS` nunca calculados** (Resolvido)
- Colunas existiam em CLIENTES mas estavam sempre em branco
- Fix: `calcularMetricasCliente` agora calcula e grava os 3. `recalcularTodasMetricas()` aplicado em 132 clientes

**A7 — `STATUS_PROMESSA` filtrado com exclusão lowercase** (Resolvido)
- `!["cumprida","cancelada"].includes(String(p.STATUS_PROMESSA||"").toLowerCase())` incluía "QUEBRADA" como ativo
- Fix: `String(p.STATUS_PROMESSA||"").toUpperCase() === "PENDENTE"` — whitelist explícita

**A8 — Var locais `TERMINAL`/`ST_FIM` no GAS** (Resolvido)
- 3 funções (`alterarDiaVencimentoContrato`, `alterarVencimentoContrato`, `_enviarConfirmacaoPagamento`) redefiniam `STATUS_TERMINAL` localmente
- Fix: variáveis locais removidas; usam o global `STATUS_TERMINAL` diretamente

**A9 — `tipoMap` com aliases curtos** (Resolvido)
- `normal`, `com_atraso`, `antecipado` mapeados como aliases — verificado no banco: zero ocorrências
- Fix: aliases removidos; `tipoMap` mantém apenas os 8 valores oficiais longos

**A10 — `M.lucroTotal` nomenclatura enganosa** (Resolvido)
- `return {..., lucroTotal: receitaExtra, ...}` — `lucroTotal` na verdade era `receitaExtra`; nunca lido em nenhum card
- Fix: removido do objeto M; `receitaExtra` continua disponível diretamente

### Funções de manutenção adicionadas ao GAS (2026-06-15)
```javascript
diagnosticarLegado()       // READ-ONLY: conta valores legado em PAGAMENTOS e PARCELAS; confirma "banco limpo"
normalizarTipoPagamento()  // migra: normal→pagamento_normal, com_atraso→pagamento_com_atraso, antecipado→pagamento_antecipado
normalizarStatusParcela()  // migra: paga→pago, quitado/quitada→quitacao_antecipada, baixado/baixada→baixado_como_prejuizo
```
Resultado ao executar `diagnosticarLegado()` em 2026-06-15: **0 ocorrências legado** — banco já estava limpo.

### Status
Resolvido (2026-06-15)

---

## 2026-06-15 — JUROS_TOTAL do contrato não atualiza ao registrar somente_juros

### Problema
`registrarPagamentoParcial` cria uma nova parcela de somente_juros mas não soma ao `JUROS_TOTAL` do contrato original. Divergência de R$ 6.048,74 detectada entre soma de PARCELAS e valor em CONTRATOS.

### Impacto
`JUROS_TOTAL` em CONTRATOS subestimado para contratos com histórico de somente_juros. Não afeta o frontend (não exibe esse campo).

### Solução
`atualizarTotaisContrato(idContrato)` é chamada ao final de `registrarPagamentoParcial` — reconstrói `JUROS_TOTAL`, `VALOR_TOTAL`, `NUM_PARCELAS` e médias somando todas as parcelas do contrato. Contratos históricos são corrigidos quando um novo somente_juros é registrado ou via trigger diário se implementado.

### Status
Parcialmente resolvido (2026-06-19) — novos registros corretos; contratos históricos sem somente_juros recente ainda podem ter divergência. Solução definitiva: rodar `atualizarTotaisContrato` em loop via função de manutenção.

---

## 2026-06-17 — cobv CONCLUIDA retornava pixCopiaECola inválido na regeneração

### Problema
Ao chamar PUT `/v2/cobv/{txid}` para um TXID já `CONCLUIDA` na Efí, a API retornava erro. O código antigo fazia um GET de recuperação e devolvia o `pixCopiaECola` da cobv CONCLUIDA — que é inválido para novo pagamento. O QR Code gerado no Sheets aparecia como "QR Code inválido ou expirado" nos apps de banco.

### Impacto
Parcelas cujos TXIDs foram usados em testes/pagamentos anteriores não conseguiam gerar novos PIX válidos via `gerarPixTodosContratos()`. 484 parcelas afetadas regeneradas em 2026-06-17.

### Solução
`upsertCobv(txid, payload, token)` em `api/efi-charges.js` e `api/efi-pix-avulso.js`: ao detectar status `CONCLUIDA`, `REMOVIDA_PELO_USUARIO_RECEBEDOR` ou `REMOVIDA_PELO_PSP` no GET, tenta TXID com sufixo `R1` (26→28 chars, dentro do limite de 35 da Efí). Se R1 também estiver ocupado, tenta `R2`. O webhook continua parseando corretamente (`txid.slice(20,26)` retorna o número da parcela independente do sufixo).

Funções de manutenção adicionadas ao GAS (menu "PIX"):
- `auditarPixParcelas()` — diagnóstico read-only
- `limparPixAbertosParaRegeneracao()` — limpa EFI_TXID e EFI_PIX_CODE de todas as parcelas abertas para forçar regeneração

### Status
Resolvido (2026-06-17)

---

## 2026-06-20 — Régua D0 não enviada — timeout em `rotinaDiaria`

### Problema
`rotinaDiaria` executava `atualizarStatusParcelas()` e `atualizarStatusContratos()` **antes** de `enviarReguaCobranca()`. As duas funções de status fazem `setValue` individual por linha no Sheets — para 200+ parcelas consomem 3–5 minutos. O GAS mata triggers com silêncio após 6 minutos, então `enviarReguaCobranca` nunca chegava a executar. Confirmado pelo 50% de taxa de erro em `rotinaDiaria` nos logs de execução.

### Impacto
Nenhuma mensagem da régua (D-5, D-1, D0, D+1, D+3, D+7) era enviada em dias onde `atualizarStatusParcelas` + `atualizarStatusContratos` demoravam mais de ~4 minutos. D0 era o caso mais frequentemente reportado porque era o gatilho de maior impacto percebido pelo usuário.

### Solução
1. `enviarReguaCobranca` movida para a **2ª posição** em `rotinaDiaria` (logo após `verificarPagamentosEfi`, antes dos updates de status). A régua usa `DATA_VENCIMENTO` (data), não o campo STATUS — não depende das atualizações para funcionar. Status terminais (pago, cancelado, etc.) são gravados no momento do pagamento, não pela rotina diária.
2. Função `rotinaRegua()` criada (executa apenas `enviarReguaCobranca`) com trigger backup configurado às 8h–9h via UI do GAS. `_jaEnviouHoje` previne duplicatas.

Nova ordem em `rotinaDiaria`:
```
verificarPagamentosEfi → enviarReguaCobranca → atualizarStatusParcelas → atualizarStatusContratos → verificarPromessasVencidas → auditarIntegridadeSistema
```

### Status
Resolvido (2026-06-20) — versão 167 do GAS

---

## 2026-07-04 — Recuperação Judicial: PREJUIZO_CAPITAL não calculado se ajuizado sem baixa prévia

### Problema
`ajuizarContrato` permite ajuizar direto de `em_cobranca`/`pre_prejuizo` (sem passar por `baixarContratoPrejuizo` antes), mas nunca calculava `PREJUIZO_CAPITAL`. A cascata de recuperação judicial (`_alocarRecuperacaoJudicial`) usa esse campo como base do principal em aberto.

### Impacto
Qualquer recuperação judicial de um contrato ajuizado sem baixa prévia classificaria 100% do valor recebido como "lucro", zero como "principal recuperado" — número financeiro incorreto.

### Solução
`ajuizarContrato` agora calcula `PREJUIZO_CAPITAL` a partir da soma do `VALOR_PRINCIPAL` das parcelas ainda abertas, caso o campo esteja vazio/zero (mesmo critério de `registrarAcordoComPerda`).

### Status
Resolvido (2026-07-04) — corrigido em auto-revisão antes do deploy

---

## 2026-07-04 — Recuperação Judicial: bug de timezone em datas de acordo/quitação judicial

### Problema
`registrarAcordoJudicial`/`registrarQuitacaoJudicial` usavam `new Date(dados.data||new Date())` em vez de `parseDateLocal` — o mesmo bug de timezone documentado em 2026-06-03.

### Impacto
Data do acordo/quitação judicial gravada um dia antes no Sheets.

### Solução
Trocado por `dados.data ? parseDateLocal(dados.data) : new Date()` em todos os pontos novos.

### Status
Resolvido (2026-07-04) — corrigido em auto-revisão antes do deploy

---

## 2026-07-04 — Recuperação Judicial: parcelas não fechadas em acordo à vista e arquivamento

### Problema
O branch "A_VISTA" de `registrarAcordoJudicial` e o `arquivarProcessoJudicial` (quando resulta em perda definitiva) marcavam o contrato como `encerrado_judicialmente` mas não fechavam as parcelas originais ainda abertas.

### Impacto
Parcelas ficariam "atrasado"/"pendente" para sempre em um contrato já encerrado — dado órfão, visível em qualquer relatório que leia PARCELAS diretamente.

### Solução
Ambos os caminhos agora marcam as parcelas não-terminais do contrato como `renegociado` (acordo à vista) ou `baixado_como_prejuizo` (perda definitiva) antes de finalizar.

### Status
Resolvido (2026-07-04) — corrigido em auto-revisão antes do deploy

---

## 2026-07-04 — Recuperação Judicial: arquivarProcessoJudicial sem guarda de status

### Problema
`arquivarProcessoJudicial` não validava o status atual do contrato antes de agir — uma chamada direta à API em um contrato `ativo_em_dia` converteria incorretamente para perda judicial definitiva.

### Impacto
Risco de corromper um contrato saudável via chamada de API fora do fluxo normal da UI.

### Solução
Adicionado guard: só permite se `STATUS_CONTRATO` já é `em_processo_judicial` ou `encerrado_judicialmente`.

### Status
Resolvido (2026-07-04) — corrigido em auto-revisão antes do deploy

---

## 2026-07-04 — Recuperação Judicial: quitação com desconto marcava status errado

### Problema
Quando a última parcela de um acordo judicial parcelado com deságio era paga, `registrarPagamentoAPI` marcava `SITUACAO_FINANCEIRA_JUDICIAL="QUITADO_JUDICIALMENTE"` incondicionalmente, mesmo havendo `PREJUIZO_CAPITAL` residual (desconto negociado nunca recuperado).

### Impacto
Situação financeira final incorreta — "quitado" quando na real houve recuperação parcial.

### Solução
Passou a checar o `PREJUIZO_CAPITAL` real após a última parcela: `QUITADO_JUDICIALMENTE` só se chegou a zero, senão `RECUPERADO_PARCIAL`.

### Status
Resolvido (2026-07-04) — corrigido em auto-revisão antes do deploy

---

## 2026-07-04 — Extrato do Contrato: telefone sem formatação

### Problema
`gerarExtratoPDF` imprimia `String(cliente.TELEFONE_WPP)` cru — a única função PDF do arquivo que não usava `fmtTel` nem `.replace(/\D/g,'')`. Um valor sujo no cadastro (asterisco/vírgula) aparecia ilegível no documento.

### Impacto
Documento entregue ao cliente com telefone garbled (ex: `* 6 2 9 8 1 4 5 6 0 0 0 ,`).

### Solução
`fmtTel` extraído para escopo de módulo (antes só existia dentro de `exportarPDFContratos`) e usado também em `gerarExtratoPDF`.

### Status
Resolvido (2026-07-04)

---

## 2026-07-04 — jsPDF: símbolos Unicode (✓/⚠) quebram no Helvetica padrão

### Problema
Textos de banner usando `✓` e `⚠` (fora do WinAnsiEncoding) renderizavam como caracteres soltos (`'`, `&`) no PDF gerado — confirmado gerando e lendo o PDF real.

### Impacto
Banners de status ("CONTRATO QUITADO", "PARCELAS EM ATRASO") com símbolo quebrado no início do texto.

### Solução
Removidos os glifos; banners usam texto puro. Regra registrada em `DESIGN_SYSTEM.md` §20: nunca usar Unicode fora de WinAnsi em texto jsPDF.

### Status
Resolvido (2026-07-04) — mas outros PDFs do sistema (`gerarComprovante`, `gerarEEnviarComprovante`) não foram auditados para o mesmo problema; verificar se usam os mesmos glifos.

---

## 2026-07-04 — Motor de undo, quitação PIX e certificados sem entrada no frontend

### Problema
Um grande volume de backend (`appscript.gs`) ficou acumulado sem commit por semanas e foi commitado de uma vez em `98afd35`: motor de undo (`registrarUndo`/`reverterOperacao`, TTL 15 min), quitação antecipada via PIX (`gerarPropostaQuitacaoPix`/`pagamentoQuitacaoWebhook`), certificado público de quitação (`gerarCertificadoQuitacao`/`api/cert.js`), auditoria automática de integridade (`auditarIntegridadeSistema`) e idempotência de webhook (`_idem_check`/`_idem_reg`). São callable via API/GAS, mas **só o certificado tem disparo automático real** (ao quitar contrato) — undo e quitação PIX não têm nenhum botão em `main.jsx`.

### Impacto
Nenhum risco de dado (funções não são chamadas por engano), mas o recurso não é usável pelo Alex sem alguém chamar a action manualmente. Motor de undo em particular é o tipo de recurso que só ajuda se tiver um botão "Desfazer" visível logo após a ação.

### Solução
Nenhuma ainda — registrado para as próximas sessões avaliarem se vale construir a UI (botão "Desfazer" com contador regressivo de 15 min no `ContratoModal`/toasts de ação; fluxo de quitação PIX em algum lugar de `ContratoModal`/`Cobrança`).

### Status
Aberto

---

## 2026-07-05 — Ajuizar sumia após renegociação quando cliente voltava a atrasar

### Problema
`podeAjuizar` no `ContratoModal` (`src/main.jsx`) só liberava o botão "Ajuizar contrato" para `STATUS_CONTRATO` em `em_cobranca`/`pre_prejuizo`/`baixado_como_prejuizo`. Um contrato renegociado (`renegociarContrato`) volta para `ativo_em_dia`, e se o cliente não pagasse a nova parcela ele reentrava no ciclo normal de atraso (`ativo_em_atraso`) — mesmo tratamento de um atraso de 1ª vez, exigindo esperar 30 dias até virar `em_cobranca` para poder ajuizar de novo.

### Impacto
Reincidência pós-renegociação (situação já agravada — 2ª chance dada e não cumprida) ficava presa no fluxo de cobrança comum por até 30 dias sem opção de ajuizamento, mesmo sendo o cenário onde a ação judicial é mais indicada.

### Solução
`podeAjuizar` passou a considerar também `jaRenegociado (parcela com ORIGEM_PARCELA="renegociada") && STATUS_CONTRATO==="ativo_em_atraso"`. Só mudança de visibilidade de botão no frontend — `ajuizarContrato` no GAS nunca validou status, então nenhuma alteração de backend foi necessária. Ver regra em `02-AI-CREDIT-RULES.md` (seção Renegociação) e `MANUAL_OPERACIONAL.md` (5.9).

**Atualização (2026-07-06):** limitação do Acordo Assistido resolvida. Como `sairDoAcordoAssistido` limpa `DATA_ENTRADA_ACORDO_ASSISTIDO`/`MOTIVO_ACORDO_ASSISTIDO`/`OBSERVACAO_ACORDO_ASSISTIDO` em CONTRATOS ao voltar à cobrança normal, não sobra nenhum campo em CONTRATOS para detectar reincidência — a detecção usa o evento `ACORDO_ASSISTIDO_ENTRADA` em EVENTOS (nunca apagado), via `jaTeveAcordoAssistido = eventos.some(e => e.ID_CONTRATO===contrato.ID_CONTRATO && e.TIPO_EVENTO==="ACORDO_ASSISTIDO_ENTRADA")`. `podeAjuizar` agora é `[...] || ((jaRenegociado || jaTeveAcordoAssistido) && STATUS_CONTRATO==="ativo_em_atraso")`. Validado com casos mock (node) reproduzindo os 5 cenários relevantes — não havia contrato em produção no estado exato (histórico de Acordo Assistido + `ativo_em_atraso` atual) para testar via UI sem alterar dado real de cliente.

### Status
Resolvido (2026-07-05 renegociação, 2026-07-06 Acordo Assistido).

---

## 2026-07-09 — `criarContrato` não valida "contrato ativo único" nem `STATUS_CLIENTE==="bloqueado"` (achado, não corrigido)

### Problema
Ao implementar o Bloqueio Manual de Cliente (`CLIENTE_BLOQUEADO_MANUAL`, ver `02-AI-CREDIT-RULES.md`), foi confirmado que `criarContrato` (`appscript.gs` ~linha 3280) só valida `CLIENTE_JUDICIALIZADO` no backend (e agora também `CLIENTE_BLOQUEADO_MANUAL`). Duas outras regras de elegibilidade **não são validadas no servidor**:

1. **"Cliente não pode ter mais de um contrato ativo simultâneo"** — regra descrita em `02-AI-CREDIT-RULES.md` (linha 7-9), mas nunca implementada em `criarContrato`. Existe só como checagem client-side (`idsComAtivo` em `NovoContrato`, `src/main.jsx`), que cobre apenas o fluxo de busca direta — não cobre entrada via `ClienteModal` → "Novo Contrato" nem via `SimuladorContrato` → "Abrir como Contrato".
2. **`STATUS_CLIENTE === "bloqueado"`** (setado automaticamente ao dar baixa de prejuízo) também não é checado em `criarContrato` — hoje só é usado para excluir o cliente da fila de cobrança WhatsApp (`appscript.gs` ~linha 7204).

### Impacto
Contornável hoje: uma chamada direta à action `novoContrato` (ex. bug de frontend, ou os 2 pontos de entrada que pulam o `idsComAtivo` client-side) pode criar um segundo contrato ativo para o mesmo cliente, ou criar contrato para cliente com prejuízo declarado (`STATUS_CLIENTE="bloqueado"`), sem nenhum bloqueio no servidor.

### Status
**Não corrigido** — fora do escopo da feature de Bloqueio Manual (que resolveu apenas o caso de decisão subjetiva). Registrado aqui para não ser esquecido; corrigir replicando o mesmo padrão de checagem já usado para `CLIENTE_JUDICIALIZADO`/`CLIENTE_BLOQUEADO_MANUAL` em `criarContrato`.

---

## 2026-07-13 — Régua e confirmação de pagamento: falhas silenciosas por corrida de triggers e exceções engolidas

### Problema
Dois bugs de mensageria WhatsApp descobertos a partir de relatos reais de clientes:

1. `_logMensagem` calculava a próxima linha livre com `aba.getLastRow()+1` sem lock. `rotinaDiaria` (7h) e o trigger de backup `rotinaRegua` (8h) podem chamar `enviarReguaCobranca()` em execuções concorrentes — cada envio da régua leva alguns segundos (mensagem + PIX + delays), e com centenas de clientes na fila a execução das 7h pode ainda estar rodando quando a das 8h começa. Duas gravações simultâneas na mesma linha faziam uma sobrescrever a outra, apagando o registro mesmo com a mensagem já enviada de verdade.
2. `_enviarConfirmacaoPagamento` não tinha try/catch cobrindo os passos de leitura/template/envio — qualquer exceção era engolida pelo catch genérico do chamador (`registrarPagamentoAPI`), deixando a falha 100% invisível (nem MENSAGENS, nem a aba Régua WPP).
3. Efeito colateral: a 2ª mensagem da régua (código PIX, enviada separada do texto) podia falhar silenciosamente — só registrava `Logger.log` interno, sem entrada visível nem retry.

Casos reais confirmados: Brenda Azevedo da Silva (PCL-219, parcela 1 — pagamento de R$510 registrado corretamente, mas confirmação nunca enviada) e Lara Jordana Silva Ribeiro (PCL-139, parcela 6/8 — mensagem 1 de D+3 recebida no WhatsApp sem nenhum registro em MENSAGENS, e a mensagem 2 com o código PIX nunca chegou).

### Impacto
Cliente pagava e não recebia confirmação, ou recebia lembrete de cobrança sem o código PIX pra pagar. Zero visibilidade da falha para Alex — MENSAGENS/Régua WPP mostrava "tudo certo" ou simplesmente não registrava o evento.

### Solução
- `_logMensagem`: protegida com `LockService.getScriptLock()` (mesmo padrão já usado em `proximoIdSeq`), serializando escritas concorrentes.
- `_enviarConfirmacaoPagamento`: corpo inteiro (passos 2-7) envolto em try/catch — qualquer exceção agora grava um registro `ERRO_ENVIO` em MENSAGENS com o motivo real.
- `enviarReguaCobranca`: 2ª mensagem (PIX) ganhou 1 retentativa automática; se falhar mesmo assim, grava `ERRO_PIX` visível na aba Régua WPP. Também corrigida uma chamada pré-existente a `_logMensagem` no ramo SEM_PIX que não tinha try/catch — como `_logMensagem` agora pode lançar exceção (timeout de lock, até 15s), essa chamada desprotegida quebraria o loop inteiro para os clientes seguintes na fila do dia.
- Nova função de manutenção `reenviarConfirmacoesPendentes()` (menu GAS → "Régua: Reenviar Confirmações de Pagamento Perdidas (7 dias)"): varre PARCELAS pagas nos últimos 7 dias sem confirmação `ENVIADO` registrada e reenvia — segura de rodar mais de uma vez (reaproveita a checagem de duplicata já existente em `_enviarConfirmacaoPagamento`).

### Status
Resolvido (2026-07-13)

---

## 2026-07-20 — Confirmação de pagamento: dedup por ID_PARCELA bloqueava pagamento real após pagamento de teste desfeito

### Problema
`_enviarConfirmacaoPagamento` bloqueava reenvio checando **só** `ID_PARCELA + GATILHO=CONFIRMACAO_PAGAMENTO + STATUS_ENVIO=ENVIADO` em MENSAGENS, sem considerar a data. `reabrirParcelaAPI` (usada por undo e por correções manuais) reseta a parcela em PARCELAS e apaga o registro em PAGAMENTOS, mas **não toca em MENSAGENS** — então uma confirmação antiga ficava órfã, marcada ENVIADO para sempre. Qualquer pagamento real registrado depois nessa mesma parcela era silenciosamente pulado (nem erro, nem log visível — só `Logger.log` interno).

Causa raiz de 3 pagamentos de teste feitos em 17/06/2026 (~10:09–10:10, mesmo lote, valores de centavos como R$5,90/R$10,10/R$2,55) que foram revertidos depois: Brenda Azevedo da Silva (PCL-219, parcela 1) e Lucas Matos Rocha (PCL-229, parcela 1) tiveram a confirmação do pagamento real (semanas depois) bloqueada por esse dedup. Nalanda Vasconcelos da Silva (PCL-230, parcela 1) só escapou porque a mensagem de teste dela falhou no envio (`ERRO_ENVIO`, não `ENVIADO`), então não contou pro dedup.

**Correção retroativa importante:** o caso da Brenda é o mesmo já relatado na entrada acima (2026-07-13) — na época foi diagnosticado como exceção engolida / corrida de trigger, e "resolvido" com try/catch + lock. Esse patch não tocava a causa real (o dedup roda **antes** do try/catch, retorna via `return` simples, nunca lança exceção), então o problema dela nunca foi de fato corrigido — só passou despercebido até essa auditoria em 20/07, quando o mesmo padrão se repetiu com o Lucas e o Alex pediu investigação.

### Impacto
Cliente paga, o sistema registra certo, mas o WhatsApp de confirmação nunca chega — sem nenhum sinal de erro visível pro Alex em MENSAGENS ou na aba Régua WPP. Só acontece em parcelas que passaram por reabertura (undo, correção manual) e foram pagas de novo depois. Validado contra os dados reais de produção: das 92 confirmações `ENVIADO` existentes, só essas 2 (Brenda e Lucas) tinham esse padrão — nenhuma outra parcela do sistema está nesse estado hoje.

### Solução
`_enviarConfirmacaoPagamento`: dedup agora só bloqueia se a mensagem `ENVIADO` mais recente para aquele `ID_PARCELA` foi enviada no mesmo dia (ou depois) da `DATA_PAGAMENTO` **vigente** da parcela (novo helper `_dataPagamentoAtualParcela` + `_apenasData`, que trunca pra meia-noite local pra não comparar hora exata — `DATA_PAGAMENTO` é sempre gravada ao meio-dia local via `parseDateLocal`, `DATA_ENVIO` é o horário real do envio). Se a confirmação existente é anterior à data de pagamento vigente, é tratada como órfã de um pagamento já desfeito e não bloqueia.

`reenviarConfirmacoesPendentes()` (menu GAS) simplificada: removido o pré-filtro `jaConfirmadas` (mesmo dedup ingênuo, duplicado) — agora só filtra por parcelas pagas nos últimos 7 dias e delega inteiramente o dedup pra `_enviarConfirmacaoPagamento`.

Brenda e Lucas foram avisados manualmente por WhatsApp pelo Alex enquanto o fix não estava no ar.

### Status
Resolvido (2026-07-20)

---

## 2026-07-15 — Colagem de valor monetário BR vira valor errado

### Problema
Todo `<input type="number">` de valor em reais aceitava só ponto como separador decimal e rejeitava vírgula. Ao colar um valor no formato BR copiado de PDF/comprovante (ex: `2.000,00`), o navegador descartava a vírgula e concatenava os dígitos restantes, produzindo `2.00000` em vez de `2000.00`. Reportado por Alex ao colar renda de cliente vinda de um PDF no ClienteModal.

### Impacto
Qualquer campo de R$ colado (não digitado manualmente) no sistema — Renda do cliente, Principal do contrato, Valor de pagamento, campos do módulo judicial, etc. — podia gravar um valor completamente errado sem nenhum aviso visual óbvio.

### Solução
Duas funções novas perto de `fmtR` (`parseValorColado`/`pasteMoeda`) interceptam o evento `onPaste` em ~26 campos monetários e convertem o texto colado (milhar=ponto, decimal=vírgula) para um número JS válido antes de setar o state — sem alterar `type`, `onChange` ou a digitação manual. Campos de percentual/quantidade ficam de fora deliberadamente. Detalhes de uso em `CLAUDE.md` (seção "Campos monetários — colagem BR") — **todo campo novo de R$ precisa desse `onPaste` adicionado manualmente**, não é automático.

Confirmado funcionando em produção por Alex em 2026-07-15 (colou "2.670,15", campo mostrou "2670,15" — vírgula decimal é exibição nativa do Chrome em pt-BR, não algo implementado; separador de milhar nunca aparece em `type="number"` nativo).

Spec: `docs/superpowers/specs/2026-07-15-colagem-valores-monetarios-design.md`. Plano: `docs/superpowers/plans/2026-07-15-colagem-valores-monetarios.md`.

### Status
Resolvido (2026-07-15)

---

## 2026-07-22 — Contrato mostra "EM DIA" com parcela já atrasada (staleness do STATUS_CONTRATO)

### Problema
`STATUS_CONTRATO` é um campo gravado no Sheets, recalculado só 1x/dia às 7h por `atualizarStatusContratos()` (via `rotinaDiaria`). O status da parcela mostrado na tabela do `ContratoModal` (`statusEfetivo()`, `main.jsx:110`) é calculado ao vivo no navegador a cada render. Isso cria uma janela estrutural de até 24h onde os dois podem divergir — mas no caso reportado (Alex, contrato PCL-198/Cassia Antunes Rodrigues) a parcela venceu no dia anterior, ou seja, o trigger das 7h já deveria ter corrigido o status antes da tela ser aberta e não corrigiu.

### Causa raiz mais provável
Dentro de `rotinaDiaria()` (`appscript.gs`), `atualizarStatusParcelas()`, `atualizarStatusContratos()` e `verificarPromessasVencidas()` rodavam **sem `try/catch`**, diferente de todas as outras etapas da função. Se qualquer uma lançasse exceção — ou fosse interrompida pelo limite de 6 min do GAS (mesmo padrão do bug de timeout da régua, ver entrada acima na linha ~460) — a execução parava ali, silenciosamente, sem log de erro, e as etapas seguintes (inclusive a atualização de status do próprio contrato) nunca rodavam naquele dia.

Achado secundário (dormente, não confirmado como causa deste caso): `maxDiasAtraso()` e `atualizarStatusParcelas()` faziam `new Date(valorDaCelula)` como parsing de data em vez de `parseDateLocal()` — violação do padrão obrigatório do projeto. Inofensivo enquanto as parcelas forem criadas via `parseDateLocal` (grava `Date` real na célula), mas arriscado para qualquer edição manual na planilha.

### Solução
1. As 3 chamadas em `rotinaDiaria()` agora são independentes, cada uma com seu próprio `try/catch` — uma falha em `atualizarStatusParcelas()` não impede mais `atualizarStatusContratos()` de rodar, e o erro fica logado em vez de mascarado.
2. `maxDiasAtraso()` e `atualizarStatusParcelas()` agora usam `parseDateLocal()` para parsear `DATA_VENCIMENTO`, alinhado ao padrão do resto do GAS.

### Pendente
Não foi possível confirmar via log de execuções do Apps Script se o trigger das 7h realmente falhou nesse dia (fora do alcance do Claude Code) — Alex pode confirmar em Extensões → Apps Script → Execuções. Recomendado rodar manualmente o menu "Atualizar Status Contratos" para corrigir o contrato PCL-198 imediatamente, sem esperar o próximo ciclo das 7h.

### Status
Resolvido (2026-07-22) — deploy no Apps Script publicado por Alex. Correção retroativa do contrato PCL-198 depende de rodar o menu "Atualizar Status Contratos" (ou aguardar o trigger das 7h do dia seguinte).

---

## 2026-07-22 — Gotcha: `ScriptApp.getProjectTriggers`/`newTrigger` falha por escopo OAuth ausente no manifesto

### Problema
Ao rodar `configurarTriggerRelatorioContabilidade()` pela primeira vez (ver feature "Relatório Automático de Contabilidade" logo abaixo), apareceu: `Exception: As permissões especificadas não são suficientes para chamar ScriptApp.getProjectTriggers. Permissões necessárias: https://www.googleapis.com/auth/script.scriptapp`.

### Causa raiz
O manifesto do projeto (`appsscript.json`) tem `oauthScopes` explícito (lista fixa de permissões) em vez de detecção automática de escopo. Qualquer serviço do Apps Script usado no código — incluindo `ScriptApp.newTrigger`/`getProjectTriggers`/`deleteTrigger` — precisa estar nessa lista, senão a chamada falha em runtime com esse erro. Funções `configurarTrigger*` já existentes (`configurarTriggerBackup`, `configurarTriggerRegua` etc.) usam exatamente a mesma API e não davam esse erro porque já tinham sido autorizadas antes da lista de escopos existir/ficar restrita — não é uma proteção nova, é só a primeira vez nesta sessão que uma função desse tipo foi executada.

### Solução
Adicionado `"https://www.googleapis.com/auth/script.scriptapp"` ao array `oauthScopes` em `appsscript.json` (no editor do Apps Script: ⚙️ Configurações do projeto → marcar "Mostrar arquivo de manifesto 'appsscript.json'" → editar o arquivo → salvar). A primeira execução seguinte pede reautorização ("Revisar permissões" → Avançado → Acessar [projeto] → Permitir) — normal em projeto pessoal não verificado pelo Google.

### Nota para o futuro
Qualquer nova feature que chame `ScriptApp.newTrigger`/`getProjectTriggers`/`deleteTrigger` pela primeira vez numa sessão pode reproduzir esse erro. Não é regressão de código — confirmar que `script.scriptapp` está no `oauthScopes` do manifesto antes de investigar como bug.

### Status
Resolvido (2026-07-22)

---

## 2026-07-22 — Relatório Automático de Contabilidade (dia 22) — feature nova

### O que é
Todo dia 22 às 8h, `gerarRelatorioContabilidadeMensal()` (`appscript.gs`) gera o mesmo CSV do botão manual "Contabilidade" (aba Contratos, `exportarCSVContabilidade` em `main.jsx:6643-6695`), mas cobrindo do dia 1 ao dia 22 do mês corrente (corte parcial, não o mês fechado — contratos feitos depois do dia 22 ficam de fora, complementar via botão manual se necessário). Salva o arquivo na pasta Drive "Relatórios Contabilidade" (mantém as últimas 12) e avisa **só por WhatsApp** (sem e-mail — removido por pedido do Alex depois do primeiro teste) tanto o Alex quanto o contador, com o link do arquivo.

### Configuração (aba CONFIGURACOES)
- `TEL_ALEX_NOTIFICACOES` — WhatsApp do Alex (fallback hardcoded no código: `5562984877843`)
- `TEL_CONTADOR` — WhatsApp do contador (configurado: `5562983194833`)
- `ULTIMO_MES_RELATORIO_CONTABIL` — trava de idempotência (`yyyy-MM`), gravada automaticamente ao final de cada execução bem-sucedida; evita reenvio duplicado se o trigger disparar mais de uma vez no mesmo dia

### Trigger
`configurarTriggerRelatorioContabilidade()` registra `onMonthDay(22).atHour(8)` — já rodado 1x manualmente pelo menu "Contabilidade: Configurar Trigger Dia 22", confirmado ativo. Teste manual disponível no menu "Contabilidade: Gerar Relatório Agora (teste)" → `testarRelatorioContabilidadeMensal()`.

### Observação de segurança (decisão consciente do Alex, não bug)
O arquivo CSV compartilhado tem CPF/RG/endereço completo dos clientes do mês. A opção escolhida foi `DriveApp.Access.ANYONE_WITH_LINK` (qualquer pessoa com o link) em vez de restringir por conta Google do contador — Alex foi avisado explicitamente do risco (se a mensagem de WhatsApp for encaminhada, quem receber o link consegue abrir e ver os dados) e priorizou simplicidade. Se quiser reforçar depois: trocar por `DriveApp.Access.PRIVATE` + `arquivo.addViewer(emailDoContador)` (exige saber o e-mail Google do contador).

### Status
Resolvido/Em produção (2026-07-22) — testado e confirmado funcionando por Alex (CSV correto, WhatsApp chegando pros dois números, link abrindo certo).

---

## 2026-07-22 — Badge "Vence Hoje" aparecia em parcela já vencida ontem

### Problema
No `ContratoModal` e no cálculo de `calcPrioridadeCobranca`, `diasAteVenc` comparava `parseDate(dataVencimento)` (que sempre normaliza para meio-dia, `setHours(12,0,0,0)` — convenção do `parseDate` em `main.jsx:77` pra evitar bug de fuso) contra "hoje" à meia-noite (`setHours(0,0,0,0)`). Isso cria um viés fixo de +0,5 dia em todo `diasAteVenc`: para uma parcela vencida exatamente ontem, a diferença real é -1 dia, mas o cálculo dava -0,5 → `Math.round(-0.5)` em JS retorna `-0`, e `-0 === 0` é `true` em JavaScript — então o badge de "Vence Hoje" (`diasAteVenc===0`) acendia indevidamente. Reportado por Alex no contrato PCL-198 (Cassia Antunes Rodrigues): parcela 3 vencida em 21/07 (1 dia de atraso, corretamente marcada "Atrasado" na tabela) mas o header do modal mostrava a tag "Vence Hoje".

### Impacto
Efeito sistemático (não só no caso de -1 dia): `diasAteVenc` calculado sempre saía com +1 em relação ao valor real, em `main.jsx` nos dois pontos:
- `ContratoModal` (linha ~4021) — badge "Vence Hoje" e cor do campo "Próximo vencimento"
- `calcPrioridadeCobranca` (linha ~142) — nível "Preventivo" da Prioridade de Cobrança (`docs/ai-memory` / `project_prioridade_cobranca.md`), threshold `diasAteVenc<=5` na prática cortava em 4 dias reais, não 5

Um contrato que realmente vence **hoje** (diasAteVenc real = 0) na verdade calculava `1` e **não** mostrava o badge — o bug se manifestava só no ponto exato em que "ontem" (-1) virava `-0`.

### Solução
Normalizar a data de vencimento parseada para meia-noite (`setHours(0,0,0,0)`) antes de subtrair de "hoje", igual ao padrão já usado corretamente em `statusEfetivo()` e no cálculo de `diasAtraso` (linha ~139) da mesma função. Aplicado nos dois pontos (`main.jsx:142-144` e `main.jsx:4021-4023`).

### Observação (não corrigido, baixo impacto)
`main.jsx:4427` (coluna "Xd atraso" na tabela de parcelas do `ContratoModal`) usa `new Date()` (hora real atual) menos `parseDate()` (meio-dia fixo) em vez de comparar meia-noite a meia-noite. Só produz leitura errada (+1 dia) numa janela de poucas horas antes da meia-noite; não mexido porque não reproduz o sintoma reportado e o risco de regressão não compensa pra um caso tão raro.

### Status
Resolvido (2026-07-22)

---

## 2026-07-28 — Campo de renda some no ClienteModal por dado legado com vírgula (e tentativa de backfill que piorou o dado)

### Problema
`<input type="number">` no `ClienteModal` (`RENDA_BRUTA`, `RENDA_LIQUIDA`, `RENDA_MENSAL`) aparecia em branco mesmo com o valor certo salvo na planilha. Causa: registro legado (anterior ao fix de colagem BR de 2026-07-15) tinha o valor gravado como texto com vírgula decimal (ex: `"2542,50"`). HTML5 `type="number"` recusa exibir um valor com vírgula — o campo fica em branco silenciosamente, sem erro no console — mas `parseFloat` em JS ainda lê o valor truncado no primeiro caractere inválido, então cálculos derivados (Limite de Crédito = 80% × Renda Líquida) continuavam mostrando um número plausível, mascarando o bug. Caso reportado: cliente Reginaldo Rocha Torres (ID 124).

### Tentativa 1 (revertida) — backfill automático piorou o dado
Primeira correção incluiu `normalizarRendaClientes()` no GAS pra varrer CLIENTES e converter qualquer `RENDA_*` gravado como texto pra número. Rodado uma vez, **corrompeu ainda mais** o registro do Reginaldo: em algum momento do passado alguém colou um bloco de texto grande (provavelmente o contracheque inteiro, com vários números/datas juntos) direto numa célula da planilha, fora do app. O regex de limpeza do parser (`[^\d.,]`) removeu os espaços do bloco colado e concatenou todos os dígitos numa sequência de ~17 algarismos; como JS não representa inteiros tão grandes com precisão exata (limite seguro ~2^53), o resultado saiu arredondado e sem sentido (`25430201030000000` = R$25 quatrilhões) — pior que o bug original, porque virou um número "confiável" (não mais em branco) que alimentaria o Limite de Crédito automaticamente numa aprovação de contrato.

Investigação mostrou que a base de CLIENTES tem formatos de `RENDA_*` muito inconsistentes entre registros (com/sem vírgula, com/sem ponto, sem pontuação nenhuma) — dado inserido em fases diferentes ao longo do tempo, sem padronização. Alex decidiu **não vale a pena tentar consertar o histórico** de forma automática — risco de "consertar errado e pior" é real (confirmado na prática). Prioridade: garantir que **daqui pra frente** qualquer forma de entrada (digitar ou colar) sempre grave o valor limpo.

### Solução final — duas camadas, só olhando pra frente
1. **Frontend** (`src/main.jsx`): `pasteMoeda()`/`normMoedaSheet()` ganharam teto de sanidade `MOEDA_TETO = 1e7` (R$10 milhões, bem acima de qualquer valor real do negócio). Colar algo que resulte nesse teto ou acima: `pasteMoeda` recusa e alerta o usuário em vez de aceitar cego. `normMoedaSheet` (usado ao inicializar o `edit` do `ClienteModal` e no `salvar()`) devolve `""` em vez do número implausível — protege inclusive dado legado já quebrado, que agora só volta a ficar em branco (pedindo pra redigitar) em vez de virar um número gigante "confiável".
2. **GAS** (`atualizarDadosCliente`, appscript.gs): `_toMoneyNumber()` + `_CAMPOS_MONEY_CLIENTES` (`RENDA_BRUTA`, `RENDA_LIQUIDA`, `RENDA_MENSAL`, `LIMITE_CREDITO`) convertem explicitamente pra `Number` do JS antes de `setValue()`, em vez de depender do Google Sheets "adivinhar" o tipo pela string recebida — essa adivinhação, dependente do locale pt-BR da planilha, era a raiz real da divergência de formato.
3. A função de backfill (`normalizarRendaClientes`) e a tentativa seguinte de diagnóstico read-only (`diagnosticarRendaAbsurda`) foram **removidas** — decisão explícita de não mexer em dado histórico, só blindar o caminho de entrada.

Ver também `CLAUDE.md` (seção "Campos monetários — colagem BR") e `docs/ai-memory` memória `project_bugfix_renda_virgula.md` (Claude Code) pra detalhe da sessão.

### Status
Resolvido (2026-07-28) — deploy frontend via `vercel deploy --prod`; GAS colado manualmente por Alex (4 rodadas: fix inicial → remoção do backfill perigoso → diagnóstico read-only → coerção explícita a Number, com o diagnóstico removido na rodada seguinte). Dado histórico de clientes antigos com renda mal formatada **não foi corrigido de propósito** — só normaliza na próxima vez que o cliente for reaberto e o valor redigitado manualmente.

---

## 2026-07-29 — Taxa de Adimplência do Dashboard misturava bases diferentes (numerador/denominador)

### Problema
O card "Taxa de Adimplência" do Dashboard (`M.taxaInad`) calculava `100% − (valor das parcelas
vencidas com vencimento dentro do período do filtro ÷ principal total da carteira, sem filtro de
período)`. Numerador incluía juros e era filtrado por período; denominador era só principal e nunca
filtrado. O texto de apoio junto do card ("29 parc. em atraso de 111 no período") também misturava uma
contagem global (`parcelasAtrasadas.length`, sem filtro) com uma contagem filtrada por período
(`M.totalCobrancas`) — nenhuma das duas era o numerador/denominador real do percentual mostrado.

### Impacto
Nenhuma perda de dado ou erro de cálculo que afetasse cobrança/pagamento — é um KPI de leitura, não
usado em nenhuma decisão de crédito ou fluxo financeiro. Mas o número exibido não correspondia a
nenhuma metodologia padrão (bancária ou não) e mudava de forma pouco intuitiva conforme o filtro
"Este mês/30 dias/90 dias" do Dashboard, o que dificultava confiar nele pra decisão de negócio.

### Solução
Padronizado como NPL 90+ dias (padrão Basileia/BCB), base 100% principal (`principalAberto`), sempre
como foto de hoje — sem filtro de período. Mesma correção aplicada ao "Painel de Inadimplência" da
aba Carteira, que usava corte de 31+ dias com o texto "Padrão BCB" (impreciso — o padrão real é 90+).
Detalhe completo da fórmula e das 3 decisões de modelagem em
`docs/ai-memory/03-AI-FINANCIAL-CALCULATIONS.md` (seção "Taxa de Inadimplência — padronizada como
NPL 90+ dias").

### Status
Resolvido (2026-07-29) — só frontend (`src/main.jsx`), sem mudança em GAS/Sheets. Pendente: recalibrar
os thresholds de cor (`< 20%` bom / `20-25%` atenção / `25%+` crítico) do painel da Carteira para o
novo corte de 90d — ficou de fora deste fix, é decisão de política de risco separada.

---

## 2026-07-31 — Evolution GO: instância "borges" travava no QR code — resolvido criando instância nova

### Problema
Desde 2026-07-29 a instância "borges" do Evolution GO (WhatsApp da régua/atendimento) ficava presa em
"Aguardando QR Code..." pra sempre — `POST /instance/connect` respondia 200 em ~2ms (rápido demais pra
uma conexão real) e o log mostrava só `No QR code available yet, waiting a bit more...` em loop. Token,
porta, limite de dispositivos, rede/DNS e recriar a mesma instância do zero foram todos descartados como
causa (ver `project_evolution_go_infra.md` na memória). Efeito colateral notado no mesmo dia: a porta do
contêiner (`evolution-go-oizv-api-1`) tinha mudado sozinha de novo, de `32772` pra `32773`.

### Causa raiz
Não identificada com certeza — suspeita de bug interno do software Evolution GO (`evoapicloud/evolution-go`)
específico daquela instância/sessão, já que uma instância **nova** conectou normalmente.

### Solução
Criada instância nova `borges-fp` (mesmo WhatsApp Business, número `5562984877843`) no painel Evolution GO —
o QR code gerou e conectou normalmente. Atualizados os 3 apontamentos em 2 lugares:
- **Vercel (env vars produção)**: `EVOLUTION_API_URL` → `http://76.13.228.217:32773`, `EVOLUTION_INSTANCE`
  → `borges-fp`, `EVOLUTION_API_KEY` → novo token da instância
- **Google Sheets (CONFIGURACOES)**: `EVOLUTION_URL`, `EVOLUTION_INSTANCE`, `EVOLUTION_KEY` — mesmos 3 valores

Testado com envio real via `POST /send/text` — confirmado `"message":"success"`. A instância "borges" antiga
ficou pra trás, desconectada, sem uso.

### Nota para o futuro
Se a porta do container mudar de novo (já aconteceu 2x), atualizar nos mesmos 2 lugares acima. Se o
QR travar de novo numa instância existente, o caminho mais rápido é criar outra instância com nome
diferente em vez de insistir em diagnosticar a mesma — foi o que resolveu desta vez.

### Status
Resolvido (2026-07-31). Fila de ~19 mensagens de erro acumuladas na aba Régua WPP (via botão de envio
manual, ver `project_envio_manual_regua`) ainda pendente de limpar manualmente.

---

## 2026-07-31 — Notificação de erro de sistema por e-mail (canal independente do WhatsApp)

### Motivação
O incidente acima (instância "borges" travada) expôs um ponto cego: toda a régua de cobrança e as
notificações de erro do GAS dependiam só do WhatsApp/Evolution GO — se a própria infra de WhatsApp
quebrasse (como aconteceu), o Alex não seria avisado de nada, porque o único canal de aviso era o
mesmo canal quebrado.

### Solução
Nova função `_notificarErroSistema(origem, mensagem)` em `appscript.gs`, perto de `_enviarWppRegua`:
- **E-mail via `GmailApp.sendEmail(EMAIL_ADMIN, ...)`** — canal garantido, roda 100% na infra do Google,
  independente de Evolution GO / VPS Hostinger / Vercel. `GmailApp` já era usado no sistema (cadastro via
  Forms), sem escopo OAuth novo pra autorizar.
- **WhatsApp via `_enviarWppRegua` pro `TEL_ALEX_NOTIFICACOES`** — best-effort, tentado depois do e-mail;
  se falhar (inclusive se a causa for a própria infra de WPP), o e-mail já garantiu o aviso.

Plugada nos pontos onde erro de rotina automática (sem ninguém olhando a tela) hoje só virava
`Logger.log` silencioso — nunca em ações interativas da UI, que o Alex já vê na hora:
- `rotinaDiaria()` — nos 9 sub-processos (webhook Efí, verificação de pagamentos Efí, régua, status de
  parcelas/contratos, promessas vencidas, auditoria, expiração de undo, expiração de quitações)
- `rotinaRegua()` — trigger de backup das 8h
- `enviarReguaCobranca()` — **um resumo por execução** se houver falhas (não 1 e-mail por cliente, pra
  não virar spam se muitos envios falharem juntos)
- `_enviarConfirmacaoPagamento()` — tanto falha de envio (`ok=false`) quanto erro fatal (`catch eFatal`)

Nova chave em CONFIGURACOES: `TEL_ALEX_NOTIFICACOES = 556281060333` (número pessoal do Alex, separado do
`TELEFONE_WPP_PROPRIO` usado pra atendimento/régua). Também usada agora como padrão em `testarEnvioWpp()`
e `diagnosticarEvolution()` (funções de teste manual do GAS).

### Gap conhecido
`api/webhook-efi.js` e `api/whatsapp.js` rodam em Node.js na Vercel, fora do GAS — não têm esse canal de
e-mail ainda (Node não tem `GmailApp` nativo, precisaria de um provedor tipo Resend). Falhas ali hoje só
são pegas indiretamente pelo fallback `verificarPagamentosEfi()` dentro de `rotinaDiaria()`.

### Status
Implementado (2026-07-31), aguardando publicação da nova versão do Web App no editor do GAS.

---

## 2026-08-01 — Cliente pagou a parcela errada (pulou a atrasada) usando um PIX antigo do WhatsApp

### Problema
Cliente com uma parcela atrasada (31 dias) foi pagar e, sem querer, pagou a parcela do mês corrente em
vez da atrasada. Resultado: parcela mais nova ficou `pago`, a mais antiga seguiu `atrasado` — um "buraco"
cronológico no histórico do contrato.

### Causa raiz
Não é bug de uma função específica — é uma lacuna estrutural confirmada em 4 pontos do código:
1. Cada parcela gera um PIX próprio com TXID determinístico (`FOP<contrato>P<parcela>`,
   `api/efi-pix-avulso.js`). Fica válido por 30 dias **a partir da geração** — e pra parcelas já
   atrasadas, a "data de vencimento" enviada à Efí é forçada pro dia da geração (workaround pra Efí não
   rejeitar data passada), o que estende ainda mais essa janela.
2. A régua (`enviarReguaCobranca`, `appscript.gs`) dispara mensagem/PIX por parcela em dias diferentes
   (D-5/D-1/D0/D+1/D+3/D+7). Já deduplicava certo **dentro do mesmo dia** (só manda a de maior
   prioridade), mas **entre dias diferentes** nada impedia a parcela atrasada disparar num dia e a
   seguinte disparar em outro — os dois PIX ficavam simultaneamente válidos no histórico do WhatsApp.
3. Nada cancelava o PIX de uma parcela quando outra parcela do mesmo contrato era paga.
4. O webhook (`api/webhook-efi.js` → `pagamentoAutomatico`) mapeia o pagamento de volta pra parcela só
   pelo TXID, sem checar se existe parcela mais antiga em aberto no mesmo contrato. `registrarPagamentoAPI`
   também não tinha essa checagem, nem o dropdown de seleção manual de parcela no painel.

Não existia (e ainda não existe, por decisão consciente) nenhuma regra de "pagar a parcela mais antiga
primeiro" documentada em `MANUAL_OPERACIONAL.md`/`docs/ai-memory/`.

### Solução
Quatro mudanças, todas em `appscript.gs` (+ um botão em `main.jsx`):
1. **`realocarPagamentoAPI`** — nova ação pra corrigir pagamento já registrado na parcela errada. Reaproveita
   `reabrirParcelaAPI` (origem) + `registrarPagamentoAPI` (destino) em vez de tocar direto na célula
   `ID_PARCELA` de PAGAMENTOS — um `UPDATE` direto deixaria `PARCELAS`/`EVENTOS`/`TOTAL_SOMENTE_JUROS`/
   `STATUS_CONTRATO` inconsistentes. Valida a parcela de destino (existe, não terminal) **antes** de
   desfazer a origem, pra não deixar o pagamento no limbo se o destino for inválido. Botão "Realocar" no
   `PagamentoDetalheModal`. Detalhes em `CLAUDE.md` seção "Padrões do GAS".
2. **Régua nunca avança pra parcela nova com atrasada em aberto** — `enviarReguaCobranca` calcula a
   parcela mais antiga em atraso por contrato (`atrasoMaisAntigoPorContrato`) e só deixa essa parcela
   disparar mensagem/gerar PIX; qualquer parcela mais nova do mesmo contrato fica suprimida enquanto a
   mais velha não for resolvida. Ataca a causa raiz #2/#3 acima.
3. **Aviso no texto da mensagem** — gatilhos `D+1`/`D+3`/`D+7` ganham uma linha fixa: "Use apenas o código
   PIX enviado nesta mensagem. Não utilize códigos PIX de mensagens anteriores".
4. **Alerta automático se acontecer de novo** (defesa em profundidade, não bloqueia o pagamento):
   - Tempo real: `pagamentoAutomatico` checa se existe parcela mais antiga `atrasado` no mesmo contrato
     antes de processar o pagamento e chama `_notificarErroSistema` se sim (cobre webhook + o polling de
     fallback `verificarPagamentosEfi`, que reusa a mesma função).
   - Diário: novo check `SEQUENCIA_PAGAMENTO` em `auditarIntegridadeSistema` (severidade ALTO), backstop
     caso o alerta em tempo real falhe silenciosamente por algum motivo.

### Efeito colateral sabido, não resolvido
Os gatilhos da régua são únicos (D-5 a D+7, sem recorrência depois disso). Com o fix #2, uma parcela que
já passou de D+7 sem pagar (como a do incidente, 31 dias) também segura a mensagem da parcela seguinte —
o contrato fica sem nenhuma cobrança automática até alguém agir manualmente. Fecha o buraco que causou o
incidente, mas não resolve "régua para de cobrar depois de D+7" — gap separado, avaliado e deixado de
fora desse fix por decisão consciente (fora do escopo pedido).

### Descartado deliberadamente
Avaliada e descartada (nessa rodada) a proposta de: novos campos de schema pra rastrear realocação
(`ID_PARCELA_ORIGINAL`/`ATUAL`/`REALOCADO`/etc. — o rastro já sai da reutilização dos primitivos +
EVENTOS, sem precisar de coluna nova); um menu "Correções Financeiras" com função `reorganizarContrato()`
genérica (o check novo em `auditarIntegridadeSistema` já cobre a detecção, reaproveitando infra
existente); e o modelo "PIX do contrato calculado sob demanda, nunca reutilizado" (pressupõe portal do
cliente, que está no roadmap só pós-Supabase).

### Bug encontrado testando o botão "Realocar" pela primeira vez (mesmo dia)
Alex perguntou, ao testar no contrato real do incidente (PCL-Nº 185, Felipe Cassiano Lopes de Souza):
"e o código PIX da 4ª parcela, já que já foi pago, como fica agora?" — pergunta certeira que expôs uma
lacuna real no `reabrirParcelaAPI` (não só no `realocarPagamentoAPI` novo, que só chama ele por baixo).

**Problema:** `reabrirParcelaAPI` reseta `STATUS`/`DATA_PAGAMENTO`/`VALOR_PAGO`/etc. da parcela, mas nunca
tocava em `EFI_TXID`/`EFI_PIX_CODE`/`EFI_LINK`/`EFI_STATUS`. Como o TXID é determinístico por parcela
(`FOP<contrato>P<numParcela>`, não muda entre gerações normais) e o cobv correspondente já foi marcado
`CONCLUIDA` na Efí no momento do pagamento original, a parcela reaberta ficava com um PIX "morto" salvo —
a próxima cobrança (régua ou manual) reenviaria esse mesmo código já pago. Na melhor hipótese o cliente
simplesmente não consegue pagar de novo (cobv já concluída); na pior, se de alguma forma o pagamento fosse
processado, o webhook bloquearia por idempotência (`_idem_check` vendo o TXID já `PROCESSADO`) e o
dinheiro recebido não seria creditado em lugar nenhum — silenciosamente.

Gap pré-existente, não introduzido pelo fix de hoje — já afetava o botão "Reabrir" simples e o Motor de
Undo (`_reverterPagamentoNormal`/`_reverterSomenteJuros`), que sempre chamaram `reabrirParcelaAPI` por
baixo. Já existia até uma ferramenta manual pra mitigar em lote (`limparPixAbertosParaRegeneracao`, menu
GAS — varre todas as parcelas abertas e limpa `EFI_TXID`/`EFI_PIX_CODE`), mas nada limpava automaticamente
no momento da reabertura de uma parcela específica.

**Solução:** `reabrirParcelaAPI` agora limpa as 4 colunas EFI (`EFI_TXID`, `EFI_PIX_CODE`, `EFI_LINK`,
`EFI_STATUS`) da parcela reaberta, dentro do mesmo bloco que já zera `STATUS`/`DATA_PAGAMENTO`/etc.
(`appscript.gs`, seção "1. Resetar parcela"). Com as colunas vazias, a próxima vez que a parcela precisar
de PIX, `_gerarPixAvulso` gera do zero — e como o `upsertCobv(txidBase,...)` vai falhar (cobv original
ainda `CONCLUIDA` na Efí), cai automaticamente no fallback já existente de sufixo `R1`/`R2` (mesmo
mecanismo documentado na entrada de auditoria de PIX mais acima nesse arquivo), criando um cobv/TXID
genuinamente novo e pagável. Nenhuma mudança na Efí em si — só a limpeza de colunas que faltava.

### Status
**Verificado em produção (2026-08-01).** GAS publicado, frontend deployado. Contrato PCL-Nº 185 (Felipe
Cassiano Lopes de Souza) corrigido de ponta a ponta pelo botão "Realocar": parcela 4 voltou `pendente`
com EFI limpo, parcela 3 ficou `pago` com o valor/data corretos, contrato voltou a `ativo_em_dia`. Alex
testou manualmente a regeneração de PIX em massa (limpar `EFI_TXID`/`EFI_PIX_CODE` + "PIX → Gerar Todos
Contratos") e confirmou o resultado esperado: parcela 4 recebeu TXID novo com sufixo `R1`
(`FOP0000000000000185P000004R1`) e PIX genuinamente novo — o fallback funcionou exatamente como previsto
na revisão de código, sem precisar de nenhum ajuste adicional.

---

## 2026-08-01 — `rotinaAnalitica` estourava "Exceeded maximum execution time" (Google Apps Script)

### Problema
E-mails automáticos do Google ("Summary of failures for Google Apps Script") avisando falha de
`rotinaAnalitica` por `Exceeded maximum execution time` em duas execuções seguidas (30 e 31/07).

### Causa raiz
`_atualizarScoresDiario` (chamada por `rotinaAnalitica`) recalcula score + métricas de **todos** os
clientes ativos numa única execução, e `calcularScore`/`calcularMetricasCliente` fazem varredura linear
de CONTRATOS/PARCELAS/PAGAMENTOS **por cliente** — o custo cresce com o tamanho da carteira. Com a base
de clientes atual, uma passada completa já não cabe no limite de 6 minutos do Apps Script pra execuções
automáticas (trigger). Não é um bug de cálculo — as fórmulas de score/métricas continuam corretas; é
puramente a rotina de orquestração ficando lenta demais pro volume atual de dados.

### Solução
`_atualizarScoresDiario` (`appscript.gs`) processa em **lote com cursor persistido**:
- Monta a lista de clientes ativos e lê um cursor salvo em CONFIGURACOES (`CURSOR_SCORE_DIARIO` via
  `_getCfg`/`_setCfg`, chave criada automaticamente na primeira execução).
- Processa a partir do cursor, respeitando um orçamento de 4,5min por execução (`Date.now()` vs início).
- Ao final, grava onde parou (ou volta pro 0 se completou a volta inteira).
- Cada execução avança e nunca reprocessa do zero — completa o ciclo pela carteira inteira ao longo de
  várias execuções, sem nunca estourar o limite de 6min, independente de quantos clientes existirem.

Novo trigger `configurarTriggerAnalitica()` (menu GAS → "Analitica: Configurar Trigger a cada 2h (rodar
1x)") substitui o trigger antigo de `rotinaAnalitica` (que rodava 1x/dia, insuficiente pra ciclar a
carteira em lotes) por um a cada 2h — com o batching, isso garante ciclo completo em menos de um dia.

`rotinaAnalitica` e `rotinaVerificarPagamentos` também passaram a chamar `_notificarErroSistema` nos
catches — antes só logavam via `Logger.log`, e o único aviso de falha era o e-mail genérico e-mail do
próprio Google (o gatilho deste bug), não o canal de notificação real do sistema.

Nenhum cálculo financeiro/score foi alterado — só a orquestração do loop que os invoca.

### Status
Resolvido e publicado (2026-08-01). Falta rodar 1x o item de menu "Analitica: Configurar Trigger a cada
2h" pra substituir o trigger antigo pelo novo em lote.

---

## 2026-08-01 — Timeout de 300s no Efí travava função Vercel sem retornar JSON

### Problema
Primeiro aviso recebido via `_notificarErroSistema` (canal implementado em 2026-07-31): "Unexpected
token 'A', "An error o"... is not valid JSON", origem `rotinaVerificarPagamentos > verificarPagamentosEfi`.
A mensagem por si só não identifica a causa — não dava pra saber se era erro de dado, de API do Efí, ou
de infraestrutura só lendo o texto do erro.

### Causa raiz
Diagnóstico via `mcp__plugin_vercel_vercel__get_runtime_errors` (não pelos logs brutos, que já tinham
expirado a janela padrão) mostrou o erro real: `Vercel Runtime Timeout Error: Task timed out after 300
seconds` em `/api/efi-check-payments` — já tinha ocorrido 9x desde 2026-06-19, só ficou visível agora
porque a notificação de erro é recente.

`api/efi-auth.js` (`getEfiToken`/`efiRequest`, módulo compartilhado por 6 arquivos: `efi-charges.js`,
`efi-check-payments.js`, `efi-pix-avulso.js`, `efi-quitacao.js`, `efi-setup-webhook.js`,
`efi-test-webhook.js`) fazia `https.request` para o Efí **sem timeout configurado**. Se o Efí não
respondesse por qualquer instabilidade de rede, a Promise nunca resolvia nem rejeitava — a função Vercel
ficava pendurada até o limite de `maxDuration` (300s), momento em que a própria Vercel mata a execução e
devolve uma página de erro em texto puro ("An error occurred...") em vez de JSON. O GAS esperava JSON e,
ao tentar `JSON.parse()` essa página de erro, gerava a mensagem confusa reportada.

Impacto real era baixo — `verificarPagamentosEfi` é só um fallback de polling (o webhook Efí é o
mecanismo principal de registro de pagamento) — mas o mesmo bug podia travar silenciosamente qualquer um
dos outros 5 consumidores do módulo, incluindo a geração de PIX ao criar contrato.

### Solução
`options.timeout: 20_000` (20s) + `req.on("timeout", () => req.destroy(new Error(...)))` nos dois
`https.request` de `api/efi-auth.js`. `req.destroy(error)` emite `'error'` com esse error, então o
`req.on("error", reject)` já existente cobre o reject — sem precisar de handler duplicado. Todos os 6
consumidores já tinham `try/catch` em volta de `getEfiToken`/`efiRequest`, então o timeout agora vira erro
JSON limpo e rápido em vez de travar a função inteira por 5 minutos.

### Status
Resolvido e deployado (2026-08-01). Se investigar timeout/erro de função Vercel de novo, usar
`mcp__plugin_vercel_vercel__get_runtime_errors` (clusters agregados, não expira como os logs brutos)
antes de tentar adivinhar a causa pela mensagem de erro que chega no GAS.

---

## 2026-08-05 — Botão "Enviar PIX" do ContratoModal podia mandar código de parcela já paga

### Problema
Alex clicou no botão "Enviar PIX" dentro do modal do contrato (`ContratoModal`, `main.jsx`) e o WhatsApp
saiu com o código PIX da última parcela — que já constava como paga no sistema — em vez da parcela mais
antiga em aberto.

### Causa raiz
`proxParcela` (a parcela-alvo, `main.jsx:4031`) sempre foi calculada certo — é a mais antiga não-terminal.
O bug estava no código PIX exibido/enviado: `pixCodeToShow = pixCodeNew || pixCodeSaved`. `pixCodeNew` é
um `useState` preenchido só quando alguém clica em "Gerar PIX" manualmente (`_gerarPix`), e **nunca era
resetado** quando `proxParcela` mudava. Se o modal ficasse aberto e a parcela-alvo avançasse (ex: a
parcela que estava sendo cobrada foi paga por outro caminho enquanto o modal seguia aberto — polling de
`carregar()`/webhook em background), `pixCodeNew` continuava com o código antigo e passava a ser enviado
junto com os dados (número/valor/vencimento) da nova `proxParcela` — mensagem falando de uma parcela,
código PIX de outra. `enviarPixManual` (`appscript.gs`) não validava nada: recebia `pixCode` + `idParcela`
do frontend e só repassava pro WhatsApp, sem checar se o código realmente pertencia àquela parcela.

### Solução
Duas camadas de defesa, complementares:
1. **Frontend** (`main.jsx`, perto de `pixCodeToShow`): `useEffect` reseta `pixCodeNew`/`pixOk`/`pixErr`/
   `pixCopied`/`pixWppOk`/`pixWppErr` sempre que `proxParcela?.ID_PARCELA` muda — fecha a causa raiz.
2. **Backend** (`enviarPixManual`, `appscript.gs`): antes de enviar, busca a `STATUS` atual do `idParcela`
   recebido em PARCELAS e bloqueia (retorna erro, não envia WhatsApp) se ela já estiver em
   `STATUS_TERMINAL` — rede de segurança caso outro bug de frontend volte a mandar dado incoerente. Padrão
   reaproveitado: `buildColMap` + fallback `STATUS`/`STATUS_PAGAMENTO`, `STATUS_TERMINAL` global (não
   redefinido localmente).

Mesmo padrão (state de UI que não acompanha o dado-alvo quando ele muda) vale a pena checar em qualquer
outro componente que gere/exiba um código PIX preso a "a próxima parcela em aberto" — se aparecer de novo
em outro lugar, é o mesmo tipo de bug.

### Status
Resolvido e deployado (2026-08-05) — frontend via `vercel deploy --prod`, GAS colado e publicado
manualmente pelo Alex no editor do Apps Script.

---

## 2026-08-10 — PIX expira aos 30 dias de atraso sem regeneração, e primeira correção usava data errada

### Problema
Alex reportou que um cliente com parcela vencida há mais de 30 dias tinha um código PIX que "não vale
mais" — a Efí recusava o pagamento. Investigação revelou uma cadeia de três problemas relacionados,
todos corrigidos na mesma sessão.

### Causa raiz 1 — nada regenerava o PIX depois que ele expirava
Cobv Efí normal tem `validadeAposVencimento: 30` (`api/efi-charges.js`/`api/efi-pix-avulso.js`) — aos 30
dias de atraso a Efí invalida o código. A régua automática (D-5 a D+7) já parou de tocar na parcela bem
antes disso (7 dias), e o botão de gerar PIX no `ContratoModal` só aparecia quando o campo `EFI_PIX_CODE`
estava vazio — nunca quando havia um código velho e morto salvo. Ninguém tinha como perceber isso além do
cliente tentar pagar e reclamar.

### Causa raiz 2 — primeira correção usou `DATA_ACORDO` como se fosse a data real da dívida
Primeira tentativa de correção tratou parcelas reagendadas (`DATA_ACORDO` futura) como "não vencidas",
espelhando o critério de `statusEfetivo()` do frontend. Isso causou dois problemas ao testar no contrato
PCL-Nº143 (Gustavo Augusto, parcela reagendada + parcela atrasada normal no mesmo contrato):
- A parcela reagendada deixou de ser oferecida pra regeneração (mesmo tendo `DATA_VENCIMENTO` original
  com dezenas de dias de atraso), e quando regenerada manualmente saiu com o valor base, sem juros/multa
  — porque `dataVencimento` mandado pra Efí acabou sendo hoje (a `DATA_VENCIMENTO` original, no passado,
  foi clampada) em vez da data real do débito.
- Alex esclareceu a regra de negócio: `DATA_ACORDO` é **só o registro da promessa/previsão de pagamento
  do cliente** — reflete a percepção de honestidade/relacionamento dele com a empresa, não altera a
  dívida real nem gera efeito algum no sistema. Toda lógica de PIX (expiração, regeneração, cálculo de
  encargo) deve usar exclusivamente a `DATA_VENCIMENTO` original, sempre.

### Causa raiz 3 — clamping da data pra "hoje" reseta o cálculo dinâmico de mora da Efí
Mesmo usando a `DATA_VENCIMENTO` certa, regenerar uma cobv vencida exige mandar `calendario.dataDeVencimento`
hoje-ou-futuro pra Efí (senão a cobv nasceria com a janela de validade já expirada) — isso zera o "relógio"
que a Efí usa pra calcular multa/juros de mora dinamicamente (payload `valor.multa`/`valor.juros`,
modalidade 2). Resultado: regenerar uma parcela genuinamente atrasada fazia o cliente pagar só o valor
base, sem encargo nenhum — o oposto do que deveria acontecer.

Uma iteração intermediária tentou mandar *todas* as parcelas em aberto do contrato pra Efí de uma vez
(pra cobrir contratos com 2+ parcelas atrasadas simultâneas) — mas isso incluía parcelas com atraso ≤30
dias, cujo PIX ainda estava válido e calculando mora corretamente de forma dinâmica; regenerá-las sem
necessidade quebrava esse cálculo (mesmo bug da causa raiz 3, só que numa parcela que não precisava ser
tocada). Corrigido antes de chegar em produção pro Alex, mas um teste anterior a essa correção deixou a
parcela 6 do PCL-Nº143 com ~R$43 de mora não capturada (23 dias de atraso na época) — avaliado junto com
o Alex e decidido **não corrigir**: o esforço de rastrear e ajustar manualmente é maior que o valor em
jogo. Fica documentado aqui caso o padrão apareça de novo em outro contrato.

### Solução final
1. **Detecção de PIX expirado** (`ContratoModal`, `main.jsx`) — parcela pendente mais antiga (`proxParcela`)
   com mais de 30 dias de atraso pela `DATA_VENCIMENTO` original mostra aviso vermelho e troca os botões
   "Enviar"/"Copiar" por "Gerar novo PIX".
2. **Botão "Gerar PIX novamente"** — novo item em "Mais ações", sempre disponível quando já existe um
   código salvo (cobre o caso de o código já ter sido gerado errado antes do fix). Avalia cada parcela em
   aberto do contrato **independentemente** pela própria `DATA_VENCIMENTO`; só manda pra Efí as que têm
   mais de 30 dias de atraso — as demais não são tocadas.
3. **Cálculo de encargo** (`api/efi-charges.js`, `api/efi-pix-avulso.js`) — pra parcela >30 dias, calcula
   multa (`EFI_MULTA_PCT`) + juros de mora (`EFI_JUROS_DIARIO` × dias) sobre o valor da parcela e embute
   como `valor.original` fixo, removendo os campos dinâmicos `valor.multa`/`valor.juros` do payload (evita
   cobrar 2×). Fórmula completa em `docs/ai-memory/03-AI-FINANCIAL-CALCULATIONS.md`.
4. **Rotina automática** (`_regenerarPixVencidos`, `appscript.gs`, chamada em `rotinaDiaria()` após
   `enviarReguaCobranca()`) — roda a cada 25 dias de atraso (25, 50, 75...) mantendo o PIX de parcelas
   abertas sempre válido, silenciosamente (sem mensagem). Usa a mesma `DATA_VENCIMENTO` original, nunca
   `DATA_ACORDO`. **Gap conhecido, não corrigido**: dispara pela primeira vez aos 25 dias (antes do limite
   de 30), e nesse disparo o encargo ainda não é embutido (só ativa >30d) — então o primeiro refresh
   automático perde os 25 dias de mora já acumulados, do mesmo jeito que a causa raiz 3 acima. Consultado
   com o Alex; ele preferiu manter o limite de 30 dias só pro botão manual e não decidiu ainda se vale a
   pena estender a correção pra rotina automática — reavaliar se aparecer de novo.

### Status
Resolvido e deployado (2026-08-10) — frontend via `vercel deploy --prod` (múltiplas iterações no mesmo
dia), GAS colado e publicado pelo Alex no editor do Apps Script (2 tentativas — a primeira teve uma
corrupção de 3 caracteres na linha 1 do arquivo ao reabrir no TextEdit, "O dvar ABAS" em vez de "var
ABAS", causando `SyntaxError` no Apps Script; corrigido e republicado). Testado em produção em dois
contratos reais (PCL-Nº133/Suzileide, PCL-Nº143/Gustavo) e confirmado funcionando pelo Alex num terceiro
contrato à parte.

---

## 2026-08-10 — Botão "Proposta WPP" sumia no fluxo "renegociar sem entrada"

### Problema
Ao implementar a entrada mínima dinâmica + checkbox "Assumir o risco e dispensar a entrada mínima" no
`RenegociacaoModal` (`src/main.jsx`), o botão "Proposta WPP" desaparecia sempre que o Alex marcava a
checkbox e deixava o campo Entrada em branco (fluxo "renegociar sem entrada", ver
`docs/ai-memory/02-AI-CREDIT-RULES.md`). Reportado pelo Alex minutos depois do deploy, com screenshot.

### Causa raiz
O componente tem a mesma condição de exibição (`entradaNum>0&&valorDesejadoNum>0`) duplicada em dois
lugares do JSX: uma controla o preview de parcelamento no corpo do modal, outra controla o botão
"Proposta WPP" no rodapé. Ao adicionar o caminho "sem entrada" (`semEntrada = assumirRisco &&
entradaNum<=0`), a condição do preview foi corrigida para `(entradaNum>0||semEntrada)&&...`, mas a
condição do botão WPP — texto idêntico, localização diferente — ficou esquecida com a versão antiga.
Sintoma enganoso: o campo Entrada mostrava `placeholder={entradaMinima.toFixed(2)}` (ex: "304.00") que
visualmente parece um valor preenchido, mas o campo estava vazio de verdade — daí a confusão inicial de
que "marcar a checkbox" quebrava o botão, quando na verdade era o campo vazio (comportamento esperado do
fluxo "sem entrada") combinado com a condição não corrigida.

### Solução
Aplicado o mesmo `(entradaNum>0||semEntrada)&&valorDesejadoNum>0` nas duas condições. Commit `f5bb66d`.

### Lição
Ao corrigir uma condição de exibição em JSX, `grep` pelo texto exato da condição no arquivo inteiro antes
de considerar a mudança completa — este arquivo específico repete a mesma condição em mais de um lugar
(corpo do modal + rodapé) para vários botões/blocos condicionais.

### Status
Resolvido e deployado (2026-08-10), mesmo dia do bug original. Confirmado funcionando pelo Alex.

---

## Débitos Técnicos

- `_regenerarPixVencidos` (`appscript.gs`) dispara pela primeira vez aos 25 dias de atraso, mas só embute
  o encargo de mora quando >30 dias — o primeiro refresh automático de cada parcela perde os 25 dias já
  acumulados (mesma causa raiz do bug 2026-08-10 acima, ainda não estendida pra rotina automática).
- Contrato PCL-Nº143 (Gustavo Augusto), parcela 6: ~R$43 de mora não capturada por um teste durante o fix
  de 2026-08-10, antes da correção final — decisão consciente do Alex de não corrigir manualmente (custo
  de rastrear > valor em jogo).
- `src/main.jsx` com ~6000+ linhas — candidato a modularização futura (Fase 3).
- Contratos anteriores à implementação PIX Efí não possuem colunas `EFI_*` preenchidas (sem backfill).
- Migração Google Sheets → Supabase pendente (Fase 3 do roadmap).
- PDD v1.0 implementado (Jun/2026). Próxima revisão de percentuais: 50 contratos encerrados ou Dez/2026.
- Contratos em `acordo_assistido` antes de 2026-06-14 não têm `DATA_ENTRADA_ACORDO_ASSISTIDO` preenchida; o GAS usa fallback para a data de criação, o que pode ser impreciso na regra dos 180 dias.
- `DIFERENCA_RECEBIDA` em PAGAMENTOS: campo histórico (81 registros pré-feature); não é mais gravado em novos pagamentos. Usar `RECEITA_EXTRA_ATRASO` como campo oficial.
- `FEE_PRORROGACAO` em PAGAMENTOS: campo criado em 2026-06-19. Registros de somente_juros anteriores têm o fee em `RECEITA_EXTRA_ATRASO` (não em `FEE_PRORROGACAO`). Somas financeiras usam `RECEITA_EXTRA_ATRASO + FEE_PRORROGACAO` para cobrir ambos os casos. O KPI "Fee de Prorrogação" é preciso apenas para pagamentos a partir de 2026-06-19.
- `RENDA_BRUTA`/`RENDA_LIQUIDA`/`RENDA_MENSAL` em CLIENTES: formato inconsistente em registros antigos (com/sem vírgula, com/sem ponto, texto vs número) — decisão consciente de não fazer backfill (ver entrada 2026-07-28 acima, uma tentativa automática corrompeu dado real). Um cliente com Limite de Crédito parecendo `R$0,00` ou visualmente errado no `ClienteModal` pode só precisar ter a renda redigitada manualmente — a entrada agora está blindada (frontend + conversão a Number no GAS), só o dado já existente pode estar assim.
- Observações de eventos financeiros no GAS (ex: `registrarQuitacaoJudicial`, `registrarAcordoComPerda`) usam `.toFixed(2)` puro (`"R$ 1464.00"`) em vez de formatação pt-BR (`"R$ 1.464,00"`) — padrão já estabelecido em todo o GAS, não é regressão da Recuperação Judicial. Aparece em `OBSERVACOES` de EVENTOS e, por consequência, na timeline "Percurso do Contrato" do Extrato (§20 DESIGN_SYSTEM.md). Não corrigido — mudaria convenção em várias funções pré-existentes fora do escopo do módulo judicial.
- `TemplatesReguaModal` (`main.jsx`) tem `LABELS`/`ORDEM` hardcoded com 10 chaves; `TEMPLATE_CERTIFICADO_QUITACAO` existe no backend mas não aparece na UI de edição — só editável direto na aba CONFIGURACOES.
- Auditoria automática (`auditarIntegridadeSistema`) e backup automático (`fazerBackupAutomatico`) têm as funções prontas mas **os triggers (`configurarTriggerAuditoria`, `configurarTriggerBackup`) precisam ser rodados manualmente 1x no editor do GAS** — não há garantia de que já estejam ativos em produção; confirmar em Extensões → Apps Script → Gatilhos antes de assumir que rodam diariamente.
- Motor de undo (`UNDO_LOG`) e idempotência (`OPERACOES_PROCESSADAS`) não têm rotina de limpeza/arquivamento — as abas crescem indefinidamente (baixo volume, mas sem TTL de exclusão de linhas, só de status).
