/**
 * lib/db.ts  -  the ONLY file that talks to Supabase (database, logins, storage).
 *
 * The rest of the app (app/page.tsx, app/settings/page.tsx ...) imports `db`
 * from here and never mentions Supabase. To move to another database later
 * (Firebase, Neon + Auth.js ...), rewrite the functions in this file and keep
 * the same names and return types. Nothing else has to change.
 */
import type { User } from "@supabase/supabase-js";
import { createClient } from "@/utils/supabase/client";

/* ------------------------------------------------------------------ */
/* Types used by the whole app (neutral, not Supabase-specific)        */
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
/* Supabase client (private to this file)                              */
/* ------------------------------------------------------------------ */

const sb = createClient();
const WALLPAPER_BUCKET = "wallpapers";

const toUser = (u: User | null | undefined): AppUser | null =>
  u
    ? {
        id: u.id,
        email: u.email ?? null,
        avatarId: (u.user_metadata?.avatar_id as string | undefined) ?? null,
        emailNotifications: u.user_metadata?.email_notifications !== false,
        providers: Array.from(new Set((u.identities ?? []).map((i) => i.provider))),
      }
    : null;

/* ------------------------------------------------------------------ */
/* Logins                                                              */
/* ------------------------------------------------------------------ */

async function getCurrentUser(): Promise<AppUser | null> {
  const {
    data: { session },
  } = await sb.auth.getSession();
  return toUser(session?.user);
}

/** Listen for login / logout / password-recovery. Returns an "unsubscribe" function. */
function onAuthChange(cb: (change: AuthChange) => void): () => void {
  const {
    data: { subscription },
  } = sb.auth.onAuthStateChange((event, session) => {
    if (event === "INITIAL_SESSION") return;
    cb({
      type: event === "PASSWORD_RECOVERY" ? "PASSWORD_RECOVERY" : "CHANGED",
      user: toUser(session?.user),
    });
  });
  return () => subscription.unsubscribe();
}

async function signInWithPassword(email: string, password: string): Promise<AppUser | null> {
  const { data, error } = await sb.auth.signInWithPassword({ email, password });
  if (error) throw error;
  return toUser(data.user);
}

async function signUpWithPassword(
  email: string,
  password: string
): Promise<{ user: AppUser | null; signedIn: boolean }> {
  const { data, error } = await sb.auth.signUp({ email, password });
  if (error) throw error;
  return { user: toUser(data.user), signedIn: !!(data.session && data.user) };
}

async function sendPasswordReset(email: string, redirectTo?: string): Promise<void> {
  const { error } = await sb.auth.resetPasswordForEmail(email, { redirectTo });
  if (error) throw error;
}

async function updatePassword(password: string): Promise<AppUser | null> {
  const { data, error } = await sb.auth.updateUser({ password });
  if (error) throw error;
  return toUser(data.user);
}

async function signInWithProvider(provider: OAuthProvider, redirectTo: string): Promise<void> {
  const { error } = await sb.auth.signInWithOAuth({ provider, options: { redirectTo } });
  if (error) throw error;
}

async function linkProvider(provider: OAuthProvider, redirectTo: string): Promise<void> {
  const { error } = await sb.auth.linkIdentity({ provider, options: { redirectTo } });
  if (error) throw error;
}

async function signOut(): Promise<void> {
  await sb.auth.signOut();
}

async function setUserAvatar(avatarId: string): Promise<void> {
  const { error } = await sb.auth.updateUser({ data: { avatar_id: avatarId } });
  if (error) throw error;
}

async function setEmailNotifications(enabled: boolean): Promise<void> {
  const { error } = await sb.auth.updateUser({ data: { email_notifications: enabled } });
  if (error) throw error;
}

/** Needs the delete_my_account() SQL function from the Settings setup. */
async function deleteMyAccount(): Promise<void> {
  const { error } = await sb.rpc("delete_my_account");
  if (error) throw error;
}

/* ------------------------------------------------------------------ */
/* Profiles                                                            */
/* ------------------------------------------------------------------ */

async function getProfile(userId: string): Promise<Profile | null> {
  const { data, error } = await sb
    .from("profiles")
    .select("id, display_name")
    .eq("id", userId)
    .maybeSingle();
  if (error || !data) return null;
  return { id: data.id, display_name: data.display_name };
}

async function saveProfileName(userId: string, displayName: string): Promise<void> {
  const { error } = await sb.from("profiles").upsert({
    id: userId,
    display_name: displayName,
    updated_at: new Date().toISOString(),
  });
  if (error) throw error;
}

/* ------------------------------------------------------------------ */
/* Saved wallpapers                                                    */
/* ------------------------------------------------------------------ */

/** Newest first. Returns null if the list could not be loaded. */
async function listSavedIds(userId: string): Promise<string[] | null> {
  const { data, error } = await sb
    .from("saved_wallpapers")
    .select("wallpaper_id")
    .eq("user_id", userId)
    .order("created_at", { ascending: false });
  if (error || !data) return null;
  return data.map((row: { wallpaper_id: string }) => row.wallpaper_id);
}

async function countSaved(userId: string): Promise<number> {
  const { count } = await sb
    .from("saved_wallpapers")
    .select("wallpaper_id", { count: "exact", head: true })
    .eq("user_id", userId);
  return count ?? 0;
}

async function saveWallpaper(userId: string, wallpaperId: string): Promise<void> {
  const { error } = await sb
    .from("saved_wallpapers")
    .upsert({ user_id: userId, wallpaper_id: wallpaperId }, { onConflict: "user_id,wallpaper_id" });
  if (error) throw error;
}

async function unsaveWallpaper(userId: string, wallpaperId: string): Promise<void> {
  const { error } = await sb
    .from("saved_wallpapers")
    .delete()
    .eq("user_id", userId)
    .eq("wallpaper_id", wallpaperId);
  if (error) throw error;
}

/* ------------------------------------------------------------------ */
/* Wallpapers                                                          */
/* ------------------------------------------------------------------ */

/** Everything, newest first. */
async function listWallpapers(): Promise<Wallpaper[]> {
  const { data, error } = await sb
    .from("wallpapers")
    .select("*")
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data as Wallpaper[]) || [];
}

async function getWallpaper(id: string): Promise<Wallpaper | null> {
  const { data } = await sb.from("wallpapers").select("*").eq("id", id).maybeSingle();
  return (data as Wallpaper) ?? null;
}

async function categoryHasWallpapers(category: string): Promise<boolean> {
  const { data } = await sb.from("wallpapers").select("id").eq("category", category).limit(1);
  return !!data && data.length > 0;
}

/** Adds a wallpaper row. Older tables without is_banner/tags still work. */
async function createWallpaper(row: NewWallpaper): Promise<Wallpaper | null> {
  const full = await sb.from("wallpapers").insert([row]).select().maybeSingle();
  if (!full.error) return (full.data as Wallpaper) ?? null;

  const basic = {
    title: row.title,
    image_url: row.image_url,
    storage_path: row.storage_path,
    category: row.category,
  };
  const fb = await sb.from("wallpapers").insert([basic]).select().maybeSingle();
  if (fb.error) throw fb.error;
  return (fb.data as Wallpaper) ?? null;
}

/** Changes category / banner flag / tags. Falls back if the tags column is missing. */
async function updateWallpaperDetails(id: string, d: WallpaperDetailsUpdate): Promise<void> {
  const full = await sb
    .from("wallpapers")
    .update({ category: d.category, is_banner: d.is_banner, tags: d.tags })
    .eq("id", id);
  if (!full.error) return;
  const fb = await sb
    .from("wallpapers")
    .update({ category: d.category, is_banner: d.is_banner })
    .eq("id", id);
  if (fb.error) throw fb.error;
}

/** Returns true if saved, false if it failed (callers may ignore failures). */
async function updateWallpaperTags(id: string, tags: string[]): Promise<boolean> {
  const { error } = await sb.from("wallpapers").update({ tags }).eq("id", id);
  return !error;
}

async function clearBanner(category: string): Promise<void> {
  await sb.from("wallpapers").update({ is_banner: false }).eq("category", category);
}

async function updateWallpaperUrl(id: string, imageUrl: string, storagePath: string): Promise<void> {
  const { error } = await sb
    .from("wallpapers")
    .update({ image_url: imageUrl, storage_path: storagePath })
    .eq("id", id);
  if (error) throw error;
}

/** Removes the row (and the old Supabase file if the image still lives there). */
async function deleteWallpaper(w: Pick<Wallpaper, "id" | "image_url" | "storage_path">): Promise<void> {
  if (w.storage_path && !w.image_url.includes("res.cloudinary.com")) {
    await sb.storage.from(WALLPAPER_BUCKET).remove([w.storage_path]);
  }
  const { error } = await sb.from("wallpapers").delete().eq("id", w.id);
  if (error) throw error;
}

/** Downloads an old image straight from Supabase storage. Null if not possible. */
async function downloadStoredFile(storagePath: string): Promise<Blob | null> {
  const { data, error } = await sb.storage.from(WALLPAPER_BUCKET).download(storagePath);
  return !error && data ? data : null;
}

export const db = {
  // logins
  getCurrentUser,
  onAuthChange,
  signInWithPassword,
  signUpWithPassword,
  sendPasswordReset,
  updatePassword,
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
