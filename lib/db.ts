import { authClient } from "@/lib/auth/client";

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
  isAdmin?: boolean;
}

export interface Profile {
  id: string;
  display_name: string;
  avatar_id?: string;
}

async function fetchMe(): Promise<{
  user: AppUser | null;
  profile: Profile | null;
}> {
  try {
    const res = await fetch("/api/me", { cache: "no-store" });
    if (!res.ok) return { user: null, profile: null };
    const data = await res.json();
    if (!data?.user) return { user: null, profile: null };
    return {
      user: {
        id: data.user.id,
        email: data.user.email ?? null,
        avatarId: data.profile?.avatar_id || data.user.avatarId || "ember",
        isAdmin: !!data.isAdmin || !!data.user.isAdmin,
      },
      profile: data.profile || null,
    };
  } catch {
    return { user: null, profile: null };
  }
}

export const db = {
  // --- AUTHENTICATION ---
  async getCurrentUser(): Promise<AppUser | null> {
    try {
      const session = await authClient.getSession();
      const sessionUser = session?.data?.user;
      if (!sessionUser) return null;

      const me = await fetchMe();
      if (me.user) return me.user;

      return {
        id: sessionUser.id,
        email: sessionUser.email,
        avatarId: (sessionUser as any).avatarId || "ember",
        isAdmin: false,
      };
    } catch {
      return null;
    }
  },

  onAuthChange(
    callback: (event: { type: string; user: AppUser | null }) => void
  ) {
    if (typeof window === "undefined") return () => {};
    let active = true;

    const check = async () => {
      if (!active) return;
      const user = await db.getCurrentUser();
      if (active) callback({ type: "SESSION", user });
    };

    window.addEventListener("focus", check);
    return () => {
      active = false;
      window.removeEventListener("focus", check);
    };
  },

  async signInWithPassword(
    email: string,
    password: string,
    rememberMe: boolean = true
  ): Promise<AppUser> {
    const res = await authClient.signIn.email({
      email,
      password,
      rememberMe,
    });
    if (res.error) {
      throw new Error(res.error.message || "Invalid email or password");
    }

    const me = await fetchMe();
    if (me.user) return me.user;

    const u = res.data?.user;
    return {
      id: u?.id || "",
      email: u?.email || email,
      avatarId: (u as any)?.avatarId || "ember",
      isAdmin: false,
    };
  },

  async signUpWithPassword(
    email: string,
    password: string
  ): Promise<{ user: AppUser | null; signedIn: boolean }> {
    const res = await authClient.signUp.email({
      email,
      password,
      name: email.split("@")[0] || "Shadow",
    });
    if (res.error) {
      throw new Error(res.error.message || "Failed to create account");
    }

    const session = await authClient.getSession().catch(() => null);
    if (session?.data?.user) {
      const me = await fetchMe();
      const user: AppUser = me.user || {
        id: session.data.user.id,
        email: session.data.user.email,
        avatarId: "ember",
        isAdmin: false,
      };
      return { user, signedIn: true };
    }

    return { user: null, signedIn: false };
  },

  async verifyEmailCode(email: string, code: string): Promise<AppUser | null> {
    const res = await (authClient as any).emailOtp.verifyEmail({
      email,
      otp: code,
    });
    if (res?.error) {
      throw new Error(res.error.message || "Invalid verification code");
    }
    return await this.getCurrentUser();
  },

  async resendVerificationCode(email: string): Promise<void> {
    const res = await (authClient as any).emailOtp.sendVerificationOtp({
      email,
      type: "email-verification",
    });
    if (res?.error) {
      throw new Error(res.error.message || "Failed to resend code");
    }
  },

  async sendPasswordResetCode(email: string): Promise<void> {
    const client = authClient as any;
    const res = client.forgetPassword?.emailOtp
      ? await client.forgetPassword.emailOtp({ email })
      : await client.emailOtp.sendVerificationOtp({
          email,
          type: "forget-password",
        });

    if (res?.error) {
      throw new Error(res.error.message || "Failed to send reset code");
    }
  },

  async resetPasswordWithCode(
    email: string,
    code: string,
    newPassword: string
  ): Promise<void> {
    const res = await (authClient as any).emailOtp.resetPassword({
      email,
      otp: code,
      password: newPassword,
    });
    if (res?.error) {
      throw new Error(res.error.message || "Failed to reset password");
    }
  },

  async signInWithProvider(
    provider: "google" | "apple",
    callbackURL: string
  ): Promise<void> {
    const res = await authClient.signIn.social({
      provider,
      callbackURL,
    });
    if (res?.error) {
      throw new Error(res.error.message || `Failed to sign in with ${provider}`);
    }
  },

  async signOut(): Promise<void> {
    await authClient.signOut();
  },

  // --- WALLPAPERS ---
  async listWallpapers(): Promise<Wallpaper[]> {
    const res = await fetch("/api/wallpapers", { cache: "no-store" });
    if (!res.ok) throw new Error("Failed to load wallpapers");
    return res.json();
  },

  async getWallpaper(id: string): Promise<Wallpaper | null> {
    const res = await fetch(`/api/wallpapers/${encodeURIComponent(id)}`);
    if (!res.ok) return null;
    return res.json();
  },

  async createWallpaper(payload: any): Promise<Wallpaper> {
    const res = await fetch("/api/wallpapers", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || "Failed to create wallpaper");
    }
    return res.json();
  },

  async updateWallpaperTags(id: string, tags: string[]): Promise<void> {
    const res = await fetch(`/api/wallpapers/${encodeURIComponent(id)}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ tags }),
    });
    if (!res.ok) throw new Error("Failed to update tags");
  },

  async updateWallpaperUrl(
    id: string,
    image_url: string,
    storage_path: string
  ): Promise<void> {
    const res = await fetch(`/api/wallpapers/${encodeURIComponent(id)}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ image_url, storage_path }),
    });
    if (!res.ok) throw new Error("Failed to update wallpaper URL");
  },

  async updateWallpaperDetails(id: string, payload: any): Promise<void> {
    const res = await fetch(`/api/wallpapers/${encodeURIComponent(id)}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    if (!res.ok) throw new Error("Failed to update wallpaper details");
  },

  async deleteWallpaper(wallpaper: Wallpaper): Promise<void> {
    const res = await fetch(
      `/api/wallpapers/${encodeURIComponent(wallpaper.id)}`,
      { method: "DELETE" }
    );
    if (!res.ok) throw new Error("Failed to delete wallpaper");
  },

  async categoryHasWallpapers(categoryId: string): Promise<boolean> {
    const wallpapers = await this.listWallpapers();
    return wallpapers.some((w) => w.category === categoryId);
  },

  async clearBanner(categoryId: string): Promise<void> {
    const wallpapers = await this.listWallpapers();
    const banner = wallpapers.find(
      (w) => w.category === categoryId && w.is_banner
    );
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
    const res = await fetch(
      `/api/saved?userId=${encodeURIComponent(userId)}`,
      { cache: "no-store" }
    );
    if (!res.ok) return [];
    return res.json();
  },

  async saveWallpaper(userId: string, wallpaperId: string): Promise<void> {
    const res = await fetch("/api/saved", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId, wallpaperId }),
    });
    if (!res.ok) throw new Error("Failed to save wallpaper");
  },

  async unsaveWallpaper(userId: string, wallpaperId: string): Promise<void> {
    const res = await fetch("/api/saved", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId, wallpaperId }),
    });
    if (!res.ok) throw new Error("Failed to unsave wallpaper");
  },

  // --- DOWNLOAD ANALYTICS ---
  trackDownload(wallpaperId: string): void {
    fetch("/api/downloads", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ wallpaperId }),
      keepalive: true,
    }).catch(() => {});
  },

  // --- PROFILES ---
  async getProfile(_userId: string): Promise<Profile | null> {
    const me = await fetchMe();
    return me.profile;
  },

  async saveProfileName(userId: string, displayName: string): Promise<void> {
    const res = await fetch("/api/me", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId, display_name: displayName }),
    });
    if (!res.ok) throw new Error("Failed to save display name");
  },

  async downloadStoredFile(_storagePath: string): Promise<Blob | null> {
    return null;
  },
};
