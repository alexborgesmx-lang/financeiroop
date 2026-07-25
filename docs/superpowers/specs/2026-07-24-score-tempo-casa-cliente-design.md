# Score de Crédito — Substituir "idade da empresa" por "tempo de casa do cliente"

## Contexto

`calcularScore` (`appscript.gs` ~linha 1505-1514, bloco "FATOR EMPREGADOR") dava +2 pts
se `DATA_ABERTURA_EMPREGADOR` (data de abertura do CNPJ do empregador) tivesse 5+ anos.
Alex identificou que isso é um proxy fraco: mede a idade da empresa, não a relação do
cliente com ela. O cadastro já tem `DATA_ADMISSAO` (tempo de vínculo do próprio cliente
na empresa, preenchido via OCR de contracheque) — sinal mais direto de estabilidade
profissional do tomador.

## Decisão

Substituir totalmente a fonte do bônus de +2 pts: de `DATA_ABERTURA_EMPREGADOR` (idade
da empresa) para `DATA_ADMISSAO` (tempo de casa do cliente).

- Mesma escala binária de hoje: **+2 pts se tempo de casa ≥ 5 anos**, senão 0.
- `DATA_ADMISSAO` vazia ou inválida (ex: autônomo sem vínculo CLT) → **neutro, 0 pontos**,
  sem penalidade.
- O `-5 pts` por `SITUACAO_EMPREGADOR != "ATIVA"` **permanece inalterado** — é checagem de
  idoneidade do CNPJ (fraude/existência da empresa), não faz parte do que está sendo
  substituído.
- `DATA_ABERTURA_EMPREGADOR` continua existindo no cadastro e sendo usada em outros
  lugares (ex: `SCORE_EMPREGADOR` agregado em `appscript.gs:4051`) — só sai do cálculo
  individual do score do cliente.
- Texto do motivo em `SCORE_MOTIVOS` muda de `+Empregador 5+ anos (+2pts)` para
  `+Tempo de casa 5+ anos (+2pts)`.

## Implementação

Em `calcularScore`, trocar a leitura de `DATA_ABERTURA_EMPREGADOR` por `DATA_ADMISSAO` no
cálculo de `empAnosExist` (renomear para `tempoCasaAnos`), usando `parseDateLocal` para
evitar o bug de timezone UTC-3 (nunca `new Date(string)` direto). Restante da lógica
(comparação `>= 5`, aplicação do bônus, texto do motivo) segue o mesmo padrão já existente.

## Fora de escopo

- Não altera o cálculo de `SCORE_EMPREGADOR` (agregado por empregador, `appscript.gs:4051`).
- Não altera a penalização de `SITUACAO_EMPREGADOR`.
- Não requer mudança de schema nem backfill — `DATA_ADMISSAO` já existe e já é preenchida
  no fluxo atual de cadastro.
- Não requer mudança no frontend — o card de score em `main.jsx` já renderiza
  `SCORE_MOTIVOS` dinamicamente.

## Documentação a atualizar após implementação

- `docs/ai-memory/02-AI-CREDIT-RULES.md` — registrar a mudança de critério.
- `MANUAL_OPERACIONAL.md` — linha 82 (bônus do score) menciona "empregador ativo há 5+
  anos"; atualizar para "tempo de casa do cliente".
