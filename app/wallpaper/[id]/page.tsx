import type { Metadata } from "next";
import OpenInApp from "@/components/OpenInApp";
import { ogImg } from "@/lib/img";

const SUPA = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const KEY = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!;

async function getWallpaper(id: string) {
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

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  const w = await getWallpaper(id);
  if (!w) return { title: "Wallpaper not found | Fusion Wallpapers" };

  const title = `${w.title} Wallpaper | Fusion Wallpapers`;
  const description = `Download "${w.title}" in high quality on Fusion Wallpapers. Anime, gaming, and aesthetic wallpapers for your phone and PC.`;
  const image = ogImg(w.image_url);

  return {
    title,
    description,
    openGraph: {
      title,
      description,
      url: `/wallpaper/${id}`,
      siteName: "Fusion Wallpapers",
      type: "website",
      images: [{ url: image }],
    },
    twitter: { card: "summary_large_image", title, description, images: [image] },
  };
}

export default async function WallpaperSharePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const w = await getWallpaper(id);
  return <OpenInApp id={id} title={w?.title} />;
}
