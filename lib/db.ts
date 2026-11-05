/**
 * lib/db.ts  -  the ONLY file the app uses to reach the database and logins.
 *
 * Now powered by:
 *   - Neon (Postgres) through our own API routes in app/api/*
 *   - Neon Auth (Better Auth) for sign-up / sign-in / codes / Google
 *
 * The rest of the app (app/page.tsx, app/settings/page.tsx ...) only imports
 * `db` from here. Same function names as before, so nothing else changed.
 */
import { authClient } from "@/lib/auth/client";

/* ------------------------------------------------------------------ */
/* Types used by the whole app                                         */
/* ------------------------------------------------------------------ */

export interface Wallpaper {
  id: string;
  title: string;
  image_url: string;
  storage_path: string;
  category?: string | null;
  is_banner?: boolean;
  tags?: string[] | null;
  downloads: number;
  created_at: string;
}

export interface NewWallpaper {
  title: string;
  image_url: string;
  storage_path: string;
  category: string | null;
  is_banner?: boolean;
  tags?: string[];
}

export interface WallpaperDetailsUpdate {
  category: string | null;
  is_banner: boolean;
  tags: string[];
}

export interface AppUser {
  id: string;
  email: string | null;
  avatarId: string | null;
  emailNotifications: boolean;
  providers: string[];
  isAdmin: boolean;
}

export interface Profile {
  id: string;
  display_name: string;
}

export type OAuthProvider = "google" | "apple";

export type AuthChange = {
  type: "PASSWORD_RECOVERY" | "CHANGED";
  user: AppUser | null;
};

/* ------------------------------------------------------------------ */
/* Helpers (private)                                                   */
/* ------------------------------------------------------------------ */

// The Neon Auth client is used loosely so a small SDK change can't break the build.
const ac = authClient as any;

async function api<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, {
    credentials: "same-origin",
    ...init,
    headers: { "Content-Type": "application/json", ...(init?.headers || {}) },
  });
  const body = await res.json().catch(() => null);
  if (!res.ok) {
    const err: any = new Error(body?.error || `Request failed (${res.status})`);
    err.status = res.status;
    throw err;
  }
  return body as T;
}

const toError = (e: any): Error =>
  Object.assign(new Error(e?.message || "Something went wrong. Please try again."), {
    status: e?.status,
    code: e?.code,
  });

/** "https://site.com/page?x=1" -> "/page?x=1" (Neon Auth wants a path on our own site). */
const toPath = (url: string): string => {
  try {
    const u = new URL(url, window.location.origin);
    return u.pathname + u.search;
  } catch {
    return "/";
  }
};

/**
 * Finishes a Google sign-in. When Google sends the visitor back, the address
 * carries a one-time code (neon_auth_session_verifier). The Neon client has to
 * exchange it for a login session, which happens when it loads the session.
 */
async function syncClientSession(): Promise<void> {
  try {
    await ac.getSession();
  } catch {
    /* not signed in, that's fine */
  }
  if (typeof window !== "undefined" && window.location.search.includes("neon_auth_session_verifier")) {
    const url = new URL(window.location.href);
    url.searchParams.delete("neon_auth_session_verifier");
    window.history.replaceState({}, "", url.pathname + url.search + url.hash);
  }
}

const listeners = new Set<(c: AuthChange) => void>();
const emit = (user: AppUser | null) => listeners.forEach((cb) => cb({ type: "CHANGED", user }));

type MeResponse = { user: AppUser | null; profile?: Profile | null };
let lastProfile: Profile | null = null;

async function loadMe(): Promise<AppUser | null> {
  try {
    const r = await api<MeResponse>("/api/me");
    lastProfile = r.profile ?? null;
    return r.user;
  } catch {
    return null;
  }
}

async function refreshAndEmit(): Promise<AppUser | null> {
  const u = await loadMe();
  emit(u);
  return u;
}

/* ------------------------------------------------------------------ */
/* Logins                                                              */
/* ------------------------------------------------------------------ */

async function getCurrentUser(): Promise<AppUser | null> {
  await syncClientSession();
  return loadMe();
}

/** Listen for login / logout. Returns an "unsubscribe" function. */
function onAuthChange(cb: (change: AuthChange) => void): () => void {
  listeners.add(cb);
  return () => {
    listeners.delete(cb);
  };
}

async function signInWithPassword(email: string, password: string): Promise<AppUser | null> {
  const { error } = await ac.signIn.email({ email, password });
  if (error) throw toError(error);
  return refreshAndEmit();
}

/**
 * Creates the account. With "Verify at sign-up" ON, a 6-digit code is emailed and
 * signedIn is false until verifyEmailCode() succeeds.
 */
async function signUpWithPassword(
  email: string,
  password: string
): Promise<{ user: AppUser | null; signedIn: boolean }> {
  const name = email.split("@")[0] || "Fusion user";
  const { error } = await ac.signUp.email({ email, password, name });
  if (error) throw toError(error);
  const u = await loadMe();
  if (u) emit(u);
  return { user: u, signedIn: !!u };
}

async function verifyEmailCode(email: string, code: string): Promise<AppUser | null> {
  const { error } = await ac.emailOtp.verifyEmail({ email, otp: code });
  if (error) throw toError(error);
  return refreshAndEmit();
}

async function resendVerificationCode(email: string): Promise<void> {
  const { error } = await ac.emailOtp.sendVerificationOtp({ email, type: "email-verification" });
  if (error) throw toError(error);
}

async function sendPasswordResetCode(email: string): Promise<void> {
  const res = ac.forgetPassword?.emailOtp
    ? await ac.forgetPassword.emailOtp({ email })
    : await ac.emailOtp.sendVerificationOtp({ email, type: "forget-password" });
  if (res?.error) throw toError(res.error);
}

async function resetPasswordWithCode(email: string, code: string, newPassword: string): Promise<void> {
  const { error } = await ac.emailOtp.resetPassword({ email, otp: code, password: newPassword });
  if (error) throw toError(error);
}

/** Logged-in password change. Needs the current password. */
async function changePassword(currentPassword: string, newPassword: string): Promise<void> {
  const { error } = await ac.changePassword({ currentPassword, newPassword });
  if (error) throw toError(error);
}

async function signInWithProvider(provider: OAuthProvider, redirectTo: string): Promise<void> {
  const { error } = await ac.signIn.social({ provider, callbackURL: toPath(redirectTo) });
  if (error) throw toError(error);
}

async function linkProvider(provider: OAuthProvider, redirectTo: string): Promise<void> {
  if (typeof ac.linkSocial !== "function") {
    throw new Error("Linking another account is not available yet.");
  }
  const { error } = await ac.linkSocial({ provider, callbackURL: toPath(redirectTo) });
  if (error) throw toError(error);
}

async function signOut(): Promise<void> {
  try {
    await ac.signOut();
  } finally {
    lastProfile = null;
    emit(null);
  }
}

async function setUserAvatar(avatarId: string): Promise<void> {
  await api("/api/me", { method: "PATCH", body: JSON.stringify({ avatar_id: avatarId }) });
}

async function setEmailNotifications(enabled: boolean): Promise<void> {
  await api("/api/me", { method: "PATCH", body: JSON.stringify({ email_notifications: enabled }) });
}

/** Removes my profile + saved list (and my login if the server is allowed to). */
async function deleteMyAccount(): Promise<void> {
  await api("/api/me", { method: "DELETE" });
}

/* ------------------------------------------------------------------ */
/* Profiles                                                            */
/* ------------------------------------------------------------------ */

async function getProfile(_userId: string): Promise<Profile | null> {
  if (lastProfile) return lastProfile;
  await loadMe();
  return lastProfile;
}

async function saveProfileName(_userId: string, displayName: string): Promise<void> {
  await api("/api/me", { method: "PATCH", body: JSON.stringify({ display_name: displayName }) });
  const cur = lastProfile as Profile | null;
  lastProfile = { id: cur?.id ?? _userId, display_name: displayName };
}

/* ------------------------------------------------------------------ */
/* Saved wallpapers                                                    */
/* ------------------------------------------------------------------ */

/** Newest first. Returns null if the list could not be loaded. */
async function listSavedIds(_userId: string): Promise<string[] | null> {
  try {
    return (await api<{ ids: string[] }>("/api/saved")).ids;
  } catch {
    return null;
  }
}

async function countSaved(userId: string): Promise<number> {
  return (await listSavedIds(userId))?.length ?? 0;
}

async function saveWallpaper(_userId: string, wallpaperId: string): Promise<void> {
  await api("/api/saved", { method: "POST", body: JSON.stringify({ wallpaperId }) });
}

async function unsaveWallpaper(_userId: string, wallpaperId: string): Promise<void> {
  await api(`/api/saved?wallpaperId=${encodeURIComponent(wallpaperId)}`, { method: "DELETE" });
}

/* ------------------------------------------------------------------ */
/* Wallpapers                                                          */
/* ------------------------------------------------------------------ */

async function listWallpapers(): Promise<Wallpaper[]> {
  return api<Wallpaper[]>("/api/wallpapers", { cache: "no-store" });
}

async function getWallpaper(id: string): Promise<Wallpaper | null> {
  try {
    return await api<Wallpaper | null>(`/api/wallpapers/${encodeURIComponent(id)}`);
  } catch {
    return null;
  }
}

async function categoryHasWallpapers(category: string): Promise<boolean> {
  try {
    return (await api<{ has: boolean }>(`/api/wallpapers?category=${encodeURIComponent(category)}`)).has;
  } catch {
    return false;
  }
}

async function createWallpaper(row: NewWallpaper): Promise<Wallpaper | null> {
  return api<Wallpaper>("/api/wallpapers", { method: "POST", body: JSON.stringify(row) });
}

async function updateWallpaperDetails(id: string, d: WallpaperDetailsUpdate): Promise<void> {
  await api(`/api/wallpapers/${encodeURIComponent(id)}`, { method: "PATCH", body: JSON.stringify(d) });
}

/** Returns true if saved, false if it failed (callers may ignore failures). */
async function updateWallpaperTags(id: string, tags: string[]): Promise<boolean> {
  try {
    await api(`/api/wallpapers/${encodeURIComponent(id)}`, { method: "PATCH", body: JSON.stringify({ tags }) });
    return true;
  } catch {
    return false;
  }
}

async function clearBanner(category: string): Promise<void> {
  await api("/api/wallpapers", { method: "PATCH", body: JSON.stringify({ action: "clearBanner", category }) });
}

async function updateWallpaperUrl(id: string, imageUrl: string, storagePath: string): Promise<void> {
  await api(`/api/wallpapers/${encodeURIComponent(id)}`, {
    method: "PATCH",
    body: JSON.stringify({ image_url: imageUrl, storage_path: storagePath }),
  });
}

/** Removes the row. (Cloudinary files stay until deleted in Cloudinary.) */
async function deleteWallpaper(w: Pick<Wallpaper, "id" | "image_url" | "storage_path">): Promise<void> {
  await api(`/api/wallpapers/${encodeURIComponent(w.id)}`, { method: "DELETE" });
}

/** Old Supabase storage is gone, so downloads use the image link instead. */
async function downloadStoredFile(_storagePath: string): Promise<Blob | null> {
  return null;
}

export const db = {
  // logins
  getCurrentUser,
  onAuthChange,
  signInWithPassword,
  signUpWithPassword,
  verifyEmailCode,
  resendVerificationCode,
  sendPasswordResetCode,
  resetPasswordWithCode,
  changePassword,
  signInWithProvider,
  linkProvider,
  signOut,
  setUserAvatar,
  setEmailNotifications,
  deleteMyAccount,
  // profiles
  getProfile,
  saveProfileName,
  // saved wallpapers
  listSavedIds,
  countSaved,
  saveWallpaper,
  unsaveWallpaper,
  // wallpapers
  listWallpapers,
  getWallpaper,
  categoryHasWallpapers,
  createWallpaper,
  updateWallpaperDetails,
  updateWallpaperTags,
  clearBanner,
  updateWallpaperUrl,
  deleteWallpaper,
  downloadStoredFile,
};
