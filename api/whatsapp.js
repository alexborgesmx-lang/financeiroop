const GAS_URL =
  "https://script.google.com/macros/s/AKfycbynQKpafDbaBTT-jqs4nCSzbbx8A72MAqDyGxwy86lIt0ykZxeFT8IdlO7zjj0rJEHy7Q/exec";

const HAIKU  = "claude-haiku-4-5-20251001";
const SONNET = "claude-sonnet-4-6";

const TRIAGEM_SYSTEM = `Você é o assistente de atendimento da Borges Assessoria, empresa de crédito pessoal.
Você conversa pelo WhatsApp com leads que querem fazer um empréstimo.

TOM E ESTILO:
- Escreva como uma pessoa real escreveria no WhatsApp: informal, direto, sem formalidades
- NUNCA comece mensagens com saudações repetidas ("Olá!", "Oi!", "Bem-vindo") — isso só vale na primeira mensagem
- NUNCA repita o nome da empresa em cada mensagem
- Sem emojis em excesso (no máximo 1 por mensagem, e só se fizer sentido)
- Respostas curtas — uma pergunta por vez

REGRAS DO NEGÓCIO:
- Atendemos apenas por indicação de clientes ativos
- CLT obrigatório (com exceção para indicados por padrinhos com histórico excelente)
- Valor máximo no primeiro empréstimo: R$ 1.500
- Prazo: 1x a 12x
- Taxas: informar apenas que variam por perfil e são definidas após análise

ESTADOS E O QUE FAZER:

INICIO:
  Primeira mensagem do lead. Apresente-se UMA VEZ de forma breve e natural.
  Exemplo: "Oi! Sou da Borges Assessoria. Antes de tudo, quem te indicou pra gente?"
  Mude para: AGUARDANDO_PADRINHO

AGUARDANDO_PADRINHO:
  Você perguntou quem indicou. A resposta do lead é o NOME DO PADRINHO (não o nome do lead).
  Se lead responder com um nome (ex: "Gleiciana", "João Silva"): extraia em extractedData.padrinho, use action "verificar_padrinho".
  Responda algo como: "Entendido! Vou verificar aqui. Você tem carteira assinada (CLT)?"
  Mude para: AGUARDANDO_CLT

AGUARDANDO_CLT:
  Você perguntou sobre CLT. Avalie a resposta:
  - Se sim: continue para AGUARDANDO_VALOR
  - Se não: use action "encerrar_reprovado"
  Resposta natural, sem saudações.

AGUARDANDO_VALOR:
  Pergunte: "Qual valor você precisa e em quantas vezes pensa em pagar?"
  Mude para: AGUARDANDO_TEMPO_EMPRESA após a resposta

AGUARDANDO_TEMPO_EMPRESA:
  Pergunte há quanto tempo o lead trabalha na empresa atual.
  Exemplo: "Há quanto tempo você está nessa empresa?"
  Extraia em extractedData.tempoEmpresa (ex: "2 anos", "8 meses").
  Após responder: use action "enviar_formulario"
  Mude para: FORMULARIO_ENVIADO

FORMULARIO_ENVIADO:
  Informe que vai enviar o formulário e peça o contracheque.
  Não repita isso se já foi dito.

ATENÇÃO GERAL:
- Se o lead já respondeu algo em mensagens anteriores, NÃO pergunte de novo
- Leia o histórico antes de responder
- Se o lead diz "sim" ou confirma algo, aceite e avance — não questione de novo

RESPONDA SOMENTE COM JSON puro (sem markdown, sem texto fora):
{
  "reply": "mensagem para enviar",
  "newState": "ESTADO",
  "extractedData": {},
  "action": null
}

Estados: INICIO, AGUARDANDO_PADRINHO, AGUARDANDO_CLT, AGUARDANDO_VALOR, AGUARDANDO_TEMPO_EMPRESA, FORMULARIO_ENVIADO, REPROVADO`;

const CONTRACHEQUE_PROMPT = `Analise este contracheque brasileiro e retorne APENAS o JSON abaixo, sem texto adicional:
{
  "nome_funcionario": "",
  "cpf": "",
  "nome_empregador": "",
  "data_admissao": "",
  "mes_referencia": "",
  "salario_bruto": 0,
  "total_descontos": 0,
  "salario_liquido": 0
}
Campos que não conseguir ler: deixe vazio ou 0.`;

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).end();

  const body   = req.body || {};
  const from   = String(body.From || "");
  const msg    = String(body.Body || "").trim();
  const nMedia = parseInt(body.NumMedia || "0");
  const mUrl   = String(body.MediaUrl0 || "");
  const mType  = String(body.MediaContentType0 || "");

  const tel = from.replace("whatsapp:", "").replace(/\D/g, "");
  if (!tel) return twiml(res, "");

  try {
    // Fix: extract lead from GAS response wrapper {ok, lead}
    const gasResp = await gasCall({ action: "buscarLeadPorTel", tel });
    const lead = gasResp?.lead || null;

    // Already processed — stay silent
    if (lead?.STATUS === "COMPLETO" || lead?.STATUS === "REPROVADO") {
      return twiml(res, "");
    }

    let reply;
    if (nMedia > 0 && mUrl && lead?.STATUS === "FORMULARIO_ENVIADO") {
      reply = await handleContracheque(lead, mUrl, mType);
    } else {
      reply = await handleText(lead, tel, msg);
    }

    return twiml(res, reply);
  } catch (err) {
    console.error("[whatsapp]", err);
    return twiml(res, "Tive um problema técnico. Tente novamente em instantes.");
  }
}

// ─── Text conversation ────────────────────────────────────────────────────────

async function handleText(lead, tel, message) {
  const estado   = lead?.STATUS || "INICIO";
  const historico = lead ? JSON.parse(lead.HISTORICO_JSON || "[]") : [];

  const messages = [...historico, { role: "user", content: message }];
  const raw = await claudeCall(messages, TRIAGEM_SYSTEM, HAIKU);

  let parsed;
  try {
    const jsonMatch = raw.match(/\{[\s\S]*\}/);
    parsed = JSON.parse(jsonMatch ? jsonMatch[0] : raw);
  } catch { return "Desculpe, não entendi. Pode repetir?"; }

  const { reply, newState, extractedData = {}, action } = parsed;

  const newHistory = [
    ...historico,
    { role: "user", content: message },
    { role: "assistant", content: reply },
  ].slice(-20);

  // Verify padrinho in GAS when name is extracted
  let padrinhoQualifica = lead?.PADRINHO_QUALIFICA || null;
  if (action === "verificar_padrinho" && extractedData.padrinho) {
    const vp = await gasCall({ action: "verificarPadrinho", nome: extractedData.padrinho });
    padrinhoQualifica = vp?.qualifica ? "sim" : "nao";
  }

  const now = new Date().toISOString();
  const atualiza = {
    STATUS:         newState || estado,
    HISTORICO_JSON: JSON.stringify(newHistory),
    ATUALIZADO_EM:  now,
    ...(extractedData.padrinho    && { PADRINHO:           extractedData.padrinho }),
    ...(padrinhoQualifica         && { PADRINHO_QUALIFICA: padrinhoQualifica }),
    ...(extractedData.clt != null && { CLT:                extractedData.clt ? "sim" : "nao" }),
    ...(extractedData.valor       && { VALOR_SOLICITADO:   extractedData.valor }),
    ...(extractedData.prazo        && { PRAZO_SOLICITADO:   extractedData.prazo }),
    ...(extractedData.tempoEmpresa && { TEMPO_EMPRESA:      extractedData.tempoEmpresa }),
  };

  if (!lead) {
    await gasCall({ action: "criarLead", dados: { TEL: tel, CRIADO_EM: now, ...atualiza } });
  } else {
    await gasCall({ action: "atualizarLead", idLead: lead.ID_LEAD, dados: atualiza });
  }

  if (action === "enviar_formulario") {
    const formsUrl = process.env.FORMS_URL || "";
    const suffix   = formsUrl
      ? `\n\nAqui está o formulário: ${formsUrl}\n\nDepois de preencher, me manda uma foto do contracheque mais recente.`
      : "\n\nVou te enviar o link do formulário em seguida. Depois de preencher, me manda uma foto do contracheque mais recente.";
    return reply + suffix;
  }

  return reply;
}

// ─── Contracheque (media) ─────────────────────────────────────────────────────

async function handleContracheque(lead, mediaUrl, contentType) {
  const isImage = contentType.startsWith("image/");
  const isPDF   = contentType === "application/pdf";

  if (!isImage && !isPDF) {
    return "Por favor, envie o contracheque como foto (JPG/PNG) ou PDF.";
  }

  const sid      = process.env.TWILIO_ACCOUNT_SID;
  const token    = process.env.TWILIO_AUTH_TOKEN;
  const b64creds = Buffer.from(`${sid}:${token}`).toString("base64");

  const mediaRes = await fetch(mediaUrl, {
    headers: { Authorization: `Basic ${b64creds}` },
  });
  if (!mediaRes.ok) {
    return "Não consegui abrir o arquivo. Pode enviar novamente como foto (JPG ou PNG)?";
  }

  const buf  = await mediaRes.arrayBuffer();
  const b64  = Buffer.from(buf).toString("base64");
  const mime = isImage ? contentType : "application/pdf";

  const contentBlock = isImage
    ? { type: "image",    source: { type: "base64", media_type: mime, data: b64 } }
    : { type: "document", source: { type: "base64", media_type: mime, data: b64 } };

  let dados;
  try {
    const raw = await claudeCall(
      [{ role: "user", content: [contentBlock, { type: "text", text: CONTRACHEQUE_PROMPT }] }],
      "", SONNET
    );
    const jsonMatch = raw.match(/\{[\s\S]*\}/);
    dados = JSON.parse(jsonMatch ? jsonMatch[0] : raw);
    console.log("[contracheque] parsed:", JSON.stringify(dados));
  } catch (err) {
    console.error("[contracheque] parse error:", err.message);
    return "Tive dificuldade para ler o contracheque. Pode enviar uma foto mais nítida?";
  }

  await gasCall({
    action: "atualizarLead",
    idLead: lead.ID_LEAD,
    dados: {
      STATUS:        "COMPLETO",
      NOME:          dados.nome_funcionario || "",
      RENDA_BRUTA:   dados.salario_bruto    || 0,
      RENDA_LIQUIDA: dados.salario_liquido  || 0,
      EMPREGADOR:    dados.nome_empregador  || "",
      DATA_ADMISSAO: dados.data_admissao    || "",
      ATUALIZADO_EM: new Date().toISOString(),
    },
  });

  await notificarAlex(lead, dados);
  return "Recebi! Vou analisar tudo e te retorno em breve. Obrigado!";
}

// ─── Alex notification ────────────────────────────────────────────────────────

async function notificarAlex(lead, ct) {
  const alexNum = process.env.ALEX_WHATSAPP_NUMBER;
  if (!alexNum) return;

  const liquido = parseFloat(ct.salario_liquido || 0);
  const valor   = parseFloat(lead.VALOR_SOLICITADO || 0);
  const prazo   = parseInt(lead.PRAZO_SOLICITADO || 0);
  const taxa    = 0.16;
  const parcela = prazo > 0 && valor > 0
    ? ((valor * (1 + taxa * prazo)) / prazo).toFixed(2) : "–";
  const pct     = liquido > 0 && parcela !== "–"
    ? ((parseFloat(parcela) / liquido) * 100).toFixed(1) : "–";
  const ok      = parcela !== "–" && liquido > 0 && parseFloat(parcela) <= liquido * 0.35;

  const msg = [
    "*Lead Aprovado na Triagem — Borges Assessoria*",
    "",
    `Nome: ${ct.nome_funcionario || lead.NOME || "–"}`,
    `WhatsApp: ${lead.TEL}`,
    `Indicado por: ${lead.PADRINHO || "–"} ${lead.PADRINHO_QUALIFICA === "sim" ? "✅" : "⚠️"}`,
    `CLT: ${lead.CLT === "sim" ? "Sim ✅" : "Não ⚠️"}`,
    `Empregador: ${ct.nome_empregador || "–"}`,
    `Admissão: ${ct.data_admissao || "–"}`,
    "",
    `Renda bruta: R$ ${ct.salario_bruto || "–"}`,
    `Descontos: R$ ${ct.total_descontos || "–"}`,
    `Renda líquida: R$ ${liquido || "–"}`,
    "",
    `Solicitou: R$ ${valor || "–"} em ${prazo || "–"}x`,
    `Parcela estimada: R$ ${parcela}/mês (16% a.m.)`,
    `% da renda: ${pct}% ${ok ? "✅" : "⚠️ ACIMA DO LIMITE"} (limite: 35%)`,
    "",
    "Formulário + contracheque recebidos.",
    "Próximo passo: aprovar e gerar contrato no sistema.",
  ].join("\n");

  await sendTwilio(alexNum, msg);
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

async function claudeCall(messages, system, model, attempt = 0) {
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "x-api-key":         process.env.ANTHROPIC_API_KEY,
      "anthropic-version": "2023-06-01",
      "content-type":      "application/json",
    },
    body: JSON.stringify({
      model,
      max_tokens: 1024,
      messages,
      ...(system && { system }),
    }),
  });
  if (res.status === 529 && attempt < 2) {
    await new Promise(r => setTimeout(r, 1000 * (attempt + 1)));
    return claudeCall(messages, system, model, attempt + 1);
  }
  if (!res.ok) throw new Error(`Claude ${res.status}: ${await res.text()}`);
  const data = await res.json();
  return data.content[0].text;
}

async function gasCall(body) {
  const res = await fetch(GAS_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
    redirect: "follow",
  });
  const text = await res.text();
  try { return JSON.parse(text); } catch { return null; }
}

async function sendTwilio(to, body) {
  const sid   = process.env.TWILIO_ACCOUNT_SID;
  const token = process.env.TWILIO_AUTH_TOKEN;
  const from  = process.env.TWILIO_WHATSAPP_NUMBER?.startsWith("whatsapp:")
    ? process.env.TWILIO_WHATSAPP_NUMBER
    : `whatsapp:${process.env.TWILIO_WHATSAPP_NUMBER}`;
  const toFmt = to.startsWith("whatsapp:") ? to : `whatsapp:${to}`;
  const creds = Buffer.from(`${sid}:${token}`).toString("base64");

  console.log("[sendTwilio] from:", from, "to:", toFmt);
  const r = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${sid}/Messages.json`, {
    method: "POST",
    headers: {
      Authorization:  `Basic ${creds}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({ To: toFmt, From: from, Body: body }).toString(),
  });
  if (!r.ok) console.error("[sendTwilio] error:", r.status, await r.text());
  else console.log("[sendTwilio] ok:", r.status);
}

function twiml(res, text) {
  const safe = text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
  res.setHeader("Content-Type", "text/xml");
  return res.status(200).send(
    `<?xml version="1.0" encoding="UTF-8"?><Response>${text ? `<Message>${safe}</Message>` : ""}</Response>`
  );
}
