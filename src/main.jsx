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

// Função robusta para converter qualquer formato de moeda (R$ 340,00 ou 340.00) em número
const parseMoney = v => {
  if (typeof v === 'number') return v;
  if (!v) return 0;
  let s = String(v).replace(/[R$\s]/g, '').replace(/\./g, '').replace(',', '.');
  let n = parseFloat(s);
  return isNaN(n) ? 0 : n;
};

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
  d.setHours(12,0,0,0);
  return d;
}

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

function BaixaModal({contrato, parcelas, onConfirmar, onFechar}){
  const [dados, setDados] = useState({
    substatus:"FRAUDE_IDENTIFICADA", motivo:"", observacao:"",
    possibilidadeRecuperacao:"BAIXA", statusJuridico:"NAO_ANALISADO", proximaProvidencia:""
  });
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState(null);

  const ps = parcelas.filter(p=>String(p.ID_CONTRATO)===String(contrato.ID_CONTRATO));

  // Cálculos baseados 100% na aba PARCELAS
  const capitalEmprestadoTotal = ps.reduce((s,p)=>s + parseMoney(p.VALOR_PRINCIPAL), 0);
  const valorTotalContratual    = ps.reduce((s,p)=>s + parseMoney(p.VALOR_PARCELA), 0);
  
  const totalPago              = ps.filter(p=>p.STATUS==="pago").reduce((s,p)=>s + parseMoney(p.VALOR_PAGO), 0);
  const capitalRecuperado      = Math.min(totalPago, capitalEmprestadoTotal);
  const prejuizoCapital        = Math.max(0, capitalEmprestadoTotal - capitalRecuperado);
  
  // Juros não realizados: (Soma de todos os VALOR_JUROS das parcelas) - (Juros que já foram pagos)
  const jurosTotais            = ps.reduce((s,p)=>s + parseMoney(p.VALOR_JUROS), 0);
  const jurosJaPagos           = ps.filter(p=>p.STATUS==="pago").reduce((s,p)=>{
    const pago = parseMoney(p.VALOR_PAGO);
    const princ = parseMoney(p.VALOR_PRINCIPAL);
    return s + Math.max(0, pago - princ);
  }, 0);
  const jurosNaoReal           = Math.max(0, jurosTotais - jurosJaPagos);

  const pctRecuperado          = capitalEmprestadoTotal>0 ? (capitalRecuperado/capitalEmprestadoTotal*100) : 0;
  const diasAtraso             = ps.filter(p=>p.STATUS==="atrasado").length > 0
    ? Math.max(...ps.filter(p=>p.STATUS==="atrasado").map(p=>{ const dv=parseDate(p.DATA_VENCIMENTO); if(!dv)return 0; const d=Math.round((new Date()-dv)/86400000); return d>0?d:0; }))
    : 0;

  const confirmar = async () => {
    if (!dados.motivo){ setMsg({ok:false,texto:"Informe o motivo da baixa."}); return; }
    setLoading(true); setMsg(null);
    const res = await postAction({
      action:"baixarContrato", idContrato: contrato.ID_CONTRATO,
      dados:{ ...dados, diasAtraso, valorRecuperadoAntesBaixa: capitalRecuperado, jurosJaRecebidos: jurosJaPagos, data: hojeStr() }
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
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:16,marginBottom:24,padding:16,background:BG,borderRadius:10}}>
            <div><span style={LS}>Capital Emprestado</span><div style={{fontSize:15,fontWeight:700}}>{fmtR(capitalEmprestadoTotal)}</div></div>
            <div><span style={LS}>Capital Recuperado</span><div style={{fontSize:15,fontWeight:700,color:GRN}}>{fmtR(capitalRecuperado)}</div></div>
            <div style={{borderTop:`1px solid ${BD}`,paddingTop:8}}><span style={LS}>Prejuízo de Capital</span><div style={{fontSize:15,fontWeight:700,color:RED}}>{fmtR(prejuizoCapital)}</div></div>
            <div style={{borderTop:`1px solid ${BD}`,paddingTop:8}}><span style={LS}>Juros Não Realizados</span><div style={{fontSize:15,fontWeight:700,color:ORG}}>{fmtR(jurosNaoReal)}</div></div>
            <div style={{borderTop:`1px solid ${BD}`,paddingTop:8}}><span style={LS}>Total Pago</span><div style={{fontSize:15,fontWeight:700,color:BLU}}>{fmtR(totalPago)}</div></div>
            <div style={{borderTop:`1px solid ${BD}`,paddingTop:8}}><span style={LS}>% Recuperado</span><div style={{fontSize:15,fontWeight:700,color:RED}}>{fmtP(pctRecuperado)}</div></div>
            <div style={{gridColumn:"1/-1",borderTop:`1px solid ${BD}`,paddingTop:8}}><span style={LS}>Dias de Atraso (Máx)</span><div style={{fontSize:15,fontWeight:700,color:RED}}>{diasAtraso} dias</div></div>
          </div>
          <div style={{display:"flex",flexDirection:"column",gap:16}}>
            {campo("Substatus / Motivo Operacional","substatus",[
              {v:"FRAUDE_IDENTIFICADA",l:"Má-fé aparente"},
              {v:"CLIENTE_DESAPARECIDO",l:"Cliente Desaparecido / Sem Contato"},
              {v:"SEM_BENS_PENHORAVEIS",l:"Sem Bens ou Renda para Cobrança"},
              {v:"FALECIMENTO",l:"Falecimento do Titular"},
              {v:"ACORDO_VALOR_IRRISORIO",l:"Acordo (Valor Irrisório para Prosseguir)"}
            ])}
            {campo("Motivo Detalhado (Obrigatório)","motivo")}
            {campo("Possibilidade de Recuperação Futura","possibilidadeRecuperacao",[
              {v:"BAIXA",l:"Baixa — cliente pouco responsivo"},
              {v:"RECURSOS_FUTUROS",l:"Remota (Monitorar Renda Futura)"},
              {v:"JUDICIAL",l:"Judicial (Enviar para Advogado)"}
            ])}
            {campo("Status Jurídico","statusJuridico",[
              {v:"NAO_ANALISADO",l:"Não analisado"},
              {v:"ANALISE_INTERNA",l:"Análise Interna"},
              {v:"PROCESSO_AJUIZADO",l:"Processo Ajuizado"}
            ])}
            <div><span style={LS}>Próxima Providência</span><input value={dados.proximaProvidencia} onChange={e=>setDados(p=>({...p,proximaProvidencia:e.target.value}))} style={IS}/></div>
            <div><span style={LS}>Observação Adicional</span><textarea value={dados.observacao} onChange={e=>setDados(p=>({...p,observacao:e.target.value}))} style={{...IS,height:80,resize:"none"}}/></div>
          </div>
          {msg && <div style={{marginTop:16,padding:12,borderRadius:8,background:RED+"10",color:RED,fontSize:13,textAlign:"center",fontWeight:600}}>{msg.texto}</div>}
        </div>
        <div style={{padding:20,borderTop:`1px solid ${BD}`,display:"flex",gap:12}}>
          <button onClick={onFechar} style={{flex:1,padding:12,borderRadius:8,border:`1px solid ${BD}`,background:CARD,cursor:"pointer",fontWeight:600}}>Cancelar</button>
          <button onClick={confirmar} disabled={loading} style={{flex:2,padding:12,borderRadius:8,border:"none",background:RED,color:"#FFF",cursor:"pointer",fontWeight:700,opacity:loading?0.7:1}}>{loading?"Processando...":"Confirmar Baixa como Prejuízo"}</button>
        </div>
      </div>
    </div>
  );
}

function ModalAcordoPerda({ contrato, parcelas, onConfirmar, onFechar }) {
  const [valorAcordo, setValorAcordo] = useState("");
  const [loading, setLoading] = useState(false);

  const abertas = parcelas.filter(p => String(p.ID_CONTRATO) === String(contrato.ID_CONTRATO) && p.STATUS !== "pago");
  const principalAberto = abertas.reduce((s, p) => s + parseMoney(p.VALOR_PRINCIPAL), 0);
  const jurosAberto = abertas.reduce((s, p) => s + parseMoney(p.VALOR_JUROS), 0);
  
  const vAcordo = parseMoney(valorAcordo);
  const principalPerdido = Math.max(0, principalAberto - vAcordo);
  const jurosCancelados = jurosAberto;

  const confirmar = async () => {
    if (!valorAcordo) return;
    setLoading(true);
    const res = await postAction({
      action: "registrarAcordoComPerda",
      idContrato: contrato.ID_CONTRATO,
      valorRecebidoAcordo: vAcordo,
      observacao: "Acordo realizado via painel"
    });
    if (res.ok) onConfirmar();
    setLoading(false);
  };

  return (
    <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.5)",zIndex:400,display:"flex",alignItems:"center",justifyContent:"center",padding:20}}>
      <div style={{background:CARD,borderRadius:12,width:"100%",maxWidth:450,padding:24,boxShadow:"0 20px 60px rgba(0,0,0,0.2)"}}>
        <h2 style={{fontSize:18,fontWeight:800,margin:"0 0 8px"}}>🤝 Liquidação com Desconto</h2>
        <p style={{fontSize:13,color:MUTED,margin:"0 0 20px"}}>{contrato.ID_CONTRATO} — {contrato.NOME_CLIENTE}</p>
        
        <div style={{background:BG,padding:16,borderRadius:10,marginBottom:20}}>
          <div style={{display:"flex",justifyContent:"space-between",fontSize:12,color:MUTED,marginBottom:4}}><span>Saldo Principal:</span><strong>{fmtR(principalAberto)}</strong></div>
          <div style={{display:"flex",justifyContent:"space-between",fontSize:12,color:MUTED}}><span>Saldo Juros:</span><strong>{fmtR(jurosAberto)}</strong></div>
        </div>

        <div style={{marginBottom:20}}>
          <span style={LS}>Valor do Acordo (Recebido)</span>
          <input type="text" value={valorAcordo} onChange={e=>setValorAcordo(e.target.value)} placeholder="R$ 0,00" style={{...IS,fontSize:18,fontWeight:700,textAlign:"center"}} />
        </div>

        <div style={{padding:16,borderRadius:10,background:RED+"10",border:`1px solid ${RED}30`}}>
          <div style={{display:"flex",justifyContent:"space-between",fontSize:13,color:RED}}><span>Prejuízo Real (Principal):</span><strong>{fmtR(principalPerdido)}</strong></div>
          <div style={{display:"flex",justifyContent:"space-between",fontSize:13,color:MUTED,marginTop:5}}><span>Juros Cancelados:</span><strong>{fmtR(jurosCancelados)}</strong></div>
        </div>

        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12,marginTop:24}}>
          <button onClick={onFechar} style={{padding:12,borderRadius:8,border:`1px solid ${BD}`,background:"none",cursor:"pointer"}}>Cancelar</button>
          <button onClick={confirmar} disabled={loading} style={{padding:12,borderRadius:8,border:"none",background:RED,color:"#FFF",fontWeight:700,cursor:"pointer",opacity:loading?0.7:1}}>
            {loading ? "Processando..." : "Confirmar Perda"}
          </button>
        </div>
      </div>
    </div>
  );
}

function RecuperacaoModal({contrato, onConfirmar, onFechar}){
  const [valor, setValor] = useState("");
  const [loading, setLoading] = useState(false);
  const confirmar = async () => {
    if(!valor) return;
    setLoading(true);
    const res = await postAction({ action:"recuperacaoAposBaixa", idContrato: contrato.ID_CONTRATO, valor: parseMoney(valor) });
    if(res.ok) onConfirmar();
    setLoading(false);
  };
  return (
    <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.5)",zIndex:400,display:"flex",alignItems:"center",justifyContent:"center",padding:20}}>
      <div style={{background:CARD,borderRadius:12,width:400,padding:24}}>
        <h3 style={{margin:"0 0 16px"}}>Registrar Recuperação</h3>
        <p style={{fontSize:13,color:MUTED,marginBottom:20}}>Informe o valor recuperado para o contrato {contrato.ID_CONTRATO}.</p>
        <div style={{marginBottom:20}}><span style={LS}>Valor Recuperado</span><input value={valor} onChange={e=>setValor(e.target.value)} style={{...IS,fontSize:16,fontWeight:700}} placeholder="R$ 0,00"/></div>
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12}}>
          <button onClick={onFechar} style={{padding:12,borderRadius:8,border:`1px solid ${BD}`,background:CARD}}>Cancelar</button>
          <button onClick={confirmar} disabled={loading} style={{padding:12,borderRadius:8,border:"none",background:PUR,color:"#FFF",fontWeight:700}}>{loading?"...":"Confirmar"}</button>
        </div>
      </div>
    </div>
  );
}

function ClienteModal({cliente, onFechar, onSucesso}){
  return (
    <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.6)",zIndex:300,display:"flex",alignItems:"center",justifyContent:"center",padding:20}}>
      <div style={{background:CARD,borderRadius:16,width:"100%",maxWidth:800,maxHeight:"90vh",display:"flex",flexDirection:"column",overflow:"hidden",boxShadow:"0 25px 50px -12px rgba(0,0,0,0.25)"}}>
        <div style={{padding:24,borderBottom:`1px solid ${BD}`,display:"flex",justifyContent:"space-between",alignItems:"center"}}>
          <div><h2 style={{margin:0,fontSize:20,fontWeight:800}}>{cliente.NOME_CLIENTE}</h2><div style={{fontSize:12,color:MUTED,marginTop:4}}>ID: {cliente.ID_CLIENTE} • {cliente.CIDADE}/{cliente.UF}</div></div>
          <button onClick={onFechar} style={{background:BG,border:"none",width:32,height:32,borderRadius:8,cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center"}}>{Ico.arr}</button>
        </div>
        <div style={{padding:24,overflowY:"auto",background:BG+"40",flex:1}}>
          <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:16,marginBottom:24}}>
            <div style={{background:CARD,padding:16,borderRadius:12,border:`1px solid ${BD}`}}><div style={LS}>Total Emprestado</div><div style={{fontSize:18,fontWeight:800,color:BLU}}>{fmtR(cliente.totalEmp)}</div></div>
            <div style={{background:CARD,padding:16,borderRadius:12,border:`1px solid ${BD}`}}><div style={LS}>Saldo Devedor</div><div style={{fontSize:18,fontWeight:800,color:RED}}>{fmtR(cliente.saldoDev)}</div></div>
            <div style={{background:CARD,padding:16,borderRadius:12,border:`1px solid ${BD}`}}><div style={LS}>Atraso Atual</div><div style={{fontSize:18,fontWeight:800,color:cliente.maxAtraso>0?RED:GRN}}>{cliente.maxAtraso} dias</div></div>
          </div>
        </div>
      </div>
    </div>
  );
}

function PagamentoDrop({contratos, parcelas, onSucesso}){
  const [loading, setLoading] = useState(false);
  const registrar = async (idP, valor) => {
    setLoading(true);
    await postAction({ action:"pagamento", idParcela: idP, valorPago: valor, dataPagamento: hojeStr() });
    onSucesso();
    setLoading(false);
  };
  return (
    <div style={{background:CARD,padding:20,borderRadius:12,border:`1px solid ${BD}`}}>
      <h3 style={{margin:"0 0 16px",fontSize:15,fontWeight:700,display:"flex",alignItems:"center",gap:8}}>{Ico.pag} Baixa Rápida</h3>
      <div style={{display:"flex",flexDirection:"column",gap:8,maxHeight:200,overflowY:"auto"}}>
        {parcelas.filter(p=>p.STATUS==="atrasado").slice(0,5).map(p=>(
          <div key={p.ID_PARCELA} style={{padding:10,background:BG,borderRadius:8,display:"flex",justifyContent:"space-between",alignItems:"center"}}>
            <div style={{fontSize:12}}><div style={{fontWeight:700}}>{p.NOME_CLIENTE.split(" ")[0]}</div><div style={{color:MUTED}}>{p.ID_CONTRATO} • Parc {p.NUM_PARCELA}</div></div>
            <button onClick={()=>registrar(p.ID_PARCELA, parseMoney(p.VALOR_PARCELA))} disabled={loading} style={{padding:"5px 10px",background:GRN,color:"#FFF",border:"none",borderRadius:6,fontSize:11,fontWeight:700,cursor:"pointer"}}>Pagar {fmtR(p.VALOR_PARCELA)}</button>
          </div>
        ))}
      </div>
    </div>
  );
}

function NovoContrato({contratos, onSucesso}){
  return (
    <div style={{background:BLU,padding:20,borderRadius:12,color:"#FFF",display:"flex",flexDirection:"column",gap:12}}>
      <div style={{display:"flex",alignItems:"center",gap:10}}><div style={{background:"rgba(255,255,255,0.2)",padding:8,borderRadius:8}}>{Ico.novo}</div><div style={{fontWeight:700,fontSize:15}}>Novo Empréstimo</div></div>
      <p style={{margin:0,fontSize:12,opacity:0.9}}>Inicie um novo contrato de crédito para um cliente cadastrado.</p>
      <button style={{width:"100%",padding:10,background:"#FFF",color:BLU,border:"none",borderRadius:8,fontWeight:700,cursor:"pointer",marginTop:5}}>Criar Contrato</button>
    </div>
  );
}

function App() {
  const [tab, setTab] = useState("dashboard");
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [raw, setRaw] = useState(null);
  const [loading, setLoading] = useState(true);
  const [filtroBusca, setFiltroBusca] = useState("");
  const [filtroStatus, setFiltroStatus] = useState("todos");
  const [filtroPerdas, setFiltroPerdas] = useState("todos");
  const [selCli, setSelCli] = useState(null);
  const [baixaModal, setBaixaModal] = useState(null);
  const [acordoModal, setAcordoModal] = useState(null);
  const [recuperacaoModal, setRecuperacaoModal] = useState(null);
  const [simVal, setSimVal] = useState(10000);
  const [simInad, setSimInad] = useState(10);
  const [simVol, setSimVol] = useState(5);

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

  const { clientes, contratos, parcelas, pagamentos } = useMemo(() => {
    if(!raw) return { clientes:[], contratos:[], parcelas:[], pagamentos:[] };
    const normalize = (arr) => (arr || []).map(obj => {
      const n = {};
      for(let k in obj) n[k.toUpperCase()] = obj[k];
      return n;
    });
    return {
      clientes: normalize(raw.CLIENTES),
      contratos: normalize(raw.CONTRATOS),
      parcelas: normalize(raw.PARCELAS),
      pagamentos: normalize(raw.PAGAMENTOS)
    };
  }, [raw]);

  const M = useMemo(() => {
    const ativos = contratos.filter(c => !["quitado","cancelado"].includes(c.STATUS_CONTRATO));
    const vAtivos = ativos.reduce((s,c) => s + parseMoney(c.VALOR_PRINCIPAL), 0);
    const vAtrasoTotal = parcelas.filter(p => p.STATUS === "atrasado").reduce((s,p) => s + parseMoney(p.VALOR_PARCELA), 0);
    const lucroTotal = parcelas.reduce((s,p) => s + parseMoney(p.VALOR_JUROS), 0);
    return { vAtivos, vAtrasoTotal, lucroTotal, taxaInad: vAtivos>0 ? (vAtrasoTotal/vAtivos*100) : 0 };
  }, [contratos, parcelas]);

  const filtrados = useMemo(() => {
    return clientes.map(c => {
      const ccs = contratos.filter(ct => String(ct.ID_CLIENTE) === String(c.ID_CLIENTE));
      const pps = parcelas.filter(p => String(p.ID_CLIENTE) === String(c.ID_CLIENTE));
      const totalEmp = ccs.reduce((s,ct) => s + parseMoney(ct.VALOR_PRINCIPAL), 0);
      const saldoDev = pps.filter(p => p.STATUS !== "pago").reduce((s,p) => s + parseMoney(p.VALOR_PARCELA), 0);
      const vAtraso = pps.filter(p => p.STATUS === "atrasado").reduce((s,p) => s + parseMoney(p.VALOR_PARCELA), 0);
      const maxAtraso = pps.filter(p => p.STATUS === "atrasado").reduce((m,p) => {
        const dv = parseDate(p.DATA_VENCIMENTO);
        if(!dv) return m;
        const d = Math.round((new Date() - dv) / 86400000);
        return d > m ? d : m;
      }, 0);
      return { ...c, totalEmp, saldoDev, vAtraso, maxAtraso };
    }).filter(c => {
      const matchB = c.NOME_CLIENTE.toLowerCase().includes(filtroBusca.toLowerCase()) || String(c.ID_CLIENTE).includes(filtroBusca);
      const matchS = filtroStatus === "todos" || c.STATUS_CLIENTE === filtroStatus;
      return matchB && matchS;
    });
  }, [clientes, contratos, parcelas, filtroBusca, filtroStatus]);

  const cobItems = useMemo(() => {
    return filtrados.filter(c => c.maxAtraso > 0).sort((a,b) => b.maxAtraso - a.maxAtraso);
  }, [filtrados]);

  const perdas = useMemo(() => {
    const p = contratos.filter(c => STATUS_PERDA.includes(c.STATUS_CONTRATO));
    const capitalBaixado = p.reduce((s,c) => s + parseMoney(c.PREJUIZO_CAPITAL), 0);
    const recuperadoAposBaixa = p.reduce((s,c) => s + parseMoney(c.VALOR_RECUPERADO_APOS_BAIXA), 0);
    return { capitalBaixado, recuperadoAposBaixa, prejuizoTotal: capitalBaixado - recuperadoAposBaixa, txRecuperacao: capitalBaixado>0 ? (recuperadoAposBaixa/capitalBaixado*100) : 0 };
  }, [contratos]);

  const pFiltradas = useMemo(() => {
    return contratos.filter(c => STATUS_PERDA.includes(c.STATUS_CONTRATO) && (filtroPerdas === "todos" || c.STATUS_CONTRATO === filtroPerdas));
  }, [contratos, filtroPerdas]);

  const mensal = useMemo(() => {
    const meses = ["Jan","Fev","Mar","Abr","Mai","Jun","Jul","Ago","Set","Out","Nov","Dez"];
    return meses.map((m, i) => {
      const v = parcelas.filter(p => {
        const d = parseDate(p.DATA_PAGAMENTO || p.DATA_VENCIMENTO);
        return d && d.getMonth() === i && (p.STATUS === "pago" || p.STATUS === "atrasado");
      }).reduce((s,p) => s + parseMoney(p.VALOR_PAGO || p.VALOR_PARCELA), 0);
      return { m, v };
    });
  }, [parcelas]);

  const NavItem = ({id, label, ico}) => (
    <div onClick={()=>setTab(id)} style={{display:"flex",alignItems:"center",gap:12,padding:"12px 16px",borderRadius:10,cursor:"pointer",background:tab===id?BLU:"transparent",color:tab===id?"#FFF":MUTED,marginBottom:4,transition:"0.2s"}} onMouseEnter={e=>tab!==id&&(e.currentTarget.style.background=BG)} onMouseLeave={e=>tab!==id&&(e.currentTarget.style.background="transparent")}>
      {ico} <span style={{fontSize:14,fontWeight:600}}>{label}</span>
    </div>
  );

  if(loading && !raw) return <div style={{height:"100vh",display:"flex",alignItems:"center",justifyContent:"center",background:BG}}><div style={{textAlign:"center"}}><div style={{width:40,height:40,border:`4px solid ${BD}`,borderTopColor:BLU,borderRadius:"50%",animation:"spin 1s linear infinite",margin:"0 auto 15px"}}/><div style={{fontSize:14,color:MUTED,fontWeight:600}}>Carregando FinanceiroOp...</div></div><style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style></div>;

  return (
    <div style={{display:"flex",height:"100vh",background:BG,color:TEXT,fontFamily:"'Inter', sans-serif"}}>
      <div style={{width:sidebarOpen?SW:0,background:CARD,borderRight:`1px solid ${BD}`,display:"flex",flexDirection:"column",overflow:"hidden",transition:"0.3s"}}>
        <div style={{padding:24,display:"flex",alignItems:"center",gap:12,borderBottom:`1px solid ${BD}`}}><div style={{width:32,height:32,background:BLU,borderRadius:8,display:"flex",alignItems:"center",justifyContent:"center",color:"#FFF"}}>{Ico.fin}</div><span style={{fontWeight:800,fontSize:18,letterSpacing:"-0.5px"}}>Financeiro<span style={{color:BLU}}>Op</span></span></div>
        <div style={{padding:16,flex:1}}>
          <NavItem id="dashboard" label="Dashboard" ico={Ico.dash}/>
          <NavItem id="clientes" label="Clientes" ico={Ico.cli}/>
          <NavItem id="cobranca" label="Cobrança" ico={Ico.cob}/>
          <NavItem id="perdas" label="Perdas & Recuperação" ico={Ico.loss}/>
          <NavItem id="simulador" label="Simulador" ico={Ico.sim}/>
        </div>
      </div>

      <div style={{flex:1,display:"flex",flexDirection:"column",overflow:"hidden"}}>
        <header style={{height:64,background:CARD,borderBottom:`1px solid ${BD}`,display:"flex",alignItems:"center",justifyContent:"space-between",padding:"0 24px",zIndex:10}}>
          <div style={{display:"flex",alignItems:"center",gap:15}}><button onClick={()=>setSidebarOpen(!sidebarOpen)} style={{background:BG,border:"none",padding:8,borderRadius:8,cursor:"pointer",color:MUTED}}>{Ico.arr}</button><h2 style={{fontSize:18,fontWeight:700,margin:0}}>{tab.charAt(0).toUpperCase()+tab.slice(1)}</h2></div>
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
                <thead><tr style={{background:BG,fontSize:11,color:MUTED,textTransform:"uppercase"}}><th style={{padding:"12px 20px"}}>Cliente</th><th>Status</th><th>Empréstimo Total</th><th>Saldo Devedor</th><th>Atraso</th><th style={{padding:"12px 20px",textAlign:"right"}}>Ações</th></tr></thead>
                <tbody>
                  {filtrados.map(c=>(
                    <tr key={c.ID_CLIENTE} style={{borderBottom:`1px solid ${BD}`,fontSize:13}}>
                      <td style={{padding:"15px 20px"}}><div style={{fontWeight:700}}>{c.NOME_CLIENTE}</div><div style={{fontSize:11,color:MUTED}}>{c.ID_CLIENTE}</div></td>
                      <td><Badge c={c.STATUS_CLIENTE==="ativo"?GRN:YEL}>{c.STATUS_CLIENTE?.toUpperCase()}</Badge></td>
                      <td>{fmtR(c.totalEmp)}</td>
                      <td style={{fontWeight:600}}>{fmtR(c.saldoDev)}</td>
                      <td style={{color:c.maxAtraso>0?RED:MUTED}}>{c.maxAtraso>0?`${fmtR(c.vAtraso)} (${c.maxAtraso}d)`:"—"}</td>
                      <td style={{padding:"15px 20px",textAlign:"right"}}><button onClick={()=>setSelCli(c)} style={{padding:"6px 12px",borderRadius:6,border:`1px solid ${BD}`,background:CARD,cursor:"pointer",fontSize:12,fontWeight:600}}>Detalhes</button></td>
                    </tr>
                  ))}
                </tbody>
              </table>
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
                          <button onClick={()=>setAcordoModal(c)} style={{padding:"6px 10px",borderRadius:6,border:`1px solid ${ORG}30`,background:ORG+"08",color:ORG,cursor:"pointer",fontSize:11,fontWeight:700}}>🤝 Acordo</button>
                          <button onClick={()=>setRecuperacaoModal(c)} style={{padding:"6px 10px",borderRadius:6,border:`1px solid ${PUR}30`,background:PUR+"08",color:PUR,cursor:"pointer",fontSize:11,fontWeight:700}}>Recuperar</button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </main>
      </div>

      {/* MODALS */}
      {selCli && <ClienteModal cliente={selCli} onFechar={()=>setSelCli(null)} onSucesso={carregar}/>}
      {baixaModal && <BaixaModal contrato={baixaModal} parcelas={parcelas} onConfirmar={()=>{setBaixaModal(null);carregar();}} onFechar={()=>setBaixaModal(null)}/>}
      {acordoModal && <ModalAcordoPerda contrato={acordoModal} parcelas={parcelas} onConfirmar={()=>{setAcordoModal(null);carregar();}} onFechar={()=>setAcordoModal(null)}/>}
      {recuperacaoModal && <RecuperacaoModal contrato={recuperacaoModal} onConfirmar={()=>{setRecuperacaoModal(null);carregar();}} onFechar={()=>setRecuperacaoModal(null)}/>}
    </div>
  );
}

createRoot(document.getElementById("root")).render(<App />);
