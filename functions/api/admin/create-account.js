import { verifySession, readCookie, hashPassword } from "../../_lib/auth.js";

export async function onRequestPost({ request, env }) {
  const session = await verifySession(readCookie(request, "session"), env.SESSION_SECRET);
  if (!session || session.role !== "admin") {
    return Response.json({ error: "Not allowed." }, { status: 403 });
  }

const body = await request.json().catch(() => ({}));
  const username = (body.username || "").trim().toLowerCase();
  const password = body.password || "";

if (!/^[a-z0-9_-]{3,20}$/.test(username)) {
  return Response.json({ error: "Username must be 3-20 characters: letters, numbers, underscores only." }, { status: 400 });
}
  if (password.length < 8) {
    return Response.json({ error: "Password must be at least 8 characters." }, { status: 400 });
  }

const existing = await env.DB.prepare("SELECT id FROM users WHERE username = ?").bind(username).first();
  if (existing) {
    return Response.json({ error: "That username is already taken." }, { status: 409 });
  }

const passwordHash = await hashPassword(password);
  const now = Date.now();
  const avatar = `https://api.dicebear.com/7.x/bottts/svg?seed=${username}`;

const result = await env.DB.prepare(
  `INSERT INTO users (username, password_hash, avatar, role, created_at)
  VALUES (?, ?, ?, 'user', ?)`
  ).bind(username, passwordHash, avatar, now).run();

await env.DB.prepare(
  "INSERT INTO subdomains (username, user_id, claimed_at) VALUES (?, ?, ?)"
  ).bind(username, result.meta.last_row_id, now).run();

return Response.json({ id: result.meta.last_row_id, username }, { status: 201 });
}
