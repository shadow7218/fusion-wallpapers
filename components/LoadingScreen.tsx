"use client";

import { useEffect, useState } from "react";

/* ---------------- easy settings ---------------- */
const TEXT_TOP = "Fusion";
const TEXT_BOTTOM = "Wallpaper";
const LOGO_ANIMATION = true; // Kept true so the logo still breathes
const ONLY_IN_INSTALLED_APP = true; // true = show only when opened from the home screen
const LOGO_SRC = "/app-icon/icon-512.png?v=2"; 
/* ------------------------------------------------ */

export default function LoadingScreen() {
  const [phase, setPhase] = useState<"show" | "leave" | "gone">("show");

  useEffect(() => {
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const MIN = reduced ? 700 : 2000; 
    const MAX = 5000; 
    let loaded = document.readyState === "complete";
    let minDone = false;
    let left = false;
    const timers: ReturnType<typeof setTimeout>[] = [];

    const tryLeave = () => {
      if (left || !(loaded && minDone)) return;
      left = true;
      setPhase("leave");
      timers.push(setTimeout(() => setPhase("gone"), 450));
    };
    const onLoad = () => {
      loaded = true;
      tryLeave();
    };

    window.addEventListener("load", onLoad);
    timers.push(
      setTimeout(() => {
        minDone = true;
        tryLeave();
      }, MIN)
    );
    timers.push(
      setTimeout(() => {
        loaded = true;
        minDone = true;
        tryLeave();
      }, MAX)
    );
    return () => {
      window.removeEventListener("load", onLoad);
      timers.forEach(clearTimeout);
    };
  }, []);

  if (phase === "gone") return null;

  return (
    <div className={`fs-overlay ${phase === "leave" ? "fs-leave" : ""}`} aria-hidden="true">
      <style>{css(ONLY_IN_INSTALLED_APP)}</style>

      {/* The colored glow HTML was removed from here */}

      <img
        src={LOGO_SRC}
        alt=""
        draggable={false}
        className={`fs-logo ${LOGO_ANIMATION ? "fs-breathe" : ""}`}
      />

      <div className="fs-text">
        <div className="fs-line fs-l1">
          <span className="fs-sweep">{TEXT_TOP}</span>
        </div>
        <div className="fs-line fs-l2">
          <span className="fs-sweep">{TEXT_BOTTOM}</span>
        </div>
      </div>
    </div>
  );
}

const css = (onlyInstalled: boolean) => `
.fs-overlay{
  --fs-size:clamp(180px,66vw,300px);
  position:fixed;inset:0;z-index:9999;background:#000;color:#fff;
  display:${onlyInstalled ? "none" : "flex"};align-items:center;justify-content:center;
  overflow:hidden;opacity:1;
  transition:opacity .42s ease,transform .42s ease;
}
${
  onlyInstalled
    ? `@media (display-mode: standalone), (display-mode: fullscreen), (display-mode: minimal-ui){.fs-overlay{display:flex}}`
    : ""
}
.fs-leave{opacity:0;transform:scale(1.05);pointer-events:none}

/* logo: same size and place as the phone's own loading screen, so there is no jump */
.fs-logo{position:relative;z-index:2;width:var(--fs-size);height:var(--fs-size);object-fit:contain;
  user-select:none;-webkit-user-drag:none}
.fs-breathe{animation:fs-breathe 3.4s ease-in-out .6s infinite}
@keyframes fs-breathe{0%,100%{transform:scale(1)}50%{transform:scale(1.04)}}

/* text under the logo: blur -> sharp fade-in, then one light sweep */
.fs-text{position:absolute;left:0;right:0;top:calc(50% + var(--fs-size) * .365 + 26px);
  z-index:3;text-align:center}
.fs-line{opacity:0;filter:blur(12px);transform:translateY(6px);
  animation:fs-text-in .95s cubic-bezier(.22,1,.36,1) forwards}
.fs-l1{font-size:34px;font-weight:800;letter-spacing:.14em;line-height:1.1;animation-delay:.3s}
.fs-l2{margin-top:6px;font-size:15px;font-weight:600;letter-spacing:.42em;padding-left:.42em;
  opacity:0;animation-delay:.55s}
.fs-l2 .fs-sweep{opacity:.82}
@keyframes fs-text-in{to{opacity:1;filter:blur(0);transform:none}}

.fs-sweep{
  background:linear-gradient(100deg,#fff 0%,#fff 36%,#7ab8ff 43%,#ff7ad6 50%,#3ff0d0 57%,#fff 64%,#fff 100%);
  background-size:320% 100%;background-position:100% 0;
  -webkit-background-clip:text;background-clip:text;-webkit-text-fill-color:transparent;color:transparent;
  animation:fs-sweep 1.15s ease-in-out 1.15s forwards}
@keyframes fs-sweep{from{background-position:100% 0}to{background-position:0% 0}}

@media (prefers-reduced-motion:reduce){
  .fs-breathe,.fs-sweep{animation:none!important}
  .fs-line{animation:fs-fade .4s ease forwards!important;filter:none;transform:none}
  @keyframes fs-fade{to{opacity:1}}
}
`;
