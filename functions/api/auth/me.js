import { verifySession, readCookie } from "../../_lib/auth.js";

export async function onRequestGet({ request, env }) {
  const token = readCookie(request, "session");
  const session = await verifySession(token, env.SESSION_SECRET);

  if (!session) {
    return Response.json({ user: null });
  }

  const user = await env.DB.prepare(
    "SELECT id, username, bio, avatar, discord, github, xp, lessons, role FROM users WHERE id = ?"
  ).bind(session.uid).first();

  return Response.json({ user: user || null });
}
