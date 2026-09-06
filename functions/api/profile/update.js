import { verifySession, readCookie } from "../../_lib/auth.js";

export async function onRequestPost({ request, env }) {
  const session = await verifySession(readCookie(request, "session"), env.SESSION_SECRET);
  if (!session) {
    return Response.json({ error: "You must be logged in." }, { status: 401 });
  }

  const body = await request.json().catch(() => ({}));
  const fields = {
    bio: body.bio,
    avatar: body.avatar,
    avatar_zoom: body.avatarZoom,
    avatar_pos_x: body.avatarPosX,
    avatar_pos_y: body.avatarPosY,
    portfolio_bg: body.portfolioBg,
    portfolio_audio: body.portfolioAudio,
    audio_title: body.audioTitle,
    custom_code: body.customCode,
    portfolio_effect: body.portfolioEffect,
    card_x: body.cardX,
    card_y: body.cardY,
    discord: body.discord,
    github: body.github,
    xp: body.xp,
    lessons: body.lessons,
    debug_mode: body.debugMode === undefined ? undefined : (body.debugMode ? 1 : 0)
  };

  const sets = [];
  const values = [];
  for (const [col, val] of Object.entries(fields)) {
    if (val !== undefined) {
      sets.push(`${col} = ?`);
      values.push(val);
    }
  }

  if (sets.length === 0) {
    return Response.json({ error: "No fields to update." }, { status: 400 });
  }

  values.push(session.uid);
  await env.DB.prepare(`UPDATE users SET ${sets.join(", ")} WHERE id = ?`).bind(...values).run();

  return Response.json({ success: true });
}
