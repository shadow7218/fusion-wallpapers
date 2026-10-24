"use client";

import React, { useEffect, useState, useRef, useMemo } from "react";
import { createClient } from "@/utils/supabase/client";
import { User } from "@supabase/supabase-js";
import {
  Download,
  Upload,
  LogOut,
  User as UserIcon,
  Loader2,
  Trash2,
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
  Check,
  Settings,
  Eye,
  EyeOff,
  KeyRound,
  Mail,
  ArrowLeft,
  RefreshCw,
  AlertCircle,
  CheckCircle2,
  Maximize2,
  Minimize2,
  Edit3,
  Image as ImageIcon,
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

// Import your centralized categories config (Adjust path if needed: "./config/animeCategories" or "../config/animeCategories")
import { animeCategories } from "../config/animeCategories";

// --- DATA INTERFACES ---
interface Wallpaper {
  id: string;
  title: string;
  image_url: string;
  storage_path: string;
  category?: string;
  is_banner?: boolean;
  tags?: string[];
  downloads: number;
  created_at: string;
}

interface UserProfile {
  id: string;
  display_name: string;
}

interface PendingIntent {
  type: "download" | "save" | "saved_tab" | "profile_tab";
  wallpaper?: Wallpaper;
}

type AuthStep =
  | "SIGN_IN"
  | "SIGN_UP"
  | "FORGOT_PASSWORD"
  | "RESET_LINK_SENT"
  | "UPDATE_PASSWORD";

const ADMIN_UUID =
  process.env.NEXT_PUBLIC_ADMIN_UUID || "ccd4e82e-93fe-427f-a163-e19367b08649";

function FourPointStar({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className={className}>
      <path d="M12 1L14.8 9.2L23 12L14.8 14.8L12 23L9.2 14.8L1 12L9.2 9.2L12 1Z" />
    </svg>
  );
}

function maskEmailAddress(email?: string | null): string {
  if (!email || !email.includes("@")) return "user***@fusion.app";
  const [local, domain] = email.split("@");
  if (local.length <= 2) return `${local[0] || "u"}***@${domain}`;
  return `${local.slice(0, 3)}***@${domain}`;
}

function formatSupabaseAuthError(err: any): string {
  const msg = (err?.message || "").toLowerCase();
  if (msg.includes("rate limit") || err?.status === 429) {
    return "Email limit reached. Please wait ~15 minutes before requesting another email, or sign in with an existing account.";
  }
  if (msg.includes("invalid login credentials")) {
    return "Incorrect email or password. Please double-check and try again.";
  }
  if (msg.includes("already registered")) {
    return "This email is already registered. Please switch to Sign In.";
  }
  return err?.message || "Authentication failed. Please try again.";
}

function getWallpaperCategory(w: Wallpaper): string {
  if (w.category && w.category.trim() !== "") return w.category;
  return animeCategories[0].id; // Fallback
}

export default function FusionWallpapersApp() {
  const supabase = useMemo(() => createClient(), []);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const detailScrollRef = useRef<HTMLDivElement>(null);

  const [wallpapers, setWallpapers] = useState<Wallpaper[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [fetchError, setFetchError] = useState<string | null>(null);

  const [imageRatios, setImageRatios] = useState<Record<string, number>>({});
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [savedIds, setSavedIds] = useState<string[]>([]);
  const [savingInProgressIds, setSavingInProgressIds] = useState<string[]>([]);
  const [revealFullEmail, setRevealFullEmail] = useState<boolean>(false);

  // VIEW STATES
  const [activeTab, setActiveTab] = useState<"home" | "explore" | "saved" | "profile">("home");
  const [exploreView, setExploreView] = useState<"grid" | "category">("grid");
  const [selectedExploreCategory, setSelectedExploreCategory] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState<string>("");

  const [selectedWallpaper, setSelectedWallpaper] = useState<Wallpaper | null>(null);
  const [isExpanded, setIsExpanded] = useState<boolean>(false);
  const [imageDimensions, setImageDimensions] = useState<{ isWide: boolean; aspectRatio: number }>({ isWide: false, aspectRatio: 9 / 16 });
  const [relatedVisibleCount, setRelatedVisibleCount] = useState<number>(6);

  const [downloadingId, setDownloadingId] = useState<string | null>(null);
  const [downloadStatus, setDownloadStatus] = useState<{ id: string; type: "success" | "error"; message: string } | null>(null);

  const [isAuthModalOpen, setIsAuthModalOpen] = useState<boolean>(false);
  const [authStep, setAuthStep] = useState<AuthStep>("SIGN_IN");
  const [authReason, setAuthReason] = useState<string>("Sign in to save wallpapers and unlock full-resolution downloads.");
  const [pendingIntent, setPendingIntent] = useState<PendingIntent | null>(null);
  const [authEmail, setAuthEmail] = useState<string>("");
  const [authPassword, setAuthPassword] = useState<string>("");
  const [authConfirmPassword, setAuthConfirmPassword] = useState<string>("");
  const [authLoading, setAuthLoading] = useState<boolean>(false);
  const [authError, setAuthError] = useState<string | null>(null);
  const [authSuccessMsg, setAuthSuccessMsg] = useState<string | null>(null);
  const [resendCooldown, setResendCooldown] = useState<number>(0);

  const [isSettingsModalOpen, setIsSettingsModalOpen] = useState<boolean>(false);
  const [editDisplayName, setEditDisplayName] = useState<string>("");
  const [newPasswordInput, setNewPasswordInput] = useState<string>("");
  const [confirmNewPasswordInput, setConfirmNewPasswordInput] = useState<string>("");
  const [settingsLoading, setSettingsLoading] = useState<boolean>(false);
  const [settingsFeedback, setSettingsFeedback] = useState<{ type: "success" | "error"; text: string } | null>(null);

  // ADMIN STATES
  const [isUploadModalOpen, setIsUploadModalOpen] = useState<boolean>(false);
  const [uploadTitle, setUploadTitle] = useState<string>("");
  const [uploadCategory, setUploadCategory] = useState<string>(animeCategories[0].id);
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState<boolean>(false);

  const [isEditModalOpen, setIsEditModalOpen] = useState<boolean>(false);
  const [editCategorySelection, setEditCategorySelection] = useState<string>("");
  const [editSetAsBanner, setEditSetAsBanner] = useState<boolean>(false);
  const [editingWallpaper, setEditingWallpaper] = useState<boolean>(false);

  const isAdmin = user?.id === ADMIN_UUID;

  useEffect(() => {
    const init = async () => {
      await fetchWallpapers();
      const { data: { session } } = await supabase.auth.getSession();
      const currentUser = session?.user ?? null;
      setUser(currentUser);
      if (currentUser) {
        await Promise.all([fetchUserProfile(currentUser), fetchSavedWallpapers(currentUser.id)]);
      }
    };
    init();

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      const currentUser = session?.user ?? null;
      setUser(currentUser);
      if (event === "PASSWORD_RECOVERY") {
        setAuthStep("UPDATE_PASSWORD");
        setAuthError(null);
        setAuthSuccessMsg("Recovery link verified! Enter your new password below.");
        setIsAuthModalOpen(true);
      }
      if (currentUser) {
        await Promise.all([fetchUserProfile(currentUser), fetchSavedWallpapers(currentUser.id)]);
      } else {
        setProfile(null);
        setSavedIds([]);
        setRevealFullEmail(false);
      }
    });

    return () => subscription.unsubscribe();
  }, [supabase]);

  useEffect(() => {
    if (resendCooldown <= 0) return;
    const timer = setInterval(() => setResendCooldown((prev) => Math.max(0, prev - 1)), 1000);
    return () => clearInterval(timer);
  }, [resendCooldown]);

  useEffect(() => {
    const handlePopState = () => { if (selectedWallpaper) setSelectedWallpaper(null); };
    window.addEventListener("popstate", handlePopState);
    return () => window.removeEventListener("popstate", handlePopState);
  }, [selectedWallpaper]);

  useEffect(() => {
    if (!selectedWallpaper) {
      setIsExpanded(false);
      return;
    }
    const img = new Image();
    img.src = selectedWallpaper.image_url;
    img.onload = () => {
      const ratio = img.naturalWidth / img.naturalHeight;
      const isWide = ratio > (9 / 16) + 0.03;
      setImageDimensions({ isWide, aspectRatio: ratio });
    };
  }, [selectedWallpaper]);

  const openWallpaperDetail = (wallpaper: Wallpaper) => {
    if (!selectedWallpaper) window.history.pushState({ wallpaperId: wallpaper.id }, "");
    setSelectedWallpaper(wallpaper);
    setRelatedVisibleCount(6);
    setDownloadStatus(null);
    setIsExpanded(false);
    if (detailScrollRef.current) detailScrollRef.current.scrollTo({ top: 0, behavior: "smooth" });
  };

  const closeWallpaperDetail = () => {
    setSelectedWallpaper(null);
    setDownloadStatus(null);
    setIsExpanded(false);
  };

  const fetchWallpapers = async () => {
    setLoading(true);
    setFetchError(null);
    try {
      const { data, error } = await supabase.from("wallpapers").select("*").order("created_at", { ascending: false });
      if (error) throw error;
      setWallpapers(data || []);
    } catch (err: any) {
      setFetchError(err.message || "Could not load wallpapers.");
    } finally {
      setLoading(false);
    }
  };

  const fetchUserProfile = async (currentUser: User) => {
    const fallbackName = currentUser.email?.split("@")[0] || "Fusion Member";
    const { data, error } = await supabase.from("profiles").select("id, display_name").eq("id", currentUser.id).maybeSingle();
    if (!error && data) {
      setProfile({ id: data.id, display_name: data.display_name || fallbackName });
      setEditDisplayName(data.display_name || fallbackName);
    } else {
      setProfile({ id: currentUser.id, display_name: fallbackName });
      setEditDisplayName(fallbackName);
    }
  };

  const fetchSavedWallpapers = async (userId: string) => {
    const { data, error } = await supabase.from("saved_wallpapers").select("wallpaper_id").eq("user_id", userId).order("created_at", { ascending: false });
    if (!error && data) setSavedIds(data.map((row) => row.wallpaper_id));
  };

  const requireAuthForAction = (reason: string, intent: PendingIntent, initialStep: AuthStep = "SIGN_IN") => {
    setAuthReason(reason);
    setPendingIntent(intent);
    setAuthStep(initialStep);
    setAuthError(null);
    setAuthSuccessMsg(null);
    setIsAuthModalOpen(true);
  };

  const executePendingIntentAfterAuth = async (authenticatedUser: User) => {
    if (!pendingIntent) return;
    const intent = pendingIntent;
    setPendingIntent(null);
    if (intent.type === "download" && intent.wallpaper) {
      setSelectedWallpaper(intent.wallpaper);
      await triggerDirectDownload(intent.wallpaper, authenticatedUser);
    } else if (intent.type === "save" && intent.wallpaper) {
      setSelectedWallpaper(intent.wallpaper);
      await toggleSaveWallpaper(null, intent.wallpaper, authenticatedUser);
    } else if (intent.type === "saved_tab") {
      setActiveTab("saved");
    } else if (intent.type === "profile_tab") {
      setActiveTab("profile");
    }
  };

  const isValidEmail = (value: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim());

  const handleSignInSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (authLoading) return;
    setAuthError(null);
    setAuthSuccessMsg(null);
    const cleanEmail = authEmail.trim().toLowerCase();
    if (!isValidEmail(cleanEmail)) return setAuthError("Please enter a valid email address.");

    setAuthLoading(true);
    try {
      const { data, error } = await supabase.auth.signInWithPassword({ email: cleanEmail, password: authPassword });
      if (error) throw error;
      setIsAuthModalOpen(false);
      setAuthPassword("");
      if (data.user) await executePendingIntentAfterAuth(data.user);
    } catch (err: any) {
      setAuthError(formatSupabaseAuthError(err));
    } finally {
      setAuthLoading(false);
    }
  };

  const handleSignUpSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (authLoading) return;
    setAuthError(null);
    setAuthSuccessMsg(null);
    const cleanEmail = authEmail.trim().toLowerCase();
    if (!isValidEmail(cleanEmail)) return setAuthError("Please enter a valid email address.");
    if (authPassword.length < 6) return setAuthError("Password must be at least 6 characters long.");
    if (authPassword !== authConfirmPassword) return setAuthError("Passwords do not match.");

    setAuthLoading(true);
    try {
      const { data, error } = await supabase.auth.signUp({ email: cleanEmail, password: authPassword });
      if (error) throw error;
      if (data.session && data.user) {
        const defaultName = cleanEmail.split("@")[0] || "Fusion Explorer";
        await supabase.from("profiles").upsert({ id: data.user.id, display_name: defaultName });
        await fetchUserProfile(data.user);
        setIsAuthModalOpen(false);
        setAuthPassword("");
        setAuthConfirmPassword("");
        await executePendingIntentAfterAuth(data.user);
        return;
      }
      setAuthPassword("");
      setAuthConfirmPassword("");
      setAuthStep("SIGN_IN");
      setAuthSuccessMsg(`Account created! Please check ${cleanEmail} for a confirmation link, then sign in below.`);
    } catch (err: any) {
      setAuthError(formatSupabaseAuthError(err));
    } finally {
      setAuthLoading(false);
    }
  };

  const handleForgotPasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (authLoading || resendCooldown > 0) return;
    setAuthError(null);
    setAuthSuccessMsg(null);
    const cleanEmail = authEmail.trim().toLowerCase();
    if (!isValidEmail(cleanEmail)) return setAuthError("Please enter your registered email address.");

    setAuthLoading(true);
    try {
      const redirectUrl = typeof window !== "undefined" ? window.location.origin : undefined;
      const { error } = await supabase.auth.resetPasswordForEmail(cleanEmail, { redirectTo: redirectUrl });
      if (error) throw error;
      setResendCooldown(60);
      setAuthStep("RESET_LINK_SENT");
      setAuthSuccessMsg(`Password reset instructions have been sent to ${cleanEmail}.`);
    } catch (err: any) {
      setAuthError(formatSupabaseAuthError(err));
    } finally {
      setAuthLoading(false);
    }
  };

  const handleUpdateRecoveredPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (authLoading) return;
    setAuthError(null);
    if (authPassword.length < 6) return setAuthError("New password must be at least 6 characters long.");
    if (authPassword !== authConfirmPassword) return setAuthError("Passwords do not match.");

    setAuthLoading(true);
    try {
      const { data, error } = await supabase.auth.updateUser({ password: authPassword });
      if (error) throw error;
      setIsAuthModalOpen(false);
      setAuthPassword("");
      setAuthConfirmPassword("");
      setAuthStep("SIGN_IN");
      if (data.user) await executePendingIntentAfterAuth(data.user);
    } catch (err: any) {
      setAuthError(formatSupabaseAuthError(err));
    } finally {
      setAuthLoading(false);
    }
  };

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    setIsSettingsModalOpen(false);
  };

  const toggleSaveWallpaper = async (e: React.MouseEvent | null, wallpaper: Wallpaper, overrideUser?: User | null) => {
    if (e) e.stopPropagation();
    const activeUser = overrideUser !== undefined ? overrideUser : user;
    if (!activeUser) {
      requireAuthForAction(`Sign in to save "${wallpaper.title}" to your collection across devices.`, { type: "save", wallpaper });
      return;
    }
    if (savingInProgressIds.includes(wallpaper.id)) return;
    const currentlySaved = savedIds.includes(wallpaper.id);
    setSavingInProgressIds((prev) => [...prev, wallpaper.id]);

    setSavedIds((prev) => currentlySaved ? prev.filter((id) => id !== wallpaper.id) : [wallpaper.id, ...prev]);

    try {
      if (currentlySaved) {
        const { error } = await supabase.from("saved_wallpapers").delete().eq("user_id", activeUser.id).eq("wallpaper_id", wallpaper.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("saved_wallpapers").upsert({ user_id: activeUser.id, wallpaper_id: wallpaper.id }, { onConflict: "user_id,wallpaper_id" });
        if (error) throw error;
      }
    } catch (err) {
      setSavedIds((prev) => currentlySaved ? [wallpaper.id, ...prev] : prev.filter((id) => id !== wallpaper.id));
    } finally {
      setSavingInProgressIds((prev) => prev.filter((id) => id !== wallpaper.id));
    }
  };

  const triggerDirectDownload = async (wallpaper: Wallpaper, overrideUser?: User | null) => {
    const activeUser = overrideUser !== undefined ? overrideUser : user;
    if (!activeUser) {
      requireAuthForAction(`Sign in to download "${wallpaper.title}" in full original resolution.`, { type: "download", wallpaper });
      return;
    }
    if (downloadingId === wallpaper.id) return;
    setDownloadingId(wallpaper.id);
    setDownloadStatus(null);

    try {
      let fileBlob: Blob | null = null;
      if (wallpaper.storage_path) {
        const { data, error } = await supabase.storage.from("wallpapers").download(wallpaper.storage_path);
        if (!error && data) fileBlob = data;
      }
      if (!fileBlob) {
        const response = await fetch(wallpaper.image_url, { mode: "cors" });
        if (!response.ok) throw new Error("Image file could not be reached.");
        fileBlob = await response.blob();
      }
      if (!fileBlob || fileBlob.size === 0) throw new Error("Downloaded file is empty or unavailable.");

      const extFromPath = wallpaper.storage_path?.split(".").pop()?.toLowerCase();
      const validExt = extFromPath && ["jpg", "jpeg", "png", "webp"].includes(extFromPath) ? extFromPath : "jpg";
      const cleanTitle = wallpaper.title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

      const blobUrl = window.URL.createObjectURL(fileBlob);
      const link = document.createElement("a");
      link.href = blobUrl;
      link.download = `${cleanTitle || "fusion-wallpaper"}-${wallpaper.id.slice(0, 5)}.${validExt}`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(blobUrl);

      setDownloadStatus({ id: wallpaper.id, type: "success", message: "Full-resolution download complete!" });
    } catch (err: any) {
      setDownloadStatus({ id: wallpaper.id, type: "error", message: err.message || "Download failed. Please check your connection and retry." });
    } finally {
      setDownloadingId(null);
    }
  };

  const handleSaveAccountSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || settingsLoading) return;
    setSettingsFeedback(null);
    setSettingsLoading(true);

    try {
      const trimmedName = editDisplayName.trim();
      if (!trimmedName) throw new Error("Display name cannot be empty.");
      const { error: profileError } = await supabase.from("profiles").upsert({ id: user.id, display_name: trimmedName, updated_at: new Date().toISOString() });
      if (profileError) throw profileError;

      setProfile({ id: user.id, display_name: trimmedName });

      if (newPasswordInput.trim().length > 0) {
        if (newPasswordInput.length < 6) throw new Error("New password must be at least 6 characters.");
        if (newPasswordInput !== confirmNewPasswordInput) throw new Error("New passwords do not match.");
        const { error: pwError } = await supabase.auth.updateUser({ password: newPasswordInput });
        if (pwError) throw pwError;
        setNewPasswordInput("");
        setConfirmNewPasswordInput("");
      }

      setSettingsFeedback({ type: "success", text: "Account settings updated successfully." });
    } catch (err: any) {
      setSettingsFeedback({ type: "error", text: err.message || "Failed to update settings." });
    } finally {
      setSettingsLoading(false);
    }
  };

  // --- ADMIN UPLOAD WITH AUTO-BANNER ---
  const handleAdminUpload = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isAdmin || !uploadFile || !uploadTitle.trim() || uploading) return;
    setUploading(true);

    try {
      const fileExt = uploadFile.name.split(".").pop();
      const fileName = `${uploadCategory.toLowerCase()}-${Date.now()}-${Math.random().toString(36).substring(2, 7)}.${fileExt}`;

      const { error: storageError } = await supabase.storage.from("wallpapers").upload(fileName, uploadFile, { cacheControl: "3600", upsert: false });
      if (storageError) throw storageError;

      const { data: { publicUrl } } = supabase.storage.from("wallpapers").getPublicUrl(fileName);

      // Check if this is the very first wallpaper for this category
      const { data: existingInCategory } = await supabase.from("wallpapers").select("id").eq("category", uploadCategory).limit(1);
      const isFirst = !existingInCategory || existingInCategory.length === 0;

      const { error: dbError } = await supabase.from("wallpapers").insert([{
        title: uploadTitle.trim(),
        image_url: publicUrl,
        storage_path: fileName,
        category: uploadCategory,
        is_banner: isFirst // Automatically set banner if it's the first
      }]);

      if (dbError) {
        const { error: fallbackError } = await supabase.from("wallpapers").insert([{ title: uploadTitle.trim(), image_url: publicUrl, storage_path: fileName }]);
        if (fallbackError) throw fallbackError;
      }

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

  const handleAdminDelete = async (e: React.MouseEvent, wallpaper: Wallpaper) => {
    e.stopPropagation();
    if (!isAdmin) return;
    if (!window.confirm(`Delete "${wallpaper.title}" permanently?`)) return;

    try {
      await supabase.storage.from("wallpapers").remove([wallpaper.storage_path]);
      await supabase.from("wallpapers").delete().eq("id", wallpaper.id);
      setWallpapers((prev) => prev.filter((w) => w.id !== wallpaper.id));
      if (selectedWallpaper?.id === wallpaper.id) closeWallpaperDetail();
    } catch (err: any) {
      alert(`Delete failed: ${err.message}`);
    }
  };

  // --- ADMIN EDIT CATEGORY & BANNER ---
  const handleAdminEditSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isAdmin || !selectedWallpaper || editingWallpaper) return;
    setEditingWallpaper(true);

    try {
      if (editSetAsBanner) {
        // Unset old banner for this category
        await supabase.from("wallpapers").update({ is_banner: false }).eq("category", editCategorySelection);
      }
      
      const { error } = await supabase.from("wallpapers").update({
        category: editCategorySelection,
        is_banner: editSetAsBanner
      }).eq("id", selectedWallpaper.id);

      if (error) throw error;
      
      setIsEditModalOpen(false);
      await fetchWallpapers(); // Refresh to show updated category/banner
      closeWallpaperDetail();
    } catch (err: any) {
      alert(`Failed to update wallpaper: ${err.message}`);
    } finally {
      setEditingWallpaper(false);
    }
  };

  // --- GALLERIES ---
  const filteredWallpapers = useMemo(() => {
    return wallpapers.filter((item) => {
      if (activeTab === "saved" && !savedIds.includes(item.id)) return false;
      
      // If we are deep in a category view on Explore
      if (activeTab === "explore" && exploreView === "category" && selectedExploreCategory) {
         if (getWallpaperCategory(item) !== selectedExploreCategory) return false;
      }

      const q = searchQuery.trim().toLowerCase();
      if (q) {
        const itemCat = getWallpaperCategory(item).toLowerCase();
        return item.title.toLowerCase().includes(q) || itemCat.includes(q) || item.storage_path.toLowerCase().includes(q);
      }

      return true;
    });
  }, [wallpapers, activeTab, savedIds, searchQuery, exploreView, selectedExploreCategory]);

  const savedWallpapersList = useMemo(() => wallpapers.filter((w) => savedIds.includes(w.id)), [wallpapers, savedIds]);

  const relatedWallpapers = useMemo(() => {
    if (!selectedWallpaper) return [];
    const currentCat = getWallpaperCategory(selectedWallpaper).toLowerCase();
    const others = wallpapers.filter((w) => w.id !== selectedWallpaper.id);
    const scored = others.map((candidate) => {
      let score = 0;
      if (getWallpaperCategory(candidate).toLowerCase() === currentCat) score += 10;
      return { wallpaper: candidate, score };
    });
    scored.sort((a, b) => b.score - a.score);
    return scored.map((s) => s.wallpaper);
  }, [wallpapers, selectedWallpaper]);

  const renderWallpaperCard = (item: Wallpaper, options?: { showRemoveSavedBtn?: boolean }) => {
    const isSaved = savedIds.includes(item.id);
    const ratio = imageRatios[item.id];
    const isTall = ratio !== undefined && ratio <= 0.57;

    return (
      <div
        key={item.id}
        onClick={() => openWallpaperDetail(item)}
        className="break-inside-avoid group relative rounded-2xl overflow-hidden bg-[#0A1128]/80 backdrop-blur-xl border border-blue-400/30 shadow-[0_8px_30px_rgba(0,0,0,0.65)] cursor-pointer transition-all duration-300 hover:border-cyan-400/70 hover:shadow-[0_0_25px_rgba(56,189,248,0.3)] mb-3.5"
      >
        <div
          className={`relative w-full overflow-hidden bg-[#050A18] flex items-center justify-center transition-all ${isTall ? "aspect-[9/16]" : ""}`}
          onContextMenu={(e) => e.preventDefault()}
        >
          <img
            src={item.image_url}
            alt={item.title}
            loading="lazy"
            draggable={false}
            onLoad={(e) => {
              const { naturalWidth, naturalHeight } = e.currentTarget;
              setImageRatios((prev) => ({ ...prev, [item.id]: naturalWidth / naturalHeight }));
            }}
            onContextMenu={(e) => e.preventDefault()}
            className={`w-full block pointer-events-none select-none transition-transform duration-500 group-hover:scale-[1.03] ${isTall ? "h-full object-cover" : "h-auto object-cover"}`}
          />

          <div className="absolute inset-0 z-10 bg-transparent" onContextMenu={(e) => e.preventDefault()} />

          <button
            type="button"
            aria-label={isSaved ? "Remove from saved" : "Save wallpaper"}
            onClick={(e) => toggleSaveWallpaper(e, item)}
            className="absolute top-2.5 right-2.5 z-20 h-8 w-8 rounded-full bg-black/45 backdrop-blur-md border border-white/20 flex items-center justify-center text-white hover:bg-black/70 transition active:scale-95"
          >
            <Bookmark className={`h-4 w-4 transition ${isSaved ? "fill-cyan-400 text-cyan-400" : "text-white"}`} />
          </button>

          {isAdmin && !options?.showRemoveSavedBtn && (
            <button
              type="button"
              aria-label="Delete wallpaper"
              onClick={(e) => handleAdminDelete(e, item)}
              className="absolute top-2.5 left-2.5 z-20 h-8 w-8 rounded-full bg-red-950/75 backdrop-blur-md border border-red-400/30 flex items-center justify-center text-red-300 hover:bg-red-900 transition"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          )}

          <div className="absolute inset-x-0 bottom-0 z-20 bg-gradient-to-t from-[#050A18]/95 via-[#050A18]/60 to-transparent pt-10 pb-2.5 px-3 flex items-end">
            <h3 className="text-xs sm:text-sm font-semibold text-white tracking-wide drop-shadow truncate">
              {item.title}
            </h3>
          </div>
        </div>
      </div>
    );
  };

  const detailRatio = selectedWallpaper ? imageRatios[selectedWallpaper.id] : undefined;
  const detailIsTall = detailRatio !== undefined && detailRatio <= 0.57;

  return (
    <div
      className="min-h-screen bg-[#050A18] text-platinum flex flex-col pb-24 relative overflow-x-hidden selection:bg-cyan-500 selection:text-black"
      onContextMenu={(e) => e.preventDefault()}
    >
      <div className="pointer-events-none fixed top-0 left-1/2 -translate-x-1/2 w-[540px] h-[240px] bg-blue-600/15 blur-[120px] rounded-full z-0" />

      {/* ================= STICKY LIQUID GLASS HEADER ================= */}
      <header className="sticky top-0 z-30 bg-[#050A18]/75 backdrop-blur-2xl px-4 pt-3.5 pb-2.5 border-b border-blue-500/15">
        <div className="max-w-5xl mx-auto flex items-center justify-between">
          <button
            type="button"
            onClick={() => {
              setActiveTab("home");
              setSearchQuery("");
              window.scrollTo({ top: 0, behavior: "smooth" });
            }}
            className="flex items-center gap-3 text-left focus:outline-none"
          >
            <div className="relative flex items-center justify-center">
              <div className="absolute inset-0 bg-cyan-400 blur-md opacity-70 rounded-full" />
              <FourPointStar className="h-6 w-6 sm:h-7 sm:w-7 text-white relative z-10 drop-shadow-[0_0_10px_rgba(56,189,248,0.9)]" />
            </div>
            <span className="text-lg sm:text-2xl font-bold tracking-[0.28em] text-white uppercase">
              FUSION
            </span>
          </button>

          <div className="flex items-center gap-2">
            {isAdmin && (
              <button
                type="button"
                onClick={() => setIsUploadModalOpen(true)}
                className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-full bg-gradient-to-r from-cyan-400 to-blue-600 text-white text-xs font-semibold shadow-[0_0_15px_rgba(56,189,248,0.45)] hover:opacity-95 transition"
              >
                <Upload className="h-3.5 w-3.5" />
                <span>Upload</span>
              </button>
            )}

            {user ? (
              <button
                type="button"
                onClick={() => setActiveTab("profile")}
                className="flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-[#0E1730]/80 backdrop-blur-md border border-blue-400/35 text-platinum text-xs sm:text-sm font-medium shadow-[0_0_15px_rgba(59,130,246,0.25)] hover:border-cyan-400/70 transition"
              >
                <UserIcon className="h-4 w-4 text-cyan-400" />
                <span className="max-w-[100px] truncate">{profile?.display_name || "Account"}</span>
              </button>
            ) : (
              <button
                type="button"
                onClick={() => requireAuthForAction("Sign in to save wallpapers and unlock full-resolution downloads.", { type: "profile_tab" }, "SIGN_IN")}
                className="flex items-center gap-2 px-4 py-1.5 rounded-full bg-[#0E1730]/80 backdrop-blur-md border border-blue-400/40 text-white text-xs sm:text-sm font-medium shadow-[0_0_15px_rgba(59,130,246,0.25)] hover:border-cyan-400/70 transition"
              >
                <UserIcon className="h-4 w-4 text-silver" />
                <span>Sign In</span>
              </button>
            )}
          </div>
        </div>
      </header>

      {/* ================= SEARCH BAR (Always present on Home & Explore) ================= */}
      {(activeTab === "home" || activeTab === "explore") && (
        <div className="max-w-5xl w-full mx-auto px-4 pt-4 pb-2 z-10 space-y-3.5">
          <div className="relative flex items-center w-full h-12 rounded-full bg-[#0A1128]/85 backdrop-blur-xl border border-blue-400/35 px-4 shadow-[0_0_25px_rgba(37,99,235,0.2)] focus-within:border-cyan-400/80 focus-within:shadow-[0_0_30px_rgba(56,189,248,0.4)] transition-all">
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
              <button type="button" aria-label="Clear search" onClick={() => setSearchQuery("")} className="text-silver/70 hover:text-white p-1">
                <X className="h-4 w-4" />
              </button>
            ) : null}
          </div>
        </div>
      )}

      {/* ================= MAIN CONTENT AREA ================= */}
      {activeTab === "profile" ? (
        <main className="flex-1 max-w-5xl w-full mx-auto px-4 pt-2 pb-12 z-10">
          {user ? (
            <div className="space-y-8">
              <div className="rounded-3xl bg-[#0A1128]/85 backdrop-blur-2xl border border-blue-400/30 p-5 sm:p-7 shadow-[0_12px_40px_rgba(0,0,0,0.6)]">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-5">
                  <div className="flex items-center gap-4">
                    <div className="h-16 w-16 rounded-full bg-gradient-to-br from-blue-600 to-cyan-400 p-[2px] shadow-[0_0_20px_rgba(56,189,248,0.4)] shrink-0">
                      <div className="h-full w-full rounded-full bg-[#050A18] flex items-center justify-center text-xl font-bold text-white uppercase">
                        {(profile?.display_name || user.email || "U")[0]}
                      </div>
                    </div>

                    <div className="space-y-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <h2 className="text-lg sm:text-xl font-bold text-white truncate">{profile?.display_name || "Fusion Explorer"}</h2>
                        {isAdmin && <span className="text-[10px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded-full bg-cyan-500/20 text-cyan-300 border border-cyan-400/30">Admin</span>}
                      </div>

                      <div className="flex items-center gap-2 text-xs sm:text-sm text-silver">
                        <span className="truncate">{revealFullEmail ? user.email : maskEmailAddress(user.email)}</span>
                        <button type="button" onClick={() => setRevealFullEmail(!revealFullEmail)} className="text-cyan-400 hover:text-cyan-300 p-1 rounded-md transition">
                          {revealFullEmail ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                        </button>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2.5">
                    <Button type="button" onClick={() => { setSettingsFeedback(null); setEditDisplayName(profile?.display_name || user.email?.split("@")[0] || ""); setIsSettingsModalOpen(true); }} className="flex-1 sm:flex-none rounded-full bg-[#101A36] hover:bg-[#16244A] text-white border border-blue-400/35 text-xs sm:text-sm h-10 px-4">
                      <Settings className="h-4 w-4 mr-1.5 text-cyan-400" /> Account Settings
                    </Button>
                    <Button type="button" variant="outline" onClick={handleSignOut} className="flex-1 sm:flex-none rounded-full bg-transparent hover:bg-red-950/40 text-silver hover:text-red-300 border border-silver/20 text-xs sm:text-sm h-10 px-4">
                      <LogOut className="h-4 w-4 mr-1.5" /> Sign Out
                    </Button>
                  </div>
                </div>
              </div>

              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-base sm:text-lg font-bold text-white tracking-wide">My Saved Wallpapers</h3>
                  <span className="text-xs text-silver">{savedWallpapersList.length} {savedWallpapersList.length === 1 ? "item" : "items"}</span>
                </div>
                {savedWallpapersList.length === 0 ? (
                  <div className="rounded-3xl bg-[#0A1128]/70 backdrop-blur-xl border border-blue-400/20 p-10 text-center max-w-md mx-auto my-6">
                    <Bookmark className="h-10 w-10 text-cyan-400 mx-auto mb-3 opacity-80" />
                    <p className="text-sm sm:text-base font-semibold text-white">You haven&apos;t saved any wallpapers yet.</p>
                    <p className="text-xs text-silver mt-1.5 mb-5">Tap the bookmark icon on any wallpaper to keep your favorites synced across all your devices.</p>
                    <Button type="button" onClick={() => setActiveTab("explore")} className="rounded-full bg-gradient-to-r from-[#2563EB] to-[#38BDF8] text-white font-semibold px-6 shadow-[0_0_18px_rgba(56,189,248,0.4)]">
                      Explore Wallpapers
                    </Button>
                  </div>
                ) : (
                  <div className="columns-2 sm:columns-3 md:columns-4 gap-3.5 space-y-3.5">
                    {savedWallpapersList.map((item) => renderWallpaperCard(item, { showRemoveSavedBtn: true }))}
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div className="rounded-3xl bg-[#0A1128]/85 backdrop-blur-2xl border border-blue-400/30 p-8 sm:p-10 text-center max-w-md mx-auto my-8 shadow-[0_12px_40px_rgba(0,0,0,0.6)]">
              <div className="mx-auto h-16 w-16 rounded-full bg-[#050A18] border border-cyan-400/40 flex items-center justify-center mb-4 shadow-[0_0_20px_rgba(56,189,248,0.25)]">
                <UserIcon className="h-8 w-8 text-cyan-400" />
              </div>
              <h2 className="text-xl font-bold text-white">Your Fusion Account</h2>
              <p className="text-xs sm:text-sm text-silver mt-2 leading-relaxed">
                Sign in or create a free account to download original full-resolution wallpapers and sync your saved collection across all your devices.
              </p>
              <div className="flex flex-col sm:flex-row gap-3 mt-6">
                <Button type="button" onClick={() => requireAuthForAction("Sign in to access your saved wallpapers and full-resolution downloads.", { type: "profile_tab" }, "SIGN_IN")} className="flex-1 rounded-full bg-gradient-to-r from-[#2563EB] to-[#38BDF8] text-white font-semibold h-11 shadow-[0_0_18px_rgba(56,189,248,0.4)]">
                  Sign In
                </Button>
                <Button type="button" variant="outline" onClick={() => requireAuthForAction("Create a free account to unlock full-resolution downloads and saved wallpapers.", { type: "profile_tab" }, "SIGN_UP")} className="flex-1 rounded-full bg-[#101A36] text-white border-blue-400/35 hover:bg-[#16244A] font-semibold h-11">
                  Create Account
                </Button>
              </div>
            </div>
          )}
        </main>
      ) : activeTab === "explore" && !searchQuery ? (
        /* ================= NEW ANIME CATEGORY DISCOVERY (EXPLORE PAGE) ================= */
        <main className="flex-1 max-w-5xl w-full mx-auto px-4 z-10 pb-8">
          {exploreView === "grid" ? (
            <div className="space-y-6 pt-2">
              <div className="flex items-center gap-2">
                <Compass className="h-5 w-5 text-cyan-400" />
                <h2 className="text-lg font-bold text-white tracking-wide">Explore Anime</h2>
              </div>
              
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
                {animeCategories.map((cat) => {
                  // Find wallpapers for this category
                  const catWallpapers = wallpapers.filter(w => getWallpaperCategory(w) === cat.id);
                  // Find banner wallpaper
                  let banner = catWallpapers.find(w => w.is_banner);
                  // Fallback to the first uploaded wallpaper in that category if no explicit banner
                  if (!banner && catWallpapers.length > 0) banner = catWallpapers[catWallpapers.length - 1];
                  
                  const bannerUrl = banner ? banner.image_url : cat.fallbackBanner;
                  
                  return (
                    <div 
                      key={cat.id} 
                      onClick={() => {
                        setSelectedExploreCategory(cat.id);
                        setExploreView("category");
                        window.scrollTo({ top: 0, behavior: "smooth" });
                      }}
                      className="group relative h-36 sm:h-44 rounded-3xl overflow-hidden bg-[#0A1128] border border-blue-400/30 cursor-pointer shadow-[0_8px_30px_rgba(0,0,0,0.5)] hover:border-cyan-400/70 hover:shadow-[0_0_30px_rgba(56,189,248,0.3)] transition-all duration-300"
                    >
                      <img 
                        src={bannerUrl} 
                        alt={cat.name} 
                        className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105 pointer-events-none select-none"
                      />
                      <div className="absolute inset-0 bg-gradient-to-t from-[#050A18]/95 via-[#050A18]/40 to-transparent" />
                      <div className="absolute bottom-4 left-4 right-4">
                        <h3 className="text-lg font-bold text-white tracking-wide drop-shadow-md">{cat.name}</h3>
                        <p className="text-xs text-silver mt-0.5">{catWallpapers.length} {catWallpapers.length === 1 ? 'wallpaper' : 'wallpapers'}</p>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ) : (
            <div className="space-y-4 pt-2">
              <button 
                onClick={() => setExploreView("grid")}
                className="flex items-center gap-1.5 text-xs font-semibold text-silver hover:text-cyan-400 transition"
              >
                <ArrowLeft className="h-4 w-4" /> Back to Explore
              </button>
              
              <div className="flex items-center justify-between">
                <h2 className="text-xl font-bold text-white tracking-wide">
                  {animeCategories.find(c => c.id === selectedExploreCategory)?.name || "Category"}
                </h2>
              </div>

              {filteredWallpapers.length === 0 ? (
                <div className="bg-[#0A1128]/80 backdrop-blur-xl border border-blue-400/25 rounded-3xl p-10 text-center max-w-md mx-auto my-6">
                  <ImageIcon className="h-10 w-10 text-cyan-400 mx-auto mb-3 opacity-80" />
                  <h3 className="text-base font-semibold text-white">No Wallpapers Yet</h3>
                  <p className="text-xs text-silver mt-1.5 mb-5 leading-relaxed">
                    Admin hasn&apos;t uploaded any wallpapers for this category.
                  </p>
                </div>
              ) : (
                <div className="columns-2 sm:columns-3 md:columns-4 gap-3.5 space-y-3.5">
                  {filteredWallpapers.map((item) => renderWallpaperCard(item))}
                </div>
              )}
            </div>
          )}
        </main>
      ) : (
        /* ================= HOME & SEARCH GALLERY ================= */
        <main className="flex-1 max-w-5xl w-full mx-auto px-4 z-10">
          {activeTab === "saved" && (
            <div className="mb-3.5 flex items-center justify-between">
              <h2 className="text-sm font-bold text-white tracking-wide uppercase">Saved Wallpapers ({filteredWallpapers.length})</h2>
            </div>
          )}

          {loading ? (
            <div className="columns-2 sm:columns-3 md:columns-4 gap-3.5 space-y-3.5">
              {[260, 190, 230, 280, 200, 250].map((height, idx) => (
                <div key={idx} style={{ height: `${height}px` }} className="break-inside-avoid rounded-2xl bg-[#0A1128]/70 backdrop-blur-md border border-blue-400/20 animate-pulse" />
              ))}
            </div>
          ) : fetchError ? (
            <div className="rounded-3xl bg-[#0A1128]/85 backdrop-blur-xl border border-red-400/30 p-8 text-center max-w-md mx-auto my-8">
              <AlertCircle className="h-10 w-10 text-red-400 mx-auto mb-3" />
              <h3 className="text-base font-bold text-white">Connection Error</h3>
              <p className="text-xs text-silver mt-1 mb-4">{fetchError}</p>
              <Button type="button" onClick={fetchWallpapers} className="rounded-full bg-gradient-to-r from-[#2563EB] to-[#38BDF8] text-white font-semibold px-5">
                <RefreshCw className="h-4 w-4 mr-1.5" /> Retry
              </Button>
            </div>
          ) : filteredWallpapers.length === 0 ? (
            <div className="bg-[#0A1128]/80 backdrop-blur-xl border border-blue-400/25 rounded-3xl p-10 text-center max-w-md mx-auto my-6">
              <FourPointStar className="h-10 w-10 text-cyan-400 mx-auto mb-3 opacity-80" />
              <h3 className="text-base font-semibold text-white">
                {activeTab === "saved" ? "You haven't saved any wallpapers yet." : "No Wallpapers Found"}
              </h3>
              <p className="text-xs text-silver mt-1.5 mb-5 leading-relaxed">
                {activeTab === "saved" ? "Tap the bookmark icon on any wallpaper to save it to your account." : "Try clearing your search filter."}
              </p>
            </div>
          ) : (
            <div className="columns-2 sm:columns-3 md:columns-4 gap-3.5 space-y-3.5">
              {filteredWallpapers.map((item) => renderWallpaperCard(item))}
            </div>
          )}
        </main>
      )}

      {/* ================= FLOATING LIQUID GLASS BOTTOM NAVIGATION ================= */}
      <nav
        aria-label="Primary Bottom Navigation"
        className="fixed bottom-3 left-1/2 -translate-x-1/2 z-30 w-[88%] max-w-sm rounded-full bg-[#0A1128]/85 backdrop-blur-2xl border border-blue-400/40 px-5 py-2 shadow-[0_12px_35px_rgba(0,0,0,0.8),0_0_25px_rgba(37,99,235,0.25)]"
      >
        <div className="flex items-center justify-between">
          <button type="button" onClick={() => { setActiveTab("home"); setSearchQuery(""); window.scrollTo({ top: 0, behavior: "smooth" }); }} className="flex flex-col items-center gap-0.5 group px-2">
            <Home className={`h-4 w-4 sm:h-5 sm:w-5 transition ${activeTab === "home" ? "text-cyan-400 drop-shadow-[0_0_8px_rgba(56,189,248,0.9)]" : "text-silver/70 group-hover:text-white"}`} />
            <span className={`text-[10px] font-medium ${activeTab === "home" ? "text-white" : "text-silver/70"}`}>Home</span>
          </button>
          <button type="button" onClick={() => { setActiveTab("explore"); setExploreView("grid"); setSearchQuery(""); window.scrollTo({ top: 0, behavior: "smooth" }); }} className="flex flex-col items-center gap-0.5 group px-2">
            <Compass className={`h-4 w-4 sm:h-5 sm:w-5 transition ${activeTab === "explore" ? "text-cyan-400 drop-shadow-[0_0_8px_rgba(56,189,248,0.9)]" : "text-silver/70 group-hover:text-white"}`} />
            <span className={`text-[10px] font-medium ${activeTab === "explore" ? "text-white" : "text-silver/70"}`}>Explore</span>
          </button>
          <button type="button" onClick={() => { if (!user) requireAuthForAction("Sign in to view and sync your saved wallpapers across devices.", { type: "saved_tab" }); else { setActiveTab("saved"); window.scrollTo({ top: 0, behavior: "smooth" }); } }} className="flex flex-col items-center gap-0.5 group px-2">
            <Bookmark className={`h-4 w-4 sm:h-5 sm:w-5 transition ${activeTab === "saved" ? "text-cyan-400 fill-cyan-400/20 drop-shadow-[0_0_8px_rgba(56,189,248,0.9)]" : "text-silver/70 group-hover:text-white"}`} />
            <span className={`text-[10px] font-medium ${activeTab === "saved" ? "text-white" : "text-silver/70"}`}>Saved</span>
          </button>
          <button type="button" onClick={() => { setActiveTab("profile"); window.scrollTo({ top: 0, behavior: "smooth" }); }} className="flex flex-col items-center gap-0.5 group px-2">
            <UserIcon className={`h-4 w-4 sm:h-5 sm:w-5 transition ${activeTab === "profile" ? "text-cyan-400 drop-shadow-[0_0_8px_rgba(56,189,248,0.9)]" : "text-silver/70 group-hover:text-white"}`} />
            <span className={`text-[10px] font-medium ${activeTab === "profile" ? "text-white" : "text-silver/70"}`}>Profile</span>
          </button>
        </div>
      </nav>

      {/* ================= DEDICATED WALLPAPER DETAIL SCREEN (ZERO EMPTY SPACE + MASSIVE STACKED BUTTONS + ADMIN EDIT) ================= */}
      {selectedWallpaper && (
        <div
          ref={detailScrollRef}
          role="dialog"
          aria-modal="true"
          aria-label={selectedWallpaper.title}
          className="fixed inset-0 z-50 bg-[#050A18]/95 backdrop-blur-2xl overflow-y-auto animate-in fade-in duration-200"
        >
          <div className="max-w-3xl mx-auto px-4 pt-4 pb-16">
            <div className="sticky top-3 z-30 flex items-center justify-between mb-2">
              {isAdmin ? (
                <button
                  type="button"
                  onClick={() => {
                    setEditCategorySelection(getWallpaperCategory(selectedWallpaper));
                    setEditSetAsBanner(!!selectedWallpaper.is_banner);
                    setIsEditModalOpen(true);
                  }}
                  className="h-10 px-4 rounded-full bg-[#101A36]/90 border border-blue-400/35 flex items-center gap-2 text-white shadow-lg hover:border-cyan-400 text-xs font-bold transition"
                >
                  <Edit3 className="h-4 w-4 text-cyan-400" /> Edit Category
                </button>
              ) : <div />}
              
              <button
                type="button"
                aria-label="Close detail view"
                onClick={closeWallpaperDetail}
                className="h-10 w-10 rounded-full bg-[#0A1128]/85 backdrop-blur-xl border border-blue-400/35 flex items-center justify-center text-white shadow-[0_0_15px_rgba(0,0,0,0.6)] hover:border-cyan-400 transition"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div
              className="relative rounded-3xl overflow-hidden bg-[#0A1128]/80 backdrop-blur-xl border border-blue-400/30 shadow-[0_15px_45px_rgba(0,0,0,0.8)] flex items-center justify-center mx-auto w-fit max-w-full"
              onContextMenu={(e) => e.preventDefault()}
            >
              <div className={`w-full flex items-center justify-center transition-all duration-300 ${isExpanded ? "max-h-[85vh] overflow-x-auto" : "max-h-[72vh]"}`}>
                <img
                  src={selectedWallpaper.image_url}
                  alt={selectedWallpaper.title}
                  draggable={false}
                  onContextMenu={(e) => e.preventDefault()}
                  className={`block pointer-events-none select-none transition-all duration-300 ${detailIsTall && !isExpanded ? "w-full aspect-[9/16] object-cover sm:w-auto sm:h-[70vh]" : "w-full h-auto object-contain max-h-[80vh] sm:max-h-[85vh]"}`}
                />
              </div>

              <div className="absolute inset-0 z-10 bg-transparent" onContextMenu={(e) => e.preventDefault()} />

              {detailIsTall && !isExpanded && (
                <button
                  type="button"
                  aria-label="Toggle full screen preview"
                  onClick={() => setIsExpanded(true)}
                  className="absolute bottom-4 bg-black/60 backdrop-blur-md px-5 py-2.5 rounded-full border border-white/20 flex items-center justify-center text-white hover:bg-black/85 transition shadow-lg active:scale-95 text-sm font-semibold gap-2 z-20"
                >
                  <Maximize2 className="h-4 w-4 text-cyan-400" />
                  View Full Wallpaper
                </button>
              )}
              
              {detailIsTall && isExpanded && (
                <button
                  type="button"
                  aria-label="Minimize preview"
                  onClick={() => setIsExpanded(false)}
                  className="absolute bottom-4 right-4 h-10 w-10 bg-black/60 backdrop-blur-md rounded-full border border-white/20 flex items-center justify-center text-white hover:bg-black/85 transition shadow-lg active:scale-95 z-20"
                >
                  <Minimize2 className="h-5 w-5 text-cyan-400" />
                </button>
              )}
            </div>

            <div className="mt-5 text-center sm:text-left">
              <h2 className="text-xl sm:text-2xl font-bold text-white tracking-wide">{selectedWallpaper.title}</h2>
            </div>

            <div className="mt-5 flex flex-col gap-3.5 w-full">
              <Button
                type="button"
                variant="outline"
                onClick={(e) => toggleSaveWallpaper(e, selectedWallpaper)}
                disabled={savingInProgressIds.includes(selectedWallpaper.id)}
                className={`w-full h-14 rounded-2xl font-bold text-base border transition backdrop-blur-xl shadow-[0_0_20px_rgba(37,99,235,0.2)] ${savedIds.includes(selectedWallpaper.id) ? "bg-cyan-500/20 border-cyan-400 text-cyan-300 hover:bg-cyan-500/30 shadow-[0_0_22px_rgba(56,189,248,0.4)]" : "bg-[#0A1128]/90 border-blue-400/40 text-white hover:border-cyan-400/70"}`}
              >
                <Bookmark className={`h-5 w-5 mr-2.5 ${savedIds.includes(selectedWallpaper.id) ? "fill-cyan-400 text-cyan-400" : ""}`} />
                {savedIds.includes(selectedWallpaper.id) ? "Wallpaper Saved" : "Save Wallpaper"}
              </Button>

              <Button
                type="button"
                onClick={() => triggerDirectDownload(selectedWallpaper)}
                disabled={downloadingId === selectedWallpaper.id}
                className="w-full h-14 rounded-2xl bg-gradient-to-r from-[#2563EB] to-[#38BDF8] text-white font-extrabold text-base shadow-[0_0_30px_rgba(56,189,248,0.5)] hover:opacity-95 transition"
              >
                {downloadingId === selectedWallpaper.id ? (
                  <>
                    <Loader2 className="h-5 w-5 animate-spin mr-2.5" /> Preparing Original File...
                  </>
                ) : (
                  <>
                    <Download className="h-5 w-5 mr-2.5" /> Download Wallpaper
                  </>
                )}
              </Button>
            </div>

            {downloadStatus && downloadStatus.id === selectedWallpaper.id && (
              <div className={`mt-4 p-3.5 rounded-2xl border text-xs sm:text-sm flex items-center justify-between backdrop-blur-xl ${downloadStatus.type === "success" ? "bg-emerald-950/70 border-emerald-400/40 text-emerald-200" : "bg-red-950/70 border-red-400/40 text-red-200"}`}>
                <div className="flex items-center gap-2">
                  {downloadStatus.type === "success" ? <CheckCircle2 className="h-4 w-4 text-emerald-400 shrink-0" /> : <AlertCircle className="h-4 w-4 text-red-400 shrink-0" />}
                  <span>{downloadStatus.message}</span>
                </div>
                {downloadStatus.type === "error" && (
                  <button type="button" onClick={() => triggerDirectDownload(selectedWallpaper)} className="underline font-semibold ml-3 shrink-0">Retry</button>
                )}
              </div>
            )}

            <div className="mt-10 pt-6 border-t border-blue-400/20">
              <h3 className="text-base sm:text-lg font-bold text-white tracking-wide mb-4">Related Wallpapers</h3>
              {relatedWallpapers.length === 0 ? (
                <p className="text-xs text-silver">More wallpapers coming soon.</p>
              ) : (
                <>
                  <div className="columns-2 sm:columns-3 gap-3.5 space-y-3.5">
                    {relatedWallpapers.slice(0, relatedVisibleCount).map((rel) => renderWallpaperCard(rel))}
                  </div>
                  {relatedVisibleCount < relatedWallpapers.length && (
                    <div className="mt-6 text-center">
                      <Button type="button" variant="outline" onClick={() => setRelatedVisibleCount((prev) => prev + 6)} className="rounded-full bg-[#0A1128]/80 backdrop-blur-md border-blue-400/35 text-silver hover:text-white px-6">
                        Load More Related
                      </Button>
                    </div>
                  )}
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ================= FIXED AUTHENTICATION & PASSWORD RESET MODAL ================= */}
      <Dialog open={isAuthModalOpen} onOpenChange={setIsAuthModalOpen}>
        <DialogContent className="bg-[#0A1128]/95 backdrop-blur-2xl border border-blue-400/40 text-platinum sm:max-w-md rounded-3xl p-6 shadow-[0_20px_60px_rgba(0,0,0,0.85)]">
          <DialogHeader>
            <div className="mx-auto bg-[#050A18] p-3 rounded-full border border-cyan-400/30 mb-2 shadow-[0_0_15px_rgba(56,189,248,0.25)]">
              <FourPointStar className="h-6 w-6 text-cyan-400" />
            </div>
            <DialogTitle className="text-center text-xl font-bold text-white">
              {authStep === "FORGOT_PASSWORD" ? "Reset Your Password" : authStep === "RESET_LINK_SENT" ? "Check Your Email" : authStep === "UPDATE_PASSWORD" ? "Set New Password" : authStep === "SIGN_UP" ? "Create Free Account" : "Sign In to Fusion"}
            </DialogTitle>
            <DialogDescription className="text-center text-silver text-xs sm:text-sm">
              {authStep === "FORGOT_PASSWORD" ? "Enter your account email and we will send you a password reset link." : authStep === "RESET_LINK_SENT" ? "Follow the reset link sent to your inbox to choose a new password." : authStep === "UPDATE_PASSWORD" ? "Choose a strong new password for your Fusion Wallpapers account." : authReason}
            </DialogDescription>
          </DialogHeader>

          {(authStep === "SIGN_IN" || authStep === "SIGN_UP") && (
            <div className="grid grid-cols-2 gap-1.5 p-1 rounded-full bg-[#050A18] border border-blue-400/20 mt-1">
              <button type="button" onClick={() => { setAuthStep("SIGN_IN"); setAuthError(null); setAuthSuccessMsg(null); }} className={`py-1.5 rounded-full text-xs font-semibold transition ${authStep === "SIGN_IN" ? "bg-gradient-to-r from-[#2563EB] to-[#38BDF8] text-white" : "text-silver hover:text-white"}`}>Sign In</button>
              <button type="button" onClick={() => { setAuthStep("SIGN_UP"); setAuthError(null); setAuthSuccessMsg(null); }} className={`py-1.5 rounded-full text-xs font-semibold transition ${authStep === "SIGN_UP" ? "bg-gradient-to-r from-[#2563EB] to-[#38BDF8] text-white" : "text-silver hover:text-white"}`}>Create Account</button>
            </div>
          )}

          {authStep === "SIGN_IN" && (
            <form onSubmit={handleSignInSubmit} className="space-y-4 mt-2">
              {authSuccessMsg && <p className="text-xs text-emerald-300 bg-emerald-950/60 p-2.5 rounded-xl border border-emerald-400/30 text-center">{authSuccessMsg}</p>}
              <div>
                <label className="text-xs font-medium text-silver block mb-1.5">Email Address</label>
                <div className="relative">
                  <Mail className="h-4 w-4 text-silver/60 absolute left-3.5 top-3" />
                  <Input type="email" required placeholder="you@example.com" value={authEmail} onChange={(e) => setAuthEmail(e.target.value)} className="pl-10 bg-[#050A18] border-blue-400/30 text-white placeholder:text-silver/40 rounded-xl h-10" />
                </div>
              </div>
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="text-xs font-medium text-silver">Password</label>
                  <button type="button" onClick={() => { setAuthStep("FORGOT_PASSWORD"); setAuthError(null); setAuthSuccessMsg(null); }} className="text-[11px] text-cyan-400 hover:underline">Forgot password?</button>
                </div>
                <Input type="password" required placeholder="••••••••" value={authPassword} onChange={(e) => setAuthPassword(e.target.value)} className="bg-[#050A18] border-blue-400/30 text-white placeholder:text-silver/40 rounded-xl h-10" />
              </div>
              {authError && <p className="text-xs text-red-300 bg-red-950/60 p-2.5 rounded-xl border border-red-400/30">{authError}</p>}
              <Button type="submit" disabled={authLoading} className="w-full h-11 rounded-full bg-gradient-to-r from-[#2563EB] to-[#38BDF8] text-white font-bold shadow-[0_0_20px_rgba(56,189,248,0.45)]">
                {authLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Sign In"}
              </Button>
            </form>
          )}

          {authStep === "SIGN_UP" && (
            <form onSubmit={handleSignUpSubmit} className="space-y-4 mt-2">
              <div>
                <label className="text-xs font-medium text-silver block mb-1.5">Email Address</label>
                <div className="relative">
                  <Mail className="h-4 w-4 text-silver/60 absolute left-3.5 top-3" />
                  <Input type="email" required placeholder="you@example.com" value={authEmail} onChange={(e) => setAuthEmail(e.target.value)} className="pl-10 bg-[#050A18] border-blue-400/30 text-white placeholder:text-silver/40 rounded-xl h-10" />
                </div>
              </div>
              <div>
                <label className="text-xs font-medium text-silver block mb-1">Create Password (min. 6 characters)</label>
                <Input type="password" required placeholder="••••••••" value={authPassword} onChange={(e) => setAuthPassword(e.target.value)} className="bg-[#050A18] border-blue-400/30 text-white placeholder:text-silver/40 rounded-xl h-10" />
              </div>
              <div>
                <label className="text-xs font-medium text-silver block mb-1">Confirm Password</label>
                <Input type="password" required placeholder="••••••••" value={authConfirmPassword} onChange={(e) => setAuthConfirmPassword(e.target.value)} className="bg-[#050A18] border-blue-400/30 text-white placeholder:text-silver/40 rounded-xl h-10" />
              </div>
              {authError && <p className="text-xs text-red-300 bg-red-950/60 p-2.5 rounded-xl border border-red-400/30">{authError}</p>}
              <Button type="submit" disabled={authLoading} className="w-full h-11 rounded-full bg-gradient-to-r from-[#2563EB] to-[#38BDF8] text-white font-bold shadow-[0_0_20px_rgba(56,189,248,0.45)]">
                {authLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Create Account"}
              </Button>
            </form>
          )}

          {authStep === "FORGOT_PASSWORD" && (
            <form onSubmit={handleForgotPasswordSubmit} className="space-y-4 mt-2">
              <div>
                <label className="text-xs font-medium text-silver block mb-1.5">Account Email Address</label>
                <div className="relative">
                  <Mail className="h-4 w-4 text-silver/60 absolute left-3.5 top-3" />
                  <Input type="email" required placeholder="you@example.com" value={authEmail} onChange={(e) => setAuthEmail(e.target.value)} className="pl-10 bg-[#050A18] border-blue-400/30 text-white placeholder:text-silver/40 rounded-xl h-10" />
                </div>
              </div>
              {authError && <p className="text-xs text-red-300 bg-red-950/60 p-2.5 rounded-xl border border-red-400/30">{authError}</p>}
              <Button type="submit" disabled={authLoading || resendCooldown > 0} className="w-full h-11 rounded-full bg-gradient-to-r from-[#2563EB] to-[#38BDF8] text-white font-bold shadow-[0_0_20px_rgba(56,189,248,0.45)]">
                {authLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : resendCooldown > 0 ? `Wait ${resendCooldown}s to Resend` : "Send Password Reset Link"}
              </Button>
              <div className="text-center pt-1">
                <button type="button" onClick={() => { setAuthStep("SIGN_IN"); setAuthError(null); }} className="text-xs text-silver hover:text-white inline-flex items-center gap-1">
                  <ArrowLeft className="h-3.5 w-3.5" /> Back to Sign In
                </button>
              </div>
            </form>
          )}

          {authStep === "RESET_LINK_SENT" && (
            <div className="space-y-4 mt-2 text-center">
              <div className="p-3.5 rounded-2xl bg-emerald-950/60 border border-emerald-400/30 text-xs text-emerald-200 leading-relaxed">
                {authSuccessMsg || "Check your email inbox (and spam folder) for the password reset link."}
              </div>
              <Button type="button" onClick={() => { setAuthStep("SIGN_IN"); setAuthError(null); setAuthSuccessMsg(null); }} className="w-full h-11 rounded-full bg-[#101A36] hover:bg-[#16244A] text-white border border-blue-400/30 font-semibold">
                Return to Sign In
              </Button>
            </div>
          )}

          {authStep === "UPDATE_PASSWORD" && (
            <form onSubmit={handleUpdateRecoveredPassword} className="space-y-4 mt-2">
              {authSuccessMsg && <p className="text-xs text-cyan-300 bg-[#050A18] p-2.5 rounded-xl border border-cyan-400/30 text-center">{authSuccessMsg}</p>}
              <div>
                <label className="text-xs font-medium text-silver block mb-1">New Password (min. 6 characters)</label>
                <Input type="password" required placeholder="••••••••" value={authPassword} onChange={(e) => setAuthPassword(e.target.value)} className="bg-[#050A18] border-blue-400/30 text-white rounded-xl h-10" />
              </div>
              <div>
                <label className="text-xs font-medium text-silver block mb-1">Confirm New Password</label>
                <Input type="password" required placeholder="••••••••" value={authConfirmPassword} onChange={(e) => setAuthConfirmPassword(e.target.value)} className="bg-[#050A18] border-blue-400/30 text-white rounded-xl h-10" />
              </div>
              {authError && <p className="text-xs text-red-300 bg-red-950/60 p-2.5 rounded-xl border border-red-400/30">{authError}</p>}
              <Button type="submit" disabled={authLoading} className="w-full h-11 rounded-full bg-gradient-to-r from-[#2563EB] to-[#38BDF8] text-white font-bold shadow-[0_0_20px_rgba(56,189,248,0.45)]">
                {authLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Save New Password"}
              </Button>
            </form>
          )}
        </DialogContent>
      </Dialog>

      {/* ================= ACCOUNT SETTINGS MODAL ================= */}
      <Dialog open={isSettingsModalOpen} onOpenChange={setIsSettingsModalOpen}>
        <DialogContent className="bg-[#0A1128]/95 backdrop-blur-2xl border border-blue-400/40 text-platinum sm:max-w-md rounded-3xl p-6">
          <DialogHeader>
            <DialogTitle className="text-lg font-bold text-white">Account Settings</DialogTitle>
            <DialogDescription className="text-xs text-silver">Manage your profile display name and security credentials.</DialogDescription>
          </DialogHeader>

          <form onSubmit={handleSaveAccountSettings} className="space-y-4 mt-2">
            <div>
              <label className="text-xs font-medium text-silver block mb-1">Verified Email Address</label>
              <Input type="email" disabled value={user?.email || ""} className="bg-[#050A18]/60 border-blue-400/20 text-silver rounded-xl opacity-80 cursor-not-allowed" />
            </div>
            <div>
              <label className="text-xs font-medium text-silver block mb-1">Display Name</label>
              <Input type="text" required value={editDisplayName} onChange={(e) => setEditDisplayName(e.target.value)} className="bg-[#050A18] border-blue-400/30 text-white rounded-xl" />
            </div>
            <div className="pt-2 border-t border-blue-400/15 space-y-3">
              <div className="flex items-center gap-1.5 text-xs font-semibold text-cyan-400">
                <KeyRound className="h-3.5 w-3.5" /> <span>Change Password (Optional)</span>
              </div>
              <div>
                <label className="text-xs text-silver block mb-1">New Password</label>
                <Input type="password" placeholder="Leave blank to keep current" value={newPasswordInput} onChange={(e) => setNewPasswordInput(e.target.value)} className="bg-[#050A18] border-blue-400/30 text-white rounded-xl" />
              </div>
              {newPasswordInput.length > 0 && (
                <div>
                  <label className="text-xs text-silver block mb-1">Confirm New Password</label>
                  <Input type="password" placeholder="Confirm new password" value={confirmNewPasswordInput} onChange={(e) => setConfirmNewPasswordInput(e.target.value)} className="bg-[#050A18] border-blue-400/30 text-white rounded-xl" />
                </div>
              )}
            </div>
            {settingsFeedback && (
              <p className={`text-xs p-2.5 rounded-xl border text-center ${settingsFeedback.type === "success" ? "bg-emerald-950/60 border-emerald-400/30 text-emerald-300" : "bg-red-950/60 border-red-400/30 text-red-300"}`}>
                {settingsFeedback.text}
              </p>
            )}
            <div className="flex items-center gap-2.5 pt-2">
              <Button type="submit" disabled={settingsLoading} className="flex-1 rounded-full bg-gradient-to-r from-[#2563EB] to-[#38BDF8] text-white font-bold">
                {settingsLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <><Check className="h-4 w-4 mr-1.5" /> Save Changes</>}
              </Button>
              <Button type="button" variant="outline" onClick={handleSignOut} className="rounded-full bg-transparent border-red-400/30 text-red-300 hover:bg-red-950/40">
                Sign Out
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* ================= ADMIN UPLOAD MODAL ================= */}
      <Dialog open={isUploadModalOpen} onOpenChange={setIsUploadModalOpen}>
        <DialogContent className="bg-[#0A1128]/95 backdrop-blur-2xl border border-blue-400/40 text-platinum sm:max-w-md rounded-3xl p-6">
          <DialogHeader>
            <DialogTitle className="text-lg font-bold text-white">Upload New Wallpaper</DialogTitle>
            <DialogDescription className="text-silver text-xs">Publish a high-resolution wallpaper to Fusion Wallpapers.</DialogDescription>
          </DialogHeader>

          <form onSubmit={handleAdminUpload} className="space-y-4 mt-2">
            <div>
              <label className="text-xs font-medium text-silver block mb-1">Wallpaper Name</label>
              <Input type="text" required placeholder="e.g., Midnight Summit" value={uploadTitle} onChange={(e) => setUploadTitle(e.target.value)} className="bg-[#050A18] border-blue-400/30 text-white placeholder:text-silver/40 rounded-xl" />
            </div>
            <div>
              <label className="text-xs font-medium text-silver block mb-1">Anime Category</label>
              <select
                value={uploadCategory}
                onChange={(e) => setUploadCategory(e.target.value)}
                className="w-full h-10 bg-[#050A18] border border-blue-400/30 text-white text-sm rounded-xl px-3 focus:outline-none focus:border-cyan-400"
              >
                {animeCategories.map(cat => (
                  <option key={cat.id} value={cat.id}>{cat.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-xs font-medium text-silver block mb-1">Wallpaper Image File</label>
              <Input type="file" accept="image/*" required onChange={(e) => setUploadFile(e.target.files?.[0] || null)} className="bg-[#050A18] border-blue-400/30 text-silver file:bg-[#101A36] file:text-white file:border-0 file:rounded-lg file:px-2.5 file:py-1 file:mr-2 file:text-xs rounded-xl" />
            </div>
            <Button type="submit" disabled={uploading || !uploadFile} className="w-full h-11 rounded-full bg-gradient-to-r from-[#2563EB] to-[#38BDF8] text-white font-bold shadow-[0_0_18px_rgba(56,189,248,0.45)]">
              {uploading ? <><Loader2 className="h-4 w-4 animate-spin mr-2" /> Uploading...</> : "Publish Wallpaper"}
            </Button>
          </form>
        </DialogContent>
      </Dialog>

      {/* ================= ADMIN EDIT CATEGORY MODAL ================= */}
      <Dialog open={isEditModalOpen} onOpenChange={setIsEditModalOpen}>
        <DialogContent className="bg-[#0A1128]/95 backdrop-blur-2xl border border-blue-400/40 text-platinum sm:max-w-md rounded-3xl p-6">
          <DialogHeader>
            <DialogTitle className="text-lg font-bold text-white">Edit Wallpaper Category</DialogTitle>
            <DialogDescription className="text-silver text-xs">Reassign this wallpaper to a different anime category or set it as the banner.</DialogDescription>
          </DialogHeader>

          <form onSubmit={handleAdminEditSubmit} className="space-y-4 mt-2">
            <div>
              <label className="text-xs font-medium text-silver block mb-1">Select New Category</label>
              <select
                value={editCategorySelection}
                onChange={(e) => setEditCategorySelection(e.target.value)}
                className="w-full h-10 bg-[#050A18] border border-blue-400/30 text-white text-sm rounded-xl px-3 focus:outline-none focus:border-cyan-400"
              >
                {animeCategories.map(cat => (
                  <option key={cat.id} value={cat.id}>{cat.name}</option>
                ))}
              </select>
            </div>
            
            <div className="flex items-center gap-3 pt-2">
              <input 
                type="checkbox" 
                id="setBannerCheck"
                checked={editSetAsBanner}
                onChange={(e) => setEditSetAsBanner(e.target.checked)}
                className="h-4 w-4 rounded border-blue-400 text-cyan-500 focus:ring-cyan-500 bg-[#050A18]"
              />
              <label htmlFor="setBannerCheck" className="text-sm text-white cursor-pointer select-none">
                Set as category banner image
              </label>
            </div>

            <Button type="submit" disabled={editingWallpaper} className="w-full h-11 rounded-full mt-2 bg-gradient-to-r from-[#2563EB] to-[#38BDF8] text-white font-bold shadow-[0_0_18px_rgba(56,189,248,0.45)]">
              {editingWallpaper ? <><Loader2 className="h-4 w-4 animate-spin mr-2" /> Saving...</> : "Save Changes"}
            </Button>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
