import { checkRateLimit, rateLimitResponse } from "../../_lib/ratelimit.js";
import { sendEmail } from "../../_lib/email.js";

const GENERIC_RESPONSE = { message: "If that email is registered, we've sent a password reset link to it." };

export async function onRequestPost({ request, env }) {
  const ip = request.headers.get("CF-Connecting-IP") || "unknown";
  const allowed = await checkRateLimit(env.RATE_LIMIT_KV, `rl:forgot-password:${ip}`, 5, 3600);
  if (!allowed) return rateLimitResponse();

  const body = await request.json().catch(() => ({}));
  const email = (body.email || "").trim().toLowerCase();
  if (!email) return Response.json(GENERIC_RESPONSE);

  const user = await env.DB.prepare("SELECT id, username FROM users WHERE email = ?").bind(email).first();
  if (!user) return Response.json(GENERIC_RESPONSE);

  // Also rate limit per-account, so a leaked/registered email can't be spammed
  // with reset emails even from many different IPs.
  const perAccountAllowed = await checkRateLimit(env.RATE_LIMIT_KV, `rl:forgot-password-acct:${user.id}`, 3, 3600);
  if (!perAccountAllowed) return Response.json(GENERIC_RESPONSE);

  const token = crypto.randomUUID().replace(/-/g, "") + crypto.randomUUID().replace(/-/g, "");
  const now = Date.now();
  const expiresAt = now + 60 * 60 * 1000; // 1 hour

  await env.DB.prepare(
    "INSERT INTO password_resets (user_id, token, expires_at, used, created_at) VALUES (?, ?, ?, 0, ?)"
  ).bind(user.id, token, expiresAt, now).run();

  const resetUrl = `https://bloxdcode.com/?reset=${token}`;

  try {
    await sendEmail(env, {
      to: email,
      subject: "Reset your Bloxd Code password",
      html: `
        <p>Hi ${user.username},</p>
        <p>Someone requested a password reset for your Bloxd Code account. If this was you, click below to set a new password:</p>
        <p><a href="${resetUrl}">${resetUrl}</a></p>
        <p>This link expires in 1 hour. If you didn't request this, you can safely ignore this email.</p>
      `
    });
  } catch (e) {
    // Don't leak send failures to the client - still return the generic response.
  }

  return Response.json(GENERIC_RESPONSE);
}
