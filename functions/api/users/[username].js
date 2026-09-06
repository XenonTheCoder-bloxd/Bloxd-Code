export async function onRequestGet({ params, env }) {
  const username = (params.username || "").toLowerCase();

  const user = await env.DB.prepare(
    `SELECT id, username, bio, avatar, portfolio_bg, portfolio_audio, audio_title,
            custom_code, discord, github, xp, lessons, profile_views, created_at
     FROM users WHERE username = ?`
  ).bind(username).first();

  if (!user) {
    return Response.json({ error: "User not found." }, { status: 404 });
  }

  await env.DB.prepare("UPDATE users SET profile_views = profile_views + 1 WHERE id = ?").bind(user.id).run();

  return Response.json({ user });
}
