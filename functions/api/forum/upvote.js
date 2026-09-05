export async function onRequestPost({ request, env }) {
  const { verifySession, readCookie } = await import("../../_lib/auth.js");
  const session = await verifySession(readCookie(request, "session"), env.SESSION_SECRET);
  if (!session) {
    return Response.json({ error: "You must be logged in to upvote." }, { status: 401 });
  }

  const body = await request.json().catch(() => ({}));
  const postId = body.postId;
  if (!postId) {
    return Response.json({ error: "postId is required." }, { status: 400 });
  }

  await env.DB.prepare("UPDATE forum_posts SET upvotes = upvotes + 1 WHERE id = ?").bind(postId).run();
  return Response.json({ success: true });
}
