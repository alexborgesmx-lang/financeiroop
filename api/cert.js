const GAS_URL =
  "https://script.google.com/macros/s/AKfycbynQKpafDbaBTT-jqs4nCSzbbx8A72MAqDyGxwy86lIt0ykZxeFT8IdlO7zjj0rJEHy7Q/exec";

function fmtBRL(v) {
  return "R$ " + parseFloat(v || 0).toFixed(2).replace(".", ",").replace(/\B(?=(\d{3})+(?!\d))/g, ".");
}

function pageHTML(body) {
  return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Certificado de Quitação — Borges Assessoria</title>
<style>
  *{box-sizing:border-box;margin:0;padding:0}
  body{background:#f4f6f3;font-family:-apple-system,BlinkMacSystemFont,'Helvetica Neue','Inter',sans-serif;min-height:100dvh;padding:24px 16px;color:#1a2e1a}
  .wrap{max-width:640px;margin:0 auto}
  .header{background:#07241B;border-radius:16px 16px 0 0;padding:28px 32px 24px;display:flex;align-items:center;gap:16px}
  .logo-icon{flex-shrink:0}
  .brand-name{color:#fff;font-size:18px;font-weight:700;letter-spacing:-.02em}
  .brand-tag{font-size:11px;color:#87DFB6;letter-spacing:.08em;text-transform:uppercase;margin-top:3px}
  .card{background:#fff;border:1px solid #e0e8df;border-top:none}
  .title-bar{background:#A8E03F;padding:20px 32px;text-align:center}
  .title-bar h1{font-size:20px;font-weight:800;color:#1B3305;letter-spacing:-.01em;text-transform:uppercase}
  .title-bar p{font-size:12px;color:#3a5c1a;margin-top:4px;font-weight:500}
  .body{padding:32px}
  .seal{text-align:center;margin-bottom:28px}
  .seal-circle{display:inline-flex;align-items:center;justify-content:center;width:72px;height:72px;border-radius:50%;background:#07241B;color:#A8E03F;font-size:32px;font-weight:800}
  table.info{width:100%;border-collapse:collapse;margin-bottom:24px}
  table.info tr{border-bottom:1px solid #f0f4ef}
  table.info tr:last-child{border-bottom:none}
  table.info td{padding:12px 0;font-size:14px;line-height:1.4}
  table.info td:first-child{color:#5a7a5a;font-weight:600;width:45%}
  table.info td:last-child{color:#1a2e1a;font-weight:600;text-align:right}
  .code-box{background:#f4f6f3;border:1px dashed #b0c8b0;border-radius:10px;padding:16px 20px;text-align:center;margin-bottom:24px}
  .code-label{font-size:11px;font-weight:600;text-transform:uppercase;letter-spacing:.08em;color:#5a7a5a;margin-bottom:6px}
  .code-value{font-size:15px;font-family:'Courier New',monospace;font-weight:700;color:#07241B;letter-spacing:.06em;word-break:break-all}
  .qr-wrap{text-align:center;margin-bottom:24px}
  .qr-wrap img{border-radius:8px;border:1px solid #e0e8df}
  .qr-label{font-size:11px;color:#8aaa8a;margin-top:6px}
  .btn{display:block;width:100%;padding:15px;background:#07241B;color:#A8E03F;font-size:15px;font-weight:700;text-align:center;border:none;border-radius:10px;cursor:pointer;letter-spacing:.01em;margin-bottom:12px}
  .btn:hover{opacity:.9}
  .footer{background:#f4f6f3;border:1px solid #e0e8df;border-top:none;border-radius:0 0 16px 16px;padding:20px 32px;text-align:center}
  .footer p{font-size:11px;color:#8aaa8a;line-height:1.6}
  .footer strong{color:#5a7a5a}
  .error-wrap{background:#fff;border-radius:16px;padding:48px 32px;text-align:center;border:1px solid #e0e8df}
  .error-icon{font-size:48px;margin-bottom:16px}
  .error-wrap h2{font-size:20px;font-weight:700;color:#1a2e1a;margin-bottom:8px}
  .error-wrap p{font-size:14px;color:#5a7a5a;line-height:1.6}
  @media print{
    body{background:#fff;padding:0}
    .wrap{max-width:100%}
    .header{border-radius:0;-webkit-print-color-adjust:exact;print-color-adjust:exact}
    .title-bar{-webkit-print-color-adjust:exact;print-color-adjust:exact}
    .btn{display:none}
    .footer{border-radius:0}
  }
  @media(max-width:480px){
    .header{padding:20px 20px 18px}
    .title-bar{padding:16px 20px}
    .body{padding:24px 20px}
    .footer{padding:16px 20px}
    table.info td{font-size:13px}
  }
</style>
</head>
<body>
<div class="wrap">
  <div class="header">
    <svg class="logo-icon" width="44" height="44" viewBox="0 0 68 68" aria-hidden="true">
      <rect x="3" y="3" width="40" height="40" rx="9" fill="#1FB877"/>
      <rect x="25" y="25" width="40" height="40" rx="9" fill="#fff"/>
      <path d="M25 25 H43 V43 H25 Z" fill="#0E5C44"/>
    </svg>
    <div>
      <div class="brand-name">Borges Assessoria</div>
      <div class="brand-tag">Crédito Privado</div>
    </div>
  </div>
  ${body}
  <div class="footer">
    <p><strong>Documento autêntico.</strong> Validado eletronicamente pela Borges Assessoria.<br>
    Este certificado comprova a liquidação total do contrato indicado acima.<br>
    Em caso de dúvidas, entre em contato pelo WhatsApp.</p>
  </div>
</div>
<script>
function imprimir(){window.print();}
</script>
</body>
</html>`;
}

function certBody(d) {
  const pageUrl = `https://financeiroop.vercel.app/c/${encodeURIComponent(d.codigoValidacao)}`;
  const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=${encodeURIComponent(pageUrl)}`;
  return `
  <div class="card">
    <div class="title-bar">
      <h1>Certificado de Quitação</h1>
      <p>Comprovante oficial de liquidação de contrato</p>
    </div>
    <div class="body">
      <div class="seal"><div class="seal-circle">✓</div></div>
      <table class="info">
        <tr><td>Titular</td><td>${escHtml(d.nomeCliente)}</td></tr>
        <tr><td>CPF</td><td>${escHtml(d.cpfMascarado)}</td></tr>
        <tr><td>Contrato</td><td>${escHtml(d.idContrato)}</td></tr>
        <tr><td>Valor total quitado</td><td>${fmtBRL(d.valorTotalPago)}</td></tr>
        <tr><td>Data de quitação</td><td>${escHtml(d.dataQuitacao)}</td></tr>
        <tr><td>Situação</td><td style="color:#1a7a3a;font-weight:800">QUITADO</td></tr>
      </table>
      <div class="code-box">
        <div class="code-label">Código de validação</div>
        <div class="code-value">${escHtml(d.codigoValidacao)}</div>
      </div>
      <div class="qr-wrap">
        <img src="${qrUrl}" width="120" height="120" alt="QR Code de validação">
        <div class="qr-label">Aponte a câmera para validar este certificado</div>
      </div>
      <button class="btn" onclick="imprimir()">Imprimir / Salvar PDF</button>
    </div>
  </div>`;
}

function errorBody(msg) {
  return `
  <div class="card" style="border-radius:0 0 16px 16px">
    <div class="body">
      <div class="error-wrap">
        <div class="error-icon">🔍</div>
        <h2>Certificado não encontrado</h2>
        <p>${escHtml(msg || "O código informado não corresponde a nenhum certificado válido.")}<br><br>
        Verifique o link enviado por WhatsApp ou entre em contato com a Borges Assessoria.</p>
      </div>
    </div>
  </div>`;
}

function escHtml(str) {
  return String(str || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export default async function handler(req, res) {
  const codigo = (req.query.c || "").trim();

  if (!codigo) {
    res.setHeader("Content-Type", "text/html; charset=utf-8");
    return res.status(400).send(pageHTML(errorBody("Nenhum código de certificado fornecido.")));
  }

  let dados;
  try {
    const resp = await fetch(GAS_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "buscarCertificado", codigo }),
    });
    dados = await resp.json();
  } catch (e) {
    res.setHeader("Content-Type", "text/html; charset=utf-8");
    return res.status(502).send(pageHTML(errorBody("Erro ao consultar o certificado. Tente novamente em alguns instantes.")));
  }

  res.setHeader("Content-Type", "text/html; charset=utf-8");
  res.setHeader("Cache-Control", "no-store");

  if (!dados || !dados.ok) {
    return res.status(404).send(pageHTML(errorBody(null)));
  }

  return res.status(200).send(pageHTML(certBody(dados)));
}
