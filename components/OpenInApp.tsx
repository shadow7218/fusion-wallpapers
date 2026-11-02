"use client";
import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function OpenInApp({ id, title }: { id: string; title?: string }) {
  const router = useRouter();
  useEffect(() => {
    router.replace(`/?w=${encodeURIComponent(id)}`);
  }, [id, router]);

  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-3 bg-black px-6 text-center text-white">
      <p className="text-sm font-semibold">{title ?? "Fusion Wallpapers"}</p>
      <p className="text-xs text-white/50">Opening wallpaper…</p>
      <a href={`/?w=${encodeURIComponent(id)}`} className="text-xs underline">
        Tap here if it doesn&apos;t open
      </a>
    </div>
  );
}
