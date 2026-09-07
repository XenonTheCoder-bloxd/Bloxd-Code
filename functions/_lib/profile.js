import { freeIfOwnedUpload } from "./quota.js";

// Validates and builds the { column: value } set for a profile update,
// freeing any replaced R2-hosted media for `ownerId` along the way.
// Returns { error } on validation failure, or { fields } ready to apply.
export async function buildProfileUpdate(env, ownerId, body) {
  if (typeof body.customCode === "string" && body.customCode.length > 20000) {
    return { error: "Custom code must be 20,000 characters or fewer." };
  }
  if (typeof body.bio === "string" && body.bio.length > 500) {
    return { error: "Bio must be 500 characters or fewer." };
  }

  let email;
  if (body.email !== undefined) {
    email = (body.email || "").trim().toLowerCase();
    if (email) {
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        return { error: "That doesn't look like a valid email address." };
      }
      const existing = await env.DB.prepare("SELECT id FROM users WHERE email = ? AND id != ?").bind(email, ownerId).first();
      if (existing) {
        return { error: "That email is already associated with another account." };
      }
    } else {
      email = null;
    }
  }

  const mediaFields = ["avatar", "portfolioBg", "portfolioAudio"].filter(f => body[f] !== undefined);
  if (mediaFields.length > 0) {
    const current = await env.DB.prepare(
      "SELECT avatar, portfolio_bg, portfolio_audio FROM users WHERE id = ?"
    ).bind(ownerId).first();

    if (current) {
      const oldValueByField = { avatar: current.avatar, portfolioBg: current.portfolio_bg, portfolioAudio: current.portfolio_audio };
      for (const field of mediaFields) {
        const oldVal = oldValueByField[field];
        if (oldVal && oldVal !== body[field]) {
          await freeIfOwnedUpload(env, oldVal, ownerId);
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
    email: body.email === undefined ? undefined : email,
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

  return { fields };
}

// Applies a fields object (from buildProfileUpdate) as an UPDATE against a
// specific user id. Returns false if there was nothing to set.
export async function applyProfileUpdate(env, ownerId, fields) {
  const sets = [];
  const values = [];
  for (const [col, val] of Object.entries(fields)) {
    if (val !== undefined) {
      sets.push(`${col} = ?`);
      values.push(val);
    }
  }
  if (sets.length === 0) return false;

  values.push(ownerId);
  await env.DB.prepare(`UPDATE users SET ${sets.join(", ")} WHERE id = ?`).bind(...values).run();
  return true;
}
