import { getEfiToken, efiRequest } from "./efi-auth.js";

// Penalidades cobradas pela Efí Bank após o vencimento.
// Configurar via Vercel env vars para mudar sem deploy.
// Sincronizar com aba CONFIGURACOES quando ela for adicionada ao doGet.
const EFI_MULTA_PCT    = process.env.EFI_MULTA_PCT    || "10.00"; // % multa por atraso
const EFI_JUROS_DIARIO = process.env.EFI_JUROS_DIARIO || "0.03";  // % juros por dia pós-vencimento

// txid format: "FOP" + contractNum padded 16 + "P" + parcelaNum padded 6 = 26 chars
function buildTxid(idContrato, numParcela) {
  const num = parseInt(String(idContrato).replace(/\D/g, "")) || 0;
  return "FOP" + String(num).padStart(16, "0") + "P" + String(numParcela).padStart(6, "0");
}

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") return res.status(405).json({ erro: "Metodo nao permitido" });

  const { idContrato, parcelas, cliente } = req.body;
  if (!idContrato || !parcelas?.length || !cliente) {
    return res.status(400).json({ erro: "Dados incompletos" });
  }

  try {
    const token = await getEfiToken();
    const cpf = String(cliente.cpf || "").replace(/\D/g, "");

    const results = await Promise.all(
      parcelas.map(async (p) => {
        const txid = buildTxid(idContrato, p.numParcela);
        const dt = new Date(p.dataVencimento);
        const dataVenc = dt.toISOString().split("T")[0];

        const payload = {
          calendario: { dataDeVencimento: dataVenc, validadeAposVencimento: 30 },
          ...(cpf.length === 11 ? { devedor: { cpf, nome: String(cliente.nome || "") } } : {}),
          valor: {
            original: parseFloat(p.valorParcela).toFixed(2),
            multa: { modalidade: 2, valorPerc: EFI_MULTA_PCT },
            juros: { modalidade: 2, valorPerc: EFI_JUROS_DIARIO },
          },
          chave: process.env.EFI_PIX_KEY,
          solicitacaoPagador: `Parcela ${p.numParcela} de ${p.totalParcelas} - ${idContrato}`,
        };

        const r = await efiRequest("PUT", `/v2/cobv/${txid}`, payload, token);
        const ok = r.status === 201 || r.status === 200;

        return {
          numParcela: p.numParcela,
          idParcela: p.idParcela,
          txid,
          ok,
          pixCopiaECola: r.data.pixCopiaECola || null,
          location: r.data.location || null,
          erro: !ok ? JSON.stringify(r.data) : null,
        };
      })
    );

    res.status(200).json({ ok: true, boletos: results });
  } catch (err) {
    res.status(500).json({ erro: err.message });
  }
}
