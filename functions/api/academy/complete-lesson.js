import { verifySession, readCookie } from "../../_lib/auth.js";
import { checkRateLimit, rateLimitResponse } from "../../_lib/ratelimit.js";
import { LESSON_XP } from "../../_lib/lessons.js";

export async function onRequestPost({ request, env }) {
  const session = await verifySession(readCookie(request, "session"), env.SESSION_SECRET);
  if (!session) {
    return Response.json({ error: "You must be logged in." }, { status: 401 });
  }

  const allowed = await checkRateLimit(env.RATE_LIMIT_KV, `rl:complete-lesson:${session.uid}`, 10, 60);
  if (!allowed) return rateLimitResponse();

  const { lessonId } = await request.json().catch(() => ({}));
  const reward = LESSON_XP[lessonId];
  if (!reward) {
    return Response.json({ error: "Unknown lesson." }, { status: 400 });
  }

  const user = await env.DB.prepare("SELECT xp, lessons FROM users WHERE id = ?").bind(session.uid).first();
  if (!user) {
    return Response.json({ error: "User not found." }, { status: 404 });
  }

  let completed = [];
  try { completed = JSON.parse(user.lessons || "[]"); } catch { completed = []; }

  if (completed.includes(lessonId)) {
    return Response.json({ xp: user.xp || 0, awarded: 0, alreadyCompleted: true });
  }

  completed.push(lessonId);
  const newXp = (user.xp || 0) + reward;

  await env.DB.prepare("UPDATE users SET xp = ?, lessons = ? WHERE id = ?")
    .bind(newXp, JSON.stringify(completed), session.uid)
    .run();

  return Response.json({ xp: newXp, awarded: reward, alreadyCompleted: false });
}
