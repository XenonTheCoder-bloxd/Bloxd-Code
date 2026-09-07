import { verifySession, readCookie } from "../../_lib/auth.js";
import { checkRateLimit, rateLimitResponse } from "../../_lib/ratelimit.js";

export async function onRequestPost({ request, env }) {
  const session = await verifySession(readCookie(request, "session"), env.SESSION_SECRET);
  if (!session) {
    return Response.json({ error: "You must be logged in." }, { status: 401 });
  }

  const allowed = await checkRateLimit(env.RATE_LIMIT_KV, `rl:forum-delete:${session.uid}`, 10, 60);
  if (!allowed) return rateLimitResponse();

  const { postId } = await request.json().catch(() => ({}));
  const post = await env.DB.prepare("SELECT author_id, media_key FROM forum_posts WHERE id = ?").bind(postId).first();
  if (!post) {
    return Response.json({ error: "Post not found." }, { status: 404 });
  }
  if (post.author_id !== session.uid && session.role !== "admin") {
    return Response.json({ error: "Not allowed." }, { status: 403 });
  }

  if (post.media_key) {
    const obj = await env.UPLOADS.head(post.media_key);
    await env.UPLOADS.delete(post.media_key);
    if (obj) {
      await env.DB.prepare("UPDATE users SET storage_bytes = MAX(0, storage_bytes - ?) WHERE id = ?")
        .bind(obj.size, post.author_id)
        .run();
    }
  }

  await env.DB.prepare("DELETE FROM forum_posts WHERE id = ?").bind(postId).run();
  return Response.json({ success: true });
}
