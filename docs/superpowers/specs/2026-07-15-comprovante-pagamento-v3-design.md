# Comprovante de Pagamento — migração pra HTML+print v3 — Design

Data: 2026-07-15
Status: Aprovado pelo usuário
Fase: 2 (documentos) — primeiro sub-projeto de uma série documento-por-documento

## Problema

O handoff `Borges Assessoria/design_handoff_rede_borges/` define 4 documentos + 2 peças
de canal com fidelidade pixel-perfect (`Comprovante de Pagamento.html` é o primeiro).
Hoje esse documento é gerado com **jsPDF** (`gerarEEnviarComprovante`, `src/main.jsx:533`)
— desenho client-side em canvas, sem CSS real. Reproduzir a serifa Newsreader, gradientes
e sombras do handoff em jsPDF exigiria embutir fonte em base64 e redesenhar tudo à mão,
sem nunca ficar pixel-perfect. O `api/cert.js` (Certificado de Quitação) já usa outro
caminho — HTML renderizado + `window.print()` — que bate a fidelidade exigida de graça.

## Escopo

Migrar **só o recibo de pagamento de uma parcela** (handoff doc #1) pra HTML+print.
Fica de fora desta spec — cada um vira seu próprio sub-projeto depois:
- **Comprovante de Quitação** (contrato inteiro pago) — doc #2 do handoff, com convite
  de indicação. Hoje tem *três* implementações sobrepostas que não vou tocar agora:
  o branch `isQuitado` dentro de `gerarEEnviarComprovante`, a função separada
  `gerarComprovante` (`main.jsx:4669`, PDF de carta timbrada pro contrato quitado) e o
  Certificado de Quitação público (`api/cert.js`). Misturar essa investigação com o
  recibo de parcela deixaria o escopo grande demais — fica pra quando abrirmos a spec
  da Quitação.
- Extrato do Contrato, Timbre de Contrato, templates WhatsApp, assinatura de e-mail.

### Levantamento de código (feito por grep, ponto de partida da implementação)

`gerarEEnviarComprovante(parcela, valorPago, dataPago, tipoLabel, parcelas, contratos, clientes, opts)`
(`main.jsx:533`) é chamada em 4 lugares reais — nenhum muda de assinatura:
- `main.jsx:1025` / `:1029` — `ComprovanteEnvioModal` (botões "Salvar" / "Enviar WhatsApp")
- `main.jsx:3377` — logo após `postAction({action:"pagamento"...})` bem-sucedido
- `main.jsx:4581` — `PagamentoDetalheModal.enviarWpp` (reenviar recibo de um pagamento já registrado)
- `main.jsx:8396` — ação rápida no Dashboard, reenvia o recibo do último pagamento do contrato

**Achado extra:** `PagamentoDetalheModal` tem uma função `gerarPdfBlob` (`main.jsx:4489-4571`)
que desenha o mesmo recibo em jsPDF de novo — é **código morto**, sem nenhum call site
(confirmado por grep; o botão daquele modal chama `gerarEEnviarComprovante`, não `gerarPdfBlob`).
Vai ser deletado como limpeza, não como parte de uma "consolidação" de fluxo em uso.

## Abordagem escolhida

`gerarEEnviarComprovante` já separa internamente o caso `isQuitado` do caso normal
(toda a lógica de busca de contrato/cliente/histórico e o cálculo de saldo continuam
iguais — são usados nos dois branches). Vou tocar só no branch **não-quitado**:

```
gerarEEnviarComprovante(...):
  [lógica de derivação de dados — inalterada]
  if (isQuitado) {
    [código jsPDF de quitação — inalterado, fora de escopo]
  } else {
    abrirComprovantePagamento({ nome, cpf, contrato, tipoLabel, dataPago,
      vencimentoOriginal, saldo, idTransacao, valorPago, autenticacao })
    if (opts.wpp) { /* mesma lógica de abrir wa.me, inalterada */ }
  }
```

Nenhum dos 4 call sites muda — todos continuam chamando `gerarEEnviarComprovante` do
mesmo jeito. O roteamento pro branch novo é interno.

### `abrirComprovantePagamento(dados)` — função nova

- Monta uma string HTML completa (`<!doctype html>...`) replicando `Comprovante de
  Pagamento.html` do handoff: cartão de 452px, ivory/verde-floresta, 100% `--sans`
  (confirmado no arquivo original — nenhum uso de Newsreader nesse documento, só
  `--mono` num rótulo pequeno do cabeçalho), `.num` pra valores monetários, Linha de
  Confiança no **cabeçalho** (`data-n="9" data-sw="1.6"`, opacidade 0.30, cor
  `on-brand-soft` — confirmado no arquivo original, não no rodapé).
- Campos, na ordem exata do arquivo original: Cliente, CPF (`.num`), Contrato (`.mono`),
  Forma de pagamento, Pago em (`.num`), Vencimento original (`.num`), Saldo devedor
  após (`.num`), ID da transação (`.mono`, usa `ID_PARCELA` — mesmo campo já usado
  hoje) e rodapé com "Autenticação" (mesmo formato `AAAA·MMDD·BORGES·XXXX` que a
  versão jsPDF já gera — não é feature nova, só troca a "tela" onde esse texto aparece).
  **Diferença consciente do exemplo do handoff:** "Pago em" no arquivo original mostra
  data e hora (`29/05/2026 · 14:32`) — o Sheets só guarda `DATA_PAGAMENTO` sem horário
  (confirmado por grep, não existe campo de hora), então esse campo mostra só a data,
  igual ao que a versão jsPDF já faz hoje.
- Print CSS: `@page{size:A4;margin:14mm}` — mesmo padrão de `api/cert.js`.
- **Sem a tabela de "histórico de parcela"** que a versão jsPDF atual desenha embaixo
  dos dados (`_renderHistParcelas`, rotulada "DETALHE DA PARCELA PAGA") — ela é
  redundante com as linhas de dados logo acima e o handoff não tem essa tabela nesse
  documento. Simplificação intencional, não uma perda de informação real.
- Linha de Confiança: replico a mesma matemática de `LinhaConfianca` (componente React
  já em produção da Fase 1) como uma função JS separada que devolve uma string SVG —
  não vou tocar no componente React já testado só pra compartilhar código; a duplicação
  aqui é de ~10 linhas e o ganho de isolamento vale mais que o DRY.

### `abrirComprovantePagamento` abre a janela

```js
function abrirComprovantePagamento(dados){
  const win = window.open("", "_blank");
  if(!win){
    alert("Pop-up bloqueado — permita pop-ups para este site e clique em Salvar novamente.");
    return null;
  }
  win.document.write(_comprovantePagamentoHTML(dados));
  win.document.close();
  return win;
}
```

**Pop-up bloqueado é o risco novo real** (jsPDF nunca tinha esse problema — só clicava
num link de download). Em 3 dos 4 call sites o `window.open` roda dentro do mesmo
clique síncrono do usuário (não é bloqueado por navegador nenhum). O call site de
`main.jsx:3377` roda depois de um `await postAction(...)` — mais suscetível a bloqueio
em alguns navegadores. Cobertura: checar o retorno de `window.open` e mostrar o alert
acima quando vier `null`, em vez de falhar silenciosamente.

### O que muda pro usuário

- Hoje: clicar "Salvar comprovante" baixa um PDF direto.
- Depois: clicar abre uma aba nova com o comprovante renderizado; o usuário clica
  "Salvar / Imprimir PDF" (`window.print()`) pra gerar o PDF de fato — um clique a mais.
- "Enviar pelo WhatsApp" já não anexava o PDF automaticamente (usuário sempre teve que
  anexar na mão) — esse comportamento não piora.

## Fora de escopo

- Não mexe no branch `isQuitado` de `gerarEEnviarComprovante`, em `gerarComprovante`
  (linha 4669) nem no Certificado de Quitação público (`api/cert.js`) — fica pra spec
  própria da Quitação.
- Não mexe em `gerarExtratoPDF` (Extrato do Contrato) nem no fluxo Google Docs + ZapSign
  (Timbre de Contrato).
- Não adiciona nova rota de API — tudo client-side, sem novo Serverless Function
  (relevante pelo limite de 12 functions do Vercel Hobby já documentado no `CLAUDE.md`).
- Não muda o formato do código de "Autenticação" nem o `ID_PARCELA` usado como
  "ID da transação" — reaproveita o que já existe.

## Teste manual pós-implementação

Em produção, nos 4 call sites:
1. Registrar um pagamento normal de parcela (Dashboard → Registrar Pagamento) e conferir
   que abre a aba do comprovante com os dados corretos, em claro e escuro.
2. `ComprovanteEnvioModal` — botão "Salvar comprovante" e botão "Enviar pelo WhatsApp"
   (confirmar que a aba do comprovante abre E a aba do WhatsApp abre).
3. Abrir um pagamento já registrado no Financeiro (`PagamentoDetalheModal`) e reenviar
   pelo WhatsApp.
4. Ação rápida de reenvio no Dashboard para o último pagamento de um contrato.
5. Clicar em "Salvar/Imprimir PDF" na aba aberta e confirmar que o PDF sai correto
   (fonte, cores, Linha de Confiança).
6. Confirmar que o branch de contrato quitado (`isQuitado`) continua gerando o PDF
   antigo sem nenhuma mudança — não deve abrir a aba nova nesse caso.
7. Sem erros de console.
