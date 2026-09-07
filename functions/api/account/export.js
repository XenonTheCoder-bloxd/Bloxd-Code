import { verifySession, readCookie } from "../../_lib/auth.js";
import { checkRateLimit, rateLimitResponse } from "../../_lib/ratelimit.js";

export async function onRequestGet({ request, env }) {
  const session = await verifySession(readCookie(request, "session"), env.SESSION_SECRET);
  if (!session) {
    return Response.json({ error: "You must be logged in." }, { status: 401 });
  }

  const allowed = await checkRateLimit(env.RATE_LIMIT_KV, `rl:export:${session.uid}`, 5, 3600);
  if (!allowed) return rateLimitResponse();

  const profile = await env.DB.prepare(
    `SELECT username, email, bio, avatar, portfolio_bg, portfolio_audio, audio_title,
            custom_code, discord, github, xp, profile_views, role, created_at,
            (google_id IS NOT NULL) AS has_google
     FROM users WHERE id = ?`
  ).bind(session.uid).first();

  const { results: posts } = await env.DB.prepare(
    "SELECT title, category, content, upvotes, created_at FROM forum_posts WHERE author_id = ? ORDER BY created_at DESC"
  ).bind(session.uid).all();

  const { results: codes } = await env.DB.prepare(
    "SELECT title, description, category, code, created_at FROM community_codes WHERE author_id = ? ORDER BY created_at DESC"
  ).bind(session.uid).all();

  const exportData = {
    exportedAt: new Date().toISOString(),
    profile,
    forumPosts: posts,
    communityCodes: codes
  };

  return new Response(JSON.stringify(exportData, null, 2), {
    headers: { "Content-Type": "application/json" }
  });
}
