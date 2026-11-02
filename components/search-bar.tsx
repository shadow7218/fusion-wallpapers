"use client";

import React from "react";
import { Search, X } from "lucide-react";
import { motion } from "framer-motion";

interface SearchBarProps {
  searchQuery: string;
  onSearchChange: (query: string) => void;
  categories: string[];
  selectedCategory: string;
  onSelectCategory: (category: string) => void;
}

export function SearchBar({
  searchQuery,
  onSearchChange,
  categories,
  selectedCategory,
  onSelectCategory,
}: SearchBarProps) {
  return (
    <div className="w-full space-y-4">
      {/* Search Input Container */}
      <div className="relative flex items-center w-full">
        <Search className="absolute left-4 w-4 h-4 text-zinc-400 pointer-events-none" />
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => onSearchChange(e.target.value)}
          placeholder="Search 4K anime wallpapers..."
          className="w-full pl-11 pr-10 py-3.5 rounded-2xl bg-zinc-900/70 border border-white/[0.08] text-sm text-white placeholder-zinc-500 focus:outline-none focus:border-white/30 focus:ring-1 focus:ring-white/20 transition-all backdrop-blur-xl"
        />
        {searchQuery && (
          <button
            type="button"
            onClick={() => onSearchChange("")}
            aria-label="Clear search query"
            className="absolute right-3.5 p-1 rounded-full text-zinc-400 hover:text-white transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        )}
      </div>

      {/* Category Pills Bar */}
      <div className="flex items-center gap-2 overflow-x-auto pb-2 scrollbar-none select-none">
        {categories.map((category) => {
          const isSelected = selectedCategory === category;
          return (
            <button
              key={category}
              type="button"
              onClick={() => onSelectCategory(category)}
              className="relative px-4 py-2 rounded-full text-xs font-medium whitespace-nowrap transition-colors"
            >
              {isSelected && (
                <motion.div
                  layoutId="activeCategoryPill"
                  transition={{
                    type: "spring",
                    stiffness: 400,
                    damping: 30,
                  }}
                  className="absolute inset-0 rounded-full bg-white text-black shadow-sm"
                />
              )}
              <span
                className={`relative z-10 transition-colors ${
                  isSelected ? "text-black font-semibold" : "text-zinc-400 hover:text-zinc-200"
                }`}
              >
                {category}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

export default SearchBar;
