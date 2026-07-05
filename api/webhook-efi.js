const APP_SCRIPT_URL =
  "https://script.google.com/macros/s/AKfycbynQKpafDbaBTT-jqs4nCSzbbx8A72MAqDyGxwy86lIt0ykZxeFT8IdlO7zjj0rJEHy7Q/exec";

// txid formats:
//   Quitação: "FOQT" + contractNum padded 16 + "Q" + "00001" = 26 chars (may have R1/R2 suffix)
//   SJ:       "FOPSJ" + contractNum padded 14 + "P" + parcelaNum padded 6 = 26 chars
//   Normal:   "FOP"  + contractNum padded 16 + "P" + parcelaNum padded 6 = 26 chars
function parseTxid(txid) {
  if (!txid) return null;
  // Quitação — FOQT prefix (may have R1/R2 suffix stripped out by Efí)
  if (txid.startsWith("FOQT")) {
    const base = txid.replace(/R[12]$/, "");
    const contractNum = parseInt(base.slice(4, 20));
    if (!isNaN(contractNum)) return { contractNum, isQuitacao: true };
    return null;
  }
  if (txid.startsWith("FOPSJ") && txid.length === 26) {
    const contractNum = parseInt(txid.slice(5, 19));
    const parcelaNum = parseInt(txid.slice(20, 26));
    if (isNaN(contractNum) || isNaN(parcelaNum)) return null;
    return { contractNum, parcelaNum, isSJ: true };
  }
  if (!txid.startsWith("FOP") || txid.length < 26) return null;
  const contractNum = parseInt(txid.slice(3, 19));
  const parcelaNum = parseInt(txid.slice(20, 26));
  if (isNaN(contractNum) || isNaN(parcelaNum)) return null;
  return { contractNum, parcelaNum, isSJ: false };
}

export default async function handler(req, res) {
  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") return res.status(405).end();

  // Efí Bank appends "/pix" literally to the registered URL, so ?sk=SECRET becomes ?sk=SECRET/pix
  const expectedSecret = process.env.EFI_WEBHOOK_SECRET;
  const skRecebido = (req.query.sk || "").replace(/\/pix$/, "");
  if (expectedSecret && skRecebido !== expectedSecret) {
    console.log("webhook-efi: sk inválido:", req.query.sk || "(ausente)");
    return res.status(401).json({ error: "Unauthorized" });
  }

  try {
    const pixList = req.body?.pix || [];
    const erros = [];

    for (const pix of pixList) {
      const { txid, valor, horario } = pix;
      const parsed = parseTxid(txid);
      if (!parsed) {
        console.log("webhook-efi: txid ignorado (nao e FinanceiroOp):", txid);
        continue;
      }

      try {
        let gasBody;
        if (parsed.isQuitacao) {
          gasBody = {
            action: "pagamentoQuitacaoWebhook",
            txid: txid,
            valor: parseFloat(valor),
            data: horario,
          };
        } else {
          gasBody = {
            action: "pagamentoAutomatico",
            contractNum: parsed.contractNum,
            numParcela: parsed.parcelaNum,
            valor: parseFloat(valor),
            data: horario,
            txid: txid,
            isSJ: parsed.isSJ || false,
          };
        }
        const r = await fetch(APP_SCRIPT_URL, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(gasBody),
          redirect: "follow",
        });
        const text = await r.text();
        console.log("webhook-efi:", gasBody.action, txid, text);
      } catch (e) {
        console.error("webhook-efi: erro ao registrar", txid, e.message);
        erros.push({ txid, erro: e.message });
      }
    }

    res.status(200).json({ ok: true, erros });
  } catch (err) {
    console.error("webhook-efi: erro geral", err);
    res.status(500).json({ erro: err.message });
  }
}
