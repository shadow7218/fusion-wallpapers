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
  Bookmark,
  Home,
  Compass,
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
  MoreHorizontal,
  Share2,
  Image as ImageIcon,
  ChevronLeft,
  ExternalLink,
  Flame,
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

import { animeCategories } from "../config/animeCategories";
import {
  GlassContainer,
  GlassButton,
  LiquidGlassShaderDefs,
} from "@/components/liquid-glass/LiquidGlass";

interface Wallpaper {
  id: string;
  title: string;
  image_url: string;
  storage_path: string;
  category?: string | null;
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

function getWallpaperCategory(w: Wallpaper): string | null {
  if (w.category !== undefined) return w.category;
  return null;
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

  const [activeTab, setActiveTab] = useState<
    "home" | "explore" | "saved" | "profile"
  >("home");
  const [exploreView, setExploreView] = useState<"grid" | "category">("grid");
  const [selectedExploreCategory, setSelectedExploreCategory] = useState<
    string | null
  >(null);
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [selectedPillCategory, setSelectedPillCategory] =
    useState<string>("All");

  const [selectedWallpaper, setSelectedWallpaper] = useState<Wallpaper | null>(
    null
  );
  const [isExpanded, setIsExpanded] = useState<boolean>(false);
  const [relatedVisibleCount, setRelatedVisibleCount] = useState<number>(6);

  const [activeMenu, setActiveMenu] = useState<{
    wallpaper: Wallpaper;
    top?: number;
    bottom?: number;
    left: number;
  } | null>(null);

  const [downloadingId, setDownloadingId] = useState<string | null>(null);
  const [downloadStatus, setDownloadStatus] = useState<{
    id: string;
    type: "success" | "error";
    message: string;
  } | null>(null);

  const [isAuthModalOpen, setIsAuthModalOpen] = useState<boolean>(false);
  const [authStep, setAuthStep] = useState<AuthStep>("SIGN_IN");
  const [authReason, setAuthReason] = useState<string>(
    "Sign in to save wallpapers and unlock full-resolution downloads."
  );
  const [pendingIntent, setPendingIntent] = useState<PendingIntent | null>(
    null
  );
  const [authEmail, setAuthEmail] = useState<string>("");
  const [authPassword, setAuthPassword] = useState<string>("");
  const [authConfirmPassword, setAuthConfirmPassword] = useState<string>("");
  const [authLoading, setAuthLoading] = useState<boolean>(false);
  const [authError, setAuthError] = useState<string | null>(null);
  const [authSuccessMsg, setAuthSuccessMsg] = useState<string | null>(null);
  const [resendCooldown, setResendCooldown] = useState<number>(0);

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

  const [isUploadModalOpen, setIsUploadModalOpen] = useState<boolean>(false);
  const [uploadTitle, setUploadTitle] = useState<string>("");
  const [uploadCategory, setUploadCategory] = useState<string>("none");
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState<boolean>(false);

  const [isEditModalOpen, setIsEditModalOpen] = useState<boolean>(false);
  const [editCategorySelection, setEditCategorySelection] =
    useState<string>("none");
  const [editSetAsBanner, setEditSetAsBanner] = useState<boolean>(false);
  const [editingWallpaper, setEditingWallpaper] = useState<boolean>(false);

  // PC Hero Banner & Music-App Ambient Background Index
  const [pcHeroIndex, setPcHeroIndex] = useState<number>(0);
  const [ambientBgIndex, setAmbientBgIndex] = useState<number>(0);

  const isAdmin = user?.id === ADMIN_UUID;

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
    } = supabase.auth.onAuthStateChange(async (event, session) => {
      const currentUser = session?.user ?? null;
      setUser(currentUser);
      if (event === "PASSWORD_RECOVERY") {
        setAuthStep("UPDATE_PASSWORD");
        setAuthError(null);
        setAuthSuccessMsg(
          "Recovery link verified! Enter your new password below."
        );
        setIsAuthModalOpen(true);
      }
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

  // Auto-scrolling PC Hero Banner + Dynamic Ambient Artwork Background rotation
  useEffect(() => {
    if (wallpapers.length === 0) return;
    const timer = setInterval(() => {
      setPcHeroIndex((prev) => (prev + 1) % Math.min(wallpapers.length, 5));
      setAmbientBgIndex((prev) => (prev + 1) % Math.min(wallpapers.length, 8));
    }, 6000);
    return () => clearInterval(timer);
  }, [wallpapers]);

  useEffect(() => {
    const closeMenu = () => setActiveMenu(null);
    window.addEventListener("click", closeMenu);
    window.addEventListener("scroll", closeMenu, true);
    window.addEventListener("resize", closeMenu);
    return () => {
      window.removeEventListener("click", closeMenu);
      window.removeEventListener("scroll", closeMenu, true);
      window.removeEventListener("resize", closeMenu);
    };
  }, []);

  useEffect(() => {
    if (resendCooldown <= 0) return;
    const timer = setInterval(
      () => setResendCooldown((prev) => Math.max(0, prev - 1)),
      1000
    );
    return () => clearInterval(timer);
  }, [resendCooldown]);

  useEffect(() => {
    const handlePopState = () => {
      if (selectedWallpaper) setSelectedWallpaper(null);
    };
    window.addEventListener("popstate", handlePopState);
    return () => window.removeEventListener("popstate", handlePopState);
  }, [selectedWallpaper]);

  const openWallpaperDetail = (wallpaper: Wallpaper) => {
    setActiveMenu(null);
    if (!selectedWallpaper)
      window.history.pushState({ wallpaperId: wallpaper.id }, "");
    setSelectedWallpaper(wallpaper);
    setRelatedVisibleCount(6);
    setDownloadStatus(null);
    setIsExpanded(false);
    if (detailScrollRef.current)
      detailScrollRef.current.scrollTo({ top: 0, behavior: "smooth" });
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
    const fallbackName = currentUser.email?.split("@")[0] || "Shadow";
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
    if (!error && data) setSavedIds(data.map((row) => row.wallpaper_id));
  };

  const requireAuthForAction = (
    reason: string,
    intent: PendingIntent,
    initialStep: AuthStep = "SIGN_IN"
  ) => {
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

  const isValidEmail = (value: string) =>
    /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim());

  const handleSignInSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (authLoading) return;
    setAuthError(null);
    setAuthSuccessMsg(null);
    const cleanEmail = authEmail.trim().toLowerCase();
    if (!isValidEmail(cleanEmail))
      return setAuthError("Please enter a valid email address.");

    setAuthLoading(true);
    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email: cleanEmail,
        password: authPassword,
      });
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
    if (!isValidEmail(cleanEmail))
      return setAuthError("Please enter a valid email address.");
    if (authPassword.length < 6)
      return setAuthError("Password must be at least 6 characters long.");
    if (authPassword !== authConfirmPassword)
      return setAuthError("Passwords do not match.");

    setAuthLoading(true);
    try {
      const { data, error } = await supabase.auth.signUp({
        email: cleanEmail,
        password: authPassword,
      });
      if (error) throw error;
      if (data.session && data.user) {
        const defaultName = cleanEmail.split("@")[0] || "Shadow";
        await supabase
          .from("profiles")
          .upsert({ id: data.user.id, display_name: defaultName });
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
      setAuthSuccessMsg(
        `Account created! Please check ${cleanEmail} for a confirmation link, then sign in below.`
      );
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
    if (!isValidEmail(cleanEmail))
      return setAuthError("Please enter your registered email address.");

    setAuthLoading(true);
    try {
      const redirectUrl =
        typeof window !== "undefined" ? window.location.origin : undefined;
      const { error } = await supabase.auth.resetPasswordForEmail(cleanEmail, {
        redirectTo: redirectUrl,
      });
      if (error) throw error;
      setResendCooldown(60);
      setAuthStep("RESET_LINK_SENT");
      setAuthSuccessMsg(
        `Password reset instructions have been sent to ${cleanEmail}.`
      );
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
    if (authPassword.length < 6)
      return setAuthError("New password must be at least 6 characters long.");
    if (authPassword !== authConfirmPassword)
      return setAuthError("Passwords do not match.");

    setAuthLoading(true);
    try {
      const { data, error } = await supabase.auth.updateUser({
        password: authPassword,
      });
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
        const { error } = await supabase
          .from("saved_wallpapers")
          .upsert(
            { user_id: activeUser.id, wallpaper_id: wallpaper.id },
            { onConflict: "user_id,wallpaper_id" }
          );
        if (error) throw error;
      }
    } catch (err) {
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
      let fileBlob: Blob | null = null;
      if (wallpaper.storage_path) {
        const { data, error } = await supabase.storage
          .from("wallpapers")
          .download(wallpaper.storage_path);
        if (!error && data) fileBlob = data;
      }
      if (!fileBlob) {
        const response = await fetch(wallpaper.image_url, { mode: "cors" });
        if (!response.ok) throw new Error("Image file could not be reached.");
        fileBlob = await response.blob();
      }
      if (!fileBlob || fileBlob.size === 0)
        throw new Error("Downloaded file is empty or unavailable.");

      const extFromPath = wallpaper.storage_path
        ?.split(".")
        .pop()
        ?.toLowerCase();
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
          err.message ||
          "Download failed. Please check your connection and retry.",
      });
    } finally {
      setDownloadingId(null);
    }
  };

  const handleShareWallpaper = async (
    e: React.MouseEvent,
    wallpaper: Wallpaper
  ) => {
    e.stopPropagation();
    setActiveMenu(null);
    if (navigator.share) {
      try {
        await navigator.share({
          title: wallpaper.title,
          text: `Check out this wallpaper on Fusion: ${wallpaper.title}`,
          url: wallpaper.image_url,
        });
      } catch (err) {
        // User cancelled share
      }
    } else {
      try {
        await navigator.clipboard.writeText(wallpaper.image_url);
        alert("Wallpaper link copied to clipboard!");
      } catch (err) {
        alert("Could not share link.");
      }
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
      const { error: profileError } = await supabase.from("profiles").upsert({
        id: user.id,
        display_name: trimmedName,
        updated_at: new Date().toISOString(),
      });
      if (profileError) throw profileError;

      setProfile({ id: user.id, display_name: trimmedName });

      if (newPasswordInput.trim().length > 0) {
        if (newPasswordInput.length < 6)
          throw new Error("New password must be at least 6 characters.");
        if (newPasswordInput !== confirmNewPasswordInput)
          throw new Error("New passwords do not match.");
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

  const handleAdminUpload = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isAdmin || !uploadFile || !uploadTitle.trim() || uploading) return;
    setUploading(true);

    try {
      const fileExt = uploadFile.name.split(".").pop();
      const prefix =
        uploadCategory === "none" ? "general" : uploadCategory.toLowerCase();
      const fileName = `${prefix}-${Date.now()}-${Math.random()
        .toString(36)
        .substring(2, 7)}.${fileExt}`;

      const { error: storageError } = await supabase.storage
        .from("wallpapers")
        .upload(fileName, uploadFile, { cacheControl: "3600", upsert: false });
      if (storageError) throw storageError;

      const {
        data: { publicUrl },
      } = supabase.storage.from("wallpapers").getPublicUrl(fileName);

      let isFirst = false;
      if (uploadCategory !== "none") {
        const { data: existingInCategory } = await supabase
          .from("wallpapers")
          .select("id")
          .eq("category", uploadCategory)
          .limit(1);
        isFirst = !existingInCategory || existingInCategory.length === 0;
      }

      const { error: dbError } = await supabase.from("wallpapers").insert([
        {
          title: uploadTitle.trim(),
          image_url: publicUrl,
          storage_path: fileName,
          category: uploadCategory === "none" ? null : uploadCategory,
          is_banner: isFirst,
        },
      ]);

      if (dbError) {
        const { error: fallbackError } = await supabase
          .from("wallpapers")
          .insert([
            {
              title: uploadTitle.trim(),
              image_url: publicUrl,
              storage_path: fileName,
              category: null,
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
    setActiveMenu(null);
    if (!isAdmin) return;
    if (!window.confirm(`Delete "${wallpaper.title}" permanently?`)) return;

    try {
      await supabase.storage
        .from("wallpapers")
        .remove([wallpaper.storage_path]);
      await supabase.from("wallpapers").delete().eq("id", wallpaper.id);
      setWallpapers((prev) => prev.filter((w) => w.id !== wallpaper.id));
      if (selectedWallpaper?.id === wallpaper.id) closeWallpaperDetail();
    } catch (err: any) {
      alert(`Delete failed: ${err.message}`);
    }
  };

  const handleAdminEditSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isAdmin || !selectedWallpaper || editingWallpaper) return;
    setEditingWallpaper(true);

    try {
      const finalCat =
        editCategorySelection === "none" ? null : editCategorySelection;
      if (editSetAsBanner && finalCat) {
        await supabase
          .from("wallpapers")
          .update({ is_banner: false })
          .eq("category", finalCat);
      }

      const { error } = await supabase
        .from("wallpapers")
        .update({
          category: finalCat,
          is_banner: editSetAsBanner && finalCat !== null,
        })
        .eq("id", selectedWallpaper.id);

      if (error) throw error;

      setIsEditModalOpen(false);
      await fetchWallpapers();
      closeWallpaperDetail();
    } catch (err: any) {
      alert(`Failed to update wallpaper: ${err.message}`);
    } finally {
      setEditingWallpaper(false);
    }
  };

  const filteredWallpapers = useMemo(() => {
    return wallpapers.filter((item) => {
      if (activeTab === "saved" && !savedIds.includes(item.id)) return false;

      if (
        activeTab === "explore" &&
        exploreView === "category" &&
        selectedExploreCategory
      ) {
        if (getWallpaperCategory(item) !== selectedExploreCategory) return false;
      }

      if (activeTab === "home" && selectedPillCategory !== "All") {
        const catId = animeCategories.find(
          (c) => c.name === selectedPillCategory
        )?.id;
        if (getWallpaperCategory(item) !== catId) return false;
      }

      const q = searchQuery.trim().toLowerCase();
      if (q) {
        const itemCat = (getWallpaperCategory(item) || "").toLowerCase();
        return (
          item.title.toLowerCase().includes(q) ||
          itemCat.includes(q) ||
          item.storage_path.toLowerCase().includes(q)
        );
      }

      return true;
    });
  }, [
    wallpapers,
    activeTab,
    savedIds,
    searchQuery,
    exploreView,
    selectedExploreCategory,
    selectedPillCategory,
  ]);

  const savedWallpapersList = useMemo(
    () => wallpapers.filter((w) => savedIds.includes(w.id)),
    [wallpapers, savedIds]
  );

  const relatedWallpapers = useMemo(() => {
    if (!selectedWallpaper) return [];
    const currentCat = getWallpaperCategory(selectedWallpaper);
    const others = wallpapers.filter((w) => w.id !== selectedWallpaper.id);
    const scored = others.map((candidate) => {
      let score = 0;
      if (currentCat && getWallpaperCategory(candidate) === currentCat)
        score += 10;
      return { wallpaper: candidate, score };
    });
    scored.sort((a, b) => b.score - a.score);
    return scored.map((s) => s.wallpaper);
  }, [wallpapers, selectedWallpaper]);

  // Daily Top 10 Ranking System
  const topTenDailyWallpapers = useMemo(() => {
    if (wallpapers.length === 0) return [];
    const daySeed = Math.floor(Date.now() / (1000 * 60 * 60 * 24));
    const scored = wallpapers.map((w, idx) => {
      const hash =
        (w.id.charCodeAt(0) || 1) * 31 +
        (w.id.charCodeAt(w.id.length - 1) || 1) +
        daySeed +
        idx;
      const dailyScore = (w.downloads || 0) * 100 + (hash % 97);
      return { wallpaper: w, dailyScore };
    });
    scored.sort((a, b) => b.dailyScore - a.dailyScore);
    return scored.slice(0, 10).map((s) => s.wallpaper);
  }, [wallpapers]);

  // Active artwork URL for the Music-App Style Moving Background
  const activeAmbientImageUrl = useMemo(() => {
    if (selectedWallpaper) return selectedWallpaper.image_url;
    if (filteredWallpapers.length > 0) {
      return filteredWallpapers[ambientBgIndex % filteredWallpapers.length]
        .image_url;
    }
    if (wallpapers.length > 0) {
      return wallpapers[ambientBgIndex % wallpapers.length].image_url;
    }
    return "/logo.webp";
  }, [selectedWallpaper, filteredWallpapers, wallpapers, ambientBgIndex]);

  const handleToggleCardMenu = (
    e: React.MouseEvent<HTMLButtonElement>,
    item: Wallpaper
  ) => {
    e.stopPropagation();
    if (activeMenu?.wallpaper.id === item.id) {
      setActiveMenu(null);
      return;
    }

    const rect = e.currentTarget.getBoundingClientRect();
    const menuWidth = 160;
    const menuApproxHeight = isAdmin ? 175 : 135;

    const left = Math.min(
      Math.max(12, rect.right - menuWidth),
      window.innerWidth - menuWidth - 12
    );

    const spaceAbove = rect.top;
    const spaceBelow = window.innerHeight - rect.bottom;

    if (spaceAbove < menuApproxHeight + 130 && spaceBelow > menuApproxHeight) {
      setActiveMenu({
        wallpaper: item,
        top: rect.bottom + 6,
        left,
      });
    } else {
      setActiveMenu({
        wallpaper: item,
        bottom: window.innerHeight - rect.top + 6,
        left,
      });
    }
  };

  const renderWallpaperCard = (
    item: Wallpaper,
    options?: { showRemoveSavedBtn?: boolean }
  ) => {
    const ratio = imageRatios[item.id];
    const isTall = ratio !== undefined && ratio <= 0.57;
    const isMenuOpen = activeMenu?.wallpaper.id === item.id;

    return (
      <div
        key={item.id}
        className="break-inside-avoid mb-2.5 relative flex flex-col"
      >
        <div
          onClick={() => openWallpaperDetail(item)}
          className={`relative w-full overflow-hidden rounded-2xl bg-white/5 border border-white/15 cursor-pointer active:scale-95 transition-transform duration-150 shadow-lg ${
            isTall ? "aspect-[9/16]" : ""
          }`}
          onContextMenu={(e) => e.preventDefault()}
        >
          <img
            src={item.image_url}
            alt={item.title}
            loading="lazy"
            draggable={false}
            onLoad={(e) => {
              const { naturalWidth, naturalHeight } = e.currentTarget;
              setImageRatios((prev) => ({
                ...prev,
                [item.id]: naturalWidth / naturalHeight,
              }));
            }}
            onContextMenu={(e) => e.preventDefault()}
            className={`w-full block pointer-events-none select-none ${
              isTall ? "h-full object-cover" : "h-auto object-cover"
            }`}
          />
          <div
            className="absolute inset-0 z-10 bg-transparent"
            onContextMenu={(e) => e.preventDefault()}
          />
        </div>

        <div className="mt-1 px-0.5 flex items-center justify-between">
          <h3 className="text-[11px] font-normal text-white/95 drop-shadow-sm truncate max-w-[80%] tracking-tight">
            {item.title}
          </h3>

          <button
            type="button"
            aria-label="Wallpaper options"
            onClick={(e) => handleToggleCardMenu(e, item)}
            className={`h-5 w-5 rounded-md flex items-center justify-center transition active:scale-90 ${
              isMenuOpen
                ? "bg-white/20 text-white"
                : "text-white/85 hover:bg-white/10"
            }`}
          >
            <MoreHorizontal className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>
    );
  };

  const detailRatio = selectedWallpaper
    ? imageRatios[selectedWallpaper.id]
    : undefined;
  const detailIsTall = detailRatio !== undefined && detailRatio <= 0.57;

  return (
    <div
      className="min-h-screen bg-transparent text-[#E5E4E2] flex flex-col pb-24 relative overflow-x-hidden selection:bg-white selection:text-black font-sans"
      onContextMenu={(e) => e.preventDefault()}
    >
      <LiquidGlassShaderDefs />

      {/* ================= MUSIC-PLAYER STYLE DYNAMIC MOVING AMBIENT BACKGROUND ================= */}
      <div
        aria-hidden="true"
        className="pointer-events-none fixed inset-0 z-0 overflow-hidden bg-[#08090c]"
      >
        {/* Primary Floating Color Orb */}
        <img
          key={`ambient-1-${activeAmbientImageUrl}`}
          src={activeAmbientImageUrl}
          alt=""
          className="absolute -top-[15%] -left-[15%] w-[130%] h-[130%] object-cover blur-[90px] saturate-[1.9] brightness-[0.65] opacity-85 animate-ambient-1 transition-all duration-1000 select-none"
        />
        {/* Secondary Counter-Rotating Color Orb */}
        <img
          key={`ambient-2-${activeAmbientImageUrl}`}
          src={activeAmbientImageUrl}
          alt=""
          className="absolute -bottom-[15%] -right-[15%] w-[130%] h-[130%] object-cover blur-[110px] saturate-[2.1] brightness-[0.55] opacity-75 animate-ambient-2 transition-all duration-1000 select-none"
        />
        {/* Smooth Ambient Vignette Veil (Just like Apple Music / Spotify Now Playing) */}
        <div className="absolute inset-0 bg-gradient-to-b from-black/30 via-black/45 to-black/75 backdrop-blur-[30px]" />
      </div>

      {/* ================= SMART SCREEN-AWARE 3-DOT MENU ================= */}
      {activeMenu && (
        <GlassContainer
          type="rounded"
          borderRadius={20}
          tintOpacity={0.35}
          blurRadius={28}
          warp={true}
          style={{
            top: activeMenu.top !== undefined ? `${activeMenu.top}px` : "auto",
            bottom:
              activeMenu.bottom !== undefined
                ? `${activeMenu.bottom}px`
                : "auto",
            left: `${activeMenu.left}px`,
            background:
              "linear-gradient(145deg, rgba(16, 20, 30, 0.88) 0%, rgba(8, 10, 16, 0.94) 100%)",
          }}
          className="fixed z-50 w-40 p-1.5 animate-in fade-in zoom-in-95 duration-150 shadow-[0_20px_50px_rgba(0,0,0,0.9)]"
          onClick={(e) => e.stopPropagation()}
        >
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              const target = activeMenu.wallpaper;
              setActiveMenu(null);
              toggleSaveWallpaper(null, target);
            }}
            className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-bold text-white hover:bg-white/20 transition active:scale-95"
          >
            <Bookmark
              className={`h-3.5 w-3.5 ${
                savedIds.includes(activeMenu.wallpaper.id)
                  ? "fill-white text-white"
                  : ""
              }`}
            />
            <span>
              {savedIds.includes(activeMenu.wallpaper.id) ? "Saved" : "Save"}
            </span>
          </button>

          <button
            type="button"
            onClick={(e) => handleShareWallpaper(e, activeMenu.wallpaper)}
            className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-bold text-white hover:bg-white/20 transition active:scale-95"
          >
            <Share2 className="h-3.5 w-3.5" />
            <span>Share</span>
          </button>

          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              const target = activeMenu.wallpaper;
              setActiveMenu(null);
              triggerDirectDownload(target);
            }}
            className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-bold text-white hover:bg-white/20 transition active:scale-95"
          >
            <Download className="h-3.5 w-3.5" />
            <span>Download</span>
          </button>

          {isAdmin && (
            <button
              type="button"
              onClick={(e) => handleAdminDelete(e, activeMenu.wallpaper)}
              className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-bold text-red-300 hover:bg-red-950/60 transition border-t border-white/15 mt-0.5 pt-1.5"
            >
              <Trash2 className="h-3.5 w-3.5" />
              <span>Delete</span>
            </button>
          )}
        </GlassContainer>
      )}

      {/* ================= LIQUID GLASS HEADER ================= */}
      <header className="sticky top-0 z-30 bg-black/25 backdrop-blur-xl px-4 pt-3 pb-2.5 border-b border-white/10">
        <div className="max-w-5xl mx-auto flex items-center justify-between">
          <button
            type="button"
            onClick={() => {
              setActiveTab("home");
              setSearchQuery("");
              window.scrollTo({ top: 0, behavior: "smooth" });
            }}
            className="flex items-center gap-2.5 text-left focus:outline-none group active:scale-95 transition-transform"
          >
            <div className="h-8 w-8 rounded-xl bg-white/10 border border-white/25 flex items-center justify-center overflow-hidden shrink-0 shadow-sm">
              <img
                src="/logo.webp"
                alt="Fusion Logo"
                className="h-full w-full object-cover"
              />
            </div>
            <span className="text-base sm:text-lg font-black tracking-[0.22em] text-white uppercase">
              FUSION
            </span>
          </button>

          <div className="flex items-center gap-2">
            {isAdmin && (
              <GlassButton
                typeShape="pill"
                activeWhite={true}
                onClick={() => setIsUploadModalOpen(true)}
                className="px-3.5 py-1.5 text-xs font-bold"
              >
                <Upload className="h-3.5 w-3.5" />
                <span>Upload</span>
              </GlassButton>
            )}

            {user ? (
              <GlassButton
                typeShape="pill"
                tintOpacity={0.22}
                onClick={() => setActiveTab("profile")}
                className="px-3.5 py-1.5 text-xs font-semibold"
              >
                <UserIcon className="h-3.5 w-3.5 text-white" />
                <span className="max-w-[85px] truncate">
                  {profile?.display_name || "Shadow"}
                </span>
              </GlassButton>
            ) : (
              <GlassButton
                typeShape="pill"
                tintOpacity={0.22}
                onClick={() =>
                  requireAuthForAction(
                    "Sign in to save wallpapers and unlock full-resolution downloads.",
                    { type: "profile_tab" },
                    "SIGN_IN"
                  )
                }
                className="px-4 py-1.5 text-xs font-semibold"
              >
                <UserIcon className="h-3.5 w-3.5 text-white" />
                <span>Sign In</span>
              </GlassButton>
            )}
          </div>
        </div>
      </header>

      {/* ================= LIQUID GLASS SEARCH BAR & PILLS ================= */}
      {(activeTab === "home" || activeTab === "explore") && (
        <div className="max-w-5xl w-full mx-auto px-4 pt-3 pb-2 z-10 space-y-2.5">
          <GlassContainer
            type="pill"
            tintOpacity={0.18}
            blurRadius={22}
            className="w-full h-11 px-4 flex items-center"
          >
            <div className="flex items-center w-full h-full">
              <Search className="h-4 w-4 text-white/70 mr-3 shrink-0" />
              <input
                ref={searchInputRef}
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search wallpapers, anime, moods..."
                className="w-full bg-transparent text-xs sm:text-sm text-white placeholder:text-white/55 focus:outline-none font-medium"
              />
              {searchQuery ? (
                <button
                  type="button"
                  aria-label="Clear search"
                  onClick={() => setSearchQuery("")}
                  className="text-white/70 hover:text-white p-1"
                >
                  <X className="h-4 w-4" />
                </button>
              ) : null}
            </div>
          </GlassContainer>

          {activeTab === "home" && !searchQuery && (
            <div className="flex items-center gap-2 overflow-x-auto no-scrollbar pt-0.5 pb-1">
              {["All", ...animeCategories.map((c) => c.name)].map(
                (pillName) => {
                  const isActive = selectedPillCategory === pillName;
                  return (
                    <GlassButton
                      key={pillName}
                      typeShape="pill"
                      activeWhite={isActive}
                      tintOpacity={0.18}
                      onClick={() => {
                        setSelectedPillCategory(pillName);
                        window.scrollTo({ top: 0, behavior: "smooth" });
                      }}
                      className="px-4 py-1.5 text-[11px] font-semibold shrink-0"
                    >
                      {pillName}
                    </GlassButton>
                  );
                }
              )}
            </div>
          )}
        </div>
      )}

      {/* ================= CONTENT AREA ================= */}
      {activeTab === "profile" ? (
        <main className="flex-1 max-w-5xl w-full mx-auto px-4 pt-2 pb-12 z-10">
          {user ? (
            <div className="space-y-6">
              {/* Compact Profile Box + Social Link Block */}
              <div className="max-w-md mx-auto space-y-2.5">
                <GlassContainer
                  type="rounded"
                  borderRadius={24}
                  tintOpacity={0.2}
                  className="p-4"
                >
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="h-11 w-11 rounded-full bg-white/15 border border-white/25 flex items-center justify-center text-base font-bold text-white uppercase shrink-0">
                        {(profile?.display_name || user.email || "U")[0]}
                      </div>

                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5">
                          <h2 className="text-sm sm:text-base font-bold text-white truncate">
                            {profile?.display_name || "Shadow"}
                          </h2>
                          {isAdmin && (
                            <span className="text-[8px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded-full bg-white/20 text-white border border-white/30">
                              Admin
                            </span>
                          )}
                        </div>

                        <div className="flex items-center gap-1.5 text-[11px] text-white/70">
                          <span className="truncate">
                            {revealFullEmail
                              ? user.email
                              : maskEmailAddress(user.email)}
                          </span>
                          <button
                            type="button"
                            onClick={() => setRevealFullEmail(!revealFullEmail)}
                            className="text-white hover:text-white/80 p-0.5 transition"
                          >
                            {revealFullEmail ? (
                              <EyeOff className="h-3 w-3" />
                            ) : (
                              <Eye className="h-3 w-3" />
                            )}
                          </button>
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-1.5 shrink-0">
                      <GlassButton
                        typeShape="pill"
                        onClick={() => {
                          setSettingsFeedback(null);
                          setEditDisplayName(
                            profile?.display_name ||
                              user.email?.split("@")[0] ||
                              ""
                          );
                          setIsSettingsModalOpen(true);
                        }}
                        className="h-8 px-3 text-[11px] font-semibold"
                      >
                        <Settings className="h-3 w-3" />
                        <span>Settings</span>
                      </GlassButton>
                      <GlassButton
                        typeShape="pill"
                        onClick={handleSignOut}
                        className="h-8 px-3 text-[11px] font-semibold text-red-200"
                      >
                        <LogOut className="h-3 w-3" />
                      </GlassButton>
                    </div>
                  </div>
                </GlassContainer>

                {/* COMPACT SOCIAL LINK BLOCK (https://fusion-bio.vercel.app/) */}
                <a
                  href="https://fusion-bio.vercel.app/"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="block active:scale-95 transition-transform"
                >
                  <GlassContainer
                    type="rounded"
                    borderRadius={20}
                    tintOpacity={0.18}
                    className="px-4 py-2.5 flex items-center justify-between hover:border-white/40"
                  >
                    <div className="flex items-center gap-2.5">
                      <div className="h-7 w-7 rounded-lg overflow-hidden border border-white/20 shrink-0">
                        <img
                          src="/logo.webp"
                          alt="Fusion Bio"
                          className="h-full w-full object-cover"
                        />
                      </div>
                      <div>
                        <p className="text-xs font-bold text-white leading-tight">
                          Fusion Official Socials
                        </p>
                        <p className="text-[10px] text-white/65">
                          fusion-bio.vercel.app
                        </p>
                      </div>
                    </div>
                    <div className="h-7 px-3 rounded-full bg-white/15 border border-white/25 flex items-center gap-1 text-[11px] font-bold text-white">
                      <span>Open</span>
                      <ExternalLink className="h-3 w-3" />
                    </div>
                  </GlassContainer>
                </a>
              </div>

              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-bold text-white tracking-wide">
                    My Saved Wallpapers
                  </h3>
                  <span className="text-xs text-white/70 font-medium">
                    {savedWallpapersList.length} items
                  </span>
                </div>
                {savedWallpapersList.length === 0 ? (
                  <GlassContainer
                    type="rounded"
                    borderRadius={28}
                    className="p-10 text-center max-w-md mx-auto my-4"
                  >
                    <Bookmark className="h-8 w-8 text-white mx-auto mb-2 opacity-70" />
                    <p className="text-sm font-semibold text-white">
                      You haven&apos;t saved any wallpapers yet.
                    </p>
                    <p className="text-xs text-white/70 mt-1 mb-4">
                      Tap the 3-dot menu on any wallpaper to save it.
                    </p>
                    <GlassButton
                      typeShape="pill"
                      activeWhite={true}
                      onClick={() => setActiveTab("explore")}
                      className="px-6 h-10 text-xs font-bold"
                    >
                      Explore Wallpapers
                    </GlassButton>
                  </GlassContainer>
                ) : (
                  <div className="columns-2 sm:columns-3 md:columns-4 gap-2.5 space-y-2.5">
                    {savedWallpapersList.map((item) =>
                      renderWallpaperCard(item, { showRemoveSavedBtn: true })
                    )}
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div className="space-y-3 max-w-sm mx-auto my-6">
              <GlassContainer
                type="rounded"
                borderRadius={26}
                className="p-6 text-center"
              >
                <div className="mx-auto h-11 w-11 rounded-2xl overflow-hidden border border-white/25 mb-3">
                  <img
                    src="/logo.webp"
                    alt="Fusion Logo"
                    className="h-full w-full object-cover"
                  />
                </div>
                <h2 className="text-base font-bold text-white">
                  Your Fusion Account
                </h2>
                <p className="text-xs text-white/70 mt-1.5 leading-relaxed">
                  Sign in or create a free account to download high-resolution
                  wallpapers and sync your collection.
                </p>
                <div className="flex gap-2.5 mt-5">
                  <GlassButton
                    typeShape="pill"
                    activeWhite={true}
                    onClick={() =>
                      requireAuthForAction(
                        "Sign in to access your saved wallpapers.",
                        { type: "profile_tab" },
                        "SIGN_IN"
                      )
                    }
                    className="flex-1 h-10 text-xs font-bold"
                  >
                    Sign In
                  </GlassButton>
                  <GlassButton
                    typeShape="pill"
                    onClick={() =>
                      requireAuthForAction(
                        "Create an account to unlock downloads.",
                        { type: "profile_tab" },
                        "SIGN_UP"
                      )
                    }
                    className="flex-1 h-10 text-xs font-bold"
                  >
                    Create Account
                  </GlassButton>
                </div>
              </GlassContainer>

              {/* COMPACT SOCIAL LINK BLOCK FOR GUEST USERS */}
              <a
                href="https://fusion-bio.vercel.app/"
                target="_blank"
                rel="noopener noreferrer"
                className="block active:scale-95 transition-transform"
              >
                <GlassContainer
                  type="rounded"
                  borderRadius={20}
                  tintOpacity={0.18}
                  className="px-4 py-2.5 flex items-center justify-between hover:border-white/40"
                >
                  <div className="flex items-center gap-2.5">
                    <div className="h-7 w-7 rounded-lg overflow-hidden border border-white/20 shrink-0">
                      <img
                        src="/logo.webp"
                        alt="Fusion Bio"
                        className="h-full w-full object-cover"
                      />
                    </div>
                    <div>
                      <p className="text-xs font-bold text-white leading-tight">
                        Fusion Official Socials
                      </p>
                      <p className="text-[10px] text-white/65">
                        fusion-bio.vercel.app
                      </p>
                    </div>
                  </div>
                  <div className="h-7 px-3 rounded-full bg-white/15 border border-white/25 flex items-center gap-1 text-[11px] font-bold text-white">
                    <span>Open</span>
                    <ExternalLink className="h-3 w-3" />
                  </div>
                </GlassContainer>
              </a>
            </div>
          )}
        </main>
      ) : activeTab === "explore" && !searchQuery ? (
        <main className="flex-1 max-w-5xl w-full mx-auto px-4 z-10 pb-10">
          {exploreView === "grid" ? (
            <div className="space-y-4 pt-2">
              <div className="flex items-center gap-2">
                <Compass className="h-4 w-4 text-white" />
                <h2 className="text-base font-bold text-white tracking-wide">
                  Explore Anime
                </h2>
              </div>

              <div className="grid grid-cols-2 gap-2.5">
                {animeCategories.map((cat) => {
                  const catWallpapers = wallpapers.filter(
                    (w) => getWallpaperCategory(w) === cat.id
                  );
                  let banner = catWallpapers.find((w) => w.is_banner);
                  if (!banner && catWallpapers.length > 0)
                    banner = catWallpapers[catWallpapers.length - 1];
                  const bannerUrl = banner
                    ? banner.image_url
                    : cat.fallbackBanner;

                  return (
                    <div
                      key={cat.id}
                      onClick={() => {
                        setSelectedExploreCategory(cat.id);
                        setExploreView("category");
                        window.scrollTo({ top: 0, behavior: "smooth" });
                      }}
                      className="group relative h-28 sm:h-36 rounded-2xl overflow-hidden bg-white/5 border border-white/15 cursor-pointer shadow-sm hover:border-white/40 transition-all flex flex-col justify-end active:scale-95"
                    >
                      <img
                        src={bannerUrl}
                        alt={cat.name}
                        className="absolute inset-0 w-full h-full object-cover transition-transform duration-500 group-hover:scale-105 pointer-events-none select-none"
                      />
                      <div className="absolute inset-0 bg-gradient-to-t from-black/95 via-black/30 to-transparent" />
                      <div className="relative p-2.5">
                        <h3 className="text-xs font-bold text-white tracking-wide truncate">
                          {cat.name}
                        </h3>
                        <p className="text-[9px] text-white/65 mt-0.5">
                          {catWallpapers.length} wallpapers
                        </p>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ) : (
            <div className="space-y-3 pt-2">
              <GlassButton
                typeShape="pill"
                onClick={() => setExploreView("grid")}
                className="px-3.5 py-1.5 text-xs font-semibold"
              >
                <ArrowLeft className="h-3.5 w-3.5" />
                <span>Back to Explore</span>
              </GlassButton>

              <h2 className="text-lg font-bold text-white tracking-wide">
                {animeCategories.find((c) => c.id === selectedExploreCategory)
                  ?.name || "Category"}
              </h2>

              {filteredWallpapers.length === 0 ? (
                <GlassContainer
                  type="rounded"
                  borderRadius={28}
                  className="p-10 text-center max-w-md mx-auto my-6"
                >
                  <ImageIcon className="h-8 w-8 text-white mx-auto mb-2 opacity-70" />
                  <h3 className="text-sm font-semibold text-white">
                    No Wallpapers Yet
                  </h3>
                  <p className="text-xs text-white/70 mt-1">
                    Admin hasn&apos;t uploaded any wallpapers for this category.
                  </p>
                </GlassContainer>
              ) : (
                <div className="columns-2 sm:columns-3 md:columns-4 gap-2.5 space-y-2.5">
                  {filteredWallpapers.map((item) => renderWallpaperCard(item))}
                </div>
              )}
            </div>
          )}
        </main>
      ) : (
        <main className="flex-1 max-w-5xl w-full mx-auto px-4 z-10">
          {/* ================= PC ONLY SECTION: AUTO-SCROLLING HERO BANNER & TOP 10 TODAY RANKING ================= */}
          {activeTab === "home" &&
            !searchQuery &&
            selectedPillCategory === "All" &&
            wallpapers.length > 0 && (
              <div className="hidden md:block mb-9 space-y-7 pt-2">
                {/* 1. PC Auto-Scrolling Hero Banner */}
                <div className="relative w-full h-[360px] rounded-3xl overflow-hidden border border-white/15 shadow-[0_20px_50px_rgba(0,0,0,0.85)]">
                  {wallpapers.slice(0, 5).map((hero, idx) => (
                    <div
                      key={hero.id}
                      className={`absolute inset-0 transition-opacity duration-700 ease-out cursor-pointer ${
                        idx === pcHeroIndex
                          ? "opacity-100 z-10 pointer-events-auto"
                          : "opacity-0 z-0 pointer-events-none"
                      }`}
                      onClick={() => openWallpaperDetail(hero)}
                    >
                      <img
                        src={hero.image_url}
                        alt={hero.title}
                        className="w-full h-full object-cover"
                      />
                      <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/35 to-transparent" />
                      <div className="absolute bottom-7 left-8 right-8 max-w-xl space-y-2">
                        <span className="inline-block px-3 py-1 rounded-full bg-white/15 backdrop-blur-md text-[10px] font-bold text-white border border-white/25 uppercase tracking-widest">
                          Featured Today
                        </span>
                        <h2 className="text-3xl font-black text-white drop-shadow-md">
                          {hero.title}
                        </h2>
                        <div className="flex items-center gap-2.5 pt-1">
                          <GlassButton
                            typeShape="pill"
                            activeWhite={true}
                            onClick={(e) => {
                              e.stopPropagation();
                              openWallpaperDetail(hero);
                            }}
                            className="px-5 h-9 text-xs font-extrabold"
                          >
                            View Wallpaper
                          </GlassButton>
                          <GlassButton
                            typeShape="pill"
                            onClick={(e) => {
                              e.stopPropagation();
                              toggleSaveWallpaper(e, hero);
                            }}
                            className="px-4 h-9 text-xs font-bold"
                          >
                            <Bookmark className="h-3.5 w-3.5" />
                            <span>Save</span>
                          </GlassButton>
                        </div>
                      </div>
                    </div>
                  ))}

                  <div className="absolute bottom-6 right-8 z-20 flex items-center gap-1.5">
                    {wallpapers.slice(0, 5).map((_, idx) => (
                      <button
                        key={idx}
                        type="button"
                        onClick={() => setPcHeroIndex(idx)}
                        className={`h-1.5 rounded-full transition-all ${
                          idx === pcHeroIndex
                            ? "w-7 bg-white"
                            : "w-2 bg-white/35"
                        }`}
                      />
                    ))}
                  </div>
                </div>

                {/* 2. Top 10 Today Ranking System (1 to 10 Horizontal Scroll Row) */}
                <div className="space-y-3">
                  <div className="flex items-center gap-2">
                    <Flame className="h-5 w-5 text-red-500" />
                    <h3 className="text-lg font-black text-white tracking-wide">
                      Top 10 Today
                    </h3>
                  </div>

                  <div className="flex items-center gap-5 overflow-x-auto no-scrollbar py-2 pl-2 pr-4">
                    {topTenDailyWallpapers.map((rankedItem, rankIdx) => (
                      <div
                        key={rankedItem.id}
                        onClick={() => openWallpaperDetail(rankedItem)}
                        className="group relative flex items-end shrink-0 cursor-pointer select-none"
                      >
                        <span className="text-[105px] leading-none font-black text-transparent [-webkit-text-stroke:2.5px_rgba(255,255,255,0.35)] group-hover:[-webkit-text-stroke:2.5px_rgba(255,255,255,0.85)] transition-all -mr-5 z-0 pointer-events-none">
                          {rankIdx + 1}
                        </span>
                        <div className="relative z-10 w-32 h-48 rounded-2xl overflow-hidden bg-white/5 border border-white/15 shadow-xl group-hover:scale-105 group-hover:border-white/40 transition-all duration-300">
                          <img
                            src={rankedItem.image_url}
                            alt={rankedItem.title}
                            loading="lazy"
                            className="w-full h-full object-cover"
                          />
                          <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/90 via-black/40 to-transparent p-2">
                            <p className="text-[11px] font-bold text-white truncate">
                              {rankedItem.title}
                            </p>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}

          {activeTab === "saved" && (
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-xs font-bold text-white tracking-wide uppercase">
                Saved Wallpapers ({filteredWallpapers.length})
              </h2>
            </div>
          )}

          {loading ? (
            <div className="columns-2 sm:columns-3 md:columns-4 gap-2.5 space-y-2.5">
              {[220, 160, 200, 240, 180, 210].map((height, idx) => (
                <div
                  key={idx}
                  style={{ height: `${height}px` }}
                  className="break-inside-avoid rounded-2xl bg-white/5 border border-white/10 animate-pulse"
                />
              ))}
            </div>
          ) : fetchError ? (
            <GlassContainer
              type="rounded"
              borderRadius={24}
              className="p-6 text-center max-w-md mx-auto my-6"
            >
              <AlertCircle className="h-8 w-8 text-red-400 mx-auto mb-2" />
              <h3 className="text-sm font-bold text-white">Connection Error</h3>
              <p className="text-xs text-white/70 mt-1 mb-3">{fetchError}</p>
              <GlassButton
                typeShape="pill"
                activeWhite={true}
                onClick={fetchWallpapers}
                className="px-5 h-9 text-xs font-bold"
              >
                <RefreshCw className="h-3.5 w-3.5" />
                <span>Retry</span>
              </GlassButton>
            </GlassContainer>
          ) : filteredWallpapers.length === 0 ? (
            <GlassContainer
              type="rounded"
              borderRadius={28}
              className="p-10 text-center max-w-md mx-auto my-6"
            >
              <h3 className="text-sm font-semibold text-white">
                {activeTab === "saved"
                  ? "You haven't saved any wallpapers yet."
                  : "No Wallpapers Found"}
              </h3>
              <p className="text-xs text-white/70 mt-1">
                {activeTab === "saved"
                  ? "Tap the 3-dot menu on any wallpaper to save it."
                  : "Try clearing your search or filter."}
              </p>
            </GlassContainer>
          ) : (
            <div className="columns-2 sm:columns-3 md:columns-4 gap-2.5 space-y-2.5">
              {filteredWallpapers.map((item) => renderWallpaperCard(item))}
            </div>
          )}
        </main>
      )}

      {/* ================= LIQUID GLASS BOTTOM NAVIGATION DOCK ================= */}
      <nav
        aria-label="Primary Bottom Navigation"
        className="fixed bottom-3.5 left-1/2 -translate-x-1/2 z-40 w-[88%] max-w-xs"
      >
        <GlassContainer
          type="pill"
          tintOpacity={0.14}
          blurRadius={26}
          warp={true}
          className="p-1.5"
        >
          <div className="flex items-center justify-between relative">
            <button
              type="button"
              onClick={() => {
                setActiveTab("home");
                setSearchQuery("");
                window.scrollTo({ top: 0, behavior: "smooth" });
              }}
              className={`flex-1 flex flex-col items-center gap-0.5 py-1.5 rounded-full transition-all duration-200 active:scale-95 ${
                activeTab === "home"
                  ? "glass-active-white font-bold"
                  : "text-white/75 hover:text-white"
              }`}
            >
              <Home className="h-4 w-4" />
              <span className="text-[9px] font-bold tracking-wide">Home</span>
            </button>

            <button
              type="button"
              onClick={() => {
                setActiveTab("explore");
                setExploreView("grid");
                setSearchQuery("");
                window.scrollTo({ top: 0, behavior: "smooth" });
              }}
              className={`flex-1 flex flex-col items-center gap-0.5 py-1.5 rounded-full transition-all duration-200 active:scale-95 ${
                activeTab === "explore"
                  ? "glass-active-white font-bold"
                  : "text-white/75 hover:text-white"
              }`}
            >
              <Compass className="h-4 w-4" />
              <span className="text-[9px] font-bold tracking-wide">
                Explore
              </span>
            </button>

            <button
              type="button"
              onClick={() => {
                if (!user)
                  requireAuthForAction(
                    "Sign in to view and sync your saved wallpapers across devices.",
                    { type: "saved_tab" }
                  );
                else {
                  setActiveTab("saved");
                  window.scrollTo({ top: 0, behavior: "smooth" });
                }
              }}
              className={`flex-1 flex flex-col items-center gap-0.5 py-1.5 rounded-full transition-all duration-200 active:scale-95 ${
                activeTab === "saved"
                  ? "glass-active-white font-bold"
                  : "text-white/75 hover:text-white"
              }`}
            >
              <Bookmark
                className={`h-4 w-4 ${
                  activeTab === "saved" ? "fill-black" : ""
                }`}
              />
              <span className="text-[9px] font-bold tracking-wide">Saved</span>
            </button>

            <button
              type="button"
              onClick={() => {
                setActiveTab("profile");
                window.scrollTo({ top: 0, behavior: "smooth" });
              }}
              className={`flex-1 flex flex-col items-center gap-0.5 py-1.5 rounded-full transition-all duration-200 active:scale-95 ${
                activeTab === "profile"
                  ? "glass-active-white font-bold"
                  : "text-white/75 hover:text-white"
              }`}
            >
              <UserIcon className="h-4 w-4" />
              <span className="text-[9px] font-bold tracking-wide">
                Profile
              </span>
            </button>
          </div>
        </GlassContainer>
      </nav>

      {/* ================= WALLPAPER DETAIL SCREEN (WITH DYNAMIC MUSIC-PLAYER STYLE MOVING ARTWORK BACKGROUND) ================= */}
      {selectedWallpaper && (
        <div
          ref={detailScrollRef}
          role="dialog"
          aria-modal="true"
          aria-label={selectedWallpaper.title}
          className="fixed inset-0 z-50 bg-[#08090c] overflow-y-auto animate-in fade-in duration-200"
        >
          {/* Dynamic Music-Player Style Moving Artwork Background for the Selected Wallpaper */}
          <div
            aria-hidden="true"
            className="pointer-events-none fixed inset-0 z-0 overflow-hidden"
          >
            <img
              src={selectedWallpaper.image_url}
              alt=""
              className="absolute -top-[15%] -left-[15%] w-[130%] h-[130%] object-cover blur-[85px] saturate-[2.0] brightness-[0.65] opacity-90 animate-ambient-1 select-none"
            />
            <img
              src={selectedWallpaper.image_url}
              alt=""
              className="absolute -bottom-[15%] -right-[15%] w-[130%] h-[130%] object-cover blur-[105px] saturate-[2.2] brightness-[0.55] opacity-80 animate-ambient-2 select-none"
            />
            <div className="absolute inset-0 bg-gradient-to-b from-black/25 via-black/40 to-black/75 backdrop-blur-[25px]" />
          </div>

          <div className="relative z-10 max-w-3xl mx-auto px-4 pt-3 pb-12 flex flex-col items-center">
            <div className="w-full flex items-center justify-between mb-2.5">
              <GlassButton
                typeShape="circle"
                size={40}
                tintOpacity={0.22}
                aria-label="Go back"
                onClick={closeWallpaperDetail}
              >
                <ChevronLeft className="h-5 w-5 text-white" />
              </GlassButton>

              <div className="text-center px-2">
                <h1 className="text-base sm:text-lg font-bold text-white tracking-wide drop-shadow">
                  {selectedWallpaper.title}
                </h1>
                <p className="text-[11px] text-white/75 capitalize">
                  {selectedWallpaper.category
                    ? animeCategories.find(
                        (c) => c.id === selectedWallpaper.category
                      )?.name || selectedWallpaper.category
                    : "Uncategorized"}
                </p>
              </div>

              <GlassButton
                typeShape="circle"
                size={40}
                tintOpacity={0.22}
                aria-label="Share wallpaper"
                onClick={(e) => handleShareWallpaper(e, selectedWallpaper)}
              >
                <Share2 className="h-4 w-4 text-white" />
              </GlassButton>
            </div>

            {isAdmin && (
              <div className="mb-2 w-full flex justify-end">
                <GlassButton
                  typeShape="pill"
                  onClick={() => {
                    setEditCategorySelection(
                      selectedWallpaper.category || "none"
                    );
                    setEditSetAsBanner(!!selectedWallpaper.is_banner);
                    setIsEditModalOpen(true);
                  }}
                  className="h-8 px-3.5 text-[11px] font-bold"
                >
                  <Edit3 className="h-3 w-3" />
                  <span>Edit Category</span>
                </GlassButton>
              </div>
            )}

            {/* PERFECT WALLPAPER BOX WITH TOP-LEFT ICON-ONLY EXPAND BUTTON */}
            <div
              className="relative inline-block rounded-3xl overflow-hidden bg-white/5 border border-white/20 shadow-[0_20px_60px_rgba(0,0,0,0.75)] mx-auto w-fit max-w-full mb-3"
              onContextMenu={(e) => e.preventDefault()}
            >
              <img
                src={selectedWallpaper.image_url}
                alt={selectedWallpaper.title}
                draggable={false}
                onContextMenu={(e) => e.preventDefault()}
                className={`block pointer-events-none select-none transition-all duration-300 ${
                  detailIsTall && !isExpanded
                    ? "w-auto max-w-full max-h-[62vh] aspect-[9/16] object-cover"
                    : "w-auto max-w-full h-auto max-h-[75vh] object-contain"
                }`}
              />

              <div
                className="absolute inset-0 z-10 bg-transparent"
                onContextMenu={(e) => e.preventDefault()}
              />

              {detailIsTall && (
                <GlassButton
                  typeShape="circle"
                  size={38}
                  tintOpacity={0.2}
                  blurRadius={24}
                  aria-label={
                    isExpanded
                      ? "Minimize wallpaper preview"
                      : "View full wallpaper"
                  }
                  onClick={() => setIsExpanded(!isExpanded)}
                  className="absolute top-3 left-3 z-20"
                >
                  {isExpanded ? (
                    <Minimize2 className="h-4 w-4 text-white" />
                  ) : (
                    <Maximize2 className="h-4 w-4 text-white" />
                  )}
                </GlassButton>
              )}
            </div>

            {/* SIDE-BY-SIDE LIQUID GLASS SAVE & DOWNLOAD BUTTONS */}
            <div className="flex items-center gap-3 w-full max-w-md mb-5">
              <GlassButton
                typeShape="pill"
                tintOpacity={0.22}
                activeWhite={savedIds.includes(selectedWallpaper.id)}
                onClick={(e) => toggleSaveWallpaper(e, selectedWallpaper)}
                disabled={savingInProgressIds.includes(selectedWallpaper.id)}
                className="flex-1 h-12 text-xs font-bold"
              >
                <Bookmark
                  className={`h-4 w-4 ${
                    savedIds.includes(selectedWallpaper.id)
                      ? "fill-black text-black"
                      : ""
                  }`}
                />
                <span>
                  {savedIds.includes(selectedWallpaper.id) ? "Saved" : "Save"}
                </span>
              </GlassButton>

              <GlassButton
                typeShape="pill"
                activeWhite={true}
                onClick={() => triggerDirectDownload(selectedWallpaper)}
                disabled={downloadingId === selectedWallpaper.id}
                className="flex-1 h-12 text-xs font-extrabold"
              >
                {downloadingId === selectedWallpaper.id ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    <span>Downloading...</span>
                  </>
                ) : (
                  <>
                    <Download className="h-4 w-4" />
                    <span>Download</span>
                  </>
                )}
              </GlassButton>
            </div>

            {downloadStatus && downloadStatus.id === selectedWallpaper.id && (
              <GlassContainer
                type="rounded"
                borderRadius={16}
                className="mb-4 w-full max-w-md p-3 text-xs flex items-center justify-between"
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
                    className="underline font-semibold ml-2"
                  >
                    Retry
                  </button>
                )}
              </GlassContainer>
            )}

            {/* RELATED WALLPAPERS SECTION */}
            <div className="w-full pt-3 border-t border-white/15">
              <h3 className="text-sm font-bold text-white tracking-wide mb-3">
                Related wallpapers
              </h3>
              {relatedWallpapers.length === 0 ? (
                <p className="text-xs text-white/60">
                  More wallpapers coming soon.
                </p>
              ) : (
                <>
                  <div className="columns-2 sm:columns-3 gap-2.5 space-y-2.5">
                    {relatedWallpapers
                      .slice(0, relatedVisibleCount)
                      .map((rel) => renderWallpaperCard(rel))}
                  </div>
                  {relatedVisibleCount < relatedWallpapers.length && (
                    <div className="mt-4 text-center">
                      <GlassButton
                        typeShape="pill"
                        onClick={() =>
                          setRelatedVisibleCount((prev) => prev + 6)
                        }
                        className="px-5 h-9 text-xs font-semibold"
                      >
                        Load More Related
                      </GlassButton>
                    </div>
                  )}
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ================= AUTHENTICATION MODAL ================= */}
      <Dialog open={isAuthModalOpen} onOpenChange={setIsAuthModalOpen}>
        <DialogContent
          style={{
            background:
              "linear-gradient(145deg, rgba(14, 18, 28, 0.94) 0%, rgba(8, 10, 16, 0.98) 100%)",
          }}
          className="glass-container glass-container-rounded border-white/25 text-white sm:max-w-md p-5 shadow-[0_25px_70px_rgba(0,0,0,0.95)]"
        >
          <DialogHeader>
            <div className="mx-auto h-11 w-11 rounded-2xl overflow-hidden border border-white/25 mb-1">
              <img
                src="/logo.webp"
                alt="Fusion Logo"
                className="h-full w-full object-cover"
              />
            </div>
            <DialogTitle className="text-center text-base font-black text-white">
              {authStep === "FORGOT_PASSWORD"
                ? "Reset Your Password"
                : authStep === "RESET_LINK_SENT"
                ? "Check Your Email"
                : authStep === "UPDATE_PASSWORD"
                ? "Set New Password"
                : authStep === "SIGN_UP"
                ? "Create Free Account"
                : "Sign In to Fusion"}
            </DialogTitle>
            <DialogDescription className="text-center text-white/80 text-[11px]">
              {authStep === "FORGOT_PASSWORD"
                ? "Enter your account email to receive a reset link."
                : authStep === "RESET_LINK_SENT"
                ? "Follow the reset link sent to your inbox."
                : authStep === "UPDATE_PASSWORD"
                ? "Choose a strong new password."
                : authReason}
            </DialogDescription>
          </DialogHeader>

          {(authStep === "SIGN_IN" || authStep === "SIGN_UP") && (
            <div className="grid grid-cols-2 gap-1.5 p-1 rounded-full bg-black/70 border border-white/15 mt-1">
              <button
                type="button"
                onClick={() => {
                  setAuthStep("SIGN_IN");
                  setAuthError(null);
                  setAuthSuccessMsg(null);
                }}
                className={`py-1.5 rounded-full text-[11px] font-bold transition active:scale-95 ${
                  authStep === "SIGN_IN"
                    ? "glass-active-white"
                    : "text-white/75 hover:text-white"
                }`}
              >
                Sign In
              </button>
              <button
                type="button"
                onClick={() => {
                  setAuthStep("SIGN_UP");
                  setAuthError(null);
                  setAuthSuccessMsg(null);
                }}
                className={`py-1.5 rounded-full text-[11px] font-bold transition active:scale-95 ${
                  authStep === "SIGN_UP"
                    ? "glass-active-white"
                    : "text-white/75 hover:text-white"
                }`}
              >
                Create Account
              </button>
            </div>
          )}

          {authStep === "SIGN_IN" && (
            <form onSubmit={handleSignInSubmit} className="space-y-3 pt-1">
              {authSuccessMsg && (
                <p className="text-[11px] text-emerald-300 bg-emerald-950/60 p-2.5 rounded-xl border border-emerald-400/30 text-center">
                  {authSuccessMsg}
                </p>
              )}
              <div className="space-y-1">
                <label className="text-[11px] font-semibold text-white/90 block">
                  Email Address
                </label>
                <div className="relative">
                  <Mail className="h-3.5 w-3.5 text-white/50 absolute left-3.5 top-3.5" />
                  <Input
                    type="email"
                    required
                    placeholder="you@example.com"
                    value={authEmail}
                    onChange={(e) => setAuthEmail(e.target.value)}
                    className="pl-10 bg-black/70 border-white/25 text-white placeholder:text-white/40 rounded-xl h-10 text-xs w-full"
                  />
                </div>
              </div>
              <div className="space-y-1">
                <div className="flex items-center justify-between">
                  <label className="text-[11px] font-semibold text-white/90">
                    Password
                  </label>
                  <button
                    type="button"
                    onClick={() => {
                      setAuthStep("FORGOT_PASSWORD");
                      setAuthError(null);
                      setAuthSuccessMsg(null);
                    }}
                    className="text-[11px] text-white hover:underline font-medium"
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
                  className="bg-black/70 border-white/25 text-white placeholder:text-white/40 rounded-xl h-10 text-xs w-full"
                />
              </div>
              {authError && (
                <p className="text-[11px] text-red-300 bg-red-950/60 p-2.5 rounded-xl border border-red-400/30">
                  {authError}
                </p>
              )}
              <GlassButton
                type="submit"
                typeShape="pill"
                activeWhite={true}
                disabled={authLoading}
                className="w-full h-11 text-xs font-extrabold mt-1"
              >
                {authLoading ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  "Log In"
                )}
              </GlassButton>
            </form>
          )}

          {authStep === "SIGN_UP" && (
            <form onSubmit={handleSignUpSubmit} className="space-y-2.5 pt-1">
              <div className="space-y-1">
                <label className="text-[11px] font-semibold text-white/90 block">
                  Email Address
                </label>
                <div className="relative">
                  <Mail className="h-3.5 w-3.5 text-white/50 absolute left-3.5 top-3.5" />
                  <Input
                    type="email"
                    required
                    placeholder="you@example.com"
                    value={authEmail}
                    onChange={(e) => setAuthEmail(e.target.value)}
                    className="pl-10 bg-black/70 border-white/25 text-white placeholder:text-white/40 rounded-xl h-10 text-xs w-full"
                  />
                </div>
              </div>
              <div className="space-y-1">
                <label className="text-[11px] font-semibold text-white/90 block">
                  Create Password (min. 6 chars)
                </label>
                <Input
                  type="password"
                  required
                  placeholder="••••••••"
                  value={authPassword}
                  onChange={(e) => setAuthPassword(e.target.value)}
                  className="bg-black/70 border-white/25 text-white placeholder:text-white/40 rounded-xl h-10 text-xs w-full"
                />
              </div>
              <div className="space-y-1">
                <label className="text-[11px] font-semibold text-white/90 block">
                  Confirm Password
                </label>
                <Input
                  type="password"
                  required
                  placeholder="••••••••"
                  value={authConfirmPassword}
                  onChange={(e) => setAuthConfirmPassword(e.target.value)}
                  className="bg-black/70 border-white/25 text-white placeholder:text-white/40 rounded-xl h-10 text-xs w-full"
                />
              </div>
              {authError && (
                <p className="text-[11px] text-red-300 bg-red-950/60 p-2.5 rounded-xl border border-red-400/30">
                  {authError}
                </p>
              )}
              <GlassButton
                type="submit"
                typeShape="pill"
                activeWhite={true}
                disabled={authLoading}
                className="w-full h-11 text-xs font-extrabold mt-1"
              >
                {authLoading ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  "Sign Up"
                )}
              </GlassButton>
            </form>
          )}

          {authStep === "FORGOT_PASSWORD" && (
            <form
              onSubmit={handleForgotPasswordSubmit}
              className="space-y-3 pt-1"
            >
              <div className="space-y-1">
                <label className="text-[11px] font-semibold text-white/90 block">
                  Account Email Address
                </label>
                <div className="relative">
                  <Mail className="h-3.5 w-3.5 text-white/50 absolute left-3.5 top-3.5" />
                  <Input
                    type="email"
                    required
                    placeholder="you@example.com"
                    value={authEmail}
                    onChange={(e) => setAuthEmail(e.target.value)}
                    className="pl-10 bg-black/70 border-white/25 text-white placeholder:text-white/40 rounded-xl h-10 text-xs w-full"
                  />
                </div>
              </div>
              {authError && (
                <p className="text-[11px] text-red-300 bg-red-950/60 p-2.5 rounded-xl border border-red-400/30">
                  {authError}
                </p>
              )}
              <GlassButton
                type="submit"
                typeShape="pill"
                activeWhite={true}
                disabled={authLoading || resendCooldown > 0}
                className="w-full h-11 text-xs font-extrabold mt-1"
              >
                {authLoading ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : resendCooldown > 0 ? (
                  `Wait ${resendCooldown}s to Resend`
                ) : (
                  "Send Password Reset Link"
                )}
              </GlassButton>
              <div className="text-center pt-1.5">
                <button
                  type="button"
                  onClick={() => {
                    setAuthStep("SIGN_IN");
                    setAuthError(null);
                  }}
                  className="text-[11px] text-white/80 hover:text-white inline-flex items-center gap-1 font-medium"
                >
                  <ArrowLeft className="h-3 w-3" /> Back to Sign In
                </button>
              </div>
            </form>
          )}

          {authStep === "RESET_LINK_SENT" && (
            <div className="space-y-3 pt-1 text-center">
              <div className="p-3 rounded-xl bg-emerald-950/60 border border-emerald-400/30 text-[11px] text-emerald-200 leading-relaxed">
                {authSuccessMsg ||
                  "Check your email inbox (and spam folder) for the password reset link."}
              </div>
              <GlassButton
                typeShape="pill"
                onClick={() => {
                  setAuthStep("SIGN_IN");
                  setAuthError(null);
                  setAuthSuccessMsg(null);
                }}
                className="w-full h-11 text-xs font-bold"
              >
                Return to Sign In
              </GlassButton>
            </div>
          )}

          {authStep === "UPDATE_PASSWORD" && (
            <form
              onSubmit={handleUpdateRecoveredPassword}
              className="space-y-3 pt-1"
            >
              {authSuccessMsg && (
                <p className="text-[11px] text-white bg-black/60 p-2.5 rounded-xl border border-white/20 text-center">
                  {authSuccessMsg}
                </p>
              )}
              <div className="space-y-1">
                <label className="text-[11px] font-semibold text-white/90 block">
                  New Password (min. 6 chars)
                </label>
                <Input
                  type="password"
                  required
                  placeholder="••••••••"
                  value={authPassword}
                  onChange={(e) => setAuthPassword(e.target.value)}
                  className="bg-black/70 border-white/25 text-white rounded-xl h-10 text-xs w-full"
                />
              </div>
              <div className="space-y-1">
                <label className="text-[11px] font-semibold text-white/90 block">
                  Confirm New Password
                </label>
                <Input
                  type="password"
                  required
                  placeholder="••••••••"
                  value={authConfirmPassword}
                  onChange={(e) => setAuthConfirmPassword(e.target.value)}
                  className="bg-black/70 border-white/25 text-white rounded-xl h-10 text-xs w-full"
                />
              </div>
              {authError && (
                <p className="text-[11px] text-red-300 bg-red-950/60 p-2.5 rounded-xl border border-red-400/30">
                  {authError}
                </p>
              )}
              <GlassButton
                type="submit"
                typeShape="pill"
                activeWhite={true}
                disabled={authLoading}
                className="w-full h-11 text-xs font-extrabold mt-1"
              >
                {authLoading ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  "Save New Password"
                )}
              </GlassButton>
            </form>
          )}
        </DialogContent>
      </Dialog>

      {/* ================= ACCOUNT SETTINGS MODAL ================= */}
      <Dialog open={isSettingsModalOpen} onOpenChange={setIsSettingsModalOpen}>
        <DialogContent
          style={{
            background:
              "linear-gradient(145deg, rgba(14, 18, 28, 0.94) 0%, rgba(8, 10, 16, 0.98) 100%)",
          }}
          className="glass-container glass-container-rounded border-white/25 text-white sm:max-w-md p-5"
        >
          <DialogHeader>
            <DialogTitle className="text-base font-black text-white">
              Account Settings
            </DialogTitle>
            <DialogDescription className="text-[11px] text-white/75">
              Manage your profile display name and security credentials.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleSaveAccountSettings} className="space-y-3 mt-1">
            <div className="space-y-1">
              <label className="text-[11px] font-semibold text-white/85 block">
                Verified Email Address
              </label>
              <Input
                type="email"
                disabled
                value={user?.email || ""}
                className="bg-black/50 border-white/15 text-white/60 rounded-xl opacity-80 cursor-not-allowed h-10 text-xs"
              />
            </div>
            <div className="space-y-1">
              <label className="text-[11px] font-semibold text-white/85 block">
                Display Name
              </label>
              <Input
                type="text"
                required
                value={editDisplayName}
                onChange={(e) => setEditDisplayName(e.target.value)}
                className="bg-black/70 border-white/25 text-white rounded-xl h-10 text-xs"
              />
            </div>
            <div className="pt-2 border-t border-white/10 space-y-2">
              <div className="flex items-center gap-1.5 text-[11px] font-bold text-white">
                <KeyRound className="h-3 w-3 text-white" />
                <span>Change Password (Optional)</span>
              </div>
              <div className="space-y-1">
                <label className="text-[10px] text-white/75 block">
                  New Password
                </label>
                <Input
                  type="password"
                  placeholder="Leave blank to keep current"
                  value={newPasswordInput}
                  onChange={(e) => setNewPasswordInput(e.target.value)}
                  className="bg-black/70 border-white/25 text-white rounded-xl h-10 text-xs"
                />
              </div>
              {newPasswordInput.length > 0 && (
                <div className="space-y-1">
                  <label className="text-[10px] text-white/75 block">
                    Confirm New Password
                  </label>
                  <Input
                    type="password"
                    placeholder="Confirm new password"
                    value={confirmNewPasswordInput}
                    onChange={(e) => setConfirmNewPasswordInput(e.target.value)}
                    className="bg-black/70 border-white/25 text-white rounded-xl h-10 text-xs"
                  />
                </div>
              )}
            </div>
            {settingsFeedback && (
              <p
                className={`text-[11px] p-2.5 rounded-xl border text-center ${
                  settingsFeedback.type === "success"
                    ? "bg-emerald-950/60 border-emerald-400/30 text-emerald-300"
                    : "bg-red-950/60 border-red-400/30 text-red-300"
                }`}
              >
                {settingsFeedback.text}
              </p>
            )}
            <div className="flex items-center gap-2 pt-1">
              <GlassButton
                type="submit"
                typeShape="pill"
                activeWhite={true}
                disabled={settingsLoading}
                className="flex-1 h-10 text-xs font-extrabold"
              >
                {settingsLoading ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <>
                    <Check className="h-3.5 w-3.5" />
                    <span>Save Changes</span>
                  </>
                )}
              </GlassButton>
              <GlassButton
                typeShape="pill"
                onClick={handleSignOut}
                className="h-10 px-4 text-xs text-red-200"
              >
                Sign Out
              </GlassButton>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* ================= ADMIN UPLOAD MODAL ================= */}
      <Dialog open={isUploadModalOpen} onOpenChange={setIsUploadModalOpen}>
        <DialogContent
          style={{
            background:
              "linear-gradient(145deg, rgba(14, 18, 28, 0.94) 0%, rgba(8, 10, 16, 0.98) 100%)",
          }}
          className="glass-container glass-container-rounded border-white/25 text-white sm:max-w-md p-5"
        >
          <DialogHeader>
            <DialogTitle className="text-base font-black text-white">
              Upload New Wallpaper
            </DialogTitle>
            <DialogDescription className="text-[11px] text-white/75">
              Publish a high-resolution wallpaper to Fusion Wallpapers.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleAdminUpload} className="space-y-3 mt-1">
            <div className="space-y-1">
              <label className="text-[11px] font-semibold text-white/85 block">
                Wallpaper Name
              </label>
              <Input
                type="text"
                required
                placeholder="e.g., Levi Ackerman"
                value={uploadTitle}
                onChange={(e) => setUploadTitle(e.target.value)}
                className="bg-black/70 border-white/25 text-white placeholder:text-white/40 rounded-xl h-10 text-xs"
              />
            </div>
            <div className="space-y-1">
              <label className="text-[11px] font-semibold text-white/85 block">
                Anime Category
              </label>
              <select
                value={uploadCategory}
                onChange={(e) => setUploadCategory(e.target.value)}
                className="w-full h-10 bg-black/70 border border-white/25 text-white text-xs rounded-xl px-3 focus:outline-none"
              >
                <option value="none" className="bg-black text-white">
                  None (Uncategorized)
                </option>
                {animeCategories.map((cat) => (
                  <option
                    key={cat.id}
                    value={cat.id}
                    className="bg-black text-white"
                  >
                    {cat.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-1">
              <label className="text-[11px] font-semibold text-white/85 block">
                Wallpaper Image File
              </label>
              <Input
                type="file"
                accept="image/*"
                required
                onChange={(e) => setUploadFile(e.target.files?.[0] || null)}
                className="bg-black/70 border-white/25 text-white/80 file:bg-white file:text-black file:border-0 file:rounded-lg file:px-2 file:py-1 file:mr-2 file:text-[11px] file:font-bold rounded-xl h-10 py-1 text-xs"
              />
            </div>
            <GlassButton
              type="submit"
              typeShape="pill"
              activeWhite={true}
              disabled={uploading || !uploadFile}
              className="w-full h-11 text-xs font-extrabold mt-1"
            >
              {uploading ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  <span>Uploading...</span>
                </>
              ) : (
                "Publish Wallpaper"
              )}
            </GlassButton>
          </form>
        </DialogContent>
      </Dialog>

      {/* ================= ADMIN EDIT CATEGORY MODAL ================= */}
      <Dialog open={isEditModalOpen} onOpenChange={setIsEditModalOpen}>
        <DialogContent
          style={{
            background:
              "linear-gradient(145deg, rgba(14, 18, 28, 0.94) 0%, rgba(8, 10, 16, 0.98) 100%)",
          }}
          className="glass-container glass-container-rounded border-white/25 text-white sm:max-w-md p-5"
        >
          <DialogHeader>
            <DialogTitle className="text-base font-black text-white">
              Edit Wallpaper Category
            </DialogTitle>
            <DialogDescription className="text-[11px] text-white/75">
              Reassign this wallpaper to a different anime category or set it as
              the banner.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleAdminEditSubmit} className="space-y-3 mt-1">
            <div className="space-y-1">
              <label className="text-[11px] font-semibold text-white/85 block">
                Select Category
              </label>
              <select
                value={editCategorySelection}
                onChange={(e) => setEditCategorySelection(e.target.value)}
                className="w-full h-10 bg-black/70 border border-white/25 text-white text-xs rounded-xl px-3 focus:outline-none"
              >
                <option value="none" className="bg-black text-white">
                  None (Uncategorized)
                </option>
                {animeCategories.map((cat) => (
                  <option
                    key={cat.id}
                    value={cat.id}
                    className="bg-black text-white"
                  >
                    {cat.name}
                  </option>
                ))}
              </select>
            </div>

            <div className="flex items-center gap-2 pt-1">
              <input
                type="checkbox"
                id="setBannerCheck"
                checked={editSetAsBanner}
                onChange={(e) => setEditSetAsBanner(e.target.checked)}
                className="h-4 w-4 rounded border-white/30 text-white focus:ring-white bg-black/50 cursor-pointer"
              />
              <label
                htmlFor="setBannerCheck"
                className="text-xs font-medium text-white cursor-pointer select-none"
              >
                Set as category banner image
              </label>
            </div>

            <GlassButton
              type="submit"
              typeShape="pill"
              activeWhite={true}
              disabled={editingWallpaper}
              className="w-full h-11 text-xs font-extrabold mt-1"
            >
              {editingWallpaper ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  <span>Saving...</span>
                </>
              ) : (
                "Save Changes"
              )}
            </GlassButton>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
