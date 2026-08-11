import { getEfiToken, efiRequest } from "./efi-auth.js";

const EFI_MULTA_PCT    = process.env.EFI_MULTA_PCT    || "2.00";
const EFI_JUROS_DIARIO = process.env.EFI_JUROS_DIARIO || "0.03";

// Statuses that mean a cobv is permanently closed — cannot be reused
const EFI_TERMINAL = new Set(["CONCLUIDA", "REMOVIDA_PELO_USUARIO_RECEBEDOR", "REMOVIDA_PELO_PSP"]);

// Normal: "FOP"  + contractNum padded 16 + "P" + parcelaNum padded 6 = 26 chars
// SJ:     "FOPSJ" + contractNum padded 14 + "P" + parcelaNum padded 6 = 26 chars
function buildTxid(idContrato, numParcela, isSJ) {
  const num = parseInt(String(idContrato).replace(/\D/g, "")) || 0;
  if (isSJ) {
    return "FOPSJ" + String(num).padStart(14, "0") + "P" + String(numParcela).padStart(6, "0");
  }
  return "FOP" + String(num).padStart(16, "0") + "P" + String(numParcela).padStart(6, "0");
}

// Tenta criar ou atualizar cobv. Retorna { txid, pixCopiaECola, location } ou null se terminal.
async function upsertCobv(txid, payload, token) {
  const r = await efiRequest("PUT", `/v2/cobv/${txid}`, payload, token);
  if (r.status === 201 || r.status === 200) {
    return { txid, pixCopiaECola: r.data.pixCopiaECola || null, location: r.data.location || null };
  }
  // PUT falhou — consulta status atual da cobv
  const get = await efiRequest("GET", `/v2/cobv/${txid}`, null, token);
  if (get.status === 200) {
    if (EFI_TERMINAL.has(get.data.status)) return null; // cobv paga/removida — precisa de novo TXID
    // ATIVA ou outro estado recuperável
    return { txid, pixCopiaECola: get.data.pixCopiaECola || null, location: get.data.location || null };
  }
  return null;
}

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") return res.status(405).json({ erro: "Metodo nao permitido" });

  const { idContrato, parcelas, cliente, isSJ } = req.body;
  if (!idContrato || !parcelas?.length || !cliente) {
    return res.status(400).json({ erro: "Dados incompletos" });
  }

  try {
    const token = await getEfiToken();
    const cpf = String(cliente.cpf || "").replace(/\D/g, "");

    const results = await Promise.all(
      parcelas.map(async (p) => {
        const txidBase = buildTxid(idContrato, p.numParcela, isSJ);
        const dt = new Date(p.dataVencimento);
        const dataVencRaw = dt.toISOString().split("T")[0];
        const nowBR = new Date(Date.now() - 3 * 60 * 60 * 1000);
        const todayBR = nowBR.toISOString().slice(0, 10);
        const dataVenc = dataVencRaw < todayBR ? todayBR : dataVencRaw;

        // calendario.dataDeVencimento precisa ser hoje-ou-futuro (senão a cobv já nasceria
        // fora da janela de validade) — mas isso reseta o "relógio" que a Efí usaria pra
        // calcular multa/juros dinamicamente. Pra parcela com mais de 30 dias de atraso
        // (pela DATA_VENCIMENTO real, nunca a data de um reagendamento/acordo — reagendamento
        // é só um registro da promessa do cliente, não muda a dívida), calcula o encargo
        // acumulado até hoje e embute no valor da cobrança em vez de deixar dinâmico —
        // senão o cliente pagaria só o valor base, sem juros/multa nenhum.
        const diasAtraso = Math.round(
          (new Date(todayBR + "T00:00:00Z") - new Date(dataVencRaw + "T00:00:00Z")) / 86400000
        );
        const valorBase = parseFloat(p.valorParcela);
        let valorFinal = valorBase;
        let encargosDinamicos = !isSJ;
        if (!isSJ && diasAtraso > 30) {
          const multaValor = valorBase * (parseFloat(EFI_MULTA_PCT) / 100);
          const jurosValor = valorBase * (parseFloat(EFI_JUROS_DIARIO) / 100) * diasAtraso;
          valorFinal = valorBase + multaValor + jurosValor;
          encargosDinamicos = false; // já embutido no valor — evita cobrar 2x quando o cliente pagar
        }

        const payload = {
          calendario: { dataDeVencimento: dataVenc, validadeAposVencimento: isSJ ? 7 : 30 },
          ...(cpf.length === 11 ? { devedor: { cpf, nome: String(cliente.nome || "") } } : {}),
          valor: {
            original: valorFinal.toFixed(2),
            ...(encargosDinamicos ? {
              multa: { modalidade: 2, valorPerc: EFI_MULTA_PCT },
              juros: { modalidade: 2, valorPerc: EFI_JUROS_DIARIO },
            } : {}),
          },
          chave: process.env.EFI_PIX_KEY,
          solicitacaoPagador: isSJ
            ? `Somente Juros - Parcela ${p.numParcela} de ${p.totalParcelas} - ${idContrato}`
            : `Parcela ${p.numParcela} de ${p.totalParcelas} - ${idContrato}`,
        };

        // Tenta TXID base → R1 → R2 até encontrar um slot disponível
        let result = await upsertCobv(txidBase, payload, token);
        if (!result) result = await upsertCobv(txidBase + "R1", payload, token);
        if (!result) result = await upsertCobv(txidBase + "R2", payload, token);

        if (result) {
          return {
            numParcela: p.numParcela, idParcela: p.idParcela,
            txid: result.txid, ok: true,
            pixCopiaECola: result.pixCopiaECola,
            location: result.location, erro: null,
          };
        }

        return {
          numParcela: p.numParcela, idParcela: p.idParcela,
          txid: txidBase, ok: false,
          pixCopiaECola: null, location: null,
          erro: "cobv_concluida_sem_alternativa",
        };
      })
    );

    res.status(200).json({ ok: true, boletos: results });
  } catch (err) {
    res.status(500).json({ erro: err.message });
  }
}
