import { verifyPassword, signSession, sessionCookie } from "../../_lib/auth.js";
import { verifyTurnstile } from "../../_lib/turnstile.js";

export async function onRequestPost({ request, env }) {
  const body = await request.json().catch(() => ({}));
  const username = (body.username || "").trim().toLowerCase();
  const password = body.password || "";

  const ip = request.headers.get("CF-Connecting-IP");
  const humanVerified = await verifyTurnstile(body.turnstileToken, env.TURNSTILE_SECRET, ip);
  if (!humanVerified) {
    return Response.json({ error: "Verification failed. Please try again." }, { status: 400 });
  }

  const user = await env.DB.prepare("SELECT * FROM users WHERE username = ?").bind(username).first();

  if (!user || !user.password_hash) {
    return Response.json({ error: "Incorrect username or password." }, { status: 401 });
  }

  const valid = await verifyPassword(password, user.password_hash);
  if (!valid) {
    return Response.json({ error: "Incorrect username or password." }, { status: 401 });
  }

  const token = await signSession({ uid: user.id, username: user.username, role: user.role }, env.SESSION_SECRET);

  return new Response(JSON.stringify({
    id: user.id, username: user.username, avatar: user.avatar, role: user.role
  }), {
    headers: { "Content-Type": "application/json", "Set-Cookie": sessionCookie(token) }
  });
}
