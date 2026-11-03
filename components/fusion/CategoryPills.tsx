"use client";

import React from "react";
import { animeCategories } from "@/config/animeCategories";

interface CategoryPillsProps {
  isLight: boolean;
  selectedPillCategory: string;
  setSelectedPillCategory: (value: string) => void;
  pillRefs: React.RefObject<Record<string, HTMLButtonElement | null>>;
  pillBox: { left: number; width: number } | null;
  isAdmin: boolean;
  migrateOldToCloudinary: () => void;
  backfillDevices: () => void;
  migrateMsg: string;
}

export default function CategoryPills({
  isLight,
  selectedPillCategory,
  setSelectedPillCategory,
  pillRefs,
  pillBox,
  isAdmin,
  migrateOldToCloudinary,
  backfillDevices,
  migrateMsg,
}: CategoryPillsProps) {
  return (
    <div className="relative flex items-center gap-2 overflow-x-auto no-scrollbar pt-0.5 pb-1">
      {pillBox && (
        <span
          aria-hidden
          className="pointer-events-none absolute top-0.5 h-8 rounded-full transition-[transform,width] duration-[380ms] ease-[cubic-bezier(0.34,1.3,0.64,1)]"
          style={{
            left: 0,
            width: pillBox.width,
            transform: `translateX(${pillBox.left}px)`,
            background: isLight ? "#0E2F76" : "#ffffff",
          }}
        />
      )}
      {[
        "All",
        "Phone",
        "PC",
        ...animeCategories.filter((c) => c.showOnHome !== false).map((c) => c.name),
      ].map((pillName) => {
        const isActive = selectedPillCategory === pillName;
        return (
          <button
            key={pillName}
            ref={(el) => {
              if (pillRefs.current) {
                pillRefs.current[pillName] = el;
              }
            }}
            type="button"
            onClick={() => {
              setSelectedPillCategory(pillName);
              window.scrollTo({ top: 0, behavior: "smooth" });
            }}
            className={`relative z-10 shrink-0 rounded-full border px-4 h-8 text-[11px] font-semibold transition-[transform,color] duration-200 ease-out active:scale-[0.96] ${
              isActive
                ? (pillBox
                    ? isLight
                      ? "text-white"
                      : "text-black"
                    : isLight
                    ? "bg-[#0E2F76] text-white"
                    : "bg-white text-black") + " border-transparent"
                : isLight
                ? "bg-[#0E2F76]/10 text-[#0E2F76] border-[#0E2F76]/15"
                : "bg-white/[0.07] text-white/85 border-white/10"
            }`}
          >
            {pillName}
          </button>
        );
      })}
      {isAdmin && (
        <>
          <button
            type="button"
            onClick={migrateOldToCloudinary}
            className="shrink-0 rounded-full border px-4 h-8 text-[11px] font-semibold bg-white/[0.07] text-white/85 border-white/10"
          >
            {migrateMsg || "Move to Cloudinary"}
          </button>
          <button
            type="button"
            onClick={backfillDevices}
            className="shrink-0 rounded-full border px-4 h-8 text-[11px] font-semibold transition-[transform,background-color,color] duration-150 ease-out active:scale-[0.97] bg-white/[0.07] text-white/85 border-white/10"
          >
            Tag old
          </button>
        </>
      )}
    </div>
  );
}
