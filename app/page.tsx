"use client";

import React, { useEffect, useState, useRef } from "react";
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
  ShieldAlert,
  Search,
  SlidersHorizontal,
  Bookmark,
  Home,
  Compass,
  Moon,
  Mountain,
  Smartphone,
  Sparkles,
  X,
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

// Categories matching your UI mockup
const CATEGORIES = [
  { id: "For You", label: "For You", icon: Sparkles },
  { id: "Anime", label: "Anime", icon: SmileIcon },
  { id: "Minimal", label: "Minimal", icon: Smartphone },
  { id: "Dark", label: "Dark", icon: Moon },
  { id: "Nature", label: "Nature", icon: Mountain },
];

// Custom Anime/Bot style icon to match mockup
function SmileIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
    >
      <circle cx="12" cy="12" r="9" />
      <path d="M9 10h.01" />
      <path d="M15 10h.01" />
      <path d="M9.5 15a3.5 3.5 0 0 0 5 0" />
      <path d="M7 4.5 9 7" />
      <path d="M17 4.5 15 7" />
    </svg>
  );
}

// Custom 4-Point Glowing Star Logo from your UI mockup
function FourPointStar({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className={className}>
      <path d="M12 1L14.8 9.2L23 12L14.8 14.8L12 23L9.2 14.8L1 12L9.2 9.2L12 1Z" />
    </svg>
  );
}

export default function WallpaperGalleryPage() {
  const supabase = createClient();
  const searchInputRef = useRef<HTMLInputElement>(null);

  // --- STATE ---
  const [wallpapers, setWallpapers] = useState<Wallpaper[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [user, setUser] = useState<User | null>(null);

  // UI Navigation & Filtering State
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [activeCategory, setActiveCategory] = useState<string>("For You");
  const [activeTab, setActiveTab] = useState<"home" | "explore" | "saved" | "profile">("home");
  const [savedIds, setSavedIds] = useState<string[]>([]);

  // Selected Wallpaper for Full Preview & Download Modal
  const [selectedWallpaper, setSelectedWallpaper] = useState<Wallpaper | null>(null);

  // Modals State
  const [isAuthModalOpen, setIsAuthModalOpen] = useState<boolean>(false);
  const [isUploadModalOpen, setIsUploadModalOpen] = useState<boolean>(false);

  // Auth Form State
  const [isSignUp, setIsSignUp] = useState<boolean>(false);
  const [email, setEmail] = useState<string>("");
  const [password, setPassword] = useState<string>("");
  const [authLoading, setAuthLoading] = useState<boolean>(false);
  const [authMessage, setAuthMessage] = useState<string | null>(null);

  // Admin Upload State
  const [uploadTitle, setUploadTitle] = useState<string>("");
  const [uploadCategory, setUploadCategory] = useState<string>("Anime");
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState<boolean>(false);

  // Download State
  const [downloadingId, setDownloadingId] = useState<string | null>(null);

  const isAdmin = user?.id === ADMIN_UUID;

  // --- 1. INITIALIZE AUTH, SAVED BOOKMARKS & WALLPAPERS ---
  useEffect(() => {
    // Load bookmarked wallpapers from localStorage
    const storedBookmarks = localStorage.getItem("fusion_saved_wallpapers");
    if (storedBookmarks) {
      try {
        setSavedIds(JSON.parse(storedBookmarks));
      } catch (e) {
        console.error(e);
      }
    }

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

  // Toggle Bookmark / Save Wallpaper
  const toggleBookmark = (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    setSavedIds((prev) => {
      const updated = prev.includes(id)
        ? prev.filter((item) => item !== id)
        : [...prev, id];
      localStorage.setItem("fusion_saved_wallpapers", JSON.stringify(updated));
      return updated;
    });
  };

  // --- 2. AUTH HANDLERS ---
  const handleAuthSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthLoading(true);
    setAuthMessage(null);

    try {
      if (isSignUp) {
        const { error } = await supabase.auth.signUp({ email, password });
        if (error) throw error;
        setAuthMessage("Account created! Check your email or sign in now.");
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

  // --- 3. ADMIN UPLOAD (Encodes category tag gracefully inside title or metadata) ---
  const handleAdminUpload = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isAdmin || !uploadFile || !uploadTitle.trim()) return;

    setUploading(true);
    try {
      const fileExt = uploadFile.name.split(".").pop();
      const fileName = `${uploadCategory.toLowerCase()}-${Date.now()}-${Math.random()
        .toString(36)
        .substring(2, 7)}.${fileExt}`;

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

  // --- 4. ADMIN DELETE ---
  const handleAdminDelete = async (e: React.MouseEvent, wallpaper: Wallpaper) => {
    e.stopPropagation();
    if (!isAdmin) return;
    if (!window.confirm(`Delete "${wallpaper.title}" permanently?`)) return;

    try {
      await supabase.storage.from("wallpapers").remove([wallpaper.storage_path]);
      await supabase.from("wallpapers").delete().eq("id", wallpaper.id);
      setWallpapers((prev) => prev.filter((w) => w.id !== wallpaper.id));
      if (selectedWallpaper?.id === wallpaper.id) {
        setSelectedWallpaper(null);
      }
    } catch (err: any) {
      alert(`Delete failed: ${err.message}`);
    }
  };

  // --- 5. DOWNLOAD LOGIC ---
  const handleDownload = async (wallpaper: Wallpaper) => {
    if (!user) {
      setSelectedWallpaper(null);
      setAuthMessage(null);
      setIsAuthModalOpen(true);
      return;
    }

    try {
      setDownloadingId(wallpaper.id);
      const response = await fetch(wallpaper.image_url);
      if (!response.ok) throw new Error("Failed to fetch wallpaper.");

      const blob = await response.blob();
      const blobUrl = window.URL.createObjectURL(blob);

      const link = document.createElement("a");
      link.href = blobUrl;
      const cleanTitle = wallpaper.title
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-");
      link.download = `${cleanTitle || "fusion"}-${wallpaper.id.slice(0, 5)}.jpg`;
      document.body.appendChild(link);
      link.click();

      document.body.removeChild(link);
      window.URL.revokeObjectURL(blobUrl);
    } catch (err) {
      alert("Could not download the image. Please try again.");
    } finally {
      setDownloadingId(null);
    }
  };

  // --- 6. FILTER WALLPAPERS BY SEARCH, CATEGORY & BOTTOM NAV TAB ---
  const filteredWallpapers = wallpapers.filter((item) => {
    // If on "Saved" tab, only show bookmarked items
    if (activeTab === "saved" && !savedIds.includes(item.id)) {
      return false;
    }

    // Search query check
    const matchesSearch =
      item.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.storage_path.toLowerCase().includes(searchQuery.toLowerCase());

    // Category pill check ("For You" shows everything)
    const matchesCategory =
      activeCategory === "For You" ||
      item.title.toLowerCase().includes(activeCategory.toLowerCase()) ||
      item.storage_path.toLowerCase().startsWith(activeCategory.toLowerCase());

    return matchesSearch && matchesCategory;
  });

  return (
    <div
      className="min-h-screen bg-[#070D1F] text-platinum flex flex-col pb-28 relative overflow-x-hidden"
      onContextMenu={(e) => e.preventDefault()}
    >
      {/* Subtle Top Ambient Glow */}
      <div className="pointer-events-none fixed top-0 left-1/2 -translate-x-1/2 w-[500px] h-[220px] bg-blue-600/15 blur-[110px] rounded-full z-0" />

      {/* ================= HEADER BAR ================= */}
      <header className="sticky top-0 z-30 bg-[#070D1F]/85 backdrop-blur-xl px-4 pt-4 pb-2">
        <div className="max-w-3xl mx-auto flex items-center justify-between">
          {/* Left: Glowing 4-Point Star + F U S I O N */}
          <div
            onClick={() => {
              setActiveTab("home");
              setActiveCategory("For You");
            }}
            className="flex items-center gap-3 cursor-pointer"
          >
            <div className="relative flex items-center justify-center">
              <div className="absolute inset-0 bg-cyan-400 blur-md opacity-70 rounded-full" />
              <FourPointStar className="h-7 w-7 text-white relative z-10 drop-shadow-[0_0_10px_rgba(56,189,248,0.9)]" />
            </div>
            <h1 className="text-xl sm:text-2xl font-bold tracking-[0.28em] text-white uppercase">
              FUSION
            </h1>
          </div>

          {/* Right: Admin Upload & Sign In Pill */}
          <div className="flex items-center gap-2">
            {isAdmin && (
              <button
                onClick={() => setIsUploadModalOpen(true)}
                className="flex items-center gap-1.5 px-3.5 py-2 rounded-full bg-gradient-to-r from-cyan-400 to-blue-600 text-white text-xs font-semibold shadow-[0_0_15px_rgba(56,189,248,0.5)] hover:opacity-95 transition"
              >
                <Upload className="h-3.5 w-3.5" />
                <span>Upload</span>
              </button>
            )}

            {user ? (
              <button
                onClick={handleLogout}
                className="flex items-center gap-2 px-4 py-2 rounded-full bg-[#111B36]/90 border border-blue-400/40 text-platinum text-xs sm:text-sm font-medium shadow-[0_0_12px_rgba(59,130,246,0.2)] hover:border-blue-400 transition"
              >
                <LogOut className="h-4 w-4 text-silver" />
                <span>Sign Out</span>
              </button>
            ) : (
              <button
                onClick={() => {
                  setAuthMessage(null);
                  setIsAuthModalOpen(true);
                }}
                className="flex items-center gap-2 px-4 py-2 rounded-full bg-[#111B36]/90 border border-blue-400/40 text-white text-xs sm:text-sm font-medium shadow-[0_0_15px_rgba(59,130,246,0.25)] hover:border-cyan-400/70 transition"
              >
                <UserIcon className="h-4 w-4 text-silver" />
                <span>Sign In</span>
              </button>
            )}
          </div>
        </div>
      </header>

      {/* ================= SEARCH BAR & CATEGORY PILLS ================= */}
      <div className="max-w-3xl w-full mx-auto px-4 pt-2 pb-4 z-10 space-y-3.5">
        {/* Glowing Pill Search Input */}
        <div className="relative flex items-center w-full h-12 rounded-full bg-[#0E1730]/90 border border-blue-400/35 px-4 shadow-[0_0_20px_rgba(37,99,235,0.18)] focus-within:border-cyan-400/80 focus-within:shadow-[0_0_25px_rgba(56,189,248,0.35)] transition-all">
          <Search className="h-5 w-5 text-silver/70 mr-3 shrink-0" />
          <input
            ref={searchInputRef}
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search wallpapers, anime, moods..."
            className="w-full bg-transparent text-sm text-white placeholder:text-silver/60 focus:outline-none"
          />
          {searchQuery ? (
            <button
              onClick={() => setSearchQuery("")}
              className="text-silver/70 hover:text-white p-1"
            >
              <X className="h-4 w-4" />
            </button>
          ) : (
            <button
              onClick={() => searchInputRef.current?.focus()}
              className="text-silver/80 hover:text-white p-1 shrink-0"
              title="Filter"
            >
              <SlidersHorizontal className="h-5 w-5" />
            </button>
          )}
        </div>

        {/* Horizontal Scrollable Category Pills */}
        <div className="flex items-center gap-2.5 overflow-x-auto no-scrollbar pb-1">
          {CATEGORIES.map((cat) => {
            const IconComponent = cat.icon;
            const isActive = activeCategory === cat.id;
            return (
              <button
                key={cat.id}
                onClick={() => setActiveCategory(cat.id)}
                className={`flex items-center gap-2 px-4 py-2 rounded-full text-xs sm:text-sm font-medium shrink-0 transition-all duration-300 ${
                  isActive
                    ? "bg-gradient-to-r from-[#2563EB] to-[#38BDF8] text-white border border-cyan-300/80 shadow-[0_0_18px_rgba(56,189,248,0.55)]"
                    : "bg-[#101A36]/90 text-silver border border-blue-500/25 hover:border-blue-400/50 hover:text-white"
                }`}
              >
                <IconComponent className="h-4 w-4" />
                <span>{cat.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* ================= MAIN 2-COLUMN MASONRY GALLERY ================= */}
      <main className="flex-1 max-w-3xl w-full mx-auto px-4 z-10">
        {activeTab === "saved" && (
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-sm font-semibold text-silver tracking-wide uppercase">
              Saved Wallpapers ({filteredWallpapers.length})
            </h2>
          </div>
        )}

        {loading ? (
          <div className="flex flex-col items-center justify-center py-24 text-silver">
            <Loader2 className="h-8 w-8 animate-spin mb-3 text-cyan-400" />
            <p className="text-sm">Loading gallery...</p>
          </div>
        ) : filteredWallpapers.length === 0 ? (
          <div className="bg-[#101A36]/70 border border-blue-400/20 rounded-2xl p-10 text-center max-w-md mx-auto my-6 backdrop-blur-md">
            <FourPointStar className="h-10 w-10 text-cyan-400 mx-auto mb-3 opacity-80" />
            <h3 className="text-base font-semibold text-white">
              {activeTab === "saved"
                ? "No Saved Wallpapers Yet"
                : "No Wallpapers Found"}
            </h3>
            <p className="text-xs text-silver mt-1.5 leading-relaxed">
              {activeTab === "saved"
                ? "Tap the bookmark icon on the top right of any wallpaper to save it here."
                : isAdmin
                ? "Tap 'Upload' at the top right to publish your first wallpaper!"
                : "Try another category or search term."}
            </p>
          </div>
        ) : (
          /* 2-COLUMN MASONRY LAYOUT MATCHING MOCKUP */
          <div className="columns-2 gap-3.5 space-y-3.5">
            {filteredWallpapers.map((item) => {
              const isSaved = savedIds.includes(item.id);
              return (
                <div
                  key={item.id}
                  onClick={() => setSelectedWallpaper(item)}
                  className="break-inside-avoid group relative rounded-2xl overflow-hidden bg-[#101A36] border border-blue-400/30 shadow-[0_8px_25px_rgba(0,0,0,0.55)] cursor-pointer transition-all duration-300 hover:border-cyan-400/70 hover:shadow-[0_0_20px_rgba(56,189,248,0.25)]"
                >
                  {/* Image Container with Anti-Right-Click & Anti-Long-Press Shield */}
                  <div
                    className="relative w-full overflow-hidden"
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

                    {/* Invisible Touch Shield */}
                    <div
                      className="absolute inset-0 z-10 bg-transparent"
                      onContextMenu={(e) => e.preventDefault()}
                    />

                    {/* Top-Right Bookmark Button (Matches Mockup) */}
                    <button
                      onClick={(e) => toggleBookmark(e, item.id)}
                      title="Save Wallpaper"
                      className="absolute top-2.5 right-2.5 z-20 h-8 w-8 rounded-full bg-black/45 backdrop-blur-md border border-white/15 flex items-center justify-center text-white hover:bg-black/70 transition"
                    >
                      <Bookmark
                        className={`h-4 w-4 transition ${
                          isSaved ? "fill-cyan-400 text-cyan-400" : "text-white"
                        }`}
                      />
                    </button>

                    {/* Admin Delete Button (Top-Left, only visible to you) */}
                    {isAdmin && (
                      <button
                        onClick={(e) => handleAdminDelete(e, item)}
                        title="Delete Wallpaper"
                        className="absolute top-2.5 left-2.5 z-20 h-8 w-8 rounded-full bg-red-950/70 backdrop-blur-md border border-red-400/30 flex items-center justify-center text-red-300 hover:bg-red-900 transition"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    )}

                    {/* Bottom Gradient Overlay with Wallpaper Title Inside Card */}
                    <div className="absolute inset-x-0 bottom-0 z-20 bg-gradient-to-t from-[#050A18]/95 via-[#050A18]/60 to-transparent pt-10 pb-3 px-3.5 flex items-end justify-between">
                      <h3 className="text-xs sm:text-sm font-semibold text-white tracking-wide drop-shadow-md truncate">
                        {item.title}
                      </h3>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </main>

      {/* ================= FLOATING BOTTOM GLASSMORPHIC NAV BAR ================= */}
      <nav className="fixed bottom-4 left-1/2 -translate-x-1/2 z-40 w-[90%] max-w-md rounded-full bg-[#0E1834]/85 backdrop-blur-xl border border-blue-400/35 px-6 py-2.5 shadow-[0_10px_35px_rgba(0,0,0,0.7),0_0_20px_rgba(37,99,235,0.25)]">
        <div className="flex items-center justify-between">
          {/* Home Tab */}
          <button
            onClick={() => {
              setActiveTab("home");
              window.scrollTo({ top: 0, behavior: "smooth" });
            }}
            className="flex flex-col items-center gap-1 group"
          >
            <div className="relative flex items-center justify-center">
              {activeTab === "home" && (
                <div className="absolute inset-0 bg-cyan-400 blur-md opacity-60 rounded-full" />
              )}
              <Home
                className={`h-5 w-5 relative z-10 transition ${
                  activeTab === "home"
                    ? "text-white drop-shadow-[0_0_8px_rgba(56,189,248,1)]"
                    : "text-silver/70 group-hover:text-white"
                }`}
              />
            </div>
            <span
              className={`text-[10px] font-medium ${
                activeTab === "home" ? "text-white" : "text-silver/70"
              }`}
            >
              Home
            </span>
          </button>

          {/* Explore Tab */}
          <button
            onClick={() => {
              setActiveTab("explore");
              searchInputRef.current?.focus();
              window.scrollTo({ top: 0, behavior: "smooth" });
            }}
            className="flex flex-col items-center gap-1 group"
          >
            <Compass
              className={`h-5 w-5 transition ${
                activeTab === "explore"
                  ? "text-cyan-400 drop-shadow-[0_0_8px_rgba(56,189,248,0.8)]"
                  : "text-silver/70 group-hover:text-white"
              }`}
            />
            <span
              className={`text-[10px] font-medium ${
                activeTab === "explore" ? "text-white" : "text-silver/70"
              }`}
            >
              Explore
            </span>
          </button>

          {/* Saved Tab */}
          <button
            onClick={() => {
              setActiveTab("saved");
              window.scrollTo({ top: 0, behavior: "smooth" });
            }}
            className="flex flex-col items-center gap-1 group"
          >
            <Bookmark
              className={`h-5 w-5 transition ${
                activeTab === "saved"
                  ? "text-cyan-400 fill-cyan-400/20 drop-shadow-[0_0_8px_rgba(56,189,248,0.8)]"
                  : "text-silver/70 group-hover:text-white"
              }`}
            />
            <span
              className={`text-[10px] font-medium ${
                activeTab === "saved" ? "text-white" : "text-silver/70"
              }`}
            >
              Saved
            </span>
          </button>

          {/* Profile Tab */}
          <button
            onClick={() => {
              if (!user) {
                setAuthMessage(null);
                setIsAuthModalOpen(true);
              } else {
                setActiveTab("profile");
              }
            }}
            className="flex flex-col items-center gap-1 group"
          >
            <UserIcon
              className={`h-5 w-5 transition ${
                activeTab === "profile"
                  ? "text-cyan-400 drop-shadow-[0_0_8px_rgba(56,189,248,0.8)]"
                  : "text-silver/70 group-hover:text-white"
              }`}
            />
            <span
              className={`text-[10px] font-medium ${
                activeTab === "profile" ? "text-white" : "text-silver/70"
              }`}
            >
              {user ? "Account" : "Profile"}
            </span>
          </button>
        </div>
      </nav>

      {/* ================= WALLPAPER PREVIEW & DOWNLOAD MODAL ================= */}
      <Dialog
        open={!!selectedWallpaper}
        onOpenChange={(open) => !open && setSelectedWallpaper(null)}
      >
        <DialogContent className="bg-[#101A36] border border-blue-400/35 text-white sm:max-w-md rounded-3xl p-4 overflow-hidden">
          {selectedWallpaper && (
            <div className="space-y-4">
              <div
                className="relative rounded-2xl overflow-hidden max-h-[65vh] bg-[#070D1F] border border-white/10"
                onContextMenu={(e) => e.preventDefault()}
              >
                <img
                  src={selectedWallpaper.image_url}
                  alt={selectedWallpaper.title}
                  draggable={false}
                  onContextMenu={(e) => e.preventDefault()}
                  className="w-full h-auto max-h-[65vh] object-contain mx-auto pointer-events-none select-none"
                />
                <div
                  className="absolute inset-0 z-10 bg-transparent"
                  onContextMenu={(e) => e.preventDefault()}
                />
              </div>

              <div className="flex items-center justify-between gap-3 px-1">
                <div className="truncate">
                  <DialogTitle className="text-base font-bold text-white truncate">
                    {selectedWallpaper.title}
                  </DialogTitle>
                  <DialogDescription className="text-xs text-silver">
                    High-Resolution Wallpaper
                  </DialogDescription>
                </div>

                <Button
                  onClick={() => handleDownload(selectedWallpaper)}
                  disabled={downloadingId === selectedWallpaper.id}
                  className="rounded-full bg-gradient-to-r from-[#2563EB] to-[#38BDF8] text-white font-semibold px-5 shadow-[0_0_15px_rgba(56,189,248,0.5)] hover:opacity-95"
                >
                  {downloadingId === selectedWallpaper.id ? (
                    <Loader2 className="h-4 w-4 animate-spin mr-1.5" />
                  ) : !user ? (
                    <Lock className="h-4 w-4 mr-1.5" />
                  ) : (
                    <Download className="h-4 w-4 mr-1.5" />
                  )}
                  {!user ? "Sign In to Download" : "Download HD"}
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* ================= GUEST LOGIN / SIGN UP MODAL ================= */}
      <Dialog open={isAuthModalOpen} onOpenChange={setIsAuthModalOpen}>
        <DialogContent className="bg-[#101A36] border border-blue-400/35 text-platinum sm:max-w-md rounded-3xl">
          <DialogHeader>
            <div className="mx-auto bg-[#070D1F] p-3 rounded-full border border-blue-400/30 mb-2 shadow-[0_0_15px_rgba(56,189,248,0.25)]">
              <ShieldAlert className="h-6 w-6 text-cyan-400" />
            </div>
            <DialogTitle className="text-center text-xl font-bold text-white">
              {isSignUp ? "Create Free Account" : "Sign In Required"}
            </DialogTitle>
            <DialogDescription className="text-center text-silver text-xs sm:text-sm">
              Sign in to unlock instant full-resolution wallpaper downloads.
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
                className="bg-[#070D1F] border-blue-400/30 text-white placeholder:text-silver/40 rounded-xl"
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
                className="bg-[#070D1F] border-blue-400/30 text-white placeholder:text-silver/40 rounded-xl"
              />
            </div>

            {authMessage && (
              <p className="text-xs text-center text-cyan-300 bg-[#070D1F] p-2.5 rounded-xl border border-cyan-400/30">
                {authMessage}
              </p>
            )}

            <Button
              type="submit"
              disabled={authLoading}
              className="w-full rounded-full bg-gradient-to-r from-[#2563EB] to-[#38BDF8] text-white font-bold shadow-[0_0_18px_rgba(56,189,248,0.45)]"
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
                className="text-xs text-silver hover:text-white underline underline-offset-4"
              >
                {isSignUp
                  ? "Already have an account? Sign In"
                  : "New here? Create a free account"}
              </button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* ================= ADMIN ONLY UPLOAD MODAL ================= */}
      <Dialog open={isUploadModalOpen} onOpenChange={setIsUploadModalOpen}>
        <DialogContent className="bg-[#101A36] border border-blue-400/35 text-platinum sm:max-w-md rounded-3xl">
          <DialogHeader>
            <DialogTitle className="text-lg font-bold text-white">
              Upload New Wallpaper
            </DialogTitle>
            <DialogDescription className="text-silver text-xs">
              Publish a new wallpaper to your Fusion gallery.
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
                placeholder="e.g., Lavender Vibes"
                value={uploadTitle}
                onChange={(e) => setUploadTitle(e.target.value)}
                className="bg-[#070D1F] border-blue-400/30 text-white placeholder:text-silver/40 rounded-xl"
              />
            </div>

            <div>
              <label className="text-xs font-medium text-silver block mb-1">
                Category Pill
              </label>
              <div className="flex flex-wrap gap-2">
                {["Anime", "Minimal", "Dark", "Nature"].map((cat) => (
                  <button
                    key={cat}
                    type="button"
                    onClick={() => setUploadCategory(cat)}
                    className={`px-3 py-1.5 rounded-full text-xs font-medium border transition ${
                      uploadCategory === cat
                        ? "bg-gradient-to-r from-[#2563EB] to-[#38BDF8] text-white border-cyan-300"
                        : "bg-[#070D1F] text-silver border-blue-400/25"
                    }`}
                  >
                    {cat}
                  </button>
                ))}
              </div>
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
                className="bg-[#070D1F] border-blue-400/30 text-silver file:bg-[#101A36] file:text-white file:border-0 file:rounded-lg file:px-2.5 file:py-1 file:mr-2 file:text-xs rounded-xl"
              />
            </div>

            <Button
              type="submit"
              disabled={uploading || !uploadFile}
              className="w-full rounded-full bg-gradient-to-r from-[#2563EB] to-[#38BDF8] text-white font-bold shadow-[0_0_18px_rgba(56,189,248,0.45)]"
            >
              {uploading ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  Uploading...
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
