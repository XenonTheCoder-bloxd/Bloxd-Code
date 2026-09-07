import { hashPassword, signSession, sessionCookie } from "../../_lib/auth.js";
import { checkRateLimit, rateLimitResponse } from "../../_lib/ratelimit.js";

export async function onRequestPost({ request, env }) {
  const ip = request.headers.get("CF-Connecting-IP") || "unknown";
  const allowed = await checkRateLimit(env.RATE_LIMIT_KV, `rl:reset-password:${ip}`, 10, 3600);
  if (!allowed) return rateLimitResponse();

  const body = await request.json().catch(() => ({}));
  const token = (body.token || "").trim();
  const newPassword = body.newPassword || "";

  if (!token) {
    return Response.json({ error: "Missing reset token." }, { status: 400 });
  }
  if (newPassword.length < 8) {
    return Response.json({ error: "Password must be at least 8 characters." }, { status: 400 });
  }

  const reset = await env.DB.prepare(
    "SELECT id, user_id, expires_at, used FROM password_resets WHERE token = ?"
  ).bind(token).first();

  if (!reset || reset.used || reset.expires_at < Date.now()) {
    return Response.json({ error: "This reset link is invalid or has expired. Please request a new one." }, { status: 400 });
  }

  const passwordHash = await hashPassword(newPassword);
  await env.DB.prepare("UPDATE users SET password_hash = ? WHERE id = ?").bind(passwordHash, reset.user_id).run();
  await env.DB.prepare("UPDATE password_resets SET used = 1 WHERE id = ?").bind(reset.id).run();

  const user = await env.DB.prepare("SELECT id, username, role, banned_at FROM users WHERE id = ?").bind(reset.user_id).first();
  if (!user || user.banned_at) {
    return Response.json({ success: true, loggedIn: false });
  }

  const sessionToken = await signSession({ uid: user.id, username: user.username, role: user.role }, env.SESSION_SECRET);

  return new Response(JSON.stringify({ success: true, loggedIn: true }), {
    headers: { "Content-Type": "application/json", "Set-Cookie": sessionCookie(sessionToken) }
  });
}
