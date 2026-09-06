import { verifySession, readCookie } from "../../_lib/auth.js";
import { checkRateLimit, rateLimitResponse } from "../../_lib/ratelimit.js";
import { getModerationStatus } from "../../_lib/moderation.js";
import { validateForumPost } from "../../_lib/content.js";

export async function onRequestPost({ request, env }) {
  const session = await verifySession(readCookie(request, "session"), env.SESSION_SECRET);
  if (!session) {
    return Response.json({ error: "You must be logged in." }, { status: 401 });
  }

const body = await request.json().catch(() => ({}));
  const { postId } = body;
  const post = await env.DB.prepare("SELECT author_id, media_key FROM forum_posts WHERE id = ?").bind(postId).first();
  if (!post) {
    return Response.json({ error: "Post not found." }, { status: 404 });
  }

const isOwner = post.author_id === session.uid;
  const isAdmin = session.role === "admin";
  if (!isOwner && !isAdmin) {
    return Response.json({ error: "Not allowed." }, { status: 403 });
  }

// Owners are still subject to ban/mute + rate limiting on edits; admins acting
// as moderators are not (e.g. an admin cleaning up a muted user's post).
if (isOwner && !isAdmin) {
  const mod = await getModerationStatus(env, session.uid);
  if (mod.banned || mod.muted) {
    return Response.json({ error: "You're not able to edit posts right now." }, { status: 403 });
  }
  const allowed = await checkRateLimit(env.RATE_LIMIT_KV, `rl:forum-edit:${session.uid}`, 10, 60);
  if (!allowed) return rateLimitResponse();
}

const validated = validateForumPost(body);
  if (validated.error) {
    return Response.json({ error: validated.error }, { status: 400 });
  }
  const { title, category, content } = validated;

// mediaKey explicitly present (including null, to clear it) means the caller
// wants to change the attachment - free whatever the old one was first.
let mediaKey = post.media_key;
  if (Object.prototype.hasOwnProperty.call(body, "mediaKey") && body.mediaKey !== post.media_key) {
    if (post.media_key) {
      const obj = await env.UPLOADS.head(post.media_key);
      await env.UPLOADS.delete(post.media_key);
      if (obj) {
        await env.DB.prepare("UPDATE users SET storage_bytes = MAX(0, storage_bytes - ?) WHERE id = ?")
        .bind(obj.size, post.author_id)
        .run();
      }
    }
    mediaKey = body.mediaKey || null;
  }

await env.DB.prepare(
  "UPDATE forum_posts SET title = ?, category = ?, content = ?, media_key = ? WHERE id = ?"
  ).bind(title, category, content, mediaKey, postId).run();

return Response.json({ success: true });
}
