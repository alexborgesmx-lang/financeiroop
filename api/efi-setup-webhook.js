import { getEfiToken, efiRequest } from "./efi-auth.js";

// Registra/renova a URL do webhook PIX no Efí Bank para a chave configurada.
// Rota excluída do middleware de sessão — autenticada via x-cobranca-secret.
// Chamada automática: rotinaDiaria GAS toda segunda-feira.
// Chamada manual: menu GAS → "PIX: Re-registrar Webhook Efí"
export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ erro: "Use POST" });

  const secret = process.env.COBRANCA_SECRET;
  if (secret && req.headers["x-cobranca-secret"] !== secret) {
    return res.status(401).json({ erro: "Unauthorized" });
  }

  const sk = process.env.EFI_WEBHOOK_SECRET;
  const webhookUrl = `https://financeiroop.vercel.app/api/webhook-efi${sk ? `?sk=${encodeURIComponent(sk)}` : ""}`;
  const chave = process.env.EFI_PIX_KEY;

  if (!chave) return res.status(500).json({ erro: "EFI_PIX_KEY nao configurada" });

  try {
    const token = await getEfiToken();
    const r = await efiRequest(
      "PUT",
      `/v2/webhook/${encodeURIComponent(chave)}`,
      { webhookUrl },
      token,
      { "x-skip-mtls-checking": "true" }
    );

    if (r.status === 200 || r.status === 201) {
      return res.status(200).json({ ok: true, webhookUrl, resposta: r.data });
    }
    return res.status(400).json({ ok: false, status: r.status, resposta: r.data });
  } catch (err) {
    return res.status(500).json({ erro: err.message });
  }
}
