import { verifySession, readCookie } from "../../_lib/auth.js";
import { buildProfileUpdate, applyProfileUpdate } from "../../_lib/profile.js";

export async function onRequestPost({ request, env }) {
  const session = await verifySession(readCookie(request, "session"), env.SESSION_SECRET);
  if (!session || session.role !== "admin") {
    return Response.json({ error: "Not allowed." }, { status: 403 });
  }

  const body = await request.json().catch(() => ({}));
  const clean = (body.username || "").toLowerCase();
  const user = await env.DB.prepare("SELECT id FROM users WHERE username = ?").bind(clean).first();
  if (!user) {
    return Response.json({ error: "User not found." }, { status: 404 });
  }

  const built = await buildProfileUpdate(env, user.id, body);
  if (built.error) {
    return Response.json({ error: built.error }, { status: 400 });
  }

  const applied = await applyProfileUpdate(env, user.id, built.fields);
  if (!applied) {
    return Response.json({ error: "No fields to update." }, { status: 400 });
  }

  return Response.json({ success: true });
}
