"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowLeft, Bookmark, Download, Image as ImageIcon, Loader2, Moon, RefreshCw, Smartphone,
  Monitor, Sun, Users, AlertTriangle, TrendingUp, TrendingDown,
} from "lucide-react";
import { db, type AdminStats, type AdminWallpaperRow, type DayPoint } from "@/lib/db";
import { img } from "@/lib/img";

const applyTheme = (t: "dark" | "light") => {
  document.documentElement.classList.toggle("theme-light", t === "light");
  document.body.classList.toggle("theme-light", t === "light");
};

const RANGES = [7, 30, 90];

const fmt = (n: number) => (n >= 10000 ? `${(n / 1000).toFixed(1)}k` : String(n));
const niceDay = (d: string) =>
  new Date(`${d}T00:00:00`).toLocaleDateString(undefined, { month: "short", day: "numeric" });

function Delta({ cur, prev }: { cur: number; prev: number }) {
  if (prev === 0 && cur === 0) return <span className="ad-muted text-[11px]">no change</span>;
  if (prev === 0) return <span className="ad-up text-[11px] font-bold">new</span>;
  const pct = Math.round(((cur - prev) / prev) * 100);
  const up = pct >= 0;
  return (
    <span className={`${up ? "ad-up" : "ad-down"} inline-flex items-center gap-0.5 text-[11px] font-bold`}>
      {up ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
      {up ? "+" : ""}
      {pct}%
    </span>
  );
}

function Kpi({
  icon, label, value, sub, cur, prev,
}: { icon: React.ReactNode; label: string; value: number; sub: string; cur?: number; prev?: number }) {
  return (
    <div className="ad-card p-4">
      <div className="ad-muted flex items-center gap-2 text-xs font-semibold">
        {icon}
        {label}
      </div>
      <div className="mt-2 text-3xl font-extrabold tracking-tight">{fmt(value)}</div>
      <div className="mt-1 flex items-center gap-2">
        <span className="ad-muted text-[11px]">{sub}</span>
        {cur !== undefined && prev !== undefined && <Delta cur={cur} prev={prev} />}
      </div>
    </div>
  );
}

function AreaChart({ data, color, id, unit }: { data: DayPoint[]; color: string; id: string; unit: string }) {
  const [active, setActive] = useState<number | null>(null);

  if (data.length === 0) {
    return <p className="ad-muted py-8 text-center text-xs">No data yet.</p>;
  }
  const W = 320, H = 130, P = 8, TOP = 16;
  const max = Math.max(1, ...data.map((d) => d.n));
  const step = data.length > 1 ? (W - P * 2) / (data.length - 1) : 0;
  const pts = data.map((d, i) => [P + i * step, H - P - (d.n / max) * (H - P - TOP)] as const);
  const line = pts.map((p, i) => `${i ? "L" : "M"}${p[0].toFixed(1)},${p[1].toFixed(1)}`).join(" ");
  const area = `${line} L${pts[pts.length - 1][0].toFixed(1)},${H - P} L${pts[0][0].toFixed(1)},${H - P} Z`;
  const peakIdx = data.reduce((best, d, i) => (d.n > data[best].n ? i : best), 0);
  const total = data.reduce((s, d) => s + d.n, 0);

  // finger / mouse position -> nearest day
  const pick = (e: React.PointerEvent<HTMLDivElement>) => {
    const r = e.currentTarget.getBoundingClientRect();
    const x = ((e.clientX - r.left) / r.width) * W;
    const i = step === 0 ? 0 : Math.round((x - P) / step);
    setActive(Math.min(data.length - 1, Math.max(0, i)));
  };

  const shown = active ?? peakIdx;
  const sp = pts[shown];
  const tipLeft = Math.min(86, Math.max(14, (sp[0] / W) * 100));

  return (
    <div>
      <div
        className="relative select-none"
        style={{ touchAction: "pan-y" }}
        onPointerDown={pick}
        onPointerMove={(e) => {
          if (e.pointerType === "mouse" || e.buttons > 0) pick(e);
        }}
        onPointerLeave={(e) => {
          if (e.pointerType === "mouse") setActive(null);
        }}
      >
        {active !== null && (
          <div
            className="ad-tip pointer-events-none absolute z-10"
            style={{ left: `${tipLeft}%`, top: 0, transform: "translateX(-50%)" }}
          >
            <span className="block text-[10px] opacity-70">{niceDay(data[active].day)}</span>
            <span className="block text-sm font-extrabold leading-tight">
              {data[active].n} {unit}
            </span>
          </div>
        )}
        <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img" aria-label="chart">
          <defs>
            <linearGradient id={id} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={color} stopOpacity="0.35" />
              <stop offset="100%" stopColor={color} stopOpacity="0" />
            </linearGradient>
          </defs>
          {[0.25, 0.5, 0.75].map((g) => (
            <line key={g} x1={P} x2={W - P} y1={TOP + (H - P - TOP) * g} y2={TOP + (H - P - TOP) * g} stroke="currentColor" opacity="0.08" />
          ))}
          <path d={area} fill={`url(#${id})`} />
          <path d={line} fill="none" stroke={color} strokeWidth="2.2" strokeLinejoin="round" strokeLinecap="round" />
          {active !== null && (
            <line x1={sp[0]} x2={sp[0]} y1={TOP - 4} y2={H - P} stroke={color} strokeWidth="1" strokeDasharray="3 3" opacity="0.8" />
          )}
          {(active !== null || data[peakIdx].n > 0) && (
            <circle cx={sp[0]} cy={sp[1]} r={active !== null ? 5 : 3.5} fill={color} stroke="var(--ad-card)" strokeWidth="2" />
          )}
        </svg>
      </div>
      <div className="ad-muted mt-1 flex items-center justify-between gap-2 text-[10px]">
        <span className="shrink-0">{niceDay(data[0].day)}</span>
        <span className="min-w-0 truncate text-center">
          {active !== null ? "Touch and drag to explore" : `${total} total · peak ${data[peakIdx].n} on ${niceDay(data[peakIdx].day)} · touch the graph`}
        </span>
        <span className="shrink-0">{niceDay(data[data.length - 1].day)}</span>
      </div>
    </div>
  );
}

const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? "" : "s"}`;

function WallpaperList({
  rows, metric, empty,
}: { rows: AdminWallpaperRow[]; metric: "period" | "saves" | "age"; empty: string }) {
  if (rows.length === 0) return <p className="ad-muted py-4 text-center text-xs">{empty}</p>;
  const max = Math.max(1, ...rows.map((r) => (metric === "saves" ? r.saves : r.period_downloads)));
  return (
    <ul className="space-y-3">
      {rows.map((r, i) => {
        const value = metric === "saves" ? r.saves : r.period_downloads;
        return (
          <li key={r.id}>
            <a href={`/wallpaper/${r.id}`} className="flex items-center gap-3">
              <span className="ad-muted w-4 text-xs font-bold">{i + 1}</span>
              <img src={img(r, 120)} alt="" className="h-14 w-10 shrink-0 rounded-lg object-cover" />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold">{r.title}</p>
                <p className="ad-muted truncate text-[11px] capitalize">{(r.category || "uncategorized").replace(/-/g, " ")}</p>
                <p className="ad-muted text-[11px] leading-snug">
                  {plural(r.total_downloads, "download")} · {plural(r.saves, "save")}
                  {metric === "age" && ` · added ${niceDay(r.created_at.slice(0, 10))}`}
                </p>
                {metric !== "age" && (
                  <div className="ad-bar mt-1.5">
                    <span style={{ width: `${Math.max(4, (value / max) * 100)}%` }} />
                  </div>
                )}
              </div>
              {metric !== "age" && <span className="text-sm font-extrabold">{fmt(value)}</span>}
            </a>
          </li>
        );
      })}
    </ul>
  );
}

export default function AdminPage() {
  const router = useRouter();
  const [ready, setReady] = useState(false);
  const [days, setDays] = useState(30);
  const [stats, setStats] = useState<AdminStats | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [theme, setTheme] = useState<"dark" | "light">("dark");

  const load = async (d: number) => {
    setLoading(true);
    setError(null);
    try {
      setStats(await db.getAdminStats(d));
    } catch (e: any) {
      setError(e?.message || "Could not load the dashboard.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const t = localStorage.getItem("fusion-theme") === "light" ? "light" : "dark";
    setTheme(t);
    applyTheme(t);
    (async () => {
      const u = await db.getCurrentUser();
      if (!u?.isAdmin) {
        router.replace("/");
        return;
      }
      setReady(true);
      load(30);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const toggleTheme = () => {
    const t = theme === "dark" ? "light" : "dark";
    setTheme(t);
    applyTheme(t);
    localStorage.setItem("fusion-theme", t);
  };

  const pickRange = (d: number) => {
    setDays(d);
    load(d);
  };

  if (!ready) {
    return (
      <div className="ad-root flex min-h-screen items-center justify-center">
        <style>{css}</style>
        <Loader2 className="h-6 w-6 animate-spin" />
      </div>
    );
  }

  const t = stats?.totals;
  const maxCat = Math.max(1, ...(stats?.categories.map((c) => c.downloads + c.saves) ?? [1]));
  const devTotal = stats ? Math.max(1, stats.devices.phone + stats.devices.pc + stats.devices.unknown) : 1;

  return (
    <div className="ad-root min-h-screen overflow-x-hidden">
      <style>{css}</style>
      <div className="mx-auto w-full max-w-5xl px-3 pb-16 pt-4 md:px-4">
        {/* top bar */}
        <div className="flex items-center justify-between gap-2">
          <button type="button" aria-label="Back" onClick={() => router.push("/")} className="ad-circle">
            <ArrowLeft className="h-5 w-5" />
          </button>
          <h1 className="text-lg font-extrabold">Admin dashboard</h1>
          <div className="flex gap-2">
            <button type="button" aria-label="Refresh" onClick={() => load(days)} className="ad-circle">
              <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
            </button>
            <button type="button" aria-label="Switch light or dark" onClick={toggleTheme} className="ad-circle">
              {theme === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
            </button>
          </div>
        </div>

        {/* range */}
        <div className="mt-4 flex gap-2">
          {RANGES.map((r) => (
            <button
              key={r}
              type="button"
              onClick={() => pickRange(r)}
              className={`ad-chip ${days === r ? "ad-chip-on" : ""}`}
            >
              Last {r} days
            </button>
          ))}
        </div>

        {error && <p className="ad-card mt-4 p-3 text-sm ad-down">{error}</p>}
        {!stats && loading && (
          <div className="flex justify-center py-20">
            <Loader2 className="h-6 w-6 animate-spin" />
          </div>
        )}

        {stats && t && (
          <div className={`mt-4 space-y-4 transition-opacity ${loading ? "opacity-60" : ""}`}>
            {/* KPIs */}
            <div className="ad-grid grid grid-cols-2 gap-3 md:grid-cols-4">
              <Kpi icon={<Download className="h-4 w-4" />} label="Downloads" value={t.downloadsPeriod} sub={`${fmt(t.downloadsAll)} all time`} cur={t.downloadsPeriod} prev={t.downloadsPrev} />
              <Kpi icon={<Bookmark className="h-4 w-4" />} label="Saves" value={t.savesPeriod} sub={`${fmt(t.savesAll)} all time`} cur={t.savesPeriod} prev={t.savesPrev} />
              <Kpi icon={<Users className="h-4 w-4" />} label="New users" value={t.usersPeriod} sub={`${fmt(t.users)} total`} cur={t.usersPeriod} prev={t.usersPrev} />
              <Kpi icon={<ImageIcon className="h-4 w-4" />} label="Wallpapers" value={t.wallpapers} sub={`${t.uniqueDownloaders} people downloaded`} />
            </div>

            {/* charts */}
            <div className="ad-grid grid gap-3 md:grid-cols-2">
              <div className="ad-card p-4">
                <h2 className="mb-2 text-sm font-extrabold">Downloads per day</h2>
                <AreaChart data={stats.series.downloads} color="#6d8bff" id="g-dl" unit="downloads" />
              </div>
              <div className="ad-card p-4">
                <h2 className="mb-2 text-sm font-extrabold">Saves per day</h2>
                <AreaChart data={stats.series.saves} color="#ff7aa8" id="g-sv" unit="saves" />
              </div>
            </div>
            <div className="ad-card p-4">
              <h2 className="mb-2 text-sm font-extrabold">New users per day</h2>
              <AreaChart data={stats.series.signups} color="#3fd6a0" id="g-us" unit="new users" />
            </div>

            {/* performance */}
            <div className="ad-grid grid gap-3 md:grid-cols-2">
              <div className="ad-card p-4">
                <h2 className="mb-3 text-sm font-extrabold">Top downloaded ({days} days)</h2>
                <WallpaperList rows={stats.topDownloaded.filter((r) => r.period_downloads > 0)} metric="period" empty="No downloads in this period yet." />
              </div>
              <div className="ad-card p-4">
                <h2 className="mb-3 text-sm font-extrabold">Most saved (all time)</h2>
                <WallpaperList rows={stats.topSaved} metric="saves" empty="Nothing saved yet." />
              </div>
            </div>

            {/* categories + devices */}
            <div className="ad-grid grid gap-3 md:grid-cols-2">
              <div className="ad-card p-4">
                <h2 className="mb-3 text-sm font-extrabold">Category performance</h2>
                <ul className="space-y-3">
                  {stats.categories.map((c) => (
                    <li key={c.category}>
                      <div className="flex items-center justify-between gap-2">
                        <span className="min-w-0 truncate text-sm font-semibold capitalize">{c.category.replace(/-/g, " ")}</span>
                        <span className="shrink-0 text-sm font-extrabold">{c.downloads + c.saves}</span>
                      </div>
                      <p className="ad-muted mt-0.5 text-[11px] leading-snug">
                        {plural(c.wallpapers, "wallpaper")} · {plural(c.downloads, "download")} · {plural(c.saves, "save")}
                      </p>
                      <div className="ad-bar mt-1.5">
                        <span style={{ width: `${Math.max(3, ((c.downloads + c.saves) / maxCat) * 100)}%` }} />
                      </div>
                    </li>
                  ))}
                </ul>
              </div>
              <div className="space-y-3">
                <div className="ad-card p-4">
                  <h2 className="mb-3 text-sm font-extrabold">Phone vs PC wallpapers</h2>
                  <div className="ad-split">
                    <span style={{ width: `${(stats.devices.phone / devTotal) * 100}%`, background: "#6d8bff" }} />
                    <span style={{ width: `${(stats.devices.pc / devTotal) * 100}%`, background: "#ff7aa8" }} />
                    <span style={{ width: `${(stats.devices.unknown / devTotal) * 100}%`, background: "#8a8f9a" }} />
                  </div>
                  <div className="ad-muted mt-2 flex flex-wrap gap-x-4 gap-y-1 text-[11px]">
                    <span className="inline-flex items-center gap-1"><Smartphone className="h-3 w-3" /> Phone {stats.devices.phone}</span>
                    <span className="inline-flex items-center gap-1"><Monitor className="h-3 w-3" /> PC {stats.devices.pc}</span>
                    <span>Untagged {stats.devices.unknown}</span>
                  </div>
                </div>
                <div className="ad-card p-4">
                  <h2 className="mb-3 text-sm font-extrabold">Recently added</h2>
                  <WallpaperList rows={stats.recent} metric="age" empty="No wallpapers yet." />
                </div>
              </div>
            </div>

            {/* needs attention */}
            <div className="ad-card p-4">
              <h2 className="mb-1 flex items-center gap-2 text-sm font-extrabold">
                <AlertTriangle className="h-4 w-4" /> Needs attention
              </h2>
              <p className="ad-muted mb-3 text-[11px]">
                Older than 14 days with no downloads and no saves. Consider a better title, a different category, or removing them.
              </p>
              <WallpaperList rows={stats.attention} metric="age" empty="Nice, every older wallpaper has been downloaded or saved." />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

const css = `
.ad-root{--ad-bg:#05060a;--ad-card:#0d0f15;--ad-line:rgba(255,255,255,.10);--ad-text:#f4f5f8;--ad-muted:rgba(244,245,248,.58);
  --ad-up:#3fd6a0;--ad-down:#ff7a85;--ad-track:rgba(255,255,255,.10);--ad-fill:#f4f5f8;
  background:var(--ad-bg);color:var(--ad-text)}
.theme-light .ad-root{--ad-bg:#E9F0F9;--ad-card:#ffffff;--ad-line:rgba(14,47,118,.16);--ad-text:#0E2F76;--ad-muted:rgba(14,47,118,.62);
  --ad-up:#0f9d6b;--ad-down:#c4283a;--ad-track:rgba(14,47,118,.12);--ad-fill:#0E2F76}
.ad-card{background:var(--ad-card);border:1px solid var(--ad-line);border-radius:22px;min-width:0;overflow:hidden}
.ad-grid > *{min-width:0}
.ad-tip{padding:6px 10px;border-radius:12px;background:var(--ad-text);color:var(--ad-bg);white-space:nowrap;
  box-shadow:0 6px 18px rgba(0,0,0,.35)}
.theme-light .ad-card{box-shadow:0 1px 2px rgba(14,47,118,.08),0 8px 22px rgba(14,47,118,.10)}
.ad-muted{color:var(--ad-muted)}
.ad-up{color:var(--ad-up)}
.ad-down{color:var(--ad-down)}
.ad-circle{display:flex;height:42px;width:42px;align-items:center;justify-content:center;border-radius:9999px;
  background:var(--ad-card);border:1px solid var(--ad-line);color:var(--ad-text);transition:transform .3s cubic-bezier(.34,1.4,.64,1)}
.ad-circle:active{transform:scale(.92)}
.ad-chip{height:36px;padding:0 14px;border-radius:9999px;font-size:12px;font-weight:700;background:var(--ad-card);
  border:1px solid var(--ad-line);color:var(--ad-text);transition:transform .25s}
.ad-chip:active{transform:scale(.95)}
.ad-chip-on{background:var(--ad-fill);color:var(--ad-bg);border-color:transparent}
.ad-bar{height:6px;border-radius:9999px;background:var(--ad-track);overflow:hidden}
.ad-bar span{display:block;height:100%;border-radius:9999px;background:var(--ad-fill)}
.ad-split{display:flex;height:10px;border-radius:9999px;overflow:hidden;background:var(--ad-track)}
.ad-split span{display:block;height:100%}
`;
