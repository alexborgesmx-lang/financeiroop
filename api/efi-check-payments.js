import { getEfiToken, efiRequest } from "./efi-auth.js";

// Consulta o status de cobranças cobv no Efí Bank.
// Chamado pela rotina diária do GAS — não requer sessão de usuário, mas requer COBRANCA_SECRET.
export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ erro: "Use POST" });
  const secret = process.env.COBRANCA_SECRET;
  if (secret && req.headers["x-cobranca-secret"] !== secret) {
    return res.status(401).json({ erro: "Unauthorized" });
  }

  const { txids } = req.body;
  if (!Array.isArray(txids) || !txids.length) {
    return res.status(400).json({ erro: "txids obrigatorio (array)" });
  }

  try {
    const token = await getEfiToken();

    const cobv = await Promise.all(
      txids.map(async ({ txid, idParcela }) => {
        try {
          const r = await efiRequest("GET", `/v2/cobv/${txid}`, null, token);
          const status = r.data?.status || "DESCONHECIDO";
          const pix = r.data?.pix?.[0] || null;
          return {
            txid,
            idParcela,
            status,
            concluida: status === "CONCLUIDA",
            valor: pix ? parseFloat(pix.valor) : null,
            horario: pix ? pix.horario : null,
          };
        } catch (e) {
          return { txid, idParcela, status: "ERRO", concluida: false, erro: e.message };
        }
      })
    );

    res.status(200).json({ ok: true, cobv });
  } catch (err) {
    res.status(500).json({ erro: err.message });
  }
}
