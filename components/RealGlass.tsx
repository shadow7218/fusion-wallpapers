"use client";

import { useEffect, useState } from "react";
import { loadGlass, supportsRealGlass, type GlassSettings } from "@/lib/glass";

/**
 * "Real glass (beta)" for the bottom bar only.
 * Draws a small "bend map" for the bar's exact size and gives it to an SVG filter that
 * the bar uses as its backdrop-filter. Near the edges the picture behind is pushed
 * (refraction) and its red / green / blue are pushed by slightly different amounts (rainbow).
 * Only works in Chromium browsers; everywhere else this renders nothing.
 */

function buildMap(w: number, h: number): string {
  const c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  const ctx = c.getContext("2d");
  if (!ctx) return "";
  const img = ctx.createImageData(w, h);
  const r = h / 2; // the bar is a pill
  const bezel = Math.min(26, r * 0.9); // how deep the bending reaches from the edge
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const px = x + 0.5;
      const py = y + 0.5;
      const cx = Math.min(Math.max(px, r), w - r);
      const cy = Math.min(Math.max(py, r), h - r);
      const dx = px - cx;
      const dy = py - cy;
      const dist = Math.hypot(dx, dy);
      const inside = r - dist; // distance from the edge, going inwards
      let ux = 0;
      let uy = 0;
      let m = 0;
      if (dist > 0.0001 && inside < bezel) {
        const t = 1 - Math.max(0, inside) / bezel;
        m = t * t; // strongest at the very edge
        ux = dx / dist;
        uy = dy / dist;
      }
      const i = (y * w + x) * 4;
      // 128 = no bend. Points inwards, so the picture looks pushed outwards like a lens.
      img.data[i] = 128 + -ux * m * 127;
      img.data[i + 1] = 128 + -uy * m * 127;
      img.data[i + 2] = 128;
      img.data[i + 3] = 255;
    }
  }
  ctx.putImageData(img, 0, 0);
  return c.toDataURL("image/png");
}

export default function RealGlass() {
  const [cfg, setCfg] = useState<GlassSettings | null>(null);
  const [map, setMap] = useState<{ href: string; w: number; h: number } | null>(null);

  useEffect(() => {
    const read = () => setCfg(loadGlass());
    read();
    window.addEventListener("fusion-glass-change", read);
    window.addEventListener("storage", read);
    return () => {
      window.removeEventListener("fusion-glass-change", read);
      window.removeEventListener("storage", read);
    };
  }, []);

  const active = !!cfg && cfg.enabled && cfg.real && supportsRealGlass();

  useEffect(() => {
    const root = document.documentElement;
    if (!active) {
      root.removeAttribute("data-glass-real");
      return;
    }
    let last = "";
    const check = () => {
      const nav = document.querySelector(".fusion-nav") as HTMLElement | null;
      if (!nav) return;
      const rect = nav.getBoundingClientRect();
      const w = Math.round(rect.width);
      const h = Math.round(rect.height);
      if (w < 40 || h < 20) return;
      const key = `${w}x${h}`;
      if (key === last) return;
      last = key;
      const href = buildMap(w, h);
      if (!href) return;
      setMap({ href, w, h });
      root.setAttribute("data-glass-real", "on");
    };
    check();
    const timer = setInterval(check, 1200);
    window.addEventListener("resize", check);
    return () => {
      clearInterval(timer);
      window.removeEventListener("resize", check);
      root.removeAttribute("data-glass-real");
    };
  }, [active]);

  if (!active || !cfg || !map) return null;

  const base = cfg.refraction * 0.9; // pixels of bending
  const spread = (cfg.rainbow / 100) * 0.35; // how far apart red and blue are bent
  const sR = base * (1 - spread);
  const sG = base;
  const sB = base * (1 + spread);

  return (
    <svg width="0" height="0" style={{ position: "absolute", pointerEvents: "none" }} aria-hidden="true" focusable="false">
      <filter id="fusion-real-glass" x="0" y="0" width="100%" height="100%" colorInterpolationFilters="sRGB">
        <feImage href={map.href} x="0" y="0" width={map.w} height={map.h} preserveAspectRatio="none" result="map" />

        <feDisplacementMap in="SourceGraphic" in2="map" scale={sR} xChannelSelector="R" yChannelSelector="G" result="dR" />
        <feColorMatrix in="dR" type="matrix" values="1 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 1 0" result="red" />

        <feDisplacementMap in="SourceGraphic" in2="map" scale={sG} xChannelSelector="R" yChannelSelector="G" result="dG" />
        <feColorMatrix in="dG" type="matrix" values="0 0 0 0 0  0 1 0 0 0  0 0 0 0 0  0 0 0 1 0" result="green" />

        <feDisplacementMap in="SourceGraphic" in2="map" scale={sB} xChannelSelector="R" yChannelSelector="G" result="dB" />
        <feColorMatrix in="dB" type="matrix" values="0 0 0 0 0  0 0 0 0 0  0 0 1 0 0  0 0 0 1 0" result="blue" />

        <feBlend in="red" in2="green" mode="screen" result="rg" />
        <feBlend in="rg" in2="blue" mode="screen" />
      </filter>
    </svg>
  );
}
