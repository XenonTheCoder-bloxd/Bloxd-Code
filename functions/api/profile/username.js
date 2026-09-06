import { verifySession, readCookie, signSession, sessionCookie } from "../../_lib/auth.js";

const COOLDOWN_MS = 60 * 60 * 1000;

export async function onRequestPost({ request, env }) {
  const session = await verifySession(readCookie(request, "session"), env.SESSION_SECRET);
  if (!session) {
    return Response.json({ error: "You must be logged in." }, { status: 401 });
  }

  const body = await request.json().catch(() => ({}));
  const newUsername = (body.username || "").trim().toLowerCase();

  if (!/^[a-z0-9_]{3,20}$/.test(newUsername)) {
    return Response.json({ error: "Username must be 3-20 characters: letters, numbers, underscores only." }, { status: 400 });
  }

  const user = await env.DB.prepare("SELECT * FROM users WHERE id = ?").bind(session.uid).first();
  if (!user) {
    return Response.json({ error: "User not found." }, { status: 404 });
  }

  if (newUsername === user.username) {
    return Response.json({ success: true, username: newUsername });
  }

  const now = Date.now();
  const lastChange = user.last_username_change || 0;
  if (now - lastChange < COOLDOWN_MS) {
    const minutesLeft = Math.ceil((COOLDOWN_MS - (now - lastChange)) / 60000);
    return Response.json({ error: `You can change your username again in ${minutesLeft} minute(s).` }, { status: 429 });
  }

  const taken = await env.DB.prepare("SELECT id FROM users WHERE username = ?").bind(newUsername).first();
  if (taken) {
    return Response.json({ error: "That username is already taken." }, { status: 409 });
  }

  await env.DB.prepare("UPDATE users SET username = ?, last_username_change = ? WHERE id = ?")
    .bind(newUsername, now, session.uid).run();

  await env.DB.prepare("DELETE FROM subdomains WHERE username = ?").bind(user.username).run();
  await env.DB.prepare("INSERT INTO subdomains (username, user_id, claimed_at) VALUES (?, ?, ?)")
    .bind(newUsername, session.uid, now).run();

  const token = await signSession({ uid: session.uid, username: newUsername, role: user.role }, env.SESSION_SECRET);

  return new Response(JSON.stringify({ success: true, username: newUsername }), {
    headers: { "Content-Type": "application/json", "Set-Cookie": sessionCookie(token) }
  });
}
