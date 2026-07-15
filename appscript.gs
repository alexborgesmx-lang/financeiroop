var ABAS = {
  CLIENTES:   "CLIENTES",
  CONTRATOS:  "CONTRATOS",
  PARCELAS:   "PARCELAS",
  PAGAMENTOS: "PAGAMENTOS",
  EVENTOS:    "EVENTOS",
  PROMESSAS:  "PROMESSAS",
  CONFIG:     "CONFIGURACOES",
  ACORDOS:    "ACORDOS",
  LEADS:      "LEADS",
  MENSAGENS:  "MENSAGENS",
  UNDO_LOG:   "UNDO_LOG",
  QUITACOES:    "QUITACOES",
  CERTIFICADOS: "CERTIFICADOS"
};

var EMAIL_ADMIN = "alexborges.mx@gmail.com";

var TEMPLATE_CONTRATO_ID = "1H84A2PKoOFl6T-Z5O0gvLeodo0nbXcfe1bkt9_rFkxQ";
var PASTA_CONTRATOS_ID   = "1bAYcqnPQeugMBzOfOlxlFzPqQBQR3cAC";
var ZAPSIGN_TOKEN        = "064226b1-6031-4b71-b26f-57006c9403d06d215eb2-a523-4a7d-9684-0d8a10448048";

var STATUS_BLOQUEIO = [
  "em_cobranca","pre_prejuizo","baixado_como_prejuizo",
  "em_recuperacao","recuperado_parcialmente","encerrado_sem_recuperacao",
  "em_processo_judicial","encerrado_judicialmente"
];

var STATUS_TERMINAL = {
  pago: 1, quitacao_antecipada: 1, baixado_como_prejuizo: 1, cancelado: 1, renegociado: 1
};

// ─── UNDO ENGINE — compensating transactions de 15 minutos ───────────────────

var UNDO_TTL_MS = 15 * 60 * 1000;

function _garantirAbaUndoLog() {
  var ss  = SpreadsheetApp.getActiveSpreadsheet();
  var aba = ss.getSheetByName("UNDO_LOG");
  if (aba) return aba;
  aba = ss.insertSheet("UNDO_LOG");
  var h = ["ID_UNDO","DATA_HORA","TIPO_OPERACAO","ID_CONTRATO","ID_CLIENTE","NOME_CLIENTE","PAYLOAD_JSON","STATUS","DATA_REVERSAO","MOTIVO_REVERSAO"];
  aba.getRange(1,1,1,h.length).setValues([h]);
  aba.getRange(1,1,1,h.length).setFontWeight("bold").setBackground("#1a1a2e").setFontColor("#ffffff");
  aba.setFrozenRows(1);
  return aba;
}

function registrarUndo(tipo, idContrato, idCliente, nomeCli, payload) {
  try {
    var aba = _garantirAbaUndoLog();
    var cm  = buildColMap(aba);
    var id  = proximoIdSeq(aba, "UND");
    var nc  = aba.getLastColumn();
    var row = new Array(nc).fill("");
    function s(h,v){ if(cm[h]&&cm[h]<=nc) row[cm[h]-1]=v; }
    s("ID_UNDO",       id);
    s("DATA_HORA",     new Date());
    s("TIPO_OPERACAO", tipo);
    s("ID_CONTRATO",   idContrato);
    s("ID_CLIENTE",    idCliente);
    s("NOME_CLIENTE",  nomeCli);
    s("PAYLOAD_JSON",  JSON.stringify(payload));
    s("STATUS",        "ATIVO");
    var ul = aba.getLastRow()+1;
    aba.getRange(ul,1,1,nc).setValues([row]);
    if(cm["DATA_HORA"]) aba.getRange(ul,cm["DATA_HORA"]).setNumberFormat("dd/mm/yyyy hh:mm:ss");
    return id;
  } catch(e) {
    Logger.log("registrarUndo err: "+e.message);
    return null;
  }
}

function expirarUndosAntigos() {
  var ss  = SpreadsheetApp.getActiveSpreadsheet();
  var aba = ss.getSheetByName("UNDO_LOG");
  if (!aba) return;
  var cm   = buildColMap(aba);
  var data = aba.getDataRange().getValues();
  var agora = Date.now();
  var colSt = cm["STATUS"]||8; var colDt = cm["DATA_HORA"]||2;
  for (var i=1; i<data.length; i++) {
    if (String(data[i][colSt-1]).trim() !== "ATIVO") continue;
    var dt  = data[i][colDt-1];
    if (!dt) continue;
    var ms  = (dt instanceof Date ? dt : new Date(dt)).getTime();
    if (agora - ms > UNDO_TTL_MS) aba.getRange(i+1, colSt).setValue("EXPIRADO");
  }
}

function listarUndosAtivos(idContrato) {
  var ss  = SpreadsheetApp.getActiveSpreadsheet();
  var aba = ss.getSheetByName("UNDO_LOG");
  if (!aba) return [];
  var cm   = buildColMap(aba);
  var data = aba.getDataRange().getValues();
  var agora = Date.now();
  var colSt = cm["STATUS"]||8; var colDt = cm["DATA_HORA"]||2;
  var colId = cm["ID_UNDO"]||1; var colTp = cm["TIPO_OPERACAO"]||3;
  var colIC = cm["ID_CONTRATO"]||4; var colCli = cm["ID_CLIENTE"]||5;
  var colNm = cm["NOME_CLIENTE"]||6;
  var ativos = [];
  for (var i=1; i<data.length; i++) {
    if (String(data[i][colSt-1]).trim() !== "ATIVO") continue;
    var dt  = data[i][colDt-1];
    if (!dt) continue;
    var ms  = (dt instanceof Date ? dt : new Date(dt)).getTime();
    if (agora - ms > UNDO_TTL_MS) continue;
    var idC = String(data[i][colIC-1]).trim();
    if (idContrato && idC !== String(idContrato).trim()) continue;
    ativos.push({
      idUndo:            String(data[i][colId-1]),
      dataHora:          dt instanceof Date ? dt.toISOString() : String(dt),
      tipo:              String(data[i][colTp-1]),
      idContrato:        idC,
      idCliente:         String(data[i][colCli-1]),
      nomeCliente:       String(data[i][colNm-1]),
      segundosRestantes: Math.max(0, Math.round((UNDO_TTL_MS-(agora-ms))/1000))
    });
  }
  return ativos;
}

function reverterOperacao(idUndo, motivo) {
  var aba  = _garantirAbaUndoLog();
  var cm   = buildColMap(aba);
  var data = aba.getDataRange().getValues();
  var lin  = -1; var rowU = null;
  var colId = cm["ID_UNDO"]||1;
  for (var i=1; i<data.length; i++) {
    if (String(data[i][colId-1]).trim() === String(idUndo).trim()) { lin=i+1; rowU=data[i]; break; }
  }
  if (lin === -1) throw new Error("UNDO não encontrado: " + idUndo);

  var colSt = cm["STATUS"]||8; var colDt = cm["DATA_HORA"]||2;
  var colTp = cm["TIPO_OPERACAO"]||3; var colIC = cm["ID_CONTRATO"]||4;
  var colCli = cm["ID_CLIENTE"]||5; var colNm = cm["NOME_CLIENTE"]||6;
  var colPl = cm["PAYLOAD_JSON"]||7;

  var status = String(rowU[colSt-1]).trim();
  if (status !== "ATIVO") throw new Error("Não pode reverter. Status: " + status);

  var dt = rowU[colDt-1];
  var ms = (dt instanceof Date ? dt : new Date(dt)).getTime();
  if (Date.now() - ms > UNDO_TTL_MS) {
    aba.getRange(lin, colSt).setValue("EXPIRADO");
    throw new Error("Operação expirada (15 minutos excedidos).");
  }

  var idContrato = String(rowU[colIC-1]).trim();
  for (var j=1; j<data.length; j++) {
    if (j+1 === lin) continue;
    if (String(data[j][colSt-1]).trim() !== "ATIVO") continue;
    if (String(data[j][colIC-1]).trim() !== idContrato) continue;
    var dtJ = data[j][colDt-1];
    var msJ = (dtJ instanceof Date ? dtJ : new Date(dtJ)).getTime();
    if (msJ > ms) throw new Error("Existe operação mais recente no mesmo contrato. Reverta na ordem inversa.");
  }

  var tipo = String(rowU[colTp-1]).trim();
  var payload;
  try { payload = JSON.parse(String(rowU[colPl-1])); }
  catch(e) { throw new Error("Payload corrompido. Reversão bloqueada."); }

  var undo = {
    idUndo: idUndo, tipo: tipo, idContrato: idContrato,
    idCliente: String(rowU[colCli-1]), nomeCliente: String(rowU[colNm-1]),
    payload: payload
  };

  var resultado;
  if      (tipo === "PAGAMENTO_NORMAL")       resultado = _reverterPagamentoNormal(undo, motivo);
  else if (tipo === "SOMENTE_JUROS")          resultado = _reverterSomenteJuros(undo, motivo);
  else if (tipo === "QUITACAO_ANTECIPADA")    resultado = _reverterQuitacaoAntecipada(undo, motivo);
  else if (tipo === "ACORDO_COM_PERDA")       resultado = _reverterAcordoComPerda(undo, motivo);
  else if (tipo === "RECUPERACAO_APOS_BAIXA") resultado = _reverterRecuperacaoAposBaixa(undo, motivo);
  else if (tipo === "ABATIMENTO_ASSISTIDO")   resultado = _reverterAbatimentoAssistido(undo, motivo);
  else if (tipo === "BAIXA_PREJUIZO")         resultado = _reverterBaixaPrejuizo(undo, motivo);
  else throw new Error("Tipo desconhecido: " + tipo);

  aba.getRange(lin, colSt).setValue("REVERTIDO");
  if (cm["DATA_REVERSAO"])   aba.getRange(lin, cm["DATA_REVERSAO"]).setValue(new Date()).setNumberFormat("dd/mm/yyyy hh:mm:ss");
  if (cm["MOTIVO_REVERSAO"]) aba.getRange(lin, cm["MOTIVO_REVERSAO"]).setValue(motivo||"");

  return resultado;
}

function _reverterPagamentoNormal(undo, motivo) {
  var p = undo.payload;
  reabrirParcelaAPI({ idContrato:undo.idContrato, numParcela:p.numParcela, idPagamento:p.idPagamento, idCliente:undo.idCliente });
  registrarEvento({ idContrato:undo.idContrato, idCliente:undo.idCliente, nomeCliente:undo.nomeCliente,
    tipoEvento:"UNDO_REVERTIDO", observacoes:"Revertido PAGAMENTO_NORMAL parcela #"+p.numParcela+". PAG: "+p.idPagamento+". Motivo: "+(motivo||"não informado") });
  try { calcularScore(undo.idCliente); } catch(e) {}
  try { calcularMetricasCliente(undo.idCliente); } catch(e) {}
  return { revertido:true, tipo:"PAGAMENTO_NORMAL" };
}

function _reverterSomenteJuros(undo, motivo) {
  var p = undo.payload;
  reabrirParcelaAPI({ idContrato:undo.idContrato, numParcela:p.numParcela, idPagamento:p.idPagamento, idCliente:undo.idCliente });
  registrarEvento({ idContrato:undo.idContrato, idCliente:undo.idCliente, nomeCliente:undo.nomeCliente,
    tipoEvento:"UNDO_REVERTIDO", observacoes:"Revertido SOMENTE_JUROS parcela #"+p.numParcela+". PAG: "+p.idPagamento+". Motivo: "+(motivo||"não informado") });
  try { calcularScore(undo.idCliente); } catch(e) {}
  try { calcularMetricasCliente(undo.idCliente); } catch(e) {}
  return { revertido:true, tipo:"SOMENTE_JUROS" };
}

function _reverterQuitacaoAntecipada(undo, motivo) {
  var p = undo.payload;
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  for (var i=0; i<p.parcelas.length; i++) {
    var par = p.parcelas[i];
    reabrirParcelaAPI({ idContrato:undo.idContrato, numParcela:String(par.numParcela), idPagamento:par.idPagamento, idCliente:undo.idCliente });
  }
  var abaC = ss.getSheetByName(ABAS.CONTRATOS);
  var cm   = buildColMap(abaC);
  var rows = abaC.getDataRange().getValues();
  for (var r=1; r<rows.length; r++) {
    if (String(rows[r][(cm["ID_CONTRATO"]||1)-1]).trim() === undo.idContrato) {
      setCel(abaC, r+1, cm, "STATUS_CONTRATO", p.statusContratoAnterior||"ativo_em_atraso");
      setCel(abaC, r+1, cm, "STATUS_CARTEIRA",  p.statusCarteiraAnterior||"ativa");
      break;
    }
  }
  registrarEvento({ idContrato:undo.idContrato, idCliente:undo.idCliente, nomeCliente:undo.nomeCliente,
    tipoEvento:"UNDO_REVERTIDO", observacoes:"Revertido QUITACAO_ANTECIPADA "+p.parcelas.length+" parcela(s). Motivo: "+(motivo||"não informado") });
  try { calcularScore(undo.idCliente); } catch(e) {}
  try { calcularMetricasCliente(undo.idCliente); } catch(e) {}
  return { revertido:true, tipo:"QUITACAO_ANTECIPADA" };
}

function _reverterAcordoComPerda(undo, motivo) {
  var p   = undo.payload;
  var ss  = SpreadsheetApp.getActiveSpreadsheet();
  var abaPag = ss.getSheetByName(ABAS.PAGAMENTOS);
  var cmPag  = buildColMap(abaPag);
  var dataPag = abaPag.getDataRange().getValues();
  for (var j=dataPag.length-1; j>=1; j--) {
    if (String(dataPag[j][(cmPag["ID_PAGAMENTO"]||1)-1]).trim() === String(p.idPagamento).trim()) { abaPag.deleteRow(j+1); break; }
  }
  var abaAc = ss.getSheetByName(ABAS.ACORDOS);
  if (abaAc) {
    var cmAc   = buildColMap(abaAc);
    var dataAc = abaAc.getDataRange().getValues();
    for (var k=dataAc.length-1; k>=1; k--) {
      if (String(dataAc[k][(cmAc["ID_ACORDO"]||1)-1]).trim() === String(p.idAcordo).trim()) { abaAc.deleteRow(k+1); break; }
    }
  }
  var abaP   = ss.getSheetByName(ABAS.PARCELAS);
  var cmP    = buildColMap(abaP);
  var hoje   = new Date(); hoje.setHours(0,0,0,0);
  var stColP = cmP["STATUS"]||cmP["STATUS_PAGAMENTO"];
  var colIdP = cmP["ID_PARCELA"]||1;
  var colDV  = cmP["DATA_VENCIMENTO"]||7;
  var idPs   = p.idParcelas||[];
  if (stColP && idPs.length>0) {
    var dataP = abaP.getDataRange().getValues();
    for (var dp=1; dp<dataP.length; dp++) {
      var idPar = String(dataP[dp][colIdP-1]).trim();
      if (idPs.indexOf(idPar)<0) continue;
      var dtV = dataP[dp][colDV-1];
      var dtVObj = dtV instanceof Date ? new Date(dtV) : (dtV?new Date(dtV):null);
      var novoSt = "pendente";
      if (dtVObj&&!isNaN(dtVObj.getTime())) { dtVObj.setHours(0,0,0,0); novoSt=hoje>dtVObj?"atrasado":"pendente"; }
      abaP.getRange(dp+1,stColP).setValue(novoSt);
      if (cmP["DESCONTO_APLICADO"]) abaP.getRange(dp+1,cmP["DESCONTO_APLICADO"]).setValue("");
      if (cmP["VALOR_RECEBIDO"])    abaP.getRange(dp+1,cmP["VALOR_RECEBIDO"]).setValue("");
    }
  }
  var abaC = ss.getSheetByName(ABAS.CONTRATOS);
  var cmC  = buildColMap(abaC);
  var rows = abaC.getDataRange().getValues();
  for (var r=1; r<rows.length; r++) {
    if (String(rows[r][(cmC["ID_CONTRATO"]||1)-1]).trim() === undo.idContrato) {
      var ca = p.contratoAntes||{};
      setCel(abaC,r+1,cmC,"STATUS_CONTRATO",         ca.STATUS_CONTRATO||"ativo_em_atraso");
      setCel(abaC,r+1,cmC,"STATUS_CARTEIRA",          ca.STATUS_CARTEIRA||"ativa");
      setCel(abaC,r+1,cmC,"VALOR_ACORDO",             ca.VALOR_ACORDO||"");
      setCel(abaC,r+1,cmC,"DATA_ACORDO",              ca.DATA_ACORDO||"");
      setCel(abaC,r+1,cmC,"DESCONTO_PRINCIPAL_ACORDO",ca.DESCONTO_PRINCIPAL_ACORDO||"");
      setCel(abaC,r+1,cmC,"DESCONTO_JUROS_ACORDO",    ca.DESCONTO_JUROS_ACORDO||"");
      setCel(abaC,r+1,cmC,"PREJUIZO_CAPITAL",         ca.PREJUIZO_CAPITAL||"");
      setCel(abaC,r+1,cmC,"JUROS_NAO_REALIZADOS",     ca.JUROS_NAO_REALIZADOS||"");
      setCel(abaC,r+1,cmC,"OBSERVACAO_BAIXA",         ca.OBSERVACAO_BAIXA||"");
      break;
    }
  }
  registrarEvento({ idContrato:undo.idContrato, idCliente:undo.idCliente, nomeCliente:undo.nomeCliente,
    tipoEvento:"UNDO_REVERTIDO", observacoes:"Revertido ACORDO_COM_PERDA. PAG: "+p.idPagamento+". ACO: "+p.idAcordo+". Motivo: "+(motivo||"não informado") });
  try { calcularScore(undo.idCliente); } catch(e) {}
  try { calcularMetricasCliente(undo.idCliente); } catch(e) {}
  return { revertido:true, tipo:"ACORDO_COM_PERDA" };
}

function _reverterRecuperacaoAposBaixa(undo, motivo) {
  var p   = undo.payload;
  var ss  = SpreadsheetApp.getActiveSpreadsheet();
  var abaPag = ss.getSheetByName(ABAS.PAGAMENTOS);
  var cmPag  = buildColMap(abaPag);
  var dataPag = abaPag.getDataRange().getValues();
  for (var j=dataPag.length-1; j>=1; j--) {
    if (String(dataPag[j][(cmPag["ID_PAGAMENTO"]||1)-1]).trim() === String(p.idPagamento).trim()) { abaPag.deleteRow(j+1); break; }
  }
  var abaC = ss.getSheetByName(ABAS.CONTRATOS);
  var cm   = buildColMap(abaC);
  var rows = abaC.getDataRange().getValues();
  for (var r=1; r<rows.length; r++) {
    if (String(rows[r][(cm["ID_CONTRATO"]||1)-1]).trim() === undo.idContrato) {
      setCel(abaC,r+1,cm,"VALOR_RECUPERADO_APOS_BAIXA",parseFloat(p.recuperadoAnterior)||0,"R$ #,##0.00");
      setCel(abaC,r+1,cm,"PREJUIZO_CAPITAL",            parseFloat(p.prejuizoAnterior)||0,  "R$ #,##0.00");
      setCel(abaC,r+1,cm,"STATUS_CONTRATO",             p.statusAnterior||"baixado_como_prejuizo");
      setCel(abaC,r+1,cm,"STATUS_CARTEIRA",             "baixada");
      break;
    }
  }
  registrarEvento({ idContrato:undo.idContrato, idCliente:undo.idCliente, nomeCliente:undo.nomeCliente,
    tipoEvento:"UNDO_REVERTIDO", observacoes:"Revertido RECUPERACAO_APOS_BAIXA. PAG: "+p.idPagamento+". Motivo: "+(motivo||"não informado") });
  try { calcularScore(undo.idCliente); } catch(e) {}
  try { calcularMetricasCliente(undo.idCliente); } catch(e) {}
  return { revertido:true, tipo:"RECUPERACAO_APOS_BAIXA" };
}

function _reverterAbatimentoAssistido(undo, motivo) {
  var p   = undo.payload;
  var ss  = SpreadsheetApp.getActiveSpreadsheet();
  var abaPag = ss.getSheetByName(ABAS.PAGAMENTOS);
  var cmPag  = buildColMap(abaPag);
  var dataPag = abaPag.getDataRange().getValues();
  for (var j=dataPag.length-1; j>=1; j--) {
    if (String(dataPag[j][(cmPag["ID_PAGAMENTO"]||1)-1]).trim() === String(p.idPagamento).trim()) { abaPag.deleteRow(j+1); break; }
  }
  var abaC = ss.getSheetByName(ABAS.CONTRATOS);
  var cm   = buildColMap(abaC);
  var rows = abaC.getDataRange().getValues();
  for (var r=1; r<rows.length; r++) {
    if (String(rows[r][(cm["ID_CONTRATO"]||1)-1]).trim() === undo.idContrato) {
      setCel(abaC,r+1,cm,"VALOR_ABATIDO_ASSISTIDO",parseFloat(p.valorAbatidoAnterior)||0,"R$ #,##0.00");
      break;
    }
  }
  registrarEvento({ idContrato:undo.idContrato, idCliente:undo.idCliente, nomeCliente:undo.nomeCliente,
    tipoEvento:"UNDO_REVERTIDO", observacoes:"Revertido ABATIMENTO_ASSISTIDO. PAG: "+p.idPagamento+". Motivo: "+(motivo||"não informado") });
  return { revertido:true, tipo:"ABATIMENTO_ASSISTIDO" };
}

function _reverterBaixaPrejuizo(undo, motivo) {
  var p  = undo.payload;
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var abaP   = ss.getSheetByName(ABAS.PARCELAS);
  var cmP    = buildColMap(abaP);
  var hoje   = new Date(); hoje.setHours(0,0,0,0);
  var stColP = cmP["STATUS"]||cmP["STATUS_PAGAMENTO"];
  var colIdP = cmP["ID_PARCELA"]||1;
  var colDV  = cmP["DATA_VENCIMENTO"]||7;
  var idPs   = p.idParcelas||[];
  if (stColP && idPs.length>0) {
    var dataP = abaP.getDataRange().getValues();
    for (var dp=1; dp<dataP.length; dp++) {
      var idPar = String(dataP[dp][colIdP-1]).trim();
      if (idPs.indexOf(idPar)<0) continue;
      var dtV = dataP[dp][colDV-1];
      var dtVObj = dtV instanceof Date ? new Date(dtV) : (dtV?new Date(dtV):null);
      var novoSt = "pendente";
      if (dtVObj&&!isNaN(dtVObj.getTime())) { dtVObj.setHours(0,0,0,0); novoSt=hoje>dtVObj?"atrasado":"pendente"; }
      abaP.getRange(dp+1,stColP).setValue(novoSt);
      if (cmP["OBSERVACOES"]) abaP.getRange(dp+1,cmP["OBSERVACOES"]).setValue("");
    }
  }
  var abaC = ss.getSheetByName(ABAS.CONTRATOS);
  var cm   = buildColMap(abaC);
  var rows = abaC.getDataRange().getValues();
  for (var r=1; r<rows.length; r++) {
    if (String(rows[r][(cm["ID_CONTRATO"]||1)-1]).trim() === undo.idContrato) {
      var ca = p.contratoAntes||{};
      setCel(abaC,r+1,cm,"STATUS_CONTRATO",             ca.STATUS_CONTRATO||"ativo_em_atraso");
      setCel(abaC,r+1,cm,"STATUS_CARTEIRA",              ca.STATUS_CARTEIRA||"ativa");
      setCel(abaC,r+1,cm,"PREJUIZO_CAPITAL",             ca.PREJUIZO_CAPITAL||"");
      setCel(abaC,r+1,cm,"JUROS_NAO_REALIZADOS",         ca.JUROS_NAO_REALIZADOS||"");
      setCel(abaC,r+1,cm,"BLOQUEADO_PARA_NOVO_CREDITO",  ca.BLOQUEADO_PARA_NOVO_CREDITO||"");
      setCel(abaC,r+1,cm,"MOTIVO_BLOQUEIO_CREDITO",      ca.MOTIVO_BLOQUEIO_CREDITO||"");
      setCel(abaC,r+1,cm,"DATA_BAIXA_PREJUIZO",          ca.DATA_BAIXA_PREJUIZO||"");
      setCel(abaC,r+1,cm,"MOTIVO_BAIXA_PREJUIZO",        ca.MOTIVO_BAIXA_PREJUIZO||"");
      setCel(abaC,r+1,cm,"OBSERVACAO_BAIXA",             ca.OBSERVACAO_BAIXA||"");
      setCel(abaC,r+1,cm,"VALOR_RECUPERADO_APOS_BAIXA",  ca.VALOR_RECUPERADO_APOS_BAIXA||"");
      break;
    }
  }
  if (p.statusClienteAnterior) {
    try { atualizarCampoCliente(undo.idCliente,"STATUS_CLIENTE",p.statusClienteAnterior); } catch(e) {}
  }
  registrarEvento({ idContrato:undo.idContrato, idCliente:undo.idCliente, nomeCliente:undo.nomeCliente,
    tipoEvento:"UNDO_REVERTIDO", observacoes:"Revertido BAIXA_PREJUIZO. "+idPs.length+" parcela(s) reabertas. Motivo: "+(motivo||"não informado") });
  try { calcularScore(undo.idCliente); } catch(e) {}
  try { calcularMetricasCliente(undo.idCliente); } catch(e) {}
  return { revertido:true, tipo:"BAIXA_PREJUIZO" };
}

// ─── FIM UNDO ENGINE ─────────────────────────────────────────────────────────

// ─── QUITAÇÃO ANTECIPADA VIA PIX ─────────────────────────────────────────────

function _garantirTabelaQuitacoes() {
  var ss  = SpreadsheetApp.getActiveSpreadsheet();
  var aba = ss.getSheetByName(ABAS.QUITACOES);
  if (aba) return aba;
  aba = ss.insertSheet(ABAS.QUITACOES);
  var h = [
    "ID_QUITACAO","ID_CONTRATO","ID_CLIENTE","NOME_CLIENTE",
    "DATA_GERACAO","VALOR_ORIGINAL","DESCONTO","VALOR_FINAL",
    "TXID","EFI_PIX_CODE","STATUS","DATA_EXPIRACAO",
    "DATA_PAGAMENTO","PARCELAS_IDS","OBSERVACOES"
  ];
  aba.getRange(1,1,1,h.length).setValues([h]);
  aba.getRange(1,1,1,h.length).setFontWeight("bold").setBackground("#1a1a2e").setFontColor("#ffffff");
  aba.setFrozenRows(1);
  Logger.log("Aba QUITACOES criada.");
  return aba;
}

function _txidQuitacao(idContrato) {
  var num = parseInt(String(idContrato).replace(/\D/g,"")) || 0;
  return "FOQT" + String(num).padStart(16,"0") + "Q" + "00001";
}

function gerarPropostaQuitacaoPix(dados) {
  var ss   = SpreadsheetApp.getActiveSpreadsheet();
  var abaQ = _garantirTabelaQuitacoes();
  var abaP = ss.getSheetByName(ABAS.PARCELAS);
  var cmQ  = buildColMap(abaQ);
  var cmP  = buildColMap(abaP);

  var idContrato  = String(dados.idContrato  || "").trim();
  var idCliente   = String(dados.idCliente   || "").trim();
  var nomeCliente = String(dados.nomeCliente || "").trim();
  if (!idContrato) throw new Error("idContrato obrigatorio.");

  // Retorna proposta PENDENTE existente sem criar duplicata
  var dadosQ = abaQ.getDataRange().getValues();
  for (var i = 1; i < dadosQ.length; i++) {
    var idQC = String(dadosQ[i][(cmQ["ID_CONTRATO"]||2)-1]).trim();
    var stQ  = String(dadosQ[i][(cmQ["STATUS"]    ||11)-1]).trim().toUpperCase();
    if (idQC === idContrato && stQ === "PENDENTE") {
      return {
        idQuitacao:   String(dadosQ[i][(cmQ["ID_QUITACAO"]  ||1)-1]).trim(),
        txid:         String(dadosQ[i][(cmQ["TXID"]         ||9)-1]).trim(),
        pixCopiaECola:String(dadosQ[i][(cmQ["EFI_PIX_CODE"] ||10)-1]).trim()||null,
        valorFinal:   parseFloat(dadosQ[i][(cmQ["VALOR_FINAL"]||8)-1])||0,
        jaExistia:    true
      };
    }
  }

  // Calcular valores a partir das parcelas selecionadas
  var parcelasIds = (dados.parcelasSelecionadas || []).map(function(x){return String(x).trim();});
  if (parcelasIds.length === 0) throw new Error("Nenhuma parcela selecionada.");
  var desconto       = parseFloat(dados.descontoJuros) || 0;
  var dadosP         = abaP.getDataRange().getValues();
  var totalPrincipal = 0, totalJuros = 0;
  for (var j = 1; j < dadosP.length; j++) {
    var idP = String(dadosP[j][0]).trim();
    if (parcelasIds.indexOf(idP) < 0) continue;
    totalPrincipal += parseFloat(dadosP[j][(cmP["VALOR_PRINCIPAL"]||9)-1])  || 0;
    totalJuros     += parseFloat(dadosP[j][(cmP["VALOR_JUROS"]    ||10)-1]) || 0;
  }
  desconto      = Math.min(desconto, totalJuros);
  var valorFinal = totalPrincipal + totalJuros - desconto;

  var txid      = _txidQuitacao(idContrato);
  var now       = new Date();
  var exp       = new Date(now.getTime() + 48 * 60 * 60 * 1000);
  var idQuit    = proximoIdSeq(abaQ, "QUI");

  var rQ = new Array(15).fill("");
  rQ[0]  = idQuit;
  rQ[1]  = idContrato;
  rQ[2]  = idCliente;
  rQ[3]  = nomeCliente;
  rQ[4]  = now;
  rQ[5]  = totalPrincipal + totalJuros;
  rQ[6]  = desconto;
  rQ[7]  = valorFinal;
  rQ[8]  = txid;
  rQ[9]  = "";
  rQ[10] = "PENDENTE";
  rQ[11] = exp;
  rQ[12] = "";
  rQ[13] = JSON.stringify(parcelasIds);
  rQ[14] = dados.observacao || "";

  var novaLinha = abaQ.getLastRow() + 1;
  abaQ.getRange(novaLinha, 1, 1, 15).setValues([rQ]);
  abaQ.getRange(novaLinha,  5).setNumberFormat("dd/mm/yyyy hh:mm");
  abaQ.getRange(novaLinha, 12).setNumberFormat("dd/mm/yyyy");
  abaQ.getRange(novaLinha,  6).setNumberFormat("R$ #,##0.00");
  abaQ.getRange(novaLinha,  7).setNumberFormat("R$ #,##0.00");
  abaQ.getRange(novaLinha,  8).setNumberFormat("R$ #,##0.00");

  registrarEvento({
    idContrato: idContrato, idCliente: idCliente, nomeCliente: nomeCliente,
    tipoEvento: "PROPOSTA_QUITACAO_PIX_GERADA",
    valorTotal: valorFinal,
    observacoes: "PIX de quitacao gerado. TXID: " + txid +
                 ". Parcelas: " + parcelasIds.length +
                 ". Desconto: R$ " + desconto.toFixed(2)
  });

  return { idQuitacao: idQuit, txid: txid, pixCopiaECola: null, valorFinal: valorFinal, jaExistia: false };
}

function salvarPixQuitacao(dados) {
  var abaQ   = _garantirTabelaQuitacoes();
  var cmQ    = buildColMap(abaQ);
  var dadosQ = abaQ.getDataRange().getValues();
  var txidBusca = String(dados.txid || "").trim();
  for (var i = 1; i < dadosQ.length; i++) {
    var txidRow = String(dadosQ[i][(cmQ["TXID"]||9)-1]).trim();
    var st      = String(dadosQ[i][(cmQ["STATUS"]||11)-1]).trim().toUpperCase();
    if (txidRow === txidBusca && st === "PENDENTE") {
      abaQ.getRange(i+1, cmQ["EFI_PIX_CODE"]||10).setValue(dados.pixCopiaECola || "");
      return;
    }
  }
  // Fallback por idQuitacao
  if (dados.idQuitacao) {
    for (var k = 1; k < dadosQ.length; k++) {
      if (String(dadosQ[k][(cmQ["ID_QUITACAO"]||1)-1]).trim() === String(dados.idQuitacao).trim()) {
        abaQ.getRange(k+1, cmQ["EFI_PIX_CODE"]||10).setValue(dados.pixCopiaECola || "");
        return;
      }
    }
  }
}

function cancelarPropostaQuitacao(dados) {
  var abaQ       = _garantirTabelaQuitacoes();
  var cmQ        = buildColMap(abaQ);
  var dadosQ     = abaQ.getDataRange().getValues();
  var idContrato = String(dados.idContrato || "").trim();
  for (var i = 1; i < dadosQ.length; i++) {
    var idQC = String(dadosQ[i][(cmQ["ID_CONTRATO"]||2)-1]).trim();
    var st   = String(dadosQ[i][(cmQ["STATUS"]    ||11)-1]).trim().toUpperCase();
    if (idQC === idContrato && st === "PENDENTE") {
      abaQ.getRange(i+1, cmQ["STATUS"]||11).setValue("CANCELADO");
      registrarEvento({
        idContrato:  idContrato,
        idCliente:   dados.idCliente   || "",
        nomeCliente: dados.nomeCliente || "",
        tipoEvento:  "PROPOSTA_QUITACAO_CANCELADA",
        observacoes: "Proposta de quitacao PIX cancelada pelo operador."
      });
      return;
    }
  }
}

function pagamentoQuitacaoWebhook(txid, valor, data) {
  // Strip R1/R2 suffix (fallback TXIDs from upsertCobv retries)
  var txidBase  = String(txid || "").trim().replace(/R[12]$/, "");
  var chaveTxid = "QUIT_" + txidBase;
  if (_idem_check(chaveTxid)) {
    Logger.log("pagamentoQuitacaoWebhook: DUPLICATA bloqueada. TXID=" + txid);
    try { _idem_registrar_tentativa_dupla(chaveTxid, "WEBHOOK_EFI_QUITACAO"); } catch(e_) {}
    return { duplicata: true };
  }

  var abaQ   = _garantirTabelaQuitacoes();
  var cmQ    = buildColMap(abaQ);
  var dadosQ = abaQ.getDataRange().getValues();

  var linhaQ = -1; var rowQ = null;
  for (var i = 1; i < dadosQ.length; i++) {
    var txidQ = String(dadosQ[i][(cmQ["TXID"]  ||9)-1]).trim();
    var st    = String(dadosQ[i][(cmQ["STATUS"]||11)-1]).trim().toUpperCase();
    if (txidQ === txidBase && st === "PENDENTE") { linhaQ = i+1; rowQ = dadosQ[i]; break; }
  }
  if (linhaQ === -1) {
    Logger.log("pagamentoQuitacaoWebhook: proposta nao encontrada. TXID=" + txid);
    return { naoEncontrada: true };
  }

  var idContrato  = String(rowQ[(cmQ["ID_CONTRATO"] ||2)-1]).trim();
  var idCliente   = String(rowQ[(cmQ["ID_CLIENTE"]  ||3)-1]).trim();
  var nomeCliente = String(rowQ[(cmQ["NOME_CLIENTE"]||4)-1]).trim();
  var descontoQ   = parseFloat(rowQ[(cmQ["DESCONTO"] ||7)-1]) || 0;
  var parcelasIds = [];
  try { parcelasIds = JSON.parse(String(rowQ[(cmQ["PARCELAS_IDS"]||14)-1])); } catch(e) {}

  // Marcar como PAGO antes de processar (evita corrida)
  abaQ.getRange(linhaQ, cmQ["STATUS"]||11).setValue("PAGO");
  abaQ.getRange(linhaQ, cmQ["DATA_PAGAMENTO"]||13).setValue(new Date()).setNumberFormat("dd/mm/yyyy");

  // Registrar idempotência (usa txidBase — sem sufixo R1/R2 — para chave canônica)
  _idem_reg(chaveTxid, "WEBHOOK_EFI_QUITACAO", { idContrato: idContrato, idCliente: idCliente, origem: "webhook_efi" });

  // Registrar a quitação no sistema
  var dtPag = data
    ? Utilities.formatDate(new Date(String(data)), Session.getScriptTimeZone(), "yyyy-MM-dd")
    : Utilities.formatDate(new Date(), Session.getScriptTimeZone(), "yyyy-MM-dd");
  var resultado;
  try {
    resultado = registrarQuitacaoAntecipada({
      idContrato:           idContrato,
      parcelasSelecionadas: parcelasIds,
      descontoJuros:        descontoQ,
      data:                 dtPag,
      forma:                "pix",
      observacao:           "Pago via PIX Efi Bank. TXID: " + txid
    });
  } catch(eQuit) {
    Logger.log("pagamentoQuitacaoWebhook: erro em registrarQuitacaoAntecipada: " + eQuit.message);
    return { erro: eQuit.message };
  }

  // WPP de confirmação usando a primeira parcela
  if (parcelasIds.length > 0) {
    try {
      var ss   = SpreadsheetApp.getActiveSpreadsheet();
      var abaP = ss.getSheetByName(ABAS.PARCELAS);
      var cmP  = buildColMap(abaP);
      var dP   = abaP.getDataRange().getValues();
      for (var j = 1; j < dP.length; j++) {
        if (String(dP[j][0]).trim() === String(parcelasIds[0]).trim()) {
          _enviarConfirmacaoPagamento({
            idParcela:     String(dP[j][0]),
            idContrato:    idContrato,
            idCliente:     idCliente,
            nomeCliente:   nomeCliente,
            numParcela:    dP[j][(cmP["NUM_PARCELA"]    ||5)-1],
            totalParcelas: dP[j][(cmP["TOTAL_PARCELAS"] ||6)-1],
            vlPago:        parseFloat(valor) || (resultado ? resultado.totalRecebido : 0)
          });
          break;
        }
      }
    } catch(eWpp) { Logger.log("pagamentoQuitacaoWebhook WPP err: " + eWpp.message); }
  }

  return { contratoQuitado: resultado ? resultado.contratoQuitado : false };
}

function verificarQuitacoesExpiradas() {
  var abaQ   = _garantirTabelaQuitacoes();
  var cmQ    = buildColMap(abaQ);
  var dadosQ = abaQ.getDataRange().getValues();
  var agora  = new Date();
  var n      = 0;
  for (var i = 1; i < dadosQ.length; i++) {
    var st    = String(dadosQ[i][(cmQ["STATUS"]        ||11)-1]).trim().toUpperCase();
    if (st !== "PENDENTE") continue;
    var dtExp = dadosQ[i][(cmQ["DATA_EXPIRACAO"]||12)-1];
    if (!dtExp) continue;
    var expDate = dtExp instanceof Date ? dtExp : new Date(dtExp);
    if (expDate < agora) {
      abaQ.getRange(i+1, cmQ["STATUS"]||11).setValue("EXPIRADO");
      n++;
    }
  }
  Logger.log("verificarQuitacoesExpiradas: " + n + " proposta(s) expirada(s).");
}

function corrigirDropdownStatusParcelas() {
  var ss   = SpreadsheetApp.getActiveSpreadsheet();
  var sh   = ss.getSheetByName(ABAS.PARCELAS);
  if (!sh) { Logger.log("Aba PARCELAS nao encontrada."); return; }
  var cm   = buildColMap(sh);
  var stCol = cm["STATUS"] || cm["STATUS_PAGAMENTO"];
  if (!stCol) { Logger.log("Coluna STATUS nao encontrada em PARCELAS."); return; }
  var lastRow = sh.getLastRow();
  if (lastRow <= 1) return;
  var validValues = [
    "pendente","vence_hoje","atrasado","reagendado",
    "pago","quitacao_antecipada","baixado_como_prejuizo","cancelado","renegociado"
  ];
  var rule = SpreadsheetApp.newDataValidation()
    .requireValueInList(validValues, true)
    .setAllowInvalid(true)
    .build();
  sh.getRange(2, stCol, lastRow-1, 1).setDataValidation(rule);
  Logger.log("Dropdown STATUS parcelas corrigido para " + (lastRow-1) + " linhas.");
}

// ─── FIM QUITAÇÃO ANTECIPADA VIA PIX ─────────────────────────────────────────

function onOpen() {
  SpreadsheetApp.getUi()
    .createMenu("FinanceiroOp")
    .addItem("Configurar Sistema", "configurarSistema")
    .addSeparator()
    .addItem("Novo Contrato", "dialogNovoContrato")
    .addItem("Registrar Pagamento", "dialogRegistrarPagamento")
    .addSeparator()
    .addItem("Atualizar Status Parcelas", "atualizarStatusParcelas")
    .addItem("Atualizar Status Contratos", "atualizarStatusContratos")
    .addItem("Resumo do Dia", "dialogResumoDia")
    .addSeparator()
    .addItem("Configurar Trigger Formulario", "configurarTriggerFormulario")
    .addItem("Corrigir Validacoes (rodar 1x)", "corrigirValidacoesColunasW")
    .addItem("Migrar Fase 1 (rodar 1x)", "migrarFase1")
    .addItem("Corrigir Status Baixados (rodar 1x)", "corrigirStatusBaixados")
    .addItem("Corrigir Contratos Quitados Errado (rodar 1x)", "corrigirContratosQuitados")
    .addItem("Criar Colunas Renovação (rodar 1x)", "_garantirColunasRenovacao")
    .addItem("Recalcular Todos os Scores", "recalcularTodosScores")
    .addItem("Recalcular Metricas Clientes (rodar 1x)", "recalcularTodasMetricas")
    .addItem("Atualizar Tabela Empregadores", "atualizarTabelaEmpregadores")
    .addItem("Atualizar Tabela Padrinhos", "atualizarTabelaPadrinhos")
    .addItem("Auditar Dados (FASE 1 e 2)", "auditarDados")
    .addItem("Diagnosticar ID Clientes (ver antes)", "corrigirIdClienteContratos")
    .addItem("EXECUTAR Corrigir ID Clientes", "corrigirIdClienteContratosEXECUTAR")
    .addItem("Diagnosticar Colunas", "diagnosticarColunas")
    .addItem("Diagnosticar Valores Legado", "diagnosticarLegado")
    .addItem("Normalizar TIPO_PAGAMENTO (legado)", "normalizarTipoPagamento")
    .addItem("Normalizar STATUS Parcela (legado)", "normalizarStatusParcela")
    .addItem("Resetar Sistema", "resetarSistema")
    .addSeparator()
    .addItem("PIX: Re-registrar Webhook Efí", "reRegistrarWebhookEfiManual")
    .addItem("PIX: Configurar Polling Horário (rodar 1x)", "configurarTriggerVerificacaoPagamentos")
    .addItem("PIX: Auditar Parcelas (diagnóstico)", "auditarPixParcelas")
    .addItem("PIX: Limpar Abertos p/ Regeneração", "limparPixAbertosParaRegeneracao")
    .addItem("PIX: Gerar Todos Contratos", "gerarPixTodosContratos")
    .addItem("PIX: Backfill TXID (sem chamar Efí)", "backfillEfiTxid")
    .addItem("Régua: Reenviar Confirmações de Pagamento Perdidas (7 dias)", "reenviarConfirmacoesPendentes")
    .addSeparator()
    .addItem("Criar Colunas Empregador CNPJ (rodar 1x)", "_garantirColunasEmpregadorClientes")
    .addItem("Somente Juros: Backfill contador (rodar 1x)", "backfillTotalSomenteJuros")
    .addItem("Auditoria de Integridade (FASE 1)", "auditarIntegridadeSistema")
    .addItem("Configurar Trigger Auditoria 07:05", "configurarTriggerAuditoria")
    .addSeparator()
    .addItem("Backup: Fazer Backup Agora", "fazerBackupAutomatico")
    .addItem("Backup: Configurar Trigger Diário (2h)", "configurarTriggerBackup")
    .addItem("Régua: Configurar Trigger Backup (8h)", "configurarTriggerRegua")
    .addItem("Manutenção: Recalcular JUROS_TOTAL histórico", "recalcularTotaisContratosHistorico")
    .addSeparator()
    .addItem("Quitacao: Criar Aba QUITACOES (rodar 1x)", "_garantirTabelaQuitacoes")
    .addItem("Quitacao: Verificar Expiradas", "verificarQuitacoesExpiradas")
    .addItem("Corrigir Dropdown STATUS Parcelas (rodar 1x)", "corrigirDropdownStatusParcelas")
    .addToUi();
}

function buildColMap(sheet) {
  var n = sheet.getLastColumn();
  var h = sheet.getRange(1, 1, 1, n).getValues()[0];
  var m = {};
  h.forEach(function(v, i) { var k = String(v || "").trim(); if (k) m[k] = i + 1; });
  return m;
}

// Parseia "YYYY-MM-DD" ao meio-dia UTC para evitar shift de timezone em qualquer fuso
function parseDateLocal(s) {
  var p = String(s || "").split(/[\/\-T ]/);
  if (p.length >= 3 && p[0].length === 4)
    return new Date(parseInt(p[0]), parseInt(p[1]) - 1, parseInt(p[2]), 12, 0, 0);
  return new Date(s);
}

function setCel(sheet, row, cm, h, val, fmt) {
  var c = cm[h]; if (!c) return;
  var r = sheet.getRange(row, c);
  r.setValue(val);
  if (fmt) r.setNumberFormat(fmt);
}

function proximoIdSeq(sheet, prefix) {
  var lock = LockService.getScriptLock();
  lock.waitLock(15000);
  try {
    var props = PropertiesService.getScriptProperties();
    var key   = "SEQ_" + prefix;
    var atual = parseInt(props.getProperty(key) || "0");
    if (atual === 0) {
      var d = sheet.getDataRange().getValues();
      d.slice(1).forEach(function(r) {
        var n = parseInt(String(r[0]).replace(/\D/g,"")) || 0;
        if (n > atual) atual = n;
      });
    }
    var next = atual + 1;
    props.setProperty(key, String(next));
    return prefix + String(next).padStart(5, "0");
  } finally {
    lock.releaseLock();
  }
}

function registrarEvento(dados) {
  var ss    = SpreadsheetApp.getActiveSpreadsheet();
  var abaEv = ss.getSheetByName(ABAS.EVENTOS);
  if (!abaEv) return;
  var cm   = buildColMap(abaEv);
  var idEv = proximoIdSeq(abaEv, "EVT");
  var nc   = abaEv.getLastColumn();
  var row  = new Array(nc).fill("");
  function s(h, v) { if (cm[h] && cm[h] <= nc) row[cm[h]-1] = v; }
  s("ID_EVENTO",          idEv);
  s("DATA_EVENTO",        new Date());
  s("ID_CONTRATO",        dados.idContrato   || "");
  s("ID_CLIENTE",         dados.idCliente    || "");
  s("NOME_CLIENTE",       dados.nomeCliente  || "");
  s("ID_PARCELA",         dados.idParcela    || "");
  s("TIPO_EVENTO",        dados.tipoEvento   || "");
  s("VALOR_PRINCIPAL",    dados.valorPrincipal   || 0);
  s("VALOR_JUROS",        dados.valorJuros       || 0);
  s("VALOR_TOTAL",        dados.valorTotal        || 0);
  s("VALOR_EXTRA_ATRASO", dados.valorExtraAtraso  || 0);
  s("STATUS_ANTERIOR",    dados.statusAnterior   || "");
  s("STATUS_NOVO",        dados.statusNovo        || "");
  s("OBSERVACOES",        dados.observacoes       || "");
  var ul = abaEv.getLastRow() + 1;
  abaEv.getRange(ul, 1, 1, nc).setValues([row]);
  if (cm["DATA_EVENTO"])     abaEv.getRange(ul, cm["DATA_EVENTO"]).setNumberFormat("dd/mm/yyyy hh:mm");
  if (cm["VALOR_PRINCIPAL"]) abaEv.getRange(ul, cm["VALOR_PRINCIPAL"]).setNumberFormat("R$ #,##0.00");
  if (cm["VALOR_JUROS"])     abaEv.getRange(ul, cm["VALOR_JUROS"]).setNumberFormat("R$ #,##0.00");
  if (cm["VALOR_TOTAL"])     abaEv.getRange(ul, cm["VALOR_TOTAL"]).setNumberFormat("R$ #,##0.00");
}

function excluirContrato(idContrato) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var id = String(idContrato).trim();

  // 1. Bloquear se existir pagamento registrado
  var abaPag = ss.getSheetByName(ABAS.PAGAMENTOS);
  if (abaPag) {
    var dadosPag = abaPag.getDataRange().getValues();
    var cmPag = buildColMap(abaPag);
    var cIPag = cmPag["ID_CONTRATO"] ? cmPag["ID_CONTRATO"] - 1 : -1;
    if (cIPag >= 0) {
      for (var i = 1; i < dadosPag.length; i++) {
        if (String(dadosPag[i][cIPag]).trim() === id) {
          throw new Error("Contrato possui pagamentos registrados. Exclusão bloqueada.");
        }
      }
    }
  }

  // 2. Apagar linha do contrato fisicamente
  var abaC = ss.getSheetByName(ABAS.CONTRATOS);
  var cmC = buildColMap(abaC);
  var dadosC = abaC.getDataRange().getValues();
  var cICont = cmC["ID_CONTRATO"] ? cmC["ID_CONTRATO"] - 1 : 0;
  var linhaC = -1;
  for (var i = 1; i < dadosC.length; i++) {
    if (String(dadosC[i][cICont]).trim() === id) { linhaC = i + 1; break; }
  }
  if (linhaC === -1) throw new Error("Contrato não encontrado: " + idContrato);
  abaC.deleteRow(linhaC);

  // 3. Apagar parcelas fisicamente (de baixo para cima)
  var abaP = ss.getSheetByName(ABAS.PARCELAS);
  var cmP = buildColMap(abaP);
  var dadosP = abaP.getDataRange().getValues();
  var cIParc = cmP["ID_CONTRATO"] ? cmP["ID_CONTRATO"] - 1 : 1;
  var linhasParc = [];
  for (var i = 1; i < dadosP.length; i++) {
    if (String(dadosP[i][cIParc]).trim() === id) linhasParc.push(i + 1);
  }
  for (var i = linhasParc.length - 1; i >= 0; i--) abaP.deleteRow(linhasParc[i]);

  // 4. Apagar eventos vinculados ao contrato
  var abaE = ss.getSheetByName(ABAS.EVENTOS);
  if (abaE) {
    var cmE = buildColMap(abaE);
    var dadosE = abaE.getDataRange().getValues();
    var cIEvt = cmE["ID_CONTRATO"] ? cmE["ID_CONTRATO"] - 1 : -1;
    if (cIEvt >= 0) {
      var linhasEvt = [];
      for (var i = 1; i < dadosE.length; i++) {
        if (String(dadosE[i][cIEvt]).trim() === id) linhasEvt.push(i + 1);
      }
      for (var i = linhasEvt.length - 1; i >= 0; i--) abaE.deleteRow(linhasEvt[i]);
    }
  }

  // 5. Apagar promessas vinculadas ao contrato
  var abaProm = ss.getSheetByName(ABAS.PROMESSAS);
  if (abaProm) {
    var cmProm = buildColMap(abaProm);
    var dadosProm = abaProm.getDataRange().getValues();
    var cIProm = cmProm["ID_CONTRATO"] ? cmProm["ID_CONTRATO"] - 1 : -1;
    if (cIProm >= 0) {
      var linhasProm = [];
      for (var i = 1; i < dadosProm.length; i++) {
        if (String(dadosProm[i][cIProm]).trim() === id) linhasProm.push(i + 1);
      }
      for (var i = linhasProm.length - 1; i >= 0; i--) abaProm.deleteRow(linhasProm[i]);
    }
  }
}

function statusPorDias(dias) {
  if (dias <= 0)   return "ativo_em_dia";
  if (dias <= 30)  return "ativo_em_atraso";
  if (dias <= 60)  return "em_cobranca";
  if (dias <= 120) return "pre_prejuizo";
  return "pre_prejuizo";
}

function maxDiasAtraso(idContrato, dadosP, cmP) {
  var hoje = new Date(); hoje.setHours(0,0,0,0);
  var iIC = (cmP["ID_CONTRATO"]    || 2) - 1;
  var iSt = (cmP["STATUS"]         || cmP["STATUS_PAGAMENTO"] || 11) - 1;
  var iDV = (cmP["DATA_VENCIMENTO"]|| 7) - 1;
  var max = 0;
  dadosP.slice(1).forEach(function(r) {
    if (String(r[iIC]).trim() !== String(idContrato).trim()) return;
    var st = String(r[iSt]||"").toLowerCase().trim();
    if (st==="pago"||st==="cancelado"||st==="baixado_como_prejuizo"||st==="renegociado"||st==="quitacao_antecipada") return;
    var venc = r[iDV] instanceof Date ? r[iDV] : new Date(r[iDV]);
    if (isNaN(venc.getTime())) return;
    venc.setHours(0,0,0,0);
    var d = Math.max(0, Math.round((hoje - venc)/86400000));
    if (d > max) max = d;
  });
  return max;
}

function doGet(e) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  function toObj(rows) {
    if (!rows || rows.length < 2) return [];
    var h = rows[0];
    return rows.slice(1).map(function(row) {
      var o = {};
      h.forEach(function(hh, i) {
        var v = row[i];
        o[String(hh).trim()] = v instanceof Date ? v.toISOString() : v;
      });
      return o;
    });
  }
  var abaEv   = ss.getSheetByName(ABAS.EVENTOS);
  var abaPr   = ss.getSheetByName(ABAS.PROMESSAS);
  var abaAc   = ss.getSheetByName(ABAS.ACORDOS);
  var abaPad  = ss.getSheetByName("PADRINHOS");
  var abaEmp  = ss.getSheetByName("EMPREGADORES");
  var abaMens = ss.getSheetByName(ABAS.MENSAGENS);
  var data = {
    CLIENTES:     toObj(ss.getSheetByName(ABAS.CLIENTES).getDataRange().getValues()),
    CONTRATOS:    toObj(ss.getSheetByName(ABAS.CONTRATOS).getDataRange().getValues()),
    PARCELAS:     toObj(ss.getSheetByName(ABAS.PARCELAS).getDataRange().getValues()),
    PAGAMENTOS:   toObj(ss.getSheetByName(ABAS.PAGAMENTOS).getDataRange().getValues()),
    EVENTOS:      abaEv   ? toObj(abaEv.getDataRange().getValues())   : [],
    PROMESSAS:    abaPr   ? toObj(abaPr.getDataRange().getValues())   : [],
    ACORDOS:      abaAc   ? toObj(abaAc.getDataRange().getValues())   : [],
    PADRINHOS:    abaPad  ? toObj(abaPad.getDataRange().getValues())  : [],
    EMPREGADORES: abaEmp  ? toObj(abaEmp.getDataRange().getValues())  : [],
    MENSAGENS:    abaMens ? toObj(abaMens.getDataRange().getValues()) : [],
    QUITACOES:    (function(){ var aQ=ss.getSheetByName(ABAS.QUITACOES); return aQ?toObj(aQ.getDataRange().getValues()):[];})()
  };
  return ContentService.createTextOutput(JSON.stringify(data)).setMimeType(ContentService.MimeType.JSON);
}

function doPost(e) {
  var res;
  try {
    var body = JSON.parse(e.postData.contents);
    if      (body.action === "pagamento")             { var rPag=registrarPagamentoAPI(body.idParcela, body.data, body.valor, body.forma||"pix", body.desconto||0); res={ok:true, contratoQuitado: rPag?rPag.contratoQuitado:false, idUndo:rPag?rPag.idUndo:null}; }
    else if (body.action === "pagamentoParcial")       { var rPP=registrarPagamentoParcial(body.idParcela, body.data, body.valor, body.idContrato, body.numParcela); res={ok:true,msg:"Juros registrados. Principal rolado para nova parcela.",idUndo:rPP?rPP.idUndo:null}; }
    else if (body.action === "atualizarCliente")       { atualizarDadosCliente(body.idCliente, body.campos); res={ok:true}; }
    else if (body.action === "ativarCliente")          { atualizarCampoCliente(body.idCliente, "STATUS_CLIENTE", "ativo"); res={ok:true}; }
    else if (body.action === "bloquearClienteManual")   { bloquearClienteManual(body.idCliente, body.motivo||""); res={ok:true}; }
    else if (body.action === "desbloquearClienteManual"){ desbloquearClienteManual(body.idCliente); res={ok:true}; }
    else if (body.action === "novoContrato")           { var id=criarContrato(body.dados); var dadosBoleto=buscarDadosBoleto(id,body.dados.idCliente||body.dados.clienteId||""); res={ok:true,idContrato:id,parcelas:dadosBoleto.parcelas,cliente:dadosBoleto.cliente}; }
    else if (body.action === "gerarDoc")               { var dRes=gerarDocContrato(body.idContrato,body.idCliente,body.dados); res={ok:true,docUrl:dRes.docUrl||"",docId:dRes.docId||""}; }
    else if (body.action === "pagamentoAutomatico")    { var rAuto=pagamentoAutomatico(body.contractNum,body.numParcela,body.valor,body.data,body.txid||"",body.isSJ||false); res={ok:true,contratoQuitado:rAuto?rAuto.contratoQuitado:false,duplicata:rAuto?!!rAuto.duplicata:false}; }
    else if (body.action === "enviarZapSign")          { var cliInfo=buscarInfoCliente(body.idCliente); var zRes=enviarParaZapSign(body.docId,body.idContrato,cliInfo.nome,cliInfo.email,cliInfo.telefone); res={ok:true,zapUrl:zRes}; }
    else if (body.action === "baixarContrato")         { var rBaixa=baixarContratoPrejuizo(body.idContrato, body.dados); res={ok:true,idUndo:rBaixa?rBaixa.idUndo:null}; }
    else if (body.action === "excluirContrato")        { excluirContrato(body.idContrato); res={ok:true}; }
    else if (body.action === "recuperacaoAposBaixa")   { var rRecup=registrarRecuperacaoAposBaixa(body.idContrato, body.dados); res={ok:true,idUndo:rRecup?rRecup.idUndo:null}; }
    else if (body.action === "moverParaAcordoAssistido")    { moverParaAcordoAssistido(body.idContrato, body.dados); res={ok:true}; }
    else if (body.action === "registrarAbatimentoAssistido") { var rAbat=registrarAbatimentoAssistido(body.idContrato, body.dados); res={ok:true,idUndo:rAbat?rAbat.idUndo:null}; }
    else if (body.action === "sairDoAcordoAssistido")        { sairDoAcordoAssistido(body.idContrato, body.destino); res={ok:true}; }
    else if (body.action === "registrarPromessa")      { registrarPromessa(body.dados); res={ok:true}; }
    else if (body.action === "atualizarPromessa")      { atualizarPromessa(body); res={ok:true}; }
    else if (body.action === "atualizarStatusContrato"){ atualizarStatusContrato(body.idContrato, body.dados); res={ok:true}; }
    else if (body.action === "acordoComPerda")         { var rAcordo=registrarAcordoComPerda(body.dados); res={ok:true,resultado:rAcordo,idUndo:rAcordo?rAcordo.idUndo:null}; }
    else if (body.action === "quitacaoAntecipada")     { var rQuit=registrarQuitacaoAntecipada(body.dados); res={ok:true,resultado:rQuit,idUndo:rQuit?rQuit.idUndo:null}; }
    else if (body.action === "listarUndos")            { res={ok:true,undos:listarUndosAtivos(body.idContrato||null)}; }
    else if (body.action === "reverterOperacao")        { var rUndo=reverterOperacao(body.idUndo,body.motivo||""); res={ok:true,resultado:rUndo}; }
    else if (body.action === "calcularScore")           { var rSc=calcularScore(body.idCliente); res={ok:true,score:rSc}; }
    else if (body.action === "recalcularScore")         {
      calcularScore(body.idCliente);
      var aR=SpreadsheetApp.getActiveSpreadsheet().getSheetByName(ABAS.CLIENTES);
      var cmR=buildColMap(aR); var dR=aR.getDataRange().getValues();
      var SF=["SCORE","SCORE_FAIXA","SCORE_DECISAO","SCORE_LIMITE_SUGERIDO","SCORE_PARCELA_MAX","SCORE_TAXA_LABEL","SCORE_TAXA_PCT","SCORE_PRAZO_MAX","SCORE_BLOQUEADO","SCORE_MOTIVOS","SCORE_DATA","RENOVACAO_STATUS","RENOVACAO_MOTIVO","RENOVACAO_CONDICOES"];
      var scoreRet=null;
      for(var iR=1;iR<dR.length;iR++){
        if(String(dR[iR][0]).trim()===String(body.idCliente).trim()){
          scoreRet={};
          SF.forEach(function(f){if(cmR[f])scoreRet[f]=dR[iR][cmR[f]-1];});
          break;
        }
      }
      res={ok:true,score:scoreRet};
    }
    else if (body.action === "reabrirParcela")          { var rRe=reabrirParcelaAPI(body); res={ok:true,msg:rRe}; }
    else if (body.action === "alterarVencimento")        { var rAv=alterarVencimentoContrato(body.idContrato,body.novaData); res={ok:true,parcelas_alteradas:rAv}; }
    else if (body.action === "migrarDataAcordo")        { adicionarColunaDataAcordoParcelas(); res={ok:true}; }
    else if (body.action === "salvarCobrancasEfi")      { var rEfi=salvarCobrancasEfi(body); res={ok:rEfi.ok,salvos:rEfi.salvos||0}; }
    else if (body.action === "buscarLeadPorTel")        { res={ok:true,lead:buscarLeadPorTel(body.tel)}; }
    else if (body.action === "criarLead")               { res={ok:true,idLead:criarLead(body.dados)}; }
    else if (body.action === "atualizarLead")           { atualizarLead(body.idLead,body.dados); res={ok:true}; }
    else if (body.action === "verificarPadrinho")       { res=verificarPadrinho(body.nome); }
    else if (body.action === "buscarClientePorTel")     { res=buscarClientePorTel(body.tel); }
    else if (body.action === "buscarTemplatesRegua")   { res={ok:true,templates:buscarTemplatesRegua()}; }
    else if (body.action === "salvarTemplateRegua")    { salvarTemplateRegua(body.templates||{}); res={ok:true}; }
    else if (body.action === "enviarPixManual")         { var rPM=enviarPixManual(body); res={ok:rPM.ok,erro:rPM.erro||null}; }
    else if (body.action === "ajuizarContrato")         { ajuizarContrato(body.idContrato, body.dados||{}); res={ok:true}; }
    else if (body.action === "atualizarDadosJuridicos") { atualizarDadosJuridicos(body.idContrato, body.campos||{}); res={ok:true}; }
    else if (body.action === "adicionarMovimentacaoJuridica") { adicionarMovimentacaoJuridica(body.idContrato, body.dados||{}); res={ok:true}; }
    else if (body.action === "registrarAcordoJudicial")      { var rAcJud=registrarAcordoJudicial(body.idContrato, body.dados||{}); res={ok:true,resultado:rAcJud}; }
    else if (body.action === "registrarQuitacaoJudicial")    { registrarQuitacaoJudicial(body.idContrato, body.dados||{}); res={ok:true}; }
    else if (body.action === "arquivarProcessoJudicial")     { arquivarProcessoJudicial(body.idContrato, body.dados||{}); res={ok:true}; }
    else if (body.action === "renegociarContrato")           { var rReneg=renegociarContrato(body.dados||{}); res={ok:true,parcelas:rReneg.parcelas,idContrato:rReneg.idContrato,idCliente:rReneg.idCliente,parcelasEncerradas:rReneg.parcelasEncerradas,totalRenegociado:rReneg.totalRenegociado}; }
    else if (body.action === "gerarPropostaQuitacaoPix")     { var rGPQ=gerarPropostaQuitacaoPix(body.dados||{}); res={ok:true,idQuitacao:rGPQ.idQuitacao,txid:rGPQ.txid,pixCopiaECola:rGPQ.pixCopiaECola,valorFinal:rGPQ.valorFinal,jaExistia:rGPQ.jaExistia}; }
    else if (body.action === "salvarPixQuitacao")            { salvarPixQuitacao(body.dados||{}); res={ok:true}; }
    else if (body.action === "cancelarPropostaQuitacao")     { cancelarPropostaQuitacao(body.dados||{}); res={ok:true}; }
    else if (body.action === "pagamentoQuitacaoWebhook")     { var rPQW=pagamentoQuitacaoWebhook(body.txid,body.valor,body.data); res={ok:true,contratoQuitado:rPQW?!!rPQW.contratoQuitado:false,duplicata:rPQW?!!rPQW.duplicata:false}; }
    else if (body.action === "dispararReguaCobranca")        { var rReg=enviarReguaCobranca(false); res={ok:true,enviados:rReg?rReg.enviados:0,erros:rReg?rReg.erros:0}; }
    else if (body.action === "garantirCertificadoQuitacao")  { var dCert=_buscarDadosCertificado(body.idContrato,body.idCliente); var rCert=gerarCertificadoQuitacao({idContrato:body.idContrato,idCliente:body.idCliente,nomeCliente:dCert.nome,cpf:dCert.cpf,datQuitacao:body.datQuitacao||new Date(),totalPago:dCert.totalPago}); res={ok:true,codigo:rCert.codigoValidacao,link:rCert.linkCertificado}; }
    else if (body.action === "buscarCertificado")            { res=Object.assign({ok:true},buscarCertificadoPublico(body.codigo||"")); }
    else { res={erro:"Acao nao reconhecida: "+body.action}; }
  } catch(err) { res={erro:err.message}; }
  return ContentService.createTextOutput(JSON.stringify(res)).setMimeType(ContentService.MimeType.JSON);
}

function adicionarColunaDataAcordoParcelas() {
  var ss   = SpreadsheetApp.getActiveSpreadsheet();
  var aba  = ss.getSheetByName(ABAS.PARCELAS);
  if (!aba) throw new Error("Aba PARCELAS nao encontrada");
  var cm = buildColMap(aba);
  if (!cm["DATA_ACORDO"]) {
    var nc = aba.getLastColumn() + 1;
    aba.getRange(1, nc).setValue("DATA_ACORDO").setFontWeight("bold").setBackground("#1a1a2e").setFontColor("#ffffff");
    Logger.log("Coluna DATA_ACORDO adicionada em PARCELAS");
  } else {
    Logger.log("Coluna DATA_ACORDO ja existe em PARCELAS");
  }
}

function alterarVencimentoContrato(idContrato, novaDataStr) {
  var ss   = SpreadsheetApp.getActiveSpreadsheet();
  var abaP = ss.getSheetByName(ABAS.PARCELAS);
  var cmP  = buildColMap(abaP);
  var dadosP = abaP.getDataRange().getValues();

  var novaBase = parseDateLocal(novaDataStr);
  if (!novaBase || isNaN(novaBase.getTime())) return 0;

  var hoje = new Date(); hoje.setHours(0, 0, 0, 0);

  var cIdC = (cmP["ID_CONTRATO"]    || 2) - 1;
  var cDV  = (cmP["DATA_VENCIMENTO"]|| 7) - 1;
  var cSt  = (cmP["STATUS"]         || 8) - 1;
  var cNP  = (cmP["NUM_PARCELA"]    || 3) - 1;

  // Coletar apenas parcelas pendentes com vencimento futuro (excluir terminais, atrasadas e já vencidas)
  var pendentes = [];
  for (var i = 1; i < dadosP.length; i++) {
    if (String(dadosP[i][cIdC]).trim() !== String(idContrato).trim()) continue;
    var st = String(dadosP[i][cSt] || "").toLowerCase().trim();
    if (STATUS_TERMINAL[st]) continue;
    if (st === "atrasado") continue;
    var dvRaw = dadosP[i][cDV];
    var dv = dvRaw instanceof Date ? new Date(dvRaw.getTime()) : parseDateLocal(String(dvRaw || ""));
    if (!dv || isNaN(dv.getTime())) continue;
    dv.setHours(0, 0, 0, 0);
    if (dv < hoje) continue;
    pendentes.push({ row: i + 1, num: parseInt(dadosP[i][cNP] || 0) });
  }
  pendentes.sort(function(a, b) { return a.num - b.num; });

  // Atribuir datas sequenciais a partir da nova base (+1 mês por parcela)
  var dia = novaBase.getDate();
  for (var j = 0; j < pendentes.length; j++) {
    var ano  = novaBase.getFullYear();
    var mes  = novaBase.getMonth() + j;
    var ultDia = new Date(ano, mes + 1, 0).getDate();
    var diaFinal = dia > ultDia ? ultDia : dia;
    var novaData = new Date(ano, mes, diaFinal, 12, 0, 0);
    var cel = abaP.getRange(pendentes[j].row, cDV + 1);
    cel.setValue(novaData);
    cel.setNumberFormat("dd/mm/yyyy");
  }

  return pendentes.length;
}

function migrarFase1() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();

  function adicionarColunas(nomAba, colunas) {
    var aba = ss.getSheetByName(nomAba);
    if (!aba) { Logger.log("Aba nao encontrada: " + nomAba); return; }
    var cm = buildColMap(aba);
    colunas.forEach(function(h) {
      if (!cm[h]) {
        var nc = aba.getLastColumn() + 1;
        aba.getRange(1, nc).setValue(h).setFontWeight("bold").setBackground("#1a1a2e").setFontColor("#ffffff");
        Logger.log("Coluna adicionada em " + nomAba + ": " + h);
      }
    });
  }

  adicionarColunas(ABAS.CONTRATOS, [
    "STATUS_CARTEIRA","VALOR_ACORDO","DATA_ACORDO","DESCONTO_PRINCIPAL_ACORDO","DESCONTO_JUROS_ACORDO"
  ]);
  adicionarColunas(ABAS.PARCELAS, ["VALOR_RECEBIDO","DESCONTO_APLICADO"]);
  adicionarColunas(ABAS.CLIENTES, ["SCORE","TOTAL_EMPRESTADO","TOTAL_PAGO","CONTRATOS_ATIVOS","CONTRATOS_BAIXADOS"]);

  criarAbaAcordos(ss);
  SpreadsheetApp.getUi().alert("Migracao Fase 1 concluida! Novas colunas adicionadas e aba ACORDOS criada.");
}

function corrigirStatusBaixados() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var count = 0;

  var abaC   = ss.getSheetByName(ABAS.CONTRATOS);
  var cmC    = buildColMap(abaC);
  var dadosC = abaC.getDataRange().getValues();
  var cStC   = cmC["STATUS_CONTRATO"];
  if (cStC) {
    for (var i = 1; i < dadosC.length; i++) {
      if (String(dadosC[i][cStC-1]).trim() === "baixado_prejuizo") {
        abaC.getRange(i+1, cStC).setValue("baixado_como_prejuizo");
        count++;
      }
    }
  }

  var abaP   = ss.getSheetByName(ABAS.PARCELAS);
  var cmP    = buildColMap(abaP);
  var dadosP = abaP.getDataRange().getValues();
  var cStP   = cmP["STATUS"] || cmP["STATUS_PAGAMENTO"];
  if (cStP) {
    for (var j = 1; j < dadosP.length; j++) {
      if (String(dadosP[j][cStP-1]).trim() === "baixado_prejuizo") {
        abaP.getRange(j+1, cStP).setValue("baixado_como_prejuizo");
        count++;
      }
    }
  }

  SpreadsheetApp.getUi().alert("Corrigidos: " + count + " registro(s) de 'baixado_prejuizo' para 'baixado_como_prejuizo'.");
}

function corrigirIdClienteContratos() {
  var ss     = SpreadsheetApp.getActiveSpreadsheet();
  var abaCli = ss.getSheetByName(ABAS.CLIENTES);
  var abaC   = ss.getSheetByName(ABAS.CONTRATOS);
  var abaP   = ss.getSheetByName(ABAS.PARCELAS);
  if (!abaCli||!abaC||!abaP) { SpreadsheetApp.getUi().alert("Aba nao encontrada."); return; }
  var cmCli = buildColMap(abaCli);
  var cmC   = buildColMap(abaC);
  var cmP   = buildColMap(abaP);

  var dadosCli = abaCli.getDataRange().getValues();
  var mapaNome = {};
  var cNome = cmCli["NOME_CLIENTE"] || cmCli["NOME"] || 2;
  var cId   = cmCli["ID_CLIENTE"] || 1;
  for (var i = 1; i < dadosCli.length; i++) {
    var nome = String(dadosCli[i][cNome-1]||"").trim().toLowerCase();
    var id   = String(dadosCli[i][cId-1]||"").trim();
    if (nome && id) mapaNome[nome] = id;
  }

  var totalNomesCli = Object.keys(mapaNome).length;
  var debug = "Nomes carregados de CLIENTES: " + totalNomesCli + "\n";
  debug += "Coluna NOME em CLIENTES: " + cNome + "\n";
  debug += "Coluna ID em CLIENTES: " + cId + "\n";
  debug += "Coluna ID_CLIENTE em CONTRATOS: " + (cmC["ID_CLIENTE"]||"NAO ENCONTRADA") + "\n";
  debug += "Coluna NOME_CLIENTE em CONTRATOS: " + (cmC["NOME_CLIENTE"]||cmC["NOME"]||"NAO ENCONTRADA") + "\n\n";

  // Mostra primeiros 3 nomes do CLIENTES para comparar
  debug += "Primeiros nomes CLIENTES:\n";
  for (var x = 1; x <= Math.min(3, dadosCli.length-1); x++) {
    debug += "  [" + String(dadosCli[x][cId-1]).trim() + "] '" + String(dadosCli[x][cNome-1]).trim() + "'\n";
  }

  // Mostra primeiros 3 nomes do CONTRATOS para comparar
  var dadosC = abaC.getDataRange().getValues();
  var cNomeC = cmC["NOME_CLIENTE"] || cmC["NOME"] || 3;
  debug += "\nPrimeiros nomes CONTRATOS:\n";
  for (var y = 1; y <= Math.min(3, dadosC.length-1); y++) {
    debug += "  ID_CLI='" + String(dadosC[y][(cmC["ID_CLIENTE"]||2)-1]).trim() + "' NOME='" + String(dadosC[y][cNomeC-1]).trim() + "'\n";
  }

  SpreadsheetApp.getUi().alert(debug);
}

function corrigirIdClienteContratosEXECUTAR() {
  var ss     = SpreadsheetApp.getActiveSpreadsheet();
  var abaCli = ss.getSheetByName(ABAS.CLIENTES);
  var abaC   = ss.getSheetByName(ABAS.CONTRATOS);
  var abaP   = ss.getSheetByName(ABAS.PARCELAS);
  if (!abaCli||!abaC||!abaP) { SpreadsheetApp.getUi().alert("Aba nao encontrada."); return; }
  var cmCli = buildColMap(abaCli);
  var cmC   = buildColMap(abaC);
  var cmP   = buildColMap(abaP);

  var dadosCli = abaCli.getDataRange().getValues();
  var mapaNome = {};
  var cNome = cmCli["NOME_CLIENTE"] || cmCli["NOME"] || 2;
  var cId   = cmCli["ID_CLIENTE"] || 1;
  for (var i = 1; i < dadosCli.length; i++) {
    var nome = String(dadosCli[i][cNome-1]||"").trim().toLowerCase();
    var id   = String(dadosCli[i][cId-1]||"").trim();
    if (nome && id) mapaNome[nome] = id;
  }

  function corrigirAba(aba, cm) {
    if (!cm["ID_CLIENTE"]) return 0;
    var cNomeAba = cm["NOME_CLIENTE"] || cm["NOME"] || 0;
    if (!cNomeAba) return 0;
    var dados = aba.getDataRange().getValues();
    var count = 0;
    for (var r = 1; r < dados.length; r++) {
      var nome = String(dados[r][cNomeAba-1]||"").trim().toLowerCase();
      if (!nome) continue;
      var idCorreto = mapaNome[nome];
      if (!idCorreto) continue;
      var idAtual = String(dados[r][cm["ID_CLIENTE"]-1]||"").trim();
      if (idAtual !== idCorreto) {
        aba.getRange(r+1, cm["ID_CLIENTE"]).setValue(idCorreto);
        count++;
      }
    }
    return count;
  }

  var cC = corrigirAba(abaC, cmC);
  var cP = corrigirAba(abaP, cmP);

  SpreadsheetApp.getUi().alert(
    "Concluido!\n" +
    "CONTRATOS corrigidos: " + cC + "\n" +
    "PARCELAS corrigidas: " + cP
  );
}

function corrigirContratosQuitados() {
  var ss   = SpreadsheetApp.getActiveSpreadsheet();
  var abaC = ss.getSheetByName(ABAS.CONTRATOS);
  var abaP = ss.getSheetByName(ABAS.PARCELAS);
  var cmC  = buildColMap(abaC);
  var cmP  = buildColMap(abaP);
  var dadosC = abaC.getDataRange().getValues();
  var dadosP = abaP.getDataRange().getValues();
  var stColP = cmP["STATUS"] || cmP["STATUS_PAGAMENTO"];
  var finais = ["pago","quitacao_antecipada","cancelado","baixado_como_prejuizo","quitado","quitada","renegociado"];
  var count  = 0;
  for (var i = 1; i < dadosC.length; i++) {
    var stC = String(dadosC[i][(cmC["STATUS_CONTRATO"]||16)-1]||"").trim();
    if (stC !== "quitado") continue;
    var idC = String(dadosC[i][(cmC["ID_CONTRATO"]||1)-1]).trim();
    var temAberto = false; var totalPar = 0;
    for (var j = 1; j < dadosP.length; j++) {
      if (String(dadosP[j][(cmP["ID_CONTRATO"]||2)-1]).trim() !== idC) continue;
      totalPar++;
      var stP = String(stColP ? dadosP[j][stColP-1] : "").toLowerCase().trim();
      if (finais.indexOf(stP) === -1) { temAberto = true; break; }
    }
    if (temAberto) {
      setCel(abaC, i+1, cmC, "STATUS_CONTRATO", "ativo_em_dia");
      var idCli = String(dadosC[i][(cmC["ID_CLIENTE"]||2)-1]).trim();
      try { calcularScore(idCli); } catch(e) {}
      count++;
    }
  }
  SpreadsheetApp.getUi().alert("Corrigidos: " + count + " contrato(s) incorretamente marcado(s) como quitado.");
}

function recalcularTodosScores() {
  var ss     = SpreadsheetApp.getActiveSpreadsheet();
  var abaCli = ss.getSheetByName(ABAS.CLIENTES);
  var abaC   = ss.getSheetByName(ABAS.CONTRATOS);
  var abaP   = ss.getSheetByName(ABAS.PARCELAS);
  if (!abaCli || !abaC || !abaP) return;
  // Ler as 3 abas uma vez só — evita timeout
  var dadosCli = abaCli.getDataRange().getValues();
  var dadosC   = abaC.getDataRange().getValues();
  var dadosP   = abaP.getDataRange().getValues();
  var count = 0;
  for (var i = 1; i < dadosCli.length; i++) {
    var idCli = String(dadosCli[i][0]).trim();
    if (!idCli) continue;
    try { calcularScore(idCli, dadosCli, dadosC, dadosP); count++; } catch(e) { Logger.log("Score err " + idCli + ": " + e.message); }
  }
  SpreadsheetApp.getUi().alert("Score recalculado para " + count + " cliente(s).");
}

function calcularScore(idCliente, _dadosCli, _dadosC, _dadosP) {
  var ss     = SpreadsheetApp.getActiveSpreadsheet();
  var abaCli = ss.getSheetByName(ABAS.CLIENTES);
  var abaC   = ss.getSheetByName(ABAS.CONTRATOS);
  var abaP   = ss.getSheetByName(ABAS.PARCELAS);
  if (!abaCli || !abaC || !abaP) return null;

  var cmCli    = buildColMap(abaCli);
  var cmC      = buildColMap(abaC);
  var cmP      = buildColMap(abaP);
  var dadosCli = _dadosCli || abaCli.getDataRange().getValues();
  var dadosC   = _dadosC   || abaC.getDataRange().getValues();
  var dadosP   = _dadosP   || abaP.getDataRange().getValues();

  var gv = function(map, row, h) { return map[h] ? row[map[h]-1] : ""; };
  var gn = function(map, row, h) { return parseFloat(gv(map, row, h)||0)||0; };
  var gs = function(map, row, h) { return String(gv(map, row, h)||"").trim().toLowerCase(); };

  var linCli = -1; var rowCli = null;
  for (var i = 1; i < dadosCli.length; i++) {
    if (String(dadosCli[i][0]).trim() === String(idCliente).trim()) { linCli = i+1; rowCli = dadosCli[i]; break; }
  }
  if (linCli === -1) return null;

  var rendaMensal  = gn(cmCli, rowCli, "RENDA_MENSAL");
  var tipoRenda    = gs(cmCli, rowCli, "TIPO_RENDA");
  var rendaComprov = gs(cmCli, rowCli, "RENDA_COMPROVADA");
  var qualComun    = gs(cmCli, rowCli, "QUALIDADE_COMUNICACAO");
  var padrinho     = String(gv(cmCli, rowCli, "PADRINHO")||"").trim();
  var nomeCli      = String(gv(cmCli, rowCli, "NOME_CLIENTE")||gv(cmCli, rowCli, "NOME")||"").trim();
  var dtCad        = gv(cmCli, rowCli, "DATA_CADASTRO");
  var hoje         = new Date(); hoje.setHours(0,0,0,0);
  var dtCadObj     = dtCad instanceof Date ? dtCad : (dtCad ? new Date(dtCad) : null);
  var mesesCli     = (dtCadObj&&!isNaN(dtCadObj.getTime())) ? Math.round((hoje.getTime()-dtCadObj.getTime())/(30.5*24*60*60*1000)) : 0;

  var stColP = cmP["STATUS"] || cmP["STATUS_PAGAMENTO"];
  var parcelas = [];
  for (var pi = 1; pi < dadosP.length; pi++) {
    if (String(dadosP[pi][(cmP["ID_CLIENTE"]||3)-1]).trim() !== String(idCliente).trim()) continue;
    var dtV = dadosP[pi][(cmP["DATA_VENCIMENTO"]||7)-1];
    var dtVobj = dtV instanceof Date ? new Date(dtV) : (dtV ? new Date(dtV) : null);
    if (dtVobj && !isNaN(dtVobj.getTime())) dtVobj.setHours(0,0,0,0); else dtVobj = null;
    parcelas.push({
      status:     stColP ? String(dadosP[pi][stColP-1]||"").trim().toLowerCase() : "",
      diasAtraso: parseInt(dadosP[pi][(cmP["DIAS_ATRASO"]||0)-1]||0)||0,
      tipoPag:    String(dadosP[pi][(cmP["TIPO_PAGAMENTO"]||0)-1]||"").trim().toLowerCase(),
      idContrato: String(dadosP[pi][(cmP["ID_CONTRATO"]||2)-1]).trim(),
      dtVenc:     dtVobj
    });
  }

  // Construir contratos cruzando PARCELAS → CONTRATOS pelo ID_CONTRATO
  // (evita depender de ID_CLIENTE na aba CONTRATOS, que pode nao existir)
  var idsContratosDoCliente = {};
  parcelas.forEach(function(p){ if (p.idContrato) idsContratosDoCliente[p.idContrato] = true; });
  var contratos = [];
  for (var ci = 1; ci < dadosC.length; ci++) {
    var idCtrC = String(dadosC[ci][(cmC["ID_CONTRATO"]||1)-1]).trim();
    if (!idsContratosDoCliente[idCtrC]) {
      // fallback: se ID_CLIENTE existir na aba, usar diretamente
      if (!cmC["ID_CLIENTE"]) continue;
      if (String(dadosC[ci][cmC["ID_CLIENTE"]-1]).trim() !== String(idCliente).trim()) continue;
    }
    contratos.push({
      id:        idCtrC,
      status:    gs(cmC, dadosC[ci], "STATUS_CONTRATO"),
      principal: gn(cmC, dadosC[ci], "VALOR_PRINCIPAL")
    });
  }

  var fn_in = function(arr, v) { return arr.indexOf(v) >= 0; };
  var ST_QUIT   = ["quitado"];
  var ST_RENEG  = ["renegociado"];
  var ST_PREJ   = ["baixado_como_prejuizo","encerrado_sem_recuperacao","em_processo_judicial","encerrado_judicialmente"];
  var ST_RECUP  = ["recuperado_integralmente","recuperado_parcialmente"];
  var ST_ATIVO  = ["ativo_em_dia","ativo_em_atraso","em_cobranca","pre_prejuizo","acordo_assistido"];
  var ST_PAGOS  = ["pago","quitacao_antecipada"];
  var ST_ABERTO = ["pendente","atrasado","vence_hoje","aberta","em_aberto"];

  var qtdQuit    = contratos.filter(function(c){
    if (!fn_in(ST_QUIT,c.status)) return false;
    var temAberto = parcelas.some(function(p){ return String(p.idContrato).trim()===String(c.id).trim()&&fn_in(ST_ABERTO,p.status); });
    return !temAberto;
  }).length;
  var qtdReneg   = contratos.filter(function(c){ return fn_in(ST_RENEG,c.status); }).length;
  var temPreju   = contratos.some(function(c){ return fn_in(ST_PREJ,c.status); });
  var temRecup   = contratos.some(function(c){ return fn_in(ST_RECUP,c.status); });
  var temAtivo   = contratos.some(function(c){ return c.status==="ativo_em_dia"; });
  var temAtraso  = contratos.some(function(c){ return fn_in(["ativo_em_atraso","em_cobranca","pre_prejuizo"],c.status); });
  var temRenegAt = contratos.some(function(c){ return c.status==="renegociado"; });
  var qtdAtivos  = contratos.filter(function(c){ return fn_in(ST_ATIVO.concat(ST_RENEG),c.status); }).length;
  var principalAtivo = contratos.filter(function(c){ return fn_in(ST_ATIVO,c.status); }).reduce(function(s,c){return s+c.principal;},0);
  var maiorValPago   = contratos.filter(function(c){ return fn_in(ST_QUIT,c.status); }).reduce(function(s,c){return Math.max(s,c.principal);},0);

  var contratosAntec = {};
  parcelas.forEach(function(p){
    if (fn_in(["quitacao_antecipada","pagamento_antecipado"],p.tipoPag)) contratosAntec[p.idContrato]=true;
  });
  var qtdAntec = contratos.filter(function(c){ return fn_in(ST_QUIT,c.status)&&contratosAntec[c.id]; }).length;

  var histP      = parcelas.filter(function(p){ return fn_in(ST_PAGOS,p.status); });
  var totalHist  = histP.length;
  var emDiaHist  = histP.filter(function(p){ return p.diasAtraso===0||fn_in(["pagamento_antecipado","quitacao_antecipada"],p.tipoPag); }).length;
  var antecHist  = histP.filter(function(p){ return fn_in(["pagamento_antecipado","quitacao_antecipada"],p.tipoPag); }).length;
  var atrLeveH   = histP.filter(function(p){ return p.diasAtraso>0&&p.diasAtraso<=7; }).length;
  var atrGraveH  = histP.filter(function(p){ return p.diasAtraso>30; }).length;
  var pctEmDia   = totalHist>0?(emDiaHist/totalHist)*100:0;
  var pctAntec   = totalHist>0?(antecHist/totalHist)*100:0;
  var pctLeve    = totalHist>0?(atrLeveH/totalHist)*100:0;

  var maxAtrasoDias = 0;
  parcelas.forEach(function(p){
    if (fn_in(ST_ABERTO,p.status)&&p.dtVenc) {
      var d = Math.max(0, Math.round((hoje.getTime()-p.dtVenc.getTime())/86400000));
      if (d > maxAtrasoDias) maxAtrasoDias = d;
    }
  });

  var comprometPct = rendaMensal>0 ? Math.min(100,(principalAtivo/rendaMensal)*100) : 50;

  // ── BLOCO A: Histórico de contratos (25 pts) ──
  var ponA = 0;
  ponA += qtdQuit>=4?10:qtdQuit>=2?7:qtdQuit===1?4:0;
  ponA += qtdQuit>=4?6:qtdQuit>=2?4:qtdQuit>=1?2:0;
  ponA += qtdAntec>=2?4:qtdAntec===1?2:0;
  ponA += qtdReneg===0?3:qtdReneg===1?1:0;
  ponA += (temPreju&&!temRecup)?-10:(temPreju?0:2);
  var blocoA = Math.min(25, Math.max(0, ponA));

  // ── BLOCO B: Comportamento de pagamento (30 pts) ──
  var ponB = 0;
  // pctEmDia: suavizar para histórico pequeno (< 5 pagamentos = amostra insuficiente)
  var pontEmDia = pctEmDia>=95?14:pctEmDia>=80?10:pctEmDia>=60?5:0;
  if      (totalHist <= 2) pontEmDia = Math.max(pontEmDia, 5);
  else if (totalHist <= 4) pontEmDia = Math.max(pontEmDia, 2);
  ponB += pontEmDia;
  ponB += pctAntec>=30?4:pctAntec>=10?2:0;
  ponB += atrLeveH===0?5:(pctLeve<=20?3:0);
  ponB += atrGraveH===0?4:(atrGraveH===1?2:0);
  ponB += qualComun==="boa"?5:qualComun==="regular"?2:0;
  var blocoB = Math.min(30, Math.max(0, ponB));

  // ── BLOCO C: Perfil financeiro (20 pts) ──
  var ponC = 0;
  ponC += (rendaComprov==="sim"||rendaComprov==="s")?5:(rendaComprov==="parcial"?3:0);
  ponC += fn_in(["clt","servidor","aposentado","pensionista"],tipoRenda)?5:(tipoRenda==="autonomo"?3:1);
  ponC += comprometPct<=25?5:comprometPct<=35?4:comprometPct<=45?2:0;
  ponC += rendaMensal>0?2:0;
  ponC += comprometPct<=15?3:comprometPct<=30?2:comprometPct<=45?1:0;
  var blocoC = Math.min(20, Math.max(0, ponC));

  // ── BLOCO D: Relacionamento (15 pts) ──
  var ponD = 0;
  ponD += mesesCli>12?5:mesesCli>6?3:mesesCli>0?2:0;
  ponD += padrinho?3:0;
  var indicouBons = false;
  var padColIdx = cmCli["PADRINHO"] ? cmCli["PADRINHO"]-1 : -1;
  if (padColIdx>=0) {
    for (var ic = 1; ic < dadosCli.length; ic++) {
      var pv = String(dadosCli[ic][padColIdx]||"").trim().toLowerCase();
      if (pv && (pv===String(idCliente).trim().toLowerCase()||pv===nomeCli.toLowerCase())) { indicouBons=true; break; }
    }
  }
  ponD += indicouBons?3:0;
  ponD += (temRecup||(qtdQuit>0&&!temPreju&&qtdReneg===0))?4:(qtdReneg>0?1:2);
  var blocoD = Math.min(15, Math.max(0, ponD));

  // ── BLOCO E: Risco atual (10 pts) ──
  var ponE = 0;
  ponE += temAtraso?0:(temAtivo?2:3);
  ponE += temRenegAt?0:2;
  ponE += qtdAtivos<=1?2:(qtdAtivos<=2?1:0);
  ponE += comprometPct<=25?2:(comprometPct<=35?1:0);
  ponE += maxAtrasoDias===0?1:0;
  var blocoE = Math.min(10, Math.max(0, ponE));

  var scoreBase = blocoA + blocoB + blocoC + blocoD + blocoE;

  // ── BONIFICAÇÕES (max +10) ──
  var bonus = 0;
  if (qtdAntec>=1)                              bonus += 3;
  if (qtdQuit>=3&&atrGraveH===0)               bonus += 5;
  if (mesesCli>12&&atrGraveH===0&&!temPreju)   bonus += 5;
  if (qualComun==="boa")                         bonus += 5;
  if (indicouBons)                               bonus += 3;
  bonus = Math.min(10, bonus);

  // ── PENALIZAÇÕES ──
  var penal = 0;
  if      (maxAtrasoDias>30)  penal += 25;
  else if (maxAtrasoDias>15)  penal += 15;
  else if (maxAtrasoDias>7)   penal += 10;
  else if (maxAtrasoDias>0)   penal += 5;
  if (temRenegAt)             penal += 10;
  if (qualComun==="ruim"&&maxAtrasoDias>0) penal += 20;
  else if (qualComun==="ruim")             penal += 5;
  if (temPreju&&!temRecup)    penal += 30;

  var scoreFinal = Math.max(0, Math.min(100, scoreBase + bonus - penal));

  // ── PENALIZAÇÃO POR SOMENTE_JUROS (-10 pts por uso) ──
  var totalSJ_cli = 0;
  for (var sj_i = 1; sj_i < dadosC.length; sj_i++) {
    if (String(gv(cmC, dadosC[sj_i], "ID_CLIENTE")).trim() === String(idCliente).trim()) {
      totalSJ_cli += parseInt(gv(cmC, dadosC[sj_i], "TOTAL_SOMENTE_JUROS") || 0) || 0;
    }
  }
  if (totalSJ_cli > 0) {
    scoreFinal = Math.max(0, scoreFinal - totalSJ_cli * 10);
  }

  // ── FATOR EMPREGADOR ──
  var sitEmp = String(gv(cmCli, rowCli, "SITUACAO_EMPREGADOR")||"").trim().toUpperCase();
  var dtAbEmpStr = String(gv(cmCli, rowCli, "DATA_ABERTURA_EMPREGADOR")||"").trim();
  var empAnosExist = 0;
  if (dtAbEmpStr) {
    var dtAbObj = new Date(dtAbEmpStr);
    if (!isNaN(dtAbObj.getTime())) empAnosExist = (hoje.getTime() - dtAbObj.getTime()) / (365.25*24*60*60*1000);
  }
  if (sitEmp && sitEmp !== "ATIVA") scoreFinal = Math.max(0, scoreFinal - 5);
  if (empAnosExist >= 5) scoreFinal = Math.min(100, scoreFinal + 2);

  // ── BLOQUEIOS ──
  var bloqueado = false; var motivoBloq = "";
  if (maxAtrasoDias>30)                    { bloqueado=true; motivoBloq="Atraso atual >30 dias"; }
  if (qualComun==="ruim"&&maxAtrasoDias>0) { bloqueado=true; motivoBloq="Sumiu durante cobranca"; }
  if (temPreju&&!temRecup)                 { bloqueado=true; motivoBloq="Prejuizo nao recuperado"; }
  if (temRenegAt&&maxAtrasoDias>30)        { bloqueado=true; motivoBloq="Renegociacao ativa inadimplente"; }
  if (scoreFinal<30) bloqueado = true;
  if (bloqueado && scoreFinal>29) scoreFinal = 29;

  // ── CLASSIFICAÇÃO ──
  var faixa, decisao;
  if      (scoreFinal>=90){ faixa="Excelente";   decisao="Aprovado"; }
  else if (scoreFinal>=75){ faixa="Bom";          decisao="Aprovado"; }
  else if (scoreFinal>=60){ faixa="Médio";        decisao="Aprovado com restrição"; }
  else if (scoreFinal>=45){ faixa="Atenção";      decisao="Análise manual"; }
  else if (scoreFinal>=30){ faixa="Alto risco";   decisao="Recusado"; }
  else                    { faixa="Bloqueado";    decisao="Recusado"; }
  if (bloqueado&&motivoBloq) decisao="Bloqueado: "+motivoBloq;

  // ── LIMITE / PRAZO / TAXA / PARCELA ──
  var cfg     = lerConfiguracoes();
  var cfgN    = function(k,d){ return parseFloat(cfg[k])||d; };
  var txMin   = cfgN("TAXA_MINIMA_MENSAL",        0.14);
  var txBaixa = cfgN("TAXA_PADRAO_BAIXA_MENSAL",  0.16);
  var txPad   = cfgN("TAXA_PADRAO_MENSAL",         0.18);
  var txAlta  = cfgN("TAXA_ALTA_MENSAL",           0.22);
  var txMax   = cfgN("TAXA_MAXIMA_MENSAL",         0.25);
  var cmpMax  = cfgN("COMPROMETIMENTO_MAX_PCT",    0.35);
  var limPrim    = cfgN("LIMITE_PRIMEIRO_EMPRESTIMO", 1500);
  var limExcel   = cfgN("LIMITE_SCORE_EXCELENTE",     4000);
  var limBom     = cfgN("LIMITE_SCORE_BOM",           3000);
  var limMedio   = cfgN("LIMITE_SCORE_MEDIO",         1500);
  var limAtencao = cfgN("LIMITE_SCORE_ATENCAO",       1000);
  var pzExcel    = cfgN("PRAZO_MAX_EXCELENTE",        12);
  var pzBom      = cfgN("PRAZO_MAX_BOM",              10);
  var pzMedio    = cfgN("PRAZO_MAX_MEDIO",            6);
  var pzAtencao  = cfgN("PRAZO_MAX_ATENCAO",          3);

  var multRenda  = scoreFinal>=90?1.5:scoreFinal>=75?1.2:scoreFinal>=60?0.8:scoreFinal>=45?0.5:scoreFinal>=30?0.3:0;
  var limPorRenda= rendaMensal>0?rendaMensal*multRenda:0;
  var fatHist    = qtdQuit>=4?1.5:qtdQuit>=2?1.25:qtdQuit===1?1.0:0.4;
  var limPorHist = maiorValPago>0?maiorValPago*fatHist:(rendaMensal>0?rendaMensal*0.4:0);
  var limiteSug  = bloqueado?0:(limPorRenda>0&&limPorHist>0?Math.min(limPorRenda,limPorHist):(limPorRenda||limPorHist||0));
  limiteSug = Math.max(0, limiteSug - principalAtivo);

  // Teto absoluto por faixa — 1º contrato usa limPrim; 2º+ usa teto da faixa
  var ehPrimeiroContrato = (qtdQuit === 0);
  var tetoFaixa = bloqueado ? 0
    : ehPrimeiroContrato
      ? (scoreFinal >= 60 ? limPrim : 0)
      : (scoreFinal>=90?limExcel:scoreFinal>=75?limBom:scoreFinal>=60?limMedio:scoreFinal>=45?limAtencao:0);
  limiteSug = Math.min(limiteSug, tetoFaixa);

  var prazoMax   = scoreFinal>=90?pzExcel:scoreFinal>=75?pzBom:scoreFinal>=60?pzMedio:scoreFinal>=45?pzAtencao:scoreFinal>=30?2:0;
  var taxaPct    = scoreFinal>=90?txMin:scoreFinal>=75?txBaixa:scoreFinal>=60?txPad:scoreFinal>=45?txAlta:txMax;
  var taxaLabel  = scoreFinal>=90?"Mínima":scoreFinal>=75?"Padrão baixa":scoreFinal>=60?"Padrão":scoreFinal>=45?"Alta":"Máxima";
  var pctCFator  = scoreFinal>=90?1.0:scoreFinal>=75?0.80:scoreFinal>=60?0.65:scoreFinal>=45?0.50:0;
  var pctCMax    = cmpMax * pctCFator;
  var parcelaMax = rendaMensal>0?Math.max(0,rendaMensal*pctCMax-(principalAtivo/Math.max(1,prazoMax))):0;

  // ── MOTIVOS ──
  var motivos = [];
  if (qtdQuit>0)          motivos.push("+"+qtdQuit+" contratos quitados");
  if (totalHist>0)        motivos.push((pctEmDia>=80?"+":"-")+"Em dia: "+pctEmDia.toFixed(0)+"%");
  if (maxAtrasoDias>0)    motivos.push("-Atraso atual: "+maxAtrasoDias+"d");
  if (temPreju)           motivos.push("-Prejuizo registrado");
  if (qtdReneg>0)         motivos.push("-"+qtdReneg+" renegociacao(oes)");
  if (qualComun==="boa")  motivos.push("+Comunicacao boa");
  if (qualComun==="ruim") motivos.push("-Comunicacao ruim");
  if (indicouBons)        motivos.push("+Indicou bons clientes");
  if (bloqueado)          motivos.push("BLOQUEADO: "+(motivoBloq||"Score < 30"));
  if (totalSJ_cli > 0)   motivos.push("-Prorrogação ×"+totalSJ_cli+" (-"+(totalSJ_cli*10)+"pts)");
  if (sitEmp && sitEmp !== "ATIVA") motivos.push("-Empregador "+sitEmp+" (-5pts)");
  if (empAnosExist >= 5) motivos.push("+Empregador 5+ anos (+2pts)");

  // ── RECOMENDAÇÃO DE RENOVAÇÃO ──
  var renovStatus, renovMotivo;
  if (bloqueado || scoreFinal < 30) {
    renovStatus = "vermelho";
    renovMotivo = motivoBloq || "Score insuficiente";
  } else if (qtdQuit === 0) {
    renovStatus = "vermelho";
    renovMotivo = "Nenhum contrato quitado ainda";
  } else if (temPreju && !temRecup) {
    renovStatus = "vermelho";
    renovMotivo = "Prejuízo não recuperado";
  } else if (temRenegAt) {
    renovStatus = "vermelho";
    renovMotivo = "Renegociação ativa";
  } else if (maxAtrasoDias > 30) {
    renovStatus = "vermelho";
    renovMotivo = "Atraso atual: " + maxAtrasoDias + " dias";
  } else if (scoreFinal >= 75 && atrGraveH === 0 && qtdReneg === 0) {
    renovStatus = "verde";
    renovMotivo = qtdQuit >= 2
      ? qtdQuit + " contratos quitados — bônus fidelidade aplicado"
      : "1 contrato quitado — início promissor";
  } else if (scoreFinal >= 60) {
    renovStatus = "amarelo";
    var partsRen = [];
    if (atrGraveH > 0) partsRen.push(atrGraveH + " atraso(s) grave(s) no histórico");
    if (qtdReneg > 0)  partsRen.push(qtdReneg + " renegociação(ões)");
    if (maxAtrasoDias > 0 && maxAtrasoDias <= 30) partsRen.push("atraso atual: " + maxAtrasoDias + "d");
    renovMotivo = (partsRen.length > 0 ? partsRen.join(", ") + ". " : "") + "Analisar antes de aprovar.";
  } else if (scoreFinal >= 45) {
    renovStatus = "amarelo";
    renovMotivo = "Score " + scoreFinal + " (Atenção) — análise obrigatória";
  } else {
    renovStatus = "vermelho";
    renovMotivo = "Score " + scoreFinal + " — não renovar agora";
  }
  var isLeal = (renovStatus === "verde" && qtdQuit >= 2);
  var limRenov       = isLeal ? Math.round(limiteSug * 1.10) : limiteSug;
  var prazoRenov     = isLeal ? Math.min(12, prazoMax + 2)   : prazoMax;
  var taxaRenov      = isLeal ? 9.0 : parseFloat((taxaPct * 100).toFixed(1));
  var taxaLabelRenov = isLeal ? "Fidelidade" : taxaLabel;
  var renovCondicoes = "limite:" + limRenov.toFixed(2) + "|prazo:" + prazoRenov + "|taxa:" + taxaRenov.toFixed(1) + "|taxa_label:" + taxaLabelRenov;

  // ── SALVAR ──
  var sc_set = function(h, val) { if (cmCli[h]) { try { abaCli.getRange(linCli, cmCli[h]).setValue(val); } catch(e){} } };
  sc_set("SCORE",                 scoreFinal);
  sc_set("SCORE_FAIXA",           faixa);
  sc_set("SCORE_DECISAO",         decisao);
  sc_set("SCORE_LIMITE_SUGERIDO", parseFloat(limiteSug.toFixed(2)));
  sc_set("SCORE_PARCELA_MAX",     parseFloat(parcelaMax.toFixed(2)));
  sc_set("SCORE_TAXA_LABEL",      taxaLabel);
  sc_set("SCORE_TAXA_PCT",        parseFloat((taxaPct*100).toFixed(1)));
  sc_set("SCORE_PRAZO_MAX",       prazoMax);
  sc_set("SCORE_BLOQUEADO",       bloqueado?"SIM":"NAO");
  sc_set("SCORE_MOTIVOS",         motivos.join(" | "));
  sc_set("RENOVACAO_STATUS",    renovStatus);
  sc_set("RENOVACAO_MOTIVO",    renovMotivo);
  sc_set("RENOVACAO_CONDICOES", renovCondicoes);
  if (cmCli["SCORE_DATA"]) {
    try { var rSd=abaCli.getRange(linCli,cmCli["SCORE_DATA"]); rSd.setValue(new Date()); rSd.setNumberFormat("dd/mm/yyyy"); } catch(e){}
  }
  if (cmCli["SCORE_LIMITE_SUGERIDO"]) { try { abaCli.getRange(linCli,cmCli["SCORE_LIMITE_SUGERIDO"]).setNumberFormat("R$ #,##0.00"); } catch(e){} }
  if (cmCli["SCORE_PARCELA_MAX"])     { try { abaCli.getRange(linCli,cmCli["SCORE_PARCELA_MAX"]).setNumberFormat("R$ #,##0.00"); } catch(e){} }

  return { score:scoreFinal, faixa:faixa, decisao:decisao, bloqueado:bloqueado,
    limiteSugerido:limiteSug, prazoMax:prazoMax, parcelaMax:parcelaMax,
    taxaLabel:taxaLabel, motivos:motivos,
    renovacao:{ status:renovStatus, motivo:renovMotivo, condicoes:renovCondicoes } };
}

function atualizarTotaisContrato(idContrato, ss) {
  if (!ss) ss = SpreadsheetApp.getActiveSpreadsheet();
  var abaC = ss.getSheetByName(ABAS.CONTRATOS);
  var abaP = ss.getSheetByName(ABAS.PARCELAS);
  var cmP  = buildColMap(abaP);

  // Busca linha do contrato escaneando coluna 1 (ID_CONTRATO)
  var dadosC = abaC.getDataRange().getValues();
  var contratoLin    = -1;
  var valorPrincipal = 0;
  var taxaMensal     = 0;
  for (var i = 1; i < dadosC.length; i++) {
    if (String(dadosC[i][0]).trim() === String(idContrato).trim()) {
      contratoLin    = i + 1;
      valorPrincipal = parseFloat(dadosC[i][5]) || 0; // col 6 = VALOR_PRINCIPAL
      taxaMensal     = parseFloat(dadosC[i][7]) || 0; // col 8 = TAXA_JUROS_MENSAL
      break;
    }
  }
  if (contratoLin < 0) return;

  // Soma VALOR_JUROS de todas as parcelas deste contrato
  var dadosP = abaP.getDataRange().getValues();
  var cIdP   = (cmP["ID_CONTRATO"] || 2) - 1;
  var cVJ    = cmP["VALOR_JUROS"] ? cmP["VALOR_JUROS"] - 1 : 9; // col 10, idx 9

  var count = 0, jurosTotal = 0;
  for (var j = 1; j < dadosP.length; j++) {
    if (String(dadosP[j][cIdP]).trim() === String(idContrato).trim()) {
      count++;
      jurosTotal += parseFloat(dadosP[j][cVJ]) || 0;
    }
  }
  if (count === 0) return;

  // VALOR_TOTAL = VALOR_PRINCIPAL (inalterado) + soma dos juros reais
  var valorTotal = valorPrincipal + jurosTotal;
  var taxaTotal  = taxaMensal * count;
  var parcMedia  = valorTotal / count;
  var parcPrinc  = valorPrincipal / count;
  var parcJuros  = jurosTotal / count;

  // Atualiza por posição de coluna (baseado na ordem de escrita de criarContrato)
  // col 7=NUM_PARCELAS, 9=TAXA_JUROS_TOTAL, 10=JUROS_TOTAL, 11=VALOR_TOTAL
  // col 12=VALOR_PARCELA, 13=PARCELA_PRINCIPAL, 14=PARCELA_JUROS
  abaC.getRange(contratoLin, 7).setValue(count);
  abaC.getRange(contratoLin, 9).setValue(taxaTotal).setNumberFormat("0.00%");
  abaC.getRange(contratoLin, 10).setValue(jurosTotal).setNumberFormat("R$ #,##0.00");
  abaC.getRange(contratoLin, 11).setValue(valorTotal).setNumberFormat("R$ #,##0.00");
  abaC.getRange(contratoLin, 12).setValue(parcMedia).setNumberFormat("R$ #,##0.00");
  abaC.getRange(contratoLin, 13).setValue(parcPrinc).setNumberFormat("R$ #,##0.00");
  abaC.getRange(contratoLin, 14).setValue(parcJuros).setNumberFormat("R$ #,##0.00");
}

function reabrirParcelaAPI(v) {
  var ss     = SpreadsheetApp.getActiveSpreadsheet();
  var abaP   = ss.getSheetByName(ABAS.PARCELAS);
  var abaPag = ss.getSheetByName(ABAS.PAGAMENTOS);
  var abaC   = ss.getSheetByName(ABAS.CONTRATOS);
  if (!abaP || !abaPag || !abaC) throw new Error("Aba nao encontrada");

  var idContrato  = String(v.idContrato||"").trim();
  var numParcela  = String(v.numParcela||"").trim();
  var idPagamento = String(v.idPagamento||"").trim();
  var idCliente   = String(v.idCliente||"").trim();
  if (!idContrato || !numParcela) throw new Error("idContrato e numParcela sao obrigatorios");

  var cmP   = buildColMap(abaP);
  var cmPag = buildColMap(abaPag);
  var cmC   = buildColMap(abaC);
  var hoje  = new Date(); hoje.setHours(0,0,0,0);

  // ── 1. Resetar parcela ──
  var dadosP = abaP.getDataRange().getValues();
  var parcelaLin = -1;
  var idParcelaOriginal = "";
  var tipoAnterior = "";
  for (var i = 1; i < dadosP.length; i++) {
    var pc = String(dadosP[i][(cmP["ID_CONTRATO"]||2)-1]).trim();
    var pn = String(dadosP[i][(cmP["NUM_PARCELA"]||5)-1]).trim();
    if (pc === idContrato && pn === numParcela) {
      parcelaLin = i + 1;
      idParcelaOriginal = String(dadosP[i][(cmP["ID_PARCELA"]||1)-1]).trim();
      tipoAnterior = String(dadosP[i][(cmP["TIPO_PAGAMENTO"]||15)-1]).trim();
      var dtV = dadosP[i][(cmP["DATA_VENCIMENTO"]||7)-1];
      var dtVObj = dtV instanceof Date ? new Date(dtV) : (dtV ? new Date(dtV) : null);
      var novoSt = "pendente";
      if (dtVObj && !isNaN(dtVObj.getTime())) {
        dtVObj.setHours(0,0,0,0);
        novoSt = hoje > dtVObj ? "atrasado" : "pendente";
      }
      if (cmP["STATUS"])           abaP.getRange(parcelaLin, cmP["STATUS"]).setValue(novoSt);
      if (cmP["STATUS_PAGAMENTO"]) abaP.getRange(parcelaLin, cmP["STATUS_PAGAMENTO"]).setValue(novoSt);
      if (cmP["DATA_PAGAMENTO"])   abaP.getRange(parcelaLin, cmP["DATA_PAGAMENTO"]).setValue("");
      if (cmP["VALOR_PAGO"])       abaP.getRange(parcelaLin, cmP["VALOR_PAGO"]).setValue("");
      if (cmP["VALOR_RECEBIDO"])   abaP.getRange(parcelaLin, cmP["VALOR_RECEBIDO"]).setValue("");
      if (cmP["DIFERENCA_PAGA"])   abaP.getRange(parcelaLin, cmP["DIFERENCA_PAGA"]).setValue("");
      if (cmP["DESCONTO_APLICADO"])  abaP.getRange(parcelaLin, cmP["DESCONTO_APLICADO"]).setValue("");
      if (cmP["DIAS_ATRASO"])        abaP.getRange(parcelaLin, cmP["DIAS_ATRASO"]).setValue("");
      if (cmP["DIAS_ANTECIPACAO"])   abaP.getRange(parcelaLin, cmP["DIAS_ANTECIPACAO"]).setValue("");
      if (cmP["TIPO_PAGAMENTO"])     abaP.getRange(parcelaLin, cmP["TIPO_PAGAMENTO"]).setValue("");
      if (cmP["OBSERVACOES"])        abaP.getRange(parcelaLin, cmP["OBSERVACOES"]).setValue("");
      break;
    }
  }
  if (parcelaLin === -1) throw new Error("Parcela nao encontrada: " + idContrato + " #" + numParcela);

  // ── 2. Deletar pagamento de PAGAMENTOS ──
  if (idPagamento) {
    var dadosPag = abaPag.getDataRange().getValues();
    var cIdPag = cmPag["ID_PAGAMENTO"] || 1;
    for (var j = dadosPag.length - 1; j >= 1; j--) {
      if (String(dadosPag[j][cIdPag-1]).trim() === idPagamento) {
        abaPag.deleteRow(j + 1);
        break;
      }
    }
  }

  // ── 2b. Se era somente_juros, deletar parcela gerada automaticamente ──
  if (tipoAnterior === "somente_juros" && idParcelaOriginal) {
    var cOrig = (cmP["ORIGEM_PARCELA"]    || 16) - 1;
    var cOId  = (cmP["ID_PARCELA_ORIGEM"] || 17) - 1;
    var cIdCt = (cmP["ID_CONTRATO"]       ||  2) - 1;
    for (var k = dadosP.length - 1; k >= 1; k--) {
      if (String(dadosP[k][cOrig]||"").trim() === "gerada_por_pagamento_de_juros" &&
          String(dadosP[k][cOId] ||"").trim() === idParcelaOriginal &&
          String(dadosP[k][cIdCt]||"").trim() === idContrato) {
        abaP.deleteRow(k + 1);
        SpreadsheetApp.flush();
        break;
      }
    }
    // Decrementar TOTAL_SOMENTE_JUROS no contrato
    var cmCReab = buildColMap(abaC);
    if (cmCReab["TOTAL_SOMENTE_JUROS"]) {
      var dadosCReab = abaC.getDataRange().getValues();
      for (var cr = 1; cr < dadosCReab.length; cr++) {
        if (String(dadosCReab[cr][0]).trim() === idContrato) {
          var curSJ = parseInt(dadosCReab[cr][cmCReab["TOTAL_SOMENTE_JUROS"]-1] || 0) || 0;
          abaC.getRange(cr + 1, cmCReab["TOTAL_SOMENTE_JUROS"]).setValue(Math.max(0, curSJ - 1));
          break;
        }
      }
    }
  }

  // ── 2c. Recalcular TOTAL_PARCELAS para todas as parcelas deste contrato ──
  if (cmP["TOTAL_PARCELAS"]) {
    var dadosPAtual = abaP.getDataRange().getValues();
    var cIC2 = (cmP["ID_CONTRATO"]||2)-1;
    var cNP2 = (cmP["NUM_PARCELA"]||5)-1;
    var maxNPAtual = 0;
    for (var m = 1; m < dadosPAtual.length; m++) {
      if (String(dadosPAtual[m][cIC2]).trim() === idContrato) {
        var np2 = parseInt(dadosPAtual[m][cNP2])||0;
        if (np2 > maxNPAtual) maxNPAtual = np2;
      }
    }
    for (var m2 = 1; m2 < dadosPAtual.length; m2++) {
      if (String(dadosPAtual[m2][cIC2]).trim() === idContrato) {
        abaP.getRange(m2+1, cmP["TOTAL_PARCELAS"]).setValue(maxNPAtual);
      }
    }
  }

  // ── 3. Recalcular totais e status do contrato ──
  try { atualizarTotaisContrato(idContrato, ss); } catch(eTC) { Logger.log("TotaisContrato err: "+eTC.message); }

  // ── 4. Log de evento ──
  try {
    var abaE = ss.getSheetByName(ABAS.EVENTOS);
    if (abaE) {
      abaE.appendRow([new Date(), idContrato, idCliente, "reabertura_parcela",
        "Parcela " + numParcela + " reaberta manualmente. Pagamento " + idPagamento + " removido."]);
    }
  } catch(e) {}

  // ── 5. Recalcular score e métricas ──
  if (idCliente) try { calcularScore(idCliente); } catch(e) {}
  if (idCliente) try { calcularMetricasCliente(idCliente); } catch(e) { Logger.log("Metricas err: "+e.message); }

  return "Parcela " + numParcela + " do contrato " + idContrato + " reaberta com sucesso";
}

function registrarAcordoComPerda(v) {
  var ss    = SpreadsheetApp.getActiveSpreadsheet();
  var abaC  = ss.getSheetByName(ABAS.CONTRATOS);
  var abaP  = ss.getSheetByName(ABAS.PARCELAS);
  var abaAc = ss.getSheetByName(ABAS.ACORDOS);
  var abaPag = ss.getSheetByName(ABAS.PAGAMENTOS);

  if (!abaAc) throw new Error("Aba ACORDOS nao encontrada. Execute Migrar Fase 1 primeiro.");

  var cm   = buildColMap(abaC);
  var cmP  = buildColMap(abaP);
  var cmAc = buildColMap(abaAc);
  var cmPag = buildColMap(abaPag);

  var contratos = abaC.getDataRange().getValues();
  var linhaC = -1; var rowC = null;
  for (var i = 1; i < contratos.length; i++) {
    if (String(contratos[i][(cm["ID_CONTRATO"]||1)-1]).trim() === String(v.idContrato).trim()) {
      linhaC = i + 1; rowC = contratos[i]; break;
    }
  }
  if (linhaC === -1) throw new Error("Contrato nao encontrado: " + v.idContrato);

  var idCliente      = String(rowC[(cm["ID_CLIENTE"]   ||2)-1]);
  var nomeCliente    = String(rowC[(cm["NOME_CLIENTE"] ||3)-1]);
  var statusAnterior = String(rowC[(cm["STATUS_CONTRATO"]||16)-1]||"");
  var contratoAntesAcordo = {
    STATUS_CONTRATO:           statusAnterior,
    STATUS_CARTEIRA:           String(rowC[(cm["STATUS_CARTEIRA"]          ||0)-1]||""),
    VALOR_ACORDO:              String(rowC[(cm["VALOR_ACORDO"]             ||0)-1]||""),
    DATA_ACORDO:               "",
    DESCONTO_PRINCIPAL_ACORDO: String(rowC[(cm["DESCONTO_PRINCIPAL_ACORDO"]||0)-1]||""),
    DESCONTO_JUROS_ACORDO:     String(rowC[(cm["DESCONTO_JUROS_ACORDO"]    ||0)-1]||""),
    PREJUIZO_CAPITAL:          String(rowC[(cm["PREJUIZO_CAPITAL"]         ||0)-1]||""),
    JUROS_NAO_REALIZADOS:      String(rowC[(cm["JUROS_NAO_REALIZADOS"]     ||0)-1]||""),
    OBSERVACAO_BAIXA:          String(rowC[(cm["OBSERVACAO_BAIXA"]         ||0)-1]||"")
  };

  var parcelas = abaP.getDataRange().getValues();
  var stColP   = cmP["STATUS"] || cmP["STATUS_PAGAMENTO"];
  var parcelasAbertas = [];

  for (var j = 1; j < parcelas.length; j++) {
    var idCtr = String(parcelas[j][(cmP["ID_CONTRATO"]||2)-1]).trim();
    if (idCtr !== String(v.idContrato).trim()) continue;
    var st = String(stColP ? parcelas[j][stColP-1] : "").toLowerCase().trim();
    if (st==="pago"||st==="cancelado"||st==="baixado_como_prejuizo"||st==="renegociado") continue;
    parcelasAbertas.push({
      linha:     j + 1,
      idParcela: String(parcelas[j][0]).trim(),
      principal: parseFloat(parcelas[j][(cmP["VALOR_PRINCIPAL"]||9)-1])  || 0,
      juros:     parseFloat(parcelas[j][(cmP["VALOR_JUROS"]    ||10)-1]) || 0,
      valor:     parseFloat(parcelas[j][(cmP["VALOR_PARCELA"]  ||8)-1])  || 0
    });
  }

  var totalPrincipalAberto = parcelasAbertas.reduce(function(s,p){return s+p.principal;},0);
  var totalJurosAberto     = parcelasAbertas.reduce(function(s,p){return s+p.juros;},0);
  var totalDivida          = totalPrincipalAberto + totalJurosAberto;
  var valorAcordado = parseFloat(v.valorAcordado) || 0;
  var principalRecuperado = Math.min(valorAcordado, totalPrincipalAberto);
  var jurosRecuperado     = Math.max(0, valorAcordado - principalRecuperado);
  var descontoPrincipal   = totalPrincipalAberto - principalRecuperado;
  var descontoJuros       = totalJurosAberto - jurosRecuperado;

  for (var k = 0; k < parcelasAbertas.length; k++) {
    var pa = parcelasAbertas[k];
    if (stColP)             abaP.getRange(pa.linha, stColP).setValue("renegociado");
    if (cmP["DESCONTO_APLICADO"]) abaP.getRange(pa.linha, cmP["DESCONTO_APLICADO"]).setValue(pa.principal + pa.juros);
    if (cmP["VALOR_RECEBIDO"])    abaP.getRange(pa.linha, cmP["VALOR_RECEBIDO"]).setValue(0);
  }

  setCel(abaC, linhaC, cm, "STATUS_CONTRATO",          "renegociado");
  setCel(abaC, linhaC, cm, "STATUS_CARTEIRA",           "renegociada");
  setCel(abaC, linhaC, cm, "VALOR_ACORDO",              valorAcordado,    "R$ #,##0.00");
  setCel(abaC, linhaC, cm, "DATA_ACORDO",               new Date(v.data||new Date()), "dd/mm/yyyy");
  setCel(abaC, linhaC, cm, "DESCONTO_PRINCIPAL_ACORDO", descontoPrincipal,"R$ #,##0.00");
  setCel(abaC, linhaC, cm, "DESCONTO_JUROS_ACORDO",     descontoJuros,    "R$ #,##0.00");
  setCel(abaC, linhaC, cm, "PREJUIZO_CAPITAL",          descontoPrincipal,"R$ #,##0.00");
  setCel(abaC, linhaC, cm, "JUROS_NAO_REALIZADOS",      descontoJuros,    "R$ #,##0.00");
  setCel(abaC, linhaC, cm, "OBSERVACAO_BAIXA",          v.observacao || ("Acordo com perda. Recebido: R$ "+valorAcordado.toFixed(2)));

  var idAcordo = proximoIdSeq(abaAc, "ACO");
  var ncAc = abaAc.getLastColumn();
  var rowAc = new Array(ncAc).fill("");
  function sa(h,val){ if(cmAc[h]&&cmAc[h]<=ncAc) rowAc[cmAc[h]-1]=val; }
  sa("ID_ACORDO",            idAcordo);
  sa("ID_CONTRATO",          v.idContrato);
  sa("ID_CLIENTE",           idCliente);
  sa("NOME_CLIENTE",         nomeCliente);
  sa("DATA",                 new Date(v.data||new Date()));
  sa("VALOR_DIVIDA_ORIGINAL",totalDivida);
  sa("VALOR_ACORDADO",       valorAcordado);
  sa("DESCONTO_PRINCIPAL",   descontoPrincipal);
  sa("DESCONTO_JUROS",       descontoJuros);
  sa("STATUS",               "QUITADO");
  sa("OBSERVACOES",          v.observacao||"");
  var ulAc = abaAc.getLastRow() + 1;
  abaAc.getRange(ulAc,1,1,ncAc).setValues([rowAc]);
  if(cmAc["DATA"])                  abaAc.getRange(ulAc,cmAc["DATA"]).setNumberFormat("dd/mm/yyyy");
  if(cmAc["VALOR_DIVIDA_ORIGINAL"]) abaAc.getRange(ulAc,cmAc["VALOR_DIVIDA_ORIGINAL"]).setNumberFormat("R$ #,##0.00");
  if(cmAc["VALOR_ACORDADO"])        abaAc.getRange(ulAc,cmAc["VALOR_ACORDADO"]).setNumberFormat("R$ #,##0.00");
  if(cmAc["DESCONTO_PRINCIPAL"])    abaAc.getRange(ulAc,cmAc["DESCONTO_PRINCIPAL"]).setNumberFormat("R$ #,##0.00");
  if(cmAc["DESCONTO_JUROS"])        abaAc.getRange(ulAc,cmAc["DESCONTO_JUROS"]).setNumberFormat("R$ #,##0.00");

  var idPag = proximoIdSeq(abaPag,"PAG");
  var ncPag = abaPag.getLastColumn();
  var rPag  = new Array(ncPag).fill("");
  function sp(h,val){ if(cmPag[h]&&cmPag[h]<=ncPag) rPag[cmPag[h]-1]=val; }
  sp("ID_PAGAMENTO",   idPag);        sp("ID_CONTRATO",   v.idContrato);
  sp("ID_CLIENTE",     idCliente);    sp("NOME_CLIENTE",  nomeCliente);
  sp("DATA_PAGAMENTO", new Date(v.data||new Date())); sp("VALOR_PAGO", valorAcordado);
  sp("TIPO_PAGAMENTO", "acordo_com_perda"); sp("FORMA_PAGAMENTO", v.forma||"pix");
  sp("OBSERVACOES",    "Acordo com perda. Desconto principal: R$ "+descontoPrincipal.toFixed(2)+". Juros cancelados: R$ "+descontoJuros.toFixed(2));
  var ulPag = abaPag.getLastRow()+1;
  abaPag.getRange(ulPag,1,1,ncPag).setValues([rPag]);
  if(cmPag["DATA_PAGAMENTO"]) abaPag.getRange(ulPag,cmPag["DATA_PAGAMENTO"]).setNumberFormat("dd/mm/yyyy");
  if(cmPag["VALOR_PAGO"])     abaPag.getRange(ulPag,cmPag["VALOR_PAGO"]).setNumberFormat("R$ #,##0.00");

  registrarEvento({
    idContrato: v.idContrato, idCliente: idCliente, nomeCliente: nomeCliente,
    tipoEvento: "ACORDO_COM_PERDA",
    valorPrincipal: principalRecuperado, valorJuros: jurosRecuperado, valorTotal: valorAcordado,
    statusAnterior: statusAnterior, statusNovo: "renegociado",
    observacoes: "Acordo: R$ "+valorAcordado.toFixed(2)+" de R$ "+totalDivida.toFixed(2)+
                 ". Prejuizo capital: R$ "+descontoPrincipal.toFixed(2)+
                 ". Juros cancelados: R$ "+descontoJuros.toFixed(2)
  });

  try { calcularScore(idCliente); } catch(eScore) { Logger.log("Score err: "+eScore.message); }
  try { calcularMetricasCliente(idCliente); } catch(eMet) { Logger.log("Metricas err: "+eMet.message); }
  var idUndoAcordo = registrarUndo("ACORDO_COM_PERDA", v.idContrato, idCliente, nomeCliente, {
    idPagamento: idPag, idAcordo: idAcordo,
    idParcelas:  parcelasAbertas.map(function(pa){ return pa.idParcela; }),
    contratoAntes: contratoAntesAcordo
  });
  return { idAcordo: idAcordo, totalDivida: totalDivida, valorAcordado: valorAcordado, descontoPrincipal: descontoPrincipal, descontoJuros: descontoJuros, idUndo: idUndoAcordo };
}

function registrarQuitacaoAntecipada(v) {
  var ss    = SpreadsheetApp.getActiveSpreadsheet();
  var abaC  = ss.getSheetByName(ABAS.CONTRATOS);
  var abaP  = ss.getSheetByName(ABAS.PARCELAS);
  var abaPag = ss.getSheetByName(ABAS.PAGAMENTOS);
  var cm   = buildColMap(abaC);
  var cmP  = buildColMap(abaP);
  var cmPag = buildColMap(abaPag);

  var contratos = abaC.getDataRange().getValues();
  var linhaC = -1; var rowC = null;
  for (var i = 1; i < contratos.length; i++) {
    if (String(contratos[i][(cm["ID_CONTRATO"]||1)-1]).trim() === String(v.idContrato).trim()) {
      linhaC = i + 1; rowC = contratos[i]; break;
    }
  }
  if (linhaC === -1) throw new Error("Contrato nao encontrado: " + v.idContrato);

  var idCliente      = String(rowC[(cm["ID_CLIENTE"]   ||2)-1]);
  var nomeCliente    = String(rowC[(cm["NOME_CLIENTE"] ||3)-1]);
  var statusAnterior = String(rowC[(cm["STATUS_CONTRATO"]||16)-1]||"");

  var idsSelecionados = (v.parcelasSelecionadas || []).map(function(x){ return String(x).trim(); });
  if (idsSelecionados.length === 0) throw new Error("Nenhuma parcela selecionada.");

  var descontoTotal = parseFloat(v.descontoJuros) || 0;
  var dtPag = v.data ? parseDateLocal(v.data) : new Date();
  var forma = v.forma || "pix";
  var dPag  = new Date(dtPag.getFullYear(), dtPag.getMonth(), dtPag.getDate());

  var dadosP = abaP.getDataRange().getValues();
  var stColP = cmP["STATUS"] || cmP["STATUS_PAGAMENTO"];
  var selecionadas = [];
  var skipTerminal = 0;
  for (var j = 1; j < dadosP.length; j++) {
    var idP = String(dadosP[j][0]).trim();
    if (idsSelecionados.indexOf(idP) < 0) continue;
    var stCheck = String(stColP ? dadosP[j][stColP-1] : "").toLowerCase().trim();
    if (STATUS_TERMINAL[stCheck]) { skipTerminal++; continue; }
    selecionadas.push({
      linha:          j + 1,
      idParcela:      idP,
      num:            dadosP[j][(cmP["NUM_PARCELA"]    ||5)-1],
      total:          dadosP[j][(cmP["TOTAL_PARCELAS"] ||6)-1],
      principal:      parseFloat(dadosP[j][(cmP["VALOR_PRINCIPAL"]||9)-1])  || 0,
      juros:          parseFloat(dadosP[j][(cmP["VALOR_JUROS"]    ||10)-1]) || 0,
      valor:          parseFloat(dadosP[j][(cmP["VALOR_PARCELA"]  ||8)-1])  || 0,
      dataVencimento: dadosP[j][(cmP["DATA_VENCIMENTO"]||7)-1]
    });
  }
  if (selecionadas.length === 0) {
    if (skipTerminal > 0) {
      Logger.log("registrarQuitacaoAntecipada: todas as parcelas ja terminais — operacao idempotente.");
      return { parcelasQuitadas: 0, totalRecebido: 0, descontoJuros: 0, contratoQuitado: false, idUndo: null };
    }
    throw new Error("Parcelas nao encontradas nas planilhas.");
  }

  var totalJurosSelecionados     = selecionadas.reduce(function(s,p){return s+p.juros;},0);
  var totalPrincipalSelecionados = selecionadas.reduce(function(s,p){return s+p.principal;},0);
  descontoTotal = Math.min(descontoTotal, totalJurosSelecionados);
  var totalRecebido = totalPrincipalSelecionados + totalJurosSelecionados - descontoTotal;

  var ncPag = abaPag.getLastColumn();
  var undoParcQuit = [];

  for (var k = 0; k < selecionadas.length; k++) {
    var pa = selecionadas[k];
    var pct = totalJurosSelecionados > 0 ? pa.juros / totalJurosSelecionados : 1 / selecionadas.length;
    var descontoParcela = descontoTotal * pct;
    var valorRecebido   = pa.principal + pa.juros - descontoParcela;

    // FIX 1: calcular dias de atraso / antecipação por parcela
    var dtVenc = pa.dataVencimento instanceof Date ? pa.dataVencimento : new Date(pa.dataVencimento);
    var dVenc  = new Date(dtVenc.getFullYear(), dtVenc.getMonth(), dtVenc.getDate());
    var diffDias = Math.round((dPag.getTime() - dVenc.getTime()) / 86400000);
    var diasAtraso      = diffDias > 0 ? diffDias : 0;
    var diasAntecipacao = diffDias < 0 ? Math.abs(diffDias) : 0;

    // Atualizar PARCELAS
    if (stColP) abaP.getRange(pa.linha, stColP).setValue("quitacao_antecipada");
    setCel(abaP, pa.linha, cmP, "DATA_PAGAMENTO",   dtPag,           "dd/mm/yyyy");
    setCel(abaP, pa.linha, cmP, "VALOR_PAGO",        valorRecebido,   "R$ #,##0.00");
    setCel(abaP, pa.linha, cmP, "VALOR_RECEBIDO",    valorRecebido,   "R$ #,##0.00");
    setCel(abaP, pa.linha, cmP, "DESCONTO_APLICADO", descontoParcela, "R$ #,##0.00");
    setCel(abaP, pa.linha, cmP, "DIFERENCA_PAGA",    0,               "R$ #,##0.00");
    setCel(abaP, pa.linha, cmP, "TIPO_PAGAMENTO",    "quitacao_antecipada");
    setCel(abaP, pa.linha, cmP, "DIAS_ATRASO",       diasAtraso);
    setCel(abaP, pa.linha, cmP, "DIAS_ANTECIPACAO",  diasAntecipacao);
    if (cmP["OBSERVACOES"]) abaP.getRange(pa.linha, cmP["OBSERVACOES"]).setValue("Quitação antecipada. Desconto juros: R$ " + descontoParcela.toFixed(2));

    // FIX 2 & 3: um registro em PAGAMENTOS por parcela (com todos os campos)
    var idPag = proximoIdSeq(abaPag, "PAG");
    var rPag  = new Array(ncPag).fill("");
    if (cmPag["ID_PAGAMENTO"]           && cmPag["ID_PAGAMENTO"]           <= ncPag) rPag[cmPag["ID_PAGAMENTO"]-1]           = idPag;
    if (cmPag["ID_PARCELA"]             && cmPag["ID_PARCELA"]             <= ncPag) rPag[cmPag["ID_PARCELA"]-1]             = pa.idParcela;
    if (cmPag["ID_CONTRATO"]            && cmPag["ID_CONTRATO"]            <= ncPag) rPag[cmPag["ID_CONTRATO"]-1]            = v.idContrato;
    if (cmPag["ID_CLIENTE"]             && cmPag["ID_CLIENTE"]             <= ncPag) rPag[cmPag["ID_CLIENTE"]-1]             = idCliente;
    if (cmPag["NOME_CLIENTE"]           && cmPag["NOME_CLIENTE"]           <= ncPag) rPag[cmPag["NOME_CLIENTE"]-1]           = nomeCliente;
    if (cmPag["DATA_PAGAMENTO"]         && cmPag["DATA_PAGAMENTO"]         <= ncPag) rPag[cmPag["DATA_PAGAMENTO"]-1]         = dtPag;
    if (cmPag["VALOR_ORIGINAL_PARCELA"] && cmPag["VALOR_ORIGINAL_PARCELA"] <= ncPag) rPag[cmPag["VALOR_ORIGINAL_PARCELA"]-1] = pa.valor;
    if (cmPag["VALOR_PAGO"]             && cmPag["VALOR_PAGO"]             <= ncPag) rPag[cmPag["VALOR_PAGO"]-1]             = valorRecebido;
    if (cmPag["DIFERENCA_RECEBIDA"]     && cmPag["DIFERENCA_RECEBIDA"]     <= ncPag) rPag[cmPag["DIFERENCA_RECEBIDA"]-1]     = 0;
    if (cmPag["RECEITA_EXTRA_ATRASO"]   && cmPag["RECEITA_EXTRA_ATRASO"]   <= ncPag) rPag[cmPag["RECEITA_EXTRA_ATRASO"]-1]   = 0;
    if (cmPag["TIPO_PAGAMENTO"]         && cmPag["TIPO_PAGAMENTO"]         <= ncPag) rPag[cmPag["TIPO_PAGAMENTO"]-1]         = "quitacao_antecipada";
    if (cmPag["FORMA_PAGAMENTO"]        && cmPag["FORMA_PAGAMENTO"]        <= ncPag) rPag[cmPag["FORMA_PAGAMENTO"]-1]        = forma;
    if (cmPag["OBSERVACOES"]            && cmPag["OBSERVACOES"]            <= ncPag) rPag[cmPag["OBSERVACOES"]-1]            = "Parcela " + pa.num + "/" + pa.total + ". Quitacao antecipada. Desconto juros: R$ " + descontoParcela.toFixed(2) + (v.observacao ? ". " + v.observacao : "");
    var ulPag = abaPag.getLastRow() + 1;
    abaPag.getRange(ulPag, 1, 1, ncPag).setValues([rPag]);
    if (cmPag["DATA_PAGAMENTO"])         abaPag.getRange(ulPag, cmPag["DATA_PAGAMENTO"]).setNumberFormat("dd/mm/yyyy");
    if (cmPag["VALOR_PAGO"])             abaPag.getRange(ulPag, cmPag["VALOR_PAGO"]).setNumberFormat("R$ #,##0.00");
    if (cmPag["VALOR_ORIGINAL_PARCELA"]) abaPag.getRange(ulPag, cmPag["VALOR_ORIGINAL_PARCELA"]).setNumberFormat("R$ #,##0.00");
    if (cmPag["DIFERENCA_RECEBIDA"])     abaPag.getRange(ulPag, cmPag["DIFERENCA_RECEBIDA"]).setNumberFormat("R$ #,##0.00");
    if (cmPag["RECEITA_EXTRA_ATRASO"])   abaPag.getRange(ulPag, cmPag["RECEITA_EXTRA_ATRASO"]).setNumberFormat("R$ #,##0.00");
    undoParcQuit.push({ idPagamento: idPag, numParcela: String(pa.num) });
  }

  dadosP = abaP.getDataRange().getValues();
  var stAberto = ["pendente","atrasado","vence_hoje","reagendado"];
  var todasPagas = true;
  for (var m = 1; m < dadosP.length; m++) {
    if (String(dadosP[m][(cmP["ID_CONTRATO"]||2)-1]).trim() !== String(v.idContrato).trim()) continue;
    var stP = String(stColP ? dadosP[m][stColP-1] : "").toLowerCase().trim();
    if (stAberto.indexOf(stP) >= 0) { todasPagas = false; break; }
  }

  var novoStatusContrato = todasPagas ? "quitado" : statusAnterior;
  if (todasPagas) {
    setCel(abaC, linhaC, cm, "STATUS_CONTRATO", "quitado");
    setCel(abaC, linhaC, cm, "STATUS_CARTEIRA", "quitada");
    try { _gerarEEnviarCertificado(v.idContrato, idCliente, nomeCliente, dtPag); } catch(eCert) { Logger.log("CertificadoQuitacao err: "+eCert.message); }
  }

  registrarEvento({
    idContrato: v.idContrato, idCliente: idCliente, nomeCliente: nomeCliente,
    tipoEvento: "QUITACAO_ANTECIPADA",
    valorPrincipal: totalPrincipalSelecionados,
    valorJuros:     totalJurosSelecionados - descontoTotal,
    valorTotal:     totalRecebido,
    statusAnterior: statusAnterior, statusNovo: novoStatusContrato,
    observacoes: selecionadas.length + " parcela(s). Recebido: R$ " + totalRecebido.toFixed(2) +
                 ". Desconto juros: R$ " + descontoTotal.toFixed(2) +
                 (todasPagas ? ". Contrato QUITADO." : "")
  });

  try { calcularScore(idCliente); } catch(eScore) { Logger.log("Score err: "+eScore.message); }
  try { calcularMetricasCliente(idCliente); } catch(eMet) { Logger.log("Metricas err: "+eMet.message); }
  var idUndoQuit = registrarUndo("QUITACAO_ANTECIPADA", v.idContrato, idCliente, nomeCliente, {
    parcelas: undoParcQuit,
    statusContratoAnterior: statusAnterior,
    statusCarteiraAnterior: "ativa",
    contratoFoiQuitado: todasPagas,
    idCliente: idCliente
  });
  return { parcelasQuitadas: selecionadas.length, totalRecebido: totalRecebido, descontoJuros: descontoTotal, contratoQuitado: todasPagas, idUndo: idUndoQuit };
}

function renegociarContrato(dados) {
  var ss    = SpreadsheetApp.getActiveSpreadsheet();
  var abaC  = ss.getSheetByName(ABAS.CONTRATOS);
  var abaP  = ss.getSheetByName(ABAS.PARCELAS);
  var cm    = buildColMap(abaC);
  var cmP   = buildColMap(abaP);

  // Localizar contrato
  var rowsC = abaC.getDataRange().getValues();
  var linhaC = -1, rowC = null;
  for (var i = 1; i < rowsC.length; i++) {
    if (String(rowsC[i][(cm["ID_CONTRATO"]||1)-1]).trim() === String(dados.idContrato).trim()) {
      linhaC = i + 1; rowC = rowsC[i]; break;
    }
  }
  if (linhaC === -1) throw new Error("Contrato nao encontrado: " + dados.idContrato);

  var idCliente   = String(rowC[(cm["ID_CLIENTE"]   ||2)-1]);
  var nomeCliente = String(rowC[(cm["NOME_CLIENTE"] ||3)-1]);
  var statusAtual = String(rowC[(cm["STATUS_CONTRATO"]||16)-1]||"").toLowerCase().trim();

  // Validar status elegivel
  var statusElegiveis = ["ativo","ativo_em_dia","ativo_em_atraso","em_cobranca","pre_prejuizo","acordo_assistido"];
  if (statusElegiveis.indexOf(statusAtual) < 0) {
    throw new Error("Contrato nao elegivel para renegociacao. Status atual: " + statusAtual);
  }

  // Ler parcelas e checar renegociacao previa
  var dadosP    = abaP.getDataRange().getValues();
  var stCol     = cmP["STATUS"] || cmP["STATUS_PAGAMENTO"];
  var colOrigem = cmP["ORIGEM_PARCELA"];
  var parcAbertas = [];

  for (var j = 1; j < dadosP.length; j++) {
    if (String(dadosP[j][(cmP["ID_CONTRATO"]||2)-1]).trim() !== String(dados.idContrato).trim()) continue;
    if (colOrigem && String(dadosP[j][colOrigem-1]||"").toLowerCase().trim() === "renegociada") {
      throw new Error("Contrato ja foi renegociado anteriormente (maximo 1 por contrato).");
    }
    var stP = stCol ? String(dadosP[j][stCol-1]).toLowerCase().trim() : "";
    if (!STATUS_TERMINAL[stP]) {
      parcAbertas.push({
        linha:     j + 1,
        idParcela: String(dadosP[j][0]).trim(),
        num:       parseInt(dadosP[j][(cmP["NUM_PARCELA"]   ||5)-1]) || 0,
        principal: parseFloat(dadosP[j][(cmP["VALOR_PRINCIPAL"]||9)-1]) || 0,
        juros:     parseFloat(dadosP[j][(cmP["VALOR_JUROS"]  ||10)-1]) || 0
      });
    }
  }
  if (parcAbertas.length === 0) throw new Error("Nenhuma parcela em aberto para renegociar.");

  // Calcular totais
  var capitalFaltante = parcAbertas.reduce(function(s,p){ return s + p.principal; }, 0);
  var jurosEmAberto   = parcAbertas.reduce(function(s,p){ return s + p.juros;    }, 0);
  var colAbat = cm["VALOR_ABATIDO_ASSISTIDO"];
  if (colAbat) {
    capitalFaltante = Math.max(0, capitalFaltante - (parseFloat(rowC[colAbat-1]||0)||0));
  }

  // Validar parametros recebidos
  var novaValorParcela = parseFloat(dados.novaValorParcela) || 0;
  var novasParcelasQtd = parseInt(dados.novasParcelasQtd)   || 0;
  var novoVencimento   = String(dados.novoVencimento || "");
  var observacao       = String(dados.observacao     || "");
  var descontoJuros    = parseFloat(dados.descontoJuros) || 0;
  var dataReneg        = dados.dataRenegociacao ? parseDateLocal(dados.dataRenegociacao) : new Date();

  if (novaValorParcela <= 0) throw new Error("Valor da parcela invalido.");
  if (novasParcelasQtd <= 0) throw new Error("Quantidade de parcelas invalida.");
  if (!novoVencimento)       throw new Error("Primeiro vencimento nao informado.");

  var totalRenegociado = novaValorParcela * novasParcelasQtd;
  if (totalRenegociado < capitalFaltante - 0.01) {
    throw new Error(
      "Total renegociado (R$ " + totalRenegociado.toFixed(2) + ") nao cobre o capital faltante " +
      "(R$ " + capitalFaltante.toFixed(2) + "). Recomenda-se ajuizamento."
    );
  }
  // Teto duplo do desconto: nunca desconta principal
  var descontoMax = Math.min(jurosEmAberto, Math.max(0, totalRenegociado - capitalFaltante));
  descontoJuros   = Math.min(Math.max(0, descontoJuros), descontoMax);

  var dtRenegStr = Utilities.formatDate(dataReneg, "America/Sao_Paulo", "dd/MM/yyyy");

  // 1. Fechar parcelas abertas como "renegociado"
  for (var k = 0; k < parcAbertas.length; k++) {
    var pa = parcAbertas[k];
    if (stCol) abaP.getRange(pa.linha, stCol).setValue("renegociado");
    setCel(abaP, pa.linha, cmP, "OBSERVACOES",
      "Renegociado em " + dtRenegStr + (observacao ? ". " + observacao : ""));
  }

  // 2. Descobrir max NUM_PARCELA e proximo ID (continua sequencia existente)
  var dadosP2 = abaP.getDataRange().getValues();
  var maxNum = 0, ultimoIdNum = 1;
  for (var m = 1; m < dadosP2.length; m++) {
    if (String(dadosP2[m][(cmP["ID_CONTRATO"]||2)-1]).trim() === String(dados.idContrato).trim()) {
      var numP = parseInt(dadosP2[m][(cmP["NUM_PARCELA"]||5)-1]) || 0;
      if (numP > maxNum) maxNum = numP;
    }
    var idNum = parseInt(String(dadosP2[m][0]).replace(/\D/g,"")) || 0;
    if (idNum >= ultimoIdNum) ultimoIdNum = idNum + 1;
  }

  // 3. Split principal/juros por parcela nova
  var novoPrincipalParcela = capitalFaltante / novasParcelasQtd;
  var novoJurosParcela     = Math.max(0, (totalRenegociado - capitalFaltante) / novasParcelasQtd);

  // 4. Criar novas parcelas com numeracao sequencial (evita colisao de TXID Efi)
  var nc      = abaP.getLastColumn();
  var stNmKey = cmP["STATUS"] ? "STATUS" : "STATUS_PAGAMENTO";
  var dtBase  = parseDateLocal(novoVencimento);
  var novasParcelas   = [];
  var parcelasRetorno = [];

  for (var n = 0; n < novasParcelasQtd; n++) {
    var dtV = new Date(dtBase.getFullYear(), dtBase.getMonth() + n, dtBase.getDate(), 12, 0, 0);
    var row = new Array(nc).fill("");
    function sr(h, vl) { if (cmP[h] && cmP[h] <= nc) row[cmP[h]-1] = vl; }
    var idParcelaNew  = String(ultimoIdNum + n).padStart(5, "0");
    var numParcelaNew = maxNum + n + 1;
    sr("ID_PARCELA",      idParcelaNew);
    sr("ID_CONTRATO",     dados.idContrato);
    sr("ID_CLIENTE",      idCliente);
    sr("NOME_CLIENTE",    nomeCliente);
    sr("NUM_PARCELA",     numParcelaNew);
    sr("TOTAL_PARCELAS",  novasParcelasQtd);
    sr("DATA_VENCIMENTO", dtV);
    sr("VALOR_PARCELA",   novaValorParcela);
    sr("VALOR_PRINCIPAL", novoPrincipalParcela);
    sr("VALOR_JUROS",     novoJurosParcela);
    sr(stNmKey,           "pendente");
    sr("ORIGEM_PARCELA",  "renegociada");
    sr("DIFERENCA_PAGA",  0);
    sr("OBSERVACOES",     "Parcela " + (n+1) + "/" + novasParcelasQtd + " renegociada em " + dtRenegStr + (observacao ? ". " + observacao : ""));
    novasParcelas.push(row);
    parcelasRetorno.push({
      idParcela:      idParcelaNew,
      numParcela:     numParcelaNew,
      valorParcela:   novaValorParcela,
      dataVencimento: Utilities.formatDate(dtV, "America/Sao_Paulo", "yyyy-MM-dd")
    });
  }

  if (novasParcelas.length > 0) {
    var ulP = abaP.getLastRow() + 1;
    abaP.getRange(ulP, 1, novasParcelas.length, nc).setValues(novasParcelas);
    if (cmP["DATA_VENCIMENTO"]) abaP.getRange(ulP, cmP["DATA_VENCIMENTO"], novasParcelas.length, 1).setNumberFormat("dd/mm/yyyy");
    if (cmP["VALOR_PARCELA"])   abaP.getRange(ulP, cmP["VALOR_PARCELA"],   novasParcelas.length, 1).setNumberFormat("R$ #,##0.00");
    if (cmP["VALOR_PRINCIPAL"]) abaP.getRange(ulP, cmP["VALOR_PRINCIPAL"], novasParcelas.length, 1).setNumberFormat("R$ #,##0.00");
    if (cmP["VALOR_JUROS"])     abaP.getRange(ulP, cmP["VALOR_JUROS"],     novasParcelas.length, 1).setNumberFormat("R$ #,##0.00");
    if (cmP["DIFERENCA_PAGA"])  abaP.getRange(ulP, cmP["DIFERENCA_PAGA"],  novasParcelas.length, 1).setNumberFormat("R$ #,##0.00");
  }

  // 5. Atualizar contrato
  setCel(abaC, linhaC, cm, "STATUS_CONTRATO",   "ativo_em_dia");
  setCel(abaC, linhaC, cm, "DATA_RENEGOCIACAO", dataReneg, "dd/mm/yyyy");

  // 6. Registrar evento
  registrarEvento({
    idContrato: dados.idContrato, idCliente: idCliente, nomeCliente: nomeCliente,
    tipoEvento: "RENEGOCIACAO_ESTRUTURAL",
    valorPrincipal: capitalFaltante,
    valorJuros:     totalRenegociado - capitalFaltante,
    valorTotal:     totalRenegociado,
    statusAnterior: statusAtual, statusNovo: "ativo_em_dia",
    observacoes:
      parcAbertas.length + " parcela(s) encerradas. " +
      novasParcelasQtd + " novas de R$" + novaValorParcela.toFixed(2) + "/mes. " +
      "Capital: R$" + capitalFaltante.toFixed(2) + " | Total: R$" + totalRenegociado.toFixed(2) + "." +
      (descontoJuros > 0.01 ? " Desc.juros: R$" + descontoJuros.toFixed(2) + "." : "") +
      (observacao ? " " + observacao : "")
  });

  try { calcularScore(idCliente); }           catch(eS){ Logger.log("renegociar score: "+eS.message); }
  try { calcularMetricasCliente(idCliente); } catch(eM){ Logger.log("renegociar metricas: "+eM.message); }

  return {
    parcelas:           parcelasRetorno,
    idContrato:         dados.idContrato,
    idCliente:          idCliente,
    capitalFaltante:    capitalFaltante,
    totalRenegociado:   totalRenegociado,
    descontoJuros:      descontoJuros,
    parcelasEncerradas: parcAbertas.length
  };
}

function baixarContratoPrejuizo(idContrato, dados) {
  var ss   = SpreadsheetApp.getActiveSpreadsheet();
  var abaC = ss.getSheetByName(ABAS.CONTRATOS);
  var cm   = buildColMap(abaC);
  var rows = abaC.getDataRange().getValues();
  var linha = -1; var row = null;
  for (var i = 1; i < rows.length; i++) {
    if (String(rows[i][(cm["ID_CONTRATO"]||1)-1]).trim() === String(idContrato).trim()) {
      linha = i + 1; row = rows[i]; break;
    }
  }
  if (linha === -1) throw new Error("Contrato nao encontrado: " + idContrato);
  var statusAnterior         = String(row[(cm["STATUS_CONTRATO"]             ||16)-1]||"");
  var statusCarteiraAnterior = String(row[(cm["STATUS_CARTEIRA"]             ||0)-1] ||"");
  var prejCapAnterior        = String(row[(cm["PREJUIZO_CAPITAL"]            ||0)-1] ||"");
  var jurosNRAnterior        = String(row[(cm["JUROS_NAO_REALIZADOS"]        ||0)-1] ||"");
  var bloqAnterior           = String(row[(cm["BLOQUEADO_PARA_NOVO_CREDITO"] ||0)-1] ||"");
  var motBloqAnterior        = String(row[(cm["MOTIVO_BLOQUEIO_CREDITO"]     ||0)-1] ||"");
  var dtBaixaAnterior        = String(row[(cm["DATA_BAIXA_PREJUIZO"]         ||0)-1] ||"");
  var motBaixaAnterior       = String(row[(cm["MOTIVO_BAIXA_PREJUIZO"]       ||0)-1] ||"");
  var obsBaixaAnterior       = String(row[(cm["OBSERVACAO_BAIXA"]            ||0)-1] ||"");
  var valRecupAnterior       = String(row[(cm["VALOR_RECUPERADO_APOS_BAIXA"] ||0)-1] ||"");
  var statusClienteAnterior  = "ativo";
  try {
    var abaCli = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(ABAS.CLIENTES);
    if (abaCli) {
      var cmCli = buildColMap(abaCli);
      var dadosCli = abaCli.getDataRange().getValues();
      var idCli_ = String(row[(cm["ID_CLIENTE"]||2)-1]).trim();
      for (var ci=1; ci<dadosCli.length; ci++) {
        if (String(dadosCli[ci][(cmCli["ID_CLIENTE"]||1)-1]).trim() === idCli_) {
          statusClienteAnterior = String(dadosCli[ci][(cmCli["STATUS_CLIENTE"]||0)-1]||"ativo"); break;
        }
      }
    }
  } catch(eCli_) {}
  var prejuizoCapital    = parseFloat(dados.prejudizoCapital) || 0;
  var jurosNaoRealizados = parseFloat(dados.jurosNaoRealizadosCalc) || 0;
  if (!prejuizoCapital) {
    var valPrincipal  = parseFloat(row[(cm["VALOR_PRINCIPAL"]||6)-1]) || 0;
    var valTotal      = parseFloat(row[(cm["VALOR_TOTAL"]    ||11)-1]) || 0;
    var valRecuperado = parseFloat(dados.valorRecuperadoAntesBaixa || 0);
    prejuizoCapital    = Math.max(0, valPrincipal - valRecuperado);
    jurosNaoRealizados = Math.max(0, valTotal - valPrincipal - (parseFloat(dados.jurosJaRecebidos)||0));
  }
  var obsBase = dados.baixaParcial
    ? "Baixa PARCIAL — " + (dados.parcelasABaixar ? dados.parcelasABaixar.length : "?") + " parcela(s) nao paga(s). Demais foram quitadas. "
    : "";
  setCel(abaC, linha, cm, "STATUS_CONTRATO",           "baixado_como_prejuizo");
  setCel(abaC, linha, cm, "STATUS_CARTEIRA",            "baixada");
  setCel(abaC, linha, cm, "SUBSTATUS_PREJUIZO",         dados.substatus                || "");
  setCel(abaC, linha, cm, "DATA_BAIXA_PREJUIZO",        new Date(dados.data||new Date()), "dd/mm/yyyy");
  setCel(abaC, linha, cm, "MOTIVO_BAIXA_PREJUIZO",      dados.motivo                   || "");
  setCel(abaC, linha, cm, "POSSIBILIDADE_RECUPERACAO",  dados.possibilidadeRecuperacao || "BAIXA");
  setCel(abaC, linha, cm, "PREJUIZO_CAPITAL",           prejuizoCapital,    "R$ #,##0.00");
  setCel(abaC, linha, cm, "JUROS_NAO_REALIZADOS",       jurosNaoRealizados, "R$ #,##0.00");
  setCel(abaC, linha, cm, "DIAS_ATRASO_NA_BAIXA",       parseInt(dados.diasAtraso)||0);
  setCel(abaC, linha, cm, "BLOQUEADO_PARA_NOVO_CREDITO","SIM");
  setCel(abaC, linha, cm, "MOTIVO_BLOQUEIO_CREDITO",    "contrato_baixado_como_prejuizo");
  setCel(abaC, linha, cm, "STATUS_JURIDICO",             dados.statusJuridico           || "NAO_ANALISADO");
  setCel(abaC, linha, cm, "PROXIMA_PROVIDENCIA",         dados.proximaProvidencia       || "");
  setCel(abaC, linha, cm, "OBSERVACAO_BAIXA",            obsBase + (dados.observacao    || ""));
  setCel(abaC, linha, cm, "VALOR_RECUPERADO_APOS_BAIXA", 0, "R$ #,##0.00");
  if (dados.parcelasABaixar && dados.parcelasABaixar.length > 0) {
    var abaP   = ss.getSheetByName(ABAS.PARCELAS);
    var cmP    = buildColMap(abaP);
    var dadosP = abaP.getDataRange().getValues();
    var stColP = cmP["STATUS"] || cmP["STATUS_PAGAMENTO"];
    var dataStr = new Date().toLocaleDateString("pt-BR");
    if (stColP) {
      for (var j = 1; j < dadosP.length; j++) {
        var idParcela = String(dadosP[j][0]).trim();
        if (dados.parcelasABaixar.indexOf(idParcela) >= 0) {
          abaP.getRange(j+1, stColP).setValue("baixado_como_prejuizo");
          if (cmP["OBSERVACOES"]) abaP.getRange(j+1, cmP["OBSERVACOES"]).setValue("Baixada como prejuizo em " + dataStr + ". Motivo: " + (dados.motivo||""));
        }
      }
    }
  }
  registrarEvento({
    idContrato: idContrato, idCliente: String(row[(cm["ID_CLIENTE"]   ||2)-1]),
    nomeCliente: String(row[(cm["NOME_CLIENTE"] ||3)-1]),
    tipoEvento: "BAIXA_COMO_PREJUIZO",
    valorPrincipal: prejuizoCapital, valorJuros: jurosNaoRealizados,
    valorTotal: prejuizoCapital + jurosNaoRealizados,
    statusAnterior: statusAnterior, statusNovo: "baixado_como_prejuizo",
    observacoes: obsBase + (dados.observacao || ("Baixa como prejuizo. Motivo: " + (dados.motivo||"")))
  });
  var idCli = String(row[(cm["ID_CLIENTE"]||2)-1]);
  atualizarCampoCliente(idCli, "STATUS_CLIENTE", "bloqueado");
  try { calcularScore(idCli); } catch(eScore) { Logger.log("Score err: "+eScore.message); }
  try { calcularMetricasCliente(idCli); } catch(eMet) { Logger.log("Metricas err: "+eMet.message); }
  var idUndoBaixa = registrarUndo("BAIXA_PREJUIZO", idContrato, idCli, String(row[(cm["NOME_CLIENTE"]||3)-1]), {
    idParcelas: dados.parcelasABaixar || [],
    statusClienteAnterior: statusClienteAnterior,
    contratoAntes: {
      STATUS_CONTRATO:             statusAnterior,
      STATUS_CARTEIRA:             statusCarteiraAnterior,
      PREJUIZO_CAPITAL:            prejCapAnterior,
      JUROS_NAO_REALIZADOS:        jurosNRAnterior,
      BLOQUEADO_PARA_NOVO_CREDITO: bloqAnterior,
      MOTIVO_BLOQUEIO_CREDITO:     motBloqAnterior,
      DATA_BAIXA_PREJUIZO:         dtBaixaAnterior,
      MOTIVO_BAIXA_PREJUIZO:       motBaixaAnterior,
      OBSERVACAO_BAIXA:            obsBaixaAnterior,
      VALOR_RECUPERADO_APOS_BAIXA: valRecupAnterior
    }
  });
  return { idUndo: idUndoBaixa };
}

function registrarRecuperacaoAposBaixa(idContrato, dados) {
  var ss   = SpreadsheetApp.getActiveSpreadsheet();
  var abaC = ss.getSheetByName(ABAS.CONTRATOS);
  var cm   = buildColMap(abaC);
  var rows = abaC.getDataRange().getValues();
  var linha = -1; var row = null;
  for (var i = 1; i < rows.length; i++) {
    if (String(rows[i][(cm["ID_CONTRATO"]||1)-1]).trim() === String(idContrato).trim()) {
      linha = i + 1; row = rows[i]; break;
    }
  }
  if (linha === -1) throw new Error("Contrato nao encontrado: " + idContrato);
  var valorPago        = parseFloat(dados.valorPago) || 0;
  var recuperadoAtual  = parseFloat(row[(cm["VALOR_RECUPERADO_APOS_BAIXA"]||0)-1]||0) || 0;
  var prejuizoAtual    = parseFloat(row[(cm["PREJUIZO_CAPITAL"]||0)-1]||0) || 0;
  var novoRecuperado   = recuperadoAtual + valorPago;
  var novoPrejuizo     = Math.max(0, prejuizoAtual - valorPago);
  var novoStatus       = novoPrejuizo <= 0 ? "recuperado_integralmente" : "baixado_como_prejuizo";
  var statusAnterior   = String(row[(cm["STATUS_CONTRATO"]||16)-1]||"");
  setCel(abaC, linha, cm, "VALOR_RECUPERADO_APOS_BAIXA", novoRecuperado, "R$ #,##0.00");
  setCel(abaC, linha, cm, "PREJUIZO_CAPITAL",            novoPrejuizo,   "R$ #,##0.00");
  setCel(abaC, linha, cm, "STATUS_CONTRATO",             novoStatus);
  if (novoPrejuizo <= 0) setCel(abaC, linha, cm, "STATUS_CARTEIRA", "quitada");
  var abaPag = ss.getSheetByName(ABAS.PAGAMENTOS);
  var cmPag  = buildColMap(abaPag);
  var idPag  = proximoIdSeq(abaPag, "PAG");
  var nc     = abaPag.getLastColumn();
  var rPag   = new Array(nc).fill("");
  function sp(h,v){if(cmPag[h]&&cmPag[h]<=nc)rPag[cmPag[h]-1]=v;}
  sp("ID_PAGAMENTO",   idPag);    sp("ID_CONTRATO",   idContrato);
  sp("ID_CLIENTE",     String(row[(cm["ID_CLIENTE"]   ||2)-1]));
  sp("NOME_CLIENTE",   String(row[(cm["NOME_CLIENTE"] ||3)-1]));
  sp("DATA_PAGAMENTO", new Date(dados.data||new Date()));
  sp("VALOR_PAGO",     valorPago); sp("TIPO_PAGAMENTO",  "recuperacao_apos_baixa");
  sp("FORMA_PAGAMENTO",dados.forma||"pix");
  sp("OBSERVACOES",    dados.observacao||"Recuperacao apos baixa como prejuizo");
  var ul = abaPag.getLastRow()+1;
  abaPag.getRange(ul,1,1,nc).setValues([rPag]);
  if(cmPag["DATA_PAGAMENTO"]) abaPag.getRange(ul,cmPag["DATA_PAGAMENTO"]).setNumberFormat("dd/mm/yyyy");
  if(cmPag["VALOR_PAGO"])     abaPag.getRange(ul,cmPag["VALOR_PAGO"]).setNumberFormat("R$ #,##0.00");
  var idCliRecup = String(row[(cm["ID_CLIENTE"]||2)-1]);
  registrarEvento({
    idContrato: idContrato, idCliente: idCliRecup,
    nomeCliente: String(row[(cm["NOME_CLIENTE"] ||3)-1]),
    tipoEvento: "RECUPERACAO_APOS_BAIXA", valorTotal: valorPago,
    statusAnterior: statusAnterior, statusNovo: novoStatus,
    observacoes: "Recuperacao de R$ " + valorPago.toFixed(2) + " apos baixa. Prejuizo restante: R$ " + novoPrejuizo.toFixed(2)
  });
  try { calcularScore(idCliRecup); } catch(eScore) { Logger.log("Score err: "+eScore.message); }
  try { calcularMetricasCliente(idCliRecup); } catch(eMet) { Logger.log("Metricas err: "+eMet.message); }
  var idUndoRecup = registrarUndo("RECUPERACAO_APOS_BAIXA", idContrato, idCliRecup, String(row[(cm["NOME_CLIENTE"]||3)-1]), {
    idPagamento: idPag, valorPago: valorPago,
    recuperadoAnterior: recuperadoAtual, prejuizoAnterior: prejuizoAtual,
    statusAnterior: statusAnterior, idCliente: idCliRecup
  });
  return { idUndo: idUndoRecup };
}

function corrigirStatusRecuperacao() {
  var ss   = SpreadsheetApp.getActiveSpreadsheet();
  var abaC = ss.getSheetByName(ABAS.CONTRATOS);
  var abaP = ss.getSheetByName(ABAS.PARCELAS);
  var cmC  = buildColMap(abaC);
  var cmP  = buildColMap(abaP);
  var rowsC = abaC.getDataRange().getValues();
  var rowsP = abaP.getDataRange().getValues();
  var corrigidos = 0;
  var statusAlvo = ["recuperado_parcialmente","em_recuperacao"];
  for (var i = 1; i < rowsC.length; i++) {
    var stAtual = String(rowsC[i][(cmC["STATUS_CONTRATO"]||16)-1]||"").trim();
    if (!statusAlvo.includes(stAtual)) continue;
    var idC = String(rowsC[i][(cmC["ID_CONTRATO"]||1)-1]).trim();
    var linhaC = i + 1;
    setCel(abaC, linhaC, cmC, "STATUS_CONTRATO", "baixado_como_prejuizo");
    for (var j = 1; j < rowsP.length; j++) {
      var idCP = String(rowsP[j][(cmP["ID_CONTRATO"]||2)-1]).trim();
      if (idCP !== idC) continue;
      var stP = String(rowsP[j][(cmP["STATUS"]||5)-1]||"").trim();
      var stTerminal = ["pago","quitacao_antecipada","baixado_como_prejuizo","cancelado","renegociado"];
      if (stTerminal.includes(stP)) continue;
      var linhaP = j + 1;
      setCel(abaP, linhaP, cmP, "STATUS", "baixado_como_prejuizo");
    }
    registrarEvento({
      idContrato: idC,
      idCliente:  String(rowsC[i][(cmC["ID_CLIENTE"]||2)-1]),
      nomeCliente: String(rowsC[i][(cmC["NOME_CLIENTE"]||3)-1]),
      tipoEvento: "CORRECAO_STATUS",
      statusAnterior: stAtual,
      statusNovo: "baixado_como_prejuizo",
      observacoes: "Correcao automatica: status '" + stAtual + "' revertido para 'baixado_como_prejuizo'. Contratos baixados permanecem baixados independente de recuperacoes parciais."
    });
    Logger.log("Corrigido: " + idC + " (" + stAtual + " -> baixado_como_prejuizo)");
    corrigidos++;
  }
  SpreadsheetApp.getUi().alert("Correcao concluida: " + corrigidos + " contrato(s) corrigido(s).");
  return corrigidos;
}

function moverParaAcordoAssistido(idContrato, dados) {
  var ss   = SpreadsheetApp.getActiveSpreadsheet();
  var abaC = ss.getSheetByName(ABAS.CONTRATOS);
  var cm   = buildColMap(abaC);
  var rows = abaC.getDataRange().getValues();
  var linha = -1; var row = null;
  for (var i = 1; i < rows.length; i++) {
    if (String(rows[i][(cm["ID_CONTRATO"]||1)-1]).trim() === String(idContrato).trim()) {
      linha = i + 1; row = rows[i]; break;
    }
  }
  if (linha === -1) throw new Error("Contrato nao encontrado: " + idContrato);
  var statusAnterior = String(row[(cm["STATUS_CONTRATO"]||16)-1]||"");
  var idCli   = String(row[(cm["ID_CLIENTE"]   ||2)-1]);
  var nomeCli = String(row[(cm["NOME_CLIENTE"] ||3)-1]);
  setCel(abaC, linha, cm, "STATUS_CONTRATO",              "acordo_assistido");
  setCel(abaC, linha, cm, "STATUS_CARTEIRA",              "acordo_assistido");
  setCel(abaC, linha, cm, "DATA_ENTRADA_ACORDO_ASSISTIDO", parseDateLocal(dados.data||new Date().toISOString().split("T")[0]), "dd/mm/yyyy");
  setCel(abaC, linha, cm, "MOTIVO_ACORDO_ASSISTIDO",       dados.motivo     || "");
  setCel(abaC, linha, cm, "OBSERVACAO_ACORDO_ASSISTIDO",   dados.observacao || "");
  setCel(abaC, linha, cm, "VALOR_ABATIDO_ASSISTIDO",       0, "R$ #,##0.00");
  registrarEvento({
    idContrato: idContrato, idCliente: idCli, nomeCliente: nomeCli,
    tipoEvento: "ACORDO_ASSISTIDO_ENTRADA",
    statusAnterior: statusAnterior, statusNovo: "acordo_assistido",
    observacoes: "Entrada em Acordo Assistido. Motivo: " + (dados.motivo||"") + (dados.observacao ? ". " + dados.observacao : "")
  });
}

function registrarAbatimentoAssistido(idContrato, dados) {
  var ss   = SpreadsheetApp.getActiveSpreadsheet();
  var abaC = ss.getSheetByName(ABAS.CONTRATOS);
  var cm   = buildColMap(abaC);
  var rows = abaC.getDataRange().getValues();
  var linha = -1; var row = null;
  for (var i = 1; i < rows.length; i++) {
    if (String(rows[i][(cm["ID_CONTRATO"]||1)-1]).trim() === String(idContrato).trim()) {
      linha = i + 1; row = rows[i]; break;
    }
  }
  if (linha === -1) throw new Error("Contrato nao encontrado: " + idContrato);
  var valorPago    = parseFloat(dados.valorPago) || 0;
  var abatidoAtual = parseFloat(row[(cm["VALOR_ABATIDO_ASSISTIDO"]||0)-1]||0) || 0;
  var novoAbatido  = abatidoAtual + valorPago;
  var idCli   = String(row[(cm["ID_CLIENTE"]   ||2)-1]);
  var nomeCli = String(row[(cm["NOME_CLIENTE"] ||3)-1]);
  setCel(abaC, linha, cm, "VALOR_ABATIDO_ASSISTIDO", novoAbatido, "R$ #,##0.00");
  var abaPag = ss.getSheetByName(ABAS.PAGAMENTOS);
  var cmPag  = buildColMap(abaPag);
  var idPag  = proximoIdSeq(abaPag, "PAG");
  var nc     = abaPag.getLastColumn();
  var rPag   = new Array(nc).fill("");
  function sp(h,v){if(cmPag[h]&&cmPag[h]<=nc)rPag[cmPag[h]-1]=v;}
  sp("ID_PAGAMENTO",   idPag);
  sp("ID_CONTRATO",    idContrato);
  sp("ID_CLIENTE",     idCli);
  sp("NOME_CLIENTE",   nomeCli);
  sp("DATA_PAGAMENTO", parseDateLocal(dados.data||new Date().toISOString().split("T")[0]));
  sp("VALOR_PAGO",     valorPago);
  sp("TIPO_PAGAMENTO", "abatimento_acordo_assistido");
  sp("FORMA_PAGAMENTO",dados.forma||"pix");
  sp("OBSERVACOES",    dados.observacao||"Abatimento em Acordo Assistido");
  var ul = abaPag.getLastRow()+1;
  abaPag.getRange(ul,1,1,nc).setValues([rPag]);
  if(cmPag["DATA_PAGAMENTO"]) abaPag.getRange(ul,cmPag["DATA_PAGAMENTO"]).setNumberFormat("dd/mm/yyyy");
  if(cmPag["VALOR_PAGO"])     abaPag.getRange(ul,cmPag["VALOR_PAGO"]).setNumberFormat("R$ #,##0.00");
  registrarEvento({
    idContrato: idContrato, idCliente: idCli, nomeCliente: nomeCli,
    tipoEvento: "ABATIMENTO_ACORDO_ASSISTIDO", valorTotal: valorPago,
    observacoes: "Abatimento de R$ " + valorPago.toFixed(2) + " em Acordo Assistido. Total abatido: R$ " + novoAbatido.toFixed(2)
  });
  var idUndoAbat = registrarUndo("ABATIMENTO_ASSISTIDO", idContrato, idCli, nomeCli, {
    idPagamento: idPag, valorPago: valorPago, valorAbatidoAnterior: abatidoAtual
  });
  return { idUndo: idUndoAbat };
}

function sairDoAcordoAssistido(idContrato, destino) {
  var ss   = SpreadsheetApp.getActiveSpreadsheet();
  var abaC = ss.getSheetByName(ABAS.CONTRATOS);
  var abaP = ss.getSheetByName(ABAS.PARCELAS);
  var cm   = buildColMap(abaC);
  var cmP  = buildColMap(abaP);
  var rows = abaC.getDataRange().getValues();
  var linha = -1; var row = null;
  for (var i = 1; i < rows.length; i++) {
    if (String(rows[i][(cm["ID_CONTRATO"]||1)-1]).trim() === String(idContrato).trim()) {
      linha = i + 1; row = rows[i]; break;
    }
  }
  if (linha === -1) throw new Error("Contrato nao encontrado: " + idContrato);
  var idCli   = String(row[(cm["ID_CLIENTE"]   ||2)-1]);
  var nomeCli = String(row[(cm["NOME_CLIENTE"] ||3)-1]);
  if (destino === "baixa") {
    registrarEvento({
      idContrato: idContrato, idCliente: idCli, nomeCliente: nomeCli,
      tipoEvento: "ACORDO_ASSISTIDO_ENCAMINHADO_BAIXA",
      statusAnterior: "acordo_assistido", statusNovo: "acordo_assistido",
      observacoes: "Contrato encaminhado para baixa a partir do Acordo Assistido."
    });
    return;
  }
  var dadosP   = abaP.getDataRange().getValues();
  var dias     = maxDiasAtraso(idContrato, dadosP, cmP);
  var novoStatus = statusPorDias(dias);
  var novoCart   = STATUS_BLOQUEIO.indexOf(novoStatus) >= 0 ? "baixada" : "ativa";
  setCel(abaC, linha, cm, "STATUS_CONTRATO",              novoStatus);
  setCel(abaC, linha, cm, "STATUS_CARTEIRA",              novoCart);
  setCel(abaC, linha, cm, "DATA_ENTRADA_ACORDO_ASSISTIDO", "");
  setCel(abaC, linha, cm, "MOTIVO_ACORDO_ASSISTIDO",       "");
  setCel(abaC, linha, cm, "OBSERVACAO_ACORDO_ASSISTIDO",   "");
  var bloqueado = STATUS_BLOQUEIO.indexOf(novoStatus) >= 0 ? "SIM" : "NAO";
  if (cm["BLOQUEADO_PARA_NOVO_CREDITO"]) setCel(abaC, linha, cm, "BLOQUEADO_PARA_NOVO_CREDITO", bloqueado);
  registrarEvento({
    idContrato: idContrato, idCliente: idCli, nomeCliente: nomeCli,
    tipoEvento: "ACORDO_ASSISTIDO_SAIDA",
    statusAnterior: "acordo_assistido", statusNovo: novoStatus,
    observacoes: "Retorno à cobrança normal a partir do Acordo Assistido. Novo status: " + novoStatus
  });
  try { calcularScore(idCli); } catch(eScore) { Logger.log("Score err: "+eScore.message); }
}

function registrarPromessa(dados) {
  var ss      = SpreadsheetApp.getActiveSpreadsheet();
  var abaProm = ss.getSheetByName(ABAS.PROMESSAS);
  if (!abaProm) throw new Error("Aba PROMESSAS nao encontrada.");
  var cm  = buildColMap(abaProm);
  var id  = proximoIdSeq(abaProm, "PRM");
  var nc  = abaProm.getLastColumn();
  var row = new Array(nc).fill("");
  function s(h,v){if(cm[h]&&cm[h]<=nc)row[cm[h]-1]=v;}
  s("ID_PROMESSA",             id);
  s("ID_CONTRATO",             dados.idContrato  || "");
  s("ID_CLIENTE",              dados.idCliente   || "");
  s("NOME_CLIENTE",            dados.nomeCliente || "");
  s("DATA_PROMESSA",           new Date());
  s("DATA_PREVISTA_PAGAMENTO", dados.dataPrevista ? parseDateLocal(dados.dataPrevista) : new Date());
  s("VALOR_PROMETIDO",         parseFloat(dados.valorPrometido)||0);
  s("STATUS_PROMESSA",         "PENDENTE");
  s("OBSERVACAO",              dados.observacao  || "");
  var ul = abaProm.getLastRow()+1;
  abaProm.getRange(ul,1,1,nc).setValues([row]);
  if(cm["DATA_PROMESSA"])           abaProm.getRange(ul,cm["DATA_PROMESSA"]).setNumberFormat("dd/mm/yyyy");
  if(cm["DATA_PREVISTA_PAGAMENTO"]) abaProm.getRange(ul,cm["DATA_PREVISTA_PAGAMENTO"]).setNumberFormat("dd/mm/yyyy");
  if(cm["VALOR_PROMETIDO"])         abaProm.getRange(ul,cm["VALOR_PROMETIDO"]).setNumberFormat("R$ #,##0.00");
  registrarEvento({
    idContrato: dados.idContrato, idCliente: dados.idCliente, nomeCliente: dados.nomeCliente,
    tipoEvento: "PROMESSA_DE_PAGAMENTO", valorTotal: parseFloat(dados.valorPrometido)||0,
    observacoes: "Promessa de R$ "+(dados.valorPrometido||0)+" para "+(dados.dataPrevista||"")
  });
  // Gravar DATA_ACORDO na parcela para exibição virtual e envio de mensagens
  if (dados.idParcela && dados.dataPrevista) {
    var abaP2 = ss.getSheetByName(ABAS.PARCELAS);
    var cmP2  = buildColMap(abaP2);
    var dadosP2 = abaP2.getDataRange().getValues();
    for (var pi = 1; pi < dadosP2.length; pi++) {
      if (String(dadosP2[pi][0]).trim() === String(dados.idParcela).trim()) {
        setCel(abaP2, pi+1, cmP2, "DATA_ACORDO", parseDateLocal(dados.dataPrevista), "dd/mm/yyyy");
        break;
      }
    }
  }
}

function atualizarPromessa(body) {
  var ss      = SpreadsheetApp.getActiveSpreadsheet();
  var abaProm = ss.getSheetByName(ABAS.PROMESSAS);
  if (!abaProm) throw new Error("Aba PROMESSAS nao encontrada.");
  var cm    = buildColMap(abaProm);
  var dados = abaProm.getDataRange().getValues();
  var cId   = cm["ID_PROMESSA"];
  var cSt   = cm["STATUS_PROMESSA"];
  var cDC   = cm["DATA_CUMPRIMENTO"];
  for (var i = 1; i < dados.length; i++) {
    if (String(dados[i][cId-1]).trim() === String(body.idPromessa).trim()) {
      if (cSt) abaProm.getRange(i+1, cSt).setValue(body.status);
      if (cDC && body.dataCumprimento) abaProm.getRange(i+1, cDC).setNumberFormat("dd/mm/yyyy").setValue(parseDateLocal(body.dataCumprimento));
      registrarEvento({
        tipoEvento:  "ATUALIZACAO_PROMESSA",
        observacoes: "Promessa " + body.idPromessa + " marcada como " + body.status
      });
      return;
    }
  }
  throw new Error("Promessa nao encontrada: " + body.idPromessa);
}

function atualizarStatusContrato(idContrato, dados) {
  var ss   = SpreadsheetApp.getActiveSpreadsheet();
  var abaC = ss.getSheetByName(ABAS.CONTRATOS);
  var cm   = buildColMap(abaC);
  var rows = abaC.getDataRange().getValues();
  var linha = -1; var row = null;
  for (var i = 1; i < rows.length; i++) {
    if (String(rows[i][(cm["ID_CONTRATO"]||1)-1]).trim()===String(idContrato).trim()) {
      linha=i+1; row=rows[i]; break;
    }
  }
  if (linha===-1) throw new Error("Contrato nao encontrado: "+idContrato);
  var stAnt = String(row[(cm["STATUS_CONTRATO"]||16)-1]||"");
  var stNovo = dados.novoStatus || stAnt;
  setCel(abaC, linha, cm, "STATUS_CONTRATO", stNovo);
  if (dados.substatus)          setCel(abaC, linha, cm, "SUBSTATUS_PREJUIZO", dados.substatus);
  if (dados.proximaProvidencia) setCel(abaC, linha, cm, "PROXIMA_PROVIDENCIA", dados.proximaProvidencia);
  if (dados.observacao)         setCel(abaC, linha, cm, "OBSERVACAO_BAIXA", dados.observacao);
  var bloqueado = STATUS_BLOQUEIO.indexOf(stNovo) >= 0 ? "SIM" : "NAO";
  setCel(abaC, linha, cm, "BLOQUEADO_PARA_NOVO_CREDITO", bloqueado);
  if (bloqueado==="SIM") setCel(abaC, linha, cm, "MOTIVO_BLOQUEIO_CREDITO", "contrato_"+stNovo);
  registrarEvento({
    idContrato: idContrato, idCliente: String(row[(cm["ID_CLIENTE"]   ||2)-1]),
    nomeCliente: String(row[(cm["NOME_CLIENTE"] ||3)-1]),
    tipoEvento: "ALTERACAO_MANUAL", statusAnterior: stAnt, statusNovo: stNovo,
    observacoes: dados.observacao || ("Status alterado de "+stAnt+" para "+stNovo)
  });
}

function atualizarStatusContratos() {
  var ss   = SpreadsheetApp.getActiveSpreadsheet();
  var abaC = ss.getSheetByName(ABAS.CONTRATOS);
  var abaP = ss.getSheetByName(ABAS.PARCELAS);
  if (!abaC || !abaP) return;
  var cmC  = buildColMap(abaC);
  var cmP  = buildColMap(abaP);
  var dadosC = abaC.getDataRange().getValues();
  var dadosP = abaP.getDataRange().getValues();
  var abaPag180  = ss.getSheetByName(ABAS.PAGAMENTOS);
  var cmPag180   = abaPag180 ? buildColMap(abaPag180) : {};
  var dadosPag180 = abaPag180 ? abaPag180.getDataRange().getValues() : [];
  var statusFinais = ["baixado_como_prejuizo","em_recuperacao","recuperado_parcialmente",
    "recuperado_integralmente","encerrado_sem_recuperacao","cancelado","renegociado","acordo_assistido",
    "em_processo_judicial","encerrado_judicialmente"];
  var count = 0;
  for (var i = 1; i < dadosC.length; i++) {
    var stAtual = String(dadosC[i][(cmC["STATUS_CONTRATO"]||16)-1]||"").toLowerCase().trim();
    var idC = String(dadosC[i][(cmC["ID_CONTRATO"]||1)-1]).trim();
    // Regra 180 dias: acordo_assistido sem abatimento → move para pre_prejuizo
    if (stAtual === "acordo_assistido") {
      var ultData180 = null;
      var colIdCPag = (cmPag180["ID_CONTRATO"]||999)-1;
      var colTipoPag = (cmPag180["TIPO_PAGAMENTO"]||999)-1;
      var colDtPag  = (cmPag180["DATA_PAGAMENTO"]||999)-1;
      for (var pi180 = 1; pi180 < dadosPag180.length; pi180++) {
        if (String(dadosPag180[pi180][colIdCPag]||"").trim() !== idC) continue;
        if (String(dadosPag180[pi180][colTipoPag]||"").trim() !== "abatimento_acordo_assistido") continue;
        var dpRaw = dadosPag180[pi180][colDtPag];
        var dp180 = dpRaw instanceof Date ? dpRaw : parseDateLocal(String(dpRaw||""));
        if (dp180 && !isNaN(dp180.getTime()) && (!ultData180 || dp180 > ultData180)) ultData180 = dp180;
      }
      if (!ultData180) {
        var entRaw = dadosC[i][(cmC["DATA_ENTRADA_ACORDO_ASSISTIDO"]||999)-1];
        if (entRaw) { try { ultData180 = entRaw instanceof Date ? entRaw : parseDateLocal(String(entRaw)); } catch(ee){} }
      }
      if (ultData180 && !isNaN(ultData180.getTime())) {
        var diasSem180 = Math.round((new Date() - ultData180) / 86400000);
        if (diasSem180 >= 180) {
          abaC.getRange(i+1, cmC["STATUS_CONTRATO"]||16).setValue("pre_prejuizo");
          try { registrarEvento({
            idContrato: idC,
            idCliente: String(dadosC[i][(cmC["ID_CLIENTE"]||2)-1]),
            nomeCliente: String(dadosC[i][(cmC["NOME_CLIENTE"]||3)-1]),
            tipoEvento: "ACORDO_ASSISTIDO_EXPIRADO",
            statusAnterior: "acordo_assistido", statusNovo: "pre_prejuizo",
            observacoes: "Acordo Assistido expirado — " + diasSem180 + " dias sem abatimento."
          }); } catch(eEv) { Logger.log("Evento exp err: "+eEv.message); }
          count++;
        }
      }
      continue;
    }
    if (statusFinais.indexOf(stAtual) >= 0) continue;
    // "quitado" só é reavaliado se houver parcela não-terminal (ex: reabertura)
    if (stAtual === "quitado") {
      var temAberta = false;
      for (var pi = 1; pi < dadosP.length; pi++) {
        if (String(dadosP[pi][(cmP["ID_CONTRATO"]||2)-1]).trim() !== idC) continue;
        var stPi = String(dadosP[pi][(cmP["STATUS"]||cmP["STATUS_PAGAMENTO"]||11)-1]||"").toLowerCase().trim();
        if (!STATUS_TERMINAL[stPi]) { temAberta = true; break; }
      }
      if (!temAberta) {
        var stCart = String(dadosC[i][(cmC["STATUS_CARTEIRA"]||30)-1]||"").toLowerCase().trim();
        if (stCart !== "quitada" && cmC["STATUS_CARTEIRA"]) {
          abaC.getRange(i+1, cmC["STATUS_CARTEIRA"]).setValue("quitada");
        }
        continue;
      }
    }
    // Detectar contratos ativos com todas parcelas terminais (ex: pago direto no Sheets)
    var todasTerminal = true; var parEncontradas = 0;
    for (var pi2 = 1; pi2 < dadosP.length; pi2++) {
      if (String(dadosP[pi2][(cmP["ID_CONTRATO"]||2)-1]).trim() !== idC) continue;
      parEncontradas++;
      var stPi2 = String(dadosP[pi2][(cmP["STATUS"]||cmP["STATUS_PAGAMENTO"]||11)-1]||"").toLowerCase().trim();
      if (!STATUS_TERMINAL[stPi2]) { todasTerminal = false; break; }
    }
    if (parEncontradas > 0 && todasTerminal) {
      abaC.getRange(i+1, cmC["STATUS_CONTRATO"]||16).setValue("quitado");
      if (cmC["STATUS_CARTEIRA"]) abaC.getRange(i+1, cmC["STATUS_CARTEIRA"]).setValue("quitada");
      count++;
      continue;
    }
    var dias = maxDiasAtraso(idC, dadosP, cmP);
    var stNovo = statusPorDias(dias);
    if (stNovo !== stAtual) {
      abaC.getRange(i+1, cmC["STATUS_CONTRATO"]||16).setValue(stNovo);
      var bloq = STATUS_BLOQUEIO.indexOf(stNovo)>=0?"SIM":"NAO";
      if (cmC["BLOQUEADO_PARA_NOVO_CREDITO"]) abaC.getRange(i+1,cmC["BLOQUEADO_PARA_NOVO_CREDITO"]).setValue(bloq);
      count++;
    }
  }
  Logger.log("Status contratos atualizados: " + count);
  return count;
}

function atualizarDadosCliente(idCliente, campos) {
  var ss  = SpreadsheetApp.getActiveSpreadsheet();
  var aba = ss.getSheetByName(ABAS.CLIENTES);
  var cm  = buildColMap(aba);
  var dados = aba.getDataRange().getValues();
  var linha = -1;
  for (var i = 1; i < dados.length; i++) {
    if (String(dados[i][0]).trim()===String(idCliente).trim()) { linha=i+1; break; }
  }
  if (linha===-1) throw new Error("Cliente nao encontrado: "+idCliente);

  // Auto-sync Opção A: ao ativar cliente, se RENDA_MENSAL vazia e RENDA_LIQUIDA preenchida → copiar
  if (String(campos["STATUS_CLIENTE"]||"").toLowerCase() === "ativo") {
    var cRM = cm["RENDA_MENSAL"];
    var cRL = cm["RENDA_LIQUIDA"];
    if (cRM && cRL) {
      var rmAtual = parseFloat(dados[linha-1][cRM-1]||0)||0;
      var rlAtual = parseFloat(dados[linha-1][cRL-1]||0)||0;
      if (rmAtual === 0 && rlAtual > 0 && !campos["RENDA_MENSAL"]) {
        campos["RENDA_MENSAL"] = rlAtual;
      }
    }
  }

  Object.keys(campos).forEach(function(h) {
    var c = cm[h];
    if (c) { try { aba.getRange(linha,c).clearDataValidations(); aba.getRange(linha,c).setValue(campos[h]); } catch(e){} }
  });
  var cs = cm["STATUS_CLIENTE"];
  if (cs) aba.getRange(linha,cs).setDataValidation(
    SpreadsheetApp.newDataValidation().requireValueInList(["ativo","inativo","aguardando_conferencia","bloqueado"],true).build()
  );
  try { calcularScore(idCliente); } catch(eScore) { Logger.log("Score err: "+eScore.message); }
}

function atualizarCampoCliente(idCliente, header, valor) { atualizarDadosCliente(idCliente,{[header]:valor}); }

function registrarPagamentoAPI(idParcela, data, valor, forma, desconto) {
  var ss     = SpreadsheetApp.getActiveSpreadsheet();
  var abaP   = ss.getSheetByName(ABAS.PARCELAS);
  var abaPag = ss.getSheetByName(ABAS.PAGAMENTOS);
  var cm     = buildColMap(abaP);
  var cmPag  = buildColMap(abaPag);
  var dados = abaP.getDataRange().getValues();
  var linha = -1; var parRow = null;
  for (var i = 1; i < dados.length; i++) {
    if (String(dados[i][0])===String(idParcela)) { linha=i+1; parRow=dados[i]; break; }
  }
  if (linha===-1) throw new Error("Parcela nao encontrada: "+idParcela);
  // Idempotência: bloquear se parcela já está em status terminal (evita duplo processamento por double-click)
  var _stColIdem = cm["STATUS"] || cm["STATUS_PAGAMENTO"];
  if (_stColIdem) {
    var _stValIdem = String(parRow[_stColIdem-1]||"").toLowerCase().trim();
    if (STATUS_TERMINAL[_stValIdem]) {
      Logger.log("registrarPagamentoAPI: BLOQUEADO — parcela "+idParcela+" já em status terminal ("+_stValIdem+")");
      try { _idem_registrar_tentativa_dupla("PAG_MANUAL_"+idParcela,"PAGAMENTO_MANUAL"); } catch(e_) {}
      return { contratoQuitado: false, idContrato: String(parRow[(cm["ID_CONTRATO"]||2)-1]||""), duplicata: true };
    }
  }
  var isJudicial = String(parRow[(cm["ORIGEM_PARCELA"]||0)-1]||"").toLowerCase().trim() === "acordo_judicial";
  var valorOriginal = parseFloat(parRow[(cm["VALOR_PARCELA"]||8)-1]) || 0;
  var dtPag  = parseDateLocal(data);
  var dtVenc = parRow[(cm["DATA_VENCIMENTO"]||7)-1];
  if (!(dtVenc instanceof Date)) dtVenc = parseDateLocal(dtVenc);
  var vlPago = valor ? parseFloat(valor) : valorOriginal;
  var dif    = Math.max(0, vlPago - valorOriginal);
  var ehAtraso = false; var diasAtraso = 0; var diasAntecipacao = 0;
  if (dtPag && dtVenc && !isNaN(dtPag.getTime()) && !isNaN(dtVenc.getTime())) {
    var dP = new Date(dtPag.getFullYear(), dtPag.getMonth(), dtPag.getDate());
    var dV = new Date(dtVenc.getFullYear(), dtVenc.getMonth(), dtVenc.getDate());
    var diffDays = Math.round((dP.getTime() - dV.getTime()) / (1000 * 60 * 60 * 24));
    if (diffDays > 0) { ehAtraso = true; diasAtraso = diffDays; }
    else if (diffDays < 0) { diasAntecipacao = Math.abs(diffDays); }
  }
  var tipo = isJudicial ? "recuperacao_judicial" : (ehAtraso ? "pagamento_com_atraso" : (diasAntecipacao > 0 ? "pagamento_antecipado" : "pagamento_normal"));
  var stCol = cm["STATUS"] || cm["STATUS_PAGAMENTO"];
  var descontoAplicado = parseFloat(desconto||0);
  setCel(abaP, linha, cm, "DATA_PAGAMENTO",    dtPag,  "dd/mm/yyyy");
  setCel(abaP, linha, cm, "VALOR_PAGO",        vlPago, "R$ #,##0.00");
  setCel(abaP, linha, cm, "VALOR_RECEBIDO",    vlPago, "R$ #,##0.00");
  setCel(abaP, linha, cm, "DIFERENCA_PAGA",    dif,    "R$ #,##0.00");
  setCel(abaP, linha, cm, "TIPO_PAGAMENTO",    tipo);
  if (descontoAplicado > 0) setCel(abaP, linha, cm, "DESCONTO_APLICADO", descontoAplicado, "R$ #,##0.00");
  setCel(abaP, linha, cm, "DIAS_ATRASO",   diasAtraso);
  setCel(abaP, linha, cm, "DIAS_ANTECIPACAO", diasAntecipacao);
  setCel(abaP, linha, cm, "DATA_ACORDO",   "");
  if (stCol) abaP.getRange(linha, stCol).setValue("pago");
  var idContrato  = String(parRow[(cm["ID_CONTRATO"] ||2)-1]);
  var idCliente   = String(parRow[(cm["ID_CLIENTE"]  ||3)-1]);
  var nomeCliente = String(parRow[(cm["NOME_CLIENTE"]||4)-1]);
  var valJuros    = parseFloat(parRow[(cm["VALOR_JUROS"]   ||10)-1])||0;
  var valPrinc    = parseFloat(parRow[(cm["VALOR_PRINCIPAL"]||9)-1])||0;
  var idPag = proximoIdSeq(abaPag,"PAG");
  var nc    = abaPag.getLastColumn();
  var alocacaoJud = null;
  if (isJudicial) {
    _garantirColunasPagamentoJudicial(abaPag, cmPag);
    cmPag = buildColMap(abaPag);
    nc = abaPag.getLastColumn();
  }
  var rPag  = new Array(nc).fill("");
  function sp(h,v){if(cmPag[h]&&cmPag[h]<=nc)rPag[cmPag[h]-1]=v;}
  sp("ID_PAGAMENTO",           idPag);   sp("ID_PARCELA",             idParcela);
  sp("ID_CONTRATO",            idContrato); sp("ID_CLIENTE",          idCliente);
  sp("NOME_CLIENTE",           nomeCliente); sp("DATA_PAGAMENTO",     dtPag);
  sp("VALOR_ORIGINAL_PARCELA", valorOriginal); sp("VALOR_PAGO",       vlPago);
  sp("TIPO_PAGAMENTO",         tipo); sp("FORMA_PAGAMENTO",           forma);
  if (isJudicial) {
    alocacaoJud = _alocarRecuperacaoJudicial(vlPago, 0, "", 0, "", valPrinc);
    sp("CAPITAL_RECUPERADO_JUDICIAL", alocacaoJud.principalRecuperado);
    sp("LUCRO_RECUPERADO_JUDICIAL",   alocacaoJud.lucroRecuperado);
    sp("OBSERVACOES", "Parcela de acordo judicial. Principal: R$ "+alocacaoJud.principalRecuperado.toFixed(2)+". Lucro: R$ "+alocacaoJud.lucroRecuperado.toFixed(2));
  } else {
    sp("RECEITA_EXTRA_ATRASO", dif);
    sp("OBSERVACOES", dif>0?"Dif R$ "+dif.toFixed(2)+" (juros/multa atraso)":"");
  }
  var ul = abaPag.getLastRow()+1;
  abaPag.getRange(ul,1,1,nc).setValues([rPag]);
  if(cmPag["DATA_PAGAMENTO"])              abaPag.getRange(ul,cmPag["DATA_PAGAMENTO"]).setNumberFormat("dd/mm/yyyy");
  if(cmPag["VALOR_PAGO"])                  abaPag.getRange(ul,cmPag["VALOR_PAGO"]).setNumberFormat("R$ #,##0.00");
  if(cmPag["VALOR_ORIGINAL_PARCELA"])      abaPag.getRange(ul,cmPag["VALOR_ORIGINAL_PARCELA"]).setNumberFormat("R$ #,##0.00");
  if(cmPag["DIFERENCA_RECEBIDA"])          abaPag.getRange(ul,cmPag["DIFERENCA_RECEBIDA"]).setNumberFormat("R$ #,##0.00");
  if(cmPag["RECEITA_EXTRA_ATRASO"])        abaPag.getRange(ul,cmPag["RECEITA_EXTRA_ATRASO"]).setNumberFormat("R$ #,##0.00");
  if(cmPag["CAPITAL_RECUPERADO_JUDICIAL"]) abaPag.getRange(ul,cmPag["CAPITAL_RECUPERADO_JUDICIAL"]).setNumberFormat("R$ #,##0.00");
  if(cmPag["LUCRO_RECUPERADO_JUDICIAL"])   abaPag.getRange(ul,cmPag["LUCRO_RECUPERADO_JUDICIAL"]).setNumberFormat("R$ #,##0.00");
  if (isJudicial) {
    var abaCJud = ss.getSheetByName(ABAS.CONTRATOS);
    var cmCJud  = buildColMap(abaCJud);
    _garantirColunasFinanceiroJudicial(abaCJud, cmCJud);
    cmCJud = buildColMap(abaCJud);
    var dadosCJud = abaCJud.getDataRange().getValues();
    for (var jc = 1; jc < dadosCJud.length; jc++) {
      if (String(dadosCJud[jc][(cmCJud["ID_CONTRATO"]||1)-1]).trim() !== idContrato.trim()) continue;
      var novoPrincipalRecJ = (parseFloat(dadosCJud[jc][(cmCJud["VALOR_RECUPERADO_JUDICIAL_PRINCIPAL"]||0)-1])||0) + alocacaoJud.principalRecuperado;
      var novoLucroRecJ     = (parseFloat(dadosCJud[jc][(cmCJud["VALOR_RECUPERADO_JUDICIAL_LUCRO"]||0)-1])||0) + alocacaoJud.lucroRecuperado;
      var novoPrejuizoJ     = Math.max(0, (parseFloat(dadosCJud[jc][(cmCJud["PREJUIZO_CAPITAL"]||0)-1])||0) - alocacaoJud.principalRecuperado);
      setCel(abaCJud, jc+1, cmCJud, "VALOR_RECUPERADO_JUDICIAL_PRINCIPAL", novoPrincipalRecJ, "R$ #,##0.00");
      setCel(abaCJud, jc+1, cmCJud, "VALOR_RECUPERADO_JUDICIAL_LUCRO",     novoLucroRecJ,     "R$ #,##0.00");
      setCel(abaCJud, jc+1, cmCJud, "PREJUIZO_CAPITAL",                    novoPrejuizoJ,     "R$ #,##0.00");
      break;
    }
  }
  registrarEvento({idContrato:idContrato,idCliente:idCliente,nomeCliente:nomeCliente,idParcela:idParcela,tipoEvento:tipo,
    valorPrincipal:valPrinc,valorJuros:valJuros,valorTotal:vlPago,valorExtraAtraso:dif,
    observacoes: isJudicial ? "Parcela de acordo judicial recebida" : "Pagamento registrado via painel"});

  // Atualizar o status da parcela atual na cópia em memória antes de verificar
  if (stCol) dados[linha-1][stCol-1] = "pago";

  // Verificar se todas as parcelas do contrato estão pagas (usa dados em memória, sem releitura)
  var statusFinais = ["pago","quitado","quitada","quitacao_antecipada","cancelado","baixado_como_prejuizo","renegociado"];
  var todasPagas = true;
  var parcelasEncontradas = 0;
  for (var k = 1; k < dados.length; k++) {
    if (String(dados[k][(cm["ID_CONTRATO"]||2)-1]).trim() === idContrato.trim()) {
      parcelasEncontradas++;
      var stk = String(stCol ? dados[k][stCol-1] : "").toLowerCase().trim();
      if (statusFinais.indexOf(stk) === -1) { todasPagas = false; break; }
    }
  }
  if (parcelasEncontradas === 0) todasPagas = false;
  if (todasPagas) {
    var abaC = ss.getSheetByName(ABAS.CONTRATOS);
    var cmC  = buildColMap(abaC);
    var dadosC = abaC.getDataRange().getValues();
    for (var m = 1; m < dadosC.length; m++) {
      if (String(dadosC[m][(cmC["ID_CONTRATO"]||1)-1]).trim() === idContrato.trim()) {
        var stAtualQuit = String(dadosC[m][(cmC["STATUS_CONTRATO"]||16)-1]||"").toLowerCase().trim();
        if (isJudicial || stAtualQuit === "em_processo_judicial") {
          _garantirColunasFinanceiroJudicial(abaC, cmC);
          cmC = buildColMap(abaC);
          var prejRestante = parseFloat(dadosC[m][(cmC["PREJUIZO_CAPITAL"]||0)-1]) || 0;
          setCel(abaC, m+1, cmC, "STATUS_CONTRATO", "encerrado_judicialmente");
          setCel(abaC, m+1, cmC, "SITUACAO_FINANCEIRA_JUDICIAL", prejRestante <= 0 ? "QUITADO_JUDICIALMENTE" : "RECUPERADO_PARCIAL");
          // Encerra também o registro do acordo judicial em ACORDOS, se existir e ainda estiver ATIVO
          var abaAcQuit = ss.getSheetByName(ABAS.ACORDOS);
          if (abaAcQuit) {
            var cmAcQuit = buildColMap(abaAcQuit);
            if (cmAcQuit["TIPO_ACORDO"] && cmAcQuit["STATUS"]) {
              var dadosAcQuit = abaAcQuit.getDataRange().getValues();
              for (var aq = 1; aq < dadosAcQuit.length; aq++) {
                if (String(dadosAcQuit[aq][(cmAcQuit["ID_CONTRATO"]||1)-1]).trim() !== idContrato.trim()) continue;
                if (String(dadosAcQuit[aq][cmAcQuit["TIPO_ACORDO"]-1]||"") !== "JUDICIAL") continue;
                if (String(dadosAcQuit[aq][cmAcQuit["STATUS"]-1]||"") !== "ATIVO") continue;
                abaAcQuit.getRange(aq+1, cmAcQuit["STATUS"]).setValue("QUITADO");
              }
            }
          }
        } else {
          setCel(abaC, m+1, cmC, "STATUS_CONTRATO", "quitado");
          setCel(abaC, m+1, cmC, "STATUS_CARTEIRA", "quitada");
        }
        SpreadsheetApp.flush();
        break;
      }
    }
    try { _gerarEEnviarCertificado(idContrato, idCliente, nomeCliente, dtPag); } catch(eCert) { Logger.log("CertificadoQuitacao err: "+eCert.message); }
  } else if (isJudicial) {
    // Contrato judicial com parcelas do acordo ainda pendentes — mantém em_processo_judicial,
    // nunca recalcula por dias de atraso (aging normal não se aplica à fase judicial).
  } else {
    var abaC = ss.getSheetByName(ABAS.CONTRATOS);
    var cmC  = buildColMap(abaC);
    var dadosC = abaC.getDataRange().getValues();
    var stFinaisC = ["baixado_como_prejuizo","em_recuperacao","recuperado_parcialmente",
      "recuperado_integralmente","encerrado_sem_recuperacao","cancelado","renegociado","quitado",
      "em_processo_judicial","encerrado_judicialmente","acordo_assistido"];
    for (var mc = 1; mc < dadosC.length; mc++) {
      if (String(dadosC[mc][(cmC["ID_CONTRATO"]||1)-1]).trim() !== idContrato.trim()) continue;
      var stC = String(dadosC[mc][(cmC["STATUS_CONTRATO"]||16)-1]||"").toLowerCase().trim();
      if (stFinaisC.indexOf(stC) >= 0) break;
      var diasC = maxDiasAtraso(idContrato, dados, cm);
      var stNovoC = statusPorDias(diasC);
      if (stNovoC !== stC) abaC.getRange(mc+1, cmC["STATUS_CONTRATO"]||16).setValue(stNovoC);
      break;
    }
  }
  try { calcularScore(idCliente); } catch(eScore) { Logger.log("Score err: "+eScore.message); }
  try { calcularMetricasCliente(idCliente); } catch(eMet) { Logger.log("Metricas err: "+eMet.message); }
  if (!todasPagas) {
    try {
      var numParc = parseInt(parRow[(cm["NUM_PARCELA"]||5)-1])||0;
      var totParc = 0;
      for (var kp = 1; kp < dados.length; kp++) {
        if (String(dados[kp][(cm["ID_CONTRATO"]||2)-1]).trim() === idContrato.trim()) totParc++;
      }
      _enviarConfirmacaoPagamento({
        idParcela:idParcela, idContrato:idContrato, idCliente:idCliente,
        nomeCliente:nomeCliente, numParcela:numParc, totalParcelas:totParc, vlPago:vlPago
      });
    } catch(eConf) { Logger.log("ConfirmacaoWPP err: "+eConf.message); }
  }
  var idUndoPag = registrarUndo(isJudicial ? "RECUPERACAO_JUDICIAL" : "PAGAMENTO_NORMAL", idContrato, idCliente, nomeCliente, {
    idPagamento: idPag, idParcela: idParcela,
    numParcela: String(parseInt(parRow[(cm["NUM_PARCELA"]||5)-1])||0),
    idCliente: idCliente
  });
  return { contratoQuitado: todasPagas, idContrato: idContrato, idUndo: idUndoPag };
}

function registrarPagamentoParcial(idParcela, data, valorRecebido, idContrato, numParcela) {
  var ss     = SpreadsheetApp.getActiveSpreadsheet();
  var abaP   = ss.getSheetByName(ABAS.PARCELAS);
  var abaC   = ss.getSheetByName(ABAS.CONTRATOS);
  var abaPag = ss.getSheetByName(ABAS.PAGAMENTOS);
  var cm     = buildColMap(abaP);
  var ccm    = buildColMap(abaC);
  var cmPag  = buildColMap(abaPag);
  var dados = abaP.getDataRange().getValues();
  var linha = -1; var parRow = null;
  // Busca por ID_PARCELA primeiro; se vazio, busca por ID_CONTRATO + NUM_PARCELA
  if (idParcela) {
    for (var i = 1; i < dados.length; i++) {
      if (String(dados[i][0])===String(idParcela)) { linha=i+1; parRow=dados[i]; break; }
    }
  }
  if (linha===-1 && idContrato && numParcela) {
    var cIC = (cm["ID_CONTRATO"]||2)-1;
    var cNP = (cm["NUM_PARCELA"]||5)-1;
    var cSt = (cm["STATUS"]||cm["STATUS_PAGAMENTO"]||11)-1;
    for (var j = 1; j < dados.length; j++) {
      var stJ = String(dados[j][cSt]||"").toLowerCase();
      if (String(dados[j][cIC])===String(idContrato) &&
          String(dados[j][cNP])===String(numParcela) &&
          !STATUS_TERMINAL[stJ]) {
        linha=j+1; parRow=dados[j];
        idParcela = String(dados[j][0]||""); // usa o ID real do Sheets
        break;
      }
    }
  }
  if (linha===-1) throw new Error("Parcela nao encontrada: contrato="+idContrato+" parcela="+numParcela+" id="+idParcela);
  var idContrato   = String(parRow[(cm["ID_CONTRATO"]   ||2)-1]);
  var idCliente    = String(parRow[(cm["ID_CLIENTE"]    ||3)-1]);
  var nomeCliente  = String(parRow[(cm["NOME_CLIENTE"]  ||4)-1]);
  var valorParcela = parseFloat(parRow[(cm["VALOR_PARCELA"] ||8)-1])||0;
  var parcelJuros  = parseFloat(parRow[(cm["VALOR_JUROS"]   ||10)-1])||0;
  var parcelPrinc  = parseFloat(parRow[(cm["VALOR_PRINCIPAL"]||9)-1])||0;
  if (!parcelJuros||!parcelPrinc) {
    var contratos = abaC.getDataRange().getValues();
    for (var j=1;j<contratos.length;j++) {
      if (String(contratos[j][(ccm["ID_CONTRATO"]||1)-1])===idContrato) {
        parcelPrinc = parcelPrinc || parseFloat(contratos[j][(ccm["PARCELA_PRINCIPAL"]||13)-1])||0;
        parcelJuros = parcelJuros || parseFloat(contratos[j][(ccm["PARCELA_JUROS"]    ||14)-1])||0;
        break;
      }
    }
  }
  // ── VALIDAÇÕES DE POLÍTICA SOMENTE_JUROS ──
  var dadosCAll    = abaC.getDataRange().getValues();
  var contratSJLin = -1;
  var totalSJAtual = 0;
  for (var cv = 1; cv < dadosCAll.length; cv++) {
    if (String(dadosCAll[cv][0]).trim() === idContrato) {
      contratSJLin = cv + 1;
      totalSJAtual = parseInt(dadosCAll[cv][(ccm["TOTAL_SOMENTE_JUROS"]||9999)-1] || 0) || 0;
      break;
    }
  }
  if (totalSJAtual >= 2) {
    throw new Error("Limite de 2 prorrogações por contrato atingido. Cliente deve quitar a parcela completa ou formalizar um acordo.");
  }
  var feeProrrogacao = Math.round(parcelPrinc * 0.05 * 100) / 100;
  // Garantir coluna FEE_PRORROGACAO em PAGAMENTOS
  if (!cmPag["FEE_PRORROGACAO"]) {
    abaPag.getRange(1, abaPag.getLastColumn() + 1).setValue("FEE_PRORROGACAO");
    cmPag = buildColMap(abaPag);
  }
  var dtPag = parseDateLocal(data);
  var idPag = proximoIdSeq(abaPag,"PAG");
  var nc    = abaPag.getLastColumn();
  var rPag  = new Array(nc).fill("");
  function sp(h,v){if(cmPag[h]&&cmPag[h]<=nc)rPag[cmPag[h]-1]=v;}
  sp("ID_PAGAMENTO",idPag); sp("ID_PARCELA",idParcela); sp("ID_CONTRATO",idContrato);
  sp("ID_CLIENTE",idCliente); sp("NOME_CLIENTE",nomeCliente); sp("DATA_PAGAMENTO",dtPag);
  var vlPago = parcelJuros + feeProrrogacao;
  sp("VALOR_ORIGINAL_PARCELA",valorParcela); sp("VALOR_PAGO",vlPago);
  sp("RECEITA_EXTRA_ATRASO",0);
  sp("FEE_PRORROGACAO",feeProrrogacao);
  sp("TIPO_PAGAMENTO","somente_juros"); sp("FORMA_PAGAMENTO","pix");
  sp("OBSERVACOES","Somente juros. Principal R$ "+parcelPrinc.toFixed(2)+" rolado. Fee prorrogação (5%): R$ "+feeProrrogacao.toFixed(2)+".");
  var ul = abaPag.getLastRow()+1;
  abaPag.getRange(ul,1,1,nc).setValues([rPag]);
  if(cmPag["DATA_PAGAMENTO"])  abaPag.getRange(ul,cmPag["DATA_PAGAMENTO"]).setNumberFormat("dd/mm/yyyy");
  if(cmPag["VALOR_PAGO"])      abaPag.getRange(ul,cmPag["VALOR_PAGO"]).setNumberFormat("R$ #,##0.00");
  if(cmPag["FEE_PRORROGACAO"]) abaPag.getRange(ul,cmPag["FEE_PRORROGACAO"]).setNumberFormat("R$ #,##0.00");
  var stCol = cm["STATUS"]||cm["STATUS_PAGAMENTO"];
  setCel(abaP,linha,cm,"DATA_PAGAMENTO",dtPag,"dd/mm/yyyy");
  setCel(abaP,linha,cm,"VALOR_PAGO",vlPago,"R$ #,##0.00");
  setCel(abaP,linha,cm,"VALOR_RECEBIDO",vlPago,"R$ #,##0.00");
  setCel(abaP,linha,cm,"DIFERENCA_PAGA",0,"R$ #,##0.00");
  setCel(abaP,linha,cm,"TIPO_PAGAMENTO","somente_juros");
  if(stCol) abaP.getRange(linha,stCol).setValue("pago");
  var todasP = abaP.getDataRange().getValues();
  var idxDV  = (cm["DATA_VENCIMENTO"]||7)-1;
  var idxNP  = (cm["NUM_PARCELA"]||5)-1;
  var idxIC  = (cm["ID_CONTRATO"]||2)-1;
  var maxNP=0, ultimaDt=null, ultimaIdP=1;
  todasP.slice(1).forEach(function(r){
    if(String(r[idxIC])===idContrato){
      var np=parseInt(r[idxNP])||0; if(np>maxNP)maxNP=np;
      var dt=r[idxDV] instanceof Date?r[idxDV]:(r[idxDV]?new Date(r[idxDV]):null);
      if(dt&&!isNaN(dt.getTime())&&(!ultimaDt||dt>ultimaDt))ultimaDt=new Date(dt);
    }
    var n=parseInt(String(r[0]).replace(/\D/g,""))||0; if(n>=ultimaIdP)ultimaIdP=n+1;
  });
  if(!ultimaDt)ultimaDt=new Date(data);
  var novaData=new Date(ultimaDt); novaData.setMonth(novaData.getMonth()+1);
  var ncP   = abaP.getLastColumn();
  var novaR = new Array(ncP).fill("");
  var stNm  = cm["STATUS"]?"STATUS":"STATUS_PAGAMENTO";
  function sn(h,vl){if(cm[h]&&cm[h]<=ncP)novaR[cm[h]-1]=vl;}
  sn("ID_PARCELA",String(ultimaIdP).padStart(5,"0"));
  sn("ID_CONTRATO",idContrato); sn("ID_CLIENTE",idCliente); sn("NOME_CLIENTE",nomeCliente);
  sn("NUM_PARCELA",maxNP+1); sn("TOTAL_PARCELAS",maxNP+1);
  sn("DATA_VENCIMENTO",novaData); sn("VALOR_PARCELA",valorParcela);
  sn("VALOR_PRINCIPAL",parcelPrinc); sn("VALOR_JUROS",parcelJuros);
  sn(stNm,"pendente"); sn("ORIGEM_PARCELA","gerada_por_pagamento_de_juros");
  sn("ID_PARCELA_ORIGEM",idParcela); sn("DIFERENCA_PAGA",0);
  sn("OBSERVACOES","Gerada por pagamento somente de juros da parcela "+idParcela);
  var nl=abaP.getLastRow()+1;
  abaP.getRange(nl,1,1,ncP).setValues([novaR]);
  if(cm["DATA_VENCIMENTO"]) abaP.getRange(nl,cm["DATA_VENCIMENTO"]).setNumberFormat("dd/mm/yyyy");
  if(cm["VALOR_PARCELA"])   abaP.getRange(nl,cm["VALOR_PARCELA"]).setNumberFormat("R$ #,##0.00");
  if(cm["DIFERENCA_PAGA"])  abaP.getRange(nl,cm["DIFERENCA_PAGA"]).setNumberFormat("R$ #,##0.00");
  // Incrementar TOTAL_SOMENTE_JUROS no contrato
  if (contratSJLin > 0) {
    if (ccm["TOTAL_SOMENTE_JUROS"]) {
      abaC.getRange(contratSJLin, ccm["TOTAL_SOMENTE_JUROS"]).setValue(totalSJAtual + 1);
    } else {
      var lastCCol = abaC.getLastColumn();
      abaC.getRange(1, lastCCol + 1).setValue("TOTAL_SOMENTE_JUROS");
      abaC.getRange(contratSJLin, lastCCol + 1).setValue(1);
    }
  }
  registrarEvento({idContrato:idContrato,idCliente:idCliente,nomeCliente:nomeCliente,idParcela:idParcela,tipoEvento:"PAGAMENTO_SOMENTE_JUROS",
    valorPrincipal:parcelPrinc,valorJuros:parcelJuros,valorTotal:vlPago,valorExtraAtraso:0,
    observacoes:"Juros pagos. Nova parcela: "+String(ultimaIdP).padStart(5,"0")});
  try { calcularScore(idCliente); } catch(eScore) { Logger.log("Score err: "+eScore.message); }
  try { calcularMetricasCliente(idCliente); } catch(eMet) { Logger.log("Metricas err: "+eMet.message); }
  // Corrigir TOTAL_PARCELAS de todas as parcelas existentes deste contrato
  if (cm["TOTAL_PARCELAS"]) {
    var novoTotal = maxNP + 1;
    for (var tp = 1; tp < todasP.length; tp++) {
      if (String(todasP[tp][idxIC]) === idContrato) {
        abaP.getRange(tp+1, cm["TOTAL_PARCELAS"]).setValue(novoTotal);
      }
    }
  }
  try { atualizarTotaisContrato(idContrato, ss); } catch(eTC) { Logger.log("TotaisContrato err: "+eTC.message); }
  // Atualizar STATUS_CONTRATO em tempo real — nova parcela está no futuro → ativo_em_dia
  try {
    var dadosPSJ  = abaP.getDataRange().getValues();
    var cmPSJ     = buildColMap(abaP);
    var stFinSJ   = ["baixado_como_prejuizo","em_recuperacao","recuperado_parcialmente",
      "recuperado_integralmente","encerrado_sem_recuperacao","cancelado","renegociado","quitado"];
    var dadosCSJ  = abaC.getDataRange().getValues();
    var cmCSJ     = buildColMap(abaC);
    for (var si = 1; si < dadosCSJ.length; si++) {
      if (String(dadosCSJ[si][(cmCSJ["ID_CONTRATO"]||1)-1]).trim() !== idContrato.trim()) continue;
      var stAtualSJ = String(dadosCSJ[si][(cmCSJ["STATUS_CONTRATO"]||16)-1]||"").toLowerCase().trim();
      if (stFinSJ.indexOf(stAtualSJ) >= 0) break;
      var diasSJ   = maxDiasAtraso(idContrato, dadosPSJ, cmPSJ);
      var stNovoSJ = statusPorDias(diasSJ);
      if (stNovoSJ !== stAtualSJ) abaC.getRange(si+1, cmCSJ["STATUS_CONTRATO"]||16).setValue(stNovoSJ);
      break;
    }
  } catch(eSt) { Logger.log("StatusContrato SJ err: "+eSt.message); }
  // Enviar confirmação WPP (cancela promessas pendentes automaticamente via _enviarConfirmacaoPagamento)
  try {
    var numParcelaSJ = parseInt(parRow[(cm["NUM_PARCELA"]||5)-1])||0;
    _enviarConfirmacaoPagamento({
      idParcela:idParcela, idContrato:idContrato, idCliente:idCliente,
      nomeCliente:nomeCliente, numParcela:numParcelaSJ, totalParcelas:maxNP+1, vlPago:vlPago
    });
  } catch(eConf) { Logger.log("ConfirmacaoWPP SJ err: "+eConf.message); }
  var idUndoSJ = registrarUndo("SOMENTE_JUROS", idContrato, idCliente, nomeCliente, {
    idPagamento: idPag, idParcela: idParcela,
    numParcela: numParcela ? String(numParcela) : String(parseInt(parRow[(cm["NUM_PARCELA"]||5)-1])||0),
    idCliente: idCliente
  });
  return { idUndo: idUndoSJ };
}

function criarContrato(v) {
  var ss   = SpreadsheetApp.getActiveSpreadsheet();
  var abaC = ss.getSheetByName(ABAS.CONTRATOS);
  var atual = abaC.getDataRange().getValues();
  var maxId = 1;
  atual.slice(1).forEach(function(r){ var n=parseInt(String(r[0]).replace(/\D/g,""))||0; if(n>=maxId)maxId=n+1; });
  var idContrato  = v.id || ("PCL-Nº "+String(maxId));
  var idCliente   = v.idCliente   || v.clienteId   || "";
  var nomeCliente = v.nomeCliente || v.clienteNome  || "";
  if (idCliente) {
    var abaCliChk = ss.getSheetByName(ABAS.CLIENTES);
    var cmCliChk  = buildColMap(abaCliChk);
    if (cmCliChk["CLIENTE_JUDICIALIZADO"] || cmCliChk["CLIENTE_BLOQUEADO_MANUAL"]) {
      var dadosCliChk = abaCliChk.getDataRange().getValues();
      for (var ck = 1; ck < dadosCliChk.length; ck++) {
        if (String(dadosCliChk[ck][(cmCliChk["ID_CLIENTE"]||1)-1]).trim() === String(idCliente).trim()) {
          if (cmCliChk["CLIENTE_JUDICIALIZADO"] && String(dadosCliChk[ck][cmCliChk["CLIENTE_JUDICIALIZADO"]-1]||"").toUpperCase() === "SIM") {
            throw new Error("Cliente com histórico de ação judicial — bloqueio permanente para novo crédito.");
          }
          if (cmCliChk["CLIENTE_BLOQUEADO_MANUAL"] && String(dadosCliChk[ck][cmCliChk["CLIENTE_BLOQUEADO_MANUAL"]-1]||"").toUpperCase() === "SIM") {
            var motivoBloqChk = cmCliChk["MOTIVO_BLOQUEIO_MANUAL"] ? String(dadosCliChk[ck][cmCliChk["MOTIVO_BLOQUEIO_MANUAL"]-1]||"").trim() : "";
            throw new Error("Cliente bloqueado" + (motivoBloqChk ? ": " + motivoBloqChk : "."));
          }
          break;
        }
      }
    }
  }
  var p  = parseFloat(v.principal  || v.vp  || 0);
  var n  = parseInt(  v.parcelas   || v.np  || 0);
  var t  = parseFloat(v.taxa       || v.tx  || 0)/100;
  var dtEmp  = parseDateLocal(v.dataEmprestimo || v.dtEmp  || "");
  var dtVenc = parseDateLocal(v.dataVencimento  || v.dtVenc || "");
  if(!p||!n||!t) throw new Error("Valores invalidos");
  if(isNaN(dtEmp.getTime()))  throw new Error("Data do emprestimo invalida");
  if(isNaN(dtVenc.getTime())) throw new Error("Data do vencimento invalida");
  var jt=p*t*n, tot=p+jt, parc=tot/n, pp=p/n, jp=jt/n;
  var ul=abaC.getLastRow()+1;
  abaC.getRange(ul,1,1,16).setValues([[idContrato,idCliente,nomeCliente,dtEmp,dtVenc,p,n,t,t*n,jt,tot,parc,pp,jp,"","ativo_em_dia"]]);
  abaC.getRange(ul,4,1,2).setNumberFormat("dd/mm/yyyy");
  abaC.getRange(ul,6,1,1).setNumberFormat("R$ #,##0.00");
  abaC.getRange(ul,8,1,2).setNumberFormat("0.00%");
  abaC.getRange(ul,10,1,5).setNumberFormat("R$ #,##0.00");
  gerarParcelas(idContrato);
  registrarEvento({idContrato:idContrato,idCliente:idCliente,nomeCliente:nomeCliente,tipoEvento:"CRIACAO_CONTRATO",
    valorPrincipal:p,valorJuros:jt,valorTotal:tot,statusNovo:"ativo_em_dia",
    observacoes:"Contrato criado. "+n+" parcelas de R$ "+parc.toFixed(2)});
  try { calcularScore(idCliente); } catch(eScore) { Logger.log("Score err: "+eScore.message); }
  return idContrato;
}

function gerarParcelas(idContrato) {
  var ss   = SpreadsheetApp.getActiveSpreadsheet();
  var abaC = ss.getSheetByName(ABAS.CONTRATOS);
  var abaP = ss.getSheetByName(ABAS.PARCELAS);
  var cm   = buildColMap(abaP);
  var ccm  = buildColMap(abaC);
  var contratos = abaC.getDataRange().getValues();
  var contrato  = null;
  for(var i=1;i<contratos.length;i++){
    if(String(contratos[i][(ccm["ID_CONTRATO"]||1)-1])===String(idContrato)){contrato=contratos[i];break;}
  }
  if(!contrato)return;
  var idCliente   = String(contrato[(ccm["ID_CLIENTE"]          ||2)-1]);
  var nomeCliente = String(contrato[(ccm["NOME_CLIENTE"]         ||3)-1]);
  var numParcelas = parseInt(contrato[(ccm["NUM_PARCELAS"]       ||7)-1]);
  var valorParc   = parseFloat(contrato[(ccm["VALOR_PARCELA"]    ||12)-1]);
  var parcelPrinc = parseFloat(contrato[(ccm["PARCELA_PRINCIPAL"]||13)-1])||0;
  var parcelJuros = parseFloat(contrato[(ccm["PARCELA_JUROS"]    ||14)-1])||0;
  var dtPrimeira  = new Date(contrato[(ccm["DATA_PRIMEIRA_PARCELA"]||5)-1]);
  var parcelas = abaP.getDataRange().getValues();
  var ultimaId = 1;
  parcelas.slice(1).forEach(function(r){ var n=parseInt(String(r[0]).replace(/\D/g,""))||0; if(n>=ultimaId)ultimaId=n+1; });
  var nc=abaP.getLastColumn();
  var stNm=cm["STATUS"]?"STATUS":"STATUS_PAGAMENTO";
  var novas=[];
  for(var k=0;k<numParcelas;k++){
    var dtV=new Date(dtPrimeira); dtV.setMonth(dtV.getMonth()+k);
    var row=new Array(nc).fill("");
    function sr(h,vl){if(cm[h]&&cm[h]<=nc)row[cm[h]-1]=vl;}
    sr("ID_PARCELA",String(ultimaId+k).padStart(5,"0"));
    sr("ID_CONTRATO",idContrato); sr("ID_CLIENTE",idCliente); sr("NOME_CLIENTE",nomeCliente);
    sr("NUM_PARCELA",k+1); sr("TOTAL_PARCELAS",numParcelas);
    sr("DATA_VENCIMENTO",dtV); sr("VALOR_PARCELA",valorParc);
    sr("VALOR_PRINCIPAL",parcelPrinc); sr("VALOR_JUROS",parcelJuros);
    sr(stNm,"pendente"); sr("ORIGEM_PARCELA","original"); sr("DIFERENCA_PAGA",0);
    novas.push(row);
  }
  if(novas.length>0){
    var ul=abaP.getLastRow()+1;
    abaP.getRange(ul,1,novas.length,nc).setValues(novas);
    if(cm["DATA_VENCIMENTO"]) abaP.getRange(ul,cm["DATA_VENCIMENTO"],novas.length,1).setNumberFormat("dd/mm/yyyy");
    if(cm["VALOR_PARCELA"])   abaP.getRange(ul,cm["VALOR_PARCELA"],  novas.length,1).setNumberFormat("R$ #,##0.00");
    if(cm["DIFERENCA_PAGA"])  abaP.getRange(ul,cm["DIFERENCA_PAGA"], novas.length,1).setNumberFormat("R$ #,##0.00");
  }
}

function atualizarStatusParcelas() {
  var ss  = SpreadsheetApp.getActiveSpreadsheet();
  var aba = ss.getSheetByName(ABAS.PARCELAS);
  if(!aba||aba.getLastRow()<=1)return 0;
  var cm  = buildColMap(aba);
  var idxDV   = (cm["DATA_VENCIMENTO"]||7)-1;
  var stCol   = cm["STATUS"]||cm["STATUS_PAGAMENTO"];
  var dados   = aba.getDataRange().getValues();
  var hoje    = new Date(); hoje.setHours(0,0,0,0);
  var count   = 0;
  for(var i=1;i<dados.length;i++){
    var st=stCol?String(dados[i][stCol-1]).toLowerCase().trim():"";
    if(!!STATUS_TERMINAL[st])continue;
    var venc=new Date(dados[i][idxDV]); venc.setHours(0,0,0,0);
    var novo=venc<hoje?"atrasado":venc.getTime()===hoje.getTime()?"vence_hoje":"pendente";
    if(novo!==st&&stCol){aba.getRange(i+1,stCol).setValue(novo);count++;}
  }
  return count;
}

function _sanitNome(s){return String(s||"").replace(/\d/g,"").replace(/\s+/g," ").trim().replace(/\b\w/g,function(m){return m.toUpperCase();});}
function _soDigitos(s){return String(s||"").replace(/\D/g,"");}
function _soLetras(s){return String(s||"").replace(/[^a-zA-ZÀ-ÿ\s]/g,"").replace(/\s+/g," ").trim();}
function _emailFix(s){return String(s||"").toLowerCase().trim().replace(/\s/g,"");}
function _normTel(s){
  var d=String(s||"").replace(/\D/g,"");
  if(d.length>11&&d.slice(0,2)==="55")d=d.slice(2);
  if(d.length>10&&d.charAt(0)==="0")d=d.slice(1);
  if(d.length===10)d=d.slice(0,2)+"9"+d.slice(2);
  return d;
}

function onFormSubmit(e) {
  try {
    var ss=SpreadsheetApp.getActiveSpreadsheet();
    var abaCli=ss.getSheetByName(ABAS.CLIENTES);
    if(!abaCli)throw new Error("Aba CLIENTES nao encontrada");
    var nv=e.namedValues;
    function v(c){
      var val=nv[c];
      if(val&&val[0]) return String(val[0]).trim();
      var _n=function(s){return String(s).trim().toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g,"");};
      var cNorm=_n(c);
      var keys=Object.keys(nv);
      for(var ki=0;ki<keys.length;ki++){
        if(_n(keys[ki])===cNorm){var fv=nv[keys[ki]];if(fv&&fv[0])return String(fv[0]).trim();}
      }
      return "";
    }
    var cm=buildColMap(abaCli);
    var dados=abaCli.getDataRange().getValues();
    var pid=1; dados.slice(1).forEach(function(r){var n=parseInt(r[0])||0;if(n>=pid)pid=n+1;});
    var idCliente=String(pid).padStart(3,"0");
    var nl=abaCli.getLastRow()+1;
    var lc=abaCli.getLastColumn();
    abaCli.getRange(nl,1,1,lc).clearDataValidations();
    function wr(h,val){var c=cm[h];if(c){try{abaCli.getRange(nl,c).setValue(val);}catch(e){}}}
    wr("ID_CLIENTE",idCliente);
    wr("NOME",          _sanitNome(v("Nome Completo")));
    wr("CPF",           _soDigitos(v("CPF (somente numeros)")));
    wr("RG",            _soDigitos(v("RG (somente numeros)")));
    wr("NACIONALIDADE", v("Nacionalidade"));
    wr("ESTADO_CIVIL",  v("Estado civil"));
    wr("PROFISSAO",     _soLetras(v("Profissao")));
    wr("TELEFONE_WPP",  _normTel(v("WhatsApp com DDD (Somente números)")));
    wr("EMAIL",         _emailFix(v("E-mail (tudo minúsculo)")));
    wr("CEP",           _soDigitos(v("CEP (Somente números)")));
    wr("RUA",v("Rua Avenida")); wr("NUMERO",v("Numero (Somente números)"));
    wr("QUADRA",v("Quadra (Somente números)")); wr("LOTE",v("Lote (Somente números)"));
    wr("SETOR",v("Setor/Bairro")); wr("COMPLEMENTO",v("Complemento (Casa, Condomínio, Ap, Bloco)"));
    wr("CIDADE_ESTADO",v("Cidade Estado"));
    wr("CONTATO_CONFIANCA_1", _sanitNome(v("Nome de Pessoa de confiança 1")));
    wr("TEL_CONFIANCA_1",     _normTel(v("Telefone de Pessoa de confiança 1")));
    wr("CONTATO_CONFIANCA_2", _sanitNome(v("Nome de Pessoa de confiança 2")));
    wr("TEL_CONFIANCA_2",     _normTel(v("Telefone de Pessoa de confiança 2")));
    wr("DIA_VENCIMENTO_PREFERIDO",_soDigitos(v("Digite aqui a Data de vencimento da primeira parcela. Do dia 01 ao dia 31 (ex:  05,  08, 10, 20)")));
    var nomePadrinho=v("Nome da pessoa que te indicou nossos serviços");
    wr("PADRINHO",nomePadrinho);
    var telPadrinho="";
    if(nomePadrinho){
      var cNome=cm["NOME"];var cTel=cm["TELEFONE_WPP"];
      if(cNome&&cTel){
        var _norm=function(s){return String(s||"").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g,"").trim();};
        var padNorm=_norm(nomePadrinho);
        var padWords=padNorm.split(/\s+/).filter(function(w){return w.length>2;});
        for(var pi=1;pi<dados.length;pi++){
          var cliNome=_norm(String(dados[pi][cNome-1]||""));
          if(!cliNome)continue;
          var match=cliNome===padNorm||cliNome.indexOf(padNorm)>=0||padNorm.indexOf(cliNome)>=0||(padWords.length>0&&padWords.every(function(w){return cliNome.indexOf(w)>=0;}));
          if(match){telPadrinho=String(dados[pi][cTel-1]||"").trim();break;}
        }
      }
    }
    wr("TEL_PADRINHO",telPadrinho);
    wr("DATA_CADASTRO",new Date()); wr("STATUS_CLIENTE","aguardando_conferencia");
    wr("OBSERVACOES","Cadastro via formulario - aguardando conferencia");
    var cd=cm["DATA_CADASTRO"]; if(cd)abaCli.getRange(nl,cd).setNumberFormat("dd/mm/yyyy");
    var cs=cm["STATUS_CLIENTE"];
    if(cs)abaCli.getRange(nl,cs).setDataValidation(SpreadsheetApp.newDataValidation().requireValueInList(["ativo","inativo","aguardando_conferencia","bloqueado"],true).build());
    var nome=v("Nome Completo")||"Novo cliente";
    GmailApp.sendEmail(EMAIL_ADMIN,"FinanceiroOp - Novo cadastro: "+nome,"Nome: "+nome+"\nID: "+idCliente);
  } catch(err) {
    Logger.log("Erro onFormSubmit: "+err.message);
    GmailApp.sendEmail(EMAIL_ADMIN,"FinanceiroOp - Erro Forms","Erro: "+err.message);
  }
}

function configurarTriggerFormulario() {
  ScriptApp.getProjectTriggers().filter(function(t){return t.getHandlerFunction()==="onFormSubmit";}).forEach(function(t){ScriptApp.deleteTrigger(t);});
  ScriptApp.newTrigger("onFormSubmit").forSpreadsheet(SpreadsheetApp.getActiveSpreadsheet()).onFormSubmit().create();
  SpreadsheetApp.getUi().alert("Trigger configurado!");
}

function corrigirValidacoesColunasW() {
  var ss=SpreadsheetApp.getActiveSpreadsheet();
  var aba=ss.getSheetByName(ABAS.CLIENTES);
  if(!aba){SpreadsheetApp.getUi().alert("Aba CLIENTES nao encontrada.");return;}
  var cm=buildColMap(aba); var lr=Math.max(aba.getLastRow(),2);
  aba.getRange(2,1,lr-1,aba.getLastColumn()).clearDataValidations();
  var cs=cm["STATUS_CLIENTE"];
  if(cs)aba.getRange(2,cs,lr-1,1).setDataValidation(SpreadsheetApp.newDataValidation().requireValueInList(["ativo","inativo","aguardando_conferencia","bloqueado"],true).build());
  SpreadsheetApp.getUi().alert("Validacoes corrigidas!");
}

function configurarSistema() {
  var ss=SpreadsheetApp.getActiveSpreadsheet();
  criarAbaClientes(ss); criarAbaContratos(ss); criarAbaParcelas(ss);
  criarAbaPagamentos(ss); criarAbaEventos(ss); criarAbaPromessas(ss);
  criarAbaAcordos(ss); criarAbaConfiguracoes(ss);
  configurarTriggerDiario();
  ["Plan1","Sheet1","Pagina1"].forEach(function(n){try{var a=ss.getSheetByName(n);if(a)ss.deleteSheet(a);}catch(e){}});
  SpreadsheetApp.getUi().alert("FinanceiroOp configurado!");
}

function resetarSistema() {
  var ui=SpreadsheetApp.getUi();
  if(ui.alert("ATENCAO","Apaga TODOS os dados. Confirma?",ui.ButtonSet.YES_NO)===ui.Button.YES){configurarSistema();ui.alert("Sistema resetado.");}
}

function criarAbaClientes(ss) {
  var aba=ss.getSheetByName(ABAS.CLIENTES)||ss.insertSheet(ABAS.CLIENTES);
  if(aba.getLastRow()>0)return;
  var h=["ID_CLIENTE","NOME","CPF","RG","NACIONALIDADE","ESTADO_CIVIL","PROFISSAO","TELEFONE_WPP","EMAIL","CEP","RUA","NUMERO","QUADRA","LOTE","SETOR","COMPLEMENTO","CIDADE_ESTADO","CONTATO_CONFIANCA_1","TEL_CONFIANCA_1","CONTATO_CONFIANCA_2","TEL_CONFIANCA_2","DIA_VENCIMENTO_PREFERIDO","PADRINHO","TEL_PADRINHO","DATA_CADASTRO","STATUS_CLIENTE","OBSERVACOES","SCORE","TOTAL_EMPRESTADO","TOTAL_PAGO","CONTRATOS_ATIVOS","CONTRATOS_BAIXADOS"];
  aba.getRange(1,1,1,h.length).setValues([h]).setFontWeight("bold").setBackground("#1a1a2e").setFontColor("#ffffff");
  aba.setFrozenRows(1);
  aba.getRange(2,26,1000,1).setDataValidation(SpreadsheetApp.newDataValidation().requireValueInList(["ativo","inativo","aguardando_conferencia","bloqueado"],true).build());
  aba.getRange(2,25,1000,1).setNumberFormat("dd/mm/yyyy");
}

function criarAbaContratos(ss) {
  var aba=ss.getSheetByName(ABAS.CONTRATOS)||ss.insertSheet(ABAS.CONTRATOS);
  if(aba.getLastRow()>0)return;
  var h=["ID_CONTRATO","ID_CLIENTE","NOME_CLIENTE","DATA_EMPRESTIMO","DATA_PRIMEIRA_PARCELA","VALOR_PRINCIPAL","NUM_PARCELAS","TAXA_JUROS_MENSAL","TAXA_JUROS_TOTAL","JUROS_TOTAL","VALOR_TOTAL","VALOR_PARCELA","PARCELA_PRINCIPAL","PARCELA_JUROS","OBSERVACOES","STATUS_CONTRATO","SUBSTATUS_PREJUIZO","DATA_BAIXA_PREJUIZO","MOTIVO_BAIXA_PREJUIZO","POSSIBILIDADE_RECUPERACAO","VALOR_RECUPERADO_APOS_BAIXA","PREJUIZO_CAPITAL","JUROS_NAO_REALIZADOS","DIAS_ATRASO_NA_BAIXA","BLOQUEADO_PARA_NOVO_CREDITO","MOTIVO_BLOQUEIO_CREDITO","STATUS_JURIDICO","PROXIMA_PROVIDENCIA","OBSERVACAO_BAIXA","STATUS_CARTEIRA","VALOR_ACORDO","DATA_ACORDO","DESCONTO_PRINCIPAL_ACORDO","DESCONTO_JUROS_ACORDO"];
  aba.getRange(1,1,1,h.length).setValues([h]).setFontWeight("bold").setBackground("#1a1a2e").setFontColor("#ffffff");
  aba.setFrozenRows(1);
}

function criarAbaParcelas(ss) {
  var aba=ss.getSheetByName(ABAS.PARCELAS)||ss.insertSheet(ABAS.PARCELAS);
  if(aba.getLastRow()>0)return;
  var h=["ID_PARCELA","ID_CONTRATO","ID_CLIENTE","NOME_CLIENTE","NUM_PARCELA","TOTAL_PARCELAS","DATA_VENCIMENTO","VALOR_PARCELA","VALOR_PRINCIPAL","VALOR_JUROS","STATUS","DATA_PAGAMENTO","VALOR_PAGO","DIFERENCA_PAGA","TIPO_PAGAMENTO","ORIGEM_PARCELA","ID_PARCELA_ORIGEM","OBSERVACOES","VALOR_RECEBIDO","DESCONTO_APLICADO"];
  aba.getRange(1,1,1,h.length).setValues([h]).setFontWeight("bold").setBackground("#1a1a2e").setFontColor("#ffffff");
  aba.setFrozenRows(1);
}

function criarAbaPagamentos(ss) {
  var aba=ss.getSheetByName(ABAS.PAGAMENTOS)||ss.insertSheet(ABAS.PAGAMENTOS);
  if(aba.getLastRow()>0)return;
  var h=["ID_PAGAMENTO","ID_PARCELA","ID_CONTRATO","ID_CLIENTE","NOME_CLIENTE","DATA_PAGAMENTO","VALOR_ORIGINAL_PARCELA","VALOR_PAGO","DIFERENCA_RECEBIDA","RECEITA_EXTRA_ATRASO","FEE_PRORROGACAO","TIPO_PAGAMENTO","FORMA_PAGAMENTO","OBSERVACOES"];
  aba.getRange(1,1,1,h.length).setValues([h]).setFontWeight("bold").setBackground("#1a1a2e").setFontColor("#ffffff");
  aba.setFrozenRows(1);
}

function criarAbaEventos(ss) {
  var aba=ss.getSheetByName(ABAS.EVENTOS)||ss.insertSheet(ABAS.EVENTOS);
  if(aba.getLastRow()>0)return;
  var h=["ID_EVENTO","DATA_EVENTO","ID_CONTRATO","ID_CLIENTE","NOME_CLIENTE","ID_PARCELA","TIPO_EVENTO","VALOR_PRINCIPAL","VALOR_JUROS","VALOR_TOTAL","VALOR_EXTRA_ATRASO","STATUS_ANTERIOR","STATUS_NOVO","OBSERVACOES"];
  aba.getRange(1,1,1,h.length).setValues([h]).setFontWeight("bold").setBackground("#1a1a2e").setFontColor("#ffffff");
  aba.setFrozenRows(1);
}

function criarAbaPromessas(ss) {
  var aba=ss.getSheetByName(ABAS.PROMESSAS)||ss.insertSheet(ABAS.PROMESSAS);
  if(aba.getLastRow()>0)return;
  var h=["ID_PROMESSA","ID_CONTRATO","ID_CLIENTE","NOME_CLIENTE","DATA_PROMESSA","DATA_PREVISTA_PAGAMENTO","VALOR_PROMETIDO","STATUS_PROMESSA","DATA_CUMPRIMENTO","VALOR_PAGO","OBSERVACAO"];
  aba.getRange(1,1,1,h.length).setValues([h]).setFontWeight("bold").setBackground("#1a1a2e").setFontColor("#ffffff");
  aba.setFrozenRows(1);
  aba.getRange(2,5,1000,2).setNumberFormat("dd/mm/yyyy");
  aba.getRange(2,7,1000,1).setNumberFormat("R$ #,##0.00");
}

function criarAbaAcordos(ss) {
  var aba=ss.getSheetByName(ABAS.ACORDOS)||ss.insertSheet(ABAS.ACORDOS);
  if(aba.getLastRow()>0)return;
  var h=["ID_ACORDO","ID_CONTRATO","ID_CLIENTE","NOME_CLIENTE","DATA","VALOR_DIVIDA_ORIGINAL","VALOR_ACORDADO","DESCONTO_PRINCIPAL","DESCONTO_JUROS","STATUS","OBSERVACOES"];
  aba.getRange(1,1,1,h.length).setValues([h]).setFontWeight("bold").setBackground("#1a1a2e").setFontColor("#ffffff");
  aba.setFrozenRows(1);
  aba.getRange(2,5,1000,1).setNumberFormat("dd/mm/yyyy");
  aba.getRange(2,6,1000,4).setNumberFormat("R$ #,##0.00");
}

function criarAbaConfiguracoes(ss) {
  var aba=ss.getSheetByName(ABAS.CONFIG)||ss.insertSheet(ABAS.CONFIG);
  if(aba.getLastRow()>0)return;
  var d=[["CHAVE","VALOR"],["NOME_EMPRESA","Minha Empresa"],["TAXA_JUROS_PADRAO","0.10"],["NUM_PARCELAS_PADRAO","12"],["EMAIL_ADMIN",EMAIL_ADMIN]];
  aba.getRange(1,1,d.length,2).setValues(d);
  aba.getRange(1,1,1,2).setFontWeight("bold").setBackground("#1a1a2e").setFontColor("#ffffff");
}

function lerConfiguracoes() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var aba = ss.getSheetByName(ABAS.CONFIG);
  if (!aba || aba.getLastRow() <= 1) return {};
  var vals = aba.getDataRange().getValues();
  var cfg = {};
  for (var i = 1; i < vals.length; i++) {
    var chave = String(vals[i][0] || "").trim();
    if (chave) cfg[chave] = vals[i][1];
  }
  return cfg;
}

// ═══════════════════════════════════════════════════════════════════════════
// FASE 1 — MÉTRICAS ANALÍTICAS POR CLIENTE
// Colunas novas em CLIENTES: LTV_CLIENTE, LUCRO_TOTAL, PREJUIZO_TOTAL,
// ROI_CLIENTE, ATRASO_MEDIO, ATRASO_MAXIMO, PROMESSAS_QUEBRADAS, TAXA_ADIMPLENCIA
// ═══════════════════════════════════════════════════════════════════════════

function _garantirColunasMetricasCliente() {
  var ss  = SpreadsheetApp.getActiveSpreadsheet();
  var aba = ss.getSheetByName(ABAS.CLIENTES);
  if (!aba) return;
  var cm  = buildColMap(aba);
  ["LTV_CLIENTE","LUCRO_TOTAL","LUCRO_JUROS","RECEITA_ATRASO_ACUMULADA","PREJUIZO_TOTAL","ROI_CLIENTE",
   "ATRASO_MEDIO","ATRASO_MAXIMO","PROMESSAS_QUEBRADAS","TAXA_ADIMPLENCIA","TAXA_ADIMPLENCIA_REAL"].forEach(function(c) {
    if (!cm[c]) {
      var col = aba.getLastColumn() + 1;
      aba.getRange(1, col).setValue(c).setFontWeight("bold").setBackground("#1a1a2e").setFontColor("#ffffff");
      Logger.log("Coluna adicionada em CLIENTES: " + c);
    }
  });
}

function calcularMetricasCliente(idCliente, _dadosCli, _dadosC, _dadosP, _dadosPag, _dadosProm) {
  var ss     = SpreadsheetApp.getActiveSpreadsheet();
  var abaCli = ss.getSheetByName(ABAS.CLIENTES);
  var abaC   = ss.getSheetByName(ABAS.CONTRATOS);
  var abaP   = ss.getSheetByName(ABAS.PARCELAS);
  var abaPag = ss.getSheetByName(ABAS.PAGAMENTOS);
  var abaProm= ss.getSheetByName(ABAS.PROMESSAS);
  if (!abaCli || !abaC || !abaP) return null;

  var cmCli  = buildColMap(abaCli);
  var cmC    = buildColMap(abaC);
  var cmP    = buildColMap(abaP);
  var cmPag2 = abaPag  ? buildColMap(abaPag)  : {};
  var cmProm = abaProm ? buildColMap(abaProm) : {};

  var dadosCli  = _dadosCli  || abaCli.getDataRange().getValues();
  var dadosC    = _dadosC    || abaC.getDataRange().getValues();
  var dadosP    = _dadosP    || abaP.getDataRange().getValues();
  var dadosPag  = _dadosPag  || (abaPag  ? abaPag.getDataRange().getValues()  : []);
  var dadosProm = _dadosProm || (abaProm ? abaProm.getDataRange().getValues() : []);

  // Localiza linha do cliente para escrita
  var linCli = -1;
  for (var i = 1; i < dadosCli.length; i++) {
    if (String(dadosCli[i][0]).trim() === String(idCliente).trim()) { linCli = i + 1; break; }
  }
  if (linCli === -1) return null;

  var ST_PAGO = ["pago", "quitacao_antecipada"];

  // Índices PARCELAS
  var iP_IC   = (cmP["ID_CLIENTE"]      || 3)  - 1;
  var iP_IC2  = (cmP["ID_CONTRATO"]     || 2)  - 1;
  var iP_St   = (cmP["STATUS"] || cmP["STATUS_PAGAMENTO"] || 11) - 1;
  var iP_VJ   = (cmP["VALOR_JUROS"]     || 10) - 1;
  var iP_DP   = (cmP["DIFERENCA_PAGA"]  || 14) - 1;
  var iP_DA   = cmP["DIAS_ATRASO"]      ? cmP["DIAS_ATRASO"]      - 1 : -1;
  var iP_Dsc  = cmP["DESCONTO_APLICADO"]? cmP["DESCONTO_APLICADO"]- 1 : -1;

  // Índices CONTRATOS
  var iC_ID   = (cmC["ID_CONTRATO"]     || 1)  - 1;
  var iC_IC   = cmC["ID_CLIENTE"]       ? cmC["ID_CLIENTE"]       - 1 : -1;
  var iC_VP   = (cmC["VALOR_PRINCIPAL"] || 6)  - 1;
  var iC_Prej = cmC["PREJUIZO_CAPITAL"] ? cmC["PREJUIZO_CAPITAL"] - 1 : -1;
  var iC_St   = cmC["STATUS_CONTRATO"]  ? cmC["STATUS_CONTRATO"]  - 1 : -1;

  // Índices PAGAMENTOS (para TOTAL_PAGO)
  var iPag_IC = cmPag2["ID_CLIENTE"]     ? cmPag2["ID_CLIENTE"]     - 1 : -1;
  var iPag_VP = cmPag2["VALOR_PAGO"]     ? cmPag2["VALOR_PAGO"]     - 1 : -1;
  var iPag_TP = cmPag2["TIPO_PAGAMENTO"] ? cmPag2["TIPO_PAGAMENTO"] - 1 : -1;

  // Índices PROMESSAS
  var iPr_IC  = cmProm["ID_CLIENTE"]      ? cmProm["ID_CLIENTE"]      - 1 : 2;
  var iPr_St  = cmProm["STATUS_PROMESSA"] ? cmProm["STATUS_PROMESSA"] - 1 : 7;

  // Mapa de contratos do cliente (via parcelas — igual ao calcularScore)
  var idsContratos = {};
  for (var pi = 1; pi < dadosP.length; pi++) {
    if (String(dadosP[pi][iP_IC]).trim() !== String(idCliente).trim()) continue;
    var idCtr = String(dadosP[pi][iP_IC2] || "").trim();
    if (idCtr) idsContratos[idCtr] = true;
  }

  // Parcelas pagas: lucro, atraso
  var lucroJuros          = 0;  // juros contratuais (VALOR_JUROS - DESCONTO_APLICADO)
  var receitaAtrasoAcum   = 0;  // receita extra de atraso (DIFERENCA_PAGA) — capital recuperado, não lucro contratual
  var totalParcelasPagas  = 0;
  var totalEmDia          = 0;
  var somaAtrasosDias     = 0;
  var countAtraso         = 0;
  var maxAtraso           = 0;

  var ST_ABERTO = ["pendente", "atrasado", "vence_hoje"];
  var totalParcelasAbertas = 0;

  for (var pi2 = 1; pi2 < dadosP.length; pi2++) {
    if (String(dadosP[pi2][iP_IC]).trim() !== String(idCliente).trim()) continue;
    var st = String(dadosP[pi2][iP_St] || "").toLowerCase().trim();

    if (ST_ABERTO.indexOf(st) >= 0) { totalParcelasAbertas++; continue; }
    if (ST_PAGO.indexOf(st) < 0) continue;

    totalParcelasPagas++;
    var juros = parseFloat(dadosP[pi2][iP_VJ]  || 0) || 0;
    var dif   = parseFloat(dadosP[pi2][iP_DP]  || 0) || 0;
    var desc  = iP_Dsc >= 0 ? (parseFloat(dadosP[pi2][iP_Dsc] || 0) || 0) : 0;
    lucroJuros       += juros - desc;
    receitaAtrasoAcum += dif;

    var da = iP_DA >= 0 ? (parseInt(dadosP[pi2][iP_DA] || 0) || 0) : 0;
    if (da > maxAtraso) maxAtraso = da;
    if (da > 0) { somaAtrasosDias += da; countAtraso++; }
    else        { totalEmDia++; }
  }

  // Contratos: capital total, prejuízo, ativos e baixados
  var capitalTotal     = 0;
  var prejuizoTotal    = 0;
  var contratosAtivos  = 0;
  var contratosBaixados= 0;
  var contratosEmJudicial = 0;
  var _ST_ATIVO_C  = {ativo:1,ativo_em_dia:1,ativo_em_atraso:1,em_cobranca:1,pre_prejuizo:1,acordo_assistido:1,renegociado:1};
  var _ST_BAIXADO_C= {baixado_como_prejuizo:1,em_recuperacao:1,recuperado_parcialmente:1,recuperado_integralmente:1,encerrado_sem_recuperacao:1,encerrado_judicialmente:1};
  var _ST_JUDICIAL_C = {em_processo_judicial:1};
  for (var ci = 1; ci < dadosC.length; ci++) {
    var idCtrC = String(dadosC[ci][iC_ID] || "").trim();
    var ehDoCliente = idsContratos[idCtrC];
    if (!ehDoCliente && iC_IC >= 0) {
      if (String(dadosC[ci][iC_IC]).trim() !== String(idCliente).trim()) continue;
    } else if (!ehDoCliente) continue;
    capitalTotal  += parseFloat(dadosC[ci][iC_VP]  || 0) || 0;
    if (iC_Prej >= 0) prejuizoTotal += parseFloat(dadosC[ci][iC_Prej] || 0) || 0;
    if (iC_St >= 0) {
      var stC = String(dadosC[ci][iC_St] || "").toLowerCase().trim();
      if (_ST_ATIVO_C[stC])    contratosAtivos++;
      if (_ST_BAIXADO_C[stC])  contratosBaixados++;
      if (_ST_JUDICIAL_C[stC]) contratosEmJudicial++;
    }
  }

  // TOTAL_PAGO: soma de VALOR_PAGO em PAGAMENTOS (exceto abatimentos)
  var totalPago = 0;
  if (iPag_IC >= 0 && iPag_VP >= 0) {
    for (var pi3 = 1; pi3 < dadosPag.length; pi3++) {
      if (String(dadosPag[pi3][iPag_IC] || "").trim() !== String(idCliente).trim()) continue;
      if (iPag_TP >= 0 && String(dadosPag[pi3][iPag_TP] || "").trim() === "abatimento_acordo_assistido") continue;
      totalPago += parseFloat(dadosPag[pi3][iPag_VP] || 0) || 0;
    }
  }

  // Métricas derivadas
  var lucroTotal          = lucroJuros; // LUCRO_TOTAL = apenas juros contratuais; receita de atraso vai para RECEITA_ATRASO_ACUMULADA
  var ltvCliente          = lucroJuros - prejuizoTotal;
  var roiCliente          = capitalTotal > 0 ? (ltvCliente / capitalTotal) * 100 : 0;
  var atrasoMedio         = countAtraso  > 0 ? somaAtrasosDias / countAtraso     : 0;
  var taxaAdimplencia     = totalParcelasPagas > 0 ? (totalEmDia / totalParcelasPagas) * 100 : 0;
  var totalParcelasTodas  = totalParcelasPagas + totalParcelasAbertas;
  var taxaAdimplenciaReal = totalParcelasTodas > 0 ? (totalEmDia / totalParcelasTodas) * 100 : 0;

  // Promessas quebradas
  var promessasQuebradas = 0;
  for (var pri = 1; pri < dadosProm.length; pri++) {
    if (String(dadosProm[pri][iPr_IC] || "").trim() !== String(idCliente).trim()) continue;
    if (String(dadosProm[pri][iPr_St] || "").trim() === "QUEBRADA") promessasQuebradas++;
  }

  // Salva em CLIENTES
  function sc(h, val, fmt) {
    if (!cmCli[h]) return;
    try { var r = abaCli.getRange(linCli, cmCli[h]); r.setValue(val); if (fmt) r.setNumberFormat(fmt); } catch(e) {}
  }
  sc("LTV_CLIENTE",              parseFloat(ltvCliente.toFixed(2)),           "R$ #,##0.00");
  sc("LUCRO_TOTAL",              parseFloat(lucroJuros.toFixed(2)),           "R$ #,##0.00");
  sc("RECEITA_ATRASO_ACUMULADA", parseFloat(receitaAtrasoAcum.toFixed(2)),   "R$ #,##0.00");
  sc("PREJUIZO_TOTAL",           parseFloat(prejuizoTotal.toFixed(2)),        "R$ #,##0.00");
  sc("ROI_CLIENTE",              parseFloat(roiCliente.toFixed(2)));
  sc("ATRASO_MEDIO",             parseFloat(atrasoMedio.toFixed(1)));
  sc("ATRASO_MAXIMO",            maxAtraso);
  sc("PROMESSAS_QUEBRADAS",      promessasQuebradas);
  sc("TAXA_ADIMPLENCIA",         parseFloat(taxaAdimplencia.toFixed(2)));
  sc("TAXA_ADIMPLENCIA_REAL",    parseFloat(taxaAdimplenciaReal.toFixed(2)));
  sc("TOTAL_EMPRESTADO",         parseFloat(capitalTotal.toFixed(2)),          "R$ #,##0.00");
  sc("TOTAL_PAGO",               parseFloat(totalPago.toFixed(2)),             "R$ #,##0.00");
  sc("CONTRATOS_ATIVOS",         contratosAtivos);
  sc("CONTRATOS_BAIXADOS",       contratosBaixados);
  if (!cmCli["CONTRATOS_EM_JUDICIAL"]) {
    var ncCEJ = abaCli.getLastColumn() + 1;
    abaCli.getRange(1, ncCEJ).setValue("CONTRATOS_EM_JUDICIAL").setFontWeight("bold").setBackground("#1a1a2e").setFontColor("#ffffff");
    cmCli["CONTRATOS_EM_JUDICIAL"] = ncCEJ;
  }
  sc("CONTRATOS_EM_JUDICIAL",    contratosEmJudicial);

  return { ltvCliente:ltvCliente, lucroTotal:lucroJuros, lucroJuros:lucroJuros,
    receitaAtrasoAcum:receitaAtrasoAcum, prejuizoTotal:prejuizoTotal,
    roiCliente:roiCliente, atrasoMedio:atrasoMedio, maxAtraso:maxAtraso,
    promessasQuebradas:promessasQuebradas, taxaAdimplencia:taxaAdimplencia,
    taxaAdimplenciaReal:taxaAdimplenciaReal };
}

function recalcularTodasMetricas() {
  _garantirColunasMetricasCliente();
  var ss     = SpreadsheetApp.getActiveSpreadsheet();
  var abaCli = ss.getSheetByName(ABAS.CLIENTES);
  var abaC   = ss.getSheetByName(ABAS.CONTRATOS);
  var abaP   = ss.getSheetByName(ABAS.PARCELAS);
  var abaPag = ss.getSheetByName(ABAS.PAGAMENTOS);
  var abaProm= ss.getSheetByName(ABAS.PROMESSAS);
  if (!abaCli || !abaC || !abaP) return;
  var dadosCli  = abaCli.getDataRange().getValues();
  var dadosC    = abaC.getDataRange().getValues();
  var dadosP    = abaP.getDataRange().getValues();
  var dadosPag  = abaPag  ? abaPag.getDataRange().getValues()  : [];
  var dadosProm = abaProm ? abaProm.getDataRange().getValues() : [];
  var count = 0;
  for (var i = 1; i < dadosCli.length; i++) {
    var idCli = String(dadosCli[i][0]).trim();
    if (!idCli) continue;
    try { calcularMetricasCliente(idCli, dadosCli, dadosC, dadosP, dadosPag, dadosProm); count++; } catch(e) {
      Logger.log("Metricas err " + idCli + ": " + e.message);
    }
  }
  SpreadsheetApp.getUi().alert("Métricas recalculadas para " + count + " cliente(s).");
}

function garantirColunasAcordoAssistido() {
  var ss  = SpreadsheetApp.getActiveSpreadsheet();
  var aba = ss.getSheetByName(ABAS.CONTRATOS);
  if (!aba) { SpreadsheetApp.getUi().alert("Aba CONTRATOS não encontrada."); return; }
  var cm  = buildColMap(aba);
  var novas = [
    "DATA_ENTRADA_ACORDO_ASSISTIDO",
    "MOTIVO_ACORDO_ASSISTIDO",
    "OBSERVACAO_ACORDO_ASSISTIDO",
    "VALOR_ABATIDO_ASSISTIDO"
  ];
  var adicionadas = [];
  novas.forEach(function(h) {
    if (!cm[h]) {
      var nc = aba.getLastColumn() + 1;
      aba.getRange(1, nc).setValue(h).setFontWeight("bold").setBackground("#1a1a2e").setFontColor("#ffffff");
      adicionadas.push(h);
    }
  });
  var msg = adicionadas.length > 0
    ? "Colunas adicionadas em CONTRATOS:\n" + adicionadas.join("\n") + "\n\nPreencha DATA_ENTRADA_ACORDO_ASSISTIDO para os contratos PCL-77 e PCL-155 no Sheets."
    : "Todas as colunas já existem em CONTRATOS.";
  SpreadsheetApp.getUi().alert(msg);
}

function backfillReceitaExtraAtraso() {
  var ss  = SpreadsheetApp.getActiveSpreadsheet();
  var aba = ss.getSheetByName(ABAS.PAGAMENTOS);
  if (!aba) { SpreadsheetApp.getUi().alert("Aba PAGAMENTOS não encontrada."); return; }
  var cm    = buildColMap(aba);
  var dados = aba.getDataRange().getValues();
  var iDif  = (cm["DIFERENCA_RECEBIDA"]   || 0) - 1;
  var iExt  = (cm["RECEITA_EXTRA_ATRASO"] || 0) - 1;
  if (iDif < 0 || iExt < 0) { SpreadsheetApp.getUi().alert("Colunas não encontradas em PAGAMENTOS."); return; }
  var corrigidos = 0;
  for (var i = 1; i < dados.length; i++) {
    var dif   = parseFloat(dados[i][iDif]  || 0) || 0;
    var extra = parseFloat(dados[i][iExt]  || 0) || 0;
    if (dif > 0 && extra === 0) {
      setCel(aba, i + 1, cm, "RECEITA_EXTRA_ATRASO", dif);
      corrigidos++;
    }
  }
  SpreadsheetApp.getUi().alert("Backfill concluído: " + corrigidos + " registros corrigidos.");
}

function renumerarPagamentos() {
  var ui = SpreadsheetApp.getUi();
  var resp = ui.alert("Atenção", "Esta operação renumerará TODOS os " +
    "pagamentos de PAG00001 em diante. Confirmar?", ui.ButtonSet.YES_NO);
  if (resp !== ui.Button.YES) return;
  var ss   = SpreadsheetApp.getActiveSpreadsheet();
  var aba  = ss.getSheetByName(ABAS.PAGAMENTOS);
  if (!aba) { ui.alert("Aba PAGAMENTOS não encontrada."); return; }
  var cm   = buildColMap(aba);
  var total = aba.getLastRow() - 1;
  if (total <= 0) { ui.alert("Nenhum pagamento encontrado."); return; }
  for (var i = 1; i <= total; i++) {
    var novoId = "PAG" + String(i).padStart(5, "0");
    aba.getRange(i + 1, cm["ID_PAGAMENTO"]).setValue(novoId);
  }
  PropertiesService.getScriptProperties().setProperty("SEQ_PAG", String(total));
  ui.alert("Renumeração concluída: " + total + " pagamentos renumerados (PAG00001 → PAG" + String(total).padStart(5,"0") + ").");
}

function diagnosticarLegado() {
  var ss  = SpreadsheetApp.getActiveSpreadsheet();
  var ui  = SpreadsheetApp.getUi();

  var abaPag = ss.getSheetByName(ABAS.PAGAMENTOS);
  var cmPag  = buildColMap(abaPag);
  var dadosPag = abaPag.getDataRange().getValues();
  var iTP = (cmPag["TIPO_PAGAMENTO"] || 0) - 1;
  var contPag = {normal:0, com_atraso:0, antecipado:0};
  for (var i = 1; i < dadosPag.length; i++) {
    var tp = String(dadosPag[i][iTP] || "").toLowerCase().trim();
    if (contPag[tp] !== undefined) contPag[tp]++;
  }

  var abaPar = ss.getSheetByName(ABAS.PARCELAS);
  var cmPar  = buildColMap(abaPar);
  var dadosPar = abaPar.getDataRange().getValues();
  var iSt = (cmPar["STATUS"] || 0) - 1;
  var contPar = {paga:0, quitado:0, quitada:0, baixado:0, baixada:0, aberta:0, em_aberto:0};
  for (var j = 1; j < dadosPar.length; j++) {
    var st = String(dadosPar[j][iSt] || "").toLowerCase().trim();
    if (contPar[st] !== undefined) contPar[st]++;
  }

  var linhas = ["=== DIAGNÓSTICO DE VALORES LEGADO ===\n"];
  linhas.push("PAGAMENTOS — TIPO_PAGAMENTO:");
  linhas.push("  'normal'     → " + contPag.normal     + " registros  (oficial: pagamento_normal)");
  linhas.push("  'com_atraso' → " + contPag.com_atraso + " registros  (oficial: pagamento_com_atraso)");
  linhas.push("  'antecipado' → " + contPag.antecipado + " registros  (oficial: pagamento_antecipado)");
  linhas.push("\nPARCELAS — STATUS:");
  linhas.push("  'paga'      → " + contPar.paga      + " registros  (oficial: pago)");
  linhas.push("  'quitado'   → " + contPar.quitado   + " registros  (oficial: quitacao_antecipada)");
  linhas.push("  'quitada'   → " + contPar.quitada   + " registros  (oficial: quitacao_antecipada)");
  linhas.push("  'baixado'   → " + contPar.baixado   + " registros  (oficial: baixado_como_prejuizo)");
  linhas.push("  'baixada'   → " + contPar.baixada   + " registros  (oficial: baixado_como_prejuizo)");
  linhas.push("  'aberta'    → " + contPar.aberta    + " registros  (sem equivalente oficial)");
  linhas.push("  'em_aberto' → " + contPar.em_aberto + " registros  (sem equivalente oficial)");

  var totalLeg = contPag.normal+contPag.com_atraso+contPag.antecipado+
    contPar.paga+contPar.quitado+contPar.quitada+contPar.baixado+contPar.baixada+
    contPar.aberta+contPar.em_aberto;
  linhas.push("\nTOTAL DE REGISTROS LEGADO: " + totalLeg);
  if (totalLeg === 0) linhas.push("✓ Banco de dados limpo — nenhuma normalização necessária.");

  ui.alert("Diagnóstico de Valores Legado", linhas.join("\n"), ui.ButtonSet.OK);
}

function normalizarTipoPagamento() {
  var ui = SpreadsheetApp.getUi();
  var aviso = "Esta operação normalizará TIPO_PAGAMENTO em PAGAMENTOS:\n\n" +
    "  'normal'     → 'pagamento_normal'\n" +
    "  'com_atraso' → 'pagamento_com_atraso'\n" +
    "  'antecipado' → 'pagamento_antecipado'\n\n" +
    "Execute diagnosticarLegado() primeiro para ver os totais.\nConfirmar?";
  if (ui.alert("Normalizar TIPO_PAGAMENTO", aviso, ui.ButtonSet.YES_NO) !== ui.Button.YES) return;

  var ss  = SpreadsheetApp.getActiveSpreadsheet();
  var aba = ss.getSheetByName(ABAS.PAGAMENTOS);
  var cm  = buildColMap(aba);
  var dados = aba.getDataRange().getValues();
  var iTP = (cm["TIPO_PAGAMENTO"] || 0) - 1;
  if (iTP < 0) { ui.alert("Coluna TIPO_PAGAMENTO não encontrada."); return; }
  var mapa = {normal:"pagamento_normal", com_atraso:"pagamento_com_atraso", antecipado:"pagamento_antecipado"};
  var count = 0;
  for (var i = 1; i < dados.length; i++) {
    var v = String(dados[i][iTP] || "").toLowerCase().trim();
    if (mapa[v]) { aba.getRange(i + 1, iTP + 1).setValue(mapa[v]); count++; }
  }
  ui.alert("Normalização concluída: " + count + " registros atualizados em PAGAMENTOS.");
}

function normalizarStatusParcela() {
  var ui = SpreadsheetApp.getUi();
  var aviso = "Esta operação normalizará STATUS em PARCELAS:\n\n" +
    "  'paga'    → 'pago'\n" +
    "  'quitado' → 'quitacao_antecipada'\n" +
    "  'quitada' → 'quitacao_antecipada'\n" +
    "  'baixado' → 'baixado_como_prejuizo'\n" +
    "  'baixada' → 'baixado_como_prejuizo'\n\n" +
    "Execute diagnosticarLegado() primeiro para ver os totais.\nConfirmar?";
  if (ui.alert("Normalizar STATUS de Parcela", aviso, ui.ButtonSet.YES_NO) !== ui.Button.YES) return;

  var ss  = SpreadsheetApp.getActiveSpreadsheet();
  var aba = ss.getSheetByName(ABAS.PARCELAS);
  var cm  = buildColMap(aba);
  var dados = aba.getDataRange().getValues();
  var iSt = (cm["STATUS"] || 0) - 1;
  if (iSt < 0) { ui.alert("Coluna STATUS não encontrada."); return; }
  var mapa = {
    paga:"pago",
    quitado:"quitacao_antecipada", quitada:"quitacao_antecipada",
    baixado:"baixado_como_prejuizo", baixada:"baixado_como_prejuizo"
  };
  var count = 0;
  for (var i = 1; i < dados.length; i++) {
    var v = String(dados[i][iSt] || "").toLowerCase().trim();
    if (mapa[v]) { aba.getRange(i + 1, iSt + 1).setValue(mapa[v]); count++; }
  }
  ui.alert("Normalização concluída: " + count + " registros atualizados em PARCELAS.");
}

// ═══════════════════════════════════════════════════════════════════════════
// FASE 2 — EMPREGADOR + TABELA EMPREGADORES
// ═══════════════════════════════════════════════════════════════════════════

function _garantirColunasEmpregadorClientes() {
  var ss  = SpreadsheetApp.getActiveSpreadsheet();
  var aba = ss.getSheetByName(ABAS.CLIENTES);
  if (!aba) return;
  var cm  = buildColMap(aba);
  ["EMPREGADOR","CNPJ_EMPREGADOR","SITUACAO_EMPREGADOR","DATA_ABERTURA_EMPREGADOR","CODIGO_IBGE","LATITUDE","LONGITUDE","RENDA_BRUTA","RENDA_LIQUIDA","DATA_ADMISSAO","RENDA_MENSAL"].forEach(function(c) {
    if (!cm[c]) {
      var col = aba.getLastColumn() + 1;
      aba.getRange(1, col).setValue(c).setFontWeight("bold").setBackground("#1a1a2e").setFontColor("#ffffff");
      Logger.log("Coluna adicionada em CLIENTES: " + c);
    }
  });
}

// Reconstrói a aba EMPREGADORES agregando métricas de CLIENTES por empregador.
// Chamada pela rotina diária às 7h e disponível no menu para execução manual.
function atualizarTabelaEmpregadores() {
  var ss   = SpreadsheetApp.getActiveSpreadsheet();
  var abaC = ss.getSheetByName(ABAS.CLIENTES);
  if (!abaC || abaC.getLastRow() <= 1) return;

  var cmC   = buildColMap(abaC);
  var dados = abaC.getDataRange().getValues();

  var cEmp   = cmC["EMPREGADOR"]       ? cmC["EMPREGADOR"]       - 1 : -1;
  var cLucro = cmC["LUCRO_TOTAL"]      ? cmC["LUCRO_TOTAL"]      - 1 : -1;
  var cPreju = cmC["PREJUIZO_TOTAL"]   ? cmC["PREJUIZO_TOTAL"]   - 1 : -1;
  var cROI   = cmC["ROI_CLIENTE"]      ? cmC["ROI_CLIENTE"]      - 1 : -1;
  var cAM    = cmC["ATRASO_MEDIO"]     ? cmC["ATRASO_MEDIO"]     - 1 : -1;
  var cTA    = cmC["TAXA_ADIMPLENCIA"] ? cmC["TAXA_ADIMPLENCIA"] - 1 : -1;
  var cCap   = cmC["TOTAL_EMPRESTADO"] ? cmC["TOTAL_EMPRESTADO"] - 1 : -1;

  if (cEmp < 0) { Logger.log("EMPREGADOR não existe em CLIENTES"); return; }

  // Agrupa por empregador
  var grupos = {};
  for (var i = 1; i < dados.length; i++) {
    var emp = String(dados[i][cEmp] || "").trim();
    if (!emp) continue;
    if (!grupos[emp]) grupos[emp] = { n:0, capital:0, lucro:0, prejuizo:0, somaROI:0, somaAM:0, somaTA:0, nROI:0, nAM:0, nTA:0 };
    var g = grupos[emp];
    g.n++;
    if (cCap   >= 0) g.capital  += parseFloat(dados[i][cCap]   || 0) || 0;
    if (cLucro >= 0) g.lucro    += parseFloat(dados[i][cLucro] || 0) || 0;
    if (cPreju >= 0) g.prejuizo += parseFloat(dados[i][cPreju] || 0) || 0;
    if (cROI   >= 0) { var roi = parseFloat(dados[i][cROI] || 0) || 0; g.somaROI += roi; g.nROI++; }
    if (cAM    >= 0) { var am  = parseFloat(dados[i][cAM]  || 0) || 0; g.somaAM  += am;  g.nAM++;  }
    if (cTA    >= 0) { var ta  = parseFloat(dados[i][cTA]  || 0) || 0; if (ta > 0) { g.somaTA += ta; g.nTA++; } }
  }

  var linhas = [];
  Object.keys(grupos).sort(function(a,b){
    return (grupos[b].lucro - grupos[b].prejuizo) - (grupos[a].lucro - grupos[a].prejuizo);
  }).forEach(function(emp) {
    var g        = grupos[emp];
    var ltv      = g.lucro - g.prejuizo;
    var roiMedio = g.nROI > 0 ? g.somaROI / g.nROI : 0;
    var amMedio  = g.nAM  > 0 ? g.somaAM  / g.nAM  : 0;
    var taMedio  = g.nTA  > 0 ? g.somaTA  / g.nTA  : 0;

    // SCORE_EMPREGADOR (0–100)
    var ptROI = roiMedio > 30 ? 40 : roiMedio > 20 ? 30 : roiMedio > 10 ? 20 : roiMedio > 0 ? 10 : 0;
    var ptTA  = taMedio  > 90 ? 30 : taMedio  > 80 ? 20 : taMedio  > 70 ? 10 : 0;
    var ptAM  = amMedio === 0 ? 20 : amMedio <= 5 ? 15 : amMedio <= 15 ? 10 : amMedio <= 30 ? 5 : 0;
    var ptVol = g.n >= 5 ? 10 : g.n >= 3 ? 6 : g.n >= 2 ? 3 : 1;
    var score = Math.min(100, ptROI + ptTA + ptAM + ptVol);

    linhas.push([emp, g.n, g.capital, g.lucro, g.prejuizo, ltv,
      parseFloat(roiMedio.toFixed(2)), parseFloat(amMedio.toFixed(1)),
      parseFloat(taMedio.toFixed(2)), score, new Date()]);
  });

  if (linhas.length === 0) { Logger.log("atualizarTabelaEmpregadores: sem dados"); return; }

  var abaE = ss.getSheetByName("EMPREGADORES") || ss.insertSheet("EMPREGADORES");
  abaE.clearContents();

  var HDR = [["EMPREGADOR","QTD_CLIENTES","CAPITAL_EMPRESTADO","LUCRO_TOTAL","PREJUIZO_TOTAL",
              "LTV_LIQUIDO","ROI_MEDIO","ATRASO_MEDIO","TAXA_ADIMPLENCIA","SCORE_EMPREGADOR","ATUALIZADO_EM"]];
  abaE.getRange(1,1,1,HDR[0].length).setValues(HDR).setFontWeight("bold").setBackground("#1a1a2e").setFontColor("#ffffff");
  abaE.getRange(2,1,linhas.length,HDR[0].length).setValues(linhas);
  abaE.getRange(2,3,linhas.length,4).setNumberFormat("R$ #,##0.00");
  abaE.getRange(2,7,linhas.length,1).setNumberFormat("0.00");
  abaE.getRange(2,8,linhas.length,1).setNumberFormat("0.0");
  abaE.getRange(2,9,linhas.length,1).setNumberFormat("0.00");
  abaE.getRange(2,11,linhas.length,1).setNumberFormat("dd/mm/yyyy hh:mm");
  abaE.setFrozenRows(1);
  abaE.setColumnWidth(1, 220);
  abaE.setColumnWidth(10, 80);

  Logger.log("atualizarTabelaEmpregadores: " + linhas.length + " empregadores, ordenados por LTV");
}

// ═══════════════════════════════════════════════════════════════════════════
// FASE 3 — TABELA PADRINHOS
// Agrega métricas de CLIENTES agrupando pelo campo PADRINHO.
// Dados já disponíveis via Fase 1 (LTV, LUCRO, PREJUIZO, ROI, TAXA_ADIMPLENCIA).
// ═══════════════════════════════════════════════════════════════════════════

function atualizarTabelaPadrinhos() {
  var ss   = SpreadsheetApp.getActiveSpreadsheet();
  var abaC = ss.getSheetByName(ABAS.CLIENTES);
  if (!abaC || abaC.getLastRow() <= 1) return;

  var cmC   = buildColMap(abaC);
  var dados = abaC.getDataRange().getValues();

  var cPad   = cmC["PADRINHO"]         ? cmC["PADRINHO"]         - 1 : -1;
  var cSt    = cmC["STATUS_CLIENTE"]   ? cmC["STATUS_CLIENTE"]   - 1 : -1;
  var cCap   = cmC["TOTAL_EMPRESTADO"] ? cmC["TOTAL_EMPRESTADO"] - 1 : -1;
  var cLucro = cmC["LUCRO_TOTAL"]      ? cmC["LUCRO_TOTAL"]      - 1 : -1;
  var cPreju = cmC["PREJUIZO_TOTAL"]   ? cmC["PREJUIZO_TOTAL"]   - 1 : -1;
  var cROI   = cmC["ROI_CLIENTE"]      ? cmC["ROI_CLIENTE"]      - 1 : -1;
  var cTA    = cmC["TAXA_ADIMPLENCIA"] ? cmC["TAXA_ADIMPLENCIA"] - 1 : -1;
  var cAM    = cmC["ATRASO_MAXIMO"]    ? cmC["ATRASO_MAXIMO"]    - 1 : -1;

  if (cPad < 0) { Logger.log("atualizarTabelaPadrinhos: coluna PADRINHO nao encontrada"); return; }

  // Normaliza nome para agrupamento mas preserva o original para exibição
  var norm = function(s) {
    return String(s||"").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g,"").trim();
  };

  var grupos   = {}; // chave: nome normalizado
  var nomeReal = {}; // chave: nome normalizado → nome original mais frequente

  for (var i = 1; i < dados.length; i++) {
    var pad = String(dados[i][cPad] || "").trim();
    if (!pad) continue;

    var padNorm = norm(pad);
    if (!padNorm) continue;

    if (!grupos[padNorm]) {
      grupos[padNorm]   = { n:0, ativos:0, inadim:0, comPreju:0, capital:0, lucro:0, prejuizo:0, somaROI:0, somaTA:0, nROI:0, nTA:0 };
      nomeReal[padNorm] = pad;
    }
    var g = grupos[padNorm];
    g.n++;

    var st = cSt >= 0 ? String(dados[i][cSt]||"").toLowerCase().trim() : "";
    if (st === "ativo") g.ativos++;

    var am  = cAM >= 0 ? parseFloat(dados[i][cAM]  || 0) || 0 : 0;
    if (am > 0) g.inadim++;

    var prj = cPreju >= 0 ? parseFloat(dados[i][cPreju] || 0) || 0 : 0;
    if (prj > 0) g.comPreju++;

    if (cCap   >= 0) g.capital  += parseFloat(dados[i][cCap]   || 0) || 0;
    if (cLucro >= 0) g.lucro    += parseFloat(dados[i][cLucro] || 0) || 0;
    if (cPreju >= 0) g.prejuizo += prj;
    if (cROI   >= 0) { var roi = parseFloat(dados[i][cROI] || 0) || 0; g.somaROI += roi; g.nROI++; }
    if (cTA    >= 0) { var ta  = parseFloat(dados[i][cTA]  || 0) || 0; if (ta > 0) { g.somaTA += ta; g.nTA++; } }
  }

  var linhas = [];
  Object.keys(grupos).sort(function(a,b) {
    var la = grupos[a].lucro - grupos[a].prejuizo;
    var lb = grupos[b].lucro - grupos[b].prejuizo;
    return lb - la;
  }).forEach(function(padNorm) {
    var g        = grupos[padNorm];
    var ltv      = g.lucro - g.prejuizo;
    var roiMedio = g.nROI > 0 ? g.somaROI / g.nROI : 0;
    var taMedio  = g.nTA  > 0 ? g.somaTA  / g.nTA  : 0;
    var pctPreju = g.n > 0 ? g.comPreju / g.n : 0;

    // SCORE_PADRINHO (0–100)
    var ptROI = roiMedio > 30 ? 40 : roiMedio > 20 ? 30 : roiMedio > 10 ? 20 : roiMedio > 0 ? 10 : 0;
    var ptTA  = taMedio  > 90 ? 30 : taMedio  > 80 ? 20 : taMedio  > 70 ? 10 : 0;
    var ptPreju = pctPreju === 0 ? 20 : pctPreju < 0.10 ? 15 : pctPreju < 0.25 ? 10 : pctPreju < 0.50 ? 5 : 0;
    var ptVol   = g.n >= 5 ? 10 : g.n >= 3 ? 6 : g.n >= 2 ? 3 : 1;
    var score   = Math.min(100, ptROI + ptTA + ptPreju + ptVol);

    linhas.push([
      nomeReal[padNorm], g.n, g.ativos, g.inadim, g.comPreju,
      g.capital, g.lucro, g.prejuizo, ltv,
      parseFloat(roiMedio.toFixed(2)),
      parseFloat(taMedio.toFixed(2)),
      score, new Date()
    ]);
  });

  if (linhas.length === 0) { Logger.log("atualizarTabelaPadrinhos: sem dados"); return; }

  var abaP = ss.getSheetByName("PADRINHOS") || ss.insertSheet("PADRINHOS");
  abaP.clearContents();

  var HDR = [["NOME_PADRINHO","QTD_INDICADOS","QTD_ATIVOS","QTD_INADIMPLENTES","QTD_COM_PREJUIZO",
              "CAPITAL_GERADO","LUCRO_GERADO","PREJUIZO_GERADO","LTV_LIQUIDO",
              "ROI_MEDIO","TAXA_ADIMPLENCIA","SCORE_PADRINHO","ATUALIZADO_EM"]];
  abaP.getRange(1,1,1,HDR[0].length).setValues(HDR).setFontWeight("bold").setBackground("#1a1a2e").setFontColor("#ffffff");
  abaP.getRange(2,1,linhas.length,HDR[0].length).setValues(linhas);

  // Formatação
  abaP.getRange(2,6,linhas.length,4).setNumberFormat("R$ #,##0.00");
  abaP.getRange(2,10,linhas.length,1).setNumberFormat("0.00");
  abaP.getRange(2,11,linhas.length,1).setNumberFormat("0.00");
  abaP.getRange(2,13,linhas.length,1).setNumberFormat("dd/mm/yyyy hh:mm");
  abaP.setFrozenRows(1);
  abaP.setColumnWidth(1, 200);
  abaP.setColumnWidth(12, 80);

  Logger.log("atualizarTabelaPadrinhos: " + linhas.length + " padrinhos, ordenados por LTV");
}

function _garantirColunasRenovacao() {
  var ss  = SpreadsheetApp.getActiveSpreadsheet();
  var aba = ss.getSheetByName(ABAS.CLIENTES);
  if (!aba) return;
  var cm  = buildColMap(aba);
  ["RENOVACAO_STATUS","RENOVACAO_MOTIVO","RENOVACAO_CONDICOES"].forEach(function(c) {
    if (!cm[c]) {
      var col = aba.getLastColumn() + 1;
      aba.getRange(1, col).setValue(c).setFontWeight("bold").setBackground("#1a1a2e").setFontColor("#ffffff");
      Logger.log("Coluna adicionada em CLIENTES: " + c);
    }
  });
}

function _garantirColunaScoreTaxaPct() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var aba = ss.getSheetByName(ABAS.CLIENTES);
  if (!aba) return;
  var cm = buildColMap(aba);
  if (!cm["SCORE_TAXA_PCT"]) {
    var col = aba.getLastColumn() + 1;
    aba.getRange(1, col).setValue("SCORE_TAXA_PCT");
    Logger.log("Coluna SCORE_TAXA_PCT adicionada na posicao " + col);
  } else {
    Logger.log("Coluna SCORE_TAXA_PCT ja existe");
  }
}

function _garantirConfigsMotoCredito() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var aba = ss.getSheetByName(ABAS.CONFIG) || ss.insertSheet(ABAS.CONFIG);
  if (aba.getLastRow() === 0) aba.getRange(1,1,1,2).setValues([["CHAVE","VALOR"]]);
  var vals = aba.getDataRange().getValues();
  var existentes = {};
  for (var i = 1; i < vals.length; i++) {
    var k = String(vals[i][0] || "").trim();
    if (k) existentes[k] = true;
  }
  var novas = [
    ["TAXA_MINIMA_MENSAL",         0.14],
    ["TAXA_PADRAO_BAIXA_MENSAL",   0.16],
    ["TAXA_PADRAO_MENSAL",         0.18],
    ["TAXA_ALTA_MENSAL",           0.22],
    ["TAXA_MAXIMA_MENSAL",         0.25],
    ["COMPROMETIMENTO_MAX_PCT",    0.35],
    ["LIMITE_PRIMEIRO_EMPRESTIMO", 1500],
    ["SCORE_MIN_APROVACAO",        60],
    ["LIMITE_SCORE_EXCELENTE",     4000],
    ["LIMITE_SCORE_BOM",           3000],
    ["LIMITE_SCORE_MEDIO",         1500],
    ["LIMITE_SCORE_ATENCAO",       1000],
    ["PRAZO_MAX_EXCELENTE",        12],
    ["PRAZO_MAX_BOM",              10],
    ["PRAZO_MAX_MEDIO",            6],
    ["PRAZO_MAX_ATENCAO",          3],
  ];
  var adicionados = 0;
  novas.forEach(function(row) {
    if (!existentes[row[0]]) {
      var r = aba.getLastRow() + 1;
      aba.getRange(r, 1).setValue(row[0]);
      aba.getRange(r, 2).setValue(row[1]);
      adicionados++;
    }
  });
  Logger.log("_garantirConfigsMotoCredito: " + adicionados + " configuracoes adicionadas");
}

function configurarTriggerDiario() {
  ScriptApp.getProjectTriggers().filter(function(t){return t.getHandlerFunction()==="rotinaDiaria";}).forEach(function(t){ScriptApp.deleteTrigger(t);});
  ScriptApp.newTrigger("rotinaDiaria").timeBased().everyDays(1).atHour(7).create();
}

function rotinaDiaria() {
  Logger.log("ROTINA DIARIA - "+new Date().toLocaleString("pt-BR"));
  // Re-registro diário do webhook Efí — idempotente, Efí Bank perde o registro com frequência
  try { _reRegistrarWebhookEfi(); } catch(eWh) { Logger.log("Webhook re-reg err: "+eWh.message); }
  try { verificarPagamentosEfi(); } catch(eEfi) { Logger.log("Efi check err: "+eEfi.message); }
  try { enviarReguaCobranca(); } catch(eRegua) { Logger.log("Regua err: "+eRegua.message); }
  atualizarStatusParcelas();
  atualizarStatusContratos();
  verificarPromessasVencidas();
  try { auditarIntegridadeSistema(); } catch(eAud) { Logger.log("Auditoria err: "+eAud.message); }
  try { expirarUndosAntigos(); } catch(eUndo) { Logger.log("Undo expire err: "+eUndo.message); }
  try { verificarQuitacoesExpiradas(); } catch(eQExp) { Logger.log("QuitExp err: "+eQExp.message); }
}

function rotinaRegua() {
  Logger.log("ROTINA REGUA - "+new Date().toLocaleString("pt-BR"));
  try { enviarReguaCobranca(); } catch(eRegua) { Logger.log("Regua err: "+eRegua.message); }
}

function configurarTriggerRegua() {
  ScriptApp.getProjectTriggers()
    .filter(function(t){return t.getHandlerFunction()==="rotinaRegua";})
    .forEach(function(t){ScriptApp.deleteTrigger(t);});
  ScriptApp.newTrigger("rotinaRegua").timeBased().everyDays(1).atHour(8).create();
  Logger.log("Trigger rotinaRegua configurado para as 8h");
}

function rotinaVerificarPagamentos() {
  Logger.log("ROTINA VERIFICAR PAGAMENTOS - "+new Date().toLocaleString("pt-BR"));
  try { verificarPagamentosEfi(); } catch(e) { Logger.log("VerificarPag err: "+e.message); }
}

function configurarTriggerVerificacaoPagamentos() {
  ScriptApp.getProjectTriggers()
    .filter(function(t){return t.getHandlerFunction()==="rotinaVerificarPagamentos";})
    .forEach(function(t){ScriptApp.deleteTrigger(t);});
  ScriptApp.newTrigger("rotinaVerificarPagamentos").timeBased().everyHours(1).create();
  Logger.log("Trigger rotinaVerificarPagamentos configurado para rodar a cada 1 hora");
}

function rotinaAnalitica() {
  Logger.log("ROTINA ANALITICA - "+new Date().toLocaleString("pt-BR"));
  try { _atualizarScoresDiario(); } catch(eScore) { Logger.log("Score diario err: "+eScore.message); }
  try { atualizarTabelaEmpregadores(); } catch(eEmp) { Logger.log("Empregadores err: "+eEmp.message); }
  try { atualizarTabelaPadrinhos(); } catch(ePad) { Logger.log("Padrinhos err: "+ePad.message); }
}

function _atualizarScoresDiario() {
  _garantirColunasRenovacao();
  var ss     = SpreadsheetApp.getActiveSpreadsheet();
  var abaCli = ss.getSheetByName(ABAS.CLIENTES);
  var abaC   = ss.getSheetByName(ABAS.CONTRATOS);
  var abaP   = ss.getSheetByName(ABAS.PARCELAS);
  var abaPag = ss.getSheetByName(ABAS.PAGAMENTOS);
  var abaProm= ss.getSheetByName(ABAS.PROMESSAS);
  if (!abaCli || !abaC || !abaP) return;
  var dadosCli  = abaCli.getDataRange().getValues();
  var dadosC    = abaC.getDataRange().getValues();
  var dadosP    = abaP.getDataRange().getValues();
  var dadosPag  = abaPag  ? abaPag.getDataRange().getValues()  : [];
  var dadosProm = abaProm ? abaProm.getDataRange().getValues() : [];
  var cmCli    = buildColMap(abaCli);
  var stCol    = cmCli["STATUS_CLIENTE"] ? cmCli["STATUS_CLIENTE"] - 1 : -1;
  var count = 0;
  for (var i = 1; i < dadosCli.length; i++) {
    var idCli = String(dadosCli[i][0]).trim();
    if (!idCli) continue;
    if (stCol >= 0 && String(dadosCli[i][stCol]) !== "ativo") continue;
    try { calcularScore(idCli, dadosCli, dadosC, dadosP); count++; } catch(e) {
      Logger.log("Score err " + idCli + ": " + e.message);
    }
    try { calcularMetricasCliente(idCli, dadosCli, dadosC, dadosP, dadosPag, dadosProm); } catch(e) {
      Logger.log("Metricas err " + idCli + ": " + e.message);
    }
  }
  Logger.log("_atualizarScoresDiario: " + count + " clientes atualizados");
}

function verificarPromessasVencidas() {
  var ss=SpreadsheetApp.getActiveSpreadsheet();
  var aba=ss.getSheetByName(ABAS.PROMESSAS);
  if(!aba||aba.getLastRow()<=1)return;
  var cm=buildColMap(aba);
  var hoje=new Date();hoje.setHours(0,0,0,0);
  var dados=aba.getDataRange().getValues();
  var cDP=cm["DATA_PREVISTA_PAGAMENTO"];
  var cSt=cm["STATUS_PROMESSA"];
  for(var i=1;i<dados.length;i++){
    var st=String(dados[i][(cSt||8)-1]||"").trim();
    if(st!=="PENDENTE")continue;
    var dtP=new Date(dados[i][(cDP||6)-1]);dtP.setHours(0,0,0,0);
    if(dtP<hoje){aba.getRange(i+1,cSt).setValue("QUEBRADA");Logger.log("Promessa vencida: linha "+(i+1));}
  }
}

// dialogNovoContrato, salvarNovoContrato, dialogRegistrarPagamento, salvarPagamentoDialog
// removidos — substituídos pelo frontend React. Mantido apenas dialogResumoDia.

function dialogNovoContrato() {
  var ss=SpreadsheetApp.getActiveSpreadsheet();
  var abaCli=ss.getSheetByName(ABAS.CLIENTES);
  var dados=abaCli.getDataRange().getValues();
  var opcoes="";
  for(var i=1;i<dados.length;i++){if(String(dados[i][25]).toLowerCase()==="ativo")opcoes+="<option value='"+dados[i][0]+"|"+dados[i][1]+"'>"+dados[i][0]+" - "+dados[i][1]+"</option>";}
  var html="<html><body style='font-family:sans-serif;padding:16px;font-size:14px'><h3 style='margin:0 0 16px'>Novo Contrato</h3><label>Cliente</label><br><select id='cli' style='width:100%;margin:4px 0 12px;padding:6px'><option value=''>Selecione...</option>"+opcoes+"</select><br><label>Data do Emprestimo</label><br><input type='date' id='dtEmp' style='width:100%;margin:4px 0 12px;padding:6px'><br><label>Data da 1a Parcela</label><br><input type='date' id='dtVenc' style='width:100%;margin:4px 0 12px;padding:6px'><br><label>Valor Principal (R$)</label><br><input type='number' id='vp' min='0' step='0.01' style='width:100%;margin:4px 0 12px;padding:6px'><br><label>Numero de Parcelas</label><br><input type='number' id='np' min='1' value='12' style='width:100%;margin:4px 0 12px;padding:6px'><br><label>Taxa de Juros Mensal (%)</label><br><input type='number' id='tx' min='0' step='0.01' value='10' style='width:100%;margin:4px 0 12px;padding:6px'><br><p id='err' style='color:red;display:none'></p><button onclick='salvar()' style='width:100%;padding:10px;background:#1a1a2e;color:#fff;border:none;border-radius:4px;cursor:pointer'>Salvar e Gerar Parcelas</button><script>function salvar(){var cli=document.getElementById('cli').value;if(!cli){document.getElementById('err').textContent='Selecione um cliente.';document.getElementById('err').style.display='block';return;}var parts=cli.split('|');google.script.run.withSuccessHandler(function(){alert('Contrato salvo!');google.script.host.close();}).withFailureHandler(function(e){alert('Erro: '+e.message);}).salvarNovoContrato({clienteId:parts[0],clienteNome:parts[1],dtEmp:document.getElementById('dtEmp').value,dtVenc:document.getElementById('dtVenc').value,vp:parseFloat(document.getElementById('vp').value),np:parseInt(document.getElementById('np').value),tx:parseFloat(document.getElementById('tx').value)});}</script></body></html>";
  SpreadsheetApp.getUi().showModalDialog(HtmlService.createHtmlOutput(html).setWidth(420).setHeight(560),"Novo Contrato");
}

function salvarNovoContrato(v){criarContrato(v);}

function dialogRegistrarPagamento() {
  var ss=SpreadsheetApp.getActiveSpreadsheet();
  var abaP=ss.getSheetByName(ABAS.PARCELAS);
  var dados=abaP.getDataRange().getValues();
  var cm=buildColMap(abaP);
  var iDV=(cm["DATA_VENCIMENTO"]||7)-1,iVP=(cm["VALOR_PARCELA"]||8)-1,iNP=(cm["NUM_PARCELA"]||5)-1,iTP=(cm["TOTAL_PARCELAS"]||6)-1,iNm=(cm["NOME_CLIENTE"]||4)-1,stC=cm["STATUS"]||cm["STATUS_PAGAMENTO"];
  var opcoes="";
  for(var i=1;i<dados.length;i++){var st=stC?String(dados[i][stC-1]).toLowerCase():"";if(st!=="pago"&&st!=="cancelado"&&st!=="baixado_como_prejuizo"){var venc=dados[i][iDV]?new Date(dados[i][iDV]).toLocaleDateString("pt-BR"):"";opcoes+="<option value='"+dados[i][0]+"'>"+dados[i][0]+" | "+dados[i][iNm]+" | Parc "+dados[i][iNP]+"/"+dados[i][iTP]+" | Venc: "+venc+" | R$ "+parseFloat(dados[i][iVP]).toFixed(2)+"</option>";}}
  var html="<html><body style='font-family:sans-serif;padding:16px;font-size:14px'><h3>Registrar Pagamento</h3><select id='parc' style='width:100%;margin:4px 0 12px;padding:6px'><option value=''>Selecione...</option>"+opcoes+"</select><br><input type='date' id='dtPag' style='width:100%;margin:4px 0 12px;padding:6px'><br><input type='number' id='vlPag' min='0' step='0.01' style='width:100%;margin:4px 0 12px;padding:6px' placeholder='Valor Pago'><br><select id='forma' style='width:100%;margin:4px 0 12px;padding:6px'><option value='dinheiro'>Dinheiro</option><option value='pix'>PIX</option><option value='transferencia'>Transferencia</option></select><br><button onclick='s()' style='width:100%;padding:10px;background:#1a1a2e;color:#fff;border:none;border-radius:4px;cursor:pointer'>Confirmar</button><script>function s(){var p=document.getElementById('parc').value;var d=document.getElementById('dtPag').value;var v=document.getElementById('vlPag').value;if(!p||!d||!v)return;google.script.run.withSuccessHandler(function(){alert('OK!');google.script.host.close();}).withFailureHandler(function(e){alert(e.message);}).salvarPagamentoDialog({idParcela:p,dtPag:d,vlPag:parseFloat(v),forma:document.getElementById('forma').value});}</script></body></html>";
  SpreadsheetApp.getUi().showModalDialog(HtmlService.createHtmlOutput(html).setWidth(420).setHeight(400),"Registrar Pagamento");
}

function salvarPagamentoDialog(v){registrarPagamentoAPI(v.idParcela,v.dtPag,v.vlPag,v.forma);}

function dialogResumoDia() {
  var ss=SpreadsheetApp.getActiveSpreadsheet();
  var abaP=ss.getSheetByName(ABAS.PARCELAS);
  var dados=abaP.getDataRange().getValues();
  var cm=buildColMap(abaP);
  var iDV=(cm["DATA_VENCIMENTO"]||7)-1,iVP=(cm["VALOR_PARCELA"]||8)-1,iDP=(cm["DATA_PAGAMENTO"]||12)-1,iVPago=(cm["VALOR_PAGO"]||13)-1,iExtra=(cm["DIFERENCA_PAGA"]||14)-1,stC=cm["STATUS"]||cm["STATUS_PAGAMENTO"];
  var hoje=new Date();hoje.setHours(0,0,0,0);
  var vh=0,at=0,rec=0,tvh=0,tat=0,extra=0;
  for(var i=1;i<dados.length;i++){
    var st=stC?String(dados[i][stC-1]).toLowerCase():"";
    var venc=new Date(dados[i][iDV]);venc.setHours(0,0,0,0);
    var val=parseFloat(dados[i][iVP])||0;
    if(st!=="pago"&&st!=="baixado_como_prejuizo"){if(venc.getTime()===hoje.getTime()){vh++;tvh+=val;}if(venc<hoje){at++;tat+=val;}}
    if(st==="pago"){var dp=new Date(dados[i][iDP]);dp.setHours(0,0,0,0);if(dp.getTime()===hoje.getTime()){rec+=parseFloat(dados[i][iVPago])||0;extra+=parseFloat(dados[i][iExtra])||0;}}
  }
  SpreadsheetApp.getUi().alert("Resumo do Dia","Vencem hoje: "+vh+" (R$ "+tvh.toFixed(2)+")\nAtrasadas: "+at+" (R$ "+tat.toFixed(2)+")\nRecebido hoje: R$ "+rec.toFixed(2)+"\nReceita extra (atraso): R$ "+extra.toFixed(2),SpreadsheetApp.getUi().ButtonSet.OK);
}

function diagnosticarColunas() {
  var ss=SpreadsheetApp.getActiveSpreadsheet();
  var msg="";
  [ABAS.CLIENTES,ABAS.CONTRATOS,ABAS.PARCELAS,ABAS.PAGAMENTOS,ABAS.EVENTOS,ABAS.PROMESSAS,ABAS.ACORDOS].forEach(function(n){
    var a=ss.getSheetByName(n);
    if(!a){msg+=n+": NAO ENCONTRADA\n\n";return;}
    var h=a.getRange(1,1,1,a.getLastColumn()).getValues()[0];
    msg+="=== "+n+" ("+h.length+" cols) ===\n";
    h.forEach(function(hh,i){msg+="Col "+(i+1)+": "+hh+"\n";});
    msg+="\n";
  });
  Logger.log(msg);
  SpreadsheetApp.getUi().alert(msg.substring(0,1500));
}

// ─── GERAÇÃO DE DOCUMENTO DE CONTRATO ───────────────────────────
function _extInt(n) {
  n = Math.floor(n);
  if (n === 0) return "zero";
  var u = ["","um","dois","três","quatro","cinco","seis","sete","oito","nove",
           "dez","onze","doze","treze","quatorze","quinze","dezesseis","dezessete","dezoito","dezenove"];
  var d = ["","","vinte","trinta","quarenta","cinquenta","sessenta","setenta","oitenta","noventa"];
  var c = ["","cem","duzentos","trezentos","quatrocentos","quinhentos","seiscentos","setecentos","oitocentos","novecentos"];
  if (n < 20)  return u[n];
  if (n < 100) return d[Math.floor(n/10)] + (n%10 ? " e " + u[n%10] : "");
  if (n === 100) return "cem";
  if (n < 1000) { var h=Math.floor(n/100),r=n%100; return (r?((h===1?"cento":c[h])+" e "+_extInt(r)):c[h]); }
  if (n < 2000) return "mil" + (n%1000 ? " e " + _extInt(n%1000) : "");
  var mil=Math.floor(n/1000); return _extInt(mil)+" mil"+(n%1000?" e "+_extInt(n%1000):"");
}

function _extMoeda(v) {
  var n=Math.round(parseFloat(v||0)*100); var reais=Math.floor(n/100); var cents=n%100;
  var s=_extInt(reais)+(reais===1?" real":" reais");
  if(cents>0) s+=" e "+_extInt(cents)+(cents===1?" centavo":" centavos");
  return s;
}

function _fNum(v) {
  var n=Math.round(parseFloat(v||0)*100)/100; var s=n.toFixed(2); var p=s.split(".");
  p[0]=p[0].replace(/\B(?=(\d{3})+(?!\d))/g,"."); return p[0]+","+p[1];
}

function gerarDocContrato(idContrato, idCliente, dados) {
  var ss=SpreadsheetApp.getActiveSpreadsheet();
  var abaCli=ss.getSheetByName(ABAS.CLIENTES);
  var cmCli=buildColMap(abaCli);
  var rows=abaCli.getDataRange().getValues();
  var cId=(cmCli["ID_CLIENTE"]||1)-1;
  var rowCli=null;
  for(var i=1;i<rows.length;i++){if(String(rows[i][cId]).trim()===String(idCliente).trim()){rowCli=rows[i];break;}}
  if(!rowCli) throw new Error("Cliente nao encontrado: "+idCliente);

  function gv(col){var idx=cmCli[col];return idx?String(rowCli[idx-1]||"").trim():"";}
  function fD(d){var dt=d instanceof Date?d:new Date(d);if(isNaN(dt.getTime()))return"";return String(dt.getDate()).padStart(2,"0")+"/"+String(dt.getMonth()+1).padStart(2,"0")+"/"+dt.getFullYear();}

  var p=parseFloat(dados.principal||dados.vp||0);
  var n=parseInt(dados.parcelas||dados.np||0);
  var t=parseFloat(dados.taxa||dados.tx||0)/100;
  var total=p+p*t*n;
  var parc=total/n;
  var dtVenc=parseDateLocal(dados.dataVencimento||dados.dtVenc||"");
  var dtEmp=parseDateLocal(dados.dataEmprestimo||dados.dtEmp||"") || new Date();
  var nome=(gv("NOME_CLIENTE")||gv("NOME")).toUpperCase();

  var subs={
    "{{NOME_DEVEDOR}}":          nome,
    "{{NACIONALIDADE}}":         gv("NACIONALIDADE")||"brasileiro(a)",
    "{{ESTADO_CIVIL}}":          gv("ESTADO_CIVIL"),
    "{{PROFISSAO}}":             gv("PROFISSAO"),
    "{{CPF}}":                   gv("CPF"),
    "{{RG}}":                    gv("RG"),
    "{{EMAIL}}":                 gv("EMAIL"),
    "{{TELEFONE}}":              gv("TELEFONE_WPP")||gv("TELEFONE"),
    "{{RUA}}":                   gv("RUA"),
    "{{NUMERO}}":                gv("NUMERO"),
    "{{QUADRA}}":                gv("QUADRA"),
    "{{LOTE}}":                  gv("LOTE"),
    "{{COMPLEMENTO}}":           gv("COMPLEMENTO")||"—",
    "{{SETOR}}":                 gv("SETOR"),
    "{{CIDADE_ESTADO}}":         gv("CIDADE_ESTADO"),
    "{{CEP}}":                   gv("CEP"),
    "{{VALOR_TOTAL}}":           "R$ "+_fNum(total),
    "{{VALOR_EXTENSO}}":         _extMoeda(total),
    "{{QTDE_PARCELAS}}":         String(n),
    "{{QTDE_PARCELAS_EXTENSO}}": _extInt(n),
    "{{VALOR_PARCELA}}":         _fNum(parc),
    "{{VALOR_PARCELA_EXTENSO}}": _extMoeda(parc),
    "{{DATA_PRIMEIRA_PARCELA}}": fD(dtVenc),
    "{{DATA_CONTRATO}}":         fD(dtEmp)
  };

  function escRx(s){return s.replace(/[.*+?^${}()|[\]\\]/g,"\\$&");}

  var template=DriveApp.getFileById(TEMPLATE_CONTRATO_ID);
  var folder=DriveApp.getFolderById(PASTA_CONTRATOS_ID);
  var docName="Contrato "+idContrato+" - "+nome;
  var copy=template.makeCopy(docName,folder);
  var doc=DocumentApp.openById(copy.getId());
  var body=doc.getBody();
  Object.keys(subs).forEach(function(k){body.replaceText(escRx(k),subs[k]);});
  doc.saveAndClose();
  return {docUrl: copy.getUrl(), docId: copy.getId()};
}

function buscarInfoCliente(idCliente) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var aba = ss.getSheetByName(ABAS.CLIENTES);
  var cm = buildColMap(aba);
  var rows = aba.getDataRange().getValues();
  var cId = (cm["ID_CLIENTE"]||1)-1;
  for (var i = 1; i < rows.length; i++) {
    if (String(rows[i][cId]).trim() === String(idCliente).trim()) {
      function gv(col){var idx=cm[col];return idx?String(rows[i][idx-1]||"").trim():"";}
      return {
        nome:     (gv("NOME_CLIENTE")||gv("NOME")).toUpperCase(),
        email:    gv("EMAIL"),
        telefone: gv("TELEFONE_WPP")||gv("TELEFONE")
      };
    }
  }
  throw new Error("Cliente nao encontrado: " + idCliente);
}

function enviarParaZapSign(docId, idContrato, nomeCliente, emailCliente, telefoneCliente) {
  var pdfResp = UrlFetchApp.fetch(
    "https://docs.google.com/document/d/" + docId + "/export?format=pdf",
    {headers: {"Authorization": "Bearer " + ScriptApp.getOAuthToken()}, muteHttpExceptions: true}
  );
  if (pdfResp.getResponseCode() !== 200) throw new Error("Falha ao exportar PDF: " + pdfResp.getResponseCode());

  var pdfBase64 = Utilities.base64Encode(pdfResp.getBlob().getBytes());
  var telLimpo = String(telefoneCliente||"").replace(/\D/g,"");

  var clienteSigner = {
    name: nomeCliente,
    auth_mode: "assinaturaTela",
    require_selfie_photo: true,
    send_automatic_email: true
  };
  if (emailCliente) clienteSigner.email = emailCliente;
  if (telLimpo)     { clienteSigner.phone_country = "55"; clienteSigner.phone_number = telLimpo; }

  var payload = {
    name: "Contrato " + idContrato + " - " + nomeCliente,
    base64_pdf: pdfBase64,
    lang: "pt-br",
    sandbox: false,
    signers: [
      {name: "ALEX MOREIRA BORGES",    email: "alexborges.mx@gmail.com",        auth_mode: "assinaturaTela", send_automatic_email: true},
      clienteSigner,
      {name: "GEOVANNA ALVES BUENO",   email: "geovannaalvesbueno@gmail.com",   auth_mode: "assinaturaTela", send_automatic_email: true},
      {name: "MARIELY MOREIRA BORGES", email: "marielymoreiraborges@gmail.com", auth_mode: "assinaturaTela", send_automatic_email: true}
    ]
  };

  var resp = UrlFetchApp.fetch("https://api.zapsign.com.br/api/v1/docs/", {
    method: "POST",
    contentType: "application/json",
    headers: {"Authorization": "Bearer " + ZAPSIGN_TOKEN},
    payload: JSON.stringify(payload),
    muteHttpExceptions: true
  });

  if (resp.getResponseCode() < 200 || resp.getResponseCode() >= 300) {
    throw new Error("ZapSign " + resp.getResponseCode() + ": " + resp.getContentText().substring(0, 300));
  }

  var data = JSON.parse(resp.getContentText());
  var signers = data.signers || [];
  // index 0 = credor (Alex) — cliente recebe link por email automaticamente
  return signers[0] ? signers[0].sign_url : "";
}

function buscarDadosBoleto(idContrato, idCliente) {
  var ss   = SpreadsheetApp.getActiveSpreadsheet();
  var abaP = ss.getSheetByName(ABAS.PARCELAS);
  var cmP  = buildColMap(abaP);
  var dadosP = abaP.getDataRange().getValues();

  var abaCli = ss.getSheetByName(ABAS.CLIENTES);
  var cmCli  = buildColMap(abaCli);
  var dadosCli = abaCli.getDataRange().getValues();
  var cIdCli = (cmCli["ID_CLIENTE"]||1)-1;
  var nome = ""; var cpf = "";
  for (var i = 1; i < dadosCli.length; i++) {
    if (String(dadosCli[i][cIdCli]).trim() === String(idCliente).trim()) {
      nome = String(dadosCli[i][(cmCli["NOME_CLIENTE"]||(cmCli["NOME"]||2))-1]||"").trim();
      cpf  = String(dadosCli[i][(cmCli["CPF"]||3)-1]||"").replace(/\D/g,"").padStart(11,"0");
      break;
    }
  }

  var parcelas = [];
  for (var j = 1; j < dadosP.length; j++) {
    if (String(dadosP[j][(cmP["ID_CONTRATO"]||2)-1]).trim() !== String(idContrato).trim()) continue;
    var dt = dadosP[j][(cmP["DATA_VENCIMENTO"]||7)-1];
    parcelas.push({
      idParcela:    String(dadosP[j][0]),
      numParcela:   parseInt(dadosP[j][(cmP["NUM_PARCELA"]||5)-1]),
      totalParcelas:parseInt(dadosP[j][(cmP["TOTAL_PARCELAS"]||6)-1]),
      dataVencimento: dt instanceof Date ? dt.toISOString() : String(dt),
      valorParcela: parseFloat(dadosP[j][(cmP["VALOR_PARCELA"]||8)-1])||0
    });
  }

  return { parcelas: parcelas, cliente: { nome: nome, cpf: cpf } };
}

function pagamentoAutomatico(contractNum, numParcela, valor, data, txid, isSJ) {
  // Idempotência via TXID — bloqueia reprocessamento de webhook duplicado ou polling simultâneo
  if (txid) {
    var _chaveTxid = "WEBHOOK_EFI_" + String(txid).trim();
    if (_idem_check(_chaveTxid)) {
      Logger.log("pagamentoAutomatico: TXID já processado — bloqueado. TXID="+txid);
      try { _idem_registrar_tentativa_dupla(_chaveTxid,"WEBHOOK_EFI"); } catch(e_) {}
      return { contratoQuitado: false, idContrato: "", duplicata: true };
    }
  }
  var ss   = SpreadsheetApp.getActiveSpreadsheet();
  var abaP = ss.getSheetByName(ABAS.PARCELAS);
  var cm   = buildColMap(abaP);
  var dados = abaP.getDataRange().getValues();
  var stKey = cm["STATUS"] || cm["STATUS_PAGAMENTO"];
  if (!stKey) throw new Error("Coluna STATUS nao encontrada em PARCELAS");
  var idParcelaEncontrada = null;
  var idContratoEncontrado = null;

  for (var i = 1; i < dados.length; i++) {
    var idC = String(dados[i][(cm["ID_CONTRATO"]||2)-1]);
    var numC = parseInt(idC.replace(/\D/g, ""));
    var numP = parseInt(dados[i][(cm["NUM_PARCELA"]||5)-1]);
    var st   = String(dados[i][stKey-1]).toLowerCase().trim();
    if (numC === parseInt(contractNum) && numP === parseInt(numParcela) && !STATUS_TERMINAL[st]) {
      idParcelaEncontrada = String(dados[i][0]);
      idContratoEncontrado = idC;
      break;
    }
  }

  if (!idParcelaEncontrada) {
    throw new Error("Parcela nao encontrada: contrato#"+contractNum+" parcela#"+numParcela);
  }

  // Converte horario UTC da Efí para data local Brasil (UTC-3) antes de gravar
  var dataLocal = data
    ? Utilities.formatDate(new Date(String(data)), Session.getScriptTimeZone(), "yyyy-MM-dd")
    : Utilities.formatDate(new Date(), Session.getScriptTimeZone(), "yyyy-MM-dd");

  var resultado;
  if (isSJ) {
    registrarPagamentoParcial(idParcelaEncontrada, dataLocal, valor, idContratoEncontrado, numParcela);
    resultado = { contratoQuitado: false, idContrato: idContratoEncontrado, duplicata: false };
  } else {
    resultado = registrarPagamentoAPI(idParcelaEncontrada, dataLocal, valor, "pix");
  }

  // Registrar TXID após processamento bem-sucedido — impede reprocessamento futuro
  if (txid && resultado && !resultado.duplicata) {
    try {
      _idem_reg("WEBHOOK_EFI_"+String(txid).trim(),"WEBHOOK_EFI",{
        idContrato: resultado.idContrato||"", idParcela: idParcelaEncontrada, origem:"webhook_efi"
      });
    } catch(eIdR) { Logger.log("idem_reg err: "+eIdR.message); }
  }

  return resultado;
}

// ─── EFI Bank: garante colunas e salva dados de cobrança por parcela ───────

function _garantirColunasEfiParcelas() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sh = ss.getSheetByName("PARCELAS");
  if (!sh) return;
  var lastCol = sh.getLastColumn();
  var headers = sh.getRange(1, 1, 1, lastCol).getValues()[0].map(function(v){ return String(v||"").trim(); });
  var colunas = ["EFI_TXID", "EFI_PIX_CODE", "EFI_LINK", "EFI_STATUS"];
  colunas.forEach(function(col) {
    if (headers.indexOf(col) === -1) {
      sh.getRange(1, sh.getLastColumn() + 1).setValue(col);
    }
  });
}

function salvarCobrancasEfi(dados) {
  var cobracas = dados.cobracas || [];
  if (!cobracas.length) return { ok: false, erro: "Nenhuma cobranca" };

  _garantirColunasEfiParcelas();

  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sh = ss.getSheetByName("PARCELAS");
  var cm = buildColMap(sh);
  var rows = sh.getDataRange().getValues();

  var salvos = 0;
  for (var i = 1; i < rows.length; i++) {
    var idParcela = String(rows[i][(cm["ID_PARCELA"] || 1) - 1] || "");
    for (var j = 0; j < cobracas.length; j++) {
      var c = cobracas[j];
      if (String(c.idParcela) === idParcela && c.ok) {
        setCel(sh, i + 1, cm, "EFI_TXID",     c.txid            || "");
        setCel(sh, i + 1, cm, "EFI_PIX_CODE", c.pixCopiaECola   || "");
        setCel(sh, i + 1, cm, "EFI_LINK",     c.location         || "");
        setCel(sh, i + 1, cm, "EFI_STATUS",   "ativo");
        salvos++;
        break;
      }
    }
  }

  return { ok: true, salvos: salvos };
}

// ─── Polling de pagamentos Efí Bank (roda na rotina diária) ──────────────────

function verificarPagamentosEfi() {
  var ss  = SpreadsheetApp.getActiveSpreadsheet();
  var sh  = ss.getSheetByName("PARCELAS");
  if (!sh || sh.getLastRow() <= 1) return;

  var cm    = buildColMap(sh);
  var stCol = cm["STATUS"] || cm["STATUS_PAGAMENTO"];
  var txCol = cm["EFI_TXID"];
  var esCol = cm["EFI_STATUS"];

  if (!txCol) { Logger.log("verificarPagamentosEfi: EFI_TXID nao encontrada"); return; }

  var rows = sh.getDataRange().getValues();
  var pendentes = [];

  for (var i = 1; i < rows.length; i++) {
    var txid  = String(rows[i][txCol - 1] || "").trim();
    var stPar = stCol ? String(rows[i][stCol - 1] || "").toLowerCase().trim() : "";
    var efiSt = esCol ? String(rows[i][esCol - 1] || "").toLowerCase().trim() : "";

    if (!txid) continue;
    if (!!STATUS_TERMINAL[stPar]) continue;
    if (efiSt === "pago") continue;

    var contractNum, parcelaNum, isSJ = false;
    if (txid.startsWith("FOPSJ") && txid.length === 26) {
      contractNum = parseInt(txid.slice(5, 19));
      parcelaNum  = parseInt(txid.slice(20, 26));
      isSJ = true;
    } else if (txid.startsWith("FOP") && txid.length >= 26) {
      contractNum = parseInt(txid.slice(3, 19));
      parcelaNum  = parseInt(txid.slice(20, 26));
    } else {
      continue;
    }
    if (isNaN(contractNum) || isNaN(parcelaNum)) continue;

    pendentes.push({
      txid: txid, idParcela: String(rows[i][(cm["ID_PARCELA"] || 1) - 1] || ""),
      contractNum: contractNum, parcelaNum: parcelaNum, row: i + 1, isSJ: isSJ
    });
  }

  // FOQT — quitações antecipadas com pagamento pendente de registro
  var pendentesQ = [];
  var abaQ = ss.getSheetByName(ABAS.QUITACOES);
  if (abaQ && abaQ.getLastRow() > 1) {
    var cmQ    = buildColMap(abaQ);
    var dadosQ = abaQ.getDataRange().getValues();
    var cQTxid = cmQ["TXID"]   ? cmQ["TXID"]-1   : -1;
    var cQSt   = cmQ["STATUS"] ? cmQ["STATUS"]-1  : -1;
    if (cQTxid >= 0 && cQSt >= 0) {
      for (var qi = 1; qi < dadosQ.length; qi++) {
        var txidQ = String(dadosQ[qi][cQTxid] || "").trim();
        var stQ   = String(dadosQ[qi][cQSt]   || "").trim().toUpperCase();
        if (!txidQ || !txidQ.startsWith("FOQT") || stQ !== "PENDENTE") continue;
        pendentesQ.push({ txid: txidQ });
      }
    }
  }

  var totalPend = pendentes.length + pendentesQ.length;
  if (!totalPend) { Logger.log("verificarPagamentosEfi: nenhuma parcela pendente"); return; }
  Logger.log("verificarPagamentosEfi: consultando " + totalPend + " parcelas no Efi");

  var allTxids = pendentes.map(function(p){ return { txid: p.txid, idParcela: p.idParcela }; })
    .concat(pendentesQ.map(function(p){ return { txid: p.txid, idParcela: "" }; }));

  var _checkSecret = _getCfg("COBRANCA_SECRET");
  var resp = UrlFetchApp.fetch("https://financeiroop.vercel.app/api/efi-check-payments", {
    method: "post",
    contentType: "application/json",
    headers: _checkSecret ? { "x-cobranca-secret": _checkSecret } : {},
    payload: JSON.stringify({ txids: allTxids }),
    muteHttpExceptions: true
  });

  var data = JSON.parse(resp.getContentText());
  if (!data.ok) { Logger.log("verificarPagamentosEfi: erro API - " + resp.getContentText()); return; }

  var pagos = 0, erros = 0, ativos = 0;
  (data.cobv || []).forEach(function(cobv) {
    if (cobv.status === "ERRO") { erros++; Logger.log("verificarPagamentosEfi: ERRO " + cobv.txid + ": " + (cobv.erro||"")); return; }
    if (!cobv.concluida) { ativos++; Logger.log("verificarPagamentosEfi: " + cobv.txid + " status=" + cobv.status); return; }

    // Quitação antecipada (FOQT)
    if (String(cobv.txid || "").startsWith("FOQT")) {
      try {
        var rQ = pagamentoQuitacaoWebhook(cobv.txid, cobv.valor, cobv.horario);
        if (rQ && !rQ.erro && !rQ.naoEncontrada && !rQ.duplicata) {
          pagos++;
          Logger.log("verificarPagamentosEfi: quitacao registrada - " + cobv.txid);
        } else {
          Logger.log("verificarPagamentosEfi: quitacao nao registrada - " + cobv.txid + " " + JSON.stringify(rQ));
        }
      } catch(eQ) {
        erros++;
        Logger.log("verificarPagamentosEfi: erro quitacao " + cobv.txid + ": " + eQ.message);
      }
      return;
    }

    // FOP / FOPSJ
    var p = pendentes.filter(function(x){ return x.txid === cobv.txid; })[0];
    if (!p) return;
    try {
      pagamentoAutomatico(p.contractNum, p.parcelaNum, cobv.valor, cobv.horario, cobv.txid, p.isSJ);
      if (esCol) sh.getRange(p.row, esCol).setValue("pago");
      pagos++;
      Logger.log("verificarPagamentosEfi: registrado - " + cobv.txid + " R$" + cobv.valor);
    } catch(e) {
      erros++;
      Logger.log("verificarPagamentosEfi: erro ao registrar " + cobv.txid + ": " + e.message);
    }
  });

  Logger.log("verificarPagamentosEfi: " + pagos + " pagos / " + ativos + " ativos / " + erros + " erros / " + totalPend + " total");
}

// ═══════════════════════════════════════════════════════════════════════════
// AUDITORIA DE DADOS — FASE 1 (inventário) + FASE 2 (anomalias)
// Produz a aba AUDITORIA com relatório completo. Não altera nenhum dado.
// ═══════════════════════════════════════════════════════════════════════════

function auditarDados() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();

  // ── Setup da aba de saída ──────────────────────────────────────────────
  var abaAud = ss.getSheetByName("AUDITORIA");
  if (abaAud) { ss.deleteSheet(abaAud); Utilities.sleep(300); }
  abaAud = ss.insertSheet("AUDITORIA");

  var LINHAS   = [];
  var RESUMO   = [];
  var ALERTAS  = 0;
  var AVISOS   = 0;

  function titulo(t) {
    LINHAS.push(["", "", "", "", ""]);
    LINHAS.push(["▶ " + t, "", "", "", ""]);
    LINHAS.push(["ABA", "COLUNA", "VALOR_ENCONTRADO", "QTDE", "OBSERVAÇÃO"]);
  }
  function lin(aba, col, val, qtde, obs) { LINHAS.push([aba||"", col||"", String(val||""), String(qtde||""), obs||""]); }
  function alerta(msg) { ALERTAS++; RESUMO.push("⛔ " + msg); }
  function aviso(msg)  { AVISOS++;  RESUMO.push("⚠️ " + msg); }

  // ── Colunas-chave a inventariar em detalhe ─────────────────────────────
  var COLS_CHAVE = {
    CONTRATOS:  ["STATUS_CONTRATO", "STATUS_CARTEIRA"],
    PARCELAS:   ["STATUS", "STATUS_PAGAMENTO", "TIPO_PAGAMENTO", "ORIGEM_PARCELA"],
    PAGAMENTOS: ["TIPO_PAGAMENTO", "FORMA_PAGAMENTO"]
  };

  // ── Leitura das abas ───────────────────────────────────────────────────
  var dadosC = null, dadosP = null, dadosPag = null;
  var cmC = {}, cmP = {}, cmPag = {};
  var setContratos = {}, setParcelas = {};

  var ABAS_ALVO = ["CONTRATOS", "PARCELAS", "PAGAMENTOS"];
  ABAS_ALVO.forEach(function(nomeAba) {
    var aba = ss.getSheetByName(nomeAba);
    if (!aba || aba.getLastRow() <= 1) {
      alerta(nomeAba + ": aba não encontrada ou vazia");
      return;
    }
    var dados   = aba.getDataRange().getValues();
    var headers = dados[0].map(function(h) { return String(h || "").trim(); });
    var nReg    = dados.length - 1;

    if (nomeAba === "CONTRATOS")  { dadosC   = dados; cmC   = buildColMap(aba); }
    if (nomeAba === "PARCELAS")   { dadosP   = dados; cmP   = buildColMap(aba); }
    if (nomeAba === "PAGAMENTOS") { dadosPag = dados; cmPag = buildColMap(aba); }

    // ── FASE 1: INVENTÁRIO ──────────────────────────────────────────────
    titulo("FASE 1 — INVENTÁRIO: " + nomeAba + " (" + nReg + " registros, " + headers.length + " colunas)");

    // Verificar dual STATUS/STATUS_PAGAMENTO em PARCELAS
    if (nomeAba === "PARCELAS" && cmP["STATUS"] && cmP["STATUS_PAGAMENTO"]) {
      aviso("PARCELAS: colunas STATUS e STATUS_PAGAMENTO coexistem — verificar qual está sendo usada");
      lin("PARCELAS", "STATUS+STATUS_PAGAMENTO", "ambas existem", "", "⚠️ Coluna duplicada — risco de leitura errada");
    }

    headers.forEach(function(col, ci) {
      if (!col) return;
      var isChave = (COLS_CHAVE[nomeAba] || []).indexOf(col) >= 0;
      var counts  = {};
      var vazio   = 0;

      for (var i = 1; i < dados.length; i++) {
        var raw = dados[i][ci];
        var v   = (raw === null || raw === undefined || raw === "")
                  ? "" : (raw instanceof Date ? "DATA" : String(raw).trim());
        if (v === "") vazio++;
        else counts[v] = (counts[v] || 0) + 1;
      }

      var preenchidos = nReg - vazio;
      var pctVazio    = nReg > 0 ? Math.round(vazio / nReg * 100) : 0;

      // Indexar IDs para cross-reference
      if (col === "ID_CONTRATO" && nomeAba === "CONTRATOS") {
        for (var ix = 1; ix < dados.length; ix++) {
          var id = String(dados[ix][ci] || "").trim();
          if (id) setContratos[id] = true;
        }
      }
      if (col === "ID_PARCELA" && nomeAba === "PARCELAS") {
        for (var iy = 1; iy < dados.length; iy++) {
          var idP = String(dados[iy][ci] || "").trim();
          if (idP) setParcelas[idP] = true;
        }
      }

      if (!isChave) {
        // Não-chave: só resumo
        var obsR = vazio > 0
          ? (pctVazio >= 50 ? "⛔ " : "⚠️ ") + pctVazio + "% vazio (" + vazio + "/" + nReg + ")"
          : "✅ completo";
        if (pctVazio >= 50) alerta(nomeAba + " / " + col + ": " + pctVazio + "% dos registros está vazio");
        lin(nomeAba, col, preenchidos + " preenchidos", nReg, obsR);
        return;
      }

      // Colunas-chave: listar todos os valores distintos
      var sorted = Object.keys(counts).sort(function(a, b) { return counts[b] - counts[a]; });
      sorted.forEach(function(v) {
        var obs = [];
        if (v !== v.toLowerCase().trim()) obs.push("⚠️ não é lowercase_snake_case");
        if (v !== v.trim())               obs.push("⚠️ espaço extra no início/fim");
        if (/\s/.test(v) && v.indexOf("_") < 0) obs.push("⚠️ espaço ao invés de underscore?");
        lin(nomeAba, col, v, counts[v], obs.join(" | "));
      });
      if (vazio > 0) {
        var obsV = "⚠️ " + vazio + " vazio(s) — campo obrigatório";
        if (vazio > nReg * 0.1) { obsV = "⛔ " + vazio + " vazio(s) (" + pctVazio + "%)"; alerta(nomeAba + " / " + col + ": " + vazio + " registros sem valor"); }
        lin(nomeAba, col, "(vazio)", vazio, obsV);
      }
    });
  });

  // ── FASE 2A: IDs ÓRFÃOS ───────────────────────────────────────────────
  titulo("FASE 2A — IDs ÓRFÃOS");

  if (dadosPag && dadosC && dadosP) {
    var cPagIC = cmPag["ID_CONTRATO"] ? cmPag["ID_CONTRATO"] - 1 : -1;
    var cPagIP = cmPag["ID_PARCELA"]  ? cmPag["ID_PARCELA"]  - 1 : -1;
    var cPagID = cmPag["ID_PAGAMENTO"]? cmPag["ID_PAGAMENTO"]- 1 : 0;
    var orfC = 0, orfP = 0;

    for (var i = 1; i < dadosPag.length; i++) {
      if (cPagIC >= 0) {
        var idC = String(dadosPag[i][cPagIC] || "").trim();
        if (idC && !setContratos[idC]) {
          orfC++;
          if (orfC <= 10) lin("PAGAMENTOS", "ID_CONTRATO", idC, String(dadosPag[i][cPagID] || i), "⛔ ID_CONTRATO não existe em CONTRATOS");
        }
      }
      if (cPagIP >= 0) {
        var idP2 = String(dadosPag[i][cPagIP] || "").trim();
        if (idP2 && !setParcelas[idP2]) {
          orfP++;
          if (orfP <= 10) lin("PAGAMENTOS", "ID_PARCELA", idP2, String(dadosPag[i][cPagID] || i), "⛔ ID_PARCELA não existe em PARCELAS");
        }
      }
    }
    if (orfC > 10) lin("PAGAMENTOS", "ID_CONTRATO", "..." + (orfC - 10) + " omitidos", "", "⛔");
    if (orfP > 10) lin("PAGAMENTOS", "ID_PARCELA",  "..." + (orfP - 10) + " omitidos", "", "⛔");
    if (orfC > 0) alerta("PAGAMENTOS: " + orfC + " registros com ID_CONTRATO inexistente em CONTRATOS");
    if (orfP > 0) alerta("PAGAMENTOS: " + orfP + " registros com ID_PARCELA inexistente em PARCELAS");
    if (orfC === 0 && orfP === 0) lin("PAGAMENTOS", "IDs cruzados", "OK — sem órfãos", "", "✅");

    // Parcelas com ID_CONTRATO inexistente
    var cPIC = (cmP["ID_CONTRATO"] || 2) - 1;
    var cPId = (cmP["ID_PARCELA"]  || 1) - 1;
    var orfPC = 0;
    for (var pi = 1; pi < dadosP.length; pi++) {
      var idCt = String(dadosP[pi][cPIC] || "").trim();
      if (idCt && !setContratos[idCt]) {
        orfPC++;
        if (orfPC <= 10) lin("PARCELAS", "ID_CONTRATO", idCt, String(dadosP[pi][cPId] || pi), "⛔ contrato inexistente em CONTRATOS");
      }
    }
    if (orfPC > 10) lin("PARCELAS", "ID_CONTRATO", "..." + (orfPC - 10) + " omitidos", "", "⛔");
    if (orfPC > 0) alerta("PARCELAS: " + orfPC + " parcelas com ID_CONTRATO inexistente");
    if (orfPC === 0) lin("PARCELAS", "ID_CONTRATO cruzado", "OK — sem órfãos", "", "✅");
  }

  // ── FASE 2B: STATUS × PAGAMENTO ──────────────────────────────────────
  titulo("FASE 2B — INCONSISTÊNCIA STATUS × PAGAMENTO");

  if (dadosP && dadosPag) {
    var cPSt   = (cmP["STATUS"] || cmP["STATUS_PAGAMENTO"] || 11) - 1;
    var cPDPag = cmP["DATA_PAGAMENTO"] ? cmP["DATA_PAGAMENTO"] - 1 : -1;
    var cPVPag = cmP["VALOR_PAGO"]     ? cmP["VALOR_PAGO"]     - 1 : -1;
    var cPId2  = (cmP["ID_PARCELA"]    || 1) - 1;

    // Mapa: quais parcelas têm registro em PAGAMENTOS
    var pagPorParcela = {};
    if (cmPag["ID_PARCELA"]) {
      var cPagIPb = cmPag["ID_PARCELA"] - 1;
      for (var jp = 1; jp < dadosPag.length; jp++) {
        var idPb = String(dadosPag[jp][cPagIPb] || "").trim();
        if (idPb) pagPorParcela[idPb] = (pagPorParcela[idPb] || 0) + 1;
      }
    }

    var pagoSemReg = 0, abertoComData = 0, pagoValorZero = 0, dupPag = 0;

    for (var pi2 = 1; pi2 < dadosP.length; pi2++) {
      var st    = String(dadosP[pi2][cPSt] || "").toLowerCase().trim();
      var idPa  = String(dadosP[pi2][cPId2] || "").trim();
      var dtPag = cPDPag >= 0 ? dadosP[pi2][cPDPag] : null;
      var vlPag = cPVPag >= 0 ? parseFloat(dadosP[pi2][cPVPag] || 0) || 0 : 0;
      var nPag  = pagPorParcela[idPa] || 0;

      if ((st === "pago" || st === "quitacao_antecipada") && nPag === 0) {
        pagoSemReg++;
        if (pagoSemReg <= 10) lin("PARCELAS", "STATUS", st, idPa, "⛔ paga mas sem registro em PAGAMENTOS");
      }
      if ((st === "pendente" || st === "atrasado") && dtPag && dtPag instanceof Date && !isNaN(dtPag.getTime())) {
        abertoComData++;
        if (abertoComData <= 10) lin("PARCELAS", "STATUS", st, idPa, "⚠️ status aberto mas DATA_PAGAMENTO preenchida");
      }
      if ((st === "pago" || st === "quitacao_antecipada") && vlPag === 0) {
        pagoValorZero++;
        if (pagoValorZero <= 10) lin("PARCELAS", "VALOR_PAGO", "0", idPa, "⚠️ parcela paga com VALOR_PAGO = 0");
      }
      if (nPag > 1) {
        dupPag++;
        if (dupPag <= 10) lin("PAGAMENTOS", "ID_PARCELA", idPa, nPag, "⚠️ " + nPag + " registros de pagamento para mesma parcela");
      }
    }

    if (pagoSemReg   > 10) lin("PARCELAS","STATUS","..." + (pagoSemReg-10)+" omitidos","","⛔");
    if (abertoComData> 10) lin("PARCELAS","STATUS","..." + (abertoComData-10)+" omitidos","","⚠️");
    if (pagoValorZero> 10) lin("PARCELAS","VALOR_PAGO","..." + (pagoValorZero-10)+" omitidos","","⚠️");
    if (dupPag       > 10) lin("PAGAMENTOS","ID_PARCELA","..." + (dupPag-10)+" omitidos","","⚠️");

    if (pagoSemReg    > 0) alerta("PARCELAS: " + pagoSemReg + " parcelas 'pago' sem registro em PAGAMENTOS");
    if (abertoComData > 0) aviso("PARCELAS: " + abertoComData + " parcelas abertas com DATA_PAGAMENTO preenchida");
    if (pagoValorZero > 0) aviso("PARCELAS: " + pagoValorZero + " parcelas pagas com VALOR_PAGO = 0");
    if (dupPag        > 0) aviso("PAGAMENTOS: " + dupPag + " parcelas com múltiplos registros de pagamento");

    if (pagoSemReg + abertoComData + pagoValorZero + dupPag === 0)
      lin("PARCELAS/PAGAMENTOS", "Cruzamento status×pagamento", "OK", "", "✅");
  }

  // ── FASE 2C: INCONSISTÊNCIAS DE DATAS ─────────────────────────────────
  titulo("FASE 2C — INCONSISTÊNCIAS DE DATAS");

  if (dadosP && dadosC) {
    var cCDEmp = cmC["DATA_EMPRESTIMO"]     ? cmC["DATA_EMPRESTIMO"]     - 1 : 3;
    var cCID2  = (cmC["ID_CONTRATO"]        || 1) - 1;
    var cPDV   = (cmP["DATA_VENCIMENTO"]    || 7) - 1;
    var cPDPg  = cmP["DATA_PAGAMENTO"]      ? cmP["DATA_PAGAMENTO"]      - 1 : -1;
    var cPIC4  = (cmP["ID_CONTRATO"]        || 2) - 1;
    var cPId3  = (cmP["ID_PARCELA"]         || 1) - 1;

    var dtConts = {};
    for (var ci2 = 1; ci2 < dadosC.length; ci2++) {
      var idC2 = String(dadosC[ci2][cCID2] || "").trim();
      var dtE  = dadosC[ci2][cCDEmp];
      if (idC2 && dtE instanceof Date && !isNaN(dtE.getTime())) dtConts[idC2] = dtE;
    }

    var vencAntes = 0, pagAntes = 0;
    for (var pi3 = 1; pi3 < dadosP.length; pi3++) {
      var idCt2  = String(dadosP[pi3][cPIC4] || "").trim();
      var dtVenc = dadosP[pi3][cPDV];
      var dtPg2  = cPDPg >= 0 ? dadosP[pi3][cPDPg] : null;
      var idPa3  = String(dadosP[pi3][cPId3] || "").trim();
      var dtBase = dtConts[idCt2];
      if (!dtBase) continue;
      dtBase = new Date(dtBase.getFullYear(), dtBase.getMonth(), dtBase.getDate());

      if (dtVenc instanceof Date && !isNaN(dtVenc.getTime())) {
        var dv = new Date(dtVenc.getFullYear(), dtVenc.getMonth(), dtVenc.getDate());
        if (dv < dtBase) {
          vencAntes++;
          if (vencAntes <= 10) lin("PARCELAS", "DATA_VENCIMENTO", dtVenc.toLocaleDateString("pt-BR"), idPa3, "⚠️ vencimento anterior à data do contrato");
        }
      }
      if (dtPg2 instanceof Date && !isNaN(dtPg2.getTime())) {
        var dp = new Date(dtPg2.getFullYear(), dtPg2.getMonth(), dtPg2.getDate());
        if (dp < dtBase) {
          pagAntes++;
          if (pagAntes <= 10) lin("PARCELAS", "DATA_PAGAMENTO", dtPg2.toLocaleDateString("pt-BR"), idPa3, "⛔ pagamento anterior à data do contrato");
        }
      }
    }

    if (vencAntes > 10) lin("PARCELAS","DATA_VENCIMENTO","..."+(vencAntes-10)+" omitidos","","⚠️");
    if (pagAntes  > 10) lin("PARCELAS","DATA_PAGAMENTO", "..."+(pagAntes-10)+" omitidos", "","⛔");
    if (vencAntes  > 0) aviso("PARCELAS: " + vencAntes + " com vencimento anterior ao contrato");
    if (pagAntes   > 0) alerta("PARCELAS: " + pagAntes + " com pagamento anterior à data do contrato");
    if (vencAntes + pagAntes === 0) lin("PARCELAS", "Datas", "OK — sem inconsistências", "", "✅");
  }

  // ── FASE 2D: TOTAL_PARCELAS vs CONTAGEM REAL ──────────────────────────
  titulo("FASE 2D — TOTAL_PARCELAS vs CONTAGEM REAL");

  if (dadosP) {
    var cPNP   = cmP["NUM_PARCELA"]    ? cmP["NUM_PARCELA"]    - 1 : 4;
    var cPTP   = cmP["TOTAL_PARCELAS"] ? cmP["TOTAL_PARCELAS"] - 1 : 5;
    var cPIC5  = (cmP["ID_CONTRATO"]   || 2) - 1;
    var cPId4  = (cmP["ID_PARCELA"]    || 1) - 1;

    var realCount = {}, tpPorContrato = {};
    for (var pi4 = 1; pi4 < dadosP.length; pi4++) {
      var idCt3 = String(dadosP[pi4][cPIC5] || "").trim();
      var tp    = parseInt(dadosP[pi4][cPTP] || 0) || 0;
      if (!idCt3) continue;
      realCount[idCt3]     = (realCount[idCt3] || 0) + 1;
      tpPorContrato[idCt3] = tp;
    }

    var tpErro = 0;
    Object.keys(realCount).forEach(function(idCt3) {
      var tp   = tpPorContrato[idCt3] || 0;
      var real = realCount[idCt3]     || 0;
      if (tp > 0 && tp !== real) {
        tpErro++;
        if (tpErro <= 10) lin("PARCELAS", "TOTAL_PARCELAS", "declarado: " + tp + "  real: " + real, idCt3, "⚠️ divergência");
      }
    });

    if (tpErro > 10) lin("PARCELAS","TOTAL_PARCELAS","..."+(tpErro-10)+" omitidos","","⚠️");
    if (tpErro  > 0) aviso("PARCELAS: " + tpErro + " contratos com TOTAL_PARCELAS incorreto");
    if (tpErro === 0) lin("PARCELAS", "TOTAL_PARCELAS", "OK", "", "✅");
  }

  // ── FASE 2E: VALORES NUMÉRICOS SUSPEITOS ─────────────────────────────
  titulo("FASE 2E — VALORES NUMÉRICOS SUSPEITOS");

  if (dadosC) {
    var cCVP2 = cmC["VALOR_PRINCIPAL"] ? cmC["VALOR_PRINCIPAL"] - 1 : 5;
    var cCID3 = (cmC["ID_CONTRATO"]    || 1) - 1;
    var cCTX  = cmC["TAXA_JUROS_MENSAL"] ? cmC["TAXA_JUROS_MENSAL"] - 1 : 7;
    var cCNP  = cmC["NUM_PARCELAS"]      ? cmC["NUM_PARCELAS"]      - 1 : 6;
    var vpZero = 0, txZero = 0, npZero = 0;

    for (var ci3 = 1; ci3 < dadosC.length; ci3++) {
      var vp  = parseFloat(dadosC[ci3][cCVP2] || 0) || 0;
      var tx  = parseFloat(dadosC[ci3][cCTX]  || 0) || 0;
      var np  = parseInt(dadosC[ci3][cCNP]    || 0) || 0;
      var idC3 = String(dadosC[ci3][cCID3] || ci3).trim();
      if (vp <= 0) { vpZero++; if (vpZero <= 5) lin("CONTRATOS", "VALOR_PRINCIPAL", "0 ou vazio", idC3, "⛔ contrato sem valor principal"); }
      if (tx <= 0) { txZero++; if (txZero <= 5) lin("CONTRATOS", "TAXA_JUROS_MENSAL", "0 ou vazio", idC3, "⚠️ taxa zerada"); }
      if (np <= 0) { npZero++; if (npZero <= 5) lin("CONTRATOS", "NUM_PARCELAS", "0 ou vazio", idC3, "⛔ sem número de parcelas"); }
    }
    if (vpZero > 5) lin("CONTRATOS","VALOR_PRINCIPAL","..."+(vpZero-5)+" omitidos","","⛔");
    if (txZero > 5) lin("CONTRATOS","TAXA_JUROS_MENSAL","..."+(txZero-5)+" omitidos","","⚠️");
    if (npZero > 5) lin("CONTRATOS","NUM_PARCELAS","..."+(npZero-5)+" omitidos","","⛔");
    if (vpZero > 0) alerta("CONTRATOS: " + vpZero + " contratos sem VALOR_PRINCIPAL");
    if (txZero > 0) aviso("CONTRATOS: "  + txZero + " contratos com taxa zerada");
    if (npZero > 0) alerta("CONTRATOS: " + npZero + " contratos sem NUM_PARCELAS");
    if (vpZero + txZero + npZero === 0) lin("CONTRATOS", "Valores numéricos", "OK", "", "✅");
  }

  // ── FASE 2F: COLUNAS ADICIONADAS DEPOIS (nulos históricos) ───────────
  titulo("FASE 2F — COLUNAS ADICIONADAS DEPOIS (% de nulos em campos críticos)");

  var CAMPOS_CRITICOS = {
    PARCELAS:   ["DIAS_ATRASO","DIAS_ANTECIPACAO","VALOR_RECEBIDO","DESCONTO_APLICADO","TIPO_PAGAMENTO","ORIGEM_PARCELA"],
    PAGAMENTOS: ["VALOR_ORIGINAL_PARCELA","DIFERENCA_RECEBIDA","RECEITA_EXTRA_ATRASO"],
    CONTRATOS:  ["STATUS_CARTEIRA","PARCELA_PRINCIPAL","PARCELA_JUROS","JUROS_TOTAL","VALOR_TOTAL","LTV_CLIENTE","LUCRO_TOTAL","ROI_CLIENTE"]
  };

  Object.keys(CAMPOS_CRITICOS).forEach(function(nomeAba) {
    var dadosAba = nomeAba === "CONTRATOS" ? dadosC : (nomeAba === "PARCELAS" ? dadosP : dadosPag);
    var cmAba    = nomeAba === "CONTRATOS" ? cmC    : (nomeAba === "PARCELAS" ? cmP    : cmPag);
    if (!dadosAba) return;
    var nReg = dadosAba.length - 1;

    CAMPOS_CRITICOS[nomeAba].forEach(function(col) {
      if (!cmAba[col]) {
        lin(nomeAba, col, "COLUNA NÃO EXISTE", "", "⛔ coluna ausente no sheet");
        alerta(nomeAba + " / " + col + ": coluna não existe no Sheets");
        return;
      }
      var ci4  = cmAba[col] - 1;
      var vazio = 0;
      for (var i = 1; i < dadosAba.length; i++) {
        var v = dadosAba[i][ci4];
        if (v === null || v === undefined || v === "" || v === 0) vazio++;
      }
      var pct = nReg > 0 ? Math.round(vazio / nReg * 100) : 0;
      var obs = pct >= 80 ? "⛔ " + pct + "% vazio — coluna adicionada depois?" :
                pct >= 30 ? "⚠️ " + pct + "% vazio — verificar histórico" :
                "✅ " + pct + "% vazio";
      lin(nomeAba, col, vazio + " vazios de " + nReg, pct + "%", obs);
      if (pct >= 80) aviso(nomeAba + " / " + col + ": " + pct + "% dos registros sem valor");
    });
  });

  // ── RESUMO EXECUTIVO ──────────────────────────────────────────────────
  var cabecalho = [
    ["AUDITORIA DE DADOS — FinanceiroOp", "", "", "", new Date().toLocaleString("pt-BR")],
    ["", "", "", "", ""],
    ["▶ RESUMO EXECUTIVO", "", "", "", ""],
    ["Alertas críticos (⛔): " + ALERTAS + " | Avisos (⚠️): " + AVISOS, "", "", "", ""],
    ["", "", "", "", ""]
  ];
  RESUMO.forEach(function(msg, idx) {
    cabecalho.push(["  " + (idx + 1) + ". " + msg, "", "", "", ""]);
  });
  cabecalho.push(["", "", "", "", ""]);
  cabecalho.push(["─── DETALHES ABAIXO ───", "", "", "", ""]);

  var TODAS = cabecalho.concat(LINHAS);

  // ── Escreve no sheet ──────────────────────────────────────────────────
  if (TODAS.length > 0) {
    abaAud.getRange(1, 1, TODAS.length, 5).setValues(TODAS);
  }

  // Formatação
  abaAud.setColumnWidth(1, 110);
  abaAud.setColumnWidth(2, 230);
  abaAud.setColumnWidth(3, 280);
  abaAud.setColumnWidth(4, 70);
  abaAud.setColumnWidth(5, 400);
  abaAud.getRange(1, 1, 1, 5).setFontWeight("bold").setBackground("#1a1a2e").setFontColor("#ffffff").setFontSize(12);
  abaAud.getRange(3, 1, 1, 5).setFontWeight("bold").setBackground("#2d3a2d").setFontColor("#9fe870").setFontSize(11);
  abaAud.setFrozenRows(1);

  // Destacar linhas com ⛔ e ⚠️
  var allVals = TODAS;
  for (var ri = 1; ri <= allVals.length; ri++) {
    var obs5 = allVals[ri - 1][4] ? String(allVals[ri - 1][4]) : "";
    if (obs5.indexOf("⛔") >= 0)      abaAud.getRange(ri, 1, 1, 5).setBackground("#3a1a1a").setFontColor("#ef6060");
    else if (obs5.indexOf("⚠️") >= 0) abaAud.getRange(ri, 1, 1, 5).setBackground("#3a2e1a").setFontColor("#ffd080");
    else if (obs5.indexOf("✅") >= 0) abaAud.getRange(ri, 1, 1, 5).setFontColor("#70c070");
  }

  ss.setActiveSheet(abaAud);
  SpreadsheetApp.getUi().alert(
    "Auditoria concluída!\n\n" +
    "⛔ Alertas críticos: " + ALERTAS + "\n" +
    "⚠️ Avisos: " + AVISOS + "\n\n" +
    "Veja a aba AUDITORIA para o relatório completo.\n" +
    "Nenhum dado foi alterado."
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// AUDITORIA DE INTEGRIDADE — FASE 1: DETECÇÃO + LOG (sem correção automática)
// Executa via trigger diário e sob demanda. Appenda na aba AUDITORIA.
// Campos: DATA_HORA | SEVERIDADE | TIPO | TABELA | ID_REGISTRO | DESCRICAO | AUTO_CORRIGIDO | DETALHES
// ═══════════════════════════════════════════════════════════════════════════

function _garantirAbaAuditoria() {
  var ss  = SpreadsheetApp.getActiveSpreadsheet();
  var aba = ss.getSheetByName("AUDITORIA");
  if (!aba) {
    aba = ss.insertSheet("AUDITORIA");
    var h = ["DATA_HORA","SEVERIDADE","TIPO","TABELA","ID_REGISTRO","DESCRICAO","AUTO_CORRIGIDO","DETALHES"];
    aba.getRange(1,1,1,h.length).setValues([h]);
    aba.getRange(1,1,1,h.length).setFontWeight("bold").setBackground("#07241B").setFontColor("#A8E040");
    aba.setFrozenRows(1);
    aba.setColumnWidth(1,145); aba.setColumnWidth(2,85);  aba.setColumnWidth(3,130);
    aba.setColumnWidth(4,125); aba.setColumnWidth(5,110); aba.setColumnWidth(6,300);
    aba.setColumnWidth(7,110); aba.setColumnWidth(8,420);
  }
  return aba;
}

function _logAud(abaAud, sev, tipo, tabela, idReg, desc, det) {
  var cm = buildColMap(abaAud);
  var nc = abaAud.getLastColumn();
  var row = new Array(nc).fill("");
  function s(h,v){if(cm[h]&&cm[h]<=nc)row[cm[h]-1]=v;}
  s("DATA_HORA",    new Date());
  s("SEVERIDADE",   sev   || "MEDIO");
  s("TIPO",         tipo  || "");
  s("TABELA",       tabela|| "");
  s("ID_REGISTRO",  String(idReg||""));
  s("DESCRICAO",    String(desc ||""));
  s("AUTO_CORRIGIDO","NAO");
  s("DETALHES",     String(det  ||""));
  var ul = abaAud.getLastRow()+1;
  abaAud.getRange(ul,1,1,nc).setValues([row]);
  if(cm["DATA_HORA"]) abaAud.getRange(ul,cm["DATA_HORA"]).setNumberFormat("dd/mm/yyyy hh:mm:ss");
  var bg = sev==="CRITICO"?"#3a1a1a":sev==="ALTO"?"#2d1f00":sev==="MEDIO"?"#1a2d1a":"#1a1a2d";
  var fc = sev==="CRITICO"?"#ef6060":sev==="ALTO"?"#ffa040":sev==="MEDIO"?"#70c070":"#8080d0";
  abaAud.getRange(ul,1,1,nc).setBackground(bg).setFontColor(fc);
}

function configurarTriggerAuditoria() {
  ScriptApp.getProjectTriggers()
    .filter(function(t){return t.getHandlerFunction()==="auditarIntegridadeSistema";})
    .forEach(function(t){ScriptApp.deleteTrigger(t);});
  ScriptApp.newTrigger("auditarIntegridadeSistema").timeBased().everyDays(1).atHour(7).nearMinute(5).create();
  Logger.log("Trigger auditarIntegridadeSistema configurado para 07:05.");
}

function auditarIntegridadeSistema() {
  var ss     = SpreadsheetApp.getActiveSpreadsheet();
  var abaAud = _garantirAbaAuditoria();

  // Marcador de início de sessão
  var tsInicio = new Date();
  var ulI = abaAud.getLastRow()+1;
  abaAud.getRange(ulI,1,1,8).setValues([[tsInicio,"INFO","SESSAO_INICIO","SISTEMA","",
    "=== AUDITORIA DE INTEGRIDADE "+tsInicio.toLocaleString("pt-BR")+" ===","NAO",""]]);
  abaAud.getRange(ulI,1,1,8).setFontWeight("bold").setBackground("#07241B").setFontColor("#A8E040");

  // ── Carregar dados uma vez ──────────────────────────────────────────────
  var abaCli  = ss.getSheetByName(ABAS.CLIENTES);
  var abaC    = ss.getSheetByName(ABAS.CONTRATOS);
  var abaP    = ss.getSheetByName(ABAS.PARCELAS);
  var abaPag  = ss.getSheetByName(ABAS.PAGAMENTOS);
  var abaProm = ss.getSheetByName(ABAS.PROMESSAS);
  var abaEv   = ss.getSheetByName(ABAS.EVENTOS);

  if (!abaCli||!abaC||!abaP||!abaPag) {
    _logAud(abaAud,"CRITICO","SISTEMA","SISTEMA","","Abas críticas ausentes (CLIENTES/CONTRATOS/PARCELAS/PAGAMENTOS)","Auditoria abortada");
    return;
  }

  var dadosCli  = abaCli.getLastRow()>1  ? abaCli.getDataRange().getValues()  : [[]];
  var dadosC    = abaC.getLastRow()>1    ? abaC.getDataRange().getValues()    : [[]];
  var dadosP    = abaP.getLastRow()>1    ? abaP.getDataRange().getValues()    : [[]];
  var dadosPag  = abaPag.getLastRow()>1  ? abaPag.getDataRange().getValues()  : [[]];
  var dadosProm = abaProm&&abaProm.getLastRow()>1 ? abaProm.getDataRange().getValues() : [[]];
  var dadosEv   = abaEv&&abaEv.getLastRow()>1    ? abaEv.getDataRange().getValues()   : [[]];

  var cmCli = buildColMap(abaCli);
  var cmC   = buildColMap(abaC);
  var cmP   = buildColMap(abaP);
  var cmPag = buildColMap(abaPag);
  var cmProm= abaProm ? buildColMap(abaProm) : {};
  var cmEv  = abaEv  ? buildColMap(abaEv)   : {};

  // ── Índices em memória ───────────────────────────────────────────────────
  var setClientes  = {};
  var setContratos = {};
  var setParcelas  = {};
  var stColP = (cmP["STATUS"]||cmP["STATUS_PAGAMENTO"]||11)-1;

  for (var i=1;i<dadosCli.length;i++) {
    var id=String(dadosCli[i][(cmCli["ID_CLIENTE"]||1)-1]||"").trim();
    if(id) setClientes[id]=i;
  }
  for (var i=1;i<dadosC.length;i++) {
    var id=String(dadosC[i][(cmC["ID_CONTRATO"]||1)-1]||"").trim();
    if(!id) continue;
    setContratos[id]={
      linha:i+1,
      idCliente:String(dadosC[i][(cmC["ID_CLIENTE"]||2)-1]||"").trim(),
      stC:String(dadosC[i][(cmC["STATUS_CONTRATO"]||16)-1]||"").trim().toLowerCase(),
      vPrincipal:parseFloat(dadosC[i][(cmC["VALOR_PRINCIPAL"]||5)-1]||0)||0,
      vTotal:cmC["VALOR_TOTAL"]?parseFloat(dadosC[i][cmC["VALOR_TOTAL"]-1]||0)||0:0,
      jurosTotal:cmC["JUROS_TOTAL"]?parseFloat(dadosC[i][cmC["JUROS_TOTAL"]-1]||0)||0:0
    };
  }
  for (var i=1;i<dadosP.length;i++) {
    var id=String(dadosP[i][0]||"").trim();
    if(!id) continue;
    setParcelas[id]={
      linha:i+1,
      idContrato:String(dadosP[i][(cmP["ID_CONTRATO"]||2)-1]||"").trim(),
      idCliente: String(dadosP[i][(cmP["ID_CLIENTE"] ||3)-1]||"").trim(),
      st:        String(dadosP[i][stColP]||"").trim().toLowerCase(),
      vParcela:  parseFloat(dadosP[i][(cmP["VALOR_PARCELA"] ||8)-1]||0)||0,
      vPrincipal:parseFloat(dadosP[i][(cmP["VALOR_PRINCIPAL"]||9)-1]||0)||0,
      vJuros:    parseFloat(dadosP[i][(cmP["VALOR_JUROS"]   ||10)-1]||0)||0,
      vPago:     parseFloat(dadosP[i][(cmP["VALOR_PAGO"]    ||12)-1]||0)||0,
      dtPag:     dadosP[i][(cmP["DATA_PAGAMENTO"]||13)-1]||null,
      efiTxid:   cmP["EFI_TXID"]?String(dadosP[i][cmP["EFI_TXID"]-1]||"").trim():"",
      origem:    cmP["ORIGEM_PARCELA"]?String(dadosP[i][cmP["ORIGEM_PARCELA"]-1]||"").trim():""
    };
  }

  var cnt = {CRITICO:0,ALTO:0,MEDIO:0,BAIXO:0,total:0};
  function log(sev,tipo,tabela,idReg,desc,det){
    cnt[sev]=(cnt[sev]||0)+1; cnt.total++;
    _logAud(abaAud,sev,tipo,tabela,idReg,desc,det);
  }

  var ST_TERM = STATUS_TERMINAL; // pago|quitacao_antecipada|baixado_como_prejuizo|cancelado|renegociado
  var ST_FINAIS_C = {baixado_como_prejuizo:1,em_recuperacao:1,recuperado_parcialmente:1,
    recuperado_integralmente:1,encerrado_sem_recuperacao:1,cancelado:1,renegociado:1,quitado:1,acordo_assistido:1};

  // ═══ 1. RELACIONAMENTOS ═══════════════════════════════════════════════
  for (var id in setParcelas) {
    var p=setParcelas[id];
    if(p.idContrato && !setContratos[p.idContrato])
      log("CRITICO","RELACIONAMENTO","PARCELAS",id,"Parcela órfã — ID_CONTRATO inexistente em CONTRATOS","ID_CONTRATO="+p.idContrato);
    if(p.idCliente && !setClientes[p.idCliente])
      log("CRITICO","RELACIONAMENTO","PARCELAS",id,"Parcela órfã — ID_CLIENTE inexistente em CLIENTES","ID_CLIENTE="+p.idCliente);
  }

  var cPagIC  = (cmPag["ID_CONTRATO"] ||2)-1;
  var cPagIP  = (cmPag["ID_PARCELA"]  ||3)-1;
  var cPagICl = (cmPag["ID_CLIENTE"]  ||4)-1;
  var cPagID  = (cmPag["ID_PAGAMENTO"]||1)-1;
  var cPagTP  = cmPag["TIPO_PAGAMENTO"] ? cmPag["TIPO_PAGAMENTO"]-1 : -1;
  var cPagVP  = cmPag["VALOR_PAGO"]     ? cmPag["VALOR_PAGO"]-1    : -1;
  var cPagDP  = cmPag["DATA_PAGAMENTO"] ? cmPag["DATA_PAGAMENTO"]-1 : -1;

  for (var i=1;i<dadosPag.length;i++) {
    var idPag  = String(dadosPag[i][cPagID]||"").trim()||("PAG_row"+i);
    var idCPag = String(dadosPag[i][cPagIC]||"").trim();
    var idPPag = String(dadosPag[i][cPagIP]||"").trim();
    var idClPag= String(dadosPag[i][cPagICl]||"").trim();
    var tpPag  = cPagTP>=0?String(dadosPag[i][cPagTP]||"").trim():"";
    if(idCPag && !setContratos[idCPag])
      log("CRITICO","RELACIONAMENTO","PAGAMENTOS",idPag,"Pagamento: ID_CONTRATO inexistente em CONTRATOS","ID_CONTRATO="+idCPag);
    // ID_CLIENTE em PAGAMENTOS: histórico gravou nº de linha em vez do ID real — BAIXO, sem impacto operacional
    if(cmPag["ID_CLIENTE"] && idClPag && !setClientes[idClPag])
      log("BAIXO","RELACIONAMENTO","PAGAMENTOS",idPag,"Pagamento: ID_CLIENTE não encontrado em CLIENTES (dado histórico)","ID_CLIENTE="+idClPag);
    if(idPPag && tpPag!=="abatimento_acordo_assistido") {
      if(!setParcelas[idPPag]) {
        log("ALTO","RELACIONAMENTO","PAGAMENTOS",idPag,"Pagamento: ID_PARCELA inexistente em PARCELAS","ID_PARCELA="+idPPag);
      } else {
        var pRef=setParcelas[idPPag];
        if(cmPag["ID_CLIENTE"] && idClPag && pRef.idCliente && idClPag!==pRef.idCliente)
          log("BAIXO","RELACIONAMENTO","PAGAMENTOS",idPag,"ID_CLIENTE divergente pagamento/parcela (dado histórico)","Pag="+idClPag+" Par="+pRef.idCliente);
        if(idCPag && pRef.idContrato && idCPag!==pRef.idContrato)
          log("CRITICO","RELACIONAMENTO","PAGAMENTOS",idPag,"ID_CONTRATO divergente entre pagamento e parcela","Pag="+idCPag+" Par="+pRef.idContrato);
      }
    }
  }

  // ═══ 2. STATUS DE PARCELAS ════════════════════════════════════════════
  var pagsPorParcela = {};
  for (var i=1;i<dadosPag.length;i++) {
    var idPP = String(dadosPag[i][cPagIP]||"").trim();
    var tpP  = cPagTP>=0?String(dadosPag[i][cPagTP]||"").trim():"";
    if(!idPP||tpP==="abatimento_acordo_assistido") continue;
    if(!pagsPorParcela[idPP]) pagsPorParcela[idPP]=[];
    pagsPorParcela[idPP].push({
      id:  String(dadosPag[i][cPagID]||"").trim(),
      vl:  cPagVP>=0?parseFloat(dadosPag[i][cPagVP]||0)||0:0,
      dt:  cPagDP>=0?dadosPag[i][cPagDP]:null
    });
  }

  for (var id in setParcelas) {
    var p    = setParcelas[id];
    var st   = p.st;
    var nPag = (pagsPorParcela[id]||[]).length;
    var isPago = (st==="pago"||st==="quitacao_antecipada");
    var isAberto=(st==="pendente"||st==="atrasado"||st==="vence_hoje"||st==="reagendado");
    var temDt  = p.dtPag instanceof Date && !isNaN(p.dtPag.getTime());
    var temVl  = p.vPago > 0;

    if(isPago && !temDt)
      log("CRITICO","STATUS_PARCELA","PARCELAS",id,"Parcela paga sem DATA_PAGAMENTO","STATUS="+st);
    if(isPago && !temVl)
      log("CRITICO","STATUS_PARCELA","PARCELAS",id,"Parcela paga com VALOR_PAGO=0 ou vazio","STATUS="+st);
    if(isAberto && temDt)
      log("ALTO","STATUS_PARCELA","PARCELAS",id,"Parcela aberta com DATA_PAGAMENTO preenchida","STATUS="+st);
    if(isAberto && temVl)
      log("ALTO","STATUS_PARCELA","PARCELAS",id,"Parcela aberta com VALOR_PAGO>0","STATUS="+st+" VALOR="+p.vPago);
    if(isPago && nPag===0)
      log("ALTO","STATUS_PARCELA","PARCELAS",id,"Parcela paga sem registro em PAGAMENTOS","STATUS="+st);
    if(isAberto && nPag>0)
      log("ALTO","STATUS_PARCELA","PARCELAS",id,"Parcela aberta com registro em PAGAMENTOS","nPag="+nPag);
    if(nPag>1)
      log("ALTO","DUPLICIDADE","PARCELAS",id,"Parcela com "+nPag+" registros de pagamento (possível duplicata)","nPag="+nPag);

    // Integridade matemática da parcela
    if(p.vParcela<=0 && p.origem!=="gerada_por_pagamento_de_juros")
      log("CRITICO","MATEMATICA","PARCELAS",id,"VALOR_PARCELA=0 ou negativo","VP="+p.vParcela);
    if(p.vPrincipal<0||p.vJuros<0)
      log("CRITICO","MATEMATICA","PARCELAS",id,"VALOR_PRINCIPAL ou VALOR_JUROS negativos","P="+p.vPrincipal+" J="+p.vJuros);
    if(p.vParcela>0&&p.vPrincipal>0) {
      var dif=Math.abs(p.vParcela-(p.vPrincipal+p.vJuros));
      if(dif>0.02)
        log("CRITICO","MATEMATICA","PARCELAS",id,"VALOR_PARCELA ≠ PRINCIPAL+JUROS","VP="+p.vParcela+" P="+p.vPrincipal+" J="+p.vJuros+" dif="+dif.toFixed(4));
    }
  }

  // ═══ 3. STATUS DE CONTRATOS ══════════════════════════════════════════
  var parPorContrato = {};
  for (var id in setParcelas) {
    var p=setParcelas[id];
    if(!p.idContrato) continue;
    if(!parPorContrato[p.idContrato]) parPorContrato[p.idContrato]={ab:0,term:0,tot:0};
    parPorContrato[p.idContrato].tot++;
    if(ST_TERM[p.st]) parPorContrato[p.idContrato].term++;
    else parPorContrato[p.idContrato].ab++;
  }

  for (var id in setContratos) {
    var c  = setContratos[id];
    var pc = parPorContrato[id]||{ab:0,term:0,tot:0};
    if(c.idCliente && !setClientes[c.idCliente])
      log("CRITICO","RELACIONAMENTO","CONTRATOS",id,"Contrato: ID_CLIENTE inexistente em CLIENTES","ID_CLIENTE="+c.idCliente);
    if(c.stC==="quitado" && pc.ab>0)
      log("CRITICO","STATUS_CONTRATO","CONTRATOS",id,"Contrato quitado com "+pc.ab+" parcela(s) aberta(s)","STATUS="+c.stC);
    if(!ST_FINAIS_C[c.stC] && pc.tot>0 && pc.ab===0 && pc.term>0)
      log("ALTO","STATUS_CONTRATO","CONTRATOS",id,"Contrato ativo mas todas as "+pc.term+" parcela(s) em status terminal","STATUS="+c.stC);
    if(c.vPrincipal<=0 && !ST_FINAIS_C[c.stC])
      log("CRITICO","MATEMATICA","CONTRATOS",id,"Contrato ativo sem VALOR_PRINCIPAL","STATUS="+c.stC);
  }

  // ═══ 4. AUDITORIA FINANCEIRA — PAGAMENTOS ════════════════════════════
  var dupKey = {};
  for (var i=1;i<dadosPag.length;i++) {
    var idPag = String(dadosPag[i][cPagID]||"").trim()||("row"+i);
    var vp    = cPagVP>=0?parseFloat(dadosPag[i][cPagVP]||0)||0:0;
    var tpP   = cPagTP>=0?String(dadosPag[i][cPagTP]||"").trim():"";
    if(vp<0)
      log("CRITICO","MATEMATICA","PAGAMENTOS",idPag,"VALOR_PAGO negativo","VALOR="+vp);
    if(vp===0)
      log("MEDIO","MATEMATICA","PAGAMENTOS",idPag,"VALOR_PAGO=0 em pagamento registrado","TIPO="+tpP);
    // Detecção de duplicata: mesma parcela + mesma data + mesmo valor (excl. somente_juros — vários registros são esperados)
    var idPP = String(dadosPag[i][cPagIP]||"").trim();
    if(idPP && tpP!=="abatimento_acordo_assistido" && tpP!=="somente_juros") {
      var dtObj=cPagDP>=0?dadosPag[i][cPagDP]:null;
      var dtStr=dtObj instanceof Date&&!isNaN(dtObj.getTime())?dtObj.toLocaleDateString("pt-BR"):String(dtObj||"");
      var key=idPP+"|"+dtStr+"|"+vp.toFixed(2);
      if(dupKey[key])
        log("CRITICO","DUPLICIDADE","PAGAMENTOS",idPag,"Pagamento potencialmente duplicado (mesma parcela+data+valor)","CHAVE="+key+" anterior="+dupKey[key]);
      else
        dupKey[key]=idPag;
    }
  }

  // ═══ 5. AUDITORIA DE PIX ═════════════════════════════════════════════
  if(cmP["EFI_TXID"]) {
    var txidMap={};
    for(var id in setParcelas){
      var p=setParcelas[id];
      if(!p.efiTxid) continue;
      if(txidMap[p.efiTxid])
        log("CRITICO","PIX","PARCELAS",id,"EFI_TXID duplicado em múltiplas parcelas","TXID="+p.efiTxid+" Outra="+txidMap[p.efiTxid]);
      else
        txidMap[p.efiTxid]=id;
    }
  }

  // ═══ 6. AUDITORIA DE PROMESSAS ═══════════════════════════════════════
  if(dadosProm.length>1 && cmProm["STATUS_PROMESSA"]) {
    var cPrSt=(cmProm["STATUS_PROMESSA"]||0)-1;
    var cPrIC=(cmProm["ID_CONTRATO"]   ||2)-1;
    var cPrIP= cmProm["ID_PARCELA"]?cmProm["ID_PARCELA"]-1:-1;
    var cPrID=(cmProm["ID_PROMESSA"]   ||1)-1;
    for(var i=1;i<dadosProm.length;i++){
      var stPr  =cPrSt>=0?String(dadosProm[i][cPrSt]||"").toUpperCase():"";
      var idCPr =String(dadosProm[i][cPrIC]||"").trim();
      var idPPr =cPrIP>=0?String(dadosProm[i][cPrIP]||"").trim():"";
      var idProm=String(dadosProm[i][cPrID]||i).trim();
      if(idCPr && !setContratos[idCPr])
        log("CRITICO","PROMESSA","PROMESSAS",idProm,"Promessa com ID_CONTRATO inexistente em CONTRATOS","ID_CONTRATO="+idCPr);
      if(stPr==="PENDENTE" && idCPr && setContratos[idCPr]) {
        var cRef=setContratos[idCPr];
        if(cRef.stC==="quitado"||ST_TERM[cRef.stC])
          log("ALTO","PROMESSA","PROMESSAS",idProm,"Promessa PENDENTE para contrato quitado/encerrado","STATUS_CONTRATO="+cRef.stC);
      }
      if(stPr==="CUMPRIDA" && idPPr && !(pagsPorParcela[idPPr]||[]).length)
        log("MEDIO","PROMESSA","PROMESSAS",idProm,"Promessa CUMPRIDA sem registro de pagamento na parcela","ID_PARCELA="+idPPr);
    }
  }

  // ═══ 7. AUDITORIA DE EVENTOS ═════════════════════════════════════════
  if(dadosEv.length>1 && cmEv["ID_CONTRATO"]) {
    var cEvIC=cmEv["ID_CONTRATO"]-1;
    var cEvID=(cmEv["ID_EVENTO"]||1)-1;
    var orfEv=0;
    for(var i=1;i<dadosEv.length;i++){
      var idCEv=String(dadosEv[i][cEvIC]||"").trim();
      if(idCEv && !setContratos[idCEv]){
        orfEv++;
        if(orfEv<=5) log("BAIXO","EVENTO","EVENTOS",String(dadosEv[i][cEvID]||i),"Evento com ID_CONTRATO inexistente","ID_CONTRATO="+idCEv);
      }
    }
    if(orfEv>5) log("BAIXO","EVENTO","EVENTOS","(+outros)","Total eventos com ID_CONTRATO inexistente: "+orfEv,"Primeiros 5 já registrados");
  }

  // ═══ 8. INTEGRIDADE MATEMÁTICA — CONTRATOS ═══════════════════════════
  // Usa a mesma fórmula de atualizarTotaisContrato: VALOR_PRINCIPAL + sum(TODOS os VALOR_JUROS)
  // Isso evita falso positivo em contratos com pagamento somente_juros, onde parcelas
  // gerada_por_pagamento_de_juros são criadas e incrementam o VALOR_TOTAL corretamente.
  var somaPC = {}; // idContrato → {jurosTotal, count}
  for(var i=1;i<dadosP.length;i++){
    var idCt=String(dadosP[i][(cmP["ID_CONTRATO"]||2)-1]||"").trim();
    if(!idCt) continue;
    if(!somaPC[idCt]) somaPC[idCt]={jurosTotal:0,count:0};
    somaPC[idCt].jurosTotal += parseFloat(dadosP[i][(cmP["VALOR_JUROS"]||10)-1]||0)||0;
    somaPC[idCt].count++;
  }
  for(var id in setContratos){
    var c=setContratos[id]; var soma=somaPC[id];
    if(!soma) continue;
    var esperado = c.vPrincipal + soma.jurosTotal;
    if(c.vTotal>0 && Math.abs(c.vTotal-esperado)>0.02)
      log("CRITICO","MATEMATICA","CONTRATOS",id,"VALOR_TOTAL diverge de PRINCIPAL+sum(JUROS)","Cont="+c.vTotal.toFixed(2)+" Esp="+esperado.toFixed(2)+" Dif="+(Math.abs(c.vTotal-esperado)).toFixed(2));
    if(c.jurosTotal>0 && Math.abs(c.jurosTotal-soma.jurosTotal)>0.02)
      log("ALTO","MATEMATICA","CONTRATOS",id,"JUROS_TOTAL ≠ soma VALOR_JUROS das parcelas","Cont="+c.jurosTotal.toFixed(2)+" Soma="+soma.jurosTotal.toFixed(2)+" Dif="+(Math.abs(c.jurosTotal-soma.jurosTotal)).toFixed(2));
  }

  // ═══ 9. CAMPOS DERIVADOS — CLIENTES ══════════════════════════════════
  var cCTP = cmCli["TOTAL_PAGO"]      ?cmCli["TOTAL_PAGO"]-1      :-1;
  var cCCA = cmCli["CONTRATOS_ATIVOS"]?cmCli["CONTRATOS_ATIVOS"]-1:-1;
  var cCID = (cmCli["ID_CLIENTE"]||1)-1;
  if(cCTP>=0||cCCA>=0){
    var pgPorCli={}, ativPorCli={};
    var _ST_ATIVOS_AUD={ativo:1,ativo_em_dia:1,ativo_em_atraso:1,em_cobranca:1,pre_prejuizo:1,
      renegociado:1,em_recuperacao:1,recuperado_parcialmente:1,acordo_assistido:1};
    for(var i=1;i<dadosPag.length;i++){
      var idCl=String(dadosPag[i][cPagICl]||"").trim();
      var tpP=cPagTP>=0?String(dadosPag[i][cPagTP]||"").trim():"";
      var vp=cPagVP>=0?parseFloat(dadosPag[i][cPagVP]||0)||0:0;
      if(!idCl||tpP==="abatimento_acordo_assistido") continue;
      pgPorCli[idCl]=(pgPorCli[idCl]||0)+vp;
    }
    for(var i=1;i<dadosC.length;i++){
      var idCl=String(dadosC[i][(cmC["ID_CLIENTE"]||2)-1]||"").trim();
      var stCo=String(dadosC[i][(cmC["STATUS_CONTRATO"]||16)-1]||"").toLowerCase().trim();
      if(!idCl) continue;
      if(_ST_ATIVOS_AUD[stCo]) ativPorCli[idCl]=(ativPorCli[idCl]||0)+1;
    }
    for(var i=1;i<dadosCli.length;i++){
      var idCl=String(dadosCli[i][cCID]||"").trim(); if(!idCl) continue;
      if(cCTP>=0){
        var decl=parseFloat(dadosCli[i][cCTP]||0)||0;
        var real=pgPorCli[idCl]||0;
        if(decl>0 && Math.abs(decl-real)>1.00)
          log("ALTO","MATEMATICA","CLIENTES",idCl,"TOTAL_PAGO declarado diverge do real (>R$1,00)","Decl="+decl.toFixed(2)+" Real="+real.toFixed(2));
      }
      if(cCCA>=0){
        var decA=parseInt(dadosCli[i][cCCA]||0)||0;
        var reA=ativPorCli[idCl]||0;
        if(Math.abs(decA-reA)>0 && (decA>0||reA>0))
          log("MEDIO","MATEMATICA","CLIENTES",idCl,"CONTRATOS_ATIVOS declarado diverge do real","Decl="+decA+" Real="+reA);
      }
    }
  }

  // ═══ 10. DUPLICIDADE EM OPERACOES_PROCESSADAS ════════════════════════
  var abaOp=ss.getSheetByName("OPERACOES_PROCESSADAS");
  if(abaOp&&abaOp.getLastRow()>1){
    var cmOp=buildColMap(abaOp);
    var dOp=abaOp.getDataRange().getValues();
    var cOC=cmOp["CHAVE_IDEMPOTENCIA"]?cmOp["CHAVE_IDEMPOTENCIA"]-1:-1;
    var cOS=cmOp["STATUS"]?cmOp["STATUS"]-1:-1;
    var cOT=cmOp["TIPO_OPERACAO"]?cmOp["TIPO_OPERACAO"]-1:-1;
    if(cOC>=0){
      var chavesVistas={};
      for(var i=1;i<dOp.length;i++){
        var ch=String(dOp[i][cOC]||"").trim();
        var st=cOS>=0?String(dOp[i][cOS]||"").trim():"";
        if(!ch||st!=="PROCESSADO") continue;
        if(chavesVistas[ch]){
          var tp=cOT>=0?String(dOp[i][cOT]||"").trim():"";
          log("ALTO","DUPLICIDADE","OPERACOES_PROCESSADAS",ch,"Chave idempotência PROCESSADO registrada mais de 1x","TIPO="+tp);
        } else { chavesVistas[ch]=true; }
      }
    }
  }

  // ═══ SUMÁRIO ═════════════════════════════════════════════════════════
  var totalReg=(dadosCli.length-1)+(dadosC.length-1)+(dadosP.length-1)+(dadosPag.length-1);
  var score=100;
  score-=Math.min(50,cnt.CRITICO*10);
  score-=Math.min(25,cnt.ALTO*5);
  score-=Math.min(15,cnt.MEDIO*2);
  score-=Math.min(10,cnt.BAIXO*1);
  score=Math.max(0,score);
  var scoreLabel=score>=100?"INTEGRO":score>=90?"LEVE_RUIDO":score>=70?"ATENCAO":score>=50?"RISCO_OPERACIONAL":"CRITICO";

  var sumMsg="=== RESULTADO: SCORE="+score+" ("+scoreLabel+")"
    +" | CRITICO="+cnt.CRITICO+" ALTO="+cnt.ALTO+" MEDIO="+cnt.MEDIO+" BAIXO="+cnt.BAIXO
    +" | Registros auditados: "+totalReg
    +" | Achados: "+cnt.total+" ===";

  var ulF=abaAud.getLastRow()+1;
  abaAud.getRange(ulF,1,1,8).setValues([[new Date(),"INFO","SESSAO_FIM","SISTEMA","",sumMsg,"NAO","Duração: "+Math.round((new Date()-tsInicio)/1000)+"s"]]);
  var bgF=score>=90?"#07241B":score>=70?"#2d2200":"#3a1a1a";
  var fcF=score>=90?"#A8E040":score>=70?"#ffd080":"#ef6060";
  abaAud.getRange(ulF,1,1,8).setFontWeight("bold").setBackground(bgF).setFontColor(fcF);

  Logger.log("AUDITORIA INTEGRIDADE: score="+score+" ("+scoreLabel+") critico="+cnt.CRITICO+" alto="+cnt.ALTO+" medio="+cnt.MEDIO+" baixo="+cnt.BAIXO+" total_reg="+totalReg);
}

// ═══════════════════════════════════════════════════════════════════════════
// IDEMPOTÊNCIA — Proteção contra operações financeiras duplicadas
// ═══════════════════════════════════════════════════════════════════════════

function _garantirAbaOperacoes() {
  var ss  = SpreadsheetApp.getActiveSpreadsheet();
  var aba = ss.getSheetByName("OPERACOES_PROCESSADAS");
  if(!aba) {
    aba = ss.insertSheet("OPERACOES_PROCESSADAS");
    var h = ["ID_OPERACAO","CHAVE_IDEMPOTENCIA","TIPO_OPERACAO","DATA_HORA","STATUS","ORIGEM","ID_CLIENTE","ID_CONTRATO","ID_PARCELA"];
    aba.getRange(1,1,1,h.length).setValues([h]);
    aba.getRange(1,1,1,h.length).setFontWeight("bold").setBackground("#07241B").setFontColor("#A8E040");
    aba.setFrozenRows(1);
    aba.setColumnWidth(1,100); aba.setColumnWidth(2,210); aba.setColumnWidth(3,170);
    aba.setColumnWidth(4,145); aba.setColumnWidth(5,130); aba.setColumnWidth(6,100);
  }
  return aba;
}

function _idem_check(chave) {
  var ss  = SpreadsheetApp.getActiveSpreadsheet();
  var aba = ss.getSheetByName("OPERACOES_PROCESSADAS");
  if(!aba||aba.getLastRow()<=1) return false;
  var cm   = buildColMap(aba);
  var cCh  = cm["CHAVE_IDEMPOTENCIA"]?cm["CHAVE_IDEMPOTENCIA"]-1:1;
  var cSt  = cm["STATUS"]?cm["STATUS"]-1:4;
  var dados= aba.getDataRange().getValues();
  var chS  = String(chave).trim();
  for(var i=1;i<dados.length;i++){
    if(String(dados[i][cCh]||"").trim()===chS && String(dados[i][cSt]||"").trim()==="PROCESSADO") return true;
  }
  return false;
}

function _idem_reg(chave, tipo, meta) {
  _garantirAbaOperacoes();
  var ss  = SpreadsheetApp.getActiveSpreadsheet();
  var aba = ss.getSheetByName("OPERACOES_PROCESSADAS");
  var cm  = buildColMap(aba);
  var nc  = aba.getLastColumn();
  var row = new Array(nc).fill("");
  function s(h,v){if(cm[h]&&cm[h]<=nc)row[cm[h]-1]=v;}
  s("ID_OPERACAO",        proximoIdSeq(aba,"OP"));
  s("CHAVE_IDEMPOTENCIA", String(chave||""));
  s("TIPO_OPERACAO",      String(tipo||""));
  s("DATA_HORA",          new Date());
  s("STATUS",             "PROCESSADO");
  s("ORIGEM",             String((meta&&meta.origem)||""));
  s("ID_CLIENTE",         String((meta&&meta.idCliente)||""));
  s("ID_CONTRATO",        String((meta&&meta.idContrato)||""));
  s("ID_PARCELA",         String((meta&&meta.idParcela)||""));
  var ul=aba.getLastRow()+1;
  aba.getRange(ul,1,1,nc).setValues([row]);
  if(cm["DATA_HORA"]) aba.getRange(ul,cm["DATA_HORA"]).setNumberFormat("dd/mm/yyyy hh:mm:ss");
}

function _idem_registrar_tentativa_dupla(chave, tipo) {
  _garantirAbaOperacoes();
  var ss  = SpreadsheetApp.getActiveSpreadsheet();
  var aba = ss.getSheetByName("OPERACOES_PROCESSADAS");
  var cm  = buildColMap(aba);
  var nc  = aba.getLastColumn();
  var row = new Array(nc).fill("");
  function s(h,v){if(cm[h]&&cm[h]<=nc)row[cm[h]-1]=v;}
  s("ID_OPERACAO",        proximoIdSeq(aba,"OP"));
  s("CHAVE_IDEMPOTENCIA", String(chave||""));
  s("TIPO_OPERACAO",      String(tipo||""));
  s("DATA_HORA",          new Date());
  s("STATUS",             "DUPLICATA_BLOQUEADA");
  var ul=aba.getLastRow()+1;
  aba.getRange(ul,1,1,nc).setValues([row]);
  if(cm["DATA_HORA"]) aba.getRange(ul,cm["DATA_HORA"]).setNumberFormat("dd/mm/yyyy hh:mm:ss");
}

// ═══════════════════════════════════════════════════════════════════════════
// CORREÇÕES DE DADOS — concluídas em 2026-06-01. Funções removidas após uso.
// correcao1 (renomear colunas), correcao2 (parcial_juros), correcao3 (STATUS_CARTEIRA),
// investigar5/6 (anomalias), correcao5 (pagamento duplicado).
// ═══════════════════════════════════════════════════════════════════════════

// CORREÇÃO 1 — Renomear 6 cabeçalhos em CONTRATOS para alinhar com o código
// Apenas os textos dos cabeçalhos mudam. Nenhum dado é movido ou alterado.
function correcao1_RenomearColunasContratos() {
  var ui  = SpreadsheetApp.getUi();
  var ss  = SpreadsheetApp.getActiveSpreadsheet();
  var aba = ss.getSheetByName(ABAS.CONTRATOS);
  if (!aba) { ui.alert("Aba CONTRATOS não encontrada."); return; }

  var RENAMES = [
    { de: "DATA_1_VENCIMENTO",   para: "DATA_PRIMEIRA_PARCELA" },
    { de: "JUROS_TOTAIS_%",      para: "TAXA_JUROS_TOTAL"       },
    { de: "VALOR_JUROS",         para: "JUROS_TOTAL"            },
    { de: "VALOR_TOTAL_FINAL",   para: "VALOR_TOTAL"            },
    { de: "PRINCIPAL_P_PARCELA", para: "PARCELA_PRINCIPAL"      },
    { de: "JUROS_P_PARCELA",     para: "PARCELA_JUROS"          }
  ];

  var nc      = aba.getLastColumn();
  var headers = aba.getRange(1, 1, 1, nc).getValues()[0];
  var preview = "";
  var encontrados = [];

  RENAMES.forEach(function(r) {
    var idx = headers.indexOf(r.de);
    if (idx >= 0) {
      preview += "\n  col " + (idx + 1) + ": '" + r.de + "' → '" + r.para + "'";
      encontrados.push({ col: idx + 1, para: r.para });
    } else {
      preview += "\n  '" + r.de + "' — NÃO ENCONTRADA (pode já ter sido renomeada)";
    }
  });

  var resp = ui.alert(
    "CORREÇÃO 1 — Renomear cabeçalhos CONTRATOS",
    "As seguintes colunas serão renomeadas:" + preview +
    "\n\nNenhum dado será movido. Apenas os títulos mudam.\nConfirma?",
    ui.ButtonSet.YES_NO
  );
  if (resp !== ui.Button.YES) { ui.alert("Cancelado. Nenhuma alteração feita."); return; }

  encontrados.forEach(function(item) {
    aba.getRange(1, item.col)
       .setValue(item.para)
       .setFontWeight("bold")
       .setBackground("#1a1a2e")
       .setFontColor("#ffffff");
  });

  SpreadsheetApp.flush();
  ui.alert("Correção 1 concluída!\n" + encontrados.length + " coluna(s) renomeada(s).\n\nRode a auditoria novamente para confirmar.");
}

// CORREÇÃO 2 — Converter "parcial_juros" → "somente_juros" em PARCELAS e PAGAMENTOS
// 102 registros afetados. Abre log antes de alterar.
function correcao2_ParcialJurosParaSomenteJuros() {
  var ui  = SpreadsheetApp.getUi();
  var ss  = SpreadsheetApp.getActiveSpreadsheet();
  var abaP   = ss.getSheetByName(ABAS.PARCELAS);
  var abaPag = ss.getSheetByName(ABAS.PAGAMENTOS);
  if (!abaP || !abaPag) { ui.alert("Aba não encontrada."); return; }

  var cmP   = buildColMap(abaP);
  var cmPag = buildColMap(abaPag);
  var cTP   = cmP["TIPO_PAGAMENTO"]   ? cmP["TIPO_PAGAMENTO"]   - 1 : -1;
  var cTPag = cmPag["TIPO_PAGAMENTO"] ? cmPag["TIPO_PAGAMENTO"] - 1 : -1;

  if (cTP < 0 && cTPag < 0) { ui.alert("Coluna TIPO_PAGAMENTO não encontrada."); return; }

  // Contar afetados
  var dadosP   = abaP.getDataRange().getValues();
  var dadosPag = abaPag.getDataRange().getValues();
  var qtdP = 0, qtdPag = 0;

  if (cTP >= 0) for (var i = 1; i < dadosP.length;   i++) { if (String(dadosP[i][cTP]   || "").trim() === "parcial_juros") qtdP++; }
  if (cTPag >= 0) for (var j = 1; j < dadosPag.length; j++) { if (String(dadosPag[j][cTPag] || "").trim() === "parcial_juros") qtdPag++; }

  if (qtdP + qtdPag === 0) { ui.alert("Nenhum registro com 'parcial_juros' encontrado. Já corrigido."); return; }

  var resp = ui.alert(
    "CORREÇÃO 2 — parcial_juros → somente_juros",
    "Registros a alterar:\n" +
    "  PARCELAS   / TIPO_PAGAMENTO: " + qtdP   + " registros\n" +
    "  PAGAMENTOS / TIPO_PAGAMENTO: " + qtdPag + " registros\n\n" +
    "Total: " + (qtdP + qtdPag) + " registros.\n\n" +
    "Esta operação é registrada no log de eventos.\nConfirma?",
    ui.ButtonSet.YES_NO
  );
  if (resp !== ui.Button.YES) { ui.alert("Cancelado."); return; }

  // Criar aba de log antes de alterar
  var abaLog = ss.getSheetByName("LOG_CORRECAO2");
  if (abaLog) ss.deleteSheet(abaLog);
  abaLog = ss.insertSheet("LOG_CORRECAO2");
  abaLog.getRange(1,1,1,4).setValues([["ABA","LINHA","ID","VALOR_ANTERIOR"]]);
  var logRows = [];

  // Corrigir PARCELAS
  if (cTP >= 0) {
    var cPId = (cmP["ID_PARCELA"] || 1) - 1;
    dadosP = abaP.getDataRange().getValues();
    for (var i2 = 1; i2 < dadosP.length; i2++) {
      if (String(dadosP[i2][cTP] || "").trim() !== "parcial_juros") continue;
      logRows.push(["PARCELAS", i2 + 1, String(dadosP[i2][cPId] || ""), "parcial_juros"]);
      abaP.getRange(i2 + 1, cTP + 1).setValue("somente_juros");
    }
  }

  // Corrigir PAGAMENTOS
  if (cTPag >= 0) {
    var cPagId = (cmPag["ID_PAGAMENTO"] || 1) - 1;
    dadosPag = abaPag.getDataRange().getValues();
    for (var j2 = 1; j2 < dadosPag.length; j2++) {
      if (String(dadosPag[j2][cTPag] || "").trim() !== "parcial_juros") continue;
      logRows.push(["PAGAMENTOS", j2 + 1, String(dadosPag[j2][cPagId] || ""), "parcial_juros"]);
      abaPag.getRange(j2 + 1, cTPag + 1).setValue("somente_juros");
    }
  }

  if (logRows.length > 0) abaLog.getRange(2, 1, logRows.length, 4).setValues(logRows);
  SpreadsheetApp.flush();

  registrarEvento({ tipoEvento: "CORRECAO_DADOS", observacoes: "Correcao 2: " + logRows.length + " registros parcial_juros → somente_juros" });
  ui.alert("Correção 2 concluída!\n" + logRows.length + " registros atualizados.\nLog salvo na aba LOG_CORRECAO2.");
}

// CORREÇÃO 3 — Backfill STATUS_CARTEIRA baseado no STATUS_CONTRATO atual
// Contratos sem STATUS_CARTEIRA recebem o valor derivado do status atual.
function correcao3_BackfillStatusCarteira() {
  var ui  = SpreadsheetApp.getUi();
  var ss  = SpreadsheetApp.getActiveSpreadsheet();
  var aba = ss.getSheetByName(ABAS.CONTRATOS);
  if (!aba) { ui.alert("Aba CONTRATOS não encontrada."); return; }

  var cm = buildColMap(aba);
  var cSC = cm["STATUS_CONTRATO"] ? cm["STATUS_CONTRATO"] - 1 : -1;
  var cCA = cm["STATUS_CARTEIRA"] ? cm["STATUS_CARTEIRA"] - 1 : -1;
  if (cSC < 0) { ui.alert("Coluna STATUS_CONTRATO não encontrada."); return; }
  if (cCA < 0) { ui.alert("Coluna STATUS_CARTEIRA não encontrada. Rode migrarFase1 primeiro."); return; }

  // Mapa STATUS_CONTRATO → STATUS_CARTEIRA
  var MAPA = {
    "ativo_em_dia":              "ativa",
    "ativo_em_atraso":           "ativa",
    "em_cobranca":               "ativa",
    "pre_prejuizo":              "ativa",
    "quitado":                   "quitada",
    "baixado_como_prejuizo":     "baixada",
    "em_recuperacao":            "baixada",
    "recuperado_parcialmente":   "baixada",
    "recuperado_integralmente":  "baixada",
    "encerrado_sem_recuperacao": "baixada",
    "renegociado":               "renegociada",
    "cancelado":                 "cancelada"
  };

  var dados = aba.getDataRange().getValues();
  var cId   = (cm["ID_CONTRATO"] || 1) - 1;
  var preview = 0;
  var logRows = [];

  for (var i = 1; i < dados.length; i++) {
    var sc = String(dados[i][cSC] || "").trim();
    var ca = String(dados[i][cCA] || "").trim();
    if (ca !== "") continue; // já preenchido
    var novoVal = MAPA[sc] || "";
    if (!novoVal) continue;
    preview++;
    logRows.push([String(dados[i][cId] || ""), sc, novoVal]);
  }

  if (preview === 0) { ui.alert("Todos os contratos já têm STATUS_CARTEIRA preenchido."); return; }

  var resp = ui.alert(
    "CORREÇÃO 3 — Backfill STATUS_CARTEIRA",
    preview + " contratos sem STATUS_CARTEIRA serão preenchidos:\n\n" +
    "  ativo_em_dia / ativo_em_atraso / em_cobranca / pre_prejuizo → ativa\n" +
    "  quitado → quitada\n" +
    "  baixado_como_prejuizo / em_recuperacao → baixada\n" +
    "  renegociado → renegociada\n\n" +
    "Contratos que já têm STATUS_CARTEIRA não são alterados.\nConfirma?",
    ui.ButtonSet.YES_NO
  );
  if (resp !== ui.Button.YES) { ui.alert("Cancelado."); return; }

  // Criar log
  var abaLog = ss.getSheetByName("LOG_CORRECAO3");
  if (abaLog) ss.deleteSheet(abaLog);
  abaLog = ss.insertSheet("LOG_CORRECAO3");
  abaLog.getRange(1,1,1,3).setValues([["ID_CONTRATO","STATUS_CONTRATO","STATUS_CARTEIRA_NOVO"]]);

  var alterados = 0;
  dados = aba.getDataRange().getValues(); // reler
  for (var i2 = 1; i2 < dados.length; i2++) {
    var sc2  = String(dados[i2][cSC] || "").trim();
    var ca2  = String(dados[i2][cCA] || "").trim();
    if (ca2 !== "") continue;
    var novo = MAPA[sc2] || "";
    if (!novo) continue;
    aba.getRange(i2 + 1, cCA + 1).setValue(novo);
    alterados++;
  }

  if (logRows.length > 0) abaLog.getRange(2, 1, logRows.length, 3).setValues(logRows);
  SpreadsheetApp.flush();

  registrarEvento({ tipoEvento: "CORRECAO_DADOS", observacoes: "Correcao 3: backfill STATUS_CARTEIRA em " + alterados + " contratos" });
  ui.alert("Correção 3 concluída!\n" + alterados + " contratos atualizados.\nLog salvo na aba LOG_CORRECAO3.");
}

// INVESTIGAÇÃO 5 — Listar todas as parcelas com múltiplos registros de pagamento
// Não altera nada. Produz aba INVEST_5 com os casos encontrados.
function investigar5_PagamentosDuplicados() {
  var ui     = SpreadsheetApp.getUi();
  var ss     = SpreadsheetApp.getActiveSpreadsheet();
  var abaPag = ss.getSheetByName(ABAS.PAGAMENTOS);
  if (!abaPag || abaPag.getLastRow() <= 1) { ui.alert("Aba PAGAMENTOS vazia."); return; }

  var cm     = buildColMap(abaPag);
  var dados  = abaPag.getDataRange().getValues();
  var cIP    = cm["ID_PARCELA"]    ? cm["ID_PARCELA"]    - 1 : -1;
  var cID    = cm["ID_PAGAMENTO"]  ? cm["ID_PAGAMENTO"]  - 1 : 0;
  var cIC    = cm["ID_CONTRATO"]   ? cm["ID_CONTRATO"]   - 1 : -1;
  var cNC    = cm["NOME_CLIENTE"]  ? cm["NOME_CLIENTE"]  - 1 : -1;
  var cDT    = cm["DATA_PAGAMENTO"]? cm["DATA_PAGAMENTO"]- 1 : -1;
  var cVP    = cm["VALOR_PAGO"]    ? cm["VALOR_PAGO"]    - 1 : -1;
  var cTP    = cm["TIPO_PAGAMENTO"]? cm["TIPO_PAGAMENTO"]- 1 : -1;

  // Agrupar pagamentos por ID_PARCELA
  var grupos = {};
  for (var i = 1; i < dados.length; i++) {
    var idP = cIP >= 0 ? String(dados[i][cIP] || "").trim() : "";
    if (!idP) continue;
    if (!grupos[idP]) grupos[idP] = [];
    grupos[idP].push(i);
  }

  // Filtrar os que têm mais de 1
  var duplicados = Object.keys(grupos).filter(function(k) { return grupos[k].length > 1; });

  if (duplicados.length === 0) {
    ui.alert("Nenhuma parcela com pagamento duplicado encontrada. ✅");
    return;
  }

  // Produzir aba de resultado
  var abaInv = ss.getSheetByName("INVEST_5");
  if (abaInv) ss.deleteSheet(abaInv);
  abaInv = ss.insertSheet("INVEST_5");

  var rows = [["ID_PARCELA", "ID_PAGAMENTO", "ID_CONTRATO", "NOME_CLIENTE", "DATA_PAGAMENTO", "VALOR_PAGO", "TIPO_PAGAMENTO", "LINHA_PAGAMENTOS"]];

  duplicados.forEach(function(idP) {
    grupos[idP].forEach(function(linIdx) {
      var r = dados[linIdx];
      rows.push([
        idP,
        cID >= 0 ? String(r[cID] || "")  : "",
        cIC >= 0 ? String(r[cIC] || "")  : "",
        cNC >= 0 ? String(r[cNC] || "")  : "",
        cDT >= 0 ? (r[cDT] instanceof Date ? r[cDT].toLocaleDateString("pt-BR") : String(r[cDT] || "")) : "",
        cVP >= 0 ? parseFloat(r[cVP] || 0) : 0,
        cTP >= 0 ? String(r[cTP] || "")  : "",
        linIdx + 1
      ]);
    });
    rows.push(["---", "", "", "", "", "", "", ""]);
  });

  abaInv.getRange(1, 1, rows.length, 8).setValues(rows);
  abaInv.getRange(1, 1, 1, 8).setFontWeight("bold").setBackground("#1a1a2e").setFontColor("#ffffff");
  abaInv.setColumnWidths(1, 8, 140);
  abaInv.setFrozenRows(1);
  ss.setActiveSheet(abaInv);

  ui.alert(
    "Investigação 5 concluída.\n\n" +
    duplicados.length + " parcela(s) com pagamento duplicado encontrada(s).\n\n" +
    "Veja a aba INVEST_5.\n" +
    "Anote o ID_PAGAMENTO do registro INCORRETO e use\n" +
    "'Correcao 5 — Remover pagamento duplicado'."
  );
}

// INVESTIGAÇÃO 6 — Listar parcelas com DATA_PAGAMENTO anterior à data do contrato
// Não altera nada. Produz aba INVEST_6.
function investigar6_DatasSuspeitas() {
  var ui   = SpreadsheetApp.getUi();
  var ss   = SpreadsheetApp.getActiveSpreadsheet();
  var abaP = ss.getSheetByName(ABAS.PARCELAS);
  var abaC = ss.getSheetByName(ABAS.CONTRATOS);
  if (!abaP || !abaC) { ui.alert("Abas não encontradas."); return; }

  var cmP  = buildColMap(abaP);
  var cmC  = buildColMap(abaC);
  var dadosP = abaP.getDataRange().getValues();
  var dadosC = abaC.getDataRange().getValues();

  var cCID  = (cmC["ID_CONTRATO"]      || 1) - 1;
  var cCDE  = cmC["DATA_EMPRESTIMO"]   ? cmC["DATA_EMPRESTIMO"]   - 1 : 3;
  var cCNC  = cmC["NOME_CLIENTE"]      ? cmC["NOME_CLIENTE"]      - 1 : 2;
  var cPIP  = (cmP["ID_PARCELA"]       || 1) - 1;
  var cPIC  = (cmP["ID_CONTRATO"]      || 2) - 1;
  var cPNC  = cmP["NOME_CLIENTE"]      ? cmP["NOME_CLIENTE"]      - 1 : 3;
  var cPDP  = cmP["DATA_PAGAMENTO"]    ? cmP["DATA_PAGAMENTO"]    - 1 : -1;
  var cPDV  = (cmP["DATA_VENCIMENTO"]  || 7) - 1;
  var cPVP  = cmP["VALOR_PAGO"]        ? cmP["VALOR_PAGO"]        - 1 : -1;
  var cPTP  = cmP["TIPO_PAGAMENTO"]    ? cmP["TIPO_PAGAMENTO"]    - 1 : -1;
  var cPSt  = (cmP["STATUS"] || cmP["STATUS_PAGAMENTO"] || 11) - 1;

  // Mapa data empréstimo por contrato
  var dtConts = {}, nomeConts = {};
  for (var ci = 1; ci < dadosC.length; ci++) {
    var idC = String(dadosC[ci][cCID] || "").trim();
    var dtE = dadosC[ci][cCDE];
    if (idC && dtE instanceof Date && !isNaN(dtE.getTime())) {
      dtConts[idC]  = new Date(dtE.getFullYear(), dtE.getMonth(), dtE.getDate());
      nomeConts[idC] = cCNC >= 0 ? String(dadosC[ci][cCNC] || "") : "";
    }
  }

  var rows = [["ID_PARCELA","ID_CONTRATO","NOME_CLIENTE","DATA_VENCIMENTO","DATA_PAGAMENTO","DATA_EMPRESTIMO_CONTRATO","DIFF_DIAS","VALOR_PAGO","TIPO_PAGAMENTO","STATUS","OBSERVAÇÃO"]];
  var count = 0;

  for (var pi = 1; pi < dadosP.length; pi++) {
    var idCt  = String(dadosP[pi][cPIC] || "").trim();
    var dtPag = cPDP >= 0 ? dadosP[pi][cPDP] : null;
    if (!dtPag || !(dtPag instanceof Date) || isNaN(dtPag.getTime())) continue;

    var dtBase = dtConts[idCt];
    if (!dtBase) continue;

    var dp = new Date(dtPag.getFullYear(), dtPag.getMonth(), dtPag.getDate());
    var diffDias = Math.round((dp.getTime() - dtBase.getTime()) / 86400000);
    if (diffDias >= 0) continue; // pagamento APÓS a data do contrato — ok

    count++;
    var dtV = dadosP[pi][cPDV];
    rows.push([
      String(dadosP[pi][cPIP] || ""),
      idCt,
      nomeConts[idCt] || (cPNC >= 0 ? String(dadosP[pi][cPNC] || "") : ""),
      dtV instanceof Date ? dtV.toLocaleDateString("pt-BR") : String(dtV || ""),
      dtPag.toLocaleDateString("pt-BR"),
      dtBase.toLocaleDateString("pt-BR"),
      diffDias,
      cPVP >= 0 ? parseFloat(dadosP[pi][cPVP] || 0) : 0,
      cPTP >= 0 ? String(dadosP[pi][cPTP] || "") : "",
      String(dadosP[pi][cPSt] || ""),
      diffDias >= -3 ? "⚠️ Diferença pequena (possível timezone)" : "⛔ Verificar"
    ]);
  }

  if (count === 0) { ui.alert("Nenhuma data suspeita encontrada. ✅"); return; }

  var abaInv = ss.getSheetByName("INVEST_6");
  if (abaInv) ss.deleteSheet(abaInv);
  abaInv = ss.insertSheet("INVEST_6");
  abaInv.getRange(1, 1, rows.length, 11).setValues(rows);
  abaInv.getRange(1, 1, 1, 11).setFontWeight("bold").setBackground("#1a1a2e").setFontColor("#ffffff");
  abaInv.setColumnWidth(3, 160);
  abaInv.setColumnWidth(11, 280);
  abaInv.setFrozenRows(1);
  ss.setActiveSheet(abaInv);

  ui.alert(
    "Investigação 6 concluída.\n\n" +
    count + " parcela(s) com data de pagamento anterior ao contrato.\n\n" +
    "Veja a aba INVEST_6.\n" +
    "Coluna DIFF_DIAS: negativo = pagamento antes do contrato.\n" +
    "Diferença ≤ 3 dias pode ser fuso horário. > 3 dias = investigar."
  );
}

// CORREÇÃO 5 — Remover um pagamento duplicado específico pelo ID_PAGAMENTO
// Requer que o usuário informe o ID_PAGAMENTO incorreto após ver INVEST_5.
function correcao5_RemoverPagamentoDuplicado() {
  var ui  = SpreadsheetApp.getUi();
  var ss  = SpreadsheetApp.getActiveSpreadsheet();

  var resp = ui.prompt(
    "CORREÇÃO 5 — Remover pagamento duplicado",
    "Informe o ID_PAGAMENTO do registro INCORRETO a remover\n(ex: PAG00042).\n\nConsulte a aba INVEST_5 para identificar qual é o duplicado:",
    ui.ButtonSet.OK_CANCEL
  );
  if (resp.getSelectedButton() !== ui.Button.OK) { ui.alert("Cancelado."); return; }

  var idPag = String(resp.getResponseText() || "").trim();
  if (!idPag) { ui.alert("ID não informado. Cancelado."); return; }

  var abaPag = ss.getSheetByName(ABAS.PAGAMENTOS);
  if (!abaPag) { ui.alert("Aba PAGAMENTOS não encontrada."); return; }

  var cm    = buildColMap(abaPag);
  var cID   = cm["ID_PAGAMENTO"] ? cm["ID_PAGAMENTO"] - 1 : 0;
  var dados = abaPag.getDataRange().getValues();
  var linhaEncontrada = -1;
  var snapRow = null;

  for (var i = 1; i < dados.length; i++) {
    if (String(dados[i][cID] || "").trim() === idPag) {
      linhaEncontrada = i + 1;
      snapRow = dados[i];
      break;
    }
  }

  if (linhaEncontrada < 0) {
    ui.alert("ID_PAGAMENTO '" + idPag + "' não encontrado em PAGAMENTOS.");
    return;
  }

  // Mostrar o que será deletado e pedir confirmação final
  var cNC = cm["NOME_CLIENTE"]   ? cm["NOME_CLIENTE"]   - 1 : -1;
  var cDT = cm["DATA_PAGAMENTO"] ? cm["DATA_PAGAMENTO"] - 1 : -1;
  var cVP = cm["VALOR_PAGO"]     ? cm["VALOR_PAGO"]     - 1 : -1;
  var cIP = cm["ID_PARCELA"]     ? cm["ID_PARCELA"]     - 1 : -1;

  var preview =
    "\nID_PAGAMENTO: " + idPag +
    "\nCliente:      " + (cNC >= 0 ? String(snapRow[cNC] || "") : "?") +
    "\nParcela:      " + (cIP >= 0 ? String(snapRow[cIP] || "") : "?") +
    "\nData:         " + (cDT >= 0 && snapRow[cDT] instanceof Date ? snapRow[cDT].toLocaleDateString("pt-BR") : "?") +
    "\nValor:        " + (cVP >= 0 ? "R$ " + parseFloat(snapRow[cVP] || 0).toFixed(2) : "?");

  var conf = ui.alert(
    "Confirma DELEÇÃO do registro abaixo?" + preview + "\n\nEsta ação não pode ser desfeita.",
    ui.ButtonSet.YES_NO
  );
  if (conf !== ui.Button.YES) { ui.alert("Cancelado."); return; }

  // Salvar backup na aba de log
  var abaLog = ss.getSheetByName("LOG_CORRECAO5");
  if (!abaLog) abaLog = ss.insertSheet("LOG_CORRECAO5");
  var nc = abaPag.getLastColumn();
  var logHeader = abaPag.getRange(1, 1, 1, nc).getValues()[0];
  if (abaLog.getLastRow() === 0) abaLog.getRange(1, 1, 1, nc).setValues([logHeader]);
  abaLog.getRange(abaLog.getLastRow() + 1, 1, 1, nc).setValues([snapRow]);

  abaPag.deleteRow(linhaEncontrada);
  SpreadsheetApp.flush();

  registrarEvento({ tipoEvento: "CORRECAO_DADOS", observacoes: "Correcao 5: pagamento duplicado removido: " + idPag });
  ui.alert("Correção 5 concluída.\nRegistro " + idPag + " removido.\nBackup salvo em LOG_CORRECAO5.");
}

// ─────────────────────────────────────────────────────────────────────────────
// LEADS — bot WhatsApp (Evolution API)
// ─────────────────────────────────────────────────────────────────────────────

function _abaLeads() {
  var ss  = SpreadsheetApp.getActiveSpreadsheet();
  var aba = ss.getSheetByName(ABAS.LEADS);
  if (!aba) {
    aba = ss.insertSheet(ABAS.LEADS);
    var cols = ["ID_LEAD","TEL","STATUS","PADRINHO","PADRINHO_QUALIFICA","CLT",
                "VALOR_SOLICITADO","PRAZO_SOLICITADO","TEMPO_EMPRESA",
                "NOME","RENDA_BRUTA","RENDA_LIQUIDA","EMPREGADOR","DATA_ADMISSAO",
                "HISTORICO_JSON","CRIADO_EM","ATUALIZADO_EM"];
    aba.getRange(1, 1, 1, cols.length).setValues([cols]).setFontWeight("bold")
       .setBackground("#1a1a2e").setFontColor("#ffffff");
  }
  return aba;
}

function _normLeadStr(s) {
  return String(s || "").trim().toLowerCase()
    .normalize("NFD").replace(/[̀-ͯ]/g, "");
}

function _levenshtein(a, b) {
  var m = a.length, n = b.length;
  var dp = [];
  for (var i = 0; i <= m; i++) { dp[i] = [i]; }
  for (var j = 0; j <= n; j++) { dp[0][j] = j; }
  for (var i2 = 1; i2 <= m; i2++) {
    for (var j2 = 1; j2 <= n; j2++) {
      dp[i2][j2] = a[i2-1] === b[j2-1]
        ? dp[i2-1][j2-1]
        : 1 + Math.min(dp[i2-1][j2], dp[i2][j2-1], dp[i2-1][j2-1]);
    }
  }
  return dp[m][n];
}

function _fuzzyMatch(nome, lista) {
  var norm = _normLeadStr(nome);
  var best = null, bestScore = Infinity;
  for (var i = 0; i < lista.length; i++) {
    var n2 = _normLeadStr(lista[i].nome);
    if (n2.indexOf(norm) !== -1 || norm.indexOf(n2) !== -1) return { match: lista[i], score: 0 };
    var d = _levenshtein(norm, n2);
    if (d < bestScore) { bestScore = d; best = lista[i]; }
  }
  if (best && bestScore <= Math.max(2, Math.floor(norm.length * 0.3))) return { match: best, score: bestScore };
  return null;
}

function buscarLeadPorTel(tel) {
  if (!tel) return null;
  var aba  = _abaLeads();
  var cm   = buildColMap(aba);
  var data = aba.getDataRange().getValues();
  var telNorm = String(tel).replace(/\D/g, "");
  for (var i = 1; i < data.length; i++) {
    var t = String(data[i][(cm["TEL"]||1)-1] || "").replace(/\D/g, "");
    if (t === telNorm) {
      var obj = {};
      Object.keys(cm).forEach(function(k){ obj[k] = data[i][cm[k]-1]; });
      obj._row = i + 1;
      return obj;
    }
  }
  return null;
}

function criarLead(dados) {
  var aba = _abaLeads();
  var cm  = buildColMap(aba);
  var id  = proximoIdSeq(aba, "LED");
  var row = aba.getLastRow() + 1;
  aba.getRange(row, 1).setValue(id);
  var campos = Object.keys(dados);
  for (var i = 0; i < campos.length; i++) {
    if (cm[campos[i]]) setCel(aba, row, cm, campos[i], dados[campos[i]]);
  }
  return id;
}

function atualizarLead(idLead, dados) {
  var aba  = _abaLeads();
  var cm   = buildColMap(aba);
  var data = aba.getDataRange().getValues();
  for (var i = 1; i < data.length; i++) {
    if (String(data[i][0]).trim() === String(idLead).trim()) {
      var campos = Object.keys(dados);
      for (var j = 0; j < campos.length; j++) {
        if (cm[campos[j]]) setCel(aba, i + 1, cm, campos[j], dados[campos[j]]);
      }
      return;
    }
  }
}

function verificarPadrinho(nome) {
  if (!nome) return { ok: true, existe: false, qualifica: false, nomeEncontrado: null };
  var ss   = SpreadsheetApp.getActiveSpreadsheet();
  var abaCli = ss.getSheetByName(ABAS.CLIENTES);
  var cmC    = buildColMap(abaCli);
  var dadosCli = abaCli.getDataRange().getValues();

  var lista = [];
  for (var i = 1; i < dadosCli.length; i++) {
    var n = String(dadosCli[i][(cmC["NOME"]||2)-1] || "").trim();
    if (!n) continue;
    var st = String(dadosCli[i][(cmC["STATUS_CLIENTE"]||3)-1] || "").trim().toLowerCase();
    if (st === "ativo" || st === "inativo") lista.push({ nome: n, row: i });
  }

  var resultado = _fuzzyMatch(nome, lista);
  if (!resultado) return { ok: true, existe: false, qualifica: false, nomeEncontrado: null };

  var matchRow  = resultado.match.row;
  var nomeReal  = lista[lista.indexOf(resultado.match)].nome;

  // Verifica se tem contrato quitado (padrinho qualifica)
  var abaContr  = ss.getSheetByName(ABAS.CONTRATOS);
  var cmContr   = buildColMap(abaContr);
  var dadosContr = abaContr.getDataRange().getValues();
  var idCli     = String(dadosCli[matchRow][(cmC["ID_CLIENTE"]||1)-1] || "").trim();
  var qualifica  = false;
  for (var k = 1; k < dadosContr.length; k++) {
    var cId = String(dadosContr[k][(cmContr["ID_CLIENTE"]||2)-1] || "").trim();
    var cSt = String(dadosContr[k][(cmContr["STATUS_CONTRATO"]||5)-1] || "").trim().toLowerCase();
    if (cId === idCli && cSt === "quitado") { qualifica = true; break; }
  }

  // Verifica ambiguidade: mais de um cliente com nome parecido
  var similares = lista.filter(function(l) {
    return _normLeadStr(l.nome).indexOf(_normLeadStr(nome)) !== -1;
  });
  if (similares.length > 1) {
    return {
      ok: true, existe: true, qualifica: qualifica,
      nomeEncontrado: nomeReal,
      multiplos: true,
      opcoes: similares.map(function(l){ return l.nome; })
    };
  }

  return { ok: true, existe: true, qualifica: qualifica, nomeEncontrado: nomeReal };
}

function buscarClientePorTel(tel) {
  if (!tel) return { encontrado: false };
  var ss     = SpreadsheetApp.getActiveSpreadsheet();
  var abaCli = ss.getSheetByName(ABAS.CLIENTES);
  var cmC    = buildColMap(abaCli);
  var dados  = abaCli.getDataRange().getValues();
  var telNorm = String(tel).replace(/\D/g, "");

  var clienteRow = null, clienteIdx = -1;
  for (var i = 1; i < dados.length; i++) {
    var telSheet = String(dados[i][(cmC["TELEFONE_WPP"]||1)-1] || "").replace(/\D/g, "");
    if (!telSheet) continue;
    // Comparar últimos 9 dígitos (ignora variações de DDI)
    var sufA = telNorm.slice(-9);
    var sufB = telSheet.slice(-9);
    if (sufA === sufB) { clienteRow = dados[i]; clienteIdx = i; break; }
  }
  if (!clienteRow) return { encontrado: false };

  var idCli = String(clienteRow[(cmC["ID_CLIENTE"]||1)-1] || "").trim();

  // Busca contratos ativos
  var abaContr = ss.getSheetByName(ABAS.CONTRATOS);
  var cmContr  = buildColMap(abaContr);
  var dadosContr = abaContr.getDataRange().getValues();

  var TERM_C = { quitado:1, cancelado:1, baixado_como_prejuizo:1, encerrado_sem_recuperacao:1,
                 recuperado_parcialmente:1, recuperado_integralmente:1 };
  var contratos = [];
  for (var c = 1; c < dadosContr.length; c++) {
    if (String(dadosContr[c][(cmContr["ID_CLIENTE"]||2)-1]||"").trim() !== idCli) continue;
    var stC = String(dadosContr[c][(cmContr["STATUS_CONTRATO"]||5)-1]||"").trim().toLowerCase();
    if (!TERM_C[stC]) {
      var obj = {};
      Object.keys(cmContr).forEach(function(k){ obj[k] = dadosContr[c][cmContr[k]-1]; });
      contratos.push(obj);
    }
  }

  // Busca parcelas do primeiro contrato ativo
  var parcelas = [];
  if (contratos.length > 0) {
    var idContr = String(contratos[0]["ID_CONTRATO"] || "").trim();
    var abaPar  = ss.getSheetByName(ABAS.PARCELAS);
    var cmP     = buildColMap(abaPar);
    var dadosPar = abaPar.getDataRange().getValues();
    for (var p = 1; p < dadosPar.length; p++) {
      if (String(dadosPar[p][(cmP["ID_CONTRATO"]||2)-1]||"").trim() !== idContr) continue;
      var objP = {};
      Object.keys(cmP).forEach(function(k){ objP[k] = dadosPar[p][cmP[k]-1]; });
      parcelas.push(objP);
    }
  }

  // Organiza retorno
  var TERM_P = { pago:1, quitacao_antecipada:1, baixado_como_prejuizo:1, cancelado:1, renegociado:1 };
  var abertas  = parcelas.filter(function(p){ return !TERM_P[String(p.STATUS||"").toLowerCase()]; });
  var pagas    = parcelas.filter(function(p){ return TERM_P[String(p.STATUS||"").toLowerCase()]; });
  var proxPar  = abertas.length > 0 ? abertas[0] : null;
  var ultimaPg = pagas.length   > 0 ? pagas[pagas.length-1] : null;

  var cliente = {};
  Object.keys(cmC).forEach(function(k){ cliente[k] = clienteRow[cmC[k]-1]; });

  return {
    encontrado: true,
    cliente: cliente,
    proximaParcela: proxPar,
    ultimaPaga: ultimaPg,
    totalParcelas: parcelas.length,
    pagas: pagas.length,
    totalAbertas: abertas.length
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// RÉGUA DE COBRANÇA AUTOMÁTICA
// ─────────────────────────────────────────────────────────────────────────────

function _getCfg(chave) {
  var aba = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(ABAS.CONFIG);
  if (!aba) return "";
  var vals = aba.getDataRange().getValues();
  for (var i = 1; i < vals.length; i++) {
    if (String(vals[i][0]||"").trim() === chave) return String(vals[i][1]||"").trim();
  }
  return "";
}

function _setCfg(chave, valor) {
  var aba = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(ABAS.CONFIG);
  if (!aba) return;
  var vals = aba.getDataRange().getValues();
  for (var i = 1; i < vals.length; i++) {
    if (String(vals[i][0]||"").trim() === chave) { aba.getRange(i+1, 2).setValue(valor); return; }
  }
  var r = aba.getLastRow() + 1;
  aba.getRange(r, 1).setValue(chave);
  aba.getRange(r, 2).setValue(valor);
}

function _garantirConfigsRegua() {
  var ss  = SpreadsheetApp.getActiveSpreadsheet();
  var aba = ss.getSheetByName(ABAS.CONFIG) || ss.insertSheet(ABAS.CONFIG);
  if (aba.getLastRow() === 0) aba.getRange(1,1,1,2).setValues([["CHAVE","VALOR"]]);
  var vals = aba.getDataRange().getValues();
  var ex = {};
  for (var i = 1; i < vals.length; i++) { var k=String(vals[i][0]||"").trim(); if(k) ex[k]=true; }
  var novas = [
    ["EVOLUTION_URL",      "http://76.13.228.217:32771"],
    ["EVOLUTION_KEY",      "jt8o4nVTWswDaOXjfPiujy13aqBP27uM"],
    ["EVOLUTION_INSTANCE", "borges"],
    ["COBRANCA_SECRET",    "02d03df4558a0609d355ed148ff9f9d5"],
    ["VERCEL_URL",         "https://financeiroop.vercel.app"],
  ];
  novas.forEach(function(row) {
    if (!ex[row[0]]) { var r=aba.getLastRow()+1; aba.getRange(r,1).setValue(row[0]); aba.getRange(r,2).setValue(row[1]); }
  });
  Object.keys(_MSG_TEMPLATES).forEach(function(k) {
    if (!ex["TEMPLATE_" + k]) { var r=aba.getLastRow()+1; aba.getRange(r,1).setValue("TEMPLATE_"+k); aba.getRange(r,2).setValue(_MSG_TEMPLATES[k]); }
  });
  if (!ex["TEMPLATE_CONFIRMACAO"]) { var r=aba.getLastRow()+1; aba.getRange(r,1).setValue("TEMPLATE_CONFIRMACAO"); aba.getRange(r,2).setValue(_MSG_TEMPLATES["CONFIRMACAO"]); }
  if (!ex["TEMPLATE_CERTIFICADO_QUITACAO"]) { var r=aba.getLastRow()+1; aba.getRange(r,1).setValue("TEMPLATE_CERTIFICADO_QUITACAO"); aba.getRange(r,2).setValue(_MSG_TEMPLATES["CERTIFICADO_QUITACAO"]); }
}

function buscarTemplatesRegua() {
  var out = {};
  Object.keys(_MSG_TEMPLATES).forEach(function(k) { out[k] = _MSG_TEMPLATES[k]; });
  var aba = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(ABAS.CONFIG);
  if (!aba) return out;
  var vals = aba.getDataRange().getValues();
  for (var i = 1; i < vals.length; i++) {
    var ch = String(vals[i][0]||"").trim();
    if (ch.indexOf("TEMPLATE_") === 0) {
      var g = ch.slice(9);
      var v = String(vals[i][1]||"").trim();
      if (v) out[g] = v;
    }
  }
  return out;
}

function salvarTemplateRegua(templates) {
  if (!templates) return;
  Object.keys(templates).forEach(function(g) {
    _setCfg("TEMPLATE_" + g, String(templates[g]||""));
  });
}

function _abaMsg() {
  var ss  = SpreadsheetApp.getActiveSpreadsheet();
  var aba = ss.getSheetByName(ABAS.MENSAGENS);
  if (!aba) {
    aba = ss.insertSheet(ABAS.MENSAGENS);
    var h = ["ID_MENSAGEM","DATA_ENVIO","ID_CLIENTE","ID_CONTRATO","ID_PARCELA","TELEFONE","GATILHO","CONTEUDO","STATUS_ENVIO"];
    aba.getRange(1,1,1,h.length).setValues([h]).setFontWeight("bold").setBackground("#1a1a2e").setFontColor("#ffffff");
  }
  return aba;
}

function _logMensagem(dados) {
  var aba = _abaMsg();
  var id  = proximoIdSeq(aba, "MSG");
  // Lock: rotinaDiaria (7h) e o trigger de backup rotinaRegua (8h) podem chamar
  // enviarReguaCobranca() em execuções concorrentes — sem lock, getLastRow()+1
  // calculado por duas execuções ao mesmo tempo grava na mesma linha e uma
  // sobrescreve a outra, perdendo o registro mesmo com a mensagem já enviada.
  var lock = LockService.getScriptLock();
  lock.waitLock(15000);
  try {
    var r  = aba.getLastRow() + 1;
    var cm = buildColMap(aba);
    setCel(aba, r, cm, "ID_MENSAGEM",  id);
    setCel(aba, r, cm, "DATA_ENVIO",   new Date(), "dd/mm/yyyy hh:mm");
    setCel(aba, r, cm, "ID_CLIENTE",   dados.idCliente  || "");
    setCel(aba, r, cm, "ID_CONTRATO",  dados.idContrato || "");
    setCel(aba, r, cm, "ID_PARCELA",   dados.idParcela  || "");
    setCel(aba, r, cm, "TELEFONE",     dados.telefone   || "");
    setCel(aba, r, cm, "GATILHO",      dados.gatilho    || "");
    setCel(aba, r, cm, "CONTEUDO",     dados.conteudo   || "");
    setCel(aba, r, cm, "STATUS_ENVIO", dados.status     || "ENVIADO");
  } finally {
    lock.releaseLock();
  }
}

function _jaEnviouHoje(idCliente) {
  var aba  = _abaMsg();
  if (aba.getLastRow() < 2) return false;
  var cm   = buildColMap(aba);
  var vals = aba.getDataRange().getValues();
  var hoje = new Date();
  var hj   = hoje.getFullYear() + "-" + hoje.getMonth() + "-" + hoje.getDate();
  var cDt  = (cm["DATA_ENVIO"]   || 1) - 1;
  var cCli = (cm["ID_CLIENTE"]   || 3) - 1;
  var cSt  = (cm["STATUS_ENVIO"] || 9) - 1;
  for (var i = 1; i < vals.length; i++) {
    var dt = vals[i][cDt];
    if (!(dt instanceof Date)) continue;
    var ds = dt.getFullYear() + "-" + dt.getMonth() + "-" + dt.getDate();
    if (ds === hj
        && String(vals[i][cCli]||"").trim() === String(idCliente).trim()
        && String(vals[i][cSt] ||"").trim() === "ENVIADO") return true;
  }
  return false;
}

function _cancelarPromessasPorContrato(idContrato) {
  var ss      = SpreadsheetApp.getActiveSpreadsheet();
  var abaProm = ss.getSheetByName(ABAS.PROMESSAS);
  if (!abaProm || abaProm.getLastRow() < 2) return;
  var cm    = buildColMap(abaProm);
  var cCont = cm["ID_CONTRATO"]     ? cm["ID_CONTRATO"]-1     : -1;
  var cSt   = cm["STATUS_PROMESSA"] ? cm["STATUS_PROMESSA"]-1 : -1;
  if (cCont < 0 || cSt < 0) return;
  var dados = abaProm.getDataRange().getValues();
  for (var i = 1; i < dados.length; i++) {
    if (String(dados[i][cCont]||"").trim() !== String(idContrato).trim()) continue;
    if (String(dados[i][cSt] ||"").trim().toUpperCase() !== "PENDENTE") continue;
    abaProm.getRange(i+1, cSt+1).setValue("CUMPRIDA");
  }
}

function _enviarConfirmacaoPagamento(params) {
  var idParcela     = params.idParcela;
  var idContrato    = params.idContrato;
  var idCliente     = params.idCliente;
  var nomeCliente   = params.nomeCliente;
  var numParcela    = params.numParcela;
  var totalParcelas = params.totalParcelas;
  var vlPago        = params.vlPago;

  // 1. Verifica duplicata — não reenvia se já foi ENVIADA para esta parcela
  var abaMsg = _abaMsg();
  var cmMsg  = buildColMap(abaMsg);
  if (abaMsg.getLastRow() >= 2) {
    var vMsg = abaMsg.getDataRange().getValues();
    var cGat = (cmMsg["GATILHO"]   ||7)-1;
    var cPar = (cmMsg["ID_PARCELA"]||5)-1;
    var cStM = (cmMsg["STATUS_ENVIO"]||9)-1;
    for (var i = 1; i < vMsg.length; i++) {
      if (String(vMsg[i][cGat]||"").trim() === "CONFIRMACAO_PAGAMENTO" &&
          String(vMsg[i][cPar]||"").trim() === String(idParcela).trim() &&
          String(vMsg[i][cStM]||"").trim() === "ENVIADO") {
        Logger.log("ConfirmacaoWPP: ja enviada para " + idParcela);
        return;
      }
    }
  }

  // 2-7. Qualquer exceção aqui (leitura de PARCELAS, template, envio) antes era
  // engolida por um catch genérico do chamador — pagamento ficava registrado
  // mas a falha de confirmação era 100% invisível (nem MENSAGENS, nem aba Régua
  // WPP). Agora sempre grava um registro ERRO_ENVIO com o motivo real.
  try {
    // 2. Busca telefone do cliente
    var ss     = SpreadsheetApp.getActiveSpreadsheet();
    var abaCli = ss.getSheetByName(ABAS.CLIENTES);
    var cmCli  = buildColMap(abaCli);
    var dCli   = abaCli.getDataRange().getValues();
    var telefone = "";
    for (var i = 1; i < dCli.length; i++) {
      if (String(dCli[i][0]).trim() === String(idCliente).trim()) {
        telefone = String(dCli[i][(cmCli["TELEFONE_WPP"]||8)-1]||"").replace(/\D/g,"");
        break;
      }
    }
    if (!telefone || telefone.length < 10) {
      _logMensagem({idCliente:idCliente,idContrato:idContrato,idParcela:idParcela,
                    telefone:"",gatilho:"CONFIRMACAO_PAGAMENTO",conteudo:"SEM_TELEFONE",status:"ERRO_SEM_TELEFONE"});
      return;
    }

    // 3. Calcula parcelas restantes e próximo vencimento (ignora a parcela recém-paga)
    var abaP   = ss.getSheetByName(ABAS.PARCELAS);
    var cmP    = buildColMap(abaP);
    var dP     = abaP.getDataRange().getValues();
    var ipCont = (cmP["ID_CONTRATO"]    ||2)-1;
    var ipSt   = (cmP["STATUS"]         ||12)-1;
    var ipDtV  = (cmP["DATA_VENCIMENTO"]||7)-1;
    var ipParId= (cmP["ID_PARCELA"]     ||1)-1;
    var restantes = 0; var proxDate = null;
    for (var i = 1; i < dP.length; i++) {
      if (String(dP[i][ipCont]||"").trim() !== String(idContrato).trim()) continue;
      if (String(dP[i][ipParId]||"").trim() === String(idParcela).trim()) continue;
      var stP = String(dP[i][ipSt]||"").toLowerCase().trim();
      if (STATUS_TERMINAL[stP]) continue;
      restantes++;
      var dtV = dP[i][ipDtV];
      if (dtV instanceof Date && (!proxDate || dtV < proxDate)) proxDate = dtV;
    }
    var proxVenc = proxDate ? _fmtDataRegua(proxDate) : (restantes === 0 ? "Contrato quitado" : "—");

    // 4. Monta mensagem a partir do template editável
    var tmpl = _getCfg("TEMPLATE_CONFIRMACAO") ||
      "Olá, {NOME}.\n\nIdentificamos o pagamento da sua parcela {NUM_PARCELA} de {TOTAL_PARCELAS}.\n\nValor recebido: R$ {VALOR_PAGO}\n\nSeu pagamento foi registrado com sucesso.\n\nParcelas restantes: {PARCELAS_RESTANTES}\n\nPróximo vencimento: {PROXIMO_VENCIMENTO}\n\nAgradecemos pela confiança.\n\nBorges Assessoria";
    var nome  = String(nomeCliente||"").split(" ")[0];
    var texto = _buildMsgRegua(tmpl, {
      NOME:               nome,
      NUM_PARCELA:        String(numParcela||""),
      TOTAL_PARCELAS:     String(totalParcelas||""),
      VALOR_PAGO:         _fmtValorRegua(vlPago),
      PARCELAS_RESTANTES: String(restantes),
      PROXIMO_VENCIMENTO: proxVenc
    });

    // 5. Envia via Evolution GO
    var ok = _enviarWppRegua(telefone, texto);

    // 6. Log em MENSAGENS
    _logMensagem({
      idCliente:idCliente, idContrato:idContrato, idParcela:idParcela,
      telefone:telefone, gatilho:"CONFIRMACAO_PAGAMENTO",
      conteudo:texto, status: ok ? "ENVIADO" : "ERRO_ENVIO"
    });

    // 7. Cancela promessas PENDENTE do contrato
    try { _cancelarPromessasPorContrato(idContrato); } catch(eP) { Logger.log("CancelProm err: "+eP.message); }

    Logger.log("ConfirmacaoWPP: " + (ok?"OK":"ERRO") + " → " + nome + " (" + telefone + ")");
  } catch (eFatal) {
    Logger.log("ConfirmacaoWPP: ERRO FATAL — " + eFatal.message);
    try {
      _logMensagem({idCliente:idCliente, idContrato:idContrato, idParcela:idParcela,
        telefone:"", gatilho:"CONFIRMACAO_PAGAMENTO",
        conteudo:"ERRO_INTERNO: " + eFatal.message, status:"ERRO_ENVIO"});
    } catch (eLog2) { Logger.log("ConfirmacaoWPP: log de erro tambem falhou — " + eLog2.message); }
  }
}

// Varre PARCELAS pagas nos últimos N dias e reenvia a confirmação de pagamento
// para as que não têm um MENSAGENS/CONFIRMACAO_PAGAMENTO com STATUS_ENVIO=ENVIADO.
// Seguro pra rodar mais de uma vez: _enviarConfirmacaoPagamento já bloqueia reenvio
// duplicado (passo 1, dedup por ID_PARCELA). Cobre casos como falha silenciosa de
// exceção antes do fix de 2026-07-13.
function reenviarConfirmacoesPendentes() {
  var ui = SpreadsheetApp.getUi();
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var abaP = ss.getSheetByName(ABAS.PARCELAS);
  if (!abaP) { ui.alert("Aba PARCELAS não encontrada"); return; }

  var cm = buildColMap(abaP);
  var dados = abaP.getDataRange().getValues();

  var abaMsg = _abaMsg();
  var cmMsg  = buildColMap(abaMsg);
  var dMsg   = abaMsg.getLastRow() >= 2 ? abaMsg.getDataRange().getValues() : [];
  var jaConfirmadas = {};
  for (var i = 1; i < dMsg.length; i++) {
    var gat = String(dMsg[i][(cmMsg["GATILHO"]||7)-1]||"").trim();
    var st  = String(dMsg[i][(cmMsg["STATUS_ENVIO"]||9)-1]||"").trim();
    if (gat === "CONFIRMACAO_PAGAMENTO" && st === "ENVIADO") {
      jaConfirmadas[String(dMsg[i][(cmMsg["ID_PARCELA"]||5)-1]||"").trim()] = true;
    }
  }

  var limite = new Date();
  limite.setDate(limite.getDate() - 7);

  var stCol = cm["STATUS"] || cm["STATUS_PAGAMENTO"];
  var candidatos = [];
  for (var i = 1; i < dados.length; i++) {
    var st = stCol ? String(dados[i][stCol-1]||"").toLowerCase().trim() : "";
    if (st !== "pago") continue;
    var idParcela = String(dados[i][(cm["ID_PARCELA"]||1)-1]||"").trim();
    if (!idParcela || jaConfirmadas[idParcela]) continue;
    var dtPag = dados[i][(cm["DATA_PAGAMENTO"]||0)-1];
    if (!(dtPag instanceof Date) || dtPag < limite) continue;
    candidatos.push({
      idParcela:  idParcela,
      idContrato: String(dados[i][(cm["ID_CONTRATO"]  ||2)-1]||"").trim(),
      idCliente:  String(dados[i][(cm["ID_CLIENTE"]   ||3)-1]||"").trim(),
      nomeCliente:String(dados[i][(cm["NOME_CLIENTE"] ||4)-1]||"").trim(),
      numParcela: parseInt(dados[i][(cm["NUM_PARCELA"]||5)-1])||0,
      vlPago:     parseFloat(dados[i][(cm["VALOR_PAGO"]||0)-1])||0
    });
  }

  if (!candidatos.length) { ui.alert("Nenhuma confirmação pendente encontrada nos últimos 7 dias."); return; }

  var totParcMap = {};
  for (var i = 1; i < dados.length; i++) {
    var idC = String(dados[i][(cm["ID_CONTRATO"]||2)-1]||"").trim();
    if (idC) totParcMap[idC] = (totParcMap[idC]||0) + 1;
  }

  var enviadas = 0, nomes = [];
  candidatos.forEach(function(c) {
    try {
      _enviarConfirmacaoPagamento({
        idParcela: c.idParcela, idContrato: c.idContrato, idCliente: c.idCliente,
        nomeCliente: c.nomeCliente, numParcela: c.numParcela,
        totalParcelas: totParcMap[c.idContrato]||0, vlPago: c.vlPago
      });
      enviadas++;
      nomes.push(c.nomeCliente + " (parcela " + c.numParcela + ")");
    } catch (e) {
      Logger.log("reenviarConfirmacoesPendentes: erro em " + c.idParcela + " — " + e.message);
    }
  });

  Logger.log("reenviarConfirmacoesPendentes: " + enviadas + "/" + candidatos.length + " reenviadas");
  ui.alert("Reenvio concluído!\n\n✅ " + enviadas + " confirmação(ões) reenviada(s):\n\n" + nomes.join("\n"));
}

// ─── CERTIFICADOS DE QUITAÇÃO ──────────────────────────────────────────────

function _garantirAbaCertificados() {
  var ss  = SpreadsheetApp.getActiveSpreadsheet();
  var aba = ss.getSheetByName(ABAS.CERTIFICADOS);
  if (aba) return aba;
  aba = ss.insertSheet(ABAS.CERTIFICADOS);
  var h = ["ID_CERTIFICADO","ID_CONTRATO","ID_CLIENTE","NOME_CLIENTE","CPF",
           "VALOR_TOTAL_PAGO","DATA_QUITACAO","CODIGO_VALIDACAO","DATA_GERACAO","STATUS"];
  aba.getRange(1,1,1,h.length).setValues([h]);
  aba.getRange(1,1,1,h.length).setFontWeight("bold").setBackground("#1a1a2e").setFontColor("#ffffff");
  aba.setFrozenRows(1);
  return aba;
}

function _gerarCodigoValidacao() {
  var uuid = Utilities.getUuid().replace(/-/g,"").substring(0,12).toUpperCase();
  return "CERT-" + new Date().getFullYear() + "-" + uuid;
}

function _buscarDadosCertificado(idContrato, idCliente) {
  var ss     = SpreadsheetApp.getActiveSpreadsheet();
  var abaCli = ss.getSheetByName(ABAS.CLIENTES);
  var cmCli  = buildColMap(abaCli);
  var dCli   = abaCli.getDataRange().getValues();
  var nome = ""; var cpf = ""; var tel = "";
  for (var i = 1; i < dCli.length; i++) {
    if (String(dCli[i][0]).trim() === String(idCliente).trim()) {
      nome = String(dCli[i][(cmCli["NOME"]        ||2)-1]||"");
      cpf  = String(dCli[i][(cmCli["CPF"]         ||3)-1]||"").replace(/\D/g,"");
      tel  = String(dCli[i][(cmCli["TELEFONE_WPP"]||8)-1]||"").replace(/\D/g,"");
      break;
    }
  }
  var abaPag = ss.getSheetByName(ABAS.PAGAMENTOS);
  var cmPag  = buildColMap(abaPag);
  var dPag   = abaPag.getDataRange().getValues();
  var totalPago = 0;
  for (var j = 1; j < dPag.length; j++) {
    if (String(dPag[j][(cmPag["ID_CONTRATO"]||3)-1]).trim() === String(idContrato).trim()) {
      totalPago += parseFloat(dPag[j][(cmPag["VALOR_PAGO"]||7)-1]||0);
    }
  }
  return { nome: nome, cpf: cpf, telefone: tel, totalPago: totalPago };
}

function gerarCertificadoQuitacao(params) {
  var idContrato  = params.idContrato;
  var idCliente   = params.idCliente;
  var nomeCliente = params.nomeCliente;
  var cpf         = params.cpf;
  var datQuitacao = params.datQuitacao;
  var totalPago   = params.totalPago;
  var aba = _garantirAbaCertificados();
  var cm  = buildColMap(aba);
  // Dedup: se já existe certificado ativo para este contrato, retorna o existente
  if (aba.getLastRow() >= 2) {
    var vals = aba.getDataRange().getValues();
    var cIdC = (cm["ID_CONTRATO"]     ||2)-1;
    var cSt  = (cm["STATUS"]          ||10)-1;
    var cCod = (cm["CODIGO_VALIDACAO"]||8)-1;
    for (var i = 1; i < vals.length; i++) {
      if (String(vals[i][cIdC]).trim() === String(idContrato).trim() &&
          String(vals[i][cSt]).trim()  === "ativo") {
        var cod = String(vals[i][cCod]).trim();
        var vUrl = _getCfg("VERCEL_URL") || "https://financeiroop.vercel.app";
        return { idCertificado: String(vals[i][0]), codigoValidacao: cod, linkCertificado: vUrl + "/c/" + cod };
      }
    }
  }
  var id     = proximoIdSeq(aba, "CERT");
  var codigo = _gerarCodigoValidacao();
  var vUrl   = _getCfg("VERCEL_URL") || "https://financeiroop.vercel.app";
  var link   = vUrl + "/c/" + codigo;
  var nc  = aba.getLastColumn();
  var row = new Array(nc).fill("");
  function s(h, v) { if (cm[h] && cm[h] <= nc) row[cm[h]-1] = v; }
  s("ID_CERTIFICADO",  id);
  s("ID_CONTRATO",     idContrato);
  s("ID_CLIENTE",      idCliente);
  s("NOME_CLIENTE",    nomeCliente);
  s("CPF",             cpf);
  s("VALOR_TOTAL_PAGO",totalPago);
  s("DATA_QUITACAO",   datQuitacao instanceof Date ? datQuitacao : parseDateLocal(String(datQuitacao||"")));
  s("CODIGO_VALIDACAO",codigo);
  s("DATA_GERACAO",    new Date());
  s("STATUS",          "ativo");
  var ul = aba.getLastRow() + 1;
  aba.getRange(ul, 1, 1, nc).setValues([row]);
  if (cm["DATA_QUITACAO"])   aba.getRange(ul, cm["DATA_QUITACAO"]).setNumberFormat("dd/mm/yyyy");
  if (cm["DATA_GERACAO"])    aba.getRange(ul, cm["DATA_GERACAO"]).setNumberFormat("dd/mm/yyyy hh:mm");
  if (cm["VALOR_TOTAL_PAGO"])aba.getRange(ul, cm["VALOR_TOTAL_PAGO"]).setNumberFormat("R$ #,##0.00");
  return { idCertificado: id, codigoValidacao: codigo, linkCertificado: link };
}

function buscarCertificadoPublico(codigo) {
  if (!codigo) return { ok: false, erro: "Codigo ausente" };
  var aba = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(ABAS.CERTIFICADOS);
  if (!aba || aba.getLastRow() < 2) return { ok: false, erro: "Certificado nao encontrado" };
  var cm   = buildColMap(aba);
  var vals = aba.getDataRange().getValues();
  var cCod = (cm["CODIGO_VALIDACAO"]||8)-1;
  for (var i = 1; i < vals.length; i++) {
    if (String(vals[i][cCod]).trim() !== String(codigo).trim()) continue;
    var cpf = String(vals[i][(cm["CPF"]||5)-1]||"").replace(/\D/g,"").padStart(11,"0");
    var cpfMask = cpf.length >= 9
      ? "***." + cpf.slice(-8,-5) + "." + cpf.slice(-5,-2) + "-" + cpf.slice(-2)
      : "—";
    var vlPago = parseFloat(vals[i][(cm["VALOR_TOTAL_PAGO"]||6)-1]||0);
    var dtQuit = vals[i][(cm["DATA_QUITACAO"]||7)-1];
    var dtFmt  = dtQuit instanceof Date
      ? ("0"+dtQuit.getDate()).slice(-2) + "/" + ("0"+(dtQuit.getMonth()+1)).slice(-2) + "/" + dtQuit.getFullYear()
      : String(dtQuit||"");
    return {
      ok:              true,
      idCertificado:   String(vals[i][0]||""),
      idContrato:      String(vals[i][(cm["ID_CONTRATO"] ||2)-1]||""),
      nomeCliente:     String(vals[i][(cm["NOME_CLIENTE"]||4)-1]||""),
      cpfMascarado:    cpfMask,
      valorTotalPago:  vlPago,
      dataQuitacao:    dtFmt,
      codigoValidacao: String(vals[i][cCod]||""),
      status:          String(vals[i][(cm["STATUS"]||10)-1]||"")
    };
  }
  return { ok: false, erro: "Certificado nao encontrado" };
}

function _enviarWppCertificado(telefone, nome, link, idContrato) {
  var tel = String(telefone||"").replace(/\D/g,"");
  if (!tel || tel.length < 10) return;
  // Dedup: não reenvia se já enviou para este contrato
  var abaMsg = _abaMsg();
  var cmMsg  = buildColMap(abaMsg);
  if (abaMsg.getLastRow() >= 2) {
    var vMsg = abaMsg.getDataRange().getValues();
    var cGat = (cmMsg["GATILHO"]    ||7)-1;
    var cCtd = (cmMsg["ID_CONTRATO"]||4)-1;
    var cStM = (cmMsg["STATUS_ENVIO"]||9)-1;
    for (var i = 1; i < vMsg.length; i++) {
      if (String(vMsg[i][cGat]||"").trim() === "CERTIFICADO_QUITACAO" &&
          String(vMsg[i][cCtd]||"").trim() === String(idContrato).trim() &&
          String(vMsg[i][cStM]||"").trim() === "ENVIADO") {
        Logger.log("CertificadoWPP: ja enviado para " + idContrato);
        return;
      }
    }
  }
  var primeiroNome = String(nome||"").split(" ")[0];
  var tmpl = _getCfg("TEMPLATE_CERTIFICADO_QUITACAO") || _MSG_TEMPLATES["CERTIFICADO_QUITACAO"];
  var texto = tmpl
    .replace(/\{NOME\}/g,        primeiroNome)
    .replace(/\{ID_CONTRATO\}/g, idContrato)
    .replace(/\{LINK\}/g,        link);
  var ok = _enviarWppRegua(tel, texto);
  _logMensagem({
    idCliente: "", idContrato: idContrato, idParcela: "",
    telefone: tel, gatilho: "CERTIFICADO_QUITACAO",
    conteudo: texto, status: ok ? "ENVIADO" : "ERRO_ENVIO"
  });
  Logger.log("CertificadoWPP: " + (ok ? "OK" : "ERRO") + " → " + primeiroNome + " (" + tel + ")");
}

function _gerarEEnviarCertificado(idContrato, idCliente, nomeCliente, datPagamento) {
  var dados = _buscarDadosCertificado(idContrato, idCliente);
  var cert  = gerarCertificadoQuitacao({
    idContrato:  idContrato,
    idCliente:   idCliente,
    nomeCliente: nomeCliente || dados.nome,
    cpf:         dados.cpf,
    datQuitacao: datPagamento,
    totalPago:   dados.totalPago
  });
  registrarEvento({
    idContrato: idContrato, idCliente: idCliente, nomeCliente: nomeCliente || dados.nome,
    tipoEvento: "CERTIFICADO_GERADO",
    observacoes: "Cod: " + cert.codigoValidacao + " Link: " + cert.linkCertificado
  });
  if (dados.telefone) {
    _enviarWppCertificado(dados.telefone, nomeCliente || dados.nome, cert.linkCertificado, idContrato);
  }
  return cert;
}

function _buildTxid(idContrato, numParcela) {
  var num = parseInt(String(idContrato).replace(/\D/g, "")) || 0;
  return "FOP" + String(num).padStart(16, "0") + "P" + String(numParcela).padStart(6, "0");
}

function _gerarPixAvulso(idContrato, parcela, cliente) {
  var secret    = _getCfg("COBRANCA_SECRET");
  var vercelUrl = _getCfg("VERCEL_URL") || "https://financeiroop.vercel.app";
  try {
    var resp = UrlFetchApp.fetch(vercelUrl + "/api/efi-pix-avulso", {
      method: "post",
      contentType: "application/json",
      payload: JSON.stringify({
        idContrato: idContrato,
        parcela: {
          numParcela:    parcela.NUM_PARCELA,
          idParcela:     parcela.ID_PARCELA,
          dataVencimento:parcela._dtStr,
          valorParcela:  parcela.VALOR,
          totalParcelas: parcela._total
        },
        cliente: { nome: cliente.NOME, cpf: cliente.CPF }
      }),
      headers: { "x-cobranca-secret": secret },
      muteHttpExceptions: true
    });
    if (resp.getResponseCode() === 200) {
      var parsed = JSON.parse(resp.getContentText());
      return { pix: parsed.pixCopiaECola || null, txid: parsed.txid || null };
    }
    Logger.log("_gerarPixAvulso HTTP " + resp.getResponseCode() + ": " + resp.getContentText().slice(0,200));
  } catch(e) {
    Logger.log("_gerarPixAvulso err: " + e.message);
  }
  return null;
}

function _reRegistrarWebhookEfi() {
  var secret    = _getCfg("COBRANCA_SECRET");
  var vercelUrl = _getCfg("VERCEL_URL") || "https://financeiroop.vercel.app";
  try {
    var resp = UrlFetchApp.fetch(vercelUrl + "/api/efi-setup-webhook", {
      method: "post",
      contentType: "application/json",
      payload: "{}",
      headers: { "x-cobranca-secret": secret },
      muteHttpExceptions: true
    });
    var code = resp.getResponseCode();
    var body = resp.getContentText().slice(0, 300);
    Logger.log("_reRegistrarWebhookEfi: HTTP " + code + " — " + body);
    if (code !== 200) throw new Error("HTTP " + code + ": " + body);
    return true;
  } catch(e) {
    Logger.log("_reRegistrarWebhookEfi err: " + e.message);
    throw e;
  }
}

function reRegistrarWebhookEfiManual() {
  try {
    _reRegistrarWebhookEfi();
    SpreadsheetApp.getUi().alert("✅ Webhook Efí re-registrado com sucesso!");
  } catch(e) {
    SpreadsheetApp.getUi().alert("❌ Erro ao re-registrar webhook:\n" + e.message);
  }
}

function _enviarWppRegua(tel, texto) {
  var url      = _getCfg("EVOLUTION_URL");
  var key      = _getCfg("EVOLUTION_KEY");
  var instance = _getCfg("EVOLUTION_INSTANCE");
  if (!url || !key || !instance) { Logger.log("_enviarWppRegua: config Evolution ausente"); return false; }
  // Garante DDI 55 no número
  var numero = String(tel).replace(/\D/g,"");
  if (numero.length === 11) numero = "55" + numero;
  // Evolution GO usa /send/text (não /message/sendText/{instance})
  try {
    var resp = UrlFetchApp.fetch(url + "/send/text", {
      method: "post",
      contentType: "application/json",
      payload: JSON.stringify({ number: numero, text: texto, instanceId: instance }),
      headers: { apikey: key },
      muteHttpExceptions: true
    });
    var code = resp.getResponseCode();
    var ok = code === 200 || code === 201;
    if (!ok) Logger.log("_enviarWppRegua HTTP " + code + ": " + resp.getContentText().slice(0,300));
    return ok;
  } catch(e) {
    Logger.log("_enviarWppRegua err: " + e.message);
    return false;
  }
}

function enviarPixManual(dados) {
  try {
    var nome          = String(dados.nome          || "Cliente");
    var tel           = String(dados.telefone      || "");
    var numParcela    = parseInt(dados.numParcela  || 1);
    var totalParcelas = parseInt(dados.totalParcelas || 1);
    var valor         = parseFloat(dados.valorParcela || 0);
    var dataVenc      = dados.dataVencimento ? _fmtDataRegua(parseDateLocal(String(dados.dataVencimento))) : "";
    var pixCode       = String(dados.pixCode       || "");
    var idCliente     = dados.idCliente  || "";
    var idContrato    = dados.idContrato || "";
    var idParcela     = dados.idParcela  || "";

    if (!tel)     return { ok: false, erro: "Telefone ausente" };
    if (!pixCode) return { ok: false, erro: "Código PIX ausente" };

    var primeiroNome = nome.split(" ")[0];
    var fmtValor     = "R$ " + valor.toFixed(2).replace(".", ",");
    var msg1 = "Olá " + primeiroNome + "! 😊\n\n" +
               "Segue o código PIX para pagamento da *Parcela " + numParcela + " de " + totalParcelas + "*:\n\n" +
               "💰 Valor: *" + fmtValor + "*\n" +
               "📅 Vencimento: *" + dataVenc + "*\n\n" +
               "Cole o código abaixo no seu aplicativo bancário:";

    var ok1 = _enviarWppRegua(tel, msg1);
    Utilities.sleep(800);
    var ok2 = _enviarWppRegua(tel, pixCode);

    var status = (ok1 && ok2) ? "ENVIADO" : "ERRO_ENVIO";
    _logMensagem({
      idCliente: idCliente, idContrato: idContrato, idParcela: idParcela,
      telefone:  tel, gatilho: "PIX_MANUAL",
      conteudo:  msg1 + "\n\n" + pixCode.slice(0, 50) + "...",
      status:    status
    });

    if (!ok1 || !ok2) return { ok: false, erro: "Falha ao enviar via WhatsApp" };
    return { ok: true };
  } catch(e) {
    return { ok: false, erro: e.message };
  }
}

function _buildMsgRegua(template, vars) {
  var txt = template;
  Object.keys(vars).forEach(function(k) { txt = txt.split("{"+k+"}").join(vars[k]||""); });
  return txt;
}

function _fmtDataRegua(dt) {
  if (!dt) return "";
  var d = dt instanceof Date ? dt : new Date(dt);
  return (d.getDate()<10?"0":"")+d.getDate()+"/"+(d.getMonth()<9?"0":"")+(d.getMonth()+1)+"/"+d.getFullYear();
}

function _fmtValorRegua(v) {
  return parseFloat(v||0).toFixed(2).replace(".",",");
}

function _diffDiasRegua(dataVenc) {
  var hoje = new Date(); hoje.setHours(0,0,0,0);
  var dv   = dataVenc instanceof Date ? new Date(dataVenc.getTime()) : new Date(dataVenc);
  dv.setHours(0,0,0,0);
  return Math.round((dv - hoje) / 86400000);
}

var _MSG_TEMPLATES = {
  "CONFIRMACAO": "Olá, {NOME}.\n\nIdentificamos o pagamento da sua parcela {NUM_PARCELA} de {TOTAL_PARCELAS}.\n\nValor recebido: R$ {VALOR_PAGO}\n\nSeu pagamento foi registrado com sucesso.\n\nParcelas restantes: {PARCELAS_RESTANTES}\n\nPróximo vencimento: {PROXIMO_VENCIMENTO}\n\nAgradecemos pela confiança.\n\nBorges Assessoria",
  "D-5":        "Bom dia, {NOME}.\n\nPassando para lembrar que sua parcela {NUM_PARCELA} de {TOTAL_PARCELAS} vence em {DATA_VENCIMENTO}.\n\nValor da parcela: R$ {VALOR_PARCELA}\n\nCaso deseje antecipar o pagamento, o código PIX para pagamento está na mensagem a seguir.\n\nCaso já tenha efetuado o pagamento, por favor desconsidere esta mensagem.\n\nEsta é uma mensagem automática do sistema.",
  "D-1":        "Olá, {NOME}. Bom dia!\n\nLembramos que sua parcela {NUM_PARCELA} de {TOTAL_PARCELAS} vence amanhã, {DATA_VENCIMENTO}.\n\nValor da parcela: R$ {VALOR_PARCELA}\n\nRealizando o pagamento dentro do prazo você evita encargos adicionais e mantém seu contrato em dia.\n\nO código PIX para pagamento está na mensagem a seguir.\n\nCaso já tenha efetuado o pagamento, por favor desconsidere esta mensagem.\n\nEsta é uma mensagem automática do sistema.",
  "D0":         "Olá, {NOME}. Bom dia!\n\nPassando para lembrar que hoje vence sua parcela {NUM_PARCELA} de {TOTAL_PARCELAS}.\n\nValor da parcela: R$ {VALOR_PARCELA}\n\nPara evitar encargos adicionais, recomendamos que o pagamento seja realizado até o final do dia.\n\nO código PIX para pagamento está na mensagem a seguir.\n\nCaso já tenha efetuado o pagamento, por favor desconsidere esta mensagem.\n\nEsta é uma mensagem automática do sistema.",
  "D+1":        "Olá, {NOME}. Bom dia!\n\nIdentificamos que sua parcela {NUM_PARCELA} de {TOTAL_PARCELAS} ainda consta em aberto.\n\nValor da parcela: R$ {VALOR_PARCELA}\nOs encargos de mora são cobrados diretamente no PIX.\n\nSabemos que imprevistos acontecem. Caso o pagamento já tenha sido realizado, por favor desconsidere esta mensagem.\n\nO código PIX para pagamento está na mensagem a seguir.\n\nSe precisar de qualquer apoio, estamos à disposição.\n\nEsta é uma mensagem automática do sistema.",
  "D+3":        "Olá, {NOME}. Bom dia!\n\nVerificamos que sua parcela {NUM_PARCELA} de {TOTAL_PARCELAS} permanece em aberto.\n\nValor da parcela: R$ {VALOR_PARCELA}\nOs encargos de mora são cobrados diretamente no PIX.\n\nCaso ainda não tenha conseguido realizar o pagamento, pedimos que nos informe uma previsão para regularização.\n\nO código PIX para pagamento está na mensagem a seguir.\n\nManter uma boa comunicação é fundamental para encontrarmos a melhor solução.\n\nEsta é uma mensagem automática do sistema.",
  "D+7":        "Olá, {NOME}. Bom dia!\n\nSua parcela {NUM_PARCELA} de {TOTAL_PARCELAS} encontra-se em atraso há 7 dias.\n\nValor da parcela: R$ {VALOR_PARCELA}\nOs encargos de mora são cobrados diretamente no PIX.\n\nSolicitamos que a regularização seja realizada o quanto antes ou que nos informe uma previsão concreta de pagamento.\n\nO código PIX para pagamento está na mensagem a seguir.\n\nA ausência de pagamento e de comunicação poderá resultar na continuidade dos procedimentos de cobrança previstos contratualmente.\n\nEsta é uma mensagem automática do sistema.",
  "PROMESSA_D-1":"Olá, {NOME}. Bom dia!\n\nPassando para lembrar que amanhã vence o compromisso de pagamento informado por você.\n\nValor combinado: R$ {VALOR_COMBINADO}\n\nO código PIX para pagamento está na mensagem a seguir.\n\nCaso precise de qualquer suporte, permanecemos à disposição.\n\nEsta é uma mensagem automática do sistema.",
  "PROMESSA_D0": "Olá, {NOME}. Bom dia!\n\nConforme combinado anteriormente, o pagamento ficou previsto para hoje.\n\nValor combinado: R$ {VALOR_COMBINADO}\n\nO código PIX para pagamento está na mensagem a seguir.\n\nContamos com sua colaboração para o cumprimento do compromisso assumido.\n\nEsta é uma mensagem automática do sistema.",
  "PROMESSA_D+1":"Olá, {NOME}. Bom dia!\n\nVerificamos que o compromisso de pagamento previsto para {DATA_PROMESSA} ainda não foi identificado.\n\nValor combinado: R$ {VALOR_COMBINADO}\n\nO código PIX para pagamento está na mensagem a seguir.\n\nPedimos que nos informe uma nova previsão de pagamento para mantermos seu atendimento atualizado.\n\nA boa comunicação é fundamental para que possamos continuar auxiliando da melhor forma possível.\n\nEsta é uma mensagem automática do sistema.",
  "CERTIFICADO_QUITACAO": "Parabéns, {NOME}!\n\nSeu contrato {ID_CONTRATO} foi totalmente quitado.\n\nAgradecemos pela confiança.\n\nSeu comprovante de quitação está disponível no link abaixo:\n\n{LINK}\n\nCaso algum amigo ou familiar precise de crédito, teremos satisfação em atendê-lo por indicação."
};

var _GATILHO_PRIOR = {
  "PROMESSA_D+1":1,"PROMESSA_D0":2,"PROMESSA_D-1":3,
  "D+7":4,"D+3":5,"D+1":6,"D0":7,"D-1":8,"D-5":9
};

function testarReguaCobranca() {
  enviarReguaCobranca(true);
}

function testarEnvioWpp() {
  var url      = _getCfg("EVOLUTION_URL");
  var key      = _getCfg("EVOLUTION_KEY");
  var instance = _getCfg("EVOLUTION_INSTANCE");
  Logger.log("URL: " + url);
  Logger.log("Instance: " + instance);
  Logger.log("Key: " + (key ? key.slice(0,8)+"..." : "AUSENTE"));
  var ok = _enviarWppRegua(_getCfg("TEL_TESTE") || "5562984877843", "Teste da régua de cobrança Borges Assessoria. " + new Date().toLocaleString("pt-BR"));
  Logger.log("Resultado: " + (ok ? "ENVIADO ✓" : "FALHOU ✗"));
}

function diagnosticarEvolution() {
  var baseUrl  = _getCfg("EVOLUTION_URL");
  var key      = _getCfg("EVOLUTION_KEY");
  var instance = _getCfg("EVOLUTION_INSTANCE");
  var num      = "5562984877843";
  var hdrs     = { apikey: key };
  var endpoint = baseUrl + "/send/text";

  var corpos = [
    { phone: num,                          message: "teste", instanceId: instance },
    { phone: num + "@s.whatsapp.net",      message: "teste", instanceId: instance },
    { phone: num,                          message: "teste" },
    { number: num,                         text:    "teste", instanceId: instance },
    { number: num + "@s.whatsapp.net",     text:    "teste", instanceId: instance },
    { to:    num,                          message: "teste", instanceId: instance },
  ];

  corpos.forEach(function(corpo) {
    try {
      var r = UrlFetchApp.fetch(endpoint, {
        method: "post", contentType: "application/json",
        payload: JSON.stringify(corpo), headers: hdrs, muteHttpExceptions: true
      });
      Logger.log(r.getResponseCode() + " | body=" + JSON.stringify(corpo) + " | resp=" + r.getContentText().slice(0,100));
    } catch(e) {
      Logger.log("ERRO | " + e.message);
    }
  });
}

function enviarReguaCobranca(dryRun) {
  dryRun = dryRun === true;
  if (dryRun) Logger.log("REGUA [DRY-RUN]: nenhuma mensagem será enviada");
  var startTime = Date.now();
  var MAX_MS    = 8 * 60 * 1000;

  _garantirConfigsRegua();
  var ss = SpreadsheetApp.getActiveSpreadsheet();

  var abaCli  = ss.getSheetByName(ABAS.CLIENTES);
  var abaC    = ss.getSheetByName(ABAS.CONTRATOS);
  var abaP    = ss.getSheetByName(ABAS.PARCELAS);
  var abaProm = ss.getSheetByName(ABAS.PROMESSAS);
  if (!abaCli || !abaC || !abaP) { Logger.log("REGUA: abas ausentes"); return; }

  _garantirColunasEfiParcelas();

  var cmCli  = buildColMap(abaCli);  var dCli  = abaCli.getDataRange().getValues();
  var cmC    = buildColMap(abaC);    var dC    = abaC.getDataRange().getValues();
  var cmP    = buildColMap(abaP);    var dP    = abaP.getDataRange().getValues();
  var cmProm = abaProm ? buildColMap(abaProm) : {};
  var dProm  = abaProm ? abaProm.getDataRange().getValues() : [];

  var ST_SKIP_C   = {quitado:1,cancelado:1,baixado_como_prejuizo:1,acordo_assistido:1,
                     encerrado_sem_recuperacao:1,recuperado_parcialmente:1,recuperado_integralmente:1,em_processo_judicial:1};
  var ST_SKIP_P   = {pago:1,quitacao_antecipada:1,baixado_como_prejuizo:1,cancelado:1,renegociado:1};

  // Índices CLIENTES
  var iCId   = (cmCli["ID_CLIENTE"]     ||1)-1;
  var iCNome = (cmCli["NOME"]           ||2)-1;
  var iCTel  = (cmCli["TELEFONE_WPP"]   ||8)-1;
  var iCCpf  = (cmCli["CPF"]            ||3)-1;
  var iCSt   = (cmCli["STATUS_CLIENTE"] ||26)-1;
  var iCPerf = cmCli["PERFIL_COBRANCA"] ? cmCli["PERFIL_COBRANCA"]-1 : -1;

  // Índices CONTRATOS
  var icId   = (cmC["ID_CONTRATO"]   ||1)-1;
  var icCli  = (cmC["ID_CLIENTE"]    ||2)-1;
  var icSt   = (cmC["STATUS_CONTRATO"]||5)-1;

  // Índices PARCELAS
  var ipId   = (cmP["ID_PARCELA"]    ||1)-1;
  var ipCont = (cmP["ID_CONTRATO"]   ||2)-1;
  var ipNum  = (cmP["NUM_PARCELA"]   ||3)-1;
  var ipDtV  = (cmP["DATA_VENCIMENTO"]||7)-1;
  var ipVal  = (cmP["VALOR_PARCELA"] || cmP["VALOR"] || 8)-1;
  var ipSt   = (cmP["STATUS"]        ||11)-1;
  var ipPix  = cmP["EFI_PIX_CODE"] ? cmP["EFI_PIX_CODE"]-1 : -1;
  var ipTxid = cmP["EFI_TXID"]     ? cmP["EFI_TXID"]-1     : -1;

  // Mapa de clientes
  var cliMap = {};
  for (var i = 1; i < dCli.length; i++) {
    var id = String(dCli[i][iCId]||"").trim(); if (!id) continue;
    cliMap[id] = {
      ID_CLIENTE:     id,
      NOME:           String(dCli[i][iCNome]||"").trim(),
      TELEFONE_WPP:   String(dCli[i][iCTel] ||"").replace(/\D/g,""),
      CPF:            String(dCli[i][iCCpf]  ||"").replace(/\D/g,""),
      STATUS_CLIENTE: String(dCli[i][iCSt]   ||"").trim().toLowerCase(),
      PERFIL:         iCPerf >= 0 ? String(dCli[i][iCPerf]||"").trim().toUpperCase() : ""
    };
  }

  // Mapa de contratos
  var contMap = {};
  for (var i = 1; i < dC.length; i++) {
    var idC = String(dC[i][icId]||"").trim(); if (!idC) continue;
    contMap[idC] = {
      ID_CONTRATO:     idC,
      ID_CLIENTE:      String(dC[i][icCli]||"").trim(),
      STATUS_CONTRATO: String(dC[i][icSt] ||"").trim().toLowerCase()
    };
  }

  // Total de parcelas por contrato
  var totalParcMap = {};
  for (var i = 1; i < dP.length; i++) {
    var idC2 = String(dP[i][ipCont]||"").trim(); if (!idC2) continue;
    totalParcMap[idC2] = (totalParcMap[idC2]||0) + 1;
  }

  // Promessas ativas por cliente
  var promMap = {};
  if (abaProm && cmProm["STATUS_PROMESSA"]) {
    var iprCli  = cmProm["ID_CLIENTE"]              ? cmProm["ID_CLIENTE"]-1              : -1;
    var iprCont = cmProm["ID_CONTRATO"]             ? cmProm["ID_CONTRATO"]-1             : -1;
    var iprDt   = cmProm["DATA_PREVISTA_PAGAMENTO"] ? cmProm["DATA_PREVISTA_PAGAMENTO"]-1 : -1;
    var iprVal  = cmProm["VALOR_PROMETIDO"]         ? cmProm["VALOR_PROMETIDO"]-1         : -1;
    var iprSt   = cmProm["STATUS_PROMESSA"]         ? cmProm["STATUS_PROMESSA"]-1         : -1;
    for (var i = 1; i < dProm.length; i++) {
      if (iprSt < 0) continue;
      if (String(dProm[i][iprSt]||"").trim().toUpperCase() !== "PENDENTE") continue;
      var idCliP = iprCli >= 0 ? String(dProm[i][iprCli]||"").trim() : ""; if (!idCliP) continue;
      if (!promMap[idCliP]) promMap[idCliP] = [];
      promMap[idCliP].push({
        ID_CONTRATO:    iprCont >= 0 ? String(dProm[i][iprCont]||"").trim() : "",
        DATA_PREVISTA:  iprDt  >= 0 ? dProm[i][iprDt]  : null,
        VALOR_PROMETIDO:iprVal >= 0 ? parseFloat(dProm[i][iprVal]||0) : 0
      });
    }
  }

  // Coletar eventos
  var eventos = [];

  // Parcelas normais (sem promessa ativa)
  for (var i = 1; i < dP.length; i++) {
    var stPar = String(dP[i][ipSt]||"").trim().toLowerCase();
    if (ST_SKIP_P[stPar]) continue;
    var idContP = String(dP[i][ipCont]||"").trim(); if (!idContP) continue;
    var cont    = contMap[idContP]; if (!cont) continue;
    if (ST_SKIP_C[cont.STATUS_CONTRATO]) continue;
    var idCli   = cont.ID_CLIENTE;
    var cli     = cliMap[idCli]; if (!cli) continue;
    if (!cli.TELEFONE_WPP) continue;
    if (cli.PERFIL === "EVASIVO") continue;
    if (cli.STATUS_CLIENTE === "bloqueado") continue;
    if (promMap[idCli] && promMap[idCli].length > 0) continue; // tem promessa ativa

    var dtV = dP[i][ipDtV]; if (!dtV) continue;
    var dias = _diffDiasRegua(dtV);
    var gatilho = null;
    if      (dias ===  5) gatilho = "D-5";
    else if (dias ===  1) gatilho = "D-1";
    else if (dias ===  0) gatilho = "D0";
    else if (dias === -1) gatilho = "D+1";
    else if (dias === -3) gatilho = "D+3";
    else if (dias === -7) gatilho = "D+7";
    if (!gatilho) continue;

    var pixCode  = ipPix  >= 0 ? String(dP[i][ipPix] ||"").trim() : "";
    var txidCode = ipTxid >= 0 ? String(dP[i][ipTxid]||"").trim() : "";
    var dtStr   = dtV instanceof Date ? Utilities.formatDate(dtV,"America/Sao_Paulo","yyyy-MM-dd") : String(dtV).split("T")[0];

    eventos.push({
      prior: _GATILHO_PRIOR[gatilho], gatilho: gatilho,
      idCliente: idCli, idContrato: idContP,
      idParcela: String(dP[i][ipId]||"").trim(),
      numParcela: dP[i][ipNum], totalParcelas: totalParcMap[idContP]||1,
      dataVencimento: dtV, _dtStr: dtStr, _row: i+1,
      valor: parseFloat(dP[i][ipVal]||0), pixCode: pixCode, txidCode: txidCode,
      isPromessa: false
    });
  }

  // Promessas
  for (var idCliP in promMap) {
    var cli = cliMap[idCliP]; if (!cli || !cli.TELEFONE_WPP) continue;
    if (cli.PERFIL === "EVASIVO") continue;
    var prom   = promMap[idCliP][0];
    var dtProm = prom.DATA_PREVISTA; if (!dtProm) continue;
    var diasP  = _diffDiasRegua(dtProm);
    var gatP   = null;
    if      (diasP ===  1) gatP = "PROMESSA_D-1";
    else if (diasP ===  0) gatP = "PROMESSA_D0";
    else if (diasP === -1) gatP = "PROMESSA_D+1";
    if (!gatP) continue;

    // PIX: primeira parcela aberta do contrato
    var pixP = "";
    if (prom.ID_CONTRATO && ipPix >= 0) {
      for (var j = 1; j < dP.length; j++) {
        if (String(dP[j][ipCont]||"").trim() !== prom.ID_CONTRATO) continue;
        if (ST_SKIP_P[String(dP[j][ipSt]||"").trim().toLowerCase()]) continue;
        pixP = String(dP[j][ipPix]||"").trim();
        break;
      }
    }

    eventos.push({
      prior: _GATILHO_PRIOR[gatP], gatilho: gatP,
      idCliente: idCliP, idContrato: prom.ID_CONTRATO,
      idParcela: "", numParcela: "", totalParcelas: "",
      dataVencimento: dtProm, _dtStr: "", _row: -1,
      valor: prom.VALOR_PROMETIDO, pixCode: pixP,
      isPromessa: true, dataPromessa: dtProm, valorPrometido: prom.VALOR_PROMETIDO
    });
  }

  // Ordena por prioridade e deduplica por cliente
  eventos.sort(function(a,b){ return a.prior - b.prior; });
  var cliVisto = {};
  var fila = [];
  for (var i = 0; i < eventos.length; i++) {
    if (cliVisto[eventos[i].idCliente]) continue;
    cliVisto[eventos[i].idCliente] = true;
    fila.push(eventos[i]);
  }

  Logger.log("REGUA: " + fila.length + " mensagens a enviar");

  var enviados = 0, erros = 0;
  for (var i = 0; i < fila.length; i++) {
    if (Date.now() - startTime > MAX_MS) {
      Logger.log("REGUA: tempo limite atingido em " + i + "/" + fila.length);
      break;
    }

    var ev  = fila[i];
    var cli = cliMap[ev.idCliente]; if (!cli) continue;
    if (_jaEnviouHoje(ev.idCliente)) { Logger.log("REGUA: " + cli.NOME + " ja recebeu hoje"); continue; }

    // PIX — gerar se ausente
    var pix  = ev.pixCode;
    var txid = ev.txidCode;
    if (!pix && !ev.isPromessa && ev.idParcela) {
      var pixResult = _gerarPixAvulso(ev.idContrato, {
        NUM_PARCELA: ev.numParcela, ID_PARCELA: ev.idParcela,
        VALOR: ev.valor, _dtStr: ev._dtStr, _total: ev.totalParcelas
      }, cli);
      if (pixResult) {
        pix  = pixResult.pix;
        txid = pixResult.txid;
        if (ev._row > 0) {
          if (pix  && ipPix  >= 0) abaP.getRange(ev._row, ipPix +1).setValue(pix);
          if (txid && ipTxid >= 0) abaP.getRange(ev._row, ipTxid+1).setValue(txid);
          SpreadsheetApp.flush();
        }
      }
    } else if (pix && !txid && !ev.isPromessa && ev.idParcela && ev._row > 0 && ipTxid >= 0) {
      // PIX já existia mas TXID nunca foi salvo — backfill determinístico
      txid = _buildTxid(ev.idContrato, ev.numParcela);
      abaP.getRange(ev._row, ipTxid+1).setValue(txid);
      SpreadsheetApp.flush();
    }

    if (!pix) {
      Logger.log("REGUA: sem PIX para " + ev.idParcela + " (" + ev.gatilho + "), pulando");
      if (!dryRun) {
        try {
          _logMensagem({ idCliente:ev.idCliente, idContrato:ev.idContrato, idParcela:ev.idParcela,
                         telefone:cli.TELEFONE_WPP, gatilho:ev.gatilho, conteudo:"SEM_PIX", status:"ERRO_SEM_PIX" });
        } catch(eLogSemPix) { Logger.log("REGUA: log sem-pix falhou → " + eLogSemPix.message); }
      }
      erros++;
      continue;
    }

    var nome  = cli.NOME.split(" ")[0];
    var _tmpl = _getCfg("TEMPLATE_" + ev.gatilho) || _MSG_TEMPLATES[ev.gatilho];
    var texto = _buildMsgRegua(_tmpl, {
      NOME:           nome,
      NUM_PARCELA:    ev.numParcela,
      TOTAL_PARCELAS: ev.totalParcelas,
      DATA_VENCIMENTO:_fmtDataRegua(ev.dataVencimento),
      VALOR_PARCELA:  _fmtValorRegua(ev.valor),
      PIX:            pix,
      DATA_PROMESSA:  _fmtDataRegua(ev.dataPromessa),
      VALOR_COMBINADO:_fmtValorRegua(ev.valorPrometido)
    });

    if (dryRun) {
      Logger.log("REGUA [DRY-RUN] [" + ev.gatilho + "] " + cli.NOME + " (" + cli.TELEFONE_WPP + ")\n---\n" + texto + "\n[PIX separado]: " + pix + "\n---");
      enviados++;
      continue;
    }

    var ok = _enviarWppRegua(cli.TELEFONE_WPP, texto);
    if (ok) {
      Utilities.sleep(3000);
      var okPix = _enviarWppRegua(cli.TELEFONE_WPP, pix);
      if (!okPix) {
        // 1 retentativa — falha do 2º envio (código PIX) costuma ser transitória
        Utilities.sleep(2000);
        okPix = _enviarWppRegua(cli.TELEFONE_WPP, pix);
      }
      if (!okPix) {
        Logger.log("REGUA: [ERRO_PIX] codigo PIX nao enviado → " + cli.NOME);
        // Sem isso o status da mensagem 1 (ENVIADO) mascarava a falha da mensagem 2 —
        // cliente recebia o texto mas nunca o código PIX, e ninguém via o erro.
        try {
          _logMensagem({ idCliente:ev.idCliente, idContrato:ev.idContrato, idParcela:ev.idParcela,
                         telefone:cli.TELEFONE_WPP, gatilho:ev.gatilho, conteudo:"ERRO_PIX_NAO_ENVIADO: "+pix,
                         status:"ERRO_PIX" });
        } catch(eLogPix) { Logger.log("REGUA: log erro pix falhou → " + eLogPix.message); }
      }
    }
    Logger.log("REGUA: [" + (ok?"OK":"ERRO") + "] " + ev.gatilho + " → " + cli.NOME);

    try {
      _logMensagem({ idCliente:ev.idCliente, idContrato:ev.idContrato, idParcela:ev.idParcela,
                     telefone:cli.TELEFONE_WPP, gatilho:ev.gatilho, conteudo:texto,
                     status: ok ? "ENVIADO" : "ERRO_ENVIO" });
    } catch(eLog) { Logger.log("REGUA: log err → " + eLog.message); }

    if (ok) enviados++; else erros++;

    // Delay aleatório 3-6 segundos entre envios
    if (i < fila.length - 1) Utilities.sleep(3000 + Math.floor(Math.random() * 3001));
  }

  Logger.log("REGUA: concluida. Enviados=" + enviados + " Erros=" + erros);
  return {ok:true, enviados:enviados, erros:erros};
}

// ─── PIX: Diagnóstico de parcelas (READ-ONLY) ────────────────────────────────

function auditarPixParcelas() {
  var ss  = SpreadsheetApp.getActiveSpreadsheet();
  var shP = ss.getSheetByName("PARCELAS");
  if (!shP) { SpreadsheetApp.getUi().alert("Aba PARCELAS não encontrada"); return; }

  var cm   = buildColMap(shP);
  var rows = shP.getDataRange().getValues();

  var stCol  = cm["STATUS"];
  var txCol  = cm["EFI_TXID"];
  var pixCol = cm["EFI_PIX_CODE"];
  var valCol = cm["VALOR_PARCELA"];
  var idCol  = cm["ID_PARCELA"];
  var cCol   = cm["ID_CONTRATO"];
  var numCol = cm["NUM_PARCELA"];

  var semNenhum = [], temTxidSemPix = [], temPixSemTxid = [], temAmbos = [], terminal = 0, total = 0;

  for (var i = 1; i < rows.length; i++) {
    var idP  = String(rows[i][(idCol||1)-1]||"").trim();
    if (!idP) continue;
    total++;

    var st   = stCol  ? String(rows[i][stCol -1]||"").toLowerCase().trim() : "";
    if (STATUS_TERMINAL[st]) { terminal++; continue; }

    var idC  = String(rows[i][(cCol ||2)-1]||"").trim();
    var num  = String(rows[i][(numCol||3)-1]||"").trim();
    var val  = valCol ? parseFloat(rows[i][valCol-1]||0) : 0;
    var txid = txCol  ? String(rows[i][txCol -1]||"").trim() : "";
    var pix  = pixCol ? String(rows[i][pixCol-1]||"").trim() : "";
    var desc = "L" + (i+1) + " | " + idC + " parc#" + num + " | R$" + val.toFixed(2) + " | " + st;

    if (!txid && !pix)  { semNenhum.push(desc);    continue; }
    if (txid  && !pix)  { temTxidSemPix.push(desc); continue; }
    if (!txid && pix)   { temPixSemTxid.push(desc); continue; }
    temAmbos.push(desc);
  }

  var msg = "AUDITORIA PIX — PARCELAS\n\n"
    + "Total: " + total + " | Terminal (pago/etc): " + terminal + "\n\n"
    + "─── PARCELAS ABERTAS ───\n"
    + "✅ Com TXID + PIX code: " + temAmbos.length + "\n"
    + "⚠️  Com TXID, sem PIX code: " + temTxidSemPix.length + "\n"
    + "⚠️  Com PIX code, sem TXID: " + temPixSemTxid.length + "\n"
    + "🔴 Sem nenhum (aguardando geração): " + semNenhum.length + "\n";

  if (temTxidSemPix.length) {
    msg += "\n─── TXID sem PIX (provável cobv CONCLUIDA) ───\n"
      + temTxidSemPix.slice(0, 15).join("\n");
    if (temTxidSemPix.length > 15) msg += "\n... e mais " + (temTxidSemPix.length - 15);
  }
  if (temPixSemTxid.length) {
    msg += "\n─── PIX sem TXID (backfill necessário) ───\n"
      + temPixSemTxid.slice(0, 10).join("\n");
    if (temPixSemTxid.length > 10) msg += "\n... e mais " + (temPixSemTxid.length - 10);
  }

  Logger.log(msg);
  SpreadsheetApp.getUi().alert(msg);
}

// ─── PIX: Limpa colunas EFI de todas as parcelas abertas p/ regeneração ──────

function limparPixAbertosParaRegeneracao() {
  var ui = SpreadsheetApp.getUi();
  var conf = ui.alert(
    "CONFIRMAÇÃO NECESSÁRIA",
    "Esta ação vai apagar EFI_TXID e EFI_PIX_CODE de TODAS as parcelas abertas (não pagas).\n\n"
    + "• Parcelas pagas/canceladas NÃO serão tocadas.\n"
    + "• Depois, rode: PIX → Gerar Todos Contratos.\n\n"
    + "Continuar?",
    ui.ButtonSet.YES_NO
  );
  if (conf !== ui.Button.YES) return;

  var ss  = SpreadsheetApp.getActiveSpreadsheet();
  var shP = ss.getSheetByName("PARCELAS");
  if (!shP) { ui.alert("Aba PARCELAS não encontrada"); return; }

  var cm   = buildColMap(shP);
  var rows = shP.getDataRange().getValues();
  var stCol  = cm["STATUS"];
  var txCol  = cm["EFI_TXID"];
  var pixCol = cm["EFI_PIX_CODE"];

  if (!txCol || !pixCol) { ui.alert("Colunas EFI_TXID ou EFI_PIX_CODE não encontradas.\nRode primeiro: Configurar Sistema."); return; }

  var limpos = 0;
  for (var i = 1; i < rows.length; i++) {
    var st   = stCol ? String(rows[i][stCol-1]||"").toLowerCase().trim() : "";
    if (STATUS_TERMINAL[st]) continue; // não toca parcelas terminais

    var txid = String(rows[i][txCol-1]||"").trim();
    var pix  = String(rows[i][pixCol-1]||"").trim();
    if (!txid && !pix) continue; // já vazia, nada a fazer

    shP.getRange(i + 1, txCol).clearContent();
    shP.getRange(i + 1, pixCol).clearContent();
    limpos++;
  }

  SpreadsheetApp.flush();
  Logger.log("limparPixAbertosParaRegeneracao: " + limpos + " parcelas limpas");
  ui.alert(
    "Limpeza concluída!\n\n"
    + "✅ " + limpos + " parcelas abertas tiveram EFI_TXID e EFI_PIX_CODE apagados.\n\n"
    + "Próximo passo: PIX → Gerar Todos Contratos"
  );
}

function registrarPagamentosManual() {
  var r1 = pagamentoAutomatico(216, 1, 493.33, "2026-06-15T21:26:37");
  Logger.log("Andre 216/1: " + JSON.stringify(r1));
  Utilities.sleep(2000);
  var r2 = pagamentoAutomatico(214, 1, 453.33, "2026-06-15T15:32:29");
  Logger.log("Jeovanio 214/1: " + JSON.stringify(r2));
}

function backfillEfiTxid() {
  _garantirColunasEfiParcelas();

  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sh = ss.getSheetByName(ABAS.PARCELAS);
  if (!sh) { Logger.log("backfillEfiTxid: aba PARCELAS nao encontrada"); return; }

  var cm    = buildColMap(sh);
  var txCol = cm["EFI_TXID"];
  var pixCol = cm["EFI_PIX_CODE"];
  var idCCol = cm["ID_CONTRATO"];
  var numCol = cm["NUM_PARCELA"];

  if (!txCol)  { Logger.log("backfillEfiTxid: coluna EFI_TXID nao encontrada"); return; }
  if (!pixCol) { Logger.log("backfillEfiTxid: coluna EFI_PIX_CODE nao encontrada"); return; }

  var rows = sh.getDataRange().getValues();
  var corrigidos = 0, pulados = 0;

  for (var i = 1; i < rows.length; i++) {
    var txid    = String(rows[i][txCol  - 1] || "").trim();
    var pixCode = String(rows[i][pixCol - 1] || "").trim();
    var idCont  = String(rows[i][(idCCol || 2) - 1] || "").trim();
    var numPar  = parseInt(rows[i][(numCol || 3) - 1] || 0);

    if (txid)    { pulados++; continue; }
    if (!pixCode) continue;
    if (!idCont || isNaN(numPar) || numPar < 1) continue;

    var novoTxid = _buildTxid(idCont, numPar);
    sh.getRange(i + 1, txCol).setValue(novoTxid);
    corrigidos++;
  }

  SpreadsheetApp.flush();
  Logger.log("backfillEfiTxid: " + corrigidos + " TXIDs preenchidos / " + pulados + " já tinham TXID");
  SpreadsheetApp.getUi().alert("Backfill concluído!\n\n✅ " + corrigidos + " TXIDs preenchidos\n⏭ " + pulados + " já tinham TXID");
}

function gerarPixTodosContratos() {
  _garantirColunasEfiParcelas();
  var startTime = Date.now();
  var MAX_MS    = 5 * 60 * 1000;

  var ss    = SpreadsheetApp.getActiveSpreadsheet();
  var shP   = ss.getSheetByName(ABAS.PARCELAS);
  var shC   = ss.getSheetByName(ABAS.CONTRATOS);
  var shCli = ss.getSheetByName(ABAS.CLIENTES);
  if (!shP || !shC || !shCli) { Logger.log("gerarPixTodosContratos: aba ausente"); return; }

  var cmP   = buildColMap(shP);
  var cmC   = buildColMap(shC);
  var cmCli = buildColMap(shCli);

  // Mapa de clientes
  var dCli = shCli.getDataRange().getValues();
  var cliMap = {};
  for (var i = 1; i < dCli.length; i++) {
    var cId = String(dCli[i][(cmCli["ID_CLIENTE"]||1)-1]||"").trim();
    if (!cId) continue;
    cliMap[cId] = {
      nome: String(dCli[i][(cmCli["NOME"]||2)-1]||"").trim(),
      cpf:  String(dCli[i][(cmCli["CPF"] ||3)-1]||"").replace(/\D/g,"").padStart(11,"0")
    };
  }

  // Contratos ativos → cliente
  var dC = shC.getDataRange().getValues();
  var contCliMap = {};
  var ST_SKIP_C = {quitado:1,cancelado:1,baixado_como_prejuizo:1,
                   encerrado_sem_recuperacao:1,recuperado_integralmente:1};
  for (var i = 1; i < dC.length; i++) {
    var idC = String(dC[i][(cmC["ID_CONTRATO"]   ||1)-1]||"").trim();
    var stC = String(dC[i][(cmC["STATUS_CONTRATO"]||5)-1]||"").toLowerCase().trim();
    if (!idC || ST_SKIP_C[stC]) continue;
    contCliMap[idC] = String(dC[i][(cmC["ID_CLIENTE"]||2)-1]||"").trim();
  }

  // Parcelas sem EFI_PIX_CODE ou sem EFI_TXID
  var txCol  = cmP["EFI_TXID"];
  var pixCol = cmP["EFI_PIX_CODE"];
  var esCol  = cmP["EFI_STATUS"];
  var stCol  = cmP["STATUS"] || cmP["STATUS_PAGAMENTO"];
  var ST_SKIP_P = {pago:1,quitacao_antecipada:1,baixado_como_prejuizo:1,cancelado:1,renegociado:1};

  var rows = shP.getDataRange().getValues();
  var byContrato = {}; // idContrato → [{row, idParcela, numParcela, totalParcelas, dtVencStr, valor}]

  for (var i = 1; i < rows.length; i++) {
    var txid   = txCol  ? String(rows[i][txCol -1]||"").trim() : "";
    var pix    = pixCol ? String(rows[i][pixCol-1]||"").trim() : "";
    var st     = stCol  ? String(rows[i][stCol -1]||"").toLowerCase().trim() : "";
    if (txid && pix) continue;
    if (ST_SKIP_P[st]) continue;
    var idCont = String(rows[i][(cmP["ID_CONTRATO"]   ||2)-1]||"").trim(); if (!idCont) continue;
    if (!contCliMap[idCont]) continue;

    var dtV = rows[i][(cmP["DATA_VENCIMENTO"]||7)-1];
    var dtStr = dtV instanceof Date
      ? Utilities.formatDate(dtV, "America/Sao_Paulo", "yyyy-MM-dd")
      : String(dtV||"").split("T")[0];

    if (!byContrato[idCont]) byContrato[idCont] = [];
    byContrato[idCont].push({
      row:          i + 1,
      idParcela:    String(rows[i][(cmP["ID_PARCELA"]    ||1)-1]||"").trim(),
      numParcela:   parseInt(rows[i][(cmP["NUM_PARCELA"] ||3)-1]||0),
      totalParcelas:parseInt(rows[i][(cmP["TOTAL_PARCELAS"]||6)-1]||0),
      dtVencStr:    dtStr,
      valor:        parseFloat(rows[i][(cmP["VALOR_PARCELA"]||8)-1]||0)
    });
  }

  var contratos   = Object.keys(byContrato);
  var totalContr  = contratos.length;
  var vercelUrl   = _getCfg("VERCEL_URL") || "https://financeiroop.vercel.app";
  var processados = 0, erros = 0, contProcessados = 0;

  Logger.log("gerarPixTodosContratos: " + totalContr + " contratos com parcelas sem PIX");

  for (var c = 0; c < contratos.length; c++) {
    if (Date.now() - startTime > MAX_MS) {
      Logger.log("gerarPixTodosContratos: tempo limite — " + contProcessados + "/" + totalContr + " contratos processados");
      break;
    }

    var idC    = contratos[c];
    var parcs  = byContrato[idC];
    var idCli  = contCliMap[idC];
    var cli    = cliMap[idCli] || {nome:"", cpf:""};

    var payload = JSON.stringify({
      idContrato: idC,
      parcelas: parcs.map(function(p) {
        return { idParcela:p.idParcela, numParcela:p.numParcela,
                 totalParcelas:p.totalParcelas, dataVencimento:p.dtVencStr,
                 valorParcela:p.valor };
      }),
      cliente: { nome: cli.nome, cpf: cli.cpf }
    });

    try {
      var resp = UrlFetchApp.fetch(vercelUrl + "/api/efi-charges", {
        method: "post", contentType: "application/json",
        payload: payload, muteHttpExceptions: true
      });

      if (resp.getResponseCode() !== 200) {
        Logger.log("gerarPixTodosContratos: HTTP " + resp.getResponseCode() + " contrato " + idC);
        erros++;
        contProcessados++;
        continue;
      }

      var data = JSON.parse(resp.getContentText());
      if (!data.ok) {
        Logger.log("gerarPixTodosContratos: API erro contrato " + idC + ": " + resp.getContentText().slice(0,200));
        erros++;
        contProcessados++;
        continue;
      }

      (data.boletos || []).forEach(function(b) {
        var p = parcs.filter(function(x){ return x.numParcela === b.numParcela; })[0];
        if (!p) return;
        if (b.txid         && txCol)  shP.getRange(p.row, txCol ).setValue(b.txid);
        if (b.pixCopiaECola && pixCol) shP.getRange(p.row, pixCol).setValue(b.pixCopiaECola);
        if (esCol)                     shP.getRange(p.row, esCol ).setValue(b.status || "ativo");
        if (b.ok) processados++;
      });

      SpreadsheetApp.flush();
      Logger.log("gerarPixTodosContratos: contrato " + idC + " — " + parcs.length + " parcelas");
    } catch(e) {
      Logger.log("gerarPixTodosContratos: excecao contrato " + idC + ": " + e.message);
      erros++;
    }

    contProcessados++;
    Utilities.sleep(500);
  }

  var restantes = totalContr - contProcessados;
  var msg = "✅ " + processados + " PIX gerados\n❌ " + erros + " erros\n📦 " + contProcessados + "/" + totalContr + " contratos";
  if (restantes > 0) msg += "\n\n⚠️ " + restantes + " contratos restantes — rode novamente para continuar.";
  Logger.log("gerarPixTodosContratos: " + msg);
  SpreadsheetApp.getUi().alert("Gerar PIX — Concluído\n\n" + msg);
}

// ── MÓDULO JURÍDICO ──────────────────────────────────────────────

var _JURI_COLS = [
  "NUMERO_PROCESSO","DATA_AJUIZAMENTO","VARA","COMARCA",
  "STATUS_PROCESSO","VALOR_EXECUTADO","OBSERVACOES_JURIDICAS",
  "LINK_PROCESSO","CODIGO_ACESSO_PROCESSO","PROXIMA_ACAO",
  "DATA_PROXIMA_ACAO","ULTIMA_MOVIMENTACAO","DATA_ULTIMA_MOVIMENTACAO"
];

function _garantirColunasJuridicas(abaC, cmC) {
  _JURI_COLS.forEach(function(col) {
    if (!cmC[col]) {
      var nc = abaC.getLastColumn() + 1;
      abaC.getRange(1, nc).setValue(col).setFontWeight("bold").setBackground("#1a1a2e").setFontColor("#ffffff");
      cmC[col] = nc;
    }
  });
}

function ajuizarContrato(idContrato, dados) {
  var ss     = SpreadsheetApp.getActiveSpreadsheet();
  var abaC   = ss.getSheetByName(ABAS.CONTRATOS);
  var abaCli = ss.getSheetByName(ABAS.CLIENTES);
  if (!abaC || !abaCli) throw new Error("Aba não encontrada");

  var cmC    = buildColMap(abaC);
  var dadosC = abaC.getDataRange().getValues();
  var cmCli  = buildColMap(abaCli);
  var dadosCli = abaCli.getDataRange().getValues();

  var rowContrato = -1;
  var idCliente = "";
  var nomeCliente = "";
  var statusAnterior = "";
  for (var i = 1; i < dadosC.length; i++) {
    if (String(dadosC[i][(cmC["ID_CONTRATO"]||1)-1]).trim() === String(idContrato).trim()) {
      rowContrato   = i + 1;
      idCliente     = String(dadosC[i][(cmC["ID_CLIENTE"]||2)-1]).trim();
      nomeCliente   = String(dadosC[i][(cmC["NOME_CLIENTE"]||3)-1]||"");
      statusAnterior = String(dadosC[i][(cmC["STATUS_CONTRATO"]||16)-1]||"");
      break;
    }
  }
  if (rowContrato < 0) throw new Error("Contrato não encontrado: " + idContrato);

  _garantirColunasJuridicas(abaC, cmC);
  cmC = buildColMap(abaC);

  // Se o contrato foi ajuizado diretamente (não passou por baixarContratoPrejuizo antes),
  // PREJUIZO_CAPITAL nunca foi calculado — é a base usada por toda a cascata de recuperação
  // judicial (registrarAcordoJudicial/registrarQuitacaoJudicial). Calcular a partir do
  // principal ainda aberto nas parcelas, mesmo critério de registrarAcordoComPerda.
  var prejCapAtual = parseFloat(dadosC[rowContrato-1][(cmC["PREJUIZO_CAPITAL"]||0)-1]) || 0;
  if (!prejCapAtual) {
    var abaPAj = ss.getSheetByName(ABAS.PARCELAS);
    var cmPAj  = buildColMap(abaPAj);
    var dadosPAj = abaPAj.getDataRange().getValues();
    var stColPAj = cmPAj["STATUS"] || cmPAj["STATUS_PAGAMENTO"];
    var principalAbertoAj = 0;
    for (var pj = 1; pj < dadosPAj.length; pj++) {
      if (String(dadosPAj[pj][(cmPAj["ID_CONTRATO"]||2)-1]).trim() !== String(idContrato).trim()) continue;
      var stPAj = String(stColPAj ? dadosPAj[pj][stColPAj-1] : "").toLowerCase().trim();
      if (STATUS_TERMINAL[stPAj]) continue;
      principalAbertoAj += parseFloat(dadosPAj[pj][(cmPAj["VALOR_PRINCIPAL"]||9)-1]) || 0;
    }
    setCel(abaC, rowContrato, cmC, "PREJUIZO_CAPITAL", principalAbertoAj, "R$ #,##0.00");
  }

  setCel(abaC, rowContrato, cmC, "STATUS_CONTRATO", "em_processo_judicial");

  var campos = dados || {};
  if (!campos["STATUS_PROCESSO"]) campos["STATUS_PROCESSO"] = "EM_PREPARACAO";

  _JURI_COLS.forEach(function(f) {
    if (campos[f] !== undefined && campos[f] !== null && campos[f] !== "") {
      if ((f === "DATA_AJUIZAMENTO" || f === "DATA_PROXIMA_ACAO" || f === "DATA_ULTIMA_MOVIMENTACAO") && campos[f]) {
        setCel(abaC, rowContrato, cmC, f, parseDateLocal(String(campos[f])));
      } else {
        setCel(abaC, rowContrato, cmC, f, campos[f]);
      }
    }
  });

  // Garantir coluna CLIENTE_JUDICIALIZADO em CLIENTES
  if (!cmCli["CLIENTE_JUDICIALIZADO"]) {
    var ncCli = abaCli.getLastColumn() + 1;
    abaCli.getRange(1, ncCli).setValue("CLIENTE_JUDICIALIZADO").setFontWeight("bold").setBackground("#1a1a2e").setFontColor("#ffffff");
    cmCli["CLIENTE_JUDICIALIZADO"] = ncCli;
  }
  // Marcar cliente como judicializado
  if (idCliente) {
    for (var ci = 1; ci < dadosCli.length; ci++) {
      if (String(dadosCli[ci][(cmCli["ID_CLIENTE"]||1)-1]).trim() === idCliente) {
        setCel(abaCli, ci + 1, cmCli, "CLIENTE_JUDICIALIZADO", "SIM");
        break;
      }
    }
  }

  registrarEvento({
    idContrato: idContrato,
    idCliente: idCliente,
    nomeCliente: nomeCliente,
    tipoEvento: "AJUIZAMENTO",
    statusAnterior: statusAnterior,
    statusNovo: "em_processo_judicial",
    observacoes: "Contrato ajuizado" +
      (campos["NUMERO_PROCESSO"] ? " — Processo " + campos["NUMERO_PROCESSO"] : "") +
      (campos["VARA"] ? " · " + campos["VARA"] : "")
  });
}

function bloquearClienteManual(idCliente, motivo) {
  idCliente = String(idCliente || "").trim();
  motivo    = String(motivo || "").trim();
  if (!idCliente) throw new Error("ID do cliente é obrigatório");
  if (motivo.length < 5) throw new Error("Motivo do bloqueio é obrigatório");

  var ss     = SpreadsheetApp.getActiveSpreadsheet();
  var abaCli = ss.getSheetByName(ABAS.CLIENTES);
  if (!abaCli) throw new Error("Aba CLIENTES não encontrada");
  var cmCli    = buildColMap(abaCli);
  var dadosCli = abaCli.getDataRange().getValues();

  ["CLIENTE_BLOQUEADO_MANUAL", "MOTIVO_BLOQUEIO_MANUAL", "DATA_BLOQUEIO_MANUAL"].forEach(function(col) {
    if (!cmCli[col]) {
      var nc = abaCli.getLastColumn() + 1;
      abaCli.getRange(1, nc).setValue(col).setFontWeight("bold").setBackground("#1a1a2e").setFontColor("#ffffff");
      cmCli[col] = nc;
    }
  });

  var nomeCliente = "";
  var rowCliente = -1;
  for (var ci = 1; ci < dadosCli.length; ci++) {
    if (String(dadosCli[ci][(cmCli["ID_CLIENTE"]||1)-1]).trim() === idCliente) {
      rowCliente = ci + 1;
      nomeCliente = String(dadosCli[ci][(cmCli["NOME_CLIENTE"]||cmCli["NOME"]||2)-1]||"");
      break;
    }
  }
  if (rowCliente < 0) throw new Error("Cliente não encontrado: " + idCliente);

  setCel(abaCli, rowCliente, cmCli, "CLIENTE_BLOQUEADO_MANUAL", "SIM");
  setCel(abaCli, rowCliente, cmCli, "MOTIVO_BLOQUEIO_MANUAL", motivo);
  setCel(abaCli, rowCliente, cmCli, "DATA_BLOQUEIO_MANUAL", new Date());
  abaCli.getRange(rowCliente, cmCli["DATA_BLOQUEIO_MANUAL"]).setNumberFormat("dd/mm/yyyy");

  registrarEvento({
    idCliente: idCliente,
    nomeCliente: nomeCliente,
    tipoEvento: "BLOQUEIO_MANUAL_CLIENTE",
    statusAnterior: "",
    statusNovo: "bloqueado_manual",
    observacoes: motivo
  });

  return { ok: true };
}

function desbloquearClienteManual(idCliente) {
  idCliente = String(idCliente || "").trim();
  if (!idCliente) throw new Error("ID do cliente é obrigatório");

  var ss     = SpreadsheetApp.getActiveSpreadsheet();
  var abaCli = ss.getSheetByName(ABAS.CLIENTES);
  if (!abaCli) throw new Error("Aba CLIENTES não encontrada");
  var cmCli    = buildColMap(abaCli);
  var dadosCli = abaCli.getDataRange().getValues();

  if (!cmCli["CLIENTE_BLOQUEADO_MANUAL"]) throw new Error("Cliente não está bloqueado");

  var nomeCliente = "";
  var rowCliente = -1;
  for (var ci = 1; ci < dadosCli.length; ci++) {
    if (String(dadosCli[ci][(cmCli["ID_CLIENTE"]||1)-1]).trim() === idCliente) {
      rowCliente = ci + 1;
      nomeCliente = String(dadosCli[ci][(cmCli["NOME_CLIENTE"]||cmCli["NOME"]||2)-1]||"");
      break;
    }
  }
  if (rowCliente < 0) throw new Error("Cliente não encontrado: " + idCliente);

  setCel(abaCli, rowCliente, cmCli, "CLIENTE_BLOQUEADO_MANUAL", "");

  registrarEvento({
    idCliente: idCliente,
    nomeCliente: nomeCliente,
    tipoEvento: "DESBLOQUEIO_MANUAL_CLIENTE",
    statusAnterior: "bloqueado_manual",
    statusNovo: "",
    observacoes: "Bloqueio manual removido"
  });

  return { ok: true };
}

function atualizarDadosJuridicos(idContrato, campos) {
  var ss   = SpreadsheetApp.getActiveSpreadsheet();
  var abaC = ss.getSheetByName(ABAS.CONTRATOS);
  if (!abaC) throw new Error("Aba CONTRATOS não encontrada");

  var cmC    = buildColMap(abaC);
  var dadosC = abaC.getDataRange().getValues();

  _garantirColunasJuridicas(abaC, cmC);
  cmC = buildColMap(abaC);

  for (var i = 1; i < dadosC.length; i++) {
    if (String(dadosC[i][(cmC["ID_CONTRATO"]||1)-1]).trim() === String(idContrato).trim()) {
      var row = i + 1;
      _JURI_COLS.forEach(function(f) {
        if (campos[f] !== undefined) {
          if ((f === "DATA_AJUIZAMENTO" || f === "DATA_PROXIMA_ACAO" || f === "DATA_ULTIMA_MOVIMENTACAO") && campos[f]) {
            setCel(abaC, row, cmC, f, parseDateLocal(String(campos[f])));
          } else {
            setCel(abaC, row, cmC, f, campos[f]);
          }
        }
      });
      return;
    }
  }
  throw new Error("Contrato não encontrado: " + idContrato);
}

function adicionarMovimentacaoJuridica(idContrato, dados) {
  var ss   = SpreadsheetApp.getActiveSpreadsheet();
  var abaC = ss.getSheetByName(ABAS.CONTRATOS);
  if (!abaC) throw new Error("Aba CONTRATOS não encontrada");

  var cmC    = buildColMap(abaC);
  var dadosC = abaC.getDataRange().getValues();

  var rowContrato = -1;
  var idCliente = "";
  var nomeCliente = "";
  for (var i = 1; i < dadosC.length; i++) {
    if (String(dadosC[i][(cmC["ID_CONTRATO"]||1)-1]).trim() === String(idContrato).trim()) {
      rowContrato = i + 1;
      idCliente   = String(dadosC[i][(cmC["ID_CLIENTE"]||2)-1]).trim();
      nomeCliente = String(dadosC[i][(cmC["NOME_CLIENTE"]||3)-1]||"");
      break;
    }
  }
  if (rowContrato < 0) throw new Error("Contrato não encontrado: " + idContrato);

  _garantirColunasJuridicas(abaC, cmC);
  cmC = buildColMap(abaC);

  var descricao = String(dados.descricao || dados.titulo || "");
  var dataMovStr = dados.data || null;

  setCel(abaC, rowContrato, cmC, "ULTIMA_MOVIMENTACAO", descricao);
  if (dataMovStr) {
    setCel(abaC, rowContrato, cmC, "DATA_ULTIMA_MOVIMENTACAO", parseDateLocal(String(dataMovStr)));
  }

  registrarEvento({
    idContrato: idContrato,
    idCliente: idCliente,
    nomeCliente: nomeCliente,
    tipoEvento: "MOVIMENTACAO_JURIDICA",
    statusAnterior: "em_processo_judicial",
    statusNovo: "em_processo_judicial",
    observacoes: (dados.tipo ? "[" + dados.tipo + "] " : "") + descricao
  });
}

// ── MÓDULO RECUPERAÇÃO JUDICIAL ──────────────────────────────────
//
// "Ajuizar" não encerra o contrato — é o início de uma nova fase. Duas dimensões
// separadas: STATUS_PROCESSO (_JURI_COLS, acima) descreve a situação do processo;
// SITUACAO_FINANCEIRA_JUDICIAL (abaixo) descreve o que está acontecendo com o dinheiro.
// STATUS_CONTRATO fica "em_processo_judicial" durante toda a fase ativa e só vira
// o novo status terminal "encerrado_judicialmente" quando o processo é arquivado ou
// a dívida é 100% resolvida — nunca reaproveita os status mortos recuperado_parcialmente/
// em_recuperacao (ver corrigirStatusRecuperacao, que ativamente os reverte).

var _JURI_FIN_COLS = [
  "SITUACAO_FINANCEIRA_JUDICIAL","DATA_ACORDO_JUDICIAL","VALOR_ACORDO_JUDICIAL",
  "HONORARIOS_JUDICIAIS","QUEM_PAGA_HONORARIOS","CUSTAS_JUDICIAIS","QUEM_PAGA_CUSTAS",
  "VALOR_RECUPERADO_JUDICIAL_PRINCIPAL","VALOR_RECUPERADO_JUDICIAL_LUCRO",
  "DATA_ARQUIVAMENTO_PROCESSO","MOTIVO_ARQUIVAMENTO"
];

var _JURI_PAG_COLS = [
  "CAPITAL_RECUPERADO_JUDICIAL","LUCRO_RECUPERADO_JUDICIAL",
  "HONORARIOS_VALOR","HONORARIOS_PAGO_POR","CUSTAS_VALOR","CUSTAS_PAGO_POR"
];

function _garantirColunasFinanceiroJudicial(abaC, cmC) {
  _JURI_FIN_COLS.forEach(function(col) {
    if (!cmC[col]) {
      var nc = abaC.getLastColumn() + 1;
      abaC.getRange(1, nc).setValue(col).setFontWeight("bold").setBackground("#1a1a2e").setFontColor("#ffffff");
      cmC[col] = nc;
    }
  });
}

function _garantirColunasPagamentoJudicial(abaPag, cmPag) {
  _JURI_PAG_COLS.forEach(function(col) {
    if (!cmPag[col]) {
      var nc = abaPag.getLastColumn() + 1;
      abaPag.getRange(1, nc).setValue(col).setFontWeight("bold").setBackground("#1a1a2e").setFontColor("#ffffff");
      cmPag[col] = nc;
    }
  });
}

// Cascata de alocação de um valor recebido via ação judicial:
// 1. Custos que o CREDOR está pagando neste recebimento (honorários/custas quemPaga=CREDOR) — deduz antes de tudo
// 2. Valor líquido restante → principal (até zerar o que falta de capital)
// 3. Sobra → lucro recuperado judicialmente (separado do LUCRO_TOTAL operacional normal)
// 4. Honorários/custas pagos pelo DEVEDOR → reembolso, bucket neutro (não é lucro nem capital)
function _alocarRecuperacaoJudicial(valorRecebido, honorarios, quemPagaHonorarios, custas, quemPagaCustas, principalAbertoRestante) {
  var vRec = parseFloat(valorRecebido) || 0;
  var hon  = parseFloat(honorarios) || 0;
  var cus  = parseFloat(custas) || 0;
  var custoCredor = 0;
  if (String(quemPagaHonorarios||"").toUpperCase() === "CREDOR") custoCredor += hon;
  if (String(quemPagaCustas||"").toUpperCase()     === "CREDOR") custoCredor += cus;
  var valorLiquido = Math.max(0, vRec - custoCredor);
  var principalAberto = Math.max(0, parseFloat(principalAbertoRestante) || 0);
  var principalRecuperado = Math.min(valorLiquido, principalAberto);
  var lucroRecuperado     = Math.max(0, valorLiquido - principalRecuperado);
  return {
    principalRecuperado: principalRecuperado,
    lucroRecuperado: lucroRecuperado,
    custoCredorHonorarios: String(quemPagaHonorarios||"").toUpperCase()==="CREDOR" ? hon : 0,
    custoCredorCustas:     String(quemPagaCustas||"").toUpperCase()==="CREDOR"     ? cus : 0,
    honorariosReembolsados: String(quemPagaHonorarios||"").toUpperCase()==="DEVEDOR" ? hon : 0,
    custasReembolsadas:     String(quemPagaCustas||"").toUpperCase()==="DEVEDOR"     ? cus : 0
  };
}

function _gravarPagamentoJudicial(abaPag, cmPag, dados) {
  _garantirColunasPagamentoJudicial(abaPag, cmPag);
  cmPag = buildColMap(abaPag);
  var idPag = proximoIdSeq(abaPag, "PAG");
  var nc = abaPag.getLastColumn();
  var rPag = new Array(nc).fill("");
  function sp(h,v){ if (cmPag[h] && cmPag[h] <= nc) rPag[cmPag[h]-1] = v; }
  sp("ID_PAGAMENTO", idPag); sp("ID_CONTRATO", dados.idContrato); sp("ID_CLIENTE", dados.idCliente);
  sp("NOME_CLIENTE", dados.nomeCliente); sp("DATA_PAGAMENTO", dados.data);
  sp("VALOR_PAGO", dados.valorRecebido);
  sp("TIPO_PAGAMENTO", "recuperacao_judicial"); sp("FORMA_PAGAMENTO", dados.forma||"pix");
  sp("CAPITAL_RECUPERADO_JUDICIAL", dados.alocacao.principalRecuperado);
  sp("LUCRO_RECUPERADO_JUDICIAL",   dados.alocacao.lucroRecuperado);
  if (dados.honorarios) { sp("HONORARIOS_VALOR", dados.honorarios); sp("HONORARIOS_PAGO_POR", String(dados.quemPagaHonorarios||"").toUpperCase()); }
  if (dados.custas)     { sp("CUSTAS_VALOR", dados.custas); sp("CUSTAS_PAGO_POR", String(dados.quemPagaCustas||"").toUpperCase()); }
  sp("OBSERVACOES", dados.observacao || ("Recuperação judicial. Principal: R$ "+dados.alocacao.principalRecuperado.toFixed(2)+". Lucro: R$ "+dados.alocacao.lucroRecuperado.toFixed(2)));
  var ul = abaPag.getLastRow()+1;
  abaPag.getRange(ul,1,1,nc).setValues([rPag]);
  if(cmPag["DATA_PAGAMENTO"])              abaPag.getRange(ul,cmPag["DATA_PAGAMENTO"]).setNumberFormat("dd/mm/yyyy");
  if(cmPag["VALOR_PAGO"])                  abaPag.getRange(ul,cmPag["VALOR_PAGO"]).setNumberFormat("R$ #,##0.00");
  if(cmPag["CAPITAL_RECUPERADO_JUDICIAL"]) abaPag.getRange(ul,cmPag["CAPITAL_RECUPERADO_JUDICIAL"]).setNumberFormat("R$ #,##0.00");
  if(cmPag["LUCRO_RECUPERADO_JUDICIAL"])   abaPag.getRange(ul,cmPag["LUCRO_RECUPERADO_JUDICIAL"]).setNumberFormat("R$ #,##0.00");
  if(cmPag["HONORARIOS_VALOR"])            abaPag.getRange(ul,cmPag["HONORARIOS_VALOR"]).setNumberFormat("R$ #,##0.00");
  if(cmPag["CUSTAS_VALOR"])                abaPag.getRange(ul,cmPag["CUSTAS_VALOR"]).setNumberFormat("R$ #,##0.00");
  return idPag;
}

function registrarAcordoJudicial(idContrato, dados) {
  var ss   = SpreadsheetApp.getActiveSpreadsheet();
  var abaC = ss.getSheetByName(ABAS.CONTRATOS);
  var abaP = ss.getSheetByName(ABAS.PARCELAS);
  var abaAc = ss.getSheetByName(ABAS.ACORDOS);
  var abaPag = ss.getSheetByName(ABAS.PAGAMENTOS);
  if (!abaAc) throw new Error("Aba ACORDOS nao encontrada.");

  var cmC = buildColMap(abaC);
  var dadosC = abaC.getDataRange().getValues();
  var linhaC = -1; var rowC = null;
  for (var i = 1; i < dadosC.length; i++) {
    if (String(dadosC[i][(cmC["ID_CONTRATO"]||1)-1]).trim() === String(idContrato).trim()) {
      linhaC = i + 1; rowC = dadosC[i]; break;
    }
  }
  if (linhaC === -1) throw new Error("Contrato não encontrado: " + idContrato);
  var statusAnterior = String(rowC[(cmC["STATUS_CONTRATO"]||16)-1]||"");
  if (statusAnterior !== "em_processo_judicial") {
    throw new Error("Acordo judicial só pode ser registrado com o contrato em 'em_processo_judicial'.");
  }
  var idCliente   = String(rowC[(cmC["ID_CLIENTE"]||2)-1]).trim();
  var nomeCliente = String(rowC[(cmC["NOME_CLIENTE"]||3)-1]||"");

  _garantirColunasFinanceiroJudicial(abaC, cmC);
  cmC = buildColMap(abaC);

  var tipo            = dados.tipo === "A_VISTA" ? "A_VISTA" : "PARCELADO";
  var valorNegociado   = parseFloat(dados.valorNegociado) || 0;
  var entrada          = parseFloat(dados.entrada) || 0;
  var qtdParcelas      = parseInt(dados.qtdParcelas) || 0;
  var honorarios       = parseFloat(dados.honorarios) || 0;
  var custas           = parseFloat(dados.custas) || 0;
  var quemPagaHon      = dados.quemPagaHonorarios || "";
  var quemPagaCustas   = dados.quemPagaCustas || "";
  var principalAberto  = parseFloat(rowC[(cmC["PREJUIZO_CAPITAL"]||0)-1]) || 0;
  var dataAcordo       = dados.data ? parseDateLocal(dados.data) : new Date();

  setCel(abaC, linhaC, cmC, "DATA_ACORDO_JUDICIAL",  dataAcordo, "dd/mm/yyyy");
  setCel(abaC, linhaC, cmC, "VALOR_ACORDO_JUDICIAL",  valorNegociado, "R$ #,##0.00");
  setCel(abaC, linhaC, cmC, "HONORARIOS_JUDICIAIS",   honorarios, "R$ #,##0.00");
  setCel(abaC, linhaC, cmC, "QUEM_PAGA_HONORARIOS",   quemPagaHon);
  setCel(abaC, linhaC, cmC, "CUSTAS_JUDICIAIS",       custas, "R$ #,##0.00");
  setCel(abaC, linhaC, cmC, "QUEM_PAGA_CUSTAS",       quemPagaCustas);

  var idPagEntrada = null;
  if (tipo === "A_VISTA" || entrada > 0) {
    var valorRecebidoAgora = tipo === "A_VISTA" ? valorNegociado : entrada;
    var alocacao = _alocarRecuperacaoJudicial(valorRecebidoAgora, honorarios, quemPagaHon, custas, quemPagaCustas, principalAberto);
    idPagEntrada = _gravarPagamentoJudicial(abaPag, buildColMap(abaPag), {
      idContrato: idContrato, idCliente: idCliente, nomeCliente: nomeCliente,
      data: dataAcordo, valorRecebido: valorRecebidoAgora,
      forma: "pix", honorarios: honorarios, quemPagaHonorarios: quemPagaHon,
      custas: custas, quemPagaCustas: quemPagaCustas, alocacao: alocacao,
      observacao: tipo === "A_VISTA" ? "Acordo judicial à vista." : "Entrada do acordo judicial parcelado."
    });
    var novoPrincipalRec = (parseFloat(rowC[(cmC["VALOR_RECUPERADO_JUDICIAL_PRINCIPAL"]||0)-1])||0) + alocacao.principalRecuperado;
    var novoLucroRec     = (parseFloat(rowC[(cmC["VALOR_RECUPERADO_JUDICIAL_LUCRO"]||0)-1])||0) + alocacao.lucroRecuperado;
    var novoPrincipalAberto = Math.max(0, principalAberto - alocacao.principalRecuperado);
    setCel(abaC, linhaC, cmC, "VALOR_RECUPERADO_JUDICIAL_PRINCIPAL", novoPrincipalRec, "R$ #,##0.00");
    setCel(abaC, linhaC, cmC, "VALOR_RECUPERADO_JUDICIAL_LUCRO",     novoLucroRec,     "R$ #,##0.00");
    setCel(abaC, linhaC, cmC, "PREJUIZO_CAPITAL",                    novoPrincipalAberto, "R$ #,##0.00");
    principalAberto = novoPrincipalAberto;
  }

  if (tipo === "A_VISTA") {
    setCel(abaC, linhaC, cmC, "SITUACAO_FINANCEIRA_JUDICIAL", principalAberto <= 0 ? "QUITADO_JUDICIALMENTE" : "RECUPERADO_PARCIAL");
    setCel(abaC, linhaC, cmC, "STATUS_CONTRATO", "encerrado_judicialmente");
    // Fecha quaisquer parcelas ainda abertas do contrato — a dívida foi resolvida à vista.
    var abaPAv = abaP.getDataRange().getValues();
    var cmPAv = buildColMap(abaP);
    var stColPAv = cmPAv["STATUS"] || cmPAv["STATUS_PAGAMENTO"];
    if (stColPAv) {
      for (var pav = 1; pav < abaPAv.length; pav++) {
        if (String(abaPAv[pav][(cmPAv["ID_CONTRATO"]||2)-1]).trim() !== String(idContrato).trim()) continue;
        var stPAv = String(abaPAv[pav][stColPAv-1]||"").toLowerCase().trim();
        if (!STATUS_TERMINAL[stPAv]) abaP.getRange(pav+1, stColPAv).setValue("renegociado");
      }
    }
  } else {
    if (!valorNegociado || !qtdParcelas) throw new Error("valorNegociado e qtdParcelas são obrigatórios para acordo parcelado.");
    // Parcelas abertas anteriores ao acordo (originais ou de tentativa de acordo anterior) são
    // superadas pelo novo cronograma judicial — mesmo padrão de registrarAcordoComPerda/renegociarContrato.
    var abaPPrev = abaP.getDataRange().getValues();
    var cmPPrev = buildColMap(abaP);
    var stColPPrev = cmPPrev["STATUS"] || cmPPrev["STATUS_PAGAMENTO"];
    if (stColPPrev) {
      for (var pj = 1; pj < abaPPrev.length; pj++) {
        if (String(abaPPrev[pj][(cmPPrev["ID_CONTRATO"]||2)-1]).trim() !== String(idContrato).trim()) continue;
        var stPrev = String(abaPPrev[pj][stColPPrev-1]||"").toLowerCase().trim();
        if (!STATUS_TERMINAL[stPrev]) abaP.getRange(pj+1, stColPPrev).setValue("renegociado");
      }
    }
    var saldoParcelar = Math.max(0, valorNegociado - entrada);
    var valorPorParcela = Math.round((saldoParcelar / qtdParcelas) * 100) / 100;
    var principalPorParcela = Math.round((principalAberto / qtdParcelas) * 100) / 100;
    var lucroPorParcela = Math.max(0, valorPorParcela - principalPorParcela);
    var abaPFull = abaP.getDataRange().getValues();
    var cmP = buildColMap(abaP);
    var idxIC = (cmP["ID_CONTRATO"]||2)-1;
    var idxNP = (cmP["NUM_PARCELA"]||5)-1;
    var idxDV = (cmP["DATA_VENCIMENTO"]||7)-1;
    var maxNP = 0, ultimaIdP = 1;
    abaPFull.slice(1).forEach(function(r){
      if (String(r[idxIC]) === String(idContrato)) { var np = parseInt(r[idxNP])||0; if (np > maxNP) maxNP = np; }
      var n = parseInt(String(r[0]).replace(/\D/g,""))||0; if (n >= ultimaIdP) ultimaIdP = n+1;
    });
    var dataPrimeira = parseDateLocal(dados.dataPrimeiraParcela || dados.data || "");
    var ncP = abaP.getLastColumn();
    for (var q = 0; q < qtdParcelas; q++) {
      var novaR = new Array(ncP).fill("");
      var stNm = cmP["STATUS"] ? "STATUS" : "STATUS_PAGAMENTO";
      function sn(h,val){ if (cmP[h] && cmP[h] <= ncP) novaR[cmP[h]-1] = val; }
      var dtVenc = new Date(dataPrimeira); dtVenc.setMonth(dtVenc.getMonth()+q);
      sn("ID_PARCELA", String(ultimaIdP+q).padStart(5,"0"));
      sn("ID_CONTRATO", idContrato); sn("ID_CLIENTE", idCliente); sn("NOME_CLIENTE", nomeCliente);
      sn("NUM_PARCELA", maxNP+q+1); sn("TOTAL_PARCELAS", maxNP+qtdParcelas);
      sn("DATA_VENCIMENTO", dtVenc); sn("VALOR_PARCELA", valorPorParcela);
      sn("VALOR_PRINCIPAL", principalPorParcela); sn("VALOR_JUROS", lucroPorParcela);
      sn(stNm, "pendente"); sn("ORIGEM_PARCELA", "acordo_judicial");
      sn("OBSERVACOES", "Parcela "+(q+1)+"/"+qtdParcelas+" do acordo judicial.");
      var nl = abaP.getLastRow()+1;
      abaP.getRange(nl,1,1,ncP).setValues([novaR]);
      if (cmP["DATA_VENCIMENTO"]) abaP.getRange(nl,cmP["DATA_VENCIMENTO"]).setNumberFormat("dd/mm/yyyy");
      if (cmP["VALOR_PARCELA"])   abaP.getRange(nl,cmP["VALOR_PARCELA"]).setNumberFormat("R$ #,##0.00");
    }
    setCel(abaC, linhaC, cmC, "SITUACAO_FINANCEIRA_JUDICIAL", "ACORDO_PARCELADO_ATIVO");
  }

  var cmAc = buildColMap(abaAc);
  if (!cmAc["TIPO_ACORDO"]) {
    var ncAc = abaAc.getLastColumn()+1;
    abaAc.getRange(1, ncAc).setValue("TIPO_ACORDO").setFontWeight("bold").setBackground("#1a1a2e").setFontColor("#ffffff");
    cmAc["TIPO_ACORDO"] = ncAc;
  }
  var idAcordo = proximoIdSeq(abaAc, "ACO");
  var ncAcTotal = abaAc.getLastColumn();
  var rowAc = new Array(ncAcTotal).fill("");
  function sa(h,val){ if (cmAc[h] && cmAc[h] <= ncAcTotal) rowAc[cmAc[h]-1] = val; }
  sa("ID_ACORDO", idAcordo); sa("ID_CONTRATO", idContrato); sa("ID_CLIENTE", idCliente); sa("NOME_CLIENTE", nomeCliente);
  sa("DATA", dataAcordo); sa("VALOR_DIVIDA_ORIGINAL", parseFloat(dados.saldoAtualizado)||principalAberto);
  sa("VALOR_ACORDADO", valorNegociado); sa("STATUS", tipo === "A_VISTA" ? "QUITADO" : "ATIVO");
  sa("TIPO_ACORDO", "JUDICIAL"); sa("OBSERVACOES", dados.observacoes||"");
  var ulAc = abaAc.getLastRow()+1;
  abaAc.getRange(ulAc,1,1,ncAcTotal).setValues([rowAc]);
  if (cmAc["DATA"]) abaAc.getRange(ulAc,cmAc["DATA"]).setNumberFormat("dd/mm/yyyy");
  if (cmAc["VALOR_DIVIDA_ORIGINAL"]) abaAc.getRange(ulAc,cmAc["VALOR_DIVIDA_ORIGINAL"]).setNumberFormat("R$ #,##0.00");
  if (cmAc["VALOR_ACORDADO"]) abaAc.getRange(ulAc,cmAc["VALOR_ACORDADO"]).setNumberFormat("R$ #,##0.00");

  registrarEvento({
    idContrato: idContrato, idCliente: idCliente, nomeCliente: nomeCliente,
    tipoEvento: "ACORDO_JUDICIAL_FIRMADO", statusAnterior: statusAnterior,
    statusNovo: String(rowC[(cmC["STATUS_CONTRATO"]||16)-1]||statusAnterior),
    valorTotal: valorNegociado,
    observacoes: "Acordo judicial "+tipo+". Valor negociado: R$ "+valorNegociado.toFixed(2)+
      (entrada>0?". Entrada: R$ "+entrada.toFixed(2):"")+
      (qtdParcelas>0?". "+qtdParcelas+" parcela(s).":"")
  });
  try { calcularScore(idCliente); } catch(eScore) { Logger.log("Score err: "+eScore.message); }
  try { calcularMetricasCliente(idCliente); } catch(eMet) { Logger.log("Metricas err: "+eMet.message); }
  return { idAcordo: idAcordo };
}

function registrarQuitacaoJudicial(idContrato, dados) {
  var ss   = SpreadsheetApp.getActiveSpreadsheet();
  var abaC = ss.getSheetByName(ABAS.CONTRATOS);
  var abaP = ss.getSheetByName(ABAS.PARCELAS);
  var abaPag = ss.getSheetByName(ABAS.PAGAMENTOS);
  var cmC = buildColMap(abaC);
  var dadosC = abaC.getDataRange().getValues();
  var linhaC = -1; var rowC = null;
  for (var i = 1; i < dadosC.length; i++) {
    if (String(dadosC[i][(cmC["ID_CONTRATO"]||1)-1]).trim() === String(idContrato).trim()) {
      linhaC = i + 1; rowC = dadosC[i]; break;
    }
  }
  if (linhaC === -1) throw new Error("Contrato não encontrado: " + idContrato);
  var statusAnterior = String(rowC[(cmC["STATUS_CONTRATO"]||16)-1]||"");
  if (statusAnterior !== "em_processo_judicial") {
    throw new Error("Quitação judicial só pode ser registrada com o contrato em 'em_processo_judicial'.");
  }
  var idCliente   = String(rowC[(cmC["ID_CLIENTE"]||2)-1]).trim();
  var nomeCliente = String(rowC[(cmC["NOME_CLIENTE"]||3)-1]||"");

  _garantirColunasFinanceiroJudicial(abaC, cmC);
  cmC = buildColMap(abaC);

  var valorRecebido  = parseFloat(dados.valorRecebido) || 0;
  var honorarios     = parseFloat(dados.honorarios) || 0;
  var custas         = parseFloat(dados.custas) || 0;
  var quemPagaHon    = dados.quemPagaHonorarios || "";
  var quemPagaCustas = dados.quemPagaCustas || "";
  var principalAberto = parseFloat(rowC[(cmC["PREJUIZO_CAPITAL"]||0)-1]) || 0;

  var dataQuitacao = dados.data ? parseDateLocal(dados.data) : new Date();
  var alocacao = _alocarRecuperacaoJudicial(valorRecebido, honorarios, quemPagaHon, custas, quemPagaCustas, principalAberto);
  _gravarPagamentoJudicial(abaPag, buildColMap(abaPag), {
    idContrato: idContrato, idCliente: idCliente, nomeCliente: nomeCliente,
    data: dataQuitacao, valorRecebido: valorRecebido,
    forma: dados.forma||"pix", honorarios: honorarios, quemPagaHonorarios: quemPagaHon,
    custas: custas, quemPagaCustas: quemPagaCustas, alocacao: alocacao,
    observacao: dados.observacao || "Quitação judicial."
  });

  var novoPrincipalRec = (parseFloat(rowC[(cmC["VALOR_RECUPERADO_JUDICIAL_PRINCIPAL"]||0)-1])||0) + alocacao.principalRecuperado;
  var novoLucroRec     = (parseFloat(rowC[(cmC["VALOR_RECUPERADO_JUDICIAL_LUCRO"]||0)-1])||0) + alocacao.lucroRecuperado;
  var novoPrejuizo     = Math.max(0, principalAberto - alocacao.principalRecuperado);
  var novaSituacao     = novoPrejuizo <= 0 ? "QUITADO_JUDICIALMENTE" : "RECUPERADO_PARCIAL";

  setCel(abaC, linhaC, cmC, "VALOR_RECUPERADO_JUDICIAL_PRINCIPAL", novoPrincipalRec, "R$ #,##0.00");
  setCel(abaC, linhaC, cmC, "VALOR_RECUPERADO_JUDICIAL_LUCRO",     novoLucroRec,     "R$ #,##0.00");
  setCel(abaC, linhaC, cmC, "PREJUIZO_CAPITAL",                    novoPrejuizo,     "R$ #,##0.00");
  setCel(abaC, linhaC, cmC, "SITUACAO_FINANCEIRA_JUDICIAL",        novaSituacao);
  setCel(abaC, linhaC, cmC, "STATUS_CONTRATO",                     "encerrado_judicialmente");
  setCel(abaC, linhaC, cmC, "HONORARIOS_JUDICIAIS", honorarios, "R$ #,##0.00");
  setCel(abaC, linhaC, cmC, "QUEM_PAGA_HONORARIOS", quemPagaHon);
  setCel(abaC, linhaC, cmC, "CUSTAS_JUDICIAIS", custas, "R$ #,##0.00");
  setCel(abaC, linhaC, cmC, "QUEM_PAGA_CUSTAS", quemPagaCustas);

  // Marca quaisquer parcelas ainda abertas (originais ou de acordo judicial) como terminais
  var cmP = buildColMap(abaP);
  var dadosP = abaP.getDataRange().getValues();
  var stColP = cmP["STATUS"] || cmP["STATUS_PAGAMENTO"];
  if (stColP) {
    for (var j = 1; j < dadosP.length; j++) {
      if (String(dadosP[j][(cmP["ID_CONTRATO"]||2)-1]).trim() !== String(idContrato).trim()) continue;
      var stAtual = String(dadosP[j][stColP-1]||"").toLowerCase().trim();
      if (!STATUS_TERMINAL[stAtual]) abaP.getRange(j+1, stColP).setValue("renegociado");
    }
  }

  registrarEvento({
    idContrato: idContrato, idCliente: idCliente, nomeCliente: nomeCliente,
    tipoEvento: "QUITACAO_JUDICIAL", statusAnterior: statusAnterior, statusNovo: "encerrado_judicialmente",
    valorTotal: valorRecebido,
    observacoes: "Quitação judicial de R$ "+valorRecebido.toFixed(2)+". Principal recuperado: R$ "+alocacao.principalRecuperado.toFixed(2)+
      ". Lucro recuperado: R$ "+alocacao.lucroRecuperado.toFixed(2)+". Prejuízo remanescente: R$ "+novoPrejuizo.toFixed(2)
  });
  try { calcularScore(idCliente); } catch(eScore) { Logger.log("Score err: "+eScore.message); }
  try { calcularMetricasCliente(idCliente); } catch(eMet) { Logger.log("Metricas err: "+eMet.message); }
}

function arquivarProcessoJudicial(idContrato, dados) {
  var ss   = SpreadsheetApp.getActiveSpreadsheet();
  var abaC = ss.getSheetByName(ABAS.CONTRATOS);
  var cmC  = buildColMap(abaC);
  var dadosC = abaC.getDataRange().getValues();
  var linhaC = -1; var rowC = null;
  for (var i = 1; i < dadosC.length; i++) {
    if (String(dadosC[i][(cmC["ID_CONTRATO"]||1)-1]).trim() === String(idContrato).trim()) {
      linhaC = i + 1; rowC = dadosC[i]; break;
    }
  }
  if (linhaC === -1) throw new Error("Contrato não encontrado: " + idContrato);
  var idCliente   = String(rowC[(cmC["ID_CLIENTE"]||2)-1]).trim();
  var nomeCliente = String(rowC[(cmC["NOME_CLIENTE"]||3)-1]||"");
  var statusAnterior = String(rowC[(cmC["STATUS_CONTRATO"]||16)-1]||"");
  if (statusAnterior !== "em_processo_judicial" && statusAnterior !== "encerrado_judicialmente") {
    throw new Error("Arquivamento de processo só é permitido para contratos em recuperação judicial.");
  }

  _garantirColunasJuridicas(abaC, cmC);
  _garantirColunasFinanceiroJudicial(abaC, cmC);
  cmC = buildColMap(abaC);

  setCel(abaC, linhaC, cmC, "STATUS_PROCESSO", "ARQUIVADO");
  setCel(abaC, linhaC, cmC, "DATA_ARQUIVAMENTO_PROCESSO", new Date(), "dd/mm/yyyy");
  setCel(abaC, linhaC, cmC, "MOTIVO_ARQUIVAMENTO", dados.motivo||"OUTRO");

  var situacaoAtual = String(rowC[(cmC["SITUACAO_FINANCEIRA_JUDICIAL"]||0)-1]||"EM_ABERTO");
  var statusNovo = statusAnterior;
  if (situacaoAtual === "EM_ABERTO" || situacaoAtual === "ACORDO_PARCELADO_ATIVO" || situacaoAtual === "ACORDO_QUEBRADO" || !situacaoAtual) {
    setCel(abaC, linhaC, cmC, "SITUACAO_FINANCEIRA_JUDICIAL", "PERDA_JUDICIAL_DEFINITIVA");
    statusNovo = "encerrado_judicialmente";
    setCel(abaC, linhaC, cmC, "STATUS_CONTRATO", statusNovo);
    // Perda definitiva assumida — fecha quaisquer parcelas ainda abertas (originais ou de acordo judicial quebrado).
    var abaPArq = ss.getSheetByName(ABAS.PARCELAS);
    var cmPArq = buildColMap(abaPArq);
    var dadosPArq = abaPArq.getDataRange().getValues();
    var stColPArq = cmPArq["STATUS"] || cmPArq["STATUS_PAGAMENTO"];
    if (stColPArq) {
      for (var parq = 1; parq < dadosPArq.length; parq++) {
        if (String(dadosPArq[parq][(cmPArq["ID_CONTRATO"]||2)-1]).trim() !== String(idContrato).trim()) continue;
        var stPArq = String(dadosPArq[parq][stColPArq-1]||"").toLowerCase().trim();
        if (!STATUS_TERMINAL[stPArq]) abaPArq.getRange(parq+1, stColPArq).setValue("baixado_como_prejuizo");
      }
    }
  }

  registrarEvento({
    idContrato: idContrato, idCliente: idCliente, nomeCliente: nomeCliente,
    tipoEvento: "ARQUIVAMENTO_PROCESSO", statusAnterior: statusAnterior, statusNovo: statusNovo,
    observacoes: "Processo arquivado. Motivo: "+(dados.motivo||"OUTRO")+(dados.observacao?" — "+dados.observacao:"")
  });
  // CLIENTE_JUDICIALIZADO nunca é limpo — bloqueio de crédito é permanente mesmo com quitação total.
  try { calcularScore(idCliente); } catch(eScore) { Logger.log("Score err: "+eScore.message); }
  try { calcularMetricasCliente(idCliente); } catch(eMet) { Logger.log("Metricas err: "+eMet.message); }
}

function backfillTotalSomenteJuros() {
  var ui = SpreadsheetApp.getUi();
  var resp = ui.alert(
    "Backfill TOTAL_SOMENTE_JUROS",
    "Vai recalcular o contador de prorrogações (somente_juros) em todos os contratos com base nos PAGAMENTOS registrados. Continuar?",
    ui.ButtonSet.YES_NO
  );
  if (resp !== ui.Button.YES) return;

  var ss     = SpreadsheetApp.getActiveSpreadsheet();
  var abaC   = ss.getSheetByName(ABAS.CONTRATOS);
  var abaPag = ss.getSheetByName(ABAS.PAGAMENTOS);
  var cmC    = buildColMap(abaC);
  var cmPag  = buildColMap(abaPag);

  if (!cmC["TOTAL_SOMENTE_JUROS"]) {
    abaC.getRange(1, abaC.getLastColumn() + 1).setValue("TOTAL_SOMENTE_JUROS");
    cmC = buildColMap(abaC);
  }

  var dadosPag = abaPag.getDataRange().getValues();
  var cTipo = (cmPag["TIPO_PAGAMENTO"] || 11) - 1;
  var cIC   = (cmPag["ID_CONTRATO"]   || 3)  - 1;
  var contagem = {};
  for (var i = 1; i < dadosPag.length; i++) {
    if (String(dadosPag[i][cTipo]).trim().toLowerCase() === "somente_juros") {
      var ic = String(dadosPag[i][cIC]).trim();
      if (ic) contagem[ic] = (contagem[ic] || 0) + 1;
    }
  }

  var dadosC = abaC.getDataRange().getValues();
  var colSJ  = cmC["TOTAL_SOMENTE_JUROS"];
  var atualizados = 0;
  for (var j = 1; j < dadosC.length; j++) {
    var id = String(dadosC[j][0]).trim();
    if (!id) continue;
    abaC.getRange(j + 1, colSJ).setValue(contagem[id] || 0);
    atualizados++;
  }

  ui.alert(
    "Concluído",
    "TOTAL_SOMENTE_JUROS atualizado em " + atualizados + " contratos.\n" +
    "Contratos com prorrogações: " + Object.keys(contagem).length,
    ui.ButtonSet.OK
  );
}

// ─── BACKUP AUTOMÁTICO ─────────────────────────────────────────────────────

function fazerBackupAutomatico() {
  var ss       = SpreadsheetApp.getActiveSpreadsheet();
  var nome     = ss.getName();
  var ts       = Utilities.formatDate(new Date(), "America/Sao_Paulo", "yyyy-MM-dd_HH-mm");
  var nomeBack = nome + "_Backup_" + ts;

  // Cria ou localiza pasta "FinanceiroOp Backups" no Drive raiz
  var pastaIt = DriveApp.getFoldersByName("FinanceiroOp Backups");
  var pasta   = pastaIt.hasNext() ? pastaIt.next() : DriveApp.createFolder("FinanceiroOp Backups");

  // Copia a planilha
  var copia = ss.copy(nomeBack);
  pasta.addFile(DriveApp.getFileById(copia.getId()));
  DriveApp.getRootFolder().removeFile(DriveApp.getFileById(copia.getId()));

  // Mantém apenas as últimas 30 cópias
  var arquivos = [];
  var it = pasta.getFiles();
  while (it.hasNext()) arquivos.push(it.next());
  arquivos.sort(function(a, b) { return b.getDateCreated() - a.getDateCreated(); });
  for (var i = 30; i < arquivos.length; i++) {
    arquivos[i].setTrashed(true);
  }

  Logger.log("Backup criado: " + nomeBack + " (total na pasta: " + Math.min(arquivos.length, 30) + ")");
  return nomeBack;
}

function configurarTriggerBackup() {
  // Remove triggers de backup existentes antes de criar novo
  ScriptApp.getProjectTriggers().forEach(function(t) {
    if (t.getHandlerFunction() === "fazerBackupAutomatico") ScriptApp.deleteTrigger(t);
  });
  ScriptApp.newTrigger("fazerBackupAutomatico")
    .timeBased()
    .atHour(2)
    .everyDays(1)
    .create();
  SpreadsheetApp.getUi().alert("Trigger de backup configurado: todo dia às 2h.");
}

// ─── MANUTENÇÃO: RECALCULAR JUROS_TOTAL HISTÓRICO ─────────────────────────

function recalcularTotaisContratosHistorico() {
  var ui = SpreadsheetApp.getUi();
  var resp = ui.alert(
    "Recalcular JUROS_TOTAL Histórico",
    "Isso recalcula JUROS_TOTAL, VALOR_TOTAL e NUM_PARCELAS de TODOS os contratos somando as parcelas reais.\n\nContinuar?",
    ui.ButtonSet.YES_NO
  );
  if (resp !== ui.Button.YES) return;

  var ss    = SpreadsheetApp.getActiveSpreadsheet();
  var abaC  = ss.getSheetByName(ABAS.CONTRATOS);
  var dados = abaC.getDataRange().getValues();
  var cm    = buildColMap(abaC);
  var atualizados = 0;

  for (var i = 1; i < dados.length; i++) {
    var id = String(dados[i][(cm["ID_CONTRATO"]||1)-1]).trim();
    if (!id) continue;
    try {
      atualizarTotaisContrato(id, ss);
      atualizados++;
    } catch(e) {
      Logger.log("recalcularTotaisContratosHistorico: erro em " + id + " — " + e.message);
    }
  }

  ui.alert("Concluído", "JUROS_TOTAL/VALOR_TOTAL/NUM_PARCELAS recalculados em " + atualizados + " contratos.", ui.ButtonSet.OK);
}
