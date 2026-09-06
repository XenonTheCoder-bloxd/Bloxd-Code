import { verifySession, readCookie } from "../../_lib/auth.js";
import { freeIfOwnedUpload } from "../../_lib/quota.js";

export async function onRequestPost({ request, env }) {
  const session = await verifySession(readCookie(request, "session"), env.SESSION_SECRET);
  if (!session) {
    return Response.json({ error: "You must be logged in." }, { status: 401 });
  }

  const body = await request.json().catch(() => ({}));

  if (typeof body.customCode === "string" && body.customCode.length > 20000) {
    return Response.json({ error: "Custom code must be 20,000 characters or fewer." }, { status: 400 });
  }
  if (typeof body.bio === "string" && body.bio.length > 500) {
    return Response.json({ error: "Bio must be 500 characters or fewer." }, { status: 400 });
  }

  // If avatar/background/audio are being replaced or cleared, free whatever
  // the OLD value pointed at first - otherwise repeatedly swapping these
  // leaks quota into orphaned R2 objects that no longer show up anywhere.
  const mediaFields = ["avatar", "portfolioBg", "portfolioAudio"].filter(f => body[f] !== undefined);
  if (mediaFields.length > 0) {
    const current = await env.DB.prepare(
      "SELECT avatar, portfolio_bg, portfolio_audio FROM users WHERE id = ?"
    ).bind(session.uid).first();

    if (current) {
      const oldValueByField = { avatar: current.avatar, portfolioBg: current.portfolio_bg, portfolioAudio: current.portfolio_audio };
      for (const field of mediaFields) {
        const oldVal = oldValueByField[field];
        if (oldVal && oldVal !== body[field]) {
          await freeIfOwnedUpload(env, oldVal, session.uid);
        }
      }
    }
  }

  const clampNum = (val, min, max, fallback) => {
    const n = Number(val);
    return Number.isFinite(n) ? Math.min(max, Math.max(min, n)) : fallback;
  };

  const fields = {
    bio: body.bio,
    avatar: body.avatar,
    avatar_zoom: body.avatarZoom === undefined ? undefined : clampNum(body.avatarZoom, 0.5, 3, 1),
    avatar_pos_x: body.avatarPosX === undefined ? undefined : clampNum(body.avatarPosX, 0, 100, 50),
    avatar_pos_y: body.avatarPosY === undefined ? undefined : clampNum(body.avatarPosY, 0, 100, 50),
    portfolio_bg: body.portfolioBg,
    portfolio_audio: body.portfolioAudio,
    audio_title: body.audioTitle,
    custom_code: body.customCode,
    portfolio_effect: body.portfolioEffect,
    card_x: body.cardX === undefined ? undefined : clampNum(body.cardX, 0, 100, 50),
    card_y: body.cardY === undefined ? undefined : clampNum(body.cardY, 0, 100, 50),
    discord: body.discord,
    github: body.github,
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
