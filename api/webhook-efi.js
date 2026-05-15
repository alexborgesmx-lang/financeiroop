const APP_SCRIPT_URL =
  "https://script.google.com/macros/s/AKfycbynQKpafDbaBTT-jqs4nCSzbbx8A72MAqDyGxwy86lIt0ykZxeFT8IdlO7zjj0rJEHy7Q/exec";

// txid format: "FOP" + contractNum padded 16 + "P" + parcelaNum padded 6 = 26 chars
function parseTxid(txid) {
  if (!txid || !txid.startsWith("FOP") || txid.length < 26) return null;
  const contractNum = parseInt(txid.slice(3, 19));
  const parcelaNum = parseInt(txid.slice(20, 26));
  if (isNaN(contractNum) || isNaN(parcelaNum)) return null;
  return { contractNum, parcelaNum };
}

export default async function handler(req, res) {
  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") return res.status(405).end();

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
        const r = await fetch(APP_SCRIPT_URL, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            action: "pagamentoAutomatico",
            contractNum: parsed.contractNum,
            numParcela: parsed.parcelaNum,
            valor: parseFloat(valor),
            data: horario,
          }),
          redirect: "follow",
        });
        const text = await r.text();
        console.log("webhook-efi: pagamentoAutomatico", txid, text);
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
