import { verifySession, readCookie } from "../../_lib/auth.js";

export async function onRequestGet({ request, env }) {
  const session = await verifySession(readCookie(request, "session"), env.SESSION_SECRET);
  if (!session || session.role !== "admin") {
    return Response.json({ error: "Not allowed." }, { status: 403 });
  }

const url = new URL(request.url);
  const q = (url.searchParams.get("q") || "").trim().toLowerCase();

const { results } = q
  ? await env.DB.prepare(
    `SELECT id, username, role, banned_at, muted_at, created_at, storage_bytes
    FROM users WHERE username LIKE ? ORDER BY created_at DESC`
    ).bind(`%${q}%`).all()
  : await env.DB.prepare(
    `SELECT id, username, role, banned_at, muted_at, created_at, storage_bytes
    FROM users ORDER BY created_at DESC`
    ).all();

const users = results.map(u => ({
  id: u.id,
  username: u.username,
  role: u.role,
  banned: !!u.banned_at,
  muted: !!u.muted_at,
  createdAt: u.created_at,
  storageBytes: u.storage_bytes || 0
}));

return Response.json({ users });
}
