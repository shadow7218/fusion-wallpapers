import { neon } from "@neondatabase/serverless";
import { betterAuth } from "better-auth";

if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL environment variable is missing.");
}

export const sql = neon(process.env.DATABASE_URL);

export const auth = betterAuth({
  database: sql,
  emailAndPassword: {
    enabled: true,
  },
  socialProviders: {
    google: {
      enabled: true,
      clientId: process.env.GOOGLE_CLIENT_ID || "",
      clientSecret: process.env.GOOGLE_CLIENT_SECRET || "",
    },
  },
});

// Function required by app/wallpaper/[id]/page.tsx for social sharing / dynamic routes
export async function getWallpaperForShare(id: string) {
  try {
    const rows = await sql`
      SELECT id, title, image_url, storage_path, category, is_banner, tags, downloads, created_at
      FROM wallpapers
      WHERE id = ${id}
      LIMIT 1
    `;
    return rows[0] || null;
  } catch (err) {
    console.error("Error in getWallpaperForShare:", err);
    return null;
  }
}

// Server functions for wallpapers
export async function serverListWallpapers() {
  const rows = await sql`
    SELECT id, title, image_url, storage_path, category, is_banner, tags, downloads, created_at
    FROM wallpapers
    ORDER BY created_at DESC
  `;
  return rows;
}

export async function serverGetWallpaper(id: string) {
  const rows = await sql`SELECT * FROM wallpapers WHERE id = ${id} LIMIT 1`;
  return rows[0] || null;
}

export async function serverCreateWallpaper(payload: {
  title: string;
  image_url: string;
  storage_path: string;
  category: string | null;
  is_banner?: boolean;
  tags?: string[];
}) {
  const rows = await sql`
    INSERT INTO wallpapers (title, image_url, storage_path, category, is_banner, tags)
    VALUES (
      ${payload.title}, 
      ${payload.image_url}, 
      ${payload.storage_path}, 
      ${payload.category}, 
      ${payload.is_banner ?? false}, 
      ${payload.tags ?? []}
    )
    RETURNING *
  `;
  return rows[0];
}

export async function serverUpdateWallpaperTags(id: string, tags: string[]) {
  await sql`
    UPDATE wallpapers
    SET tags = ${tags}
    WHERE id = ${id}
  `;
}

export async function serverUpdateWallpaperUrl(id: string, image_url: string, storage_path: string) {
  await sql`
    UPDATE wallpapers
    SET image_url = ${image_url}, storage_path = ${storage_path}
    WHERE id = ${id}
  `;
}

export async function serverUpdateWallpaperDetails(id: string, payload: {
  category: string | null;
  is_banner?: boolean;
  tags?: string[];
}) {
  await sql`
    UPDATE wallpapers
    SET 
      category = ${payload.category}, 
      is_banner = ${payload.is_banner ?? false}, 
      tags = ${payload.tags ?? []}
    WHERE id = ${id}
  `;
}

export async function serverDeleteWallpaper(id: string) {
  await sql`DELETE FROM wallpapers WHERE id = ${id}`;
}

export async function serverClearBanner(categoryId: string) {
  await sql`
    UPDATE wallpapers
    SET is_banner = false
    WHERE category = ${categoryId}
  `;
}

// Server functions for saved wallpapers
export async function serverListSavedIds(userId: string) {
  const rows = await sql`
    SELECT wallpaper_id FROM saved_wallpapers
    WHERE user_id = ${userId}
    ORDER BY created_at DESC
  `;
  return rows.map((r: any) => r.wallpaper_id as string);
}

export async function serverSaveWallpaper(userId: string, wallpaperId: string) {
  await sql`
    INSERT INTO saved_wallpapers (user_id, wallpaper_id)
    VALUES (${userId}, ${wallpaperId})
    ON CONFLICT (user_id, wallpaper_id) DO NOTHING
  `;
}

export async function serverUnsaveWallpaper(userId: string, wallpaperId: string) {
  await sql`
    DELETE FROM saved_wallpapers
    WHERE user_id = ${userId} AND wallpaper_id = ${wallpaperId}
  `;
}

// Server functions for profiles
export async function serverGetProfile(userId: string) {
  const rows = await sql`
    SELECT id, display_name FROM profiles WHERE id = ${userId} LIMIT 1
  `;
  return rows[0] || null;
}

export async function serverSaveProfileName(userId: string, displayName: string) {
  const rows = await sql`
    INSERT INTO profiles (id, display_name, updated_at)
    VALUES (${userId}, ${displayName}, NOW())
    ON CONFLICT (id) DO UPDATE
    SET display_name = EXCLUDED.display_name, updated_at = NOW()
    RETURNING id, display_name
  `;
  return rows[0];
}
