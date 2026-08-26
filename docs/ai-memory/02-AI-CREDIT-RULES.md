# REGRAS DE CRÉDITO

## Contratos

Um cliente pode possuir diversos contratos ao longo da vida.

Um cliente nunca pode possuir mais de um contrato ativo simultaneamente.

A criação de um novo contrato deve validar previamente a inexistência de outro contrato ativo.

---

## Parcelas

Toda parcela deve pertencer a um contrato.

Toda parcela deve possuir:

- Número
- Valor
- Data de vencimento
- Status

Nenhuma parcela pode existir sem contrato.

---

## Pagamentos

Todo pagamento normal deve estar vinculado a:

- Cliente
- Contrato
- Parcela

**Exceção — Abatimento Assistido:** o tipo `abatimento_acordo_assistido` vincula a Cliente e Contrato, mas não a uma parcela específica (ID_PARCELA vazio). Esta é a única exceção permitida ao vínculo com parcela.

Nenhum pagamento pode existir sem rastreabilidade.

---

## Pagamento Parcial

Um pagamento parcial não encerra automaticamente uma parcela.

O saldo remanescente deve continuar sendo controlado.

A parcela somente será considerada quitada quando atingir os critérios financeiros definidos pela operação.

---

## Renegociação

Toda renegociação deve:

- Preservar histórico
- Preservar rastreabilidade
- Registrar data
- Registrar motivo

Nenhuma renegociação pode apagar dados históricos.

**Ajuizamento imediato em reincidência (2026-07-05, estendido em 2026-07-06):** um contrato que já foi renegociado (`ORIGEM_PARCELA = "renegociada"` em alguma parcela) **ou** já passou por Acordo Assistido (evento `ACORDO_ASSISTIDO_ENTRADA` em EVENTOS) e volta a atrasar (`STATUS_CONTRATO = "ativo_em_atraso"`) libera a opção "Ajuizar contrato" imediatamente — não espera os 30 dias do ciclo normal (`em_cobranca`). Racional: reincidência pós-renegociação/acordo já é uma situação agravada (2ª chance dada e não cumprida), não deve seguir o mesmo tratamento de um atraso comum de 1ª vez. Implementado só na visibilidade do botão (`podeAjuizar` em `ContratoModal`, `src/main.jsx`) — a action `ajuizarContrato` no GAS nunca validou status, então nenhuma mudança de backend foi necessária. A detecção do Acordo Assistido usa EVENTOS (não campos em CONTRATOS) porque `sairDoAcordoAssistido` limpa `DATA_ENTRADA_ACORDO_ASSISTIDO`/`MOTIVO_ACORDO_ASSISTIDO`/`OBSERVACAO_ACORDO_ASSISTIDO` ao retornar à cobrança normal — o evento de entrada é o único sinal permanente que sobra.

**Entrada obrigatória como prova de comprometimento (2026-08-06):** o limite de 1 renegociação por contrato (acima) já impedia o loop infinito, mas não impedia conceder a única renegociação "de graça" — sem nenhum desembolso do cliente, sem sinal real de que ele vai honrar o novo carnê. A renegociação deixou de executar na hora do clique e virou uma **proposta pendente** (mesmo padrão da Quitação Antecipada — aba `PROPOSTAS_RENEGOCIACAO`, PIX, expira em 48h): só fecha as parcelas antigas e cria o novo carnê depois que a entrada é confirmada paga via webhook Efí. Enquanto a proposta está pendente, as parcelas antigas continuam cobráveis normalmente pela régua — nada muda até o dinheiro da entrada bater. Ver `03-AI-FINANCIAL-CALCULATIONS.md` (alocação da entrada) e `MANUAL_OPERACIONAL.md` 5.9.

**Entrada mínima dinâmica + "assumir o risco" (2026-08-10):** o piso fixo de R$200 (`RENEGOCIACAO_ENTRADA_MINIMA` em CONFIGURACOES) foi substituído por um mínimo calculado por contrato — o `VALOR_JUROS` da parcela em aberto mais próxima (1 mês de juros daquele contrato específico), em `gerarPropostaRenegociacao` (`appscript.gs`). O Alex pode dispensar esse mínimo caso a caso marcando "Assumir o risco e dispensar a entrada mínima" no `RenegociacaoModal`: com a caixa marcada, a entrada pode ser qualquer valor ≥ R$0 (flag `assumirRisco` enviada a `gerarPropostaRenegociacao`, que pula a checagem de mínimo mas continua exigindo `valorEntrada > 0` para gerar PIX). Se o valor digitado for R$0 (campo em branco), não existe PIX de R$0 pra gerar — o frontend pula a etapa de proposta pendente inteiramente e chama a action `renegociarContrato` **direto** (mesma função que já existia, sem nenhuma mudança nela: já era genérica e independente de proposta pendente), executando a renegociação (fechar parcelas antigas + novo carnê) imediatamente ao clicar em "Renegociar sem entrada", com `window.confirm` de aviso (ação irreversível, sem suporte no Motor de Undo) e prefixo `[SEM ENTRADA - RISCO ASSUMIDO]` na observação gravada em EVENTOS/PARCELAS.

**Cálculo automático de parcelamento, sem teto (2026-08-06):** em vez do Alex digitar valor e quantidade de parcela livremente, ele informa a entrada e o valor que o cliente disse que consegue pagar por mês — o sistema calcula a quantidade de parcelas necessária (arredondando o valor de cada parcela pra cima, igual entre todas) para cobrir o saldo restante. Decisão consciente de **não** impor um teto de parcelas: o objetivo é deixar visível pro Alex quando um valor de parcela proposto pelo cliente implica um prazo longo demais (ex: 68 parcelas), pra ele negociar um valor maior em vez do sistema simplesmente bloquear ou aceitar sem mostrar a implicação.

---

## Recuperação

Recebimentos após baixa devem ser classificados como recuperação.

A recuperação deve permanecer identificável para fins gerenciais.

---

## Cobrança

Cobrança é um estado operacional.

Não altera o histórico financeiro.

Não altera automaticamente valores financeiros.

---

## Acordo Assistido — Regras Específicas

Contratos em `acordo_assistido` seguem regras especiais que **sobrepõem** as regras de cobrança padrão:

1. **Exclusão da fila de cobrança**: contrato some de `parcelasAtrasadas` e da aba Cobrança automaticamente.
2. **Score congelado**: `calcularScore` não é chamado durante entrada, abatimento, ou permanência no status. Retoma cálculo normal somente após `sairDoAcordoAssistido`.
3. **Abatimento livre**: qualquer valor, qualquer frequência, sem vínculo com parcela específica.
4. **Contabilização separada**: abatimento é capital recuperado, nunca receita. O Dashboard e aba Financeiro devem excluir `abatimento_acordo_assistido` dos totais de receita.
5. **Bloqueio de pagamento normal**: contrato em `acordo_assistido` não pode receber pagamento de parcela normal. A UI deve exibir apenas o formulário de abatimento.
6. **Baixa usa VALOR_ABATIDO_ASSISTIDO**: ao calcular PREJUIZO_CAPITAL na baixa de um contrato `acordo_assistido`, usar `VALOR_ABATIDO_ASSISTIDO` como capital recuperado (não somar parcelas pagas, que serão zero).
7. **Expiração automática**: trigger diário verifica se passou 180 dias desde o último abatimento (ou desde DATA_ENTRADA_ACORDO_ASSISTIDO se não houver abatimentos). Se sim, move para `pre_prejuizo` e registra evento `ACORDO_ASSISTIDO_EXPIRADO`.
8. **Trigger diário não reverte**: o `atualizarStatusContratos` intercepta `acordo_assistido` antes do recálculo padrão e aplica apenas a regra dos 180 dias (+ `continue` para pular o restante do loop).

---

## Pagamento Somente Juros — Política Formalizada (2026-06-19, revisada 2026-08-26)

O `somente_juros` é uma prorrogação da parcela: cliente paga apenas os juros do mês e o principal é rolado para uma nova parcela criada automaticamente no final do contrato.

### Regras obrigatórias

1. **Sem limite de usos por contrato** (removido em 2026-08-26 — ver nota abaixo). Campo `TOTAL_SOMENTE_JUROS` em CONTRATOS continua contando quantas vezes o contrato usou a função, só que sem bloquear.
2. **Fee de 5% sobre o principal** — cobrado junto com os juros no mesmo pagamento (`vlPago = juros + fee`). Registrado em `FEE_PRORROGACAO` (campo separado de `RECEITA_EXTRA_ATRASO`).
3. **Penalização no score: -10 pts por uso** — acumulativa sobre todos os contratos do cliente, **sem teto**. Score recalculado após cada uso.
4. **Parcela nova gerada automaticamente** — criada com `ORIGEM_PARCELA = "gerada_por_pagamento_de_juros"` e `ID_PARCELA_ORIGEM` apontando para a parcela original. A parcela nova herda o **mesmo principal e o mesmo juros** da parcela original adiada (`appscript.gs:3788`) — ou seja, o principal continua rendendo juro normalmente enquanto está em aberto, igual um empréstimo comum. Isso é o motivo pelo qual a função nunca reduz o lucro projetado do contrato: `JUROS_TOTAL` soma o juro de todas as parcelas (inclusive as geradas), então sobe a cada uso, nunca cai — o fee de 5% é margem adicional por cima disso.

> **Nota (2026-06-20):** Requisito de score mínimo 60 removido. Qualquer cliente pode usar somente_juros independente do score — preferível receber ao menos os juros a não receber nada.

> **Nota (2026-08-26):** Limite de 2 usos por contrato removido. A regra original existia pra evitar que o cliente criasse hábito de sempre prorrogar, corroendo o lucro do contrato — mas o fee de 5% (regra 2) e a penalização de score sem teto (regra 3), ambos adicionados depois da regra original, já cobrem esse risco de forma proporcional (quanto mais usa, pior fica score/taxa em contratos futuros) em vez de travar seco no 3º uso. Motivador: contrato PCL-106 (Acordo Assistido) já tinha 3 usos históricos, e travar contradiz o princípio da nota de 2026-06-20 ("preferível receber ao menos os juros a não receber nada"). Nenhuma ação retroativa necessária — `TOTAL_SOMENTE_JUROS` é só um contador, não há outro estado bloqueando contratos que já estavam no teto antigo.

### Contabilidade
- `RECEITA_EXTRA_ATRASO` = mora/multa de atraso real (zero em somente_juros)
- `FEE_PRORROGACAO` = fee de prorrogação (5% do principal)
- Somas financeiras usam `RECEITA_EXTRA_ATRASO + FEE_PRORROGACAO` para cobrir registros antigos e novos

### Reversão (reabertura)
Se a parcela for reaberta via `reabrirParcelaAPI`, a parcela gerada automaticamente é deletada e `TOTAL_SOMENTE_JUROS` é decrementado.

---

## Recuperação Judicial — Regras Específicas (2026-07-04)

`em_processo_judicial` **não é status final** — é o início de uma nova fase do ciclo de vida do contrato, com duas dimensões separadas:

- **Situação do processo** (`STATUS_PROCESSO`): EM_PREPARACAO → AJUIZADO → ... → ARQUIVADO/EXTINTO. Puramente processual.
- **Situação financeira** (`SITUACAO_FINANCEIRA_JUDICIAL`): EM_ABERTO → ACORDO_PARCELADO_ATIVO/ACORDO_QUEBRADO → QUITADO_JUDICIALMENTE / RECUPERADO_PARCIAL / PERDA_JUDICIAL_DEFINITIVA. Independente da situação processual.

`STATUS_CONTRATO` permanece `em_processo_judicial` durante toda a fase ativa. Só vira o status terminal `encerrado_judicialmente` quando a dívida é 100% resolvida (quitação/acordo pago) ou o processo é arquivado sem recuperação total. **Nunca reaproveita os status mortos `recuperado_parcialmente`/`em_recuperacao`** (ver `03-AI-FINANCIAL-CALCULATIONS.md` — esses status são ativamente revertidos por `corrigirStatusRecuperacao`).

### Regras obrigatórias

1. **Ajuizar não bloqueia ação futura** — após `ajuizarContrato`, é possível: registrar acordo judicial (parcelado ou à vista), registrar quitação judicial, adicionar movimentações, e eventualmente arquivar o processo. Nenhuma dessas ações estava disponível antes de 2026-07-04.
2. **Acordo judicial parcelado reaproveita a aba PARCELAS** — novas parcelas marcadas `ORIGEM_PARCELA = "acordo_judicial"`. As parcelas originais em aberto no momento do acordo são marcadas `renegociado` (superadas), mesmo padrão de `registrarAcordoComPerda`.
3. **Bloqueio de crédito é PERMANENTE** — `CLIENTE_JUDICIALIZADO = "SIM"` nunca é limpo, mesmo após quitação total do processo. `criarContrato` valida esse campo no backend (antes só havia bloqueio client-side em `NovoContrato`) e rejeita a criação com erro explícito.
4. **Score sempre bloqueado** — contratos em `em_processo_judicial` ou `encerrado_judicialmente` entram em `ST_PREJ` no `calcularScore`. Como nunca produzimos os status de `ST_RECUP` (dead statuses), `temPreju && !temRecup` fica permanentemente verdadeiro para esses clientes — bloqueio de score nunca é revertido, mesmo com recuperação total.
5. **`em_processo_judicial` não conta mais como "ativo"** — removido de `_ST_ATIVO_C` (GAS) e `_ST_ATIVOS` (frontend). Vira bucket próprio (`_ST_JUDICIAL_C`/`_ST_JUDICIAL`), com contador dedicado `CONTRATOS_EM_JUDICIAL` em CLIENTES.

---

## Bloqueio Manual de Cliente (subjetivo/discricionário — 2026-07-09)

Existe uma terceira forma de bloqueio de crédito, **independente** das duas anteriores (`CLIENTE_JUDICIALIZADO` e `SCORE_BLOQUEADO`):

- `CLIENTE_JUDICIALIZADO` — automático, ligado a `ajuizarContrato`, **permanente**, nunca limpo.
- `SCORE_BLOQUEADO` — automático, recalculado a cada `calcularScore` (atraso >30 dias, prejuízo não recuperado, comunicação ruim, score final <30), **pode ser revertido** no próximo recálculo se o comportamento objetivo melhorar.
- `CLIENTE_BLOQUEADO_MANUAL` — **decisão subjetiva do dono do negócio**, sem base em dado financeiro objetivo (ex: cliente usou nome de terceiro para tirar contrato paralelo, comportamento fraudulento, qualquer motivo de confiança). Campos em CLIENTES:
  - `CLIENTE_BLOQUEADO_MANUAL` — `"SIM"` / vazio
  - `MOTIVO_BLOQUEIO_MANUAL` — texto livre, obrigatório ao bloquear
  - `DATA_BLOQUEIO_MANUAL` — data do bloqueio

Funções GAS: `bloquearClienteManual(idCliente, motivo)` / `desbloquearClienteManual(idCliente)`. Diferente do bloqueio judicial, **é reversível** — Alex pode desbloquear quando a situação for esclarecida (`MOTIVO`/`DATA` do último bloqueio permanecem como histórico após desbloquear, não são apagados).

**Não afeta contratos já ativos** — cobrança, régua WhatsApp e pagamentos seguem normalmente. Bloqueia apenas a criação de **novos** contratos, validado em `criarContrato` (mesmo bloco de checagem de `CLIENTE_JUDICIALIZADO`, `appscript.gs` ~linha 3280).

Cliente bloqueado continua visível em todas as listas (não é escondido), com badge vermelho "BLOQUEADO" — no `ClienteModal`, na listagem de Clientes, e no dropdown de busca do `NovoContrato`. Toda mudança gera evento em EVENTOS (`BLOQUEIO_MANUAL_CLIENTE` / `DESBLOQUEIO_MANUAL_CLIENTE`).

---

## Fator de Estabilidade Profissional no Score (2026-07-24)

O bônus de +2 pts em `calcularScore` por vínculo empregatício estável usa `DATA_ADMISSAO` (tempo de casa do próprio cliente na empresa) — não mais `DATA_ABERTURA_EMPREGADOR` (idade do CNPJ do empregador). Motivo: tempo de casa é sinal mais direto do perfil de estabilidade do tomador do que a idade da empresa onde trabalha.

- **+2 pts** se `DATA_ADMISSAO` ≥ 5 anos atrás.
- `DATA_ADMISSAO` vazia ou inválida (ex: autônomo sem vínculo CLT) → neutro, 0 pontos, sem penalidade.
- `SITUACAO_EMPREGADOR` (checagem de idoneidade do CNPJ do empregador, -5 pts se não `"ATIVA"`) **não muda** — é sinal separado (existência/regularidade da empresa), não relacionado ao tempo de casa do cliente.
- `DATA_ABERTURA_EMPREGADOR` continua no cadastro e ainda alimenta `SCORE_EMPREGADOR` (métrica agregada por empregador, `appscript.gs` ~linha 4051) — só saiu do cálculo individual do score do cliente.
