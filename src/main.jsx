import React, { useState, useMemo, useEffect } from "react";
import { createRoot } from "react-dom/client";
import { AreaChart, Area, BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, CartesianGrid } from "recharts";

const API_URL = "https://script.google.com/macros/s/AKfycbynQKpafDbaBTT-jqs4nCSzbbx8A72MAqDyGxwy86lIt0ykZxeFT8IdlO7zjj0rJEHy7Q/exec";

const BG="#0d1117",CARD="#161b22",BORDER="#30363d",TEXT="#e6edf3";
const MUTED="#8b949e",BLUE="#58a6ff",GREEN="#3fb950",YEL="#d29922",RED="#f85149",PUR="#bc8cff";
const R=v=>"R$ "+Number(v).toLocaleString("pt-BR",{minimumFractionDigits:2,maximumFractionDigits:2});
const P=v=>Number(v).toFixed(1)+"%";

function parseDate(v){
  if(!v) return null;
  if(v instanceof Date) return v;
  const d=new Date(v);
  return isNaN(d)?null:d;
}

function App(){
  const [tab,setTab]=useState("dashboard");
  const [raw,setRaw]=useState(null);
  const [loading,setLoading]=useState(true);
  const [erro,setErro]=useState(null);
  const [selCli,setSelCli]=useState(null);
  const [simVal,setSimVal]=useState(5000);
  const [simInad,setSimInad]=useState(0);
  const [simVol,setSimVol]=useState(0);
  const [filtroStatus,setFiltroStatus]=useState("todos");
  const [filtroBusca,setFiltroBusca]=useState("");

  const carregar=()=>{
    setLoading(true);setErro(null);
    fetch(API_URL+"?acao=dados")
      .then(r=>r.json())
      .then(d=>{if(d.erro)throw new Error(d.erro);setRaw(d);setLoading(false);})
      .catch(e=>{setErro(e.message);setLoading(false);});
  };
  useEffect(()=>{carregar();},[]);

  const{clientes,contratos,parcelas,M,cobItems,mensal,projecao}=useMemo(()=>{
    if(!raw)return{clientes:[],contratos:[],parcelas:[],M:{},cobItems:[],mensal:[],projecao:[]};
    const parcelas=(raw.PARCELAS||[]).map(p=>({...p,
      DATA_VENCIMENTO:parseDate(p.DATA_VENCIMENTO),
      DATA_PAGAMENTO:parseDate(p.DATA_PAGAMENTO),
      VALOR_PARCELA:parseFloat(p.VALOR_PARCELA)||0,
      VALOR_PRINCIPAL:parseFloat(p.VALOR_PRINCIPAL)||0,
      VALOR_JUROS:parseFloat(p.VALOR_JUROS)||0,
      VALOR_PAGO:parseFloat(p.VALOR_PAGO)||0,
      DIAS_ATRASO:parseInt(p.DIAS_ATRASO)||0,
      NUM_PARCELA:parseInt(p.NUM_PARCELA)||0,
      TOTAL_PARCELAS:parseInt(p.TOTAL_PARCELAS)||0,
    }));
    const contratos=(raw.CONTRATOS||[]).map(c=>({...c,
      VALOR_PRINCIPAL:parseFloat(c.VALOR_PRINCIPAL)||0,
      VALOR_PARCELA:parseFloat(c.VALOR_PARCELA)||0,
      VALOR_TOTAL_FINAL:parseFloat(c.VALOR_TOTAL_FINAL)||0,
      VALOR_JUROS:parseFloat(c.VALOR_JUROS)||0,
      NUM_PARCELAS:parseInt(c.NUM_PARCELAS)||0,
      "TAXA_MENSAL_%":parseFloat(c["TAXA_MENSAL_%"])||0,
    }));
    const clientes=(raw.CLIENTES||[]).map(cl=>{
      const cs=contratos.filter(c=>String(c.ID_CLIENTE)===String(cl.ID_CLIENTE));
      const ps=parcelas.filter(p=>String(p.ID_CLIENTE)===String(cl.ID_CLIENTE));
      const totalPago=ps.filter(p=>p.STATUS==="pago").reduce((s,p)=>s+(p.VALOR_PAGO||p.VALOR_PARCELA),0);
      const totalAtrasado=ps.filter(p=>p.STATUS==="atrasado").reduce((s,p)=>s+p.VALOR_PARCELA,0);
      const pagas=ps.filter(p=>p.STATUS==="pago").length;
      const atrasadas=ps.filter(p=>p.STATUS==="atrasado").length;
      const antecipadas=ps.filter(p=>parseInt(p.DIAS_ANTECIPACAO)>0).length;
      let score=70+pagas*3-atrasadas*20+antecipadas*2;
      score=Math.max(5,Math.min(100,score));
      const status=score>=70?"bom":score>=45?"risco":"inadimplente";
      return{...cl,contratos:cs,parcelas:ps,totalPago,totalAtrasado,score,status,numContratos:cs.length,antecipadas};
    });
    const hoje=new Date();hoje.setHours(0,0,0,0);
    const mesAtual=hoje.toISOString().slice(0,7);
    const dtAnt=new Date(hoje);dtAnt.setMonth(dtAnt.getMonth()-1);
    const mesAnt=dtAnt.toISOString().slice(0,7);
    const totalPago=parcelas.filter(p=>p.STATUS==="pago").reduce((s,p)=>s+(p.VALOR_PAGO||p.VALOR_PARCELA),0);
    const totalAtrasado=parcelas.filter(p=>p.STATUS==="atrasado").reduce((s,p)=>s+p.VALOR_PARCELA,0);
    const totalPendente=parcelas.filter(p=>p.STATUS==="pendente").reduce((s,p)=>s+p.VALOR_PARCELA,0);
    const totalVencendo=parcelas.filter(p=>p.STATUS==="vencendo").reduce((s,p)=>s+p.VALOR_PARCELA,0);
    const totalAReceber=totalAtrasado+totalPendente+totalVencendo;
    const totalEmprestado=contratos.reduce((s,c)=>s+c.VALOR_PRINCIPAL,0);
    const receitaMes=parcelas.filter(p=>p.DATA_PAGAMENTO&&p.DATA_PAGAMENTO.toISOString().slice(0,7)===mesAtual).reduce((s,p)=>s+(p.VALOR_PAGO||p.VALOR_PARCELA),0);
    const receitaAnt=parcelas.filter(p=>p.DATA_PAGAMENTO&&p.DATA_PAGAMENTO.toISOString().slice(0,7)===mesAnt).reduce((s,p)=>s+(p.VALOR_PAGO||p.VALOR_PARCELA),0);
    const taxaMedia=contratos.length?contratos.reduce((s,c)=>s+c["TAXA_MENSAL_%"],0)/contratos.length:0;
    const lucroMes=receitaMes*(taxaMedia/(1+taxaMedia));
    const lucroAnt=receitaAnt*(taxaMedia/(1+taxaMedia));
    const lucroTotal=totalPago-totalEmprestado;
    const taxaInad=totalAReceber>0?(totalAtrasado/totalAReceber)*100:0;
    const roi=totalEmprestado>0?(lucroTotal/totalEmprestado)*100:0;
    const ticketMedio=contratos.length?totalEmprestado/contratos.length:0;
    const prazoMedio=contratos.length?contratos.reduce((s,c)=>s+c.NUM_PARCELAS,0)/contratos.length:0;
    const coberturaCP=totalPendente>0?totalPago/totalPendente:0;
    const dReceita=receitaAnt>0?((receitaMes-receitaAnt)/receitaAnt)*100:0;
    const dLucro=lucroAnt>0?((lucroMes-lucroAnt)/lucroAnt)*100:0;
    const M={totalPago,totalAtrasado,totalPendente,totalVencendo,totalAReceber,totalEmprestado,
      receitaMes,lucroMes,lucroTotal,taxaInad,roi,ticketMedio,prazoMedio,coberturaCP,dReceita,dLucro,taxaMedia};
    const cobItems=parcelas
      .filter(p=>p.STATUS==="atrasado"||p.STATUS==="vencendo")
      .map(p=>{
        const dtV=new Date(p.DATA_VENCIMENTO);dtV.setHours(0,0,0,0);
        const dias=Math.round((dtV-hoje)/86400000);
        const cl=clientes.find(c=>String(c.ID_CLIENTE)===String(p.ID_CLIENTE));
        const sc=cl?cl.score:50;
        const urg=dias<-30?"grave":dias<0?"atrasado":dias===0?"hoje":"amanhã";
        return{p,cl,dias,urg,sc};
      }).sort((a,b)=>a.dias-b.dias);
    const mensal=Array.from({length:6},(_,i)=>{
      const d=new Date(hoje);d.setMonth(d.getMonth()-5+i);
      const mes=d.toISOString().slice(0,7);
      const label=d.toLocaleDateString("pt-BR",{month:"short",year:"2-digit"});
      const receita=parcelas.filter(p=>p.DATA_PAGAMENTO&&p.DATA_PAGAMENTO.toISOString().slice(0,7)===mes).reduce((s,p)=>s+(p.VALOR_PAGO||p.VALOR_PARCELA),0);
      const lucro=receita*(taxaMedia/(1+taxaMedia));
      return{mes:label,receita:Math.round(receita),lucro:Math.round(lucro)};
    });
    const projecao=Array.from({length:3},(_,i)=>{
      const d=new Date(hoje);d.setMonth(d.getMonth()+1+i);
      const mes=d.toISOString().slice(0,7);
      const label=d.toLocaleDateString("pt-BR",{month:"short",year:"2-digit"});
      const val=parcelas.filter(p=>p.STATUS==="pendente"&&p.DATA_VENCIMENTO&&p.DATA_VENCIMENTO.toISOString().slice(0,7)===mes).reduce((s,p)=>s+p.VALOR_PARCELA,0);
      return{mes:label,val:Math.round(val)};
    });
    return{clientes,contratos,parcelas,M,cobItems,mensal,projecao};
  },[raw]);

  const sim=useMemo(()=>{
    const inadPct=((M.taxaInad||0)+simInad)/100;
    const novaCarteira=(M.totalAReceber||0)+simVal;
    const perdaExtra=novaCarteira*inadPct;
    const lucroProj=(M.lucroMes||0)*(1+simVol/100)-perdaExtra*0.08;
    const risco=inadPct>0.3?"crítico":inadPct>0.15?"atenção":"saudável";
    return{novaCarteira,perdaExtra,lucroProj,risco};
  },[simVal,simInad,simVol,M]);

  const card={background:CARD,border:`1px solid ${BORDER}`,borderRadius:8,padding:16};
  const h2={color:TEXT,fontSize:15,fontWeight:600,margin:"0 0 12px 0"};
  const h3s={color:MUTED,fontSize:10,fontWeight:700,textTransform:"uppercase",letterSpacing:1,margin:"0 0 4px 0"};
  const badge=c=>({display:"inline-block",padding:"2px 8px",borderRadius:10,fontSize:10,fontWeight:700,background:c+"22",color:c,border:`1px solid ${c}44`});
  const kpiColor=(v,ok,warn,rev=false)=>rev?(v<=ok?GREEN:v<=warn?YEL:RED):(v>=ok?GREEN:v>=warn?YEL:RED);
  const sCol=st=>st==="bom"?GREEN:st==="risco"?YEL:RED;
  const Delta=({v})=><span style={{fontSize:10,color:v>=0?GREEN:RED,marginLeft:4}}>{v>=0?"▲":"▼"}{Math.abs(v).toFixed(1)}%</span>;
  const TT=({...p})=><Tooltip {...p} contentStyle={{background:CARD,border:`1px solid ${BORDER}`,borderRadius:6,fontSize:12}}/>;
  const TABS=[{id:"dashboard",l:"⬛ Dashboard"},{id:"clientes",l:"👥 Clientes"},
    {id:"contratos",l:"📄 Contratos"},{id:"cobranca",l:"🔔 Cobrança"},
    {id:"kpis",l:"📊 KPIs"},{id:"analise",l:"🔍 Análise"},{id:"simulador",l:"🧮 Simulador"}];
  const clientesFiltrados=clientes.filter(c=>{
    const sok=filtroStatus==="todos"||c.status===filtroStatus;
    const bok=!filtroBusca||c.NOME.toLowerCase().includes(filtroBusca.toLowerCase());
    return sok&&bok;
  });

  if(loading)return(
    <div style={{background:BG,minHeight:"100vh",display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",gap:16}}>
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
      <div style={{width:40,height:40,border:`3px solid ${BORDER}`,borderTop:`3px solid ${BLUE}`,borderRadius:"50%",animation:"spin 1s linear infinite"}}/>
      <p style={{color:MUTED,fontSize:13}}>Carregando dados do Sheets...</p>
    </div>
  );
  if(erro)return(
    <div style={{background:BG,minHeight:"100vh",display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",gap:12,padding:24,fontFamily:"sans-serif"}}>
      <span style={{fontSize:32}}>⚠️</span>
      <p style={{color:RED,fontWeight:700,fontSize:15}}>Erro de conexão</p>
      <p style={{color:MUTED,fontSize:12,textAlign:"center",maxWidth:400}}>{erro}</p>
      <button onClick={carregar} style={{padding:"9px 20px",background:BLUE,color:"#000",border:"none",borderRadius:6,fontWeight:700,cursor:"pointer"}}>Tentar novamente</button>
    </div>
  );

  return(
    <div style={{fontFamily:"'Inter',system-ui,sans-serif",background:BG,color:TEXT,minHeight:"100vh",fontSize:13}}>
      <style>{`*{box-sizing:border-box;margin:0;padding:0} body{margin:0}`}</style>
      <nav style={{background:CARD,borderBottom:`1px solid ${BORDER}`,display:"flex",alignItems:"center",padding:"0 12px",gap:2,overflowX:"auto",position:"sticky",top:0,zIndex:10}}>
        <span style={{color:BLUE,fontWeight:800,fontSize:15,marginRight:12,whiteSpace:"nowrap",padding:"11px 0"}}>💰 FinanceiroOp</span>
        {TABS.map(t=>(
          <button key={t.id} onClick={()=>setTab(t.id)} style={{background:tab===t.id?"#21262d":"transparent",border:"none",
            color:tab===t.id?BLUE:MUTED,padding:"10px 10px",cursor:"pointer",borderRadius:6,fontSize:11.5,
            fontWeight:tab===t.id?700:400,whiteSpace:"nowrap",borderBottom:tab===t.id?`2px solid ${BLUE}`:"2px solid transparent"}}>{t.l}</button>
        ))}
        <span style={{marginLeft:"auto",color:MUTED,fontSize:10,whiteSpace:"nowrap",paddingLeft:8}}>
          {new Date().toLocaleDateString("pt-BR")} · {contratos.length} contratos
        </span>
      </nav>
      <div style={{padding:14,maxWidth:1100,margin:"0 auto"}}>

        {tab==="dashboard"&&<div style={{display:"grid",gap:12}}>
          {M.taxaInad>25&&<div style={{...card,borderColor:RED,background:"#1a0d0d",display:"flex",gap:10,alignItems:"center"}}>
            <span style={{fontSize:20}}>⚠️</span>
            <div><strong style={{color:RED}}>Inadimplência crítica: {P(M.taxaInad)}</strong>
            <span style={{color:MUTED,marginLeft:8}}>Acima do limite de 15%.</span></div>
          </div>}
          {cobItems.filter(i=>i.dias<=0).length>0&&<div style={{...card,borderColor:YEL,background:"#1a1500",display:"flex",gap:10,alignItems:"center"}}>
            <span style={{fontSize:20}}>🔔</span>
            <strong style={{color:YEL}}>{cobItems.filter(i=>i.dias<=0).length} parcelas vencidas ou vencendo hoje</strong>
          </div>}
          <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:10}}>
            {[
              {l:"Total Recebido",v:R(M.totalPago),c:BLUE,icon:"💵",sub:"caixa acumulado"},
              {l:"Carteira Ativa",v:R(M.totalAReceber),c:PUR,icon:"📦",sub:"a receber"},
              {l:"Inadimplência",v:P(M.taxaInad),c:kpiColor(M.taxaInad,10,20,true),icon:"⛔",sub:"sobre carteira"},
              {l:"Receita do Mês",v:R(M.receitaMes),c:BLUE,icon:"📈",sub:"mês atual",delta:M.dReceita},
              {l:"Lucro Estimado",v:R(M.lucroMes),c:GREEN,icon:"💹",sub:"mês atual",delta:M.dLucro},
              {l:"Capital Emprestado",v:R(M.totalEmprestado),c:PUR,icon:"🏦",sub:`${contratos.length} contratos`},
            ].map(k=>(
              <div key={k.l} style={{...card,borderLeft:`3px solid ${k.c}`}}>
                <p style={h3s}>{k.icon} {k.l}</p>
                <p style={{fontSize:20,fontWeight:700,color:k.c,margin:"4px 0 2px"}}>{k.v}</p>
                <p style={{margin:0,fontSize:10,color:MUTED}}>{k.sub}{k.delta!==undefined&&<Delta v={k.delta}/>}</p>
              </div>
            ))}
          </div>
          <div style={{display:"grid",gridTemplateColumns:"2fr 1fr",gap:12}}>
            <div style={card}>
              <h2 style={h2}>Receita × Lucro — Últimos 6 Meses</h2>
              <ResponsiveContainer width="100%" height={170}>
                <AreaChart data={mensal} margin={{top:4,right:4,bottom:0,left:-10}}>
                  <CartesianGrid strokeDasharray="3 3" stroke={BORDER}/>
                  <XAxis dataKey="mes" tick={{fill:MUTED,fontSize:10}}/>
                  <YAxis tick={{fill:MUTED,fontSize:9}} tickFormatter={v=>`R$${(v/1000).toFixed(1)}k`}/>
                  <TT formatter={(v,n)=>[R(v),n==="receita"?"Receita":"Lucro"]}/>
                  <Area type="monotone" dataKey="receita" stroke={BLUE} fill={BLUE+"33"} strokeWidth={2}/>
                  <Area type="monotone" dataKey="lucro" stroke={GREEN} fill={GREEN+"33"} strokeWidth={2}/>
                </AreaChart>
              </ResponsiveContainer>
            </div>
            <div style={card}>
              <h2 style={h2}>Carteira por Status</h2>
              <ResponsiveContainer width="100%" height={170}>
                <PieChart>
                  <Pie data={[
                    {name:"Pendente",value:Math.round(M.totalPendente)},
                    {name:"Atrasado",value:Math.round(M.totalAtrasado)},
                    {name:"Vencendo",value:Math.round(M.totalVencendo)},
                  ]} cx="50%" cy="50%" innerRadius={42} outerRadius={68} dataKey="value" paddingAngle={2}>
                    <Cell fill={BLUE}/><Cell fill={RED}/><Cell fill={YEL}/>
                  </Pie>
                  <TT formatter={v=>R(v)}/>
                </PieChart>
              </ResponsiveContainer>
              <div style={{display:"flex",gap:10,justifyContent:"center",marginTop:4}}>
                {[[BLUE,"Pendente"],[RED,"Atrasado"],[YEL,"Vencendo"]].map(([c,l])=>(
                  <span key={l} style={{fontSize:10,color:MUTED}}><span style={{color:c}}>■</span> {l}</span>
                ))}
              </div>
            </div>
          </div>
          <div style={card}>
            <h2 style={h2}>Projeção — Próximos 3 Meses</h2>
            <ResponsiveContainer width="100%" height={130}>
              <BarChart data={projecao} margin={{top:4,right:4,bottom:0,left:-10}}>
                <CartesianGrid strokeDasharray="3 3" stroke={BORDER}/>
                <XAxis dataKey="mes" tick={{fill:MUTED,fontSize:10}}/>
                <YAxis tick={{fill:MUTED,fontSize:9}} tickFormatter={v=>`R$${(v/1000).toFixed(1)}k`}/>
                <TT formatter={v=>[R(v),"Previsto"]}/>
                <Bar dataKey="val" fill={PUR} radius={[4,4,0,0]}/>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>}

        {tab==="clientes"&&<div style={{display:"grid",gap:12}}>
          <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:10}}>
            {[{l:"Total",v:clientes.length,c:BLUE},{l:"Bons",v:clientes.filter(c=>c.status==="bom").length,c:GREEN},
              {l:"Em Risco",v:clientes.filter(c=>c.status==="risco").length,c:YEL},{l:"Inadimplentes",v:clientes.filter(c=>c.status==="inadimplente").length,c:RED}
            ].map(x=><div key={x.l} style={{...card,textAlign:"center"}}><p style={h3s}>{x.l}</p><p style={{fontSize:22,fontWeight:700,color:x.c,margin:"4px 0 0"}}>{x.v}</p></div>)}
          </div>
          <div style={{display:"flex",gap:10}}>
            <input placeholder="🔍 Buscar cliente..." value={filtroBusca} onChange={e=>setFiltroBusca(e.target.value)}
              style={{flex:1,padding:"8px 12px",background:CARD,border:`1px solid ${BORDER}`,borderRadius:6,color:TEXT,fontSize:13}}/>
            <select value={filtroStatus} onChange={e=>setFiltroStatus(e.target.value)}
              style={{padding:"8px 12px",background:CARD,border:`1px solid ${BORDER}`,borderRadius:6,color:TEXT,fontSize:13}}>
              <option value="todos">Todos</option><option value="bom">Bons</option>
              <option value="risco">Em Risco</option><option value="inadimplente">Inadimplentes</option>
            </select>
          </div>
          <div style={card}>
            <table style={{width:"100%",borderCollapse:"collapse"}}>
              <thead><tr style={{borderBottom:`1px solid ${BORDER}`}}>
                {["Cliente","Status","Score","Contratos","Total Pago","Em Atraso","Recomendação"].map(h=>(
                  <th key={h} style={{textAlign:"left",padding:"8px 6px",color:MUTED,fontSize:10,fontWeight:700,textTransform:"uppercase"}}>{h}</th>
                ))}
              </tr></thead>
              <tbody>
                {clientesFiltrados.sort((a,b)=>b.score-a.score).map(c=>(
                  <React.Fragment key={c.ID_CLIENTE}>
                  <tr style={{borderBottom:`1px solid ${BORDER}22`,cursor:"pointer",background:selCli===c.ID_CLIENTE?"#1c2128":"transparent"}}
                    onClick={()=>setSelCli(selCli===c.ID_CLIENTE?null:c.ID_CLIENTE)}>
                    <td style={{padding:"10px 6px"}}><strong style={{display:"block"}}>{c.NOME}</strong><span style={{color:MUTED,fontSize:10}}>{c.TELEFONE_WPP||"—"}</span></td>
                    <td><span style={badge(sCol(c.status))}>{c.status.toUpperCase()}</span></td>
                    <td><div style={{display:"flex",alignItems:"center",gap:6}}>
                      <strong style={{color:c.score>70?GREEN:c.score>45?YEL:RED}}>{c.score}</strong>
                      <div style={{width:50,height:5,background:"#21262d",borderRadius:3}}>
                        <div style={{width:`${c.score}%`,height:"100%",borderRadius:3,background:c.score>70?GREEN:c.score>45?YEL:RED}}/>
                      </div>
                    </div></td>
                    <td style={{textAlign:"center",color:MUTED}}>{c.numContratos}</td>
                    <td style={{color:GREEN}}>{R(c.totalPago)}</td>
                    <td style={{color:c.totalAtrasado>0?RED:MUTED}}>{R(c.totalAtrasado)}</td>
                    <td style={{fontSize:11}}><span style={{color:c.status==="bom"?GREEN:c.status==="risco"?YEL:RED}}>
                      {c.status==="bom"?(c.antecipadas>0?"⭐ Pagador antecipado":"✅ Liberar crédito"):c.status==="risco"?"⚡ Analisar":"🚫 Bloquear"}
                    </span></td>
                  </tr>
                  {selCli===c.ID_CLIENTE&&<tr><td colSpan={7} style={{padding:"0 6px 12px"}}>
                    <div style={{background:"#0d1117",border:`1px solid ${BLUE}44`,borderRadius:8,padding:14,marginTop:4}}>
                      <strong style={{color:BLUE}}>{c.NOME}</strong>
                      {c.contratos.map(ct=>{
                        const ps=parcelas.filter(p=>String(p.ID_CONTRATO)===String(ct.ID_CONTRATO));
                        return<div key={ct.ID_CONTRATO} style={{marginTop:10}}>
                          <p style={{margin:"0 0 6px",color:MUTED,fontSize:11}}>{ct.ID_CONTRATO} · {R(ct.VALOR_PRINCIPAL)} · {(ct["TAXA_MENSAL_%"]*100).toFixed(1)}%/mês · {ct.STATUS_CONTRATO}</p>
                          <div style={{display:"flex",gap:4,flexWrap:"wrap"}}>
                            {ps.map(p=><div key={p.ID_PARCELA} title={`Parcela ${p.NUM_PARCELA} — ${R(p.VALOR_PARCELA)} — ${p.STATUS}`}
                              style={{width:26,height:26,borderRadius:5,display:"flex",alignItems:"center",justifyContent:"center",fontSize:9,fontWeight:700,cursor:"help",
                                background:p.STATUS==="pago"?GREEN+"22":p.STATUS==="atrasado"?RED+"22":p.STATUS==="vencendo"?YEL+"22":"#21262d",
                                color:p.STATUS==="pago"?GREEN:p.STATUS==="atrasado"?RED:p.STATUS==="vencendo"?YEL:MUTED,
                                border:`1px solid ${p.STATUS==="pago"?GREEN:p.STATUS==="atrasado"?RED:p.STATUS==="vencendo"?YEL:BORDER}`}}>{p.NUM_PARCELA}</div>)}
                          </div>
                        </div>;
                      })}
                    </div>
                  </td></tr>}
                  </React.Fragment>
                ))}
              </tbody>
            </table>
          </div>
        </div>}

        {tab==="contratos"&&<div style={{display:"grid",gap:10}}>
          <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:10}}>
            {[{l:"Total",v:contratos.length,c:BLUE},{l:"Ativos",v:contratos.filter(c=>c.STATUS_CONTRATO==="ativo").length,c:GREEN},
              {l:"Quitados",v:contratos.filter(c=>c.STATUS_CONTRATO==="quitado").length,c:MUTED},{l:"Inadimplentes",v:contratos.filter(c=>c.STATUS_CONTRATO==="inadimplente").length,c:RED}
            ].map(x=><div key={x.l} style={{...card,textAlign:"center"}}><p style={h3s}>{x.l}</p><p style={{fontSize:22,fontWeight:700,color:x.c,margin:"4px 0 0"}}>{x.v}</p></div>)}
          </div>
          {contratos.filter(c=>c.STATUS_CONTRATO==="ativo"||c.STATUS_CONTRATO==="inadimplente").map(c=>{
            const ps=parcelas.filter(p=>String(p.ID_CONTRATO)===String(c.ID_CONTRATO));
            const pago=ps.filter(p=>p.STATUS==="pago").reduce((s,p)=>s+(p.VALOR_PAGO||p.VALOR_PARCELA),0);
            const rest=ps.filter(p=>p.STATUS!=="pago").reduce((s,p)=>s+p.VALOR_PARCELA,0);
            const pct=pago+rest>0?Math.round(pago/(pago+rest)*100):0;
            const hasAtras=ps.some(p=>p.STATUS==="atrasado");
            const hasVenc=ps.some(p=>p.STATUS==="vencendo");
            const stC=hasAtras?"atrasado":hasVenc?"vencendo":"em dia";
            const stColor=stC==="atrasado"?RED:stC==="vencendo"?YEL:GREEN;
            return<div key={c.ID_CONTRATO} style={{...card,borderLeft:`3px solid ${stColor}`}}>
              <div style={{display:"flex",justifyContent:"space-between",flexWrap:"wrap",gap:6,marginBottom:8}}>
                <div><strong>{c.ID_CONTRATO} — {c.NOME_CLIENTE}</strong><span style={{...badge(stColor),marginLeft:8}}>{stC.toUpperCase()}</span></div>
                <strong style={{color:PUR}}>{R(c.VALOR_PRINCIPAL)} <span style={{color:MUTED,fontWeight:400,fontSize:11}}>@ {(c["TAXA_MENSAL_%"]*100).toFixed(1)}%/m</span></strong>
              </div>
              <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:8}}>
                <div style={{flex:1,height:5,background:"#21262d",borderRadius:3}}><div style={{width:`${pct}%`,height:"100%",borderRadius:3,background:stColor}}/></div>
                <span style={{color:MUTED,fontSize:10}}>{pct}% pago</span>
              </div>
              <div style={{display:"flex",gap:3,flexWrap:"wrap",marginBottom:8}}>
                {ps.map(p=><div key={p.ID_PARCELA} title={`Parcela ${p.NUM_PARCELA}: ${R(p.VALOR_PARCELA)} · ${p.STATUS}`}
                  style={{width:24,height:24,borderRadius:4,display:"flex",alignItems:"center",justifyContent:"center",fontSize:9,fontWeight:700,cursor:"help",
                    background:p.STATUS==="pago"?GREEN+"22":p.STATUS==="atrasado"?RED+"22":p.STATUS==="vencendo"?YEL+"22":"#21262d",
                    color:p.STATUS==="pago"?GREEN:p.STATUS==="atrasado"?RED:p.STATUS==="vencendo"?YEL:MUTED,
                    border:`1px solid ${p.STATUS==="pago"?GREEN:p.STATUS==="atrasado"?RED:p.STATUS==="vencendo"?YEL:BORDER}`}}>{p.NUM_PARCELA}</div>)}
              </div>
              <div style={{display:"flex",gap:14,fontSize:10,color:MUTED}}>
                <span>✅ <strong style={{color:GREEN}}>{R(pago)}</strong></span>
                <span>⏳ <strong style={{color:BLUE}}>{R(rest)}</strong></span>
                <span>📅 {c.NUM_PARCELAS} parcelas</span>
                {hasAtras&&<span style={{color:RED}}>⚠️ {ps.filter(p=>p.STATUS==="atrasado").length} atrasada(s)</span>}
              </div>
            </div>;
          })}
        </div>}

        {tab==="cobranca"&&<div style={{display:"grid",gap:12}}>
          <h2 style={{...h2,fontSize:17}}>Central de Cobrança</h2>
          {cobItems.length===0&&<div style={{...card,textAlign:"center",color:GREEN,padding:36,fontSize:15}}>✅ Nenhuma pendência!</div>}
          {["grave","atrasado","hoje","amanhã"].map(urg=>{
            const items=cobItems.filter(i=>i.urg===urg);
            if(!items.length)return null;
            const label={grave:"🚨 Atraso Grave (+30d)",atrasado:"⛔ Atrasadas",hoje:"🔴 Vence Hoje",amanhã:"🟡 Vence Amanhã"}[urg];
            const col={grave:RED,atrasado:RED,hoje:YEL,amanhã:YEL}[urg];
            return<div key={urg}>
              <p style={{color:col,fontWeight:700,fontSize:13,margin:"0 0 8px"}}>{label} ({items.length})</p>
              {items.map(({p,cl,dias,sc},i)=>{
                const acao=sc>=70?"📱 Cobrança leve":sc>=45?"⚡ Alerta firme":"🚫 Ação direta";
                return<div key={i} style={{...card,marginBottom:8,borderLeft:`3px solid ${col}`}}>
                  <div style={{display:"flex",justifyContent:"space-between",flexWrap:"wrap",gap:8,marginBottom:6}}>
                    <div><strong>{cl?.NOME||"Cliente"}</strong><span style={{...badge(col),marginLeft:8}}>{dias<0?`${Math.abs(dias)}d atraso`:dias===0?"HOJE":"AMANHÃ"}</span></div>
                    <strong style={{color:col}}>{R(p.VALOR_PARCELA)}</strong>
                  </div>
                  <div style={{display:"flex",gap:14,fontSize:10,color:MUTED,marginBottom:8}}>
                    <span>Parcela {p.NUM_PARCELA}/{p.TOTAL_PARCELAS}</span>
                    <span>Venc: {p.DATA_VENCIMENTO?.toLocaleDateString("pt-BR")||"—"}</span>
                    <span>Score: <strong style={{color:sc>70?GREEN:sc>45?YEL:RED}}>{sc}</strong></span>
                    {cl?.TELEFONE_WPP&&<span>📱 {cl.TELEFONE_WPP}</span>}
                  </div>
                  <div style={{padding:"8px 10px",background:"#21262d",borderRadius:6,fontSize:11}}>💡 {acao}</div>
                </div>;
              })}
            </div>;
          })}
        </div>}

        {tab==="kpis"&&<div style={{display:"grid",gap:10}}>
          <h2 style={{...h2,fontSize:17}}>Indicadores de Performance</h2>
          {[
            {l:"Taxa de Inadimplência",v:P(M.taxaInad),raw:M.taxaInad,ok:10,warn:20,rev:true,desc:"Atrasado / total a receber",ideal:"< 10%"},
            {l:"ROI da Operação",v:P(M.roi),raw:M.roi,ok:15,warn:8,desc:"Retorno sobre capital",ideal:"> 15%"},
            {l:"Ticket Médio",v:R(M.ticketMedio),raw:M.ticketMedio,ok:2000,warn:800,desc:"Valor médio por contrato",ideal:"> R$ 2.000"},
            {l:"Prazo Médio",v:(M.prazoMedio||0).toFixed(1)+" meses",raw:null,desc:"Duração média dos contratos",ideal:"—"},
            {l:"Cobertura de Curto Prazo",v:(M.coberturaCP||0).toFixed(2)+"x",raw:M.coberturaCP,ok:1.5,warn:1.0,desc:"Caixa / pendências",ideal:"> 1.5x"},
            {l:"Capital Total Alocado",v:R(M.totalEmprestado),raw:null,desc:"Volume total emprestado",ideal:"—"},
            {l:"Lucro Bruto Total",v:R(M.lucroTotal),raw:M.lucroTotal,ok:1,warn:0,desc:"Juros recebidos estimados",ideal:"> R$ 0"},
            {l:"Taxa Média",v:P((M.taxaMedia||0)*100)+" /mês",raw:null,desc:"Média das taxas praticadas",ideal:"—"},
            {l:"Pagamentos Antecipados",v:P(parcelas.filter(p=>p.STATUS==="pago"&&parseInt(p.DIAS_ANTECIPACAO)>0).length/Math.max(1,parcelas.filter(p=>p.STATUS==="pago").length)*100),raw:parcelas.filter(p=>p.STATUS==="pago"&&parseInt(p.DIAS_ANTECIPACAO)>0).length/Math.max(1,parcelas.filter(p=>p.STATUS==="pago").length)*100,ok:30,warn:15,desc:"% de pagamentos antes do vencimento",ideal:"> 30%"},
          ].map(k=>{
            const col=k.raw!=null?kpiColor(k.raw,k.ok,k.warn,k.rev):MUTED;
            const stLabel=k.raw!=null?(col===GREEN?"✅ Saudável":col===YEL?"⚡ Atenção":"🚨 Crítico"):"— Neutro";
            return<div key={k.l} style={{...card,display:"flex",justifyContent:"space-between",alignItems:"center",flexWrap:"wrap",gap:10}}>
              <div><p style={h3s}>{k.l}</p><p style={{fontSize:22,fontWeight:700,color:col,margin:"4px 0 2px"}}>{k.v}</p>
              <p style={{margin:0,fontSize:10,color:MUTED}}>{k.desc} — ideal: {k.ideal}</p></div>
              <span style={badge(col===MUTED?MUTED:col)}>{stLabel}</span>
            </div>;
          })}
        </div>}

        {tab==="analise"&&(()=>{
          const bons=clientes.filter(c=>c.status==="bom");
          const inad=clientes.filter(c=>c.status==="inadimplente");
          const risco=clientes.filter(c=>c.status==="risco");
          const Sec=({title,items,col})=><div style={{...card,marginBottom:12}}>
            <h2 style={{...h2,color:col}}>{title}</h2>
            {items.map((it,i)=><div key={i} style={{padding:"10px 0",borderBottom:i<items.length-1?`1px solid ${BORDER}`:"none",display:"flex",gap:8,lineHeight:1.6}}>
              <span style={{color:col,flexShrink:0}}>▸</span><p style={{margin:0}}>{it}</p>
            </div>)}
          </div>;
          return<div>
            <h2 style={{...h2,fontSize:17,marginBottom:12}}>Análise Inteligente</h2>
            <Sec title="🚨 Problemas" col={RED} items={[
              `Inadimplência em ${P(M.taxaInad)} — ${M.taxaInad>15?"acima do limite de 15%.":"dentro do aceitável."}`,
              `${inad.length} cliente(s) inadimplente(s) com ${R(inad.reduce((s,c)=>s+c.totalAtrasado,0))} em atraso.`,
              M.roi<10?`ROI em ${P(M.roi)} — rentabilidade comprimida.`:`ROI em ${P(M.roi)} — operação rentável.`,
            ]}/>
            <Sec title="🚀 Oportunidades" col={GREEN} items={[
              `${bons.length} clientes com score acima de 70 — candidatos a novos contratos.`,
              `Ticket médio em ${R(M.ticketMedio)} — espaço para ofertar valores maiores a bons pagadores.`,
              `Taxa média de ${P((M.taxaMedia||0)*100)}/mês — diferencie por perfil de risco.`,
            ]}/>
            <Sec title="⚠️ Riscos" col={YEL} items={[
              `${risco.length} cliente(s) em zona de risco — monitorar antes de migrar para inadimplência.`,
              M.coberturaCP<1.5?`Cobertura de curto prazo em ${(M.coberturaCP||0).toFixed(2)}x — liquidez limitada.`:`Cobertura adequada em ${(M.coberturaCP||0).toFixed(2)}x.`,
              `${contratos.filter(c=>c.STATUS_CONTRATO==="ativo").length} contratos ativos — diversifique clientes para reduzir risco concentrado.`,
            ]}/>
          </div>;
        })()}

        {tab==="simulador"&&<div style={{display:"grid",gap:12}}>
          <h2 style={{...h2,fontSize:17}}>Simulador de Decisão</h2>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12}}>
            <div style={{display:"grid",gap:10}}>
              {[
                {l:"💵 Novo Empréstimo (R$)",v:simVal,set:setSimVal,min:0,max:50000,step:500,fmt:v=>R(v)},
                {l:"📉 Aumento Inadimplência (%)",v:simInad,set:setSimInad,min:0,max:40,step:1,fmt:v=>v+"%"},
                {l:"📈 Crescimento do Volume (%)",v:simVol,set:setSimVol,min:-50,max:100,step:5,fmt:v=>v+"%"},
              ].map(inp=><div key={inp.l} style={card}>
                <p style={h3s}>{inp.l}</p>
                <input type="range" min={inp.min} max={inp.max} step={inp.step} value={inp.v}
                  onChange={e=>inp.set(Number(e.target.value))}
                  style={{width:"100%",accentColor:BLUE,margin:"8px 0 4px"}}/>
                <div style={{display:"flex",justifyContent:"space-between"}}>
                  <strong style={{color:BLUE,fontSize:18}}>{inp.fmt(inp.v)}</strong>
                  <span style={{color:MUTED,fontSize:10}}>{inp.min} → {inp.max}</span>
                </div>
              </div>)}
              <button onClick={()=>{setSimVal(5000);setSimInad(0);setSimVol(0);}}
                style={{background:"#21262d",color:MUTED,border:`1px solid ${BORDER}`,borderRadius:6,padding:"9px 0",cursor:"pointer",fontWeight:600,fontSize:13}}>🔄 Resetar</button>
            </div>
            <div style={{display:"grid",gap:10,alignContent:"start"}}>
              <div style={{...card,borderColor:sim.risco==="crítico"?RED:sim.risco==="atenção"?YEL:GREEN}}>
                <h2 style={h2}>Resultado</h2>
                {[
                  {l:"Nova Carteira",v:R(sim.novaCarteira),c:BLUE},
                  {l:"Perda Estimada",v:R(sim.perdaExtra),c:sim.perdaExtra>5000?RED:YEL},
                  {l:"Lucro Projetado",v:R(sim.lucroProj),c:sim.lucroProj>0?GREEN:RED},
                  {l:"Nível de Risco",v:sim.risco.toUpperCase(),c:sim.risco==="crítico"?RED:sim.risco==="atenção"?YEL:GREEN},
                ].map((r,i)=><div key={r.l} style={{display:"flex",justifyContent:"space-between",padding:"10px 0",borderBottom:i<3?`1px solid ${BORDER}`:"none"}}>
                  <span style={{color:MUTED,fontSize:12}}>{r.l}</span>
                  <strong style={{color:r.c,fontSize:15}}>{r.v}</strong>
                </div>)}
              </div>
              <div style={card}>
                <p style={{color:sim.risco==="crítico"?RED:sim.risco==="atenção"?YEL:GREEN,fontWeight:700,fontSize:13,margin:"0 0 8px"}}>
                  {sim.risco==="crítico"?"🚫 Alto risco — não recomendado":sim.risco==="atenção"?"⚡ Prossiga com cautela":"✅ Cenário favorável"}
                </p>
                <p style={{color:MUTED,fontSize:12,lineHeight:1.7,margin:0}}>
                  {simVal>0&&`Novo empréstimo de ${R(simVal)} adiciona volume. `}
                  {simInad>5&&`Inadimplência +${simInad}% causaria impacto significativo. `}
                  {simInad<=5&&"Inadimplência sob controle. "}
                  {simVol>20&&`Crescer ${simVol}% exige capital e cobrança robusta.`}
                </p>
              </div>
            </div>
          </div>
        </div>}

      </div>
    </div>
  );
}

createRoot(document.getElementById("root")).render(<App/>);
