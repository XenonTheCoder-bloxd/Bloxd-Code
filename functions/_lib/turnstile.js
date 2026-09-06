export async function verifyTurnstile(token, secret, ip) {
  if (!token || !secret) return false;

  const body = new URLSearchParams();
  body.append("secret", secret);
  body.append("response", token);
  if (ip) body.append("remoteip", ip);

  const res = await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", {
    method: "POST",
    body
  });
  const data = await res.json().catch(() => ({ success: false }));
  return data.success === true;
}
