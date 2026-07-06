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

**Limitação conhecida:** cobre só reincidência pós-**renegociação estrutural**. Reincidência pós-**Acordo Assistido** (cliente sai do acordo via `sairDoAcordoAssistido` e atrasa de novo) não é detectada por essa regra — `sairDoAcordoAssistido` limpa `DATA_ENTRADA_ACORDO_ASSISTIDO` e não existe hoje nenhum campo persistente equivalente ao `ORIGEM_PARCELA="renegociada"` para marcar "já passou por Acordo Assistido antes". Se for necessário no futuro, precisa de um sinal novo (ex: flag em CONTRATOS ou evento em EVENTOS consultado no frontend).

### Status
Resolvido (2026-07-05) para o caso de renegociação — caso de Acordo Assistido em aberto.

---

## Débitos Técnicos

- `src/main.jsx` com ~6000+ linhas — candidato a modularização futura (Fase 3).
- Contratos anteriores à implementação PIX Efí não possuem colunas `EFI_*` preenchidas (sem backfill).
- Migração Google Sheets → Supabase pendente (Fase 3 do roadmap).
- PDD v1.0 implementado (Jun/2026). Próxima revisão de percentuais: 50 contratos encerrados ou Dez/2026.
- Contratos em `acordo_assistido` antes de 2026-06-14 não têm `DATA_ENTRADA_ACORDO_ASSISTIDO` preenchida; o GAS usa fallback para a data de criação, o que pode ser impreciso na regra dos 180 dias.
- `DIFERENCA_RECEBIDA` em PAGAMENTOS: campo histórico (81 registros pré-feature); não é mais gravado em novos pagamentos. Usar `RECEITA_EXTRA_ATRASO` como campo oficial.
- `FEE_PRORROGACAO` em PAGAMENTOS: campo criado em 2026-06-19. Registros de somente_juros anteriores têm o fee em `RECEITA_EXTRA_ATRASO` (não em `FEE_PRORROGACAO`). Somas financeiras usam `RECEITA_EXTRA_ATRASO + FEE_PRORROGACAO` para cobrir ambos os casos. O KPI "Fee de Prorrogação" é preciso apenas para pagamentos a partir de 2026-06-19.
- Observações de eventos financeiros no GAS (ex: `registrarQuitacaoJudicial`, `registrarAcordoComPerda`) usam `.toFixed(2)` puro (`"R$ 1464.00"`) em vez de formatação pt-BR (`"R$ 1.464,00"`) — padrão já estabelecido em todo o GAS, não é regressão da Recuperação Judicial. Aparece em `OBSERVACOES` de EVENTOS e, por consequência, na timeline "Percurso do Contrato" do Extrato (§20 DESIGN_SYSTEM.md). Não corrigido — mudaria convenção em várias funções pré-existentes fora do escopo do módulo judicial.
- `TemplatesReguaModal` (`main.jsx`) tem `LABELS`/`ORDEM` hardcoded com 10 chaves; `TEMPLATE_CERTIFICADO_QUITACAO` existe no backend mas não aparece na UI de edição — só editável direto na aba CONFIGURACOES.
- Auditoria automática (`auditarIntegridadeSistema`) e backup automático (`fazerBackupAutomatico`) têm as funções prontas mas **os triggers (`configurarTriggerAuditoria`, `configurarTriggerBackup`) precisam ser rodados manualmente 1x no editor do GAS** — não há garantia de que já estejam ativos em produção; confirmar em Extensões → Apps Script → Gatilhos antes de assumir que rodam diariamente.
- Motor de undo (`UNDO_LOG`) e idempotência (`OPERACOES_PROCESSADAS`) não têm rotina de limpeza/arquivamento — as abas crescem indefinidamente (baixo volume, mas sem TTL de exclusão de linhas, só de status).
