import { checkRateLimit, rateLimitResponse } from "../_lib/ratelimit.js";
import { buildFtsQuery } from "../_lib/search.js";

export async function onRequestGet({ request, env }) {
  const ip = request.headers.get("CF-Connecting-IP") || "unknown";
  const allowed = await checkRateLimit(env.RATE_LIMIT_KV, `rl:search:${ip}`, 30, 60);
  if (!allowed) return rateLimitResponse();

  const url = new URL(request.url);
  const q = (url.searchParams.get("q") || "").trim();

  if (q.length < 2) {
    return Response.json({ codes: [], posts: [] });
  }

  const ftsQuery = buildFtsQuery(q);
  if (!ftsQuery) {
    return Response.json({ codes: [], posts: [] });
  }

  const [codesResult, postsResult] = await Promise.all([
    env.DB.prepare(
      `SELECT community_codes.id, community_codes.title
       FROM community_codes_fts
       JOIN community_codes ON community_codes.id = community_codes_fts.rowid
       WHERE community_codes_fts MATCH ?
       ORDER BY bm25(community_codes_fts)
       LIMIT 5`
    ).bind(ftsQuery).all(),
    env.DB.prepare(
      `SELECT forum_posts.id, forum_posts.title
       FROM forum_posts_fts
       JOIN forum_posts ON forum_posts.id = forum_posts_fts.rowid
       WHERE forum_posts_fts MATCH ?
       ORDER BY bm25(forum_posts_fts)
       LIMIT 5`
    ).bind(ftsQuery).all()
  ]);

  return Response.json({
    codes: codesResult.results,
    posts: postsResult.results
  });
}
