import { signSession, sessionCookie, readCookie, clearOauthStateCookie, verifySession } from "../../_lib/auth.js";

function clearOauthLinkCookie() {
  return `oauth_link=; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=0`;
}

export async function onRequestGet({ request, env }) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const expectedState = readCookie(request, "oauth_state");

  if (!state || !expectedState || state !== expectedState) {
    return new Response(null, {
      status: 302,
      headers: { Location: "/?auth_error=invalid_state", "Set-Cookie": clearOauthStateCookie() }
    });
  }

  if (!code) {
    return new Response(null, {
      status: 302,
      headers: { Location: "/?auth_error=missing_code", "Set-Cookie": clearOauthStateCookie() }
    });
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
    return new Response(null, {
      status: 302,
      headers: { Location: "/?auth_error=google_token_failed", "Set-Cookie": clearOauthStateCookie() }
    });
  }

  const profileRes = await fetch("https://www.googleapis.com/oauth2/v3/userinfo", {
    headers: { Authorization: `Bearer ${tokenData.access_token}` }
  });
  const profile = await profileRes.json();

  // Link mode: the user was already logged in and asked to connect Google to
  // their existing account, rather than sign in as a (possibly different)
  // Google-linked account. The link token is HMAC-signed by us at request
  // time, so a forged cookie can't be used to link Google to someone else's
  // account.
  const linkToken = readCookie(request, "oauth_link");
  if (linkToken) {
    const linkPayload = await verifySession(linkToken, env.SESSION_SECRET);
    const clearHeaders = new Headers({ Location: "/" });
    clearHeaders.append("Set-Cookie", clearOauthStateCookie());
    clearHeaders.append("Set-Cookie", clearOauthLinkCookie());

    if (!linkPayload || !linkPayload.linkUid) {
      clearHeaders.set("Location", "/?auth_error=invalid_state");
      return new Response(null, { status: 302, headers: clearHeaders });
    }

    const conflicting = await env.DB.prepare(
      "SELECT id FROM users WHERE google_id = ? AND id != ?"
    ).bind(profile.sub, linkPayload.linkUid).first();

    if (conflicting) {
      clearHeaders.set("Location", "/?google_error=already_linked_elsewhere");
      return new Response(null, { status: 302, headers: clearHeaders });
    }

    await env.DB.prepare(
      "UPDATE users SET google_id = ?, email = COALESCE(email, ?) WHERE id = ?"
    ).bind(profile.sub, profile.email || null, linkPayload.linkUid).run();

    clearHeaders.set("Location", "/?google=linked");
    return new Response(null, { status: 302, headers: clearHeaders });
  }

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

  if (user.banned_at) {
    return new Response(null, {
      status: 302,
      headers: { Location: "/?auth_error=account_suspended", "Set-Cookie": clearOauthStateCookie() }
    });
  }

  const token = await signSession({ uid: user.id, username: user.username, role: user.role }, env.SESSION_SECRET);

  const headers = new Headers({ Location: "/" });
  headers.append("Set-Cookie", sessionCookie(token));
  headers.append("Set-Cookie", clearOauthStateCookie());

  return new Response(null, { status: 302, headers });
}
