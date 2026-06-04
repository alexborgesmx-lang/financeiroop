

var ABAS = {
  CLIENTES:   "CLIENTES",
  CONTRATOS:  "CONTRATOS",
  PARCELAS:   "PARCELAS",
  PAGAMENTOS: "PAGAMENTOS",
  EVENTOS:    "EVENTOS",
  PROMESSAS:  "PROMESSAS",
  CONFIG:     "CONFIGURACOES",
  ACORDOS:    "ACORDOS",
  LEADS:      "LEADS"
};

var EMAIL_ADMIN = "alexborges.mx@gmail.com";

var TEMPLATE_CONTRATO_ID = "1H84A2PKoOFl6T-Z5O0gvLeodo0nbXcfe1bkt9_rFkxQ";
var PASTA_CONTRATOS_ID   = "1bAYcqnPQeugMBzOfOlxlFzPqQBQR3cAC";
var ZAPSIGN_TOKEN        = "064226b1-6031-4b71-b26f-57006c9403d06d215eb2-a523-4a7d-9684-0d8a10448048";

var STATUS_BLOQUEIO = [
  "em_cobranca","pre_prejuizo","baixado_como_prejuizo",
  "em_recuperacao","recuperado_parcialmente","encerrado_sem_recuperacao"
];

var STATUS_TERMINAL = {
  pago: 1, quitacao_antecipada: 1, baixado_como_prejuizo: 1, cancelado: 1, renegociado: 1
};

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
    .addItem("Migrar Empregador de Leads (rodar 1x)", "migrarEmpregadorDeLeads")
    .addItem("Atualizar Tabela Empregadores", "atualizarTabelaEmpregadores")
    .addItem("Atualizar Tabela Padrinhos", "atualizarTabelaPadrinhos")
    .addItem("Auditar Dados (FASE 1 e 2)", "auditarDados")
    .addItem("Diagnosticar ID Clientes (ver antes)", "corrigirIdClienteContratos")
    .addItem("EXECUTAR Corrigir ID Clientes", "corrigirIdClienteContratosEXECUTAR")
    .addItem("Diagnosticar Colunas", "diagnosticarColunas")
    .addItem("Resetar Sistema", "resetarSistema")
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
  var d = sheet.getDataRange().getValues();
  var max = 0;
  d.slice(1).forEach(function(r) {
    var n = parseInt(String(r[0]).replace(/\D/g,"")) || 0;
    if (n > max) max = n;
  });
  return prefix + String(max + 1).padStart(5, "0");
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
  var abaEv  = ss.getSheetByName(ABAS.EVENTOS);
  var abaPr  = ss.getSheetByName(ABAS.PROMESSAS);
  var abaAc  = ss.getSheetByName(ABAS.ACORDOS);
  var abaPad = ss.getSheetByName("PADRINHOS");
  var abaEmp = ss.getSheetByName("EMPREGADORES");
  var data = {
    CLIENTES:     toObj(ss.getSheetByName(ABAS.CLIENTES).getDataRange().getValues()),
    CONTRATOS:    toObj(ss.getSheetByName(ABAS.CONTRATOS).getDataRange().getValues()),
    PARCELAS:     toObj(ss.getSheetByName(ABAS.PARCELAS).getDataRange().getValues()),
    PAGAMENTOS:   toObj(ss.getSheetByName(ABAS.PAGAMENTOS).getDataRange().getValues()),
    EVENTOS:      abaEv  ? toObj(abaEv.getDataRange().getValues())  : [],
    PROMESSAS:    abaPr  ? toObj(abaPr.getDataRange().getValues())  : [],
    ACORDOS:      abaAc  ? toObj(abaAc.getDataRange().getValues())  : [],
    PADRINHOS:    abaPad ? toObj(abaPad.getDataRange().getValues()) : [],
    EMPREGADORES: abaEmp ? toObj(abaEmp.getDataRange().getValues()): []
  };
  return ContentService.createTextOutput(JSON.stringify(data)).setMimeType(ContentService.MimeType.JSON);
}

function doPost(e) {
  var res;
  try {
    var body = JSON.parse(e.postData.contents);
    if      (body.action === "pagamento")             { var rPag=registrarPagamentoAPI(body.idParcela, body.data, body.valor, body.forma||"dinheiro"); res={ok:true, contratoQuitado: rPag?rPag.contratoQuitado:false}; }
    else if (body.action === "pagamentoParcial")       { registrarPagamentoParcial(body.idParcela, body.data, body.valor); res={ok:true,msg:"Juros registrados. Principal rolado para nova parcela."}; }
    else if (body.action === "atualizarCliente")       { atualizarDadosCliente(body.idCliente, body.campos); res={ok:true}; }
    else if (body.action === "ativarCliente")          { atualizarCampoCliente(body.idCliente, "STATUS_CLIENTE", "ativo"); res={ok:true}; }
    else if (body.action === "novoContrato")           { var id=criarContrato(body.dados); var docUrl=""; var docId=""; var docErro=""; try{var docRes=gerarDocContrato(id,body.dados.idCliente,body.dados);docUrl=docRes.docUrl||"";docId=docRes.docId||"";}catch(eDoc){docErro=eDoc.message;Logger.log("Doc err: "+eDoc.message);} var dadosBoleto=buscarDadosBoleto(id,body.dados.idCliente||body.dados.clienteId||""); res={ok:true,idContrato:id,docUrl:docUrl,docId:docId,docErro:docErro,parcelas:dadosBoleto.parcelas,cliente:dadosBoleto.cliente}; }
    else if (body.action === "pagamentoAutomatico")    { var rAuto=pagamentoAutomatico(body.contractNum,body.numParcela,body.valor,body.data); res={ok:true,contratoQuitado:rAuto?rAuto.contratoQuitado:false}; }
    else if (body.action === "enviarZapSign")          { var cliInfo=buscarInfoCliente(body.idCliente); var zRes=enviarParaZapSign(body.docId,body.idContrato,cliInfo.nome,cliInfo.email,cliInfo.telefone); res={ok:true,zapUrl:zRes}; }
    else if (body.action === "baixarContrato")         { baixarContratoPrejuizo(body.idContrato, body.dados); res={ok:true}; }
    else if (body.action === "recuperacaoAposBaixa")   { registrarRecuperacaoAposBaixa(body.idContrato, body.dados); res={ok:true}; }
    else if (body.action === "registrarPromessa")      { registrarPromessa(body.dados); res={ok:true}; }
    else if (body.action === "atualizarPromessa")      { atualizarPromessa(body); res={ok:true}; }
    else if (body.action === "atualizarStatusContrato"){ atualizarStatusContrato(body.idContrato, body.dados); res={ok:true}; }
    else if (body.action === "acordoComPerda")         { var r=registrarAcordoComPerda(body.dados); res={ok:true,resultado:r}; }
    else if (body.action === "quitacaoAntecipada")     { var r=registrarQuitacaoAntecipada(body.dados); res={ok:true,resultado:r}; }
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
    else if (body.action === "alterarDiaVencimento")    { var rAdv=alterarDiaVencimentoContrato(body.idContrato,parseInt(body.novoDia)||1); res={ok:true,parcelas_alteradas:rAdv}; }
    else if (body.action === "migrarDataAcordo")        { adicionarColunaDataAcordoParcelas(); res={ok:true}; }
    else if (body.action === "buscarLeadPorTel")        { var rLead=buscarLeadPorTel(body.tel); res={ok:true,lead:rLead}; }
    else if (body.action === "criarLead")               { var rIdL=criarLead(body.dados); res={ok:true,idLead:rIdL}; }
    else if (body.action === "atualizarLead")           { atualizarLead(body.idLead,body.dados); res={ok:true}; }
    else if (body.action === "verificarPadrinho")       { var rVp=verificarPadrinho(body.nome); res={ok:true,existe:rVp.existe,qualifica:rVp.qualifica,motivo:rVp.motivo}; }
    else if (body.action === "salvarCobrancasEfi")      { var rEfi=salvarCobrancasEfi(body); res={ok:rEfi.ok,salvos:rEfi.salvos||0}; }
    else if (body.action === "buscarClientePorTel")     { res=buscarClientePorTel(body.tel); }
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

function alterarDiaVencimentoContrato(idContrato, novoDia) {
  var ss   = SpreadsheetApp.getActiveSpreadsheet();
  var abaP = ss.getSheetByName(ABAS.PARCELAS);
  var cmP  = buildColMap(abaP);
  var dadosP = abaP.getDataRange().getValues();
  var TERMINAL = {pago:1,quitacao_antecipada:1,baixado_como_prejuizo:1,cancelado:1,renegociado:1};
  var cIdC = (cmP["ID_CONTRATO"]    || 2) - 1;
  var cDV  = (cmP["DATA_VENCIMENTO"]|| 7) - 1;
  var cSt  = (cmP["STATUS"]         || 8) - 1;
  var count = 0;
  for (var i = 1; i < dadosP.length; i++) {
    if (String(dadosP[i][cIdC]).trim() !== String(idContrato).trim()) continue;
    var st = String(dadosP[i][cSt] || "").toLowerCase().trim();
    if (TERMINAL[st]) continue;
    var dtVenc = dadosP[i][cDV];
    if (!dtVenc) continue;
    var d = dtVenc instanceof Date ? dtVenc : new Date(dtVenc);
    if (isNaN(d.getTime())) continue;
    var mes = d.getMonth();
    var ano = d.getFullYear();
    var novaData = new Date(ano, mes, novoDia);
    if (novaData.getMonth() !== mes) novaData = new Date(ano, mes + 1, 0); // cap ao último dia do mês
    var cel = abaP.getRange(i + 1, cDV + 1);
    cel.setValue(novaData);
    cel.setNumberFormat("dd/mm/yyyy");
    count++;
  }
  return count;
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
  var ST_PREJ   = ["baixado_como_prejuizo","encerrado_sem_recuperacao"];
  var ST_RECUP  = ["recuperado_integralmente","recuperado_parcialmente"];
  var ST_ATIVO  = ["ativo_em_dia","ativo_em_atraso","em_cobranca","pre_prejuizo"];
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
      if (cmP["DESCONTO_APLICADO"])abaP.getRange(parcelaLin, cmP["DESCONTO_APLICADO"]).setValue("");
      if (cmP["DIAS_ATRASO"])      abaP.getRange(parcelaLin, cmP["DIAS_ATRASO"]).setValue(0);
      if (cmP["TIPO_PAGAMENTO"])   abaP.getRange(parcelaLin, cmP["TIPO_PAGAMENTO"]).setValue("");
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
  sp("TIPO_PAGAMENTO", "acordo_com_perda"); sp("FORMA_PAGAMENTO", v.forma||"dinheiro");
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
  return { idAcordo: idAcordo, totalDivida: totalDivida, valorAcordado: valorAcordado, descontoPrincipal: descontoPrincipal, descontoJuros: descontoJuros };
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
  var dtPag = new Date(v.data || new Date());
  var forma = v.forma || "dinheiro";
  var dPag  = new Date(dtPag.getFullYear(), dtPag.getMonth(), dtPag.getDate());

  var dadosP = abaP.getDataRange().getValues();
  var stColP = cmP["STATUS"] || cmP["STATUS_PAGAMENTO"];
  var selecionadas = [];
  for (var j = 1; j < dadosP.length; j++) {
    var idP = String(dadosP[j][0]).trim();
    if (idsSelecionados.indexOf(idP) < 0) continue;
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
  if (selecionadas.length === 0) throw new Error("Parcelas nao encontradas nas planilhas.");

  var totalJurosSelecionados     = selecionadas.reduce(function(s,p){return s+p.juros;},0);
  var totalPrincipalSelecionados = selecionadas.reduce(function(s,p){return s+p.principal;},0);
  descontoTotal = Math.min(descontoTotal, totalJurosSelecionados);
  var totalRecebido = totalPrincipalSelecionados + totalJurosSelecionados - descontoTotal;

  var ncPag = abaPag.getLastColumn();

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
    if (stColP) abaP.getRange(pa.linha, stColP).setValue("pago");
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
  }

  dadosP = abaP.getDataRange().getValues();
  var stAberto = ["pendente","atrasado","vence_hoje"];
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
  return { parcelasQuitadas: selecionadas.length, totalRecebido: totalRecebido, descontoJuros: descontoTotal, contratoQuitado: todasPagas };
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
  var statusAnterior = String(row[(cm["STATUS_CONTRATO"]||16)-1]||"");
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
  var novoStatus       = novoPrejuizo <= 0 ? "recuperado_integralmente" : "recuperado_parcialmente";
  var statusAnterior   = String(row[(cm["STATUS_CONTRATO"]||16)-1]||"");
  setCel(abaC, linha, cm, "VALOR_RECUPERADO_APOS_BAIXA", novoRecuperado, "R$ #,##0.00");
  setCel(abaC, linha, cm, "PREJUIZO_CAPITAL",            novoPrejuizo,   "R$ #,##0.00");
  setCel(abaC, linha, cm, "STATUS_CONTRATO",             novoStatus);
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
  sp("FORMA_PAGAMENTO",dados.forma||"dinheiro");
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
  var statusFinais = ["baixado_como_prejuizo","em_recuperacao","recuperado_parcialmente",
    "recuperado_integralmente","encerrado_sem_recuperacao","cancelado","renegociado"];
  var stTerminalParcela = ["pago","cancelado","baixado_como_prejuizo","renegociado","quitacao_antecipada"];
  var count = 0;
  for (var i = 1; i < dadosC.length; i++) {
    var stAtual = String(dadosC[i][(cmC["STATUS_CONTRATO"]||16)-1]||"").toLowerCase().trim();
    if (statusFinais.indexOf(stAtual) >= 0) continue;
    // "quitado" só é reavaliado se houver parcela não-terminal (ex: reabertura)
    var idC = String(dadosC[i][(cmC["ID_CONTRATO"]||1)-1]).trim();
    if (stAtual === "quitado") {
      var temAberta = false;
      for (var pi = 1; pi < dadosP.length; pi++) {
        if (String(dadosP[pi][(cmP["ID_CONTRATO"]||2)-1]).trim() !== idC) continue;
        var stPi = String(dadosP[pi][(cmP["STATUS"]||cmP["STATUS_PAGAMENTO"]||11)-1]||"").toLowerCase().trim();
        if (stTerminalParcela.indexOf(stPi) < 0) { temAberta = true; break; }
      }
      if (!temAberta) continue;
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

function registrarPagamentoAPI(idParcela, data, valor, forma) {
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
  var tipo = ehAtraso ? "pagamento_com_atraso" : (diasAntecipacao > 0 ? "pagamento_antecipado" : "pagamento_normal");
  var stCol = cm["STATUS"] || cm["STATUS_PAGAMENTO"];
  setCel(abaP, linha, cm, "DATA_PAGAMENTO", dtPag,  "dd/mm/yyyy");
  setCel(abaP, linha, cm, "VALOR_PAGO",    vlPago, "R$ #,##0.00");
  setCel(abaP, linha, cm, "VALOR_RECEBIDO",vlPago, "R$ #,##0.00");
  setCel(abaP, linha, cm, "DIFERENCA_PAGA",dif,    "R$ #,##0.00");
  setCel(abaP, linha, cm, "TIPO_PAGAMENTO",tipo);
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
  var rPag  = new Array(nc).fill("");
  function sp(h,v){if(cmPag[h]&&cmPag[h]<=nc)rPag[cmPag[h]-1]=v;}
  sp("ID_PAGAMENTO",           idPag);   sp("ID_PARCELA",             idParcela);
  sp("ID_CONTRATO",            idContrato); sp("ID_CLIENTE",          idCliente);
  sp("NOME_CLIENTE",           nomeCliente); sp("DATA_PAGAMENTO",     dtPag);
  sp("VALOR_ORIGINAL_PARCELA", valorOriginal); sp("VALOR_PAGO",       vlPago);
  sp("DIFERENCA_RECEBIDA",     dif); sp("RECEITA_EXTRA_ATRASO",       dif);
  sp("TIPO_PAGAMENTO",         tipo); sp("FORMA_PAGAMENTO",           forma);
  sp("OBSERVACOES",            dif>0?"Dif R$ "+dif.toFixed(2)+" (juros/multa atraso)":"");
  var ul = abaPag.getLastRow()+1;
  abaPag.getRange(ul,1,1,nc).setValues([rPag]);
  if(cmPag["DATA_PAGAMENTO"])         abaPag.getRange(ul,cmPag["DATA_PAGAMENTO"]).setNumberFormat("dd/mm/yyyy");
  if(cmPag["VALOR_PAGO"])             abaPag.getRange(ul,cmPag["VALOR_PAGO"]).setNumberFormat("R$ #,##0.00");
  if(cmPag["VALOR_ORIGINAL_PARCELA"]) abaPag.getRange(ul,cmPag["VALOR_ORIGINAL_PARCELA"]).setNumberFormat("R$ #,##0.00");
  if(cmPag["DIFERENCA_RECEBIDA"])     abaPag.getRange(ul,cmPag["DIFERENCA_RECEBIDA"]).setNumberFormat("R$ #,##0.00");
  if(cmPag["RECEITA_EXTRA_ATRASO"])   abaPag.getRange(ul,cmPag["RECEITA_EXTRA_ATRASO"]).setNumberFormat("R$ #,##0.00");
  registrarEvento({idContrato:idContrato,idCliente:idCliente,nomeCliente:nomeCliente,idParcela:idParcela,tipoEvento:tipo,
    valorPrincipal:valPrinc,valorJuros:valJuros,valorTotal:vlPago,valorExtraAtraso:dif,
    observacoes:"Pagamento registrado via painel"});

  // Atualizar o status da parcela atual na cópia em memória antes de verificar
  if (stCol) dados[linha-1][stCol-1] = "pago";

  // Verificar se todas as parcelas do contrato estão pagas (usa dados em memória, sem releitura)
  var statusFinais = ["pago","quitado","quitada","quitacao_antecipada","cancelado","baixado_como_prejuizo"];
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
        setCel(abaC, m+1, cmC, "STATUS_CONTRATO", "quitado");
        SpreadsheetApp.flush();
        break;
      }
    }
  } else {
    var abaC = ss.getSheetByName(ABAS.CONTRATOS);
    var cmC  = buildColMap(abaC);
    var dadosC = abaC.getDataRange().getValues();
    var stFinaisC = ["baixado_como_prejuizo","em_recuperacao","recuperado_parcialmente",
      "recuperado_integralmente","encerrado_sem_recuperacao","cancelado","renegociado","quitado"];
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
  return { contratoQuitado: todasPagas, idContrato: idContrato };
}

function registrarPagamentoParcial(idParcela, data, valorRecebido) {
  var ss     = SpreadsheetApp.getActiveSpreadsheet();
  var abaP   = ss.getSheetByName(ABAS.PARCELAS);
  var abaC   = ss.getSheetByName(ABAS.CONTRATOS);
  var abaPag = ss.getSheetByName(ABAS.PAGAMENTOS);
  var cm     = buildColMap(abaP);
  var ccm    = buildColMap(abaC);
  var cmPag  = buildColMap(abaPag);
  var dados = abaP.getDataRange().getValues();
  var linha = -1; var parRow = null;
  for (var i = 1; i < dados.length; i++) {
    if (String(dados[i][0])===String(idParcela)) { linha=i+1; parRow=dados[i]; break; }
  }
  if (linha===-1) throw new Error("Parcela nao encontrada: "+idParcela);
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
  var dtPag = parseDateLocal(data);
  var idPag = proximoIdSeq(abaPag,"PAG");
  var nc    = abaPag.getLastColumn();
  var rPag  = new Array(nc).fill("");
  function sp(h,v){if(cmPag[h]&&cmPag[h]<=nc)rPag[cmPag[h]-1]=v;}
  sp("ID_PAGAMENTO",idPag); sp("ID_PARCELA",idParcela); sp("ID_CONTRATO",idContrato);
  sp("ID_CLIENTE",idCliente); sp("NOME_CLIENTE",nomeCliente); sp("DATA_PAGAMENTO",dtPag);
  var vlPago = valorRecebido ? parseFloat(valorRecebido) : parcelJuros;
  var extraMulta = Math.max(0, vlPago - parcelJuros);
  sp("VALOR_ORIGINAL_PARCELA",valorParcela); sp("VALOR_PAGO",vlPago);
  sp("DIFERENCA_RECEBIDA",extraMulta); sp("RECEITA_EXTRA_ATRASO",extraMulta);
  sp("TIPO_PAGAMENTO","somente_juros"); sp("FORMA_PAGAMENTO","dinheiro");
  sp("OBSERVACOES","Somente juros. Principal R$ "+parcelPrinc.toFixed(2)+" rolado."+(extraMulta>0?" Multa/extra: R$ "+extraMulta.toFixed(2):""));
  var ul = abaPag.getLastRow()+1;
  abaPag.getRange(ul,1,1,nc).setValues([rPag]);
  if(cmPag["DATA_PAGAMENTO"]) abaPag.getRange(ul,cmPag["DATA_PAGAMENTO"]).setNumberFormat("dd/mm/yyyy");
  if(cmPag["VALOR_PAGO"])     abaPag.getRange(ul,cmPag["VALOR_PAGO"]).setNumberFormat("R$ #,##0.00");
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
  registrarEvento({idContrato:idContrato,idCliente:idCliente,nomeCliente:nomeCliente,idParcela:idParcela,tipoEvento:"PAGAMENTO_SOMENTE_JUROS",
    valorPrincipal:parcelPrinc,valorJuros:parcelJuros,valorTotal:vlPago,valorExtraAtraso:extraMulta,
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
    if(st==="pago"||st==="cancelado"||st==="baixado_como_prejuizo"||st==="renegociado"||st==="quitacao_antecipada")continue;
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

function onFormSubmit(e) {
  try {
    var ss=SpreadsheetApp.getActiveSpreadsheet();
    var abaCli=ss.getSheetByName(ABAS.CLIENTES);
    if(!abaCli)throw new Error("Aba CLIENTES nao encontrada");
    var nv=e.namedValues;
    function v(c){var val=nv[c];return val&&val[0]?String(val[0]).trim():"";}
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
    wr("TELEFONE_WPP",  _soDigitos(v("WhatsApp com DDD (Somente números)")));
    wr("EMAIL",         _emailFix(v("E-mail (tudo minúsculo)")));
    wr("CEP",           _soDigitos(v("CEP (Somente números)")));
    wr("RUA",v("Rua Avenida")); wr("NUMERO",_soDigitos(v("Numero (Somente números)")));
    wr("QUADRA",_soDigitos(v("Quadra (Somente números)"))); wr("LOTE",_soDigitos(v("Lote (Somente números)")));
    wr("SETOR",v("Setor/Bairro")); wr("COMPLEMENTO",v("Complemento (Casa, Condomínio, Ap, Bloco)"));
    wr("CIDADE_ESTADO",v("Cidade Estado"));
    wr("CONTATO_CONFIANCA_1", _sanitNome(v("Nome de Pessoa de confiança 1")));
    wr("TEL_CONFIANCA_1",     _soDigitos(v("Telefone de Pessoa de confiança 1")));
    wr("CONTATO_CONFIANCA_2", _sanitNome(v("Nome de Pessoa de confiança 2")));
    wr("TEL_CONFIANCA_2",     _soDigitos(v("Telefone de Pessoa de confiança 2")));
    wr("DIA_VENCIMENTO_PREFERIDO",v("Data de vencimento da primeira parcela"));
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
  var h=["ID_PAGAMENTO","ID_PARCELA","ID_CONTRATO","ID_CLIENTE","NOME_CLIENTE","DATA_PAGAMENTO","VALOR_ORIGINAL_PARCELA","VALOR_PAGO","DIFERENCA_RECEBIDA","RECEITA_EXTRA_ATRASO","TIPO_PAGAMENTO","FORMA_PAGAMENTO","OBSERVACOES"];
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
  ["LTV_CLIENTE","LUCRO_TOTAL","PREJUIZO_TOTAL","ROI_CLIENTE",
   "ATRASO_MEDIO","ATRASO_MAXIMO","PROMESSAS_QUEBRADAS","TAXA_ADIMPLENCIA"].forEach(function(c) {
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
  var lucroTotal        = 0;
  var totalParcelasPagas= 0;
  var totalEmDia        = 0;
  var somaAtrasosDias   = 0;
  var countAtraso       = 0;
  var maxAtraso         = 0;

  for (var pi2 = 1; pi2 < dadosP.length; pi2++) {
    if (String(dadosP[pi2][iP_IC]).trim() !== String(idCliente).trim()) continue;
    var st = String(dadosP[pi2][iP_St] || "").toLowerCase().trim();
    if (ST_PAGO.indexOf(st) < 0) continue;

    totalParcelasPagas++;
    var juros = parseFloat(dadosP[pi2][iP_VJ]  || 0) || 0;
    var dif   = parseFloat(dadosP[pi2][iP_DP]  || 0) || 0;
    var desc  = iP_Dsc >= 0 ? (parseFloat(dadosP[pi2][iP_Dsc] || 0) || 0) : 0;
    lucroTotal += juros - desc + dif;

    var da = iP_DA >= 0 ? (parseInt(dadosP[pi2][iP_DA] || 0) || 0) : 0;
    if (da > maxAtraso) maxAtraso = da;
    if (da > 0) { somaAtrasosDias += da; countAtraso++; }
    else        { totalEmDia++; }
  }

  // Contratos: capital total e prejuízo
  var capitalTotal  = 0;
  var prejuizoTotal = 0;
  for (var ci = 1; ci < dadosC.length; ci++) {
    var idCtrC = String(dadosC[ci][iC_ID] || "").trim();
    var ehDoCliente = idsContratos[idCtrC];
    if (!ehDoCliente && iC_IC >= 0) {
      if (String(dadosC[ci][iC_IC]).trim() !== String(idCliente).trim()) continue;
    } else if (!ehDoCliente) continue;
    capitalTotal  += parseFloat(dadosC[ci][iC_VP]  || 0) || 0;
    if (iC_Prej >= 0) prejuizoTotal += parseFloat(dadosC[ci][iC_Prej] || 0) || 0;
  }

  // Métricas derivadas
  var ltvCliente      = lucroTotal - prejuizoTotal;
  var roiCliente      = capitalTotal > 0 ? (ltvCliente / capitalTotal) * 100 : 0;
  var atrasoMedio     = countAtraso  > 0 ? somaAtrasosDias / countAtraso     : 0;
  var taxaAdimplencia = totalParcelasPagas > 0 ? (totalEmDia / totalParcelasPagas) * 100 : 0;

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
  sc("LTV_CLIENTE",         parseFloat(ltvCliente.toFixed(2)),      "R$ #,##0.00");
  sc("LUCRO_TOTAL",         parseFloat(lucroTotal.toFixed(2)),       "R$ #,##0.00");
  sc("PREJUIZO_TOTAL",      parseFloat(prejuizoTotal.toFixed(2)),    "R$ #,##0.00");
  sc("ROI_CLIENTE",         parseFloat(roiCliente.toFixed(2)));
  sc("ATRASO_MEDIO",        parseFloat(atrasoMedio.toFixed(1)));
  sc("ATRASO_MAXIMO",       maxAtraso);
  sc("PROMESSAS_QUEBRADAS", promessasQuebradas);
  sc("TAXA_ADIMPLENCIA",    parseFloat(taxaAdimplencia.toFixed(2)));

  return { ltvCliente:ltvCliente, lucroTotal:lucroTotal, prejuizoTotal:prejuizoTotal,
    roiCliente:roiCliente, atrasoMedio:atrasoMedio, maxAtraso:maxAtraso,
    promessasQuebradas:promessasQuebradas, taxaAdimplencia:taxaAdimplencia };
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

// ═══════════════════════════════════════════════════════════════════════════
// FASE 2 — EMPREGADOR + TABELA EMPREGADORES
// ═══════════════════════════════════════════════════════════════════════════

function _garantirColunasEmpregadorClientes() {
  var ss  = SpreadsheetApp.getActiveSpreadsheet();
  var aba = ss.getSheetByName(ABAS.CLIENTES);
  if (!aba) return;
  var cm  = buildColMap(aba);
  ["EMPREGADOR","RENDA_BRUTA","RENDA_LIQUIDA","DATA_ADMISSAO","RENDA_MENSAL"].forEach(function(c) {
    if (!cm[c]) {
      var col = aba.getLastColumn() + 1;
      aba.getRange(1, col).setValue(c).setFontWeight("bold").setBackground("#1a1a2e").setFontColor("#ffffff");
      Logger.log("Coluna adicionada em CLIENTES: " + c);
    }
  });
}

// Copia EMPREGADOR, RENDA_BRUTA, RENDA_LIQUIDA, DATA_ADMISSAO de LEADS → CLIENTES
// Faz match pelo telefone (TELEFONE_WPP ↔ TEL). Só preenche campos vazios.
function migrarEmpregadorDeLeads() {
  var ui   = SpreadsheetApp.getUi();
  var ss   = SpreadsheetApp.getActiveSpreadsheet();
  var abaL = ss.getSheetByName(ABAS.LEADS);
  var abaC = ss.getSheetByName(ABAS.CLIENTES);
  if (!abaL || !abaC) { ui.alert("Aba LEADS ou CLIENTES não encontrada."); return; }

  _garantirColunasEmpregadorClientes();

  var cmL = buildColMap(abaL);
  var cmC = buildColMap(abaC);
  if (!cmL["TEL"] || !cmC["TELEFONE_WPP"]) { ui.alert("Colunas de telefone não encontradas."); return; }

  var dadosL = abaL.getDataRange().getValues();
  var dadosC = abaC.getDataRange().getValues();

  var cLTel = cmL["TEL"]          - 1;
  var cLEmp = cmL["EMPREGADOR"]   ? cmL["EMPREGADOR"]   - 1 : -1;
  var cLRB  = cmL["RENDA_BRUTA"]  ? cmL["RENDA_BRUTA"]  - 1 : -1;
  var cLRL  = cmL["RENDA_LIQUIDA"]? cmL["RENDA_LIQUIDA"]- 1 : -1;
  var cLDA  = cmL["DATA_ADMISSAO"]? cmL["DATA_ADMISSAO"]- 1 : -1;

  var cCTel = cmC["TELEFONE_WPP"] - 1;
  var cCEmp = cmC["EMPREGADOR"]   ? cmC["EMPREGADOR"]   - 1 : -1;
  var cCRB  = cmC["RENDA_BRUTA"]  ? cmC["RENDA_BRUTA"]  - 1 : -1;
  var cCRL  = cmC["RENDA_LIQUIDA"]? cmC["RENDA_LIQUIDA"]- 1 : -1;
  var cCDA  = cmC["DATA_ADMISSAO"]? cmC["DATA_ADMISSAO"]- 1 : -1;
  var cCRM  = cmC["RENDA_MENSAL"] ? cmC["RENDA_MENSAL"] - 1 : -1;

  // Mapa: tel normalizado → dados do lead (último lead válido por telefone)
  var mapaLeads = {};
  for (var li = 1; li < dadosL.length; li++) {
    var tel = String(dadosL[li][cLTel] || "").replace(/\D/g, "");
    if (!tel) continue;
    var emp = cLEmp >= 0 ? String(dadosL[li][cLEmp] || "").trim() : "";
    if (!emp) continue;
    mapaLeads[tel] = {
      empregador:   emp,
      rendaBruta:   cLRB >= 0 ? parseFloat(dadosL[li][cLRB]  || 0) || 0 : 0,
      rendaLiquida: cLRL >= 0 ? parseFloat(dadosL[li][cLRL]  || 0) || 0 : 0,
      dataAdmissao: cLDA >= 0 ? dadosL[li][cLDA] : ""
    };
  }

  if (Object.keys(mapaLeads).length === 0) { ui.alert("Nenhum lead com EMPREGADOR preenchido."); return; }

  var atualizados = 0;
  for (var ci = 1; ci < dadosC.length; ci++) {
    var telCli = String(dadosC[ci][cCTel] || "").replace(/\D/g, "");
    if (!telCli) continue;
    // Tenta match com e sem o nono dígito
    var ld = mapaLeads[telCli] || mapaLeads[telCli.replace(/^(\d{2})9(\d{8})$/, "$1$2")];
    if (!ld) continue;
    var empAtual = cCEmp >= 0 ? String(dadosC[ci][cCEmp] || "").trim() : "";
    if (empAtual) continue; // não sobrescreve campos já preenchidos
    if (cCEmp >= 0) abaC.getRange(ci+1, cCEmp+1).setValue(ld.empregador);
    if (cCRB  >= 0 && ld.rendaBruta   > 0) abaC.getRange(ci+1, cCRB+1).setValue(ld.rendaBruta);
    if (cCRL  >= 0 && ld.rendaLiquida > 0) abaC.getRange(ci+1, cCRL+1).setValue(ld.rendaLiquida);
    if (cCRM  >= 0 && ld.rendaLiquida > 0) abaC.getRange(ci+1, cCRM+1).setValue(ld.rendaLiquida);
    if (cCDA  >= 0 && ld.dataAdmissao)     abaC.getRange(ci+1, cCDA+1).setValue(ld.dataAdmissao);
    atualizados++;
  }

  SpreadsheetApp.flush();
  ui.alert("Migração concluída!\n" + atualizados + " cliente(s) atualizados com dados de empregador.\n\nRode 'Atualizar Tabela Empregadores' em seguida.");
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

  if (cEmp < 0) { Logger.log("EMPREGADOR não existe em CLIENTES — rode migrarEmpregadorDeLeads primeiro"); return; }

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
  try { verificarPagamentosEfi(); } catch(eEfi) { Logger.log("Efi check err: "+eEfi.message); }
  atualizarStatusParcelas();
  atualizarStatusContratos();
  verificarPromessasVencidas();
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
  var parc=(p+p*t*n)/n;
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
    "{{VALOR_TOTAL}}":           "R$ "+_fNum(p),
    "{{VALOR_EXTENSO}}":         _extMoeda(p),
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

function pagamentoAutomatico(contractNum, numParcela, valor, data) {
  var ss   = SpreadsheetApp.getActiveSpreadsheet();
  var abaP = ss.getSheetByName(ABAS.PARCELAS);
  var cm   = buildColMap(abaP);
  var dados = abaP.getDataRange().getValues();
  var stKey = cm["STATUS"] || cm["STATUS_PAGAMENTO"];
  if (!stKey) throw new Error("Coluna STATUS nao encontrada em PARCELAS");
  var idParcelaEncontrada = null;

  for (var i = 1; i < dados.length; i++) {
    var idC = String(dados[i][(cm["ID_CONTRATO"]||2)-1]);
    var numC = parseInt(idC.replace(/\D/g, ""));
    var numP = parseInt(dados[i][(cm["NUM_PARCELA"]||5)-1]);
    var st   = String(dados[i][stKey-1]).toLowerCase().trim();
    if (numC === parseInt(contractNum) && numP === parseInt(numParcela) && st !== "pago") {
      idParcelaEncontrada = String(dados[i][0]);
      break;
    }
  }

  if (!idParcelaEncontrada) {
    throw new Error("Parcela nao encontrada: contrato#"+contractNum+" parcela#"+numParcela);
  }

  return registrarPagamentoAPI(idParcelaEncontrada, data || new Date().toISOString(), valor, "pix_efi");
}

// ═══════════════════════════════════════════════════════════════════════════
// LEADS — triagem automática via bot WhatsApp
// Aba LEADS — colunas necessárias:
//   ID_LEAD | TEL | NOME | STATUS | PADRINHO | PADRINHO_QUALIFICA |
//   CLT | VALOR_SOLICITADO | PRAZO_SOLICITADO | TEMPO_EMPRESA | RENDA_BRUTA |
//   RENDA_LIQUIDA | EMPREGADOR | DATA_ADMISSAO | HISTORICO_JSON |
//   CRIADO_EM | ATUALIZADO_EM
// ═══════════════════════════════════════════════════════════════════════════

function _abaLeads() {
  var ss  = SpreadsheetApp.getActiveSpreadsheet();
  var aba = ss.getSheetByName(ABAS.LEADS);
  if (!aba) {
    aba = ss.insertSheet(ABAS.LEADS);
    var cols = ["ID_LEAD","TEL","NOME","STATUS","PADRINHO","PADRINHO_QUALIFICA",
                "CLT","VALOR_SOLICITADO","PRAZO_SOLICITADO","TEMPO_EMPRESA","RENDA_BRUTA",
                "RENDA_LIQUIDA","EMPREGADOR","DATA_ADMISSAO","HISTORICO_JSON",
                "CRIADO_EM","ATUALIZADO_EM"];
    aba.getRange(1,1,1,cols.length).setValues([cols]);
    aba.setFrozenRows(1);
  }
  return aba;
}

function buscarLeadPorTel(tel) {
  if (!tel) return null;
  var telNorm = String(tel).replace(/\D/g,"");
  var aba = _abaLeads();
  var cm  = buildColMap(aba);
  if (!cm["TEL"]) return null;

  var dados = aba.getDataRange().getValues();
  for (var i = 1; i < dados.length; i++) {
    var rowTel = String(dados[i][cm["TEL"]-1]||"").replace(/\D/g,"");
    if (rowTel === telNorm) {
      var obj = {};
      for (var col in cm) obj[col] = dados[i][cm[col]-1];
      return obj;
    }
  }
  return null;
}

function criarLead(dados) {
  var aba = _abaLeads();
  var cm  = buildColMap(aba);
  var id  = proximoIdSeq(aba, "LEAD");
  var row = aba.getLastRow() + 1;

  setCel(aba, row, cm, "ID_LEAD", id);
  var campos = ["TEL","NOME","STATUS","PADRINHO","PADRINHO_QUALIFICA","CLT",
                "VALOR_SOLICITADO","PRAZO_SOLICITADO","TEMPO_EMPRESA","RENDA_BRUTA","RENDA_LIQUIDA",
                "EMPREGADOR","DATA_ADMISSAO","HISTORICO_JSON","CRIADO_EM","ATUALIZADO_EM"];
  campos.forEach(function(c) {
    if (dados[c] !== undefined) setCel(aba, row, cm, c, dados[c]);
  });
  return id;
}

function atualizarLead(idLead, dados) {
  if (!idLead || !dados) return;
  var aba  = _abaLeads();
  var cm   = buildColMap(aba);
  if (!cm["ID_LEAD"]) return;

  var vals = aba.getDataRange().getValues();
  for (var i = 1; i < vals.length; i++) {
    if (String(vals[i][cm["ID_LEAD"]-1]) === String(idLead)) {
      for (var col in dados) {
        if (cm[col]) setCel(aba, i+1, cm, col, dados[col]);
      }
      return;
    }
  }
}

function verificarPadrinho(nome) {
  if (!nome) return {existe:false,qualifica:false,motivo:"nome vazio"};

  var nomNorm = _normLeadStr(nome);
  var abaCli  = SpreadsheetApp.getActiveSpreadsheet().getSheetByName("CLIENTES");
  if (!abaCli) return {existe:false,qualifica:false,motivo:"aba CLIENTES nao encontrada"};

  var cmCli  = buildColMap(abaCli);
  var dadCli = abaCli.getDataRange().getValues();
  var matches = [];

  for (var i = 1; i < dadCli.length; i++) {
    var nomeRaw  = String(dadCli[i][(cmCli["NOME"]||1)-1]||"");
    var nomeCell = _normLeadStr(nomeRaw);
    if (!nomeCell) continue;
    if (nomeCell.indexOf(nomNorm) !== -1 || nomNorm.indexOf(nomeCell.split(" ")[0]) !== -1 || _fuzzyMatch(nomNorm, nomeCell)) {
      matches.push({
        id:   String(dadCli[i][(cmCli["ID_CLIENTE"]||1)-1]||""),
        nome: nomeRaw
      });
    }
  }

  if (matches.length === 0) return {existe:false,qualifica:false,nomeEncontrado:null,motivo:"cliente nao encontrado"};

  // Nome ambíguo — múltiplos clientes encontrados
  if (matches.length > 1) {
    return {
      existe:    true,
      multiplos: true,
      opcoes:    matches.slice(0,4).map(function(m){ return m.nome; }),
      qualifica: false,
      nomeEncontrado: null
    };
  }

  var idCliente      = matches[0].id;
  var nomeEncontrado = matches[0].nome;

  if (!idCliente) return {existe:false,qualifica:false,nomeEncontrado:null,motivo:"cliente nao encontrado"};

  var abaContr = SpreadsheetApp.getActiveSpreadsheet().getSheetByName("CONTRATOS");
  if (!abaContr) return {existe:true,qualifica:false,motivo:"sem contratos"};

  var cmContr  = buildColMap(abaContr);
  var dadContr = abaContr.getDataRange().getValues();
  var terminais = ["quitado","quitacao_antecipada"];
  var qualifica = false;

  for (var j = 1; j < dadContr.length; j++) {
    var idCli  = String(dadContr[j][(cmContr["ID_CLIENTE"]||1)-1]||"");
    var status = String(dadContr[j][(cmContr["STATUS_CONTRATO"]||1)-1]||"").toLowerCase();
    if (idCli === idCliente && terminais.indexOf(status) !== -1) {
      qualifica = true;
      break;
    }
  }

  // Busca score do padrinho na aba PADRINHOS (se existir)
  var scorePadrinho = null;
  var abaPad = SpreadsheetApp.getActiveSpreadsheet().getSheetByName("PADRINHOS");
  if (abaPad && abaPad.getLastRow() > 1) {
    var cmPad  = buildColMap(abaPad);
    var dadPad = abaPad.getDataRange().getValues();
    var cPN    = cmPad["NOME_PADRINHO"]  ? cmPad["NOME_PADRINHO"]  - 1 : 0;
    var cSC    = cmPad["SCORE_PADRINHO"] ? cmPad["SCORE_PADRINHO"] - 1 : -1;
    var normFn = function(s){ return String(s||"").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g,"").trim(); };
    var nomNorm = normFn(nomeEncontrado);
    for (var pi = 1; pi < dadPad.length; pi++) {
      if (normFn(String(dadPad[pi][cPN]||"")) === nomNorm) {
        if (cSC >= 0) scorePadrinho = parseFloat(dadPad[pi][cSC]||0)||null;
        break;
      }
    }
  }

  return {
    existe:         true,
    qualifica:      qualifica,
    nomeEncontrado: nomeEncontrado,
    scorePadrinho:  scorePadrinho,
    motivo:         qualifica ? "padrinho com contrato quitado" : "sem contratos concluidos"
  };
}

function _normLeadStr(s) {
  return String(s||"")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g,"")
    .trim();
}

function _levenshtein(a, b) {
  var m = a.length, n = b.length;
  var dp = [];
  for (var i = 0; i <= m; i++) {
    dp[i] = [i];
    for (var j = 1; j <= n; j++) {
      if (i === 0) { dp[i][j] = j; continue; }
      dp[i][j] = a[i-1] === b[j-1]
        ? dp[i-1][j-1]
        : 1 + Math.min(dp[i-1][j], dp[i][j-1], dp[i-1][j-1]);
    }
  }
  return dp[m][n];
}

// Retorna true se alguma palavra do search bate fuzzy com alguma palavra do target
// Threshold: até 20% de diferença relativa ao nome mais longo (ex: "gleiciane" ≈ "gleiciana")
function _fuzzyMatch(search, target) {
  var sw = search.split(/\s+/).filter(function(w){ return w.length >= 4; });
  var tw = target.split(/\s+/).filter(function(w){ return w.length >= 4; });
  for (var i = 0; i < sw.length; i++) {
    for (var j = 0; j < tw.length; j++) {
      var dist = _levenshtein(sw[i], tw[j]);
      if (dist / Math.max(sw[i].length, tw[j].length) <= 0.25) return true;
    }
  }
  return false;
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

  var cm   = buildColMap(sh);
  var stCol = cm["STATUS"] || cm["STATUS_PAGAMENTO"];
  var txCol = cm["EFI_TXID"];
  var esCol = cm["EFI_STATUS"];

  if (!txCol) { Logger.log("verificarPagamentosEfi: EFI_TXID nao encontrada"); return; }

  var terminais = ["pago","quitacao_antecipada","baixado_como_prejuizo","cancelado","renegociado"];
  var rows = sh.getDataRange().getValues();
  var pendentes = [];

  for (var i = 1; i < rows.length; i++) {
    var txid    = String(rows[i][txCol - 1] || "").trim();
    var stPar   = stCol ? String(rows[i][stCol - 1] || "").toLowerCase().trim() : "";
    var efiSt   = esCol ? String(rows[i][esCol - 1] || "").toLowerCase().trim() : "";

    if (!txid) continue;
    if (terminais.indexOf(stPar) >= 0) continue;
    if (efiSt === "pago") continue;
    if (!txid.startsWith("FOP") || txid.length < 26) continue;

    var contractNum = parseInt(txid.slice(3, 19));
    var parcelaNum  = parseInt(txid.slice(20, 26));
    if (isNaN(contractNum) || isNaN(parcelaNum)) continue;

    pendentes.push({ txid: txid, idParcela: String(rows[i][(cm["ID_PARCELA"] || 1) - 1] || ""), contractNum: contractNum, parcelaNum: parcelaNum, row: i + 1 });
  }

  if (!pendentes.length) { Logger.log("verificarPagamentosEfi: nenhuma parcela pendente"); return; }
  Logger.log("verificarPagamentosEfi: consultando " + pendentes.length + " parcelas no Efi");

  var resp = UrlFetchApp.fetch("https://financeiroop.vercel.app/api/efi-check-payments", {
    method: "post",
    contentType: "application/json",
    payload: JSON.stringify({ txids: pendentes.map(function(p){ return { txid: p.txid, idParcela: p.idParcela }; }) }),
    muteHttpExceptions: true
  });

  var data = JSON.parse(resp.getContentText());
  if (!data.ok) { Logger.log("verificarPagamentosEfi: erro API - " + resp.getContentText()); return; }

  var pagos = 0;
  (data.cobv || []).forEach(function(cobv) {
    if (!cobv.concluida) return;
    var p = pendentes.filter(function(x){ return x.txid === cobv.txid; })[0];
    if (!p) return;
    try {
      pagamentoAutomatico(p.contractNum, p.parcelaNum, cobv.valor, cobv.horario);
      if (esCol) sh.getRange(p.row, esCol).setValue("pago");
      pagos++;
      Logger.log("verificarPagamentosEfi: registrado - " + cobv.txid + " R$" + cobv.valor);
    } catch(e) {
      Logger.log("verificarPagamentosEfi: erro ao registrar " + cobv.txid + ": " + e.message);
    }
  });

  Logger.log("verificarPagamentosEfi: " + pagos + "/" + pendentes.length + " pagamentos registrados");
}

function buscarClientePorTel(tel) {
  if (!tel) return { encontrado: false };
  var telNorm = String(tel).replace(/\D/g, "");

  // Gera candidatos: com/sem prefixo 55, com/sem 9º dígito
  var t = telNorm;
  if ((t.length === 13 || t.length === 12) && t.slice(0,2) === "55") t = t.slice(2);
  var candidatos = [t];
  if (t.length === 11) candidatos.push(t.slice(0,2) + t.slice(3));
  if (t.length === 10) candidatos.push(t.slice(0,2) + "9" + t.slice(2));

  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var shCli = ss.getSheetByName("CLIENTES");
  if (!shCli) return { encontrado: false };
  var cmCli = buildColMap(shCli);
  if (!cmCli["TEL_CELULAR"]) return { encontrado: false };

  var dataCli = shCli.getDataRange().getValues();
  var cliente = null;
  for (var i = 1; i < dataCli.length; i++) {
    var rowTel = String(dataCli[i][cmCli["TEL_CELULAR"]-1] || "").replace(/\D/g,"");
    if (candidatos.indexOf(rowTel) !== -1) {
      cliente = {};
      for (var col in cmCli) cliente[col] = dataCli[i][cmCli[col]-1];
      break;
    }
  }

  if (!cliente || String(cliente.STATUS_CLIENTE || "") !== "ativo") return { encontrado: false };

  // Busca contrato ativo mais recente
  var shContr = ss.getSheetByName("CONTRATOS");
  var cmContr = buildColMap(shContr);
  var dataContr = shContr.getDataRange().getValues();
  var idContrato = null;
  for (var i = 1; i < dataContr.length; i++) {
    if (String(dataContr[i][cmContr["ID_CLIENTE"]-1]) === String(cliente.ID_CLIENTE) &&
        String(dataContr[i][cmContr["STATUS_CONTRATO"]-1]) === "ativo") {
      idContrato = String(dataContr[i][cmContr["ID_CONTRATO"]-1]);
    }
  }

  if (!idContrato) return { encontrado: true, cliente: { NOME: cliente.NOME }, contrato: null };

  // Busca parcelas do contrato
  var shParc = ss.getSheetByName("PARCELAS");
  var cmParc = buildColMap(shParc);
  var dataParc = shParc.getDataRange().getValues();
  var TERMINAIS = ["pago","quitacao_antecipada","baixado_como_prejuizo","cancelado","renegociado"];

  var parcelas = [];
  for (var i = 1; i < dataParc.length; i++) {
    if (String(dataParc[i][cmParc["ID_CONTRATO"]-1]) !== idContrato) continue;
    var st = String(dataParc[i][cmParc["STATUS"]-1] || "");
    var dtRaw = dataParc[i][cmParc["DATA_VENCIMENTO"]-1];
    var dtStr = "";
    try {
      var d = (dtRaw instanceof Date) ? dtRaw : parseDateLocal(String(dtRaw));
      dtStr = Utilities.formatDate(d, "America/Sao_Paulo", "dd/MM/yyyy");
    } catch(e) { dtStr = String(dtRaw); }
    parcelas.push({
      NUM_PARCELA:     dataParc[i][cmParc["NUM_PARCELA"]-1],
      DATA_VENCIMENTO: dtStr,
      VALOR:           dataParc[i][cmParc["VALOR"]-1],
      STATUS:          st,
      EFI_STATUS:      cmParc["EFI_STATUS"]   ? String(dataParc[i][cmParc["EFI_STATUS"]-1]   || "") : "",
      EFI_PIX_CODE:    cmParc["EFI_PIX_CODE"] ? String(dataParc[i][cmParc["EFI_PIX_CODE"]-1] || "") : "",
      terminal:        TERMINAIS.indexOf(st) !== -1,
    });
  }

  var pagas    = parcelas.filter(function(p){ return p.STATUS === "pago" || p.STATUS === "quitacao_antecipada"; });
  var pendentes = parcelas.filter(function(p){ return !p.terminal; });
  pendentes.sort(function(a,b){ return parseInt(a.NUM_PARCELA) - parseInt(b.NUM_PARCELA); });
  pagas.sort(function(a,b){ return parseInt(b.NUM_PARCELA) - parseInt(a.NUM_PARCELA); });

  return {
    encontrado:     true,
    cliente:        { NOME: cliente.NOME, ID_CLIENTE: cliente.ID_CLIENTE },
    contrato:       { ID_CONTRATO: idContrato },
    proximaParcela: pendentes.length ? pendentes[0] : null,
    ultimaPaga:     pagas.length ? pagas[0] : null,
    totalParcelas:  parcelas.length,
    pagas:          pagas.length,
  };
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
