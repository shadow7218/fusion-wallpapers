/**
 * lib/db-server.ts  -  database reads that run on the SERVER (link previews).
 * Like lib/db.ts, this is the only place that knows which database is used.
 */
import { neon } from "@neondatabase/serverless";

export interface SharedWallpaper {
  id: string;
  title: string;
  image_url: string;
}

export async function getWallpaperForShare(id: string): Promise<SharedWallpaper | null> {
  try {
    const url = process.env.DATABASE_URL;
    if (!url) return null;
    const sql = neon(url);
    const rows = await sql`select id, title, image_url from wallpapers where id = ${id} limit 1`;
    return (rows[0] as SharedWallpaper) ?? null;
  } catch {
    return null;
  }
}
