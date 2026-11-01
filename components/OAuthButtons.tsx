"use client";
import { Apple } from "lucide-react";

export default function OAuthButtons({ onGoogle, onApple }: { onGoogle: () => void; onApple: () => void }) {
  const btn =
    "flex h-11 w-full items-center justify-center gap-2 rounded-full border border-white/15 bg-white/[0.06] text-xs font-bold text-white transition-transform duration-150 active:scale-[0.98]";
  return (
    <div className="space-y-2 pt-1">
      <button type="button" onClick={onGoogle} className={btn}>
        <span className="flex h-5 w-5 items-center justify-center rounded-full bg-white text-[11px] font-black text-black">G</span>
        Continue with Google
      </button>
      <button type="button" onClick={onApple} className={btn}>
        <Apple className="h-4 w-4" /> Continue with Apple
      </button>
      <div className="flex items-center gap-3 pt-1 text-[10px] text-white/45">
        <span className="h-px flex-1 bg-white/10" /> or use email <span className="h-px flex-1 bg-white/10" />
      </div>
    </div>
  );
}
