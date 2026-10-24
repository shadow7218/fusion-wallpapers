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

  // VIEW STATES
  const [activeTab, setActiveTab] = useState<"home" | "explore" | "saved" | "profile">("home");
  const [exploreView, setExploreView] = useState<"grid" | "category">("grid");
  const [selectedExploreCategory, setSelectedExploreCategory] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [selectedPillCategory, setSelectedPillCategory] = useState<string>("All");

  const [selectedWallpaper, setSelectedWallpaper] = useState<Wallpaper | null>(null);
  const [isExpanded, setIsExpanded] = useState<boolean>(false);
  const [imageDimensions, setImageDimensions] = useState<{ isWide: boolean; aspectRatio: number }>({ isWide: false, aspectRatio: 9 / 16 });
  const [relatedVisibleCount, setRelatedVisibleCount] = useState<number>(6);

  const [menuOpenWallpaperId, setMenuOpenWallpaperId] = useState<string | null>(null);

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
  const [uploadCategory, setUploadCategory] = useState<string>("none");
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState<boolean>(false);

  const [isEditModalOpen, setIsEditModalOpen] = useState<boolean>(false);
  const [editCategorySelection, setEditCategorySelection] = useState<string>("none");
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
    const handleClickOutside = () => setMenuOpenWallpaperId(null);
    window.addEventListener("click", handleClickOutside);
    return () => window.removeEventListener("click", handleClickOutside);
  }, []);

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
    const fallbackName = currentUser.email?.split("@")[0] || "Shadow";
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
        const defaultName = cleanEmail.split("@")[0] || "Shadow";
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

  const handleShareWallpaper = async (e: React.MouseEvent, wallpaper: Wallpaper) => {
    e.stopPropagation();
    setMenuOpenWallpaperId(null);
    if (navigator.share) {
      try {
        await navigator.share({
          title: wallpaper.title,
          text: `Check out this amazing wallpaper: ${wallpaper.title}`,
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

  const handleAdminUpload = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isAdmin || !uploadFile || !uploadTitle.trim() || uploading) return;
    setUploading(true);

    try {
      const fileExt = uploadFile.name.split(".").pop();
      const prefix = uploadCategory === "none" ? "general" : uploadCategory.toLowerCase();
      const fileName = `${prefix}-${Date.now()}-${Math.random().toString(36).substring(2, 7)}.${fileExt}`;

      const { error: storageError } = await supabase.storage.from("wallpapers").upload(fileName, uploadFile, { cacheControl: "3600", upsert: false });
      if (storageError) throw storageError;

      const { data: { publicUrl } } = supabase.storage.from("wallpapers").getPublicUrl(fileName);

      let isFirst = false;
      if (uploadCategory !== "none") {
        const { data: existingInCategory } = await supabase.from("wallpapers").select("id").eq("category", uploadCategory).limit(1);
        isFirst = !existingInCategory || existingInCategory.length === 0;
      }

      const { error: dbError } = await supabase.from("wallpapers").insert([{
        title: uploadTitle.trim(),
        image_url: publicUrl,
        storage_path: fileName,
        category: uploadCategory === "none" ? null : uploadCategory,
        is_banner: isFirst
      }]);

      if (dbError) {
        const { error: fallbackError } = await supabase.from("wallpapers").insert([{ title: uploadTitle.trim(), image_url: publicUrl, storage_path: fileName, category: null }]);
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
    setMenuOpenWallpaperId(null);
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

  const handleAdminEditSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isAdmin || !selectedWallpaper || editingWallpaper) return;
    setEditingWallpaper(true);

    try {
      const finalCat = editCategorySelection === "none" ? null : editCategorySelection;
      if (editSetAsBanner && finalCat) {
        await supabase.from("wallpapers").update({ is_banner: false }).eq("category", finalCat);
      }
      
      const { error } = await supabase.from("wallpapers").update({
        category: finalCat,
        is_banner: editSetAsBanner && finalCat !== null
      }).eq("id", selectedWallpaper.id);

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
      
      if (activeTab === "explore" && exploreView === "category" && selectedExploreCategory) {
         if (getWallpaperCategory(item) !== selectedExploreCategory) return false;
      }

      if (activeTab === "home" && selectedPillCategory !== "All") {
        const catId = animeCategories.find(c => c.name === selectedPillCategory)?.id;
        if (getWallpaperCategory(item) !== catId) return false;
      }

      const q = searchQuery.trim().toLowerCase();
      if (q) {
        const itemCat = (getWallpaperCategory(item) || "").toLowerCase();
        return item.title.toLowerCase().includes(q) || itemCat.includes(q) || item.storage_path.toLowerCase().includes(q);
      }

      return true;
    });
  }, [wallpapers, activeTab, savedIds, searchQuery, exploreView, selectedExploreCategory, selectedPillCategory]);

  const savedWallpapersList = useMemo(() => wallpapers.filter((w) => savedIds.includes(w.id)), [wallpapers, savedIds]);

  const relatedWallpapers = useMemo(() => {
    if (!selectedWallpaper) return [];
    const currentCat = getWallpaperCategory(selectedWallpaper);
    const others = wallpapers.filter((w) => w.id !== selectedWallpaper.id);
    const scored = others.map((candidate) => {
      let score = 0;
      if (currentCat && getWallpaperCategory(candidate) === currentCat) score += 10;
      return { wallpaper: candidate, score };
    });
    scored.sort((a, b) => b.score - a.score);
    return scored.map((s) => s.wallpaper);
  }, [wallpapers, selectedWallpaper]);

  const renderWallpaperCard = (item: Wallpaper, options?: { showRemoveSavedBtn?: boolean }) => {
    const isSaved = savedIds.includes(item.id);
    const ratio = imageRatios[item.id];
    const isTall = ratio !== undefined && ratio <= 0.57;
    const isMenuOpen = menuOpenWallpaperId === item.id;

    return (
      <div
        key={item.id}
        className="break-inside-avoid mb-2.5 relative flex flex-col"
      >
        <div
          onClick={() => openWallpaperDetail(item)}
          className={`relative w-full overflow-hidden rounded-2xl bg-white/5 border border-white/10 cursor-pointer active:scale-95 transition-transform duration-150 ${isTall ? "aspect-[9/16]" : ""}`}
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
            className={`w-full block pointer-events-none select-none ${isTall ? "h-full object-cover" : "h-auto object-cover"}`}
          />
          <div className="absolute inset-0 z-10 bg-transparent" onContextMenu={(e) => e.preventDefault()} />
        </div>

        <div className="mt-1 px-0.5 flex items-center justify-between relative">
          <h3 className="text-[11px] font-normal text-white/90 truncate max-w-[80%] tracking-tight">
            {item.title}
          </h3>

          <div className="relative">
            <button
              type="button"
              aria-label="Wallpaper options"
              onClick={(e) => {
                e.stopPropagation();
                setMenuOpenWallpaperId(isMenuOpen ? null : item.id);
              }}
              className="h-5 w-5 rounded-md hover:bg-white/10 flex items-center justify-center text-white/80 transition active:scale-90"
            >
              <MoreHorizontal className="h-3 w-3" />
            </button>

            {isMenuOpen && (
              <div 
                className="absolute right-0 bottom-7 z-40 w-36 rounded-xl bg-[#141414] border border-white/15 p-1 shadow-2xl animate-in fade-in duration-100"
                onClick={(e) => e.stopPropagation()}
              >
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    setMenuOpenWallpaperId(null);
                    toggleSaveWallpaper(null, item);
                  }}
                  className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-[11px] font-medium text-white hover:bg-white/10 transition"
                >
                  <Bookmark className={`h-3 w-3 ${isSaved ? "fill-white text-white" : ""}`} />
                  <span>{isSaved ? "Saved" : "Save"}</span>
                </button>

                <button
                  type="button"
                  onClick={(e) => handleShareWallpaper(e, item)}
                  className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-[11px] font-medium text-white hover:bg-white/10 transition"
                >
                  <Share2 className="h-3 w-3" />
                  <span>Share</span>
                </button>

                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    setMenuOpenWallpaperId(null);
                    triggerDirectDownload(item);
                  }}
                  className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-[11px] font-medium text-white hover:bg-white/10 transition"
                >
                  <Download className="h-3 w-3" />
                  <span>Download</span>
                </button>

                {isAdmin && (
                  <button
                    type="button"
                    onClick={(e) => handleAdminDelete(e, item)}
                    className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-[11px] font-medium text-red-400 hover:bg-red-950/40 transition border-t border-white/10 mt-0.5 pt-1"
                  >
                    <Trash2 className="h-3 w-3" />
                    <span>Delete</span>
                  </button>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    );
  };

  const detailRatio = selectedWallpaper ? imageRatios[selectedWallpaper.id] : undefined;
  const detailIsTall = detailRatio !== undefined && detailRatio <= 0.57;

  return (
    <div
      className="min-h-screen bg-[#070707] text-[#E5E4E2] flex flex-col pb-24 relative overflow-x-hidden selection:bg-white selection:text-black font-sans"
      onContextMenu={(e) => e.preventDefault()}
    >
      <div className="pointer-events-none fixed top-0 left-1/2 -translate-x-1/2 w-[500px] h-[200px] bg-white/5 blur-[120px] rounded-full z-0" />

      {/* ================= HEADER ================= */}
      <header className="sticky top-0 z-30 bg-[#070707]/90 px-4 pt-3 pb-2 border-b border-white/10">
        <div className="max-w-5xl mx-auto flex items-center justify-between">
          <button
            type="button"
            onClick={() => {
              setActiveTab("home");
              setSearchQuery("");
              window.scrollTo({ top: 0, behavior: "smooth" });
            }}
            className="flex items-center gap-2 text-left focus:outline-none group active:scale-95 transition-transform"
          >
            {/* LOGO FETCHED FROM PUBLIC FOLDER (/logo.webp) */}
            <div className="h-7 w-7 rounded-xl bg-white/10 border border-white/20 flex items-center justify-center overflow-hidden shrink-0">
              <img
                src="/logo.webp"
                alt="Fusion Logo"
                onError={(e) => { e.currentTarget.style.display = "none"; }}
                className="h-full w-full object-cover"
              />
              <div className="absolute text-white font-black text-xs pointer-events-none">F</div>
            </div>
            <span className="text-base sm:text-lg font-black tracking-[0.2em] text-white uppercase">
              FUSION
            </span>
          </button>

          <div className="flex items-center gap-2">
            {isAdmin && (
              <button
                type="button"
                onClick={() => setIsUploadModalOpen(true)}
                className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-white text-black text-xs font-bold hover:bg-white/90 active:scale-95 transition-transform"
              >
                <Upload className="h-3 w-3" />
                <span>Upload</span>
              </button>
            )}

            {user ? (
              <button
                type="button"
                onClick={() => setActiveTab("profile")}
                className="flex items-center gap-1 px-3 py-1 rounded-full bg-white/10 border border-white/20 text-white text-xs font-semibold hover:border-white/40 active:scale-95 transition-transform"
              >
                <UserIcon className="h-3 w-3 text-white" />
                <span className="max-w-[80px] truncate">{profile?.display_name || "Shadow"}</span>
              </button>
            ) : (
              <button
                type="button"
                onClick={() => requireAuthForAction("Sign in to save wallpapers and unlock full-resolution downloads.", { type: "profile_tab" }, "SIGN_IN")}
                className="flex items-center gap-1 px-3.5 py-1 rounded-full bg-white/10 border border-white/20 text-white text-xs font-semibold hover:border-white/40 active:scale-95 transition-transform"
              >
                <UserIcon className="h-3 w-3 text-white" />
                <span>Sign In</span>
              </button>
            )}
          </div>
        </div>
      </header>

      {/* ================= SEARCH BAR ================= */}
      {(activeTab === "home" || activeTab === "explore") && (
        <div className="max-w-5xl w-full mx-auto px-4 pt-3 pb-2 z-10 space-y-2">
          <div className="relative flex items-center w-full h-11 rounded-full bg-white/10 border border-white/20 px-4 focus-within:border-white/50 transition-all">
            <Search className="h-4 w-4 text-white/60 mr-3 shrink-0" />
            <input
              ref={searchInputRef}
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search wallpapers, anime, moods..."
              className="w-full bg-transparent text-xs sm:text-sm text-white placeholder:text-white/40 focus:outline-none font-medium"
            />
            {searchQuery ? (
              <button type="button" aria-label="Clear search" onClick={() => setSearchQuery("")} className="text-white/70 hover:text-white p-1">
                <X className="h-4 w-4" />
              </button>
            ) : null}
          </div>

          {activeTab === "home" && !searchQuery && (
            <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar pt-1 pb-1">
              {["All", ...animeCategories.map(c => c.name)].map((pillName) => {
                const isActive = selectedPillCategory === pillName;
                return (
                  <button
                    key={pillName}
                    onClick={() => {
                      setSelectedPillCategory(pillName);
                      window.scrollTo({ top: 0, behavior: "smooth" });
                    }}
                    className={`px-3.5 py-1.5 rounded-full text-[11px] font-semibold shrink-0 transition-all active:scale-95 ${
                      isActive
                        ? "bg-white text-black shadow-sm"
                        : "bg-white/10 text-white/80 border border-white/15 hover:border-white/30"
                    }`}
                  >
                    {pillName}
                  </button>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ================= CONTENT AREA ================= */}
      {activeTab === "profile" ? (
        <main className="flex-1 max-w-5xl w-full mx-auto px-4 pt-2 pb-12 z-10">
          {user ? (
            <div className="space-y-6">
              <div className="rounded-3xl bg-white/5 border border-white/15 p-5 sm:p-6 shadow-sm">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div className="flex items-center gap-4">
                    <div className="h-14 w-14 rounded-full bg-gradient-to-br from-white/30 to-white/10 p-[2px] shrink-0">
                      <div className="h-full w-full rounded-full bg-black flex items-center justify-center text-lg font-bold text-white uppercase">
                        {(profile?.display_name || user.email || "U")[0]}
                      </div>
                    </div>

                    <div className="space-y-0.5 min-w-0">
                      <div className="flex items-center gap-2">
                        <h2 className="text-base sm:text-lg font-bold text-white truncate">{profile?.display_name || "Shadow"}</h2>
                        {isAdmin && <span className="text-[9px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-white/20 text-white border border-white/30">Admin</span>}
                      </div>

                      <div className="flex items-center gap-2 text-xs text-white/60">
                        <span className="truncate">{revealFullEmail ? user.email : maskEmailAddress(user.email)}</span>
                        <button type="button" onClick={() => setRevealFullEmail(!revealFullEmail)} className="text-white hover:text-white/80 p-0.5 transition">
                          {revealFullEmail ? <EyeOff className="h-3 w-3" /> : <Eye className="h-3 w-3" />}
                        </button>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2.5">
                    <Button type="button" onClick={() => { setSettingsFeedback(null); setEditDisplayName(profile?.display_name || user.email?.split("@")[0] || ""); setIsSettingsModalOpen(true); }} className="rounded-full bg-white/10 hover:bg-white/20 text-white border border-white/20 text-xs h-9 px-4 active:scale-95 transition-transform">
                      <Settings className="h-3.5 w-3.5 mr-1.5 text-white" /> Settings
                    </Button>
                    <Button type="button" variant="outline" onClick={handleSignOut} className="rounded-full bg-transparent hover:bg-red-950/40 text-red-300 border border-red-500/30 text-xs h-9 px-4 active:scale-95 transition-transform">
                      <LogOut className="h-3.5 w-3.5 mr-1.5" /> Sign Out
                    </Button>
                  </div>
                </div>
              </div>

              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-bold text-white tracking-wide">My Saved Wallpapers</h3>
                  <span className="text-xs text-white/60 font-medium">{savedWallpapersList.length} items</span>
                </div>
                {savedWallpapersList.length === 0 ? (
                  <div className="rounded-3xl bg-white/5 border border-white/10 p-10 text-center max-w-md mx-auto my-4">
                    <Bookmark className="h-8 w-8 text-white mx-auto mb-2 opacity-70" />
                    <p className="text-sm font-semibold text-white">You haven&apos;t saved any wallpapers yet.</p>
                    <p className="text-xs text-white/60 mt-1 mb-4">Tap the 3-dot menu on any wallpaper to save it.</p>
                    <Button type="button" onClick={() => setActiveTab("explore")} className="rounded-full bg-white text-black font-bold px-6 h-10 text-xs active:scale-95 transition-transform">
                      Explore Wallpapers
                    </Button>
                  </div>
                ) : (
                  <div className="columns-2 sm:columns-3 md:columns-4 gap-2.5 space-y-2.5">
                    {savedWallpapersList.map((item) => renderWallpaperCard(item, { showRemoveSavedBtn: true }))}
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div className="rounded-3xl bg-white/5 border border-white/15 p-8 text-center max-w-md mx-auto my-10 shadow-sm">
              <div className="mx-auto h-12 w-12 rounded-full bg-white/10 border border-white/20 flex items-center justify-center mb-4 text-white font-bold text-xl">
                F
              </div>
              <h2 className="text-lg font-bold text-white">Your Fusion Account</h2>
              <p className="text-xs text-white/60 mt-2 leading-relaxed">
                Sign in or create a free account to download high-resolution wallpapers and sync your collection.
              </p>
              <div className="flex gap-3 mt-6">
                <Button type="button" onClick={() => requireAuthForAction("Sign in to access your saved wallpapers.", { type: "profile_tab" }, "SIGN_IN")} className="flex-1 rounded-full bg-white text-black font-bold h-10 text-xs active:scale-95 transition-transform">
                  Sign In
                </Button>
                <Button type="button" variant="outline" onClick={() => requireAuthForAction("Create an account to unlock downloads.", { type: "profile_tab" }, "SIGN_UP")} className="flex-1 rounded-full bg-white/10 text-white border-white/20 hover:bg-white/20 font-bold h-10 text-xs active:scale-95 transition-transform">
                  Create Account
                </Button>
              </div>
            </div>
          )}
        </main>
      ) : activeTab === "explore" && !searchQuery ? (
        <main className="flex-1 max-w-5xl w-full mx-auto px-4 z-10 pb-10">
          {exploreView === "grid" ? (
            <div className="space-y-4 pt-2">
              <div className="flex items-center gap-2">
                <Compass className="h-4 w-4 text-white" />
                <h2 className="text-base font-bold text-white tracking-wide">Explore Anime</h2>
              </div>
              
              <div className="grid grid-cols-2 gap-2.5">
                {animeCategories.map((cat) => {
                  const catWallpapers = wallpapers.filter(w => getWallpaperCategory(w) === cat.id);
                  let banner = catWallpapers.find(w => w.is_banner);
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
                      className="group relative h-28 sm:h-36 rounded-2xl overflow-hidden bg-white/5 border border-white/15 cursor-pointer shadow-sm hover:border-white/40 transition-all flex flex-col justify-end active:scale-95 transition-transform"
                    >
                      <img 
                        src={bannerUrl} 
                        alt={cat.name} 
                        className="absolute inset-0 w-full h-full object-cover transition-transform duration-500 group-hover:scale-105 pointer-events-none select-none"
                      />
                      <div className="absolute inset-0 bg-gradient-to-t from-black/95 via-black/30 to-transparent" />
                      <div className="relative p-2.5">
                        <h3 className="text-xs font-bold text-white tracking-wide truncate">{cat.name}</h3>
                        <p className="text-[9px] text-white/60 mt-0.5">{catWallpapers.length} wallpapers</p>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ) : (
            <div className="space-y-3 pt-2">
              <button 
                onClick={() => setExploreView("grid")}
                className="flex items-center gap-1.5 text-xs font-semibold text-white/70 hover:text-white transition active:scale-95"
              >
                <ArrowLeft className="h-3.5 w-3.5" /> Back to Explore
              </button>
              
              <h2 className="text-lg font-bold text-white tracking-wide">
                {animeCategories.find(c => c.id === selectedExploreCategory)?.name || "Category"}
              </h2>

              {filteredWallpapers.length === 0 ? (
                <div className="bg-white/5 border border-white/10 rounded-3xl p-10 text-center max-w-md mx-auto my-6">
                  <ImageIcon className="h-8 w-8 text-white mx-auto mb-2 opacity-70" />
                  <h3 className="text-sm font-semibold text-white">No Wallpapers Yet</h3>
                  <p className="text-xs text-white/60 mt-1">Admin hasn&apos;t uploaded any wallpapers for this category.</p>
                </div>
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
          {activeTab === "saved" && (
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-xs font-bold text-white tracking-wide uppercase">Saved Wallpapers ({filteredWallpapers.length})</h2>
            </div>
          )}

          {loading ? (
            <div className="columns-2 sm:columns-3 md:columns-4 gap-2.5 space-y-2.5">
              {[220, 160, 200, 240, 180, 210].map((height, idx) => (
                <div key={idx} style={{ height: `${height}px` }} className="break-inside-avoid rounded-2xl bg-white/5 border border-white/10 animate-pulse" />
              ))}
            </div>
          ) : fetchError ? (
            <div className="rounded-3xl bg-white/5 border border-red-500/30 p-6 text-center max-w-md mx-auto my-6">
              <AlertCircle className="h-8 w-8 text-red-400 mx-auto mb-2" />
              <h3 className="text-sm font-bold text-white">Connection Error</h3>
              <p className="text-xs text-white/60 mt-1 mb-3">{fetchError}</p>
              <Button type="button" onClick={fetchWallpapers} className="rounded-full bg-white text-black font-bold px-5 h-9 text-xs active:scale-95 transition-transform">
                <RefreshCw className="h-3.5 w-3.5 mr-1.5" /> Retry
              </Button>
            </div>
          ) : filteredWallpapers.length === 0 ? (
            <div className="bg-white/5 border border-white/10 rounded-3xl p-10 text-center max-w-md mx-auto my-6">
              <div className="mx-auto h-10 w-10 rounded-full bg-white/10 flex items-center justify-center mb-2 text-white font-bold text-sm">F</div>
              <h3 className="text-sm font-semibold text-white">
                {activeTab === "saved" ? "You haven't saved any wallpapers yet." : "No Wallpapers Found"}
              </h3>
              <p className="text-xs text-white/60 mt-1">
                {activeTab === "saved" ? "Tap the 3-dot menu on any wallpaper to save it." : "Try clearing your search or filter."}
              </p>
            </div>
          ) : (
            <div className="columns-2 sm:columns-3 md:columns-4 gap-2.5 space-y-2.5">
              {filteredWallpapers.map((item) => renderWallpaperCard(item))}
            </div>
          )}
        </main>
      )}

      {/* ================= BOTTOM NAVIGATION (NO LAGGY WHITE HIGHLIGHT BOX) ================= */}
      <nav
        aria-label="Primary Bottom Navigation"
        className="fixed bottom-3 left-1/2 -translate-x-1/2 z-40 w-[85%] max-w-xs rounded-full bg-black/75 backdrop-blur-xl border border-white/20 px-5 py-2 shadow-xl"
      >
        <div className="flex items-center justify-between">
          <button type="button" onClick={() => { setActiveTab("home"); setSearchQuery(""); window.scrollTo({ top: 0, behavior: "smooth" }); }} className="flex flex-col items-center gap-0.5 group px-1.5 active:scale-90 transition-transform">
            <Home className={`h-4 w-4 transition ${activeTab === "home" ? "text-white drop-shadow-[0_0_8px_rgba(255,255,255,1)]" : "text-white/40 group-hover:text-white"}`} />
            <span className={`text-[9px] font-semibold tracking-wide ${activeTab === "home" ? "text-white" : "text-white/40"}`}>Home</span>
          </button>
          
          <button type="button" onClick={() => { setActiveTab("explore"); setExploreView("grid"); setSearchQuery(""); window.scrollTo({ top: 0, behavior: "smooth" }); }} className="flex flex-col items-center gap-0.5 group px-1.5 active:scale-90 transition-transform">
            <Compass className={`h-4 w-4 transition ${activeTab === "explore" ? "text-white drop-shadow-[0_0_8px_rgba(255,255,255,1)]" : "text-white/40 group-hover:text-white"}`} />
            <span className={`text-[9px] font-semibold tracking-wide ${activeTab === "explore" ? "text-white" : "text-white/40"}`}>Explore</span>
          </button>
          
          <button type="button" onClick={() => { if (!user) requireAuthForAction("Sign in to view and sync your saved wallpapers across devices.", { type: "saved_tab" }); else { setActiveTab("saved"); window.scrollTo({ top: 0, behavior: "smooth" }); } }} className="flex flex-col items-center gap-0.5 group px-1.5 active:scale-90 transition-transform">
            <Bookmark className={`h-4 w-4 transition ${activeTab === "saved" ? "text-white fill-white drop-shadow-[0_0_8px_rgba(255,255,255,1)]" : "text-white/40 group-hover:text-white"}`} />
            <span className={`text-[9px] font-semibold tracking-wide ${activeTab === "saved" ? "text-white" : "text-white/40"}`}>Saved</span>
          </button>
          
          <button type="button" onClick={() => { setActiveTab("profile"); window.scrollTo({ top: 0, behavior: "smooth" }); }} className="flex flex-col items-center gap-0.5 group px-1.5 active:scale-90 transition-transform">
            <UserIcon className={`h-4 w-4 transition ${activeTab === "profile" ? "text-white drop-shadow-[0_0_8px_rgba(255,255,255,1)]" : "text-white/40 group-hover:text-white"}`} />
            <span className={`text-[9px] font-semibold tracking-wide ${activeTab === "profile" ? "text-white" : "text-white/40"}`}>Profile</span>
          </button>
        </div>
      </nav>

      {/* ================= WALLPAPER DETAIL SCREEN ================= */}
      {selectedWallpaper && (
        <div
          ref={detailScrollRef}
          role="dialog"
          aria-modal="true"
          aria-label={selectedWallpaper.title}
          className="fixed inset-0 z-50 bg-black/95 backdrop-blur-3xl overflow-y-auto animate-in fade-in duration-150"
        >
          <div className="max-w-3xl mx-auto px-4 pt-3 pb-16">
            <div className="sticky top-3 z-30 flex items-center justify-between mb-2">
              {isAdmin ? (
                <button
                  type="button"
                  onClick={() => {
                    setEditCategorySelection(selectedWallpaper.category || "none");
                    setEditSetAsBanner(!!selectedWallpaper.is_banner);
                    setIsEditModalOpen(true);
                  }}
                  className="h-9 px-3.5 rounded-full bg-white/10 border border-white/20 flex items-center gap-1.5 text-white text-[11px] font-bold active:scale-95 transition-transform"
                >
                  <Edit3 className="h-3.5 w-3.5 text-white" /> Edit Category
                </button>
              ) : <div />}
              
              <button
                type="button"
                aria-label="Close detail view"
                onClick={closeWallpaperDetail}
                className="h-9 w-9 rounded-full bg-white/10 border border-white/20 flex items-center justify-center text-white active:scale-90 transition-transform"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div
              className="relative rounded-3xl overflow-hidden bg-white/5 border border-white/15 shadow-2xl flex items-center justify-center mx-auto w-fit max-w-full"
              onContextMenu={(e) => e.preventDefault()}
            >
              <div className={`w-full flex items-center justify-center transition-all duration-300 ${isExpanded ? "max-h-[85vh] overflow-x-auto" : "max-h-[70vh]"}`}>
                <img
                  src={selectedWallpaper.image_url}
                  alt={selectedWallpaper.title}
                  draggable={false}
                  onContextMenu={(e) => e.preventDefault()}
                  className={`block pointer-events-none select-none transition-all duration-300 ${detailIsTall && !isExpanded ? "w-full aspect-[9/16] object-cover sm:w-auto sm:h-[68vh]" : "w-full h-auto object-contain max-h-[75vh]"}`}
                />
              </div>

              <div className="absolute inset-0 z-10 bg-transparent" onContextMenu={(e) => e.preventDefault()} />

              {detailIsTall && !isExpanded && (
                <button
                  type="button"
                  aria-label="Toggle full screen preview"
                  onClick={() => setIsExpanded(true)}
                  className="absolute bottom-4 bg-black/70 backdrop-blur-xl px-4 py-2 rounded-full border border-white/25 flex items-center justify-center text-white text-xs font-bold gap-2 z-20 active:scale-95 transition-transform"
                >
                  <Maximize2 className="h-3.5 w-3.5 text-white" />
                  View Full Wallpaper
                </button>
              )}
              
              {detailIsTall && isExpanded && (
                <button
                  type="button"
                  aria-label="Minimize preview"
                  onClick={() => setIsExpanded(false)}
                  className="absolute bottom-4 right-4 h-9 w-9 bg-black/70 backdrop-blur-xl rounded-full border border-white/25 flex items-center justify-center text-white z-20 active:scale-90 transition-transform"
                >
                  <Minimize2 className="h-3.5 w-3.5 text-white" />
                </button>
              )}
            </div>

            <div className="mt-3.5 text-center sm:text-left">
              <h2 className="text-base sm:text-lg font-bold text-white tracking-wide">{selectedWallpaper.title}</h2>
            </div>

            <div className="mt-3.5 flex flex-col gap-2.5 w-full">
              <Button
                type="button"
                variant="outline"
                onClick={(e) => toggleSaveWallpaper(e, selectedWallpaper)}
                disabled={savingInProgressIds.includes(selectedWallpaper.id)}
                className={`w-full h-12 rounded-2xl font-bold text-xs border transition active:scale-95 ${savedIds.includes(selectedWallpaper.id) ? "bg-white text-black border-white hover:bg-white/90" : "bg-white/10 border-white/20 text-white hover:bg-white/20"}`}
              >
                <Bookmark className={`h-4 w-4 mr-2 ${savedIds.includes(selectedWallpaper.id) ? "fill-black text-black" : ""}`} />
                {savedIds.includes(selectedWallpaper.id) ? "Wallpaper Saved" : "Save Wallpaper"}
              </Button>

              <Button
                type="button"
                onClick={() => triggerDirectDownload(selectedWallpaper)}
                disabled={downloadingId === selectedWallpaper.id}
                className="w-full h-12 rounded-2xl bg-white text-black font-extrabold text-xs hover:bg-white/90 active:scale-95 transition-transform"
              >
                {downloadingId === selectedWallpaper.id ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin mr-2" /> Preparing Original File...
                  </>
                ) : (
                  <>
                    <Download className="h-4 w-4 mr-2" /> Download Wallpaper
                  </>
                )}
              </Button>
            </div>

            {downloadStatus && downloadStatus.id === selectedWallpaper.id && (
              <div className={`mt-3 p-3 rounded-2xl border text-xs flex items-center justify-between backdrop-blur-xl ${downloadStatus.type === "success" ? "bg-emerald-950/70 border-emerald-400/40 text-emerald-200" : "bg-red-950/70 border-red-400/40 text-red-200"}`}>
                <div className="flex items-center gap-2">
                  {downloadStatus.type === "success" ? <CheckCircle2 className="h-4 w-4 text-emerald-400 shrink-0" /> : <AlertCircle className="h-4 w-4 text-red-400 shrink-0" />}
                  <span>{downloadStatus.message}</span>
                </div>
                {downloadStatus.type === "error" && (
                  <button type="button" onClick={() => triggerDirectDownload(selectedWallpaper)} className="underline font-semibold ml-2">Retry</button>
                )}
              </div>
            )}

            <div className="mt-6 pt-4 border-t border-white/10">
              <h3 className="text-xs sm:text-sm font-bold text-white tracking-wide mb-3">Related Wallpapers</h3>
              {relatedWallpapers.length === 0 ? (
                <p className="text-[11px] text-white/50">More wallpapers coming soon.</p>
              ) : (
                <>
                  <div className="columns-2 sm:columns-3 gap-2.5 space-y-2.5">
                    {relatedWallpapers.slice(0, relatedVisibleCount).map((rel) => renderWallpaperCard(rel))}
                  </div>
                  {relatedVisibleCount < relatedWallpapers.length && (
                    <div className="mt-4 text-center">
                      <Button type="button" variant="outline" onClick={() => setRelatedVisibleCount((prev) => prev + 6)} className="rounded-full bg-white/10 border-white/20 text-white hover:bg-white/20 px-4 h-9 active:scale-95 transition-transform text-[11px] font-semibold">
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

      {/* ================= AUTHENTICATION MODAL ================= */}
      <Dialog open={isAuthModalOpen} onOpenChange={setIsAuthModalOpen}>
        <DialogContent className="bg-[#121212]/95 backdrop-blur-3xl border border-white/20 text-white sm:max-w-md rounded-3xl p-5">
          <DialogHeader>
            <div className="mx-auto h-12 w-12 rounded-2xl bg-white/10 border border-white/20 flex items-center justify-center mb-1 text-white font-black text-lg">
              F
            </div>
            <DialogTitle className="text-center text-base font-black text-white">
              {authStep === "FORGOT_PASSWORD" ? "Reset Your Password" : authStep === "RESET_LINK_SENT" ? "Check Your Email" : authStep === "UPDATE_PASSWORD" ? "Set New Password" : authStep === "SIGN_UP" ? "Create Free Account" : "Sign In to Fusion"}
            </DialogTitle>
            <DialogDescription className="text-center text-white/60 text-[11px]">
              {authStep === "FORGOT_PASSWORD" ? "Enter your account email to receive a reset link." : authStep === "RESET_LINK_SENT" ? "Follow the reset link sent to your inbox." : authStep === "UPDATE_PASSWORD" ? "Choose a strong new password." : authReason}
            </DialogDescription>
          </DialogHeader>

          {(authStep === "SIGN_IN" || authStep === "SIGN_UP") && (
            <div className="grid grid-cols-2 gap-1.5 p-1 rounded-full bg-black/60 border border-white/15 mt-1">
              <button type="button" onClick={() => { setAuthStep("SIGN_IN"); setAuthError(null); setAuthSuccessMsg(null); }} className={`py-1.5 rounded-full text-[11px] font-bold transition active:scale-95 ${authStep === "SIGN_IN" ? "bg-white text-black shadow-sm" : "text-white/60 hover:text-white"}`}>Sign In</button>
              <button type="button" onClick={() => { setAuthStep("SIGN_UP"); setAuthError(null); setAuthSuccessMsg(null); }} className={`py-1.5 rounded-full text-[11px] font-bold transition active:scale-95 ${authStep === "SIGN_UP" ? "bg-white text-black shadow-sm" : "text-white/60 hover:text-white"}`}>Create Account</button>
            </div>
          )}

          {authStep === "SIGN_IN" && (
            <form onSubmit={handleSignInSubmit} className="space-y-3 pt-1">
              {authSuccessMsg && <p className="text-[11px] text-emerald-300 bg-emerald-950/60 p-2.5 rounded-xl border border-emerald-400/30 text-center">{authSuccessMsg}</p>}
              <div className="space-y-1">
                <label className="text-[11px] font-semibold text-white/70 block">Email Address</label>
                <div className="relative">
                  <Mail className="h-3.5 w-3.5 text-white/40 absolute left-3.5 top-3.5" />
                  <Input type="email" required placeholder="you@example.com" value={authEmail} onChange={(e) => setAuthEmail(e.target.value)} className="pl-10 bg-black/50 border-white/20 text-white placeholder:text-white/30 rounded-xl h-10 text-xs w-full focus:border-white/50" />
                </div>
              </div>
              <div className="space-y-1">
                <div className="flex items-center justify-between">
                  <label className="text-[11px] font-semibold text-white/70">Password</label>
                  <button type="button" onClick={() => { setAuthStep("FORGOT_PASSWORD"); setAuthError(null); setAuthSuccessMsg(null); }} className="text-[11px] text-white hover:underline font-medium">Forgot password?</button>
                </div>
                <Input type="password" required placeholder="••••••••" value={authPassword} onChange={(e) => setAuthPassword(e.target.value)} className="bg-black/50 border-white/20 text-white placeholder:text-white/30 rounded-xl h-10 text-xs w-full focus:border-white/50" />
              </div>
              {authError && <p className="text-[11px] text-red-300 bg-red-950/60 p-2.5 rounded-xl border border-red-400/30">{authError}</p>}
              <Button type="submit" disabled={authLoading} className="w-full h-11 rounded-xl bg-white text-black font-extrabold text-xs shadow-md hover:bg-white/90 active:scale-95 transition-transform mt-1">
                {authLoading ? <Loader2 className="h-4 w-4 animate-spin mx-auto" /> : "Log In"}
              </Button>
            </form>
          )}

          {authStep === "SIGN_UP" && (
            <form onSubmit={handleSignUpSubmit} className="space-y-2.5 pt-1">
              <div className="space-y-1">
                <label className="text-[11px] font-semibold text-white/70 block">Email Address</label>
                <div className="relative">
                  <Mail className="h-3.5 w-3.5 text-white/40 absolute left-3.5 top-3.5" />
                  <Input type="email" required placeholder="you@example.com" value={authEmail} onChange={(e) => setAuthEmail(e.target.value)} className="pl-10 bg-black/50 border-white/20 text-white placeholder:text-white/30 rounded-xl h-10 text-xs w-full focus:border-white/50" />
                </div>
              </div>
              <div className="space-y-1">
                <label className="text-[11px] font-semibold text-white/70 block">Create Password (min. 6 chars)</label>
                <Input type="password" required placeholder="••••••••" value={authPassword} onChange={(e) => setAuthPassword(e.target.value)} className="bg-black/50 border-white/20 text-white placeholder:text-white/30 rounded-xl h-10 text-xs w-full focus:border-white/50" />
              </div>
              <div className="space-y-1">
                <label className="text-[11px] font-semibold text-white/70 block">Confirm Password</label>
                <Input type="password" required placeholder="••••••••" value={authConfirmPassword} onChange={(e) => setAuthConfirmPassword(e.target.value)} className="bg-black/50 border-white/20 text-white placeholder:text-white/30 rounded-xl h-10 text-xs w-full focus:border-white/50" />
              </div>
              {authError && <p className="text-[11px] text-red-300 bg-red-950/60 p-2.5 rounded-xl border border-red-400/30">{authError}</p>}
              <Button type="submit" disabled={authLoading} className="w-full h-11 rounded-xl bg-white text-black font-extrabold text-xs shadow-md hover:bg-white/90 active:scale-95 transition-transform mt-1">
                {authLoading ? <Loader2 className="h-4 w-4 animate-spin mx-auto" /> : "Sign Up"}
              </Button>
            </form>
          )}

          {authStep === "FORGOT_PASSWORD" && (
            <form onSubmit={handleForgotPasswordSubmit} className="space-y-3 pt-1">
              <div className="space-y-1">
                <label className="text-[11px] font-semibold text-white/70 block">Account Email Address</label>
                <div className="relative">
                  <Mail className="h-3.5 w-3.5 text-white/40 absolute left-3.5 top-3.5" />
                  <Input type="email" required placeholder="you@example.com" value={authEmail} onChange={(e) => setAuthEmail(e.target.value)} className="pl-10 bg-black/50 border-white/20 text-white placeholder:text-white/30 rounded-xl h-10 text-xs w-full focus:border-white/50" />
                </div>
              </div>
              {authError && <p className="text-[11px] text-red-300 bg-red-950/60 p-2.5 rounded-xl border border-red-400/30">{authError}</p>}
              <Button type="submit" disabled={authLoading || resendCooldown > 0} className="w-full h-11 rounded-xl bg-white text-black font-extrabold text-xs shadow-md hover:bg-white/90 active:scale-95 transition-transform mt-1">
                {authLoading ? <Loader2 className="h-4 w-4 animate-spin mx-auto" /> : resendCooldown > 0 ? `Wait ${resendCooldown}s to Resend` : "Send Password Reset Link"}
              </Button>
              <div className="text-center pt-1.5">
                <button type="button" onClick={() => { setAuthStep("SIGN_IN"); setAuthError(null); }} className="text-[11px] text-white/70 hover:text-white inline-flex items-center gap-1 font-medium">
                  <ArrowLeft className="h-3 w-3" /> Back to Sign In
                </button>
              </div>
            </form>
          )}

          {authStep === "RESET_LINK_SENT" && (
            <div className="space-y-3 pt-1 text-center">
              <div className="p-3 rounded-xl bg-emerald-950/60 border border-emerald-400/30 text-[11px] text-emerald-200 leading-relaxed">
                {authSuccessMsg || "Check your email inbox (and spam folder) for the password reset link."}
              </div>
              <Button type="button" onClick={() => { setAuthStep("SIGN_IN"); setAuthError(null); setAuthSuccessMsg(null); }} className="w-full h-11 rounded-xl bg-white/10 hover:bg-white/20 text-white border border-white/20 font-bold text-xs active:scale-95 transition-transform">
                Return to Sign In
              </Button>
            </div>
          )}

          {authStep === "UPDATE_PASSWORD" && (
            <form onSubmit={handleUpdateRecoveredPassword} className="space-y-3 pt-1">
              {authSuccessMsg && <p className="text-[11px] text-white bg-black/60 p-2.5 rounded-xl border border-white/20 text-center">{authSuccessMsg}</p>}
              <div className="space-y-1">
                <label className="text-[11px] font-semibold text-white/70 block">New Password (min. 6 chars)</label>
                <Input type="password" required placeholder="••••••••" value={authPassword} onChange={(e) => setAuthPassword(e.target.value)} className="bg-black/50 border-white/20 text-white rounded-xl h-10 text-xs w-full focus:border-white/50" />
              </div>
              <div className="space-y-1">
                <label className="text-[11px] font-semibold text-white/70 block">Confirm New Password</label>
                <Input type="password" required placeholder="••••••••" value={authConfirmPassword} onChange={(e) => setAuthConfirmPassword(e.target.value)} className="bg-black/50 border-white/20 text-white rounded-xl h-10 text-xs w-full focus:border-white/50" />
              </div>
              {authError && <p className="text-[11px] text-red-300 bg-red-950/60 p-2.5 rounded-xl border border-red-400/30">{authError}</p>}
              <Button type="submit" disabled={authLoading} className="w-full h-11 rounded-xl bg-white text-black font-extrabold text-xs shadow-md hover:bg-white/90 active:scale-95 transition-transform mt-1">
                {authLoading ? <Loader2 className="h-4 w-4 animate-spin mx-auto" /> : "Save New Password"}
              </Button>
            </form>
          )}
        </DialogContent>
      </Dialog>

      {/* ================= ACCOUNT SETTINGS MODAL ================= */}
      <Dialog open={isSettingsModalOpen} onOpenChange={setIsSettingsModalOpen}>
        <DialogContent className="bg-[#121212]/95 backdrop-blur-3xl border border-white/20 text-white sm:max-w-md rounded-3xl p-5">
          <DialogHeader>
            <DialogTitle className="text-base font-black text-white">Account Settings</DialogTitle>
            <DialogDescription className="text-[11px] text-white/60">Manage your profile display name and security credentials.</DialogDescription>
          </DialogHeader>

          <form onSubmit={handleSaveAccountSettings} className="space-y-3 mt-1">
            <div className="space-y-1">
              <label className="text-[11px] font-semibold text-white/70 block">Verified Email Address</label>
              <Input type="email" disabled value={user?.email || ""} className="bg-black/40 border-white/10 text-white/60 rounded-xl opacity-80 cursor-not-allowed h-10 text-xs" />
            </div>
            <div className="space-y-1">
              <label className="text-[11px] font-semibold text-white/70 block">Display Name</label>
              <Input type="text" required value={editDisplayName} onChange={(e) => setEditDisplayName(e.target.value)} className="bg-black/50 border-white/20 text-white rounded-xl h-10 text-xs focus:border-white/50" />
            </div>
            <div className="pt-2 border-t border-white/10 space-y-2">
              <div className="flex items-center gap-1.5 text-[11px] font-bold text-white">
                <KeyRound className="h-3 w-3 text-white" /> <span>Change Password (Optional)</span>
              </div>
              <div className="space-y-1">
                <label className="text-[10px] text-white/60 block">New Password</label>
                <Input type="password" placeholder="Leave blank to keep current" value={newPasswordInput} onChange={(e) => setNewPasswordInput(e.target.value)} className="bg-black/50 border-white/20 text-white rounded-xl h-10 text-xs focus:border-white/50" />
              </div>
              {newPasswordInput.length > 0 && (
                <div className="space-y-1">
                  <label className="text-[10px] text-white/60 block">Confirm New Password</label>
                  <Input type="password" placeholder="Confirm new password" value={confirmNewPasswordInput} onChange={(e) => setConfirmNewPasswordInput(e.target.value)} className="bg-black/50 border-white/20 text-white rounded-xl h-10 text-xs focus:border-white/50" />
                </div>
              )}
            </div>
            {settingsFeedback && (
              <p className={`text-[11px] p-2.5 rounded-xl border text-center ${settingsFeedback.type === "success" ? "bg-emerald-950/60 border-emerald-400/30 text-emerald-300" : "bg-red-950/60 border-red-400/30 text-red-300"}`}>
                {settingsFeedback.text}
              </p>
            )}
            <div className="flex items-center gap-2 pt-1">
              <Button type="submit" disabled={settingsLoading} className="flex-1 rounded-xl bg-white text-black font-extrabold h-10 text-xs hover:bg-white/90 active:scale-95 transition-transform">
                {settingsLoading ? <Loader2 className="h-4 w-4 animate-spin mx-auto" /> : <><Check className="h-3.5 w-3.5 mr-1.5" /> Save Changes</>}
              </Button>
              <Button type="button" variant="outline" onClick={handleSignOut} className="rounded-xl bg-transparent border-red-500/30 text-red-300 hover:bg-red-950/40 h-10 px-3.5 text-xs active:scale-95 transition-transform">
                Sign Out
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* ================= ADMIN UPLOAD MODAL ================= */}
      <Dialog open={isUploadModalOpen} onOpenChange={setIsUploadModalOpen}>
        <DialogContent className="bg-[#121212]/95 backdrop-blur-3xl border border-white/20 text-white sm:max-w-md rounded-3xl p-5">
          <DialogHeader>
            <DialogTitle className="text-base font-black text-white">Upload New Wallpaper</DialogTitle>
            <DialogDescription className="text-[11px] text-white/60">Publish a high-resolution wallpaper to Fusion Wallpapers.</DialogDescription>
          </DialogHeader>

          <form onSubmit={handleAdminUpload} className="space-y-3 mt-1">
            <div className="space-y-1">
              <label className="text-[11px] font-semibold text-white/70 block">Wallpaper Name</label>
              <Input type="text" required placeholder="e.g., Midnight Summit" value={uploadTitle} onChange={(e) => setUploadTitle(e.target.value)} className="bg-black/50 border-white/20 text-white placeholder:text-white/30 rounded-xl h-10 text-xs focus:border-white/50" />
            </div>
            <div className="space-y-1">
              <label className="text-[11px] font-semibold text-white/70 block">Anime Category</label>
              <select
                value={uploadCategory}
                onChange={(e) => setUploadCategory(e.target.value)}
                className="w-full h-10 bg-black/50 border border-white/20 text-white text-xs rounded-xl px-3 focus:outline-none focus:border-white/50"
              >
                <option value="none" className="bg-black text-white">None (Uncategorized)</option>
                {animeCategories.map(cat => (
                  <option key={cat.id} value={cat.id} className="bg-black text-white">{cat.name}</option>
                ))}
              </select>
            </div>
            <div className="space-y-1">
              <label className="text-[11px] font-semibold text-white/70 block">Wallpaper Image File</label>
              <Input type="file" accept="image/*" required onChange={(e) => setUploadFile(e.target.files?.[0] || null)} className="bg-black/50 border-white/20 text-white/80 file:bg-white file:text-black file:border-0 file:rounded-lg file:px-2 file:py-1 file:mr-2 file:text-[11px] file:font-bold rounded-xl h-10 py-1 text-xs" />
            </div>
            <Button type="submit" disabled={uploading || !uploadFile} className="w-full h-11 rounded-xl bg-white text-black font-extrabold text-xs shadow-md hover:bg-white/90 active:scale-95 transition-transform mt-1">
              {uploading ? <><Loader2 className="h-4 w-4 animate-spin mr-2" /> Uploading...</> : "Publish Wallpaper"}
            </Button>
          </form>
        </DialogContent>
      </Dialog>

      {/* ================= ADMIN EDIT CATEGORY MODAL ================= */}
      <Dialog open={isEditModalOpen} onOpenChange={setIsEditModalOpen}>
        <DialogContent className="bg-[#121212]/95 backdrop-blur-3xl border border-white/20 text-white sm:max-w-md rounded-3xl p-5">
          <DialogHeader>
            <DialogTitle className="text-base font-black text-white">Edit Wallpaper Category</DialogTitle>
            <DialogDescription className="text-[11px] text-white/60">Reassign this wallpaper to a different anime category or set it as the banner.</DialogDescription>
          </DialogHeader>

          <form onSubmit={handleAdminEditSubmit} className="space-y-3 mt-1">
            <div className="space-y-1">
              <label className="text-[11px] font-semibold text-white/70 block">Select Category</label>
              <select
                value={editCategorySelection}
                onChange={(e) => setEditCategorySelection(e.target.value)}
                className="w-full h-10 bg-black/50 border border-white/20 text-white text-xs rounded-xl px-3 focus:outline-none focus:border-white/50"
              >
                <option value="none" className="bg-black text-white">None (Uncategorized)</option>
                {animeCategories.map(cat => (
                  <option key={cat.id} value={cat.id} className="bg-black text-white">{cat.name}</option>
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
              <label htmlFor="setBannerCheck" className="text-xs font-medium text-white cursor-pointer select-none">
                Set as category banner image
              </label>
            </div>

            <Button type="submit" disabled={editingWallpaper} className="w-full h-11 rounded-xl mt-1 bg-white text-black font-extrabold text-xs shadow-md hover:bg-white/90 active:scale-95 transition-transform">
              {editingWallpaper ? <><Loader2 className="h-4 w-4 animate-spin mr-2" /> Saving...</> : "Save Changes"}
            </Button>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
