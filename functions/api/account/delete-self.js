import { verifySession, readCookie, clearCookie } from "../../_lib/auth.js";
import { extractR2Key } from "../../_lib/quota.js";

export async function onRequestPost({ request, env }) {
  const session = await verifySession(readCookie(request, "session"), env.SESSION_SECRET);
  if (!session) {
    return Response.json({ error: "You must be logged in." }, { status: 401 });
  }

  const user = await env.DB.prepare(
    "SELECT id, avatar, portfolio_bg, portfolio_audio FROM users WHERE id = ?"
  ).bind(session.uid).first();
  if (!user) {
    return Response.json({ error: "User not found." }, { status: 404 });
  }

  const { results: posts } = await env.DB.prepare(
    "SELECT media_key FROM forum_posts WHERE author_id = ?"
  ).bind(user.id).all();
  const { results: codes } = await env.DB.prepare(
    "SELECT image_key FROM community_codes WHERE author_id = ?"
  ).bind(user.id).all();

  const keys = new Set();
  posts.forEach(p => p.media_key && keys.add(p.media_key));
  codes.forEach(c => c.image_key && keys.add(c.image_key));
  [user.avatar, user.portfolio_bg, user.portfolio_audio].forEach(url => {
    const key = extractR2Key(url, env.CDN_BASE_URL);
    if (key) keys.add(key);
  });

  if (keys.size > 0) {
    await env.UPLOADS.delete([...keys]);
  }

  await env.DB.prepare("DELETE FROM forum_posts WHERE author_id = ?").bind(user.id).run();
  await env.DB.prepare("DELETE FROM community_codes WHERE author_id = ?").bind(user.id).run();
  await env.DB.prepare("DELETE FROM subdomains WHERE user_id = ?").bind(user.id).run();
  await env.DB.prepare("DELETE FROM users WHERE id = ?").bind(user.id).run();

  return new Response(JSON.stringify({ success: true }), {
    headers: { "Content-Type": "application/json", "Set-Cookie": clearCookie() }
  });
}
