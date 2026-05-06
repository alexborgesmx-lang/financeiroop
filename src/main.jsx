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

const parseMoney = v => {
  if (typeof v === 'number') return v;
  if (!v) return 0;
  let s = String(v).replace(/[R$\s]/g, '').replace(/\./g, '').replace(',', '.');
  let n = parseFloat(s);
  return isNaN(n) ? 0 : n;
};

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

async function postAction(body){ 
  const r = await fetch(POST_URL,{
    method:"POST",
    headers:{"Content-Type":"application/json"},
    body:JSON.stringify(body)
  }); 
  return r.json(); 
}

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

const Ico = {
  dash:  <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/></svg>,
  cli:   <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="9" cy="7" r="4"/><path d="M3 21v-2a4 4 0 0 1 4-4h4a4 4 0 0 1 4 4v2"/></svg>,
  arr:   <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="9,18 15,12 9,6"/></svg>,
  fin:   <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>,
};

function Badge({c,children}){ return <span style={{display:"inline-flex",alignItems:"center",padding:"3px 8px",borderRadius:20,fontSize:10,fontWeight:600,background:c+"18",color:c,border:`1px solid ${c}30`}}>{children}</span>; }

function BaixaModal({contrato, parcelas, onConfirmar, onFechar}){
  const [dados, setDados] = useState({
    substatus:"FRAUDE_IDENTIFICADA", motivo:"", observacao:"",
    possibilidadeRecuperacao:"BAIXA", statusJuridico:"NAO_ANALISADO", proximaProvidencia:""
  });
  const [loading, setLoading] = useState(false);
  const ps = parcelas.filter(p=>String(p.ID_CONTRATO)===String(contrato.ID_CONTRATO));
  const capitalEmprestadoTotal = ps.reduce((s,p)=>s + parseMoney(p.VALOR_PRINCIPAL), 0);
  const totalPago              = ps.filter(p=>p.STATUS==="pago").reduce((s,p)=>s + parseMoney(p.VALOR_PAGO), 0);
  const capitalRecuperado      = Math.min(totalPago, capitalEmprestadoTotal);
  const prejuizoCapital        = Math.max(0, capitalEmprestadoTotal - capitalRecuperado);
  const jurosNaoReal           = ps.reduce((s,p)=>s + parseMoney(p.VALOR_JUROS), 0);
  const pctRecuperado          = capitalEmprestadoTotal>0 ? (capitalRecuperado/capitalEmprestadoTotal*100) : 0;
  const diasAtraso             = ps.filter(p=>p.STATUS==="atrasado").length > 0
    ? Math.max(...ps.filter(p=>p.STATUS==="atrasado").map(p=>{ const dv=parseDate(p.DATA_VENCIMENTO); if(!dv)return 0; const d=Math.round((new Date()-dv)/86400000); return d>0?d:0; }))
    : 0;

  const confirmar = async () => {
    if (!dados.motivo) return;
    setLoading(true);
    const res = await postAction({
      action:"baixarContrato", idContrato: contrato.ID_CONTRATO,
      dados:{ ...dados, diasAtraso, valorRecuperadoAntesBaixa: capitalRecuperado, jurosJaRecebidos: 0, data: hojeStr() }
    });
    if(res.ok) onConfirmar();
    setLoading(false);
  };

  return (
    <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.5)",zIndex:400,display:"flex",alignItems:"center",justifyContent:"center",padding:20}}>
      <div style={{background:CARD,borderRadius:12,width:"100%",maxWidth:600,maxHeight:"90vh",display:"flex",flexDirection:"column"}}>
        <div style={{padding:24,borderBottom:`1px solid ${BD}`,background:"#FEF2F2"}}>
          <h2 style={{color:RED,fontSize:17,margin:0}}>⚠️ Baixar Contrato como Prejuízo</h2>
          <p style={{fontSize:13,color:MUTED}}>{contrato.ID_CONTRATO} • {contrato.NOME_CLIENTE}</p>
        </div>
        <div style={{padding:24,overflowY:"auto",flex:1}}>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:16,marginBottom:24,padding:16,background:BG,borderRadius:10}}>
            <div><span style={LS}>Capital Emprestado</span><div style={{fontSize:15,fontWeight:700}}>{fmtR(capitalEmprestadoTotal)}</div></div>
            <div><span style={LS}>Capital Recuperado</span><div style={{fontSize:15,fontWeight:700,color:GRN}}>{fmtR(capitalRecuperado)}</div></div>
            <div><span style={LS}>Prejuízo de Capital</span><div style={{fontSize:15,fontWeight:700,color:RED}}>{fmtR(prejuizoCapital)}</div></div>
            <div><span style={LS}>Juros Não Realizados</span><div style={{fontSize:15,fontWeight:700,color:ORG}}>{fmtR(jurosNaoReal)}</div></div>
          </div>
          <div><span style={LS}>Motivo Detalhado</span><input value={dados.motivo} onChange={e=>setDados(p=>({...p,motivo:e.target.value}))} style={IS}/></div>
        </div>
        <div style={{padding:20,borderTop:`1px solid ${BD}`,display:"flex",gap:12}}>
          <button onClick={onFechar} style={{flex:1,padding:12,borderRadius:8,border:`1px solid ${BD}`,background:CARD}}>Cancelar</button>
          <button onClick={confirmar} disabled={loading} style={{flex:2,padding:12,borderRadius:8,border:"none",background:RED,color:"#FFF"}}>{loading?"...":"Confirmar"}</button>
        </div>
      </div>
    </div>
  );
}

function App() {
  const [tab, setTab] = useState("dashboard");
  const [raw, setRaw] = useState(null);
  const [loading, setLoading] = useState(true);
  const [filtroBusca, setFiltroBusca] = useState("");
  const [baixaModal, setBaixaModal] = useState(null);

  const carregar = async () => {
    setLoading(true);
    try {
      const res = await fetch(API_URL);
      const data = await res.json();
      setRaw(data);
    } catch (e) { console.error(e); }
    setLoading(false);
  };
  useEffect(() => { carregar(); }, []);

  const { clientes, contratos, parcelas } = useMemo(() => {
    if(!raw) return { clientes:[], contratos:[], parcelas:[] };
    const normalize = (arr) => (arr || []).map(obj => {
      const n = {};
      for(let k in obj) n[k.toUpperCase()] = obj[k];
      return n;
    });
    return {
      clientes: normalize(raw.CLIENTES),
      contratos: normalize(raw.CONTRATOS),
      parcelas: normalize(raw.PARCELAS)
    };
  }, [raw]);

  const M = useMemo(() => {
    const ativos = contratos.filter(c => !["quitado","cancelado"].includes(c.STATUS_CONTRATO));
    const vAtivos = ativos.reduce((s,c) => s + parseMoney(c.VALOR_PRINCIPAL), 0);
    const vAtrasoTotal = parcelas.filter(p => p.STATUS === "atrasado").reduce((s,p) => s + parseMoney(p.VALOR_PARCELA), 0);
    return { vAtivos, vAtrasoTotal };
  }, [contratos, parcelas]);

  const filtrados = useMemo(() => {
    return clientes.filter(c => {
      const nome = c.NOME_CLIENTE || ""; // Proteção contra nome nulo
      return nome.toLowerCase().includes(filtroBusca.toLowerCase());
    });
  }, [clientes, filtroBusca]);

  if(loading && !raw) return <div style={{height:"100vh",display:"flex",alignItems:"center",justifyContent:"center",background:BG}}>Carregando...</div>;

  return (
    <div style={{display:"flex",height:"100vh",background:BG,color:TEXT,fontFamily:"sans-serif"}}>
      <div style={{width:SW,background:CARD,borderRight:`1px solid ${BD}`}}>
        <div style={{padding:24,fontWeight:800}}>FinanceiroOp</div>
        <div style={{padding:16}}>
          <div onClick={()=>setTab("dashboard")} style={{padding:12,cursor:"pointer",color:tab==="dashboard"?BLU:MUTED}}>Dashboard</div>
          <div onClick={()=>setTab("clientes")} style={{padding:12,cursor:"pointer",color:tab==="clientes"?BLU:MUTED}}>Clientes</div>
          <div onClick={()=>setTab("perdas")} style={{padding:12,cursor:"pointer",color:tab==="perdas"?BLU:MUTED}}>Perdas</div>
        </div>
      </div>

      <div style={{flex:1,display:"flex",flexDirection:"column"}}>
        <header style={{height:64,background:CARD,borderBottom:`1px solid ${BD}`,display:"flex",alignItems:"center",padding:"0 24px"}}>
          <h2 style={{fontSize:18}}>{tab.toUpperCase()}</h2>
        </header>

        <main style={{flex:1,overflowY:"auto",padding:24}}>
          {tab==="dashboard" && (
            <div style={{display:"grid",gridTemplateColumns:"repeat(2,1fr)",gap:20}}>
              <div style={{background:CARD,padding:20,borderRadius:12,border:`1px solid ${BD}`}}>Total Aberto: {fmtR(M.vAtivos)}</div>
              <div style={{background:CARD,padding:20,borderRadius:12,border:`1px solid ${BD}`}}>Em Atraso: {fmtR(M.vAtrasoTotal)}</div>
            </div>
          )}

          {tab==="clientes" && (
            <div style={{background:CARD,borderRadius:12,border:`1px solid ${BD}`}}>
              <input placeholder="Buscar..." value={filtroBusca} onChange={e=>setFiltroBusca(e.target.value)} style={{margin:20,padding:10,width:300}}/>
              <table style={{width:"100%",borderCollapse:"collapse"}}>
                <thead><tr style={{background:BG,textAlign:"left"}}><th style={{padding:12}}>Nome</th></tr></thead>
                <tbody>
                  {filtrados.map(c=>(
                    <tr key={c.ID_CLIENTE} style={{borderBottom:`1px solid ${BD}`}}><td style={{padding:12}}>{c.NOME_CLIENTE}</td></tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {tab==="perdas" && (
            <div style={{background:CARD,borderRadius:12,border:`1px solid ${BD}`}}>
              <table style={{width:"100%",borderCollapse:"collapse"}}>
                <thead><tr style={{background:BG,textAlign:"left"}}><th style={{padding:12}}>Contrato</th><th>Ações</th></tr></thead>
                <tbody>
                  {contratos.filter(c=>STATUS_PERDA.includes(c.STATUS_CONTRATO)).map(c=>(
                    <tr key={c.ID_CONTRATO} style={{borderBottom:`1px solid ${BD}`}}>
                      <td style={{padding:12}}>{c.ID_CONTRATO} - {c.NOME_CLIENTE}</td>
                      <td><button onClick={()=>setBaixaModal(c)} style={{color:RED}}>Baixar</button></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </main>
      </div>

      {baixaModal && <BaixaModal contrato={baixaModal} parcelas={parcelas} onConfirmar={()=>{setBaixaModal(null);carregar();}} onFechar={()=>setBaixaModal(null)}/>}
    </div>
  );
}

createRoot(document.getElementById("root")).render(<App />);
