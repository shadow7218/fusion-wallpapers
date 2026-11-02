import React from "react";

interface SkeletonCardProps {
  aspectRatio?: string;
  className?: string;
}

export function SkeletonCard({
  aspectRatio = "aspect-[9/16]",
  className = "",
}: SkeletonCardProps) {
  return (
    <div
      className={`relative overflow-hidden rounded-2xl bg-zinc-950 border border-white/[0.05] shadow-lg ${aspectRatio} ${className}`}
    >
      {/* High-speed GPU subtle shimmer */}
      <div className="absolute inset-0 -translate-x-full animate-[shimmer_2s_infinite] bg-gradient-to-r from-transparent via-white/[0.04] to-transparent" />
      <div className="absolute bottom-3 left-3 right-3 space-y-2">
        <div className="h-3 w-3/4 rounded-full bg-white/[0.06]" />
        <div className="h-2.5 w-1/2 rounded-full bg-white/[0.04]" />
      </div>
    </div>
  );
}

export default SkeletonCard;
