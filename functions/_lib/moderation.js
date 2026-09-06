export async function getModerationStatus(env, uid) {
  const row = await env.DB.prepare("SELECT banned_at, muted_at FROM users WHERE id = ?").bind(uid).first();
  return {
    banned: !!(row && row.banned_at),
    muted: !!(row && row.muted_at)
  };
}
