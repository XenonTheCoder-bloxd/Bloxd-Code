import { verifySession, readCookie } from "../../_lib/auth.js";

export async function onRequestPost({ request, env }) {
  const session = await verifySession(readCookie(request, "session"), env.SESSION_SECRET);
  if (!session) {
    return Response.json({ error: "You must be logged in." }, { status: 401 });
  }

  const { postId } = await request.json().catch(() => ({}));
  const post = await env.DB.prepare("SELECT author_id FROM forum_posts WHERE id = ?").bind(postId).first();
  if (!post) {
    return Response.json({ error: "Post not found." }, { status: 404 });
  }
  if (post.author_id !== session.uid && session.role !== "admin") {
    return Response.json({ error: "Not allowed." }, { status: 403 });
  }

  await env.DB.prepare("DELETE FROM forum_posts WHERE id = ?").bind(postId).run();
  return Response.json({ success: true });
}
