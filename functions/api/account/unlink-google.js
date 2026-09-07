import { verifySession, readCookie } from "../../_lib/auth.js";

export async function onRequestPost({ request, env }) {
  const session = await verifySession(readCookie(request, "session"), env.SESSION_SECRET);
  if (!session) {
    return Response.json({ error: "You must be logged in." }, { status: 401 });
  }

  const user = await env.DB.prepare("SELECT password_hash, google_id FROM users WHERE id = ?").bind(session.uid).first();
  if (!user) {
    return Response.json({ error: "User not found." }, { status: 404 });
  }
  if (!user.google_id) {
    return Response.json({ error: "Google isn't connected to this account." }, { status: 400 });
  }
  if (!user.password_hash) {
    return Response.json({ error: "Set a password first - otherwise you'd be locked out of your account." }, { status: 400 });
  }

  await env.DB.prepare("UPDATE users SET google_id = NULL WHERE id = ?").bind(session.uid).run();
  return Response.json({ success: true });
}
