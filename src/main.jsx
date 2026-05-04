import React, { useState, useMemo, useEffect, useRef } from "react";
import { createRoot } from "react-dom/client";
import { LineChart, Line, BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, CartesianGrid } from "recharts";

const API_URL  = "/api/sheets";
const POST_URL = "/api/action";

const BG   = "#F5F6FA", CARD = "#FFFFFF", BD = "#E5E7EB";
const TEXT = "#111827", MUTED = "#6B7280";
const GRN  = "#10B981", RED = "#EF4444", BLU = "#3B82F6";
const YEL  = "#F59E0B", PUR = "#8B5CF6", ORG = "#F97316";
const SW   = 220;

const fmtR  = v => "R$ " + Number(v||0).toLocaleString("pt-BR",{minimumFractionDigits:2,maximumFractionDigits:2});
const fmtP  = v => Number(v||0).toFixed(1) + "%";
const fmtDt = v => { if(!v) return "—"; const d = v instanceof Date ? v : new Date(v); return isNaN(d.getTime()) ? "—" : d.toLocaleDateString("pt-BR"); };
const hojeStr = () => new Date().toISOString().split("T")[0];
const limparData = v => { if(!v) return ""; const s=String(v).trim(); return s.includes("T") ? s.split("T")[0] : s; };
function parseDate(v){
  if(!v) return null;
  if(v instanceof Date) return v;
  
  let d;
  if(typeof v === "string"){
    const s = v.trim();
    if(s.includes("/")){
      const [dia,mes,ano] = s.split("/");
      d = new Date(parseInt(ano), parseInt(mes)-1, parseInt(dia), 12, 0, 0);
    } else if(s.includes("-")){
      const [ano,mes,dia] = s.split("T")[0].split("-");
      d = new Date(parseInt(ano), parseInt(mes)-1, parseInt(dia), 12, 0, 0);
    } else {
      d = new Date(v);
    }
  } else {
    d = new Date(v);
  }

  if(isNaN(d.getTime())) return null;
  d.setHours(12,0,0,0);
  return d;
}

// Helper infalível para comparação de datas (YYYYMMDD)
function toNum(d){
  if(!d) return 0;
  const dt = d instanceof Date ? d : parseDate(d);
  if(!dt) return 0;
  return dt.getFullYear() * 10000 + (dt.getMonth() + 1) * 100 + dt.getDate();
}
async function postAction(body){ const r=await fetch(POST_URL,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(body)}); return r.json(); }

function vLetras(v){ return v&&/[^a-zA-ZÀ-ÿ\s]/.test(v)?"⚠ Somente letras":null; }
function vNums(v){   return v&&/[^\d]/.test(v)?"⚠ Somente números":null; }
function vEmail(v){ if(!v)return null; if(/[A-Z]/.test(v))return"⚠ Minúsculas"; if(!/^[^@]+@[^@]+\.[^@]+$/.test(v))return"⚠ Formato inválido"; return null; }
function vNumEnd(v){ if(!v)return null; const l=v.toLowerCase().trim(); if(l==="sem numero"||l==="s/n"||l==="sn")return null; return/[^\d]/.test(v)?"⚠ Somente números":null; }

const IS = {width:"100%",padding:"9px 12px",background:CARD,border:`1px solid ${BD}`,borderRadius:7,color:TEXT,fontSize:13,boxSizing:"border-box"};
const IW = {...IS,border:`1px solid ${YEL}`,background:"#FFFBEB"};
const LS = {color:MUTED,fontSize:11,fontWeight:600,textTransform:"uppercase",letterSpacing:"0.05em",display:"block",marginBottom:4};
const WS = {color:YEL,fontSize:11,display:"block",marginTop:3};
const SEC= {fontSize:11,fontWeight:700,color:BLU,textTransform:"uppercase",margin:"16px 0 8px",borderBottom:`1px solid ${BD}`,paddingBottom:4};

// STATUS helpers
const STATUS_LABEL = {
  ativo_em_dia:"Em Dia", ativo_em_atraso:"Em Atraso", em_cobranca:"Em Cobrança",
  pre_prejuizo:"Pré-Prejuízo", baixado_como_prejuizo:"Baixado (Prejuízo)",
  em_recuperacao:"Em Recuperação", recuperado_parcialmente:"Rec. Parcial",
  recuperado_integralmente:"Recuperado", encerrado_sem_recuperacao:"Encerrado s/ Rec.",
  renegociado:"Renegociado", quitado:"Quitado", cancelado:"Cancelado", ativo:"Ativo"
};
const STATUS_COR = {
  ativo_em_dia:GRN, ativo:GRN, ativo_em_atraso:YEL, em_cobranca:ORG,
  pre_prejuizo:"#DC2626", baixado_como_prejuizo:RED, em_recuperacao:PUR,
  recuperado_parcialmente:BLU, recuperado_integralmente:GRN,
  encerrado_sem_recuperacao:MUTED, renegociado:"#0891B2", quitado:GRN, cancelado:MUTED
};
const STATUS_PERDA = ["em_cobranca","pre_prejuizo","baixado_como_prejuizo","em_recuperacao","recuperado_parcialmente","encerrado_sem_recuperacao"];

const Ico = {
  dash:  <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/></svg>,
  cli:   <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="9" cy="7" r="4"/><path d="M3 21v-2a4 4 0 0 1 4-4h4a4 4 0 0 1 4 4v2"/></svg>,
  ctr:   <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14,2 14,8 20,8"/></svg>,
  pag:   <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="2" y="5" width="20" height="14" rx="2"/><line x1="2" y1="10" x2="22" y2="10"/></svg>,
  cob:   <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07A19.5 19.5 0 0 1 4.19 12"/></svg>,
  fin:   <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>,
  loss:  <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>,
  novo:  <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="16"/><line x1="8" y1="12" x2="16" y2="12"/></svg>,
  kpi:   <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/></svg>,
  rel:   <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="22,12 18,12 15,21 9,3 6,12 2,12"/></svg>,
  sim:   <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/></svg>,
  bell:  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/></svg>,
  srch:  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke={MUTED} strokeWidth="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>,
  help:  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"/></svg>,
  arr:   <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="9,18 15,12 9,6"/></svg>,
  ref:   <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="23,4 23,10 17,10"/><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"/></svg>,
};

function Badge({c,children}){ return <span style={{display:"inline-flex",alignItems:"center",padding:"3px 8px",borderRadius:20,fontSize:10,fontWeight:600,background:c+"18",color:c,border:`1px solid ${c}30`}}>{children}</span>; }

// ── MODAL BAIXA COMO PREJUÍZO ──────────────────────────────────────
function BaixaModal({contrato, parcelas, pagamentos, onConfirmar, onFechar}){
  const [dados, setDados] = useState({
    substatus:"CLIENTE_DESAPARECIDO", motivo:"", observacao:"",
    possibilidadeRecuperacao:"BAIXA", statusJuridico:"NAO_ANALISADO", proximaProvidencia:""
  });
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState(null);

  const ps = parcelas.filter(p=>String(p.ID_CONTRATO)===String(contrato.ID_CONTRATO));
  const pgs = pagamentos.filter(p=>String(p.ID_CONTRATO)===String(contrato.ID_CONTRATO));

  const valPrincipal   = parseFloat(contrato.VALOR_PRINCIPAL||0);
  const valTotal       = parseFloat(contrato.VALOR_TOTAL||0);
  const totalPago      = pgs.reduce((s,p)=>s+(parseFloat(p.VALOR_PAGO)||0),0);
  const jurosRecebidos = pgs.reduce((s,p)=>s+(parseFloat(p.RECEITA_EXTRA_ATRASO)||0),0);
  const capitalRecuperado = Math.min(totalPago, valPrincipal);
  const prejuizoCapital   = Math.max(0, valPrincipal - capitalRecuperado);
  const jurosNaoReal      = Math.max(0, (valTotal - valPrincipal) - jurosRecebidos);
  const pctRecuperado     = valPrincipal>0 ? (capitalRecuperado/valPrincipal*100) : 0;
  const diasAtraso        = ps.filter(p=>p.STATUS==="atrasado").length > 0
    ? Math.max(...ps.filter(p=>p.STATUS==="atrasado").map(p=>{ const dv=parseDate(p.DATA_VENCIMENTO); if(!dv)return 0; const d=Math.round((new Date()-dv)/86400000); return d>0?d:0; }))
    : 0;

  const confirmar = async () => {
    if (!dados.motivo){ setMsg({ok:false,texto:"Informe o motivo da baixa."}); return; }
    setLoading(true); setMsg(null);
    const res = await postAction({
      action:"baixarContrato", idContrato: contrato.ID_CONTRATO,
      dados:{ ...dados, diasAtraso, valorRecuperadoAntesBaixa: capitalRecuperado, jurosJaRecebidos: jurosRecebidos, data: hojeStr() }
    });
    if(res.ok){ onConfirmar(); }
    else setMsg({ok:false, texto: res.erro||"Erro."});
    setLoading(false);
  };

  const campo = (label, field, options) => (
    <div>
      <span style={LS}>{label}</span>
      {options
        ? <select value={dados[field]} onChange={e=>setDados(p=>({...p,[field]:e.target.value}))} style={IS}>{options.map(o=><option key={o.v} value={o.v}>{o.l}</option>)}</select>
        : <input value={dados[field]} onChange={e=>setDados(p=>({...p,[field]:e.target.value}))} style={IS}/>}
    </div>
  );

  return (
    <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.5)",zIndex:400,display:"flex",alignItems:"center",justifyContent:"center",padding:20}}>
      <div style={{background:CARD,borderRadius:12,width:"100%",maxWidth:600,maxHeight:"90vh",display:"flex",flexDirection:"column",boxShadow:"0 20px 60px rgba(0,0,0,0.2)"}}>
        <div style={{padding:"20px 24px 14px",borderBottom:`1px solid ${BD}`,background:"#FEF2F2",borderRadius:"12px 12px 0 0"}}>
          <h2 style={{color:RED,fontSize:17,fontWeight:700,margin:0}}>⚠️ Baixar Contrato como Prejuízo</h2>
          <p style={{color:MUTED,fontSize:12,margin:"4px 0 0"}}>{contrato.ID_CONTRATO} — {contrato.NOME_CLIENTE}</p>
        </div>
        <div style={{overflowY:"auto",padding:"0 24px",flex:1}}>
          {/* Resumo financeiro */}
          <div style={SEC}>Resumo Financeiro</div>
          <div style={{background:"#FEF2F2",border:`1px solid ${RED}30`,borderRadius:8,padding:14,marginBottom:4}}>
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8}}>
              {[
                ["Capital emprestado", fmtR(valPrincipal), TEXT],
                ["Capital recuperado", fmtR(capitalRecuperado), GRN],
                ["Prejuízo de capital", fmtR(prejuizoCapital), RED],
                ["Juros não realizados", fmtR(jurosNaoReal), ORG],
                ["Total pago", fmtR(totalPago), BLU],
                ["% Recuperado", fmtP(pctRecuperado), pctRecuperado>50?GRN:RED],
                ["Dias de atraso (máx)", diasAtraso+" dias", diasAtraso>90?RED:YEL],
              ].map(([l,v,c])=>(
                <div key={l} style={{display:"flex",justifyContent:"space-between",padding:"6px 0",borderBottom:`1px solid ${BD}`}}>
                  <span style={{color:MUTED,fontSize:12}}>{l}</span>
                  <strong style={{color:c,fontSize:12}}>{v}</strong>
                </div>
              ))}
            </div>
            <p style={{color:MUTED,fontSize:11,margin:"10px 0 0",fontStyle:"italic"}}>Esta ação remove o contrato da carteira ativa e das projeções normais, mas mantém o histórico para cobrança e recuperação futura.</p>
          </div>
          <div style={SEC}>Dados da Baixa</div>
          <div style={{display:"grid",gap:10}}>
            {campo("Substatus / Motivo Operacional", "substatus", [
              {v:"CLIENTE_DESAPARECIDO",l:"Cliente desaparecido"},
              {v:"SEM_CAPACIDADE_DE_PAGAMENTO",l:"Sem capacidade de pagamento"},
              {v:"MA_FE_APARENTE",l:"Má-fé aparente"},
              {v:"QUEBRA_RECORRENTE_DE_ACORDOS",l:"Quebra recorrente de acordos"},
              {v:"ENVIADO_AO_JURIDICO",l:"Enviado ao jurídico"},
              {v:"COBRANCA_INVIAVEL",l:"Cobrança inviável"},
              {v:"CUSTO_COBRANCA_DESPROPORCIONAL",l:"Custo de cobrança desproporcional"},
              {v:"OUTRO",l:"Outro"},
            ])}
            {campo("Motivo detalhado (obrigatório)", "motivo")}
            {campo("Possibilidade de recuperação futura", "possibilidadeRecuperacao", [
              {v:"ALTA",l:"Alta — cliente responde e demonstra intenção"},
              {v:"MEDIA",l:"Média — cliente responde ocasionalmente"},
              {v:"BAIXA",l:"Baixa — cliente pouco responsivo"},
              {v:"REMOTA",l:"Remota — cliente sumiu ou não tem condições"},
            ])}
            {campo("Status jurídico", "statusJuridico", [
              {v:"NAO_ANALISADO",l:"Não analisado"},
              {v:"EM_ANALISE",l:"Em análise"},
              {v:"NOTIFICACAO_EXTRAJUDICIAL",l:"Notificação extrajudicial"},
              {v:"NEGATIVACAO",l:"Negativação"},
              {v:"NAO_COMPENSA_JUDICIALIZAR",l:"Não compensa judicializar"},
              {v:"ACAO_COBRANCA",l:"Ação de cobrança"},
            ])}
            {campo("Próxima providência", "proximaProvidencia")}
            <div>
              <span style={LS}>Observação adicional</span>
              <textarea value={dados.observacao} onChange={e=>setDados(p=>({...p,observacao:e.target.value}))} rows={2} style={{...IS,resize:"vertical"}}/>
            </div>
          </div>
          <div style={{height:8}}/>
        </div>
        <div style={{padding:"12px 24px 20px",borderTop:`1px solid ${BD}`,flexShrink:0}}>
          {msg&&<div style={{padding:"10px 14px",borderRadius:7,background:"#FEF2F2",border:`1px solid ${RED}`,color:"#991B1B",fontSize:13,fontWeight:600,marginBottom:10}}>❌ {msg.texto}</div>}
          <div style={{display:"grid",gridTemplateColumns:"1fr 2fr",gap:10}}>
            <button onClick={onFechar} style={{padding:"10px",borderRadius:7,border:`1px solid ${BD}`,background:CARD,color:MUTED,fontWeight:600,cursor:"pointer"}}>Cancelar</button>
            <button onClick={confirmar} disabled={loading} style={{padding:"10px",borderRadius:7,border:"none",background:loading?"#FCA5A5":RED,color:"#fff",fontWeight:700,cursor:"pointer"}}>
              {loading?"Processando...":"Confirmar Baixa como Prejuízo"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── MODAL RECUPERAÇÃO APÓS BAIXA ───────────────────────────────────
function RecuperacaoModal({contrato, onConfirmar, onFechar}){
  const [valor, setValor] = useState("");
  const [data, setData]   = useState(hojeStr());
  const [forma, setForma] = useState("dinheiro");
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState(null);

  const prejAtual = parseFloat(contrato.PREJUIZO_CAPITAL||0);
  const recAtual  = parseFloat(contrato.VALOR_RECUPERADO_APOS_BAIXA||0);
  const novoPrej  = Math.max(0, prejAtual - (parseFloat(valor)||0));
  const novoRec   = recAtual + (parseFloat(valor)||0);

  const confirmar = async () => {
    if (!valor || parseFloat(valor)<=0){ setMsg({ok:false,texto:"Informe o valor recebido."}); return; }
    setLoading(true);
    const res = await postAction({action:"recuperacaoAposBaixa", idContrato:contrato.ID_CONTRATO, dados:{valorPago:parseFloat(valor),data,forma}});
    if(res.ok) onConfirmar();
    else setMsg({ok:false,texto:res.erro||"Erro."});
    setLoading(false);
  };

  return (
    <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.5)",zIndex:400,display:"flex",alignItems:"center",justifyContent:"center",padding:20}}>
      <div style={{background:CARD,borderRadius:12,width:"100%",maxWidth:480,boxShadow:"0 20px 60px rgba(0,0,0,0.2)"}}>
        <div style={{padding:"20px 24px 14px",borderBottom:`1px solid ${BD}`,background:"#ECFDF5",borderRadius:"12px 12px 0 0"}}>
          <h2 style={{color:GRN,fontSize:17,fontWeight:700,margin:0}}>💰 Registrar Recuperação</h2>
          <p style={{color:MUTED,fontSize:12,margin:"4px 0 0"}}>{contrato.ID_CONTRATO} — {contrato.NOME_CLIENTE}</p>
        </div>
        <div style={{padding:"16px 24px"}}>
          <div style={{background:BG,borderRadius:8,padding:12,marginBottom:16}}>
            {[["Prejuízo atual",fmtR(prejAtual),RED],["Recuperado até agora",fmtR(recAtual),BLU]].map(([l,v,c])=>(
              <div key={l} style={{display:"flex",justifyContent:"space-between",padding:"5px 0"}}>
                <span style={{color:MUTED,fontSize:12}}>{l}</span>
                <strong style={{color:c,fontSize:12}}>{v}</strong>
              </div>
            ))}
            {parseFloat(valor)>0&&<>
              <div style={{borderTop:`1px solid ${BD}`,marginTop:8,paddingTop:8}}>
                <div style={{display:"flex",justifyContent:"space-between"}}>
                  <span style={{color:MUTED,fontSize:12}}>Novo prejuízo após registro</span>
                  <strong style={{color:novoPrej<=0?GRN:RED,fontSize:12}}>{fmtR(novoPrej)}</strong>
                </div>
                {novoPrej<=0&&<p style={{color:GRN,fontSize:11,margin:"4px 0 0",fontWeight:600}}>✅ Contrato será marcado como RECUPERADO INTEGRALMENTE</p>}
              </div>
            </>}
          </div>
          <div style={{display:"grid",gap:10}}>
            <div><span style={LS}>Valor recebido (R$)</span><input type="number" step="0.01" min="0.01" value={valor} onChange={e=>setValor(e.target.value)} style={IS} placeholder="0,00"/></div>
            <div><span style={LS}>Data do recebimento</span><input type="date" value={data} onChange={e=>setData(e.target.value)} style={IS}/></div>
            <div><span style={LS}>Forma de pagamento</span>
              <select value={forma} onChange={e=>setForma(e.target.value)} style={IS}>
                <option value="dinheiro">Dinheiro</option>
                <option value="pix">PIX</option>
                <option value="transferencia">Transferência</option>
              </select>
            </div>
          </div>
          {msg&&<div style={{marginTop:10,padding:"10px",borderRadius:7,background:"#FEF2F2",border:`1px solid ${RED}`,color:"#991B1B",fontSize:13}}>❌ {msg.texto}</div>}
        </div>
        <div style={{padding:"0 24px 20px",display:"grid",gridTemplateColumns:"1fr 2fr",gap:10}}>
          <button onClick={onFechar} style={{padding:"10px",borderRadius:7,border:`1px solid ${BD}`,background:CARD,color:MUTED,fontWeight:600,cursor:"pointer"}}>Cancelar</button>
          <button onClick={confirmar} disabled={loading} style={{padding:"10px",borderRadius:7,border:"none",background:GRN,color:"#fff",fontWeight:700,cursor:"pointer"}}>{loading?"Registrando...":"Confirmar Recebimento"}</button>
        </div>
      </div>
    </div>
  );
}

// ── REVISÃO DE CLIENTE ─────────────────────────────────────────────
function RevisaoCliente({cliente,onAtivar,onFechar}){
  const f={nome:useRef(null),cpf:useRef(null),rg:useRef(null),nac:useRef(null),ecivil:useRef(null),prof:useRef(null),wpp:useRef(null),email:useRef(null),cep:useRef(null),rua:useRef(null),numero:useRef(null),quadra:useRef(null),lote:useRef(null),setor:useRef(null),comp:useRef(null),cidade:useRef(null),cont1:useRef(null),tel1:useRef(null),cont2:useRef(null),tel2:useRef(null),diavenc:useRef(null),padrinho:useRef(null),telpad:useRef(null),obs:useRef(null)};
  const cliMap={nome:"NOME",cpf:"CPF",rg:"RG",nac:"NACIONALIDADE",ecivil:"ESTADO_CIVIL",prof:"PROFISSAO",wpp:"TELEFONE_WPP",email:"EMAIL",cep:"CEP",rua:"RUA",numero:"NUMERO",quadra:"QUADRA",lote:"LOTE",setor:"SETOR",comp:"COMPLEMENTO",cidade:"CIDADE_ESTADO",cont1:"CONTATO_CONFIANCA_1",tel1:"TEL_CONFIANCA_1",cont2:"CONTATO_CONFIANCA_2",tel2:"TEL_CONFIANCA_2",diavenc:"DIA_VENCIMENTO_PREFERIDO",padrinho:"PADRINHO",telpad:"TEL_PADRINHO",obs:"OBSERVACOES"};
  const [al,setAl]=useState({});const [salvando,setSalvando]=useState(false);const [msg,setMsg]=useState(null);
  function blur(k,fn){const v=f[k].current?.value||"";const e=fn?fn(v):null;setAl(p=>p[k]===e?p:{...p,[k]:e});}
  const totalAl=Object.values(al).filter(Boolean).length;
  async function salvarEAtivar(){
    setSalvando(true);setMsg(null);
    const fns={nome:vLetras,cpf:vNums,rg:vNums,prof:vLetras,wpp:vNums,email:vEmail,cep:vNums,numero:vNumEnd,cont1:vLetras,tel1:vNums,cont2:vLetras,tel2:vNums,padrinho:vLetras,telpad:vNums};
    const na={};Object.keys(fns).forEach(k=>{na[k]=fns[k](f[k].current?.value||"");});setAl(na);
    if(Object.values(na).some(Boolean)){setMsg({ok:false,texto:"Corrija os campos."});setSalvando(false);return;}
    const campos={};Object.keys(cliMap).forEach(k=>{campos[cliMap[k]]=f[k].current?.value||"";});campos.STATUS_CLIENTE="ativo";
    const res=await postAction({action:"atualizarCliente",idCliente:cliente.ID_CLIENTE,campos});
    if(res.ok){setMsg({ok:true,texto:"Ativado!"});setTimeout(onAtivar,1000);}
    else setMsg({ok:false,texto:res.erro||"Erro."});
    setSalvando(false);
  }
  function Inp({label,rk,fn,type,ph}){const e=al[rk];const dv=rk==="diavenc"?limparData(cliente[cliMap[rk]]):String(cliente[cliMap[rk]]||"");return(<div><span style={LS}>{label}</span><input ref={f[rk]} type={type||"text"} defaultValue={dv} onBlur={fn?()=>blur(rk,fn):undefined} placeholder={ph||""} style={e?IW:IS}/>{e&&<span style={WS}>{e}</span>}</div>);}
  function IP({label,rk,type,ph}){const dv=rk==="diavenc"?limparData(cliente[cliMap[rk]]):String(cliente[cliMap[rk]]||"");return(<div><span style={LS}>{label}</span><input ref={f[rk]} type={type||"text"} defaultValue={dv} placeholder={ph||""} style={IS}/></div>);}
  return(
    <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.4)",zIndex:300,display:"flex",alignItems:"flex-start",justifyContent:"center",padding:20}}>
      <div style={{background:CARD,borderRadius:12,width:"100%",maxWidth:660,display:"flex",flexDirection:"column",maxHeight:"calc(100vh - 40px)",boxShadow:"0 20px 60px rgba(0,0,0,0.15)"}}>
        <div style={{padding:"20px 24px 12px",borderBottom:`1px solid ${BD}`,flexShrink:0}}>
          <div style={{display:"flex",justifyContent:"space-between"}}><div><h2 style={{color:TEXT,fontSize:17,fontWeight:700,margin:0}}>Revisão de Cadastro</h2><p style={{color:MUTED,fontSize:12,margin:"3px 0 0"}}>ID {cliente.ID_CLIENTE}</p></div><button onClick={onFechar} style={{background:"none",border:"none",color:MUTED,fontSize:20,cursor:"pointer"}}>✕</button></div>
          {totalAl>0&&<div style={{background:"#FFFBEB",border:`1px solid ${YEL}`,borderRadius:7,padding:"8px 12px",marginTop:10}}><p style={{color:"#92400E",fontWeight:600,fontSize:12,margin:0}}>⚠️ {totalAl} campo(s) com erro</p></div>}
        </div>
        <div style={{overflowY:"auto",padding:"0 24px",flex:1}}>
          <div style={SEC}>Dados Pessoais</div>
          <div style={{display:"grid",gap:10}}>
            <Inp label="Nome completo" rk="nome" fn={vLetras}/>
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10}}><Inp label="CPF" rk="cpf" fn={vNums}/><Inp label="RG" rk="rg" fn={vNums}/></div>
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10}}><IP label="Nacionalidade" rk="nac"/><IP label="Estado civil" rk="ecivil"/></div>
            <Inp label="Profissão" rk="prof" fn={vLetras}/>
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10}}><Inp label="WhatsApp" rk="wpp" fn={vNums}/><Inp label="E-mail" rk="email" fn={vEmail} type="email"/></div>
          </div>
          <div style={SEC}>Endereço</div>
          <div style={{display:"grid",gap:10}}>
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:10}}><Inp label="CEP" rk="cep" fn={vNums}/><Inp label="Número" rk="numero" fn={vNumEnd}/><IP label="Complemento" rk="comp"/></div>
            <IP label="Rua / Avenida" rk="rua"/>
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:10}}><IP label="Quadra" rk="quadra"/><IP label="Lote" rk="lote"/><IP label="Setor / Bairro" rk="setor"/></div>
            <IP label="Cidade - Estado" rk="cidade"/>
          </div>
          <div style={SEC}>Contatos</div>
          <div style={{display:"grid",gap:10}}>
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10}}><Inp label="Contato 1 — Nome" rk="cont1" fn={vLetras}/><Inp label="Contato 1 — Tel" rk="tel1" fn={vNums}/></div>
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10}}><Inp label="Contato 2 — Nome" rk="cont2" fn={vLetras}/><Inp label="Contato 2 — Tel" rk="tel2" fn={vNums}/></div>
          </div>
          <div style={SEC}>Padrinho e Vencimento</div>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:10}}><Inp label="Padrinho" rk="padrinho" fn={vLetras}/><Inp label="Tel Padrinho" rk="telpad" fn={vNums}/><IP label="Data 1ª parcela" rk="diavenc" type="date"/></div>
          <div style={SEC}>Observações</div>
          <textarea ref={f.obs} defaultValue={String(cliente.OBSERVACOES||"")} rows={2} style={{...IS,resize:"vertical"}}/>
          <div style={{height:8}}/>
        </div>
        <div style={{padding:"12px 24px 20px",borderTop:`1px solid ${BD}`,flexShrink:0}}>
          {msg&&<div style={{padding:"10px 14px",borderRadius:7,background:msg.ok?"#ECFDF5":"#FEF2F2",border:`1px solid ${msg.ok?GRN:RED}`,color:msg.ok?"#065F46":"#991B1B",fontSize:13,fontWeight:600,marginBottom:10}}>{msg.ok?"✅ ":"❌ "}{msg.texto}</div>}
          <div style={{display:"grid",gridTemplateColumns:"1fr 2fr",gap:10}}>
            <button onClick={onFechar} style={{padding:"10px",borderRadius:7,border:`1px solid ${BD}`,background:CARD,color:MUTED,fontWeight:600,cursor:"pointer"}}>Cancelar</button>
            <button onClick={salvarEAtivar} disabled={salvando} style={{padding:"10px",borderRadius:7,border:"none",background:GRN,color:"#fff",fontWeight:700,cursor:"pointer"}}>{salvando?"Salvando...":"✅ Salvar e Ativar"}</button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── REGISTRAR PAGAMENTO ────────────────────────────────────────────
function RegistrarPagamento({clientes,parcelas,onSucesso}){
  const [busca,setBusca]=useState("");const [showDrop,setShowDrop]=useState(false);const [cliente,setCliente]=useState(null);const [parcela,setParcela]=useState(null);const [tipo,setTipo]=useState(null);const [data,setData]=useState(hojeStr());const [valor,setValor]=useState("");const [loading,setLoading]=useState(false);const [msg,setMsg]=useState(null);const ref=useRef();
  useEffect(()=>{const fn=e=>{if(ref.current&&!ref.current.contains(e.target))setShowDrop(false);};document.addEventListener("mousedown",fn);return()=>document.removeEventListener("mousedown",fn);},[]);
  const sugeridos=useMemo(()=>!busca?[]:clientes.filter(c=>c.NOME.toLowerCase().includes(busca.toLowerCase())).slice(0,8),[busca,clientes]);
  const parcelasAbertas=useMemo(()=>!cliente?[]:parcelas.filter(p=>String(p.ID_CLIENTE)===String(cliente.ID_CLIENTE)&&p.STATUS!=="pago").sort((a,b)=>new Date(a.DATA_VENCIMENTO)-new Date(b.DATA_VENCIMENTO)),[cliente,parcelas]);
  const valorOriginal=parseFloat(parcela?.VALOR_PARCELA||0);
  const diferenca=Math.max(0,(parseFloat(valor)||valorOriginal)-valorOriginal);
  const stC=st=>st==="atrasado"?RED:st==="vencendo"?YEL:MUTED;
  const confirmar=async()=>{
    if(!parcela||!data)return;setLoading(true);setMsg(null);
    // Garantir que a data enviada seja interpretada corretamente como o dia selecionado
    // O input type="date" retorna YYYY-MM-DD. Vamos garantir que o backend receba isso de forma limpa.
    const dataFormatada = data; 
    const res=tipo==="total"?await postAction({action:"pagamento",idParcela:parcela.ID_PARCELA,data:dataFormatada,valor:valor?parseFloat(valor):null}):await postAction({action:"pagamentoParcial",idParcela:parcela.ID_PARCELA,data:dataFormatada});
    if(res.ok||res.msg){setMsg({ok:true,texto:res.msg||"Registrado!"});setParcela(null);setTipo(null);setValor("");if(onSucesso)onSucesso();}
    else setMsg({ok:false,texto:res.erro||"Erro."});
    setLoading(false);
  };
  return(
    <div>
      <div style={{marginBottom:24}}><h1 style={{fontSize:22,fontWeight:700,color:TEXT,margin:0}}>Registrar Pagamento</h1></div>
      <div style={{maxWidth:600,display:"grid",gap:14}}>
        <div style={{background:CARD,borderRadius:10,border:`1px solid ${BD}`,padding:20}}>
          <p style={{...LS,marginBottom:8}}>Cliente</p>
          <div ref={ref} style={{position:"relative"}}>
            <input value={busca} onChange={e=>{setBusca(e.target.value);setShowDrop(true);setCliente(null);setParcela(null);setTipo(null);}} onFocus={()=>setShowDrop(true)} placeholder="Digite o nome..." style={{...IS,paddingLeft:36}}/>
            <span style={{position:"absolute",left:12,top:"50%",transform:"translateY(-50%)"}}>{Ico.srch}</span>
            {showDrop&&sugeridos.length>0&&<div style={{position:"absolute",top:"100%",left:0,right:0,background:CARD,border:`1px solid ${BD}`,borderRadius:8,zIndex:20,maxHeight:220,overflowY:"auto",marginTop:4,boxShadow:"0 8px 24px rgba(0,0,0,0.1)"}}>
              {sugeridos.map(c=><div key={c.ID_CLIENTE} onClick={()=>{setCliente(c);setBusca(c.NOME);setShowDrop(false);}} style={{padding:"11px 14px",cursor:"pointer",fontSize:13,borderBottom:`1px solid ${BD}`}} onMouseEnter={e=>e.currentTarget.style.background=BG} onMouseLeave={e=>e.currentTarget.style.background=CARD}>{c.NOME}</div>)}
            </div>}
          </div>
        </div>
        {cliente&&<div style={{background:CARD,borderRadius:10,border:`1px solid ${BD}`,padding:20}}>
          <p style={{...LS,marginBottom:10}}>Parcelas em aberto — {cliente.NOME}</p>
          {parcelasAbertas.length===0?<p style={{color:MUTED,fontSize:13}}>Nenhuma parcela em aberto.</p>
          :parcelasAbertas.map(p=>(
            <div key={p.ID_PARCELA} onClick={()=>{setParcela(p);setTipo(null);setMsg(null);}} style={{padding:"12px 14px",marginBottom:6,borderRadius:8,cursor:"pointer",border:`1.5px solid ${parcela?.ID_PARCELA===p.ID_PARCELA?BLU:BD}`,background:parcela?.ID_PARCELA===p.ID_PARCELA?"#EFF6FF":CARD,borderLeft:`4px solid ${stC(p.STATUS)}`}}>
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}>
                <div>
                  <strong style={{fontSize:13}}>Parcela {p.NUM_PARCELA}/{p.TOTAL_PARCELAS}</strong>
                  {p.ORIGEM_PARCELA==="gerada_por_pagamento_de_juros"&&<span style={{marginLeft:8,fontSize:10,background:"#F5F3FF",color:PUR,padding:"2px 6px",borderRadius:10,fontWeight:600}}>Prorrogada</span>}
                  <span style={{color:MUTED,fontSize:12,marginLeft:10}}>Venc: {fmtDt(parseDate(p.DATA_VENCIMENTO))}</span>
                </div>
                <strong style={{color:BLU}}>{fmtR(p.VALOR_PARCELA)}</strong>
              </div>
              <span style={{color:stC(p.STATUS),fontSize:11,fontWeight:600}}>{p.STATUS==="atrasado"?"ATRASADA":p.STATUS==="vencendo"?"VENCE EM BREVE":"PENDENTE"}</span>
            </div>
          ))}
        </div>}
        {parcela&&<div style={{background:CARD,borderRadius:10,border:`1px solid ${BD}`,padding:20}}>
          <p style={{...LS,marginBottom:12}}>Tipo de Pagamento</p>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10,marginBottom:14}}>
            <button onClick={()=>setTipo("total")} style={{padding:"14px 10px",borderRadius:8,border:`2px solid ${tipo==="total"?GRN:BD}`,background:tipo==="total"?"#ECFDF5":CARD,color:tipo==="total"?GRN:MUTED,fontWeight:700,fontSize:13,cursor:"pointer",textAlign:"center"}}>
              Pagamento Total<br/><span style={{fontSize:12,fontWeight:400}}>{fmtR(parcela.VALOR_PARCELA)}</span>
            </button>
            <button onClick={()=>setTipo("parcial")} style={{padding:"14px 10px",borderRadius:8,border:`2px solid ${tipo==="parcial"?YEL:BD}`,background:tipo==="parcial"?"#FFFBEB":CARD,color:tipo==="parcial"?YEL:MUTED,fontWeight:700,fontSize:13,cursor:"pointer",textAlign:"center"}}>
              Somente Juros<br/><span style={{fontSize:12,fontWeight:400}}>{fmtR(parseFloat(parcela.VALOR_JUROS)||0)}</span>
            </button>
          </div>
          {tipo&&<div style={{display:"grid",gap:10}}>
            <div><p style={LS}>Data do Pagamento</p><input type="date" value={data} onChange={e=>setData(e.target.value)} style={IS}/></div>
            {tipo==="total"&&<div>
              <p style={LS}>Valor Pago (opcional)</p>
              <input type="number" step="0.01" value={valor} onChange={e=>setValor(e.target.value)} placeholder={String(parcela.VALOR_PARCELA)} style={IS}/>
              {diferenca>0&&<div style={{marginTop:8,padding:"8px 12px",background:"#FFF7ED",border:`1px solid ${ORG}`,borderRadius:6,fontSize:12}}><span style={{color:ORG,fontWeight:600}}>💡 Diferença: {fmtR(diferenca)}</span><span style={{color:MUTED,marginLeft:6}}>será registrada como receita extra</span></div>}
            </div>}
            {tipo==="parcial"&&<div style={{padding:"10px 12px",background:"#FFFBEB",border:`1px solid ${YEL}`,borderRadius:6,fontSize:12,color:"#92400E"}}>Valor integral ({fmtR(parcela.VALOR_PARCELA)}) será criado como nova parcela no final do contrato. Apenas juros ({fmtR(parseFloat(parcela.VALOR_JUROS)||0)}) agora.</div>}
            <button onClick={confirmar} disabled={loading} style={{padding:"12px",borderRadius:8,border:"none",background:tipo==="total"?GRN:YEL,color:"#fff",fontWeight:700,cursor:"pointer",opacity:loading?0.7:1}}>{loading?"Registrando...":tipo==="total"?"Confirmar Pagamento":"Confirmar Juros"}</button>
          </div>}
        </div>}
        {msg&&<div style={{padding:"12px 16px",borderRadius:8,background:msg.ok?"#ECFDF5":"#FEF2F2",border:`1px solid ${msg.ok?GRN:RED}`,color:msg.ok?"#065F46":"#991B1B",fontSize:13,fontWeight:600}}>{msg.ok?"✅ ":"❌ "}{msg.texto}</div>}
      </div>
    </div>
  );
}

// ── NOVO CONTRATO ──────────────────────────────────────────────────
function NovoContrato({clientes,contratos,onSucesso}){
  const [busca,setBusca]=useState("");const [showDrop,setShowDrop]=useState(false);const [cliente,setCliente]=useState(null);const [principal,setPrincipal]=useState("");const [parcelas,setParcelas]=useState("");const [taxa,setTaxa]=useState("");const [dtEmp,setDtEmp]=useState(hojeStr());const [dtVenc,setDtVenc]=useState("");const [loading,setLoading]=useState(false);const [msg,setMsg]=useState(null);const ref=useRef();
  useEffect(()=>{const fn=e=>{if(ref.current&&!ref.current.contains(e.target))setShowDrop(false);};document.addEventListener("mousedown",fn);return()=>document.removeEventListener("mousedown",fn);},[]);
  const proximoId=useMemo(()=>{let max=0;contratos.forEach(c=>{const m=String(c.ID_CONTRATO).match(/(\d+)/);if(m){const n=parseInt(m[1]);if(n>max)max=n;}});return"PCL-Nº "+(max+1);},[contratos]);
  const sugeridos=useMemo(()=>!busca?[]:clientes.filter(c=>String(c.STATUS_CLIENTE||"").trim().toLowerCase()==="ativo"&&c.NOME.toLowerCase().includes(busca.toLowerCase())).slice(0,8).map(c=>{const temAtivo=contratos.some(ct=>String(ct.ID_CLIENTE).trim()===String(c.ID_CLIENTE).trim()&&["ativo_em_dia","ativo_em_atraso","ativo"].includes(String(ct.STATUS_CONTRATO||"").trim().toLowerCase()));const bloqueado=String(c.BLOQUEADO_PARA_NOVO_CREDITO||"").trim().toUpperCase()==="SIM";return{...c,temAtivo,bloqueado};}), [busca,clientes,contratos]);
  const clienteTemAtivo=useMemo(()=>!cliente?false:contratos.some(ct=>String(ct.ID_CLIENTE).trim()===String(cliente.ID_CLIENTE).trim()&&["ativo_em_dia","ativo_em_atraso","ativo"].includes(String(ct.STATUS_CONTRATO||"").trim().toLowerCase())),[cliente,contratos]);
  const clienteBloqueado=useMemo(()=>!cliente?false:String(cliente.BLOQUEADO_PARA_NOVO_CREDITO||"").toUpperCase()==="SIM",[cliente]);
  const sim=useMemo(()=>{const p=parseFloat(principal)||0,n=parseInt(parcelas)||0,t=parseFloat(taxa)||0;if(!p||!n||!t)return null;const jt=p*t/100*n,tot=p+jt,parc=tot/n;return{jt,tot,parc};},[principal,parcelas,taxa]);
  useEffect(()=>{if(cliente?.DIA_VENCIMENTO_PREFERIDO)setDtVenc(limparData(cliente.DIA_VENCIMENTO_PREFERIDO));},[cliente]);
  const podeConfirmar=sim&&cliente&&!clienteTemAtivo&&!clienteBloqueado;
  const confirmar=async()=>{
    if(!podeConfirmar)return;setLoading(true);setMsg(null);
    const res=await postAction({action:"novoContrato",dados:{id:proximoId,idCliente:cliente.ID_CLIENTE,nomeCliente:cliente.NOME,principal:parseFloat(principal),parcelas:parseInt(parcelas),taxa:parseFloat(taxa),dataEmprestimo:dtEmp,dataVencimento:dtVenc}});
    if(res.ok){setMsg({ok:true,texto:`Contrato ${proximoId} criado!`});setCliente(null);setBusca("");setPrincipal("");setParcelas("");setTaxa("");setDtVenc("");if(onSucesso)onSucesso();}
    else setMsg({ok:false,texto:res.erro||"Erro."});
    setLoading(false);
  };
  return(
    <div>
      <div style={{marginBottom:24}}><h1 style={{fontSize:22,fontWeight:700,color:TEXT,margin:0}}>Novo Contrato</h1></div>
      <div style={{maxWidth:620,display:"grid",gap:14}}>
        <div style={{background:CARD,borderRadius:10,border:`1px solid ${BD}`,padding:20}}>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:14}}><p style={{...LS,margin:0}}>ID do Contrato</p><span style={{fontSize:15,fontWeight:700,color:BLU}}>{proximoId}</span></div>
          <p style={{...LS,marginBottom:8}}>Cliente</p>
          <div ref={ref} style={{position:"relative"}}>
            <input value={busca} onChange={e=>{setBusca(e.target.value);setShowDrop(true);setCliente(null);}} onFocus={()=>setShowDrop(true)} placeholder="Buscar cliente ativo..." style={{...IS,paddingLeft:36}}/>
            <span style={{position:"absolute",left:12,top:"50%",transform:"translateY(-50%)"}}>{Ico.srch}</span>
            {showDrop&&sugeridos.length>0&&<div style={{position:"absolute",top:"100%",left:0,right:0,background:CARD,border:`1px solid ${BD}`,borderRadius:8,zIndex:20,maxHeight:200,overflowY:"auto",marginTop:4,boxShadow:"0 8px 24px rgba(0,0,0,0.1)"}}>
              {sugeridos.map(c=><div key={c.ID_CLIENTE} onClick={()=>{if(!c.temAtivo&&!c.bloqueado){setCliente(c);setBusca(c.NOME);setShowDrop(false);}}} style={{padding:"11px 14px",cursor:c.temAtivo||c.bloqueado?"not-allowed":"pointer",fontSize:13,borderBottom:`1px solid ${BD}`,background:c.temAtivo||c.bloqueado?"#FEF2F2":CARD,display:"flex",justifyContent:"space-between"}}>
                <span>{c.NOME}</span>
                {c.bloqueado&&<span style={{fontSize:11,color:RED,fontWeight:600}}>🚫 Bloqueado</span>}
                {!c.bloqueado&&c.temAtivo&&<span style={{fontSize:11,color:RED,fontWeight:600}}>Contrato ativo</span>}
              </div>)}
            </div>}
          </div>
          {cliente&&!clienteTemAtivo&&!clienteBloqueado&&<div style={{marginTop:8,padding:"8px 12px",background:"#ECFDF5",border:`1px solid ${GRN}`,borderRadius:6,fontSize:12,color:"#065F46"}}>✅ {cliente.NOME} selecionado</div>}
          {cliente&&clienteBloqueado&&<div style={{marginTop:8,padding:"8px 12px",background:"#FEF2F2",border:`1px solid ${RED}`,borderRadius:6,fontSize:12,color:"#991B1B"}}>🚫 Cliente bloqueado para novo crédito — contrato problemático em aberto</div>}
          {cliente&&clienteTemAtivo&&!clienteBloqueado&&<div style={{marginTop:8,padding:"8px 12px",background:"#FEF2F2",border:`1px solid ${RED}`,borderRadius:6,fontSize:12,color:"#991B1B"}}>⛔ Cliente já possui contrato ativo</div>}
        </div>
        <div style={{background:CARD,borderRadius:10,border:`1px solid ${BD}`,padding:20}}>
          <p style={{...LS,marginBottom:14}}>Dados do Contrato</p>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12,marginBottom:12}}>
            <div><span style={LS}>Data do Empréstimo</span><input type="date" value={dtEmp} onChange={e=>setDtEmp(e.target.value)} style={IS}/></div>
            <div><span style={LS}>Data 1º Vencimento</span><input type="date" value={dtVenc} onChange={e=>setDtVenc(e.target.value)} style={IS}/></div>
          </div>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:12}}>
            <div><span style={LS}>Principal (R$)</span><input type="number" min="1" step="0.01" value={principal} onChange={e=>setPrincipal(e.target.value)} placeholder="5000" style={IS}/></div>
            <div><span style={LS}>Nº Parcelas</span><input type="number" min="1" max="120" value={parcelas} onChange={e=>setParcelas(e.target.value)} placeholder="12" style={IS}/></div>
            <div><span style={LS}>Taxa Mensal (%)</span><input type="number" min="0.1" step="0.01" value={taxa} onChange={e=>setTaxa(e.target.value)} placeholder="10" style={IS}/></div>
          </div>
        </div>
        {sim&&<div style={{background:"#F0FDF4",border:`1px solid ${GRN}`,borderRadius:10,padding:20}}>
          <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:10}}>
            {[["Parcela",fmtR(sim.parc),GRN],["Total Final",fmtR(sim.tot),BLU],["Juros Totais",fmtR(sim.jt),YEL]].map(([l,v,c])=>(
              <div key={l} style={{background:CARD,borderRadius:8,padding:"12px 14px"}}><p style={{color:MUTED,fontSize:11,margin:"0 0 4px"}}>{l}</p><p style={{color:c,fontWeight:700,fontSize:16,margin:0}}>{v}</p></div>
            ))}
          </div>
        </div>}
        <button onClick={confirmar} disabled={loading||!podeConfirmar} style={{padding:"13px",borderRadius:8,border:"none",background:podeConfirmar?BLU:"#E5E7EB",color:podeConfirmar?"#fff":MUTED,fontWeight:700,fontSize:14,cursor:podeConfirmar?"pointer":"not-allowed",opacity:loading?0.7:1}}>{loading?"Criando...":"Confirmar e Gerar Parcelas"}</button>
        {msg&&<div style={{padding:"12px 16px",borderRadius:8,background:msg.ok?"#ECFDF5":"#FEF2F2",border:`1px solid ${msg.ok?GRN:RED}`,color:msg.ok?"#065F46":"#991B1B",fontSize:13,fontWeight:600}}>{msg.ok?"✅ ":"❌ "}{msg.texto}</div>}
      </div>
    </div>
  );
}

// ── APP ────────────────────────────────────────────────────────────
function App(){
  const [tab,setTab]=useState("dashboard");
  const [raw,setRaw]=useState(null);
  const [loading,setLoading]=useState(true);
  const [erro,setErro]=useState(null);
  const [selCli,setSelCli]=useState(null);
  const [clienteRevisao,setClienteRevisao]=useState(null);
  const [baixaModal,setBaixaModal]=useState(null);
  const [recuperacaoModal,setRecuperacaoModal]=useState(null);
  const [simVal,setSimVal]=useState(5000);const [simInad,setSimInad]=useState(0);const [simVol,setSimVol]=useState(0);
  const [filtroStatus,setFiltroStatus]=useState("todos");const [filtroBusca,setFiltroBusca]=useState("");
  const [filtroPerdas,setFiltroPerdas]=useState("todos");
  const [busca,setBusca]=useState("");
  const [periodo,setPeriodo]=useState("tudo");
  const [customDe,setCustomDe]=useState(null);
  const [customAte,setCustomAte]=useState(null);
  const [calOpen,setCalOpen]=useState(false);
  const [calMes,setCalMes]=useState(()=>{const d=new Date();d.setDate(1);return d;});
  const [rangeStep,setRangeStep]=useState(0); // 0=aguardando início, 1=aguardando fim

  const carregar=()=>{setLoading(true);setErro(null);fetch(API_URL).then(r=>r.json()).then(d=>{if(d.erro)throw new Error(d.erro);setRaw(d);setLoading(false);}).catch(e=>{setErro(e.message);setLoading(false);});};
  useEffect(()=>{carregar();},[]);

  const {clientes,contratos,parcelas,pagamentos,M,cobItems,mensal,perdas,promessas} = useMemo(()=>{
    if(!raw) return {clientes:[],contratos:[],parcelas:[],pagamentos:[],M:{},cobItems:[],mensal:[],perdas:{},promessas:[]};

    const parcelas=(raw.PARCELAS||[]).map(p=>({...p,
      DATA_VENCIMENTO:parseDate(p.DATA_VENCIMENTO),DATA_PAGAMENTO:parseDate(p.DATA_PAGAMENTO),
      VALOR_PARCELA:parseFloat(p.VALOR_PARCELA)||0,VALOR_PRINCIPAL:parseFloat(p.VALOR_PRINCIPAL)||0,
      VALOR_JUROS:parseFloat(p.VALOR_JUROS)||0,VALOR_PAGO:parseFloat(p.VALOR_PAGO)||0,
      DIFERENCA_PAGA:parseFloat(p.DIFERENCA_PAGA)||0,
      NUM_PARCELA:parseInt(p.NUM_PARCELA)||0,TOTAL_PARCELAS:parseInt(p.TOTAL_PARCELAS)||0}));

    const contratos=(raw.CONTRATOS||[]).map(c=>({...c,
      VALOR_PRINCIPAL:parseFloat(c.VALOR_PRINCIPAL)||0,VALOR_TOTAL:parseFloat(c.VALOR_TOTAL)||0,
      VALOR_PARCELA:parseFloat(c.VALOR_PARCELA)||0,NUM_PARCELAS:parseInt(c.NUM_PARCELAS)||0,
      "TAXA_MENSAL_%":parseFloat(c["TAXA_MENSAL_%"])||0,
      PREJUIZO_CAPITAL:parseFloat(c.PREJUIZO_CAPITAL)||0,
      JUROS_NAO_REALIZADOS:parseFloat(c.JUROS_NAO_REALIZADOS)||0,
      VALOR_RECUPERADO_APOS_BAIXA:parseFloat(c.VALOR_RECUPERADO_APOS_BAIXA)||0}));

    const pagamentos=(raw.PAGAMENTOS||[]).map(p=>{
      const dtP = parseDate(p.DATA_PAGAMENTO);
      const dtV = parseDate(p.DATA_VENCIMENTO_ORIGINAL);
      let tipoReal = p.TIPO_PAGAMENTO;
      
      // Se for pagamento normal mas a data de pagamento for após o vencimento, classificar como atraso
      if(tipoReal === "pagamento_normal" && dtP && dtV && toNum(dtP) > toNum(dtV)){
        tipoReal = "pagamento_com_atraso";
      }

      return {
        ...p,
        TIPO_PAGAMENTO: tipoReal,
        VALOR_PAGO:parseFloat(p.VALOR_PAGO)||0,
        VALOR_ORIGINAL_PARCELA:parseFloat(p.VALOR_ORIGINAL_PARCELA)||0,
        DIFERENCA_RECEBIDA:parseFloat(p.DIFERENCA_RECEBIDA)||0,
        RECEITA_EXTRA_ATRASO:parseFloat(p.RECEITA_EXTRA_ATRASO)||0,
        DATA_PAGAMENTO: dtP,
        DATA_VENCIMENTO_ORIGINAL: dtV
      };
    });

    const promessas=(raw.PROMESSAS||[]).map(p=>({...p,DATA_PREVISTA_PAGAMENTO:parseDate(p.DATA_PREVISTA_PAGAMENTO)}));

    const clientes=(raw.CLIENTES||[]).map(cl=>{
      const cs=contratos.filter(c=>String(c.ID_CLIENTE)===String(cl.ID_CLIENTE));
      const ps=parcelas.filter(p=>String(p.ID_CLIENTE)===String(cl.ID_CLIENTE));
      const totalPago=ps.filter(p=>p.STATUS==="pago").reduce((s,p)=>s+(p.VALOR_PAGO||p.VALOR_PARCELA),0);
      const totalAtrasado=ps.filter(p=>p.STATUS==="atrasado").reduce((s,p)=>s+p.VALOR_PARCELA,0);
      const pagas=ps.filter(p=>p.STATUS==="pago").length;
      const atrasadas=ps.filter(p=>p.STATUS==="atrasado").length;
      let score=Math.max(5,Math.min(100,70+pagas*3-atrasadas*20));
      const stCtr=cs[0]?.STATUS_CONTRATO||"";
      if(STATUS_PERDA.indexOf(stCtr)>=0) score=Math.min(score,30);
      const status=score>=70?"bom":score>=45?"risco":"inadimplente";
      return{...cl,contratos:cs,parcelas:ps,totalPago,totalAtrasado,score,status,numContratos:cs.length};
    });

    const hoje=new Date();hoje.setHours(0,0,0,0);
    const mesAtual=hoje.toISOString().slice(0,7);

    // ── Status ativos reais (exclui quitado, cancelado, baixado, encerrado)
    const ST_ATIVOS=["ativo_em_dia","ativo_em_atraso","em_cobranca","pre_prejuizo","renegociado","em_recuperacao","recuperado_parcialmente"];
    const contratosAtivos=contratos.filter(c=>ST_ATIVOS.includes(String(c.STATUS_CONTRATO||"").toLowerCase()));
    const idsAtivos=new Set(contratosAtivos.map(c=>String(c.ID_CONTRATO)));

    // CARD A — Saldo Devedor Real: parcelas pendente+atrasado de contratos ativos
    const totalAtrasado=parcelas.filter(p=>p.STATUS==="atrasado"&&idsAtivos.has(String(p.ID_CONTRATO))).reduce((s,p)=>s+p.VALOR_PARCELA,0);
    const totalPendente=parcelas.filter(p=>p.STATUS==="pendente"&&idsAtivos.has(String(p.ID_CONTRATO))).reduce((s,p)=>s+p.VALOR_PARCELA,0);
    const saldoDevedor=totalAtrasado+totalPendente;

    // ── Helper de corte de data por período
    function cortePeriodo(p){
      if(!p||p==="tudo"||p==="custom") return null;
      const d=new Date(hoje);
      if(p==="7d")  d.setDate(d.getDate()-7);
      if(p==="30d") d.setDate(d.getDate()-30);
      if(p==="3m")  d.setMonth(d.getMonth()-3);
      if(p==="6m")  d.setMonth(d.getMonth()-6);
      if(p==="1a")  d.setFullYear(d.getFullYear()-1);
      return d;
    }

    // CARD B — Lucro Realizado: juros recebidos + extra (multa/atraso), filtrado por período
    // Juros recebidos = VALOR_JUROS das parcelas pagas (exclui somente_juros puro = capital ainda não voltou)
    // Extra = DIFERENCA_PAGA das parcelas pagas
    const parcelasPagas=parcelas.filter(p=>p.STATUS==="pago");
    const jurosRecebidos=parcelasPagas.reduce((s,p)=>s+(p.VALOR_JUROS||0),0);
    const extraRecebido=parcelasPagas.reduce((s,p)=>s+(p.DIFERENCA_PAGA||0),0);
    const lucroTotal=jurosRecebidos+extraRecebido;

    // Versão filtrada por período (preset ou range customizado)
    function lucroNoPeriodo(per){
      if(per==="custom"){
        const de=customDe; const ate=customAte||hoje;
        return parcelasPagas.filter(p=>{
          const dtP=p.DATA_PAGAMENTO;
          if(!dtP) return false;
          const d=new Date(dtP); d.setHours(0,0,0,0);
          const ateF=new Date(ate); ateF.setHours(23,59,59,999);
          return d>=de&&d<=ateF;
        }).reduce((s,p)=>s+(p.VALOR_JUROS||0)+(p.DIFERENCA_PAGA||0),0);
      }
      const corte=cortePeriodo(per);
      return parcelasPagas.filter(p=>{
        if(!corte) return true;
        const dtP=p.DATA_PAGAMENTO;
        return dtP&&dtP>=corte;
      }).reduce((s,p)=>s+(p.VALOR_JUROS||0)+(p.DIFERENCA_PAGA||0),0);
    }

    const totalPago=pagamentos.filter(p=>p.TIPO_PAGAMENTO!=="recuperacao_apos_baixa").reduce((s,p)=>s+p.VALOR_PAGO,0);
    const receitaExtraTotal=parcelasPagas.reduce((s,p)=>s+(p.DIFERENCA_PAGA||0),0);
    const qtyProrrogadas=parcelas.filter(p=>p.ORIGEM_PARCELA==="gerada_por_pagamento_de_juros").length;
    const pagNormais=pagamentos.filter(p=>p.TIPO_PAGAMENTO==="pagamento_normal").length;
    const pagAtraso=pagamentos.filter(p=>p.TIPO_PAGAMENTO==="pagamento_com_atraso").length;
    const pagJuros=pagamentos.filter(p=>p.TIPO_PAGAMENTO==="somente_juros").length;
    const taxaInad=saldoDevedor>0?(totalAtrasado/saldoDevedor)*100:0;
    const taxaMedia=contratosAtivos.length?contratosAtivos.reduce((s,c)=>s+c["TAXA_MENSAL_%"],0)/contratosAtivos.length:0;

    // Perdas
    const cBaixados=contratos.filter(c=>String(c.STATUS_CONTRATO||"").toLowerCase()==="baixado_como_prejuizo");
    const cEmCobranca=contratos.filter(c=>String(c.STATUS_CONTRATO||"").toLowerCase()==="em_cobranca");
    const cPrePrejuizo=contratos.filter(c=>String(c.STATUS_CONTRATO||"").toLowerCase()==="pre_prejuizo");
    const cRecuperacao=contratos.filter(c=>["em_recuperacao","recuperado_parcialmente"].includes(String(c.STATUS_CONTRATO||"").toLowerCase()));
    const capitalBaixado=cBaixados.reduce((s,c)=>s+c.VALOR_PRINCIPAL,0);
    const prejuizoTotal=cBaixados.reduce((s,c)=>s+c.PREJUIZO_CAPITAL,0);
    const jurosNaoRealizados=cBaixados.reduce((s,c)=>s+c.JUROS_NAO_REALIZADOS,0);
    const recuperadoAposBaixa=cBaixados.reduce((s,c)=>s+c.VALOR_RECUPERADO_APOS_BAIXA,0);
    const txRecuperacao=capitalBaixado>0?(recuperadoAposBaixa/capitalBaixado*100):0;

    const perdas={cBaixados,cEmCobranca,cPrePrejuizo,cRecuperacao,capitalBaixado,prejuizoTotal,jurosNaoRealizados,recuperadoAposBaixa,txRecuperacao};

    const receitaMes=pagamentos.filter(p=>p.DATA_PAGAMENTO&&p.DATA_PAGAMENTO.toISOString().slice(0,7)===mesAtual&&p.TIPO_PAGAMENTO!=="recuperacao_apos_baixa").reduce((s,p)=>s+p.VALOR_PAGO,0);
    const lucroMes=lucroNoPeriodo("30d");

    const M={saldoDevedor,totalAtrasado,totalPendente,totalAReceber:saldoDevedor,totalPago,lucroTotal,lucroNoPeriodo,jurosRecebidos,extraRecebido,receitaExtraTotal,qtyProrrogadas,pagNormais,pagAtraso,pagJuros,taxaInad,taxaMedia,receitaMes,lucroMes};

    const cobItems=parcelas.filter(p=>p.STATUS==="atrasado"||p.STATUS==="vencendo").map(p=>{
      const dtV=new Date(p.DATA_VENCIMENTO);dtV.setHours(0,0,0,0);
      const dias=Math.round((dtV-hoje)/86400000);
      const cl=clientes.find(c=>String(c.ID_CLIENTE)===String(p.ID_CLIENTE));
      return{p,cl,dias,urg:dias<-30?"grave":dias<0?"atrasado":dias===0?"hoje":"amanhã"};
    }).sort((a,b)=>a.dias-b.dias);

    const mensal=Array.from({length:6},(_,i)=>{
      const d=new Date(hoje);d.setMonth(d.getMonth()-5+i);
      const mes=d.toISOString().slice(0,7);
      const receita=pagamentos.filter(p=>p.DATA_PAGAMENTO&&p.DATA_PAGAMENTO.toISOString().slice(0,7)===mes&&p.TIPO_PAGAMENTO!=="recuperacao_apos_baixa").reduce((s,p)=>s+p.VALOR_PAGO,0);
      const extra=pagamentos.filter(p=>p.DATA_PAGAMENTO&&p.DATA_PAGAMENTO.toISOString().slice(0,7)===mes).reduce((s,p)=>s+p.RECEITA_EXTRA_ATRASO,0);
      return{mes:d.toLocaleDateString("pt-BR",{month:"short"}),receita:Math.round(receita),extra:Math.round(extra)};
    });

    return{clientes,contratos,parcelas,pagamentos,M,cobItems,mensal,perdas,promessas};
  },[raw,periodo,customDe,customAte]);

  const aguardando=(raw?.CLIENTES||[]).filter(c=>String(c.STATUS_CLIENTE||"").trim()==="aguardando_conferencia");
  const hoje=new Date();hoje.setHours(0,0,0,0);
  const proximas=parcelas.filter(p=>p.STATUS!=="pago"&&p.DATA_VENCIMENTO).map(p=>{const dtV=new Date(p.DATA_VENCIMENTO);dtV.setHours(0,0,0,0);const dias=Math.round((dtV-hoje)/86400000);const cl=clientes.find(c=>String(c.ID_CLIENTE)===String(p.ID_CLIENTE));return{...p,dias,cl};}).filter(p=>p.dias>=-30&&p.dias<=3).sort((a,b)=>a.dias-b.dias).slice(0,5);

  const NAV=[
    {id:"dashboard",label:"Dashboard",icon:Ico.dash},
    {id:"clientes",label:"Clientes",icon:Ico.cli,badge:aguardando.length},
    {id:"contratos",label:"Contratos",icon:Ico.ctr},
    {id:"pagamentos",label:"Pagamentos",icon:Ico.pag},
    {id:"novoContrato",label:"Novo Contrato",icon:Ico.novo},
    {id:"cobranca",label:"Cobrança",icon:Ico.cob,badge:cobItems.length},
    {id:"perdas",label:"Perdas e Recuperação",icon:Ico.loss,badge:perdas.cBaixados?.length||0},
    {id:"financeiro",label:"Financeiro",icon:Ico.fin},
    {id:"kpis",label:"Análise de Crédito",icon:Ico.kpi},
    {id:"simulador",label:"Simulador",icon:Ico.sim},
  ];

  const TT=p=><Tooltip {...p} contentStyle={{background:CARD,border:`1px solid ${BD}`,borderRadius:8,fontSize:12}}/>;

  if(loading) return <div style={{background:BG,minHeight:"100vh",display:"flex",alignItems:"center",justifyContent:"center",flexDirection:"column",gap:14}}><style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style><div style={{width:40,height:40,border:`3px solid ${BD}`,borderTop:`3px solid ${BLU}`,borderRadius:"50%",animation:"spin 1s linear infinite"}}/><p style={{color:MUTED,fontSize:13}}>Carregando dados...</p></div>;
  if(erro) return <div style={{background:BG,minHeight:"100vh",display:"flex",alignItems:"center",justifyContent:"center",flexDirection:"column",gap:12}}><span style={{fontSize:40}}>⚠️</span><p style={{color:RED,fontWeight:700}}>{erro}</p><button onClick={carregar} style={{padding:"10px 24px",background:BLU,color:"#fff",border:"none",borderRadius:8,fontWeight:700,cursor:"pointer"}}>Tentar novamente</button></div>;

  return(
    <div style={{display:"flex",minHeight:"100vh",background:BG,fontFamily:"'Inter',system-ui,sans-serif",fontSize:13}}>
      <style>{`*{box-sizing:border-box;margin:0;padding:0}body{margin:0}input,select,textarea{font-family:inherit}::-webkit-scrollbar{width:5px}::-webkit-scrollbar-thumb{background:#D1D5DB;border-radius:3px}`}</style>

      {clienteRevisao&&<RevisaoCliente cliente={clienteRevisao} onAtivar={()=>{setClienteRevisao(null);carregar();}} onFechar={()=>setClienteRevisao(null)}/>}
      {baixaModal&&<BaixaModal contrato={baixaModal} parcelas={parcelas} pagamentos={pagamentos} onConfirmar={()=>{setBaixaModal(null);carregar();}} onFechar={()=>setBaixaModal(null)}/>}
      {recuperacaoModal&&<RecuperacaoModal contrato={recuperacaoModal} onConfirmar={()=>{setRecuperacaoModal(null);carregar();}} onFechar={()=>setRecuperacaoModal(null)}/>}

      {calOpen&&<div onClick={()=>setCalOpen(false)} style={{position:"fixed",inset:0,zIndex:199,background:"transparent"}}/>}

      {/* SIDEBAR */}
      <aside style={{width:SW,background:CARD,borderRight:`1px solid ${BD}`,display:"flex",flexDirection:"column",position:"fixed",top:0,left:0,bottom:0,zIndex:100}}>
        <div style={{padding:"18px 18px 14px",borderBottom:`1px solid ${BD}`}}>
          <div style={{display:"flex",alignItems:"center",gap:10}}>
            <div style={{width:34,height:34,background:"linear-gradient(135deg,#3B82F6,#8B5CF6)",borderRadius:9,display:"flex",alignItems:"center",justifyContent:"center"}}><span style={{color:"#fff",fontSize:16,fontWeight:800}}>F</span></div>
            <div><p style={{color:TEXT,fontWeight:800,fontSize:15,margin:0}}>FinanceiroOp</p><p style={{color:MUTED,fontSize:10,margin:0}}>Gestão de Crédito</p></div>
          </div>
        </div>
        <nav style={{flex:1,overflowY:"auto",padding:"8px 10px"}}>
          {NAV.map(n=>{const sel=tab===n.id;return(
            <button key={n.id} onClick={()=>setTab(n.id)} style={{width:"100%",display:"flex",alignItems:"center",gap:10,padding:"9px 12px",borderRadius:8,border:"none",background:sel?"#EFF6FF":CARD,color:sel?BLU:MUTED,fontWeight:sel?600:400,fontSize:13,cursor:"pointer",textAlign:"left",marginBottom:2,position:"relative"}}>
              <span style={{color:sel?BLU:MUTED,flexShrink:0}}>{n.icon}</span>
              <span style={{flex:1}}>{n.label}</span>
              {n.badge>0&&<span style={{background:n.id==="perdas"?RED:RED,color:"#fff",borderRadius:10,padding:"1px 6px",fontSize:10,fontWeight:700}}>{n.badge}</span>}
              {sel&&<span style={{position:"absolute",left:0,top:"20%",bottom:"20%",width:3,background:BLU,borderRadius:"0 3px 3px 0"}}/>}
            </button>
          );})}
        </nav>
        <div style={{padding:"10px 14px",borderTop:`1px solid ${BD}`}}>
          <div style={{display:"flex",alignItems:"center",gap:10,padding:"10px 12px",background:BG,borderRadius:8}}>
            <span style={{color:MUTED}}>{Ico.help}</span>
            <div><p style={{color:TEXT,fontSize:12,fontWeight:600,margin:0}}>Precisa de ajuda?</p><p style={{color:MUTED,fontSize:11,margin:0}}>Suporte técnico</p></div>
          </div>
        </div>
      </aside>

      {/* MAIN */}
      <div style={{flex:1,marginLeft:SW,display:"flex",flexDirection:"column",minHeight:"100vh"}}>
        <header style={{background:CARD,borderBottom:`1px solid ${BD}`,padding:"0 28px",height:64,display:"flex",alignItems:"center",gap:20,position:"sticky",top:0,zIndex:50}}>
          <div style={{flex:1}}><h1 style={{fontSize:20,fontWeight:700,color:TEXT,margin:0}}>{NAV.find(n=>n.id===tab)?.label}</h1></div>
          <div style={{position:"relative",width:280}}>
            <span style={{position:"absolute",left:12,top:"50%",transform:"translateY(-50%)"}}>{Ico.srch}</span>
            <input value={busca} onChange={e=>setBusca(e.target.value)} placeholder="Buscar clientes, contratos..." style={{...IS,paddingLeft:36,fontSize:12,width:"100%"}}/>
          </div>
          <button onClick={carregar} style={{background:"none",border:`1px solid ${BD}`,borderRadius:8,padding:"7px 12px",cursor:"pointer",color:MUTED,display:"flex",alignItems:"center",gap:6,fontSize:12}}>{Ico.ref} Atualizar</button>
          <button style={{background:"none",border:"none",cursor:"pointer",color:MUTED,position:"relative",padding:4}}>
            {Ico.bell}
            {aguardando.length>0&&<span style={{position:"absolute",top:0,right:0,width:8,height:8,background:RED,borderRadius:"50%",border:`2px solid ${CARD}`}}/>}
          </button>
          <div style={{display:"flex",alignItems:"center",gap:10}}>
            <div style={{width:34,height:34,background:"linear-gradient(135deg,#3B82F6,#8B5CF6)",borderRadius:"50%",display:"flex",alignItems:"center",justifyContent:"center"}}><span style={{color:"#fff",fontSize:13,fontWeight:700}}>AR</span></div>
            <div><p style={{fontSize:12,fontWeight:600,color:TEXT,margin:0}}>Administrador</p><p style={{fontSize:10,color:MUTED,margin:0}}>FinanceiroOp</p></div>
          </div>
        </header>

        <main style={{flex:1,padding:"24px 28px",overflowY:"auto"}}>

          {/* ── DASHBOARD ── */}
          {tab==="dashboard"&&(()=>{
            // ── Helpers locais do calendário ───────────────────────────────
            const DIAS_SEM=["D","S","T","Q","Q","S","S"];
            const MESES_PT=["Janeiro","Fevereiro","Março","Abril","Maio","Junho","Julho","Agosto","Setembro","Outubro","Novembro","Dezembro"];
            function diasDoMes(ano,mes){return new Date(ano,mes+1,0).getDate();}
            function primeiroDiaSem(ano,mes){return new Date(ano,mes,1).getDay();}
            function dStr(d){if(!d)return"";return d.toLocaleDateString("pt-BR",{day:"2-digit",month:"2-digit",year:"numeric"});}
            const periodoLabel={
              "tudo":"Todo período","7d":"Últimos 7 dias","30d":"Últimos 30 dias",
              "3m":"Últimos 3 meses","6m":"Últimos 6 meses","1a":"Último ano",
              "custom":customDe&&customAte?`${dStr(customDe)} → ${dStr(customAte)}`:customDe?`A partir de ${dStr(customDe)}`:"Personalizado"
            };
            const periodoAtivo=periodo==="custom"&&!customDe?"tudo":periodo;
            const lucroAtual=M.lucroNoPeriodo(periodoAtivo);

            function clicarDia(d){
              if(rangeStep===0){setCustomDe(d);setCustomAte(null);setRangeStep(1);}
              else{
                if(d<customDe){setCustomDe(d);setCustomAte(customDe);}
                else{setCustomAte(d);}
                setRangeStep(0);setPeriodo("custom");setCalOpen(false);
              }
            }
            function dentroRange(d){
              if(!customDe||!customAte) return false;
              return d>=customDe&&d<=customAte;
            }
            function ehInicio(d){return customDe&&d.getTime()===customDe.getTime();}
            function ehFim(d){return customAte&&d.getTime()===customAte.getTime();}
            function ehHoje(d){return d.getTime()===hoje.getTime();}

            // Renderiza os dias do calendário (um mês)
            const ano=calMes.getFullYear(), mes=calMes.getMonth();
            const totalDias=diasDoMes(ano,mes), primDia=primeiroDiaSem(ano,mes);
            const celulas=[];
            for(let i=0;i<primDia;i++) celulas.push(null);
            for(let i=1;i<=totalDias;i++) celulas.push(new Date(ano,mes,i));

            return <div>

            {/* ── Barra de filtro de período ── */}
            <div style={{display:"flex",alignItems:"center",gap:6,marginBottom:16,flexWrap:"wrap"}}>
              <span style={{color:MUTED,fontSize:11,fontWeight:600,textTransform:"uppercase",letterSpacing:"0.05em",marginRight:2}}>Período:</span>
              {[["tudo","Tudo"],["7d","7d"],["30d","30d"],["3m","3m"],["6m","6m"],["1a","1 ano"]].map(([v,l])=>(
                <button key={v} onClick={()=>{setPeriodo(v);setCustomDe(null);setCustomAte(null);setCalOpen(false);}}
                  style={{padding:"5px 12px",borderRadius:20,border:`1px solid ${periodoAtivo===v?BLU:BD}`,background:periodoAtivo===v?BLU:CARD,color:periodoAtivo===v?"#fff":MUTED,fontSize:12,fontWeight:periodoAtivo===v?700:400,cursor:"pointer",transition:"all 0.15s"}}>
                  {l}
                </button>
              ))}

              {/* Botão abre calendário */}
              <div style={{position:"relative"}}>
                <button onClick={()=>{setCalOpen(o=>!o);setRangeStep(0);}}
                  style={{display:"flex",alignItems:"center",gap:6,padding:"5px 12px",borderRadius:20,border:`1px solid ${periodo==="custom"&&customDe?BLU:BD}`,background:periodo==="custom"&&customDe?BLU:CARD,color:periodo==="custom"&&customDe?"#fff":MUTED,fontSize:12,fontWeight:periodo==="custom"&&customDe?700:400,cursor:"pointer",transition:"all 0.15s"}}>
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
                  {periodo==="custom"&&customDe ? periodoLabel["custom"] : "Personalizado"}
                </button>

                {/* Popover calendário */}
                {calOpen&&<div style={{position:"absolute",top:"calc(100% + 8px)",left:0,zIndex:200,background:CARD,border:`1px solid ${BD}`,borderRadius:12,boxShadow:"0 8px 32px rgba(0,0,0,0.14)",padding:16,minWidth:300}} onClick={e=>e.stopPropagation()}>

                  {/* Instruções */}
                  <p style={{color:rangeStep===0?BLU:GRN,fontSize:11,fontWeight:600,margin:"0 0 10px",textAlign:"center"}}>
                    {rangeStep===0?"Clique para selecionar a data inicial":"Clique para selecionar a data final"}
                  </p>

                  {/* Header do mês */}
                  <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:10}}>
                    <button onClick={()=>{const d=new Date(calMes);d.setMonth(d.getMonth()-1);setCalMes(d);}} style={{width:28,height:28,borderRadius:6,border:`1px solid ${BD}`,background:CARD,cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",color:MUTED}}>‹</button>
                    <span style={{fontWeight:700,fontSize:13,color:TEXT}}>{MESES_PT[mes]} {ano}</span>
                    <button onClick={()=>{const d=new Date(calMes);d.setMonth(d.getMonth()+1);setCalMes(d);}} style={{width:28,height:28,borderRadius:6,border:`1px solid ${BD}`,background:CARD,cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",color:MUTED}}>›</button>
                  </div>

                  {/* Cabeçalho dias da semana */}
                  <div style={{display:"grid",gridTemplateColumns:"repeat(7,1fr)",marginBottom:4}}>
                    {DIAS_SEM.map((d,i)=><div key={i} style={{textAlign:"center",fontSize:10,fontWeight:700,color:MUTED,padding:"2px 0"}}>{d}</div>)}
                  </div>

                  {/* Grade de dias */}
                  <div style={{display:"grid",gridTemplateColumns:"repeat(7,1fr)",gap:2}}>
                    {celulas.map((d,i)=>{
                      if(!d) return <div key={i}/>;
                      const ini=ehInicio(d), fim2=ehFim(d), dentro=dentroRange(d), hj=ehHoje(d);
                      const ativo=ini||fim2;
                      return(
                        <button key={i} onClick={()=>clicarDia(d)}
                          style={{width:"100%",aspectRatio:"1",borderRadius:ini?"6px 0 0 6px":fim2?"0 6px 6px 0":dentro?"0":"6px",border:"none",background:ativo?BLU:dentro?"#DBEAFE":CARD,color:ativo?"#fff":hj?BLU:TEXT,fontWeight:ativo||hj?700:400,fontSize:12,cursor:"pointer",position:"relative",outline:"none"}}
                          onMouseEnter={e=>{if(!ativo&&!dentro)e.currentTarget.style.background=BG;}}
                          onMouseLeave={e=>{if(!ativo&&!dentro)e.currentTarget.style.background=CARD;}}>
                          {d.getDate()}
                          {hj&&<span style={{position:"absolute",bottom:2,left:"50%",transform:"translateX(-50%)",width:3,height:3,borderRadius:"50%",background:ativo?"#fff":BLU}}/>}
                        </button>
                      );
                    })}
                  </div>

                  {/* Footer: range selecionado + limpar */}
                  {(customDe||customAte)&&<div style={{marginTop:12,paddingTop:10,borderTop:`1px solid ${BD}`,display:"flex",alignItems:"center",justifyContent:"space-between"}}>
                    <span style={{fontSize:11,color:MUTED}}>{customDe&&dStr(customDe)}{customAte&&` → ${dStr(customAte)}`}</span>
                    <button onClick={()=>{setCustomDe(null);setCustomAte(null);setPeriodo("tudo");setRangeStep(0);setCalOpen(false);}}
                      style={{fontSize:11,color:RED,background:"none",border:"none",cursor:"pointer",fontWeight:600}}>Limpar</button>
                  </div>}

                </div>}
              </div>

              {(periodo!=="tudo"||(periodo==="custom"&&customDe))&&
                <span style={{color:MUTED,fontSize:11,marginLeft:4}}>— lucro filtrado por: <strong style={{color:BLU}}>{periodoLabel[periodoAtivo]||periodoLabel[periodo]}</strong></span>}
            </div>

            <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:14,marginBottom:16}}>

              {/* Card A — Saldo Devedor Real */}
              <div style={{background:CARD,borderRadius:10,padding:18,border:`1px solid ${BD}`,boxShadow:"0 1px 4px rgba(0,0,0,0.05)"}}>
                <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:6}}>
                  <div style={{width:36,height:36,background:"#EFF6FF",borderRadius:8,display:"flex",alignItems:"center",justifyContent:"center",fontSize:18}}>🏦</div>
                  <p style={{color:MUTED,fontSize:11,fontWeight:500,margin:0}}>Saldo Devedor</p>
                </div>
                <p style={{fontSize:20,fontWeight:700,color:TEXT,margin:"0 0 3px"}}>{fmtR(M.saldoDevedor)}</p>
                <p style={{fontSize:10,color:MUTED,margin:0}}>capital + juros a receber (contratos ativos)</p>
                <div style={{marginTop:8,display:"flex",gap:10}}>
                  <span style={{fontSize:10,color:RED}}>⚠ {fmtR(M.totalAtrasado)} atrasado</span>
                  <span style={{fontSize:10,color:GRN}}>📅 {fmtR(M.totalPendente)} a vencer</span>
                </div>
              </div>

              {/* Card B — Lucro Realizado (filtrado por período) */}
              <div style={{background:CARD,borderRadius:10,padding:18,border:`1px solid ${BD}`,boxShadow:"0 1px 4px rgba(0,0,0,0.05)",position:"relative"}}>
                <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:6}}>
                  <div style={{width:36,height:36,background:"#ECFDF5",borderRadius:8,display:"flex",alignItems:"center",justifyContent:"center",fontSize:18}}>💸</div>
                  <p style={{color:MUTED,fontSize:11,fontWeight:500,margin:0}}>Lucro Realizado</p>
                </div>
                <p style={{fontSize:20,fontWeight:700,color:GRN,margin:"0 0 3px"}}>{fmtR(lucroAtual)}</p>
                <p style={{fontSize:10,color:MUTED,margin:0}}>juros recebidos + multa/atraso</p>
                <div style={{marginTop:8,display:"flex",gap:10}}>
                  <span style={{fontSize:10,color:BLU}}>📊 {fmtR(M.jurosRecebidos)} juros</span>
                  <span style={{fontSize:10,color:ORG}}>⚡ {fmtR(M.extraRecebido)} extra</span>
                </div>
                {periodoAtivo!=="tudo"&&<div style={{position:"absolute",top:8,right:10,background:BLU,color:"#fff",fontSize:9,fontWeight:700,padding:"2px 7px",borderRadius:10,maxWidth:90,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{periodo==="custom"?`${dStr(customDe)?.slice(0,5)}…`:periodoAtivo}</div>}
              </div>

              {/* Card C — Inadimplência */}
              <div style={{background:CARD,borderRadius:10,padding:18,border:`1px solid ${BD}`,boxShadow:"0 1px 4px rgba(0,0,0,0.05)"}}>
                <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:6}}>
                  <div style={{width:36,height:36,background:M.taxaInad>15?"#FEF2F2":"#ECFDF5",borderRadius:8,display:"flex",alignItems:"center",justifyContent:"center",fontSize:18}}>⚠️</div>
                  <p style={{color:MUTED,fontSize:11,fontWeight:500,margin:0}}>Inadimplência</p>
                </div>
                <p style={{fontSize:20,fontWeight:700,color:M.taxaInad>15?RED:GRN,margin:"0 0 3px"}}>{fmtP(M.taxaInad)}</p>
                <p style={{fontSize:10,color:MUTED,margin:0}}>atrasado ÷ saldo devedor total</p>
                <div style={{marginTop:8}}>
                  <div style={{height:4,background:BD,borderRadius:2}}><div style={{width:`${Math.min(100,M.taxaInad)}%`,height:"100%",borderRadius:2,background:M.taxaInad>20?RED:M.taxaInad>10?YEL:GRN}}/></div>
                </div>
              </div>

              {/* Card D — Baixados Prejuízo */}
              <div style={{background:CARD,borderRadius:10,padding:18,border:`1px solid ${BD}`,boxShadow:"0 1px 4px rgba(0,0,0,0.05)",cursor:"pointer"}} onClick={()=>setTab("perdas")}>
                <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:6}}>
                  <div style={{width:36,height:36,background:"#FEF2F2",borderRadius:8,display:"flex",alignItems:"center",justifyContent:"center",fontSize:18}}>🚨</div>
                  <p style={{color:MUTED,fontSize:11,fontWeight:500,margin:0}}>Baixados Prejuízo</p>
                </div>
                <p style={{fontSize:20,fontWeight:700,color:RED,margin:"0 0 3px"}}>{perdas.cBaixados?.length||0}</p>
                <p style={{fontSize:10,color:MUTED,margin:0}}>contratos write-off — clique para detalhar</p>
                <div style={{marginTop:8}}>
                  <span style={{fontSize:10,color:RED}}>💀 {fmtR(perdas.prejuizoTotal)} capital perdido</span>
                </div>
              </div>

            </div>
            {/* Cards de perdas resumo */}
            {(perdas.cBaixados?.length>0||perdas.cPrePrejuizo?.length>0||perdas.cEmCobranca?.length>0)&&(
              <div style={{background:"#FEF2F2",border:`1px solid ${RED}30`,borderRadius:10,padding:16,marginBottom:16,display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:12}}>
                {[
                  {l:"Em Cobrança",v:perdas.cEmCobranca?.length||0,c:ORG},
                  {l:"Pré-Prejuízo",v:perdas.cPrePrejuizo?.length||0,c:"#DC2626"},
                  {l:"Baixados",v:perdas.cBaixados?.length||0,c:RED},
                  {l:"Prejuízo Capital",v:fmtR(perdas.prejuizoTotal),c:RED},
                ].map(k=>(
                  <div key={k.l} style={{textAlign:"center",padding:"10px 0",cursor:"pointer"}} onClick={()=>setTab("perdas")}>
                    <p style={{fontSize:18,fontWeight:800,color:k.c,margin:0}}>{k.v}</p>
                    <p style={{fontSize:11,color:MUTED,margin:"2px 0 0"}}>{k.l}</p>
                  </div>
                ))}
              </div>
            )}
            <div style={{display:"grid",gridTemplateColumns:"2fr 1fr",gap:16,marginBottom:16}}>
              <div style={{background:CARD,borderRadius:10,padding:20,border:`1px solid ${BD}`}}>
                <h3 style={{fontSize:14,fontWeight:700,color:TEXT,margin:"0 0 16px"}}>Receita dos últimos 6 meses</h3>
                <ResponsiveContainer width="100%" height={200}>
                  <BarChart data={mensal} margin={{top:4,right:4,bottom:0,left:-10}}>
                    <CartesianGrid strokeDasharray="3 3" stroke={BD} vertical={false}/>
                    <XAxis dataKey="mes" tick={{fill:MUTED,fontSize:11}} axisLine={false} tickLine={false}/>
                    <YAxis tick={{fill:MUTED,fontSize:10}} tickFormatter={v=>`R$${(v/1000).toFixed(0)}k`} axisLine={false} tickLine={false}/>
                    <TT formatter={(v,n)=>[fmtR(v),n==="receita"?"Receita":"Extra Atraso"]}/>
                    <Bar dataKey="receita" fill={BLU} radius={[4,4,0,0]}/>
                    <Bar dataKey="extra" fill={ORG} radius={[4,4,0,0]}/>
                  </BarChart>
                </ResponsiveContainer>
              </div>
              <div style={{background:CARD,borderRadius:10,padding:20,border:`1px solid ${BD}`}}>
                <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:14}}>
                  <h3 style={{fontSize:14,fontWeight:700,color:TEXT,margin:0}}>Aguardando</h3>
                  <button onClick={()=>setTab("clientes")} style={{background:"none",border:"none",color:BLU,fontSize:12,fontWeight:600,cursor:"pointer"}}>Ver todas</button>
                </div>
                {aguardando.length===0?<div style={{textAlign:"center",padding:"20px 0"}}><p style={{fontSize:22,margin:"0 0 4px"}}>✅</p><p style={{color:MUTED,fontSize:12}}>Nenhuma pendência</p></div>
                :aguardando.slice(0,4).map(c=>(
                  <div key={c.ID_CLIENTE} style={{display:"flex",alignItems:"center",gap:10,padding:"8px 0",borderBottom:`1px solid ${BD}`}}>
                    <div style={{width:30,height:30,borderRadius:"50%",background:"#EFF6FF",display:"flex",alignItems:"center",justifyContent:"center"}}><span style={{color:BLU,fontWeight:700}}>{(c.NOME||"?")[0]}</span></div>
                    <div style={{flex:1,minWidth:0}}><p style={{fontSize:12,fontWeight:600,color:TEXT,margin:0,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{c.NOME}</p></div>
                    <button onClick={()=>setClienteRevisao(c)} style={{background:"#FFFBEB",border:`1px solid ${YEL}`,color:"#92400E",borderRadius:6,padding:"3px 8px",fontSize:11,fontWeight:600,cursor:"pointer"}}>Revisar</button>
                  </div>
                ))}
              </div>
            </div>
            <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:14}}>
              {[["⏰","Receita Extra",fmtR(M.receitaExtraTotal),"acumulada",ORG,"#FFF7ED"],[" 🔄","Prorrogadas",M.qtyProrrogadas,"parcelas",PUR,"#F5F3FF"],["✅","Pagamentos Normais",M.pagNormais,"registros",GRN,"#ECFDF5"],["⚡","Pag. com Atraso",M.pagAtraso,"registros",YEL,"#FFFBEB"]].map(([ic,l,v,sub,c,bg])=>(
                <div key={l} style={{background:CARD,borderRadius:10,padding:16,border:`1px solid ${BD}`}}>
                  <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:10}}>
                    <div style={{width:30,height:30,background:bg,borderRadius:7,display:"flex",alignItems:"center",justifyContent:"center",fontSize:15}}>{ic}</div>
                    <p style={{color:MUTED,fontSize:11,margin:0}}>{l}</p>
                  </div>
                  <p style={{fontSize:18,fontWeight:700,color:c,margin:"0 0 2px"}}>{v}</p>
                  <p style={{fontSize:10,color:MUTED,margin:0}}>{sub}</p>
                </div>
              ))}
            </div>
          </div>; })()}

          {tab==="pagamentos"&&<RegistrarPagamento clientes={clientes} parcelas={parcelas} onSucesso={()=>setTimeout(carregar,2000)}/>}
          {tab==="novoContrato"&&<NovoContrato clientes={clientes} contratos={contratos} onSucesso={()=>setTimeout(carregar,2000)}/>}

          {/* ── CLIENTES ── */}
          {tab==="clientes"&&<div>
            <div style={{marginBottom:16}}><h1 style={{fontSize:22,fontWeight:700,color:TEXT,margin:0}}>Clientes</h1></div>
            {aguardando.length>0&&<div style={{background:"#FFFBEB",border:`1px solid ${YEL}`,borderRadius:10,padding:14,marginBottom:14}}>
              <h3 style={{color:"#92400E",fontWeight:700,fontSize:13,margin:"0 0 10px"}}>⏳ Aguardando Conferência ({aguardando.length})</h3>
              {aguardando.map(c=><div key={c.ID_CLIENTE} style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"9px 14px",background:CARD,borderRadius:8,marginBottom:6,border:`1px solid ${BD}`}}>
                <strong style={{fontSize:13}}>{c.NOME}</strong>
                <button onClick={()=>setClienteRevisao(c)} style={{padding:"6px 14px",background:YEL,color:"#fff",border:"none",borderRadius:7,fontWeight:700,fontSize:12,cursor:"pointer"}}>Revisar</button>
              </div>)}
            </div>}
            <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:12,marginBottom:14}}>
              {[{l:"Total",v:clientes.length,c:BLU},{l:"Adimplentes",v:clientes.filter(c=>c.status==="bom").length,c:GRN},{l:"Em Risco",v:clientes.filter(c=>c.status==="risco").length,c:YEL},{l:"Inadimplentes",v:clientes.filter(c=>c.status==="inadimplente").length,c:RED}].map(x=>(
                <div key={x.l} style={{background:CARD,borderRadius:10,padding:"14px 18px",border:`1px solid ${BD}`,textAlign:"center"}}><p style={{fontSize:22,fontWeight:800,color:x.c,margin:"0 0 2px"}}>{x.v}</p><p style={{fontSize:12,color:MUTED,margin:0}}>{x.l}</p></div>
              ))}
            </div>
            <div style={{background:CARD,borderRadius:10,border:`1px solid ${BD}`}}>
              <div style={{padding:"12px 18px",borderBottom:`1px solid ${BD}`,display:"flex",gap:10}}>
                <div style={{position:"relative",flex:1,maxWidth:280}}>
                  <span style={{position:"absolute",left:10,top:"50%",transform:"translateY(-50%)"}}>{Ico.srch}</span>
                  <input placeholder="Buscar cliente..." value={filtroBusca} onChange={e=>setFiltroBusca(e.target.value)} style={{...IS,paddingLeft:32}}/>
                </div>
                <select value={filtroStatus} onChange={e=>setFiltroStatus(e.target.value)} style={{...IS,width:"auto"}}>
                  <option value="todos">Todos</option><option value="bom">Adimplentes</option><option value="risco">Em Risco</option><option value="inadimplente">Inadimplentes</option>
                </select>
              </div>
              <table style={{width:"100%",borderCollapse:"collapse"}}>
                <thead><tr style={{background:BG}}>{["Cliente","Status","Score","Pago","Atraso","Bloqueado"].map(h=><th key={h} style={{textAlign:"left",padding:"10px 18px",color:MUTED,fontSize:11,fontWeight:700,textTransform:"uppercase"}}>{h}</th>)}</tr></thead>
                <tbody>
                  {clientes.filter(c=>{const sk=filtroStatus==="todos"||c.status===filtroStatus;const bk=!filtroBusca||c.NOME.toLowerCase().includes(filtroBusca.toLowerCase());return sk&&bk;}).map(c=>{
                    const bloq=String(c.BLOQUEADO_PARA_NOVO_CREDITO||"").toUpperCase()==="SIM";
                    return(
                      <React.Fragment key={c.ID_CLIENTE}>
                        <tr style={{borderTop:`1px solid ${BD}`,cursor:"pointer",background:selCli===c.ID_CLIENTE?"#F0F9FF":CARD}} onClick={()=>setSelCli(selCli===c.ID_CLIENTE?null:c.ID_CLIENTE)} onMouseEnter={e=>{if(selCli!==c.ID_CLIENTE)e.currentTarget.style.background=BG;}} onMouseLeave={e=>{if(selCli!==c.ID_CLIENTE)e.currentTarget.style.background=CARD;}}>
                          <td style={{padding:"12px 18px"}}><div style={{display:"flex",alignItems:"center",gap:10}}><div style={{width:32,height:32,borderRadius:"50%",background:"#EFF6FF",display:"flex",alignItems:"center",justifyContent:"center"}}><span style={{color:BLU,fontWeight:700}}>{(c.NOME||"?")[0]}</span></div><div><p style={{fontWeight:600,margin:0,fontSize:13}}>{c.NOME}</p><p style={{color:MUTED,fontSize:11,margin:0}}>{c.TELEFONE_WPP||"—"}</p></div></div></td>
                          <td style={{padding:"12px 18px"}}><Badge c={c.status==="bom"?GRN:c.status==="risco"?YEL:RED}>{c.status==="bom"?"Adimplente":c.status==="risco"?"Em Risco":"Inadimplente"}</Badge></td>
                          <td style={{padding:"12px 18px"}}><div style={{display:"flex",alignItems:"center",gap:8}}><strong style={{color:c.score>70?GRN:c.score>45?YEL:RED}}>{c.score}</strong><div style={{width:48,height:4,background:BD,borderRadius:2}}><div style={{width:`${c.score}%`,height:"100%",borderRadius:2,background:c.score>70?GRN:c.score>45?YEL:RED}}/></div></div></td>
                          <td style={{padding:"12px 18px",color:GRN,fontWeight:600,fontSize:13}}>{fmtR(c.totalPago)}</td>
                          <td style={{padding:"12px 18px",color:c.totalAtrasado>0?RED:MUTED,fontWeight:c.totalAtrasado>0?600:400,fontSize:13}}>{fmtR(c.totalAtrasado)}</td>
                          <td style={{padding:"12px 18px"}}>{bloq?<Badge c={RED}>🚫 Bloqueado</Badge>:<Badge c={GRN}>✅ Liberado</Badge>}</td>
                        </tr>
                        {selCli===c.ID_CLIENTE&&<tr><td colSpan={6} style={{padding:"0 18px 12px",background:"#F0F9FF"}}>
                          <div style={{padding:12,background:CARD,borderRadius:8,border:`1px solid ${BLU}30`}}>
                            {c.contratos.map(ct=>{
                              const stCor=STATUS_COR[String(ct.STATUS_CONTRATO||"").toLowerCase()]||MUTED;
                              const ps=parcelas.filter(p=>String(p.ID_CONTRATO)===String(ct.ID_CONTRATO));
                              return<div key={ct.ID_CONTRATO} style={{marginBottom:8}}>
                                <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:6}}>
                                  <span style={{fontWeight:600,fontSize:13}}>{ct.ID_CONTRATO}</span>
                                  <Badge c={stCor}>{STATUS_LABEL[String(ct.STATUS_CONTRATO||"").toLowerCase()]||ct.STATUS_CONTRATO}</Badge>
                                  {STATUS_PERDA.includes(String(ct.STATUS_CONTRATO||"").toLowerCase())&&
                                    <button onClick={()=>setTab("perdas")} style={{fontSize:10,padding:"2px 8px",background:"#FEF2F2",border:`1px solid ${RED}`,color:RED,borderRadius:6,cursor:"pointer",fontWeight:600}}>Ver em Perdas</button>}
                                </div>
                                <div style={{display:"flex",gap:3,flexWrap:"wrap"}}>
                                  {ps.map(p=><div key={p.ID_PARCELA} title={`Parc ${p.NUM_PARCELA} — ${p.STATUS}`} style={{width:22,height:22,borderRadius:4,display:"flex",alignItems:"center",justifyContent:"center",fontSize:8,fontWeight:700,background:p.STATUS==="pago"?"#ECFDF5":p.STATUS==="atrasado"?"#FEF2F2":p.ORIGEM_PARCELA==="gerada_por_pagamento_de_juros"?"#F5F3FF":"#F3F4F6",color:p.STATUS==="pago"?GRN:p.STATUS==="atrasado"?RED:p.ORIGEM_PARCELA==="gerada_por_pagamento_de_juros"?PUR:MUTED,border:`1px solid ${p.STATUS==="pago"?GRN:p.STATUS==="atrasado"?RED:p.ORIGEM_PARCELA==="gerada_por_pagamento_de_juros"?PUR:BD}`}}>{p.NUM_PARCELA}</div>)}
                                </div>
                              </div>;
                            })}
                          </div>
                        </td></tr>}
                      </React.Fragment>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>}

          {/* ── CONTRATOS ── */}
          {tab==="contratos"&&<div>
            <div style={{marginBottom:16}}><h1 style={{fontSize:22,fontWeight:700,color:TEXT,margin:0}}>Contratos</h1></div>
            <div style={{display:"grid",gap:12}}>
              {contratos.filter(c=>!["quitado","cancelado"].includes(String(c.STATUS_CONTRATO||"").toLowerCase())).map(c=>{
                const ps=parcelas.filter(p=>String(p.ID_CONTRATO)===String(c.ID_CONTRATO));
                const pago=ps.filter(p=>p.STATUS==="pago").reduce((s,p)=>s+(p.VALOR_PAGO||p.VALOR_PARCELA),0);
                const rest=ps.filter(p=>p.STATUS!=="pago").reduce((s,p)=>s+p.VALOR_PARCELA,0);
                const pct=pago+rest>0?Math.round(pago/(pago+rest)*100):0;
                const st=String(c.STATUS_CONTRATO||"").toLowerCase();
                const stCor=STATUS_COR[st]||MUTED;
                const stLabel=STATUS_LABEL[st]||st;
                const ehPerda=STATUS_PERDA.includes(st);
                return(
                  <div key={c.ID_CONTRATO} style={{background:CARD,borderRadius:10,padding:18,border:`1px solid ${BD}`,borderLeft:`4px solid ${stCor}`,boxShadow:"0 1px 4px rgba(0,0,0,0.05)",opacity:ehPerda&&st==="baixado_como_prejuizo"?0.85:1}}>
                    <div style={{display:"flex",justifyContent:"space-between",flexWrap:"wrap",gap:8,marginBottom:10}}>
                      <div>
                        <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:2}}>
                          <strong style={{fontSize:14}}>{c.ID_CONTRATO}</strong>
                          <Badge c={stCor}>{stLabel}</Badge>
                          {c.BLOQUEADO_PARA_NOVO_CREDITO==="SIM"&&<Badge c={RED}>🚫 Bloqueado</Badge>}
                        </div>
                        <p style={{color:MUTED,fontSize:12,margin:0}}>{c.NOME_CLIENTE}</p>
                      </div>
                      <div style={{textAlign:"right"}}>
                        <p style={{fontSize:15,fontWeight:700,margin:0}}>{fmtR(c.VALOR_PRINCIPAL)}</p>
                        {ehPerda&&<p style={{color:RED,fontSize:12,margin:0}}>Prejuízo: {fmtR(c.PREJUIZO_CAPITAL)}</p>}
                      </div>
                    </div>
                    {!ehPerda&&<>
                      <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:10}}>
                        <div style={{flex:1,height:5,background:BG,borderRadius:3}}><div style={{width:`${pct}%`,height:"100%",borderRadius:3,background:GRN}}/></div>
                        <span style={{color:MUTED,fontSize:11}}>{pct}% pago</span>
                      </div>
                      <div style={{display:"flex",gap:4,flexWrap:"wrap"}}>
                        {ps.map(p=><div key={p.ID_PARCELA} title={`Parc ${p.NUM_PARCELA} — ${p.STATUS}`} style={{width:22,height:22,borderRadius:4,display:"flex",alignItems:"center",justifyContent:"center",fontSize:8,fontWeight:700,background:p.STATUS==="pago"?"#ECFDF5":p.STATUS==="atrasado"?"#FEF2F2":p.ORIGEM_PARCELA==="gerada_por_pagamento_de_juros"?"#F5F3FF":"#F3F4F6",color:p.STATUS==="pago"?GRN:p.STATUS==="atrasado"?RED:p.ORIGEM_PARCELA==="gerada_por_pagamento_de_juros"?PUR:MUTED,border:`1px solid ${p.STATUS==="pago"?GRN:p.STATUS==="atrasado"?RED:BD}`}}>{p.NUM_PARCELA}</div>)}
                      </div>
                    </>}
                    {ehPerda&&<div style={{display:"flex",gap:16,marginTop:8,fontSize:12}}>
                      <span style={{color:RED}}>Prejuízo Capital: <strong>{fmtR(c.PREJUIZO_CAPITAL)}</strong></span>
                      <span style={{color:ORG}}>Juros não realizados: <strong>{fmtR(c.JUROS_NAO_REALIZADOS)}</strong></span>
                      {c.VALOR_RECUPERADO_APOS_BAIXA>0&&<span style={{color:GRN}}>Recuperado: <strong>{fmtR(c.VALOR_RECUPERADO_APOS_BAIXA)}</strong></span>}
                    </div>}
                    {/* Ações */}
                    <div style={{display:"flex",gap:8,marginTop:10,paddingTop:10,borderTop:`1px solid ${BD}`}}>
                      {st==="baixado_como_prejuizo"&&<button onClick={()=>setRecuperacaoModal(c)} style={{padding:"6px 12px",background:"#ECFDF5",border:`1px solid ${GRN}`,color:GRN,borderRadius:6,fontSize:11,fontWeight:600,cursor:"pointer"}}>💰 Registrar Recuperação</button>}
                      {["ativo_em_dia","ativo_em_atraso","em_cobranca","pre_prejuizo"].includes(st)&&<button onClick={()=>setBaixaModal(c)} style={{padding:"6px 12px",background:"#FEF2F2",border:`1px solid ${RED}`,color:RED,borderRadius:6,fontSize:11,fontWeight:600,cursor:"pointer"}}>⚠️ Baixar como Prejuízo</button>}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>}

          {/* ── COBRANÇA ── */}
          {tab==="cobranca"&&<div>
            <div style={{marginBottom:16}}><h1 style={{fontSize:22,fontWeight:700,color:TEXT,margin:0}}>Central de Cobrança</h1></div>
            {cobItems.length===0?<div style={{background:CARD,borderRadius:10,padding:"48px",textAlign:"center",border:`1px solid ${BD}`}}><p style={{fontSize:32,margin:"0 0 8px"}}>✅</p><p style={{color:GRN,fontWeight:700}}>Nenhuma pendência!</p></div>
            :["grave","atrasado","hoje","amanhã"].map(urg=>{
              const items=cobItems.filter(i=>i.urg===urg);if(!items.length)return null;
              const label={grave:"🚨 Atraso Grave (+30 dias)",atrasado:"⛔ Atrasadas",hoje:"🔴 Vence Hoje",amanhã:"🟡 Vence Amanhã"}[urg];
              const col={grave:RED,atrasado:RED,hoje:YEL,amanhã:YEL}[urg];
              return<div key={urg} style={{marginBottom:18}}>
                <h3 style={{color:col,fontWeight:700,fontSize:13,margin:"0 0 8px"}}>{label} ({items.length})</h3>
                <div style={{display:"grid",gap:8}}>
                  {items.map(({p,cl,dias},i)=>(
                    <div key={i} style={{background:CARD,borderRadius:10,padding:"12px 16px",border:`1px solid ${BD}`,borderLeft:`4px solid ${col}`,display:"flex",alignItems:"center",gap:12}}>
                      <div style={{width:36,height:36,borderRadius:"50%",background:col+"18",display:"flex",alignItems:"center",justifyContent:"center"}}><span style={{color:col,fontWeight:700}}>{(cl?.NOME||"?")[0]}</span></div>
                      <div style={{flex:1}}>
                        <div style={{display:"flex",justifyContent:"space-between"}}><strong style={{fontSize:13}}>{cl?.NOME||"Cliente"}</strong><strong style={{color:col}}>{fmtR(p.VALOR_PARCELA)}</strong></div>
                        <div style={{display:"flex",gap:10,marginTop:3,fontSize:11,color:MUTED}}>
                          <span>Parc {p.NUM_PARCELA}/{p.TOTAL_PARCELAS}</span><span>Venc: {fmtDt(p.DATA_VENCIMENTO)}</span>{cl?.TELEFONE_WPP&&<span>📱 {cl.TELEFONE_WPP}</span>}
                          <span style={{color:col,fontWeight:600}}>{dias<0?`${Math.abs(dias)}d atraso`:dias===0?"HOJE":"AMANHÃ"}</span>
                        </div>
                      </div>
                      <button onClick={()=>setTab("pagamentos")} style={{padding:"6px 12px",background:col,color:"#fff",border:"none",borderRadius:6,fontSize:11,fontWeight:600,cursor:"pointer"}}>Registrar</button>
                    </div>
                  ))}
                </div>
              </div>;
            })}
          </div>}

          {/* ── PERDAS E RECUPERAÇÃO ── */}
          {tab==="perdas"&&<div>
            <div style={{marginBottom:20}}><h1 style={{fontSize:22,fontWeight:700,color:TEXT,margin:0}}>Perdas e Recuperação de Crédito</h1><p style={{color:MUTED,fontSize:13,margin:"4px 0 0"}}>Contratos problemáticos, prejuízo de capital e histórico de recuperação</p></div>

            {/* KPIs de perdas */}
            <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:14,marginBottom:20}}>
              {[
                {icon:"🚨",label:"Em Cobrança",val:perdas.cEmCobranca?.length||0,sub:"contratos",c:ORG,bg:"#FFF7ED"},
                {icon:"⚠️",label:"Pré-Prejuízo",val:perdas.cPrePrejuizo?.length||0,sub:"contratos",c:"#DC2626",bg:"#FEF2F2"},
                {icon:"📉",label:"Baixados Prejuízo",val:perdas.cBaixados?.length||0,sub:"contratos",c:RED,bg:"#FEF2F2"},
                {icon:"💰",label:"Em Recuperação",val:perdas.cRecuperacao?.length||0,sub:"contratos",c:GRN,bg:"#ECFDF5"},
              ].map(k=>(
                <div key={k.label} style={{background:CARD,borderRadius:10,padding:18,border:`1px solid ${BD}`,boxShadow:"0 1px 4px rgba(0,0,0,0.05)"}}>
                  <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:10}}><div style={{width:34,height:34,background:k.bg,borderRadius:8,display:"flex",alignItems:"center",justifyContent:"center",fontSize:18}}>{k.icon}</div><p style={{color:MUTED,fontSize:11,margin:0}}>{k.label}</p></div>
                  <p style={{fontSize:22,fontWeight:800,color:k.c,margin:"0 0 2px"}}>{k.val}</p><p style={{fontSize:11,color:MUTED,margin:0}}>{k.sub}</p>
                </div>
              ))}
            </div>

            {/* KPIs financeiros de perdas */}
            <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:14,marginBottom:20}}>
              {[
                {label:"Capital Baixado",val:fmtR(perdas.capitalBaixado),sub:"total emprestado nos contratos baixados",c:RED,icon:"🏦"},
                {label:"Prejuízo Real de Capital",val:fmtR(perdas.prejuizoTotal),sub:"capital não recuperado (≠ total com juros)",c:RED,icon:"📉"},
                {label:"Juros Não Realizados",val:fmtR(perdas.jurosNaoRealizados),sub:"lucro previsto que não entrou",c:ORG,icon:"💸"},
                {label:"Recuperado Após Baixa",val:fmtR(perdas.recuperadoAposBaixa),sub:"recebido após marcar como prejuízo",c:GRN,icon:"💰"},
                {label:"Taxa de Recuperação",val:fmtP(perdas.txRecuperacao),sub:"do capital baixado que voltou",c:perdas.txRecuperacao>30?GRN:YEL,icon:"📊"},
                {label:"Prejuízo Atualizado",val:fmtR(Math.max(0,perdas.prejuizoTotal-perdas.recuperadoAposBaixa)),sub:"após descontar recuperações",c:RED,icon:"🔄"},
              ].map(k=>(
                <div key={k.label} style={{background:CARD,borderRadius:10,padding:18,border:`1px solid ${BD}`,boxShadow:"0 1px 4px rgba(0,0,0,0.05)"}}>
                  <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:8}}><span style={{fontSize:20}}>{k.icon}</span></div>
                  <p style={{color:MUTED,fontSize:11,fontWeight:600,textTransform:"uppercase",margin:"0 0 4px"}}>{k.label}</p>
                  <p style={{fontSize:20,fontWeight:800,color:k.c,margin:"0 0 2px"}}>{k.val}</p>
                  <p style={{fontSize:11,color:MUTED,margin:0}}>{k.sub}</p>
                </div>
              ))}
            </div>

            {/* Aviso separação prejuízo vs lucro não realizado */}
            <div style={{background:"#FFFBEB",border:`1px solid ${YEL}`,borderRadius:10,padding:14,marginBottom:20}}>
              <p style={{color:"#92400E",fontSize:13,fontWeight:600,margin:"0 0 4px"}}>💡 Separação contábil importante</p>
              <p style={{color:"#92400E",fontSize:12,margin:0}}>O <strong>Prejuízo Real</strong> ({fmtR(perdas.prejuizoTotal)}) representa capital próprio não recuperado. Os <strong>Juros Não Realizados</strong> ({fmtR(perdas.jurosNaoRealizados)}) são lucro previsto que não se concretizou — não confundir com perda de caixa.</p>
            </div>

            {/* Filtro */}
            <div style={{display:"flex",gap:10,marginBottom:16}}>
              {[["todos","Todos"],["em_cobranca","Em Cobrança"],["pre_prejuizo","Pré-Prejuízo"],["baixado_como_prejuizo","Baixados"],["em_recuperacao","Em Recuperação"],["recuperado_parcialmente","Rec. Parcial"]].map(([v,l])=>(
                <button key={v} onClick={()=>setFiltroPerdas(v)} style={{padding:"6px 14px",borderRadius:20,border:`1px solid ${filtroPerdas===v?RED:BD}`,background:filtroPerdas===v?"#FEF2F2":CARD,color:filtroPerdas===v?RED:MUTED,fontSize:12,fontWeight:filtroPerdas===v?600:400,cursor:"pointer"}}>{l}</button>
              ))}
            </div>

            {/* Lista de contratos problemáticos */}
            <div style={{display:"grid",gap:12}}>
              {[...perdas.cEmCobranca||[],...perdas.cPrePrejuizo||[],...perdas.cBaixados||[],...perdas.cRecuperacao||[]]
                .filter(c=>filtroPerdas==="todos"||String(c.STATUS_CONTRATO||"").toLowerCase()===filtroPerdas)
                .map(c=>{
                  const st=String(c.STATUS_CONTRATO||"").toLowerCase();
                  const stCor=STATUS_COR[st]||MUTED;
                  const stLabel=STATUS_LABEL[st]||st;
                  const pctRecup=c.VALOR_PRINCIPAL>0?(c.VALOR_RECUPERADO_APOS_BAIXA/c.VALOR_PRINCIPAL*100):0;
                  return(
                    <div key={c.ID_CONTRATO} style={{background:CARD,borderRadius:10,padding:20,border:`2px solid ${stCor}30`,boxShadow:"0 1px 4px rgba(0,0,0,0.05)"}}>
                      <div style={{display:"flex",justifyContent:"space-between",flexWrap:"wrap",gap:8,marginBottom:12}}>
                        <div>
                          <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:4}}>
                            <strong style={{fontSize:14}}>{c.ID_CONTRATO}</strong>
                            <Badge c={stCor}>{stLabel}</Badge>
                            {c.SUBSTATUS_PREJUIZO&&<Badge c={MUTED}>{c.SUBSTATUS_PREJUIZO}</Badge>}
                            {c.POSSIBILIDADE_RECUPERACAO&&<Badge c={c.POSSIBILIDADE_RECUPERACAO==="ALTA"?GRN:c.POSSIBILIDADE_RECUPERACAO==="MEDIA"?YEL:RED}>Rec: {c.POSSIBILIDADE_RECUPERACAO}</Badge>}
                          </div>
                          <p style={{color:MUTED,fontSize:12,margin:0}}>{c.NOME_CLIENTE}</p>
                          {c.MOTIVO_BAIXA_PREJUIZO&&<p style={{color:RED,fontSize:11,margin:"3px 0 0"}}>Motivo: {c.MOTIVO_BAIXA_PREJUIZO}</p>}
                        </div>
                        <div style={{textAlign:"right"}}>
                          <p style={{fontSize:15,fontWeight:700,margin:0}}>{fmtR(c.VALOR_PRINCIPAL)}</p>
                          <p style={{color:MUTED,fontSize:11,margin:0}}>Capital emprestado</p>
                          {c.DATA_BAIXA_PREJUIZO&&<p style={{color:RED,fontSize:11,margin:"2px 0 0"}}>Baixado em: {fmtDt(parseDate(c.DATA_BAIXA_PREJUIZO))}</p>}
                        </div>
                      </div>
                      {/* Resumo financeiro do contrato */}
                      <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:10,marginBottom:12}}>
                        {[["Prejuízo Capital",fmtR(c.PREJUIZO_CAPITAL),RED],["Juros Não Real.",fmtR(c.JUROS_NAO_REALIZADOS),ORG],["Recuperado",fmtR(c.VALOR_RECUPERADO_APOS_BAIXA),GRN]].map(([l,v,col])=>(
                          <div key={l} style={{background:BG,borderRadius:7,padding:"10px 12px"}}>
                            <p style={{color:MUTED,fontSize:10,textTransform:"uppercase",margin:"0 0 3px"}}>{l}</p>
                            <p style={{color:col,fontWeight:700,fontSize:14,margin:0}}>{v}</p>
                          </div>
                        ))}
                      </div>
                      {c.VALOR_RECUPERADO_APOS_BAIXA>0&&<div style={{marginBottom:10}}>
                        <div style={{display:"flex",alignItems:"center",gap:8}}>
                          <div style={{flex:1,height:6,background:"#FEE2E2",borderRadius:3}}><div style={{width:`${Math.min(100,pctRecup)}%`,height:"100%",borderRadius:3,background:GRN}}/></div>
                          <span style={{color:GRN,fontWeight:600,fontSize:11}}>{fmtP(pctRecup)} recuperado</span>
                        </div>
                      </div>}
                      {c.PROXIMA_PROVIDENCIA&&<p style={{color:BLU,fontSize:12,margin:"0 0 10px"}}>📋 Próx. providência: {c.PROXIMA_PROVIDENCIA}</p>}
                      {c.STATUS_JURIDICO&&c.STATUS_JURIDICO!=="NAO_ANALISADO"&&<p style={{color:PUR,fontSize:12,margin:"0 0 10px"}}>⚖️ Jurídico: {c.STATUS_JURIDICO}</p>}
                      {/* Ações */}
                      <div style={{display:"flex",gap:8}}>
                        {st==="baixado_como_prejuizo"&&<button onClick={()=>setRecuperacaoModal(c)} style={{padding:"7px 14px",background:"#ECFDF5",border:`1px solid ${GRN}`,color:GRN,borderRadius:7,fontSize:12,fontWeight:600,cursor:"pointer"}}>💰 Registrar Recuperação</button>}
                        {["em_cobranca","pre_prejuizo","ativo_em_atraso"].includes(st)&&<button onClick={()=>setBaixaModal(c)} style={{padding:"7px 14px",background:"#FEF2F2",border:`1px solid ${RED}`,color:RED,borderRadius:7,fontSize:12,fontWeight:600,cursor:"pointer"}}>⚠️ Baixar como Prejuízo</button>}
                      </div>
                    </div>
                  );
                })}
              {[...perdas.cEmCobranca||[],...perdas.cPrePrejuizo||[],...perdas.cBaixados||[],...perdas.cRecuperacao||[]].filter(c=>filtroPerdas==="todos"||String(c.STATUS_CONTRATO||"").toLowerCase()===filtroPerdas).length===0&&(
                <div style={{background:CARD,borderRadius:10,padding:"48px",textAlign:"center",border:`1px solid ${BD}`}}><p style={{fontSize:28,margin:"0 0 8px"}}>✅</p><p style={{color:GRN,fontWeight:700}}>Nenhum contrato nesta categoria</p></div>
              )}
            </div>
          </div>}

          {/* ── FINANCEIRO ── */}
          {tab==="financeiro"&&(()=>{
            const DIAS_SEM=["D","S","T","Q","Q","S","S"];
            const MESES_PT=["Janeiro","Fevereiro","Março","Abril","Maio","Junho","Julho","Agosto","Setembro","Outubro","Novembro","Dezembro"];
            function diasDoMes(ano,mes){return new Date(ano,mes+1,0).getDate();}
            function primeiroDiaSem(ano,mes){return new Date(ano,mes,1).getDay();}
            function dStr(d){if(!d)return"";return d.toLocaleDateString("pt-BR",{day:"2-digit",month:"2-digit",year:"numeric"});}
            const periodoLabel={
              "tudo":"Todo período","7d":"Últimos 7 dias","30d":"Últimos 30 dias",
              "3m":"Últimos 3 meses","6m":"Últimos 6 meses","1a":"Último ano",
              "custom":customDe&&customAte?`${dStr(customDe)} → ${dStr(customAte)}`:customDe?`A partir de ${dStr(customDe)}`:"Personalizado"
            };
            const periodoAtivo=periodo==="custom"&&!customDe?"tudo":periodo;

            function clicarDia(d){
              if(rangeStep===0){setCustomDe(d);setCustomAte(null);setRangeStep(1);}
              else{
                if(d<customDe){setCustomDe(d);setCustomAte(customDe);}
                else{setCustomAte(d);}
                setRangeStep(0);setPeriodo("custom");setCalOpen(false);
              }
            }
            function dentroRange(d){
              if(!customDe||!customAte) return false;
              return d>=customDe&&d<=customAte;
            }
            function ehInicio(d){return customDe&&d.getTime()===customDe.getTime();}
            function ehFim(d){return customAte&&d.getTime()===customAte.getTime();}
            function ehHoje(d){return d.getTime()===hoje.getTime();}

            const ano=calMes.getFullYear(), mes=calMes.getMonth();
            const totalDias=diasDoMes(ano,mes), primDia=primeiroDiaSem(ano,mes);
            const celulas=[];
            for(let i=0;i<primDia;i++) celulas.push(null);
            for(let i=1;i<=totalDias;i++) celulas.push(new Date(ano,mes,i));

            const pagFiltrados = pagamentos.filter(p => {
              if (periodoAtivo === "tudo") return true;
              if (!p.DATA_PAGAMENTO) return false;
              
              const nDt = toNum(p.DATA_PAGAMENTO);
              if(!nDt) return false;
              
              if (periodoAtivo === "custom") {
                const nDe = toNum(customDe);
                const nAte = customAte ? toNum(customAte) : toNum(new Date());
                return nDt >= nDe && nDt <= nAte;
              }
              
              const dCorte = new Date(hoje);
              if(periodoAtivo==="7d")  dCorte.setDate(dCorte.getDate()-7);
              else if(periodoAtivo==="30d") dCorte.setDate(dCorte.getDate()-30);
              else if(periodoAtivo==="3m")  dCorte.setMonth(dCorte.getMonth()-3);
              else if(periodoAtivo==="6m")  dCorte.setMonth(dCorte.getMonth()-6);
              else if(periodoAtivo==="1a")  dCorte.setFullYear(dCorte.getFullYear()-1);
              
              return nDt >= toNum(dCorte);
            }).sort((a,b) => {
              const nA = toNum(a.DATA_PAGAMENTO);
              const nB = toNum(b.DATA_PAGAMENTO);
              if(nA !== nB) return nB - nA;
              return String(b.NOME_CLIENTE).localeCompare(String(a.NOME_CLIENTE));
            });

            // KPIs filtrados para os cartões superiores
            const kpiF = {
              receitaTotal: pagFiltrados.reduce((s,p)=>s+p.VALOR_PAGO,0),
              extraAtraso: pagFiltrados.reduce((s,p)=>s+(p.RECEITA_EXTRA_ATRASO||0),0),
              normais: pagFiltrados.filter(p=>p.TIPO_PAGAMENTO==="pagamento_normal").length,
              atraso: pagFiltrados.filter(p=>p.TIPO_PAGAMENTO==="pagamento_com_atraso").length,
              juros: pagFiltrados.filter(p=>p.TIPO_PAGAMENTO==="somente_juros").length,
            };

            return <div>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:20,flexWrap:"wrap",gap:10}}>
              <h1 style={{fontSize:22,fontWeight:700,color:TEXT,margin:0}}>Painel Financeiro</h1>
              
              <div style={{display:"flex",alignItems:"center",gap:6,flexWrap:"wrap"}}>
                <span style={{color:MUTED,fontSize:11,fontWeight:600,textTransform:"uppercase",letterSpacing:"0.05em",marginRight:2}}>Filtrar Pagamentos:</span>
                {[["tudo","Tudo"],["7d","7d"],["30d","30d"],["3m","3m"],["6m","6m"],["1a","1 ano"]].map(([v,l])=>(
                  <button key={v} onClick={()=>{setPeriodo(v);setCustomDe(null);setCustomAte(null);setCalOpen(false);}}
                    style={{padding:"5px 12px",borderRadius:20,border:`1px solid ${periodoAtivo===v?BLU:BD}`,background:periodoAtivo===v?BLU:CARD,color:periodoAtivo===v?"#fff":MUTED,fontSize:12,fontWeight:periodoAtivo===v?700:400,cursor:"pointer",transition:"all 0.15s"}}>
                    {l}
                  </button>
                ))}

                <div style={{position:"relative"}}>
                  <button onClick={()=>{setCalOpen(o=>!o);setRangeStep(0);}}
                    style={{display:"flex",alignItems:"center",gap:6,padding:"5px 12px",borderRadius:20,border:`1px solid ${periodo==="custom"&&customDe?BLU:BD}`,background:periodo==="custom"&&customDe?BLU:CARD,color:periodo==="custom"&&customDe?"#fff":MUTED,fontSize:12,fontWeight:periodo==="custom"&&customDe?700:400,cursor:"pointer"}}>
                    📅 {periodoLabel[periodoAtivo]}
                  </button>
                  {calOpen&&<div style={{position:"absolute",top:"100%",right:0,marginTop:8,background:CARD,border:`1px solid ${BD}`,borderRadius:12,boxShadow:"0 10px 25px rgba(0,0,0,0.1)",padding:16,zIndex:200,width:280}}>
                    <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:12}}>
                      <button onClick={()=>setCalMes(new Date(ano,mes-1,1))} style={{background:"none",border:"none",cursor:"pointer",padding:4,color:MUTED}}>❮</button>
                      <strong style={{fontSize:13}}>{MESES_PT[mes]} {ano}</strong>
                      <button onClick={()=>setCalMes(new Date(ano,mes+1,1))} style={{background:"none",border:"none",cursor:"pointer",padding:4,color:MUTED}}>❯</button>
                    </div>
                    <div style={{display:"grid",gridTemplateColumns:"repeat(7,1fr)",gap:2,marginBottom:4}}>
                      {DIAS_SEM.map(d=><div key={d} style={{textAlign:"center",fontSize:10,fontWeight:700,color:MUTED,padding:4}}>{d}</div>)}
                      {celulas.map((d,i)=>{
                        if(!d) return <div key={i}/>;
                        const sel=ehInicio(d)||ehFim(d), range=dentroRange(d), hj=ehHoje(d);
                        return <button key={i} onClick={()=>clicarDia(d)}
                          style={{aspectRatio:"1",border:"none",borderRadius:6,background:sel?BLU:range?"#EFF6FF":"none",color:sel?"#fff":range?BLU:TEXT,fontSize:11,fontWeight:sel?700:400,cursor:"pointer",position:"relative",display:"flex",alignItems:"center",justifyContent:"center"}}>
                          {i-primDia+1}
                          {hj&&!sel&&<div style={{position:"absolute",bottom:4,width:3,height:3,borderRadius:"50%",background:BLU}}/>}
                        </button>
                      })}
                    </div>
                    <div style={{borderTop:`1px solid ${BD}`,paddingTop:10,marginTop:4,display:"flex",justifyContent:"space-between",alignItems:"center"}}>
                      <span style={{fontSize:10,color:MUTED}}>{rangeStep===0?"Selecione início":"Selecione fim"}</span>
                      <button onClick={()=>{setPeriodo("tudo");setCustomDe(null);setCustomAte(null);setCalOpen(false);}} style={{background:"none",border:"none",color:BLU,fontSize:11,fontWeight:600,cursor:"pointer"}}>Limpar</button>
                    </div>
                  </div>}
                </div>
              </div>
            </div>

            <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:14,marginBottom:20}}>
              {[
                {icon:"💵",label:"Receita Total",val:fmtR(kpiF.receitaTotal),c:BLU},
                {icon:"⏰",label:"Receita Extra Atraso",val:fmtR(kpiF.extraAtraso),c:ORG},
                {icon:"🔄",label:"Parcelas Prorrogadas",val:M.qtyProrrogadas,c:PUR},
                {icon:"✅",label:"Pagamentos Normais",val:kpiF.normais,c:GRN},
                {icon:"⚠️",label:"Com Atraso",val:kpiF.atraso,c:YEL},
                {icon:"💸",label:"Somente Juros",val:kpiF.juros,c:RED},
              ].map(k=>(
                <div key={k.label} style={{background:CARD,borderRadius:10,padding:18,border:`1px solid ${BD}`}}>
                  <p style={{color:MUTED,fontSize:11,margin:"0 0 6px"}}>{k.icon} {k.label}</p>
                  <p style={{fontSize:20,fontWeight:700,color:k.c,margin:0}}>{k.val}</p>
                </div>
              ))}
            </div>
            <div style={{background:CARD,borderRadius:10,padding:20,border:`1px solid ${BD}`,marginBottom:16}}>
              <h3 style={{fontSize:14,fontWeight:700,margin:"0 0 14px"}}>Receita Mensal (Total × Extra por Atraso)</h3>
              <ResponsiveContainer width="100%" height={200}>
                <BarChart data={mensal} margin={{top:4,right:4,bottom:0,left:-10}}>
                  <CartesianGrid strokeDasharray="3 3" stroke={BD} vertical={false}/>
                  <XAxis dataKey="mes" tick={{fill:MUTED,fontSize:11}} axisLine={false} tickLine={false}/>
                  <YAxis tick={{fill:MUTED,fontSize:10}} tickFormatter={v=>`R$${(v/1000).toFixed(0)}k`} axisLine={false} tickLine={false}/>
                  <TT formatter={(v,n)=>[fmtR(v),n==="receita"?"Receita Total":"Extra Atraso"]}/>
                  <Bar dataKey="receita" fill={BLU} radius={[4,4,0,0]}/>
                  <Bar dataKey="extra" fill={ORG} radius={[4,4,0,0]}/>
                </BarChart>
              </ResponsiveContainer>
            </div>
            {/* Pagamentos do Período */}
            <div style={{background:CARD,borderRadius:10,border:`1px solid ${BD}`}}>
              <div style={{padding:"14px 20px",borderBottom:`1px solid ${BD}`,display:"flex",justifyContent:"space-between",alignItems:"center"}}>
                <h3 style={{fontSize:14,fontWeight:700,margin:0}}>Pagamentos no Período ({pagFiltrados.length})</h3>
                <span style={{fontSize:12,color:MUTED}}>Total: <strong>{fmtR(pagFiltrados.reduce((s,p)=>s+p.VALOR_PAGO,0))}</strong></span>
              </div>
              <div style={{maxHeight:400,overflowY:"auto"}}>
                <table style={{width:"100%",borderCollapse:"collapse"}}>
                  <thead style={{position:"sticky",top:0,zIndex:10}}><tr style={{background:BG}}>{["Data","Cliente","Tipo","Valor Original","Valor Pago","Diferença"].map(h=><th key={h} style={{textAlign:"left",padding:"10px 20px",color:MUTED,fontSize:11,fontWeight:700,textTransform:"uppercase"}}>{h}</th>)}</tr></thead>
                  <tbody>
                    {pagFiltrados.length===0 ? <tr><td colSpan="6" style={{padding:40,textAlign:"center",color:MUTED}}>Nenhum pagamento encontrado neste período.</td></tr> :
                    pagFiltrados.map((p,i)=>{
                      const tCor={pagamento_normal:GRN,pagamento_com_atraso:YEL,somente_juros:RED,recuperacao_apos_baixa:PUR}[p.TIPO_PAGAMENTO]||MUTED;
                      const tLabel={pagamento_normal:"Normal",pagamento_com_atraso:"Com Atraso",somente_juros:"Somente Juros",recuperacao_apos_baixa:"Recuperação"}[p.TIPO_PAGAMENTO]||p.TIPO_PAGAMENTO||"—";
                      return<tr key={i} style={{borderTop:`1px solid ${BD}`}}>
                        <td style={{padding:"10px 20px",color:MUTED,fontSize:12}}>{fmtDt(p.DATA_PAGAMENTO)}</td>
                        <td style={{padding:"10px 20px",fontSize:12,fontWeight:500}}>{p.NOME_CLIENTE}</td>
                        <td style={{padding:"10px 20px"}}><Badge c={tCor}>{tLabel}</Badge></td>
                        <td style={{padding:"10px 20px",color:MUTED,fontSize:12}}>{fmtR(p.VALOR_ORIGINAL_PARCELA)}</td>
                        <td style={{padding:"10px 20px",fontWeight:600,fontSize:12}}>{fmtR(p.VALOR_PAGO)}</td>
                        <td style={{padding:"10px 20px",color:p.RECEITA_EXTRA_ATRASO>0?ORG:MUTED,fontWeight:p.RECEITA_EXTRA_ATRASO>0?700:400,fontSize:12}}>{p.RECEITA_EXTRA_ATRASO>0?`+${fmtR(p.RECEITA_EXTRA_ATRASO)}`:"—"}</td>
                      </tr>;
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          </div>})()}

          {/* ── KPIs ── */}
          {tab==="kpis"&&<div>
            <div style={{marginBottom:20}}><h1 style={{fontSize:22,fontWeight:700,color:TEXT,margin:0}}>Análise de Crédito</h1></div>
            <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:14}}>
              {[
                {l:"Inadimplência",v:fmtP(M.taxaInad),raw:M.taxaInad,ok:10,warn:20,rev:true,desc:"Atrasado / total a receber",ideal:"< 10%",icon:"⚠️"},
                {l:"Saldo Devedor",v:fmtR(M.saldoDevedor),raw:null,desc:"Capital + juros a receber (contratos ativos)",ideal:"—",icon:"🏦"},
                {l:"Lucro Realizado (total)",v:fmtR(M.lucroTotal),raw:null,desc:"Juros + extra recebidos — excluído o capital",ideal:"—",icon:"💸"},
                {l:"Contratos em Cobrança",v:perdas.cEmCobranca?.length||0,raw:null,desc:"",ideal:"—",icon:"📞"},
                {l:"Capital em Prejuízo",v:fmtR(perdas.capitalBaixado),raw:null,desc:"Contratos baixados",ideal:"0",icon:"📉"},
                {l:"Prejuízo Real",v:fmtR(perdas.prejuizoTotal),raw:null,desc:"Capital não recuperado",ideal:"0",icon:"🔻"},
                {l:"Recuperado s/ Baixa",v:fmtR(perdas.recuperadoAposBaixa),raw:null,desc:"",ideal:"> 0",icon:"💰"},
                {l:"Taxa de Recuperação",v:fmtP(perdas.txRecuperacao),raw:null,desc:"Capital baixado recuperado",ideal:"> 30%",icon:"📊"},
                {l:"Receita Extra Atraso",v:fmtR(M.receitaExtraTotal),raw:null,desc:"Juros/multa por atraso",ideal:"—",icon:"⏰"},
              ].map(k=>{
                const col=k.raw!=null?(k.rev?(k.raw<=k.ok?GRN:k.raw<=k.warn?YEL:RED):(k.raw>=k.ok?GRN:k.raw>=k.warn?YEL:RED)):MUTED;
                return<div key={k.l} style={{background:CARD,borderRadius:10,padding:20,border:`1px solid ${BD}`}}>
                  <span style={{fontSize:22}}>{k.icon}</span>
                  <p style={{color:MUTED,fontSize:11,fontWeight:600,textTransform:"uppercase",margin:"8px 0 4px"}}>{k.l}</p>
                  <p style={{fontSize:22,fontWeight:800,color:k.raw!=null?col:TEXT,margin:"0 0 4px"}}>{k.v}</p>
                  <p style={{fontSize:11,color:MUTED,margin:0}}>{k.desc} {k.ideal!=="—"?`— ideal: ${k.ideal}`:""}</p>
                </div>;
              })}
            </div>
          </div>}

          {/* ── SIMULADOR ── */}
          {tab==="simulador"&&(()=>{
            const inadPct=((M.taxaInad||0)+simInad)/100;
            const novaCarteira=(M.saldoDevedor||0)+simVal;
            const perdaExtra=novaCarteira*inadPct;
            const lucroProj=(M.lucroMes||0)*(1+simVol/100)-perdaExtra*0.08;
            const risco=inadPct>0.3?"crítico":inadPct>0.15?"atenção":"saudável";
            const rc=risco==="crítico"?RED:risco==="atenção"?YEL:GRN;
            return<div>
              <div style={{marginBottom:20}}><h1 style={{fontSize:22,fontWeight:700,color:TEXT,margin:0}}>Simulador</h1></div>
              <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:20}}>
                <div style={{display:"grid",gap:14}}>
                  {[{l:"💵 Novo Empréstimo (R$)",v:simVal,set:setSimVal,min:0,max:50000,step:500,fmt:fmtR},{l:"📉 Aumento Inadimplência (%)",v:simInad,set:setSimInad,min:0,max:40,step:1,fmt:v=>v+"%"},{l:"📈 Crescimento do Volume (%)",v:simVol,set:setSimVol,min:-50,max:100,step:5,fmt:v=>v+"%"}].map(inp=>(
                    <div key={inp.l} style={{background:CARD,borderRadius:10,padding:18,border:`1px solid ${BD}`}}>
                      <p style={{color:MUTED,fontSize:12,fontWeight:600,margin:"0 0 10px"}}>{inp.l}</p>
                      <input type="range" min={inp.min} max={inp.max} step={inp.step} value={inp.v} onChange={e=>inp.set(Number(e.target.value))} style={{width:"100%",accentColor:BLU,margin:"0 0 8px"}}/>
                      <strong style={{color:BLU,fontSize:18}}>{inp.fmt(inp.v)}</strong>
                    </div>
                  ))}
                  <button onClick={()=>{setSimVal(5000);setSimInad(0);setSimVol(0);}} style={{padding:"10px",borderRadius:8,border:`1px solid ${BD}`,background:CARD,color:MUTED,fontWeight:600,cursor:"pointer"}}>🔄 Resetar</button>
                </div>
                <div style={{background:CARD,borderRadius:10,padding:20,border:`2px solid ${rc}`}}>
                  <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:14}}><h3 style={{fontSize:15,fontWeight:700,margin:0}}>Resultado</h3><Badge c={rc}>{risco.toUpperCase()}</Badge></div>
                  {[{l:"Nova Carteira",v:fmtR(novaCarteira),c:BLU},{l:"Perda Estimada",v:fmtR(perdaExtra),c:perdaExtra>5000?RED:YEL},{l:"Lucro Projetado",v:fmtR(lucroProj),c:lucroProj>0?GRN:RED}].map((r,i)=>(
                    <div key={r.l} style={{display:"flex",justifyContent:"space-between",padding:"12px 0",borderBottom:i<2?`1px solid ${BD}`:"none"}}>
                      <span style={{color:MUTED}}>{r.l}</span><strong style={{color:r.c,fontSize:15}}>{r.v}</strong>
                    </div>
                  ))}
                  <div style={{marginTop:14,padding:12,background:rc+"10",borderRadius:8}}>
                    <p style={{color:rc,fontWeight:700,fontSize:12,margin:"0 0 4px"}}>💡 Recomendação</p>
                    <p style={{color:MUTED,fontSize:12,margin:0}}>{risco==="crítico"?"Inadimplência crítica. Não expanda a carteira.":risco==="atenção"?"Atenção necessária. Avalie novos contratos com critério.":"Cenário saudável. Expansão controlada é viável."}</p>
                  </div>
                </div>
              </div>
            </div>;
          })()}

        </main>
      </div>
    </div>
  );
}

createRoot(document.getElementById("root")).render(<App/>);
