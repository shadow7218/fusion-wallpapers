import { fail, getSessionUser, getSql, json } from "@/lib/server/neon";

export const dynamic = "force-dynamic";

/** My saved wallpaper ids, newest first. */
export async function GET() {
  const me = await getSessionUser();
  if (!me) return json({ ids: [] });
  const rows = await getSql()`
    select wallpaper_id from saved_wallpapers where user_id = ${me.id} order by created_at desc`;
  return json({ ids: rows.map((r) => String(r.wallpaper_id)) });
}

export async function POST(req: Request) {
  const me = await getSessionUser();
  if (!me) return fail("Please sign in.", 401);
  const b = await req.json().catch(() => null);
  if (!b?.wallpaperId) return fail("wallpaperId is required.");
  await getSql()`
    insert into saved_wallpapers (user_id, wallpaper_id) values (${me.id}, ${String(b.wallpaperId)})
    on conflict (user_id, wallpaper_id) do nothing`;
  return json({ ok: true });
}

export async function DELETE(req: Request) {
  const me = await getSessionUser();
  if (!me) return fail("Please sign in.", 401);
  const wid = new URL(req.url).searchParams.get("wallpaperId");
  if (!wid) return fail("wallpaperId is required.");
  await getSql()`delete from saved_wallpapers where user_id = ${me.id} and wallpaper_id = ${wid}`;
  return json({ ok: true });
}
