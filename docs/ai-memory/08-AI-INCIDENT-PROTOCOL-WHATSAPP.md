# PROTOCOLO DE INCIDENTE — AUTOMAÇÃO WHATSAPP

**Sistema:** FinanceiroOp
**Integração:** Evolution GO
**Fluxos:** Régua de cobrança + confirmação de pagamento + bot WhatsApp (triagem)
**Objetivo:** identificar a causa real de qualquer falha, corrigir com segurança e restaurar a operação no menor tempo possível.

Use este documento sempre que: a régua parar de enviar, uma confirmação de pagamento não chegar, o bot de triagem parar de responder, ou qualquer mensagem sair errada/duplicada/faltando.

---

## 1. REGRA PRINCIPAL

* [ ] Não alterar código imediatamente.
* [ ] Não executar reenvio em massa.
* [ ] Não apagar registros da aba `MENSAGENS`.
* [ ] Não executar a régua repetidamente sem diagnóstico.
* [ ] Não reiniciar contêineres da VPS sem antes olhar os logs — o restart pode mudar a porta do Evolution GO (ver Etapa 4) e mascarar a causa real.
* [ ] Registrar o horário aproximado em que o problema foi percebido.
* [ ] Identificar primeiro qual fluxo está afetado.

**Fluxos possíveis:**

* [ ] Régua automática de cobrança
* [ ] Confirmação automática de pagamento
* [ ] Envio manual pelo sistema
* [ ] Bot/triagem de novos leads
* [ ] Todos os fluxos WhatsApp (sinal forte de causa de infraestrutura — ir direto pra Etapa 0)

---

## 2. ETAPA 0 — TRIAGEM RÁPIDA DE INFRAESTRUTURA (2 min)

Fazer **sempre primeiro**, antes de qualquer investigação em GAS ou Sheets. Se "todos os fluxos" pararam ao mesmo tempo, é o sinal mais forte de que o problema é aqui, não em lógica de negócio.

* [ ] Abrir o painel Evolution GO (`http://76.13.228.217:<porta atual>/manager` — ver Etapa 4 se a porta não carregar)
* [ ] Verificar status da instância ativa: **Conectado** ou **Desconectado**?
* [ ] Se **Desconectado**: causa é de infraestrutura → pular direto para a **Etapa 4**
* [ ] Se **Conectado**: infraestrutura está OK → seguir o fluxo normal a partir da **Etapa 1** (a causa está em lógica/dados, não na conexão)

---

## 3. CLASSIFICAR O INCIDENTE

### A. Nenhuma mensagem foi enviada

* [ ] Verificar se o trigger executou.
* [ ] Verificar se `enviarReguaCobranca()` foi executada.
* [ ] Verificar se havia clientes elegíveis.
* [ ] Verificar se a regra de deduplicação bloqueou o envio.

### B. Algumas mensagens foram enviadas e outras não

* [ ] Comparar um cliente que recebeu com um que não recebeu.
* [ ] Comparar `ID_CLIENTE`.
* [ ] Comparar `ID_CONTRATO`.
* [ ] Comparar `ID_PARCELA`.
* [ ] Comparar telefone.
* [ ] Comparar gatilho.
* [ ] Verificar `STATUS_ENVIO`.

### C. Mensagem foi enviada com conteúdo errado

* [ ] Verificar dados da parcela.
* [ ] Verificar template.
* [ ] Verificar substituição das variáveis.
* [ ] Verificar valor da parcela.
* [ ] Verificar número da parcela.
* [ ] Verificar vencimento.
* [ ] Verificar PIX.
* [ ] Verificar mapeamento das colunas.

### D. Mensagem duplicada

* [ ] Verificar registros na aba `MENSAGENS`.
* [ ] Verificar `STATUS_ENVIO`.
* [ ] Verificar funcionamento de `_jaEnviouHoje()`.
* [ ] Verificar execução duplicada do trigger.
* [ ] Verificar se houve execução manual simultânea.
* [ ] Não apagar os registros antes de entender a causa.

### E. WhatsApp não recebe mensagens, mas sistema indica ENVIADO — ou instância aparece desconectada

* [ ] Ir direto para **Etapa 0** (se ainda não foi feita) e depois **Etapa 4**.
* [ ] Testar envio controlado para número próprio.

---

## 4. ETAPA 1 — O TRIGGER EXECUTOU?

A régua automática é executada pelo trigger diário das 7h (backup às 8h — `rotinaRegua()`).

* [ ] Abrir Google Apps Script.
* [ ] Verificar `Executions`.
* [ ] Procurar execução próxima das 7h (e 8h, se a de 7h falhou antes de chegar na régua).
* [ ] Confirmar se `enviarReguaCobranca()` foi chamada.
* [ ] Verificar duração da execução.
* [ ] Verificar erro da execução.
* [ ] Verificar se houve timeout.
* [ ] Verificar se o trigger está ativo.

### Se NÃO executou:

**Causa provável:** trigger/GAS.

* [ ] Corrigir trigger.
* [ ] Executar manualmente somente após confirmar segurança.
* [ ] Registrar incidente.
* [ ] Ir para Etapa 8 — validação.

### Se executou:

* [ ] Prosseguir para Etapa 2.

---

## 5. ETAPA 2 — HAVIA CLIENTES ELEGÍVEIS?

A régua possui regras que podem impedir legitimamente um envio:

* `PERFIL_COBRANCA = EVASIVO`
* contrato em status terminal
* contrato em `acordo_assistido`
* promessa ativa
* ausência de gatilho naquele dia
* mensagem já enviada com sucesso no mesmo dia
* parcela mais antiga do contrato ainda em atraso (régua não avança pra parcela seguinte enquanto isso não resolver — ver `CLAUDE.md`)

Para o cliente afetado:

* [ ] Confirmar cliente.
* [ ] Confirmar contrato.
* [ ] Confirmar parcela.
* [ ] Confirmar status da parcela.
* [ ] Confirmar dias de atraso/antecedência.
* [ ] Confirmar gatilho esperado.
* [ ] Confirmar `PERFIL_COBRANCA`.
* [ ] Confirmar existência de promessa.
* [ ] Confirmar se já existe `ENVIADO` no dia.
* [ ] Confirmar se existe parcela mais antiga do mesmo contrato ainda em atraso.

### Se não era elegível:

**Não é falha de WhatsApp.**

* [ ] Registrar como comportamento esperado.
* [ ] Não alterar código.

### Se deveria ser elegível:

* [ ] Prosseguir para Etapa 3.

---

## 6. ETAPA 3 — O SISTEMA TENTOU ENVIAR?

Abrir a aba `MENSAGENS`.

Cada disparo deve possuir:

* `ID_MENSAGEM`
* `DATA_ENVIO`
* `ID_CLIENTE`
* `ID_CONTRATO`
* `ID_PARCELA`
* `TELEFONE`
* `GATILHO`
* `CONTEUDO`
* `STATUS_ENVIO`

Os status previstos são `ENVIADO`, `ERRO_ENVIO`, `ERRO_SEM_PIX` e `REENVIADO_MANUAL`.

### Situação 1 — Não existe registro

Possível falha:

**regra → seleção → execução → chamada da função de envio**

* [ ] Verificar lógica de seleção.
* [ ] Verificar `enviarReguaCobranca()`.
* [ ] Verificar `_enviarWppRegua()`.
* [ ] Executar `testarReguaCobranca()` em dry-run.
* [ ] Comparar resultado esperado com resultado real.

### Situação 2 — Existe `ERRO_ENVIO`

Possível falha:

**Evolution/API/autenticação/número/requisição → ir para Etapa 4**

* [ ] Registrar erro exatamente como retornado.
* [ ] Não modificar código ainda.
* [ ] Prosseguir para Etapa 4.

### Situação 3 — Existe `ERRO_SEM_PIX`

Possível falha:

**Efí/PIX/parcela**

* [ ] Verificar `EFI_PIX_CODE`.
* [ ] Verificar parcela.
* [ ] Verificar geração do PIX.
* [ ] Verificar resposta da Efí.
* [ ] Não tratar como falha do WhatsApp.

### Situação 4 — Existe `ENVIADO`

* [ ] Não reenviar imediatamente.
* [ ] Prosseguir para Etapa 5.

---

## 7. ETAPA 4 — DIAGNÓSTICO DE INFRAESTRUTURA EVOLUTION GO

Esta etapa cobre tanto configuração (URL/token errados) quanto **falha real do serviço** (VPS/Docker) — a categoria de causa mais recorrente até hoje (3 incidentes de porta + 1 de Postgres + 1 de instância corrompida).

### 4.1 — Configuração básica (sempre conferir primeiro)

A integração oficial documentada utiliza:

`POST {EVOLUTION_URL}/send/text`

Body: `{ number, text, instanceId }`
Header: `apikey: {EVOLUTION_KEY}` (token da instância, **não** a GLOBAL_API_KEY)

* [ ] `CONFIGURACOES.EVOLUTION_URL` (Sheets, linha ~26)
* [ ] `CONFIGURACOES.EVOLUTION_KEY` (Sheets, linha ~27)
* [ ] `CONFIGURACOES.EVOLUTION_INSTANCE` (Sheets, linha ~28)
* [ ] `EVOLUTION_API_URL` / `EVOLUTION_API_KEY` / `EVOLUTION_INSTANCE` na Vercel (env vars) — batem com o Sheets?
* [ ] Número no formato `55 + DDD + número` (13 dígitos).

Se algum desses estiver desatualizado, é quase sempre porque o painel Evolution GO mudou de porta ou de instância (ver 4.2) e ninguém atualizou os 2 lugares.

### 4.2 — O painel não carrega, ou trava tentando conectar/criar instância

O contêiner `evolution-go-oizv-api-1` (na VPS Hostinger, hPanel → Gerenciador Docker) **não fixa a porta de forma durável** — ela já mudou sozinha 3 vezes (histórico completo em `docs/ai-memory/07-AI-KNOWN-ISSUES.md` e na memória de sessão `evolution-go-infra`). Qualquer restart do contêiner é candidato a mudar a porta de novo.

**Passo 1 — confirmar a porta atual:**
hPanel → VPS → Gerenciador Docker → projeto `evolution-go-oizv` → card `evolution-go-oizv-api-1` → conferir a porta mapeada (`XXXXX:4000`). Se o navegador estava numa aba com a porta antiga, ela vai parecer "fora do ar" ou devolver dados vazios/errados — **não é perda de dados**, é só porta errada.

**Passo 2 — se a porta mudou, atualizar nos 2 lugares:**
```bash
vercel env rm EVOLUTION_API_URL production --yes
echo "http://76.13.228.217:<porta nova>" | vercel env add EVOLUTION_API_URL production
vercel deploy --prod
```
E editar `CONFIGURACOES.EVOLUTION_URL` direto na planilha (aba CONFIGURACOES, linha ~26) com a mesma URL.

**Passo 3 — se depois de corrigir a porta a instância ainda aparece "Desconectado":**
Tentar reconectar (gerar QR) normalmente. Se conectar, pronto — não precisa dos passos abaixo.

### 4.3 — QR trava em "Aguardando QR Code..." (não gera)

Duas causas distintas já confirmadas, **mesmo sintoma na tela** — diferenciar sempre pelo log do contêiner (Gerenciador Docker → Logs) antes de agir:

**Causa A — nome de instância corrompido** (visto em 2026-07-31)
Log mostra `No QR code available yet, waiting a bit more...` em loop, **sem nenhum erro explícito**.
* [ ] Não insistir recriando a mesma instância — não resolve.
* [ ] Criar uma instância **com nome diferente** (ex: `borges-fp` → `borges-fp2`) e conectar essa.
* [ ] A instância antiga fica abandonada (não precisa deletar).

**Causa B — Postgres saturado** (visto em 2026-08-13)
Log mostra explicitamente:
```
Failed to create container: failed to upgrade database: failed to check if version table is up to date: pq: sorry, too many clients already
```
* [ ] Não adianta trocar o nome da instância — o problema é no banco de dados compartilhado.
* [ ] hPanel → Visão Geral → card **"Evolution Go"** → menu "⋮" → **"Reiniciar"** (reinicia API + Postgres juntos, mais simples que reiniciar cada contêiner separado).
* [ ] Depois do restart, reconferir a porta (Passo 4.2) — ela pode ter mudado.
* [ ] Tentar conectar/criar instância de novo.

**Se a criação de instância falhar e o log do servidor não mostrar nada da tentativa** (nem erro, nem sucesso): suspeitar de porta/URL errada no navegador antes de qualquer outra causa. Abrir o DevTools do navegador (F12) → aba **Console** ou **Network** e procurar o erro real (ex: `net::ERR_CONNECTION_TIMED_OUT`, `timeout of 30000ms exceeded`) — geralmente mais rápido que só olhar log do servidor pra esse sintoma específico.

### 4.4 — Teste controlado (fazer sempre após qualquer correção de infra)

Enviar **uma única mensagem para o número do operador**:
```bash
curl -X POST http://76.13.228.217:<porta>/send/text \
  -H "apikey: <token da instância>" \
  -H "Content-Type: application/json" \
  -d '{"number":"5562984877843","text":"Teste de reconexao.","instanceId":"<nome da instancia>"}'
```
* [ ] Resposta HTTP 200 com `"message":"success"`?
* [ ] Mensagem chegou de fato no WhatsApp?
* [ ] Conteúdo correto?

### Resultado

**Teste falhou → seguir 4.1 → 4.2 → 4.3 na ordem até resolver.**

**Teste funcionou → problema não é mais de infraestrutura; provavelmente está no fluxo específico do cliente/régua → voltar para Etapa 5.**

---

## 8. ETAPA 5 — VERIFICAR DADOS E CONTEÚDO

Se a mensagem chegou, mas está errada:

* [ ] Verificar `ID_PARCELA`.
* [ ] Verificar `VALOR_PARCELA`.
* [ ] Verificar `NUM_PARCELA`.
* [ ] Verificar `TOTAL_PARCELAS`.
* [ ] Verificar `DATA_VENCIMENTO`.
* [ ] Verificar `TELEFONE_WPP`.
* [ ] Verificar template.
* [ ] Verificar substituição das variáveis.
* [ ] Verificar PIX.

**Atenção especial:** já houve bug grave causado por acesso incorreto a coluna, resultando em valores incorretos nas mensagens. A regra do projeto é usar `buildColMap` e nunca índices fixos.

Se o problema for valor ou dado:

* [ ] Não culpar a Evolution.
* [ ] Comparar `Sheets → GAS → mensagem final`.
* [ ] Identificar exatamente onde o valor mudou.

---

## 9. ETAPA 6 — TESTE CONTROLADO APÓS CORREÇÃO

Antes de liberar a automação:

* [ ] Executar `testarReguaCobranca()`.
* [ ] Confirmar que o resultado esperado aparece.
* [ ] Confirmar que o dry-run não envia mensagens reais.
* [ ] Escolher um cliente de teste/controlado.
* [ ] Executar envio individual.
* [ ] Confirmar recebimento.
* [ ] Confirmar registro em `MENSAGENS`.
* [ ] Confirmar `STATUS_ENVIO = ENVIADO`.

O `testarReguaCobranca()` existe justamente para testar a régua sem envio real.

---

## 10. ETAPA 7 — REENVIO

Só executar depois de confirmar:

* [ ] Causa identificada.
* [ ] Causa corrigida.
* [ ] Teste controlado aprovado.
* [ ] Não existe risco de duplicidade.
* [ ] Registros anteriores foram preservados.

### Regra

Erros `ERRO_ENVIO` e `ERRO_SEM_PIX` não devem bloquear automaticamente um novo envio; somente `ENVIADO` deve bloquear pela regra atual de deduplicação.

* [ ] Reenviar apenas os clientes afetados.
* [ ] Evitar reprocessar toda a carteira.
* [ ] Conferir `MENSAGENS` após o reenvio.
* [ ] Confirmar recebimento.

---

## 11. ETAPA 8 — VALIDAÇÃO FINAL

### Operacional

* [ ] Cliente recebeu.
* [ ] Mensagem correta.
* [ ] PIX correto.
* [ ] Sem duplicidade.
* [ ] Régua voltou a funcionar.

### Técnico

* [ ] Trigger funcionando.
* [ ] GAS funcionando.
* [ ] Evolution funcionando (instância Conectada).
* [ ] Porta/URL/token conferidos em Sheets **e** Vercel (ambos batem).
* [ ] Configurações corretas.
* [ ] Logs corretos.
* [ ] Nenhum erro residual.

### Financeiro

* [ ] Nenhum pagamento foi alterado.
* [ ] Nenhuma parcela foi alterada indevidamente.
* [ ] Nenhum PIX incorreto foi enviado.
* [ ] Nenhuma cobrança duplicada foi gerada.

### Banco de dados

* [ ] `MENSAGENS` preservada.
* [ ] `PARCELAS` preservada.
* [ ] `PAGAMENTOS` preservada.
* [ ] `EVENTOS` preservada.
* [ ] Nenhum registro apagado sem justificativa.

---

## 12. CLASSIFICAÇÃO DA CAUSA RAIZ

Ao finalizar, classificar o incidente:

* [ ] Trigger/GAS
* [ ] Regra de negócio
* [ ] Seleção de cliente/parcela
* [ ] Deduplicação
* [ ] Dados do Google Sheets
* [ ] Template
* [ ] Geração de PIX
* [ ] Evolution GO — configuração (token/URL/instância desatualizados)
* [ ] Evolution GO — infraestrutura (porta mudou / Postgres saturado / instância corrompida / contêiner caiu)
* [ ] Autenticação/token
* [ ] Número/telefone
* [ ] Vercel/API
* [ ] Erro humano
* [ ] Outro

---

## 13. REGISTRO DO INCIDENTE

**Data:**

**Horário percebido:**

**Fluxo afetado:**

**Cliente(s) afetado(s):**

**Sintoma:**

**Causa raiz:**

**Camada onde ocorreu:**

**Porta/instância Evolution GO mudou? (se sim, valores antigo → novo):**

**Correção aplicada:**

**Mensagens afetadas:**

**Houve impacto financeiro?**

**Houve duplicidade?**

**Houve impacto em cobrança/inadimplência?**

**Como evitar recorrência:**

**Documento atualizado:**

---

## 14. REGRA DE OURO

Nunca perguntar apenas:

> "Por que o WhatsApp não enviou?"

Perguntar:

> **"Em qual ponto do fluxo o comportamento esperado deixou de acontecer?"**

Fluxo de diagnóstico:

`INFRAESTRUTURA (Etapa 0) → TRIGGER → REGRA → CLIENTE/PARCELA → LOG → ENVIO → EVOLUTION → WHATSAPP → CONTEÚDO`

O primeiro ponto que divergir do comportamento esperado é o candidato à causa raiz.

---

## 15. Histórico de incidentes cobertos por este protocolo

Para o relato completo de cada incidente (prints, logs, diagnóstico passo a passo), ver:
- `docs/ai-memory/07-AI-KNOWN-ISSUES.md` — entradas de 2026-07-31 e 2026-08-13
- Memória de sessão `evolution-go-infra` (credenciais e detalhes operacionais da VPS)
