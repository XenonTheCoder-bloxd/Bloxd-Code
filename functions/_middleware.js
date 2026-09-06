export async function onRequest(context) {
  const response = await context.next();
  const headers = new Headers(response.headers);

  headers.set("X-Content-Type-Options", "nosniff");
  headers.set("Referrer-Policy", "strict-origin-when-cross-origin");
  // API responses are per-user/session data - never let a cache keep a copy.
  headers.set("Cache-Control", "no-store");

  // Something in this deployment doesn't reliably preserve Response.json()'s
  // automatic Content-Type through to the client (observed: real JSON bodies
  // arriving labeled text/html). Rather than guess from the URL or the
  // (already-unreliable) content-type, actually check the body: only force
  // application/json when it truly parses as JSON, so a genuine HTML
  // response (e.g. the SPA fallback for an unmatched route) is never
  // mislabeled.
  const isRedirect = response.status >= 300 && response.status < 400;
  let finalResponse = new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers
  });

  if (!isRedirect && (headers.get("Content-Type") || "").includes("text/html")) {
    const clone = finalResponse.clone();
    const text = await clone.text();
    try {
      JSON.parse(text);
      headers.set("Content-Type", "application/json; charset=utf-8");
      finalResponse = new Response(text, {
        status: finalResponse.status,
        statusText: finalResponse.statusText,
        headers
      });
    } catch {
      // Not actually JSON - leave it as-is.
    }
  }

  return finalResponse;
}
