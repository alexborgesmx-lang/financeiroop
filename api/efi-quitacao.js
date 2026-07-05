import { getEfiToken, efiRequest } from "./efi-auth.js";

const APP_SCRIPT_URL =
  "https://script.google.com/macros/s/AKfycbynQKpafDbaBTT-jqs4nCSzbbx8A72MAqDyGxwy86lIt0ykZxeFT8IdlO7zjj0rJEHy7Q/exec";

const EFI_TERMINAL = new Set(["CONCLUIDA", "REMOVIDA_PELO_USUARIO_RECEBEDOR", "REMOVIDA_PELO_PSP"]);

function buildTxidQuitacao(idContrato) {
  const num = parseInt(String(idContrato).replace(/\D/g, "")) || 0;
  return "FOQT" + String(num).padStart(16, "0") + "Q" + "00001";
}

async function upsertCobv(txid, payload, token) {
  const r = await efiRequest("PUT", `/v2/cobv/${txid}`, payload, token);
  if (r.status === 201 || r.status === 200) {
    return { txid, pixCopiaECola: r.data.pixCopiaECola || null };
  }
  const get = await efiRequest("GET", `/v2/cobv/${txid}`, null, token);
  if (get.status === 200) {
    if (EFI_TERMINAL.has(get.data.status)) return null;
    return { txid, pixCopiaECola: get.data.pixCopiaECola || null };
  }
  return null;
}

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).end();

  const { idContrato, idQuitacao, txidProposta, valorFinal, cliente } = req.body || {};
  if (!idContrato || !valorFinal) {
    return res.status(400).json({ erro: "Dados incompletos: idContrato e valorFinal obrigatorios" });
  }

  try {
    const token = await getEfiToken();
    const cpf   = String(cliente?.cpf || "").replace(/\D/g, "");
    const txid  = txidProposta || buildTxidQuitacao(idContrato);

    const nowBR    = new Date(Date.now() - 3 * 60 * 60 * 1000);
    const todayStr = nowBR.toISOString().slice(0, 10);

    // Quitação: prazo de 48h, SEM multa/juros (é uma oferta especial, o desconto já está no valor)
    const payload = {
      calendario: { dataDeVencimento: todayStr, validadeAposVencimento: 2 },
      ...(cpf.length === 11 ? { devedor: { cpf, nome: String(cliente?.nome || "") } } : {}),
      valor: {
        original: parseFloat(valorFinal).toFixed(2),
      },
      chave: process.env.EFI_PIX_KEY,
      solicitacaoPagador: `Quitacao antecipada - ${idContrato}`,
    };

    let result = await upsertCobv(txid, payload, token);
    if (!result) result = await upsertCobv(txid + "R1", payload, token);
    if (!result) result = await upsertCobv(txid + "R2", payload, token);

    if (!result) return res.status(500).json({ erro: "cobv_sem_alternativa" });

    // Salvar o código PIX na QUITACOES via GAS
    try {
      await fetch(APP_SCRIPT_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "salvarPixQuitacao",
          dados: { txid: result.txid, idQuitacao, pixCopiaECola: result.pixCopiaECola },
        }),
        redirect: "follow",
      });
    } catch (eSalvar) {
      console.error("efi-quitacao: erro ao salvar pixCode no GAS:", eSalvar.message);
    }

    res.status(200).json({ ok: true, pixCopiaECola: result.pixCopiaECola || null, txid: result.txid });
  } catch (err) {
    console.error("efi-quitacao:", err.message);
    res.status(500).json({ erro: err.message });
  }
}
