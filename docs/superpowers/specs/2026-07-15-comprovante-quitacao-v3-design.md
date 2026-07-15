# Comprovante de Quitação — migração pra HTML+print v3 — Design

Data: 2026-07-15
Status: Aprovado pelo usuário
Fase: 2 (documentos) — segundo sub-projeto da série documento-por-documento (depois do
Comprovante de Pagamento, spec `2026-07-15-comprovante-pagamento-v3-design.md`)

## Problema

O handoff define `Comprovante de Quitação.html` (doc #2) — a peça-vitrine: declaração
formal em folha A4, selo "QUITAÇÃO TOTAL · NADA CONSTA", convite de indicação, bloco de
assinatura com QR. Hoje, "contrato quitado" tem **três implementações que não se falam**:

1. Branch `isQuitado` dentro de `gerarEEnviarComprovante` (`main.jsx:648-795`) — jsPDF,
   dispara automático quando a última parcela é paga.
2. `gerarComprovante` (`main.jsx:4717-4827`) — jsPDF separado, "carta timbrada", chamado
   sob demanda em 3 lugares: menu do `ContratoModal` (`main.jsx:4232`) e duas ações
   rápidas do Dashboard (`main.jsx:8436`/`:8446`).
3. **Certificado de Quitação** (`api/cert.js` + `gerarCertificadoQuitacao` no GAS) — já
   em produção: link público (`/c/:codigo`), QR **real** (`api.qrserver.com`), CPF
   mascarado, WhatsApp automático via `_gerarEEnviarCertificado`. Esse é o sistema mais
   maduro dos três, mas o código do certificado **nunca chega no frontend** — é gerado
   e enviado inteiramente no servidor, then descartado (`try { _gerarEEnviarCertificado(...); } catch...`
   sem capturar o retorno, confirmado em `appscript.gs:2112` e `:3046`).

## Decisões (validadas com o usuário)

1. **Unificar 1 e 2** numa função nova só, `abrirComprovanteQuitacao(dados)` — os dois
   branches/funções viram wrappers finos que montam `dados` e chamam a mesma função.
2. **QR real**, não o selo decorativo fake do handoff (aquele SVG é pixel art fixo, não
   escaneável). O QR aponta pro link público do Certificado de Quitação já existente —
   o documento novo é "o recibo bonito pra imprimir na hora"; o certificado continua
   sendo o link público de verificação/indicação. Complementares, não duplicados.
3. Isso exige uma **ação nova no GAS** (Tier 3) — o frontend não tem hoje nenhuma forma
   de obter o código do certificado. A ação reaproveita 100% a `gerarCertificadoQuitacao`
   já existente (que já é idempotente: se o contrato já tem certificado "ativo", só
   devolve o link existente; senão gera um novo). Sem lógica de negócio nova.

## Escopo

Migrar o recibo de quitação (documento privado, impresso na hora) pra HTML+print,
conectado ao Certificado de Quitação público via QR. Fora de escopo:
- Mudar qualquer coisa no fluxo do Certificado de Quitação em si (`api/cert.js`,
  `gerarCertificadoQuitacao`, `_gerarEEnviarCertificado`, envio automático de WhatsApp)
  — só vamos **ler** o código dele, nunca alterar sua lógica de geração/dedup/envio.
  Reaproveitamento total, zero touch anteriormente à ação.
- Extrato do Contrato, Timbre de Contrato, templates WhatsApp, assinatura de e-mail —
  sub-projetos próprios, ainda não abertos.
- Recuperação Judicial / quitação judicial (`registrarQuitacaoJudicial`) — usa seu
  próprio fluxo, não passa por `gerarEEnviarComprovante` nem `gerarComprovante`.

## Abordagem

### 1. GAS — ação nova `garantirCertificadoQuitacao`

```javascript
// appscript.gs — dentro do dispatcher de doPost, ao lado de "buscarCertificado"
else if (body.action === "garantirCertificadoQuitacao") {
  var dados = _buscarDadosCertificado(body.idContrato, body.idCliente);
  var cert = gerarCertificadoQuitacao({
    idContrato:  body.idContrato,
    idCliente:   body.idCliente,
    nomeCliente: dados.nome,
    cpf:         dados.cpf,
    datQuitacao: body.datQuitacao || new Date(),
    totalPago:   dados.totalPago
  });
  res = {ok:true, codigo: cert.codigoValidacao, link: cert.linkCertificado};
}
```

Insere logo antes do `else if (body.action === "buscarCertificado")` já existente
(`appscript.gs:1019`), mesmo estilo de linha única. `_buscarDadosCertificado` e
`gerarCertificadoQuitacao` já existem e não mudam — só empresta o nome/CPF/total pago
já calculados (`appscript.gs:6803` e `:6829`) e o dedup já embutido neles. `body.datQuitacao`
é opcional — o frontend manda a data real da quitação quando tem (ambos os call sites
do wrapper JS sabem essa data); cai pra `new Date()` só se não vier.

**Checklist Tier 3 aplicável:**
- ☑ Datas: `gerarCertificadoQuitacao` já usa `parseDateLocal` internamente pra
  `DATA_QUITACAO` — a ação nova não escreve datas direto, só repassa.
  ☑ Colunas: idem, `gerarCertificadoQuitacao` já usa `buildColMap`/`s()` — nada novo.
  ☑ Não mexe em `STATUS_TERMINAL`/status de parcela/contrato — é leitura+garantia de
  uma linha em `CERTIFICADOS`, sem relação com o motor de crédito.
  ☑ Sem cálculo financeiro novo — `totalPago` vem pronto de `_buscarDadosCertificado`.

### 2. Frontend — template + abertura assíncrona

```javascript
function _comprovanteQuitacaoHTML(d){ /* ver seção "Campos" abaixo */ }

async function abrirComprovanteQuitacao(dados){
  const win=window.open("","_blank");
  if(!win){
    alert("Pop-up bloqueado — permita pop-ups para este site e clique novamente.");
    return null;
  }
  win.document.write(`<!doctype html><html><head><meta charset="UTF-8"><title>Comprovante de Quitação</title></head><body style="font-family:sans-serif;padding:40px;text-align:center;color:#57514A">Gerando comprovante...</body></html>`);
  win.document.close();
  let qrUrl=null, certLink=null, autenticacao=dados.autenticacaoFallback;
  try{
    const certRes=await postAction({action:"garantirCertificadoQuitacao",idContrato:dados.contrato,idCliente:dados.idCliente,datQuitacao:dados.dataQuitacaoISO});
    if(certRes?.ok){
      certLink=certRes.link;
      autenticacao=certRes.codigo;
      qrUrl=`https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=${encodeURIComponent(certRes.link)}`;
    }
  }catch(e){ /* silencioso — documento abre sem QR, ver "Fora de escopo" */ }
  win.document.open();
  win.document.write(_comprovanteQuitacaoHTML({...dados, qrUrl, certLink, autenticacao}));
  win.document.close();
  return win;
}
```

**Por que abrir a janela antes do `await`:** mesmo motivo já documentado na spec do
Comprovante de Pagamento — `window.open` fora do gesto de clique síncrono corre risco
de bloqueio por pop-up blocker. Abrindo a janela imediatamente (com um placeholder) e
preenchendo depois do `await`, o navegador nunca vê um `window.open` "atrasado".

**`dados.autenticacaoFallback`:** se a chamada ao GAS falhar (rede, GAS fora do ar), o
documento não pode ficar sem nenhum código de autenticação — cada branch chamador monta
um fallback local no mesmo formato que já existe hoje (`QT·<4 últimos do contrato>·<ano>·BORGES`,
já usado em `gerarComprovante` linha 4803), só como plano B. O caminho feliz sempre usa
o `CODIGO_VALIDACAO` real do certificado.

### 3. Campos do template (`_comprovanteQuitacaoHTML`)

Replica `Comprovante de Quitação.html` do handoff — folha A4 (`.sheet`, 794px), faixa
`--brand` com Linha de Confiança (`data-n="12" data-sw="1.75"`), selo circular rotacionado
"QUITAÇÃO TOTAL · NADA CONSTA" (`--signal`, `rotate(-11deg)`), declaração em serifa
(`.serif`, `Contrato integralmente quitado` — **esse é o primeiro documento a realmente
usar Newsreader**, diferente do Comprovante de Pagamento), bloco de fatos, convite de
indicação (`.invite`, cita "Você faz parte da Rede Borges"), bloco de assinatura com QR.

| Campo do template | Origem |
|---|---|
| Cliente + CPF (uma linha) | `nome`, `cpf` |
| Contrato | `ID_CONTRATO` |
| Valor principal | `VALOR_PRINCIPAL`/`VALOR_TOTAL` do contrato |
| Total pago (principal + juros) | soma de `VALOR_PAGO` das parcelas (já calculado nos dois branches hoje) |
| Parcelas | `"${pagas} de ${total} pagas"` |
| Período | **novo campo, não existe nas versões jsPDF atuais** — `mmm/aaaa` da 1ª `DATA_VENCIMENTO` até `mmm/aaaa` da data de quitação |
| Data da quitação | data do último pagamento |
| QR + link | `qrUrl`/`certLink` (pode vir `null` — ver Fora de escopo) |
| Autenticação | `CODIGO_VALIDACAO` real do certificado, ou fallback local |

**Sem CPF mascarado aqui** (diferente do `api/cert.js`, que é público) — este documento
é privado, entregue direto ao cliente/impresso na hora, mesmo padrão de CPF completo que
as duas versões jsPDF atuais já usam.

### 4. `gerarEEnviarComprovante` — branch `isQuitado` vira chamada + jsPDF morto é deletado

Troca todo o corpo de `main.jsx:697-793` (desde `const doc=new jsPDF(...)` até o fim do
`try`, listado na íntegra na spec original — ver arquivo atual pra texto exato no
momento da implementação) por uma chamada a `abrirComprovanteQuitacao`, no mesmo padrão
do branch `!isQuitado` que já existe (`main.jsx:679-696`):

```javascript
    // (isQuitado === true neste ponto — o branch !isQuitado já retornou acima)
    const totalPagasCount=pagas.length+(jaEstavaPaga?0:1);
    abrirComprovanteQuitacao({
      nome, cpf:String(cliente?.CPF||'—'), contrato:String(parcela.ID_CONTRATO),
      idCliente:String(parcela.ID_CLIENTE||cliente?.ID_CLIENTE||''),
      valorPrincipal:fR(valorOriginal), totalPago:fR(totalJaPago),
      parcelasLabel:`${totalPagasCount} de ${totalParcEfetivo} pagas`,
      periodoInicio:fD(hist[0]?.DATA_VENCIMENTO), periodoFim:fD(dataPago),
      dataQuitacao:fD(dataPago), dataQuitacaoISO:apiDateStr(dataPago),
      autenticacaoFallback:`QT·${String(parcela.ID_CONTRATO).slice(-4)}·${now.getFullYear()}·BORGES`,
    });
    if(opts.wpp){const tel=telefone?`55${telefone}`:'';const isMobile=/iPhone|iPad|iPod|Android/i.test(navigator.userAgent);const wppUrl=tel?`https://wa.me/${tel}`:(isMobile?'https://wa.me':'https://web.whatsapp.com');setTimeout(()=>window.open(wppUrl,'_blank'),700);}
    return;
```

Depois dessa troca, **os dois branches de `gerarEEnviarComprovante` retornam antes do
fim da função** — o `catch` continua no lugar (`try`/`catch` em volta de tudo), mas não
sobra nenhum código jsPDF entre os dois `return` e o `catch`. `_renderHistParcelas`
continua existindo e sendo usada por `gerarExtratoPDF` (fora de escopo) — não é
deletada, só o uso dela aqui.

### 5. `gerarComprovante` vira wrapper fino — os 3 call sites não mudam

```javascript
function gerarComprovante(contrato, parcelasContrato, cliente, totalPagoOverride, ultPagOverride){
  const ps=[...parcelasContrato].sort((a,b)=>parseInt(a.NUM_PARCELA||0)-parseInt(b.NUM_PARCELA||0));
  const totalPagoPs=ps.reduce((s,p)=>s+parseFloat(p.VALOR_PAGO||0),0);
  const totalPago=totalPagoOverride!==undefined?Math.max(totalPagoPs,totalPagoOverride):totalPagoPs;
  const valorOriginal=parseFloat(contrato.VALOR_PRINCIPAL||contrato.VALOR_TOTAL||0);
  const datasPs=ps.map(p=>parseDate(p.DATA_PAGAMENTO)).filter(Boolean);
  const ultPag=ultPagOverride||(datasPs.length?datasPs.reduce((a,b)=>a>b?a:b):null);
  const nome=String(contrato.NOME_CLIENTE||cliente?.NOME_CLIENTE||'—');
  const cpf=String(contrato.CPF||cliente?.CPF||'—');
  const fD=d=>{if(!d)return'—';const dt=d instanceof Date?d:parseDate(d);return dt&&!isNaN(dt)?dt.toLocaleDateString('pt-BR'):'—';};
  const pagasCount=ps.filter(p=>_ST_TERMINAL.has(String(p.STATUS||"").toLowerCase())).length;
  abrirComprovanteQuitacao({
    nome, cpf, contrato:String(contrato.ID_CONTRATO),
    idCliente:String(cliente?.ID_CLIENTE||contrato.ID_CLIENTE||''),
    valorPrincipal:fmtR(valorOriginal), totalPago:fmtR(totalPago),
    parcelasLabel:`${pagasCount} de ${ps.length} pagas`,
    periodoInicio:fD(ps[0]?.DATA_VENCIMENTO), periodoFim:fD(ultPag),
    dataQuitacao:fD(ultPag), dataQuitacaoISO:ultPag?apiDateStr(ultPag):"",
    autenticacaoFallback:`QT·${String(contrato.ID_CONTRATO).slice(-4)}·${new Date().getFullYear()}·BORGES`,
  });
}
```

Assinatura idêntica à atual — os 3 call sites (`main.jsx:4232`, `:8436`, `:8446`) não
precisam de nenhuma mudança. `_ST_TERMINAL` já é a constante global do sistema (nunca
redefinida localmente, conforme regra do `CLAUDE.md`) — só está sendo lida aqui, como
já era antes.

## Fora de escopo

- Se a chamada `garantirCertificadoQuitacao` falhar (rede, GAS fora do ar, ou o
  contrato não tiver dados suficientes pra gerar certificado), o documento abre **sem
  QR e sem link**, usando o código de autenticação de fallback local — degrada graciosamente,
  não quebra o fluxo de "documento abriu". Não há retry automático nesta rodada.
- Não adiciona botão "Ver certificado público" nem nenhuma UI nova além do documento em
  si — o link só aparece dentro do QR/rodapé do próprio documento.
- Não muda `_gerarEEnviarCertificado` nem o envio automático de WhatsApp do certificado
  — aquele fluxo continua rodando exatamente como hoje, em paralelo.
- Recuperação Judicial (`registrarQuitacaoJudicial`) não é tocada.

## Teste manual pós-implementação

1. No GAS: colar o arquivo completo, publicar nova versão do Web App (`CLAUDE.md` —
   sempre substituição integral, nunca só o trecho).
2. Registrar o pagamento da **última parcela** de um contrato de teste → confirmar que
   abre a aba do comprovante de quitação (não a de pagamento normal), com QR visível
   depois de alguns instantes (placeholder "Gerando..." primeiro).
3. Escanear o QR (ou abrir o link) e confirmar que leva pro Certificado de Quitação
   público existente, com os mesmos dados.
4. No `ContratoModal` de um contrato já quitado, usar "Comprovante de Quitação" no menu
   "..." → mesma verificação.
5. Repetir o passo 4 pra um contrato quitado **há muito tempo** (certificado já deve
   existir) → confirmar que reaproveita o certificado existente (mesmo código/link toda
   vez, sem duplicar linha em `CERTIFICADOS`).
6. Desligar a rede momentaneamente (ou simular falha) durante o passo 2 → confirmar que
   o documento ainda abre, sem QR, com o código de fallback.
7. Confirmar que o Comprovante de Pagamento (parcela não-final, sub-projeto anterior)
   continua funcionando sem regressão.
8. Sem erros de console.
