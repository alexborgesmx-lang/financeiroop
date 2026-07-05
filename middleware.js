export const config = {
  matcher: ["/((?!api/login|api/whatsapp|api/webhook-efi|api/efi-check-payments|api/efi-pix-avulso|api/efi-setup-webhook|api/cert|c/).*)"],
};

export default async function middleware(request) {
  const url = new URL(request.url);

  // Logout — limpa cookie sem autenticação
  if (url.pathname === "/api/logout") {
    return new Response(JSON.stringify({ ok: true }), {
      status: 200,
      headers: {
        "Content-Type": "application/json",
        "Set-Cookie": "fp_session=; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=0",
      },
    });
  }

  // Skip auth in local dev if no password configured
  if (!process.env.LOGIN_PASSWORD) return;

  const cookies = request.headers.get("cookie") || "";
  const token = parseCookie(cookies, "fp_session");

  if (token && (await isValidToken(token))) return;

  // API requests → 401 JSON
  if (url.pathname.startsWith("/api/")) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { "Content-Type": "application/json" },
    });
  }

  // Everything else → login page
  return new Response(loginHTML(), {
    headers: { "Content-Type": "text/html; charset=utf-8" },
  });
}

function parseCookie(str, name) {
  const m = str.match(new RegExp(`(?:^|;\\s*)${name}=([^;]*)`));
  return m ? decodeURIComponent(m[1]) : null;
}

async function computeToken() {
  const pw = process.env.LOGIN_PASSWORD ?? "";
  const secret = process.env.LOGIN_SECRET ?? "fp_default_secret";
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw", enc.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false, ["sign"]
  );
  const sig = await crypto.subtle.sign("HMAC", key, enc.encode(pw));
  return btoa(String.fromCharCode(...new Uint8Array(sig)));
}

async function isValidToken(token) {
  try {
    return token === (await computeToken());
  } catch {
    return false;
  }
}

function loginHTML() {
  return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Borges Assessoria — Acesso</title>
<style>
  *{box-sizing:border-box;margin:0;padding:0}
  body{background:#07241B;font-family:-apple-system,BlinkMacSystemFont,'Helvetica Neue','Inter',sans-serif;display:flex;align-items:center;justify-content:center;min-height:100dvh;padding:20px;overscroll-behavior:none}
  .wrap{width:100%;max-width:380px}
  .brand{display:flex;align-items:center;gap:12px;justify-content:center;margin-bottom:36px}
  .brand-name{color:#fff;font-size:17px;font-weight:700;letter-spacing:-.02em;line-height:1.2}
  .brand-tag{font-size:10px;font-weight:500;color:#87DFB6;letter-spacing:.08em;text-transform:uppercase;margin-top:2px}
  .card{background:#0B3D2E;border:1px solid rgba(255,255,255,0.10);border-radius:20px;padding:36px 32px;box-shadow:0 24px 80px rgba(0,0,0,0.4)}
  h1{font-size:22px;font-weight:700;color:#fff;letter-spacing:-.02em;margin-bottom:6px}
  p{font-size:13px;color:#87DFB6;margin-bottom:28px;line-height:1.5}
  label{display:block;font-size:11px;font-weight:600;text-transform:uppercase;letter-spacing:.08em;color:rgba(255,255,255,0.45);margin-bottom:6px}
  input{width:100%;padding:13px 14px;border:1px solid rgba(255,255,255,0.12);border-radius:10px;font-size:16px;color:#fff;background:rgba(255,255,255,0.06);outline:none;transition:border-color .15s,box-shadow .15s;-webkit-appearance:none}
  input::placeholder{color:rgba(255,255,255,0.25)}
  input:focus{border-color:#1FB877;box-shadow:0 0 0 3px rgba(31,184,119,0.18)}
  button{width:100%;margin-top:20px;padding:14px;border-radius:10px;border:none;background:#A8E03F;color:#1B3305;font-size:14px;font-weight:800;cursor:pointer;transition:opacity .15s,transform .1s;letter-spacing:.01em}
  button:hover{opacity:.9}
  button:active{transform:scale(.98)}
  button:disabled{opacity:.45;cursor:default}
  .err{margin-top:12px;padding:10px 13px;border-radius:8px;background:rgba(214,69,69,0.15);color:#f87171;font-size:12px;font-weight:600;text-align:center;display:none;border:1px solid rgba(214,69,69,0.3)}
  .footer{text-align:center;margin-top:20px;font-size:11px;color:rgba(255,255,255,0.25);letter-spacing:.04em}
  @media(max-width:400px){.card{padding:28px 22px;border-radius:16px}}
</style>
</head>
<body>
<div class="wrap">
  <div class="brand">
    <svg width="36" height="36" viewBox="0 0 68 68" aria-hidden="true">
      <rect x="3" y="3" width="40" height="40" rx="9" fill="#1FB877"/>
      <rect x="25" y="25" width="40" height="40" rx="9" fill="#fff"/>
      <path d="M25 25 H43 V43 H25 Z" fill="#0E5C44"/>
    </svg>
    <div>
      <div class="brand-name">Borges Assessoria</div>
      <div class="brand-tag">Crédito Privado</div>
    </div>
  </div>
  <div class="card">
    <h1>Acesse o painel</h1>
    <p>Crédito operado com precisão. Acesso restrito.</p>
    <form id="f">
      <label>Senha de acesso</label>
      <input type="password" id="pw" autofocus autocomplete="current-password" placeholder="••••••••">
      <button type="submit" id="btn">Acessar painel</button>
      <div class="err" id="err">Senha incorreta. Tente novamente.</div>
    </form>
  </div>
  <div class="footer">ACESSO SEGURO · 2026</div>
</div>
<script>
document.getElementById('f').addEventListener('submit',async e=>{
  e.preventDefault();
  const btn=document.getElementById('btn');
  const err=document.getElementById('err');
  err.style.display='none';
  btn.disabled=true;
  btn.textContent='Verificando...';
  try{
    const r=await fetch('/api/login',{
      method:'POST',
      headers:{'Content-Type':'application/json'},
      body:JSON.stringify({password:document.getElementById('pw').value})
    });
    if(r.ok){window.location.replace('/');}
    else{err.style.display='block';btn.disabled=false;btn.textContent='Acessar painel';}
  }catch{
    err.style.display='block';btn.disabled=false;btn.textContent='Acessar painel';
  }
});
</script>
</body>
</html>`;
}
