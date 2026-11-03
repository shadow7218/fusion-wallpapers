import type { Metadata } from "next";
import OpenInApp from "@/components/OpenInApp";
import { ogImg } from "@/lib/img";
import { getWallpaperForShare } from "@/lib/db-server";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  const w = await getWallpaperForShare(id);
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
  const w = await getWallpaperForShare(id);
  return <OpenInApp id={id} title={w?.title} />;
}
