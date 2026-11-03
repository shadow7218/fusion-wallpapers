"use client";

import React, { useState, useEffect, useRef } from "react";
import { Search, X } from "lucide-react";

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
  const [isFloating, setIsFloating] = useState(false);
  const [isShrunk, setIsShrunk] = useState(false);
  const scrollTimer = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    let lastScrollY = window.scrollY;

    const handleScroll = () => {
      const currentY = window.scrollY;
      
      // The header is roughly 65px tall. Once we scroll past it, lift the search bar off the page.
      if (currentY > 65) {
        setIsFloating(true);

        // Only trigger the "shrink to circle" animation if actively scrolling by a noticeable amount
        if (Math.abs(currentY - lastScrollY) > 2) {
          setIsShrunk(true);
        }
        lastScrollY = currentY;

        // Apple-style expand: When the user stops scrolling, wait a beat, then expand to full size
        if (scrollTimer.current) clearTimeout(scrollTimer.current);
        scrollTimer.current = setTimeout(() => {
          setIsShrunk(false);
        }, 350); 
      } else {
        // We are at the top of the page, dock it normally
        setIsFloating(false);
        setIsShrunk(false);
        lastScrollY = currentY;
      }
    };

    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => {
      window.removeEventListener("scroll", handleScroll);
      if (scrollTimer.current) clearTimeout(scrollTimer.current);
    };
  }, []);

  const handlePillClick = () => {
    if (isShrunk) {
      setIsShrunk(false);
      setTimeout(() => searchInputRef.current?.focus(), 150);
    }
  };

  return (
    <>
      {/* 
        THE PLACEHOLDER: 
        This empty div takes up the exact same height (h-11) when the search bar becomes fixed. 
        This completely eliminates the scrolling "shutter/glitch" effect.
      */}
      {isFloating && <div className="h-11 w-full shrink-0" />}

      {/* DYNAMIC ISLAND WRAPPER */}
      <div
        className={
          isFloating
            ? "fixed top-3 inset-x-0 z-[60] flex justify-center px-3 md:px-4 pointer-events-none"
            : "relative w-full pointer-events-none"
        }
      >
        <div
          onClick={handlePillClick}
          className={`pointer-events-auto relative overflow-hidden transition-[width,height,border-radius,box-shadow,background] duration-500 ease-[cubic-bezier(0.34,1.56,0.64,1)] ${
            isShrunk
              ? "w-12 h-12 rounded-full cursor-pointer shadow-[0_12px_28px_rgba(0,0,0,0.55)]"
              : "w-full max-w-6xl h-11 rounded-[9999px] shadow-sm"
          }`}
          style={{
            // Custom frosted glass: natural blur, not fully transparent
            background: isLight
              ? "linear-gradient(135deg, rgba(255,255,255,0.75) 0%, rgba(244,254,255,0.45) 100%)"
              : "linear-gradient(135deg, rgba(30,30,32,0.65) 0%, rgba(12,12,14,0.5) 100%)",
            backdropFilter: "blur(14px) saturate(130%)",
            WebkitBackdropFilter: "blur(14px) saturate(130%)",
            border: `1px solid ${isLight ? "rgba(14,47,118,0.15)" : "rgba(255,255,255,0.15)"}`,
            boxShadow: isShrunk
              ? isLight
                ? "0 8px 24px rgba(14,47,118,0.25), inset 0 1px 1px rgba(255,255,255,0.9)"
                : "0 12px 32px rgba(0,0,0,0.65), inset 0 1px 1px rgba(255,255,255,0.15)"
              : isLight
              ? "0 2px 10px rgba(14,47,118,0.05)"
              : "0 2px 10px rgba(0,0,0,0.2)",
          }}
        >
          <div
            className={`flex items-center h-full transition-all duration-500 ease-[cubic-bezier(0.34,1.56,0.64,1)] ${
              isShrunk ? "justify-center px-0" : "px-4"
            }`}
          >
            <Search
              className={`shrink-0 transition-all duration-500 ease-[cubic-bezier(0.34,1.56,0.64,1)] ${
                isShrunk ? "h-5 w-5 mr-0" : "h-4 w-4 mr-3"
              } ${isLight ? "text-[#0E2F76]/80" : "text-white/80"}`}
            />
            
            <input
              ref={searchInputRef}
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search wallpapers, anime, moods..."
              className={`bg-transparent text-xs sm:text-sm focus:outline-none font-medium transition-all duration-400 ease-[cubic-bezier(0.34,1.56,0.64,1)] ${
                isShrunk
                  ? "w-0 opacity-0 pointer-events-none"
                  : "flex-1 opacity-100 delay-75"
              } ${
                isLight
                  ? "text-[#0E2F76] placeholder:text-[#0E2F76]/50"
                  : "text-white placeholder:text-white/50"
              }`}
            />
            
            <div
              className={`shrink-0 flex items-center transition-all duration-400 ease-[cubic-bezier(0.34,1.56,0.64,1)] overflow-hidden ${
                isShrunk
                  ? "w-0 opacity-0 pointer-events-none"
                  : "w-6 opacity-100 delay-75"
              }`}
            >
              {searchQuery ? (
                <button
                  type="button"
                  aria-label="Clear search"
                  onClick={(e) => {
                    e.stopPropagation();
                    setSearchQuery("");
                  }}
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
          </div>
        </div>
      </div>
    </>
  );
}
