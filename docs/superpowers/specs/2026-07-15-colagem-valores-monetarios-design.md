# Correção de colagem de valores monetários (BR) — Design

Data: 2026-07-15
Status: Aprovado pelo usuário

## Problema

Campos de valor em reais no `src/main.jsx` usam `<input type="number">`. Esse tipo de
input nativo do navegador só aceita ponto como separador decimal e rejeita vírgula.
Quando o usuário cola um valor copiado de um PDF/documento no formato brasileiro
(ex: `2.000,00`), o navegador descarta a vírgula (caractere inválido) e concatena os
dígitos restantes, produzindo `2.00000` em vez de `2000.00`. O valor salvo fica errado
sem qualquer aviso.

Exemplo relatado pelo usuário: campo "Renda Mensal" no `ClienteModal`, ao colar a renda
copiada de um comprovante em PDF.

## Escopo

Correção pontual de comportamento de colagem — não altera a UX de digitação manual
(o campo continua `type="number"`, com as setinhas nativas, validação de min/max, etc).
Aplica-se apenas a campos que representam **valor em reais**. Campos de percentual
(ex: Taxa Mensal %) e de quantidade (ex: Nº de Parcelas) ficam de fora — não é o
problema relatado e colar neles não costuma ter separador de milhar.

### Campos afetados (levantamento feito por grep em `src/main.jsx`)

**Via componente `CampoEdit` (ClienteModal, ~linha 3173-3176):**
- Renda Bruta (`RENDA_BRUTA`)
- Renda Líquida (`RENDA_LIQUIDA`)
- Renda Mensal Operacional (`RENDA_MENSAL`)

**Inputs `type="number"` standalone (valor em R$), aproximadamente 21 campos, entre eles:**
- Valor / Desconto nos Juros — `PagamentoParcelaModal` (versão Cobrança e versão ContratoModal) e `PagamentoDrop` (Dashboard)
- Valor do abatimento — Acordo Assistido
- Valor recebido no encerramento — Perdas & Recuperação
- Desconto (R$) — Quitação Antecipada
- Valor Executado, Valor Original, Saldo Atualizado, Valor Negociado, Entrada, Honorários, Custas — módulo Recuperação Judicial (acordo e quitação)
- Valor por parcela — Renegociação
- Principal — Novo Contrato
- Valor Recebido — Recuperação Após Baixa
- Valor Prometido — Promessas

A lista exata de linhas será revalidada no início da implementação (via grep de
`type="number"` combinado com label `(R$)` / contexto de valor monetário) para
garantir que nenhum campo fique de fora e nenhum campo de percentual/quantidade seja
afetado por engano.

## Abordagem escolhida

Interceptar o evento `onPaste` nos inputs monetários. Não trocar o tipo do input nem
a forma de digitação manual — só tratar o momento da colagem.

### Duas funções utilitárias novas (perto de `fmtR`, linha ~24)

```js
function parseValorColado(texto) {
  let s = String(texto || "").trim();
  if (!s) return null;
  const neg = /^-/.test(s.replace(/[^\d.,-]/g, "").trim());
  s = s.replace(/[^\d.,]/g, ""); // remove "R$", espaços, etc.
  if (!s) return null;
  const hasComma = s.includes(",");
  const hasDot = s.includes(".");
  if (hasComma && hasDot) {
    s = s.replace(/\./g, "").replace(",", "."); // ponto=milhar, vírgula=decimal
  } else if (hasComma && !hasDot) {
    s = s.replace(",", "."); // vírgula=decimal
  } else if (hasDot && !hasComma) {
    const partes = s.split(".");
    if (partes.length > 2) s = partes.join(""); // múltiplos pontos = milhar
    else if (partes[1] && partes[1].length === 3) s = partes.join(""); // "2.000" = milhar
    // senão mantém como decimal ("2.5", "2.50")
  }
  const n = parseFloat(s);
  if (isNaN(n)) return null;
  return neg ? -n : n;
}

function pasteMoeda(e, setter) {
  const texto = e.clipboardData?.getData("text") || "";
  const n = parseValorColado(texto);
  if (n === null) return; // deixa o comportamento padrão do navegador cuidar
  e.preventDefault();
  setter(String(n));
}
```

Regras de interpretação do `parseValorColado`:
- vírgula + ponto → formato BR completo (`2.000,00` → `2000.00`)
- só vírgula → vírgula é decimal (`2000,00` → `2000.00`)
- só ponto, 3 dígitos após o último ponto → tratado como milhar (`2.000` → `2000`)
- só ponto, 1-2 dígitos após → mantém como decimal, comportamento já correto hoje (`2.50` → `2.50`)
- sem separador → cola normal, sem alteração de comportamento

### Aplicação

Em cada input monetário, adicionar `onPaste={e => pasteMoeda(e, <setter-do-campo>)}`,
usando o setter/handler já existente no `onChange` daquele campo (ex: `setValor`,
`changeDesconto`, `setEdit` via wrapper no caso do `CampoEdit`).

No `CampoEdit`, adicionar uma prop nova `moeda` (boolean, default `false`); quando
`true`, o input interno ganha o `onPaste`. As 3 chamadas de Renda passam `moeda`.

## Fora de escopo

- Não formata visualmente o campo como "R$ 2.000,00" enquanto o usuário digita (isso
  seria a abordagen B, rejeitada nesta rodada por ter escopo/risco maior).
- Não altera cálculos financeiros, schema do Sheets, nem `appscript.gs` — é uma
  correção 100% de frontend, na captura do valor digitado/colado antes de virar state.
- Não adiciona validação nova além do parsing da colagem.

## Teste manual pós-implementação

No navegador, em produção, colar `2.000,00` em pelo menos 3 campos de telas diferentes
(ex: Renda Mensal no ClienteModal, Principal no Novo Contrato, Valor no PagamentoDrop
do Dashboard) e confirmar que o campo mostra `2000` (ou `2000.00`, conforme o
comportamento nativo do `type="number"` ao exibir o valor). Confirmar também que
digitar manualmente um valor continua funcionando normalmente e que colar um número
simples sem separador (ex: `500`) não muda de comportamento.
