import { verifySession, readCookie } from "../../_lib/auth.js";
import { checkRateLimit, rateLimitResponse } from "../../_lib/ratelimit.js";

export async function onRequestPost({ request, env }) {
  const session = await verifySession(readCookie(request, "session"), env.SESSION_SECRET);
  if (!session) {
    return Response.json({ error: "You must be logged in." }, { status: 401 });
  }

  const allowed = await checkRateLimit(env.RATE_LIMIT_KV, `rl:codes-delete:${session.uid}`, 10, 60);
  if (!allowed) return rateLimitResponse();

  const { codeId } = await request.json().catch(() => ({}));
  const entry = await env.DB.prepare("SELECT author_id FROM community_codes WHERE id = ?").bind(codeId).first();
  if (!entry) {
    return Response.json({ error: "Entry not found." }, { status: 404 });
  }
  if (entry.author_id !== session.uid && session.role !== "admin") {
    return Response.json({ error: "Not allowed." }, { status: 403 });
  }

  await env.DB.prepare("DELETE FROM community_codes WHERE id = ?").bind(codeId).run();
  return Response.json({ success: true });
}
