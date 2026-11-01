"use client";

export default function OAuthButtons({
  onGoogle,
}: {
  onGoogle: () => void;
  onApple?: () => void; // no longer used, kept so page.tsx doesn't need changing
}) {
  return (
    <div className="space-y-2 pt-1">
      <button
        type="button"
        onClick={onGoogle}
        className="flex h-11 w-full items-center justify-center gap-2 rounded-full border border-white/15 bg-white/[0.06] text-xs font-bold text-white transition-transform duration-150 active:scale-[0.98]"
      >
        <span className="flex h-5 w-5 items-center justify-center rounded-full bg-white text-[11px] font-black text-black">
          G
        </span>
        Continue with Google
      </button>
      <div className="flex items-center gap-3 pt-1 text-[10px] text-white/45">
        <span className="h-px flex-1 bg-white/10" /> or use email{" "}
        <span className="h-px flex-1 bg-white/10" />
      </div>
    </div>
  );
}
