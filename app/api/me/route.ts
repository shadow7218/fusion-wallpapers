import { fail, getSessionUser, getSql, json } from "@/lib/server/neon";

export const dynamic = "force-dynamic";

/** Current user + profile. { user: null } when logged out. */
export async function GET() {
  const me = await getSessionUser();
  if (!me) return json({ user: null });
  const sql = getSql();

  const rows = await sql`
    select display_name, avatar_id, email_notifications
    from profiles where id = ${me.id}`;
  const p = rows[0];

  let providers: string[] = [];
  try {
    const acc = await sql`
      select "providerId" as provider from neon_auth.account where "userId"::text = ${me.id}`;
    providers = Array.from(new Set(acc.map((r) => String(r.provider))));
  } catch {
    providers = [];
  }

  return json({
    user: {
      id: me.id,
      email: me.email || null,
      avatarId: p?.avatar_id ?? null,
      emailNotifications: p?.email_notifications !== false,
      providers,
      isAdmin: me.isAdmin,
    },
    profile: p?.display_name ? { id: me.id, display_name: p.display_name } : null,
  });
}

/** Update display name / avatar / email notifications. */
export async function PATCH(req: Request) {
  const me = await getSessionUser();
  if (!me) return fail("Please sign in.", 401);
  const body = await req.json().catch(() => ({}));
  const dn = typeof body.display_name === "string" ? body.display_name.trim().slice(0, 60) : null;
  const av = typeof body.avatar_id === "string" ? body.avatar_id.slice(0, 40) : null;
  const en = typeof body.email_notifications === "boolean" ? body.email_notifications : null;
  const sql = getSql();
  await sql`
    insert into profiles (id, display_name, avatar_id, email_notifications, updated_at)
    values (${me.id}, ${dn}::text, ${av}::text, coalesce(${en}::boolean, true), now())
    on conflict (id) do update set
      display_name = coalesce(${dn}::text, profiles.display_name),
      avatar_id = coalesce(${av}::text, profiles.avatar_id),
      email_notifications = coalesce(${en}::boolean, profiles.email_notifications),
      updated_at = now()`;
  return json({ ok: true });
}

/** Delete my data and (if possible) my login. */
export async function DELETE() {
  const me = await getSessionUser();
  if (!me) return fail("Please sign in.", 401);
  const sql = getSql();
  await sql`delete from saved_wallpapers where user_id = ${me.id}`;
  await sql`delete from profiles where id = ${me.id}`;
  let authRemoved = false;
  try {
    await sql`delete from neon_auth."user" where id::text = ${me.id}`;
    authRemoved = true;
  } catch {
    authRemoved = false;
  }
  return json({ ok: true, authRemoved });
}
