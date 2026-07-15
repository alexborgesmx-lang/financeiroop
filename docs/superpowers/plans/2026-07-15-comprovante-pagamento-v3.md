# Comprovante de Pagamento v3 (HTML+print) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Migrate the non-quitado path of `gerarEEnviarComprovante` (single-installment
payment receipt) from jsPDF drawing to an HTML+print document matching
`Comprovante de Pagamento.html` from the Rede Borges v3 handoff, pixel-faithfully.

**Architecture:** No new server route, no new dependency. A pure function builds a
self-contained HTML string (own `<style>` block, no external stylesheet reference);
a thin wrapper opens it in a new browser tab via `window.open()` and writes the HTML
into it. `gerarEEnviarComprovante` gets an early-return for the non-quitado case that
calls the new path instead of running its jsPDF drawing code; the quitado branch is
untouched.

**Tech Stack:** React 18 (no new deps), plain template-literal HTML/CSS, Google Fonts
(IBM Plex Mono) loaded via `@import` inside the generated document's own `<style>`.

## Global Constraints

- Every quoted string field (`--action-ink` value, phone numbers, etc.) must come from
  `DESIGN_SYSTEM.md` / real Sheets data — never invent a color or placeholder value.
- No new Vercel serverless function (12-function Hobby limit — see `CLAUDE.md`).
- `gerarEEnviarComprovante`'s 4 existing call sites (`main.jsx:1025`, `:1029`, `:3377`,
  `:4581`, `:8396`) must not change their call signature.
- The `isQuitado` branch of `gerarEEnviarComprovante` (jsPDF drawing code) and the
  separate `gerarComprovante` function (`main.jsx:4669`) must not be touched.
- **No automated test framework exists in this project** (`package.json` has only
  `dev`/`build`/`preview` scripts — no Jest/Vitest/Playwright). Verification in this
  plan uses `npx vite build` (catches syntax/reference errors) after every code task,
  and a single consolidated manual browser QA pass in the final task — this mirrors
  how the rest of the codebase is actually verified (see `CLAUDE.md` Tier protocols).
  Do not introduce a test framework as part of this plan — out of scope.

---

### Task 1: Linha de Confiança SVG helper + HTML template builder

**Files:**
- Modify: `src/main.jsx` — insert new code right before `function gerarEEnviarComprovante`
  (currently at line 533, preceded by a blank line and the comment
  `// ─── HELPER: GERAR E ENVIAR COMPROVANTE PDF VIA WHATSAPP ─────────`).

**Interfaces:**
- Consumes: `fmtR` (already defined earlier in the file, formats a number as `"R$ 1.234,56"`).
- Produces: `_linhaConfiancaSVG(w, h, n, sw, amp, color) → string` (an inline `<svg>...</svg>`
  string). `_comprovantePagamentoHTML(d) → string` (a full `<!doctype html>...</html>`
  document string), where `d` is an object with these exact string keys — all values are
  already-formatted display strings, not raw numbers/dates:
  `{ valorPago, parcelaLabel, nome, cpf, contrato, formaPagamento, pagoEm,
    vencimentoOriginal, saldoDevedor, idTransacao, autenticacao }`.
  Task 3 is the caller and must supply exactly these keys.

- [ ] **Step 1: Locate the exact insertion point**

Read `src/main.jsx` around line 530 and confirm it matches:

```javascript
    }
    if(i%2===0){doc.setFillColor(...LGR);doc.rect(pd,y,tableW,rH,'F');}
    doc.setDrawColor(...BDC);doc.setLineWidth(0.1);doc.line(pd,y+rH,pd+tableW,y+rH);
    let x2=pd;
    cols.forEach(c=>{doc.setFont('helvetica','normal');doc.setFontSize(7);doc.setTextColor(...DK);doc.text(c.fmt(row[c.key]),x2+2,y+5);x2+=c.w;});
    y+=rH;
  });
  doc.setDrawColor(...BDC);doc.setLineWidth(0.3);doc.line(pd,y,pd+tableW,y);
  return y+6;
}

// ─── HELPER: GERAR E ENVIAR COMPROVANTE PDF VIA WHATSAPP ─────────
function gerarEEnviarComprovante(parcela,valorPago,dataPago,tipoLabel,parcelas,contratos,clientes,opts={}){
```

If the surrounding text doesn't match exactly (file may have shifted), search for
`function gerarEEnviarComprovante` and insert immediately above the comment line
directly preceding it.

- [ ] **Step 2: Insert the two new functions**

Using the Edit tool, replace:

```javascript
  return y+6;
}

// ─── HELPER: GERAR E ENVIAR COMPROVANTE PDF VIA WHATSAPP ─────────
function gerarEEnviarComprovante(parcela,valorPago,dataPago,tipoLabel,parcelas,contratos,clientes,opts={}){
```

with:

```javascript
  return y+6;
}

// ─── LINHA DE CONFIANÇA (SVG string) — pra documentos HTML fora do React ──
function _linhaConfiancaSVG(w,h,n,sw,amp,color){
  const midY=h/2,pts=[];
  for(let i=0;i<n;i++) pts.push([16+i*((w-32)/(n-1)), midY+Math.sin(i*1.1)*(h*amp)]);
  let d=`M ${pts[0][0]} ${pts[0][1]}`;
  for(let j=1;j<n;j++){const px=pts[j-1],cx=pts[j],mx=(px[0]+cx[0])/2;d+=` C ${mx} ${px[1]} ${mx} ${cx[1]} ${cx[0]} ${cx[1]}`;}
  const nodes=pts.map((p,i)=>`<circle cx="${p[0]}" cy="${p[1]}" r="${i===Math.floor(n/2)?5:3.4}" fill="currentColor"/>`).join("");
  return `<svg viewBox="0 0 ${w} ${h}" width="${w}" height="${h}" style="color:${color};display:block" aria-hidden="true"><path d="${d}" fill="none" stroke="currentColor" stroke-width="${sw}" stroke-linecap="round"/>${nodes}</svg>`;
}

// ─── COMPROVANTE DE PAGAMENTO v3 — HTML+print (Rede Borges) ───────────────
function _comprovantePagamentoHTML(d){
  return `<!doctype html>
<html lang="pt-BR">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Comprovante ${d.contrato} - ${d.parcelaLabel}</title>
<style>
@import url('https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@400;500;600&display=swap');
:root{
  --bg:#F7F5EF; --surface:#FFFDF9; --surface-2:#F0EDE4; --line:#E2DDD1; --line-soft:#EEEAE0;
  --ink:#1A1712; --ink-soft:#57514A; --ink-faint:#7C756B;
  --brand:#0B3D2E; --on-brand:#EAF6EF; --on-brand-soft:#8FE3C0;
  --signal:#127A57; --success:#15805A; --success-bg:#E5F2EA;
  --r-xl:20px; --shadow-lg:0 20px 52px rgba(11,61,46,.14),0 6px 16px rgba(11,61,46,.08);
  --sans:"Helvetica Neue",Helvetica,Arial,"Segoe UI",sans-serif;
  --mono:"IBM Plex Mono",ui-monospace,"SFMono-Regular",Menlo,monospace;
}
*{box-sizing:border-box}
body{margin:0;background:var(--bg);color:var(--ink);font-family:var(--sans);display:flex;flex-direction:column;align-items:center;padding:40px 16px;gap:20px;min-height:100vh;-webkit-font-smoothing:antialiased;}
.num{font-variant-numeric:tabular-nums;font-weight:700;letter-spacing:-0.02em;}
.mono{font-family:var(--mono);letter-spacing:-0.01em;}
.toolbar{display:flex;gap:10px;}
.btn{border:none;border-radius:999px;padding:10px 18px;font-size:13px;font-weight:700;cursor:pointer;font-family:var(--sans);}
.btn-p{background:#A8E03F;color:#07241B;}
.doc{width:452px;max-width:100%;background:var(--surface);border-radius:var(--r-xl);overflow:hidden;box-shadow:var(--shadow-lg);border:1px solid var(--line);}
.hdr{background:var(--brand);color:var(--on-brand);padding:22px 28px 20px;position:relative;overflow:hidden;}
.hdr .thread{position:absolute;top:8px;left:0;width:100%;height:40px;opacity:.30;}
.hdr .brand{display:flex;align-items:center;gap:12px;position:relative;}
.hdr b{font-size:15px;letter-spacing:-.01em;font-weight:700;}
.hdr .sub{font-family:var(--mono);font-size:10px;color:var(--on-brand-soft);letter-spacing:.08em;text-transform:uppercase;margin-top:2px;}
.body{padding:32px 28px 26px;}
.check{width:64px;height:64px;border-radius:50%;background:var(--success-bg);display:grid;place-items:center;margin:0 auto;}
.amount{text-align:center;margin-top:14px;}
.amount .lbl{font-size:14px;color:var(--ink-faint);}
.amount .big{font-size:44px;margin-top:2px;color:var(--ink);}
.amount .par{font-size:13px;color:var(--signal);font-weight:700;margin-top:3px;}
.rows{margin-top:26px;}
.row{display:flex;justify-content:space-between;gap:14px;padding:11px 0;border-bottom:1px solid var(--line-soft);font-size:14px;}
.row:last-child{border-bottom:none;}
.row .k{color:var(--ink-faint);}
.row .v{font-weight:500;text-align:right;color:var(--ink);}
.foot{background:var(--surface-2);padding:18px 28px;border-top:1px solid var(--line);font-size:11px;color:var(--ink-faint);line-height:1.65;}
.foot b{color:var(--ink-soft);font-weight:600;}
@media print{
  body{padding:0;background:#fff;} .toolbar{display:none!important;} .doc{box-shadow:none;border-radius:0;width:100%;border:none;}
  *{-webkit-print-color-adjust:exact!important;print-color-adjust:exact!important;}
  @page{margin:14mm;}
}
</style>
</head>
<body>
  <div class="toolbar">
    <button class="btn btn-p" onclick="window.print()">Salvar / imprimir PDF</button>
  </div>
  <div class="doc">
    <div class="hdr">
      ${_linhaConfiancaSVG(452,40,9,1.6,0.22,"var(--on-brand-soft)")}
      <div class="brand">
        <svg width="32" height="32" viewBox="0 0 68 68"><rect x="3" y="3" width="40" height="40" rx="9" fill="#1FB877"/><rect x="25" y="25" width="40" height="40" rx="9" fill="#fff"/><path d="M25 25 H43 V43 H25 Z" fill="#0E5C44"/></svg>
        <div><b>Borges Assessoria</b><div class="sub">Comprovante de pagamento</div></div>
      </div>
    </div>
    <div class="body">
      <div class="check">
        <svg width="30" height="30" viewBox="0 0 24 24" fill="none"><path d="M4 12.5 L9.5 18 L20 6.5" stroke="var(--success)" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"/></svg>
      </div>
      <div class="amount">
        <div class="lbl">Pagamento confirmado</div>
        <div class="big num">${d.valorPago}</div>
        <div class="par num">${d.parcelaLabel}</div>
      </div>
      <div class="rows">
        <div class="row"><span class="k">Cliente</span><span class="v">${d.nome}</span></div>
        <div class="row"><span class="k">CPF</span><span class="v num">${d.cpf}</span></div>
        <div class="row"><span class="k">Contrato</span><span class="v mono">${d.contrato}</span></div>
        <div class="row"><span class="k">Forma de pagamento</span><span class="v">${d.formaPagamento}</span></div>
        <div class="row"><span class="k">Pago em</span><span class="v num">${d.pagoEm}</span></div>
        <div class="row"><span class="k">Vencimento original</span><span class="v num">${d.vencimentoOriginal}</span></div>
        <div class="row"><span class="k">Saldo devedor após</span><span class="v num">${d.saldoDevedor}</span></div>
        <div class="row"><span class="k">ID da transação</span><span class="v mono" style="font-size:12px;">${d.idTransacao}</span></div>
      </div>
    </div>
    <div class="foot">
      <b>Borges Assessoria Financeira</b> · CNPJ 63.124.205/0001-07 · borgesassessoriafinanceira@gmail.com · (62) 98487-7843<br>
      Documento gerado eletronicamente. Autenticação <span class="mono">${d.autenticacao}</span>. Este comprovante atesta o recebimento do valor e não constitui documento fiscal.
    </div>
  </div>
</body>
</html>`;
}

// ─── HELPER: GERAR E ENVIAR COMPROVANTE PDF VIA WHATSAPP ─────────
function gerarEEnviarComprovante(parcela,valorPago,dataPago,tipoLabel,parcelas,contratos,clientes,opts={}){
```

- [ ] **Step 3: Verify the build**

Run: `npx vite build --mode development`
Expected: `✓ built in` with no errors. If it fails, check for an unescaped backtick or
`${` inside the template literal above — the whole HTML string is one JS template
literal, so any literal `` ` `` or unintended `${` inside the CSS/HTML would break it
(there are none in the code above, but re-check after any manual edits).

- [ ] **Step 4: Commit**

```bash
git add src/main.jsx
git commit -m "feat: adiciona template HTML v3 do Comprovante de Pagamento (ainda não usado)"
```

---

### Task 2: `abrirComprovantePagamento` — open the document in a new tab

**Files:**
- Modify: `src/main.jsx` — insert immediately after the closing `` ` ``; `}` of
  `_comprovantePagamentoHTML` from Task 1, before the
  `// ─── HELPER: GERAR E ENVIAR COMPROVANTE PDF VIA WHATSAPP ─────────` comment.

**Interfaces:**
- Consumes: `_comprovantePagamentoHTML(d)` from Task 1.
- Produces: `abrirComprovantePagamento(dados) → Window|null`. Task 3 is the caller —
  it must pass the same 11-key object shape defined in Task 1's Interfaces section,
  and must treat a `null` return as "already handled" (the function shows its own
  alert on failure; the caller does not need to show another one).

- [ ] **Step 1: Insert the function**

Using the Edit tool, replace:

```javascript
</html>`;
}

// ─── HELPER: GERAR E ENVIAR COMPROVANTE PDF VIA WHATSAPP ─────────
function gerarEEnviarComprovante(parcela,valorPago,dataPago,tipoLabel,parcelas,contratos,clientes,opts={}){
```

with:

```javascript
</html>`;
}

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

- [ ] **Step 2: Verify the build**

Run: `npx vite build --mode development`
Expected: `✓ built in` with no errors.

- [ ] **Step 3: Commit**

```bash
git add src/main.jsx
git commit -m "feat: adiciona abrirComprovantePagamento (ainda não usado)"
```

---

### Task 3: Wire the non-quitado branch of `gerarEEnviarComprovante`

**Files:**
- Modify: `src/main.jsx:559-564` (line numbers approximate — locate by the exact text
  below, which is unique in the file).

**Interfaces:**
- Consumes: `abrirComprovantePagamento(dados)` from Task 2, with the exact key names
  from Task 1 (`valorPago, parcelaLabel, nome, cpf, contrato, formaPagamento, pagoEm,
  vencimentoOriginal, saldoDevedor, idTransacao, autenticacao`).
- Produces: no new exports — this task only changes the internal behavior of
  `gerarEEnviarComprovante`, whose 4 call sites (`main.jsx:1025,1029,3377,4581,8396`)
  are unaffected and require no changes.

- [ ] **Step 1: Locate the exact text and insert the early return**

Inside `function gerarEEnviarComprovante(...)`, find this exact two-line sequence
(it is unique — `const doc=new jsPDF({unit:'mm',format:'a4'});` appears 6 times in the
file, but only one of those is immediately preceded by this `nome` line):

```javascript
    const nome=String(parcela.NOME_CLIENTE||cliente?.NOME_CLIENTE||cliente?.NOME||'—');
    const doc=new jsPDF({unit:'mm',format:'a4'});
```

Replace it with:

```javascript
    const nome=String(parcela.NOME_CLIENTE||cliente?.NOME_CLIENTE||cliente?.NOME||'—');
    if(!isQuitado){
      const authTs=`${ts.slice(0,4)}·${ts.slice(4,8)}·BORGES·${String(parcela.ID_PARCELA||'').slice(-4).toUpperCase()||ts.slice(8,12)}`;
      abrirComprovantePagamento({
        valorPago:fR(parseFloat(valorPago||0)),
        parcelaLabel:`Parcela ${String(pNum).padStart(2,'0')} de ${String(totalParcEfetivo).padStart(2,'0')}`,
        nome,
        cpf:String(cliente?.CPF||'—'),
        contrato:String(parcela.ID_CONTRATO),
        formaPagamento:String(tipoLabel||'—'),
        pagoEm:fD(dataPago),
        vencimentoOriginal:fD(parcela.DATA_VENCIMENTO),
        saldoDevedor:fR(saldo),
        idTransacao:String(parcela.ID_PARCELA||'—'),
        autenticacao:authTs,
      });
      if(opts.wpp){const tel=telefone?`55${telefone}`:'';const isMobile=/iPhone|iPad|iPod|Android/i.test(navigator.userAgent);const wppUrl=tel?`https://wa.me/${tel}`:(isMobile?'https://wa.me':'https://web.whatsapp.com');setTimeout(()=>window.open(wppUrl,'_blank'),700);}
      return;
    }
    const doc=new jsPDF({unit:'mm',format:'a4'});
```

This does not touch anything below it — all the jsPDF drawing code (header, check
circle, data rows, footer, blob download, `opts.wpp` handling) stays exactly as it is
today and is now only ever reached when `isQuitado` is `true`. `ts`, `pNum`,
`totalParcEfetivo`, `fD`, `fR`, `saldo`, `telefone` are all already defined earlier in
the function (unchanged) — this step does not need to compute anything new except
`authTs`.

- [ ] **Step 2: Verify the build**

Run: `npx vite build --mode development`
Expected: `✓ built in` with no errors.

- [ ] **Step 3: Commit**

```bash
git add src/main.jsx
git commit -m "feat: comprovante de pagamento (parcela não-quitada) usa HTML+print v3"
```

---

### Task 4: Delete dead code — `PagamentoDetalheModal.gerarPdfBlob`

**Files:**
- Modify: `src/main.jsx` — inside `function PagamentoDetalheModal(...)`.

**Interfaces:**
- Consumes: nothing (this function has zero callers anywhere in the file — confirmed
  by `grep -n "gerarPdfBlob" src/main.jsx` returning only its own definition line).
- Produces: nothing — pure deletion. `enviarWpp` (defined right after it) already
  calls `gerarEEnviarComprovante` directly, not `gerarPdfBlob`, and is unaffected.

- [ ] **Step 1: Confirm it's still dead code before deleting**

Run: `grep -n "gerarPdfBlob" src/main.jsx`
Expected: exactly one line — the `const gerarPdfBlob=()=>{` definition. If any other
line appears (a call site), STOP and do not delete — re-scope this task.

- [ ] **Step 2: Delete the function**

Find this block (starts right after the `Info` component definition inside
`PagamentoDetalheModal`, ends right before `const isMobile=...`):

```javascript
  const gerarPdfBlob=()=>{
    const fD=d=>{if(!d)return'—';const dt=d instanceof Date?d:parseDate(d);return dt&&!isNaN(dt)?dt.toLocaleDateString('pt-BR'):'—';};
    const fR=fmtR;
    const pNum=parseInt(numParc||0);
    const totalParc=parseInt(contrato?.NUM_PARCELAS||hist.length||0);
    const pagas=hist.filter(p=>["pago","quitacao_antecipada"].includes(String(p.STATUS||p.STATUS_PAGAMENTO||"").toLowerCase()));
    const totalJaPago=pagas.reduce((s,p)=>s+parseFloat(p.VALOR_PAGO||0),0);
    const valorOriginal=parseFloat(contrato?.VALOR_PRINCIPAL||contrato?.VALOR_TOTAL||0);
    const parcelasRestantes=Math.max(0,totalParc-pagas.length);
    const valorParcOrig=parseFloat(hist[0]?.VALOR_PARCELA||0);
    const saldo=Math.max(0,parcelasRestantes*valorParcOrig);
    const now=new Date();
    const doc=new jsPDF({unit:'mm',format:'a4'});
    const W=210,pd=20;
    const {G,GL,DK,MT,BDC,LMK}=_PDF_CLR;
    const G3=[135,223,182],G7=[14,92,68],GI=[230,248,239],SEP=[236,239,238],LGR=[247,249,248];
    const nomeCli=String(pag.NOME_CLIENTE||cliente?.NOME||'—');

    // ─── HEADER ────────────────────────────────────────────────────
    doc.setFillColor(...LMK);doc.rect(0,0,W,26,'F');
    doc.setFillColor(31,184,119);doc.roundedRect(pd,8,11,11,2.5,2.5,'F');
    doc.setFillColor(255,255,255);doc.roundedRect(pd+7,12,11,11,2.5,2.5,'F');
    doc.setFillColor(14,92,68);doc.roundedRect(pd+7,12,4,4,1,1,'F');
    doc.setFont('helvetica','bold');doc.setFontSize(15);doc.setTextColor(255,255,255);
    doc.text('BORGES ASSESSORIA',pd+22,14);
    doc.setFont('helvetica','normal');doc.setFontSize(7.5);doc.setTextColor(...G3);
    doc.text('Comprovante de Pagamento',pd+22,20);
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
    doc.text('Pagamento confirmado',W/2,y,{align:'center'});
    y+=7;
    doc.setFont('helvetica','bold');doc.setFontSize(22);doc.setTextColor(...DK);
    doc.text(fR(parseFloat(pag.VALOR_PAGO||0)),W/2,y,{align:'center'});
    y+=8;
    doc.setFont('helvetica','bold');doc.setFontSize(10);doc.setTextColor(...G7);
    doc.text(`Parcela ${pNum} de ${totalParc}`,W/2,y,{align:'center'});
    y+=14;

    // ─── DATA ROWS ─────────────────────────────────────────────────
    const dataRows=[
      ['Cliente',nomeCli],
      ['CPF',String(cliente?.CPF||'—')],
      ['Contrato',String(pag.ID_CONTRATO)],
      ['Forma de pagamento',String(pag.FORMA_PAGAMENTO||tLbl||'—')],
      ['Pago em',fD(pag.DATA_PAGAMENTO)],
      ['Vencimento original',fD(parcela?.DATA_VENCIMENTO)],
      ['Saldo devedor após',fR(saldo)],
      ['ID da transação',String(pag.ID_PARCELA||parcela?.ID_PARCELA||'—')],
    ];
    dataRows.forEach(([k,v],i)=>{
      const ry=y+i*10;
      doc.setFont('helvetica','normal');doc.setFontSize(8.5);doc.setTextColor(...MT);doc.text(k,pd,ry);
      doc.setFont('helvetica','normal');doc.setFontSize(8.5);doc.setTextColor(...DK);doc.text(String(v),W-pd,ry,{align:'right'});
      if(i<dataRows.length-1){doc.setDrawColor(...SEP);doc.setLineWidth(0.2);doc.line(pd,ry+3,W-pd,ry+3);}
    });
    y+=dataRows.length*10+10;

    // ─── FOOTER ────────────────────────────────────────────────────
    doc.setFillColor(...LGR);doc.rect(0,y,W,30,'F');
    doc.setDrawColor(...BDC);doc.setLineWidth(0.3);doc.line(pd,y,W-pd,y);
    y+=7;
    const qt='"Declaramos que o pagamento acima foi recebido e registrado em nosso controle interno, referente à parcela informada neste comprovante."';
    doc.setFont('helvetica','italic');doc.setFontSize(8);doc.setTextColor(...MT);
    const qtL=doc.splitTextToSize(qt,W-2*pd);doc.text(qtL,W/2,y,{align:'center'});y+=qtL.length*5+3;
    doc.setFont('helvetica','normal');doc.setFontSize(7);doc.setTextColor(...MT);
    doc.text('Borges Assessoria · CNPJ 63.124.205/0001-07 · borgesassessoriafinanceira@gmail.com',W/2,y,{align:'center'});y+=4;
    const authPag=`${now.getFullYear()}${String(now.getMonth()+1).padStart(2,'0')}·BORGES·${String(pag.ID_PARCELA||'').slice(-4).toUpperCase()}`;
    doc.setFont('helvetica','bold');doc.setFontSize(7);doc.setTextColor(...DK);
    doc.text(`Autenticação: ${authPag}`,W/2,y,{align:'center'});y+=4;
    doc.setFont('helvetica','normal');doc.setFontSize(6.5);doc.setTextColor(...MT);
    doc.text('Documento gerado eletronicamente. Não constitui documento fiscal.',W/2,y,{align:'center'});
    return doc.output('blob');
  };

```

Delete it entirely (replace with nothing — but keep the blank line that was already
between `Info` and `isMobile` before this function existed; i.e. the line right above
`const gerarPdfBlob=()=>{` and the line right below the closing `};` should collapse
to a single blank line, not two).

- [ ] **Step 3: Verify the build**

Run: `npx vite build --mode development`
Expected: `✓ built in` with no errors.

- [ ] **Step 4: Commit**

```bash
git add src/main.jsx
git commit -m "chore: remove gerarPdfBlob morto (PagamentoDetalheModal)"
```

---

### Task 5: Review, deploy, and manual QA

**Files:** none (verification only).

- [ ] **Step 1: Run the project's code review skill**

Per `CLAUDE.md`, this is a Tier 2 change (new frontend behavior, no GAS/financial
calculation touched). Invoke the `review` skill and address any 🔴 bloqueante finding
before continuing. 🟡/🔵 findings are a judgment call — fix if cheap, otherwise note
them for follow-up.

- [ ] **Step 2: Deploy to production**

```bash
vercel deploy --prod
```

- [ ] **Step 3: Manual browser QA (skill `browser`)**

Against `https://financeiroop.vercel.app`, in both light and dark mode where relevant:

1. Registrar um pagamento normal de parcela (Dashboard → "Registrar Pagamento" →
   escolher uma parcela não-quitante do contrato) → confirmar que uma aba nova abre
   com o comprovante, dados corretos, Linha de Confiança visível no cabeçalho verde.
2. No `ComprovanteEnvioModal` que aparece logo após, clicar "Salvar comprovante (PDF)"
   → confirmar que abre outra aba com o mesmo comprovante.
3. No mesmo modal, clicar "Enviar pelo WhatsApp" → confirmar que a aba do comprovante
   E a aba do WhatsApp (`wa.me` ou `web.whatsapp.com`) abrem.
4. No Financeiro, abrir o detalhe de um pagamento já registrado
   (`PagamentoDetalheModal`) e clicar em reenviar pelo WhatsApp → confirmar que abre
   a aba do comprovante.
5. No Dashboard, usar a ação rápida de reenvio de recibo pro último pagamento de um
   contrato → confirmar que abre a aba do comprovante.
6. Na aba do comprovante, clicar "Salvar / imprimir PDF" e confirmar no preview de
   impressão do navegador que a fonte, cores e Linha de Confiança aparecem corretas.
7. Registrar um pagamento que **quita o contrato** (última parcela) → confirmar que
   **continua baixando o PDF antigo (jsPDF)** automaticamente, sem abrir aba nova —
   o branch `isQuitado` não deve ter mudado de comportamento.
8. Abrir o console do navegador (`read_console_messages`, `onlyErrors:true`) durante
   os passos 1-7 e confirmar que não há nenhum erro.

- [ ] **Step 4: Update DESIGN_SYSTEM.md if a new pattern emerged**

Only if Task 1-4 introduced a reusable pattern worth documenting beyond what
`docs/superpowers/specs/2026-07-15-comprovante-pagamento-v3-design.md` already covers
(e.g. if the "open HTML doc in new tab" pattern is likely to be reused verbatim for
the next document sub-project) — add a short note under `DESIGN_SYSTEM.md`'s Linha de
Confiança subsection pointing at `_comprovantePagamentoHTML` as the reference
implementation for future documents. Skip if nothing new to document.

- [ ] **Step 5: Final commit (if Step 4 produced changes)**

```bash
git add DESIGN_SYSTEM.md
git commit -m "docs: referencia _comprovantePagamentoHTML como padrão pra próximos documentos v3"
```
