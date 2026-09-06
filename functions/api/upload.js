export async function onRequestPost({ request, env }) {
  const { verifySession, readCookie } = await import("../_lib/auth.js");
  const { checkRateLimit, rateLimitResponse } = await import("../_lib/ratelimit.js");
  const { detectFileType } = await import("../_lib/filetype.js");
  const { MAX_STORAGE_BYTES } = await import("../_lib/quota.js");
  const session = await verifySession(readCookie(request, "session"), env.SESSION_SECRET);
  if (!session) {
    return Response.json({ error: "You must be logged in to upload files." }, { status: 401 });
  }

  const allowed = await checkRateLimit(env.RATE_LIMIT_KV, `rl:upload:${session.uid}`, 10, 300);
  if (!allowed) return rateLimitResponse();

  const formData = await request.formData();
  const file = formData.get("file");
  const folder = (formData.get("folder") || "misc").replace(/[^a-z0-9_-]/gi, "");

  if (!file || typeof file === "string") {
    return Response.json({ error: "No file provided." }, { status: 400 });
  }
  if (file.size > 5 * 1024 * 1024) {
    return Response.json({ error: "File too large (5MB max)." }, { status: 400 });
  }

  const user = await env.DB.prepare("SELECT storage_bytes FROM users WHERE id = ?").bind(session.uid).first();
  const currentUsage = (user && user.storage_bytes) || 0;
  if (currentUsage + file.size > MAX_STORAGE_BYTES) {
    const limitMb = (MAX_STORAGE_BYTES / (1024 * 1024)).toFixed(0);
    return Response.json({ error: `Storage limit reached (${limitMb}MB). Delete something to free up space.` }, { status: 400 });
  }

  const header = new Uint8Array(await file.slice(0, 32).arrayBuffer());
  const detected = detectFileType(header);
  if (!detected) {
    return Response.json({ error: "Unsupported or unrecognized file type." }, { status: 400 });
  }

  const key = `${folder}/${session.uid}_${Date.now()}.${detected.ext}`;

  await env.UPLOADS.put(key, file.stream(), {
    httpMetadata: { contentType: detected.mime }
  });

  await env.DB.prepare("UPDATE users SET storage_bytes = storage_bytes + ? WHERE id = ?")
    .bind(file.size, session.uid)
    .run();

  return Response.json({ key, url: `${env.CDN_BASE_URL}/${key}` }, { status: 201 });
}
