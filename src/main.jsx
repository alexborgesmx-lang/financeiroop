import React, { useState, useMemo, useEffect, useRef } from "react";
import { createRoot } from "react-dom/client";
import {
  LineChart, Line, BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, CartesianGrid
} from "recharts";

const API_URL = "/api/sheets";
const POST_URL = "/api/action";

const BG = "#F5F6FA", CARD = "#FFFFFF", BD = "#E5E7EB";
const TEXT = "#111827", MUTED = "#6B7280";
const GRN = "#10B981", RED = "#EF4444", BLU = "#3B82F6";
const YEL = "#F59E0B", PUR = "#8B5CF6", ORG = "#F97316";
const SW = 220;

const fmtR = v => "R$ " + Number(v || 0).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const fmtP = v => Number(v || 0).toFixed(1) + "%";
const fmtDt = v => { if (!v) return "—"; const d = v instanceof Date ? v : new Date(v); return isNaN(d.getTime()) ? "—" : d.toLocaleDateString("pt-BR"); };
const hojeStr = () => new Date().toISOString().split("T")[0];

function parseDate(v) {
  if (!v) return null;
  if (v instanceof Date) return v;
  let d;
  if (typeof v === "string") {
    const s = v.trim();
    if (s.includes("/")) {
      const partes = s.split("/");
      let dia = parseInt(partes[0]);
      let mes = parseInt(partes[1]);
      let ano = parseInt(partes[2]);
      if (ano < 100) ano += 2000;
      d = new Date(ano, mes - 1, dia, 12, 0, 0);
    } else if (s.includes("-")) {
      const partes = s.split("T")[0].split("-");
      let ano = parseInt(partes[0]);
      let mes = parseInt(partes[1]);
      let dia = parseInt(partes[2]);
      if (ano < 100) ano += 2000;
      d = new Date(ano, mes - 1, dia, 12, 0, 0);
    } else {
      d = new Date(v);
    }
  } else {
    d = new Date(v);
  }
  if (isNaN(d.getTime())) return null;
  if (d.getFullYear() < 2000) d.setFullYear(d.getFullYear() + 100);
  d.setHours(12, 0, 0, 0);
  return d;
}

async function postAction(body) {
  const r = await fetch(POST_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body)
  });
  return r.json();
}

const IS = { width: "100%", padding: "9px 12px", background: CARD, border: `1px solid ${BD}`, borderRadius: 7, color: TEXT, fontSize: 13, boxSizing: "border-box" };
const LS = { color: MUTED, fontSize: 11, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.05em", display: "block", marginBottom: 4 };

const STATUS_LABEL = {
  ativo_em_dia: "Em Dia", ativo_em_atraso: "Em Atraso", em_cobranca: "Em Cobrança",
  pre_prejuizo: "Pré-Prejuízo", baixado_como_prejuizo: "Baixado (Prejuízo)",
  em_recuperacao: "Em Recuperação", recuperado_parcialmente: "Rec. Parcial",
  recuperado_integralmente: "Recuperado", encerrado_sem_recuperacao: "Encerrado s/ Rec.",
  renegociado: "Renegociado", quitado: "Quitado", cancelado: "Cancelado", ativo: "Ativo"
};
const STATUS_COR = {
  ativo_em_dia: GRN, ativo: GRN, ativo_em_atraso: YEL, em_cobranca: ORG,
  pre_prejuizo: "#DC2626", baixado_como_prejuizo: RED, em_recuperacao: PUR,
  recuperado_parcialmente: BLU, recuperado_integralmente: GRN,
  encerrado_sem_recuperacao: MUTED, renegociado: "#0891B2", quitado: GRN, cancelado: MUTED
};
const STATUS_PERDA = ["em_cobranca", "pre_prejuizo", "baixado_como_prejuizo", "em_recuperacao", "recuperado_parcialmente", "encerrado_sem_recuperacao"];

const Ico = {
  dash: <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="3" width="7" height="7" rx="1" /><rect x="14" y="3" width="7" height="7" rx="1" /><rect x="3" y="14" width="7" height="7" rx="1" /><rect x="14" y="14" width="7" height="7" rx="1" /></svg>,
  cli: <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="9" cy="7" r="4" /><path d="M3 21v-2a4 4 0 0 1 4-4h4a4 4 0 0 1 4 4v2" /></svg>,
  ctr: <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><polyline points="14,2 14,8 20,8" /></svg>,
  pag: <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="2" y="5" width="20" height="14" rx="2" /><line x1="2" y1="10" x2="22" y2="10" /></svg>,
  cob: <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07A19.5 19.5 0 0 1 4.19 12" /></svg>,
  fin: <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="12" y1="1" x2="12" y2="23" /><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" /></svg>,
  loss: <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" /><line x1="12" y1="9" x2="12" y2="13" /><line x1="12" y1="17" x2="12.01" y2="17" /></svg>,
  novo: <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="16" /><line x1="8" y1="12" x2="16" y2="12" /></svg>,
  kpi: <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="18" y1="20" x2="18" y2="10" /><line x1="12" y1="20" x2="12" y2="4" /><line x1="6" y1="20" x2="6" y2="14" /></svg>,
  arr: <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="9,18 15,12 9,6" /></svg>,
};

function Badge({ c, children }) { return <span style={{ display: "inline-flex", alignItems: "center", padding: "3px 8px", borderRadius: 20, fontSize: 10, fontWeight: 600, background: c + "18", color: c, border: `1px solid ${c}30` }}>{children}</span>; }

function BaixaModal({ contrato, pagamentos, onConfirmar, onFechar }) {
  const [dados, setDados] = useState({
    substatus: "FRAUDE_IDENTIFICADA", motivo: "", observacao: "",
    possibilidadeRecuperacao: "BAIXA", statusJuridico: "NAO_ANALISADO", proximaProvidencia: ""
  });
  const [loading, setLoading] = useState(false);
  const pgs = (pagamentos || []).filter(p => String(p.ID_CONTRATO) === String(contrato.ID_CONTRATO));
  const capEmp = parseFloat(contrato.VALOR_PRINCIPAL || 0);
  const capRec = pgs.reduce((s, p) => s + parseFloat(p.VALOR_PAGO || 0), 0);
  const jurosRec = pgs.reduce((s, p) => s + parseFloat(p.RECEITA_EXTRA_ATRASO || 0), 0);
  const prejuizo = Math.max(0, capEmp - capRec);
  const jurosNao = parseFloat(contrato.VALOR_TOTAL || 0) - capEmp - jurosRec;
  const pctRec = capEmp > 0 ? (capRec / capEmp * 100) : 0;
  const diasAtraso = pgs.length > 0 ? Math.max(...pgs.map(p => parseInt(p.DIAS_ATRASO || 0))) : 0;

  const confirmar = async () => {
    if (!dados.motivo) return;
    setLoading(true);
    const res = await postAction({
      action: "baixarContrato", idContrato: contrato.ID_CONTRATO,
      dados: { ...dados, diasAtraso, valorRecuperadoAntesBaixa: capRec, jurosJaRecebidos: jurosRec, data: hojeStr() }
    });
    if (res.ok) onConfirmar();
    setLoading(false);
  };

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", zIndex: 400, display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}>
      <div style={{ background: CARD, borderRadius: 12, width: "100%", maxWidth: 600, maxHeight: "90vh", display: "flex", flexDirection: "column", boxShadow: "0 20px 60px rgba(0,0,0,0.2)" }}>
        <div style={{ padding: "20px 24px 14px", borderBottom: `1px solid ${BD}`, background: "#FEF2F2", borderRadius: "12px 12px 0 0" }}>
          <h2 style={{ color: RED, fontSize: 17, fontWeight: 700, margin: 0 }}>⚠️ Baixar Contrato como Prejuízo</h2>
          <p style={{ fontSize: 13, color: MUTED, margin: "4px 0 0" }}>{contrato.ID_CONTRATO} • {contrato.NOME_CLIENTE}</p>
        </div>
        <div style={{ padding: 24, overflowY: "auto", flex: 1 }}>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 24, padding: 16, background: BG, borderRadius: 10 }}>
            <div><span style={LS}>Capital Emprestado</span><div style={{ fontSize: 15, fontWeight: 700 }}>{fmtR(capEmp)}</div></div>
            <div><span style={LS}>Capital Recuperado</span><div style={{ fontSize: 15, fontWeight: 700, color: GRN }}>{fmtR(capRec)}</div></div>
            <div style={{ borderTop: `1px solid ${BD}`, paddingTop: 8 }}><span style={LS}>Prejuízo de Capital</span><div style={{ fontSize: 15, fontWeight: 700, color: RED }}>{fmtR(prejuizo)}</div></div>
            <div style={{ borderTop: `1px solid ${BD}`, paddingTop: 8 }}><span style={LS}>Juros não realizados</span><div style={{ fontSize: 15, fontWeight: 700, color: ORG }}>{fmtR(jurosNao)}</div></div>
            <div style={{ borderTop: `1px solid ${BD}`, paddingTop: 8 }}><span style={LS}>Total Pago</span><div style={{ fontSize: 15, fontWeight: 700, color: BLU }}>{fmtR(capRec + jurosRec)}</div></div>
            <div style={{ borderTop: `1px solid ${BD}`, paddingTop: 8 }}><span style={LS}>% Recuperado</span><div style={{ fontSize: 15, fontWeight: 700 }}>{fmtP(pctRec)}</div></div>
            <div style={{ gridColumn: "span 2", borderTop: `1px solid ${BD}`, paddingTop: 8 }}><span style={LS}>Dias de atraso (máx)</span><div style={{ fontSize: 15, fontWeight: 700, color: RED }}>{diasAtraso} dias</div></div>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            <div><span style={LS}>Substatus / Motivo Operacional</span><select value={dados.substatus} onChange={e => setDados(p => ({ ...p, substatus: e.target.value }))} style={IS}><option value="FRAUDE_IDENTIFICADA">Fraude Identificada</option><option value="CLIENTE_DESAPARECIDO">Cliente Desaparecido</option><option value="FALECIMENTO">Falecimento</option><option value="DESEMPREGO_LONGO">Desemprego Longo</option><option value="MA_FE_APARENTE">Má-fé aparente</option></select></div>
            <div><span style={LS}>Motivo Detalhado (Obrigatório)</span><input value={dados.motivo} onChange={e => setDados(p => ({ ...p, motivo: e.target.value }))} style={IS} /></div>
            <div><span style={LS}>Possibilidade de recuperação futura</span><select value={dados.possibilidadeRecuperacao} onChange={e => setDados(p => ({ ...p, possibilidadeRecuperacao: e.target.value }))} style={IS}><option value="BAIXA">Baixa — cliente pouco responsivo</option><option value="RENEGOCIACAO">Alta — aceita negociar</option><option value="JURIDICO">Ação Jurídica Necessária</option></select></div>
            <div><span style={LS}>Status Jurídico</span><select value={dados.statusJuridico} onChange={e => setDados(p => ({ ...p, statusJuridico: e.target.value }))} style={IS}><option value="NAO_ANALISADO">Não analisado</option><option value="EM_ANALISE">Em análise</option><option value="NOTIFICADO">Notificado</option><option value="AJUIZADO">Ajuizado</option></select></div>
            <div><span style={LS}>Próxima Providência</span><input value={dados.proximaProvidencia} onChange={e => setDados(p => ({ ...p, proximaProvidencia: e.target.value }))} style={IS} /></div>
            <div><span style={LS}>Observação Adicional</span><textarea value={dados.observacao} onChange={e => setDados(p => ({ ...p, observacao: e.target.value }))} style={{ ...IS, height: 80, resize: "none" }} /></div>
          </div>
        </div>
        <div style={{ padding: 20, borderTop: `1px solid ${BD}`, display: "flex", gap: 12 }}>
          <button onClick={onFechar} style={{ flex: 1, padding: 12, borderRadius: 8, border: `1px solid ${BD}`, background: CARD, cursor: "pointer", fontWeight: 600 }}>Cancelar</button>
          <button onClick={confirmar} disabled={loading} style={{ flex: 2, padding: 12, borderRadius: 8, border: "none", background: RED, color: "#FFF", cursor: "pointer", fontWeight: 700, opacity: loading ? 0.7 : 1 }}>{loading ? "Processando..." : "Confirmar Baixa como Prejuízo"}</button>
        </div>
      </div>
    </div>
  );
}

function PagamentoDrop({ contratos, parcelas, onSucesso }) {
  const [loading, setLoading] = useState(false);
  const registrar = async (idP, valor) => {
    setLoading(true);
    await postAction({ action: "pagamento", idParcela: idP, valorPago: valor, dataPagamento: hojeStr() });
    onSucesso();
    setLoading(false);
  };
  return (
    <div style={{ background: CARD, padding: 20, borderRadius: 12, border: `1px solid ${BD}` }}>
      <h3 style={{ margin: "0 0 16px", fontSize: 15, fontWeight: 700, display: "flex", alignItems: "center", gap: 8 }}>{Ico.pag} Baixa Rápida</h3>
      <div style={{ display: "flex", flexDirection: "column", gap: 8, maxHeight: 200, overflowY: "auto" }}>
        {(parcelas || []).filter(p => p.STATUS === "atrasado").slice(0, 5).map(p => (
          <div key={p.ID_PARCELA} style={{ padding: 10, background: BG, borderRadius: 8, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <div style={{ fontSize: 12 }}><div style={{ fontWeight: 700 }}>{(p.NOME_CLIENTE || "").split(" ")[0]}</div><div style={{ color: MUTED }}>{p.ID_CONTRATO}</div></div>
            <button onClick={() => registrar(p.ID_PARCELA, parseFloat(p.VALOR_PARCELA))} disabled={loading} style={{ padding: "5px 10px", background: GRN, color: "#FFF", border: "none", borderRadius: 6, fontSize: 11, fontWeight: 700, cursor: "pointer" }}>Pagar {fmtR(p.VALOR_PARCELA)}</button>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── APP ────────────────────────────────────────────────────────────
function App() {
  const [tab, setTab] = useState("dashboard");
  const [busca, setBusca] = useState("");
  const [loading, setLoading] = useState(true);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [raw, setRaw] = useState(null);
  const [filtroStatus, setFiltroStatus] = useState("todos");
  const [filtroBusca, setFiltroBusca] = useState("");
  const [filtroPerdas, setFiltroPerdas] = useState("todos");
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

  const { clientes, contratos, parcelas, pagamentos, eventos } = useMemo(() => {
    if (!raw) return { clientes: [], contratos: [], parcelas: [], pagamentos: [], eventos: [] };
    const normalize = (arr) => (arr || []).map(obj => {
      const n = {};
      for (let k in obj) n[k.toUpperCase()] = obj[k];
      return n;
    });
    return {
      clientes: normalize(raw.CLIENTES),
      contratos: normalize(raw.CONTRATOS),
      parcelas: normalize(raw.PARCELAS),
      pagamentos: normalize(raw.PAGAMENTOS),
      eventos: normalize(raw.EVENTOS)
    };
  }, [raw]);

  const M = useMemo(() => {
    const ativos = contratos.filter(c => !["quitado", "cancelado"].includes((c.STATUS_CONTRATO || "").toLowerCase()));
    const vAtivos = ativos.reduce((s, c) => s + parseFloat(c.VALOR_PRINCIPAL || 0), 0);
    const vAtrasoTotal = parcelas.filter(p => p.STATUS === "atrasado").reduce((s, p) => s + parseFloat(p.VALOR_PARCELA || 0), 0);
    const lucroTotal = parcelas.reduce((s, p) => s + parseFloat(p.VALOR_JUROS || 0), 0);
    const vPrejuizo = contratos.filter(c => c.STATUS_CONTRATO === "baixado_como_prejuizo").reduce((s, c) => s + parseFloat(c.PRINCIPAL_PERDIDO || 0), 0);
    return { vAtivos, vAtrasoTotal, lucroTotal, vPrejuizo, taxaInad: vAtivos > 0 ? (vAtrasoTotal / vAtivos * 100) : 0 };
  }, [contratos, parcelas]);

  const filtrados = useMemo(() => {
    return clientes.filter(c => {
      const nome = (c.NOME_CLIENTE || "").toLowerCase();
      const busca = filtroBusca.toLowerCase();
      return nome.includes(busca);
    });
  }, [clientes, filtroBusca]);

  const mensal = useMemo(() => {
    const meses = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];
    return meses.map((m, i) => {
      const v = parcelas.filter(p => {
        const d = parseDate(p.DATA_PAGAMENTO || p.DATA_VENCIMENTO);
        return d && d.getMonth() === i && (p.STATUS === "pago" || p.STATUS === "atrasado");
      }).reduce((s, p) => s + parseFloat(p.VALOR_PAGO || p.VALOR_PARCELA || 0), 0);
      return { m, v };
    });
  }, [parcelas]);

  const NavItem = ({ id, label, ico }) => (
    <div onClick={() => setTab(id)} style={{ display: "flex", alignItems: "center", gap: 12, padding: "12px 16px", borderRadius: 10, cursor: "pointer", background: tab === id ? BLU : "transparent", color: tab === id ? "#FFF" : MUTED, marginBottom: 4, transition: "0.2s" }}>
      {ico} <span style={{ fontSize: 14, fontWeight: 600 }}>{label}</span>
    </div>
  );

  if (loading && !raw) return <div style={{ height: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: BG }}>Carregando...</div>;

  return (
    <div style={{ display: "flex", height: "100vh", background: BG, color: TEXT, fontFamily: "sans-serif" }}>
      <div style={{ width: sidebarOpen ? SW : 0, background: CARD, borderRight: `1px solid ${BD}`, display: "flex", flexDirection: "column", overflow: "hidden", transition: "0.3s" }}>
        <div style={{ padding: 24, fontWeight: 800, fontSize: 18, borderBottom: `1px solid ${BD}` }}>FinanceiroOp</div>
        <div style={{ padding: 16, flex: 1 }}>
          <NavItem id="dashboard" label="Dashboard" ico={Ico.dash} />
          <NavItem id="clientes" label="Clientes" ico={Ico.cli} />
          <NavItem id="cobranca" label="Cobrança" ico={Ico.cob} />
          <NavItem id="perdas" label="Perdas & Rec." ico={Ico.loss} />
          <div style={{ height: 1, background: BD, margin: "16px 0" }} />
          <NavItem id="novo" label="Novo Contrato" ico={Ico.novo} />
        </div>
      </div>

      <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden" }}>
        <header style={{ height: 64, background: CARD, borderBottom: `1px solid ${BD}`, display: "flex", alignItems: "center", justifyContent: "space-between", padding: "0 24px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 15 }}><button onClick={() => setSidebarOpen(!sidebarOpen)} style={{ background: BG, border: "none", padding: 8, borderRadius: 8, cursor: "pointer" }}>{Ico.arr}</button><h2 style={{ fontSize: 18, fontWeight: 700, margin: 0 }}>{tab.toUpperCase()}</h2></div>
        </header>

        <main style={{ flex: 1, overflowY: "auto", padding: 24 }}>
          {tab === "dashboard" && (
            <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: 20 }}>
                <div style={{ background: CARD, padding: 20, borderRadius: 12, border: `1px solid ${BD}`, display: "flex", alignItems: "center", gap: 16 }}>
                  <div style={{ background: BLU + "15", color: BLU, padding: 12, borderRadius: 12 }}>{Ico.fin}</div>
                  <div><span style={LS}>Total em Aberto</span><div style={{ fontSize: 20, fontWeight: 800 }}>{fmtR(M.vAtivos)}</div></div>
                </div>
                <div style={{ background: CARD, padding: 20, borderRadius: 12, border: `1px solid ${BD}`, display: "flex", alignItems: "center", gap: 16 }}>
                  <div style={{ background: RED + "15", color: RED, padding: 12, borderRadius: 12 }}>{Ico.cob}</div>
                  <div><span style={LS}>Total em Atraso</span><div style={{ fontSize: 20, fontWeight: 800, color: RED }}>{fmtR(M.vAtrasoTotal)}</div></div>
                </div>
                <div style={{ background: CARD, padding: 20, borderRadius: 12, border: `1px solid ${BD}`, display: "flex", alignItems: "center", gap: 16 }}>
                  <div style={{ background: ORG + "15", color: ORG, padding: 12, borderRadius: 12 }}>{Ico.loss}</div>
                  <div><span style={LS}>Inadimplência</span><div style={{ fontSize: 20, fontWeight: 800, color: ORG }}>{fmtP(M.taxaInad)}</div></div>
                </div>
                <div style={{ background: CARD, padding: 20, borderRadius: 12, border: `1px solid ${BD}`, display: "flex", alignItems: "center", gap: 16 }}>
                  <div style={{ background: RED + "15", color: RED, padding: 12, borderRadius: 12 }}>{Ico.loss}</div>
                  <div><span style={LS}>Perda Acumulada</span><div style={{ fontSize: 20, fontWeight: 800, color: RED }}>{fmtR(M.vPrejuizo)}</div></div>
                </div>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr", gap: 24 }}>
                <div style={{ background: CARD, padding: 24, borderRadius: 12, border: `1px solid ${BD}`, height: 350 }}>
                  <h3 style={{ margin: "0 0 20px", fontSize: 16, fontWeight: 700 }}>Recebimentos Mensais</h3>
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={mensal}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={BD} />
                      <XAxis dataKey="m" axisLine={false} tickLine={false} />
                      <YAxis axisLine={false} tickLine={false} tickFormatter={v => `R$ ${v / 1000}k`} />
                      <Tooltip cursor={{ fill: BG }} contentStyle={{ borderRadius: 8, border: "none", boxShadow: "0 4px 12px rgba(0,0,0,0.1)" }} />
                      <Bar dataKey="v" fill={BLU} radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
                <PagamentoDrop contratos={contratos} parcelas={parcelas} onSucesso={carregar} />
              </div>
            </div>
          )}

          {tab === "clientes" && (
            <div style={{ background: CARD, borderRadius: 12, border: `1px solid ${BD}`, overflow: "hidden" }}>
              <div style={{ padding: 20, borderBottom: `1px solid ${BD}`, display: "flex", gap: 12 }}>
                <input placeholder="Buscar cliente..." value={filtroBusca} onChange={e => setFiltroBusca(e.target.value)} style={{ ...IS, width: 300 }} />
              </div>
              <table style={{ width: "100%", borderCollapse: "collapse", textAlign: "left" }}>
                <thead><tr style={{ background: BG, fontSize: 11, color: MUTED, textTransform: "uppercase" }}><th style={{ padding: 15 }}>Cliente</th><th style={{ padding: 15 }}>Status</th><th style={{ padding: 15 }}>Score</th><th style={{ padding: 15 }}>Saldo</th></tr></thead>
                <tbody>
                  {filtrados.map(c => (
                    <tr key={c.ID_CLIENTE} style={{ borderBottom: `1px solid ${BD}`, fontSize: 13 }}>
                      <td style={{ padding: 15, fontWeight: 600 }}>{c.NOME_CLIENTE}</td>
                      <td style={{ padding: 15 }}><Badge c={c.STATUS === "ativo" ? GRN : RED}>{c.STATUS?.toUpperCase()}</Badge></td>
                      <td style={{ padding: 15 }}>{c.SCORE_ATUAL || 0}</td>
                      <td style={{ padding: 15, fontWeight: 700 }}>{fmtR(c.SALDODEV)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {tab === "perdas" && (
            <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
              <div style={{ display: "flex", gap: 10 }}>
                {["todos", "em_cobranca", "pre_prejuizo", "baixado_como_prejuizo"].map(s => (
                  <button key={s} onClick={() => setFiltroPerdas(s)} style={{ padding: "8px 16px", borderRadius: 8, border: `1px solid ${BD}`, background: filtroPerdas === s ? BLU : CARD, color: filtroPerdas === s ? "#FFF" : TEXT, cursor: "pointer", fontSize: 12, fontWeight: 600 }}>{s.toUpperCase()}</button>
                ))}
              </div>
              <div style={{ background: CARD, borderRadius: 12, border: `1px solid ${BD}`, overflow: "hidden" }}>
                <table style={{ width: "100%", borderCollapse: "collapse", textAlign: "left" }}>
                  <thead><tr style={{ background: BG, fontSize: 11, color: MUTED, textTransform: "uppercase" }}><th style={{ padding: 15 }}>Contrato</th><th style={{ padding: 15 }}>Status</th><th style={{ padding: 15 }}>Dias Atraso</th><th style={{ padding: 15 }}>Principal</th><th style={{ padding: 15 }}>Ações</th></tr></thead>
                  <tbody>
                    {contratos.filter(c => STATUS_PERDA.includes(c.STATUS_CONTRATO) && (filtroPerdas === "todos" || c.STATUS_CONTRATO === filtroPerdas)).map(c => (
                      <tr key={c.ID_CONTRATO} style={{ borderBottom: `1px solid ${BD}`, fontSize: 13 }}>
                        <td style={{ padding: 15 }}><div><strong>{c.NOME_CLIENTE}</strong></div><div style={{ color: MUTED, fontSize: 11 }}>{c.ID_CONTRATO}</div></td>
                        <td style={{ padding: 15 }}><Badge c={STATUS_COR[c.STATUS_CONTRATO] || MUTED}>{STATUS_LABEL[c.STATUS_CONTRATO] || c.STATUS_CONTRATO}</Badge></td>
                        <td style={{ padding: 15, color: RED, fontWeight: 600 }}>{c.DIAS_ATRASO_MAX || 0} d</td>
                        <td style={{ padding: 15 }}>{fmtR(c.VALOR_PRINCIPAL)}</td>
                        <td style={{ padding: 15 }}>
                          {c.STATUS_CONTRATO !== "baixado_como_prejuizo" && (
                            <button onClick={() => setBaixaModal(c)} style={{ padding: "6px 12px", borderRadius: 6, border: "none", background: RED, color: "#FFF", fontSize: 11, fontWeight: 700, cursor: "pointer" }}>Baixar Prejuízo</button>
                          )}
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

      {baixaModal && <BaixaModal contrato={baixaModal} pagamentos={pagamentos} onConfirmar={() => { setBaixaModal(null); carregar(); }} onFechar={() => setBaixaModal(null)} />}
    </div>
  );
}

createRoot(document.getElementById("root")).render(<App />);
