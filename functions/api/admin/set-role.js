import { verifySession, readCookie } from "../../_lib/auth.js";

export async function onRequestPost({ request, env }) {
  const session = await verifySession(readCookie(request, "session"), env.SESSION_SECRET);
  if (!session || session.role !== "admin") {
    return Response.json({ error: "Not allowed." }, { status: 403 });
  }

const { username, role } = await request.json().catch(() => ({}));
  if (role !== "user" && role !== "admin") {
    return Response.json({ error: "Role must be 'user' or 'admin'." }, { status: 400 });
  }

const clean = (username || "").toLowerCase();
  const user = await env.DB.prepare("SELECT id FROM users WHERE username = ?").bind(clean).first();
  if (!user) {
    return Response.json({ error: "User not found." }, { status: 404 });
  }

await env.DB.prepare("UPDATE users SET role = ? WHERE id = ?").bind(role, user.id).run();
  return Response.json({ success: true, role });
}
