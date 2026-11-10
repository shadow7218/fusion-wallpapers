import { fail, getSessionUser, getSql, json } from "@/lib/server/neon";

export const dynamic = "force-dynamic";

const DEVICE_PHONE = "__device_phone__";
const DEVICE_PC = "__device_pc__";

const toSeries = (rows: any[]) => rows.map((r) => ({ day: String(r.day), n: Number(r.n) }));

/** Admin only: everything the dashboard shows. ?days=7|30|90 */
export async function GET(req: Request) {
  const me = await getSessionUser();
  if (!me?.isAdmin) return fail("Admins only.", 403);

  const raw = parseInt(new URL(req.url).searchParams.get("days") || "30", 10);
  const days = Math.min(365, Math.max(7, Number.isFinite(raw) ? raw : 30));
  const sql = getSql();

  // ---- totals ----
  const [tot] = await sql`
    select
      (select count(*) from wallpapers)::int as wallpapers,
      (select coalesce(sum(downloads), 0) from wallpapers)::int as downloads_all,
      (select count(*) from saved_wallpapers)::int as saves_all,
      (select count(*) from download_events where created_at >= now() - (${days}::int * interval '1 day'))::int as dl,
      (select count(*) from download_events
         where created_at >= now() - (${days * 2}::int * interval '1 day')
           and created_at <  now() - (${days}::int * interval '1 day'))::int as dl_prev,
      (select count(distinct user_id) from download_events where created_at >= now() - (${days}::int * interval '1 day'))::int as dl_users,
      (select count(*) from saved_wallpapers where created_at >= now() - (${days}::int * interval '1 day'))::int as sv,
      (select count(*) from saved_wallpapers
         where created_at >= now() - (${days * 2}::int * interval '1 day')
           and created_at <  now() - (${days}::int * interval '1 day'))::int as sv_prev`;

  // ---- users (from the login tables; harmless if unavailable) ----
  let users = { total: 0, period: 0, prev: 0 };
  let signups: any[] = [];
  try {
    const [u] = await sql`
      select count(*)::int as total,
        (count(*) filter (where "createdAt" >= now() - (${days}::int * interval '1 day')))::int as period,
        (count(*) filter (where "createdAt" >= now() - (${days * 2}::int * interval '1 day')
                           and "createdAt" <  now() - (${days}::int * interval '1 day')))::int as prev
      from neon_auth."user"`;
    users = { total: Number(u.total), period: Number(u.period), prev: Number(u.prev) };
    signups = await sql`
      select to_char(d::date, 'YYYY-MM-DD') as day, coalesce(c.n, 0)::int as n
      from generate_series((current_date - ${days - 1}::int)::timestamp, current_date::timestamp, interval '1 day') as d
      left join (
        select "createdAt"::date as day, count(*) as n from neon_auth."user"
        where "createdAt" >= (current_date - ${days - 1}::int)::timestamp group by 1
      ) c on c.day = d::date
      order by d`;
  } catch {
    signups = [];
  }

  // ---- per-day charts ----
  const dlSeries = await sql`
    select to_char(d::date, 'YYYY-MM-DD') as day, coalesce(c.n, 0)::int as n
    from generate_series((current_date - ${days - 1}::int)::timestamp, current_date::timestamp, interval '1 day') as d
    left join (
      select created_at::date as day, count(*) as n from download_events
      where created_at >= (current_date - ${days - 1}::int)::timestamp group by 1
    ) c on c.day = d::date
    order by d`;
  const svSeries = await sql`
    select to_char(d::date, 'YYYY-MM-DD') as day, coalesce(c.n, 0)::int as n
    from generate_series((current_date - ${days - 1}::int)::timestamp, current_date::timestamp, interval '1 day') as d
    left join (
      select created_at::date as day, count(*) as n from saved_wallpapers
      where created_at >= (current_date - ${days - 1}::int)::timestamp group by 1
    ) c on c.day = d::date
    order by d`;

  // ---- every wallpaper with its numbers ----
  const base = (await sql`
    select w.id, w.title, w.image_url, w.tags, w.category, w.created_at,
      coalesce(w.downloads, 0)::int as total_downloads,
      coalesce(e.n, 0)::int as period_downloads,
      coalesce(s.n, 0)::int as saves
    from wallpapers w
    left join (
      select wallpaper_id, count(*) as n from download_events
      where created_at >= now() - (${days}::int * interval '1 day') group by 1
    ) e on e.wallpaper_id = w.id
    left join (select wallpaper_id, count(*) as n from saved_wallpapers group by 1) s on s.wallpaper_id = w.id`) as any[];

  const rows = base.map((r) => ({
    id: String(r.id),
    title: String(r.title),
    image_url: String(r.image_url),
    tags: (r.tags as string[] | null) ?? null,
    category: (r.category as string | null) ?? null,
    created_at: new Date(r.created_at).toISOString(),
    total_downloads: Number(r.total_downloads),
    period_downloads: Number(r.period_downloads),
    saves: Number(r.saves),
  }));

  const topDownloaded = [...rows]
    .sort((a, b) => b.period_downloads - a.period_downloads || b.total_downloads - a.total_downloads)
    .slice(0, 10);
  const topSaved = [...rows].filter((r) => r.saves > 0).sort((a, b) => b.saves - a.saves).slice(0, 10);
  const cutoff = Date.now() - 14 * 24 * 60 * 60 * 1000;
  const attention = rows
    .filter((r) => new Date(r.created_at).getTime() < cutoff && r.total_downloads === 0 && r.saves === 0)
    .sort((a, b) => a.created_at.localeCompare(b.created_at))
    .slice(0, 10);
  const recent = [...rows].sort((a, b) => b.created_at.localeCompare(a.created_at)).slice(0, 5);

  const catMap = new Map<string, { category: string; wallpapers: number; downloads: number; saves: number }>();
  for (const r of rows) {
    const key = r.category || "uncategorized";
    const c = catMap.get(key) || { category: key, wallpapers: 0, downloads: 0, saves: 0 };
    c.wallpapers += 1;
    c.downloads += r.total_downloads;
    c.saves += r.saves;
    catMap.set(key, c);
  }
  const categories = Array.from(catMap.values()).sort((a, b) => b.downloads + b.saves - (a.downloads + a.saves));

  const devices = { phone: 0, pc: 0, unknown: 0 };
  for (const r of rows) {
    if (r.tags?.includes(DEVICE_PHONE)) devices.phone++;
    else if (r.tags?.includes(DEVICE_PC)) devices.pc++;
    else devices.unknown++;
  }

  return json({
    days,
    totals: {
      wallpapers: Number(tot.wallpapers),
      users: users.total,
      usersPeriod: users.period,
      usersPrev: users.prev,
      downloadsAll: Number(tot.downloads_all),
      downloadsPeriod: Number(tot.dl),
      downloadsPrev: Number(tot.dl_prev),
      uniqueDownloaders: Number(tot.dl_users),
      savesAll: Number(tot.saves_all),
      savesPeriod: Number(tot.sv),
      savesPrev: Number(tot.sv_prev),
    },
    series: { downloads: toSeries(dlSeries), saves: toSeries(svSeries), signups: toSeries(signups) },
    topDownloaded,
    topSaved,
    attention,
    recent,
    categories,
    devices,
  });
}
