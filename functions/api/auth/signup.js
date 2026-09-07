import { hashPassword, signSession, sessionCookie } from "../../_lib/auth.js";
import { verifyTurnstile } from "../../_lib/turnstile.js";

export async function onRequestPost({ request, env }) {
  const body = await request.json().catch(() => ({}));
  const username = (body.username || "").trim().toLowerCase();
  const password = body.password || "";

  const ip = request.headers.get("CF-Connecting-IP");
  const humanVerified = await verifyTurnstile(body.turnstileToken, env.TURNSTILE_SECRET, ip);
  if (!humanVerified) {
    return Response.json({ error: "Verification failed. Please try again." }, { status: 400 });
  }

    if (!/^[a-z0-9_-]{3,20}$/.test(username)) {
    return Response.json({ error: "Username must be 3-20 characters: letters, numbers, underscores only." }, { status: 400 });
  }
  if (password.length < 8) {
    return Response.json({ error: "Password must be at least 8 characters." }, { status: 400 });
  }

  let email = (body.email || "").trim().toLowerCase();
  if (email) {
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return Response.json({ error: "That doesn't look like a valid email address." }, { status: 400 });
    }
    const existingEmail = await env.DB.prepare("SELECT id FROM users WHERE email = ?").bind(email).first();
    if (existingEmail) {
      return Response.json({ error: "That email is already associated with another account." }, { status: 409 });
    }
  } else {
    email = null;
  }

  const existing = await env.DB.prepare("SELECT id FROM users WHERE username = ?").bind(username).first();
  if (existing) {
    return Response.json({ error: "That username is already taken." }, { status: 409 });
  }

  const passwordHash = await hashPassword(password);
  const now = Date.now();
  const avatar = `https://api.dicebear.com/7.x/bottts/svg?seed=${username}`;

  const result = await env.DB.prepare(
    `INSERT INTO users (username, email, password_hash, avatar, role, created_at)
     VALUES (?, ?, ?, ?, 'user', ?)`
  ).bind(username, email, passwordHash, avatar, now).run();

  const userId = result.meta.last_row_id;

  await env.DB.prepare(
    "INSERT INTO subdomains (username, user_id, claimed_at) VALUES (?, ?, ?)"
  ).bind(username, userId, now).run();

  const token = await signSession({ uid: userId, username, role: "user" }, env.SESSION_SECRET);

  return new Response(JSON.stringify({ id: userId, username, avatar, role: "user" }), {
    status: 201,
    headers: { "Content-Type": "application/json", "Set-Cookie": sessionCookie(token) }
  });
}
