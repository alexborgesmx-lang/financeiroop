# Botão de Envio Manual (Fallback) na Régua WPP — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Adicionar, na aba Régua WPP, um botão por linha com falha de envio (`ERRO_ENVIO`/`ERRO_PIX`) que monta a mensagem pronta e abre o WhatsApp do usuário pra envio manual — fallback operacional enquanto a régua automática (Evolution GO) está fora do ar.

**Architecture:** Uma função pura no frontend (`_montarEnvioManualRegua`) decide, a partir do `STATUS_ENVIO`/`GATILHO`/`CONTEUDO` da linha e da lista de `parcelas` já carregada, qual texto e qual código PIX oferecer. Um componente novo (`AcaoEnvioManualRegua`) renderiza os botões de envio (link `api.whatsapp.com/send`, mesmo padrão já usado no arquivo) e, só depois de todos os envios aplicáveis terem sido clicados, libera um botão de confirmação que chama uma action nova no GAS (`marcarEnvioManualRegua`) pra gravar `STATUS_ENVIO = "REENVIADO_MANUAL"` na linha, com atualização otimista do estado local (`setRaw`).

**Tech Stack:** React 18 (JSX puro, sem TypeScript) + Vite no frontend; Google Apps Script no backend. Sem framework de testes automatizados no projeto — verificação de sintaxe via `npm run build`, verificação de lógica pura via script Node isolado, verificação funcional manual no navegador e via `curl` contra o Web App do GAS, conforme protocolo Tier 2 do `CLAUDE.md` do projeto (nova funcionalidade sem cálculo financeiro).

## Global Constraints

- Linhas com `STATUS_ENVIO = "ERRO_SEM_PIX"` NUNCA mostram o botão de ação (fora de escopo — spec `docs/superpowers/specs/2026-07-30-envio-manual-regua-wpp-design.md`).
- Nenhum clique em botão de envio marca a linha como resolvida sozinho — só abre o WhatsApp. Marcar como resolvida exige clicar em "✓ Marcar como enviada" e confirmar num `window.confirm`.
- Não alterar `enviarReguaCobranca` nem qualquer outra função do GAS além da nova `marcarEnvioManualRegua` e o dispatch em `doPost`.
- Sem comentários novos no código (convenção do projeto: código autodocumentado).
- Commits em português, prefixo `feat:`.
- Depois de editar `appscript.gs`: abrir TextEdit com o arquivo e instruir o usuário a colar no editor do Google Apps Script e publicar nova versão do Web App — nunca só o trecho alterado.
- Antes de `vercel deploy --prod`: rodar a skill `/review` (Tier 2, conforme `CLAUDE.md` — nova funcionalidade frontend + nova rota de API sem cálculo financeiro).

---

## Task 1: Backend — action `marcarEnvioManualRegua` no GAS

**Files:**
- Modify: `appscript.gs:6554` (nova função, logo após `_abaMsg()`)
- Modify: `appscript.gs:1020` (novo `else if` no `doPost`, logo após a linha de `dispararReguaCobranca`)

**Interfaces:**
- Produces: action `"marcarEnvioManualRegua"` — request `{action:"marcarEnvioManualRegua", idMensagem:string}` → response `{ok:true}` em sucesso, `{erro:"Mensagem nao encontrada: <id>"}` se o `ID_MENSAGEM` não existir em MENSAGENS. Consumida pela Task 3.

- [ ] **Step 1: Ler o ponto de inserção da função**

`appscript.gs:6545-6554` hoje é:
```js
function _abaMsg() {
  var ss  = SpreadsheetApp.getActiveSpreadsheet();
  var aba = ss.getSheetByName(ABAS.MENSAGENS);
  if (!aba) {
    aba = ss.insertSheet(ABAS.MENSAGENS);
    var h = ["ID_MENSAGEM","DATA_ENVIO","ID_CLIENTE","ID_CONTRATO","ID_PARCELA","TELEFONE","GATILHO","CONTEUDO","STATUS_ENVIO"];
    aba.getRange(1,1,1,h.length).setValues([h]).setFontWeight("bold").setBackground("#1a1a2e").setFontColor("#ffffff");
  }
  return aba;
}
```

- [ ] **Step 2: Adicionar `marcarEnvioManualRegua` logo depois de `_abaMsg()` (depois da linha 6554, antes de `function _logMensagem(dados) {`)**

```js
function marcarEnvioManualRegua(idMensagem) {
  var aba = _abaMsg();
  var cm  = buildColMap(aba);
  var vals = aba.getDataRange().getValues();
  var colId = cm["ID_MENSAGEM"];
  if (!colId) throw new Error("Coluna ID_MENSAGEM nao encontrada em MENSAGENS");
  for (var i = 1; i < vals.length; i++) {
    if (String(vals[i][colId-1]||"").trim() === String(idMensagem).trim()) {
      setCel(aba, i+1, cm, "STATUS_ENVIO", "REENVIADO_MANUAL");
      return { ok:true };
    }
  }
  throw new Error("Mensagem nao encontrada: " + idMensagem);
}
```

- [ ] **Step 3: Adicionar o dispatch no `doPost`, logo depois da linha do `dispararReguaCobranca` (`appscript.gs:1020`)**

Linha atual (`appscript.gs:1020`):
```js
    else if (body.action === "dispararReguaCobranca")        { var rReg=enviarReguaCobranca(false); res={ok:true,enviados:rReg?rReg.enviados:0,erros:rReg?rReg.erros:0}; }
```

Adicionar logo abaixo:
```js
    else if (body.action === "marcarEnvioManualRegua")        { marcarEnvioManualRegua(body.idMensagem); res={ok:true}; }
```

- [ ] **Step 4: Abrir o arquivo completo no TextEdit pra colar no editor do Apps Script**

```bash
open -a "TextEdit" /Users/alexborges/financeiroop/appscript.gs
```

Instruir o usuário: **Cmd+A → Cmd+C → colar no editor do Google Apps Script → publicar nova versão do Web App.** O GAS exige o arquivo completo, nunca só o trecho alterado. Aguardar confirmação do usuário de que a nova versão foi publicada antes do próximo step.

- [ ] **Step 5: Verificar que a action está registrada, sem tocar em dado real**

```bash
curl -sL -X POST "https://script.google.com/macros/s/AKfycbynQKpafDbaBTT-jqs4nCSzbbx8A72MAqDyGxwy86lIt0ykZxeFT8IdlO7zjj0rJEHy7Q/exec" -H "Content-Type: application/json" -d '{"action":"marcarEnvioManualRegua","idMensagem":"TEST_NAO_EXISTE_123"}'
```

Esperado: `{"erro":"Mensagem nao encontrada: TEST_NAO_EXISTE_123"}` — confirma que a action está registrada e a função roda até o fim sem erro de sintaxe, sem alterar nenhuma linha real de MENSAGENS (o ID de teste não existe, então cai no `throw` final em vez de gravar algo).

- [ ] **Step 6: Commit**

```bash
git add appscript.gs
git commit -m "feat: action marcarEnvioManualRegua pra marcar reenvio manual da régua

Fallback operacional enquanto o Evolution GO estiver fora do ar."
```

---

## Task 2: Frontend — helper puro `_montarEnvioManualRegua`

**Files:**
- Modify: `src/main.jsx:258` (nova função, logo após `postAction`)

**Interfaces:**
- Consumes: `_ST_TERMINAL` (`src/main.jsx:114`), `toNum` (`src/main.jsx:254`).
- Produces: `_montarEnvioManualRegua(m: MensagemRow, parcelas: ParcelaRow[]): {texto: string|null, pix: string|null}`. Consumida pela Task 3.

- [ ] **Step 1: Validar a lógica isolada num script Node antes de integrar**

Criar `/private/tmp/claude-501/-Users-alexborges-financeiroop/f504ec57-0bc0-4a2f-b36c-7a0d041e8b05/scratchpad/test-envio-manual.mjs`:

```js
const _ST_TERMINAL = new Set(["pago","quitacao_antecipada","baixado_como_prejuizo","cancelado","renegociado"]);
function toNum(d){ if(!d) return 0; const s=String(d).split("T")[0].split("-"); if(s.length<3) return 0; return parseInt(s[0])*10000+parseInt(s[1])*100+parseInt(s[2]); }

function _montarEnvioManualRegua(m, parcelas){
  const status = String(m.STATUS_ENVIO||"");
  if(status==="ERRO_PIX"){
    const pix = String(m.CONTEUDO||"").replace(/^ERRO_PIX_NAO_ENVIADO:\s*/,"").trim();
    return { texto:null, pix: pix||null };
  }
  if(status==="ERRO_ENVIO"){
    const texto = String(m.CONTEUDO||"");
    let pix=null;
    if(m.ID_PARCELA){
      const par=(parcelas||[]).find(p=>String(p.ID_PARCELA)===String(m.ID_PARCELA));
      if(par&&par.EFI_PIX_CODE) pix=String(par.EFI_PIX_CODE);
    } else if(String(m.GATILHO||"").toUpperCase().startsWith("PROMESSA") && m.ID_CONTRATO){
      const abertas=(parcelas||[]).filter(p=>String(p.ID_CONTRATO)===String(m.ID_CONTRATO)&&!_ST_TERMINAL.has(String(p.STATUS||"").toLowerCase()));
      abertas.sort((a,b)=>toNum(a.DATA_VENCIMENTO)-toNum(b.DATA_VENCIMENTO));
      if(abertas[0]&&abertas[0].EFI_PIX_CODE) pix=String(abertas[0].EFI_PIX_CODE);
    }
    return { texto, pix };
  }
  return { texto:null, pix:null };
}

const parcelas=[
  {ID_PARCELA:"1188",ID_CONTRATO:"C1",STATUS:"atrasado",DATA_VENCIMENTO:"2026-07-20",EFI_PIX_CODE:"PIX_1188"},
  {ID_PARCELA:"1405",ID_CONTRATO:"C2",STATUS:"pendente",DATA_VENCIMENTO:"2026-08-01",EFI_PIX_CODE:""},
  {ID_PARCELA:"2001",ID_CONTRATO:"C3",STATUS:"pago",DATA_VENCIMENTO:"2026-06-01",EFI_PIX_CODE:"PIX_PAGA"},
  {ID_PARCELA:"2002",ID_CONTRATO:"C3",STATUS:"pendente",DATA_VENCIMENTO:"2026-08-10",EFI_PIX_CODE:"PIX_2002"},
];

const casos=[
  ["ERRO_ENVIO com ID_PARCELA e PIX", {STATUS_ENVIO:"ERRO_ENVIO",CONTEUDO:"Ola Fulano...",ID_PARCELA:"1188",ID_CONTRATO:"C1",GATILHO:"D-5"}, {texto:"Ola Fulano...",pix:"PIX_1188"}],
  ["ERRO_ENVIO com ID_PARCELA sem PIX", {STATUS_ENVIO:"ERRO_ENVIO",CONTEUDO:"Ola Ciclano...",ID_PARCELA:"1405",ID_CONTRATO:"C2",GATILHO:"D-1"}, {texto:"Ola Ciclano...",pix:null}],
  ["ERRO_ENVIO promessa pega 1a parcela aberta", {STATUS_ENVIO:"ERRO_ENVIO",CONTEUDO:"Ola Beltrano...",ID_PARCELA:"",ID_CONTRATO:"C3",GATILHO:"PROMESSA_D-1"}, {texto:"Ola Beltrano...",pix:"PIX_2002"}],
  ["ERRO_PIX extrai o codigo do CONTEUDO", {STATUS_ENVIO:"ERRO_PIX",CONTEUDO:"ERRO_PIX_NAO_ENVIADO: PIX_XYZ",ID_PARCELA:"1188",ID_CONTRATO:"C1",GATILHO:"D0"}, {texto:null,pix:"PIX_XYZ"}],
  ["ERRO_SEM_PIX nao retorna nada", {STATUS_ENVIO:"ERRO_SEM_PIX",CONTEUDO:"SEM_PIX",ID_PARCELA:"1188",ID_CONTRATO:"C1",GATILHO:"D-5"}, {texto:null,pix:null}],
  ["ENVIADO nao retorna nada", {STATUS_ENVIO:"ENVIADO",CONTEUDO:"Ola...",ID_PARCELA:"1188",ID_CONTRATO:"C1",GATILHO:"D-5"}, {texto:null,pix:null}],
];

let falhas=0;
for(const [nome,m,esperado] of casos){
  const r=_montarEnvioManualRegua(m,parcelas);
  const ok = r.texto===esperado.texto && r.pix===esperado.pix;
  console.log((ok?"OK  ":"FAIL")+" — "+nome+" — got="+JSON.stringify(r));
  if(!ok) falhas++;
}
process.exit(falhas>0?1:0);
```

- [ ] **Step 2: Rodar o script e confirmar que todos os casos passam**

```bash
node /private/tmp/claude-501/-Users-alexborges-financeiroop/f504ec57-0bc0-4a2f-b36c-7a0d041e8b05/scratchpad/test-envio-manual.mjs
```

Esperado: 6 linhas `OK`, exit code 0.

- [ ] **Step 3: Integrar a função validada em `src/main.jsx`, logo após `postAction` (linha 258)**

Linha atual (`src/main.jsx:258`):
```js
async function postAction(body){_startProg();try{const r=await fetch(POST_URL,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(body)});const d=await r.json();_doneProg();return d;}catch(e){_doneProg();throw e;}}
```

Adicionar logo abaixo:
```js
function _montarEnvioManualRegua(m, parcelas){
  const status = String(m.STATUS_ENVIO||"");
  if(status==="ERRO_PIX"){
    const pix = String(m.CONTEUDO||"").replace(/^ERRO_PIX_NAO_ENVIADO:\s*/,"").trim();
    return { texto:null, pix: pix||null };
  }
  if(status==="ERRO_ENVIO"){
    const texto = String(m.CONTEUDO||"");
    let pix=null;
    if(m.ID_PARCELA){
      const par=(parcelas||[]).find(p=>String(p.ID_PARCELA)===String(m.ID_PARCELA));
      if(par&&par.EFI_PIX_CODE) pix=String(par.EFI_PIX_CODE);
    } else if(String(m.GATILHO||"").toUpperCase().startsWith("PROMESSA") && m.ID_CONTRATO){
      const abertas=(parcelas||[]).filter(p=>String(p.ID_CONTRATO)===String(m.ID_CONTRATO)&&!_ST_TERMINAL.has(String(p.STATUS||"").toLowerCase()));
      abertas.sort((a,b)=>toNum(a.DATA_VENCIMENTO)-toNum(b.DATA_VENCIMENTO));
      if(abertas[0]&&abertas[0].EFI_PIX_CODE) pix=String(abertas[0].EFI_PIX_CODE);
    }
    return { texto, pix };
  }
  return { texto:null, pix:null };
}
```

- [ ] **Step 4: Rodar o build pra confirmar que não quebrou sintaxe**

```bash
cd /Users/alexborges/financeiroop && npm run build
```

Esperado: build conclui sem erro (a função ainda não é usada em lugar nenhum, então não há warning de "unused" em JS puro — só precisa compilar).

- [ ] **Step 5: Commit**

```bash
git add src/main.jsx
git commit -m "feat: helper _montarEnvioManualRegua pra decidir texto/PIX do envio manual"
```

---

## Task 3: Frontend — componente `AcaoEnvioManualRegua` e integração na tabela

**Files:**
- Modify: `src/main.jsx:5751` (novo componente, logo antes do comentário `// ─── APP`)
- Modify: `src/main.jsx:8410-8441` (tabela da aba Régua WPP — nova coluna "Ações", badge `REENVIADO_MANUAL`)

**Interfaces:**
- Consumes: `_montarEnvioManualRegua` (Task 2), `postAction` (`src/main.jsx:258`), action `"marcarEnvioManualRegua"` (Task 1), constantes de cor `GRN`/`BLU`/`RED`/`CARD`/`MUTED` (topo do arquivo).
- Produces: componente `AcaoEnvioManualRegua({m, parcelas, telefone, nomeCliente, onMarcado}) → JSX`, usado só dentro da tabela da aba Régua WPP.

- [ ] **Step 1: Ler o ponto de inserção do componente**

`src/main.jsx:5748-5754` hoje é:
```js
        <button onClick={()=>setConfirmando(true)}
          style={{padding:"6px 16px",borderRadius:8,border:"none",background:ACCENT,color:BG,fontSize:12,fontWeight:700,cursor:"pointer"}}>Reverter</button>
      </div>
    </div>
  );
}

// ─── APP ─────────────────────────────────────────────────────────
function App() {
```

- [ ] **Step 2: Adicionar o componente `AcaoEnvioManualRegua` logo antes do comentário `// ─── APP`**

```jsx
function AcaoEnvioManualRegua({m, parcelas, telefone, nomeCliente, onMarcado}){
  const [enviouTexto,setEnviouTexto]=useState(false);
  const [enviouPix,setEnviouPix]=useState(false);
  const [marcando,setMarcando]=useState(false);
  const {texto,pix}=_montarEnvioManualRegua(m,parcelas);
  const tel=String(telefone||"").replace(/\D/g,"");
  if(!tel||(!texto&&!pix)) return <span style={{fontSize:11,color:MUTED}}>—</span>;
  const abrirWpp=txt=>window.open(`https://api.whatsapp.com/send?phone=55${tel}&text=${encodeURIComponent(txt)}`,"_blank");
  const prontoParaMarcar=(!texto||enviouTexto)&&(!pix||enviouPix);
  const marcar=async()=>{
    if(!window.confirm(`Confirma que a mensagem foi enviada para ${nomeCliente} pelo WhatsApp?`))return;
    setMarcando(true);
    try{
      const r=await postAction({action:"marcarEnvioManualRegua",idMensagem:m.ID_MENSAGEM});
      if(r?.ok) onMarcado(m.ID_MENSAGEM);
      else alert("Não consegui marcar como enviada. Tenta de novo.");
    }catch(e){ alert("Não consegui marcar como enviada. Tenta de novo."); }
    finally{ setMarcando(false); }
  };
  return (
    <div style={{display:"flex",flexDirection:"column",gap:6,alignItems:"flex-start"}}>
      <div style={{display:"flex",gap:6,flexWrap:"wrap"}}>
        {texto&&<button onClick={()=>{abrirWpp(texto);setEnviouTexto(true);}} style={{padding:"5px 10px",borderRadius:8,border:`1px solid ${GRN}40`,background:enviouTexto?GRN+"10":CARD,color:GRN,cursor:"pointer",fontSize:11,fontWeight:600,opacity:enviouTexto?0.6:1}}>{enviouTexto?"✓ Texto":"Enviar Texto"}</button>}
        {pix&&<button onClick={()=>{abrirWpp(pix);setEnviouPix(true);}} style={{padding:"5px 10px",borderRadius:8,border:`1px solid ${GRN}40`,background:enviouPix?GRN+"10":CARD,color:GRN,cursor:"pointer",fontSize:11,fontWeight:600,opacity:enviouPix?0.6:1}}>{enviouPix?"✓ PIX":"Enviar PIX"}</button>}
      </div>
      {prontoParaMarcar&&<button disabled={marcando} onClick={marcar} style={{padding:"5px 10px",borderRadius:8,border:`1px solid ${BLU}40`,background:BLU+"10",color:BLU,cursor:marcando?"not-allowed":"pointer",fontSize:11,fontWeight:700,opacity:marcando?0.6:1}}>{marcando?"Marcando...":"✓ Marcar como enviada"}</button>}
    </div>
  );
}

```

- [ ] **Step 3: Ler o trecho atual da tabela da aba Régua WPP**

`src/main.jsx:8410-8441` hoje:
```jsx
                    :<div style={{overflowX:"auto",WebkitOverflowScrolling:"touch"}}><table style={{width:"100%",borderCollapse:"collapse",textAlign:"left",minWidth:560}}>
                      <thead><tr style={{background:GRN+"10",fontSize:11,color:GRN,fontWeight:700,textTransform:"uppercase"}}>
                        <th style={{padding:"10px 18px"}}>Tipo</th>
                        <th>Cliente</th>
                        <th>Contrato</th>
                        <th>Status</th>
                        <th style={{padding:"10px 18px"}}>Envio</th>
                      </tr></thead>
                      <tbody>{msgsFilt.slice(0,200).map((m,i)=>{
                        const {cat,cor}=categG(m.GATILHO);
                        const err=isErr(m);
                        const stLbl=err?(m.STATUS_ENVIO==="ERRO_SEM_PIX"?"Sem PIX":"Erro envio"):"Enviada";
                        const stCor=err?RED:GRN;
                        const cli=cliMap.get(String(m.ID_CLIENTE||""));
                        const nomeCli=cli?cli.NOME:String(m.ID_CLIENTE||"—");
                        return(
                          <tr key={m.ID_MENSAGEM||i} style={{borderBottom:`1px solid ${BD}`,fontSize:13,background:i%2===0?CARD:BG}}>
                            <td style={{padding:"12px 18px"}}>
                              <div style={{fontWeight:700,color:cor}}>{cat}</div>
                              <div style={{fontSize:11,color:MUTED,marginTop:2}}>{String(m.GATILHO||"")}</div>
                            </td>
                            <td><div style={{fontWeight:600}}>{nomeCli}</div><div style={{fontSize:11,color:MUTED}}>ID {m.ID_CLIENTE}</div></td>
                            <td style={{color:MUTED,fontWeight:600,fontSize:12}}>{m.ID_CONTRATO||"—"}{m.ID_PARCELA?<div style={{fontSize:10,color:MUTED}}>Parcela {m.ID_PARCELA}</div>:null}</td>
                            <td><span style={{display:"inline-flex",alignItems:"center",gap:5,padding:"3px 10px",borderRadius:20,background:stCor+"15",color:stCor,fontSize:11,fontWeight:700,border:`1px solid ${stCor}30`}}>
                              {!err&&<svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><polyline points="20 6 9 17 4 12"/></svg>}
                              {stLbl}
                            </span></td>
                            <td style={{padding:"12px 18px",color:MUTED,fontSize:12,whiteSpace:"nowrap"}}>{fmtMsgDt(m.DATA_ENVIO)}</td>
                          </tr>
                        );
                      })}</tbody>
                    </table></div>
```

- [ ] **Step 4: Substituir pelo trecho com a coluna "Ações", o badge `REENVIADO_MANUAL` e a atualização otimista**

```jsx
                    :<div style={{overflowX:"auto",WebkitOverflowScrolling:"touch"}}><table style={{width:"100%",borderCollapse:"collapse",textAlign:"left",minWidth:700}}>
                      <thead><tr style={{background:GRN+"10",fontSize:11,color:GRN,fontWeight:700,textTransform:"uppercase"}}>
                        <th style={{padding:"10px 18px"}}>Tipo</th>
                        <th>Cliente</th>
                        <th>Contrato</th>
                        <th>Status</th>
                        <th style={{padding:"10px 18px"}}>Envio</th>
                        <th style={{padding:"10px 18px"}}>Ações</th>
                      </tr></thead>
                      <tbody>{msgsFilt.slice(0,200).map((m,i)=>{
                        const {cat,cor}=categG(m.GATILHO);
                        const err=isErr(m);
                        const manual=m.STATUS_ENVIO==="REENVIADO_MANUAL";
                        const stLbl=err?(m.STATUS_ENVIO==="ERRO_SEM_PIX"?"Sem PIX":"Erro envio"):(manual?"Enviada (manual)":"Enviada");
                        const stCor=err?RED:(manual?BLU:GRN);
                        const cli=cliMap.get(String(m.ID_CLIENTE||""));
                        const nomeCli=cli?cli.NOME:String(m.ID_CLIENTE||"—");
                        const podeEnvioManual=m.STATUS_ENVIO==="ERRO_ENVIO"||m.STATUS_ENVIO==="ERRO_PIX";
                        return(
                          <tr key={m.ID_MENSAGEM||i} style={{borderBottom:`1px solid ${BD}`,fontSize:13,background:i%2===0?CARD:BG}}>
                            <td style={{padding:"12px 18px"}}>
                              <div style={{fontWeight:700,color:cor}}>{cat}</div>
                              <div style={{fontSize:11,color:MUTED,marginTop:2}}>{String(m.GATILHO||"")}</div>
                            </td>
                            <td><div style={{fontWeight:600}}>{nomeCli}</div><div style={{fontSize:11,color:MUTED}}>ID {m.ID_CLIENTE}</div></td>
                            <td style={{color:MUTED,fontWeight:600,fontSize:12}}>{m.ID_CONTRATO||"—"}{m.ID_PARCELA?<div style={{fontSize:10,color:MUTED}}>Parcela {m.ID_PARCELA}</div>:null}</td>
                            <td><span style={{display:"inline-flex",alignItems:"center",gap:5,padding:"3px 10px",borderRadius:20,background:stCor+"15",color:stCor,fontSize:11,fontWeight:700,border:`1px solid ${stCor}30`}}>
                              {!err&&<svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><polyline points="20 6 9 17 4 12"/></svg>}
                              {stLbl}
                            </span></td>
                            <td style={{padding:"12px 18px",color:MUTED,fontSize:12,whiteSpace:"nowrap"}}>{fmtMsgDt(m.DATA_ENVIO)}</td>
                            <td style={{padding:"12px 18px"}}>
                              {podeEnvioManual
                                ? <AcaoEnvioManualRegua m={m} parcelas={parcelas} telefone={cli?.TELEFONE_WPP} nomeCliente={nomeCli} onMarcado={idMsg=>{setRaw(prev=>{if(!prev)return prev;return{...prev,MENSAGENS:(prev.MENSAGENS||[]).map(x=>String(x.ID_MENSAGEM)===String(idMsg)?{...x,STATUS_ENVIO:"REENVIADO_MANUAL"}:x)};});}}/>
                                : <span style={{fontSize:11,color:MUTED}}>—</span>}
                            </td>
                          </tr>
                        );
                      })}</tbody>
                    </table></div>
```

- [ ] **Step 5: Rodar o build**

```bash
cd /Users/alexborges/financeiroop && npm run build
```

Esperado: build conclui sem erro.

- [ ] **Step 6: Commit**

```bash
git add src/main.jsx
git commit -m "feat: botão de envio manual (fallback WhatsApp) na aba Régua WPP

Coluna Ações nas linhas ERRO_ENVIO/ERRO_PIX, badge Enviada (manual)
pra REENVIADO_MANUAL. Fallback operacional enquanto o Evolution GO
estiver fora do ar."
```

---

## Task 4: Review, deploy e teste manual end-to-end

**Files:** nenhum arquivo novo — só verificação e deploy do que já foi commitado nas Tasks 1-3.

- [ ] **Step 1: Rodar o review Tier 2**

Invocar a skill `review` (ou `/review`) sobre as mudanças de `src/main.jsx` e `appscript.gs` desta feature. Se retornar item crítico ou bloqueante, corrigir antes de prosseguir.

- [ ] **Step 2: Deploy do frontend**

```bash
cd /Users/alexborges/financeiroop && vercel deploy --prod
```

- [ ] **Step 3: Confirmar no navegador que o GAS já foi publicado (Task 1, Step 4)**

Se ainda não foi publicado, parar aqui e publicar antes de continuar — a Task 3 depende da action `marcarEnvioManualRegua` estar ativa no Web App.

- [ ] **Step 4: Teste manual — linha `ERRO_ENVIO` com PIX**

No app em produção, abrir a aba Régua WPP, filtrar por "Erros", achar uma linha `ERRO_ENVIO` com parcela (tem `Parcela XXXX` na coluna Contrato). Clicar em "Enviar Texto" — confirmar que abre o WhatsApp com o texto certo pro cliente certo (nome, valor, data batendo com o que aparece na linha). Voltar pro app, clicar em "Enviar PIX" (se o botão apareceu) — confirmar que abre o WhatsApp com o código PIX. Confirmar que o botão "✓ Marcar como enviada" só aparece depois dos dois cliques.

- [ ] **Step 5: Teste manual — marcar como enviada**

Clicar em "✓ Marcar como enviada", confirmar o diálogo. Checar que a linha muda pro badge "Enviada (manual)" (cor diferente de "Enviada" e de "Erro envio") e some do filtro "Erros" e do KPI "Erros" sem precisar recarregar a página.

- [ ] **Step 6: Teste manual — persistência**

Recarregar a página (F5) e confirmar que a linha continua "Enviada (manual)" (prova que gravou no Sheets, não só no estado local).

- [ ] **Step 7: Teste manual — linha `ERRO_SEM_PIX`**

Filtrar/achar uma linha `ERRO_SEM_PIX` (se existir na base) e confirmar que a coluna "Ações" mostra só "—", sem nenhum botão.

- [ ] **Step 8: Teste manual — linha `ERRO_PIX` (se existir na base)**

Achar uma linha `STATUS_ENVIO = ERRO_PIX` (filtro "Erros" na tabela, ou checar via `curl` no `doGet` se não tiver nenhuma visível). Confirmar que só o botão "Enviar PIX" aparece (sem "Enviar Texto") e que abre o WhatsApp com o código PIX certo, extraído do `CONTEUDO` daquela linha.

- [ ] **Step 9: Teste manual — falha do backend ao marcar como enviada**

Numa linha `ERRO_ENVIO`, clicar nos botões de envio aplicáveis pra liberar o "✓ Marcar como enviada". Desligar o Wi-Fi (ou usar o DevTools → Network → Offline) antes de clicar em "Marcar como enviada", confirmar o diálogo e checar que aparece o alerta "Não consegui marcar como enviada. Tenta de novo." e que a linha continua com o badge "Erro envio" (não muda pra "Enviada (manual)"). Religar a rede depois do teste.

- [ ] **Step 10: Confirmar sem erros de console**

Abrir o DevTools do navegador (F12) durante os testes acima e confirmar que não aparece nenhum erro JavaScript no console (fora do erro de rede provocado de propósito no Step 9).

- [ ] **Step 11: Atualizar CLAUDE.md**

Na tabela "Abas do frontend (UI)" do `CLAUDE.md`, na linha de "Régua WPP", adicionar ao final da célula de conteúdo:

```
 Linhas com falha de envio (`ERRO_ENVIO`/`ERRO_PIX`) mostram botão de envio manual via WhatsApp (`AcaoEnvioManualRegua`, `main.jsx`) — fallback pra quando a automação (Evolution GO) cair; marca `STATUS_ENVIO="REENVIADO_MANUAL"` via action `marcarEnvioManualRegua` no GAS.
```

- [ ] **Step 12: Commit da documentação (se houve mudança no Step 11)**

```bash
git add CLAUDE.md
git commit -m "docs: documenta botão de envio manual da Régua WPP no CLAUDE.md"
```
