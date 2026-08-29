# Correção: promessas não fechadas ao quitar contrato

**Data:** 2026-08-29
**Tipo:** Bug fix — GAS (Tier 3)
**Origem:** alerta de segurança `enviarReguaCobranca` de 29/08/2026 07:09
 (`ERRO_SEM_PIX`, cliente Jeovanio Pereira Souza, contrato PCL-Nº 214)

---

## 1. Incidente

| Data | Evento |
|---|---|
| 10/08 | Promessa PRM00067: cliente 51 pagaria a parcela 3 do PCL-Nº 214 em 28/08 (R$ 453,33) |
| 27–28/08 | Régua enviou PROMESSA_D-1 e PROMESSA_D0 normalmente |
| 28/08 ~12:06 | Cliente pagou a parcela 3 (R$ 463,88, com atraso). Contrato **quitado**. Certificado de quitação enviado. |
| 29/08 07:09 | Régua rodou, viu PRM00067 ainda `PENDENTE`, disparou `PROMESSA_D+1`. Contrato sem parcela aberta → sem PIX → `ERRO_SEM_PIX` → `_notificarErroSistema` → e-mail de alerta. |
| 29/08 07:09 | `verificarPromessasVencidas` marcou PRM00067 como `QUEBRADA` — indevidamente (foi paga no dia combinado). |

**Impacto financeiro:** nenhum. Contrato quitado corretamente, certificado entregue.
**Dano colateral:** promessa marcada QUEBRADA injustamente (penaliza `PROMESSAS_QUEBRADAS` / score do cliente) + alerta espúrio + cliente recebeu no dia 29 uma mensagem dizendo que o pagamento "não foi identificado".

## 2. Causa raiz

`_cancelarPromessasPorContrato()` (marca promessas `PENDENTE` do contrato como `CUMPRIDA`) só é
chamada de dentro de `_enviarConfirmacaoPagamento()` (passo 7, ~linha 7435).

Quando o pagamento **quita o contrato**, os dois caminhos pulam a confirmação e enviam só o certificado:

- `registrarPagamentoAPI` — `if (!todasPagas) { _enviarConfirmacaoPagamento(...) }` (~linha 3651)
- `registrarQuitacaoAntecipada` — bloco `if (todasPagas)` só chama `_gerarEEnviarCertificado` (~linha 2536)

Logo, promessa pendente num contrato que é quitado **nunca** é fechada. Vale para pagamento manual,
webhook Efí (`pagamentoAutomatico` → `registrarPagamentoAPI`) e quitação antecipada.

## 3. Correções

### A. Fechar promessas ao quitar (raiz) — `appscript.gs`

Após a geração do certificado, nos dois pontos:

- `registrarPagamentoAPI` (~linha 3628, dentro de `if (todasPagas)`)
- `registrarQuitacaoAntecipada` (~linha 2539, dentro de `if (todasPagas)`)

```javascript
try { _cancelarPromessasPorContrato(idContrato); } catch(eP) { Logger.log("CancelProm err: "+eP.message); }
```

`_cancelarPromessasPorContrato` passa a gravar também `DATA_CUMPRIMENTO` (data de hoje) junto com
`STATUS_PROMESSA = "CUMPRIDA"`. Hoje só mexe no status. Comportamento idêntico nos dois chamadores
(o já existente em `_enviarConfirmacaoPagamento` e os dois novos).

### B. Defesa na régua — `appscript.gs`, loop de promessas de `enviarReguaCobranca` (~linha 8234)

Antes de enfileirar o disparo de promessa, consultar `contMap[prom.ID_CONTRATO]`:

- Se `ST_SKIP_C[cont.STATUS_CONTRATO]` (quitado, cancelado, baixado_como_prejuizo, acordo_assistido,
  renegociado, encerrado_judicialmente…) **ou** o contrato não tem nenhuma parcela fora de
  `ST_SKIP_P` → **não enfileira** o evento (sem mensagem, sem `_logMensagem`, sem erro).
- Resolver a promessa na hora (exceto em `dryRun`):
  - `STATUS_CONTRATO === "quitado"` → `CUMPRIDA` + `DATA_CUMPRIMENTO` = hoje
  - qualquer outro status terminal → `QUEBRADA`
  - contrato não-terminal mas sem parcela aberta (status defasado, caso raro) → só pula, não toca no status
- `dryRun` (`testarReguaCobranca`): não grava nada, só `Logger.log` do que faria.

Para gravar, `promMap` passa a guardar o número da linha da promessa (`_row`).

### C. Correção de dados histórica — nova função no menu GAS

`corrigirPromessasQuebradasIndevidamente()` — menu: "Régua: Corrigir Promessas Quebradas Indevidamente".

- Varre PROMESSAS com `STATUS_PROMESSA === "QUEBRADA"`.
- Para cada uma: se o contrato está `quitado` **e** existe pagamento (PAGAMENTOS) nesse contrato com
  `DATA_PAGAMENTO` entre `DATA_PREVISTA_PAGAMENTO − 2 dias` e `DATA_PREVISTA_PAGAMENTO + 7 dias` →
  marca `CUMPRIDA`, grava `DATA_CUMPRIMENTO` = data desse pagamento.
- Junta os `ID_CLIENTE` afetados e roda `calcularScore` + `calcularMetricasCliente` para cada um.
- Loga um resumo (quantas varridas, quantas corrigidas, IDs). Grava na mesma execução (não é dry-run).
- Datas comparadas via `parseDateLocal`.
- Promessas quebradas de verdade (pagamento fora da janela, ou contrato não quitado) ficam como estão.

**Janela de ±2/+7 dias:** define "pagou perto do combinado, sistema só não fechou" vs. "quebrou de
verdade". Ajustável.

## 4. Fora de escopo

- Mensagem ao quitar continua sendo só o certificado (sem confirmação de pagamento adicional).
- Nenhum campo novo em nenhuma aba.
- Nenhuma alteração em cálculo financeiro, geração de PIX, ou status de contrato/parcela.
- Recorrência da régua além de D+7 (gap conhecido separado).

## 5. Verificação (Tier 3)

- [ ] `testarReguaCobranca()` dry-run: promessa de contrato quitado não aparece na fila; log indica que seria pulada.
- [ ] Simular pagamento que quita contrato com promessa `PENDENTE` ativa → promessa vira `CUMPRIDA` + `DATA_CUMPRIMENTO` preenchida, na mesma execução.
- [ ] Rodar `corrigirPromessasQuebradasIndevidamente()` → PRM00067 vira `CUMPRIDA`, score/métricas do cliente 51 recalculados; promessas legítimas intactas.
- [ ] `auditarIntegridadeSistema()` sem novos alertas de promessa órfã/inconsistente.
- [ ] Sem regressão no fluxo normal (pagamento de parcela não-final ainda envia confirmação e fecha promessa como antes).
- [ ] Deploy do GAS: abrir TextEdit, colar arquivo completo, publicar nova versão do Web App.

## 6. Checklist de integridade GAS

- [x] Datas via `parseDateLocal` — nunca `new Date("YYYY-MM-DD")`
- [x] Colunas via `buildColMap` — nunca índice fixo
- [x] `STATUS_TERMINAL` global não redefinido localmente
- [x] Status terminais não reabertos
- [x] Nada muda em juros / multa / VALOR_PAGO
