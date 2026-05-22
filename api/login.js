export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).end();

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
