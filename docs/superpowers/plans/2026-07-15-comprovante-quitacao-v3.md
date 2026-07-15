# Comprovante de Quitação v3 (HTML+print + QR real) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Migrate "contrato quitado" document generation (today: 2 separate jsPDF
implementations) to one shared HTML+print function matching
`Comprovante de Quitação.html` from the Rede Borges v3 handoff, with a real QR code
linking to the already-existing public Certificado de Quitação.

**Architecture:** One new small GAS action exposes the existing certificate's code to
the frontend (read-or-create, fully reusing existing idempotent logic). One new
frontend function (`abrirComprovanteQuitacao`) opens a tab immediately, awaits the GAS
call, then fills in the document — used by both existing call paths, which become thin
wrappers around it.

**Tech Stack:** Same as the Comprovante de Pagamento plan — plain template-literal
HTML/CSS, Google Fonts (`IBM Plex Mono` + `Newsreader` this time), `postAction` for the
new GAS round-trip. No new npm dependency.

## Global Constraints

- Reuse `_linhaConfiancaSVG` from `src/main.jsx` (already implemented, do not
  reimplement) and the `abrirComprovantePagamento`/`_comprovantePagamentoHTML` pattern
  as the template for this task's structure.
- The GAS action must not duplicate any logic already in `gerarCertificadoQuitacao` or
  `_buscarDadosCertificado` — call them, don't reimplement them.
- Do not touch `_gerarEEnviarCertificado`, `api/cert.js`, or the automatic WhatsApp
  certificate flow — read-only reuse of `gerarCertificadoQuitacao`'s dedup, nothing else.
- The 3 existing call sites of `gerarComprovante` (`main.jsx:4232`, `:8436`, `:8446`)
  and the 4 call sites of `gerarEEnviarComprovante` must keep their exact call
  signatures — no caller changes anywhere in this plan.
- No automated test framework exists in this project (see the Comprovante de Pagamento
  plan's Global Constraints for the same note) — verify with `npx vite build` per task;
  GAS has no local test runner at all, so Task 1 ends with the manual
  paste-into-editor-and-publish step already established in `CLAUDE.md`, and cannot be
  build-verified the way JS tasks are.
- After editing `appscript.gs`, open it in TextEdit for the user per the existing
  project convention (`CLAUDE.md`): `open -a "TextEdit" /Users/alexborges/financeiroop/appscript.gs`
  — do this automatically, do not wait to be asked.

---

### Task 1: GAS — `garantirCertificadoQuitacao` action

**Files:**
- Modify: `appscript.gs` — insert one new `else if` branch in the `doPost` action
  dispatcher, immediately before the existing `buscarCertificado` branch.

**Interfaces:**
- Consumes: `_buscarDadosCertificado(idContrato, idCliente)` and
  `gerarCertificadoQuitacao(params)` (both already exist, unchanged, at
  `appscript.gs:6803` and `:6829`).
- Produces: a new `postAction` action name `"garantirCertificadoQuitacao"`, called with
  `{action:"garantirCertificadoQuitacao", idContrato, idCliente, datQuitacao}`
  (`datQuitacao` optional, `"YYYY-MM-DD"` string or omitted), responding
  `{ok:true, codigo:"<CODIGO_VALIDACAO>", link:"<url pública>"}` on success or
  `{erro:"..."}` on failure (same error shape as every other action in this dispatcher).
  Tasks 2-4 (frontend) are the callers and must use exactly this action name and these
  response field names (`codigo`, `link`).

- [ ] **Step 1: Locate the exact insertion point**

Read `appscript.gs` around line 1019 and confirm it matches:

```javascript
    else if (body.action === "dispararReguaCobranca")        { var rReg=enviarReguaCobranca(false); res={ok:true,enviados:rReg?rReg.enviados:0,erros:rReg?rReg.erros:0}; }
    else if (body.action === "buscarCertificado")            { res=Object.assign({ok:true},buscarCertificadoPublico(body.codigo||"")); }
    else { res={erro:"Acao nao reconhecida: "+body.action}; }
```

- [ ] **Step 2: Insert the new action**

Using the Edit tool, replace:

```javascript
    else if (body.action === "buscarCertificado")            { res=Object.assign({ok:true},buscarCertificadoPublico(body.codigo||"")); }
    else { res={erro:"Acao nao reconhecida: "+body.action}; }
```

with:

```javascript
    else if (body.action === "garantirCertificadoQuitacao")  { var dCert=_buscarDadosCertificado(body.idContrato,body.idCliente); var rCert=gerarCertificadoQuitacao({idContrato:body.idContrato,idCliente:body.idCliente,nomeCliente:dCert.nome,cpf:dCert.cpf,datQuitacao:body.datQuitacao||new Date(),totalPago:dCert.totalPago}); res={ok:true,codigo:rCert.codigoValidacao,link:rCert.linkCertificado}; }
    else if (body.action === "buscarCertificado")            { res=Object.assign({ok:true},buscarCertificadoPublico(body.codigo||"")); }
    else { res={erro:"Acao nao reconhecida: "+body.action}; }
```

- [ ] **Step 3: Open the file for the user and hand off the publish step**

```bash
open -a "TextEdit" /Users/alexborges/financeiroop/appscript.gs
```

Tell the user: select all (Cmd+A), copy (Cmd+C), paste into the Google Apps Script
editor (replacing the entire existing content — never partial), then publish a new
version of the Web App. This step cannot be automated or verified by a build command;
the frontend tasks below can be implemented and committed without waiting for this
step, but the feature will only work end-to-end once it's published.

- [ ] **Step 4: Commit**

```bash
git add appscript.gs
git commit -m "feat: acao garantirCertificadoQuitacao no GAS (expoe codigo do certificado ja existente pro frontend)"
```

---

### Task 2: `fmtMesAno` helper + `_comprovanteQuitacaoHTML` template

**Files:**
- Modify: `src/main.jsx` — add `fmtMesAno` right after the existing `fmtR` definition
  (line 26). Add `_comprovanteQuitacaoHTML` right before `function gerarEEnviarComprovante`
  (same insertion pattern as `_comprovantePagamentoHTML` in the previous plan — insert
  immediately before the `// ─── HELPER: GERAR E ENVIAR COMPROVANTE...` comment, after
  the existing `abrirComprovantePagamento` function).

**Interfaces:**
- Consumes: `_linhaConfiancaSVG` (already exists, do not modify).
- Produces: `fmtMesAno(d) → string` (e.g. `"jun/2025"`, or `"—"` for a falsy/invalid
  date). `_comprovanteQuitacaoHTML(d) → string` (full HTML document), where `d` has
  these exact keys (all pre-formatted display strings unless noted):
  `{ nome, cpf, contrato, valorPrincipal, totalPago, parcelasLabel, periodoInicio,
    periodoFim, dataQuitacao, autenticacao, qrUrl, certLink }` — `qrUrl` and `certLink`
  may be `null` (render without the QR block in that case). Task 3 is the caller and
  must supply exactly these keys.

- [ ] **Step 1: Add `fmtMesAno`**

Using the Edit tool, replace:

```javascript
const fmtR  = v => "R$ " + Number(v||0).toLocaleString("pt-BR",{minimumFractionDigits:2,maximumFractionDigits:2});
```

with:

```javascript
const fmtR  = v => "R$ " + Number(v||0).toLocaleString("pt-BR",{minimumFractionDigits:2,maximumFractionDigits:2});
const _MESES_ABREV=['jan','fev','mar','abr','mai','jun','jul','ago','set','out','nov','dez'];
const fmtMesAno = d => { const dt = d instanceof Date ? d : parseDate(d); return dt && !isNaN(dt) ? `${_MESES_ABREV[dt.getMonth()]}/${dt.getFullYear()}` : '—'; };
```

- [ ] **Step 2: Verify the build**

Run: `npx vite build --mode development`
Expected: `✓ built in` with no errors.

- [ ] **Step 3: Locate the template insertion point**

Confirm this exact text exists in `src/main.jsx` (it is the end of
`abrirComprovantePagamento`, immediately followed by the start of
`gerarEEnviarComprovante`):

```javascript
function abrirComprovantePagamento(dados){
  const win=window.open("","_blank");
  if(!win){
    alert("Pop-up bloqueado — permita pop-ups para este site e clique em Salvar novamente.");
    return null;
  }
  win.document.write(_comprovantePagamentoHTML(dados));
  win.document.close();
  return win;
}

// ─── HELPER: GERAR E ENVIAR COMPROVANTE PDF VIA WHATSAPP ─────────
function gerarEEnviarComprovante(parcela,valorPago,dataPago,tipoLabel,parcelas,contratos,clientes,opts={}){
```

- [ ] **Step 4: Insert `_comprovanteQuitacaoHTML`**

Using the Edit tool, replace:

```javascript
  win.document.write(_comprovantePagamentoHTML(dados));
  win.document.close();
  return win;
}

// ─── HELPER: GERAR E ENVIAR COMPROVANTE PDF VIA WHATSAPP ─────────
```

with:

```javascript
  win.document.write(_comprovantePagamentoHTML(dados));
  win.document.close();
  return win;
}

// ─── COMPROVANTE DE QUITAÇÃO v3 — HTML+print (Rede Borges) ────────────────
function _comprovanteQuitacaoHTML(d){
  const authBlock = d.qrUrl
    ? `<img src="${d.qrUrl}" width="78" height="78" alt="QR de verificação" style="border-radius:8px;border:1px solid var(--line);"/><div class="mono">Autenticação<br><b>${d.autenticacao}</b><br>Verifique em ${d.certLink||''}</div>`
    : `<div class="mono">Autenticação<br><b>${d.autenticacao}</b></div>`;
  return `<!doctype html>
<html lang="pt-BR">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Comprovante de Quitação - ${d.contrato}</title>
<style>
@import url('https://fonts.googleapis.com/css2?family=Newsreader:ital,opsz,wght@0,6..72,500;1,6..72,500&family=IBM+Plex+Mono:wght@400;500;600&display=swap');
:root{
  --bg:#F7F5EF; --surface:#FFFDF9; --surface-2:#F0EDE4; --line:#E2DDD1; --line-soft:#EEEAE0;
  --ink:#1A1712; --ink-soft:#57514A; --ink-faint:#7C756B;
  --brand:#0B3D2E; --on-brand:#EAF6EF; --on-brand-soft:#8FE3C0;
  --signal:#127A57;
  --r-lg:16px; --shadow-lg:0 20px 52px rgba(11,61,46,.14),0 6px 16px rgba(11,61,46,.08);
  --sans:"Helvetica Neue",Helvetica,Arial,"Segoe UI",sans-serif;
  --serif:"Newsreader",Georgia,"Times New Roman",serif;
  --mono:"IBM Plex Mono",ui-monospace,"SFMono-Regular",Menlo,monospace;
}
*{box-sizing:border-box}
body{margin:0;background:var(--bg);color:var(--ink);font-family:var(--sans);display:flex;flex-direction:column;align-items:center;padding:34px 16px;gap:18px;-webkit-font-smoothing:antialiased;}
.num{font-variant-numeric:tabular-nums;font-weight:700;letter-spacing:-0.02em;}
.mono{font-family:var(--mono);letter-spacing:-0.01em;font-size:10px;color:var(--ink-faint);line-height:1.6;}
.mono b{color:var(--ink);font-weight:600;}
.serif{font-family:var(--serif);font-style:italic;}
.toolbar{display:flex;gap:10px;}
.btn{border:none;border-radius:999px;padding:10px 18px;font-size:13px;font-weight:700;cursor:pointer;font-family:var(--sans);}
.btn-p{background:#A8E03F;color:#07241B;}
.sheet{width:794px;max-width:100%;min-height:1080px;background:var(--surface);box-shadow:var(--shadow-lg);border:1px solid var(--line);padding:0 0 56px;position:relative;display:flex;flex-direction:column;overflow:hidden;}
.band{background:var(--brand);color:var(--on-brand);padding:34px 60px 30px;position:relative;overflow:hidden;}
.band .thread{position:absolute;top:10px;left:0;width:100%;height:52px;opacity:.26;}
.band .top{display:flex;justify-content:space-between;align-items:flex-start;position:relative;}
.band .id{display:flex;align-items:center;gap:14px;}
.band .id .nm{font-size:20px;font-weight:700;letter-spacing:-.02em;}
.band .id .ds{font-family:var(--mono);font-size:11px;color:var(--on-brand-soft);}
.band .co{text-align:right;font-size:10.5px;color:var(--on-brand-soft);line-height:1.7;}
.inner{padding:0 60px;flex:1;display:flex;flex-direction:column;}
.stamp{position:absolute;top:196px;right:60px;width:150px;height:150px;border:3px solid var(--signal);color:var(--signal);border-radius:50%;display:grid;place-items:center;text-align:center;transform:rotate(-11deg);opacity:.94;}
.stamp b{font-size:17px;letter-spacing:.04em;line-height:1.1;}
.kick{font-family:var(--mono);font-size:12px;letter-spacing:.12em;color:var(--signal);text-transform:uppercase;margin-top:50px;}
h1{font-size:38px;margin-top:12px;letter-spacing:-.02em;max-width:74%;color:var(--ink);}
.decl{font-size:15px;line-height:1.75;color:var(--ink-soft);margin-top:26px;max-width:64ch;}
.decl strong{color:var(--ink);}
.decl .ok{color:var(--signal);font-weight:700;}
.facts{margin-top:30px;background:var(--surface-2);border:1px solid var(--line);border-radius:var(--r-lg);padding:8px 24px;}
.row{display:flex;justify-content:space-between;padding:12px 0;border-bottom:1px solid var(--line-soft);font-size:15px;}
.row:last-child{border-bottom:none;}
.row .k{color:var(--ink-faint);}
.row .v{font-weight:600;text-align:right;color:var(--ink);}
.invite{margin-top:26px;border:1px dashed var(--line);border-radius:var(--r-lg);padding:20px 24px;text-align:center;background:var(--bg);}
.invite .q{font-family:var(--serif);font-style:italic;font-size:19px;color:var(--brand);}
.invite p{font-size:13.5px;color:var(--ink-soft);margin-top:7px;}
.sign{margin-top:auto;padding-top:44px;display:flex;justify-content:space-between;align-items:flex-end;gap:30px;}
.sign .auth{display:flex;gap:18px;align-items:center;}
.sign .who{text-align:center;}
.sign .who .line{width:230px;border-top:1.5px solid var(--ink);padding-top:8px;}
.sign .who .nm{font-size:13px;font-weight:600;}
.sign .who .mono{font-size:10px;color:var(--ink-faint);}
@media print{
  body{padding:0;background:#fff;} .toolbar{display:none!important;} .sheet{box-shadow:none;width:100%;min-height:auto;border:none;}
  *{-webkit-print-color-adjust:exact!important;print-color-adjust:exact!important;}
  @page{size:A4;margin:0;}
}
</style>
</head>
<body>
  <div class="toolbar">
    <button class="btn btn-p" onclick="window.print()">Salvar / imprimir PDF</button>
  </div>
  <div class="sheet">
    <div class="band">
      ${_linhaConfiancaSVG(794,52,12,1.75,0.22,"var(--on-brand-soft)")}
      <div class="top">
        <div class="id">
          <svg width="46" height="46" viewBox="0 0 68 68"><rect x="3" y="3" width="40" height="40" rx="9" fill="#1FB877"/><rect x="25" y="25" width="40" height="40" rx="9" fill="#fff"/><path d="M25 25 H43 V43 H25 Z" fill="#0E5C44"/></svg>
          <div><div class="nm">Borges Assessoria</div><div class="ds">Rede privada de confiança</div></div>
        </div>
        <div class="co">Borges Assessoria Financeira<br>CNPJ 63.124.205/0001-07<br>borgesassessoriafinanceira@gmail.com<br>(62) 98487-7843</div>
      </div>
    </div>
    <div class="stamp"><div><b>QUITAÇÃO<br>TOTAL</b><div class="mono" style="font-size:9px;margin-top:4px;">NADA CONSTA</div></div></div>
    <div class="inner">
      <div class="kick">Comprovante de quitação de contrato</div>
      <h1 class="serif">Contrato integralmente quitado</h1>
      <p class="decl">
        A <strong>Borges Assessoria</strong> declara, para os devidos fins, que o contrato de crédito abaixo identificado foi <span class="ok">integralmente quitado</span> pelo(a) cliente, nada mais havendo a ser cobrado a título de principal, juros ou encargos relativos a esta operação. Palavra dada, palavra cumprida.
      </p>
      <div class="facts">
        <div class="row"><span class="k">Cliente</span><span class="v">${d.nome} — CPF <span class="num">${d.cpf}</span></span></div>
        <div class="row"><span class="k">Contrato</span><span class="v mono">${d.contrato}</span></div>
        <div class="row"><span class="k">Valor principal</span><span class="v num">${d.valorPrincipal}</span></div>
        <div class="row"><span class="k">Total pago (principal + juros)</span><span class="v num">${d.totalPago}</span></div>
        <div class="row"><span class="k">Parcelas</span><span class="v num">${d.parcelasLabel}</span></div>
        <div class="row"><span class="k">Período</span><span class="v num">${d.periodoInicio} — ${d.periodoFim}</span></div>
        <div class="row"><span class="k">Data da quitação</span><span class="v num">${d.dataQuitacao}</span></div>
      </div>
      <div class="invite">
        <div class="q">"Você faz parte da Rede Borges."</div>
        <p>Conhece alguém de confiança que merece o mesmo? Sua indicação é o que mantém a rede forte.</p>
      </div>
      <div class="sign">
        <div class="auth">${authBlock}</div>
        <div class="who">
          <div class="line"></div>
          <div class="nm">Borges Assessoria</div>
          <div class="mono">Assinado digitalmente</div>
        </div>
      </div>
    </div>
  </div>
</body>
</html>`;
}

// ─── HELPER: GERAR E ENVIAR COMPROVANTE PDF VIA WHATSAPP ─────────
```

- [ ] **Step 5: Verify the build**

Run: `npx vite build --mode development`
Expected: `✓ built in` with no errors.

- [ ] **Step 6: Commit**

```bash
git add src/main.jsx
git commit -m "feat: adiciona fmtMesAno e template HTML v3 do Comprovante de Quitação (ainda não usado)"
```

---

### Task 3: `abrirComprovanteQuitacao` — async open + GAS round-trip

**Files:**
- Modify: `src/main.jsx` — insert immediately after `_comprovanteQuitacaoHTML`'s
  closing `` `; }``, before the `// ─── HELPER: GERAR E ENVIAR COMPROVANTE...` comment.

**Interfaces:**
- Consumes: `_comprovanteQuitacaoHTML(d)` from Task 2; `postAction` (already exists,
  used throughout the file — sends `{action, ...}` as JSON to `/api/action`, returns
  the parsed JSON response).
- Produces: `async function abrirComprovanteQuitacao(dados)`, where `dados` has these
  exact keys: `{ nome, cpf, contrato, idCliente, valorPrincipal, totalPago,
  parcelasLabel, periodoInicio, periodoFim, dataQuitacao, dataQuitacaoISO,
  autenticacaoFallback }`. Tasks 4 and 5 are the two callers and must supply exactly
  these keys.

- [ ] **Step 1: Insert the function**

Using the Edit tool, replace:

```javascript
</html>`;
}

// ─── HELPER: GERAR E ENVIAR COMPROVANTE PDF VIA WHATSAPP ─────────
```

(this text now appears once, at the end of `_comprovanteQuitacaoHTML` — the
`_comprovantePagamentoHTML` from the previous plan also ends in `</html>`;\n}` but is
not immediately followed by this comment, so this match is unique) with:

```javascript
</html>`;
}

async function abrirComprovanteQuitacao(dados){
  const win=window.open("","_blank");
  if(!win){
    alert("Pop-up bloqueado — permita pop-ups para este site e clique novamente.");
    return null;
  }
  win.document.write('<!doctype html><html><head><meta charset="UTF-8"><title>Comprovante de Quitação</title></head><body style="font-family:sans-serif;padding:40px;text-align:center;color:#57514A">Gerando comprovante...</body></html>');
  win.document.close();
  let qrUrl=null, certLink=null, autenticacao=dados.autenticacaoFallback;
  try{
    const certRes=await postAction({action:"garantirCertificadoQuitacao",idContrato:dados.contrato,idCliente:dados.idCliente,datQuitacao:dados.dataQuitacaoISO});
    if(certRes?.ok){
      certLink=certRes.link;
      autenticacao=certRes.codigo;
      qrUrl=`https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=${encodeURIComponent(certRes.link)}`;
    }
  }catch(e){ /* documento abre sem QR — ver spec, comportamento esperado */ }
  win.document.open();
  win.document.write(_comprovanteQuitacaoHTML({
    nome:dados.nome, cpf:dados.cpf, contrato:dados.contrato,
    valorPrincipal:dados.valorPrincipal, totalPago:dados.totalPago,
    parcelasLabel:dados.parcelasLabel, periodoInicio:dados.periodoInicio, periodoFim:dados.periodoFim,
    dataQuitacao:dados.dataQuitacao, autenticacao, qrUrl, certLink,
  }));
  win.document.close();
  return win;
}

// ─── HELPER: GERAR E ENVIAR COMPROVANTE PDF VIA WHATSAPP ─────────
```

- [ ] **Step 2: Verify the build**

Run: `npx vite build --mode development`
Expected: `✓ built in` with no errors.

- [ ] **Step 3: Commit**

```bash
git add src/main.jsx
git commit -m "feat: adiciona abrirComprovanteQuitacao (ainda não usado)"
```

---

### Task 4: Wire `gerarEEnviarComprovante`'s `isQuitado` branch, delete the now-dead jsPDF tail

**Files:**
- Modify: `src/main.jsx`, inside `function gerarEEnviarComprovante(...)`.

**Interfaces:**
- Consumes: `abrirComprovanteQuitacao(dados)` from Task 3, `fmtMesAno` from Task 2 (not
  actually needed here — `periodoInicio`/`periodoFim` use `fD`, already in scope; see
  note in Task 5 about where `fmtMesAno` is actually used).
- Produces: no new exports — internal behavior change only. The 4 existing call sites
  of `gerarEEnviarComprovante` (`main.jsx:1025,1029,3377,4581,8396` — see the
  Comprovante de Pagamento plan for the exact list) are unaffected.

- [ ] **Step 1: Locate and replace the entire remaining function body**

Find this exact block — it starts right after the `!isQuitado` early return (added by
the previous plan) and runs to the end of the function:

```javascript
    const doc=new jsPDF({unit:'mm',format:'a4'});
    const W=210,pd=20;
    const {G,GL,DK,MT,BDC,LMK}=_PDF_CLR;
    const G3=[135,223,182],G7=[14,92,68],GI=[230,248,239],SEP=[236,239,238],LGR=[247,249,248];

    // ─── HEADER (dark verde-900) ────────────────────────────────────
    doc.setFillColor(...LMK);doc.rect(0,0,W,26,'F');
    doc.setFillColor(31,184,119);doc.roundedRect(pd,8,11,11,2.5,2.5,'F');
    doc.setFillColor(255,255,255);doc.roundedRect(pd+7,12,11,11,2.5,2.5,'F');
    doc.setFillColor(14,92,68);doc.roundedRect(pd+7,12,4,4,1,1,'F');
    doc.setFont('helvetica','bold');doc.setFontSize(15);doc.setTextColor(255,255,255);
    doc.text('BORGES ASSESSORIA',pd+22,14);
    doc.setFont('helvetica','normal');doc.setFontSize(7.5);doc.setTextColor(...G3);
    doc.text(isQuitado?'Comprovante de Quitação':'Comprovante de Pagamento',pd+22,20);
    ['CNPJ 63.124.205/0001-07','borgesassessoriafinanceira@gmail.com'].forEach((l,i)=>{
      doc.setFont('helvetica','normal');doc.setFontSize(6.5);doc.setTextColor(...G3);
      doc.text(l,W-pd,14+i*6,{align:'right'});
    });

    let y=42;

    // ─── CHECK CIRCLE + VALOR ──────────────────────────────────────
    doc.setFillColor(...GI);doc.circle(W/2,y,9,'F');
    doc.setDrawColor(21,160,106);doc.setLineWidth(1.6);
    doc.line(W/2-3.5,y,W/2-0.5,y+3.5);doc.line(W/2-0.5,y+3.5,W/2+5,y-3);
    y+=15;
    doc.setFont('helvetica','normal');doc.setFontSize(9);doc.setTextColor(...MT);
    doc.text(isQuitado?'Contrato quitado integralmente':'Pagamento confirmado',W/2,y,{align:'center'});
    y+=7;
    doc.setFont('helvetica','bold');doc.setFontSize(22);doc.setTextColor(...DK);
    doc.text(isQuitado?fR(totalJaPago):fR(parseFloat(valorPago||0)),W/2,y,{align:'center'});
    y+=8;
    doc.setFont('helvetica','bold');doc.setFontSize(10);doc.setTextColor(...G7);
    doc.text(isQuitado?`${pagas.length+(jaEstavaPaga?0:1)} parcelas quitadas`:`Parcela ${pNum} de ${totalParcEfetivo}`,W/2,y,{align:'center'});
    y+=14;

    // ─── DATA ROWS ─────────────────────────────────────────────────
    const dataRows=isQuitado?[
      ['Cliente',nome],
      ['CPF',String(cliente?.CPF||'—')],
      ['Contrato',String(parcela.ID_CONTRATO)],
      ['Parcelas pagas',`${pagas.length+(jaEstavaPaga?0:1)} de ${totalParcEfetivo}`],
      ['Valor total pago',fR(totalJaPago)],
      ['Última parcela',fD(dataPago)],
      ['Saldo remanescente','R$ 0,00'],
    ]:[
      ['Cliente',nome],
      ['CPF',String(cliente?.CPF||'—')],
      ['Contrato',String(parcela.ID_CONTRATO)],
      ['Forma de pagamento',String(tipoLabel||'—')],
      ['Pago em',fD(dataPago)],
      ['Vencimento original',fD(parcela.DATA_VENCIMENTO)],
      ['Saldo devedor após',fR(saldo)],
      ['ID da transação',String(parcela.ID_PARCELA||'—')],
    ];
    dataRows.forEach(([k,v],i)=>{
      const ry=y+i*10;
      doc.setFont('helvetica','normal');doc.setFontSize(8.5);doc.setTextColor(...MT);doc.text(k,pd,ry);
      doc.setFont('helvetica','normal');doc.setFontSize(8.5);doc.setTextColor(...DK);doc.text(String(v),W-pd,ry,{align:'right'});
      if(i<dataRows.length-1){doc.setDrawColor(...SEP);doc.setLineWidth(0.2);doc.line(pd,ry+3,W-pd,ry+3);}
    });
    y+=dataRows.length*10+8;

    // ─── AVISO SOMENTE JUROS ───────────────────────────────────────
    if(isSomenteJuros){
      doc.setFillColor(254,243,199);doc.roundedRect(pd,y,W-2*pd,14,2,2,'F');
      doc.setFont('helvetica','bold');doc.setFontSize(7.5);doc.setTextColor(146,64,14);doc.text('CONTRATO ATUALIZADO',pd+4,y+5.5);
      doc.setFont('helvetica','normal');doc.setFontSize(7);doc.setTextColor(120,53,15);
      const aviso=`Original: ${originalParc} parcelas. Adicionadas ${totalAdded} por somente juros (principal rolado). Total atual: ${totalParcEfetivo} parcelas.`;
      const avisoL=doc.splitTextToSize(aviso,W-2*pd-8);doc.text(avisoL,pd+4,y+10);
      y+=avisoL.length*4+18;
    }

    // ─── HISTÓRICO DE PARCELAS ─────────────────────────────────────
    const histRows=isQuitado
      ?(()=>{const h=[...pagas];if(!jaEstavaPaga)h.push({...parcela,VALOR_PAGO:valorPago,DATA_PAGAMENTO:dataPago,TIPO_PAGAMENTO:tipoLabelToKey[tipoLabel]||'pagamento_normal'});return h.sort((a,b)=>parseInt(a.NUM_PARCELA||0)-parseInt(b.NUM_PARCELA||0));})()
      :[{NUM_PARCELA:parcela.NUM_PARCELA,DATA_VENCIMENTO:parcela.DATA_VENCIMENTO,VALOR_PARCELA:parcela.VALOR_PARCELA,DATA_PAGAMENTO:dataPago,VALOR_PAGO:valorPago,TIPO_PAGAMENTO:tipoLabelToKey[tipoLabel]||'pagamento_normal'}];
    y=_renderHistParcelas(doc,histRows,W,pd,y,GL,DK,BDC,fD,fR,isQuitado?'HISTÓRICO DE PARCELAS':'DETALHE DA PARCELA PAGA');

    // ─── FOOTER ────────────────────────────────────────────────────
    y+=6;
    doc.setFillColor(...LGR);doc.rect(0,y,W,30,'F');
    doc.setDrawColor(...BDC);doc.setLineWidth(0.3);doc.line(pd,y,W-pd,y);
    y+=7;
    const qt=isQuitado?'"Declaramos que todos os pagamentos foram recebidos, confirmando a quitação integral da dívida."':'"Declaramos que o pagamento acima foi recebido e registrado em nosso controle interno."';
    doc.setFont('helvetica','italic');doc.setFontSize(8);doc.setTextColor(...MT);
    const qtL=doc.splitTextToSize(qt,W-2*pd);doc.text(qtL,W/2,y,{align:'center'});y+=qtL.length*5+3;
    doc.setFont('helvetica','normal');doc.setFontSize(7);doc.setTextColor(...MT);
    doc.text('Borges Assessoria · CNPJ 63.124.205/0001-07 · borgesassessoriafinanceira@gmail.com',W/2,y,{align:'center'});y+=4;
    const authTs=`${ts.slice(0,4)}·${ts.slice(4,8)}·BORGES·${String(parcela.ID_PARCELA||'').slice(-4).toUpperCase()||ts.slice(8,12)}`;
    doc.setFont('helvetica','bold');doc.setFontSize(7);doc.setTextColor(...DK);
    doc.text(`Autenticação: ${authTs}`,W/2,y,{align:'center'});y+=4;
    doc.setFont('helvetica','normal');doc.setFontSize(6.5);doc.setTextColor(...MT);
    doc.text('Documento gerado eletronicamente. Não constitui documento fiscal.',W/2,y,{align:'center'});
    const blob=doc.output('blob');const url=URL.createObjectURL(blob);
    const a=document.createElement('a');a.href=url;a.download=nomeArq;document.body.appendChild(a);a.click();document.body.removeChild(a);setTimeout(()=>URL.revokeObjectURL(url),3000);
    if(opts.wpp){const tel=telefone?`55${telefone}`:'';const isMobile=/iPhone|iPad|iPod|Android/i.test(navigator.userAgent);const wppUrl=tel?`https://wa.me/${tel}`:(isMobile?'https://wa.me':'https://web.whatsapp.com');setTimeout(()=>window.open(wppUrl,'_blank'),700);}
  }catch(e){console.error('Comprovante error:',e);alert('Erro ao gerar comprovante: '+e.message);}
}
```

If this exact text is not found verbatim (e.g. because the previous plan's Task 3
landed slightly differently), stop and report — do not guess at the boundaries, this
deletes the entire remaining body of the function.

Replace it with:

```javascript
    const totalPagasCount=pagas.length+(jaEstavaPaga?0:1);
    abrirComprovanteQuitacao({
      nome, cpf:String(cliente?.CPF||'—'), contrato:String(parcela.ID_CONTRATO),
      idCliente:String(parcela.ID_CLIENTE||cliente?.ID_CLIENTE||''),
      valorPrincipal:fR(valorOriginal), totalPago:fR(totalJaPago),
      parcelasLabel:`${totalPagasCount} de ${totalParcEfetivo} pagas`,
      periodoInicio:fmtMesAno(hist[0]?.DATA_VENCIMENTO), periodoFim:fmtMesAno(dataPago),
      dataQuitacao:fD(dataPago), dataQuitacaoISO:apiDateStr(dataPago),
      autenticacaoFallback:`QT·${String(parcela.ID_CONTRATO).slice(-4)}·${now.getFullYear()}·BORGES`,
    });
    if(opts.wpp){const tel=telefone?`55${telefone}`:'';const isMobile=/iPhone|iPad|iPod|Android/i.test(navigator.userAgent);const wppUrl=tel?`https://wa.me/${tel}`:(isMobile?'https://wa.me':'https://web.whatsapp.com');setTimeout(()=>window.open(wppUrl,'_blank'),700);}
  }catch(e){console.error('Comprovante error:',e);alert('Erro ao gerar comprovante: '+e.message);}
}
```

`fR`, `fD`, `fmtMesAno`, `now`, `pagas`, `jaEstavaPaga`, `totalParcEfetivo`, `hist`,
`dataPago`, `valorOriginal`, `totalJaPago`, `telefone`, `opts`, `parcela`, `cliente` are
all already in scope (defined earlier in the same function, unchanged by this task —
see the Comprovante de Pagamento plan's Task 3 for confirmation these were already
verified in scope at this point in the function). `nomeArq`, `tipoLabelToKey`, `ts`,
`isSomenteJuros`, `originalParc`, `totalAdded`, `saldo` become unused by this branch
after the deletion — they are still computed earlier in the function (shared with the
`!isQuitado` branch above, or otherwise harmless leftover locals) and don't need to be
removed; this task only touches the code shown above.

- [ ] **Step 2: Verify the build**

Run: `npx vite build --mode development`
Expected: `✓ built in` with no errors.

- [ ] **Step 3: Commit**

```bash
git add src/main.jsx
git commit -m "feat: comprovante de quitação (parcela final) usa HTML+print v3 + QR real"
```

---

### Task 5: `gerarComprovante` becomes a thin wrapper

**Files:**
- Modify: `src/main.jsx:4717-4827` (exact current boundaries — re-locate by the
  function signature below if line numbers have shifted).

**Interfaces:**
- Consumes: `abrirComprovanteQuitacao(dados)` from Task 3, `fmtMesAno` from Task 2,
  `apiDateStr` (already exists in the file).
- Produces: no signature change — `gerarComprovante(contrato, parcelasContrato,
  cliente, totalPagoOverride, ultPagOverride)` keeps its exact name and parameters.
  The 3 call sites (`main.jsx:4232`, `:8436`, `:8446`) require zero changes.

- [ ] **Step 1: Locate and replace the entire function body**

Find this exact block (Task 4 in this plan does not touch this function, so it should
be unchanged from the current state of the file):

```javascript
function gerarComprovante(contrato, parcelasContrato, cliente, totalPagoOverride, ultPagOverride) {
  try{
    const ps=[...parcelasContrato].sort((a,b)=>parseInt(a.NUM_PARCELA||0)-parseInt(b.NUM_PARCELA||0));
    const totalPagoPs=ps.reduce((s,p)=>s+parseFloat(p.VALOR_PAGO||0),0);
    const totalPago=totalPagoOverride!==undefined?Math.max(totalPagoPs,totalPagoOverride):totalPagoPs;
    const valorOriginal=parseFloat(contrato.VALOR_PRINCIPAL||contrato.VALOR_TOTAL||0);
    const datasPs=ps.map(p=>parseDate(p.DATA_PAGAMENTO)).filter(Boolean);
    const ultPagPs=datasPs.length?datasPs.reduce((a,b)=>a>b?a:b):null;
    const ultPag=ultPagOverride||ultPagPs;
    const nome=String(contrato.NOME_CLIENTE||cliente?.NOME_CLIENTE||'—');
    const cpf=String(contrato.CPF||cliente?.CPF||'—');
    const fD=d=>{if(!d)return'—';const dt=d instanceof Date?d:parseDate(d);return dt&&!isNaN(dt)?dt.toLocaleDateString('pt-BR'):'—';};
    const fR=fmtR;
    const now=new Date();
    const doc=new jsPDF({unit:'mm',format:'a4'});
    const W=210,pd=20;
    const {G,GL,DK,MT,BDC,LMK}=_PDF_CLR;
    const G7=[14,92,68],G6=[17,128,94],GI=[230,248,239],G2=[194,239,216],LGR=[247,249,248];

    // ─── LETTERHEAD ────────────────────────────────────────────────
    let y=16;
    doc.setFillColor(31,184,119);doc.roundedRect(pd,y,13,13,3,3,'F');
    doc.setFillColor(...G);doc.roundedRect(pd+9,y+5,13,13,3,3,'F');
    doc.setFillColor(...LMK);doc.roundedRect(pd+9,y+5,4.5,4.5,1,1,'F');
    doc.setFont('helvetica','bold');doc.setFontSize(17);doc.setTextColor(...DK);
    doc.text('Borges Assessoria',pd+27,y+7);
    doc.setFont('helvetica','normal');doc.setFontSize(8);doc.setTextColor(...G7);
    doc.text('Infraestrutura de crédito privado',pd+27,y+12.5);
    ['CNPJ 63.124.205/0001-07','borgesassessoriafinanceira@gmail.com','Tel/WPP: (62) 98487-7843'].forEach((l,i)=>{
      doc.setFont('helvetica','normal');doc.setFontSize(8);doc.setTextColor(...MT);
      doc.text(l,W-pd,y+i*4.5,{align:'right'});
    });
    y+=21;
    doc.setFillColor(...G);doc.rect(pd,y,16,1.5,'F');
    doc.setFillColor(...BDC);doc.rect(pd+16,y,W-2*pd-16,1.5,'F');
    y+=10;

    // ─── QUITAÇÃO TOTAL (substituí o stamp rotacionado por badge) ──
    const stampCx=W-pd-17,stampCy=y+5;
    doc.setDrawColor(17,128,94);doc.setLineWidth(1.2);doc.circle(stampCx,stampCy,14,'D');
    doc.setFont('helvetica','bold');doc.setFontSize(7.5);doc.setTextColor(14,92,68);
    doc.text('QUITAÇÃO TOTAL',stampCx,stampCy-1.5,{align:'center',angle:11});
    doc.setFont('helvetica','normal');doc.setFontSize(5.5);doc.setTextColor(...GL);
    doc.text('NADA CONSTA',stampCx,stampCy+5,{align:'center',angle:11});

    // ─── TÍTULO ────────────────────────────────────────────────────
    doc.setFont('helvetica','normal');doc.setFontSize(8.5);doc.setTextColor(...G7);
    doc.text('COMPROVANTE DE QUITAÇÃO DE CONTRATO',pd,y);
    y+=9;
    doc.setFont('helvetica','bold');doc.setFontSize(20);doc.setTextColor(...DK);
    doc.text('Contrato integralmente quitado',pd,y);
    y+=11;

    // ─── DECLARAÇÃO ────────────────────────────────────────────────
    doc.setFont('helvetica','normal');doc.setFontSize(10);doc.setTextColor(78,88,84);
    const decl=`A Borges Assessoria declara, para os devidos fins, que o contrato de crédito abaixo identificado foi integralmente quitado pelo(a) cliente, nada mais havendo a ser cobrado a título de principal, juros ou encargos relativos a esta operação.`;
    const declL=doc.splitTextToSize(decl,W-2*pd-10);doc.text(declL,pd,y);
    y+=declL.length*5.5+10;

    // ─── BOX RESUMO (verde-100) ────────────────────────────────────
    const boxRows=[
      ['Cliente',`${nome} — CPF ${cpf}`],
      ['Contrato',String(contrato.ID_CONTRATO)],
      ['Valor principal',fR(valorOriginal)],
      ['Total pago (principal + juros)',fR(totalPago)],
      ['Parcelas',`${ps.filter(p=>_ST_TERMINAL.has(String(p.STATUS||"").toLowerCase())).length} de ${ps.length} encerradas`],
      ['Data da quitação',fD(ultPag)],
    ];
    const boxH=8+boxRows.length*10+6;
    doc.setFillColor(...GI);doc.setDrawColor(...G2);doc.setLineWidth(0.5);
    doc.roundedRect(pd,y,W-2*pd,boxH,3,3,'FD');
    let by=y+10;
    boxRows.forEach(([k,v],i)=>{
      doc.setFont('helvetica','normal');doc.setFontSize(9);doc.setTextColor(...MT);doc.text(k,pd+6,by);
      doc.setFont('helvetica','bold');doc.setFontSize(9);doc.setTextColor(...DK);doc.text(String(v),W-pd-6,by,{align:'right'});
      if(i<boxRows.length-1){doc.setDrawColor(...G2);doc.setLineWidth(0.2);doc.line(pd+6,by+3,W-pd-6,by+3);}
      by+=10;
    });
    y+=boxH+10;

    // ─── HISTÓRICO ─────────────────────────────────────────────────
    const psForPdf=ps.map(p=>String(p.STATUS||p.STATUS_PAGAMENTO||"").toLowerCase()==="renegociado"?{...p,VALOR_PAGO:null,TIPO_PAGAMENTO:"renegociado"}:p);
    y=_renderHistParcelas(doc,psForPdf,W,pd,y,GL,DK,BDC,fD,fR);
    y+=10;

    // ─── ASSINATURA + AUTENTICAÇÃO ─────────────────────────────────
    const authCode=`QT·${String(contrato.ID_CONTRATO).slice(-4)}·${now.getFullYear()}·BORGES`;
    doc.setFont('helvetica','normal');doc.setFontSize(7);doc.setTextColor(...MT);
    doc.text('Autenticação',pd,y);
    doc.setFont('helvetica','bold');doc.setFontSize(7.5);doc.setTextColor(...DK);
    doc.text(authCode,pd,y+5);
    doc.setFont('helvetica','normal');doc.setFontSize(6.5);doc.setTextColor(...MT);
    doc.text('Verifique em borgesassessoriafinanceira.com.br/validar',pd,y+10);
    const sx=W-pd-65;
    doc.setDrawColor(...DK);doc.setLineWidth(0.8);doc.line(sx,y,sx+65,y);
    doc.setFont('helvetica','bold');doc.setFontSize(9);doc.setTextColor(...DK);
    doc.text('Borges Assessoria',sx+32,y+6,{align:'center'});
    doc.setFont('helvetica','normal');doc.setFontSize(7.5);doc.setTextColor(...MT);
    doc.text('Assinado digitalmente',sx+32,y+11,{align:'center'});
    y+=18;

    // ─── RODAPÉ ────────────────────────────────────────────────────
    doc.setDrawColor(...BDC);doc.setLineWidth(0.3);doc.line(pd,y,W-pd,y);y+=5;
    doc.setFont('helvetica','normal');doc.setFontSize(7.5);doc.setTextColor(...MT);
    doc.text('Borges Assessoria · borgesassessoriafinanceira@gmail.com',pd,y);
    doc.text(`Página 1 de 1 · ${contrato.ID_CONTRATO}`,W-pd,y,{align:'right'});

    const nomeArq=`comprovante-quitacao-${contrato.ID_CONTRATO}-${now.getFullYear()}${String(now.getMonth()+1).padStart(2,'0')}${String(now.getDate()).padStart(2,'0')}.pdf`;
    doc.save(nomeArq);
  }catch(e){console.error('Quitacao PDF error:',e);}
}
```

Replace the entire function body with:

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
    periodoInicio:fmtMesAno(ps[0]?.DATA_VENCIMENTO), periodoFim:fmtMesAno(ultPag),
    dataQuitacao:fD(ultPag), dataQuitacaoISO:ultPag?apiDateStr(ultPag):"",
    autenticacaoFallback:`QT·${String(contrato.ID_CONTRATO).slice(-4)}·${new Date().getFullYear()}·BORGES`,
  });
}
```

Note this drops the local re-declaration of `fR` (was `const fR=fmtR;`) since the new
body calls the module-level `fmtR`/`fmtMesAno` directly — both already exist and are in
scope at this point in the file (they're declared near the top, `fmtR` at line 26,
`fmtMesAno` added right after it in Task 2).

- [ ] **Step 2: Verify the build**

Run: `npx vite build --mode development`
Expected: `✓ built in` with no errors.

- [ ] **Step 3: Commit**

```bash
git add src/main.jsx
git commit -m "feat: gerarComprovante vira wrapper fino sobre abrirComprovanteQuitacao"
```

---

### Task 6: Review, deploy, and manual QA

**Files:** none (verification only).

- [ ] **Step 1: Confirm Task 1's GAS action was published**

Ask the user to confirm the new GAS Web App version (with `garantirCertificadoQuitacao`)
has been published, per Task 1 Step 3. Do not proceed to live QA (Steps 3-4 below)
until confirmed — the frontend code will still build and deploy fine without it, but
the QR/certificate lookup will silently fail (graceful degradation, per the design) and
QA would give a false negative on that specific piece.

- [ ] **Step 2: Run the project's code review skill**

Per `CLAUDE.md`, this touches `appscript.gs` → **Tier 3**. Invoke the
`ultrareview-financeiroop` skill (not the lighter `review`). Address any 🔴 finding
before continuing.

- [ ] **Step 3: Deploy to production**

```bash
vercel deploy --prod
```

- [ ] **Step 4: Manual browser QA (skill `browser`)**

Against `https://financeiroop.vercel.app`:

1. Registrar o pagamento da última parcela de um contrato de teste → confirmar que
   abre a aba de quitação (não a de pagamento normal), com o placeholder "Gerando..."
   primeiro e depois o documento completo com QR.
2. Escanear/abrir o QR e confirmar que leva pro Certificado de Quitação público com os
   mesmos dados.
3. `ContratoModal` → menu "..." → "Comprovante de Quitação" num contrato já quitado →
   mesma verificação; confirmar que reaproveita o mesmo código/link (não duplica linha
   em `CERTIFICADOS` — checar a aba no Sheets se necessário).
4. Repetir a partir de uma ação rápida do Dashboard para um contrato quitado.
5. Confirmar que o Comprovante de Pagamento (parcela não-final, sub-projeto anterior)
   continua funcionando sem regressão.
6. Console sem erros em todos os passos acima.

- [ ] **Step 5: Documentar no CLAUDE.md / known issues (obrigatório Tier 3)**

Se algo relevante para sessões futuras foi descoberto durante a implementação (ex.:
comportamento do `postAction` assíncrono dentro de `document.write`), adicionar uma
entrada em `docs/ai-memory/07-AI-KNOWN-ISSUES.md`. Pular se nada de novo surgiu.

- [ ] **Step 6: Final commit (se o Step 5 produziu mudanças)**

```bash
git add docs/ai-memory/07-AI-KNOWN-ISSUES.md
git commit -m "docs: registra aprendizados da migração do Comprovante de Quitação v3"
```
