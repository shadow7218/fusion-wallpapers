"use client";

import { useEffect, useState } from "react";
import { RotateCcw } from "lucide-react";
import {
  GLASS_DEFAULT,
  GLASS_PRESETS,
  loadGlass,
  supportsRealGlass,
  updateGlass,
  type GlassSettings,
  type GlassTint,
} from "@/lib/glass";

const TINTS: { id: GlassTint; label: string; swatch: string }[] = [
  { id: "neutral", label: "Neutral", swatch: "#8b8b94" },
  { id: "cool", label: "Cool", swatch: "#4a7bff" },
  { id: "warm", label: "Warm", swatch: "#ff9a4a" },
  { id: "rose", label: "Rose", swatch: "#ff5c93" },
];

function Slider({
  label, value, min, max, unit, onChange,
}: { label: string; value: number; min: number; max: number; unit: string; onChange: (v: number) => void }) {
  return (
    <div>
      <div className="mb-1 flex items-center justify-between text-xs">
        <span className="font-semibold">{label}</span>
        <span style={{ color: "var(--s-muted)" }}>
          {value}
          {unit}
        </span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        value={value}
        aria-label={label}
        onChange={(e) => onChange(Number(e.target.value))}
        className="gc-range"
      />
    </div>
  );
}

/** Switch + all the liquid-glass controls. Everything saves on this device straight away. */
export default function GlassControls({
  Switch,
}: {
  Switch: React.ComponentType<{ on: boolean; onChange: (v: boolean) => void; label: string }>;
}) {
  const [s, setS] = useState<GlassSettings>(GLASS_DEFAULT);
  const [realOk, setRealOk] = useState(false);

  useEffect(() => {
    setS(loadGlass());
    setRealOk(supportsRealGlass());
  }, []);

  const set = (patch: Partial<GlassSettings>) => {
    const next = { ...s, ...patch };
    setS(next);
    updateGlass(next);
  };

  const custom = (patch: Partial<GlassSettings>) => set({ ...patch, preset: "custom" });

  return (
    <div>
      <style>{`
        .gc-range{width:100%;height:28px;accent-color:var(--s-accent);background:transparent}
        .gc-chip{height:36px;padding:0 14px;border-radius:9999px;font-size:12px;font-weight:700;
          border:1px solid var(--s-border);color:var(--s-text);transition:transform .25s}
        .gc-chip:active{transform:scale(.95)}
        .gc-chip-on{background:var(--s-text);color:var(--s-bg);border-color:transparent}
        .gc-preview{position:relative;height:104px;border-radius:20px;overflow:hidden;
          background:linear-gradient(120deg,#ff3d6e,#7a4dff 45%,#18d4f0);display:flex;align-items:center;justify-content:center}
        .gc-preview::before{content:"";position:absolute;inset:0;
          background:radial-gradient(circle at 20% 30%,rgba(255,255,255,.55) 0 18px,transparent 19px),
                     radial-gradient(circle at 78% 68%,rgba(255,220,80,.7) 0 26px,transparent 27px)}
      `}</style>

      <div className="s-item">
        <div className="flex w-full items-center gap-4 px-4 py-3.5">
          <div className="min-w-0 flex-1">
            <p className="text-[15px]" style={{ color: "var(--s-text)" }}>Liquid glass</p>
            <p className="text-xs" style={{ color: "var(--s-muted)" }}>
              See-through, frosted look. Off = normal solid look.
            </p>
          </div>
          <Switch on={s.enabled} onChange={(v) => set({ enabled: v })} label="Liquid glass" />
        </div>
      </div>

      {s.enabled && (
        <div className="s-item fusion-rise space-y-4 px-4 pb-4 pt-3">
          {/* live preview */}
          <div className="gc-preview">
            <div className="glass-container glass-container-pill relative z-10 flex h-12 items-center gap-2 px-6 text-sm font-bold" style={{ color: "#fff" }}>
              Preview
            </div>
          </div>

          {/* presets */}
          <div>
            <p className="mb-2 text-xs font-semibold">Style</p>
            <div className="flex flex-wrap gap-2">
              {(["soft", "balanced", "crystal"] as const).map((p) => (
                <button
                  key={p}
                  type="button"
                  className={`gc-chip capitalize ${s.preset === p ? "gc-chip-on" : ""}`}
                  onClick={() => set({ ...GLASS_PRESETS[p], preset: p })}
                >
                  {p}
                </button>
              ))}
              {s.preset === "custom" && <span className="gc-chip gc-chip-on">Custom</span>}
            </div>
          </div>

          <Slider label="Blur" value={s.blur} min={0} max={40} unit="px" onChange={(v) => custom({ blur: v })} />
          <Slider label="Transparency" value={s.transparency} min={0} max={100} unit="%" onChange={(v) => custom({ transparency: v })} />
          <Slider label="Colour boost" value={s.color} min={100} max={220} unit="%" onChange={(v) => custom({ color: v })} />
          <Slider label="Edge light" value={s.edge} min={0} max={100} unit="%" onChange={(v) => custom({ edge: v })} />

          {/* tint */}
          <div>
            <p className="mb-2 text-xs font-semibold">Glass tint</p>
            <div className="flex flex-wrap gap-2">
              {TINTS.map((t) => (
                <button
                  key={t.id}
                  type="button"
                  className={`gc-chip inline-flex items-center gap-2 ${s.tint === t.id ? "gc-chip-on" : ""}`}
                  onClick={() => custom({ tint: t.id })}
                >
                  <span className="h-3 w-3 rounded-full" style={{ background: t.swatch }} />
                  {t.label}
                </button>
              ))}
            </div>
          </div>

          {/* real glass (beta) */}
          <div className="rounded-2xl border p-3" style={{ borderColor: "var(--s-border)" }}>
            <div className="flex items-center justify-between gap-4">
              <div className="min-w-0">
                <p className="text-[14px] font-semibold" style={{ color: "var(--s-text)" }}>
                  Real glass <span className="ml-1 rounded-full px-2 py-0.5 text-[10px] font-bold" style={{ background: "var(--s-accent)", color: "#fff" }}>BETA</span>
                </p>
                <p className="text-xs" style={{ color: "var(--s-muted)" }}>
                  {realOk
                    ? "The bottom bar bends the picture behind it like a thick lens. Uses a little more battery."
                    : "Needs Chrome, Edge or Samsung Internet. Your browser keeps the normal glass."}
                </p>
              </div>
              <div className={realOk ? "" : "pointer-events-none opacity-40"}>
                <Switch on={s.real && realOk} onChange={(v) => set({ real: v })} label="Real glass" />
              </div>
            </div>

            {s.real && realOk && (
              <div className="mt-4 space-y-4">
                <Slider label="Refraction" value={s.refraction} min={0} max={100} unit="%" onChange={(v) => set({ refraction: v })} />
                <Slider label="Rainbow" value={s.rainbow} min={0} max={100} unit="%" onChange={(v) => set({ rainbow: v })} />
                <Slider label="Frost" value={s.frost} min={0} max={12} unit="px" onChange={(v) => set({ frost: v })} />
                <Slider label="Light" value={s.light} min={0} max={100} unit="%" onChange={(v) => set({ light: v })} />
                <p className="text-xs" style={{ color: "var(--s-muted)" }}>
                  Look at the bottom bar to see the effect. It works best when a colourful wallpaper is behind the bar.
                </p>
              </div>
            )}
          </div>

          {/* motion */}
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="text-[14px]" style={{ color: "var(--s-text)" }}>Bouncy motion</p>
              <p className="text-xs" style={{ color: "var(--s-muted)" }}>Stretchy, springy button animations</p>
            </div>
            <Switch on={s.motion} onChange={(v) => set({ motion: v })} label="Bouncy motion" />
          </div>

          <button
            type="button"
            className="s-btn-ghost inline-flex items-center gap-2"
            onClick={() => {
              const next = { ...GLASS_DEFAULT, enabled: true };
              setS(next);
              updateGlass(next);
            }}
          >
            <RotateCcw className="h-3.5 w-3.5" /> Reset glass settings
          </button>
        </div>
      )}
    </div>
  );
}
