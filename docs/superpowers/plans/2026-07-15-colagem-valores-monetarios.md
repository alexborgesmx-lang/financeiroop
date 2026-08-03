# Correção de Colagem de Valores Monetários (BR) — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Corrigir a colagem de valores monetários em formato BR (`2.000,00`) nos campos `type="number"` do `src/main.jsx`, que hoje descartam a vírgula e produzem valores errados (`2.00000`).

**Architecture:** Duas funções puras (`parseValorColado`, `pasteMoeda`) adicionadas perto de `fmtR`. Cada input monetário `type="number"` ganha um `onPaste` que intercepta a colagem, converte o texto BR para um número JS válido e seta o state diretamente via `preventDefault()` — sem alterar `onChange`, `type`, nem a UX de digitação manual.

**Tech Stack:** React 18 (JSX puro, sem TypeScript), Vite. Sem framework de testes automatizados no projeto (`package.json` não tem jest/vitest) — verificação de sintaxe via `npm run build` (vite build) a cada tarefa, verificação funcional manual no navegador na tarefa final, conforme protocolo Tier 2 do `CLAUDE.md` do projeto.

## Global Constraints

- Não alterar `type="number"` dos inputs, nem `onChange`, nem validações `min`/`max` existentes — só adicionar `onPaste`.
- Não aplicar a correção a campos de percentual (`Taxa Mensal %`, `pct` na Quitação Antecipada) ou de quantidade (`Nº de Parcelas`).
- Sem comentários novos no código (convenção do projeto: código autodocumentado).
- Commits em português, prefixo `fix:` (correção de comportamento existente).
- Antes de `vercel deploy --prod`: rodar a skill `review` (Tier 2, conforme `CLAUDE.md`).

---

## Task 1: Helpers `parseValorColado` e `pasteMoeda`

**Files:**
- Modify: `src/main.jsx:24` (logo após a linha de `fmtR`)

**Interfaces:**
- Produces: `parseValorColado(texto: string): number|null`, `pasteMoeda(e: ClipboardEvent, setter: (v:string)=>void): void` — usados por todas as tarefas seguintes.

- [ ] **Step 1: Ler a linha atual para confirmar o ponto de inserção**

A linha 24 hoje é:
```js
const fmtR  = v => "R$ " + Number(v||0).toLocaleString("pt-BR",{minimumFractionDigits:2,maximumFractionDigits:2});
```

- [ ] **Step 2: Escrever um script Node isolado para validar a lógica do parser antes de integrar**

Criar `/private/tmp/claude-501/-Users-alexborges-financeiroop/7385fbe9-7f9a-441e-8d86-af0a593efd20/scratchpad/test-parse-valor.mjs`:

```js
function parseValorColado(texto) {
  let s = String(texto || "").trim();
  if (!s) return null;
  const neg = s.replace(/[^\d.,-]/g, "").trim().startsWith("-");
  s = s.replace(/[^\d.,]/g, "");
  if (!s) return null;
  const hasComma = s.includes(",");
  const hasDot = s.includes(".");
  if (hasComma && hasDot) {
    s = s.replace(/\./g, "").replace(",", ".");
  } else if (hasComma && !hasDot) {
    s = s.replace(",", ".");
  } else if (hasDot && !hasComma) {
    const partes = s.split(".");
    if (partes.length > 2) s = partes.join("");
    else if (partes[1] && partes[1].length === 3) s = partes.join("");
  }
  const n = parseFloat(s);
  if (isNaN(n)) return null;
  return neg ? -n : n;
}

const casos = [
  ["2.000,00", 2000],
  ["2000,00", 2000],
  ["2.000", 2000],
  ["2.50", 2.5],
  ["2.5", 2.5],
  ["1.234.567,89", 1234567.89],
  ["500", 500],
  ["R$ 2.000,00", 2000],
  ["-150,00", -150],
  ["", null],
  ["abc", null],
];

let falhas = 0;
for (const [entrada, esperado] of casos) {
  const r = parseValorColado(entrada);
  const ok = esperado === null ? r === null : Math.abs(r - esperado) < 1e-9;
  if (!ok) { falhas++; console.error(`FALHOU: parseValorColado(${JSON.stringify(entrada)}) = ${r}, esperado ${esperado}`); }
}
if (falhas === 0) console.log("OK: todos os casos passaram");
else { console.log(`${falhas} caso(s) falharam`); process.exit(1); }
```

- [ ] **Step 3: Rodar o script e confirmar que passa**

Run: `node /private/tmp/claude-501/-Users-alexborges-financeiroop/7385fbe9-7f9a-441e-8d86-af0a593efd20/scratchpad/test-parse-valor.mjs`
Expected: `OK: todos os casos passaram`

Se algum caso falhar, ajustar a função no script até passar antes de integrar ao `main.jsx`.

- [ ] **Step 4: Integrar as duas funções (já validadas) ao `main.jsx`**

Old string (`src/main.jsx` linha 24):
```js
const fmtR  = v => "R$ " + Number(v||0).toLocaleString("pt-BR",{minimumFractionDigits:2,maximumFractionDigits:2});
```

New string:
```js
const fmtR  = v => "R$ " + Number(v||0).toLocaleString("pt-BR",{minimumFractionDigits:2,maximumFractionDigits:2});
function parseValorColado(texto){
  let s=String(texto||"").trim();
  if(!s)return null;
  const neg=s.replace(/[^\d.,-]/g,"").trim().startsWith("-");
  s=s.replace(/[^\d.,]/g,"");
  if(!s)return null;
  const hasComma=s.includes(",");
  const hasDot=s.includes(".");
  if(hasComma&&hasDot){
    s=s.replace(/\./g,"").replace(",",".");
  }else if(hasComma&&!hasDot){
    s=s.replace(",",".");
  }else if(hasDot&&!hasComma){
    const partes=s.split(".");
    if(partes.length>2)s=partes.join("");
    else if(partes[1]&&partes[1].length===3)s=partes.join("");
  }
  const n=parseFloat(s);
  if(isNaN(n))return null;
  return neg?-n:n;
}
function pasteMoeda(e,setter){
  const texto=e.clipboardData?.getData("text")||"";
  const n=parseValorColado(texto);
  if(n===null)return;
  e.preventDefault();
  setter(String(n));
}
```

- [ ] **Step 5: Verificar que o build passa**

Run: `cd /Users/alexborges/financeiroop && npm run build`
Expected: build finaliza sem erro (saída termina com `✓ built in ...`)

- [ ] **Step 6: Commit**

```bash
git add src/main.jsx
git commit -m "fix: adiciona parser de valores monetários BR colados (parseValorColado/pasteMoeda)"
```

---

## Task 2: `CampoEdit` — prop `moeda` + campos de Renda no ClienteModal

**Files:**
- Modify: `src/main.jsx:2688` (componente `CampoEdit`)
- Modify: `src/main.jsx:3173-3176` (chamadas de Renda Bruta/Líquida/Mensal)

**Interfaces:**
- Consumes: `pasteMoeda(e, setter)` de Task 1.
- Produces: prop `moeda` (boolean) em `CampoEdit`, usada só dentro deste componente.

- [ ] **Step 1: Adicionar a prop `moeda` e o `onPaste` condicional em `CampoEdit`**

Old string:
```js
function CampoEdit({label,field,tipo,opts,edit,setEdit,erros,fixup}){
  const erro=erros[field];
  return(
    <div>
      <span style={LS()}>{label}</span>
      {opts
        ?<select value={edit[field]||""} onChange={e=>setEdit(p=>({...p,[field]:e.target.value}))} style={IS()}>
            {edit[field]&&!opts.some(o=>o.v===edit[field])&&<option value={edit[field]}>{edit[field]} ⚠ (valor original — normalizar)</option>}
            {opts.map(o=><option key={o.v} value={o.v}>{o.l}</option>)}
          </select>
        :<input type={tipo||"text"} value={edit[field]||""} onChange={e=>setEdit(p=>({...p,[field]:e.target.value}))} onBlur={fixup?e=>{const v=fixup(e.target.value);if(v!==e.target.value)setEdit(p=>({...p,[field]:v}));}:undefined} style={{...IS(),border:`1px solid ${erro?RED:BD}`,background:erro?RED+"06":CARD}}/>
      }
      {erro&&<div style={{fontSize:10,color:RED,fontWeight:600,marginTop:3}}>⚠ {erro}</div>}
    </div>
  );
}
```

New string:
```js
function CampoEdit({label,field,tipo,opts,edit,setEdit,erros,fixup,moeda}){
  const erro=erros[field];
  return(
    <div>
      <span style={LS()}>{label}</span>
      {opts
        ?<select value={edit[field]||""} onChange={e=>setEdit(p=>({...p,[field]:e.target.value}))} style={IS()}>
            {edit[field]&&!opts.some(o=>o.v===edit[field])&&<option value={edit[field]}>{edit[field]} ⚠ (valor original — normalizar)</option>}
            {opts.map(o=><option key={o.v} value={o.v}>{o.l}</option>)}
          </select>
        :<input type={tipo||"text"} value={edit[field]||""} onChange={e=>setEdit(p=>({...p,[field]:e.target.value}))} onPaste={moeda?e=>pasteMoeda(e,v=>setEdit(p=>({...p,[field]:v}))):undefined} onBlur={fixup?e=>{const v=fixup(e.target.value);if(v!==e.target.value)setEdit(p=>({...p,[field]:v}));}:undefined} style={{...IS(),border:`1px solid ${erro?RED:BD}`,background:erro?RED+"06":CARD}}/>
      }
      {erro&&<div style={{fontSize:10,color:RED,fontWeight:600,marginTop:3}}>⚠ {erro}</div>}
    </div>
  );
}
```

- [ ] **Step 2: Passar `moeda` nas 3 chamadas de Renda**

Old string:
```js
                <CampoEdit edit={edit} setEdit={setEdit} erros={erros} label="Renda Bruta (R$)" field="RENDA_BRUTA" tipo="number"/>
                <CampoEdit edit={edit} setEdit={setEdit} erros={erros} label="Renda Líquida (R$)" field="RENDA_LIQUIDA" tipo="number"/>
```

New string:
```js
                <CampoEdit edit={edit} setEdit={setEdit} erros={erros} label="Renda Bruta (R$)" field="RENDA_BRUTA" tipo="number" moeda/>
                <CampoEdit edit={edit} setEdit={setEdit} erros={erros} label="Renda Líquida (R$)" field="RENDA_LIQUIDA" tipo="number" moeda/>
```

Old string:
```js
                  <CampoEdit edit={edit} setEdit={setEdit} erros={erros} label="Renda Mensal Operacional (R$)" field="RENDA_MENSAL" tipo="number"/>
```

New string:
```js
                  <CampoEdit edit={edit} setEdit={setEdit} erros={erros} label="Renda Mensal Operacional (R$)" field="RENDA_MENSAL" tipo="number" moeda/>
```

- [ ] **Step 3: Verificar que o build passa**

Run: `cd /Users/alexborges/financeiroop && npm run build`
Expected: build finaliza sem erro

- [ ] **Step 4: Commit**

```bash
git add src/main.jsx
git commit -m "fix: corrige colagem de valor monetário nos campos de Renda (ClienteModal)"
```

---

## Task 3: `CobrancaModal` — Valor e Desconto nos Juros

**Files:**
- Modify: `src/main.jsx:1336` e `src/main.jsx:1356` (dentro de `CobrancaModal`, linha 996)

**Interfaces:**
- Consumes: `pasteMoeda` de Task 1.

- [ ] **Step 1: Campo "Valor (R$)" — respeitar o `readOnly` existente**

Old string:
```js
                  <input
                    type="number"
                    value={valor}
                    onChange={e => setValor(e.target.value)}
                    style={{...IS(), fontSize:20, fontWeight:800, textAlign:"center", height:52}}
                    readOnly={tipo !== "personalizado" && tipo !== "com_atraso"}
                    onFocus={() => setTipo("personalizado")}
                  />
```

New string:
```js
                  <input
                    type="number"
                    value={valor}
                    onChange={e => setValor(e.target.value)}
                    onPaste={e => { if (tipo === "personalizado" || tipo === "com_atraso") pasteMoeda(e, setValor); }}
                    style={{...IS(), fontSize:20, fontWeight:800, textAlign:"center", height:52}}
                    readOnly={tipo !== "personalizado" && tipo !== "com_atraso"}
                    onFocus={() => setTipo("personalizado")}
                  />
```

- [ ] **Step 2: Campo "Desconto nos Juros (R$)"**

Old string:
```js
                    <input
                      type="number"
                      value={desconto || ""}
                      onChange={e => changeDesconto(e.target.value)}
                      placeholder="0,00"
                      min="0"
                      max={parseFloat(parcelaSel.VALOR_JUROS||0)}
                      style={{...IS(),color:desconto>0?GRN:TEXT}}
                    />
```

New string:
```js
                    <input
                      type="number"
                      value={desconto || ""}
                      onChange={e => changeDesconto(e.target.value)}
                      onPaste={e => pasteMoeda(e, changeDesconto)}
                      placeholder="0,00"
                      min="0"
                      max={parseFloat(parcelaSel.VALOR_JUROS||0)}
                      style={{...IS(),color:desconto>0?GRN:TEXT}}
                    />
```

- [ ] **Step 3: Verificar que o build passa**

Run: `cd /Users/alexborges/financeiroop && npm run build`
Expected: build finaliza sem erro

- [ ] **Step 4: Commit**

```bash
git add src/main.jsx
git commit -m "fix: corrige colagem de valor monetário na Cobrança (Valor e Desconto nos Juros)"
```

---

## Task 4: `AbatimentoAssistidoModal` — Valor do abatimento

**Files:**
- Modify: `src/main.jsx:1526`

**Interfaces:**
- Consumes: `pasteMoeda` de Task 1.

- [ ] **Step 1: Adicionar `onPaste`**

Old string:
```js
            <input type="number" min="0.01" step="0.01" value={valor} onChange={e=>{setValor(e.target.value);setErro("");}} style={IS()} placeholder="0,00" autoFocus/>
```

New string:
```js
            <input type="number" min="0.01" step="0.01" value={valor} onChange={e=>{setValor(e.target.value);setErro("");}} onPaste={e=>pasteMoeda(e,v=>{setValor(v);setErro("");})} style={IS()} placeholder="0,00" autoFocus/>
```

- [ ] **Step 2: Verificar que o build passa**

Run: `cd /Users/alexborges/financeiroop && npm run build`
Expected: build finaliza sem erro

- [ ] **Step 3: Commit**

```bash
git add src/main.jsx
git commit -m "fix: corrige colagem de valor monetário no Abatimento Assistido"
```

---

## Task 5: `EncerrarContratoModal` — Valor recebido no encerramento

**Files:**
- Modify: `src/main.jsx:1606`

**Interfaces:**
- Consumes: `pasteMoeda` de Task 1.

- [ ] **Step 1: Adicionar `onPaste`**

Old string:
```js
            <input type="number" value={valorRecebido} onChange={e=>{setValorRecebido(e.target.value);setMsg(null);}} placeholder="0,00 — sem valor = baixa como prejuízo" style={{...IS(),fontSize:18,fontWeight:800,height:52,textAlign:"center"}}/>
```

New string:
```js
            <input type="number" value={valorRecebido} onChange={e=>{setValorRecebido(e.target.value);setMsg(null);}} onPaste={e=>pasteMoeda(e,v=>{setValorRecebido(v);setMsg(null);})} placeholder="0,00 — sem valor = baixa como prejuízo" style={{...IS(),fontSize:18,fontWeight:800,height:52,textAlign:"center"}}/>
```

- [ ] **Step 2: Verificar que o build passa**

Run: `cd /Users/alexborges/financeiroop && npm run build`
Expected: build finaliza sem erro

- [ ] **Step 3: Commit**

```bash
git add src/main.jsx
git commit -m "fix: corrige colagem de valor monetário no Encerramento de Contrato"
```

---

## Task 6: `QuitacaoAntecipadaModal` — Desconto (R$)

**Files:**
- Modify: `src/main.jsx:1932`

**Interfaces:**
- Consumes: `pasteMoeda` de Task 1.
- Nota: o campo de percentual (`pct`, linha 1930, logo acima) **não** recebe `onPaste` — fora de escopo.

- [ ] **Step 1: Adicionar `onPaste` só no campo de R$**

Old string:
```js
                  <input type="number" value={desconto} onChange={e=>onChangeDescR(e.target.value)} placeholder="0.00" min="0" style={{...IS(),flex:1,minWidth:100}}/>
```

New string:
```js
                  <input type="number" value={desconto} onChange={e=>onChangeDescR(e.target.value)} onPaste={e=>pasteMoeda(e,onChangeDescR)} placeholder="0.00" min="0" style={{...IS(),flex:1,minWidth:100}}/>
```

- [ ] **Step 2: Verificar que o build passa**

Run: `cd /Users/alexborges/financeiroop && npm run build`
Expected: build finaliza sem erro

- [ ] **Step 3: Commit**

```bash
git add src/main.jsx
git commit -m "fix: corrige colagem de valor monetário no desconto da Quitação Antecipada"
```

---

## Task 7: Módulo Judicial — `AjuizarModal`, `AcordoJudicialModal`, `QuitacaoJudicialModal`

**Files:**
- Modify: `src/main.jsx:2079` (AjuizarModal, adicionar `setF`) e `:2102` (VALOR_EXECUTADO)
- Modify: `src/main.jsx:2137` (AcordoJudicialModal, adicionar `setF`) e `:2167,2168,2169,2170,2175,2183` (valorOriginal, saldoAtualizado, valorNegociado, entrada, honorarios, custas)
- Modify: `src/main.jsx:2212` (QuitacaoJudicialModal, adicionar `setF`) e `:2233,2240,2248` (valorRecebido, honorarios, custas)

**Interfaces:**
- Consumes: `pasteMoeda` de Task 1.
- Padrão comum aos 3 modais: cada um já tem `const set=f=>e=>setDados(p=>({...p,[f]:e.target.value}));`. Adicionamos ao lado `const setF=f=>v=>setDados(p=>({...p,[f]:v}));` — uma versão que recebe o valor já pronto (usada pelo `pasteMoeda`) em vez do evento.

- [ ] **Step 1: `AjuizarModal` — adicionar `setF` e aplicar em `VALOR_EXECUTADO`**

Old string:
```js
  const set=f=>e=>setDados(p=>({...p,[f]:e.target.value}));
  const salvar=async()=>{
    if(!dados.NUMERO_PROCESSO.trim()&&!dados.DATA_AJUIZAMENTO){setErro("Número do processo ou data de ajuizamento é obrigatório.");return;}
```

New string:
```js
  const set=f=>e=>setDados(p=>({...p,[f]:e.target.value}));
  const setF=f=>v=>setDados(p=>({...p,[f]:v}));
  const salvar=async()=>{
    if(!dados.NUMERO_PROCESSO.trim()&&!dados.DATA_AJUIZAMENTO){setErro("Número do processo ou data de ajuizamento é obrigatório.");return;}
```

Old string:
```js
            <div><span style={LS()}>Valor Executado (R$)</span><input type="number" value={dados.VALOR_EXECUTADO} onChange={set("VALOR_EXECUTADO")} placeholder="0.00" style={IS()}/></div>
```

New string:
```js
            <div><span style={LS()}>Valor Executado (R$)</span><input type="number" value={dados.VALOR_EXECUTADO} onChange={set("VALOR_EXECUTADO")} onPaste={e=>pasteMoeda(e,setF("VALOR_EXECUTADO"))} placeholder="0.00" style={IS()}/></div>
```

- [ ] **Step 2: `AcordoJudicialModal` — adicionar `setF`**

Old string:
```js
  const set=f=>e=>setDados(p=>({...p,[f]:e.target.value}));
  const ehParcelado=dados.tipo==="PARCELADO";
```

New string:
```js
  const set=f=>e=>setDados(p=>({...p,[f]:e.target.value}));
  const setF=f=>v=>setDados(p=>({...p,[f]:v}));
  const ehParcelado=dados.tipo==="PARCELADO";
```

- [ ] **Step 3: `AcordoJudicialModal` — aplicar `onPaste` em Valor Original, Saldo Atualizado, Valor Negociado e Entrada**

Old string:
```js
            <div><span style={LS()}>Valor Original (R$)</span><input type="number" value={dados.valorOriginal} onChange={set("valorOriginal")} style={IS()}/></div>
            <div><span style={LS()}>Saldo Atualizado (R$)</span><input type="number" value={dados.saldoAtualizado} onChange={set("saldoAtualizado")} style={IS()}/></div>
            <div><span style={LS()}>Valor Negociado (R$)</span><input type="number" value={dados.valorNegociado} onChange={set("valorNegociado")} style={IS()}/></div>
            <div><span style={LS()}>Entrada (R$)</span><input type="number" value={dados.entrada} onChange={set("entrada")} placeholder="0.00" style={IS()}/></div>
```

New string:
```js
            <div><span style={LS()}>Valor Original (R$)</span><input type="number" value={dados.valorOriginal} onChange={set("valorOriginal")} onPaste={e=>pasteMoeda(e,setF("valorOriginal"))} style={IS()}/></div>
            <div><span style={LS()}>Saldo Atualizado (R$)</span><input type="number" value={dados.saldoAtualizado} onChange={set("saldoAtualizado")} onPaste={e=>pasteMoeda(e,setF("saldoAtualizado"))} style={IS()}/></div>
            <div><span style={LS()}>Valor Negociado (R$)</span><input type="number" value={dados.valorNegociado} onChange={set("valorNegociado")} onPaste={e=>pasteMoeda(e,setF("valorNegociado"))} style={IS()}/></div>
            <div><span style={LS()}>Entrada (R$)</span><input type="number" value={dados.entrada} onChange={set("entrada")} onPaste={e=>pasteMoeda(e,setF("entrada"))} placeholder="0.00" style={IS()}/></div>
```

- [ ] **Step 4: `AcordoJudicialModal` — aplicar `onPaste` em Honorários e Custas**

Old string:
```js
            <div><span style={LS()}>Honorários (R$)</span><input type="number" value={dados.honorarios} onChange={set("honorarios")} placeholder="0.00" style={IS()}/></div>
            <div><span style={LS()}>Quem Paga Honorários</span>
              <select value={dados.quemPagaHonorarios} onChange={set("quemPagaHonorarios")} style={IS()}>
                <option value="">Selecione...</option>
                <option value="DEVEDOR">Devedor (reembolso)</option>
                <option value="CREDOR">Credor (custo próprio)</option>
              </select>
            </div>
            <div><span style={LS()}>Custas (R$)</span><input type="number" value={dados.custas} onChange={set("custas")} placeholder="0.00" style={IS()}/></div>
            <div><span style={LS()}>Quem Paga Custas</span>
              <select value={dados.quemPagaCustas} onChange={set("quemPagaCustas")} style={IS()}>
                <option value="">Selecione...</option>
                <option value="DEVEDOR">Devedor (reembolso)</option>
                <option value="CREDOR">Credor (custo próprio)</option>
              </select>
            </div>
            <div style={{gridColumn:"1/-1"}}><span style={LS()}>Observações</span><input value={dados.observacoes} onChange={set("observacoes")} placeholder="Detalhes do acordo..." style={IS()}/></div>
```

New string:
```js
            <div><span style={LS()}>Honorários (R$)</span><input type="number" value={dados.honorarios} onChange={set("honorarios")} onPaste={e=>pasteMoeda(e,setF("honorarios"))} placeholder="0.00" style={IS()}/></div>
            <div><span style={LS()}>Quem Paga Honorários</span>
              <select value={dados.quemPagaHonorarios} onChange={set("quemPagaHonorarios")} style={IS()}>
                <option value="">Selecione...</option>
                <option value="DEVEDOR">Devedor (reembolso)</option>
                <option value="CREDOR">Credor (custo próprio)</option>
              </select>
            </div>
            <div><span style={LS()}>Custas (R$)</span><input type="number" value={dados.custas} onChange={set("custas")} onPaste={e=>pasteMoeda(e,setF("custas"))} placeholder="0.00" style={IS()}/></div>
            <div><span style={LS()}>Quem Paga Custas</span>
              <select value={dados.quemPagaCustas} onChange={set("quemPagaCustas")} style={IS()}>
                <option value="">Selecione...</option>
                <option value="DEVEDOR">Devedor (reembolso)</option>
                <option value="CREDOR">Credor (custo próprio)</option>
              </select>
            </div>
            <div style={{gridColumn:"1/-1"}}><span style={LS()}>Observações</span><input value={dados.observacoes} onChange={set("observacoes")} placeholder="Detalhes do acordo..." style={IS()}/></div>
```

- [ ] **Step 5: `QuitacaoJudicialModal` — adicionar `setF`**

Old string:
```js
  const set=f=>e=>setDados(p=>({...p,[f]:e.target.value}));
  const salvar=async()=>{
    if(!dados.valorRecebido||parseFloat(dados.valorRecebido)<=0){setErro("Informe o valor recebido.");return;}
```

New string:
```js
  const set=f=>e=>setDados(p=>({...p,[f]:e.target.value}));
  const setF=f=>v=>setDados(p=>({...p,[f]:v}));
  const salvar=async()=>{
    if(!dados.valorRecebido||parseFloat(dados.valorRecebido)<=0){setErro("Informe o valor recebido.");return;}
```

- [ ] **Step 6: `QuitacaoJudicialModal` — aplicar `onPaste` em Valor Recebido, Honorários e Custas**

Old string:
```js
            <div style={{gridColumn:"1/-1"}}><span style={LS()}>Valor Recebido (R$)</span><input type="number" value={dados.valorRecebido} onChange={set("valorRecebido")} style={IS()}/></div>
```

New string:
```js
            <div style={{gridColumn:"1/-1"}}><span style={LS()}>Valor Recebido (R$)</span><input type="number" value={dados.valorRecebido} onChange={set("valorRecebido")} onPaste={e=>pasteMoeda(e,setF("valorRecebido"))} style={IS()}/></div>
```

Old string:
```js
            <div><span style={LS()}>Honorários (R$)</span><input type="number" value={dados.honorarios} onChange={set("honorarios")} placeholder="0.00" style={IS()}/></div>
            <div><span style={LS()}>Quem Paga Honorários</span>
              <select value={dados.quemPagaHonorarios} onChange={set("quemPagaHonorarios")} style={IS()}>
                <option value="">Selecione...</option>
                <option value="DEVEDOR">Devedor (reembolso)</option>
                <option value="CREDOR">Credor (custo próprio)</option>
              </select>
            </div>
            <div><span style={LS()}>Custas (R$)</span><input type="number" value={dados.custas} onChange={set("custas")} placeholder="0.00" style={IS()}/></div>
            <div><span style={LS()}>Quem Paga Custas</span>
              <select value={dados.quemPagaCustas} onChange={set("quemPagaCustas")} style={IS()}>
                <option value="">Selecione...</option>
                <option value="DEVEDOR">Devedor (reembolso)</option>
                <option value="CREDOR">Credor (custo próprio)</option>
              </select>
            </div>
            <div style={{gridColumn:"1/-1"}}><span style={LS()}>Observação</span><input value={dados.observacao} onChange={set("observacao")} placeholder="Detalhes da quitação..." style={IS()}/></div>
```

New string:
```js
            <div><span style={LS()}>Honorários (R$)</span><input type="number" value={dados.honorarios} onChange={set("honorarios")} onPaste={e=>pasteMoeda(e,setF("honorarios"))} placeholder="0.00" style={IS()}/></div>
            <div><span style={LS()}>Quem Paga Honorários</span>
              <select value={dados.quemPagaHonorarios} onChange={set("quemPagaHonorarios")} style={IS()}>
                <option value="">Selecione...</option>
                <option value="DEVEDOR">Devedor (reembolso)</option>
                <option value="CREDOR">Credor (custo próprio)</option>
              </select>
            </div>
            <div><span style={LS()}>Custas (R$)</span><input type="number" value={dados.custas} onChange={set("custas")} onPaste={e=>pasteMoeda(e,setF("custas"))} placeholder="0.00" style={IS()}/></div>
            <div><span style={LS()}>Quem Paga Custas</span>
              <select value={dados.quemPagaCustas} onChange={set("quemPagaCustas")} style={IS()}>
                <option value="">Selecione...</option>
                <option value="DEVEDOR">Devedor (reembolso)</option>
                <option value="CREDOR">Credor (custo próprio)</option>
              </select>
            </div>
            <div style={{gridColumn:"1/-1"}}><span style={LS()}>Observação</span><input value={dados.observacao} onChange={set("observacao")} placeholder="Detalhes da quitação..." style={IS()}/></div>
```

- [ ] **Step 7: Verificar que o build passa**

Run: `cd /Users/alexborges/financeiroop && npm run build`
Expected: build finaliza sem erro

- [ ] **Step 8: Commit**

```bash
git add src/main.jsx
git commit -m "fix: corrige colagem de valor monetário no módulo de Recuperação Judicial"
```

---

## Task 8: `RenegociacaoModal` — Valor por parcela

**Files:**
- Modify: `src/main.jsx:2465`

**Interfaces:**
- Consumes: `pasteMoeda` de Task 1.

- [ ] **Step 1: Adicionar `onPaste`**

Old string:
```js
                <input type="number" value={novaValorParcela} onChange={e=>setNovaValorParcela(e.target.value)} placeholder="0,00" min="0" step="0.01" style={IS()}/>
```

New string:
```js
                <input type="number" value={novaValorParcela} onChange={e=>setNovaValorParcela(e.target.value)} onPaste={e=>pasteMoeda(e,setNovaValorParcela)} placeholder="0,00" min="0" step="0.01" style={IS()}/>
```

- [ ] **Step 2: Verificar que o build passa**

Run: `cd /Users/alexborges/financeiroop && npm run build`
Expected: build finaliza sem erro

- [ ] **Step 3: Commit**

```bash
git add src/main.jsx
git commit -m "fix: corrige colagem de valor monetário na Renegociação"
```

---

## Task 9: `RecuperacaoModal` — Valor Recebido

**Files:**
- Modify: `src/main.jsx:2585`

**Interfaces:**
- Consumes: `pasteMoeda` de Task 1.

- [ ] **Step 1: Adicionar `onPaste`**

Old string:
```js
            <input type="number" value={valor} onChange={e=>setValor(e.target.value)} placeholder="0,00" style={{...IS(),fontSize:22,fontWeight:800,textAlign:"center",height:54}}/>
```

New string:
```js
            <input type="number" value={valor} onChange={e=>setValor(e.target.value)} onPaste={e=>pasteMoeda(e,setValor)} placeholder="0,00" style={{...IS(),fontSize:22,fontWeight:800,textAlign:"center",height:54}}/>
```

- [ ] **Step 2: Verificar que o build passa**

Run: `cd /Users/alexborges/financeiroop && npm run build`
Expected: build finaliza sem erro

- [ ] **Step 3: Commit**

```bash
git add src/main.jsx
git commit -m "fix: corrige colagem de valor monetário na Recuperação Após Baixa"
```

---

## Task 10: `PagamentoDrop` (Dashboard) — Valor, Desconto e Abatimento

**Files:**
- Modify: `src/main.jsx:3387,3390,3433`

**Interfaces:**
- Consumes: `pasteMoeda` de Task 1.

- [ ] **Step 1: Campo "Valor"**

Old string:
```js
          <div><span style={LS()}>Valor</span><input type="number" value={valor} onChange={e=>setValor(e.target.value)} style={IS()}/></div>
```

New string:
```js
          <div><span style={LS()}>Valor</span><input type="number" value={valor} onChange={e=>setValor(e.target.value)} onPaste={e=>pasteMoeda(e,setValor)} style={IS()}/></div>
```

- [ ] **Step 2: Campo "Desconto nos Juros (R$)"**

Old string:
```js
            <input type="number" value={desconto||""} onChange={e=>changeDescontoDrop(e.target.value)} placeholder="0,00" min="0" max={parseFloat(parcela?.VALOR_JUROS||0)} style={{...IS(),color:desconto>0?GRN:TEXT}}/>
```

New string:
```js
            <input type="number" value={desconto||""} onChange={e=>changeDescontoDrop(e.target.value)} onPaste={e=>pasteMoeda(e,changeDescontoDrop)} placeholder="0,00" min="0" max={parseFloat(parcela?.VALOR_JUROS||0)} style={{...IS(),color:desconto>0?GRN:TEXT}}/>
```

- [ ] **Step 3: Campo "Valor do abatimento (R$)"**

Old string:
```js
            <div><span style={LS()}>Valor do abatimento (R$)</span><input type="number" value={abatValor} onChange={e=>setAbatValor(e.target.value)} placeholder="0,00" min="0" style={IS()}/></div>
```

New string:
```js
            <div><span style={LS()}>Valor do abatimento (R$)</span><input type="number" value={abatValor} onChange={e=>setAbatValor(e.target.value)} onPaste={e=>pasteMoeda(e,setAbatValor)} placeholder="0,00" min="0" style={IS()}/></div>
```

- [ ] **Step 4: Verificar que o build passa**

Run: `cd /Users/alexborges/financeiroop && npm run build`
Expected: build finaliza sem erro

- [ ] **Step 5: Commit**

```bash
git add src/main.jsx
git commit -m "fix: corrige colagem de valor monetário no PagamentoDrop (Dashboard)"
```

---

## Task 11: `PagamentoParcelaModal` (ContratoModal) — Valor e Desconto

**Files:**
- Modify: `src/main.jsx:3498,3505`

**Interfaces:**
- Consumes: `pasteMoeda` de Task 1.

- [ ] **Step 1: Campo "Valor"**

Old string:
```js
          <div><span style={LS()}>Valor</span><input type="number" value={valor} onChange={e=>setValor(e.target.value)} style={IS()}/></div>
```

New string:
```js
          <div><span style={LS()}>Valor</span><input type="number" value={valor} onChange={e=>setValor(e.target.value)} onPaste={e=>pasteMoeda(e,setValor)} style={IS()}/></div>
```

- [ ] **Step 2: Campo "Desconto nos Juros (R$)"**

Old string:
```js
              <input type="number" value={desconto||""} onChange={e=>changeDescontoPPM(e.target.value)} placeholder="0,00" min="0" max={parseFloat(parcela?.VALOR_JUROS||0)} style={{...IS(),color:desconto>0?GRN:TEXT}}/>
```

New string:
```js
              <input type="number" value={desconto||""} onChange={e=>changeDescontoPPM(e.target.value)} onPaste={e=>pasteMoeda(e,changeDescontoPPM)} placeholder="0,00" min="0" max={parseFloat(parcela?.VALOR_JUROS||0)} style={{...IS(),color:desconto>0?GRN:TEXT}}/>
```

- [ ] **Step 3: Verificar que o build passa**

Run: `cd /Users/alexborges/financeiroop && npm run build`
Expected: build finaliza sem erro

- [ ] **Step 4: Commit**

```bash
git add src/main.jsx
git commit -m "fix: corrige colagem de valor monetário no pagamento de parcela (ContratoModal)"
```

---

## Task 12: `NovoContrato` — Principal

**Files:**
- Modify: `src/main.jsx:3653`

**Interfaces:**
- Consumes: `pasteMoeda` de Task 1.

- [ ] **Step 1: Adicionar `onPaste`**

Old string:
```js
          <div><span style={LS()}>Principal</span><input type="number" value={principal} onChange={e=>setPrincipal(e.target.value)} placeholder="0.00" style={IS()}/></div>
```

New string:
```js
          <div><span style={LS()}>Principal</span><input type="number" value={principal} onChange={e=>setPrincipal(e.target.value)} onPaste={e=>pasteMoeda(e,setPrincipal)} placeholder="0.00" style={IS()}/></div>
```

- [ ] **Step 2: Verificar que o build passa**

Run: `cd /Users/alexborges/financeiroop && npm run build`
Expected: build finaliza sem erro

- [ ] **Step 3: Commit**

```bash
git add src/main.jsx
git commit -m "fix: corrige colagem de valor monetário no Principal do Novo Contrato"
```

---

## Task 13: `NovaPromessaModal` — Valor Prometido

**Files:**
- Modify: `src/main.jsx:4407`

**Interfaces:**
- Consumes: `pasteMoeda` de Task 1.

- [ ] **Step 1: Adicionar `onPaste`**

Old string:
```js
            <div><span style={LS()}>Valor Prometido (R$)</span><input type="number" value={valorPrometido} onChange={e=>setValorPrometido(e.target.value)} placeholder="0.00" style={IS()}/></div>
```

New string:
```js
            <div><span style={LS()}>Valor Prometido (R$)</span><input type="number" value={valorPrometido} onChange={e=>setValorPrometido(e.target.value)} onPaste={e=>pasteMoeda(e,setValorPrometido)} placeholder="0.00" style={IS()}/></div>
```

- [ ] **Step 2: Verificar que o build passa**

Run: `cd /Users/alexborges/financeiroop && npm run build`
Expected: build finaliza sem erro

- [ ] **Step 3: Commit**

```bash
git add src/main.jsx
git commit -m "fix: corrige colagem de valor monetário em Nova Promessa"
```

---

## Task 14: Review, Deploy e Verificação Manual

**Files:** nenhum (tarefa de verificação/deploy)

**Interfaces:** nenhuma — tarefa final, consome o resultado de todas as anteriores.

- [ ] **Step 1: Confirmar que todos os campos monetários planejados foram cobertos**

Run: `grep -n 'type="number"' /Users/alexborges/financeiroop/src/main.jsx | grep -v 'onPaste'`
Expected: só aparecem os campos fora de escopo (percentual/quantidade): `pct` (linha ~1930), `Qtd. Parcelas` (~2172), `novasParcelasQtd` (~2469), `nParcelas` (~3654), `Taxa Mensal (%)` (~3655), e o slider de configuração (~4994). Se aparecer qualquer outro campo com label "(R$)" na lista, voltar e aplicar o mesmo padrão de `onPaste` antes de prosseguir.

- [ ] **Step 2: Rodar a skill de review Tier 2**

Invocar a skill `review` (conforme `CLAUDE.md`: "Lógica frontend, novo componente" → Tier 2). Corrigir qualquer item CRÍTICO ou BLOQUEANTE antes de seguir.

- [ ] **Step 3: Deploy**

Run: `cd /Users/alexborges/financeiroop && vercel deploy --prod`
Expected: deploy concluído com URL de produção.

- [ ] **Step 4: Teste manual no navegador — colar valor BR em 3 campos de telas diferentes**

Usando a skill `browser`, abrir o app em produção e, em cada um dos 3 campos abaixo, colar o texto `2.000,00` (via clipboard ou digitação simulando colagem) e confirmar que o campo mostra `2000`:
- ClienteModal → aba Editar → "Renda Mensal Operacional (R$)"
- Novo Contrato → campo "Principal" (após selecionar um cliente)
- Dashboard → abrir uma parcela em atraso → PagamentoDrop → campo "Valor"

Confirmar também:
- Digitar um valor manualmente (ex: `1500.50`) em qualquer um desses campos continua funcionando normalmente.
- Colar um número simples sem separador (ex: `500`) não muda de comportamento.
- Sem erros no console do navegador.

- [ ] **Step 5: Atualizar `CLAUDE.md` (opcional, só se algo inesperado foi descoberto)**

Se o teste manual revelar um campo monetário fora da lista original, documentar em `CLAUDE.md` seção "Bugs conhecidos" e em `docs/ai-memory/07-AI-KNOWN-ISSUES.md`, e criar uma tarefa de correção adicional antes de considerar o trabalho concluído.
