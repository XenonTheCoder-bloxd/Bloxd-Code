import { verifySession, readCookie } from "../../_lib/auth.js";

export async function onRequestPost({ request, env }) {
  const session = await verifySession(readCookie(request, "session"), env.SESSION_SECRET);
  if (!session || session.role !== "admin") {
    return Response.json({ error: "Not allowed." }, { status: 403 });
  }

  const { username } = await request.json().catch(() => ({}));
  const clean = (username || "").toLowerCase();
  const user = await env.DB.prepare("SELECT id FROM users WHERE username = ?").bind(clean).first();
  if (!user) {
    return Response.json({ error: "User not found." }, { status: 404 });
  }

  await env.DB.prepare("DELETE FROM forum_posts WHERE author_id = ?").bind(user.id).run();
  await env.DB.prepare("DELETE FROM community_codes WHERE author_id = ?").bind(user.id).run();
  await env.DB.prepare("DELETE FROM subdomains WHERE user_id = ?").bind(user.id).run();
  await env.DB.prepare("DELETE FROM users WHERE id = ?").bind(user.id).run();

  return Response.json({ success: true });
}
