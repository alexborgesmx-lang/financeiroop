# Botão "Renegociar Contrato" visível a qualquer tempo

## Contexto
O botão "Renegociar contrato" (menu "Mais Ações" do `ContratoModal`) só aparecia para contratos
com `STATUS_CONTRATO` em `ativo_em_atraso`, `em_cobranca`, `pre_prejuizo` ou `acordo_assistido`.
Isso impede o cliente de pedir renegociação preventivamente (ex: perdeu o emprego, sabe que vai
atrasar) antes do contrato entrar em atraso.

O backend (`_validarElegibilidadeRenegociacao`, `appscript.gs:2571`) já aceita `ativo` e
`ativo_em_dia` — a regra de negócio real já permite renegociar contrato em dia. O frontend era
mais restritivo que a regra já validada no servidor.

## Mudança
Alinhar a condição `podeRenegociar` em `ContratoModal` (`src/main.jsx:4219`) com a lista de
status já aceita pelo backend:

```js
const podeRenegociar = !jaRenegociado && pendentes.length > 0 &&
  ["ativo","ativo_em_dia","ativo_em_atraso","em_cobranca","pre_prejuizo","acordo_assistido"].includes(contrato.STATUS_CONTRATO);
```

Único arquivo alterado: `src/main.jsx`. Nenhuma mudança em `appscript.gs`, schema do Sheets ou
outros pontos do frontend (não há outro local que renderize esse botão).

## O que não muda
- `jaRenegociado` continua bloqueando uma segunda renegociação do mesmo contrato.
- `pendentes.length > 0` continua exigindo parcela em aberto.
- Status terminais/baixados/judiciais continuam fora da lista.
- `RenegociacaoModal` já é neutro quanto a atraso — nenhum texto ou cálculo assume contrato
  atrasado, funciona igual para contrato em dia.

## Teste
- Abrir um contrato `ativo_em_dia` (nenhuma parcela atrasada) → botão "Renegociar contrato"
  aparece no menu "Mais Ações" e abre o modal normalmente.
- Abrir um contrato já `renegociado` (ou com `ORIGEM_PARCELA="renegociada"`) → botão continua
  ausente.
- Sem erros de console.
