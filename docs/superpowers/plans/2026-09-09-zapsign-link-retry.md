# Retry do Link ZapSign + Fim do Falso Erro — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Quando a ZapSign cria o documento mas ainda não materializou o `sign_url`/`token` do
signatário (assíncrono sob carga), o sistema tenta de novo (retry com espera) antes de desistir, e o
frontend mostra um estado amarelo "documento enviado, link ainda não pronto" com botão de nova busca —
em vez do erro vermelho falso "Erro ao enviar para ZapSign" que aparece hoje mesmo quando tudo deu certo.

**Architecture:** `enviarParaZapSign` (GAS) passa a fazer até 2 tentativas de `GET
/docs/{token}/` (esperando 3s e 5s) quando o link não vem na resposta de criação, e devolve um objeto
`{zapUrl, enviado, docToken}` em vez de uma string nua — isso permite ao chamador distinguir "sem link
ainda" de "falhou de verdade" sem depender de exceção. Uma action nova, `buscarLinkZapSign`, expõe a
mesma consulta `GET` sem nunca criar documento novo, para o botão "Buscar o link novamente" da UI. No
frontend, `_enviarZapSign` passa a tratar 3 casos (sucesso / enviado-sem-link / erro real) e um novo
componente inline mostra o estado amarelo.

**Tech Stack:** Google Apps Script (`appscript.gs`, backend síncrono, sem test runner — Logger.log é a
única instrumentação disponível) + React 18/Vite (`src/main.jsx`, inline styles, sem framework de
teste automatizado no projeto).

## Global Constraints

- **Sem suite de testes automatizados neste repo** (confirmado: `package.json` só tem `dev`/`build`
  Vite, nenhum `test`). "Rodar o teste" nesta plan significa: `npm run build` para pegar erro de
  sintaxe/JSX, leitura cuidadosa do diff, e — no fechamento (Task 5) — teste manual no browser em
  produção depois do deploy, conforme o Protocolo de Verificação Tier 3 do `CLAUDE.md` do projeto.
  GAS não pode ser testado localmente: só existe depois que o Alex publica a nova versão do Web App
  no editor do Apps Script.
- **Contrato de retorno muda de string para objeto** em `enviarParaZapSign` — o único chamador é
  `doPost` (ação `enviarZapSign`, linha ~1329 hoje). Task 2 atualiza os dois juntos, no mesmo commit.
- **Nunca criar um segundo documento ZapSign** para tentar obter o link — todo retry/nova busca usa
  `GET /docs/{token}/` (consulta), nunca `POST /docs/` (criação) de novo.
- **Fora de escopo:** ContratoModal (não tem botão ZapSign), timbre de contrato via Google Docs
  (inalterado), qualquer mudança de schema no Sheets.
- **Cores/UI:** o estado amarelo usa o token `YEL` já existente no tema (mesmo padrão dos avisos
  "⚠ Não foi possível verificar o CEP/CNPJ" do `ClienteModal`) — não introduzir cor nova.
- Commits em português, prefixo `feat:`/`fix:`, terminando com a linha de atribuição do Claude Code
  (ver instruções da sessão).

---

## Mapa de arquivos

| Arquivo | Responsabilidade nesta mudança |
|---|---|
| `appscript.gs` | `_extrairLinkCredor` (helper puro), retry em `enviarParaZapSign`, nova função `buscarLinkZapSign`, dispatch em `doPost` |
| `src/main.jsx` | Componente `NovoContrato`: estado novo, `_enviarZapSign` com 3 ramos, `_buscarLinkZapSign`, helper `_msgAssinaturaZap`, bloco de UI do estado amarelo |
| `docs/ai-memory/07-AI-KNOWN-ISSUES.md` | Nova entrada 2026-09-09 (ou atualização da de 2026-08-11) |
| `CLAUDE.md` | Seção ZapSign — documentar retry, nova action, evento `ZAPSIGN_ENVIADO_SEM_LINK`, contrato de retorno objeto |
| Memória (`~/.claude/.../memory/project_zapsign_sign_url_fallback.md`) | Anexar desfecho 2026-09-09 |

---

### Task 1: Backend — helper de extração + retry em `enviarParaZapSign`

**Files:**
- Modify: `appscript.gs:5561-5610` (função `enviarParaZapSign`, fim da função)

**Interfaces:**
- Consumes: nada de tarefas anteriores.
- Produces: `_extrairLinkCredor(data)` → string (URL ou `""`). `enviarParaZapSign(docId, idContrato,
  nomeCliente, emailCliente, telefoneCliente)` → agora retorna **objeto**
  `{zapUrl: string, enviado: true, docToken: string}` em vez de string nua. Task 2 depende deste novo
  formato de retorno.

- [ ] **Step 1: Ler o trecho atual para confirmar as linhas exatas**

Rodar:
```bash
grep -n "function enviarParaZapSign" appscript.gs
sed -n '5561,5610p' appscript.gs
```
Confirmar que o final da função (após o `POST` e a checagem de status HTTP) é:
```js
  var data = JSON.parse(resp.getContentText());
  var signers = data.signers || [];
  // index 0 = credor (Alex) — cliente recebe link por email automaticamente
  var credor = signers[0];
  if (!credor) return "";
  // sign_url às vezes vem vazio na criação do doc mesmo com sucesso — fallback documentado
  // pela própria ZapSign: montar o link a partir do token do signatário
  return credor.sign_url || (credor.token ? "https://app.zapsign.com.br/verificar/" + credor.token : "");
}
```
Se o texto não bater exatamente (foi editado desde a spec), ajustar os steps seguintes para o texto
real antes de prosseguir — não adivinhar.

- [ ] **Step 2: Adicionar o helper `_extrairLinkCredor` logo antes de `enviarParaZapSign`**

Inserir imediatamente acima de `function enviarParaZapSign(...)`:
```js
// Extrai a URL de assinatura do credor (signatário índice 0) de uma resposta JSON já parseada
// da ZapSign — funciona tanto pra resposta de criação (POST /docs/) quanto de consulta
// (GET /docs/{token}/), já que o formato do objeto "signers" é o mesmo nos dois.
function _extrairLinkCredor(data) {
  var signers = (data && data.signers) || [];
  var credor = signers[0]; // index 0 = "ALEX MOREIRA BORGES", conforme ordem do payload de criação
  if (!credor) return "";
  return credor.sign_url ||
         (credor.token ? "https://app.zapsign.com.br/verificar/" + credor.token : "");
}
```

- [ ] **Step 3: Substituir o final de `enviarParaZapSign` pelo retry**

Trocar exatamente o trecho confirmado no Step 1 (do `var data = JSON.parse(...)` até o fechamento da
função) por:
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
}
```
Confirmar que a chave de fechamento `}` do trecho colado é a mesma que fechava a função original —
não duplicar nem deixar a função aberta.

- [ ] **Step 4: Verificar sintaticamente**

GAS não roda localmente. Verificação possível sem o editor Apps Script:
```bash
node --check <(sed -n '1,$p' appscript.gs 2>/dev/null) 2>&1 | head -20
```
Se o `node --check` não aceitar o arquivo inteiro por causa de sintaxe específica do GAS (ex:
`SpreadsheetApp` são globais, isso é esperado e não é erro de sintaxe) — o que importa aqui é não ter
`SyntaxError` de chave/parêntese desbalanceado. Se `node --check` reclamar de algo que não seja
referência a global do GAS, revisar o Step 3. Ler visualmente as 20 linhas ao redor da mudança:
```bash
sed -n '5561,5645p' appscript.gs
```
Confirmar: função abre e fecha corretamente, `_extrairLinkCredor` está definida antes de ser usada.

- [ ] **Step 5: Commit**

```bash
git add appscript.gs
git commit -m "$(cat <<'EOF'
feat: retry do link ZapSign via GET quando sign_url vem vazio na criação

enviarParaZapSign agora tenta GET /docs/{token}/ (3s, depois 5s) antes de
desistir quando a criação do documento volta sem sign_url/token do
signatário — a ZapSign materializa isso alguns segundos depois sob carga.
Se ainda assim não vier, registra evento ZAPSIGN_ENVIADO_SEM_LINK em vez de
falhar silenciosamente. Contrato de retorno muda de string para objeto
{zapUrl, enviado, docToken} — chamador (doPost) atualizado na próxima tarefa.

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 2: Backend — action `buscarLinkZapSign` + dispatch em `doPost`

**Files:**
- Modify: `appscript.gs` (nova função perto de `enviarParaZapSign`; `doPost` ~linha 1329)

**Interfaces:**
- Consumes: `_extrairLinkCredor(data)` de Task 1; `ZAPSIGN_TOKEN` (constante global, linha 22);
  retorno objeto de `enviarParaZapSign` de Task 1.
- Produces: `buscarLinkZapSign(docToken)` → `{ok: boolean, zapUrl?: string, enviado?: true,
  docToken?: string, erro?: string}`. Ação `doPost` `"buscarLinkZapSign"` (body: `{docToken}`) e ação
  `"enviarZapSign"` com resposta agora incluindo `zapUrl`, `enviado`, `docToken` como campos
  separados (não mais um único `zapUrl` string). Frontend (Task 3/4) consome esse formato.

- [ ] **Step 1: Adicionar `buscarLinkZapSign` logo depois de `enviarParaZapSign`**

```bash
grep -n "^function enviarParaZapSign" appscript.gs
```
Localizar a linha do `}` que fecha `enviarParaZapSign` (já modificada na Task 1) e inserir logo
depois:
```js
// Consulta leve — NÃO cria documento nenhum. Usada pelo botão "Buscar o link novamente" da UI
// quando enviarParaZapSign devolveu enviado:true mas zapUrl vazio.
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

- [ ] **Step 2: Atualizar o dispatch de `doPost`**

```bash
grep -n '"enviarZapSign"' appscript.gs
```
Trocar a linha (hoje, algo como):
```js
    else if (body.action === "enviarZapSign")          { var cliInfo=buscarInfoCliente(body.idCliente); var zRes=enviarParaZapSign(body.docId,body.idContrato,cliInfo.nome,cliInfo.email,cliInfo.telefone); res={ok:true,zapUrl:zRes}; }
```
por:
```js
    else if (body.action === "enviarZapSign")          { var cliInfo=buscarInfoCliente(body.idCliente); var zRes=enviarParaZapSign(body.docId,body.idContrato,cliInfo.nome,cliInfo.email,cliInfo.telefone); res={ok:true,zapUrl:zRes.zapUrl,enviado:zRes.enviado,docToken:zRes.docToken}; }
    else if (body.action === "buscarLinkZapSign")      { res=buscarLinkZapSign(body.docToken); }
```
Não tocar no `catch` global de `doPost` (~linha 1392) — continua tratando exceção real (POST não-2xx,
falha de export do PDF) como `{erro: msg}`, comportamento inalterado.

- [ ] **Step 3: Verificar**

```bash
sed -n '5561,5660p' appscript.gs   # ajustar range conforme onde ficou buscarLinkZapSign
grep -n '"enviarZapSign"\|"buscarLinkZapSign"' appscript.gs
```
Confirmar: as duas linhas do dispatch existem, `buscarLinkZapSign` está definida uma única vez, sem
duplicar a linha de `enviarZapSign` antiga por engano.

- [ ] **Step 4: Commit**

```bash
git add appscript.gs
git commit -m "$(cat <<'EOF'
feat: nova action buscarLinkZapSign + doPost repassa objeto de enviarZapSign

buscarLinkZapSign(docToken) consulta o documento na ZapSign (GET, nunca
cria) — usada pelo botão "Buscar o link novamente" quando o envio inicial
veio sem link. doPost.enviarZapSign atualizado para o novo contrato de
retorno objeto de enviarParaZapSign (Task anterior).

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 3: Frontend — estado novo + `_enviarZapSign` com 3 ramos + helper de mensagem

**Files:**
- Modify: `src/main.jsx` (componente `NovoContrato`, bloco de `useState` ~linha 4037, `_enviarZapSign`
  ~linhas 4073-4084, reset de estado na criação do contrato)

**Interfaces:**
- Consumes: resposta de `postAction({action:"enviarZapSign",...})` no novo formato
  `{ok, zapUrl, enviado, docToken, erro}` de Task 2.
- Produces: estados `zapSemLink` (bool), `zapDocToken` (string); helper
  `_msgAssinaturaZap()` → string (texto da mensagem WhatsApp, sem interpolação de telefone). Task 4
  consome `zapSemLink`, `zapDocToken` e `_msgAssinaturaZap`.

- [ ] **Step 1: Localizar o bloco de estado atual**

```bash
grep -n "const \[zapLoading" src/main.jsx
```
Confirmar a linha (hoje ~4037) contendo
`const [zapLoading,setZapLoading]=useState(false);const [zapUrl,setZapUrl]=useState("");const [zapErro,setZapErro]=useState("");const [zapWppUrl,setZapWppUrl]=useState("");`.

- [ ] **Step 2: Adicionar os dois estados novos, na mesma linha (mesmo padrão compacto do arquivo)**

Usar Edit para inserir logo após `const [zapWppUrl,setZapWppUrl]=useState("");`:
```js
const [zapSemLink,setZapSemLink]=useState(false);const [zapDocToken,setZapDocToken]=useState("");
```

- [ ] **Step 3: Encontrar e atualizar o reset de estado ao criar um novo contrato**

```bash
grep -n 'setZapUrl("");setZapErro("");setZapWppUrl("")' src/main.jsx
```
Nessa linha (reset disparado quando um novo contrato é criado, antes do modal de sucesso), acrescentar
logo depois de `setZapWppUrl("");`:
```js
setZapSemLink(false);setZapDocToken("");
```

- [ ] **Step 4: Extrair o texto da mensagem WhatsApp para um helper compartilhado**

Localizar o texto inline dentro de `_enviarZapSign`:
```bash
grep -n "Acabei de enviar o link para seu e-mail" src/main.jsx
```
Antes da definição de `_enviarZapSign` (linha ~4073), adicionar:
```js
const _msgAssinaturaZap=()=>`*Contrato Gerado!*\n\nAcabei de enviar o link para seu e-mail.\n\n*Importante:*\n1. Leia os termos com atenção.\n2. Assine eletronicamente (tem validade jurídica).\n3. Assim que assinar, o sistema me notifica para liberar o Pix.\n4. Após realizar a assinatura, envie, por favor, os dados do Pix para a transferência. (Banco, Nome da conta e Chave Pix)\n\nFico no aguardo!`;
```
(Texto idêntico ao que já existe — copiar exatamente, sem reescrever a redação.)

- [ ] **Step 5: Reescrever `_enviarZapSign` com os 3 ramos**

Substituir a função inteira (hoje):
```js
const _enviarZapSign=async()=>{
  if(!contratoOk||zapLoading)return;
  setZapLoading(true);setZapErro("");
  const res=await postAction({action:"enviarZapSign",docId:contratoOk.docId,idContrato:contratoOk.idContrato,idCliente:contratoOk.clienteId});
  if(res.ok&&res.zapUrl){
    setZapUrl(res.zapUrl);
    const tel=_telOk?`55${_telOk}`:"";
    const msg=`*Contrato Gerado!*\n\nAcabei de enviar o link para seu e-mail.\n\n*Importante:*\n1. Leia os termos com atenção.\n2. Assine eletronicamente (tem validade jurídica).\n3. Assim que assinar, o sistema me notifica para liberar o Pix.\n4. Após realizar a assinatura, envie, por favor, os dados do Pix para a transferência. (Banco, Nome da conta e Chave Pix)\n\nFico no aguardo!`;
    setZapWppUrl(tel?`https://wa.me/${tel}?text=${encodeURIComponent(msg)}`:`https://web.whatsapp.com?text=${encodeURIComponent(msg)}`);
  }else{setZapErro(res.erro||"Erro ao enviar para ZapSign");}
  setZapLoading(false);
};
```
por:
```js
const _enviarZapSign=async()=>{
  if(!contratoOk||zapLoading)return;
  setZapLoading(true);setZapErro("");setZapSemLink(false);
  const res=await postAction({action:"enviarZapSign",docId:contratoOk.docId,idContrato:contratoOk.idContrato,idCliente:contratoOk.clienteId});
  if(res.ok&&res.zapUrl){
    setZapUrl(res.zapUrl);
    const tel=_telOk?`55${_telOk}`:"";
    const msg=_msgAssinaturaZap();
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

- [ ] **Step 6: Verificar com build**

```bash
npm run build 2>&1 | tail -30
```
Esperado: build conclui sem erro (`✓ built in ...`). Se der erro de sintaxe apontando pra essas
linhas, revisar o Step 5 — provavelmente vírgula/chave faltando.

- [ ] **Step 7: Commit**

```bash
git add src/main.jsx
git commit -m "$(cat <<'EOF'
feat: _enviarZapSign distingue link pronto / enviado-sem-link / erro real

Consome o novo contrato de retorno objeto de enviarZapSign (GAS). Extrai a
mensagem de WhatsApp pro helper _msgAssinaturaZap, reutilizado pelo botão
"Buscar o link novamente" da próxima tarefa. Estados zapSemLink/zapDocToken
resetados junto dos outros campos de ZapSign ao criar um novo contrato.

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 4: Frontend — `_buscarLinkZapSign` + UI do estado amarelo

**Files:**
- Modify: `src/main.jsx` (componente `NovoContrato`: nova função ao lado de `_enviarZapSign`; JSX do
  modal de sucesso, condição do botão "Enviar para ZapSign" e bloco de erro)

**Interfaces:**
- Consumes: `zapSemLink`, `zapDocToken`, `_msgAssinaturaZap`, `IcoSpinner({size,color})` (já existe,
  `src/main.jsx:350`), token de tema `YEL` (já existe em `LIGHT`/`DARK`) — todos de Task 3 ou
  já presentes no arquivo.
- Produces: nada consumido por tarefas posteriores (última tarefa de código).

- [ ] **Step 1: Adicionar `_buscarLinkZapSign` logo depois de `_enviarZapSign`**

```js
const _buscarLinkZapSign=async()=>{
  if(zapLoading)return;
  setZapLoading(true);
  const res=await postAction({action:"buscarLinkZapSign",docToken:zapDocToken});
  if(res.ok&&res.zapUrl){
    setZapUrl(res.zapUrl);setZapSemLink(false);
    const tel=_telOk?`55${_telOk}`:"";
    const msg=_msgAssinaturaZap();
    setZapWppUrl(tel?`https://wa.me/${tel}?text=${encodeURIComponent(msg)}`:`https://web.whatsapp.com?text=${encodeURIComponent(msg)}`);
  }
  // se ainda não veio, mantém o estado amarelo — nunca mostra erro vermelho aqui
  setZapLoading(false);
};
```

- [ ] **Step 2: Ajustar a condição do botão "Enviar para ZapSign"**

```bash
grep -n 'contratoOk.docId&&!zapUrl&&<button onClick={_enviarZapSign}' src/main.jsx
```
Trocar `contratoOk.docId&&!zapUrl&&<button onClick={_enviarZapSign}` por
`contratoOk.docId&&!zapUrl&&!zapSemLink&&<button onClick={_enviarZapSign}` (só essa condição, o resto
do botão fica igual).

- [ ] **Step 3: Adicionar o bloco amarelo, antes do bloco de erro vermelho existente**

```bash
grep -n '{zapErro&&<div style={{marginTop:4' src/main.jsx
```
Imediatamente antes dessa linha (o bloco de erro vermelho do ZapSign), inserir:
```jsx
{zapSemLink&&!zapUrl&&<div style={{marginTop:4,padding:"12px 14px",borderRadius:9,background:YEL+"14",border:`1px solid ${YEL}44`}}><div style={{fontSize:12,fontWeight:700,color:YEL,marginBottom:3}}>✓ Documento enviado para a ZapSign</div><div style={{fontSize:11,color:MUTED,marginBottom:10,lineHeight:1.45}}>O cliente já recebeu o e-mail de assinatura. O link do credor ainda não ficou pronto na ZapSign.</div><div style={{display:"flex",flexDirection:"column",gap:6}}><button onClick={_buscarLinkZapSign} disabled={zapLoading} style={{padding:"10px",borderRadius:8,border:`1px solid ${YEL}`,background:"transparent",color:YEL,fontWeight:700,fontSize:12,cursor:zapLoading?"default":"pointer",display:"flex",alignItems:"center",justifyContent:"center",gap:6}}>{zapLoading?<><IcoSpinner color={YEL}/> Buscando...</>:<>Buscar o link novamente</>}</button><button onClick={()=>window.open("https://app.zapsign.com.br/","_blank")} style={{padding:"10px",borderRadius:8,border:`1px solid ${BD}`,background:CARD,color:MUTED,fontWeight:600,fontSize:12,cursor:"pointer"}}>Abrir painel da ZapSign</button></div></div>}
```
Manter o bloco de erro vermelho (`{zapErro&&...}`) exatamente como está, logo depois — os dois blocos
nunca aparecem juntos porque `_enviarZapSign`/`_buscarLinkZapSign` só setam um dos dois estados por
vez.

- [ ] **Step 4: Build**

```bash
npm run build 2>&1 | tail -30
```
Esperado: `✓ built in ...`, sem erro de JSX não fechado.

- [ ] **Step 5: Commit**

```bash
git add src/main.jsx
git commit -m "$(cat <<'EOF'
feat: estado amarelo "link ainda não pronto" + botão buscar de novo (ZapSign)

Substitui o falso erro vermelho quando a ZapSign cria o documento mas o
link do credor ainda não materializou. "Buscar o link novamente" chama
buscarLinkZapSign (consulta, nunca cria documento novo); "Abrir painel da
ZapSign" é fallback manual.

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 5: Deploy, verificação Tier 3 e documentação

**Files:**
- Modify: `docs/ai-memory/07-AI-KNOWN-ISSUES.md`, `CLAUDE.md`
- No code files (deploy + docs only)

**Interfaces:**
- Consumes: todo o código das Tasks 1-4, já commitado.
- Produces: nada (última tarefa).

- [ ] **Step 1: Review pré-deploy**

Rodar `Skill("ultrareview-financeiroop")` (Tier 3 — mudança em `appscript.gs` + integração externa,
conforme a tabela de review obrigatório do `CLAUDE.md`). Corrigir qualquer item CRÍTICO/BLOQUEANTE
antes de prosseguir. Itens N/A esperados pela spec: checklist de integridade GAS (sem datas, sem
status de parcela/contrato tocados) e checklist financeiro (sem cálculo alterado) — confirmar que o
review concorda com esse N/A, não assumir.

- [ ] **Step 2: Deploy do frontend**

```bash
vercel deploy --prod
```
Aguardar a URL de produção confirmando sucesso (sem erro de build).

- [ ] **Step 3: Publicar o GAS**

```bash
open -a "TextEdit" /Users/alexborges/financeiroop/appscript.gs
```
Instruir o Alex: **Cmd+A → Cmd+C → colar no editor do Google Apps Script → Implantar → Gerenciar
implantações → editar a implantação existente → Nova versão → Implantar.** Aguardar confirmação do
Alex antes de seguir para o Step 4.

- [ ] **Step 4: Teste no browser (skill `browser`) — caminho feliz**

Usar `Skill("browser")` para abrir o app em produção, criar um contrato de teste real (nome
claramente identificável como teste, ex: "TESTE ZAPSIGN"), no modal de sucesso clicar "Enviar para
ZapSign":
- Confirmar que aparece **ou** o botão "Assinar como credor" com link funcional **ou** o bloco amarelo
  "Documento enviado para a ZapSign" (ambos são sucesso — depende de quão rápido a ZapSign materializa
  o token no momento do teste).
- **Conferir no painel da ZapSign (https://app.zapsign.com.br/) que exatamente 1 documento foi
  criado** para esse contrato de teste — nunca 2.
- Sem erro de console JavaScript no browser.

- [ ] **Step 5: Teste do estado amarelo e do botão "Buscar o link novamente"**

Se o Step 4 já caiu no caminho feliz (link veio na hora), forçar o caminho amarelo é opcional — mas se
ele ocorrer naturalmente (ZapSign lenta no momento do teste), aproveitar para validar:
- Clicar "Buscar o link novamente" — confirmar que troca para o botão "Assinar como credor" quando o
  link materializa, **sem criar documento novo** (checar de novo no painel ZapSign que a contagem não
  subiu).
- No editor do Apps Script (Alex), em **Execuções**, abrir a execução de `enviarParaZapSign` do
  contrato de teste e confirmar no log: `ZapSign create resp (contrato ...)` presente; se o link não
  veio na criação, também `ZapSign GET doc ... (tentativa 1)` e/ou `(tentativa 2)`.
- Se o evento `ZAPSIGN_ENVIADO_SEM_LINK` foi gravado (caso o link não tenha vindo nem depois do
  retry), confirmar a linha em EVENTOS (aba do Sheets) com o `docToken` e o trecho da resposta.

- [ ] **Step 6: Teste do caminho de erro real (regressão)**

Confirmar que um erro de verdade (ex: token ZapSign inválido, ou POST retornando status não-2xx)
ainda cai no bloco vermelho `zapErro` com mensagem específica — não deve virar silenciosamente o
estado amarelo. Se não houver forma segura de simular isso em produção sem arriscar dado real, revisar
o código das Tasks 1-2 lendo com atenção: `enviarParaZapSign` só retorna `{enviado:true}` quando o
POST de criação teve sucesso (2xx) — uma falha no POST continua lançando `throw new Error(...)`, que
o `catch` global de `doPost` transforma em `{erro: msg}`, e o frontend cai no `else{setZapErro(...)}`
porque `res.ok` será `false`. Documentar essa análise como verificação equivalente ao teste ao vivo se
o teste ao vivo não for realizado.

- [ ] **Step 7: Atualizar `docs/ai-memory/07-AI-KNOWN-ISSUES.md`**

Adicionar nova entrada (buscar a entrada de 2026-08-11 sobre ZapSign `sign_url` vazio e referenciar a
partir dela):
```bash
grep -n "2026-08-11" docs/ai-memory/07-AI-KNOWN-ISSUES.md | grep -i zapsign
```
Logo após o parágrafo daquela entrada, adicionar (ajustando ao estilo/formatação do restante do
arquivo, que segue com `---` entre entradas datadas):
```markdown
**ZapSign — retry do link + fim do falso erro (2026-09-09):** a recorrência prevista na entrada
acima aconteceu (contrato PCL-288, Nathalia Custodio Nunes Paixão) — `token` do signatário também veio
vazio na criação. Fix: `enviarParaZapSign` agora tenta `GET /docs/{token}/` (3s, depois 5s de espera)
antes de desistir; se ainda assim não vier, grava evento `ZAPSIGN_ENVIADO_SEM_LINK` em vez de falhar
silenciosamente. Nova action `buscarLinkZapSign(docToken)` (consulta, nunca cria documento) alimenta o
botão "Buscar o link novamente" no estado amarelo do frontend, que substitui o erro vermelho falso
quando o documento foi criado com sucesso mas o link ainda não materializou. Contrato de retorno de
`enviarParaZapSign` muda de string para objeto `{zapUrl, enviado, docToken}`. Detalhes em
`docs/superpowers/specs/2026-09-09-zapsign-link-retry-design.md`.
```

- [ ] **Step 8: Atualizar `CLAUDE.md` — seção ZapSign**

```bash
grep -n "### ZapSign (assinatura eletrônica)" CLAUDE.md
```
Depois da linha `Fluxo: exporta contrato Google Docs como PDF → envia para ZapSign → retorna link de
assinatura do credor`, adicionar:
```markdown
- **Retry de link + evento de falha (2026-09-09):** `sign_url`/`token` do signatário credor às vezes
  vêm vazios na resposta de criação (ZapSign materializa depois, assíncrono sob carga).
  `enviarParaZapSign` tenta `GET /docs/{token}/` (3s, 5s) antes de desistir; sem sucesso, grava evento
  `ZAPSIGN_ENVIADO_SEM_LINK` em EVENTOS. Retorna objeto `{zapUrl, enviado, docToken}` (não mais
  string). Action `buscarLinkZapSign(docToken)` — consulta pura, nunca cria documento — alimenta o
  botão "Buscar o link novamente" do estado amarelo no `NovoContrato` (`main.jsx`), que substitui o
  erro vermelho falso quando o documento já foi criado com sucesso. Ver
  `docs/ai-memory/07-AI-KNOWN-ISSUES.md` (2026-09-09).
```

- [ ] **Step 9: Commit da documentação**

```bash
git add docs/ai-memory/07-AI-KNOWN-ISSUES.md CLAUDE.md
git commit -m "$(cat <<'EOF'
docs: registra retry do link ZapSign no known-issues e CLAUDE.md

Documenta o fix implementado (Tasks 1-4 desta plan): retry via GET,
evento ZAPSIGN_ENVIADO_SEM_LINK, action buscarLinkZapSign, novo contrato
de retorno objeto de enviarParaZapSign.

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

- [ ] **Step 10: Atualizar a memória de sessão**

Ler `/Users/alexborges/.claude/projects/-Users-alexborges-financeiroop/memory/project_zapsign_sign_url_fallback.md`,
anexar o desfecho de 2026-09-09 (fix implementado, deployado, verificado — ou o que de fato aconteceu
nos Steps 4-6) seguindo o formato de frontmatter já usado no arquivo. Atualizar a linha correspondente
em `MEMORY.md` se a descrição de uma linha mudou de sentido.

---

## Self-Review (spec coverage)

| Seção da spec | Task que implementa |
|---|---|
| 3.1 `_extrairLinkCredor` | Task 1, Step 2 |
| 3.2 retry em `enviarParaZapSign` | Task 1, Step 3 |
| 3.3 `buscarLinkZapSign` | Task 2, Step 1 |
| 3.4 dispatch `doPost` | Task 2, Step 2 |
| 4.1 estado novo | Task 3, Steps 1-3 |
| 4.2 `_enviarZapSign` 3 casos | Task 3, Steps 4-5 |
| 4.3 `_buscarLinkZapSign` | Task 4, Step 1 |
| 4.4 UI do modal (condição do botão + bloco amarelo) | Task 4, Steps 2-3 |
| 5. Testes/verificação Tier 3 | Task 5, Steps 1-6 |
| 6. Documentação | Task 5, Steps 7-10 |

Nenhuma seção da spec ficou sem task correspondente.
