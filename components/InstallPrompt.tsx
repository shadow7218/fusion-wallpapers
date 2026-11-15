"use client";

import { useEffect, useRef, useState } from "react";
import { Share, X } from "lucide-react";

const DISMISS_KEY = "fusion-install-dismissed";
const INSTALLED_KEY = "fusion-installed";
const QUIET_DAYS = 7; // after "not now", stay quiet this long

type InstallEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

const isInstalledNow = () =>
  window.matchMedia("(display-mode: standalone)").matches ||
  window.matchMedia("(display-mode: fullscreen)").matches ||
  window.matchMedia("(display-mode: minimal-ui)").matches ||
  (navigator as any).standalone === true;

const recentlyDismissed = () => {
  try {
    const t = Number(localStorage.getItem(DISMISS_KEY) || 0);
    return t > 0 && Date.now() - t < QUIET_DAYS * 24 * 60 * 60 * 1000;
  } catch {
    return false;
  }
};

export default function InstallPrompt() {
  const [mode, setMode] = useState<"none" | "android" | "ios">("none");
  const [visible, setVisible] = useState(false);
  const [leaving, setLeaving] = useState(false);
  const deferred = useRef<InstallEvent | null>(null);

  useEffect(() => {
    // lets Chrome / Edge / Samsung treat the site as an installable app
    if ("serviceWorker" in navigator && process.env.NODE_ENV === "production") {
      navigator.serviceWorker.register("/sw.js").catch(() => {});
    }

    let installed = false;
    try {
      installed = localStorage.getItem(INSTALLED_KEY) === "1";
    } catch {}
    if (installed || isInstalledNow() || recentlyDismissed()) return;

    const timers: ReturnType<typeof setTimeout>[] = [];

    const onPrompt = (e: Event) => {
      e.preventDefault(); // we show our own small banner instead of the browser's
      deferred.current = e as InstallEvent;
      setMode("android");
      timers.push(setTimeout(() => setVisible(true), 4500));
    };
    const onInstalled = () => {
      try {
        localStorage.setItem(INSTALLED_KEY, "1");
      } catch {}
      setVisible(false);
    };
    window.addEventListener("beforeinstallprompt", onPrompt);
    window.addEventListener("appinstalled", onInstalled);

    // iPhone / iPad Safari has no install event: show a how-to tip instead
    const ua = navigator.userAgent;
    const isIos = /iphone|ipad|ipod/i.test(ua);
    const isSafari = /safari/i.test(ua) && !/crios|fxios|edgios|opios/i.test(ua);
    if (isIos && isSafari) {
      setMode("ios");
      timers.push(setTimeout(() => setVisible(true), 6000));
    }

    return () => {
      window.removeEventListener("beforeinstallprompt", onPrompt);
      window.removeEventListener("appinstalled", onInstalled);
      timers.forEach(clearTimeout);
    };
  }, []);

  const close = (remember: boolean) => {
    if (remember) {
      try {
        localStorage.setItem(DISMISS_KEY, String(Date.now()));
      } catch {}
    }
    setLeaving(true);
    setTimeout(() => setVisible(false), 260);
  };

  const install = async () => {
    const ev = deferred.current;
    if (!ev) return close(true);
    try {
      await ev.prompt();
      const choice = await ev.userChoice;
      if (choice.outcome === "accepted") {
        try {
          localStorage.setItem(INSTALLED_KEY, "1");
        } catch {}
      } else {
        try {
          localStorage.setItem(DISMISS_KEY, String(Date.now()));
        } catch {}
      }
    } catch {}
    deferred.current = null;
    setLeaving(true);
    setTimeout(() => setVisible(false), 260);
  };

  if (!visible || mode === "none") return null;

  return (
    <>
      <style>{`
        .ip-wrap{position:fixed;left:0;right:0;z-index:80;display:flex;justify-content:center;
          top:calc(env(safe-area-inset-top, 0px) + 8px);padding:0 10px;pointer-events:none}
        .ip-card{pointer-events:auto;display:flex;align-items:center;gap:10px;width:100%;max-width:360px;
          padding:8px 8px 8px 10px;border-radius:9999px;background:#141418;color:#f4f5f8;
          border:1px solid rgba(255,255,255,.14);box-shadow:0 10px 28px rgba(0,0,0,.5);
          animation:ip-in .42s cubic-bezier(.22,1,.36,1) both}
        .ip-out{animation:ip-out .26s ease-in both}
        @keyframes ip-in{from{opacity:0;transform:translateY(-14px) scale(.97)}to{opacity:1;transform:none}}
        @keyframes ip-out{to{opacity:0;transform:translateY(-12px) scale(.97)}}
        .ip-icon{height:36px;width:36px;border-radius:12px;flex:none;object-fit:cover;background:#000}
        .ip-text{min-width:0;flex:1;line-height:1.15}
        .ip-t{font-size:13px;font-weight:800}
        .ip-s{font-size:11px;opacity:.65;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
        .ip-btn{height:34px;padding:0 16px;border-radius:9999px;background:#fff;color:#0b0c10;font-size:12.5px;font-weight:800;
          flex:none;transition:transform .3s cubic-bezier(.34,1.4,.64,1)}
        .ip-btn:active{transform:scale(.94)}
        .ip-x{height:32px;width:32px;border-radius:9999px;flex:none;display:flex;align-items:center;justify-content:center;opacity:.7}
        .theme-light .ip-card{background:#ffffff;color:#0E2F76;border-color:rgba(14,47,118,.2);box-shadow:0 10px 28px rgba(14,47,118,.22)}
        .theme-light .ip-btn{background:#0E2F76;color:#fff}
        @media (prefers-reduced-motion:reduce){.ip-card,.ip-out{animation:none}}
      `}</style>
      <div className="ip-wrap" role="dialog" aria-label="Install Fusion">
        <div className={`ip-card ${leaving ? "ip-out" : ""}`}>
          <img src="/app-icon/icon-192.png" alt="" className="ip-icon" />
          {mode === "android" ? (
            <>
              <div className="ip-text">
                <div className="ip-t">Install Fusion</div>
                <div className="ip-s">Add to your home screen</div>
              </div>
              <button type="button" className="ip-btn" onClick={install}>
                Install
              </button>
            </>
          ) : (
            <div className="ip-text">
              <div className="ip-t">Install Fusion</div>
              <div className="ip-s">
                Tap <Share className="inline h-3 w-3 align-[-1px]" /> then &ldquo;Add to Home Screen&rdquo;
              </div>
            </div>
          )}
          <button type="button" className="ip-x" aria-label="Not now" onClick={() => close(true)}>
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>
    </>
  );
}
