import { verifySession, readCookie } from "../../_lib/auth.js";

export async function onRequestGet({ request, env }) {
  const token = readCookie(request, "session");
  const session = await verifySession(token, env.SESSION_SECRET);

  if (!session) {
    return Response.json({ user: null });
  }

  const user = await env.DB.prepare(
    `SELECT id, username, bio, avatar, avatar_zoom, avatar_pos_x, avatar_pos_y,
            portfolio_bg, portfolio_audio, audio_title, custom_code, portfolio_effect,
            card_x, card_y, discord, github, xp, lessons, profile_views,
            last_username_change, debug_mode, role
     FROM users WHERE id = ?`
  ).bind(session.uid).first();

  return Response.json({ user: user || null });
}
