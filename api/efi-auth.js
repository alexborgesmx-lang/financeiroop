import https from "https";

const EFI_HOST = "pix.api.efipay.com.br";

export async function getEfiToken() {
  const cert = Buffer.from(process.env.EFI_CERT_P12_BASE64, "base64");
  const creds = Buffer.from(
    `${process.env.EFI_CLIENT_ID}:${process.env.EFI_CLIENT_SECRET}`
  ).toString("base64");

  return new Promise((resolve, reject) => {
    const body = JSON.stringify({ grant_type: "client_credentials" });
    const options = {
      hostname: EFI_HOST,
      path: "/oauth/token",
      method: "POST",
      pfx: cert,
      passphrase: "",
      headers: {
        Authorization: `Basic ${creds}`,
        "Content-Type": "application/json",
        "Content-Length": Buffer.byteLength(body),
      },
    };

    const req = https.request(options, (res) => {
      let data = "";
      res.on("data", (d) => (data += d));
      res.on("end", () => {
        try {
          const parsed = JSON.parse(data);
          if (parsed.access_token) resolve(parsed.access_token);
          else reject(new Error("Efi auth error: " + data));
        } catch {
          reject(new Error("Efi auth parse error: " + data));
        }
      });
    });
    req.on("error", reject);
    req.write(body);
    req.end();
  });
}

export async function efiRequest(method, path, body, token) {
  const cert = Buffer.from(process.env.EFI_CERT_P12_BASE64, "base64");
  return new Promise((resolve, reject) => {
    const bodyStr = body ? JSON.stringify(body) : null;
    const options = {
      hostname: EFI_HOST,
      path,
      method,
      pfx: cert,
      passphrase: "",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
        ...(bodyStr ? { "Content-Length": Buffer.byteLength(bodyStr) } : {}),
      },
    };

    const req = https.request(options, (res) => {
      let data = "";
      res.on("data", (d) => (data += d));
      res.on("end", () => {
        try {
          resolve({ status: res.statusCode, data: JSON.parse(data) });
        } catch {
          resolve({ status: res.statusCode, data });
        }
      });
    });
    req.on("error", reject);
    if (bodyStr) req.write(bodyStr);
    req.end();
  });
}
