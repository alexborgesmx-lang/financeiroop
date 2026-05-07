import React, { useState, useMemo, useEffect, useRef } from "react";
import { createRoot } from "react-dom/client";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from "recharts";

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

function parseDate(v){
  if(!v) return null;
  if(v instanceof Date) return v;
  let d;
  if(typeof v === "string"){
    const s = v.trim();
    if(s.includes("/")){
      const p = s.split("/");
      let dia=parseInt(p[0]), mes=parseInt(p[1]), ano=parseInt(p[2]);
      if(ano<100) ano+=2000;
      d = new Date(ano, mes-1, dia, 12, 0, 0);
    } else {
      const p = s.split("T")[0].split("-");
      let ano=parseInt(p[0]), mes=parseInt(p[1]), dia=parseInt(p[2]);
      if(ano<100) ano+=2000;
      d = new Date(ano, mes-1, dia, 12, 0, 0);
    }
  } else { d = new Date(v); }
  if(isNaN(d.getTime())) return null;
  if(d.getFullYear()<2000) d.setFullYear(d.getFullYear()+100);
  d.setHours(12,0,0,0);
  return d;
}

function toNum(d){ if(!d)return 0; const dt=d instanceof Date?d:parseDate(d); if(!dt)return 0; return dt.getFullYear()*10000+(dt.getMonth()+1)*100+dt.getDate(); }
async function postAction(body){ const r=await fetch(POST_URL,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(body)}); return r.json(); }

const IS = {width:"100%",padding:"9px 12px",background:CARD,border:`1px solid ${BD}`,borderRadius:7,color:TEXT,fontSize:13,boxSizing:"border-box"};
const LS = {color:MUTED,fontSize:11,fontWeight:600,textTransform:"uppercase",letterSpacing:"0.05em",display:"block",marginBottom:4};

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

const IcoFin  = <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>;
const IcoDash = <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/></svg>;
const IcoCli  = <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="9" cy="7" r="4"/><path d="M3 21v-2a4 4 0 0 1 4-4h4a4 4 0 0 1 4 4v2"/></svg>;
const IcoCob  = <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07A19.5 19.5 0 0 1 4.19 12"/></svg>;
const IcoLoss = <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>;
const IcoSim  = <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/></svg>;
const IcoBell = <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/></svg>;
const IcoSrch = <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke={MUTED} strokeWidth="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>;
const IcoArr  = <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="9,18 15,12 9,6"/></svg>;
const IcoCtr  = <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14,2 14,8 20,8"/></svg>;
const IcoPag  = <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="2" y="5" width="20" height="14" rx="2"/><line x1="2" y1="10" x2="22" y2="10"/></svg>;
const IcoNovo = <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="16"/><line x1="8" y1="12" x2="16" y2="12"/></svg>;
const IcoKpi  = <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/></svg>;
const IcoCal  = <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>;

function Badge({c,children}){ return <span style={{display:"inline-flex",alignItems:"center",padding:"3px 8px",borderRadius:20,fontSize:10,fontWeight:600,background:c+"18",color:c,border:`1px solid ${c}30`}}>{children}</span>; }

// ─── CALENDÁRIO DE INTERVALO ────────────────────────────────────────
function CalendarioRange({ de, ate, onSelecionar, onLimpar }) {
  const [mes, setMes] = useState(() => { const d=new Date(); d.setDate(1); return d; });
  const [step, setStep] = useState(0);
  const MESES = ["Janeiro","Fevereiro","Março","Abril","Maio","Junho","Julho","Agosto","Setembro","Outubro","Novembro","Dezembro"];
  const DIAS  = ["D","S","T","Q","Q","S","S"];
  const ano=mes.getFullYear(), m=mes.getMonth();
  const totalDias=new Date(ano,m+1,0).getDate();
  const primDia=new Date(ano,m,1).getDay();
  const hoje=new Date(); hoje.setHours(0,0,0,0);
  const celulas=[];
  for(let i=0;i<primDia;i++) celulas.push(null);
  for(let i=1;i<=totalDias;i++) celulas.push(new Date(ano,m,i));
  function dStr(d){ return d?d.toLocaleDateString("pt-BR",{day:"2-digit",month:"2-digit",year:"numeric"}):""; }
  function clicar(d){
    if(step===0){ onSelecionar(d,null); setStep(1); }
    else{ if(d<de){onSelecionar(d,de);}else{onSelecionar(de,d);} setStep(0); }
  }
  function ehIni(d){ return de&&d.getTime()===de.getTime(); }
  function ehFim(d){ return ate&&d.getTime()===ate.getTime(); }
  function noRange(d){ return de&&ate&&d>de&&d<ate; }
  function ehHoje(d){ return d.getTime()===hoje.getTime(); }
  return (
    <div style={{background:CARD,border:`1px solid ${BD}`,borderRadius:12,boxShadow:"0 8px 32px rgba(0,0,0,0.14)",padding:16,minWidth:300}}>
      <p style={{color:step===0?BLU:GRN,fontSize:11,fontWeight:600,margin:"0 0 10px",textAlign:"center"}}>
        {step===0?"Clique na data inicial":"Clique na data final"}
      </p>
      <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:10}}>
        <button onClick={()=>{const d=new Date(mes);d.setMonth(d.getMonth()-1);setMes(d);}} style={{width:28,height:28,borderRadius:6,border:`1px solid ${BD}`,background:CARD,cursor:"pointer",color:MUTED,fontSize:16}}>‹</button>
        <span style={{fontWeight:700,fontSize:13}}>{MESES[m]} {ano}</span>
        <button onClick={()=>{const d=new Date(mes);d.setMonth(d.getMonth()+1);setMes(d);}} style={{width:28,height:28,borderRadius:6,border:`1px solid ${BD}`,background:CARD,cursor:"pointer",color:MUTED,fontSize:16}}>›</button>
      </div>
      <div style={{display:"grid",gridTemplateColumns:"repeat(7,1fr)",marginBottom:4}}>
        {DIAS.map((d,i)=><div key={i} style={{textAlign:"center",fontSize:10,fontWeight:700,color:MUTED,padding:"2px 0"}}>{d}</div>)}
      </div>
      <div style={{display:"grid",gridTemplateColumns:"repeat(7,1fr)",gap:2}}>
        {celulas.map((d,i)=>{
          if(!d) return <div key={i}/>;
          const ini=ehIni(d),fim=ehFim(d),dentro=noRange(d),hj=ehHoje(d),ativo=ini||fim;
          return(
            <button key={i} onClick={()=>clicar(d)}
              style={{width:"100%",aspectRatio:"1",borderRadius:ini?"6px 0 0 6px":fim?"0 6px 6px 0":dentro?"0":"6px",border:"none",background:ativo?BLU:dentro?"#DBEAFE":CARD,color:ativo?"#fff":hj?BLU:TEXT,fontWeight:ativo||hj?700:400,fontSize:12,cursor:"pointer",position:"relative",outline:"none"}}
              onMouseEnter={e=>{if(!ativo&&!dentro)e.currentTarget.style.background=BG;}}
              onMouseLeave={e=>{if(!ativo&&!dentro)e.currentTarget.style.background=CARD;}}>
              {d.getDate()}
              {hj&&<span style={{position:"absolute",bottom:2,left:"50%",transform:"translateX(-50%)",width:3,height:3,borderRadius:"50%",background:ativo?"#fff":BLU}}/>}
            </button>
          );
        })}
      </div>
      {(de||ate)&&(
        <div style={{marginTop:12,paddingTop:10,borderTop:`1px solid ${BD}`,display:"flex",justifyContent:"space-between",alignItems:"center"}}>
          <span style={{fontSize:11,color:MUTED}}>{dStr(de)}{ate?` → ${dStr(ate)}`:""}</span>
          <button onClick={()=>{onLimpar();setStep(0);}} style={{fontSize:11,color:RED,background:"none",border:"none",cursor:"pointer",fontWeight:600}}>Limpar</button>
        </div>
      )}
    </div>
  );
}

// ─── MODAIS ─────────────────────────────────────────────────────────
function BaixaModal({contrato, parcelas, onConfirmar, onFechar}){
  const [dados, setDados] = useState({substatus:"CLIENTE_DESAPARECIDO", motivo:"", observacao:"", possibilidadeRecuperacao:"BAIXA", statusJuridico:"NAO_ANALISADO", proximaProvidencia:""});
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState(null);
  const ps = (parcelas||[]).filter(p=>String(p.ID_CONTRATO)===String(contrato.ID_CONTRATO));
  const valPrincipal = parseFloat(contrato.VALOR_PRINCIPAL||0);
  const valTotal     = parseFloat(contrato.VALOR_TOTAL||contrato.VALOR_TOTAL_FINAL||0);
  const totalPago    = ps.filter(p=>p.STATUS==="pago").reduce((s,p)=>s+(parseFloat(p.VALOR_PAGO)||0),0);
  const jurosJaPagos = ps.filter(p=>p.STATUS==="pago").reduce((s,p)=>s+Math.max(0,(parseFloat(p.VALOR_PAGO)||0)-(parseFloat(p.VALOR_PRINCIPAL)||0)),0);
  const capitalRecuperado = Math.min(totalPago, valPrincipal);
  const prejuizoCapital   = Math.max(0, valPrincipal-capitalRecuperado);
  const jurosNaoReal      = Math.max(0, (valTotal-valPrincipal)-jurosJaPagos);
  const pctRecuperado     = valPrincipal>0?(capitalRecuperado/valPrincipal*100):0;
  const atrasadas = ps.filter(p=>p.STATUS==="atrasado");
  const diasAtraso = atrasadas.length>0?Math.max(...atrasadas.map(p=>{const dv=parseDate(p.DATA_VENCIMENTO);if(!dv)return 0;const d=Math.round((new Date()-dv)/86400000);return d>0?d:0;})):0;
  const confirmar = async()=>{
    if(!dados.motivo){setMsg("Informe o motivo da baixa.");return;}
    setLoading(true);setMsg(null);
    const res=await postAction({action:"baixarContrato",idContrato:contrato.ID_CONTRATO,dados:{...dados,diasAtraso,valorRecuperadoAntesBaixa:capitalRecuperado,jurosJaRecebidos:jurosJaPagos,data:hojeStr()}});
    if(res.ok){onConfirmar();}else setMsg(res.erro||"Erro.");
    setLoading(false);
  };
  const campo=(label,field,opts)=>(<div><span style={LS}>{label}</span>{opts?<select value={dados[field]} onChange={e=>setDados(p=>({...p,[field]:e.target.value}))} style={IS}>{opts.map(o=><option key={o.v} value={o.v}>{o.l}</option>)}</select>:<input value={dados[field]} onChange={e=>setDados(p=>({...p,[field]:e.target.value}))} style={IS}/>}</div>);
  return(
    <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.5)",zIndex:400,display:"flex",alignItems:"center",justifyContent:"center",padding:20}}>
      <div style={{background:CARD,borderRadius:12,width:"100%",maxWidth:600,maxHeight:"90vh",display:"flex",flexDirection:"column",boxShadow:"0 20px 60px rgba(0,0,0,0.2)"}}>
        <div style={{padding:"20px 24px 14px",borderBottom:`1px solid ${BD}`,background:"#FEF2F2",borderRadius:"12px 12px 0 0"}}><h2 style={{color:RED,fontSize:17,fontWeight:700,margin:0}}>⚠️ Baixar Contrato como Prejuízo</h2><p style={{fontSize:13,color:MUTED,margin:"4px 0 0"}}>Contrato {contrato.ID_CONTRATO} • {contrato.NOME_CLIENTE}</p></div>
        <div style={{padding:24,overflowY:"auto",flex:1}}>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:16,marginBottom:24,padding:16,background:BG,borderRadius:10}}>
            <div><span style={LS}>Capital Emprestado</span><div style={{fontSize:15,fontWeight:700}}>{fmtR(valPrincipal)}</div></div>
            <div><span style={LS}>Capital Recuperado</span><div style={{fontSize:15,fontWeight:700,color:GRN}}>{fmtR(capitalRecuperado)}</div></div>
            <div style={{borderTop:`1px solid ${BD}`,paddingTop:8}}><span style={LS}>Prejuízo de Capital</span><div style={{fontSize:15,fontWeight:700,color:RED}}>{fmtR(prejuizoCapital)}</div></div>
            <div style={{borderTop:`1px solid ${BD}`,paddingTop:8}}><span style={LS}>Juros Não Realizados</span><div style={{fontSize:15,fontWeight:700,color:ORG}}>{fmtR(jurosNaoReal)}</div></div>
            <div style={{borderTop:`1px solid ${BD}`,paddingTop:8}}><span style={LS}>Total Pago</span><div style={{fontSize:15,fontWeight:700,color:BLU}}>{fmtR(totalPago)}</div></div>
            <div style={{borderTop:`1px solid ${BD}`,paddingTop:8}}><span style={LS}>% Recuperado</span><div style={{fontSize:15,fontWeight:700,color:RED}}>{fmtP(pctRecuperado)}</div></div>
            <div style={{gridColumn:"1/-1",borderTop:`1px solid ${BD}`,paddingTop:8}}><span style={LS}>Dias de Atraso (Máx)</span><div style={{fontSize:15,fontWeight:700,color:RED}}>{diasAtraso} dias</div></div>
          </div>
          <div style={{display:"flex",flexDirection:"column",gap:16}}>
            {campo("Substatus","substatus",[{v:"CLIENTE_DESAPARECIDO",l:"Cliente Desaparecido"},{v:"SEM_BENS_PENHORAVEIS",l:"Sem Bens/Renda"},{v:"FALECIMENTO",l:"Falecimento"},{v:"FRAUDE_IDENTIFICADA",l:"Má-fé aparente"},{v:"ACORDO_VALOR_IRRISORIO",l:"Acordo Irrisório"}])}
            {campo("Motivo Detalhado (Obrigatório)","motivo")}
            {campo("Possibilidade de Recuperação","possibilidadeRecuperacao",[{v:"BAIXA",l:"Baixa"},{v:"RECURSOS_FUTUROS",l:"Remota"},{v:"JUDICIAL",l:"Judicial"}])}
            {campo("Status Jurídico","statusJuridico",[{v:"NAO_ANALISADO",l:"Não analisado"},{v:"ANALISE_INTERNA",l:"Análise Interna"},{v:"PROCESSO_AJUIZADO",l:"Processo Ajuizado"}])}
            <div><span style={LS}>Próxima Providência</span><input value={dados.proximaProvidencia} onChange={e=>setDados(p=>({...p,proximaProvidencia:e.target.value}))} style={IS}/></div>
            <div><span style={LS}>Observação</span><textarea value={dados.observacao} onChange={e=>setDados(p=>({...p,observacao:e.target.value}))} style={{...IS,height:80,resize:"none"}}/></div>
          </div>
          {msg&&<div style={{marginTop:16,padding:12,borderRadius:8,background:RED+"10",color:RED,fontSize:13,textAlign:"center",fontWeight:600}}>{msg}</div>}
        </div>
        <div style={{padding:20,borderTop:`1px solid ${BD}`,display:"flex",gap:12}}>
          <button onClick={onFechar} style={{flex:1,padding:12,borderRadius:8,border:`1px solid ${BD}`,background:CARD,cursor:"pointer",fontWeight:600}}>Cancelar</button>
          <button onClick={confirmar} disabled={loading} style={{flex:2,padding:12,borderRadius:8,border:"none",background:RED,color:"#FFF",cursor:"pointer",fontWeight:700,opacity:loading?0.7:1}}>{loading?"Processando...":"Confirmar Baixa"}</button>
        </div>
      </div>
    </div>
  );
}

function ModalAcordoPerda({contrato,parcelas,onConfirmar,onFechar}){
  const [valorAcordo,setValorAcordo]=useState("");const [loading,setLoading]=useState(false);const [msg,setMsg]=useState(null);
  const abertas=(parcelas||[]).filter(p=>String(p.ID_CONTRATO)===String(contrato.ID_CONTRATO)&&p.STATUS!=="pago");
  const principalAberto=abertas.reduce((s,p)=>s+parseFloat(p.VALOR_PRINCIPAL||0),0);
  const jurosAberto=abertas.reduce((s,p)=>s+parseFloat(p.VALOR_JUROS||0),0);
  const vAcordo=parseFloat(valorAcordo)||0;
  const confirmar=async()=>{
    if(!valorAcordo||vAcordo<=0){setMsg("Informe o valor acordado.");return;}
    setLoading(true);
    const res=await postAction({action:"baixarContrato",idContrato:contrato.ID_CONTRATO,dados:{tipo:"acordo_com_perda",valorRecebido:vAcordo,principalPerdido:Math.max(0,principalAberto-vAcordo),jurosCancelados:jurosAberto,motivo:"Liquidação com desconto/acordo",substatus:"ACORDO_LIQUIDACAO",data:hojeStr()}});
    if(res.ok)onConfirmar();else setMsg(res.erro||"Erro.");
    setLoading(false);
  };
  return(
    <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.6)",zIndex:500,display:"flex",alignItems:"center",justifyContent:"center",padding:20}}>
      <div style={{background:"#FFF",borderRadius:16,width:"100%",maxWidth:500,padding:24,boxShadow:"0 20px 50px rgba(0,0,0,0.3)"}}>
        <h2 style={{margin:"0 0 10px",color:RED,fontSize:20}}>🤝 Acordo de Encerramento</h2>
        <p style={{fontSize:14,color:MUTED,marginBottom:20}}>Contrato: <strong>{contrato.ID_CONTRATO}</strong> • {contrato.NOME_CLIENTE}</p>
        <div style={{background:BG,padding:15,borderRadius:10,marginBottom:20}}>
          <div style={{display:"flex",justifyContent:"space-between",fontSize:13,marginBottom:5}}><span>Principal em Aberto:</span><strong>{fmtR(principalAberto)}</strong></div>
          <div style={{display:"flex",justifyContent:"space-between",fontSize:13}}><span>Juros Futuros:</span><strong>{fmtR(jurosAberto)}</strong></div>
        </div>
        <span style={LS}>Valor Recebido no Acordo</span>
        <input type="number" value={valorAcordo} onChange={e=>setValorAcordo(e.target.value)} placeholder="0.00" style={{...IS,fontSize:18,fontWeight:700,height:50,textAlign:"center"}}/>
        {msg&&<div style={{marginTop:15,color:RED,fontSize:13,textAlign:"center"}}>{msg}</div>}
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12,marginTop:20}}>
          <button onClick={onFechar} style={{padding:12,borderRadius:8,border:`1px solid ${BD}`,background:"none",cursor:"pointer"}}>Cancelar</button>
          <button onClick={confirmar} disabled={loading} style={{padding:12,borderRadius:8,border:"none",background:RED,color:"#FFF",fontWeight:700,cursor:"pointer",opacity:loading?0.7:1}}>{loading?"Processando...":"Confirmar Acordo"}</button>
        </div>
      </div>
    </div>
  );
}

function RecuperacaoModal({contrato,onConfirmar,onFechar}){
  const [valor,setValor]=useState("");const [loading,setLoading]=useState(false);const [msg,setMsg]=useState(null);
  const confirmar=async()=>{
    if(!valor)return;setLoading(true);setMsg(null);
    const res=await postAction({action:"recuperacaoAposBaixa",idContrato:contrato.ID_CONTRATO,dados:{valor:parseFloat(valor),data:hojeStr()}});
    if(res.ok)onConfirmar();else setMsg(res.erro||"Erro.");setLoading(false);
  };
  return(
    <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.5)",zIndex:400,display:"flex",alignItems:"center",justifyContent:"center",padding:20}}>
      <div style={{background:CARD,borderRadius:12,width:"100%",maxWidth:400,padding:24,boxShadow:"0 20px 60px rgba(0,0,0,0.2)"}}>
        <h2 style={{fontSize:18,fontWeight:700,margin:"0 0 8px",color:PUR}}>💸 Recuperação de Crédito</h2>
        <p style={{fontSize:13,color:MUTED,margin:"0 0 20px"}}>Contrato: {contrato.ID_CONTRATO}</p>
        <span style={LS}>Valor Recebido</span>
        <input type="number" value={valor} onChange={e=>setValor(e.target.value)} placeholder="0.00" style={{...IS,fontSize:16,fontWeight:700}}/>
        {msg&&<div style={{marginTop:12,color:RED,fontSize:13}}>{msg}</div>}
        <div style={{display:"flex",gap:12,marginTop:20}}>
          <button onClick={onFechar} style={{flex:1,padding:10,borderRadius:8,border:`1px solid ${BD}`,background:CARD,cursor:"pointer"}}>Sair</button>
          <button onClick={confirmar} disabled={loading} style={{flex:2,padding:10,borderRadius:8,border:"none",background:PUR,color:"#FFF",cursor:"pointer",fontWeight:700,opacity:loading?0.7:1}}>{loading?"Gravando...":"Confirmar"}</button>
        </div>
      </div>
    </div>
  );
}

function ClienteModal({cliente,onFechar}){
  const [t,setT]=useState("perfil");
  return(
    <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.5)",zIndex:300,display:"flex",alignItems:"center",justifyContent:"center",padding:20}}>
      <div style={{background:BG,borderRadius:16,width:"100%",maxWidth:900,height:"80vh",display:"flex",flexDirection:"column",overflow:"hidden",boxShadow:"0 30px 90px rgba(0,0,0,0.3)"}}>
        <div style={{background:CARD,padding:20,borderBottom:`1px solid ${BD}`,display:"flex",justifyContent:"space-between",alignItems:"center"}}>
          <div style={{display:"flex",alignItems:"center",gap:16}}><div style={{width:44,height:44,background:BLU,borderRadius:12,display:"flex",alignItems:"center",justifyContent:"center",color:"#FFF",fontSize:18,fontWeight:800}}>{(cliente.NOME_CLIENTE||"?")[0]}</div><div><h2 style={{margin:0,fontSize:18,fontWeight:800}}>{cliente.NOME_CLIENTE}</h2><div style={{fontSize:12,color:MUTED}}>{cliente.ID_CLIENTE}</div></div></div>
          <button onClick={onFechar} style={{background:BG,border:"none",width:32,height:32,borderRadius:8,cursor:"pointer"}}>{IcoArr}</button>
        </div>
        <div style={{display:"flex",background:CARD,padding:"0 20px",borderBottom:`1px solid ${BD}`,gap:20}}>
          {["perfil"].map(tab=><button key={tab} onClick={()=>setT(tab)} style={{padding:"14px 4px",background:"none",border:"none",borderBottom:t===tab?`2px solid ${BLU}`:"2px solid transparent",color:t===tab?BLU:MUTED,fontWeight:600,cursor:"pointer",fontSize:13,textTransform:"capitalize"}}>{tab}</button>)}
        </div>
        <div style={{flex:1,overflowY:"auto",padding:20}}>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:20}}>
            <div style={{background:CARD,padding:18,borderRadius:12,border:`1px solid ${BD}`}}>
              <h3 style={{margin:"0 0 14px",fontSize:14}}>Dados</h3>
              {[{l:"Telefone",v:cliente.TELEFONE||cliente.TELEFONE_WPP},{l:"Status",v:cliente.STATUS_CLIENTE}].map(i=><div key={i.l} style={{marginBottom:10}}><span style={LS}>{i.l}</span><div style={{fontSize:13}}>{i.v||"—"}</div></div>)}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function PagamentoDrop({contratos,parcelas,onSucesso}){
  const [busca,setBusca]=useState("");const [showDrop,setShowDrop]=useState(false);const [cliente,setCliente]=useState(null);const [parcela,setParcela]=useState(null);const [tipo,setTipo]=useState(null);const [data,setData]=useState(hojeStr());const [valor,setValor]=useState("");const [loading,setLoading]=useState(false);const [msg,setMsg]=useState(null);const ref=useRef();
  useEffect(()=>{const h=e=>{if(ref.current&&!ref.current.contains(e.target))setShowDrop(false);};document.addEventListener("mousedown",h);return()=>document.removeEventListener("mousedown",h);},[]);
  const clis=useMemo(()=>{if(busca.length<2)return[];const ids=new Set();return (contratos||[]).filter(c=>{const m=(c.NOME_CLIENTE||"").toLowerCase().includes(busca.toLowerCase())||String(c.ID_CLIENTE||"").toLowerCase().includes(busca.toLowerCase());if(m&&!ids.has(c.ID_CLIENTE)){ids.add(c.ID_CLIENTE);return true;}return false;}).slice(0,6);},[busca,contratos]);
  const pars=useMemo(()=>cliente?(parcelas||[]).filter(p=>String(p.ID_CLIENTE)===String(cliente.ID_CLIENTE)&&p.STATUS==="pendente").sort((a,b)=>toNum(a.DATA_VENCIMENTO)-toNum(b.DATA_VENCIMENTO)):[],[cliente,parcelas]);
  const registrar=async()=>{if(!parcela||!valor||!data)return;setLoading(true);setMsg(null);const res=await postAction({action:tipo==="parcial"?"pagamentoParcial":"pagamento",idParcela:parcela.ID_PARCELA,valor:parseFloat(valor),data,forma:"dinheiro"});if(res.ok){setMsg({ok:true,t:res.msg||"Sucesso!"});setTimeout(onSucesso,1500);}else setMsg({ok:false,t:res.erro||"Erro"});setLoading(false);};
  return(
    <div style={{background:CARD,borderRadius:12,padding:20,border:`1px solid ${BD}`}}>
      <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:16}}><div style={{background:GRN+"15",color:GRN,padding:8,borderRadius:8}}>{IcoPag}</div><h3 style={{margin:0,fontSize:15,fontWeight:700}}>Registrar Pagamento</h3></div>
      <div style={{display:"flex",flexDirection:"column",gap:12}}>
        <div style={{position:"relative"}} ref={ref}>
          <span style={LS}>Buscar Cliente</span>
          <div style={{position:"relative"}}><div style={{position:"absolute",left:10,top:"50%",transform:"translateY(-50%)"}}>{IcoSrch}</div><input value={cliente?cliente.NOME_CLIENTE:busca} onChange={e=>{setBusca(e.target.value);setCliente(null);setParcela(null);setShowDrop(true);}} onFocus={()=>setShowDrop(true)} placeholder="Nome ou ID..." style={{...IS,paddingLeft:32}}/>{cliente&&<button onClick={()=>{setCliente(null);setBusca("");}} style={{position:"absolute",right:8,top:"50%",transform:"translateY(-50%)",border:"none",background:"none",cursor:"pointer",color:MUTED,fontSize:16}}>×</button>}</div>
          {showDrop&&clis.length>0&&<div style={{position:"absolute",top:"100%",left:0,right:0,background:CARD,border:`1px solid ${BD}`,borderRadius:8,marginTop:4,zIndex:100,boxShadow:"0 10px 30px rgba(0,0,0,0.1)"}}>{clis.map(c=><div key={c.ID_CLIENTE} onClick={()=>{setCliente(c);setShowDrop(false);}} style={{padding:"10px 14px",cursor:"pointer",fontSize:13,borderBottom:`1px solid ${BG}`}} onMouseEnter={e=>e.currentTarget.style.background=BG} onMouseLeave={e=>e.currentTarget.style.background=CARD}><strong>{c.ID_CLIENTE}</strong> - {c.NOME_CLIENTE}</div>)}</div>}
        </div>
        {cliente&&<div><span style={LS}>Parcela</span>{pars.length>0?<select value={parcela?.ID_PARCELA||""} onChange={e=>{const p=pars.find(x=>x.ID_PARCELA===e.target.value);setParcela(p);setValor(p.VALOR_PARCELA);}} style={IS}><option value="">Selecione...</option>{pars.map(p=><option key={p.ID_PARCELA} value={p.ID_PARCELA}>Parc {p.NUM_PARCELA} ({fmtDt(p.DATA_VENCIMENTO)}) - {fmtR(p.VALOR_PARCELA)}</option>)}</select>:<div style={{padding:8,background:RED+"08",color:RED,fontSize:12,borderRadius:6}}>Nenhuma parcela pendente.</div>}</div>}
        {parcela&&<div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10}}>
          <div><span style={LS}>Tipo</span><select value={tipo||""} onChange={e=>setTipo(e.target.value)} style={IS}><option value="">Selecione...</option><option value="total">Total</option><option value="parcial">Somente Juros</option></select></div>
          <div><span style={LS}>Valor</span><input type="number" value={valor} onChange={e=>setValor(e.target.value)} style={IS}/></div>
          <div style={{gridColumn:"1/-1"}}><span style={LS}>Data</span><input type="date" value={data} onChange={e=>setData(e.target.value)} style={IS}/></div>
          <button onClick={registrar} disabled={loading||!tipo} style={{gridColumn:"1/-1",padding:"11px",borderRadius:8,border:"none",background:GRN,color:"#FFF",fontWeight:700,cursor:"pointer",opacity:loading||!tipo?0.6:1}}>{loading?"Processando...":"Confirmar"}</button>
        </div>}
        {msg&&<div style={{padding:10,borderRadius:8,background:msg.ok?GRN+"10":RED+"10",color:msg.ok?GRN:RED,fontSize:12,textAlign:"center",fontWeight:600}}>{msg.t}</div>}
      </div>
    </div>
  );
}

function PagamentoParcelaModal({parcela,onConfirmar,onFechar}){
  const [tipo,setTipo]=useState("total");
  const [data,setData]=useState(hojeStr());
  const [valor,setValor]=useState(String(parcela?.VALOR_PARCELA||""));
  const [loading,setLoading]=useState(false);
  const [msg,setMsg]=useState(null);
  const registrar=async()=>{if(!parcela||!valor||!data)return;setLoading(true);setMsg(null);const res=await postAction({action:tipo==="parcial"?"pagamentoParcial":"pagamento",idParcela:parcela.ID_PARCELA,valor:parseFloat(valor),data,forma:"dinheiro"});if(res.ok){setMsg({ok:true,t:res.msg||"Pagamento registrado!"});setTimeout(onConfirmar,900);}else setMsg({ok:false,t:res.erro||"Erro ao registrar pagamento"});setLoading(false);};
  return(
    <div style={{position:"fixed",inset:0,zIndex:300,background:"rgba(15,23,42,0.35)",display:"flex",alignItems:"center",justifyContent:"center",padding:20}} onClick={onFechar}>
      <div onClick={e=>e.stopPropagation()} style={{width:"100%",maxWidth:420,background:CARD,borderRadius:14,border:`1px solid ${BD}`,boxShadow:"0 24px 80px rgba(15,23,42,0.22)",overflow:"hidden"}}>
        <div style={{padding:"18px 20px",borderBottom:`1px solid ${BD}`}}><h2 style={{margin:0,fontSize:17,fontWeight:800}}>Registrar pagamento</h2><p style={{margin:"5px 0 0",fontSize:12,color:MUTED}}>{parcela?.NOME_CLIENTE||"Cliente"} · Parcela {parcela?.NUM_PARCELA||parcela?.NUMERO_PARCELA||parcela?.ID_PARCELA||"—"}</p></div>
        <div style={{padding:20,display:"flex",flexDirection:"column",gap:12}}>
          <div><span style={LS}>Tipo</span><select value={tipo} onChange={e=>setTipo(e.target.value)} style={IS}><option value="total">Pagamento total</option><option value="parcial">Somente juros</option></select></div>
          <div><span style={LS}>Valor</span><input type="number" value={valor} onChange={e=>setValor(e.target.value)} style={IS}/></div>
          <div><span style={LS}>Data</span><input type="date" value={data} onChange={e=>setData(e.target.value)} style={IS}/></div>
          {msg&&<div style={{padding:10,borderRadius:8,background:msg.ok?GRN+"10":RED+"10",color:msg.ok?GRN:RED,fontSize:12,fontWeight:700}}>{msg.t}</div>}
          <div style={{display:"flex",gap:10,justifyContent:"flex-end",marginTop:4}}><button onClick={onFechar} style={{padding:"10px 14px",borderRadius:8,border:`1px solid ${BD}`,background:CARD,color:MUTED,cursor:"pointer",fontWeight:700}}>Cancelar</button><button onClick={registrar} disabled={loading||!valor||!data} style={{padding:"10px 14px",borderRadius:8,border:"none",background:GRN,color:"#FFF",cursor:"pointer",fontWeight:800,opacity:loading||!valor||!data?0.6:1}}>{loading?"Registrando...":"Confirmar"}</button></div>
        </div>
      </div>
    </div>
  );
}

function NovoContrato({contratos,onSucesso}){
  const [busca,setBusca]=useState("");const [showDrop,setShowDrop]=useState(false);const [cliente,setCliente]=useState(null);const [principal,setPrincipal]=useState("");const [nParcelas,setNParcelas]=useState("");const [taxa,setTaxa]=useState("");const [dtEmp,setDtEmp]=useState(hojeStr());const [dtVenc,setDtVenc]=useState("");const [loading,setLoading]=useState(false);const [msg,setMsg]=useState(null);const ref=useRef();
  useEffect(()=>{const h=e=>{if(ref.current&&!ref.current.contains(e.target))setShowDrop(false);};document.addEventListener("mousedown",h);return()=>document.removeEventListener("mousedown",h);},[]);
  const clis=useMemo(()=>{if(busca.length<2)return[];const ids=new Set();return (contratos||[]).filter(c=>{const m=(c.NOME_CLIENTE||"").toLowerCase().includes(busca.toLowerCase())||String(c.ID_CLIENTE||"").toLowerCase().includes(busca.toLowerCase());if(m&&!ids.has(c.ID_CLIENTE)){ids.add(c.ID_CLIENTE);return true;}return false;}).slice(0,6);},[busca,contratos]);
  const criar=async()=>{if(!cliente||!principal||!nParcelas||!taxa||!dtEmp||!dtVenc)return;setLoading(true);setMsg(null);const res=await postAction({action:"novoContrato",dados:{idCliente:cliente.ID_CLIENTE,nomeCliente:cliente.NOME_CLIENTE,principal,parcelas:nParcelas,taxa,dataEmprestimo:dtEmp,dataVencimento:dtVenc}});if(res.ok){setMsg({ok:true,t:"Contrato criado!"});setTimeout(onSucesso,1500);}else setMsg({ok:false,t:res.erro||"Erro"});setLoading(false);};
  return(
    <div style={{background:CARD,borderRadius:12,padding:20,border:`1px solid ${BD}`}}>
      <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:16}}><div style={{background:BLU+"15",color:BLU,padding:8,borderRadius:8}}>{IcoCtr}</div><h3 style={{margin:0,fontSize:15,fontWeight:700}}>Novo Contrato</h3></div>
      <div style={{display:"flex",flexDirection:"column",gap:12}}>
        <div style={{position:"relative"}} ref={ref}>
          <span style={LS}>Buscar Cliente</span>
          <div style={{position:"relative"}}><div style={{position:"absolute",left:10,top:"50%",transform:"translateY(-50%)"}}>{IcoSrch}</div><input value={cliente?cliente.NOME_CLIENTE:busca} onChange={e=>{setBusca(e.target.value);setCliente(null);setShowDrop(true);}} onFocus={()=>setShowDrop(true)} placeholder="Nome ou ID..." style={{...IS,paddingLeft:32}}/>{cliente&&<button onClick={()=>{setCliente(null);setBusca("");}} style={{position:"absolute",right:8,top:"50%",transform:"translateY(-50%)",border:"none",background:"none",cursor:"pointer",color:MUTED,fontSize:16}}>×</button>}</div>
          {showDrop&&clis.length>0&&<div style={{position:"absolute",top:"100%",left:0,right:0,background:CARD,border:`1px solid ${BD}`,borderRadius:8,marginTop:4,zIndex:100,boxShadow:"0 10px 30px rgba(0,0,0,0.1)"}}>{clis.map(c=><div key={c.ID_CLIENTE} onClick={()=>{setCliente(c);setShowDrop(false);}} style={{padding:"10px 14px",cursor:"pointer",fontSize:13,borderBottom:`1px solid ${BG}`}} onMouseEnter={e=>e.currentTarget.style.background=BG} onMouseLeave={e=>e.currentTarget.style.background=CARD}><strong>{c.ID_CLIENTE}</strong> - {c.NOME_CLIENTE}</div>)}</div>}
        </div>
        {cliente&&<div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10}}>
          <div><span style={LS}>Principal</span><input type="number" value={principal} onChange={e=>setPrincipal(e.target.value)} placeholder="0.00" style={IS}/></div>
          <div><span style={LS}>Parcelas</span><input type="number" value={nParcelas} onChange={e=>setNParcelas(e.target.value)} placeholder="1" style={IS}/></div>
          <div><span style={LS}>Taxa Mensal (%)</span><input type="number" value={taxa} onChange={e=>setTaxa(e.target.value)} placeholder="0.00" style={IS}/></div>
          <div><span style={LS}>1º Vencimento</span><input type="date" value={dtVenc} onChange={e=>setDtVenc(e.target.value)} style={IS}/></div>
          <div style={{gridColumn:"1/-1"}}><span style={LS}>Data Empréstimo</span><input type="date" value={dtEmp} onChange={e=>setDtEmp(e.target.value)} style={IS}/></div>
          <button onClick={criar} disabled={loading} style={{gridColumn:"1/-1",padding:"11px",borderRadius:8,border:"none",background:BLU,color:"#FFF",fontWeight:700,cursor:"pointer",opacity:loading?0.6:1}}>{loading?"Criando...":"Gerar Contrato"}</button>
        </div>}
        {msg&&<div style={{padding:10,borderRadius:8,background:msg.ok?GRN+"10":RED+"10",color:msg.ok?GRN:RED,fontSize:12,textAlign:"center",fontWeight:600}}>{msg.t}</div>}
      </div>
    </div>
  );
}

// ─── APP ────────────────────────────────────────────────────────────
function App() {
  const [raw, setRaw] = useState(null);
  const [tab, setTab] = useState("dashboard");
  const [loading, setLoading] = useState(true);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [selCli, setSelCli] = useState(null);
  const [baixaModal, setBaixaModal] = useState(null);
  const [acordoModal, setAcordoModal] = useState(null);
  const [recuperacaoModal, setRecuperacaoModal] = useState(null);
  const [simVal, setSimVal] = useState(5000);
  const [simInad, setSimInad] = useState(0);
  const [simVol, setSimVol] = useState(0);
  const [filtroStatus, setFiltroStatus] = useState("todos");
  const [filtroBusca, setFiltroBusca] = useState("");
  const [filtroPerdas, setFiltroPerdas] = useState("todos");
  const [finDe, setFinDe] = useState(null);
  const [finAte, setFinAte] = useState(null);
  const [finCalOpen, setFinCalOpen] = useState(false);
  const [pagamentoHoje, setPagamentoHoje] = useState(null);

  const carregar=()=>{setLoading(true);fetch(API_URL).then(r=>r.json()).then(d=>{setRaw(d);setLoading(false);}).catch(()=>setLoading(false));};
  useEffect(()=>{carregar();},[]);

  const clientes  = useMemo(()=>raw?.CLIENTES  || raw?.clientes  || [], [raw]);
  const contratos = useMemo(()=>raw?.CONTRATOS || raw?.contratos || [], [raw]);
  const parcelas  = useMemo(()=>raw?.PARCELAS  || raw?.parcelas  || [], [raw]);
  const pagamentos= useMemo(()=>raw?.PAGAMENTOS|| raw?.pagamentos|| [], [raw]);

  const filtrados=useMemo(()=>(clientes||[]).filter(c=>{const m=(c.NOME_CLIENTE||"").toLowerCase().includes(filtroBusca.toLowerCase())||String(c.ID_CLIENTE||"").toLowerCase().includes(filtroBusca.toLowerCase());const s=filtroStatus==="todos"||c.STATUS_CLIENTE===filtroStatus;return m&&s;}),[clientes,filtroBusca,filtroStatus]);

  const pFiltradas=useMemo(()=>(contratos||[]).filter(c=>STATUS_PERDA.includes(c.STATUS_CONTRATO)&&(filtroPerdas==="todos"||c.STATUS_CONTRATO===filtroPerdas)),[contratos,filtroPerdas]);

  const M=useMemo(()=>{
    const ST_ATIVOS=["ativo","ativo_em_dia","ativo_em_atraso","em_cobranca","pre_prejuizo","renegociado","em_recuperacao","recuperado_parcialmente"];
    const ativos=(contratos||[]).filter(c=>ST_ATIVOS.includes(String(c.STATUS_CONTRATO||"").toLowerCase()));
    const vAtivos=ativos.reduce((s,c)=>s+parseFloat(c.VALOR_PRINCIPAL||0),0);
    const vAtrasoTotal=(parcelas||[]).filter(p=>p.STATUS==="atrasado").reduce((s,p)=>s+parseFloat(p.VALOR_PARCELA||0),0);
    const taxaInad=vAtivos>0?(vAtrasoTotal/vAtivos*100):0;
    const receitaTotal=(pagamentos||[]).reduce((s,p)=>s+parseFloat(p.VALOR_PAGO||0),0);
    const receitaExtra=(pagamentos||[]).reduce((s,p)=>s+parseFloat(p.RECEITA_EXTRA_ATRASO||0),0);
    const qtyProrrogadas=(parcelas||[]).filter(p=>p.ORIGEM_PARCELA==="gerada_por_pagamento_de_juros").length;
    const pagNormais=(pagamentos||[]).filter(p=>p.TIPO_PAGAMENTO==="pagamento_normal").length;
    const pagAtraso=(pagamentos||[]).filter(p=>p.TIPO_PAGAMENTO==="pagamento_com_atraso").length;
    const pagJuros=(pagamentos||[]).filter(p=>p.TIPO_PAGAMENTO==="somente_juros").length;
    return{vAtivos,vAtrasoTotal,taxaInad,lucroTotal:receitaExtra,receitaTotal,receitaExtra,qtyProrrogadas,pagNormais,pagAtraso,pagJuros};
  },[contratos,parcelas,pagamentos]);


  const parcelasHoje=useMemo(()=>{
    const base=new Date();base.setHours(0,0,0,0);
    return (parcelas||[]).filter(p=>{
      const status=String(p.STATUS||p.STATUS_PARCELA||"").toLowerCase();
      if(["pago","paga","quitado","quitada","baixado","baixada"].includes(status))return false;
      const d=parseDate(p.DATA_VENCIMENTO);if(!d)return false;d.setHours(0,0,0,0);
      return d.getTime()===base.getTime();
    }).map(p=>{const c=(clientes||[]).find(x=>String(x.ID_CLIENTE)===String(p.ID_CLIENTE));return{...p,NOME_CLIENTE:p.NOME_CLIENTE||c?.NOME_CLIENTE||"Cliente sem nome"};}).sort((a,b)=>String(a.NOME_CLIENTE||"").localeCompare(String(b.NOME_CLIENTE||""),"pt-BR"));
  },[parcelas,clientes]);
  const totalParcelasHoje=useMemo(()=>parcelasHoje.reduce((s,p)=>s+parseFloat(p.VALOR_PARCELA||0),0),[parcelasHoje]);

  const mensal=useMemo(()=>["Jan","Fev","Mar","Abr","Mai","Jun","Jul","Ago","Set","Out","Nov","Dez"].map((mes,i)=>{
    const pMes=(pagamentos||[]).filter(p=>{const d=parseDate(p.DATA_PAGAMENTO);return d&&d.getMonth()===i;});
    return{m:mes,v:pMes.reduce((s,p)=>s+parseFloat(p.VALOR_PAGO||0),0),extra:pMes.reduce((s,p)=>s+parseFloat(p.RECEITA_EXTRA_ATRASO||0),0)};
  }),[pagamentos]);

  const cobItems=useMemo(()=>{
    const ids=[...new Set((parcelas||[]).filter(p=>p.STATUS==="atrasado").map(p=>p.ID_CLIENTE))];
    return ids.map(id=>{
      const c=(clientes||[]).find(x=>String(x.ID_CLIENTE)===String(id));
      const ps=(parcelas||[]).filter(p=>String(p.ID_CLIENTE)===String(id)&&p.STATUS==="atrasado");
      const vAtraso=ps.reduce((s,p)=>s+parseFloat(p.VALOR_PARCELA||0),0);
      const maxAtraso=ps.length>0?Math.max(...ps.map(p=>{const d=parseDate(p.DATA_VENCIMENTO);return d?Math.round((new Date()-d)/86400000):0;})):0;
      return{...c,vAtraso,maxAtraso,qtdContratos:[...new Set(ps.map(p=>p.ID_CONTRATO))].length};
    }).sort((a,b)=>b.maxAtraso-a.maxAtraso);
  },[clientes,parcelas]);

  const perdas=useMemo(()=>{
    const baixados=(contratos||[]).filter(c=>c.STATUS_CONTRATO==="baixado_como_prejuizo");
    const capitalBaixado=baixados.reduce((s,c)=>s+parseFloat(c.PREJUIZO_CAPITAL||0),0);
    const recuperadoAposBaixa=baixados.reduce((s,c)=>s+parseFloat(c.VALOR_RECUPERADO_APOS_BAIXA||0),0);
    return{capitalBaixado,recuperadoAposBaixa,prejuizoTotal:capitalBaixado-recuperadoAposBaixa,txRecuperacao:capitalBaixado>0?(recuperadoAposBaixa/capitalBaixado*100):0};
  },[contratos]);

  const pagsFiltrados=useMemo(()=>{
    const sorted=[...(pagamentos||[])].sort((a,b)=>toNum(b.DATA_PAGAMENTO)-toNum(a.DATA_PAGAMENTO));
    if(!finDe) return sorted;
    return sorted.filter(p=>{
      const d=parseDate(p.DATA_PAGAMENTO);
      if(!d)return false;
      d.setHours(0,0,0,0);
      const ini=new Date(finDe);ini.setHours(0,0,0,0);
      const fim=finAte?new Date(finAte):new Date(finDe);fim.setHours(23,59,59,999);
      return d>=ini&&d<=fim;
    });
  },[pagamentos,finDe,finAte]);

  const totaisFin=useMemo(()=>({
    total:pagsFiltrados.reduce((s,p)=>s+parseFloat(p.VALOR_PAGO||0),0),
    extra:pagsFiltrados.reduce((s,p)=>s+parseFloat(p.RECEITA_EXTRA_ATRASO||0),0),
    count:pagsFiltrados.length,
  }),[pagsFiltrados]);

  function dStrFin(d){return d?d.toLocaleDateString("pt-BR",{day:"2-digit",month:"2-digit",year:"numeric"}):""}
  const labelPeriodo=finDe&&finAte?`${dStrFin(finDe)} → ${dStrFin(finAte)}`:finDe?`A partir de ${dStrFin(finDe)}`:"Selecionar período";

  const Nav=({id,label,ico})=>(
    <div onClick={()=>setTab(id)} style={{display:"flex",alignItems:"center",gap:12,padding:"12px 16px",borderRadius:10,cursor:"pointer",background:tab===id?BLU:"transparent",color:tab===id?"#FFF":MUTED,marginBottom:4}} onMouseEnter={e=>tab!==id&&(e.currentTarget.style.background=BG)} onMouseLeave={e=>tab!==id&&(e.currentTarget.style.background="transparent")}>
      {ico}<span style={{fontSize:14,fontWeight:600}}>{label}</span>
    </div>
  );

  if(loading&&!raw)return(
    <div style={{height:"100vh",display:"flex",alignItems:"center",justifyContent:"center",background:BG}}>
      <div style={{textAlign:"center"}}><div style={{width:40,height:40,border:`4px solid ${BD}`,borderTopColor:BLU,borderRadius:"50%",animation:"spin 1s linear infinite",margin:"0 auto 15px"}}/><div style={{fontSize:14,color:MUTED,fontWeight:600}}>Carregando FinanceiroOp...</div></div>
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  );

  return(
    <div style={{display:"flex",height:"100vh",background:BG,color:TEXT,fontFamily:"'Inter', sans-serif"}}>

      {finCalOpen&&<div onClick={()=>setFinCalOpen(false)} style={{position:"fixed",inset:0,zIndex:199,background:"transparent"}}/>}

      {/* SIDEBAR */}
      <div style={{width:sidebarOpen?SW:0,background:CARD,borderRight:`1px solid ${BD}`,display:"flex",flexDirection:"column",overflow:"hidden",transition:"0.3s",flexShrink:0}}>
        <div style={{padding:24,display:"flex",alignItems:"center",gap:12,borderBottom:`1px solid ${BD}`}}>
          <div style={{width:32,height:32,background:BLU,borderRadius:8,display:"flex",alignItems:"center",justifyContent:"center",color:"#FFF"}}>{IcoFin}</div>
          <span style={{fontWeight:800,fontSize:18,letterSpacing:"-0.5px"}}>Financeiro<span style={{color:BLU}}>Op</span></span>
        </div>
        <div style={{padding:16,flex:1}}>
          <Nav id="dashboard"  label="Dashboard"        ico={IcoDash}/>
          <Nav id="clientes"   label="Clientes"         ico={IcoCli}/>
          <Nav id="cobranca"   label="Cobrança"         ico={IcoCob}/>
          <Nav id="financeiro" label="Financeiro"       ico={IcoFin}/>
          <Nav id="perdas"     label="Perdas & Recup."  ico={IcoLoss}/>
          <Nav id="simulador"  label="Simulador"        ico={IcoSim}/>
        </div>
        <div style={{padding:16,borderTop:`1px solid ${BD}`}}>
          <div style={{padding:12,background:BG,borderRadius:10,display:"flex",alignItems:"center",gap:10}}>
            <div style={{width:32,height:32,background:BD,borderRadius:"50%"}}/>
            <div><div style={{fontSize:12,fontWeight:700}}>Administrador</div><div style={{fontSize:10,color:MUTED}}>Painel Gestão</div></div>
          </div>
        </div>
      </div>

      {/* MAIN */}
      <div style={{flex:1,display:"flex",flexDirection:"column",overflow:"hidden"}}>
        <header style={{height:64,background:CARD,borderBottom:`1px solid ${BD}`,display:"flex",alignItems:"center",justifyContent:"space-between",padding:"0 24px",zIndex:10}}>
          <div style={{display:"flex",alignItems:"center",gap:15}}>
            <button onClick={()=>setSidebarOpen(!sidebarOpen)} style={{background:BG,border:"none",padding:8,borderRadius:8,cursor:"pointer",color:MUTED}}>{IcoArr}</button>
            <h2 style={{fontSize:18,fontWeight:700,margin:0,textTransform:"capitalize"}}>{tab}</h2>
          </div>
          <div style={{color:MUTED,cursor:"pointer"}}>{IcoBell}</div>
        </header>

        <main style={{flex:1,overflowY:"auto",padding:24}}>

          {/* DASHBOARD */}
          {tab==="dashboard"&&(
            <div style={{display:"flex",flexDirection:"column",gap:24}}>
              <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(220px,1fr))",gap:16}}>
                {[{l:"Carteira Ativa",v:fmtR(M.vAtivos),c:BLU,i:IcoFin},{l:"Total em Atraso",v:fmtR(M.vAtrasoTotal),c:YEL,i:IcoCob},{l:"Inadimplência",v:fmtP(M.taxaInad),c:M.taxaInad>15?RED:GRN,i:IcoKpi},{l:"Receita Extra",v:fmtR(M.receitaExtra),c:ORG,i:IcoNovo}].map(k=>(
                  <div key={k.l} style={{background:CARD,padding:20,borderRadius:12,border:`1px solid ${BD}`,display:"flex",alignItems:"center",gap:14}}>
                    <div style={{background:k.c+"15",color:k.c,padding:12,borderRadius:10}}>{k.i}</div>
                    <div><div style={{fontSize:11,color:MUTED,fontWeight:600,marginBottom:3}}>{k.l}</div><div style={{fontSize:20,fontWeight:800}}>{k.v}</div></div>
                  </div>
                ))}
              </div>
              <div style={{display:"grid",gridTemplateColumns:"2fr 1fr",gap:20}}>
                <div style={{background:CARD,padding:20,borderRadius:12,border:`1px solid ${BD}`,height:320}}>
                  <h3 style={{margin:"0 0 16px",fontSize:15,fontWeight:700}}>Recebimentos Mensais</h3>
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={mensal}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={BD}/>
                      <XAxis dataKey="m" axisLine={false} tickLine={false} tick={{fontSize:10,fill:MUTED}}/>
                      <YAxis axisLine={false} tickLine={false} tick={{fontSize:10,fill:MUTED}} tickFormatter={v=>`R$${v/1000}k`}/>
                      <Tooltip cursor={{fill:BG}} contentStyle={{borderRadius:8,border:"none",boxShadow:"0 10px 20px rgba(0,0,0,0.1)"}}/>
                      <Bar dataKey="v" fill={BLU} radius={[4,4,0,0]} barSize={36}/>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
                <div style={{display:"flex",flexDirection:"column",gap:16}}>

                  <div style={{background:CARD,borderRadius:12,padding:20,border:`1px solid ${BD}`}}>
                    <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",gap:12,marginBottom:14}}>
                      <div style={{display:"flex",alignItems:"center",gap:10}}><div style={{background:YEL+"15",color:YEL,padding:8,borderRadius:8}}>{IcoCal}</div><h3 style={{margin:0,fontSize:15,fontWeight:700}}>Vencem Hoje</h3></div>
                      <Badge c={parcelasHoje.length?YEL:GRN}>{parcelasHoje.length} parcela{parcelasHoje.length===1?"":"s"}</Badge>
                    </div>
                    <div style={{display:"flex",justifyContent:"space-between",alignItems:"baseline",marginBottom:12}}><span style={{fontSize:12,color:MUTED,fontWeight:700}}>Total previsto</span><strong style={{fontSize:20,color:parcelasHoje.length?YEL:GRN}}>{fmtR(totalParcelasHoje)}</strong></div>
                    {parcelasHoje.length===0?<div style={{padding:12,borderRadius:8,background:GRN+"08",color:GRN,fontSize:12,fontWeight:700}}>Nenhuma parcela vencendo hoje.</div>:<div style={{display:"flex",flexDirection:"column",gap:8,maxHeight:220,overflowY:"auto"}}>{parcelasHoje.map(p=>(
                      <div key={p.ID_PARCELA||`${p.ID_CLIENTE}-${p.NUM_PARCELA}`} style={{padding:10,borderRadius:9,background:BG,border:`1px solid ${BD}`,display:"flex",justifyContent:"space-between",gap:10,alignItems:"center"}}>
                        <div style={{minWidth:0}}><div style={{fontSize:12,fontWeight:800,whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis"}}>{p.NOME_CLIENTE}</div><div style={{fontSize:11,color:MUTED,marginTop:2}}>Parcela {p.NUM_PARCELA||p.NUMERO_PARCELA||"—"} · {fmtDt(p.DATA_VENCIMENTO)}</div></div>
                        <div style={{display:"flex",flexDirection:"column",alignItems:"flex-end",gap:6}}><div style={{fontSize:13,fontWeight:800,color:BLU}}>{fmtR(parseFloat(p.VALOR_PARCELA||0))}</div><button onClick={()=>setPagamentoHoje(p)} style={{padding:"5px 8px",borderRadius:6,border:`1px solid ${GRN}35`,background:GRN+"10",color:GRN,cursor:"pointer",fontSize:11,fontWeight:800,whiteSpace:"nowrap"}}>Registrar pagamento</button></div>
                      </div>
                    ))}</div>}
                  </div>
                  <PagamentoDrop contratos={contratos||[]} parcelas={parcelas||[]} onSucesso={carregar}/>
                  <NovoContrato contratos={contratos||[]} onSucesso={carregar}/>
                </div>
              </div>
            </div>
          )}

          {/* CLIENTES */}
          {tab==="clientes"&&(
            <div style={{background:CARD,borderRadius:12,border:`1px solid ${BD}`,overflow:"hidden"}}>
              <div style={{padding:16,borderBottom:`1px solid ${BD}`,display:"flex",justifyContent:"space-between",alignItems:"center",background:BG+"50"}}>
                <div style={{display:"flex",gap:10}}>
                  <input placeholder="Buscar..." value={filtroBusca} onChange={e=>setFiltroBusca(e.target.value)} style={{...IS,width:260}}/>
                  <select value={filtroStatus} onChange={e=>setFiltroStatus(e.target.value)} style={{...IS,width:140}}><option value="todos">Todos</option><option value="ativo">Ativos</option><option value="aguardando_conferencia">Aguardando</option></select>
                </div>
                <div style={{fontSize:13,color:MUTED}}><strong>{filtrados.length}</strong> clientes</div>
              </div>
              <table style={{width:"100%",borderCollapse:"collapse",textAlign:"left"}}>
                <thead><tr style={{background:BG,fontSize:11,color:MUTED,textTransform:"uppercase"}}><th style={{padding:"10px 18px"}}>Cliente</th><th>Status</th><th>Telefone</th><th style={{padding:"10px 18px",textAlign:"right"}}>Ações</th></tr></thead>
                <tbody>{filtrados.map(c=>(
                  <tr key={c.ID_CLIENTE} style={{borderBottom:`1px solid ${BD}`,fontSize:13}} onMouseEnter={e=>e.currentTarget.style.background=BG+"30"} onMouseLeave={e=>e.currentTarget.style.background="transparent"}>
                    <td style={{padding:"13px 18px"}}><div style={{fontWeight:700}}>{c.NOME_CLIENTE}</div><div style={{fontSize:11,color:MUTED}}>{c.ID_CLIENTE}</div></td>
                    <td><Badge c={c.STATUS_CLIENTE==="ativo"?GRN:YEL}>{(c.STATUS_CLIENTE||"").toUpperCase()}</Badge></td>
                    <td style={{color:MUTED}}>{c.TELEFONE||c.TELEFONE_WPP||"—"}</td>
                    <td style={{padding:"13px 18px",textAlign:"right"}}><button onClick={()=>setSelCli(c)} style={{padding:"5px 12px",borderRadius:6,border:`1px solid ${BD}`,background:CARD,cursor:"pointer",fontSize:12,fontWeight:600}}>Detalhes</button></td>
                  </tr>
                ))}</tbody>
              </table>
            </div>
          )}

          {/* COBRANÇA */}
          {tab==="cobranca"&&(
            <div style={{background:CARD,borderRadius:12,border:`1px solid ${BD}`,overflow:"hidden"}}>
              <div style={{padding:16,borderBottom:`1px solid ${BD}`,background:RED+"05"}}><h3 style={{margin:0,fontSize:15,fontWeight:700,color:RED}}>Fila de Cobrança</h3></div>
              <table style={{width:"100%",borderCollapse:"collapse",textAlign:"left"}}>
                <thead><tr style={{background:BG,fontSize:11,color:MUTED,textTransform:"uppercase"}}><th style={{padding:"10px 18px"}}>Cliente</th><th>Contratos</th><th>Atraso Máx</th><th>Valor</th></tr></thead>
                <tbody>{cobItems.map(c=>(
                  <tr key={c.ID_CLIENTE} style={{borderBottom:`1px solid ${BD}`,fontSize:13}}>
                    <td style={{padding:"13px 18px"}}><div style={{fontWeight:700}}>{c.NOME_CLIENTE}</div><div style={{fontSize:11,color:MUTED}}>{c.TELEFONE||c.TELEFONE_WPP}</div></td>
                    <td>{c.qtdContratos}</td>
                    <td><Badge c={c.maxAtraso>60?RED:c.maxAtraso>30?ORG:YEL}>{c.maxAtraso} dias</Badge></td>
                    <td style={{fontWeight:700,color:RED}}>{fmtR(c.vAtraso)}</td>
                  </tr>
                ))}</tbody>
              </table>
            </div>
          )}

          {/* FINANCEIRO */}
          {tab==="financeiro"&&(
            <div style={{display:"flex",flexDirection:"column",gap:20}}>

              {/* 6 cards de resumo */}
              <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:14}}>
                {[
                  {icon:"💵",label:"Receita Total",      val:fmtR(M.receitaTotal),  c:BLU},
                  {icon:"⏰",label:"Receita Extra Atraso",val:fmtR(M.receitaExtra), c:ORG},
                  {icon:"🔄",label:"Parcelas Prorrogadas",val:M.qtyProrrogadas,     c:PUR},
                  {icon:"✅",label:"Pagamentos Normais",  val:M.pagNormais,          c:GRN},
                  {icon:"⚠️",label:"Com Atraso",          val:M.pagAtraso,           c:YEL},
                  {icon:"💸",label:"Somente Juros",       val:M.pagJuros,            c:RED},
                ].map(k=>(
                  <div key={k.label} style={{background:CARD,borderRadius:12,padding:18,border:`1px solid ${BD}`}}>
                    <p style={{color:MUTED,fontSize:11,margin:"0 0 6px"}}>{k.icon} {k.label}</p>
                    <p style={{fontSize:20,fontWeight:700,color:k.c,margin:0}}>{k.val}</p>
                  </div>
                ))}
              </div>

              {/* Gráfico mensal */}
              <div style={{background:CARD,borderRadius:12,border:`1px solid ${BD}`,padding:20}}>
                <h3 style={{margin:"0 0 14px",fontSize:15,fontWeight:700}}>Receita Mensal (Total × Extra por Atraso)</h3>
                <ResponsiveContainer width="100%" height={220}>
                  <BarChart data={mensal}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={BD}/>
                    <XAxis dataKey="m" axisLine={false} tickLine={false} tick={{fontSize:10,fill:MUTED}}/>
                    <YAxis axisLine={false} tickLine={false} tick={{fontSize:10,fill:MUTED}} tickFormatter={v=>`R$${(v/1000).toFixed(0)}k`}/>
                    <Tooltip cursor={{fill:BG}} contentStyle={{borderRadius:8,border:"none",boxShadow:"0 10px 20px rgba(0,0,0,0.1)"}} formatter={(v,n)=>[fmtR(v),n==="v"?"Receita":"Extra Atraso"]}/>
                    <Bar dataKey="v"    fill={BLU} radius={[4,4,0,0]} barSize={36}/>
                    <Bar dataKey="extra" fill={ORG} radius={[4,4,0,0]} barSize={36}/>
                  </BarChart>
                </ResponsiveContainer>
              </div>

              {/* Tabela de pagamentos com filtro de datas */}
              <div style={{background:CARD,borderRadius:12,border:`1px solid ${BD}`,overflow:"hidden"}}>
                <div style={{padding:"14px 18px",borderBottom:`1px solid ${BD}`,display:"flex",alignItems:"center",justifyContent:"space-between",flexWrap:"wrap",gap:10}}>
                  <div>
                    <h3 style={{margin:0,fontSize:15,fontWeight:700}}>
                      {finDe ? "Pagamentos do Período" : "Últimos Pagamentos"}
                    </h3>
                    <p style={{margin:"3px 0 0",fontSize:11,color:MUTED}}>
                      {finDe
                        ? `${totaisFin.count} pagamento(s) — ${labelPeriodo}`
                        : `${(pagamentos||[]).length} pagamentos no total`}
                    </p>
                  </div>
                  <div style={{display:"flex",gap:8,alignItems:"center"}}>
                    {finDe&&<button onClick={()=>{setFinDe(null);setFinAte(null);}} style={{padding:"6px 12px",borderRadius:8,border:`1px solid ${BD}`,background:CARD,color:MUTED,fontSize:12,cursor:"pointer",fontWeight:600}}>✕ Limpar</button>}
                    <div style={{position:"relative"}}>
                      <button onClick={()=>setFinCalOpen(o=>!o)} style={{display:"flex",alignItems:"center",gap:6,padding:"7px 14px",borderRadius:8,border:`1.5px solid ${finDe?BLU:BD}`,background:finDe?"#EFF6FF":CARD,color:finDe?BLU:MUTED,fontSize:12,fontWeight:finDe?700:400,cursor:"pointer"}}>
                        {IcoCal} {finDe?labelPeriodo:"Filtrar por período"}
                      </button>
                      {finCalOpen&&(
                        <div style={{position:"absolute",top:"calc(100% + 8px)",right:0,zIndex:200}} onClick={e=>e.stopPropagation()}>
                          <CalendarioRange de={finDe} ate={finAte}
                            onSelecionar={(d,a)=>{setFinDe(d);setFinAte(a);}}
                            onLimpar={()=>{setFinDe(null);setFinAte(null);setFinCalOpen(false);}}/>
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                {/* Totais do período (só aparece quando filtro ativo) */}
                {finDe&&(
                  <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:0,borderBottom:`1px solid ${BD}`}}>
                    {[{l:"Total Recebido",v:fmtR(totaisFin.total),c:BLU},{l:"Receita Extra",v:fmtR(totaisFin.extra),c:ORG},{l:"Nº Pagamentos",v:totaisFin.count,c:GRN}].map((k,i)=>(
                      <div key={k.l} style={{padding:"10px 18px",background:"#F8FAFC",borderRight:i<2?`1px solid ${BD}`:"none"}}>
                        <div style={{fontSize:10,color:MUTED,fontWeight:600,textTransform:"uppercase",marginBottom:2}}>{k.l}</div>
                        <div style={{fontSize:16,fontWeight:800,color:k.c}}>{k.v}</div>
                      </div>
                    ))}
                  </div>
                )}

                <table style={{width:"100%",borderCollapse:"collapse",textAlign:"left"}}>
                  <thead>
                    <tr style={{background:BG,fontSize:11,color:MUTED,textTransform:"uppercase"}}>
                      <th style={{padding:"10px 18px"}}>Data</th>
                      <th>Cliente</th>
                      <th>Tipo</th>
                      <th>Valor Original</th>
                      <th>Valor Pago</th>
                      <th>Diferença</th>
                    </tr>
                  </thead>
                  <tbody>
                    {pagsFiltrados.length===0
                      ?<tr><td colSpan={6} style={{padding:"28px 18px",textAlign:"center",color:MUTED,fontSize:13}}>Nenhum pagamento encontrado neste período.</td></tr>
                      :pagsFiltrados.map((p,i)=>{
                        const tCor={pagamento_normal:GRN,pagamento_com_atraso:YEL,somente_juros:RED,recuperacao_apos_baixa:PUR}[p.TIPO_PAGAMENTO]||MUTED;
                        const tLabel={pagamento_normal:"Normal",pagamento_com_atraso:"Com Atraso",somente_juros:"Somente Juros",recuperacao_apos_baixa:"Recuperação"}[p.TIPO_PAGAMENTO]||p.TIPO_PAGAMENTO||"—";
                        const extra=parseFloat(p.RECEITA_EXTRA_ATRASO||0);
                        return(
                          <tr key={i} style={{borderBottom:`1px solid ${BD}`,fontSize:13,background:i%2===0?CARD:"#FAFAFA"}}>
                            <td style={{padding:"11px 18px",color:MUTED,whiteSpace:"nowrap"}}>{fmtDt(parseDate(p.DATA_PAGAMENTO))}</td>
                            <td style={{fontWeight:600}}>{p.NOME_CLIENTE}</td>
                            <td><Badge c={tCor}>{tLabel}</Badge></td>
                            <td style={{color:MUTED}}>{fmtR(p.VALOR_ORIGINAL_PARCELA||p.VALOR_PARCELA)}</td>
                            <td style={{fontWeight:700,color:BLU}}>{fmtR(p.VALOR_PAGO)}</td>
                            <td style={{color:extra>0?ORG:MUTED,fontWeight:extra>0?700:400}}>{extra>0?`+${fmtR(extra)}`:"—"}</td>
                          </tr>
                        );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* PERDAS */}
          {tab==="perdas"&&(
            <div style={{display:"flex",flexDirection:"column",gap:20}}>
              <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:16}}>
                {[{l:"Capital em Prejuízo",v:fmtR(perdas.capitalBaixado),c:RED},{l:"Recuperado",v:fmtR(perdas.recuperadoAposBaixa),c:PUR},{l:"Prejuízo Real",v:fmtR(perdas.prejuizoTotal),c:RED},{l:"Taxa Recuperação",v:fmtP(perdas.txRecuperacao),c:GRN}].map(k=>(
                  <div key={k.l} style={{background:CARD,padding:18,borderRadius:12,border:`1px solid ${BD}`}}><div style={{fontSize:10,color:MUTED,fontWeight:600,textTransform:"uppercase",marginBottom:4}}>{k.l}</div><div style={{fontSize:20,fontWeight:800,color:k.c}}>{k.v}</div></div>
                ))}
              </div>
              <div style={{background:CARD,borderRadius:12,border:`1px solid ${BD}`,overflow:"hidden"}}>
                <div style={{padding:16,borderBottom:`1px solid ${BD}`,display:"flex",justifyContent:"space-between",alignItems:"center",background:BG+"50"}}>
                  <h3 style={{margin:0,fontSize:15,fontWeight:700}}>Contratos com Perda</h3>
                  <select value={filtroPerdas} onChange={e=>setFiltroPerdas(e.target.value)} style={{...IS,width:200}}><option value="todos">Todos</option><option value="em_cobranca">Em Cobrança</option><option value="pre_prejuizo">Pré-Prejuízo</option><option value="baixado_como_prejuizo">Baixado</option><option value="em_recuperacao">Em Recuperação</option></select>
                </div>
                <table style={{width:"100%",borderCollapse:"collapse",textAlign:"left"}}>
                  <thead><tr style={{background:BG,fontSize:11,color:MUTED,textTransform:"uppercase"}}><th style={{padding:"10px 18px"}}>Contrato</th><th>Status</th><th>Capital</th><th>Prejuízo</th><th>Recuperado</th><th style={{padding:"10px 18px",textAlign:"right"}}>Ações</th></tr></thead>
                  <tbody>{pFiltradas.map(c=>(
                    <tr key={c.ID_CONTRATO} style={{borderBottom:`1px solid ${BD}`,fontSize:13}}>
                      <td style={{padding:"13px 18px"}}><div style={{fontWeight:700}}>{c.ID_CONTRATO}</div><div style={{fontSize:11,color:MUTED}}>{c.NOME_CLIENTE}</div></td>
                      <td><Badge c={STATUS_COR[c.STATUS_CONTRATO]||MUTED}>{STATUS_LABEL[c.STATUS_CONTRATO]||c.STATUS_CONTRATO}</Badge></td>
                      <td>{fmtR(c.VALOR_PRINCIPAL)}</td>
                      <td style={{color:RED,fontWeight:600}}>{fmtR(c.PREJUIZO_CAPITAL)}</td>
                      <td style={{color:PUR,fontWeight:600}}>{fmtR(c.VALOR_RECUPERADO_APOS_BAIXA)}</td>
                      <td style={{padding:"13px 18px",textAlign:"right"}}>
                        <div style={{display:"flex",gap:6,justifyContent:"flex-end"}}>
                          {c.STATUS_CONTRATO!=="baixado_como_prejuizo"&&<button onClick={()=>setBaixaModal(c)} style={{padding:"5px 10px",borderRadius:6,border:`1px solid ${RED}30`,background:RED+"08",color:RED,cursor:"pointer",fontSize:11,fontWeight:700}}>Baixar</button>}
                          <button onClick={()=>setAcordoModal(c)} style={{padding:"5px 10px",borderRadius:6,border:`1px solid ${ORG}30`,background:ORG+"08",color:ORG,cursor:"pointer",fontSize:11,fontWeight:700}}>🤝 Acordo</button>
                          <button onClick={()=>setRecuperacaoModal(c)} style={{padding:"5px 10px",borderRadius:6,border:`1px solid ${PUR}30`,background:PUR+"08",color:PUR,cursor:"pointer",fontSize:11,fontWeight:700}}>Recuperar</button>
                        </div>
                      </td>
                    </tr>
                  ))}</tbody>
                </table>
              </div>
            </div>
          )}

          {/* SIMULADOR */}
          {tab==="simulador"&&(
            <div style={{maxWidth:800,margin:"0 auto"}}>
              <div style={{background:CARD,borderRadius:16,border:`1px solid ${BD}`,padding:32}}>
                <h2 style={{fontSize:22,fontWeight:800,margin:"0 0 8px"}}>Simulador de Expansão</h2>
                <p style={{color:MUTED,margin:"0 0 28px"}}>Projete o crescimento da carteira e analise o risco</p>
                <div style={{display:"flex",flexDirection:"column",gap:24}}>
                  {[{l:"Novo Aporte (R$)",v:simVal,s:setSimVal,m:1000,max:100000,step:500,fmt:v=>fmtR(v)},{l:"Inadimplência Esperada (%)",v:simInad,s:setSimInad,m:0,max:50,step:1,fmt:v=>v+"%"},{l:"Volume de Novos Contratos",v:simVol,s:setSimVol,m:0,max:50,step:1,fmt:v=>v}].map(inp=>(
                    <div key={inp.l}>
                      <div style={{display:"flex",justifyContent:"space-between",marginBottom:10}}><span style={{...LS,marginBottom:0}}>{inp.l}</span><strong style={{color:BLU,fontSize:14}}>{inp.fmt(inp.v)}</strong></div>
                      <input type="range" min={inp.m} max={inp.max} step={inp.step} value={inp.v} onChange={e=>inp.s(Number(e.target.value))} style={{width:"100%",height:6,borderRadius:3,background:BD,appearance:"none",cursor:"pointer"}}/>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

        </main>
      </div>

      {selCli&&<ClienteModal cliente={selCli} onFechar={()=>setSelCli(null)}/>}
      {pagamentoHoje&&<PagamentoParcelaModal parcela={pagamentoHoje} onConfirmar={()=>{setPagamentoHoje(null);carregar();}} onFechar={()=>setPagamentoHoje(null)}/>}
      {baixaModal&&<BaixaModal contrato={baixaModal} parcelas={parcelas||[]} onConfirmar={()=>{setBaixaModal(null);carregar();}} onFechar={()=>setBaixaModal(null)}/>}
      {acordoModal&&<ModalAcordoPerda contrato={acordoModal} parcelas={parcelas||[]} onConfirmar={()=>{setAcordoModal(null);carregar();}} onFechar={()=>setAcordoModal(null)}/>}
      {recuperacaoModal&&<RecuperacaoModal contrato={recuperacaoModal} onConfirmar={()=>{setRecuperacaoModal(null);carregar();}} onFechar={()=>setRecuperacaoModal(null)}/>}
    </div>
  );
}

createRoot(document.getElementById("root")).render(<App/>);
