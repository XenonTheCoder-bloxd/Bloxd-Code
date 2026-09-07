export const MAX_STORAGE_BYTES = 100 * 1024 * 1024; // 100MB per account

// Returns the R2 object key if `url` points at our own uploads CDN, else null.
// Lets callers tell "a file we host" apart from an arbitrary external URL a
// user pasted in for their avatar/background/audio.
export function extractR2Key(url, cdnBaseUrl) {
  if (!url || !cdnBaseUrl) return null;
  const prefix = cdnBaseUrl.endsWith("/") ? cdnBaseUrl : cdnBaseUrl + "/";
  return url.startsWith(prefix) ? url.slice(prefix.length) : null;
}

// Deletes an R2 object (if `url` is one of ours) and frees its bytes from the
// owner's storage quota. A no-op for external URLs.
export async function freeIfOwnedUpload(env, url, ownerId) {
  const key = extractR2Key(url, env.CDN_BASE_URL);
  if (!key) return;
  const obj = await env.UPLOADS.head(key);
  await env.UPLOADS.delete(key);
  if (obj) {
    await env.DB.prepare("UPDATE users SET storage_bytes = MAX(0, storage_bytes - ?) WHERE id = ?")
      .bind(obj.size, ownerId)
      .run();
  }
}
