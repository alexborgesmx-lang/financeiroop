# Design — Retry do link ZapSign + fim do falso erro no Novo Contrato

**Data:** 2026-09-09
**Tier:** 3 (mexe em `appscript.gs` + integração externa)
**Arquivos afetados:** `appscript.gs` (`enviarParaZapSign`, `doPost`), `src/main.jsx` (`NovoContrato` — `_enviarZapSign` + modal de sucesso)

---

## 1. Problema

Ao clicar **"Enviar para ZapSign"** no modal de sucesso do Novo Contrato (contrato PCL-288,
Nathalia Custodio Nunes Paixão, 2026-09-09), o app mostrou **"Erro ZapSign: Erro ao enviar para
ZapSign"** — mas o documento foi criado normalmente na ZapSign e o cliente conseguiu assinar.

### Causa raiz

`enviarParaZapSign` (`appscript.gs` ~5561) monta o link de assinatura do credor a partir da resposta
da API de **criação** do documento:

```js
return credor.sign_url || (credor.token ? "https://app.zapsign.com.br/verificar/" + credor.token : "");
```

Sob carga, a ZapSign processa a criação de forma assíncrona e devolve a resposta **antes de
materializar os tokens dos signatários** — `signers[0].sign_url` e `signers[0].token` vêm os dois
vazios, mesmo com o documento criado. A função retorna `""`.

O GAS responde `{ok:true, zapUrl:""}`. No frontend, `_enviarZapSign` (`main.jsx` ~4073) só distingue
dois casos: `res.ok && res.zapUrl` → sucesso; qualquer outra coisa → erro vermelho. Como não houve
exceção, `res.erro` está vazio e aparece a mensagem genérica `"Erro ao enviar para ZapSign"`.

Isso é a recorrência prevista na entrada de `docs/ai-memory/07-AI-KNOWN-ISSUES.md` de 2026-08-11
("Se o erro voltar a aparecer com o documento presente no painel da ZapSign, é sinal de que `token`
também veio vazio — investigar a resposta bruta da API").

### Impacto

Nenhum dado perdido, nenhum risco financeiro. O cliente recebe o e-mail de assinatura da ZapSign
normalmente. O que se perde é a conveniência: os botões "Assinar como credor" e "Enviar mensagem de
assinatura (WhatsApp)" não aparecem, e Alex precisa ir ao painel da ZapSign manualmente. Além disso o
erro vermelho passa a impressão falsa de que o contrato não foi enviado.

### Buracos estruturais que o episódio expôs

1. **Zero visibilidade** — `enviarParaZapSign` não loga a resposta bruta da ZapSign em lugar nenhum.
2. **O frontend não distingue** "documento criado mas link ainda não pronto" de "falha real".

---

## 2. Escopo

**Ponto de entrada único:** a action `enviarZapSign` só é chamada de um lugar — `_enviarZapSign` no
componente `NovoContrato` (`main.jsx` ~4076). Não há botão ZapSign no `ContratoModal` nem em nenhum
outro fluxo. `enviarParaZapSign` no GAS só é chamada pela action `enviarZapSign` (`doPost` ~1329).

**Fora de escopo:** envio automático de ZapSign (continua sendo ação manual por botão); timbre de
contrato via Google Docs + ZapSign (inalterado); qualquer mudança de schema no Sheets.

---

## 3. Backend — `appscript.gs`

### 3.1 Helper novo: `_extrairLinkCredor(data)`

Função pequena e pura. Recebe o objeto JSON já parseado de uma resposta da ZapSign (criação **ou**
consulta), devolve a URL de assinatura do credor ou `""`.

```js
function _extrairLinkCredor(data) {
  var signers = (data && data.signers) || [];
  var credor = signers[0];               // index 0 = "ALEX MOREIRA BORGES", conforme ordem do payload
  if (!credor) return "";
  return credor.sign_url ||
         (credor.token ? "https://app.zapsign.com.br/verificar/" + credor.token : "");
}
```

### 3.2 `enviarParaZapSign` — novo final da função

Da abertura até o `POST /api/v1/docs/` e a checagem de status HTTP, **tudo permanece igual** (export
do PDF, base64, montagem do payload com os 4 signatários, `muteHttpExceptions`, exceção se não-2xx).

Substituir o trecho a partir de `var data = JSON.parse(resp.getContentText());`:

```js
var data = JSON.parse(resp.getContentText());
Logger.log("ZapSign create resp (contrato " + idContrato + "): " + resp.getContentText());

var docToken = data.token || "";
var link = _extrairLinkCredor(data);

// sign_url E token do signatário às vezes vêm vazios na criação mesmo com sucesso —
// a ZapSign materializa os tokens alguns segundos depois. Consultar o documento pelo token.
var tentativas = [3000, 5000];
for (var i = 0; i < tentativas.length && !link && docToken; i++) {
  Utilities.sleep(tentativas[i]);
  try {
    var g = UrlFetchApp.fetch("https://api.zapsign.com.br/api/v1/docs/" + docToken + "/", {
      method: "GET",
      headers: {"Authorization": "Bearer " + ZAPSIGN_TOKEN},
      muteHttpExceptions: true
    });
    Logger.log("ZapSign GET doc " + docToken + " (tentativa " + (i+1) + "): " + g.getContentText());
    if (g.getResponseCode() >= 200 && g.getResponseCode() < 300) {
      link = _extrairLinkCredor(JSON.parse(g.getContentText()));
    }
  } catch (eg) {
    Logger.log("ZapSign GET doc " + docToken + " falhou: " + eg.message);
  }
}

if (!link && docToken) {
  try {
    registrarEvento({
      idContrato: idContrato,
      nomeCliente: nomeCliente,
      tipoEvento: "ZAPSIGN_ENVIADO_SEM_LINK",
      observacoes: "Doc " + docToken + " criado na ZapSign mas link do credor não retornou após 2 " +
                   "consultas. Resposta de criação: " + resp.getContentText().substring(0, 400)
    });
  } catch (eev) { Logger.log("registrarEvento ZAPSIGN_ENVIADO_SEM_LINK falhou: " + eev.message); }
}

return { zapUrl: link, enviado: true, docToken: docToken };
```

**Contrato de retorno muda: string → objeto** `{ zapUrl, enviado, docToken }`. Chamadores: só
`doPost` (ver 3.4). Exceção real (POST não-2xx ou falha de export do PDF) continua sendo lançada e
tratada pelo `catch` global de `doPost` → `{erro: msg}`.

### 3.3 Action nova: `buscarLinkZapSign`

Consulta leve — **não cria documento nenhum**. Usada pelo botão "Buscar o link novamente" do estado
amarelo.

```js
function buscarLinkZapSign(docToken) {
  if (!docToken) return { ok: false, erro: "docToken ausente" };
  var g = UrlFetchApp.fetch("https://api.zapsign.com.br/api/v1/docs/" + docToken + "/", {
    method: "GET",
    headers: {"Authorization": "Bearer " + ZAPSIGN_TOKEN},
    muteHttpExceptions: true
  });
  Logger.log("buscarLinkZapSign " + docToken + ": " + g.getContentText());
  if (g.getResponseCode() < 200 || g.getResponseCode() >= 300) {
    return { ok: false, erro: "ZapSign " + g.getResponseCode() };
  }
  var link = _extrairLinkCredor(JSON.parse(g.getContentText()));
  return { ok: true, zapUrl: link, enviado: true, docToken: docToken };
}
```

### 3.4 `doPost` — dispatch

Linha ~1329, trocar:

```js
// ANTES
else if (body.action === "enviarZapSign") { var cliInfo=buscarInfoCliente(body.idCliente); var zRes=enviarParaZapSign(body.docId,body.idContrato,cliInfo.nome,cliInfo.email,cliInfo.telefone); res={ok:true,zapUrl:zRes}; }

// DEPOIS
else if (body.action === "enviarZapSign") { var cliInfo=buscarInfoCliente(body.idCliente); var zRes=enviarParaZapSign(body.docId,body.idContrato,cliInfo.nome,cliInfo.email,cliInfo.telefone); res={ok:true,zapUrl:zRes.zapUrl,enviado:zRes.enviado,docToken:zRes.docToken}; }
else if (body.action === "buscarLinkZapSign") { res=buscarLinkZapSign(body.docToken); }
```

O `catch` global (linha ~1392) permanece inalterado.

---

## 4. Frontend — `src/main.jsx` (`NovoContrato`)

### 4.1 Estado novo

No bloco de `useState` do componente (linha ~4037, junto de `zapUrl`/`zapErro`/`zapWppUrl`):

```js
const [zapSemLink,setZapSemLink]=useState(false);
const [zapDocToken,setZapDocToken]=useState("");
```

Reset junto dos outros na criação do contrato (linha ~4066, onde já existe
`setZapUrl("");setZapErro("");setZapWppUrl("");`): acrescentar
`setZapSemLink(false);setZapDocToken("");`.

### 4.2 `_enviarZapSign` — três casos

```js
const _enviarZapSign=async()=>{
  if(!contratoOk||zapLoading)return;
  setZapLoading(true);setZapErro("");setZapSemLink(false);
  const res=await postAction({action:"enviarZapSign",docId:contratoOk.docId,idContrato:contratoOk.idContrato,idCliente:contratoOk.clienteId});
  if(res.ok&&res.zapUrl){
    setZapUrl(res.zapUrl);
    const tel=_telOk?`55${_telOk}`:"";
    const msg=`*Contrato Gerado!*\n\n... (texto atual, inalterado) ...`;
    setZapWppUrl(tel?`https://wa.me/${tel}?text=${encodeURIComponent(msg)}`:`https://web.whatsapp.com?text=${encodeURIComponent(msg)}`);
  }else if(res.enviado){
    setZapSemLink(true);
    if(res.docToken)setZapDocToken(res.docToken);
  }else{
    setZapErro(res.erro||"Erro ao enviar para ZapSign");
  }
  setZapLoading(false);
};
```

### 4.3 `_buscarLinkZapSign` — botão do estado amarelo

```js
const _buscarLinkZapSign=async()=>{
  if(zapLoading)return;
  setZapLoading(true);
  const res=await postAction({action:"buscarLinkZapSign",docToken:zapDocToken||contratoOk.docToken});
  if(res.ok&&res.zapUrl){
    setZapUrl(res.zapUrl);setZapSemLink(false);
    const tel=_telOk?`55${_telOk}`:"";
    const msg=`*Contrato Gerado!*\n\n... (mesmo texto de _enviarZapSign) ...`;
    setZapWppUrl(tel?`https://wa.me/${tel}?text=${encodeURIComponent(msg)}`:`https://web.whatsapp.com?text=${encodeURIComponent(msg)}`);
  }
  // se ainda não veio, mantém o estado amarelo (sem erro vermelho)
  setZapLoading(false);
};
```

O texto da mensagem WhatsApp aparece hoje inline em `_enviarZapSign`. Para não duplicar, extrair para
um helper local `_msgAssinaturaZap()` que os dois usam.

### 4.4 UI do modal de sucesso

**Condição do botão "Enviar para ZapSign"** (linha ~4087): hoje `contratoOk.docId && !zapUrl`.
Passa a `contratoOk.docId && !zapUrl && !zapSemLink` — some quando o estado amarelo aparece.

**Bloco novo**, no lugar onde hoje se renderiza o `zapErro` vermelho (final do container de botões):

```jsx
{zapSemLink && !zapUrl && (
  <div style={{padding:"12px 14px",borderRadius:9,background:YEL+"14",border:`1px solid ${YEL}44`}}>
    <div style={{fontSize:12,fontWeight:700,color:YEL,marginBottom:3}}>✓ Documento enviado para a ZapSign</div>
    <div style={{fontSize:11,color:MUTED,marginBottom:10,lineHeight:1.45}}>
      O cliente já recebeu o e-mail de assinatura. O link do credor ainda não ficou pronto na ZapSign.
    </div>
    <div style={{display:"flex",flexDirection:"column",gap:6}}>
      <button onClick={_buscarLinkZapSign} disabled={zapLoading}
        style={{padding:"10px",borderRadius:8,border:`1px solid ${YEL}`,background:"transparent",
                color:YEL,fontWeight:700,fontSize:12,cursor:zapLoading?"default":"pointer",
                display:"flex",alignItems:"center",justifyContent:"center",gap:6}}>
        {zapLoading?<><IcoSpinner color={YEL}/> Buscando...</>:<>Buscar o link novamente</>}
      </button>
      <button onClick={()=>window.open("https://app.zapsign.com.br/","_blank")}
        style={{padding:"10px",borderRadius:8,border:`1px solid ${BD}`,background:CARD,
                color:MUTED,fontWeight:600,fontSize:12,cursor:"pointer"}}>
        Abrir painel da ZapSign
      </button>
    </div>
  </div>
)}
{zapErro && (/* bloco vermelho atual, inalterado */)}
```

Cores usam o token `YEL` (`#9A6510` claro / `#E3A93A` escuro) — mesmo padrão dos avisos
`⚠ Não foi possível verificar o CEP/CNPJ` já existentes no `ClienteModal`.

**Deep-link:** o botão "Abrir painel da ZapSign" abre a home `https://app.zapsign.com.br/`. Durante a
implementação, testar se `https://app.zapsign.com.br/conta/documentos/{zapDocToken}` abre direto o
documento; se funcionar, usar essa URL (com fallback para a home quando `zapDocToken` estiver vazio).

---

## 5. Testes / verificação (Tier 3)

Checklist de integridade GAS: N/A (sem datas, sem status de parcela/contrato, sem cálculo financeiro).
Checklist financeiro: N/A.

1. **Deploy** — `Skill("ultrareview-financeiroop")` → corrigir bloqueantes → `vercel deploy --prod` →
   abrir `appscript.gs` no TextEdit e instruir Alex a colar/publicar nova versão do Web App.
2. **Caminho feliz** — criar um contrato de teste real, clicar "Enviar para ZapSign":
   - link aparece; botões "Assinar como credor" e "Enviar mensagem de assinatura (WhatsApp)" funcionam;
   - **conferir no painel da ZapSign: exatamente 1 documento criado** (nunca 2).
3. **Logger** — no editor do Apps Script, confirmar que `ZapSign create resp (contrato ...)` foi
   logado com o JSON bruto.
4. **Estado amarelo** — simular link vazio: rodar `enviarParaZapSign` por uma função de teste que
   força `_extrairLinkCredor` a devolver `""` (ou stub temporário), confirmar:
   - modal mostra a faixa amarela, não o erro vermelho;
   - evento `ZAPSIGN_ENVIADO_SEM_LINK` gravado em EVENTOS com o `docToken` e o trecho da resposta;
   - "Buscar o link novamente" chama `buscarLinkZapSign` e, quando o token já materializou, troca a
     faixa amarela pelos botões normais **sem criar documento novo** na ZapSign.
5. **Erro real** — forçar token ZapSign inválido: confirmar que ainda cai no erro vermelho com
   mensagem específica (regressão do caminho de exceção).
6. **Console** — sem erros de JS no browser em nenhum dos caminhos.

### Rollback

Bug visual sem impacto financeiro → não reverter automaticamente. Se `enviarParaZapSign` passar a
lançar exceção onde antes retornava string (erro de refactor do contrato de retorno), o sintoma é
"Erro ZapSign: ..." em todo envio — nesse caso reverter e reinvestigar.

---

## 6. Documentação a atualizar (pós-implementação)

- `docs/ai-memory/07-AI-KNOWN-ISSUES.md` — atualizar a entrada de 2026-08-11 (marcar a recorrência de
  2026-09-09 e a solução do retry) **ou** nova entrada 2026-09-09 referenciando aquela.
- `CLAUDE.md` — seção ZapSign: registrar o retry por `GET /docs/{token}/`, a action
  `buscarLinkZapSign`, o evento `ZAPSIGN_ENVIADO_SEM_LINK` e o novo contrato de retorno de
  `enviarParaZapSign` (objeto, não string).
- Memória `project_zapsign_sign_url_fallback.md` — anexar o desfecho de 2026-09-09.
