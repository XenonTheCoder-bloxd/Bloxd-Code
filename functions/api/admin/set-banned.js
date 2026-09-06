import { verifySession, readCookie } from "../../_lib/auth.js";

export async function onRequestPost({ request, env }) {
  const session = await verifySession(readCookie(request, "session"), env.SESSION_SECRET);
  if (!session || session.role !== "admin") {
    return Response.json({ error: "Not allowed." }, { status: 403 });
  }

const { username, banned } = await request.json().catch(() => ({}));
  const clean = (username || "").toLowerCase();
  const user = await env.DB.prepare("SELECT id FROM users WHERE username = ?").bind(clean).first();
  if (!user) {
    return Response.json({ error: "User not found." }, { status: 404 });
  }

const value = banned ? Date.now() : null;
  await env.DB.prepare("UPDATE users SET banned_at = ? WHERE id = ?").bind(value, user.id).run();
  return Response.json({ success: true, banned: !!banned });
}
