"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { Cookie } from "lucide-react";

const KEY = "fusion-cookie-consent";

/** Read the saved choice anywhere: "accepted" | "rejected" | null */
export function getCookieChoice(): "accepted" | "rejected" | null {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? (JSON.parse(raw).value as "accepted" | "rejected") : null;
  } catch {
    return null;
  }
}

export default function CookieConsent() {
  const pathname = usePathname();
  const [show, setShow] = useState(false);
  const [leaving, setLeaving] = useState(false);

  useEffect(() => {
    try {
      if (localStorage.getItem(KEY)) return;
    } catch {
      return;
    }
    const t = setTimeout(() => setShow(true), 900);
    return () => clearTimeout(t);
  }, []);

  const choose = (value: "accepted" | "rejected") => {
    try {
      localStorage.setItem(KEY, JSON.stringify({ value, at: Date.now() }));
    } catch {}
    window.dispatchEvent(new Event("fusion-cookie-consent"));
    setLeaving(true);
    setTimeout(() => setShow(false), 260);
  };

  if (!show) return null;

  return (
    <>
      <style>{`
        .fc-box{position:fixed;left:50%;z-index:70;width:calc(100% - 24px);max-width:380px;
          transform:translateX(-50%);border-radius:28px;padding:16px;
          background:linear-gradient(180deg,rgba(255,255,255,.10),rgba(255,255,255,.03)),rgba(14,15,20,.88);
          backdrop-filter:blur(14px) saturate(130%);-webkit-backdrop-filter:blur(14px) saturate(130%);
          border:1px solid rgba(255,255,255,.16);color:#f4f5f8;
          box-shadow:0 18px 44px rgba(0,0,0,.55),inset 0 1px 0 rgba(255,255,255,.22)}
        .fc-in{animation:fc-in .38s cubic-bezier(.22,1,.36,1) both}
        .fc-out{animation:fc-out .26s ease-in both}
        @keyframes fc-in{from{opacity:0;transform:translate(-50%,18px) scale(.97)}to{opacity:1;transform:translate(-50%,0) scale(1)}}
        @keyframes fc-out{to{opacity:0;transform:translate(-50%,14px) scale(.97)}}
        .fc-btn{height:42px;border-radius:9999px;font-size:13px;font-weight:700;flex:1;
          transition:transform .3s cubic-bezier(.34,1.4,.64,1)}
        .fc-btn:active{transform:scale(.95)}
        .fc-ghost{background:rgba(255,255,255,.09);border:1px solid rgba(255,255,255,.16);color:#f4f5f8}
        .fc-main{background:linear-gradient(180deg,#fff,#e9e9ee);color:#0b0c10}
        .theme-light .fc-box{background:linear-gradient(180deg,rgba(255,255,255,.95),rgba(236,241,250,.92));
          border-color:rgba(14,47,118,.22);color:#0E2F76;
          box-shadow:0 18px 44px rgba(14,47,118,.28),inset 0 1px 0 #fff}
        .theme-light .fc-ghost{background:#fff;border-color:rgba(14,47,118,.28);color:#0E2F76}
        .theme-light .fc-main{background:#0E2F76;color:#fff}
        @media (prefers-reduced-motion:reduce){.fc-in,.fc-out{animation:none}}
      `}</style>
      <div
        role="dialog"
        aria-label="Cookie preferences"
        className={`fc-box ${leaving ? "fc-out" : "fc-in"}`}
        style={{ bottom: pathname === "/login" ? 16 : 100 }}
      >
        <div className="flex items-start gap-3">
          <div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-white/10">
            <Cookie className="h-4 w-4" />
          </div>
          <div>
            <p className="text-sm font-bold">Cookies</p>
            <p className="mt-0.5 text-xs leading-relaxed opacity-75">
              We use cookies to keep you signed in and remember your settings. You can accept all
              cookies or reject the non-essential ones.
            </p>
          </div>
        </div>
        <div className="mt-3 flex gap-2">
          <button type="button" className="fc-btn fc-ghost" onClick={() => choose("rejected")}>
            Reject
          </button>
          <button type="button" className="fc-btn fc-main" onClick={() => choose("accepted")}>
            Accept
          </button>
        </div>
      </div>
    </>
  );
}
