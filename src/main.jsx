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
      const partes = s.split("/");
      let dia = parseInt(partes[0]);
      let mes = parseInt(partes[1]);
      let ano = parseInt(partes[2]);
      if(ano < 100) ano += 2000;
      d = new Date(ano, mes - 1, dia, 12, 0, 0);
    } else if(s.includes("-")){
      const partes = s.split("T")[0].split("-");
      let ano = parseInt(partes[0]);
      let mes = parseInt(partes[1]);
      let dia = parseInt(partes[2]);
      if(ano < 100) ano += 2000;
      d = new Date(ano, mes - 1, dia, 12, 0, 0);
    } else {
      d = new Date(v);
    }
  } else {
    d = new Date(v);
  }

  if(isNaN(d.getTime())) return null;
  if(d.getFullYear() < 2000) d.setFullYear(d.getFullYear() + 100);
  
  d.setHours(12,0,0,0);
  return d;
}

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
          <p style={{fontSize:13,color:MUTED,margin:"4px 0 0"}}>Contrato {contrato.ID_CONTRATO} • {contrato.NOME_CLIENTE}</p>
        </div>
        <div style={{padding:24,overflowY:"auto",flex:1}}>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:16,marginBottom:24,padding:16,background:BG,borderRadius:8}}>
            <div><span style={LS}>Capital em Prejuízo</span><strong style={{fontSize:16,color:RED}}>{fmtR(prejuizoCapital)}</strong></div>
            <div><span style={LS}>Juros Não Realizados</span><strong style={{fontSize:16,color:MUTED}}>{fmtR(jurosNaoReal)}</strong></div>
            <div><span style={LS}>Recuperação (Capital)</span><strong>{fmtP(pctRecuperado)}</strong></div>
            <div><span style={LS}>Dias em Atraso</span><strong>{diasAtraso} dias</strong></div>
          </div>
          <div style={{display:"flex",flexDirection:"column",gap:16}}>
            {campo("Classificação de Baixa","substatus",[
              {v:"CLIENTE_DESAPARECIDO",l:"Cliente Desaparecido / Sem Contato"},
              {v:"SEM_BENS_PENHORAVEIS",l:"Sem Bens / Insolventente"},
              {v:"FRAUDE_IDENTIFICADA",l:"Suspeita de Fraude"},
              {v:"FALECIMENTO",l:"Falecimento"},
              {v:"ACORDO_JUDICIAL_PERDA",l:"Acordo Judicial (com perda)"},
              {v:"OUTROS",l:"Outros Motivos"}
            ])}
            {campo("Motivo Detalhado","motivo")}
            {campo("Possibilidade de Recuperação","possibilidadeRecuperacao",[
              {v:"BAIXA",l:"Baixa Definitiva (Remover da Cobrança)"},
              {v:"REMOTA",l:"Remota (Acompanhar esporadicamente)"},
              {v:"PROVAVEL",l:"Provável (Manter em Recuperação)"}
            ])}
            {campo("Status Jurídico","statusJuridico",[
              {v:"NAO_ANALISADO",l:"Não analisado pelo jurídico"},
              {v:"EM_ANALISE",l:"Em análise de viabilidade"},
              {v:"AJUIZADO",l:"Processo Ajuizado"},
              {v:"EXECUCAO_BENS",l:"Em fase de execução/penhora"},
              {v:"INCIVEL",l:"Inviável judicialmente"}
            ])}
            {campo("Próxima Providência","proximaProvidencia")}
          </div>
          {msg && <div style={{marginTop:16,padding:12,borderRadius:8,background:msg.ok?GRN+"10":RED+"10",color:msg.ok?GRN:RED,fontSize:13}}>{msg.texto}</div>}
        </div>
        <div style={{padding:20,borderTop:`1px solid ${BD}`,display:"flex",justifyContent:"flex-end",gap:12}}>
          <button onClick={onFechar} style={{padding:"10px 20px",borderRadius:8,border:`1px solid ${BD}`,background:CARD,color:MUTED,fontWeight:600,cursor:"pointer"}}>Cancelar</button>
          <button onClick={confirmar} disabled={loading} style={{padding:"10px 24px",borderRadius:8,border:"none",background:RED,color:"#FFF",fontWeight:600,cursor:loading?"not-allowed":"pointer",opacity:loading?0.7:1}}>{loading?"Processando...":"Confirmar Baixa"}</button>
        </div>
      </div>
    </div>
  );
}

function RecuperacaoModal({contrato, onConfirmar, onFechar}){
  const [valor, setValor] = useState("");
  const [data, setData]   = useState(hojeStr());
  const [forma, setForma] = useState("dinheiro");
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState(null);

  const confirmar = async () => {
    const v = parseFloat(valor);
    if (!v || v <= 0){ setMsg({ok:false,texto:"Informe um valor válido."}); return; }
    setLoading(true); setMsg(null);
    const res = await postAction({ action:"recuperacaoAposBaixa", idContrato: contrato.ID_CONTRATO, dados:{ valor:v, data, forma } });
    if(res.ok){ onConfirmar(); }
    else setMsg({ok:false, texto: res.erro||"Erro."});
    setLoading(false);
  };

  return (
    <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.5)",zIndex:400,display:"flex",alignItems:"center",justifyContent:"center",padding:20}}>
      <div style={{background:CARD,borderRadius:12,width:"100%",maxWidth:450,boxShadow:"0 20px 60px rgba(0,0,0,0.2)"}}>
        <div style={{padding:"20px 24px 14px",borderBottom:`1px solid ${BD}`,background:PUR+"10",borderRadius:"12px 12px 0 0"}}>
          <h2 style={{color:PUR,fontSize:17,fontWeight:700,margin:0}}>💰 Registrar Recuperação</h2>
          <p style={{fontSize:13,color:MUTED,margin:"4px 0 0"}}>{contrato.ID_CONTRATO} • {contrato.NOME_CLIENTE}</p>
        </div>
        <div style={{padding:24,display:"flex",flexDirection:"column",gap:16}}>
          <div><span style={LS}>Valor Recuperado</span><input type="number" value={valor} onChange={e=>setValor(e.target.value)} placeholder="0.00" style={IS}/></div>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12}}>
            <div><span style={LS}>Data</span><input type="date" value={data} onChange={e=>setData(e.target.value)} style={IS}/></div>
            <div><span style={LS}>Forma</span><select value={forma} onChange={e=>setForma(e.target.value)} style={IS}><option value="dinheiro">Dinheiro</option><option value="pix">PIX</option><option value="transferencia">TED/DOC</option></select></div>
          </div>
          {msg && <div style={{padding:12,borderRadius:8,background:msg.ok?GRN+"10":RED+"10",color:msg.ok?GRN:RED,fontSize:13}}>{msg.texto}</div>}
        </div>
        <div style={{padding:20,borderTop:`1px solid ${BD}`,display:"flex",justifyContent:"flex-end",gap:12}}>
          <button onClick={onFechar} style={{padding:"10px 20px",borderRadius:8,border:`1px solid ${BD}`,background:CARD,color:MUTED,fontWeight:600,cursor:"pointer"}}>Cancelar</button>
          <button onClick={confirmar} disabled={loading} style={{padding:"10px 24px",borderRadius:8,border:"none",background:PUR,color:"#FFF",fontWeight:600,cursor:loading?"not-allowed":"pointer",opacity:loading?0.7:1}}>{loading?"Registrando...":"Salvar Recebimento"}</button>
        </div>
      </div>
    </div>
  );
}

function ClienteModal({cliente, onFechar, onSucesso}){
  const [al,setAl]=useState({});const [salvando,setSalvando]=useState(false);const [msg,setMsg]=useState(null);
  useEffect(()=>{ if(cliente) setAl({...cliente}); },[cliente]);
  const salvar=async()=>{
    setSalvando(true); setMsg(null);
    const res=await postAction({action:"atualizarCliente",idCliente:cliente.ID_CLIENTE,campos:al});
    if(res.ok){ setMsg({ok:true,t:"Dados atualizados!"}); setTimeout(onSucesso,1000); }
    else setMsg({ok:false,t:res.erro||"Erro ao salvar"});
    setSalvando(false);
  };
  if(!cliente) return null;
  const f=(l,k,vF)=><div><span style={LS}>{l}</span><input value={al[k]||""} onChange={e=>setAl(p=>({...p,[k]:e.target.value}))} style={vF&&vF(al[k])?IW:IS}/>{vF&&vF(al[k])&&<span style={WS}>{vF(al[k])}</span>}</div>;
  return (
    <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.5)",zIndex:500,display:"flex",alignItems:"center",justifyContent:"center",padding:20}}>
      <div style={{background:CARD,borderRadius:12,width:"100%",maxWidth:700,maxHeight:"90vh",display:"flex",flexDirection:"column"}}>
        <div style={{padding:20,borderBottom:`1px solid ${BD}`,display:"flex",justifyContent:"space-between",alignItems:"center"}}>
          <h2 style={{margin:0,fontSize:18,fontWeight:700}}>Editar Cliente: {cliente.ID_CLIENTE}</h2>
          <button onClick={onFechar} style={{background:"none",border:"none",cursor:"pointer",color:MUTED}}>{Ico.arr}</button>
        </div>
        <div style={{padding:24,overflowY:"auto",flex:1,display:"grid",gridTemplateColumns:"1fr 1fr",gap:20}}>
          <div style={{gridColumn:"1/-1",...SEC}}>Dados Pessoais</div>
          {f("Nome Completo","NOME_CLIENTE",vLetras)}
          {f("CPF/CNPJ","CPF_CNPJ",vNums)}
          {f("E-mail","EMAIL",vEmail)}
          {f("Telefone","TELEFONE",vNums)}
          <div style={{gridColumn:"1/-1",...SEC}}>Endereço</div>
          {f("CEP","CEP",vNums)}
          {f("Logradouro","ENDERECO")}
          {f("Número","NUMERO",vNumEnd)}
          {f("Bairro","BAIRRO")}
          {f("Cidade","CIDADE")}
          {f("UF","UF")}
        </div>
        <div style={{padding:20,borderTop:`1px solid ${BD}`,display:"flex",justifyContent:"space-between",alignItems:"center"}}>
          <div>{msg && <span style={{color:msg.ok?GRN:RED,fontSize:13,fontWeight:600}}>{msg.t}</span>}</div>
          <div style={{display:"flex",gap:12}}>
            <button onClick={onFechar} style={{padding:"10px 20px",borderRadius:8,border:`1px solid ${BD}`,background:CARD,color:MUTED,fontWeight:600,cursor:"pointer"}}>Cancelar</button>
            <button onClick={salvar} disabled={salvando} style={{padding:"10px 24px",borderRadius:8,border:"none",background:BLU,color:"#FFF",fontWeight:600,cursor:"pointer",opacity:salvando?0.7:1}}>{salvando?"Salvando...":"Salvar Alterações"}</button>
          </div>
        </div>
      </div>
    </div>
  );
}

function PagamentoDrop({contratos, parcelas, onSucesso}){
  const [busca,setBusca]=useState("");const [showDrop,setShowDrop]=useState(false);const [cliente,setCliente]=useState(null);const [parcela,setParcela]=useState(null);const [tipo,setTipo]=useState(null);const [data,setData]=useState(hojeStr());const [valor,setValor]=useState("");const [loading,setLoading]=useState(false);const [msg,setMsg]=useState(null);const ref=useRef();
  useEffect(()=>{ const h=e=>{if(ref.current&&!ref.current.contains(e.target))setShowDrop(false);}; document.addEventListener("mousedown",h); return ()=>document.removeEventListener("mousedown",h); },[]);
  const clis=useMemo(()=>{
    if(busca.length<2) return [];
    const ids=new Set(); return contratos.filter(c=>{
      const m=c.NOME_CLIENTE.toLowerCase().includes(busca.toLowerCase())||c.ID_CLIENTE.toLowerCase().includes(busca.toLowerCase());
      if(m && !ids.has(c.ID_CLIENTE)){ ids.add(c.ID_CLIENTE); return true; } return false;
    }).slice(0,6);
  },[busca,contratos]);
  const pars=useMemo(()=>cliente?parcelas.filter(p=>p.ID_CLIENTE===cliente.ID_CLIENTE && p.STATUS==="pendente").sort((a,b)=>toNum(a.DATA_VENCIMENTO)-toNum(b.DATA_VENCIMENTO)):[],[cliente,parcelas]);
  const registrar=async()=>{
    if(!parcela||!valor||!data) return; setLoading(true); setMsg(null);
    const res=await postAction({action:tipo==="parcial"?"pagamentoParcial":"pagamento",idParcela:parcela.ID_PARCELA,valor:parseFloat(valor),data,forma:"dinheiro"});
    if(res.ok){ setMsg({ok:true,t:res.msg||"Sucesso!"}); setTimeout(onSucesso,1500); }
    else setMsg({ok:false,t:res.erro||"Erro"});
    setLoading(false);
  };
  return (
    <div style={{background:CARD,borderRadius:12,padding:24,border:`1px solid ${BD}`,boxShadow:"0 4px 20px rgba(0,0,0,0.05)"}}>
      <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:20}}><div style={{background:GRN+"15",color:GRN,padding:8,borderRadius:8}}>{Ico.pag}</div><h3 style={{margin:0,fontSize:16,fontWeight:700}}>Registrar Pagamento</h3></div>
      <div style={{display:"flex",flexDirection:"column",gap:16}}>
        <div style={{position:"relative"}} ref={ref}>
          <span style={LS}>Buscar Cliente</span>
          <div style={{position:"relative"}}><div style={{position:"absolute",left:12,top:"50%",transform:"translateY(-50%)"}}>{Ico.srch}</div><input value={cliente?cliente.NOME_CLIENTE:busca} onChange={e=>{setBusca(e.target.value);setCliente(null);setParcela(null);setShowDrop(true);}} onFocus={()=>setShowDrop(true)} placeholder="Nome ou ID do cliente..." style={{...IS,paddingLeft:35}}/>{cliente&&<button onClick={()=>{setCliente(null);setBusca("");}} style={{position:"absolute",right:10,top:"50%",transform:"translateY(-50%)",border:"none",background:"none",cursor:"pointer",color:MUTED}}>x</button>}</div>
          {showDrop && clis.length>0 && (
            <div style={{position:"absolute",top:"100%",left:0,right:0,background:CARD,border:`1px solid ${BD}`,borderRadius:8,marginTop:4,zIndex:100,boxShadow:"0 10px 30px rgba(0,0,0,0.1)",overflow:"hidden"}}>
              {clis.map(c=><div key={c.ID_CLIENTE} onClick={()=>{setCliente(c);setShowDrop(false);}} style={{padding:"10px 15px",cursor:"pointer",borderBottom:`1px solid ${BG}`,fontSize:13}} onMouseEnter={e=>e.target.style.background=BG} onMouseLeave={e=>e.target.style.background=CARD}><strong>{c.ID_CLIENTE}</strong> - {c.NOME_CLIENTE}</div>)}
            </div>
          )}
        </div>
        {cliente && (
          <div><span style={LS}>Parcela Pendente</span>
            {pars.length>0 ? <select value={parcela?.ID_PARCELA||""} onChange={e=>{const p=pars.find(x=>x.ID_PARCELA===e.target.value);setParcela(p);setValor(p.VALOR_PARCELA);}} style={IS}><option value="">Selecione...</option>{pars.map(p=><option key={p.ID_PARCELA} value={p.ID_PARCELA}>Parc {p.NUM_PARCELA} ({fmtDt(p.DATA_VENCIMENTO)}) - {fmtR(p.VALOR_PARCELA)}</option>)}</select> : <div style={{padding:10,background:RED+"08",color:RED,fontSize:12,borderRadius:6,fontWeight:600}}>Nenhuma parcela pendente para este cliente.</div>}
          </div>
        )}
        {parcela && (
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12}}>
            <div><span style={LS}>Tipo</span><select value={tipo} onChange={e=>setTipo(e.target.value)} style={IS}><option value="total">Total</option><option value="parcial">Somente Juros (Rolar Principal)</option></select></div>
            <div><span style={LS}>Valor</span><input type="number" value={valor} onChange={e=>setValor(e.target.value)} style={IS}/></div>
            <div style={{gridColumn:"1/-1"}}><span style={LS}>Data Pagamento</span><input type="date" value={data} onChange={e=>setData(e.target.value)} style={IS}/></div>
            <button onClick={registrar} disabled={loading} style={{gridColumn:"1/-1",marginTop:8,padding:"12px",borderRadius:8,border:"none",background:GRN,color:"#FFF",fontWeight:700,cursor:"pointer",opacity:loading?0.7:1}}>{loading?"Processando...":"Confirmar Pagamento"}</button>
          </div>
        )}
        {msg && <div style={{padding:12,borderRadius:8,background:msg.ok?GRN+"10":RED+"10",color:msg.ok?GRN:RED,fontSize:13,textAlign:"center",fontWeight:600}}>{msg.t}</div>}
      </div>
    </div>
  );
}

function NovoContrato({contratos, onSucesso}){
  const [busca,setBusca]=useState("");const [showDrop,setShowDrop]=useState(false);const [cliente,setCliente]=useState(null);const [principal,setPrincipal]=useState("");const [parcelas,setParcelas]=useState("");const [taxa,setTaxa]=useState("");const [dtEmp,setDtEmp]=useState(hojeStr());const [dtVenc,setDtVenc]=useState("");const [loading,setLoading]=useState(false);const [msg,setMsg]=useState(null);const ref=useRef();
  useEffect(()=>{ const h=e=>{if(ref.current&&!ref.current.contains(e.target))setShowDrop(false);}; document.addEventListener("mousedown",h); return ()=>document.removeEventListener("mousedown",h); },[]);
  const clis=useMemo(()=>{
    if(busca.length<2) return [];
    const ids=new Set(); return contratos.filter(c=>{
      const m=c.NOME_CLIENTE.toLowerCase().includes(busca.toLowerCase())||c.ID_CLIENTE.toLowerCase().includes(busca.toLowerCase());
      if(m && !ids.has(c.ID_CLIENTE)){ ids.add(c.ID_CLIENTE); return true; } return false;
    }).slice(0,6);
  },[busca,contratos]);
  const criar=async()=>{
    if(!cliente||!principal||!parcelas||!taxa||!dtEmp||!dtVenc) return; setLoading(true); setMsg(null);
    const res=await postAction({action:"novoContrato",dados:{idCliente:cliente.ID_CLIENTE,nomeCliente:cliente.NOME_CLIENTE,principal,parcelas,taxa,dataEmprestimo:dtEmp,dataVencimento:dtVenc}});
    if(res.ok){ setMsg({ok:true,t:"Contrato criado com sucesso!"}); setTimeout(onSucesso,1500); }
    else setMsg({ok:false,t:res.erro||"Erro"});
    setLoading(false);
  };
  return (
    <div style={{background:CARD,borderRadius:12,padding:24,border:`1px solid ${BD}`,boxShadow:"0 4px 20px rgba(0,0,0,0.05)"}}>
      <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:20}}><div style={{background:BLU+"15",color:BLU,padding:8,borderRadius:8}}>{Ico.ctr}</div><h3 style={{margin:0,fontSize:16,fontWeight:700}}>Novo Contrato</h3></div>
      <div style={{display:"flex",flexDirection:"column",gap:16}}>
        <div style={{position:"relative"}} ref={ref}>
          <span style={LS}>Buscar Cliente</span>
          <div style={{position:"relative"}}><div style={{position:"absolute",left:12,top:"50%",transform:"translateY(-50%)"}}>{Ico.srch}</div><input value={cliente?cliente.NOME_CLIENTE:busca} onChange={e=>{setBusca(e.target.value);setCliente(null);setShowDrop(true);}} onFocus={()=>setShowDrop(true)} placeholder="Nome ou ID..." style={{...IS,paddingLeft:35}}/>{cliente&&<button onClick={()=>{setCliente(null);setBusca("");}} style={{position:"absolute",right:10,top:"50%",transform:"translateY(-50%)",border:"none",background:"none",cursor:"pointer",color:MUTED}>x</button>}</div>
          {showDrop && clis.length>0 && (
            <div style={{position:"absolute",top:"100%",left:0,right:0,background:CARD,border:`1px solid ${BD}`,borderRadius:8,marginTop:4,zIndex:100,boxShadow:"0 10px 30px rgba(0,0,0,0.1)",overflow:"hidden"}}>
              {clis.map(c=><div key={c.ID_CLIENTE} onClick={()=>{setCliente(c);setShowDrop(false);}} style={{padding:"10px 15px",cursor:"pointer",borderBottom:`1px solid ${BG}`,fontSize:13}} onMouseEnter={e=>e.target.style.background=BG} onMouseLeave={e=>e.target.style.background=CARD}><strong>{c.ID_CLIENTE}</strong> - {c.NOME_CLIENTE}</div>)}
            </div>
          )}
        </div>
        {cliente && (
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12}}>
            <div><span style={LS}>Valor Principal</span><input type="number" value={principal} onChange={e=>setPrincipal(e.target.value)} placeholder="0.00" style={IS}/></div>
            <div><span style={LS}>Nº Parcelas</span><input type="number" value={parcelas} onChange={e=>setParcelas(e.target.value)} placeholder="1" style={IS}/></div>
            <div><span style={LS}>Taxa Mensal (%)</span><input type="number" value={taxa} onChange={e=>setTaxa(e.target.value)} placeholder="0.00" style={IS}/></div>
            <div><span style={LS}>1º Vencimento</span><input type="date" value={dtVenc} onChange={e=>setDtVenc(e.target.value)} style={IS}/></div>
            <div style={{gridColumn:"1/-1"}}><span style={LS}>Data Empréstimo</span><input type="date" value={dtEmp} onChange={e=>setDtEmp(e.target.value)} style={IS}/></div>
            <button onClick={criar} disabled={loading} style={{gridColumn:"1/-1",marginTop:8,padding:"12px",borderRadius:8,border:"none",background:BLU,color:"#FFF",fontWeight:700,cursor:"pointer",opacity:loading?0.7:1}}>{loading?"Criando...":"Gerar Contrato"}</button>
          </div>
        )}
        {msg && <div style={{padding:12,borderRadius:8,background:msg.ok?GRN+"10":RED+"10",color:msg.ok?GRN:RED,fontSize:13,textAlign:"center",fontWeight:600}}>{msg.t}</div>}
      </div>
    </div>
  );
}

// ── APP ────────────────────────────────────────────────────────────
function App() {
  const [raw, setRaw] = useState(null);
  const [tab, setTab] = useState("dashboard");
  const [busca, setBusca] = useState("");
  const [loading, setLoading] = useState(true);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [erro, setErro] = useState(null);
  const [selCli, setSelCli] = useState(null);
  const [clienteRevisao, setClienteRevisao] = useState(null);
  const [baixaModal, setBaixaModal] = useState(null);
  const [recuperacaoModal, setRecuperacaoModal] = useState(null);
  const [simVal, setSimVal] = useState(5000);
  const [simInad, setSimInad] = useState(0);
  const [simVol, setSimVol] = useState(0);
  const [filtroStatus, setFiltroStatus] = useState("todos");
  const [filtroBusca, setFiltroBusca] = useState("");
  const [filtroPerdas, setFiltroPerdas] = useState("todos");
  const [periodo, setPeriodo] = useState("tudo");
  const [customDe, setCustomDe] = useState(null);
  const [customAte, setCustomAte] = useState(null);
  const [calOpen, setCalOpen] = useState(false);
  const [calMes, setCalMes] = useState(() => { const d = new Date(); d.setDate(1); return d; });
  const [rangeStep, setRangeStep] = useState(0); 

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
      if(tipoReal === "pagamento_normal" && dtP && dtV && toNum(dtP) > toNum(dtV)){ tipoReal = "pagamento_com_atraso"; }
      return { ...p, TIPO_PAGAMENTO: tipoReal, VALOR_PAGO:parseFloat(p.VALOR_PAGO)||0, VALOR_ORIGINAL_PARCELA:parseFloat(p.VALOR_ORIGINAL_PARCELA)||0, DIFERENCA_RECEBIDA:parseFloat(p.DIFERENCA_RECEBIDA)||0, RECEITA_EXTRA_ATRASO:parseFloat(p.RECEITA_EXTRA_ATRASO)||0 };
    });

    const promessas=(raw.PROMESSAS||[]).map(p=>({...p,DATA_PREVISTA_PAGAMENTO:parseDate(p.DATA_PREVISTA_PAGAMENTO)}));

    const clientes=(raw.CLIENTES||[]).map(cl=>{
      const ccs = contratos.filter(c=>c.ID_CLIENTE===cl.ID_CLIENTE);
      const pps = parcelas.filter(p=>p.ID_CLIENTE===cl.ID_CLIENTE);
      const emAtraso = pps.filter(p=>p.STATUS==="atrasado");
      const vAtraso  = emAtraso.reduce((s,p)=>s+p.VALOR_PARCELA,0);
      const maxAtraso= emAtraso.length>0 ? Math.max(...emAtraso.map(p=>Math.round((new Date()-p.DATA_VENCIMENTO)/86400000))) : 0;
      const totalEmp = ccs.reduce((s,c)=>s+c.VALOR_PRINCIPAL,0);
      const saldoDev = pps.filter(p=>p.STATUS==="pendente"||p.STATUS==="atrasado").reduce((s,p)=>s+p.VALOR_PARCELA,0);
      return {...cl,contratos:ccs,parcelas:pps,vAtraso,maxAtraso,totalEmp,saldoDev};
    });

    const cobItems = clientes.filter(c=>c.maxAtraso>0).sort((a,b)=>b.maxAtraso-a.maxAtraso);

    const mRec = pagamentos.reduce((s,p)=>{
      const dt=parseDate(p.DATA_PAGAMENTO); if(!dt)return s;
      const k=dt.getFullYear()+"-"+String(dt.getMonth()+1).padStart(2,"0");
      s[k]=(s[k]||0)+p.VALOR_PAGO; return s;
    },{});
    const mensal = Object.keys(mRec).sort().map(k=>({m:k,v:mRec[k]}));

    const ativos = parcelas.filter(p=>p.STATUS==="pendente"||p.STATUS==="atrasado");
    const vAtivos = ativos.reduce((s,p)=>s+p.VALOR_PARCELA,0);
    const vAtrasoTotal = ativos.filter(p=>p.STATUS==="atrasado").reduce((s,p)=>s+p.VALOR_PARCELA,0);
    const taxaInad = vAtivos>0 ? (vAtrasoTotal/vAtivos*100) : 0;
    const lucroTotal = pagamentos.reduce((s,p)=>s+(p.VALOR_PAGO - p.VALOR_ORIGINAL_PARCELA + p.RECEITA_EXTRA_ATRASO),0);

    const cEmCobranca = contratos.filter(c=>STATUS_PERDA.includes(c.STATUS_CONTRATO));
    const capitalBaixado = contratos.filter(c=>c.STATUS_CONTRATO==="baixado_como_prejuizo").reduce((s,c)=>s+c.PREJUIZO_CAPITAL,0);
    const recuperadoAposBaixa = contratos.reduce((s,c)=>s+c.VALOR_RECUPERADO_APOS_BAIXA,0);
    const perdas = {
      cEmCobranca,
      capitalBaixado,
      recuperadoAposBaixa,
      prejuizoTotal: Math.max(0, capitalBaixado - recuperadoAposBaixa),
      txRecuperacao: capitalBaixado>0 ? (recuperadoAposBaixa/capitalBaixado*100) : 0
    };

    return {clientes,contratos,parcelas,pagamentos,M:{vAtivos,vAtrasoTotal,taxaInad,lucroTotal,saldoDevedor:vAtivos,receitaExtraTotal:pagamentos.reduce((s,p)=>s+p.RECEITA_EXTRA_ATRASO,0)},cobItems,mensal,perdas,promessas};
  },[raw]);

  const filtrados=useMemo(()=>{
    let res=clientes;
    if(filtroBusca) res=res.filter(c=>c.NOME_CLIENTE.toLowerCase().includes(filtroBusca.toLowerCase())||c.ID_CLIENTE.toLowerCase().includes(filtroBusca.toLowerCase()));
    if(filtroStatus!=="todos") res=res.filter(c=>c.STATUS_CLIENTE===filtroStatus);
    return res;
  },[clientes,filtroBusca,filtroStatus]);

  const pFiltradas=useMemo(()=>{
    let res=contratos.filter(c=>STATUS_PERDA.includes(c.STATUS_CONTRATO));
    if(filtroPerdas!=="todos") res=res.filter(c=>c.STATUS_CONTRATO===filtroPerdas);
    return res;
  },[contratos,filtroPerdas]);

  if(loading) return <div style={{height:"100vh",display:"flex",alignItems:"center",justifyContent:"center",background:BG,flexDirection:"column",gap:15}}><div style={{width:40,height:40,border:`4px solid ${BD}`,borderTopColor:BLU,borderRadius:"50%",animation:"spin 1s linear infinite"}}/><style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style><span style={{color:MUTED,fontWeight:600}}>Carregando sistema...</span></div>;
  if(erro) return <div style={{height:"100vh",display:"flex",alignItems:"center",justifyContent:"center",background:BG}}><div style={{background:CARD,padding:30,borderRadius:12,textAlign:"center",boxShadow:"0 10px 30px rgba(0,0,0,0.1)"}}><div style={{color:RED,marginBottom:15}}>{Ico.loss}</div><h2 style={{margin:"0 0 10px"}}>Erro ao carregar dados</h2><p style={{color:MUTED,margin:"0 0 20px"}}>{erro}</p><button onClick={carregar} style={{padding:"10px 25px",background:BLU,color:"#FFF",border:"none",borderRadius:8,fontWeight:700,cursor:"pointer"}}>Tentar Novamente</button></div></div>;

  const NavItem=({id,label,ico})=> <div onClick={()=>setTab(id)} style={{display:"flex",alignItems:"center",gap:12,padding:"12px 16px",cursor:"pointer",borderRadius:10,background:tab===id?BLU:"transparent",color:tab===id?"#FFF":MUTED,transition:"0.2s",marginBottom:4}} onMouseEnter={e=>tab!==id&&(e.currentTarget.style.background=BD+"50")} onMouseLeave={e=>tab!==id&&(e.currentTarget.style.background="transparent")}> {ico} <span style={{fontSize:14,fontWeight:600}}>{label}</span> </div>;

  return (
    <div style={{display:"flex",height:"100vh",background:BG,color:TEXT,fontFamily:"'Inter', system-ui, sans-serif"}}>
      {/* SIDEBAR */}
      <div style={{width:sidebarOpen?SW:0,overflow:"hidden",background:CARD,borderRight:`1px solid ${BD}`,display:"flex",flexDirection:"column",transition:"0.3s"}}>
        <div style={{padding:24,display:"flex",alignItems:"center",gap:12,borderBottom:`1px solid ${BD}`}}><div style={{width:32,height:32,background:BLU,borderRadius:8,display:"flex",alignItems:"center",justifyContent:"center",color:"#FFF"}}>{Ico.fin}</div><span style={{fontWeight:800,fontSize:18,letterSpacing:"-0.5px"}}>Financeiro<span style={{color:BLU}}>Op</span></span></div>
        <div style={{padding:16,flex:1}}>
          <NavItem id="dashboard" label="Dashboard" ico={Ico.dash}/>
          <NavItem id="clientes" label="Clientes" ico={Ico.cli}/>
          <NavItem id="cobranca" label="Cobrança" ico={Ico.cob}/>
          <NavItem id="perdas" label="Perdas & Recuperação" ico={Ico.loss}/>
          <NavItem id="simulador" label="Simulador" ico={Ico.sim}/>
        </div>
        <div style={{padding:16,borderTop:`1px solid ${BD}`}}><div style={{padding:12,background:BG,borderRadius:10,display:"flex",alignItems:"center",gap:10}}><div style={{width:32,height:32,background:BD,borderRadius:"50%"}}/><div style={{overflow:"hidden"}}><div style={{fontSize:12,fontWeight:700,whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis"}}>Administrador</div><div style={{fontSize:10,color:MUTED}}>Painel Gestão</div></div></div></div>
      </div>

      {/* MAIN CONTENT */}
      <div style={{flex:1,display:"flex",flexDirection:"column",overflow:"hidden"}}>
        <header style={{height:64,background:CARD,borderBottom:`1px solid ${BD}`,display:"flex",alignItems:"center",justifyContent:"space-between",padding:"0 24px",zIndex:10}}>
          <div style={{display:"flex",alignItems:"center",gap:15}}><button onClick={()=>setSidebarOpen(!sidebarOpen)} style={{background:BG,border:"none",padding:8,borderRadius:8,cursor:"pointer",color:MUTED}}>{Ico.arr}</button><h2 style={{fontSize:18,fontWeight:700,margin:0}}>{tab.charAt(0).toUpperCase()+tab.slice(1)}</h2></div>
          <div style={{display:"flex",alignItems:"center",gap:20}}><div style={{position:"relative"}}><div style={{position:"absolute",left:10,top:"50%",transform:"translateY(-50%)"}}>{Ico.srch}</div><input placeholder="Busca rápida..." style={{...IS,width:250,paddingLeft:32,background:BG,border:"none"}}/></div><div style={{color:MUTED,cursor:"pointer"}}>{Ico.bell}</div></div>
        </header>

        <main style={{flex:1,overflowY:"auto",padding:24}}>
          {tab==="dashboard" && (
            <div style={{display:"flex",flexDirection:"column",gap:24}}>
              <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit, minmax(240px, 1fr))",gap:20}}>
                {[
                  {l:"Total em Aberto",v:fmtR(M.vAtivos),c:BLU,i:Ico.fin},
                  {l:"Total em Atraso",v:fmtR(M.vAtrasoTotal),c:YEL,i:Ico.cob},
                  {l:"Inadimplência",v:fmtP(M.taxaInad),c:M.taxaInad>15?RED:M.taxaInad>8?YEL:GRN,i:Ico.kpi},
                  {l:"Lucro Projetado",v:fmtR(M.lucroTotal),c:GRN,i:Ico.novo}
                ].map(k=>(
                  <div key={k.l} style={{background:CARD,padding:20,borderRadius:12,border:`1px solid ${BD}`,display:"flex",alignItems:"center",gap:16}}>
                    <div style={{background:k.c+"15",color:k.c,padding:12,borderRadius:12}}>{k.i}</div>
                    <div><div style={{fontSize:12,color:MUTED,fontWeight:600,marginBottom:4}}>{k.l}</div><div style={{fontSize:20,fontWeight:800}}>{k.v}</div></div>
                  </div>
                ))}
              </div>
              <div style={{display:"grid",gridTemplateColumns:"2fr 1fr",gap:24}}>
                <div style={{background:CARD,padding:24,borderRadius:12,border:`1px solid ${BD}`,height:350}}>
                  <h3 style={{margin:"0 0 20px",fontSize:16,fontWeight:700}}>Recebimentos Mensais</h3>
                  <ResponsiveContainer width="100%" height="100%"><BarChart data={mensal}><CartesianGrid strokeDasharray="3 3" vertical={false} stroke={BD}/><XAxis dataKey="m" axisLine={false} tickLine={false} tick={{fontSize:10,fill:MUTED}}/><YAxis axisLine={false} tickLine={false} tick={{fontSize:10,fill:MUTED}} tickFormatter={v=>`R$ ${v/1000}k`}/><Tooltip cursor={{fill:BG}} contentStyle={{borderRadius:8,border:"none",boxShadow:"0 10px 20px rgba(0,0,0,0.1)"}}/><Bar dataKey="v" fill={BLU} radius={[4,4,0,0]} barSize={40}/></BarChart></ResponsiveContainer>
                </div>
                <div style={{display:"flex",flexDirection:"column",gap:20}}>
                  <PagamentoDrop contratos={contratos} parcelas={parcelas} onSucesso={carregar}/>
                  <NovoContrato contratos={contratos} onSucesso={carregar}/>
                </div>
              </div>
            </div>
          )}

          {tab==="clientes" && (
            <div style={{background:CARD,borderRadius:12,border:`1px solid ${BD}`,overflow:"hidden"}}>
              <div style={{padding:20,borderBottom:`1px solid ${BD}`,display:"flex",justifyContent:"space-between",alignItems:"center",background:BG+"50"}}>
                <div style={{display:"flex",gap:12}}><input placeholder="Buscar por nome ou ID..." value={filtroBusca} onChange={e=>setFiltroBusca(e.target.value)} style={{...IS,width:300}}/><select value={filtroStatus} onChange={e=>setFiltroStatus(e.target.value)} style={{...IS,width:150}}><option value="todos">Todos Status</option><option value="ativo">Ativos</option><option value="aguardando_conferencia">Aguardando</option></select></div>
                <div style={{fontSize:13,color:MUTED}}><strong>{filtrados.length}</strong> clientes encontrados</div>
              </div>
              <table style={{width:"100%",borderCollapse:"collapse",textAlign:"left"}}>
                <thead><tr style={{background:BG,fontSize:11,color:MUTED,textTransform:"uppercase",letterSpacing:"0.05em"}}><th style={{padding:"12px 20px"}}>Cliente</th><th>Status</th><th>Empréstimo Total</th><th>Saldo Devedor</th><th>Atraso</th><th style={{padding:"12px 20px",textAlign:"right"}}>Ações</th></tr></thead>
                <tbody>
                  {filtrados.map(c=>(
                    <tr key={c.ID_CLIENTE} style={{borderBottom:`1px solid ${BD}`,fontSize:13}} onMouseEnter={e=>e.currentTarget.style.background=BG+"30"} onMouseLeave={e=>e.currentTarget.style.background="transparent"}>
                      <td style={{padding:"15px 20px"}}><div style={{fontWeight:700}}>{c.NOME_CLIENTE}</div><div style={{fontSize:11,color:MUTED}}>{c.ID_CLIENTE} • {c.CIDADE}/{c.UF}</div></td>
                      <td><Badge c={c.STATUS_CLIENTE==="ativo"?GRN:YEL}>{c.STATUS_CLIENTE?.toUpperCase()}</Badge></td>
                      <td>{fmtR(c.totalEmp)}</td>
                      <td style={{fontWeight:600}}>{fmtR(c.saldoDev)}</td>
                      <td style={{color:c.maxAtraso>0?RED:MUTED}}>{c.maxAtraso>0?`${fmtR(c.vAtraso)} (${c.maxAtraso}d)`:"—"}</td>
                      <td style={{padding:"15px 20px",textAlign:"right"}}><button onClick={()=>setSelCli(c)} style={{padding:"6px 12px",borderRadius:6,border:`1px solid ${BD}`,background:CARD,cursor:"pointer",fontSize:12,fontWeight:600}}>{Ico.novo} Detalhes</button></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {tab==="cobranca" && (
            <div style={{display:"grid",gridTemplateColumns:"1fr 350px",gap:24,alignItems:"start"}}>
              <div style={{background:CARD,borderRadius:12,border:`1px solid ${BD}`,overflow:"hidden"}}>
                <div style={{padding:20,borderBottom:`1px solid ${BD}`,background:RED+"05"}}><h3 style={{margin:0,fontSize:16,fontWeight:700,color:RED}}>Fila de Cobrança Prioritária</h3></div>
                <table style={{width:"100%",borderCollapse:"collapse",textAlign:"left"}}>
                  <thead><tr style={{background:BG,fontSize:11,color:MUTED,textTransform:"uppercase"}}><th style={{padding:"12px 20px"}}>Cliente</th><th>Contratos</th><th>Atraso Máx</th><th>Valor Atrasado</th><th style={{padding:"12px 20px",textAlign:"right"}}>Ações</th></tr></thead>
                  <tbody>
                    {cobItems.map(c=>(
                      <tr key={c.ID_CLIENTE} style={{borderBottom:`1px solid ${BD}`,fontSize:13}}>
                        <td style={{padding:"15px 20px"}}><div style={{fontWeight:700}}>{c.NOME_CLIENTE}</div><div style={{fontSize:11,color:MUTED}}>{c.TELEFONE}</div></td>
                        <td>{c.contratos.length}</td>
                        <td><Badge c={c.maxAtraso>60?RED:c.maxAtraso>30?ORG:YEL}>{c.maxAtraso} dias</Badge></td>
                        <td style={{fontWeight:700,color:RED}}>{fmtR(c.vAtraso)}</td>
                        <td style={{padding:"15px 20px",textAlign:"right"}}><button style={{padding:"6px 12px",borderRadius:6,border:"none",background:BLU,color:"#FFF",cursor:"pointer",fontSize:12,fontWeight:600}}>Cobrar</button></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div style={{background:CARD,padding:20,borderRadius:12,border:`1px solid ${BD}`}}>
                <h3 style={{margin:"0 0 15px",fontSize:15,fontWeight:700}}>Resumo da Carteira</h3>
                <div style={{display:"flex",flexDirection:"column",gap:12}}>
                  <div style={{padding:15,background:BG,borderRadius:10}}>
                    <div style={{fontSize:12,color:MUTED,marginBottom:5}}>Inadimplência Geral</div>
                    <div style={{fontSize:24,fontWeight:800,color:M.taxaInad>10?RED:GRN}}>{fmtP(M.taxaInad)}</div>
                    <div style={{width:"100%",height:6,background:BD,borderRadius:3,marginTop:10}}><div style={{width:Math.min(100,M.taxaInad)+"%",height:"100%",background:M.taxaInad>10?RED:GRN,borderRadius:3}}/></div>
                  </div>
                  <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10}}>
                    <div style={{padding:12,border:`1px solid ${BD}`,borderRadius:10}}><div style={{fontSize:10,color:MUTED}}>Em Atraso</div><div style={{fontSize:14,fontWeight:700}}>{fmtR(M.vAtrasoTotal)}</div></div>
                    <div style={{padding:12,border:`1px solid ${BD}`,borderRadius:10}}><div style={{fontSize:10,color:MUTED}}>Em Dia</div><div style={{fontSize:14,fontWeight:700}}>{fmtR(M.vAtivos - M.vAtrasoTotal)}</div></div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {tab==="perdas" && (
            <div style={{display:"flex",flexDirection:"column",gap:24}}>
              <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:20}}>
                {[
                  {l:"Capital em Prejuízo",v:fmtR(perdas.capitalBaixado),c:RED},
                  {l:"Recuperado",v:fmtR(perdas.recuperadoAposBaixa),c:PUR},
                  {l:"Prejuízo Real",v:fmtR(perdas.prejuizoTotal),c:RED},
                  {l:"Taxa de Recuperação",v:fmtP(perdas.txRecuperacao),c:GRN}
                ].map(k=>(
                  <div key={k.l} style={{background:CARD,padding:20,borderRadius:12,border:`1px solid ${BD}`}}>
                    <div style={{fontSize:11,color:MUTED,fontWeight:600,textTransform:"uppercase",marginBottom:4}}>{k.l}</div>
                    <div style={{fontSize:20,fontWeight:800,color:k.c}}>{k.v}</div>
                  </div>
                ))}
              </div>
              <div style={{background:CARD,borderRadius:12,border:`1px solid ${BD}`,overflow:"hidden"}}>
                <div style={{padding:20,borderBottom:`1px solid ${BD}`,display:"flex",justifyContent:"space-between",alignItems:"center",background:BG+"50"}}>
                  <h3 style={{margin:0,fontSize:16,fontWeight:700}}>Gestão de Contratos com Perda</h3>
                  <select value={filtroPerdas} onChange={e=>setFiltroPerdas(e.target.value)} style={{...IS,width:200}}><option value="todos">Todos os Status</option><option value="em_cobranca">Em Cobrança</option><option value="pre_prejuizo">Pré-Prejuízo</option><option value="baixado_como_prejuizo">Baixado (Prejuízo)</option><option value="em_recuperacao">Em Recuperação</option></select>
                </div>
                <table style={{width:"100%",borderCollapse:"collapse",textAlign:"left"}}>
                  <thead><tr style={{background:BG,fontSize:11,color:MUTED,textTransform:"uppercase"}}><th style={{padding:"12px 20px"}}>Contrato / Cliente</th><th>Status</th><th>Capital</th><th>Prejuízo</th><th>Recuperado</th><th style={{padding:"12px 20px",textAlign:"right"}}>Ações</th></tr></thead>
                  <tbody>
                    {pFiltradas.map(c=>(
                      <tr key={c.ID_CONTRATO} style={{borderBottom:`1px solid ${BD}`,fontSize:13}}>
                        <td style={{padding:"15px 20px"}}><div style={{fontWeight:700}}>{c.ID_CONTRATO}</div><div style={{fontSize:11,color:MUTED}}>{c.NOME_CLIENTE}</div></td>
                        <td><Badge c={STATUS_COR[c.STATUS_CONTRATO]}>{STATUS_LABEL[c.STATUS_CONTRATO]?.toUpperCase()}</Badge></td>
                        <td>{fmtR(c.VALOR_PRINCIPAL)}</td>
                        <td style={{color:RED,fontWeight:600}}>{fmtR(c.PREJUIZO_CAPITAL)}</td>
                        <td style={{color:PUR,fontWeight:600}}>{fmtR(c.VALOR_RECUPERADO_APOS_BAIXA)}</td>
                        <td style={{padding:"15px 20px",textAlign:"right",display:"flex",gap:8,justifyContent:"flex-end"}}>
                          {c.STATUS_CONTRATO!=="baixado_como_prejuizo" && <button onClick={()=>setBaixaModal(c)} style={{padding:"6px 10px",borderRadius:6,border:`1px solid ${RED}30`,background:RED+"08",color:RED,cursor:"pointer",fontSize:11,fontWeight:700}}>Baixar</button>}
                          <button onClick={()=>setRecuperacaoModal(c)} style={{padding:"6px 10px",borderRadius:6,border:`1px solid ${PUR}30`,background:PUR+"08",color:PUR,cursor:"pointer",fontSize:11,fontWeight:700}}>Recuperar</button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {tab==="simulador" && (
            <div style={{maxWidth:900,margin:"0 auto"}}>
              <div style={{background:CARD,borderRadius:16,border:`1px solid ${BD}`,padding:32,boxShadow:"0 10px 40px rgba(0,0,0,0.05)"}}>
                <div style={{textAlign:"center",marginBottom:32}}>
                  <h2 style={{fontSize:24,fontWeight:800,margin:"0 0 8px"}}>Simulador de Expansão</h2>
                  <p style={{color:MUTED,margin:0}}>Projete o crescimento da sua carteira e analise o risco</p>
                </div>
                <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:40}}>
                  <div style={{display:"flex",flexDirection:"column",gap:24}}>
                    {[
                      {l:"Novo Aporte (R$)",v:simVal,s:setSimVal,m:1000,max:100000,step:500,fmt:v=>fmtR(v)},
                      {l:"Inadimplência Esperada (%)",v:simInad,s:setSimInad,m:0,max:50,step:1,fmt:v=>v+"%"},
                      {l:"Volume de Novos Contratos",v:simVol,s:setSimVol,m:0,max:50,step:1,fmt:v=>v}
                    ].map(inp=>(
                      <div key={inp.l}>
                        <div style={{display:"flex",justifyContent:"space-between",marginBottom:10}}><span style={{...LS,marginBottom:0}}>{inp.l}</span><strong style={{color:BLU,fontSize:14}}>{inp.fmt(inp.v)}</strong></div>
                        <input type="range" min={inp.m} max={inp.max} step={inp.step} value={inp.v} onChange={e=>inp.s(Number(e.target.value))} style={{width:"100%",height:6,borderRadius:3,background:BD,appearance:"none",cursor:"pointer"}}/>
                        <div style={{display:"flex",justifyContent:"space-between",marginTop:6,fontSize:10,color:MUTED}}><span>{inp.fmt(inp.m)}</span><span>{inp.fmt(inp.max)}</span></div>
                      </div>
                    ))}
                  </div>
                  {(() => {
                    const novaCarteira = M.vAtivos + simVal;
                    const perdaExtra = (novaCarteira * (simInad/100));
                    const lucroProj = (simVal * 0.15) - perdaExtra;
                    const risco = simInad > 20 ? "crítico" : simInad > 10 ? "atenção" : "saudável";
                    const rc = risco==="crítico"?RED:risco==="atenção"?YEL:GRN;
                    return (
                      <div style={{background:BG,borderRadius:16,padding:24,display:"flex",flexDirection:"column",gap:20}}>
                        <h3 style={{margin:0,fontSize:15,fontWeight:700}}>Projeção de Resultado</h3>
                        <div style={{display:"grid",gap:16}}>
                          {[
                            {l:"Carteira Projetada",v:fmtR(novaCarteira),c:TEXT},
                            {l:"Risco de Perda",v:fmtR(perdaExtra),c:RED},
                            {l:"Lucro Estimado",v:fmtR(lucroProj),c:GRN}
                          ].map(r=>(
                            <div key={r.l} style={{display:"flex",justifyContent:"space-between",alignItems:"center",paddingBottom:12,borderBottom:`1px solid ${BD}`}}><span style={{fontSize:13,color:MUTED}}>{r.l}</span><strong style={{fontSize:16,color:r.c}}>{r.v}</strong></div>
                          ))}
                        </div>
                        <div style={{marginTop:10,padding:16,background:rc+"10",borderRadius:12,border:`1px solid ${rc}20`,textAlign:"center"}}>
                          <div style={{fontSize:11,fontWeight:700,color:rc,textTransform:"uppercase",letterSpacing:1,marginBottom:4}}>Nível de Risco</div>
                          <div style={{fontSize:20,fontWeight:800,color:rc}}>{risco.toUpperCase()}</div>
                        </div>
                      </div>
                    );
                  })()}
                </div>
              </div>
            </div>
          )}
        </main>
      </div>

      {/* MODALS */}
      {selCli && <ClienteModal cliente={selCli} onFechar={()=>setSelCli(null)} onSucesso={carregar}/>}
      {baixaModal && <BaixaModal contrato={baixaModal} parcelas={parcelas} pagamentos={pagamentos} onConfirmar={()=>{setBaixaModal(null);carregar();}} onFechar={()=>setBaixaModal(null)}/>}
      {recuperacaoModal && <RecuperacaoModal contrato={recuperacaoModal} onConfirmar={()=>{setRecuperacaoModal(null);carregar();}} onFechar={()=>setRecuperacaoModal(null)}/>}
    </div>
  );
}

createRoot(document.getElementById("root")).render(<App />);
