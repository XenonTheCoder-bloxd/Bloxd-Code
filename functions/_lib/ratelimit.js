// Fixed-window counter stored in KV. Returns true if the request is allowed,
// false if the caller has exceeded `limit` requests within `windowSeconds`.
export async function checkRateLimit(kv, key, limit, windowSeconds) {
  const now = Date.now();
  const raw = await kv.get(key);
  let entry = raw ? JSON.parse(raw) : null;

  if (!entry || now > entry.reset) {
    entry = { count: 0, reset: now + windowSeconds * 1000 };
  }

  entry.count++;
  await kv.put(key, JSON.stringify(entry), { expirationTtl: windowSeconds + 5 });

  return entry.count <= limit;
}

export function rateLimitResponse() {
  return Response.json({ error: "You're doing that too much. Slow down and try again shortly." }, { status: 429 });
}
