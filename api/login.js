// Rate limiting: 5 tentativas por IP a cada 15 minutos
const loginAttempts = new Map();
const RATE_LIMIT_MAX = 5;
const RATE_LIMIT_WINDOW_MS = 15 * 60 * 1000;

function checkRateLimit(ip) {
  const now = Date.now();
  const entry = loginAttempts.get(ip);
  if (!entry || now > entry.resetAt) {
    loginAttempts.set(ip, { count: 1, resetAt: now + RATE_LIMIT_WINDOW_MS });
    return true;
  }
  if (entry.count >= RATE_LIMIT_MAX) return false;
  entry.count++;
  return true;
}

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).end();

  const ip = req.headers["x-forwarded-for"]?.split(",")[0].trim() || req.socket?.remoteAddress || "unknown";
  if (!checkRateLimit(ip)) {
    return res.status(429).json({ error: "Muitas tentativas. Tente novamente em 15 minutos." });
  }

  const { password } = req.body || {};
  const correct = process.env.LOGIN_PASSWORD;

  if (!password || !correct || password !== correct) {
    return res.status(401).json({ error: "Senha incorreta" });
  }

  const token = await computeToken(correct);
  const maxAge = 30 * 24 * 60 * 60; // 30 dias

  res.setHeader(
    "Set-Cookie",
    `fp_session=${token}; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=${maxAge}`
  );
  return res.status(200).json({ ok: true });
}

async function computeToken(pw) {
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
