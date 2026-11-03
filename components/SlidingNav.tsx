"use client";

import { useRef, useState } from "react";
import type { LucideIcon } from "lucide-react";

export interface NavTab {
  id: string;
  label: string;
  Icon: LucideIcon;
  onSelect: () => void;
}

export default function SlidingNav({
  tabs, activeId, isLight,
}: { tabs: NavTab[]; activeId: string; isLight: boolean }) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const start = useRef<{ x: number; moved: boolean } | null>(null);
  const [dragLeft, setDragLeft] = useState<number | null>(null);
  const [dragIndex, setDragIndex] = useState<number | null>(null);

  const n = tabs.length;
  const activeIndex = Math.max(0, tabs.findIndex((t) => t.id === activeId));
  const shownIndex = dragIndex ?? activeIndex;

  const indexAt = (clientX: number) => {
    const r = wrapRef.current!.getBoundingClientRect();
    const rel = Math.min(Math.max(clientX - r.left, 0), r.width - 1);
    return Math.floor((rel / r.width) * n);
  };

  const onPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    start.current = { x: e.clientX, moved: false };
    e.currentTarget.setPointerCapture(e.pointerId);
  };

  const onPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    const s = start.current;
    if (!s) return;
    if (!s.moved && Math.abs(e.clientX - s.x) > 6) s.moved = true;
    if (!s.moved) return;
    const r = e.currentTarget.getBoundingClientRect();
    const pillW = r.width / n;
    setDragLeft(Math.min(Math.max(e.clientX - r.left - pillW / 2, 0), r.width - pillW));
    setDragIndex(indexAt(e.clientX));
  };

  const finish = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!start.current) return;
    const idx = indexAt(e.clientX);
    start.current = null;
    setDragLeft(null);
    setDragIndex(null);
    tabs[idx].onSelect();
  };

  const cancel = () => {
    start.current = null;
    setDragLeft(null);
    setDragIndex(null);
  };

  return (
    <div
      ref={wrapRef}
      className="relative flex select-none"
      style={{ touchAction: "pan-y" }}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={finish}
      onPointerCancel={cancel}
    >
      {/* sliding pill */}
      <span
        aria-hidden
        className="pointer-events-none absolute inset-y-0 left-0 will-change-transform"
        style={{
          width: `${100 / n}%`,
          transform:
            dragLeft !== null ? `translateX(${dragLeft}px)` : `translateX(${activeIndex * 100}%)`,
          transition:
            dragLeft !== null ? "none" : "transform 460ms cubic-bezier(0.34, 1.3, 0.64, 1)",
        }}
      >
        <span
          key={activeIndex}
          className="fusion-stretch absolute inset-0 rounded-full"
          style={{
            background: isLight
              ? "#0E2F76"
              : "linear-gradient(180deg, rgba(255,255,255,0.24), rgba(255,255,255,0.10))",
            boxShadow: isLight
              ? "0 6px 16px rgba(14,47,118,0.30)"
              : "inset 0 1px 0 rgba(255,255,255,0.28), 0 2px 10px rgba(0,0,0,0.4)",
          }}
        />
      </span>
      {tabs.map((t, i) => {
        const on = i === shownIndex;
        return (
          <button
            key={t.id}
            type="button"
            aria-label={t.label}
            aria-current={t.id === activeId ? "page" : undefined}
            onClick={(e) => {
              if (e.detail === 0) t.onSelect(); // keyboard only; taps are handled above
            }}
            className={`relative z-10 flex flex-1 flex-col items-center gap-0.5 py-1.5 transition-colors duration-200 ${
              on
                ? "fusion-nav-active font-bold text-white"
                : isLight
                ? "text-[#0E2F76]/70"
                : "text-white/70"
            }`}
          >
            <t.Icon key={on ? "on" : "off"} className={`h-4 w-4 ${on ? "fusion-icon-settle" : ""}`} />
            <span className="text-[9px] font-bold tracking-wide">{t.label}</span>
          </button>
        );
      })}
    </div>
  );
}
