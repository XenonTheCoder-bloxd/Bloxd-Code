export async function onRequestGet({ env }) {
  const { results } = await env.DB.prepare(
    `SELECT community_codes.id, community_codes.author_id, community_codes.title,
            community_codes.description, community_codes.category, community_codes.code,
            community_codes.image_key, community_codes.created_at, users.username AS author
     FROM community_codes
     JOIN users ON users.id = community_codes.author_id
     ORDER BY community_codes.created_at DESC
     LIMIT 100`
  ).all();

  const codes = results.map(c => ({
    ...c,
    image_url: c.image_key ? `${env.CDN_BASE_URL}/${c.image_key}` : null
  }));

  return Response.json({ codes });
}

export async function onRequestPost({ request, env }) {
  const { verifySession, readCookie } = await import("../../_lib/auth.js");
  const { checkRateLimit, rateLimitResponse } = await import("../../_lib/ratelimit.js");
  const session = await verifySession(readCookie(request, "session"), env.SESSION_SECRET);
  if (!session) {
    return Response.json({ error: "You must be logged in to upload code." }, { status: 401 });
  }

  const allowed = await checkRateLimit(env.RATE_LIMIT_KV, `rl:codes-create:${session.uid}`, 5, 60);
  if (!allowed) return rateLimitResponse();

  const body = await request.json().catch(() => ({}));
  const title = (body.title || "").trim();
  const description = (body.description || "").trim();
  const ALLOWED_CATEGORIES = ["general", "pvp", "minigames", "worldgen", "admin", "math", "ui", "ai", "economy", "tutorials", "showcase", "bugs"];
  const category = ALLOWED_CATEGORIES.includes(body.category) ? body.category : "general";
  const code = body.code || "";
  const imageKey = body.imageKey || null;

  if (!title || !code) {
    return Response.json({ error: "Title and code are required." }, { status: 400 });
  }
  if (title.length > 150) {
    return Response.json({ error: "Title must be 150 characters or fewer." }, { status: 400 });
  }
  if (description.length > 1000) {
    return Response.json({ error: "Description must be 1000 characters or fewer." }, { status: 400 });
  }
  if (code.length > 50000) {
    return Response.json({ error: "Code must be 50,000 characters or fewer." }, { status: 400 });
  }

  const now = Date.now();
  const result = await env.DB.prepare(
    `INSERT INTO community_codes (author_id, title, description, category, code, image_key, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)`
  ).bind(session.uid, title, description, category, code, imageKey, now).run();

  return Response.json({ id: result.meta.last_row_id }, { status: 201 });
}
