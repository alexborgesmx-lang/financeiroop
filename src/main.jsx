import React, { useState, useMemo, useEffect, useRef } from "react";
import { createRoot } from "react-dom/client";
import { LineChart, Line, AreaChart, Area, BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, CartesianGrid } from "recharts";

const API_URL  = "/api/sheets";
const POST_URL = "/api/action";

// ── DESIGN SYSTEM ─────────────────────────────────────────────────
const BG    = "#F5F6FA";
const CARD  = "#FFFFFF";
const BD    = "#E5E7EB";
const TEXT  = "#111827";
const MUTED = "#6B7280";
const GRN   = "#10B981";
const RED   = "#EF4444";
const BLU   = "#3B82F6";
const YEL   = "#F59E0B";
const PUR   = "#8B5CF6";
const ORG   = "#F97316";
const SW    = 220;

const fmtR  = v => "R$ " + Number(v||0).toLocaleString("pt-BR",{minimumFractionDigits:2,maximumFractionDigits:2});
const fmtP  = v => Number(v||0).toFixed(1) + "%";
const fmtDt = v => { if(!v)return"—"; const d=v instanceof Date?v:new Date(v); return isNaN(d.getTime())?"—":d.toLocaleDateString("pt-BR"); };
const hojeStr = () => new Date().toISOString().split("T")[0];
const limparData = v => { if(!v)return""; const s=String(v).trim(); return s.includes("T")?s.split("T")[0]:s; };
function parseDate(v){ if(!v)return null; if(v instanceof Date)return v; const d=new Date(v); return isNaN(d)?null:d; }
async function postAction(body){ const r=await fetch(POST_URL,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(body)}); return r.json(); }

// ── VALIDAÇÕES ────────────────────────────────────────────────────
function vLetras(v){ return v&&/[^a-zA-ZÀ-ÿ\s]/.test(v)?"⚠ Somente letras":null; }
function vNums(v){   return v&&/[^\d]/.test(v)?"⚠ Somente números":null; }
function vEmail(v){
  if(!v)return null;
  if(/[A-Z]/.test(v))return"⚠ Use letras minúsculas";
  if(!/^[^@]+@[^@]+\.[^@]+$/.test(v))return"⚠ Formato inválido";
  return null;
}
function vNumEnd(v){
  if(!v)return null;
  const l=v.toLowerCase().trim();
  if(l==="sem numero"||l==="sem número"||l==="s/n"||l==="sn")return null;
  return/[^\d]/.test(v)?"⚠ Somente números (ou Sem Número)":null;
}

// ── ESTILOS ───────────────────────────────────────────────────────
const IS = {width:"100%",padding:"9px 12px",background:CARD,border:`1px solid ${BD}`,borderRadius:7,color:TEXT,fontSize:13,boxSizing:"border-box"};
const IW = {...IS,border:`1px solid ${YEL}`,background:"#FFFBEB"};
const LS = {color:MUTED,fontSize:11,fontWeight:600,textTransform:"uppercase",letterSpacing:"0.05em",display:"block",marginBottom:4};
const WS = {color:YEL,fontSize:11,fontWeight:500,display:"block",marginTop:3};
const SEC= {fontSize:11,fontWeight:700,color:BLU,textTransform:"uppercase",letterSpacing:"0.08em",margin:"16px 0 8px",borderBottom:`1px solid ${BD}`,paddingBottom:4};

// ── ÍCONES ────────────────────────────────────────────────────────
const Ico = {
  dash:  <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/></svg>,
  cli:   <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="9" cy="7" r="4"/><path d="M3 21v-2a4 4 0 0 1 4-4h4a4 4 0 0 1 4 4v2"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/><path d="M21 21v-2a4 4 0 0 0-3-3.87"/></svg>,
  ctr:   <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14,2 14,8 20,8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg>,
  pag:   <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="2" y="5" width="20" height="14" rx="2"/><line x1="2" y1="10" x2="22" y2="10"/></svg>,
  cob:   <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07A19.5 19.5 0 0 1 4.19 12 19.79 19.79 0 0 1 1.12 3.18 2 2 0 0 1 3.11 1h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"/></svg>,
  kpi:   <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/></svg>,
  rel:   <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="22,12 18,12 15,21 9,3 6,12 2,12"/></svg>,
  sim:   <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>,
  novo:  <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="16"/><line x1="8" y1="12" x2="16" y2="12"/></svg>,
  fin:   <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>,
  bell:  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/></svg>,
  srch:  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke={MUTED} strokeWidth="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>,
  help:  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>,
  arr:   <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="9,18 15,12 9,6"/></svg>,
  ref:   <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="23,4 23,10 17,10"/><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"/></svg>,
};

// ── REVISÃO DE CLIENTE ────────────────────────────────────────────
function RevisaoCliente({cliente,onAtivar,onFechar}){
  const f={
    nome:useRef(null),cpf:useRef(null),rg:useRef(null),nac:useRef(null),ecivil:useRef(null),
    prof:useRef(null),wpp:useRef(null),email:useRef(null),cep:useRef(null),rua:useRef(null),
    numero:useRef(null),quadra:useRef(null),lote:useRef(null),setor:useRef(null),comp:useRef(null),
    cidade:useRef(null),cont1:useRef(null),tel1:useRef(null),cont2:useRef(null),tel2:useRef(null),
    diavenc:useRef(null),padrinho:useRef(null),telpad:useRef(null),obs:useRef(null),
  };
  const cliMap={nome:"NOME",cpf:"CPF",rg:"RG",nac:"NACIONALIDADE",ecivil:"ESTADO_CIVIL",
    prof:"PROFISSAO",wpp:"TELEFONE_WPP",email:"EMAIL",cep:"CEP",rua:"RUA",numero:"NUMERO",
    quadra:"QUADRA",lote:"LOTE",setor:"SETOR",comp:"COMPLEMENTO",cidade:"CIDADE_ESTADO",
    cont1:"CONTATO_CONFIANCA_1",tel1:"TEL_CONFIANCA_1",cont2:"CONTATO_CONFIANCA_2",
    tel2:"TEL_CONFIANCA_2",diavenc:"DIA_VENCIMENTO_PREFERIDO",padrinho:"PADRINHO",
    telpad:"TEL_PADRINHO",obs:"OBSERVACOES"};
  const [al,setAl]=useState({});
  const [salvando,setSalvando]=useState(false);
  const [msg,setMsg]=useState(null);

  function blur(campo,fn){ const v=f[campo].current?.value||""; const e=fn?fn(v):null; setAl(p=>p[campo]===e?p:{...p,[campo]:e}); }
  const totalAl=Object.values(al).filter(Boolean).length;

  async function salvarEAtivar(){
    setSalvando(true);setMsg(null);
    const fns={nome:vLetras,cpf:vNums,rg:vNums,prof:vLetras,wpp:vNums,email:vEmail,cep:vNums,numero:vNumEnd,cont1:vLetras,tel1:vNums,cont2:vLetras,tel2:vNums,padrinho:vLetras,telpad:vNums};
    const novosAl={};Object.keys(fns).forEach(k=>{novosAl[k]=fns[k](f[k].current?.value||"");});setAl(novosAl);
    if(Object.values(novosAl).some(Boolean)){setMsg({ok:false,texto:"Corrija os campos destacados."});setSalvando(false);return;}
    try{
      const campos={};Object.keys(cliMap).forEach(k=>{campos[cliMap[k]]=f[k].current?.value||"";});campos.STATUS_CLIENTE="ativo";
      const res=await postAction({action:"atualizarCliente",idCliente:cliente.ID_CLIENTE,campos});
      if(res.ok){setMsg({ok:true,texto:"Cliente atualizado e ativado!"});setTimeout(onAtivar,1200);}
      else setMsg({ok:false,texto:res.erro||"Erro ao salvar."});
    }catch(e){setMsg({ok:false,texto:e.message});}
    setSalvando(false);
  }

  function Inp({label,rk,fn,type,ph}){const e=al[rk];const dv=rk==="diavenc"?limparData(cliente[cliMap[rk]]):String(cliente[cliMap[rk]]||"");return(<div><span style={LS}>{label}</span><input ref={f[rk]} type={type||"text"} defaultValue={dv} onBlur={fn?()=>blur(rk,fn):undefined} placeholder={ph||""} style={e?IW:IS}/>{e&&<span style={WS}>{e}</span>}</div>);}
  function InpP({label,rk,type,ph}){const dv=rk==="diavenc"?limparData(cliente[cliMap[rk]]):String(cliente[cliMap[rk]]||"");return(<div><span style={LS}>{label}</span><input ref={f[rk]} type={type||"text"} defaultValue={dv} placeholder={ph||""} style={IS}/></div>);}

  return(
    <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.4)",zIndex:300,display:"flex",alignItems:"flex-start",justifyContent:"center",padding:20,overflow:"hidden"}}>
      <div style={{background:CARD,borderRadius:12,width:"100%",maxWidth:660,display:"flex",flexDirection:"column",maxHeight:"calc(100vh - 40px)",boxShadow:"0 20px 60px rgba(0,0,0,0.15)"}}>
        <div style={{padding:"20px 24px 12px",borderBottom:`1px solid ${BD}`,flexShrink:0}}>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start"}}>
            <div><h2 style={{color:TEXT,fontSize:17,fontWeight:700,margin:0}}>Revisão de Cadastro</h2><p style={{color:MUTED,fontSize:12,margin:"3px 0 0"}}>ID {cliente.ID_CLIENTE} — confira e corrija antes de ativar</p></div>
            <button onClick={onFechar} style={{background:"none",border:"none",color:MUTED,fontSize:20,cursor:"pointer",padding:"2px 6px",borderRadius:4}}>✕</button>
          </div>
          {totalAl>0&&<div style={{background:"#FFFBEB",border:`1px solid ${YEL}`,borderRadius:7,padding:"8px 12px",marginTop:10}}><p style={{color:"#92400E",fontWeight:600,fontSize:12,margin:0}}>⚠️ {totalAl} campo(s) precisam de correção</p></div>}
        </div>
        <div style={{overflowY:"auto",padding:"0 24px",flex:1}}>
          <div style={SEC}>Dados Pessoais</div>
          <div style={{display:"grid",gap:10}}>
            <Inp label="Nome completo (somente letras)" rk="nome" fn={vLetras}/>
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10}}><Inp label="CPF (somente números)" rk="cpf" fn={vNums}/><Inp label="RG (somente números)" rk="rg" fn={vNums}/></div>
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10}}><InpP label="Nacionalidade" rk="nac" ph="Ex: Brasileiro"/><InpP label="Estado civil" rk="ecivil" ph="Ex: Solteiro"/></div>
            <Inp label="Profissão (somente letras)" rk="prof" fn={vLetras}/>
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10}}><Inp label="WhatsApp (somente números)" rk="wpp" fn={vNums}/><Inp label="E-mail (letras minúsculas)" rk="email" fn={vEmail} type="email"/></div>
          </div>
          <div style={SEC}>Endereço</div>
          <div style={{display:"grid",gap:10}}>
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:10}}><Inp label="CEP (somente números)" rk="cep" fn={vNums}/><Inp label="Número (ou Sem Número)" rk="numero" fn={vNumEnd}/><InpP label="Complemento" rk="comp"/></div>
            <InpP label="Rua / Avenida" rk="rua"/>
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:10}}><InpP label="Quadra" rk="quadra"/><InpP label="Lote" rk="lote"/><InpP label="Setor / Bairro" rk="setor"/></div>
            <InpP label="Cidade - Estado" rk="cidade"/>
          </div>
          <div style={SEC}>Contatos de Confiança</div>
          <div style={{display:"grid",gap:10}}>
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10}}><Inp label="Contato 1 — Nome" rk="cont1" fn={vLetras}/><Inp label="Contato 1 — Telefone" rk="tel1" fn={vNums}/></div>
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10}}><Inp label="Contato 2 — Nome" rk="cont2" fn={vLetras}/><Inp label="Contato 2 — Telefone" rk="tel2" fn={vNums}/></div>
          </div>
          <div style={SEC}>Padrinho e Vencimento</div>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:10}}><Inp label="Padrinho — Nome" rk="padrinho" fn={vLetras}/><Inp label="Padrinho — Telefone" rk="telpad" fn={vNums}/><InpP label="Data da 1ª parcela" rk="diavenc" type="date"/></div>
          <div style={SEC}>Observações</div>
          <textarea ref={f.obs} defaultValue={String(cliente.OBSERVACOES||"")} rows={2} style={{...IS,resize:"vertical"}}/>
          <div style={{height:8}}/>
        </div>
        <div style={{padding:"12px 24px 20px",borderTop:`1px solid ${BD}`,flexShrink:0}}>
          {msg&&<div style={{padding:"10px 14px",borderRadius:7,background:msg.ok?"#ECFDF5":"#FEF2F2",border:`1px solid ${msg.ok?GRN:RED}`,color:msg.ok?"#065F46":"#991B1B",fontSize:13,fontWeight:600,marginBottom:10}}>{msg.ok?"✅ ":"❌ "}{msg.texto}</div>}
          <div style={{display:"grid",gridTemplateColumns:"1fr 2fr",gap:10}}>
            <button onClick={onFechar} style={{padding:"10px",borderRadius:7,border:`1px solid ${BD}`,background:CARD,color:MUTED,fontWeight:600,fontSize:13,cursor:"pointer"}}>Cancelar</button>
            <button onClick={salvarEAtivar} disabled={salvando} style={{padding:"10px",borderRadius:7,border:"none",background:salvando?"#D1FAE5":GRN,color:"#fff",fontWeight:700,fontSize:13,cursor:salvando?"not-allowed":"pointer",opacity:salvando?0.8:1}}>{salvando?"Salvando...":"✅ Salvar e Ativar Cliente"}</button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── REGISTRAR PAGAMENTO ───────────────────────────────────────────
function RegistrarPagamento({clientes,parcelas,onSucesso}){
  const [busca,setBusca]=useState("");const [showDrop,setShowDrop]=useState(false);const [cliente,setCliente]=useState(null);const [parcela,setParcela]=useState(null);const [tipo,setTipo]=useState(null);const [data,setData]=useState(hojeStr());const [valor,setValor]=useState("");const [loading,setLoading]=useState(false);const [msg,setMsg]=useState(null);const ref=useRef();
  useEffect(()=>{const fn=e=>{if(ref.current&&!ref.current.contains(e.target))setShowDrop(false);};document.addEventListener("mousedown",fn);return()=>document.removeEventListener("mousedown",fn);},[]);
  const sugeridos=useMemo(()=>!busca?[]:clientes.filter(c=>c.NOME.toLowerCase().includes(busca.toLowerCase())).slice(0,8),[busca,clientes]);
  const parcelasAbertas=useMemo(()=>!cliente?[]:parcelas.filter(p=>String(p.ID_CLIENTE)===String(cliente.ID_CLIENTE)&&p.STATUS!=="pago").sort((a,b)=>new Date(a.DATA_VENCIMENTO)-new Date(b.DATA_VENCIMENTO)),[cliente,parcelas]);
  const selCli=c=>{setCliente(c);setBusca(c.NOME);setShowDrop(false);setParcela(null);setTipo(null);setMsg(null);};
  const confirmar=async()=>{
    if(!parcela||!data)return;setLoading(true);setMsg(null);
    try{
      let res;
      if(tipo==="total")res=await postAction({action:"pagamento",idParcela:parcela.ID_PARCELA,data,valor:valor?parseFloat(valor):null,origem:"painel"});
      else res=await postAction({action:"pagamentoParcial",idParcela:parcela.ID_PARCELA,data});
      if(res.ok||res.msg){setMsg({ok:true,texto:tipo==="total"?"Pagamento registrado!":(res.msg||"Registrado!")});setParcela(null);setTipo(null);setValor("");if(onSucesso)onSucesso();}
      else setMsg({ok:false,texto:res.erro||"Erro."});
    }catch(e){setMsg({ok:false,texto:e.message});}
    setLoading(false);
  };
  const stC=st=>st==="atrasado"?RED:st==="vencendo"?YEL:MUTED;
  const valorOriginal=parseFloat(parcela?.VALOR_PARCELA||0);
  const valorPago=valor?parseFloat(valor):valorOriginal;
  const diferenca=Math.max(0,valorPago-valorOriginal);
  return(
    <div>
      <div style={{marginBottom:24}}><h1 style={{fontSize:22,fontWeight:700,color:TEXT,margin:0}}>Registrar Pagamento</h1><p style={{color:MUTED,fontSize:13,margin:"4px 0 0"}}>Selecione o cliente e a parcela para registrar</p></div>
      <div style={{maxWidth:600,display:"grid",gap:14}}>
        <div style={{background:CARD,borderRadius:10,border:`1px solid ${BD}`,padding:20,boxShadow:"0 1px 4px rgba(0,0,0,0.05)"}}>
          <p style={{...LS,marginBottom:8}}>Cliente</p>
          <div ref={ref} style={{position:"relative"}}>
            <input value={busca} onChange={e=>{setBusca(e.target.value);setShowDrop(true);setCliente(null);setParcela(null);setTipo(null);}} onFocus={()=>setShowDrop(true)} placeholder="Digite o nome do cliente..." style={{...IS,paddingLeft:36}}/>
            <span style={{position:"absolute",left:12,top:"50%",transform:"translateY(-50%)"}}>{Ico.srch}</span>
            {showDrop&&sugeridos.length>0&&(
              <div style={{position:"absolute",top:"100%",left:0,right:0,background:CARD,border:`1px solid ${BD}`,borderRadius:8,zIndex:20,maxHeight:220,overflowY:"auto",marginTop:4,boxShadow:"0 8px 24px rgba(0,0,0,0.1)"}}>
                {sugeridos.map(c=><div key={c.ID_CLIENTE} onClick={()=>selCli(c)} style={{padding:"11px 14px",cursor:"pointer",fontSize:13,borderBottom:`1px solid ${BD}`,color:TEXT}} onMouseEnter={e=>e.currentTarget.style.background=BG} onMouseLeave={e=>e.currentTarget.style.background=CARD}>{c.NOME}</div>)}
              </div>
            )}
          </div>
        </div>
        {cliente&&(
          <div style={{background:CARD,borderRadius:10,border:`1px solid ${BD}`,padding:20,boxShadow:"0 1px 4px rgba(0,0,0,0.05)"}}>
            <p style={{...LS,marginBottom:10}}>Parcelas em aberto — {cliente.NOME}</p>
            {parcelasAbertas.length===0?<p style={{color:MUTED,fontSize:13}}>Nenhuma parcela em aberto.</p>
              :parcelasAbertas.map(p=>(
                <div key={p.ID_PARCELA} onClick={()=>{setParcela(p);setTipo(null);setMsg(null);}}
                  style={{padding:"12px 14px",marginBottom:6,borderRadius:8,cursor:"pointer",border:`1.5px solid ${parcela?.ID_PARCELA===p.ID_PARCELA?BLU:BD}`,background:parcela?.ID_PARCELA===p.ID_PARCELA?"#EFF6FF":CARD,borderLeft:`4px solid ${stC(p.STATUS)}`}}>
                  <div style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}>
                    <div>
                      <strong style={{fontSize:13,color:TEXT}}>Parcela {p.NUM_PARCELA}/{p.TOTAL_PARCELAS}</strong>
                      {p.ORIGEM_PARCELA==="gerada_por_pagamento_de_juros"&&<span style={{marginLeft:8,fontSize:10,background:"#FEF3C7",color:"#92400E",padding:"2px 6px",borderRadius:10,fontWeight:600}}>Prorrogada</span>}
                      <span style={{color:MUTED,fontSize:12,marginLeft:10}}>Venc: {fmtDt(parseDate(p.DATA_VENCIMENTO))}</span>
                    </div>
                    <strong style={{color:BLU}}>{fmtR(p.VALOR_PARCELA)}</strong>
                  </div>
                  <span style={{color:stC(p.STATUS),fontSize:11,fontWeight:600}}>{p.STATUS==="atrasado"?"ATRASADA":p.STATUS==="vencendo"?"VENCE EM BREVE":"PENDENTE"}</span>
                </div>
              ))}
          </div>
        )}
        {parcela&&(
          <div style={{background:CARD,borderRadius:10,border:`1px solid ${BD}`,padding:20,boxShadow:"0 1px 4px rgba(0,0,0,0.05)"}}>
            <p style={{...LS,marginBottom:12}}>Tipo de Pagamento</p>
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10,marginBottom:14}}>
              <button onClick={()=>setTipo("total")} style={{padding:"14px 10px",borderRadius:8,border:`2px solid ${tipo==="total"?GRN:BD}`,background:tipo==="total"?"#ECFDF5":CARD,color:tipo==="total"?GRN:MUTED,fontWeight:700,fontSize:13,cursor:"pointer",textAlign:"center"}}>Pagamento Total<br/><span style={{fontSize:12,fontWeight:400}}>{fmtR(parcela.VALOR_PARCELA)}</span></button>
              <button onClick={()=>setTipo("parcial")} style={{padding:"14px 10px",borderRadius:8,border:`2px solid ${tipo==="parcial"?YEL:BD}`,background:tipo==="parcial"?"#FFFBEB":CARD,color:tipo==="parcial"?YEL:MUTED,fontWeight:700,fontSize:13,cursor:"pointer",textAlign:"center"}}>Somente Juros<br/><span style={{fontSize:12,fontWeight:400}}>{fmtR(parseFloat(parcela.VALOR_JUROS)||0)}</span></button>
            </div>
            {tipo&&<div style={{display:"grid",gap:10}}>
              <div><p style={LS}>Data do Pagamento</p><input type="date" value={data} onChange={e=>setData(e.target.value)} style={IS}/></div>
              {tipo==="total"&&(
                <div>
                  <p style={LS}>Valor Pago (opcional)</p>
                  <input type="number" step="0.01" value={valor} onChange={e=>setValor(e.target.value)} placeholder={`${fmtR(parcela.VALOR_PARCELA)}`} style={IS}/>
                  {diferenca>0&&(
                    <div style={{marginTop:8,padding:"8px 12px",background:"#FFF7ED",border:`1px solid ${ORG}`,borderRadius:6,fontSize:12}}>
                      <span style={{color:ORG,fontWeight:600}}>💡 Diferença detectada: {fmtR(diferenca)}</span>
                      <span style={{color:MUTED,marginLeft:6}}>será registrada como receita extra (juros/multa de atraso)</span>
                    </div>
                  )}
                </div>
              )}
              {tipo==="parcial"&&<div style={{padding:"10px 12px",background:"#FFFBEB",border:`1px solid ${YEL}`,borderRadius:6,fontSize:12,color:"#92400E"}}>O valor integral ({fmtR(parcela.VALOR_PARCELA)}) será criado como nova parcela no final do contrato. Apenas os juros ({fmtR(parseFloat(parcela.VALOR_JUROS)||0)}) serão registrados agora.</div>}
              <button onClick={confirmar} disabled={loading} style={{padding:"12px",borderRadius:8,border:"none",background:tipo==="total"?GRN:YEL,color:"#fff",fontWeight:700,fontSize:13,cursor:"pointer",opacity:loading?0.7:1}}>{loading?"Registrando...":`Confirmar ${tipo==="total"?"Pagamento Total":"Pagamento de Juros"}`}</button>
            </div>}
          </div>
        )}
        {msg&&<div style={{padding:"12px 16px",borderRadius:8,background:msg.ok?"#ECFDF5":"#FEF2F2",border:`1px solid ${msg.ok?GRN:RED}`,color:msg.ok?"#065F46":"#991B1B",fontSize:13,fontWeight:600}}>{msg.ok?"✅ ":"❌ "}{msg.texto}</div>}
      </div>
    </div>
  );
}

// ── NOVO CONTRATO ─────────────────────────────────────────────────
function NovoContrato({clientes,contratos,onSucesso}){
  const [busca,setBusca]=useState("");const [showDrop,setShowDrop]=useState(false);const [cliente,setCliente]=useState(null);const [principal,setPrincipal]=useState("");const [parcelas,setParcelas]=useState("");const [taxa,setTaxa]=useState("");const [dtEmp,setDtEmp]=useState(hojeStr());const [dtVenc,setDtVenc]=useState("");const [loading,setLoading]=useState(false);const [msg,setMsg]=useState(null);const ref=useRef();
  useEffect(()=>{const fn=e=>{if(ref.current&&!ref.current.contains(e.target))setShowDrop(false);};document.addEventListener("mousedown",fn);return()=>document.removeEventListener("mousedown",fn);},[]);
  const proximoId=useMemo(()=>{let max=0;contratos.forEach(c=>{const m=String(c.ID_CONTRATO).match(/(\d+)/);if(m){const n=parseInt(m[1]);if(n>max)max=n;}});return"PCL-Nº "+(max+1);},[contratos]);
  const sugeridos=useMemo(()=>!busca?[]:clientes.filter(c=>String(c.STATUS_CLIENTE||"").trim().toLowerCase()==="ativo"&&c.NOME.toLowerCase().includes(busca.toLowerCase())).slice(0,8).map(c=>{const temAtivo=contratos.some(ct=>String(ct.ID_CLIENTE).trim()===String(c.ID_CLIENTE).trim()&&["ativo","inadimplente"].includes(String(ct.STATUS_CONTRATO||"").trim().toLowerCase()));return{...c,temAtivo};}),[busca,clientes,contratos]);
  const clienteTemAtivo=useMemo(()=>!cliente?false:contratos.some(ct=>String(ct.ID_CLIENTE).trim()===String(cliente.ID_CLIENTE).trim()&&["ativo","inadimplente"].includes(String(ct.STATUS_CONTRATO||"").trim().toLowerCase())),[cliente,contratos]);
  const sim=useMemo(()=>{const p=parseFloat(principal)||0,n=parseInt(parcelas)||0,t=parseFloat(taxa)||0;if(!p||!n||!t)return null;const jt=p*t/100*n,tot=p+jt,parc=tot/n;return{jt,tot,parc,pp:p/n,jp:jt/n};},[principal,parcelas,taxa]);
  useEffect(()=>{if(cliente?.DIA_VENCIMENTO_PREFERIDO)setDtVenc(limparData(cliente.DIA_VENCIMENTO_PREFERIDO));},[cliente]);
  const selCli=c=>{setCliente(c);setBusca(c.NOME);setShowDrop(false);setMsg(null);};
  const confirmar=async()=>{
    if(!cliente||!principal||!parcelas||!taxa||!dtEmp||!dtVenc){setMsg({ok:false,texto:"Preencha todos os campos."});return;}
    if(clienteTemAtivo){setMsg({ok:false,texto:"Cliente com contrato ativo."});return;}
    setLoading(true);setMsg(null);
    try{
      const res=await postAction({action:"novoContrato",dados:{id:proximoId,idCliente:cliente.ID_CLIENTE,nomeCliente:cliente.NOME,principal:parseFloat(principal),parcelas:parseInt(parcelas),taxa:parseFloat(taxa),dataEmprestimo:dtEmp,dataVencimento:dtVenc}});
      if(res.ok){setMsg({ok:true,texto:`Contrato ${proximoId} criado!`});setCliente(null);setBusca("");setPrincipal("");setParcelas("");setTaxa("");setDtVenc("");if(onSucesso)onSucesso();}
      else setMsg({ok:false,texto:res.erro||"Erro."});
    }catch(e){setMsg({ok:false,texto:e.message});}
    setLoading(false);
  };
  return(
    <div>
      <div style={{marginBottom:24}}><h1 style={{fontSize:22,fontWeight:700,color:TEXT,margin:0}}>Novo Contrato</h1><p style={{color:MUTED,fontSize:13,margin:"4px 0 0"}}>Preencha os dados para criar um novo contrato de crédito</p></div>
      <div style={{maxWidth:620,display:"grid",gap:14}}>
        <div style={{background:CARD,borderRadius:10,border:`1px solid ${BD}`,padding:20,boxShadow:"0 1px 4px rgba(0,0,0,0.05)"}}>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:14}}><p style={{...LS,margin:0}}>ID do Contrato</p><span style={{fontSize:15,fontWeight:700,color:BLU}}>{proximoId}</span></div>
          <p style={{...LS,marginBottom:8}}>Cliente</p>
          <div ref={ref} style={{position:"relative"}}>
            <input value={busca} onChange={e=>{setBusca(e.target.value);setShowDrop(true);setCliente(null);}} onFocus={()=>setShowDrop(true)} placeholder="Buscar cliente ativo..." style={{...IS,paddingLeft:36}}/>
            <span style={{position:"absolute",left:12,top:"50%",transform:"translateY(-50%)"}}>{Ico.srch}</span>
            {showDrop&&sugeridos.length>0&&(
              <div style={{position:"absolute",top:"100%",left:0,right:0,background:CARD,border:`1px solid ${BD}`,borderRadius:8,zIndex:20,maxHeight:200,overflowY:"auto",marginTop:4,boxShadow:"0 8px 24px rgba(0,0,0,0.1)"}}>
                {sugeridos.map(c=><div key={c.ID_CLIENTE} onClick={()=>{if(!c.temAtivo)selCli(c);}} style={{padding:"11px 14px",cursor:c.temAtivo?"not-allowed":"pointer",fontSize:13,borderBottom:`1px solid ${BD}`,color:c.temAtivo?MUTED:TEXT,background:c.temAtivo?"#FEF2F2":CARD,display:"flex",justifyContent:"space-between"}} onMouseEnter={e=>{if(!c.temAtivo)e.currentTarget.style.background=BG;}} onMouseLeave={e=>{e.currentTarget.style.background=c.temAtivo?"#FEF2F2":CARD;}}><span>{c.NOME}</span>{c.temAtivo&&<span style={{fontSize:11,color:RED,fontWeight:600}}>Contrato ativo</span>}</div>)}
              </div>
            )}
          </div>
          {cliente&&!clienteTemAtivo&&<div style={{marginTop:8,padding:"8px 12px",background:"#ECFDF5",border:`1px solid ${GRN}`,borderRadius:6,fontSize:12,color:"#065F46"}}>✅ {cliente.NOME} selecionado</div>}
          {cliente&&clienteTemAtivo&&<div style={{marginTop:8,padding:"8px 12px",background:"#FEF2F2",border:`1px solid ${RED}`,borderRadius:6,fontSize:12,color:"#991B1B"}}>⛔ Cliente com contrato ativo</div>}
        </div>
        <div style={{background:CARD,borderRadius:10,border:`1px solid ${BD}`,padding:20,boxShadow:"0 1px 4px rgba(0,0,0,0.05)"}}>
          <p style={{...LS,marginBottom:14}}>Dados do Contrato</p>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12,marginBottom:12}}>
            <div><span style={LS}>Data do Empréstimo</span><input type="date" value={dtEmp} onChange={e=>setDtEmp(e.target.value)} style={IS}/></div>
            <div><span style={LS}>Data 1º Vencimento</span><input type="date" value={dtVenc} onChange={e=>setDtVenc(e.target.value)} style={IS}/></div>
          </div>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:12}}>
            <div><span style={LS}>Valor Principal (R$)</span><input type="number" min="1" step="0.01" value={principal} onChange={e=>setPrincipal(e.target.value)} placeholder="5000" style={IS}/></div>
            <div><span style={LS}>Nº de Parcelas</span><input type="number" min="1" max="120" value={parcelas} onChange={e=>setParcelas(e.target.value)} placeholder="12" style={IS}/></div>
            <div><span style={LS}>Taxa Mensal (%)</span><input type="number" min="0.1" step="0.01" value={taxa} onChange={e=>setTaxa(e.target.value)} placeholder="10" style={IS}/></div>
          </div>
        </div>
        {sim&&(
          <div style={{background:"#F0FDF4",border:`1px solid ${GRN}`,borderRadius:10,padding:20}}>
            <p style={{...LS,color:GRN,marginBottom:12}}>Simulação</p>
            <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:10}}>
              {[["Valor da Parcela",fmtR(sim.parc),GRN,true],["Total Final",fmtR(sim.tot),BLU,false],["Juros Totais",fmtR(sim.jt),YEL,false]].map(([l,v,c,big])=>(
                <div key={l} style={{background:CARD,borderRadius:8,padding:"12px 14px"}}><p style={{color:MUTED,fontSize:11,fontWeight:600,textTransform:"uppercase",margin:"0 0 4px"}}>{l}</p><p style={{color:c,fontWeight:700,fontSize:big?18:14,margin:0}}>{v}</p></div>
              ))}
            </div>
          </div>
        )}
        <button onClick={confirmar} disabled={loading||!sim||!cliente||clienteTemAtivo} style={{padding:"13px",borderRadius:8,border:"none",background:sim&&cliente&&!clienteTemAtivo?BLU:"#E5E7EB",color:sim&&cliente&&!clienteTemAtivo?"#fff":MUTED,fontWeight:700,fontSize:14,cursor:sim&&cliente&&!clienteTemAtivo?"pointer":"not-allowed",opacity:loading?0.7:1}}>{loading?"Criando contrato...":"Confirmar e Gerar Parcelas"}</button>
        {msg&&<div style={{padding:"12px 16px",borderRadius:8,background:msg.ok?"#ECFDF5":"#FEF2F2",border:`1px solid ${msg.ok?GRN:RED}`,color:msg.ok?"#065F46":"#991B1B",fontSize:13,fontWeight:600}}>{msg.ok?"✅ ":"❌ "}{msg.texto}</div>}
      </div>
    </div>
  );
}

// ── APP ───────────────────────────────────────────────────────────
function App(){
  const [tab,setTab]=useState("dashboard");
  const [raw,setRaw]=useState(null);
  const [loading,setLoading]=useState(true);
  const [erro,setErro]=useState(null);
  const [selCli,setSelCli]=useState(null);
  const [clienteRevisao,setClienteRevisao]=useState(null);
  const [simVal,setSimVal]=useState(5000);const [simInad,setSimInad]=useState(0);const [simVol,setSimVol]=useState(0);
  const [filtroStatus,setFiltroStatus]=useState("todos");const [filtroBusca,setFiltroBusca]=useState("");
  const [busca,setBusca]=useState("");

  const carregar=()=>{setLoading(true);setErro(null);fetch(API_URL).then(r=>r.json()).then(d=>{if(d.erro)throw new Error(d.erro);setRaw(d);setLoading(false);}).catch(e=>{setErro(e.message);setLoading(false);});};
  useEffect(()=>{carregar();},[]);

  const{clientes,contratos,parcelas,pagamentos,eventos,M,cobItems,mensal,projecao}=useMemo(()=>{
    if(!raw)return{clientes:[],contratos:[],parcelas:[],pagamentos:[],eventos:[],M:{},cobItems:[],mensal:[],projecao:[]};
    const parcelas=(raw.PARCELAS||[]).map(p=>({...p,DATA_VENCIMENTO:parseDate(p.DATA_VENCIMENTO),DATA_PAGAMENTO:parseDate(p.DATA_PAGAMENTO),VALOR_PARCELA:parseFloat(p.VALOR_PARCELA)||0,VALOR_PRINCIPAL:parseFloat(p.VALOR_PRINCIPAL)||0,VALOR_JUROS:parseFloat(p.VALOR_JUROS)||0,VALOR_PAGO:parseFloat(p.VALOR_PAGO)||0,DIFERENCA_PAGA:parseFloat(p.DIFERENCA_PAGA)||0,NUM_PARCELA:parseInt(p.NUM_PARCELA)||0,TOTAL_PARCELAS:parseInt(p.TOTAL_PARCELAS)||0}));
    const contratos=(raw.CONTRATOS||[]).map(c=>({...c,VALOR_PRINCIPAL:parseFloat(c.VALOR_PRINCIPAL)||0,VALOR_PARCELA:parseFloat(c.VALOR_PARCELA)||0,NUM_PARCELAS:parseInt(c.NUM_PARCELAS)||0,"TAXA_MENSAL_%":parseFloat(c["TAXA_MENSAL_%"])||0}));
    const pagamentos=(raw.PAGAMENTOS||[]).map(p=>({...p,VALOR_PAGO:parseFloat(p.VALOR_PAGO)||0,VALOR_ORIGINAL_PARCELA:parseFloat(p.VALOR_ORIGINAL_PARCELA)||0,DIFERENCA_RECEBIDA:parseFloat(p.DIFERENCA_RECEBIDA)||0,RECEITA_EXTRA_ATRASO:parseFloat(p.RECEITA_EXTRA_ATRASO)||0,DATA_PAGAMENTO:parseDate(p.DATA_PAGAMENTO)}));
    const eventos=(raw.EVENTOS||[]).map(e=>({...e,VALOR_TOTAL:parseFloat(e.VALOR_TOTAL)||0,VALOR_EXTRA_ATRASO:parseFloat(e.VALOR_EXTRA_ATRASO)||0}));
    const clientes=(raw.CLIENTES||[]).map(cl=>{
      const cs=contratos.filter(c=>String(c.ID_CLIENTE)===String(cl.ID_CLIENTE));
      const ps=parcelas.filter(p=>String(p.ID_CLIENTE)===String(cl.ID_CLIENTE));
      const totalPago=ps.filter(p=>p.STATUS==="pago").reduce((s,p)=>s+(p.VALOR_PAGO||p.VALOR_PARCELA),0);
      const totalAtrasado=ps.filter(p=>p.STATUS==="atrasado").reduce((s,p)=>s+p.VALOR_PARCELA,0);
      const pagas=ps.filter(p=>p.STATUS==="pago").length;const atrasadas=ps.filter(p=>p.STATUS==="atrasado").length;
      let score=Math.max(5,Math.min(100,70+pagas*3-atrasadas*20));
      const status=score>=70?"bom":score>=45?"risco":"inadimplente";
      return{...cl,contratos:cs,parcelas:ps,totalPago,totalAtrasado,score,status,numContratos:cs.length};
    });
    const hoje=new Date();hoje.setHours(0,0,0,0);
    const mesAtual=hoje.toISOString().slice(0,7);
    const dtAnt=new Date(hoje);dtAnt.setMonth(dtAnt.getMonth()-1);const mesAnt=dtAnt.toISOString().slice(0,7);
    const totalPago=parcelas.filter(p=>p.STATUS==="pago").reduce((s,p)=>s+(p.VALOR_PAGO||p.VALOR_PARCELA),0);
    const totalAtrasado=parcelas.filter(p=>p.STATUS==="atrasado").reduce((s,p)=>s+p.VALOR_PARCELA,0);
    const totalPendente=parcelas.filter(p=>p.STATUS==="pendente").reduce((s,p)=>s+p.VALOR_PARCELA,0);
    const totalVencendo=parcelas.filter(p=>p.STATUS==="vencendo").reduce((s,p)=>s+p.VALOR_PARCELA,0);
    const totalAReceber=totalAtrasado+totalPendente+totalVencendo;
    const totalEmprestado=contratos.reduce((s,c)=>s+c.VALOR_PRINCIPAL,0);
    const receitaMes=pagamentos.filter(p=>p.DATA_PAGAMENTO&&p.DATA_PAGAMENTO.toISOString().slice(0,7)===mesAtual).reduce((s,p)=>s+p.VALOR_PAGO,0);
    const receitaAnt=pagamentos.filter(p=>p.DATA_PAGAMENTO&&p.DATA_PAGAMENTO.toISOString().slice(0,7)===mesAnt).reduce((s,p)=>s+p.VALOR_PAGO,0);
    // Receita extra por atraso (total acumulado e no mês)
    const receitaExtraTotal=pagamentos.reduce((s,p)=>s+p.RECEITA_EXTRA_ATRASO,0);
    const receitaExtraMes=pagamentos.filter(p=>p.DATA_PAGAMENTO&&p.DATA_PAGAMENTO.toISOString().slice(0,7)===mesAtual).reduce((s,p)=>s+p.RECEITA_EXTRA_ATRASO,0);
    // Parcelas prorrogadas (geradas por pagamento de juros)
    const parcelasProrrogadas=parcelas.filter(p=>p.ORIGEM_PARCELA==="gerada_por_pagamento_de_juros");
    const totalProrrogado=parcelasProrrogadas.reduce((s,p)=>s+p.VALOR_PARCELA,0);
    const qtyProrrogadas=parcelasProrrogadas.length;
    // Pagamentos por tipo
    const pagNormais=pagamentos.filter(p=>p.TIPO_PAGAMENTO==="pagamento_normal").length;
    const pagAtraso=pagamentos.filter(p=>p.TIPO_PAGAMENTO==="pagamento_com_atraso").length;
    const pagJuros=pagamentos.filter(p=>p.TIPO_PAGAMENTO==="somente_juros").length;

    const taxaMedia=contratos.length?contratos.reduce((s,c)=>s+c["TAXA_MENSAL_%"],0)/contratos.length:0;
    const lucroMes=receitaMes*(taxaMedia/(1+taxaMedia));
    const lucroTotal=totalPago-totalEmprestado;
    const taxaInad=totalAReceber>0?(totalAtrasado/totalAReceber)*100:0;
    const roi=totalEmprestado>0?(lucroTotal/totalEmprestado)*100:0;
    const ticketMedio=contratos.length?totalEmprestado/contratos.length:0;
    const prazoMedio=contratos.length?contratos.reduce((s,c)=>s+c.NUM_PARCELAS,0)/contratos.length:0;
    const coberturaCP=totalPendente>0?totalPago/totalPendente:0;
    const dReceita=receitaAnt>0?((receitaMes-receitaAnt)/receitaAnt)*100:0;
    const M={totalPago,totalAtrasado,totalPendente,totalVencendo,totalAReceber,totalEmprestado,receitaMes,lucroMes,lucroTotal,taxaInad,roi,ticketMedio,prazoMedio,coberturaCP,dReceita,taxaMedia,receitaExtraTotal,receitaExtraMes,parcelasProrrogadas,totalProrrogado,qtyProrrogadas,pagNormais,pagAtraso,pagJuros};
    const cobItems=parcelas.filter(p=>p.STATUS==="atrasado"||p.STATUS==="vencendo").map(p=>{
      const dtV=new Date(p.DATA_VENCIMENTO);dtV.setHours(0,0,0,0);
      const dias=Math.round((dtV-hoje)/86400000);
      const cl=clientes.find(c=>String(c.ID_CLIENTE)===String(p.ID_CLIENTE));
      return{p,cl,dias,urg:dias<-30?"grave":dias<0?"atrasado":dias===0?"hoje":"amanhã"};
    }).sort((a,b)=>a.dias-b.dias);
    const mensal=Array.from({length:6},(_,i)=>{
      const d=new Date(hoje);d.setMonth(d.getMonth()-5+i);
      const mes=d.toISOString().slice(0,7);
      const receita=pagamentos.filter(p=>p.DATA_PAGAMENTO&&p.DATA_PAGAMENTO.toISOString().slice(0,7)===mes).reduce((s,p)=>s+p.VALOR_PAGO,0);
      const extra=pagamentos.filter(p=>p.DATA_PAGAMENTO&&p.DATA_PAGAMENTO.toISOString().slice(0,7)===mes).reduce((s,p)=>s+p.RECEITA_EXTRA_ATRASO,0);
      const lucro=receita*(taxaMedia/(1+taxaMedia));
      return{mes:d.toLocaleDateString("pt-BR",{month:"short"}),receita:Math.round(receita),lucro:Math.round(lucro),extra:Math.round(extra)};
    });
    const projecao=Array.from({length:3},(_,i)=>{
      const d=new Date(hoje);d.setMonth(d.getMonth()+1+i);
      const mes=d.toISOString().slice(0,7);
      const val=parcelas.filter(p=>p.STATUS==="pendente"&&p.DATA_VENCIMENTO&&p.DATA_VENCIMENTO.toISOString().slice(0,7)===mes).reduce((s,p)=>s+p.VALOR_PARCELA,0);
      return{mes:d.toLocaleDateString("pt-BR",{month:"short"}),val:Math.round(val)};
    });
    return{clientes,contratos,parcelas,pagamentos,eventos,M,cobItems,mensal,projecao};
  },[raw]);

  const aguardando=(raw?.CLIENTES||[]).filter(c=>String(c.STATUS_CLIENTE||"").trim()==="aguardando_conferencia");
  const clientesFiltrados=clientes.filter(c=>{const sok=filtroStatus==="todos"||c.status===filtroStatus;const bok=!filtroBusca||c.NOME.toLowerCase().includes(filtroBusca.toLowerCase());return sok&&bok;});
  const hoje=new Date();hoje.setHours(0,0,0,0);
  const proximas=parcelas.filter(p=>p.STATUS!=="pago"&&p.DATA_VENCIMENTO).map(p=>{const dtV=new Date(p.DATA_VENCIMENTO);dtV.setHours(0,0,0,0);const dias=Math.round((dtV-hoje)/86400000);const cl=clientes.find(c=>String(c.ID_CLIENTE)===String(p.ID_CLIENTE));return{...p,dias,cl};}).filter(p=>p.dias>=-30&&p.dias<=3).sort((a,b)=>a.dias-b.dias).slice(0,5);

  const NAV=[
    {id:"dashboard",label:"Dashboard",icon:Ico.dash},
    {id:"clientes",label:"Clientes",icon:Ico.cli,badge:aguardando.length},
    {id:"contratos",label:"Contratos",icon:Ico.ctr},
    {id:"pagamentos",label:"Pagamentos",icon:Ico.pag},
    {id:"novoContrato",label:"Novo Contrato",icon:Ico.novo},
    {id:"cobranca",label:"Cobrança",icon:Ico.cob},
    {id:"financeiro",label:"Financeiro",icon:Ico.fin},
    {id:"kpis",label:"Análise de Crédito",icon:Ico.kpi},
    {id:"analise",label:"Relatórios",icon:Ico.rel},
    {id:"simulador",label:"Simulador",icon:Ico.sim},
  ];

  const kpiColor=(v,ok,warn,rev=false)=>rev?(v<=ok?GRN:v<=warn?YEL:RED):(v>=ok?GRN:v>=warn?YEL:RED);
  const sCol=st=>st==="bom"?GRN:st==="risco"?YEL:RED;
  const bdg=(c,t)=>({display:"inline-flex",alignItems:"center",padding:"3px 9px",borderRadius:20,fontSize:11,fontWeight:600,background:c+"18",color:c,border:`1px solid ${c}30`});
  const TT=({...p})=><Tooltip {...p} contentStyle={{background:CARD,border:`1px solid ${BD}`,borderRadius:8,fontSize:12,boxShadow:"0 4px 12px rgba(0,0,0,0.1)"}}/>;

  if(loading)return(<div style={{background:BG,minHeight:"100vh",display:"flex",alignItems:"center",justifyContent:"center",flexDirection:"column",gap:14}}><style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style><div style={{width:40,height:40,border:`3px solid ${BD}`,borderTop:`3px solid ${BLU}`,borderRadius:"50%",animation:"spin 1s linear infinite"}}/><p style={{color:MUTED,fontSize:13,fontWeight:500}}>Carregando dados...</p></div>);
  if(erro)return(<div style={{background:BG,minHeight:"100vh",display:"flex",alignItems:"center",justifyContent:"center",flexDirection:"column",gap:12}}><span style={{fontSize:40}}>⚠️</span><p style={{color:RED,fontWeight:700,fontSize:16}}>Erro de conexão</p><p style={{color:MUTED,fontSize:13,maxWidth:400,textAlign:"center"}}>{erro}</p><button onClick={carregar} style={{padding:"10px 24px",background:BLU,color:"#fff",border:"none",borderRadius:8,fontWeight:700,cursor:"pointer"}}>Tentar novamente</button></div>);

  return(
    <div style={{display:"flex",minHeight:"100vh",background:BG,fontFamily:"'Inter',system-ui,sans-serif",fontSize:13}}>
      <style>{`*{box-sizing:border-box;margin:0;padding:0}body{margin:0}input,select,textarea{font-family:inherit}::-webkit-scrollbar{width:5px}::-webkit-scrollbar-track{background:transparent}::-webkit-scrollbar-thumb{background:#D1D5DB;border-radius:3px}`}</style>

      {clienteRevisao&&<RevisaoCliente cliente={clienteRevisao} onAtivar={()=>{setClienteRevisao(null);carregar();}} onFechar={()=>setClienteRevisao(null)}/>}

      {/* SIDEBAR */}
      <aside style={{width:SW,background:CARD,borderRight:`1px solid ${BD}`,display:"flex",flexDirection:"column",position:"fixed",top:0,left:0,bottom:0,zIndex:100}}>
        <div style={{padding:"20px 20px 16px",borderBottom:`1px solid ${BD}`}}>
          <div style={{display:"flex",alignItems:"center",gap:10}}>
            <div style={{width:34,height:34,background:"linear-gradient(135deg,#3B82F6,#8B5CF6)",borderRadius:9,display:"flex",alignItems:"center",justifyContent:"center"}}><span style={{color:"#fff",fontSize:16,fontWeight:800}}>F</span></div>
            <div><p style={{color:TEXT,fontWeight:800,fontSize:15,margin:0}}>FinanceiroOp</p><p style={{color:MUTED,fontSize:10,margin:0}}>Gestão de Crédito</p></div>
          </div>
        </div>
        <nav style={{flex:1,overflowY:"auto",padding:"10px 10px"}}>
          {NAV.map(n=>{const sel=tab===n.id;return(
            <button key={n.id} onClick={()=>setTab(n.id)} style={{width:"100%",display:"flex",alignItems:"center",gap:10,padding:"9px 12px",borderRadius:8,border:"none",background:sel?"#EFF6FF":CARD,color:sel?BLU:MUTED,fontWeight:sel?600:400,fontSize:13,cursor:"pointer",textAlign:"left",marginBottom:2,position:"relative"}}>
              <span style={{color:sel?BLU:MUTED,flexShrink:0}}>{n.icon}</span>
              <span style={{flex:1}}>{n.label}</span>
              {n.badge>0&&<span style={{background:RED,color:"#fff",borderRadius:10,padding:"1px 6px",fontSize:10,fontWeight:700}}>{n.badge}</span>}
              {sel&&<span style={{position:"absolute",left:0,top:"20%",bottom:"20%",width:3,background:BLU,borderRadius:"0 3px 3px 0"}}/>}
            </button>
          );})}
        </nav>
        <div style={{padding:"12px 14px",borderTop:`1px solid ${BD}`}}>
          <div style={{display:"flex",alignItems:"center",gap:10,padding:"10px 12px",background:BG,borderRadius:8,cursor:"pointer"}}>
            <span style={{color:MUTED}}>{Ico.help}</span>
            <div><p style={{color:TEXT,fontSize:12,fontWeight:600,margin:0}}>Precisa de ajuda?</p><p style={{color:MUTED,fontSize:11,margin:0}}>Suporte técnico</p></div>
          </div>
        </div>
      </aside>

      {/* MAIN */}
      <div style={{flex:1,marginLeft:SW,display:"flex",flexDirection:"column",minHeight:"100vh"}}>
        <header style={{background:CARD,borderBottom:`1px solid ${BD}`,padding:"0 28px",height:64,display:"flex",alignItems:"center",gap:20,position:"sticky",top:0,zIndex:50}}>
          <div style={{flex:1}}><h1 style={{fontSize:20,fontWeight:700,color:TEXT,margin:0}}>{NAV.find(n=>n.id===tab)?.label||"Dashboard"}</h1></div>
          <div style={{position:"relative",width:300}}>
            <span style={{position:"absolute",left:12,top:"50%",transform:"translateY(-50%)"}}>{Ico.srch}</span>
            <input value={busca} onChange={e=>setBusca(e.target.value)} placeholder="Buscar clientes, contratos..." style={{...IS,paddingLeft:36,paddingRight:12,borderRadius:8,fontSize:12,width:"100%"}}/>
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
          {tab==="dashboard"&&<div>
            <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:16,marginBottom:20}}>
              {[
                {icon:"🏦",label:"Caixa Disponível",val:fmtR(M.totalPago),delta:M.dReceita,c:BLU,bg:"#EFF6FF"},
                {icon:"📦",label:"Carteira Ativa",val:fmtR(M.totalEmprestado),delta:null,c:PUR,bg:"#F5F3FF"},
                {icon:"💰",label:"Total a Receber",val:fmtR(M.totalAReceber),delta:null,c:GRN,bg:"#ECFDF5"},
                {icon:"⚠️",label:"Inadimplência",val:fmtP(M.taxaInad),delta:null,c:M.taxaInad>15?RED:GRN,bg:M.taxaInad>15?"#FEF2F2":"#ECFDF5"},
              ].map(k=>(
                <div key={k.label} style={{background:CARD,borderRadius:10,padding:20,border:`1px solid ${BD}`,boxShadow:"0 1px 4px rgba(0,0,0,0.05)"}}>
                  <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:12}}>
                    <div style={{width:38,height:38,background:k.bg,borderRadius:9,display:"flex",alignItems:"center",justifyContent:"center",fontSize:18}}>{k.icon}</div>
                    <p style={{color:MUTED,fontSize:12,fontWeight:500,margin:0}}>{k.label}</p>
                  </div>
                  <p style={{fontSize:20,fontWeight:700,color:TEXT,margin:"0 0 4px"}}>{k.val}</p>
                  {k.delta!=null&&<p style={{fontSize:11,color:k.delta>=0?GRN:RED,margin:0,fontWeight:500}}>{k.delta>=0?"▲":"▼"} {Math.abs(k.delta).toFixed(1)}% vs. mês anterior</p>}
                </div>
              ))}
            </div>

            {/* Novos cards de rastreabilidade */}
            <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:12,marginBottom:20}}>
              {[
                {icon:"⏰",label:"Receita Extra Atraso",val:fmtR(M.receitaExtraTotal),sub:"total acumulado",c:ORG,bg:"#FFF7ED"},
                {icon:"🔄",label:"Parcelas Prorrogadas",val:M.qtyProrrogadas,sub:fmtR(M.totalProrrogado)+" em aberto",c:PUR,bg:"#F5F3FF"},
                {icon:"✅",label:"Pagamentos Normais",val:M.pagNormais,sub:"no prazo",c:GRN,bg:"#ECFDF5"},
                {icon:"📊",label:"Pagamentos com Atraso",val:M.pagAtraso,sub:`${M.pagJuros} somente juros`,c:YEL,bg:"#FFFBEB"},
              ].map(k=>(
                <div key={k.label} style={{background:CARD,borderRadius:10,padding:16,border:`1px solid ${BD}`,boxShadow:"0 1px 4px rgba(0,0,0,0.05)"}}>
                  <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:10}}>
                    <div style={{width:32,height:32,background:k.bg,borderRadius:8,display:"flex",alignItems:"center",justifyContent:"center",fontSize:16}}>{k.icon}</div>
                    <p style={{color:MUTED,fontSize:11,fontWeight:500,margin:0}}>{k.label}</p>
                  </div>
                  <p style={{fontSize:20,fontWeight:700,color:k.c,margin:"0 0 2px"}}>{k.val}</p>
                  <p style={{fontSize:11,color:MUTED,margin:0}}>{k.sub}</p>
                </div>
              ))}
            </div>

            <div style={{display:"grid",gridTemplateColumns:"2fr 1fr",gap:16,marginBottom:20}}>
              <div style={{background:CARD,borderRadius:10,padding:20,border:`1px solid ${BD}`,boxShadow:"0 1px 4px rgba(0,0,0,0.05)"}}>
                <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:16}}>
                  <div><h3 style={{fontSize:15,fontWeight:700,color:TEXT,margin:0}}>Visão geral da carteira</h3><p style={{color:MUTED,fontSize:12,margin:"2px 0 0"}}>Receita × Lucro × Receita Extra</p></div>
                </div>
                <ResponsiveContainer width="100%" height={200}>
                  <LineChart data={mensal} margin={{top:4,right:4,bottom:0,left:-10}}>
                    <CartesianGrid strokeDasharray="3 3" stroke={BD} vertical={false}/>
                    <XAxis dataKey="mes" tick={{fill:MUTED,fontSize:11}} axisLine={false} tickLine={false}/>
                    <YAxis tick={{fill:MUTED,fontSize:10}} tickFormatter={v=>`R$${(v/1000).toFixed(0)}k`} axisLine={false} tickLine={false}/>
                    <TT formatter={(v,n)=>[fmtR(v),n==="receita"?"Receita":n==="lucro"?"Lucro":"Extra Atraso"]}/>
                    <Line type="monotone" dataKey="receita" stroke={BLU} strokeWidth={2.5} dot={{fill:BLU,r:4}} activeDot={{r:6}}/>
                    <Line type="monotone" dataKey="lucro" stroke={GRN} strokeWidth={2} dot={{fill:GRN,r:3}} strokeDasharray="5 5"/>
                    <Line type="monotone" dataKey="extra" stroke={ORG} strokeWidth={2} dot={{fill:ORG,r:3}} strokeDasharray="3 3"/>
                  </LineChart>
                </ResponsiveContainer>
                <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:12,marginTop:16,paddingTop:16,borderTop:`1px solid ${BD}`}}>
                  {[{l:"Contratos ativos",v:contratos.filter(c=>c.STATUS_CONTRATO==="ativo").length},{l:"Total pagamentos",v:pagamentos.length},{l:"Ticket médio",v:fmtR(M.ticketMedio)},{l:"Prazo médio",v:`${(M.prazoMedio||0).toFixed(0)}m`}].map(s=>(
                    <div key={s.l}><p style={{color:MUTED,fontSize:11,margin:"0 0 3px"}}>{s.l}</p><p style={{color:TEXT,fontWeight:700,fontSize:16,margin:0}}>{s.v}</p></div>
                  ))}
                </div>
              </div>
              <div style={{background:CARD,borderRadius:10,padding:20,border:`1px solid ${BD}`,boxShadow:"0 1px 4px rgba(0,0,0,0.05)"}}>
                <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:14}}>
                  <h3 style={{fontSize:14,fontWeight:700,color:TEXT,margin:0}}>Aguardando Conferência</h3>
                  <button onClick={()=>setTab("clientes")} style={{background:"none",border:"none",color:BLU,fontSize:12,fontWeight:600,cursor:"pointer"}}>Ver todas</button>
                </div>
                {aguardando.length===0?(<div style={{textAlign:"center",padding:"30px 0"}}><p style={{fontSize:24,margin:"0 0 6px"}}>✅</p><p style={{color:MUTED,fontSize:12}}>Nenhuma pendência</p></div>)
                :aguardando.slice(0,5).map(c=>(
                  <div key={c.ID_CLIENTE} style={{display:"flex",alignItems:"center",gap:10,padding:"10px 0",borderBottom:`1px solid ${BD}`}}>
                    <div style={{width:34,height:34,borderRadius:"50%",background:"#EFF6FF",display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}}><span style={{color:BLU,fontSize:13,fontWeight:700}}>{(c.NOME||"?")[0]}</span></div>
                    <div style={{flex:1,minWidth:0}}><p style={{color:TEXT,fontSize:12,fontWeight:600,margin:0,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{c.NOME}</p><p style={{color:MUTED,fontSize:11,margin:0}}>Cadastro via formulário</p></div>
                    <button onClick={()=>setClienteRevisao(c)} style={{background:"#FFFBEB",border:`1px solid ${YEL}`,color:"#92400E",borderRadius:6,padding:"4px 8px",fontSize:11,fontWeight:600,cursor:"pointer",flexShrink:0}}>Revisar</button>
                  </div>
                ))}
              </div>
            </div>

            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr 1fr",gap:16}}>
              {/* Próximas parcelas */}
              <div style={{background:CARD,borderRadius:10,padding:18,border:`1px solid ${BD}`,boxShadow:"0 1px 4px rgba(0,0,0,0.05)"}}>
                <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:12}}>
                  <h4 style={{fontSize:13,fontWeight:700,color:TEXT,margin:0}}>Próximas Parcelas</h4>
                  <button onClick={()=>setTab("cobranca")} style={{background:"none",border:"none",color:BLU,fontSize:11,fontWeight:600,cursor:"pointer"}}>Ver todas</button>
                </div>
                {proximas.slice(0,3).map((p,i)=>(
                  <div key={p.ID_PARCELA} style={{display:"flex",alignItems:"center",gap:10,padding:"8px 0",borderBottom:i<2?`1px solid ${BD}`:"none"}}>
                    <div style={{width:34,height:34,background:p.dias<0?"#FEF2F2":p.dias===0?"#FEF3C7":"#EFF6FF",borderRadius:8,display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",flexShrink:0}}>
                      <span style={{fontSize:13,fontWeight:700,color:p.dias<0?RED:p.dias===0?YEL:BLU,lineHeight:1}}>{p.DATA_VENCIMENTO?new Date(p.DATA_VENCIMENTO).getDate():"—"}</span>
                      <span style={{fontSize:9,color:MUTED,lineHeight:1}}>{p.DATA_VENCIMENTO?new Date(p.DATA_VENCIMENTO).toLocaleDateString("pt-BR",{month:"short"}):"—"}</span>
                    </div>
                    <div style={{flex:1,minWidth:0}}>
                      <p style={{fontSize:12,fontWeight:600,color:TEXT,margin:0,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{p.cl?.NOME||"—"}</p>
                      <p style={{fontSize:10,color:MUTED,margin:0}}>{fmtR(p.VALOR_PARCELA)}</p>
                    </div>
                    <span style={{...bdg(p.dias<0?RED:p.dias===0?YEL:GRN),fontSize:10}}>{p.dias<0?"Atrasado":p.dias===0?"Hoje":"A vencer"}</span>
                  </div>
                ))}
              </div>
              {/* Cobranças */}
              <div style={{background:CARD,borderRadius:10,padding:18,border:`1px solid ${BD}`,boxShadow:"0 1px 4px rgba(0,0,0,0.05)"}}>
                <h4 style={{fontSize:13,fontWeight:700,color:TEXT,margin:"0 0 12px"}}>Cobranças</h4>
                <div style={{display:"flex",alignItems:"center",justifyContent:"center",marginBottom:12}}>
                  <ResponsiveContainer width={90} height={90}>
                    <PieChart><Pie data={[{v:parcelas.filter(p=>p.STATUS==="pago").length},{v:Math.max(1,parcelas.filter(p=>p.STATUS==="atrasado").length)}]} cx="50%" cy="50%" innerRadius={28} outerRadius={42} dataKey="v" startAngle={90} endAngle={-270}><Cell fill={GRN}/><Cell fill="#E5E7EB"/></Pie></PieChart>
                  </ResponsiveContainer>
                  <div><p style={{fontSize:22,fontWeight:700,color:GRN,margin:0}}>{parcelas.length>0?Math.round(parcelas.filter(p=>p.STATUS==="pago").length/parcelas.length*100):0}%</p><p style={{fontSize:11,color:MUTED,margin:0}}>Em dia</p></div>
                </div>
                {[["Atrasadas",cobItems.filter(i=>i.dias<0).length,RED],["Vencendo",cobItems.filter(i=>i.dias>=0).length,YEL],["Prorrogadas",M.qtyProrrogadas,PUR]].map(([l,v,c])=>(
                  <div key={l} style={{display:"flex",justifyContent:"space-between",marginBottom:6}}><span style={{color:MUTED,fontSize:12}}>{l}</span><span style={{color:c,fontWeight:600,fontSize:12}}>{v}</span></div>
                ))}
              </div>
              {/* Perfil carteira */}
              <div style={{background:CARD,borderRadius:10,padding:18,border:`1px solid ${BD}`,boxShadow:"0 1px 4px rgba(0,0,0,0.05)"}}>
                <h4 style={{fontSize:13,fontWeight:700,color:TEXT,margin:"0 0 12px"}}>Carteira por Status</h4>
                <ResponsiveContainer width="100%" height={100}>
                  <PieChart><Pie data={[{name:"Pendente",value:Math.max(1,Math.round(M.totalPendente))},{name:"Atrasado",value:Math.max(0,Math.round(M.totalAtrasado))},{name:"Vencendo",value:Math.max(0,Math.round(M.totalVencendo))}]} cx="50%" cy="50%" innerRadius={30} outerRadius={46} dataKey="value" paddingAngle={2}><Cell fill={BLU}/><Cell fill={RED}/><Cell fill={YEL}/></Pie><TT formatter={v=>fmtR(v)}/></PieChart>
                </ResponsiveContainer>
                {[[BLU,"Pendente",fmtR(M.totalPendente)],[RED,"Atrasado",fmtR(M.totalAtrasado)],[YEL,"Vencendo",fmtR(M.totalVencendo)]].map(([c,l,v])=>(
                  <div key={l} style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginTop:6}}>
                    <div style={{display:"flex",alignItems:"center",gap:6}}><div style={{width:8,height:8,borderRadius:2,background:c}}/><span style={{fontSize:11,color:MUTED}}>{l}</span></div>
                    <span style={{fontSize:11,fontWeight:600,color:TEXT}}>{v}</span>
                  </div>
                ))}
              </div>
              {/* Acesso rápido */}
              <div style={{background:CARD,borderRadius:10,padding:18,border:`1px solid ${BD}`,boxShadow:"0 1px 4px rgba(0,0,0,0.05)"}}>
                <h4 style={{fontSize:13,fontWeight:700,color:TEXT,margin:"0 0 12px"}}>Acesso Rápido</h4>
                {[{tab:"novoContrato",icon:"📄",label:"Novo Contrato",sub:"Criar contrato de crédito"},{tab:"pagamentos",icon:"💳",label:"Registrar Pagamento",sub:"Registrar recebimento"},{tab:"financeiro",icon:"💹",label:"Painel Financeiro",sub:"Rastreabilidade completa"},{tab:"kpis",icon:"📊",label:"Análise de Crédito",sub:"KPIs e performance"}].map(m=>(
                  <div key={m.tab} onClick={()=>setTab(m.tab)} style={{display:"flex",alignItems:"center",gap:10,padding:"8px 0",borderBottom:`1px solid ${BD}`,cursor:"pointer"}} onMouseEnter={e=>e.currentTarget.style.background=BG} onMouseLeave={e=>e.currentTarget.style.background="transparent"}>
                    <div style={{width:32,height:32,background:BG,borderRadius:7,display:"flex",alignItems:"center",justifyContent:"center",fontSize:15,flexShrink:0}}>{m.icon}</div>
                    <div style={{flex:1}}><p style={{fontSize:12,fontWeight:600,color:TEXT,margin:0}}>{m.label}</p><p style={{fontSize:10,color:MUTED,margin:0}}>{m.sub}</p></div>
                    <span style={{color:MUTED}}>{Ico.arr}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>}

          {tab==="pagamentos"&&<RegistrarPagamento clientes={clientes} parcelas={parcelas} onSucesso={()=>setTimeout(carregar,2000)}/>}
          {tab==="novoContrato"&&<NovoContrato clientes={clientes} contratos={contratos} onSucesso={()=>setTimeout(carregar,2000)}/>}

          {/* ── CLIENTES ── */}
          {tab==="clientes"&&<div>
            <div style={{marginBottom:20}}><h1 style={{fontSize:22,fontWeight:700,color:TEXT,margin:0}}>Clientes</h1><p style={{color:MUTED,fontSize:13,margin:"4px 0 0"}}>Gerencie e monitore sua base de clientes</p></div>
            {aguardando.length>0&&(
              <div style={{background:"#FFFBEB",border:`1px solid ${YEL}`,borderRadius:10,padding:16,marginBottom:16}}>
                <h3 style={{color:"#92400E",fontWeight:700,fontSize:14,margin:"0 0 10px"}}>⏳ Aguardando Conferência ({aguardando.length})</h3>
                {aguardando.map(c=>(
                  <div key={c.ID_CLIENTE} style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"10px 14px",background:CARD,borderRadius:8,marginBottom:6,border:`1px solid ${BD}`}}>
                    <div><strong style={{fontSize:13,color:TEXT}}>{c.NOME}</strong><span style={{color:MUTED,fontSize:11,marginLeft:10}}>Cadastro via formulário</span></div>
                    <button onClick={()=>setClienteRevisao(c)} style={{padding:"7px 14px",background:YEL,color:"#fff",border:"none",borderRadius:7,fontWeight:700,fontSize:12,cursor:"pointer"}}>Revisar e Ativar</button>
                  </div>
                ))}
              </div>
            )}
            <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:12,marginBottom:16}}>
              {[{l:"Total",v:clientes.length,c:BLU},{l:"Adimplentes",v:clientes.filter(c=>c.status==="bom").length,c:GRN},{l:"Em Risco",v:clientes.filter(c=>c.status==="risco").length,c:YEL},{l:"Inadimplentes",v:clientes.filter(c=>c.status==="inadimplente").length,c:RED}].map(x=>(
                <div key={x.l} style={{background:CARD,borderRadius:10,padding:"16px 20px",border:`1px solid ${BD}`,textAlign:"center"}}><p style={{fontSize:24,fontWeight:800,color:x.c,margin:"0 0 2px"}}>{x.v}</p><p style={{fontSize:12,color:MUTED,margin:0}}>{x.l}</p></div>
              ))}
            </div>
            <div style={{background:CARD,borderRadius:10,border:`1px solid ${BD}`,boxShadow:"0 1px 4px rgba(0,0,0,0.05)"}}>
              <div style={{padding:"14px 20px",borderBottom:`1px solid ${BD}`,display:"flex",gap:10,alignItems:"center"}}>
                <div style={{position:"relative",flex:1,maxWidth:300}}>
                  <span style={{position:"absolute",left:10,top:"50%",transform:"translateY(-50%)"}}>{Ico.srch}</span>
                  <input placeholder="Buscar cliente..." value={filtroBusca} onChange={e=>setFiltroBusca(e.target.value)} style={{...IS,paddingLeft:32}}/>
                </div>
                <select value={filtroStatus} onChange={e=>setFiltroStatus(e.target.value)} style={{...IS,width:"auto",padding:"8px 32px 8px 12px"}}>
                  <option value="todos">Todos</option><option value="bom">Adimplentes</option><option value="risco">Em Risco</option><option value="inadimplente">Inadimplentes</option>
                </select>
              </div>
              <table style={{width:"100%",borderCollapse:"collapse"}}>
                <thead><tr style={{background:BG}}>{["Cliente","Status","Score","Contratos","Pago","Em Atraso","Ação"].map(h=><th key={h} style={{textAlign:"left",padding:"10px 20px",color:MUTED,fontSize:11,fontWeight:700,textTransform:"uppercase"}}>{h}</th>)}</tr></thead>
                <tbody>
                  {clientesFiltrados.sort((a,b)=>b.score-a.score).map(c=>(
                    <React.Fragment key={c.ID_CLIENTE}>
                      <tr style={{borderTop:`1px solid ${BD}`,cursor:"pointer",background:selCli===c.ID_CLIENTE?"#F0F9FF":CARD}} onClick={()=>setSelCli(selCli===c.ID_CLIENTE?null:c.ID_CLIENTE)} onMouseEnter={e=>{if(selCli!==c.ID_CLIENTE)e.currentTarget.style.background=BG;}} onMouseLeave={e=>{if(selCli!==c.ID_CLIENTE)e.currentTarget.style.background=CARD;}}>
                        <td style={{padding:"13px 20px"}}>
                          <div style={{display:"flex",alignItems:"center",gap:10}}>
                            <div style={{width:34,height:34,borderRadius:"50%",background:"#EFF6FF",display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}}><span style={{color:BLU,fontWeight:700,fontSize:13}}>{(c.NOME||"?")[0]}</span></div>
                            <div><p style={{fontWeight:600,color:TEXT,margin:0,fontSize:13}}>{c.NOME}</p><p style={{color:MUTED,fontSize:11,margin:0}}>{c.TELEFONE_WPP||"—"}</p></div>
                          </div>
                        </td>
                        <td style={{padding:"13px 20px"}}><span style={bdg(sCol(c.status))}>{c.status==="bom"?"Adimplente":c.status==="risco"?"Em Risco":"Inadimplente"}</span></td>
                        <td style={{padding:"13px 20px"}}><div style={{display:"flex",alignItems:"center",gap:8}}><strong style={{color:c.score>70?GRN:c.score>45?YEL:RED,fontSize:14}}>{c.score}</strong><div style={{width:50,height:5,background:BD,borderRadius:3}}><div style={{width:`${c.score}%`,height:"100%",borderRadius:3,background:c.score>70?GRN:c.score>45?YEL:RED}}/></div></div></td>
                        <td style={{padding:"13px 20px",color:MUTED}}>{c.numContratos}</td>
                        <td style={{padding:"13px 20px",color:GRN,fontWeight:600}}>{fmtR(c.totalPago)}</td>
                        <td style={{padding:"13px 20px",color:c.totalAtrasado>0?RED:MUTED,fontWeight:c.totalAtrasado>0?600:400}}>{fmtR(c.totalAtrasado)}</td>
                        <td style={{padding:"13px 20px",fontSize:11,color:c.status==="bom"?GRN:c.status==="risco"?YEL:RED,fontWeight:600}}>{c.status==="bom"?"✅ Liberar":c.status==="risco"?"⚡ Monitorar":"🚫 Bloquear"}</td>
                      </tr>
                      {selCli===c.ID_CLIENTE&&(<tr><td colSpan={7} style={{padding:"0 20px 14px",background:"#F0F9FF"}}>
                        <div style={{padding:14,background:CARD,borderRadius:8,border:`1px solid ${BLU}30`}}>
                          <strong style={{color:BLU,fontSize:13}}>{c.NOME}</strong>
                          {c.contratos.map(ct=>{
                            const ps=parcelas.filter(p=>String(p.ID_CONTRATO)===String(ct.ID_CONTRATO));
                            return<div key={ct.ID_CONTRATO} style={{marginTop:10}}>
                              <p style={{color:MUTED,fontSize:11,margin:"0 0 6px"}}>{ct.ID_CONTRATO} · {fmtR(ct.VALOR_PRINCIPAL)} · {(ct["TAXA_MENSAL_%"]*100).toFixed(1)}%/mês · {ct.STATUS_CONTRATO}</p>
                              <div style={{display:"flex",gap:4,flexWrap:"wrap"}}>
                                {ps.map(p=>(
                                  <div key={p.ID_PARCELA} title={`Parcela ${p.NUM_PARCELA} — ${fmtR(p.VALOR_PARCELA)} — ${p.STATUS}${p.ORIGEM_PARCELA==="gerada_por_pagamento_de_juros"?" — PRORROGADA":""}`}
                                    style={{width:26,height:26,borderRadius:5,display:"flex",alignItems:"center",justifyContent:"center",fontSize:9,fontWeight:700,cursor:"help",
                                      background:p.STATUS==="pago"?"#ECFDF5":p.STATUS==="atrasado"?"#FEF2F2":p.STATUS==="vencendo"?"#FFFBEB":p.ORIGEM_PARCELA==="gerada_por_pagamento_de_juros"?"#F5F3FF":"#F3F4F6",
                                      color:p.STATUS==="pago"?GRN:p.STATUS==="atrasado"?RED:p.STATUS==="vencendo"?YEL:p.ORIGEM_PARCELA==="gerada_por_pagamento_de_juros"?PUR:MUTED,
                                      border:`1px solid ${p.STATUS==="pago"?GRN:p.STATUS==="atrasado"?RED:p.STATUS==="vencendo"?YEL:p.ORIGEM_PARCELA==="gerada_por_pagamento_de_juros"?PUR:BD}`}}>
                                    {p.NUM_PARCELA}
                                  </div>
                                ))}
                              </div>
                            </div>;
                          })}
                        </div>
                      </td></tr>)}
                    </React.Fragment>
                  ))}
                </tbody>
              </table>
            </div>
          </div>}

          {/* ── CONTRATOS ── */}
          {tab==="contratos"&&<div>
            <div style={{marginBottom:20}}><h1 style={{fontSize:22,fontWeight:700,color:TEXT,margin:0}}>Contratos</h1><p style={{color:MUTED,fontSize:13,margin:"4px 0 0"}}>Acompanhe todos os contratos ativos</p></div>
            <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:12,marginBottom:16}}>
              {[{l:"Total",v:contratos.length,c:BLU},{l:"Ativos",v:contratos.filter(c=>c.STATUS_CONTRATO==="ativo").length,c:GRN},{l:"Quitados",v:contratos.filter(c=>["quitado","quitado_acordo"].includes(c.STATUS_CONTRATO)).length,c:MUTED},{l:"Inadimplentes",v:contratos.filter(c=>c.STATUS_CONTRATO==="inadimplente").length,c:RED}].map(x=>(
                <div key={x.l} style={{background:CARD,borderRadius:10,padding:"16px 20px",border:`1px solid ${BD}`,textAlign:"center"}}><p style={{fontSize:24,fontWeight:800,color:x.c,margin:"0 0 2px"}}>{x.v}</p><p style={{fontSize:12,color:MUTED,margin:0}}>{x.l}</p></div>
              ))}
            </div>
            <div style={{display:"grid",gap:12}}>
              {contratos.filter(c=>c.STATUS_CONTRATO==="ativo"||c.STATUS_CONTRATO==="inadimplente").map(c=>{
                const ps=parcelas.filter(p=>String(p.ID_CONTRATO)===String(c.ID_CONTRATO));
                const pago=ps.filter(p=>p.STATUS==="pago").reduce((s,p)=>s+(p.VALOR_PAGO||p.VALOR_PARCELA),0);
                const rest=ps.filter(p=>p.STATUS!=="pago").reduce((s,p)=>s+p.VALOR_PARCELA,0);
                const pct=pago+rest>0?Math.round(pago/(pago+rest)*100):0;
                const hasAtras=ps.some(p=>p.STATUS==="atrasado");
                const prorrogadas=ps.filter(p=>p.ORIGEM_PARCELA==="gerada_por_pagamento_de_juros").length;
                const stColor=hasAtras?RED:GRN;
                return(
                  <div key={c.ID_CONTRATO} style={{background:CARD,borderRadius:10,padding:20,border:`1px solid ${BD}`,boxShadow:"0 1px 4px rgba(0,0,0,0.05)",borderLeft:`4px solid ${stColor}`}}>
                    <div style={{display:"flex",justifyContent:"space-between",flexWrap:"wrap",gap:8,marginBottom:12}}>
                      <div>
                        <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:2}}>
                          <strong style={{fontSize:14,color:TEXT}}>{c.ID_CONTRATO}</strong>
                          <span style={bdg(stColor)}>{hasAtras?"Atrasado":"Em dia"}</span>
                          {prorrogadas>0&&<span style={{...bdg(PUR),fontSize:10}}>🔄 {prorrogadas} prorrogada(s)</span>}
                        </div>
                        <p style={{color:MUTED,fontSize:12,margin:0}}>{c.NOME_CLIENTE}</p>
                      </div>
                      <div style={{textAlign:"right"}}><p style={{fontSize:16,fontWeight:700,color:TEXT,margin:0}}>{fmtR(c.VALOR_PRINCIPAL)}</p><p style={{color:MUTED,fontSize:11,margin:0}}>{(c["TAXA_MENSAL_%"]*100).toFixed(1)}%/mês · {c.NUM_PARCELAS} parcelas</p></div>
                    </div>
                    <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:12}}><div style={{flex:1,height:6,background:BG,borderRadius:3,border:`1px solid ${BD}`}}><div style={{width:`${pct}%`,height:"100%",borderRadius:3,background:GRN}}/></div><span style={{color:MUTED,fontSize:11,whiteSpace:"nowrap"}}>{pct}% pago</span></div>
                    <div style={{display:"flex",gap:4,flexWrap:"wrap"}}>
                      {ps.map(p=>(
                        <div key={p.ID_PARCELA} title={`Parcela ${p.NUM_PARCELA}: ${fmtR(p.VALOR_PARCELA)} · ${p.STATUS}${p.ORIGEM_PARCELA==="gerada_por_pagamento_de_juros"?" · PRORROGADA":""}`}
                          style={{width:24,height:24,borderRadius:5,display:"flex",alignItems:"center",justifyContent:"center",fontSize:9,fontWeight:700,cursor:"help",
                            background:p.STATUS==="pago"?"#ECFDF5":p.STATUS==="atrasado"?"#FEF2F2":p.STATUS==="vencendo"?"#FFFBEB":p.ORIGEM_PARCELA==="gerada_por_pagamento_de_juros"?"#F5F3FF":"#F3F4F6",
                            color:p.STATUS==="pago"?GRN:p.STATUS==="atrasado"?RED:p.STATUS==="vencendo"?YEL:p.ORIGEM_PARCELA==="gerada_por_pagamento_de_juros"?PUR:MUTED,
                            border:`1px solid ${p.STATUS==="pago"?GRN:p.STATUS==="atrasado"?RED:p.STATUS==="vencendo"?YEL:p.ORIGEM_PARCELA==="gerada_por_pagamento_de_juros"?PUR:BD}`}}>
                          {p.NUM_PARCELA}
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>}

          {/* ── COBRANÇA ── */}
          {tab==="cobranca"&&<div>
            <div style={{marginBottom:20}}><h1 style={{fontSize:22,fontWeight:700,color:TEXT,margin:0}}>Central de Cobrança</h1><p style={{color:MUTED,fontSize:13,margin:"4px 0 0"}}>Parcelas em atraso e a vencer</p></div>
            {cobItems.length===0?(<div style={{background:CARD,borderRadius:10,padding:"48px",textAlign:"center",border:`1px solid ${BD}`}}><p style={{fontSize:32,margin:"0 0 8px"}}>✅</p><p style={{color:GRN,fontWeight:700,fontSize:16,margin:0}}>Nenhuma pendência!</p></div>)
            :["grave","atrasado","hoje","amanhã"].map(urg=>{
              const items=cobItems.filter(i=>i.urg===urg);
              if(!items.length)return null;
              const label={grave:"🚨 Atraso Grave (+30 dias)",atrasado:"⛔ Atrasadas",hoje:"🔴 Vence Hoje",amanhã:"🟡 Vence Amanhã"}[urg];
              const col={grave:RED,atrasado:RED,hoje:YEL,amanhã:YEL}[urg];
              return(
                <div key={urg} style={{marginBottom:20}}>
                  <h3 style={{color:col,fontWeight:700,fontSize:14,margin:"0 0 10px"}}>{label} ({items.length})</h3>
                  <div style={{display:"grid",gap:8}}>
                    {items.map(({p,cl,dias},i)=>(
                      <div key={i} style={{background:CARD,borderRadius:10,padding:"14px 18px",border:`1px solid ${BD}`,borderLeft:`4px solid ${col}`,boxShadow:"0 1px 4px rgba(0,0,0,0.05)",display:"flex",alignItems:"center",gap:14}}>
                        <div style={{width:40,height:40,borderRadius:"50%",background:col+"18",display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}}><span style={{color:col,fontWeight:700,fontSize:13}}>{(cl?.NOME||"?")[0]}</span></div>
                        <div style={{flex:1}}>
                          <div style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}>
                            <div>
                              <strong style={{fontSize:13,color:TEXT}}>{cl?.NOME||"Cliente"}</strong>
                              {p.ORIGEM_PARCELA==="gerada_por_pagamento_de_juros"&&<span style={{marginLeft:8,fontSize:10,background:"#F5F3FF",color:PUR,padding:"2px 6px",borderRadius:10,fontWeight:600}}>Prorrogada</span>}
                            </div>
                            <strong style={{color:col,fontSize:14}}>{fmtR(p.VALOR_PARCELA)}</strong>
                          </div>
                          <div style={{display:"flex",gap:12,marginTop:4,fontSize:11,color:MUTED}}>
                            <span>Parcela {p.NUM_PARCELA}/{p.TOTAL_PARCELAS}</span>
                            <span>Venc: {fmtDt(p.DATA_VENCIMENTO)}</span>
                            {cl?.TELEFONE_WPP&&<span>📱 {cl.TELEFONE_WPP}</span>}
                            <span style={{color:col,fontWeight:600}}>{dias<0?`${Math.abs(dias)}d atraso`:dias===0?"HOJE":"AMANHÃ"}</span>
                          </div>
                        </div>
                        <button onClick={()=>setTab("pagamentos")} style={{padding:"7px 14px",background:col,color:"#fff",border:"none",borderRadius:7,fontSize:12,fontWeight:600,cursor:"pointer",flexShrink:0}}>Registrar</button>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>}

          {/* ── PAINEL FINANCEIRO (novo) ── */}
          {tab==="financeiro"&&<div>
            <div style={{marginBottom:20}}><h1 style={{fontSize:22,fontWeight:700,color:TEXT,margin:0}}>Painel Financeiro</h1><p style={{color:MUTED,fontSize:13,margin:"4px 0 0"}}>Rastreabilidade completa de pagamentos e receitas</p></div>

            {/* KPIs financeiros */}
            <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:14,marginBottom:20}}>
              {[
                {icon:"💵",label:"Receita Total",val:fmtR(M.totalPago),sub:"todos os pagamentos",c:BLU,bg:"#EFF6FF"},
                {icon:"⏰",label:"Receita Extra Atraso",val:fmtR(M.receitaExtraTotal),sub:"juros/multa por atraso",c:ORG,bg:"#FFF7ED"},
                {icon:"🔄",label:"Total Prorrogado",val:fmtR(M.totalProrrogado),sub:`${M.qtyProrrogadas} parcelas no final`,c:PUR,bg:"#F5F3FF"},
                {icon:"✅",label:"Pagamentos Normais",val:M.pagNormais,sub:"no prazo",c:GRN,bg:"#ECFDF5"},
                {icon:"⚠️",label:"Pagamentos com Atraso",val:M.pagAtraso,sub:"valor maior que original",c:YEL,bg:"#FFFBEB"},
                {icon:"💸",label:"Somente Juros",val:M.pagJuros,sub:"principal prorrogado",c:RED,bg:"#FEF2F2"},
              ].map(k=>(
                <div key={k.label} style={{background:CARD,borderRadius:10,padding:20,border:`1px solid ${BD}`,boxShadow:"0 1px 4px rgba(0,0,0,0.05)"}}>
                  <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:12}}>
                    <div style={{width:36,height:36,background:k.bg,borderRadius:8,display:"flex",alignItems:"center",justifyContent:"center",fontSize:18}}>{k.icon}</div>
                    <p style={{color:MUTED,fontSize:12,fontWeight:500,margin:0}}>{k.label}</p>
                  </div>
                  <p style={{fontSize:20,fontWeight:700,color:k.c,margin:"0 0 2px"}}>{k.val}</p>
                  <p style={{fontSize:11,color:MUTED,margin:0}}>{k.sub}</p>
                </div>
              ))}
            </div>

            {/* Gráfico receita + extra */}
            <div style={{display:"grid",gridTemplateColumns:"2fr 1fr",gap:16,marginBottom:20}}>
              <div style={{background:CARD,borderRadius:10,padding:20,border:`1px solid ${BD}`,boxShadow:"0 1px 4px rgba(0,0,0,0.05)"}}>
                <h3 style={{fontSize:14,fontWeight:700,color:TEXT,margin:"0 0 16px"}}>Receita por Mês (total e extra por atraso)</h3>
                <ResponsiveContainer width="100%" height={200}>
                  <BarChart data={mensal} margin={{top:4,right:4,bottom:0,left:-10}}>
                    <CartesianGrid strokeDasharray="3 3" stroke={BD} vertical={false}/>
                    <XAxis dataKey="mes" tick={{fill:MUTED,fontSize:11}} axisLine={false} tickLine={false}/>
                    <YAxis tick={{fill:MUTED,fontSize:10}} tickFormatter={v=>`R$${(v/1000).toFixed(0)}k`} axisLine={false} tickLine={false}/>
                    <TT formatter={(v,n)=>[fmtR(v),n==="receita"?"Receita Total":"Receita Extra"]}/>
                    <Bar dataKey="receita" fill={BLU} radius={[4,4,0,0]} name="receita"/>
                    <Bar dataKey="extra" fill={ORG} radius={[4,4,0,0]} name="extra"/>
                  </BarChart>
                </ResponsiveContainer>
                <div style={{display:"flex",gap:16,marginTop:8}}>
                  {[[BLU,"Receita Total"],[ORG,"Receita Extra (Atraso)"]].map(([c,l])=><div key={l} style={{display:"flex",alignItems:"center",gap:6}}><div style={{width:10,height:10,borderRadius:2,background:c}}/><span style={{fontSize:11,color:MUTED}}>{l}</span></div>)}
                </div>
              </div>
              {/* Distribuição tipos de pagamento */}
              <div style={{background:CARD,borderRadius:10,padding:20,border:`1px solid ${BD}`,boxShadow:"0 1px 4px rgba(0,0,0,0.05)"}}>
                <h3 style={{fontSize:14,fontWeight:700,color:TEXT,margin:"0 0 16px"}}>Tipos de Pagamento</h3>
                <ResponsiveContainer width="100%" height={140}>
                  <PieChart>
                    <Pie data={[{name:"Normal",value:Math.max(0,M.pagNormais)},{name:"Com Atraso",value:Math.max(0,M.pagAtraso)},{name:"Somente Juros",value:Math.max(0,M.pagJuros)}]} cx="50%" cy="50%" innerRadius={36} outerRadius={58} dataKey="value" paddingAngle={2}>
                      <Cell fill={GRN}/><Cell fill={YEL}/><Cell fill={RED}/>
                    </Pie>
                    <TT/>
                  </PieChart>
                </ResponsiveContainer>
                {[[GRN,"Normal",M.pagNormais],[YEL,"Com Atraso",M.pagAtraso],[RED,"Somente Juros",M.pagJuros]].map(([c,l,v])=>(
                  <div key={l} style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginTop:8}}>
                    <div style={{display:"flex",alignItems:"center",gap:6}}><div style={{width:8,height:8,borderRadius:2,background:c}}/><span style={{fontSize:11,color:MUTED}}>{l}</span></div>
                    <span style={{fontSize:12,fontWeight:600,color:TEXT}}>{v}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Tabela de parcelas prorrogadas */}
            {M.parcelasProrrogadas.length>0&&(
              <div style={{background:CARD,borderRadius:10,border:`1px solid ${BD}`,boxShadow:"0 1px 4px rgba(0,0,0,0.05)"}}>
                <div style={{padding:"14px 20px",borderBottom:`1px solid ${BD}`}}>
                  <h3 style={{fontSize:14,fontWeight:700,color:TEXT,margin:0}}>🔄 Parcelas Prorrogadas ({M.parcelasProrrogadas.length})</h3>
                  <p style={{color:MUTED,fontSize:12,margin:"2px 0 0"}}>Geradas por pagamento somente dos juros</p>
                </div>
                <table style={{width:"100%",borderCollapse:"collapse"}}>
                  <thead><tr style={{background:BG}}>{["ID Parcela","Contrato","Cliente","Vencimento","Valor","Parcela Origem","Status"].map(h=><th key={h} style={{textAlign:"left",padding:"10px 20px",color:MUTED,fontSize:11,fontWeight:700,textTransform:"uppercase"}}>{h}</th>)}</tr></thead>
                  <tbody>
                    {M.parcelasProrrogadas.map(p=>{
                      const cl=clientes.find(c=>String(c.ID_CLIENTE)===String(p.ID_CLIENTE));
                      return(
                        <tr key={p.ID_PARCELA} style={{borderTop:`1px solid ${BD}`}}>
                          <td style={{padding:"12px 20px",color:PUR,fontWeight:600,fontSize:12}}>{p.ID_PARCELA}</td>
                          <td style={{padding:"12px 20px",color:MUTED,fontSize:12}}>{p.ID_CONTRATO}</td>
                          <td style={{padding:"12px 20px",color:TEXT,fontWeight:500,fontSize:12}}>{cl?.NOME||p.NOME_CLIENTE}</td>
                          <td style={{padding:"12px 20px",color:MUTED,fontSize:12}}>{fmtDt(p.DATA_VENCIMENTO)}</td>
                          <td style={{padding:"12px 20px",color:TEXT,fontWeight:600,fontSize:12}}>{fmtR(p.VALOR_PARCELA)}</td>
                          <td style={{padding:"12px 20px",color:MUTED,fontSize:12}}>{p.ID_PARCELA_ORIGEM||"—"}</td>
                          <td style={{padding:"12px 20px"}}><span style={bdg(p.STATUS==="pago"?GRN:p.STATUS==="atrasado"?RED:BLU)}>{p.STATUS}</span></td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}

            {/* Tabela de últimos pagamentos com diferença */}
            <div style={{background:CARD,borderRadius:10,border:`1px solid ${BD}`,boxShadow:"0 1px 4px rgba(0,0,0,0.05)",marginTop:16}}>
              <div style={{padding:"14px 20px",borderBottom:`1px solid ${BD}`}}>
                <h3 style={{fontSize:14,fontWeight:700,color:TEXT,margin:0}}>Últimos Pagamentos</h3>
              </div>
              <table style={{width:"100%",borderCollapse:"collapse"}}>
                <thead><tr style={{background:BG}}>{["Data","Cliente","Parcela","Valor Original","Valor Pago","Diferença (Extra)","Tipo"].map(h=><th key={h} style={{textAlign:"left",padding:"10px 20px",color:MUTED,fontSize:11,fontWeight:700,textTransform:"uppercase"}}>{h}</th>)}</tr></thead>
                <tbody>
                  {[...pagamentos].sort((a,b)=>new Date(b.DATA_PAGAMENTO||0)-new Date(a.DATA_PAGAMENTO||0)).slice(0,15).map((p,i)=>{
                    const tipoCor=p.TIPO_PAGAMENTO==="pagamento_normal"?GRN:p.TIPO_PAGAMENTO==="pagamento_com_atraso"?YEL:p.TIPO_PAGAMENTO==="somente_juros"?RED:MUTED;
                    const tipoLabel={pagamento_normal:"Normal",pagamento_com_atraso:"Com Atraso",somente_juros:"Somente Juros"}[p.TIPO_PAGAMENTO]||p.TIPO_PAGAMENTO||"—";
                    return(
                      <tr key={i} style={{borderTop:`1px solid ${BD}`}}>
                        <td style={{padding:"11px 20px",color:MUTED,fontSize:12}}>{fmtDt(p.DATA_PAGAMENTO)}</td>
                        <td style={{padding:"11px 20px",color:TEXT,fontWeight:500,fontSize:12}}>{p.NOME_CLIENTE}</td>
                        <td style={{padding:"11px 20px",color:MUTED,fontSize:12}}>{p.ID_PARCELA}</td>
                        <td style={{padding:"11px 20px",color:MUTED,fontSize:12}}>{fmtR(p.VALOR_ORIGINAL_PARCELA)}</td>
                        <td style={{padding:"11px 20px",color:TEXT,fontWeight:600,fontSize:12}}>{fmtR(p.VALOR_PAGO)}</td>
                        <td style={{padding:"11px 20px",color:p.RECEITA_EXTRA_ATRASO>0?ORG:MUTED,fontWeight:p.RECEITA_EXTRA_ATRASO>0?700:400,fontSize:12}}>{p.RECEITA_EXTRA_ATRASO>0?`+${fmtR(p.RECEITA_EXTRA_ATRASO)}`:"—"}</td>
                        <td style={{padding:"11px 20px"}}><span style={bdg(tipoCor)}>{tipoLabel}</span></td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>}

          {/* ── KPIs ── */}
          {tab==="kpis"&&<div>
            <div style={{marginBottom:20}}><h1 style={{fontSize:22,fontWeight:700,color:TEXT,margin:0}}>Análise de Crédito</h1><p style={{color:MUTED,fontSize:13,margin:"4px 0 0"}}>Indicadores de performance da operação</p></div>
            <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:14}}>
              {[
                {l:"Taxa de Inadimplência",v:fmtP(M.taxaInad),raw:M.taxaInad,ok:10,warn:20,rev:true,desc:"Atrasado / total a receber",ideal:"< 10%",icon:"⚠️"},
                {l:"ROI da Operação",v:fmtP(M.roi),raw:M.roi,ok:15,warn:8,desc:"Retorno sobre capital",ideal:"> 15%",icon:"📈"},
                {l:"Ticket Médio",v:fmtR(M.ticketMedio),raw:M.ticketMedio,ok:2000,warn:800,desc:"Valor médio por contrato",ideal:"> R$ 2.000",icon:"🎫"},
                {l:"Prazo Médio",v:`${(M.prazoMedio||0).toFixed(1)} meses`,raw:null,desc:"Duração média dos contratos",ideal:"—",icon:"📅"},
                {l:"Cobertura CP",v:`${(M.coberturaCP||0).toFixed(2)}x`,raw:M.coberturaCP,ok:1.5,warn:1.0,desc:"Caixa / pendências",ideal:"> 1.5x",icon:"🛡️"},
                {l:"Capital Alocado",v:fmtR(M.totalEmprestado),raw:null,desc:"Volume total emprestado",ideal:"—",icon:"🏦"},
                {l:"Lucro Bruto",v:fmtR(M.lucroTotal),raw:M.lucroTotal,ok:1,warn:0,desc:"Juros recebidos estimados",ideal:"> 0",icon:"💰"},
                {l:"Receita Extra Atraso",v:fmtR(M.receitaExtraTotal),raw:null,desc:"Juros/multa por pagamento em atraso",ideal:"—",icon:"⏰"},
                {l:"Parcelas Prorrogadas",v:M.qtyProrrogadas,raw:null,desc:"Geradas por pagamento somente de juros",ideal:"—",icon:"🔄"},
              ].map(k=>{
                const col=k.raw!=null?kpiColor(k.raw,k.ok,k.warn,k.rev):MUTED;
                const status=k.raw!=null?(col===GRN?"Saudável":col===YEL?"Atenção":"Crítico"):null;
                return(
                  <div key={k.l} style={{background:CARD,borderRadius:10,padding:20,border:`1px solid ${BD}`,boxShadow:"0 1px 4px rgba(0,0,0,0.05)"}}>
                    <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:10}}><span style={{fontSize:22}}>{k.icon}</span>{status&&<span style={bdg(col)}>{col===GRN?"✅":col===YEL?"⚡":"🚨"} {status}</span>}</div>
                    <p style={{color:MUTED,fontSize:11,fontWeight:600,textTransform:"uppercase",margin:"0 0 4px"}}>{k.l}</p>
                    <p style={{fontSize:22,fontWeight:800,color:k.raw!=null?col:TEXT,margin:"0 0 4px"}}>{k.val}</p>
                    <p style={{fontSize:11,color:MUTED,margin:0}}>{k.desc} — ideal: {k.ideal}</p>
                  </div>
                );
              })}
            </div>
          </div>}

          {/* ── ANÁLISE ── */}
          {tab==="analise"&&(()=>{
            const bons=clientes.filter(c=>c.status==="bom");
            const inad=clientes.filter(c=>c.status==="inadimplente");
            const risco=clientes.filter(c=>c.status==="risco");
            return(
              <div>
                <div style={{marginBottom:20}}><h1 style={{fontSize:22,fontWeight:700,color:TEXT,margin:0}}>Relatórios e Análise</h1><p style={{color:MUTED,fontSize:13,margin:"4px 0 0"}}>Insights inteligentes sobre a operação</p></div>
                <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:16,marginBottom:16}}>
                  <div style={{background:CARD,borderRadius:10,padding:20,border:`1px solid ${BD}`,boxShadow:"0 1px 4px rgba(0,0,0,0.05)"}}>
                    <h3 style={{fontSize:14,fontWeight:700,color:TEXT,margin:"0 0 14px"}}>📊 Receita × Lucro × Extra</h3>
                    <ResponsiveContainer width="100%" height={180}>
                      <BarChart data={mensal} margin={{top:4,right:4,bottom:0,left:-10}}>
                        <CartesianGrid strokeDasharray="3 3" stroke={BD} vertical={false}/>
                        <XAxis dataKey="mes" tick={{fill:MUTED,fontSize:11}} axisLine={false} tickLine={false}/>
                        <YAxis tick={{fill:MUTED,fontSize:10}} tickFormatter={v=>`R$${(v/1000).toFixed(0)}k`} axisLine={false} tickLine={false}/>
                        <TT formatter={(v,n)=>[fmtR(v),n==="receita"?"Receita":n==="lucro"?"Lucro":"Extra"]}/>
                        <Bar dataKey="receita" fill={BLU} radius={[4,4,0,0]}/>
                        <Bar dataKey="lucro" fill={GRN} radius={[4,4,0,0]}/>
                        <Bar dataKey="extra" fill={ORG} radius={[4,4,0,0]}/>
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                  <div style={{background:CARD,borderRadius:10,padding:20,border:`1px solid ${BD}`,boxShadow:"0 1px 4px rgba(0,0,0,0.05)"}}>
                    <h3 style={{fontSize:14,fontWeight:700,color:TEXT,margin:"0 0 14px"}}>📅 Projeção — Próximos 3 Meses</h3>
                    <ResponsiveContainer width="100%" height={180}>
                      <BarChart data={projecao} margin={{top:4,right:4,bottom:0,left:-10}}>
                        <CartesianGrid strokeDasharray="3 3" stroke={BD} vertical={false}/>
                        <XAxis dataKey="mes" tick={{fill:MUTED,fontSize:11}} axisLine={false} tickLine={false}/>
                        <YAxis tick={{fill:MUTED,fontSize:10}} tickFormatter={v=>`R$${(v/1000).toFixed(0)}k`} axisLine={false} tickLine={false}/>
                        <TT formatter={v=>[fmtR(v),"Previsto"]}/>
                        <Bar dataKey="val" fill={PUR} radius={[4,4,0,0]}/>
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </div>
                {[
                  {title:"🚨 Problemas",col:RED,items:[`Inadimplência em ${fmtP(M.taxaInad)} — ${M.taxaInad>15?"acima do limite de 15%.":"dentro do aceitável."}`,`${inad.length} cliente(s) inadimplente(s) com ${fmtR(inad.reduce((s,c)=>s+c.totalAtrasado,0))} em atraso.`,M.roi<10?`ROI em ${fmtP(M.roi)} — rentabilidade comprimida.`:`ROI em ${fmtP(M.roi)} — operação rentável.`,M.qtyProrrogadas>0?`${M.qtyProrrogadas} parcelas prorrogadas — ${fmtR(M.totalProrrogado)} em aberto no final dos contratos.`:"Nenhuma parcela prorrogada."]},
                  {title:"🚀 Oportunidades",col:GRN,items:[`${bons.length} cliente(s) com score alto — candidatos a novos contratos.`,`Ticket médio de ${fmtR(M.ticketMedio)} — espaço para crédito maior a bons pagadores.`,`Receita extra de ${fmtR(M.receitaExtraTotal)} por atraso — mostra perfil de risco da carteira.`]},
                  {title:"⚠️ Riscos",col:YEL,items:[`${risco.length} cliente(s) em zona de risco — monitorar antes de inadimplência.`,M.coberturaCP<1.5?`Cobertura de curto prazo em ${(M.coberturaCP||0).toFixed(2)}x — liquidez limitada.`:`Cobertura adequada em ${(M.coberturaCP||0).toFixed(2)}x.`,`${M.pagJuros} pagamentos de somente juros registrados — principal prorrogado impacta fluxo futuro.`]},
                ].map(s=>(
                  <div key={s.title} style={{background:CARD,borderRadius:10,padding:20,border:`1px solid ${BD}`,boxShadow:"0 1px 4px rgba(0,0,0,0.05)",marginBottom:12}}>
                    <h3 style={{fontSize:14,fontWeight:700,color:s.col,margin:"0 0 12px"}}>{s.title}</h3>
                    {s.items.map((it,i)=><div key={i} style={{display:"flex",gap:10,padding:"8px 0",borderBottom:i<s.items.length-1?`1px solid ${BD}`:"none"}}><span style={{color:s.col,flexShrink:0,marginTop:1}}>▸</span><p style={{margin:0,color:TEXT,fontSize:13}}>{it}</p></div>)}
                  </div>
                ))}
              </div>
            );
          })()}

          {/* ── SIMULADOR ── */}
          {tab==="simulador"&&(()=>{
            const inadPct=((M.taxaInad||0)+simInad)/100;
            const novaCarteira=(M.totalAReceber||0)+simVal;
            const perdaExtra=novaCarteira*inadPct;
            const lucroProj=(M.lucroMes||0)*(1+simVol/100)-perdaExtra*0.08;
            const risco=inadPct>0.3?"crítico":inadPct>0.15?"atenção":"saudável";
            const riscoCol=risco==="crítico"?RED:risco==="atenção"?YEL:GRN;
            return(
              <div>
                <div style={{marginBottom:20}}><h1 style={{fontSize:22,fontWeight:700,color:TEXT,margin:0}}>Simulador de Decisão</h1><p style={{color:MUTED,fontSize:13,margin:"4px 0 0"}}>Simule cenários e avalie o impacto na carteira</p></div>
                <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:20}}>
                  <div style={{display:"grid",gap:14}}>
                    {[{l:"💵 Novo Empréstimo (R$)",v:simVal,set:setSimVal,min:0,max:50000,step:500,fmt:v=>fmtR(v)},{l:"📉 Aumento Inadimplência (%)",v:simInad,set:setSimInad,min:0,max:40,step:1,fmt:v=>v+"%"},{l:"📈 Crescimento do Volume (%)",v:simVol,set:setSimVol,min:-50,max:100,step:5,fmt:v=>v+"%"}].map(inp=>(
                      <div key={inp.l} style={{background:CARD,borderRadius:10,padding:20,border:`1px solid ${BD}`,boxShadow:"0 1px 4px rgba(0,0,0,0.05)"}}>
                        <p style={{color:MUTED,fontSize:12,fontWeight:600,margin:"0 0 10px"}}>{inp.l}</p>
                        <input type="range" min={inp.min} max={inp.max} step={inp.step} value={inp.v} onChange={e=>inp.set(Number(e.target.value))} style={{width:"100%",accentColor:BLU,margin:"0 0 8px"}}/>
                        <div style={{display:"flex",justifyContent:"space-between"}}><strong style={{color:BLU,fontSize:18}}>{inp.fmt(inp.v)}</strong><span style={{color:MUTED,fontSize:11}}>{inp.min} → {inp.max}</span></div>
                      </div>
                    ))}
                    <button onClick={()=>{setSimVal(5000);setSimInad(0);setSimVol(0);}} style={{padding:"10px",borderRadius:8,border:`1px solid ${BD}`,background:CARD,color:MUTED,fontWeight:600,fontSize:13,cursor:"pointer"}}>🔄 Resetar</button>
                  </div>
                  <div>
                    <div style={{background:CARD,borderRadius:10,padding:20,border:`2px solid ${riscoCol}`,boxShadow:"0 1px 4px rgba(0,0,0,0.05)",marginBottom:14}}>
                      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:14}}>
                        <h3 style={{fontSize:15,fontWeight:700,color:TEXT,margin:0}}>Resultado</h3>
                        <span style={bdg(riscoCol)}>{risco.toUpperCase()}</span>
                      </div>
                      {[{l:"Nova Carteira",v:fmtR(novaCarteira),c:BLU},{l:"Perda Estimada",v:fmtR(perdaExtra),c:perdaExtra>5000?RED:YEL},{l:"Lucro Projetado",v:fmtR(lucroProj),c:lucroProj>0?GRN:RED},{l:"Nível de Risco",v:risco.toUpperCase(),c:riscoCol}].map((r,i)=>(
                        <div key={r.l} style={{display:"flex",justifyContent:"space-between",padding:"12px 0",borderBottom:i<3?`1px solid ${BD}`:"none"}}>
                          <span style={{color:MUTED,fontSize:13}}>{r.l}</span><strong style={{color:r.c,fontSize:15}}>{r.v}</strong>
                        </div>
                      ))}
                    </div>
                    <div style={{background:riscoCol+"10",border:`1px solid ${riscoCol}30`,borderRadius:10,padding:16}}>
                      <p style={{color:riscoCol,fontWeight:700,fontSize:13,margin:"0 0 6px"}}>💡 Recomendação</p>
                      <p style={{color:MUTED,fontSize:12,margin:0}}>{risco==="crítico"?"Inadimplência crítica. Recomenda-se não expandir a carteira agora.":risco==="atenção"?"Atenção necessária. Avalie criteriosamente novos contratos.":"Operação saudável. Cenário favorável para expansão controlada."}</p>
                    </div>
                  </div>
                </div>
              </div>
            );
          })()}

        </main>
      </div>
    </div>
  );
}

createRoot(document.getElementById("root")).render(<App/>);
