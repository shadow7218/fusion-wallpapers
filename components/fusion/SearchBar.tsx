"use client";

import React from "react";
import { Search, X } from "lucide-react";
import { GlassContainer } from "@/components/liquid-glass/LiquidGlass";

interface SearchBarProps {
  isLight: boolean;
  searchQuery: string;
  setSearchQuery: (value: string) => void;
  searchInputRef: React.RefObject<HTMLInputElement | null>;
}

export default function SearchBar({
  isLight,
  searchQuery,
  setSearchQuery,
  searchInputRef,
}: SearchBarProps) {
  return (
    <GlassContainer
      type="pill"
      tintOpacity={0.12}
      blurRadius={16}
      className="w-full h-11 px-4"
    >
      <div className="flex items-center w-full h-full">
        <Search
          className={`h-4 w-4 mr-3 shrink-0 ${
            isLight ? "text-[#0E2F76]/60" : "text-white/60"
          }`}
        />
        <input
          ref={searchInputRef}
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Search wallpapers, anime, moods..."
          className={`w-full bg-transparent text-xs sm:text-sm focus:outline-none font-medium ${
            isLight
              ? "text-[#0E2F76] placeholder:text-[#0E2F76]/45"
              : "text-white placeholder:text-white/45"
          }`}
        />
        {searchQuery ? (
          <button
            type="button"
            aria-label="Clear search"
            onClick={() => setSearchQuery("")}
            className={`p-1 ${
              isLight
                ? "text-[#0E2F76]/70 hover:text-[#0E2F76]"
                : "text-white/70 hover:text-white"
            }`}
          >
            <X className="h-4 w-4" />
          </button>
        ) : null}
      </div>
    </GlassContainer>
  );
}
