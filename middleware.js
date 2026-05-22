export const config = {
  matcher: ["/((?!api/login|api/logout|api/whatsapp).*)"],
};

export default async function middleware(request) {
  const url = new URL(request.url);

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
<title>FinanceiroOp — Acesso</title>
<style>
  *{box-sizing:border-box;margin:0;padding:0}
  body{background:#111113;font-family:-apple-system,BlinkMacSystemFont,'Inter',sans-serif;display:flex;align-items:center;justify-content:center;min-height:100vh;padding:16px}
  .card{background:#1c1c1f;border:1px solid #2e2e33;border-radius:20px;padding:40px 36px;width:100%;max-width:380px;box-shadow:0 24px 80px rgba(0,0,0,0.5)}
  .logo{width:52px;height:52px;background:#ff4f00;border-radius:14px;display:flex;align-items:center;justify-content:center;margin:0 auto 20px;font-size:24px}
  h1{text-align:center;font-size:22px;font-weight:800;color:#f0ece8;margin-bottom:6px}
  p{text-align:center;font-size:13px;color:#7a7570;margin-bottom:32px}
  label{display:block;font-size:11px;font-weight:600;text-transform:uppercase;letter-spacing:.06em;color:#7a7570;margin-bottom:5px}
  input{width:100%;padding:11px 13px;border:1px solid #2e2e33;border-radius:9px;font-size:14px;color:#f0ece8;background:#111113;outline:none;transition:border-color .15s,box-shadow .15s}
  input:focus{border-color:#ff4f00;box-shadow:0 0 0 3px #ff4f0022}
  button{width:100%;margin-top:16px;padding:13px;border-radius:10px;border:none;background:#ff4f00;color:#fff;font-size:14px;font-weight:800;cursor:pointer;transition:opacity .15s;letter-spacing:.01em}
  button:hover{opacity:.88}
  button:disabled{opacity:.45;cursor:default}
  .err{margin-top:12px;padding:10px 13px;border-radius:8px;background:#f8717120;color:#f87171;font-size:12px;font-weight:600;text-align:center;display:none}
</style>
</head>
<body>
<div class="card">
  <div class="logo">💰</div>
  <h1>FinanceiroOp</h1>
  <p>Acesso restrito. Digite a senha para continuar.</p>
  <form id="f">
    <label>Senha</label>
    <input type="password" id="pw" autofocus autocomplete="current-password" placeholder="••••••••">
    <button type="submit" id="btn">Entrar</button>
    <div class="err" id="err">Senha incorreta. Tente novamente.</div>
  </form>
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
    else{err.style.display='block';btn.disabled=false;btn.textContent='Entrar';}
  }catch{
    err.style.display='block';btn.disabled=false;btn.textContent='Entrar';
  }
});
</script>
</body>
</html>`;
}
