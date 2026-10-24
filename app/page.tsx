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

// --- DATA INTERFACES ---
interface Wallpaper {
  id: string;
  title: string;
  image_url: string;
  storage_path: string;
  category?: string;
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
  | "EMAIL_ENTRY"
  | "RETURNING_PASSWORD"
  | "OTP_VERIFY"
  | "CREATE_PASSWORD";

const ADMIN_UUID =
  process.env.NEXT_PUBLIC_ADMIN_UUID || "ccd4e82e-93fe-427f-a163-e19367b08649";

const CATEGORIES = [
  { id: "For You", label: "For You", icon: Sparkles },
  { id: "Anime", label: "Anime", icon: AnimeIcon },
  { id: "Minimal", label: "Minimal", icon: Smartphone },
  { id: "Dark", label: "Dark", icon: Moon },
  { id: "Nature", label: "Nature", icon: Mountain },
];

function AnimeIcon({ className }: { className?: string }) {
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

function FourPointStar({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className={className}>
      <path d="M12 1L14.8 9.2L23 12L14.8 14.8L12 23L9.2 14.8L1 12L9.2 9.2L12 1Z" />
    </svg>
  );
}

// Helper to mask email addresses (e.g., "ank***@gmail.com")
function maskEmailAddress(email?: string | null): string {
  if (!email || !email.includes("@")) return "user***@fusion.app";
  const [local, domain] = email.split("@");
  if (local.length <= 2) {
    return `${local[0] || "u"}***@${domain}`;
  }
  return `${local.slice(0, 3)}***@${domain}`;
}

// Extract category helper for legacy and new wallpapers
function getWallpaperCategory(w: Wallpaper): string {
  if (w.category && w.category.trim() !== "") return w.category;
  const prefix = w.storage_path.split("-")[0]?.toLowerCase();
  if (prefix === "anime") return "Anime";
  if (prefix === "minimal") return "Minimal";
  if (prefix === "dark") return "Dark";
  if (prefix === "nature") return "Nature";
  return "Anime";
}

export default function FusionWallpapersApp() {
  const supabase = useMemo(() => createClient(), []);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const detailScrollRef = useRef<HTMLDivElement>(null);

  // --- CORE DATA STATE ---
  const [wallpapers, setWallpapers] = useState<Wallpaper[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [fetchError, setFetchError] = useState<string | null>(null);

  // --- USER & PROFILE STATE ---
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [savedIds, setSavedIds] = useState<string[]>([]);
  const [savingInProgressIds, setSavingInProgressIds] = useState<string[]>([]);
  const [revealFullEmail, setRevealFullEmail] = useState<boolean>(false);

  // --- NAVIGATION & VIEW STATE ---
  const [activeTab, setActiveTab] = useState<
    "home" | "explore" | "saved" | "profile"
  >("home");
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [activeCategory, setActiveCategory] = useState<string>("For You");
  const [selectedWallpaper, setSelectedWallpaper] = useState<Wallpaper | null>(
    null
  );
  const [relatedVisibleCount, setRelatedVisibleCount] = useState<number>(6);

  // --- DOWNLOAD STATE ---
  const [downloadingId, setDownloadingId] = useState<string | null>(null);
  const [downloadStatus, setDownloadStatus] = useState<{
    id: string;
    type: "success" | "error";
    message: string;
  } | null>(null);

  // --- AUTHENTICATION MODAL & FLOW STATE ---
  const [isAuthModalOpen, setIsAuthModalOpen] = useState<boolean>(false);
  const [authMode, setAuthMode] = useState<"signin" | "signup" | "recovery">(
    "signin"
  );
  const [authStep, setAuthStep] = useState<AuthStep>("EMAIL_ENTRY");
  const [authReason, setAuthReason] = useState<string>(
    "Sign in to save wallpapers and unlock full-resolution downloads."
  );
  const [pendingIntent, setPendingIntent] = useState<PendingIntent | null>(
    null
  );

  const [authEmail, setAuthEmail] = useState<string>("");
  const [authPassword, setAuthPassword] = useState<string>("");
  const [authConfirmPassword, setAuthConfirmPassword] = useState<string>("");
  const [authOtp, setAuthOtp] = useState<string>("");
  const [authLoading, setAuthLoading] = useState<boolean>(false);
  const [authError, setAuthError] = useState<string | null>(null);
  const [authSuccessMsg, setAuthSuccessMsg] = useState<string | null>(null);
  const [resendCooldown, setResendCooldown] = useState<number>(0);

  // --- ACCOUNT SETTINGS MODAL STATE ---
  const [isSettingsModalOpen, setIsSettingsModalOpen] =
    useState<boolean>(false);
  const [editDisplayName, setEditDisplayName] = useState<string>("");
  const [newPasswordInput, setNewPasswordInput] = useState<string>("");
  const [confirmNewPasswordInput, setConfirmNewPasswordInput] =
    useState<string>("");
  const [settingsLoading, setSettingsLoading] = useState<boolean>(false);
  const [settingsFeedback, setSettingsFeedback] = useState<{
    type: "success" | "error";
    text: string;
  } | null>(null);

  // --- ADMIN UPLOAD MODAL STATE ---
  const [isUploadModalOpen, setIsUploadModalOpen] = useState<boolean>(false);
  const [uploadTitle, setUploadTitle] = useState<string>("");
  const [uploadCategory, setUploadCategory] = useState<string>("Anime");
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState<boolean>(false);

  const isAdmin = user?.id === ADMIN_UUID;

  // --- 1. INITIALIZATION & SESSION LISTENER ---
  useEffect(() => {
    const init = async () => {
      await fetchWallpapers();
      const {
        data: { session },
      } = await supabase.auth.getSession();
      const currentUser = session?.user ?? null;
      setUser(currentUser);
      if (currentUser) {
        await Promise.all([
          fetchUserProfile(currentUser),
          fetchSavedWallpapers(currentUser.id),
        ]);
      }
    };

    init();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (_event, session) => {
      const currentUser = session?.user ?? null;
      setUser(currentUser);
      if (currentUser) {
        await Promise.all([
          fetchUserProfile(currentUser),
          fetchSavedWallpapers(currentUser.id),
        ]);
      } else {
        setProfile(null);
        setSavedIds([]);
        setRevealFullEmail(false);
      }
    });

    return () => subscription.unsubscribe();
  }, [supabase]);

  // Cooldown timer for OTP resend
  useEffect(() => {
    if (resendCooldown <= 0) return;
    const timer = setInterval(() => {
      setResendCooldown((prev) => Math.max(0, prev - 1));
    }, 1000);
    return () => clearInterval(timer);
  }, [resendCooldown]);

  // Browser back button support for closing the Wallpaper Detail screen cleanly
  useEffect(() => {
    const handlePopState = () => {
      if (selectedWallpaper) {
        setSelectedWallpaper(null);
      }
    };
    window.addEventListener("popstate", handlePopState);
    return () => window.removeEventListener("popstate", handlePopState);
  }, [selectedWallpaper]);

  const openWallpaperDetail = (wallpaper: Wallpaper) => {
    if (!selectedWallpaper) {
      window.history.pushState({ wallpaperId: wallpaper.id }, "");
    }
    setSelectedWallpaper(wallpaper);
    setRelatedVisibleCount(6);
    setDownloadStatus(null);
    if (detailScrollRef.current) {
      detailScrollRef.current.scrollTo({ top: 0, behavior: "smooth" });
    }
  };

  const closeWallpaperDetail = () => {
    setSelectedWallpaper(null);
    setDownloadStatus(null);
  };

  // --- 2. DATABASE FETCH HELPERS ---
  const fetchWallpapers = async () => {
    setLoading(true);
    setFetchError(null);
    try {
      const { data, error } = await supabase
        .from("wallpapers")
        .select("*")
        .order("created_at", { ascending: false });

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
    const { data, error } = await supabase
      .from("profiles")
      .select("id, display_name")
      .eq("id", currentUser.id)
      .maybeSingle();

    if (!error && data) {
      setProfile({
        id: data.id,
        display_name: data.display_name || fallbackName,
      });
      setEditDisplayName(data.display_name || fallbackName);
    } else {
      setProfile({ id: currentUser.id, display_name: fallbackName });
      setEditDisplayName(fallbackName);
    }
  };

  const fetchSavedWallpapers = async (userId: string) => {
    const { data, error } = await supabase
      .from("saved_wallpapers")
      .select("wallpaper_id")
      .eq("user_id", userId)
      .order("created_at", { ascending: false });

    if (!error && data) {
      setSavedIds(data.map((row) => row.wallpaper_id));
    }
  };

  // --- 3. PROMPT AUTH MODAL & RESUME PENDING INTENT ---
  const requireAuthForAction = (reason: string, intent: PendingIntent) => {
    setAuthReason(reason);
    setPendingIntent(intent);
    setAuthMode("signin");
    setAuthStep("EMAIL_ENTRY");
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

  // --- 4. MULTI-STEP AUTHENTICATION HANDLERS ---
  const isValidEmail = (value: string) =>
    /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim());

  // Step 1: Submit Email
  const handleEmailStepSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError(null);
    setAuthSuccessMsg(null);

    const cleanEmail = authEmail.trim().toLowerCase();
    if (!isValidEmail(cleanEmail)) {
      setAuthError("Please enter a valid email address.");
      return;
    }

    if (authMode === "signin") {
      // Returning user -> go to password step
      setAuthStep("RETURNING_PASSWORD");
      return;
    }

    // New Account Signup OR Password Recovery -> Send real 6-digit OTP via Supabase
    setAuthLoading(true);
    try {
      const { error } = await supabase.auth.signInWithOtp({
        email: cleanEmail,
        options: {
          shouldCreateUser: true,
        },
      });
      if (error) throw error;

      setAuthStep("OTP_VERIFY");
      setResendCooldown(60);
      setAuthSuccessMsg(`Verification code sent to ${cleanEmail}`);
    } catch (err: any) {
      setAuthError(
        err.message || "Could not send verification code. Please try again."
      );
    } finally {
      setAuthLoading(false);
    }
  };

  // Returning User: Verify Password
  const handleReturningPasswordSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    if (authLoading) return;
    setAuthError(null);
    setAuthLoading(true);

    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email: authEmail.trim().toLowerCase(),
        password: authPassword,
      });

      if (error) throw error;

      setIsAuthModalOpen(false);
      setAuthPassword("");
      if (data.user) {
        await executePendingIntentAfterAuth(data.user);
      }
    } catch (err: any) {
      setAuthError(
        err.message || "Incorrect email or password. Please try again."
      );
    } finally {
      setAuthLoading(false);
    }
  };

  // Step 2: Verify 6-Digit Email OTP
  const handleVerifyEmailOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (authLoading) return;
    setAuthError(null);
    setAuthSuccessMsg(null);

    const cleanToken = authOtp.trim();
    if (cleanToken.length < 6) {
      setAuthError("Please enter the 6-digit verification code.");
      return;
    }

    setAuthLoading(true);
    try {
      // Try 'email' OTP verification first, fallback to 'signup' or 'recovery' if needed
      let verifyResult = await supabase.auth.verifyOtp({
        email: authEmail.trim().toLowerCase(),
        token: cleanToken,
        type: "email",
      });

      if (verifyResult.error) {
        verifyResult = await supabase.auth.verifyOtp({
          email: authEmail.trim().toLowerCase(),
          token: cleanToken,
          type: "signup",
        });
      }

      if (verifyResult.error) throw verifyResult.error;

      setAuthOtp("");
      setAuthStep("CREATE_PASSWORD");
      setAuthSuccessMsg(
        "Email verified! Create a password to secure your account."
      );
    } catch (err: any) {
      setAuthError(
        err.message || "Invalid or expired verification code. Please try again."
      );
    } finally {
      setAuthLoading(false);
    }
  };

  // Resend OTP Code with Cooldown
  const handleResendOtp = async () => {
    if (resendCooldown > 0 || authLoading) return;
    setAuthError(null);
    setAuthLoading(true);

    try {
      const { error } = await supabase.auth.signInWithOtp({
        email: authEmail.trim().toLowerCase(),
        options: { shouldCreateUser: true },
      });
      if (error) throw error;
      setResendCooldown(60);
      setAuthSuccessMsg("A new verification code has been sent to your email.");
    } catch (err: any) {
      setAuthError(err.message || "Rate limit reached. Please wait a moment.");
    } finally {
      setAuthLoading(false);
    }
  };

  // Step 3 & 4: Create & Confirm Password -> Complete Authentication
  const handleSetAccountPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (authLoading) return;
    setAuthError(null);

    if (authPassword.length < 6) {
      setAuthError("Password must be at least 6 characters long.");
      return;
    }
    if (authPassword !== authConfirmPassword) {
      setAuthError("Passwords do not match.");
      return;
    }

    setAuthLoading(true);
    try {
      const { data, error } = await supabase.auth.updateUser({
        password: authPassword,
      });

      if (error) throw error;

      // Ensure user profile entry exists
      if (data.user) {
        const defaultName =
          data.user.email?.split("@")[0] || "Fusion Explorer";
        await supabase
          .from("profiles")
          .upsert({ id: data.user.id, display_name: defaultName });
        await fetchUserProfile(data.user);
      }

      setIsAuthModalOpen(false);
      setAuthPassword("");
      setAuthConfirmPassword("");

      if (data.user) {
        await executePendingIntentAfterAuth(data.user);
      }
    } catch (err: any) {
      setAuthError(err.message || "Failed to save password. Please try again.");
    } finally {
      setAuthLoading(false);
    }
  };

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    setIsSettingsModalOpen(false);
  };

  // --- 5. PERSISTENT SAVE / BOOKMARK LOGIC (OPTIMISTIC + ROLLBACK) ---
  const toggleSaveWallpaper = async (
    e: React.MouseEvent | null,
    wallpaper: Wallpaper,
    overrideUser?: User | null
  ) => {
    if (e) e.stopPropagation();
    const activeUser = overrideUser !== undefined ? overrideUser : user;

    if (!activeUser) {
      requireAuthForAction(
        `Sign in to save "${wallpaper.title}" to your collection across devices.`,
        { type: "save", wallpaper }
      );
      return;
    }

    if (savingInProgressIds.includes(wallpaper.id)) return;

    const currentlySaved = savedIds.includes(wallpaper.id);
    setSavingInProgressIds((prev) => [...prev, wallpaper.id]);

    // Optimistic UI update
    setSavedIds((prev) =>
      currentlySaved
        ? prev.filter((id) => id !== wallpaper.id)
        : [wallpaper.id, ...prev]
    );

    try {
      if (currentlySaved) {
        const { error } = await supabase
          .from("saved_wallpapers")
          .delete()
          .eq("user_id", activeUser.id)
          .eq("wallpaper_id", wallpaper.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("saved_wallpapers").upsert(
          {
            user_id: activeUser.id,
            wallpaper_id: wallpaper.id,
          },
          { onConflict: "user_id,wallpaper_id" }
        );
        if (error) throw error;
      }
    } catch (err) {
      // Rollback on failure
      setSavedIds((prev) =>
        currentlySaved
          ? [wallpaper.id, ...prev]
          : prev.filter((id) => id !== wallpaper.id)
      );
    } finally {
      setSavingInProgressIds((prev) =>
        prev.filter((id) => id !== wallpaper.id)
      );
    }
  };

  // --- 6. ORIGINAL RESOLUTION DOWNLOAD LOGIC ---
  const triggerDirectDownload = async (
    wallpaper: Wallpaper,
    overrideUser?: User | null
  ) => {
    const activeUser = overrideUser !== undefined ? overrideUser : user;

    if (!activeUser) {
      requireAuthForAction(
        `Sign in to download "${wallpaper.title}" in full original resolution.`,
        { type: "download", wallpaper }
      );
      return;
    }

    if (downloadingId === wallpaper.id) return;
    setDownloadingId(wallpaper.id);
    setDownloadStatus(null);

    try {
      // Try downloading directly from Supabase Storage first to handle expired/signed URLs gracefully
      let fileBlob: Blob | null = null;
      if (wallpaper.storage_path) {
        const { data, error } = await supabase.storage
          .from("wallpapers")
          .download(wallpaper.storage_path);
        if (!error && data) {
          fileBlob = data;
        }
      }

      // Fallback to direct fetch of image_url if needed
      if (!fileBlob) {
        const response = await fetch(wallpaper.image_url, { mode: "cors" });
        if (!response.ok) {
          throw new Error("Image file could not be reached.");
        }
        fileBlob = await response.blob();
      }

      if (!fileBlob || fileBlob.size === 0) {
        throw new Error("Downloaded file is empty or unavailable.");
      }

      // Preserve original file extension from storage_path or MIME type
      const extFromPath = wallpaper.storage_path?.split(".").pop()?.toLowerCase();
      const validExt =
        extFromPath && ["jpg", "jpeg", "png", "webp"].includes(extFromPath)
          ? extFromPath
          : "jpg";

      const cleanTitle = wallpaper.title
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-|-$/g, "");

      const blobUrl = window.URL.createObjectURL(fileBlob);
      const link = document.createElement("a");
      link.href = blobUrl;
      link.download = `${cleanTitle || "fusion-wallpaper"}-${wallpaper.id.slice(
        0,
        5
      )}.${validExt}`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(blobUrl);

      setDownloadStatus({
        id: wallpaper.id,
        type: "success",
        message: "Full-resolution download complete!",
      });
    } catch (err: any) {
      setDownloadStatus({
        id: wallpaper.id,
        type: "error",
        message:
          err.message || "Download failed. Please check your connection and retry.",
      });
    } finally {
      setDownloadingId(null);
    }
  };

  // --- 7. ACCOUNT SETTINGS UPDATE HANDLER ---
  const handleSaveAccountSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || settingsLoading) return;
    setSettingsFeedback(null);
    setSettingsLoading(true);

    try {
      const trimmedName = editDisplayName.trim();
      if (!trimmedName) {
        throw new Error("Display name cannot be empty.");
      }

      // Update display name in profiles table
      const { error: profileError } = await supabase.from("profiles").upsert({
        id: user.id,
        display_name: trimmedName,
        updated_at: new Date().toISOString(),
      });
      if (profileError) throw profileError;

      setProfile({ id: user.id, display_name: trimmedName });

      // If user also entered a new password, update it securely
      if (newPasswordInput.trim().length > 0) {
        if (newPasswordInput.length < 6) {
          throw new Error("New password must be at least 6 characters.");
        }
        if (newPasswordInput !== confirmNewPasswordInput) {
          throw new Error("New passwords do not match.");
        }
        const { error: pwError } = await supabase.auth.updateUser({
          password: newPasswordInput,
        });
        if (pwError) throw pwError;
        setNewPasswordInput("");
        setConfirmNewPasswordInput("");
      }

      setSettingsFeedback({
        type: "success",
        text: "Account settings updated successfully.",
      });
    } catch (err: any) {
      setSettingsFeedback({
        type: "error",
        text: err.message || "Failed to update settings.",
      });
    } finally {
      setSettingsLoading(false);
    }
  };

  // --- 8. ADMIN UPLOAD & DELETE HANDLERS (PRESERVED) ---
  const handleAdminUpload = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isAdmin || !uploadFile || !uploadTitle.trim() || uploading) return;

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

      // Insert with category support (gracefully falls back if column not migrated yet)
      const { error: dbError } = await supabase.from("wallpapers").insert([
        {
          title: uploadTitle.trim(),
          image_url: publicUrl,
          storage_path: fileName,
          category: uploadCategory,
        },
      ]);

      if (dbError) {
        // Fallback insert if category column wasn't added yet
        const { error: fallbackError } = await supabase
          .from("wallpapers")
          .insert([
            {
              title: uploadTitle.trim(),
              image_url: publicUrl,
              storage_path: fileName,
            },
          ]);
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

  const handleAdminDelete = async (
    e: React.MouseEvent,
    wallpaper: Wallpaper
  ) => {
    e.stopPropagation();
    if (!isAdmin) return;
    if (!window.confirm(`Delete "${wallpaper.title}" permanently?`)) return;

    try {
      await supabase.storage
        .from("wallpapers")
        .remove([wallpaper.storage_path]);
      await supabase.from("wallpapers").delete().eq("id", wallpaper.id);
      setWallpapers((prev) => prev.filter((w) => w.id !== wallpaper.id));
      if (selectedWallpaper?.id === wallpaper.id) {
        closeWallpaperDetail();
      }
    } catch (err: any) {
      alert(`Delete failed: ${err.message}`);
    }
  };

  // --- 9. COMPUTED GALLERIES (MAIN, SAVED, & RELATED WALLPAPERS) ---
  const filteredWallpapers = useMemo(() => {
    return wallpapers.filter((item) => {
      if (activeTab === "saved" && !savedIds.includes(item.id)) {
        return false;
      }

      const q = searchQuery.trim().toLowerCase();
      const itemCat = getWallpaperCategory(item).toLowerCase();
      const matchesSearch =
        !q ||
        item.title.toLowerCase().includes(q) ||
        itemCat.includes(q) ||
        item.storage_path.toLowerCase().includes(q);

      const matchesCategory =
        activeCategory === "For You" ||
        itemCat === activeCategory.toLowerCase() ||
        item.title.toLowerCase().includes(activeCategory.toLowerCase());

      return matchesSearch && matchesCategory;
    });
  }, [wallpapers, activeTab, savedIds, searchQuery, activeCategory]);

  const savedWallpapersList = useMemo(() => {
    return wallpapers.filter((w) => savedIds.includes(w.id));
  }, [wallpapers, savedIds]);

  const relatedWallpapers = useMemo(() => {
    if (!selectedWallpaper) return [];
    const currentCat = getWallpaperCategory(selectedWallpaper).toLowerCase();
    const titleWords = selectedWallpaper.title
      .toLowerCase()
      .split(/\s+/)
      .filter((w) => w.length > 2);

    const others = wallpapers.filter((w) => w.id !== selectedWallpaper.id);

    // Score each wallpaper by category match and shared title/keyword tokens
    const scored = others.map((candidate) => {
      let score = 0;
      const candCat = getWallpaperCategory(candidate).toLowerCase();
      if (candCat === currentCat) score += 10;

      const candTitle = candidate.title.toLowerCase();
      titleWords.forEach((word) => {
        if (candTitle.includes(word)) score += 5;
      });

      return { wallpaper: candidate, score };
    });

    scored.sort((a, b) => b.score - a.score);
    return scored.map((s) => s.wallpaper);
  }, [wallpapers, selectedWallpaper]);

  // --- REUSABLE WALLPAPER CARD (IMAGE + NAME ONLY) ---
  const renderWallpaperCard = (
    item: Wallpaper,
    options?: { showRemoveSavedBtn?: boolean }
  ) => {
    const isSaved = savedIds.includes(item.id);
    return (
      <div
        key={item.id}
        onClick={() => openWallpaperDetail(item)}
        className="break-inside-avoid group relative rounded-2xl overflow-hidden bg-[#0E1730] border border-blue-400/25 shadow-[0_8px_25px_rgba(0,0,0,0.6)] cursor-pointer transition-all duration-300 hover:border-cyan-400/70 hover:shadow-[0_0_22px_rgba(56,189,248,0.22)]"
      >
        <div
          className="relative w-full overflow-hidden bg-[#0A1128]"
          onContextMenu={(e) => e.preventDefault()}
        >
          <img
            src={item.image_url}
            alt={item.title}
            loading="lazy"
            draggable={false}
            onContextMenu={(e) => e.preventDefault()}
            className="w-full h-auto object-cover pointer-events-none select-none transition-transform duration-500 group-hover:scale-[1.03]"
          />

          {/* Anti-Long-Press Shield */}
          <div
            className="absolute inset-0 z-10 bg-transparent"
            onContextMenu={(e) => e.preventDefault()}
          />

          {/* Top-Right Bookmark / Remove Saved Button */}
          <button
            type="button"
            aria-label={isSaved ? "Remove from saved" : "Save wallpaper"}
            onClick={(e) => toggleSaveWallpaper(e, item)}
            className="absolute top-2.5 right-2.5 z-20 h-8 w-8 rounded-full bg-black/50 backdrop-blur-md border border-white/15 flex items-center justify-center text-white hover:bg-black/75 transition active:scale-95"
          >
            <Bookmark
              className={`h-4 w-4 transition ${
                isSaved ? "fill-cyan-400 text-cyan-400" : "text-white"
              }`}
            />
          </button>

          {/* Admin Delete Button (Only visible to Admin) */}
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

          {/* Clean Bottom Gradient with Wallpaper Name ONLY */}
          <div className="absolute inset-x-0 bottom-0 z-20 bg-gradient-to-t from-[#050A18]/95 via-[#050A18]/55 to-transparent pt-9 pb-2.5 px-3 flex items-end">
            <h3 className="text-xs sm:text-sm font-semibold text-white tracking-wide drop-shadow truncate">
              {item.title}
            </h3>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div
      className="min-h-screen bg-[#060B19] text-platinum flex flex-col pb-24 relative overflow-x-hidden"
      onContextMenu={(e) => e.preventDefault()}
    >
      {/* Top Ambient Electric-Blue Glow */}
      <div className="pointer-events-none fixed top-0 left-1/2 -translate-x-1/2 w-[520px] h-[220px] bg-blue-600/15 blur-[110px] rounded-full z-0" />

      {/* ================= STICKY HEADER ================= */}
      <header className="sticky top-0 z-30 bg-[#060B19]/85 backdrop-blur-xl px-4 pt-3.5 pb-2.5 border-b border-blue-500/10">
        <div className="max-w-5xl mx-auto flex items-center justify-between">
          {/* Brand Identity */}
          <button
            type="button"
            onClick={() => {
              setActiveTab("home");
              setActiveCategory("For You");
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

          {/* Right Controls: Admin Upload & Auth Pill */}
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
                className="flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-[#101A36]/90 border border-blue-400/35 text-platinum text-xs sm:text-sm font-medium shadow-[0_0_12px_rgba(59,130,246,0.2)] hover:border-cyan-400/60 transition"
              >
                <UserIcon className="h-4 w-4 text-cyan-400" />
                <span className="max-w-[100px] truncate">
                  {profile?.display_name || "Account"}
                </span>
              </button>
            ) : (
              <button
                type="button"
                onClick={() =>
                  requireAuthForAction(
                    "Sign in to save wallpapers and unlock full-resolution downloads.",
                    { type: "profile_tab" }
                  )
                }
                className="flex items-center gap-2 px-4 py-1.5 rounded-full bg-[#101A36]/90 border border-blue-400/40 text-white text-xs sm:text-sm font-medium shadow-[0_0_15px_rgba(59,130,246,0.25)] hover:border-cyan-400/70 transition"
              >
                <UserIcon className="h-4 w-4 text-silver" />
                <span>Sign In</span>
              </button>
            )}
          </div>
        </div>
      </header>

      {/* ================= MAIN CONTENT AREA ================= */}
      {activeTab === "profile" ? (
        /* ================= DEDICATED ACCOUNT & PROFILE VIEW ================= */
        <main className="flex-1 max-w-5xl w-full mx-auto px-4 pt-5 pb-12 z-10">
          {user ? (
            <div className="space-y-8">
              {/* Signed-In User Header Card */}
              <div className="rounded-3xl bg-[#0E1730]/90 border border-blue-400/30 p-5 sm:p-7 shadow-[0_10px_35px_rgba(0,0,0,0.5)] backdrop-blur-xl">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-5">
                  <div className="flex items-center gap-4">
                    <div className="h-16 w-16 rounded-full bg-gradient-to-br from-blue-600 to-cyan-400 p-[2px] shadow-[0_0_20px_rgba(56,189,248,0.4)] shrink-0">
                      <div className="h-full w-full rounded-full bg-[#070D1F] flex items-center justify-center text-xl font-bold text-white uppercase">
                        {(profile?.display_name || user.email || "U")[0]}
                      </div>
                    </div>

                    <div className="space-y-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <h2 className="text-lg sm:text-xl font-bold text-white truncate">
                          {profile?.display_name || "Fusion Explorer"}
                        </h2>
                        {isAdmin && (
                          <span className="text-[10px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded-full bg-cyan-500/20 text-cyan-300 border border-cyan-400/30">
                            Admin
                          </span>
                        )}
                      </div>

                      {/* Partially Masked Email with Deliberate Toggle */}
                      <div className="flex items-center gap-2 text-xs sm:text-sm text-silver">
                        <span className="truncate">
                          {revealFullEmail
                            ? user.email
                            : maskEmailAddress(user.email)}
                        </span>
                        <button
                          type="button"
                          onClick={() => setRevealFullEmail(!revealFullEmail)}
                          className="text-cyan-400 hover:text-cyan-300 p-1 rounded-md transition"
                          title={
                            revealFullEmail
                              ? "Hide full email"
                              : "View full email"
                          }
                        >
                          {revealFullEmail ? (
                            <EyeOff className="h-3.5 w-3.5" />
                          ) : (
                            <Eye className="h-3.5 w-3.5" />
                          )}
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* Account Action Buttons */}
                  <div className="flex items-center gap-2.5">
                    <Button
                      type="button"
                      onClick={() => {
                        setSettingsFeedback(null);
                        setEditDisplayName(
                          profile?.display_name ||
                            user.email?.split("@")[0] ||
                            ""
                        );
                        setIsSettingsModalOpen(true);
                      }}
                      className="flex-1 sm:flex-none rounded-full bg-[#162244] hover:bg-[#1E2E5A] text-white border border-blue-400/30 text-xs sm:text-sm h-10 px-4"
                    >
                      <Settings className="h-4 w-4 mr-1.5 text-cyan-400" />
                      Account Settings
                    </Button>

                    <Button
                      type="button"
                      variant="outline"
                      onClick={handleSignOut}
                      className="flex-1 sm:flex-none rounded-full bg-transparent hover:bg-red-950/40 text-silver hover:text-red-300 border border-silver/20 text-xs sm:text-sm h-10 px-4"
                    >
                      <LogOut className="h-4 w-4 mr-1.5" />
                      Sign Out
                    </Button>
                  </div>
                </div>
              </div>

              {/* My Saved Wallpapers Section */}
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-base sm:text-lg font-bold text-white tracking-wide">
                    My Saved Wallpapers
                  </h3>
                  <span className="text-xs text-silver">
                    {savedWallpapersList.length}{" "}
                    {savedWallpapersList.length === 1 ? "item" : "items"}
                  </span>
                </div>

                {savedWallpapersList.length === 0 ? (
                  <div className="rounded-3xl bg-[#0E1730]/60 border border-blue-400/20 p-10 text-center max-w-md mx-auto my-6">
                    <Bookmark className="h-10 w-10 text-cyan-400 mx-auto mb-3 opacity-80" />
                    <p className="text-sm sm:text-base font-semibold text-white">
                      You haven&apos;t saved any wallpapers yet.
                    </p>
                    <p className="text-xs text-silver mt-1.5 mb-5">
                      Tap the bookmark icon on any wallpaper to keep your
                      favorites synced across all your devices.
                    </p>
                    <Button
                      type="button"
                      onClick={() => setActiveTab("explore")}
                      className="rounded-full bg-gradient-to-r from-[#2563EB] to-[#38BDF8] text-white font-semibold px-6 shadow-[0_0_18px_rgba(56,189,248,0.4)]"
                    >
                      Explore Wallpapers
                    </Button>
                  </div>
                ) : (
                  <div className="columns-2 sm:columns-3 md:columns-4 gap-3.5 space-y-3.5">
                    {savedWallpapersList.map((item) =>
                      renderWallpaperCard(item, { showRemoveSavedBtn: true })
                    )}
                  </div>
                )}
              </div>
            </div>
          ) : (
            /* Guest Profile Page */
            <div className="rounded-3xl bg-[#0E1730]/85 border border-blue-400/30 p-8 sm:p-10 text-center max-w-md mx-auto my-8 shadow-[0_10px_35px_rgba(0,0,0,0.6)]">
              <div className="mx-auto h-16 w-16 rounded-full bg-[#070D1F] border border-cyan-400/40 flex items-center justify-center mb-4 shadow-[0_0_20px_rgba(56,189,248,0.25)]">
                <UserIcon className="h-8 w-8 text-cyan-400" />
              </div>
              <h2 className="text-xl font-bold text-white">
                Your Fusion Account
              </h2>
              <p className="text-xs sm:text-sm text-silver mt-2 leading-relaxed">
                Sign in or create a free account to download original
                full-resolution wallpapers and sync your saved collection across
                all your devices.
              </p>
              <div className="flex flex-col sm:flex-row gap-3 mt-6">
                <Button
                  type="button"
                  onClick={() => {
                    setAuthReason(
                      "Sign in to access your saved wallpapers and full-resolution downloads."
                    );
                    setAuthMode("signin");
                    setAuthStep("EMAIL_ENTRY");
                    setIsAuthModalOpen(true);
                  }}
                  className="flex-1 rounded-full bg-gradient-to-r from-[#2563EB] to-[#38BDF8] text-white font-semibold h-11 shadow-[0_0_18px_rgba(56,189,248,0.4)]"
                >
                  Sign In
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    setAuthReason(
                      "Create a free account with email verification to unlock all features."
                    );
                    setAuthMode("signup");
                    setAuthStep("EMAIL_ENTRY");
                    setIsAuthModalOpen(true);
                  }}
                  className="flex-1 rounded-full bg-[#162244] text-white border-blue-400/35 hover:bg-[#1E2E5A] font-semibold h-11"
                >
                  Create Account
                </Button>
              </div>
            </div>
          )}
        </main>
      ) : (
        /* ================= HOME / EXPLORE / SAVED GALLERY VIEW ================= */
        <>
          {/* Search Bar & Category Pills */}
          <div className="max-w-5xl w-full mx-auto px-4 pt-2 pb-4 z-10 space-y-3.5">
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
                  type="button"
                  aria-label="Clear search"
                  onClick={() => setSearchQuery("")}
                  className="text-silver/70 hover:text-white p-1"
                >
                  <X className="h-4 w-4" />
                </button>
              ) : (
                <button
                  type="button"
                  aria-label="Focus search filter"
                  onClick={() => searchInputRef.current?.focus()}
                  className="text-silver/80 hover:text-white p-1 shrink-0"
                >
                  <SlidersHorizontal className="h-5 w-5" />
                </button>
              )}
            </div>

            {/* Category Pills */}
            <div className="flex items-center gap-2.5 overflow-x-auto no-scrollbar pb-1">
              {CATEGORIES.map((cat) => {
                const IconComponent = cat.icon;
                const isActive = activeCategory === cat.id;
                return (
                  <button
                    key={cat.id}
                    type="button"
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

          {/* Main Wallpaper Grid */}
          <main className="flex-1 max-w-5xl w-full mx-auto px-4 z-10">
            {activeTab === "saved" && (
              <div className="mb-3.5 flex items-center justify-between">
                <h2 className="text-sm font-bold text-white tracking-wide uppercase">
                  Saved Wallpapers ({filteredWallpapers.length})
                </h2>
              </div>
            )}

            {loading ? (
              /* Skeleton Loading State */
              <div className="columns-2 sm:columns-3 md:columns-4 gap-3.5 space-y-3.5">
                {[260, 190, 230, 280, 200, 250].map((height, idx) => (
                  <div
                    key={idx}
                    style={{ height: `${height}px` }}
                    className="break-inside-avoid rounded-2xl bg-[#0E1730]/80 border border-blue-400/15 animate-pulse"
                  />
                ))}
              </div>
            ) : fetchError ? (
              <div className="rounded-3xl bg-[#0E1730]/80 border border-red-400/30 p-8 text-center max-w-md mx-auto my-8">
                <AlertCircle className="h-10 w-10 text-red-400 mx-auto mb-3" />
                <h3 className="text-base font-bold text-white">
                  Connection Error
                </h3>
                <p className="text-xs text-silver mt-1 mb-4">{fetchError}</p>
                <Button
                  type="button"
                  onClick={fetchWallpapers}
                  className="rounded-full bg-gradient-to-r from-[#2563EB] to-[#38BDF8] text-white font-semibold px-5"
                >
                  <RefreshCw className="h-4 w-4 mr-1.5" />
                  Retry
                </Button>
              </div>
            ) : filteredWallpapers.length === 0 ? (
              <div className="bg-[#0E1730]/75 border border-blue-400/20 rounded-3xl p-10 text-center max-w-md mx-auto my-6 backdrop-blur-md">
                <FourPointStar className="h-10 w-10 text-cyan-400 mx-auto mb-3 opacity-80" />
                <h3 className="text-base font-semibold text-white">
                  {activeTab === "saved"
                    ? "You haven't saved any wallpapers yet."
                    : "No Wallpapers Found"}
                </h3>
                <p className="text-xs text-silver mt-1.5 mb-5 leading-relaxed">
                  {activeTab === "saved"
                    ? "Tap the bookmark icon on any wallpaper to save it to your account."
                    : "Try selecting another category pill or clearing your search filter."}
                </p>
                {activeTab === "saved" && (
                  <Button
                    type="button"
                    onClick={() => setActiveTab("explore")}
                    className="rounded-full bg-gradient-to-r from-[#2563EB] to-[#38BDF8] text-white font-semibold px-6"
                  >
                    Back to Explore
                  </Button>
                )}
              </div>
            ) : (
              <div className="columns-2 sm:columns-3 md:columns-4 gap-3.5 space-y-3.5">
                {filteredWallpapers.map((item) => renderWallpaperCard(item))}
              </div>
            )}
          </main>
        </>
      )}

      {/* ================= COMPACT FLOATING BOTTOM NAVIGATION ================= */}
      <nav
        aria-label="Primary Bottom Navigation"
        className="fixed bottom-3 left-1/2 -translate-x-1/2 z-30 w-[88%] max-w-sm rounded-full bg-[#0C152E]/90 backdrop-blur-xl border border-blue-400/35 px-5 py-2 shadow-[0_10px_30px_rgba(0,0,0,0.75),0_0_20px_rgba(37,99,235,0.22)]"
      >
        <div className="flex items-center justify-between">
          {/* Home */}
          <button
            type="button"
            onClick={() => {
              setActiveTab("home");
              window.scrollTo({ top: 0, behavior: "smooth" });
            }}
            className="flex flex-col items-center gap-0.5 group px-2"
          >
            <Home
              className={`h-4 w-4 sm:h-5 sm:w-5 transition ${
                activeTab === "home"
                  ? "text-cyan-400 drop-shadow-[0_0_8px_rgba(56,189,248,0.9)]"
                  : "text-silver/70 group-hover:text-white"
              }`}
            />
            <span
              className={`text-[10px] font-medium ${
                activeTab === "home" ? "text-white" : "text-silver/70"
              }`}
            >
              Home
            </span>
          </button>

          {/* Explore */}
          <button
            type="button"
            onClick={() => {
              setActiveTab("explore");
              window.scrollTo({ top: 0, behavior: "smooth" });
              setTimeout(() => searchInputRef.current?.focus(), 150);
            }}
            className="flex flex-col items-center gap-0.5 group px-2"
          >
            <Compass
              className={`h-4 w-4 sm:h-5 sm:w-5 transition ${
                activeTab === "explore"
                  ? "text-cyan-400 drop-shadow-[0_0_8px_rgba(56,189,248,0.9)]"
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

          {/* Saved (Prompts login for guests) */}
          <button
            type="button"
            onClick={() => {
              if (!user) {
                requireAuthForAction(
                  "Sign in to view and sync your saved wallpapers across devices.",
                  { type: "saved_tab" }
                );
              } else {
                setActiveTab("saved");
                window.scrollTo({ top: 0, behavior: "smooth" });
              }
            }}
            className="flex flex-col items-center gap-0.5 group px-2"
          >
            <Bookmark
              className={`h-4 w-4 sm:h-5 sm:w-5 transition ${
                activeTab === "saved"
                  ? "text-cyan-400 fill-cyan-400/20 drop-shadow-[0_0_8px_rgba(56,189,248,0.9)]"
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

          {/* Profile */}
          <button
            type="button"
            onClick={() => {
              setActiveTab("profile");
              window.scrollTo({ top: 0, behavior: "smooth" });
            }}
            className="flex flex-col items-center gap-0.5 group px-2"
          >
            <UserIcon
              className={`h-4 w-4 sm:h-5 sm:w-5 transition ${
                activeTab === "profile"
                  ? "text-cyan-400 drop-shadow-[0_0_8px_rgba(56,189,248,0.9)]"
                  : "text-silver/70 group-hover:text-white"
              }`}
            />
            <span
              className={`text-[10px] font-medium ${
                activeTab === "profile" ? "text-white" : "text-silver/70"
              }`}
            >
              Profile
            </span>
          </button>
        </div>
      </nav>

      {/* ================= DEDICATED WALLPAPER DETAIL SCREEN (MODAL / FULL VIEW) ================= */}
      {selectedWallpaper && (
        <div
          ref={detailScrollRef}
          role="dialog"
          aria-modal="true"
          aria-label={selectedWallpaper.title}
          className="fixed inset-0 z-50 bg-[#050A18]/95 backdrop-blur-2xl overflow-y-auto animate-in fade-in duration-200"
        >
          <div className="max-w-3xl mx-auto px-4 pt-4 pb-16">
            {/* 1. Close Button in Top-Right Corner */}
            <div className="sticky top-3 z-30 flex justify-end mb-2">
              <button
                type="button"
                aria-label="Close detail view"
                onClick={closeWallpaperDetail}
                className="h-10 w-10 rounded-full bg-[#101A36]/90 border border-blue-400/35 flex items-center justify-center text-white shadow-[0_0_15px_rgba(0,0,0,0.6)] hover:border-cyan-400 transition"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* 2. Large, High-Quality Preview */}
            <div
              className="relative rounded-3xl overflow-hidden bg-[#0A1128] border border-blue-400/30 shadow-[0_12px_40px_rgba(0,0,0,0.75)] flex items-center justify-center"
              onContextMenu={(e) => e.preventDefault()}
            >
              <img
                src={selectedWallpaper.image_url}
                alt={selectedWallpaper.title}
                draggable={false}
                onContextMenu={(e) => e.preventDefault()}
                className="w-full max-h-[72vh] object-contain pointer-events-none select-none"
              />
              <div
                className="absolute inset-0 z-10 bg-transparent"
                onContextMenu={(e) => e.preventDefault()}
              />
            </div>

            {/* 3. Wallpaper Name Directly Below Image */}
            <div className="mt-4 text-center sm:text-left">
              <h2 className="text-xl sm:text-2xl font-bold text-white tracking-wide">
                {selectedWallpaper.title}
              </h2>
            </div>

            {/* 4 & 5. Prominent Download Button + Save/Bookmark Button */}
            <div className="mt-4 flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
              <Button
                type="button"
                onClick={() => triggerDirectDownload(selectedWallpaper)}
                disabled={downloadingId === selectedWallpaper.id}
                className="flex-1 h-12 rounded-full bg-gradient-to-r from-[#2563EB] to-[#38BDF8] text-white font-bold text-sm sm:text-base shadow-[0_0_22px_rgba(56,189,248,0.45)] hover:opacity-95 transition"
              >
                {downloadingId === selectedWallpaper.id ? (
                  <>
                    <Loader2 className="h-5 w-5 animate-spin mr-2" />
                    Preparing Original File...
                  </>
                ) : (
                  <>
                    <Download className="h-5 w-5 mr-2" />
                    Download Wallpaper
                  </>
                )}
              </Button>

              <Button
                type="button"
                variant="outline"
                onClick={(e) => toggleSaveWallpaper(e, selectedWallpaper)}
                disabled={savingInProgressIds.includes(selectedWallpaper.id)}
                className={`h-12 px-6 rounded-full font-semibold text-sm sm:text-base border transition ${
                  savedIds.includes(selectedWallpaper.id)
                    ? "bg-cyan-500/20 border-cyan-400 text-cyan-300 hover:bg-cyan-500/30"
                    : "bg-[#101A36] border-blue-400/35 text-white hover:border-cyan-400/70"
                }`}
              >
                <Bookmark
                  className={`h-5 w-5 mr-2 ${
                    savedIds.includes(selectedWallpaper.id)
                      ? "fill-cyan-400 text-cyan-400"
                      : ""
                  }`}
                />
                {savedIds.includes(selectedWallpaper.id) ? "Saved" : "Save"}
              </Button>
            </div>

            {/* Download Feedback Banner */}
            {downloadStatus && downloadStatus.id === selectedWallpaper.id && (
              <div
                className={`mt-3 p-3 rounded-2xl border text-xs sm:text-sm flex items-center justify-between ${
                  downloadStatus.type === "success"
                    ? "bg-emerald-950/60 border-emerald-400/40 text-emerald-200"
                    : "bg-red-950/60 border-red-400/40 text-red-200"
                }`}
              >
                <div className="flex items-center gap-2">
                  {downloadStatus.type === "success" ? (
                    <CheckCircle2 className="h-4 w-4 text-emerald-400 shrink-0" />
                  ) : (
                    <AlertCircle className="h-4 w-4 text-red-400 shrink-0" />
                  )}
                  <span>{downloadStatus.message}</span>
                </div>
                {downloadStatus.type === "error" && (
                  <button
                    type="button"
                    onClick={() => triggerDirectDownload(selectedWallpaper)}
                    className="underline font-semibold ml-3 shrink-0"
                  >
                    Retry
                  </button>
                )}
              </div>
            )}

            {/* 6. Related Wallpapers Section */}
            <div className="mt-10 pt-6 border-t border-blue-400/20">
              <h3 className="text-base sm:text-lg font-bold text-white tracking-wide mb-4">
                Related Wallpapers
              </h3>

              {relatedWallpapers.length === 0 ? (
                <p className="text-xs text-silver">
                  More wallpapers coming soon.
                </p>
              ) : (
                <>
                  <div className="columns-2 sm:columns-3 gap-3.5 space-y-3.5">
                    {relatedWallpapers
                      .slice(0, relatedVisibleCount)
                      .map((rel) => renderWallpaperCard(rel))}
                  </div>

                  {relatedVisibleCount < relatedWallpapers.length && (
                    <div className="mt-6 text-center">
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() =>
                          setRelatedVisibleCount((prev) => prev + 6)
                        }
                        className="rounded-full bg-[#101A36] border-blue-400/35 text-silver hover:text-white px-6"
                      >
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

      {/* ================= MULTI-STEP AUTHENTICATION MODAL ================= */}
      <Dialog open={isAuthModalOpen} onOpenChange={setIsAuthModalOpen}>
        <DialogContent className="bg-[#0E1730] border border-blue-400/35 text-platinum sm:max-w-md rounded-3xl p-6 shadow-[0_15px_50px_rgba(0,0,0,0.8)]">
          <DialogHeader>
            <div className="mx-auto bg-[#060B19] p-3 rounded-full border border-cyan-400/30 mb-2 shadow-[0_0_15px_rgba(56,189,248,0.25)]">
              <FourPointStar className="h-6 w-6 text-cyan-400" />
            </div>
            <DialogTitle className="text-center text-xl font-bold text-white">
              {authStep === "OTP_VERIFY"
                ? "Verify Your Email"
                : authStep === "CREATE_PASSWORD"
                ? "Create Your Password"
                : authMode === "signup"
                ? "Create Free Account"
                : authMode === "recovery"
                ? "Reset Password"
                : "Sign In to Fusion"}
            </DialogTitle>
            <DialogDescription className="text-center text-silver text-xs sm:text-sm">
              {authReason}
            </DialogDescription>
          </DialogHeader>

          {/* STEP 1: ENTER EMAIL */}
          {authStep === "EMAIL_ENTRY" && (
            <form onSubmit={handleEmailStepSubmit} className="space-y-4 mt-2">
              {/* Mode Switch Tabs */}
              <div className="grid grid-cols-2 gap-1.5 p-1 rounded-full bg-[#060B19] border border-blue-400/20">
                <button
                  type="button"
                  onClick={() => {
                    setAuthMode("signin");
                    setAuthError(null);
                  }}
                  className={`py-1.5 rounded-full text-xs font-semibold transition ${
                    authMode === "signin"
                      ? "bg-gradient-to-r from-[#2563EB] to-[#38BDF8] text-white"
                      : "text-silver hover:text-white"
                  }`}
                >
                  Sign In
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setAuthMode("signup");
                    setAuthError(null);
                  }}
                  className={`py-1.5 rounded-full text-xs font-semibold transition ${
                    authMode === "signup"
                      ? "bg-gradient-to-r from-[#2563EB] to-[#38BDF8] text-white"
                      : "text-silver hover:text-white"
                  }`}
                >
                  Create Account
                </button>
              </div>

              <div>
                <label className="text-xs font-medium text-silver block mb-1.5">
                  Email Address
                </label>
                <div className="relative">
                  <Mail className="h-4 w-4 text-silver/60 absolute left-3.5 top-3" />
                  <Input
                    type="email"
                    required
                    placeholder="you@example.com"
                    value={authEmail}
                    onChange={(e) => setAuthEmail(e.target.value)}
                    className="pl-10 bg-[#060B19] border-blue-400/30 text-white placeholder:text-silver/40 rounded-xl h-10"
                  />
                </div>
              </div>

              {authError && (
                <p className="text-xs text-red-300 bg-red-950/50 p-2.5 rounded-xl border border-red-400/30">
                  {authError}
                </p>
              )}

              <Button
                type="submit"
                disabled={authLoading}
                className="w-full h-11 rounded-full bg-gradient-to-r from-[#2563EB] to-[#38BDF8] text-white font-bold shadow-[0_0_18px_rgba(56,189,248,0.45)]"
              >
                {authLoading ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  "Continue"
                )}
              </Button>
            </form>
          )}

          {/* RETURNING USER: PASSWORD ENTRY */}
          {authStep === "RETURNING_PASSWORD" && (
            <form
              onSubmit={handleReturningPasswordSignIn}
              className="space-y-4 mt-2"
            >
              <div className="flex items-center justify-between text-xs bg-[#060B19] px-3.5 py-2 rounded-xl border border-blue-400/20">
                <span className="text-silver truncate">{authEmail}</span>
                <button
                  type="button"
                  onClick={() => {
                    setAuthStep("EMAIL_ENTRY");
                    setAuthError(null);
                  }}
                  className="text-cyan-400 hover:underline font-medium ml-2 shrink-0"
                >
                  Change
                </button>
              </div>

              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="text-xs font-medium text-silver">
                    Password
                  </label>
                  <button
                    type="button"
                    onClick={async () => {
                      setAuthMode("recovery");
                      setAuthError(null);
                      setAuthLoading(true);
                      try {
                        const { error } = await supabase.auth.signInWithOtp({
                          email: authEmail.trim().toLowerCase(),
                        });
                        if (error) throw error;
                        setAuthStep("OTP_VERIFY");
                        setResendCooldown(60);
                        setAuthSuccessMsg(
                          "Verification code sent to reset your password."
                        );
                      } catch (err: any) {
                        setAuthError(
                          err.message || "Could not send recovery code."
                        );
                      } finally {
                        setAuthLoading(false);
                      }
                    }}
                    className="text-[11px] text-cyan-400 hover:underline"
                  >
                    Forgot password?
                  </button>
                </div>
                <Input
                  type="password"
                  required
                  placeholder="••••••••"
                  value={authPassword}
                  onChange={(e) => setAuthPassword(e.target.value)}
                  className="bg-[#060B19] border-blue-400/30 text-white placeholder:text-silver/40 rounded-xl h-10"
                />
              </div>

              {authError && (
                <p className="text-xs text-red-300 bg-red-950/50 p-2.5 rounded-xl border border-red-400/30">
                  {authError}
                </p>
              )}

              <Button
                type="submit"
                disabled={authLoading}
                className="w-full h-11 rounded-full bg-gradient-to-r from-[#2563EB] to-[#38BDF8] text-white font-bold shadow-[0_0_18px_rgba(56,189,248,0.45)]"
              >
                {authLoading ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  "Sign In"
                )}
              </Button>

              <div className="text-center">
                <button
                  type="button"
                  onClick={() => {
                    setAuthMode("signup");
                    setAuthStep("EMAIL_ENTRY");
                    setAuthError(null);
                  }}
                  className="text-xs text-silver hover:text-white underline underline-offset-4"
                >
                  New to Fusion? Verify email to create an account
                </button>
              </div>
            </form>
          )}

          {/* STEP 2: VERIFY EMAIL WITH 6-DIGIT OTP CODE */}
          {authStep === "OTP_VERIFY" && (
            <form onSubmit={handleVerifyEmailOtp} className="space-y-4 mt-2">
              {authSuccessMsg && (
                <p className="text-xs text-cyan-300 bg-[#060B19] p-2.5 rounded-xl border border-cyan-400/30 text-center">
                  {authSuccessMsg}
                </p>
              )}

              <div>
                <label className="text-xs font-medium text-silver block mb-1.5 text-center">
                  Enter 6-Digit Verification Code
                </label>
                <Input
                  type="text"
                  inputMode="numeric"
                  maxLength={6}
                  required
                  placeholder="123456"
                  value={authOtp}
                  onChange={(e) =>
                    setAuthOtp(e.target.value.replace(/[^0-9]/g, ""))
                  }
                  className="bg-[#060B19] border-blue-400/35 text-white text-center text-lg tracking-[0.4em] font-bold rounded-xl h-12"
                />
              </div>

              {authError && (
                <p className="text-xs text-red-300 bg-red-950/50 p-2.5 rounded-xl border border-red-400/30 text-center">
                  {authError}
                </p>
              )}

              <Button
                type="submit"
                disabled={authLoading}
                className="w-full h-11 rounded-full bg-gradient-to-r from-[#2563EB] to-[#38BDF8] text-white font-bold shadow-[0_0_18px_rgba(56,189,248,0.45)]"
              >
                {authLoading ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  "Verify Code"
                )}
              </Button>

              <div className="flex items-center justify-between text-xs pt-1">
                <button
                  type="button"
                  onClick={() => {
                    setAuthStep("EMAIL_ENTRY");
                    setAuthError(null);
                  }}
                  className="text-silver hover:text-white flex items-center gap-1"
                >
                  <ArrowLeft className="h-3.5 w-3.5" />
                  Change Email
                </button>

                <button
                  type="button"
                  disabled={resendCooldown > 0 || authLoading}
                  onClick={handleResendOtp}
                  className="text-cyan-400 hover:underline disabled:opacity-50"
                >
                  {resendCooldown > 0
                    ? `Resend code in ${resendCooldown}s`
                    : "Resend Code"}
                </button>
              </div>
            </form>
          )}

          {/* STEP 3: CREATE & CONFIRM PASSWORD */}
          {authStep === "CREATE_PASSWORD" && (
            <form
              onSubmit={handleSetAccountPassword}
              className="space-y-4 mt-2"
            >
              {authSuccessMsg && (
                <p className="text-xs text-emerald-300 bg-emerald-950/50 p-2.5 rounded-xl border border-emerald-400/30 text-center">
                  {authSuccessMsg}
                </p>
              )}

              <div>
                <label className="text-xs font-medium text-silver block mb-1">
                  Create Password (min. 6 characters)
                </label>
                <Input
                  type="password"
                  required
                  placeholder="••••••••"
                  value={authPassword}
                  onChange={(e) => setAuthPassword(e.target.value)}
                  className="bg-[#060B19] border-blue-400/30 text-white rounded-xl h-10"
                />
              </div>

              <div>
                <label className="text-xs font-medium text-silver block mb-1">
                  Confirm Password
                </label>
                <Input
                  type="password"
                  required
                  placeholder="••••••••"
                  value={authConfirmPassword}
                  onChange={(e) => setAuthConfirmPassword(e.target.value)}
                  className="bg-[#060B19] border-blue-400/30 text-white rounded-xl h-10"
                />
              </div>

              {authError && (
                <p className="text-xs text-red-300 bg-red-950/50 p-2.5 rounded-xl border border-red-400/30">
                  {authError}
                </p>
              )}

              <Button
                type="submit"
                disabled={authLoading}
                className="w-full h-11 rounded-full bg-gradient-to-r from-[#2563EB] to-[#38BDF8] text-white font-bold shadow-[0_0_18px_rgba(56,189,248,0.45)]"
              >
                {authLoading ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  "Complete Setup & Continue"
                )}
              </Button>
            </form>
          )}
        </DialogContent>
      </Dialog>

      {/* ================= ACCOUNT SETTINGS MODAL ================= */}
      <Dialog open={isSettingsModalOpen} onOpenChange={setIsSettingsModalOpen}>
        <DialogContent className="bg-[#0E1730] border border-blue-400/35 text-platinum sm:max-w-md rounded-3xl p-6">
          <DialogHeader>
            <DialogTitle className="text-lg font-bold text-white">
              Account Settings
            </DialogTitle>
            <DialogDescription className="text-xs text-silver">
              Manage your profile display name and security credentials.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleSaveAccountSettings} className="space-y-4 mt-2">
            <div>
              <label className="text-xs font-medium text-silver block mb-1">
                Verified Email Address
              </label>
              <Input
                type="email"
                 disabled
                value={user?.email || ""}
                className="bg-[#060B19]/60 border-blue-400/20 text-silver rounded-xl opacity-80 cursor-not-allowed"
              />
            </div>

            <div>
              <label className="text-xs font-medium text-silver block mb-1">
                Display Name
              </label>
              <Input
                type="text"
                required
                value={editDisplayName}
                onChange={(e) => setEditDisplayName(e.target.value)}
                className="bg-[#060B19] border-blue-400/30 text-white rounded-xl"
              />
            </div>

            <div className="pt-2 border-t border-blue-400/15 space-y-3">
              <div className="flex items-center gap-1.5 text-xs font-semibold text-cyan-400">
                <KeyRound className="h-3.5 w-3.5" />
                <span>Change Password (Optional)</span>
              </div>

              <div>
                <label className="text-xs text-silver block mb-1">
                  New Password
                </label>
                <Input
                  type="password"
                  placeholder="Leave blank to keep current"
                  value={newPasswordInput}
                  onChange={(e) => setNewPasswordInput(e.target.value)}
                  className="bg-[#060B19] border-blue-400/30 text-white rounded-xl"
                />
              </div>

              {newPasswordInput.length > 0 && (
                <div>
                  <label className="text-xs text-silver block mb-1">
                    Confirm New Password
                  </label>
                  <Input
                    type="password"
                    placeholder="Confirm new password"
                    value={confirmNewPasswordInput}
                    onChange={(e) => setConfirmNewPasswordInput(e.target.value)}
                    className="bg-[#060B19] border-blue-400/30 text-white rounded-xl"
                  />
                </div>
              )}
            </div>

            {settingsFeedback && (
              <p
                className={`text-xs p-2.5 rounded-xl border text-center ${
                  settingsFeedback.type === "success"
                    ? "bg-emerald-950/50 border-emerald-400/30 text-emerald-300"
                    : "bg-red-950/50 border-red-400/30 text-red-300"
                }`}
              >
                {settingsFeedback.text}
              </p>
            )}

            <div className="flex items-center gap-2.5 pt-2">
              <Button
                type="submit"
                disabled={settingsLoading}
                className="flex-1 rounded-full bg-gradient-to-r from-[#2563EB] to-[#38BDF8] text-white font-bold"
              >
                {settingsLoading ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <>
                    <Check className="h-4 w-4 mr-1.5" />
                    Save Changes
                  </>
                )}
              </Button>

              <Button
                type="button"
                variant="outline"
                onClick={handleSignOut}
                className="rounded-full bg-transparent border-red-400/30 text-red-300 hover:bg-red-950/40"
              >
                Sign Out
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* ================= ADMIN ONLY UPLOAD MODAL (PRESERVED) ================= */}
      <Dialog open={isUploadModalOpen} onOpenChange={setIsUploadModalOpen}>
        <DialogContent className="bg-[#0E1730] border border-blue-400/35 text-platinum sm:max-w-md rounded-3xl p-6">
          <DialogHeader>
            <DialogTitle className="text-lg font-bold text-white">
              Upload New Wallpaper
            </DialogTitle>
            <DialogDescription className="text-silver text-xs">
              Publish a high-resolution wallpaper to Fusion Wallpapers.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleAdminUpload} className="space-y-4 mt-2">
            <div>
              <label className="text-xs font-medium text-silver block mb-1">
                Wallpaper Name
              </label>
              <Input
                type="text"
                required
                placeholder="e.g., Midnight Summit"
                value={uploadTitle}
                onChange={(e) => setUploadTitle(e.target.value)}
                className="bg-[#060B19] border-blue-400/30 text-white placeholder:text-silver/40 rounded-xl"
              />
            </div>

            <div>
              <label className="text-xs font-medium text-silver block mb-1">
                Category
              </label>
              <div className="flex flex-wrap gap-2">
                {["Anime", "Minimal", "Dark", "Nature"].map((cat) => (
                  <button
                    key={cat}
                    type="button"
                    onClick={() => setUploadCategory(cat)}
                    className={`px-3.5 py-1.5 rounded-full text-xs font-medium border transition ${
                      uploadCategory === cat
                        ? "bg-gradient-to-r from-[#2563EB] to-[#38BDF8] text-white border-cyan-300"
                        : "bg-[#060B19] text-silver border-blue-400/25"
                    }`}
                  >
                    {cat}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="text-xs font-medium text-silver block mb-1">
                Wallpaper Image File
              </label>
              <Input
                type="file"
                accept="image/*"
                required
                onChange={(e) => setUploadFile(e.target.files?.[0] || null)}
                className="bg-[#060B19] border-blue-400/30 text-silver file:bg-[#101A36] file:text-white file:border-0 file:rounded-lg file:px-2.5 file:py-1 file:mr-2 file:text-xs rounded-xl"
              />
            </div>

            <Button
              type="submit"
              disabled={uploading || !uploadFile}
              className="w-full h-11 rounded-full bg-gradient-to-r from-[#2563EB] to-[#38BDF8] text-white font-bold shadow-[0_0_18px_rgba(56,189,248,0.45)]"
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
