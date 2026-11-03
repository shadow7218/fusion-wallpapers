"use client";

import React from "react";

interface FooterProps {
  isLight: boolean;
}

export default function Footer({ isLight }: FooterProps) {
  return (
    <footer className="w-full pt-10 pb-6 text-center select-none">
      <p
        className={`text-[11px] sm:text-xs font-medium tracking-[0.18em] uppercase ${
          isLight ? "text-[#0E2F76]/50" : "text-white/40"
        }`}
      >
        Built by Fusion
      </p>
    </footer>
  );
}
