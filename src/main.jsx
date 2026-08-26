import React, { useState, useMemo, useEffect, useRef } from "react";
import { createRoot } from "react-dom/client";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from "recharts";
import { jsPDF } from "jspdf";
import { Card } from "./components/ui/card";
import { Button } from "./components/ui/button";
import { Table, TableHeader, TableRow, TableHead, TableBody, TableCell } from "./components/ui/table";

const API_URL  = "/api/sheets";
const POST_URL = "/api/action";

let BG   = "#F7F5EF", CARD = "#FFFDF9", CARD2 = "#F0EDE4", BD = "#E2DDD1", LINESOFT = "#EEEAE0";
let TEXT = "#1A1712", MUTED = "#57514A", FAINT = "#7C756B";
let GRN  = "#0B3D2E", GRN2 = "#0E5C44", SIG = "#127A57", SIGVIZ = "#1FB877", OK = "#15805A";
let RED  = "#C0322F", BLU = "#166C70";
let YEL  = "#9A6510", PUR = "#221d9a", ORG = "#ff7700";
let ACC  = "#A8E03F", ACCINK = "#07241B";
let ONBRAND = "#EAF6EF", ONBRANDSOFT = "#8FE3C0";
let SHD  = "0 1px 2px rgba(40,30,15,.05),0 8px 22px rgba(40,30,15,.06)";
let SHDLG = "0 20px 52px rgba(11,61,46,.14),0 6px 16px rgba(11,61,46,.08)";
const SW = 220;
const LIGHT={BG:"#F7F5EF",CARD:"#FFFDF9",CARD2:"#F0EDE4",BD:"#E2DDD1",LINESOFT:"#EEEAE0",TEXT:"#1A1712",MUTED:"#57514A",FAINT:"#7C756B",GRN:"#0B3D2E",GRN2:"#0E5C44",SIG:"#127A57",SIGVIZ:"#1FB877",OK:"#15805A",RED:"#C0322F",BLU:"#166C70",YEL:"#9A6510",PUR:"#221d9a",ORG:"#ff7700",ACC:"#A8E03F",ACCINK:"#07241B",ONBRAND:"#EAF6EF",ONBRANDSOFT:"#8FE3C0",SHD:"0 1px 2px rgba(40,30,15,.05),0 8px 22px rgba(40,30,15,.06)",SHDLG:"0 20px 52px rgba(11,61,46,.14),0 6px 16px rgba(11,61,46,.08)"};
const DARK ={BG:"#06231A",CARD:"#0B3227",CARD2:"#123B2E",BD:"#1B4234",LINESOFT:"#153328",TEXT:"#EFF3EC",MUTED:"#AEBAB0",FAINT:"#7F8C82",GRN:"#5AD09B",GRN2:"#46CB92",SIG:"#43D69C",SIGVIZ:"#1FB877",OK:"#5AD09B",RED:"#F0716E",BLU:"#5FC2C6",YEL:"#E3A93A",PUR:"#7b74e6",ORG:"#ff7700",ACC:"#A8E03F",ACCINK:"#07241B",ONBRAND:"#06231A",ONBRANDSOFT:"#0B3D2E",SHD:"0 4px 12px rgba(0,0,0,0.20),0 2px 4px rgba(0,0,0,0.10)",SHDLG:"0 24px 60px rgba(0,0,0,0.40),0 8px 20px rgba(0,0,0,0.20)"};
function applyTheme(dark){const t=dark?DARK:LIGHT;BG=t.BG;CARD=t.CARD;CARD2=t.CARD2;BD=t.BD;LINESOFT=t.LINESOFT;TEXT=t.TEXT;MUTED=t.MUTED;FAINT=t.FAINT;GRN=t.GRN;GRN2=t.GRN2;SIG=t.SIG;SIGVIZ=t.SIGVIZ;OK=t.OK;RED=t.RED;BLU=t.BLU;YEL=t.YEL;PUR=t.PUR;ORG=t.ORG;ACC=t.ACC;ACCINK=t.ACCINK;ONBRAND=t.ONBRAND;ONBRANDSOFT=t.ONBRANDSOFT;SHD=t.SHD;SHDLG=t.SHDLG;document.documentElement.classList.toggle('dark',dark);document.documentElement.setAttribute('data-theme',dark?'dark':'light');document.body.classList.add('theme-transitioning');setTimeout(()=>document.body.classList.remove('theme-transitioning'),320);}
function isDarkHour(){const h=new Date().getHours();return h>=18||h<6;}

const fmtR  = v => "R$ " + Number(v||0).toLocaleString("pt-BR",{minimumFractionDigits:2,maximumFractionDigits:2});
const _MESES_ABREV=['jan','fev','mar','abr','mai','jun','jul','ago','set','out','nov','dez'];
const fmtMesAno = d => { const dt = d instanceof Date ? d : parseDate(d); return dt && !isNaN(dt) ? `${_MESES_ABREV[dt.getMonth()]}/${dt.getFullYear()}` : '—'; };
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
const MOEDA_TETO=1e7; // R$10.000.000 — bem acima de qualquer valor real do negócio; acima disso é colagem/concatenação errada, não dinheiro de verdade
function pasteMoeda(e,setter){
  const texto=e.clipboardData?.getData("text")||"";
  const n=parseValorColado(texto);
  if(n===null)return;
  if(Math.abs(n)>=MOEDA_TETO){
    e.preventDefault();
    alert("O valor colado ficou absurdamente alto (R$ "+n.toLocaleString("pt-BR")+") — provavelmente foi colado um texto com vários números junto (ex: contracheque inteiro), não só o valor. Copie e cole apenas o número, ou digite manualmente.");
    return;
  }
  e.preventDefault();
  setter(String(n));
}
function normMoedaSheet(v){
  if(v===null||v===undefined||v==="")return"";
  if(typeof v==="number")return Math.abs(v)<MOEDA_TETO?String(v):"";
  const n=parseValorColado(String(v));
  if(n===null||Math.abs(n)>=MOEDA_TETO)return"";
  return String(n);
}
const fmtP  = v => Number(v||0).toFixed(1) + "%";
const fmtDt = v => { if(!v) return "—"; const d = v instanceof Date ? v : new Date(v); return isNaN(d.getTime()) ? "—" : d.toLocaleDateString("pt-BR"); };
const fmtTel = v => { const s = String(v||'').replace(/\D/g,''); if(s.length===11) return `(${s.slice(0,2)}) ${s.slice(2,7)}-${s.slice(7)}`; if(s.length===10) return `(${s.slice(0,2)}) ${s.slice(2,6)}-${s.slice(6)}`; return v ? String(v) : '—'; };
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
const _ST_CONTRATO_EXCLUIDO = new Set(["baixado_como_prejuizo","cancelado","renegociado","recuperado_integralmente","recuperado_parcialmente","acordo_assistido","em_processo_judicial","encerrado_judicialmente"]);
const _ST_ATIVOS = new Set(["ativo","ativo_em_dia","ativo_em_atraso","em_cobranca","pre_prejuizo","renegociado","em_recuperacao","recuperado_parcialmente","acordo_assistido"]);
const _ST_JUDICIAL = new Set(["em_processo_judicial"]);
const _TIPOS_JURI_TIMELINE = ["AJUIZAMENTO","MOVIMENTACAO_JURIDICA","ACORDO_JUDICIAL_FIRMADO","QUITACAO_JUDICIAL","ARQUIVAMENTO_PROCESSO"];
const _JURI_EVENTO_LABEL = {AJUIZAMENTO:"Ajuizamento",MOVIMENTACAO_JURIDICA:"Movimentação Judicial",ACORDO_JUDICIAL_FIRMADO:"Acordo Judicial Firmado",QUITACAO_JUDICIAL:"Quitação Judicial",ARQUIVAMENTO_PROCESSO:"Arquivamento do Processo"};
const _PDF_CLR = {G:[11,61,46],SIG:[31,184,119],GL:[110,121,117],DK:[18,24,21],MT:[110,121,117],BDC:[221,227,224],LM:[168,224,63],LMK:[7,36,27]};
let _registrarUndoAtivo = null;
const _UNDO_TIPO_LABEL = {PAGAMENTO_NORMAL:"Pagamento",SOMENTE_JUROS:"Somente Juros",QUITACAO_ANTECIPADA:"Quitação Antecipada",ACORDO_COM_PERDA:"Acordo com Perda",RECUPERACAO_APOS_BAIXA:"Recuperação pós-baixa",ABATIMENTO_ASSISTIDO:"Abatimento Assistido",BAIXA_PREJUIZO:"Baixa como Prejuízo",RECUPERACAO_JUDICIAL:"Recuperação Judicial"};
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

// ─── Prioridade de Cobrança (Fase 1 — 100% client-side, nunca persistido) ───
// Nível de Estratégia é sempre derivado de STATUS_CONTRATO + dias de atraso —
// nunca um campo gravado à parte (evita repetir bug de status "esquecido"/"revertido" pelo trigger diário).
function calcPrioridadeCobranca({ contrato, parcelasContrato, eventos, cliente }) {
  const hoje = new Date(); hoje.setHours(0, 0, 0, 0);
  const ps = parcelasContrato || [];
  const pendentes = ps.filter(p => !_ST_TERMINAL.has(String(p.STATUS || p.STATUS_PAGAMENTO || "").toLowerCase()));
  let diasAtraso = 0;
  pendentes.forEach(p => {
    if (statusEfetivo(p) !== "atrasado") return;
    const dv = parseDate(p.DATA_VENCIMENTO);
    if (dv) { dv.setHours(0, 0, 0, 0); diasAtraso = Math.max(diasAtraso, Math.round((hoje - dv) / 86400000)); }
  });
  const proxima = pendentes.slice().sort((a, b) => toNum(a.DATA_VENCIMENTO) - toNum(b.DATA_VENCIMENTO))[0];
  const proxVencCob = proxima ? parseDate(proxima.DATA_VENCIMENTO) : null;
  if (proxVencCob) proxVencCob.setHours(0, 0, 0, 0);
  const diasAteVenc = proxVencCob ? Math.round((proxVencCob.getTime() - hoje.getTime()) / 86400000) : null;

  const jaRenegociado = ps.some(p => String(p.ORIGEM_PARCELA || "").toLowerCase() === "renegociada");
  const jaTeveAcordoAssistido = (eventos || []).some(e =>
    String(e.ID_CONTRATO || "").trim() === String(contrato.ID_CONTRATO).trim() &&
    String(e.TIPO_EVENTO || "") === "ACORDO_ASSISTIDO_ENTRADA");

  const st = String(contrato.STATUS_CONTRATO || "").toLowerCase();

  // ── Nível de Estratégia (subdivisão fina dos limites que STATUS_CONTRATO já usa) ──
  let nivel = 0, nivelLabel = "Em Dia";
  if (st === "em_processo_judicial" || st === "encerrado_judicialmente") { nivel = 7; nivelLabel = "Jurídico"; }
  else if (st === "acordo_assistido") { nivel = -1; nivelLabel = "Acordo Assistido"; }
  else if (st === "pre_prejuizo") { nivel = 6; nivelLabel = "Pré-Jurídico"; }
  else if (st === "em_cobranca") { nivel = 5; nivelLabel = "Recuperação"; }
  else if (st === "ativo_em_atraso") {
    if (diasAtraso <= 7) { nivel = 2; nivelLabel = "Atenção"; }
    else if (diasAtraso <= 15) { nivel = 3; nivelLabel = "Cobrança Ativa"; }
    else { nivel = 4; nivelLabel = "Cobrança Intensiva"; }
  } else if (st === "ativo_em_dia" || st === "ativo") {
    if (diasAteVenc != null && diasAteVenc <= 5) { nivel = 1; nivelLabel = "Preventivo"; }
    else { nivel = 0; nivelLabel = "Em Dia"; }
  } else { nivelLabel = STATUS_LABEL[st] || "—"; }

  // ── Score de Prioridade (0-100) — blocos com teto, espelha calcularScore (crédito) ──
  const valorAberto = pendentes.filter(p => statusEfetivo(p) === "atrasado").reduce((s, p) => s + parseFloat(p.VALOR_PARCELA || 0), 0);
  const valorContrato = parseFloat(contrato.VALOR_PRINCIPAL || 0);
  const promessasQuebradas = cliente ? parseInt(cliente.PROMESSAS_QUEBRADAS || 0) : 0;

  const urgencia = diasAtraso <= 0 ? 0 : diasAtraso <= 7 ? 5 : diasAtraso <= 15 ? 10 : diasAtraso <= 30 ? 15 : diasAtraso <= 60 ? 18 : 20;
  const faixaAberto = valorAberto >= 5000 ? 14 : valorAberto >= 2000 ? 10 : valorAberto >= 800 ? 6 : valorAberto > 0 ? 3 : 0;
  const faixaContrato = valorContrato >= 10000 ? 6 : valorContrato >= 4000 ? 4 : valorContrato > 0 ? 2 : 0;
  const valorRisco = Math.min(20, faixaAberto + faixaContrato);
  const reincidencia = Math.min(30, (jaRenegociado ? 15 : 0) + (jaTeveAcordoAssistido ? 15 : 0) + Math.min(10, promessasQuebradas * 3));
  const taxaAdimplencia = cliente ? parseFloat(cliente.TAXA_ADIMPLENCIA_REAL ?? cliente.TAXA_ADIMPLENCIA ?? 100) : 100;
  const atrasoMedio = cliente ? parseFloat(cliente.ATRASO_MEDIO || 0) : 0;
  const historico = Math.min(15, Math.round((100 - taxaAdimplencia) / 100 * 10) + (atrasoMedio > 15 ? 5 : atrasoMedio > 5 ? 2 : 0));
  const perfil = String(cliente?.PERFIL_COBRANCA || "").toUpperCase();
  const perfilPts = perfil === "EVASIVO" ? 10 : perfil === "RESISTENTE" ? 7 : perfil === "NEUTRO" ? 3 : 0;
  const scoreCredito = cliente ? parseFloat(cliente.SCORE || 0) : 0;
  const perfilTotal = Math.min(10, perfilPts + (scoreCredito > 0 && scoreCredito < 45 ? 3 : 0));
  const riscoPerda = st === "pre_prejuizo" ? 5 : st === "em_cobranca" ? 3 : 0;

  let score = urgencia + valorRisco + reincidencia + historico + perfilTotal + riscoPerda;
  const motivos = [];
  if (urgencia > 0) motivos.push(`+${urgencia} atraso ${diasAtraso}d`);
  if (valorRisco > 0) motivos.push(`+${valorRisco} valor em risco`);
  if (jaRenegociado) motivos.push("+15 já renegociado");
  if (jaTeveAcordoAssistido) motivos.push("+15 já teve Acordo Assistido");
  if (promessasQuebradas > 0) motivos.push(`+${Math.min(10, promessasQuebradas * 3)} ${promessasQuebradas} promessa(s) quebrada(s)`);
  if (historico > 0) motivos.push(`+${historico} histórico`);
  if (perfilTotal > 0) motivos.push(`+${perfilTotal} perfil`);
  if (riscoPerda > 0) motivos.push(`+${riscoPerda} risco de perda`);

  let pisoAplicado = false;
  if ((jaRenegociado || jaTeveAcordoAssistido) && diasAtraso > 0 && score < 81) {
    score = 81; pisoAplicado = true;
    motivos.push("piso aplicado: mínimo Forte (reincidência)");
  }
  score = Math.max(0, Math.min(100, Math.round(score)));

  let banda = "Monitorar", corBanda = MUTED;
  if (score >= 92) { banda = "Crítica"; corBanda = RED; }
  else if (score >= 81) { banda = "Forte"; corBanda = ORG; }
  else if (score >= 65) { banda = "Normal"; corBanda = YEL; }
  else if (score >= 40) { banda = "Acompanhamento"; corBanda = BLU; }

  // ── Próxima Ação Sugerida (texto derivado, sem estado, sem persistência) ──
  let acao = "Sem ação necessária";
  if (nivel === 1) acao = "Lembrete preventivo — vencimento próximo";
  else if (diasAtraso > 0) {
    if ((jaRenegociado || jaTeveAcordoAssistido) && st === "ativo_em_atraso") acao = "Reincidente em atraso — considerar ajuizamento";
    else if (nivel >= 6) acao = "Decidir: recuperar, ajuizar ou baixar";
    else if (nivel === 5) acao = "Avaliar renegociação ou acordo";
    else if (nivel === 4) acao = "Contato direto — PIX/WhatsApp";
    else if (nivel === 3) acao = "Cobrança ativa — contato direto";
    else if (nivel === 2) acao = "Cobrança cordial";
  }

  return { score, banda, corBanda, motivo: motivos.join(" | ") || "Sem fatores de risco", nivel, nivelLabel, acao, diasAtraso, pisoAplicado, jaRenegociado, jaTeveAcordoAssistido };
}
function prioridadeBadge(prio, size = "sm") {
  if (!prio) return null;
  const p = size === "md" ? "4px 12px" : "3px 10px", fs = size === "md" ? 11 : 10;
  return <span style={{ display: "inline-flex", alignItems: "center", gap: 4, padding: p, borderRadius: 9999, fontSize: fs, fontWeight: 800, background: prio.corBanda + "18", color: prio.corBanda, border: `1px solid ${prio.corBanda}35`, lineHeight: 1.3, whiteSpace: "nowrap" }} title={prio.motivo}>
    {prio.score} · {prio.banda}
  </span>;
}

function apiDateStr(v){
  const dt = parseDate(v);
  if(!dt) return v || "";
  const y = dt.getFullYear();
  const m = String(dt.getMonth()+1).padStart(2,"0");
  const day = String(dt.getDate()).padStart(2,"0");
  return `${y}-${m}-${day}T12:00:00`;
}
function toNum(d){ if(!d)return 0; const dt=d instanceof Date?d:parseDate(d); if(!dt)return 0; return dt.getFullYear()*10000+(dt.getMonth()+1)*100+dt.getDate(); }
let _progSetFn=null,_progTimer=null;
function _startProg(){if(_progTimer)clearInterval(_progTimer);let p=5;if(_progSetFn)_progSetFn(p);_progTimer=setInterval(()=>{p=Math.min(88,p+(88-p)*0.045+0.4);if(_progSetFn)_progSetFn(p);},130);}
function _doneProg(){if(_progTimer){clearInterval(_progTimer);_progTimer=null;}if(_progSetFn){_progSetFn(100);setTimeout(()=>{if(_progSetFn)_progSetFn(-1);},450);}}
async function postAction(body){_startProg();try{const r=await fetch(POST_URL,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(body)});const d=await r.json();_doneProg();return d;}catch(e){_doneProg();throw e;}}

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

const IS = ()=>({width:"100%",padding:"10px 13px",background:CARD,border:`1px solid ${BD}`,borderRadius:10,color:TEXT,fontSize:14,boxSizing:"border-box",outline:"none",transition:"border-color 0.15s, box-shadow 0.15s"});
const LS = ()=>({color:MUTED,fontSize:11,fontWeight:700,textTransform:"uppercase",letterSpacing:"0.07em",display:"block",marginBottom:5});

// ── Botões padrão (Design System) ────────────────────────────────
const BTN1 = (dis)=>({padding:"13px 18px",borderRadius:9999,border:"none",background:dis?MUTED:ACC,color:"#07241B",fontWeight:800,fontSize:14,cursor:dis?"not-allowed":"pointer",display:"flex",alignItems:"center",justifyContent:"center",gap:7,opacity:dis?0.55:1,transition:"opacity 0.15s,transform 0.1s"});
const BTN2 = (dis)=>({padding:"12px 18px",borderRadius:9999,border:"none",background:"#25D366",color:"#FFF",fontWeight:700,fontSize:14,cursor:dis?"not-allowed":"pointer",display:"flex",alignItems:"center",justifyContent:"center",gap:7,opacity:dis?0.5:1});
const BTN3 = ()=>({padding:"12px 16px",borderRadius:9999,border:`1.5px solid ${BD}`,background:CARD,color:TEXT,fontWeight:600,fontSize:14,cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",gap:7});
const BTN4 = (dis)=>({padding:"12px 18px",borderRadius:8,border:"none",background:RED,color:"#FFF",fontWeight:700,fontSize:14,cursor:dis?"not-allowed":"pointer",opacity:dis?0.5:1,display:"flex",alignItems:"center",justifyContent:"center",gap:7});
const BTN5 = (c)=>({padding:"12px 18px",borderRadius:8,border:`1px solid ${c}40`,background:`${c}08`,color:c,fontWeight:700,fontSize:14,cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",gap:8});
const BTN6 = ()=>({padding:"10px 16px",borderRadius:8,border:`1px solid ${BD}`,background:CARD,color:MUTED,fontWeight:600,fontSize:13,cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",gap:6});
const BTN7 = (c)=>({padding:"3px 8px",borderRadius:6,border:"none",background:`${c}18`,color:c,fontWeight:700,fontSize:10,cursor:"pointer"});

const STATUS_LABEL = {
  ativo_em_dia:"Em Dia", ativo_em_atraso:"Em Atraso", em_cobranca:"Em Cobrança",
  pre_prejuizo:"Pré-Prejuízo", baixado_como_prejuizo:"Baixado (Prejuízo)",
  em_recuperacao:"Em Recuperação", recuperado_parcialmente:"Rec. Parcial",
  recuperado_integralmente:"Recuperado", encerrado_sem_recuperacao:"Encerrado s/ Rec.",
  renegociado:"Renegociado", quitado:"Quitado", cancelado:"Cancelado", ativo:"Ativo",
  acordo_assistido:"Acordo Assistido", em_processo_judicial:"Em Processo Judicial",
  encerrado_judicialmente:"Encerrado Judicialmente"
};
const STATUS_COR = {
  ativo_em_dia:GRN, ativo:GRN, ativo_em_atraso:YEL, em_cobranca:ORG,
  pre_prejuizo:RED, baixado_como_prejuizo:RED, em_recuperacao:PUR,
  recuperado_parcialmente:BLU, recuperado_integralmente:GRN,
  encerrado_sem_recuperacao:MUTED, renegociado:BLU, quitado:GRN, cancelado:MUTED,
  acordo_assistido:BLU, em_processo_judicial:RED, encerrado_judicialmente:MUTED
};
const SITUACAO_FIN_JUDICIAL_LABEL = {
  EM_ABERTO:"Em Aberto", ACORDO_PARCELADO_ATIVO:"Acordo Parcelado Ativo", ACORDO_QUEBRADO:"Acordo Quebrado",
  QUITADO_JUDICIALMENTE:"Quitado Judicialmente", RECUPERADO_PARCIAL:"Recuperado Parcial",
  PERDA_JUDICIAL_DEFINITIVA:"Perda Judicial Definitiva"
};
const SITUACAO_FIN_JUDICIAL_COR = {
  EM_ABERTO:MUTED, ACORDO_PARCELADO_ATIVO:BLU, ACORDO_QUEBRADO:ORG,
  QUITADO_JUDICIALMENTE:GRN, RECUPERADO_PARCIAL:BLU, PERDA_JUDICIAL_DEFINITIVA:RED
};
const STATUS_PERDA = ["em_cobranca","pre_prejuizo","baixado_como_prejuizo","em_recuperacao","recuperado_parcialmente","encerrado_sem_recuperacao","acordo_assistido","em_processo_judicial","encerrado_judicialmente"];
const PERFIL_COR   = {COOPERATIVO:GRN, NEUTRO:MUTED, RESISTENTE:ORG, EVASIVO:RED};
const PERFIL_LABEL = {COOPERATIVO:"Cooperativo", NEUTRO:"Neutro", RESISTENTE:"Resistente", EVASIVO:"Evasivo"};

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
const IcoJur  = <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 22V12"/><path d="M2 12h20"/><path d="m7 12-3-6"/><path d="m17 12 3-6"/><path d="M5 12H2a1 1 0 0 0-1 1v2a1 1 0 0 0 1 1h3"/><path d="M19 12h3a1 1 0 0 1 1 1v2a1 1 0 0 1-1 1h-3"/><line x1="12" y1="2" x2="12" y2="5"/><circle cx="12" cy="2" r="1.5" fill="currentColor" stroke="none"/></svg>;
const IcoPag  = <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="2" y="5" width="20" height="14" rx="2"/><line x1="2" y1="10" x2="22" y2="10"/></svg>;
const IcoKpi  = <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/></svg>;
const IcoCal  = <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>;
const IcoEye    = <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>;
const IcoEyeOff = <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/><line x1="1" y1="1" x2="23" y2="23"/></svg>;
const IcoReceipt = <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14,2 14,8 20,8"/><line x1="8" y1="13" x2="16" y2="13"/><line x1="8" y1="17" x2="12" y2="17"/></svg>;
const IcoZap     = <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polygon points="13,2 3,14 12,14 11,22 21,10 12,10 13,2"/></svg>;
const IcoAlert   = <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>;
const IcoCart    = <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="2" y="7" width="20" height="14" rx="2"/><path d="M16 7V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v2"/><line x1="12" y1="12" x2="12" y2="16"/><line x1="10" y1="14" x2="14" y2="14"/></svg>;
const IcoTrash   = <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="3,6 5,6 21,6"/><path d="M19,6l-1,14a2,2,0,0,1-2,2H8a2,2,0,0,1-2-2L5,6"/><path d="M10,11v6"/><path d="M14,11v6"/><path d="M9,6V4a1,1,0,0,1,1-1h4a1,1,0,0,1,1,1v2"/></svg>;
const IcoPhone   = <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07A19.5 19.5 0 0 1 4.19 12 19.79 19.79 0 0 1 1.12 3.38 2 2 0 0 1 3.1 1.18h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L7.91 8.27a16 16 0 0 0 6.16 6.16l1.17-1.34a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 14.92z"/></svg>;
const IcoSign    = <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>;
const IcoDoc     = <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14,2 14,8 20,8"/></svg>;
const IcoPromise = <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/><polyline points="9,16 11,18 15,14"/></svg>;
const IcoSpinner = ({size=13,color="currentColor"})=><span style={{display:"inline-block",width:size,height:size,borderRadius:"50%",border:`2px solid ${color}40`,borderTopColor:color,animation:"spin 0.7s linear infinite",flexShrink:0}}/>;
function ProgressBar({pct}){if(pct<0)return null;return<div style={{position:"fixed",top:0,left:0,right:0,zIndex:9999,height:3,pointerEvents:"none"}}><div style={{height:"100%",width:`${Math.min(pct,100)}%`,background:ACC,transition:"width 0.13s ease-out, opacity 0.35s ease",opacity:pct>=100?0:1,borderRadius:"0 2px 2px 0"}}/></div>;}
const IcoTrendUp = <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="23,6 13.5,15.5 8.5,10.5 1,18"/><polyline points="17,6 23,6 23,12"/></svg>;
const IcoRepeat  = <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="17,1 21,5 17,9"/><path d="M3 11V9a4 4 0 0 1 4-4h14"/><polyline points="7,23 3,19 7,15"/><path d="M21 13v2a4 4 0 0 1-4 4H3"/></svg>;
const IcoWarnTri = <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>;
const IcoWpp     = <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 0 1-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 0 1-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 0 1 2.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0 0 12.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 0 0 5.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 0 0-3.48-8.413z"/></svg>;
const IcoLock    = <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>;
const IcoCheck   = <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="20,6 9,17 4,12"/></svg>;
const IcoHandshake = <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M20.42 4.58a5.4 5.4 0 0 0-7.65 0l-.77.78-.77-.78a5.4 5.4 0 0 0-7.65 0C1.46 6.7 1.33 10.28 4 13l8 8 8-8c2.67-2.72 2.54-6.3.42-8.42z"/></svg>;

function LinhaConfianca({w=420,h=60,n=7,sw=2,amp=0.22,color,style}){
  const {d,nodes} = useMemo(()=>{
    const midY=h/2, pts=[];
    for(let i=0;i<n;i++) pts.push([16+i*((w-32)/(n-1)), midY+Math.sin(i*1.1)*(h*amp)]);
    let d=`M ${pts[0][0]} ${pts[0][1]}`;
    for(let j=1;j<n;j++){const px=pts[j-1],cx=pts[j],mx=(px[0]+cx[0])/2;d+=` C ${mx} ${px[1]} ${mx} ${cx[1]} ${cx[0]} ${cx[1]}`;}
    const nodes=pts.map((p,i)=>({cx:p[0],cy:p[1],r:i===Math.floor(n/2)?5:3.4}));
    return {d,nodes};
  },[w,h,n,amp]);
  return (
    <svg viewBox={`0 0 ${w} ${h}`} width={w} height={h} style={{color,display:"block",...style}}>
      <path d={d} fill="none" stroke="currentColor" strokeWidth={sw} strokeLinecap="round"/>
      {nodes.map((p,i)=><circle key={i} cx={p.cx} cy={p.cy} r={p.r} fill="currentColor"/>)}
    </svg>
  );
}
function Badge({c,children,size="sm"}){ const p=size==="md"?"4px 12px":"3px 10px",fs=size==="md"?11:10; return <span style={{display:"inline-flex",alignItems:"center",gap:4,padding:p,borderRadius:9999,fontSize:fs,fontWeight:700,background:c+"18",color:c,border:`1px solid ${c}28`,lineHeight:1.3,whiteSpace:"nowrap"}}>{children}</span>; }
function KpiCard({label,value,sub,color=TEXT,icon,iconBg,tip,delta,badge,onClick,active}){
  const mob=useIsMobile();
  return (
    <div
      onClick={onClick}
      style={{
        background:CARD, padding:16, borderRadius:16,
        border:`1px solid ${active?color:BD}`,
        boxShadow:SHD, position:"relative", overflow:"hidden",
        cursor:onClick?"pointer":"default",
        transition:"transform 180ms cubic-bezier(0.34,1.56,0.64,1),box-shadow 180ms ease"
      }}
      onMouseEnter={onClick?e=>{e.currentTarget.style.transform="translateY(-2px)";e.currentTarget.style.boxShadow="0 8px 24px rgba(0,0,0,0.13)";}:undefined}
      onMouseLeave={onClick?e=>{e.currentTarget.style.transform="";e.currentTarget.style.boxShadow=SHD;}:undefined}
    >
      <div style={{display:"flex",alignItems:"flex-start",justifyContent:"space-between",marginBottom:icon?12:4}}>
        <div style={{fontSize:10,fontWeight:600,color:MUTED,textTransform:"uppercase",letterSpacing:"0.08em",lineHeight:1.3,display:"flex",alignItems:"center",flex:1,minWidth:0}}>
          {label}{tip&&<InfoTooltip text={tip}/>}
        </div>
        {icon&&<div style={{width:30,height:30,borderRadius:8,background:iconBg||color+"18",display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0,marginLeft:6}}>{icon}</div>}
      </div>
      <div style={{fontSize:mob?17:22,fontWeight:800,color:color}}>{value}</div>
      {(sub||delta!=null||badge)&&
        <div style={{display:"flex",alignItems:"center",gap:6,marginTop:5,flexWrap:"wrap"}}>
          {sub&&<div style={{fontSize:11,color:MUTED,fontWeight:500}}>{sub}</div>}
          {delta!=null&&<div style={{fontSize:10,fontWeight:700,color:delta>=0?GRN:RED,background:delta>=0?GRN+"14":RED+"14",padding:"1px 5px",borderRadius:4}}>{delta>=0?"▲":"▼"} {Math.abs(delta).toFixed(1)}%</div>}
          {badge&&<div style={{fontSize:10,fontWeight:700,color:RED,background:RED+"14",padding:"1px 5px",borderRadius:4}}>{badge}</div>}
        </div>
      }
      <div style={{position:"absolute",bottom:0,left:0,right:0,height:3,background:color,borderRadius:"0 0 14px 14px",opacity:onClick?0.6:1}}/>
    </div>
  );
}
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
  y+=20;
  // Document type label — y+=20 keeps 2mm clear of logo bottom edge
  doc.setFont('helvetica','bold');doc.setFontSize(7.5);doc.setTextColor(...GL);
  doc.text(titulo,pd,y);
  y+=4;
  // Two-tone rule: GRN 17mm + BDC rest (DS §16)
  doc.setDrawColor(...G);doc.setLineWidth(0.5);doc.line(pd,y,pd+17,y);
  doc.setDrawColor(...BDC);doc.setLineWidth(0.5);doc.line(pd+17,y,W-pd,y);
  return y+7;
}

function _renderHistParcelas(doc,rows,W,pd,y,GL,DK,BDC,fD,fR,title='HISTÓRICO DE PARCELAS'){
  const G=[11,61,46],LGR=[247,249,248];
  const tipoMap={pagamento_normal:'Normal',pagamento_com_atraso:'Com Atraso',somente_juros:'Só Juros',quitacao_antecipada:'Quitação Ant.',pagamento_antecipado:'Antecipado',recuperacao_apos_baixa:'Recuperação',acordo_com_perda:'Acordo',abatimento_acordo_assistido:'Abatimento',renegociado:'Renegociada',recuperacao_judicial:'Recuperação Judicial'};
  const cols=[
    {label:'#',w:10,key:'NUM_PARCELA',fmt:v=>String(v||'—')},
    {label:'Vencimento',w:26,key:'DATA_VENCIMENTO',fmt:fD},
    {label:'Valor Parcela',w:28,key:'VALOR_PARCELA',fmt:fR},
    {label:'Data Pagamento',w:28,key:'DATA_PAGAMENTO',fmt:fD},
    {label:'Valor Pago',w:28,key:'VALOR_PAGO',fmt:v=>(v===null||v===undefined)?'—':fR(v)},
    {label:'Tipo',w:40,key:'TIPO_PAGAMENTO',fmt:v=>tipoMap[String(v||'').toLowerCase()]||String(v||'—')},
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
  }catch(e){ console.error('garantirCertificadoQuitacao falhou, documento abre sem QR:',e); }
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
    const tipoLabelToKey={'Somente Juros':'somente_juros','Com Atraso':'pagamento_com_atraso','Quitação Antecipada':'quitacao_antecipada','Antecipado':'pagamento_antecipado'};
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

// ─── EXTRATO DO CONTRATO — PDF completo de posição da dívida ─────
function gerarExtratoPDF(contrato, parcelasContrato, pagamentosContrato, cliente, eventosContrato=[], opts={}) {
  try {
    const {G,GL,DK,MT,BDC} = _PDF_CLR;
    const SIG=[31,184,119],G7=[14,92,68],LGR=[247,249,248],SEP=[236,239,238];
    const RC=[220,38,38],RL=[254,226,226],BLC=[27,138,143],BLL=[207,250,254];
    const fD=d=>{if(!d)return'—';const dt=d instanceof Date?d:parseDate(d);return dt&&!isNaN(dt.getTime())?dt.toLocaleDateString('pt-BR'):'—';};
    const fR=fmtR;
    const now=new Date();
    const fDT=d=>`${d.toLocaleDateString('pt-BR')} às ${d.toLocaleTimeString('pt-BR',{hour:'2-digit',minute:'2-digit'})}`;
    const hoje=new Date();hoje.setHours(0,0,0,0);
    const ps=[...parcelasContrato].sort((a,b)=>parseInt(a.NUM_PARCELA||0)-parseInt(b.NUM_PARCELA||0));
    const pags=[...pagamentosContrato].filter(p=>String(p.TIPO_PAGAMENTO||'')!=='abatimento_acordo_assistido');
    const isPaga=p=>['pago','quitacao_antecipada'].includes(String(p.STATUS||p.STATUS_PAGAMENTO||'').toLowerCase());
    const isTerm=p=>_ST_TERMINAL.has(String(p.STATUS||p.STATUS_PAGAMENTO||'').toLowerCase());
    const isAtrasada=p=>{if(isTerm(p))return false;const dv=parseDate(p.DATA_VENCIMENTO);if(!dv)return false;dv.setHours(0,0,0,0);return dv<hoje;};
    const parcelasPagas=ps.filter(isPaga);
    const parcelasAbertas=ps.filter(p=>!isTerm(p));
    const parcelasAtrasadas=parcelasAbertas.filter(isAtrasada);
    const pctQuitado=ps.length>0?(parcelasPagas.length/ps.length*100):0;
    const proxVencParcela=[...parcelasAbertas].sort((a,b)=>toNum(a.DATA_VENCIMENTO)-toNum(b.DATA_VENCIMENTO))[0]||null;
    const maiorAtraso=parcelasAtrasadas.reduce((max,p)=>{const dv=parseDate(p.DATA_VENCIMENTO);if(!dv)return max;dv.setHours(0,0,0,0);return Math.max(max,Math.round((hoje.getTime()-dv.getTime())/86400000));},0);
    const principalContratado=parseFloat(contrato.VALOR_PRINCIPAL||0);
    const valorTotal=parseFloat(contrato.VALOR_TOTAL||contrato.VALOR_PRINCIPAL||0);
    const jurosContratados=Math.max(0,valorTotal-principalContratado);
    const nParc=ps.length||1;
    const principalPorParc=p=>parseFloat(p.VALOR_PRINCIPAL||(principalContratado/nParc)||0);
    const jurosPorParc=p=>Math.max(0,parseFloat(p.VALOR_JUROS||(parseFloat(p.VALOR_PARCELA||0)-principalPorParc(p))||0));
    const principalRecuperado=parcelasPagas.reduce((s,p)=>s+principalPorParc(p),0);
    const principalPendente=Math.max(0,principalContratado-principalRecuperado);
    const jurosRecebidos=parcelasPagas.reduce((s,p)=>s+Math.max(0,parseFloat(p.VALOR_PAGO||0)-principalPorParc(p)),0);
    const jurosPendentes=parcelasAbertas.reduce((s,p)=>s+jurosPorParc(p),0);
    const totalRecebido=pags.reduce((s,p)=>s+parseFloat(p.VALOR_PAGO||0),0);
    const saldoDevedor=parcelasAbertas.reduce((s,p)=>s+parseFloat(p.VALOR_PARCELA||0),0);
    const isQuitado=['quitado','recuperado_integralmente'].includes(contrato.STATUS_CONTRATO);
    const isAcordoAssistido=contrato.STATUS_CONTRATO==='acordo_assistido';
    const isJudicial=contrato.STATUS_CONTRATO==='em_processo_judicial';
    const isEncerradoJudicial=contrato.STATUS_CONTRATO==='encerrado_judicialmente';
    const temDadosJudiciais=isJudicial||isEncerradoJudicial||!!contrato.NUMERO_PROCESSO;
    const situacaoFinJudicial=String(contrato.SITUACAO_FINANCEIRA_JUDICIAL||'');
    const ts=`${now.getFullYear()}${String(now.getMonth()+1).padStart(2,'0')}${String(now.getDate()).padStart(2,'0')}${String(now.getHours()).padStart(2,'0')}${String(now.getMinutes()).padStart(2,'0')}`;
    const doc=new jsPDF({unit:'mm',format:'a4'});
    const W=210,pd=18;

    // HEADER
    let y=_pdfBrandHeader(doc,W,pd,'EXTRATO DO CONTRATO — '+String(contrato.ID_CONTRATO||''),G,DK,GL,MT,BDC);
    doc.setFont('helvetica','normal');doc.setFontSize(7);doc.setTextColor(...MT);
    doc.text('Emitido em '+fDT(now),W-pd,y-4,{align:'right'});

    // STATUS BADGE
    if(isQuitado){
      doc.setFillColor(...SIG);doc.roundedRect(pd,y,W-2*pd,11,3,3,'F');
      doc.setFont('helvetica','bold');doc.setFontSize(9.5);doc.setTextColor(255,255,255);
      doc.text('CONTRATO QUITADO',W/2,y+7.5,{align:'center'});
      y+=16;
    }else if(parcelasAtrasadas.length>0){
      doc.setFillColor(...RL);doc.roundedRect(pd,y,W-2*pd,11,3,3,'F');
      doc.setFont('helvetica','bold');doc.setFontSize(8.5);doc.setTextColor(...RC);
      doc.text('PARCELAS EM ATRASO — '+parcelasAtrasadas.length+' parc. · Maior atraso: '+maiorAtraso+' dias',W/2,y+7.5,{align:'center'});
      y+=16;
    }else if(isAcordoAssistido){
      doc.setFillColor(...BLL);doc.roundedRect(pd,y,W-2*pd,11,3,3,'F');
      doc.setFont('helvetica','bold');doc.setFontSize(9);doc.setTextColor(...BLC);
      doc.text('CONTRATO EM ACORDO ASSISTIDO',W/2,y+7.5,{align:'center'});
      y+=16;
    }else if(isJudicial){
      doc.setFillColor(...RL);doc.roundedRect(pd,y,W-2*pd,11,3,3,'F');
      doc.setFont('helvetica','bold');doc.setFontSize(9);doc.setTextColor(...RC);
      doc.text('CONTRATO EM PROCESSO JUDICIAL',W/2,y+7.5,{align:'center'});
      y+=16;
    }else if(isEncerradoJudicial&&situacaoFinJudicial==='QUITADO_JUDICIALMENTE'){
      doc.setFillColor(...SIG);doc.roundedRect(pd,y,W-2*pd,11,3,3,'F');
      doc.setFont('helvetica','bold');doc.setFontSize(9);doc.setTextColor(255,255,255);
      doc.text('ENCERRADO JUDICIALMENTE — QUITADO',W/2,y+7.5,{align:'center'});
      y+=16;
    }else if(isEncerradoJudicial&&situacaoFinJudicial==='RECUPERADO_PARCIAL'){
      const AMB=[224,160,48],AML=[253,240,214];
      doc.setFillColor(...AML);doc.roundedRect(pd,y,W-2*pd,11,3,3,'F');
      doc.setFont('helvetica','bold');doc.setFontSize(9);doc.setTextColor(...AMB);
      doc.text('ENCERRADO JUDICIALMENTE — RECUPERAÇÃO PARCIAL',W/2,y+7.5,{align:'center'});
      y+=16;
    }else if(isEncerradoJudicial){
      doc.setFillColor(...RL);doc.roundedRect(pd,y,W-2*pd,11,3,3,'F');
      doc.setFont('helvetica','bold');doc.setFontSize(9);doc.setTextColor(...RC);
      doc.text('ENCERRADO JUDICIALMENTE — PERDA DEFINITIVA',W/2,y+7.5,{align:'center'});
      y+=16;
    }

    // DADOS (2 colunas)
    const colW=(W-2*pd-5)/2,c2x=pd+colW+5,boxH=40;
    doc.setFillColor(...LGR);doc.setDrawColor(...BDC);doc.setLineWidth(0.3);
    doc.roundedRect(pd,y,colW,boxH,2,2,'FD');
    doc.setFont('helvetica','bold');doc.setFontSize(6.5);doc.setTextColor(...G7);
    doc.text('DADOS DO CLIENTE',pd+4,y+5.5);
    [['Nome',String(contrato.NOME_CLIENTE||cliente?.NOME||'—')],['CPF',String(contrato.CPF||cliente?.CPF||'—')],['Telefone',(cliente?.TELEFONE_WPP||cliente?.TELEFONE)?fmtTel(cliente.TELEFONE_WPP||cliente.TELEFONE):'—'],['ID Cliente',String(contrato.ID_CLIENTE||cliente?.ID_CLIENTE||'—')]].forEach(([k,v],i)=>{
      const ry=y+11+i*6.5;
      doc.setFont('helvetica','normal');doc.setFontSize(7);doc.setTextColor(...MT);doc.text(k,pd+4,ry);
      doc.setFont('helvetica','bold');doc.setFontSize(7);doc.setTextColor(...DK);
      doc.text((doc.splitTextToSize(String(v),colW-12)[0]||'—'),pd+colW-4,ry,{align:'right'});
    });
    doc.setFillColor(...LGR);doc.roundedRect(c2x,y,colW,boxH,2,2,'FD');
    doc.setFont('helvetica','bold');doc.setFontSize(6.5);doc.setTextColor(...G7);
    doc.text('DADOS DO CONTRATO',c2x+4,y+5.5);
    [['Contrato',String(contrato.ID_CONTRATO||'—')],['Contratação',fD(contrato.DATA_EMPRESTIMO)],['Principal',fR(principalContratado)],['Parcelas',nParc+'x de '+fR(parseFloat(ps[0]?.VALOR_PARCELA||0))],['Status',STATUS_LABEL[contrato.STATUS_CONTRATO]||String(contrato.STATUS_CONTRATO||'—')]].forEach(([k,v],i)=>{
      const ry=y+11+i*5.5;
      doc.setFont('helvetica','normal');doc.setFontSize(7);doc.setTextColor(...MT);doc.text(k,c2x+4,ry);
      doc.setFont('helvetica','bold');doc.setFontSize(7);doc.setTextColor(...DK);doc.text(String(v),c2x+colW-4,ry,{align:'right'});
    });
    y+=boxH+7;

    // DADOS DO PROCESSO JUDICIAL (condicional)
    if(temDadosJudiciais){
      const STATUS_PROC_LABEL={EM_PREPARACAO:"Em Preparação",AJUIZADO:"Ajuizado",CITACAO_PENDENTE:"Citação Pendente",CITADO:"Citado",AUDIENCIA_DESIGNADA:"Audiência Designada",AGUARDANDO_AUDIENCIA:"Aguardando Audiência",EM_ACORDO:"Em Acordo",EM_EXECUCAO:"Em Execução",PAGO_PARCIALMENTE:"Pago Parcialmente",QUITADO_JUDICIALMENTE:"Quitado Judicialmente",ARQUIVADO:"Arquivado",EXTINTO:"Extinto"};
      const juriFields=[
        ['Nº Processo (CNJ)', contrato.NUMERO_PROCESSO||'—'],
        ['Vara / Comarca', [contrato.VARA,contrato.COMARCA].filter(Boolean).join(' · ')||'—'],
        ['Data Ajuizamento', fD(contrato.DATA_AJUIZAMENTO)],
        ['Valor Executado', contrato.VALOR_EXECUTADO?fR(parseFloat(contrato.VALOR_EXECUTADO)):'—'],
        ['Status Processual', STATUS_PROC_LABEL[contrato.STATUS_PROCESSO]||contrato.STATUS_PROCESSO||'—'],
      ];
      if(contrato.DATA_ARQUIVAMENTO_PROCESSO) juriFields.push(['Data Arquivamento', fD(contrato.DATA_ARQUIVAMENTO_PROCESSO)]);
      const jBoxH=11+juriFields.length*5.5;
      doc.setFillColor(...LGR);doc.setDrawColor(...RC);doc.setLineWidth(0.3);
      doc.roundedRect(pd,y,W-2*pd,jBoxH,2,2,'FD');
      doc.setFont('helvetica','bold');doc.setFontSize(6.5);doc.setTextColor(...RC);
      doc.text('DADOS DO PROCESSO JUDICIAL',pd+4,y+5.5);
      juriFields.forEach(([k,v],i)=>{
        const ry=y+11+i*5.5;
        doc.setFont('helvetica','normal');doc.setFontSize(7);doc.setTextColor(...MT);doc.text(k,pd+4,ry);
        doc.setFont('helvetica','bold');doc.setFontSize(7);doc.setTextColor(...DK);
        doc.text((doc.splitTextToSize(String(v),W-2*pd-70)[0]||'—'),W-pd-4,ry,{align:'right'});
      });
      y+=jBoxH+7;
    }

    // RESUMO
    doc.setFillColor(...BDC);doc.roundedRect(pd,y,W-2*pd,7,1,1,'F');
    doc.setFont('helvetica','bold');doc.setFontSize(7.5);doc.setTextColor(...DK);
    doc.text('RESUMO DO CONTRATO',pd+4,y+4.8);
    y+=10;
    const kpiCols=3,kpiW=(W-2*pd-(kpiCols-1)*4)/kpiCols;
    const kpis=[['Parcelas Totais',String(ps.length),false],['Parcelas Pagas',parcelasPagas.length+' de '+ps.length+' ('+pctQuitado.toFixed(0)+'%)',false],['Em Aberto',String(parcelasAbertas.length),false],['Em Atraso',parcelasAtrasadas.length>0?String(parcelasAtrasadas.length)+' parcela'+(parcelasAtrasadas.length>1?'s':''):'—',parcelasAtrasadas.length>0],['Próx. Vencimento',proxVencParcela?fD(proxVencParcela.DATA_VENCIMENTO):'—',false],['Maior Atraso',maiorAtraso>0?maiorAtraso+' dias':'—',maiorAtraso>0]];
    kpis.forEach(([lbl,val,alert],i)=>{
      const col=i%kpiCols,row=Math.floor(i/kpiCols),rx=pd+col*(kpiW+4),ry=y+row*17;
      const bg=alert?RL:LGR,fg=alert?RC:G7;
      doc.setFillColor(...bg);doc.setDrawColor(...BDC);doc.setLineWidth(0.2);
      doc.roundedRect(rx,ry,kpiW,14,1.5,1.5,'FD');
      doc.setFont('helvetica','normal');doc.setFontSize(6.5);doc.setTextColor(...MT);doc.text(lbl,rx+kpiW/2,ry+5.5,{align:'center'});
      doc.setFont('helvetica','bold');doc.setFontSize(9);doc.setTextColor(...fg);doc.text(String(val),rx+kpiW/2,ry+11.5,{align:'center'});
    });
    y+=Math.ceil(kpis.length/kpiCols)*17;
    if(isEncerradoJudicial){
      doc.setFont('helvetica','italic');doc.setFontSize(6.5);doc.setTextColor(...MT);
      doc.text('Resolvido via recuperação judicial — parcelas originais substituídas/renegociadas pelo acordo/quitação judicial.',pd,y+4);
      y+=7;
    }
    y+=7;

    // BARRA DE PROGRESSO
    const barW=W-2*pd,barH=8,pct=Math.min(100,Math.max(0,pctQuitado));
    doc.setFillColor(...SEP);doc.roundedRect(pd,y,barW,barH,4,4,'F');
    if(pct>0){doc.setFillColor(...SIG);doc.roundedRect(pd,y,barW*(pct/100),barH,4,4,'F');}
    doc.setFont('helvetica','bold');doc.setFontSize(6.5);
    doc.setTextColor(pct>50?255:DK[0],pct>50?255:DK[1],pct>50?255:DK[2]);
    doc.text(pct.toFixed(0)+'% quitado',W/2,y+5.5,{align:'center'});
    y+=barH+7;

    // SITUAÇÃO FINANCEIRA
    doc.setFillColor(...BDC);doc.roundedRect(pd,y,W-2*pd,7,1,1,'F');
    doc.setFont('helvetica','bold');doc.setFontSize(7.5);doc.setTextColor(...DK);
    doc.text('SITUAÇÃO FINANCEIRA',pd+4,y+4.8);
    y+=10;
    const finColW=(W-2*pd-4)/2,rHFin=8;
    [{l:'Principal Contratado',v:fR(principalContratado),c:DK},{l:'Principal Recuperado',v:fR(principalRecuperado),c:G7},{l:'Principal Pendente',v:fR(principalPendente),c:principalPendente>0?RC:DK},{l:'Juros Contratados',v:fR(jurosContratados),c:DK},{l:'Juros Recebidos',v:fR(jurosRecebidos),c:G7},{l:'Juros Pendentes',v:fR(jurosPendentes),c:jurosPendentes>0?RC:DK},{l:'Total Recebido',v:fR(totalRecebido),c:G7},{l:'Saldo Devedor Atual',v:isQuitado?'R$ 0,00':fR(saldoDevedor),c:isQuitado?G7:saldoDevedor>0?RC:DK}].forEach(({l,v,c},i)=>{
      const col=i%2,row=Math.floor(i/2),rx=pd+col*(finColW+4),ry=y+row*rHFin;
      if(col===0){doc.setDrawColor(...BDC);doc.setLineWidth(0.1);doc.line(pd,ry+rHFin,W-pd,ry+rHFin);}
      doc.setFont('helvetica','normal');doc.setFontSize(7.5);doc.setTextColor(...MT);doc.text(l,rx+4,ry+5.5);
      doc.setFont('helvetica','bold');doc.setFontSize(7.5);doc.setTextColor(...c);doc.text(String(v),rx+finColW-4,ry+5.5,{align:'right'});
    });
    y+=4*rHFin+8;

    // RECUPERAÇÃO JUDICIAL (condicional)
    if(temDadosJudiciais){
      const SITUACAO_FIN_JUD_LABEL={EM_ABERTO:'Em Aberto',ACORDO_PARCELADO_ATIVO:'Acordo Parcelado Ativo',ACORDO_QUEBRADO:'Acordo Quebrado',QUITADO_JUDICIALMENTE:'Quitado Judicialmente',RECUPERADO_PARCIAL:'Recuperado Parcial',PERDA_JUDICIAL_DEFINITIVA:'Perda Judicial Definitiva'};
      const valorExecutado=parseFloat(contrato.VALOR_EXECUTADO||0);
      const principalRecJud=parseFloat(contrato.VALOR_RECUPERADO_JUDICIAL_PRINCIPAL||0);
      const lucroRecJud=parseFloat(contrato.VALOR_RECUPERADO_JUDICIAL_LUCRO||0);
      const honorarios=parseFloat(contrato.HONORARIOS_JUDICIAIS||0);
      const custas=parseFloat(contrato.CUSTAS_JUDICIAIS||0);
      const prejRestante=parseFloat(contrato.PREJUIZO_CAPITAL||0);
      doc.setFillColor(...BDC);doc.roundedRect(pd,y,W-2*pd,7,1,1,'F');
      doc.setFont('helvetica','bold');doc.setFontSize(7.5);doc.setTextColor(...DK);
      doc.text('RECUPERAÇÃO JUDICIAL',pd+4,y+4.8);
      y+=10;
      const rjRows=[
        {l:'Valor Executado',v:fR(valorExecutado),c:DK},
        {l:'Principal Recuperado (Judicial)',v:fR(principalRecJud),c:G7},
        {l:'Lucro Recuperado (Judicial)',v:fR(lucroRecJud),c:G7},
        {l:'Honorários'+(contrato.QUEM_PAGA_HONORARIOS?' ('+String(contrato.QUEM_PAGA_HONORARIOS).toLowerCase()+')':''),v:fR(honorarios),c:DK},
        {l:'Custas'+(contrato.QUEM_PAGA_CUSTAS?' ('+String(contrato.QUEM_PAGA_CUSTAS).toLowerCase()+')':''),v:fR(custas),c:DK},
        {l:'Prejuízo Remanescente',v:fR(prejRestante),c:prejRestante>0?RC:G7},
      ];
      rjRows.forEach(({l,v,c},i)=>{
        const col=i%2,row=Math.floor(i/2),rx=pd+col*(finColW+4),ry=y+row*rHFin;
        if(col===0){doc.setDrawColor(...BDC);doc.setLineWidth(0.1);doc.line(pd,ry+rHFin,W-pd,ry+rHFin);}
        doc.setFont('helvetica','normal');doc.setFontSize(7.5);doc.setTextColor(...MT);doc.text(l,rx+4,ry+5.5);
        doc.setFont('helvetica','bold');doc.setFontSize(7.5);doc.setTextColor(...c);doc.text(String(v),rx+finColW-4,ry+5.5,{align:'right'});
      });
      y+=Math.ceil(rjRows.length/2)*rHFin+4;
      doc.setFillColor(...(situacaoFinJudicial==='QUITADO_JUDICIALMENTE'?LGR:situacaoFinJudicial==='PERDA_JUDICIAL_DEFINITIVA'?RL:LGR));
      doc.setDrawColor(...BDC);doc.setLineWidth(0.3);
      doc.roundedRect(pd,y,W-2*pd,10,2,2,'FD');
      doc.setFont('helvetica','bold');doc.setFontSize(7.5);
      doc.setTextColor(...(situacaoFinJudicial==='PERDA_JUDICIAL_DEFINITIVA'?RC:G7));
      doc.text('Situação Financeira Final: '+(SITUACAO_FIN_JUD_LABEL[situacaoFinJudicial]||'Em andamento'),pd+4,y+6.5);
      y+=16;
    }

    // ACORDO ASSISTIDO BLOCK
    if(isAcordoAssistido){
      const abatido=parseFloat(contrato.VALOR_ABATIDO_ASSISTIDO||0),saldoAA=Math.max(0,principalContratado-abatido);
      doc.setFillColor(...BLL);doc.setDrawColor(...BLC);doc.setLineWidth(0.4);
      doc.roundedRect(pd,y,W-2*pd,13,2,2,'FD');
      doc.setFont('helvetica','bold');doc.setFontSize(7.5);doc.setTextColor(...BLC);
      doc.text('ACORDO ASSISTIDO  ·  Capital Abatido: '+fR(abatido)+'   |   Saldo Remanescente: '+fR(saldoAA),pd+4,y+8.5);
      y+=19;
    }

    // PERCURSO DO CONTRATO — timeline completa (criação, pagamentos, jornada judicial)
    const tipoMapPerc={pagamento_normal:'Pagamento',pagamento_com_atraso:'Pagamento (com atraso)',somente_juros:'Pagamento de Juros',quitacao_antecipada:'Quitação Antecipada',pagamento_antecipado:'Pagamento Antecipado',recuperacao_apos_baixa:'Recuperação Pós-Baixa',acordo_com_perda:'Acordo com Perda',abatimento_acordo_assistido:'Abatimento Assistido',renegociado:'Renegociação',recuperacao_judicial:'Recuperação Judicial'};
    const percurso=[];
    if(contrato.DATA_EMPRESTIMO) percurso.push({data:parseDate(contrato.DATA_EMPRESTIMO),evento:'Contrato criado',detalhe:nParc+'x de '+fR(parseFloat(contrato.VALOR_PARCELA||0))});
    (pagamentosContrato||[]).forEach(p=>{
      const tp=String(p.TIPO_PAGAMENTO||'').toLowerCase();
      percurso.push({data:parseDate(p.DATA_PAGAMENTO),evento:tipoMapPerc[tp]||'Pagamento',detalhe:fR(p.VALOR_PAGO)});
    });
    (eventosContrato||[]).filter(ev=>String(ev.ID_CONTRATO||'').trim()===String(contrato.ID_CONTRATO||'').trim()&&_TIPOS_JURI_TIMELINE.includes(String(ev.TIPO_EVENTO||'').trim())).forEach(ev=>{
      percurso.push({data:parseDate(ev.DATA_EVENTO),evento:_JURI_EVENTO_LABEL[String(ev.TIPO_EVENTO).trim()],detalhe:String(ev.OBSERVACOES||'—')});
    });
    percurso.sort((a,b)=>(a.data?a.data.getTime():0)-(b.data?b.data.getTime():0));
    if(percurso.length>0){
      if(y+30>285){doc.addPage();y=20;}
      doc.setFillColor(...BDC);doc.roundedRect(pd,y,W-2*pd,7,1,1,'F');
      doc.setFont('helvetica','bold');doc.setFontSize(7.5);doc.setTextColor(...DK);
      doc.text('PERCURSO DO CONTRATO',pd+4,y+4.8);
      y+=10;
      const pCols=[{l:'Data',w:24},{l:'Evento',w:48},{l:'Detalhe',w:W-2*pd-24-48}];
      const truncTxt=(txt,maxW)=>{
        doc.setFont('helvetica','normal');doc.setFontSize(6.5);
        let s=String(txt||'—');
        if(doc.getTextWidth(s)<=maxW) return s;
        while(s.length>1&&doc.getTextWidth(s+'…')>maxW) s=s.slice(0,-1);
        return s+'…';
      };
      doc.setFillColor(...G);doc.rect(pd,y,W-2*pd,6,'F');
      let px=pd;pCols.forEach(c=>{doc.setFont('helvetica','bold');doc.setFontSize(6.5);doc.setTextColor(255,255,255);doc.text(c.l,px+2,y+4.2);px+=c.w;});
      y+=6;
      percurso.forEach((ev,i)=>{
        if(y+7>285){
          doc.addPage();y=18;
          doc.setFillColor(...G);doc.rect(pd,y,W-2*pd,6,'F');
          let pxx=pd;pCols.forEach(c=>{doc.setFont('helvetica','bold');doc.setFontSize(6.5);doc.setTextColor(255,255,255);doc.text(c.l,pxx+2,y+4.2);pxx+=c.w;});y+=6;
        }
        if(i%2===0){doc.setFillColor(...LGR);doc.rect(pd,y,W-2*pd,7,'F');}
        let px2=pd;
        [fD(ev.data),ev.evento,truncTxt(ev.detalhe,pCols[2].w-4)].forEach((v,vi)=>{
          doc.setFont('helvetica','normal');doc.setFontSize(6.5);doc.setTextColor(...DK);
          doc.text(v,px2+2,y+5);px2+=pCols[vi].w;
        });
        doc.setDrawColor(...BDC);doc.setLineWidth(0.1);doc.line(pd,y+7,pd+(W-2*pd),y+7);
        y+=7;
      });
      doc.setDrawColor(...BDC);doc.setLineWidth(0.3);doc.line(pd,y,W-pd,y);
      y+=8;
    }

    // HISTÓRICO DE PAGAMENTOS
    if(parcelasPagas.length>0){
      if(y+30>285){doc.addPage();y=20;}
      y=_renderHistParcelas(doc,parcelasPagas,W,pd,y,GL,DK,BDC,fD,fR,'HISTÓRICO DE PAGAMENTOS');
      y+=4;
    }

    // PARCELAS EM ABERTO
    if(parcelasAbertas.length>0){
      if(y+30>285){doc.addPage();y=20;}
      const hdrBg=parcelasAtrasadas.length>0?RL:BDC,hdrFg=parcelasAtrasadas.length>0?RC:DK;
      doc.setFillColor(...hdrBg);doc.roundedRect(pd,y,W-2*pd,7,1,1,'F');
      doc.setFont('helvetica','bold');doc.setFontSize(7.5);doc.setTextColor(...hdrFg);
      doc.text(parcelasAtrasadas.length>0?'PARCELAS EM ABERTO · EM ATRASO':'PARCELAS EM ABERTO',pd+4,y+4.8);
      y+=10;
      const aCols=[{l:'#',w:12},{l:'Vencimento',w:28},{l:'Dias Atraso',w:24},{l:'Valor Parcela',w:32},{l:'Principal',w:30},{l:'Juros',w:28},{l:'Status',w:20}];
      const tableW=W-2*pd,tClr=parcelasAtrasadas.length>0?RC:G;
      doc.setFillColor(...tClr);doc.rect(pd,y,tableW,6,'F');
      let x=pd;aCols.forEach(c=>{doc.setFont('helvetica','bold');doc.setFontSize(6);doc.setTextColor(255,255,255);doc.text(c.l,x+2,y+4.2);x+=c.w;});
      y+=6;
      [...parcelasAbertas].sort((a,b)=>toNum(a.DATA_VENCIMENTO)-toNum(b.DATA_VENCIMENTO)).forEach((p,i)=>{
        if(y+7>285){
          doc.addPage();y=18;
          doc.setFillColor(...tClr);doc.rect(pd,y,tableW,6,'F');
          let xx=pd;aCols.forEach(c=>{doc.setFont('helvetica','bold');doc.setFontSize(6);doc.setTextColor(255,255,255);doc.text(c.l,xx+2,y+4.2);xx+=c.w;});y+=6;
        }
        const atrasada=isAtrasada(p);
        let dias=0;if(atrasada){const dv=parseDate(p.DATA_VENCIMENTO);dv.setHours(0,0,0,0);dias=Math.round((hoje.getTime()-dv.getTime())/86400000);}
        if(atrasada){doc.setFillColor(255,242,242);doc.rect(pd,y,tableW,7,'F');}
        else if(i%2===0){doc.setFillColor(...LGR);doc.rect(pd,y,tableW,7,'F');}
        const vals=[String(p.NUM_PARCELA||'—'),fD(p.DATA_VENCIMENTO),dias>0?dias+' d':'—',fR(parseFloat(p.VALOR_PARCELA||0)),fR(principalPorParc(p)),fR(jurosPorParc(p)),atrasada?'Atrasado':'Pendente'];
        let x2=pd;
        vals.forEach((v,vi)=>{
          const alrt=(vi===2&&dias>0)||(vi===6&&atrasada);
          doc.setFont('helvetica',alrt?'bold':'normal');doc.setFontSize(6.5);doc.setTextColor(...(alrt?RC:DK));
          doc.text(v,x2+2,y+5);x2+=aCols[vi].w;
        });
        doc.setDrawColor(...BDC);doc.setLineWidth(0.1);doc.line(pd,y+7,pd+tableW,y+7);
        y+=7;
      });
      doc.setDrawColor(...BDC);doc.setLineWidth(0.3);doc.line(pd,y,pd+tableW,y);
      y+=8;
    }

    // FOOTER
    if(y+18>285){doc.addPage();y=20;}
    doc.setDrawColor(...BDC);doc.setLineWidth(0.3);doc.line(pd,y,W-pd,y);
    doc.setFont('helvetica','italic');doc.setFontSize(7);doc.setTextColor(...MT);
    const disc='Este documento representa a posição do contrato na data de emissão e não constitui documento fiscal ou judicial.';
    const discL=doc.splitTextToSize(disc,W-2*pd);doc.text(discL,W/2,y+5,{align:'center'});
    doc.setFont('helvetica','bold');doc.setFontSize(7);doc.setTextColor(...G7);
    doc.text('Borges Assessoria Financeira · CNPJ 63.124.205/0001-07 · borgesassessoriafinanceira@gmail.com',W/2,y+5+discL.length*4.5+3,{align:'center'});

    // DOWNLOAD
    const blob=doc.output('blob');const url=URL.createObjectURL(blob);
    const a=document.createElement('a');a.href=url;a.download=`extrato-${contrato.ID_CONTRATO}-${ts}.pdf`;
    document.body.appendChild(a);a.click();document.body.removeChild(a);setTimeout(()=>URL.revokeObjectURL(url),3000);
    if(opts.wpp){
      const tel=String(cliente?.TELEFONE_WPP||cliente?.TELEFONE||'').replace(/\D/g,'');
      const isMobile=/iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
      setTimeout(()=>window.open(tel?`https://wa.me/55${tel}`:(isMobile?'https://wa.me':'https://web.whatsapp.com'),'_blank'),700);
    }
  }catch(e){console.error('Extrato PDF error:',e);alert('Erro ao gerar extrato: '+e.message);}
}

function ComprovanteEnvioModal({parcela,valorPago,dataPago,tipoLabel,parcelas,contratos,clientes,onFechar}){
  const fD=d=>{if(!d)return'—';const dt=d instanceof Date?d:parseDate(d);return dt&&!isNaN(dt)?dt.toLocaleDateString('pt-BR'):'—';};
  return(
    <div className="modal-overlay-anim" style={{position:"fixed",inset:0,zIndex:500,background:"rgba(0,0,0,0.5)",display:"flex",alignItems:"center",justifyContent:"center",padding:20}}>
      <div className="modal-box-anim" style={{width:"100%",maxWidth:380,background:CARD,borderRadius:16,border:`1px solid ${BD}`,boxShadow:"0 24px 80px rgba(0,0,0,0.28)",overflow:"hidden",minWidth:0}}>
        <div style={{background:GRN,padding:"20px 24px",textAlign:"center"}}>
          <div style={{width:44,height:44,borderRadius:"50%",background:"rgba(255,255,255,0.2)",display:"flex",alignItems:"center",justifyContent:"center",margin:"0 auto 10px"}}>
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={ONBRAND} strokeWidth="2.5"><polyline points="20,6 9,17 4,12"/></svg>
          </div>
          <div style={{color:ONBRAND,fontWeight:800,fontSize:17,letterSpacing:"-0.02em"}}>Pagamento registrado!</div>
          <div style={{color:ONBRANDSOFT,fontSize:12,marginTop:4}}>{parcela.NOME_CLIENTE} · {parcela.ID_CONTRATO} · Parcela {parcela.NUM_PARCELA}</div>
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
  const [desconto, setDesconto]     = useState(0);
  const [loading, setLoading]       = useState(false);
  const [msg, setMsg]               = useState(null);
  const [pagoIds, setPagoIds]       = useState(new Set());
  const [comprovanteData, setComprovanteData] = useState(null);
  const [modo, setModo]             = useState("pagamento"); // "pagamento" | "reagendar"
  const [promData, setPromData]     = useState("");
  const [promObs, setPromObs]       = useState("");
  const [sjPixLoad, setSjPixLoad]   = useState(false);
  const [sjPixCode, setSjPixCode]   = useState("");
  const [sjPixErr, setSjPixErr]     = useState("");
  const [sjPixCopied, setSjPixCopied] = useState(false);
  const [sjPixWppLoad, setSjPixWppLoad] = useState(false);
  const [sjPixWppOk, setSjPixWppOk]   = useState(false);
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
    setDesconto(0);
    setMsg(null);
    setModo("pagamento");
    setPromData("");
    setPromObs("");
    setSjPixLoad(false); setSjPixCode(""); setSjPixErr(""); setSjPixCopied(false); setSjPixWppLoad(false); setSjPixWppOk(false);
    const { total } = calcComAtraso(p);
    setValor(total.toFixed(2));
  };

  const changeTipo = (t) => {
    setTipo(t);
    setDesconto(0);
    setSjPixCode(""); setSjPixErr(""); setSjPixCopied(false); setSjPixWppOk(false);
    if (!parcelaSel) return;
    if (t === "total") {
      const { total } = calcComAtraso(parcelaSel);
      setValor(total.toFixed(2));
    } else if (t === "somente_juros") {
      const fee = Math.round(parseFloat(parcelaSel.VALOR_PRINCIPAL || 0) * 0.05 * 100) / 100;
      setValor((parseFloat(parcelaSel.VALOR_JUROS || 0) + fee).toFixed(2));
    } else {
      setValor(parseFloat(parcelaSel.VALOR_PARCELA || 0).toFixed(2));
    }
  };

  const changeDesconto = (v) => {
    if (!parcelaSel) return;
    const juros = parseFloat(parcelaSel.VALOR_JUROS || 0);
    const principal = parseFloat(parcelaSel.VALOR_PRINCIPAL || 0);
    const d = Math.min(Math.max(parseFloat(v) || 0, 0), juros);
    setDesconto(d);
    setValor((principal + Math.max(0, juros - d)).toFixed(2));
  };

  const gerarPixSJ = async () => {
    if (!parcelaSel || sjPixLoad) return;
    setSjPixLoad(true); setSjPixErr(""); setSjPixCode("");
    const fee = Math.round(parseFloat(parcelaSel.VALOR_PRINCIPAL || 0) * 0.05 * 100) / 100;
    const sjValor = parseFloat(parcelaSel.VALOR_JUROS || 0) + fee;
    const cpf = String(cliente?.CPF || "").replace(/\D/g, "").padStart(11, "0");
    try {
      const r = await fetch("/api/efi-charges", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          idContrato: parcelaSel.ID_CONTRATO,
          parcelas: [{ idParcela: parcelaSel.ID_PARCELA, numParcela: parseInt(parcelaSel.NUM_PARCELA||0), totalParcelas: parseInt(parcelaSel.TOTAL_PARCELAS||0), dataVencimento: parcelaSel.DATA_VENCIMENTO, valorParcela: sjValor }],
          cliente: { nome: cliente?.NOME_CLIENTE || parcelaSel.NOME_CLIENTE || "", cpf },
          isSJ: true
        })
      });
      const d = await r.json();
      if (d.ok && d.boletos?.[0]?.ok) setSjPixCode(d.boletos[0].pixCopiaECola || "");
      else setSjPixErr((d.boletos?.[0]?.erro) || d.erro || "Erro ao gerar PIX SJ");
    } catch(e) { setSjPixErr(e.message); }
    setSjPixLoad(false);
  };

  const enviarSjPixWpp = async () => {
    if (!sjPixCode || sjPixWppLoad || !parcelaSel) return;
    setSjPixWppLoad(true);
    const fee = Math.round(parseFloat(parcelaSel.VALOR_PRINCIPAL || 0) * 0.05 * 100) / 100;
    const sjValor = parseFloat(parcelaSel.VALOR_JUROS || 0) + fee;
    const res = await postAction({
      action: "enviarPixManual",
      idCliente: parcelaSel.ID_CLIENTE || "", idContrato: parcelaSel.ID_CONTRATO || "",
      idParcela: parcelaSel.ID_PARCELA || "", nome: parcelaSel.NOME_CLIENTE || "",
      telefone: cliente?.TELEFONE_WPP || cliente?.TELEFONE || "",
      numParcela: parseInt(parcelaSel.NUM_PARCELA||0), totalParcelas: parseInt(parcelaSel.TOTAL_PARCELAS||0),
      valorParcela: sjValor, dataVencimento: parcelaSel.DATA_VENCIMENTO || "", pixCode: sjPixCode
    });
    if (res.ok) { setSjPixWppOk(true); setTimeout(() => setSjPixWppOk(false), 3000); }
    setSjPixWppLoad(false);
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
      idParcela: parcelaSel.ID_PARCELA || "",
      idContrato: parcelaSel.ID_CONTRATO || "",
      numParcela: parcelaSel.NUM_PARCELA || "",
      valor: parseFloat(valor),
      data: apiDateStr(data),
      forma: "pix",
      ...(desconto > 0 && { desconto })
    });
    if (res.ok) {
      if(res.idUndo && _registrarUndoAtivo) _registrarUndoAtivo({idUndo:res.idUndo,tipo:tipo==="somente_juros"?"SOMENTE_JUROS":"PAGAMENTO_NORMAL",idContrato:parcelaSel.ID_CONTRATO||"",nomeCliente:cliente?.NOME_CLIENTE||"",segundosRestantes:900});
      setPagoIds(prev => new Set([...prev, parcelaSel.ID_PARCELA || parcelaSel.ID_CONTRATO]));
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
                      { v:"somente_juros", l:"Somente Juros",     sub:"Juros + fee 5% · principal rolado" },
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
                    onPaste={e => { if (tipo === "personalizado" || tipo === "com_atraso") pasteMoeda(e, setValor); }}
                    style={{...IS(), fontSize:20, fontWeight:800, textAlign:"center", height:52}}
                    readOnly={tipo !== "personalizado" && tipo !== "com_atraso"}
                    onFocus={() => setTipo("personalizado")}
                  />
                  {tipo === "personalizado" && (
                    <div style={{marginTop:4,fontSize:11,color:MUTED}}>Valor livre — será registrado como informado.</div>
                  )}
                </div>

                {/* Desconto nos Juros — só visível em tipo "total" */}
                {tipo === "total" && parcelaSel && parseFloat(parcelaSel.VALOR_JUROS || 0) > 0 && (
                  <div>
                    <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:4}}>
                      <span style={LS()}>Desconto nos Juros (R$)</span>
                      <span style={{fontSize:10,color:MUTED,fontWeight:600}}>máx {fmtR(parseFloat(parcelaSel.VALOR_JUROS||0))}</span>
                    </div>
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
                    {desconto > 0 && (
                      <div style={{marginTop:4,fontSize:11,color:GRN,fontWeight:600}}>
                        Cliente paga {fmtR(parseFloat(parcelaSel.VALOR_PRINCIPAL||0))} + {fmtR(Math.max(0,parseFloat(parcelaSel.VALOR_JUROS||0)-desconto))} de juros
                      </div>
                    )}
                  </div>
                )}

                {/* PIX Somente Juros */}
                {tipo === "somente_juros" && parcelaSel && (
                  <div style={{background:ORG+"08",border:`1px solid ${ORG}25`,borderRadius:10,padding:"12px 14px",display:"flex",flexDirection:"column",gap:10}}>
                    <div style={{fontSize:12,fontWeight:700,color:ORG}}>
                      PIX Somente Juros · {fmtR(parseFloat(parcelaSel.VALOR_JUROS||0) + Math.round(parseFloat(parcelaSel.VALOR_PRINCIPAL||0)*0.05*100)/100)}
                    </div>
                    {!sjPixCode ? (
                      <button onClick={gerarPixSJ} disabled={sjPixLoad} style={{...BTN5(ORG),justifyContent:"center",opacity:sjPixLoad?0.6:1}}>
                        {sjPixLoad ? <><IcoSpinner color={ORG}/> Gerando...</> : "Gerar PIX SJ"}
                      </button>
                    ) : (
                      <div style={{display:"flex",flexDirection:"column",gap:8}}>
                        <div style={{background:BG,borderRadius:7,padding:"8px 10px",fontSize:10,color:MUTED,fontFamily:"monospace",wordBreak:"break-all"}}>{sjPixCode}</div>
                        <div style={{display:"flex",gap:8}}>
                          <button onClick={()=>{navigator.clipboard.writeText(sjPixCode);setSjPixCopied(true);setTimeout(()=>setSjPixCopied(false),2000);}} style={{...BTN6(),flex:1,display:"flex",justifyContent:"center",alignItems:"center"}}>
                            {sjPixCopied ? "Copiado!" : "Copiar PIX"}
                          </button>
                          <button onClick={enviarSjPixWpp} disabled={sjPixWppLoad} style={{flex:1,padding:"8px",borderRadius:9,border:"none",background:sjPixWppOk?"#16a34a":"#25D366",color:"#FFF",fontWeight:700,fontSize:12,cursor:sjPixWppLoad?"default":"pointer",opacity:sjPixWppLoad?0.6:1,display:"flex",alignItems:"center",justifyContent:"center",gap:5}}>
                            {sjPixWppLoad ? <><IcoSpinner color="#FFF"/> Enviando...</> : sjPixWppOk ? "Enviado!" : "Enviar WPP"}
                          </button>
                        </div>
                      </div>
                    )}
                    {sjPixErr && <div style={{fontSize:11,color:RED,fontWeight:600}}>{sjPixErr}</div>}
                  </div>
                )}

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
                  {loading?<><IcoSpinner color="#07241B"/> Registrando...</>:<>{IcoCheck} Confirmar Pagamento</>}
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
function AcordoAssistidoModal({contrato, onConfirmar, onFechar}){
  const [motivo,setMotivo]=useState("");
  const [observacao,setObservacao]=useState("");
  const [loading,setLoading]=useState(false);
  const [erro,setErro]=useState("");
  const MOTIVOS=[
    {v:"",l:"Selecione o motivo..."},
    {v:"Demissão",l:"Demissão"},
    {v:"Afastamento INSS",l:"Afastamento INSS"},
    {v:"Problema de saúde",l:"Problema de saúde"},
    {v:"Redução de renda",l:"Redução de renda"},
    {v:"Outro",l:"Outro"},
  ];
  const confirmar=async()=>{
    if(!motivo){setErro("Selecione o motivo.");return;}
    setLoading(true);setErro("");
    try{
      const res=await postAction({action:"moverParaAcordoAssistido",idContrato:contrato.ID_CONTRATO,dados:{motivo,observacao,data:hojeStr()}});
      if(res.ok)onConfirmar();
      else setErro(res.erro||"Erro ao mover para Acordo Assistido.");
    }catch(e){setErro(e.message);}
    setLoading(false);
  };
  return(
    <div className="modal-overlay-anim" style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.5)",zIndex:500,display:"flex",alignItems:"center",justifyContent:"center",padding:20}}>
      <div className="modal-box-anim" style={{background:CARD,borderRadius:16,width:"100%",maxWidth:400,border:`1px solid ${BD}`,boxShadow:"0 24px 80px rgba(0,0,0,0.28)"}}>
        <div style={{padding:"18px 20px",borderBottom:`1px solid ${BD}`}}>
          <div style={{fontWeight:800,fontSize:16,color:TEXT,display:"flex",alignItems:"center",gap:8}}>{IcoHandshake} Acordo Assistido</div>
          <div style={{fontSize:12,color:MUTED,marginTop:3}}>{contrato.ID_CONTRATO} · {contrato.NOME_CLIENTE}</div>
          <div style={{fontSize:12,color:MUTED,marginTop:6,lineHeight:1.5}}>Contrato entra em tratamento especial. A dívida é mantida integralmente — apenas a cobrança ativa é suspensa.</div>
        </div>
        <div style={{padding:"16px 20px",display:"flex",flexDirection:"column",gap:14}}>
          <div>
            <span style={LS()}>Motivo</span>
            <select value={motivo} onChange={e=>{setMotivo(e.target.value);setErro("");}} style={IS()}>
              {MOTIVOS.map(o=><option key={o.v} value={o.v}>{o.l}</option>)}
            </select>
          </div>
          <div>
            <span style={LS()}>Observação (opcional)</span>
            <textarea value={observacao} onChange={e=>setObservacao(e.target.value)} rows={3} style={{...IS(),resize:"vertical",fontFamily:"inherit"}} placeholder="Detalhes adicionais..."/>
          </div>
          {erro&&<div style={{padding:"8px 12px",borderRadius:8,background:RED+"10",color:RED,fontSize:12,fontWeight:600}}>{erro}</div>}
          <div style={{display:"flex",gap:8,marginTop:4}}>
            <button onClick={onFechar} disabled={loading} style={{...BTN3(),flex:1}}>Cancelar</button>
            <button onClick={confirmar} disabled={loading} style={{flex:2,padding:"13px",borderRadius:9999,border:"none",background:BLU,color:"#FFF",fontWeight:700,fontSize:14,cursor:loading?"default":"pointer",opacity:loading?0.7:1,display:"flex",alignItems:"center",justifyContent:"center",gap:7}}>
              {loading?"Salvando...":<>{IcoCheck} Confirmar Acordo</>}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function AbatimentoAssistidoModal({contrato, parcelas, onConfirmar, onFechar}){
  const [valor,setValor]=useState("");
  const [observacao,setObservacao]=useState("");
  const [loading,setLoading]=useState(false);
  const [erro,setErro]=useState("");
  const principalOriginal=parseFloat(contrato.VALOR_PRINCIPAL||0);
  const abatidoAtual=parseFloat(contrato.VALOR_ABATIDO_ASSISTIDO||0);
  const capitalRestante=Math.max(0,principalOriginal-abatidoAtual);
  const _psAbat=(parcelas||[]).filter(p=>String(p.ID_CONTRATO)===String(contrato.ID_CONTRATO));
  const lucroReman=_psAbat.filter(p=>!_ST_TERMINAL.has(String(p.STATUS||p.STATUS_PAGAMENTO||"").toLowerCase())).reduce((s,p)=>s+parseFloat(p.VALOR_JUROS||0),0);
  const vlNum=parseFloat(String(valor).replace(",","."))||0;
  const confirmar=async()=>{
    if(vlNum<=0){setErro("Valor deve ser maior que zero.");return;}
    setLoading(true);setErro("");
    try{
      const res=await postAction({action:"registrarAbatimentoAssistido",idContrato:contrato.ID_CONTRATO,dados:{valorPago:vlNum,data:hojeStr(),forma:"pix",observacao}});
      if(res.ok){if(res.idUndo&&_registrarUndoAtivo)_registrarUndoAtivo({idUndo:res.idUndo,tipo:"ABATIMENTO_ASSISTIDO",idContrato:contrato.ID_CONTRATO,nomeCliente:contrato.NOME_CLIENTE||"",segundosRestantes:900});onConfirmar();}
      else setErro(res.erro||"Erro ao registrar abatimento.");
    }catch(e){setErro(e.message);}
    setLoading(false);
  };
  return(
    <div className="modal-overlay-anim" style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.5)",zIndex:500,display:"flex",alignItems:"center",justifyContent:"center",padding:20}}>
      <div className="modal-box-anim" style={{background:CARD,borderRadius:16,width:"100%",maxWidth:400,border:`1px solid ${BD}`,boxShadow:"0 24px 80px rgba(0,0,0,0.28)"}}>
        <div style={{padding:"18px 20px",borderBottom:`1px solid ${BD}`}}>
          <div style={{fontWeight:800,fontSize:16,color:TEXT}}>Registrar Abatimento</div>
          <div style={{fontSize:12,color:MUTED,marginTop:3}}>{contrato.ID_CONTRATO} · {contrato.NOME_CLIENTE}</div>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10,background:BG,borderRadius:10,padding:"10px 12px",marginTop:12}}>
            <div><div style={LS()}>Capital emprestado</div><div style={{fontSize:13,fontWeight:700,color:TEXT}}>{fmtR(principalOriginal)}</div></div>
            <div><div style={LS()}>Já recuperado</div><div style={{fontSize:13,fontWeight:700,color:BLU}}>{fmtR(abatidoAtual)}</div></div>
            <div style={{gridColumn:"span 2"}}><div style={LS()}>Capital restante</div><div style={{fontSize:14,fontWeight:800,color:capitalRestante>0?RED:GRN}}>{fmtR(capitalRestante)}</div></div>
            {lucroReman>0&&<div style={{gridColumn:"span 2",borderTop:`1px solid ${BD}`,paddingTop:8}}><div style={LS()}>Juros suspensos (potencial)</div><div style={{fontSize:13,fontWeight:700,color:ORG}}>{fmtR(lucroReman)}</div></div>}
          </div>
        </div>
        <div style={{padding:"16px 20px",display:"flex",flexDirection:"column",gap:14}}>
          <div>
            <span style={LS()}>Valor do abatimento (R$)</span>
            <input type="number" min="0.01" step="0.01" value={valor} onChange={e=>{setValor(e.target.value);setErro("");}} onPaste={e=>pasteMoeda(e,v=>{setValor(v);setErro("");})} style={IS()} placeholder="0,00" autoFocus/>
          </div>
          <div>
            <span style={LS()}>Observação (opcional)</span>
            <input type="text" value={observacao} onChange={e=>setObservacao(e.target.value)} style={IS()} placeholder="Ex: referente a novembro..."/>
          </div>
          {vlNum>0&&<div style={{padding:"8px 12px",borderRadius:8,background:BLU+"10",color:BLU,fontSize:12,fontWeight:700}}>
            Após: Recuperado={fmtR(abatidoAtual+vlNum)} · Capital restante={fmtR(Math.max(0,capitalRestante-vlNum))}
          </div>}
          {erro&&<div style={{padding:"8px 12px",borderRadius:8,background:RED+"10",color:RED,fontSize:12,fontWeight:600}}>{erro}</div>}
          <div style={{display:"flex",gap:8,marginTop:4}}>
            <button onClick={onFechar} disabled={loading} style={{...BTN3(),flex:1}}>Cancelar</button>
            <button onClick={confirmar} disabled={loading||vlNum<=0} style={{...BTN1(loading||vlNum<=0),flex:2}}>
              {loading?<><IcoSpinner color="#07241B"/> Registrando...</>:<>{IcoCheck} Confirmar</>}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function EncerrarContratoModal({contrato,parcelas,onConfirmar,onFechar}){
  const [valorRecebido,setValorRecebido]=useState("");
  const [dados,setDados]=useState({substatus:"CLIENTE_DESAPARECIDO",motivo:"",observacao:"",possibilidadeRecuperacao:"BAIXA",statusJuridico:"NAO_ANALISADO",proximaProvidencia:""});
  const [loading,setLoading]=useState(false);
  const [msg,setMsg]=useState(null);
  const vRec=parseFloat(valorRecebido)||0;
  const isBaixa=vRec===0;
  const ps=(parcelas||[]).filter(p=>String(p.ID_CONTRATO)===String(contrato.ID_CONTRATO));
  const valPrincipal=parseFloat(contrato.VALOR_PRINCIPAL||0);
  const valTotal=parseFloat(contrato.VALOR_TOTAL||contrato.VALOR_TOTAL_FINAL||0);
  const isAA=contrato.STATUS_CONTRATO==="acordo_assistido";
  const abatido=parseFloat(contrato.VALOR_ABATIDO_ASSISTIDO||0);
  const pagasPs=ps.filter(p=>p.STATUS==="pago");
  const jurosJaPagos=pagasPs.reduce((s,p)=>s+Math.max(0,(parseFloat(p.VALOR_PAGO)||0)-(parseFloat(p.VALOR_PRINCIPAL)||0)),0);
  const ppUnit=ps.length>0?valPrincipal/ps.length:0;
  const capitalRecup=isAA?abatido:Math.min(valPrincipal,pagasPs.reduce((s,p)=>{const vp=parseFloat(p.VALOR_PRINCIPAL||0);return s+(vp>0?vp:ppUnit);},0));
  const atrasadas=ps.filter(p=>p.STATUS==="atrasado");
  const diasAtraso=atrasadas.length>0?Math.max(...atrasadas.map(p=>{const dv=parseDate(p.DATA_VENCIMENTO);if(!dv)return 0;const d=Math.round((new Date()-dv)/86400000);return d>0?d:0;})):0;
  const statusAberto=s=>!["pago","cancelado","baixado_como_prejuizo","quitacao_antecipada","renegociado"].includes(String(s||"").toLowerCase());
  const abertas=ps.filter(p=>statusAberto(p.STATUS||p.STATUS_PAGAMENTO));
  const principalAberto=abertas.reduce((s,p)=>s+parseFloat(p.VALOR_PRINCIPAL||0),0);
  const jurosAberto=abertas.reduce((s,p)=>s+parseFloat(p.VALOR_JUROS||0),0);
  const totalDivida=principalAberto+jurosAberto;
  const prejCap=Math.max(0,valPrincipal-capitalRecup);
  const jurosNaoReal=Math.max(0,(valTotal-valPrincipal)-jurosJaPagos);
  const princRecupAcordo=Math.min(vRec,principalAberto);
  const jurosRecupAcordo=Math.max(0,vRec-princRecupAcordo);
  const descPrinc=principalAberto-princRecupAcordo;
  const descJuros=jurosAberto-jurosRecupAcordo;
  const confirmar=async()=>{
    if(isBaixa&&!dados.motivo){setMsg("Informe o motivo da baixa.");return;}
    setLoading(true);setMsg(null);
    let res;
    if(isBaixa){
      res=await postAction({action:"baixarContrato",idContrato:contrato.ID_CONTRATO,dados:{...dados,diasAtraso,valorRecuperadoAntesBaixa:capitalRecup,jurosJaRecebidos:jurosJaPagos,data:hojeStr(),parcelasABaixar:abertas.map(p=>p.ID_PARCELA)}});
    }else{
      res=await postAction({action:"acordoComPerda",dados:{idContrato:contrato.ID_CONTRATO,valorAcordado:vRec,data:hojeStr(),forma:"pix",observacao:dados.observacao}});
    }
    if(res.ok){if(res.idUndo&&_registrarUndoAtivo)_registrarUndoAtivo({idUndo:res.idUndo,tipo:isBaixa?"BAIXA_PREJUIZO":"ACORDO_COM_PERDA",idContrato:contrato.ID_CONTRATO,nomeCliente:contrato.NOME_CLIENTE||"",segundosRestantes:900});onConfirmar();}else setMsg(res.erro||"Erro.");
    setLoading(false);
  };
  const campo=(label,field,opts)=>(<div><span style={LS()}>{label}</span>{opts?<select value={dados[field]} onChange={e=>setDados(p=>({...p,[field]:e.target.value}))} style={IS()}>{opts.map(o=><option key={o.v} value={o.v}>{o.l}</option>)}</select>:<input value={dados[field]} onChange={e=>setDados(p=>({...p,[field]:e.target.value}))} style={IS()}/>}</div>);
  return(
    <div className="modal-overlay-anim" style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.5)",zIndex:400,display:"flex",alignItems:"center",justifyContent:"center",padding:20}}>
      <div className="modal-box-anim" style={{background:CARD,borderRadius:16,width:"100%",maxWidth:560,maxHeight:"90vh",display:"flex",flexDirection:"column",boxShadow:"0 24px 80px rgba(0,0,0,0.28)",border:`1px solid ${BD}`,minWidth:0}}>
        <div style={{padding:"18px 24px",borderBottom:`1px solid ${BD}`,flexShrink:0}}>
          <h2 style={{margin:0,color:isBaixa?RED:ORG,fontSize:18,fontWeight:800,display:"flex",alignItems:"center",gap:8,letterSpacing:"-0.02em"}}>{isBaixa?IcoAlert:IcoHandshake} Encerrar Contrato</h2>
          <p style={{fontSize:12,color:MUTED,margin:"4px 0 0"}}>{contrato.ID_CONTRATO} · {contrato.NOME_CLIENTE}<span style={{marginLeft:8,padding:"2px 8px",borderRadius:99,background:isBaixa?RED+"15":ORG+"15",color:isBaixa?RED:ORG,fontSize:11,fontWeight:700}}>{isBaixa?"Sem recebimento → Baixa":"Com recebimento → Acordo"}</span></p>
        </div>
        <div style={{padding:24,overflowY:"auto",flex:1}}>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10,background:BG,borderRadius:10,padding:"12px 14px",marginBottom:18}}>
            <div><span style={LS()}>Capital emprestado</span><div style={{fontSize:14,fontWeight:700}}>{fmtR(valPrincipal)}</div></div>
            <div><span style={LS()}>Dívida em aberto</span><div style={{fontSize:14,fontWeight:700,color:ORG}}>{fmtR(totalDivida)}</div></div>
            {capitalRecup>0&&<div><span style={LS()}>{isAA?"Abatido (Acordo)":"Capital já recuperado"}</span><div style={{fontSize:14,fontWeight:700,color:GRN}}>{fmtR(capitalRecup)}</div></div>}
            {diasAtraso>0&&<div><span style={LS()}>Dias de atraso</span><div style={{fontSize:14,fontWeight:700,color:RED}}>{diasAtraso}d</div></div>}
          </div>
          <div style={{marginBottom:18}}>
            <span style={LS()}>Valor recebido no encerramento (R$)</span>
            <input type="number" value={valorRecebido} onChange={e=>{setValorRecebido(e.target.value);setMsg(null);}} onPaste={e=>pasteMoeda(e,v=>{setValorRecebido(v);setMsg(null);})} placeholder="0,00 — sem valor = baixa como prejuízo" style={{...IS(),fontSize:18,fontWeight:800,height:52,textAlign:"center"}}/>
          </div>
          {!isBaixa&&(
            <div style={{background:ORG+"0D",border:`1px solid ${ORG}30`,borderRadius:10,padding:14,marginBottom:16}}>
              <div style={{fontSize:11,fontWeight:700,color:ORG,marginBottom:10,textTransform:"uppercase"}}>Resumo Contábil do Acordo</div>
              <div style={{display:"flex",flexDirection:"column",gap:7}}>
                <div style={{display:"flex",justifyContent:"space-between",fontSize:13}}><span style={{color:MUTED}}>Principal recuperado</span><strong style={{color:GRN}}>{fmtR(princRecupAcordo)}</strong></div>
                <div style={{display:"flex",justifyContent:"space-between",fontSize:13}}><span style={{color:MUTED}}>Juros recebidos</span><strong style={{color:GRN}}>{fmtR(jurosRecupAcordo)}</strong></div>
                <div style={{borderTop:`1px dashed ${BD}`,paddingTop:7,display:"flex",justifyContent:"space-between",fontSize:13}}><span style={{color:RED,fontWeight:700}}>Prejuízo real (capital perdido)</span><strong style={{color:RED}}>{fmtR(descPrinc)}</strong></div>
                <div style={{display:"flex",justifyContent:"space-between",fontSize:13}}><span style={{color:ORG,fontWeight:700}}>Juros cancelados (não é prejuízo)</span><strong style={{color:ORG}}>{fmtR(descJuros)}</strong></div>
                {descPrinc===0&&<div style={{marginTop:4,fontSize:11,color:GRN,fontWeight:700}}>✓ Principal inteiramente recuperado — apenas juros cancelados</div>}
              </div>
            </div>
          )}
          {isBaixa&&(
            <div style={{background:RED+"0D",border:`1px solid ${RED}30`,borderRadius:10,padding:14,marginBottom:16}}>
              <div style={{fontSize:11,fontWeight:700,color:RED,marginBottom:10,textTransform:"uppercase"}}>Impacto na Baixa</div>
              <div style={{display:"flex",flexDirection:"column",gap:7}}>
                <div style={{display:"flex",justifyContent:"space-between",fontSize:13}}><span style={{color:MUTED}}>Prejuízo de capital</span><strong style={{color:RED}}>{fmtR(prejCap)}</strong></div>
                <div style={{display:"flex",justifyContent:"space-between",fontSize:13}}><span style={{color:MUTED}}>Juros não realizados</span><strong style={{color:ORG}}>{fmtR(jurosNaoReal)}</strong></div>
              </div>
            </div>
          )}
          <div style={{display:"flex",flexDirection:"column",gap:14}}>
            {isBaixa&&<>
              {campo("Substatus","substatus",[{v:"CLIENTE_DESAPARECIDO",l:"Cliente Desaparecido"},{v:"SEM_BENS_PENHORAVEIS",l:"Sem Bens/Renda"},{v:"FALECIMENTO",l:"Falecimento"},{v:"FRAUDE_IDENTIFICADA",l:"Má-fé aparente"},{v:"ACORDO_VALOR_IRRISORIO",l:"Acordo Irrisório"}])}
              {campo("Motivo Detalhado (Obrigatório)","motivo")}
              {campo("Possibilidade de Recuperação","possibilidadeRecuperacao",[{v:"BAIXA",l:"Baixa"},{v:"RECURSOS_FUTUROS",l:"Remota"},{v:"JUDICIAL",l:"Judicial"}])}
              {campo("Status Jurídico","statusJuridico",[{v:"NAO_ANALISADO",l:"Não analisado"},{v:"ANALISE_INTERNA",l:"Análise Interna"},{v:"PROCESSO_AJUIZADO",l:"Processo Ajuizado"}])}
              <div><span style={LS()}>Próxima Providência</span><input value={dados.proximaProvidencia} onChange={e=>setDados(p=>({...p,proximaProvidencia:e.target.value}))} style={IS()}/></div>
            </>}
            {!isBaixa&&<div><span style={LS()}>Meio de Recebimento</span><div style={{...IS(),display:"flex",alignItems:"center",gap:6,color:GRN,fontWeight:700}}><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22,4 12,14.01 9,11.01"/></svg>PIX</div></div>}
            <div><span style={LS()}>Observação</span><textarea value={dados.observacao} onChange={e=>setDados(p=>({...p,observacao:e.target.value}))} style={{...IS(),height:72,resize:"none"}}/></div>
          </div>
          {msg&&<div style={{marginTop:14,padding:12,borderRadius:8,background:RED+"10",color:RED,fontSize:13,textAlign:"center",fontWeight:600}}>{msg}</div>}
        </div>
        <div style={{padding:"14px 20px",borderTop:`1px solid ${BD}`,display:"flex",gap:10,flexShrink:0}}>
          <button onClick={onFechar} style={{...BTN6(),flex:1}}>Cancelar</button>
          <button onClick={confirmar} disabled={loading} style={{...(isBaixa?BTN4(loading):BTN5(ORG)),flex:2,opacity:loading?0.6:1}}>{loading?<><IcoSpinner color={isBaixa?"#fff":ORG}/> Processando...</>:isBaixa?"Baixar como Prejuízo":"Confirmar Acordo"}</button>
        </div>
      </div>
    </div>
  );
}

function QuitacaoAntecipadaModal({contrato, parcelas, clientes, quitacoes, onConfirmar, onFechar, onVerContrato}){
  const abertas = useMemo(()=>(parcelas||[]).filter(p=>
    String(p.ID_CONTRATO)===String(contrato.ID_CONTRATO) &&
    !_ST_TERMINAL.has(String(p.STATUS||p.STATUS_PAGAMENTO||"").toLowerCase())
  ).sort((a,b)=>parseInt(a.NUM_PARCELA||0)-parseInt(b.NUM_PARCELA||0)),[parcelas,contrato]);

  // Proposta PIX PENDENTE já existente para esse contrato
  const propostaExistente = useMemo(()=>(quitacoes||[]).find(q=>
    String(q.ID_CONTRATO)===String(contrato.ID_CONTRATO) &&
    String(q.STATUS||"").toUpperCase()==="PENDENTE"
  )||null,[quitacoes,contrato]);

  // "form" | "pix" | "manual"
  const [view, setView] = useState(()=>propostaExistente?"pix":"form");

  const [selecionadas, setSelecionadas] = useState(()=>new Set((abertas||[]).map(p=>p.ID_PARCELA)));
  const [desconto, setDesconto]         = useState("");
  const [pct, setPct]                   = useState("");
  const [observacao, setObservacao]     = useState("");
  // manual flow
  const [dataPag, setDataPag]           = useState(hojeStr());
  // pix flow
  const [pixCode, setPixCode]           = useState(()=>propostaExistente?.EFI_PIX_CODE||"");
  const [propostaId, setPropostaId]     = useState(()=>propostaExistente?.ID_QUITACAO||"");
  const [valorPix, setValorPix]         = useState(()=>parseFloat(propostaExistente?.VALOR_FINAL||0));
  const [pixCopiado, setPixCopiado]     = useState(false);
  const [loading, setLoading]           = useState(false);
  const [msg, setMsg]                   = useState(null);
  const [confirmado, setConfirmado]     = useState(null);

  const toggle = id => setSelecionadas(prev=>{const n=new Set(prev);n.has(id)?n.delete(id):n.add(id);return n;});
  const toggleTodas = () => setSelecionadas(selecionadas.size===abertas.length?new Set():new Set(abertas.map(p=>p.ID_PARCELA)));

  const parcelasSel    = abertas.filter(p=>selecionadas.has(p.ID_PARCELA));
  const totalPrincipal = parcelasSel.reduce((s,p)=>s+parseFloat(p.VALOR_PRINCIPAL||0),0);
  const totalJuros     = parcelasSel.reduce((s,p)=>s+parseFloat(p.VALOR_JUROS||0),0);
  const descontoNum    = Math.min(parseFloat(desconto)||0, totalJuros);
  const totalCobrar    = totalPrincipal + totalJuros - descontoNum;
  const todasSel       = selecionadas.size === abertas.length && abertas.length > 0;
  const tituloModal    = todasSel ? "Quitação Antecipada" : "Amortização Antecipada";
  const faixaSel       = parseFloat(pct)>0 ? ([25,40,60].find(f=>Math.abs(f-parseFloat(pct))<0.5)||null) : null;
  const aplicarFaixa   = f => { setPct(String(f)); setDesconto(totalJuros>0?(totalJuros*f/100).toFixed(2):"0.00"); };
  const onChangePct    = v => { setPct(v); if(totalJuros>0) setDesconto((totalJuros*parseFloat(v||0)/100).toFixed(2)); };
  const onChangeDescR  = v => { setDesconto(v); setPct(totalJuros>0?((parseFloat(v||0)/totalJuros)*100).toFixed(1):""); };

  const enviarPropostaWpp = () => {
    const cli   = (clientes||[]).find(c=>String(c.ID_CLIENTE)===String(contrato.ID_CLIENTE))||{};
    const tel   = normTel(cli.TELEFONE_WPP||cli.TELEFONE||contrato.TELEFONE_WPP||contrato.TELEFONE||"");
    if(!tel||tel.length<10){alert("Telefone do cliente não encontrado no cadastro.");return;}
    const todasP  = (parcelas||[]).filter(p=>String(p.ID_CONTRATO)===String(contrato.ID_CONTRATO));
    const pagas   = todasP.filter(p=>["pago","quitacao_antecipada"].includes(String(p.STATUS||p.STATUS_PAGAMENTO||"").toLowerCase())).length;
    const semDesc = totalPrincipal + totalJuros;
    const nSel    = parcelasSel.length;
    const primeiroNome = contrato.NOME_CLIENTE.split(' ')[0];
    const jaRecuperadoWpp = parseFloat(contrato.VALOR_RECUPERADO_APOS_BAIXA||0);
    const isLossWpp = ["baixado_como_prejuizo","em_recuperacao","recuperado_parcialmente"].includes(contrato.STATUS_CONTRATO) && jaRecuperadoWpp > 0;
    const semDescEfetivo     = isLossWpp ? Math.max(0, semDesc - jaRecuperadoWpp)     : semDesc;
    const totalCobrarEfetivo = isLossWpp ? Math.max(0, totalCobrar - jaRecuperadoWpp) : totalCobrar;
    const secDesc = todasSel
      ? (descontoNum>0
          ? ['\n','💰 Condição especial para quitação à vista hoje:','','De: ~'+fmtR(semDescEfetivo)+'~','Por: *'+fmtR(totalCobrarEfetivo)+'*','','Essa condição representa um *DESCONTO de '+fmtR(descontoNum)+'* sobre o saldo em aberto.','','Caso tenha interesse em aproveitar esta proposta, basta me informar que encaminho os dados para pagamento.'].join('\n')
          : '\n\n💰 Valor para quitação à vista hoje: *'+fmtR(semDescEfetivo)+'*\n\nCaso tenha interesse, basta me informar que encaminho os dados para pagamento.')
      : (descontoNum>0
          ? ['\n','💰 Condição especial para adiantamento à vista hoje:','','De: ~'+fmtR(semDescEfetivo)+'~','Por: *'+fmtR(totalCobrarEfetivo)+'*','','Essa condição representa um *DESCONTO de '+fmtR(descontoNum)+'* sobre o valor das parcelas.','','Caso tenha interesse em aproveitar esta proposta, basta me informar que encaminho os dados para pagamento.'].join('\n')
          : '\n\n💰 Valor para adiantamento à vista hoje: *'+fmtR(semDescEfetivo)+'*\n\nCaso tenha interesse, basta me informar que encaminho os dados para pagamento.');
    const linhas = todasSel
      ? [primeiroNome+',','','Esta é a condição especial para a quitação antecipada do seu contrato.','','📋 Resumo do contrato:','• Contrato: '+contrato.ID_CONTRATO,'• Data da contratação: '+fmtDt(contrato.DATA_EMPRESTIMO||contrato.DATA_EMISSAO||contrato.DATA_CONTRATO),'• Total de parcelas: '+todasP.length,'• Parcelas já pagas: '+pagas,...(isLossWpp?['• Total já pago até hoje: '+fmtR(jaRecuperadoWpp)]:[]),'• Saldo das parcelas restantes: '+fmtR(semDescEfetivo)]
      : [primeiroNome+',','','Esta é a condição especial para o adiantamento de '+nSel+' parcela(s) do seu contrato.','','📋 Resumo das parcelas:','• Contrato: '+contrato.ID_CONTRATO,'• Data da contratação: '+fmtDt(contrato.DATA_EMPRESTIMO||contrato.DATA_EMISSAO||contrato.DATA_CONTRATO),'• Total de parcelas do contrato: '+todasP.length,'• Parcelas selecionadas: '+nSel,...(isLossWpp?['• Total já pago até hoje: '+fmtR(jaRecuperadoWpp)]:[]),'• Valor das parcelas selecionadas: '+fmtR(semDescEfetivo)];
    const msgWpp = linhas.join('\n') + secDesc;
    const url = 'https://api.whatsapp.com/send?phone=55'+tel+'&text='+encodeURIComponent(msgWpp);
    const a = document.createElement('a'); a.href=url; a.target='_blank'; a.rel='noopener noreferrer';
    document.body.appendChild(a); a.click(); document.body.removeChild(a);
  };

  // Gera proposta no GAS + cobv na Efí
  const gerarPix = async()=>{
    if(selecionadas.size===0){setMsg({ok:false,t:"Selecione ao menos uma parcela."});return;}
    setLoading(true);setMsg(null);
    // 1) Criar proposta no GAS
    const cli = (clientes||[]).find(c=>String(c.ID_CLIENTE)===String(contrato.ID_CLIENTE))||{};
    const resP = await postAction({action:"gerarPropostaQuitacaoPix",dados:{
      idContrato:           contrato.ID_CONTRATO,
      idCliente:            contrato.ID_CLIENTE,
      nomeCliente:          contrato.NOME_CLIENTE,
      parcelasSelecionadas: [...selecionadas],
      descontoJuros:        descontoNum,
      observacao
    }});
    if(!resP.ok){setMsg({ok:false,t:resP.erro||"Erro ao criar proposta."});setLoading(false);return;}

    const idQuit   = resP.idQuitacao;
    const txid     = resP.txid;
    const vlFinal  = resP.valorFinal || totalCobrar;
    setPropostaId(idQuit);
    setValorPix(vlFinal);

    // Se proposta já existia com PIX code, apenas exibir
    if(resP.jaExistia && resP.pixCopiaECola){
      setPixCode(resP.pixCopiaECola);
      setView("pix");
      setLoading(false);
      return;
    }

    // 2) Gerar cobv na Efí
    const cpf = String(cli.CPF||"").replace(/\D/g,"");
    const resPix = await fetch("/api/efi-quitacao",{
      method:"POST",
      headers:{"Content-Type":"application/json"},
      body:JSON.stringify({
        idContrato: contrato.ID_CONTRATO,
        idQuitacao: idQuit,
        txidProposta: txid,
        valorFinal: vlFinal,
        cliente:{cpf,nome:contrato.NOME_CLIENTE}
      })
    }).then(r=>r.json()).catch(e=>({erro:e.message}));

    if(resPix.ok && resPix.pixCopiaECola){
      setPixCode(resPix.pixCopiaECola);
      setView("pix");
    } else {
      setMsg({ok:false,t:resPix.erro||"Erro ao gerar PIX na Efí."});
    }
    setLoading(false);
  };

  const cancelarPix = async()=>{
    if(!window.confirm("Cancelar a proposta PIX pendente? O cliente não poderá mais pagar por esse código.")) return;
    setLoading(true);
    await postAction({action:"cancelarPropostaQuitacao",dados:{
      idContrato:  contrato.ID_CONTRATO,
      idCliente:   contrato.ID_CLIENTE,
      nomeCliente: contrato.NOME_CLIENTE
    }});
    setPixCode(""); setPropostaId(""); setValorPix(0);
    setView("form"); setLoading(false);
  };

  // Registro manual (dinheiro/transferência — não usa PIX Efí)
  const confirmarManual = async()=>{
    if(selecionadas.size===0){setMsg({ok:false,t:"Selecione ao menos uma parcela."});return;}
    setLoading(true);setMsg(null);
    const res = await postAction({action:"quitacaoAntecipada",dados:{
      idContrato: contrato.ID_CONTRATO,
      parcelasSelecionadas: [...selecionadas],
      descontoJuros: descontoNum,
      data: dataPag,
      forma: "pix",
      observacao
    }});
    if(res.ok){
      const r = res.resultado||{};
      if(res.idUndo&&_registrarUndoAtivo)_registrarUndoAtivo({idUndo:res.idUndo,tipo:"QUITACAO_ANTECIPADA",idContrato:contrato.ID_CONTRATO,nomeCliente:contrato.NOME_CLIENTE||"",segundosRestantes:900});
      setConfirmado(r);
      if(!r.contratoQuitado){
        setMsg({ok:true, t:`${r.parcelasQuitadas||selecionadas.size} parcela(s) registradas. Recebido: ${fmtR(r.totalRecebido||totalCobrar)}`});
        setTimeout(()=>onConfirmar(contrato), 1800);
      }
    } else {
      setMsg({ok:false, t:res.erro||"Erro ao processar."});
    }
    setLoading(false);
  };

  const copiarPix = ()=>{
    if(!pixCode) return;
    navigator.clipboard.writeText(pixCode).then(()=>{
      setPixCopiado(true);
      setTimeout(()=>setPixCopiado(false), 2500);
    }).catch(()=>{ const el=document.createElement("textarea");el.value=pixCode;document.body.appendChild(el);el.select();document.execCommand("copy");document.body.removeChild(el);setPixCopiado(true);setTimeout(()=>setPixCopiado(false),2500); });
  };

  const headerIcon = view==="pix"
    ? <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/><path d="M14 14h3v3m0 4h4M21 14h.01M21 17h.01M18 21h.01"/></svg>
    : IcoZap;

  return(
    <div className="modal-overlay-anim" style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.5)",zIndex:500,display:"flex",alignItems:"center",justifyContent:"center",padding:16}} onClick={onFechar}>
      <div className="modal-box-anim" onClick={e=>e.stopPropagation()} style={{background:CARD,borderRadius:16,width:"100%",maxWidth:620,maxHeight:"92vh",display:"flex",flexDirection:"column",boxShadow:"0 24px 80px rgba(0,0,0,0.28)",border:`1px solid ${BD}`,overflow:"hidden",minWidth:0}}>

        {/* Header */}
        <div style={{padding:"18px 24px",borderBottom:`1px solid ${BD}`,display:"flex",justifyContent:"space-between",alignItems:"center",flexShrink:0}}>
          <div>
            <div style={{fontSize:18,fontWeight:800,display:"flex",alignItems:"center",gap:8,letterSpacing:"-0.02em",color:TEXT}}>{headerIcon} {tituloModal}</div>
            <div style={{fontSize:12,color:MUTED,marginTop:3}}>{contrato.ID_CONTRATO} · {contrato.NOME_CLIENTE}</div>
          </div>
          <button className="modal-close-btn" onClick={onFechar} style={{background:"transparent",border:"none",width:32,height:32,borderRadius:8,cursor:"pointer",color:MUTED,display:"flex",alignItems:"center",justifyContent:"center"}}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
          </button>
        </div>

        <div style={{flex:1,overflowY:"auto",padding:20,display:"flex",flexDirection:"column",gap:16}}>

          {/* ── VIEW: PIX AGUARDANDO ── */}
          {view==="pix"&&!confirmado&&(
            <>
              <div style={{padding:16,borderRadius:12,background:GRN+"08",border:`1px solid ${GRN}30`,display:"flex",flexDirection:"column",gap:10}}>
                <div style={{display:"flex",alignItems:"center",gap:10}}>
                  <div style={{width:10,height:10,borderRadius:99,background:GRN,boxShadow:`0 0 0 3px ${GRN}30`,flexShrink:0}}/>
                  <span style={{fontSize:13,fontWeight:800,color:GRN}}>PIX gerado — aguardando pagamento do cliente</span>
                </div>
                <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",fontSize:13}}>
                  <span style={{color:MUTED}}>Valor</span>
                  <strong style={{color:TEXT,fontSize:17}}>{fmtR(valorPix)}</strong>
                </div>
                {pixCode?(
                  <div>
                    <span style={{fontSize:10,fontWeight:700,color:MUTED,textTransform:"uppercase"}}>Copia e Cola</span>
                    <div style={{display:"flex",gap:8,marginTop:4}}>
                      <div style={{flex:1,background:BG,borderRadius:8,border:`1px solid ${BD}`,padding:"8px 10px",fontSize:10,fontFamily:"monospace",overflowX:"auto",wordBreak:"break-all",color:TEXT,maxHeight:56,overflowY:"hidden"}}>{pixCode}</div>
                      <button onClick={copiarPix} style={{padding:"8px 14px",borderRadius:8,border:"none",background:pixCopiado?GRN:ACC,color:"#07241B",fontWeight:800,fontSize:11,cursor:"pointer",flexShrink:0,whiteSpace:"nowrap"}}>
                        {pixCopiado?"✓ Copiado!":"Copiar"}
                      </button>
                    </div>
                    <div style={{fontSize:10,color:MUTED,marginTop:4}}>Expira em 48h após a geração · O sistema registra automaticamente ao confirmar</div>
                  </div>
                ):(
                  <div style={{fontSize:12,color:MUTED,fontStyle:"italic"}}>Gerando código PIX...</div>
                )}
              </div>
              <div style={{fontSize:12,color:MUTED,padding:"8px 12px",borderRadius:8,background:BLU+"08",border:`1px solid ${BLU}20`}}>
                O pagamento é confirmado <strong style={{color:TEXT}}>automaticamente</strong> pelo webhook da Efí Bank. Não é necessário registrar manualmente após o cliente pagar.
              </div>
              <button onClick={cancelarPix} disabled={loading} style={{alignSelf:"flex-start",padding:"6px 14px",borderRadius:8,border:`1px solid ${RED}40`,background:"transparent",color:RED,fontWeight:700,fontSize:11,cursor:loading?"not-allowed":"pointer"}}>
                {loading?<IcoSpinner color={RED}/>:"Cancelar proposta"}
              </button>
            </>
          )}

          {/* ── VIEW: FORM (seleção de parcelas + desconto) ── */}
          {view==="form"&&!confirmado&&(
            <>
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
                        const sel  = selecionadas.has(p.ID_PARCELA);
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
                                <div style={{fontSize:12,fontWeight:700,display:"flex",alignItems:"center",gap:6}}>Parcela {p.NUM_PARCELA}/{p.TOTAL_PARCELAS} · venc. {fmtDt(p.DATA_VENCIMENTO)}{isUltima(p,parcelas)&&<span style={{fontSize:9,fontWeight:800,color:GRN,background:GRN+"18",padding:"1px 6px",borderRadius:99}}>última</span>}</div>
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

              {/* Desconto */}
              <div>
                <span style={LS()}>Desconto nos Juros</span>
                <div style={{display:"flex",gap:6,alignItems:"center",marginTop:6,flexWrap:"wrap"}}>
                  {[25,40,60].map(f=>(
                    <button key={f} onClick={()=>aplicarFaixa(f)} style={{padding:"6px 14px",borderRadius:20,border:`1.5px solid ${faixaSel===f?ACC:BD}`,background:faixaSel===f?ACC+"20":"transparent",color:faixaSel===f?GRN:TEXT,fontWeight:800,fontSize:12,cursor:"pointer",flexShrink:0}}>{f}%</button>
                  ))}
                  <input type="number" value={pct} onChange={e=>onChangePct(e.target.value)} placeholder="%" min="0" max="100" style={{...IS(),width:68,flexShrink:0,textAlign:"center"}}/>
                  <span style={{color:MUTED,fontSize:13,flexShrink:0,padding:"0 2px"}}>→ R$</span>
                  <input type="number" value={desconto} onChange={e=>onChangeDescR(e.target.value)} onPaste={e=>pasteMoeda(e,onChangeDescR)} placeholder="0.00" min="0" style={{...IS(),flex:1,minWidth:100}}/>
                </div>
                {totalJuros>0&&<div style={{fontSize:10,color:MUTED,marginTop:3}}>Máx: {fmtR(totalJuros)} (100% dos juros)</div>}
              </div>

              {/* Observação */}
              <div>
                <span style={LS()}>Observação</span>
                <input value={observacao} onChange={e=>setObservacao(e.target.value)} placeholder="Opcional" style={IS()}/>
              </div>

              {/* Preview de valores */}
              {parcelasSel.length>0&&(
                <div style={{background:ORG+"06",border:`1px solid ${ORG}25`,borderRadius:10,padding:14}}>
                  <div style={{fontSize:11,fontWeight:700,color:ORG,marginBottom:10,textTransform:"uppercase"}}>{tituloModal} — {parcelasSel.length} parcela(s)</div>
                  <div style={{display:"flex",flexDirection:"column",gap:7}}>
                    <div style={{display:"flex",justifyContent:"space-between",fontSize:13}}><span style={{color:MUTED}}>Principal</span><strong>{fmtR(totalPrincipal)}</strong></div>
                    <div style={{display:"flex",justifyContent:"space-between",fontSize:13}}><span style={{color:MUTED}}>Juros originais</span><strong>{fmtR(totalJuros)}</strong></div>
                    {descontoNum>0&&<div style={{display:"flex",justifyContent:"space-between",fontSize:13}}><span style={{color:GRN}}>Desconto concedido</span><strong style={{color:GRN}}>− {fmtR(descontoNum)}</strong></div>}
                    <div style={{borderTop:`1px solid ${ORG}20`,paddingTop:8,display:"flex",justifyContent:"space-between",fontSize:15}}>
                      <span style={{fontWeight:700}}>Total a Receber</span>
                      <strong style={{color:ORG,fontSize:17}}>{fmtR(totalCobrar)}</strong>
                    </div>
                    {todasSel&&<div style={{fontSize:11,color:GRN,fontWeight:700}}>✓ Todas as parcelas selecionadas → contrato será marcado como Quitado</div>}
                  </div>
                </div>
              )}
            </>
          )}

          {/* ── VIEW: MANUAL ── */}
          {view==="manual"&&!confirmado&&(
            <>
              <div style={{padding:"10px 14px",borderRadius:8,background:GRN+"08",border:`1px solid ${GRN}25`,fontSize:12,color:GRN,fontWeight:600,display:"flex",alignItems:"center",gap:6}}>
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22,4 12,14.01 9,11.01"/></svg>
                Registro de recebimento via PIX
              </div>
              <div>
                <span style={LS()}>Data do Pagamento</span>
                <input type="date" value={dataPag} onChange={e=>setDataPag(e.target.value)} style={IS()}/>
              </div>
              {/* Parcelas selecionadas herdadas do form */}
              <div style={{fontSize:12,color:MUTED}}>{selecionadas.size} parcela(s) selecionadas · {fmtR(totalCobrar)}</div>
            </>
          )}

          {/* Confirmado */}
          {confirmado?.contratoQuitado&&(
            <div style={{padding:20,borderRadius:12,background:GRN+"0C",border:`1px solid ${GRN}30`,textAlign:"center"}}>
              <div style={{fontSize:20,fontWeight:900,color:GRN,marginBottom:6,letterSpacing:"-0.02em"}}>✓ Contrato Quitado!</div>
              <div style={{fontSize:13,color:MUTED,marginBottom:4}}>{confirmado.parcelasQuitadas} parcela(s) liquidadas</div>
              <div style={{fontSize:16,fontWeight:800,color:TEXT}}>Recebido: {fmtR(confirmado.totalRecebido)}</div>
              {confirmado.descontoJuros>0&&<div style={{fontSize:12,color:GRN,marginTop:4}}>Desconto concedido: {fmtR(confirmado.descontoJuros)}</div>}
            </div>
          )}

          {msg&&!confirmado?.contratoQuitado&&(
            <div style={{padding:"10px 14px",borderRadius:8,background:msg.ok?GRN+"10":RED+"10",color:msg.ok?GRN:RED,fontSize:13,fontWeight:700,textAlign:"center",border:`1px solid ${msg.ok?GRN:RED}25`}}>{msg.t}</div>
          )}
        </div>

        {/* Footer */}
        <div style={{padding:"14px 20px",borderTop:`1px solid ${BD}`,display:"flex",gap:10,flexShrink:0,flexWrap:"wrap"}}>
          {confirmado?.contratoQuitado?(
            <>
              <button onClick={()=>onConfirmar(contrato)} style={{...BTN6(),flex:1}}>Fechar</button>
              {onVerContrato&&<button onClick={()=>onVerContrato(contrato)} style={{...BTN1(false),flex:2}}>Ver Contrato e Comprovante</button>}
            </>
          ):view==="pix"?(
            <>
              <button onClick={onFechar} style={{...BTN6(),flex:1}}>Fechar</button>
              {pixCode&&<button onClick={copiarPix} style={{padding:"13px 14px",borderRadius:9999,border:"none",background:pixCopiado?GRN:BLU,color:"#fff",fontWeight:800,fontSize:12,cursor:"pointer",flex:1.5,whiteSpace:"nowrap"}}>{pixCopiado?"✓ Copiado!":"Copiar PIX"}</button>}
            </>
          ):view==="manual"?(
            <>
              <button onClick={()=>setView("form")} style={{...BTN6(),flex:1}}>Voltar</button>
              <button onClick={confirmarManual} disabled={loading||selecionadas.size===0} style={{...BTN1(loading||selecionadas.size===0),flex:2}}>
                {loading?<><IcoSpinner color="#07241B"/> Processando...</>:"Confirmar Registro Manual"}
              </button>
            </>
          ):(
            <>
              <button onClick={onFechar} style={{...BTN6(),flex:"0 0 auto",minWidth:80}}>Cancelar</button>
              <button onClick={enviarPropostaWpp} disabled={parcelasSel.length===0} style={{padding:"13px 12px",borderRadius:9999,border:"none",background:parcelasSel.length===0?MUTED+"80":"#25D366",color:"#fff",fontWeight:800,fontSize:12,cursor:parcelasSel.length===0?"not-allowed":"pointer",flex:"0 0 auto",whiteSpace:"nowrap"}}>
                Proposta WPP
              </button>
              <button onClick={()=>setView("manual")} disabled={selecionadas.size===0} style={{padding:"13px 12px",borderRadius:9999,border:`1.5px solid ${BD}`,background:"transparent",color:MUTED,fontWeight:700,fontSize:11,cursor:selecionadas.size===0?"not-allowed":"pointer",flex:"0 0 auto",whiteSpace:"nowrap"}}>
                Manual
              </button>
              <button onClick={gerarPix} disabled={loading||selecionadas.size===0} style={{...BTN1(loading||selecionadas.size===0),flex:1,minWidth:120,whiteSpace:"nowrap"}}>
                {loading?<><IcoSpinner color="#07241B"/> Gerando PIX...</>:<>{headerIcon} <span style={{marginLeft:6}}>{todasSel?"Gerar PIX de Quitação":"Gerar PIX de Amortização"}</span></>}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function BloquearClienteModal({cliente, onSucesso, onFechar}){
  const [motivo,setMotivo]=useState("");
  const [loading,setLoading]=useState(false);
  const [erro,setErro]=useState("");
  const mob=useIsMobile();
  const nome=cliente.NOME||cliente.NOME_CLIENTE||"Cliente";
  const confirmar=async()=>{
    if(motivo.trim().length<5){setErro("Descreva o motivo do bloqueio (mínimo 5 caracteres).");return;}
    setLoading(true);setErro("");
    try{
      const res=await postAction({action:"bloquearClienteManual",idCliente:cliente.ID_CLIENTE,motivo:motivo.trim()});
      if(res.ok){onSucesso&&onSucesso(motivo.trim());onFechar();}
      else setErro(res.erro||"Erro ao bloquear cliente.");
    }catch(e){setErro(e.message);}
    setLoading(false);
  };
  return(
    <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.55)",zIndex:400,display:"flex",alignItems:"center",justifyContent:"center",padding:mob?0:16}} onClick={onFechar}>
      <div onClick={e=>e.stopPropagation()} style={{background:CARD,borderRadius:mob?0:16,width:"100%",maxWidth:440,maxHeight:mob?"100dvh":"90vh",overflowY:"auto",boxShadow:"0 30px 90px rgba(0,0,0,0.32)",border:mob?"none":`1px solid ${BD}`}}>
        <div style={{padding:"18px 22px",borderBottom:`1px solid ${BD}`,display:"flex",alignItems:"flex-start",justifyContent:"space-between"}}>
          <div><h2 style={{color:RED,fontSize:18,fontWeight:800,margin:0,display:"flex",alignItems:"center",gap:8,letterSpacing:"-0.02em"}}>{IcoLock} Bloquear Cliente</h2><p style={{fontSize:12,color:MUTED,margin:"4px 0 0"}}>{cliente.ID_CLIENTE} · {nome}</p></div>
          <button onClick={onFechar} style={{background:"transparent",border:"none",color:MUTED,cursor:"pointer",fontSize:18,lineHeight:1,padding:4}}>×</button>
        </div>
        <div style={{padding:"18px 22px",display:"flex",flexDirection:"column",gap:12}}>
          <div style={{background:RED+"08",border:`1px solid ${RED}30`,borderRadius:8,padding:"10px 12px",fontSize:12,color:RED,fontWeight:600,display:"flex",alignItems:"center",gap:8}}>{IcoAlert} Cliente bloqueado não poderá tirar novos contratos. Contratos já ativos continuam normalmente — cobrança e pagamentos não são afetados.</div>
          <div><span style={LS()}>Motivo do bloqueio</span><textarea value={motivo} onChange={e=>setMotivo(e.target.value)} placeholder="Ex: usou o nome de outra pessoa para tirar um contrato paralelo." rows={4} style={{...IS(),resize:"vertical",fontFamily:"inherit"}}/></div>
          {erro&&<div style={{padding:"8px 10px",borderRadius:8,background:RED+"10",color:RED,fontSize:12,fontWeight:600}}>{erro}</div>}
          <div style={{display:"flex",gap:8,marginTop:4}}>
            <button onClick={onFechar} disabled={loading} style={{flex:1,padding:"11px",borderRadius:9,border:`1px solid ${BD}`,background:"transparent",color:MUTED,cursor:"pointer",fontWeight:600,fontSize:13}}>Cancelar</button>
            <button onClick={confirmar} disabled={loading} style={{flex:2,...BTN4(loading)}}>{loading?<><IcoSpinner color="#fff"/> Bloqueando...</>:<>{IcoLock} Confirmar Bloqueio</>}</button>
          </div>
        </div>
      </div>
    </div>
  );
}

function AjuizarModal({contrato, onSucesso, onFechar}){
  const [dados,setDados]=useState({
    NUMERO_PROCESSO:"",DATA_AJUIZAMENTO:hojeStr(),VARA:"",COMARCA:"",
    STATUS_PROCESSO:"EM_PREPARACAO",VALOR_EXECUTADO:String(parseFloat(contrato?.VALOR_TOTAL||contrato?.VALOR_PRINCIPAL||0)||""),
    OBSERVACOES_JURIDICAS:"",LINK_PROCESSO:"",CODIGO_ACESSO_PROCESSO:"",
    PROXIMA_ACAO:"",DATA_PROXIMA_ACAO:""
  });
  const [loading,setLoading]=useState(false);
  const [erro,setErro]=useState("");
  const mob=useIsMobile();
  const set=f=>e=>setDados(p=>({...p,[f]:e.target.value}));
  const setF=f=>v=>setDados(p=>({...p,[f]:v}));
  const salvar=async()=>{
    if(!dados.NUMERO_PROCESSO.trim()&&!dados.DATA_AJUIZAMENTO){setErro("Número do processo ou data de ajuizamento é obrigatório.");return;}
    setLoading(true);setErro("");
    try{
      const res=await postAction({action:"ajuizarContrato",idContrato:contrato.ID_CONTRATO,dados});
      if(res.ok){onSucesso&&onSucesso();onFechar();}
      else setErro(res.erro||"Erro ao ajuizar.");
    }catch(e){setErro(e.message);}
    setLoading(false);
  };
  return(
    <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.55)",zIndex:400,display:"flex",alignItems:"center",justifyContent:"center",padding:mob?0:16}} onClick={onFechar}>
      <div onClick={e=>e.stopPropagation()} style={{background:CARD,borderRadius:mob?0:16,width:"100%",maxWidth:480,maxHeight:mob?"100dvh":"90vh",overflowY:"auto",boxShadow:"0 30px 90px rgba(0,0,0,0.32)",border:mob?"none":`1px solid ${BD}`}}>
        <div style={{padding:"18px 22px",borderBottom:`1px solid ${BD}`,display:"flex",alignItems:"flex-start",justifyContent:"space-between"}}>
          <div><h2 style={{color:RED,fontSize:18,fontWeight:800,margin:0,display:"flex",alignItems:"center",gap:8,letterSpacing:"-0.02em"}}>{IcoJur} Ajuizar Contrato</h2><p style={{fontSize:12,color:MUTED,margin:"4px 0 0"}}>{contrato?.ID_CONTRATO} · {contrato?.NOME_CLIENTE}</p></div>
          <button onClick={onFechar} style={{background:"transparent",border:"none",color:MUTED,cursor:"pointer",fontSize:18,lineHeight:1,padding:4}}>×</button>
        </div>
        <div style={{padding:"18px 22px",display:"flex",flexDirection:"column",gap:12}}>
          <div style={{background:RED+"08",border:`1px solid ${RED}30`,borderRadius:8,padding:"10px 12px",fontSize:12,color:RED,fontWeight:600,display:"flex",alignItems:"center",gap:8}}>{IcoAlert} O contrato passará para status <strong>Em Processo Judicial</strong> e o cliente será marcado como judicializado.</div>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10}}>
            <div style={{gridColumn:"1/-1"}}><span style={LS()}>Nº do Processo (CNJ)</span><input value={dados.NUMERO_PROCESSO} onChange={set("NUMERO_PROCESSO")} placeholder="0000000-00.0000.0.00.0000" style={IS()}/></div>
            <div><span style={LS()}>Data do Ajuizamento</span><input type="date" value={dados.DATA_AJUIZAMENTO} onChange={set("DATA_AJUIZAMENTO")} style={IS()}/></div>
            <div><span style={LS()}>Valor Executado (R$)</span><input type="number" value={dados.VALOR_EXECUTADO} onChange={set("VALOR_EXECUTADO")} onPaste={e=>pasteMoeda(e,setF("VALOR_EXECUTADO"))} placeholder="0.00" style={IS()}/></div>
            <div><span style={LS()}>Vara</span><input value={dados.VARA} onChange={set("VARA")} placeholder="1ª Vara Cível" style={IS()}/></div>
            <div><span style={LS()}>Comarca</span><input value={dados.COMARCA} onChange={set("COMARCA")} placeholder="Cidade" style={IS()}/></div>
            <div style={{gridColumn:"1/-1"}}><span style={LS()}>Status Processual</span>
              <select value={dados.STATUS_PROCESSO} onChange={set("STATUS_PROCESSO")} style={IS()}>
                {[["EM_PREPARACAO","Em Preparação"],["AJUIZADO","Ajuizado"],["CITACAO_PENDENTE","Citação Pendente"],["CITADO","Citado"],["AUDIENCIA_DESIGNADA","Audiência Designada"],["AGUARDANDO_AUDIENCIA","Aguardando Audiência"],["EM_ACORDO","Em Acordo"],["EM_EXECUCAO","Em Execução"],["PAGO_PARCIALMENTE","Pago Parcialmente"],["QUITADO_JUDICIALMENTE","Quitado Judicialmente"],["ARQUIVADO","Arquivado"],["EXTINTO","Extinto"]].map(([v,l])=><option key={v} value={v}>{l}</option>)}
              </select>
            </div>
            <div><span style={LS()}>Próxima Ação</span><input value={dados.PROXIMA_ACAO} onChange={set("PROXIMA_ACAO")} placeholder="Ex: Audiência de conciliação" style={IS()}/></div>
            <div><span style={LS()}>Data Próxima Ação</span><input type="date" value={dados.DATA_PROXIMA_ACAO} onChange={set("DATA_PROXIMA_ACAO")} style={IS()}/></div>
            <div style={{gridColumn:"1/-1"}}><span style={LS()}>Link do Processo (TJSP, PJe...)</span><input value={dados.LINK_PROCESSO} onChange={set("LINK_PROCESSO")} placeholder="https://..." style={IS()}/></div>
            <div style={{gridColumn:"1/-1"}}><span style={LS()}>Código de Acesso</span><input value={dados.CODIGO_ACESSO_PROCESSO} onChange={set("CODIGO_ACESSO_PROCESSO")} placeholder="Código para consultar sem login" style={IS()}/></div>
            <div style={{gridColumn:"1/-1"}}><span style={LS()}>Observações</span><input value={dados.OBSERVACOES_JURIDICAS} onChange={set("OBSERVACOES_JURIDICAS")} placeholder="Informações adicionais..." style={IS()}/></div>
          </div>
          {erro&&<div style={{padding:"8px 10px",borderRadius:8,background:RED+"10",color:RED,fontSize:12,fontWeight:600}}>{erro}</div>}
          <div style={{display:"flex",gap:8,marginTop:4}}>
            <button onClick={onFechar} disabled={loading} style={{flex:1,padding:"11px",borderRadius:9,border:`1px solid ${BD}`,background:"transparent",color:MUTED,cursor:"pointer",fontWeight:600,fontSize:13}}>Cancelar</button>
            <button onClick={salvar} disabled={loading} style={{flex:2,...BTN4(loading)}}>{loading?<><IcoSpinner color="#fff"/> Ajuizando...</>:<>{IcoJur} Confirmar Ajuizamento</>}</button>
          </div>
        </div>
      </div>
    </div>
  );
}

function AcordoJudicialModal({contrato, onSucesso, onFechar}){
  const [dados,setDados]=useState({
    tipo:"PARCELADO", data:hojeStr(), valorOriginal:String(parseFloat(contrato?.PREJUIZO_CAPITAL||contrato?.VALOR_EXECUTADO||0)||""),
    saldoAtualizado:String(parseFloat(contrato?.PREJUIZO_CAPITAL||0)||""), valorNegociado:"", entrada:"",
    qtdParcelas:"", dataPrimeiraParcela:hojeStr(), honorarios:"", quemPagaHonorarios:"",
    custas:"", quemPagaCustas:"", observacoes:""
  });
  const [loading,setLoading]=useState(false);
  const [erro,setErro]=useState("");
  const mob=useIsMobile();
  const set=f=>e=>setDados(p=>({...p,[f]:e.target.value}));
  const setF=f=>v=>setDados(p=>({...p,[f]:v}));
  const ehParcelado=dados.tipo==="PARCELADO";
  const salvar=async()=>{
    if(!dados.valorNegociado||parseFloat(dados.valorNegociado)<=0){setErro("Informe o valor negociado.");return;}
    if(ehParcelado&&(!dados.qtdParcelas||parseInt(dados.qtdParcelas)<=0)){setErro("Informe a quantidade de parcelas.");return;}
    setLoading(true);setErro("");
    try{
      const res=await postAction({action:"registrarAcordoJudicial",idContrato:contrato.ID_CONTRATO,dados});
      if(res.ok){onSucesso&&onSucesso();onFechar();}
      else setErro(res.erro||"Erro ao registrar acordo judicial.");
    }catch(e){setErro(e.message);}
    setLoading(false);
  };
  return(
    <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.55)",zIndex:400,display:"flex",alignItems:"center",justifyContent:"center",padding:mob?0:16}} onClick={onFechar}>
      <div onClick={e=>e.stopPropagation()} style={{background:CARD,borderRadius:mob?0:16,width:"100%",maxWidth:520,maxHeight:mob?"100dvh":"90vh",overflowY:"auto",boxShadow:"0 30px 90px rgba(0,0,0,0.32)",border:mob?"none":`1px solid ${BD}`}}>
        <div style={{padding:"18px 22px",borderBottom:`1px solid ${BD}`,display:"flex",alignItems:"flex-start",justifyContent:"space-between"}}>
          <div><h2 style={{color:BLU,fontSize:18,fontWeight:800,margin:0,display:"flex",alignItems:"center",gap:8,letterSpacing:"-0.02em"}}>{IcoHandshake} Acordo Judicial</h2><p style={{fontSize:12,color:MUTED,margin:"4px 0 0"}}>{contrato?.ID_CONTRATO} · {contrato?.NOME_CLIENTE}</p></div>
          <button onClick={onFechar} style={{background:"transparent",border:"none",color:MUTED,cursor:"pointer",fontSize:18,lineHeight:1,padding:4}}>×</button>
        </div>
        <div style={{padding:"18px 22px",display:"flex",flexDirection:"column",gap:12}}>
          <div><span style={LS()}>Tipo de Acordo</span>
            <div style={{display:"flex",gap:8}}>
              {[["PARCELADO","Parcelado"],["A_VISTA","À Vista"]].map(([v,l])=>(
                <button key={v} onClick={()=>setDados(p=>({...p,tipo:v}))} style={{flex:1,padding:"10px",borderRadius:9,border:`1.5px solid ${dados.tipo===v?BLU:BD}`,background:dados.tipo===v?BLU+"10":"transparent",color:dados.tipo===v?BLU:MUTED,fontWeight:700,fontSize:13,cursor:"pointer"}}>{l}</button>
              ))}
            </div>
          </div>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10}}>
            <div><span style={LS()}>Data do Acordo</span><input type="date" value={dados.data} onChange={set("data")} style={IS()}/></div>
            <div><span style={LS()}>Valor Original (R$)</span><input type="number" value={dados.valorOriginal} onChange={set("valorOriginal")} onPaste={e=>pasteMoeda(e,setF("valorOriginal"))} style={IS()}/></div>
            <div><span style={LS()}>Saldo Atualizado (R$)</span><input type="number" value={dados.saldoAtualizado} onChange={set("saldoAtualizado")} onPaste={e=>pasteMoeda(e,setF("saldoAtualizado"))} style={IS()}/></div>
            <div><span style={LS()}>Valor Negociado (R$)</span><input type="number" value={dados.valorNegociado} onChange={set("valorNegociado")} onPaste={e=>pasteMoeda(e,setF("valorNegociado"))} style={IS()}/></div>
            <div><span style={LS()}>Entrada (R$)</span><input type="number" value={dados.entrada} onChange={set("entrada")} onPaste={e=>pasteMoeda(e,setF("entrada"))} placeholder="0.00" style={IS()}/></div>
            {ehParcelado&&<>
              <div><span style={LS()}>Qtd. Parcelas</span><input type="number" value={dados.qtdParcelas} onChange={set("qtdParcelas")} style={IS()}/></div>
              <div><span style={LS()}>Data 1ª Parcela</span><input type="date" value={dados.dataPrimeiraParcela} onChange={set("dataPrimeiraParcela")} style={IS()}/></div>
            </>}
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
          </div>
          {erro&&<div style={{padding:"8px 10px",borderRadius:8,background:RED+"10",color:RED,fontSize:12,fontWeight:600}}>{erro}</div>}
          <div style={{display:"flex",gap:8,marginTop:4}}>
            <button onClick={onFechar} disabled={loading} style={{flex:1,padding:"11px",borderRadius:9,border:`1px solid ${BD}`,background:"transparent",color:MUTED,cursor:"pointer",fontWeight:600,fontSize:13}}>Cancelar</button>
            <button onClick={salvar} disabled={loading} style={{flex:2,...BTN1(loading)}}>{loading?<><IcoSpinner color="#07241B"/> Registrando...</>:<>{IcoHandshake} Confirmar Acordo</>}</button>
          </div>
        </div>
      </div>
    </div>
  );
}

function QuitacaoJudicialModal({contrato, onSucesso, onFechar}){
  const [dados,setDados]=useState({
    valorRecebido:String(parseFloat(contrato?.PREJUIZO_CAPITAL||0)||""), honorarios:"", quemPagaHonorarios:"",
    custas:"", quemPagaCustas:"", data:hojeStr(), observacao:"", forma:"pix"
  });
  const [loading,setLoading]=useState(false);
  const [erro,setErro]=useState("");
  const mob=useIsMobile();
  const set=f=>e=>setDados(p=>({...p,[f]:e.target.value}));
  const setF=f=>v=>setDados(p=>({...p,[f]:v}));
  const salvar=async()=>{
    if(!dados.valorRecebido||parseFloat(dados.valorRecebido)<=0){setErro("Informe o valor recebido.");return;}
    setLoading(true);setErro("");
    try{
      const res=await postAction({action:"registrarQuitacaoJudicial",idContrato:contrato.ID_CONTRATO,dados});
      if(res.ok){onSucesso&&onSucesso();onFechar();}
      else setErro(res.erro||"Erro ao registrar quitação judicial.");
    }catch(e){setErro(e.message);}
    setLoading(false);
  };
  return(
    <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.55)",zIndex:400,display:"flex",alignItems:"center",justifyContent:"center",padding:mob?0:16}} onClick={onFechar}>
      <div onClick={e=>e.stopPropagation()} style={{background:CARD,borderRadius:mob?0:16,width:"100%",maxWidth:480,maxHeight:mob?"100dvh":"90vh",overflowY:"auto",boxShadow:"0 30px 90px rgba(0,0,0,0.32)",border:mob?"none":`1px solid ${BD}`}}>
        <div style={{padding:"18px 22px",borderBottom:`1px solid ${BD}`,display:"flex",alignItems:"flex-start",justifyContent:"space-between"}}>
          <div><h2 style={{color:GRN,fontSize:18,fontWeight:800,margin:0,display:"flex",alignItems:"center",gap:8,letterSpacing:"-0.02em"}}>{IcoCheck} Quitação Judicial</h2><p style={{fontSize:12,color:MUTED,margin:"4px 0 0"}}>{contrato?.ID_CONTRATO} · {contrato?.NOME_CLIENTE}</p></div>
          <button onClick={onFechar} style={{background:"transparent",border:"none",color:MUTED,cursor:"pointer",fontSize:18,lineHeight:1,padding:4}}>×</button>
        </div>
        <div style={{padding:"18px 22px",display:"flex",flexDirection:"column",gap:12}}>
          <div style={{background:GRN+"08",border:`1px solid ${GRN}30`,borderRadius:8,padding:"10px 12px",fontSize:12,color:GRN,fontWeight:600,display:"flex",alignItems:"center",gap:8}}>{IcoAlert} O contrato será encerrado judicialmente (irreversível). Prejuízo remanescente: {fmtR(parseFloat(contrato?.PREJUIZO_CAPITAL||0))}.</div>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10}}>
            <div style={{gridColumn:"1/-1"}}><span style={LS()}>Valor Recebido (R$)</span><input type="number" value={dados.valorRecebido} onChange={set("valorRecebido")} onPaste={e=>pasteMoeda(e,setF("valorRecebido"))} style={IS()}/></div>
            <div><span style={LS()}>Data</span><input type="date" value={dados.data} onChange={set("data")} style={IS()}/></div>
            <div><span style={LS()}>Forma</span>
              <select value={dados.forma} onChange={set("forma")} style={IS()}>
                <option value="pix">PIX</option><option value="dinheiro">Dinheiro</option><option value="transferencia">Transferência</option>
              </select>
            </div>
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
          </div>
          {erro&&<div style={{padding:"8px 10px",borderRadius:8,background:RED+"10",color:RED,fontSize:12,fontWeight:600}}>{erro}</div>}
          <div style={{display:"flex",gap:8,marginTop:4}}>
            <button onClick={onFechar} disabled={loading} style={{flex:1,padding:"11px",borderRadius:9,border:`1px solid ${BD}`,background:"transparent",color:MUTED,cursor:"pointer",fontWeight:600,fontSize:13}}>Cancelar</button>
            <button onClick={salvar} disabled={loading} style={{flex:2,...BTN1(loading)}}>{loading?<><IcoSpinner color="#07241B"/> Confirmando...</>:<>{IcoCheck} Confirmar Quitação</>}</button>
          </div>
        </div>
      </div>
    </div>
  );
}

function ArquivarProcessoModal({contrato, onSucesso, onFechar}){
  const [dados,setDados]=useState({motivo:"QUITACAO", observacao:""});
  const [loading,setLoading]=useState(false);
  const [erro,setErro]=useState("");
  const mob=useIsMobile();
  const salvar=async()=>{
    setLoading(true);setErro("");
    try{
      const res=await postAction({action:"arquivarProcessoJudicial",idContrato:contrato.ID_CONTRATO,dados});
      if(res.ok){onSucesso&&onSucesso();onFechar();}
      else setErro(res.erro||"Erro ao arquivar processo.");
    }catch(e){setErro(e.message);}
    setLoading(false);
  };
  return(
    <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.55)",zIndex:400,display:"flex",alignItems:"center",justifyContent:"center",padding:mob?0:16}} onClick={onFechar}>
      <div onClick={e=>e.stopPropagation()} style={{background:CARD,borderRadius:mob?0:16,width:"100%",maxWidth:440,maxHeight:mob?"100dvh":"90vh",overflowY:"auto",boxShadow:"0 30px 90px rgba(0,0,0,0.32)",border:mob?"none":`1px solid ${BD}`}}>
        <div style={{padding:"18px 22px",borderBottom:`1px solid ${BD}`,display:"flex",alignItems:"flex-start",justifyContent:"space-between"}}>
          <div><h2 style={{color:MUTED,fontSize:18,fontWeight:800,margin:0,display:"flex",alignItems:"center",gap:8,letterSpacing:"-0.02em"}}>{IcoTrash} Arquivar Processo</h2><p style={{fontSize:12,color:MUTED,margin:"4px 0 0"}}>{contrato?.ID_CONTRATO} · {contrato?.NOME_CLIENTE}</p></div>
          <button onClick={onFechar} style={{background:"transparent",border:"none",color:MUTED,cursor:"pointer",fontSize:18,lineHeight:1,padding:4}}>×</button>
        </div>
        <div style={{padding:"18px 22px",display:"flex",flexDirection:"column",gap:12}}>
          <div style={{background:RED+"08",border:`1px solid ${RED}30`,borderRadius:8,padding:"10px 12px",fontSize:12,color:RED,fontWeight:600,display:"flex",alignItems:"center",gap:8}}>{IcoAlert} Se o processo for arquivado sem recuperação total, o contrato será encerrado como perda judicial definitiva. O bloqueio de crédito do cliente é permanente e não será removido.</div>
          <div><span style={LS()}>Motivo do Arquivamento</span>
            <select value={dados.motivo} onChange={e=>setDados(p=>({...p,motivo:e.target.value}))} style={IS()}>
              {[["QUITACAO","Quitação"],["ACORDO_CUMPRIDO","Acordo Cumprido"],["SENTENCA","Sentença"],["DESISTENCIA","Desistência"],["PRESCRICAO","Prescrição"],["INSOLVENCIA","Insolvência"],["OUTRO","Outro"]].map(([v,l])=><option key={v} value={v}>{l}</option>)}
            </select>
          </div>
          <div><span style={LS()}>Observação</span><input value={dados.observacao} onChange={e=>setDados(p=>({...p,observacao:e.target.value}))} placeholder="Detalhes do arquivamento..." style={IS()}/></div>
          {erro&&<div style={{padding:"8px 10px",borderRadius:8,background:RED+"10",color:RED,fontSize:12,fontWeight:600}}>{erro}</div>}
          <div style={{display:"flex",gap:8,marginTop:4}}>
            <button onClick={onFechar} disabled={loading} style={{flex:1,padding:"11px",borderRadius:9,border:`1px solid ${BD}`,background:"transparent",color:MUTED,cursor:"pointer",fontWeight:600,fontSize:13}}>Cancelar</button>
            <button onClick={salvar} disabled={loading} style={{flex:2,...BTN4(loading)}}>{loading?<><IcoSpinner color="#fff"/> Arquivando...</>:<>{IcoTrash} Confirmar Arquivamento</>}</button>
          </div>
        </div>
      </div>
    </div>
  );
}

function RenegociacaoModal({contrato, parcelas, clientes, propostasRenegociacao, onConfirmar, onFechar}){
  const cli = (clientes||[]).find(c=>String(c.ID_CLIENTE)===String(contrato.ID_CLIENTE))||{};

  const abertas = useMemo(()=>(parcelas||[]).filter(p=>
    String(p.ID_CONTRATO)===String(contrato.ID_CONTRATO) &&
    !_ST_TERMINAL.has(String(p.STATUS||p.STATUS_PAGAMENTO||"").toLowerCase())
  ).sort((a,b)=>parseInt(a.NUM_PARCELA||0)-parseInt(b.NUM_PARCELA||0)),[parcelas,contrato]);

  const capitalFaltante = useMemo(()=>{
    const tot = abertas.reduce((s,p)=>s+parseFloat(p.VALOR_PRINCIPAL||0),0);
    return Math.max(0, tot - (parseFloat(contrato.VALOR_ABATIDO_ASSISTIDO||0)||0));
  },[abertas,contrato]);

  const jurosEmAberto = useMemo(()=>
    abertas.reduce((s,p)=>s+parseFloat(p.VALOR_JUROS||0),0)
  ,[abertas]);

  const saldoTotal = capitalFaltante + jurosEmAberto;

  // Proposta PENDENTE já existente para esse contrato (aguardando pagamento da entrada)
  const propostaExistente = useMemo(()=>(propostasRenegociacao||[]).find(p=>
    String(p.ID_CONTRATO)===String(contrato.ID_CONTRATO) &&
    String(p.STATUS||"").toUpperCase()==="PENDENTE"
  )||null,[propostasRenegociacao,contrato]);

  // "form" | "pix"
  const [view, setView] = useState(()=>propostaExistente?"pix":"form");

  const [entrada, setEntrada]         = useState("");
  const [assumirRisco, setAssumirRisco] = useState(false);
  const [valorDesejado, setValorDesejado] = useState("");
  const [novoVencimento, setNovoVencimento] = useState(()=>{
    if(abertas.length>0){
      const d=parseDate(abertas[0].DATA_VENCIMENTO);
      if(d){const nx=new Date(d.getFullYear(),d.getMonth()+1,d.getDate(),12,0,0);return `${nx.getFullYear()}-${String(nx.getMonth()+1).padStart(2,"0")}-${String(nx.getDate()).padStart(2,"0")}`;}
    }
    const t=new Date();t.setMonth(t.getMonth()+1);
    return `${t.getFullYear()}-${String(t.getMonth()+1).padStart(2,"0")}-${String(t.getDate()).padStart(2,"0")}`;
  });
  const [observacao, setObservacao] = useState("");
  const [loading, setLoading]       = useState(false);
  const [msg, setMsg]               = useState(null);
  const msgRef = useRef(null);
  useEffect(()=>{ if(msg) msgRef.current?.scrollIntoView({behavior:"smooth",block:"nearest"}); },[msg]);

  // pix flow
  const [pixCode, setPixCode]           = useState(()=>propostaExistente?.EFI_PIX_CODE_ENTRADA||"");
  const [propostaId, setPropostaId]     = useState(()=>propostaExistente?.ID_PROPOSTA||"");
  const [valorEntradaPix, setValorEntradaPix] = useState(()=>parseFloat(propostaExistente?.VALOR_ENTRADA||0));
  const [sugestaoPix, setSugestaoPix]   = useState(()=>({
    qtd:   parseInt(propostaExistente?.QTD_PARCELAS_NOVA||0)||0,
    valor: parseFloat(propostaExistente?.VALOR_PARCELA_NOVA||0)||0
  }));
  const [pixCopiado, setPixCopiado]     = useState(false);
  const [pixWppLoad, setPixWppLoad]     = useState(false);
  const [pixWppOk, setPixWppOk]         = useState(false);

  const entradaMinima    = abertas.length>0 ? parseFloat(abertas[0].VALOR_JUROS||0) : 0;
  const entradaNum       = parseFloat(entrada)||0;
  const valorDesejadoNum = parseFloat(valorDesejado)||0;
  const entradaSobreCapital = Math.min(entradaNum, capitalFaltante);
  const entradaSobreJuros   = Math.min(Math.max(0, entradaNum - entradaSobreCapital), jurosEmAberto);
  const saldoRestante    = Math.max(0, (capitalFaltante-entradaSobreCapital) + (jurosEmAberto-entradaSobreJuros));
  const qtdSugerida      = valorDesejadoNum>0 ? Math.max(1, Math.ceil(saldoRestante/valorDesejadoNum)) : 0;
  const valorParcelaFinal= qtdSugerida>0 ? Math.ceil(saldoRestante/qtdSugerida) : 0;
  const entradaAtendeMinimo = assumirRisco || entradaNum>=entradaMinima;
  const semEntrada        = assumirRisco && entradaNum<=0;
  const canSubmitPix       = !semEntrada && entradaNum>0 && entradaAtendeMinimo && entradaNum<saldoTotal && valorDesejadoNum>0 && !!novoVencimento;
  const canSubmitSemEntrada= semEntrada && valorDesejadoNum>0 && !!novoVencimento;

  const enviarPropostaWpp = () => {
    const tel = normTel(cli.TELEFONE_WPP||cli.TELEFONE||"");
    if(!tel||tel.length<10){alert("Telefone não encontrado.");return;}
    const nome = contrato.NOME_CLIENTE.split(" ")[0];
    const lines = [
      nome+",","",
      "Preparei uma proposta de renegociação para o seu contrato.","",
      "📋 Contrato: "+contrato.ID_CONTRATO,
      "💰 Saldo atual: "+fmtR(saldoTotal),"",
      "📝 Proposta de renegociação:",
      "• Entrada: "+fmtR(entradaNum),
      "• "+qtdSugerida+" parcelas de "+fmtR(valorParcelaFinal),"",
      "Caso tenha interesse, me confirme para eu já te mandar o PIX da entrada e fecharmos o acordo."
    ];
    const url="https://api.whatsapp.com/send?phone=55"+tel+"&text="+encodeURIComponent(lines.join("\n"));
    const a=document.createElement("a");a.href=url;a.target="_blank";a.rel="noopener noreferrer";
    document.body.appendChild(a);a.click();document.body.removeChild(a);
  };

  const gerarPix = async () => {
    if(!canSubmitPix){
      setMsg({ok:false,t:"Preencha a entrada e o valor de parcela desejado pelo cliente."});
      return;
    }
    setLoading(true);setMsg(null);

    const resP = await postAction({action:"gerarPropostaRenegociacao",dados:{
      idContrato:               contrato.ID_CONTRATO,
      idCliente:                contrato.ID_CLIENTE,
      nomeCliente:               contrato.NOME_CLIENTE,
      valorEntrada:              entradaNum,
      novaValorParcelaDesejada:  valorDesejadoNum,
      novoVencimento,
      observacao,
      assumirRisco
    }});
    if(!resP.ok){setMsg({ok:false,t:resP.erro||"Erro ao criar proposta."});setLoading(false);return;}

    setPropostaId(resP.idProposta);
    setValorEntradaPix(resP.valorEntrada);
    setSugestaoPix({qtd:resP.qtdSugerida, valor:resP.valorParcelaFinal});

    if(resP.jaExistia && resP.pixCopiaECola){
      setPixCode(resP.pixCopiaECola);
      setView("pix");
      setLoading(false);
      return;
    }

    const cpf = String(cli.CPF||"").replace(/\D/g,"").padStart(11,"0");
    const resPix = await fetch("/api/efi-quitacao",{
      method:"POST",
      headers:{"Content-Type":"application/json"},
      body:JSON.stringify({
        idContrato:    contrato.ID_CONTRATO,
        idProposta:    resP.idProposta,
        txidProposta:  resP.txid,
        valorFinal:    resP.valorEntrada,
        callbackAction:"salvarPixEntradaRenegociacao",
        descricaoPix:  "Entrada renegociacao - "+contrato.ID_CONTRATO,
        cliente:{cpf,nome:contrato.NOME_CLIENTE}
      })
    }).then(r=>r.json()).catch(e=>({erro:e.message}));

    if(resPix.ok && resPix.pixCopiaECola){
      setPixCode(resPix.pixCopiaECola);
      setView("pix");
    } else {
      setMsg({ok:false,t:resPix.erro||"Erro ao gerar PIX na Efí."});
    }
    setLoading(false);
  };

  const renegociarSemEntrada = async () => {
    if(!canSubmitSemEntrada){
      setMsg({ok:false,t:"Preencha o valor de parcela desejado e a data do novo carnê."});
      return;
    }
    if(!window.confirm("Renegociar SEM entrada, assumindo o risco? As parcelas antigas serão encerradas e um novo carnê será criado imediatamente. Essa ação não pode ser desfeita.")) return;
    setLoading(true);setMsg(null);
    const res = await postAction({action:"renegociarContrato",dados:{
      idContrato:        contrato.ID_CONTRATO,
      novaValorParcela:  valorParcelaFinal,
      novasParcelasQtd:  qtdSugerida,
      novoVencimento,
      observacao:        "[SEM ENTRADA - RISCO ASSUMIDO] " + observacao
    }});
    setLoading(false);
    if(res.ok){ onConfirmar&&onConfirmar(); }
    else { setMsg({ok:false,t:res.erro||"Erro ao renegociar."}); }
  };

  const cancelarPix = async () => {
    if(!window.confirm("Cancelar a proposta de renegociação pendente? O cliente não poderá mais pagar por esse código.")) return;
    setLoading(true);
    await postAction({action:"cancelarPropostaRenegociacao",dados:{
      idContrato:  contrato.ID_CONTRATO,
      idCliente:   contrato.ID_CLIENTE,
      nomeCliente: contrato.NOME_CLIENTE
    }});
    setPixCode(""); setPropostaId(""); setValorEntradaPix(0);
    setView("form"); setLoading(false);
  };

  const copiarPix = () => {
    if(!pixCode) return;
    navigator.clipboard.writeText(pixCode).then(()=>{
      setPixCopiado(true);
      setTimeout(()=>setPixCopiado(false), 2500);
    }).catch(()=>{ const el=document.createElement("textarea");el.value=pixCode;document.body.appendChild(el);el.select();document.execCommand("copy");document.body.removeChild(el);setPixCopiado(true);setTimeout(()=>setPixCopiado(false),2500); });
  };

  const enviarPixWpp = async () => {
    if(!pixCode || pixWppLoad) return;
    setPixWppLoad(true);
    const res = await postAction({
      action:      "enviarPixManual",
      tipo:        "entrada_renegociacao",
      idCliente:   contrato.ID_CLIENTE,
      idContrato:  contrato.ID_CONTRATO,
      nome:        contrato.NOME_CLIENTE || "",
      telefone:    cli.TELEFONE_WPP || cli.TELEFONE || "",
      valorParcela: valorEntradaPix,
      pixCode
    });
    if(res.ok){ setPixWppOk(true); setTimeout(()=>setPixWppOk(false), 3000); }
    else setMsg({ok:false,t:res.erro||"Erro ao enviar PIX via WhatsApp."});
    setPixWppLoad(false);
  };

  return(
    <div className="modal-overlay-anim" style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.5)",zIndex:500,display:"flex",alignItems:"center",justifyContent:"center",padding:16}} onClick={onFechar}>
      <div className="modal-box-anim" onClick={e=>e.stopPropagation()} style={{background:CARD,borderRadius:16,width:"100%",maxWidth:600,maxHeight:"92vh",display:"flex",flexDirection:"column",boxShadow:"0 24px 80px rgba(0,0,0,0.28)",border:`1px solid ${BD}`,overflow:"hidden",minWidth:0}}>

        <div style={{padding:"18px 24px",borderBottom:`1px solid ${BD}`,display:"flex",justifyContent:"space-between",alignItems:"center",flexShrink:0,background:PUR}}>
          <div>
            <div style={{fontSize:18,fontWeight:800,display:"flex",alignItems:"center",gap:8,letterSpacing:"-0.02em",color:"#fff"}}>{IcoRepeat} Renegociar Contrato</div>
            <div style={{fontSize:12,color:"rgba(255,255,255,0.65)",marginTop:3}}>{contrato.ID_CONTRATO} · {contrato.NOME_CLIENTE}</div>
          </div>
          <button className="modal-close-btn" onClick={onFechar} style={{background:"rgba(255,255,255,0.15)",border:"none",width:32,height:32,borderRadius:8,cursor:"pointer",color:"#fff",display:"flex",alignItems:"center",justifyContent:"center"}}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
          </button>
        </div>

        <div style={{flex:1,overflowY:"auto",padding:20,display:"flex",flexDirection:"column",gap:16}}>

          <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:10}}>
            {[
              {l:"Capital em aberto",v:fmtR(capitalFaltante),c:RED},
              {l:"Juros em aberto",v:fmtR(jurosEmAberto),c:ORG},
              {l:"Saldo total",v:fmtR(saldoTotal),c:TEXT}
            ].map(({l,v,c})=>(
              <div key={l} style={{background:BG,borderRadius:10,padding:"12px 14px",border:`1px solid ${BD}`}}>
                <div style={{fontSize:10,color:MUTED,fontWeight:700,textTransform:"uppercase",letterSpacing:"0.07em",marginBottom:5}}>{l}</div>
                <div style={{fontSize:16,fontWeight:800,color:c}}>{v}</div>
              </div>
            ))}
          </div>

          {contrato.STATUS_CONTRATO==="acordo_assistido"&&parseFloat(contrato.VALOR_ABATIDO_ASSISTIDO||0)>0&&(
            <div style={{padding:"10px 14px",borderRadius:8,background:BLU+"10",border:`1px solid ${BLU}25`,fontSize:12,color:BLU,fontWeight:500}}>
              Capital já abatido em Acordo Assistido: {fmtR(parseFloat(contrato.VALOR_ABATIDO_ASSISTIDO))} (já deduzido do capital em aberto)
            </div>
          )}

          {/* ── VIEW: PIX AGUARDANDO ── */}
          {view==="pix"&&(
            <>
              <div style={{padding:16,borderRadius:12,background:GRN+"08",border:`1px solid ${GRN}30`,display:"flex",flexDirection:"column",gap:10}}>
                <div style={{display:"flex",alignItems:"center",gap:10}}>
                  <div style={{width:10,height:10,borderRadius:99,background:GRN,boxShadow:`0 0 0 3px ${GRN}30`,flexShrink:0}}/>
                  <span style={{fontSize:13,fontWeight:800,color:GRN}}>PIX da entrada gerado — aguardando pagamento do cliente</span>
                </div>
                <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",fontSize:13}}>
                  <span style={{color:MUTED}}>Entrada</span>
                  <strong style={{color:TEXT,fontSize:17}}>{fmtR(valorEntradaPix)}</strong>
                </div>
                {sugestaoPix.qtd>0&&(
                  <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",fontSize:12}}>
                    <span style={{color:MUTED}}>Novo carnê após a entrada</span>
                    <strong style={{color:TEXT}}>{sugestaoPix.qtd}x de {fmtR(sugestaoPix.valor)}</strong>
                  </div>
                )}
                {pixCode?(
                  <div>
                    <span style={{fontSize:10,fontWeight:700,color:MUTED,textTransform:"uppercase"}}>Copia e Cola</span>
                    <div style={{display:"flex",gap:8,marginTop:4}}>
                      <div style={{flex:1,background:BG,borderRadius:8,border:`1px solid ${BD}`,padding:"8px 10px",fontSize:10,fontFamily:"monospace",overflowX:"auto",wordBreak:"break-all",color:TEXT,maxHeight:56,overflowY:"hidden"}}>{pixCode}</div>
                      <button onClick={copiarPix} style={{padding:"8px 14px",borderRadius:8,border:"none",background:pixCopiado?GRN:ACC,color:"#07241B",fontWeight:800,fontSize:11,cursor:"pointer",flexShrink:0,whiteSpace:"nowrap"}}>
                        {pixCopiado?"✓ Copiado!":"Copiar"}
                      </button>
                    </div>
                    <div style={{fontSize:10,color:MUTED,marginTop:4}}>Expira em 48h após a geração</div>
                  </div>
                ):(
                  <div style={{fontSize:12,color:MUTED,fontStyle:"italic"}}>Gerando código PIX...</div>
                )}
              </div>
              <div style={{fontSize:12,color:MUTED,padding:"8px 12px",borderRadius:8,background:BLU+"08",border:`1px solid ${BLU}20`}}>
                A renegociação só é efetivada <strong style={{color:TEXT}}>depois que a entrada cai</strong>, confirmada automaticamente pelo webhook da Efí Bank. As parcelas atuais continuam cobráveis normalmente até lá.
              </div>
              <button onClick={cancelarPix} disabled={loading} style={{alignSelf:"flex-start",padding:"6px 14px",borderRadius:8,border:`1px solid ${RED}40`,background:"transparent",color:RED,fontWeight:700,fontSize:11,cursor:loading?"not-allowed":"pointer"}}>
                {loading?<IcoSpinner color={RED}/>:"Cancelar proposta"}
              </button>
            </>
          )}

          {/* ── VIEW: FORM ── */}
          {view==="form"&&(
            <>
              <div>
                <div style={{fontSize:11,fontWeight:700,color:MUTED,textTransform:"uppercase",marginBottom:8}}>{abertas.length} parcela(s) que serão encerradas quando a entrada cair</div>
                <div style={{maxHeight:120,overflowY:"auto",border:`1px solid ${BD}`,borderRadius:10,background:BG}}>
                  {abertas.map((p,i)=>(
                    <div key={p.ID_PARCELA||i} style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"8px 14px",borderBottom:i<abertas.length-1?`1px solid ${BD}`:"none",fontSize:12}}>
                      <span style={{color:MUTED}}>Parcela {p.NUM_PARCELA}/{p.TOTAL_PARCELAS}</span>
                      <span style={{fontWeight:700,color:TEXT}}>{fmtR(parseFloat(p.VALOR_PARCELA||0))}</span>
                      <span style={{color:MUTED}}>{fmtDt(p.DATA_VENCIMENTO)}</span>
                    </div>
                  ))}
                </div>
              </div>

              <div style={{display:"flex",flexDirection:"column",gap:12}}>
                <div style={{fontSize:11,fontWeight:700,color:MUTED,textTransform:"uppercase"}}>Nova configuração</div>
                <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12}}>
                  <div>
                    <label style={LS()}>Entrada (R$)</label>
                    <input type="number" value={entrada} onChange={e=>setEntrada(e.target.value)} onPaste={e=>pasteMoeda(e,setEntrada)} placeholder={entradaMinima>0?entradaMinima.toFixed(2):"0,00"} min="0" step="0.01" style={IS()}/>
                    <div style={{fontSize:10,color:assumirRisco?MUTED:(entradaNum>0&&!entradaAtendeMinimo?RED:MUTED),marginTop:4}}>
                      {assumirRisco?"Sem mínimo — deixe em branco para renegociar sem entrada.":`Mínimo sugerido: ${fmtR(entradaMinima)} (juros do mês deste contrato)`}
                    </div>
                  </div>
                  <div>
                    <label style={LS()}>Valor que o cliente disse que consegue pagar/mês (R$)</label>
                    <input type="number" value={valorDesejado} onChange={e=>setValorDesejado(e.target.value)} onPaste={e=>pasteMoeda(e,setValorDesejado)} placeholder="0,00" min="0" step="0.01" style={IS()}/>
                  </div>
                </div>
                <label style={{display:"flex",alignItems:"center",gap:8,fontSize:12,color:TEXT,cursor:"pointer"}}>
                  <input type="checkbox" checked={assumirRisco} onChange={e=>setAssumirRisco(e.target.checked)} style={{width:16,height:16,accentColor:RED}}/>
                  Assumir o risco e dispensar a entrada mínima
                </label>
                <div>
                  <label style={LS()}>Data do 1º vencimento (novo carnê)</label>
                  <input type="date" value={novoVencimento} onChange={e=>setNovoVencimento(e.target.value)} style={IS()}/>
                </div>
              </div>

              {(entradaNum>0||semEntrada)&&valorDesejadoNum>0&&(
                <div style={{padding:"14px 16px",borderRadius:12,border:`2px solid ${PUR}`,background:`${PUR}08`}}>
                  <div style={{display:"flex",flexDirection:"column",gap:7}}>
                    <div style={{display:"flex",justifyContent:"space-between",fontSize:13}}><span style={{color:MUTED}}>Saldo total</span><strong>{fmtR(saldoTotal)}</strong></div>
                    <div style={{display:"flex",justifyContent:"space-between",fontSize:13}}><span style={{color:GRN}}>(–) Entrada</span><strong style={{color:GRN}}>− {fmtR(entradaNum)}</strong></div>
                    <div style={{borderTop:`1px solid ${PUR}20`,paddingTop:8,display:"flex",justifyContent:"space-between",fontSize:13}}>
                      <span style={{color:MUTED}}>Saldo a parcelar</span><strong>{fmtR(saldoRestante)}</strong>
                    </div>
                    <div style={{display:"flex",justifyContent:"space-between",fontSize:15,marginTop:2}}>
                      <span style={{fontWeight:700}}>Sugestão de parcelamento</span>
                      <strong style={{color:PUR,fontSize:17}}>{qtdSugerida}x de {fmtR(valorParcelaFinal)}</strong>
                    </div>
                    <div style={{fontSize:11,color:MUTED,marginTop:2}}>Sem teto de parcelas — arredondado pra cima e igual entre todas. Se achar longo demais, negocie um valor de parcela maior com o cliente.</div>
                  </div>
                </div>
              )}

              <div>
                <label style={LS()}>Observação (opcional)</label>
                <textarea value={observacao} onChange={e=>setObservacao(e.target.value)} rows={2} placeholder="Ex: acordo feito por telefone..." style={{...IS(),resize:"vertical"}}/>
              </div>
            </>
          )}

          {msg&&(
            <div ref={msgRef} style={{padding:"10px 14px",borderRadius:8,fontSize:12,fontWeight:600,background:msg.ok?GRN+"10":RED+"10",color:msg.ok?GRN:RED}}>
              {msg.t}
            </div>
          )}
        </div>

        <div style={{padding:"12px 20px 16px",borderTop:`1px solid ${BD}`,display:"flex",gap:10,flexShrink:0}}>
          {view==="form"?(
            <>
              {(entradaNum>0||semEntrada)&&valorDesejadoNum>0&&(
                <button onClick={enviarPropostaWpp} style={{...BTN2(false),flex:"0 0 auto",padding:"13px 16px",fontSize:13}}>
                  {IcoWpp} Proposta WPP
                </button>
              )}
              {semEntrada?(
                <button onClick={renegociarSemEntrada} disabled={loading||!canSubmitSemEntrada} style={{...BTN1(!canSubmitSemEntrada||loading),flex:1,background:(!canSubmitSemEntrada||loading)?MUTED:RED}}>
                  {loading?<><IcoSpinner size={12}/> Renegociando...</>:<>{IcoAlert} Renegociar sem entrada</>}
                </button>
              ):(
                <button onClick={gerarPix} disabled={loading||!canSubmitPix} style={{...BTN1(!canSubmitPix||loading),flex:1}}>
                  {loading?<><IcoSpinner size={12}/> Gerando PIX...</>:<>{IcoRepeat} Gerar PIX da Entrada</>}
                </button>
              )}
            </>
          ):(
            <>
              <button onClick={onFechar} style={{...BTN6(),flex:1}}>Fechar</button>
              {pixCode&&<button onClick={enviarPixWpp} disabled={pixWppLoad} style={{padding:"13px 14px",borderRadius:9999,border:"none",background:pixWppOk?GRN:BLU,color:"#fff",fontWeight:800,fontSize:12,cursor:pixWppLoad?"not-allowed":"pointer",flex:1.5,whiteSpace:"nowrap",display:"flex",alignItems:"center",justifyContent:"center",gap:6,opacity:pixWppLoad?0.7:1}}>
                {pixWppLoad?<><IcoSpinner size={12}/> Enviando...</>:pixWppOk?<>{IcoCheck} Enviado!</>:<>{IcoWpp} Enviar PIX</>}
              </button>}
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function RecuperacaoModal({contrato,onConfirmar,onFechar}){
  const [valor,setValor]=useState("");
  const [data,setData]=useState(hojeStr());
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
    const res=await postAction({action:"recuperacaoAposBaixa",idContrato:contrato.ID_CONTRATO,dados:{valorPago:vRec,data,forma:"pix",observacao:obs||"Recuperação pós-baixa"}});
    if(res.ok){if(res.idUndo&&_registrarUndoAtivo)_registrarUndoAtivo({idUndo:res.idUndo,tipo:"RECUPERACAO_APOS_BAIXA",idContrato:contrato.ID_CONTRATO,nomeCliente:contrato.NOME_CLIENTE||"",segundosRestantes:900});onConfirmar();}else setMsg(res.erro||"Erro.");
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
            <input type="number" value={valor} onChange={e=>setValor(e.target.value)} onPaste={e=>pasteMoeda(e,setValor)} placeholder="0,00" style={{...IS(),fontSize:22,fontWeight:800,textAlign:"center",height:54}}/>
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
          <div>
            <span style={LS()}>Data do Recebimento</span><input type="date" value={data} onChange={e=>setData(e.target.value)} style={IS()}/>
          </div>
          <div><span style={LS()}>Observação (opcional)</span><input value={obs} onChange={e=>setObs(e.target.value)} placeholder="Ex: acordo verbal, parcela única..." style={IS()}/></div>
          {msg&&<div style={{padding:10,borderRadius:8,background:RED+"10",color:RED,fontSize:13,fontWeight:600,textAlign:"center"}}>{msg}</div>}
        </div>
        <div style={{padding:"14px 20px",borderTop:`1px solid ${BD}`,display:"flex",gap:10,flexShrink:0}}>
          <button onClick={onFechar} style={{...BTN6(),flex:1}}>Cancelar</button>
          <button onClick={confirmar} disabled={loading||vRec<=0} style={{...BTN1(loading||vRec<=0),flex:2}}>{loading?<><IcoSpinner color="#07241B"/> Registrando...</>:"Confirmar Recuperação"}</button>
        </div>
      </div>
    </div>
  );
}

function PerdaAcoesModal({contrato,parcelas,clientes,onEncerrar,onRecuperar,onAcordoAssistido,onAbatimento,onSairAcordo,onFechar}){
  const [sairLoad,setSairLoad]=useState(false);
  const [sairErr,setSairErr]=useState("");
  const cliPA=(clientes||[]).find(c=>String(c.ID_CLIENTE)===String(contrato.ID_CLIENTE))||null;
  const ps=(parcelas||[]).filter(p=>String(p.ID_CONTRATO)===String(contrato.ID_CONTRATO));
  const atrasadas=ps.filter(p=>["atrasado"].includes(String(p.STATUS||p.STATUS_PAGAMENTO||"").toLowerCase()));
  const diasAtraso=atrasadas.length>0?Math.max(...atrasadas.map(p=>{const dv=parseDate(p.DATA_VENCIMENTO);if(!dv)return 0;const d=Math.round((new Date()-dv)/86400000);return d>0?d:0;})):0;
  const emAberto=ps.filter(p=>!["pago","cancelado","baixado_como_prejuizo","quitacao_antecipada","renegociado"].includes(String(p.STATUS||p.STATUS_PAGAMENTO||"").toLowerCase())).reduce((s,p)=>s+parseFloat(p.VALOR_PARCELA||0),0);
  const st=contrato.STATUS_CONTRATO;
  const isAcordoAssistido=st==="acordo_assistido";
  const sairDoAcordo=async()=>{setSairLoad(true);setSairErr("");const r=await postAction({action:"sairDoAcordoAssistido",idContrato:contrato.ID_CONTRATO,destino:"normal"});setSairLoad(false);if(r?.ok){onSairAcordo&&onSairAcordo();}else setSairErr(r?.erro||"Erro ao sair do acordo");};
  const podeEncerrar=["em_cobranca","pre_prejuizo"].includes(st)||isAcordoAssistido;
  const podeRecuperar=["baixado_como_prejuizo","em_recuperacao","recuperado_parcialmente"].includes(st);
  const podeAcordoAssistido=["ativo_em_atraso","em_cobranca","pre_prejuizo"].includes(st);
  return(
    <div className="modal-overlay-anim" style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.5)",zIndex:450,display:"flex",alignItems:"center",justifyContent:"center",padding:20}}>
      <div className="modal-box-anim" style={{background:CARD,borderRadius:16,width:"100%",maxWidth:380,border:`1px solid ${BD}`,boxShadow:"0 24px 80px rgba(0,0,0,0.28)",overflow:"hidden",minWidth:0}}>
        <div style={{padding:"18px 20px",borderBottom:`1px solid ${BD}`}}>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:14}}>
            <div>
              <div style={{fontWeight:800,fontSize:16,letterSpacing:"-0.02em",color:TEXT}}>{contrato.ID_CONTRATO}</div>
              <div style={{fontSize:12,color:MUTED,marginTop:2}}>{contrato.NOME_CLIENTE}</div>
            </div>
            <div style={{display:"flex",gap:4,flexWrap:"wrap",alignItems:"center"}}>
              <Badge c={STATUS_COR[st]||MUTED}>{STATUS_LABEL[st]||st}</Badge>
              {cliPA?.PERFIL_COBRANCA&&<Badge c={PERFIL_COR[cliPA.PERFIL_COBRANCA]||MUTED}>{PERFIL_LABEL[cliPA.PERFIL_COBRANCA]||cliPA.PERFIL_COBRANCA}</Badge>}
            </div>
          </div>
          <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:10,background:BG,borderRadius:10,padding:"10px 12px"}}>
            <div><div style={LS()}>Capital</div><div style={{fontSize:13,fontWeight:700,color:TEXT}}>{fmtR(contrato.VALOR_PRINCIPAL)}</div></div>
            {diasAtraso>0&&<div><div style={LS()}>Dias Atraso</div><div style={{fontSize:13,fontWeight:700,color:RED}}>{diasAtraso}d</div></div>}
            {emAberto>0&&<div><div style={LS()}>Em Aberto</div><div style={{fontSize:13,fontWeight:700,color:ORG}}>{fmtR(emAberto)}</div></div>}
            {parseFloat(contrato.PREJUIZO_CAPITAL||0)>0&&<div><div style={LS()}>Prejuízo</div><div style={{fontSize:13,fontWeight:700,color:RED}}>{fmtR(contrato.PREJUIZO_CAPITAL)}</div></div>}
            {parseFloat(contrato.VALOR_RECUPERADO_APOS_BAIXA||0)>0&&<div><div style={LS()}>Recuperado</div><div style={{fontSize:13,fontWeight:700,color:PUR}}>{fmtR(contrato.VALOR_RECUPERADO_APOS_BAIXA)}</div></div>}
            {isAcordoAssistido&&parseFloat(contrato.VALOR_ABATIDO_ASSISTIDO||0)>0&&<div><div style={LS()}>Abatido</div><div style={{fontSize:13,fontWeight:700,color:BLU}}>{fmtR(parseFloat(contrato.VALOR_ABATIDO_ASSISTIDO||0))}</div></div>}
          </div>
          {isAcordoAssistido&&contrato.MOTIVO_ACORDO_ASSISTIDO&&(
            <div style={{marginTop:10,padding:"8px 10px",borderRadius:8,background:BLU+"08",border:`1px solid ${BLU}20`,fontSize:12,color:BLU}}>
              <b>Motivo:</b> {contrato.MOTIVO_ACORDO_ASSISTIDO}
              {contrato.DATA_ENTRADA_ACORDO_ASSISTIDO&&<span style={{color:MUTED}}> · desde {fmtDt(parseDate(contrato.DATA_ENTRADA_ACORDO_ASSISTIDO))}</span>}
            </div>
          )}
        </div>
        <div style={{padding:"16px 20px",display:"flex",flexDirection:"column",gap:8}}>
          {isAcordoAssistido&&<button onClick={onAbatimento} style={BTN5(BLU)}>+ Registrar Abatimento</button>}
          {isAcordoAssistido&&<button onClick={sairDoAcordo} disabled={sairLoad} style={{...BTN5(GRN),opacity:sairLoad?0.6:1}}>{sairLoad?<IcoSpinner size={12}/>:"↩"} {sairLoad?"Processando...":"Retornar à Cobrança Normal"}</button>}
          {isAcordoAssistido&&sairErr&&<div style={{fontSize:11,color:RED,fontWeight:600}}>{sairErr}</div>}
          {podeAcordoAssistido&&<button onClick={onAcordoAssistido} style={BTN5(BLU)}>{IcoHandshake} Acordo Assistido</button>}
          {podeEncerrar&&<button onClick={onEncerrar} style={BTN5(RED)}>{IcoAlert} Encerrar Contrato</button>}
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

function InfoTooltip({text}){
  const [show,setShow]=useState(false);
  const ref=useRef(null);
  const [xy,setXY]=useState({top:0,left:0});
  const enter=()=>{
    if(ref.current){const r=ref.current.getBoundingClientRect();setXY({top:r.bottom+6,left:Math.min(r.left,window.innerWidth-272)});}
    setShow(true);
  };
  return(
    <span ref={ref} onMouseEnter={enter} onMouseLeave={()=>setShow(false)} style={{display:"inline-flex",alignItems:"center",cursor:"default",marginLeft:4,flexShrink:0}}>
      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke={MUTED} strokeWidth="2" style={{display:"block"}}><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>
      {show&&<div style={{position:"fixed",top:xy.top,left:xy.left,zIndex:2000,background:"#07241B",color:"#ECEFEE",fontSize:12,lineHeight:1.55,padding:"10px 14px",borderRadius:10,maxWidth:264,boxShadow:"0 8px 32px rgba(0,0,0,0.28)",pointerEvents:"none",fontWeight:400}}>{text}</div>}
    </span>
  );
}

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
  let d=String(s||"").replace(/\D/g,"");
  if(d.length>11&&d.slice(0,2)==="55")d=d.slice(2);
  if(d.length>10&&d.charAt(0)==="0")d=d.slice(1);
  if(d.length===10)d=d.slice(0,2)+"9"+d.slice(2);
  return d;
}
function fixEmail(s){
  const v=String(s||"").toLowerCase().trim();
  return v.endsWith("@gmail.com.br")?v.slice(0,-3):v;
}
async function buscarCNPJ(cnpj){
  const d=(cnpj||"").replace(/\D/g,"");
  if(d.length!==14)return{status:"invalid"};
  try{
    const r=await fetch(`/api/utils?t=cnpj&cnpj=${d}`);
    if(r.ok){const j=await r.json();return{status:"found",razaoSocial:j.razao_social||"",nomeFantasia:j.nome_fantasia||"",situacao:(j.situacao||"").toUpperCase(),dataAbertura:j.data_abertura||"",porte:j.porte||""};}
    if(r.status===404)return{status:"not_found"};
  }catch(_){}
  return{status:"error"};
}
async function buscarCEP(cep){
  const d=(cep||"").replace(/\D/g,"");
  if(d.length!==8)return{status:"invalid"};
  try{
    const r=await fetch(`https://viacep.com.br/ws/${d}/json/`);
    if(r.ok){const j=await r.json();if(!j.erro)return{status:"found",rua:j.logradouro||"",setor:j.bairro||"",cidadeEstado:j.localidade&&j.uf?`${j.localidade}/${j.uf}`:"",ibge:j.ibge||""};
    }
  }catch(_){}
  try{
    const r2=await fetch(`https://brasilapi.com.br/api/cep/v1/${d}`);
    if(r2.ok){const j2=await r2.json();return{status:"found",rua:j2.street||"",setor:j2.neighborhood||"",cidadeEstado:j2.city&&j2.state?`${j2.city}/${j2.state}`:""};}
    if(r2.status===404)return{status:"not_found"};
  }catch(_){}
  try{
    const r3=await fetch(`https://cep.awesomeapi.com.br/json/${d}`);
    if(r3.ok){const j3=await r3.json();if(j3.city)return{status:"found",rua:j3.address||"",setor:j3.district||"",cidadeEstado:j3.city&&j3.state?`${j3.city}/${j3.state}`:"",lat:j3.lat||"",lng:j3.lng||""};}
    if(r3.status===404||r3.status===400)return{status:"not_found"};
  }catch(_){}
  return{status:"error"};
}
async function buscarCoordenadas(rua,setor,cidadeEstado){
  const partes=[rua,setor,cidadeEstado,"Brasil"].filter(Boolean);
  if(partes.length<2)return{status:"insufficient"};
  const q=encodeURIComponent(partes.join(", "));
  try{
    const r=await fetch(`https://nominatim.openstreetmap.org/search?format=json&limit=1&countrycodes=br&q=${q}`,{headers:{"Accept-Language":"pt-BR,pt;q=0.9"}});
    if(r.ok){const j=await r.json();if(j[0]?.lat)return{status:"found",lat:String(j[0].lat),lng:String(j[0].lon)};}
  }catch(_){}
  return{status:"error"};
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

function ClienteModal({cliente,contratos,parcelas,clientes,onFechar,onAtualizar,onOptimisticUpdate,onNovoContrato,onVerContrato,onSimular,abaInicial}){
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
    RENDA_BRUTA:   normMoedaSheet(cliente.RENDA_BRUTA),
    RENDA_LIQUIDA: normMoedaSheet(cliente.RENDA_LIQUIDA),
    RENDA_MENSAL:  normMoedaSheet(cliente.RENDA_MENSAL),
    TIPO_RENDA:    cliente.TIPO_RENDA||"",
    RENDA_COMPROVADA: cliente.RENDA_COMPROVADA||"",
    QUALIDADE_COMUNICACAO: cliente.QUALIDADE_COMUNICACAO||"",
    PERFIL_COBRANCA: cliente.PERFIL_COBRANCA||"",
    CODIGO_IBGE:              cliente.CODIGO_IBGE||"",
    LATITUDE:                 cliente.LATITUDE||"",
    LONGITUDE:                cliente.LONGITUDE||"",
    CNPJ_EMPREGADOR:          cliente.CNPJ_EMPREGADOR||"",
    SITUACAO_EMPREGADOR:      cliente.SITUACAO_EMPREGADOR||"",
    DATA_ABERTURA_EMPREGADOR: cliente.DATA_ABERTURA_EMPREGADOR||"",
    EMPREGADOR:    cliente.EMPREGADOR||"",
    DATA_ADMISSAO: (()=>{const d=parseDate(cliente.DATA_ADMISSAO||"");if(!d)return"";const y=d.getFullYear(),m=String(d.getMonth()+1).padStart(2,"0"),dy=String(d.getDate()).padStart(2,"0");return`${y}-${m}-${dy}`;})(),
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
  const [bloqModalOpen,setBloqModalOpen]=useState(false);
  const [desbloqLoading,setDesbloqLoading]=useState(false);
  const [bloqLocal,setBloqLocal]=useState(null);
  const isBloqueadoManual=bloqLocal?bloqLocal.blocked:String(cliente.CLIENTE_BLOQUEADO_MANUAL||"").toUpperCase()==="SIM";
  const motivoBloqueio=bloqLocal?bloqLocal.motivo:cliente.MOTIVO_BLOQUEIO_MANUAL;
  const dataBloqueio=bloqLocal?bloqLocal.data:cliente.DATA_BLOQUEIO_MANUAL;
  const desbloquearCliente=async()=>{
    if(!window.confirm(`Desbloquear ${cliente.NOME||cliente.NOME_CLIENTE||"este cliente"}? Ele voltará a poder tirar novos contratos.`))return;
    setDesbloqLoading(true);
    try{
      const res=await postAction({action:"desbloquearClienteManual",idCliente:cliente.ID_CLIENTE});
      if(res.ok){setBloqLocal({blocked:false});if(onOptimisticUpdate)onOptimisticUpdate({CLIENTE_BLOQUEADO_MANUAL:""},cliente.ID_CLIENTE);}
    }finally{setDesbloqLoading(false);}
  };
  const [cepStatus,setCepStatus]=useState(null);
  const [geoStatus,setGeoStatus]=useState(null);
  const [cnpjStatus,setCnpjStatus]=useState(null);
  const [cnpjInfo,setCnpjInfo]=useState(null);
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
  const _MONEY_FIELDS=new Set(["RENDA_BRUTA","RENDA_LIQUIDA","RENDA_MENSAL","LIMITE_CREDITO","LTV_CLIENTE","LUCRO_TOTAL","PREJUIZO_TOTAL","TOTAL_EMPRESTADO","TOTAL_PAGO","SCORE_LIMITE_SUGERIDO","SCORE_PARCELA_MAX","VALOR_ACORDO","DESCONTO_PRINCIPAL_ACORDO","DESCONTO_JUROS_ACORDO"]);
  const _PCT_FIELDS  =new Set(["ROI_CLIENTE","TAXA_ADIMPLENCIA","SCORE_TAXA_PCT","TAXA_JUROS_MENSAL","TAXA_JUROS_TOTAL"]);
  const _DATE_FIELDS =new Set(["DATA_CADASTRO","DATA_ADMISSAO","SCORE_DATA","DATA_BAIXA_PREJUIZO","DATA_ACORDO","DATA_EMPRESTIMO","DATA_PRIMEIRA_PARCELA"]);
  const fmtCampo=(k,v)=>{
    if(v===null||v===undefined||String(v).trim()==="")return"—";
    if(_DATE_FIELDS.has(k)){const d=v instanceof Date?v:parseDate(String(v));return(d&&!isNaN(d.getTime()))?fmtDt(d):String(v);}
    if(k==="DIA_VENCIMENTO_PREFERIDO"){const n=String(v);const d=parseDate(n);if(d&&!isNaN(d.getTime()))return"Dia "+d.getDate();const num=parseInt(n);return isNaN(num)?n:"Dia "+num;}
    if(_MONEY_FIELDS.has(k)){const n=parseFloat(v);return isNaN(n)?String(v):fmtR(n);}
    if(_PCT_FIELDS.has(k)){const n=parseFloat(v);return isNaN(n)?String(v):n.toFixed(2)+"%";}
    return String(v);
  };
  const campos=Object.entries(cliente||{}).filter(([_,v])=>v!==null&&v!==undefined&&String(v).trim()!=="");

  const salvar=async()=>{
    setSaving(true);setSaveMsg(null);
    const campos={...edit,STATUS_CLIENTE:"ativo",
      RENDA_BRUTA:normMoedaSheet(edit.RENDA_BRUTA),RENDA_LIQUIDA:normMoedaSheet(edit.RENDA_LIQUIDA),RENDA_MENSAL:normMoedaSheet(edit.RENDA_MENSAL),
      LIMITE_CREDITO:Math.round(parseFloat(edit.RENDA_LIQUIDA||0)*0.8)};
    if(String(cliente.STATUS_CLIENTE||"").toLowerCase()==="aguardando_conferencia"){
      const OBS_PADRAO="Cadastro via formulario - aguardando conferencia";
      if(String(campos.OBSERVACOES||"").trim().toLowerCase()===OBS_PADRAO.toLowerCase())
        campos.OBSERVACOES="";
    }
    if(cnpjInfo&&cnpjStatus==="found"){campos.SITUACAO_EMPREGADOR=cnpjInfo.situacao;campos.DATA_ABERTURA_EMPREGADOR=cnpjInfo.dataAbertura;}
    const res=await postAction({action:"atualizarCliente",idCliente:cliente.ID_CLIENTE,campos});
    if(res.ok){if(onOptimisticUpdate)onOptimisticUpdate(campos,cliente.ID_CLIENTE);if(onAtualizar)onAtualizar();}
    else setSaveMsg({ok:false,t:res.erro||"Erro ao salvar."});
    setSaving(false);
  };

  const _OBRIG=new Set(["NOME","TELEFONE_WPP","EMAIL","CPF","RG","PROFISSAO",
    "DIA_VENCIMENTO_PREFERIDO","RENDA_MENSAL","TIPO_RENDA",
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
  const _errosBase=Object.fromEntries(Object.entries(edit).map(([k,v])=>[k,validar(k,v)]).filter(([,e])=>e));
  const erros={..._errosBase,...(cepStatus==='not_found'&&!_errosBase.CEP?{CEP:"CEP não encontrado"}:{})};
  const temErros=Object.keys(erros).length>0;
  const nErros=Object.keys(erros).length;
  const mob = useIsMobile();

  return(<>
    <div className="modal-overlay-anim" style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.5)",zIndex:300,display:"flex",alignItems:"center",justifyContent:"center",padding:mob?0:20}}>
      <div className="modal-box-anim" style={{background:CARD,borderRadius:mob?0:16,width:"100%",maxWidth:mob?undefined:980,height:mob?"100dvh":"86vh",display:"flex",flexDirection:"column",overflow:"hidden",minWidth:0,boxShadow:"0 30px 90px rgba(0,0,0,0.32)",border:mob?"none":`1px solid ${BD}`}}>
        <div style={{padding:mob?"14px 16px":"18px 24px",borderBottom:`1px solid ${BD}`,display:"flex",justifyContent:"space-between",alignItems:"center",flexShrink:0}}>
          <div style={{display:"flex",alignItems:"center",gap:14}}>
            <div style={{width:40,height:40,background:GRN+"18",borderRadius:10,display:"flex",alignItems:"center",justifyContent:"center",color:GRN,fontSize:16,fontWeight:800,flexShrink:0,border:`1px solid ${GRN}28`}}>{nome[0]||"?"}</div>
            <div><h2 style={{margin:0,fontSize:mob?16:18,fontWeight:800,letterSpacing:"-0.02em",color:TEXT,display:"flex",alignItems:"center",gap:8}}>{nome}{isBloqueadoManual&&<span style={{fontSize:11,fontWeight:700,color:RED,background:RED+"12",padding:"3px 9px",borderRadius:99,whiteSpace:"nowrap",display:"inline-flex",alignItems:"center",gap:4}}>{IcoLock} BLOQUEADO</span>}</h2><div style={{fontSize:12,color:MUTED,marginTop:2}}>ID {cliente.ID_CLIENTE||"—"} · Score: {score}</div>{isBloqueadoManual&&motivoBloqueio&&<div style={{fontSize:11,color:RED,marginTop:3,fontWeight:600}}>Motivo: {motivoBloqueio}{dataBloqueio?` · ${fmtDt(dataBloqueio)}`:""}</div>}</div>
          </div>
          <div style={{display:"flex",alignItems:"center",gap:8}}>
            {onNovoContrato&&<button onClick={()=>onNovoContrato(cliente)} style={{...BTN1(false),padding:"7px 13px",fontSize:12}}>{IcoCtr} Novo Contrato</button>}
            {isBloqueadoManual
              ?<button onClick={desbloquearCliente} disabled={desbloqLoading} style={{padding:"7px 13px",fontSize:12,borderRadius:9999,border:`1px solid ${BD}`,background:"transparent",color:MUTED,cursor:desbloqLoading?"default":"pointer",fontWeight:700,display:"flex",alignItems:"center",gap:6,opacity:desbloqLoading?0.6:1}}>{desbloqLoading?<IcoSpinner color={MUTED}/>:IcoLock} Desbloquear Cliente</button>
              :<button onClick={()=>setBloqModalOpen(true)} style={{padding:"7px 13px",fontSize:12,borderRadius:9999,border:"none",background:RED,color:"#FFF",cursor:"pointer",fontWeight:700,display:"flex",alignItems:"center",gap:6}}>{IcoLock} Bloquear Cliente</button>}
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
                {l:"Empregador",v:[cliente.EMPREGADOR,cliente.CNPJ_EMPREGADOR&&`CNPJ: ${cliente.CNPJ_EMPREGADOR}`,cliente.SITUACAO_EMPREGADOR&&`Situação: ${cliente.SITUACAO_EMPREGADOR}`].filter(Boolean).join(" · ")},
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
                          ID_CLIENTE: cliente.ID_CLIENTE,
                          TELEFONE_WPP: cliente.TELEFONE_WPP,
                          TELEFONE: cliente.TELEFONE,
                          SCORE_BLOQUEADO: cliente.SCORE_BLOQUEADO,
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
                                  {onSimular&&<button onClick={()=>onSimular({valor:limiteRenov||parseFloat(base.SCORE_LIMITE_SUGERIDO||0)||1000,prazo:prazoRenov||parseInt(base.SCORE_PRAZO_MAX||0)||6,taxa:taxaRenov||parseFloat(base.SCORE_TAXA_PCT||0)||18,renda:parseFloat(cliente.RENDA_MENSAL||0)||0,parcelaMax:parseFloat(base.SCORE_PARCELA_MAX||0)||0,nome:cliente.NOME||cliente.NOME_CLIENTE||"",ID_CLIENTE:cliente.ID_CLIENTE,TELEFONE_WPP:cliente.TELEFONE_WPP,TELEFONE:cliente.TELEFONE,SCORE_BLOQUEADO:cliente.SCORE_BLOQUEADO})} style={{fontSize:11,fontWeight:700,padding:"6px 14px",borderRadius:20,border:`1px solid ${cor}40`,background:cor+"15",color:cor,cursor:"pointer",whiteSpace:"nowrap"}}>Simular Renovação</button>}
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

              {/* MÉTRICAS ANALÍTICAS */}
              {parseFloat(cliente.TOTAL_EMPRESTADO||0)>0&&(()=>{
                const ltv      = parseFloat(cliente.LTV_CLIENTE||0);
                const lucro    = parseFloat(cliente.LUCRO_TOTAL||0);
                const roi      = parseFloat(cliente.ROI_CLIENTE||0);
                const prejuizo = parseFloat(cliente.PREJUIZO_TOTAL||0);
                const taAdim   = parseFloat(cliente.TAXA_ADIMPLENCIA||0);
                const amMedio  = parseFloat(cliente.ATRASO_MEDIO||0);
                const amMax    = parseInt(cliente.ATRASO_MAXIMO||0);
                const promQueb = parseInt(cliente.PROMESSAS_QUEBRADAS||0);
                const totEmp   = parseFloat(cliente.TOTAL_EMPRESTADO||0);
                const totPago  = parseFloat(cliente.TOTAL_PAGO||0);
                const ctAtivos = parseInt(cliente.CONTRATOS_ATIVOS||0);
                const ctBaixados=parseInt(cliente.CONTRATOS_BAIXADOS||0);
                const SecTit = ({title})=><div style={{fontSize:10,fontWeight:700,color:MUTED,textTransform:"uppercase",letterSpacing:"0.06em",marginBottom:8}}>{title}</div>;
                const MetCard=({l,v,sub,c})=>(
                  <div style={{background:BG,padding:"10px 12px",borderRadius:8,border:`1px solid ${BD}`}}>
                    <div style={{fontSize:9,color:MUTED,fontWeight:700,textTransform:"uppercase",marginBottom:2}}>{l}</div>
                    <div style={{fontSize:13,fontWeight:800,color:c||TEXT}}>{v}</div>
                    {sub&&<div style={{fontSize:9,color:MUTED,marginTop:2}}>{sub}</div>}
                  </div>
                );
                return(
                  <div style={{gridColumn:"1/-1",background:CARD,padding:16,borderRadius:10,border:`1px solid ${BD}`}}>
                    <div style={{fontSize:11,fontWeight:700,color:MUTED,textTransform:"uppercase",letterSpacing:"0.06em",marginBottom:14}}>Métricas Financeiras</div>

                    <SecTit title="Receita & Resultado"/>
                    <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(130px,1fr))",gap:8,marginBottom:16}}>
                      <MetCard l="LTV" v={fmtR(ltv)} sub="juros recebidos" c={ltv>0?GRN:MUTED}/>
                      <MetCard l="Lucro Total" v={fmtR(lucro)} sub="juros + atraso" c={lucro>0?GRN:MUTED}/>
                      <MetCard l="ROI" v={roi.toFixed(1)+"%"} sub="retorno s/ capital" c={roi>=10?GRN:roi>=0?YEL:RED}/>
                      <MetCard l="Prejuízo Total" v={fmtR(prejuizo)} sub="capital perdido" c={prejuizo>0?RED:GRN}/>
                    </div>

                    <SecTit title="Comportamento de Pagamento"/>
                    <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(130px,1fr))",gap:8,marginBottom:16}}>
                      <MetCard l="Adimplência" v={taAdim.toFixed(0)+"%"} sub="parcelas em dia" c={taAdim>=80?GRN:taAdim>=50?YEL:RED}/>
                      <MetCard l="Atraso Médio" v={amMedio.toFixed(0)+" dias"} sub="média por pagamento" c={amMedio<=5?GRN:amMedio<=15?YEL:RED}/>
                      <MetCard l="Atraso Máximo" v={amMax+" dias"} sub="maior atraso" c={amMax<=15?GRN:amMax<=30?YEL:RED}/>
                      <MetCard l="Promessas Quebradas" v={promQueb} sub="acordos não cumpridos" c={promQueb===0?GRN:promQueb<=2?YEL:RED}/>
                    </div>

                    <SecTit title="Histórico Geral"/>
                    <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(130px,1fr))",gap:8}}>
                      <MetCard l="Total Emprestado" v={fmtR(totEmp)} sub="capital histórico"/>
                      <MetCard l="Total Pago" v={fmtR(totPago)} sub="valor recebido"/>
                      <MetCard l="Contratos Ativos" v={ctAtivos} sub="em aberto" c={ctAtivos>0?BLU:MUTED}/>
                      <MetCard l="Contratos Baixados" v={ctBaixados} sub="como prejuízo" c={ctBaixados>0?RED:GRN}/>
                    </div>
                  </div>
                );
              })()}
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
                <div>
                  <span style={LS()}>Limite de Crédito (R$)</span>
                  <div style={{...IS(),background:BG,display:"flex",alignItems:"center",justifyContent:"space-between",cursor:"default"}}>
                    <span style={{fontWeight:700}}>{fmtR(Math.round(parseFloat(edit.RENDA_LIQUIDA||0)*0.8))}</span>
                    <span style={{fontSize:10,color:MUTED,fontWeight:600}}>80% da Renda Líquida</span>
                  </div>
                </div>
                <CampoEdit edit={edit} setEdit={setEdit} erros={erros} label="Renda Bruta (R$)" field="RENDA_BRUTA" tipo="number" moeda/>
                <CampoEdit edit={edit} setEdit={setEdit} erros={erros} label="Renda Líquida (R$)" field="RENDA_LIQUIDA" tipo="number" moeda/>
                <div>
                  <CampoEdit edit={edit} setEdit={setEdit} erros={erros} label="Renda Mensal Operacional (R$)" field="RENDA_MENSAL" tipo="number" moeda/>
                  <div style={{fontSize:10,color:MUTED,marginTop:3}}>Usado no score e limite de crédito</div>
                </div>
                <CampoEdit edit={edit} setEdit={setEdit} erros={erros} label="Tipo de Renda" field="TIPO_RENDA" opts={[{v:"",l:"—"},{v:"CLT",l:"CLT"},{v:"Servidor",l:"Servidor Público"},{v:"Aposentado",l:"Aposentado"},{v:"Pensionista",l:"Pensionista"},{v:"Autonomo",l:"Autônomo"},{v:"Informal",l:"Informal"}]}/>
                <CampoEdit edit={edit} setEdit={setEdit} erros={erros} label="Renda Comprovada" field="RENDA_COMPROVADA" opts={[{v:"",l:"—"},{v:"Sim",l:"Sim"},{v:"Parcial",l:"Parcial"},{v:"Nao",l:"Não"}]}/>
                <CampoEdit edit={edit} setEdit={setEdit} erros={erros} label="Qualidade da Comunicação" field="QUALIDADE_COMUNICACAO" opts={[{v:"",l:"—"},{v:"Boa",l:"Boa"},{v:"Regular",l:"Regular"},{v:"Ruim",l:"Ruim"}]}/>
                <CampoEdit edit={edit} setEdit={setEdit} erros={erros} label="Perfil de Cobrança" field="PERFIL_COBRANCA" opts={[{v:"",l:"—"},{v:"COOPERATIVO",l:"Cooperativo"},{v:"NEUTRO",l:"Neutro"},{v:"RESISTENTE",l:"Resistente"},{v:"EVASIVO",l:"Evasivo"}]}/>
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
                <div style={{fontSize:11,fontWeight:700,color:MUTED,textTransform:"uppercase",marginBottom:12}}>Empregador</div>
                <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:14}}>
                  <CampoEdit edit={edit} setEdit={setEdit} erros={erros} label="Empresa / Empregador" field="EMPREGADOR" fixup={titleCasePT}/>
                  <CampoEdit edit={edit} setEdit={setEdit} erros={erros} label="Data de Admissão" field="DATA_ADMISSAO" tipo="date"/>
                  <div style={{gridColumn:"1/-1"}}>
                    <span style={LS()}>CNPJ do Empregador</span>
                    <div style={{position:"relative"}}>
                      <input value={edit.CNPJ_EMPREGADOR||""} onChange={e=>{setEdit(p=>({...p,CNPJ_EMPREGADOR:e.target.value}));setCnpjStatus(null);setCnpjInfo(null);}} onBlur={async e=>{const d=(e.target.value||"").replace(/\D/g,"");if(d.length!==14){setCnpjStatus(null);setCnpjInfo(null);return;}setCnpjStatus("loading");const res=await buscarCNPJ(e.target.value);if(res.status==="found"){setCnpjStatus("found");setCnpjInfo(res);if(!String(edit.EMPREGADOR||"").trim())setEdit(p=>({...p,EMPREGADOR:res.nomeFantasia||res.razaoSocial}));}else{setCnpjStatus(res.status);setCnpjInfo(null);}}} style={{...IS(),border:`1px solid ${cnpjStatus==="not_found"?RED:cnpjStatus==="found"?GRN:BD}`,background:cnpjStatus==="not_found"?RED+"06":CARD}}/>
                      {cnpjStatus==="loading"&&<div style={{position:"absolute",right:10,top:"50%",transform:"translateY(-50%)"}}><IcoSpinner color={MUTED}/></div>}
                      {cnpjStatus==="found"&&<div style={{position:"absolute",right:10,top:"50%",transform:"translateY(-50%)",color:GRN,fontSize:12,fontWeight:800}}>✓</div>}
                    </div>
                    {cnpjStatus==="not_found"&&<div style={{fontSize:10,color:RED,fontWeight:600,marginTop:3}}>⚠ CNPJ não encontrado na Receita Federal</div>}
                    {cnpjStatus==="error"&&<div style={{fontSize:10,color:YEL,fontWeight:600,marginTop:3}}>⚠ Não foi possível verificar o CNPJ</div>}
                  </div>
                </div>
                {cnpjInfo&&cnpjStatus==="found"&&(
                  <div style={{marginTop:12,padding:"10px 14px",borderRadius:10,background:cnpjInfo.situacao==="ATIVA"?GRN+"08":RED+"08",border:`1px solid ${cnpjInfo.situacao==="ATIVA"?GRN+"25":RED+"25"}`}}>
                    <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:4}}>
                      <span style={{fontSize:11,fontWeight:800,color:cnpjInfo.situacao==="ATIVA"?GRN:RED,background:cnpjInfo.situacao==="ATIVA"?GRN+"15":RED+"15",padding:"2px 8px",borderRadius:99,border:`1px solid ${cnpjInfo.situacao==="ATIVA"?GRN+"30":RED+"30"}`}}>{cnpjInfo.situacao||"—"}</span>
                      {cnpjInfo.situacao!=="ATIVA"&&<span style={{fontSize:11,fontWeight:700,color:RED}}>⚠ Empresa não ativa — verificar antes de aprovar crédito</span>}
                    </div>
                    <div style={{fontSize:12,fontWeight:700,color:TEXT}}>{cnpjInfo.razaoSocial}</div>
                    {cnpjInfo.nomeFantasia&&cnpjInfo.nomeFantasia!==cnpjInfo.razaoSocial&&<div style={{fontSize:11,color:MUTED}}>{cnpjInfo.nomeFantasia}</div>}
                    <div style={{fontSize:11,color:MUTED,marginTop:4,display:"flex",gap:16,flexWrap:"wrap"}}>
                      {cnpjInfo.dataAbertura&&<span>Abertura: {fmtDt(cnpjInfo.dataAbertura)}</span>}
                      {cnpjInfo.porte&&<span>Porte: {cnpjInfo.porte}</span>}
                    </div>
                  </div>
                )}
              </div>
              <div style={{borderTop:`1px solid ${BD}`,paddingTop:16}}>
                <div style={{fontSize:11,fontWeight:700,color:MUTED,textTransform:"uppercase",marginBottom:12}}>Endereço</div>
                <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:14}}>
                  <div>
                    <span style={LS()}>CEP</span>
                    <div style={{position:"relative"}}>
                      <input value={edit.CEP||""} onChange={e=>{setEdit(p=>({...p,CEP:e.target.value}));setCepStatus(null);setGeoStatus(null);}} onBlur={async e=>{const d=(e.target.value||"").replace(/\D/g,"");if(d.length!==8){setCepStatus(null);return;}setCepStatus("loading");const res=await buscarCEP(e.target.value);if(res.status==="found"){setCepStatus("found");setEdit(p=>({...p,RUA:res.rua||p.RUA,SETOR:res.setor||p.SETOR,CIDADE_ESTADO:res.cidadeEstado||p.CIDADE_ESTADO,CODIGO_IBGE:res.ibge||p.CODIGO_IBGE}));if(res.lat&&res.lng){setEdit(p=>({...p,LATITUDE:res.lat,LONGITUDE:res.lng}));setGeoStatus("found");}else{setGeoStatus("loading");buscarCoordenadas(res.rua,res.setor,res.cidadeEstado).then(g=>{if(g.status==="found"){setEdit(p=>({...p,LATITUDE:g.lat,LONGITUDE:g.lng}));setGeoStatus("found");}else setGeoStatus(null);});}}else setCepStatus(res.status);}} style={{...IS(),border:`1px solid ${erros.CEP?RED:cepStatus==="found"?GRN:BD}`,background:erros.CEP?RED+"06":CARD}}/>
                      {cepStatus==="loading"&&<div style={{position:"absolute",right:10,top:"50%",transform:"translateY(-50%)"}}><IcoSpinner color={MUTED}/></div>}
                      {cepStatus==="found"&&!erros.CEP&&<div style={{position:"absolute",right:10,top:"50%",transform:"translateY(-50%)",color:GRN,fontSize:12,fontWeight:800}}>✓</div>}
                    </div>
                    {erros.CEP&&<div style={{fontSize:10,color:RED,fontWeight:600,marginTop:3}}>⚠ {erros.CEP}</div>}
                    {cepStatus==="found"&&!erros.CEP&&<div style={{fontSize:10,color:GRN,fontWeight:600,marginTop:3,display:"flex",alignItems:"center",gap:6}}>✓ Endereço preenchido{geoStatus==="loading"&&<IcoSpinner color={MUTED}/>}{geoStatus==="found"&&<span style={{color:MUTED}}>· 📍 Geolocalizado</span>}</div>}
                    {cepStatus==="error"&&<div style={{fontSize:10,color:YEL,fontWeight:600,marginTop:3}}>⚠ Não foi possível verificar o CEP</div>}
                  </div>
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
            </div>
          )}
          {t==="todos os dados"&&(
            <div style={{display:"grid",gridTemplateColumns:"repeat(2,1fr)",gap:12}}>{campos.map(([k,v])=><div key={k} style={{background:CARD,padding:13,borderRadius:10,border:`1px solid ${BD}`}}><span style={LS()}>{label(k)}</span><div style={{fontSize:13,fontWeight:600,wordBreak:"break-word"}}>{fmtCampo(k,v)}</div></div>)}</div>
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
                      <div style={{fontSize:11,color:MUTED}}>{c.TOTAL_PARCELAS||c.NUM_PARCELAS||ps.length}x · {pagas}/{ps.length} pagas · desde {fmtDt(c.DATA_EMPRESTIMO)}</div>
                    </div>
                    {onVerContrato&&<button onClick={()=>onVerContrato(c)} style={{padding:"9px 16px",borderRadius:8,border:`1px solid ${BD}`,background:BG,color:TEXT,fontWeight:700,fontSize:12,cursor:"pointer",whiteSpace:"nowrap",flexShrink:0}}>Abrir →</button>}
                  </div>
                );
              })}
            </div>
          )}
        </div>
        {t==="editar"&&(
          <div style={{flexShrink:0,padding:"14px 20px",borderTop:`1px solid ${BD}`,background:CARD,display:"flex",flexDirection:"column",gap:10}}>
            {saveMsg&&<div style={{padding:"10px 14px",borderRadius:8,background:saveMsg.ok?GRN+"10":RED+"10",color:saveMsg.ok?GRN:RED,fontSize:13,fontWeight:700,border:`1px solid ${saveMsg.ok?GRN:RED}25`}}>{saveMsg.t}</div>}
            {temErros&&<div style={{padding:"10px 14px",borderRadius:8,background:RED+"10",color:RED,fontSize:12,fontWeight:700,border:`1px solid ${RED}25`}}>{nErros} campo{nErros>1?"s":""} com erro ou não preenchido{nErros>1?"s":""} — corrija antes de salvar.</div>}
            <button onClick={salvar} disabled={saving||temErros} style={BTN1(saving||temErros)}>
              {saving?<><IcoSpinner color="#07241B"/> Salvando...</>:<>{IcoCheck} Salvar e Ativar Cliente</>}
            </button>
          </div>
        )}
      </div>
    </div>
    {bloqModalOpen&&<BloquearClienteModal cliente={cliente} onFechar={()=>setBloqModalOpen(false)} onSucesso={(motivo)=>{const dataAgora=new Date().toISOString();setBloqLocal({blocked:true,motivo,data:dataAgora});if(onOptimisticUpdate)onOptimisticUpdate({CLIENTE_BLOQUEADO_MANUAL:"SIM",MOTIVO_BLOQUEIO_MANUAL:motivo,DATA_BLOQUEIO_MANUAL:dataAgora},cliente.ID_CLIENTE);}}/>}
  </>);
}

function PagamentoDrop({contratos,parcelas,clientes,onSucesso,onSelecionarParcela}){
  const [busca,setBusca]=useState("");const [showDrop,setShowDrop]=useState(false);const [cliente,setCliente]=useState(null);const [parcela,setParcela]=useState(null);const [tipo,setTipo]=useState(null);const [data,setData]=useState(hojeStr());const [valor,setValor]=useState("");const [desconto,setDesconto]=useState(0);const [loading,setLoading]=useState(false);const [msg,setMsg]=useState(null);const ref=useRef();
  const [abatValor,setAbatValor]=useState("");const [abatObs,setAbatObs]=useState("");const [modoAtivo,setModoAtivo]=useState("pagamento");
  const [sjPixLoadD,setSjPixLoadD]=useState(false);const [sjPixCodeD,setSjPixCodeD]=useState("");const [sjPixErrD,setSjPixErrD]=useState("");const [sjPixCopiedD,setSjPixCopiedD]=useState(false);const [sjPixWppLoadD,setSjPixWppLoadD]=useState(false);const [sjPixWppOkD,setSjPixWppOkD]=useState(false);
  useEffect(()=>{const h=e=>{if(ref.current&&!ref.current.contains(e.target))setShowDrop(false);};document.addEventListener("mousedown",h);return()=>document.removeEventListener("mousedown",h);},[]);
  const clis=useMemo(()=>{if(busca.length<2)return[];const ids=new Set();return (contratos||[]).filter(c=>{if(!_ST_ATIVOS.has(String(c.STATUS_CONTRATO||"").toLowerCase()))return false;const m=(c.NOME_CLIENTE||"").toLowerCase().includes(busca.toLowerCase())||String(c.ID_CLIENTE||"").toLowerCase().includes(busca.toLowerCase());if(m&&!ids.has(c.ID_CLIENTE)){ids.add(c.ID_CLIENTE);return true;}return false;}).slice(0,6);},[busca,contratos]);
  const pars=useMemo(()=>cliente?(parcelas||[]).filter(p=>String(p.ID_CLIENTE)===String(cliente.ID_CLIENTE)&&["pendente","atrasado","vence_hoje"].includes(p.STATUS)&&(()=>{const ctr=(contratos||[]).find(c=>String(c.ID_CONTRATO)===String(p.ID_CONTRATO));return ctr?.STATUS_CONTRATO!=="acordo_assistido";})()).sort((a,b)=>toNum(a.DATA_VENCIMENTO)-toNum(b.DATA_VENCIMENTO)):[],[cliente,parcelas,contratos]);
  const ctrsAssist=useMemo(()=>cliente?(contratos||[]).filter(c=>String(c.ID_CLIENTE)===String(cliente.ID_CLIENTE)&&c.STATUS_CONTRATO==="acordo_assistido"):[],[cliente,contratos]);
  const [ctrAssistSel,setCtrAssistSel]=useState(null);
  useEffect(()=>{if(ctrsAssist.length>0){setCtrAssistSel(ctrsAssist[0]);if(pars.length===0)setModoAtivo("abatimento");}else{setModoAtivo("pagamento");}setCtrAssistSel(ctrsAssist[0]||null);},[ctrsAssist.length,pars.length]);
  const changeTipoDrop=(t,p)=>{const parc=p||parcela;setTipo(t);setDesconto(0);setSjPixCodeD("");setSjPixErrD("");setSjPixCopiedD(false);setSjPixWppOkD(false);if(t==="total")setValor(parseFloat(parc?.VALOR_PARCELA||0).toFixed(2));else if(t==="parcial"){const fee=Math.round(parseFloat(parc?.VALOR_PRINCIPAL||0)*0.05*100)/100;setValor((parseFloat(parc?.VALOR_JUROS||0)+fee).toFixed(2));}};
  const changeDescontoDrop=(v)=>{const juros=parseFloat(parcela?.VALOR_JUROS||0);const principal=parseFloat(parcela?.VALOR_PRINCIPAL||0);const d=Math.min(Math.max(parseFloat(v)||0,0),juros);setDesconto(d);setValor((principal+Math.max(0,juros-d)).toFixed(2));};
  const gerarPixSJDrop=async()=>{if(!parcela||sjPixLoadD)return;setSjPixLoadD(true);setSjPixErrD("");setSjPixCodeD("");const fee=Math.round(parseFloat(parcela.VALOR_PRINCIPAL||0)*0.05*100)/100;const sjValor=parseFloat(parcela.VALOR_JUROS||0)+fee;const cliInfo=(clientes||[]).find(c=>String(c.ID_CLIENTE)===String(parcela.ID_CLIENTE));const cpf=String(cliInfo?.CPF||"").replace(/\D/g,"").padStart(11,"0");try{const r=await fetch("/api/efi-charges",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({idContrato:parcela.ID_CONTRATO,parcelas:[{idParcela:parcela.ID_PARCELA,numParcela:parseInt(parcela.NUM_PARCELA||0),totalParcelas:parseInt(parcela.TOTAL_PARCELAS||0),dataVencimento:parcela.DATA_VENCIMENTO,valorParcela:sjValor}],cliente:{nome:cliInfo?.NOME||cliInfo?.NOME_CLIENTE||parcela.NOME_CLIENTE||"",cpf},isSJ:true})});const d=await r.json();if(d.ok&&d.boletos?.[0]?.ok)setSjPixCodeD(d.boletos[0].pixCopiaECola||"");else setSjPixErrD((d.boletos?.[0]?.erro)||d.erro||"Erro ao gerar PIX SJ");}catch(e){setSjPixErrD(e.message);}setSjPixLoadD(false);};
  const enviarSjPixWppDrop=async()=>{if(!sjPixCodeD||sjPixWppLoadD||!parcela)return;setSjPixWppLoadD(true);const fee=Math.round(parseFloat(parcela.VALOR_PRINCIPAL||0)*0.05*100)/100;const sjValor=parseFloat(parcela.VALOR_JUROS||0)+fee;const cliInfo=(clientes||[]).find(c=>String(c.ID_CLIENTE)===String(parcela.ID_CLIENTE));const res=await postAction({action:"enviarPixManual",idCliente:parcela.ID_CLIENTE||"",idContrato:parcela.ID_CONTRATO||"",idParcela:parcela.ID_PARCELA||"",nome:parcela.NOME_CLIENTE||"",telefone:cliInfo?.TELEFONE_WPP||cliInfo?.TELEFONE||"",numParcela:parseInt(parcela.NUM_PARCELA||0),totalParcelas:parseInt(parcela.TOTAL_PARCELAS||0),valorParcela:sjValor,dataVencimento:parcela.DATA_VENCIMENTO||"",pixCode:sjPixCodeD});if(res.ok){setSjPixWppOkD(true);setTimeout(()=>setSjPixWppOkD(false),3000);}setSjPixWppLoadD(false);};
  const registrar=async()=>{if(!parcela||!valor||!data)return;setLoading(true);setMsg(null);const res=await postAction({action:tipo==="parcial"?"pagamentoParcial":"pagamento",idParcela:parcela.ID_PARCELA||"",idContrato:parcela.ID_CONTRATO||"",numParcela:parcela.NUM_PARCELA||"",valor:parseFloat(valor),data:apiDateStr(data),forma:"pix",...(desconto>0&&{desconto})});if(res.ok){if(res.idUndo&&_registrarUndoAtivo)_registrarUndoAtivo({idUndo:res.idUndo,tipo:tipo==="parcial"?"SOMENTE_JUROS":"PAGAMENTO_NORMAL",idContrato:parcela.ID_CONTRATO||"",nomeCliente:cliente?.NOME_CLIENTE||"",segundosRestantes:900});setMsg({ok:true,t:res.msg||(res.contratoQuitado?`✓ Contrato quitado — ${(parcela.NOME_CLIENTE||"").split(" ")[0]}`:`✓ Parcela ${parcela.NUM_PARCELA} · ${fmtR(parseFloat(valor))}`)});gerarEEnviarComprovante(parcela,parseFloat(valor),data,tipo==="parcial"?"Somente Juros":"Pagamento Total",parcelas,contratos,clientes);setTimeout(()=>onSucesso(res,parcela),1500);}else setMsg({ok:false,t:res.erro||"Erro"});setLoading(false);};
  const registrarAbatimento=async()=>{const ctr=ctrAssistSel;if(!ctr||!abatValor||!data)return;setLoading(true);setMsg(null);const res=await postAction({action:"registrarAbatimentoAssistido",idContrato:ctr.ID_CONTRATO,dados:{valor:parseFloat(abatValor),data:apiDateStr(data),forma:"pix",observacao:abatObs}});if(res.ok){if(res.idUndo&&_registrarUndoAtivo)_registrarUndoAtivo({idUndo:res.idUndo,tipo:"ABATIMENTO_ASSISTIDO",idContrato:ctr.ID_CONTRATO,nomeCliente:ctr.NOME_CLIENTE||"",segundosRestantes:900});setMsg({ok:true,t:"Abatimento registrado!"});setTimeout(()=>onSucesso(res,null),1500);}else setMsg({ok:false,t:res.erro||"Erro"});setLoading(false);};
  const [showParsDrop,setShowParsDrop]=useState(false);
  const selecionarParcela=p=>{if(!p)return;setShowParsDrop(false);if(onSelecionarParcela){setParcela(null);setTipo(null);setValor("");setDesconto(0);onSelecionarParcela(p);return;}setParcela(p);setTipo("total");setDesconto(0);setValor(parseFloat(p.VALOR_PARCELA||0).toFixed(2));setSjPixLoadD(false);setSjPixCodeD("");setSjPixErrD("");setSjPixCopiedD(false);setSjPixWppLoadD(false);setSjPixWppOkD(false);};
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
        {/* Toggle quando cliente tem acordo assistido + parcelas normais */}
        {cliente&&ctrsAssist.length>0&&pars.length>0&&(
          <div style={{display:"flex",gap:0,background:BG,borderRadius:8,padding:2,border:`1px solid ${BD}`}}>
            {[["pagamento","Pagamento Normal"],["abatimento","Abatimento"]].map(([id,lbl])=>(
              <button key={id} onClick={()=>setModoAtivo(id)} style={{flex:1,padding:"6px 8px",borderRadius:6,border:"none",background:modoAtivo===id?CARD:"transparent",color:modoAtivo===id?(id==="abatimento"?BLU:GRN):MUTED,fontSize:12,fontWeight:700,cursor:"pointer"}}>{lbl}</button>
            ))}
          </div>
        )}
        {/* Modo Pagamento Normal */}
        {cliente&&modoAtivo==="pagamento"&&<div><span style={LS()}>Parcela</span>{pars.length>0?(
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
        {modoAtivo==="pagamento"&&parcela&&<div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10}}>
          <div><span style={LS()}>Tipo</span><select value={tipo||""} onChange={e=>changeTipoDrop(e.target.value)} style={IS()}><option value="">Selecione...</option><option value="total">Total</option><option value="parcial">Somente Juros</option></select></div>
          <div><span style={LS()}>Valor</span><input type="number" value={valor} onChange={e=>setValor(e.target.value)} onPaste={e=>pasteMoeda(e,setValor)} style={IS()}/></div>
          {tipo==="total"&&parseFloat(parcela?.VALOR_JUROS||0)>0&&<div style={{gridColumn:"1/-1"}}>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:4}}><span style={LS()}>Desconto nos Juros (R$)</span><span style={{fontSize:10,color:MUTED,fontWeight:600}}>máx {fmtR(parseFloat(parcela?.VALOR_JUROS||0))}</span></div>
            <input type="number" value={desconto||""} onChange={e=>changeDescontoDrop(e.target.value)} onPaste={e=>pasteMoeda(e,changeDescontoDrop)} placeholder="0,00" min="0" max={parseFloat(parcela?.VALOR_JUROS||0)} style={{...IS(),color:desconto>0?GRN:TEXT}}/>
            {desconto>0&&<div style={{marginTop:4,fontSize:11,color:GRN,fontWeight:600}}>Cliente paga {fmtR(parseFloat(parcela?.VALOR_PRINCIPAL||0))} + {fmtR(Math.max(0,parseFloat(parcela?.VALOR_JUROS||0)-desconto))} de juros</div>}
          </div>}
          {tipo==="parcial"&&parcela&&<div style={{gridColumn:"1/-1",background:ORG+"08",border:`1px solid ${ORG}25`,borderRadius:10,padding:"12px 14px",display:"flex",flexDirection:"column",gap:10}}>
            <div style={{fontSize:12,fontWeight:700,color:ORG}}>PIX Somente Juros · {fmtR(parseFloat(parcela.VALOR_JUROS||0)+Math.round(parseFloat(parcela.VALOR_PRINCIPAL||0)*0.05*100)/100)}</div>
            {!sjPixCodeD?(
              <button onClick={gerarPixSJDrop} disabled={sjPixLoadD} style={{padding:"8px",borderRadius:9,border:`1px solid ${ORG}`,background:"transparent",color:ORG,fontWeight:700,fontSize:12,cursor:sjPixLoadD?"default":"pointer",opacity:sjPixLoadD?0.6:1,display:"flex",alignItems:"center",justifyContent:"center",gap:5}}>
                {sjPixLoadD?<><IcoSpinner color={ORG}/> Gerando...</>:"Gerar PIX SJ"}
              </button>
            ):(
              <div style={{display:"flex",flexDirection:"column",gap:8}}>
                <div style={{background:BG,borderRadius:7,padding:"8px 10px",fontSize:10,color:MUTED,fontFamily:"monospace",wordBreak:"break-all"}}>{sjPixCodeD}</div>
                <div style={{display:"flex",gap:8}}>
                  <button onClick={()=>{navigator.clipboard.writeText(sjPixCodeD);setSjPixCopiedD(true);setTimeout(()=>setSjPixCopiedD(false),2000);}} style={{flex:1,padding:"7px",borderRadius:8,border:`1px solid ${BD}`,background:CARD,color:TEXT,fontWeight:600,fontSize:12,cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center"}}>
                    {sjPixCopiedD?"Copiado!":"Copiar PIX"}
                  </button>
                  <button onClick={enviarSjPixWppDrop} disabled={sjPixWppLoadD} style={{flex:1,padding:"7px",borderRadius:8,border:"none",background:sjPixWppOkD?"#16a34a":"#25D366",color:"#FFF",fontWeight:700,fontSize:12,cursor:sjPixWppLoadD?"default":"pointer",opacity:sjPixWppLoadD?0.6:1,display:"flex",alignItems:"center",justifyContent:"center",gap:5}}>
                    {sjPixWppLoadD?<><IcoSpinner color="#FFF"/> Enviando...</>:sjPixWppOkD?"Enviado!":"Enviar WPP"}
                  </button>
                </div>
              </div>
            )}
            {sjPixErrD&&<div style={{fontSize:11,color:RED,fontWeight:600}}>{sjPixErrD}</div>}
          </div>}
          <div style={{gridColumn:"1/-1"}}><span style={LS()}>Data</span><input type="date" value={data} onChange={e=>setData(e.target.value)} style={IS()}/></div>
          <button onClick={registrar} disabled={loading||!tipo} style={{gridColumn:"1/-1",padding:"11px",borderRadius:12,border:"none",background:ACC,color:"#07241B",fontWeight:700,cursor:"pointer",opacity:loading||!tipo?0.6:1}}>{loading?"Processando...":"Confirmar"}</button>
        </div>}
        {/* Modo Abatimento */}
        {cliente&&modoAtivo==="abatimento"&&ctrAssistSel&&(
          <div style={{display:"flex",flexDirection:"column",gap:10}}>
            {ctrsAssist.length>1&&<div><span style={LS()}>Contrato</span><select value={ctrAssistSel.ID_CONTRATO} onChange={e=>setCtrAssistSel(ctrsAssist.find(c=>c.ID_CONTRATO===e.target.value))} style={IS()}>
              {ctrsAssist.map(c=><option key={c.ID_CONTRATO} value={c.ID_CONTRATO}>{c.ID_CONTRATO} — {fmtR(c.VALOR_PRINCIPAL)}</option>)}
            </select></div>}
            {(()=>{const _abat=parseFloat(ctrAssistSel.VALOR_ABATIDO_ASSISTIDO||0);const _princ=parseFloat(ctrAssistSel.VALOR_PRINCIPAL||0);const _rest=Math.max(0,_princ-_abat);const _vlN=parseFloat(String(abatValor).replace(",","."))||0;return(
            <div style={{padding:"10px 12px",borderRadius:8,background:BLU+"08",border:`1px solid ${BLU}20`,fontSize:12,color:MUTED}}>
              <div style={{display:"flex",justifyContent:"space-between",marginBottom:4}}><span>Contrato</span><span style={{fontWeight:700,color:TEXT}}>{ctrAssistSel.ID_CONTRATO}</span></div>
              {ctrAssistSel.MOTIVO_ACORDO_ASSISTIDO&&<div style={{display:"flex",justifyContent:"space-between",marginBottom:4}}><span>Motivo</span><span style={{fontWeight:600,color:BLU}}>{ctrAssistSel.MOTIVO_ACORDO_ASSISTIDO}</span></div>}
              <div style={{display:"flex",justifyContent:"space-between",marginBottom:4}}><span>Capital emprestado</span><span style={{fontWeight:700,color:TEXT}}>{fmtR(_princ)}</span></div>
              <div style={{display:"flex",justifyContent:"space-between",marginBottom:4}}><span>Já recuperado</span><span style={{fontWeight:700,color:BLU}}>{fmtR(_abat)}</span></div>
              <div style={{display:"flex",justifyContent:"space-between",paddingTop:4,borderTop:`1px solid ${BLU}20`}}><span>Capital restante</span><span style={{fontWeight:800,color:_rest>0?RED:GRN}}>{fmtR(_rest)}</span></div>
              {_vlN>0&&<div style={{marginTop:6,paddingTop:6,borderTop:`1px solid ${BLU}20`,color:BLU,fontWeight:700}}>Após este abatimento: {fmtR(Math.max(0,_rest-_vlN))}</div>}
            </div>
            );})()}
            <div><span style={LS()}>Valor do abatimento (R$)</span><input type="number" value={abatValor} onChange={e=>setAbatValor(e.target.value)} onPaste={e=>pasteMoeda(e,setAbatValor)} placeholder="0,00" min="0" style={IS()}/></div>
            <div>
              <span style={LS()}>Data</span><input type="date" value={data} onChange={e=>setData(e.target.value)} style={IS()}/>
            </div>
            <div><span style={LS()}>Observação (opcional)</span><input value={abatObs} onChange={e=>setAbatObs(e.target.value)} placeholder="Ex: Pix de R$200 — restante promete em 10 dias" style={IS()}/></div>
            <button onClick={registrarAbatimento} disabled={loading||!abatValor||parseFloat(abatValor)<=0} style={{padding:"11px",borderRadius:12,border:"none",background:BLU,color:"#FFF",fontWeight:700,cursor:"pointer",opacity:loading||!abatValor||parseFloat(abatValor)<=0?0.6:1}}>{loading?<><IcoSpinner color="#fff"/> Registrando...</>:"Confirmar Abatimento"}</button>
          </div>
        )}
        {msg&&<div style={{padding:10,borderRadius:8,background:msg.ok?GRN+"10":RED+"10",color:msg.ok?GRN:RED,fontSize:12,textAlign:"center",fontWeight:600}}>{msg.t}</div>}
      </div>
    </div>
  );
}

function PagamentoParcelaModal({parcela,parcelas,contratos,clientes,onConfirmar,onFechar,initialModo="pagamento"}){
  const [tipo,setTipo]=useState("total");
  const [data,setData]=useState(hojeStr());
  const [valor,setValor]=useState(parseFloat(parcela?.VALOR_PARCELA||0).toFixed(2));
  const [desconto,setDesconto]=useState(0);
  const [loading,setLoading]=useState(false);
  const [msg,setMsg]=useState(null);
  const [modo,setModo]=useState(initialModo); // "pagamento" | "reagendar"
  const [promData,setPromData]=useState("");
  const [promObs,setPromObs]=useState("");
  const [comprovanteData,setComprovanteData]=useState(null);
  const [sjPixLoadP,setSjPixLoadP]=useState(false);const [sjPixCodeP,setSjPixCodeP]=useState("");const [sjPixErrP,setSjPixErrP]=useState("");const [sjPixCopiedP,setSjPixCopiedP]=useState(false);const [sjPixWppLoadP,setSjPixWppLoadP]=useState(false);const [sjPixWppOkP,setSjPixWppOkP]=useState(false);
  const resRef=useRef(null);

  const changeTipoPPM=(t)=>{setTipo(t);setDesconto(0);setSjPixCodeP("");setSjPixErrP("");setSjPixCopiedP(false);setSjPixWppOkP(false);if(t==="total")setValor(parseFloat(parcela?.VALOR_PARCELA||0).toFixed(2));else{const fee=Math.round(parseFloat(parcela?.VALOR_PRINCIPAL||0)*0.05*100)/100;setValor((parseFloat(parcela?.VALOR_JUROS||0)+fee).toFixed(2));}};
  const changeDescontoPPM=(v)=>{const juros=parseFloat(parcela?.VALOR_JUROS||0);const principal=parseFloat(parcela?.VALOR_PRINCIPAL||0);const d=Math.min(Math.max(parseFloat(v)||0,0),juros);setDesconto(d);setValor((principal+Math.max(0,juros-d)).toFixed(2));};
  const gerarPixSJP=async()=>{if(!parcela||sjPixLoadP)return;setSjPixLoadP(true);setSjPixErrP("");setSjPixCodeP("");const fee=Math.round(parseFloat(parcela.VALOR_PRINCIPAL||0)*0.05*100)/100;const sjValor=parseFloat(parcela.VALOR_JUROS||0)+fee;const cliInfo=(clientes||[]).find(c=>String(c.ID_CLIENTE)===String(parcela.ID_CLIENTE));const cpf=String(cliInfo?.CPF||"").replace(/\D/g,"").padStart(11,"0");try{const r=await fetch("/api/efi-charges",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({idContrato:parcela.ID_CONTRATO,parcelas:[{idParcela:parcela.ID_PARCELA,numParcela:parseInt(parcela.NUM_PARCELA||0),totalParcelas:parseInt(parcela.TOTAL_PARCELAS||0),dataVencimento:parcela.DATA_VENCIMENTO,valorParcela:sjValor}],cliente:{nome:cliInfo?.NOME||cliInfo?.NOME_CLIENTE||parcela.NOME_CLIENTE||"",cpf},isSJ:true})});const d=await r.json();if(d.ok&&d.boletos?.[0]?.ok)setSjPixCodeP(d.boletos[0].pixCopiaECola||"");else setSjPixErrP((d.boletos?.[0]?.erro)||d.erro||"Erro ao gerar PIX SJ");}catch(e){setSjPixErrP(e.message);}setSjPixLoadP(false);};
  const enviarSjPixWppP=async()=>{if(!sjPixCodeP||sjPixWppLoadP||!parcela)return;setSjPixWppLoadP(true);const fee=Math.round(parseFloat(parcela.VALOR_PRINCIPAL||0)*0.05*100)/100;const sjValor=parseFloat(parcela.VALOR_JUROS||0)+fee;const cliInfo=(clientes||[]).find(c=>String(c.ID_CLIENTE)===String(parcela.ID_CLIENTE));const res=await postAction({action:"enviarPixManual",idCliente:parcela.ID_CLIENTE||"",idContrato:parcela.ID_CONTRATO||"",idParcela:parcela.ID_PARCELA||"",nome:parcela.NOME_CLIENTE||"",telefone:cliInfo?.TELEFONE_WPP||cliInfo?.TELEFONE||"",numParcela:parseInt(parcela.NUM_PARCELA||0),totalParcelas:parseInt(parcela.TOTAL_PARCELAS||0),valorParcela:sjValor,dataVencimento:parcela.DATA_VENCIMENTO||"",pixCode:sjPixCodeP});if(res.ok){setSjPixWppOkP(true);setTimeout(()=>setSjPixWppOkP(false),3000);}setSjPixWppLoadP(false);};

  const registrar=async()=>{if(!parcela||!valor||!data)return;setLoading(true);setMsg(null);const res=await postAction({action:tipo==="parcial"?"pagamentoParcial":"pagamento",idParcela:parcela.ID_PARCELA||"",idContrato:parcela.ID_CONTRATO||"",numParcela:parcela.NUM_PARCELA||"",valor:parseFloat(valor),data:apiDateStr(data),forma:"pix",...(desconto>0&&{desconto})});if(res.ok){if(res.idUndo&&_registrarUndoAtivo)_registrarUndoAtivo({idUndo:res.idUndo,tipo:tipo==="parcial"?"SOMENTE_JUROS":"PAGAMENTO_NORMAL",idContrato:parcela.ID_CONTRATO||"",nomeCliente:parcela.NOME_CLIENTE||"",segundosRestantes:900});resRef.current=res;setComprovanteData({valorPago:parseFloat(valor),dataPago:data,tipoLabel:tipo==="parcial"?"Somente Juros":"Pagamento Total"});}else setMsg({ok:false,t:res.erro||"Erro ao registrar pagamento"});setLoading(false);};

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
          <div><span style={LS()}>Tipo</span><select value={tipo} onChange={e=>changeTipoPPM(e.target.value)} style={IS()}><option value="total">Pagamento total</option><option value="parcial">Somente juros</option></select></div>
          <div><span style={LS()}>Valor</span><input type="number" value={valor} onChange={e=>setValor(e.target.value)} onPaste={e=>pasteMoeda(e,setValor)} style={IS()}/></div>
          {tipo==="total"&&parseFloat(parcela?.VALOR_JUROS||0)>0&&(
            <div>
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:4}}>
                <span style={LS()}>Desconto nos Juros (R$)</span>
                <span style={{fontSize:10,color:MUTED,fontWeight:600}}>máx {fmtR(parseFloat(parcela?.VALOR_JUROS||0))}</span>
              </div>
              <input type="number" value={desconto||""} onChange={e=>changeDescontoPPM(e.target.value)} onPaste={e=>pasteMoeda(e,changeDescontoPPM)} placeholder="0,00" min="0" max={parseFloat(parcela?.VALOR_JUROS||0)} style={{...IS(),color:desconto>0?GRN:TEXT}}/>
              {desconto>0&&<div style={{marginTop:4,fontSize:11,color:GRN,fontWeight:600}}>Cliente paga {fmtR(parseFloat(parcela?.VALOR_PRINCIPAL||0))} + {fmtR(Math.max(0,parseFloat(parcela?.VALOR_JUROS||0)-desconto))} de juros</div>}
            </div>
          )}
          {tipo==="parcial"&&parcela&&(
            <div style={{background:ORG+"08",border:`1px solid ${ORG}25`,borderRadius:10,padding:"12px 14px",display:"flex",flexDirection:"column",gap:10}}>
              <div style={{fontSize:12,fontWeight:700,color:ORG}}>PIX Somente Juros · {fmtR(parseFloat(parcela.VALOR_JUROS||0)+Math.round(parseFloat(parcela.VALOR_PRINCIPAL||0)*0.05*100)/100)}</div>
              {!sjPixCodeP?(
                <button onClick={gerarPixSJP} disabled={sjPixLoadP} style={{padding:"8px",borderRadius:9,border:`1px solid ${ORG}`,background:"transparent",color:ORG,fontWeight:700,fontSize:12,cursor:sjPixLoadP?"default":"pointer",opacity:sjPixLoadP?0.6:1,display:"flex",alignItems:"center",justifyContent:"center",gap:5}}>
                  {sjPixLoadP?<><IcoSpinner color={ORG}/> Gerando...</>:"Gerar PIX SJ"}
                </button>
              ):(
                <div style={{display:"flex",flexDirection:"column",gap:8}}>
                  <div style={{background:BG,borderRadius:7,padding:"8px 10px",fontSize:10,color:MUTED,fontFamily:"monospace",wordBreak:"break-all"}}>{sjPixCodeP}</div>
                  <div style={{display:"flex",gap:8}}>
                    <button onClick={()=>{navigator.clipboard.writeText(sjPixCodeP);setSjPixCopiedP(true);setTimeout(()=>setSjPixCopiedP(false),2000);}} style={{flex:1,padding:"7px",borderRadius:8,border:`1px solid ${BD}`,background:CARD,color:TEXT,fontWeight:600,fontSize:12,cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center"}}>
                      {sjPixCopiedP?"Copiado!":"Copiar PIX"}
                    </button>
                    <button onClick={enviarSjPixWppP} disabled={sjPixWppLoadP} style={{flex:1,padding:"7px",borderRadius:8,border:"none",background:sjPixWppOkP?"#16a34a":"#25D366",color:"#FFF",fontWeight:700,fontSize:12,cursor:sjPixWppLoadP?"default":"pointer",opacity:sjPixWppLoadP?0.6:1,display:"flex",alignItems:"center",justifyContent:"center",gap:5}}>
                      {sjPixWppLoadP?<><IcoSpinner color="#FFF"/> Enviando...</>:sjPixWppOkP?"Enviado!":"Enviar WPP"}
                    </button>
                  </div>
                </div>
              )}
              {sjPixErrP&&<div style={{fontSize:11,color:RED,fontWeight:600}}>{sjPixErrP}</div>}
            </div>
          )}
          <div><span style={LS()}>Data</span><input type="date" value={data} onChange={e=>setData(e.target.value)} style={IS()}/></div>
          {msg&&<div style={{padding:10,borderRadius:8,background:msg.ok?GRN+"10":RED+"10",color:msg.ok?GRN:RED,fontSize:12,fontWeight:700}}>{msg.t}</div>}
          <div style={{display:"flex",gap:8,marginTop:4}}>
            <button onClick={()=>setModo("reagendar")} style={BTN5(ORG)}>{IcoCal} Reagendar</button>
            <div style={{flex:1}}/>
            <button onClick={onFechar} style={BTN6()}>Cancelar</button>
            <button onClick={registrar} disabled={loading||!valor||!data} style={BTN1(loading||!valor||!data)}>{loading?<><IcoSpinner color="#07241B"/> Registrando...</>:"Confirmar"}</button>
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
            <button onClick={reagendar} disabled={loading||!promData} style={BTN1(loading||!promData)}>{loading?<><IcoSpinner color="#07241B"/> Salvando...</>:"Registrar Promessa"}</button>
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
  const [dtVenc,setDtVenc]=useState(()=>{const dia=clienteInicial?.DIA_VENCIMENTO_PREFERIDO||(clientes||[]).find(c=>String(c.ID_CLIENTE)===String(clienteInicial?.ID_CLIENTE))?.DIA_VENCIMENTO_PREFERIDO;return dia?calcProxVenc(dia):"";});const [loading,setLoading]=useState(false);const [msg,setMsg]=useState(null);const [contratoOk,setContratoOk]=useState(null);const [docLoading,setDocLoading]=useState(false);const [zapLoading,setZapLoading]=useState(false);const [zapUrl,setZapUrl]=useState("");const [zapErro,setZapErro]=useState("");const [zapWppUrl,setZapWppUrl]=useState("");const [carneLoading,setCarneLoading]=useState(false);const [carneOk,setCarneOk]=useState(false);const [carneErro,setCarneErro]=useState("");const [criandoSteps,setCriandoSteps]=useState(null);const ref=useRef();
  useEffect(()=>{const h=e=>{if(ref.current&&!ref.current.contains(e.target))setShowDrop(false);};document.addEventListener("mousedown",h);return()=>document.removeEventListener("mousedown",h);},[]);

  const ST_BLOQ=["ativo_em_dia","ativo_em_atraso","em_cobranca","pre_prejuizo","renegociado","em_recuperacao","recuperado_parcialmente","em_processo_judicial"];
  const idsJudicializados=useMemo(()=>{const s=new Set();(clientes||[]).forEach(c=>{if(String(c.CLIENTE_JUDICIALIZADO||"").toUpperCase()==="SIM")s.add(String(c.ID_CLIENTE));});return s;},[clientes]);
  const idsBloqueadosManual=useMemo(()=>{const s=new Set();(clientes||[]).forEach(c=>{if(String(c.CLIENTE_BLOQUEADO_MANUAL||"").toUpperCase()==="SIM")s.add(String(c.ID_CLIENTE));});return s;},[clientes]);
  const idsComAtivo=useMemo(()=>{const s=new Set();(contratos||[]).forEach(c=>{if(ST_BLOQ.includes(c.STATUS_CONTRATO))s.add(String(c.ID_CLIENTE));});return s;},[contratos]);
  const clienteJudi=cliente?idsJudicializados.has(String(cliente.ID_CLIENTE)):false;
  const clienteBloqManual=cliente?idsBloqueadosManual.has(String(cliente.ID_CLIENTE)):false;
  const clienteMotivoBloqueio=clienteBloqManual?String((clientes||[]).find(c=>String(c.ID_CLIENTE)===String(cliente.ID_CLIENTE))?.MOTIVO_BLOQUEIO_MANUAL||""):"";
  const clienteBloqueadoGate=clienteJudi||clienteBloqManual;

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

  const criar=async()=>{if(!cliente||!principal||!nParcelas||!taxa||!dtEmp||!dtVenc)return;setLoading(true);setMsg(null);const _cts=[{l:"Validando dados",ok:false},{l:"Criando contrato",ok:false},{l:"Calculando parcelas",ok:false},{l:"Salvando no sistema",ok:false}];setCriandoSteps(_cts);const _t1=setTimeout(()=>setCriandoSteps(s=>s?s.map((x,i)=>i===0?{...x,ok:true}:x):s),220);const _t2=setTimeout(()=>setCriandoSteps(s=>s?s.map((x,i)=>i===1?{...x,ok:true}:x):s),750);const _t3=setTimeout(()=>setCriandoSteps(s=>s?s.map((x,i)=>i===2?{...x,ok:true}:x):s),1300);const dadosContrato={idCliente:cliente.ID_CLIENTE,nomeCliente:cliente.NOME_CLIENTE,principal,parcelas:nParcelas,taxa,dataEmprestimo:apiDateStr(dtEmp),dataVencimento:apiDateStr(dtVenc)};const res=await postAction({action:"novoContrato",dados:dadosContrato});if(res.ok){clearTimeout(_t1);clearTimeout(_t2);clearTimeout(_t3);setCriandoSteps(null);const cliF=(clientes||[]).find(c=>String(c.ID_CLIENTE)===String(cliente.ID_CLIENTE));const diaAtual=parseInt(cliF?.DIA_VENCIMENTO_PREFERIDO||0);const diaNovo=parseInt((dtVenc||"").split("-")[2]||0);if(diaNovo&&diaNovo!==diaAtual)postAction({action:"atualizarCliente",idCliente:cliente.ID_CLIENTE,campos:{DIA_VENCIMENTO_PREFERIDO:diaNovo}});setZapUrl("");setZapErro("");setZapWppUrl("");setCarneOk(false);setCarneErro("");setContratoOk({idContrato:res.idContrato||"",clienteId:cliente.ID_CLIENTE,nomeCliente:cliente.NOME_CLIENTE,principal,nParcelas,taxa,dtVenc,docUrl:"",docId:"",parcelas:res.parcelas||[],clienteEfi:res.cliente||null});setDocLoading(true);postAction({action:"gerarDoc",idContrato:res.idContrato,idCliente:cliente.ID_CLIENTE,dados:dadosContrato}).then(d=>{if(d.ok)setContratoOk(prev=>prev?{...prev,docUrl:d.docUrl||"",docId:d.docId||""}:prev);}).finally(()=>setDocLoading(false));if((res.parcelas||[]).length&&res.idContrato){setCarneLoading(true);fetch("/api/efi-charges",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({idContrato:res.idContrato,parcelas:res.parcelas,cliente:res.cliente||{}})}).then(r=>r.json()).then(d=>{if(d.ok&&d.boletos?.every(b=>b.ok)){setCarneOk(true);postAction({action:"salvarCobrancasEfi",cobracas:d.boletos});}else{const errs=(d.boletos||[]).filter(b=>!b.ok).map(b=>`P${b.numParcela}: ${b.erro}`).join("; ");setCarneErro(errs||d.erro||"Erro ao gerar PIX");}}).catch(e=>setCarneErro(e.message)).finally(()=>setCarneLoading(false));}}else{clearTimeout(_t1);clearTimeout(_t2);clearTimeout(_t3);setCriandoSteps(null);setMsg({ok:false,t:res.erro||"Erro"});}setLoading(false);};
  const _fRc=v=>'R$ '+Number(v||0).toLocaleString('pt-BR',{minimumFractionDigits:2,maximumFractionDigits:2});
  const _fDvc=d=>{const dt=parseDate(d);return dt&&!isNaN(dt)?dt.toLocaleDateString('pt-BR'):d||'—';};
  const _cliOk=contratoOk?(clientes||[]).find(c=>String(c.ID_CLIENTE||"").trim()===String(contratoOk.clienteId||"").trim()):null;
  const _telOk=contratoOk?String(_cliOk?.TELEFONE_WPP||_cliOk?.TELEFONE||"").replace(/\D/g,""):"";
  const _pmtOk=contratoOk?parseFloat(contratoOk.parcelas?.[0]?.valorParcela||0):0;
  const _abrirWppNovo=()=>{if(!contratoOk)return;const tel=_telOk?`55${_telOk}`:'';const txt=`🎉 *Pagamento realizado com sucesso!*\n\nO valor já foi transferido para sua conta.\n\n*Informações importantes:*\n\n• Você receberá lembretes automáticos próximos aos vencimentos das parcelas.\n• O código PIX para pagamento será enviado automaticamente nas mensagens de cobrança.\n• Pagamentos realizados em dia aumentam seu *Score Interno*, podendo garantir melhores condições, limites maiores e taxas reduzidas em futuras operações.\n\nAgradecemos pela confiança.\n\n*Borges Assessoria*`;const url=tel?`https://wa.me/${tel}?text=${encodeURIComponent(txt)}`:'https://web.whatsapp.com';window.open(url,'_blank');setContratoOk(null);onSucesso();};
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
    {contratoOk&&<div style={{position:"fixed",inset:0,zIndex:500,background:"rgba(15,23,42,0.45)",display:"flex",alignItems:"center",justifyContent:"center",padding:20}}><div style={{width:"100%",maxWidth:400,background:CARD,borderRadius:16,border:`1px solid ${BD}`,boxShadow:"0 24px 80px rgba(15,23,42,0.25)",overflow:"hidden",minWidth:0,animation:"fadeUp 0.25s cubic-bezier(0.16,1,0.3,1)"}}><div style={{background:GRN,padding:"22px 24px",textAlign:"center"}}><div style={{width:44,height:44,borderRadius:"50%",background:"rgba(255,255,255,0.25)",display:"flex",alignItems:"center",justifyContent:"center",margin:"0 auto 8px"}}><svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={ONBRAND} strokeWidth="2.5"><polyline points="20,6 9,17 4,12"/></svg></div><div style={{color:ONBRAND,fontWeight:800,fontSize:17}}>Contrato criado</div><div style={{color:ONBRANDSOFT,fontSize:12,marginTop:4}}>{contratoOk.nomeCliente} · {contratoOk.idContrato}</div></div><div style={{padding:"18px 20px"}}><div style={{background:BG,borderRadius:10,padding:"12px 16px",marginBottom:16,display:"grid",gridTemplateColumns:"1fr 1fr",gap:10}}><div><div style={{fontSize:10,color:MUTED,fontWeight:700,textTransform:"uppercase",marginBottom:2}}>Valor</div><div style={{fontWeight:800,fontSize:15,color:ORG}}>{_fRc(parseFloat(contratoOk.principal))}</div></div><div><div style={{fontSize:10,color:MUTED,fontWeight:700,textTransform:"uppercase",marginBottom:2}}>Parcelas</div><div style={{fontWeight:700,fontSize:13}}>{contratoOk.nParcelas}x de {_fRc(_pmtOk)}</div></div><div style={{gridColumn:"1/-1"}}><div style={{fontSize:10,color:MUTED,fontWeight:700,textTransform:"uppercase",marginBottom:2}}>1º Vencimento</div><div style={{fontWeight:700,fontSize:13}}>{_fDvc(contratoOk.dtVenc)}</div></div></div><div style={{display:"flex",flexDirection:"column",gap:8}}>{docLoading?<div style={{padding:"12px",borderRadius:9,background:BG,color:MUTED,fontSize:13,display:"flex",alignItems:"center",justifyContent:"center",gap:7}}><IcoSpinner color={MUTED}/> Gerando contrato...</div>:<>{contratoOk.docUrl&&<button onClick={()=>window.open(contratoOk.docUrl,"_blank")} style={{padding:"12px",borderRadius:9,border:"none",background:TEXT,color:"#FFF",cursor:"pointer",fontWeight:700,fontSize:13,display:"flex",alignItems:"center",justifyContent:"center",gap:7}}>{IcoDoc} Abrir no Google Docs</button>}{contratoOk.docId&&!zapUrl&&<button onClick={_enviarZapSign} disabled={zapLoading} style={{padding:"12px",borderRadius:9,border:"none",background:zapLoading?"#9B7FD4":"#6C3FC5",color:"#FFF",cursor:zapLoading?"default":"pointer",fontWeight:700,fontSize:13,display:"flex",alignItems:"center",justifyContent:"center",gap:7}}>{zapLoading?<><IcoSpinner color="#ffffff"/> Enviando...</>:<>{IcoSign} Enviar para ZapSign</>}</button>}</>}{zapUrl&&<button onClick={()=>window.open(zapUrl,"_blank")} style={{padding:"12px",borderRadius:9,border:"none",background:"#6C3FC5",color:"#FFF",cursor:"pointer",fontWeight:700,fontSize:13,display:"flex",alignItems:"center",justifyContent:"center",gap:7}}>{IcoSign} Assinar como credor</button>}
{zapWppUrl&&<button onClick={()=>window.open(zapWppUrl,"_blank")} style={{padding:"12px",borderRadius:12,border:"none",background:"#25D366",color:"#FFF",cursor:"pointer",fontWeight:700,fontSize:13,display:"flex",alignItems:"center",justifyContent:"center",gap:7}}>{IcoPhone} Enviar mensagem de assinatura (WhatsApp)</button>}{!carneOk?<button onClick={_gerarCarne} disabled={carneLoading} style={{padding:"12px",borderRadius:9,border:"none",background:carneLoading?"#7a6a2a":"#B8860B",color:"#FFF",cursor:carneLoading?"default":"pointer",fontWeight:700,fontSize:13,display:"flex",alignItems:"center",justifyContent:"center",gap:7}}>{carneLoading?<><IcoSpinner color="#ffffff"/> Gerando...</>:<>{IcoPag} Gerar Carnê PIX</>}</button>:<div style={{padding:"10px 12px",borderRadius:9,background:GRN+"20",color:GRN,fontWeight:700,fontSize:13,textAlign:"center",display:"flex",alignItems:"center",justifyContent:"center",gap:6}}>{IcoCheck} Carnê PIX gerado</div>}{carneErro&&<div style={{padding:"8px 10px",borderRadius:8,background:RED+"10",color:RED,fontSize:11,fontWeight:600}}>Erro carnê: {carneErro}</div>}<button onClick={_abrirWppNovo} style={{padding:"12px",borderRadius:12,border:"none",background:"#25D366",color:"#FFF",cursor:"pointer",fontWeight:700,fontSize:13,display:"flex",alignItems:"center",justifyContent:"center",gap:7}}>{IcoPhone} Enviar boas-vindas pelo WhatsApp</button><button onClick={()=>{setContratoOk(null);onSucesso();}} style={{padding:"10px",borderRadius:8,border:`1px solid ${BD}`,background:CARD,color:MUTED,cursor:"pointer",fontWeight:600,fontSize:13}}>Fechar</button>{contratoOk.docErro&&<div style={{marginTop:6,padding:"8px 10px",borderRadius:8,background:RED+"10",color:RED,fontSize:11,fontWeight:600}}>Erro ao gerar doc: {contratoOk.docErro}</div>}{zapErro&&<div style={{marginTop:4,padding:"8px 10px",borderRadius:8,background:RED+"10",color:RED,fontSize:11,fontWeight:600}}>Erro ZapSign: {zapErro}</div>}</div></div></div></div>}
    {loading&&criandoSteps&&<div style={{position:"fixed",inset:0,zIndex:490,background:"rgba(15,23,42,0.5)",display:"flex",alignItems:"center",justifyContent:"center",padding:20}}><div style={{background:CARD,borderRadius:16,border:`1px solid ${BD}`,boxShadow:"0 24px 80px rgba(15,23,42,0.25)",padding:"28px 32px",minWidth:280,animation:"fadeUp 0.2s ease"}}><div style={{fontWeight:800,fontSize:16,marginBottom:20,color:TEXT}}>Criando contrato...</div>{criandoSteps.map((s,i)=>{const isActive=!s.ok&&(i===0||criandoSteps[i-1]?.ok);return(<div key={i} style={{display:"flex",alignItems:"center",gap:12,marginBottom:i<criandoSteps.length-1?14:0,opacity:(!s.ok&&!isActive)?0.35:1,transition:"opacity 0.3s"}}><div style={{width:22,height:22,borderRadius:"50%",flexShrink:0,display:"flex",alignItems:"center",justifyContent:"center",border:`1.5px solid ${s.ok?GRN:isActive?ACC:BD}`,background:s.ok?GRN+"18":isActive?ACC+"18":"transparent",transition:"all 0.3s"}}>{s.ok?<svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke={GRN} strokeWidth="3"><polyline points="20,6 9,17 4,12"/></svg>:isActive?<IcoSpinner size={10} color={ACC}/>:null}</div><span style={{fontSize:13,fontWeight:s.ok||isActive?600:400,color:s.ok?GRN:isActive?TEXT:MUTED,transition:"all 0.3s"}}>{s.l}</span></div>);})}</div></div>}
    <div style={{background:CARD,borderRadius:16,padding:20,border:`1px solid ${BD}`,boxShadow:SHD}}>
      <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:16}}><div style={{background:ORG+"15",color:ORG,padding:8,borderRadius:8}}>{IcoCtr}</div><h3 style={{margin:0,fontSize:15,fontWeight:700}}>Novo Contrato</h3></div>
      <div style={{display:"flex",flexDirection:"column",gap:12}}>
        <div style={{position:"relative"}} ref={ref}>
          <span style={LS()}>Buscar Cliente</span>
          <div style={{position:"relative"}}><div style={{position:"absolute",left:10,top:"50%",transform:"translateY(-50%)"}}>{IcoSrch}</div><input value={cliente?cliente.NOME_CLIENTE:busca} onChange={e=>{setBusca(e.target.value);setCliente(null);setShowDrop(true);}} onFocus={()=>setShowDrop(true)} placeholder="Nome ou ID..." style={{...IS(),paddingLeft:32}}/>{cliente&&<button onClick={()=>{setCliente(null);setBusca("");setPrincipal("");setNParcelas("");setTaxa("");}} style={{position:"absolute",right:8,top:"50%",transform:"translateY(-50%)",border:"none",background:"none",cursor:"pointer",color:MUTED,fontSize:16}}>×</button>}</div>
          {showDrop&&clis.length>0&&<div style={{position:"absolute",top:"100%",left:0,right:0,background:CARD,border:`1px solid ${BD}`,borderRadius:8,marginTop:4,zIndex:100,boxShadow:"0 10px 30px rgba(0,0,0,0.1)"}}>
            {clis.map(c=>{
              const bloq=idsComAtivo.has(String(c.ID_CLIENTE));
              const judi=idsJudicializados.has(String(c.ID_CLIENTE));
              const bloqM=idsBloqueadosManual.has(String(c.ID_CLIENTE));
              const blocked=bloq||judi||bloqM;
              return<div key={c.ID_CLIENTE}
                onClick={()=>{if(!blocked){setCliente(c);setShowDrop(false);const cliF=(clientes||[]).find(cl=>String(cl.ID_CLIENTE)===String(c.ID_CLIENTE));if(cliF?.DIA_VENCIMENTO_PREFERIDO){const dv=calcProxVenc(cliF.DIA_VENCIMENTO_PREFERIDO);if(dv)setDtVenc(dv);}const pf=prefill(c.ID_CLIENTE);if(pf){setPrincipal(pf.principal);setNParcelas(pf.nParcelas);setTaxa(pf.taxa);}else{setPrincipal("");setNParcelas("");setTaxa("");}}}}
                style={{padding:"10px 14px",cursor:blocked?"not-allowed":"pointer",fontSize:13,borderBottom:`1px solid ${BG}`,background:blocked?RED+"05":CARD,display:"flex",justifyContent:"space-between",alignItems:"center",opacity:blocked?0.7:1}}
                onMouseEnter={e=>!blocked&&(e.currentTarget.style.background=BG)}
                onMouseLeave={e=>e.currentTarget.style.background=blocked?RED+"05":CARD}>
                <span style={{color:blocked?MUTED:TEXT}}><strong style={{color:blocked?MUTED:TEXT}}>{c.ID_CLIENTE}</strong> — {c.NOME_CLIENTE}</span>
                {judi&&<span style={{fontSize:11,fontWeight:700,color:RED,background:RED+"12",padding:"2px 8px",borderRadius:99,whiteSpace:"nowrap",marginLeft:8,display:"inline-flex",alignItems:"center",gap:4}}>{IcoJur} judicializado</span>}
                {!judi&&bloqM&&<span style={{fontSize:11,fontWeight:700,color:RED,background:RED+"12",padding:"2px 8px",borderRadius:99,whiteSpace:"nowrap",marginLeft:8,display:"inline-flex",alignItems:"center",gap:4}}>{IcoLock} bloqueado</span>}
                {!judi&&!bloqM&&bloq&&<span style={{fontSize:11,fontWeight:700,color:RED,background:RED+"12",padding:"2px 8px",borderRadius:99,whiteSpace:"nowrap",marginLeft:8,display:"inline-flex",alignItems:"center",gap:4}}>{IcoLock} contrato ativo</span>}
              </div>;
            })}
          </div>}
        </div>
        {cliente&&clienteBloqueadoGate&&<div style={{background:RED+"08",border:`1px solid ${RED}30`,borderRadius:8,padding:"10px 12px",fontSize:12,color:RED,fontWeight:600,display:"flex",alignItems:"center",gap:8}}>{clienteJudi?IcoJur:IcoLock} {clienteJudi?"Cliente com histórico de ação judicial — bloqueio permanente para novo crédito.":`Cliente bloqueado${clienteMotivoBloqueio?": "+clienteMotivoBloqueio:"."}`}</div>}
        {cliente&&<div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10}}>
          <div><span style={LS()}>Principal</span><input type="number" value={principal} onChange={e=>setPrincipal(e.target.value)} onPaste={e=>pasteMoeda(e,setPrincipal)} placeholder="0.00" style={IS()}/></div>
          <div><span style={LS()}>Parcelas</span><input type="number" value={nParcelas} onChange={e=>setNParcelas(e.target.value)} placeholder="1" style={IS()}/></div>
          <div><span style={LS()}>Taxa Mensal (%)</span><input type="number" value={taxa} onChange={e=>setTaxa(e.target.value)} placeholder="0.00" style={IS()}/></div>
          <div><span style={LS()}>1º Vencimento</span><input type="date" value={dtVenc} onChange={e=>setDtVenc(e.target.value)} style={IS()}/></div>
          <div style={{gridColumn:"1/-1"}}><span style={LS()}>Data Empréstimo</span><input type="date" value={dtEmp} onChange={e=>setDtEmp(e.target.value)} style={IS()}/></div>
          <button onClick={criar} disabled={loading||clienteBloqueadoGate} style={{...BTN1(loading||clienteBloqueadoGate),gridColumn:"1/-1"}}>{loading?<><IcoSpinner color="#07241B"/> Criando...</>:<>{IcoCtr} Gerar Contrato</>}</button>
        </div>}
        {msg&&<div style={{padding:10,borderRadius:8,background:msg.ok?GRN+"10":RED+"10",color:msg.ok?GRN:RED,fontSize:12,textAlign:"center",fontWeight:600}}>{msg.t}</div>}
      </div>
    </div>
  </>);
}

// ─── MODAL CONTRATO ──────────────────────────────────────────────
function ContratoModal({ contrato, parcelas, pagamentos, clientes, eventos, onRegistrarPagamento, onReagendar, onBaixar, onQuitacaoAntecipada, onComprovante, onAlterarVencimento, onFechar, onExcluir, onAcordoAssistido, onAbatimento, onVoltarCliente, onAjuizar, onRenegociar, onRecuperar, onAcordoJudicial, onQuitacaoJudicial, onArquivarProcesso }) {
  const [histPanel, setHistPanel] = useState(false);
  const [abaPanel, setAbaPanel] = useState("parcelas");
  const [maisAcoesOpen, setMaisAcoesOpen] = useState(false);
  const [altVencOpen,setAltVencOpen]=useState(false);
  const [altVencDate,setAltVencDate]=useState("");
  const [altVencLoad,setAltVencLoad]=useState(false);
  const [altVencErr,setAltVencErr]=useState("");
  const [sairLoad,setSairLoad]=useState(false);
  const [sairErr,setSairErr]=useState("");
  const [pixLoad,setPixLoad]=useState(false);
  const [pixOk,setPixOk]=useState(false);
  const [pixErr,setPixErr]=useState("");
  const [pixCopied,setPixCopied]=useState(false);
  const [pixCodeNew,setPixCodeNew]=useState("");
  const [delConfirm,setDelConfirm]=useState(false);
  const [delLoad,setDelLoad]=useState(false);
  const [delErr,setDelErr]=useState("");
  const [pixWppLoad,setPixWppLoad]=useState(false);
  const [pixWppOk,setPixWppOk]=useState(false);
  const [pixWppErr,setPixWppErr]=useState("");
  const [juriEdit,setJuriEdit]=useState(false);
  const [juriDados,setJuriDados]=useState({});
  const [juriLoad,setJuriLoad]=useState(false);
  const [juriErr,setJuriErr]=useState("");
  const [juriOk,setJuriOk]=useState(false);
  const [movDesc,setMovDesc]=useState("");
  const [movData,setMovData]=useState(hojeStr());
  const [movLoad,setMovLoad]=useState(false);
  const [movErr,setMovErr]=useState("");

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
  const _pixVenc = proxParcela ? parseDate(proxParcela.DATA_VENCIMENTO) : null;
  if (_pixVenc) _pixVenc.setHours(0,0,0,0);
  const _pixDiasAteVenc = _pixVenc ? Math.round((_pixVenc.getTime()-new Date().setHours(0,0,0,0))/86400000) : null;
  const pixCodeSaved = proxParcela?.EFI_PIX_CODE || "";
  // cobv gerado com validadeAposVencimento:30 (api/efi-charges.js) — passado esse prazo a Efí
  // recusa o pagamento mesmo com o código antigo ainda salvo na planilha
  const pixSalvoExpirado = !!pixCodeSaved && !pixCodeNew && _pixDiasAteVenc !== null && _pixDiasAteVenc < -30;
  const pixCodeToShow = pixCodeNew || (pixSalvoExpirado ? "" : pixCodeSaved);
  React.useEffect(()=>{
    setPixCodeNew("");setPixOk(false);setPixErr("");setPixCopied(false);
    setPixWppOk(false);setPixWppErr("");
  },[proxParcela?.ID_PARCELA]);
  const isAcordoAssistido = contrato.STATUS_CONTRATO === "acordo_assistido";
  const isJudicial = contrato.STATUS_CONTRATO === "em_processo_judicial";
  const isEncerradoJudicial = contrato.STATUS_CONTRATO === "encerrado_judicialmente";
  const situacaoFinJudicial = contrato.SITUACAO_FINANCEIRA_JUDICIAL || "EM_ABERTO";
  const pendentesJudiciais = pendentes.filter(p=>String(p.ORIGEM_PARCELA||"").toLowerCase()==="acordo_judicial");
  const podeAcordoJudicial = isJudicial && (situacaoFinJudicial==="EM_ABERTO" || situacaoFinJudicial==="ACORDO_QUEBRADO");
  const podeQuitacaoJudicial = isJudicial;
  const podeArquivarProcesso = isJudicial;
  const podeAcordoAssistido = ["ativo_em_atraso","em_cobranca","pre_prejuizo"].includes(contrato.STATUS_CONTRATO);
  const jaRenegociado = ps.some(p=>String(p.ORIGEM_PARCELA||"").toLowerCase()==="renegociada");
  const jaTeveAcordoAssistido = (eventos||[]).some(e=>String(e.ID_CONTRATO||"").trim()===String(contrato.ID_CONTRATO).trim() && String(e.TIPO_EVENTO||"")==="ACORDO_ASSISTIDO_ENTRADA");
  const podeAjuizar = ["em_cobranca","pre_prejuizo","baixado_como_prejuizo"].includes(contrato.STATUS_CONTRATO)
    || ((jaRenegociado || jaTeveAcordoAssistido) && contrato.STATUS_CONTRATO==="ativo_em_atraso");
  const stLoss = ["baixado_como_prejuizo","em_recuperacao","recuperado_parcialmente","recuperado_integralmente","encerrado_sem_recuperacao","em_processo_judicial","encerrado_judicialmente"].includes(contrato.STATUS_CONTRATO);
  const saldoDevedor = stLoss
    ? parseFloat(contrato.PREJUIZO_CAPITAL||0)
    : pendentes.reduce((s,p)=>s+parseFloat(p.VALOR_PARCELA||0),0);
  const abatidoAssistido = parseFloat(contrato.VALOR_ABATIDO_ASSISTIDO||0);
  const capitalRestante = Math.max(0, parseFloat(contrato.VALOR_PRINCIPAL||0) - abatidoAssistido);
  const lucroRemanescente = isAcordoAssistido
    ? ps.filter(p=>!["pago","quitacao_antecipada","baixado_como_prejuizo","cancelado","renegociado"].includes(String(p.STATUS||p.STATUS_PAGAMENTO||"").toLowerCase())).reduce((s,p)=>s+parseFloat(p.VALOR_JUROS||0),0)
    : 0;
  const pct = parseFloat(contrato.VALOR_PRINCIPAL||0) > 0
    ? (totalPago / parseFloat(contrato.VALOR_TOTAL||contrato.VALOR_PRINCIPAL||1)) * 100 : 0;
  const proxVenc = proxParcela ? parseDate(proxParcela.DATA_VENCIMENTO) : null;
  if (proxVenc) proxVenc.setHours(0,0,0,0);
  const diasAteVenc = proxVenc ? Math.round((proxVenc.getTime()-new Date().setHours(0,0,0,0))/86400000) : null;
  const taxa = parseFloat(contrato.TAXA_JUROS_MENSAL||0);
  const juros = parseFloat(contrato.VALOR_PRINCIPAL||0) * taxa;
  const parcsPagas = parseInt(contrato.NUM_PARCELAS||0) - pendentes.length;
  const sairDoAcordo = async () => {
    setSairLoad(true); setSairErr("");
    try {
      const res = await postAction({action:"sairDoAcordoAssistido",idContrato:contrato.ID_CONTRATO,destino:"normal"});
      if(res.ok){onAlterarVencimento&&onAlterarVencimento();onFechar();}
      else setSairErr(res.erro||"Erro ao sair do acordo.");
    } catch(e){setSairErr(e.message);}
    setSairLoad(false);
  };

  const fmtDtLong = v => {
    if(!v)return"—";
    const d=v instanceof Date?v:parseDate(v);
    if(!d||isNaN(d.getTime()))return"—";
    return d.toLocaleDateString("pt-BR",{day:"numeric",month:"long",year:"numeric"});
  };

  const stCor = { pago:GRN, pendente:MUTED, atrasado:RED, vence_hoje:YEL, baixado_como_prejuizo:RED, cancelado:MUTED, quitacao_antecipada:GRN, reagendado:YEL };
  const stLabel = { pago:"Pago", pendente:"Pendente", atrasado:"Atrasado", vence_hoje:"Vence Hoje", baixado_como_prejuizo:"Baixado", cancelado:"Cancelado", reagendado:"Reagendado" };
  const podeRegistrar = isJudicial
    ? pendentesJudiciais.length > 0
    : !["baixado_como_prejuizo","quitado","cancelado","recuperado_integralmente","acordo_assistido","em_processo_judicial","encerrado_judicialmente"].includes(contrato.STATUS_CONTRATO);
  const podeBaixar    = !["baixado_como_prejuizo","quitado","cancelado","recuperado_integralmente","recuperado_parcialmente","acordo_assistido","em_processo_judicial","encerrado_judicialmente"].includes(contrato.STATUS_CONTRATO);
  const podeExcluir   = pags.length===0&&!["cancelado","baixado_como_prejuizo","quitado","recuperado_integralmente","recuperado_parcialmente","encerrado_sem_recuperacao","renegociado","acordo_assistido","em_processo_judicial","encerrado_judicialmente"].includes(String(contrato.STATUS_CONTRATO||"").toLowerCase());
  const podeRenegociar = !jaRenegociado && pendentes.length > 0 && ["ativo","ativo_em_dia","ativo_em_atraso","em_cobranca","pre_prejuizo","acordo_assistido"].includes(contrato.STATUS_CONTRATO);
  const podeRecuperar = ["baixado_como_prejuizo","em_recuperacao","recuperado_parcialmente"].includes(contrato.STATUS_CONTRATO);
  const mostrarPrioridadeCob = !["quitado","cancelado","recuperado_integralmente","encerrado_sem_recuperacao","renegociado","baixado_como_prejuizo","acordo_assistido"].includes(String(contrato.STATUS_CONTRATO||"").toLowerCase());
  const prioridadeCob = mostrarPrioridadeCob ? calcPrioridadeCobranca({contrato,parcelasContrato:ps,eventos,cliente:cli}) : null;
  const excluirContrato=async()=>{
    setDelLoad(true);setDelErr("");
    try{
      const res=await postAction({action:"excluirContrato",idContrato:contrato.ID_CONTRATO});
      if(res.ok){setDelConfirm(false);if(onExcluir)onExcluir();else onFechar();}
      else setDelErr(res.erro||"Erro ao excluir contrato.");
    }catch(e){setDelErr(e.message);}
    setDelLoad(false);
  };
  const tipoPagLabel  = { pagamento_normal:"Normal", normal:"Normal", pagamento_com_atraso:"Com Atraso", com_atraso:"Com Atraso", somente_juros:"Só Juros", recuperacao_apos_baixa:"Recuperação", pagamento_antecipado:"Antecipado", antecipado:"Antecipado", abatimento_acordo_assistido:"Abatimento", acordo_com_perda:"Acordo", recuperacao_judicial:"Recuperação Judicial" };
  const tipoPagCor    = { pagamento_normal:GRN, normal:GRN, pagamento_com_atraso:YEL, com_atraso:YEL, somente_juros:RED, recuperacao_apos_baixa:PUR, pagamento_antecipado:GRN, antecipado:GRN, abatimento_acordo_assistido:BLU, acordo_com_perda:ORG, recuperacao_judicial:RED };
  const mob = useIsMobile();

  const _gerarPix = async () => {
    if(pixLoad)return;
    // Só regenera parcela com mais de 30 dias de atraso pela DATA_VENCIMENTO original —
    // DATA_ACORDO (reagendamento) é ignorada de propósito, é só o registro da promessa do
    // cliente, não muda a dívida real. Parcela com atraso ≤30d não é tocada: o PIX dela ainda
    // é válido na Efí (validadeAposVencimento:30) e recalcular colocaria a data de hoje no
    // lugar da original, zerando o juros dinâmico que a própria Efí já vinha calculando certo.
    const hoje=new Date();hoje.setHours(0,0,0,0);
    const parcelasVencidas=pendentes.filter(p=>{
      const dv=parseDate(p.DATA_VENCIMENTO);
      if(!dv)return false;
      dv.setHours(0,0,0,0);
      return Math.round((hoje.getTime()-dv.getTime())/86400000)>30;
    });
    if(!parcelasVencidas.length){setPixErr("Nenhuma parcela com mais de 30 dias de atraso — não há PIX pra regenerar.");return;}
    setPixLoad(true);setPixErr("");setPixOk(false);
    const cpf=String(cli?.CPF||"").replace(/\D/g,"").padStart(11,"0");
    try{
      const parcelasEfi=parcelasVencidas.map(p=>({
        idParcela:p.ID_PARCELA,
        numParcela:parseInt(p.NUM_PARCELA||0),
        totalParcelas:parseInt(p.TOTAL_PARCELAS||0),
        dataVencimento:p.DATA_VENCIMENTO,
        valorParcela:parseFloat(p.VALOR_PARCELA||0)
      }));
      const r=await fetch("/api/efi-charges",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({
        idContrato:contrato.ID_CONTRATO,parcelas:parcelasEfi,
        cliente:{nome:contrato.NOME_CLIENTE||cli?.NOME_CLIENTE||"",cpf}
      })});
      const d=await r.json();
      const okBoletos=(d.boletos||[]).filter(b=>b.ok);
      if(d.ok&&okBoletos.length){
        setPixOk(true);
        const doProx=okBoletos.find(b=>String(b.idParcela)===String(proxParcela?.ID_PARCELA));
        const code=(doProx||okBoletos[0]).pixCopiaECola||"";
        if(code)setPixCodeNew(code);
        postAction({action:"salvarCobrancasEfi",cobracas:d.boletos});
      } else {
        setPixErr((d.boletos?.[0]?.erro)||d.erro||"Erro ao gerar PIX");
      }
    }catch(e){setPixErr(e.message);}
    setPixLoad(false);
  };

  const _copiarPix=()=>{
    if(!pixCodeToShow)return;
    navigator.clipboard.writeText(pixCodeToShow).then(()=>{setPixCopied(true);setTimeout(()=>setPixCopied(false),2500);}).catch(()=>{});
  };

  const _abrirWpp = () => {
    const tel=normTel(cli?.TELEFONE_WPP||cli?.TELEFONE||"");
    window.open(tel?`https://wa.me/55${tel}`:`https://web.whatsapp.com`,"_blank");
  };

  const _enviarPixWpp = async () => {
    if (!pixCodeToShow || !proxParcela || pixWppLoad) return;
    setPixWppLoad(true); setPixWppOk(false); setPixWppErr("");
    try {
      const res = await postAction({
        action:        "enviarPixManual",
        idCliente:     cli?.ID_CLIENTE     || "",
        idContrato:    contrato.ID_CONTRATO,
        idParcela:     proxParcela.ID_PARCELA || "",
        nome:          cli?.NOME_CLIENTE   || contrato.NOME_CLIENTE || "",
        telefone:      cli?.TELEFONE_WPP   || cli?.TELEFONE || "",
        numParcela:    parseInt(proxParcela.NUM_PARCELA    || 0),
        totalParcelas: parseInt(proxParcela.TOTAL_PARCELAS || 0),
        valorParcela:  parseFloat(proxParcela.VALOR_PARCELA || 0),
        dataVencimento: proxParcela.DATA_VENCIMENTO || "",
        pixCode:       pixCodeToShow,
      });
      if (res.ok) { setPixWppOk(true); setTimeout(() => setPixWppOk(false), 3000); }
      else setPixWppErr(res.erro || "Erro ao enviar");
    } catch(e) { setPixWppErr(e.message); }
    setPixWppLoad(false);
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
    const diasAtrasoPorParcela = new Map(ps.map(p=>[String(p.ID_PARCELA),parseInt(p.DIAS_ATRASO||0)]));
    pags.forEach(p=>{
      const extra=parseFloat(p.RECEITA_EXTRA_ATRASO||p.DIFERENCA_RECEBIDA||0)+parseFloat(p.FEE_PRORROGACAO||0);
      const diasAtraso=diasAtrasoPorParcela.get(String(p.ID_PARCELA))||0;
      ev.push({
        data:parseDate(p.DATA_PAGAMENTO),tipo:"pagamento",
        titulo:tipoPagLabel[p.TIPO_PAGAMENTO]||"Pagamento",
        detalhe:fmtR(p.VALOR_PAGO)+(extra>0?` +${fmtR(extra)} extra`:"")+(diasAtraso>0?` • ${diasAtraso}d de atraso`:""),
        cor:tipoPagCor[p.TIPO_PAGAMENTO]||GRN
      });
    });
    return ev.sort((a,b)=>(b.data?b.data.getTime():0)-(a.data?a.data.getTime():0));
  },[ps,pags,contrato,taxa]);

  return (
    <div className="modal-overlay-anim" style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.5)",zIndex:350,display:"flex",alignItems:"center",justifyContent:"center",padding:mob?0:16}} onClick={onFechar}>
      <div className="modal-box-anim" onClick={e=>e.stopPropagation()} style={{background:CARD,borderRadius:mob?0:16,width:"100%",maxWidth:mob?undefined:histPanel?1080:520,maxHeight:mob?"100dvh":"92vh",display:"flex",flexDirection:"row",boxShadow:"0 30px 90px rgba(0,0,0,0.32)",border:mob?"none":`1px solid ${BD}`,overflow:"hidden",minWidth:0,transition:"max-width 0.3s cubic-bezier(0.16,1,0.3,1)",position:"relative"}}>
        {delConfirm&&(
          <div style={{position:"absolute",inset:0,background:"rgba(0,0,0,0.55)",zIndex:20,display:"flex",alignItems:"center",justifyContent:"center",padding:24,borderRadius:"inherit"}}>
            <div style={{background:CARD,borderRadius:14,padding:24,maxWidth:340,width:"100%",border:`1.5px solid ${RED}50`,boxShadow:"0 20px 60px rgba(0,0,0,0.4)"}}>
              <div style={{fontSize:15,fontWeight:800,color:TEXT,marginBottom:8,display:"flex",alignItems:"center",gap:8}}><span style={{color:RED}}>{IcoAlert}</span>Excluir contrato?</div>
              <div style={{fontSize:13,color:MUTED,lineHeight:1.6,marginBottom:16}}>
                O contrato <strong style={{color:TEXT}}>{contrato.ID_CONTRATO}</strong> será marcado como <em>cancelado</em> no Sheets e o ID ficará reservado.<br/>
                Todas as parcelas serão <strong style={{color:RED}}>apagadas permanentemente</strong>. Esta ação não pode ser desfeita.
              </div>
              {delErr&&<div style={{padding:"8px 10px",borderRadius:8,background:RED+"10",color:RED,fontSize:12,fontWeight:600,marginBottom:12}}>{delErr}</div>}
              <div style={{display:"flex",gap:8}}>
                <button onClick={()=>{setDelConfirm(false);setDelErr("");}} disabled={delLoad} style={{flex:1,padding:"10px",borderRadius:9,border:`1px solid ${BD}`,background:"transparent",color:MUTED,cursor:"pointer",fontWeight:600,fontSize:13}}>Cancelar</button>
                <button onClick={excluirContrato} disabled={delLoad} style={{flex:1,padding:"10px",borderRadius:9,border:"none",background:RED,color:"#fff",cursor:delLoad?"default":"pointer",fontWeight:700,fontSize:13,opacity:delLoad?0.7:1}}>
                  {delLoad?"Excluindo...":"Sim, excluir"}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ── MAIN CONTENT ── */}
        <div style={{flex:1,display:"flex",flexDirection:"column",minWidth:0,overflow:"hidden"}}>

          {/* HEADER */}
          <div style={{padding:mob?"18px 20px 16px":"22px 24px 18px",flexShrink:0}}>
            {onVoltarCliente&&(
              <button onClick={onVoltarCliente} style={{display:"flex",alignItems:"center",gap:5,background:"transparent",border:"none",color:MUTED,cursor:"pointer",fontSize:12,fontWeight:600,padding:0,marginBottom:10}}>
                {IcoArrL} Voltar para {cli?.NOME||cli?.NOME_CLIENTE||"Cliente"}
              </button>
            )}
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",gap:12}}>
              <div style={{minWidth:0}}>
                <div style={{fontSize:mob?20:22,fontWeight:800,color:TEXT,letterSpacing:"-0.3px",lineHeight:1.15,marginBottom:10}}>Contrato {contrato.ID_CONTRATO}</div>
                <div style={{display:"flex",alignItems:"center",gap:6,flexWrap:"wrap"}}>
                  {/* Badge estilo outlined com dot */}
                  <span style={{display:"inline-flex",alignItems:"center",gap:5,padding:"3px 10px",borderRadius:9999,fontSize:11,fontWeight:600,textTransform:"uppercase",background:"transparent",color:TEXT,border:`1px solid ${BD}`,letterSpacing:"0.03em"}}>
                    <span style={{width:6,height:6,borderRadius:"50%",background:STATUS_COR[contrato.STATUS_CONTRATO]||MUTED,display:"inline-block",flexShrink:0}}/>
                    {STATUS_LABEL[contrato.STATUS_CONTRATO]||contrato.STATUS_CONTRATO}
                  </span>
                  {diasAteVenc===0&&<Badge c={YEL}>Vence Hoje</Badge>}
                  {cli?.PERFIL_COBRANCA&&<Badge c={PERFIL_COR[cli.PERFIL_COBRANCA]||MUTED}>{PERFIL_LABEL[cli.PERFIL_COBRANCA]||cli.PERFIL_COBRANCA}</Badge>}
                  {prioridadeCob&&prioridadeCob.nivel!==0&&prioridadeBadge(prioridadeCob)}
                  {prioridadeCob&&prioridadeCob.nivel>0&&<Badge c={MUTED}>{prioridadeCob.nivelLabel}</Badge>}
                </div>
                {prioridadeCob&&prioridadeCob.nivel>=2&&(
                  <div style={{fontSize:11,color:MUTED,marginTop:8,fontStyle:"italic"}}>→ {prioridadeCob.acao}</div>
                )}
              </div>
              <button className="modal-close-btn" onClick={onFechar} style={{background:"transparent",border:"none",width:34,height:34,borderRadius:10,cursor:"pointer",color:MUTED,display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
              </button>
            </div>
          </div>

          {/* BODY */}
          <div style={{flex:1,overflowY:"auto",padding:mob?"0 16px 16px":"0 24px 20px",display:"flex",flexDirection:"column",gap:16}}>

            {/* GRADIENT CARD */}
            <div style={{background:GRN,borderRadius:14,padding:mob?"16px 18px":"18px 20px",color:ONBRAND}}>
              <div style={{fontSize:13,fontWeight:400,color:ONBRANDSOFT,marginBottom:6}}>{contrato.NOME_CLIENTE}</div>
              <div className="num" style={{fontSize:mob?26:30,letterSpacing:"0.5px",lineHeight:1,marginBottom:6}}>{fmtR(contrato.VALOR_TOTAL||contrato.VALOR_PRINCIPAL)}</div>
              {parseFloat(contrato.VALOR_TOTAL||0)>0&&parseFloat(contrato.VALOR_TOTAL)!==parseFloat(contrato.VALOR_PRINCIPAL||0)&&(
                <div style={{fontSize:11,color:ONBRANDSOFT+"CC",display:"flex",gap:10,marginBottom:8,flexWrap:"wrap"}}>
                  <span>Principal: {fmtR(contrato.VALOR_PRINCIPAL)}</span>
                  <span>·</span>
                  <span>Juros totais: {fmtR(parseFloat(contrato.VALOR_TOTAL)-parseFloat(contrato.VALOR_PRINCIPAL||0))}</span>
                </div>
              )}
              <div style={{fontSize:12,color:ONBRANDSOFT+"AA",display:"flex",alignItems:"center",gap:6}}>
                <span>{parcsPagas > 0 ? parcsPagas : 0} de {contrato.NUM_PARCELAS} parcelas</span>
                {taxa>0&&<><span>·</span><span>{(taxa*100).toFixed(1)}% a.m.</span></>}
              </div>
            </div>

            {/* TABLE ROWS */}
            <div>
              {[
                {l:"Próximo vencimento",v:proxParcela?(proxParcela.DATA_ACORDO?`${fmtDtLong(proxParcela.DATA_ACORDO)} (acordo)`:fmtDtLong(proxParcela.DATA_VENCIMENTO)):"—",c:diasAteVenc!==null&&diasAteVenc<0?RED:diasAteVenc===0?YEL:TEXT},
                ...(!proxParcela?[{l:"Valor da parcela",v:fmtR(contrato.VALOR_PARCELA),c:TEXT}]:[]),
                ...(taxa>0?[{l:`Juros do mês (${(taxa*100).toFixed(1)}% a.m.)`,v:fmtR(juros),c:TEXT}]:[]),
                {l:stLoss?"Prejuízo remanescente":"Saldo devedor",v:fmtR(saldoDevedor),c:saldoDevedor>0?RED:MUTED},
                ...(isAcordoAssistido?[
                  {l:"Capital recuperado",v:fmtR(abatidoAssistido),c:abatidoAssistido>0?BLU:MUTED},
                  {l:"Capital restante",v:fmtR(capitalRestante),c:capitalRestante>0?RED:GRN},
                  ...(lucroRemanescente>0?[{l:"Juros suspensos (potencial)",v:fmtR(lucroRemanescente),c:ORG}]:[]),
                ]:[]),
                {l:"Total pago até hoje",v:fmtR(totalPago),c:totalPago>0?GRN:MUTED},
                ...(parseInt(contrato.TOTAL_SOMENTE_JUROS||0)>0?[{
                  l:"Prorrogações usadas",
                  v:`${contrato.TOTAL_SOMENTE_JUROS}`,
                  c:parseInt(contrato.TOTAL_SOMENTE_JUROS)>=3?RED:YEL
                }]:[]),
                ...(pendentes.length===0&&!stLoss?[{
                  l:"Encerramento",
                  v:contrato.STATUS_CONTRATO==="quitado"?"Quitado":contrato.STATUS_CONTRATO==="cancelado"?"Cancelado":"Concluído",
                  c:contrato.STATUS_CONTRATO==="cancelado"?MUTED:GRN
                }]:[]),
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
                  <div style={{background:GRN,width:`${Math.min(100,Math.max(0,pct))}%`,height:"100%",borderRadius:99,transition:"width 0.5s ease"}}/>
                </div>
              </div>
            )}

            {/* PRÓXIMA PARCELA */}
            {proxParcela&&(
              <div style={{background:"rgba(168,224,63,0.09)",borderRadius:12,padding:"16px 18px"}}>
                <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",gap:12}}>
                  <div style={{fontSize:14,fontWeight:700,color:TEXT}}>Próxima parcela</div>
                  <div style={{fontSize:mob?20:24,fontWeight:900,color:GRN,letterSpacing:"0.3px",flexShrink:0}}>{fmtR(proxParcela.VALOR_PARCELA)}</div>
                </div>
                {parseFloat(proxParcela.VALOR_JUROS||0)>0&&(
                  <div style={{display:"flex",gap:16,marginTop:8}}>
                    <span style={{fontSize:11,color:MUTED}}>Principal: <strong style={{color:TEXT,fontWeight:700}}>{fmtR(proxParcela.VALOR_PRINCIPAL||0)}</strong></span>
                    <span style={{fontSize:11,color:MUTED}}>Juros: <strong style={{color:TEXT,fontWeight:700}}>{fmtR(proxParcela.VALOR_JUROS||0)}</strong></span>
                  </div>
                )}
              </div>
            )}

            {/* ALTERAR VENCIMENTO */}
            {altVencOpen&&(
              <div style={{display:"flex",flexDirection:"column",gap:10,padding:"14px 16px",borderRadius:10,background:BG,border:`1px solid ${BD}`}}>
                <div style={{fontSize:12,color:MUTED,fontWeight:600}}>Nova data da próxima parcela pendente — somente parcelas futuras serão ajustadas (+1 mês cada). Parcelas em atraso não são alteradas.</div>
                <div style={{display:"flex",alignItems:"center",gap:8,flexWrap:"wrap"}}>
                  <input type="date" value={altVencDate} onChange={e=>setAltVencDate(e.target.value)} autoFocus
                    style={{padding:"8px 12px",borderRadius:7,border:`1.5px solid ${GRN}50`,background:CARD,color:TEXT,fontSize:14,fontWeight:700,outline:"none",cursor:"pointer"}}/>
                  <button onClick={async()=>{
                    if(!altVencDate){setAltVencErr("Selecione uma data");return;}
                    setAltVencLoad(true);setAltVencErr("");
                    const r=await postAction({action:"alterarVencimento",idContrato:contrato.ID_CONTRATO,novaData:altVencDate});
                    setAltVencLoad(false);
                    if(r?.ok){setAltVencOpen(false);setAltVencDate("");onAlterarVencimento&&onAlterarVencimento();}
                    else setAltVencErr(r?.erro||"Erro ao salvar");
                  }} disabled={altVencLoad} style={{padding:"8px 16px",borderRadius:7,border:"none",background:GRN,color:ONBRAND,fontWeight:700,fontSize:12,cursor:"pointer",opacity:altVencLoad?0.6:1}}>
                    {altVencLoad?<><IcoSpinner color={ONBRAND}/> Salvando...</>:"Confirmar"}
                  </button>
                  <button onClick={()=>{setAltVencOpen(false);setAltVencDate("");setAltVencErr("");}} style={{padding:"8px 12px",borderRadius:7,border:`1px solid ${BD}`,background:"transparent",color:MUTED,fontWeight:600,fontSize:12,cursor:"pointer"}}>Cancelar</button>
                </div>
                {altVencErr&&<span style={{color:RED,fontSize:11,fontWeight:700}}>{altVencErr}</span>}
              </div>
            )}

            {pixSalvoExpirado&&!pixOk&&<div style={{padding:"8px 12px",borderRadius:8,background:RED+"10",color:RED,fontSize:12,fontWeight:600}}>⚠️ O PIX salvo desta parcela venceu (mais de 30 dias de atraso) — gere um código novo antes de cobrar o cliente.</div>}
            {pixErr&&<div style={{padding:"8px 12px",borderRadius:8,background:RED+"10",color:RED,fontSize:12,fontWeight:600}}>{pixErr}</div>}
            {pixOk&&<div style={{padding:"8px 12px",borderRadius:8,background:GRN+"10",color:GRN,fontSize:12,fontWeight:700,display:"flex",alignItems:"center",gap:5}}>{IcoCheck} PIX gerado!</div>}
            {sairErr&&<div style={{padding:"8px 12px",borderRadius:8,background:RED+"10",color:RED,fontSize:12,fontWeight:600}}>{sairErr}</div>}
          </div>

          {/* FOOTER */}
          {(()=>{
            const temAdm = ps.length>0||(podeRegistrar&&pendentes.length>0)||(podeRegistrar&&podeBaixar)||podeExcluir||podeAcordoAssistido||isAcordoAssistido||podeAjuizar||isJudicial||isEncerradoJudicial||podeRecuperar;
            const _allTermPs=ps.length>0&&ps.every(p=>_ST_TERMINAL.has(String(p.STATUS||"").toLowerCase()));
            const _isContratoQuitado=_allTermPs&&(contrato.STATUS_CONTRATO==="quitado"||contrato.STATUS_CONTRATO==="renegociado"||ps.some(p=>["pago","quitacao_antecipada"].includes(String(p.STATUS||"").toLowerCase())));
            const _openAltVenc = () => {
              const p0=pendentes[0];const d=p0?parseDate(p0.DATA_VENCIMENTO):null;
              const ymd=d?`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`:"";
              setAltVencDate(ymd);setAltVencOpen(true);setAltVencErr("");setMaisAcoesOpen(false);
            };
            return(
              <div style={{padding:"12px 16px 16px",background:CARD,flexShrink:0,position:"relative"}}>
                {/* DROPDOWN MAIS AÇÕES */}
                {maisAcoesOpen&&temAdm&&(
                  <div style={{position:"absolute",bottom:"calc(100% + 4px)",right:16,background:CARD,border:`1px solid ${BD}`,borderRadius:10,boxShadow:"0 8px 24px rgba(0,0,0,0.14)",minWidth:200,zIndex:10,overflow:"hidden"}}>
                    <button onClick={()=>{setMaisAcoesOpen(false);if(_isContratoQuitado){const _pagsSemAbat=pags.filter(p=>p.TIPO_PAGAMENTO!=="abatimento_acordo_assistido");const _totPag=_pagsSemAbat.reduce((s,p)=>s+parseFloat(p.VALOR_PAGO||0),0);const _ultD=_pagsSemAbat.reduce((l,p)=>{const d=parseDate(p.DATA_PAGAMENTO);return d&&(!l||d>l)?d:l;},null);gerarComprovante(contrato,ps,cli,_totPag,_ultD);}else{gerarExtratoPDF(contrato,ps,pags,cli,eventos);}}} style={{width:"100%",padding:"11px 16px",border:"none",background:"transparent",color:TEXT,cursor:"pointer",fontSize:13,fontWeight:500,display:"flex",alignItems:"center",gap:8,textAlign:"left"}}>{IcoDoc} {_isContratoQuitado?"Comprovante de Quitação":"Extrato do Contrato"}</button>
                    <div style={{height:1,background:BD,margin:"4px 0"}}/>
                    {podeRegistrar&&pendentes.length>0&&!altVencOpen&&<button onClick={_openAltVenc} style={{width:"100%",padding:"11px 16px",border:"none",background:"transparent",color:TEXT,cursor:"pointer",fontSize:13,fontWeight:500,display:"flex",alignItems:"center",gap:8,textAlign:"left"}}>{IcoCal} Alterar vencimento</button>}
                    {podeRegistrar&&pendentes.length>0&&pixCodeToShow&&<button onClick={()=>{setMaisAcoesOpen(false);_gerarPix();}} disabled={pixLoad} title="Substitui o código PIX salvo por um novo, com a data e o valor recalculados" style={{width:"100%",padding:"11px 16px",border:"none",background:"transparent",color:TEXT,cursor:pixLoad?"default":"pointer",fontSize:13,fontWeight:500,display:"flex",alignItems:"center",gap:8,textAlign:"left",opacity:pixLoad?0.6:1}}>{IcoRepeat} Gerar PIX novamente</button>}
                    {podeRegistrar&&pendentes.length>0&&<button onClick={()=>{setMaisAcoesOpen(false);onQuitacaoAntecipada&&onQuitacaoAntecipada(contrato);}} style={{width:"100%",padding:"11px 16px",border:"none",background:"transparent",color:TEXT,cursor:"pointer",fontSize:13,fontWeight:500,display:"flex",alignItems:"center",gap:8,textAlign:"left"}}>{IcoZap} Quitar antecipado</button>}
                    {podeRenegociar&&<button onClick={()=>{setMaisAcoesOpen(false);onRenegociar&&onRenegociar(contrato);}} style={{width:"100%",padding:"11px 16px",border:"none",background:"transparent",color:PUR,cursor:"pointer",fontSize:13,fontWeight:500,display:"flex",alignItems:"center",gap:8,textAlign:"left"}}>{IcoRepeat} Renegociar contrato</button>}
                    {(podeRegistrar&&podeBaixar)&&<button onClick={()=>{setMaisAcoesOpen(false);onBaixar(contrato);}} style={{width:"100%",padding:"11px 16px",border:"none",background:"transparent",color:RED,cursor:"pointer",fontSize:13,fontWeight:500,display:"flex",alignItems:"center",gap:8,textAlign:"left"}}>{IcoAlert} Encerrar contrato</button>}
                    {podeAcordoAssistido&&<button onClick={()=>{setMaisAcoesOpen(false);onAcordoAssistido&&onAcordoAssistido(contrato);}} style={{width:"100%",padding:"11px 16px",border:"none",background:"transparent",color:BLU,cursor:"pointer",fontSize:13,fontWeight:500,display:"flex",alignItems:"center",gap:8,textAlign:"left"}}>{IcoHandshake} Acordo assistido</button>}
                    {podeAjuizar&&<button onClick={()=>{setMaisAcoesOpen(false);onAjuizar&&onAjuizar(contrato);}} style={{width:"100%",padding:"11px 16px",border:"none",background:"transparent",color:RED,cursor:"pointer",fontSize:13,fontWeight:500,display:"flex",alignItems:"center",gap:8,textAlign:"left"}}>{IcoJur} Ajuizar contrato</button>}
                    {podeRecuperar&&<button onClick={()=>{setMaisAcoesOpen(false);onRecuperar&&onRecuperar(contrato);}} style={{width:"100%",padding:"11px 16px",border:"none",background:"transparent",color:PUR,cursor:"pointer",fontSize:13,fontWeight:500,display:"flex",alignItems:"center",gap:8,textAlign:"left"}}><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg> Registrar Recuperação</button>}
                    {(isJudicial||isEncerradoJudicial)&&<><div style={{height:1,background:BD,margin:"4px 0"}}/><button onClick={()=>{setMaisAcoesOpen(false);setHistPanel(true);setAbaPanel("juridico");}} style={{width:"100%",padding:"11px 16px",border:"none",background:"transparent",color:RED,cursor:"pointer",fontSize:13,fontWeight:500,display:"flex",alignItems:"center",gap:8,textAlign:"left"}}>{IcoJur} Dados jurídicos</button></>}
                    {podeAcordoJudicial&&<button onClick={()=>{setMaisAcoesOpen(false);onAcordoJudicial&&onAcordoJudicial(contrato);}} style={{width:"100%",padding:"11px 16px",border:"none",background:"transparent",color:BLU,cursor:"pointer",fontSize:13,fontWeight:500,display:"flex",alignItems:"center",gap:8,textAlign:"left"}}>{IcoHandshake} Registrar Acordo Judicial</button>}
                    {podeQuitacaoJudicial&&<button onClick={()=>{setMaisAcoesOpen(false);onQuitacaoJudicial&&onQuitacaoJudicial(contrato);}} style={{width:"100%",padding:"11px 16px",border:"none",background:"transparent",color:GRN,cursor:"pointer",fontSize:13,fontWeight:500,display:"flex",alignItems:"center",gap:8,textAlign:"left"}}>{IcoCheck} Quitação Judicial</button>}
                    {podeArquivarProcesso&&<button onClick={()=>{setMaisAcoesOpen(false);onArquivarProcesso&&onArquivarProcesso(contrato);}} style={{width:"100%",padding:"11px 16px",border:"none",background:"transparent",color:MUTED,cursor:"pointer",fontSize:13,fontWeight:500,display:"flex",alignItems:"center",gap:8,textAlign:"left"}}>{IcoTrash} Arquivar Processo</button>}
                    {isAcordoAssistido&&<>
                      <button onClick={()=>{setMaisAcoesOpen(false);onAbatimento&&onAbatimento(contrato);}} style={{width:"100%",padding:"11px 16px",border:"none",background:"transparent",color:BLU,cursor:"pointer",fontSize:13,fontWeight:500,display:"flex",alignItems:"center",gap:8,textAlign:"left"}}>+ Abatimento</button>
                      <button onClick={()=>{setMaisAcoesOpen(false);sairDoAcordo();}} disabled={sairLoad} style={{width:"100%",padding:"11px 16px",border:"none",background:"transparent",color:GRN,cursor:sairLoad?"default":"pointer",fontSize:13,fontWeight:500,display:"flex",alignItems:"center",gap:8,textAlign:"left",opacity:sairLoad?0.6:1}}>{sairLoad?<IcoSpinner size={11}/>:"↩"} Retornar ao contrato</button>
                      <button onClick={()=>{setMaisAcoesOpen(false);onBaixar&&onBaixar(contrato);}} style={{width:"100%",padding:"11px 16px",border:"none",background:"transparent",color:RED,cursor:"pointer",fontSize:13,fontWeight:500,display:"flex",alignItems:"center",gap:8,textAlign:"left"}}>{IcoAlert} Encerrar contrato</button>
                    </>}
                    {podeExcluir&&<><div style={{height:1,background:BD,margin:"4px 0"}}/><button onClick={()=>{setMaisAcoesOpen(false);setDelConfirm(true);setDelErr("");}} style={{width:"100%",padding:"11px 16px",border:"none",background:"transparent",color:RED,cursor:"pointer",fontSize:13,fontWeight:700,display:"flex",alignItems:"center",gap:8,textAlign:"left"}}>{IcoTrash} Excluir contrato</button></>}
                  </div>
                )}
                {/* BOTÕES PRINCIPAIS */}
                <div style={{display:"flex",gap:8,alignItems:"center"}}>
                  {podeRegistrar&&pendentes.length>0
                    ?<>
                      <button onClick={()=>onRegistrarPagamento(pendentes[0])} style={{...BTN1(false),flex:1}}>
                        {IcoCheck} Registrar Pagamento
                      </button>
                      {pixCodeToShow
                        ?<button onClick={_enviarPixWpp} disabled={pixWppLoad} title={pixWppErr||"Enviar código PIX via WhatsApp"} style={{padding:"14px 16px",borderRadius:12,border:`1.5px solid ${pixWppOk?"#25D366":pixWppErr?RED:"#25D366"}`,background:pixWppOk?"#25D36618":pixWppErr?RED+"10":"#25D36618",color:pixWppOk?"#25D366":pixWppErr?RED:"#25D366",cursor:pixWppLoad?"default":"pointer",display:"flex",alignItems:"center",gap:6,transition:"all 0.2s",flexShrink:0,opacity:pixWppLoad?0.7:1,fontWeight:700,fontSize:13,whiteSpace:"nowrap"}}>
                          {pixWppLoad?<><IcoSpinner size={12}/> Enviando...</>:pixWppOk?<>{IcoCheck} Enviado!</>:<>{IcoWpp} Enviar PIX</>}
                        </button>
                        :<button onClick={()=>onComprovante&&onComprovante(contrato,ps,cli)} style={{...BTN3(),whiteSpace:"nowrap",padding:"14px 14px"}}>
                          {IcoPhone}
                        </button>
                      }
                      {pixCodeToShow
                        ?<button onClick={_copiarPix} title={pixCodeToShow} style={{padding:"14px 14px",borderRadius:12,border:`1.5px solid ${pixCopied?GRN:BD}`,background:pixCopied?GRN+"18":CARD,color:pixCopied?GRN:MUTED,cursor:"pointer",fontSize:12,fontWeight:600,display:"flex",alignItems:"center",gap:4,transition:"all 0.2s",flexShrink:0}}>
                          {pixCopied?IcoCheck:<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>}
                        </button>
                        :<button onClick={_gerarPix} disabled={pixLoad} style={{padding:"14px 16px",borderRadius:12,border:`1.5px solid ${pixSalvoExpirado?RED:BD}`,background:pixSalvoExpirado?RED+"10":CARD,color:pixSalvoExpirado?RED:TEXT,cursor:pixLoad?"default":"pointer",fontSize:13,fontWeight:600,display:"flex",alignItems:"center",gap:5,opacity:pixLoad?0.7:1,whiteSpace:"nowrap"}}>
                          {pixLoad?<IcoSpinner size={12}/>:null}{pixLoad?"...":(pixSalvoExpirado?"Gerar novo PIX":"Gerar PIX")}
                        </button>
                      }
                    </>
                    :<button onClick={()=>onComprovante&&onComprovante(contrato,ps,cli)} style={{...BTN1(false),flex:1}}>
                      {IcoPhone} Enviar Comprovante
                    </button>
                  }
                  {temAdm&&<button onClick={()=>setMaisAcoesOpen(p=>!p)} style={{padding:"14px 12px",borderRadius:12,border:`1.5px solid ${maisAcoesOpen?GRN:BD}`,background:maisAcoesOpen?GRN+"12":CARD,color:maisAcoesOpen?GRN:MUTED,cursor:"pointer",fontSize:12,fontWeight:600,display:"flex",alignItems:"center",gap:4,whiteSpace:"nowrap",flexShrink:0,transition:"all 0.2s"}}>
                    Mais ações <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points={maisAcoesOpen?"18,15 12,9 6,15":"6,9 12,15 18,9"}/></svg>
                  </button>}
                </div>
              </div>
            );
          })()}
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
                {[["parcelas",`Parcelas (${ps.length})`],["timeline","Linha do Tempo"],...((isJudicial||isEncerradoJudicial)?[["juridico","⚖ Jurídico"]]:[])]
                  .map(([id,lbl])=>(
                  <button key={id} onClick={()=>setAbaPanel(id)} style={{padding:"5px 10px",borderRadius:6,border:"none",background:abaPanel===id?(id==="juridico"?RED+"18":CARD):"transparent",color:abaPanel===id?(id==="juridico"?RED:GRN):MUTED,fontSize:11,fontWeight:700,cursor:"pointer"}}>{lbl}</button>
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
                    const isSubstituida=st==="renegociado";
                    const isNovaParcela=String(p.ORIGEM_PARCELA||"").toLowerCase()==="renegociada";
                    const foiPago=parseFloat(p.VALOR_PAGO||0)>0;
                    const sitCor=isSubstituida?MUTED:(stCor[st]||MUTED);
                    const sitLbl=isSubstituida?"Substituída":(stLabel[st]||_ST_LABEL[st]||st);
                    const ativa=!_ST_TERMINAL.has(st);
                    const diasAtraso=st==="atrasado"
                      ?Math.max(1,Math.round((new Date()-parseDate(p.DATA_VENCIMENTO))/86400000))
                      :(foiPago&&parseInt(p.DIAS_ATRASO||0)>0?parseInt(p.DIAS_ATRASO):0);
                    const diasAtrasoCor=st==="atrasado"?RED:YEL;
                    return(
                      <tr key={p.ID_PARCELA||i} style={{borderBottom:`1px solid ${BD}`,fontSize:12,background:i%2===0?CARD:BG,opacity:isSubstituida?0.5:1}}>
                        <td style={{padding:"9px 14px",color:MUTED,fontWeight:600}}>{p.NUM_PARCELA}{isUltima(p,ps)&&<span style={{fontSize:8,fontWeight:800,color:GRN,background:GRN+"18",padding:"1px 4px",borderRadius:99,marginLeft:4}}>ult.</span>}</td>
                        <td style={{fontWeight:600,color:isSubstituida?MUTED:TEXT,fontSize:11}}>
                          {p.DATA_ACORDO?(
                            <div style={{display:"flex",flexDirection:"column",gap:1}}>
                              <span style={{fontSize:9,color:MUTED,textDecoration:"line-through"}}>{fmtDt(p.DATA_VENCIMENTO)}</span>
                              <span style={{color:ORG}}>{fmtDt(p.DATA_ACORDO)}<span style={{fontSize:8,fontWeight:800,background:ORG+"18",padding:"1px 4px",borderRadius:99,marginLeft:3}}>acordo</span></span>
                            </div>
                          ):fmtDt(p.DATA_VENCIMENTO)}
                        </td>
                        <td><Badge c={sitCor}>{sitLbl}</Badge>{isNovaParcela&&<span style={{fontSize:9,color:PUR,background:PUR+"18",padding:"1px 5px",borderRadius:99,fontWeight:800,marginLeft:4}}>↺ nova</span>}{diasAtraso>0&&<div style={{fontSize:9,color:diasAtrasoCor,fontWeight:700,marginTop:2}}>{diasAtraso}d atraso</div>}</td>
                        <td style={{textAlign:"right",padding:"9px 14px",fontWeight:700,color:isSubstituida?MUTED:(foiPago?GRN:TEXT),textDecoration:isSubstituida?"line-through":"none"}}>{foiPago&&!isSubstituida?fmtR(p.VALOR_PAGO):fmtR(p.VALOR_PARCELA)}</td>
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
                          <div style={{display:"flex",flexDirection:"column",alignItems:"center",marginRight:12,flexShrink:0}}>
                            <div style={{width:20,height:20,borderRadius:"50%",background:ev.cor+"20",border:`2px solid ${ev.cor}`,display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0,marginTop:12,fontSize:9,color:ev.cor,fontWeight:900,zIndex:1}}>
                              {ev.tipo==="criacao"?"★":ev.tipo==="reagendamento"?"↻":"✓"}
                            </div>
                            {i<timelineEvents.length-1&&<div style={{flex:1,width:2,background:BD,minHeight:12}}/>}
                          </div>
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
              {abaPanel==="juridico"&&(isJudicial||isEncerradoJudicial)&&(()=>{
                const STATUS_PROC_LABEL={EM_PREPARACAO:"Em Preparação",AJUIZADO:"Ajuizado",CITACAO_PENDENTE:"Citação Pendente",CITADO:"Citado",AUDIENCIA_DESIGNADA:"Audiência Designada",AGUARDANDO_AUDIENCIA:"Aguardando Audiência",EM_ACORDO:"Em Acordo",EM_EXECUCAO:"Em Execução",PAGO_PARCIALMENTE:"Pago Parcialmente",QUITADO_JUDICIALMENTE:"Quitado Judicialmente",ARQUIVADO:"Arquivado",EXTINTO:"Extinto"};
                const STATUS_PROC_COR={EM_PREPARACAO:MUTED,AJUIZADO:BLU,CITACAO_PENDENTE:YEL,CITADO:YEL,AUDIENCIA_DESIGNADA:ORG,AGUARDANDO_AUDIENCIA:ORG,EM_ACORDO:GRN,EM_EXECUCAO:PUR,PAGO_PARCIALMENTE:PUR,QUITADO_JUDICIALMENTE:GRN,ARQUIVADO:MUTED,EXTINTO:MUTED};
                const spCor=STATUS_PROC_COR[contrato.STATUS_PROCESSO]||MUTED;
                const spLbl=STATUS_PROC_LABEL[contrato.STATUS_PROCESSO]||contrato.STATUS_PROCESSO||"Não definido";
                const allJuriEvents=(eventos||[]).filter(ev=>String(ev.ID_CONTRATO||"").trim()===String(contrato.ID_CONTRATO).trim()&&_TIPOS_JURI_TIMELINE.includes(String(ev.TIPO_EVENTO||"").trim())).sort((a,b)=>(parseDate(b.DATA_EVENTO)||new Date(0))-(parseDate(a.DATA_EVENTO)||new Date(0)));
                const salvarJuri=async()=>{
                  setJuriLoad(true);setJuriErr("");setJuriOk(false);
                  try{
                    const res=await postAction({action:"atualizarDadosJuridicos",idContrato:contrato.ID_CONTRATO,campos:juriDados});
                    if(res.ok){setJuriOk(true);setJuriEdit(false);setTimeout(()=>setJuriOk(false),3000);}
                    else setJuriErr(res.erro||"Erro ao salvar.");
                  }catch(e){setJuriErr(e.message);}
                  setJuriLoad(false);
                };
                const addMov=async()=>{
                  if(!movDesc.trim())return;
                  setMovLoad(true);setMovErr("");
                  try{
                    const res=await postAction({action:"adicionarMovimentacaoJuridica",idContrato:contrato.ID_CONTRATO,dados:{descricao:movDesc,data:movData}});
                    if(res.ok){setMovDesc("");setMovData(hojeStr());}
                    else setMovErr(res.erro||"Erro.");
                  }catch(e){setMovErr(e.message);}
                  setMovLoad(false);
                };
                return(
                  <div style={{padding:"12px 14px",display:"flex",flexDirection:"column",gap:14}}>
                    {/* Resumo */}
                    <div style={{background:RED+"08",border:`1px solid ${RED}30`,borderRadius:10,padding:"12px 14px"}}>
                      <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:8}}>
                        <span style={{fontSize:12,fontWeight:800,color:RED,display:"flex",alignItems:"center",gap:5}}>{IcoJur} Processo Judicial</span>
                        <span style={{fontSize:10,fontWeight:800,color:spCor,background:spCor+"18",padding:"2px 8px",borderRadius:20,border:`1px solid ${spCor}30`}}>{spLbl}</span>
                      </div>
                      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8,fontSize:11}}>
                        <div><span style={{color:MUTED,fontWeight:700,display:"block",fontSize:9,textTransform:"uppercase",letterSpacing:"0.06em",marginBottom:2}}>Nº Processo</span><span style={{color:TEXT,fontWeight:600}}>{contrato.NUMERO_PROCESSO||"—"}</span></div>
                        <div><span style={{color:MUTED,fontWeight:700,display:"block",fontSize:9,textTransform:"uppercase",letterSpacing:"0.06em",marginBottom:2}}>Ajuizado em</span><span style={{color:TEXT,fontWeight:600}}>{contrato.DATA_AJUIZAMENTO?fmtDt(parseDate(contrato.DATA_AJUIZAMENTO)):"—"}</span></div>
                        <div><span style={{color:MUTED,fontWeight:700,display:"block",fontSize:9,textTransform:"uppercase",letterSpacing:"0.06em",marginBottom:2}}>Vara</span><span style={{color:TEXT,fontWeight:600}}>{contrato.VARA||"—"}</span></div>
                        <div><span style={{color:MUTED,fontWeight:700,display:"block",fontSize:9,textTransform:"uppercase",letterSpacing:"0.06em",marginBottom:2}}>Comarca</span><span style={{color:TEXT,fontWeight:600}}>{contrato.COMARCA||"—"}</span></div>
                        <div><span style={{color:MUTED,fontWeight:700,display:"block",fontSize:9,textTransform:"uppercase",letterSpacing:"0.06em",marginBottom:2}}>Valor Executado</span><span style={{color:RED,fontWeight:700}}>{contrato.VALOR_EXECUTADO?fmtR(parseFloat(contrato.VALOR_EXECUTADO)):"—"}</span></div>
                        <div><span style={{color:MUTED,fontWeight:700,display:"block",fontSize:9,textTransform:"uppercase",letterSpacing:"0.06em",marginBottom:2}}>Próxima Ação</span><span style={{color:TEXT,fontWeight:600,fontSize:10}}>{contrato.DATA_PROXIMA_ACAO?fmtDt(parseDate(contrato.DATA_PROXIMA_ACAO)):"—"}</span></div>
                      </div>
                      {contrato.PROXIMA_ACAO&&<div style={{marginTop:8,fontSize:11,color:ORG,fontWeight:600}}>→ {contrato.PROXIMA_ACAO}</div>}
                      {contrato.ULTIMA_MOVIMENTACAO&&<div style={{marginTop:6,fontSize:11,color:MUTED}}>Última mov.: {contrato.ULTIMA_MOVIMENTACAO}</div>}
                      {/* Botões de cópia e link */}
                      <div style={{display:"flex",gap:6,marginTop:10,flexWrap:"wrap"}}>
                        {contrato.NUMERO_PROCESSO&&<button onClick={()=>navigator.clipboard.writeText(contrato.NUMERO_PROCESSO)} style={{...BTN7(MUTED),fontSize:10,padding:"4px 9px"}}>Copiar Nº</button>}
                        {contrato.CODIGO_ACESSO_PROCESSO&&<button onClick={()=>navigator.clipboard.writeText(contrato.CODIGO_ACESSO_PROCESSO)} style={{...BTN7(MUTED),fontSize:10,padding:"4px 9px"}}>Copiar Código</button>}
                        {contrato.LINK_PROCESSO&&<button onClick={()=>window.open(contrato.LINK_PROCESSO,"_blank")} style={{...BTN7(BLU),fontSize:10,padding:"4px 9px"}}>Abrir Processo ↗</button>}
                        <button onClick={()=>{setJuriEdit(p=>!p);if(!juriEdit)setJuriDados({NUMERO_PROCESSO:contrato.NUMERO_PROCESSO||"",DATA_AJUIZAMENTO:contrato.DATA_AJUIZAMENTO?apiDateStr(contrato.DATA_AJUIZAMENTO).slice(0,10):"",VARA:contrato.VARA||"",COMARCA:contrato.COMARCA||"",STATUS_PROCESSO:contrato.STATUS_PROCESSO||"EM_PREPARACAO",VALOR_EXECUTADO:String(contrato.VALOR_EXECUTADO||""),OBSERVACOES_JURIDICAS:contrato.OBSERVACOES_JURIDICAS||"",LINK_PROCESSO:contrato.LINK_PROCESSO||"",CODIGO_ACESSO_PROCESSO:contrato.CODIGO_ACESSO_PROCESSO||"",PROXIMA_ACAO:contrato.PROXIMA_ACAO||"",DATA_PROXIMA_ACAO:contrato.DATA_PROXIMA_ACAO?apiDateStr(contrato.DATA_PROXIMA_ACAO).slice(0,10):""});}} style={{...BTN7(GRN),fontSize:10,padding:"4px 9px"}}>{juriEdit?"Cancelar":"Editar"}</button>
                      </div>
                    </div>
                    {/* Situação financeira judicial */}
                    <div style={{background:CARD,border:`1px solid ${BD}`,borderRadius:10,padding:"12px 14px"}}>
                      <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:8}}>
                        <span style={{fontSize:12,fontWeight:800,color:TEXT}}>Situação Financeira</span>
                        <span style={{fontSize:10,fontWeight:800,color:SITUACAO_FIN_JUDICIAL_COR[situacaoFinJudicial]||MUTED,background:(SITUACAO_FIN_JUDICIAL_COR[situacaoFinJudicial]||MUTED)+"18",padding:"2px 8px",borderRadius:20,border:`1px solid ${(SITUACAO_FIN_JUDICIAL_COR[situacaoFinJudicial]||MUTED)}30`}}>{SITUACAO_FIN_JUDICIAL_LABEL[situacaoFinJudicial]||situacaoFinJudicial}</span>
                      </div>
                      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8,fontSize:11,marginBottom:10}}>
                        <div><span style={{color:MUTED,fontWeight:700,display:"block",fontSize:9,textTransform:"uppercase",letterSpacing:"0.06em",marginBottom:2}}>Prejuízo Remanescente</span><span style={{color:RED,fontWeight:700}}>{fmtR(parseFloat(contrato.PREJUIZO_CAPITAL||0))}</span></div>
                        <div><span style={{color:MUTED,fontWeight:700,display:"block",fontSize:9,textTransform:"uppercase",letterSpacing:"0.06em",marginBottom:2}}>Principal Recuperado</span><span style={{color:GRN,fontWeight:700}}>{fmtR(parseFloat(contrato.VALOR_RECUPERADO_JUDICIAL_PRINCIPAL||0))}</span></div>
                        <div><span style={{color:MUTED,fontWeight:700,display:"block",fontSize:9,textTransform:"uppercase",letterSpacing:"0.06em",marginBottom:2}}>Lucro Recuperado</span><span style={{color:GRN,fontWeight:700}}>{fmtR(parseFloat(contrato.VALOR_RECUPERADO_JUDICIAL_LUCRO||0))}</span></div>
                        <div><span style={{color:MUTED,fontWeight:700,display:"block",fontSize:9,textTransform:"uppercase",letterSpacing:"0.06em",marginBottom:2}}>Parcelas do Acordo</span><span style={{color:TEXT,fontWeight:600}}>{pendentesJudiciais.length} pendente(s)</span></div>
                      </div>
                      <div style={{display:"flex",gap:6,flexWrap:"wrap"}}>
                        {podeAcordoJudicial&&<button onClick={()=>onAcordoJudicial&&onAcordoJudicial(contrato)} style={{...BTN7(BLU),fontSize:10,padding:"5px 10px"}}>Registrar Acordo Judicial</button>}
                        {podeQuitacaoJudicial&&<button onClick={()=>onQuitacaoJudicial&&onQuitacaoJudicial(contrato)} style={{...BTN7(GRN),fontSize:10,padding:"5px 10px"}}>Quitação Judicial</button>}
                        {podeArquivarProcesso&&<button onClick={()=>onArquivarProcesso&&onArquivarProcesso(contrato)} style={{...BTN7(MUTED),fontSize:10,padding:"5px 10px"}}>Arquivar Processo</button>}
                      </div>
                    </div>
                    {/* Form de edição */}
                    {juriEdit&&(
                      <div style={{background:CARD,border:`1px solid ${BD}`,borderRadius:10,padding:"12px 14px",display:"flex",flexDirection:"column",gap:10}}>
                        <div style={{fontSize:12,fontWeight:800,color:TEXT}}>Editar Dados Jurídicos</div>
                        {[["NUMERO_PROCESSO","Nº Processo","text"],["VARA","Vara","text"],["COMARCA","Comarca","text"],["VALOR_EXECUTADO","Valor Executado (R$)","number"],["LINK_PROCESSO","Link do Processo","text"],["CODIGO_ACESSO_PROCESSO","Código de Acesso","text"],["PROXIMA_ACAO","Próxima Ação","text"],["OBSERVACOES_JURIDICAS","Observações","text"]].map(([f,lbl,tp])=>(
                          <div key={f}><span style={{...LS()}}>{lbl}</span><input type={tp} value={juriDados[f]||""} onChange={e=>setJuriDados(p=>({...p,[f]:e.target.value}))} style={IS()}/></div>
                        ))}
                        {[["DATA_AJUIZAMENTO","Data Ajuizamento"],["DATA_PROXIMA_ACAO","Data Próxima Ação"]].map(([f,lbl])=>(
                          <div key={f}><span style={{...LS()}}>{lbl}</span><input type="date" value={juriDados[f]||""} onChange={e=>setJuriDados(p=>({...p,[f]:e.target.value}))} style={IS()}/></div>
                        ))}
                        <div><span style={{...LS()}}>Status Processual</span>
                          <select value={juriDados["STATUS_PROCESSO"]||"EM_PREPARACAO"} onChange={e=>setJuriDados(p=>({...p,STATUS_PROCESSO:e.target.value}))} style={IS()}>
                            {[["EM_PREPARACAO","Em Preparação"],["AJUIZADO","Ajuizado"],["CITACAO_PENDENTE","Citação Pendente"],["CITADO","Citado"],["AUDIENCIA_DESIGNADA","Audiência Designada"],["AGUARDANDO_AUDIENCIA","Aguardando Audiência"],["EM_ACORDO","Em Acordo"],["EM_EXECUCAO","Em Execução"],["PAGO_PARCIALMENTE","Pago Parcialmente"],["QUITADO_JUDICIALMENTE","Quitado Judicialmente"],["ARQUIVADO","Arquivado"],["EXTINTO","Extinto"]].map(([v,l])=><option key={v} value={v}>{l}</option>)}
                          </select>
                        </div>
                        {juriErr&&<div style={{padding:"8px 10px",borderRadius:8,background:RED+"10",color:RED,fontSize:12,fontWeight:600}}>{juriErr}</div>}
                        {juriOk&&<div style={{padding:"8px 10px",borderRadius:8,background:GRN+"10",color:GRN,fontSize:12,fontWeight:700}}>Salvo com sucesso!</div>}
                        <button onClick={salvarJuri} disabled={juriLoad} style={{...BTN1(juriLoad),marginTop:2}}>{juriLoad?<><IcoSpinner color="#07241B"/> Salvando...</>:"Salvar"}</button>
                      </div>
                    )}
                    {/* Add movimentação */}
                    <div style={{background:CARD,border:`1px solid ${BD}`,borderRadius:10,padding:"12px 14px"}}>
                      <div style={{fontSize:12,fontWeight:800,color:TEXT,marginBottom:8}}>+ Registrar Movimentação</div>
                      <div style={{display:"flex",flexDirection:"column",gap:8}}>
                        <div><span style={{...LS()}}>Data</span><input type="date" value={movData} onChange={e=>setMovData(e.target.value)} style={IS()}/></div>
                        <div><span style={{...LS()}}>Descrição</span><input value={movDesc} onChange={e=>setMovDesc(e.target.value)} placeholder="Ex: Audiência realizada, decisão proferida..." style={IS()}/></div>
                        {movErr&&<div style={{padding:"6px 8px",borderRadius:6,background:RED+"10",color:RED,fontSize:11,fontWeight:600}}>{movErr}</div>}
                        <button onClick={addMov} disabled={movLoad||!movDesc.trim()} style={{...BTN1(movLoad||!movDesc.trim())}}>{movLoad?<><IcoSpinner color="#07241B"/> Registrando...</>:"Registrar"}</button>
                      </div>
                    </div>
                    {/* Timeline de movimentações */}
                    {allJuriEvents.length>0&&(
                      <div>
                        <div style={{fontSize:11,fontWeight:800,color:MUTED,textTransform:"uppercase",letterSpacing:"0.07em",marginBottom:8}}>Histórico Judicial</div>
                        <div style={{display:"flex",flexDirection:"column",gap:0}}>
                          {allJuriEvents.map((ev,i)=>(
                            <div key={i} style={{display:"flex",gap:10,paddingBottom:12,borderBottom:i<allJuriEvents.length-1?`1px solid ${BD}`:"none",paddingTop:i>0?12:0}}>
                              <div style={{width:28,height:28,borderRadius:"50%",background:RED+"18",border:`2px solid ${RED}40`,display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0,marginTop:1,fontSize:10,color:RED,fontWeight:900}}>⚖</div>
                              <div style={{flex:1}}>
                                <div style={{display:"flex",justifyContent:"space-between",gap:4}}>
                                  <div style={{fontSize:12,fontWeight:700,color:TEXT}}>{_JURI_EVENTO_LABEL[String(ev.TIPO_EVENTO||"").trim()]||"Movimentação"}</div>
                                  <div style={{fontSize:10,color:MUTED,whiteSpace:"nowrap"}}>{ev.DATA_EVENTO?fmtDt(parseDate(ev.DATA_EVENTO)):"—"}</div>
                                </div>
                                <div style={{fontSize:11,color:MUTED,marginTop:2}}>{ev.OBSERVACOES||"—"}</div>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })()}
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
            <div><span style={LS()}>Valor Prometido (R$)</span><input type="number" value={valorPrometido} onChange={e=>setValorPrometido(e.target.value)} onPaste={e=>pasteMoeda(e,setValorPrometido)} placeholder="0.00" style={IS()}/></div>
          </div>
          <div><span style={LS()}>Observação</span><input value={observacao} onChange={e=>setObservacao(e.target.value)} placeholder="Opcional" style={IS()}/></div>
          {msg&&<div style={{padding:"10px 14px",borderRadius:8,background:msg.ok?GRN+"10":RED+"10",color:msg.ok?GRN:RED,fontSize:13,fontWeight:700,border:`1px solid ${msg.ok?GRN:RED}25`}}>{""}{msg.t}</div>}
          <div style={{display:"flex",gap:10}}>
            <button onClick={onFechar} style={{...BTN6(),flex:1}}>Cancelar</button>
            <button onClick={confirmar} disabled={loading||!cliente||!contratoId||!dataPrevista||!valorPrometido} style={{...BTN1(loading||!cliente||!contratoId||!dataPrevista||!valorPrometido),flex:2}}>
              {loading?<><IcoSpinner color="#07241B"/> Registrando...</>:<>{IcoCheck} Registrar Promessa</>}
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

  const realocar=async()=>{
    if(!numParc){alert("Não foi possível identificar o número da parcela.");return;}
    const candidatas=hist.filter(p=>String(p.NUM_PARCELA)!==String(numParc)&&!_ST_TERMINAL.has(String(p.STATUS||p.STATUS_PAGAMENTO||"").toLowerCase()));
    if(!candidatas.length){alert("Não há outra parcela em aberto neste contrato para realocar o pagamento.");return;}
    const lista=candidatas.map(p=>`#${p.NUM_PARCELA} — venc. ${fmtDt(parseDate(p.DATA_VENCIMENTO))}`).join("\n");
    const escolha=window.prompt(`Realocar o pagamento de ${fmtR(pag.VALOR_PAGO)} da parcela ${numParc} para qual parcela?\n\n${lista}\n\nDigite o número da parcela de destino:`);
    if(escolha===null)return;
    const destino=candidatas.find(p=>String(p.NUM_PARCELA)===String(escolha).trim());
    if(!destino){alert("Número de parcela inválido.");return;}
    if(!window.confirm(`Confirma: mover o pagamento de ${fmtR(pag.VALOR_PAGO)} da parcela ${numParc} para a parcela ${destino.NUM_PARCELA}?\n\nIsso desfaz o pagamento na parcela ${numParc} (volta pendente/atrasado) e registra o mesmo valor/data na parcela ${destino.NUM_PARCELA}.`))return;
    const motivo=window.prompt("Motivo da realocação (opcional):")||"";
    setLoading(true);
    try{
      const res=await postAction({action:"realocarPagamento",idContrato:pag.ID_CONTRATO,idCliente:pag.ID_CLIENTE,numParcelaOrigem:String(numParc),numParcelaDestino:String(destino.NUM_PARCELA),idPagamento:pag.ID_PAGAMENTO,motivo});
      if(res.ok){onReabrir();onFechar();}else alert("Erro: "+(res.erro||"falha ao realocar"));
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
              {parseFloat(pag.RECEITA_EXTRA_ATRASO||0)>0&&<Info l="Mora/Multa" v={fmtR(pag.RECEITA_EXTRA_ATRASO)} c={ORG}/>}
              {parseFloat(pag.FEE_PRORROGACAO||0)>0&&<Info l="Fee Prorrogação" v={fmtR(pag.FEE_PRORROGACAO)} c={YEL}/>}
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
                    const isSubstH=_stH==="renegociado";
                    const _corH=isSubstH?MUTED:({pago:GRN,quitacao_antecipada:GRN,atrasado:RED,vence_hoje:ORG,pendente:BLU}[_stH]||YEL);
                    const _lblH=isSubstH?"Substituída":(_ST_LABEL[_stH]||_stH);
                    const isAtual=String(p.NUM_PARCELA||"")===String(numParc||"");
                    return<tr key={i} style={{borderTop:`1px solid ${BD}`,background:isAtual?ORG+"08":"transparent",opacity:isSubstH?0.5:1}}>
                      <td style={{padding:"7px 12px",fontWeight:isAtual?800:400,color:isAtual?ORG:TEXT}}>{p.NUM_PARCELA}</td>
                      <td style={{padding:"7px 12px",color:MUTED}}>{fmtDt(parseDate(p.DATA_VENCIMENTO))}</td>
                      <td style={{padding:"7px 12px",textAlign:"right",textDecoration:isSubstH?"line-through":"none",color:isSubstH?MUTED:TEXT}}>{fmtR(p.VALOR_PARCELA)}</td>
                      <td style={{padding:"7px 12px"}}><Badge c={_corH}>{_lblH}</Badge></td>
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
          <button onClick={realocar} disabled={loading} style={{...BTN5(ORG),flex:1,opacity:loading?0.7:1}}>{loading?<><IcoSpinner color={ORG}/> Processando...</>:<>{IcoArrL} Realocar</>}</button>
          <button onClick={reabrir} disabled={loading} style={{...BTN5(RED),flex:1,opacity:loading?0.7:1}}>{loading?<><IcoSpinner color={RED}/> Processando...</>:<>{IcoArrL} Reabrir</>}</button>
        </div>
      </div>
    </div>
  );
}

// ─── COMPROVANTE DE QUITAÇÃO ─────────────────────────────────────
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

function abrirWhatsApp(telefone, nomeCliente) {
  const num = String(telefone||'').replace(/\D/g,'');
  if(!num || num.length < 10) { alert('Telefone do cliente não cadastrado.'); return; }
  const numFull = num.startsWith('55') ? num : '55' + num;
  const msg = encodeURIComponent("Parabens, seu contrato de emprestimo foi finalizado com sucesso!\n\nQuero agradecer pela confianca e pela seriedade em cumprir nosso acordo. Foi um prazer poder te ajudar!\nSempre que precisar, estarei a disposicao para um novo emprestimo.\n\nDesejo uma otima tarde e uma semana incrivel!");
  window.open(`https://wa.me/${numFull}?text=${msg}`,'_blank');
}

function abrirWhatsAppNovoAtraso1(telefone, nome, dias) {
  const num = String(telefone||'').replace(/\D/g,'');
  if(!num || num.length < 10) { alert('Telefone do cliente não cadastrado.'); return; }
  const numFull = num.startsWith('55') ? num : '55' + num;
  const msg = encodeURIComponent(`Olá ${nome}, tudo bem? Notei que a 1ª parcela do seu contrato venceu há ${dias} dia${dias>1?'s':''} e ainda não identificamos o pagamento. Pode verificar, por favor? Qualquer dúvida, estou à disposição.`);
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
  const clienteDefaultsApplied=useRef(null);
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
    if(simInicial){
      setValor(simInicial.valor||1000);
      setPrazo(simInicial.prazo||6);
      setTaxa(simInicial.taxa||14);
      setClienteSel(null);
      clienteDefaultsApplied.current=simInicial.ID_CLIENTE||"simInicial";
    }
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
    if(s>=90)return`score ${s} (excelente)`;
    if(s>=75)return`score ${s} (bom)`;
    if(s>=60)return`score ${s} (médio)`;
    if(s>=45)return`score ${s} (atenção)`;
    if(s>=30)return`score ${s} (risco)`;
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
    if(ctxManual&&clienteSel?.ID_CLIENTE&&clienteSel.ID_CLIENTE!==clienteDefaultsApplied.current){
      setTaxa(ctxManual.taxaDef);
      setValor(ctxManual.valorDef);
      setPrazo(ctxManual.prazoDef);
      clienteDefaultsApplied.current=clienteSel.ID_CLIENTE;
    }
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
                        {bloq&&<span style={{fontSize:10,fontWeight:700,padding:"2px 8px",borderRadius:20,background:RED+"15",color:RED,border:`1px solid ${RED}30`}}>Bloqueado</span>}
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
  const riskScore=(prazo/18)*0.4+(taxa/25)*0.3+(valor/20000)*0.3;
  const riskLabel=riskScore>0.65?"Alto":riskScore>0.35?"Moderado":"Baixo";
  const riskColor=riskScore>0.65?RED:riskScore>0.35?YEL:GRN;

  const tabela=Array.from({length:prazo},(_,k)=>{
    const prin=valor/prazo;
    const jur=valor*i;
    const saldo=Math.max(0,valor-(k+1)*prin);
    return{n:k+1,pmt,juros:jur,principal:prin,saldo};
  });

  const cenariosOpts=[2,3,4,6,9,12,15,18];
  const cenariosBase=[prazo,...cenariosOpts.filter(p=>p!==prazo&&p>=1&&p<=18).sort((a,b)=>Math.abs(a-prazo)-Math.abs(b-prazo)).slice(0,2)].sort((a,b)=>a-b);

  const handleLimpar=()=>{setClienteSel(null);setBuscaCli("");setValor(1000);setPrazo(6);setTaxa(14);clienteDefaultsApplied.current=null;if(onClear)onClear();};

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
              type="number" min={100} max={100000} step={1}
              value={valor}
              onChange={e=>{const v=Number(e.target.value);if(v>=0)setValor(v);}}
              onPaste={e=>pasteMoeda(e,v=>setValor(Number(v)))}
              onBlur={e=>{const v=Math.max(100,Math.min(100000,Math.round(Number(e.target.value))));setValor(v);}}
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
            {[1,2,3,4,5,6,7,8,9,10,11,12,13,14,15,16,17,18].map(p=>(
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
                <div style={{display:"flex",gap:4,flexWrap:"wrap"}}>
                  {[{t:7,vip:true},{t:9},{t:12},{t:14},{t:16},{t:22}].map(({t,vip})=>(
                    <button key={t} onClick={()=>setTaxa(t)} style={{fontSize:10,fontWeight:t===taxa?800:500,padding:"2px 7px",borderRadius:6,background:t===taxa?(vip?"#B8860B30":GRN+"25"):"transparent",color:t===taxa?(vip?"#B8860B":GRN):vip?"#B8860B":MUTED,border:t===taxa?`1px solid ${vip?"#B8860B":GRN}40`:`1px solid ${vip?"#B8860B40":BD}`,cursor:"pointer"}}>{t}%{vip&&<span style={{fontSize:8,marginLeft:2,fontWeight:700}}>VIP</span>}</button>
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
          const telSim=String(ctx?.TELEFONE_WPP||ctx?.TELEFONE||clienteSel?.TELEFONE_WPP||clienteSel?.TELEFONE||"").replace(/\D/g,"");
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
        <p style={{fontSize:13,color:MUTED,margin:0}}>Análise estratégica da operação de crédito · dados históricos completos desde o início</p>
      </div>

      {/* KPIs */}
      <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:12,marginBottom:28}}>
        <KpiBox label="Lucro Total" value={fmtR(kpis.lucro)} sub="juros recebidos" cor={GRN}/>
        <KpiBox label="Prejuízo Total" value={fmtR(kpis.prejuizo)} sub="capital perdido" cor={kpis.prejuizo>0?RED:MUTED}/>
        <KpiBox label="LTV — Valor Gerado" value={fmtR(kpis.ltv)} sub="lucro total menos prejuízo" cor={kpis.ltv>=0?GRN:RED}/>
        <KpiBox label="ROI — Retorno s/ Capital" value={kpis.roi.toFixed(1)+"%"} sub="retorno sobre capital emprestado" cor={kpis.roi>=10?GRN:kpis.roi>=0?YEL:RED}/>
        <KpiBox label="Inadimplentes" value={kpis.inadim} sub={`de ${kpis.nCli} clientes`} cor={kpis.inadim>0?ORG:GRN}/>
        <KpiBox label="Com Prejuízo" value={kpis.comPreju} sub="clientes c/ perda declarada" cor={kpis.comPreju>0?RED:GRN}/>
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

// ─── TEMPLATES RÉGUA MODAL ───────────────────────────────────────
function TemplatesReguaModal({onFechar}) {
  const LABELS = {
    "CONFIRMACAO":"Confirmação de pagamento (automática)",
    "D-5":"5 dias antes do vencimento","D-1":"1 dia antes do vencimento","D0":"Dia do vencimento",
    "D+1":"1 dia após o vencimento","D+3":"3 dias após o vencimento","D+7":"7 dias após o vencimento",
    "PROMESSA_D-1":"Promessa — 1 dia antes","PROMESSA_D0":"Promessa — dia da promessa","PROMESSA_D+1":"Promessa — 1 dia após",
  };
  const ORDEM_CONF = ["CONFIRMACAO"];
  const ORDEM_REGUA = ["D-5","D-1","D0","D+1","D+3","D+7","PROMESSA_D-1","PROMESSA_D0","PROMESSA_D+1"];
  const ORDEM = [...ORDEM_CONF, ...ORDEM_REGUA];
  const VARS_CONF = [
    {v:"{NOME}",d:"Primeiro nome"},{v:"{NUM_PARCELA}",d:"Número da parcela"},
    {v:"{TOTAL_PARCELAS}",d:"Total de parcelas"},{v:"{VALOR_PAGO}",d:"Valor pago"},
    {v:"{PARCELAS_RESTANTES}",d:"Parcelas ainda abertas"},{v:"{PROXIMO_VENCIMENTO}",d:"Data do próximo vencimento"},
  ];
  const VARS_REGUA = [
    {v:"{NOME}",d:"Primeiro nome do cliente"},{v:"{VALOR_PARCELA}",d:"Valor da parcela"},
    {v:"{NUM_PARCELA}",d:"Número da parcela"},{v:"{TOTAL_PARCELAS}",d:"Total de parcelas"},
    {v:"{DATA_VENCIMENTO}",d:"Data de vencimento"},{v:"{VALOR_COMBINADO}",d:"Valor prometido (promessas)"},
    {v:"{DATA_PROMESSA}",d:"Data da promessa (promessas)"},
  ];
  const [templates, setTemplates] = useState({});
  const [carregando, setCarregando] = useState(true);
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState("");
  const [showVars, setShowVars] = useState(false);
  useEffect(()=>{
    postAction({action:"buscarTemplatesRegua"}).then(r=>{
      if(r.ok&&r.templates) setTemplates(r.templates);
      setCarregando(false);
    }).catch(e=>{setErro("Erro ao carregar: "+e.message);setCarregando(false);});
  },[]);
  const salvar=async()=>{
    setSalvando(true);setErro("");
    try{const r=await postAction({action:"salvarTemplateRegua",templates});if(r.ok)onFechar();else setErro(r.erro||"Erro ao salvar");}
    catch(e){setErro(e.message);}
    finally{setSalvando(false);}
  };
  const IcoGear=<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z"/><circle cx="12" cy="12" r="3"/></svg>;
  return(
    <div className="modal-overlay-anim" style={{position:"fixed",inset:0,zIndex:600,background:"rgba(15,23,42,0.6)",backdropFilter:"blur(6px)",WebkitBackdropFilter:"blur(6px)",display:"flex",alignItems:"center",justifyContent:"center",padding:20}} onClick={onFechar}>
      <div className="modal-box-anim" style={{width:"100%",maxWidth:620,maxHeight:"90vh",background:CARD,borderRadius:16,border:`1px solid ${BD}`,boxShadow:"0 24px 80px rgba(15,23,42,0.35)",display:"flex",flexDirection:"column"}} onClick={e=>e.stopPropagation()}>
        <div style={{background:GRN,padding:"16px 20px",borderRadius:"16px 16px 0 0",display:"flex",alignItems:"center",justifyContent:"space-between",flexShrink:0}}>
          <div style={{display:"flex",alignItems:"center",gap:10,color:ONBRAND}}>
            <div style={{background:"rgba(255,255,255,0.2)",padding:8,borderRadius:8,display:"flex"}}>{IcoGear}</div>
            <div><div style={{fontWeight:800,fontSize:15}}>Templates de Mensagem</div><div style={{fontSize:11,opacity:0.8}}>Régua de cobrança WhatsApp</div></div>
          </div>
          <button onClick={onFechar} style={{background:"rgba(255,255,255,0.15)",border:"none",color:ONBRAND,borderRadius:8,width:32,height:32,cursor:"pointer",fontSize:18,display:"flex",alignItems:"center",justifyContent:"center"}}>×</button>
        </div>
        <div style={{overflowY:"auto",flex:1,padding:20,display:"flex",flexDirection:"column",gap:16}}>
          {carregando
            ?<div style={{textAlign:"center",padding:40,color:MUTED}}>Carregando templates...</div>
            :<>
              {/* Confirmação de pagamento */}
              <div style={{background:GRN+"10",border:`1px solid ${GRN}30`,borderRadius:12,padding:"10px 14px",display:"flex",alignItems:"center",gap:8}}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={GRN} strokeWidth="2.5"><polyline points="20 6 9 17 4 12"/></svg>
                <span style={{fontSize:12,color:GRN,fontWeight:700}}>Confirmação automática de pagamento</span>
                <span style={{fontSize:11,color:MUTED}}>— disparada ao registrar qualquer pagamento</span>
              </div>
              <div style={{background:BLU+"12",border:`1px solid ${BLU}30`,borderRadius:12,padding:12}}>
                <button onClick={()=>setShowVars(v=>!v)} style={{background:"none",border:"none",cursor:"pointer",width:"100%",textAlign:"left",display:"flex",alignItems:"center",justifyContent:"space-between",color:BLU,fontWeight:700,fontSize:12,padding:0}}>
                  <span>Variáveis disponíveis — confirmação</span>
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" style={{transform:showVars?"rotate(180deg)":"rotate(0deg)",transition:"transform 0.2s"}}><polyline points="6,9 12,15 18,9"/></svg>
                </button>
                {showVars&&<div style={{marginTop:10,display:"flex",flexWrap:"wrap",gap:10}}>
                  {VARS_CONF.map(v=><div key={v.v+"-c"} style={{display:"flex",flexDirection:"column",gap:2}}>
                    <code style={{background:BLU+"20",color:BLU,padding:"2px 8px",borderRadius:6,fontSize:12,fontWeight:700,fontFamily:"monospace"}}>{v.v}</code>
                    <span style={{fontSize:10,color:MUTED}}>{v.d}</span>
                  </div>)}
                </div>}
              </div>
              {ORDEM_CONF.map(key=>(
                <div key={key}>
                  <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:6}}>
                    <span style={{display:"inline-block",padding:"2px 10px",borderRadius:20,background:GRN+"18",color:GRN,fontSize:11,fontWeight:700,border:`1px solid ${GRN}30`}}>{key}</span>
                    <span style={{fontSize:12,color:MUTED}}>{LABELS[key]}</span>
                  </div>
                  <textarea value={templates[key]||""} onChange={e=>setTemplates(prev=>({...prev,[key]:e.target.value}))} rows={6} style={{...IS(),resize:"vertical",fontFamily:"inherit",lineHeight:1.5,fontSize:13}}/>
                </div>
              ))}
              {/* Separador régua */}
              <div style={{display:"flex",alignItems:"center",gap:10,margin:"4px 0"}}>
                <div style={{flex:1,height:1,background:BD}}/>
                <span style={{fontSize:11,color:MUTED,fontWeight:600,whiteSpace:"nowrap"}}>Régua de cobrança</span>
                <div style={{flex:1,height:1,background:BD}}/>
              </div>
              <div style={{background:BLU+"12",border:`1px solid ${BLU}30`,borderRadius:12,padding:12}}>
                <div style={{color:BLU,fontWeight:700,fontSize:12,marginBottom:showVars?10:0,cursor:"pointer"}} onClick={()=>setShowVars(v=>!v)}>
                  Variáveis disponíveis — régua
                </div>
                {showVars&&<div style={{display:"flex",flexWrap:"wrap",gap:10}}>
                  {VARS_REGUA.map(v=><div key={v.v+"-r"} style={{display:"flex",flexDirection:"column",gap:2}}>
                    <code style={{background:BLU+"20",color:BLU,padding:"2px 8px",borderRadius:6,fontSize:12,fontWeight:700,fontFamily:"monospace"}}>{v.v}</code>
                    <span style={{fontSize:10,color:MUTED}}>{v.d}</span>
                  </div>)}
                </div>}
              </div>
              {ORDEM_REGUA.map(key=>(
                <div key={key}>
                  <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:6}}>
                    <span style={{display:"inline-block",padding:"2px 10px",borderRadius:20,background:GRN+"18",color:GRN,fontSize:11,fontWeight:700,border:`1px solid ${GRN}30`}}>{key}</span>
                    <span style={{fontSize:12,color:MUTED}}>{LABELS[key]}</span>
                  </div>
                  <textarea value={templates[key]||""} onChange={e=>setTemplates(prev=>({...prev,[key]:e.target.value}))} rows={5} style={{...IS(),resize:"vertical",fontFamily:"inherit",lineHeight:1.5,fontSize:13}}/>
                </div>
              ))}
              {erro&&<div style={{background:RED+"15",border:`1px solid ${RED}30`,borderRadius:10,padding:"10px 14px",color:RED,fontSize:13}}>{erro}</div>}
            </>
          }
        </div>
        <div style={{padding:"14px 20px",borderTop:`1px solid ${BD}`,display:"flex",gap:10,justifyContent:"flex-end",flexShrink:0}}>
          <button onClick={onFechar} style={{padding:"10px 20px",borderRadius:10,border:`1px solid ${BD}`,background:"transparent",color:MUTED,cursor:"pointer",fontSize:14,fontWeight:600}}>Cancelar</button>
          <button onClick={salvar} disabled={salvando||carregando} style={{padding:"10px 24px",borderRadius:10,background:salvando||carregando?MUTED:GRN,color:"#fff",border:"none",cursor:salvando||carregando?"not-allowed":"pointer",fontSize:14,fontWeight:700,display:"flex",alignItems:"center",gap:8}}>
            {salvando?<><IcoSpinner color="#fff"/> Salvando...</>:"Salvar Templates"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── UNDO TOAST ─────────────────────────────────────────────────
function UndoToast({undo, onDismiss, onReverter}) {
  const [secs, setSecs] = React.useState(undo.segundosRestantes || 900);
  const [confirmando, setConfirmando] = React.useState(false);
  const [motivo, setMotivo] = React.useState("");
  const [loading, setLoading] = React.useState(false);
  const [erro, setErro] = React.useState(null);
  React.useEffect(()=>{
    if(secs<=0){onDismiss();return;}
    const t=setTimeout(()=>setSecs(s=>s-1),1000);
    return()=>clearTimeout(t);
  },[secs]);
  const mm=String(Math.floor(secs/60)).padStart(2,"0");
  const ss=String(secs%60).padStart(2,"0");
  const label = _UNDO_TIPO_LABEL[undo.tipo] || undo.tipo;
  const handleReverter = async()=>{
    setLoading(true); setErro(null);
    const res = await onReverter(motivo);
    setLoading(false);
    if(!res?.ok) setErro(res?.resultado?.erro || "Erro ao reverter");
  };
  const BG="#0A2017", CARD="#112A1A", ACCENT="#A8E040", TEXT="#E8F0E9", MUTED="#8BA68F";
  if(confirmando) return (
    <div style={{position:"fixed",bottom:24,right:24,zIndex:9999,width:340,background:CARD,borderRadius:16,padding:"20px 22px",boxShadow:"0 8px 32px rgba(0,0,0,.6)",border:"1px solid #1E3A28",fontFamily:"Helvetica,Arial,sans-serif"}}>
      <div style={{fontSize:13,fontWeight:700,color:ACCENT,marginBottom:6}}>Confirmar reversão</div>
      <div style={{fontSize:12,color:TEXT,marginBottom:10}}>Operação: <b>{label}</b><br/>Contrato: <b>{undo.idContrato}</b></div>
      <div style={{fontSize:11,color:MUTED,marginBottom:6}}>Motivo (opcional):</div>
      <input value={motivo} onChange={e=>setMotivo(e.target.value)} placeholder="Ex: erro de digitação"
        style={{width:"100%",background:"#0A2017",border:"1px solid #1E3A28",borderRadius:8,padding:"6px 10px",color:TEXT,fontSize:12,marginBottom:10,boxSizing:"border-box"}} />
      {erro && <div style={{fontSize:11,color:"#FF6B6B",marginBottom:8}}>{erro}</div>}
      <div style={{display:"flex",gap:8}}>
        <button onClick={()=>{setConfirmando(false);setErro(null);}} disabled={loading}
          style={{flex:1,padding:"8px 0",borderRadius:8,border:"1px solid #1E3A28",background:"transparent",color:MUTED,fontSize:12,cursor:"pointer"}}>Cancelar</button>
        <button onClick={handleReverter} disabled={loading}
          style={{flex:1,padding:"8px 0",borderRadius:8,border:"none",background:ACCENT,color:BG,fontSize:12,fontWeight:700,cursor:"pointer"}}>{loading?"Revertendo...":"Confirmar reversão"}</button>
      </div>
    </div>
  );
  return (
    <div style={{position:"fixed",bottom:24,right:24,zIndex:9999,width:320,background:CARD,borderRadius:14,padding:"16px 18px",boxShadow:"0 8px 32px rgba(0,0,0,.6)",border:"1px solid #1E3A28",fontFamily:"Helvetica,Arial,sans-serif"}}>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:8}}>
        <div>
          <div style={{fontSize:11,color:MUTED,marginBottom:2}}>Operação registrada</div>
          <div style={{fontSize:13,fontWeight:700,color:TEXT}}>{label}</div>
          <div style={{fontSize:11,color:MUTED}}>Contrato {undo.idContrato} · {undo.nomeCliente}</div>
        </div>
        <button onClick={onDismiss} style={{background:"none",border:"none",color:MUTED,fontSize:16,cursor:"pointer",padding:"0 0 0 8px",lineHeight:1}}>×</button>
      </div>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}>
        <span style={{fontSize:11,color:secs<60?"#FF6B6B":MUTED}}>Expira em {mm}:{ss}</span>
        <button onClick={()=>setConfirmando(true)}
          style={{padding:"6px 16px",borderRadius:8,border:"none",background:ACCENT,color:BG,fontSize:12,fontWeight:700,cursor:"pointer"}}>Reverter</button>
      </div>
    </div>
  );
}

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
      {prontoParaMarcar&&<button disabled={marcando} onClick={marcar} style={{padding:"5px 10px",borderRadius:8,border:`1px solid ${ORG}40`,background:ORG+"10",color:ORG,cursor:marcando?"not-allowed":"pointer",fontSize:11,fontWeight:700,opacity:marcando?0.6:1}}>{marcando?"Marcando...":"✓ Marcar como enviada"}</button>}
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
  const [encerramentoModal, setEncerramentoModal] = useState(null);
  const [quitacaoModal, setQuitacaoModal] = useState(null);
  const [recuperacaoModal, setRecuperacaoModal] = useState(null);
  const [perdaAcoesModal, setPerdaAcoesModal] = useState(null);
  const [acordoAssistModal, setAcordoAssistModal] = useState(null);
  const [abatimentoAssistModal, setAbatimentoAssistModal] = useState(null);
  const [ajuizarModal, setAjuizarModal] = useState(null);
  const [acordoJudicialModal, setAcordoJudicialModal] = useState(null);
  const [quitacaoJudicialModal, setQuitacaoJudicialModal] = useState(null);
  const [arquivarProcessoModal, setArquivarProcessoModal] = useState(null);
  const [renegociacaoModal, setRenegociacaoModal] = useState(null);
  const [cobModal, setCobModal] = useState(null);
  const [cobFiltro, setCobFiltro] = useState(null); // null | {tipo:"banda",valor} | {tipo:"ajuizamento"}
  const [cobSort, setCobSort] = useState(null); // null | {campo:"cliente"|"prioridade"|"atraso"|"valor",dir:"asc"|"desc"}
  const [contratoSel, setContratoSel] = useState(null);
  const [carteiraDetalheModal, setCarteiraDetalheModal] = useState(null);
  const [filtroCtr, setFiltroCtr] = useState("");
  const [filtroStatusCtr, setFiltroStatusCtr] = useState("todos");
  const [simVal, setSimVal] = useState(5000);
  const [simInad, setSimInad] = useState(0);
  const [simVol, setSimVol] = useState(0);
  const [filtroStatus, setFiltroStatus] = useState("todos");
  const [filtroBusca, setFiltroBusca] = useState("");
  const [filtroPerdas, setFiltroPerdas] = useState("todos");
  const [finDe, setFinDe] = useState(()=>parseDate(mesAtualRange().ini));
  const [finAte, setFinAte] = useState(()=>parseDate(mesAtualRange().fim));
  const [finCalOpen, setFinCalOpen] = useState(false);
  const [dashCalOpen, setDashCalOpen] = useState(false);
  const [dashCalPos, setDashCalPos] = useState({top:0,right:0});
  const [finCalPos,  setFinCalPos]  = useState({top:0,right:0});
  const dashCalBtnRef = useRef(null);
  const finCalBtnRef  = useRef(null);
  const [ctrDe, setCtrDe] = useState(null);
  const [ctrAte, setCtrAte] = useState(null);
  const [ctrCalOpen, setCtrCalOpen] = useState(false);
  const [ctrCalPos, setCtrCalPos] = useState({top:0,right:0});
  const ctrCalBtnRef = useRef(null);
  const [expDe, setExpDe] = useState(null);
  const [expAte, setExpAte] = useState(null);
  const [expCalOpen, setExpCalOpen] = useState(false);
  const [expCalPos, setExpCalPos] = useState({top:0,right:0});
  const expCalBtnRef = useRef(null);
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
  const [filtroRegua, setFiltroRegua] = useState("todos");
  const [modalTemplatesRegua, setModalTemplatesRegua] = useState(false);
  const [disparandoRegua, setDisparandoRegua] = useState(false);
  const [chartPeriodo, setChartPeriodo] = useState("Max");
  const [gestaoExpandido, setGestaoExpandido] = useState(null);
  const [dashFiltroPreset, setDashFiltroPreset] = useState("Este mês");
  const [selCliAba, setSelCliAba] = useState("perfil");
  const [privacy, setPrivacy] = useState(false);
  const [undoAtivo, setUndoAtivo] = useState(null);
  const [darkMode, setDarkMode] = useState(()=>{const d=isDarkHour();applyTheme(d);return d;});
  const toggleDark=()=>{const next=!darkMode;applyTheme(next);setDarkMode(next);};
  useEffect(()=>{ _registrarUndoAtivo = (d)=>setUndoAtivo(d); return()=>{ _registrarUndoAtivo=null; }; },[]);
  const [_progPct,_setProgPct]=useState(-1);
  useEffect(()=>{_progSetFn=_setProgPct;return()=>{_progSetFn=null;};},[]);
  const handleReverterUndo = async(motivo)=>{
    if(!undoAtivo) return;
    try {
      const res = await postAction({action:"reverterOperacao", idUndo:undoAtivo.idUndo, motivo:motivo||""});
      if(res.ok){ setUndoAtivo(null); carregar(); }
      return res;
    } catch(e){ return {ok:false,error:String(e)}; }
  };
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
  const _abortCtrl = useRef(null);
  const CACHE_KEY = "fp_data_v2";
  const CACHE_TTL = 5 * 60 * 1000; // 5 minutos

  const carregar=(force=false)=>{
    if(!force&&_fetching.current)return Promise.resolve();
    if(_abortCtrl.current)_abortCtrl.current.abort();
    _fetching.current=true;
    const ctrl=new AbortController();
    _abortCtrl.current=ctrl;
    // cache-busting: /api/sheets tem Cache-Control s-maxage=60 na CDN da Vercel (vercel.json) —
    // sem isso, "atualizar" podia devolver uma resposta cacheada de até 60s (ou stale até 5min)
    // em vez de bater no Sheets de novo, mesmo com o fetch sendo disparado corretamente.
    return fetch(`${API_URL}?_=${Date.now()}`,{signal:ctrl.signal,cache:"no-store"}).then(r=>r.json()).then(d=>{
      setRaw(d);
      try{localStorage.setItem(CACHE_KEY,JSON.stringify({data:d,ts:Date.now()}));}catch(e){}
      setLoading(false);
      setUltimaAt(new Date());
      _fetching.current=false;
      _abortCtrl.current=null;
    }).catch(e=>{
      if(e.name!=="AbortError")setLoading(false);
      _fetching.current=false;
    });
  };

  useEffect(()=>{
    let fresh=false;
    const cached=localStorage.getItem(CACHE_KEY);
    if(cached){
      try{
        const entry=JSON.parse(cached);
        const d=entry?.data??entry; // suporta formato antigo (dados diretos) e novo ({data,ts})
        const ts=entry?.ts??0;
        setRaw(d);setLoading(false);
        fresh=Date.now()-ts<CACHE_TTL;
      }catch(e){}
    }
    if(!fresh)carregar();
  },[]);
  useEffect(()=>()=>{if(_abortCtrl.current)_abortCtrl.current.abort();},[]);
  useEffect(()=>{
    const tick=()=>{if(document.visibilityState==="visible")carregar();};
    const id=setInterval(tick,120000);
    document.addEventListener("visibilitychange",tick);
    return()=>{clearInterval(id);document.removeEventListener("visibilitychange",tick);};
  },[]);

  const clientes  = useMemo(()=>raw?.CLIENTES  || raw?.clientes  || [], [raw]);
  const contratos = useMemo(()=>raw?.CONTRATOS || raw?.contratos || [], [raw]);
  const parcelas  = useMemo(()=>raw?.PARCELAS  || raw?.parcelas  || [], [raw]);
  const pagamentos= useMemo(()=>raw?.PAGAMENTOS|| raw?.pagamentos|| [], [raw]);
  const promessas    = useMemo(()=>raw?.PROMESSAS    || [], [raw]);
  const eventos      = useMemo(()=>raw?.EVENTOS      || [], [raw]);
  const mensagens    = useMemo(()=>raw?.MENSAGENS    || [], [raw]);
  const acordos      = useMemo(()=>raw?.ACORDOS      || [], [raw]);
  const padrinhos    = useMemo(()=>raw?.PADRINHOS    || [], [raw]);
  const empregadores = useMemo(()=>raw?.EMPREGADORES || [], [raw]);
  const quitacoes    = useMemo(()=>raw?.QUITACOES    || [], [raw]);
  const propostasRenegociacao = useMemo(()=>raw?.PROPOSTAS_RENEGOCIACAO || [], [raw]);
  const cliMap = useMemo(()=>new Map((clientes||[]).map(c=>[String(c.ID_CLIENTE),c])), [clientes]);
  const contratosMap = useMemo(()=>new Map((contratos||[]).map(c=>[String(c.ID_CONTRATO),c])), [contratos]);

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
      {sc}{faixa&&` · ${faixa}`}
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
      if(!m[id])m[id]={diasAtraso:0,qtdAtrasadas:0,saldoAberto:0,principalAberto:0};
      const st=String(p.STATUS||p.STATUS_PAGAMENTO||"").toLowerCase();
      if(!_ST_TERMINAL.has(st)){
        m[id].saldoAberto+=parseFloat(p.VALOR_PARCELA||0);
        m[id].principalAberto+=parseFloat(p.VALOR_PRINCIPAL||0);
        const dv=parseDate(p.DATA_VENCIMENTO);
        if(dv){dv.setHours(0,0,0,0);const d=Math.round((hoje-dv)/86400000);if(d>0){m[id].qtdAtrasadas++;m[id].diasAtraso=Math.max(m[id].diasAtraso,d);}}
      }
    });
    return m;
  },[parcelas]);

  const contratosFiltrados=useMemo(()=>{
    const b=filtroCtr.toLowerCase();
    const ini=ctrDe?new Date(ctrDe):null;if(ini)ini.setHours(0,0,0,0);
    const fim=ctrAte?new Date(ctrAte):(ctrDe?new Date(ctrDe):null);if(fim)fim.setHours(23,59,59,999);
    return (contratos||[]).filter(c=>{
      const m=String(c.ID_CONTRATO||"").toLowerCase().includes(b)||String(c.NOME_CLIENTE||"").toLowerCase().includes(b)||String(c.ID_CLIENTE||"").toLowerCase().includes(b);
      const s=filtroStatusCtr==="todos"||String(c.STATUS_CONTRATO||"")===filtroStatusCtr;
      const d=parseDate(c.DATA_EMPRESTIMO);
      const inP=!ini?true:!d?false:(()=>{const dc=new Date(d.getTime());dc.setHours(0,0,0,0);return dc>=ini&&(!fim||dc<=fim);})();
      return m&&s&&inP;
    }).sort((a,b)=>String(a.ID_CONTRATO||"").localeCompare(String(b.ID_CONTRATO||""),"pt-BR",{numeric:true}));
  },[contratos,filtroCtr,filtroStatusCtr,ctrDe,ctrAte]);

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
    const ativos=(contratos||[]).filter(c=>_ST_ATIVOS.has(String(c.STATUS_CONTRATO||"").toLowerCase()));
    const vAtivos=ativos.reduce((s,c)=>s+(perdaInfoMap[String(c.ID_CONTRATO||"")]?.principalAberto||0),0);
    const statusPago=p=>["pago","quitacao_antecipada"].includes(String(p.STATUS||"").toLowerCase());
    const parcelasPeriodo=(parcelas||[]).filter(p=>noPeriodoDash(p.DATA_VENCIMENTO));
    const pagamentosPeriodo=(pagamentos||[]).filter(p=>noPeriodoDash(p.DATA_PAGAMENTO));
    const parcelasAbertas=(parcelasPeriodo||[]).filter(p=>!statusPago(p));
    const parcelasPagas=(parcelasPeriodo||[]).filter(p=>statusPago(p));
    // Taxa de Inadimplência (padrão Basileia/BCB — NPL 90+ dias): foto de hoje, não filtrada
    // por período do Dashboard. Base = principal em aberto (principalAberto via perdaInfoMap),
    // nunca saldo devedor com juros — ver docs/ai-memory/03-AI-FINANCIAL-CALCULATIONS.md
    const contratosNPL90=ativos.filter(c=>(perdaInfoMap[String(c.ID_CONTRATO||"")]?.diasAtraso||0)>=91);
    const principalInadNPL=contratosNPL90.reduce((s,c)=>s+(perdaInfoMap[String(c.ID_CONTRATO||"")]?.principalAberto||0),0);
    const taxaInadNPL=vAtivos>0?(principalInadNPL/vAtivos*100):0;
    const qtdNPL90=contratosNPL90.length;
    const pagsPeriodoSemAbat=(pagamentosPeriodo||[]).filter(p=>p.TIPO_PAGAMENTO!=="abatimento_acordo_assistido");
    const receitaTotal=pagsPeriodoSemAbat.reduce((s,p)=>s+parseFloat(p.VALOR_PAGO||0),0);
    const receitaExtra=(pagamentosPeriodo||[]).reduce((s,p)=>s+parseFloat(p.RECEITA_EXTRA_ATRASO||0)+parseFloat(p.FEE_PRORROGACAO||0),0);
    const lucro=pagsPeriodoSemAbat.reduce((s,pag)=>{
      const parc=(parcelas||[]).find(p=>String(p.ID_PARCELA)===String(pag.ID_PARCELA));
      const jurosBase=parc?parseFloat(parc.VALOR_JUROS||0)-parseFloat(parc.DESCONTO_APLICADO||0):0;
      return s+jurosBase+parseFloat(pag.RECEITA_EXTRA_ATRASO||0)+parseFloat(pag.FEE_PRORROGACAO||0);
    },0);
    const capitalRecuperadoAssistido=(pagamentosPeriodo||[]).filter(p=>p.TIPO_PAGAMENTO==="abatimento_acordo_assistido").reduce((s,p)=>s+parseFloat(p.VALOR_PAGO||0),0);
    const qtyProrrogadas=(parcelasPeriodo||[]).filter(p=>p.ORIGEM_PARCELA==="gerada_por_pagamento_de_juros").length;
    const pagNormais=(pagamentosPeriodo||[]).filter(p=>p.TIPO_PAGAMENTO==="pagamento_normal").length;
    const pagAtraso=(pagamentosPeriodo||[]).filter(p=>p.TIPO_PAGAMENTO==="pagamento_com_atraso").length;
    const pagJuros=(pagamentosPeriodo||[]).filter(p=>p.TIPO_PAGAMENTO==="somente_juros").length;
    const vPendente=parcelasAbertas.reduce((s,p)=>s+parseFloat(p.VALOR_PARCELA||0),0);
    const totalRecebidoGeral=(pagamentos||[]).reduce((s,p)=>s+parseFloat(p.VALOR_PAGO||0),0);
    const principalLiberadoGeral=(contratos||[]).reduce((s,c)=>s+parseFloat(c.VALOR_PRINCIPAL||0),0);
    const caixaAtual=totalRecebidoGeral-principalLiberadoGeral;
    return{vAtivos,principalInadNPL,taxaInadNPL,qtdNPL90,receitaTotal,receitaExtra,lucro,capitalRecuperadoAssistido,qtyProrrogadas,pagNormais,pagAtraso,pagJuros,totalCobrancas:(parcelasPeriodo||[]).length,parcelasPagas:parcelasPagas.length,parcelasPendentes:parcelasAbertas.length,vPendente,contratosAtivos:ativos.length,caixaAtual,pagamentosPeriodo:pagamentosPeriodo.length};
  },[contratos,parcelas,pagamentos,periodoDash,perdaInfoMap]);

  const chartData=useMemo(()=>{
    const n=chartPeriodo==="3M"?3:chartPeriodo==="6M"?6:chartPeriodo==="1A"?12:24;
    const hoje=new Date();
    return Array.from({length:n},(_,i)=>{
      const dt=new Date(hoje.getFullYear(),hoje.getMonth()-(n-1-i),1);
      const ini=new Date(dt.getFullYear(),dt.getMonth(),1,0,0,0);
      const fim=new Date(dt.getFullYear(),dt.getMonth()+1,0,23,59,59);
      const total=(pagamentos||[]).filter(p=>{const dp=parseDate(p.DATA_PAGAMENTO);return dp&&dp>=ini&&dp<=fim&&p.TIPO_PAGAMENTO!=="abatimento_acordo_assistido";}).reduce((s,p)=>s+parseFloat(p.VALOR_PAGO||0),0);
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

  const mensal=useMemo(()=>{const anoAtual=new Date().getFullYear();return["Jan","Fev","Mar","Abr","Mai","Jun","Jul","Ago","Set","Out","Nov","Dez"].map((mes,i)=>{
    const pMes=(pagamentos||[]).filter(p=>{const d=parseDate(p.DATA_PAGAMENTO);return d&&d.getFullYear()===anoAtual&&d.getMonth()===i&&p.TIPO_PAGAMENTO!=="abatimento_acordo_assistido";});
    return{m:mes,v:pMes.reduce((s,p)=>s+parseFloat(p.VALOR_PAGO||0),0),extra:pMes.reduce((s,p)=>s+parseFloat(p.RECEITA_EXTRA_ATRASO||0),0)};
  });},[pagamentos]);

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
      // Prioridade de Cobrança: calculada por contrato, o cliente herda a do pior contrato dele
      const contratoIds=[...new Set(ps.map(p=>String(p.ID_CONTRATO)))];
      let prioridade=null;
      contratoIds.forEach(cid=>{
        const ctr=contratosMap.get(cid);
        if(!ctr)return;
        const parcelasContrato=(parcelas||[]).filter(p=>String(p.ID_CONTRATO)===cid);
        const prio=calcPrioridadeCobranca({contrato:ctr,parcelasContrato,eventos,cliente:c});
        if(!prioridade||prio.score>prioridade.score)prioridade=prio;
      });
      return{
        ...c,
        ID_CLIENTE:id,
        NOME_CLIENTE:nome,
        TELEFONE:telefone,
        vAtraso,
        maxAtraso,
        qtdContratos:contratoIds.length,
        parcelasAtrasadas:psComDias,   // ← parcelas com DIAS_ATRASO calculado
        prioridade,
      };
    }).sort((a,b)=>(b.prioridade?.score||0)-(a.prioridade?.score||0));
  },[clientes,parcelas,contratos,eventos,contratosMap,cliMap]);

  // ── clientes novos (1 único contrato na vida) com a parcela 1 em atraso ──
  const totalContratosPorCliente=useMemo(()=>{
    const m=new Map();
    (contratos||[]).forEach(c=>{
      const id=String(c.ID_CLIENTE);
      m.set(id,(m.get(id)||0)+1);
    });
    return m;
  },[contratos]);
  const isNovoAtraso1=item=>
    totalContratosPorCliente.get(String(item.ID_CLIENTE))===1 &&
    item.parcelasAtrasadas.some(p=>parseInt(p.NUM_PARCELA||0)===1);

  const cobKpis=useMemo(()=>{
    let critica=0,forte=0,normal=0,elegivelAjuizamento=0,valorRisco=0;
    cobItems.forEach(c=>{
      valorRisco+=c.vAtraso;
      const b=c.prioridade?.banda;
      if(b==="Crítica")critica++;else if(b==="Forte")forte++;else if(b==="Normal")normal++;
      if(c.prioridade?.jaRenegociado||c.prioridade?.jaTeveAcordoAssistido)elegivelAjuizamento++;
    });
    const hoje=new Date();hoje.setHours(0,0,0,0);
    const promessasHoje=(promessas||[]).filter(p=>{
      if(String(p.STATUS_PROMESSA||"").toUpperCase()!=="PENDENTE")return false;
      const d=parseDate(p.DATA_PREVISTA_PAGAMENTO);if(!d)return false;d.setHours(0,0,0,0);
      return d.getTime()===hoje.getTime();
    }).length;
    const promessasQuebradas=(promessas||[]).filter(p=>String(p.STATUS_PROMESSA||"").toUpperCase()==="QUEBRADA").length;
    return{critica,forte,normal,elegivelAjuizamento,valorRisco,promessasHoje,promessasQuebradas};
  },[cobItems,promessas]);

  const perdas=useMemo(()=>{
    const todos=contratos||[];
    const baixados=todos.filter(c=>c.STATUS_CONTRATO==="baixado_como_prejuizo");
    const emRisco=todos.filter(c=>["em_cobranca","pre_prejuizo"].includes(c.STATUS_CONTRATO));
    const emRec=todos.filter(c=>["em_recuperacao","recuperado_parcialmente"].includes(c.STATUS_CONTRATO));
    const capitalEmRisco=emRisco.reduce((s,c)=>s+(perdaInfoMap[String(c.ID_CONTRATO||"")]?.principalAberto||0),0);
    const qtdEmRisco=emRisco.length;
    const capitalBaixado=baixados.reduce((s,c)=>s+parseFloat(c.PREJUIZO_CAPITAL||0),0);
    const recuperadoAposBaixa=[...baixados,...emRec].reduce((s,c)=>s+parseFloat(c.VALOR_RECUPERADO_APOS_BAIXA||0),0);
    const prejuizoReal=capitalBaixado-recuperadoAposBaixa;
    const txRecuperacao=capitalBaixado>0?(recuperadoAposBaixa/capitalBaixado*100):0;
    const jud=todos.filter(c=>["em_processo_judicial","encerrado_judicialmente"].includes(c.STATUS_CONTRATO));
    const qtdJudicial=jud.length;
    const valorExecutadoJudicial=jud.reduce((s,c)=>s+parseFloat(c.VALOR_EXECUTADO||c.VALOR_TOTAL||c.VALOR_PRINCIPAL||0),0);
    const recuperadoJudicialPrincipal=jud.reduce((s,c)=>s+parseFloat(c.VALOR_RECUPERADO_JUDICIAL_PRINCIPAL||0),0);
    const recuperadoJudicialLucro=jud.reduce((s,c)=>s+parseFloat(c.VALOR_RECUPERADO_JUDICIAL_LUCRO||0),0);
    const recuperadoJudicialTotal=recuperadoJudicialPrincipal+recuperadoJudicialLucro;
    const indiceRecuperacaoJudicial=valorExecutadoJudicial>0?(recuperadoJudicialTotal/valorExecutadoJudicial*100):0;
    return{capitalEmRisco,qtdEmRisco,capitalBaixado,recuperadoAposBaixa,prejuizoReal,txRecuperacao,
      qtdJudicial,valorExecutadoJudicial,recuperadoJudicialPrincipal,recuperadoJudicialLucro,recuperadoJudicialTotal,indiceRecuperacaoJudicial};
  },[contratos,perdaInfoMap]);

  const carteira=useMemo(()=>{
    const todos=contratos||[];
    const EXCL=new Set(["quitado","cancelado","encerrado_sem_recuperacao","recuperado_integralmente","em_processo_judicial","encerrado_judicialmente"]);
    const cCirc=todos.filter(c=>["ativo_em_dia","ativo_em_atraso","renegociado"].includes(c.STATUS_CONTRATO));
    const cRisco=todos.filter(c=>["em_cobranca","pre_prejuizo"].includes(c.STATUS_CONTRATO));
    const cAssist=todos.filter(c=>c.STATUS_CONTRATO==="acordo_assistido");
    const cBaixados=todos.filter(c=>c.STATUS_CONTRATO==="baixado_como_prejuizo");
    const cJudicial=todos.filter(c=>c.STATUS_CONTRATO==="em_processo_judicial");
    const capitalCirculacao=cCirc.reduce((s,c)=>s+(perdaInfoMap[String(c.ID_CONTRATO||"")]?.principalAberto||0),0);
    const capitalEmRisco=cRisco.reduce((s,c)=>s+(perdaInfoMap[String(c.ID_CONTRATO||"")]?.principalAberto||0),0);
    const capitalAssistido=cAssist.reduce((s,c)=>s+(perdaInfoMap[String(c.ID_CONTRATO||"")]?.principalAberto||0),0);
    const capitalBaixado=cBaixados.reduce((s,c)=>s+parseFloat(c.PREJUIZO_CAPITAL||0),0);
    const recuperado=cBaixados.reduce((s,c)=>s+parseFloat(c.VALOR_RECUPERADO_APOS_BAIXA||0),0);
    const capitalPerdidoLiquido=Math.max(0,capitalBaixado-recuperado);
    const capitalJudicial=cJudicial.reduce((s,c)=>s+parseFloat(c.PREJUIZO_CAPITAL||c.VALOR_EXECUTADO||0),0);
    const capitalTotal=capitalCirculacao+capitalEmRisco+capitalAssistido+capitalJudicial;
    const abertos=todos.filter(c=>!EXCL.has(c.STATUS_CONTRATO)&&c.STATUS_CONTRATO!=="baixado_como_prejuizo");
    const dist=[0,0,0,0,0];
    abertos.forEach(c=>{
      const info=perdaInfoMap[String(c.ID_CONTRATO)]||{};
      const d=info.diasAtraso||0;
      if(d<=0)dist[0]++;
      else if(d<=30)dist[1]++;
      else if(d<=60)dist[2]++;
      else if(d<=120)dist[3]++;
      else dist[4]++;
    });
    // PDD Gerencial v1.0 — Jun/2026
    const pddPct=d=>d<=0?0:d<=30?0:d<=60?0.10:d<=90?0.35:d<=120?0.60:d<=180?0.85:1.00;
    const pddFaixas=[
      {label:"Em dia",      lo:0,  hi:0,   pct:0.00,qtd:0,saldo:0,pdd:0},
      {label:"1–30 dias",   lo:1,  hi:30,  pct:0.00,qtd:0,saldo:0,pdd:0},
      {label:"31–60 dias",  lo:31, hi:60,  pct:0.10,qtd:0,saldo:0,pdd:0},
      {label:"61–90 dias",  lo:61, hi:90,  pct:0.35,qtd:0,saldo:0,pdd:0},
      {label:"91–120 dias", lo:91, hi:120, pct:0.60,qtd:0,saldo:0,pdd:0},
      {label:"121–180 dias",lo:121,hi:180, pct:0.85,qtd:0,saldo:0,pdd:0},
      {label:"181+ dias",   lo:181,hi:9999,pct:1.00,qtd:0,saldo:0,pdd:0},
    ];
    let saldoDevedor=0,principalTotal=0,totalPDD=0;
    abertos.forEach(c=>{
      const info=perdaInfoMap[String(c.ID_CONTRATO)]||{};
      const d=info.diasAtraso||0;
      const saldo=info.saldoAberto||0;
      const princ=info.principalAberto||0;
      saldoDevedor+=saldo;
      principalTotal+=princ;
      const pct=pddPct(d);
      const pdd=princ*pct;
      totalPDD+=pdd;
      const f=pddFaixas.find(fx=>d>=fx.lo&&d<=fx.hi);
      if(f){f.qtd++;f.saldo+=princ;f.pdd+=pdd;}
    });
    const carteiraAjustada=saldoDevedor-totalPDD;
    const perdaHistoricaLiq=capitalPerdidoLiquido;
    const coberturaPDD=perdaHistoricaLiq>0?totalPDD/perdaHistoricaLiq:0;
    return{capitalCirculacao,capitalEmRisco,capitalAssistido,capitalJudicial,capitalPerdidoLiquido,capitalTotal,dist,abertos,totalAbertos:abertos.length,qtdCirc:cCirc.length,qtdRisco:cRisco.length,qtdAssist:cAssist.length,qtdJudicial:cJudicial.length,saldoDevedor,principalTotal,totalPDD,carteiraAjustada,coberturaPDD,pddFaixas};
  },[contratos,perdaInfoMap]);

  const resultado12m=useMemo(()=>{
    const hoje=new Date();
    const ha12m=new Date(hoje);ha12m.setFullYear(ha12m.getFullYear()-1);
    let receitaContratual=0,receitaAtraso=0,receitaBruta=0;
    (pagamentos||[]).forEach(pag=>{
      if(pag.TIPO_PAGAMENTO==="abatimento_acordo_assistido")return;
      const d=parseDate(pag.DATA_PAGAMENTO);
      if(!d||d<ha12m)return;
      receitaBruta+=parseFloat(pag.VALOR_PAGO||0);
      receitaAtraso+=parseFloat(pag.RECEITA_EXTRA_ATRASO||0);
    });
    (parcelas||[]).forEach(p=>{
      const st=String(p.STATUS||"").toLowerCase();
      if(!["pago","quitacao_antecipada"].includes(st))return;
      const d=parseDate(p.DATA_PAGAMENTO);
      if(!d||d<ha12m)return;
      receitaContratual+=Math.max(0,parseFloat(p.VALOR_JUROS||0)-parseFloat(p.DESCONTO_APLICADO||0));
    });
    return{receitaContratual,receitaAtraso,receitaBruta};
  },[pagamentos,parcelas]);

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

  const totaisFin=useMemo(()=>{
    const semAbat=pagsFiltrados.filter(p=>p.TIPO_PAGAMENTO!=="abatimento_acordo_assistido");
    const abatAmt=pagsFiltrados.filter(p=>p.TIPO_PAGAMENTO==="abatimento_acordo_assistido").reduce((s,p)=>s+parseFloat(p.VALOR_PAGO||0),0);
    return{
      total:pagsFiltrados.reduce((s,p)=>s+parseFloat(p.VALOR_PAGO||0),0),
      receita:semAbat.reduce((s,p)=>s+parseFloat(p.VALOR_PAGO||0),0),
      abatimentos:abatAmt,
      extra:pagsFiltrados.reduce((s,p)=>s+parseFloat(p.RECEITA_EXTRA_ATRASO||0)+parseFloat(p.FEE_PRORROGACAO||0),0),
      count:pagsFiltrados.length,
    };
  },[pagsFiltrados]);

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
    const pagsSemAbat=pags.filter(p=>p.TIPO_PAGAMENTO!=="abatimento_acordo_assistido");
    const receitaTotal=pagsSemAbat.reduce((s,p)=>s+parseFloat(p.VALOR_PAGO||0),0);
    const receitaExtra=pags.reduce((s,p)=>s+parseFloat(p.RECEITA_EXTRA_ATRASO||0)+parseFloat(p.FEE_PRORROGACAO||0),0);
    const lucro=(parcelas||[]).filter(p=>{
      const st=String(p.STATUS||"").toLowerCase();
      if(!["pago","quitacao_antecipada"].includes(st))return false;
      const d=parseDate(p.DATA_PAGAMENTO);if(!d)return false;
      if(!ini||!fim)return true;
      const dc=new Date(d.getTime());dc.setHours(0,0,0,0);
      return dc>=ini&&dc<=fim;
    }).reduce((s,p)=>s+Math.max(0,parseFloat(p.VALOR_JUROS||0)-parseFloat(p.DESCONTO_APLICADO||0))+parseFloat(p.DIFERENCA_PAGA||0),0);
    const capitalRecuperadoAssistido=pags.filter(p=>p.TIPO_PAGAMENTO==="abatimento_acordo_assistido").reduce((s,p)=>s+parseFloat(p.VALOR_PAGO||0),0);
    const qtyProrrogadas=parcsP.filter(p=>p.ORIGEM_PARCELA==="gerada_por_pagamento_de_juros").length;
    const pagNormais=pags.filter(p=>p.TIPO_PAGAMENTO==="pagamento_normal").length;
    const pagAtraso=pags.filter(p=>p.TIPO_PAGAMENTO==="pagamento_com_atraso").length;
    const pagJuros=pags.filter(p=>p.TIPO_PAGAMENTO==="somente_juros").length;
    return{receitaTotal,receitaExtra,lucro,capitalRecuperadoAssistido,qtyProrrogadas,pagNormais,pagAtraso,pagJuros};
  },[pagsFiltrados,parcelas,finDe,finAte]);

  function dStrFin(d){return d?d.toLocaleDateString("pt-BR",{day:"2-digit",month:"2-digit",year:"numeric"}):""}
  const labelPeriodo=finDe&&finAte?`${dStrFin(finDe)} → ${dStrFin(finAte)}`:finDe?`A partir de ${dStrFin(finDe)}`:"Selecionar período";
  const labelPeriodoCtr=ctrDe&&ctrAte?`${dStrFin(ctrDe)} → ${dStrFin(ctrAte)}`:ctrDe?`A partir de ${dStrFin(ctrDe)}`:"Selecionar período";

  function exportarPDFFinanceiro(){
    try{
      const doc=new jsPDF({unit:'mm',format:'a4'});
      const W=210,pd=16,CW=W-2*pd;
      const NAV=[7,36,27],G=[11,61,46],SIG=[31,184,119],B=[23,108,112],O=[255,119,0],R=[192,50,47],P=[34,29,154];
      const DK=[18,24,21],MUT=[110,121,117],BDC=[221,227,224],LGR=[247,249,248],WH=[255,255,255];
      const tLBL={pagamento_normal:"Normal",normal:"Normal",pagamento_com_atraso:"Com Atraso",com_atraso:"Com Atraso",somente_juros:"Somente Juros",recuperacao_apos_baixa:"Recuperação",pagamento_antecipado:"Antecipado",antecipado:"Antecipado",quitacao_antecipada:"Quitação Antecip.",abatimento_acordo_assistido:"Recup. Capital",acordo_com_perda:"Acordo",recuperacao_judicial:"Recuperação Judicial"};
      const tCOR={pagamento_normal:G,normal:G,pagamento_com_atraso:O,com_atraso:O,somente_juros:R,recuperacao_apos_baixa:P,pagamento_antecipado:B,antecipado:B,quitacao_antecipada:G,abatimento_acordo_assistido:B,acordo_com_perda:O,recuperacao_judicial:R};
      const fR=v=>parseFloat(v||0).toLocaleString('pt-BR',{style:'currency',currency:'BRL'});
      const periodo=finDe?labelPeriodo:"Todos os pagamentos";
      const now=new Date();
      const geradoEm=now.toLocaleDateString('pt-BR')+' às '+now.toLocaleTimeString('pt-BR',{hour:'2-digit',minute:'2-digit'});
      const total=pagsFiltrados.length;

      // Mapa de parcelas para O(1) lookup (usado por linha no PDF)
      const parcMap=new Map((parcelas||[]).map(p=>[String(p.ID_PARCELA),p]));
      const getParcela=p=>parcMap.get(String(p.ID_PARCELA));

      // Totais de principal e juros calculados de PARCELAS diretamente
      const _pIni=finDe?new Date(finDe):null;if(_pIni)_pIni.setHours(0,0,0,0);
      const _pFim=finAte?new Date(finAte):(finDe?new Date(finDe):null);if(_pFim)_pFim.setHours(23,59,59,999);
      const _parcsP=(parcelas||[]).filter(p=>{
        const st=String(p.STATUS||"").toLowerCase();
        if(!["pago","quitacao_antecipada"].includes(st))return false;
        const d=parseDate(p.DATA_PAGAMENTO);if(!d)return false;
        if(!_pIni||!_pFim)return true;
        const dc=new Date(d.getTime());dc.setHours(0,0,0,0);
        return dc>=_pIni&&dc<=_pFim;
      });
      const totalPrincipal=_parcsP.reduce((s,p)=>s+parseFloat(p.VALOR_PRINCIPAL||0),0);
      const totalJuros=_parcsP.reduce((s,p)=>s+Math.max(0,parseFloat(p.VALOR_JUROS||0)-parseFloat(p.DESCONTO_APLICADO||0)),0);

      const grupos=[
        {label:'Normal',tipos:['pagamento_normal','normal'],c:G},
        {label:'Com Atraso',tipos:['pagamento_com_atraso','com_atraso'],c:O},
        {label:'Somente Juros',tipos:['somente_juros'],c:R},
        {label:'Antecipado',tipos:['pagamento_antecipado','antecipado','quitacao_antecipada'],c:B},
        {label:'Recuperação',tipos:['recuperacao_apos_baixa'],c:P},
        {label:'Recup. Capital',tipos:['abatimento_acordo_assistido'],c:B},
      ].map(g=>({...g,count:pagsFiltrados.filter(p=>g.tipos.includes(p.TIPO_PAGAMENTO)).length})).filter(g=>g.count>0);

      // ─── CABEÇALHO ───
      // Header escuro com logo brand
      doc.setFillColor(...NAV);doc.rect(0,0,W,44,'F');
      // Logo mark (dark mode: SIG + branco + g-700)
      doc.setFillColor(31,184,119);doc.roundedRect(pd,11,9,9,2,2,'F');
      doc.setFillColor(255,255,255);doc.roundedRect(pd+6,17,9,9,2,2,'F');
      doc.setFillColor(14,92,68);doc.roundedRect(pd+6,17,3.5,3.5,0.8,0.8,'F');
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
      [{label:'RECEITA TOTAL',val:fR(finKpis.receitaTotal),sub:`${total} pagamentos`,c:SIG},
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
        doc.setFont('helvetica','bold');doc.setFontSize(7.5);doc.setTextColor(...G);
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

  function exportarPDFContratos(){
    try{
      const doc=new jsPDF({unit:'mm',format:'a4'});
      const W=210,pd=16,CW=W-2*pd;
      const NAV=[7,36,27],G=[11,61,46],SIG=[31,184,119],B=[23,108,112],O=[255,119,0],R=[192,50,47];
      const DK=[18,24,21],MUT=[110,121,117],BDC=[221,227,224],LGR=[247,249,248],WH=[255,255,255];
      const fR=v=>parseFloat(v||0).toLocaleString('pt-BR',{style:'currency',currency:'BRL'});
      const fmtCPF=v=>{const s=String(v||'').replace(/\D/g,'').padStart(11,'0');return`${s.slice(0,3)}.${s.slice(3,6)}.${s.slice(6,9)}-${s.slice(9)}`;};
      const fmtCEP=v=>{const s=String(v||'').replace(/\D/g,'');return s.length>=7?`${s.slice(0,5)}-${s.slice(5,8)}`:v||'—';};
      const buildEnd=cl=>{const p=[];if(cl.RUA)p.push(cl.RUA);if(cl.NUMERO)p.push(`, ${cl.NUMERO}`);if(cl.COMPLEMENTO)p.push(` (${cl.COMPLEMENTO})`);if(cl.SETOR)p.push(` - ${cl.SETOR}`);if(cl.CIDADE_ESTADO)p.push(` - ${cl.CIDADE_ESTADO}`);return p.join('')||'—';};
      const drawField=(lbl,val,x,fy,w,bold=false)=>{
        doc.setFont('helvetica','bold');doc.setFontSize(5.5);doc.setTextColor(...MUT);doc.text(lbl,x,fy);
        doc.setFont('helvetica',bold?'bold':'normal');doc.setFontSize(8);doc.setTextColor(...DK);
        doc.text(doc.splitTextToSize(String(val||'—'),w-2)[0],x,fy+4.5);
      };
      const STATUS_LABEL_PDF={ativo:'ATIVO',ativo_em_dia:'EM DIA',ativo_em_atraso:'EM ATRASO',em_cobranca:'EM COBRANÇA',pre_prejuizo:'PRÉ-PREJUÍZO',baixado_como_prejuizo:'BAIXADO',em_recuperacao:'EM RECUPERAÇÃO',recuperado_parcialmente:'REC. PARCIAL',recuperado_integralmente:'RECUPERADO',quitado:'QUITADO',cancelado:'CANCELADO',renegociado:'RENEGOCIADO',acordo_assistido:'ACORDO ASSIST.',em_processo_judicial:'JUDICIAL'};
      const STATUS_COR_PDF={ativo:G,ativo_em_dia:G,ativo_em_atraso:O,em_cobranca:O,pre_prejuizo:R,baixado_como_prejuizo:R,em_recuperacao:B,recuperado_parcialmente:B,recuperado_integralmente:G,quitado:G,cancelado:MUT,renegociado:B,acordo_assistido:B,em_processo_judicial:R};

      const periodo=ctrDe?labelPeriodoCtr:"Todos os contratos";
      const now=new Date();
      const geradoEm=now.toLocaleDateString('pt-BR')+' às '+now.toLocaleTimeString('pt-BR',{hour:'2-digit',minute:'2-digit'});
      const total=contratosFiltrados.length;
      const totalValor=contratosFiltrados.reduce((s,c)=>s+parseFloat(c.VALOR_TOTAL||c.VALOR_PRINCIPAL||0),0);
      const totalAtivos=contratosFiltrados.filter(c=>_ST_ATIVOS.has(String(c.STATUS_CONTRATO||"").toLowerCase())).length;
      const cliMap=new Map((clientes||[]).map(c=>[String(c.ID_CLIENTE),c]));

      // ─── CABEÇALHO ───
      doc.setFillColor(...NAV);doc.rect(0,0,W,44,'F');
      doc.setFillColor(31,184,119);doc.roundedRect(pd,11,9,9,2,2,'F');
      doc.setFillColor(255,255,255);doc.roundedRect(pd+6,17,9,9,2,2,'F');
      doc.setFillColor(14,92,68);doc.roundedRect(pd+6,17,3.5,3.5,0.8,0.8,'F');
      doc.setFont('helvetica','bold');doc.setFontSize(15);doc.setTextColor(...WH);doc.text('BORGES ASSESSORIA',pd+17,17);
      doc.setFont('helvetica','normal');doc.setFontSize(7.5);doc.setTextColor(135,223,182);doc.text('RELATÓRIO DE CONTRATOS',pd+17,23);
      ['borgesassessoriafinanceira@gmail.com','(62) 98487-7843'].forEach((l,i)=>{
        doc.setFont('helvetica','normal');doc.setFontSize(7);doc.setTextColor(135,223,182);doc.text(l,W-pd,14+i*5,{align:'right'});
      });
      doc.setFillColor(14,92,68);doc.roundedRect(W-pd-70,29,70,10,2,2,'F');
      doc.setFont('helvetica','bold');doc.setFontSize(8);doc.setTextColor(...WH);
      doc.text(doc.splitTextToSize(periodo,66)[0],W-pd-35,35,{align:'center'});
      doc.setFont('helvetica','normal');doc.setFontSize(7);doc.setTextColor(135,223,182);doc.text(`Gerado em: ${geradoEm}`,pd,36);

      let y=54;

      // ─── KPI RESUMO ───
      const kpiW=(CW-6)/3;
      [{label:'TOTAL CONTRATOS',val:String(total),sub:'no período filtrado',c:DK},
       {label:'VOLUME TOTAL',val:fR(totalValor),sub:'soma dos valores dos contratos',c:G},
       {label:'CONTRATOS ATIVOS',val:String(totalAtivos),sub:'status ativo / em dia',c:SIG},
      ].forEach((card,i)=>{
        const cx=pd+i*(kpiW+3);
        doc.setFillColor(...LGR);doc.setDrawColor(...BDC);doc.setLineWidth(0.3);doc.roundedRect(cx,y,kpiW,24,3,3,'FD');
        doc.setFillColor(...card.c);doc.roundedRect(cx,y,3,24,1.5,1.5,'F');
        doc.setFont('helvetica','bold');doc.setFontSize(6);doc.setTextColor(...MUT);doc.text(card.label,cx+7,y+8);
        doc.setFont('helvetica','bold');doc.setFontSize(i===0||i===2?14:10);doc.setTextColor(...card.c);doc.text(card.val,cx+7,y+17);
        doc.setFont('helvetica','normal');doc.setFontSize(6);doc.setTextColor(...MUT);doc.text(card.sub,cx+7,y+22);
      });
      y+=32;

      // Título seção
      doc.setFont('helvetica','bold');doc.setFontSize(9);doc.setTextColor(...DK);doc.text('DADOS DOS CONTRATOS',pd,y);
      doc.setDrawColor(...BDC);doc.setLineWidth(0.4);doc.line(pd,y+2,W-pd,y+2);
      y+=8;

      if(total===0){
        doc.setFont('helvetica','normal');doc.setFontSize(11);doc.setTextColor(...MUT);
        doc.text('Nenhum contrato encontrado no período selecionado.',W/2,y+20,{align:'center'});
      }

      // ─── CARD POR CONTRATO ───
      // Layout: header(9) + nome(8) + [cpf|rg](8) + [email|tel](8) + [cep|parcelas](8) + endereço(8) = 49mm + padding
      const CARD_H=51,HALF=CW/2;
      contratosFiltrados.forEach(c=>{
        if(y+CARD_H>284){doc.addPage();y=16;}
        const cl=cliMap.get(String(c.ID_CLIENTE))||{};
        const stC=STATUS_COR_PDF[c.STATUS_CONTRATO]||MUT;
        const stL=STATUS_LABEL_PDF[c.STATUS_CONTRATO]||c.STATUS_CONTRATO||'—';
        const valTotal=parseFloat(c.VALOR_TOTAL||c.VALOR_PRINCIPAL||0);

        // Card border
        doc.setFillColor(...WH);doc.setDrawColor(...BDC);doc.setLineWidth(0.3);
        doc.roundedRect(pd,y,CW,CARD_H,2.5,2.5,'FD');

        // Header bar
        doc.setFillColor(...NAV);doc.roundedRect(pd,y,CW,9,2.5,2.5,'F');
        doc.rect(pd,y+4,CW,5,'F');

        // ID contrato
        doc.setFont('helvetica','bold');doc.setFontSize(8.5);doc.setTextColor(...WH);
        doc.text(String(c.ID_CONTRATO||'—'),pd+4,y+6.3);

        // Status pill
        const pillW=30;
        doc.setFillColor(...stC);doc.roundedRect(pd+30,y+1.5,pillW,6,1.5,1.5,'F');
        doc.setFont('helvetica','bold');doc.setFontSize(5.8);doc.setTextColor(...WH);
        doc.text(stL,pd+30+pillW/2,y+5.5,{align:'center'});

        // Data
        doc.setFont('helvetica','normal');doc.setFontSize(7);doc.setTextColor(135,223,182);
        doc.text(c.DATA_EMPRESTIMO?fmtDt(parseDate(c.DATA_EMPRESTIMO)):'—',pd+68,y+6.3);

        // Valor total (destaque direita)
        doc.setFont('helvetica','bold');doc.setFontSize(10);doc.setTextColor(168,224,63);
        doc.text(fR(valTotal),pd+CW-4,y+6.3,{align:'right'});

        // Separador vertical ao centro do body
        doc.setDrawColor(...BDC);doc.setLineWidth(0.2);
        doc.line(pd+HALF,y+9,pd+HALF,y+CARD_H-1);

        // Separadores horizontais entre linhas
        [9+8,9+16,9+24,9+32].forEach(off=>{
          doc.setDrawColor(...BDC);doc.setLineWidth(0.1);
          doc.line(pd+1,y+off,pd+CW-1,y+off);
        });

        const BY=y+11; // body start
        const RH=8;    // row height

        // Linha 1: Nome completo (full width)
        drawField('NOME COMPLETO',cl.NOME||cl.NOME_CLIENTE||c.NOME_CLIENTE||'—',pd+4,BY,CW-8,true);

        // Linha 2: CPF | RG
        drawField('CPF',cl.CPF?fmtCPF(cl.CPF):'—',pd+4,BY+RH,HALF-6);
        drawField('RG',cl.RG||'—',pd+HALF+4,BY+RH,HALF-8);

        // Linha 3: Email | Telefone
        drawField('E-MAIL',cl.EMAIL||'—',pd+4,BY+RH*2,HALF-6);
        drawField('TELEFONE',(cl.TELEFONE_WPP||cl.TELEFONE)?fmtTel(cl.TELEFONE_WPP||cl.TELEFONE):'—',pd+HALF+4,BY+RH*2,HALF-8);

        // Linha 4: CEP | Parcelamento
        drawField('CEP',cl.CEP?fmtCEP(cl.CEP):'—',pd+4,BY+RH*3,HALF-6);
        drawField('PARCELAMENTO',`${c.NUM_PARCELAS||'—'}x de ${fR(c.VALOR_PARCELA)}`,pd+HALF+4,BY+RH*3,HALF-8);

        // Linha 5: Endereço (full width)
        drawField('ENDEREÇO COMPLETO',buildEnd(cl),pd+4,BY+RH*4,CW-8);

        y+=CARD_H+4;
      });

      // ─── RODAPÉ ───
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
      const suf=ctrDe?dStrFin(ctrDe).replace(/\//g,'-'):'completo';
      a.href=url;a.download=`relatorio_contratos_${suf}.pdf`;
      document.body.appendChild(a);a.click();document.body.removeChild(a);
      setTimeout(()=>URL.revokeObjectURL(url),3000);
    }catch(e){console.error('PDF error:',e);alert('Erro ao gerar PDF: '+e.message);}
  }

  function abrirExportContabilidade(){
    const hoje=new Date();
    const inicioMesAnterior=new Date(hoje.getFullYear(),hoje.getMonth()-1,1);
    const fimMesAnterior=new Date(hoje.getFullYear(),hoje.getMonth(),0);
    setExpDe(inicioMesAnterior);setExpAte(fimMesAnterior);
    if(expCalBtnRef.current){const r=expCalBtnRef.current.getBoundingClientRect();setExpCalPos({top:r.bottom+8,right:window.innerWidth-r.right});}
    setExpCalOpen(true);
  }

  function exportarCSVContabilidade(deArg,ateArg){
    try{
      const ini=new Date(deArg);ini.setHours(0,0,0,0);
      const fim=new Date(ateArg);fim.setHours(23,59,59,999);
      const cliMap=new Map((clientes||[]).map(c=>[String(c.ID_CLIENTE),c]));
      const fmtCPF=v=>{if(!v)return'';const s=String(v).replace(/\D/g,'').padStart(11,'0');return s.length===11?`${s.slice(0,3)}.${s.slice(3,6)}.${s.slice(6,9)}-${s.slice(9)}`:s;};
      const fmtCEP=v=>{if(!v)return'';const s=String(v).replace(/\D/g,'');return s.length>=7?`${s.slice(0,5)}-${s.slice(5,8)}`:s;};
      const buildEnd=cl=>{const p=[];if(cl.RUA)p.push(cl.RUA);if(cl.NUMERO)p.push(`, ${cl.NUMERO}`);if(cl.COMPLEMENTO)p.push(` (${cl.COMPLEMENTO})`);if(cl.QUADRA)p.push(` Qd.${cl.QUADRA}`);if(cl.LOTE)p.push(` Lt.${cl.LOTE}`);if(cl.SETOR)p.push(` - ${cl.SETOR}`);if(cl.CIDADE_ESTADO)p.push(` - ${cl.CIDADE_ESTADO}`);return p.join('');};

      const linhas=(contratos||[])
        .filter(c=>{
          const d=parseDate(c.DATA_EMPRESTIMO);
          if(!d)return false;
          const dc=new Date(d.getTime());dc.setHours(12,0,0,0);
          if(!(dc>=ini&&dc<=fim))return false;
          return String(c.STATUS_CONTRATO||"").toLowerCase()!=="cancelado";
        })
        .sort((a,b)=>String(a.ID_CONTRATO||"").localeCompare(String(b.ID_CONTRATO||""),"pt-BR",{numeric:true}))
        .map(c=>{
          const cl=cliMap.get(String(c.ID_CLIENTE))||{};
          const tel=cl.TELEFONE_WPP||cl.TELEFONE;
          const valor=parseFloat(c.VALOR_TOTAL||0).toFixed(2).replace('.',',');
          return [
            c.ID_CONTRATO||'',
            cl.NOME||cl.NOME_CLIENTE||c.NOME_CLIENTE||'',
            fmtCPF(cl.CPF),
            cl.RG||'',
            cl.EMAIL||'',
            tel?fmtTel(tel):'',
            fmtCEP(cl.CEP),
            buildEnd(cl),
            valor,
          ];
        });

      if(linhas.length===0){
        alert('Nenhum contrato encontrado no período selecionado (contratos cancelados não entram no arquivo).');
        return;
      }

      const header=['ID Contrato','Nome Completo','CPF','RG','E-mail','Telefone','CEP','Endereço Completo','Valor Contrato'];
      const esc=v=>{const s=String(v??'');return /[;"\r\n]/.test(s)?`"${s.replace(/"/g,'""')}"`:s;};
      const csvBody=[header,...linhas].map(l=>l.map(esc).join(';')).join('\r\n');
      const csv='﻿'+csvBody;
      const blob=new Blob([csv],{type:'text/csv;charset=utf-8'});
      const url=URL.createObjectURL(blob);
      const a=document.createElement('a');
      const mm=String(deArg.getMonth()+1).padStart(2,'0');
      const aa=deArg.getFullYear();
      a.href=url;a.download=`contabilidade_${mm}-${aa}.csv`;
      document.body.appendChild(a);a.click();document.body.removeChild(a);
      setTimeout(()=>URL.revokeObjectURL(url),3000);
    }catch(e){console.error('CSV contabilidade error:',e);alert('Erro ao gerar CSV: '+e.message);}
  }

  const aguardando=useMemo(()=>(clientes||[]).filter(c=>c.STATUS_CLIENTE==="aguardando_conferencia"),[clientes]);
  const promessasAtivas=useMemo(()=>(promessas||[]).filter(p=>String(p.STATUS_PROMESSA||"").toUpperCase()==="PENDENTE").length,[promessas]);

  const abrirConferencia=(c)=>{
    setSelCliAba("editar");
    setSelCli(c);
    setTab("clientes");
  };

  const NavSection=({label})=>sidebarOpen?<div style={{fontSize:10,fontWeight:700,color:"rgba(255,255,255,0.32)",textTransform:"uppercase",letterSpacing:"0.1em",padding:"10px 14px 4px"}}>{label}</div>:<div style={{height:12}}/>;
  const Nav=({id,label,ico,badge,badgeRed})=>{
    const active=tab===id;
    return(
      <div onClick={()=>setTab(id)} title={!sidebarOpen?label:undefined}
        className="nav-link-item"
        style={{display:"flex",alignItems:"center",justifyContent:sidebarOpen?"flex-start":"center",gap:sidebarOpen?10:0,padding:sidebarOpen?"9px 12px":"9px 0",borderRadius:10,cursor:"pointer",background:active?"rgba(168,224,63,0.14)":"transparent",marginBottom:1}}
        onMouseEnter={e=>!active&&(e.currentTarget.style.background="rgba(255,255,255,0.06)")}
        onMouseLeave={e=>!active&&(e.currentTarget.style.background="transparent")}
      >
        {sidebarOpen&&active
          ? <div style={{width:8,height:8,borderRadius:"50%",background:"#A8E03F",flexShrink:0,border:"2px solid #46CB92"}}/>
          : <span style={{display:"flex",flexShrink:0,color:active?"#A8E03F":"rgba(255,255,255,0.62)"}}>{ico}</span>
        }
        {sidebarOpen&&<span style={{fontSize:13,fontWeight:active?700:400,color:active?"#A8E03F":"rgba(255,255,255,0.62)",flex:1,whiteSpace:"nowrap"}}>{label}</span>}
        {sidebarOpen&&badge>0&&(
          <span style={{fontSize:10,fontWeight:800,background:badgeRed?"rgba(239,37,59,0.20)":"rgba(168,224,63,0.15)",color:badgeRed?"#ef253b":"#A8E03F",padding:"1px 8px",borderRadius:99,minWidth:20,textAlign:"center",flexShrink:0}}>
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
    @keyframes slideInRight{from{opacity:0;transform:translateX(32px)}to{opacity:1;transform:translateX(0)}}

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
      <ProgressBar pct={_progPct}/>

      {finCalOpen&&<div onClick={()=>setFinCalOpen(false)} style={{position:"fixed",inset:0,zIndex:199,background:"transparent"}}/>}
      {dashCalOpen&&<div onClick={()=>setDashCalOpen(false)} style={{position:"fixed",inset:0,zIndex:199,background:"transparent"}}/>}
      {ctrCalOpen&&<div onClick={()=>setCtrCalOpen(false)} style={{position:"fixed",inset:0,zIndex:199,background:"transparent"}}/>}
      {expCalOpen&&<div onClick={()=>setExpCalOpen(false)} style={{position:"fixed",inset:0,zIndex:199,background:"transparent"}}/>}

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
      {ctrCalOpen&&(
        <div style={{position:"fixed",top:ctrCalPos.top,right:ctrCalPos.right,zIndex:300}} onClick={e=>e.stopPropagation()}>
          <CalendarioRange de={ctrDe} ate={ctrAte} onSelecionar={(d,a)=>{setCtrDe(d);setCtrAte(a);if(a)setCtrCalOpen(false);}} onLimpar={()=>{setCtrDe(null);setCtrAte(null);setCtrCalOpen(false);}}/>
        </div>
      )}
      {expCalOpen&&(
        <div style={{position:"fixed",top:expCalPos.top,right:expCalPos.right,zIndex:300}} onClick={e=>e.stopPropagation()}>
          <CalendarioRange de={expDe} ate={expAte} onSelecionar={(d,a)=>{setExpDe(d);setExpAte(a);}} onLimpar={()=>{setExpDe(null);setExpAte(null);}}/>
          <div style={{background:CARD,border:`1px solid ${BD}`,borderTop:"none",borderRadius:"0 0 16px 16px",padding:"10px 16px",display:"flex",justifyContent:"space-between",alignItems:"center",gap:10,boxShadow:SHD}}>
            <span style={{fontSize:11,color:MUTED,fontWeight:600}}>{expDe&&expAte?`${dStrFin(expDe)} → ${dStrFin(expAte)}`:"Selecione o período"}</span>
            <button disabled={!expDe||!expAte} onClick={()=>{exportarCSVContabilidade(expDe,expAte);setExpCalOpen(false);}} style={{...BTN7(GRN),padding:"6px 14px",fontSize:12,opacity:(!expDe||!expAte)?0.5:1,cursor:(!expDe||!expAte)?"not-allowed":"pointer"}}>Exportar CSV</button>
          </div>
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
            <rect x="25" y="25" width="40" height="40" rx="9" fill="#FFFFFF"/>
            <path d="M25 25 H43 V43 H25 Z" fill="#0E5C44"/>
          </svg>
          {sidebarOpen&&<div>
            <div style={{fontWeight:700,fontSize:14,letterSpacing:"-0.02em",color:"#FFFFFF",lineHeight:1.2}}>Borges Assessoria</div>
            <div style={{fontSize:10,fontWeight:500,color:"#87DFB6",textTransform:"uppercase",letterSpacing:"0.08em",marginTop:2}}>Crédito Privado</div>
          </div>}
        </div>
        {sidebarOpen&&<div style={{padding:"10px 16px 0"}}><LinhaConfianca w={188} h={20} n={6} sw={1.5} color="rgba(168,224,63,0.4)"/></div>}
        <div style={{padding:sidebarOpen?"8px 10px":"10px 6px",flex:1,overflowY:"auto"}}>
          <NavSection label="Principal"/>
          <Nav id="dashboard"  label="Dashboard"        ico={IcoDash}/>
          <Nav id="clientes"   label="Clientes"         ico={IcoCli}   badge={aguardando.length}/>
          <Nav id="contratos"  label="Contratos"        ico={IcoCtr}/>
          <Nav id="gestao"     label="Gestão"           ico={<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="22,12 18,12 15,21 9,3 6,12 2,12"/></svg>}/>
          <NavSection label="Operação"/>
          <Nav id="cobranca"   label="Cobrança"         ico={IcoBell}  badge={parcelasAtrasadas.length} badgeRed/>
          <Nav id="financeiro" label="Financeiro"       ico={IcoTrendUp}/>
          <Nav id="carteira"   label="Carteira"         ico={IcoCart}/>
          <Nav id="perdas"     label="Perdas & Recup."  ico={IcoLoss}/>
          <Nav id="promessas"  label="Promessas"        ico={IcoProm}  badge={promessasAtivas} badgeRed/>
          <Nav id="regua"      label="Régua WPP"        ico={<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/><polyline points="9 10 12 13 15 10"/></svg>}/>
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
                    <rect x="25" y="25" width="40" height="40" rx="9" fill={darkMode?"#FFFFFF":"#0B3D2E"}/>
                    <path d="M25 25 H43 V43 H25 Z" fill={darkMode?"#0E5C44":"#07241B"}/>
                  </svg>
                  <span style={{fontWeight:700,fontSize:15,letterSpacing:"-0.02em",color:TEXT}}>Borges</span>
                </div>
              : <h2 style={{fontSize:18,fontWeight:700,margin:0}}>{{dashboard:"Dashboard",clientes:"Clientes",contratos:"Contratos",gestao:"Gestão",cobranca:"Cobrança",financeiro:"Financeiro",carteira:"Carteira de Crédito",perdas:"Perdas & Recuperação",promessas:"Promessas",regua:"Régua WPP",simulador:"Simulador",inteligencia:"Inteligência"}[tab]||tab}</h2>
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
            const promAbertas=(promessas||[]).filter(p=>["PENDENTE","QUEBRADA"].includes(String(p.STATUS_PROMESSA||"").toUpperCase())).sort((a,b)=>toNum(parseDate(a.DATA_PREVISTA_PAGAMENTO))-toNum(parseDate(b.DATA_PREVISTA_PAGAMENTO))).slice(0,4);
            const pagRecentes=[...(pagamentos||[])].sort((a,b)=>toNum(parseDate(b.DATA_PAGAMENTO))-toNum(parseDate(a.DATA_PAGAMENTO))).slice(0,6);
            const taxaMedia=(()=>{const at=(contratos||[]).filter(c=>["ativo","ativo_em_dia","ativo_em_atraso","em_cobranca","pre_prejuizo"].includes(String(c.STATUS_CONTRATO||"").toLowerCase()));if(!at.length)return 0;return at.reduce((s,c)=>s+parseFloat(c.TAXA_JUROS_MENSAL||0),0)/at.length*100;})();
            const hj30=new Date();hj30.setHours(0,0,0,0);const em30=new Date(hj30);em30.setDate(em30.getDate()+30);
            const aReceber30=(parcelas||[]).filter(p=>{const v=parseDate(p.DATA_VENCIMENTO);return v&&v>=hj30&&v<=em30&&!_ST_TERMINAL.has(String(p.STATUS||p.STATUS_PARCELA||"").toLowerCase());});
            const vAReceber30=aReceber30.reduce((s,p)=>s+parseFloat(p.VALOR_PARCELA||0),0);
            const clientesAtraso=new Set(parcelasAtrasadas.map(p=>p.ID_CLIENTE)).size;
            const horaAtual=new Date().getHours();
            const saudacao=horaAtual<12?"Bom dia":horaAtual<18?"Boa tarde":"Boa noite";
            const recebidoMesAnterior=(()=>{const hj=new Date();const ini=new Date(hj.getFullYear(),hj.getMonth()-1,1,0,0,0);const ultimoDiaMesAnterior=new Date(hj.getFullYear(),hj.getMonth(),0).getDate();const diaCorte=Math.min(hj.getDate(),ultimoDiaMesAnterior);const fim=new Date(hj.getFullYear(),hj.getMonth()-1,diaCorte,23,59,59);return(pagamentos||[]).filter(p=>{const d=parseDate(p.DATA_PAGAMENTO);return d&&d>=ini&&d<=fim&&p.TIPO_PAGAMENTO!=="abatimento_acordo_assistido";}).reduce((s,p)=>s+parseFloat(p.VALOR_PAGO||0),0);})();
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
                </div>
              </div>

              {/* 5 KPI CARDS */}
              <div className="dash-kpi-row" style={{display:"grid",gridTemplateColumns:mob?"1fr 1fr":"repeat(5,1fr)",gap:mob?10:14}}>
                {[
                  {l:"Carteira Total",     v:fmtR(M.vAtivos),           sub:`${M.contratosAtivos} contratos ativos`,   vc:TEXT, icBg:GRN+"18", ic:<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={GRN} strokeWidth="2"><rect x="2" y="7" width="20" height="14" rx="2"/><path d="M16 7V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v2"/></svg>, bd:`1px solid ${BD}`, accent:GRN, tip:"Soma do VALOR_PRINCIPAL dos contratos em aberto (ativos, em atraso, em cobrança). É o capital que está efetivamente emprestado agora."},
                  {l:"A Receber (30d)",    v:fmtR(vAReceber30),          sub:`${aReceber30.length} parcelas previstas`, vc:TEXT, icBg:GRN+"14", ic:<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={GRN} strokeWidth="2"><polyline points="23,6 13.5,15.5 8.5,10.5 1,18"/><polyline points="17,6 23,6 23,12"/></svg>, bd:`1px solid ${BD}`, accent:GRN, tip:"Valor total das parcelas com vencimento nos próximos 30 dias que ainda não foram pagas. É a previsão de caixa de entrada no curto prazo."},
                  {l:labelKpiRecebido,    v:fmtR(M.receitaTotal),       sub:`${M.pagamentosPeriodo} pagamentos`,       vc:GRN, icBg:GRN+"14", ic:<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={GRN} strokeWidth="2"><circle cx="12" cy="12" r="10"/><polyline points="9,12 11,14 15,10"/></svg>, bd:`1px solid ${GRN}18`, accent:GRN, delta:deltaRecebido, tip:"Soma de todos os valores recebidos no período selecionado (inclui principal + juros + mora). Muda conforme o filtro Este mês / 30 dias / 90 dias. O percentual (quando Este mês) compara com o mesmo intervalo de dias do mês anterior — não com o mês anterior inteiro."},
                  {l:"Em Atraso",          v:fmtR(totalParcelasAtrasadas),sub:`${parcelasAtrasadas.length} parcelas`,  vc:RED, icBg:RED+"18", ic:<span style={{color:RED}}>{IcoWarnTri}</span>, bd:`1px solid ${RED}20`, accent:RED, badge:clientesAtraso>0?`${clientesAtraso} cliente${clientesAtraso>1?"s":""}`:null, tip:"Valor das parcelas que passaram do vencimento e não foram pagas. Exclui contratos encerrados e parcelas com acordo futuro ativo."},
                  {l:"Capital Disponível", v:fmtR(M.caixaAtual),          sub:"Caixa líquido",                          vc:GRN, icBg:GRN+"14", ic:<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={GRN} strokeWidth="2"><line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>, bd:`1px solid ${GRN}14`, accent:GRN, tip:"Total já recebido de todos os clientes (histórico) menos o total de principal emprestado (histórico). Representa o caixa líquido gerado pelo negócio desde o início."},
                ].map((k)=>(
                  <div key={k.l} className="kpi-card-item" style={{background:CARD,padding:mob?"12px 12px":"18px 18px",borderRadius:16,border:k.bd||`1px solid ${BD}`,boxShadow:SHD,display:"flex",flexDirection:"column",gap:0,position:"relative",overflow:"hidden"}}>
                    <div style={{display:"flex",alignItems:"flex-start",justifyContent:"space-between",marginBottom:12}}>
                      <div style={{fontSize:10,fontWeight:600,color:MUTED,textTransform:"uppercase",letterSpacing:"0.08em",lineHeight:1.3,display:"flex",alignItems:"center",flex:1,minWidth:0}}>{k.l}{k.tip&&<InfoTooltip text={k.tip}/>}</div>
                      <div style={{width:30,height:30,borderRadius:8,background:k.icBg,display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0,marginLeft:6}}>{k.ic}</div>
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

              {/* HERO BANNER — KPI do dia, único elemento em --brand (hierarquia v3) */}
              <div className="rounded-[20px] overflow-hidden hero-banner-dash dash-hero" style={{background:`linear-gradient(145deg, ${ACC} 0%, ${GRN2} 38%, ${GRN} 68%, ${ACCINK} 100%)`,padding:mob?"20px 18px":"28px 32px",boxShadow:SHDLG}}>
                <div className={`flex ${mob?"flex-col":"flex-row"} ${mob?"mb-5":"mb-6"}`} style={{gap:mob?0:0}}>
                  {[
                    {l:"Carteira Total (Capital Emprestado)",v:fmtR(M.vAtivos),sub:`${M.contratosAtivos} contratos ativos`},
                    {l:"Taxa Média de Retorno",v:`${taxaMedia.toFixed(1)}% a.m.`,sub:"Sobre contratos ativos"},
                    {l:"Taxa de Adimplência",v:M.vAtivos>0?fmtP(100-M.taxaInadNPL):"—",sub:`NPL 90+ dias · ${M.qtdNPL90} contrato${M.qtdNPL90!==1?"s":""} · ${fmtR(M.principalInadNPL)} de ${fmtR(M.vAtivos)}`},
                  ].map((s,i)=>(
                    <div key={s.l} style={{flex:1,padding:mob?"0 0 16px 0":i===0?"0 32px 0 0":`0 32px`,borderBottom:mob&&i<2?`1px solid rgba(255,255,255,0.14)`:"none",borderRight:!mob&&i<2?`1px solid rgba(255,255,255,0.14)`:"none",marginBottom:mob&&i<2?16:0}}>
                      <div className="text-[10px] font-bold uppercase tracking-[0.1em] mb-2 mono" style={{color:ONBRANDSOFT}}>{s.l}</div>
                      <div className="font-black leading-none num" style={{fontSize:mob?22:26,letterSpacing:"0.5px",color:ONBRAND}}>{priv(s.v)}</div>
                      <div className="text-[11px] font-medium mt-1.5" style={{color:ONBRANDSOFT}}>{s.sub}</div>
                    </div>
                  ))}
                </div>
              </div>

              {/* GRÁFICO */}
              <div className="chart-card-dash dash-chart" style={{background:CARD,borderRadius:16,padding:mob?"16px":"22px",border:`1px solid ${BD}`,boxShadow:SHD}}>
                <div style={{display:"flex",alignItems:"flex-start",justifyContent:"space-between",marginBottom:20}}>
                  <div>
                    <div style={{fontSize:13,fontWeight:600,color:MUTED,textTransform:"uppercase",letterSpacing:"0.06em"}}>Recebimentos Mensais</div>
                    <div style={{fontSize:mob?20:26,fontWeight:800,letterSpacing:"0.02em",marginTop:4,color:TEXT}}>{priv(fmtR(chartData[chartData.length-1]?.value||0))}</div>
                    {(()=>{const curr=chartData[chartData.length-1]?.value||0;const hj=new Date();const iniAnt=new Date(hj.getFullYear(),hj.getMonth()-1,1,0,0,0);const ultimoDiaMesAnterior=new Date(hj.getFullYear(),hj.getMonth(),0).getDate();const diaCorte=Math.min(hj.getDate(),ultimoDiaMesAnterior);const fimAnt=new Date(hj.getFullYear(),hj.getMonth()-1,diaCorte,23,59,59);const prev=(pagamentos||[]).filter(p=>{const dp=parseDate(p.DATA_PAGAMENTO);return dp&&dp>=iniAnt&&dp<=fimAnt&&p.TIPO_PAGAMENTO!=="abatimento_acordo_assistido";}).reduce((s,p)=>s+parseFloat(p.VALOR_PAGO||0),0);const delta=prev>0?((curr-prev)/prev*100):0;return delta!==0?<div style={{fontSize:12,color:delta>0?GRN:RED,fontWeight:500,marginTop:3}}>{delta>0?"▲":"▼"} {Math.abs(delta).toFixed(1)}% em relação ao mesmo período do mês anterior (dia 1–{diaCorte})</div>:null;})()}
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

              {/* PAINEL DE STATUS — distribuído em grid abaixo do gráfico */}
              {!mob&&(
              <div className="grid gap-4" style={{gridTemplateColumns:"repeat(auto-fit,minmax(320px,1fr))"}}>

                  {/* EM ATRASO */}
                  {parcelasAtrasadas.length>0&&(
                  <div className="side-panel-dash dash-panel" style={{background:CARD,borderRadius:16,border:`1px solid ${BD}`,boxShadow:SHD,overflow:"hidden"}}>
                    <div style={{padding:"14px 16px",display:"flex",alignItems:"center",justifyContent:"space-between",borderBottom:`1px solid ${BD}`}}>
                      <div style={{display:"flex",alignItems:"center",gap:7,color:TEXT,fontSize:13,fontWeight:700}}>{IcoAlert} Em Atraso</div>
                      <button onClick={()=>setTab("cobranca")} style={{fontSize:12,color:GRN,background:"none",border:"none",cursor:"pointer",fontWeight:600,fontFamily:"inherit"}}>Ver cobrança →</button>
                    </div>
                    <div style={{maxHeight:280,overflowY:"auto"}}>
                      {parcelasAtrasadas.slice(0,6).map((p,i)=>{const dias=parseInt(p.DIAS_ATRASO||0);const sev=dias>=15?RED:YEL;return(
                        <div key={p.ID_PARCELA||i} className="panel-list-item" onClick={()=>{const c=(clientes||[]).find(x=>String(x.ID_CLIENTE)===String(p.ID_CLIENTE));if(c){setSelCliAba("perfil");setSelCli(c);}}} style={{display:"flex",alignItems:"center",gap:10,padding:"10px 16px",background:i%2===1?CARD2:"transparent",borderBottom:i<Math.min(parcelasAtrasadas.length,6)-1?`1px solid ${BD}`:"none",cursor:"pointer"}}>
                          <div style={{width:34,height:34,borderRadius:"50%",background:GRN+"18",color:GRN,display:"flex",alignItems:"center",justifyContent:"center",fontSize:11,fontWeight:700,flexShrink:0}}>{_ini(p.NOME_CLIENTE)}</div>
                          <div style={{flex:1,minWidth:0}}>
                            <div style={{fontSize:13,fontWeight:600,color:TEXT,whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis"}}>{p.NOME_CLIENTE}</div>
                            <div style={{display:"flex",alignItems:"center",gap:5,marginTop:2}}><span style={{fontSize:11,color:MUTED}}>{p.ID_CONTRATO}</span><Badge c={sev} size="sm">{dias}d</Badge></div>
                          </div>
                          <div style={{textAlign:"right",flexShrink:0}}>
                            <div className="num" style={{fontSize:13,color:RED}}>{fmtR(parseFloat(p.VALOR_PARCELA||0))}</div>
                            <div style={{fontSize:11,color:MUTED,marginTop:1}}>{p.NUM_PARCELA}/{p.TOTAL_PARCELAS||"?"} parc.</div>
                          </div>
                        </div>
                      );})}
                    </div>
                  </div>
                  )}

                  {/* ACORDO ASSISTIDO */}
                  {(()=>{const aa=(contratos||[]).filter(c=>c.STATUS_CONTRATO==="acordo_assistido");if(!aa.length)return null;const totalAbat=aa.reduce((s,c)=>s+parseFloat(c.VALOR_ABATIDO_ASSISTIDO||0),0);return(
                  <div className="side-panel-dash dash-panel" style={{background:CARD,borderRadius:16,border:`1px solid ${BLU}30`,boxShadow:SHD,overflow:"hidden"}}>
                    <div style={{padding:"14px 16px",display:"flex",alignItems:"center",justifyContent:"space-between",borderBottom:`1px solid ${BD}`}}>
                      <div style={{display:"flex",alignItems:"center",gap:7,color:BLU,fontSize:13,fontWeight:700}}>{IcoHandshake} Acordo Assistido</div>
                      <button onClick={()=>setTab("perdas")} style={{fontSize:12,color:GRN,background:"none",border:"none",cursor:"pointer",fontWeight:600,fontFamily:"inherit"}}>Ver perdas →</button>
                    </div>
                    <div style={{maxHeight:200,overflowY:"auto"}}>
                      {aa.map((c,i)=>(
                        <div key={c.ID_CONTRATO||i} className="panel-list-item" onClick={()=>setContratoSel(c)} style={{display:"flex",alignItems:"center",gap:10,padding:"10px 16px",borderBottom:i<aa.length-1?`1px solid ${BD}`:"none",cursor:"pointer"}}>
                          <div style={{width:34,height:34,borderRadius:"50%",background:BLU+"18",color:BLU,display:"flex",alignItems:"center",justifyContent:"center",fontSize:11,fontWeight:700,flexShrink:0}}>{_ini(c.NOME_CLIENTE)}</div>
                          <div style={{flex:1,minWidth:0}}>
                            <div style={{fontSize:13,fontWeight:600,color:TEXT,whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis"}}>{c.NOME_CLIENTE}</div>
                            <div style={{fontSize:11,color:MUTED,marginTop:1}}>{c.ID_CONTRATO}{c.MOTIVO_ACORDO_ASSISTIDO?` · ${c.MOTIVO_ACORDO_ASSISTIDO}`:""}</div>
                          </div>
                          <div style={{textAlign:"right",flexShrink:0}}>
                            <div style={{fontSize:13,fontWeight:700,color:BLU}}>{fmtR(parseFloat(c.VALOR_ABATIDO_ASSISTIDO||0))}</div>
                            <div style={{fontSize:11,color:MUTED,marginTop:1}}>abatido</div>
                          </div>
                        </div>
                      ))}
                    </div>
                    {totalAbat>0&&<div style={{padding:"8px 16px",borderTop:`1px solid ${BD}`,fontSize:11,color:MUTED,fontWeight:600}}>Total abatido: {fmtR(totalAbat)}</div>}
                  </div>
                  );})()}

                  {/* JUDICIALIZADOS */}
                  {(()=>{const jj=(contratos||[]).filter(c=>c.STATUS_CONTRATO==="em_processo_judicial");if(!jj.length)return null;const totalExec=jj.reduce((s,c)=>s+parseFloat(c.VALOR_EXECUTADO||c.VALOR_TOTAL||c.VALOR_PRINCIPAL||0),0);const totalRecup=jj.reduce((s,c)=>s+parseFloat(c.VALOR_RECUPERADO_JUDICIAL_PRINCIPAL||0)+parseFloat(c.VALOR_RECUPERADO_JUDICIAL_LUCRO||0),0);return(
                  <div className="side-panel-dash dash-panel" style={{background:CARD,borderRadius:16,border:`1px solid ${RED}30`,boxShadow:SHD,overflow:"hidden"}}>
                    <div style={{padding:"14px 16px",display:"flex",alignItems:"center",justifyContent:"space-between",borderBottom:`1px solid ${BD}`}}>
                      <div style={{display:"flex",alignItems:"center",gap:7,color:RED,fontSize:13,fontWeight:700}}>{IcoJur} Em Processo Judicial</div>
                      <button onClick={()=>setTab("perdas")} style={{fontSize:12,color:GRN,background:"none",border:"none",cursor:"pointer",fontWeight:600,fontFamily:"inherit"}}>Ver perdas →</button>
                    </div>
                    <div style={{maxHeight:200,overflowY:"auto"}}>
                      {jj.map((c,i)=>(
                        <div key={c.ID_CONTRATO||i} className="panel-list-item" onClick={()=>setContratoSel(c)} style={{display:"flex",alignItems:"center",gap:10,padding:"10px 16px",borderBottom:i<jj.length-1?`1px solid ${BD}`:"none",cursor:"pointer"}}>
                          <div style={{width:34,height:34,borderRadius:"50%",background:RED+"18",color:RED,display:"flex",alignItems:"center",justifyContent:"center",fontSize:11,fontWeight:700,flexShrink:0}}>{_ini(c.NOME_CLIENTE)}</div>
                          <div style={{flex:1,minWidth:0}}>
                            <div style={{fontSize:13,fontWeight:600,color:TEXT,whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis"}}>{c.NOME_CLIENTE}</div>
                            <div style={{fontSize:11,color:MUTED,marginTop:1}}>{c.ID_CONTRATO}{c.NUMERO_PROCESSO?` · ${c.NUMERO_PROCESSO}`:""}</div>
                          </div>
                          <div style={{textAlign:"right",flexShrink:0}}>
                            <div style={{fontSize:13,fontWeight:700,color:RED}}>{fmtR(parseFloat(c.VALOR_EXECUTADO||c.VALOR_TOTAL||c.VALOR_PRINCIPAL||0))}</div>
                            <div style={{fontSize:11,color:MUTED,marginTop:1}}>executado</div>
                          </div>
                        </div>
                      ))}
                    </div>
                    {totalExec>0&&<div style={{padding:"8px 16px",borderTop:`1px solid ${BD}`,fontSize:11,color:MUTED,fontWeight:600,display:"flex",justifyContent:"space-between"}}><span>Total executado: {fmtR(totalExec)}</span>{totalRecup>0&&<span style={{color:GRN}}>Recuperado: {fmtR(totalRecup)}</span>}</div>}
                  </div>
                  );})()}

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
          );})()}

          {/* CLIENTES */}
          {tab==="clientes"&&(
            <div className="flex flex-col gap-5" style={{animation:"fadeUp 400ms cubic-bezier(0.16,1,0.3,1) both"}}>
              {/* HEADER */}
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-end",gap:16,flexWrap:"wrap"}}>
                <div>
                  <div style={{fontSize:mob?18:22,fontWeight:800,color:TEXT,letterSpacing:"-0.3px"}}>Clientes</div>
                  <div style={{fontSize:11,color:MUTED,marginTop:4}}>{filtrados.length} cliente{filtrados.length!==1?"s":""} · {filtrados.filter(c=>c.STATUS_CLIENTE==="ativo").length} ativos</div>
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
                    <td><Badge c={c.STATUS_CLIENTE==="ativo"?GRN:YEL}>{(c.STATUS_CLIENTE||"").toUpperCase()}</Badge>{String(c.CLIENTE_BLOQUEADO_MANUAL||"").toUpperCase()==="SIM"&&<span style={{marginLeft:6,fontSize:10,fontWeight:700,color:RED,background:RED+"12",padding:"2px 7px",borderRadius:99,whiteSpace:"nowrap",display:"inline-flex",alignItems:"center",gap:3}}>{IcoLock} BLOQUEADO</span>}</td>
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
                  <div style={{fontSize:11,color:MUTED,marginTop:4}}>{contratosFiltrados.length} contrato{contratosFiltrados.length!==1?"s":""} · {contratosFiltrados.filter(c=>_ST_ATIVOS.has(String(c.STATUS_CONTRATO||"").toLowerCase())).length} ativos{ctrDe?` · ${labelPeriodoCtr}`:""}</div>
                </div>
                <div style={{display:"flex",gap:8,alignItems:"center",flexWrap:"wrap"}}>
                  {ctrDe&&<button className="btn-ghost-anim" onClick={()=>{setCtrDe(null);setCtrAte(null);}} style={{padding:"6px 12px",borderRadius:8,border:`1px solid ${BD}`,background:CARD,color:MUTED,fontSize:12,cursor:"pointer",fontWeight:600,display:"flex",alignItems:"center",gap:5}}><svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg> Limpar</button>}
                  <button className="btn-ghost-anim" onClick={exportarPDFContratos} style={{display:"flex",alignItems:"center",gap:6,padding:"7px 14px",borderRadius:9,border:`1px solid ${GRN}40`,background:GRN+"08",color:GRN,fontSize:12,fontWeight:700,cursor:"pointer"}}>
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
                    PDF
                  </button>
                  <button ref={expCalBtnRef} className="btn-ghost-anim" onClick={abrirExportContabilidade} style={{display:"flex",alignItems:"center",gap:6,padding:"7px 14px",borderRadius:9,border:`1px solid ${BLU}40`,background:BLU+"08",color:BLU,fontSize:12,fontWeight:700,cursor:"pointer"}}>
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M8 3H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7l-5-4H8Z"/><path d="M14 3v4a2 2 0 0 0 2 2h4"/><line x1="8" y1="13" x2="16" y2="13"/><line x1="8" y1="17" x2="13" y2="17"/></svg>
                    Contabilidade
                  </button>
                  <button ref={ctrCalBtnRef} className="btn-ghost-anim" onClick={()=>{if(ctrCalBtnRef.current){const r=ctrCalBtnRef.current.getBoundingClientRect();setCtrCalPos({top:r.bottom+8,right:window.innerWidth-r.right});}setCtrCalOpen(o=>!o);}} style={{display:"flex",alignItems:"center",gap:6,padding:"7px 14px",borderRadius:9,border:`1px solid ${ctrDe?ORG+"40":BD}`,background:ctrDe?ORG+"08":CARD,color:ctrDe?ORG:MUTED,fontSize:12,fontWeight:ctrDe?700:400,cursor:"pointer"}}>
                    {IcoCal} {ctrDe?labelPeriodoCtr:"Filtrar por período"}
                  </button>
                </div>
              </div>
              <div style={{background:CARD,borderRadius:16,border:`1px solid ${BD}`,overflow:"hidden",boxShadow:SHD}}>
              <div style={{padding:mob?12:16,borderBottom:`1px solid ${BD}`,display:"flex",flexDirection:mob?"column":"row",justifyContent:"space-between",alignItems:mob?"stretch":"center",background:BG+"50",gap:10}}>
                <div style={{display:"flex",gap:8,flexWrap:"wrap"}}>
                  <input placeholder="Buscar..." value={filtroCtr} onChange={e=>setFiltroCtr(e.target.value)} style={{...IS(),flex:1,minWidth:140}}/>
                  <select value={filtroStatusCtr} onChange={e=>setFiltroStatusCtr(e.target.value)} style={{...IS(),flex:1,minWidth:140}}>
                    <option value="todos">Todos os status</option>
                    <option value="ativo">Ativo</option>
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
                    <option value="em_processo_judicial">Em Processo Judicial</option>
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
                    {!mob&&<th>Data</th>}
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
          {tab==="cobranca"&&(()=>{
            const cobItemsFiltrados = !cobFiltro ? cobItems
              : cobFiltro.tipo==="banda" ? cobItems.filter(c=>c.prioridade?.banda===cobFiltro.valor)
              : cobFiltro.tipo==="ajuizamento" ? cobItems.filter(c=>c.prioridade?.jaRenegociado||c.prioridade?.jaTeveAcordoAssistido)
              : cobFiltro.tipo==="novoAtraso1" ? cobItems.filter(isNovoAtraso1)
              : cobItems;
            const toggleFiltro = f => setCobFiltro(cur=>(cur&&cur.tipo===f.tipo&&cur.valor===f.valor)?null:f);
            const filtroAtivo = k => !!cobFiltro && cobFiltro.tipo===k.filtro?.tipo && cobFiltro.valor===k.filtro?.valor;
            const filtroLabel = !cobFiltro ? "" : cobFiltro.tipo==="banda" ? cobFiltro.valor : cobFiltro.tipo==="novoAtraso1" ? "Novos em Atraso na 1ª Parcela" : "Elegíveis para Ajuizamento";
            const SORT_DEFAULT_DIR = {cliente:"asc",prioridade:"desc",atraso:"desc",valor:"desc"};
            const SORT_LABEL = {cliente:"Cliente",prioridade:"Prioridade",atraso:"Atraso Máx",valor:"Valor"};
            const toggleSort = campo => setCobSort(cur=>!cur||cur.campo!==campo?{campo,dir:SORT_DEFAULT_DIR[campo]}:{campo,dir:cur.dir==="asc"?"desc":"asc"});
            const sortIcon = campo => cobSort?.campo!==campo ? null : (cobSort.dir==="asc"?"▲":"▼");
            const cobItemsOrdenados = !cobSort ? cobItemsFiltrados : [...cobItemsFiltrados].sort((a,b)=>{
              const dir = cobSort.dir==="asc"?1:-1;
              if(cobSort.campo==="cliente") return dir*nomeCliente(a).localeCompare(nomeCliente(b),"pt-BR");
              if(cobSort.campo==="prioridade") return dir*((a.prioridade?.score||0)-(b.prioridade?.score||0));
              if(cobSort.campo==="atraso") return dir*((a.maxAtraso||0)-(b.maxAtraso||0));
              if(cobSort.campo==="valor") return dir*((a.vAtraso||0)-(b.vAtraso||0));
              return 0;
            });
            return(
            <div className="flex flex-col gap-5" style={{animation:"fadeUp 400ms cubic-bezier(0.16,1,0.3,1) both"}}>
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-end",gap:16,flexWrap:"wrap"}}>
                <div>
                  <div style={{fontSize:mob?18:22,fontWeight:800,color:TEXT,letterSpacing:"-0.3px"}}>Cobrança</div>
                  <div style={{fontSize:11,color:MUTED,marginTop:4}}>{cobItems.length} cliente{cobItems.length!==1?"s":""} com parcelas em atraso · {parcelasAtrasadas.length} parcela{parcelasAtrasadas.length!==1?"s":""} no total</div>
                </div>
              </div>

              {/* KPIs de Prioridade de Cobrança — Fase 1, calculado 100% no navegador */}
              <div style={{display:"grid",gridTemplateColumns:mob?"repeat(2,1fr)":"repeat(5,1fr)",gap:14}}>
                {[
                  {label:"🆕 Novos em Atraso na 1ª Parcela",value:cobItems.filter(isNovoAtraso1).length,color:RED,filtro:{tipo:"novoAtraso1"}},
                  {label:"🔥 Crítica",value:cobKpis.critica,color:RED,filtro:{tipo:"banda",valor:"Crítica"}},
                  {label:"⚠ Forte",value:cobKpis.forte,color:ORG,filtro:{tipo:"banda",valor:"Forte"}},
                  {label:"🟡 Normal",value:cobKpis.normal,color:YEL,filtro:{tipo:"banda",valor:"Normal"}},
                  {label:"⚖ Elegíveis p/ ajuizamento",value:cobKpis.elegivelAjuizamento,color:PUR,filtro:{tipo:"ajuizamento"}},
                ].map(k=>(
                  <KpiCard key={k.label} label={k.label} value={k.value} color={k.color}
                    active={filtroAtivo(k)} onClick={()=>toggleFiltro(k.filtro)}
                    sub={filtroAtivo(k)?"clique p/ limpar filtro":"clique p/ filtrar"}/>
                ))}
              </div>
              <div style={{display:"grid",gridTemplateColumns:mob?"repeat(2,1fr)":"repeat(3,1fr)",gap:14}}>
                {[
                  {label:"📅 Promessas hoje",value:cobKpis.promessasHoje,color:BLU},
                  {label:"❌ Promessas quebradas",value:cobKpis.promessasQuebradas,color:RED},
                  {label:"💰 Valor total em risco",value:fmtR(cobKpis.valorRisco),color:ORG},
                ].map(k=>(<KpiCard key={k.label} label={k.label} value={k.value} color={k.color}/>))}
              </div>

            <div style={{background:CARD,borderRadius:16,border:`1px solid ${BD}`,overflow:"hidden",boxShadow:SHD}}>
              <div style={{padding:mob?12:16,borderBottom:`1px solid ${BD}`,background:RED+"05",display:"flex",alignItems:"center",justifyContent:"space-between",gap:10,flexWrap:"wrap"}}>
                <div style={{display:"flex",alignItems:"center",gap:8}}>
                  <h3 style={{margin:0,fontSize:15,fontWeight:700,color:RED}}>Fila de Cobrança{cobFiltro?` · ${filtroLabel}`:""}</h3>
                  {cobFiltro&&(
                    <button onClick={()=>setCobFiltro(null)} style={{display:"flex",alignItems:"center",gap:4,padding:"3px 10px",borderRadius:9999,border:`1px solid ${BD}`,background:CARD,color:MUTED,fontSize:11,fontWeight:600,cursor:"pointer"}}>
                      <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                      Limpar filtro
                    </button>
                  )}
                </div>
                {!mob&&<span style={{fontSize:12,color:MUTED,display:"flex",alignItems:"center",gap:5}}><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>{cobSort?`Ordenado por ${SORT_LABEL[cobSort.campo]} (${cobSort.dir==="asc"?"crescente":"decrescente"})`:"Ordenado por Prioridade de Cobrança"} · clique em um cliente para registrar pagamento</span>}
                {mob&&<Badge c={RED}>{cobItemsOrdenados.length}</Badge>}
              </div>
              {mob
                ? <div style={{display:"flex",flexDirection:"column"}}>
                    {cobItemsOrdenados.map((c,i)=>(
                      <div key={c.ID_CLIENTE} onClick={()=>setCobModal(c)}
                        style={{padding:"14px 16px",borderBottom:`1px solid ${BD}`,cursor:"pointer",display:"flex",justifyContent:"space-between",alignItems:"center",gap:12,background:i%2===1?CARD2:"transparent"}}>
                        <div style={{flex:1,minWidth:0}}>
                          <div style={{fontWeight:700,fontSize:14,display:"flex",alignItems:"center",gap:6,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{nomeCliente(c)}{scoreBadge(c)}</div>
                          <div style={{fontSize:11,color:MUTED,marginTop:3,display:"flex",gap:8,alignItems:"center",flexWrap:"wrap"}}>
                            {isNovoAtraso1(c)&&<Badge c={RED}>🆕 1ª parcela</Badge>}
                            {isNovoAtraso1(c)&&<button onClick={e=>{e.stopPropagation();abrirWhatsAppNovoAtraso1(c.TELEFONE,nomeCliente(c),c.maxAtraso);}} style={{display:"flex",alignItems:"center",gap:4,padding:"3px 8px",borderRadius:9999,border:"none",background:"#25D366",color:"#fff",fontSize:11,fontWeight:700,cursor:"pointer"}}>WhatsApp</button>}
                            {prioridadeBadge(c.prioridade)}
                            <Badge c={c.maxAtraso>60?RED:c.maxAtraso>30?ORG:YEL}>{c.maxAtraso}d</Badge>
                            <span>{c.qtdContratos} contrato{c.qtdContratos>1?"s":""}</span>
                          </div>
                          {c.prioridade?.acao&&<div style={{fontSize:11,color:MUTED,marginTop:4,fontStyle:"italic"}}>→ {c.prioridade.acao}</div>}
                        </div>
                        <div style={{textAlign:"right",flexShrink:0}}>
                          <div style={{fontSize:15,fontWeight:800,color:RED}}>{fmtR(c.vAtraso)}</div>
                          <div style={{fontSize:11,color:GRN,fontWeight:700,marginTop:3,display:"flex",alignItems:"center",gap:3}}>Cobrar {IcoArr}</div>
                        </div>
                      </div>
                    ))}
                  </div>
                : <div style={{overflowX:"auto"}}>
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead onClick={()=>toggleSort("cliente")} style={{cursor:"pointer",userSelect:"none"}}>Cliente {sortIcon("cliente")}</TableHead>
                          <TableHead onClick={()=>toggleSort("prioridade")} style={{cursor:"pointer",userSelect:"none"}}>Prioridade {sortIcon("prioridade")}</TableHead>
                          <TableHead>Nível</TableHead>
                          <TableHead onClick={()=>toggleSort("atraso")} style={{cursor:"pointer",userSelect:"none"}}>Atraso Máx {sortIcon("atraso")}</TableHead>
                          <TableHead onClick={()=>toggleSort("valor")} style={{cursor:"pointer",userSelect:"none"}}>Valor {sortIcon("valor")}</TableHead>
                          <TableHead>Próxima Ação</TableHead>
                          <TableHead className="text-right">Ação</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {cobItemsOrdenados.map(c=>(
                          <TableRow key={c.ID_CLIENTE} onClick={()=>setCobModal(c)} style={{cursor:"pointer"}}>
                            <TableCell className="whitespace-normal">
                              <div style={{fontWeight:700,display:"flex",alignItems:"center",gap:8,flexWrap:"wrap"}}>
                                {nomeCliente(c)}{scoreBadge(c)}
                                {isNovoAtraso1(c)&&<Badge c={RED}>🆕 1ª parcela</Badge>}
                                {isNovoAtraso1(c)&&<button onClick={e=>{e.stopPropagation();abrirWhatsAppNovoAtraso1(c.TELEFONE,nomeCliente(c),c.maxAtraso);}} style={{display:"flex",alignItems:"center",gap:4,padding:"3px 8px",borderRadius:9999,border:"none",background:"#25D366",color:"#fff",fontSize:11,fontWeight:700,cursor:"pointer"}}>WhatsApp</button>}
                              </div>
                            </TableCell>
                            <TableCell>{prioridadeBadge(c.prioridade)}</TableCell>
                            <TableCell style={{fontSize:12,color:MUTED,fontWeight:600}}>{c.prioridade?.nivelLabel||"—"}</TableCell>
                            <TableCell><Badge c={c.maxAtraso>60?RED:c.maxAtraso>30?ORG:YEL}>{c.maxAtraso} dias</Badge></TableCell>
                            <TableCell style={{fontWeight:700,color:RED}}>{fmtR(c.vAtraso)}</TableCell>
                            <TableCell className="whitespace-normal" style={{fontSize:12,color:MUTED,maxWidth:200}}>{c.prioridade?.acao||"—"}</TableCell>
                            <TableCell className="text-right">
                              <button onClick={e=>{e.stopPropagation();setCobModal(c);}} style={{...BTN7(GRN),padding:"5px 12px",fontSize:11,display:"flex",alignItems:"center",gap:4}}>
                                {IcoPag} Registrar
                              </button>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
              }
            </div>
            </div>
            );
          })()}

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
                  <div style={{fontSize:11,color:MUTED,marginTop:2}}>{finDe?"Pagamentos filtrados por período":"Todos os pagamentos registrados"}</div>
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

              <div className="fin-lucro" style={{background:CARD,borderRadius:16,padding:"22px 28px",display:"flex",alignItems:"center",justifyContent:"space-between",gap:16,border:`1px solid ${GRN}30`,boxShadow:SHD,position:"relative",overflow:"hidden"}}>
                <div>
                  <p style={{color:MUTED,fontSize:10,fontWeight:700,textTransform:"uppercase",letterSpacing:"0.7px",margin:"0 0 6px"}}>Lucro do Período</p>
                  <p style={{color:GRN,fontSize:32,fontWeight:800,margin:"0 0 4px",letterSpacing:"-0.5px"}}>{priv(fmtR(finKpis.lucro))}</p>
                  <p style={{color:MUTED,fontSize:11,margin:0}}>Juros recebidos + receita extra por atraso</p>
                </div>
              </div>

              <div className="fin-kpi-row" style={{display:"flex",flexDirection:"column",gap:10}}>
                <div style={{fontSize:10,color:MUTED,fontWeight:700,textTransform:"uppercase",letterSpacing:"0.8px",paddingLeft:2}}>Valores do Período</div>
                <div style={{display:"grid",gridTemplateColumns:mob?"repeat(2,1fr)":"repeat(3,1fr)",gap:14}}>
                {[
                  {icon:<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>,label:"Receita Total",      val:fmtR(finKpis.receitaTotal),  c:GRN},
                  {icon:<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><polyline points="12,6 12,12 16,14"/></svg>,label:"Receita Extra Atraso",val:fmtR(finKpis.receitaExtra), c:ORG},
                  ...(finKpis.capitalRecuperadoAssistido>0?[{icon:<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M20.42 4.58a5.4 5.4 0 0 0-7.65 0l-.77.78-.77-.78a5.4 5.4 0 0 0-7.65 0C1.46 6.7 1.33 10.28 4 13l8 8 8-8c2.67-2.72 2.54-6.3.42-8.42z"/></svg>,label:"Capital Recuperado (Acordo Assistido)",val:fmtR(finKpis.capitalRecuperadoAssistido),c:BLU}]:[]),
                  {icon:<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="17,1 21,5 17,9"/><path d="M3 11V9a4 4 0 0 1 4-4h14"/><polyline points="7,23 3,19 7,15"/><path d="M21 13v2a4 4 0 0 1-4 4H3"/></svg>,label:"Parcelas Prorrogadas",val:finKpis.qtyProrrogadas,     c:PUR},
                ].map(k=>(
                  <div key={k.label} className="kpi-card-item" style={{background:CARD,borderRadius:16,padding:18,border:`1px solid ${BD}`,boxShadow:SHD,position:"relative",overflow:"hidden"}}>
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
                  <div key={k.label} className="kpi-card-item" style={{background:CARD,borderRadius:16,padding:18,border:`1px solid ${BD}`,boxShadow:SHD,position:"relative",overflow:"hidden"}}>
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
                    {[{l:"Receita",v:fmtR(totaisFin.receita),c:GRN},{l:"Receita Extra Atraso",v:fmtR(totaisFin.extra),c:ORG},{l:"Nº Pagamentos",v:totaisFin.count,c:GRN},...(totaisFin.abatimentos>0?[{l:"Capital Recuperado",v:fmtR(totaisFin.abatimentos),c:BLU}]:[])].map((k,i)=>(
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
                        const tCor={pagamento_normal:GRN,normal:GRN,pagamento_com_atraso:YEL,com_atraso:YEL,somente_juros:RED,recuperacao_apos_baixa:PUR,abatimento_acordo_assistido:BLU}[p.TIPO_PAGAMENTO]||MUTED;
                        const tLabel={pagamento_normal:"Normal",normal:"Normal",pagamento_com_atraso:"Com Atraso",com_atraso:"Com Atraso",somente_juros:"Somente Juros",recuperacao_apos_baixa:"Recuperação",pagamento_antecipado:"Antecipado",antecipado:"Antecipado",abatimento_acordo_assistido:"Recup. Capital"}[p.TIPO_PAGAMENTO]||p.TIPO_PAGAMENTO||"—";
                        const extra=parseFloat(p.RECEITA_EXTRA_ATRASO||0)+parseFloat(p.FEE_PRORROGACAO||0);
                        return(
                          <tr key={i} onClick={()=>setSelPagDetalhe(p)} style={{borderBottom:`1px solid ${BD}`,fontSize:13,background:"transparent",cursor:"pointer"}}>
                            <td style={{padding:"11px 18px",color:MUTED,whiteSpace:"nowrap"}}>{fmtDt(parseDate(p.DATA_PAGAMENTO))}</td>
                            <td style={{fontWeight:600}}>{p.NOME_CLIENTE}</td>
                            <td><Badge c={tCor}>{tLabel}</Badge></td>
                            <td style={{color:MUTED}}>{fmtR(p.VALOR_ORIGINAL_PARCELA||p.VALOR_PARCELA)}</td>
                            <td style={{fontWeight:700,color:GRN}}>{fmtR(p.VALOR_PAGO)}</td>
                            <td style={{color:extra>=0.01?ORG:MUTED,fontWeight:extra>=0.01?700:400}}>{extra>=0.01?`+${fmtR(extra)}`:"—"}</td>
                          </tr>
                        );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
            </div>
          )}

          {/* CARTEIRA */}
          {tab==="carteira"&&(
            <div className="flex flex-col gap-5" style={{animation:"fadeUp 400ms cubic-bezier(0.16,1,0.3,1) both"}}>
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-end",gap:16,flexWrap:"wrap"}}>
                <div>
                  <div style={{fontSize:mob?18:22,fontWeight:800,color:TEXT,letterSpacing:"-0.3px"}}>Carteira de Crédito</div>
                  <div style={{fontSize:11,color:MUTED,marginTop:4}}>{carteira.totalAbertos} contrato{carteira.totalAbertos!==1?"s":""} em aberto · {fmtR(carteira.capitalTotal)} em circulação</div>
                </div>
              </div>
              <div style={{display:"flex",flexDirection:"column",gap:24}}>

                {/* 4 KPI CARDS — clicáveis */}
                {(()=>{
                  const abrirDetalhe=(label,cor,filtroStatus,getValor)=>{
                    const items=(contratos||[])
                      .filter(c=>filtroStatus.includes(String(c.STATUS_CONTRATO||"")))
                      .map(c=>({contrato:c,valor:getValor(c)}))
                      .filter(i=>i.valor>0.005)
                      .sort((a,b)=>b.valor-a.valor);
                    setCarteiraDetalheModal({label,cor,items});
                  };
                  const getPrinc=c=>perdaInfoMap[String(c.ID_CONTRATO||"")]?.principalAberto||0;
                  const getPrejCap=c=>parseFloat(c.PREJUIZO_CAPITAL||c.VALOR_EXECUTADO||0);
                  const cards=[
                    {l:"Capital em Circulação",v:fmtR(carteira.capitalCirculacao),c:GRN,sub:`${carteira.qtdCirc} contrato${carteira.qtdCirc!==1?"s":""} ativos`,onClick:()=>abrirDetalhe("Capital em Circulação",GRN,["ativo_em_dia","ativo_em_atraso","renegociado"],getPrinc)},
                    {l:"Capital em Risco",v:fmtR(carteira.capitalEmRisco),c:ORG,sub:`${carteira.qtdRisco} contrato${carteira.qtdRisco!==1?"s":""} (cobrança + pré-prejuízo)`,onClick:()=>abrirDetalhe("Capital em Risco",ORG,["em_cobranca","pre_prejuizo"],getPrinc)},
                    {l:"Capital Assistido",v:fmtR(carteira.capitalAssistido),c:BLU,sub:`${carteira.qtdAssist} contrato${carteira.qtdAssist!==1?"s":""} em acordo assistido`,onClick:()=>abrirDetalhe("Capital Assistido",BLU,["acordo_assistido"],getPrinc)},
                    {l:"Capital em Judicial",v:fmtR(carteira.capitalJudicial),c:RED,sub:`${carteira.qtdJudicial} contrato${carteira.qtdJudicial!==1?"s":""} em processo judicial`,onClick:()=>abrirDetalhe("Capital em Judicial",RED,["em_processo_judicial"],getPrejCap)},
                    {l:"Perdido Líquido",v:fmtR(carteira.capitalPerdidoLiquido),c:carteira.capitalPerdidoLiquido>0?RED:MUTED,sub:"capital baixado sem recuperação",onClick:()=>abrirDetalhe("Perdido Líquido",RED,["baixado_como_prejuizo"],c=>Math.max(0,parseFloat(c.PREJUIZO_CAPITAL||0)-parseFloat(c.VALOR_RECUPERADO_APOS_BAIXA||0)))},
                  ];
                  return(
                    <div style={{display:"grid",gridTemplateColumns:mob?"repeat(2,1fr)":"repeat(5,1fr)",gap:14}}>
                      {cards.map(k=>(
                        <div key={k.l} onClick={k.onClick} style={{background:CARD,padding:16,borderRadius:16,border:`1px solid ${BD}`,boxShadow:SHD,position:"relative",overflow:"hidden",cursor:"pointer",transition:"transform 180ms cubic-bezier(0.34,1.56,0.64,1),box-shadow 180ms ease"}} onMouseEnter={e=>{e.currentTarget.style.transform="translateY(-2px)";e.currentTarget.style.boxShadow="0 8px 24px rgba(0,0,0,0.13)";}} onMouseLeave={e=>{e.currentTarget.style.transform="";e.currentTarget.style.boxShadow=SHD;}}>
                          <div style={{fontSize:10,color:MUTED,fontWeight:600,textTransform:"uppercase",marginBottom:4}}>{k.l}</div>
                          <div style={{fontSize:mob?17:20,fontWeight:800,color:k.c}}>{k.v}</div>
                          {k.sub&&<div style={{fontSize:10,color:MUTED,marginTop:3}}>{k.sub}</div>}
                          <div style={{fontSize:9,color:k.c,marginTop:5,fontWeight:600,opacity:0.7}}>ver contratos →</div>
                          <div style={{position:"absolute",bottom:0,left:0,right:0,height:3,background:k.c,borderRadius:"0 0 14px 14px",opacity:0.6}}/>
                        </div>
                      ))}
                    </div>
                  );
                })()}

                {/* DISTRIBUIÇÃO POR FAIXA DE ATRASO */}
                <div style={{background:CARD,borderRadius:16,border:`1px solid ${BD}`,overflow:"hidden",boxShadow:SHD}}>
                  <div style={{padding:"14px 18px",borderBottom:`1px solid ${BD}`,background:BG+"50"}}>
                    <h3 style={{margin:0,fontSize:15,fontWeight:700}}>Distribuição por Faixa de Atraso</h3>
                    <div style={{fontSize:11,color:MUTED,marginTop:3}}>{carteira.totalAbertos} contratos em aberto</div>
                  </div>
                  <div style={{padding:"16px 20px",display:"flex",flexDirection:"column",gap:14}}>
                    {[
                      {label:"Em dia",qtd:carteira.dist[0],cor:GRN},
                      {label:"1–30 dias",qtd:carteira.dist[1],cor:YEL},
                      {label:"31–60 dias",qtd:carteira.dist[2],cor:ORG},
                      {label:"61–120 dias",qtd:carteira.dist[3],cor:RED},
                      {label:">120 dias",qtd:carteira.dist[4],cor:"#A60000"},
                    ].map(f=>{
                      const pct=carteira.totalAbertos>0?(f.qtd/carteira.totalAbertos*100):0;
                      return(
                        <div key={f.label} style={{display:"grid",gridTemplateColumns:"110px 1fr 80px",alignItems:"center",gap:12}}>
                          <div style={{fontSize:12,fontWeight:600,color:f.cor}}>{f.label}</div>
                          <div style={{height:10,background:BD,borderRadius:10,overflow:"hidden"}}>
                            <div style={{height:"100%",width:`${pct}%`,background:f.cor,borderRadius:10,transition:"width 0.5s ease"}}/>
                          </div>
                          <div style={{fontSize:12,fontWeight:700,color:TEXT,textAlign:"right"}}>
                            {f.qtd} <span style={{fontWeight:400,color:MUTED,fontSize:11}}>({pct.toFixed(0)}%)</span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* PDD GERENCIAL V1.0 */}
                <div style={{background:CARD,borderRadius:16,border:`1px solid ${BD}`,overflow:"hidden",boxShadow:SHD}}>
                  <div style={{padding:"14px 18px",borderBottom:`1px solid ${BD}`,background:BG+"50",display:"flex",justifyContent:"space-between",alignItems:"center",flexWrap:"wrap",gap:8}}>
                    <div>
                      <h3 style={{margin:0,fontSize:15,fontWeight:700}}>PDD Gerencial</h3>
                      <div style={{fontSize:11,color:MUTED,marginTop:3}}>Provisão para Devedores Duvidosos · v1.0 · Jun/2026</div>
                    </div>
                    <div style={{fontSize:11,color:MUTED,textAlign:"right"}}>Base: 216 contratos · 7 perdas · 1,42% perda histórica</div>
                  </div>
                  <div style={{padding:"16px 20px",display:"flex",flexDirection:"column",gap:16}}>
                    <div style={{display:"grid",gridTemplateColumns:mob?"repeat(2,1fr)":"repeat(4,1fr)",gap:12}}>
                      {[
                        {l:"Saldo Devedor",v:fmtR(carteira.saldoDevedor),c:TEXT,sub:"parcelas em aberto"},
                        {l:"PDD",v:fmtR(carteira.totalPDD),c:ORG,sub:`${carteira.saldoDevedor>0?(carteira.totalPDD/carteira.saldoDevedor*100).toFixed(1):0}% do saldo`},
                        {l:"Carteira Ajustada",v:fmtR(carteira.carteiraAjustada),c:GRN,sub:"saldo devedor − PDD"},
                        {l:"Cobertura PDD",v:`${carteira.coberturaPDD.toFixed(1)}×`,c:carteira.coberturaPDD>=2?GRN:carteira.coberturaPDD>=1?YEL:RED,sub:"vs perda histórica líquida (R$ 7.275)"},
                      ].map(k=>(
                        <div key={k.l} style={{background:BG,padding:14,borderRadius:12,border:`1px solid ${BD}`}}>
                          <div style={{fontSize:10,color:MUTED,fontWeight:600,textTransform:"uppercase",marginBottom:4}}>{k.l}</div>
                          <div style={{fontSize:mob?15:18,fontWeight:800,color:k.c}}>{k.v}</div>
                          {k.sub&&<div style={{fontSize:10,color:MUTED,marginTop:3}}>{k.sub}</div>}
                        </div>
                      ))}
                    </div>
                    <table style={{width:"100%",borderCollapse:"collapse",fontSize:12}}>
                      <thead>
                        <tr style={{background:ORG+"15"}}>
                          {["Faixa","Contratos","Principal","% PDD","Provisão"].map(h=>(
                            <th key={h} style={{padding:"8px 12px",textAlign:h==="Faixa"?"left":"right",color:ORG,fontWeight:700,fontSize:11,textTransform:"uppercase"}}>{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {carteira.pddFaixas.map((f,i)=>(
                          <tr key={f.label} style={{borderBottom:`1px solid ${BD}`,background:i%2===0?"transparent":BG+"40"}}>
                            <td style={{padding:"8px 12px",fontWeight:600,color:f.pct===0?MUTED:f.pct<=0.35?YEL:f.pct<1?ORG:RED}}>{f.label}</td>
                            <td style={{padding:"8px 12px",textAlign:"right",color:MUTED}}>{f.qtd}</td>
                            <td style={{padding:"8px 12px",textAlign:"right"}}>{fmtR(f.saldo)}</td>
                            <td style={{padding:"8px 12px",textAlign:"right",fontWeight:700,color:f.pct===0?MUTED:f.pct<=0.35?YEL:f.pct<1?ORG:RED}}>{(f.pct*100).toFixed(0)}%</td>
                            <td style={{padding:"8px 12px",textAlign:"right",fontWeight:700,color:f.pdd>0?RED:MUTED}}>{fmtR(f.pdd)}</td>
                          </tr>
                        ))}
                        <tr style={{background:ORG+"20",fontWeight:800}}>
                          <td style={{padding:"8px 12px",color:ORG}}>Total</td>
                          <td style={{padding:"8px 12px",textAlign:"right",color:ORG}}>{carteira.totalAbertos}</td>
                          <td style={{padding:"8px 12px",textAlign:"right",color:ORG}}>{fmtR(carteira.principalTotal)}</td>
                          <td style={{padding:"8px 12px",textAlign:"right",color:ORG}}>{carteira.principalTotal>0?(carteira.totalPDD/carteira.principalTotal*100).toFixed(1)+"%":"–"}</td>
                          <td style={{padding:"8px 12px",textAlign:"right",color:ORG}}>{fmtR(carteira.totalPDD)}</td>
                        </tr>
                      </tbody>
                    </table>
                    <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"10px 14px",background:BG,borderRadius:10,border:`1px solid ${BD}`,flexWrap:"wrap",gap:8}}>
                      <div style={{fontSize:11,color:MUTED}}><span style={{fontWeight:700,color:TEXT}}>PDD Gerencial v1.0</span> · Base: Jun/2026 · 216 contratos analisados · 1,42% perda histórica líquida</div>
                      <div style={{fontSize:11,color:YEL,fontWeight:600}}>Próxima revisão: 50 contratos encerrados ou Dez/2026</div>
                    </div>
                  </div>
                </div>

                {/* RESULTADO AJUSTADO AO RISCO */}
                {(()=>{
                  const recTotal=resultado12m.receitaContratual+resultado12m.receitaAtraso;
                  const pdd=carteira.totalPDD;
                  const resultAjust=recTotal-pdd;
                  const cap=carteira.capitalTotal||1;
                  const roiBruto=recTotal/cap*100;
                  const roiAjust=resultAjust/cap*100;
                  const margemAjust=recTotal>0?resultAjust/recTotal*100:0;
                  const dre=[
                    {l:"Receita Contratual (juros)",  v:resultado12m.receitaContratual, sinal:"+", c:GRN},
                    {l:"Receita de Atraso (multas)",  v:resultado12m.receitaAtraso,     sinal:"+", c:YEL},
                    {l:"PDD — Provisão Atual",        v:-pdd,                            sinal:"−", c:RED},
                  ];
                  return(
                    <div style={{background:CARD,borderRadius:16,border:`1px solid ${BD}`,overflow:"hidden",boxShadow:SHD}}>
                      <div style={{padding:"14px 18px",borderBottom:`1px solid ${BD}`,background:BG+"50",display:"flex",justifyContent:"space-between",alignItems:"center",flexWrap:"wrap",gap:8}}>
                        <div>
                          <h3 style={{margin:0,fontSize:15,fontWeight:700}}>Resultado Ajustado ao Risco</h3>
                          <div style={{fontSize:11,color:MUTED,marginTop:3}}>Receita dos últimos 12 meses · PDD deduzida como custo</div>
                        </div>
                        <div style={{display:"flex",gap:16}}>
                          {[
                            {l:"ROI Bruto",   v:roiBruto.toFixed(1)+"%",  c:roiBruto>=15?GRN:roiBruto>=5?YEL:RED},
                            {l:"ROI Ajustado",v:roiAjust.toFixed(1)+"%",  c:roiAjust>=12?GRN:roiAjust>=0?YEL:RED},
                            {l:"Margem",      v:margemAjust.toFixed(1)+"%",c:margemAjust>=80?GRN:margemAjust>=50?YEL:RED},
                          ].map(k=>(
                            <div key={k.l} style={{textAlign:"center"}}>
                              <div style={{fontSize:10,color:MUTED,fontWeight:600,textTransform:"uppercase"}}>{k.l}</div>
                              <div style={{fontSize:17,fontWeight:800,color:k.c}}>{k.v}</div>
                            </div>
                          ))}
                        </div>
                      </div>
                      <div style={{padding:"16px 20px"}}>
                        <table style={{width:"100%",borderCollapse:"collapse",fontSize:13}}>
                          <tbody>
                            {dre.map((row,i)=>(
                              <tr key={row.l} style={{borderBottom:`1px solid ${BD}`}}>
                                <td style={{padding:"10px 12px",color:MUTED,fontWeight:500}}>{row.sinal}</td>
                                <td style={{padding:"10px 4px",fontWeight:600}}>{row.l}</td>
                                <td style={{padding:"10px 12px",textAlign:"right",fontWeight:700,color:row.c}}>{fmtR(Math.abs(row.v))}</td>
                              </tr>
                            ))}
                            <tr style={{background:resultAjust>=0?GRN+"15":RED+"15"}}>
                              <td style={{padding:"12px 12px",fontWeight:800,color:resultAjust>=0?GRN:RED}}>=</td>
                              <td style={{padding:"12px 4px",fontWeight:800,color:resultAjust>=0?GRN:RED}}>Resultado Operacional Ajustado</td>
                              <td style={{padding:"12px 12px",textAlign:"right",fontSize:16,fontWeight:800,color:resultAjust>=0?GRN:RED}}>{fmtR(resultAjust)}</td>
                            </tr>
                          </tbody>
                        </table>
                        <div style={{marginTop:12,padding:"10px 14px",background:BG,borderRadius:10,border:`1px solid ${BD}`,fontSize:11,color:MUTED}}>
                          Capital em circulação: <strong style={{color:TEXT}}>{fmtR(cap)}</strong> · ROI = Resultado Ajustado ÷ Capital × 100 · PDD deduzida integralmente no período como custo de risco
                        </div>
                      </div>
                    </div>
                  );
                })()}

                {/* PAINEL DE INADIMPLÊNCIA */}
                {(()=>{
                  const qtdAtrasoTotal=carteira.dist[1]+carteira.dist[2]+carteira.dist[3]+carteira.dist[4];
                  const tot=carteira.totalAbertos||1;
                  const txBruta=qtdAtrasoTotal/tot*100;
                  // Inadimplência real (padrão Basileia/BCB — NPL): contratos com 90+ dias de atraso.
                  // Cutoff alinhado ao mesmo corte usado na Taxa de Adimplência do Dashboard e na
                  // faixa da PDD onde o percentual salta de 35%→60% (docs/ai-memory/03-AI-FINANCIAL-CALCULATIONS.md)
                  const contratosNPL90=(carteira.abertos||[]).filter(c=>(perdaInfoMap[String(c.ID_CONTRATO||"")]?.diasAtraso||0)>=91);
                  const principalInadNPL=contratosNPL90.reduce((s,c)=>s+(perdaInfoMap[String(c.ID_CONTRATO||"")]?.principalAberto||0),0);
                  const qtdInadReal=contratosNPL90.length;
                  const txRealQtd=qtdInadReal/tot*100;
                  const txRealValor=carteira.principalTotal>0?principalInadNPL/carteira.principalTotal*100:0;
                  const txCapital=carteira.capitalTotal>0?carteira.capitalEmRisco/carteira.capitalTotal*100:0;
                  const principalOriginado=(contratos||[]).reduce((s,c)=>s+parseFloat(c.VALOR_PRINCIPAL||0),0);
                  const txPerdaHist=principalOriginado>0?perdas.prejuizoReal/principalOriginado*100:0;
                  const statusLabel=(v,bom,warn)=>v<bom?"Bom":v<warn?"Atenção":"Crítico";
                  const corValor=txRealValor<15?GRN:txRealValor<20?YEL:RED;
                  const corCap=txCapital<15?GRN:txCapital<25?YEL:RED;
                  const corPerda=txPerdaHist<2?GRN:txPerdaHist<5?YEL:RED;
                  const indicadores=[
                    {
                      l:"Inadimplência Real (por valor)",
                      desc:"Padrão Basileia/BCB (NPL) · principal remanescente com 90+ dias de atraso / principal total ativo",
                      v:txRealValor.toFixed(1)+"%",
                      detalhe:`${fmtR(principalInadNPL)} de ${fmtR(carteira.principalTotal)}`,
                      ref:"< 20%",
                      status:statusLabel(txRealValor,15,20),
                      c:corValor,
                      freq:"Mensal",
                      destaque:true,
                    },
                    {
                      l:"Inadimplência por Contratos",
                      desc:"Qtd. de contratos com 90+ dias de atraso / total de contratos ativos",
                      v:txRealQtd.toFixed(1)+"%",
                      detalhe:`${qtdInadReal} de ${carteira.totalAbertos} contratos`,
                      ref:"< 20%",
                      status:statusLabel(txRealQtd,15,20),
                      c:txRealQtd<15?GRN:txRealQtd<20?YEL:RED,
                      freq:"Mensal",
                    },
                    {
                      l:"Taxa de Atraso Bruta",
                      desc:"Qualquer contrato com ao menos uma parcela vencida",
                      v:txBruta.toFixed(1)+"%",
                      detalhe:`${qtdAtrasoTotal} de ${carteira.totalAbertos} contratos`,
                      ref:"—",
                      status:"Monitor",
                      c:MUTED,
                      freq:"Semanal",
                    },
                    {
                      l:"Capital em Risco Formal",
                      desc:"Principal de contratos em cobrança ativa + pré-prejuízo / capital total",
                      v:txCapital.toFixed(1)+"%",
                      detalhe:`${fmtR(carteira.capitalEmRisco)} de ${fmtR(carteira.capitalTotal)}`,
                      ref:"< 25%",
                      status:statusLabel(txCapital,15,25),
                      c:corCap,
                      freq:"Mensal",
                    },
                    {
                      l:"Perda Histórica",
                      desc:"Capital efetivamente perdido (baixado - recuperado) / total originado desde o início",
                      v:txPerdaHist.toFixed(2)+"%",
                      detalhe:`${fmtR(perdas.prejuizoReal)} de ${fmtR(principalOriginado)} originados`,
                      ref:"< 5%",
                      status:statusLabel(txPerdaHist,2,5),
                      c:corPerda,
                      freq:"Trimestral",
                    },
                  ];
                  return(
                    <div style={{background:CARD,borderRadius:16,border:`1px solid ${BD}`,overflow:"hidden",boxShadow:SHD}}>
                      <div style={{padding:"14px 18px",borderBottom:`1px solid ${BD}`,background:BG+"50",display:"flex",justifyContent:"space-between",alignItems:"center",flexWrap:"wrap",gap:8}}>
                        <div>
                          <h3 style={{margin:0,fontSize:15,fontWeight:700}}>Painel de Inadimplência</h3>
                          <div style={{fontSize:11,color:MUTED,marginTop:3}}>Indicadores calculados ao vivo · use para conferência mensal</div>
                        </div>
                        <div style={{fontSize:11,color:corValor,fontWeight:700,background:corValor+"15",padding:"4px 10px",borderRadius:20}}>
                          KPI principal: {txRealValor.toFixed(1)}% inadimplência por valor
                        </div>
                      </div>
                      <div style={{overflowX:"auto"}}>
                        <table style={{width:"100%",borderCollapse:"collapse",fontSize:13}}>
                          <thead>
                            <tr style={{background:BG+"80"}}>
                              {["Indicador","Seu valor","Detalhamento","Referência","Status","Frequência"].map(h=>(
                                <th key={h} style={{padding:"9px 14px",textAlign:h==="Seu valor"||h==="Referência"?"center":"left",fontSize:10,fontWeight:700,color:MUTED,textTransform:"uppercase",letterSpacing:"0.4px",whiteSpace:"nowrap"}}>{h}</th>
                              ))}
                            </tr>
                          </thead>
                          <tbody>
                            {indicadores.map((ind,i)=>(
                              <tr key={ind.l} style={{borderBottom:`1px solid ${BD}`,background:ind.destaque?ind.c+"08":"transparent"}}>
                                <td style={{padding:"12px 14px"}}>
                                  <div style={{fontWeight:ind.destaque?700:600,color:TEXT,fontSize:ind.destaque?14:13}}>{ind.l}{ind.destaque&&<span style={{marginLeft:6,fontSize:9,background:ind.c+"22",color:ind.c,padding:"1px 6px",borderRadius:10,fontWeight:700,verticalAlign:"middle"}}>PRINCIPAL</span>}</div>
                                  <div style={{fontSize:10,color:MUTED,marginTop:2}}>{ind.desc}</div>
                                </td>
                                <td style={{padding:"12px 14px",textAlign:"center"}}>
                                  <div style={{fontSize:ind.destaque?18:15,fontWeight:800,color:ind.c}}>{ind.v}</div>
                                </td>
                                <td style={{padding:"12px 14px",fontSize:11,color:MUTED}}>{ind.detalhe}</td>
                                <td style={{padding:"12px 14px",textAlign:"center",fontWeight:600,color:MUTED,fontSize:12}}>{ind.ref}</td>
                                <td style={{padding:"12px 14px",textAlign:"center"}}>
                                  <span style={{fontSize:11,fontWeight:700,color:ind.c,background:ind.c+"18",padding:"3px 10px",borderRadius:20}}>{ind.status}</span>
                                </td>
                                <td style={{padding:"12px 14px",fontSize:11,color:MUTED}}>{ind.freq}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                      <div style={{padding:"10px 14px",background:BG,borderTop:`1px solid ${BD}`,display:"flex",flexWrap:"wrap",gap:16,fontSize:11,color:MUTED}}>
                        <span><strong style={{color:YEL}}>Alerta</strong>: Inadimplência Real &gt; 20% ou Capital em Risco &gt; 25%</span>
                        <span><strong style={{color:RED}}>Crítico</strong>: Inadimplência Real &gt; 25% ou Perda Histórica &gt; 5% → revisar critérios de concessão</span>
                      </div>
                    </div>
                  );
                })()}

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
                  {l:"Prejuízo Real",v:fmtR(perdas.prejuizoReal),c:RED,sub:"capital perdido sem recuperação"},
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
              {perdas.qtdJudicial>0&&(
              <div style={{display:"grid",gridTemplateColumns:mob?"repeat(2,1fr)":"repeat(4,1fr)",gap:14}}>
                {[
                  {l:"Contratos em Judicial",v:String(perdas.qtdJudicial),c:RED,sub:"em processo ou encerrado judicialmente"},
                  {l:"Valor Executado",v:fmtR(perdas.valorExecutadoJudicial),c:RED,sub:"total pleiteado nas ações"},
                  {l:"Recuperado Judicial",v:fmtR(perdas.recuperadoJudicialTotal),c:GRN,sub:`principal ${fmtR(perdas.recuperadoJudicialPrincipal)} · lucro ${fmtR(perdas.recuperadoJudicialLucro)}`},
                  {l:"Índice de Recuperação",v:fmtP(perdas.indiceRecuperacaoJudicial),c:perdas.indiceRecuperacaoJudicial>0?GRN:MUTED,sub:"recuperado ÷ valor executado"},
                ].map(k=>(
                  <div key={k.l} style={{background:CARD,padding:16,borderRadius:16,border:`1px solid ${RED}30`,boxShadow:SHD,position:"relative",overflow:"hidden"}}>
                    <div style={{fontSize:10,color:MUTED,fontWeight:600,textTransform:"uppercase",marginBottom:4}}>{k.l}</div>
                    <div style={{fontSize:18,fontWeight:800,color:k.c}}>{k.v}</div>
                    {k.sub&&<div style={{fontSize:10,color:MUTED,marginTop:3}}>{k.sub}</div>}
                    <div style={{position:"absolute",bottom:0,left:0,right:0,height:3,background:k.c,borderRadius:"0 0 14px 14px",opacity:0.6}}/>
                  </div>
                ))}
              </div>
              )}
              <div style={{background:CARD,borderRadius:16,border:`1px solid ${BD}`,overflow:"hidden",boxShadow:SHD}}>
                <div style={{padding:16,borderBottom:`1px solid ${BD}`,display:"flex",justifyContent:"space-between",alignItems:"center",background:BG+"50"}}>
                  <h3 style={{margin:0,fontSize:15,fontWeight:700}}>Contratos com Perda</h3>
                  <select value={filtroPerdas} onChange={e=>setFiltroPerdas(e.target.value)} style={{...IS(),width:220}}><option value="todos">Todos</option><option value="acordo_assistido">Acordo Assistido</option><option value="em_processo_judicial">Em Processo Judicial</option><option value="encerrado_judicialmente">Encerrado Judicialmente</option><option value="em_cobranca">Em Cobrança</option><option value="pre_prejuizo">Pré-Prejuízo</option><option value="baixado_como_prejuizo">Baixado (Prejuízo)</option><option value="em_recuperacao">Em Recuperação</option><option value="recuperado_parcialmente">Recuperado Parcialmente</option><option value="encerrado_sem_recuperacao">Encerrado s/ Recuperação</option></select>
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
                    <tr key={c.ID_CONTRATO} onClick={()=>setContratoSel(c)} style={{borderBottom:`1px solid ${BD}`,fontSize:13,cursor:"pointer",transition:"background 0.1s"}} onMouseEnter={e=>e.currentTarget.style.background=BG} onMouseLeave={e=>e.currentTarget.style.background=""}>
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
                  <div style={{fontSize:11,color:MUTED,marginTop:4}}>{promessas.length} promessa{promessas.length!==1?"s":""} registrada{promessas.length!==1?"s":""}</div>
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
                  <button onClick={()=>setNovaPromessa(true)} style={{padding:"8px 16px",borderRadius:12,border:"none",background:ACC,color:"#07241B",cursor:"pointer",fontSize:13,fontWeight:700}}>+ Nova Promessa</button>
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
          {tab==="gestao"&&(()=>{
            const todosContratos=contratos||[];
            const totalContratos=todosContratos.length;
            const contratosAtivosG=todosContratos.filter(c=>_ST_ATIVOS.has(String(c.STATUS_CONTRATO||"").toLowerCase()));
            const vAtivosG=contratosAtivosG.reduce((s,c)=>s+(perdaInfoMap[String(c.ID_CONTRATO||"")]?.principalAberto||0),0);
            const ticketMedio=contratosAtivosG.length?vAtivosG/contratosAtivosG.length:0;
            const todasParcelas=parcelas||[];
            const mediaParcelas=contratosAtivosG.length?contratosAtivosG.reduce((s,c)=>s+parseInt(c.NUM_PARCELAS||0),0)/contratosAtivosG.length:0;
            const todosPagamentos=pagamentos||[];
            const jurosRecebidosTotal=todosPagamentos.reduce((s,pag)=>{const parc=todasParcelas.find(p=>String(p.ID_PARCELA)===String(pag.ID_PARCELA));const j=parc?Math.max(0,parseFloat(parc.VALOR_JUROS||0)-parseFloat(parc.DESCONTO_APLICADO||0)):0;return s+j+parseFloat(pag.RECEITA_EXTRA_ATRASO||0)+parseFloat(pag.FEE_PRORROGACAO||0);},0);
            const principalEmprestadoTotal=todosContratos.reduce((s,c)=>s+parseFloat(c.VALOR_PRINCIPAL||0),0);
            const parcNaoPagas=todasParcelas.filter(p=>!_ST_TERMINAL.has(String(p.STATUS||"").toLowerCase()));
            const jurosProjetados=parcNaoPagas.reduce((s,p)=>s+Math.max(0,parseFloat(p.VALOR_JUROS||0)-parseFloat(p.DESCONTO_APLICADO||0)),0);
            const margemPct=principalEmprestadoTotal>0?(jurosRecebidosTotal/principalEmprestadoTotal*100):0;
            const valorAtrasoG=parcelasAtrasadas.reduce((s,p)=>s+parseFloat(p.VALOR_PARCELA||0),0);
            const taxaInadPct=vAtivosG>0?(valorAtrasoG/vAtivosG*100):0;
            const contratosComAtrasoIds=new Set(parcelasAtrasadas.map(p=>String(p.ID_CONTRATO)));
            const valorContratosEmAtraso=contratosAtivosG.filter(c=>contratosComAtrasoIds.has(String(c.ID_CONTRATO))).reduce((s,c)=>s+(perdaInfoMap[String(c.ID_CONTRATO||"")]?.principalAberto||0),0);
            const taxaInadValorPct=vAtivosG>0?(valorContratosEmAtraso/vAtivosG*100):0;
            const contratosPerda=todosContratos.filter(c=>String(c.STATUS_CONTRATO||"").toLowerCase()==="baixado_como_prejuizo");
            const valorBaixadoBruto=contratosPerda.reduce((s,c)=>s+parseFloat(c.VALOR_PRINCIPAL||0),0);
            const contratosPerdaIds=new Set(contratosPerda.map(c=>String(c.ID_CONTRATO)));
            const parcPerdaIds=new Set(todasParcelas.filter(p=>contratosPerdaIds.has(String(p.ID_CONTRATO))).map(p=>String(p.ID_PARCELA)));
            const recuperadoDosPrejuizos=todosPagamentos.filter(pg=>parcPerdaIds.has(String(pg.ID_PARCELA))).reduce((s,pg)=>s+parseFloat(pg.VALOR_PAGO||0),0);
            const valorBaixadoLiquido=Math.max(0,valorBaixadoBruto-recuperadoDosPrejuizos);
            const taxaBaixaValorPct=principalEmprestadoTotal>0?(valorBaixadoLiquido/principalEmprestadoTotal*100):0;
            const todosClientes=clientes||[];
            const clientesComContratoAtivo=new Set(contratosAtivosG.map(c=>String(c.ID_CLIENTE))).size;
            const clientesEmAtrasoG=new Set(parcelasAtrasadas.map(p=>String(p.ID_CLIENTE))).size;
            const clientesRecorrentes=todosClientes.filter(c=>todosContratos.filter(ct=>String(ct.ID_CLIENTE)===String(c.ID_CLIENTE)).length>=2);
            const clientesComContrato=todosClientes.filter(c=>todosContratos.some(ct=>String(ct.ID_CLIENTE)===String(c.ID_CLIENTE)));
            const taxaRecorrencia=clientesComContrato.length>0?(clientesRecorrentes.length/clientesComContrato.length*100):0;
            const top5=todosClientes.map(c=>{const vol=todosContratos.filter(ct=>String(ct.ID_CLIENTE)===String(c.ID_CLIENTE)).reduce((s,ct)=>s+parseFloat(ct.VALOR_PRINCIPAL||0),0);const qtd=todosContratos.filter(ct=>String(ct.ID_CLIENTE)===String(c.ID_CLIENTE)).length;return{...c,vol,qtd};}).sort((a,b)=>b.vol-a.vol).slice(0,5);
            const contratosPorMes=Array.from({length:12},(_,i)=>{const hoje=new Date();const dt=new Date(hoje.getFullYear(),hoje.getMonth()-(11-i),1);const ini=new Date(dt.getFullYear(),dt.getMonth(),1,0,0,0);const fim=new Date(dt.getFullYear(),dt.getMonth()+1,0,23,59,59);const cs=todosContratos.filter(c=>{const d=parseDate(c.DATA_EMPRESTIMO);return d&&d>=ini&&d<=fim;});return{name:dt.toLocaleDateString("pt-BR",{month:"short"}).replace(".",""),qtd:cs.length,vol:cs.reduce((s,c)=>s+parseFloat(c.VALOR_PRINCIPAL||0),0)};});
            // Capital em circulação por mês: saldo de principal ainda em aberto no fechamento de cada mês
            // (não é volume liberado/originado — é o saldo devedor de principal que ainda não tinha saído de circulação naquela data)
            const capitalCirculacaoPorMes=Array.from({length:12},(_,i)=>{
              const hoje=new Date();
              const dt=new Date(hoje.getFullYear(),hoje.getMonth()-(11-i),1);
              const fimMes=new Date(dt.getFullYear(),dt.getMonth()+1,0,23,59,59);
              let total=0;
              todosContratos.forEach(c=>{
                const dCriacao=parseDate(c.DATA_EMPRESTIMO);
                if(!dCriacao||dCriacao>fimMes)return; // contrato ainda não existia no fechamento desse mês
                // Contrato como um todo pode ter saído da "circulação normal" (foi pra balde judicial/baixado/cancelado) —
                // mesma lógica de associação de _ST_ATIVOS, mas aplicada no ponto do tempo certo, não só "agora"
                const stContrato=String(c.STATUS_CONTRATO||"").toLowerCase();
                let dataSaidaContrato=null;
                if(stContrato==="em_processo_judicial"||stContrato==="encerrado_judicialmente"){
                  dataSaidaContrato=parseDate(c.DATA_AJUIZAMENTO)||hoje;
                } else if(["baixado_como_prejuizo","recuperado_integralmente","encerrado_sem_recuperacao"].includes(stContrato)){
                  dataSaidaContrato=parseDate(c.DATA_BAIXA_PREJUIZO)||hoje;
                } else if(stContrato==="cancelado"){
                  dataSaidaContrato=dCriacao; // sem data de cancelamento rastreada — nunca conta como circulando
                } else if(stContrato==="quitado"){
                  // reforço além da checagem por parcela: usa a data do último pagamento do contrato
                  // (cobre parcelas antigas com DATA_PAGAMENTO ausente por qualidade de dado legado)
                  const datasPag=todasParcelas.filter(p=>String(p.ID_CONTRATO)===String(c.ID_CONTRATO)).map(p=>parseDate(p.DATA_PAGAMENTO)).filter(Boolean);
                  dataSaidaContrato=datasPag.length?new Date(Math.max(...datasPag.map(d=>d.getTime()))):hoje;
                }
                if(dataSaidaContrato&&dataSaidaContrato<=fimMes)return; // já tinha saído da circulação até esse fechamento
                todasParcelas.forEach(p=>{
                  if(String(p.ID_CONTRATO)!==String(c.ID_CONTRATO))return;
                  const st=String(p.STATUS||p.STATUS_PAGAMENTO||"").toLowerCase();
                  // status não-terminal (aberta/pendente/atrasada) -> null = ainda circula, conta sempre
                  // status terminal SEM data rastreável -> nunca deveria "ainda estar circulando" (já foi resolvida,
                  // só não sabemos exatamente quando); fallback "hoje" garante que sai da contagem do mês atual
                  // em diante, sem sumir retroativamente dos meses passados (mesmo padrão usado a nível de contrato)
                  let dataSaida=null;
                  if(st==="pago"||st==="quitacao_antecipada") dataSaida=parseDate(p.DATA_PAGAMENTO)||hoje;
                  else if(st==="baixado_como_prejuizo") dataSaida=parseDate(c.DATA_BAIXA_PREJUIZO)||hoje;
                  else if(st==="renegociado") dataSaida=parseDate(c.DATA_RENEGOCIACAO)||hoje;
                  else if(st==="cancelado") dataSaida=dCriacao;
                  if(!dataSaida||dataSaida>fimMes) total+=parseFloat(p.VALOR_PRINCIPAL||0);
                });
              });
              return{name:dt.toLocaleDateString("pt-BR",{month:"short"}).replace(".",""),vol:total};
            });
            const taxaMedia=(()=>{if(!contratosAtivosG.length)return 0;return contratosAtivosG.reduce((s,c)=>s+parseFloat(c.TAXA_JUROS_MENSAL||0),0)/contratosAtivosG.length*100;})();
            const jurosPorMes=Array.from({length:12},(_,i)=>{const hoje=new Date();const dt=new Date(hoje.getFullYear(),hoje.getMonth()-(11-i),1);const ini=new Date(dt.getFullYear(),dt.getMonth(),1,0,0,0);const fim=new Date(dt.getFullYear(),dt.getMonth()+1,0,23,59,59);const pags=todosPagamentos.filter(p=>{const d=parseDate(p.DATA_PAGAMENTO);return d&&d>=ini&&d<=fim;});const v=pags.reduce((s,pag)=>{const parc=todasParcelas.find(p=>String(p.ID_PARCELA)===String(pag.ID_PARCELA));const j=parc?Math.max(0,parseFloat(parc.VALOR_JUROS||0)-parseFloat(parc.DESCONTO_APLICADO||0)):0;return s+j+parseFloat(pag.RECEITA_EXTRA_ATRASO||0)+parseFloat(pag.FEE_PRORROGACAO||0);},0);return{name:dt.toLocaleDateString("pt-BR",{month:"short"}).replace(".",""),value:v};});
            const atrasoPorMes=Array.from({length:12},(_,i)=>{const hoje=new Date();const dt=new Date(hoje.getFullYear(),hoje.getMonth()-(11-i),1);const ini=new Date(dt.getFullYear(),dt.getMonth(),1,0,0,0);const fim=new Date(dt.getFullYear(),dt.getMonth()+1,0,23,59,59);const vencidas=todasParcelas.filter(p=>{const dv=parseDate(p.DATA_VENCIMENTO);return dv&&dv>=ini&&dv<=fim;});const atrasadas=vencidas.filter(p=>todosPagamentos.some(pg=>String(pg.ID_PARCELA)===String(p.ID_PARCELA)&&pg.TIPO_PAGAMENTO==="pagamento_com_atraso")||String(p.STATUS||"").toLowerCase()==="atrasado").length;const pct=vencidas.length>0?parseFloat((atrasadas/vencidas.length*100).toFixed(1)):0;return{name:dt.toLocaleDateString("pt-BR",{month:"short"}).replace(".",""),pct,atrasadas,total:vencidas.length};});
            const GestaoChart=({data,dataKey,label,isMoney,color})=>(<ResponsiveContainer width="100%" height={180}><BarChart data={data} barSize={16}><CartesianGrid strokeDasharray="3 3" stroke={BD} vertical={false}/><XAxis dataKey="name" tick={{fill:MUTED,fontSize:11}} axisLine={false} tickLine={false}/><YAxis allowDecimals={false} tick={{fill:MUTED,fontSize:11}} axisLine={false} tickLine={false} width={isMoney?60:28} tickFormatter={v=>isMoney?(v>=1000?"R$"+(v/1000).toFixed(0)+"k":"R$"+v.toFixed(0)):v}/><Tooltip contentStyle={{background:CARD,border:`1px solid ${BD}`,borderRadius:10,boxShadow:SHD,fontSize:12}} labelStyle={{color:TEXT,fontWeight:700}} formatter={v=>[isMoney?fmtR(v):v+(dataKey==="pct"?"%":""),label]}/><Bar dataKey={dataKey} fill={color||SIG} radius={[4,4,0,0]}/></BarChart></ResponsiveContainer>);
            const GestaoChartPanel=({chartKey,title,sub,children})=>gestaoExpandido===chartKey?(<div style={{background:CARD,borderRadius:14,border:`1px solid ${SIG}40`,borderTop:`3px solid ${SIG}`,padding:"16px 20px",animation:"fadeUp 200ms ease both"}}><div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:14}}><div><div style={{fontWeight:700,fontSize:13,color:TEXT}}>{title}</div><div style={{fontSize:11,color:MUTED,marginTop:2}}>{sub}</div></div><button onClick={()=>setGestaoExpandido(null)} style={{background:"transparent",border:"none",color:MUTED,cursor:"pointer",fontSize:20,lineHeight:1,padding:"0 2px",display:"flex",alignItems:"center"}}>×</button></div>{children}</div>):null;
            return(
            <div style={{display:"flex",flexDirection:"column",gap:24,animation:"fadeUp 400ms cubic-bezier(0.16,1,0.3,1) both"}}>
              <div>
                <div style={{fontSize:mob?20:26,fontWeight:800,color:TEXT,letterSpacing:"-0.5px",lineHeight:1.1}}>Visão Estratégica</div>
                <div style={{fontSize:12,color:MUTED,marginTop:4}}>Saúde e crescimento do negócio — dados históricos completos</div>
              </div>

              {/* CARTEIRA */}
              <div>
                <div style={{fontSize:11,fontWeight:700,color:MUTED,textTransform:"uppercase",letterSpacing:"0.08em",marginBottom:12}}>Carteira & Volume</div>
                <div style={{display:"grid",gridTemplateColumns:mob?"1fr 1fr":"repeat(4,1fr)",gap:mob?10:14}}>
                  {[
                    {l:"Contratos Ativos",      v:String(contratosAtivosG.length), sub:`de ${totalContratos} total histórico`,vc:TEXT, chartKey:"contratos_ativos", tip:"Contratos com status ativo, em atraso, em cobrança, pré-prejuízo, renegociado, em recuperação ou recuperado parcialmente. Exclui quitados, cancelados e baixados como prejuízo."},
                    {l:"Capital em Circulação", v:fmtR(vAtivosG),                   sub:"Principal ativo",                    vc:GRN,  chartKey:"capital_circulacao", tip:"Soma do VALOR_PRINCIPAL dos contratos ativos. É o dinheiro efetivamente emprestado agora, sem contar os juros."},
                    {l:"Ticket Médio",          v:fmtR(ticketMedio),                sub:"Por contrato ativo",                 vc:TEXT, tip:"Capital em circulação dividido pela quantidade de contratos ativos. Mostra o valor médio de cada empréstimo em vigor."},
                    {l:"Média de Parcelas",     v:mediaParcelas.toFixed(1)+"x",     sub:"Por contrato ativo",                 vc:TEXT, tip:"Média do prazo original (em meses) dos contratos ativos, com base no campo NUM_PARCELAS de cada contrato. Não conta parcelas extras geradas por pagamentos de juros."},
                  ].map(k=>{const isExp=k.chartKey&&gestaoExpandido===k.chartKey;return(
                    <div key={k.l} onClick={k.chartKey?()=>setGestaoExpandido(gestaoExpandido===k.chartKey?null:k.chartKey):undefined} style={{background:CARD,padding:mob?"12px 14px":"16px 18px",borderRadius:14,border:`1px solid ${isExp?SIG+"60":BD}`,boxShadow:SHD,cursor:k.chartKey?"pointer":"default",position:"relative",overflow:"hidden",transition:"border-color 0.15s"}}>
                      <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:10}}>
                        <div style={{fontSize:10,fontWeight:700,color:isExp?SIG:MUTED,textTransform:"uppercase",letterSpacing:"0.08em",display:"flex",alignItems:"center"}}>{k.l}{k.tip&&<InfoTooltip text={k.tip}/>}</div>
                        {k.chartKey&&<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke={isExp?SIG:MUTED} strokeWidth="2.5" style={{flexShrink:0,marginLeft:4}}><polyline points="22,12 18,12 15,21 9,3 6,12 2,12"/></svg>}
                      </div>
                      <div style={{fontSize:mob?18:22,fontWeight:800,color:k.vc,lineHeight:1.1}}>{priv(k.v)}</div>
                      <div style={{fontSize:11,color:MUTED,marginTop:5}}>{k.sub}</div>
                      {isExp&&<div style={{position:"absolute",bottom:0,left:0,right:0,height:3,background:SIG,borderRadius:"0 0 13px 13px"}}/>}
                    </div>
                  );})}
                </div>
                <GestaoChartPanel chartKey="contratos_ativos" title="Novos contratos por mês" sub="Quantidade de contratos criados em cada mês — últimos 12 meses">
                  <GestaoChart data={contratosPorMes} dataKey="qtd" label="contratos" isMoney={false}/>
                </GestaoChartPanel>
                <GestaoChartPanel chartKey="capital_circulacao" title="Capital em circulação por mês" sub="Saldo de principal ainda em aberto no fechamento de cada mês — últimos 12 meses">
                  <GestaoChart data={capitalCirculacaoPorMes} dataKey="vol" label="em circulação" isMoney={true}/>
                </GestaoChartPanel>
              </div>

              {/* RESULTADO FINANCEIRO */}
              <div>
                <div style={{fontSize:11,fontWeight:700,color:MUTED,textTransform:"uppercase",letterSpacing:"0.08em",marginBottom:12}}>Resultado Financeiro</div>
                <div style={{display:"grid",gridTemplateColumns:mob?"1fr 1fr":"repeat(4,1fr)",gap:mob?10:14}}>
                  {[
                    {l:"Total Emprestado",  v:fmtR(principalEmprestadoTotal), sub:"Principal histórico acumulado",             vc:TEXT, tip:"Soma do VALOR_PRINCIPAL de todos os contratos já criados no sistema (ativos + encerrados + baixados). É o volume total de crédito concedido desde o início."},
                    {l:"Juros Recebidos",   v:fmtR(jurosRecebidosTotal),       sub:"Acumulado histórico",                      vc:OK,  chartKey:"juros_recebidos", tip:"Soma de todos os juros efetivamente recebidos: juros da parcela (menos desconto aplicado) + mora por atraso (RECEITA_EXTRA_ATRASO). Representa a receita real gerada pelo negócio."},
                    {l:"Juros Projetados",  v:fmtR(jurosProjetados),           sub:"Carteira ativa — a receber",               vc:BLU, tip:"Soma dos juros das parcelas que ainda não foram pagas (status não-terminal). É a receita futura estimada da carteira ativa — o que ainda está por entrar."},
                    {l:"Margem Acumulada",  v:margemPct.toFixed(1)+"%",        sub:`Taxa média ativa: ${taxaMedia.toFixed(1)}% a.m.`, vc:OK, tip:"Juros Recebidos ÷ Total Emprestado × 100. Mostra quanto do capital emprestado voltou como juros. Ex: 42% significa que a cada R$100 emprestados, R$42 vieram de juros. A taxa média ativa é a média mensal dos contratos com parcelas em aberto."},
                  ].map(k=>{const isExp=k.chartKey&&gestaoExpandido===k.chartKey;return(
                    <div key={k.l} onClick={k.chartKey?()=>setGestaoExpandido(gestaoExpandido===k.chartKey?null:k.chartKey):undefined} style={{background:CARD,padding:mob?"12px 14px":"16px 18px",borderRadius:14,border:`1px solid ${isExp?SIG+"60":BD}`,boxShadow:SHD,cursor:k.chartKey?"pointer":"default",position:"relative",overflow:"hidden",transition:"border-color 0.15s"}}>
                      <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:10}}>
                        <div style={{fontSize:10,fontWeight:700,color:isExp?SIG:MUTED,textTransform:"uppercase",letterSpacing:"0.08em",display:"flex",alignItems:"center"}}>{k.l}{k.tip&&<InfoTooltip text={k.tip}/>}</div>
                        {k.chartKey&&<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke={isExp?SIG:MUTED} strokeWidth="2.5" style={{flexShrink:0,marginLeft:4}}><polyline points="22,12 18,12 15,21 9,3 6,12 2,12"/></svg>}
                      </div>
                      <div style={{fontSize:mob?18:22,fontWeight:800,color:k.vc,lineHeight:1.1}}>{priv(k.v)}</div>
                      <div style={{fontSize:11,color:MUTED,marginTop:5}}>{k.sub}</div>
                      {isExp&&<div style={{position:"absolute",bottom:0,left:0,right:0,height:3,background:SIG,borderRadius:"0 0 13px 13px"}}/>}
                    </div>
                  );})}
                </div>
                <GestaoChartPanel chartKey="juros_recebidos" title="Juros recebidos por mês" sub="Soma de juros base + mora de todos os pagamentos em cada mês — últimos 12 meses">
                  <GestaoChart data={jurosPorMes} dataKey="value" label="juros recebidos" isMoney={true} color={OK}/>
                </GestaoChartPanel>
              </div>

              {/* INADIMPLÊNCIA */}
              <div>
                <div style={{fontSize:11,fontWeight:700,color:MUTED,textTransform:"uppercase",letterSpacing:"0.08em",marginBottom:12}}>Inadimplência & Riscos</div>
                <div style={{display:"grid",gridTemplateColumns:mob?"1fr 1fr":"repeat(4,1fr)",gap:mob?10:14}}>
                  {[
                    {l:"Carteira em Atraso",      v:taxaInadPct.toFixed(1)+"%", sub:`${fmtR(valorAtrasoG)} de ${fmtR(vAtivosG)} em circulação`, vc:taxaInadPct>15?RED:taxaInadPct>5?YEL:OK, chartKey:"carteira_atraso", tip:"Valor das parcelas em atraso ÷ Capital em Circulação × 100. Ex: 12.4% significa que R$33.264 dos R$267.269 emprestados estão em atraso. Abaixo de 5% = saudável, 5–15% = atenção, acima de 15% = crítico."},
                    {l:"Taxa de Inadimplência",   v:taxaInadValorPct.toFixed(1)+"%", sub:`${fmtR(valorContratosEmAtraso)} de ${fmtR(vAtivosG)} em circulação`, vc:taxaInadValorPct>20?RED:taxaInadValorPct>10?YEL:OK, tip:"Soma do VALOR_PRINCIPAL dos contratos com parcelas em atraso ÷ Capital em Circulação × 100. Mede que fração do capital emprestado está associada a clientes inadimplentes. Diferente de 'Carteira em Atraso' (que usa valor das parcelas vencidas): aqui o numerador é o principal do contrato inteiro."},
                    {l:"Clientes em Atraso",      v:String(clientesEmAtrasoG), sub:`de ${clientesComContratoAtivo} com contrato ativo`, vc:clientesEmAtrasoG>0?RED:OK, tip:"Quantidade de clientes distintos com ao menos uma parcela vencida e não paga. O denominador é o total de clientes com contratos ativos (não todos os clientes cadastrados)."},
                    {l:"Taxa de Baixa (Prejuízo)",v:taxaBaixaValorPct.toFixed(1)+"%", sub:recuperadoDosPrejuizos>0?`${fmtR(valorBaixadoLiquido)} líquido · recuperado ${fmtR(recuperadoDosPrejuizos)}`:`${fmtR(valorBaixadoLiquido)} de ${fmtR(principalEmprestadoTotal)} histórico`, vc:taxaBaixaValorPct>10?RED:taxaBaixaValorPct>3?YEL:OK, tip:"Prejuízo líquido ÷ Total emprestado histórico × 100. Prejuízo líquido = VALOR_PRINCIPAL dos contratos baixados − pagamentos já recebidos nesses contratos (recuperações judiciais ou acordos). Atualiza automaticamente ao registrar qualquer pagamento em contrato baixado."},
                  ].map(k=>{const isExp=k.chartKey&&gestaoExpandido===k.chartKey;return(
                    <div key={k.l} onClick={k.chartKey?()=>setGestaoExpandido(gestaoExpandido===k.chartKey?null:k.chartKey):undefined} style={{background:CARD,padding:mob?"12px 14px":"16px 18px",borderRadius:14,border:`1px solid ${isExp?RED+"60":BD}`,boxShadow:SHD,cursor:k.chartKey?"pointer":"default",position:"relative",overflow:"hidden",transition:"border-color 0.15s"}}>
                      <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:10}}>
                        <div style={{fontSize:10,fontWeight:700,color:isExp?RED:MUTED,textTransform:"uppercase",letterSpacing:"0.08em",display:"flex",alignItems:"center"}}>{k.l}{k.tip&&<InfoTooltip text={k.tip}/>}</div>
                        {k.chartKey&&<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke={isExp?RED:MUTED} strokeWidth="2.5" style={{flexShrink:0,marginLeft:4}}><polyline points="22,12 18,12 15,21 9,3 6,12 2,12"/></svg>}
                      </div>
                      <div style={{fontSize:mob?22:28,fontWeight:800,color:k.vc,lineHeight:1.1}}>{priv(k.v)}</div>
                      <div style={{fontSize:11,color:MUTED,marginTop:5}}>{k.sub}</div>
                      {isExp&&<div style={{position:"absolute",bottom:0,left:0,right:0,height:3,background:RED,borderRadius:"0 0 13px 13px"}}/>}
                    </div>
                  );})}
                </div>
                <GestaoChartPanel chartKey="carteira_atraso" title="Taxa de inadimplência por mês" sub="% de parcelas vencidas em cada mês que foram pagas com atraso ou ainda estão em atraso — últimos 12 meses">
                  <GestaoChart data={atrasoPorMes} dataKey="pct" label="inadimplência" isMoney={false} color={RED}/>
                </GestaoChartPanel>
              </div>

              {/* GRÁFICO + BASE DE CLIENTES */}
              <div style={{display:"grid",gridTemplateColumns:mob?"1fr":"2fr 1fr",gap:16,alignItems:"start"}}>
                <div style={{background:CARD,borderRadius:16,padding:mob?"16px":"22px",border:`1px solid ${BD}`,boxShadow:SHD}}>
                  <div style={{marginBottom:20}}>
                    <div style={{fontSize:13,fontWeight:700,color:TEXT}}>Novos contratos por mês</div>
                    <div style={{fontSize:11,color:MUTED,marginTop:2}}>Últimos 12 meses — quantidade de novos contratos</div>
                  </div>
                  <ResponsiveContainer width="100%" height={220}>
                    <BarChart data={contratosPorMes} barSize={18}>
                      <CartesianGrid strokeDasharray="3 3" stroke={BD} vertical={false}/>
                      <XAxis dataKey="name" tick={{fill:MUTED,fontSize:11}} axisLine={false} tickLine={false}/>
                      <YAxis allowDecimals={false} tick={{fill:MUTED,fontSize:11}} axisLine={false} tickLine={false} width={24}/>
                      <Tooltip content={({active,payload,label})=>{if(!active||!payload||!payload.length)return null;const d=payload[0].payload;return(<div style={{background:CARD,border:`1px solid ${BD}`,borderRadius:10,boxShadow:SHD,padding:"10px 14px",fontSize:12}}><div style={{fontWeight:700,color:TEXT,marginBottom:6}}>{label}</div><div style={{color:TEXT}}>{d.qtd} contrato{d.qtd!==1?"s":""}</div><div style={{color:SIG,fontWeight:600,marginTop:3}}>{fmtR(d.vol)}</div></div>);}}/>
                      <Bar dataKey="qtd" fill={SIG} radius={[4,4,0,0]}/>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
                <div style={{background:CARD,borderRadius:16,padding:mob?"16px":"22px",border:`1px solid ${BD}`,boxShadow:SHD}}>
                  <div style={{fontSize:13,fontWeight:700,color:TEXT,marginBottom:16}}>Base de Clientes</div>
                  {[
                    {l:"Clientes ativos",      v:clientesComContratoAtivo},
                    {l:"Total cadastrado",     v:todosClientes.length},
                    {l:"Com 2+ contratos",     v:clientesRecorrentes.length},
                    {l:"Taxa de recorrência",  v:taxaRecorrencia.toFixed(1)+"%"},
                  ].map((r,i)=>(
                    <div key={r.l} style={{display:"flex",alignItems:"center",justifyContent:"space-between",padding:"10px 0",borderBottom:i<3?`1px solid ${BD}`:"none"}}>
                      <span style={{fontSize:12,color:MUTED}}>{r.l}</span>
                      <span style={{fontSize:14,fontWeight:700,color:TEXT}}>{priv(String(r.v))}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* TOP 5 CLIENTES */}
              <div style={{background:CARD,borderRadius:16,padding:mob?"16px":"22px",border:`1px solid ${BD}`,boxShadow:SHD}}>
                <div style={{fontSize:13,fontWeight:700,color:TEXT,marginBottom:16}}>Top 5 clientes — volume histórico total</div>
                {top5.length===0
                  ? <div style={{fontSize:13,color:MUTED,padding:"20px 0",textAlign:"center"}}>Sem dados</div>
                  : top5.map((c,i)=>(
                    <div key={c.ID_CLIENTE} style={{display:"flex",alignItems:"center",gap:12,padding:"12px 0",borderBottom:i<4?`1px solid ${BD}`:"none"}}>
                      <div style={{width:28,height:28,borderRadius:"50%",background:i===0?ACC:GRN+"20",display:"flex",alignItems:"center",justifyContent:"center",fontSize:11,fontWeight:800,color:i===0?"#07241B":GRN,flexShrink:0}}>{i+1}</div>
                      <div style={{flex:1,minWidth:0}}>
                        <div style={{fontSize:13,fontWeight:600,color:TEXT,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{c.NOME||c.NOME_CLIENTE||"—"}</div>
                        <div style={{fontSize:11,color:MUTED}}>{c.qtd} contrato{c.qtd!==1?"s":""}</div>
                      </div>
                      <div style={{fontSize:14,fontWeight:700,color:GRN,flexShrink:0}}>{priv(fmtR(c.vol))}</div>
                    </div>
                  ))
                }
              </div>
            </div>
            );
          })()}

          {tab==="regua"&&(()=>{
            const hoje=new Date();hoje.setHours(0,0,0,0);
            const parseMsgDt=s=>{if(!s)return null;const d=new Date(s);return isNaN(d)?null:d;};
            const fmtMsgDt=s=>{const d=parseMsgDt(s);if(!d)return"—";return d.toLocaleString("pt-BR",{day:"2-digit",month:"2-digit",year:"numeric",hour:"2-digit",minute:"2-digit"}).replace(",","");};
            const categG=g=>{const s=String(g||"").toUpperCase();if(s==="CONFIRMACAO_PAGAMENTO"||s==="CONFIRMACAO_RENEGOCIACAO")return{cat:"Confirmação",cor:GRN};if(s==="PIX_MANUAL"||s==="PIX_ENTRADA_RENEGOCIACAO")return{cat:"PIX Manual",cor:BLU};if(s.startsWith("PROMESSA"))return{cat:"Promessa",cor:"#A855F7"};if(s==="D0")return{cat:"Vencimento",cor:YEL};if(s==="D-5"||s==="D-1")return{cat:"Pré-cobrança",cor:BLU};if(s.startsWith("D+"))return{cat:"Em atraso",cor:RED};return{cat:"Erro",cor:RED};};
            const isErr=m=>String(m.STATUS_ENVIO||"").startsWith("ERRO");
            const msgsOrd=[...mensagens].sort((a,b)=>{const da=parseMsgDt(a.DATA_ENVIO),db=parseMsgDt(b.DATA_ENVIO);return (db||0)-(da||0);});
            const enviadas=msgsOrd.filter(m=>!isErr(m));
            const erros=msgsOrd.filter(m=>isErr(m));
            const hoje2=msgsOrd.filter(m=>{const d=parseMsgDt(m.DATA_ENVIO);if(!d)return false;const dd=new Date(d);dd.setHours(0,0,0,0);return dd.getTime()===hoje.getTime();});
            const filtros=[{v:"todos",l:"Todos",c:GRN},{v:"precobranca",l:"Pré-cobrança",c:BLU},{v:"vencimento",l:"Vencimento",c:YEL},{v:"atraso",l:"Em atraso",c:RED},{v:"promessa",l:"Promessa",c:"#A855F7"},{v:"confirmacao",l:"Confirmação",c:GRN},{v:"erro",l:"Erros",c:RED}];
            const msgsFilt=msgsOrd.filter(m=>{if(filtroRegua==="todos")return true;if(filtroRegua==="erro")return isErr(m);const cat=categG(m.GATILHO).cat;if(filtroRegua==="precobranca")return cat==="Pré-cobrança";if(filtroRegua==="vencimento")return cat==="Vencimento";if(filtroRegua==="atraso")return cat==="Em atraso";if(filtroRegua==="promessa")return cat==="Promessa";if(filtroRegua==="confirmacao")return cat==="Confirmação";return true;});
            return(
              <div className="flex flex-col gap-5" style={{animation:"fadeUp 400ms cubic-bezier(0.16,1,0.3,1) both"}}>
                <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-end",flexWrap:"wrap",gap:12}}>
                  <div>
                    <div style={{fontSize:mob?18:22,fontWeight:800,color:TEXT,letterSpacing:"-0.3px"}}>Régua de Cobrança WPP</div>
                    <div style={{fontSize:11,color:MUTED,marginTop:4}}>Logs de envio automático via WhatsApp</div>
                  </div>
                  <button disabled={disparandoRegua} onClick={async()=>{if(!window.confirm("Disparar a régua agora? Mensagens WhatsApp reais serão enviadas."))return;setDisparandoRegua(true);try{const res=await postAction({action:"dispararReguaCobranca"});if(res?.ok){alert(`Régua concluída!\nEnviadas: ${res.enviados} | Erros: ${res.erros}`);carregar();}else if(res?.erro){alert("Erro GAS: "+res.erro);}}catch(e){alert("Régua disparada. Verifique os logs na tabela em 1–2 minutos.");carregar();}finally{setDisparandoRegua(false);}}} style={{display:"flex",alignItems:"center",gap:7,padding:"8px 16px",borderRadius:10,border:`1px solid ${GRN}40`,background:disparandoRegua?CARD:GRN+"10",color:disparandoRegua?MUTED:GRN,cursor:disparandoRegua?"not-allowed":"pointer",fontSize:13,fontWeight:600,whiteSpace:"nowrap",opacity:disparandoRegua?0.7:1}}>
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg>
                    {disparandoRegua?"Enviando...":"Disparar Régua"}
                  </button>
                  <button onClick={()=>setModalTemplatesRegua(true)} style={{display:"flex",alignItems:"center",gap:7,padding:"8px 16px",borderRadius:10,border:`1px solid ${BD}`,background:CARD,color:MUTED,cursor:"pointer",fontSize:13,fontWeight:600,whiteSpace:"nowrap"}}>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z"/><circle cx="12" cy="12" r="3"/></svg>
                    Templates
                  </button>
                </div>
                <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:14}}>
                  {[
                    {l:"Enviadas hoje",v:hoje2.filter(m=>!isErr(m)).length,c:GRN,sub:"mensagens"},
                    {l:"Total enviadas",v:enviadas.length,c:BLU,sub:"histórico completo"},
                    {l:"Erros",v:erros.length,c:erros.length>0?RED:GRN,sub:"falhas de envio"},
                  ].map(k=>(
                    <div key={k.l} style={{background:CARD,padding:18,borderRadius:16,border:`1px solid ${BD}`,boxShadow:SHD,position:"relative",overflow:"hidden"}}>
                      <div style={{fontSize:10,color:MUTED,fontWeight:600,textTransform:"uppercase",marginBottom:4}}>{k.l}</div>
                      <div style={{fontSize:26,fontWeight:900,color:k.c}}>{k.v}</div>
                      <div style={{fontSize:11,color:MUTED,marginTop:2}}>{k.sub}</div>
                      <div style={{position:"absolute",bottom:0,left:0,right:0,height:3,background:k.c,borderRadius:"0 0 14px 14px",opacity:0.6}}/>
                    </div>
                  ))}
                </div>
                <div style={{background:CARD,borderRadius:16,border:`1px solid ${BD}`,overflow:"hidden",boxShadow:SHD}}>
                  <div style={{padding:16,borderBottom:`1px solid ${BD}`,display:"flex",gap:8,flexWrap:"wrap",alignItems:"center"}}>
                    {filtros.map(f=>(
                      <button key={f.v} onClick={()=>setFiltroRegua(f.v)} style={{padding:"6px 12px",borderRadius:9,border:`1px solid ${filtroRegua===f.v?f.c+"40":BD}`,background:filtroRegua===f.v?f.c+"10":CARD,color:filtroRegua===f.v?f.c:MUTED,cursor:"pointer",fontSize:12,fontWeight:filtroRegua===f.v?700:500}}>
                        {f.l}
                      </button>
                    ))}
                    <span style={{marginLeft:"auto",fontSize:11,color:MUTED}}>{msgsFilt.length} registro{msgsFilt.length!==1?"s":""}</span>
                  </div>
                  {msgsFilt.length===0
                    ?<div style={{padding:"40px 18px",textAlign:"center",color:MUTED,fontSize:13}}>Nenhum registro encontrado. A régua ainda não disparou ou não há logs para este filtro.</div>
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
                        const stCor=err?RED:(manual?ORG:GRN);
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
                  }
                </div>
              </div>
            );
          })()}

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
      {selCli&&<ClienteModal cliente={selCli} contratos={contratos||[]} parcelas={parcelas||[]} clientes={clientes||[]} abaInicial={selCliAba} onFechar={()=>{setSelCli(null);setSelCliAba("perfil");}} onAtualizar={()=>{setSelCli(null);setSelCliAba("perfil");}} onOptimisticUpdate={(campos,idCliente)=>{setRaw(prev=>{if(!prev)return prev;return{...prev,CLIENTES:(prev.CLIENTES||[]).map(c=>String(c.ID_CLIENTE)===String(idCliente)?{...c,...campos}:c)};});carregar();}} onNovoContrato={(c)=>{setSelCli(null);setSelCliAba("perfil");setNovoContratoIni(c);setDashNovoModal(true);}} onVerContrato={(c)=>{setSelCliAba("contratos");setContratoSel(c);}} onSimular={(dados)=>{setSelCli(null);setSelCliAba("perfil");setSimInicial(dados);setTab("simulador");}}/>}
      {pagamentoHoje&&<PagamentoParcelaModal parcela={pagamentoHoje} parcelas={parcelas||[]} contratos={contratos||[]} clientes={clientes||[]} initialModo={pagModo} onConfirmar={()=>{const p=pagamentoHoje;setPagamentoHoje(null);setPagModo("pagamento");if(p)setRaw(prev=>{if(!prev)return prev;return{...prev,PARCELAS:(prev.PARCELAS||[]).map(par=>String(par.ID_PARCELA)===String(p.ID_PARCELA)?{...par,STATUS:"pago"}:par)};});carregar();}} onFechar={()=>{setPagamentoHoje(null);setPagModo("pagamento");}}/>}
      {dashRegModal&&<div className="modal-overlay-anim" style={{position:"fixed",inset:0,zIndex:500,background:"rgba(15,23,42,0.55)",backdropFilter:"blur(6px)",WebkitBackdropFilter:"blur(6px)",display:"flex",alignItems:"center",justifyContent:"center",padding:20}} onClick={()=>setDashRegModal(false)}><div className="modal-box-anim" style={{width:"100%",maxWidth:420,background:CARD,borderRadius:16,border:`1px solid ${BD}`,boxShadow:"0 24px 80px rgba(15,23,42,0.35)",minWidth:0}} onClick={e=>e.stopPropagation()}><div style={{background:GRN,padding:"16px 20px",borderRadius:"16px 16px 0 0",display:"flex",alignItems:"center",justifyContent:"space-between"}}><div style={{display:"flex",alignItems:"center",gap:10,color:ONBRAND}}><div style={{background:"rgba(255,255,255,0.2)",padding:8,borderRadius:8,display:"flex"}}>{IcoPag}</div><span style={{fontWeight:800,fontSize:15}}>Registrar Pagamento</span></div><button className="modal-close-btn" onClick={()=>setDashRegModal(false)} style={{background:"rgba(255,255,255,0.15)",border:"none",color:ONBRAND,borderRadius:8,width:32,height:32,cursor:"pointer",fontSize:18,display:"flex",alignItems:"center",justifyContent:"center"}}>×</button></div><div style={{padding:20}}><PagamentoDrop contratos={contratos||[]} parcelas={parcelas||[]} clientes={clientes||[]} onSucesso={async()=>{setDashRegModal(false);await carregar();}} onSelecionarParcela={p=>{setDashRegModal(false);setPagamentoHoje(p);}}/></div></div></div>}
      {dashNovoModal&&<div className="modal-overlay-anim" style={{position:"fixed",inset:0,zIndex:500,background:"rgba(15,23,42,0.55)",backdropFilter:"blur(6px)",WebkitBackdropFilter:"blur(6px)",display:"flex",alignItems:"center",justifyContent:"center",padding:20}} onClick={()=>{setDashNovoModal(false);setNovoContratoIni(null);}}><div className="modal-box-anim" style={{width:"100%",maxWidth:420,background:CARD,borderRadius:16,border:`1px solid ${BD}`,boxShadow:"0 24px 80px rgba(15,23,42,0.35)",minWidth:0}} onClick={e=>e.stopPropagation()}><div style={{background:GRN,padding:"16px 20px",borderRadius:"16px 16px 0 0",display:"flex",alignItems:"center",justifyContent:"space-between"}}><div style={{display:"flex",alignItems:"center",gap:10,color:ONBRAND}}><div style={{background:"rgba(255,255,255,0.2)",padding:8,borderRadius:8,display:"flex"}}>{IcoCtr}</div><span style={{fontWeight:800,fontSize:15}}>Novo Contrato</span></div><button className="modal-close-btn" onClick={()=>{setDashNovoModal(false);setNovoContratoIni(null);}} style={{background:"rgba(255,255,255,0.15)",border:"none",color:ONBRAND,borderRadius:8,width:32,height:32,cursor:"pointer",fontSize:18,display:"flex",alignItems:"center",justifyContent:"center"}}>×</button></div><div style={{padding:20}}><NovoContrato contratos={contratos||[]} clientes={clientes||[]} clienteInicial={novoContratoIni} onSucesso={()=>{setDashNovoModal(false);setNovoContratoIni(null);carregar(true);}}/></div></div></div>}
      {modalTemplatesRegua&&<TemplatesReguaModal onFechar={()=>setModalTemplatesRegua(false)}/>}
      {perdaAcoesModal&&<PerdaAcoesModal contrato={perdaAcoesModal} parcelas={parcelas||[]} clientes={clientes||[]} onEncerrar={()=>{setEncerramentoModal(perdaAcoesModal);setPerdaAcoesModal(null);}} onRecuperar={()=>{setRecuperacaoModal(perdaAcoesModal);setPerdaAcoesModal(null);}} onAcordoAssistido={()=>{setAcordoAssistModal(perdaAcoesModal);setPerdaAcoesModal(null);}} onAbatimento={()=>{setAbatimentoAssistModal(perdaAcoesModal);setPerdaAcoesModal(null);}} onSairAcordo={()=>{carregar();setPerdaAcoesModal(null);}} onFechar={()=>setPerdaAcoesModal(null)}/>}
      {encerramentoModal&&<EncerrarContratoModal contrato={encerramentoModal} parcelas={parcelas||[]} onConfirmar={()=>{setEncerramentoModal(null);carregar();}} onFechar={()=>setEncerramentoModal(null)}/>}
      {quitacaoModal&&<QuitacaoAntecipadaModal contrato={quitacaoModal} parcelas={parcelas||[]} clientes={clientes||[]} quitacoes={quitacoes||[]} onConfirmar={()=>{setQuitacaoModal(null);carregar();}} onVerContrato={(c)=>{setQuitacaoModal(null);setContratoSel(c);carregar();}} onFechar={()=>setQuitacaoModal(null)}/>}
      {recuperacaoModal&&<RecuperacaoModal contrato={recuperacaoModal} onConfirmar={()=>{setRecuperacaoModal(null);carregar();}} onFechar={()=>setRecuperacaoModal(null)}/>}
      {acordoAssistModal&&<AcordoAssistidoModal contrato={acordoAssistModal} onConfirmar={()=>{setAcordoAssistModal(null);carregar();}} onFechar={()=>setAcordoAssistModal(null)}/>}
      {abatimentoAssistModal&&<AbatimentoAssistidoModal contrato={abatimentoAssistModal} parcelas={parcelas||[]} onConfirmar={()=>{setAbatimentoAssistModal(null);carregar();}} onFechar={()=>setAbatimentoAssistModal(null)}/>}
      {ajuizarModal&&<AjuizarModal contrato={ajuizarModal} onSucesso={()=>carregar()} onFechar={()=>setAjuizarModal(null)}/>}
      {acordoJudicialModal&&<AcordoJudicialModal contrato={acordoJudicialModal} onSucesso={()=>carregar()} onFechar={()=>setAcordoJudicialModal(null)}/>}
      {quitacaoJudicialModal&&<QuitacaoJudicialModal contrato={quitacaoJudicialModal} onSucesso={()=>carregar()} onFechar={()=>setQuitacaoJudicialModal(null)}/>}
      {arquivarProcessoModal&&<ArquivarProcessoModal contrato={arquivarProcessoModal} onSucesso={()=>carregar()} onFechar={()=>setArquivarProcessoModal(null)}/>}
      {renegociacaoModal&&<RenegociacaoModal contrato={renegociacaoModal} parcelas={parcelas||[]} clientes={clientes||[]} propostasRenegociacao={propostasRenegociacao||[]} onConfirmar={()=>{setRenegociacaoModal(null);carregar();}} onFechar={()=>setRenegociacaoModal(null)}/>}

      {/* ── DRAWER DETALHE DE CAPITAL (CARTEIRA) ── */}
      {carteiraDetalheModal&&(
        <div style={{position:"fixed",inset:0,zIndex:380,background:"rgba(0,0,0,0.35)"}} onClick={()=>setCarteiraDetalheModal(null)}>
          <div onClick={e=>e.stopPropagation()} style={{position:"absolute",right:0,top:0,bottom:0,width:mob?"100%":460,background:CARD,boxShadow:"-8px 0 40px rgba(0,0,0,0.18)",display:"flex",flexDirection:"column",animation:"slideInRight 0.22s cubic-bezier(0.16,1,0.3,1)"}}>
            <div style={{padding:"20px 24px",borderBottom:`1px solid ${BD}`,display:"flex",alignItems:"flex-start",justifyContent:"space-between",flexShrink:0}}>
              <div>
                <div style={{fontSize:10,color:MUTED,fontWeight:700,textTransform:"uppercase",letterSpacing:"0.5px",marginBottom:4}}>{carteiraDetalheModal.label}</div>
                <div style={{fontSize:24,fontWeight:800,color:carteiraDetalheModal.cor,letterSpacing:"-0.5px"}}>{fmtR(carteiraDetalheModal.items.reduce((s,i)=>s+i.valor,0))}</div>
                <div style={{fontSize:11,color:MUTED,marginTop:3}}>{carteiraDetalheModal.items.length} contrato{carteiraDetalheModal.items.length!==1?"s":""} · clique para abrir</div>
              </div>
              <button onClick={()=>setCarteiraDetalheModal(null)} style={{background:"none",border:"none",cursor:"pointer",color:MUTED,fontSize:18,lineHeight:1,padding:4,borderRadius:6,marginTop:-2}}>✕</button>
            </div>
            <div style={{flex:1,overflowY:"auto"}}>
              {carteiraDetalheModal.items.length===0&&(
                <div style={{padding:40,textAlign:"center",color:MUTED,fontSize:13}}>Nenhum contrato encontrado.</div>
              )}
              {carteiraDetalheModal.items.map((item,i)=>{
                const c=item.contrato;
                const cor=carteiraDetalheModal.cor;
                return(
                  <div key={c.ID_CONTRATO||i} onClick={()=>{setCarteiraDetalheModal(null);setContratoSel(c);}} style={{display:"flex",alignItems:"center",justifyContent:"space-between",padding:"13px 24px",borderBottom:`1px solid ${BD}`,cursor:"pointer",transition:"background 100ms"}} onMouseEnter={e=>e.currentTarget.style.background=BG+"80"} onMouseLeave={e=>e.currentTarget.style.background=""}>
                    <div style={{minWidth:0}}>
                      <div style={{fontWeight:700,fontSize:13,color:TEXT,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{c.NOME_CLIENTE}</div>
                      <div style={{fontSize:11,color:MUTED,marginTop:2,display:"flex",alignItems:"center",gap:6}}>
                        <span>{c.ID_CONTRATO}</span>
                        <span style={{width:3,height:3,borderRadius:"50%",background:MUTED,display:"inline-block"}}/>
                        <span style={{color:STATUS_COR[c.STATUS_CONTRATO]||MUTED,fontWeight:600}}>{STATUS_LABEL[c.STATUS_CONTRATO]||c.STATUS_CONTRATO}</span>
                      </div>
                    </div>
                    <div style={{fontWeight:800,fontSize:14,color:cor,marginLeft:16,flexShrink:0}}>{fmtR(item.valor)}</div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* ── MODAL CONTRATO ── */}
      {contratoSel&&(
        <ContratoModal
          contrato={contratoSel}
          parcelas={parcelas||[]}
          pagamentos={pagamentos||[]}
          clientes={clientes||[]}
          eventos={eventos||[]}
          onRegistrarPagamento={p=>{setContratoSel(null);setPagamentoHoje(p);setPagModo("pagamento");}}
          onReagendar={p=>{setContratoSel(null);setPagamentoHoje(p);setPagModo("reagendar");}}
          onBaixar={c=>{setContratoSel(null);setEncerramentoModal(c);}}
          onQuitacaoAntecipada={c=>{setContratoSel(null);setQuitacaoModal(c);}}
          onAlterarVencimento={()=>carregar(true)}
          onExcluir={()=>{const idC=String(contratoSel?.ID_CONTRATO||"");setContratoSel(null);if(idC)setRaw(prev=>{if(!prev)return prev;return{...prev,CONTRATOS:(prev.CONTRATOS||[]).filter(c=>String(c.ID_CONTRATO)!==idC),PARCELAS:(prev.PARCELAS||[]).filter(p=>String(p.ID_CONTRATO)!==idC)};});carregar();}}
          onAcordoAssistido={c=>{setContratoSel(null);setAcordoAssistModal(c);}}
          onAbatimento={c=>{setContratoSel(null);setAbatimentoAssistModal(c);}}
          onAjuizar={c=>{setContratoSel(null);setAjuizarModal(c);}}
          onRenegociar={c=>{setContratoSel(null);setRenegociacaoModal(c);}}
          onRecuperar={c=>{setContratoSel(null);setRecuperacaoModal(c);}}
          onAcordoJudicial={c=>{setContratoSel(null);setAcordoJudicialModal(c);}}
          onQuitacaoJudicial={c=>{setContratoSel(null);setQuitacaoJudicialModal(c);}}
          onArquivarProcesso={c=>{setContratoSel(null);setArquivarProcessoModal(c);}}
          onVoltarCliente={selCli?()=>setContratoSel(null):undefined}
          onComprovante={(c,ps,cli)=>{
            const _cliObj=(clientes||[]).find(cl=>String(cl.ID_CLIENTE)===String(c.ID_CLIENTE));
            const _tel=normTel(_cliObj?.TELEFONE_WPP||_cliObj?.TELEFONE||"");
            const _allTerminal=ps.length>0&&ps.every(p=>_ST_TERMINAL.has(String(p.STATUS||"").toLowerCase()));
            const _needsQuitacao=_allTerminal&&(c.STATUS_CONTRATO==="renegociado"||ps.some(p=>["pago","quitacao_antecipada"].includes(String(p.STATUS||"").toLowerCase())));
            if(_needsQuitacao){
              const _pagsCont=(pagamentos||[]).filter(p=>String(p.ID_CONTRATO)===String(c.ID_CONTRATO)&&p.TIPO_PAGAMENTO!=="abatimento_acordo_assistido");
              const _totalPagPags=_pagsCont.reduce((s,p)=>s+parseFloat(p.VALOR_PAGO||0),0);
              const _ultPagDate=_pagsCont.reduce((latest,p)=>{const d=parseDate(p.DATA_PAGAMENTO);return d&&(!latest||d>latest)?d:latest;},null);
              gerarComprovante(c,ps,_cliObj,_totalPagPags,_ultPagDate);
              if(_tel)setTimeout(()=>window.open(`https://wa.me/55${_tel}`,"_blank"),700);
              return;
            }
            const _pagas=[...ps].filter(p=>["pago","quitacao_antecipada"].includes(statusEfetivo(p))).sort((a,b)=>parseInt(b.NUM_PARCELA||0)-parseInt(a.NUM_PARCELA||0));
            const _ult=_pagas[0];
            if(_ult){
              const _tLbl={pagamento_normal:"Normal",normal:"Normal",pagamento_com_atraso:"Com Atraso",com_atraso:"Com Atraso",somente_juros:"Somente Juros",quitacao_antecipada:"Quitação Antecipada",pagamento_antecipado:"Antecipado",antecipado:"Antecipado"}[_ult.TIPO_PAGAMENTO]||"Pagamento";
              gerarEEnviarComprovante(_ult,parseFloat(_ult.VALOR_PAGO||0),_ult.DATA_PAGAMENTO,_tLbl,parcelas,contratos,clientes,{wpp:true});
            }else{
              gerarComprovante(c,ps,_cliObj);
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

      {undoAtivo && <UndoToast undo={undoAtivo} onDismiss={()=>setUndoAtivo(null)} onReverter={handleReverterUndo} />}
    </div>
  );
}

createRoot(document.getElementById("root")).render(<App/>);
