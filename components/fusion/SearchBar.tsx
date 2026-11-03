"use client";

import React, { useState, useEffect } from "react";
import { Search, X } from "lucide-react";
import { GlassContainer, GlassButton } from "@/components/liquid-glass/LiquidGlass";

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
  const [isScrolled, setIsScrolled] = useState(false);
  const [isMobileOpen, setIsMobileOpen] = useState(false);

  useEffect(() => {
    const handleScroll = () => {
      const scrolled = window.scrollY > 65;
      setIsScrolled(scrolled);
      if (!scrolled && isMobileOpen) {
        setIsMobileOpen(false);
      }
    };

    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, [isMobileOpen]);

  const handleToggle = () => {
    const nextState = !isMobileOpen;
    setIsMobileOpen(nextState);
    if (nextState) {
      setTimeout(() => {
        searchInputRef.current?.focus();
      }, 100);
    }
  };

  return (
    <>
      {/* ================= DESKTOP & INLINE TOP SEARCHBAR ================= */}
      <div className={`w-full transition-all duration-300 ${isScrolled ? "hidden md:block" : "block"}`}>
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
                className={`p-1 transition-transform active:scale-90 ${
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
      </div>

      {/* ================= MOBILE FLOATING LIQUID GLASS SEARCH TOGGLE ================= */}
      {isScrolled && (
        <div className="md:hidden fixed top-3.5 right-3.5 z-40">
          {!isMobileOpen ? (
            <div className="search-toggle-enter">
              <GlassButton
                typeShape="circle"
                size={44}
                tintOpacity={0.24}
                blurRadius={22}
                aria-label="Open Search"
                onClick={handleToggle}
                className={`shadow-[0_8px_24px_rgba(0,0,0,0.55)] transition-all active:scale-90 duration-200 ${
                  isLight ? "border-[#0E2F76]/20 bg-[#F4FEFF]/85 text-[#0E2F76]" : "border-white/20 bg-black/60 text-white"
                }`}
              >
                <Search className="h-5 w-5" />
              </GlassButton>
            </div>
          ) : (
            <div className="fixed inset-x-3.5 top-3 z-50 search-expand-enter">
              <GlassContainer
                type="pill"
                tintOpacity={0.28}
                blurRadius={24}
                className={`w-full h-12 px-4 shadow-[0_12px_32px_rgba(0,0,0,0.6)] border ${
                  isLight ? "bg-[#F4FEFF]/95 border-[#0E2F76]/25" : "bg-black/80 border-white/25"
                }`}
              >
                <div className="flex items-center w-full h-full">
                  <Search
                    className={`h-4 w-4 mr-2.5 shrink-0 ${
                      isLight ? "text-[#0E2F76]/70" : "text-white/70"
                    }`}
                  />
                  <input
                    ref={searchInputRef}
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Search wallpapers..."
                    className={`w-full bg-transparent text-xs focus:outline-none font-medium ${
                      isLight
                        ? "text-[#0E2F76] placeholder:text-[#0E2F76]/50"
                        : "text-white placeholder:text-white/50"
                    }`}
                  />
                  {searchQuery ? (
                    <button
                      type="button"
                      aria-label="Clear query"
                      onClick={() => setSearchQuery("")}
                      className="p-1 mr-1"
                    >
                      <X className={`h-3.5 w-3.5 ${isLight ? "text-[#0E2F76]/70" : "text-white/70"}`} />
                    </button>
                  ) : null}
                  <button
                    type="button"
                    aria-label="Close search"
                    onClick={handleToggle}
                    className={`ml-1 h-7 w-7 rounded-full flex items-center justify-center transition-transform active:scale-90 ${
                      isLight ? "bg-[#0E2F76]/10 text-[#0E2F76]" : "bg-white/10 text-white"
                    }`}
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
              </GlassContainer>
            </div>
          )}
        </div>
      )}
    </>
  );
}
