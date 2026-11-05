import { fail, getSessionUser, getSql, json } from "@/lib/server/neon";

export const dynamic = "force-dynamic";

/** All wallpapers (newest first). ?category=X returns { has: true/false }. */
export async function GET(req: Request) {
  const sql = getSql();
  const category = new URL(req.url).searchParams.get("category");
  if (category) {
    const rows = await sql`select id from wallpapers where category = ${category} limit 1`;
    return json({ has: rows.length > 0 });
  }
  const rows = await sql`select * from wallpapers order by created_at desc`;
  return json(rows);
}

/** Admin: add a wallpaper row. */
export async function POST(req: Request) {
  const me = await getSessionUser();
  if (!me?.isAdmin) return fail("Admins only.", 403);
  const b = await req.json().catch(() => null);
  if (!b?.title || !b?.image_url) return fail("title and image_url are required.");
  const sql = getSql();
  const tags: string[] = Array.isArray(b.tags) ? b.tags.map(String) : [];
  const rows = await sql`
    insert into wallpapers (title, image_url, storage_path, category, is_banner, tags)
    values (${String(b.title)}, ${String(b.image_url)}, ${b.storage_path ? String(b.storage_path) : null},
            ${b.category ? String(b.category) : null}, ${!!b.is_banner}, ${tags}::text[])
    returning *`;
  return json(rows[0]);
}

/** Admin: { action: "clearBanner", category } */
export async function PATCH(req: Request) {
  const me = await getSessionUser();
  if (!me?.isAdmin) return fail("Admins only.", 403);
  const b = await req.json().catch(() => null);
  if (b?.action === "clearBanner" && b?.category) {
    const sql = getSql();
    await sql`update wallpapers set is_banner = false where category = ${String(b.category)}`;
    return json({ ok: true });
  }
  return fail("Unknown action.");
}
