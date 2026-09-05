export async function onRequestPost({ request, env }) {
  const { verifySession, readCookie } = await import("../_lib/auth.js");
  const session = await verifySession(readCookie(request, "session"), env.SESSION_SECRET);
  if (!session) {
    return Response.json({ error: "You must be logged in to upload files." }, { status: 401 });
  }

  const formData = await request.formData();
  const file = formData.get("file");
  const folder = (formData.get("folder") || "misc").replace(/[^a-z0-9_-]/gi, "");

  if (!file || typeof file === "string") {
    return Response.json({ error: "No file provided." }, { status: 400 });
  }
  if (file.size > 5 * 1024 * 1024) {
    return Response.json({ error: "File too large (5MB max)." }, { status: 400 });
  }

  const ext = (file.name.split(".").pop() || "png").toLowerCase();
  const key = `${folder}/${session.uid}_${Date.now()}.${ext}`;

  await env.UPLOADS.put(key, file.stream(), {
    httpMetadata: { contentType: file.type || "application/octet-stream" }
  });

  return Response.json({ key, url: `${env.CDN_BASE_URL}/${key}` }, { status: 201 });
}
