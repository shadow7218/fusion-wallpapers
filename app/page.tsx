"use client";

import React, { useEffect, useState } from "react";
import { createClient } from "@/utils/supabase/client";
import { User } from "@supabase/supabase-js";
import {
  Download,
  Upload,
  Lock,
  LogOut,
  User as UserIcon,
  Loader2,
  Trash2,
  Sparkles,
  ShieldAlert,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

interface Wallpaper {
  id: string;
  title: string;
  image_url: string;
  storage_path: string;
  downloads: number;
  created_at: string;
}

const ADMIN_UUID =
  process.env.NEXT_PUBLIC_ADMIN_UUID || "ccd4e82e-93fe-427f-a163-e19367b08649";

export default function WallpaperGalleryPage() {
  const supabase = createClient();

  const [wallpapers, setWallpapers] = useState<Wallpaper[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [user, setUser] = useState<User | null>(null);

  const [isAuthModalOpen, setIsAuthModalOpen] = useState<boolean>(false);
  const [isUploadModalOpen, setIsUploadModalOpen] = useState<boolean>(false);

  const [isSignUp, setIsSignUp] = useState<boolean>(false);
  const [email, setEmail] = useState<string>("");
  const [password, setPassword] = useState<string>("");
  const [authLoading, setAuthLoading] = useState<boolean>(false);
  const [authMessage, setAuthMessage] = useState<string | null>(null);

  const [uploadTitle, setUploadTitle] = useState<string>("");
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState<boolean>(false);

  const [downloadingId, setDownloadingId] = useState<string | null>(null);

  const isAdmin = user?.id === ADMIN_UUID;

  useEffect(() => {
    const initializeApp = async () => {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      setUser(session?.user ?? null);
      await fetchWallpapers();
    };

    initializeApp();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
    });

    return () => subscription.unsubscribe();
  }, []);

  const fetchWallpapers = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("wallpapers")
      .select("*")
      .order("created_at", { ascending: false });

    if (!error && data) {
      setWallpapers(data);
    }
    setLoading(false);
  };

  const handleAuthSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthLoading(true);
    setAuthMessage(null);

    try {
      if (isSignUp) {
        const { error } = await supabase.auth.signUp({
          email,
          password,
        });
        if (error) throw error;
        setAuthMessage("Account created! Check your email or log in now.");
      } else {
        const { error } = await supabase.auth.signInWithPassword({
          email,
          password,
        });
        if (error) throw error;
        setIsAuthModalOpen(false);
        setEmail("");
        setPassword("");
      }
    } catch (err: any) {
      setAuthMessage(err.message || "Authentication failed.");
    } finally {
      setAuthLoading(false);
    }
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
  };

  const handleAdminUpload = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isAdmin || !uploadFile || !uploadTitle.trim()) return;

    setUploading(true);
    try {
      const fileExt = uploadFile.name.split(".").pop();
      const fileName = `${Date.now()}-${Math.random().toString(36).substring(2, 8)}.${fileExt}`;

      const { error: storageError } = await supabase.storage
        .from("wallpapers")
        .upload(fileName, uploadFile, {
          cacheControl: "3600",
          upsert: false,
        });

      if (storageError) throw storageError;

      const {
        data: { publicUrl },
      } = supabase.storage.from("wallpapers").getPublicUrl(fileName);

      const { error: dbError } = await supabase.from("wallpapers").insert([
        {
          title: uploadTitle.trim(),
          image_url: publicUrl,
          storage_path: fileName,
        },
      ]);

      if (dbError) throw dbError;

      setUploadTitle("");
      setUploadFile(null);
      setIsUploadModalOpen(false);
      await fetchWallpapers();
    } catch (err: any) {
      alert(`Upload failed: ${err.message}`);
    } finally {
      setUploading(false);
    }
  };

  const handleAdminDelete = async (wallpaper: Wallpaper) => {
    if (!isAdmin) return;
    const confirmDelete = window.confirm(
      `Delete "${wallpaper.title}" permanently?`
    );
    if (!confirmDelete) return;

    try {
      await supabase.storage.from("wallpapers").remove([wallpaper.storage_path]);
      await supabase.from("wallpapers").delete().eq("id", wallpaper.id);
      setWallpapers((prev) => prev.filter((w) => w.id !== wallpaper.id));
    } catch (err: any) {
      alert(`Delete failed: ${err.message}`);
    }
  };

  const handleDownload = async (wallpaper: Wallpaper) => {
    if (!user) {
      setAuthMessage(null);
      setIsAuthModalOpen(true);
      return;
    }

    try {
      setDownloadingId(wallpaper.id);

      const response = await fetch(wallpaper.image_url);
      if (!response.ok) throw new Error("Failed to fetch wallpaper file.");

      const blob = await response.blob();
      const blobUrl = window.URL.createObjectURL(blob);

      const link = document.createElement("a");
      link.href = blobUrl;
      const cleanTitle = wallpaper.title
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-");
      link.download = `${cleanTitle || "wallpaper"}-${wallpaper.id.slice(0, 5)}.jpg`;
      document.body.appendChild(link);
      link.click();

      document.body.removeChild(link);
      window.URL.revokeObjectURL(blobUrl);
    } catch (err) {
      console.error("Download error:", err);
      alert("Could not download the image. Please try again.");
    } finally {
      setDownloadingId(null);
    }
  };

  return (
    <div
      className="min-h-screen bg-sapphire text-platinum flex flex-col"
      onContextMenu={(e) => e.preventDefault()}
    >
      <header className="sticky top-0 z-40 backdrop-blur-md bg-sapphire/85 border-b border-navy px-4 py-3.5 sm:px-8">
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="h-9 w-9 rounded-lg bg-navy border border-silver/20 flex items-center justify-center shadow-inner">
              <Sparkles className="h-5 w-5 text-platinum" />
            </div>
            <div>
              <h1 className="text-lg sm:text-xl font-bold tracking-tight text-platinum leading-none">
                FUSION
              </h1>
              <span className="text-[10px] tracking-widest uppercase text-silver/70 font-medium">
                Wallpapers
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2.5">
            {isAdmin && (
              <Button
                onClick={() => setIsUploadModalOpen(true)}
                className="bg-platinum text-sapphire hover:bg-silver font-semibold h-9 px-3 sm:px-4 text-xs sm:text-sm"
              >
                <Upload className="h-4 w-4 mr-1.5" />
                Upload
              </Button>
            )}

            {user ? (
              <div className="flex items-center gap-2">
                {isAdmin && (
                  <span className="hidden sm:inline-block text-xs bg-navy text-silver px-2.5 py-1 rounded-full border border-silver/20">
                    Admin Mode
                  </span>
                )}
                <Button
                  variant="outline"
                  onClick={handleLogout}
                  className="bg-navy border-silver/20 text-silver hover:bg-navy/80 hover:text-platinum h-9 px-3 text-xs sm:text-sm"
                >
                  <LogOut className="h-4 w-4 sm:mr-1.5" />
                  <span className="hidden sm:inline">Sign Out</span>
                </Button>
              </div>
            ) : (
              <Button
                onClick={() => {
                  setAuthMessage(null);
                  setIsAuthModalOpen(true);
                }}
                className="bg-navy hover:bg-navy/80 text-platinum border border-silver/25 h-9 px-4 text-xs sm:text-sm font-medium"
              >
                <UserIcon className="h-4 w-4 mr-1.5 text-silver" />
                Sign In
              </Button>
            )}
          </div>
        </div>
      </header>

      <section className="px-4 pt-6 pb-4 sm:py-10 max-w-6xl mx-auto w-full text-center">
        <h2 className="text-2xl sm:text-4xl font-extrabold tracking-tight text-platinum">
          Curated High-Resolution Wallpapers
        </h2>
        <p className="text-xs sm:text-sm text-silver mt-2 max-w-md mx-auto">
          Browse freely in guest mode. Sign in to unlock instant full-resolution
          downloads.
        </p>
      </section>

      <main className="flex-1 max-w-6xl w-full mx-auto px-3 sm:px-6 pb-16">
        {loading ? (
          <div className="flex flex-col items-center justify-center py-24 text-silver">
            <Loader2 className="h-8 w-8 animate-spin mb-3 text-platinum" />
            <p className="text-sm">Loading gallery...</p>
          </div>
        ) : wallpapers.length === 0 ? (
          <div className="bg-navy/70 border border-silver/15 rounded-2xl p-10 text-center max-w-md mx-auto my-8">
            <Sparkles className="h-10 w-10 text-silver mx-auto mb-3 opacity-75" />
            <h3 className="text-lg font-semibold text-platinum">
              No Wallpapers Yet
            </h3>
            <p className="text-xs text-silver mt-1">
              {isAdmin
                ? "Tap the 'Upload' button in the top bar to publish your first wallpaper!"
                : "The admin hasn't uploaded any wallpapers yet. Check back soon!"}
            </p>
          </div>
        ) : (
          <div className="columns-2 gap-3 sm:gap-6 space-y-3 sm:space-y-6">
            {wallpapers.map((item) => (
              <div
                key={item.id}
                className="break-inside-avoid group relative rounded-xl overflow-hidden bg-navy border border-silver/15 shadow-lg transition-all duration-300 hover:border-silver/40"
              >
                <div
                  className="relative w-full overflow-hidden bg-navy"
                  onContextMenu={(e) => e.preventDefault()}
                >
                  <img
                    src={item.image_url}
                    alt={item.title}
                    loading="lazy"
                    draggable={false}
                    onContextMenu={(e) => e.preventDefault()}
                    className="w-full h-auto object-cover pointer-events-none select-none transition-transform duration-500 group-hover:scale-105"
                  />

                  <div
                    className="absolute inset-0 z-10 bg-transparent"
                    onContextMenu={(e) => e.preventDefault()}
                  />
                </div>

                <div className="p-2.5 sm:p-3.5 bg-navy flex items-center justify-between gap-2 relative z-20">
                  <div className="truncate">
                    <h3 className="text-xs sm:text-sm font-semibold text-platinum truncate">
                      {item.title}
                    </h3>
                  </div>

                  <div className="flex items-center gap-1.5 shrink-0">
                    {isAdmin && (
                      <button
                        onClick={() => handleAdminDelete(item)}
                        title="Delete Wallpaper"
                        className="p-2 rounded-lg bg-sapphire/60 text-silver hover:text-red-400 transition-colors"
                      >
                        <Trash2 className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                      </button>
                    )}

                    <Button
                      size="sm"
                      onClick={() => handleDownload(item)}
                      disabled={downloadingId === item.id}
                      className="h-8 px-2.5 sm:px-3 bg-platinum text-sapphire hover:bg-silver font-semibold text-xs rounded-lg shadow"
                    >
                      {downloadingId === item.id ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      ) : !user ? (
                        <>
                          <Lock className="h-3 w-3 mr-1" />
                          <span>Get</span>
                        </>
                      ) : (
                        <>
                          <Download className="h-3.5 w-3.5 sm:mr-1" />
                          <span className="hidden sm:inline">Download</span>
                        </>
                      )}
                    </Button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>

      <Dialog open={isAuthModalOpen} onOpenChange={setIsAuthModalOpen}>
        <DialogContent className="bg-navy border border-silver/25 text-platinum sm:max-w-md rounded-2xl">
          <DialogHeader>
            <div className="mx-auto bg-sapphire p-3 rounded-full border border-silver/20 mb-2">
              <ShieldAlert className="h-6 w-6 text-platinum" />
            </div>
            <DialogTitle className="text-center text-xl font-bold text-platinum">
              {isSignUp ? "Create Free Account" : "Sign In Required"}
            </DialogTitle>
            <DialogDescription className="text-center text-silver text-xs sm:text-sm">
              You must be logged in to download full-resolution wallpapers.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleAuthSubmit} className="space-y-4 mt-2">
            <div>
              <label className="text-xs font-medium text-silver block mb-1">
                Email Address
              </label>
              <Input
                type="email"
                required
                placeholder="you@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="bg-sapphire border-silver/25 text-platinum placeholder:text-silver/40"
              />
            </div>

            <div>
              <label className="text-xs font-medium text-silver block mb-1">
                Password
              </label>
              <Input
                type="password"
                required
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="bg-sapphire border-silver/25 text-platinum placeholder:text-silver/40"
              />
            </div>

            {authMessage && (
              <p className="text-xs text-center text-silver bg-sapphire/80 p-2.5 rounded-lg border border-silver/20">
                {authMessage}
              </p>
            )}

            <Button
              type="submit"
              disabled={authLoading}
              className="w-full bg-platinum text-sapphire hover:bg-silver font-bold"
            >
              {authLoading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : isSignUp ? (
                "Sign Up & Unlock Downloads"
              ) : (
                "Sign In"
              )}
            </Button>

            <div className="text-center pt-1">
              <button
                type="button"
                onClick={() => {
                  setIsSignUp(!isSignUp);
                  setAuthMessage(null);
                }}
                className="text-xs text-silver hover:text-platinum underline underline-offset-4"
              >
                {isSignUp
                  ? "Already have an account? Sign In"
                  : "New here? Create a free account"}
              </button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={isUploadModalOpen} onOpenChange={setIsUploadModalOpen}>
        <DialogContent className="bg-navy border border-silver/25 text-platinum sm:max-w-md rounded-2xl">
          <DialogHeader>
            <DialogTitle className="text-lg font-bold text-platinum">
              Upload New Wallpaper (Admin)
            </DialogTitle>
            <DialogDescription className="text-silver text-xs">
              Select a wallpaper from your phone to publish to the gallery.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleAdminUpload} className="space-y-4 mt-2">
            <div>
              <label className="text-xs font-medium text-silver block mb-1">
                Wallpaper Title
              </label>
              <Input
                type="text"
                required
                placeholder="e.g., Cyberpunk Neon Samurai"
                value={uploadTitle}
                onChange={(e) => setUploadTitle(e.target.value)}
                className="bg-sapphire border-silver/25 text-platinum placeholder:text-silver/40"
              />
            </div>

            <div>
              <label className="text-xs font-medium text-silver block mb-1">
                Image File
              </label>
              <Input
                type="file"
                accept="image/*"
                required
                onChange={(e) => setUploadFile(e.target.files?.[0] || null)}
                className="bg-sapphire border-silver/25 text-silver file:bg-navy file:text-platinum file:border-0 file:rounded file:px-2 file:py-1 file:mr-2 file:text-xs"
              />
            </div>

            <Button
              type="submit"
              disabled={uploading || !uploadFile}
              className="w-full bg-platinum text-sapphire hover:bg-silver font-bold"
            >
              {uploading ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  Uploading to Supabase...
                </>
              ) : (
                "Publish Wallpaper"
              )}
            </Button>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
