export default async function handler(req, res) {
  const { t, cnpj } = req.query;

  // ── FERIADOS ─────────────────────────────────────────────────────────────
  if (t === "feriados") {
    const ano = new Date().getFullYear();
    const datas = new Set();
    for (const a of [ano, ano + 1]) {
      try {
        const r = await fetch(`https://date.nager.at/api/v3/PublicHolidays/${a}/BR`);
        if (r.ok) { const j = await r.json(); j.forEach(f => datas.add(f.date)); }
      } catch (_) {}
    }
    res.setHeader("Cache-Control", "public, max-age=86400");
    return res.json({ datas: [...datas] });
  }

  // ── CNPJ ─────────────────────────────────────────────────────────────────
  if (t === "cnpj") {
    const d = (cnpj || "").replace(/\D/g, "");
    if (d.length !== 14) return res.status(400).json({ error: "cnpj_invalido" });

    // BrasilAPI
    try {
      const r = await fetch(`https://brasilapi.com.br/api/cnpj/v1/${d}`);
      if (r.ok) {
        const j = await r.json();
        return res.json({
          razao_social:  j.razao_social || "",
          nome_fantasia: j.nome_fantasia || "",
          situacao:      (j.situacao_cadastral || "").toUpperCase(),
          data_abertura: j.data_inicio_atividade || "",
          porte:         j.porte || "",
        });
      }
      if (r.status === 404 || r.status === 400) return res.status(404).json({ error: "not_found" });
    } catch (_) {}

    // Fallback: ReceitaWS
    try {
      const r2 = await fetch(`https://www.receitaws.com.br/v1/cnpj/${d}`);
      if (r2.ok) {
        const j2 = await r2.json();
        if (j2.status !== "ERROR") {
          return res.json({
            razao_social:  j2.nome || "",
            nome_fantasia: j2.fantasia || "",
            situacao:      (j2.situacao || "").toUpperCase(),
            data_abertura: j2.abertura || "",
            porte:         j2.porte || "",
          });
        }
      }
      if (r2.status === 404) return res.status(404).json({ error: "not_found" });
    } catch (_) {}

    return res.status(503).json({ error: "service_unavailable" });
  }

  return res.status(400).json({ error: "param_t_required: feriados | cnpj" });
}
