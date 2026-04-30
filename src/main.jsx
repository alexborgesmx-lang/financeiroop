var ABAS = {
  CLIENTES:   "CLIENTES",
  CONTRATOS:  "CONTRATOS",
  PARCELAS:   "PARCELAS",
  PAGAMENTOS: "PAGAMENTOS",
  CONFIG:     "CONFIGURACOES"
};

var EMAIL_ADMIN = "alexborges.mx@gmail.com";

function onOpen() {
  SpreadsheetApp.getUi()
    .createMenu("FinanceiroOp")
    .addItem("Configurar Sistema", "configurarSistema")
    .addSeparator()
    .addItem("Novo Contrato", "dialogNovoContrato")
    .addItem("Registrar Pagamento", "dialogRegistrarPagamento")
    .addSeparator()
    .addItem("Atualizar Status Parcelas", "atualizarStatusParcelas")
    .addItem("Resumo do Dia", "dialogResumoDia")
    .addSeparator()
    .addItem("Configurar Trigger Formulario", "configurarTriggerFormulario")
    .addItem("Corrigir Validacoes (rodar 1x)", "corrigirValidacoesColunasW")
    .addItem("Resetar Sistema", "resetarSistema")
    .addToUi();
}

// ─────────────────────────────────────────────────────────────────
// API WEB (doGet / doPost) — usada pelo painel Vercel
// ─────────────────────────────────────────────────────────────────

function doGet(e) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();

  // Converte array de arrays em array de objetos usando a primeira linha como header
  function toObjetos(rows) {
    if (!rows || rows.length < 2) return [];
    var headers = rows[0];
    return rows.slice(1).map(function(row) {
      var obj = {};
      headers.forEach(function(h, i) {
        var cell = row[i];
        obj[String(h).trim()] = cell instanceof Date ? cell.toISOString() : cell;
      });
      return obj;
    });
  }

  var data = {
    CLIENTES:   toObjetos(ss.getSheetByName(ABAS.CLIENTES).getDataRange().getValues()),
    CONTRATOS:  toObjetos(ss.getSheetByName(ABAS.CONTRATOS).getDataRange().getValues()),
    PARCELAS:   toObjetos(ss.getSheetByName(ABAS.PARCELAS).getDataRange().getValues()),
    PAGAMENTOS: toObjetos(ss.getSheetByName(ABAS.PAGAMENTOS).getDataRange().getValues())
  };

  return ContentService
    .createTextOutput(JSON.stringify(data))
    .setMimeType(ContentService.MimeType.JSON);
}

function doPost(e) {
  var res;
  try {
    var body = JSON.parse(e.postData.contents);

    if (body.action === "pagamento") {
      registrarPagamentoAPI(body.idParcela, body.data, body.valor, body.forma || "dinheiro");
      res = { ok: true };

    } else if (body.action === "atualizarCliente") {
      atualizarDadosCliente(body.idCliente, body.campos);
      res = { ok: true };

    } else if (body.action === "ativarCliente") {
      atualizarCampoCliente(body.idCliente, "STATUS_CLIENTE", "ativo");
      res = { ok: true };

    } else if (body.action === "novoContrato") {
      var idContrato = criarContrato(body.dados);
      res = { ok: true, idContrato: idContrato };

    } else {
      res = { erro: "Acao nao reconhecida: " + body.action };
    }

  } catch(err) {
    res = { erro: err.message };
  }

  return ContentService
    .createTextOutput(JSON.stringify(res))
    .setMimeType(ContentService.MimeType.JSON);
}

// ─────────────────────────────────────────────────────────────────
// ATUALIZAR DADOS DO CLIENTE (usado pelo painel)
// ─────────────────────────────────────────────────────────────────

function atualizarDadosCliente(idCliente, campos) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var aba = ss.getSheetByName(ABAS.CLIENTES);

  var lastCol = aba.getLastColumn();
  var headersRow = aba.getRange(1, 1, 1, lastCol).getValues()[0];

  var colMap = {};
  headersRow.forEach(function(h, i) {
    if (h && String(h).trim() !== "") colMap[String(h).trim()] = i + 1;
  });

  var dados = aba.getDataRange().getValues();
  var linhaCliente = -1;
  for (var i = 1; i < dados.length; i++) {
    if (String(dados[i][0]).trim() === String(idCliente).trim()) {
      linhaCliente = i + 1;
      break;
    }
  }

  if (linhaCliente === -1) throw new Error("Cliente nao encontrado: " + idCliente);

  Object.keys(campos).forEach(function(header) {
    var c = colMap[header];
    if (c) {
      var valor = campos[header];
      try {
        aba.getRange(linhaCliente, c).clearDataValidations();
        aba.getRange(linhaCliente, c).setValue(valor);
      } catch(err) {
        Logger.log("Aviso ao atualizar " + header + ": " + err.message);
      }
    }
  });

  var cStatus = colMap["STATUS_CLIENTE"];
  if (cStatus) {
    var statusVal = SpreadsheetApp.newDataValidation()
      .requireValueInList(["ativo","inativo","aguardando_conferencia","bloqueado"], true)
      .build();
    aba.getRange(linhaCliente, cStatus).setDataValidation(statusVal);
  }
}

function atualizarCampoCliente(idCliente, header, valor) {
  atualizarDadosCliente(idCliente, { [header]: valor });
}

// ─────────────────────────────────────────────────────────────────
// REGISTRAR PAGAMENTO (via painel)
// ─────────────────────────────────────────────────────────────────

function registrarPagamentoAPI(idParcela, data, valor, forma) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var abaP = ss.getSheetByName(ABAS.PARCELAS);
  var abaPag = ss.getSheetByName(ABAS.PAGAMENTOS);

  var dados = abaP.getDataRange().getValues();
  for (var i = 1; i < dados.length; i++) {
    if (String(dados[i][0]) === String(idParcela)) {
      var dtPag = new Date(data);
      var vlPag = valor || parseFloat(dados[i][6]);

      abaP.getRange(i+1, 9).setValue(dtPag);
      abaP.getRange(i+1, 9).setNumberFormat("dd/mm/yyyy");
      abaP.getRange(i+1, 10).setValue(vlPag);
      abaP.getRange(i+1, 11).setValue("pago");

      var pagamentos = abaPag.getDataRange().getValues();
      var ultimoId = 1;
      pagamentos.slice(1).forEach(function(r) {
        var n = parseInt(String(r[0]).replace(/\D/g,"")) || 0;
        if (n >= ultimoId) ultimoId = n + 1;
      });
      var idPag = "PAG" + String(ultimoId).padStart(5, "0");

      var ul = abaPag.getLastRow() + 1;
      abaPag.getRange(ul, 1, 1, 9).setValues([[
        idPag, idParcela, dados[i][1], dados[i][2], dados[i][3],
        dtPag, vlPag, forma, ""
      ]]);
      abaPag.getRange(ul, 6).setNumberFormat("dd/mm/yyyy");
      abaPag.getRange(ul, 7).setNumberFormat("R$ #,##0.00");
      return;
    }
  }
  throw new Error("Parcela nao encontrada: " + idParcela);
}

// ─────────────────────────────────────────────────────────────────
// CRIAR CONTRATO (via painel)
// ─────────────────────────────────────────────────────────────────

function criarContrato(v) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var abaC = ss.getSheetByName(ABAS.CONTRATOS);

  var contratosAtuais = abaC.getDataRange().getValues();
  var ultimoId = 1;
  contratosAtuais.slice(1).forEach(function(r) {
    var n = parseInt(String(r[0]).replace(/\D/g,"")) || 0;
    if (n >= ultimoId) ultimoId = n + 1;
  });
  var idContrato = "CTR" + String(ultimoId).padStart(4, "0");

  var t = v.tx / 100;
  var n = v.np;
  var p = v.vp;
  var jt = p * t * n;
  var tot = p + jt;
  var parc = tot / n;

  var ul = abaC.getLastRow() + 1;
  abaC.getRange(ul, 1, 1, 16).setValues([[
    idContrato, v.clienteId, v.clienteNome,
    new Date(v.dtEmp), new Date(v.dtVenc),
    p, n, t, t*n, jt, tot, parc, p/n, jt/n,
    "", "ativo"
  ]]);
  abaC.getRange(ul, 4, 1, 2).setNumberFormat("dd/mm/yyyy");
  abaC.getRange(ul, 6, 1, 1).setNumberFormat("R$ #,##0.00");
  abaC.getRange(ul, 8, 1, 2).setNumberFormat("0.00%");
  abaC.getRange(ul, 10, 1, 5).setNumberFormat("R$ #,##0.00");

  gerarParcelas(idContrato);
  return idContrato;
}

// ─────────────────────────────────────────────────────────────────
// INTEGRAÇÃO COM FORMULÁRIO GOOGLE
// ─────────────────────────────────────────────────────────────────

function onFormSubmit(e) {
  try {
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var abaCli = ss.getSheetByName(ABAS.CLIENTES);
    if (!abaCli) throw new Error("Aba CLIENTES nao encontrada");

    var nv = e.namedValues;
    function v(campo) {
      var val = nv[campo];
      return val && val[0] ? String(val[0]).trim() : "";
    }

    var lastCol = abaCli.getLastColumn();
    var headersRow = abaCli.getRange(1, 1, 1, lastCol).getValues()[0];
    var colMap = {};
    headersRow.forEach(function(h, i) {
      if (h && String(h).trim() !== "") colMap[String(h).trim()] = i + 1;
    });

    var dados = abaCli.getDataRange().getValues();
    var proximoId = 1;
    dados.slice(1).forEach(function(row) {
      var n = parseInt(row[0]) || 0;
      if (n >= proximoId) proximoId = n + 1;
    });
    var idCliente = String(proximoId).padStart(3, "0");

    var novaLinha = abaCli.getLastRow() + 1;
    abaCli.getRange(novaLinha, 1, 1, lastCol).clearDataValidations();

    function escreve(header, valor) {
      var c = colMap[header];
      if (c) {
        try { abaCli.getRange(novaLinha, c).setValue(valor); }
        catch(cellErr) { Logger.log("Aviso ao escrever " + header + ": " + cellErr.message); }
      }
    }

    escreve("ID_CLIENTE",              idCliente);
    escreve("NOME",                    v("Nome Completo"));
    escreve("CPF",                     v("CPF (somente numeros)"));
    escreve("RG",                      v("RG (somente numeros)"));
    escreve("NACIONALIDADE",           v("Nacionalidade"));
    escreve("ESTADO_CIVIL",            v("Estado civil"));
    escreve("PROFISSAO",               v("Profissao"));
    escreve("TELEFONE_WPP",            v("WhatsApp com DDD (Somente n\u00fameros)"));
    escreve("EMAIL",                   v("E-mail (tudo min\u00fasculo)"));
    escreve("CEP",                     v("CEP (Somente n\u00fameros)"));
    escreve("RUA",                     v("Rua Avenida"));
    escreve("NUMERO",                  v("Numero (Somente n\u00fameros)"));
    escreve("QUADRA",                  v("Quadra (Somente n\u00fameros)"));
    escreve("LOTE",                    v("Lote (Somente n\u00fameros)"));
    escreve("SETOR",                   v("Setor/Bairro"));
    escreve("COMPLEMENTO",             v("Complemento (Casa, Condom\u00ednio, Ap, Bloco)"));
    escreve("CIDADE_ESTADO",           v("Cidade Estado"));
    escreve("CONTATO_CONFIANCA_1",     v("Pessoa de confianca 1 Nome"));
    escreve("TEL_CONFIANCA_1",         v("Pessoa de confianca 1 Telefone"));
    escreve("CONTATO_CONFIANCA_2",     v("Pessoa de confianca 2 Nome"));
    escreve("TEL_CONFIANCA_2",         v("Pessoa de confianca 2 Telefone"));
    escreve("DIA_VENCIMENTO_PREFERIDO",v("Data de vencimento da primeira parcela"));
    escreve("PADRINHO",                v("Nome da pessoa que te indicou nossos servi\u00e7os"));
    escreve("TEL_PADRINHO",            "");
    escreve("DATA_CADASTRO",           new Date());
    escreve("STATUS_CLIENTE",          "aguardando_conferencia");
    escreve("OBSERVACOES",             "Cadastro via formulario - aguardando conferencia");

    var cData = colMap["DATA_CADASTRO"];
    if (cData) abaCli.getRange(novaLinha, cData).setNumberFormat("dd/mm/yyyy");

    var cStatus = colMap["STATUS_CLIENTE"];
    if (cStatus) {
      var statusVal = SpreadsheetApp.newDataValidation()
        .requireValueInList(["ativo","inativo","aguardando_conferencia","bloqueado"], true)
        .build();
      abaCli.getRange(novaLinha, cStatus).setDataValidation(statusVal);
    }

    var nome = v("Nome Completo") || "Novo cliente";
    GmailApp.sendEmail(
      EMAIL_ADMIN,
      "FinanceiroOp - Novo cadastro: " + nome,
      "Novo cliente via formulario.\n\nNome: " + nome + "\nCPF: " + v("CPF (somente numeros)") +
      "\nWhatsApp: " + v("WhatsApp com DDD (Somente n\u00fameros)") +
      "\nPadrinho: " + v("Nome da pessoa que te indicou nossos servi\u00e7os") +
      "\nID: " + idCliente + "\n\nConfira no painel FinanceiroOp."
    );

    Logger.log("Novo cliente via Forms: " + nome + " | ID: " + idCliente);

  } catch(err) {
    Logger.log("Erro onFormSubmit: " + err.message);
    GmailApp.sendEmail(EMAIL_ADMIN, "FinanceiroOp - Erro no cadastro via Forms", "Erro: " + err.message);
  }
}

function configurarTriggerFormulario() {
  ScriptApp.getProjectTriggers()
    .filter(function(t) { return t.getHandlerFunction() === "onFormSubmit"; })
    .forEach(function(t) { ScriptApp.deleteTrigger(t); });
  ScriptApp.newTrigger("onFormSubmit")
    .forSpreadsheet(SpreadsheetApp.getActiveSpreadsheet())
    .onFormSubmit()
    .create();
  SpreadsheetApp.getUi().alert("Trigger configurado!");
}

function corrigirValidacoesColunasW() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var aba = ss.getSheetByName(ABAS.CLIENTES);
  if (!aba) { SpreadsheetApp.getUi().alert("Aba CLIENTES nao encontrada."); return; }

  var lastRow = Math.max(aba.getLastRow(), 2);
  var lastCol = aba.getLastColumn();
  var headersRow = aba.getRange(1, 1, 1, lastCol).getValues()[0];
  var colMap = {};
  headersRow.forEach(function(h, i) {
    if (h && String(h).trim() !== "") colMap[String(h).trim()] = i + 1;
  });

  aba.getRange(2, 1, lastRow - 1, lastCol).clearDataValidations();

  var cStatus = colMap["STATUS_CLIENTE"];
  if (cStatus) {
    var statusVal = SpreadsheetApp.newDataValidation()
      .requireValueInList(["ativo","inativo","aguardando_conferencia","bloqueado"], true)
      .build();
    aba.getRange(2, cStatus, lastRow - 1, 1).setDataValidation(statusVal);
  }

  SpreadsheetApp.getUi().alert("Validacoes corrigidas!");
}

// ─────────────────────────────────────────────────────────────────
// CONFIGURAR SISTEMA
// ─────────────────────────────────────────────────────────────────

function configurarSistema() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  criarAbaClientes(ss);
  criarAbaContratos(ss);
  criarAbaParcelas(ss);
  criarAbaPagamentos(ss);
  criarAbaConfiguracoes(ss);
  configurarTriggerDiario();
  ["Plan1","Sheet1","Pagina1"].forEach(function(nome) {
    try { var a = ss.getSheetByName(nome); if (a) ss.deleteSheet(a); } catch(e){}
  });
  SpreadsheetApp.getUi().alert("FinanceiroOp configurado!");
}

function resetarSistema() {
  var ui = SpreadsheetApp.getUi();
  var resp = ui.alert("ATENCAO", "Apaga TODOS os dados. Confirma?", ui.ButtonSet.YES_NO);
  if (resp === ui.Button.YES) { configurarSistema(); ui.alert("Sistema resetado."); }
}

function criarAbaClientes(ss) {
  var aba = ss.getSheetByName(ABAS.CLIENTES) || ss.insertSheet(ABAS.CLIENTES);
  if (aba.getLastRow() > 0) return;
  var headers = [
    "ID_CLIENTE","NOME","CPF","RG","NACIONALIDADE","ESTADO_CIVIL","PROFISSAO",
    "TELEFONE_WPP","EMAIL","CEP","RUA","NUMERO","QUADRA","LOTE","SETOR",
    "COMPLEMENTO","CIDADE_ESTADO","CONTATO_CONFIANCA_1","TEL_CONFIANCA_1",
    "CONTATO_CONFIANCA_2","TEL_CONFIANCA_2","DIA_VENCIMENTO_PREFERIDO",
    "PADRINHO","TEL_PADRINHO","DATA_CADASTRO","STATUS_CLIENTE","OBSERVACOES"
  ];
  aba.getRange(1, 1, 1, headers.length).setValues([headers]);
  aba.getRange(1, 1, 1, headers.length).setFontWeight("bold").setBackground("#1a1a2e").setFontColor("#ffffff");
  aba.setFrozenRows(1);
  var statusVal = SpreadsheetApp.newDataValidation()
    .requireValueInList(["ativo","inativo","aguardando_conferencia","bloqueado"], true).build();
  aba.getRange(2, 26, 1000, 1).setDataValidation(statusVal);
  aba.getRange(2, 25, 1000, 1).setNumberFormat("dd/mm/yyyy");
}

function criarAbaContratos(ss) {
  var aba = ss.getSheetByName(ABAS.CONTRATOS) || ss.insertSheet(ABAS.CONTRATOS);
  if (aba.getLastRow() > 0) return;
  var headers = [
    "ID_CONTRATO","ID_CLIENTE","NOME_CLIENTE","DATA_EMPRESTIMO","DATA_PRIMEIRA_PARCELA",
    "VALOR_PRINCIPAL","NUM_PARCELAS","TAXA_JUROS_MENSAL","TAXA_JUROS_TOTAL",
    "JUROS_TOTAL","VALOR_TOTAL","VALOR_PARCELA","PARCELA_PRINCIPAL","PARCELA_JUROS",
    "OBSERVACOES","STATUS_CONTRATO"
  ];
  aba.getRange(1, 1, 1, headers.length).setValues([headers]);
  aba.getRange(1, 1, 1, headers.length).setFontWeight("bold").setBackground("#1a1a2e").setFontColor("#ffffff");
  aba.setFrozenRows(1);
}

function criarAbaParcelas(ss) {
  var aba = ss.getSheetByName(ABAS.PARCELAS) || ss.insertSheet(ABAS.PARCELAS);
  if (aba.getLastRow() > 0) return;
  var headers = [
    "ID_PARCELA","ID_CONTRATO","ID_CLIENTE","NOME_CLIENTE",
    "NUM_PARCELA","TOTAL_PARCELAS","VALOR_PARCELA","DATA_VENCIMENTO",
    "DATA_PAGAMENTO","VALOR_PAGO","STATUS","OBSERVACOES"
  ];
  aba.getRange(1, 1, 1, headers.length).setValues([headers]);
  aba.getRange(1, 1, 1, headers.length).setFontWeight("bold").setBackground("#1a1a2e").setFontColor("#ffffff");
  aba.setFrozenRows(1);
}

function criarAbaPagamentos(ss) {
  var aba = ss.getSheetByName(ABAS.PAGAMENTOS) || ss.insertSheet(ABAS.PAGAMENTOS);
  if (aba.getLastRow() > 0) return;
  var headers = [
    "ID_PAGAMENTO","ID_PARCELA","ID_CONTRATO","ID_CLIENTE","NOME_CLIENTE",
    "DATA_PAGAMENTO","VALOR_PAGO","FORMA_PAGAMENTO","OBSERVACOES"
  ];
  aba.getRange(1, 1, 1, headers.length).setValues([headers]);
  aba.getRange(1, 1, 1, headers.length).setFontWeight("bold").setBackground("#1a1a2e").setFontColor("#ffffff");
  aba.setFrozenRows(1);
}

function criarAbaConfiguracoes(ss) {
  var aba = ss.getSheetByName(ABAS.CONFIG) || ss.insertSheet(ABAS.CONFIG);
  if (aba.getLastRow() > 0) return;
  var dados = [
    ["CHAVE","VALOR"],
    ["NOME_EMPRESA","Minha Empresa"],
    ["TAXA_JUROS_PADRAO","0.10"],
    ["NUM_PARCELAS_PADRAO","12"],
    ["EMAIL_ADMIN", EMAIL_ADMIN]
  ];
  aba.getRange(1, 1, dados.length, 2).setValues(dados);
  aba.getRange(1, 1, 1, 2).setFontWeight("bold").setBackground("#1a1a2e").setFontColor("#ffffff");
}

function configurarTriggerDiario() {
  ScriptApp.getProjectTriggers()
    .filter(function(t) { return t.getHandlerFunction() === "rotinaDiaria"; })
    .forEach(function(t) { ScriptApp.deleteTrigger(t); });
  ScriptApp.newTrigger("rotinaDiaria").timeBased().everyDays(1).atHour(7).create();
}

function rotinaDiaria() {
  Logger.log("ROTINA DIARIA - " + new Date().toLocaleString("pt-BR"));
  atualizarStatusParcelas();
}

function atualizarStatusParcelas() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var aba = ss.getSheetByName(ABAS.PARCELAS);
  if (!aba || aba.getLastRow() <= 1) return 0;

  var dados = aba.getDataRange().getValues();
  var hoje = new Date(); hoje.setHours(0,0,0,0);
  var count = 0;

  for (var i = 1; i < dados.length; i++) {
    var status = String(dados[i][10]).toLowerCase();
    if (status === "pago" || status === "cancelado") continue;
    var venc = new Date(dados[i][7]); venc.setHours(0,0,0,0);
    var novoStatus = venc < hoje ? "atrasado" : venc.getTime() === hoje.getTime() ? "vence_hoje" : "pendente";
    if (novoStatus !== status) { aba.getRange(i + 1, 11).setValue(novoStatus); count++; }
  }
  return count;
}

function gerarParcelas(idContrato) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var abaC = ss.getSheetByName(ABAS.CONTRATOS);
  var abaP = ss.getSheetByName(ABAS.PARCELAS);

  var contratos = abaC.getDataRange().getValues();
  var contrato = null;
  for (var i = 1; i < contratos.length; i++) {
    if (String(contratos[i][0]) === String(idContrato)) { contrato = contratos[i]; break; }
  }
  if (!contrato) return;

  var idCliente   = contrato[1];
  var nomeCliente = contrato[2];
  var numParcelas = parseInt(contrato[6]);
  var valorParc   = parseFloat(contrato[11]);
  var dtPrimeira  = new Date(contrato[4]);

  var parcelas = abaP.getDataRange().getValues();
  var ultimaId = 1;
  parcelas.slice(1).forEach(function(r) {
    var n = parseInt(String(r[0]).replace(/\D/g,"")) || 0;
    if (n >= ultimaId) ultimaId = n + 1;
  });

  var novas = [];
  for (var k = 0; k < numParcelas; k++) {
    var dtVenc = new Date(dtPrimeira);
    dtVenc.setMonth(dtVenc.getMonth() + k);
    novas.push([
      String(ultimaId + k).padStart(5, "0"), idContrato, idCliente, nomeCliente,
      k + 1, numParcelas, valorParc, dtVenc, "", "", "pendente", ""
    ]);
  }

  if (novas.length > 0) {
    var ul = abaP.getLastRow() + 1;
    abaP.getRange(ul, 1, novas.length, novas[0].length).setValues(novas);
    abaP.getRange(ul, 8, novas.length, 1).setNumberFormat("dd/mm/yyyy");
    abaP.getRange(ul, 7, novas.length, 1).setNumberFormat("R$ #,##0.00");
  }
}

// ─────────────────────────────────────────────────────────────────
// DIALOGS (menu Sheets)
// ─────────────────────────────────────────────────────────────────

function dialogNovoContrato() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var abaCli = ss.getSheetByName(ABAS.CLIENTES);
  var dados = abaCli.getDataRange().getValues();

  var opcoes = "";
  for (var i = 1; i < dados.length; i++) {
    if (String(dados[i][25]).toLowerCase() === "ativo") {
      opcoes += "<option value='" + dados[i][0] + "|" + dados[i][1] + "'>" + dados[i][0] + " - " + dados[i][1] + "</option>";
    }
  }

  var html = "<html><body style='font-family:sans-serif;padding:16px;font-size:14px'>" +
    "<h3 style='margin:0 0 16px'>Novo Contrato</h3>" +
    "<label>Cliente</label><br><select id='cli' style='width:100%;margin:4px 0 12px;padding:6px'><option value=''>Selecione...</option>" + opcoes + "</select><br>" +
    "<label>Data do Emprestimo</label><br><input type='date' id='dtEmp' style='width:100%;margin:4px 0 12px;padding:6px'><br>" +
    "<label>Data da 1a Parcela</label><br><input type='date' id='dtVenc' style='width:100%;margin:4px 0 12px;padding:6px'><br>" +
    "<label>Valor Principal (R$)</label><br><input type='number' id='vp' min='0' step='0.01' style='width:100%;margin:4px 0 12px;padding:6px'><br>" +
    "<label>Numero de Parcelas</label><br><input type='number' id='np' min='1' value='12' style='width:100%;margin:4px 0 12px;padding:6px'><br>" +
    "<label>Taxa de Juros Mensal (%)</label><br><input type='number' id='tx' min='0' step='0.01' value='10' style='width:100%;margin:4px 0 12px;padding:6px'><br>" +
    "<p id='err' style='color:red;display:none'></p>" +
    "<button onclick='salvar()' style='width:100%;padding:10px;background:#1a1a2e;color:#fff;border:none;border-radius:4px;cursor:pointer'>Salvar e Gerar Parcelas</button>" +
    "<script>function salvar(){var cli=document.getElementById('cli').value;var dtEmp=document.getElementById('dtEmp').value;var dtVenc=document.getElementById('dtVenc').value;var vp=document.getElementById('vp').value;var np=document.getElementById('np').value;var tx=document.getElementById('tx').value;var err=document.getElementById('err');if(!cli){err.textContent='Selecione um cliente.';err.style.display='block';return;}if(!dtEmp||!dtVenc||!vp||!np||!tx){err.textContent='Preencha todos os campos.';err.style.display='block';return;}var parts=cli.split('|');err.style.display='none';google.script.run.withSuccessHandler(function(){alert('Contrato salvo!');google.script.host.close();}).withFailureHandler(function(e){alert('Erro: '+e.message);}).salvarNovoContrato({clienteId:parts[0],clienteNome:parts[1],dtEmp:dtEmp,dtVenc:dtVenc,vp:parseFloat(vp),np:parseInt(np),tx:parseFloat(tx)});}</script></body></html>";

  SpreadsheetApp.getUi().showModalDialog(HtmlService.createHtmlOutput(html).setWidth(420).setHeight(560), "Novo Contrato");
}

function salvarNovoContrato(v) {
  criarContrato(v);
}

function dialogRegistrarPagamento() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var abaP = ss.getSheetByName(ABAS.PARCELAS);
  var dados = abaP.getDataRange().getValues();

  var opcoes = "";
  for (var i = 1; i < dados.length; i++) {
    var status = String(dados[i][10]).toLowerCase();
    if (status !== "pago" && status !== "cancelado") {
      var venc = dados[i][7] ? new Date(dados[i][7]).toLocaleDateString("pt-BR") : "";
      opcoes += "<option value='" + dados[i][0] + "'>" + dados[i][0] + " | " + dados[i][3] + " | Parc " + dados[i][4] + "/" + dados[i][5] + " | Venc: " + venc + " | R$ " + parseFloat(dados[i][6]).toFixed(2) + "</option>";
    }
  }

  var html = "<html><body style='font-family:sans-serif;padding:16px;font-size:14px'>" +
    "<h3 style='margin:0 0 16px'>Registrar Pagamento</h3>" +
    "<label>Parcela</label><br><select id='parc' style='width:100%;margin:4px 0 12px;padding:6px'><option value=''>Selecione...</option>" + opcoes + "</select><br>" +
    "<label>Data do Pagamento</label><br><input type='date' id='dtPag' style='width:100%;margin:4px 0 12px;padding:6px'><br>" +
    "<label>Valor Pago (R$)</label><br><input type='number' id='vlPag' min='0' step='0.01' style='width:100%;margin:4px 0 12px;padding:6px'><br>" +
    "<label>Forma de Pagamento</label><br><select id='forma' style='width:100%;margin:4px 0 12px;padding:6px'><option value='dinheiro'>Dinheiro</option><option value='pix'>PIX</option><option value='transferencia'>Transferencia</option></select><br>" +
    "<p id='err' style='color:red;display:none'></p>" +
    "<button onclick='salvar()' style='width:100%;padding:10px;background:#1a1a2e;color:#fff;border:none;border-radius:4px;cursor:pointer'>Confirmar Pagamento</button>" +
    "<script>function salvar(){var parc=document.getElementById('parc').value;var dtPag=document.getElementById('dtPag').value;var vlPag=document.getElementById('vlPag').value;var forma=document.getElementById('forma').value;var err=document.getElementById('err');if(!parc||!dtPag||!vlPag){err.textContent='Preencha todos os campos.';err.style.display='block';return;}err.style.display='none';google.script.run.withSuccessHandler(function(){alert('Pagamento registrado!');google.script.host.close();}).withFailureHandler(function(e){alert('Erro: '+e.message);}).salvarPagamentoDialog({idParcela:parc,dtPag:dtPag,vlPag:parseFloat(vlPag),forma:forma});}</script></body></html>";

  SpreadsheetApp.getUi().showModalDialog(HtmlService.createHtmlOutput(html).setWidth(420).setHeight(480), "Registrar Pagamento");
}

function salvarPagamentoDialog(v) {
  registrarPagamentoAPI(v.idParcela, v.dtPag, v.vlPag, v.forma);
}

function dialogResumoDia() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var abaP = ss.getSheetByName(ABAS.PARCELAS);
  var dados = abaP.getDataRange().getValues();
  var hoje = new Date(); hoje.setHours(0,0,0,0);
  var venceHoje = 0, atrasadas = 0, recebidoHoje = 0, totalVH = 0, totalAt = 0;

  for (var i = 1; i < dados.length; i++) {
    var status = String(dados[i][10]).toLowerCase();
    var venc = new Date(dados[i][7]); venc.setHours(0,0,0,0);
    var valor = parseFloat(dados[i][6]) || 0;
    if (status !== "pago") {
      if (venc.getTime() === hoje.getTime()) { venceHoje++; totalVH += valor; }
      if (venc < hoje) { atrasadas++; totalAt += valor; }
    }
    if (status === "pago") {
      var dtPag = new Date(dados[i][8]); dtPag.setHours(0,0,0,0);
      if (dtPag.getTime() === hoje.getTime()) recebidoHoje += parseFloat(dados[i][9]) || 0;
    }
  }

  SpreadsheetApp.getUi().alert("Resumo do Dia",
    "Vencem hoje: " + venceHoje + " (R$ " + totalVH.toFixed(2) + ")\n" +
    "Atrasadas: " + atrasadas + " (R$ " + totalAt.toFixed(2) + ")\n" +
    "Recebido hoje: R$ " + recebidoHoje.toFixed(2),
    SpreadsheetApp.getUi().ButtonSet.OK);
}

function diagnosticarColunas() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var aba = ss.getSheetByName("CLIENTES");
  var lastCol = aba.getLastColumn();
  var headers = aba.getRange(1, 1, 1, lastCol).getValues()[0];
  var log = "lastCol = " + lastCol + "\n\n";
  headers.forEach(function(h, i) { log += "Col " + (i+1) + " = [" + h + "]\n"; });
  Logger.log(log);
  SpreadsheetApp.getUi().alert(log);
}
