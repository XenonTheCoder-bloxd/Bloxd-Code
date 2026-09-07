export async function sendEmail(env, { to, subject, html }) {
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${env.RESEND_API_KEY}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      from: "Bloxd Code <no-reply@bloxdcode.com>",
      to: [to],
      subject,
      html
    })
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`Email send failed (${res.status}): ${text}`);
  }
  return true;
}
