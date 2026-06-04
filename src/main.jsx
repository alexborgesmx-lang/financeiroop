import React, { useState, useMemo, useEffect, useRef } from "react";
import { createRoot } from "react-dom/client";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from "recharts";
import { jsPDF } from "jspdf";
import { Card } from "./components/ui/card";
import { Button } from "./components/ui/button";

const API_URL  = "/api/sheets";
const POST_URL = "/api/action";

let BG   = "#F7F9F8", CARD = "#FFFFFF", BD = "#DDE3E0";
let TEXT = "#121815", MUTED = "#6E7975";
let GRN  = "#15A06A", RED = "#D64545", BLU = "#1B8A8F";
let YEL  = "#E0A030", PUR = "#7C3AED", ORG = "#ff7700";
let ACC  = "#A8E03F";
let SHD  = "rgba(10,15,13,0.06) 0px 2px 8px,rgba(10,15,13,0.04) 0px 1px 2px";
const SW = 220;
const LIGHT={BG:"#F7F9F8",CARD:"#FFFFFF",BD:"#DDE3E0",TEXT:"#121815",MUTED:"#6E7975",GRN:"#15A06A",RED:"#D64545",BLU:"#1B8A8F",YEL:"#E0A030",PUR:"#7C3AED",ORG:"#ff7700",ACC:"#A8E03F",SHD:"rgba(10,15,13,0.06) 0px 4px 16px,rgba(10,15,13,0.02) 0px 1px 4px"};
const DARK ={BG:"#07241B",CARD:"#0B3D2E",BD:"#1F2624",TEXT:"#FFFFFF",MUTED:"#9AA5A0",GRN:"#46CB92",RED:"#ef253b",BLU:"#3EC9C4",YEL:"#FACC15",PUR:"#A78BFA",ORG:"#ff7700",ACC:"#A8E03F",SHD:"rgba(0,0,0,0.25) 0px 4px 20px,rgba(0,0,0,0.10) 0px 1px 4px"};
function applyTheme(dark){const t=dark?DARK:LIGHT;BG=t.BG;CARD=t.CARD;BD=t.BD;TEXT=t.TEXT;MUTED=t.MUTED;GRN=t.GRN;RED=t.RED;BLU=t.BLU;YEL=t.YEL;PUR=t.PUR;ORG=t.ORG;ACC=t.ACC;SHD=t.SHD;document.documentElement.classList.toggle('dark',dark);document.body.classList.add('theme-transitioning');setTimeout(()=>document.body.classList.remove('theme-transitioning'),320);}
function isDarkHour(){const h=new Date().getHours();return h>=18||h<6;}

const fmtR  = v => "R$ " + Number(v||0).toLocaleString("pt-BR",{minimumFractionDigits:2,maximumFractionDigits:2});
const fmtP  = v => Number(v||0).toFixed(1) + "%";
const fmtDt = v => { if(!v) return "—"; const d = v instanceof Date ? v : new Date(v); return isNaN(d.getTime()) ? "—" : d.toLocaleDateString("pt-BR"); };
const hojeStr = () => dateInputStr(new Date());
const dateInputStr = d => {
  const dt = d instanceof Date ? d : new Date(d);
  if(isNaN(dt.getTime())) return "";
  const y = dt.getFullYear();
  const m = String(dt.getMonth()+1).padStart(2,"0");
  const day = String(dt.getDate()).padStart(2,"0");
  return `${y}-${m}-${day}`;
};
const mesAtualRange = () => {
  const hoje = new Date();
  const ini = new Date(hoje.getFullYear(), hoje.getMonth(), 1, 12, 0, 0);
  const fim = new Date(hoje.getFullYear(), hoje.getMonth()+1, 0, 12, 0, 0);
  return { ini: dateInputStr(ini), fim: dateInputStr(fim) };
};

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

const _ST_TERMINAL = new Set(["pago","quitacao_antecipada","baixado_como_prejuizo","cancelado","renegociado"]);
const _ST_CONTRATO_EXCLUIDO = new Set(["baixado_como_prejuizo","cancelado","renegociado","recuperado_integralmente","recuperado_parcialmente"]);
const _PDF_CLR = {G:[11,61,46],GL:[110,121,117],DK:[18,24,21],MT:[134,134,133],BDC:[221,227,224]};
function statusEfetivo(p) {
  const st = String(p.STATUS || p.STATUS_PAGAMENTO || "pendente").toLowerCase();
  if (_ST_TERMINAL.has(st)) return st;
  const hoje = new Date(); hoje.setHours(0, 0, 0, 0);
  // DATA_ACORDO futura → reagendado (não aparece em atraso)
  if (p.DATA_ACORDO) {
    const da = parseDate(p.DATA_ACORDO);
    if (da) { da.setHours(0,0,0,0); if (da.getTime() >= hoje.getTime()) return "reagendado"; }
  }
  const dv = parseDate(p.DATA_VENCIMENTO);
  if (!dv) return st;
  dv.setHours(0, 0, 0, 0);
  if (dv.getTime() < hoje.getTime()) return "atrasado";
  if (dv.getTime() === hoje.getTime()) return "vence_hoje";
  return "pendente";
}
const _ST_LABEL = { pago:"Pago", pendente:"Pendente", atrasado:"Atrasado", vence_hoje:"Vence Hoje", baixado_como_prejuizo:"Baixado", cancelado:"Cancelado", quitacao_antecipada:"Quitado", reagendado:"Reagendado" };

function apiDateStr(v){
  const dt = parseDate(v);
  if(!dt) return v || "";
  const y = dt.getFullYear();
  const m = String(dt.getMonth()+1).padStart(2,"0");
  const day = String(dt.getDate()).padStart(2,"0");
  return `${y}-${m}-${day}T12:00:00`;
}
function toNum(d){ if(!d)return 0; const dt=d instanceof Date?d:parseDate(d); if(!dt)return 0; return dt.getFullYear()*10000+(dt.getMonth()+1)*100+dt.getDate(); }
async function postAction(body){ const r=await fetch(POST_URL,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(body)}); return r.json(); }

const IS = ()=>({width:"100%",padding:"10px 13px",background:CARD,border:`1px solid ${BD}`,borderRadius:10,color:TEXT,fontSize:14,boxSizing:"border-box",outline:"none",transition:"border-color 0.15s, box-shadow 0.15s"});
const LS = ()=>({color:MUTED,fontSize:11,fontWeight:700,textTransform:"uppercase",letterSpacing:"0.07em",display:"block",marginBottom:5});

// ── Botões padrão (Design System) ────────────────────────────────
const BTN1 = (dis)=>({padding:"13px 18px",borderRadius:12,border:"none",background:dis?MUTED:ACC,color:"#1B3305",fontWeight:800,fontSize:14,cursor:dis?"not-allowed":"pointer",display:"flex",alignItems:"center",justifyContent:"center",gap:7,opacity:dis?0.55:1,transition:"opacity 0.15s,transform 0.1s"});
const BTN2 = (dis)=>({padding:"12px 18px",borderRadius:12,border:"none",background:"#25D366",color:"#FFF",fontWeight:700,fontSize:14,cursor:dis?"not-allowed":"pointer",display:"flex",alignItems:"center",justifyContent:"center",gap:7,opacity:dis?0.5:1});
const BTN3 = ()=>({padding:"12px 16px",borderRadius:12,border:`1.5px solid ${BD}`,background:CARD,color:TEXT,fontWeight:600,fontSize:14,cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",gap:7});
const BTN4 = (dis)=>({padding:"12px 18px",borderRadius:10,border:"none",background:RED,color:"#FFF",fontWeight:700,fontSize:14,cursor:dis?"not-allowed":"pointer",opacity:dis?0.5:1,display:"flex",alignItems:"center",justifyContent:"center",gap:7});
const BTN5 = (c)=>({padding:"12px 18px",borderRadius:10,border:`1px solid ${c}40`,background:`${c}08`,color:c,fontWeight:700,fontSize:14,cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",gap:8});
const BTN6 = ()=>({padding:"10px 16px",borderRadius:10,border:`1px solid ${BD}`,background:CARD,color:MUTED,fontWeight:600,fontSize:13,cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",gap:6});
const BTN7 = (c)=>({padding:"3px 8px",borderRadius:6,border:"none",background:`${c}18`,color:c,fontWeight:700,fontSize:10,cursor:"pointer"});

const STATUS_LABEL = {
  ativo_em_dia:"Em Dia", ativo_em_atraso:"Em Atraso", em_cobranca:"Em Cobrança",
  pre_prejuizo:"Pré-Prejuízo", baixado_como_prejuizo:"Baixado (Prejuízo)",
  em_recuperacao:"Em Recuperação", recuperado_parcialmente:"Rec. Parcial",
  recuperado_integralmente:"Recuperado", encerrado_sem_recuperacao:"Encerrado s/ Rec.",
  renegociado:"Renegociado", quitado:"Quitado", cancelado:"Cancelado", ativo:"Ativo"
};
const STATUS_COR = {
  ativo_em_dia:GRN, ativo:GRN, ativo_em_atraso:YEL, em_cobranca:ORG,
  pre_prejuizo:RED, baixado_como_prejuizo:RED, em_recuperacao:PUR,
  recuperado_parcialmente:BLU, recuperado_integralmente:GRN,
  encerrado_sem_recuperacao:MUTED, renegociado:BLU, quitado:GRN, cancelado:MUTED
};
const STATUS_PERDA = ["em_cobranca","pre_prejuizo","baixado_como_prejuizo","em_recuperacao","recuperado_parcialmente","encerrado_sem_recuperacao"];

const IcoFin  = <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>;
const IcoDash = <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/></svg>;
const IcoCli  = <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="9" cy="7" r="4"/><path d="M3 21v-2a4 4 0 0 1 4-4h4a4 4 0 0 1 4 4v2"/></svg>;
const IcoCob  = <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07A19.5 19.5 0 0 1 4.19 12"/><polyline points="22,16.92 16,10.92 13,13.92"/></svg>;
const IcoLoss  = <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="22,7 13.5,15.5 8.5,10.5 2,17"/><polyline points="16,7 22,7 22,13"/></svg>;
const IcoIntel = <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M2 20h20"/><path d="m6 16 4-4 4 4 4-8"/><circle cx="6" cy="16" r="1.5" fill="currentColor" stroke="none"/><circle cx="10" cy="12" r="1.5" fill="currentColor" stroke="none"/><circle cx="14" cy="16" r="1.5" fill="currentColor" stroke="none"/><circle cx="18" cy="8" r="1.5" fill="currentColor" stroke="none"/></svg>;
const IcoSim  = <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/><circle cx="20" cy="4" r="3" strokeWidth="1.5"/></svg>;
const IcoBell = <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/></svg>;
const IcoSrch = <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke={MUTED} strokeWidth="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>;
const IcoArr  = <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="9,18 15,12 9,6"/></svg>;
const IcoArrL = <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="15,18 9,12 15,6"/></svg>;
const IcoCtr  = <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14,2 14,8 20,8"/></svg>;
const IcoPag  = <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="2" y="5" width="20" height="14" rx="2"/><line x1="2" y1="10" x2="22" y2="10"/></svg>;
const IcoKpi  = <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/></svg>;
const IcoCal  = <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>;
const IcoEye    = <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>;
const IcoEyeOff = <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/><line x1="1" y1="1" x2="23" y2="23"/></svg>;
const IcoReceipt = <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14,2 14,8 20,8"/><line x1="8" y1="13" x2="16" y2="13"/><line x1="8" y1="17" x2="12" y2="17"/></svg>;
const IcoZap     = <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polygon points="13,2 3,14 12,14 11,22 21,10 12,10 13,2"/></svg>;
const IcoAlert   = <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>;
const IcoPhone   = <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07A19.5 19.5 0 0 1 4.19 12 19.79 19.79 0 0 1 1.12 3.38 2 2 0 0 1 3.1 1.18h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L7.91 8.27a16 16 0 0 0 6.16 6.16l1.17-1.34a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 14.92z"/></svg>;
const IcoSign    = <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>;
const IcoDoc     = <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14,2 14,8 20,8"/></svg>;
const IcoPromise = <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/><polyline points="9,16 11,18 15,14"/></svg>;
const IcoSpinner = ({size=13,color="currentColor"})=><span style={{display:"inline-block",width:size,height:size,borderRadius:"50%",border:`2px solid ${color}40`,borderTopColor:color,animation:"spin 0.7s linear infinite",flexShrink:0}}/>;
const IcoTrendUp = <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="23,6 13.5,15.5 8.5,10.5 1,18"/><polyline points="17,6 23,6 23,12"/></svg>;
const IcoRepeat  = <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="17,1 21,5 17,9"/><path d="M3 11V9a4 4 0 0 1 4-4h14"/><polyline points="7,23 3,19 7,15"/><path d="M21 13v2a4 4 0 0 1-4 4H3"/></svg>;
const IcoWarnTri = <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>;
const IcoLock    = <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>;
const IcoCheck   = <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="20,6 9,17 4,12"/></svg>;
const IcoHandshake = <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M20.42 4.58a5.4 5.4 0 0 0-7.65 0l-.77.78-.77-.78a5.4 5.4 0 0 0-7.65 0C1.46 6.7 1.33 10.28 4 13l8 8 8-8c2.67-2.72 2.54-6.3.42-8.42z"/></svg>;

function Badge({c,children,size="sm"}){ const p=size==="md"?"4px 12px":"3px 10px",fs=size==="md"?11:10; return <span style={{display:"inline-flex",alignItems:"center",gap:4,padding:p,borderRadius:9999,fontSize:fs,fontWeight:700,background:c+"18",color:c,border:`1px solid ${c}28`,lineHeight:1.3,whiteSpace:"nowrap"}}>{children}</span>; }
function isUltima(p,parcs){const id=String(p.ID_CONTRATO);const max=(parcs||[]).reduce((m,pp)=>String(pp.ID_CONTRATO)===id?Math.max(m,parseInt(pp.NUM_PARCELA||0)):m,0);return parseInt(p.NUM_PARCELA||0)===max&&max>0;}

// ─── CALENDÁRIO ──────────────────────────────────────────────────
function CalendarioRange({ de, ate, onSelecionar, onLimpar }) {
  const [mes, setMes] = useState(()=>{ const d=de?new Date(de):new Date(); d.setDate(1); return d; });
  const [step, setStep] = useState(0);
  const [hoverDia, setHoverDia] = useState(null);
  const MESES = ["Janeiro","Fevereiro","Março","Abril","Maio","Junho","Julho","Agosto","Setembro","Outubro","Novembro","Dezembro"];
  const ano=mes.getFullYear(), m=mes.getMonth();
  const totalDias=new Date(ano,m+1,0).getDate();
  const primDia=new Date(ano,m,1).getDay();
  const hoje=new Date(); hoje.setHours(0,0,0,0);
  const celulas=[];
  for(let i=0;i<primDia;i++) celulas.push(null);
  for(let i=1;i<=totalDias;i++) celulas.push(new Date(ano,m,i));
  const dStr=d=>d?d.toLocaleDateString("pt-BR",{day:"2-digit",month:"2-digit",year:"numeric"}):"";
  const TR = "all 0.14s ease-out";
  function clicar(d){
    if(step===0){ onSelecionar(d,null); setStep(1); setHoverDia(null); }
    else{ if(d<de){onSelecionar(d,de);}else{onSelecionar(de,d);} setStep(0); setHoverDia(null); }
  }
  const ehIni=d=>de&&d.getTime()===de.getTime();
  const ehFim=d=>ate&&d.getTime()===ate.getTime();
  const noRange=d=>de&&ate&&d>de&&d<ate;
  const ehHoje=d=>d.getTime()===hoje.getTime();
  function noPreview(d){ if(step!==1||!de||!hoverDia)return false; const [mn,mx]=hoverDia<de?[hoverDia,de]:[de,hoverDia]; return d>mn&&d<mx; }
  function ehPrvIni(d){ if(step!==1||!de||!hoverDia)return false; const [mn]=hoverDia<de?[hoverDia,de]:[de,hoverDia]; return d.getTime()===mn.getTime(); }
  function ehPrvFim(d){ if(step!==1||!de||!hoverDia)return false; const [,mx]=hoverDia<de?[hoverDia,de]:[de,hoverDia]; return d.getTime()===mx.getTime(); }
  function atalho(ini,fim){ const a=new Date(ini);a.setHours(0,0,0,0);const b=new Date(fim);b.setHours(0,0,0,0);onSelecionar(a,b);setStep(0);setHoverDia(null);const nav=new Date(a);nav.setDate(1);setMes(nav); }
  const NavBtn=({onClick,children})=>(
    <button onClick={onClick} style={{width:32,height:32,borderRadius:8,border:`1px solid ${BD}`,background:"transparent",cursor:"pointer",color:MUTED,display:"flex",alignItems:"center",justifyContent:"center",transition:TR,outline:"none",flexShrink:0}}
      onMouseEnter={e=>{e.currentTarget.style.background=BG;e.currentTarget.style.color=TEXT;e.currentTarget.style.borderColor=BD;}}
      onMouseLeave={e=>{e.currentTarget.style.background="transparent";e.currentTarget.style.color=MUTED;}}
      onFocus={e=>{e.currentTarget.style.outline=`2px solid ${BLU}50`;e.currentTarget.style.outlineOffset="2px";}}
      onBlur={e=>{e.currentTarget.style.outline="none";}}
    >{children}</button>
  );
  return (
    <div style={{background:CARD,border:`1px solid ${BD}`,borderRadius:16,boxShadow:SHD+",0 16px 48px rgba(0,0,0,0.16)",padding:"16px 16px 12px",minWidth:316,animation:"fadeUp 160ms cubic-bezier(0.16,1,0.3,1) both"}}>
      {/* Atalhos rápidos */}
      <div style={{display:"flex",gap:5,marginBottom:12}}>
        {[
          {l:"Hoje",     fn:()=>{const d=new Date();atalho(d,d);}},
          {l:"Ontem",    fn:()=>{const d=new Date();d.setDate(d.getDate()-1);atalho(d,d);}},
          {l:"Mês atual",fn:()=>{const h=new Date();atalho(new Date(h.getFullYear(),h.getMonth(),1),new Date(h.getFullYear(),h.getMonth()+1,0));}},
        ].map(a=>(
          <button key={a.l} onClick={a.fn}
            style={{flex:1,padding:"7px 0",borderRadius:8,border:`1px solid ${BD}`,background:BG,color:MUTED,fontSize:11,fontWeight:600,cursor:"pointer",transition:TR}}
            onMouseEnter={e=>{e.currentTarget.style.background=GRN+"14";e.currentTarget.style.borderColor=GRN+"40";e.currentTarget.style.color=GRN;}}
            onMouseLeave={e=>{e.currentTarget.style.background=BG;e.currentTarget.style.borderColor=BD;e.currentTarget.style.color=MUTED;}}
          >{a.l}</button>
        ))}
      </div>
      {/* Indicador de etapa */}
      <div style={{display:"flex",justifyContent:"center",marginBottom:12}}>
        <span style={{display:"inline-flex",alignItems:"center",gap:6,padding:"4px 12px",borderRadius:20,background:step===0?BLU+"15":GRN+"15",color:step===0?BLU:GRN,fontSize:11,fontWeight:700,transition:TR}}>
          <span style={{width:6,height:6,borderRadius:"50%",background:step===0?BLU:GRN,flexShrink:0,transition:TR}}/>
          {step===0?"Selecione a data inicial":"Selecione a data final"}
        </span>
      </div>
      {/* Navegação mês */}
      <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:10}}>
        <NavBtn onClick={()=>{const d=new Date(mes);d.setMonth(d.getMonth()-1);setMes(d);}}>
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="15,18 9,12 15,6"/></svg>
        </NavBtn>
        <div style={{display:"flex",alignItems:"center",gap:7}}>
          <span style={{fontWeight:800,fontSize:14,color:TEXT,letterSpacing:"-0.2px"}}>{MESES[m]}</span>
          <select value={ano} onChange={e=>{const d=new Date(mes);d.setFullYear(parseInt(e.target.value));setMes(d);}}
            style={{fontWeight:700,fontSize:13,border:`1px solid ${BD}`,borderRadius:7,padding:"3px 6px",background:BG,color:TEXT,cursor:"pointer",outline:"none",transition:TR}}>
            {Array.from({length:15},(_,i)=>new Date().getFullYear()-10+i).map(y=><option key={y} value={y}>{y}</option>)}
          </select>
        </div>
        <NavBtn onClick={()=>{const d=new Date(mes);d.setMonth(d.getMonth()+1);setMes(d);}}>
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="9,18 15,12 9,6"/></svg>
        </NavBtn>
      </div>
      {/* Header dias semana */}
      <div style={{display:"grid",gridTemplateColumns:"repeat(7,1fr)",marginBottom:4}}>
        {["D","S","T","Q","Q","S","S"].map((d,i)=>(
          <div key={i} style={{textAlign:"center",fontSize:10,fontWeight:700,color:i===0||i===6?MUTED+"80":MUTED,padding:"3px 0",letterSpacing:"0.06em"}}>{d}</div>
        ))}
      </div>
      {/* Grid dias */}
      <div style={{display:"grid",gridTemplateColumns:"repeat(7,1fr)",gap:2}}>
        {celulas.map((d,i)=>{
          if(!d) return <div key={i}/>;
          const ini=ehIni(d),fim=ehFim(d),dentro=noRange(d),hj=ehHoje(d),ativo=ini||fim;
          const prvIni=ehPrvIni(d),prvFim=ehPrvFim(d),prvDentro=noPreview(d),emPreview=prvIni||prvFim;
          let bg="transparent", cor=TEXT;
          if(ativo){ bg=GRN; cor="#fff"; }
          else if(emPreview){ bg=GRN+"45"; cor=GRN; }
          else if(dentro){ bg=GRN+"1A"; }
          else if(prvDentro){ bg=GRN+"0E"; }
          const isEdge=ini||fim||prvIni||prvFim;
          const isMid=dentro||prvDentro;
          const br=ini||prvIni?"8px 0 0 8px":fim||prvFim?"0 8px 8px 0":isMid?"0":"8px";
          return(
            <button key={i} onClick={()=>clicar(d)}
              onMouseEnter={()=>step===1&&setHoverDia(d)}
              onMouseLeave={()=>step===1&&setHoverDia(null)}
              style={{width:"100%",aspectRatio:"1",borderRadius:br,border:"none",background:bg,color:ativo?"#fff":hj&&!dentro&&!isMid?GRN:cor,fontWeight:ativo||hj?700:400,fontSize:12,cursor:"pointer",position:"relative",outline:"none",transition:"background 0.1s ease-out, color 0.1s ease-out",display:"flex",alignItems:"center",justifyContent:"center",minHeight:36}}
              onFocus={e=>{if(!ativo)e.currentTarget.style.outline=`2px solid ${BLU}50`;e.currentTarget.style.outlineOffset="1px";}}
              onBlur={e=>{e.currentTarget.style.outline="none";}}
            >
              <span style={{position:"relative",zIndex:1}}>{d.getDate()}</span>
              {hj&&<span style={{position:"absolute",bottom:3,left:"50%",transform:"translateX(-50%)",width:4,height:4,borderRadius:"50%",background:ativo?"rgba(255,255,255,0.7)":GRN}}/>}
            </button>
          );
        })}
      </div>
      {/* Rodapé range */}
      {(de||ate)&&(
        <div style={{marginTop:12,paddingTop:10,borderTop:`1px solid ${BD}`,display:"flex",justifyContent:"space-between",alignItems:"center"}}>
          <span style={{fontSize:11,color:MUTED,display:"flex",alignItems:"center",gap:5}}>
            <span style={{display:"inline-flex",alignItems:"center",justifyContent:"center",width:14,height:14,borderRadius:"50%",background:GRN+"20",color:GRN,fontSize:8,fontWeight:900,flexShrink:0}}>✓</span>
            <span>{dStr(de)}</span>
            {ate&&<><span style={{color:GRN,fontWeight:700}}>→</span><span>{dStr(ate)}</span></>}
          </span>
          <button onClick={()=>{onLimpar();setStep(0);setHoverDia(null);}}
            style={{fontSize:11,color:MUTED,background:"none",border:"none",cursor:"pointer",fontWeight:600,padding:"3px 8px",borderRadius:6,transition:TR}}
            onMouseEnter={e=>{e.currentTarget.style.color=RED;e.currentTarget.style.background=RED+"12";}}
            onMouseLeave={e=>{e.currentTarget.style.color=MUTED;e.currentTarget.style.background="none";}}
          >Limpar</button>
        </div>
      )}
    </div>
  );
}

// ─── HELPER: TABELA DE HISTÓRICO DE PARCELAS NO PDF ──────────────
function _pdfBrandHeader(doc,W,pd,titulo,G,DK,GL,MT,BDC){
  const SG=[31,184,119],DST=[7,36,27];
  let y=13;
  // Logo mark (two overlapping rounded squares)
  doc.setFillColor(...SG);doc.roundedRect(pd,y,9,9,2,2,'F');
  doc.setFillColor(...G);doc.roundedRect(pd+6,y+6,9,9,2,2,'F');
  doc.setFillColor(...DST);doc.roundedRect(pd+6,y+6,3.5,3.5,0.8,0.8,'F');
  // Brand name
  doc.setFont('helvetica','bold');doc.setFontSize(15);doc.setTextColor(...DK);
  doc.text('BORGES ASSESSORIA',pd+17,y+6.5);
  doc.setFont('helvetica','normal');doc.setFontSize(7);doc.setTextColor(...GL);
  doc.text('Crédito Privado · Gestão de Contratos',pd+17,y+11.5);
  // Company info right-aligned
  ['Borges Assessoria Financeira','CNPJ: 63.124.205/0001-07','borgesassessoriafinanceira@gmail.com','Tel/WPP: (62) 98487-7843'].forEach((l,i)=>{
    doc.setFont('helvetica','normal');doc.setFontSize(7);doc.setTextColor(...MT);
    doc.text(l,W-pd,y+i*3.8,{align:'right'});
  });
  y+=17;
  // Document type label
  doc.setFont('helvetica','bold');doc.setFontSize(7.5);doc.setTextColor(...GL);
  doc.text(titulo,pd,y);
  y+=4;
  // Thin divider
  doc.setDrawColor(...BDC);doc.setLineWidth(0.4);doc.line(pd,y,W-pd,y);
  return y+7;
}

function _renderHistParcelas(doc,rows,W,pd,y,GL,DK,BDC,fD,fR,title='HISTÓRICO DE PARCELAS'){
  const G=[11,61,46],LGR=[247,249,248];
  const tipoMap={pagamento_normal:'Normal',normal:'Normal',pagamento_com_atraso:'Com Atraso',com_atraso:'Com Atraso',somente_juros:'Só Juros',quitacao_antecipada:'Quitação Ant.',pagamento_antecipado:'Antecipado',antecipado:'Antecipado',recuperacao_apos_baixa:'Recuperação',acordo_com_perda:'Acordo'};
  const cols=[
    {label:'#',w:12,key:'NUM_PARCELA',fmt:v=>String(v||'—')},
    {label:'Vencimento',w:28,key:'DATA_VENCIMENTO',fmt:fD},
    {label:'Valor Parcela',w:30,key:'VALOR_PARCELA',fmt:fR},
    {label:'Data Pagamento',w:30,key:'DATA_PAGAMENTO',fmt:fD},
    {label:'Valor Pago',w:30,key:'VALOR_PAGO',fmt:fR},
    {label:'Tipo',w:48,key:'TIPO_PAGAMENTO',fmt:v=>tipoMap[String(v||'').toLowerCase()]||String(v||'—')},
  ];
  const tableW=W-2*pd;const rH=7;const hH=6;
  doc.setFillColor(221,227,224);doc.setDrawColor(...BDC);doc.setLineWidth(0.3);
  doc.roundedRect(pd,y,tableW,8,2,2,'FD');
  doc.setFont('helvetica','bold');doc.setFontSize(8);doc.setTextColor(...DK);
  doc.text(title,pd+4,y+5.5);
  y+=10;
  doc.setFillColor(...G);doc.rect(pd,y,tableW,hH,'F');
  let x=pd;cols.forEach(c=>{doc.setFont('helvetica','bold');doc.setFontSize(6.5);doc.setTextColor(255,255,255);doc.text(c.label,x+2,y+4.5);x+=c.w;});
  y+=hH;
  rows.forEach((row,i)=>{
    if(y+rH>285){
      doc.addPage();y=18;
      doc.setFillColor(...G);doc.rect(pd,y,tableW,hH,'F');
      let xx=pd;cols.forEach(c=>{doc.setFont('helvetica','bold');doc.setFontSize(6.5);doc.setTextColor(255,255,255);doc.text(c.label,xx+2,y+4.5);xx+=c.w;});
      y+=hH;
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
  try{
    const contrato=(contratos||[]).find(c=>String(c.ID_CONTRATO||"").trim()===String(parcela.ID_CONTRATO||"").trim());
    const cliente=(clientes||[]).find(c=>String(c.ID_CLIENTE||"").trim()===String(parcela.ID_CLIENTE||"").trim());
    const telefone=String(cliente?.TELEFONE_WPP||cliente?.TELEFONE||"").replace(/\D/g,"");
    const hist=(parcelas||[]).filter(p=>String(p.ID_CONTRATO||"").trim()===String(parcela.ID_CONTRATO||"").trim()).sort((a,b)=>parseInt(a.NUM_PARCELA||0)-parseInt(b.NUM_PARCELA||0));
    const pNum=parseInt(parcela.NUM_PARCELA||0);
    const isSomenteJuros=tipoLabel==="Somente Juros";
    // detecta se hist já tem o resultado deste pagamento (dados pós-pagamento)
    const currentInHist=hist.find(p=>String(p.ID_PARCELA||"").trim()===String(parcela.ID_PARCELA||"").trim());
    const isAlreadyProcessed=isSomenteJuros&&!!currentInHist&&String(currentInHist.TIPO_PAGAMENTO||"").toLowerCase()==="somente_juros";
    const somenteJurosInHist=hist.filter(p=>String(p.TIPO_PAGAMENTO||"").toLowerCase()==="somente_juros").length;
    // se pós-pagamento: hist.length já inclui a nova parcela, não soma +1
    const totalParcEfetivo=(isSomenteJuros&&!isAlreadyProcessed)?hist.length+1:hist.length;
    const totalAdded=(isSomenteJuros&&!isAlreadyProcessed)?somenteJurosInHist+1:somenteJurosInHist;
    const originalParc=totalParcEfetivo-totalAdded;
    const fD=d=>{if(!d)return'—';const dt=d instanceof Date?d:parseDate(d);return dt&&!isNaN(dt)?dt.toLocaleDateString('pt-BR'):'—';};
    const fR=fmtR;
    const now=new Date();
    const pagas=hist.filter(p=>["pago","quitacao_antecipada"].includes(String(p.STATUS||p.STATUS_PAGAMENTO||"").toLowerCase()));
    const jaEstavaPaga=pagas.some(p=>String(p.NUM_PARCELA)===String(pNum));
    const totalJaPago=pagas.reduce((s,p)=>s+parseFloat(p.VALOR_PAGO||0),0)+(jaEstavaPaga?0:parseFloat(valorPago||0));
    const parcelasRestantes=Math.max(0,totalParcEfetivo-(pagas.length+(jaEstavaPaga?0:1)));
    const valorParcOrig=parseFloat(hist[0]?.VALOR_PARCELA||0);
    const saldo=Math.max(0,parcelasRestantes*valorParcOrig);
    const valorOriginal=parseFloat(contrato?.VALOR_PRINCIPAL||contrato?.VALOR_TOTAL||0);
    const isQuitado=parcelasRestantes===0;
    const ts=`${now.getFullYear()}${String(now.getMonth()+1).padStart(2,'0')}${String(now.getDate()).padStart(2,'0')}${String(now.getHours()).padStart(2,'0')}${String(now.getMinutes()).padStart(2,'0')}`;
    const nomeArq=isQuitado?`comprovante-quitacao-${parcela.ID_CONTRATO}-${ts}.pdf`:`comprovante-${parcela.ID_CONTRATO}-P${pNum}-${ts}.pdf`;
    const doc=new jsPDF({unit:'mm',format:'a4'});
    const W=210,pd=16;
    const {G,GL,DK,MT,BDC}=_PDF_CLR;
    let y=_pdfBrandHeader(doc,W,pd,isQuitado?'COMPROVANTE DE QUITAÇÃO DE CONTRATO':'COMPROVANTE DE PAGAMENTO DE PARCELA',G,DK,GL,MT,BDC);
    doc.setFillColor(...G);doc.roundedRect(pd,y,W-2*pd,11,2,2,'F');
    doc.setFont('helvetica','bold');doc.setFontSize(11);doc.setTextColor(255,255,255);doc.text(isQuitado?'CONTRATO QUITADO':'PAGAMENTO CONFIRMADO',W/2,y+7.5,{align:'center'});
    y+=19;
    const sect=(title,rows)=>{
      const rH=11,sH=9+rows.length*rH+2;
      doc.setDrawColor(...BDC);doc.setLineWidth(0.3);doc.roundedRect(pd,y,W-2*pd,sH,3,3,'D');
      doc.setFont('helvetica','bold');doc.setFontSize(8);doc.setTextColor(...DK);doc.text(title,pd+4,y+5.5);
      doc.setDrawColor(...BDC);doc.setLineWidth(0.2);doc.line(pd,y+8,W-pd,y+8);
      let ry=y+12;const mx=pd+(W-2*pd)/2;
      rows.forEach(r=>{
        doc.setFont('helvetica','bold');doc.setFontSize(7);doc.setTextColor(...GL);if(r.ll)doc.text(r.ll,pd+4,ry);
        doc.setFont('helvetica',r.lvB?'bold':'normal');doc.setFontSize(8.5);doc.setTextColor(...DK);doc.text(r.lv||'—',pd+4,ry+4.5);
        if(r.rl){doc.setFont('helvetica','bold');doc.setFontSize(7);doc.setTextColor(...GL);doc.text(r.rl,mx+4,ry);
          doc.setFont('helvetica','normal');doc.setFontSize(8.5);doc.setTextColor(...DK);doc.text(r.rv||'—',mx+4,ry+4.5);}
        ry+=rH;
      });
      y+=sH+5;
    };
    const nome=String(parcela.NOME_CLIENTE||cliente?.NOME_CLIENTE||cliente?.NOME||'—');
    sect('DADOS DO CLIENTE E DO CONTRATO',[
      {ll:'NOME DO CLIENTE',lv:nome,rl:'NÚMERO DO CONTRATO',rv:String(parcela.ID_CONTRATO)},
      {ll:'CPF',lv:String(cliente?.CPF||'—'),rl:'DATA DO CONTRATO',rv:fD(contrato?.DATA_EMPRESTIMO||contrato?.DATA_CONTRATO)},
    ]);
    const tipoLabelToKey={'Somente Juros':'somente_juros','Com Atraso':'pagamento_com_atraso','Quitação Antecipada':'quitacao_antecipada','Antecipado':'pagamento_antecipado'};
    if(isQuitado){
      const datas=hist.map(p=>parseDate(p.DATA_PAGAMENTO)).filter(Boolean);
      const ultPag=datas.length?datas.reduce((a,b)=>a>b?a:b):null;
      const parcPagas=pagas.length+(jaEstavaPaga?0:1);
      sect('DETALHES DA QUITAÇÃO',[
        {ll:'TOTAL DE PARCELAS',lv:String(totalParcEfetivo),rl:'DATA DA ÚLTIMA PARCELA',rv:fD(ultPag||dataPago)},
        {ll:'VALOR TOTAL PAGO',lv:fR(totalJaPago),lvB:true,rl:'STATUS',rv:'QUITADO'},
      ]);
      sect('RESUMO FINANCEIRO',[
        {ll:'VALOR ORIGINAL DO CONTRATO',lv:fR(valorOriginal),rl:'PARCELAS PAGAS',rv:String(parcPagas)+' de '+String(totalParcEfetivo)},
        {ll:'VALOR TOTAL PAGO',lv:fR(totalJaPago),rl:'SALDO REMANESCENTE',rv:'R$ 0,00'},
      ]);
      const histRows=[...pagas];
      if(!jaEstavaPaga)histRows.push({...parcela,VALOR_PAGO:valorPago,DATA_PAGAMENTO:dataPago,TIPO_PAGAMENTO:tipoLabelToKey[tipoLabel]||'pagamento_normal'});
      histRows.sort((a,b)=>parseInt(a.NUM_PARCELA||0)-parseInt(b.NUM_PARCELA||0));
      y=_renderHistParcelas(doc,histRows,W,pd,y,GL,DK,BDC,fD,fR);
    }else{
      sect('DETALHES DO PAGAMENTO',[
        {ll:'PARCELA PAGA',lv:`${pNum} de ${totalParcEfetivo}`,rl:'DATA DE VENCIMENTO',rv:fD(parcela.DATA_VENCIMENTO)},
        {ll:'VALOR DA PARCELA',lv:fR(valorPago),lvB:true,rl:'DATA DO PAGAMENTO',rv:fD(dataPago)},
        {ll:'FORMA DE PAGAMENTO',lv:String(tipoLabel||'—'),rl:'CÓDIGO DE TRANSAÇÃO',rv:String(parcela.ID_PARCELA||'—')},
      ]);
      sect('RESUMO FINANCEIRO ATUALIZADO',[
        {ll:'VALOR TOTAL DO EMPRÉSTIMO',lv:fR(valorOriginal),rl:'PARCELAS RESTANTES',rv:String(parcelasRestantes)},
        {ll:'VALOR TOTAL JÁ PAGO',lv:fR(totalJaPago),rl:'SALDO DEVEDOR ESTIMADO',rv:fR(saldo)},
        ...(isSomenteJuros?[{ll:'CONTRATO: ORIGINAL / ATUAL',lv:`${originalParc} / ${totalParcEfetivo} parcelas`,rl:'PARCELAS ADICIONADAS',rv:`${totalAdded} (somente juros)`}]:[]),
      ]);
      if(isSomenteJuros){
        doc.setFillColor(254,243,199);doc.roundedRect(pd,y,W-2*pd,18,2,2,'F');
        doc.setFont('helvetica','bold');doc.setFontSize(8);doc.setTextColor(146,64,14);
        doc.text('CONTRATO ATUALIZADO',pd+4,y+6);
        doc.setFont('helvetica','normal');doc.setFontSize(7.5);doc.setTextColor(120,53,15);
        const aviso=`Contrato original: ${originalParc} parcelas. Foram adicionadas ${totalAdded} parcelas por pagamentos de somente juros (principal rolado). Total atual do contrato: ${totalParcEfetivo} parcelas.`;
        const avisoL=doc.splitTextToSize(aviso,W-2*pd-8);doc.text(avisoL,pd+4,y+11);
        y+=avisoL.length*4.5+14;
      }
      y=_renderHistParcelas(doc,[{NUM_PARCELA:parcela.NUM_PARCELA,DATA_VENCIMENTO:parcela.DATA_VENCIMENTO,VALOR_PARCELA:parcela.VALOR_PARCELA,DATA_PAGAMENTO:dataPago,VALOR_PAGO:valorPago,TIPO_PAGAMENTO:tipoLabelToKey[tipoLabel]||'pagamento_normal'}],W,pd,y,GL,DK,BDC,fD,fR,'DETALHE DA PARCELA PAGA');
    }
    y+=2;
    const qt=isQuitado
      ?'"Declaramos, para os devidos fins, que todos os pagamentos referentes ao contrato acima identificado foram recebidos e registrados, confirmando a quitação integral da dívida."'
      :'"Declaramos, para os devidos fins, que o pagamento acima identificado foi recebido e registrado em nosso controle interno, referente à parcela informada neste comprovante."';
    doc.setFont('helvetica','italic');doc.setFontSize(8.5);doc.setTextColor(...MT);
    const qtL=doc.splitTextToSize(qt,W-2*pd-8);doc.text(qtL,W/2,y,{align:'center'});y+=qtL.length*5+7;
    doc.setFont('helvetica','normal');doc.setFontSize(7.5);doc.setTextColor(...MT);
    doc.text(`Documento emitido em: ${now.toLocaleDateString('pt-BR')}`,W/2,y,{align:'center'});y+=6;
    const ds=isQuitado
      ?'Este comprovante confirma a quitação integral do contrato identificado acima, sendo válido como prova de liquidação total da dívida contratada.'
      :'Este comprovante confirma exclusivamente o recebimento da parcela indicada, não representando quitação total do contrato, salvo quando expressamente informado.';
    doc.setFont('helvetica','bold');doc.setFontSize(7.5);doc.setTextColor(...DK);
    const dsL=doc.splitTextToSize(ds,W-2*pd-8);doc.text(dsL,W/2,y,{align:'center'});y+=dsL.length*5+5;
    doc.setFont('helvetica','bold');doc.setFontSize(8);doc.setTextColor(...GL);doc.text('Borges Assessoria · Crédito Privado',W/2,y,{align:'center'});
    const blob=doc.output('blob');const url=URL.createObjectURL(blob);
    const a=document.createElement('a');a.href=url;a.download=nomeArq;document.body.appendChild(a);a.click();document.body.removeChild(a);setTimeout(()=>URL.revokeObjectURL(url),3000);
    if(opts.wpp){const tel=telefone?`55${telefone}`:'';const isMobile=/iPhone|iPad|iPod|Android/i.test(navigator.userAgent);const wppUrl=tel?`https://wa.me/${tel}`:(isMobile?'https://wa.me':'https://web.whatsapp.com');setTimeout(()=>window.open(wppUrl,'_blank'),700);}
  }catch(e){console.error('Comprovante error:',e);alert('Erro ao gerar comprovante: '+e.message);}
}

function ComprovanteEnvioModal({parcela,valorPago,dataPago,tipoLabel,parcelas,contratos,clientes,onFechar}){
  const fD=d=>{if(!d)return'—';const dt=d instanceof Date?d:parseDate(d);return dt&&!isNaN(dt)?dt.toLocaleDateString('pt-BR'):'—';};
  return(
    <div className="modal-overlay-anim" style={{position:"fixed",inset:0,zIndex:500,background:"rgba(0,0,0,0.5)",display:"flex",alignItems:"center",justifyContent:"center",padding:20}}>
      <div className="modal-box-anim" style={{width:"100%",maxWidth:380,background:CARD,borderRadius:16,border:`1px solid ${BD}`,boxShadow:"0 24px 80px rgba(0,0,0,0.28)",overflow:"hidden",minWidth:0}}>
        <div style={{background:GRN,padding:"20px 24px",textAlign:"center"}}>
          <div style={{width:44,height:44,borderRadius:"50%",background:"rgba(255,255,255,0.2)",display:"flex",alignItems:"center",justifyContent:"center",margin:"0 auto 10px"}}>
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.5"><polyline points="20,6 9,17 4,12"/></svg>
          </div>
          <div style={{color:"#FFF",fontWeight:800,fontSize:17,letterSpacing:"-0.02em"}}>Pagamento registrado!</div>
          <div style={{color:"rgba(255,255,255,0.75)",fontSize:12,marginTop:4}}>{parcela.NOME_CLIENTE} · {parcela.ID_CONTRATO} · Parcela {parcela.NUM_PARCELA}</div>
        </div>
        <div style={{padding:"18px 20px",display:"flex",flexDirection:"column",gap:12}}>
          <div style={{background:BG,borderRadius:12,padding:"14px 16px",display:"grid",gridTemplateColumns:"1fr 1fr",gap:12}}>
            <div><div style={LS()}>Valor pago</div><div style={{fontWeight:800,fontSize:15,color:GRN}}>{fmtR(valorPago)}</div></div>
            <div><div style={LS()}>Data</div><div style={{fontWeight:700,fontSize:13,color:TEXT}}>{fD(dataPago)}</div></div>
            <div><div style={LS()}>Tipo</div><div style={{fontWeight:700,fontSize:13,color:TEXT}}>{tipoLabel}</div></div>
            <div><div style={LS()}>Vencimento</div><div style={{fontWeight:700,fontSize:13,color:TEXT}}>{fD(parcela.DATA_VENCIMENTO)}</div></div>
          </div>
          <div style={{display:"flex",flexDirection:"column",gap:8}}>
            <button onClick={()=>gerarEEnviarComprovante(parcela,valorPago,dataPago,tipoLabel,parcelas,contratos,clientes,{wpp:false})} style={{...BTN3(),justifyContent:"center"}}>
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
              Salvar comprovante (PDF)
            </button>
            <button onClick={()=>{gerarEEnviarComprovante(parcela,valorPago,dataPago,tipoLabel,parcelas,contratos,clientes,{wpp:true});setTimeout(onFechar,800);}} style={BTN2(false)}>{IcoPhone} Enviar pelo WhatsApp</button>
            <button onClick={onFechar} style={BTN6()}>Fechar</button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── MODAL COBRANÇA ──────────────────────────────────────────────
// Abre ao clicar numa linha da fila de cobrança.
// Coluna esquerda: parcelas em atraso do cliente.
// Coluna direita:  formulário de pagamento para a parcela selecionada.
function CobrancaModal({ cliente, parcelasCliente, todasParcelas, contratos, onSucesso, onFechar }) {
  const MULTA_PCT   = 10;      // 10% sobre o valor da parcela
  const MORA_DIARIO = 0.033;   // 0.033% ao dia

  const [parcelaSel, setParcelaSel] = useState(null);
  const [tipo, setTipo]             = useState("total");
  const [data, setData]             = useState(hojeStr());
  const [valor, setValor]           = useState("");
  const [loading, setLoading]       = useState(false);
  const [msg, setMsg]               = useState(null);
  const [pagoIds, setPagoIds]       = useState(new Set());
  const [comprovanteData, setComprovanteData] = useState(null);
  const [modo, setModo]             = useState("pagamento"); // "pagamento" | "reagendar"
  const [promData, setPromData]     = useState("");
  const [promObs, setPromObs]       = useState("");
  const mob = useIsMobile();

  const calcComAtraso = (p) => {
    const vOrig = parseFloat(p.VALOR_PARCELA || 0);
    const dias  = Math.max(0, p.DIAS_ATRASO || 0);
    const multa = vOrig * MULTA_PCT / 100;
    const mora  = vOrig * MORA_DIARIO / 100 * dias;
    return { vOrig, multa, mora, total: vOrig + multa + mora };
  };

  const selecionarParcela = (p) => {
    setParcelaSel(p);
    setTipo("total");
    setMsg(null);
    setModo("pagamento");
    setPromData("");
    setPromObs("");
    const { total } = calcComAtraso(p);
    setValor(total.toFixed(2));
  };

  const changeTipo = (t) => {
    setTipo(t);
    if (!parcelaSel) return;
    if (t === "total") {
      const { total } = calcComAtraso(parcelaSel);
      setValor(total.toFixed(2));
    } else if (t === "somente_juros") {
      setValor(parseFloat(parcelaSel.VALOR_JUROS || 0).toFixed(2));
    } else {
      setValor(parseFloat(parcelaSel.VALOR_PARCELA || 0).toFixed(2));
    }
  };

  const reagendar = async () => {
    if (!promData || !parcelaSel) return;
    setLoading(true); setMsg(null);
    const res = await postAction({action:"registrarPromessa", dados:{
      idContrato: parcelaSel.ID_CONTRATO,
      idCliente: parcelaSel.ID_CLIENTE,
      idParcela: parcelaSel.ID_PARCELA,
      nomeCliente: parcelaSel.NOME_CLIENTE || "",
      dataPrevista: promData,
      valorPrometido: parseFloat(parcelaSel.VALOR_PARCELA || 0),
      observacao: promObs || `Promessa ref. Parcela ${parcelaSel.NUM_PARCELA}`
    }});
    if(res.ok){ setMsg({ok:true,t:"Promessa registrada!"}); setTimeout(()=>{setModo("pagamento");setPromData("");setPromObs("");setMsg(null);},1500); }
    else setMsg({ok:false, t:res.erro||"Erro."});
    setLoading(false);
  };

  const registrar = async () => {
    if (!parcelaSel || !valor || !data) return;
    setLoading(true); setMsg(null);
    const action = tipo === "somente_juros" ? "pagamentoParcial" : "pagamento";
    const res = await postAction({
      action,
      idParcela: parcelaSel.ID_PARCELA,
      valor: parseFloat(valor),
      data: apiDateStr(data),
      forma: "dinheiro"
    });
    if (res.ok) {
      setPagoIds(prev => new Set([...prev, parcelaSel.ID_PARCELA]));
      setComprovanteData({parcela:parcelaSel,valorPago:parseFloat(valor),dataPago:data,tipoLabel:tipo==="somente_juros"?"Somente Juros":tipo==="com_atraso"?"Com Atraso":"Pagamento Total"});
    } else {
      setMsg({ ok: false, t: res.erro || "Erro ao registrar pagamento." });
    }
    setLoading(false);
  };

  const nome         = cliente?.NOME_CLIENTE || "Cliente";
  const tel          = cliente?.TELEFONE || "—";
  const parcelas     = parcelasCliente.filter(p => !pagoIds.has(p.ID_PARCELA));
  const totalAtraso  = parcelas.reduce((s, p) => s + parseFloat(p.VALOR_PARCELA || 0), 0);

  return (
    <>
    <div
      className="modal-overlay-anim" style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.5)",zIndex:300,display:"flex",alignItems:"center",justifyContent:"center",padding:mob?0:16}}
      onClick={onFechar}
    >
      <div
        onClick={e => e.stopPropagation()}
        className="modal-box-anim" style={{background:CARD,borderRadius:mob?0:16,width:"100%",maxWidth:mob?undefined:860,maxHeight:mob?"100dvh":"92vh",display:"flex",flexDirection:"column",boxShadow:"0 30px 90px rgba(0,0,0,0.32)",border:mob?"none":`1px solid ${BD}`,overflow:"hidden",minWidth:0}}
      >
        {/* HEADER */}
        <div style={{background:CARD,padding:"16px 22px",borderBottom:`1px solid ${BD}`,display:"flex",justifyContent:"space-between",alignItems:"center",gap:12}}>
          <div style={{display:"flex",alignItems:"center",gap:14}}>
            <div style={{width:44,height:44,background:RED+"15",borderRadius:12,display:"flex",alignItems:"center",justifyContent:"center",color:RED,fontSize:20,fontWeight:800,flexShrink:0}}>
              {nome[0]?.toUpperCase() || "?"}
            </div>
            <div>
              <div style={{fontSize:16,fontWeight:800,color:TEXT}}>{nome}</div>
              <div style={{fontSize:12,color:MUTED,marginTop:2}}>ID {cliente?.ID_CLIENTE || "—"} · {tel}</div>
            </div>
          </div>
          <div style={{display:"flex",alignItems:"center",gap:16}}>
            <div style={{textAlign:"right"}}>
              <div style={{fontSize:10,color:MUTED,fontWeight:700,textTransform:"uppercase",letterSpacing:"0.04em"}}>Total em Atraso</div>
              <div style={{fontSize:20,fontWeight:900,color:RED,letterSpacing:"0.3px"}}>{fmtR(totalAtraso)}</div>
            </div>
            <button onClick={onFechar} style={{background:BG,border:`1px solid ${BD}`,width:34,height:34,borderRadius:8,cursor:"pointer",fontSize:18,color:MUTED,display:"flex",alignItems:"center",justifyContent:"center",fontWeight:700}}>×</button>
          </div>
        </div>

        {/* BODY — 2 colunas */}
        <div style={{display:"flex",flexDirection:mob?"column":"row",flex:1,overflow:mob?"auto":"hidden",minHeight:0}}>

          {/* COLUNA ESQUERDA — parcelas em atraso */}
          <div style={{overflowY:"auto",padding:18,borderRight:mob?undefined:`1px solid ${BD}`,borderBottom:mob?`1px solid ${BD}`:undefined,maxHeight:mob?240:undefined}}>
            <div style={{fontSize:11,fontWeight:700,color:MUTED,textTransform:"uppercase",letterSpacing:"0.05em",marginBottom:12}}>
              Parcelas em Atraso ({parcelas.length})
            </div>
            {parcelas.length === 0 ? (
              <div style={{padding:20,textAlign:"center",color:GRN,fontWeight:700,fontSize:13}}>
                ✓ Nenhuma parcela em atraso
              </div>
            ) : (
              <div style={{display:"flex",flexDirection:"column",gap:10}}>
                {parcelas.map(p => {
                  const isSel = parcelaSel?.ID_PARCELA === p.ID_PARCELA;
                  const { vOrig, multa, mora, total } = calcComAtraso(p);
                  const diasCor = p.DIAS_ATRASO > 60 ? RED : p.DIAS_ATRASO > 30 ? ORG : YEL;
                  return (
                    <div
                      key={p.ID_PARCELA}
                      onClick={() => selecionarParcela(p)}
                      style={{padding:14,borderRadius:10,border:`2px solid ${isSel ? GRN : BD}`,background:isSel ? ORG+"08" : CARD,cursor:"pointer",transition:"border-color 0.15s, background 0.15s"}}
                      onMouseEnter={e => { if(!isSel) e.currentTarget.style.borderColor = ORG+"60"; }}
                      onMouseLeave={e => { if(!isSel) e.currentTarget.style.borderColor = BD; }}
                    >
                      <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:8}}>
                        <div>
                          <div style={{fontSize:12,fontWeight:800,color:isSel ? GRN : TEXT,display:"flex",alignItems:"center",gap:6}}>
                            {p.ID_CONTRATO} · Parcela {p.NUM_PARCELA}/{p.TOTAL_PARCELAS}{isUltima(p,todasParcelas)&&<span style={{fontSize:9,fontWeight:800,color:GRN,background:GRN+"18",padding:"1px 6px",borderRadius:99}}>última</span>}
                          </div>
                          <div style={{fontSize:11,color:MUTED,marginTop:2}}>Venc: {fmtDt(p.DATA_VENCIMENTO)}</div>
                        </div>
                        <Badge c={diasCor}>{p.DIAS_ATRASO} dias</Badge>
                      </div>
                      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:6}}>
                        <div>
                          <div style={{fontSize:10,color:MUTED,fontWeight:600}}>PARCELA ORIGINAL</div>
                          <div style={{fontSize:13,fontWeight:700}}>{fmtR(vOrig)}</div>
                        </div>
                        {p.DIAS_ATRASO > 0 && (
                          <div>
                            <div style={{fontSize:10,color:RED,fontWeight:600}}>COM ENCARGOS</div>
                            <div style={{fontSize:13,fontWeight:700,color:RED}}>{fmtR(total)}</div>
                          </div>
                        )}
                      </div>
                      {isSel && (
                        <div style={{marginTop:8,fontSize:11,color:ORG,fontWeight:700}}>✓ Selecionada — preencha o formulário ao lado</div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* COLUNA DIREITA — formulário de pagamento */}
          <div style={{overflowY:"auto",padding:18}}>
            {!parcelaSel ? (
              <div style={{height:"100%",display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",gap:10,color:MUTED,padding:20,textAlign:"center"}}>
                <div style={{fontSize:40,opacity:0.3}}>←</div>
                <div style={{fontSize:13,fontWeight:600}}>Selecione uma parcela ao lado para registrar o pagamento</div>
              </div>
            ) : modo === "reagendar" ? (
              <div style={{display:"flex",flexDirection:"column",gap:16}}>
                <div style={{fontSize:14,fontWeight:800,color:ORG}}>{IcoCal} Reagendar Parcela</div>
                <div style={{fontSize:12,color:MUTED,marginTop:-8}}>{parcelaSel.ID_CONTRATO} · Parcela {parcelaSel.NUM_PARCELA}/{parcelaSel.TOTAL_PARCELAS} · {fmtR(parcelaSel.VALOR_PARCELA)}</div>
                <div style={{background:ORG+"08",border:`1px solid ${ORG}30`,borderRadius:8,padding:"10px 14px",fontSize:12,color:ORG,fontWeight:600}}>
                  A data de vencimento original não será alterada. Um lembrete de promessa será registrado.
                </div>
                <div>
                  <span style={LS()}>Data que o cliente prometeu pagar</span>
                  <input type="date" value={promData} onChange={e=>setPromData(e.target.value)} style={IS()}/>
                </div>
                <div>
                  <span style={LS()}>Observação (opcional)</span>
                  <input value={promObs} onChange={e=>setPromObs(e.target.value)} placeholder="Ex: Cliente disse que paga na sexta" style={IS()}/>
                </div>
                {msg&&<div style={{padding:"10px 14px",borderRadius:8,background:msg.ok?GRN+"10":RED+"10",color:msg.ok?GRN:RED,fontSize:13,fontWeight:700,textAlign:"center",border:`1px solid ${msg.ok?GRN:RED}25`}}>{msg.t}</div>}
                <button onClick={reagendar} disabled={loading||!promData} style={BTN5(ORG)}>
                  {loading?<><IcoSpinner color={ORG}/> Salvando...</>:"Registrar Promessa"}
                </button>
                <button onClick={()=>{setModo("pagamento");setMsg(null);}} style={BTN6()}>{IcoArrL} Voltar ao pagamento</button>
              </div>
            ) : (
              <div style={{display:"flex",flexDirection:"column",gap:16}}>
                <div style={{fontSize:14,fontWeight:800,color:TEXT}}>Registrar Pagamento</div>

                {/* Resumo da parcela selecionada */}
                {(() => {
                  const { vOrig, multa, mora, total } = calcComAtraso(parcelaSel);
                  const temAtraso = parcelaSel.DIAS_ATRASO > 0;
                  return (
                    <div style={{background:ORG+"06",border:`1px solid ${ORG}25`,borderRadius:10,padding:14}}>
                      <div style={{fontSize:11,fontWeight:700,color:ORG,marginBottom:10}}>
                        {parcelaSel.ID_CONTRATO} · Parcela {parcelaSel.NUM_PARCELA}/{parcelaSel.TOTAL_PARCELAS}
                      </div>
                      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8,marginBottom:temAtraso ? 10 : 0}}>
                        <div>
                          <div style={{fontSize:10,color:MUTED,fontWeight:600}}>PRINCIPAL</div>
                          <div style={{fontSize:13,fontWeight:700}}>{fmtR(parseFloat(parcelaSel.VALOR_PRINCIPAL || 0))}</div>
                        </div>
                        <div>
                          <div style={{fontSize:10,color:MUTED,fontWeight:600}}>JUROS</div>
                          <div style={{fontSize:13,fontWeight:700}}>{fmtR(parseFloat(parcelaSel.VALOR_JUROS || 0))}</div>
                        </div>
                        <div>
                          <div style={{fontSize:10,color:MUTED,fontWeight:600}}>PARCELA ORIGINAL</div>
                          <div style={{fontSize:13,fontWeight:700}}>{fmtR(vOrig)}</div>
                        </div>
                        <div>
                          <div style={{fontSize:10,color:temAtraso ? RED : GRN,fontWeight:600}}>
                            {temAtraso ? `COM ENCARGOS (${parcelaSel.DIAS_ATRASO}d)` : "EM DIA"}
                          </div>
                          <div style={{fontSize:13,fontWeight:700,color:temAtraso ? RED : GRN}}>{fmtR(total)}</div>
                        </div>
                      </div>
                      {temAtraso && (
                        <div style={{padding:"8px 10px",background:RED+"08",borderRadius:6,fontSize:11,color:RED,borderLeft:`3px solid ${RED}`}}>
                          Multa (10%): {fmtR(multa)} &nbsp;·&nbsp; Mora ({parcelaSel.DIAS_ATRASO}d × 0.033%): {fmtR(mora)}
                        </div>
                      )}
                    </div>
                  );
                })()}

                {/* Tipo de pagamento */}
                <div>
                  <span style={LS()}>Tipo de Pagamento</span>
                  <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8}}>
                    {[
                      { v:"total",         l:"Pagamento Total",   sub:"Valor original da parcela" },
                      { v:"com_atraso",    l:"Total + Encargos",  sub:"Multa + juros de mora" },
                      { v:"somente_juros", l:"Somente Juros",     sub:"Principal rolado p/ nova parcela" },
                      { v:"personalizado", l:"Personalizado",     sub:"Informe o valor manualmente" },
                    ].map(op => (
                      <div
                        key={op.v}
                        onClick={() => changeTipo(op.v)}
                        style={{padding:"10px 12px",borderRadius:8,border:`2px solid ${tipo === op.v ? GRN : BD}`,background:tipo === op.v ? ORG+"08" : CARD,cursor:"pointer",textAlign:"center",transition:"all 0.15s"}}
                      >
                        <div style={{fontSize:12,fontWeight:700,color:tipo === op.v ? GRN : TEXT}}>{op.l}</div>
                        <div style={{fontSize:10,color:MUTED,marginTop:2}}>{op.sub}</div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Valor */}
                <div>
                  <span style={LS()}>Valor (R$)</span>
                  <input
                    type="number"
                    value={valor}
                    onChange={e => setValor(e.target.value)}
                    style={{...IS(), fontSize:20, fontWeight:800, textAlign:"center", height:52}}
                    readOnly={tipo !== "personalizado" && tipo !== "com_atraso"}
                    onFocus={() => setTipo("personalizado")}
                  />
                  {tipo === "personalizado" && (
                    <div style={{marginTop:4,fontSize:11,color:MUTED}}>Valor livre — será registrado como informado.</div>
                  )}
                </div>

                {/* Data */}
                <div>
                  <span style={LS()}>Data do Pagamento</span>
                  <input type="date" value={data} onChange={e => setData(e.target.value)} style={IS()}/>
                </div>

                {/* Feedback */}
                {msg && (
                  <div style={{padding:"10px 14px",borderRadius:8,background:msg.ok ? GRN+"10" : RED+"10",color:msg.ok ? GRN : RED,fontSize:13,fontWeight:700,textAlign:"center",border:`1px solid ${msg.ok ? GRN : RED}25`}}>
                    {""}{msg.t}
                  </div>
                )}

                <button
                  onClick={registrar}
                  disabled={loading || !valor || !data || parseFloat(valor) <= 0}
                  style={BTN1(loading || !valor || !data || parseFloat(valor) <= 0)}
                >
                  {loading?<><IcoSpinner color="#1B3305"/> Registrando...</>:<>{IcoCheck} Confirmar Pagamento</>}
                </button>

                <button onClick={()=>setModo("reagendar")} style={BTN5(ORG)}>{IcoCal} Reagendar</button>
                <button onClick={() => setParcelaSel(null)} style={BTN6()}>{IcoArrL} Outra parcela</button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
    {comprovanteData&&<ComprovanteEnvioModal parcela={comprovanteData.parcela} valorPago={comprovanteData.valorPago} dataPago={comprovanteData.dataPago} tipoLabel={comprovanteData.tipoLabel} parcelas={todasParcelas||[]} contratos={contratos||[]} clientes={[cliente]} onFechar={()=>{setComprovanteData(null);setParcelaSel(null);setMsg(null);onFechar();onSucesso();}}/>}
    </>
  );
}

// ─── OUTROS MODAIS ───────────────────────────────────────────────
function BaixaModal({contrato, parcelas, onConfirmar, onFechar}){
  const [dados, setDados] = useState({substatus:"CLIENTE_DESAPARECIDO", motivo:"", observacao:"", possibilidadeRecuperacao:"BAIXA", statusJuridico:"NAO_ANALISADO", proximaProvidencia:""});
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState(null);
  const ps = (parcelas||[]).filter(p=>String(p.ID_CONTRATO)===String(contrato.ID_CONTRATO));
  const valPrincipal = parseFloat(contrato.VALOR_PRINCIPAL||0);
  const valTotal     = parseFloat(contrato.VALOR_TOTAL||contrato.VALOR_TOTAL_FINAL||0);
  const pagasPs    = ps.filter(p=>p.STATUS==="pago");
  const totalPago    = pagasPs.reduce((s,p)=>s+(parseFloat(p.VALOR_PAGO)||0),0);
  const jurosJaPagos = pagasPs.reduce((s,p)=>s+Math.max(0,(parseFloat(p.VALOR_PAGO)||0)-(parseFloat(p.VALOR_PRINCIPAL)||0)),0);
  // usa VALOR_PRINCIPAL por parcela; fallback: divide o principal igualmente entre parcelas
  const ppUnit = ps.length>0?valPrincipal/ps.length:0;
  const capitalRecuperado = Math.min(valPrincipal, pagasPs.reduce((s,p)=>{const vp=parseFloat(p.VALOR_PRINCIPAL||0);return s+(vp>0?vp:ppUnit);},0));
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
  const campo=(label,field,opts)=>(<div><span style={LS()}>{label}</span>{opts?<select value={dados[field]} onChange={e=>setDados(p=>({...p,[field]:e.target.value}))} style={IS()}>{opts.map(o=><option key={o.v} value={o.v}>{o.l}</option>)}</select>:<input value={dados[field]} onChange={e=>setDados(p=>({...p,[field]:e.target.value}))} style={IS()}/>}</div>);
  return(
    <div className="modal-overlay-anim" style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.5)",zIndex:400,display:"flex",alignItems:"center",justifyContent:"center",padding:20}}>
      <div className="modal-box-anim" style={{background:CARD,borderRadius:16,width:"100%",maxWidth:600,maxHeight:"90vh",display:"flex",flexDirection:"column",boxShadow:"0 24px 80px rgba(0,0,0,0.28)",border:`1px solid ${BD}`,minWidth:0}}>
        <div style={{padding:"18px 24px",borderBottom:`1px solid ${BD}`,display:"flex",alignItems:"flex-start",justifyContent:"space-between"}}><div><h2 style={{color:RED,fontSize:18,fontWeight:800,margin:0,display:"flex",alignItems:"center",gap:8,letterSpacing:"-0.02em"}}>{IcoAlert} Baixar Contrato como Prejuízo</h2><p style={{fontSize:12,color:MUTED,margin:"4px 0 0"}}>Contrato {contrato.ID_CONTRATO} · {contrato.NOME_CLIENTE}</p></div></div>
        <div style={{padding:24,overflowY:"auto",flex:1}}>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:16,marginBottom:24,padding:16,background:BG,borderRadius:10}}>
            <div><span style={LS()}>Capital Emprestado</span><div style={{fontSize:15,fontWeight:700}}>{fmtR(valPrincipal)}</div></div>
            <div><span style={LS()}>Capital Recuperado</span><div style={{fontSize:15,fontWeight:700,color:GRN}}>{fmtR(capitalRecuperado)}</div></div>
            <div style={{borderTop:`1px solid ${BD}`,paddingTop:8}}><span style={LS()}>Prejuízo de Capital</span><div style={{fontSize:15,fontWeight:700,color:RED}}>{fmtR(prejuizoCapital)}</div></div>
            <div style={{borderTop:`1px solid ${BD}`,paddingTop:8}}><span style={LS()}>Juros Não Realizados</span><div style={{fontSize:15,fontWeight:700,color:ORG}}>{fmtR(jurosNaoReal)}</div></div>
            <div style={{borderTop:`1px solid ${BD}`,paddingTop:8}}><span style={LS()}>Total Pago</span><div style={{fontSize:15,fontWeight:700,color:GRN}}>{fmtR(totalPago)}</div></div>
            <div style={{borderTop:`1px solid ${BD}`,paddingTop:8}}><span style={LS()}>% Recuperado</span><div style={{fontSize:15,fontWeight:700,color:RED}}>{fmtP(pctRecuperado)}</div></div>
            <div style={{gridColumn:"1/-1",borderTop:`1px solid ${BD}`,paddingTop:8}}><span style={LS()}>Dias de Atraso (Máx)</span><div style={{fontSize:15,fontWeight:700,color:RED}}>{diasAtraso} dias</div></div>
          </div>
          <div style={{display:"flex",flexDirection:"column",gap:16}}>
            {campo("Substatus","substatus",[{v:"CLIENTE_DESAPARECIDO",l:"Cliente Desaparecido"},{v:"SEM_BENS_PENHORAVEIS",l:"Sem Bens/Renda"},{v:"FALECIMENTO",l:"Falecimento"},{v:"FRAUDE_IDENTIFICADA",l:"Má-fé aparente"},{v:"ACORDO_VALOR_IRRISORIO",l:"Acordo Irrisório"}])}
            {campo("Motivo Detalhado (Obrigatório)","motivo")}
            {campo("Possibilidade de Recuperação","possibilidadeRecuperacao",[{v:"BAIXA",l:"Baixa"},{v:"RECURSOS_FUTUROS",l:"Remota"},{v:"JUDICIAL",l:"Judicial"}])}
            {campo("Status Jurídico","statusJuridico",[{v:"NAO_ANALISADO",l:"Não analisado"},{v:"ANALISE_INTERNA",l:"Análise Interna"},{v:"PROCESSO_AJUIZADO",l:"Processo Ajuizado"}])}
            <div><span style={LS()}>Próxima Providência</span><input value={dados.proximaProvidencia} onChange={e=>setDados(p=>({...p,proximaProvidencia:e.target.value}))} style={IS()}/></div>
            <div><span style={LS()}>Observação</span><textarea value={dados.observacao} onChange={e=>setDados(p=>({...p,observacao:e.target.value}))} style={{...IS(),height:80,resize:"none"}}/></div>
          </div>
          {msg&&<div style={{marginTop:16,padding:12,borderRadius:8,background:RED+"10",color:RED,fontSize:13,textAlign:"center",fontWeight:600}}>{msg}</div>}
        </div>
        <div style={{padding:"14px 20px",borderTop:`1px solid ${BD}`,display:"flex",gap:10}}>
          <button onClick={onFechar} style={{...BTN6(),flex:1}}>Cancelar</button>
          <button onClick={confirmar} disabled={loading} style={{...BTN4(loading),flex:2}}>{loading?<><IcoSpinner color="#fff"/> Processando...</>:"Confirmar Baixa"}</button>
        </div>
      </div>
    </div>
  );
}

function ModalAcordoPerda({contrato,parcelas,onConfirmar,onFechar}){
  const [valorAcordo,setValorAcordo]=useState("");
  const [forma,setForma]=useState("dinheiro");
  const [observacao,setObservacao]=useState("");
  const [loading,setLoading]=useState(false);
  const [msg,setMsg]=useState(null);

  const statusAberto=s=>!["pago","cancelado","baixado_como_prejuizo","renegociado"].includes(String(s||"").toLowerCase());
  const abertas=(parcelas||[]).filter(p=>String(p.ID_CONTRATO)===String(contrato.ID_CONTRATO)&&statusAberto(p.STATUS||p.STATUS_PAGAMENTO));
  const principalAberto=abertas.reduce((s,p)=>s+parseFloat(p.VALOR_PRINCIPAL||0),0);
  const jurosAberto=abertas.reduce((s,p)=>s+parseFloat(p.VALOR_JUROS||0),0);
  const totalDivida=principalAberto+jurosAberto;

  const vAcordo=parseFloat(valorAcordo)||0;
  // Abatimento: primeiro principal, depois juros
  const principalRecuperado=Math.min(vAcordo,principalAberto);
  const jurosRecuperado=Math.max(0,vAcordo-principalRecuperado);
  const descontoPrincipal=principalAberto-principalRecuperado; // prejuízo real
  const descontoJuros=jurosAberto-jurosRecuperado;             // receita não realizada

  const confirmar=async()=>{
    if(!valorAcordo||vAcordo<=0){setMsg("Informe o valor acordado.");return;}
    setLoading(true);setMsg(null);
    const res=await postAction({action:"acordoComPerda",dados:{
      idContrato:contrato.ID_CONTRATO,
      valorAcordado:vAcordo,
      data:hojeStr(),
      forma,
      observacao
    }});
    if(res.ok)onConfirmar();else setMsg(res.erro||"Erro.");
    setLoading(false);
  };

  return(
    <div className="modal-overlay-anim" style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.5)",zIndex:500,display:"flex",alignItems:"center",justifyContent:"center",padding:20}}>
      <div className="modal-box-anim" style={{background:CARD,borderRadius:16,width:"100%",maxWidth:520,display:"flex",flexDirection:"column",boxShadow:"0 24px 80px rgba(0,0,0,0.28)",border:`1px solid ${BD}`,maxHeight:"92vh",overflow:"hidden",minWidth:0}}>
        <div style={{padding:"18px 24px",borderBottom:`1px solid ${BD}`,flexShrink:0}}>
          <h2 style={{margin:0,color:TEXT,fontSize:18,fontWeight:800,display:"flex",alignItems:"center",gap:8,letterSpacing:"-0.02em"}}>{IcoHandshake} Acordo com Perda</h2>
          <p style={{fontSize:12,color:MUTED,margin:"3px 0 0"}}>Contrato: <strong>{contrato.ID_CONTRATO}</strong> · {contrato.NOME_CLIENTE}</p>
        </div>
        <div style={{padding:24,overflowY:"auto",flex:1}}>

        {/* Dívida atual */}
        <div style={{background:BG,padding:14,borderRadius:10,marginBottom:16}}>
          <div style={{fontSize:11,fontWeight:700,color:MUTED,textTransform:"uppercase",marginBottom:10}}>Dívida em Aberto ({abertas.length} parcelas)</div>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8}}>
            <div><div style={{fontSize:10,color:MUTED,fontWeight:600}}>PRINCIPAL</div><div style={{fontSize:14,fontWeight:800}}>{fmtR(principalAberto)}</div></div>
            <div><div style={{fontSize:10,color:MUTED,fontWeight:600}}>JUROS FUTUROS</div><div style={{fontSize:14,fontWeight:800,color:ORG}}>{fmtR(jurosAberto)}</div></div>
            <div style={{gridColumn:"1/-1",borderTop:`1px solid ${BD}`,paddingTop:8}}><div style={{fontSize:10,color:MUTED,fontWeight:600}}>TOTAL DA DÍVIDA</div><div style={{fontSize:16,fontWeight:900}}>{fmtR(totalDivida)}</div></div>
          </div>
        </div>

        {/* Valor do acordo */}
        <div style={{marginBottom:16}}>
          <span style={LS()}>Valor Recebido no Acordo (R$)</span>
          <input type="number" value={valorAcordo} onChange={e=>setValorAcordo(e.target.value)} placeholder="0.00" style={{...IS(),fontSize:20,fontWeight:800,height:52,textAlign:"center"}}/>
        </div>

        {/* Preview contábil — aparece ao digitar valor */}
        {vAcordo>0&&(
          <div style={{background:GRN+"10",border:`1px solid ${GRN}40`,borderRadius:10,padding:14,marginBottom:16}}>
            <div style={{fontSize:11,fontWeight:700,color:GRN,marginBottom:10}}>RESUMO CONTÁBIL</div>
            <div style={{display:"flex",flexDirection:"column",gap:7}}>
              <div style={{display:"flex",justifyContent:"space-between",fontSize:13}}>
                <span style={{color:MUTED}}>Principal recuperado</span>
                <strong style={{color:GRN}}>{fmtR(principalRecuperado)}</strong>
              </div>
              <div style={{display:"flex",justifyContent:"space-between",fontSize:13}}>
                <span style={{color:MUTED}}>Juros recebidos</span>
                <strong style={{color:GRN}}>{fmtR(jurosRecuperado)}</strong>
              </div>
              <div style={{borderTop:`1px dashed ${BD}`,paddingTop:7,display:"flex",justifyContent:"space-between",fontSize:13}}>
                <span style={{color:RED,fontWeight:700}}>Prejuízo real (capital perdido)</span>
                <strong style={{color:RED}}>{fmtR(descontoPrincipal)}</strong>
              </div>
              <div style={{display:"flex",justifyContent:"space-between",fontSize:13}}>
                <span style={{color:ORG,fontWeight:700}}>Juros cancelados (não é prejuízo)</span>
                <strong style={{color:ORG}}>{fmtR(descontoJuros)}</strong>
              </div>
            </div>
            {descontoPrincipal===0&&<div style={{marginTop:8,fontSize:11,color:GRN,fontWeight:700}}>✓ Principal inteiramente recuperado — apenas juros cancelados</div>}
          </div>
        )}

        {/* Forma e observação */}
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12,marginBottom:12}}>
          <div><span style={LS()}>Forma</span><select value={forma} onChange={e=>setForma(e.target.value)} style={IS()}><option value="dinheiro">Dinheiro</option><option value="pix">PIX</option><option value="transferencia">Transferência</option></select></div>
          <div><span style={LS()}>Observação</span><input value={observacao} onChange={e=>setObservacao(e.target.value)} placeholder="Opcional" style={IS()}/></div>
        </div>

        {msg&&<div style={{marginBottom:12,padding:10,borderRadius:8,background:RED+"10",color:RED,fontSize:13,textAlign:"center",fontWeight:600}}>{msg}</div>}

        </div>
        <div style={{padding:"14px 20px",borderTop:`1px solid ${BD}`,display:"flex",gap:10,flexShrink:0}}>
          <button onClick={onFechar} style={{...BTN6(),flex:1}}>Cancelar</button>
          <button onClick={confirmar} disabled={loading||vAcordo<=0} style={{...BTN1(loading||vAcordo<=0),flex:2}}>{loading?<><IcoSpinner color="#1B3305"/> Processando...</>:"Confirmar Acordo"}</button>
        </div>
      </div>
    </div>
  );
}

function QuitacaoAntecipadaModal({contrato, parcelas, onConfirmar, onFechar}){
  const abertas = useMemo(()=>(parcelas||[]).filter(p=>
    String(p.ID_CONTRATO)===String(contrato.ID_CONTRATO) &&
    !["pago","cancelado","baixado_como_prejuizo","renegociado","quitacao_antecipada"].includes(String(p.STATUS||p.STATUS_PAGAMENTO||"").toLowerCase())
  ).sort((a,b)=>parseInt(a.NUM_PARCELA||0)-parseInt(b.NUM_PARCELA||0)),[parcelas,contrato]);

  const [selecionadas, setSelecionadas] = useState(()=>new Set((abertas||[]).map(p=>p.ID_PARCELA)));
  const [desconto, setDesconto]         = useState("");
  const [forma, setForma]               = useState("dinheiro");
  const [observacao, setObservacao]     = useState("");
  const [loading, setLoading]           = useState(false);
  const [msg, setMsg]                   = useState(null);

  const toggle = id => setSelecionadas(prev=>{const n=new Set(prev);n.has(id)?n.delete(id):n.add(id);return n;});
  const toggleTodas = () => setSelecionadas(selecionadas.size===abertas.length?new Set():new Set(abertas.map(p=>p.ID_PARCELA)));

  const parcelasSel = abertas.filter(p=>selecionadas.has(p.ID_PARCELA));
  const totalPrincipal = parcelasSel.reduce((s,p)=>s+parseFloat(p.VALOR_PRINCIPAL||0),0);
  const totalJuros     = parcelasSel.reduce((s,p)=>s+parseFloat(p.VALOR_JUROS||0),0);
  const descontoNum    = Math.min(parseFloat(desconto)||0, totalJuros);
  const totalCobrar    = totalPrincipal + totalJuros - descontoNum;
  const todasSel       = selecionadas.size === abertas.length;

  const confirmar = async()=>{
    if(selecionadas.size===0){setMsg("Selecione ao menos uma parcela.");return;}
    setLoading(true);setMsg(null);
    const res = await postAction({action:"quitacaoAntecipada",dados:{
      idContrato: contrato.ID_CONTRATO,
      parcelasSelecionadas: [...selecionadas],
      descontoJuros: descontoNum,
      data: hojeStr(),
      forma,
      observacao
    }});
    if(res.ok){
      const r = res.resultado||{};
      setMsg({ok:true, t:`${r.parcelasQuitadas||selecionadas.size} parcela(s) quitadas. Recebido: ${fmtR(r.totalRecebido||totalCobrar)}${r.contratoQuitado?" · Contrato QUITADO ✓":""}`});
      setTimeout(()=>onConfirmar(contrato), 1800);
    } else {
      setMsg({ok:false, t:res.erro||"Erro ao processar."});
    }
    setLoading(false);
  };

  return(
    <div className="modal-overlay-anim" style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.5)",zIndex:500,display:"flex",alignItems:"center",justifyContent:"center",padding:16}} onClick={onFechar}>
      <div className="modal-box-anim" onClick={e=>e.stopPropagation()} style={{background:CARD,borderRadius:16,width:"100%",maxWidth:620,maxHeight:"92vh",display:"flex",flexDirection:"column",boxShadow:"0 24px 80px rgba(0,0,0,0.28)",border:`1px solid ${BD}`,overflow:"hidden",minWidth:0}}>

        <div style={{padding:"18px 24px",borderBottom:`1px solid ${BD}`,display:"flex",justifyContent:"space-between",alignItems:"center",flexShrink:0}}>
          <div>
            <div style={{fontSize:18,fontWeight:800,display:"flex",alignItems:"center",gap:8,letterSpacing:"-0.02em",color:TEXT}}>{IcoZap} Quitação Antecipada</div>
            <div style={{fontSize:12,color:MUTED,marginTop:3}}>{contrato.ID_CONTRATO} · {contrato.NOME_CLIENTE}</div>
          </div>
          <button className="modal-close-btn" onClick={onFechar} style={{background:"transparent",border:"none",width:32,height:32,borderRadius:8,cursor:"pointer",color:MUTED,display:"flex",alignItems:"center",justifyContent:"center"}}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
          </button>
        </div>

        <div style={{flex:1,overflowY:"auto",padding:20,display:"flex",flexDirection:"column",gap:16}}>

          {/* Lista de parcelas */}
          <div>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:10}}>
              <span style={{fontSize:11,fontWeight:700,color:MUTED,textTransform:"uppercase"}}>Parcelas em Aberto ({abertas.length})</span>
              <button onClick={toggleTodas} style={{fontSize:11,fontWeight:700,color:ORG,background:"none",border:`1px solid ${ORG}40`,borderRadius:6,padding:"4px 10px",cursor:"pointer"}}>
                {todasSel?"Desmarcar todas":"Selecionar todas"}
              </button>
            </div>
            {abertas.length===0
              ? <div style={{padding:12,background:GRN+"08",borderRadius:8,color:GRN,fontSize:13,fontWeight:700}}>Nenhuma parcela em aberto.</div>
              : <div style={{display:"flex",flexDirection:"column",gap:6}}>
                  {abertas.map(p=>{
                    const sel = selecionadas.has(p.ID_PARCELA);
                    const _stEf = statusEfetivo(p);
                    const stCor = {pendente:BLU,atrasado:RED,vence_hoje:ORG}[_stEf]||MUTED;
                    return(
                      <div key={p.ID_PARCELA} onClick={()=>toggle(p.ID_PARCELA)}
                        style={{display:"flex",alignItems:"center",gap:12,padding:"10px 14px",borderRadius:9,border:`2px solid ${sel?ORG:BD}`,background:sel?ORG+"06":CARD,cursor:"pointer",transition:"all 0.12s"}}
                      >
                        <div style={{width:18,height:18,borderRadius:5,border:`2px solid ${sel?GRN:BD}`,background:sel?GRN:"transparent",display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}}>
                          {sel&&<svg width="10" height="10" viewBox="0 0 10 10"><polyline points="1.5,5 4,7.5 8.5,2" fill="none" stroke="#fff" strokeWidth="1.8"/></svg>}
                        </div>
                        <div style={{flex:1,display:"flex",justifyContent:"space-between",alignItems:"center",minWidth:0}}>
                          <div>
                            <div style={{fontSize:12,fontWeight:700,display:"flex",alignItems:"center",gap:6}}>Parcela {p.NUM_PARCELA}/{p.TOTAL_PARCELAS} · venc. {fmtDt(p.DATA_VENCIMENTO)}{isUltima(p,todasParcelas)&&<span style={{fontSize:9,fontWeight:800,color:GRN,background:GRN+"18",padding:"1px 6px",borderRadius:99}}>última</span>}</div>
                            <div style={{fontSize:11,color:MUTED,marginTop:2}}>Principal: {fmtR(p.VALOR_PRINCIPAL||0)} · Juros: {fmtR(p.VALOR_JUROS||0)}</div>
                          </div>
                          <div style={{textAlign:"right",flexShrink:0}}>
                            <div style={{fontSize:13,fontWeight:800}}>{fmtR(p.VALOR_PARCELA||0)}</div>
                            <Badge c={stCor}>{_ST_LABEL[_stEf]||_stEf}</Badge>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
            }
          </div>

          {/* Desconto nos juros */}
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12}}>
            <div>
              <span style={LS()}>Desconto nos Juros (R$)</span>
              <input type="number" value={desconto} onChange={e=>setDesconto(e.target.value)} placeholder="0.00" min="0" max={totalJuros} style={IS()}/>
              {totalJuros>0&&<div style={{fontSize:10,color:MUTED,marginTop:3}}>Máx: {fmtR(totalJuros)}</div>}
            </div>
            <div>
              <span style={LS()}>Forma de Pagamento</span>
              <select value={forma} onChange={e=>setForma(e.target.value)} style={IS()}>
                <option value="dinheiro">Dinheiro</option>
                <option value="pix">PIX</option>
                <option value="transferencia">Transferência</option>
              </select>
            </div>
            <div style={{gridColumn:"1/-1"}}>
              <span style={LS()}>Observação</span>
              <input value={observacao} onChange={e=>setObservacao(e.target.value)} placeholder="Opcional" style={IS()}/>
            </div>
          </div>

          {/* Preview */}
          {parcelasSel.length>0&&(
            <div style={{background:ORG+"06",border:`1px solid ${ORG}25`,borderRadius:10,padding:14}}>
              <div style={{fontSize:11,fontWeight:700,color:ORG,marginBottom:10,textTransform:"uppercase"}}>Resumo — {parcelasSel.length} parcela(s)</div>
              <div style={{display:"flex",flexDirection:"column",gap:7}}>
                <div style={{display:"flex",justifyContent:"space-between",fontSize:13}}><span style={{color:MUTED}}>Principal</span><strong>{fmtR(totalPrincipal)}</strong></div>
                <div style={{display:"flex",justifyContent:"space-between",fontSize:13}}><span style={{color:MUTED}}>Juros originais</span><strong>{fmtR(totalJuros)}</strong></div>
                {descontoNum>0&&<div style={{display:"flex",justifyContent:"space-between",fontSize:13}}><span style={{color:GRN}}>Desconto concedido</span><strong style={{color:GRN}}>− {fmtR(descontoNum)}</strong></div>}
                <div style={{borderTop:`1px solid ${ORG}20`,paddingTop:8,display:"flex",justifyContent:"space-between",fontSize:15}}>
                  <span style={{fontWeight:700}}>Total a Receber</span>
                  <strong style={{color:ORG,fontSize:17}}>{fmtR(totalCobrar)}</strong>
                </div>
                {todasSel&&<div style={{fontSize:11,color:GRN,fontWeight:700}}>✓ Todas as parcelas selecionadas → contrato será marcado como <strong>Quitado</strong></div>}
              </div>
            </div>
          )}

          {msg&&(
            <div style={{padding:"10px 14px",borderRadius:8,background:msg.ok?GRN+"10":RED+"10",color:msg.ok?GRN:RED,fontSize:13,fontWeight:700,textAlign:"center",border:`1px solid ${msg.ok?GRN:RED}25`}}>
              {""}{msg.t}
            </div>
          )}
        </div>

        <div style={{padding:"14px 20px",borderTop:`1px solid ${BD}`,display:"flex",gap:10,flexShrink:0}}>
          <button onClick={onFechar} style={{...BTN6(),flex:1}}>Cancelar</button>
          <button onClick={confirmar} disabled={loading||selecionadas.size===0} style={{...BTN1(loading||selecionadas.size===0),flex:2}}>
            {loading?<><IcoSpinner color="#1B3305"/> Processando...</>:<>{IcoZap} Confirmar Quitação</>}
          </button>
        </div>
      </div>
    </div>
  );
}

function RecuperacaoModal({contrato,onConfirmar,onFechar}){
  const [valor,setValor]=useState("");
  const [data,setData]=useState(hojeStr());
  const [forma,setForma]=useState("dinheiro");
  const [obs,setObs]=useState("");
  const [loading,setLoading]=useState(false);
  const [msg,setMsg]=useState(null);
  const mob = useIsMobile();
  const vRec=parseFloat(valor)||0;
  const prejuizoAtual=parseFloat(contrato.PREJUIZO_CAPITAL||0);
  const jaRecuperado=parseFloat(contrato.VALOR_RECUPERADO_APOS_BAIXA||0);
  const capitalOriginal=prejuizoAtual+jaRecuperado;
  const novoRecuperado=jaRecuperado+vRec;
  const novoPrejuizo=Math.max(0,prejuizoAtual-vRec);
  const confirmar=async()=>{
    if(!vRec||vRec<=0){setMsg("Informe o valor recebido.");return;}
    if(!data){setMsg("Informe a data.");return;}
    setLoading(true);setMsg(null);
    const res=await postAction({action:"recuperacaoAposBaixa",idContrato:contrato.ID_CONTRATO,dados:{valorPago:vRec,data,forma,observacao:obs||"Recuperação pós-baixa"}});
    if(res.ok)onConfirmar();else setMsg(res.erro||"Erro.");
    setLoading(false);
  };
  return(
    <div className="modal-overlay-anim" style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.5)",zIndex:400,display:"flex",alignItems:"center",justifyContent:"center",padding:20}}>
      <div className="modal-box-anim" style={{background:CARD,borderRadius:16,width:"100%",maxWidth:480,boxShadow:"0 24px 80px rgba(0,0,0,0.28)",border:`1px solid ${BD}`,display:"flex",flexDirection:"column",maxHeight:"92vh",overflow:"hidden",minWidth:0}}>
        <div style={{padding:"18px 24px",borderBottom:`1px solid ${BD}`,display:"flex",justifyContent:"space-between",alignItems:"flex-start",flexShrink:0}}>
          <div>
            <h2 style={{color:PUR,margin:"0 0 3px",fontSize:18,fontWeight:800,letterSpacing:"-0.02em",display:"flex",alignItems:"center",gap:8}}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>
              Registrar Recuperação
            </h2>
            <p style={{color:MUTED,fontSize:12,margin:0}}>{contrato.ID_CONTRATO} · {contrato.NOME_CLIENTE}</p>
          </div>
        </div>
        <div style={{padding:20,overflowY:"auto",flex:1,display:"flex",flexDirection:"column",gap:16}}>
          <div style={{display:"grid",gridTemplateColumns:mob?"1fr":"1fr 1fr 1fr",gap:10,background:BG,borderRadius:10,padding:14}}>
            <div><div style={{fontSize:9,color:MUTED,fontWeight:700,textTransform:"uppercase",marginBottom:2}}>Capital Baixado</div><div style={{fontSize:14,fontWeight:800,color:RED}}>{fmtR(capitalOriginal)}</div></div>
            <div><div style={{fontSize:9,color:MUTED,fontWeight:700,textTransform:"uppercase",marginBottom:2}}>Já Recuperado</div><div style={{fontSize:14,fontWeight:800,color:PUR}}>{jaRecuperado>0?fmtR(jaRecuperado):"—"}</div></div>
            <div><div style={{fontSize:9,color:MUTED,fontWeight:700,textTransform:"uppercase",marginBottom:2}}>Prejuízo Atual</div><div style={{fontSize:14,fontWeight:800,color:RED}}>{fmtR(prejuizoAtual)}</div></div>
          </div>
          <div><span style={LS()}>Valor Recebido (R$)</span>
            <input type="number" value={valor} onChange={e=>setValor(e.target.value)} placeholder="0,00" style={{...IS(),fontSize:22,fontWeight:800,textAlign:"center",height:54}}/>
          </div>
          {vRec>0&&(
            <div style={{background:GRN+"10",border:`1px solid ${GRN}40`,borderRadius:10,padding:14}}>
              <div style={{fontSize:11,fontWeight:700,color:GRN,marginBottom:10,textTransform:"uppercase"}}>Resultado após confirmação</div>
              <div style={{display:"flex",flexDirection:"column",gap:8}}>
                <div style={{display:"flex",justifyContent:"space-between",fontSize:13}}><span style={{color:MUTED}}>Total recuperado</span><strong style={{color:PUR}}>{fmtR(novoRecuperado)}</strong></div>
                <div style={{display:"flex",justifyContent:"space-between",fontSize:13}}><span style={{color:MUTED}}>Prejuízo remanescente</span><strong style={{color:novoPrejuizo>0?RED:GRN}}>{novoPrejuizo>0?fmtR(novoPrejuizo):"R$ 0,00"}</strong></div>
                {novoPrejuizo<=0&&<div style={{fontSize:11,color:GRN,fontWeight:700,marginTop:4}}>✓ Prejuízo integralmente recuperado — contrato será marcado como Recuperado</div>}
              </div>
            </div>
          )}
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12}}>
            <div><span style={LS()}>Data do Recebimento</span><input type="date" value={data} onChange={e=>setData(e.target.value)} style={IS()}/></div>
            <div><span style={LS()}>Forma</span><select value={forma} onChange={e=>setForma(e.target.value)} style={IS()}><option value="dinheiro">Dinheiro</option><option value="pix">PIX</option><option value="transferencia">Transferência</option><option value="deposito">Depósito</option></select></div>
          </div>
          <div><span style={LS()}>Observação (opcional)</span><input value={obs} onChange={e=>setObs(e.target.value)} placeholder="Ex: acordo verbal, parcela única..." style={IS()}/></div>
          {msg&&<div style={{padding:10,borderRadius:8,background:RED+"10",color:RED,fontSize:13,fontWeight:600,textAlign:"center"}}>{msg}</div>}
        </div>
        <div style={{padding:"14px 20px",borderTop:`1px solid ${BD}`,display:"flex",gap:10,flexShrink:0}}>
          <button onClick={onFechar} style={{...BTN6(),flex:1}}>Cancelar</button>
          <button onClick={confirmar} disabled={loading||vRec<=0} style={{...BTN1(loading||vRec<=0),flex:2}}>{loading?<><IcoSpinner color="#1B3305"/> Registrando...</>:"Confirmar Recuperação"}</button>
        </div>
      </div>
    </div>
  );
}

function PerdaAcoesModal({contrato,parcelas,onBaixar,onAcordo,onRecuperar,onFechar}){
  const ps=(parcelas||[]).filter(p=>String(p.ID_CONTRATO)===String(contrato.ID_CONTRATO));
  const atrasadas=ps.filter(p=>["atrasado"].includes(String(p.STATUS||p.STATUS_PAGAMENTO||"").toLowerCase()));
  const diasAtraso=atrasadas.length>0?Math.max(...atrasadas.map(p=>{const dv=parseDate(p.DATA_VENCIMENTO);if(!dv)return 0;const d=Math.round((new Date()-dv)/86400000);return d>0?d:0;})):0;
  const emAberto=ps.filter(p=>!["pago","cancelado","baixado_como_prejuizo","quitacao_antecipada","renegociado"].includes(String(p.STATUS||p.STATUS_PAGAMENTO||"").toLowerCase())).reduce((s,p)=>s+parseFloat(p.VALOR_PARCELA||0),0);
  const st=contrato.STATUS_CONTRATO;
  const podeBaixar=["em_cobranca","pre_prejuizo"].includes(st);
  const podeAcordo=["em_cobranca","pre_prejuizo","baixado_como_prejuizo","em_recuperacao","recuperado_parcialmente"].includes(st);
  const podeRecuperar=["baixado_como_prejuizo","em_recuperacao","recuperado_parcialmente"].includes(st);
  return(
    <div className="modal-overlay-anim" style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.5)",zIndex:450,display:"flex",alignItems:"center",justifyContent:"center",padding:20}}>
      <div className="modal-box-anim" style={{background:CARD,borderRadius:16,width:"100%",maxWidth:380,border:`1px solid ${BD}`,boxShadow:"0 24px 80px rgba(0,0,0,0.28)",overflow:"hidden",minWidth:0}}>
        <div style={{padding:"18px 20px",borderBottom:`1px solid ${BD}`}}>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:14}}>
            <div>
              <div style={{fontWeight:800,fontSize:16,letterSpacing:"-0.02em",color:TEXT}}>{contrato.ID_CONTRATO}</div>
              <div style={{fontSize:12,color:MUTED,marginTop:2}}>{contrato.NOME_CLIENTE}</div>
            </div>
            <Badge c={STATUS_COR[st]||MUTED}>{STATUS_LABEL[st]||st}</Badge>
          </div>
          <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:10,background:BG,borderRadius:10,padding:"10px 12px"}}>
            <div><div style={LS()}>Capital</div><div style={{fontSize:13,fontWeight:700,color:TEXT}}>{fmtR(contrato.VALOR_PRINCIPAL)}</div></div>
            {diasAtraso>0&&<div><div style={LS()}>Dias Atraso</div><div style={{fontSize:13,fontWeight:700,color:RED}}>{diasAtraso}d</div></div>}
            {emAberto>0&&<div><div style={LS()}>Em Aberto</div><div style={{fontSize:13,fontWeight:700,color:ORG}}>{fmtR(emAberto)}</div></div>}
            {parseFloat(contrato.PREJUIZO_CAPITAL||0)>0&&<div><div style={LS()}>Prejuízo</div><div style={{fontSize:13,fontWeight:700,color:RED}}>{fmtR(contrato.PREJUIZO_CAPITAL)}</div></div>}
            {parseFloat(contrato.VALOR_RECUPERADO_APOS_BAIXA||0)>0&&<div><div style={LS()}>Recuperado</div><div style={{fontSize:13,fontWeight:700,color:PUR}}>{fmtR(contrato.VALOR_RECUPERADO_APOS_BAIXA)}</div></div>}
          </div>
        </div>
        <div style={{padding:"16px 20px",display:"flex",flexDirection:"column",gap:8}}>
          {podeBaixar&&<button onClick={onBaixar} style={BTN5(RED)}>{IcoAlert} Baixar como Prejuízo</button>}
          {podeAcordo&&<button onClick={onAcordo} style={BTN5(ORG)}>{IcoHandshake} Registrar Acordo</button>}
          {podeRecuperar&&<button onClick={onRecuperar} style={{...BTN5(PUR),alignItems:"center",display:"flex",gap:8}}>
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>
            Registrar Recuperação
          </button>}
          <button onClick={onFechar} style={BTN6()}>Fechar</button>
        </div>
      </div>
    </div>
  );
}

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

function calcProxVenc(diaVenc){
  if(!diaVenc)return"";
  const s=String(diaVenc).trim();
  let dia;
  if(s.includes("/"))dia=parseInt(s.split("/")[0]);
  else if(/^\d{4}-\d{2}-\d{2}/.test(s))dia=parseInt(s.split("-")[2]);
  else dia=parseInt(s);
  if(!dia||isNaN(dia)||dia<1||dia>31)return"";
  const hoje=new Date();
  const proximo=new Date(hoje.getFullYear(),hoje.getMonth()+1,dia);
  if(proximo.getDate()!==dia)proximo.setDate(0); // overflow: último dia do mês
  return proximo.toISOString().split("T")[0];
}

function titleCasePT(s){
  const PREPS=new Set(["de","da","do","dos","das","e","em","a","o","as","os","ao","aos","na","no","nas","nos","para","por","com"]);
  return String(s||"").trim().split(/\s+/).filter(Boolean).map((w,i)=>{
    const l=w.toLowerCase();
    return(i===0||!PREPS.has(l))?l.charAt(0).toUpperCase()+l.slice(1):l;
  }).join(" ");
}
function normTel(s){
  const d=String(s||"").replace(/\D/g,"");
  if(d.length===10)return d.slice(0,2)+"9"+d.slice(2);
  return d;
}
function fixEmail(s){
  const v=String(s||"").toLowerCase().trim();
  return v.endsWith("@gmail.com.br")?v.slice(0,-3):v;
}

function normEstadoCivil(v){
  if(!v)return"";
  const s=String(v).toLowerCase().replace(/\s+/g,"");
  if(s.includes("casad"))return"Casado(a)";
  if(s.includes("solteir"))return"Solteiro(a)";
  if(s.includes("divorciad"))return"Divorciado(a)";
  if(s.includes("viuv")||s.includes("viúv"))return"Viúvo(a)";
  if(s.includes("uniao")||s.includes("união"))return"União Estável";
  return v;
}

function ClienteModal({cliente,contratos,parcelas,clientes,onFechar,onAtualizar,onNovoContrato,onVerContrato,onSimular,abaInicial}){
  const [t,setT]=useState(abaInicial||"perfil");
  const [edit,setEdit]=useState({
    NOME:         cliente.NOME||cliente.NOME_CLIENTE||"",
    TELEFONE_WPP: cliente.TELEFONE_WPP||cliente.TELEFONE||"",
    EMAIL:        cliente.EMAIL||"",
    CPF:          cliente.CPF||"",
    RG:           cliente.RG||"",
    PROFISSAO:    cliente.PROFISSAO||"",
    ESTADO_CIVIL: normEstadoCivil(cliente.ESTADO_CIVIL||""),
    NACIONALIDADE:cliente.NACIONALIDADE||"",
    STATUS_CLIENTE:cliente.STATUS_CLIENTE||"ativo",
    DIA_VENCIMENTO_PREFERIDO:cliente.DIA_VENCIMENTO_PREFERIDO||"",
    LIMITE_CREDITO:cliente.LIMITE_CREDITO||"",
    RENDA_MENSAL:  cliente.RENDA_MENSAL||"",
    TIPO_RENDA:    cliente.TIPO_RENDA||"",
    RENDA_COMPROVADA: cliente.RENDA_COMPROVADA||"",
    QUALIDADE_COMUNICACAO: cliente.QUALIDADE_COMUNICACAO||"",
    CONTATO_CONFIANCA_1: cliente.CONTATO_CONFIANCA_1||"",
    TEL_CONFIANCA_1:     cliente.TEL_CONFIANCA_1||"",
    CONTATO_CONFIANCA_2: cliente.CONTATO_CONFIANCA_2||"",
    TEL_CONFIANCA_2:     cliente.TEL_CONFIANCA_2||"",
    PADRINHO:     cliente.PADRINHO||"",
    TEL_PADRINHO: cliente.TEL_PADRINHO||"",
    CEP:          cliente.CEP||"",
    RUA:          cliente.RUA||"",
    NUMERO:       cliente.NUMERO||"",
    QUADRA:       cliente.QUADRA||"",
    LOTE:         cliente.LOTE||"",
    SETOR:        cliente.SETOR||"",
    COMPLEMENTO:  cliente.COMPLEMENTO||"",
    CIDADE_ESTADO:cliente.CIDADE_ESTADO||"",
    OBSERVACOES:  cliente.OBSERVACOES||"",
  });
  const [saving,setSaving]=useState(false);
  const [saveMsg,setSaveMsg]=useState(null);
  const [scoreLocal,setScoreLocal]=useState(null);
  const [scoreLoading,setScoreLoading]=useState(false);
  const recalcularScore=async()=>{
    setScoreLoading(true);
    try{const d=await postAction({action:"recalcularScore",idCliente:cliente.ID_CLIENTE});if(d?.ok&&d.score)setScoreLocal(d.score);}catch(e){}
    finally{setScoreLoading(false);}
  };
  const [padSearch,setPadSearch]=useState(edit.PADRINHO||"");
  const [padDrop,setPadDrop]=useState(false);
  const padRef=useRef();
  useEffect(()=>{const h=e=>{if(padRef.current&&!padRef.current.contains(e.target))setPadDrop(false);};document.addEventListener("mousedown",h);return()=>document.removeEventListener("mousedown",h);},[]);
  const padSugestoes=useMemo(()=>{if(!padSearch||padSearch.length<2)return[];const q=padSearch.toLowerCase();return(clientes||[]).filter(c=>String(c.NOME||c.NOME_CLIENTE||"").toLowerCase().includes(q)&&String(c.ID_CLIENTE)!==String(cliente.ID_CLIENTE)).slice(0,6);},[padSearch,clientes,cliente.ID_CLIENTE]);
  const selecionarPadrinho=c=>{const nome=c.NOME||c.NOME_CLIENTE||"";const tel=c.TELEFONE_WPP||c.TELEFONE||"";setPadSearch(nome);setEdit(p=>({...p,PADRINHO:nome,TEL_PADRINHO:tel}));setPadDrop(false);};

  const nome=cliente.NOME_CLIENTE||cliente.NOME||cliente.CLIENTE||"Cliente sem nome";
  const tel=cliente.TELEFONE||cliente.TELEFONE_WPP||cliente.WHATSAPP||"—";
  const score=cliente.SCORE||cliente.SCORE_CLIENTE||cliente.SCORE_SERASA||"Não informado";
  const ST_TERMINAIS_LIM=["quitado","cancelado","baixado_como_prejuizo","recuperado_integralmente","encerrado_sem_recuperacao"];
  const idsContratosDoCliente=new Set((parcelas||[]).filter(p=>String(p.ID_CLIENTE||"").trim()===String(cliente.ID_CLIENTE||"").trim()).map(p=>String(p.ID_CONTRATO||"").trim()).filter(Boolean));
  const contratosDoCliente=useMemo(()=>(contratos||[]).filter(c=>String(c.ID_CLIENTE||"").trim()===String(cliente.ID_CLIENTE||"").trim()).sort((a,b)=>toNum(b.DATA_EMPRESTIMO)-toNum(a.DATA_EMPRESTIMO)),[contratos,cliente.ID_CLIENTE]);
  const principalEmUso=(contratos||[]).filter(c=>idsContratosDoCliente.has(String(c.ID_CONTRATO||"").trim())&&!ST_TERMINAIS_LIM.includes(String(c.STATUS_CONTRATO||"").trim())).reduce((s,c)=>s+parseFloat(c.VALOR_PRINCIPAL||0),0);
  const limite=parseFloat(cliente.LIMITE_CREDITO||0);
  const disponivel=Math.max(0,limite-principalEmUso);
  const pctUso=limite>0?Math.min(100,(principalEmUso/limite)*100):0;
  const label=k=>String(k).replaceAll("_"," ").toLowerCase().replace(/\b\w/g,m=>m.toUpperCase());
  const campos=Object.entries(cliente||{}).filter(([_,v])=>v!==null&&v!==undefined&&String(v).trim()!=="");

  const salvar=async()=>{
    setSaving(true);setSaveMsg(null);
    const campos={...edit,STATUS_CLIENTE:"ativo"};
    if(String(cliente.STATUS_CLIENTE||"").toLowerCase()==="aguardando_conferencia"){
      const OBS_PADRAO="Cadastro via formulario - aguardando conferencia";
      if(String(campos.OBSERVACOES||"").trim().toLowerCase()===OBS_PADRAO.toLowerCase())
        campos.OBSERVACOES="";
    }
    const res=await postAction({action:"atualizarCliente",idCliente:cliente.ID_CLIENTE,campos});
    if(res.ok){setSaveMsg({ok:true,t:"Dados atualizados com sucesso!"});if(onAtualizar)setTimeout(onAtualizar,1200);}
    else setSaveMsg({ok:false,t:res.erro||"Erro ao salvar."});
    setSaving(false);
  };

  const _OBRIG=new Set(["NOME","TELEFONE_WPP","EMAIL","CPF","RG","PROFISSAO",
    "DIA_VENCIMENTO_PREFERIDO","LIMITE_CREDITO","RENDA_MENSAL","TIPO_RENDA",
    "RENDA_COMPROVADA","QUALIDADE_COMUNICACAO","CONTATO_CONFIANCA_1","TEL_CONFIANCA_1",
    "CONTATO_CONFIANCA_2","TEL_CONFIANCA_2","PADRINHO"]);
  const validar=(field,val)=>{
    const v=String(val||"").trim();
    if(_OBRIG.has(field)&&!v) return "Obrigatório";
    if(!v) return null;
    if(field==="NOME"){
      if(/\d/.test(v)) return "Não pode conter números";
      const _PREPS_V=new Set(["de","da","do","dos","das","e","em","a","o","as","os","ao","aos","na","no","nas","nos","para","por","com"]);
      if(v.split(/\s+/).some((w,i)=>w.length>0&&i>0&&!_PREPS_V.has(w.toLowerCase())&&w[0]!==w[0].toUpperCase())) return "Cada nome deve iniciar com maiúscula";
    }
    if(field==="CPF"){if(/\D/.test(v)) return "Somente números"; if(v.length!==11) return "11 dígitos";}
    if(field==="RG"){if(/\D/.test(v)) return "Somente números";}
    if(["TELEFONE_WPP","TEL_CONFIANCA_1","TEL_CONFIANCA_2","TEL_PADRINHO"].includes(field)){
      if(/\D/.test(v)) return "Somente números";
      if(v.length<10||v.length>11) return "10 ou 11 dígitos";
    }
    if(field==="EMAIL"){
      if(v!==v.toLowerCase()) return "Somente letras minúsculas";
      if(!v.includes("@")) return "Email inválido";
    }
    if(field==="PROFISSAO"){if(/[0-9]/.test(v)) return "Somente letras";}
    if(field==="CEP"){const d=v.replace(/\D/g,"");if(d.length!==8)return "8 dígitos";if(/[.\-\/]/.test(v))return "Somente números";}
    return null;
  };
  const erros=Object.fromEntries(Object.entries(edit).map(([k,v])=>[k,validar(k,v)]).filter(([,e])=>e));
  const temErros=Object.keys(erros).length>0;
  const nErros=Object.keys(erros).length;
  const mob = useIsMobile();

  return(
    <div className="modal-overlay-anim" style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.5)",zIndex:300,display:"flex",alignItems:"center",justifyContent:"center",padding:mob?0:20}}>
      <div className="modal-box-anim" style={{background:CARD,borderRadius:mob?0:16,width:"100%",maxWidth:mob?undefined:980,height:mob?"100dvh":"86vh",display:"flex",flexDirection:"column",overflow:"hidden",minWidth:0,boxShadow:"0 30px 90px rgba(0,0,0,0.32)",border:mob?"none":`1px solid ${BD}`}}>
        <div style={{padding:mob?"14px 16px":"18px 24px",borderBottom:`1px solid ${BD}`,display:"flex",justifyContent:"space-between",alignItems:"center",flexShrink:0}}>
          <div style={{display:"flex",alignItems:"center",gap:14}}>
            <div style={{width:40,height:40,background:GRN+"18",borderRadius:10,display:"flex",alignItems:"center",justifyContent:"center",color:GRN,fontSize:16,fontWeight:800,flexShrink:0,border:`1px solid ${GRN}28`}}>{nome[0]||"?"}</div>
            <div><h2 style={{margin:0,fontSize:mob?16:18,fontWeight:800,letterSpacing:"-0.02em",color:TEXT}}>{nome}</h2><div style={{fontSize:12,color:MUTED,marginTop:2}}>ID {cliente.ID_CLIENTE||"—"} · Score: {score}</div></div>
          </div>
          <div style={{display:"flex",alignItems:"center",gap:8}}>
            {onNovoContrato&&<button onClick={()=>onNovoContrato(cliente)} style={{...BTN1(false),padding:"7px 13px",fontSize:12}}>{IcoCtr} Novo Contrato</button>}
            <button className="modal-close-btn" onClick={onFechar} style={{background:"transparent",border:"none",width:32,height:32,borderRadius:8,cursor:"pointer",color:MUTED,display:"flex",alignItems:"center",justifyContent:"center"}}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
            </button>
          </div>
        </div>
        <div style={{display:"flex",background:CARD,padding:mob?"0 12px":"0 20px",borderBottom:`1px solid ${BD}`,gap:mob?12:20,overflowX:"auto"}}>
          {["perfil","editar","todos os dados",...(contratosDoCliente.length>0?[`contratos (${contratosDoCliente.length})`]:[])].map(tab=><button key={tab} onClick={()=>{setT(tab);setSaveMsg(null);}} style={{padding:"14px 4px",background:"none",border:"none",borderBottom:t===tab?`2px solid ${GRN}`:"2px solid transparent",color:t===tab?GRN:MUTED,fontWeight:600,cursor:"pointer",fontSize:13,textTransform:"capitalize"}}>{tab}</button>)}
        </div>
        <div style={{flex:1,overflowY:"auto",overflowX:"hidden",padding:20}}>
          {t==="perfil"&&(
            <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(160px,1fr))",gap:16}}>
              {[
                {l:"Nome",v:nome},{l:"Score",v:score},{l:"CPF",v:cliente.CPF},{l:"RG",v:cliente.RG},{l:"WhatsApp",v:tel},{l:"Email",v:cliente.EMAIL},
                {l:"Status",v:cliente.STATUS_CLIENTE},{l:"Profissão",v:cliente.PROFISSAO},{l:"Estado civil",v:cliente.ESTADO_CIVIL},{l:"Nacionalidade",v:cliente.NACIONALIDADE},
                {l:"Endereço",v:[cliente.RUA,cliente.NUMERO,cliente.QUADRA&&`Qd. ${cliente.QUADRA}`,cliente.LOTE&&`Lt. ${cliente.LOTE}`,cliente.SETOR,cliente.CIDADE_ESTADO].filter(Boolean).join(", ")},
                {l:"CEP",v:cliente.CEP},{l:"Contato confiança 1",v:[cliente.CONTATO_CONFIANCA_1,cliente.TEL_CONFIANCA_1].filter(Boolean).join(" · ")},
                {l:"Contato confiança 2",v:[cliente.CONTATO_CONFIANCA_2,cliente.TEL_CONFIANCA_2].filter(Boolean).join(" · ")},{l:"Padrinho",v:[cliente.PADRINHO,cliente.TEL_PADRINHO].filter(Boolean).join(" · ")},
                {l:"Vencimento preferido",v:cliente.DIA_VENCIMENTO_PREFERIDO},{l:"Cadastro",v:fmtDt(cliente.DATA_CADASTRO)},{l:"Observações",v:cliente.OBSERVACOES}
              ].map(i=><div key={i.l} style={{background:CARD,padding:15,borderRadius:10,border:`1px solid ${BD}`,gridColumn:i.l==="Endereço"||i.l==="Observações"?"1/-1":"auto"}}><span style={LS()}>{i.l}</span><div style={{fontSize:13,fontWeight:600,wordBreak:"break-word"}}>{i.v||"—"}</div></div>)}
              {(()=>{
                const base={...cliente,...(scoreLocal||{})};
                const sc=parseFloat(base.SCORE||0);
                const faixa=base.SCORE_FAIXA||"";
                const decisao=base.SCORE_DECISAO||"";
                const bloq=String(base.SCORE_BLOQUEADO||"").toUpperCase()==="SIM";
                const motivos=String(base.SCORE_MOTIVOS||"").split("|").map(s=>s.trim()).filter(Boolean);
                const limSug=parseFloat(base.SCORE_LIMITE_SUGERIDO||0);
                const parMax=parseFloat(base.SCORE_PARCELA_MAX||0);
                const prazo=parseInt(base.SCORE_PRAZO_MAX||0);
                const taxaLabel=base.SCORE_TAXA_LABEL||"";
                const taxaPct=parseFloat(base.SCORE_TAXA_PCT||0);
                const taxaStr=taxaPct>0?`${taxaLabel} (${taxaPct}% a.m.)`:taxaLabel||"—";
                const dtSc=base.SCORE_DATA;
                const scCor=sc>=75?GRN:sc>=45?YEL:RED;
                const hasScore=faixa!=="";
                return(
                  <div style={{background:CARD,padding:16,borderRadius:10,border:`1px solid ${bloq?RED+"50":hasScore?scCor+"30":BD}`,gridColumn:"1/-1"}}>
                    <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",gap:8}}>
                      <span style={LS()}>Score de Crédito</span>
                      <div style={{display:"flex",gap:6}}>
                        {onSimular&&<button onClick={()=>onSimular({
                          valor: parseFloat(base.SCORE_LIMITE_SUGERIDO||0)||1000,
                          prazo: parseInt(base.SCORE_PRAZO_MAX||0)||6,
                          taxa:  parseFloat(base.SCORE_TAXA_PCT||0)||18,
                          renda: parseFloat(cliente.RENDA_MENSAL||0)||0,
                          parcelaMax: parseFloat(base.SCORE_PARCELA_MAX||0)||0,
                          nome:  cliente.NOME||cliente.NOME_CLIENTE||"",
                        })} style={{fontSize:11,fontWeight:700,padding:"4px 12px",borderRadius:20,border:`1px solid ${BLU}40`,background:BLU+"15",color:BLU,cursor:"pointer"}}>
                          Simular
                        </button>}
                        <button onClick={recalcularScore} disabled={scoreLoading} style={{fontSize:11,fontWeight:700,padding:"4px 12px",borderRadius:20,border:`1px solid ${GRN}40`,background:GRN+"15",color:GRN,cursor:scoreLoading?"wait":"pointer",opacity:scoreLoading?0.6:1}}>
                          {scoreLoading?"Calculando...":"Recalcular"}
                        </button>
                      </div>
                    </div>
                    {!hasScore?<div style={{fontSize:13,color:MUTED,marginTop:8}}>Score não calculado. Clique em "Recalcular" ou preencha os dados financeiros primeiro.</div>:(
                      <>
                        <div style={{display:"flex",gap:20,alignItems:"center",marginTop:12,flexWrap:"wrap"}}>
                          <div style={{width:90,height:90,borderRadius:"50%",flexShrink:0,background:`conic-gradient(${scCor} 0% ${sc}%, #2a2a3e ${sc}% 100%)`,display:"flex",alignItems:"center",justifyContent:"center"}}>
                            <div style={{width:68,height:68,borderRadius:"50%",background:BG,display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center"}}>
                              <span style={{fontSize:22,fontWeight:900,color:scCor,lineHeight:1}}>{sc}</span>
                              <span style={{fontSize:9,color:MUTED,fontWeight:700}}>/100</span>
                            </div>
                          </div>
                          <div style={{flex:1,minWidth:0}}>
                            <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:6}}>
                              <span style={{fontSize:17,fontWeight:800,color:scCor}}>{faixa}</span>
                              {bloq&&<span style={{background:RED+"20",color:RED,fontSize:10,fontWeight:700,padding:"2px 8px",borderRadius:20,border:`1px solid ${RED}40`}}>BLOQUEADO</span>}
                            </div>
                            <div style={{fontSize:12,color:MUTED,marginBottom:10}}>Decisão: <span style={{fontWeight:700,color:sc>=60?GRN:sc>=45?YEL:RED}}>{decisao}</span></div>
                            <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(110px,1fr))",gap:8}}>
                              {[{l:"Limite sugerido",v:fmtR(limSug)},{l:"Parcela máx.",v:fmtR(parMax)},{l:"Prazo máx.",v:prazo>0?`${prazo}x`:"—"},{l:"Taxa",v:taxaStr}].map(m=>(
                                <div key={m.l} style={{background:BG,padding:"8px 10px",borderRadius:8,border:`1px solid ${BD}`}}>
                                  <div style={{fontSize:9,color:MUTED,fontWeight:700,textTransform:"uppercase",marginBottom:3}}>{m.l}</div>
                                  <div style={{fontSize:12,fontWeight:800,color:m.v==="—"?MUTED:BLU}}>{m.v}</div>
                                </div>
                              ))}
                            </div>
                          </div>
                        </div>
                        {motivos.length>0&&<div style={{marginTop:12,display:"flex",flexWrap:"wrap",gap:6}}>{motivos.map((m,i)=>{const pos=m.startsWith("+");const neg=m.startsWith("-")||m.startsWith("BLOQ");return<span key={i} style={{fontSize:10,padding:"2px 8px",borderRadius:20,fontWeight:700,background:pos?GRN+"15":neg?RED+"15":MUTED+"15",color:pos?GRN:neg?RED:MUTED,border:`1px solid ${pos?GRN:neg?RED:MUTED}30`}}>{m}</span>})}</div>}
                        {dtSc&&<div style={{fontSize:10,color:MUTED,marginTop:8}}>Atualizado: {fmtDt(dtSc)}{scoreLocal&&<span style={{color:GRN,marginLeft:6}}>✓ recalculado agora</span>}</div>}
                        {(()=>{
                          const renovStatus=String(base.RENOVACAO_STATUS||"").trim();
                          const renovMotivo=String(base.RENOVACAO_MOTIVO||"").trim();
                          const renovCondicoes=String(base.RENOVACAO_CONDICOES||"").trim();
                          if(!renovStatus) return null;
                          const cond={};
                          renovCondicoes.split("|").forEach(p=>{const idx=p.indexOf(":");if(idx>0)cond[p.slice(0,idx).trim()]=p.slice(idx+1).trim();});
                          const isVerde=renovStatus==="verde";
                          const isAmarelo=renovStatus==="amarelo";
                          const cor=isVerde?GRN:isAmarelo?YEL:RED;
                          const label=isVerde?"RENOVAR":isAmarelo?"ANALISAR":"NÃO RENOVAR";
                          const limiteRenov=parseFloat(cond.limite||0);
                          const prazoRenov=parseInt(cond.prazo||0);
                          const taxaRenov=parseFloat(cond.taxa||0);
                          const taxaLabelRenov=cond.taxa_label||"";
                          return(
                            <div style={{marginTop:16,paddingTop:14,borderTop:`1px solid ${BD}`}}>
                              <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:8}}>
                                <span style={{fontSize:11,fontWeight:700,textTransform:"uppercase",color:MUTED,letterSpacing:"0.05em"}}>Recomendação de Renovação</span>
                                <span style={{fontSize:11,fontWeight:800,padding:"3px 12px",borderRadius:20,background:cor+"20",color:cor,border:`1px solid ${cor}40`}}>{label}</span>
                              </div>
                              <div style={{fontSize:12,color:MUTED,marginBottom:(isVerde||isAmarelo)&&limiteRenov>0?10:0}}>{renovMotivo}</div>
                              {(isVerde||isAmarelo)&&limiteRenov>0&&(
                                <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(110px,1fr))",gap:8,alignItems:"center"}}>
                                  {[{l:"Limite sugerido",v:fmtR(limiteRenov)},{l:"Prazo máx.",v:prazoRenov>0?`${prazoRenov}x`:"—"},{l:"Taxa",v:taxaRenov>0?`${taxaLabelRenov} (${taxaRenov}% a.m.)`:"—"}].map(m=>(
                                    <div key={m.l} style={{background:BG,padding:"8px 10px",borderRadius:8,border:`1px solid ${BD}`}}>
                                      <div style={{fontSize:9,color:MUTED,fontWeight:700,textTransform:"uppercase",marginBottom:3}}>{m.l}</div>
                                      <div style={{fontSize:12,fontWeight:800,color:m.v==="—"?MUTED:cor}}>{m.v}</div>
                                    </div>
                                  ))}
                                  {onSimular&&<button onClick={()=>onSimular({valor:limiteRenov||parseFloat(base.SCORE_LIMITE_SUGERIDO||0)||1000,prazo:prazoRenov||parseInt(base.SCORE_PRAZO_MAX||0)||6,taxa:taxaRenov||parseFloat(base.SCORE_TAXA_PCT||0)||18,renda:parseFloat(cliente.RENDA_MENSAL||0)||0,parcelaMax:parseFloat(base.SCORE_PARCELA_MAX||0)||0,nome:cliente.NOME||cliente.NOME_CLIENTE||""})} style={{fontSize:11,fontWeight:700,padding:"6px 14px",borderRadius:20,border:`1px solid ${cor}40`,background:cor+"15",color:cor,cursor:"pointer",whiteSpace:"nowrap"}}>Simular Renovação</button>}
                                </div>
                              )}
                            </div>
                          );
                        })()}
                      </>
                    )}
                  </div>
                );
              })()}
              <div style={{background:CARD,padding:16,borderRadius:10,border:`1px solid ${limite>0&&pctUso>80?RED+"50":BD}`,gridColumn:"1/-1"}}>
                <span style={LS()}>Limite de Crédito</span>
                {limite>0?(
                  <>
                    <div style={{display:"flex",justifyContent:"space-between",alignItems:"baseline",margin:"8px 0 6px"}}>
                      <span style={{fontSize:13,color:MUTED}}>{fmtR(principalEmUso)} em uso</span>
                      <span style={{fontSize:14,fontWeight:800,color:BLU}}>{fmtR(limite)} total</span>
                    </div>
                    <div style={{background:BD,borderRadius:8,height:10,overflow:"hidden"}}>
                      <div style={{width:`${pctUso}%`,height:"100%",background:pctUso>80?RED:pctUso>50?YEL:GRN,borderRadius:8,transition:"width 0.5s"}}/>
                    </div>
                    <div style={{display:"flex",justifyContent:"space-between",marginTop:6}}>
                      <span style={{fontSize:11,color:pctUso>80?RED:MUTED,fontWeight:700}}>{pctUso.toFixed(0)}% utilizado</span>
                      <span style={{fontSize:11,color:GRN,fontWeight:700}}>Disponivel: {fmtR(disponivel)}</span>
                    </div>
                  </>
                ):<div style={{fontSize:13,color:MUTED,marginTop:6}}>Não definido — edite o cliente para cadastrar.</div>}
              </div>
            </div>
          )}
          {t==="editar"&&(
            <div style={{display:"flex",flexDirection:"column",gap:20}}>
              <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:14}}>
                <CampoEdit edit={edit} setEdit={setEdit} erros={erros} label="Nome completo" field="NOME" fixup={titleCasePT}/>
                <CampoEdit edit={edit} setEdit={setEdit} erros={erros} label="Telefone/WhatsApp" field="TELEFONE_WPP" fixup={normTel}/>
                <CampoEdit edit={edit} setEdit={setEdit} erros={erros} label="Email" field="EMAIL" tipo="email" fixup={fixEmail}/>
                <CampoEdit edit={edit} setEdit={setEdit} erros={erros} label="CPF" field="CPF"/>
                <CampoEdit edit={edit} setEdit={setEdit} erros={erros} label="RG" field="RG"/>
                <CampoEdit edit={edit} setEdit={setEdit} erros={erros} label="Profissão" field="PROFISSAO"/>
                <CampoEdit edit={edit} setEdit={setEdit} erros={erros} label="Estado Civil" field="ESTADO_CIVIL" opts={[{v:"",l:"—"},{v:"Solteiro(a)",l:"Solteiro(a)"},{v:"Casado(a)",l:"Casado(a)"},{v:"Divorciado(a)",l:"Divorciado(a)"},{v:"Viúvo(a)",l:"Viúvo(a)"},{v:"União Estável",l:"União Estável"}]}/>
                <CampoEdit edit={edit} setEdit={setEdit} erros={erros} label="Nacionalidade" field="NACIONALIDADE"/>
                <CampoEdit edit={edit} setEdit={setEdit} erros={erros} label="Status" field="STATUS_CLIENTE" opts={[{v:"ativo",l:"Ativo"},{v:"inativo",l:"Inativo"},{v:"aguardando_conferencia",l:"Aguardando Conferência"},{v:"bloqueado",l:"Bloqueado"}]}/>
                <CampoEdit edit={edit} setEdit={setEdit} erros={erros} label="Dia vencimento preferido" field="DIA_VENCIMENTO_PREFERIDO"/>
                <CampoEdit edit={edit} setEdit={setEdit} erros={erros} label="Limite de Crédito (R$)" field="LIMITE_CREDITO" tipo="number"/>
                <div>
                  <CampoEdit edit={edit} setEdit={setEdit} erros={erros} label="Renda Mensal (R$)" field="RENDA_MENSAL" tipo="number"/>
                  {(()=>{
                    const rl=parseFloat(cliente.RENDA_LIQUIDA||0)||0;
                    const rb=parseFloat(cliente.RENDA_BRUTA||0)||0;
                    if(!rl&&!rb) return null;
                    return(
                      <div style={{marginTop:5,padding:"5px 10px",background:BLU+"10",border:`1px solid ${BLU}30`,borderRadius:8,display:"flex",gap:12,flexWrap:"wrap"}}>
                        <span style={{fontSize:11,color:MUTED,fontWeight:600}}>Contracheque:</span>
                        {rl>0&&<span style={{fontSize:11,color:BLU,fontWeight:700}}>Líquido: {fmtR(rl)}</span>}
                        {rb>0&&<span style={{fontSize:11,color:MUTED}}>Bruto: {fmtR(rb)}</span>}
                      </div>
                    );
                  })()}
                </div>
                <CampoEdit edit={edit} setEdit={setEdit} erros={erros} label="Tipo de Renda" field="TIPO_RENDA" opts={[{v:"",l:"—"},{v:"CLT",l:"CLT"},{v:"Servidor",l:"Servidor Público"},{v:"Aposentado",l:"Aposentado"},{v:"Pensionista",l:"Pensionista"},{v:"Autonomo",l:"Autônomo"},{v:"Informal",l:"Informal"}]}/>
                <CampoEdit edit={edit} setEdit={setEdit} erros={erros} label="Renda Comprovada" field="RENDA_COMPROVADA" opts={[{v:"",l:"—"},{v:"Sim",l:"Sim"},{v:"Parcial",l:"Parcial"},{v:"Nao",l:"Não"}]}/>
                <div style={{gridColumn:"1/-1"}}><CampoEdit edit={edit} setEdit={setEdit} erros={erros} label="Qualidade da Comunicação" field="QUALIDADE_COMUNICACAO" opts={[{v:"",l:"—"},{v:"Boa",l:"Boa"},{v:"Regular",l:"Regular"},{v:"Ruim",l:"Ruim"}]}/></div>
              </div>
              <div style={{borderTop:`1px solid ${BD}`,paddingTop:16}}>
                <div style={{fontSize:11,fontWeight:700,color:MUTED,textTransform:"uppercase",marginBottom:12}}>Contatos de Confiança</div>
                <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:14}}>
                  <CampoEdit edit={edit} setEdit={setEdit} erros={erros} label="Contato confiança 1" field="CONTATO_CONFIANCA_1" fixup={titleCasePT}/>
                  <CampoEdit edit={edit} setEdit={setEdit} erros={erros} label="Telefone confiança 1" field="TEL_CONFIANCA_1" fixup={normTel}/>
                  <CampoEdit edit={edit} setEdit={setEdit} erros={erros} label="Contato confiança 2" field="CONTATO_CONFIANCA_2" fixup={titleCasePT}/>
                  <CampoEdit edit={edit} setEdit={setEdit} erros={erros} label="Telefone confiança 2" field="TEL_CONFIANCA_2" fixup={normTel}/>
                  <div style={{position:"relative"}} ref={padRef}>
                    <span style={LS()}>Padrinho</span>
                    <div style={{position:"relative"}}>
                      <input value={padSearch} onChange={e=>{setPadSearch(e.target.value);setEdit(p=>({...p,PADRINHO:e.target.value}));setPadDrop(true);}} onFocus={()=>setPadDrop(true)} placeholder="Buscar cliente..." style={{...IS(),border:`1px solid ${erros.PADRINHO?RED:BD}`,background:erros.PADRINHO?RED+"06":CARD}}/>
                      {padSearch&&<button onClick={()=>{setPadSearch("");setEdit(p=>({...p,PADRINHO:"",TEL_PADRINHO:""}));}} style={{position:"absolute",right:8,top:"50%",transform:"translateY(-50%)",border:"none",background:"none",cursor:"pointer",color:MUTED,fontSize:16}}>×</button>}
                    </div>
                    {erros.PADRINHO&&<div style={{fontSize:10,color:RED,fontWeight:600,marginTop:3}}>⚠ {erros.PADRINHO}</div>}
                    {padDrop&&padSugestoes.length>0&&<div style={{position:"absolute",top:"100%",left:0,right:0,background:CARD,border:`1px solid ${BD}`,borderRadius:8,marginTop:4,zIndex:400,boxShadow:"0 10px 30px rgba(0,0,0,0.15)",maxHeight:220,overflowY:"auto"}}>
                      {padSugestoes.map(c=><div key={c.ID_CLIENTE} onClick={()=>selecionarPadrinho(c)} style={{padding:"10px 14px",cursor:"pointer",fontSize:13,borderBottom:`1px solid ${BG}`}} onMouseEnter={e=>e.currentTarget.style.background=BG} onMouseLeave={e=>e.currentTarget.style.background=CARD}>
                        <div style={{fontWeight:700}}>{c.NOME||c.NOME_CLIENTE}</div>
                        <div style={{fontSize:11,color:MUTED}}>{c.TELEFONE_WPP||c.TELEFONE||"Sem telefone"}</div>
                      </div>)}
                    </div>}
                  </div>
                  <CampoEdit edit={edit} setEdit={setEdit} erros={erros} label="Tel. Padrinho" field="TEL_PADRINHO" fixup={normTel}/>
                </div>
              </div>
              <div style={{borderTop:`1px solid ${BD}`,paddingTop:16}}>
                <div style={{fontSize:11,fontWeight:700,color:MUTED,textTransform:"uppercase",marginBottom:12}}>Endereço</div>
                <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:14}}>
                  <CampoEdit edit={edit} setEdit={setEdit} erros={erros} label="CEP" field="CEP"/>
                  <CampoEdit edit={edit} setEdit={setEdit} erros={erros} label="Cidade / Estado" field="CIDADE_ESTADO"/>
                  <CampoEdit edit={edit} setEdit={setEdit} erros={erros} label="Rua / Avenida" field="RUA"/>
                  <CampoEdit edit={edit} setEdit={setEdit} erros={erros} label="Número" field="NUMERO"/>
                  <CampoEdit edit={edit} setEdit={setEdit} erros={erros} label="Quadra" field="QUADRA"/>
                  <CampoEdit edit={edit} setEdit={setEdit} erros={erros} label="Lote" field="LOTE"/>
                  <CampoEdit edit={edit} setEdit={setEdit} erros={erros} label="Setor / Bairro" field="SETOR"/>
                  <CampoEdit edit={edit} setEdit={setEdit} erros={erros} label="Complemento" field="COMPLEMENTO"/>
                </div>
              </div>
              <div>
                <span style={LS()}>Observações</span>
                <textarea value={edit.OBSERVACOES} onChange={e=>setEdit(p=>({...p,OBSERVACOES:e.target.value}))} style={{...IS(),height:80,resize:"none"}}/>
              </div>
              {saveMsg&&(
                <div style={{padding:"10px 14px",borderRadius:8,background:saveMsg.ok?GRN+"10":RED+"10",color:saveMsg.ok?GRN:RED,fontSize:13,fontWeight:700,border:`1px solid ${saveMsg.ok?GRN:RED}25`}}>
                  {""}{saveMsg.t}
                </div>
              )}
              {temErros&&<div style={{padding:"10px 14px",borderRadius:8,background:RED+"10",color:RED,fontSize:12,fontWeight:700,border:`1px solid ${RED}25`}}>
                {nErros} campo{nErros>1?"s":""} com erro ou não preenchido{nErros>1?"s":""} — corrija antes de salvar.
              </div>}
              <button onClick={salvar} disabled={saving||temErros} style={BTN1(saving||temErros)}>
                {saving?<><IcoSpinner color="#1B3305"/> Salvando...</>:<>{IcoCheck} Salvar e Ativar Cliente</>}
              </button>
            </div>
          )}
          {t==="todos os dados"&&(
            <div style={{display:"grid",gridTemplateColumns:"repeat(2,1fr)",gap:12}}>{campos.map(([k,v])=><div key={k} style={{background:CARD,padding:13,borderRadius:10,border:`1px solid ${BD}`}}><span style={LS()}>{label(k)}</span><div style={{fontSize:13,fontWeight:600,wordBreak:"break-word"}}>{String(v)}</div></div>)}</div>
          )}
          {t.startsWith("contratos")&&(
            <div style={{display:"flex",flexDirection:"column",gap:10}}>
              {contratosDoCliente.map(c=>{
                const st=String(c.STATUS_CONTRATO||"").toLowerCase();
                const _stCor={quitado:GRN,recuperado_integralmente:GRN,recuperado_parcialmente:YEL,ativo:BLU,ativo_em_dia:GRN,ativo_em_atraso:RED,em_cobranca:RED,pre_prejuizo:RED,renegociado:YEL,em_recuperacao:YEL,baixado_como_prejuizo:MUTED,cancelado:MUTED,encerrado_sem_recuperacao:MUTED};
                const _stLbl={quitado:"Quitado",recuperado_integralmente:"Recuperado Total",recuperado_parcialmente:"Recuperado Parcial",ativo:"Ativo",ativo_em_dia:"Em Dia",ativo_em_atraso:"Em Atraso",em_cobranca:"Em Cobrança",pre_prejuizo:"Pré-Prejuízo",renegociado:"Renegociado",em_recuperacao:"Em Recuperação",baixado_como_prejuizo:"Baixado",cancelado:"Cancelado",encerrado_sem_recuperacao:"Encerrado"};
                const cor=_stCor[st]||MUTED;
                const ps=(parcelas||[]).filter(p=>String(p.ID_CONTRATO)===String(c.ID_CONTRATO));
                const pagas=ps.filter(p=>["pago","quitacao_antecipada"].includes(statusEfetivo(p))).length;
                return(
                  <div key={c.ID_CONTRATO} style={{background:CARD,padding:16,borderRadius:16,border:`1px solid ${BD}`,display:"flex",gap:12,alignItems:"center"}}>
                    <div style={{flex:1,minWidth:0}}>
                      <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:5}}>
                        <span style={{fontSize:12,fontWeight:800,color:TEXT}}>{c.ID_CONTRATO}</span>
                        <span style={{fontSize:10,fontWeight:700,color:cor,background:cor+"18",padding:"2px 8px",borderRadius:20,border:`1px solid ${cor}30`}}>{_stLbl[st]||st}</span>
                      </div>
                      <div style={{fontSize:16,fontWeight:800,color:ORG,marginBottom:3}}>{fmtR(parseFloat(c.VALOR_PRINCIPAL||0))}</div>
                      <div style={{fontSize:11,color:MUTED}}>{c.TOTAL_PARCELAS}x · {pagas}/{ps.length} pagas · desde {fmtDt(c.DATA_EMPRESTIMO)}</div>
                    </div>
                    {onVerContrato&&<button onClick={()=>onVerContrato(c)} style={{padding:"9px 16px",borderRadius:8,border:`1px solid ${BD}`,background:BG,color:TEXT,fontWeight:700,fontSize:12,cursor:"pointer",whiteSpace:"nowrap",flexShrink:0}}>Abrir →</button>}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function PagamentoDrop({contratos,parcelas,clientes,onSucesso,onSelecionarParcela}){
  const [busca,setBusca]=useState("");const [showDrop,setShowDrop]=useState(false);const [cliente,setCliente]=useState(null);const [parcela,setParcela]=useState(null);const [tipo,setTipo]=useState(null);const [data,setData]=useState(hojeStr());const [valor,setValor]=useState("");const [loading,setLoading]=useState(false);const [msg,setMsg]=useState(null);const ref=useRef();
  useEffect(()=>{const h=e=>{if(ref.current&&!ref.current.contains(e.target))setShowDrop(false);};document.addEventListener("mousedown",h);return()=>document.removeEventListener("mousedown",h);},[]);
  const ST_ATIVOS_PAG=new Set(["ativo","ativo_em_dia","ativo_em_atraso","em_cobranca","pre_prejuizo","renegociado","em_recuperacao","recuperado_parcialmente"]);
  const clis=useMemo(()=>{if(busca.length<2)return[];const ids=new Set();return (contratos||[]).filter(c=>{if(!ST_ATIVOS_PAG.has(String(c.STATUS_CONTRATO||"").toLowerCase()))return false;const m=(c.NOME_CLIENTE||"").toLowerCase().includes(busca.toLowerCase())||String(c.ID_CLIENTE||"").toLowerCase().includes(busca.toLowerCase());if(m&&!ids.has(c.ID_CLIENTE)){ids.add(c.ID_CLIENTE);return true;}return false;}).slice(0,6);},[busca,contratos]);
  const pars=useMemo(()=>cliente?(parcelas||[]).filter(p=>String(p.ID_CLIENTE)===String(cliente.ID_CLIENTE)&&["pendente","atrasado","vence_hoje"].includes(p.STATUS)).sort((a,b)=>toNum(a.DATA_VENCIMENTO)-toNum(b.DATA_VENCIMENTO)):[],[cliente,parcelas]);
  const registrar=async()=>{if(!parcela||!valor||!data)return;setLoading(true);setMsg(null);const res=await postAction({action:tipo==="parcial"?"pagamentoParcial":"pagamento",idParcela:parcela.ID_PARCELA,valor:parseFloat(valor),data:apiDateStr(data),forma:"dinheiro"});if(res.ok){setMsg({ok:true,t:res.msg||(res.contratoQuitado?"✓ Contrato QUITADO!":"Sucesso!")});gerarEEnviarComprovante(parcela,parseFloat(valor),data,tipo==="parcial"?"Somente Juros":"Pagamento Total",parcelas,contratos,clientes);setTimeout(()=>onSucesso(res,parcela),1500);}else setMsg({ok:false,t:res.erro||"Erro"});setLoading(false);};
  const [showParsDrop,setShowParsDrop]=useState(false);
  const selecionarParcela=p=>{if(!p)return;setShowParsDrop(false);if(onSelecionarParcela){setParcela(null);setTipo(null);setValor("");onSelecionarParcela(p);return;}setParcela(p);setTipo("total");setValor(parseFloat(p.VALOR_PARCELA||0).toFixed(2));};
  const _hoje=new Date();_hoje.setHours(0,0,0,0);
  const isHoje=p=>{const d=parseDate(p.DATA_VENCIMENTO);if(!d)return false;const dd=new Date(d);dd.setHours(0,0,0,0);return dd.getTime()===_hoje.getTime();};
  const isAtrasada=p=>p.STATUS==='atrasado'||parseInt(p.DIAS_ATRASO||0)>0||p.STATUS==='vence_hoje';
  return(
    <div style={{background:CARD,borderRadius:16,padding:20,border:`1px solid ${BD}`,boxShadow:SHD}}>
      <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:16}}><div style={{background:GRN+"15",color:GRN,padding:8,borderRadius:8}}>{IcoPag}</div><h3 style={{margin:0,fontSize:15,fontWeight:700}}>Registrar Pagamento</h3></div>
      <div style={{display:"flex",flexDirection:"column",gap:12}}>
        <div style={{position:"relative"}} ref={ref}>
          <span style={LS()}>Buscar Cliente</span>
          <div style={{position:"relative"}}><div style={{position:"absolute",left:10,top:"50%",transform:"translateY(-50%)"}}>{IcoSrch}</div><input value={cliente?cliente.NOME_CLIENTE:busca} onChange={e=>{setBusca(e.target.value);setCliente(null);setParcela(null);setShowDrop(true);}} onFocus={()=>setShowDrop(true)} placeholder="Nome ou ID..." style={{...IS(),paddingLeft:32}}/>{cliente&&<button onClick={()=>{setCliente(null);setBusca("");}} style={{position:"absolute",right:8,top:"50%",transform:"translateY(-50%)",border:"none",background:"none",cursor:"pointer",color:MUTED,fontSize:16}}>×</button>}</div>
          {showDrop&&clis.length>0&&<div style={{position:"absolute",top:"100%",left:0,right:0,background:CARD,border:`1px solid ${BD}`,borderRadius:8,marginTop:4,zIndex:100,boxShadow:"0 10px 30px rgba(0,0,0,0.1)"}}>{clis.map(c=><div key={c.ID_CLIENTE} onClick={()=>{setCliente(c);setShowDrop(false);}} style={{padding:"10px 14px",cursor:"pointer",fontSize:13,borderBottom:`1px solid ${BG}`}} onMouseEnter={e=>e.currentTarget.style.background=BG} onMouseLeave={e=>e.currentTarget.style.background=CARD}><strong>{c.ID_CLIENTE}</strong> - {c.NOME_CLIENTE}</div>)}</div>}
        </div>
        {cliente&&<div><span style={LS()}>Parcela</span>{pars.length>0?(
          <div style={{position:"relative"}}>
            <div onClick={()=>setShowParsDrop(v=>!v)} style={{...IS(),cursor:"pointer",display:"flex",justifyContent:"space-between",alignItems:"center",userSelect:"none"}}>
              {parcela
                ?<span style={{color:isAtrasada(parcela)?RED:TEXT,fontWeight:isAtrasada(parcela)?700:400,display:"flex",alignItems:"center",gap:5,flexWrap:"wrap"}}>
                    {isAtrasada(parcela)&&"⚠ "}Parc {parcela.NUM_PARCELA} ({fmtDt(parcela.DATA_VENCIMENTO)}) — {fmtR(parcela.VALOR_PARCELA)}
                    {isUltima(parcela,parcelas)&&<span style={{fontSize:9,fontWeight:800,color:GRN,background:GRN+"18",padding:"1px 6px",borderRadius:99}}>última</span>}
                    {parseInt(parcela.DIAS_ATRASO||0)>0&&<span style={{fontSize:11,color:RED}}>{parcela.DIAS_ATRASO}d atraso</span>}
                    {isHoje(parcela)&&!isAtrasada(parcela)&&<span style={{fontSize:11,color:ORG}}>vence hoje</span>}
                  </span>
                :<span style={{color:MUTED}}>Selecione...</span>}
              <span style={{color:MUTED,fontSize:10}}>▾</span>
            </div>
            {showParsDrop&&<div style={{position:"absolute",top:"100%",left:0,right:0,background:CARD,border:`1px solid ${BD}`,borderRadius:8,marginTop:4,zIndex:200,boxShadow:"0 10px 30px rgba(0,0,0,0.12)",maxHeight:220,overflowY:"auto"}}>
              {pars.map(p=>{
                const atrasada=isAtrasada(p);
                const dias=parseInt(p.DIAS_ATRASO||0);
                return<div key={p.ID_PARCELA} onClick={()=>selecionarParcela(p)}
                  style={{padding:"10px 14px",cursor:"pointer",borderBottom:`1px solid ${BG}`,background:atrasada?RED+"06":CARD,display:"flex",justifyContent:"space-between",alignItems:"center"}}
                  onMouseEnter={e=>e.currentTarget.style.background=atrasada?RED+"12":BG}
                  onMouseLeave={e=>e.currentTarget.style.background=atrasada?RED+"06":CARD}>
                  <span style={{fontWeight:600,color:atrasada?RED:TEXT,fontSize:13,display:"flex",alignItems:"center",gap:5}}>
                    {atrasada&&"⚠ "}Parc {p.NUM_PARCELA} ({fmtDt(p.DATA_VENCIMENTO)}){isUltima(p,parcelas)&&<span style={{fontSize:9,fontWeight:800,color:GRN,background:GRN+"18",padding:"1px 6px",borderRadius:99}}>última</span>}
                  </span>
                  <span style={{display:"flex",alignItems:"center",gap:8}}>
                    {dias>0&&<span style={{fontSize:11,fontWeight:700,color:RED,background:RED+"12",padding:"2px 7px",borderRadius:99}}>{dias}d</span>}
                    {(p.STATUS==='vence_hoje'||isHoje(p))&&!isAtrasada(p)&&<span style={{fontSize:11,fontWeight:700,color:ORG,background:ORG+"15",padding:"2px 7px",borderRadius:99}}>hoje</span>}
                    <span style={{fontWeight:700,color:atrasada?RED:TEXT,fontSize:13}}>{fmtR(p.VALOR_PARCELA)}</span>
                  </span>
                </div>;
              })}
            </div>}
          </div>
        ):<div style={{padding:8,background:RED+"08",color:RED,fontSize:12,borderRadius:6}}>Nenhuma parcela pendente.</div>}</div>}
        {parcela&&<div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10}}>
          <div><span style={LS()}>Tipo</span><select value={tipo||""} onChange={e=>{const t=e.target.value;setTipo(t);if(t==="total")setValor(parseFloat(parcela?.VALOR_PARCELA||0).toFixed(2));else if(t==="parcial")setValor(parseFloat(parcela?.VALOR_JUROS||0).toFixed(2));}} style={IS()}><option value="">Selecione...</option><option value="total">Total</option><option value="parcial">Somente Juros</option></select></div>
          <div><span style={LS()}>Valor</span><input type="number" value={valor} onChange={e=>setValor(e.target.value)} style={IS()}/></div>
          <div style={{gridColumn:"1/-1"}}><span style={LS()}>Data</span><input type="date" value={data} onChange={e=>setData(e.target.value)} style={IS()}/></div>
          <button onClick={registrar} disabled={loading||!tipo} style={{gridColumn:"1/-1",padding:"11px",borderRadius:12,border:"none",background:ACC,color:"#163300",fontWeight:700,cursor:"pointer",opacity:loading||!tipo?0.6:1}}>{loading?"Processando...":"Confirmar"}</button>
        </div>}
        {msg&&<div style={{padding:10,borderRadius:8,background:msg.ok?GRN+"10":RED+"10",color:msg.ok?GRN:RED,fontSize:12,textAlign:"center",fontWeight:600}}>{msg.t}</div>}
      </div>
    </div>
  );
}

function PagamentoParcelaModal({parcela,parcelas,contratos,clientes,onConfirmar,onFechar,initialModo="pagamento"}){
  const [tipo,setTipo]=useState("total");
  const [data,setData]=useState(hojeStr());
  const [valor,setValor]=useState(parseFloat(parcela?.VALOR_PARCELA||0).toFixed(2));
  const [loading,setLoading]=useState(false);
  const [msg,setMsg]=useState(null);
  const [modo,setModo]=useState(initialModo); // "pagamento" | "reagendar"
  const [promData,setPromData]=useState("");
  const [promObs,setPromObs]=useState("");
  const [comprovanteData,setComprovanteData]=useState(null);
  const resRef=useRef(null);

  const registrar=async()=>{if(!parcela||!valor||!data)return;setLoading(true);setMsg(null);const res=await postAction({action:tipo==="parcial"?"pagamentoParcial":"pagamento",idParcela:parcela.ID_PARCELA,valor:parseFloat(valor),data:apiDateStr(data),forma:"dinheiro"});if(res.ok){resRef.current=res;setComprovanteData({valorPago:parseFloat(valor),dataPago:data,tipoLabel:tipo==="parcial"?"Somente Juros":"Pagamento Total"});}else setMsg({ok:false,t:res.erro||"Erro ao registrar pagamento"});setLoading(false);};

  const reagendar=async()=>{
    if(!promData)return;
    setLoading(true);setMsg(null);
    const res=await postAction({action:"registrarPromessa",dados:{
      idContrato:parcela.ID_CONTRATO,
      idCliente:parcela.ID_CLIENTE,
      idParcela:parcela.ID_PARCELA,
      nomeCliente:parcela.NOME_CLIENTE||"",
      dataPrevista:promData,
      valorPrometido:parseFloat(parcela.VALOR_PARCELA||0),
      observacao:promObs||`Promessa ref. Parcela ${parcela.NUM_PARCELA}`
    }});
    if(res.ok){setMsg({ok:true,t:"Promessa registrada!"});setTimeout(onFechar,1200);}
    else setMsg({ok:false,t:res.erro||"Erro."});
    setLoading(false);
  };

  if(comprovanteData) return <ComprovanteEnvioModal parcela={parcela} valorPago={comprovanteData.valorPago} dataPago={comprovanteData.dataPago} tipoLabel={comprovanteData.tipoLabel} parcelas={parcelas} contratos={contratos} clientes={clientes} onFechar={()=>{setComprovanteData(null);onConfirmar(resRef.current);}}/>;

  return(
    <div style={{position:"fixed",inset:0,zIndex:300,background:"rgba(15,23,42,0.35)",display:"flex",alignItems:"center",justifyContent:"center",padding:20}} onClick={onFechar}>
      <div onClick={e=>e.stopPropagation()} style={{width:"100%",maxWidth:420,background:CARD,borderRadius:14,border:`1px solid ${BD}`,boxShadow:"0 24px 80px rgba(15,23,42,0.22)",overflow:"hidden",minWidth:0,animation:"fadeUp 0.25s cubic-bezier(0.16,1,0.3,1)"}}>
        <div style={{padding:"18px 20px",borderBottom:`1px solid ${BD}`}}>
          <h2 style={{margin:0,fontSize:17,fontWeight:800}}>{modo==="reagendar"?"Reagendar Parcela":"Registrar pagamento"}</h2>
          <p style={{margin:"5px 0 0",fontSize:12,color:MUTED}}>{parcela?.NOME_CLIENTE||"Cliente"} · Parcela {parcela?.NUM_PARCELA||parcela?.NUMERO_PARCELA||parcela?.ID_PARCELA||"—"}</p>
        </div>
        <div style={{padding:20,display:"flex",flexDirection:"column",gap:12}}>
        {modo==="pagamento"?(
          <>
          <div><span style={LS()}>Tipo</span><select value={tipo} onChange={e=>{const t=e.target.value;setTipo(t);if(t==="total")setValor(parseFloat(parcela?.VALOR_PARCELA||0).toFixed(2));else setValor(parseFloat(parcela?.VALOR_JUROS||0).toFixed(2));}} style={IS()}><option value="total">Pagamento total</option><option value="parcial">Somente juros</option></select></div>
          <div><span style={LS()}>Valor</span><input type="number" value={valor} onChange={e=>setValor(e.target.value)} style={IS()}/></div>
          <div><span style={LS()}>Data</span><input type="date" value={data} onChange={e=>setData(e.target.value)} style={IS()}/></div>
          {msg&&<div style={{padding:10,borderRadius:8,background:msg.ok?GRN+"10":RED+"10",color:msg.ok?GRN:RED,fontSize:12,fontWeight:700}}>{msg.t}</div>}
          <div style={{display:"flex",gap:8,marginTop:4}}>
            <button onClick={()=>setModo("reagendar")} style={BTN5(ORG)}>{IcoCal} Reagendar</button>
            <div style={{flex:1}}/>
            <button onClick={onFechar} style={BTN6()}>Cancelar</button>
            <button onClick={registrar} disabled={loading||!valor||!data} style={BTN1(loading||!valor||!data)}>{loading?<><IcoSpinner color="#1B3305"/> Registrando...</>:"Confirmar"}</button>
          </div>
          </>
        ):(
          <>
          <div style={{background:ORG+"08",border:`1px solid ${ORG}30`,borderRadius:8,padding:"10px 14px",fontSize:12,color:ORG,fontWeight:600}}>
            A data de vencimento original da parcela não será alterada. Apenas um lembrete de promessa será registrado.
          </div>
          <div><span style={LS()}>Data que o cliente prometeu pagar</span><input type="date" value={promData} onChange={e=>setPromData(e.target.value)} style={IS()}/></div>
          <div><span style={LS()}>Observação (opcional)</span><input value={promObs} onChange={e=>setPromObs(e.target.value)} placeholder="Ex: Cliente disse que paga na sexta" style={IS()}/></div>
          {msg&&<div style={{padding:10,borderRadius:8,background:msg.ok?GRN+"10":RED+"10",color:msg.ok?GRN:RED,fontSize:12,fontWeight:700}}>{msg.t}</div>}
          <div style={{display:"flex",gap:8,marginTop:4}}>
            <button onClick={()=>{setModo("pagamento");setMsg(null);}} style={BTN6()}>{IcoArrL} Voltar</button>
            <div style={{flex:1}}/>
            <button onClick={reagendar} disabled={loading||!promData} style={BTN1(loading||!promData)}>{loading?<><IcoSpinner color="#1B3305"/> Salvando...</>:"Registrar Promessa"}</button>
          </div>
          </>
        )}
        </div>
      </div>
    </div>
  );
}

function NovoContrato({contratos,clientes,onSucesso,clienteInicial}){
  const prefill=(idCliente)=>{
    const cs=(contratos||[]).filter(c=>String(c.ID_CLIENTE)===String(idCliente)).sort((a,b)=>String(b.ID_CONTRATO||"").localeCompare(String(a.ID_CONTRATO||"")));
    const ult=cs[0];if(!ult)return null;
    return{principal:String(parseFloat(ult.VALOR_PRINCIPAL||0)||""),nParcelas:String(parseInt(ult.NUM_PARCELAS||0)||""),taxa:String(parseFloat((parseFloat(ult.TAXA_JUROS_MENSAL||0)*100).toFixed(4)))};
  };
  const hasSimData=!!(clienteInicial?.valor&&clienteInicial?.prazo);
  const _ini=(!hasSimData&&clienteInicial)?prefill(clienteInicial.ID_CLIENTE):null;
  const [busca,setBusca]=useState("");const [showDrop,setShowDrop]=useState(false);
  const [cliente,setCliente]=useState(()=>clienteInicial?.ID_CLIENTE?{ID_CLIENTE:clienteInicial.ID_CLIENTE,NOME_CLIENTE:clienteInicial.NOME||clienteInicial.NOME_CLIENTE||""}:null);
  const [principal,setPrincipal]=useState(hasSimData?String(clienteInicial.valor):(_ini?.principal||""));const [nParcelas,setNParcelas]=useState(hasSimData?String(clienteInicial.prazo):(_ini?.nParcelas||""));const [taxa,setTaxa]=useState(hasSimData?String(clienteInicial.taxa):(_ini?.taxa||""));const [dtEmp,setDtEmp]=useState(hojeStr());
  const [dtVenc,setDtVenc]=useState(()=>{const dia=clienteInicial?.DIA_VENCIMENTO_PREFERIDO||(clientes||[]).find(c=>String(c.ID_CLIENTE)===String(clienteInicial?.ID_CLIENTE))?.DIA_VENCIMENTO_PREFERIDO;return dia?calcProxVenc(dia):"";});const [loading,setLoading]=useState(false);const [msg,setMsg]=useState(null);const [contratoOk,setContratoOk]=useState(null);const [zapLoading,setZapLoading]=useState(false);const [zapUrl,setZapUrl]=useState("");const [zapErro,setZapErro]=useState("");const [zapWppUrl,setZapWppUrl]=useState("");const [carneLoading,setCarneLoading]=useState(false);const [carneOk,setCarneOk]=useState(false);const [carneErro,setCarneErro]=useState("");const ref=useRef();
  useEffect(()=>{const h=e=>{if(ref.current&&!ref.current.contains(e.target))setShowDrop(false);};document.addEventListener("mousedown",h);return()=>document.removeEventListener("mousedown",h);},[]);

  const ST_BLOQ=["ativo_em_dia","ativo_em_atraso","em_cobranca","pre_prejuizo","renegociado","em_recuperacao","recuperado_parcialmente"];
  const idsComAtivo=useMemo(()=>{const s=new Set();(contratos||[]).forEach(c=>{if(ST_BLOQ.includes(c.STATUS_CONTRATO))s.add(String(c.ID_CLIENTE));});return s;},[contratos]);

  const clis=useMemo(()=>{
    if(busca.length<2)return[];
    const q=busca.toLowerCase();
    const ids=new Set();const res=[];
    // Busca em clientes (cadastro completo)
    (clientes||[]).forEach(c=>{
      const m=(c.NOME||c.NOME_CLIENTE||"").toLowerCase().includes(q)||String(c.ID_CLIENTE||"").toLowerCase().includes(q);
      if(m&&!ids.has(String(c.ID_CLIENTE))){ids.add(String(c.ID_CLIENTE));res.push({ID_CLIENTE:c.ID_CLIENTE,NOME_CLIENTE:c.NOME||c.NOME_CLIENTE});}
    });
    // Fallback: busca em contratos se clientes vazio
    if(res.length===0)(contratos||[]).forEach(c=>{
      const m=(c.NOME_CLIENTE||"").toLowerCase().includes(q)||String(c.ID_CLIENTE||"").toLowerCase().includes(q);
      if(m&&!ids.has(String(c.ID_CLIENTE))){ids.add(String(c.ID_CLIENTE));res.push({ID_CLIENTE:c.ID_CLIENTE,NOME_CLIENTE:c.NOME_CLIENTE});}
    });
    return res.slice(0,8);
  },[busca,clientes,contratos]);

  const criar=async()=>{if(!cliente||!principal||!nParcelas||!taxa||!dtEmp||!dtVenc)return;setLoading(true);setMsg(null);const res=await postAction({action:"novoContrato",dados:{idCliente:cliente.ID_CLIENTE,nomeCliente:cliente.NOME_CLIENTE,principal,parcelas:nParcelas,taxa,dataEmprestimo:apiDateStr(dtEmp),dataVencimento:apiDateStr(dtVenc)}});if(res.ok){const cliF=(clientes||[]).find(c=>String(c.ID_CLIENTE)===String(cliente.ID_CLIENTE));const diaAtual=parseInt(cliF?.DIA_VENCIMENTO_PREFERIDO||0);const diaNovo=parseInt((dtVenc||"").split("-")[2]||0);if(diaNovo&&diaNovo!==diaAtual)postAction({action:"atualizarCliente",idCliente:cliente.ID_CLIENTE,campos:{DIA_VENCIMENTO_PREFERIDO:diaNovo}});setZapUrl("");setZapErro("");setZapWppUrl("");setCarneOk(false);setCarneErro("");setContratoOk({idContrato:res.idContrato||"",clienteId:cliente.ID_CLIENTE,nomeCliente:cliente.NOME_CLIENTE,principal,nParcelas,taxa,dtVenc,docUrl:res.docUrl||"",docId:res.docId||"",docErro:res.docErro||"",parcelas:res.parcelas||[],clienteEfi:res.cliente||null});if((res.parcelas||[]).length&&res.idContrato){setCarneLoading(true);fetch("/api/efi-charges",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({idContrato:res.idContrato,parcelas:res.parcelas,cliente:res.cliente||{}})}).then(r=>r.json()).then(d=>{if(d.ok&&d.boletos?.every(b=>b.ok)){setCarneOk(true);postAction({action:"salvarCobrancasEfi",cobracas:d.boletos});}else{const errs=(d.boletos||[]).filter(b=>!b.ok).map(b=>`P${b.numParcela}: ${b.erro}`).join("; ");setCarneErro(errs||d.erro||"Erro ao gerar PIX");}}).catch(e=>setCarneErro(e.message)).finally(()=>setCarneLoading(false));}}else setMsg({ok:false,t:res.erro||"Erro"});setLoading(false);};
  const _fRc=v=>'R$ '+Number(v||0).toLocaleString('pt-BR',{minimumFractionDigits:2,maximumFractionDigits:2});
  const _fDvc=d=>{const dt=parseDate(d);return dt&&!isNaN(dt)?dt.toLocaleDateString('pt-BR'):d||'—';};
  const _cliOk=contratoOk?(clientes||[]).find(c=>String(c.ID_CLIENTE||"").trim()===String(contratoOk.clienteId||"").trim()):null;
  const _telOk=contratoOk?String(_cliOk?.TELEFONE_WPP||_cliOk?.TELEFONE||"").replace(/\D/g,""):"";
  const _pmtOk=contratoOk?parseFloat(contratoOk.parcelas?.[0]?.valorParcela||0):0;
  const _abrirWppNovo=()=>{if(!contratoOk)return;const tel=_telOk?`55${_telOk}`:'';const txt=`💸 PIX ENVIADO! O valor já deve estar na sua conta. Confere lá!\n\nSegue abaixo o seu Carnê Digital com todas as parcelas e datas:\n\nLembretes Importantes:\n• Nosso sistema envia um lembrete automático 2 dias antes do vencimento para te ajudar a não esquecer.\n• Pagamentos em dia aumentam seu Score Interno, garantindo taxas menores e limites maiores nas próximas renovações.\n\nObrigado pela confiança! Conte com a gente.`;const url=tel?`https://wa.me/${tel}?text=${encodeURIComponent(txt)}`:'https://web.whatsapp.com';window.open(url,'_blank');setContratoOk(null);onSucesso();};
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
  const _gerarCarne=async()=>{if(!contratoOk||carneLoading)return;setCarneLoading(true);setCarneErro("");try{const r=await fetch("/api/efi-charges",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({idContrato:contratoOk.idContrato,parcelas:contratoOk.parcelas,cliente:contratoOk.clienteEfi})});const d=await r.json();if(d.ok&&d.boletos?.every(b=>b.ok)){setCarneOk(true);postAction({action:"salvarCobrancasEfi",cobracas:d.boletos});}else{const errs=(d.boletos||[]).filter(b=>!b.ok).map(b=>`Parcela ${b.numParcela}: ${b.erro}`).join("; ");setCarneErro(errs||d.erro||"Erro ao gerar carnê");}}catch(e){setCarneErro(e.message);}setCarneLoading(false);};
  return(<>
    {contratoOk&&<div style={{position:"fixed",inset:0,zIndex:500,background:"rgba(15,23,42,0.45)",display:"flex",alignItems:"center",justifyContent:"center",padding:20}}><div style={{width:"100%",maxWidth:400,background:CARD,borderRadius:16,border:`1px solid ${BD}`,boxShadow:"0 24px 80px rgba(15,23,42,0.25)",overflow:"hidden",minWidth:0,animation:"fadeUp 0.25s cubic-bezier(0.16,1,0.3,1)"}}><div style={{background:GRN,padding:"22px 24px",textAlign:"center"}}><div style={{width:44,height:44,borderRadius:"50%",background:"rgba(255,255,255,0.25)",display:"flex",alignItems:"center",justifyContent:"center",margin:"0 auto 8px"}}><svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.5"><polyline points="20,6 9,17 4,12"/></svg></div><div style={{color:"#FFF",fontWeight:800,fontSize:17}}>Contrato criado</div><div style={{color:"rgba(255,255,255,0.8)",fontSize:12,marginTop:4}}>{contratoOk.nomeCliente} · {contratoOk.idContrato}</div></div><div style={{padding:"18px 20px"}}><div style={{background:BG,borderRadius:10,padding:"12px 16px",marginBottom:16,display:"grid",gridTemplateColumns:"1fr 1fr",gap:10}}><div><div style={{fontSize:10,color:MUTED,fontWeight:700,textTransform:"uppercase",marginBottom:2}}>Valor</div><div style={{fontWeight:800,fontSize:15,color:ORG}}>{_fRc(parseFloat(contratoOk.principal))}</div></div><div><div style={{fontSize:10,color:MUTED,fontWeight:700,textTransform:"uppercase",marginBottom:2}}>Parcelas</div><div style={{fontWeight:700,fontSize:13}}>{contratoOk.nParcelas}x de {_fRc(_pmtOk)}</div></div><div style={{gridColumn:"1/-1"}}><div style={{fontSize:10,color:MUTED,fontWeight:700,textTransform:"uppercase",marginBottom:2}}>1º Vencimento</div><div style={{fontWeight:700,fontSize:13}}>{_fDvc(contratoOk.dtVenc)}</div></div></div><div style={{display:"flex",flexDirection:"column",gap:8}}>{contratoOk.docUrl&&<button onClick={()=>window.open(contratoOk.docUrl,"_blank")} style={{padding:"12px",borderRadius:9,border:"none",background:TEXT,color:"#FFF",cursor:"pointer",fontWeight:700,fontSize:13,display:"flex",alignItems:"center",justifyContent:"center",gap:7}}>{IcoDoc} Abrir no Google Docs</button>}{contratoOk.docId&&!zapUrl&&<button onClick={_enviarZapSign} disabled={zapLoading} style={{padding:"12px",borderRadius:9,border:"none",background:zapLoading?"#9B7FD4":"#6C3FC5",color:"#FFF",cursor:zapLoading?"default":"pointer",fontWeight:700,fontSize:13,display:"flex",alignItems:"center",justifyContent:"center",gap:7}}>{zapLoading?<><IcoSpinner color="#163300"/> Enviando...</>:<>{IcoSign} Enviar para ZapSign</>}</button>}{zapUrl&&<button onClick={()=>window.open(zapUrl,"_blank")} style={{padding:"12px",borderRadius:9,border:"none",background:"#6C3FC5",color:"#FFF",cursor:"pointer",fontWeight:700,fontSize:13,display:"flex",alignItems:"center",justifyContent:"center",gap:7}}>{IcoSign} Assinar como credor</button>}
{zapWppUrl&&<button onClick={()=>window.open(zapWppUrl,"_blank")} style={{padding:"12px",borderRadius:12,border:"none",background:"#25D366",color:"#FFF",cursor:"pointer",fontWeight:700,fontSize:13,display:"flex",alignItems:"center",justifyContent:"center",gap:7}}>{IcoPhone} Enviar mensagem de assinatura (WhatsApp)</button>}{!carneOk?<button onClick={_gerarCarne} disabled={carneLoading} style={{padding:"12px",borderRadius:9,border:"none",background:carneLoading?"#7a6a2a":"#B8860B",color:"#FFF",cursor:carneLoading?"default":"pointer",fontWeight:700,fontSize:13,display:"flex",alignItems:"center",justifyContent:"center",gap:7}}>{carneLoading?<><IcoSpinner color="#163300"/> Gerando...</>:<>{IcoPag} Gerar Carnê PIX</>}</button>:<div style={{padding:"10px 12px",borderRadius:9,background:GRN+"20",color:GRN,fontWeight:700,fontSize:13,textAlign:"center",display:"flex",alignItems:"center",justifyContent:"center",gap:6}}>{IcoCheck} Carnê PIX gerado</div>}{carneErro&&<div style={{padding:"8px 10px",borderRadius:8,background:RED+"10",color:RED,fontSize:11,fontWeight:600}}>Erro carnê: {carneErro}</div>}<button onClick={_abrirWppNovo} style={{padding:"12px",borderRadius:12,border:"none",background:"#25D366",color:"#FFF",cursor:"pointer",fontWeight:700,fontSize:13,display:"flex",alignItems:"center",justifyContent:"center",gap:7}}>{IcoPhone} Enviar boas-vindas pelo WhatsApp</button><button onClick={()=>{setContratoOk(null);onSucesso();}} style={{padding:"10px",borderRadius:8,border:`1px solid ${BD}`,background:CARD,color:MUTED,cursor:"pointer",fontWeight:600,fontSize:13}}>Fechar</button>{contratoOk.docErro&&<div style={{marginTop:6,padding:"8px 10px",borderRadius:8,background:RED+"10",color:RED,fontSize:11,fontWeight:600}}>Erro ao gerar doc: {contratoOk.docErro}</div>}{zapErro&&<div style={{marginTop:4,padding:"8px 10px",borderRadius:8,background:RED+"10",color:RED,fontSize:11,fontWeight:600}}>Erro ZapSign: {zapErro}</div>}</div></div></div></div>}
    <div style={{background:CARD,borderRadius:16,padding:20,border:`1px solid ${BD}`,boxShadow:SHD}}>
      <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:16}}><div style={{background:ORG+"15",color:ORG,padding:8,borderRadius:8}}>{IcoCtr}</div><h3 style={{margin:0,fontSize:15,fontWeight:700}}>Novo Contrato</h3></div>
      <div style={{display:"flex",flexDirection:"column",gap:12}}>
        <div style={{position:"relative"}} ref={ref}>
          <span style={LS()}>Buscar Cliente</span>
          <div style={{position:"relative"}}><div style={{position:"absolute",left:10,top:"50%",transform:"translateY(-50%)"}}>{IcoSrch}</div><input value={cliente?cliente.NOME_CLIENTE:busca} onChange={e=>{setBusca(e.target.value);setCliente(null);setShowDrop(true);}} onFocus={()=>setShowDrop(true)} placeholder="Nome ou ID..." style={{...IS(),paddingLeft:32}}/>{cliente&&<button onClick={()=>{setCliente(null);setBusca("");setPrincipal("");setNParcelas("");setTaxa("");}} style={{position:"absolute",right:8,top:"50%",transform:"translateY(-50%)",border:"none",background:"none",cursor:"pointer",color:MUTED,fontSize:16}}>×</button>}</div>
          {showDrop&&clis.length>0&&<div style={{position:"absolute",top:"100%",left:0,right:0,background:CARD,border:`1px solid ${BD}`,borderRadius:8,marginTop:4,zIndex:100,boxShadow:"0 10px 30px rgba(0,0,0,0.1)"}}>
            {clis.map(c=>{
              const bloq=idsComAtivo.has(String(c.ID_CLIENTE));
              return<div key={c.ID_CLIENTE}
                onClick={()=>{if(!bloq){setCliente(c);setShowDrop(false);const cliF=(clientes||[]).find(cl=>String(cl.ID_CLIENTE)===String(c.ID_CLIENTE));if(cliF?.DIA_VENCIMENTO_PREFERIDO){const dv=calcProxVenc(cliF.DIA_VENCIMENTO_PREFERIDO);if(dv)setDtVenc(dv);}const pf=prefill(c.ID_CLIENTE);if(pf){setPrincipal(pf.principal);setNParcelas(pf.nParcelas);setTaxa(pf.taxa);}else{setPrincipal("");setNParcelas("");setTaxa("");}}}}
                style={{padding:"10px 14px",cursor:bloq?"not-allowed":"pointer",fontSize:13,borderBottom:`1px solid ${BG}`,background:bloq?RED+"05":CARD,display:"flex",justifyContent:"space-between",alignItems:"center",opacity:bloq?0.7:1}}
                onMouseEnter={e=>!bloq&&(e.currentTarget.style.background=BG)}
                onMouseLeave={e=>e.currentTarget.style.background=bloq?RED+"05":CARD}>
                <span style={{color:bloq?MUTED:TEXT}}><strong style={{color:bloq?MUTED:TEXT}}>{c.ID_CLIENTE}</strong> — {c.NOME_CLIENTE}</span>
                {bloq&&<span style={{fontSize:11,fontWeight:700,color:RED,background:RED+"12",padding:"2px 8px",borderRadius:99,whiteSpace:"nowrap",marginLeft:8,display:"inline-flex",alignItems:"center",gap:4}}>{IcoLock} contrato ativo</span>}
              </div>;
            })}
          </div>}
        </div>
        {cliente&&<div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10}}>
          <div><span style={LS()}>Principal</span><input type="number" value={principal} onChange={e=>setPrincipal(e.target.value)} placeholder="0.00" style={IS()}/></div>
          <div><span style={LS()}>Parcelas</span><input type="number" value={nParcelas} onChange={e=>setNParcelas(e.target.value)} placeholder="1" style={IS()}/></div>
          <div><span style={LS()}>Taxa Mensal (%)</span><input type="number" value={taxa} onChange={e=>setTaxa(e.target.value)} placeholder="0.00" style={IS()}/></div>
          <div><span style={LS()}>1º Vencimento</span><input type="date" value={dtVenc} onChange={e=>setDtVenc(e.target.value)} style={IS()}/></div>
          <div style={{gridColumn:"1/-1"}}><span style={LS()}>Data Empréstimo</span><input type="date" value={dtEmp} onChange={e=>setDtEmp(e.target.value)} style={IS()}/></div>
          <button onClick={criar} disabled={loading} style={{...BTN1(loading),gridColumn:"1/-1"}}>{loading?<><IcoSpinner color="#1B3305"/> Criando...</>:<>{IcoCtr} Gerar Contrato</>}</button>
        </div>}
        {msg&&<div style={{padding:10,borderRadius:8,background:msg.ok?GRN+"10":RED+"10",color:msg.ok?GRN:RED,fontSize:12,textAlign:"center",fontWeight:600}}>{msg.t}</div>}
      </div>
    </div>
  </>);
}

// ─── MODAL CONTRATO ──────────────────────────────────────────────
function ContratoModal({ contrato, parcelas, pagamentos, clientes, onRegistrarPagamento, onReagendar, onBaixar, onQuitacaoAntecipada, onComprovante, onAlterarVencimento, onFechar }) {
  const [histPanel, setHistPanel] = useState(false);
  const [abaPanel, setAbaPanel] = useState("parcelas");
  const [altVencOpen,setAltVencOpen]=useState(false);
  const [altVencDia,setAltVencDia]=useState("");
  const [altVencLoad,setAltVencLoad]=useState(false);
  const [altVencErr,setAltVencErr]=useState("");
  const [pixLoad,setPixLoad]=useState(false);
  const [pixOk,setPixOk]=useState(false);
  const [pixErr,setPixErr]=useState("");

  const ps = (parcelas||[])
    .filter(p => String(p.ID_CONTRATO) === String(contrato.ID_CONTRATO))
    .sort((a,b) => parseInt(a.NUM_PARCELA||0) - parseInt(b.NUM_PARCELA||0));

  const pags = (pagamentos||[])
    .filter(p => String(p.ID_CONTRATO) === String(contrato.ID_CONTRATO))
    .sort((a,b) => toNum(b.DATA_PAGAMENTO) - toNum(a.DATA_PAGAMENTO));

  const cli = (clientes||[]).find(c=>String(c.ID_CLIENTE)===String(contrato.ID_CLIENTE));

  const totalPagoParcelas = ps.filter(p=>["pago","quitacao_antecipada"].includes(String(p.STATUS||p.STATUS_PAGAMENTO||"").toLowerCase())).reduce((s,p)=>s+parseFloat(p.VALOR_PAGO||0),0);
  const totalPagoPagamentos = pags.reduce((s,p) => s + parseFloat(p.VALOR_PAGO||0), 0);
  const totalPago = totalPagoParcelas > totalPagoPagamentos ? totalPagoParcelas : totalPagoPagamentos;
  const pendentes = ps.filter(p => !["pago","baixado_como_prejuizo","cancelado","quitacao_antecipada","renegociado"].includes(String(p.STATUS||p.STATUS_PAGAMENTO||"").toLowerCase()));
  const proxParcela = pendentes[0] || null;
  const saldoDevedor = pendentes.reduce((s,p)=>s+parseFloat(p.VALOR_PARCELA||0),0);
  const pct = parseFloat(contrato.VALOR_PRINCIPAL||0) > 0
    ? (totalPago / parseFloat(contrato.VALOR_TOTAL||contrato.VALOR_PRINCIPAL||1)) * 100 : 0;
  const proxVenc = proxParcela ? parseDate(proxParcela.DATA_VENCIMENTO) : null;
  const diasAteVenc = proxVenc ? Math.round((proxVenc.getTime()-new Date().setHours(0,0,0,0))/86400000) : null;
  const taxa = parseFloat(contrato.TAXA_JUROS_MENSAL||0);
  const juros = parseFloat(contrato.VALOR_PRINCIPAL||0) * taxa;
  const parcsPagas = parseInt(contrato.NUM_PARCELAS||0) - pendentes.length;

  const fmtDtLong = v => {
    if(!v)return"—";
    const d=v instanceof Date?v:parseDate(v);
    if(!d||isNaN(d.getTime()))return"—";
    return d.toLocaleDateString("pt-BR",{day:"numeric",month:"long",year:"numeric"});
  };

  const stCor = { pago:GRN, pendente:MUTED, atrasado:RED, vence_hoje:YEL, baixado_como_prejuizo:RED, cancelado:MUTED, quitacao_antecipada:GRN, reagendado:YEL };
  const stLabel = { pago:"Pago", pendente:"Pendente", atrasado:"Atrasado", vence_hoje:"Vence Hoje", baixado_como_prejuizo:"Baixado", cancelado:"Cancelado", reagendado:"Reagendado" };
  const podeRegistrar = !["baixado_como_prejuizo","quitado","cancelado","recuperado_integralmente"].includes(contrato.STATUS_CONTRATO);
  const podeBaixar    = !["baixado_como_prejuizo","quitado","cancelado","recuperado_integralmente","recuperado_parcialmente"].includes(contrato.STATUS_CONTRATO);
  const tipoPagLabel  = { pagamento_normal:"Normal", normal:"Normal", pagamento_com_atraso:"Com Atraso", com_atraso:"Com Atraso", somente_juros:"Só Juros", recuperacao_apos_baixa:"Recuperação", pagamento_antecipado:"Antecipado", antecipado:"Antecipado" };
  const tipoPagCor    = { pagamento_normal:GRN, normal:GRN, pagamento_com_atraso:YEL, com_atraso:YEL, somente_juros:RED, recuperacao_apos_baixa:PUR, pagamento_antecipado:GRN, antecipado:GRN };
  const mob = useIsMobile();

  const _gerarPix = async () => {
    if(!proxParcela||pixLoad)return;
    setPixLoad(true);setPixErr("");setPixOk(false);
    const cpf=String(cli?.CPF||"").replace(/\D/g,"").padStart(11,"0");
    try{
      const parcelaEfi={
        idParcela:proxParcela.ID_PARCELA,
        numParcela:parseInt(proxParcela.NUM_PARCELA||0),
        totalParcelas:parseInt(proxParcela.TOTAL_PARCELAS||0),
        dataVencimento:proxParcela.DATA_VENCIMENTO,
        valorParcela:parseFloat(proxParcela.VALOR_PARCELA||0)
      };
      const r=await fetch("/api/efi-charges",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({
        idContrato:contrato.ID_CONTRATO,parcelas:[parcelaEfi],
        cliente:{nome:contrato.NOME_CLIENTE||cli?.NOME_CLIENTE||"",cpf}
      })});
      const d=await r.json();
      if(d.ok&&d.boletos?.[0]?.ok){setPixOk(true);postAction({action:"salvarCobrancasEfi",cobracas:d.boletos});}
      else{setPixErr((d.boletos?.[0]?.erro)||d.erro||"Erro ao gerar PIX");}
    }catch(e){setPixErr(e.message);}
    setPixLoad(false);
  };

  const _abrirWpp = () => {
    const tel=normTel(cli?.TELEFONE_WPP||cli?.TELEFONE||"");
    window.open(tel?`https://wa.me/55${tel}`:`https://web.whatsapp.com`,"_blank");
  };

  const timelineEvents = useMemo(()=>{
    const ev=[];
    if(contrato.DATA_EMPRESTIMO) ev.push({
      data:parseDate(contrato.DATA_EMPRESTIMO),tipo:"criacao",
      titulo:"Contrato criado",
      detalhe:`${contrato.NUM_PARCELAS}x ${fmtR(contrato.VALOR_PARCELA)}${taxa>0?` — ${(taxa*100).toFixed(1)}% a.m.`:""}`,
      cor:GRN
    });
    ps.filter(p=>p.DATA_ACORDO).forEach(p=>ev.push({
      data:parseDate(p.DATA_VENCIMENTO),tipo:"reagendamento",
      titulo:`Parcela ${p.NUM_PARCELA} reagendada`,
      detalhe:`Nova data: ${fmtDt(parseDate(p.DATA_ACORDO))}`,
      cor:ORG
    }));
    pags.forEach(p=>{
      const extra=parseFloat(p.RECEITA_EXTRA_ATRASO||p.DIFERENCA_RECEBIDA||0);
      ev.push({
        data:parseDate(p.DATA_PAGAMENTO),tipo:"pagamento",
        titulo:tipoPagLabel[p.TIPO_PAGAMENTO]||"Pagamento",
        detalhe:fmtR(p.VALOR_PAGO)+(extra>0?` +${fmtR(extra)} extra`:""),
        cor:tipoPagCor[p.TIPO_PAGAMENTO]||GRN
      });
    });
    return ev.sort((a,b)=>(b.data?b.data.getTime():0)-(a.data?a.data.getTime():0));
  },[ps,pags,contrato,taxa]);

  return (
    <div className="modal-overlay-anim" style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.5)",zIndex:300,display:"flex",alignItems:"center",justifyContent:"center",padding:mob?0:16}} onClick={onFechar}>
      <div className="modal-box-anim" onClick={e=>e.stopPropagation()} style={{background:CARD,borderRadius:mob?0:16,width:"100%",maxWidth:mob?undefined:histPanel?1080:520,maxHeight:mob?"100dvh":"92vh",display:"flex",flexDirection:"row",boxShadow:"0 30px 90px rgba(0,0,0,0.32)",border:mob?"none":`1px solid ${BD}`,overflow:"hidden",minWidth:0,transition:"max-width 0.3s cubic-bezier(0.16,1,0.3,1)"}}>

        {/* ── MAIN CONTENT ── */}
        <div style={{flex:1,display:"flex",flexDirection:"column",minWidth:0,overflow:"hidden"}}>

          {/* HEADER */}
          <div style={{padding:mob?"18px 20px 16px":"22px 24px 18px",flexShrink:0}}>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",gap:12}}>
              <div style={{minWidth:0}}>
                <div style={{fontSize:mob?20:22,fontWeight:800,color:TEXT,letterSpacing:"-0.3px",lineHeight:1.15,marginBottom:10}}>Contrato {contrato.ID_CONTRATO}</div>
                <div style={{display:"flex",alignItems:"center",gap:6,flexWrap:"wrap"}}>
                  {/* Badge estilo outlined com dot */}
                  <span style={{display:"inline-flex",alignItems:"center",gap:5,padding:"3px 10px",borderRadius:9999,fontSize:11,fontWeight:600,textTransform:"uppercase",background:"transparent",color:TEXT,border:`1px solid ${BD}`,letterSpacing:"0.03em"}}>
                    <span style={{width:6,height:6,borderRadius:"50%",background:STATUS_COR[contrato.STATUS_CONTRATO]||MUTED,display:"inline-block",flexShrink:0}}/>
                    {STATUS_LABEL[contrato.STATUS_CONTRATO]||contrato.STATUS_CONTRATO}
                  </span>
                  {diasAteVenc!==null&&diasAteVenc<0&&<Badge c={RED}>Em Atraso</Badge>}
                  {diasAteVenc===0&&<Badge c={YEL}>Vence Hoje</Badge>}
                </div>
              </div>
              <button className="modal-close-btn" onClick={onFechar} style={{background:"transparent",border:"none",width:34,height:34,borderRadius:10,cursor:"pointer",color:MUTED,display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
              </button>
            </div>
          </div>

          {/* BODY */}
          <div style={{flex:1,overflowY:"auto",padding:mob?"0 16px 16px":"0 24px 20px",display:"flex",flexDirection:"column",gap:16}}>

            {/* GRADIENT CARD */}
            <div style={{background:"linear-gradient(135deg,#1FB877 0%,#0E5C44 40%,#07241B 100%)",borderRadius:14,padding:mob?"16px 18px":"18px 20px",color:"#fff"}}>
              <div style={{fontSize:13,fontWeight:400,color:"rgba(255,255,255,0.60)",marginBottom:6}}>{contrato.NOME_CLIENTE}</div>
              <div style={{fontSize:mob?26:30,fontWeight:900,letterSpacing:"0.5px",lineHeight:1,marginBottom:8}}>{fmtR(contrato.VALOR_PRINCIPAL)}</div>
              <div style={{fontSize:12,color:"rgba(255,255,255,0.50)",display:"flex",alignItems:"center",gap:6}}>
                <span>{parcsPagas > 0 ? parcsPagas : 0} de {contrato.NUM_PARCELAS} parcelas</span>
                {taxa>0&&<><span>·</span><span>{(taxa*100).toFixed(1)}% a.m.</span></>}
              </div>
            </div>

            {/* TABLE ROWS */}
            <div>
              {[
                {l:"Próximo vencimento",v:proxParcela?(proxParcela.DATA_ACORDO?`${fmtDtLong(proxParcela.DATA_ACORDO)} (acordo)`:fmtDtLong(proxParcela.DATA_VENCIMENTO)):"—",c:diasAteVenc!==null&&diasAteVenc<0?RED:diasAteVenc===0?YEL:TEXT},
                {l:"Valor da parcela",v:fmtR(contrato.VALOR_PARCELA),c:TEXT},
                ...(taxa>0?[{l:`Juros do mês (${(taxa*100).toFixed(1)}% a.m.)`,v:fmtR(juros),c:TEXT}]:[]),
                {l:"Saldo devedor",v:fmtR(saldoDevedor),c:saldoDevedor>0?RED:MUTED},
                {l:"Total pago até hoje",v:fmtR(totalPago),c:totalPago>0?GRN:MUTED},
                ...(pendentes.length===0?[{l:"Parcelas restantes",v:"Concluído",c:GRN}]:[]),
              ].map((row,i,arr)=>(
                <div key={row.l} style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"14px 0",borderBottom:i<arr.length-1?`1px solid ${BD}`:"none"}}>
                  <span style={{fontSize:14,color:MUTED,fontWeight:400}}>{row.l}</span>
                  <span style={{fontSize:14,fontWeight:700,color:row.c}}>{row.v}</span>
                </div>
              ))}
            </div>

            {/* PROGRESS — só quando ativo */}
            {pendentes.length>0&&(
              <div>
                <div style={{display:"flex",justifyContent:"space-between",marginBottom:6}}>
                  <span style={{fontSize:10,fontWeight:700,color:MUTED,textTransform:"uppercase",letterSpacing:"0.08em"}}>Progresso</span>
                  <span style={{fontSize:11,fontWeight:800,color:GRN}}>{pct.toFixed(0)}% pago</span>
                </div>
                <div style={{background:BD,borderRadius:99,height:6,overflow:"hidden"}}>
                  <div style={{background:`linear-gradient(90deg,${GRN},${ACC})`,width:`${Math.min(100,Math.max(0,pct))}%`,height:"100%",borderRadius:99,transition:"width 0.5s ease"}}/>
                </div>
              </div>
            )}

            {/* PRÓXIMA PARCELA */}
            {proxParcela&&(
              <div style={{background:"rgba(168,224,63,0.09)",borderRadius:12,padding:"16px 18px",display:"flex",justifyContent:"space-between",alignItems:"center",gap:12}}>
                <div style={{fontSize:14,fontWeight:700,color:TEXT}}>Próxima parcela</div>
                <div style={{fontSize:mob?20:24,fontWeight:900,color:GRN,letterSpacing:"0.3px",flexShrink:0}}>{fmtR(proxParcela.VALOR_PARCELA)}</div>
              </div>
            )}

            {/* ALTERAR VENCIMENTO */}
            {altVencOpen&&(
              <div style={{display:"flex",alignItems:"center",gap:8,flexWrap:"wrap",padding:"10px 14px",borderRadius:10,background:BG,border:`1px solid ${BD}`}}>
                <span style={{fontSize:12,color:MUTED,fontWeight:600,whiteSpace:"nowrap"}}>Novo dia (1–28):</span>
                <input type="number" min="1" max="28" value={altVencDia} onChange={e=>setAltVencDia(e.target.value)}
                  style={{width:60,padding:"6px 8px",borderRadius:7,border:`1px solid ${BD}`,background:CARD,color:TEXT,fontSize:14,fontWeight:700,textAlign:"center",outline:"none"}}
                  placeholder="dia" autoFocus/>
                <button onClick={async()=>{
                  const d=parseInt(altVencDia);
                  if(!d||d<1||d>28){setAltVencErr("Dia inválido (1–28)");return;}
                  setAltVencLoad(true);setAltVencErr("");
                  const r=await postAction({action:"alterarDiaVencimento",idContrato:contrato.ID_CONTRATO,novoDia:d});
                  setAltVencLoad(false);
                  if(r?.ok){setAltVencOpen(false);setAltVencDia("");onAlterarVencimento&&onAlterarVencimento();}
                  else setAltVencErr(r?.erro||"Erro ao salvar");
                }} disabled={altVencLoad} style={{padding:"7px 14px",borderRadius:7,border:"none",background:GRN,color:"#FFF",fontWeight:700,fontSize:12,cursor:"pointer",opacity:altVencLoad?0.6:1}}>
                  {altVencLoad?<><IcoSpinner color="#fff"/> Salvando...</>:"Confirmar"}
                </button>
                <button onClick={()=>{setAltVencOpen(false);setAltVencDia("");setAltVencErr("");}} style={{padding:"7px 12px",borderRadius:7,border:`1px solid ${BD}`,background:"transparent",color:MUTED,fontWeight:600,fontSize:12,cursor:"pointer"}}>Cancelar</button>
                {altVencErr&&<span style={{color:RED,fontSize:11,fontWeight:700}}>{altVencErr}</span>}
              </div>
            )}

            {pixErr&&<div style={{padding:"8px 12px",borderRadius:8,background:RED+"10",color:RED,fontSize:12,fontWeight:600}}>{pixErr}</div>}
            {pixOk&&<div style={{padding:"8px 12px",borderRadius:8,background:GRN+"10",color:GRN,fontSize:12,fontWeight:700,display:"flex",alignItems:"center",gap:5}}>{IcoCheck} PIX gerado!</div>}
          </div>

          {/* SECONDARY ACTIONS — só para contratos ativos */}
          {podeRegistrar&&(pendentes.length>0||podeBaixar)&&(
            <div style={{padding:"6px 16px 0",display:"flex",gap:6,alignItems:"center",flexShrink:0,flexWrap:"wrap"}}>
              {pendentes.length>0&&!altVencOpen&&<button onClick={()=>{setAltVencOpen(true);setAltVencErr("");}} style={{padding:"5px 10px",borderRadius:7,border:`1px solid ${BD}`,background:CARD,color:MUTED,cursor:"pointer",fontSize:11,fontWeight:600,display:"flex",alignItems:"center",gap:4}}>{IcoCal} Alt. Vcto</button>}
              {pendentes.length>0&&<button onClick={()=>onQuitacaoAntecipada&&onQuitacaoAntecipada(contrato)} style={{padding:"5px 10px",borderRadius:7,border:`1px solid ${BD}`,background:CARD,color:MUTED,cursor:"pointer",fontSize:11,fontWeight:600,display:"flex",alignItems:"center",gap:4}}>{IcoZap} Quitar</button>}
              {podeBaixar&&<button onClick={()=>onBaixar(contrato)} style={{padding:"5px 10px",borderRadius:7,border:`1px solid ${RED}30`,background:CARD,color:RED,cursor:"pointer",fontSize:11,fontWeight:600,display:"flex",alignItems:"center",gap:4,marginLeft:"auto"}}>{IcoAlert} Baixar</button>}
            </div>
          )}

          {/* PRIMARY FOOTER */}
          <div style={{padding:"12px 16px 16px",background:CARD,display:"flex",gap:8,alignItems:"center",flexShrink:0}}>
            {podeRegistrar&&pendentes.length>0
              ?<>
                <button onClick={()=>onRegistrarPagamento(pendentes[0])} style={{...BTN1(false),flex:1}}>
                  {IcoCheck} Registrar Pagamento
                </button>
                <button onClick={_gerarPix} disabled={pixLoad||pixOk} style={{padding:"14px 16px",borderRadius:12,border:`1.5px solid ${BD}`,background:CARD,color:pixOk?GRN:TEXT,cursor:pixLoad||pixOk?"default":"pointer",fontSize:14,fontWeight:600,display:"flex",alignItems:"center",gap:5,opacity:pixLoad?0.7:1,whiteSpace:"nowrap"}}>
                  {pixLoad?<IcoSpinner size={12}/>:pixOk?IcoCheck:null}{pixLoad?"...":pixOk?"PIX ✓":"PIX"}
                </button>
                <button onClick={()=>onComprovante&&onComprovante(contrato,ps,cli)} style={{...BTN3(),whiteSpace:"nowrap",padding:"14px 14px"}}>
                  {IcoPhone}
                </button>
              </>
              :<button onClick={()=>onComprovante&&onComprovante(contrato,ps,cli)} style={{...BTN1(false),flex:1}}>
                {IcoPhone} Enviar Comprovante
              </button>
            }
          </div>
        </div>

        {/* ── TOGGLE BUTTON ── */}
        <button onClick={()=>setHistPanel(p=>!p)} title={histPanel?"Fechar histórico":"Ver histórico de parcelas"} style={{background:CARD,border:"none",borderLeft:`1px solid ${BD}`,width:28,cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",color:MUTED,flexShrink:0,transition:"background 0.15s"}}
          onMouseEnter={e=>e.currentTarget.style.background=BD}
          onMouseLeave={e=>e.currentTarget.style.background=CARD}
        >
          <div style={{writingMode:"vertical-rl",fontSize:9,fontWeight:700,color:MUTED,textTransform:"uppercase",letterSpacing:"0.08em",display:"flex",flexDirection:"column",alignItems:"center",gap:6,transform:histPanel?"rotate(0deg)":"rotate(180deg)",transition:"transform 0.3s"}}>
            {IcoArr}
          </div>
        </button>

        {/* ── LATERAL HISTORY PANEL ── */}
        {histPanel&&(
          <div style={{width:mob?320:420,borderLeft:`1px solid ${BD}`,display:"flex",flexDirection:"column",background:BG,overflow:"hidden",flexShrink:0}}>
            <div style={{padding:"14px 16px",borderBottom:`1px solid ${BD}`,background:CARD,display:"flex",alignItems:"center",justifyContent:"space-between",gap:10,flexShrink:0}}>
              <span style={{fontSize:13,fontWeight:800,color:TEXT}}>Histórico</span>
              <div style={{display:"flex",gap:0,background:BG,borderRadius:8,padding:2,border:`1px solid ${BD}`}}>
                {[["parcelas",`Parcelas (${ps.length})`],["timeline","Linha do Tempo"]].map(([id,lbl])=>(
                  <button key={id} onClick={()=>setAbaPanel(id)} style={{padding:"5px 10px",borderRadius:6,border:"none",background:abaPanel===id?CARD:"transparent",color:abaPanel===id?GRN:MUTED,fontSize:11,fontWeight:700,cursor:"pointer"}}>{lbl}</button>
                ))}
              </div>
            </div>
            <div style={{flex:1,overflowY:"auto",overflowX:"auto"}}>
              {abaPanel==="parcelas"&&(
                <table style={{width:"100%",borderCollapse:"collapse",textAlign:"left",minWidth:380}}>
                  <thead><tr style={{background:GRN+"10",fontSize:10,color:GRN,fontWeight:700,textTransform:"uppercase",position:"sticky",top:0,zIndex:1}}>
                    <th style={{padding:"8px 14px"}}>#</th>
                    <th>Vencimento</th>
                    <th>Situação</th>
                    <th style={{textAlign:"right",padding:"8px 14px"}}>Valor</th>
                    <th style={{padding:"8px 8px"}}/>
                  </tr></thead>
                  <tbody>{ps.map((p,i)=>{
                    const st=statusEfetivo(p);
                    const foiPago=parseFloat(p.VALOR_PAGO||0)>0;
                    const sitCor=stCor[st]||MUTED;
                    const sitLbl=stLabel[st]||_ST_LABEL[st]||st;
                    const ativa=!_ST_TERMINAL.has(st);
                    return(
                      <tr key={p.ID_PARCELA||i} style={{borderBottom:`1px solid ${BD}`,fontSize:12,background:i%2===0?CARD:BG}}>
                        <td style={{padding:"9px 14px",color:MUTED,fontWeight:600}}>{p.NUM_PARCELA}{isUltima(p,ps)&&<span style={{fontSize:8,fontWeight:800,color:GRN,background:GRN+"18",padding:"1px 4px",borderRadius:99,marginLeft:4}}>ult.</span>}</td>
                        <td style={{fontWeight:600,color:TEXT,fontSize:11}}>
                          {p.DATA_ACORDO?<span style={{color:ORG}}>{fmtDt(p.DATA_ACORDO)}<span style={{fontSize:8,fontWeight:800,background:ORG+"18",padding:"1px 4px",borderRadius:99,marginLeft:3}}>acordo</span></span>:fmtDt(p.DATA_VENCIMENTO)}
                        </td>
                        <td><Badge c={sitCor}>{sitLbl}</Badge></td>
                        <td style={{textAlign:"right",padding:"9px 14px",fontWeight:700,color:foiPago?GRN:TEXT}}>{foiPago?fmtR(p.VALOR_PAGO):fmtR(p.VALOR_PARCELA)}</td>
                        <td style={{padding:"6px 8px"}}>
                          {ativa&&<div style={{display:"flex",gap:3}}>
                            <button onClick={e=>{e.stopPropagation();onRegistrarPagamento(p);}} style={BTN7(GRN)}>Pagar</button>
                            <button onClick={e=>{e.stopPropagation();onReagendar(p);}} style={BTN7(ORG)}>Reagendar</button>
                          </div>}
                        </td>
                      </tr>
                    );
                  })}</tbody>
                </table>
              )}
              {abaPanel==="timeline"&&(
                timelineEvents.length===0
                  ? <div style={{padding:32,textAlign:"center",color:MUTED,fontSize:13}}>Nenhum evento registrado.</div>
                  : <div style={{padding:"8px 0"}}>
                      {timelineEvents.map((ev,i)=>(
                        <div key={i} style={{display:"flex",gap:0,padding:"0 14px"}}>
                          {/* Coluna da linha + dot */}
                          <div style={{display:"flex",flexDirection:"column",alignItems:"center",marginRight:12,flexShrink:0}}>
                            <div style={{width:20,height:20,borderRadius:"50%",background:ev.cor+"20",border:`2px solid ${ev.cor}`,display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0,marginTop:12,fontSize:9,color:ev.cor,fontWeight:900,zIndex:1}}>
                              {ev.tipo==="criacao"?"★":ev.tipo==="reagendamento"?"↻":"✓"}
                            </div>
                            {i<timelineEvents.length-1&&<div style={{flex:1,width:2,background:BD,minHeight:12}}/>}
                          </div>
                          {/* Conteúdo */}
                          <div style={{flex:1,paddingTop:10,paddingBottom:14,borderBottom:i<timelineEvents.length-1?`1px solid ${BD}00`:"none"}}>
                            <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",gap:6}}>
                              <div style={{fontSize:12,fontWeight:700,color:TEXT,lineHeight:1.3}}>{ev.titulo}</div>
                              <div style={{fontSize:10,color:MUTED,whiteSpace:"nowrap",marginTop:1,flexShrink:0}}>{ev.data?fmtDt(ev.data):"—"}</div>
                            </div>
                            <div style={{fontSize:11,color:ev.tipo==="pagamento"?ev.cor:MUTED,fontWeight:ev.tipo==="pagamento"?700:400,marginTop:3}}>{ev.detalhe}</div>
                          </div>
                        </div>
                      ))}
                    </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

const IcoProm = <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M9 11l3 3L22 4"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/></svg>;

function NovaPromessaModal({contratos,clientes,onConfirmar,onFechar}){
  const [busca,setBusca]=useState("");
  const [showDrop,setShowDrop]=useState(false);
  const [cliente,setCliente]=useState(null);
  const [contratoId,setContratoId]=useState("");
  const [dataPrevista,setDataPrevista]=useState(hojeStr());
  const [valorPrometido,setValorPrometido]=useState("");
  const [observacao,setObservacao]=useState("");
  const [loading,setLoading]=useState(false);
  const [msg,setMsg]=useState(null);
  const ref=useRef();

  useEffect(()=>{const h=e=>{if(ref.current&&!ref.current.contains(e.target))setShowDrop(false);};document.addEventListener("mousedown",h);return()=>document.removeEventListener("mousedown",h);},[]);

  const clis=useMemo(()=>{
    if(busca.length<2)return[];
    const ids=new Set();
    return (clientes||[]).filter(c=>{
      const m=(c.NOME||c.NOME_CLIENTE||"").toLowerCase().includes(busca.toLowerCase())||String(c.ID_CLIENTE||"").includes(busca);
      if(m&&!ids.has(c.ID_CLIENTE)){ids.add(c.ID_CLIENTE);return true;}return false;
    }).slice(0,6);
  },[busca,clientes]);

  const contratosCliente=useMemo(()=>
    cliente?(contratos||[]).filter(c=>String(c.ID_CLIENTE)===String(cliente.ID_CLIENTE)&&!["quitado","cancelado","baixado_como_prejuizo"].includes(c.STATUS_CONTRATO)):[]
  ,[cliente,contratos]);

  useEffect(()=>{if(contratosCliente.length===1)setContratoId(contratosCliente[0].ID_CONTRATO);},[contratosCliente]);

  const confirmar=async()=>{
    if(!cliente||!contratoId||!dataPrevista||!valorPrometido)return;
    setLoading(true);setMsg(null);
    const ctr=contratos.find(c=>String(c.ID_CONTRATO)===String(contratoId));
    const res=await postAction({action:"registrarPromessa",dados:{
      idContrato:contratoId,
      idCliente:cliente.ID_CLIENTE,
      nomeCliente:cliente.NOME||cliente.NOME_CLIENTE||"",
      dataPrevista:apiDateStr(dataPrevista),
      valorPrometido:parseFloat(valorPrometido),
      observacao
    }});
    if(res.ok){setMsg({ok:true,t:"Promessa registrada!"});setTimeout(onConfirmar,1200);}
    else setMsg({ok:false,t:res.erro||"Erro."});
    setLoading(false);
  };

  return(
    <div className="modal-overlay-anim" style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.5)",zIndex:400,display:"flex",alignItems:"center",justifyContent:"center",padding:16}} onClick={onFechar}>
      <div className="modal-box-anim" onClick={e=>e.stopPropagation()} style={{background:CARD,borderRadius:16,width:"100%",maxWidth:500,boxShadow:"0 24px 80px rgba(0,0,0,0.28)",border:`1px solid ${BD}`,overflow:"hidden",minWidth:0}}>
        <div style={{padding:"18px 24px",borderBottom:`1px solid ${BD}`,display:"flex",justifyContent:"space-between",alignItems:"center"}}>
          <div style={{fontSize:18,fontWeight:800,display:"flex",alignItems:"center",gap:8,letterSpacing:"-0.02em",color:TEXT}}>{IcoPromise} Nova Promessa de Pagamento</div>
          <button className="modal-close-btn" onClick={onFechar} style={{background:"transparent",border:"none",width:32,height:32,borderRadius:8,cursor:"pointer",color:MUTED,display:"flex",alignItems:"center",justifyContent:"center"}}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
          </button>
        </div>
        <div style={{padding:"20px 24px",display:"flex",flexDirection:"column",gap:14}}>
          <div style={{position:"relative"}} ref={ref}>
            <span style={LS()}>Buscar Cliente</span>
            <div style={{position:"relative"}}>
              <div style={{position:"absolute",left:10,top:"50%",transform:"translateY(-50%)"}}>{IcoSrch}</div>
              <input value={cliente?`${cliente.ID_CLIENTE} - ${cliente.NOME||cliente.NOME_CLIENTE}`:busca} onChange={e=>{setBusca(e.target.value);setCliente(null);setContratoId("");setShowDrop(true);}} onFocus={()=>setShowDrop(true)} placeholder="Nome ou ID..." style={{...IS(),paddingLeft:32}}/>
              {cliente&&<button onClick={()=>{setCliente(null);setBusca("");setContratoId("");}} style={{position:"absolute",right:8,top:"50%",transform:"translateY(-50%)",border:"none",background:"none",cursor:"pointer",color:MUTED,fontSize:16}}>×</button>}
            </div>
            {showDrop&&clis.length>0&&<div style={{position:"absolute",top:"100%",left:0,right:0,background:CARD,border:`1px solid ${BD}`,borderRadius:8,marginTop:4,zIndex:100,boxShadow:"0 10px 30px rgba(0,0,0,0.1)"}}>
              {clis.map(c=><div key={c.ID_CLIENTE} onClick={()=>{setCliente(c);setShowDrop(false);}} style={{padding:"10px 14px",cursor:"pointer",fontSize:13,borderBottom:`1px solid ${BG}`}} onMouseEnter={e=>e.currentTarget.style.background=BG} onMouseLeave={e=>e.currentTarget.style.background=CARD}><strong>{c.ID_CLIENTE}</strong> — {c.NOME||c.NOME_CLIENTE}</div>)}
            </div>}
          </div>
          {cliente&&(
            <div>
              <span style={LS()}>Contrato</span>
              <select value={contratoId} onChange={e=>setContratoId(e.target.value)} style={IS()}>
                <option value="">Selecione...</option>
                {contratosCliente.map(c=><option key={c.ID_CONTRATO} value={c.ID_CONTRATO}>{c.ID_CONTRATO} — {fmtR(c.VALOR_PRINCIPAL)} — {c.NUM_PARCELAS}x — {c.STATUS_CONTRATO}</option>)}
              </select>
            </div>
          )}
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12}}>
            <div><span style={LS()}>Data Prevista</span><input type="date" value={dataPrevista} onChange={e=>setDataPrevista(e.target.value)} style={IS()}/></div>
            <div><span style={LS()}>Valor Prometido (R$)</span><input type="number" value={valorPrometido} onChange={e=>setValorPrometido(e.target.value)} placeholder="0.00" style={IS()}/></div>
          </div>
          <div><span style={LS()}>Observação</span><input value={observacao} onChange={e=>setObservacao(e.target.value)} placeholder="Opcional" style={IS()}/></div>
          {msg&&<div style={{padding:"10px 14px",borderRadius:8,background:msg.ok?GRN+"10":RED+"10",color:msg.ok?GRN:RED,fontSize:13,fontWeight:700,border:`1px solid ${msg.ok?GRN:RED}25`}}>{""}{msg.t}</div>}
          <div style={{display:"flex",gap:10}}>
            <button onClick={onFechar} style={{...BTN6(),flex:1}}>Cancelar</button>
            <button onClick={confirmar} disabled={loading||!cliente||!contratoId||!dataPrevista||!valorPrometido} style={{...BTN1(loading||!cliente||!contratoId||!dataPrevista||!valorPrometido),flex:2}}>
              {loading?<><IcoSpinner color="#1B3305"/> Registrando...</>:<>{IcoCheck} Registrar Promessa</>}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── MODAL DETALHE PAGAMENTO ─────────────────────────────────────
function PagamentoDetalheModal({pag, parcelas, contratos, clientes, onFechar, onReabrir}) {
  const [loading, setLoading] = React.useState(false);
  const [sharing, setSharing] = React.useState(false);
  // PAGAMENTOS não tem NUM_PARCELA — buscar por ID_PARCELA
  const parcela = (parcelas||[]).find(p=>String(p.ID_PARCELA||"").trim()===String(pag.ID_PARCELA||"").trim());
  const numParc = parcela?.NUM_PARCELA || pag.NUM_PARCELA;
  const contrato = (contratos||[]).find(c=>String(c.ID_CONTRATO||"").trim()===String(pag.ID_CONTRATO||"").trim());
  const cliente = (clientes||[]).find(c=>String(c.ID_CLIENTE||"").trim()===String(pag.ID_CLIENTE||"").trim());
  const telefone = String(cliente?.TELEFONE_WPP||cliente?.TELEFONE||"").replace(/\D/g,"");
  const hist = (parcelas||[]).filter(p=>String(p.ID_CONTRATO||"").trim()===String(pag.ID_CONTRATO||"").trim()).sort((a,b)=>parseInt(a.NUM_PARCELA||0)-parseInt(b.NUM_PARCELA||0));
  const tCor={pagamento_normal:GRN,pagamento_com_atraso:YEL,somente_juros:RED,recuperacao_apos_baixa:PUR}[pag.TIPO_PAGAMENTO]||MUTED;
  const tLbl={pagamento_normal:"Normal",normal:"Normal",pagamento_com_atraso:"Com Atraso",com_atraso:"Com Atraso",somente_juros:"Somente Juros",recuperacao_apos_baixa:"Recuperação",pagamento_antecipado:"Antecipado",antecipado:"Antecipado"}[pag.TIPO_PAGAMENTO]||pag.TIPO_PAGAMENTO||"—";
  const Info=({l,v,c})=><div style={{background:BG,borderRadius:8,padding:"10px 14px"}}><div style={{fontSize:10,fontWeight:700,color:MUTED,textTransform:"uppercase",marginBottom:3}}>{l}</div><div style={{fontWeight:700,fontSize:13,color:c||TEXT}}>{v||"—"}</div></div>;

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
    const doc=new jsPDF({unit:'mm',format:'a4'});
    const W=210,pd=16;
    const {G,GL,DK,MT,BDC}=_PDF_CLR;
    let y=_pdfBrandHeader(doc,W,pd,'COMPROVANTE DE PAGAMENTO DE PARCELA',G,DK,GL,MT,BDC);
    doc.setFillColor(...G);doc.roundedRect(pd,y,W-2*pd,11,2,2,'F');
    doc.setFont('helvetica','bold');doc.setFontSize(11);doc.setTextColor(255,255,255);doc.text('PAGAMENTO CONFIRMADO',W/2,y+7.5,{align:'center'});
    y+=19;
    const sect=(title,rows)=>{
      const rH=11,sH=9+rows.length*rH+2;
      doc.setDrawColor(...BDC);doc.setLineWidth(0.3);doc.roundedRect(pd,y,W-2*pd,sH,3,3,'D');
      doc.setFont('helvetica','bold');doc.setFontSize(8);doc.setTextColor(...DK);doc.text(title,pd+4,y+5.5);
      doc.setDrawColor(...BDC);doc.setLineWidth(0.2);doc.line(pd,y+8,W-pd,y+8);
      let ry=y+12;const mx=pd+(W-2*pd)/2;
      rows.forEach(r=>{
        doc.setFont('helvetica','bold');doc.setFontSize(7);doc.setTextColor(...GL);if(r.ll)doc.text(r.ll,pd+4,ry);
        doc.setFont('helvetica',r.lvB?'bold':'normal');doc.setFontSize(8.5);doc.setTextColor(...DK);doc.text(r.lv||'—',pd+4,ry+4.5);
        if(r.rl){doc.setFont('helvetica','bold');doc.setFontSize(7);doc.setTextColor(...GL);doc.text(r.rl,mx+4,ry);
          doc.setFont('helvetica','normal');doc.setFontSize(8.5);doc.setTextColor(...(r.rvR?RD:DK));doc.text(r.rv||'—',mx+4,ry+4.5);}
        ry+=rH;
      });
      y+=sH+5;
    };
    sect('DADOS DO CLIENTE E DO CONTRATO',[
      {ll:'NOME DO CLIENTE',lv:String(pag.NOME_CLIENTE||'—'),rl:'NÚMERO DO CONTRATO',rv:String(pag.ID_CONTRATO)},
      {ll:'CPF',lv:String(cliente?.CPF||'—'),rl:'DATA DO CONTRATO',rv:fD(contrato?.DATA_EMPRESTIMO||contrato?.DATA_CONTRATO)},
    ]);
    sect('DETALHES DO PAGAMENTO',[
      {ll:'PARCELA PAGA',lv:`${pNum} de ${totalParc}`,rl:'DATA DE VENCIMENTO',rv:fD(parcela?.DATA_VENCIMENTO)},
      {ll:'VALOR DA PARCELA',lv:fR(pag.VALOR_PAGO),lvB:true,rl:'DATA DO PAGAMENTO',rv:fD(pag.DATA_PAGAMENTO)},
      {ll:'FORMA DE PAGAMENTO',lv:String(pag.FORMA_PAGAMENTO||tLbl||'—'),rl:'CÓDIGO DE TRANSAÇÃO',rv:String(pag.ID_PARCELA||parcela?.ID_PARCELA||'—')},
    ]);
    sect('RESUMO FINANCEIRO ATUALIZADO',[
      {ll:'VALOR TOTAL DO EMPRÉSTIMO',lv:fR(valorOriginal),rl:'PARCELAS RESTANTES',rv:String(parcelasRestantes)},
      {ll:'VALOR TOTAL JÁ PAGO',lv:fR(totalJaPago),rl:'SALDO DEVEDOR ESTIMADO',rv:fR(saldo)},
    ]);
    y+=2;
    const qt='"Declaramos, para os devidos fins, que o pagamento acima identificado foi recebido e registrado em nosso controle interno, referente à parcela informada neste comprovante."';
    doc.setFont('helvetica','italic');doc.setFontSize(8.5);doc.setTextColor(...MT);
    const qtL=doc.splitTextToSize(qt,W-2*pd-8);doc.text(qtL,W/2,y,{align:'center'});y+=qtL.length*5+7;
    doc.setFont('helvetica','normal');doc.setFontSize(7.5);doc.setTextColor(...MT);
    doc.text(`Documento emitido em: ${new Date().toLocaleDateString('pt-BR')}`,W/2,y,{align:'center'});y+=6;
    const ds='Este comprovante confirma exclusivamente o recebimento da parcela indicada, não representando quitação total do contrato, salvo quando expressamente informado.';
    doc.setFont('helvetica','bold');doc.setFontSize(7.5);doc.setTextColor(...DK);
    const dsL=doc.splitTextToSize(ds,W-2*pd-8);doc.text(dsL,W/2,y,{align:'center'});y+=dsL.length*5+5;
    doc.setFont('helvetica','bold');doc.setFontSize(8);doc.setTextColor(...GL);doc.text('Borges Assessoria · Crédito Privado',W/2,y,{align:'center'});
    return doc.output('blob');
  };

  const isMobile=/iPhone|iPad|iPod|Android/i.test(navigator.userAgent);

  const enviarWpp=async()=>{
    setSharing(true);
    try{
      if(!parcela){alert('Parcela não encontrada.');setSharing(false);return;}
      // Detecta quitado e gera PDF correto (comprovante parcela ou quitação)
      gerarEEnviarComprovante(parcela,parseFloat(pag.VALOR_PAGO||0),pag.DATA_PAGAMENTO,tLbl,parcelas,contratos,clientes,{wpp:true});
    }catch(e){alert('Erro: '+e.message);}
    setSharing(false);
  };

  const reabrir=async()=>{
    if(!numParc){alert("Não foi possível identificar o número da parcela.");return;}
    if(!window.confirm(`Reabrir parcela ${numParc}/${contrato?.NUM_PARCELAS||'?'} do contrato ${pag.ID_CONTRATO}?\n\nIsso desfaz o pagamento e volta a parcela para pendente/atrasado.`))return;
    setLoading(true);
    try{
      const res=await postAction({action:"reabrirParcela",idContrato:pag.ID_CONTRATO,numParcela:String(numParc),idPagamento:pag.ID_PAGAMENTO,idCliente:pag.ID_CLIENTE});
      if(res.ok){onReabrir();onFechar();}else alert("Erro: "+(res.erro||"falha ao reabrir"));
    }catch(e){alert("Erro: "+e.message);}
    setLoading(false);
  };

  return(
    <div className="modal-overlay-anim" style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.5)",zIndex:1000,display:"flex",alignItems:"center",justifyContent:"center",padding:20}}>
      <div className="modal-box-anim" style={{background:CARD,borderRadius:16,width:"100%",maxWidth:560,boxShadow:"0 24px 80px rgba(0,0,0,0.28)",border:`1px solid ${BD}`,maxHeight:"92vh",display:"flex",flexDirection:"column",overflow:"hidden",minWidth:0}}>
        <div style={{padding:"18px 24px",borderBottom:`1px solid ${BD}`,display:"flex",justifyContent:"space-between",alignItems:"center",flexShrink:0}}>
          <div>
            <div style={{fontWeight:800,fontSize:18,letterSpacing:"-0.02em",color:TEXT}}>Detalhe do Pagamento</div>
            <div style={{fontSize:12,color:MUTED,marginTop:2}}>{pag.NOME_CLIENTE} · {pag.ID_CONTRATO} · Parcela {numParc||"—"}/{contrato?.NUM_PARCELAS||"—"}</div>
          </div>
          <button className="modal-close-btn" onClick={onFechar} style={{background:"transparent",border:"none",width:32,height:32,borderRadius:8,cursor:"pointer",color:MUTED,display:"flex",alignItems:"center",justifyContent:"center"}}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
          </button>
        </div>
        <div style={{padding:24,display:"flex",flexDirection:"column",gap:20}}>
          <div>
            <div style={{fontSize:11,fontWeight:700,color:MUTED,textTransform:"uppercase",marginBottom:10}}>Pagamento</div>
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:8}}>
              <Info l="Data" v={fmtDt(parseDate(pag.DATA_PAGAMENTO))}/>
              <Info l="Valor Pago" v={fmtR(pag.VALOR_PAGO)} c={GRN}/>
              <div style={{background:BG,borderRadius:8,padding:"10px 14px"}}><div style={{fontSize:10,fontWeight:700,color:MUTED,textTransform:"uppercase",marginBottom:3}}>Tipo</div><Badge c={tCor}>{tLbl}</Badge></div>
              {parseFloat(pag.VALOR_MULTA||0)>0&&<Info l="Multa" v={fmtR(pag.VALOR_MULTA)} c={ORG}/>}
              {parseFloat(pag.VALOR_MORA||0)>0&&<Info l="Mora" v={fmtR(pag.VALOR_MORA)} c={ORG}/>}
              {parseFloat(pag.RECEITA_EXTRA_ATRASO||0)>0&&<Info l="Receita Extra" v={fmtR(pag.RECEITA_EXTRA_ATRASO)} c={ORG}/>}
              <Info l="Forma" v={pag.FORMA_PAGAMENTO||"manual"}/>
            </div>
          </div>
          <div>
            <div style={{fontSize:11,fontWeight:700,color:MUTED,textTransform:"uppercase",marginBottom:10}}>Parcela</div>
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:8}}>
              <Info l="Vencimento" v={parcela?fmtDt(parseDate(parcela.DATA_VENCIMENTO)):"—"}/>
              <Info l="Valor Original" v={fmtR(parcela?.VALOR_PARCELA||pag.VALOR_ORIGINAL_PARCELA||pag.VALOR_PARCELA)}/>
              {parseInt(parcela?.DIAS_ATRASO||0)>0&&<Info l="Dias de Atraso" v={`${parcela.DIAS_ATRASO} dia(s)`} c={YEL}/>}
            </div>
          </div>
          {hist.length>0&&(
            <div>
              <div style={{fontSize:11,fontWeight:700,color:MUTED,textTransform:"uppercase",marginBottom:10}}>Histórico do Contrato</div>
              <div style={{border:`1px solid ${BD}`,borderRadius:8,overflow:"hidden"}}>
                <table style={{width:"100%",borderCollapse:"collapse",fontSize:12}}>
                  <thead><tr style={{background:GRN+"10",color:GRN,fontWeight:700,fontSize:10,textTransform:"uppercase"}}><th style={{padding:"7px 12px",textAlign:"left"}}>#</th><th style={{padding:"7px 12px",textAlign:"left"}}>Vencimento</th><th style={{padding:"7px 12px",textAlign:"right"}}>Valor</th><th style={{padding:"7px 12px",textAlign:"left"}}>Status</th><th style={{padding:"7px 12px",textAlign:"right"}}>Pago</th></tr></thead>
                  <tbody>{hist.map((p,i)=>{
                    const _stH=statusEfetivo(p);
                    const isPago=["pago","quitacao_antecipada"].includes(_stH);
                    const _corH={pago:GRN,quitacao_antecipada:GRN,atrasado:RED,vence_hoje:ORG,pendente:BLU}[_stH]||YEL;
                    const isAtual=String(p.NUM_PARCELA||"")===String(numParc||"");
                    return<tr key={i} style={{borderTop:`1px solid ${BD}`,background:isAtual?ORG+"08":"transparent"}}>
                      <td style={{padding:"7px 12px",fontWeight:isAtual?800:400,color:isAtual?ORG:TEXT}}>{p.NUM_PARCELA}</td>
                      <td style={{padding:"7px 12px",color:MUTED}}>{fmtDt(parseDate(p.DATA_VENCIMENTO))}</td>
                      <td style={{padding:"7px 12px",textAlign:"right"}}>{fmtR(p.VALOR_PARCELA)}</td>
                      <td style={{padding:"7px 12px"}}><Badge c={_corH}>{_ST_LABEL[_stH]||_stH}</Badge></td>
                      <td style={{padding:"7px 12px",textAlign:"right",fontWeight:700,color:isPago?GRN:MUTED}}>{isPago?fmtR(p.VALOR_PAGO):"—"}</td>
                    </tr>;
                  })}</tbody>
                </table>
              </div>
            </div>
          )}
        </div>
        <div style={{padding:"14px 24px",borderTop:`1px solid ${BD}`,display:"flex",gap:10,flexShrink:0}}>
          <button onClick={enviarWpp} disabled={sharing} style={{...BTN2(sharing),flex:2}}>
            {sharing?<><IcoSpinner color="#fff"/> Gerando...</>:<>{IcoPhone} Enviar pelo WhatsApp</>}
          </button>
          <button onClick={reabrir} disabled={loading} style={{...BTN5(RED),flex:1,opacity:loading?0.7:1}}>{loading?<><IcoSpinner color={RED}/> Processando...</>:<>{IcoArrL} Reabrir</>}</button>
        </div>
      </div>
    </div>
  );
}

// ─── COMPROVANTE DE QUITAÇÃO ─────────────────────────────────────
function gerarComprovante(contrato, parcelasContrato, cliente) {
  try{
    const ps=[...parcelasContrato].sort((a,b)=>parseInt(a.NUM_PARCELA||0)-parseInt(b.NUM_PARCELA||0));
    const totalPago=ps.reduce((s,p)=>s+parseFloat(p.VALOR_PAGO||0),0);
    const valorOriginal=parseFloat(contrato.VALOR_PRINCIPAL||contrato.VALOR_TOTAL||0);
    const datas=ps.map(p=>parseDate(p.DATA_PAGAMENTO)).filter(Boolean);
    const ultPag=datas.length?datas.reduce((a,b)=>a>b?a:b):null;
    const nome=String(contrato.NOME_CLIENTE||cliente?.NOME_CLIENTE||'—');
    const cpf=String(contrato.CPF||cliente?.CPF||'—');
    const fD=d=>{if(!d)return'—';const dt=d instanceof Date?d:parseDate(d);return dt&&!isNaN(dt)?dt.toLocaleDateString('pt-BR'):'—';};
    const fR=fmtR;
    const now=new Date();
    const doc=new jsPDF({unit:'mm',format:'a4'});
    const W=210,pd=16;
    const {G,GL,DK,MT,BDC}=_PDF_CLR;
    let y=_pdfBrandHeader(doc,W,pd,'COMPROVANTE DE QUITAÇÃO DE CONTRATO',G,DK,GL,MT,BDC);
    doc.setFillColor(...G);doc.roundedRect(pd,y,W-2*pd,11,2,2,'F');
    doc.setFont('helvetica','bold');doc.setFontSize(11);doc.setTextColor(255,255,255);doc.text('CONTRATO QUITADO',W/2,y+7.5,{align:'center'});
    y+=19;
    const sect=(title,rows)=>{
      const rH=11,sH=9+rows.length*rH+2;
      doc.setDrawColor(...BDC);doc.setLineWidth(0.3);doc.roundedRect(pd,y,W-2*pd,sH,3,3,'D');
      doc.setFont('helvetica','bold');doc.setFontSize(8);doc.setTextColor(...DK);doc.text(title,pd+4,y+5.5);
      doc.setDrawColor(...BDC);doc.setLineWidth(0.2);doc.line(pd,y+8,W-pd,y+8);
      let ry=y+12;const mx=pd+(W-2*pd)/2;
      rows.forEach(r=>{
        doc.setFont('helvetica','bold');doc.setFontSize(7);doc.setTextColor(...GL);if(r.ll)doc.text(r.ll,pd+4,ry);
        doc.setFont('helvetica',r.lvB?'bold':'normal');doc.setFontSize(8.5);doc.setTextColor(...DK);doc.text(r.lv||'—',pd+4,ry+4.5);
        if(r.rl){doc.setFont('helvetica','bold');doc.setFontSize(7);doc.setTextColor(...GL);doc.text(r.rl,mx+4,ry);
          doc.setFont('helvetica','normal');doc.setFontSize(8.5);doc.setTextColor(...DK);doc.text(r.rv||'—',mx+4,ry+4.5);}
        ry+=rH;
      });
      y+=sH+5;
    };
    sect('DADOS DO CLIENTE E DO CONTRATO',[
      {ll:'NOME DO CLIENTE',lv:nome,rl:'NÚMERO DO CONTRATO',rv:String(contrato.ID_CONTRATO)},
      {ll:'CPF',lv:cpf,rl:'DATA DO CONTRATO',rv:fD(contrato.DATA_EMPRESTIMO||contrato.DATA_CONTRATO)},
    ]);
    sect('DETALHES DA QUITAÇÃO',[
      {ll:'TOTAL DE PARCELAS',lv:String(contrato.NUM_PARCELAS||ps.length),rl:'DATA DA ÚLTIMA PARCELA',rv:fD(ultPag)},
      {ll:'VALOR TOTAL PAGO',lv:fR(totalPago),lvB:true,rl:'STATUS',rv:'QUITADO'},
    ]);
    sect('RESUMO FINANCEIRO',[
      {ll:'VALOR ORIGINAL DO CONTRATO',lv:fR(valorOriginal),rl:'PARCELAS PAGAS',rv:String(ps.length)+' de '+String(contrato.NUM_PARCELAS||ps.length)},
      {ll:'VALOR TOTAL PAGO',lv:fR(totalPago),rl:'SALDO REMANESCENTE',rv:'R$ 0,00'},
    ]);
    y=_renderHistParcelas(doc,ps,W,pd,y,GL,DK,BDC,fD,fR);
    y+=2;
    const qt='"Declaramos, para os devidos fins, que todos os pagamentos referentes ao contrato acima identificado foram recebidos e registrados, confirmando a quitação integral da dívida."';
    doc.setFont('helvetica','italic');doc.setFontSize(8.5);doc.setTextColor(...MT);
    const qtL=doc.splitTextToSize(qt,W-2*pd-8);doc.text(qtL,W/2,y,{align:'center'});y+=qtL.length*5+7;
    doc.setFont('helvetica','normal');doc.setFontSize(7.5);doc.setTextColor(...MT);
    doc.text(`Documento emitido em: ${now.toLocaleDateString('pt-BR')}`,W/2,y,{align:'center'});y+=6;
    const ds='Este comprovante confirma a quitação integral do contrato identificado acima, sendo válido como prova de liquidação total da dívida contratada.';
    doc.setFont('helvetica','bold');doc.setFontSize(7.5);doc.setTextColor(...DK);
    const dsL=doc.splitTextToSize(ds,W-2*pd-8);doc.text(dsL,W/2,y,{align:'center'});y+=dsL.length*5+5;
    doc.setFont('helvetica','bold');doc.setFontSize(8);doc.setTextColor(...GL);doc.text('Borges Assessoria · Crédito Privado',W/2,y,{align:'center'});
    const nomeArq=`comprovante-quitacao-${contrato.ID_CONTRATO}-${now.getFullYear()}${String(now.getMonth()+1).padStart(2,'0')}${String(now.getDate()).padStart(2,'0')}.pdf`;
    doc.save(nomeArq);
  }catch(e){console.error('Quitacao PDF error:',e);}
}

function abrirWhatsApp(telefone, nomeCliente) {
  const num = String(telefone||'').replace(/\D/g,'');
  if(!num || num.length < 10) { alert('Telefone do cliente não cadastrado.'); return; }
  const numFull = num.startsWith('55') ? num : '55' + num;
  const msg = encodeURIComponent("Parabens, seu contrato de emprestimo foi finalizado com sucesso!\n\nQuero agradecer pela confianca e pela seriedade em cumprir nosso acordo. Foi um prazer poder te ajudar!\nSempre que precisar, estarei a disposicao para um novo emprestimo.\n\nDesejo uma otima tarde e uma semana incrivel!");
  window.open(`https://wa.me/${numFull}?text=${msg}`,'_blank');
}

// ─── MOBILE HOOK ─────────────────────────────────────────────────
function useIsMobile(bp=768){
  const [mob,setMob]=React.useState(()=>window.innerWidth<=bp);
  React.useEffect(()=>{
    const h=()=>setMob(window.innerWidth<=bp);
    window.addEventListener('resize',h);
    return()=>window.removeEventListener('resize',h);
  },[bp]);
  return mob;
}

// ─── BOTTOM NAV (mobile only) ─────────────────────────────────────
function BottomNav({tab,setTab}){
  const items=[
    {id:"dashboard",label:"Início",ico:<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/></svg>},
    {id:"cobranca",label:"Cobrança",ico:<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>},
    {id:"contratos",label:"Contratos",ico:<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>},
    {id:"financeiro",label:"Financeiro",ico:<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>},
    {id:"clientes",label:"Clientes",ico:<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>},
  ];
  return(
    <nav style={{position:"fixed",bottom:0,left:0,right:0,background:CARD,borderTop:`1px solid ${BD}`,display:"flex",zIndex:120,paddingBottom:"env(safe-area-inset-bottom,0px)",boxShadow:`0 -4px 16px rgba(0,0,0,0.06)`}}>
      {items.map(i=>{
        const active=tab===i.id;
        return(
          <button key={i.id} onClick={()=>setTab(i.id)} style={{flex:1,padding:"10px 4px 8px",border:"none",background:"transparent",cursor:"pointer",display:"flex",flexDirection:"column",alignItems:"center",gap:3,color:active?GRN:MUTED,transition:"color 0.15s",minHeight:56}}>
            <div style={{width:36,height:28,display:"flex",alignItems:"center",justifyContent:"center",borderRadius:10,background:active?GRN+"15":"transparent",transition:"background 0.15s"}}>{i.ico}</div>
            <span style={{fontSize:9,fontWeight:active?700:500,letterSpacing:"0.02em"}}>{i.label}</span>
          </button>
        );
      })}
    </nav>
  );
}

// ─── SIMULADOR DE CONTRATO ───────────────────────────────────────
function SimuladorContrato({simInicial,onClear,onAbrirContrato,clientes,contratos}){
  const calcPMT=(pv,i,n)=>{if(!n)return 0;return(pv+pv*i*n)/n;};
  const [clienteSel,setClienteSel]=useState(null);
  const [buscaCli,setBuscaCli]=useState("");
  const [showDrop,setShowDrop]=useState(false);
  const dropRef=useRef();
  const ini=simInicial||{};
  const [valor,setValor]=useState(ini.valor||1000);
  const [prazo,setPrazo]=useState(ini.prazo||6);
  const [taxa,setTaxa]=useState(ini.taxa||14);
  const [showTabela,setShowTabela]=useState(false);

  useEffect(()=>{
    const h=e=>{if(dropRef.current&&!dropRef.current.contains(e.target))setShowDrop(false);};
    document.addEventListener("mousedown",h);return()=>document.removeEventListener("mousedown",h);
  },[]);

  useEffect(()=>{
    if(simInicial){setValor(simInicial.valor||1000);setPrazo(simInicial.prazo||6);setTaxa(simInicial.taxa||14);setClienteSel(null);}
  },[simInicial]);

  const taxaPorScore=(score,bloqueado)=>{
    if(bloqueado)return 22;
    const s=parseFloat(score||0);
    if(s>=75)return 9;
    if(s>=60)return 12;
    if(s>=45)return 14;
    if(s>=25)return 16;
    if(s>0)return 22;
    return 14; // sem score → taxa padrão
  };
  const labelFaixaScore=(score,bloqueado)=>{
    if(bloqueado)return"bloqueado";
    const s=parseFloat(score||0);
    if(!s)return"sem score — taxa padrão";
    if(s>=75)return`score ${s} (excelente)`;
    if(s>=60)return`score ${s} (bom)`;
    if(s>=45)return`score ${s} (regular)`;
    if(s>=25)return`score ${s} (baixo)`;
    return`score ${s} (alto risco)`;
  };

  const ctxManual=useMemo(()=>{
    if(!clienteSel)return null;
    const c=clienteSel;
    const cts=(contratos||[]).filter(ct=>String(ct.ID_CLIENTE)===String(c.ID_CLIENTE)).sort((a,b)=>String(b.ID_CONTRATO||"").localeCompare(String(a.ID_CONTRATO||"")));
    const ult=cts[0];
    const bloqueado=String(c.SCORE_BLOQUEADO||"").toUpperCase()==="SIM";
    const score=parseFloat(c.SCORE||0);
    const taxaDef=parseFloat(c.SCORE_TAXA_PCT||0)||taxaPorScore(score,bloqueado);
    const valorDef=Math.round(parseFloat(ult?.VALOR_PRINCIPAL||0))||1000;
    const prazoDef=parseInt(ult?.NUM_PARCELAS||0)||6;
    const renda=parseFloat(c.RENDA||c.RENDA_MENSAL||0);
    const limite=parseFloat(c.LIMITE_CREDITO||0)||(ult?Math.round(parseFloat(ult.VALOR_PRINCIPAL||0)*1.2):0);
    return{
      nome:c.NOME||c.NOME_CLIENTE||c.NOME_COMPLETO||"",
      ID_CLIENTE:c.ID_CLIENTE,
      renda,parcelaMax:renda>0?renda*0.35:0,
      valor:limite,
      taxaDef,valorDef,prazoDef,
      score,scoreFaixa:c.SCORE_FAIXA||"",
      scoreBloqueado:bloqueado,
      faixaLabel:labelFaixaScore(score,bloqueado),
      qtdContratos:cts.length,
    };
  },[clienteSel,contratos]);

  useEffect(()=>{
    if(ctxManual){setTaxa(ctxManual.taxaDef);setValor(ctxManual.valorDef);setPrazo(ctxManual.prazoDef);}
  },[ctxManual]);

  const ctx=simInicial?.nome?{...simInicial}:ctxManual;
  const hasCliente=!!ctx;

  // ── TELA DE SELEÇÃO DE CLIENTE ──
  if(!hasCliente){
    const clisFilt=buscaCli.length>=2?(clientes||[]).filter(c=>{
      const q=buscaCli.toLowerCase();
      const nome=(c.NOME||c.NOME_CLIENTE||c.NOME_COMPLETO||"").toLowerCase();
      const cpfDigits=buscaCli.replace(/\D/g,"");
      return nome.includes(q)||String(c.ID_CLIENTE||"").toLowerCase().includes(q)||(cpfDigits.length>0&&String(c.CPF||"").replace(/\D/g,"").includes(cpfDigits));
    }).slice(0,8):[];
    return(
      <div style={{maxWidth:520,margin:"40px auto 0",display:"flex",flexDirection:"column",gap:24}}>
        <div style={{textAlign:"center"}}>
          <div style={{width:56,height:56,borderRadius:16,background:GRN+"15",border:`1.5px solid ${GRN}30`,display:"flex",alignItems:"center",justifyContent:"center",margin:"0 auto 16px"}}>
            <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke={GRN} strokeWidth="2"><rect x="4" y="4" width="16" height="16" rx="2"/><path d="M9 9h1v6H9"/><path d="M14 15h-2v-2h2"/><path d="M14 9h-2v2h2"/></svg>
          </div>
          <h2 style={{fontSize:20,fontWeight:900,margin:"0 0 6px",color:TEXT}}>Simulador de Contrato</h2>
          <p style={{fontSize:13,color:MUTED,margin:0,lineHeight:1.5}}>Selecione um cliente para carregar seus dados<br/>e iniciar a simulação</p>
        </div>
        <div style={{background:CARD,borderRadius:16,border:`1px solid ${BD}`,boxShadow:SHD,padding:24}} ref={dropRef}>
          <div style={{fontSize:11,fontWeight:700,textTransform:"uppercase",letterSpacing:"0.06em",color:MUTED,marginBottom:10}}>Selecionar cliente</div>
          <input value={buscaCli} onChange={e=>{setBuscaCli(e.target.value);setShowDrop(true);}} onFocus={()=>setShowDrop(true)}
            placeholder="Buscar por nome, CPF ou ID..."
            style={{...IS(),width:"100%",padding:"10px 14px",borderRadius:10,fontSize:13,boxSizing:"border-box"}}/>
          {showDrop&&buscaCli.length>=2&&(
            <div style={{marginTop:8,borderRadius:10,border:`1px solid ${BD}`,overflow:"hidden",background:CARD}}>
              {clisFilt.length===0
                ?<div style={{padding:"14px 16px",fontSize:12,color:MUTED,textAlign:"center"}}>Nenhum cliente encontrado</div>
                :clisFilt.map(c=>{
                  const nome=c.NOME||c.NOME_CLIENTE||c.NOME_COMPLETO||"";
                  const cts=(contratos||[]).filter(ct=>String(ct.ID_CLIENTE)===String(c.ID_CLIENTE));
                  const bloq=String(c.SCORE_BLOQUEADO||"").toUpperCase()==="SIM";
                  return(
                    <div key={c.ID_CLIENTE} onClick={()=>{setClienteSel(c);setBuscaCli(nome);setShowDrop(false);}}
                      style={{padding:"11px 16px",cursor:"pointer",borderBottom:`1px solid ${BD}40`,display:"flex",justifyContent:"space-between",alignItems:"center"}}>
                      <div>
                        <div style={{fontSize:13,fontWeight:700,color:TEXT}}>{nome}</div>
                        <div style={{fontSize:11,color:MUTED}}>{c.ID_CLIENTE}{cts.length>0?` · ${cts.length} contrato${cts.length>1?"s":""}`:""}</div>
                      </div>
                      <div style={{display:"flex",gap:6,alignItems:"center"}}>
                        {bloq&&<span style={{fontSize:10,fontWeight:700,padding:"2px 8px",borderRadius:20,background:RED+"15",color:RED,border:`1px solid ${RED}30`}}>BLOQ</span>}
                        <span style={{fontSize:10,fontWeight:700,padding:"2px 8px",borderRadius:20,background:GRN+"10",color:GRN}}>{c.STATUS_CLIENTE==="ativo"?"Ativo":c.STATUS_CLIENTE||"—"}</span>
                      </div>
                    </div>
                  );
                })
              }
            </div>
          )}
          {buscaCli.length<2&&<p style={{fontSize:11,color:MUTED,margin:"10px 0 0",textAlign:"center"}}>Digite ao menos 2 caracteres</p>}
        </div>
      </div>
    );
  }

  // ── SIMULADOR COM CLIENTE ──
  const renda=parseFloat(ctx?.renda||0);
  const parcelaMax=parseFloat(ctx?.parcelaMax||0);
  const nomeCliente=ctx?.nome||"";
  const limiteCredito=parseFloat(ctx?.valor||0);
  const clienteId=ctx?.ID_CLIENTE;

  const i=taxa/100;
  const pmt=calcPMT(valor,i,prazo);
  const total=pmt*prazo;
  const juros=total-valor;
  const pctRenda=renda>0?(pmt/renda)*100:0;
  const dentroParcela=parcelaMax>0?pmt<=parcelaMax:null;
  const dentroLimite=limiteCredito>0?valor<=limiteCredito:null;

  const rentPct=valor>0?(juros/valor)*100:0;
  const taxaAnualEfetiva=taxa*12;
  const riskScore=(prazo/12)*0.4+(taxa/25)*0.3+(valor/20000)*0.3;
  const riskLabel=riskScore>0.65?"Alto":riskScore>0.35?"Moderado":"Baixo";
  const riskColor=riskScore>0.65?RED:riskScore>0.35?YEL:GRN;

  const tabela=Array.from({length:prazo},(_,k)=>{
    const prin=valor/prazo;
    const jur=valor*i;
    const saldo=Math.max(0,valor-(k+1)*prin);
    return{n:k+1,pmt,juros:jur,principal:prin,saldo};
  });

  const cenariosOpts=[2,3,4,6,8,9,10,12];
  const cenariosBase=[prazo,...cenariosOpts.filter(p=>p!==prazo&&p>=1&&p<=12).sort((a,b)=>Math.abs(a-prazo)-Math.abs(b-prazo)).slice(0,2)].sort((a,b)=>a-b);

  const handleLimpar=()=>{setClienteSel(null);setBuscaCli("");setValor(1000);setPrazo(6);setTaxa(18);if(onClear)onClear();};

  const SliderInput=({label,value,onChange,min,max,step,fmt})=>(
    <div>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"baseline",marginBottom:8}}>
        <span style={{fontSize:11,fontWeight:700,textTransform:"uppercase",letterSpacing:"0.06em",color:MUTED}}>{label}</span>
        <span style={{fontSize:18,fontWeight:900,color:TEXT}}>{fmt(value)}</span>
      </div>
      <div style={{position:"relative",height:6,borderRadius:3,background:BD,marginBottom:4}}>
        <div style={{position:"absolute",left:0,top:0,height:"100%",borderRadius:3,background:GRN,width:`${((value-min)/(max-min))*100}%`}}/>
        <input type="range" min={min} max={max} step={step} value={value} onChange={e=>onChange(Number(e.target.value))}
          style={{position:"absolute",inset:0,width:"100%",opacity:0,cursor:"pointer",height:"100%",margin:0}}/>
      </div>
      <div style={{display:"flex",justifyContent:"space-between"}}>
        <span style={{fontSize:10,color:MUTED}}>{fmt(min)}</span>
        <span style={{fontSize:10,color:MUTED}}>{fmt(max)}</span>
      </div>
    </div>
  );

  return(
    <div style={{maxWidth:680,margin:"0 auto",display:"flex",flexDirection:"column",gap:20}}>
      {/* BANNER DO CLIENTE */}
      <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",background:GRN+"12",border:`1px solid ${GRN}25`,borderRadius:12,padding:"12px 16px"}}>
        <div style={{display:"flex",alignItems:"center",flexWrap:"wrap",gap:8}}>
          <div style={{width:8,height:8,borderRadius:"50%",background:GRN,flexShrink:0}}/>
          <span style={{fontSize:13,fontWeight:700,color:GRN}}>{nomeCliente}</span>
          {ctx?.score>0&&<span style={{fontSize:10,fontWeight:800,padding:"2px 8px",borderRadius:20,background:GRN+"20",color:GRN}}>Score {ctx.score}{ctx.scoreFaixa?` · ${ctx.scoreFaixa}`:""}</span>}
          {ctx?.scoreBloqueado&&<span style={{fontSize:10,fontWeight:800,padding:"2px 8px",borderRadius:20,background:RED+"20",color:RED}}>BLOQUEADO</span>}
          {ctx?.qtdContratos>0&&<span style={{fontSize:10,color:MUTED}}>{ctx.qtdContratos} contrato{ctx.qtdContratos>1?"s":""} anteriores</span>}
        </div>
        <button onClick={handleLimpar} style={{fontSize:11,color:MUTED,background:"none",border:"none",cursor:"pointer",fontWeight:600,whiteSpace:"nowrap",marginLeft:8}}>Trocar ×</button>
      </div>

      {/* INPUTS */}
      <div style={{background:CARD,borderRadius:16,border:`1px solid ${BD}`,boxShadow:SHD,padding:28,display:"flex",flexDirection:"column",gap:28}}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start"}}>
          <div>
            <h2 style={{fontSize:18,fontWeight:900,margin:"0 0 2px"}}>Simulador de Contrato</h2>
            <p style={{fontSize:12,color:MUTED,margin:0}}>Ajuste os parâmetros e veja o resultado em tempo real</p>
          </div>
          <span style={{fontSize:11,fontWeight:800,padding:"3px 10px",borderRadius:20,background:riskColor+"18",color:riskColor,border:`1px solid ${riskColor}35`,whiteSpace:"nowrap"}}>Risco {riskLabel}</span>
        </div>
        <div>
          <div style={{fontSize:11,fontWeight:700,textTransform:"uppercase",letterSpacing:"0.06em",color:MUTED,marginBottom:8}}>Valor do empréstimo</div>
          <div style={{display:"flex",alignItems:"center",gap:0,background:BG,border:`1.5px solid ${GRN}40`,borderRadius:10,overflow:"hidden",transition:"border-color 0.15s"}}
            onFocus={()=>{}} onBlur={()=>{}}>
            <span style={{padding:"10px 14px",fontSize:15,fontWeight:800,color:GRN,background:GRN+"10",borderRight:`1px solid ${GRN}25`,flexShrink:0}}>R$</span>
            <input
              type="number" min={100} max={100000} step={50}
              value={valor}
              onChange={e=>{const v=Number(e.target.value);if(v>=0)setValor(v);}}
              onBlur={e=>{const v=Math.max(100,Math.round(Number(e.target.value)/50)*50);setValor(v);}}
              style={{flex:1,padding:"10px 14px",background:"none",border:"none",outline:"none",fontSize:22,fontWeight:900,color:TEXT,width:"100%"}}
            />
          </div>
        </div>
        <div>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"baseline",marginBottom:10}}>
            <span style={{fontSize:11,fontWeight:700,textTransform:"uppercase",letterSpacing:"0.06em",color:MUTED}}>Prazo</span>
            <span style={{fontSize:18,fontWeight:900,color:TEXT}}>{prazo}x</span>
          </div>
          <div style={{display:"grid",gridTemplateColumns:"repeat(6,1fr)",gap:6}}>
            {[1,2,3,4,5,6,7,8,9,10,11,12].map(p=>(
              <button key={p} onClick={()=>setPrazo(p)}
                style={{padding:"8px 0",borderRadius:8,border:`1.5px solid ${prazo===p?GRN:BD}`,background:prazo===p?GRN+"20":CARD,color:prazo===p?GRN:MUTED,fontSize:13,fontWeight:prazo===p?800:600,cursor:"pointer",transition:"all 0.12s"}}>
                {p}x
              </button>
            ))}
          </div>
        </div>
        <div>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"baseline",marginBottom:8}}>
            <div>
              <span style={{fontSize:11,fontWeight:700,textTransform:"uppercase",letterSpacing:"0.06em",color:MUTED}}>Taxa mensal</span>
              <span style={{fontSize:10,color:MUTED,marginLeft:8,fontWeight:500}}>motor de crédito</span>
            </div>
            <span style={{fontSize:18,fontWeight:900,color:ctx?.scoreBloqueado?RED:GRN}}>{ctx?.scoreBloqueado?"bloqueado":`${taxa}% a.m.`}</span>
          </div>
          {ctx?.scoreBloqueado
            ?<div style={{display:"flex",alignItems:"center",gap:8,background:RED+"10",border:`1px solid ${RED}30`,borderRadius:10,padding:"12px 16px"}}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={RED} strokeWidth="2.5"><circle cx="12" cy="12" r="10"/><line x1="4.93" y1="4.93" x2="19.07" y2="19.07"/></svg>
                <span style={{fontSize:12,color:RED,fontWeight:700}}>Cliente bloqueado — não elegível para novos contratos</span>
              </div>
            :<div style={{display:"flex",alignItems:"center",justifyContent:"space-between",background:GRN+"08",border:`1px solid ${GRN}20`,borderRadius:10,padding:"12px 16px"}}>
                <div style={{display:"flex",alignItems:"center",gap:6}}>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={GRN} strokeWidth="2.5"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>
                  <span style={{fontSize:12,color:GRN,fontWeight:700}}>{taxa}% a.m.</span>
                  <span style={{fontSize:11,color:MUTED}}>·</span>
                  <span style={{fontSize:11,color:MUTED}}>{ctx?.faixaLabel||"sem score — taxa padrão"}</span>
                </div>
                <div style={{display:"flex",gap:4}}>
                  {[{t:9},{t:12},{t:14},{t:16},{t:22}].map(({t})=>(
                    <button key={t} onClick={()=>setTaxa(t)} style={{fontSize:10,fontWeight:t===taxa?800:500,padding:"2px 7px",borderRadius:6,background:t===taxa?GRN+"25":"transparent",color:t===taxa?GRN:MUTED,border:t===taxa?`1px solid ${GRN}40`:`1px solid ${BD}`,cursor:"pointer"}}>{t}%</button>
                  ))}
                </div>
              </div>
          }
        </div>
      </div>

      {/* COMPARADOR DE CENÁRIOS */}
      <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:10}}>
        {cenariosBase.map(p=>{
          const isCur=p===prazo;
          const pmtC=calcPMT(valor,i,p);
          const totC=pmtC*p;
          const jurC=totC-valor;
          return(
            <div key={p} onClick={()=>setPrazo(p)} style={{background:isCur?GRN+"18":CARD,border:`1.5px solid ${isCur?GRN:BD}`,borderRadius:12,padding:"14px 16px",cursor:"pointer",transition:"all 0.15s"}}>
              <div style={{fontSize:10,fontWeight:800,textTransform:"uppercase",color:isCur?GRN:MUTED,marginBottom:6,letterSpacing:"0.04em"}}>{p}x{isCur?" · atual":""}</div>
              <div style={{fontSize:16,fontWeight:900,color:isCur?GRN:TEXT,marginBottom:2}}>{fmtR(pmtC)}<span style={{fontSize:9,fontWeight:600,color:MUTED}}>/mês</span></div>
              <div style={{fontSize:10,color:MUTED,marginBottom:1}}>Total: {fmtR(totC)}</div>
              <div style={{fontSize:10,color:RED}}>Juros: {fmtR(jurC)}</div>
            </div>
          );
        })}
      </div>

      {/* RESULTADO */}
      <div style={{background:CARD,borderRadius:16,border:`1px solid ${GRN}30`,boxShadow:SHD,padding:28}}>
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12,marginBottom:16}}>
          <div style={{gridColumn:"1/-1",background:GRN+"12",borderRadius:12,padding:"20px 24px",display:"flex",alignItems:"center",justifyContent:"space-between"}}>
            <div>
              <div style={{fontSize:11,fontWeight:700,textTransform:"uppercase",letterSpacing:"0.06em",color:GRN,marginBottom:4}}>Parcela mensal</div>
              <div style={{fontSize:36,fontWeight:900,color:GRN,lineHeight:1}}>{fmtR(pmt)}</div>
            </div>
            <div style={{textAlign:"right"}}>
              <div style={{fontSize:10,color:MUTED,marginBottom:2}}>{prazo} parcelas</div>
              <div style={{fontSize:15,fontWeight:900,color:TEXT}}>{fmtR(total)}</div>
              <div style={{fontSize:10,color:MUTED,marginTop:2}}>valor total</div>
            </div>
          </div>
          {[{l:"Juros total",v:fmtR(juros),c:RED},{l:"Valor total",v:fmtR(total),c:TEXT}].map(m=>(
            <div key={m.l} style={{background:BG,borderRadius:10,padding:"14px 16px",border:`1px solid ${BD}`}}>
              <div style={{fontSize:10,fontWeight:700,textTransform:"uppercase",color:MUTED,marginBottom:4}}>{m.l}</div>
              <div style={{fontSize:17,fontWeight:900,color:m.c}}>{m.v}</div>
            </div>
          ))}
        </div>

        {/* INDICADORES CONTEXTUAIS */}
        {(pctRenda>0||dentroParcela!==null||dentroLimite!==null)&&(
          <div style={{display:"flex",flexDirection:"column",gap:8,paddingTop:16,borderTop:`1px solid ${BD}`,marginBottom:16}}>
            {pctRenda>0&&(
              <div style={{display:"flex",alignItems:"center",gap:8}}>
                <div style={{flex:1,height:4,borderRadius:2,background:BD,overflow:"hidden"}}>
                  <div style={{height:"100%",borderRadius:2,background:pctRenda>35?RED:pctRenda>25?YEL:GRN,width:`${Math.min(100,pctRenda)}%`,transition:"width 0.3s"}}/>
                </div>
                <span style={{fontSize:11,fontWeight:700,color:pctRenda>35?RED:pctRenda>25?YEL:GRN,whiteSpace:"nowrap"}}>{pctRenda.toFixed(1)}% da renda {pctRenda>35?"⚠ acima do limite":""}</span>
              </div>
            )}
            {dentroParcela!==null&&(
              <div style={{fontSize:11,fontWeight:700,color:dentroParcela?GRN:RED}}>
                {dentroParcela?"✓ Dentro da parcela máxima do cliente":"✗ Acima da parcela máxima do cliente"} ({fmtR(parcelaMax)})
              </div>
            )}
            {dentroLimite!==null&&(
              <div style={{fontSize:11,fontWeight:700,color:dentroLimite?GRN:RED}}>
                {dentroLimite?"✓ Dentro do limite do cliente":"✗ Acima do limite do cliente"} ({fmtR(limiteCredito)})
              </div>
            )}
          </div>
        )}

        {onAbrirContrato&&(ctx?.scoreBloqueado
          ?<div style={{width:"100%",padding:"13px 0",borderRadius:9999,background:BD,color:MUTED,fontSize:14,fontWeight:700,border:"none",textAlign:"center",cursor:"not-allowed"}}>
              Cliente bloqueado — contrato não disponível
            </div>
          :<button onClick={()=>onAbrirContrato({valor,prazo,taxa,...(clienteId?{ID_CLIENTE:clienteId,NOME:nomeCliente,NOME_CLIENTE:nomeCliente}:{})})}
              style={{width:"100%",padding:"13px 0",borderRadius:9999,background:ACC,color:GRN,fontSize:14,fontWeight:800,border:"none",cursor:"pointer",letterSpacing:"0.02em"}}>
              Abrir como Contrato
            </button>
        )}
        {(()=>{
          const telSim=String(clienteSel?.TELEFONE_WPP||clienteSel?.TELEFONE||"").replace(/\D/g,"");
          if(!telSim)return null;
          const msg=[
            'Perfeito, calculei aqui para ficar uma parcela saudável para o seu orçamento:',
            '',
            'Simulação Oficial 💰',
            'Você recebe: '+fmtR(valor),
            '📅 Parcelamento: '+prazo+'x de '+fmtR(pmt),
            '📈 Taxa de juros: '+taxa.toFixed(1)+'% a.m',
            '✅ Podemos formalizar assim para eu gerar seu contrato agora?'
          ].join('\n');
          const abrirWpp=()=>{
            const url='https://api.whatsapp.com/send?phone=55'+telSim+'&text='+encodeURIComponent(msg);
            const a=document.createElement('a');a.href=url;a.target='_blank';a.rel='noopener noreferrer';
            document.body.appendChild(a);a.click();document.body.removeChild(a);
          };
          const copiarMsg=()=>{navigator.clipboard?.writeText(msg).then(()=>alert('Mensagem copiada!'));};
          return(
            <div style={{display:"flex",flexDirection:"column",gap:8}}>
              <button onClick={abrirWpp}
                style={{width:"100%",padding:"13px 0",borderRadius:9999,background:"#25D366",color:"#fff",fontSize:14,fontWeight:800,border:"none",cursor:"pointer",letterSpacing:"0.02em",display:"flex",alignItems:"center",justifyContent:"center",gap:8}}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg>
                Enviar simulação no WhatsApp
              </button>
              <button onClick={copiarMsg}
                style={{width:"100%",padding:"10px 0",borderRadius:9999,background:"none",color:MUTED,fontSize:12,fontWeight:700,border:`1px solid ${BD}`,cursor:"pointer"}}>
                Copiar mensagem
              </button>
            </div>
          );
        })()}
      </div>

      {/* RENTABILIDADE DO CREDOR */}
      <div style={{background:CARD,borderRadius:16,border:`1px solid ${GRN}20`,boxShadow:SHD,padding:24}}>
        <div style={{fontSize:11,fontWeight:800,textTransform:"uppercase",letterSpacing:"0.06em",color:GRN,marginBottom:16}}>Rentabilidade do Credor</div>
        <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:12}}>
          {[
            {l:"Juros recebidos",v:fmtR(juros),c:GRN},
            {l:`Rentabilidade (${prazo}m)`,v:`${rentPct.toFixed(1)}%`,c:GRN},
            {l:"Taxa efetiva anual",v:`${taxaAnualEfetiva.toFixed(0)}% a.a.`,c:TEXT},
          ].map(m=>(
            <div key={m.l} style={{background:GRN+"08",borderRadius:10,padding:"14px 16px",border:`1px solid ${GRN}18`}}>
              <div style={{fontSize:10,fontWeight:700,textTransform:"uppercase",color:MUTED,marginBottom:4,lineHeight:1.3}}>{m.l}</div>
              <div style={{fontSize:16,fontWeight:900,color:m.c}}>{m.v}</div>
            </div>
          ))}
        </div>
      </div>

      {/* TABELA DE AMORTIZAÇÃO */}
      <div style={{background:CARD,borderRadius:16,border:`1px solid ${BD}`,boxShadow:SHD,overflow:"hidden"}}>
        <button onClick={()=>setShowTabela(v=>!v)} style={{width:"100%",padding:"16px 20px",background:"none",border:"none",cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"space-between",color:TEXT}}>
          <span style={{fontSize:13,fontWeight:700}}>Tabela de amortização</span>
          <span style={{fontSize:12,color:MUTED,transform:showTabela?"rotate(180deg)":"none",transition:"transform 0.2s"}}>▼</span>
        </button>
        {showTabela&&(
          <div style={{overflowX:"auto"}}>
            <table style={{width:"100%",borderCollapse:"collapse",fontSize:12}}>
              <thead>
                <tr style={{background:GRN+"10"}}>
                  {["#","Parcela","Juros","Principal","Saldo"].map(h=>(
                    <th key={h} style={{padding:"8px 12px",textAlign:h==="#"?"center":"right",fontSize:10,fontWeight:700,textTransform:"uppercase",color:GRN,letterSpacing:"0.05em",borderBottom:`1px solid ${BD}`}}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {tabela.map(row=>(
                  <tr key={row.n} style={{borderBottom:`1px solid ${BD}40`}}>
                    <td style={{padding:"8px 12px",textAlign:"center",color:MUTED,fontWeight:700}}>{row.n}</td>
                    <td style={{padding:"8px 12px",textAlign:"right",fontWeight:800,color:GRN}}>{fmtR(row.pmt)}</td>
                    <td style={{padding:"8px 12px",textAlign:"right",color:RED}}>{fmtR(row.juros)}</td>
                    <td style={{padding:"8px 12px",textAlign:"right",color:BLU}}>{fmtR(row.principal)}</td>
                    <td style={{padding:"8px 12px",textAlign:"right",color:MUTED}}>{fmtR(row.saldo)}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr style={{background:GRN+"08",borderTop:`2px solid ${GRN}25`}}>
                  <td style={{padding:"10px 12px",textAlign:"center",fontSize:10,fontWeight:800,textTransform:"uppercase",color:GRN}}>Total</td>
                  <td style={{padding:"10px 12px",textAlign:"right",fontWeight:800,color:GRN}}>{fmtR(total)}</td>
                  <td style={{padding:"10px 12px",textAlign:"right",fontWeight:800,color:RED}}>{fmtR(juros)}</td>
                  <td style={{padding:"10px 12px",textAlign:"right",fontWeight:800,color:BLU}}>{fmtR(valor)}</td>
                  <td style={{padding:"10px 12px",textAlign:"right",color:MUTED}}>—</td>
                </tr>
              </tfoot>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── INTELIGÊNCIA ────────────────────────────────────────────────
function InteligenciaView({ clientes, contratos, padrinhos, empregadores }) {
  const n = v => parseFloat(v||0)||0;

  const kpis = useMemo(() => {
    const lucro    = clientes.reduce((s,c)=>s+n(c.LUCRO_TOTAL),0);
    const prejuizo = clientes.reduce((s,c)=>s+n(c.PREJUIZO_TOTAL),0);
    const capital  = contratos.reduce((s,c)=>s+n(c.VALOR_PRINCIPAL),0);
    const ltv      = lucro - prejuizo;
    const roi      = capital > 0 ? (ltv / capital) * 100 : 0;
    return { lucro, prejuizo, ltv, capital, roi,
      inadim:   clientes.filter(c=>n(c.ATRASO_MAXIMO)>0).length,
      comPreju: clientes.filter(c=>n(c.PREJUIZO_TOTAL)>0).length,
      nCli:     clientes.length };
  }, [clientes, contratos]);

  const rankClientes = useMemo(() => {
    const com = clientes
      .filter(c=>n(c.LUCRO_TOTAL)>0||n(c.PREJUIZO_TOTAL)>0)
      .map(c=>({ nome:c.NOME||c.NOME_CLIENTE||"—", ltv:n(c.LTV_CLIENTE), lucro:n(c.LUCRO_TOTAL), prejuizo:n(c.PREJUIZO_TOTAL), roi:n(c.ROI_CLIENTE), ta:n(c.TAXA_ADIMPLENCIA) }));
    return {
      topLTV:    [...com].sort((a,b)=>b.ltv-a.ltv).slice(0,8),
      pioresLTV: [...com].sort((a,b)=>a.ltv-b.ltv).filter(c=>c.ltv<0||c.prejuizo>0).slice(0,5)
    };
  }, [clientes]);

  const porProfissao = useMemo(() => {
    const g = {};
    clientes.forEach(c => {
      const p = String(c.PROFISSAO||"").trim()||"Não informado";
      if(!g[p]) g[p]={n:0,lucro:0,prejuizo:0,somaROI:0,somaTA:0,somaAM:0,nROI:0,nTA:0,nAM:0};
      const x=g[p]; x.n++;
      x.lucro+=n(c.LUCRO_TOTAL); x.prejuizo+=n(c.PREJUIZO_TOTAL);
      const roi=n(c.ROI_CLIENTE); if(roi!==0){x.somaROI+=roi;x.nROI++;}
      const ta=n(c.TAXA_ADIMPLENCIA); if(ta>0){x.somaTA+=ta;x.nTA++;}
      const am=n(c.ATRASO_MEDIO); x.somaAM+=am; x.nAM++;
    });
    return Object.entries(g)
      .map(([prof,x])=>({ prof, n:x.n, ltv:x.lucro-x.prejuizo, lucro:x.lucro, prejuizo:x.prejuizo,
        roiMedio:x.nROI>0?x.somaROI/x.nROI:0, taMedio:x.nTA>0?x.somaTA/x.nTA:0, amMedio:x.nAM>0?x.somaAM/x.nAM:0 }))
      .filter(r=>r.lucro>0||r.prejuizo>0)
      .sort((a,b)=>b.ltv-a.ltv);
  }, [clientes]);

  const porPrazo = useMemo(() => {
    const buckets=[{l:"1–3x",min:1,max:3},{l:"4–6x",min:4,max:6},{l:"7–9x",min:7,max:9},{l:"10–12x",min:10,max:12}];
    const cliMap={};
    clientes.forEach(c=>{ if(c.ID_CLIENTE) cliMap[String(c.ID_CLIENTE)]={roi:n(c.ROI_CLIENTE),ta:n(c.TAXA_ADIMPLENCIA),am:n(c.ATRASO_MEDIO)}; });
    return buckets.map(b=>{
      const ctrs=contratos.filter(c=>{const np=parseInt(c.NUM_PARCELAS||0);return np>=b.min&&np<=b.max;});
      const capital=ctrs.reduce((s,c)=>s+n(c.VALOR_PRINCIPAL),0);
      let sROI=0,sTA=0,sAM=0,nROI=0,nTA=0,nAM=0,qtdP=0;
      ctrs.forEach(c=>{
        const cli=cliMap[String(c.ID_CLIENTE||"")];
        if(!cli)return;
        if(cli.roi!==0){sROI+=cli.roi;nROI++;}
        if(cli.ta>0){sTA+=cli.ta;nTA++;}
        sAM+=cli.am;nAM++;
        if(String(c.STATUS_CONTRATO||"").includes("prejuizo")||String(c.STATUS_CONTRATO||"").includes("recupera"))qtdP++;
      });
      return {l:b.l,n:ctrs.length,capital,roiMedio:nROI>0?sROI/nROI:0,taMedio:nTA>0?sTA/nTA:0,amMedio:nAM>0?sAM/nAM:0,qtdPreju:qtdP};
    });
  }, [contratos, clientes]);

  const scoreVsReal = useMemo(() => {
    const faixas=[{l:"Excelente (90–100)",min:90,max:100},{l:"Bom (75–89)",min:75,max:89},{l:"Médio (60–74)",min:60,max:74},{l:"Atenção (45–59)",min:45,max:59},{l:"Risco (30–44)",min:30,max:44}];
    return faixas.map(f=>{
      const g=clientes.filter(c=>{const sc=n(c.SCORE);return sc>=f.min&&sc<=f.max;});
      const lucro=g.reduce((s,c)=>s+n(c.LUCRO_TOTAL),0);
      const prejuizo=g.reduce((s,c)=>s+n(c.PREJUIZO_TOTAL),0);
      const capital=g.reduce((s,c)=>s+n(c.TOTAL_EMPRESTADO),0);
      const roi=capital>0?((lucro-prejuizo)/capital)*100:0;
      const taArr=g.filter(c=>n(c.TAXA_ADIMPLENCIA)>0);
      const ta=taArr.length>0?taArr.reduce((s,c)=>s+n(c.TAXA_ADIMPLENCIA),0)/taArr.length:0;
      return {l:f.l,n:g.length,lucro,prejuizo,ltv:lucro-prejuizo,roi,ta};
    });
  }, [clientes]);

  const KpiBox=({label,value,sub,cor})=>(
    <div style={{background:CARD,borderRadius:12,border:`1px solid ${BD}`,padding:"16px 20px",boxShadow:SHD}}>
      <div style={{fontSize:11,fontWeight:700,color:MUTED,textTransform:"uppercase",letterSpacing:"0.06em",marginBottom:6}}>{label}</div>
      <div style={{fontSize:22,fontWeight:900,color:cor||TEXT,letterSpacing:"-0.02em"}}>{value}</div>
      {sub&&<div style={{fontSize:11,color:MUTED,marginTop:3}}>{sub}</div>}
    </div>
  );

  const Card=({children,style={}})=>(
    <div style={{background:CARD,borderRadius:16,border:`1px solid ${BD}`,padding:"20px 24px",boxShadow:SHD,...style}}>{children}</div>
  );

  const SecH=({title,sub})=>(
    <div style={{marginBottom:14}}>
      <div style={{fontSize:14,fontWeight:800,color:TEXT}}>{title}</div>
      {sub&&<div style={{fontSize:11,color:MUTED,marginTop:2}}>{sub}</div>}
    </div>
  );

  const Tbl=({cols,rows,emptyMsg})=>(
    <div style={{overflowX:"auto"}}>
      <table style={{width:"100%",borderCollapse:"collapse",fontSize:12}}>
        <thead>
          <tr style={{background:GRN+"10"}}>
            {cols.map((c,i)=><th key={i} style={{padding:"7px 10px",textAlign:c.right?"right":"left",fontSize:11,fontWeight:700,textTransform:"uppercase",color:GRN,whiteSpace:"nowrap",borderBottom:`1px solid ${BD}`}}>{c.label}</th>)}
          </tr>
        </thead>
        <tbody>
          {rows.length===0
            ?<tr><td colSpan={cols.length} style={{padding:"20px 10px",textAlign:"center",color:MUTED,fontSize:12}}>{emptyMsg||"Sem dados"}</td></tr>
            :rows.map((r,ri)=>(
              <tr key={ri} style={{borderBottom:`1px solid ${BD}20`,background:ri%2===0?"transparent":BG+"80"}}>
                {cols.map((c,ci)=><td key={ci} style={{padding:"7px 10px",textAlign:c.right?"right":"left",color:c.color?c.color(r):TEXT,fontWeight:c.bold?700:400,whiteSpace:c.nowrap?"nowrap":"normal"}}>{c.render(r)}</td>)}
              </tr>
            ))
          }
        </tbody>
      </table>
    </div>
  );

  if(!clientes.length) return <div style={{padding:60,textAlign:"center",color:MUTED}}>Carregando dados...</div>;

  return (
    <div style={{padding:"24px 28px",maxWidth:1100,margin:"0 auto"}}>
      <div style={{marginBottom:24}}>
        <h1 style={{fontSize:22,fontWeight:900,color:TEXT,margin:"0 0 4px",letterSpacing:"-0.02em"}}>Inteligência</h1>
        <p style={{fontSize:13,color:MUTED,margin:0}}>Análise estratégica da operação de crédito</p>
      </div>

      {/* KPIs */}
      <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(155px,1fr))",gap:12,marginBottom:28}}>
        <KpiBox label="Lucro Total" value={fmtR(kpis.lucro)} sub="juros recebidos" cor={GRN}/>
        <KpiBox label="Prejuízo Total" value={fmtR(kpis.prejuizo)} sub="capital perdido" cor={kpis.prejuizo>0?RED:MUTED}/>
        <KpiBox label="LTV Líquido" value={fmtR(kpis.ltv)} sub="lucro − prejuízo" cor={kpis.ltv>=0?GRN:RED}/>
        <KpiBox label="ROI Geral" value={kpis.roi.toFixed(1)+"%"} sub="sobre capital total" cor={kpis.roi>=10?GRN:kpis.roi>=0?YEL:RED}/>
        <KpiBox label="Inadimplentes" value={kpis.inadim} sub={`de ${kpis.nCli} clientes`} cor={kpis.inadim>0?ORG:GRN}/>
        <KpiBox label="Com Prejuízo" value={kpis.comPreju} sub="clientes c/ perda" cor={kpis.comPreju>0?RED:GRN}/>
      </div>

      {/* Top/Bottom Clientes */}
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:20,marginBottom:24}}>
        <Card>
          <SecH title="Melhores clientes" sub="Por LTV líquido (lucro − prejuízo)"/>
          <Tbl cols={[
            {label:"Cliente",  render:r=>r.nome, nowrap:true},
            {label:"LTV",      render:r=>fmtR(r.ltv),  right:true, bold:true, color:r=>r.ltv>=0?GRN:RED},
            {label:"ROI %",    render:r=>r.roi.toFixed(1)+"%", right:true, color:r=>r.roi>=0?GRN:RED},
            {label:"Adim %",   render:r=>r.ta.toFixed(0)+"%",  right:true},
          ]} rows={rankClientes.topLTV}/>
        </Card>
        <Card>
          <SecH title="Clientes com prejuízo" sub="Capital perdido ou em risco"/>
          <Tbl cols={[
            {label:"Cliente",  render:r=>r.nome, nowrap:true},
            {label:"Prejuízo", render:r=>fmtR(r.prejuizo), right:true, bold:true, color:()=>RED},
            {label:"Lucro",    render:r=>fmtR(r.lucro),    right:true},
            {label:"Saldo",    render:r=>fmtR(r.ltv),      right:true, color:r=>r.ltv>=0?GRN:RED},
          ]} rows={rankClientes.pioresLTV} emptyMsg="Nenhum cliente com prejuízo registrado"/>
        </Card>
      </div>

      {/* Padrinhos */}
      <Card style={{marginBottom:24}}>
        <SecH title="Análise por Padrinho" sub="Qualidade da rede de indicações — ordenado por LTV gerado"/>
        {padrinhos.length===0
          ?<div style={{padding:"20px 0",textAlign:"center",color:MUTED,fontSize:13}}>Rode "Atualizar Tabela Padrinhos" no menu GAS para gerar esta análise.</div>
          :<Tbl cols={[
            {label:"Padrinho",     render:r=>r.NOME_PADRINHO||"—"},
            {label:"Indicados",    render:r=>r.QTD_INDICADOS||"—",        right:true},
            {label:"Inadim.",      render:r=>r.QTD_INADIMPLENTES||0,      right:true, color:r=>n(r.QTD_INADIMPLENTES)>0?ORG:GRN},
            {label:"c/ Prejuízo",  render:r=>r.QTD_COM_PREJUIZO||0,       right:true, color:r=>n(r.QTD_COM_PREJUIZO)>0?RED:GRN},
            {label:"Lucro Gerado", render:r=>fmtR(n(r.LUCRO_GERADO)),     right:true, bold:true},
            {label:"LTV Rede",     render:r=>fmtR(n(r.LTV_LIQUIDO)),      right:true, color:r=>n(r.LTV_LIQUIDO)>=0?GRN:RED},
            {label:"Score",        render:r=>{const sc=n(r.SCORE_PADRINHO);return<span style={{fontWeight:800,color:sc>=70?GRN:sc>=50?YEL:RED}}>{sc}</span>;}, right:true},
          ]} rows={padrinhos}/>
        }
      </Card>

      {/* Profissão */}
      <Card style={{marginBottom:24}}>
        <SecH title="Análise por Profissão" sub="Desempenho médio agrupado pela profissão do cliente"/>
        <Tbl cols={[
          {label:"Profissão",    render:r=>r.prof},
          {label:"Clientes",    render:r=>r.n,                            right:true},
          {label:"LTV Total",   render:r=>fmtR(r.ltv),                   right:true, bold:true, color:r=>r.ltv>=0?GRN:RED},
          {label:"ROI Médio",   render:r=>r.roiMedio.toFixed(1)+"%",     right:true, color:r=>r.roiMedio>=10?GRN:r.roiMedio>=0?YEL:RED},
          {label:"Adim. Média", render:r=>r.taMedio.toFixed(0)+"%",      right:true},
          {label:"Atraso Méd.", render:r=>r.amMedio.toFixed(0)+" d",     right:true, color:r=>r.amMedio>15?ORG:r.amMedio>5?YEL:GRN},
        ]} rows={porProfissao} emptyMsg="Preencha o campo Profissão nos cadastros"/>
      </Card>

      {/* Por Prazo */}
      <Card style={{marginBottom:24}}>
        <SecH title="Análise por Prazo" sub="Qual faixa de prazo gera melhor retorno e menor inadimplência"/>
        <Tbl cols={[
          {label:"Prazo",       render:r=>r.l,                            bold:true},
          {label:"Contratos",   render:r=>r.n,                            right:true},
          {label:"Capital",     render:r=>fmtR(r.capital),               right:true},
          {label:"ROI Médio",   render:r=>r.n>0?r.roiMedio.toFixed(1)+"%":"—", right:true, color:r=>r.roiMedio>=10?GRN:r.roiMedio>=0?YEL:RED},
          {label:"Adim. Média", render:r=>r.n>0?r.taMedio.toFixed(0)+"%":"—",  right:true},
          {label:"Atraso Méd.", render:r=>r.n>0?r.amMedio.toFixed(0)+" d":"—", right:true, color:r=>r.amMedio>15?ORG:r.amMedio>5?YEL:GRN},
          {label:"c/ Prejuízo", render:r=>r.qtdPreju||0,                 right:true, color:r=>r.qtdPreju>0?RED:GRN},
        ]} rows={porPrazo.filter(r=>r.n>0)}/>
      </Card>

      {/* Score vs Realidade */}
      <Card style={{marginBottom:24}}>
        <SecH title="Score vs Realidade" sub="O modelo de score está prevendo corretamente o comportamento de pagamento?"/>
        <Tbl cols={[
          {label:"Faixa de Score", render:r=>r.l,                        bold:true},
          {label:"Clientes",       render:r=>r.n,                        right:true},
          {label:"ROI Real",       render:r=>r.n>0?r.roi.toFixed(1)+"%":"—", right:true, color:r=>r.roi>=10?GRN:r.roi>=0?YEL:RED},
          {label:"Adim. Real",     render:r=>r.n>0?r.ta.toFixed(0)+"%":"—",  right:true},
          {label:"LTV Real",       render:r=>fmtR(r.ltv),               right:true, bold:true, color:r=>r.ltv>=0?GRN:RED},
          {label:"Lucro",          render:r=>fmtR(r.lucro),             right:true, color:()=>GRN},
          {label:"Prejuízo",       render:r=>fmtR(r.prejuizo),          right:true, color:r=>r.prejuizo>0?RED:MUTED},
        ]} rows={scoreVsReal.filter(r=>r.n>0)} emptyMsg="Nenhum cliente com score calculado"/>
      </Card>

      {/* Empregadores (se houver dados) */}
      {empregadores.length>0&&(
        <Card style={{marginBottom:24}}>
          <SecH title="Análise por Empregador" sub="Empresas com maior volume de clientes e melhor desempenho"/>
          <Tbl cols={[
            {label:"Empregador",  render:r=>r.EMPREGADOR||"—"},
            {label:"Clientes",    render:r=>r.QTD_CLIENTES||"—",        right:true},
            {label:"Capital",     render:r=>fmtR(n(r.CAPITAL_EMPRESTADO)), right:true},
            {label:"LTV",         render:r=>fmtR(n(r.LTV_LIQUIDO)),     right:true, bold:true, color:r=>n(r.LTV_LIQUIDO)>=0?GRN:RED},
            {label:"ROI Médio",   render:r=>n(r.ROI_MEDIO).toFixed(1)+"%", right:true, color:r=>n(r.ROI_MEDIO)>=10?GRN:n(r.ROI_MEDIO)>=0?YEL:RED},
            {label:"Score",       render:r=>{const sc=n(r.SCORE_EMPREGADOR);return<span style={{fontWeight:800,color:sc>=70?GRN:sc>=50?YEL:RED}}>{sc}</span>;}, right:true},
          ]} rows={empregadores.slice(0,10)}/>
        </Card>
      )}
    </div>
  );
}

// ─── APP ─────────────────────────────────────────────────────────
function App() {
  const mob = useIsMobile();
  const [raw, setRaw] = useState(null);
  const [tab, setTab] = useState("dashboard");
  const [simInicial, setSimInicial] = useState(null);
  const [loading, setLoading] = useState(()=>!localStorage.getItem("fp_data_v2"));
  const [sidebarOpen, setSidebarOpen] = useState(()=>window.innerWidth>768);
  const [selCli, setSelCli] = useState(null);
  const [baixaModal, setBaixaModal] = useState(null);
  const [acordoModal, setAcordoModal] = useState(null);
  const [quitacaoModal, setQuitacaoModal] = useState(null);
  const [recuperacaoModal, setRecuperacaoModal] = useState(null);
  const [perdaAcoesModal, setPerdaAcoesModal] = useState(null);
  const [cobModal, setCobModal] = useState(null);
  const [contratoSel, setContratoSel] = useState(null);
  const [filtroCtr, setFiltroCtr] = useState("");
  const [filtroStatusCtr, setFiltroStatusCtr] = useState("todos");
  const [simVal, setSimVal] = useState(5000);
  const [simInad, setSimInad] = useState(0);
  const [simVol, setSimVol] = useState(0);
  const [filtroStatus, setFiltroStatus] = useState("todos");
  const [filtroBusca, setFiltroBusca] = useState("");
  const [filtroPerdas, setFiltroPerdas] = useState("todos");
  const [finDe, setFinDe] = useState(null);
  const [finAte, setFinAte] = useState(null);
  const [finCalOpen, setFinCalOpen] = useState(false);
  const [dashCalOpen, setDashCalOpen] = useState(false);
  const [dashCalPos, setDashCalPos] = useState({top:0,right:0});
  const [finCalPos,  setFinCalPos]  = useState({top:0,right:0});
  const dashCalBtnRef = useRef(null);
  const finCalBtnRef  = useRef(null);
  const [pagamentoHoje, setPagamentoHoje] = useState(null);
  const [pagModo, setPagModo] = useState("pagamento");
  const [dashPeriodo, setDashPeriodo] = useState(()=>mesAtualRange());
  const [dashDe, setDashDe] = useState(()=>parseDate(mesAtualRange().ini));
  const [dashAte, setDashAte] = useState(()=>parseDate(mesAtualRange().fim));
  const [dashRegModal, setDashRegModal] = useState(false);
  const [dashNovoModal, setDashNovoModal] = useState(false);
  const [novoContratoIni, setNovoContratoIni] = useState(null);
  const [novaPromessa, setNovaPromessa] = useState(false);
  const [filtroPromessa, setFiltroPromessa] = useState("todos");
  const [chartPeriodo, setChartPeriodo] = useState("Max");
  const [dashFiltroPreset, setDashFiltroPreset] = useState("Este mês");
  const [selCliAba, setSelCliAba] = useState("perfil");
  const [privacy, setPrivacy] = useState(false);
  const [darkMode, setDarkMode] = useState(()=>{const d=isDarkHour();applyTheme(d);return d;});
  const toggleDark=()=>{const next=!darkMode;applyTheme(next);setDarkMode(next);};
  useEffect(()=>{
    const ref={tid:null};
    function schedule(){
      const now=new Date();const h=now.getHours();
      const next=new Date(now);
      if(h<6)next.setHours(6,0,0,0);
      else if(h<18)next.setHours(18,0,0,0);
      else{next.setDate(next.getDate()+1);next.setHours(6,0,0,0);}
      ref.tid=setTimeout(()=>{const dark=isDarkHour();applyTheme(dark);setDarkMode(dark);schedule();},next-now);
    }
    schedule();
    return()=>clearTimeout(ref.tid);
  },[]);
  const priv = v => privacy ? <span style={{filter:"blur(8px)",userSelect:"none",pointerEvents:"none"}}>{v}</span> : v;
  const [selPagDetalhe, setSelPagDetalhe] = useState(null);

  const [ultimaAt, setUltimaAt] = useState(null);
  const _fetching = useRef(false);
  const CACHE_KEY = "fp_data_v2";
  const carregar=(force=false)=>{
    if(!force&&_fetching.current)return Promise.resolve();
    _fetching.current=true;
    return fetch(API_URL).then(r=>r.json()).then(d=>{
      setRaw(d);
      try{localStorage.setItem(CACHE_KEY,JSON.stringify(d));}catch(e){}
      setLoading(false);
      setUltimaAt(new Date());
      _fetching.current=false;
    }).catch(()=>{setLoading(false);_fetching.current=false;});
  };
  useEffect(()=>{
    const cached=localStorage.getItem(CACHE_KEY);
    if(cached){try{setRaw(JSON.parse(cached));setLoading(false);}catch(e){}}
    carregar();
  },[]);
  useEffect(()=>{const id=setInterval(()=>carregar(),120000);return()=>clearInterval(id);},[]);

  const clientes  = useMemo(()=>raw?.CLIENTES  || raw?.clientes  || [], [raw]);
  const contratos = useMemo(()=>raw?.CONTRATOS || raw?.contratos || [], [raw]);
  const parcelas  = useMemo(()=>raw?.PARCELAS  || raw?.parcelas  || [], [raw]);
  const pagamentos= useMemo(()=>raw?.PAGAMENTOS|| raw?.pagamentos|| [], [raw]);
  const promessas    = useMemo(()=>raw?.PROMESSAS    || [], [raw]);
  const acordos      = useMemo(()=>raw?.ACORDOS      || [], [raw]);
  const padrinhos    = useMemo(()=>raw?.PADRINHOS    || [], [raw]);
  const empregadores = useMemo(()=>raw?.EMPREGADORES || [], [raw]);
  const cliMap = useMemo(()=>new Map((clientes||[]).map(c=>[String(c.ID_CLIENTE),c])), [clientes]);

  const promessasFiltradas = useMemo(()=>{
    const lista=[...promessas].sort((a,b)=>{
      const da=parseDate(a.DATA_PREVISTA_PAGAMENTO),db=parseDate(b.DATA_PREVISTA_PAGAMENTO);
      return (da||new Date(0))-(db||new Date(0));
    });
    if(filtroPromessa==="todos")return lista;
    return lista.filter(p=>String(p.STATUS_PROMESSA||"").toUpperCase()===filtroPromessa);
  },[promessas,filtroPromessa]);
  const nomeCliente=c=>c?.NOME_CLIENTE||c?.NOME||c?.CLIENTE||c?.NOME_COMPLETO||"Cliente sem nome";
  const telCliente=c=>c?.TELEFONE||c?.TELEFONE_WPP||c?.WHATSAPP||"—";
  const scoreCliente=c=>c?.SCORE||c?.SCORE_CLIENTE||c?.SCORE_SERASA||c?.SCORING||c?.SPC_SCORE||c?.SERASA_SCORE||"—";
  const scoreBadge=c=>{
    const sc=parseFloat(c?.SCORE||0);
    const faixa=c?.SCORE_FAIXA||"";
    const bloq=String(c?.SCORE_BLOQUEADO||"").toUpperCase()==="SIM";
    if(!sc&&!faixa)return null;
    const cor=bloq?RED:sc>=75?GRN:sc>=45?YEL:RED;
    return<span style={{display:"inline-flex",alignItems:"center",gap:3,background:cor+"18",color:cor,fontSize:10,fontWeight:800,padding:"1px 7px",borderRadius:20,border:`1px solid ${cor}35`,verticalAlign:"middle"}}>
      {sc}{faixa&&` · ${faixa}`}{bloq&&" · BLOQ"}
    </span>;
  };

  const filtrados=useMemo(()=>(clientes||[]).filter(c=>{const busca=filtroBusca.toLowerCase();const m=nomeCliente(c).toLowerCase().includes(busca)||String(c.ID_CLIENTE||"").toLowerCase().includes(busca)||String(telCliente(c)||"").toLowerCase().includes(busca)||String(c.CPF||"").toLowerCase().includes(busca);const s=filtroStatus==="todos"||c.STATUS_CLIENTE===filtroStatus;return m&&s;}),[clientes,filtroBusca,filtroStatus]);

  const pFiltradas=useMemo(()=>(contratos||[]).filter(c=>STATUS_PERDA.includes(c.STATUS_CONTRATO)&&(filtroPerdas==="todos"||c.STATUS_CONTRATO===filtroPerdas)),[contratos,filtroPerdas]);

  const perdaInfoMap=useMemo(()=>{
    const hoje=new Date();hoje.setHours(0,0,0,0);
    const m={};
    (parcelas||[]).forEach(p=>{
      const id=String(p.ID_CONTRATO||"").trim();
      if(!id)return;
      if(!m[id])m[id]={diasAtraso:0,qtdAtrasadas:0,saldoAberto:0};
      const st=String(p.STATUS||p.STATUS_PAGAMENTO||"").toLowerCase();
      if(!_ST_TERMINAL.has(st)){
        m[id].saldoAberto+=parseFloat(p.VALOR_PARCELA||0);
        const dv=parseDate(p.DATA_VENCIMENTO);
        if(dv){dv.setHours(0,0,0,0);const d=Math.round((hoje-dv)/86400000);if(d>0){m[id].qtdAtrasadas++;m[id].diasAtraso=Math.max(m[id].diasAtraso,d);}}
      }
    });
    return m;
  },[parcelas]);

  const contratosFiltrados=useMemo(()=>{
    const b=filtroCtr.toLowerCase();
    return (contratos||[]).filter(c=>{
      const m=String(c.ID_CONTRATO||"").toLowerCase().includes(b)||String(c.NOME_CLIENTE||"").toLowerCase().includes(b)||String(c.ID_CLIENTE||"").toLowerCase().includes(b);
      const s=filtroStatusCtr==="todos"||String(c.STATUS_CONTRATO||"")===filtroStatusCtr;
      return m&&s;
    }).sort((a,b)=>String(a.ID_CONTRATO||"").localeCompare(String(b.ID_CONTRATO||""),"pt-BR",{numeric:true}));
  },[contratos,filtroCtr,filtroStatusCtr]);

  const periodoDash=useMemo(()=>{
    const ini=parseDate(dashPeriodo.ini);
    const fim=parseDate(dashPeriodo.fim||dashPeriodo.ini);
    if(ini) ini.setHours(0,0,0,0);
    if(fim) fim.setHours(23,59,59,999);
    return {ini,fim};
  },[dashPeriodo]);

  const noPeriodoDash=(valor)=>{
    const d=parseDate(valor);
    if(!d||!periodoDash.ini||!periodoDash.fim)return false;
    d.setHours(12,0,0,0);
    return d>=periodoDash.ini&&d<=periodoDash.fim;
  };

  const labelPeriodoDash=useMemo(()=>{
    const ini=parseDate(dashPeriodo.ini);
    const fim=parseDate(dashPeriodo.fim);
    if(!ini||!fim)return "Período selecionado";
    return `${fmtDt(ini)} até ${fmtDt(fim)}`;
  },[dashPeriodo]);

  const resetPeriodoMesAtual=()=>{const r=mesAtualRange();setDashPeriodo(r);setDashDe(parseDate(r.ini));setDashAte(parseDate(r.fim));};
  const handlePreset=(p)=>{setDashFiltroPreset(p);if(p==="Este mês"){resetPeriodoMesAtual();}else{const hj=new Date();const dias=p==="30 dias"?30:90;const ini=new Date(hj);ini.setDate(ini.getDate()-dias);const r={ini:dateInputStr(ini),fim:dateInputStr(hj)};setDashPeriodo(r);setDashDe(parseDate(r.ini));setDashAte(parseDate(r.fim));}};

  const M=useMemo(()=>{
    const ST_ATIVOS=["ativo","ativo_em_dia","ativo_em_atraso","em_cobranca","pre_prejuizo","renegociado","em_recuperacao","recuperado_parcialmente"];
    const ativos=(contratos||[]).filter(c=>ST_ATIVOS.includes(String(c.STATUS_CONTRATO||"").toLowerCase()));
    const vAtivos=ativos.reduce((s,c)=>s+parseFloat(c.VALOR_PRINCIPAL||0),0);
    const statusPago=p=>["pago","paga","quitado","quitada","baixado","baixada"].includes(String(p.STATUS||p.STATUS_PARCELA||"").toLowerCase());
    const parcelasPeriodo=(parcelas||[]).filter(p=>noPeriodoDash(p.DATA_VENCIMENTO));
    const pagamentosPeriodo=(pagamentos||[]).filter(p=>noPeriodoDash(p.DATA_PAGAMENTO));
    const parcelasAbertas=(parcelasPeriodo||[]).filter(p=>!statusPago(p));
    const parcelasPagas=(parcelasPeriodo||[]).filter(p=>statusPago(p));
    const vAtrasoTotal=parcelasAbertas.filter(p=>String(p.STATUS||p.STATUS_PARCELA||"").toLowerCase()==="atrasado").reduce((s,p)=>s+parseFloat(p.VALOR_PARCELA||0),0);
    const taxaInad=vAtivos>0?(vAtrasoTotal/vAtivos*100):0;
    const receitaTotal=(pagamentosPeriodo||[]).reduce((s,p)=>s+parseFloat(p.VALOR_PAGO||0),0);
    const receitaExtra=(pagamentosPeriodo||[]).reduce((s,p)=>s+parseFloat(p.RECEITA_EXTRA_ATRASO||0),0);
    const lucro=(pagamentosPeriodo||[]).reduce((s,pag)=>{
      const parc=(parcelas||[]).find(p=>String(p.ID_PARCELA)===String(pag.ID_PARCELA));
      const jurosBase=parc?parseFloat(parc.VALOR_JUROS||0)-parseFloat(parc.DESCONTO_APLICADO||0):0;
      return s+jurosBase+parseFloat(pag.RECEITA_EXTRA_ATRASO||0);
    },0);
    const qtyProrrogadas=(parcelasPeriodo||[]).filter(p=>p.ORIGEM_PARCELA==="gerada_por_pagamento_de_juros").length;
    const pagNormais=(pagamentosPeriodo||[]).filter(p=>p.TIPO_PAGAMENTO==="pagamento_normal").length;
    const pagAtraso=(pagamentosPeriodo||[]).filter(p=>p.TIPO_PAGAMENTO==="pagamento_com_atraso").length;
    const pagJuros=(pagamentosPeriodo||[]).filter(p=>p.TIPO_PAGAMENTO==="somente_juros").length;
    const vPendente=parcelasAbertas.reduce((s,p)=>s+parseFloat(p.VALOR_PARCELA||0),0);
    const totalRecebidoGeral=(pagamentos||[]).reduce((s,p)=>s+parseFloat(p.VALOR_PAGO||0),0);
    const principalLiberadoGeral=(contratos||[]).reduce((s,c)=>s+parseFloat(c.VALOR_PRINCIPAL||0),0);
    const caixaAtual=totalRecebidoGeral-principalLiberadoGeral;
    return{vAtivos,vAtrasoTotal,taxaInad,lucroTotal:receitaExtra,receitaTotal,receitaExtra,lucro,qtyProrrogadas,pagNormais,pagAtraso,pagJuros,totalCobrancas:(parcelasPeriodo||[]).length,parcelasPagas:parcelasPagas.length,parcelasPendentes:parcelasAbertas.length,vPendente,contratosAtivos:ativos.length,caixaAtual,pagamentosPeriodo:pagamentosPeriodo.length};
  },[contratos,parcelas,pagamentos,periodoDash]);

  const chartData=useMemo(()=>{
    const n=chartPeriodo==="3M"?3:chartPeriodo==="6M"?6:chartPeriodo==="1A"?12:24;
    const hoje=new Date();
    return Array.from({length:n},(_,i)=>{
      const dt=new Date(hoje.getFullYear(),hoje.getMonth()-(n-1-i),1);
      const ini=new Date(dt.getFullYear(),dt.getMonth(),1,0,0,0);
      const fim=new Date(dt.getFullYear(),dt.getMonth()+1,0,23,59,59);
      const total=(pagamentos||[]).filter(p=>{const dp=parseDate(p.DATA_PAGAMENTO);return dp&&dp>=ini&&dp<=fim;}).reduce((s,p)=>s+parseFloat(p.VALOR_PAGO||0),0);
      return{name:dt.toLocaleDateString("pt-BR",{month:"short"}).replace(".",""),value:total};
    });
  },[pagamentos,chartPeriodo]);

  const parcelasHoje=useMemo(()=>{
    const base=new Date();base.setHours(0,0,0,0);
    return (parcelas||[]).filter(p=>{
      const status=String(p.STATUS||p.STATUS_PARCELA||"").toLowerCase();
      if(_ST_TERMINAL.has(status))return false;
      if(p.DATA_ACORDO){const da=parseDate(p.DATA_ACORDO);if(da){da.setHours(0,0,0,0);if(da.getTime()===base.getTime())return true;}}
      const d=parseDate(p.DATA_VENCIMENTO);if(!d)return false;d.setHours(0,0,0,0);
      return d.getTime()===base.getTime();
    }).map(p=>{
      const c=cliMap.get(String(p.ID_CLIENTE));
      const da=p.DATA_ACORDO?parseDate(p.DATA_ACORDO):null;
      const _reagendadaHoje=da?(()=>{const d2=new Date(da);d2.setHours(0,0,0,0);return d2.getTime()===base.getTime();})():false;
      return{...p,NOME_CLIENTE:p.NOME_CLIENTE||nomeCliente(c),_reagendadaHoje};
    }).sort((a,b)=>String(a.NOME_CLIENTE||"").localeCompare(String(b.NOME_CLIENTE||""),"pt-BR"));
  },[parcelas,clientes]);
  const totalParcelasHoje=useMemo(()=>parcelasHoje.reduce((s,p)=>s+parseFloat(p.VALOR_PARCELA||0),0),[parcelasHoje]);

  const parcelasAtrasadas=useMemo(()=>{
    const base=new Date();base.setHours(0,0,0,0);
    const _contratos_excluidos=new Set((contratos||[]).filter(c=>_ST_CONTRATO_EXCLUIDO.has(String(c.STATUS_CONTRATO||"").toLowerCase())).map(c=>String(c.ID_CONTRATO)));
    return (parcelas||[]).filter(p=>{
      const status=String(p.STATUS||p.STATUS_PARCELA||"").toLowerCase();
      if(_ST_TERMINAL.has(status))return false;
      if(_contratos_excluidos.has(String(p.ID_CONTRATO)))return false;
      // Excluir parcelas com acordo futuro (reagendadas)
      if(p.DATA_ACORDO){const da=parseDate(p.DATA_ACORDO);if(da){da.setHours(0,0,0,0);if(da.getTime()>=base.getTime())return false;}}
      const d=parseDate(p.DATA_VENCIMENTO);if(!d)return false;d.setHours(0,0,0,0);
      return status==="atrasado" || d.getTime()<base.getTime();
    }).map(p=>{const c=cliMap.get(String(p.ID_CLIENTE));const d=parseDate(p.DATA_VENCIMENTO);const dias=d?Math.max(1,Math.round((new Date()-d)/86400000)):0;return{...p,NOME_CLIENTE:p.NOME_CLIENTE||nomeCliente(c),DIAS_ATRASO:dias};}).sort((a,b)=>(b.DIAS_ATRASO||0)-(a.DIAS_ATRASO||0));
  },[parcelas,contratos,clientes]);
  const totalParcelasAtrasadas=useMemo(()=>parcelasAtrasadas.reduce((s,p)=>s+parseFloat(p.VALOR_PARCELA||0),0),[parcelasAtrasadas]);

  const mensal=useMemo(()=>["Jan","Fev","Mar","Abr","Mai","Jun","Jul","Ago","Set","Out","Nov","Dez"].map((mes,i)=>{
    const pMes=(pagamentos||[]).filter(p=>{const d=parseDate(p.DATA_PAGAMENTO);return d&&d.getMonth()===i;});
    return{m:mes,v:pMes.reduce((s,p)=>s+parseFloat(p.VALOR_PAGO||0),0),extra:pMes.reduce((s,p)=>s+parseFloat(p.RECEITA_EXTRA_ATRASO||0),0)};
  }),[pagamentos]);

  // ── cobItems: inclui parcelasAtrasadas de cada cliente ──────────
  const cobItems=useMemo(()=>{
    const _ST_EXCL_COB=new Set([..._ST_CONTRATO_EXCLUIDO,"encerrado_sem_recuperacao"]);
    const _contratosExcluidos=new Set((contratos||[]).filter(c=>_ST_EXCL_COB.has(String(c.STATUS_CONTRATO||"").toLowerCase())).map(c=>String(c.ID_CONTRATO)));
    const pAtrasadas=(parcelas||[]).filter(p=>!_contratosExcluidos.has(String(p.ID_CONTRATO))&&String(p.STATUS||p.STATUS_PARCELA||"").toLowerCase()==="atrasado");
    const ids=[...new Set(pAtrasadas.map(p=>p.ID_CLIENTE))];
    return ids.map(id=>{
      const c=cliMap.get(String(id));
      const ps=pAtrasadas.filter(p=>String(p.ID_CLIENTE)===String(id));
      const psComDias=ps.map(p=>{
        const dv=parseDate(p.DATA_VENCIMENTO);
        const dias=dv?Math.max(1,Math.round((new Date()-dv)/86400000)):0;
        return{...p,DIAS_ATRASO:dias,NOME_CLIENTE:p.NOME_CLIENTE||(c?nomeCliente(c):"")};
      }).sort((a,b)=>b.DIAS_ATRASO-a.DIAS_ATRASO);
      const vAtraso=ps.reduce((s,p)=>s+parseFloat(p.VALOR_PARCELA||0),0);
      const maxAtraso=psComDias.length>0?psComDias[0].DIAS_ATRASO:0;
      const ref=ps[0]||{};
      const nome=c?nomeCliente(c):(ref.NOME_CLIENTE||"Cliente sem nome");
      const telefone=c?telCliente(c):(ref.TELEFONE||ref.TELEFONE_WPP||"—");
      return{
        ...c,
        ID_CLIENTE:id,
        NOME_CLIENTE:nome,
        TELEFONE:telefone,
        vAtraso,
        maxAtraso,
        qtdContratos:[...new Set(ps.map(p=>p.ID_CONTRATO))].length,
        parcelasAtrasadas:psComDias,   // ← parcelas com DIAS_ATRASO calculado
      };
    }).sort((a,b)=>b.maxAtraso-a.maxAtraso);
  },[clientes,parcelas]);

  const perdas=useMemo(()=>{
    const todos=contratos||[];
    const baixados=todos.filter(c=>c.STATUS_CONTRATO==="baixado_como_prejuizo");
    const emRisco=todos.filter(c=>["em_cobranca","pre_prejuizo"].includes(c.STATUS_CONTRATO));
    const emRec=todos.filter(c=>["em_recuperacao","recuperado_parcialmente"].includes(c.STATUS_CONTRATO));
    const capitalEmRisco=emRisco.reduce((s,c)=>s+parseFloat(c.VALOR_PRINCIPAL||0),0);
    const qtdEmRisco=emRisco.length;
    const capitalBaixado=baixados.reduce((s,c)=>s+parseFloat(c.PREJUIZO_CAPITAL||0),0);
    const recuperadoAposBaixa=[...baixados,...emRec].reduce((s,c)=>s+parseFloat(c.VALOR_RECUPERADO_APOS_BAIXA||0),0);
    const prejuizoReal=capitalBaixado-recuperadoAposBaixa;
    const txRecuperacao=capitalBaixado>0?(recuperadoAposBaixa/capitalBaixado*100):0;
    return{capitalEmRisco,qtdEmRisco,capitalBaixado,recuperadoAposBaixa,prejuizoReal,txRecuperacao};
  },[contratos]);

  const pagsFiltrados=useMemo(()=>{
    const sorted=[...(pagamentos||[])].sort((a,b)=>{const d=toNum(b.DATA_PAGAMENTO)-toNum(a.DATA_PAGAMENTO);if(d!==0)return d;return String(b.ID_PAGAMENTO||"").localeCompare(String(a.ID_PAGAMENTO||""),"pt-BR",{numeric:true});});
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

  const finKpis=useMemo(()=>{
    const pags=pagsFiltrados;
    const ini=finDe?new Date(finDe):null;if(ini)ini.setHours(0,0,0,0);
    const fim=finAte?new Date(finAte):(finDe?new Date(finDe):null);if(fim)fim.setHours(23,59,59,999);
    const inPeriod=(p)=>{
      const d=parseDate(p.DATA_VENCIMENTO);if(!d)return false;d.setHours(12,0,0,0);
      if(!ini||!fim)return true;
      return d>=ini&&d<=fim;
    };
    const parcsP=finDe?(parcelas||[]).filter(p=>inPeriod(p)):(parcelas||[]);
    const receitaTotal=pags.reduce((s,p)=>s+parseFloat(p.VALOR_PAGO||0),0);
    const receitaExtra=pags.reduce((s,p)=>s+parseFloat(p.RECEITA_EXTRA_ATRASO||0),0);
    const lucro=pags.reduce((s,pag)=>{
      const parc=(parcelas||[]).find(p=>String(p.ID_PARCELA)===String(pag.ID_PARCELA));
      const jurosEfetivos=parc?parseFloat(parc.VALOR_JUROS||0)-parseFloat(parc.DESCONTO_APLICADO||0):0;
      return s+jurosEfetivos+parseFloat(pag.RECEITA_EXTRA_ATRASO||0);
    },0);
    const qtyProrrogadas=parcsP.filter(p=>p.ORIGEM_PARCELA==="gerada_por_pagamento_de_juros").length;
    const pagNormais=pags.filter(p=>p.TIPO_PAGAMENTO==="pagamento_normal").length;
    const pagAtraso=pags.filter(p=>p.TIPO_PAGAMENTO==="pagamento_com_atraso").length;
    const pagJuros=pags.filter(p=>p.TIPO_PAGAMENTO==="somente_juros").length;
    return{receitaTotal,receitaExtra,lucro,qtyProrrogadas,pagNormais,pagAtraso,pagJuros};
  },[pagsFiltrados,parcelas,finDe,finAte]);

  function dStrFin(d){return d?d.toLocaleDateString("pt-BR",{day:"2-digit",month:"2-digit",year:"numeric"}):""}
  const labelPeriodo=finDe&&finAte?`${dStrFin(finDe)} → ${dStrFin(finAte)}`:finDe?`A partir de ${dStrFin(finDe)}`:"Selecionar período";

  function exportarPDFFinanceiro(){
    try{
      const doc=new jsPDF({unit:'mm',format:'a4'});
      const W=210,pd=16,CW=W-2*pd;
      const NAV=[11,61,46],G=[11,61,46],B=[27,138,143],O=[255,119,0],R=[214,69,69],P=[34,29,154];
      const DK=[18,24,21],MUT=[110,121,117],BDC=[221,227,224],LGR=[247,249,248],WH=[255,255,255];
      const tLBL={pagamento_normal:"Normal",normal:"Normal",pagamento_com_atraso:"Com Atraso",com_atraso:"Com Atraso",somente_juros:"Somente Juros",recuperacao_apos_baixa:"Recuperação",pagamento_antecipado:"Antecipado",antecipado:"Antecipado",quitacao_antecipada:"Quitação Antecip."};
      const tCOR={pagamento_normal:G,normal:G,pagamento_com_atraso:O,com_atraso:O,somente_juros:R,recuperacao_apos_baixa:P,pagamento_antecipado:B,antecipado:B,quitacao_antecipada:G};
      const fR=v=>parseFloat(v||0).toLocaleString('pt-BR',{style:'currency',currency:'BRL'});
      const periodo=finDe?labelPeriodo:"Todos os pagamentos";
      const now=new Date();
      const geradoEm=now.toLocaleDateString('pt-BR')+' às '+now.toLocaleTimeString('pt-BR',{hour:'2-digit',minute:'2-digit'});
      const total=pagsFiltrados.length;

      // Mapa de parcelas para O(1) lookup
      const parcMap=new Map((parcelas||[]).map(p=>[String(p.ID_PARCELA),p]));
      const getParcela=p=>parcMap.get(String(p.ID_PARCELA));

      // Totais de principal e juros
      const totalPrincipal=pagsFiltrados.reduce((s,p)=>s+parseFloat(getParcela(p)?.VALOR_PRINCIPAL||0),0);
      const totalJuros=pagsFiltrados.reduce((s,p)=>{
        const parc=getParcela(p);
        return s+Math.max(0,parseFloat(parc?.VALOR_JUROS||0)-parseFloat(parc?.DESCONTO_APLICADO||0));
      },0);

      const grupos=[
        {label:'Normal',tipos:['pagamento_normal','normal'],c:G},
        {label:'Com Atraso',tipos:['pagamento_com_atraso','com_atraso'],c:O},
        {label:'Somente Juros',tipos:['somente_juros'],c:R},
        {label:'Antecipado',tipos:['pagamento_antecipado','antecipado','quitacao_antecipada'],c:B},
        {label:'Recuperação',tipos:['recuperacao_apos_baixa'],c:P},
      ].map(g=>({...g,count:pagsFiltrados.filter(p=>g.tipos.includes(p.TIPO_PAGAMENTO)).length})).filter(g=>g.count>0);

      // ─── CABEÇALHO ───
      // Header escuro com logo brand
      const SG=[31,184,119],DST=[7,36,27];
      doc.setFillColor(...NAV);doc.rect(0,0,W,44,'F');
      // Logo mark
      doc.setFillColor(...SG);doc.roundedRect(pd,11,9,9,2,2,'F');
      doc.setFillColor(255,255,255);doc.roundedRect(pd+6,17,9,9,2,2,'F');
      doc.setFillColor(...DST);doc.roundedRect(pd+6,17,3.5,3.5,0.8,0.8,'F');
      // Brand name
      doc.setFont('helvetica','bold');doc.setFontSize(15);doc.setTextColor(...WH);doc.text('BORGES ASSESSORIA',pd+17,17);
      doc.setFont('helvetica','normal');doc.setFontSize(7.5);doc.setTextColor(135,223,182);doc.text('RELATÓRIO FINANCEIRO',pd+17,23);
      // Contact info right
      ['borgesassessoriafinanceira@gmail.com','(62) 98487-7843'].forEach((l,i)=>{
        doc.setFont('helvetica','normal');doc.setFontSize(7);doc.setTextColor(135,223,182);doc.text(l,W-pd,14+i*5,{align:'right'});
      });
      // Period pill
      doc.setFillColor(14,92,68);doc.roundedRect(W-pd-70,29,70,10,2,2,'F');
      doc.setFont('helvetica','bold');doc.setFontSize(8);doc.setTextColor(...WH);
      doc.text(doc.splitTextToSize(periodo,66)[0],W-pd-35,35,{align:'center'});
      doc.setFont('helvetica','normal');doc.setFontSize(7);doc.setTextColor(135,223,182);doc.text(`Gerado em: ${geradoEm}`,pd,36);

      let y=54;

      // ─── KPI CARDS ───
      const cardW=(CW-8)/3;
      [{label:'RECEITA TOTAL',val:fR(finKpis.receitaTotal),sub:`${total} pagamentos`,c:B},
       {label:'LUCRO DO PERÍODO',val:fR(finKpis.lucro),sub:'Juros contratuais + extra atraso',c:G},
       {label:'RECEITA EXTRA ATRASO',val:fR(finKpis.receitaExtra),sub:'Multas e juros por atraso',c:O},
      ].forEach((card,i)=>{
        const cx=pd+i*(cardW+4);
        doc.setFillColor(...LGR);doc.setDrawColor(...BDC);doc.setLineWidth(0.3);doc.roundedRect(cx,y,cardW,30,3,3,'FD');
        doc.setFillColor(...card.c);doc.roundedRect(cx,y,3,30,1.5,1.5,'F');
        doc.setFont('helvetica','bold');doc.setFontSize(6.5);doc.setTextColor(...MUT);doc.text(card.label,cx+7,y+9);
        doc.setFont('helvetica','bold');doc.setFontSize(12);doc.setTextColor(...card.c);doc.text(card.val,cx+7,y+20);
        doc.setFont('helvetica','normal');doc.setFontSize(6.5);doc.setTextColor(...MUT);doc.text(card.sub,cx+7,y+26);
      });
      y+=40;

      // ─── DISTRIBUIÇÃO ───
      doc.setFont('helvetica','bold');doc.setFontSize(10);doc.setTextColor(...DK);doc.text('DISTRIBUIÇÃO DE PAGAMENTOS',pd,y);
      doc.setDrawColor(...BDC);doc.setLineWidth(0.4);doc.line(pd,y+2,W-pd,y+2);
      y+=10;
      const barX=pd+44,barW=CW-44-26;
      grupos.forEach(g=>{
        const pct=total>0?g.count/total:0;
        doc.setFillColor(...g.c);doc.rect(pd+2,y+1.5,4,4,'F');
        doc.setFont('helvetica','normal');doc.setFontSize(8.5);doc.setTextColor(...DK);doc.text(g.label,pd+9,y+5.5);
        doc.setFillColor(...BDC);doc.roundedRect(barX,y,barW,7,1.5,1.5,'F');
        if(pct>0){doc.setFillColor(...g.c);doc.roundedRect(barX,y,Math.max(2,barW*pct),7,1.5,1.5,'F');}
        doc.setFont('helvetica','bold');doc.setFontSize(8);doc.setTextColor(...DK);doc.text(String(g.count),barX+barW+3,y+5.5);
        doc.setFont('helvetica','normal');doc.setFontSize(7.5);doc.setTextColor(...MUT);doc.text((pct*100).toFixed(1)+'%',barX+barW+14,y+5.5);
        y+=12;
      });
      y+=6;

      // ─── COMPOSIÇÃO DA RECEITA (5 colunas: Principal | Juros | Extra | Lucro | Nº) ───
      doc.setFillColor(...LGR);doc.setDrawColor(...BDC);doc.setLineWidth(0.3);doc.roundedRect(pd,y,CW,30,3,3,'FD');
      // Título da seção
      doc.setFont('helvetica','bold');doc.setFontSize(7);doc.setTextColor(...MUT);
      doc.text('COMPOSIÇÃO DA RECEITA',pd+4,y+6);
      doc.setDrawColor(...BDC);doc.setLineWidth(0.2);doc.line(pd,y+9,pd+CW,y+9);
      const sc5=[
        {label:'CAPITAL RECEBIDO',val:fR(totalPrincipal),c:DK,sub:'principal das parcelas'},
        {label:'JUROS CONTRATUAIS',val:fR(totalJuros),c:B,sub:'rendimento esperado'},
        {label:'RECEITA EXTRA',val:fR(finKpis.receitaExtra),c:O,sub:'multa por atraso'},
        {label:'LUCRO TOTAL',val:fR(finKpis.lucro),c:G,sub:'juros + extra'},
        {label:'Nº PAGAMENTOS',val:String(total),c:DK,sub:'registros no período'},
      ];
      const sc5W=CW/5;
      sc5.forEach((sc,i)=>{
        const cx=pd+i*sc5W+sc5W/2;
        if(i>0){doc.setDrawColor(...BDC);doc.setLineWidth(0.2);doc.line(pd+i*sc5W,y+10,pd+i*sc5W,y+28);}
        doc.setFont('helvetica','bold');doc.setFontSize(6.5);doc.setTextColor(...MUT);doc.text(sc.label,cx,y+15,{align:'center'});
        doc.setFont('helvetica','bold');doc.setFontSize(i===4?14:10.5);doc.setTextColor(...sc.c);doc.text(sc.val,cx,y+23,{align:'center'});
        doc.setFont('helvetica','normal');doc.setFontSize(6);doc.setTextColor(...MUT);doc.text(sc.sub,cx,y+28,{align:'center'});
      });
      y+=40;

      // ─── TABELA: 7 colunas ───
      // DATA(18) | CLIENTE(48) | TIPO(22) | PRINCIPAL(24) | JUROS(22) | VLR PAGO(24) | EXTRA(20)
      // x:   16       34          82          104             128          150            174   → 194 ✓
      doc.setFont('helvetica','bold');doc.setFontSize(10);doc.setTextColor(...DK);doc.text('DETALHAMENTO DOS PAGAMENTOS',pd,y);
      doc.setDrawColor(...BDC);doc.setLineWidth(0.4);doc.line(pd,y+2,W-pd,y+2);
      y+=10;
      const tcols=[
        {h:'DATA',      w:18,x:pd,    r:false},
        {h:'CLIENTE',   w:48,x:pd+18, r:false},
        {h:'TIPO',      w:22,x:pd+66, r:false},
        {h:'PRINCIPAL', w:24,x:pd+88, r:true},
        {h:'JUROS',     w:22,x:pd+112,r:true},
        {h:'VLR PAGO',  w:24,x:pd+134,r:true},
        {h:'EXTRA',     w:20,x:pd+158,r:true},
      ];
      const drawTH=()=>{
        doc.setFillColor(...NAV);doc.rect(pd,y,CW,8,'F');
        tcols.forEach(c=>{
          doc.setFont('helvetica','bold');doc.setFontSize(6.5);doc.setTextColor(...WH);
          doc.text(c.h,c.r?c.x+c.w-2:c.x+2,y+5.5,{align:c.r?'right':'left'});
        });
        y+=8;
      };
      drawTH();
      if(total===0){
        doc.setFont('helvetica','normal');doc.setFontSize(11);doc.setTextColor(...MUT);
        doc.text('Nenhum pagamento encontrado no período selecionado.',W/2,y+20,{align:'center'});
      }
      let ri=0;
      pagsFiltrados.forEach(p=>{
        if(y+7.5>282){doc.addPage();y=16;drawTH();}
        const bg=ri%2===0?WH:LGR;
        doc.setFillColor(...bg);doc.rect(pd,y,CW,7.5,'F');
        const parc=getParcela(p);
        const tc=tCOR[p.TIPO_PAGAMENTO]||MUT;
        const vPrinc=parseFloat(parc?.VALOR_PRINCIPAL||0);
        const vJuros=Math.max(0,parseFloat(parc?.VALOR_JUROS||0)-parseFloat(parc?.DESCONTO_APLICADO||0));
        const ex=parseFloat(p.RECEITA_EXTRA_ATRASO||0);
        // DATA
        doc.setFont('helvetica','normal');doc.setFontSize(7);doc.setTextColor(...MUT);
        doc.text(p.DATA_PAGAMENTO?fmtDt(parseDate(p.DATA_PAGAMENTO)):'—',tcols[0].x+2,y+5);
        // CLIENTE
        doc.setFont('helvetica','normal');doc.setFontSize(7.5);doc.setTextColor(...DK);
        doc.text(doc.splitTextToSize(p.NOME_CLIENTE||'—',46)[0],tcols[1].x+2,y+5);
        // TIPO
        doc.setFont('helvetica','bold');doc.setFontSize(6.5);doc.setTextColor(...tc);
        doc.text(tLBL[p.TIPO_PAGAMENTO]||p.TIPO_PAGAMENTO||'—',tcols[2].x+2,y+5);
        // PRINCIPAL
        doc.setFont('helvetica','normal');doc.setFontSize(7);doc.setTextColor(...MUT);
        doc.text(vPrinc>0?fR(vPrinc):'—',tcols[3].x+tcols[3].w-2,y+5,{align:'right'});
        // JUROS
        doc.setFont('helvetica',vJuros>0?'bold':'normal');doc.setFontSize(7);doc.setTextColor(...(vJuros>0?B:MUT));
        doc.text(vJuros>0?fR(vJuros):'—',tcols[4].x+tcols[4].w-2,y+5,{align:'right'});
        // VLR PAGO
        doc.setFont('helvetica','bold');doc.setFontSize(7.5);doc.setTextColor(...B);
        doc.text(fR(p.VALOR_PAGO),tcols[5].x+tcols[5].w-2,y+5,{align:'right'});
        // EXTRA
        doc.setFont('helvetica',ex>0?'bold':'normal');doc.setFontSize(7);doc.setTextColor(...(ex>0?O:MUT));
        doc.text(ex>0?'+'+fR(ex):'—',tcols[6].x+tcols[6].w-2,y+5,{align:'right'});
        // Linha separadora
        doc.setDrawColor(...BDC);doc.setLineWidth(0.1);doc.line(pd,y+7.5,pd+CW,y+7.5);
        y+=7.5;ri++;
      });

      // ─── RODAPÉ EM TODAS AS PÁGINAS ───
      const nPg=doc.internal.getNumberOfPages();
      for(let pg=1;pg<=nPg;pg++){
        doc.setPage(pg);
        doc.setDrawColor(...BDC);doc.setLineWidth(0.3);doc.line(pd,287,W-pd,287);
        doc.setFont('helvetica','normal');doc.setFontSize(7);doc.setTextColor(...MUT);
        doc.text('Borges Assessoria · Crédito Privado',pd,291);
        doc.text(`Página ${pg} de ${nPg}`,W-pd,291,{align:'right'});
      }

      const blob=doc.output('blob');const url=URL.createObjectURL(blob);
      const a=document.createElement('a');
      const suf=finDe?dStrFin(finDe).replace(/\//g,'-'):'completo';
      a.href=url;a.download=`relatorio_financeiro_${suf}.pdf`;
      document.body.appendChild(a);a.click();document.body.removeChild(a);
      setTimeout(()=>URL.revokeObjectURL(url),3000);
    }catch(e){console.error('PDF error:',e);alert('Erro ao gerar PDF: '+e.message);}
  }

  const aguardando=useMemo(()=>(clientes||[]).filter(c=>c.STATUS_CLIENTE==="aguardando_conferencia"),[clientes]);
  const promessasAtivas=useMemo(()=>(promessas||[]).filter(p=>!["cumprida","cancelada","vencida"].includes(String(p.STATUS_PROMESSA||"").toLowerCase())).length,[promessas]);

  const abrirConferencia=(c)=>{
    setSelCliAba("editar");
    setSelCli(c);
    setTab("clientes");
  };

  const NavSection=({label})=>sidebarOpen?<div style={{fontSize:10,fontWeight:700,color:"rgba(255,255,255,0.32)",textTransform:"uppercase",letterSpacing:"0.1em",padding:"18px 14px 6px"}}>{label}</div>:<div style={{height:16}}/>;
  const Nav=({id,label,ico,badge,badgeRed})=>{
    const active=tab===id;
    return(
      <div onClick={()=>setTab(id)} title={!sidebarOpen?label:undefined}
        className="nav-link-item"
        style={{display:"flex",alignItems:"center",justifyContent:sidebarOpen?"flex-start":"center",gap:sidebarOpen?10:0,padding:sidebarOpen?"9px 12px":"9px 0",borderRadius:10,cursor:"pointer",background:active?"rgba(31,184,119,0.16)":"transparent",marginBottom:1}}
        onMouseEnter={e=>!active&&(e.currentTarget.style.background="rgba(255,255,255,0.06)")}
        onMouseLeave={e=>!active&&(e.currentTarget.style.background="transparent")}
      >
        {sidebarOpen&&active
          ? <div style={{width:8,height:8,borderRadius:"50%",background:"#46CB92",flexShrink:0,border:"2px solid #46CB92"}}/>
          : <span style={{display:"flex",flexShrink:0,color:active?"#87DFB6":"rgba(255,255,255,0.62)"}}>{ico}</span>
        }
        {sidebarOpen&&<span style={{fontSize:13,fontWeight:active?700:400,color:active?"#87DFB6":"rgba(255,255,255,0.62)",flex:1,whiteSpace:"nowrap"}}>{label}</span>}
        {sidebarOpen&&badge>0&&(
          <span style={{fontSize:10,fontWeight:800,background:badgeRed?"rgba(239,37,59,0.20)":"rgba(70,203,146,0.20)",color:badgeRed?"#ef253b":"#46CB92",padding:"1px 8px",borderRadius:99,minWidth:20,textAlign:"center",flexShrink:0}}>
            {badgeRed?badge:`${badge} novos`}
          </span>
        )}
      </div>
    );
  };

  if(loading&&!raw)return(
    <div style={{height:"100vh",display:"flex",alignItems:"center",justifyContent:"center",background:BG}}>
      <div style={{textAlign:"center"}}><div style={{width:40,height:40,border:`4px solid ${BD}`,borderTopColor:GRN,borderRadius:"50%",animation:"spin 1s linear infinite",margin:"0 auto 15px"}}/><div style={{fontSize:14,color:MUTED,fontWeight:600}}>Carregando Borges Assessoria...</div></div>
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  );

  const _globalStyles=`
    @keyframes spin{to{transform:rotate(360deg)}}
    @keyframes fadeUp{from{opacity:0;transform:scale(0.93) translateY(14px)}to{opacity:1;transform:scale(1) translateY(0)}}
    @keyframes staggerUp{from{opacity:0;transform:translateY(12px)}to{opacity:1;transform:translateY(0)}}

    button{transition:transform 200ms cubic-bezier(0.34,1.56,0.64,1),background 120ms ease,color 150ms ease,border-color 150ms ease,box-shadow 200ms ease;outline:none;font-family:inherit}
    button:active:not(:disabled){transform:scale(0.97)!important;transition-duration:60ms!important}
    select,input{transition:border-color 0.15s,box-shadow 0.15s;outline:none;font-family:inherit}
    select:focus,input:focus{border-color:${GRN}!important;box-shadow:0 0 0 3px ${GRN}18}
    tr{transition:background 100ms ease,transform 160ms cubic-bezier(0.34,1.56,0.64,1)}
    tbody tr:hover{transform:translateX(2px)}
    body,html{background:${BG};color-scheme:${darkMode?"dark":"light"};font-size:14px;overflow-x:hidden}
    select option{background:${CARD};color:${TEXT}}
    ::-webkit-scrollbar{width:5px;height:5px}
    ::-webkit-scrollbar-track{background:transparent}
    ::-webkit-scrollbar-thumb{background:${BD};border-radius:99px}
    ::-webkit-scrollbar-thumb:hover{background:${MUTED}}

    .kpi-card-item{animation:staggerUp 440ms cubic-bezier(0.16,1,0.3,1) both;transition:transform 280ms cubic-bezier(0.34,1.56,0.64,1),box-shadow 280ms ease!important;will-change:transform}
    .kpi-card-item:hover{transform:translateY(-3px);box-shadow:0 12px 28px rgba(0,0,0,0.14)!important}
    .kpi-card-item:active{transform:scale(0.98)!important;transition-duration:80ms!important}
    .dash-kpi-row>.kpi-card-item:nth-child(1){animation-delay:40ms}
    .dash-kpi-row>.kpi-card-item:nth-child(2){animation-delay:100ms}
    .dash-kpi-row>.kpi-card-item:nth-child(3){animation-delay:160ms}
    .dash-kpi-row>.kpi-card-item:nth-child(4){animation-delay:220ms}
    .dash-kpi-row>.kpi-card-item:nth-child(5){animation-delay:280ms}

    .dash-hero{animation:staggerUp 500ms cubic-bezier(0.16,1,0.3,1) 160ms both}
    .dash-chart{animation:staggerUp 500ms cubic-bezier(0.16,1,0.3,1) 240ms both}
    .dash-panel{animation:staggerUp 440ms cubic-bezier(0.16,1,0.3,1) both}
    .dash-panel:nth-child(1){animation-delay:120ms}
    .dash-panel:nth-child(2){animation-delay:200ms}
    .dash-panel:nth-child(3){animation-delay:280ms}

    .hero-action-btn{transition:transform 200ms cubic-bezier(0.34,1.56,0.64,1),background 120ms ease!important;will-change:transform}
    .hero-action-btn:hover{transform:translateY(-2px) scale(1.02);background:rgba(255,255,255,0.20)!important}
    .hero-action-btn:active{transform:scale(0.95)!important;transition-duration:60ms!important}

    .nav-link-item{transition:background 130ms ease,color 130ms ease,transform 200ms cubic-bezier(0.34,1.56,0.64,1)!important}
    .nav-link-item:hover{transform:translateX(3px)}
    .nav-link-item:active{transform:translateX(3px) scale(0.98)!important}

    .panel-list-item{transition:background 110ms ease,transform 180ms cubic-bezier(0.34,1.56,0.64,1)!important;cursor:pointer}
    .panel-list-item:hover{background:${BG}!important;transform:translateX(2px)}

    .btn-ghost-anim{transition:transform 200ms cubic-bezier(0.34,1.56,0.64,1),background 120ms ease,border-color 120ms ease,color 120ms ease!important}
    .btn-ghost-anim:hover{transform:translateY(-1px)}
    .btn-ghost-anim:active{transform:scale(0.96)!important;transition-duration:60ms!important}

    .fin-filter{animation:staggerUp 440ms cubic-bezier(0.16,1,0.3,1) 60ms both}
    .fin-lucro{animation:staggerUp 440ms cubic-bezier(0.16,1,0.3,1) 120ms both}
    .fin-kpi-row>.kpi-card-item:nth-child(1){animation-delay:180ms}
    .fin-kpi-row>.kpi-card-item:nth-child(2){animation-delay:220ms}
    .fin-kpi-row>.kpi-card-item:nth-child(3){animation-delay:260ms}
    .fin-kpi-row>.kpi-card-item:nth-child(4){animation-delay:300ms}
    .fin-kpi-row>.kpi-card-item:nth-child(5){animation-delay:340ms}
    .fin-kpi-row>.kpi-card-item:nth-child(6){animation-delay:380ms}
    .fin-chart{animation:staggerUp 500ms cubic-bezier(0.16,1,0.3,1) 320ms both}
    .fin-table{animation:staggerUp 500ms cubic-bezier(0.16,1,0.3,1) 380ms both}

    .btn-lime{transition:transform 200ms cubic-bezier(0.34,1.56,0.64,1),background 120ms ease,box-shadow 200ms ease!important;will-change:transform}
    .btn-lime:hover{transform:translateY(-2px);box-shadow:0 6px 18px rgba(168,224,64,0.35)!important}
    .btn-lime:active{transform:scale(0.95)!important;transition-duration:60ms!important}
    .btn-dark{transition:transform 200ms cubic-bezier(0.34,1.56,0.64,1),background 120ms ease,box-shadow 200ms ease!important;will-change:transform}
    .btn-dark:hover{transform:translateY(-2px);box-shadow:0 6px 18px rgba(28,58,14,0.30)!important}
    .btn-dark:active{transform:scale(0.95)!important;transition-duration:60ms!important}
  `;

  return(
    <div style={{display:"flex",height:"100vh",background:BG,color:TEXT,fontFamily:"'Inter', sans-serif",position:"relative"}}>
      <style>{_globalStyles}</style>

      {finCalOpen&&<div onClick={()=>setFinCalOpen(false)} style={{position:"fixed",inset:0,zIndex:199,background:"transparent"}}/>}
      {dashCalOpen&&<div onClick={()=>setDashCalOpen(false)} style={{position:"fixed",inset:0,zIndex:199,background:"transparent"}}/>}

      {dashCalOpen&&(
        <div style={{position:"fixed",top:dashCalPos.top,right:dashCalPos.right,zIndex:300}} onClick={e=>e.stopPropagation()}>
          <CalendarioRange de={dashDe} ate={dashAte} onSelecionar={(d,a)=>{setDashDe(d);setDashAte(a);setDashPeriodo({ini:dateInputStr(d),fim:a?dateInputStr(a):dateInputStr(d)});setDashFiltroPreset("");if(a)setDashCalOpen(false);}} onLimpar={()=>{resetPeriodoMesAtual();setDashFiltroPreset("Este mês");setDashCalOpen(false);}}/>
        </div>
      )}
      {finCalOpen&&(
        <div style={{position:"fixed",top:finCalPos.top,right:finCalPos.right,zIndex:300}} onClick={e=>e.stopPropagation()}>
          <CalendarioRange de={finDe} ate={finAte} onSelecionar={(d,a)=>{setFinDe(d);setFinAte(a);if(a)setFinCalOpen(false);}} onLimpar={()=>{setFinDe(null);setFinAte(null);setFinCalOpen(false);}}/>
        </div>
      )}

      {/* SIDEBAR — overlay escuro em mobile */}
      {mob&&sidebarOpen&&<div onClick={()=>setSidebarOpen(false)} style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.45)",zIndex:148}}/>}
      <div style={{
        width:mob?(sidebarOpen?SW:0):(sidebarOpen?SW:56),
        ...(mob?{position:"fixed",top:0,bottom:0,left:0,zIndex:149,boxShadow:sidebarOpen?"0 0 40px rgba(0,0,0,0.35)":"none"}:{boxShadow:"2px 0 20px rgba(0,0,0,0.25)"}),
        background:"#07241B",borderRight:"1px solid rgba(255,255,255,0.08)",display:"flex",flexDirection:"column",overflow:"hidden",transition:"width 0.22s cubic-bezier(0.4,0,0.2,1)",flexShrink:0
      }}>
        <div style={{padding:sidebarOpen?"18px 16px":"16px 0",display:"flex",alignItems:"center",justifyContent:sidebarOpen?"flex-start":"center",gap:12,borderBottom:"1px solid rgba(255,255,255,0.08)",minHeight:72,flexShrink:0}}>
          <svg width="34" height="34" viewBox="0 0 68 68" style={{flexShrink:0}} aria-hidden="true">
            <rect x="3" y="3" width="40" height="40" rx="9" fill="#1FB877"/>
            <rect x="25" y="25" width="40" height="40" rx="9" fill="#fff"/>
            <path d="M25 25 H43 V43 H25 Z" fill="#0E5C44"/>
          </svg>
          {sidebarOpen&&<div>
            <div style={{fontWeight:700,fontSize:14,letterSpacing:"-0.02em",color:"#FFFFFF",lineHeight:1.2}}>Borges Assessoria</div>
            <div style={{fontSize:10,fontWeight:500,color:"#87DFB6",textTransform:"uppercase",letterSpacing:"0.08em",marginTop:2}}>Crédito Privado</div>
          </div>}
        </div>
        <div style={{padding:sidebarOpen?"8px 10px":"10px 6px",flex:1,overflowY:"auto"}}>
          <NavSection label="Principal"/>
          <Nav id="dashboard"  label="Dashboard"        ico={IcoDash}/>
          <Nav id="clientes"   label="Clientes"         ico={IcoCli}   badge={aguardando.length}/>
          <Nav id="contratos"  label="Contratos"        ico={IcoCtr}/>
          <NavSection label="Operação"/>
          <Nav id="cobranca"   label="Cobrança"         ico={IcoBell}  badge={parcelasAtrasadas.length} badgeRed/>
          <Nav id="financeiro" label="Financeiro"       ico={IcoTrendUp}/>
          <Nav id="perdas"     label="Perdas & Recup."  ico={IcoLoss}/>
          <Nav id="promessas"  label="Promessas"        ico={IcoProm}  badge={promessasAtivas} badgeRed/>
          <NavSection label="Ferramentas"/>
          <Nav id="simulador"    label="Simulador"        ico={<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="4" y="4" width="16" height="16" rx="2"/><path d="M9 9h1v6H9"/><path d="M14 15h-2v-2h2"/><path d="M14 9h-2v2h2"/></svg>}/>
          <Nav id="inteligencia" label="Inteligência"    ico={IcoIntel}/>
        </div>
        <div style={{padding:sidebarOpen?"12px":"8px 4px",borderTop:"1px solid rgba(255,255,255,0.08)"}}>
          {sidebarOpen
            ? <div style={{display:"flex",flexDirection:"column",gap:8}}>
                <div style={{padding:"10px 12px",background:"rgba(255,255,255,0.06)",borderRadius:10,display:"flex",alignItems:"center",gap:10}}>
                  <div style={{width:30,height:30,background:"rgba(31,184,119,0.20)",borderRadius:"50%",display:"flex",alignItems:"center",justifyContent:"center"}}><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#1FB877" strokeWidth="2"><circle cx="12" cy="8" r="4"/><path d="M4 20c0-4 3.6-7 8-7s8 3 8 7"/></svg></div>
                  <div><div style={{fontSize:12,fontWeight:700,color:"#FFFFFF"}}>Administrador</div><div style={{fontSize:10,color:"#87DFB6"}}>Painel Gestão</div></div>
                </div>
                <button onClick={async()=>{await fetch("/api/logout",{method:"POST"});window.location.reload();}} style={{width:"100%",padding:"8px 12px",borderRadius:8,border:"1px solid rgba(255,255,255,0.12)",background:"transparent",color:"rgba(255,255,255,0.55)",cursor:"pointer",fontSize:12,fontWeight:600,display:"flex",alignItems:"center",justifyContent:"center",gap:6}}>
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>
                  Sair
                </button>
              </div>
            : <div style={{display:"flex",flexDirection:"column",alignItems:"center",gap:6,padding:"6px 0"}}>
                <div style={{width:30,height:30,background:"rgba(31,184,119,0.20)",borderRadius:"50%",display:"flex",alignItems:"center",justifyContent:"center"}}><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#1FB877" strokeWidth="2"><circle cx="12" cy="8" r="4"/><path d="M4 20c0-4 3.6-7 8-7s8 3 8 7"/></svg></div>
                <button onClick={async()=>{await fetch("/api/logout",{method:"POST"});window.location.reload();}} title="Sair" style={{background:"transparent",border:"none",color:"rgba(255,255,255,0.45)",cursor:"pointer",padding:4,display:"flex",alignItems:"center",justifyContent:"center",borderRadius:6}}>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>
                </button>
              </div>
          }
        </div>
      </div>

      {/* MAIN */}
      <div style={{flex:1,display:"flex",flexDirection:"column",overflow:"hidden"}}>
        <header style={{height:mob?56:64,background:CARD,borderBottom:`1px solid ${BD}`,display:"flex",alignItems:"center",justifyContent:"space-between",padding:mob?"0 12px":"0 24px",zIndex:10,flexShrink:0}}>
          <div style={{display:"flex",alignItems:"center",gap:mob?10:15}}>
            <button onClick={()=>setSidebarOpen(!sidebarOpen)} style={{background:BG,border:"none",padding:8,borderRadius:8,cursor:"pointer",color:MUTED,display:"flex",alignItems:"center"}}>{IcoArr}</button>
            {mob
              ? <div style={{display:"flex",alignItems:"center",gap:8}}>
                  <svg width="24" height="24" viewBox="0 0 68 68" aria-hidden="true">
                    <rect x="3" y="3" width="40" height="40" rx="9" fill="#1FB877"/>
                    <rect x="25" y="25" width="40" height="40" rx="9" fill={darkMode?"#fff":"#0B3D2E"}/>
                    <path d="M25 25 H43 V43 H25 Z" fill={darkMode?"#0E5C44":"#07241B"}/>
                  </svg>
                  <span style={{fontWeight:700,fontSize:15,letterSpacing:"-0.02em",color:TEXT}}>Borges</span>
                </div>
              : <h2 style={{fontSize:18,fontWeight:700,margin:0,textTransform:"capitalize"}}>{tab}</h2>
            }
          </div>
          <div style={{display:"flex",alignItems:"center",gap:mob?8:12}}>
            {!mob&&ultimaAt&&<span style={{fontSize:11,color:MUTED,display:"flex",alignItems:"center",gap:5}}>{loading?<><span style={{width:8,height:8,borderRadius:"50%",border:`2px solid ${GRN}`,borderTopColor:"transparent",display:"inline-block",animation:"spin 0.8s linear infinite"}}/>Atualizando...</>:<><span style={{width:7,height:7,borderRadius:"50%",background:GRN,display:"inline-block"}}/>Atualizado às {ultimaAt.toLocaleTimeString('pt-BR')}</>}</span>}
            {mob&&loading&&<span style={{width:8,height:8,borderRadius:"50%",border:`2px solid ${GRN}`,borderTopColor:"transparent",display:"inline-block",animation:"spin 0.8s linear infinite"}}/>}
            {mob&&!loading&&ultimaAt&&<span style={{width:7,height:7,borderRadius:"50%",background:GRN,display:"inline-block"}}/>}
            <button onClick={carregar} disabled={loading} title="Atualizar dados" style={{background:BG,border:`1px solid ${BD}`,padding:"6px 8px",borderRadius:8,cursor:loading?"not-allowed":"pointer",color:MUTED,display:"flex",alignItems:"center",opacity:loading?0.5:1}}><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="23 4 23 10 17 10"/><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"/></svg></button>
            <button onClick={()=>setPrivacy(p=>!p)} title={privacy?"Mostrar números":"Ocultar números"} style={{background:privacy?RED+"12":BG,border:`1px solid ${privacy?RED+"40":BD}`,padding:"6px 8px",borderRadius:8,cursor:"pointer",color:privacy?RED:MUTED,display:"flex",alignItems:"center"}}>{privacy?IcoEyeOff:IcoEye}</button>
            <button onClick={toggleDark} title={darkMode?"Modo claro":"Modo noturno"} style={{background:BG,border:`1px solid ${BD}`,padding:"6px 8px",borderRadius:8,cursor:"pointer",color:MUTED,display:"flex",alignItems:"center"}}>
              {darkMode
                ? <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="5"/><line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/><line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/></svg>
                : <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg>
              }
            </button>
            {!mob&&<div style={{color:MUTED,cursor:"pointer"}}>{IcoBell}</div>}
          </div>
        </header>

        <main style={{flex:1,overflowY:"auto",padding:mob?"14px 12px":"28px",paddingBottom:mob?96:28}}>

          {/* DASHBOARD */}
          {tab==="dashboard"&&(()=>{
            const _ini = nome => {
              const p=(nome||"").trim().split(/\s+/);
              return p.length>=2?(p[0][0]+p[p.length-1][0]).toUpperCase():(p[0]||"?")[0].toUpperCase();
            };
            const promAbertas=(promessas||[]).filter(p=>!["cumprida","cancelada"].includes(String(p.STATUS_PROMESSA||"").toLowerCase())).sort((a,b)=>toNum(parseDate(a.DATA_PREVISTA_PAGAMENTO))-toNum(parseDate(b.DATA_PREVISTA_PAGAMENTO))).slice(0,4);
            const pagRecentes=[...(pagamentos||[])].sort((a,b)=>toNum(parseDate(b.DATA_PAGAMENTO))-toNum(parseDate(a.DATA_PAGAMENTO))).slice(0,6);
            const taxaMedia=(()=>{const at=(contratos||[]).filter(c=>["ativo","ativo_em_dia","ativo_em_atraso","em_cobranca","pre_prejuizo"].includes(String(c.STATUS_CONTRATO||"").toLowerCase()));if(!at.length)return 0;return at.reduce((s,c)=>s+parseFloat(c.TAXA_JUROS_MENSAL||0),0)/at.length*100;})();
            const hj30=new Date();hj30.setHours(0,0,0,0);const em30=new Date(hj30);em30.setDate(em30.getDate()+30);
            const _stTerm=new Set(["pago","quitacao_antecipada","baixado_como_prejuizo","cancelado","renegociado","paga","quitado","quitada","baixado","baixada"]);
            const aReceber30=(parcelas||[]).filter(p=>{const v=parseDate(p.DATA_VENCIMENTO);return v&&v>=hj30&&v<=em30&&!_stTerm.has(String(p.STATUS||p.STATUS_PARCELA||"").toLowerCase());});
            const vAReceber30=aReceber30.reduce((s,p)=>s+parseFloat(p.VALOR_PARCELA||0),0);
            const clientesAtraso=new Set(parcelasAtrasadas.map(p=>p.ID_CLIENTE)).size;
            const horaAtual=new Date().getHours();
            const saudacao=horaAtual<12?"Bom dia":horaAtual<18?"Boa tarde":"Boa noite";
            const recebidoMesAnterior=(()=>{const hj=new Date();const ini=new Date(hj.getFullYear(),hj.getMonth()-1,1,0,0,0);const fim=new Date(hj.getFullYear(),hj.getMonth(),0,23,59,59);return(pagamentos||[]).filter(p=>{const d=parseDate(p.DATA_PAGAMENTO);return d&&d>=ini&&d<=fim;}).reduce((s,p)=>s+parseFloat(p.VALOR_PAGO||0),0);})();
            const deltaRecebido=dashFiltroPreset==="Este mês"&&recebidoMesAnterior>0?((M.receitaTotal-recebidoMesAnterior)/recebidoMesAnterior*100):null;
            const labelKpiRecebido=dashFiltroPreset==="30 dias"?"Recebido (30d)":dashFiltroPreset==="90 dias"?"Recebido (90d)":dashFiltroPreset==="Este mês"?"Recebido (Mês)":"Recebido (Período)";
            return(
            <div className="flex flex-col gap-6" style={{animation:"fadeUp 400ms cubic-bezier(0.16,1,0.3,1) both"}}>

              {/* AVISO CONFERÊNCIA */}
              {aguardando.length>0&&(
                <div className="flex items-center justify-between gap-4 flex-wrap rounded-xl px-4 py-3" style={{border:`1.5px solid ${YEL}50`,background:YEL+"0E"}}>
                  <div className="flex items-center gap-2.5">
                    <div className="flex items-center justify-center w-8 h-8 rounded-lg flex-shrink-0" style={{background:YEL+"20",color:YEL}}>
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><polyline points="12,6 12,12 16,14"/></svg>
                    </div>
                    <div>
                      <div className="text-sm font-extrabold" style={{color:TEXT}}>{aguardando.length} cliente{aguardando.length>1?"s":""} aguardando conferência</div>
                      <div className="text-[11px] mt-px" style={{color:MUTED}}>Cadastro via formulário — revisar e aprovar</div>
                    </div>
                  </div>
                  <div className="flex gap-2 flex-wrap">
                    {aguardando.slice(0,3).map(c=>(
                      <button key={c.ID_CLIENTE} onClick={()=>abrirConferencia(c)} className="flex items-center gap-1.5 text-xs font-bold px-3 py-1.5 rounded-lg cursor-pointer" style={{border:`1px solid ${YEL}50`,background:YEL+"15",color:TEXT}}>
                        <span className="inline-flex items-center justify-center w-5 h-5 rounded-[5px] text-white text-[10px] font-extrabold flex-shrink-0" style={{background:YEL}}>{(c.NOME||c.NOME_CLIENTE||"?")[0].toUpperCase()}</span>
                        {c.NOME||c.NOME_CLIENTE||"Sem nome"}
                      </button>
                    ))}
                    {aguardando.length>3&&<button onClick={()=>setTab("clientes")} className="text-xs font-semibold px-3 py-1.5 rounded-lg cursor-pointer" style={{border:`1px solid ${BD}`,background:CARD,color:MUTED}}>+{aguardando.length-3} mais →</button>}
                  </div>
                </div>
              )}

              {/* VISÃO GERAL HEADER */}
              <div className="flex justify-between items-start gap-4 flex-wrap">
                <div>
                  <div className="font-black leading-none" style={{fontSize:mob?20:28,color:TEXT,letterSpacing:"-0.5px"}}>{saudacao}, Alex</div>
                  <div className="flex items-center gap-2 mt-1.5 text-xs" style={{color:MUTED}}>
                    <span>{new Date().toLocaleDateString("pt-BR",{weekday:"long",day:"numeric",month:"long",year:"numeric"})}</span>
                  </div>
                </div>
                <div className="flex flex-col items-end gap-2">
                  <div className="flex gap-1.5 items-center flex-wrap justify-end">
                    {["Este mês","30 dias","90 dias"].map(p=>(
                      <button key={p} className="btn-ghost-anim" onClick={()=>handlePreset(p)} style={{padding:"5px 12px",borderRadius:7,border:`1px solid ${dashFiltroPreset===p?GRN+"40":BD}`,background:dashFiltroPreset===p?GRN+"10":"transparent",color:dashFiltroPreset===p?GRN:MUTED,fontSize:12,fontWeight:600,cursor:"pointer",fontFamily:"inherit"}}>{p}</button>
                    ))}
                    <button ref={dashCalBtnRef} className="btn-ghost-anim" onClick={()=>{if(dashCalBtnRef.current){const r=dashCalBtnRef.current.getBoundingClientRect();setDashCalPos({top:r.bottom+8,right:window.innerWidth-r.right});}setDashCalOpen(o=>!o);}} style={{padding:"5px 10px",borderRadius:7,border:`1px solid ${BD}`,background:"transparent",color:MUTED,fontSize:12,fontWeight:600,cursor:"pointer",fontFamily:"inherit",display:"flex",alignItems:"center",gap:5}}>{IcoCal} Personalizado</button>
                  </div>
                  <div className="flex gap-2 items-center flex-wrap justify-end">
                    <button className="btn-forest" onClick={()=>setDashNovoModal(true)} style={{display:"flex",alignItems:"center",gap:6,padding:"8px 14px",background:CARD,color:TEXT,border:`1.5px solid ${BD}`,borderRadius:12,fontSize:13,fontWeight:600,cursor:"pointer",fontFamily:"inherit"}}>{IcoCtr} + Novo Contrato</button>
                    <button className="btn-lime" onClick={()=>setDashRegModal(true)} style={{display:"flex",alignItems:"center",gap:6,padding:"8px 14px",background:ACC,color:"#163300",border:"none",borderRadius:12,fontSize:13,fontWeight:700,cursor:"pointer",fontFamily:"inherit"}}>✓ Registrar Pagamento</button>
                  </div>
                </div>
              </div>

              {/* 5 KPI CARDS */}
              <div className="dash-kpi-row" style={{display:"grid",gridTemplateColumns:mob?"1fr 1fr":"repeat(5,1fr)",gap:mob?10:14}}>
                {[
                  {l:"Carteira Total",     v:fmtR(M.vAtivos),           sub:`${M.contratosAtivos} contratos ativos`,   vc:TEXT, icBg:GRN+"18", ic:<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={GRN} strokeWidth="2"><rect x="2" y="7" width="20" height="14" rx="2"/><path d="M16 7V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v2"/></svg>, bd:`1px solid ${BD}`, accent:GRN},
                  {l:"A Receber (30d)",    v:fmtR(vAReceber30),          sub:`${aReceber30.length} parcelas previstas`, vc:TEXT, icBg:GRN+"14", ic:<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={GRN} strokeWidth="2"><polyline points="23,6 13.5,15.5 8.5,10.5 1,18"/><polyline points="17,6 23,6 23,12"/></svg>, bd:`1px solid ${BD}`, accent:GRN},
                  {l:labelKpiRecebido,    v:fmtR(M.receitaTotal),       sub:`${M.pagamentosPeriodo} pagamentos`,       vc:GRN, icBg:GRN+"14", ic:<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={GRN} strokeWidth="2"><circle cx="12" cy="12" r="10"/><polyline points="9,12 11,14 15,10"/></svg>, bd:`1px solid ${GRN}18`, accent:GRN, delta:deltaRecebido},
                  {l:"Em Atraso",          v:fmtR(totalParcelasAtrasadas),sub:`${parcelasAtrasadas.length} parcelas`,  vc:RED, icBg:RED+"18", ic:<span style={{color:RED}}>{IcoWarnTri}</span>, bd:`1px solid ${RED}20`, accent:RED, badge:clientesAtraso>0?`${clientesAtraso} cliente${clientesAtraso>1?"s":""}`:null},
                  {l:"Capital Disponível", v:fmtR(M.caixaAtual),          sub:"Caixa líquido",                          vc:GRN, icBg:GRN+"14", ic:<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={GRN} strokeWidth="2"><line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>, bd:`1px solid ${GRN}14`, accent:GRN},
                ].map((k)=>(
                  <div key={k.l} className="kpi-card-item" style={{background:CARD,padding:mob?"12px 12px":"18px 18px",borderRadius:16,border:k.bd||`1px solid ${BD}`,boxShadow:SHD,display:"flex",flexDirection:"column",gap:0,position:"relative",overflow:"hidden"}}>
                    <div style={{display:"flex",alignItems:"flex-start",justifyContent:"space-between",marginBottom:12}}>
                      <div style={{fontSize:10,fontWeight:600,color:MUTED,textTransform:"uppercase",letterSpacing:"0.08em",lineHeight:1.3}}>{k.l}</div>
                      <div style={{width:30,height:30,borderRadius:8,background:k.icBg,display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}}>{k.ic}</div>
                    </div>
                    <div style={{fontSize:mob?18:22,fontWeight:800,letterSpacing:"0.02em",lineHeight:1.1,color:k.vc}}>{priv(k.v)}</div>
                    <div style={{display:"flex",alignItems:"center",gap:6,marginTop:5,flexWrap:"wrap"}}>
                      <div style={{fontSize:11,color:MUTED,fontWeight:500}}>{priv(k.sub)}</div>
                      {k.delta!=null&&<div style={{fontSize:10,fontWeight:700,color:k.delta>=0?GRN:RED,background:k.delta>=0?GRN+"14":RED+"14",padding:"1px 5px",borderRadius:4}}>{k.delta>=0?"▲":"▼"} {Math.abs(k.delta).toFixed(1)}%</div>}
                      {k.badge&&<div style={{fontSize:10,fontWeight:700,color:RED,background:RED+"14",padding:"1px 5px",borderRadius:4}}>{k.badge}</div>}
                    </div>
                    {k.accent&&<div style={{position:"absolute",bottom:0,left:0,right:0,height:3,background:k.accent,borderRadius:"0 0 14px 14px"}}/>}
                  </div>
                ))}
              </div>

              {/* HERO BANNER */}
              <div className="rounded-[20px] overflow-hidden hero-banner-dash dash-hero" style={{background:"linear-gradient(145deg,#A8E03F 0%,#1FB877 22%,#0E5C44 50%,#07241B 100%)",padding:mob?"20px 18px":"28px 32px",boxShadow:"0 8px 32px rgba(0,0,0,0.25)"}}>
                <div className={`flex ${mob?"flex-col":"flex-row"} ${mob?"mb-5":"mb-6"}`} style={{gap:mob?0:0}}>
                  {[
                    {l:"Carteira Total (Capital Emprestado)",v:fmtR(M.vAtivos),sub:`${M.contratosAtivos} contratos ativos`},
                    {l:"Taxa Média de Retorno",v:`${taxaMedia.toFixed(1)}% a.m.`,sub:"Sobre contratos ativos"},
                    {l:"Taxa de Adimplência",v:M.vAtivos>0?fmtP(100-M.taxaInad):"—",sub:`${parcelasAtrasadas.length} de ${M.totalCobrancas} contratos`},
                  ].map((s,i)=>(
                    <div key={s.l} style={{flex:1,padding:mob?"0 0 16px 0":i===0?"0 32px 0 0":`0 32px`,borderBottom:mob&&i<2?"1px solid rgba(255,255,255,0.12)":"none",borderRight:!mob&&i<2?"1px solid rgba(255,255,255,0.12)":"none",marginBottom:mob&&i<2?16:0}}>
                      <div className="text-[10px] font-bold uppercase tracking-[0.1em] mb-2" style={{color:"rgba(255,255,255,0.5)"}}>{s.l}</div>
                      <div className="text-white font-black leading-none" style={{fontSize:mob?22:26,letterSpacing:"0.5px"}}>{priv(s.v)}</div>
                      <div className="text-[11px] font-medium mt-1.5" style={{color:"rgba(255,255,255,0.45)"}}>{s.sub}</div>
                    </div>
                  ))}
                </div>
              </div>

              {/* GRÁFICO + PAINEL DIREITO */}
              <div className="grid gap-5 items-start" style={{gridTemplateColumns:mob?"1fr":parcelasAtrasadas.length||promAbertas.length?"minmax(0,1fr) 340px":"1fr"}}>

                {/* GRÁFICO */}
                <div className="chart-card-dash dash-chart" style={{background:CARD,borderRadius:16,padding:mob?"16px":"22px",border:`1px solid ${BD}`,boxShadow:SHD}}>
                  <div style={{display:"flex",alignItems:"flex-start",justifyContent:"space-between",marginBottom:20}}>
                    <div>
                      <div style={{fontSize:13,fontWeight:600,color:MUTED,textTransform:"uppercase",letterSpacing:"0.06em"}}>Recebimentos Mensais</div>
                      <div style={{fontSize:mob?20:26,fontWeight:800,letterSpacing:"0.02em",marginTop:4,color:TEXT}}>{priv(fmtR(chartData[chartData.length-1]?.value||0))}</div>
                      {(()=>{const prev=chartData[chartData.length-2]?.value||0;const curr=chartData[chartData.length-1]?.value||0;const delta=prev>0?((curr-prev)/prev*100):0;return delta!==0?<div style={{fontSize:12,color:delta>0?GRN:RED,fontWeight:500,marginTop:3}}>{delta>0?"▲":"▼"} {Math.abs(delta).toFixed(1)}% em relação ao mês anterior</div>:null;})()}
                    </div>
                    <div style={{display:"flex",gap:4,flexShrink:0}}>
                      {["3M","6M","1A","Max"].map(p=>(
                        <button key={p} onClick={()=>setChartPeriodo(p)} style={{padding:"5px 10px",borderRadius:6,border:`1px solid ${chartPeriodo===p?GRN+"40":BD}`,background:chartPeriodo===p?GRN+"12":"transparent",color:chartPeriodo===p?GRN:MUTED,fontSize:11,fontWeight:600,cursor:"pointer",fontFamily:"inherit"}}>{p}</button>
                      ))}
                    </div>
                  </div>
                  <ResponsiveContainer width="100%" height={200}>
                    <BarChart data={chartData} margin={{top:0,right:0,left:-20,bottom:0}}>
                      <CartesianGrid strokeDasharray="3 3" stroke={BD} vertical={false}/>
                      <XAxis dataKey="name" tick={{fontSize:11,fill:MUTED}} axisLine={false} tickLine={false}/>
                      <YAxis tick={{fontSize:10,fill:MUTED}} axisLine={false} tickLine={false} tickFormatter={v=>v>=1000?`R$ ${(v/1000).toFixed(0)}k`:String(v)}/>
                      <Tooltip contentStyle={{background:CARD,border:`1px solid ${BD}`,borderRadius:8,fontSize:12,color:TEXT}} formatter={v=>[fmtR(v),"Receita"]}/>
                      <Bar dataKey="value" fill={GRN} radius={[4,4,0,0]}/>
                    </BarChart>
                  </ResponsiveContainer>
                </div>

                {/* PAINEL DIREITO */}
                {!mob&&(
                <div className="flex flex-col gap-4">

                  {/* EM ATRASO */}
                  {parcelasAtrasadas.length>0&&(
                  <div className="side-panel-dash dash-panel" style={{background:CARD,borderRadius:16,border:`1px solid ${BD}`,boxShadow:SHD,overflow:"hidden"}}>
                    <div style={{padding:"14px 16px",display:"flex",alignItems:"center",justifyContent:"space-between",borderBottom:`1px solid ${BD}`}}>
                      <div style={{display:"flex",alignItems:"center",gap:7,color:TEXT,fontSize:13,fontWeight:700}}>{IcoAlert} Em Atraso</div>
                      <button onClick={()=>setTab("cobranca")} style={{fontSize:12,color:GRN,background:"none",border:"none",cursor:"pointer",fontWeight:600,fontFamily:"inherit"}}>Ver cobrança →</button>
                    </div>
                    <div style={{maxHeight:280,overflowY:"auto"}}>
                      {parcelasAtrasadas.slice(0,6).map((p,i)=>(
                        <div key={p.ID_PARCELA||i} className="panel-list-item" onClick={()=>{const c=(clientes||[]).find(x=>String(x.ID_CLIENTE)===String(p.ID_CLIENTE));if(c){setSelCliAba("perfil");setSelCli(c);}}} style={{display:"flex",alignItems:"center",gap:10,padding:"10px 16px",borderBottom:i<Math.min(parcelasAtrasadas.length,6)-1?`1px solid ${BD}`:"none",cursor:"pointer"}}>
                          <div style={{width:34,height:34,borderRadius:"50%",background:GRN+"18",color:GRN,display:"flex",alignItems:"center",justifyContent:"center",fontSize:11,fontWeight:700,flexShrink:0}}>{_ini(p.NOME_CLIENTE)}</div>
                          <div style={{flex:1,minWidth:0}}>
                            <div style={{fontSize:13,fontWeight:600,color:TEXT,whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis"}}>{p.NOME_CLIENTE}</div>
                            <div style={{fontSize:11,color:MUTED,marginTop:1}}>{p.ID_CONTRATO} · {p.DIAS_ATRASO}d atraso</div>
                          </div>
                          <div style={{textAlign:"right",flexShrink:0}}>
                            <div style={{fontSize:13,fontWeight:700,color:RED}}>{fmtR(parseFloat(p.VALOR_PARCELA||0))}</div>
                            <div style={{fontSize:11,color:MUTED,marginTop:1}}>{p.NUM_PARCELA}/{p.TOTAL_PARCELAS||"?"} parc.</div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                  )}

                  {/* PROMESSAS */}
                  {promAbertas.length>0&&(
                  <div className="side-panel-dash dash-panel" style={{background:CARD,borderRadius:16,border:`1px solid ${BD}`,boxShadow:SHD,overflow:"hidden"}}>
                    <div style={{padding:"14px 16px",display:"flex",alignItems:"center",justifyContent:"space-between",borderBottom:`1px solid ${BD}`}}>
                      <div style={{display:"flex",alignItems:"center",gap:7,color:TEXT,fontSize:13,fontWeight:700}}>{IcoPromise} Promessas</div>
                      <button onClick={()=>setTab("promessas")} style={{fontSize:12,color:GRN,background:"none",border:"none",cursor:"pointer",fontWeight:600,fontFamily:"inherit"}}>Ver todas →</button>
                    </div>
                    {promAbertas.map((p,i)=>{
                      const vencida=String(p.STATUS_PROMESSA||"").toUpperCase()==="PENDENTE"&&parseDate(p.DATA_PREVISTA_PAGAMENTO)<new Date();
                      return(
                      <div key={p.ID_PROMESSA||i} className="panel-list-item" style={{display:"flex",alignItems:"center",gap:10,padding:"10px 16px",borderBottom:i<promAbertas.length-1?`1px solid ${BD}`:"none"}}>
                        <div style={{width:34,height:34,borderRadius:"50%",background:YEL+"18",color:YEL,display:"flex",alignItems:"center",justifyContent:"center",fontSize:11,fontWeight:700,flexShrink:0}}>{_ini(p.NOME_CLIENTE)}</div>
                        <div style={{flex:1,minWidth:0}}>
                          <div style={{fontSize:13,fontWeight:600,color:TEXT,whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis"}}>{p.NOME_CLIENTE}</div>
                          <div style={{fontSize:11,color:MUTED,marginTop:1}}>{p.OBSERVACAO||p.ID_CONTRATO||"—"}</div>
                        </div>
                        <div style={{textAlign:"right",flexShrink:0}}>
                          <div style={{fontSize:13,fontWeight:700,color:vencida?RED:YEL}}>{fmtR(parseFloat(p.VALOR_PROMETIDO||0))}</div>
                          <div style={{fontSize:11,color:MUTED,marginTop:1}}>Até {fmtDt(parseDate(p.DATA_PREVISTA_PAGAMENTO))}</div>
                        </div>
                      </div>
                    );})}
                  </div>
                  )}

                  {/* ATIVIDADE RECENTE */}
                  {pagRecentes.length>0&&(
                  <div className="side-panel-dash dash-panel" style={{background:CARD,borderRadius:16,border:`1px solid ${BD}`,boxShadow:SHD,overflow:"hidden"}}>
                    <div style={{padding:"14px 16px",display:"flex",alignItems:"center",justifyContent:"space-between",borderBottom:`1px solid ${BD}`}}>
                      <span style={{fontSize:13,fontWeight:700,color:TEXT}}>Atividade Recente</span>
                      <button onClick={()=>setTab("financeiro")} style={{fontSize:12,color:GRN,background:"none",border:"none",cursor:"pointer",fontWeight:600,fontFamily:"inherit"}}>Ver histórico →</button>
                    </div>
                    {pagRecentes.map((p,i)=>{
                      const parc=(parcelas||[]).find(x=>String(x.ID_PARCELA)===String(p.ID_PARCELA));
                      const nome=p.NOME_CLIENTE||(clientes||[]).find(c=>String(c.ID_CLIENTE)===String(p.ID_CLIENTE))?.NOME||"—";
                      return(
                      <div key={p.ID_PAGAMENTO||i} className="panel-list-item" style={{display:"flex",alignItems:"center",gap:8,padding:"9px 16px",borderBottom:i<pagRecentes.length-1?`1px solid ${BD}`:"none"}}>
                        <div style={{width:7,height:7,borderRadius:"50%",background:GRN,flexShrink:0}}/>
                        <div style={{flex:1,minWidth:0,fontSize:12,color:MUTED,whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis"}}>
                          <span style={{color:TEXT,fontWeight:600}}>{nome.split(" ")[0]}</span> pagou parcela {parc?.NUM_PARCELA||"?"}/{parc?.TOTAL_PARCELAS||"?"} · {fmtR(parseFloat(p.VALOR_PAGO||0))}
                        </div>
                        <div style={{fontSize:11,color:MUTED,flexShrink:0}}>{fmtDt(parseDate(p.DATA_PAGAMENTO))}</div>
                      </div>
                    );})}
                  </div>
                  )}

                </div>
                )}
              </div>
            </div>
          );})()}

          {/* CLIENTES */}
          {tab==="clientes"&&(
            <div className="flex flex-col gap-5" style={{animation:"fadeUp 400ms cubic-bezier(0.16,1,0.3,1) both"}}>
              {/* HEADER */}
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-end",gap:16,flexWrap:"wrap"}}>
                <div>
                  <div style={{fontSize:mob?18:22,fontWeight:800,color:TEXT,letterSpacing:"-0.3px"}}>Clientes</div>
                  <div style={{fontSize:11,color:MUTED,marginTop:4}}>{filtrados.length} cliente{filtrados.length!==1?"s":""} · {(clientes||[]).filter(c=>c.STATUS_CLIENTE==="ativo").length} ativos</div>
                </div>
              </div>
              <div style={{background:CARD,borderRadius:16,border:`1px solid ${BD}`,overflow:"hidden",boxShadow:SHD}}>
              <div style={{padding:mob?12:16,borderBottom:`1px solid ${BD}`,display:"flex",flexDirection:mob?"column":"row",justifyContent:"space-between",alignItems:mob?"stretch":"center",background:BG+"50",gap:10}}>
                <div style={{display:"flex",gap:8,flexWrap:"wrap"}}>
                  <input placeholder="Buscar..." value={filtroBusca} onChange={e=>setFiltroBusca(e.target.value)} style={{...IS(),flex:1,minWidth:140}}/>
                  <select value={filtroStatus} onChange={e=>setFiltroStatus(e.target.value)} style={{...IS(),flex:1,minWidth:120}}><option value="todos">Todos</option><option value="ativo">Ativos</option><option value="aguardando_conferencia">Aguardando</option></select>
                </div>
                <div style={{fontSize:13,color:MUTED,textAlign:mob?"right":"inherit"}}><strong>{filtrados.length}</strong> clientes</div>
              </div>
              <div style={{overflowX:"auto",WebkitOverflowScrolling:"touch"}}>
              <table style={{width:"100%",minWidth:mob?480:"100%",borderCollapse:"collapse",textAlign:"left"}}>
                <thead><tr style={{background:GRN+"10",fontSize:11,color:GRN,fontWeight:700,textTransform:"uppercase"}}><th style={{padding:"10px 18px"}}>Cliente</th><th>Status</th>{!mob&&<th>Telefone</th>}<th style={{padding:"10px 18px",textAlign:"right"}}>Ações</th></tr></thead>
                <tbody>{filtrados.map(c=>(
                  <tr key={c.ID_CLIENTE} className="tr-hover" onClick={()=>{setSelCliAba("perfil");setSelCli(c);}} style={{borderBottom:`1px solid ${BD}`,fontSize:13,cursor:"pointer"}} onMouseEnter={e=>e.currentTarget.style.background=BG+"80"} onMouseLeave={e=>e.currentTarget.style.background="transparent"}>
                    <td style={{padding:"13px 18px"}}><div style={{fontWeight:700,display:"flex",alignItems:"center",gap:8}}>{nomeCliente(c)}{scoreBadge(c)}</div><div style={{fontSize:11,color:MUTED}}>ID {c.ID_CLIENTE||"—"}{mob&&telCliente(c)?" · "+telCliente(c):""}</div></td>
                    <td><Badge c={c.STATUS_CLIENTE==="ativo"?GRN:YEL}>{(c.STATUS_CLIENTE||"").toUpperCase()}</Badge></td>
                    {!mob&&<td style={{color:MUTED}}>{telCliente(c)}</td>}
                    <td style={{padding:"13px 18px",textAlign:"right"}}><span style={{fontSize:12,color:GRN,fontWeight:700}}>Ver →</span></td>
                  </tr>
                ))}</tbody>
              </table>
              </div>
            </div>
            </div>
          )}

          {/* CONTRATOS */}
          {tab==="contratos"&&(
            <div className="flex flex-col gap-5" style={{animation:"fadeUp 400ms cubic-bezier(0.16,1,0.3,1) both"}}>
              {/* HEADER */}
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-end",gap:16,flexWrap:"wrap"}}>
                <div>
                  <div style={{fontSize:mob?18:22,fontWeight:800,color:TEXT,letterSpacing:"-0.3px"}}>Contratos</div>
                  <div style={{fontSize:11,color:MUTED,marginTop:4}}>{contratosFiltrados.length} contrato{contratosFiltrados.length!==1?"s":""} · {(contratos||[]).filter(c=>["ativo","ativo_em_dia","ativo_em_atraso"].includes(c.STATUS_CONTRATO)).length} ativos</div>
                </div>
              </div>
              <div style={{background:CARD,borderRadius:16,border:`1px solid ${BD}`,overflow:"hidden",boxShadow:SHD}}>
              <div style={{padding:mob?12:16,borderBottom:`1px solid ${BD}`,display:"flex",flexDirection:mob?"column":"row",justifyContent:"space-between",alignItems:mob?"stretch":"center",background:BG+"50",gap:10}}>
                <div style={{display:"flex",gap:8,flexWrap:"wrap"}}>
                  <input placeholder="Buscar..." value={filtroCtr} onChange={e=>setFiltroCtr(e.target.value)} style={{...IS(),flex:1,minWidth:140}}/>
                  <select value={filtroStatusCtr} onChange={e=>setFiltroStatusCtr(e.target.value)} style={{...IS(),flex:1,minWidth:140}}>
                    <option value="todos">Todos os status</option>
                    <option value="ativo_em_dia">Em Dia</option>
                    <option value="ativo_em_atraso">Em Atraso</option>
                    <option value="em_cobranca">Em Cobrança</option>
                    <option value="pre_prejuizo">Pré-Prejuízo</option>
                    <option value="baixado_como_prejuizo">Baixado</option>
                    <option value="em_recuperacao">Em Recuperação</option>
                    <option value="recuperado_parcialmente">Rec. Parcial</option>
                    <option value="recuperado_integralmente">Recuperado</option>
                    <option value="quitado">Quitado</option>
                    <option value="cancelado">Cancelado</option>
                    <option value="renegociado">Renegociado</option>
                  </select>
                </div>
                <div style={{fontSize:13,color:MUTED,textAlign:mob?"right":"inherit"}}><strong>{contratosFiltrados.length}</strong> contrato{contratosFiltrados.length===1?"":"s"}</div>
              </div>
              <div style={{overflowX:"auto",WebkitOverflowScrolling:"touch"}}>
              <table style={{width:"100%",minWidth:mob?480:"100%",borderCollapse:"collapse",textAlign:"left"}}>
                <thead>
                  <tr style={{background:GRN+"10",fontSize:11,color:GRN,fontWeight:700,textTransform:"uppercase"}}>
                    <th style={{padding:"10px 18px"}}>Contrato</th>
                    <th>Status</th>
                    {!mob&&<th>Empréstimo</th>}
                    <th>Principal</th>
                    {!mob&&<th>Parcelas</th>}
                    {!mob&&<th>Taxa</th>}
                    <th style={{padding:"10px 18px",textAlign:"right"}}>Ações</th>
                  </tr>
                </thead>
                <tbody>
                  {contratosFiltrados.length===0
                    ? <tr><td colSpan={mob?4:7} style={{padding:"28px 18px",textAlign:"center",color:MUTED,fontSize:13}}>Nenhum contrato encontrado.</td></tr>
                    : contratosFiltrados.map((c,i)=>(
                      <tr key={c.ID_CONTRATO||i}
                        onClick={()=>setContratoSel(c)}
                        style={{borderBottom:`1px solid ${BD}`,fontSize:13,cursor:"pointer"}}
                        onMouseEnter={e=>e.currentTarget.style.background=BG}
                        onMouseLeave={e=>e.currentTarget.style.background=i%2===0?"transparent":BG}
                      >
                        <td style={{padding:"13px 18px"}}>
                          <div style={{fontWeight:700}}>{c.ID_CONTRATO}</div>
                          <div style={{fontSize:11,color:MUTED}}>{c.NOME_CLIENTE}{mob&&<span style={{color:BLU,fontWeight:600}}> · {(parseFloat(c.TAXA_JUROS_MENSAL||0)*100).toFixed(1)}%</span>}</div>
                          {mob&&<div style={{fontSize:11,color:MUTED,marginTop:2}}>{c.NUM_PARCELAS}x {fmtR(c.VALOR_PARCELA)}</div>}
                        </td>
                        <td><Badge c={STATUS_COR[c.STATUS_CONTRATO]||MUTED}>{STATUS_LABEL[c.STATUS_CONTRATO]||c.STATUS_CONTRATO||"—"}</Badge></td>
                        {!mob&&<td style={{color:MUTED}}>{fmtDt(c.DATA_EMPRESTIMO)}</td>}
                        <td style={{fontWeight:600}}>{fmtR(c.VALOR_PRINCIPAL)}</td>
                        {!mob&&<td style={{color:MUTED}}>{c.NUM_PARCELAS}x {fmtR(c.VALOR_PARCELA)}</td>}
                        {!mob&&<td style={{color:BLU,fontWeight:600}}>{(parseFloat(c.TAXA_JUROS_MENSAL||0)*100).toFixed(1)}%</td>}
                        <td style={{padding:"13px 18px",textAlign:"right"}}>
                          <button onClick={e=>{e.stopPropagation();setContratoSel(c);}} style={{...BTN7(BLU),padding:"5px 12px",fontSize:11}}>{mob?"→":"Ver detalhes"}</button>
                        </td>
                      </tr>
                    ))
                  }
                </tbody>
              </table>
              </div>
            </div>
            </div>
          )}

          {/* COBRANÇA ── linha clicável abre CobrancaModal */}
          {tab==="cobranca"&&(
            <div className="flex flex-col gap-5" style={{animation:"fadeUp 400ms cubic-bezier(0.16,1,0.3,1) both"}}>
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-end",gap:16,flexWrap:"wrap"}}>
                <div>
                  <div style={{fontSize:mob?18:22,fontWeight:800,color:TEXT,letterSpacing:"-0.3px"}}>Cobrança</div>
                  <div style={{fontSize:11,color:MUTED,marginTop:4}}>{cobItems.length} cliente{cobItems.length!==1?"s":""} com parcelas em atraso</div>
                </div>
              </div>
            <div style={{background:CARD,borderRadius:16,border:`1px solid ${BD}`,overflow:"hidden",boxShadow:SHD}}>
              <div style={{padding:mob?12:16,borderBottom:`1px solid ${BD}`,background:RED+"05",display:"flex",alignItems:"center",justifyContent:"space-between"}}>
                <h3 style={{margin:0,fontSize:15,fontWeight:700,color:RED}}>Fila de Cobrança</h3>
                {!mob&&<span style={{fontSize:12,color:MUTED}}>Clique em uma linha para registrar pagamento</span>}
                {mob&&<Badge c={RED}>{cobItems.length}</Badge>}
              </div>
              {mob
                ? <div style={{display:"flex",flexDirection:"column"}}>
                    {cobItems.map(c=>(
                      <div key={c.ID_CLIENTE} onClick={()=>setCobModal(c)}
                        style={{padding:"14px 16px",borderBottom:`1px solid ${BD}`,cursor:"pointer",display:"flex",justifyContent:"space-between",alignItems:"center",gap:12}}>
                        <div style={{flex:1,minWidth:0}}>
                          <div style={{fontWeight:700,fontSize:14,display:"flex",alignItems:"center",gap:6,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{nomeCliente(c)}{scoreBadge(c)}</div>
                          <div style={{fontSize:11,color:MUTED,marginTop:3,display:"flex",gap:8,alignItems:"center"}}>
                            <Badge c={c.maxAtraso>60?RED:c.maxAtraso>30?ORG:YEL}>{c.maxAtraso}d</Badge>
                            <span>{c.qtdContratos} contrato{c.qtdContratos>1?"s":""}</span>
                          </div>
                        </div>
                        <div style={{textAlign:"right",flexShrink:0}}>
                          <div style={{fontSize:15,fontWeight:800,color:RED}}>{fmtR(c.vAtraso)}</div>
                          <div style={{fontSize:11,color:GRN,fontWeight:700,marginTop:3,display:"flex",alignItems:"center",gap:3}}>Cobrar {IcoArr}</div>
                        </div>
                      </div>
                    ))}
                  </div>
                : <div style={{overflowX:"auto"}}>
                    <table style={{width:"100%",borderCollapse:"collapse",textAlign:"left"}}>
                      <thead>
                        <tr style={{background:GRN+"10",fontSize:11,color:GRN,fontWeight:700,textTransform:"uppercase"}}>
                          <th style={{padding:"10px 18px"}}>Cliente</th>
                          <th>Contratos</th>
                          <th>Atraso Máx</th>
                          <th>Valor</th>
                          <th style={{padding:"10px 18px",textAlign:"right"}}>Ação</th>
                        </tr>
                      </thead>
                      <tbody>
                        {cobItems.map(c=>(
                          <tr key={c.ID_CLIENTE} onClick={()=>setCobModal(c)}
                            style={{borderBottom:`1px solid ${BD}`,fontSize:13,cursor:"pointer",transition:"background 0.1s"}}
                            onMouseEnter={e=>e.currentTarget.style.background=BG}
                            onMouseLeave={e=>e.currentTarget.style.background="transparent"}>
                            <td style={{padding:"13px 18px"}}>
                              <div style={{fontWeight:700,display:"flex",alignItems:"center",gap:8}}>{nomeCliente(c)}{scoreBadge(c)}</div>
                              <div style={{fontSize:11,color:MUTED}}>ID {c.ID_CLIENTE||"—"} · {telCliente(c)}</div>
                            </td>
                            <td style={{fontWeight:600}}>{c.qtdContratos}</td>
                            <td><Badge c={c.maxAtraso>60?RED:c.maxAtraso>30?ORG:YEL}>{c.maxAtraso} dias</Badge></td>
                            <td style={{fontWeight:700,color:RED}}>{fmtR(c.vAtraso)}</td>
                            <td style={{padding:"13px 18px",textAlign:"right"}}>
                              <button onClick={e=>{e.stopPropagation();setCobModal(c);}} style={{...BTN7(GRN),padding:"5px 12px",fontSize:11,display:"flex",alignItems:"center",gap:4}}>
                                {IcoPag} Registrar
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
              }
            </div>
            </div>
          )}

          {/* FINANCEIRO */}
          {tab==="financeiro"&&(
            <div className="flex flex-col gap-5" style={{animation:"fadeUp 400ms cubic-bezier(0.16,1,0.3,1) both"}}>
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-end",gap:16,flexWrap:"wrap"}}>
                <div>
                  <div style={{fontSize:mob?18:22,fontWeight:800,color:TEXT,letterSpacing:"-0.3px"}}>Financeiro</div>
                  <div style={{fontSize:11,color:MUTED,marginTop:4}}>{(pagamentos||[]).length} pagamentos registrados</div>
                </div>
              </div>
            <div style={{display:"flex",flexDirection:"column",gap:24}}>

              {/* FILTRO DE PERÍODO — TOPO */}
              <div className="fin-filter" style={{background:BG,borderRadius:16,border:`1px solid ${BD}`,padding:"14px 18px",display:"flex",alignItems:"center",justifyContent:"space-between",flexWrap:"wrap",gap:10}}>
                <div>
                  <div style={{fontSize:13,fontWeight:700,color:TEXT}}>Período</div>
                  <div style={{fontSize:11,color:MUTED,marginTop:2}}>{finDe?labelPeriodo:"Todos os pagamentos"}</div>
                </div>
                <div style={{display:"flex",gap:8,alignItems:"center"}}>
                  {finDe&&<button className="btn-ghost-anim" onClick={()=>{setFinDe(null);setFinAte(null);}} style={{padding:"6px 12px",borderRadius:8,border:`1px solid ${BD}`,background:CARD,color:MUTED,fontSize:12,cursor:"pointer",fontWeight:600,display:"flex",alignItems:"center",gap:5}}><svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg> Limpar</button>}
                  <button className="btn-ghost-anim" onClick={exportarPDFFinanceiro} style={{display:"flex",alignItems:"center",gap:6,padding:"7px 14px",borderRadius:9,border:`1px solid ${GRN}40`,background:GRN+"08",color:GRN,fontSize:12,fontWeight:700,cursor:"pointer"}}>
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14,2 14,8 20,8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10,9 9,9 8,9"/></svg>
                    PDF
                  </button>
                  <button ref={finCalBtnRef} className="btn-ghost-anim" onClick={()=>{if(finCalBtnRef.current){const r=finCalBtnRef.current.getBoundingClientRect();setFinCalPos({top:r.bottom+8,right:window.innerWidth-r.right});}setFinCalOpen(o=>!o);}} style={{display:"flex",alignItems:"center",gap:6,padding:"7px 14px",borderRadius:9,border:`1px solid ${finDe?ORG+"40":BD}`,background:finDe?ORG+"08":CARD,color:finDe?ORG:MUTED,fontSize:12,fontWeight:finDe?700:400,cursor:"pointer"}}>
                    {IcoCal} {finDe?labelPeriodo:"Filtrar por período"}
                  </button>
                </div>
              </div>

              <div className="fin-lucro" style={{background:`linear-gradient(135deg, ${CARD} 60%, ${GRN}09 100%)`,borderRadius:16,padding:"22px 28px",display:"flex",alignItems:"center",justifyContent:"space-between",gap:16,border:`1px solid ${GRN}30`,boxShadow:SHD,position:"relative",overflow:"hidden"}}>
                <div>
                  <p style={{color:MUTED,fontSize:10,fontWeight:700,textTransform:"uppercase",letterSpacing:"0.7px",margin:"0 0 6px"}}>Lucro do Período</p>
                  <p style={{color:GRN,fontSize:32,fontWeight:800,margin:"0 0 4px",letterSpacing:"-0.5px"}}>{priv(fmtR(finKpis.lucro))}</p>
                  <p style={{color:MUTED,fontSize:11,margin:0}}>Juros recebidos + receita extra por atraso</p>
                </div>
                <div style={{background:BG,border:`1px solid ${BD}`,borderRadius:10,padding:"10px 16px",textAlign:"right",flexShrink:0}}>
                  <div style={{color:MUTED,fontSize:10,textTransform:"uppercase",letterSpacing:"0.5px",fontWeight:600,marginBottom:4}}>Receita Total</div>
                  <div style={{fontWeight:800,color:TEXT,fontSize:18}}>{priv(fmtR(finKpis.receitaTotal))}</div>
                </div>
              </div>

              <div className="fin-kpi-row" style={{display:"flex",flexDirection:"column",gap:10}}>
                <div style={{fontSize:10,color:MUTED,fontWeight:700,textTransform:"uppercase",letterSpacing:"0.8px",paddingLeft:2}}>Valores do Período</div>
                <div style={{display:"grid",gridTemplateColumns:mob?"repeat(2,1fr)":"repeat(3,1fr)",gap:14}}>
                {[
                  {icon:<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>,label:"Receita Total",      val:fmtR(finKpis.receitaTotal),  c:GRN},
                  {icon:<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><polyline points="12,6 12,12 16,14"/></svg>,label:"Receita Extra Atraso",val:fmtR(finKpis.receitaExtra), c:ORG},
                  {icon:<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="17,1 21,5 17,9"/><path d="M3 11V9a4 4 0 0 1 4-4h14"/><polyline points="7,23 3,19 7,15"/><path d="M21 13v2a4 4 0 0 1-4 4H3"/></svg>,label:"Parcelas Prorrogadas",val:finKpis.qtyProrrogadas,     c:PUR},
                ].map(k=>(
                  <div key={k.label} className="kpi-card-item" style={{background:`linear-gradient(to bottom, ${k.c}07 0%, ${CARD} 40%)`,borderRadius:16,padding:18,border:`1px solid ${BD}`,boxShadow:SHD,position:"relative",overflow:"hidden"}}>
                    <p style={{color:MUTED,fontSize:11,margin:"0 0 8px",display:"flex",alignItems:"center",gap:6}}>{k.icon} {k.label}</p>
                    <p style={{fontSize:20,fontWeight:800,color:k.c,margin:0}}>{priv(k.val)}</p>
                    <div style={{position:"absolute",bottom:0,left:0,right:0,height:4,background:k.c,borderRadius:"0 0 14px 14px",opacity:0.7}}/>
                  </div>
                ))}
                </div>
                <div style={{fontSize:10,color:MUTED,fontWeight:700,textTransform:"uppercase",letterSpacing:"0.8px",paddingLeft:2,marginTop:6}}>Contagens</div>
                <div style={{display:"grid",gridTemplateColumns:mob?"repeat(2,1fr)":"repeat(3,1fr)",gap:14}}>
                {[
                  {icon:<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="20,6 9,17 4,12"/></svg>,label:"Pagamentos Normais",  val:finKpis.pagNormais,          c:GRN},
                  {icon:<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>,label:"Com Atraso",          val:finKpis.pagAtraso,           c:YEL},
                  {icon:<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="22,7 13.5,15.5 8.5,10.5 2,17"/><polyline points="16,7 22,7 22,13"/></svg>,label:"Somente Juros",       val:finKpis.pagJuros,            c:RED},
                ].map(k=>(
                  <div key={k.label} className="kpi-card-item" style={{background:`linear-gradient(to bottom, ${k.c}07 0%, ${CARD} 40%)`,borderRadius:16,padding:18,border:`1px solid ${BD}`,boxShadow:SHD,position:"relative",overflow:"hidden"}}>
                    <p style={{color:MUTED,fontSize:11,margin:"0 0 8px",display:"flex",alignItems:"center",gap:6}}>{k.icon} {k.label}</p>
                    <p style={{fontSize:20,fontWeight:800,color:k.c,margin:0}}>{priv(k.val)}</p>
                    <div style={{position:"absolute",bottom:0,left:0,right:0,height:4,background:k.c,borderRadius:"0 0 14px 14px",opacity:0.7}}/>
                  </div>
                ))}
                </div>
              </div>
              <div className="fin-chart" style={{background:CARD,borderRadius:16,border:`1px solid ${BD}`,boxShadow:SHD,overflow:"hidden"}}>
                <div style={{padding:"14px 20px",borderBottom:`1px solid ${BD}`,background:BG+"80"}}>
                  <h3 style={{margin:0,fontSize:14,fontWeight:700,color:TEXT}}>Receita Mensal</h3>
                  <p style={{margin:"2px 0 0",fontSize:11,color:MUTED}}>Total × Extra por Atraso</p>
                </div>
                <div style={{padding:"16px 20px"}}>
                <ResponsiveContainer width="100%" height={240}>
                  <BarChart data={mensal}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={BD}/>
                    <XAxis dataKey="m" axisLine={false} tickLine={false} tick={{fontSize:10,fill:MUTED}}/>
                    <YAxis axisLine={false} tickLine={false} tick={{fontSize:10,fill:MUTED}} tickFormatter={v=>`R$${(v/1000).toFixed(0)}k`}/>
                    <Tooltip cursor={{fill:BG}} contentStyle={{borderRadius:8,border:"none",boxShadow:"0 10px 20px rgba(0,0,0,0.1)"}} formatter={(v,n)=>[fmtR(v),n==="v"?"Receita":"Extra Atraso"]}/>
                    <Bar dataKey="v"    fill={GRN} radius={[4,4,0,0]} barSize={36}/>
                    <Bar dataKey="extra" fill={ORG} radius={[4,4,0,0]} barSize={36}/>
                  </BarChart>
                </ResponsiveContainer>
                </div>
              </div>
              <div className="fin-table" style={{background:CARD,borderRadius:16,border:`1px solid ${BD}`,overflow:"hidden",boxShadow:SHD}}>
                <div style={{padding:"14px 18px",borderBottom:`1px solid ${BD}`}}>
                  <h3 style={{margin:0,fontSize:15,fontWeight:700}}>{finDe?"Pagamentos do Período":"Últimos Pagamentos"}</h3>
                  <p style={{margin:"3px 0 0",fontSize:11,color:MUTED}}>{finDe?`${totaisFin.count} pagamento(s) — ${labelPeriodo}`:`${(pagamentos||[]).length} pagamentos no total`}</p>
                </div>
                {finDe&&(
                  <div style={{display:"grid",gridTemplateColumns:mob?"1fr":"repeat(3,1fr)",gap:0,borderBottom:`1px solid ${BD}`}}>
                    {[{l:"Total Recebido",v:fmtR(totaisFin.total),c:GRN},{l:"Receita Extra",v:fmtR(totaisFin.extra),c:ORG},{l:"Nº Pagamentos",v:totaisFin.count,c:GRN}].map((k,i)=>(
                      <div key={k.l} style={{padding:"10px 18px",background:BG,borderRight:i<2?`1px solid ${BD}`:"none"}}>
                        <div style={{fontSize:10,color:MUTED,fontWeight:600,textTransform:"uppercase",marginBottom:2}}>{k.l}</div>
                        <div style={{fontSize:16,fontWeight:800,color:k.c}}>{priv(k.v)}</div>
                      </div>
                    ))}
                  </div>
                )}
                <table style={{width:"100%",borderCollapse:"collapse",textAlign:"left"}}>
                  <thead><tr style={{background:GRN+"10",fontSize:11,color:GRN,fontWeight:700,textTransform:"uppercase"}}><th style={{padding:"10px 18px"}}>Data</th><th>Cliente</th><th>Tipo</th><th>Valor Original</th><th>Valor Pago</th><th>Diferença</th></tr></thead>
                  <tbody>
                    {pagsFiltrados.length===0
                      ?<tr><td colSpan={6}><div style={{padding:"40px 18px",textAlign:"center",display:"flex",flexDirection:"column",alignItems:"center",gap:10}}><svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke={BD} strokeWidth="1.5"><rect x="2" y="5" width="20" height="14" rx="2"/><line x1="2" y1="10" x2="22" y2="10"/></svg><div style={{fontSize:13,color:MUTED,fontWeight:600}}>Nenhum pagamento encontrado</div><div style={{fontSize:11,color:MUTED}}>Tente ajustar o período ou registre um pagamento.</div></div></td></tr>
                      :pagsFiltrados.map((p,i)=>{
                        const tCor={pagamento_normal:GRN,normal:GRN,pagamento_com_atraso:YEL,com_atraso:YEL,somente_juros:RED,recuperacao_apos_baixa:PUR}[p.TIPO_PAGAMENTO]||MUTED;
                        const tLabel={pagamento_normal:"Normal",normal:"Normal",pagamento_com_atraso:"Com Atraso",com_atraso:"Com Atraso",somente_juros:"Somente Juros",recuperacao_apos_baixa:"Recuperação",pagamento_antecipado:"Antecipado",antecipado:"Antecipado"}[p.TIPO_PAGAMENTO]||p.TIPO_PAGAMENTO||"—";
                        const extra=parseFloat(p.RECEITA_EXTRA_ATRASO||0);
                        return(
                          <tr key={i} onClick={()=>setSelPagDetalhe(p)} style={{borderBottom:`1px solid ${BD}`,fontSize:13,background:"transparent",cursor:"pointer"}}>
                            <td style={{padding:"11px 18px",color:MUTED,whiteSpace:"nowrap"}}>{fmtDt(parseDate(p.DATA_PAGAMENTO))}</td>
                            <td style={{fontWeight:600}}>{p.NOME_CLIENTE}</td>
                            <td><Badge c={tCor}>{tLabel}</Badge></td>
                            <td style={{color:MUTED}}>{fmtR(p.VALOR_ORIGINAL_PARCELA||p.VALOR_PARCELA)}</td>
                            <td style={{fontWeight:700,color:GRN}}>{fmtR(p.VALOR_PAGO)}</td>
                            <td style={{color:extra>0?ORG:MUTED,fontWeight:extra>0?700:400}}>{extra>0?`+${fmtR(extra)}`:"—"}</td>
                          </tr>
                        );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
            </div>
          )}

          {/* PERDAS */}
          {tab==="perdas"&&(
            <div className="flex flex-col gap-5" style={{animation:"fadeUp 400ms cubic-bezier(0.16,1,0.3,1) both"}}>
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-end",gap:16,flexWrap:"wrap"}}>
                <div>
                  <div style={{fontSize:mob?18:22,fontWeight:800,color:TEXT,letterSpacing:"-0.3px"}}>Perdas &amp; Recuperação</div>
                  <div style={{fontSize:11,color:MUTED,marginTop:4}}>{perdas.qtdEmRisco} contrato{perdas.qtdEmRisco!==1?"s":""} em risco · {(acordos||[]).length} acordo{(acordos||[]).length!==1?"s":""} registrado{(acordos||[]).length!==1?"s":""}</div>
                </div>
              </div>
            <div style={{display:"flex",flexDirection:"column",gap:24}}>
              <div style={{display:"grid",gridTemplateColumns:mob?"repeat(3,1fr)":"repeat(5,1fr)",gap:14}}>
                {[
                  {l:"Capital em Risco",v:fmtR(perdas.capitalEmRisco),c:ORG,sub:`${perdas.qtdEmRisco} contrato${perdas.qtdEmRisco!==1?"s":""} (cobrança + pré-prejuízo)`},
                  {l:"Capital Baixado",v:fmtR(perdas.capitalBaixado),c:RED,sub:"prejuízo declarado"},
                  {l:"Recuperado",v:fmtR(perdas.recuperadoAposBaixa),c:PUR,sub:"pós-baixa"},
                  {l:"Prejuízo Real",v:fmtR(perdas.prejuizoReal),c:RED,sub:"baixado − recuperado"},
                  {l:"Taxa Recuperação",v:fmtP(perdas.txRecuperacao),c:perdas.txRecuperacao>0?GRN:MUTED,sub:"sobre capital baixado"},
                ].map(k=>(
                  <div key={k.l} style={{background:CARD,padding:16,borderRadius:16,border:`1px solid ${BD}`,boxShadow:SHD,position:"relative",overflow:"hidden"}}>
                    <div style={{fontSize:10,color:MUTED,fontWeight:600,textTransform:"uppercase",marginBottom:4}}>{k.l}</div>
                    <div style={{fontSize:18,fontWeight:800,color:k.c}}>{k.v}</div>
                    {k.sub&&<div style={{fontSize:10,color:MUTED,marginTop:3}}>{k.sub}</div>}
                    <div style={{position:"absolute",bottom:0,left:0,right:0,height:3,background:k.c,borderRadius:"0 0 14px 14px",opacity:0.6}}/>
                  </div>
                ))}
              </div>
              <div style={{background:CARD,borderRadius:16,border:`1px solid ${BD}`,overflow:"hidden",boxShadow:SHD}}>
                <div style={{padding:16,borderBottom:`1px solid ${BD}`,display:"flex",justifyContent:"space-between",alignItems:"center",background:BG+"50"}}>
                  <h3 style={{margin:0,fontSize:15,fontWeight:700}}>Contratos com Perda</h3>
                  <select value={filtroPerdas} onChange={e=>setFiltroPerdas(e.target.value)} style={{...IS(),width:220}}><option value="todos">Todos</option><option value="em_cobranca">Em Cobrança</option><option value="pre_prejuizo">Pré-Prejuízo</option><option value="baixado_como_prejuizo">Baixado (Prejuízo)</option><option value="em_recuperacao">Em Recuperação</option><option value="recuperado_parcialmente">Recuperado Parcialmente</option><option value="encerrado_sem_recuperacao">Encerrado s/ Recuperação</option></select>
                </div>
                <div style={{overflowX:"auto",WebkitOverflowScrolling:"touch"}}><table style={{width:"100%",borderCollapse:"collapse",textAlign:"left",minWidth:520}}>
                  <thead><tr style={{background:GRN+"10",fontSize:11,color:GRN,fontWeight:700,textTransform:"uppercase"}}>
                    <th style={{padding:"10px 18px"}}>Contrato</th>
                    <th>Status</th>
                    <th>Capital</th>
                    <th>Atraso</th>
                    <th>Saldo em Aberto</th>
                    <th>Prejuízo</th>
                    <th style={{padding:"10px 18px"}}>Recuperado</th>
                  </tr></thead>
                  <tbody>{pFiltradas.map(c=>{
                    const info=perdaInfoMap[String(c.ID_CONTRATO)]||{};
                    const dias=info.diasAtraso||0;
                    const qtd=info.qtdAtrasadas||0;
                    const saldo=info.saldoAberto||0;
                    return(
                    <tr key={c.ID_CONTRATO} onClick={()=>setPerdaAcoesModal(c)} style={{borderBottom:`1px solid ${BD}`,fontSize:13,cursor:"pointer",transition:"background 0.1s"}} onMouseEnter={e=>e.currentTarget.style.background=BG} onMouseLeave={e=>e.currentTarget.style.background=""}>
                      <td style={{padding:"13px 18px"}}><div style={{fontWeight:700}}>{c.ID_CONTRATO}</div><div style={{fontSize:11,color:MUTED}}>{c.NOME_CLIENTE}</div></td>
                      <td><Badge c={STATUS_COR[c.STATUS_CONTRATO]||MUTED}>{STATUS_LABEL[c.STATUS_CONTRATO]||c.STATUS_CONTRATO}</Badge></td>
                      <td>{fmtR(c.VALOR_PRINCIPAL)}</td>
                      <td>{dias>0?<span style={{color:RED,fontWeight:700}}>{dias}d{qtd>1?<span style={{fontSize:10,color:MUTED,fontWeight:400,marginLeft:4}}>({qtd} parc.)</span>:null}</span>:<span style={{color:MUTED}}>—</span>}</td>
                      <td style={{color:saldo>0?ORG:MUTED,fontWeight:saldo>0?600:400}}>{saldo>0?fmtR(saldo):"—"}</td>
                      <td style={{color:parseFloat(c.PREJUIZO_CAPITAL||0)>0?RED:MUTED,fontWeight:600}}>{parseFloat(c.PREJUIZO_CAPITAL||0)>0?fmtR(c.PREJUIZO_CAPITAL):"—"}</td>
                      <td style={{padding:"13px 18px",color:parseFloat(c.VALOR_RECUPERADO_APOS_BAIXA||0)>0?PUR:MUTED,fontWeight:600}}>{parseFloat(c.VALOR_RECUPERADO_APOS_BAIXA||0)>0?fmtR(c.VALOR_RECUPERADO_APOS_BAIXA):"—"}</td>
                    </tr>
                    );
                  })}</tbody>
                </table></div>
              </div>
              {acordos.length>0&&(
                <div style={{background:CARD,borderRadius:16,border:`1px solid ${BD}`,overflow:"hidden",boxShadow:SHD}}>
                  <div style={{padding:"14px 18px",borderBottom:`1px solid ${BD}`,background:ORG+"08"}}>
                    <h3 style={{margin:0,fontSize:15,fontWeight:700,color:TEXT,display:"flex",alignItems:"center",gap:7}}>{IcoHandshake} Acordos Registrados ({acordos.length})</h3>
                  </div>
                  <div style={{overflowX:"auto",WebkitOverflowScrolling:"touch"}}><table style={{width:"100%",borderCollapse:"collapse",textAlign:"left",minWidth:560}}>
                    <thead><tr style={{background:GRN+"10",fontSize:11,color:GRN,fontWeight:700,textTransform:"uppercase"}}>
                      <th style={{padding:"10px 18px"}}>Acordo</th>
                      <th>Cliente</th>
                      <th>Data</th>
                      <th>Dívida Original</th>
                      <th>Valor Acordado</th>
                      <th>Desconto Capital</th>
                      <th style={{padding:"10px 18px"}}>Juros Cancelados</th>
                    </tr></thead>
                    <tbody>{[...acordos].sort((a,b)=>toNum(b.DATA)-toNum(a.DATA)).map((a,i)=>(
                      <tr key={a.ID_ACORDO||i} style={{borderBottom:`1px solid ${BD}`,fontSize:13,background:i%2===0?CARD:BG}}>
                        <td style={{padding:"12px 18px"}}><div style={{fontWeight:700}}>{a.ID_ACORDO}</div><div style={{fontSize:11,color:MUTED}}>{a.ID_CONTRATO}</div></td>
                        <td style={{fontWeight:600}}>{a.NOME_CLIENTE}</td>
                        <td style={{color:MUTED}}>{fmtDt(parseDate(a.DATA))}</td>
                        <td style={{color:MUTED}}>{fmtR(parseFloat(a.VALOR_DIVIDA_ORIGINAL||0))}</td>
                        <td style={{fontWeight:700,color:ORG}}>{fmtR(parseFloat(a.VALOR_ACORDADO||0))}</td>
                        <td style={{color:RED,fontWeight:600}}>{fmtR(parseFloat(a.DESCONTO_PRINCIPAL||0))}</td>
                        <td style={{padding:"12px 18px",color:ORG,fontWeight:600}}>{fmtR(parseFloat(a.DESCONTO_JUROS||0))}</td>
                      </tr>
                    ))}</tbody>
                  </table></div>
                </div>
              )}
            </div>
            </div>
          )}

          {/* PROMESSAS */}
          {tab==="promessas"&&(
            <div className="flex flex-col gap-5" style={{animation:"fadeUp 400ms cubic-bezier(0.16,1,0.3,1) both"}}>
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-end",gap:16,flexWrap:"wrap"}}>
                <div>
                  <div style={{fontSize:mob?18:22,fontWeight:800,color:TEXT,letterSpacing:"-0.3px"}}>Promessas</div>
                  <div style={{fontSize:11,color:MUTED,marginTop:4}}>{promessas.filter(p=>p.STATUS_PROMESSA==="PENDENTE").length} pendente{promessas.filter(p=>p.STATUS_PROMESSA==="PENDENTE").length!==1?"s":""} · {promessas.length} total</div>
                </div>
              </div>
            <div style={{display:"flex",flexDirection:"column",gap:24}}>
              <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:14}}>
                {[
                  {l:"Pendentes",v:promessas.filter(p=>p.STATUS_PROMESSA==="PENDENTE").length,c:YEL},
                  {l:"Cumpridas",v:promessas.filter(p=>p.STATUS_PROMESSA==="CUMPRIDA").length,c:GRN},
                  {l:"Quebradas",v:promessas.filter(p=>p.STATUS_PROMESSA==="QUEBRADA").length,c:RED},
                ].map(k=>(
                  <div key={k.l} style={{background:CARD,padding:18,borderRadius:16,border:`1px solid ${BD}`,boxShadow:SHD,position:"relative",overflow:"hidden"}}>
                    <div style={{fontSize:10,color:MUTED,fontWeight:600,textTransform:"uppercase",marginBottom:4}}>{k.l}</div>
                    <div style={{fontSize:26,fontWeight:900,color:k.c}}>{k.v}</div>
                    <div style={{position:"absolute",bottom:0,left:0,right:0,height:3,background:k.c,borderRadius:"0 0 14px 14px",opacity:0.6}}/>
                  </div>
                ))}
              </div>
              <div style={{background:CARD,borderRadius:16,border:`1px solid ${BD}`,overflow:"hidden",boxShadow:SHD}}>
                <div style={{padding:16,borderBottom:`1px solid ${BD}`,display:"flex",justifyContent:"space-between",alignItems:"center",flexWrap:"wrap",gap:10}}>
                  <div style={{display:"flex",gap:8,flexWrap:"wrap"}}>
                    {[{v:"todos",l:"Todos",c:GRN},{v:"PENDENTE",l:"Pendentes",c:YEL},{v:"CUMPRIDA",l:"Cumpridas",c:GRN},{v:"QUEBRADA",l:"Quebradas",c:RED}].map(f=>(
                      <button key={f.v} onClick={()=>setFiltroPromessa(f.v)} style={{padding:"6px 12px",borderRadius:9,border:`1px solid ${filtroPromessa===f.v?f.c+"40":BD}`,background:filtroPromessa===f.v?f.c+"10":CARD,color:filtroPromessa===f.v?f.c:MUTED,cursor:"pointer",fontSize:12,fontWeight:filtroPromessa===f.v?700:500}}>
                        {f.l}
                      </button>
                    ))}
                  </div>
                  <button onClick={()=>setNovaPromessa(true)} style={{padding:"8px 16px",borderRadius:12,border:"none",background:ACC,color:"#163300",cursor:"pointer",fontSize:13,fontWeight:700}}>+ Nova Promessa</button>
                </div>
                {promessasFiltradas.length===0
                  ?<div style={{padding:"32px 18px",textAlign:"center",color:MUTED,fontSize:13}}>Nenhuma promessa encontrada.</div>
                  :<div style={{overflowX:"auto",WebkitOverflowScrolling:"touch"}}><table style={{width:"100%",borderCollapse:"collapse",textAlign:"left",minWidth:560}}>
                    <thead><tr style={{background:GRN+"10",fontSize:11,color:GRN,fontWeight:700,textTransform:"uppercase"}}>
                      <th style={{padding:"10px 18px"}}>Cliente</th>
                      <th>Contrato</th>
                      <th>Data Prevista</th>
                      <th>Registrada em</th>
                      <th>Valor</th>
                      <th>Status</th>
                      <th>Observação</th>
                      <th style={{padding:"10px 18px"}}></th>
                    </tr></thead>
                    <tbody>{promessasFiltradas.map((p,i)=>{
                      const st=String(p.STATUS_PROMESSA||"PENDENTE").toUpperCase();
                      const stCor={PENDENTE:YEL,CUMPRIDA:GRN,QUEBRADA:RED}[st]||MUTED;
                      const hoje=new Date();hoje.setHours(0,0,0,0);
                      const dtPrev=parseDate(p.DATA_PREVISTA_PAGAMENTO);
                      const vencida=st==="PENDENTE"&&dtPrev&&dtPrev<hoje;
                      const pendente=st==="PENDENTE";
                      return(
                        <tr key={p.ID_PROMESSA||i} style={{borderBottom:`1px solid ${BD}`,fontSize:13,background:vencida?RED+"05":i%2===0?CARD:BG}}>
                          <td style={{padding:"12px 18px"}}><div style={{fontWeight:700}}>{p.NOME_CLIENTE}</div><div style={{fontSize:11,color:MUTED}}>ID {p.ID_CLIENTE}</div></td>
                          <td style={{color:MUTED,fontWeight:600}}>{p.ID_CONTRATO}</td>
                          <td style={{fontWeight:600,color:vencida?RED:TEXT}}>{fmtDt(dtPrev)}{vencida&&<span style={{fontSize:10,color:RED,marginLeft:6,fontWeight:700}}>VENCIDA</span>}</td>
                          <td style={{color:MUTED}}>{fmtDt(parseDate(p.DATA_PROMESSA))}</td>
                          <td style={{fontWeight:700,color:GRN}}>{fmtR(parseFloat(p.VALOR_PROMETIDO||0))}</td>
                          <td><Badge c={stCor}>{st}</Badge></td>
                          <td style={{color:MUTED,fontSize:12}}>{p.OBSERVACAO||"—"}</td>
                          <td style={{padding:"12px 18px"}}>
                            {pendente&&(
                              <div style={{display:"flex",gap:6}}>
                                <button
                                  onClick={async()=>{
                                    const res=await postAction({action:"atualizarPromessa",idPromessa:p.ID_PROMESSA,status:"CUMPRIDA",dataCumprimento:hojeStr()});
                                    if(res.ok)carregar();else alert(res.erro||"Erro");
                                  }}
                                  style={{...BTN7(GRN),padding:"4px 10px",fontSize:11,whiteSpace:"nowrap"}}
                                >Cumprida</button>
                                <button
                                  onClick={async()=>{
                                    const res=await postAction({action:"atualizarPromessa",idPromessa:p.ID_PROMESSA,status:"QUEBRADA",dataCumprimento:hojeStr()});
                                    if(res.ok)carregar();else alert(res.erro||"Erro");
                                  }}
                                  style={{...BTN7(RED),padding:"4px 10px",fontSize:11,whiteSpace:"nowrap"}}
                                >Quebrada</button>
                              </div>
                            )}
                          </td>
                        </tr>
                      );
                    })}</tbody>
                  </table></div>
                }
              </div>
            </div>
            </div>
          )}

          {/* SIMULADOR */}
          {tab==="simulador"&&(
            <SimuladorContrato simInicial={simInicial} onClear={()=>setSimInicial(null)} onAbrirContrato={(dados)=>{setNovoContratoIni(dados);setDashNovoModal(true);}} clientes={clientes||[]} contratos={contratos||[]}/>
          )}
          {tab==="inteligencia"&&(
            <InteligenciaView clientes={clientes||[]} contratos={contratos||[]} padrinhos={padrinhos||[]} empregadores={empregadores||[]}/>
          )}

        </main>
      </div>

      {/* ── MODAIS ── */}
      {novaPromessa&&<NovaPromessaModal contratos={contratos||[]} clientes={clientes||[]} onConfirmar={()=>{setNovaPromessa(false);carregar();}} onFechar={()=>setNovaPromessa(false)}/>}
      {selPagDetalhe&&<PagamentoDetalheModal pag={selPagDetalhe} parcelas={parcelas||[]} contratos={contratos||[]} clientes={clientes||[]} onFechar={()=>setSelPagDetalhe(null)} onReabrir={()=>{setSelPagDetalhe(null);carregar();}}/>}
      {selCli&&<ClienteModal cliente={selCli} contratos={contratos||[]} parcelas={parcelas||[]} clientes={clientes||[]} abaInicial={selCliAba} onFechar={()=>{setSelCli(null);setSelCliAba("perfil");}} onAtualizar={()=>{setSelCli(null);setSelCliAba("perfil");carregar();}} onNovoContrato={(c)=>{setSelCli(null);setSelCliAba("perfil");setNovoContratoIni(c);setDashNovoModal(true);}} onVerContrato={(c)=>{setSelCli(null);setSelCliAba("perfil");setContratoSel(c);}} onSimular={(dados)=>{setSelCli(null);setSelCliAba("perfil");setSimInicial(dados);setTab("simulador");}}/>}
      {pagamentoHoje&&<PagamentoParcelaModal parcela={pagamentoHoje} parcelas={parcelas||[]} contratos={contratos||[]} clientes={clientes||[]} initialModo={pagModo} onConfirmar={async()=>{setPagamentoHoje(null);setPagModo("pagamento");await carregar();}} onFechar={()=>{setPagamentoHoje(null);setPagModo("pagamento");}}/>}
      {dashRegModal&&<div className="modal-overlay-anim" style={{position:"fixed",inset:0,zIndex:500,background:"rgba(15,23,42,0.55)",backdropFilter:"blur(6px)",display:"flex",alignItems:"center",justifyContent:"center",padding:20}} onClick={()=>setDashRegModal(false)}><div className="modal-box-anim" style={{width:"100%",maxWidth:420,background:CARD,borderRadius:16,border:`1px solid ${BD}`,boxShadow:"0 24px 80px rgba(15,23,42,0.35)",minWidth:0}} onClick={e=>e.stopPropagation()}><div style={{background:GRN,padding:"16px 20px",borderRadius:"16px 16px 0 0",display:"flex",alignItems:"center",justifyContent:"space-between"}}><div style={{display:"flex",alignItems:"center",gap:10,color:"#fff"}}><div style={{background:"rgba(255,255,255,0.2)",padding:8,borderRadius:8,display:"flex"}}>{IcoPag}</div><span style={{fontWeight:800,fontSize:15}}>Registrar Pagamento</span></div><button className="modal-close-btn" onClick={()=>setDashRegModal(false)} style={{background:"rgba(255,255,255,0.15)",border:"none",color:"#fff",borderRadius:8,width:32,height:32,cursor:"pointer",fontSize:18,display:"flex",alignItems:"center",justifyContent:"center"}}>×</button></div><div style={{padding:20}}><PagamentoDrop contratos={contratos||[]} parcelas={parcelas||[]} clientes={clientes||[]} onSucesso={async()=>{setDashRegModal(false);await carregar();}} onSelecionarParcela={p=>{setDashRegModal(false);setPagamentoHoje(p);}}/></div></div></div>}
      {dashNovoModal&&<div className="modal-overlay-anim" style={{position:"fixed",inset:0,zIndex:500,background:"rgba(15,23,42,0.55)",backdropFilter:"blur(6px)",display:"flex",alignItems:"center",justifyContent:"center",padding:20}} onClick={()=>{setDashNovoModal(false);setNovoContratoIni(null);}}><div className="modal-box-anim" style={{width:"100%",maxWidth:420,background:CARD,borderRadius:16,border:`1px solid ${BD}`,boxShadow:"0 24px 80px rgba(15,23,42,0.35)",minWidth:0}} onClick={e=>e.stopPropagation()}><div style={{background:GRN,padding:"16px 20px",borderRadius:"16px 16px 0 0",display:"flex",alignItems:"center",justifyContent:"space-between"}}><div style={{display:"flex",alignItems:"center",gap:10,color:"#fff"}}><div style={{background:"rgba(255,255,255,0.2)",padding:8,borderRadius:8,display:"flex"}}>{IcoCtr}</div><span style={{fontWeight:800,fontSize:15}}>Novo Contrato</span></div><button className="modal-close-btn" onClick={()=>{setDashNovoModal(false);setNovoContratoIni(null);}} style={{background:"rgba(255,255,255,0.15)",border:"none",color:"#fff",borderRadius:8,width:32,height:32,cursor:"pointer",fontSize:18,display:"flex",alignItems:"center",justifyContent:"center"}}>×</button></div><div style={{padding:20}}><NovoContrato contratos={contratos||[]} clientes={clientes||[]} clienteInicial={novoContratoIni} onSucesso={()=>{setDashNovoModal(false);setNovoContratoIni(null);carregar(true);}}/></div></div></div>}
      {perdaAcoesModal&&<PerdaAcoesModal contrato={perdaAcoesModal} parcelas={parcelas||[]} onBaixar={()=>{setBaixaModal(perdaAcoesModal);setPerdaAcoesModal(null);}} onAcordo={()=>{setAcordoModal(perdaAcoesModal);setPerdaAcoesModal(null);}} onRecuperar={()=>{setRecuperacaoModal(perdaAcoesModal);setPerdaAcoesModal(null);}} onFechar={()=>setPerdaAcoesModal(null)}/>}
      {baixaModal&&<BaixaModal contrato={baixaModal} parcelas={parcelas||[]} onConfirmar={()=>{setBaixaModal(null);carregar();}} onFechar={()=>setBaixaModal(null)}/>}
      {acordoModal&&<ModalAcordoPerda contrato={acordoModal} parcelas={parcelas||[]} onConfirmar={()=>{setAcordoModal(null);carregar();}} onFechar={()=>setAcordoModal(null)}/>}
      {quitacaoModal&&<QuitacaoAntecipadaModal contrato={quitacaoModal} parcelas={parcelas||[]} onConfirmar={()=>{setQuitacaoModal(null);carregar();}} onFechar={()=>setQuitacaoModal(null)}/>}
      {recuperacaoModal&&<RecuperacaoModal contrato={recuperacaoModal} onConfirmar={()=>{setRecuperacaoModal(null);carregar();}} onFechar={()=>setRecuperacaoModal(null)}/>}

      {/* ── MODAL CONTRATO ── */}
      {contratoSel&&(
        <ContratoModal
          contrato={contratoSel}
          parcelas={parcelas||[]}
          pagamentos={pagamentos||[]}
          clientes={clientes||[]}
          onRegistrarPagamento={p=>{setContratoSel(null);setPagamentoHoje(p);setPagModo("pagamento");}}
          onReagendar={p=>{setContratoSel(null);setPagamentoHoje(p);setPagModo("reagendar");}}
          onBaixar={c=>{setContratoSel(null);setBaixaModal(c);}}
          onQuitacaoAntecipada={c=>{setContratoSel(null);setQuitacaoModal(c);}}
          onAlterarVencimento={()=>carregar(true)}
          onComprovante={(c,ps,cli)=>{
            const _pagas=[...ps].filter(p=>["pago","quitacao_antecipada"].includes(statusEfetivo(p))).sort((a,b)=>parseInt(b.NUM_PARCELA||0)-parseInt(a.NUM_PARCELA||0));
            const _ult=_pagas[0];
            const _cliObj=(clientes||[]).find(cl=>String(cl.ID_CLIENTE)===String(c.ID_CLIENTE));
            const _tel=normTel(_cliObj?.TELEFONE_WPP||_cliObj?.TELEFONE||"");
            if(_ult){
              const _tLbl={pagamento_normal:"Normal",normal:"Normal",pagamento_com_atraso:"Com Atraso",com_atraso:"Com Atraso",somente_juros:"Somente Juros",quitacao_antecipada:"Quitação Antecipada",pagamento_antecipado:"Antecipado",antecipado:"Antecipado"}[_ult.TIPO_PAGAMENTO]||"Pagamento";
              gerarEEnviarComprovante(_ult,parseFloat(_ult.VALOR_PAGO||0),_ult.DATA_PAGAMENTO,_tLbl,parcelas,contratos,clientes,{wpp:true});
            }else{
              gerarComprovante(c,ps,cli);
              if(_tel) setTimeout(()=>window.open(`https://wa.me/55${_tel}`,"_blank"),700);
            }
          }}
          onFechar={()=>setContratoSel(null)}
        />
      )}

      {/* ── DIALOG COMPROVANTE DE QUITAÇÃO ── */}

      {/* ── MODAL COBRANÇA (NOVO) ── */}
      {cobModal&&(
        <CobrancaModal
          cliente={cobModal}
          parcelasCliente={cobModal.parcelasAtrasadas || []}
          todasParcelas={parcelas||[]}
          contratos={contratos||[]}
          onSucesso={()=>{ carregar(); }}
          onFechar={()=>setCobModal(null)}
        />
      )}

      {/* BOTTOM NAV — apenas mobile */}
      {mob&&<BottomNav tab={tab} setTab={t=>{setTab(t);setSidebarOpen(false);}}/>}
    </div>
  );
}

createRoot(document.getElementById("root")).render(<App/>);
