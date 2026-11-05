import { createAuthClient } from "better-auth/react";

export const authClient = createAuthClient();

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

export interface AppUser {
  id: string;
  email?: string | null;
  avatarId?: string;
}

export interface Profile {
  id: string;
  display_name: string;
}

export const db = {
  // --- AUTHENTICATION ---
  async getCurrentUser(): Promise<AppUser | null> {
    try {
      const session = await authClient.getSession();
      if (!session?.data?.user) return null;
      const u = session.data.user;
      return {
        id: u.id,
        email: u.email,
        avatarId: (u as any).avatarId || "ember",
      };
    } catch {
      return null;
    }
  },

  onAuthChange(callback: (event: { type: string; user: AppUser | null }) => void) {
    if (typeof window === "undefined") return () => {};
    const check = async () => {
      const user = await db.getCurrentUser();
      callback({ type: "SESSION", user });
    };
    window.addEventListener("focus", check);
    return () => window.removeEventListener("focus", check);
  },

  async signInWithPassword(email: string, password: string): Promise<AppUser> {
    const res = await authClient.signIn.email({
      email,
      password,
    });
    if (res.error) throw new Error(res.error.message || "Failed to sign in");
    const u = res.data.user;
    return {
      id: u.id,
      email: u.email,
      avatarId: (u as any).avatarId || "ember",
    };
  },

  async signUpWithPassword(email: string, password: string): Promise<{ user: AppUser; signedIn: boolean }> {
    const res = await authClient.signUp.email({
      email,
      password,
      name: email.split("@")[0] || "Shadow",
    });
    if (res.error) throw new Error(res.error.message || "Failed to create account");
    const u = res.data.user;
    const user: AppUser = {
      id: u.id,
      email: u.email,
      avatarId: "ember",
    };
    return { user, signedIn: true };
  },

  async sendPasswordReset(email: string, redirectTo?: string): Promise<void> {
    const res = await authClient.forgetPassword({
      email,
      redirectTo: redirectTo || `${window.location.origin}/`,
    });
    if (res.error) throw new Error(res.error.message || "Failed to send reset link");
  },

  async updatePassword(newPassword: string): Promise<AppUser | null> {
    const res = await authClient.changePassword({
      newPassword,
    });
    if (res.error) throw new Error(res.error.message || "Failed to update password");
    return await this.getCurrentUser();
  },

  async signInWithProvider(provider: "google" | "apple", callbackURL: string): Promise<void> {
    await authClient.signIn.social({
      provider,
      callbackURL,
    });
  },

  async signOut(): Promise<void> {
    await authClient.signOut();
  },

  // --- WALLPAPERS ---
  async listWallpapers(): Promise<Wallpaper[]> {
    const res = await fetch("/api/wallpapers");
    if (!res.ok) throw new Error("Failed to load wallpapers");
    return res.json();
  },

  async getWallpaper(id: string): Promise<Wallpaper | null> {
    const res = await fetch(`/api/wallpapers/${id}`);
    if (!res.ok) return null;
    return res.json();
  },

  async createWallpaper(payload: any): Promise<Wallpaper> {
    const res = await fetch("/api/wallpapers", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    if (!res.ok) throw new Error("Failed to create wallpaper");
    return res.json();
  },

  async updateWallpaperTags(id: string, tags: string[]): Promise<void> {
    await fetch(`/api/wallpapers/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ tags }),
    });
  },

  async updateWallpaperUrl(id: string, image_url: string, storage_path: string): Promise<void> {
    await fetch(`/api/wallpapers/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ image_url, storage_path }),
    });
  },

  async updateWallpaperDetails(id: string, payload: any): Promise<void> {
    await fetch(`/api/wallpapers/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
  },

  async deleteWallpaper(wallpaper: Wallpaper): Promise<void> {
    await fetch(`/api/wallpapers/${wallpaper.id}`, { method: "DELETE" });
  },

  async categoryHasWallpapers(categoryId: string): Promise<boolean> {
    const wallpapers = await this.listWallpapers();
    return wallpapers.some((w) => w.category === categoryId);
  },

  async clearBanner(categoryId: string): Promise<void> {
    const wallpapers = await this.listWallpapers();
    const banner = wallpapers.find((w) => w.category === categoryId && w.is_banner);
    if (banner) {
      await this.updateWallpaperDetails(banner.id, {
        category: categoryId,
        is_banner: false,
        tags: banner.tags,
      });
    }
  },

  // --- SAVED WALLPAPERS ---
  async listSavedIds(userId: string): Promise<string[]> {
    const res = await fetch(`/api/saved?userId=${encodeURIComponent(userId)}`);
    if (!res.ok) return [];
    return res.json();
  },

  async saveWallpaper(userId: string, wallpaperId: string): Promise<void> {
    await fetch("/api/saved", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId, wallpaperId }),
    });
  },

  async unsaveWallpaper(userId: string, wallpaperId: string): Promise<void> {
    await fetch("/api/saved", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId, wallpaperId }),
    });
  },

  // --- PROFILES ---
  async getProfile(userId: string): Promise<Profile | null> {
    const res = await fetch(`/api/profile?userId=${encodeURIComponent(userId)}`);
    if (!res.ok) return null;
    return res.json();
  },

  async saveProfileName(userId: string, displayName: string): Promise<void> {
    await fetch("/api/profile", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId, displayName }),
    });
  },

  async downloadStoredFile(_storagePath: string): Promise<Blob | null> {
    return null;
  },
};
