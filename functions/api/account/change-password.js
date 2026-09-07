import { verifySession, readCookie, hashPassword, verifyPassword } from "../../_lib/auth.js";
import { checkRateLimit, rateLimitResponse } from "../../_lib/ratelimit.js";

export async function onRequestPost({ request, env }) {
  const session = await verifySession(readCookie(request, "session"), env.SESSION_SECRET);
  if (!session) {
    return Response.json({ error: "You must be logged in." }, { status: 401 });
  }

  const allowed = await checkRateLimit(env.RATE_LIMIT_KV, `rl:change-password:${session.uid}`, 10, 3600);
  if (!allowed) return rateLimitResponse();

  const body = await request.json().catch(() => ({}));
  const currentPassword = body.currentPassword || "";
  const newPassword = body.newPassword || "";

  if (newPassword.length < 8) {
    return Response.json({ error: "New password must be at least 8 characters." }, { status: 400 });
  }

  const user = await env.DB.prepare("SELECT password_hash FROM users WHERE id = ?").bind(session.uid).first();
  if (!user) {
    return Response.json({ error: "User not found." }, { status: 404 });
  }

  if (user.password_hash) {
    if (!currentPassword) {
      return Response.json({ error: "Enter your current password." }, { status: 400 });
    }
    const valid = await verifyPassword(currentPassword, user.password_hash);
    if (!valid) {
      return Response.json({ error: "Current password is incorrect." }, { status: 401 });
    }
  }

  const newHash = await hashPassword(newPassword);
  await env.DB.prepare("UPDATE users SET password_hash = ? WHERE id = ?").bind(newHash, session.uid).run();

  return Response.json({ success: true });
}
