import { verifySession, readCookie } from "../../_lib/auth.js";
import { checkRateLimit, rateLimitResponse } from "../../_lib/ratelimit.js";
import { getModerationStatus } from "../../_lib/moderation.js";
import { validateCodeEntry } from "../../_lib/content.js";

export async function onRequestPost({ request, env }) {
  const session = await verifySession(readCookie(request, "session"), env.SESSION_SECRET);
  if (!session) {
    return Response.json({ error: "You must be logged in." }, { status: 401 });
  }

  const body = await request.json().catch(() => ({}));
  const { codeId } = body;
  const entry = await env.DB.prepare("SELECT author_id, image_key FROM community_codes WHERE id = ?").bind(codeId).first();
  if (!entry) {
    return Response.json({ error: "Entry not found." }, { status: 404 });
  }

  const isOwner = entry.author_id === session.uid;
  const isAdmin = session.role === "admin";
  if (!isOwner && !isAdmin) {
    return Response.json({ error: "Not allowed." }, { status: 403 });
  }

  if (isOwner && !isAdmin) {
    const mod = await getModerationStatus(env, session.uid);
    if (mod.banned || mod.muted) {
      return Response.json({ error: "You're not able to edit code right now." }, { status: 403 });
    }
    const allowed = await checkRateLimit(env.RATE_LIMIT_KV, `rl:codes-edit:${session.uid}`, 10, 60);
    if (!allowed) return rateLimitResponse();
  }

  const validated = validateCodeEntry(body);
  if (validated.error) {
    return Response.json({ error: validated.error }, { status: 400 });
  }
  const { title, description, category, code } = validated;

  let imageKey = entry.image_key;
  if (Object.prototype.hasOwnProperty.call(body, "imageKey") && body.imageKey !== entry.image_key) {
    if (entry.image_key) {
      const obj = await env.UPLOADS.head(entry.image_key);
      await env.UPLOADS.delete(entry.image_key);
      if (obj) {
        await env.DB.prepare("UPDATE users SET storage_bytes = MAX(0, storage_bytes - ?) WHERE id = ?")
          .bind(obj.size, entry.author_id)
          .run();
      }
    }
    imageKey = body.imageKey || null;
  }

  await env.DB.prepare(
    "UPDATE community_codes SET title = ?, description = ?, category = ?, code = ?, image_key = ? WHERE id = ?"
  ).bind(title, description, category, code, imageKey, codeId).run();

  return Response.json({ success: true });
}
