/**
 * lib/db-server.ts  -  database reads that run on the SERVER (link previews).
 * Like lib/db.ts, this is the only place that knows which database is used.
 */
const SUPA = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const KEY = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!;

export interface SharedWallpaper {
  id: string;
  title: string;
  image_url: string;
}

export async function getWallpaperForShare(id: string): Promise<SharedWallpaper | null> {
  try {
    const res = await fetch(
      `${SUPA}/rest/v1/wallpapers?id=eq.${encodeURIComponent(id)}&select=id,title,image_url&limit=1`,
      { headers: { apikey: KEY }, next: { revalidate: 300 } }
    );
    if (!res.ok) return null;
    const rows = await res.json();
    return rows?.[0] ?? null;
  } catch {
    return null;
  }
}
