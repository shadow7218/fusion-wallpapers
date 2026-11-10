import { fail, getSessionUser, getSql, json } from "@/lib/server/neon";

export const dynamic = "force-dynamic";

/** Logged-in visitors only. Counts a download (same person + same wallpaper = once per 10 minutes). */
export async function POST(req: Request) {
  const me = await getSessionUser();
  if (!me) return fail("Please sign in.", 401);
  const b = await req.json().catch(() => null);
  const wid = b?.wallpaperId ? String(b.wallpaperId) : "";
  if (!wid) return fail("wallpaperId is required.");
  const sql = getSql();
  try {
    const rows = await sql`
      insert into download_events (wallpaper_id, user_id)
      select ${wid}, ${me.id}
      where not exists (
        select 1 from download_events
        where wallpaper_id = ${wid} and user_id = ${me.id}
          and created_at > now() - interval '10 minutes')
      returning id`;
    if (rows.length > 0) {
      await sql`update wallpapers set downloads = coalesce(downloads, 0) + 1 where id = ${wid}`;
    }
    return json({ ok: true, counted: rows.length > 0 });
  } catch {
    return fail("Could not count this download.", 404);
  }
}
