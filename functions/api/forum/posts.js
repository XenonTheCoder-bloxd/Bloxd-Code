export async function onRequestGet({ env }) {
  const { results } = await env.DB.prepare(
    `SELECT forum_posts.id, forum_posts.title, forum_posts.category, forum_posts.content,
            forum_posts.media_key, forum_posts.upvotes, forum_posts.created_at,
            users.username AS author, users.avatar AS author_avatar
     FROM forum_posts
     JOIN users ON users.id = forum_posts.author_id
     ORDER BY forum_posts.created_at DESC
     LIMIT 100`
  ).all();

  const posts = results.map(p => ({
    ...p,
    media_url: p.media_key ? `${env.CDN_BASE_URL}/${p.media_key}` : null
  }));

  return Response.json({ posts });
}

export async function onRequestPost({ request, env }) {
  const { verifySession, readCookie } = await import("../../_lib/auth.js");
  const session = await verifySession(readCookie(request, "session"), env.SESSION_SECRET);
  if (!session) {
    return Response.json({ error: "You must be logged in to post." }, { status: 401 });
  }

  const body = await request.json().catch(() => ({}));
  const title = (body.title || "").trim();
  const category = (body.category || "questions").trim();
  const content = (body.content || "").trim();
  const mediaKey = body.mediaKey || null;

  if (!title || !content) {
    return Response.json({ error: "Title and content are required." }, { status: 400 });
  }

  const now = Date.now();
  const result = await env.DB.prepare(
    `INSERT INTO forum_posts (author_id, title, category, content, media_key, upvotes, created_at)
     VALUES (?, ?, ?, ?, ?, 0, ?)`
  ).bind(session.uid, title, category, content, mediaKey, now).run();

  return Response.json({ id: result.meta.last_row_id }, { status: 201 });
}
