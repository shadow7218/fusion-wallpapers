"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Allura } from "next/font/google";
import { ArrowRight, Eye, EyeOff, KeyRound, Loader2, Lock, Mail, Moon, Sun } from "lucide-react";
import { db, type Wallpaper } from "@/lib/db";
import { img } from "@/lib/img";
import { formatAuthError } from "@/lib/auth-errors";

const script = Allura({ subsets: ["latin"], weight: "400" });

type Mode = "SIGN_IN" | "SIGN_UP" | "VERIFY" | "FORGOT" | "RESET";

const applyTheme = (t: "dark" | "light") => {
  document.documentElement.classList.toggle("theme-light", t === "light");
  document.body.classList.toggle("theme-light", t === "light");
};

// Repeat the pictures so the endless scroll has enough height, then play the same set twice
const loopList = (col: Wallpaper[]): Wallpaper[] => {
  if (!col.length) return [];
  const base: Wallpaper[] = [];
  while (base.length < 4) base.push(...col);
  return [...base, ...base];
};

const isValidEmail = (v: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v.trim());

const TITLES: Record<Mode, string> = {
  SIGN_IN: "Welcome Back",
  SIGN_UP: "Create Account",
  VERIFY: "Verify Your Email",
  FORGOT: "Reset Password",
  RESET: "New Password",
};

function GoogleG() {
  return (
    <svg viewBox="0 0 48 48" className="h-5 w-5" aria-hidden>
      <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z" />
      <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z" />
      <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z" />
      <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z" />
    </svg>
  );
}

export default function LoginPage() {
  const router = useRouter();

  const [mode, setMode] = useState<Mode>("SIGN_IN");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [code, setCode] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [cooldown, setCooldown] = useState(0);
  const [theme, setTheme] = useState<"dark" | "light">("dark");
  const [art, setArt] = useState<Wallpaper[]>([]);
  const [nextPath, setNextPath] = useState("/");

  /* ---------- start-up: theme, where to go after login, art, already logged in ---------- */
  useEffect(() => {
    const t = localStorage.getItem("fusion-theme") === "light" ? "light" : "dark";
    setTheme(t);
    applyTheme(t);

    const n = new URLSearchParams(window.location.search).get("next");
    if (n && n.startsWith("/") && !n.startsWith("//")) setNextPath(n);

    (async () => {
      const u = await db.getCurrentUser();
      if (u) {
        router.replace(n && n.startsWith("/") && !n.startsWith("//") ? n : "/");
        return;
      }
      try {
        const all = await db.listWallpapers();
        const shuffled = [...all].sort(() => Math.random() - 0.5).slice(0, 18);
        setArt(shuffled);
      } catch {
        /* the page still works without the picture wall */
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (cooldown <= 0) return;
    const t = setTimeout(() => setCooldown((c) => c - 1), 1000);
    return () => clearTimeout(t);
  }, [cooldown]);

  const toggleTheme = () => {
    const t = theme === "dark" ? "light" : "dark";
    setTheme(t);
    applyTheme(t);
    localStorage.setItem("fusion-theme", t);
  };

  /* ---------- the three scrolling columns ---------- */
  const columns = useMemo(() => {
    const list = art.length ? art : [];
    const cols: Wallpaper[][] = [[], [], []];
    list.forEach((w, i) => cols[i % 3].push(w));
    return cols.map((c) => (c.length ? c : []));
  }, [art]);

  /* ---------- actions ---------- */
  const go = () => router.replace(nextPath);

  const run = async (fn: () => Promise<void>) => {
    if (loading) return;
    setError(null);
    setLoading(true);
    try {
      await fn();
    } catch (e: any) {
      setError(formatAuthError(e));
    } finally {
      setLoading(false);
    }
  };

  const cleanEmail = email.trim().toLowerCase();
  const defaultName = cleanEmail.split("@")[0] || "Shadow";

  const onSignIn = (e: React.FormEvent) => {
    e.preventDefault();
    if (!isValidEmail(cleanEmail)) return setError("Enter a valid email address.");
    if (!password) return setError("Enter your password.");
    run(async () => {
      const u = await db.signInWithPassword(cleanEmail, password);
      if (!u) throw new Error("Sign-in did not finish. Please try again.");
      go();
    });
  };

  const onSignUp = (e: React.FormEvent) => {
    e.preventDefault();
    if (!isValidEmail(cleanEmail)) return setError("Enter a valid email address.");
    if (password.length < 6) return setError("Password must be at least 6 characters.");
    if (password !== confirm) return setError("Passwords do not match.");
    run(async () => {
      const { user, signedIn } = await db.signUpWithPassword(cleanEmail, password);
      if (signedIn && user) {
        await db.saveProfileName(user.id, defaultName).catch(() => {});
        go();
        return;
      }
      setPassword("");
      setConfirm("");
      setCode("");
      setMode("VERIFY");
      setCooldown(60);
      setInfo(`We sent a 6-digit code to ${cleanEmail}.`);
    });
  };

  const onVerify = (e: React.FormEvent) => {
    e.preventDefault();
    if (code.trim().length < 4) return setError("Enter the code from your email.");
    run(async () => {
      const u = await db.verifyEmailCode(cleanEmail, code.trim());
      if (u) {
        await db.saveProfileName(u.id, defaultName).catch(() => {});
        go();
      } else {
        setCode("");
        setMode("SIGN_IN");
        setInfo("Email verified! Please sign in.");
      }
    });
  };

  const onForgot = (e: React.FormEvent) => {
    e.preventDefault();
    if (!isValidEmail(cleanEmail)) return setError("Enter a valid email address.");
    run(async () => {
      await db.sendPasswordResetCode(cleanEmail);
      setCode("");
      setPassword("");
      setConfirm("");
      setMode("RESET");
      setCooldown(60);
      setInfo(`We sent a 6-digit code to ${cleanEmail}.`);
    });
  };

  const onReset = (e: React.FormEvent) => {
    e.preventDefault();
    if (code.trim().length < 4) return setError("Enter the code from your email.");
    if (password.length < 6) return setError("Password must be at least 6 characters.");
    if (password !== confirm) return setError("Passwords do not match.");
    run(async () => {
      await db.resetPasswordWithCode(cleanEmail, code.trim(), password);
      setPassword("");
      setConfirm("");
      setCode("");
      setMode("SIGN_IN");
      setInfo("Password updated! Sign in with your new password.");
    });
  };

  const onResend = async () => {
    if (cooldown > 0 || loading) return;
    setError(null);
    try {
      if (mode === "VERIFY") await db.resendVerificationCode(cleanEmail);
      else await db.sendPasswordResetCode(cleanEmail);
      setCooldown(60);
      setInfo("A new code is on its way.");
    } catch (e: any) {
      setError(formatAuthError(e));
    }
  };

  const onGoogle = () =>
    run(async () => {
      await db.signInWithProvider("google", `${window.location.origin}${nextPath}`);
    });

  const switchMode = (m: Mode) => {
    setMode(m);
    setError(null);
    setInfo(null);
    setShowPw(false);
  };

  const pwType = showPw ? "text" : "password";

  return (
    <div className="lg-root relative min-h-[100dvh] overflow-x-hidden">
      <style>{css}</style>

      {/* ============ top: logo, headline, scrolling wallpapers ============ */}
      <div className="absolute inset-x-0 top-0 h-[58dvh] overflow-hidden">
        <div className="lg-tilt" aria-hidden>
          {columns.map((col, ci) => (
            <div key={ci} className="lg-colwrap">
              {col.length > 0 && (
                <div className={`lg-col ${ci === 1 ? "down" : "up"}`} style={{ animationDuration: `${44 + ci * 6}s` }}>
                  {loopList(col).map((w, i) => (
                    <div key={`${w.id}-${i}`} className="lg-card">
                      <img src={img(w, 320)} alt="" draggable={false} loading={i < 3 ? "eager" : "lazy"} />
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
        <div className="lg-fade" />

        <div className="absolute left-5 top-5 z-20 flex items-center gap-3">
          <img src="/logo.webp" alt="Fusion" className="h-12 w-12 rounded-2xl border border-white/20 object-cover" />
          <span className="text-2xl font-extrabold tracking-tight">FUSION</span>
        </div>

        <button
          type="button"
          aria-label="Switch light or dark"
          onClick={toggleTheme}
          className="lg-ghost absolute right-4 top-5 z-20 flex h-10 w-10 items-center justify-center rounded-full"
        >
          {theme === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
        </button>

        <h1 className={`${script.className} lg-title absolute left-4 top-[19%] z-20 select-none`}>
          <span className="block">Find the</span>
          <span className="block pl-10">Best</span>
          <span className="block">Wallpapers</span>
        </h1>
      </div>

      {/* ============ bottom: liquid glass sheet ============ */}
      <div className="lg-sheet relative z-30 mt-[44dvh] min-h-[56dvh] px-6 pb-10 pt-8">
        <h2 className="text-[32px] font-extrabold leading-tight tracking-tight">{TITLES[mode]}</h2>

        {mode === "VERIFY" && (
          <p className="mt-1 text-sm" style={{ color: "var(--lg-muted)" }}>
            Enter the code we emailed you.
          </p>
        )}
        {mode === "FORGOT" && (
          <p className="mt-1 text-sm" style={{ color: "var(--lg-muted)" }}>
            We&apos;ll email you a 6-digit code.
          </p>
        )}

        {info && <p className="lg-note mt-3">{info}</p>}
        {error && <p className="lg-note lg-err mt-3">{error}</p>}

        {/* ----- sign in ----- */}
        {mode === "SIGN_IN" && (
          <form onSubmit={onSignIn} className="mt-4 space-y-3">
            <label className="lg-field">
              <Mail className="h-5 w-5 shrink-0" />
              <input type="email" autoComplete="email" placeholder="Email" value={email} onChange={(e) => setEmail(e.target.value)} />
            </label>
            <label className="lg-field">
              <Lock className="h-5 w-5 shrink-0" />
              <input type={pwType} autoComplete="current-password" placeholder="Password" value={password} onChange={(e) => setPassword(e.target.value)} />
              <button type="button" aria-label={showPw ? "Hide password" : "Show password"} onClick={() => setShowPw((s) => !s)}>
                {showPw ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
              </button>
            </label>
            <div className="flex justify-end">
              <button type="button" className="lg-link text-sm" onClick={() => switchMode("FORGOT")}>
                Forgot Password?
              </button>
            </div>
            <button type="submit" className="lg-btn lg-primary" disabled={loading}>
              {loading ? <Loader2 className="h-5 w-5 animate-spin" /> : "Log in"}
            </button>
          </form>
        )}

        {/* ----- sign up ----- */}
        {mode === "SIGN_UP" && (
          <form onSubmit={onSignUp} className="mt-4 space-y-3">
            <label className="lg-field">
              <Mail className="h-5 w-5 shrink-0" />
              <input type="email" autoComplete="email" placeholder="Email" value={email} onChange={(e) => setEmail(e.target.value)} />
            </label>
            <label className="lg-field">
              <Lock className="h-5 w-5 shrink-0" />
              <input type={pwType} autoComplete="new-password" placeholder="Password (min. 6)" value={password} onChange={(e) => setPassword(e.target.value)} />
              <button type="button" aria-label={showPw ? "Hide password" : "Show password"} onClick={() => setShowPw((s) => !s)}>
                {showPw ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
              </button>
            </label>
            <label className="lg-field">
              <Lock className="h-5 w-5 shrink-0" />
              <input type={pwType} autoComplete="new-password" placeholder="Confirm password" value={confirm} onChange={(e) => setConfirm(e.target.value)} />
            </label>
            <button type="submit" className="lg-btn lg-primary mt-1" disabled={loading}>
              {loading ? <Loader2 className="h-5 w-5 animate-spin" /> : "Create account"}
            </button>
          </form>
        )}

        {/* ----- verify email ----- */}
        {mode === "VERIFY" && (
          <form onSubmit={onVerify} className="mt-4 space-y-3">
            <label className="lg-field">
              <KeyRound className="h-5 w-5 shrink-0" />
              <input
                inputMode="numeric"
                autoComplete="one-time-code"
                maxLength={8}
                placeholder="6-digit code"
                value={code}
                onChange={(e) => setCode(e.target.value.replace(/\s/g, ""))}
                className="tracking-[0.3em]"
              />
            </label>
            <button type="submit" className="lg-btn lg-primary" disabled={loading}>
              {loading ? <Loader2 className="h-5 w-5 animate-spin" /> : "Verify & continue"}
            </button>
            <div className="flex items-center justify-between pt-1 text-sm">
              <button type="button" className="lg-link" onClick={() => switchMode("SIGN_UP")}>
                Back
              </button>
              <button type="button" className="lg-link disabled:opacity-50" disabled={cooldown > 0} onClick={onResend}>
                {cooldown > 0 ? `Resend code in ${cooldown}s` : "Resend code"}
              </button>
            </div>
          </form>
        )}

        {/* ----- forgot ----- */}
        {mode === "FORGOT" && (
          <form onSubmit={onForgot} className="mt-4 space-y-3">
            <label className="lg-field">
              <Mail className="h-5 w-5 shrink-0" />
              <input type="email" autoComplete="email" placeholder="Email" value={email} onChange={(e) => setEmail(e.target.value)} />
            </label>
            <button type="submit" className="lg-btn lg-primary" disabled={loading}>
              {loading ? <Loader2 className="h-5 w-5 animate-spin" /> : "Send reset code"}
            </button>
            <div className="pt-1 text-sm">
              <button type="button" className="lg-link" onClick={() => switchMode("SIGN_IN")}>
                Back to Sign In
              </button>
            </div>
          </form>
        )}

        {/* ----- reset with code ----- */}
        {mode === "RESET" && (
          <form onSubmit={onReset} className="mt-4 space-y-3">
            <label className="lg-field">
              <KeyRound className="h-5 w-5 shrink-0" />
              <input
                inputMode="numeric"
                autoComplete="one-time-code"
                maxLength={8}
                placeholder="6-digit code"
                value={code}
                onChange={(e) => setCode(e.target.value.replace(/\s/g, ""))}
                className="tracking-[0.3em]"
              />
            </label>
            <label className="lg-field">
              <Lock className="h-5 w-5 shrink-0" />
              <input type={pwType} autoComplete="new-password" placeholder="New password (min. 6)" value={password} onChange={(e) => setPassword(e.target.value)} />
              <button type="button" aria-label={showPw ? "Hide password" : "Show password"} onClick={() => setShowPw((s) => !s)}>
                {showPw ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
              </button>
            </label>
            <label className="lg-field">
              <Lock className="h-5 w-5 shrink-0" />
              <input type={pwType} autoComplete="new-password" placeholder="Confirm new password" value={confirm} onChange={(e) => setConfirm(e.target.value)} />
            </label>
            <button type="submit" className="lg-btn lg-primary" disabled={loading}>
              {loading ? <Loader2 className="h-5 w-5 animate-spin" /> : "Update password"}
            </button>
            <div className="flex items-center justify-between pt-1 text-sm">
              <button type="button" className="lg-link" onClick={() => switchMode("SIGN_IN")}>
                Back to Sign In
              </button>
              <button type="button" className="lg-link disabled:opacity-50" disabled={cooldown > 0} onClick={onResend}>
                {cooldown > 0 ? `Resend code in ${cooldown}s` : "Resend code"}
              </button>
            </div>
          </form>
        )}

        {/* ----- Google + switch + guest (sign in / sign up only) ----- */}
        {(mode === "SIGN_IN" || mode === "SIGN_UP") && (
          <>
            <div className="lg-or my-5">
              <span />
              <p>Or continue with</p>
              <span />
            </div>

            <button type="button" className="lg-btn lg-ghost" onClick={onGoogle} disabled={loading}>
              <GoogleG />
              <span>Continue with Google</span>
            </button>

            <p className="mt-6 text-center text-[15px]">
              {mode === "SIGN_IN" ? "Don't have any account?" : "Already have an account?"}{" "}
              <button
                type="button"
                className="lg-link font-extrabold"
                onClick={() => switchMode(mode === "SIGN_IN" ? "SIGN_UP" : "SIGN_IN")}
              >
                {mode === "SIGN_IN" ? "Sign Up" : "Sign In"}
              </button>
            </p>

            <button type="button" className="lg-link mx-auto mt-6 flex items-center gap-2 text-[15px] font-bold" onClick={() => router.push("/")}>
              Quick view as Guest <ArrowRight className="h-4 w-4" />
            </button>
          </>
        )}
      </div>
    </div>
  );
}

const css = `
.lg-root{
  --lg-bg:#05060a; --lg-text:#f4f5f8; --lg-muted:rgba(244,245,248,.62);
  --lg-sheet:rgba(16,18,26,.80); --lg-sheet-line:rgba(255,255,255,.16);
  --lg-field:rgba(255,255,255,.07); --lg-field-line:rgba(255,255,255,.14); --lg-field-text:#f4f5f8;
  --lg-primary:linear-gradient(180deg,#ffffff,#e6e7ec); --lg-primary-text:#0b0c10;
  --lg-ghost:rgba(255,255,255,.08); --lg-ghost-line:rgba(255,255,255,.16); --lg-ghost-text:#f4f5f8;
  --lg-card-line:rgba(255,255,255,.22); --lg-fade:#05060a;
  background:var(--lg-bg); color:var(--lg-text);
}
.theme-light .lg-root{
  --lg-bg:#ffffff; --lg-text:#0b0c10; --lg-muted:rgba(11,12,16,.62);
  --lg-sheet:rgba(201,208,218,.92); --lg-sheet-line:rgba(255,255,255,.75);
  --lg-field:#2e2d4b; --lg-field-line:rgba(255,255,255,.10); --lg-field-text:#ffffff;
  --lg-primary:#2e2d4b; --lg-primary-text:#ffffff;
  --lg-ghost:#2e2d4b; --lg-ghost-line:rgba(255,255,255,.10); --lg-ghost-text:#ffffff;
  --lg-card-line:#000000; --lg-fade:#ffffff;
}

/* ---- scrolling, tilted wallpaper wall ---- */
.lg-tilt{position:absolute;right:-26%;top:-14%;width:92%;height:150%;display:flex;gap:12px;
  transform:rotate(-27deg);transform-origin:center}
.lg-colwrap{flex:1;min-width:0;overflow:hidden}
.lg-col{display:flex;flex-direction:column;will-change:transform}
.lg-col.up{animation:lg-up 44s linear infinite}
.lg-col.down{animation:lg-down 50s linear infinite}
@keyframes lg-up{from{transform:translateY(0)}to{transform:translateY(-50%)}}
@keyframes lg-down{from{transform:translateY(-50%)}to{transform:translateY(0)}}
.lg-card{aspect-ratio:9/16;border-radius:26px;overflow:hidden;margin-bottom:12px;background:#15161c;
  border:3px solid var(--lg-card-line)}
.lg-card img{width:100%;height:100%;object-fit:cover;display:block}
.lg-fade{position:absolute;inset:auto 0 0 0;height:38%;background:linear-gradient(to bottom,transparent,var(--lg-fade))}
.lg-title{font-size:60px;line-height:.95;text-shadow:0 2px 20px rgba(0,0,0,.55)}
.theme-light .lg-title{text-shadow:none}

/* ---- liquid glass sheet ---- */
.lg-sheet{
  position:relative;border-radius:42px 42px 0 0;
  background:linear-gradient(180deg,rgba(255,255,255,.12),rgba(255,255,255,.02) 35%),var(--lg-sheet);
  backdrop-filter:blur(16px) saturate(140%);-webkit-backdrop-filter:blur(16px) saturate(140%);
  border:1px solid var(--lg-sheet-line);border-bottom:none;
  box-shadow:0 -20px 54px rgba(0,0,0,.38),inset 0 1.5px 0 rgba(255,255,255,.38);
}
.lg-sheet::before{content:"";position:absolute;left:18%;right:18%;top:0;height:2px;border-radius:2px;
  background:linear-gradient(90deg,transparent,rgba(255,255,255,.65),transparent)}

/* ---- fields and buttons ---- */
.lg-field{display:flex;align-items:center;gap:12px;height:56px;border-radius:9999px;padding:0 20px;
  background:var(--lg-field);border:1px solid var(--lg-field-line);color:var(--lg-field-text);
  box-shadow:inset 0 2px 6px rgba(0,0,0,.25)}
.lg-field input{flex:1;min-width:0;background:transparent;border:0;outline:0;color:inherit;font-size:16px}
.lg-field input::placeholder{color:inherit;opacity:.55}
.lg-field button{display:flex;color:inherit;opacity:.8}

.lg-btn{display:flex;width:100%;align-items:center;justify-content:center;gap:10px;height:56px;
  border-radius:9999px;font-size:17px;font-weight:800;position:relative;
  transition:transform .32s cubic-bezier(.34,1.4,.64,1),opacity .2s}
.lg-btn:active{transform:scale(.96)}
.lg-btn:disabled{opacity:.7}
.lg-primary{background:var(--lg-primary);color:var(--lg-primary-text);
  box-shadow:inset 0 1px 0 rgba(255,255,255,.7),0 8px 22px rgba(0,0,0,.28)}
.lg-ghost{background:var(--lg-ghost);color:var(--lg-ghost-text);border:1px solid var(--lg-ghost-line);
  box-shadow:inset 0 1px 0 rgba(255,255,255,.12),0 4px 14px rgba(0,0,0,.22);
  transition:transform .32s cubic-bezier(.34,1.4,.64,1)}
.lg-ghost:active{transform:scale(.95)}
.lg-link{color:var(--lg-text);font-weight:700;opacity:.9}
.lg-note{border-radius:16px;padding:10px 14px;font-size:13px;border:1px solid var(--lg-sheet-line);
  background:rgba(255,255,255,.08)}
.lg-err{color:#ff8a94;border-color:rgba(255,120,130,.4);background:rgba(255,80,95,.1)}
.theme-light .lg-err{color:#b3202e}
.lg-or{display:flex;align-items:center;gap:14px}
.lg-or span{height:1px;flex:1;background:var(--lg-text);opacity:.35}
.lg-or p{font-size:15px;font-weight:700}

@media (min-width:768px){
  .lg-root{display:flex;justify-content:center}
  .lg-sheet{max-width:520px;width:100%;margin-left:auto;margin-right:auto}
}
@media (prefers-reduced-motion:reduce){.lg-col{animation:none!important}.lg-btn,.lg-ghost{transition:none}}
`;
