"use client";

import React, { useState, useEffect } from "react";
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
  const [isScrolled, setIsScrolled] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    // Only apply the dynamic island behavior on mobile devices
    const checkMobile = () => setIsMobile(window.innerWidth < 768);
    checkMobile();
    window.addEventListener("resize", checkMobile);
    
    let lastY = window.scrollY;
    const handleScroll = () => {
      const currentY = window.scrollY;
      
      // Trigger floating state when scrolled past the header (~60px)
      setIsScrolled(currentY > 60);
      
      // Collapse search seamlessly if the user scrolls away
      if (isExpanded && Math.abs(currentY - lastY) > 15) {
        setIsExpanded(false);
      }
      lastY = currentY;
    };
    
    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => {
      window.removeEventListener("resize", checkMobile);
      window.removeEventListener("scroll", handleScroll);
    };
  }, [isExpanded]);

  const handleToggle = () => {
    if (isScrolled && isMobile) {
      const next = !isExpanded;
      setIsExpanded(next);
      if (next) {
        // Wait for the spring animation to finish before focusing to prevent keyboard jump
        setTimeout(() => searchInputRef.current?.focus(), 150);
      }
    }
  };

  // On desktop, it is always full. On mobile, it's full if not scrolled OR explicitly expanded.
  const showFull = !isMobile || !isScrolled || isExpanded;
  const isFloating = isMobile && isScrolled;

  return (
    <div 
      className="relative transition-[height] duration-500 ease-[cubic-bezier(0.34,1.56,0.64,1)] w-full shrink-0"
      style={{
        // When floating on mobile, collapse this wrapper's height to 0. 
        // This causes the category pills below to smoothly slide up and fill the gap!
        height: isFloating ? "0px" : "44px",
      }}
    >
      <div
        onClick={!showFull ? handleToggle : undefined}
        className={`transition-all duration-500 ease-[cubic-bezier(0.34,1.56,0.64,1)] overflow-hidden origin-right ${
          isFloating ? "fixed z-[100]" : "absolute inset-0 z-10 w-full"
        } ${
          !showFull 
            // Shrunk State: Circular Dynamic Island
            ? "top-3 right-3 w-11 h-11 rounded-full cursor-pointer shadow-[0_8px_24px_rgba(0,0,0,0.55)] hover:scale-105" 
            : isFloating 
              // Expanded Floating State
              ? "top-3 left-3 right-3 h-12 w-[calc(100%-1.5rem)] rounded-[24px] shadow-[0_12px_32px_rgba(0,0,0,0.65)]" 
              // Default In-Page State
              : "h-11 rounded-[9999px] shadow-sm"
        }`}
        style={{
          // Natural glass background: slightly opaque so it doesn't bleed too much, with blur
          background: isLight
            ? "linear-gradient(135deg, rgba(255,255,255,0.92) 0%, rgba(244,254,255,0.7) 100%)"
            : "linear-gradient(135deg, rgba(38,38,42,0.85) 0%, rgba(18,18,22,0.7) 100%)",
          backdropFilter: "blur(14px) saturate(140%)",
          WebkitBackdropFilter: "blur(14px) saturate(140%)",
          border: `1px solid ${isLight ? "rgba(14,47,118,0.15)" : "rgba(255,255,255,0.15)"}`,
        }}
      >
        <div className={`flex items-center h-full w-full transition-all duration-500 ease-[cubic-bezier(0.34,1.56,0.64,1)] ${!showFull ? "justify-center px-0" : "px-4"}`}>
          <Search className={`shrink-0 transition-all duration-500 ease-[cubic-bezier(0.34,1.56,0.64,1)] ${!showFull ? "h-[20px] w-[20px] mr-0" : "h-4 w-4 mr-3"} ${isLight ? "text-[#0E2F76]/80" : "text-white/90"}`} />
          
          <input
            ref={searchInputRef}
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search wallpapers, anime, moods..."
            className={`bg-transparent text-xs sm:text-sm focus:outline-none font-medium transition-all duration-500 ease-[cubic-bezier(0.34,1.56,0.64,1)] ${
              !showFull ? "w-0 opacity-0 pointer-events-none" : "flex-1 opacity-100 delay-[50ms]"
            } ${isLight ? "text-[#0E2F76] placeholder:text-[#0E2F76]/50" : "text-white placeholder:text-white/50"}`}
          />

          <div className={`shrink-0 flex items-center transition-all duration-500 overflow-hidden ${!showFull ? "w-0 opacity-0 pointer-events-none" : "w-auto opacity-100 delay-[50ms]"}`}>
            {searchQuery ? (
              <button type="button" onClick={(e) => { e.stopPropagation(); setSearchQuery(""); }} className={`p-1 mr-1 transition-transform active:scale-90 ${isLight ? "text-[#0E2F76]/70 hover:text-[#0E2F76]" : "text-white/70 hover:text-white"}`}>
                <X className="h-4 w-4" />
              </button>
            ) : null}
            {isFloating && showFull && (
               <button type="button" onClick={(e) => { e.stopPropagation(); setIsExpanded(false); }} className={`ml-1 h-7 w-7 rounded-full flex items-center justify-center transition-transform active:scale-90 ${isLight ? "bg-[#0E2F76]/10 text-[#0E2F76]" : "bg-white/10 text-white"}`}>
                 <X className="h-4 w-4" />
               </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
