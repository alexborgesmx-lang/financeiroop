var ABAS = {
  CLIENTES:   "CLIENTES",
  CONTRATOS:  "CONTRATOS",
  PARCELAS:   "PARCELAS",
  PAGAMENTOS: "PAGAMENTOS",
  EVENTOS:    "EVENTOS",
  PROMESSAS:  "PROMESSAS",
  CONFIG:     "CONFIGURACOES",
  ACORDOS:    "ACORDOS"
};

var EMAIL_ADMIN = "alexborges.mx@gmail.com";

var TEMPLATE_CONTRATO_ID = "1H84A2PKoOFl6T-Z5O0gvLeodo0nbXcfe1bkt9_rFkxQ";
var PASTA_CONTRATOS_ID   = "1bAYcqnPQeugMBzOfOlxlFzPqQBQR3cAC";
var ZAPSIGN_TOKEN        = "064226b1-6031-4b71-b26f-57006c9403d06d215eb2-a523-4a7d-9684-0d8a10448048";

var STATUS_BLOQUEIO = [
  "em_cobranca","pre_prejuizo","baixado_como_prejuizo",
  "em_recuperacao","recuperado_parcialmente","encerrado_sem_recuperacao"
];

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
    .addItem("Migrar Score (rodar 1x)", "migrarScore")
    .addItem("Recalcular Todos os Scores", "recalcularTodosScores")
    .addItem("Diagnosticar ID Clientes (ver antes)", "corrigirIdClienteContratos")
    .addItem("EXECUTAR Corrigir ID Clientes", "corrigirIdClienteContratosEXECUTAR")
    .addItem("Depurar Score Cliente 113", "depurarScore113")
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
  var data = {
    CLIENTES:   toObj(ss.getSheetByName(ABAS.CLIENTES).getDataRange().getValues()),
    CONTRATOS:  toObj(ss.getSheetByName(ABAS.CONTRATOS).getDataRange().getValues()),
    PARCELAS:   toObj(ss.getSheetByName(ABAS.PARCELAS).getDataRange().getValues()),
    PAGAMENTOS: toObj(ss.getSheetByName(ABAS.PAGAMENTOS).getDataRange().getValues()),
    EVENTOS:    abaEv ? toObj(abaEv.getDataRange().getValues()) : [],
    PROMESSAS:  abaPr ? toObj(abaPr.getDataRange().getValues()) : [],
    ACORDOS:    abaAc ? toObj(abaAc.getDataRange().getValues()) : []
  };
  return ContentService.createTextOutput(JSON.stringify(data)).setMimeType(ContentService.MimeType.JSON);
}

function doPost(e) {
  var res;
  try {
    var body = JSON.parse(e.postData.contents);
    if      (body.action === "pagamento")             { var rPag=registrarPagamentoAPI(body.idParcela, body.data, body.valor, body.forma||"dinheiro"); res={ok:true, contratoQuitado: rPag?rPag.contratoQuitado:false}; }
    else if (body.action === "pagamentoParcial")       { registrarPagamentoParcial(body.idParcela, body.data); res={ok:true,msg:"Juros registrados. Principal rolado para nova parcela."}; }
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
    else if (body.action === "reabrirParcela")          { var rRe=reabrirParcelaAPI(body); res={ok:true,msg:rRe}; }
    else { res={erro:"Acao nao reconhecida: "+body.action}; }
  } catch(err) { res={erro:err.message}; }
  return ContentService.createTextOutput(JSON.stringify(res)).setMimeType(ContentService.MimeType.JSON);
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

function diagnosticarNomes() {
  var ss     = SpreadsheetApp.getActiveSpreadsheet();
  var abaCli = ss.getSheetByName(ABAS.CLIENTES);
  var abaC   = ss.getSheetByName(ABAS.CONTRATOS);
  var abaP   = ss.getSheetByName(ABAS.PARCELAS);
  var cmCli  = buildColMap(abaCli);
  var cmC    = buildColMap(abaC);
  var cmP    = buildColMap(abaP);

  var cNomeCli = cmCli["NOME_CLIENTE"] || cmCli["NOME"] || 2;
  var cIdCli   = cmCli["ID_CLIENTE"] || 1;
  var cNomeC   = cmC["NOME_CLIENTE"]  || cmC["NOME"]  || 3;
  var cNomeP   = cmP["NOME_CLIENTE"]  || cmP["NOME"]  || 4;

  var dadosCli = abaCli.getDataRange().getValues();
  var dadosC   = abaC.getDataRange().getValues();
  var dadosP   = abaP.getDataRange().getValues();

  var msg = "=== DIAGNÓSTICO DE NOMES ===\n\n";

  msg += "CLIENTES (primeiros 5):\n";
  for (var i = 1; i <= Math.min(5, dadosCli.length-1); i++) {
    msg += "  ID='" + dadosCli[i][cIdCli-1] + "' NOME='" + dadosCli[i][cNomeCli-1] + "'\n";
  }

  msg += "\nCONTRATOS (primeiros 5):\n";
  for (var j = 1; j <= Math.min(5, dadosC.length-1); j++) {
    msg += "  ID_CLI='" + (cmC["ID_CLIENTE"]?dadosC[j][cmC["ID_CLIENTE"]-1]:"?") + "' NOME='" + dadosC[j][cNomeC-1] + "'\n";
  }

  msg += "\nPARCELAS (primeiros 3):\n";
  for (var k = 1; k <= Math.min(3, dadosP.length-1); k++) {
    msg += "  ID_CLI='" + (cmP["ID_CLIENTE"]?dadosP[k][cmP["ID_CLIENTE"]-1]:"?") + "' NOME='" + dadosP[k][cNomeP-1] + "'\n";
  }

  msg += "\nColuna nome CLIENTES: " + cNomeCli;
  msg += "\nColuna nome CONTRATOS: " + cNomeC;
  msg += "\nColuna nome PARCELAS: " + cNomeP;

  SpreadsheetApp.getUi().alert(msg);
}

function depurarScore113() {
  var ss   = SpreadsheetApp.getActiveSpreadsheet();
  var abaC = ss.getSheetByName(ABAS.CONTRATOS);
  var abaP = ss.getSheetByName(ABAS.PARCELAS);
  var abaCli = ss.getSheetByName(ABAS.CLIENTES);
  var cmC  = buildColMap(abaC);
  var cmP  = buildColMap(abaP);
  var cmCli = buildColMap(abaCli);
  var idCliente = "113";
  var msg = "=== DEPURAÇÃO CLIENTE 113 ===\n\n";

  msg += "COLUNAS CONTRATOS: " + JSON.stringify(cmC) + "\n\n";
  msg += "COLUNAS PARCELAS: " + JSON.stringify(cmP) + "\n\n";
  msg += "COLUNAS CLIENTES (score): SCORE=" + cmCli["SCORE"] + " SCORE_MOTIVOS=" + cmCli["SCORE_MOTIVOS"] + "\n\n";

  // Parcelas do cliente
  var dadosP = abaP.getDataRange().getValues();
  var stColP = cmP["STATUS"] || cmP["STATUS_PAGAMENTO"];
  var parcelasCliente = [];
  for (var pi = 1; pi < dadosP.length; pi++) {
    var idCli = String(dadosP[pi][(cmP["ID_CLIENTE"]||3)-1]).trim();
    if (idCli !== idCliente) continue;
    parcelasCliente.push({
      idContrato: String(dadosP[pi][(cmP["ID_CONTRATO"]||2)-1]).trim(),
      status: stColP ? String(dadosP[pi][stColP-1]||"").trim() : "?"
    });
  }
  msg += "PARCELAS DO CLIENTE (" + parcelasCliente.length + "):\n";
  parcelasCliente.forEach(function(p){ msg += "  idContrato='" + p.idContrato + "' status='" + p.status + "'\n"; });

  // IDs únicos de contratos
  var ids = {};
  parcelasCliente.forEach(function(p){ if(p.idContrato) ids[p.idContrato]=true; });
  msg += "\nIDs CONTRATOS VIA PARCELAS: " + JSON.stringify(Object.keys(ids)) + "\n\n";

  // Contratos encontrados
  var dadosC = abaC.getDataRange().getValues();
  msg += "CONTRATOS ENCONTRADOS:\n";
  for (var ci = 1; ci < dadosC.length; ci++) {
    var idCtrC = String(dadosC[ci][(cmC["ID_CONTRATO"]||1)-1]).trim();
    var stC = cmC["STATUS_CONTRATO"] ? String(dadosC[ci][cmC["STATUS_CONTRATO"]-1]||"").trim() : "SEM_COLUNA";
    var valP = cmC["VALOR_PRINCIPAL"] ? dadosC[ci][cmC["VALOR_PRINCIPAL"]-1] : "SEM_COLUNA";
    if (ids[idCtrC]) {
      msg += "  [VIA PARCELA] id='" + idCtrC + "' status='" + stC + "' principal=" + valP + "\n";
    }
    // fallback
    if (cmC["ID_CLIENTE"] && String(dadosC[ci][cmC["ID_CLIENTE"]-1]).trim() === idCliente) {
      msg += "  [VIA ID_CLI] id='" + idCtrC + "' status='" + stC + "' principal=" + valP + "\n";
    }
  }

  SpreadsheetApp.getUi().alert(msg);
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

function migrarScore() {
  var ss  = SpreadsheetApp.getActiveSpreadsheet();
  var aba = ss.getSheetByName(ABAS.CLIENTES);
  if (!aba) { SpreadsheetApp.getUi().alert("Aba CLIENTES nao encontrada."); return; }
  var cm  = buildColMap(aba);
  var novas = [
    "RENDA_MENSAL","TIPO_RENDA","RENDA_COMPROVADA","QUALIDADE_COMUNICACAO",
    "SCORE_FAIXA","SCORE_DECISAO","SCORE_LIMITE_SUGERIDO","SCORE_PARCELA_MAX",
    "SCORE_TAXA_LABEL","SCORE_PRAZO_MAX","SCORE_DATA","SCORE_BLOQUEADO","SCORE_MOTIVOS"
  ];
  novas.forEach(function(h) {
    if (!cm[h]) {
      var nc = aba.getLastColumn() + 1;
      aba.getRange(1, nc).setValue(h).setFontWeight("bold").setBackground("#1a1a2e").setFontColor("#ffffff");
    }
  });
  SpreadsheetApp.getUi().alert("Colunas de score adicionadas! Execute 'Recalcular Todos os Scores' para calcular.");
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
  var multRenda  = scoreFinal>=90?1.5:scoreFinal>=75?1.2:scoreFinal>=60?0.8:scoreFinal>=45?0.5:scoreFinal>=30?0.3:0;
  var limPorRenda= rendaMensal>0?rendaMensal*multRenda:0;
  var fatHist    = qtdQuit>=4?1.5:qtdQuit>=2?1.25:qtdQuit===1?1.0:0.4;
  var limPorHist = maiorValPago>0?maiorValPago*fatHist:(rendaMensal>0?rendaMensal*0.4:0);
  var limiteSug  = bloqueado?0:(limPorRenda>0&&limPorHist>0?Math.min(limPorRenda,limPorHist):(limPorRenda||limPorHist||0));
  limiteSug = Math.max(0, limiteSug - principalAtivo);

  var prazoMax   = scoreFinal>=90?12:scoreFinal>=75?10:scoreFinal>=60?6:scoreFinal>=45?3:scoreFinal>=30?2:0;
  var taxaLabel  = scoreFinal>=90?"Minima":scoreFinal>=75?"Padrao baixa":scoreFinal>=60?"Padrao":scoreFinal>=45?"Alta":"Maxima";
  var pctCMax    = scoreFinal>=90?0.30:scoreFinal>=75?0.25:scoreFinal>=60?0.20:scoreFinal>=45?0.15:0;
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

  // ── SALVAR ──
  var sc_set = function(h, val) { if (cmCli[h]) { try { abaCli.getRange(linCli, cmCli[h]).setValue(val); } catch(e){} } };
  sc_set("SCORE",                 scoreFinal);
  sc_set("SCORE_FAIXA",           faixa);
  sc_set("SCORE_DECISAO",         decisao);
  sc_set("SCORE_LIMITE_SUGERIDO", parseFloat(limiteSug.toFixed(2)));
  sc_set("SCORE_PARCELA_MAX",     parseFloat(parcelaMax.toFixed(2)));
  sc_set("SCORE_TAXA_LABEL",      taxaLabel);
  sc_set("SCORE_PRAZO_MAX",       prazoMax);
  sc_set("SCORE_BLOQUEADO",       bloqueado?"SIM":"NAO");
  sc_set("SCORE_MOTIVOS",         motivos.join(" | "));
  if (cmCli["SCORE_DATA"]) {
    try { var rSd=abaCli.getRange(linCli,cmCli["SCORE_DATA"]); rSd.setValue(new Date()); rSd.setNumberFormat("dd/mm/yyyy"); } catch(e){}
  }
  if (cmCli["SCORE_LIMITE_SUGERIDO"]) { try { abaCli.getRange(linCli,cmCli["SCORE_LIMITE_SUGERIDO"]).setNumberFormat("R$ #,##0.00"); } catch(e){} }
  if (cmCli["SCORE_PARCELA_MAX"])     { try { abaCli.getRange(linCli,cmCli["SCORE_PARCELA_MAX"]).setNumberFormat("R$ #,##0.00"); } catch(e){} }

  return { score:scoreFinal, faixa:faixa, decisao:decisao, bloqueado:bloqueado,
    limiteSugerido:limiteSug, prazoMax:prazoMax, parcelaMax:parcelaMax,
    taxaLabel:taxaLabel, motivos:motivos };
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
      if (cmP["DATA_PAGAMENTO"])   abaP.getRange(parcelaLin, cmP["DATA_PAGAMENTO"]).setValue("");
      if (cmP["VALOR_PAGO"])       abaP.getRange(parcelaLin, cmP["VALOR_PAGO"]).setValue("");
      if (cmP["DIAS_ATRASO"])      abaP.getRange(parcelaLin, cmP["DIAS_ATRASO"]).setValue(0);
      if (cmP["STATUS_PAGAMENTO"]) abaP.getRange(parcelaLin, cmP["STATUS_PAGAMENTO"]).setValue("");
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
        break;
      }
    }
  }

  // ── 3. Atualizar status do contrato ──
  var dadosC = abaC.getDataRange().getValues();
  for (var c = 1; c < dadosC.length; c++) {
    if (String(dadosC[c][(cmC["ID_CONTRATO"]||1)-1]).trim() === idContrato) {
      var stAtual = String(dadosC[c][(cmC["STATUS_CONTRATO"]||16)-1]||"").trim();
      // Se estava quitado, voltar para ativo
      if (stAtual === "quitado") {
        var novoStC = hoje > new Date(dadosC[c][(cmC["DATA_1_VENCIMENTO"]||5)-1]) ? "ativo_em_atraso" : "ativo_em_dia";
        if (cmC["STATUS_CONTRATO"]) abaC.getRange(c+1, cmC["STATUS_CONTRATO"]).setValue(novoStC);
      }
      break;
    }
  }

  // ── 4. Log de evento ──
  try {
    var abaE = ss.getSheetByName(ABAS.EVENTOS);
    if (abaE) {
      abaE.appendRow([new Date(), idContrato, idCliente, "reabertura_parcela",
        "Parcela " + numParcela + " reaberta manualmente. Pagamento " + idPagamento + " removido."]);
    }
  } catch(e) {}

  // ── 5. Recalcular score ──
  if (idCliente) try { calcularScore(idCliente); } catch(e) {}

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
  sp("OBSERVACOES",    "Recuperacao apos baixa como prejuizo");
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
  s("DATA_PREVISTA_PAGAMENTO", new Date(dados.dataPrevista||new Date()));
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
      if (cDC && body.dataCumprimento) abaProm.getRange(i+1, cDC).setNumberFormat("dd/mm/yyyy").setValue(new Date(body.dataCumprimento));
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
    "recuperado_integralmente","encerrado_sem_recuperacao","quitado","cancelado","renegociado"];
  var count = 0;
  for (var i = 1; i < dadosC.length; i++) {
    var stAtual = String(dadosC[i][(cmC["STATUS_CONTRATO"]||16)-1]||"").toLowerCase().trim();
    if (statusFinais.indexOf(stAtual) >= 0) continue;
    var idC  = String(dadosC[i][(cmC["ID_CONTRATO"]||1)-1]).trim();
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
  var dtPag  = new Date(data);
  var dtVenc = parRow[(cm["DATA_VENCIMENTO"]||7)-1];
  if (!(dtVenc instanceof Date)) dtVenc = new Date(dtVenc);
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
  }
  try { calcularScore(idCliente); } catch(eScore) { Logger.log("Score err: "+eScore.message); }
  try { atualizarStatusContratos(); } catch(eSt) { Logger.log("Status err: "+eSt.message); }
  return { contratoQuitado: todasPagas, idContrato: idContrato };
}

function registrarPagamentoParcial(idParcela, data) {
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
  var dtPag = new Date(data);
  var idPag = proximoIdSeq(abaPag,"PAG");
  var nc    = abaPag.getLastColumn();
  var rPag  = new Array(nc).fill("");
  function sp(h,v){if(cmPag[h]&&cmPag[h]<=nc)rPag[cmPag[h]-1]=v;}
  sp("ID_PAGAMENTO",idPag); sp("ID_PARCELA",idParcela); sp("ID_CONTRATO",idContrato);
  sp("ID_CLIENTE",idCliente); sp("NOME_CLIENTE",nomeCliente); sp("DATA_PAGAMENTO",dtPag);
  sp("VALOR_ORIGINAL_PARCELA",valorParcela); sp("VALOR_PAGO",parcelJuros);
  sp("DIFERENCA_RECEBIDA",0); sp("RECEITA_EXTRA_ATRASO",0);
  sp("TIPO_PAGAMENTO","somente_juros"); sp("FORMA_PAGAMENTO","dinheiro");
  sp("OBSERVACOES","Somente juros. Principal R$ "+parcelPrinc.toFixed(2)+" rolado.");
  var ul = abaPag.getLastRow()+1;
  abaPag.getRange(ul,1,1,nc).setValues([rPag]);
  if(cmPag["DATA_PAGAMENTO"]) abaPag.getRange(ul,cmPag["DATA_PAGAMENTO"]).setNumberFormat("dd/mm/yyyy");
  if(cmPag["VALOR_PAGO"])     abaPag.getRange(ul,cmPag["VALOR_PAGO"]).setNumberFormat("R$ #,##0.00");
  var stCol = cm["STATUS"]||cm["STATUS_PAGAMENTO"];
  setCel(abaP,linha,cm,"DATA_PAGAMENTO",dtPag,"dd/mm/yyyy");
  setCel(abaP,linha,cm,"VALOR_PAGO",parcelJuros,"R$ #,##0.00");
  setCel(abaP,linha,cm,"VALOR_RECEBIDO",parcelJuros,"R$ #,##0.00");
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
    valorPrincipal:parcelPrinc,valorJuros:parcelJuros,valorTotal:parcelJuros,
    observacoes:"Juros pagos. Nova parcela: "+String(ultimaIdP).padStart(5,"0")});
  try { calcularScore(idCliente); } catch(eScore) { Logger.log("Score err: "+eScore.message); }
  // Corrigir TOTAL_PARCELAS de todas as parcelas existentes deste contrato
  if (cm["TOTAL_PARCELAS"]) {
    var novoTotal = maxNP + 1;
    for (var tp = 1; tp < todasP.length; tp++) {
      if (String(todasP[tp][idxIC]) === idContrato) {
        abaP.getRange(tp+1, cm["TOTAL_PARCELAS"]).setValue(novoTotal);
      }
    }
  }
  try { atualizarStatusContratos(); } catch(eSt) { Logger.log("Status err: "+eSt.message); }
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
  var dtEmp  = new Date(v.dataEmprestimo || v.dtEmp  || "");
  var dtVenc = new Date(v.dataVencimento  || v.dtVenc || "");
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
    wr("ID_CLIENTE",idCliente); wr("NOME",v("Nome Completo")); wr("CPF",v("CPF (somente numeros)"));
    wr("RG",v("RG (somente numeros)")); wr("NACIONALIDADE",v("Nacionalidade")); wr("ESTADO_CIVIL",v("Estado civil"));
    wr("PROFISSAO",v("Profissao")); wr("TELEFONE_WPP",v("WhatsApp com DDD (Somente números)"));
    wr("EMAIL",v("E-mail (tudo minúsculo)")); wr("CEP",v("CEP (Somente números)"));
    wr("RUA",v("Rua Avenida")); wr("NUMERO",v("Numero (Somente números)"));
    wr("QUADRA",v("Quadra (Somente números)")); wr("LOTE",v("Lote (Somente números)"));
    wr("SETOR",v("Setor/Bairro")); wr("COMPLEMENTO",v("Complemento (Casa, Condomínio, Ap, Bloco)"));
    wr("CIDADE_ESTADO",v("Cidade Estado")); wr("CONTATO_CONFIANCA_1",v("Pessoa de confianca 1 Nome"));
    wr("TEL_CONFIANCA_1",v("Pessoa de confianca 1 Telefone")); wr("CONTATO_CONFIANCA_2",v("Pessoa de confianca 2 Nome"));
    wr("TEL_CONFIANCA_2",v("Pessoa de confianca 2 Telefone"));
    wr("DIA_VENCIMENTO_PREFERIDO",v("Data de vencimento da primeira parcela"));
    wr("PADRINHO",v("Nome da pessoa que te indicou nossos serviços")); wr("TEL_PADRINHO","");
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

function configurarTriggerDiario() {
  ScriptApp.getProjectTriggers().filter(function(t){return t.getHandlerFunction()==="rotinaDiaria";}).forEach(function(t){ScriptApp.deleteTrigger(t);});
  ScriptApp.newTrigger("rotinaDiaria").timeBased().everyDays(1).atHour(7).create();
}

function rotinaDiaria() {
  Logger.log("ROTINA DIARIA - "+new Date().toLocaleString("pt-BR"));
  atualizarStatusParcelas();
  atualizarStatusContratos();
  verificarPromessasVencidas();
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

// ─── TESTE DE GERAÇÃO DE DOCUMENTO (rodar 1x pelo editor GAS) ───
function testarGerarDoc() {
  try {
    var template = DriveApp.getFileById(TEMPLATE_CONTRATO_ID);
    Logger.log("Template OK: " + template.getName());
    var folder   = DriveApp.getFolderById(PASTA_CONTRATOS_ID);
    Logger.log("Pasta OK: " + folder.getName());
    Logger.log("SUCESSO - acesso ao Drive funcionando");
  } catch(e) {
    Logger.log("ERRO: " + e.message);
  }
}

// ─── TESTE ZAPSIGN (rodar 1x pelo editor GAS) ───────────────────
function testarZapSign() {
  try {
    var zapUrl = enviarParaZapSign(TEMPLATE_CONTRATO_ID, "TESTE-001", "CLIENTE TESTE", "alexborges.mx@gmail.com");
    Logger.log("SUCESSO - Link credor: " + zapUrl);
  } catch(e) {
    Logger.log("ERRO: " + e.message);
  }
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
  var dtVenc=new Date(dados.dataVencimento||dados.dtVenc||"");
  var dtEmp=new Date(dados.dataEmprestimo||dados.dtEmp||new Date());
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
    sandbox: true,
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
      cpf  = String(dadosCli[i][(cmCli["CPF"]||3)-1]||"").replace(/\D/g,"");
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
  var stKey = cm["STATUS"] || cm["STATUS_PAGAMENTO"] || 11;
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
