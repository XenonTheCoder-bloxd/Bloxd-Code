export async function onRequestGet({ request, env }) {
  const { oauthStateCookie, verifySession, readCookie, signSession } = await import("../../_lib/auth.js");
  const state = crypto.randomUUID();

  const url = new URL(request.url);
  const headers = new Headers();
  headers.append("Set-Cookie", oauthStateCookie(state));

  if (url.searchParams.get("mode") === "link") {
    const session = await verifySession(readCookie(request, "session"), env.SESSION_SECRET);
    if (session) {
      // Signed so the callback can trust it - a forged cookie can't link
      // Google to an arbitrary account. Short-lived since it only needs to
      // survive the OAuth round trip.
      const linkToken = await signSession({ linkUid: session.uid }, env.SESSION_SECRET, 600);
      headers.append("Set-Cookie", `oauth_link=${linkToken}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=600`);
    }
  }

  const params = new URLSearchParams({
    client_id: env.GOOGLE_CLIENT_ID,
    redirect_uri: env.GOOGLE_REDIRECT_URI,
    response_type: "code",
    scope: "openid email profile",
    prompt: "select_account",
    state
  });

  headers.set("Location", `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`);

  return new Response(null, { status: 302, headers });
}
