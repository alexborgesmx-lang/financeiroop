# Botão de envio manual (fallback) na Régua WPP — Design

Data: 2026-07-30
Status: Aprovado pelo usuário

## Problema

A régua de cobrança automática via WhatsApp depende do Evolution GO (instância
self-hosted numa VPS Hostinger). Em 2026-07-29/30 a instância parou de gerar QR code
de conexão — bug não resolvido do fornecedor, causa ainda em investigação, sem previsão
de correção. Enquanto isso, nenhuma mensagem da régua sai (pré-cobrança, vencimento, em
atraso, promessa), o que compromete a operação de cobrança do dia a dia.

Objetivo: dar ao usuário (Alex, não-técnico) um fallback manual dentro do próprio painel
— sempre que a automação falhar (hoje ou no futuro), ele consegue continuar cobrando os
clientes um por um, sem depender do Evolution GO, direto pelo seu WhatsApp pessoal.

## Escopo

Aplica-se à aba **Régua WPP** (`tab==="regua"` em `src/main.jsx`), na tabela de logs
(`msgsFilt`). Para cada linha com falha de envio, oferecer um jeito de mandar a mensagem
manualmente pelo WhatsApp Web/app do usuário, e marcar a linha como resolvida depois.

### Fora de escopo

- Linhas com `STATUS_ENVIO = "ERRO_SEM_PIX"` — a causa raiz aqui não é falha de envio, é
  ausência de PIX gerado para a parcela (problema de dados, não do WhatsApp). Mandar uma
  mensagem sem PIX não resolveria o problema do cliente. Essas linhas continuam sem
  nenhum botão de ação.
- Não tenta consertar o Evolution GO nem reimplementar a régua automática.
- Não adiciona reenvio em massa/lote — é um fluxo linha a linha, deliberadamente manual
  (o usuário confere e envia cada mensagem ele mesmo).
- Não altera o comportamento de `enviarReguaCobranca` no GAS.

## Dados: o que cada tipo de erro já tem disponível

`_logMensagem` grava a linha em MENSAGENS de formas diferentes dependendo de onde a
falha ocorreu em `enviarReguaCobranca` (appscript.gs):

| `STATUS_ENVIO` | O que já temos | Botões |
|---|---|---|
| `ERRO_ENVIO` | `CONTEUDO` = texto final já renderizado (nome/valor/data já substituídos) | "Enviar Texto" + "Enviar PIX" (se achar um PIX) |
| `ERRO_PIX` | Texto já foi entregue ao cliente; `CONTEUDO` = `"ERRO_PIX_NAO_ENVIADO: <código pix>"` | Só "Enviar PIX" |
| `ERRO_SEM_PIX` | `CONTEUDO` = literal `"SEM_PIX"` (nunca chegou a montar mensagem) | Nenhum (fora de escopo) |

### Como achar o código PIX

- Se a linha tem `ID_PARCELA`: procurar em `parcelas` (já carregado no frontend) por
  `p.ID_PARCELA === m.ID_PARCELA`, usar `p.EFI_PIX_CODE`.
- Se a linha é de promessa (`GATILHO` começa com `PROMESSA`, `ID_PARCELA` vazio):
  procurar em `parcelas` a primeira parcela do `ID_CONTRATO` da linha que não esteja em
  status terminal (`_ST_TERMINAL`), na mesma ordem em que `enviarReguaCobranca` já faz
  isso no backend (primeira parcela aberta do contrato).
- Se não achar PIX em nenhum dos dois casos: linha `ERRO_ENVIO` fica só com o botão
  "Enviar Texto" (sem o botão de PIX).
- Para `ERRO_PIX`: extrair o código removendo o prefixo `"ERRO_PIX_NAO_ENVIADO: "` de
  `CONTEUDO`.

### Telefone

`cliMap.get(String(m.ID_CLIENTE))?.TELEFONE_WPP` (mesmo mapa já usado na tabela hoje).
Sem telefone válido, não mostra nenhum botão de ação na linha (nada pra fazer).

## Fluxo de envio manual

Cada botão de envio ("Enviar Texto" / "Enviar PIX") abre em nova aba:

```
https://api.whatsapp.com/send?phone=55<telefone>&text=<mensagem codificada>
```

Mesmo padrão já usado em outros pontos do `main.jsx` (linhas 2012, 2660, 5256). Isso
carrega o WhatsApp Web/app com a conversa aberta e o texto pronto na caixa de digitação
— o usuário confere e clica em enviar por conta própria, dentro do próprio WhatsApp.

## Marcar como resolvida

O clique nos botões de envio **não marca nada sozinho** — só abre o WhatsApp. Fluxo de
confirmação, igual para linhas de 1 ou 2 botões:

1. Usuário clica em cada botão de envio aplicável àquela linha (1 ou 2, dependendo do
   tipo de erro). Cada clique marca localmente (estado do componente, sem chamada ao
   backend) que aquela etapa foi disparada, e o botão correspondente muda de aparência
   (ex: opacidade reduzida / ícone de check) pra indicar que já foi clicado.
2. Só depois de todos os botões aplicáveis terem sido clicados pelo menos uma vez,
   aparece/habilita um botão extra: **"✓ Marcar como enviada"**.
3. Ao clicar em "Marcar como enviada", mostra um `window.confirm(...)` — algo como
   *"Confirma que a mensagem foi enviada para {NOME} pelo WhatsApp?"*. Só se o usuário
   confirmar, o sistema chama o backend.
4. Backend: nova action `marcarEnvioManualRegua` no GAS, recebe `idMensagem`, localiza a
   linha em MENSAGENS por `ID_MENSAGEM` (via `buildColMap`/`setCel`, mesmo padrão do
   resto do arquivo) e atualiza `STATUS_ENVIO` para `"REENVIADO_MANUAL"`.
5. Frontend: em caso de sucesso, atualização otimista do estado local (`setRaw`,
   substituindo a linha em `raw.MENSAGENS` com o novo `STATUS_ENVIO`) — a linha some da
   contagem de "Erros" e do filtro "Erros" na hora, sem precisar recarregar a página.
6. Em caso de falha na chamada ao backend (rede, etc.): alerta simples informando que não
   deu pra marcar e pra tentar de novo; a linha continua como erro (nenhum dado é
   perdido — o pior caso é o usuário ter que clicar em "Marcar como enviada" outra vez).

## Mudanças na UI (aba Régua WPP)

- Nova coluna **"Ações"** na tabela (`msgsFilt`), preenchida só em linhas com
  `STATUS_ENVIO` igual a `ERRO_ENVIO` ou `ERRO_PIX`.
- Badge de status ganha um novo valor: `REENVIADO_MANUAL` → label **"Enviada
  (manual)"**, cor distinta da "Enviada" (verde) automática e do "Erro envio" (vermelho)
  — para o usuário conseguir diferenciar no histórico o que foi coberto manualmente
  durante uma queda da automação.
- `isErr` (hoje `String(m.STATUS_ENVIO||"").startsWith("ERRO")`) já exclui
  `REENVIADO_MANUAL` naturalmente, sem precisar mudar essa função — o filtro "Erros" e o
  KPI de erros já refletem a mudança de status automaticamente.

## Testes manuais pós-implementação

1. Provocar/usar uma linha `ERRO_ENVIO` real (já existem várias na base atual) — abrir a
   aba Régua WPP, clicar "Enviar Texto", confirmar que abre o WhatsApp com o texto certo
   pro cliente certo; clicar "Enviar PIX" (se aplicável), confirmar código correto.
2. Clicar "Marcar como enviada", confirmar o diálogo, checar que a linha muda pra
   "Enviada (manual)" e some do filtro "Erros" e do KPI de erros sem recarregar a
   página.
3. Recarregar a página e confirmar que o status `REENVIADO_MANUAL` persistiu no Sheets.
4. Testar uma linha `ERRO_PIX` (se existir na base) — só o botão "Enviar PIX" deve
   aparecer.
5. Confirmar que linhas `ERRO_SEM_PIX` continuam sem nenhum botão de ação.
6. Testar o caso de falha do backend (ex: desconectar a rede antes de confirmar) —
   confirmar que aparece o alerta e a linha não muda de status.
