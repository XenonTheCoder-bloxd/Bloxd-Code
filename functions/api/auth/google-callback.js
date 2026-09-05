import { signSession, sessionCookie } from "../../_lib/auth.js";

export async function onRequestGet({ request, env }) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");

  if (!code) {
    return Response.redirect("/?auth_error=missing_code", 302);
  }

  const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      client_id: env.GOOGLE_CLIENT_ID,
      client_secret: env.GOOGLE_CLIENT_SECRET,
      redirect_uri: env.GOOGLE_REDIRECT_URI,
      grant_type: "authorization_code"
    })
  });
  const tokenData = await tokenRes.json();

  if (!tokenData.access_token) {
    return Response.redirect("/?auth_error=google_token_failed", 302);
  }

  const profileRes = await fetch("https://www.googleapis.com/oauth2/v3/userinfo", {
    headers: { Authorization: `Bearer ${tokenData.access_token}` }
  });
  const profile = await profileRes.json();

  let user = await env.DB.prepare("SELECT * FROM users WHERE google_id = ?").bind(profile.sub).first();

  if (!user) {
    let base = (profile.email ? profile.email.split("@")[0] : "coder").toLowerCase().replace(/[^a-z0-9_]/g, "");
    if (!base) base = "coder";
    let candidate = base;
    let n = 0;
    while (await env.DB.prepare("SELECT id FROM users WHERE username = ?").bind(candidate).first()) {
      n++;
      candidate = `${base}${n}`;
    }

    const now = Date.now();
    const avatar = profile.picture || `https://api.dicebear.com/7.x/bottts/svg?seed=${candidate}`;

    const result = await env.DB.prepare(
      `INSERT INTO users (username, email, google_id, avatar, role, created_at)
       VALUES (?, ?, ?, ?, 'user', ?)`
    ).bind(candidate, profile.email || null, profile.sub, avatar, now).run();

    await env.DB.prepare(
      "INSERT INTO subdomains (username, user_id, claimed_at) VALUES (?, ?, ?)"
    ).bind(candidate, result.meta.last_row_id, now).run();

    user = { id: result.meta.last_row_id, username: candidate, role: "user" };
  }

  const token = await signSession({ uid: user.id, username: user.username, role: user.role }, env.SESSION_SECRET);

  return new Response(null, {
    status: 302,
    headers: { Location: "/", "Set-Cookie": sessionCookie(token) }
  });
}
