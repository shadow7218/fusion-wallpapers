import { fail, getSessionUser, getSql, json } from "@/lib/server/neon";

export const dynamic = "force-dynamic";
type Ctx = { params: Promise<{ id: string }> };

export async function GET(_req: Request, ctx: Ctx) {
  const { id } = await ctx.params;
  const rows = await getSql()`select * from wallpapers where id = ${id} limit 1`;
  return json(rows[0] ?? null);
}

/** Admin: change category / banner flag / tags / image link. Send only what changes. */
export async function PATCH(req: Request, ctx: Ctx) {
  const me = await getSessionUser();
  if (!me?.isAdmin) return fail("Admins only.", 403);
  const { id } = await ctx.params;
  const b = await req.json().catch(() => ({}));

  const hasCat = "category" in b;
  const hasBanner = "is_banner" in b;
  const hasTags = Array.isArray(b.tags);
  const cat = hasCat && b.category ? String(b.category) : null;
  const banner = !!b.is_banner;
  const tags: string[] = hasTags ? b.tags.map(String) : [];
  const url = typeof b.image_url === "string" ? b.image_url : null;
  const path = typeof b.storage_path === "string" ? b.storage_path : null;

  await getSql()`
    update wallpapers set
      category = case when ${hasCat}::boolean then ${cat}::text else category end,
      is_banner = case when ${hasBanner}::boolean then ${banner}::boolean else is_banner end,
      tags = case when ${hasTags}::boolean then ${tags}::text[] else tags end,
      image_url = coalesce(${url}::text, image_url),
      storage_path = coalesce(${path}::text, storage_path)
    where id = ${id}`;
  return json({ ok: true });
}

export async function DELETE(_req: Request, ctx: Ctx) {
  const me = await getSessionUser();
  if (!me?.isAdmin) return fail("Admins only.", 403);
  const { id } = await ctx.params;
  await getSql()`delete from wallpapers where id = ${id}`;
  return json({ ok: true });
}
