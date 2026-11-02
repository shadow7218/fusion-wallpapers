"use client";

import React, { useState } from "react";
import Image from "next/image";
import { motion, AnimatePresence } from "framer-motion";
import { X, Download, Bookmark, Maximize2, Minimize2, Check } from "lucide-react";
import { Wallpaper } from "./wallpaper-card";

interface WallpaperModalProps {
  wallpaper: Wallpaper | null;
  onClose: () => void;
  isSaved?: boolean;
  onToggleSave?: (wallpaper: Wallpaper) => void;
}

export function WallpaperModal({
  wallpaper,
  onClose,
  isSaved = false,
  onToggleSave,
}: WallpaperModalProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [downloadSuccess, setDownloadSuccess] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);

  if (!wallpaper) return null;

  const handleDownload = async () => {
    if (isDownloading || downloadSuccess) return;
    try {
      setIsDownloading(true);
      const res = await fetch(wallpaper.image_url);
      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `${wallpaper.title.toLowerCase().replace(/\s+/g, "-")}-4k.jpg`;
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

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-0 sm:p-4 overflow-hidden">
        {/* Dimmer backdrop */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.3 }}
          onClick={onClose}
          className="absolute inset-0 bg-black/90 backdrop-blur-2xl"
        />

        {/* Floating Top Close Button */}
        <motion.button
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.8 }}
          onClick={onClose}
          type="button"
          aria-label="Close modal"
          className="absolute top-5 right-5 z-20 p-2.5 rounded-full bg-white/[0.08] hover:bg-white/[0.15] border border-white/10 text-white backdrop-blur-xl active:scale-95 transition-all"
        >
          <X className="w-5 h-5" />
        </motion.button>

        {/* Modal Container */}
        <motion.div
          layoutId={`wallpaper-container-${wallpaper.id}`}
          transition={{ type: "spring", stiffness: 350, damping: 30 }}
          className={`relative z-10 w-full h-full flex flex-col items-center justify-center ${
            isExpanded ? "max-w-none max-h-none" : "max-w-md max-h-[88vh]"
          } transition-all duration-300`}
        >
          {/* Main Visual Frame */}
          <div
            className={`relative w-full h-full overflow-hidden transition-all duration-300 ${
              isExpanded
                ? "rounded-none"
                : "rounded-3xl border border-white/[0.1] shadow-2xl"
            }`}
          >
            <motion.div
              layoutId={`wallpaper-image-${wallpaper.id}`}
              className="relative w-full h-full"
            >
              <Image
                src={wallpaper.image_url}
                alt={wallpaper.title}
                fill
                priority
                className={`transition-all duration-300 ${
                  isExpanded ? "object-contain" : "object-cover"
                }`}
                sizes="(max-width: 768px) 100vw, 800px"
              />
            </motion.div>
          </div>

          {/* Floating Liquid Glass Control Bar */}
          <motion.div
            initial={{ y: 20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 20, opacity: 0 }}
            transition={{ delay: 0.1, duration: 0.25 }}
            className="absolute bottom-6 inset-x-4 max-w-sm mx-auto flex items-center justify-between px-4 py-3 rounded-2xl bg-black/75 backdrop-blur-2xl border border-white/[0.12] shadow-2xl"
          >
            <div>
              <h2 className="text-sm font-semibold text-white truncate max-w-[140px]">
                {wallpaper.title}
              </h2>
              {wallpaper.category && (
                <p className="text-[11px] text-zinc-400 uppercase tracking-wider">
                  {wallpaper.category}
                </p>
              )}
            </div>

            <div className="flex items-center gap-2">
              {/* Expand to fit ratio toggle */}
              <button
                type="button"
                onClick={() => setIsExpanded(!isExpanded)}
                aria-label="Toggle fit mode"
                className="p-2 rounded-xl bg-white/[0.06] hover:bg-white/[0.12] text-zinc-300 active:scale-95 transition-all"
              >
                {isExpanded ? (
                  <Minimize2 className="w-4 h-4" />
                ) : (
                  <Maximize2 className="w-4 h-4" />
                )}
              </button>

              {/* Bookmark Save */}
              <button
                type="button"
                onClick={() => onToggleSave && onToggleSave(wallpaper)}
                aria-label="Save wallpaper"
                className="p-2 rounded-xl bg-white/[0.06] hover:bg-white/[0.12] text-zinc-300 active:scale-95 transition-all"
              >
                <Bookmark
                  className={`w-4 h-4 ${
                    isSaved ? "fill-white text-white" : ""
                  }`}
                />
              </button>

              {/* Download with Success State */}
              <button
                type="button"
                onClick={handleDownload}
                disabled={isDownloading}
                className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-white text-black font-medium text-xs hover:bg-zinc-200 active:scale-95 transition-all"
              >
                {downloadSuccess ? (
                  <>
                    <Check className="w-3.5 h-3.5 text-emerald-600 stroke-[3]" />
                    <span className="text-emerald-700">Saved</span>
                  </>
                ) : (
                  <>
                    <Download className="w-3.5 h-3.5" />
                    <span>Download</span>
                  </>
                )}
              </button>
            </div>
          </motion.div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}

export default WallpaperModal;
