export async function onRequestGet({ env }) {
  const { results } = await env.DB.prepare(
    `SELECT community_codes.id, community_codes.title, community_codes.description,
            community_codes.category, community_codes.code, community_codes.image_key,
            community_codes.created_at, users.username AS author
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
  const session = await verifySession(readCookie(request, "session"), env.SESSION_SECRET);
  if (!session) {
    return Response.json({ error: "You must be logged in to upload code." }, { status: 401 });
  }

  const body = await request.json().catch(() => ({}));
  const title = (body.title || "").trim();
  const description = (body.description || "").trim();
  const category = (body.category || "misc").trim();
  const code = body.code || "";
  const imageKey = body.imageKey || null;

  if (!title || !code) {
    return Response.json({ error: "Title and code are required." }, { status: 400 });
  }

  const now = Date.now();
  const result = await env.DB.prepare(
    `INSERT INTO community_codes (author_id, title, description, category, code, image_key, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)`
  ).bind(session.uid, title, description, category, code, imageKey, now).run();

  return Response.json({ id: result.meta.last_row_id }, { status: 201 });
}
