import { getEfiToken, efiRequest } from "./efi-auth.js";

const EFI_MULTA_PCT    = process.env.EFI_MULTA_PCT    || "2.00";
const EFI_JUROS_DIARIO = process.env.EFI_JUROS_DIARIO || "0.03";

const EFI_TERMINAL = new Set(["CONCLUIDA", "REMOVIDA_PELO_USUARIO_RECEBEDOR", "REMOVIDA_PELO_PSP"]);

function buildTxid(idContrato, numParcela) {
  const num = parseInt(String(idContrato).replace(/\D/g, "")) || 0;
  return "FOP" + String(num).padStart(16, "0") + "P" + String(numParcela).padStart(6, "0");
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

  const secret = process.env.COBRANCA_SECRET;
  if (secret && req.headers["x-cobranca-secret"] !== secret) {
    return res.status(401).end();
  }

  const { idContrato, parcela, cliente } = req.body || {};
  if (!idContrato || !parcela?.numParcela) {
    return res.status(400).json({ erro: "Dados incompletos" });
  }

  try {
    const token   = await getEfiToken();
    const cpf     = String(cliente?.cpf || "").replace(/\D/g, "");
    const txidBase = buildTxid(idContrato, parcela.numParcela);

    const nowBR    = new Date(Date.now() - 3 * 60 * 60 * 1000);
    const todayStr = nowBR.toISOString().slice(0, 10);
    let dataVenc   = parcela.dataVencimento ? String(parcela.dataVencimento).slice(0, 10) : todayStr;
    if (dataVenc < todayStr) dataVenc = todayStr;

    const payload = {
      calendario: { dataDeVencimento: dataVenc, validadeAposVencimento: 30 },
      ...(cpf.length === 11 ? { devedor: { cpf, nome: String(cliente?.nome || "") } } : {}),
      valor: {
        original: parseFloat(parcela.valorParcela || 0).toFixed(2),
        multa:  { modalidade: 2, valorPerc: EFI_MULTA_PCT },
        juros:  { modalidade: 2, valorPerc: EFI_JUROS_DIARIO },
      },
      chave: process.env.EFI_PIX_KEY,
      solicitacaoPagador: `Parcela ${parcela.numParcela} de ${parcela.totalParcelas || "?"} - ${idContrato}`,
    };

    let result = await upsertCobv(txidBase, payload, token);
    if (!result) result = await upsertCobv(txidBase + "R1", payload, token);
    if (!result) result = await upsertCobv(txidBase + "R2", payload, token);

    if (!result) return res.status(500).json({ erro: "cobv_concluida_sem_alternativa" });

    res.status(200).json({ ok: true, pixCopiaECola: result.pixCopiaECola || null, txid: result.txid });
  } catch (err) {
    res.status(500).json({ erro: err.message });
  }
}
