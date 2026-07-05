const GAS_URL =
  "https://script.google.com/macros/s/AKfycbynQKpafDbaBTT-jqs4nCSzbbx8A72MAqDyGxwy86lIt0ykZxeFT8IdlO7zjj0rJEHy7Q/exec";

const HAIKU  = "claude-haiku-4-5-20251001";
const SONNET = "claude-sonnet-4-6";
const pick   = arr => arr[Math.floor(Math.random() * arr.length)];

// ─── Evolution API helpers ────────────────────────────────────────────────────

const evoUrl = () => (process.env.EVOLUTION_API_URL || "").replace(/\/$/, "");
const evoKey = () => process.env.EVOLUTION_API_KEY || "";
const evoIns = () => process.env.EVOLUTION_INSTANCE || "";

async function sendEvo(to, text) {
  const num = String(to).replace(/\D/g, "");
  if (!num) return;
  const r = await fetch(`${evoUrl()}/message/sendText/${evoIns()}`, {
    method:  "POST",
    headers: { "Content-Type": "application/json", apikey: evoKey() },
    body:    JSON.stringify({ number: num, text }),
  });
  if (!r.ok) console.error("[sendEvo] error:", r.status, await r.text());
  return r.ok;
}

async function getMediaBase64(data) {
  const r = await fetch(`${evoUrl()}/chat/getBase64FromMediaMessage/${evoIns()}`, {
    method:  "POST",
    headers: { "Content-Type": "application/json", apikey: evoKey() },
    body:    JSON.stringify({ message: { key: data.key, message: data.message } }),
  });
  if (!r.ok) return null;
  const d = await r.json();
  return d.base64 || null;
}

// ─── Tools do agente ─────────────────────────────────────────────────────────

const TOOLS = [
  {
    name: "verificar_padrinho",
    description:
      "Verifica se a pessoa que indicou o lead é cliente ativo da empresa. Chamar assim que o lead informar o nome de quem o indicou.",
    input_schema: {
      type: "object",
      properties: {
        nome: { type: "string", description: "Nome informado pelo lead" },
      },
      required: ["nome"],
    },
  },
  {
    name: "avancar_para_formulario",
    description:
      "Salva os dados coletados e avança o lead para a etapa do formulário + contracheque. Chamar SOMENTE quando tiver coletado: CLT confirmado, valor, prazo e tempo de empresa.",
    input_schema: {
      type: "object",
      properties: {
        clt:              { type: "boolean", description: "true se tem carteira assinada" },
        valor_solicitado: { type: "number",  description: "Valor em R$ solicitado" },
        prazo_solicitado: { type: "number",  description: "Número de parcelas desejado" },
        tempo_empresa:    { type: "string",  description: "Tempo na empresa, ex: '2 anos'" },
      },
      required: ["clt", "valor_solicitado", "prazo_solicitado", "tempo_empresa"],
    },
  },
  {
    name: "encerrar_reprovado",
    description:
      "Encerra a triagem reprovando o lead. Usar quando o lead confirmar que não tem carteira assinada (CLT).",
    input_schema: {
      type: "object",
      properties: {
        motivo: { type: "string" },
      },
      required: ["motivo"],
    },
  },
];

// ─── System prompt do agente ──────────────────────────────────────────────────

const AGENT_SYSTEM = `Você é atendente da Borges Assessoria, empresa de crédito pessoal, atendendo pelo WhatsApp.

TOM E ESTILO — OBRIGATÓRIO:
- Escreva como uma pessoa real no WhatsApp: informal, direto, sem formalidades
- Respostas CURTAS — máximo 3 linhas por mensagem
- NUNCA use: "Aguarde", "Em instantes", "Sua solicitação", "Estamos processando", "Olá!" repetido
- NUNCA use gírias ou expressões muito informais: "top", "mano", "cara", "massa", "irado", "demais", "ótimo demais"
- Varie os conectivos: "Certo", "Perfeito", "Entendi", "Tudo certo", "Ok"
- No máximo 1 emoji por mensagem, só quando fizer sentido
- Na primeira mensagem: apresente-se brevemente. Depois: nunca repita saudações
- Uma pergunta por vez

REGRAS DO NEGÓCIO:
- Atendimento apenas por indicação de cliente (padrinho)
- CLT obrigatório — sem carteira assinada: encerrar_reprovado
- Valor máximo no primeiro empréstimo: R$ 1.500
- Prazo: 1x a 12x
- Taxa: não informar valores; dizer que varia por perfil, definida após análise

FLUXO — colete em ordem natural, mas sem ser robótico:
1. Quem indicou → chamar verificar_padrinho com o nome
2. Se tem CLT → se não tiver: chamar encerrar_reprovado
3. Valor e prazo desejados
4. Tempo na empresa atual
5. Quando tiver todos os 4 dados → chamar avancar_para_formulario

SE PERGUNTAREM SOBRE TAXA: "As taxas variam por perfil, são definidas após a análise. Posso seguir com suas informações?"
SE PERGUNTAREM SOBRE PRAZO DE APROVAÇÃO: "Assim que o contracheque chegar, a gente analisa rápido."
SE PERGUNTAREM OUTROS ASSUNTOS: responda brevemente e volte ao fluxo.

IMPORTANTE:
- Leia o histórico completo — NÃO pergunte o que já foi respondido
- Se o padrinho não estiver no sistema, continue normalmente sem comentar
- Nunca mencione "tool", "sistema", "banco de dados" ou termos técnicos

---

EXEMPLOS REAIS DE COMO ALEX ESCREVE (imite este tom exato):

Lead: boa tarde, queria ver sobre empréstimo
Você: Boa tarde! Tudo bem? Espero que sim..
Pode me dizer quem te indicou?

Lead: foi a Gleiciana
Você: Perfeito, já verifico aqui.. você tem carteira assinada (CLT)?

Lead: sim
Você: Ok 👍
Qual valor você precisa e em quantas vezes pensa em pagar?

Lead: queria uns 1000, em umas 5x
Você: Ok, anotado aqui..
Há quanto tempo você está nessa empresa?

Lead: 2 anos
Você: Perfeito minha amiga, seu perfil pode se encaixar.
Preenche esse formulário rapidinho: [link]
E me manda o último contracheque depois 👍

---

Lead: mas qual a taxa?
Você: As taxas variam de acordo com o seu perfil.. assim que analisarmos o contracheque já te dou o retorno com o valor exato 👍

---

Lead: não tenho carteira assinada
Você: Entendi.. infelizmente no momento só trabalhamos com CLT.
Se a situação mudar, é só me chamar! 🤝

---

Lead: quando você libera?
Você: Assim que o contracheque chegar a gente analisa rápido, logo logo te retorno 😁

---

PRIMEIRA MENSAGEM (quando lead ainda não tem histórico):
Use SEMPRE uma destas variações, escolhendo aleatoriamente:
1. "Oi! Bem-vindo à Borges Assessoria 👋\n\nTrabalhamos com crédito pessoal, rápido e sem burocracia — só por indicação.\n\nVou fazer só 3 perguntinhas rápidas pra saber se consigo te ajudar, tá?\n\nPrimeira: quem te indicou pra gente?"
2. "Oi! Aqui é a Borges Assessoria 👋\n\nCrédito pessoal, rápido e sem burocracia — mas trabalhamos só por indicação.\n\nAntes de começar, preciso te fazer 3 perguntas rápidas pra ver se seu perfil se encaixa. Pode ser?\n\nQuem te indicou?"
3. "Oi! Bem-vindo 👋 Aqui é o Alex, da Borges Assessoria.\n\nA gente trabalha com empréstimo pessoal, rápido e sem enrolação.\n\nVou precisar de algumas informações rápidas pra não te fazer perder tempo — prometo que é rápido 😊\n\nMe fala: quem te indicou pra gente?"`;

// ─── Contracheque prompt (Sonnet) ─────────────────────────────────────────────

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

// ─── Handler principal ────────────────────────────────────────────────────────

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).end();

  // Validar webhook secret (configurado na instância Evolution)
  const secret = process.env.EVOLUTION_WEBHOOK_SECRET;
  if (secret) {
    const apikey = req.headers["apikey"] || req.headers["x-evolution-apikey"];
    if (apikey !== secret) return res.status(401).end();
  }

  // Responde imediatamente — Evolution não precisa aguardar a resposta
  res.status(200).json({ ok: true });

  const body = req.body || {};
  console.log("[whatsapp] payload:", JSON.stringify(body).slice(0, 500));

  // Aceita eventos de mensagens (formato varia por versão do Evolution)
  const event = String(body.event || body.type || "");
  const VALID_EVENTS = ["messages.upsert", "MESSAGE", "message"];
  if (!VALID_EVENTS.includes(event)) return;

  // Suporta dois formatos de payload (Evolution API padrão e Evolution GO)
  const data = body.data || body.message || body || {};
  const key  = data.key || {};

  // Ignora mensagens enviadas por nós e mensagens de grupos
  if (key.fromMe || data.fromMe) return;
  const remoteJid = String(key.remoteJid || data.remoteJid || "");
  if (remoteJid.endsWith("@g.us")) return;

  // Extrai número limpo (sem DDI para facilitar comparações internas)
  const tel = remoteJid.replace(/@s\.whatsapp\.net$/, "").replace(/\D/g, "");
  if (!tel) return;

  // Extrai conteúdo da mensagem
  const msgType = String(data.messageType || data.type || "");
  const msg     = (
    data.message?.conversation ||
    data.message?.extendedTextMessage?.text ||
    data.body ||
    ""
  ).trim();
  const isMedia = ["imageMessage", "documentMessage"].includes(msgType);

  try {
    const gasResp = await gasCall({ action: "buscarLeadPorTel", tel });
    const lead    = gasResp?.lead || null;

    if (lead?.STATUS === "REPROVADO") return;

    if (lead?.STATUS === "COMPLETO" || !lead) {
      const cd = await gasCall({ action: "buscarClientePorTel", tel });
      if (cd?.encontrado) {
        const reply = await handleClienteMsg(cd, msg);
        if (reply) await sendEvo(tel, reply);
        return;
      }
      if (lead?.STATUS === "COMPLETO") return;
    }

    // Lead em FORMULARIO_ENVIADO enviou texto → lembrar do contracheque
    if (lead?.STATUS === "FORMULARIO_ENVIADO" && !isMedia) {
      await sendEvo(tel, "Oi! Quando preencher o formulário, pode me mandar o contracheque por aqui 👍");
      return;
    }

    let reply;
    if (isMedia && lead?.STATUS === "FORMULARIO_ENVIADO") {
      reply = await handleContracheque(lead, data, tel);
    } else {
      reply = await handleAgent(lead, tel, msg);
    }

    if (reply) await sendEvo(tel, reply);
  } catch (err) {
    console.error("[whatsapp] error:", err);
  }
}

// ─── Agente com tool_use ──────────────────────────────────────────────────────

async function handleAgent(lead, tel, msg) {
  const historico = (lead ? JSON.parse(lead.HISTORICO_JSON || "[]") : [])
    .filter(m => m.role && typeof m.content === "string")
    .slice(-6);

  const coletados = [];
  if (lead?.PADRINHO)         coletados.push(`padrinho="${lead.PADRINHO}" (${lead.PADRINHO_QUALIFICA === "sim" ? "qualificado ✅" : "não qualificado ⚠️"})`);
  if (lead?.CLT)              coletados.push(`clt="${lead.CLT}"`);
  if (lead?.VALOR_SOLICITADO) coletados.push(`valor_solicitado=${lead.VALOR_SOLICITADO}`);
  if (lead?.PRAZO_SOLICITADO) coletados.push(`prazo_solicitado=${lead.PRAZO_SOLICITADO}`);
  if (lead?.TEMPO_EMPRESA)    coletados.push(`tempo_empresa="${lead.TEMPO_EMPRESA}"`);

  const systemFinal = coletados.length > 0
    ? AGENT_SYSTEM + `\n\nDADOS JÁ COLETADOS E SALVOS: ${coletados.join(", ")}. NÃO pergunte de novo sobre esses itens.`
    : AGENT_SYSTEM;

  let currentMessages = [...historico, { role: "user", content: msg }];
  const updates  = {};
  let finalReply = "";

  for (let i = 0; i < 6; i++) {
    const response = await claudeAgentCall(currentMessages, systemFinal);
    const toolUses  = response.content.filter(b => b.type === "tool_use");
    const textParts = response.content.filter(b => b.type === "text");

    if (toolUses.length === 0) {
      finalReply = textParts.map(b => b.text).join("").trim();
      break;
    }

    const toolResults = [];
    let earlyExit = false;
    for (const tu of toolUses) {
      const result = await executeTool(tu.name, tu.input, updates, lead, tel);
      console.log(`[tool] ${tu.name}:`, JSON.stringify(tu.input));
      toolResults.push({ type: "tool_result", tool_use_id: tu.id, content: result.msg });
      if (result.reply) { finalReply = result.reply; earlyExit = true; }
    }
    if (earlyExit) break;

    currentMessages = [
      ...currentMessages,
      { role: "assistant", content: response.content },
      { role: "user",      content: toolResults },
    ];
  }

  const newHistory = [
    ...historico,
    { role: "user",      content: msg },
    { role: "assistant", content: finalReply },
  ].slice(-20);

  const now = new Date().toISOString();
  const atualiza = {
    STATUS:         updates.STATUS || lead?.STATUS || "EM_ANDAMENTO",
    HISTORICO_JSON: JSON.stringify(newHistory),
    ATUALIZADO_EM:  now,
    ...(updates.PADRINHO           && { PADRINHO:           updates.PADRINHO }),
    ...(updates.PADRINHO_QUALIFICA && { PADRINHO_QUALIFICA: updates.PADRINHO_QUALIFICA }),
    ...(updates.CLT                && { CLT:                updates.CLT }),
    ...(updates.VALOR_SOLICITADO   && { VALOR_SOLICITADO:   updates.VALOR_SOLICITADO }),
    ...(updates.PRAZO_SOLICITADO   && { PRAZO_SOLICITADO:   updates.PRAZO_SOLICITADO }),
    ...(updates.TEMPO_EMPRESA      && { TEMPO_EMPRESA:      updates.TEMPO_EMPRESA }),
  };

  if (!lead) {
    await gasCall({ action: "criarLead", dados: { TEL: tel, CRIADO_EM: now, ...atualiza } });
  } else {
    await gasCall({ action: "atualizarLead", idLead: lead.ID_LEAD, dados: atualiza });
  }

  return finalReply;
}

async function executeTool(name, input, updates, lead = null, tel = "") {
  if (name === "verificar_padrinho") {
    const vp = await gasCall({ action: "verificarPadrinho", nome: input.nome });

    if (vp?.multiplos) {
      return { msg: `Nome ambíguo: encontrei ${vp.opcoes?.length} clientes com nome similar (${vp.opcoes?.join(", ")}). Peça o nome completo ao lead antes de continuar.` };
    }

    const nomeReal = vp?.nomeEncontrado || input.nome;
    updates.PADRINHO           = nomeReal;
    updates.PADRINHO_QUALIFICA = vp?.qualifica ? "sim" : "nao";
    if (!vp?.existe) {
      return { msg: `Padrinho "${input.nome}" não encontrado. Continue a triagem normalmente.` };
    }
    return { msg: `Padrinho: ${nomeReal}. Qualifica: ${vp.qualifica ? "sim (contrato quitado)" : "não (sem contrato quitado)"}.` };
  }

  if (name === "avancar_para_formulario") {
    updates.STATUS           = "FORMULARIO_ENVIADO";
    updates.CLT              = input.clt ? "sim" : "nao";
    updates.VALOR_SOLICITADO = input.valor_solicitado;
    updates.PRAZO_SOLICITADO = input.prazo_solicitado;
    updates.TEMPO_EMPRESA    = input.tempo_empresa;
    const url = process.env.FORMS_URL || "";
    const reply = url
      ? pick([
          `Perfeito, seu perfil pode se encaixar..\n\nPreenche esse formulário rapidinho:\n${url}\n\nE me manda o contracheque depois 👍`,
          `Anotei tudo aqui..\n\nPreenche esse formulário:\n${url}\n\nQuando terminar, manda uma foto do contracheque mais recente 👍`,
          `Tudo certo..\n\nFormulário aqui:\n${url}\n\nQuando preencher, manda o contracheque que a gente finaliza!`,
        ])
      : "Perfeito! Vou te enviar o link do formulário em seguida. Me manda o contracheque também 👍";

    // Notifica Alex: novo lead passou a triagem
    const alexNum = process.env.ALEX_WHATSAPP_NUMBER;
    if (alexNum) {
      const padrinho = updates.PADRINHO || lead?.PADRINHO || "–";
      const padQual  = (updates.PADRINHO_QUALIFICA || lead?.PADRINHO_QUALIFICA) === "sim";
      const notifMsg = [
        "*🆕 Novo Lead — Triagem Concluída*",
        "",
        `WhatsApp: ${tel || lead?.TEL || "–"}`,
        `Padrinho: ${padrinho} ${padQual ? "✅" : "⚠️"}`,
        "CLT: Sim ✅",
        `Solicitou: R$ ${input.valor_solicitado || "–"} em ${input.prazo_solicitado || "–"}x`,
        `Tempo empresa: ${input.tempo_empresa || "–"}`,
        "",
        "Aguardando preenchimento do formulário + contracheque.",
      ].join("\n");
      await sendEvo(alexNum.replace(/\D/g, ""), notifMsg);
    }

    return { msg: "Dados salvos.", reply };
  }

  if (name === "encerrar_reprovado") {
    updates.STATUS = "REPROVADO";
    const reply = pick([
      "Entendi.. infelizmente no momento só trabalhamos com CLT.\nSe a situação mudar, é só me chamar! 🤝",
      "Ah entendo.. por enquanto é só pra quem tem carteira assinada.\nQualquer coisa é só chamar!",
      "Tudo bem.. no momento só atendemos CLT. Se mudar, pode me chamar 👍",
    ]);
    return { msg: "Lead reprovado.", reply };
  }

  return { msg: "Tool desconhecida." };
}

// ─── Handler para clientes ativos ────────────────────────────────────────────

async function handleClienteMsg(cd, msg) {
  const { cliente, proximaParcela, ultimaPaga, totalParcelas, pagas } = cd;

  const linhas = [];
  if (ultimaPaga) {
    const confirmado = ultimaPaga.EFI_STATUS === "pago" || ultimaPaga.STATUS === "pago" || ultimaPaga.STATUS === "quitacao_antecipada";
    linhas.push(`Último pagamento: parcela ${ultimaPaga.NUM_PARCELA}/${totalParcelas}, ${confirmado ? "confirmado ✅" : "pendente de confirmação"}, venc. ${ultimaPaga.DATA_VENCIMENTO}, R$ ${Number(ultimaPaga.VALOR || 0).toFixed(2)}`);
  }
  if (proximaParcela) {
    linhas.push(`Próxima parcela: ${proximaParcela.NUM_PARCELA}/${totalParcelas}, vence ${proximaParcela.DATA_VENCIMENTO}, R$ ${Number(proximaParcela.VALOR || 0).toFixed(2)}`);
    if (proximaParcela.EFI_PIX_CODE) {
      linhas.push(`Código PIX: ${proximaParcela.EFI_PIX_CODE}`);
    } else {
      linhas.push("Código PIX: não disponível ainda para esta parcela");
    }
  } else {
    linhas.push("Todas as parcelas quitadas 🎉");
  }
  linhas.push(`Parcelas pagas: ${pagas}/${totalParcelas}`);

  const system = `Você é atendente da Borges Assessoria respondendo a um cliente ativo pelo WhatsApp.
Tom: informal, direto, amigável. Máximo 4 linhas. Máximo 1 emoji.

DADOS DO CLIENTE:
Nome: ${cliente.NOME || "cliente"}
${linhas.join("\n")}

REGRAS:
- Se perguntou se o pagamento foi confirmado, se "caiu", se chegou: informar status da última parcela
- Se pediu código PIX ou boleto da próxima: fornecer o código PIX se disponível
- Se perguntou saldo ou quanto falta: informar parcelas restantes e próxima data
- Para outros assuntos: responder brevemente e dizer para falar com o Alex diretamente
- NUNCA inventar dados — use apenas as informações fornecidas acima`;

  return claudeCall([{ role: "user", content: msg }], system, HAIKU);
}

// ─── Contracheque (media via Evolution API) ───────────────────────────────────

async function handleContracheque(lead, data, tel) {
  const msgType = String(data.messageType || "");
  const isImage = msgType === "imageMessage";
  const isPDF   = msgType === "documentMessage";

  if (!isImage && !isPDF) {
    return "Por favor, envie o contracheque como foto (JPG/PNG) ou PDF.";
  }

  const base64 = await getMediaBase64(data);
  if (!base64) {
    return "Não consegui abrir o arquivo. Pode enviar novamente como foto (JPG ou PNG)?";
  }

  const mimeType = isImage
    ? (data.message?.imageMessage?.mimetype || "image/jpeg")
    : "application/pdf";

  const contentBlock = isImage
    ? { type: "image",    source: { type: "base64", media_type: mimeType, data: base64 } }
    : { type: "document", source: { type: "base64", media_type: mimeType, data: base64 } };

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

  await notificarAlex(lead, dados, tel);

  return "Recebi aqui 👍\nVou encaminhar para análise e assim que finalizar retorno pra você.";
}

// ─── Notificação Alex ─────────────────────────────────────────────────────────

async function notificarAlex(lead, ct, tel) {
  const alexNum = process.env.ALEX_WHATSAPP_NUMBER;
  if (!alexNum) return;

  const liquido  = parseFloat(ct.salario_liquido || 0);
  const valor    = parseFloat(lead.VALOR_SOLICITADO || 0);
  const prazo    = parseInt(lead.PRAZO_SOLICITADO || 0);
  const taxa     = 0.16;
  const parcela  = prazo > 0 && valor > 0
    ? ((valor * (1 + taxa * prazo)) / prazo).toFixed(2) : "–";
  const pct      = liquido > 0 && parcela !== "–"
    ? ((parseFloat(parcela) / liquido) * 100).toFixed(1) : "–";
  const ok       = parcela !== "–" && liquido > 0 && parseFloat(parcela) <= liquido * 0.35;

  const msg = [
    "*Lead Aprovado na Triagem — Borges Assessoria*",
    "",
    `Nome: ${ct.nome_funcionario || lead.NOME || "–"}`,
    `WhatsApp: ${tel || lead.TEL || "–"}`,
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

  await sendEvo(alexNum.replace(/\D/g, ""), msg);
}

// ─── Helpers Claude ───────────────────────────────────────────────────────────

async function claudeAgentCall(messages, system = AGENT_SYSTEM, attempt = 0) {
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "x-api-key":         process.env.ANTHROPIC_API_KEY,
      "anthropic-version": "2023-06-01",
      "content-type":      "application/json",
    },
    body: JSON.stringify({
      model:      HAIKU,
      max_tokens: 512,
      system,
      tools:      TOOLS,
      messages,
    }),
  });
  if (res.status === 529 && attempt < 2) {
    await new Promise(r => setTimeout(r, 1000 * (attempt + 1)));
    return claudeAgentCall(messages, system, attempt + 1);
  }
  if (!res.ok) throw new Error(`Claude ${res.status}: ${await res.text()}`);
  return res.json();
}

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

// ─── Helper GAS ──────────────────────────────────────────────────────────────

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
