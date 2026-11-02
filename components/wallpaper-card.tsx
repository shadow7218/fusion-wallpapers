"use client";

import React, { useState } from "react";
import Image from "next/image";
import { motion } from "framer-motion";
import { Bookmark, Download, Check } from "lucide-react";

export interface Wallpaper {
  id: string;
  title: string;
  category?: string;
  image_url: string;
  thumbnail_url?: string;
  aspect_ratio?: string;
}

interface WallpaperCardProps {
  wallpaper: Wallpaper;
  onSelect: (wallpaper: Wallpaper) => void;
  isSaved?: boolean;
  onToggleSave?: (wallpaper: Wallpaper) => void;
}

export function WallpaperCard({
  wallpaper,
  onSelect,
  isSaved = false,
  onToggleSave,
}: WallpaperCardProps) {
  const [imageLoaded, setImageLoaded] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);
  const [downloadSuccess, setDownloadSuccess] = useState(false);

  const handleDownload = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (isDownloading || downloadSuccess) return;

    try {
      setIsDownloading(true);
      const response = await fetch(wallpaper.image_url);
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `${wallpaper.title.toLowerCase().replace(/\s+/g, "-")}-fusion.jpg`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);

      setDownloadSuccess(true);
      setTimeout(() => setDownloadSuccess(false), 2500);
    } catch (err) {
      console.error("Download failed:", err);
    } finally {
      setIsDownloading(false);
    }
  };

  const handleSave = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (onToggleSave) onToggleSave(wallpaper);
  };

  return (
    <motion.div
      layoutId={`wallpaper-container-${wallpaper.id}`}
      whileTap={{ scale: 0.975 }}
      transition={{ type: "spring", stiffness: 400, damping: 28 }}
      onClick={() => onSelect(wallpaper)}
      className="group relative cursor-pointer overflow-hidden rounded-2xl bg-zinc-950 border border-white/[0.08] aspect-[9/16] shadow-md select-none"
    >
      {/* Low-profile background OLED skeleton */}
      {!imageLoaded && (
        <div className="absolute inset-0 bg-zinc-950 animate-pulse" />
      )}

      {/* Shared image element */}
      <motion.div
        layoutId={`wallpaper-image-${wallpaper.id}`}
        className="relative w-full h-full"
      >
        <Image
          src={wallpaper.thumbnail_url || wallpaper.image_url}
          alt={wallpaper.title}
          fill
          sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 20vw"
          className={`object-cover transition-all duration-500 group-hover:scale-105 ${
            imageLoaded ? "opacity-100" : "opacity-0"
          }`}
          onLoad={() => setImageLoaded(true)}
          priority={false}
          loading="lazy"
        />
      </motion.div>

      {/* Liquid Glass Overlay on Card */}
      <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent opacity-80 group-hover:opacity-100 transition-opacity" />

      {/* Top right quick actions */}
      <div className="absolute top-2.5 right-2.5 flex items-center gap-1.5 opacity-90 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity">
        <button
          type="button"
          onClick={handleSave}
          aria-label={isSaved ? "Remove from saved" : "Save wallpaper"}
          className="p-2 rounded-full bg-black/60 backdrop-blur-md border border-white/10 hover:bg-white/20 active:scale-90 transition-all text-white"
        >
          <Bookmark
            className={`w-3.5 h-3.5 transition-colors ${
              isSaved ? "fill-white text-white" : "text-zinc-300"
            }`}
          />
        </button>

        <button
          type="button"
          onClick={handleDownload}
          aria-label="Download wallpaper"
          disabled={isDownloading}
          className="p-2 rounded-full bg-black/60 backdrop-blur-md border border-white/10 hover:bg-white/20 active:scale-90 transition-all text-white"
        >
          {downloadSuccess ? (
            <Check className="w-3.5 h-3.5 text-emerald-400" />
          ) : (
            <Download className="w-3.5 h-3.5 text-zinc-300" />
          )}
        </button>
      </div>

      {/* Card Details */}
      <div className="absolute bottom-3 inset-x-3">
        <p className="text-xs font-semibold text-white truncate drop-shadow-sm">
          {wallpaper.title}
        </p>
        {wallpaper.category && (
          <p className="text-[10px] text-zinc-400 uppercase tracking-wider mt-0.5 truncate">
            {wallpaper.category}
          </p>
        )}
      </div>
    </motion.div>
  );
}

export default WallpaperCard;
