"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import type { LucideIcon } from "lucide-react";
import {
  ArrowLeft, Moon, Sun, Pencil, User as UserIcon, Lock, Bell, ShieldCheck,
  Link2, Globe, Waves, LogOut, Trash2, AlertTriangle, ChevronRight,
  Loader2, Palette, Settings as SettingsIcon,
} from "lucide-react";
import { db, type AppUser } from "@/lib/db";
import { AvatarBadge, AVATARS } from "@/components/avatars";

const AVATAR_IDS = ["ember", "moon", "bolt", "blade", "ghost", "crown", "skull", "star", "heart", "rocket"];

const applyTheme = (t: "dark" | "light") => {
  document.documentElement.classList.toggle("theme-light", t === "light");
  document.body.classList.toggle("theme-light", t === "light");
};

function Switch({ on, onChange, label }: { on: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <button
      type="button" role="switch" aria-checked={on} aria-label={label}
      onClick={() => onChange(!on)}
      className="relative h-7 w-12 shrink-0 rounded-full transition-colors duration-200"
      style={{ background: on ? "var(--s-accent)" : "var(--s-border)" }}
    >
      <span
        className="absolute left-0 top-0.5 h-6 w-6 rounded-full bg-white shadow transition-transform duration-200 ease-out"
        style={{ transform: on ? "translateX(22px)" : "translateX(2px)" }}
      />
    </button>
  );
}

function Row({ icon: Icon, label, sub, right, onClick }: {
  icon: LucideIcon; label: string; sub?: string; right?: React.ReactNode; onClick?: () => void;
}) {
  const inner = (
    <>
      <Icon className="h-5 w-5 shrink-0" style={{ color: "var(--s-text)" }} />
      <div className="min-w-0 flex-1">
        <p className="text-[15px]" style={{ color: "var(--s-text)" }}>{label}</p>
        {sub && <p className="text-xs" style={{ color: "var(--s-muted)" }}>{sub}</p>}
      </div>
      {right}
    </>
  );
  const cls = "flex w-full items-center gap-4 px-4 py-3.5 text-left";
  return onClick ? (
    <button type="button" onClick={onClick} className={`${cls} transition-opacity active:opacity-70`}>{inner}</button>
  ) : (
    <div className={cls}>{inner}</div>
  );
}

function Title({ icon: Icon, children, danger }: { icon: LucideIcon; children: React.ReactNode; danger?: boolean }) {
  return (
    <div className="mb-2 mt-6 flex items-center gap-2 px-1">
      <Icon className="h-5 w-5" style={{ color: danger ? "var(--s-danger)" : "var(--s-accent)" }} />
      <h2 className="text-[15px] font-semibold" style={{ color: danger ? "var(--s-danger)" : "var(--s-text)" }}>{children}</h2>
    </div>
  );
}

export default function SettingsPage() {
  const router = useRouter();
  const [user, setUser] = useState<AppUser | null>(null);
  const [ready, setReady] = useState(false);
  const [displayName, setDisplayName] = useState("");
  const [theme, setTheme] = useState<"dark" | "light">("dark");
  const [haptics, setHaptics] = useState(true);
  const [emailNotifs, setEmailNotifs] = useState(true);
  const [savedCount, setSavedCount] = useState(0);
  const [open, setOpen] = useState<"name" | "password" | "privacy" | null>(null);
  const [nameInput, setNameInput] = useState("");
  const [passInput, setPassInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const buzz = () => {
    if (haptics && typeof navigator !== "undefined") navigator.vibrate?.(10);
  };

  useEffect(() => {
    const t = localStorage.getItem("fusion-theme") === "light" ? "light" : "dark";
    setTheme(t);
    applyTheme(t);
    setHaptics(localStorage.getItem("fusion-haptics") !== "off");

    (async () => {
      const u = await db.getCurrentUser();
      if (!u) { router.replace("/"); return; }
      setUser(u);
      setEmailNotifs(u.emailNotifications);

      const [prof, count] = await Promise.all([db.getProfile(u.id), db.countSaved(u.id)]);
      const name = prof?.display_name || u.email?.split("@")[0] || "Shadow";
      setDisplayName(name);
      setNameInput(name);
      setSavedCount(count);
      setReady(true);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const flash = (ok: boolean, text: string) => setMsg({ ok, text });

  const chooseAvatar = async (id: string) => {
    if (!user) return;
    buzz();
    setUser({ ...user, avatarId: id });
    try {
      await db.setUserAvatar(id);
    } catch (err: any) {
      flash(false, err.message);
    }
  };

  const toggleTheme = (dark: boolean) => {
    const t = dark ? "dark" : "light";
    setTheme(t);
    applyTheme(t);
    localStorage.setItem("fusion-theme", t);
    buzz();
  };

  const toggleHaptics = (v: boolean) => {
    setHaptics(v);
    localStorage.setItem("fusion-haptics", v ? "on" : "off");
    if (v) navigator.vibrate?.(10);
  };

  const toggleEmailNotifs = async (v: boolean) => {
    setEmailNotifs(v);
    buzz();
    await db.setEmailNotifications(v).catch(() => {});
  };

  const saveName = async () => {
    if (!user || busy) return;
    const n = nameInput.trim();
    if (!n) return flash(false, "Name can't be empty.");
    setBusy(true);
    try {
      await db.saveProfileName(user.id, n);
    } catch (err: any) {
      setBusy(false);
      return flash(false, err.message);
    }
    setBusy(false);
    setDisplayName(n);
    setOpen(null);
    flash(true, "Name updated.");
  };

  const savePassword = async () => {
    if (busy) return;
    if (passInput.length < 6) return flash(false, "Password must be at least 6 characters.");
    setBusy(true);
    try {
      await db.updatePassword(passInput);
    } catch (err: any) {
      setBusy(false);
      return flash(false, err.message);
    }
    setBusy(false);
    setPassInput("");
    setOpen(null);
    flash(true, "Password updated.");
  };

  // Linking needs "Allow manual linking" enabled in the Supabase dashboard.
  const linkProvider = async (provider: "google") => {
    try {
      await db.linkProvider(provider, `${window.location.origin}/settings`);
    } catch (err: any) {
      flash(false, err.message);
    }
  };

  const signOut = async () => {
    await db.signOut();
    router.replace("/");
  };

  const deleteAccount = async () => {
    if (busy) return;
    setBusy(true);
    try {
      await db.deleteMyAccount();
    } catch (err: any) {
      setBusy(false);
      return flash(false, err.message);
    }
    await db.signOut();
    router.replace("/");
  };

  if (!ready || !user) {
    return (
      <div className="s-root flex min-h-screen items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin" style={{ color: "var(--s-muted)" }} />
        <style>{css}</style>
      </div>
    );
  }

  const providers = user.providers;
  const pretty = (p: string) => p.charAt(0).toUpperCase() + p.slice(1);
  const avatarId = user.avatarId ?? undefined;

  return (
    <div className="s-root min-h-screen">
      <style>{css}</style>
      <div className="fusion-page mx-auto w-full max-w-md md:max-w-4xl px-4 pb-14 pt-4">
        {/* Top bar */}
        <div className="flex items-center justify-between">
          <button type="button" aria-label="Back" onClick={() => router.back()} className="s-circle">
            <ArrowLeft className="h-5 w-5" />
          </button>
          <h1 className="text-lg font-bold" style={{ color: "var(--s-text)" }}>Settings</h1>
          <button type="button" aria-label="Toggle theme" onClick={() => toggleTheme(theme === "light")} className="s-circle">
            {theme === "light" ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}
          </button>
        </div>

        {msg && (
          <p
            className="mt-4 rounded-2xl border px-3 py-2 text-xs"
            style={{
              borderColor: msg.ok ? "rgba(52,211,153,.4)" : "rgba(255,90,106,.4)",
              color: msg.ok ? "#34d399" : "var(--s-danger)",
            }}
          >
            {msg.text}
          </p>
        )}

        <div className="md:grid md:grid-cols-2 md:gap-8 md:items-start">
          <div className="md:sticky md:top-6">
            {/* Profile card */}
            {(() => {
              const av = AVATARS.find((a) => a.id === avatarId);
              const from = av?.from ?? "#2a2a32";
              const to = av?.to ?? "#6a6a78";
              const light = theme === "light";
              return (
                <div
                  className="s-card mt-4"
                  style={{
                    background: light
                      ? `linear-gradient(135deg, ${to}3d 0%, ${from}1f 100%), #ffffff`
                      : `linear-gradient(135deg, ${from} 0%, ${to}66 100%), #0b0b0d`,
                    borderColor: light ? `${to}66` : `${to}55`,
                  }}
                >
                  <div className="flex items-center gap-3 p-3">
                    <div className="relative shrink-0">
                      <div
                        className="rounded-full p-[2px]"
                        style={{ boxShadow: `0 0 0 2px ${light ? from : "rgba(255,255,255,0.85)"}` }}
                      >
                        <AvatarBadge id={avatarId} name={displayName} size={52} />
                      </div>
                      <button
                        type="button"
                        aria-label="Edit avatar"
                        onClick={() => document.getElementById("avatar-grid")?.scrollIntoView({ behavior: "smooth" })}
                        className="absolute -bottom-1 -right-1 flex h-6 w-6 items-center justify-center rounded-full border"
                        style={{ background: "var(--s-bg)", borderColor: "var(--s-border)", color: "var(--s-text)" }}
                      >
                        <Pencil className="h-3 w-3" />
                      </button>
                    </div>
                    <div className="min-w-0">
                      <p className="truncate text-lg font-bold" style={{ color: "var(--s-text)" }}>{displayName}</p>
                      <p className="truncate text-xs" style={{ color: light ? "var(--s-muted)" : "rgba(255,255,255,0.75)" }}>
                        {user.email}
                      </p>
                    </div>
                  </div>
                </div>
              );
            })()}

            {/* Avatars */}
            <div id="avatar-grid" className="mb-2 mt-6 flex items-center justify-between px-1">
              <div className="flex items-center gap-2">
                <UserIcon className="h-5 w-5" style={{ color: "var(--s-accent)" }} />
                <h2 className="text-[15px] font-semibold" style={{ color: "var(--s-text)" }}>Choose Your Avatar</h2>
              </div>
              <span className="text-sm" style={{ color: "var(--s-muted)" }}>{savedCount} saved</span>
            </div>
            <div className="s-card grid grid-cols-5 gap-y-3 p-4">
              {AVATAR_IDS.filter((id) => AVATARS.some((a) => a.id === id)).map((id) => (
                <button
                  key={id} type="button" aria-label={`Avatar ${id}`} onClick={() => chooseAvatar(id)}
                  className="mx-auto rounded-full transition-transform duration-150 ease-out active:scale-90"
                  style={{ boxShadow: avatarId === id ? "0 0 0 2px var(--s-card), 0 0 0 4px var(--s-accent)" : "none" }}
                >
                  <AvatarBadge id={id} size={52} />
                </button>
              ))}
            </div>
          </div>

          <div>
            {/* Account settings */}
            <Title icon={SettingsIcon}>Account Settings</Title>
            <div className="s-card">
              <div className="s-item">
                <Row
                  icon={UserIcon} label="Change Name" onClick={() => setOpen(open === "name" ? null : "name")}
                  right={<ChevronRight className="h-5 w-5" style={{ color: "var(--s-muted)" }} />}
                />
                {open === "name" && (
                  <div className="fusion-rise flex gap-2 px-4 pb-4">
                    <input value={nameInput} onChange={(e) => setNameInput(e.target.value)} placeholder="Display name" className="s-input" />
                    <button type="button" onClick={saveName} disabled={busy} className="s-btn">Save</button>
                  </div>
                )}
              </div>
              <div className="s-item">
                <Row
                  icon={Lock} label="Change Password" onClick={() => setOpen(open === "password" ? null : "password")}
                  right={<ChevronRight className="h-5 w-5" style={{ color: "var(--s-muted)" }} />}
                />
                {open === "password" && (
                  <div className="fusion-rise flex gap-2 px-4 pb-4">
                    <input type="password" value={passInput} onChange={(e) => setPassInput(e.target.value)} placeholder="New password (min. 6)" className="s-input" />
                    <button type="button" onClick={savePassword} disabled={busy} className="s-btn">Save</button>
                  </div>
                )}
              </div>
              <div className="s-item">
                <Row icon={Bell} label="Email Notifications" right={<Switch on={emailNotifs} onChange={toggleEmailNotifs} label="Email notifications" />} />
              </div>
              <div className="s-item">
                <Row
                  icon={ShieldCheck} label="Privacy Settings" onClick={() => setOpen(open === "privacy" ? null : "privacy")}
                  right={<ChevronRight className="h-5 w-5" style={{ color: "var(--s-muted)" }} />}
                />
                {open === "privacy" && (
                  <p className="fusion-rise px-4 pb-4 text-xs" style={{ color: "var(--s-muted)" }}>
                    Your email is masked on your profile by default and is never shown on wallpapers you save.
                  </p>
                )}
              </div>
              <div className="s-item">
                <Row
                  icon={Link2} label="Linked Accounts"
                  sub={providers.length ? providers.map(pretty).join(", ") : "Email"}
                />
                <div className="flex flex-wrap gap-2 px-4 pb-4">
                  {!providers.includes("google") && (
                    <button type="button" onClick={() => linkProvider("google")} className="s-btn-ghost">Link Google Account</button>
                  )}
                </div>
              </div>
            </div>

            {/* App preferences */}
            <Title icon={Palette}>App Preferences</Title>
            <div className="s-card">
              <div className="s-item">
                <Row icon={Globe} label="Language" right={<span className="text-sm" style={{ color: "var(--s-muted)" }}>English</span>} />
              </div>
              <div className="s-item">
                <Row icon={Moon} label="Dark Mode" right={<Switch on={theme === "dark"} onChange={toggleTheme} label="Dark mode" />} />
              </div>
              <div className="s-item">
                <Row icon={Waves} label="Haptic Feedback" right={<Switch on={haptics} onChange={toggleHaptics} label="Haptic feedback" />} />
              </div>
            </div>

            {/* Danger zone */}
            <Title icon={AlertTriangle} danger>Danger Zone</Title>
            <button type="button" onClick={signOut} className="s-card flex h-14 w-full items-center justify-center gap-2 text-sm font-semibold transition-transform duration-150 active:scale-[0.98]" style={{ color: "var(--s-text)" }}>
              <LogOut className="h-5 w-5" /> Log Out
            </button>

            {!confirmDelete ? (
              <button
                type="button" onClick={() => setConfirmDelete(true)}
                className="mt-3 flex h-14 w-full items-center justify-center gap-2 rounded-3xl border text-sm font-semibold transition-transform duration-150 active:scale-[0.98]"
                style={{ borderColor: "rgba(255,90,106,.5)", color: "var(--s-danger)", background: "rgba(255,90,106,.06)" }}
              >
                <Trash2 className="h-5 w-5" /> Delete Account
              </button>
            ) : (
              <div className="mt-3 rounded-3xl border p-4" style={{ borderColor: "rgba(255,90,106,.5)", background: "rgba(255,90,106,.06)" }}>
                <p className="text-sm font-semibold" style={{ color: "var(--s-danger)" }}>Delete your account forever?</p>
                <p className="mt-1 text-xs" style={{ color: "var(--s-muted)" }}>Your profile and saved wallpapers will be removed. This can't be undone.</p>
                <div className="mt-3 flex gap-2">
                  <button type="button" onClick={() => setConfirmDelete(false)} className="s-btn-ghost flex-1 justify-center">Cancel</button>
                  <button type="button" onClick={deleteAccount} disabled={busy} className="flex h-10 flex-1 items-center justify-center rounded-full text-xs font-bold text-white" style={{ background: "var(--s-danger)" }}>
                    {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : "Yes, delete"}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

const css = `
.s-root{--s-bg:#000;--s-card:#0b0b0d;--s-border:rgba(255,255,255,.10);--s-text:#f2f0ef;--s-muted:rgba(242,240,239,.55);--s-accent:#6d5bf0;--s-tint:rgba(109,91,240,.14);--s-danger:#ff5a6a;background:var(--s-bg)}
.theme-light .s-root{--s-bg:#E9F0F9;--s-card:#ffffff;--s-border:rgba(14,47,118,.22);--s-text:#0E2F76;--s-muted:rgba(14,47,118,.6);--s-tint:rgba(109,91,240,.10)}
.s-card{background:var(--s-card);border:1px solid var(--s-border);border-radius:24px;overflow:hidden}
.theme-light .s-card{box-shadow:0 1px 2px rgba(14,47,118,.08),0 8px 22px rgba(14,47,118,.10)}
.s-item + .s-item{border-top:1px solid var(--s-border)}
.s-circle{height:44px;width:44px;border-radius:9999px;color:var(--s-text)}
.s-input{height:40px;min-width:0;flex:1;border-radius:9999px;border:1px solid var(--s-border);background:transparent;padding:0 14px;font-size:13px;color:var(--s-text);outline:none}
.s-btn{height:40px;border-radius:9999px;background:var(--s-text);padding:0 18px;font-size:12px;font-weight:700;color:var(--s-bg)}
.s-btn-ghost{height:40px;border-radius:9999px;padding:0 14px;font-size:12px;font-weight:600;color:var(--s-text)}
`;
