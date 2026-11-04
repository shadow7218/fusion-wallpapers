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
  const [isMobile, setIsMobile] = useState(false);
  const scrollTimer = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    // Only apply the dynamic island behavior on mobile devices
    const checkMobile = () => setIsMobile(window.innerWidth < 768);
    checkMobile();
    window.addEventListener("resize", checkMobile);
    
    const handleScroll = () => {
      const currentY = window.scrollY;
      
      // Wait until the header AND categories are mostly out of view (~140px)
      if (currentY > 140) {
        setIsFloating(true);
        setIsShrunk(true); // Shrink to pill shape while actively scrolling
        
        // Wait exactly 1 second (1000ms) after scrolling stops to auto-expand
        if (scrollTimer.current) clearTimeout(scrollTimer.current);
        scrollTimer.current = setTimeout(() => {
          setIsShrunk(false); 
        }, 1000); 
      } else {
        // Dock back to normal position
        setIsFloating(false);
        setIsShrunk(false);
        if (scrollTimer.current) clearTimeout(scrollTimer.current);
      }
    };
    
    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => {
      window.removeEventListener("resize", checkMobile);
      window.removeEventListener("scroll", handleScroll);
      if (scrollTimer.current) clearTimeout(scrollTimer.current);
    };
  }, []);

  // On desktop, it is always full. On mobile, it floats and morphs.
  const floating = isMobile && isFloating;
  const shrunk = floating && isShrunk;

  return (
    <div 
      className="relative transition-[height] duration-500 ease-[cubic-bezier(0.34,1.56,0.64,1)] w-full shrink-0"
      style={{
        // Gently collapse this wrapper's height to 0 when floating. 
        // This causes the category pills below to smoothly slide up!
        height: floating ? "0px" : "44px",
      }}
    >
      {/* Wrapper that centers the search bar so it animates from the exact middle */}
      <div
        className={`transition-all duration-500 ease-[cubic-bezier(0.34,1.56,0.64,1)] flex justify-center w-full pointer-events-none ${
          floating 
            ? "fixed top-3 inset-x-0 z-[50]" // z-[50] guarantees it is on top of wallpapers
            : "absolute top-0 inset-x-0 z-10"
        }`}
      >
        <div
          onClick={() => {
            if (shrunk) {
              setIsShrunk(false);
              setTimeout(() => searchInputRef.current?.focus(), 150);
            }
          }}
          className={`pointer-events-auto relative overflow-hidden transition-all duration-500 ease-[cubic-bezier(0.34,1.56,0.64,1)] flex items-center rounded-full ${
            shrunk
              ? "w-28 h-10 shadow-[0_12px_28px_rgba(0,0,0,0.45)] cursor-pointer justify-center" // Shrunk to a tiny Pill, not a circle
              : "w-full max-w-6xl h-11 shadow-sm px-4 justify-start" // Full Size expanded
          }`}
          style={{
            // Less transparent, slightly more blurred natural glass look
            background: isLight
              ? "linear-gradient(135deg, rgba(255,255,255,0.85) 0%, rgba(244,254,255,0.6) 100%)"
              : "linear-gradient(135deg, rgba(38,38,42,0.85) 0%, rgba(18,18,22,0.7) 100%)",
            backdropFilter: "blur(12px) saturate(130%)",
            WebkitBackdropFilter: "blur(12px) saturate(130%)",
            border: `1px solid ${isLight ? "rgba(14,47,118,0.12)" : "rgba(255,255,255,0.15)"}`,
          }}
        >
          <Search
            className={`shrink-0 transition-all duration-500 ease-[cubic-bezier(0.34,1.56,0.64,1)] ${
              shrunk ? "h-4 w-4 mr-0" : "h-4 w-4 mr-3"
            } ${isLight ? "text-[#0E2F76]/80" : "text-white/80"}`}
          />
          
          <input
            ref={searchInputRef}
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search wallpapers..."
            className={`bg-transparent text-xs sm:text-sm focus:outline-none font-medium transition-all duration-500 ease-[cubic-bezier(0.34,1.56,0.64,1)] ${
              shrunk ? "w-0 opacity-0 pointer-events-none" : "flex-1 opacity-100 delay-[50ms]"
            } ${isLight ? "text-[#0E2F76] placeholder:text-[#0E2F76]/50" : "text-white placeholder:text-white/50"}`}
          />
          
          <div
            className={`shrink-0 flex items-center transition-all duration-500 overflow-hidden ${
              shrunk ? "w-0 opacity-0 pointer-events-none" : "w-auto opacity-100 delay-[50ms]"
            }`}
          >
            {searchQuery ? (
              <button
                type="button"
                aria-label="Clear search"
                onClick={(e) => { e.stopPropagation(); setSearchQuery(""); }}
                className={`p-1 transition-transform active:scale-90 ${isLight ? "text-[#0E2F76]/70 hover:text-[#0E2F76]" : "text-white/70 hover:text-white"}`}
              >
                <X className="h-4 w-4" />
              </button>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
}
