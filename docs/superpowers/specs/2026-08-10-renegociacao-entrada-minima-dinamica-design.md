# Entrada mínima dinâmica na renegociação + opção "assumir o risco"

## Contexto

A renegociação de contrato exige uma entrada mínima antes de fechar as parcelas antigas e
gerar o novo carnê (implementado em 2026-08-06 como "prova de comprometimento" — ver
`docs/ai-memory/02-AI-CREDIT-RULES.md` linha 65). Hoje esse mínimo é um valor fixo de R$200,
lido de `CONFIGURACOES.RENEGOCIACAO_ENTRADA_MINIMA` (`appscript.gs:737`).

Essa mudança substitui o piso fixo por um piso calculado por contrato, e dá ao Alex a opção
de dispensar esse piso caso a caso, assumindo o risco conscientemente.

## Mudança 1 — Mínimo dinâmico (substitui os R$200 fixos)

Em vez de um valor fixo, a entrada mínima passa a ser **o `VALOR_JUROS` da parcela em aberto
mais próxima do contrato** (a mesma parcela usada como referência de "1 mês de juros" desse
contrato específico). Exemplo: se a próxima parcela em aberto tem R$153,20 de juros, a
entrada mínima sugerida para aquele contrato é R$153,20.

- Backend (`gerarPropostaRenegociacao`, `appscript.gs:697`): calcula `entradaMinima` a partir
  de `saldo.parcAbertas` (já retornado por `_saldoDevedorAbertoContrato`), pegando a parcela
  com menor `NUM_PARCELA`. Deixa de ler `CONFIGURACOES.RENEGOCIACAO_ENTRADA_MINIMA`.
- Frontend (`RenegociacaoModal`, `src/main.jsx:2626`): calcula o mesmo valor localmente a
  partir de `abertas[0].VALOR_JUROS` (`abertas` já vem ordenado por `NUM_PARCELA` crescente)
  e mostra como texto de apoio abaixo do campo Entrada — não é mais um valor pré-preenchido
  fixo ("200").
- Remove `_garantirConfigEntradaRenegociacao()` (`appscript.gs:688`) e o item de menu
  "Renegociacao: Configurar Entrada Minima R$200 (rodar 1x)" (`appscript.gs:1067`) — ficam
  sem uso depois dessa mudança. Nenhuma outra leitura/escrita de
  `RENEGOCIACAO_ENTRADA_MINIMA` existe no código.

## Mudança 2 — Checkbox "Assumir o risco e dispensar a entrada mínima"

No formulário do `RenegociacaoModal`, uma checkbox nova libera o Alex de respeitar o mínimo
calculado, caso a caso, por decisão explícita dele:

- **Desmarcada (padrão):** entrada precisa ser ≥ mínimo calculado. Igual ao comportamento
  atual, só que com o valor dinâmico em vez do fixo.
- **Marcada:** o piso desaparece. A entrada pode ser qualquer valor ≥ R$0, incluindo deixar o
  campo em branco.

Com a checkbox marcada, dois caminhos possíveis dependendo do valor digitado:

1. **Entrada > R$0 (mesmo abaixo do mínimo):** segue o fluxo atual — gera proposta pendente
   em `PROPOSTAS_RENEGOCIACAO` + PIX via Efí + confirmação por webhook
   (`gerarPropostaRenegociacao` → `pagamentoRenegociacaoWebhook` → `renegociarContrato`).
   Único ajuste: `gerarPropostaRenegociacao` recebe `dados.assumirRisco: true` e pula a
   checagem de mínimo (mas continua exigindo `valorEntrada > 0` — gerar PIX de R$0 não faz
   sentido em nenhum cenário).

2. **Entrada = R$0 (campo vazio):** não existe PIX de R$0 pra gerar, então esse caminho pula
   a etapa de proposta pendente inteiramente. O frontend chama a action `renegociarContrato`
   **diretamente** — a mesma função que hoje só roda depois que o webhook confirma o PIX
   (`appscript.gs:2711`, já exposta em `doPost` e já aceita `valorEntradaRecebida` opcional,
   default 0). Ela já é autocontida: revalida elegibilidade
   (`_validarElegibilidadeRenegociacao`) e saldo (`_saldoDevedorAbertoContrato`) por conta
   própria, então chamá-la direto do frontend é tão seguro quanto o fluxo via PIX — só sem a
   espera pela entrada. **Nenhuma mudança em `renegociarContrato` é necessária.**
   - A renegociação (fechar parcelas antigas + criar novo carnê + gerar PIX das novas
     parcelas) executa imediatamente ao clicar.
   - Como não existe undo pra `RENEGOCIACAO_ESTRUTURAL` no Motor de Undo, um
     `window.confirm()` de segurança aparece antes de executar, avisando que a ação é
     irreversível.
   - A observação gravada na renegociação recebe o prefixo
     `[SEM ENTRADA - RISCO ASSUMIDO]`, ficando visível em EVENTOS e nas `OBSERVACOES` das
     parcelas novas — rastro de auditoria de que foi uma decisão manual, não o fluxo padrão.

## O que não muda

- Limite de 1 renegociação por contrato (`_validarElegibilidadeRenegociacao`).
- Alocação da entrada (capital primeiro, depois juros) e cálculo de parcelamento sem teto
  (arredonda pra cima, igual entre todas) — inalterados, tanto no caminho com PIX quanto no
  caminho direto.
- Bloqueio de entrada que cobre o saldo total (`valorEntrada >= saldoTotalContrato` →
  "use Quitação Antecipada") — continua valendo mesmo com `assumirRisco`.
- Geração automática de PIX das novas parcelas ao final da renegociação
  (`_gerarPixParcelasNovas`, chamado dentro de `renegociarContrato`) — já acontece hoje,
  inalterado.

## Arquivos afetados

- `appscript.gs`: `gerarPropostaRenegociacao` (cálculo do mínimo dinâmico + flag
  `assumirRisco`), remoção de `_garantirConfigEntradaRenegociacao` e do item de menu
  correspondente.
- `src/main.jsx`: `RenegociacaoModal` — mínimo dinâmico exibido como texto de apoio, checkbox
  "assumir o risco", duas validações de `canSubmit` (PIX vs. sem entrada), nova função
  `renegociarSemEntrada` que chama `postAction({action:"renegociarContrato",...})` direto,
  botão do rodapé alterna entre "Gerar PIX da Entrada" e "Renegociar sem entrada" conforme o
  caminho.

Nenhuma coluna nova no Sheets, nenhuma aba nova.

## Teste

- Contrato elegível, checkbox desmarcada, entrada abaixo do mínimo calculado → bloqueado com
  a mensagem do mínimo (agora dinâmico, não mais "R$200").
- Checkbox marcada, entrada abaixo do mínimo mas > R$0 → gera proposta + PIX normalmente.
- Checkbox marcada, entrada em branco → botão vira "Renegociar sem entrada", `window.confirm`
  aparece, ao confirmar a renegociação executa na hora (parcelas antigas viram
  `renegociado`, novo carnê aparece, PIX das novas parcelas gerado, evento
  `RENEGOCIACAO_ESTRUTURAL` em EVENTOS com o prefixo `[SEM ENTRADA - RISCO ASSUMIDO]` na
  observação).
- Contrato já renegociado anteriormente → ambos os caminhos continuam bloqueados por
  `_validarElegibilidadeRenegociacao` (comportamento inalterado).
- Sem erros de console.
