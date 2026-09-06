export async function onRequestGet({ env }) {
  const { results } = await env.DB.prepare(
    `SELECT username, bio, avatar, avatar_zoom, avatar_pos_x, avatar_pos_y, xp, lessons, profile_views
     FROM users ORDER BY xp DESC LIMIT 200`
  ).all();

  return Response.json({ users: results });
}
