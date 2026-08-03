# RÉGUA DE COBRANÇA AUTOMÁTICA — WHATSAPP

Este documento define as mensagens padrão da régua automática de cobrança do FinanceiroOp.

## Objetivos

* Reduzir inadimplência.
* Aumentar recebimento espontâneo.
* Manter comunicação profissional.
* Evitar tom excessivamente agressivo.
* Incentivar resposta e negociação antes da escalada da cobrança.

---

# Variáveis

Utilizar as seguintes variáveis dinâmicas:

```text
{NOME}
{NUM_PARCELA}
{TOTAL_PARCELAS}
{DATA_VENCIMENTO}
{VALOR_PARCELA}
{VALOR_ATUALIZADO}
{PIX}
{DATA_PROMESSA}
{VALOR_COMBINADO}
```

---

# D-5

```text
Bom dia, {NOME}.

Passando para lembrar que sua parcela {NUM_PARCELA} de {TOTAL_PARCELAS} vence em {DATA_VENCIMENTO}.

Valor da parcela: R$ {VALOR_PARCELA}

PIX para pagamento:
{PIX}

Caso deseje antecipar o pagamento, você já pode realizar a quitação utilizando o PIX acima.

Caso já tenha efetuado o pagamento, por favor desconsidere esta mensagem.

Esta é uma mensagem automática do sistema.
```

---

# D-1

```text
Olá, {NOME}. Bom dia!

Lembramos que sua parcela {NUM_PARCELA} de {TOTAL_PARCELAS} vence amanhã, {DATA_VENCIMENTO}.

Valor da parcela: R$ {VALOR_PARCELA}

PIX para pagamento:
{PIX}

Realizando o pagamento dentro do prazo você evita encargos adicionais e mantém seu contrato em dia.

Caso já tenha efetuado o pagamento, por favor desconsidere esta mensagem.

Esta é uma mensagem automática do sistema.
```

---

# D0

```text
Olá, {NOME}. Bom dia!

Passando para lembrar que hoje vence sua parcela {NUM_PARCELA} de {TOTAL_PARCELAS}.

Valor da parcela: R$ {VALOR_PARCELA}

PIX para pagamento:
{PIX}

Para evitar encargos adicionais, recomendamos que o pagamento seja realizado até o final do dia.

Caso já tenha efetuado o pagamento, por favor desconsidere esta mensagem.

Esta é uma mensagem automática do sistema.
```

---

# D+1

```text
Olá, {NOME}. Bom dia!

Identificamos que sua parcela {NUM_PARCELA} de {TOTAL_PARCELAS} ainda consta em aberto.

Valor da parcela: R$ {VALOR_PARCELA}
Os encargos de mora são cobrados diretamente no PIX.

PIX para pagamento:
{PIX}

Sabemos que imprevistos acontecem. Caso o pagamento já tenha sido realizado, por favor desconsidere esta mensagem.

Se precisar de qualquer apoio, estamos à disposição.

Esta é uma mensagem automática do sistema.
```

---

# D+3

```text
Olá, {NOME}. Bom dia!

Verificamos que sua parcela {NUM_PARCELA} de {TOTAL_PARCELAS} permanece em aberto.

Valor da parcela: R$ {VALOR_PARCELA}
Os encargos de mora são cobrados diretamente no PIX.

PIX para pagamento:
{PIX}

Caso ainda não tenha conseguido realizar o pagamento, pedimos que nos informe uma previsão para regularização.

Manter uma boa comunicação é fundamental para encontrarmos a melhor solução.

Esta é uma mensagem automática do sistema.
```

---

# D+7

```text
Olá, {NOME}. Bom dia!

Sua parcela {NUM_PARCELA} de {TOTAL_PARCELAS} encontra-se em atraso há 7 dias.

Valor da parcela: R$ {VALOR_PARCELA}
Os encargos de mora são cobrados diretamente no PIX.

PIX para pagamento:
{PIX}

Solicitamos que a regularização seja realizada o quanto antes ou que nos informe uma previsão concreta de pagamento.

A ausência de pagamento e de comunicação poderá resultar na continuidade dos procedimentos de cobrança previstos contratualmente.

Esta é uma mensagem automática do sistema.
```

---

# PROMESSA D-1

```text
Olá, {NOME}. Bom dia!

Passando para lembrar que amanhã vence o compromisso de pagamento informado por você.

Valor combinado: R$ {VALOR_COMBINADO}

PIX para pagamento:
{PIX}

Caso precise de qualquer suporte, permanecemos à disposição.

Esta é uma mensagem automática do sistema.
```

---

# PROMESSA D0

```text
Olá, {NOME}. Bom dia!

Conforme combinado anteriormente, o pagamento ficou previsto para hoje.

Valor combinado: R$ {VALOR_COMBINADO}

PIX para pagamento:
{PIX}

Contamos com sua colaboração para o cumprimento do compromisso assumido.

Esta é uma mensagem automática do sistema.
```

---

# PROMESSA D+1

```text
Olá, {NOME}. Bom dia!

Verificamos que o compromisso de pagamento previsto para {DATA_PROMESSA} ainda não foi identificado.

Valor combinado: R$ {VALOR_COMBINADO}

PIX para pagamento:
{PIX}

Pedimos que nos informe uma nova previsão de pagamento para mantermos seu atendimento atualizado.

A boa comunicação é fundamental para que possamos continuar auxiliando da melhor forma possível.

Esta é uma mensagem automática do sistema.
```

---

# Regras Operacionais

1. Nunca enviar mensagens para contratos quitados.
2. Nunca enviar mensagens para contratos cancelados.
3. Nunca enviar mensagens para contratos em acordo_assistido.
4. Nunca enviar mensagens para contratos baixados como prejuízo.
5. Se houver promessa ativa, suspender a régua normal e utilizar apenas a régua de promessas.
6. Não enviar mais de uma mensagem automática ao mesmo cliente no mesmo dia.
7. Registrar todos os disparos na tabela MENSAGENS.
8. Registrar status de envio, data, hora e conteúdo enviado.
9. O PIX enviado deve ser sempre o PIX vigente da parcela.
10. Caso exista pagamento identificado, cancelar imediatamente os próximos eventos da régua referentes àquela parcela.
11. **(2026-08-01) Nunca disparar mensagem/PIX de uma parcela mais nova enquanto existir outra parcela do mesmo contrato mais antiga e ainda em atraso.** A regra 6 (não duplicar no mesmo dia) só resolve a colisão quando dois gatilhos competem no mesmo dia — essa regra cobre entre dias diferentes, que é onde o cliente pode acumular mais de um PIX simultaneamente válido no histórico do WhatsApp. Implementado em `enviarReguaCobranca` via `atrasoMaisAntigoPorContrato`. Efeito colateral: uma parcela que passou de D+7 sem pagar também segura a mensagem da parcela seguinte — o contrato fica sem cobrança automática até ação manual.
12. **(2026-08-01) Mensagens de atraso (D+1/D+3/D+7) incluem aviso fixo** pedindo pro cliente usar só o código PIX daquela mensagem, nunca um código de mensagem anterior.

# Prioridade dos Eventos

```text
PROMESSA D+1
PROMESSA D0
PROMESSA D-1
D+7
D+3
D+1
D0
D-1
D-5
```

Caso dois eventos coincidam no mesmo dia, executar apenas o evento de maior prioridade.
