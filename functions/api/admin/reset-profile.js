import { verifySession, readCookie } from "../../_lib/auth.js";
import { freeIfOwnedUpload } from "../../_lib/quota.js";

export async function onRequestPost({ request, env }) {
  const session = await verifySession(readCookie(request, "session"), env.SESSION_SECRET);
  if (!session || session.role !== "admin") {
    return Response.json({ error: "Not allowed." }, { status: 403 });
  }

const { username } = await request.json().catch(() => ({}));
  const clean = (username || "").toLowerCase();
  const user = await env.DB.prepare(
    "SELECT id, username, avatar, portfolio_bg, portfolio_audio FROM users WHERE username = ?"
    ).bind(clean).first();
  if (!user) {
    return Response.json({ error: "User not found." }, { status: 404 });
  }

// Free any R2-hosted avatar/background/audio before clearing the fields,
// so a reset doesn't just orphan those files in the bucket.
await freeIfOwnedUpload(env, user.avatar, user.id);
  await freeIfOwnedUpload(env, user.portfolio_bg, user.id);
  await freeIfOwnedUpload(env, user.portfolio_audio, user.id);

const defaultAvatar = `https://api.dicebear.com/7.x/bottts/svg?seed=${user.username}`;

await env.DB.prepare(
  `UPDATE users SET
  bio = NULL, avatar = ?, avatar_zoom = 1, avatar_pos_x = 50, avatar_pos_y = 50,
  portfolio_bg = NULL, portfolio_audio = NULL, audio_title = NULL,
  custom_code = NULL, portfolio_effect = 'none', card_x = 50, card_y = 50,
  discord = NULL, github = NULL
  WHERE id = ?`
  ).bind(defaultAvatar, user.id).run();

return Response.json({ success: true });
}
