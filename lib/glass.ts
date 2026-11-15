/**
 * lib/glass.ts  -  Liquid Glass settings (saved on the device).
 *
 * Default = OFF (normal solid look). When ON, the CSS in app/liquid-glass.css
 * reads these values through CSS variables, so nothing else in the app changes.
 */

export type GlassTint = "neutral" | "cool" | "warm" | "rose";
export type GlassPresetName = "soft" | "balanced" | "crystal" | "custom";

export interface GlassSettings {
  enabled: boolean;
  preset: GlassPresetName;
  blur: number; // 0 - 40   (px)  how frosted the glass is
  transparency: number; // 0 - 100  higher = more see-through
  color: number; // 100 - 220 (%)   how much the picture behind shows its colours
  edge: number; // 0 - 100  brightness of the thin light edge
  tint: GlassTint;
  motion: boolean; // bouncy / stretchy animations
}

export const GLASS_KEY = "fusion-glass";

export const GLASS_PRESETS: Record<
  Exclude<GlassPresetName, "custom">,
  Pick<GlassSettings, "blur" | "transparency" | "color" | "edge" | "tint">
> = {
  soft: { blur: 26, transparency: 50, color: 125, edge: 35, tint: "neutral" },
  balanced: { blur: 18, transparency: 62, color: 140, edge: 55, tint: "neutral" },
  crystal: { blur: 10, transparency: 78, color: 170, edge: 80, tint: "neutral" },
};

export const GLASS_DEFAULT: GlassSettings = {
  enabled: false, // normal look by default
  preset: "balanced",
  ...GLASS_PRESETS.balanced,
  motion: true,
};

const TINT_RGB: Record<GlassTint, string> = {
  neutral: "20,20,24",
  cool: "14,24,46",
  warm: "42,28,20",
  rose: "44,20,32",
};

/** The CSS variable values for a set of settings. */
export function glassVars(s: GlassSettings) {
  return {
    blur: `${s.blur}px`,
    sat: `${s.color}%`,
    fill: String(+(0.88 - (s.transparency / 100) * 0.8).toFixed(3)),
    rim: String(+(s.edge / 100).toFixed(2)),
    rgb: TINT_RGB[s.tint] ?? TINT_RGB.neutral,
  };
}

export function loadGlass(): GlassSettings {
  try {
    const raw = localStorage.getItem(GLASS_KEY);
    if (!raw) return { ...GLASS_DEFAULT };
    const p = JSON.parse(raw);
    return { ...GLASS_DEFAULT, ...p };
  } catch {
    return { ...GLASS_DEFAULT };
  }
}

/** Puts the settings on the page right now. */
export function applyGlass(s: GlassSettings) {
  const root = document.documentElement;
  const v = glassVars(s);
  root.setAttribute("data-glass", s.enabled ? "on" : "off");
  root.setAttribute("data-glass-motion", s.motion ? "on" : "off");
  root.style.setProperty("--g-blur", v.blur);
  root.style.setProperty("--g-sat", v.sat);
  root.style.setProperty("--g-fill", v.fill);
  root.style.setProperty("--g-rim", v.rim);
  root.style.setProperty("--g-rgb", v.rgb);
}

export function saveGlass(s: GlassSettings) {
  try {
    localStorage.setItem(GLASS_KEY, JSON.stringify({ ...s, css: glassVars(s) }));
  } catch {}
}

/** Saves and applies in one go. */
export function updateGlass(s: GlassSettings) {
  saveGlass(s);
  applyGlass(s);
}

/**
 * Tiny script placed in <head>: applies the saved choice BEFORE the page is drawn,
 * so there is no flash. It only reads the "css" values saved by saveGlass().
 */
export const GLASS_BOOT_SCRIPT = `(function(){try{var s=JSON.parse(localStorage.getItem('${GLASS_KEY}')||'null');var d=document.documentElement;if(!s){d.setAttribute('data-glass','off');return;}
d.setAttribute('data-glass',s.enabled?'on':'off');d.setAttribute('data-glass-motion',s.motion===false?'off':'on');
if(s.css){d.style.setProperty('--g-blur',s.css.blur);d.style.setProperty('--g-sat',s.css.sat);d.style.setProperty('--g-fill',s.css.fill);d.style.setProperty('--g-rim',s.css.rim);d.style.setProperty('--g-rgb',s.css.rgb);}
}catch(e){}})();`;
