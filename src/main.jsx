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
const IcoKpi  = <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/></svg>;
const IcoCal  = <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>;

function Badge({c,children}){ return <span style={{display:"inline-flex",alignItems:"center",padding:"3px 8px",borderRadius:20,fontSize:10,fontWeight:600,background:c+"18",color:c,border:`1px solid ${c}30`}}>{children}</span>; }

// ─── CALENDÁRIO ──────────────────────────────────────────────────
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

// ─── MODAL COBRANÇA ──────────────────────────────────────────────
// Abre ao clicar numa linha da fila de cobrança.
// Coluna esquerda: parcelas em atraso do cliente.
// Coluna direita:  formulário de pagamento para a parcela selecionada.
function CobrancaModal({ cliente, parcelasCliente, onSucesso, onFechar }) {
  const MULTA_PCT   = 10;      // 10% sobre o valor da parcela
  const MORA_DIARIO = 0.033;   // 0.033% ao dia

  const [parcelaSel, setParcelaSel] = useState(null);
  const [tipo, setTipo]             = useState("total");
  const [data, setData]             = useState(hojeStr());
  const [valor, setValor]           = useState("");
  const [loading, setLoading]       = useState(false);
  const [msg, setMsg]               = useState(null);
  const [pagoIds, setPagoIds]       = useState(new Set());

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
      setMsg({ ok: true, t: res.msg || "Pagamento registrado com sucesso!" });
      setPagoIds(prev => new Set([...prev, parcelaSel.ID_PARCELA]));
      setTimeout(() => { setParcelaSel(null); setMsg(null); onSucesso(); }, 1400);
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
    <div
      style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.55)",zIndex:300,display:"flex",alignItems:"center",justifyContent:"center",padding:16}}
      onClick={onFechar}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{background:BG,borderRadius:16,width:"100%",maxWidth:860,maxHeight:"92vh",display:"flex",flexDirection:"column",boxShadow:"0 30px 90px rgba(0,0,0,0.3)",overflow:"hidden"}}
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
              <div style={{fontSize:20,fontWeight:900,color:RED,letterSpacing:"-0.5px"}}>{fmtR(totalAtraso)}</div>
            </div>
            <button onClick={onFechar} style={{background:BG,border:`1px solid ${BD}`,width:34,height:34,borderRadius:8,cursor:"pointer",fontSize:18,color:MUTED,display:"flex",alignItems:"center",justifyContent:"center",fontWeight:700}}>×</button>
          </div>
        </div>

        {/* BODY — 2 colunas */}
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",flex:1,overflow:"hidden",minHeight:0}}>

          {/* COLUNA ESQUERDA — parcelas em atraso */}
          <div style={{overflowY:"auto",padding:18,borderRight:`1px solid ${BD}`}}>
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
                      style={{padding:14,borderRadius:10,border:`2px solid ${isSel ? BLU : BD}`,background:isSel ? BLU+"08" : CARD,cursor:"pointer",transition:"border-color 0.15s, background 0.15s"}}
                      onMouseEnter={e => { if(!isSel) e.currentTarget.style.borderColor = BLU+"60"; }}
                      onMouseLeave={e => { if(!isSel) e.currentTarget.style.borderColor = BD; }}
                    >
                      <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:8}}>
                        <div>
                          <div style={{fontSize:12,fontWeight:800,color:isSel ? BLU : TEXT}}>
                            {p.ID_CONTRATO} · Parcela {p.NUM_PARCELA}/{p.TOTAL_PARCELAS}
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
                        <div style={{marginTop:8,fontSize:11,color:BLU,fontWeight:700}}>✓ Selecionada — preencha o formulário ao lado</div>
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
            ) : (
              <div style={{display:"flex",flexDirection:"column",gap:16}}>
                <div style={{fontSize:14,fontWeight:800,color:TEXT}}>Registrar Pagamento</div>

                {/* Resumo da parcela selecionada */}
                {(() => {
                  const { vOrig, multa, mora, total } = calcComAtraso(parcelaSel);
                  const temAtraso = parcelaSel.DIAS_ATRASO > 0;
                  return (
                    <div style={{background:BLU+"06",border:`1px solid ${BLU}25`,borderRadius:10,padding:14}}>
                      <div style={{fontSize:11,fontWeight:700,color:BLU,marginBottom:10}}>
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
                  <span style={LS}>Tipo de Pagamento</span>
                  <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8}}>
                    {[
                      { v:"total",         l:"💰 Pagamento Total",   sub:"Valor original da parcela" },
                      { v:"com_atraso",    l:"⏰ Total + Encargos",  sub:"Multa + juros de mora" },
                      { v:"somente_juros", l:"💸 Somente Juros",     sub:"Principal rolado p/ nova parcela" },
                      { v:"personalizado", l:"✏️ Personalizado",     sub:"Informe o valor manualmente" },
                    ].map(op => (
                      <div
                        key={op.v}
                        onClick={() => changeTipo(op.v)}
                        style={{padding:"10px 12px",borderRadius:8,border:`2px solid ${tipo === op.v ? BLU : BD}`,background:tipo === op.v ? BLU+"08" : CARD,cursor:"pointer",textAlign:"center",transition:"all 0.15s"}}
                      >
                        <div style={{fontSize:12,fontWeight:700,color:tipo === op.v ? BLU : TEXT}}>{op.l}</div>
                        <div style={{fontSize:10,color:MUTED,marginTop:2}}>{op.sub}</div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Valor */}
                <div>
                  <span style={LS}>Valor (R$)</span>
                  <input
                    type="number"
                    value={valor}
                    onChange={e => setValor(e.target.value)}
                    style={{...IS, fontSize:20, fontWeight:800, textAlign:"center", height:52}}
                    readOnly={tipo !== "personalizado" && tipo !== "com_atraso"}
                    onFocus={() => setTipo("personalizado")}
                  />
                  {tipo === "personalizado" && (
                    <div style={{marginTop:4,fontSize:11,color:MUTED}}>Valor livre — será registrado como informado.</div>
                  )}
                </div>

                {/* Data */}
                <div>
                  <span style={LS}>Data do Pagamento</span>
                  <input type="date" value={data} onChange={e => setData(e.target.value)} style={IS}/>
                </div>

                {/* Feedback */}
                {msg && (
                  <div style={{padding:"10px 14px",borderRadius:8,background:msg.ok ? GRN+"10" : RED+"10",color:msg.ok ? GRN : RED,fontSize:13,fontWeight:700,textAlign:"center",border:`1px solid ${msg.ok ? GRN : RED}25`}}>
                    {msg.ok ? "✓ " : "⚠ "}{msg.t}
                  </div>
                )}

                {/* Botão confirmar */}
                <button
                  onClick={registrar}
                  disabled={loading || !valor || !data || parseFloat(valor) <= 0}
                  style={{padding:"13px",borderRadius:9,border:"none",background:GRN,color:"#FFF",fontWeight:800,cursor:"pointer",fontSize:14,opacity:loading || !valor || !data || parseFloat(valor) <= 0 ? 0.6 : 1,transition:"opacity 0.15s"}}
                >
                  {loading ? "Registrando..." : "✓ Confirmar Pagamento"}
                </button>

                <button
                  onClick={() => setParcelaSel(null)}
                  style={{padding:"9px",borderRadius:8,border:`1px solid ${BD}`,background:CARD,cursor:"pointer",fontSize:12,color:MUTED,fontWeight:600}}
                >
                  ← Escolher outra parcela
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
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
    <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.6)",zIndex:500,display:"flex",alignItems:"center",justifyContent:"center",padding:20}}>
      <div style={{background:"#FFF",borderRadius:16,width:"100%",maxWidth:520,padding:24,boxShadow:"0 20px 50px rgba(0,0,0,0.3)",maxHeight:"90vh",overflowY:"auto"}}>
        <h2 style={{margin:"0 0 4px",color:"#0891B2",fontSize:18,fontWeight:800}}>🤝 Acordo com Perda</h2>
        <p style={{fontSize:13,color:MUTED,marginBottom:20}}>Contrato: <strong>{contrato.ID_CONTRATO}</strong> · {contrato.NOME_CLIENTE}</p>

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
          <span style={LS}>Valor Recebido no Acordo (R$)</span>
          <input type="number" value={valorAcordo} onChange={e=>setValorAcordo(e.target.value)} placeholder="0.00" style={{...IS,fontSize:20,fontWeight:800,height:52,textAlign:"center"}}/>
        </div>

        {/* Preview contábil — aparece ao digitar valor */}
        {vAcordo>0&&(
          <div style={{background:"#F0FDF4",border:`1px solid ${GRN}40`,borderRadius:10,padding:14,marginBottom:16}}>
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
          <div><span style={LS}>Forma</span><select value={forma} onChange={e=>setForma(e.target.value)} style={IS}><option value="dinheiro">Dinheiro</option><option value="pix">PIX</option><option value="transferencia">Transferência</option></select></div>
          <div><span style={LS}>Observação</span><input value={observacao} onChange={e=>setObservacao(e.target.value)} placeholder="Opcional" style={IS}/></div>
        </div>

        {msg&&<div style={{marginBottom:12,padding:10,borderRadius:8,background:RED+"10",color:RED,fontSize:13,textAlign:"center",fontWeight:600}}>{msg}</div>}

        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12}}>
          <button onClick={onFechar} style={{padding:12,borderRadius:8,border:`1px solid ${BD}`,background:"none",cursor:"pointer",fontWeight:600}}>Cancelar</button>
          <button onClick={confirmar} disabled={loading||vAcordo<=0} style={{padding:12,borderRadius:8,border:"none",background:"#0891B2",color:"#FFF",fontWeight:700,cursor:"pointer",opacity:loading||vAcordo<=0?0.7:1}}>{loading?"Processando...":"Confirmar Acordo"}</button>
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
      setTimeout(()=>onConfirmar(), 1800);
    } else {
      setMsg({ok:false, t:res.erro||"Erro ao processar."});
    }
    setLoading(false);
  };

  return(
    <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.6)",zIndex:500,display:"flex",alignItems:"center",justifyContent:"center",padding:16}} onClick={onFechar}>
      <div onClick={e=>e.stopPropagation()} style={{background:BG,borderRadius:16,width:"100%",maxWidth:620,maxHeight:"92vh",display:"flex",flexDirection:"column",boxShadow:"0 30px 80px rgba(0,0,0,0.3)",overflow:"hidden"}}>

        {/* Header */}
        <div style={{background:CARD,padding:"18px 22px",borderBottom:`1px solid ${BD}`,display:"flex",justifyContent:"space-between",alignItems:"center"}}>
          <div>
            <div style={{fontSize:16,fontWeight:800}}>⚡ Quitação Antecipada</div>
            <div style={{fontSize:12,color:MUTED,marginTop:3}}>{contrato.ID_CONTRATO} · {contrato.NOME_CLIENTE}</div>
          </div>
          <button onClick={onFechar} style={{background:BG,border:`1px solid ${BD}`,width:32,height:32,borderRadius:8,cursor:"pointer",fontSize:18,color:MUTED}}>×</button>
        </div>

        <div style={{flex:1,overflowY:"auto",padding:20,display:"flex",flexDirection:"column",gap:16}}>

          {/* Lista de parcelas */}
          <div>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:10}}>
              <span style={{fontSize:11,fontWeight:700,color:MUTED,textTransform:"uppercase"}}>Parcelas em Aberto ({abertas.length})</span>
              <button onClick={toggleTodas} style={{fontSize:11,fontWeight:700,color:BLU,background:"none",border:`1px solid ${BLU}30`,borderRadius:6,padding:"4px 10px",cursor:"pointer"}}>
                {todasSel?"Desmarcar todas":"Selecionar todas"}
              </button>
            </div>
            {abertas.length===0
              ? <div style={{padding:12,background:GRN+"08",borderRadius:8,color:GRN,fontSize:13,fontWeight:700}}>Nenhuma parcela em aberto.</div>
              : <div style={{display:"flex",flexDirection:"column",gap:6}}>
                  {abertas.map(p=>{
                    const sel = selecionadas.has(p.ID_PARCELA);
                    const stCor = {pendente:BLU,atrasado:RED,vence_hoje:ORG}[String(p.STATUS||"").toLowerCase()]||MUTED;
                    return(
                      <div key={p.ID_PARCELA} onClick={()=>toggle(p.ID_PARCELA)}
                        style={{display:"flex",alignItems:"center",gap:12,padding:"10px 14px",borderRadius:9,border:`2px solid ${sel?BLU:BD}`,background:sel?BLU+"06":CARD,cursor:"pointer",transition:"all 0.12s"}}
                      >
                        <div style={{width:18,height:18,borderRadius:5,border:`2px solid ${sel?BLU:BD}`,background:sel?BLU:"transparent",display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}}>
                          {sel&&<svg width="10" height="10" viewBox="0 0 10 10"><polyline points="1.5,5 4,7.5 8.5,2" fill="none" stroke="#fff" strokeWidth="1.8"/></svg>}
                        </div>
                        <div style={{flex:1,display:"flex",justifyContent:"space-between",alignItems:"center",minWidth:0}}>
                          <div>
                            <div style={{fontSize:12,fontWeight:700}}>Parcela {p.NUM_PARCELA}/{p.TOTAL_PARCELAS} · venc. {fmtDt(p.DATA_VENCIMENTO)}</div>
                            <div style={{fontSize:11,color:MUTED,marginTop:2}}>Principal: {fmtR(p.VALOR_PRINCIPAL||0)} · Juros: {fmtR(p.VALOR_JUROS||0)}</div>
                          </div>
                          <div style={{textAlign:"right",flexShrink:0}}>
                            <div style={{fontSize:13,fontWeight:800}}>{fmtR(p.VALOR_PARCELA||0)}</div>
                            <Badge c={stCor}>{String(p.STATUS||"pendente")}</Badge>
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
              <span style={LS}>Desconto nos Juros (R$)</span>
              <input type="number" value={desconto} onChange={e=>setDesconto(e.target.value)} placeholder="0.00" min="0" max={totalJuros} style={IS}/>
              {totalJuros>0&&<div style={{fontSize:10,color:MUTED,marginTop:3}}>Máx: {fmtR(totalJuros)}</div>}
            </div>
            <div>
              <span style={LS}>Forma de Pagamento</span>
              <select value={forma} onChange={e=>setForma(e.target.value)} style={IS}>
                <option value="dinheiro">Dinheiro</option>
                <option value="pix">PIX</option>
                <option value="transferencia">Transferência</option>
              </select>
            </div>
            <div style={{gridColumn:"1/-1"}}>
              <span style={LS}>Observação</span>
              <input value={observacao} onChange={e=>setObservacao(e.target.value)} placeholder="Opcional" style={IS}/>
            </div>
          </div>

          {/* Preview */}
          {parcelasSel.length>0&&(
            <div style={{background:BLU+"06",border:`1px solid ${BLU}25`,borderRadius:10,padding:14}}>
              <div style={{fontSize:11,fontWeight:700,color:BLU,marginBottom:10,textTransform:"uppercase"}}>Resumo — {parcelasSel.length} parcela(s)</div>
              <div style={{display:"flex",flexDirection:"column",gap:7}}>
                <div style={{display:"flex",justifyContent:"space-between",fontSize:13}}><span style={{color:MUTED}}>Principal</span><strong>{fmtR(totalPrincipal)}</strong></div>
                <div style={{display:"flex",justifyContent:"space-between",fontSize:13}}><span style={{color:MUTED}}>Juros originais</span><strong>{fmtR(totalJuros)}</strong></div>
                {descontoNum>0&&<div style={{display:"flex",justifyContent:"space-between",fontSize:13}}><span style={{color:GRN}}>Desconto concedido</span><strong style={{color:GRN}}>− {fmtR(descontoNum)}</strong></div>}
                <div style={{borderTop:`1px solid ${BLU}20`,paddingTop:8,display:"flex",justifyContent:"space-between",fontSize:15}}>
                  <span style={{fontWeight:700}}>Total a Receber</span>
                  <strong style={{color:BLU,fontSize:17}}>{fmtR(totalCobrar)}</strong>
                </div>
                {todasSel&&<div style={{fontSize:11,color:GRN,fontWeight:700}}>✓ Todas as parcelas selecionadas → contrato será marcado como <strong>Quitado</strong></div>}
              </div>
            </div>
          )}

          {msg&&(
            <div style={{padding:"10px 14px",borderRadius:8,background:msg.ok?GRN+"10":RED+"10",color:msg.ok?GRN:RED,fontSize:13,fontWeight:700,textAlign:"center",border:`1px solid ${msg.ok?GRN:RED}25`}}>
              {msg.ok?"✓ ":"⚠ "}{msg.t}
            </div>
          )}
        </div>

        {/* Footer */}
        <div style={{padding:"14px 20px",borderTop:`1px solid ${BD}`,background:CARD,display:"flex",gap:12}}>
          <button onClick={onFechar} style={{flex:1,padding:12,borderRadius:8,border:`1px solid ${BD}`,background:CARD,cursor:"pointer",fontWeight:600,color:MUTED}}>Cancelar</button>
          <button onClick={confirmar} disabled={loading||selecionadas.size===0} style={{flex:2,padding:12,borderRadius:8,border:"none",background:BLU,color:"#FFF",fontWeight:800,cursor:"pointer",fontSize:14,opacity:loading||selecionadas.size===0?0.6:1}}>
            {loading?"Processando...":"⚡ Confirmar Quitação"}
          </button>
        </div>
      </div>
    </div>
  );
}

function RecuperacaoModal({contrato,onConfirmar,onFechar}){
  const [valor,setValor]=useState("");const [loading,setLoading]=useState(false);const [msg,setMsg]=useState(null);
  const confirmar=async()=>{
    if(!valor)return;setLoading(true);setMsg(null);
    const res=await postAction({action:"recuperacaoAposBaixa",idContrato:contrato.ID_CONTRATO,dados:{valorPago:parseFloat(valor),data:hojeStr()}});
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

function ClienteModal({cliente,onFechar,onAtualizar}){
  const [t,setT]=useState("perfil");
  const [edit,setEdit]=useState({
    NOME:         cliente.NOME||cliente.NOME_CLIENTE||"",
    TELEFONE_WPP: cliente.TELEFONE_WPP||cliente.TELEFONE||"",
    EMAIL:        cliente.EMAIL||"",
    CPF:          cliente.CPF||"",
    RG:           cliente.RG||"",
    PROFISSAO:    cliente.PROFISSAO||"",
    ESTADO_CIVIL: cliente.ESTADO_CIVIL||"",
    NACIONALIDADE:cliente.NACIONALIDADE||"",
    SCORE:        cliente.SCORE||"",
    STATUS_CLIENTE:cliente.STATUS_CLIENTE||"ativo",
    DIA_VENCIMENTO_PREFERIDO:cliente.DIA_VENCIMENTO_PREFERIDO||"",
    CONTATO_CONFIANCA_1: cliente.CONTATO_CONFIANCA_1||"",
    TEL_CONFIANCA_1:     cliente.TEL_CONFIANCA_1||"",
    CONTATO_CONFIANCA_2: cliente.CONTATO_CONFIANCA_2||"",
    TEL_CONFIANCA_2:     cliente.TEL_CONFIANCA_2||"",
    PADRINHO:     cliente.PADRINHO||"",
    TEL_PADRINHO: cliente.TEL_PADRINHO||"",
    OBSERVACOES:  cliente.OBSERVACOES||"",
  });
  const [saving,setSaving]=useState(false);
  const [saveMsg,setSaveMsg]=useState(null);

  const nome=cliente.NOME_CLIENTE||cliente.NOME||cliente.CLIENTE||"Cliente sem nome";
  const tel=cliente.TELEFONE||cliente.TELEFONE_WPP||cliente.WHATSAPP||"—";
  const score=cliente.SCORE||cliente.SCORE_CLIENTE||cliente.SCORE_SERASA||"Não informado";
  const label=k=>String(k).replaceAll("_"," ").toLowerCase().replace(/\b\w/g,m=>m.toUpperCase());
  const campos=Object.entries(cliente||{}).filter(([_,v])=>v!==null&&v!==undefined&&String(v).trim()!=="");

  const salvar=async()=>{
    setSaving(true);setSaveMsg(null);
    const res=await postAction({action:"atualizarCliente",idCliente:cliente.ID_CLIENTE,campos:edit});
    if(res.ok){setSaveMsg({ok:true,t:"Dados atualizados com sucesso!"});if(onAtualizar)setTimeout(onAtualizar,1200);}
    else setSaveMsg({ok:false,t:res.erro||"Erro ao salvar."});
    setSaving(false);
  };

  const Campo=({label:lb,field,tipo="text",opts})=>(
    <div>
      <span style={LS}>{lb}</span>
      {opts
        ?<select value={edit[field]||""} onChange={e=>setEdit(p=>({...p,[field]:e.target.value}))} style={IS}>
            {opts.map(o=><option key={o.v} value={o.v}>{o.l}</option>)}
          </select>
        :<input type={tipo} value={edit[field]||""} onChange={e=>setEdit(p=>({...p,[field]:e.target.value}))} style={IS}/>
      }
    </div>
  );

  return(
    <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.5)",zIndex:300,display:"flex",alignItems:"center",justifyContent:"center",padding:20}}>
      <div style={{background:BG,borderRadius:16,width:"100%",maxWidth:980,height:"86vh",display:"flex",flexDirection:"column",overflow:"hidden",boxShadow:"0 30px 90px rgba(0,0,0,0.3)"}}>
        <div style={{background:CARD,padding:20,borderBottom:`1px solid ${BD}`,display:"flex",justifyContent:"space-between",alignItems:"center"}}>
          <div style={{display:"flex",alignItems:"center",gap:16}}><div style={{width:44,height:44,background:BLU,borderRadius:12,display:"flex",alignItems:"center",justifyContent:"center",color:"#FFF",fontSize:18,fontWeight:800}}>{nome[0]||"?"}</div><div><h2 style={{margin:0,fontSize:18,fontWeight:800}}>{nome}</h2><div style={{fontSize:12,color:MUTED}}>ID {cliente.ID_CLIENTE||"—"} · Score: {score}</div></div></div>
          <button onClick={onFechar} style={{background:BG,border:"none",width:32,height:32,borderRadius:8,cursor:"pointer"}}>×</button>
        </div>
        <div style={{display:"flex",background:CARD,padding:"0 20px",borderBottom:`1px solid ${BD}`,gap:20}}>
          {["perfil","editar","todos os dados"].map(tab=><button key={tab} onClick={()=>{setT(tab);setSaveMsg(null);}} style={{padding:"14px 4px",background:"none",border:"none",borderBottom:t===tab?`2px solid ${BLU}`:"2px solid transparent",color:t===tab?BLU:MUTED,fontWeight:600,cursor:"pointer",fontSize:13,textTransform:"capitalize"}}>{tab}</button>)}
        </div>
        <div style={{flex:1,overflowY:"auto",padding:20}}>
          {t==="perfil"&&(
            <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:16}}>
              {[
                {l:"Nome",v:nome},{l:"Score",v:score},{l:"CPF",v:cliente.CPF},{l:"RG",v:cliente.RG},{l:"Telefone/WhatsApp",v:tel},{l:"Email",v:cliente.EMAIL},
                {l:"Status",v:cliente.STATUS_CLIENTE},{l:"Profissão",v:cliente.PROFISSAO},{l:"Estado civil",v:cliente.ESTADO_CIVIL},{l:"Nacionalidade",v:cliente.NACIONALIDADE},
                {l:"Endereço",v:[cliente.RUA,cliente.NUMERO,cliente.QUADRA&&`Qd. ${cliente.QUADRA}`,cliente.LOTE&&`Lt. ${cliente.LOTE}`,cliente.SETOR,cliente.CIDADE_ESTADO].filter(Boolean).join(", ")},
                {l:"CEP",v:cliente.CEP},{l:"Contato confiança 1",v:[cliente.CONTATO_CONFIANCA_1,cliente.TEL_CONFIANCA_1].filter(Boolean).join(" · ")},
                {l:"Contato confiança 2",v:[cliente.CONTATO_CONFIANCA_2,cliente.TEL_CONFIANCA_2].filter(Boolean).join(" · ")},{l:"Padrinho",v:[cliente.PADRINHO,cliente.TEL_PADRINHO].filter(Boolean).join(" · ")},
                {l:"Vencimento preferido",v:cliente.DIA_VENCIMENTO_PREFERIDO},{l:"Cadastro",v:fmtDt(cliente.DATA_CADASTRO)},{l:"Observações",v:cliente.OBSERVACOES}
              ].map(i=><div key={i.l} style={{background:CARD,padding:15,borderRadius:10,border:`1px solid ${BD}`,gridColumn:i.l==="Endereço"||i.l==="Observações"?"1/-1":"auto"}}><span style={LS}>{i.l}</span><div style={{fontSize:13,fontWeight:600,wordBreak:"break-word"}}>{i.v||"—"}</div></div>)}
            </div>
          )}
          {t==="editar"&&(
            <div style={{display:"flex",flexDirection:"column",gap:20,maxWidth:720}}>
              <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:14}}>
                <Campo label="Nome completo" field="NOME"/>
                <Campo label="Telefone/WhatsApp" field="TELEFONE_WPP"/>
                <Campo label="Email" field="EMAIL" tipo="email"/>
                <Campo label="CPF" field="CPF"/>
                <Campo label="RG" field="RG"/>
                <Campo label="Profissão" field="PROFISSAO"/>
                <Campo label="Estado Civil" field="ESTADO_CIVIL" opts={[{v:"",l:"—"},{v:"Solteiro(a)",l:"Solteiro(a)"},{v:"Casado(a)",l:"Casado(a)"},{v:"Divorciado(a)",l:"Divorciado(a)"},{v:"Viúvo(a)",l:"Viúvo(a)"},{v:"União Estável",l:"União Estável"}]}/>
                <Campo label="Nacionalidade" field="NACIONALIDADE"/>
                <Campo label="Score" field="SCORE"/>
                <Campo label="Status" field="STATUS_CLIENTE" opts={[{v:"ativo",l:"Ativo"},{v:"inativo",l:"Inativo"},{v:"aguardando_conferencia",l:"Aguardando Conferência"},{v:"bloqueado",l:"Bloqueado"}]}/>
                <Campo label="Dia vencimento preferido" field="DIA_VENCIMENTO_PREFERIDO"/>
              </div>
              <div style={{borderTop:`1px solid ${BD}`,paddingTop:16}}>
                <div style={{fontSize:11,fontWeight:700,color:MUTED,textTransform:"uppercase",marginBottom:12}}>Contatos de Confiança</div>
                <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:14}}>
                  <Campo label="Contato confiança 1" field="CONTATO_CONFIANCA_1"/>
                  <Campo label="Telefone confiança 1" field="TEL_CONFIANCA_1"/>
                  <Campo label="Contato confiança 2" field="CONTATO_CONFIANCA_2"/>
                  <Campo label="Telefone confiança 2" field="TEL_CONFIANCA_2"/>
                  <Campo label="Padrinho" field="PADRINHO"/>
                  <Campo label="Tel. Padrinho" field="TEL_PADRINHO"/>
                </div>
              </div>
              <div>
                <span style={LS}>Observações</span>
                <textarea value={edit.OBSERVACOES} onChange={e=>setEdit(p=>({...p,OBSERVACOES:e.target.value}))} style={{...IS,height:80,resize:"none"}}/>
              </div>
              {saveMsg&&(
                <div style={{padding:"10px 14px",borderRadius:8,background:saveMsg.ok?GRN+"10":RED+"10",color:saveMsg.ok?GRN:RED,fontSize:13,fontWeight:700,border:`1px solid ${saveMsg.ok?GRN:RED}25`}}>
                  {saveMsg.ok?"✓ ":"⚠ "}{saveMsg.t}
                </div>
              )}
              <button onClick={salvar} disabled={saving} style={{padding:"13px",borderRadius:9,border:"none",background:BLU,color:"#FFF",fontWeight:800,cursor:"pointer",fontSize:14,opacity:saving?0.6:1}}>
                {saving?"Salvando...":"💾 Salvar Alterações"}
              </button>
            </div>
          )}
          {t==="todos os dados"&&(
            <div style={{display:"grid",gridTemplateColumns:"repeat(2,1fr)",gap:12}}>{campos.map(([k,v])=><div key={k} style={{background:CARD,padding:13,borderRadius:10,border:`1px solid ${BD}`}}><span style={LS}>{label(k)}</span><div style={{fontSize:13,fontWeight:600,wordBreak:"break-word"}}>{String(v)}</div></div>)}</div>
          )}
        </div>
      </div>
    </div>
  );
}

function PagamentoDrop({contratos,parcelas,onSucesso,onSelecionarParcela}){
  const [busca,setBusca]=useState("");const [showDrop,setShowDrop]=useState(false);const [cliente,setCliente]=useState(null);const [parcela,setParcela]=useState(null);const [tipo,setTipo]=useState(null);const [data,setData]=useState(hojeStr());const [valor,setValor]=useState("");const [loading,setLoading]=useState(false);const [msg,setMsg]=useState(null);const ref=useRef();
  useEffect(()=>{const h=e=>{if(ref.current&&!ref.current.contains(e.target))setShowDrop(false);};document.addEventListener("mousedown",h);return()=>document.removeEventListener("mousedown",h);},[]);
  const clis=useMemo(()=>{if(busca.length<2)return[];const ids=new Set();return (contratos||[]).filter(c=>{const m=(c.NOME_CLIENTE||"").toLowerCase().includes(busca.toLowerCase())||String(c.ID_CLIENTE||"").toLowerCase().includes(busca.toLowerCase());if(m&&!ids.has(c.ID_CLIENTE)){ids.add(c.ID_CLIENTE);return true;}return false;}).slice(0,6);},[busca,contratos]);
  const pars=useMemo(()=>cliente?(parcelas||[]).filter(p=>String(p.ID_CLIENTE)===String(cliente.ID_CLIENTE)&&["pendente","atrasado","vence_hoje"].includes(p.STATUS)).sort((a,b)=>toNum(a.DATA_VENCIMENTO)-toNum(b.DATA_VENCIMENTO)):[],[cliente,parcelas]);
  const registrar=async()=>{if(!parcela||!valor||!data)return;setLoading(true);setMsg(null);const res=await postAction({action:tipo==="parcial"?"pagamentoParcial":"pagamento",idParcela:parcela.ID_PARCELA,valor:parseFloat(valor),data:apiDateStr(data),forma:"dinheiro"});if(res.ok){setMsg({ok:true,t:res.msg||"Sucesso!"});setTimeout(onSucesso,1500);}else setMsg({ok:false,t:res.erro||"Erro"});setLoading(false);};
  const selecionarParcela=p=>{if(!p)return;if(onSelecionarParcela){setParcela(null);setTipo(null);setValor("");onSelecionarParcela(p);return;}setParcela(p);setTipo("total");setValor(p.VALOR_PARCELA);};
  return(
    <div style={{background:CARD,borderRadius:12,padding:20,border:`1px solid ${BD}`}}>
      <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:16}}><div style={{background:GRN+"15",color:GRN,padding:8,borderRadius:8}}>{IcoPag}</div><h3 style={{margin:0,fontSize:15,fontWeight:700}}>Registrar Pagamento</h3></div>
      <div style={{display:"flex",flexDirection:"column",gap:12}}>
        <div style={{position:"relative"}} ref={ref}>
          <span style={LS}>Buscar Cliente</span>
          <div style={{position:"relative"}}><div style={{position:"absolute",left:10,top:"50%",transform:"translateY(-50%)"}}>{IcoSrch}</div><input value={cliente?cliente.NOME_CLIENTE:busca} onChange={e=>{setBusca(e.target.value);setCliente(null);setParcela(null);setShowDrop(true);}} onFocus={()=>setShowDrop(true)} placeholder="Nome ou ID..." style={{...IS,paddingLeft:32}}/>{cliente&&<button onClick={()=>{setCliente(null);setBusca("");}} style={{position:"absolute",right:8,top:"50%",transform:"translateY(-50%)",border:"none",background:"none",cursor:"pointer",color:MUTED,fontSize:16}}>×</button>}</div>
          {showDrop&&clis.length>0&&<div style={{position:"absolute",top:"100%",left:0,right:0,background:CARD,border:`1px solid ${BD}`,borderRadius:8,marginTop:4,zIndex:100,boxShadow:"0 10px 30px rgba(0,0,0,0.1)"}}>{clis.map(c=><div key={c.ID_CLIENTE} onClick={()=>{setCliente(c);setShowDrop(false);}} style={{padding:"10px 14px",cursor:"pointer",fontSize:13,borderBottom:`1px solid ${BG}`}} onMouseEnter={e=>e.currentTarget.style.background=BG} onMouseLeave={e=>e.currentTarget.style.background=CARD}><strong>{c.ID_CLIENTE}</strong> - {c.NOME_CLIENTE}</div>)}</div>}
        </div>
        {cliente&&<div><span style={LS}>Parcela</span>{pars.length>0?<select value={onSelecionarParcela?"":(parcela?.ID_PARCELA||"")} onChange={e=>{const p=pars.find(x=>String(x.ID_PARCELA)===String(e.target.value));selecionarParcela(p);}} style={IS}><option value="">Selecione...</option>{pars.map(p=><option key={p.ID_PARCELA} value={p.ID_PARCELA}>Parc {p.NUM_PARCELA} ({fmtDt(p.DATA_VENCIMENTO)}) - {fmtR(p.VALOR_PARCELA)}</option>)}</select>:<div style={{padding:8,background:RED+"08",color:RED,fontSize:12,borderRadius:6}}>Nenhuma parcela pendente.</div>}</div>}
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
  const registrar=async()=>{if(!parcela||!valor||!data)return;setLoading(true);setMsg(null);const res=await postAction({action:tipo==="parcial"?"pagamentoParcial":"pagamento",idParcela:parcela.ID_PARCELA,valor:parseFloat(valor),data:apiDateStr(data),forma:"dinheiro"});if(res.ok){setMsg({ok:true,t:res.msg||"Pagamento registrado!"});setTimeout(onConfirmar,900);}else setMsg({ok:false,t:res.erro||"Erro ao registrar pagamento"});setLoading(false);};
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
  const criar=async()=>{if(!cliente||!principal||!nParcelas||!taxa||!dtEmp||!dtVenc)return;setLoading(true);setMsg(null);const res=await postAction({action:"novoContrato",dados:{idCliente:cliente.ID_CLIENTE,nomeCliente:cliente.NOME_CLIENTE,principal,parcelas:nParcelas,taxa,dataEmprestimo:apiDateStr(dtEmp),dataVencimento:apiDateStr(dtVenc)}});if(res.ok){setMsg({ok:true,t:"Contrato criado!"});setTimeout(onSucesso,1500);}else setMsg({ok:false,t:res.erro||"Erro"});setLoading(false);};
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

// ─── MODAL CONTRATO ──────────────────────────────────────────────
function ContratoModal({ contrato, parcelas, pagamentos, onRegistrarPagamento, onBaixar, onQuitacaoAntecipada, onFechar }) {
  const [abaM, setAbaM] = useState("parcelas");

  const ps = (parcelas||[])
    .filter(p => String(p.ID_CONTRATO) === String(contrato.ID_CONTRATO))
    .sort((a,b) => parseInt(a.NUM_PARCELA||0) - parseInt(b.NUM_PARCELA||0));

  const pags = (pagamentos||[])
    .filter(p => String(p.ID_CONTRATO) === String(contrato.ID_CONTRATO))
    .sort((a,b) => toNum(b.DATA_PAGAMENTO) - toNum(a.DATA_PAGAMENTO));

  const totalPagoParcelas = ps.filter(p=>["pago","quitacao_antecipada"].includes(String(p.STATUS||p.STATUS_PAGAMENTO||"").toLowerCase())).reduce((s,p)=>s+parseFloat(p.VALOR_PAGO||0),0);
  const totalPagoPagamentos = pags.reduce((s,p) => s + parseFloat(p.VALOR_PAGO||0), 0);
  const totalPago = totalPagoParcelas > totalPagoPagamentos ? totalPagoParcelas : totalPagoPagamentos;
  const pendentes    = ps.filter(p => !["pago","baixado_como_prejuizo","cancelado"].includes(String(p.STATUS||p.STATUS_PAGAMENTO||"").toLowerCase()));
  const pct          = parseFloat(contrato.VALOR_PRINCIPAL||0) > 0
    ? (totalPago / parseFloat(contrato.VALOR_TOTAL||contrato.VALOR_PRINCIPAL||1)) * 100 : 0;

  const stCor = { pago:GRN, pendente:BLU, atrasado:YEL, vence_hoje:ORG, baixado_como_prejuizo:RED, cancelado:MUTED };
  const stLabel = { pago:"Pago", pendente:"Pendente", atrasado:"Atrasado", vence_hoje:"Vence Hoje", baixado_como_prejuizo:"Baixado", cancelado:"Cancelado" };
  const podeRegistrar = !["baixado_como_prejuizo","quitado","cancelado","recuperado_integralmente"].includes(contrato.STATUS_CONTRATO);
  const podeBaixar    = !["baixado_como_prejuizo","quitado","cancelado","recuperado_integralmente","recuperado_parcialmente"].includes(contrato.STATUS_CONTRATO);
  const tipoPagLabel  = { pagamento_normal:"Normal", pagamento_com_atraso:"Com Atraso", somente_juros:"Só Juros", recuperacao_apos_baixa:"Recuperação", pagamento_antecipado:"Antecipado" };
  const tipoPagCor    = { pagamento_normal:GRN, pagamento_com_atraso:YEL, somente_juros:RED, recuperacao_apos_baixa:PUR, pagamento_antecipado:BLU };

  return (
    <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.55)",zIndex:300,display:"flex",alignItems:"center",justifyContent:"center",padding:16}} onClick={onFechar}>
      <div onClick={e=>e.stopPropagation()} style={{background:BG,borderRadius:16,width:"100%",maxWidth:900,maxHeight:"92vh",display:"flex",flexDirection:"column",boxShadow:"0 30px 90px rgba(0,0,0,0.3)",overflow:"hidden"}}>

        {/* HEADER */}
        <div style={{background:CARD,padding:"18px 22px",borderBottom:`1px solid ${BD}`,display:"flex",justifyContent:"space-between",alignItems:"flex-start",gap:12}}>
          <div>
            <div style={{fontSize:18,fontWeight:900,letterSpacing:"-0.5px"}}>{contrato.ID_CONTRATO}</div>
            <div style={{fontSize:13,color:MUTED,marginTop:3}}>{contrato.NOME_CLIENTE} · Empréstimo: {fmtDt(contrato.DATA_EMPRESTIMO)}</div>
          </div>
          <div style={{display:"flex",alignItems:"center",gap:10}}>
            <Badge c={STATUS_COR[contrato.STATUS_CONTRATO]||MUTED}>{STATUS_LABEL[contrato.STATUS_CONTRATO]||contrato.STATUS_CONTRATO}</Badge>
            <button onClick={onFechar} style={{background:BG,border:`1px solid ${BD}`,width:32,height:32,borderRadius:8,cursor:"pointer",fontSize:18,color:MUTED,display:"flex",alignItems:"center",justifyContent:"center",fontWeight:700}}>×</button>
          </div>
        </div>

        {/* KPIs */}
        <div style={{display:"grid",gridTemplateColumns:"repeat(5,1fr)",borderBottom:`1px solid ${BD}`,background:CARD}}>
          {[
            {l:"Principal",      v:fmtR(contrato.VALOR_PRINCIPAL),  c:TEXT},
            {l:"Total c/ Juros", v:fmtR(contrato.VALOR_TOTAL||contrato.VALOR_TOTAL_FINAL),      c:TEXT},
            {l:"Parcelas",       v:`${contrato.NUM_PARCELAS}x ${fmtR(contrato.VALOR_PARCELA)}`, c:TEXT},
            {l:"Taxa Mensal",    v:`${(parseFloat(contrato.TAXA_JUROS_MENSAL||0)*100).toFixed(1)}%`, c:BLU},
            {l:"Total Recebido", v:fmtR(totalPago),                  c:totalPago>0?GRN:MUTED},
          ].map((k,i)=>(
            <div key={k.l} style={{padding:"12px 16px",borderRight:i<4?`1px solid ${BD}`:"none"}}>
              <div style={{fontSize:10,color:MUTED,fontWeight:700,textTransform:"uppercase",marginBottom:3}}>{k.l}</div>
              <div style={{fontSize:13,fontWeight:800,color:k.c}}>{k.v||"—"}</div>
            </div>
          ))}
        </div>

        {/* TABS */}
        <div style={{display:"flex",background:CARD,padding:"0 20px",borderBottom:`1px solid ${BD}`,gap:20}}>
          {[["parcelas",`Parcelas (${ps.length})`],["pagamentos",`Pagamentos (${pags.length})`]].map(([id,lbl])=>(
            <button key={id} onClick={()=>setAbaM(id)} style={{padding:"13px 4px",background:"none",border:"none",borderBottom:abaM===id?`2px solid ${BLU}`:"2px solid transparent",color:abaM===id?BLU:MUTED,fontWeight:600,cursor:"pointer",fontSize:13}}>{lbl}</button>
          ))}
        </div>

        {/* CONTENT */}
        <div style={{flex:1,overflowY:"auto"}}>
          {abaM==="parcelas"&&(
            <table style={{width:"100%",borderCollapse:"collapse",textAlign:"left"}}>
              <thead><tr style={{background:BG,fontSize:11,color:MUTED,textTransform:"uppercase",position:"sticky",top:0}}>
                <th style={{padding:"10px 18px"}}>#</th>
                <th>Vencimento</th>
                <th>Valor</th>
                <th>Status</th>
                <th>Pagamento</th>
                <th style={{textAlign:"right",padding:"10px 18px"}}>Valor Pago</th>
              </tr></thead>
              <tbody>{ps.map((p,i)=>{
                const st=String(p.STATUS||p.STATUS_PAGAMENTO||"pendente").toLowerCase();
                const cor=stCor[st]||MUTED;
                return(
                  <tr key={p.ID_PARCELA||i} style={{borderBottom:`1px solid ${BD}`,fontSize:13,background:i%2===0?CARD:"#FAFAFA"}}>
                    <td style={{padding:"11px 18px",color:MUTED,fontWeight:600}}>{p.NUM_PARCELA}/{p.TOTAL_PARCELAS}</td>
                    <td style={{fontWeight:600}}>{fmtDt(p.DATA_VENCIMENTO)}</td>
                    <td>{fmtR(p.VALOR_PARCELA)}</td>
                    <td><Badge c={cor}>{stLabel[st]||st}</Badge></td>
                    <td style={{color:MUTED}}>{fmtDt(p.DATA_PAGAMENTO)||"—"}</td>
                    <td style={{textAlign:"right",padding:"11px 18px",fontWeight:700,color:parseFloat(p.VALOR_PAGO||0)>0?GRN:MUTED}}>{parseFloat(p.VALOR_PAGO||0)>0?fmtR(p.VALOR_PAGO):"—"}</td>
                  </tr>
                );
              })}</tbody>
            </table>
          )}
          {abaM==="pagamentos"&&(
            pags.length===0
              ? <div style={{padding:32,textAlign:"center",color:MUTED,fontSize:13}}>Nenhum pagamento registrado neste contrato.</div>
              : <table style={{width:"100%",borderCollapse:"collapse",textAlign:"left"}}>
                  <thead><tr style={{background:BG,fontSize:11,color:MUTED,textTransform:"uppercase",position:"sticky",top:0}}>
                    <th style={{padding:"10px 18px"}}>Data</th>
                    <th>Tipo</th>
                    <th>Valor Original</th>
                    <th>Valor Pago</th>
                    <th style={{textAlign:"right",padding:"10px 18px"}}>Diferença</th>
                  </tr></thead>
                  <tbody>{pags.map((p,i)=>{
                    const cor=tipoPagCor[p.TIPO_PAGAMENTO]||MUTED;
                    const extra=parseFloat(p.RECEITA_EXTRA_ATRASO||p.DIFERENCA_RECEBIDA||0);
                    return(
                      <tr key={p.ID_PAGAMENTO||i} style={{borderBottom:`1px solid ${BD}`,fontSize:13,background:i%2===0?CARD:"#FAFAFA"}}>
                        <td style={{padding:"11px 18px",color:MUTED}}>{fmtDt(parseDate(p.DATA_PAGAMENTO))}</td>
                        <td><Badge c={cor}>{tipoPagLabel[p.TIPO_PAGAMENTO]||p.TIPO_PAGAMENTO||"—"}</Badge></td>
                        <td style={{color:MUTED}}>{fmtR(p.VALOR_ORIGINAL_PARCELA||p.VALOR_PARCELA)}</td>
                        <td style={{fontWeight:700,color:BLU}}>{fmtR(p.VALOR_PAGO)}</td>
                        <td style={{textAlign:"right",padding:"11px 18px",color:extra>0?ORG:MUTED,fontWeight:extra>0?700:400}}>{extra>0?`+${fmtR(extra)}`:"—"}</td>
                      </tr>
                    );
                  })}</tbody>
                </table>
          )}
        </div>

        {/* FOOTER */}
        <div style={{padding:"14px 20px",borderTop:`1px solid ${BD}`,background:CARD,display:"flex",gap:10,justifyContent:"flex-end"}}>
          {podeBaixar&&<button onClick={()=>onBaixar(contrato)} style={{padding:"9px 16px",borderRadius:8,border:`1px solid ${RED}30`,background:RED+"08",color:RED,cursor:"pointer",fontSize:13,fontWeight:700}}>⚠️ Baixar Prejuízo</button>}
          {podeRegistrar&&pendentes.length>0&&<button onClick={()=>onQuitacaoAntecipada&&onQuitacaoAntecipada(contrato)} style={{padding:"9px 16px",borderRadius:8,border:`1px solid ${BLU}30`,background:BLU+"08",color:BLU,cursor:"pointer",fontSize:13,fontWeight:700}}>⚡ Quitar Antecipado</button>}
          {podeRegistrar&&pendentes.length>0&&<button onClick={()=>onRegistrarPagamento(pendentes[0])} style={{padding:"9px 16px",borderRadius:8,border:"none",background:GRN,color:"#FFF",cursor:"pointer",fontSize:13,fontWeight:700}}>💳 Registrar Pagamento</button>}
        </div>
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
    <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.55)",zIndex:400,display:"flex",alignItems:"center",justifyContent:"center",padding:16}} onClick={onFechar}>
      <div onClick={e=>e.stopPropagation()} style={{background:BG,borderRadius:16,width:"100%",maxWidth:500,boxShadow:"0 30px 80px rgba(0,0,0,0.3)",overflow:"hidden"}}>
        <div style={{background:CARD,padding:"18px 22px",borderBottom:`1px solid ${BD}`,display:"flex",justifyContent:"space-between",alignItems:"center"}}>
          <div style={{fontSize:16,fontWeight:800}}>📋 Nova Promessa de Pagamento</div>
          <button onClick={onFechar} style={{background:BG,border:`1px solid ${BD}`,width:32,height:32,borderRadius:8,cursor:"pointer",fontSize:18,color:MUTED}}>×</button>
        </div>
        <div style={{padding:22,display:"flex",flexDirection:"column",gap:14}}>
          <div style={{position:"relative"}} ref={ref}>
            <span style={LS}>Buscar Cliente</span>
            <div style={{position:"relative"}}>
              <div style={{position:"absolute",left:10,top:"50%",transform:"translateY(-50%)"}}>{IcoSrch}</div>
              <input value={cliente?`${cliente.ID_CLIENTE} - ${cliente.NOME||cliente.NOME_CLIENTE}`:busca} onChange={e=>{setBusca(e.target.value);setCliente(null);setContratoId("");setShowDrop(true);}} onFocus={()=>setShowDrop(true)} placeholder="Nome ou ID..." style={{...IS,paddingLeft:32}}/>
              {cliente&&<button onClick={()=>{setCliente(null);setBusca("");setContratoId("");}} style={{position:"absolute",right:8,top:"50%",transform:"translateY(-50%)",border:"none",background:"none",cursor:"pointer",color:MUTED,fontSize:16}}>×</button>}
            </div>
            {showDrop&&clis.length>0&&<div style={{position:"absolute",top:"100%",left:0,right:0,background:CARD,border:`1px solid ${BD}`,borderRadius:8,marginTop:4,zIndex:100,boxShadow:"0 10px 30px rgba(0,0,0,0.1)"}}>
              {clis.map(c=><div key={c.ID_CLIENTE} onClick={()=>{setCliente(c);setShowDrop(false);}} style={{padding:"10px 14px",cursor:"pointer",fontSize:13,borderBottom:`1px solid ${BG}`}} onMouseEnter={e=>e.currentTarget.style.background=BG} onMouseLeave={e=>e.currentTarget.style.background=CARD}><strong>{c.ID_CLIENTE}</strong> — {c.NOME||c.NOME_CLIENTE}</div>)}
            </div>}
          </div>
          {cliente&&(
            <div>
              <span style={LS}>Contrato</span>
              <select value={contratoId} onChange={e=>setContratoId(e.target.value)} style={IS}>
                <option value="">Selecione...</option>
                {contratosCliente.map(c=><option key={c.ID_CONTRATO} value={c.ID_CONTRATO}>{c.ID_CONTRATO} — {fmtR(c.VALOR_PRINCIPAL)} — {c.NUM_PARCELAS}x — {c.STATUS_CONTRATO}</option>)}
              </select>
            </div>
          )}
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12}}>
            <div><span style={LS}>Data Prevista</span><input type="date" value={dataPrevista} onChange={e=>setDataPrevista(e.target.value)} style={IS}/></div>
            <div><span style={LS}>Valor Prometido (R$)</span><input type="number" value={valorPrometido} onChange={e=>setValorPrometido(e.target.value)} placeholder="0.00" style={IS}/></div>
          </div>
          <div><span style={LS}>Observação</span><input value={observacao} onChange={e=>setObservacao(e.target.value)} placeholder="Opcional" style={IS}/></div>
          {msg&&<div style={{padding:"10px 14px",borderRadius:8,background:msg.ok?GRN+"10":RED+"10",color:msg.ok?GRN:RED,fontSize:13,fontWeight:700,border:`1px solid ${msg.ok?GRN:RED}25`}}>{msg.ok?"✓ ":"⚠ "}{msg.t}</div>}
          <div style={{display:"flex",gap:10}}>
            <button onClick={onFechar} style={{flex:1,padding:12,borderRadius:8,border:`1px solid ${BD}`,background:CARD,cursor:"pointer",fontWeight:600,color:MUTED}}>Cancelar</button>
            <button onClick={confirmar} disabled={loading||!cliente||!contratoId||!dataPrevista||!valorPrometido} style={{flex:2,padding:12,borderRadius:8,border:"none",background:BLU,color:"#FFF",fontWeight:800,cursor:"pointer",fontSize:13,opacity:loading||!cliente||!contratoId||!dataPrevista||!valorPrometido?0.6:1}}>
              {loading?"Registrando...":"✓ Registrar Promessa"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── APP ─────────────────────────────────────────────────────────
function App() {
  const [raw, setRaw] = useState(null);
  const [tab, setTab] = useState("dashboard");
  const [loading, setLoading] = useState(true);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [selCli, setSelCli] = useState(null);
  const [baixaModal, setBaixaModal] = useState(null);
  const [acordoModal, setAcordoModal] = useState(null);
  const [quitacaoModal, setQuitacaoModal] = useState(null);
  const [recuperacaoModal, setRecuperacaoModal] = useState(null);
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
  const [pagamentoHoje, setPagamentoHoje] = useState(null);
  const [dashPeriodo, setDashPeriodo] = useState(()=>mesAtualRange());
  const [novaPromessa, setNovaPromessa] = useState(false);
  const [filtroPromessa, setFiltroPromessa] = useState("todos");

  const carregar=()=>{setLoading(true);fetch(API_URL).then(r=>r.json()).then(d=>{setRaw(d);setLoading(false);}).catch(()=>setLoading(false));};
  useEffect(()=>{carregar();},[]);

  const clientes  = useMemo(()=>raw?.CLIENTES  || raw?.clientes  || [], [raw]);
  const contratos = useMemo(()=>raw?.CONTRATOS || raw?.contratos || [], [raw]);
  const parcelas  = useMemo(()=>raw?.PARCELAS  || raw?.parcelas  || [], [raw]);
  const pagamentos= useMemo(()=>raw?.PAGAMENTOS|| raw?.pagamentos|| [], [raw]);
  const promessas = useMemo(()=>raw?.PROMESSAS || [], [raw]);
  const acordos   = useMemo(()=>raw?.ACORDOS   || [], [raw]);

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

  const filtrados=useMemo(()=>(clientes||[]).filter(c=>{const busca=filtroBusca.toLowerCase();const m=nomeCliente(c).toLowerCase().includes(busca)||String(c.ID_CLIENTE||"").toLowerCase().includes(busca)||String(telCliente(c)||"").toLowerCase().includes(busca)||String(c.CPF||"").toLowerCase().includes(busca);const s=filtroStatus==="todos"||c.STATUS_CLIENTE===filtroStatus;return m&&s;}),[clientes,filtroBusca,filtroStatus]);

  const pFiltradas=useMemo(()=>(contratos||[]).filter(c=>STATUS_PERDA.includes(c.STATUS_CONTRATO)&&(filtroPerdas==="todos"||c.STATUS_CONTRATO===filtroPerdas)),[contratos,filtroPerdas]);

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

  const resetPeriodoMesAtual=()=>setDashPeriodo(mesAtualRange());

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
    const qtyProrrogadas=(parcelasPeriodo||[]).filter(p=>p.ORIGEM_PARCELA==="gerada_por_pagamento_de_juros").length;
    const pagNormais=(pagamentosPeriodo||[]).filter(p=>p.TIPO_PAGAMENTO==="pagamento_normal").length;
    const pagAtraso=(pagamentosPeriodo||[]).filter(p=>p.TIPO_PAGAMENTO==="pagamento_com_atraso").length;
    const pagJuros=(pagamentosPeriodo||[]).filter(p=>p.TIPO_PAGAMENTO==="somente_juros").length;
    const vPendente=parcelasAbertas.reduce((s,p)=>s+parseFloat(p.VALOR_PARCELA||0),0);
    const totalRecebidoGeral=(pagamentos||[]).reduce((s,p)=>s+parseFloat(p.VALOR_PAGO||0),0);
    const principalLiberadoGeral=(contratos||[]).reduce((s,c)=>s+parseFloat(c.VALOR_PRINCIPAL||0),0);
    const caixaAtual=totalRecebidoGeral-principalLiberadoGeral;
    return{vAtivos,vAtrasoTotal,taxaInad,lucroTotal:receitaExtra,receitaTotal,receitaExtra,qtyProrrogadas,pagNormais,pagAtraso,pagJuros,totalCobrancas:(parcelasPeriodo||[]).length,parcelasPagas:parcelasPagas.length,parcelasPendentes:parcelasAbertas.length,vPendente,contratosAtivos:ativos.length,caixaAtual,pagamentosPeriodo:pagamentosPeriodo.length};
  },[contratos,parcelas,pagamentos,periodoDash]);

  const parcelasHoje=useMemo(()=>{
    const base=new Date();base.setHours(0,0,0,0);
    return (parcelas||[]).filter(p=>{
      const status=String(p.STATUS||p.STATUS_PARCELA||"").toLowerCase();
      if(["pago","paga","quitado","quitada","baixado","baixada"].includes(status))return false;
      const d=parseDate(p.DATA_VENCIMENTO);if(!d)return false;d.setHours(0,0,0,0);
      return d.getTime()===base.getTime();
    }).map(p=>{const c=(clientes||[]).find(x=>String(x.ID_CLIENTE)===String(p.ID_CLIENTE));return{...p,NOME_CLIENTE:p.NOME_CLIENTE||nomeCliente(c)};}).sort((a,b)=>String(a.NOME_CLIENTE||"").localeCompare(String(b.NOME_CLIENTE||""),"pt-BR"));
  },[parcelas,clientes]);
  const totalParcelasHoje=useMemo(()=>parcelasHoje.reduce((s,p)=>s+parseFloat(p.VALOR_PARCELA||0),0),[parcelasHoje]);

  const parcelasAtrasadas=useMemo(()=>{
    const base=new Date();base.setHours(0,0,0,0);
    return (parcelas||[]).filter(p=>{
      const status=String(p.STATUS||p.STATUS_PARCELA||"").toLowerCase();
      if(["pago","paga","quitado","quitada","baixado","baixada"].includes(status))return false;
      const d=parseDate(p.DATA_VENCIMENTO);if(!d)return false;d.setHours(0,0,0,0);
      if(periodoDash.ini&&periodoDash.fim&&(d<periodoDash.ini||d>periodoDash.fim))return false;
      return status==="atrasado" || d.getTime()<base.getTime();
    }).map(p=>{const c=(clientes||[]).find(x=>String(x.ID_CLIENTE)===String(p.ID_CLIENTE));const d=parseDate(p.DATA_VENCIMENTO);const dias=d?Math.max(1,Math.round((new Date()-d)/86400000)):0;return{...p,NOME_CLIENTE:p.NOME_CLIENTE||nomeCliente(c),DIAS_ATRASO:dias};}).sort((a,b)=>(b.DIAS_ATRASO||0)-(a.DIAS_ATRASO||0));
  },[parcelas,clientes,periodoDash]);
  const totalParcelasAtrasadas=useMemo(()=>parcelasAtrasadas.reduce((s,p)=>s+parseFloat(p.VALOR_PARCELA||0),0),[parcelasAtrasadas]);

  const mensal=useMemo(()=>["Jan","Fev","Mar","Abr","Mai","Jun","Jul","Ago","Set","Out","Nov","Dez"].map((mes,i)=>{
    const pMes=(pagamentos||[]).filter(p=>{const d=parseDate(p.DATA_PAGAMENTO);return d&&d.getMonth()===i;});
    return{m:mes,v:pMes.reduce((s,p)=>s+parseFloat(p.VALOR_PAGO||0),0),extra:pMes.reduce((s,p)=>s+parseFloat(p.RECEITA_EXTRA_ATRASO||0),0)};
  }),[pagamentos]);

  // ── cobItems: inclui parcelasAtrasadas de cada cliente ──────────
  const cobItems=useMemo(()=>{
    const ids=[...new Set((parcelas||[]).filter(p=>String(p.STATUS||p.STATUS_PARCELA||"").toLowerCase()==="atrasado").map(p=>p.ID_CLIENTE))];
    return ids.map(id=>{
      const c=(clientes||[]).find(x=>String(x.ID_CLIENTE)===String(id));
      const ps=(parcelas||[]).filter(p=>String(p.ID_CLIENTE)===String(id)&&String(p.STATUS||p.STATUS_PARCELA||"").toLowerCase()==="atrasado");
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
      {dashCalOpen&&<div onClick={()=>setDashCalOpen(false)} style={{position:"fixed",inset:0,zIndex:199,background:"transparent"}}/>}

      {/* SIDEBAR */}
      <div style={{width:sidebarOpen?SW:0,background:CARD,borderRight:`1px solid ${BD}`,display:"flex",flexDirection:"column",overflow:"hidden",transition:"0.3s",flexShrink:0}}>
        <div style={{padding:24,display:"flex",alignItems:"center",gap:12,borderBottom:`1px solid ${BD}`}}>
          <div style={{width:32,height:32,background:BLU,borderRadius:8,display:"flex",alignItems:"center",justifyContent:"center",color:"#FFF"}}>{IcoFin}</div>
          <span style={{fontWeight:800,fontSize:18,letterSpacing:"-0.5px"}}>Financeiro<span style={{color:BLU}}>Op</span></span>
        </div>
        <div style={{padding:16,flex:1}}>
          <Nav id="dashboard"  label="Dashboard"        ico={IcoDash}/>
          <Nav id="clientes"   label="Clientes"         ico={IcoCli}/>
          <Nav id="contratos"  label="Contratos"        ico={IcoCtr}/>
          <Nav id="cobranca"   label="Cobrança"         ico={IcoCob}/>
          <Nav id="financeiro" label="Financeiro"       ico={IcoFin}/>
          <Nav id="perdas"     label="Perdas & Recup."  ico={IcoLoss}/>
          <Nav id="promessas"  label="Promessas"        ico={IcoProm}/>
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
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-end",gap:16,flexWrap:"wrap"}}>
                <div>
                  <div style={{fontSize:12,color:MUTED,fontWeight:700,textTransform:"uppercase",letterSpacing:"0.04em"}}>Período do Dashboard</div>
                  <div style={{fontSize:14,fontWeight:800,color:TEXT,marginTop:4}}>{labelPeriodoDash}</div>
                </div>
                <div style={{display:"flex",alignItems:"center",gap:10}}>
                  <button onClick={resetPeriodoMesAtual} style={{padding:"8px 11px",borderRadius:8,border:`1px solid ${BLU}30`,background:BLU+"10",color:BLU,cursor:"pointer",fontSize:12,fontWeight:800}}>Mês atual</button>
                  <div style={{position:"relative"}}>
                    <button onClick={()=>setDashCalOpen(o=>!o)} style={{display:"flex",alignItems:"center",gap:6,padding:"7px 14px",borderRadius:8,border:`1.5px solid ${BLU}`,background:"#EFF6FF",color:BLU,fontSize:12,fontWeight:700,cursor:"pointer"}}>
                      {IcoCal} {labelPeriodoDash}
                    </button>
                    {dashCalOpen&&(
                      <div style={{position:"absolute",top:"calc(100% + 8px)",right:0,zIndex:200}} onClick={e=>e.stopPropagation()}>
                        <CalendarioRange
                          de={parseDate(dashPeriodo.ini)}
                          ate={parseDate(dashPeriodo.fim)}
                          onSelecionar={(d,a)=>{setDashPeriodo({ini:dateInputStr(d),fim:a?dateInputStr(a):dateInputStr(d)});setDashCalOpen(false);}}
                          onLimpar={()=>{resetPeriodoMesAtual();setDashCalOpen(false);}}
                        />
                      </div>
                    )}
                  </div>
                </div>
              </div>
              <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(210px,1fr))",gap:14}}>
                {[
                  {l:"Caixa Atual",v:fmtR(M.caixaAtual),sub:"Saldo geral estimado",c:GRN,i:IcoFin},
                  {l:"Receita Total",v:fmtR(M.receitaTotal),sub:`${M.pagamentosPeriodo} pagamentos no período`,c:BLU,i:IcoFin},
                  {l:"Total de Cobranças",v:M.totalCobrancas,sub:`${fmtR(M.vPendente)} em aberto`,c:YEL,i:IcoCob},
                  {l:"Pagos",v:M.parcelasPagas,sub:`${M.totalCobrancas?Math.round((M.parcelasPagas/M.totalCobrancas)*100):0}% do total`,c:GRN,i:IcoKpi},
                  {l:"Pendentes",v:M.parcelasPendentes,sub:`${fmtR(M.vPendente)} aguardando`,c:ORG,i:IcoCal},
                  {l:"Vencidos",v:parcelasAtrasadas.length,sub:`${fmtR(totalParcelasAtrasadas)} em atraso`,c:RED,i:IcoCob},
                ].map(k=>(
                  <div key={k.l} style={{background:CARD,padding:20,borderRadius:12,border:`1px solid ${BD}`,minHeight:118,display:"flex",flexDirection:"column",justifyContent:"space-between",boxShadow:"0 10px 24px rgba(15,23,42,0.04)"}}>
                    <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",gap:10,marginBottom:12}}><div style={{fontSize:13,color:TEXT,fontWeight:800}}>{k.l}</div><div style={{color:k.c}}>{k.i}</div></div>
                    <div style={{fontSize:26,fontWeight:900,letterSpacing:"-0.8px",color:TEXT,lineHeight:1}}>{k.v}</div>
                    <div style={{fontSize:11,color:k.c,fontWeight:700,marginTop:10}}>{k.sub}</div>
                  </div>
                ))}
              </div>
              <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(360px,1fr))",gap:20,alignItems:"start"}}>
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
                <div style={{background:CARD,borderRadius:12,padding:20,border:`1px solid ${BD}`}}>
                  <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",gap:12,marginBottom:14}}>
                    <div style={{display:"flex",alignItems:"center",gap:10}}><div style={{background:RED+"15",color:RED,padding:8,borderRadius:8}}>{IcoCob}</div><h3 style={{margin:0,fontSize:15,fontWeight:700}}>Em Atraso</h3></div>
                    <Badge c={parcelasAtrasadas.length?RED:GRN}>{parcelasAtrasadas.length} parcela{parcelasAtrasadas.length===1?"":"s"}</Badge>
                  </div>
                  <div style={{display:"flex",justifyContent:"space-between",alignItems:"baseline",marginBottom:12}}><span style={{fontSize:12,color:MUTED,fontWeight:700}}>Total atrasado</span><strong style={{fontSize:20,color:parcelasAtrasadas.length?RED:GRN}}>{fmtR(totalParcelasAtrasadas)}</strong></div>
                  {parcelasAtrasadas.length===0?<div style={{padding:12,borderRadius:8,background:GRN+"08",color:GRN,fontSize:12,fontWeight:700}}>Nenhuma parcela em atraso.</div>:<div style={{display:"flex",flexDirection:"column",gap:8,maxHeight:260,overflowY:"auto"}}>{parcelasAtrasadas.map(p=>(
                    <div key={p.ID_PARCELA||`${p.ID_CLIENTE}-${p.NUM_PARCELA}-atraso`} style={{padding:10,borderRadius:9,background:BG,border:`1px solid ${BD}`,display:"flex",justifyContent:"space-between",gap:10,alignItems:"center"}}>
                      <div style={{minWidth:0}}><div style={{fontSize:12,fontWeight:800,whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis"}}>{p.NOME_CLIENTE}</div><div style={{fontSize:11,color:MUTED,marginTop:2}}>Parcela {p.NUM_PARCELA||p.NUMERO_PARCELA||"—"} · {fmtDt(p.DATA_VENCIMENTO)} · {p.DIAS_ATRASO} dia{p.DIAS_ATRASO===1?"":"s"}</div></div>
                      <div style={{display:"flex",flexDirection:"column",alignItems:"flex-end",gap:6}}><div style={{fontSize:13,fontWeight:800,color:RED}}>{fmtR(parseFloat(p.VALOR_PARCELA||0))}</div><button onClick={()=>setPagamentoHoje(p)} style={{padding:"5px 8px",borderRadius:6,border:`1px solid ${GRN}35`,background:GRN+"10",color:GRN,cursor:"pointer",fontSize:11,fontWeight:800,whiteSpace:"nowrap"}}>Registrar pagamento</button></div>
                    </div>
                  ))}</div>}
                </div>
                <PagamentoDrop contratos={contratos||[]} parcelas={parcelas||[]} onSucesso={carregar} onSelecionarParcela={setPagamentoHoje}/>
                <NovoContrato contratos={contratos||[]} onSucesso={carregar}/>
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
                    <td style={{padding:"13px 18px"}}><div style={{fontWeight:700}}>{nomeCliente(c)}</div><div style={{fontSize:11,color:MUTED}}>ID {c.ID_CLIENTE||"—"} · Score {scoreCliente(c)}</div></td>
                    <td><Badge c={c.STATUS_CLIENTE==="ativo"?GRN:YEL}>{(c.STATUS_CLIENTE||"").toUpperCase()}</Badge></td>
                    <td style={{color:MUTED}}>{telCliente(c)}</td>
                    <td style={{padding:"13px 18px",textAlign:"right"}}><button onClick={()=>setSelCli(c)} style={{padding:"5px 12px",borderRadius:6,border:`1px solid ${BD}`,background:CARD,cursor:"pointer",fontSize:12,fontWeight:600}}>Detalhes</button></td>
                  </tr>
                ))}</tbody>
              </table>
            </div>
          )}

          {/* CONTRATOS */}
          {tab==="contratos"&&(
            <div style={{background:CARD,borderRadius:12,border:`1px solid ${BD}`,overflow:"hidden"}}>
              <div style={{padding:16,borderBottom:`1px solid ${BD}`,display:"flex",justifyContent:"space-between",alignItems:"center",background:BG+"50",flexWrap:"wrap",gap:10}}>
                <div style={{display:"flex",gap:10,flexWrap:"wrap"}}>
                  <input placeholder="Buscar por ID, cliente..." value={filtroCtr} onChange={e=>setFiltroCtr(e.target.value)} style={{...IS,width:260}}/>
                  <select value={filtroStatusCtr} onChange={e=>setFiltroStatusCtr(e.target.value)} style={{...IS,width:180}}>
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
                <div style={{fontSize:13,color:MUTED}}><strong>{contratosFiltrados.length}</strong> contrato{contratosFiltrados.length===1?"":"s"}</div>
              </div>
              <table style={{width:"100%",borderCollapse:"collapse",textAlign:"left"}}>
                <thead>
                  <tr style={{background:BG,fontSize:11,color:MUTED,textTransform:"uppercase"}}>
                    <th style={{padding:"10px 18px"}}>Contrato</th>
                    <th>Status</th>
                    <th>Empréstimo</th>
                    <th>Principal</th>
                    <th>Parcelas</th>
                    <th>Taxa</th>
                    <th style={{padding:"10px 18px",textAlign:"right"}}>Ações</th>
                  </tr>
                </thead>
                <tbody>
                  {contratosFiltrados.length===0
                    ? <tr><td colSpan={7} style={{padding:"28px 18px",textAlign:"center",color:MUTED,fontSize:13}}>Nenhum contrato encontrado.</td></tr>
                    : contratosFiltrados.map((c,i)=>(
                      <tr key={c.ID_CONTRATO||i}
                        onClick={()=>setContratoSel(c)}
                        style={{borderBottom:`1px solid ${BD}`,fontSize:13,cursor:"pointer"}}
                        onMouseEnter={e=>e.currentTarget.style.background=BG}
                        onMouseLeave={e=>e.currentTarget.style.background=i%2===0?"transparent":"#FAFAFA"}
                      >
                        <td style={{padding:"13px 18px"}}>
                          <div style={{fontWeight:700}}>{c.ID_CONTRATO}</div>
                          <div style={{fontSize:11,color:MUTED}}>Cliente {c.ID_CLIENTE} · {c.NOME_CLIENTE}</div>
                        </td>
                        <td><Badge c={STATUS_COR[c.STATUS_CONTRATO]||MUTED}>{STATUS_LABEL[c.STATUS_CONTRATO]||c.STATUS_CONTRATO||"—"}</Badge></td>
                        <td style={{color:MUTED}}>{fmtDt(c.DATA_EMPRESTIMO)}</td>
                        <td style={{fontWeight:600}}>{fmtR(c.VALOR_PRINCIPAL)}</td>
                        <td style={{color:MUTED}}>{c.NUM_PARCELAS}x {fmtR(c.VALOR_PARCELA)}</td>
                        <td style={{color:BLU,fontWeight:600}}>{(parseFloat(c.TAXA_JUROS_MENSAL||0)*100).toFixed(1)}%</td>
                        <td style={{padding:"13px 18px",textAlign:"right"}}>
                          <button
                            onClick={e=>{e.stopPropagation();setContratoSel(c);}}
                            style={{padding:"5px 12px",borderRadius:6,border:`1px solid ${BD}`,background:CARD,cursor:"pointer",fontSize:12,fontWeight:600}}
                          >Ver detalhes</button>
                        </td>
                      </tr>
                    ))
                  }
                </tbody>
              </table>
            </div>
          )}

          {/* COBRANÇA ── linha clicável abre CobrancaModal */}
          {tab==="cobranca"&&(
            <div style={{background:CARD,borderRadius:12,border:`1px solid ${BD}`,overflow:"hidden"}}>
              <div style={{padding:16,borderBottom:`1px solid ${BD}`,background:RED+"05",display:"flex",alignItems:"center",justifyContent:"space-between"}}>
                <h3 style={{margin:0,fontSize:15,fontWeight:700,color:RED}}>Fila de Cobrança</h3>
                <span style={{fontSize:12,color:MUTED}}>Clique em uma linha para registrar pagamento</span>
              </div>
              <table style={{width:"100%",borderCollapse:"collapse",textAlign:"left"}}>
                <thead>
                  <tr style={{background:BG,fontSize:11,color:MUTED,textTransform:"uppercase"}}>
                    <th style={{padding:"10px 18px"}}>Cliente</th>
                    <th>Contratos</th>
                    <th>Atraso Máx</th>
                    <th>Valor</th>
                    <th style={{padding:"10px 18px",textAlign:"right"}}>Ação</th>
                  </tr>
                </thead>
                <tbody>
                  {cobItems.map(c=>(
                    <tr
                      key={c.ID_CLIENTE}
                      onClick={() => setCobModal(c)}
                      style={{borderBottom:`1px solid ${BD}`,fontSize:13,cursor:"pointer",transition:"background 0.1s"}}
                      onMouseEnter={e=>e.currentTarget.style.background=BG}
                      onMouseLeave={e=>e.currentTarget.style.background="transparent"}
                    >
                      <td style={{padding:"13px 18px"}}>
                        <div style={{fontWeight:700}}>{nomeCliente(c)}</div>
                        <div style={{fontSize:11,color:MUTED}}>ID {c.ID_CLIENTE||"—"} · {telCliente(c)}</div>
                      </td>
                      <td style={{fontWeight:600}}>{c.qtdContratos}</td>
                      <td><Badge c={c.maxAtraso>60?RED:c.maxAtraso>30?ORG:YEL}>{c.maxAtraso} dias</Badge></td>
                      <td style={{fontWeight:700,color:RED}}>{fmtR(c.vAtraso)}</td>
                      <td style={{padding:"13px 18px",textAlign:"right"}}>
                        <button
                          onClick={e=>{e.stopPropagation();setCobModal(c);}}
                          style={{padding:"5px 12px",borderRadius:6,border:`1px solid ${GRN}40`,background:GRN+"10",color:GRN,cursor:"pointer",fontSize:12,fontWeight:700}}
                        >
                          💳 Registrar
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* FINANCEIRO */}
          {tab==="financeiro"&&(
            <div style={{display:"flex",flexDirection:"column",gap:20}}>

              {/* FILTRO DE PERÍODO — TOPO */}
              <div style={{background:CARD,borderRadius:12,border:`1px solid ${BD}`,padding:"14px 18px",display:"flex",alignItems:"center",justifyContent:"space-between",flexWrap:"wrap",gap:10}}>
                <div>
                  <div style={{fontSize:13,fontWeight:700,color:TEXT}}>Período</div>
                  <div style={{fontSize:11,color:MUTED,marginTop:2}}>{finDe?labelPeriodo:"Todos os pagamentos"}</div>
                </div>
                <div style={{display:"flex",gap:8,alignItems:"center"}}>
                  {finDe&&<button onClick={()=>{setFinDe(null);setFinAte(null);}} style={{padding:"6px 12px",borderRadius:8,border:`1px solid ${BD}`,background:CARD,color:MUTED,fontSize:12,cursor:"pointer",fontWeight:600}}>✕ Limpar</button>}
                  <div style={{position:"relative"}}>
                    <button onClick={()=>setFinCalOpen(o=>!o)} style={{display:"flex",alignItems:"center",gap:6,padding:"7px 14px",borderRadius:8,border:`1.5px solid ${finDe?BLU:BD}`,background:finDe?"#EFF6FF":CARD,color:finDe?BLU:MUTED,fontSize:12,fontWeight:finDe?700:400,cursor:"pointer"}}>
                      {IcoCal} {finDe?labelPeriodo:"Filtrar por período"}
                    </button>
                    {finCalOpen&&(
                      <div style={{position:"absolute",top:"calc(100% + 8px)",right:0,zIndex:200}} onClick={e=>e.stopPropagation()}>
                        <CalendarioRange de={finDe} ate={finAte} onSelecionar={(d,a)=>{setFinDe(d);setFinAte(a);}} onLimpar={()=>{setFinDe(null);setFinAte(null);setFinCalOpen(false);}}/>
                      </div>
                    )}
                  </div>
                </div>
              </div>

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
              <div style={{background:CARD,borderRadius:12,border:`1px solid ${BD}`,overflow:"hidden"}}>
                <div style={{padding:"14px 18px",borderBottom:`1px solid ${BD}`}}>
                  <h3 style={{margin:0,fontSize:15,fontWeight:700}}>{finDe?"Pagamentos do Período":"Últimos Pagamentos"}</h3>
                  <p style={{margin:"3px 0 0",fontSize:11,color:MUTED}}>{finDe?`${totaisFin.count} pagamento(s) — ${labelPeriodo}`:`${(pagamentos||[]).length} pagamentos no total`}</p>
                </div>
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
                  <thead><tr style={{background:BG,fontSize:11,color:MUTED,textTransform:"uppercase"}}><th style={{padding:"10px 18px"}}>Data</th><th>Cliente</th><th>Tipo</th><th>Valor Original</th><th>Valor Pago</th><th>Diferença</th></tr></thead>
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
              {acordos.length>0&&(
                <div style={{background:CARD,borderRadius:12,border:`1px solid ${BD}`,overflow:"hidden"}}>
                  <div style={{padding:"14px 18px",borderBottom:`1px solid ${BD}`,background:"#F0FDFA"}}>
                    <h3 style={{margin:0,fontSize:15,fontWeight:700,color:"#0891B2"}}>🤝 Acordos Registrados ({acordos.length})</h3>
                  </div>
                  <table style={{width:"100%",borderCollapse:"collapse",textAlign:"left"}}>
                    <thead><tr style={{background:BG,fontSize:11,color:MUTED,textTransform:"uppercase"}}>
                      <th style={{padding:"10px 18px"}}>Acordo</th>
                      <th>Cliente</th>
                      <th>Data</th>
                      <th>Dívida Original</th>
                      <th>Valor Acordado</th>
                      <th>Desconto Capital</th>
                      <th style={{padding:"10px 18px"}}>Juros Cancelados</th>
                    </tr></thead>
                    <tbody>{[...acordos].sort((a,b)=>toNum(b.DATA)-toNum(a.DATA)).map((a,i)=>(
                      <tr key={a.ID_ACORDO||i} style={{borderBottom:`1px solid ${BD}`,fontSize:13,background:i%2===0?CARD:"#FAFAFA"}}>
                        <td style={{padding:"12px 18px"}}><div style={{fontWeight:700}}>{a.ID_ACORDO}</div><div style={{fontSize:11,color:MUTED}}>{a.ID_CONTRATO}</div></td>
                        <td style={{fontWeight:600}}>{a.NOME_CLIENTE}</td>
                        <td style={{color:MUTED}}>{fmtDt(parseDate(a.DATA))}</td>
                        <td style={{color:MUTED}}>{fmtR(parseFloat(a.VALOR_DIVIDA_ORIGINAL||0))}</td>
                        <td style={{fontWeight:700,color:"#0891B2"}}>{fmtR(parseFloat(a.VALOR_ACORDADO||0))}</td>
                        <td style={{color:RED,fontWeight:600}}>{fmtR(parseFloat(a.DESCONTO_PRINCIPAL||0))}</td>
                        <td style={{padding:"12px 18px",color:ORG,fontWeight:600}}>{fmtR(parseFloat(a.DESCONTO_JUROS||0))}</td>
                      </tr>
                    ))}</tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {/* PROMESSAS */}
          {tab==="promessas"&&(
            <div style={{display:"flex",flexDirection:"column",gap:20}}>
              <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:14}}>
                {[
                  {l:"Pendentes",v:promessas.filter(p=>p.STATUS_PROMESSA==="PENDENTE").length,c:YEL},
                  {l:"Cumpridas",v:promessas.filter(p=>p.STATUS_PROMESSA==="CUMPRIDA").length,c:GRN},
                  {l:"Quebradas",v:promessas.filter(p=>p.STATUS_PROMESSA==="QUEBRADA").length,c:RED},
                ].map(k=>(
                  <div key={k.l} style={{background:CARD,padding:18,borderRadius:12,border:`1px solid ${BD}`}}>
                    <div style={{fontSize:10,color:MUTED,fontWeight:600,textTransform:"uppercase",marginBottom:4}}>{k.l}</div>
                    <div style={{fontSize:26,fontWeight:900,color:k.c}}>{k.v}</div>
                  </div>
                ))}
              </div>
              <div style={{background:CARD,borderRadius:12,border:`1px solid ${BD}`,overflow:"hidden"}}>
                <div style={{padding:16,borderBottom:`1px solid ${BD}`,display:"flex",justifyContent:"space-between",alignItems:"center",flexWrap:"wrap",gap:10}}>
                  <div style={{display:"flex",gap:8}}>
                    {["todos","PENDENTE","CUMPRIDA","QUEBRADA"].map(f=>(
                      <button key={f} onClick={()=>setFiltroPromessa(f)} style={{padding:"6px 12px",borderRadius:8,border:`1px solid ${filtroPromessa===f?BLU:BD}`,background:filtroPromessa===f?BLU+"10":CARD,color:filtroPromessa===f?BLU:MUTED,cursor:"pointer",fontSize:12,fontWeight:600}}>
                        {f==="todos"?"Todos":f==="PENDENTE"?"Pendentes":f==="CUMPRIDA"?"Cumpridas":"Quebradas"}
                      </button>
                    ))}
                  </div>
                  <button onClick={()=>setNovaPromessa(true)} style={{padding:"8px 16px",borderRadius:8,border:"none",background:BLU,color:"#FFF",cursor:"pointer",fontSize:13,fontWeight:700}}>+ Nova Promessa</button>
                </div>
                {promessasFiltradas.length===0
                  ?<div style={{padding:"32px 18px",textAlign:"center",color:MUTED,fontSize:13}}>Nenhuma promessa encontrada.</div>
                  :<table style={{width:"100%",borderCollapse:"collapse",textAlign:"left"}}>
                    <thead><tr style={{background:BG,fontSize:11,color:MUTED,textTransform:"uppercase"}}>
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
                        <tr key={p.ID_PROMESSA||i} style={{borderBottom:`1px solid ${BD}`,fontSize:13,background:vencida?RED+"05":i%2===0?CARD:"#FAFAFA"}}>
                          <td style={{padding:"12px 18px"}}><div style={{fontWeight:700}}>{p.NOME_CLIENTE}</div><div style={{fontSize:11,color:MUTED}}>ID {p.ID_CLIENTE}</div></td>
                          <td style={{color:MUTED,fontWeight:600}}>{p.ID_CONTRATO}</td>
                          <td style={{fontWeight:600,color:vencida?RED:TEXT}}>{fmtDt(dtPrev)}{vencida&&<span style={{fontSize:10,color:RED,marginLeft:6,fontWeight:700}}>VENCIDA</span>}</td>
                          <td style={{color:MUTED}}>{fmtDt(parseDate(p.DATA_PROMESSA))}</td>
                          <td style={{fontWeight:700,color:BLU}}>{fmtR(parseFloat(p.VALOR_PROMETIDO||0))}</td>
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
                                  style={{padding:"4px 10px",borderRadius:6,border:`1px solid ${GRN}40`,background:GRN+"10",color:GRN,cursor:"pointer",fontSize:11,fontWeight:700,whiteSpace:"nowrap"}}
                                >✓ Cumprida</button>
                                <button
                                  onClick={async()=>{
                                    const res=await postAction({action:"atualizarPromessa",idPromessa:p.ID_PROMESSA,status:"QUEBRADA",dataCumprimento:hojeStr()});
                                    if(res.ok)carregar();else alert(res.erro||"Erro");
                                  }}
                                  style={{padding:"4px 10px",borderRadius:6,border:`1px solid ${RED}40`,background:RED+"10",color:RED,cursor:"pointer",fontSize:11,fontWeight:700,whiteSpace:"nowrap"}}
                                >✗ Quebrada</button>
                              </div>
                            )}
                          </td>
                        </tr>
                      );
                    })}</tbody>
                  </table>
                }
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

      {/* ── MODAIS ── */}
      {novaPromessa&&<NovaPromessaModal contratos={contratos||[]} clientes={clientes||[]} onConfirmar={()=>{setNovaPromessa(false);carregar();}} onFechar={()=>setNovaPromessa(false)}/>}
      {selCli&&<ClienteModal cliente={selCli} onFechar={()=>setSelCli(null)} onAtualizar={()=>{setSelCli(null);carregar();}}/>}
      {pagamentoHoje&&<PagamentoParcelaModal parcela={pagamentoHoje} onConfirmar={()=>{setPagamentoHoje(null);carregar();}} onFechar={()=>setPagamentoHoje(null)}/>}
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
          onRegistrarPagamento={p=>{setContratoSel(null);setPagamentoHoje(p);}}
          onBaixar={c=>{setContratoSel(null);setBaixaModal(c);}}
          onQuitacaoAntecipada={c=>{setContratoSel(null);setQuitacaoModal(c);}}
          onFechar={()=>setContratoSel(null)}
        />
      )}

      {/* ── MODAL COBRANÇA (NOVO) ── */}
      {cobModal&&(
        <CobrancaModal
          cliente={cobModal}
          parcelasCliente={cobModal.parcelasAtrasadas || []}
          onSucesso={()=>{ carregar(); }}
          onFechar={()=>setCobModal(null)}
        />
      )}
    </div>
  );
}

createRoot(document.getElementById("root")).render(<App/>);
