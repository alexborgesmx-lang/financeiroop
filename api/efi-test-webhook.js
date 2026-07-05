import { getEfiToken, efiRequest } from "./efi-auth.js";

// Gera um cobv de R$0,01 com txid de teste para validar o fluxo do webhook.
// Chamar uma vez: POST /api/efi-test-webhook (requer sessão autenticada).
export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ erro: "Use POST" });

  const txid = "testewebhook00" + Date.now().toString(); // 27 chars alfanumérico lowercase

  try {
    const token = await getEfiToken();

    const nowBR = new Date(Date.now() - 3 * 60 * 60 * 1000);
    const hoje  = nowBR.toISOString().slice(0, 10);

    const r = await efiRequest("PUT", `/v2/cobv/${txid}`, {
      calendario: { dataDeVencimento: hoje, validadeAposVencimento: 1 },
      devedor: { cpf: "00000000191", nome: "Teste Webhook" },
      valor: { original: "0.01" },
      chave: process.env.EFI_PIX_KEY,
      solicitacaoPagador: "Teste webhook FinanceiroOp",
    }, token);

    if (r.status !== 200 && r.status !== 201) {
      return res.status(400).json({ ok: false, status: r.status, resposta: r.data });
    }

    res.status(200).json({
      ok: true,
      txid,
      pixCopiaECola: r.data.pixCopiaECola || null,
      aviso: "Pague R$0,01. O webhook vai receber mas nao vai registrar pagamento (txid nao e formato FOP). Cheque logs do Vercel para confirmar recepcao.",
    });
  } catch (err) {
    res.status(500).json({ erro: err.message });
  }
}
