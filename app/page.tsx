"use client";

import React, { useEffect, useState, useRef, useMemo } from "react";
import { useRouter } from "next/navigation";
import { db, type Wallpaper, type AppUser } from "@/lib/db";
import {
  Download,
  LogOut,
  User as UserIcon,
  Loader2,
  Trash2,
  Bookmark,
  Home,
  Compass,
  Check,
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
  ChevronRight,
  ExternalLink,
  Flame,
} from "lucide-react";
import { Input } from "@/components/ui/input";
import PasswordInput from "@/components/PasswordInput";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

import { animeCategories } from "../config/animeCategories";
import { groupBatches, makeBatchTags, getBatchId } from "@/lib/batch";
import { img } from "@/lib/img";
import { AvatarBadge, AVATARS } from "@/components/avatars";
import OAuthButtons from "@/components/OAuthButtons";
import SlidingNav from "@/components/SlidingNav";
import {
  GlassContainer,
  GlassButton,
  LiquidGlassShaderDefs,
} from "@/components/liquid-glass/LiquidGlass";

import Header from "@/components/fusion/Header";
import SearchBar from "@/components/fusion/SearchBar";
import CategoryPills from "@/components/fusion/CategoryPills";
import Footer from "@/components/fusion/Footer";

interface UserProfile {
  id: string;
  display_name: string;
}

interface PendingIntent {
  type: "download" | "save" | "saved_tab" | "profile_tab";
  wallpaper?: Wallpaper;
}

interface LocalCurationOverride {
  isHero?: boolean;
  top10Rank?: number | null;
}

interface PendingUpload {
  id: string;
  previewUrl: string;
  ratio: number;
  title: string;
  failed?: boolean;
}

type AuthStep =
  | "SIGN_IN"
  | "SIGN_UP"
  | "FORGOT_PASSWORD"
  | "RESET_LINK_SENT"
  | "UPDATE_PASSWORD";

const HERO_TAG = "__pc_hero__";
const TOP10_TAG_PREFIX = "__top10_";
const PHONE_TAG = "__device_phone__";
const PC_TAG = "__device_pc__";
const getDevice = (w: Wallpaper): "phone" | "pc" | null => {
  const t = Array.isArray(w.tags) ? w.tags : [];
  return t.includes(PHONE_TAG) ? "phone" : t.includes(PC_TAG) ? "pc" : null;
};

const OFFICIAL_FUSION_SOCIALS = [
  {
    id: "fusion-bio",
    name: "Fusion Official Socials",
    handle: "fusion-bio.vercel.app",
    url: "https://fusion-bio.vercel.app/",
    cta: "Open",
  },
];

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

function extractCurationFromWallpaper(
  w: Wallpaper,
  overrides: Record<string, LocalCurationOverride>
): { isHero: boolean; top10Rank: number | null } {
  const tags = Array.isArray(w.tags) ? w.tags : [];
  let isHero = tags.includes(HERO_TAG);
  let top10Rank: number | null = null;

  for (const t of tags) {
    if (t.startsWith(TOP10_TAG_PREFIX) && t.endsWith("__")) {
      const num = parseInt(
        t.slice(TOP10_TAG_PREFIX.length, t.length - 2),
        10
      );
      if (!Number.isNaN(num) && num >= 1 && num <= 10) {
        top10Rank = num;
      }
    }
  }

  const local = overrides[w.id];
  if (local) {
    if (local.isHero !== undefined) isHero = local.isHero;
    if (local.top10Rank !== undefined) top10Rank = local.top10Rank;
  }

  return { isHero, top10Rank };
}

function buildUpdatedTags(
  existingTags: string[] | null | undefined,
  isHero: boolean,
  top10Rank: number | null
): string[] {
  const base = Array.isArray(existingTags)
    ? existingTags.filter(
        (t) => t !== HERO_TAG && !t.startsWith(TOP10_TAG_PREFIX)
      )
    : [];
  if (isHero) base.push(HERO_TAG);
  if (top10Rank && top10Rank >= 1 && top10Rank <= 10) {
    base.push(`${TOP10_TAG_PREFIX}${top10Rank}__`);
  }
  return base;
}

export default function FusionWallpapersApp() {
  const router = useRouter();
  const searchInputRef = useRef<HTMLInputElement>(null);
  const detailScrollRef = useRef<HTMLDivElement>(null);
  const top10ScrollRef = useRef<HTMLDivElement>(null);

  const [wallpapers, setWallpapers] = useState<Wallpaper[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [fetchError, setFetchError] = useState<string | null>(null);

  const [theme, setTheme] = useState<"dark" | "light">("dark");
  const themeLoaded = useRef(false);

  const [curationOverrides, setCurationOverrides] = useState<
    Record<string, LocalCurationOverride>
  >({});

  const [imageRatios, setImageRatios] = useState<Record<string, number>>({});
  const [pendingUploads, setPendingUploads] = useState<PendingUpload[]>([]);
  const [colCount, setColCount] = useState<number>(2);
  const [lastSkel, setLastSkel] = useState<number[]>([0.56, 1.5, 0.75, 0.56, 1.2, 0.75]);
  const sessionSeed = useRef<number>(Math.random());
  const frozenRatios = useRef<Record<string, number>>({});

  const [user, setUser] = useState<AppUser | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [savedIds, setSavedIds] = useState<string[]>([]);
  const [savingInProgressIds, setSavingInProgressIds] = useState<string[]>([]);
  const [revealFullEmail, setRevealFullEmail] = useState<boolean>(false);
  const [isAdmin, setIsAdmin] = useState<boolean>(false);

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
  const [detailSrc, setDetailSrc] = useState<{ id: string; src: string } | null>(null);
  const [relatedVisibleCount, setRelatedVisibleCount] = useState<number>(6);
  const [detailClosing, setDetailClosing] = useState<boolean>(false);

  const pillRefs = useRef<Record<string, HTMLButtonElement | null>>({});
  const [pillBox, setPillBox] = useState<{ left: number; width: number } | null>(null);

  useEffect(() => {
    const el = pillRefs.current[selectedPillCategory];
    if (el) setPillBox({ left: el.offsetLeft, width: el.offsetWidth });
  }, [selectedPillCategory, activeTab, searchQuery]);

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

  // ADMIN UPLOAD STATES
  const [isUploadModalOpen, setIsUploadModalOpen] = useState<boolean>(false);
  const [uploadTitle, setUploadTitle] = useState<string>("");
  const [uploadCategory, setUploadCategory] = useState<string>("none");
  const [uploadFiles, setUploadFiles] = useState<{ id: string; file: File; url: string }[]>([]);
  const [batchIndex, setBatchIndex] = useState<Record<string, number>>({});
  const [slideAnim, setSlideAnim] = useState<Record<string, { from: Wallpaper; dir: 1 | -1; n: number }>>({});
  const [detailDir, setDetailDir] = useState<0 | 1 | -1>(0);
  const [detailSlides, setDetailSlides] = useState<Wallpaper[] | null>(null);
  const [menuSlides, setMenuSlides] = useState<Wallpaper[] | null>(null);
  const [downloadChoice, setDownloadChoice] = useState<{ current: Wallpaper; slides: Wallpaper[] } | null>(null);
  const swipeStart = useRef<{ x: number; y: number } | null>(null);
  const justSwiped = useRef<number>(0);
  const [migrateMsg, setMigrateMsg] = useState<string>("");
  const [uploadShowInHero, setUploadShowInHero] = useState<boolean>(false);
  const [uploadTop10Rank, setUploadTop10Rank] = useState<string>("none");
  const [uploading, setUploading] = useState<boolean>(false);

  // ADMIN EDIT STATES
  const [isEditModalOpen, setIsEditModalOpen] = useState<boolean>(false);
  const [editCategorySelection, setEditCategorySelection] =
    useState<string>("none");
  const [editSetAsBanner, setEditSetAsBanner] = useState<boolean>(false);
  const [editShowInHero, setEditShowInHero] = useState<boolean>(false);
  const [editTop10Rank, setEditTop10Rank] = useState<string>("none");
  const [editingWallpaper, setEditingWallpaper] = useState<boolean>(false);

  const [pcHeroIndex, setPcHeroIndex] = useState<number>(0);

  const isLight = theme === "light";

  useEffect(() => {
    if (!user) {
      setIsAdmin(false);
      return;
    }
    db.checkIsAdmin(user.email || user.id).then(setIsAdmin);
  }, [user]);

  useEffect(() => {
    const saved = localStorage.getItem("fusion-theme");
    if (saved === "light" || saved === "dark") setTheme(saved);
    themeLoaded.current = true;
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      const savedOverrides = localStorage.getItem("fusion-curation-overrides");
      if (savedOverrides) {
        setCurationOverrides(JSON.parse(savedOverrides));
      }
    } catch {
      // Ignore parse errors
    }
  }, []);

  useEffect(() => {
    try {
      const r = JSON.parse(localStorage.getItem("fusion_ratios_v1") || "{}");
      setImageRatios((prev) => ({ ...r, ...prev }));
      const s = JSON.parse(localStorage.getItem("fusion_skel_v1") || "[]");
      if (Array.isArray(s) && s.length >= 4) setLastSkel(s);
    } catch {}
    const onResize = () =>
      setColCount(
        window.innerWidth >= 1280
          ? 5
          : window.innerWidth >= 1024
          ? 4
          : window.innerWidth >= 640
          ? 3
          : 2
      );
    onResize();
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  useEffect(() => {
    const t = setTimeout(() => {
      try {
        if (Object.keys(imageRatios).length)
          localStorage.setItem("fusion_ratios_v1", JSON.stringify(imageRatios));
      } catch {}
    }, 600);
    return () => clearTimeout(t);
  }, [imageRatios]);

  useEffect(() => {
    const r = wallpapers.slice(0, 8).map((w) => imageRatios[w.id]).filter(Boolean);
    if (r.length >= 4) {
      try { localStorage.setItem("fusion_skel_v1", JSON.stringify(r)); } catch {}
    }
  }, [wallpapers, imageRatios]);

  useEffect(() => {
    let hiddenAt = 0;
    const onVis = () => {
      if (document.hidden) hiddenAt = Date.now();
      else if (hiddenAt && Date.now() - hiddenAt > 60000) fetchWallpapers(true);
    };
    document.addEventListener("visibilitychange", onVis);
    return () => document.removeEventListener("visibilitychange", onVis);
  }, []);

  useEffect(() => {
    if (typeof document === "undefined") return;
    const htmlEl = document.documentElement;
    const bodyEl = document.body;
    if (theme === "light") {
      htmlEl.classList.add("theme-light");
      bodyEl.classList.add("theme-light");
    } else {
      htmlEl.classList.remove("theme-light");
      bodyEl.classList.remove("theme-light");
    }
    if (themeLoaded.current) localStorage.setItem("fusion-theme", theme);
  }, [theme]);

  useEffect(() => {
    const init = async () => {
      await fetchWallpapers();
      const currentUser = await db.getCurrentUser();
      setUser(currentUser);
      if (currentUser) {
        await Promise.all([
          fetchUserProfile(currentUser),
          fetchSavedWallpapers(currentUser.id),
        ]);
      }
    };
    init();

    const unsubscribe = db.onAuthChange(async ({ type, user: currentUser }) => {
      setUser(currentUser);
      if (type === "PASSWORD_RECOVERY") {
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

    return () => unsubscribe();
  }, []);

  const pcHeroWallpapers = useMemo(() => {
    if (wallpapers.length === 0) return [];
    const adminChosen = wallpapers.filter(
      (w) => extractCurationFromWallpaper(w, curationOverrides).isHero
    );
    if (adminChosen.length > 0) return adminChosen;
    return wallpapers.slice(0, 5);
  }, [wallpapers, curationOverrides]);

  useEffect(() => {
    if (pcHeroWallpapers.length <= 1) return;
    const timer = setInterval(() => {
      setPcHeroIndex((prev) => (prev + 1) % pcHeroWallpapers.length);
    }, 5500);
    return () => clearInterval(timer);
  }, [pcHeroWallpapers.length]);

  useEffect(() => {
    if (pcHeroIndex >= pcHeroWallpapers.length && pcHeroWallpapers.length > 0) {
      setPcHeroIndex(0);
    }
  }, [pcHeroWallpapers.length, pcHeroIndex]);

  const handlePrevHero = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (pcHeroWallpapers.length === 0) return;
    setPcHeroIndex(
      (prev) => (prev - 1 + pcHeroWallpapers.length) % pcHeroWallpapers.length
    );
  };

  const handleNextHero = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (pcHeroWallpapers.length === 0) return;
    setPcHeroIndex((prev) => (prev + 1) % pcHeroWallpapers.length);
  };

  const scrollTop10Row = (direction: "left" | "right") => {
    if (!top10ScrollRef.current) return;
    const scrollAmount = direction === "left" ? -420 : 420;
    top10ScrollRef.current.scrollBy({
      left: scrollAmount,
      behavior: "smooth",
    });
  };

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
      if (selectedWallpaper) closeWallpaperDetail();
    };
    window.addEventListener("popstate", handlePopState);
    return () => window.removeEventListener("popstate", handlePopState);
  }, [selectedWallpaper]);

  useEffect(() => {
    setDetailSrc(null);
    if (!selectedWallpaper) return;
    const wid = selectedWallpaper.id;
    const full = img(selectedWallpaper.image_url, 1200);
    const loader = new Image();
    loader.onload = () => setDetailSrc({ id: wid, src: full });
    loader.src = full;
    return () => {
      loader.onload = null;
    };
  }, [selectedWallpaper]);

  const openWallpaperDetail = (wallpaper: Wallpaper, slides?: Wallpaper[]) => {
    setActiveMenu(null);
    const apply = () => {
      setSelectedWallpaper(wallpaper);
      setDetailSlides(slides && slides.length > 1 ? slides : null);
      setRelatedVisibleCount(Math.max(8, colCount * 2));
      setDownloadStatus(null);
      setIsExpanded(false);
      setDetailDir(0);
    };
    const el = detailScrollRef.current;

    if (selectedWallpaper && el) {
      el.scrollTo({ top: 0, behavior: "smooth" });
      if (el.scrollTop < 260) {
        apply();
      } else {
        const t0 = performance.now();
        const tick = () => {
          if (el.scrollTop < 260 || performance.now() - t0 > 900) apply();
          else requestAnimationFrame(tick);
        };
        requestAnimationFrame(tick);
      }
      return;
    }

    window.history.pushState({ wallpaperId: wallpaper.id }, "");
    apply();
    if (el) el.scrollTo({ top: 0 });
  };

  const closeWallpaperDetail = () => {
    setDetailClosing(true);
    setTimeout(() => {
      setSelectedWallpaper(null);
      setDetailSlides(null);
      setDownloadStatus(null);
      setIsExpanded(false);
      setDetailClosing(false);
    }, 180);
  };

  const deepLinkHandled = useRef(false);
  useEffect(() => {
    if (deepLinkHandled.current || loading) return;
    deepLinkHandled.current = true;
    const id = new URLSearchParams(window.location.search).get("w");
    if (!id) return;
    window.history.replaceState({}, "", "/");
    (async () => {
      let w = wallpapers.find((x) => String(x.id) === id) ?? null;
      if (!w) {
        w = await db.getWallpaper(id);
      }
      if (w) openWallpaperDetail(w);
    })();
  }, [loading, wallpapers]);

  const fetchWallpapers = async (silent = false) => {
    if (!silent) setLoading(true);
    setFetchError(null);
    try {
      setWallpapers(await db.listWallpapers());
    } catch (err: any) {
      setFetchError(err.message || "Could not load wallpapers.");
    } finally {
      setLoading(false);
    }
  };

  const fetchUserProfile = async (currentUser: AppUser) => {
    const fallbackName = currentUser.email?.split("@")[0] || "Shadow";
    const data = await db.getProfile(currentUser.id);
    if (data) {
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
    const ids = await db.listSavedIds(userId);
    if (ids) setSavedIds(ids);
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

  const executePendingIntentAfterAuth = async (authenticatedUser: AppUser) => {
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
      const signedInUser = await db.signInWithPassword(cleanEmail, authPassword);
      setIsAuthModalOpen(false);
      setAuthPassword("");
      if (signedInUser) await executePendingIntentAfterAuth(signedInUser);
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
      const { user: newUser, signedIn } = await db.signUpWithPassword(cleanEmail, authPassword);
      if (signedIn && newUser) {
        const defaultName = cleanEmail.split("@")[0] || "Shadow";
        await db.saveProfileName(newUser.id, defaultName).catch(() => {});
        await fetchUserProfile(newUser);
        setIsAuthModalOpen(false);
        setAuthPassword("");
        setAuthConfirmPassword("");
        await executePendingIntentAfterAuth(newUser);
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
      await db.sendPasswordReset(cleanEmail, redirectUrl);
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
      const updatedUser = await db.updatePassword(authPassword);
      setIsAuthModalOpen(false);
      setAuthPassword("");
      setAuthConfirmPassword("");
      setAuthStep("SIGN_IN");
      if (updatedUser) await executePendingIntentAfterAuth(updatedUser);
    } catch (err: any) {
      setAuthError(formatSupabaseAuthError(err));
    } finally {
      setAuthLoading(false);
    }
  };

  const handleOAuthSignIn = async (provider: "google" | "apple") => {
    setAuthError(null);
    try {
      await db.signInWithProvider(provider, `${window.location.origin}/`);
    } catch (err: any) {
      setAuthError(err.message);
    }
  };

  const handleSignOut = async () => {
    await db.signOut();
    setIsSettingsModalOpen(false);
  };

  const toggleSaveWallpaper = async (
    e: React.MouseEvent | null,
    wallpaper: Wallpaper,
    overrideUser?: AppUser | null
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
        await db.unsaveWallpaper(activeUser.id, wallpaper.id);
      } else {
        await db.saveWallpaper(activeUser.id, wallpaper.id);
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
    overrideUser?: AppUser | null
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
      if (wallpaper.storage_path && !wallpaper.image_url.includes("res.cloudinary.com")) {
        fileBlob = await db.downloadStoredFile(wallpaper.storage_path);
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
    const shareUrl = `${window.location.origin}/wallpaper/${wallpaper.id}`;
    if (navigator.share) {
      try {
        await navigator.share({
          title: wallpaper.title,
          text: `Check out this wallpaper on Fusion: ${wallpaper.title}`,
          url: shareUrl,
        });
      } catch {}
    } else {
      try {
        await navigator.clipboard.writeText(shareUrl);
        alert("Wallpaper link copied to clipboard!");
      } catch {
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
      await db.saveProfileName(user.id, trimmedName);

      setProfile({ id: user.id, display_name: trimmedName });

      if (newPasswordInput.trim().length > 0) {
        if (newPasswordInput.length < 6)
          throw new Error("New password must be at least 6 characters.");
        if (newPasswordInput !== confirmNewPasswordInput)
          throw new Error("New passwords do not match.");
        await db.updatePassword(newPasswordInput);
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

  const saveLocalCurationOverride = (
    wallpaperId: string,
    isHero: boolean,
    top10Rank: number | null
  ) => {
    setCurationOverrides((prev) => {
      const next = { ...prev };
      if (top10Rank !== null) {
        Object.keys(next).forEach((id) => {
          if (id !== wallpaperId && next[id]?.top10Rank === top10Rank) {
            next[id] = { ...next[id], top10Rank: null };
          }
        });
      }
      next[wallpaperId] = { isHero, top10Rank };
      if (typeof window !== "undefined") {
        localStorage.setItem("fusion-curation-overrides", JSON.stringify(next));
      }
      return next;
    });
  };

  const measureRatio = (url: string) =>
    new Promise<number>((resolve) => {
      const im = new Image();
      im.onload = () => resolve(im.naturalWidth / im.naturalHeight || 0.75);
      im.onerror = () => resolve(0.75);
      im.src = url;
    });

  const fitUnder = async (file: File, maxBytes: number): Promise<Blob> => {
    if (file.size <= maxBytes) return file;
    const bmp = await createImageBitmap(file);
    const canvas = document.createElement("canvas");
    canvas.width = bmp.width;
    canvas.height = bmp.height;
    canvas.getContext("2d")!.drawImage(bmp, 0, 0);
    bmp.close();
    for (const q of [0.92, 0.88, 0.84, 0.8, 0.75, 0.7]) {
      const blob = await new Promise<Blob | null>((res) =>
        canvas.toBlob(res, "image/jpeg", q)
      );
      if (blob && blob.size <= maxBytes) return blob;
    }
    throw new Error("Image is too large even after compression.");
  };

  const moveUpload = (i: number, dir: -1 | 1) =>
    setUploadFiles((prev) => {
      const j = i + dir;
      if (j < 0 || j >= prev.length) return prev;
      const c = [...prev];
      [c[i], c[j]] = [c[j], c[i]];
      return c;
    });

  const removeUpload = (id: string) =>
    setUploadFiles((prev) => {
      const f = prev.find((x) => x.id === id);
      if (f) URL.revokeObjectURL(f.url);
      return prev.filter((x) => x.id !== id);
    });

  const handleAdminUpload = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isAdmin || uploadFiles.length === 0 || !uploadTitle.trim()) return;

    const cloudName = process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME;
    const uploadPreset = process.env.NEXT_PUBLIC_CLOUDINARY_UPLOAD_PRESET;
    if (!cloudName || !uploadPreset) {
      alert("Cloudinary is not set up yet (missing environment variables).");
      return;
    }

    const files = uploadFiles;
    const title = uploadTitle.trim();
    const category = uploadCategory;
    const showHero = uploadShowInHero;
    const rank = uploadTop10Rank;
    const batchId =
      files.length > 1 ? Math.random().toString(36).slice(2, 10) : null;

    const coverRatio = await measureRatio(files[0].url);
    const pendingId = `pending-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
    const label = (n: number) =>
      files.length > 1 ? `${title} (${n}/${files.length})` : title;
    setPendingUploads((prev) => [
      { id: pendingId, previewUrl: files[0].url, ratio: coverRatio, title: label(1) },
      ...prev,
    ]);

    setUploadTitle("");
    setUploadFiles([]);
    setUploadShowInHero(false);
    setUploadTop10Rank("none");
    setIsUploadModalOpen(false);
    setActiveTab("home");
    setSelectedPillCategory("All");
    window.scrollTo({ top: 0, behavior: "smooth" });

    try {
      for (let i = 0; i < files.length; i++) {
        const { file, url } = files[i];
        setPendingUploads((prev) =>
          prev.map((p) => (p.id === pendingId ? { ...p, title: label(i + 1) } : p))
        );

        const toUpload = await fitUnder(file, 9.5 * 1024 * 1024);
        const fd = new FormData();
        fd.append("file", toUpload, file.name);
        fd.append("upload_preset", uploadPreset);
        const upRes = await fetch(
          `https://api.cloudinary.com/v1_1/${cloudName}/image/upload`,
          { method: "POST", body: fd }
        );
        const up = await upRes.json();
        if (!upRes.ok) throw new Error(up?.error?.message || "Cloudinary upload failed");
        const publicUrl: string = up.secure_url;
        const fileName: string = up.public_id;

        let isFirst = false;
        if (category !== "none" && i === 0) {
          isFirst = !(await db.categoryHasWallpapers(category));
        }

        const ratio = i === 0 ? coverRatio : await measureRatio(url);
        const parsedRank = i === 0 && rank !== "none" ? parseInt(rank, 10) : null;
        const tags = buildUpdatedTags([], i === 0 ? showHero : false, parsedRank);
        tags.push(ratio >= 1 ? PC_TAG : PHONE_TAG);
        if (batchId) tags.push(...makeBatchTags(batchId, i));

        const row = {
          title,
          image_url: publicUrl,
          storage_path: fileName,
          category: category === "none" ? null : category,
        };
        const created = await db.createWallpaper({ ...row, is_banner: isFirst, tags });
        if (created?.id)
          saveLocalCurationOverride(created.id, i === 0 ? showHero : false, parsedRank);
      }

      setPendingUploads((prev) => prev.filter((p) => p.id !== pendingId));
      files.forEach((f) => URL.revokeObjectURL(f.url));
      await fetchWallpapers(true);
    } catch (err: any) {
      setPendingUploads((prev) =>
        prev.map((p) => (p.id === pendingId ? { ...p, failed: true } : p))
      );
      alert(`Upload failed: ${err.message}`);
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
      await db.deleteWallpaper(wallpaper);
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
        await db.clearBanner(finalCat);
      }

      const parsedRank =
        editTop10Rank === "none" ? null : parseInt(editTop10Rank, 10);

      if (parsedRank !== null) {
        const conflicting = wallpapers.filter(
          (w) =>
            w.id !== selectedWallpaper.id &&
            extractCurationFromWallpaper(w, curationOverrides).top10Rank ===
              parsedRank
        );
        for (const other of conflicting) {
          const otherCuration = extractCurationFromWallpaper(
            other,
            curationOverrides
          );
          const cleanedTags = buildUpdatedTags(
            other.tags,
            otherCuration.isHero,
            null
          );
          await db.updateWallpaperTags(other.id, cleanedTags);
        }
      }

      const updatedTags = buildUpdatedTags(
        selectedWallpaper.tags,
        editShowInHero,
        parsedRank
      );

      await db.updateWallpaperDetails(selectedWallpaper.id, {
        category: finalCat,
        is_banner: editSetAsBanner && finalCat !== null,
        tags: updatedTags,
      });

      saveLocalCurationOverride(
        selectedWallpaper.id,
        editShowInHero,
        parsedRank
      );

      setIsEditModalOpen(false);
      await fetchWallpapers();
      closeWallpaperDetail();
    } catch (err: any) {
      alert(`Failed to update wallpaper: ${err.message}`);
    } finally {
      setEditingWallpaper(false);
    }
  };

  const migrateOldToCloudinary = async () => {
    if (!isAdmin) return;
    const cloudName = process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME;
    const preset = process.env.NEXT_PUBLIC_CLOUDINARY_UPLOAD_PRESET;
    if (!cloudName || !preset) {
      alert("Cloudinary is not set up (missing environment variables).");
      return;
    }
    const todo = wallpapers.filter((w) => !w.image_url.includes("res.cloudinary.com"));
    if (!todo.length) {
      alert("Everything is already on Cloudinary.");
      return;
    }
    if (!confirm(`Move ${todo.length} wallpapers to Cloudinary? Keep this page open until it finishes.`)) return;

    let ok = 0;
    const failed: string[] = [];
    for (let i = 0; i < todo.length; i++) {
      const w = todo[i];
      setMigrateMsg(`Moving ${i + 1}/${todo.length}…`);
      try {
        const fd = new FormData();
        fd.append("file", w.image_url);
        fd.append("upload_preset", preset);
        const res = await fetch(`https://api.cloudinary.com/v1_1/${cloudName}/image/upload`, {
          method: "POST",
          body: fd,
        });
        const up = await res.json();
        if (!res.ok) throw new Error(up?.error?.message || "upload failed");
        await db.updateWallpaperUrl(w.id, up.secure_url, up.public_id);
        ok++;
      } catch {
        failed.push(w.title);
      }
    }
    setMigrateMsg("");
    alert(
      `Moved ${ok} of ${todo.length}.` +
        (failed.length ? `\nFailed (probably over 10 MB): ${failed.join(", ")}` : "")
    );
    await fetchWallpapers(true);
  };

  const backfillDevices = async () => {
    if (!isAdmin) return;
    const todo = wallpapers.filter((w) => !getDevice(w));
    if (!todo.length) return alert("All wallpapers are already tagged.");
    let done = 0;
    for (const w of todo) {
      try {
        const ratio = await new Promise<number>((res, rej) => {
          const im = new Image();
          im.onload = () => res(im.naturalWidth / im.naturalHeight);
          im.onerror = rej;
          im.src = img(w.image_url, 80);
        });
        const tags = [...(Array.isArray(w.tags) ? w.tags : []), ratio >= 1 ? PC_TAG : PHONE_TAG];
        await db.updateWallpaperTags(w.id, tags);
        done++;
      } catch {}
    }
    alert(`Tagged ${done} of ${todo.length}.`);
    await fetchWallpapers();
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

      if (activeTab === "home" && selectedPillCategory === "Phone") {
        if (getDevice(item) !== "phone") return false;
      } else if (activeTab === "home" && selectedPillCategory === "PC") {
        if (getDevice(item) !== "pc") return false;
      } else if (activeTab === "home" && selectedPillCategory !== "All") {
        const catId = animeCategories.find((c) => c.name === selectedPillCategory)?.id;
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
    const curBatch = getBatchId(selectedWallpaper);
    const others = wallpapers.filter(
      (w) => w.id !== selectedWallpaper.id && (!curBatch || getBatchId(w) !== curBatch)
    );
    const scored = others.map((candidate) => {
      let score = 0;
      if (currentCat && getWallpaperCategory(candidate) === currentCat)
        score += 10;
      return { wallpaper: candidate, score };
    });
    scored.sort((a, b) => b.score - a.score);
    return scored.map((s) => s.wallpaper);
  }, [wallpapers, selectedWallpaper]);

  const topTenDailyWallpapers = useMemo(() => {
    if (wallpapers.length === 0) return [];
    const daySeed = Math.floor(Date.now() / (1000 * 60 * 60 * 24));

    const pinnedByRank: Record<number, Wallpaper> = {};
    const pinnedIds = new Set<string>();

    wallpapers.forEach((w) => {
      const { top10Rank } = extractCurationFromWallpaper(w, curationOverrides);
      if (
        top10Rank &&
        top10Rank >= 1 &&
        top10Rank <= 10 &&
        !pinnedByRank[top10Rank]
      ) {
        pinnedByRank[top10Rank] = w;
        pinnedIds.add(w.id);
      }
    });

    const unpinned = wallpapers.filter((w) => !pinnedIds.has(w.id));
    const scored = unpinned.map((w, idx) => {
      const hash =
        (w.id.charCodeAt(0) || 1) * 31 +
        (w.id.charCodeAt(w.id.length - 1) || 1) +
        daySeed +
        idx;
      const dailyScore = (w.downloads || 0) * 100 + (hash % 97);
      return { wallpaper: w, dailyScore };
    });
    scored.sort((a, b) => b.dailyScore - a.dailyScore);

    const result: Wallpaper[] = [];
    let autoIdx = 0;
    const maxCount = Math.min(10, wallpapers.length);

    for (let rank = 1; rank <= maxCount; rank++) {
      if (pinnedByRank[rank]) {
        result.push(pinnedByRank[rank]);
      } else if (autoIdx < scored.length) {
        result.push(scored[autoIdx].wallpaper);
        autoIdx++;
      }
    }

    return result;
  }, [wallpapers, curationOverrides]);

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

  const renderOfficialSocialsSection = () => (
    <>
      {OFFICIAL_FUSION_SOCIALS.map((social) => (
        <GlassContainer
          key={social.id}
          type="rounded"
          borderRadius={26}
          tintOpacity={0.14}
          className="p-3.5 w-full h-full flex items-center"
        >
          <a
            href={social.url}
            target="_blank"
            rel="noopener noreferrer"
            className="flex w-full items-center justify-between gap-3 transition-transform duration-150 active:scale-[0.99]"
          >
            <div className="flex min-w-0 items-center gap-3">
              <div className="h-10 w-10 shrink-0 overflow-hidden rounded-xl border border-white/15 bg-black">
                <img src="/logo.webp" alt={social.name} className="h-full w-full object-cover" />
              </div>
              <div className="min-w-0">
                <p className={`truncate text-sm font-bold ${isLight ? "text-[#0E2F76]" : "text-white"}`}>{social.name}</p>
                <p className={`truncate text-[11px] ${isLight ? "text-[#0E2F76]/65" : "text-white/55"}`}>{social.handle}</p>
              </div>
            </div>
            <span className={`inline-flex h-8 shrink-0 items-center gap-1.5 rounded-full px-3.5 text-[11px] font-bold ${isLight ? "bg-[#0E2F76] text-white" : "bg-white text-black"}`}>
              {social.cta}
              <ExternalLink className="h-3 w-3" />
            </span>
          </a>
        </GlassContainer>
      ))}
    </>
  );

  const onSwipeStart = (e: React.PointerEvent) => {
    swipeStart.current = { x: e.clientX, y: e.clientY };
  };
  const onSwipeEnd = (e: React.PointerEvent, go: (dir: 1 | -1) => void) => {
    const s = swipeStart.current;
    swipeStart.current = null;
    if (!s) return;
    const dx = e.clientX - s.x;
    const dy = e.clientY - s.y;
    if (Math.abs(dx) > 40 && Math.abs(dx) > Math.abs(dy) * 1.3) {
      justSwiped.current = Date.now();
      go(dx < 0 ? 1 : -1);
    }
  };
  const stepBatch = (coverId: string, count: number, dir: 1 | -1) =>
    setBatchIndex((prev) => ({
      ...prev,
      [coverId]: Math.min(Math.max((prev[coverId] ?? 0) + dir, 0), count - 1),
    }));
  const stepDetail = (dir: 1 | -1) => {
    if (!detailSlides || !selectedWallpaper) return;
    const i = detailSlides.findIndex((s) => s.id === selectedWallpaper.id);
    const next = detailSlides[i + dir];
    if (next) {
      setDetailDir(dir);
      setSelectedWallpaper(next);
      setIsExpanded(false);
    }
  };

  const renderWallpaperCard = (
    item: Wallpaper,
    options?: { showRemoveSavedBtn?: boolean; slides?: Wallpaper[] }
  ) => {
    const slides = options?.slides && options.slides.length > 1 ? options.slides : null;
    const idx = slides ? Math.min(batchIndex[item.id] ?? 0, slides.length - 1) : 0;
    const current = slides ? slides[idx] : item;
    const anim = slideAnim[item.id];
    const step = (d: 1 | -1) => {
      if (!slides) return;
      const next = Math.min(Math.max(idx + d, 0), slides.length - 1);
      if (next === idx) return;
      const n = (slideAnim[item.id]?.n ?? 0) + 1;
      setSlideAnim((p) => ({ ...p, [item.id]: { from: current, dir: d, n } }));
      setBatchIndex((p) => ({ ...p, [item.id]: next }));
      window.setTimeout(() => {
        setSlideAnim((p) => {
          if (p[item.id]?.n !== n) return p;
          const c = { ...p };
          delete c[item.id];
          return c;
        });
      }, 480);
    };
    const known = imageRatios[current.id];
    const boxRatio = known === undefined ? 0.75 : Math.max(known, 9 / 16);
    const isMenuOpen = activeMenu?.wallpaper.id === current.id;
    const arrow =
      "hidden md:flex absolute top-1/2 z-20 h-8 w-8 -translate-y-1/2 items-center justify-center rounded-full bg-black/45 text-white opacity-0 backdrop-blur-sm transition-opacity group-hover:opacity-100";

    return (
      <div key={item.id} className="fusion-card group break-inside-avoid mb-2 relative flex flex-col">
        <div
          onClick={() => {
            if (Date.now() - justSwiped.current < 350) return;
            openWallpaperDetail(current, slides ?? undefined);
          }}
          onPointerDown={slides ? onSwipeStart : undefined}
          onPointerUp={slides ? (e) => onSwipeEnd(e, step) : undefined}
          style={{ aspectRatio: String(boxRatio), touchAction: slides ? "pan-y" : undefined }}
          className={`fusion-box relative w-full overflow-hidden rounded-2xl cursor-pointer active:scale-[0.98] border ${
            isLight
              ? "bg-[#A9C0E0]/25 border-[#0E2F76]/35 shadow-[0_8px_22px_rgba(14,47,118,0.20)]"
              : "bg-[#0a0a0a] border-white/30"
          }`}
          onContextMenu={(e) => e.preventDefault()}
        >
          {known === undefined && <div className="fusion-shimmer absolute inset-0" />}
          {anim && (
            <img
              key={`out-${anim.n}`}
              src={img(anim.from, 500)}
              alt=""
              aria-hidden
              draggable={false}
              className={`absolute inset-0 h-full w-full object-cover pointer-events-none select-none ${
                anim.dir === 1 ? "fusion-out-left" : "fusion-out-right"
              }`}
            />
          )}
          <img
            key={current.id}
            src={img(current, 500)}
            alt={current.title}
            loading="lazy"
            draggable={false}
            onLoad={(e) => {
              const { naturalWidth, naturalHeight } = e.currentTarget;
              setImageRatios((prev) => ({ ...prev, [current.id]: naturalWidth / naturalHeight }));
            }}
            onContextMenu={(e) => e.preventDefault()}
            className={`absolute inset-0 h-full w-full object-cover pointer-events-none select-none ${
              anim ? (anim.dir === 1 ? "fusion-in-right" : "fusion-in-left") : ""
            } ${known === undefined ? "opacity-0" : "opacity-100"}`}
          />
          <div className="absolute inset-0 z-10 bg-transparent" onContextMenu={(e) => e.preventDefault()} />

          {slides && idx > 0 && (
            <button
              type="button"
              aria-label="Previous wallpaper"
              onPointerDown={(e) => e.stopPropagation()}
              onClick={(e) => { e.stopPropagation(); step(-1); }}
              className={`${arrow} left-1.5`}
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
          )}
          {slides && idx < slides.length - 1 && (
            <button
              type="button"
              aria-label="Next wallpaper"
              onPointerDown={(e) => e.stopPropagation()}
              onClick={(e) => { e.stopPropagation(); step(1); }}
              className={`${arrow} right-1.5`}
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          )}
        </div>

        {slides && (
          <div className="mt-1.5 flex items-center justify-center gap-1">
            {slides.map((s, i) => (
              <span
                key={s.id}
                className={`h-1.5 rounded-full transition-all duration-200 ${
                  i === idx
                    ? `w-3 ${isLight ? "bg-[#0E2F76]" : "bg-white"}`
                    : `w-1.5 ${isLight ? "bg-[#0E2F76]/25" : "bg-white/35"}`
                }`}
              />
            ))}
          </div>
        )}

        <div className="mt-0.5 px-0.5 h-4 flex items-center justify-between">
          <h3
            className={`text-[11px] leading-4 font-normal truncate max-w-[80%] tracking-tight ${
              isLight ? "text-[#0E2F76]" : "text-white/90"
            }`}
          >
            {item.title}
          </h3>
          <button
            type="button"
            aria-label="Wallpaper options"
            onClick={(e) => {
              setMenuSlides(slides);
              handleToggleCardMenu(e, current);
            }}
            className={`h-6 w-6 -my-1 -mr-1 rounded-md flex items-center justify-center transition active:scale-90 ${
              isMenuOpen
                ? isLight ? "bg-[#0E2F76]/15 text-[#0E2F76]" : "bg-white/20 text-white"
                : isLight ? "text-[#0E2F76]/80 hover:bg-[#0E2F76]/10" : "text-white/80 hover:bg-white/10"
            }`}
          >
            <MoreHorizontal className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>
    );
  };

  const orderFeed = (list: Wallpaper[]) => {
    const NEW_MS = 48 * 60 * 60 * 1000;
    const now = Date.now();
    const fresh = list
      .filter((w) => now - new Date(w.created_at).getTime() < NEW_MS)
      .sort((a, b) => +new Date(b.created_at) - +new Date(a.created_at));
    const freshIds = new Set(fresh.map((w) => w.id));
    const seed = Math.floor(sessionSeed.current * 1e6);
    const hash = (s: string) => {
      let h = seed;
      for (const c of s) h = (h * 31 + c.charCodeAt(0)) | 0;
      return h;
    };
    const rest = list.filter((w) => !freshIds.has(w.id)).sort((a, b) => hash(a.id) - hash(b.id));
    return [...fresh, ...rest];
  };

  const renderPendingCard = (p: PendingUpload) => (
    <div
      key={p.id}
      className="mb-2 flex flex-col"
      onClick={() => p.failed && setPendingUploads((prev) => prev.filter((x) => x.id !== p.id))}
    >
      <div
        style={{ aspectRatio: String(Math.max(p.ratio, 9 / 16)) }}
        className="relative w-full overflow-hidden rounded-2xl border border-white/10 bg-[#0a0a0a]"
      >
        <img
          src={p.previewUrl}
          alt=""
          className={`absolute inset-0 h-full w-full object-cover transition-[opacity,filter] duration-300 ease-out ${
            p.failed ? "opacity-30" : "opacity-50 blur-[2px]"
          }`}
        />
        {!p.failed && <div className="fusion-shimmer absolute inset-0" />}
        {!p.failed && (
          <div className="absolute inset-x-0 bottom-0 h-1 overflow-hidden bg-white/10">
            <div className="fusion-bar h-full w-1/3 rounded-full bg-white/80" />
          </div>
        )}
      </div>
      <div className="mt-1 px-0.5 text-[11px] text-white/70 truncate">
        {p.failed ? "Upload failed (tap to dismiss)" : `Uploading ${p.title}…`}
      </div>
    </div>
  );

  const renderMasonry = (
    items: Wallpaper[],
    opts?: { pending?: PendingUpload[]; showRemoveSavedBtn?: boolean; noGroup?: boolean }
  ) => {
    type Entry =
      | { kind: "pending"; p: PendingUpload }
      | { kind: "wp"; w: Wallpaper; slides: Wallpaper[] };
    const groups = opts?.noGroup
      ? items.map((w) => ({ cover: w, slides: [w] }))
      : groupBatches(items);
    const entries: Entry[] = [
      ...(opts?.pending || []).map((p) => ({ kind: "pending" as const, p })),
      ...groups.map((g) => ({ kind: "wp" as const, w: g.cover, slides: g.slides })),
    ];
    const heights: number[] = Array(colCount).fill(0);
    const cols: Entry[][] = Array.from({ length: colCount }, () => []);
    for (const e of entries) {
      const id = e.kind === "pending" ? e.p.id : e.w.id;
      const known = e.kind === "pending" ? e.p.ratio : imageRatios[e.w.id];
      if (known !== undefined && frozenRatios.current[id] === undefined) {
        frozenRatios.current[id] = known;
      }
      const r = frozenRatios.current[id] ?? 0.75;
      const h = 1 / Math.max(r, 9 / 16) + 0.14;
      const i = heights.indexOf(Math.min(...heights));
      cols[i].push(e);
      heights[i] += h;
    }
    return (
      <div className="flex items-start gap-1 -mx-2 md:gap-2 md:mx-0">
        {cols.map((col, ci) => (
          <div key={ci} className="fusion-col flex-1 min-w-0 flex flex-col">
            {col.map((e) =>
              e.kind === "pending"
                ? renderPendingCard(e.p)
                : renderWallpaperCard(e.w, { showRemoveSavedBtn: opts?.showRemoveSavedBtn, slides: e.slides })
            )}
          </div>
        ))}
      </div>
    );
  };

  const renderSkeleton = () => {
    const heights: number[] = Array(colCount).fill(0);
    const cols: number[][] = Array.from({ length: colCount }, () => []);
    lastSkel.forEach((r) => {
      const i = heights.indexOf(Math.min(...heights));
      cols[i].push(r);
      heights[i] += 1 / Math.max(r, 9 / 16) + 0.14;
    });
    return (
      <div className="flex items-start gap-1 -mx-2 md:gap-2 md:mx-0">
        {cols.map((col, ci) => (
          <div key={ci} className="flex-1 min-w-0 flex flex-col">
            {col.map((r, i) => (
              <div key={i} className="mb-2">
                <div
                  style={{ aspectRatio: String(Math.max(r, 9 / 16)) }}
                  className="relative w-full overflow-hidden rounded-2xl border border-white/10 bg-[#0a0a0a]"
                >
                  <div className="fusion-shimmer absolute inset-0" />
                </div>
                <div className="mt-1.5 h-2.5 w-2/3 rounded bg-white/[0.06]" />
              </div>
            ))}
          </div>
        ))}
      </div>
    );
  };

  const detailRatio = selectedWallpaper
    ? imageRatios[selectedWallpaper.id]
    : undefined;
  const detailIsTall = detailRatio !== undefined && detailRatio <= 0.57;

  return (
    <div
      className={`min-h-screen flex flex-col pb-24 relative overflow-x-hidden font-sans transition-colors duration-200 ${
        isLight
          ? "theme-light bg-[#F4FEFF] text-[#0E2F76] selection:bg-[#0E2F76] selection:text-white"
          : "bg-[#000000] text-[#E5E4E2] selection:bg-white selection:text-black"
      }`}
      onContextMenu={(e) => e.preventDefault()}
    >
      <LiquidGlassShaderDefs />

      {/* ================= SMART SCREEN-AWARE 3-DOT MENU ================= */}
      {activeMenu && (
        <GlassContainer
          type="rounded"
          borderRadius={20}
          tintOpacity={0.22}
          blurRadius={22}
          warp={true}
          style={{
            top: activeMenu.top !== undefined ? `${activeMenu.top}px` : "auto",
            bottom:
              activeMenu.bottom !== undefined
                ? `${activeMenu.bottom}px`
                : "auto",
            left: `${activeMenu.left}px`,
            background: isLight
              ? "rgba(255, 255, 255, 0.92)"
              : "rgba(12, 12, 16, 0.78)",
          }}
          className="fixed z-[70] w-40 p-1.5 animate-in fade-in zoom-in-95 duration-150 shadow-[0_20px_50px_rgba(0,0,0,0.65)]"
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
            className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-bold transition active:scale-95 ${
              isLight
                ? "text-[#0E2F76] hover:bg-[#0E2F76]/10"
                : "text-white hover:bg-white/15"
            }`}
          >
            <Bookmark
              className={`h-3.5 w-3.5 ${
                savedIds.includes(activeMenu.wallpaper.id)
                  ? isLight
                    ? "fill-[#0E2F76] text-[#0E2F76]"
                    : "fill-white text-white"
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
            className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-bold transition active:scale-95 ${
              isLight
                ? "text-[#0E2F76] hover:bg-[#0E2F76]/10"
                : "text-white hover:bg-white/15"
            }`}
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
              if (menuSlides && menuSlides.length > 1)
                setDownloadChoice({ current: target, slides: menuSlides });
              else triggerDirectDownload(target);
            }}
            className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-bold transition active:scale-95 ${
              isLight
                ? "text-[#0E2F76] hover:bg-[#0E2F76]/10"
                : "text-white hover:bg-white/15"
            }`}
          >
            <Download className="h-3.5 w-3.5" />
            <span>Download</span>
          </button>

          {isAdmin && (
            <button
              type="button"
              onClick={(e) => handleAdminDelete(e, activeMenu.wallpaper)}
              className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-bold text-red-500 hover:bg-red-500/15 transition border-t border-white/15 mt-0.5 pt-1.5"
            >
              <Trash2 className="h-3.5 w-3.5" />
              <span>Delete</span>
            </button>
          )}
        </GlassContainer>
      )}

      {/* ================= HEADER ================= */}
      <Header
        isLight={isLight}
        user={user}
        profile={profile}
        activeTab={activeTab}
        isAdmin={isAdmin}
        onHomeClick={() => {
          setActiveTab("home");
          setSearchQuery("");
          window.scrollTo({ top: 0, behavior: "smooth" });
        }}
        onProfileClick={() => setActiveTab("profile")}
        onSettingsClick={() => router.push("/settings")}
        onUploadClick={() => setIsUploadModalOpen(true)}
        onSignInClick={() =>
          requireAuthForAction(
            "Sign in to save wallpapers and unlock full-resolution downloads.",
            { type: "profile_tab" },
            "SIGN_IN"
          )
        }
      />

      {/* ================= LIQUID GLASS SEARCH BAR & PILLS ================= */}
      {(activeTab === "home" || activeTab === "explore") && (
        <div className="relative max-w-6xl w-full mx-auto px-3 md:px-4 pt-3 pb-2 z-40 flex flex-col gap-2.5">
          <SearchBar
            isLight={isLight}
            searchQuery={searchQuery}
            setSearchQuery={setSearchQuery}
            searchInputRef={searchInputRef}
          />

          {activeTab === "home" && !searchQuery && (
            <CategoryPills
              isLight={isLight}
              selectedPillCategory={selectedPillCategory}
              setSelectedPillCategory={setSelectedPillCategory}
              pillRefs={pillRefs}
              pillBox={pillBox}
              isAdmin={isAdmin}
              migrateOldToCloudinary={migrateOldToCloudinary}
              backfillDevices={backfillDevices}
              migrateMsg={migrateMsg}
            />
          )}
        </div>
      )}

      {/* ================= CONTENT AREA ================= */}
      {activeTab === "profile" ? (
        <main key={activeTab} className="fusion-page flex-1 max-w-6xl w-full mx-auto px-3 md:px-4 pt-3 pb-8 z-10">
          {user ? (
            <div className="space-y-6">
              <div className="max-w-md md:max-w-3xl mx-auto grid grid-cols-1 md:grid-cols-2 gap-3 items-stretch">
                <GlassContainer
                  type="rounded"
                  borderRadius={24}
                  tintOpacity={0.14}
                  className="p-4 h-full flex flex-col justify-center"
                  style={{
                    ...(() => {
                      const avatar = AVATARS.find(
                        (item) => item.id === user.avatarId
                      );

                      const from = avatar?.from ?? "#2a2a32";
                      const to = avatar?.to ?? "#6a6a78";

                      return {
                        background: isLight
                          ? `linear-gradient(135deg, ${to}3d 0%, ${from}1f 100%), #ffffff`
                          : `linear-gradient(135deg, ${from} 0%, ${to}66 100%), #0b0b0d`,
                        borderColor: isLight ? `${to}66` : `${to}55`,
                      };
                    })(),
                  }}
                >
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-3 min-w-0">
                      <AvatarBadge id={user.avatarId} name={profile?.display_name || user.email || "U"} size={44} />

                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5">
                          <h2
                            className={`text-sm sm:text-base font-bold truncate ${
                              isLight ? "text-[#0E2F76]" : "text-white"
                            }`}
                          >
                            {profile?.display_name || "Shadow"}
                          </h2>
                          {isAdmin && (
                            <span
                              className={`text-[8px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded-full border ${
                                isLight
                                  ? "bg-[#0E2F76]/10 text-[#0E2F76] border-[#0E2F76]/25"
                                  : "bg-white/15 text-white border-white/25"
                              }`}
                            >
                              Admin
                            </span>
                          )}
                        </div>

                        <div
                          className={`flex items-center gap-1.5 text-[11px] ${
                            isLight ? "text-[#0E2F76]/65" : "text-white/60"
                          }`}
                        >
                          <span className="truncate">
                            {revealFullEmail
                              ? user.email
                              : maskEmailAddress(user.email)}
                          </span>
                          <button
                            type="button"
                            onClick={() => setRevealFullEmail(!revealFullEmail)}
                            className="p-0.5 transition opacity-80 hover:opacity-100"
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

                    <GlassButton
                      typeShape="circle"
                      size={38}
                      tintOpacity={0.14}
                      aria-label="Log out"
                      onClick={handleSignOut}
                      className="shrink-0"
                    >
                      <LogOut className={`h-4 w-4 ${isLight ? "text-[#0E2F76]" : "text-white"}`} />
                    </GlassButton>
                  </div>
                </GlassContainer>

                {renderOfficialSocialsSection()}
              </div>

              <div className="space-y-3 pt-1">
                <div className="flex items-baseline justify-between px-0.5">
                  <h3
                    className={`text-base sm:text-lg font-bold tracking-tight ${
                      isLight ? "text-[#0E2F76]" : "text-white"
                    }`}
                  >
                    My Saved Wallpapers
                  </h3>
                  <span
                    className={`text-xs font-medium ${
                      isLight ? "text-[#0E2F76]/60" : "text-white/55"
                    }`}
                  >
                    {savedWallpapersList.length} saved
                  </span>
                </div>
                {savedWallpapersList.length === 0 ? (
                  <GlassContainer
                    type="rounded"
                    borderRadius={28}
                    className="p-10 text-center max-w-md mx-auto my-4"
                  >
                    <Bookmark className="h-8 w-8 mx-auto mb-2 opacity-70" />
                    <p className="text-sm font-semibold">
                      You haven&apos;t saved any wallpapers yet.
                    </p>
                    <p className="text-xs opacity-60 mt-1 mb-4">
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
                  renderMasonry(savedWallpapersList, { showRemoveSavedBtn: true, noGroup: true })
                )}
              </div>
            </div>
          ) : (
            <div className="max-w-md md:max-w-3xl w-full mx-auto my-4 grid grid-cols-1 md:grid-cols-2 gap-3.5 items-stretch">
              <GlassContainer
                type="rounded"
                borderRadius={26}
                className="p-6 text-center flex flex-col justify-center"
              >
                <div className="mx-auto h-11 w-11 rounded-2xl overflow-hidden border border-white/20 mb-3">
                  <img
                    src="/logo.webp"
                    alt="Fusion Logo"
                    className="h-full w-full object-cover"
                  />
                </div>
                <h2 className="text-base font-bold">Your Fusion Account</h2>
                <p className="text-xs opacity-65 mt-1.5 leading-relaxed">
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

              {renderOfficialSocialsSection()}
            </div>
          )}
        </main>
      ) : activeTab === "explore" && !searchQuery ? (
        <main key={activeTab} className="fusion-page flex-1 max-w-6xl w-full mx-auto px-3 md:px-4 z-10 pb-8">
          {exploreView === "grid" ? (
            <div className="space-y-4 pt-2">
              <div className="flex items-center gap-2">
                <Compass className="h-4 w-4" />
                <h2 className="text-base font-bold tracking-wide">
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
                    ? img(banner, 600)
                    : cat.fallbackBanner;

                  return (
                    <div
                      key={cat.id}
                      onClick={() => {
                        setSelectedExploreCategory(cat.id);
                        setExploreView("category");
                        window.scrollTo({ top: 0, behavior: "smooth" });
                      }}
                      className="group relative h-28 sm:h-36 rounded-2xl overflow-hidden bg-[#0a0a0a] border border-white/15 cursor-pointer hover:border-white/35 transition-all flex flex-col justify-end active:scale-95"
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

              <h2 className="text-lg font-bold tracking-wide">
                {animeCategories.find((c) => c.id === selectedExploreCategory)
                  ?.name || "Category"}
              </h2>

              {filteredWallpapers.length === 0 ? (
                <GlassContainer
                  type="rounded"
                  borderRadius={28}
                  className="p-10 text-center max-w-md mx-auto my-6"
                >
                  <ImageIcon className="h-8 w-8 mx-auto mb-2 opacity-70" />
                  <h3 className="text-sm font-semibold">No Wallpapers Yet</h3>
                  <p className="text-xs opacity-60 mt-1">
                    Admin hasn&apos;t uploaded any wallpapers for this category.
                  </p>
                </GlassContainer>
              ) : (
                renderMasonry(filteredWallpapers)
              )}
            </div>
          )}
        </main>
      ) : (
        <main key={activeTab} className="fusion-page flex-1 max-w-6xl w-full mx-auto px-3 md:px-4 z-10 pb-6 flex flex-col justify-between">
          <div>
            {/* ================= PC ONLY SECTION: HERO BANNER & TOP 10 TODAY ================= */}
            {activeTab === "home" &&
              !searchQuery &&
              selectedPillCategory === "All" &&
              pcHeroWallpapers.length > 0 && (
                <div className="hidden md:block mb-3 space-y-7 pt-2">
                  <div
                    className={`group relative w-full h-[360px] rounded-3xl overflow-hidden bg-[#0a0a0a] border transition-shadow duration-300 ${
                      isLight
                        ? "border-[#0E2F76]/15 shadow-[0_20px_50px_rgba(14,47,118,0.30)]"
                        : "border-white/15 shadow-[0_20px_50px_rgba(0,0,0,0.85)]"
                    }`}
                  >
                    {pcHeroWallpapers.map((hero, idx) => (
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
                          src={img(hero, 900)}
                          alt={hero.title}
                          className="w-full h-full object-cover"
                        />
                        <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/30 to-transparent" />
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
                              <Bookmark className="h-3.5 w-3.5 text-white" />
                              <span className="text-white">Save</span>
                            </GlassButton>
                          </div>
                        </div>
                      </div>
                    ))}

                    {pcHeroWallpapers.length > 1 && (
                      <>
                        <button
                          type="button"
                          aria-label="Previous featured wallpaper"
                          onClick={handlePrevHero}
                          className="absolute left-3.5 top-1/2 -translate-y-1/2 z-20 h-9 w-9 rounded-full bg-black/20 hover:bg-black/45 backdrop-blur-md border border-white/20 flex items-center justify-center text-white transition active:scale-90"
                        >
                          <ChevronLeft className="h-4 w-4" />
                        </button>
                        <button
                          type="button"
                          aria-label="Next featured wallpaper"
                          onClick={handleNextHero}
                          className="absolute right-3.5 top-1/2 -translate-y-1/2 z-20 h-9 w-9 rounded-full bg-black/20 hover:bg-black/45 backdrop-blur-md border border-white/20 flex items-center justify-center text-white transition active:scale-90"
                        >
                          <ChevronRight className="h-4 w-4" />
                        </button>
                      </>
                    )}

                    <div className="absolute bottom-6 right-8 z-20 flex items-center gap-1.5">
                      {pcHeroWallpapers.map((_, idx) => (
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

                  {/* Top 10 Today Ranking System */}
                  <div className="space-y-3 relative">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Flame className="h-5 w-5" />
                        <h3 className="text-lg font-black tracking-wide">
                          Top 10 Today
                        </h3>
                      </div>

                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          aria-label="Scroll Top 10 left"
                          onClick={() => scrollTop10Row("left")}
                          className={`h-8 w-8 rounded-full backdrop-blur-md border flex items-center justify-center transition active:scale-90 ${
                            isLight
                              ? "bg-[#0E2F76]/[0.06] hover:bg-[#0E2F76]/15 border-[#0E2F76]/15 text-[#0E2F76]"
                              : "bg-white/[0.06] hover:bg-white/15 border-white/15 text-white"
                          }`}
                        >
                          <ChevronLeft className="h-4 w-4" />
                        </button>
                        <button
                          type="button"
                          aria-label="Scroll Top 10 right"
                          onClick={() => scrollTop10Row("right")}
                          className={`h-8 w-8 rounded-full backdrop-blur-md border flex items-center justify-center transition active:scale-90 ${
                            isLight
                              ? "bg-[#0E2F76]/[0.06] hover:bg-[#0E2F76]/15 border-[#0E2F76]/15 text-[#0E2F76]"
                              : "bg-white/[0.06] hover:bg-white/15 border-white/15 text-white"
                          }`}
                        >
                          <ChevronRight className="h-4 w-4" />
                        </button>
                      </div>
                    </div>

                    <div
                      ref={top10ScrollRef}
                      className="flex items-center gap-5 overflow-x-auto no-scrollbar py-2.5 pl-2 pr-4 scroll-smooth"
                    >
                      {topTenDailyWallpapers.map((rankedItem, rankIdx) => (
                        <div
                          key={rankedItem.id}
                          onClick={() => openWallpaperDetail(rankedItem)}
                          className="group relative flex items-end shrink-0 cursor-pointer select-none"
                        >
                          <span
                            className={`text-[105px] leading-none font-black text-transparent transition-all -mr-5 z-0 pointer-events-none ${
                              isLight
                                ? "[-webkit-text-stroke:2.5px_rgba(14,47,118,0.28)] group-hover:[-webkit-text-stroke:2.5px_rgba(14,47,118,0.75)]"
                                : "[-webkit-text-stroke:2.5px_rgba(255,255,255,0.3)] group-hover:[-webkit-text-stroke:2.5px_rgba(255,255,255,0.8)]"
                            }`}
                          >
                            {rankIdx + 1}
                          </span>
                          <div
                            className={`relative z-10 w-32 h-48 rounded-2xl overflow-hidden bg-[#0a0a0a] border group-hover:scale-105 transition-all duration-300 ${
                              isLight
                                ? "border-[#0E2F76]/15 shadow-[0_12px_28px_rgba(14,47,118,0.30)] group-hover:border-[#0E2F76]/35"
                                : "border-white/15 shadow-xl group-hover:border-white/40"
                            }`}
                          >
                            <img
                              src={img(rankedItem, 400)}
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
              <div className="pt-4 pb-4 px-0.5 flex items-baseline justify-between">
                <h1
                  className={`text-lg sm:text-xl font-bold tracking-tight ${
                    isLight ? "text-[#0E2F76]" : "text-white"
                  }`}
                >
                  Saved Wallpapers
                </h1>
                <span
                  className={`text-xs sm:text-sm font-medium ${
                    isLight ? "text-[#0E2F76]/60" : "text-white/55"
                  }`}
                >
                  {filteredWallpapers.length} saved
                </span>
              </div>
            )}

            {activeTab === "home" && (
              <h2 className={`hidden md:block pt-0 pb-2 text-lg sm:text-xl font-bold tracking-tight ${isLight ? "text-[#0E2F76]" : "text-white"}`}>
                {searchQuery ? "Results" : selectedPillCategory === "All" ? "All Wallpapers" : selectedPillCategory}
              </h2>
            )}

            {loading ? (
              renderSkeleton()
            ) : fetchError ? (
              <GlassContainer
                type="rounded"
                borderRadius={24}
                className="p-6 text-center max-w-md mx-auto my-6"
              >
                <AlertCircle className="h-8 w-8 text-red-400 mx-auto mb-2" />
                <h3 className="text-sm font-bold">Connection Error</h3>
                <p className="text-xs opacity-70 mt-1 mb-3">{fetchError}</p>
                <GlassButton
                  typeShape="pill"
                  activeWhite={true}
                  onClick={() => fetchWallpapers()}
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
                <h3 className="text-sm font-semibold">
                  {activeTab === "saved"
                    ? "You haven't saved any wallpapers yet."
                    : "No Wallpapers Found"}
                </h3>
                <p className="text-xs opacity-60 mt-1">
                  {activeTab === "saved"
                    ? "Tap the 3-dot menu on any wallpaper to save it."
                    : "Try clearing your search or filter."}
                </p>
              </GlassContainer>
            ) : (
              renderMasonry(
                activeTab === "home" ? orderFeed(filteredWallpapers) : filteredWallpapers,
                {
                  pending: activeTab === "home" ? pendingUploads : [],
                  noGroup: activeTab === "saved",
                }
              )
            )}
          </div>

          {activeTab === "home" && !searchQuery && <Footer isLight={isLight} />}
        </main>
      )}

      {/* ================= SUBTLY CLEARER LIQUID GLASS BOTTOM NAVIGATION ================= */}
      <nav
        aria-label="Primary Bottom Navigation"
        className="fixed bottom-3.5 left-1/2 -translate-x-1/2 z-40 w-[88%] max-w-xs"
      >
        <div
          className="fusion-nav relative rounded-full p-1.5"
          style={{
            background:
              "linear-gradient(180deg, rgba(255,255,255,0.06), rgba(255,255,255,0.01)), rgba(20,20,22,0.30)",
            backdropFilter: "blur(18px) saturate(125%)",
            WebkitBackdropFilter: "blur(18px) saturate(125%)",
            border: "1px solid rgba(255,255,255,0.12)",
            boxShadow:
              "0 10px 26px rgba(0,0,0,0.55), inset 0 1px 0 rgba(255,255,255,0.28), inset 0 -1px 0 rgba(255,255,255,0.06)",
          }}
        >
          <SlidingNav
            isLight={isLight}
            activeId={activeTab}
            tabs={[
              {
                id: "home",
                label: "Home",
                Icon: Home,
                onSelect: () => {
                  setActiveTab("home");
                  setSearchQuery("");
                  window.scrollTo({ top: 0, behavior: "smooth" });
                },
              },
              {
                id: "explore",
                label: "Explore",
                Icon: Compass,
                onSelect: () => {
                  setActiveTab("explore");
                  setExploreView("grid");
                  setSearchQuery("");
                  window.scrollTo({ top: 0, behavior: "smooth" });
                },
              },
              {
                id: "saved",
                label: "Saved",
                Icon: Bookmark,
                onSelect: () => {
                  if (!user)
                    requireAuthForAction(
                      "Sign in to view and sync your saved wallpapers across devices.",
                      { type: "saved_tab" }
                    );
                  else {
                    setActiveTab("saved");
                    window.scrollTo({ top: 0, behavior: "smooth" });
                  }
                },
              },
              {
                id: "profile",
                label: "Profile",
                Icon: UserIcon,
                onSelect: () => {
                  setActiveTab("profile");
                  window.scrollTo({ top: 0, behavior: "smooth" });
                },
              },
            ]}
          />
        </div>
      </nav>

      {/* ================= WALLPAPER DETAIL SCREEN ================= */}
      {selectedWallpaper && (
        <div
          ref={detailScrollRef}
          role="dialog"
          aria-modal="true"
          aria-label={selectedWallpaper.title}
          className={`fixed inset-0 z-50 overflow-y-auto ${
            detailClosing ? "fusion-sheet-out" : "fusion-sheet-in"
          } ${isLight ? "bg-[#F4FEFF]" : "bg-[#000000]"}`}
        >
          <div className="relative z-10 max-w-6xl mx-auto px-4 pt-3 pb-12 flex flex-col items-center">
            <div className="w-full max-w-3xl flex items-center justify-between mb-2.5">
              <GlassButton
                typeShape="circle"
                size={40}
                tintOpacity={0.14}
                aria-label="Go back"
                onClick={closeWallpaperDetail}
              >
                <ChevronLeft className="h-5 w-5" />
              </GlassButton>

              <div className="text-center px-2">
                <h1 className="text-base sm:text-lg font-bold tracking-wide">
                  {selectedWallpaper.title}
                </h1>
                <p className="text-[11px] opacity-60 capitalize">
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
                tintOpacity={0.14}
                aria-label="Share wallpaper"
                onClick={(e) => handleShareWallpaper(e, selectedWallpaper)}
              >
                <Share2 className="h-4 w-4" />
              </GlassButton>
            </div>

            {isAdmin && (
              <div className="mb-2 w-full flex justify-end">
                <GlassButton
                  typeShape="pill"
                  onClick={() => {
                    const currentCuration = extractCurationFromWallpaper(
                      selectedWallpaper,
                      curationOverrides
                    );
                    setEditCategorySelection(
                      selectedWallpaper.category || "none"
                    );
                    setEditSetAsBanner(!!selectedWallpaper.is_banner);
                    setEditShowInHero(currentCuration.isHero);
                    setEditTop10Rank(
                      currentCuration.top10Rank
                        ? String(currentCuration.top10Rank)
                        : "none"
                    );
                    setIsEditModalOpen(true);
                  }}
                  className="h-8 px-3.5 text-[11px] font-bold"
                >
                  <Edit3 className="h-3 w-3" />
                  <span>Edit Wallpaper</span>
                </GlassButton>
              </div>
            )}

            {/* WALLPAPER PREVIEW BOX */}
            <div
              key={selectedWallpaper.id}
              onPointerDown={detailSlides ? onSwipeStart : undefined}
              onPointerUp={detailSlides ? (e) => onSwipeEnd(e, stepDetail) : undefined}
              style={{ touchAction: detailSlides ? "pan-y" : undefined }}
              className={`relative inline-block rounded-3xl overflow-hidden bg-[#0a0a0a] border mx-auto w-fit max-w-full mb-3 fusion-photo-in ${
                isLight
                  ? "border-[#0E2F76]/25 shadow-[0_30px_60px_-15px_rgba(14,47,118,0.55),0_12px_24px_-8px_rgba(14,47,118,0.35),0_2px_6px_rgba(14,47,118,0.2)]"
                  : "border-white/25 shadow-2xl"
              } ${detailRatio === undefined ? "min-h-[50vh] min-w-[60vw]" : ""}`}
            >
              <img
                src={
                  detailSrc && detailSrc.id === selectedWallpaper.id
                    ? detailSrc.src
                    : img(selectedWallpaper, 500)
                }
                decoding="async"
                alt={selectedWallpaper.title}
                draggable={false}
                onContextMenu={(e) => e.preventDefault()}
                className={`block pointer-events-none select-none transition-all duration-300 ${
                  detailIsTall && !isExpanded
                    ? "w-auto max-w-full max-h-[62vh] aspect-[9/16] object-cover"
                    : "w-auto max-w-full h-auto max-h-[75vh] object-contain"
                } ${detailDir === 1 ? "fusion-in-right" : detailDir === -1 ? "fusion-in-left" : ""}`}
              />

              <div
                className="absolute inset-0 z-10 bg-transparent"
                onContextMenu={(e) => e.preventDefault()}
              />

              {detailIsTall && (
                <button
                  type="button"
                  aria-label={isExpanded ? "Show less" : "View full wallpaper"}
                  onPointerDown={(e) => e.stopPropagation()}
                  onClick={() => setIsExpanded(!isExpanded)}
                  className="fusion-bounce absolute left-3 top-3 z-20 flex h-10 w-10 items-center justify-center overflow-hidden rounded-full border border-white/35 bg-white/[0.035] text-white shadow-[inset_0_1px_1px_rgba(255,255,255,0.65),inset_0_-1px_2px_rgba(255,255,255,0.12),0_2px_8px_rgba(0,0,0,0.12)] transition-transform duration-200 active:scale-90"
                  style={{
                    backdropFilter: "blur(2px) saturate(110%)",
                    WebkitBackdropFilter: "blur(2px) saturate(110%)",
                  }}
                >
                  {isExpanded ? (
                    <Minimize2 className="h-5 w-5" strokeWidth={2.2} />
                  ) : (
                    <Maximize2 className="h-5 w-5" strokeWidth={2.2} />
                  )}
                </button>
              )}

              {detailSlides && (
                <>
                  <span className="absolute right-3 top-3 z-20 rounded-full bg-black/50 px-2 py-0.5 text-[10px] font-semibold text-white">
                    {detailSlides.findIndex((s) => s.id === selectedWallpaper.id) + 1} / {detailSlides.length}
                  </span>
                  <button
                    type="button"
                    aria-label="Previous wallpaper"
                    onPointerDown={(e) => e.stopPropagation()}
                    onClick={() => stepDetail(-1)}
                    className="hidden md:flex absolute left-2 top-1/2 z-20 h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full bg-black/45 text-white backdrop-blur-sm"
                  >
                    <ChevronLeft className="h-5 w-5" />
                  </button>
                  <button
                    type="button"
                    aria-label="Next wallpaper"
                    onPointerDown={(e) => e.stopPropagation()}
                    onClick={() => stepDetail(1)}
                    className="hidden md:flex absolute right-2 top-1/2 z-20 h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full bg-black/45 text-white backdrop-blur-sm"
                  >
                    <ChevronRight className="h-5 w-5" />
                  </button>
                </>
              )}
            </div>

            {detailSlides && (
              <div className="mb-3 -mt-1 flex items-center justify-center gap-1.5">
                {detailSlides.map((s) => (
                  <span
                    key={s.id}
                    className={`h-1.5 rounded-full transition-all duration-200 ${
                      s.id === selectedWallpaper.id
                        ? `w-4 ${isLight ? "bg-[#0E2F76]" : "bg-white"}`
                        : `w-1.5 ${isLight ? "bg-[#0E2F76]/25" : "bg-white/35"}`
                    }`}
                  />
                ))}
              </div>
            )}

            {/* SIDE-BY-SIDE LIQUID GLASS SAVE & DOWNLOAD BUTTONS */}
            <div className="flex items-center gap-3 w-full max-w-md mb-5">
              <GlassButton
                typeShape="pill"
                tintOpacity={0.14}
                activeWhite={savedIds.includes(selectedWallpaper.id)}
                onClick={(e) => toggleSaveWallpaper(e, selectedWallpaper)}
                disabled={savingInProgressIds.includes(selectedWallpaper.id)}
                className="flex-1 h-12 text-xs font-bold"
              >
                <Bookmark
                  key={String(savedIds.includes(selectedWallpaper.id))}
                  className={`h-4 w-4 ${
                    savedIds.includes(selectedWallpaper.id)
                      ? (isLight ? "fill-white text-white" : "fill-black text-black") + " fusion-pop"
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
                onClick={() =>
                  detailSlides
                    ? setDownloadChoice({ current: selectedWallpaper, slides: detailSlides })
                    : triggerDirectDownload(selectedWallpaper)
                }
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
                className="fusion-rise mb-4 w-full max-w-md p-3 text-xs flex items-center justify-between"
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
                    onClick={() =>
                      detailSlides
                        ? setDownloadChoice({ current: selectedWallpaper, slides: detailSlides })
                        : triggerDirectDownload(selectedWallpaper)
                    }
                    className="underline font-semibold ml-2"
                  >
                    Retry
                  </button>
                )}
              </GlassContainer>
            )}

            {/* RELATED WALLPAPERS SECTION */}
            <div className="w-full pt-3 border-t border-white/10">
              <h3 className="text-sm font-bold tracking-wide mb-3">
                Related wallpapers
              </h3>
              {relatedWallpapers.length === 0 ? (
                <p className="text-xs opacity-50">
                  More wallpapers coming soon.
                </p>
              ) : (
                <>
                  {renderMasonry(relatedWallpapers.slice(0, relatedVisibleCount))}
                  {relatedVisibleCount < relatedWallpapers.length && (
                    <div className="mt-4 text-center">
                      <GlassButton
                        typeShape="pill"
                        onClick={() =>
                          setRelatedVisibleCount((prev) => prev + Math.max(8, colCount * 2))
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

      {/* ================= DOWNLOAD CHOICE MODAL ================= */}
      <Dialog open={!!downloadChoice} onOpenChange={(o) => !o && setDownloadChoice(null)}>
        <DialogContent
          style={{ background: "rgba(10, 10, 14, 0.92)" }}
          className="glass-container glass-container-rounded border-white/20 text-white sm:max-w-sm p-5"
        >
          <DialogHeader>
            <DialogTitle className="text-center text-base font-black text-white">
              Download
            </DialogTitle>
            <DialogDescription className="text-center text-xs text-white/60">
              This post has {downloadChoice?.slides.length} wallpapers. What would you like to save?
            </DialogDescription>
          </DialogHeader>
          <div className="mt-3 space-y-2">
            <GlassButton
              typeShape="pill"
              activeWhite={true}
              className="w-full h-11 text-xs font-bold"
              onClick={() => {
                const c = downloadChoice!.current;
                setDownloadChoice(null);
                triggerDirectDownload(c);
              }}
            >
              Download this wallpaper
            </GlassButton>
            <GlassButton
              typeShape="pill"
              className="w-full h-11 text-xs font-bold"
              onClick={async () => {
                const all = downloadChoice!.slides;
                setDownloadChoice(null);
                for (const w of all) {
                  await triggerDirectDownload(w);
                  await new Promise((r) => setTimeout(r, 600));
                }
              }}
            >
              Download all {downloadChoice?.slides.length} wallpapers
            </GlassButton>
          </div>
        </DialogContent>
      </Dialog>

      {/* ================= AUTHENTICATION MODAL ================= */}
      <Dialog open={isAuthModalOpen} onOpenChange={setIsAuthModalOpen}>
        <DialogContent
          style={{
            background: "rgba(10, 10, 14, 0.88)",
          }}
          className="glass-container glass-container-rounded border-white/20 text-white sm:max-w-md p-5 shadow-[0_25px_70px_rgba(0,0,0,0.95)]"
        >
          <DialogHeader>
            <div className="mx-auto h-11 w-11 rounded-2xl overflow-hidden border border-white/20 mb-1">
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
            <DialogDescription className="text-center text-white/75 text-[11px]">
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

          {(authStep === "SIGN_IN" || authStep === "SIGN_UP") && (
            <OAuthButtons
              onGoogle={() => handleOAuthSignIn("google")}
              onApple={() => handleOAuthSignIn("apple")}
            />
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
                    className="pl-10 bg-black/70 border-white/20 text-white placeholder:text-white/40 rounded-xl h-10 text-xs w-full"
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
                <PasswordInput
                  required
                  placeholder="••••••••"
                  value={authPassword}
                  onChange={(e) => setAuthPassword(e.target.value)}
                  className="bg-black/70 border-white/20 text-white placeholder:text-white/40 rounded-xl h-10 text-xs w-full"
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
                    className="pl-10 bg-black/70 border-white/20 text-white placeholder:text-white/40 rounded-xl h-10 text-xs w-full"
                  />
                </div>
              </div>
              <div className="space-y-1">
                <label className="text-[11px] font-semibold text-white/90 block">
                  Create Password (min. 6 chars)
                </label>
                <PasswordInput
                  required
                  placeholder="••••••••"
                  value={authPassword}
                  onChange={(e) => setAuthPassword(e.target.value)}
                  className="bg-black/70 border-white/20 text-white placeholder:text-white/40 rounded-xl h-10 text-xs w-full"
                />
              </div>
              <div className="space-y-1">
                <label className="text-[11px] font-semibold text-white/90 block">
                  Confirm Password
                </label>
                <PasswordInput
                  required
                  placeholder="••••••••"
                  value={authConfirmPassword}
                  onChange={(e) => setAuthConfirmPassword(e.target.value)}
                  className="bg-black/70 border-white/20 text-white placeholder:text-white/40 rounded-xl h-10 text-xs w-full"
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
                    className="pl-10 bg-black/70 border-white/20 text-white placeholder:text-white/40 rounded-xl h-10 text-xs w-full"
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
                <PasswordInput
                  required
                  placeholder="••••••••"
                  value={authPassword}
                  onChange={(e) => setAuthPassword(e.target.value)}
                  className="bg-black/70 border-white/20 text-white rounded-xl h-10 text-xs w-full"
                />
              </div>
              <div className="space-y-1">
                <label className="text-[11px] font-semibold text-white/90 block">
                  Confirm New Password
                </label>
                <PasswordInput
                  required
                  placeholder="••••••••"
                  value={authConfirmPassword}
                  onChange={(e) => setAuthConfirmPassword(e.target.value)}
                  className="bg-black/70 border-white/20 text-white rounded-xl h-10 text-xs w-full"
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
            background: "rgba(10, 10, 14, 0.88)",
          }}
          className="glass-container glass-container-rounded border-white/20 text-white sm:max-w-md p-5"
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
                className="bg-black/70 border-white/20 text-white rounded-xl h-10 text-xs"
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
                  className="bg-black/70 border-white/20 text-white rounded-xl h-10 text-xs"
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
                    className="bg-black/70 border-white/20 text-white rounded-xl h-10 text-xs"
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
            background: "rgba(10, 10, 14, 0.88)",
          }}
          className="glass-container glass-container-rounded border-white/20 text-white sm:max-w-md p-5 max-h-[88vh] overflow-y-auto overscroll-contain"
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
                placeholder="e.g., Sung Jin-woo"
                value={uploadTitle}
                onChange={(e) => setUploadTitle(e.target.value)}
                className="bg-black/70 border-white/20 text-white placeholder:text-white/40 rounded-xl h-10 text-xs"
              />
            </div>

            <div className="grid grid-cols-2 gap-2.5">
              <div className="space-y-1">
                <label className="text-[11px] font-semibold text-white/85 block">
                  Anime Category
                </label>
                <select
                  value={uploadCategory}
                  onChange={(e) => setUploadCategory(e.target.value)}
                  className="w-full h-10 bg-black/70 border border-white/20 text-white text-xs rounded-xl px-2.5 focus:outline-none"
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
                  PC Top 10 Rank
                </label>
                <select
                  value={uploadTop10Rank}
                  onChange={(e) => setUploadTop10Rank(e.target.value)}
                  className="w-full h-10 bg-black/70 border border-white/20 text-white text-xs rounded-xl px-2.5 focus:outline-none"
                >
                  <option value="none" className="bg-black text-white">
                    Auto (Not pinned)
                  </option>
                  {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((num) => (
                    <option
                      key={num}
                      value={String(num)}
                      className="bg-black text-white"
                    >
                      Rank #{num}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="flex items-center gap-2 pt-0.5">
              <input
                type="checkbox"
                id="uploadHeroCheck"
                checked={uploadShowInHero}
                onChange={(e) => setUploadShowInHero(e.target.checked)}
                className="h-4 w-4 rounded border-white/30 text-white focus:ring-white bg-black/50 cursor-pointer"
              />
              <label
                htmlFor="uploadHeroCheck"
                className="text-xs font-medium text-white cursor-pointer select-none"
              >
                Show in PC Top Hero Banner
              </label>
            </div>

            <div className="space-y-1">
              <label className="text-[11px] font-semibold text-white/85 block">
                Wallpaper Image File
              </label>
              <Input
                type="file"
                accept="image/*"
                multiple
                onChange={(e) => {
                  const picked = Array.from(e.target.files || []);
                  const MAX = 30 * 1024 * 1024;
                  const tooBig = picked.filter((f) => f.size > MAX);
                  if (tooBig.length) alert(`Over 30 MB, skipped: ${tooBig.map((f) => f.name).join(", ")}`);
                  setUploadFiles((prev) => [
                    ...prev,
                    ...picked
                      .filter((f) => f.size <= MAX)
                      .map((file) => ({
                        id: `${file.name}-${file.size}-${Math.random().toString(36).slice(2, 6)}`,
                        file,
                        url: URL.createObjectURL(file),
                      })),
                  ]);
                  e.target.value = "";
                }}
                className="bg-black/70 border-white/20 text-white/80 file:bg-white file:text-black file:border-0 file:rounded-lg file:px-2 file:py-1 file:mr-2 file:text-[11px] file:font-bold rounded-xl h-10 py-1 text-xs"
              />
            </div>

            {uploadFiles.length > 0 && (
              <div className="space-y-2">
                <p className="text-[11px] text-white/60">
                  {uploadFiles.length > 1
                    ? "Batch: #1 shows first. Use the arrows to change the order."
                    : "1 wallpaper selected."}
                </p>
                <div className="grid grid-cols-3 gap-2">
                  {uploadFiles.map((f, i) => (
                    <div key={f.id} className="relative overflow-hidden rounded-xl border border-white/15 bg-black">
                      <img src={f.url} alt="" className="aspect-[9/16] w-full object-cover" />
                      <span className="absolute left-1 top-1 rounded-full bg-black/60 px-1.5 text-[10px] font-bold text-white">
                        {i + 1}
                      </span>
                      <div className="absolute inset-x-0 bottom-0 flex items-center justify-between bg-black/60 p-1 text-white">
                        <button type="button" aria-label="Move earlier" disabled={i === 0} onClick={() => moveUpload(i, -1)} className="disabled:opacity-30">
                          <ChevronLeft className="h-4 w-4" />
                        </button>
                        <button type="button" aria-label="Remove" onClick={() => removeUpload(f.id)}>
                          <Trash2 className="h-3.5 w-3.5 text-red-400" />
                        </button>
                        <button type="button" aria-label="Move later" disabled={i === uploadFiles.length - 1} onClick={() => moveUpload(i, 1)} className="disabled:opacity-30">
                          <ChevronRight className="h-4 w-4" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <GlassButton
              type="submit"
              typeShape="pill"
              activeWhite={true}
              disabled={uploading || uploadFiles.length === 0}
              className="w-full h-11 text-xs font-extrabold mt-1"
            >
              {uploading ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  <span>Uploading...</span>
                </>
              ) : (
                uploadFiles.length > 1 ? `Publish ${uploadFiles.length} wallpapers` : "Publish Wallpaper"
              )}
            </GlassButton>
          </form>
        </DialogContent>
      </Dialog>

      {/* ================= ADMIN EDIT WALLPAPER MODAL ================= */}
      <Dialog open={isEditModalOpen} onOpenChange={setIsEditModalOpen}>
        <DialogContent
          style={{
            background: "rgba(10, 10, 14, 0.88)",
          }}
          className="glass-container glass-container-rounded border-white/20 text-white sm:max-w-md p-5"
        >
          <DialogHeader>
            <DialogTitle className="text-base font-black text-white">
              Edit Wallpaper & PC Placement
            </DialogTitle>
            <DialogDescription className="text-[11px] text-white/75">
              Update category, anime banner, PC Hero Banner, or Top 10 ranking.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleAdminEditSubmit} className="space-y-3 mt-1">
            <div className="grid grid-cols-2 gap-2.5">
              <div className="space-y-1">
                <label className="text-[11px] font-semibold text-white/85 block">
                  Select Category
                </label>
                <select
                  value={editCategorySelection}
                  onChange={(e) => setEditCategorySelection(e.target.value)}
                  className="w-full h-10 bg-black/70 border border-white/20 text-white text-xs rounded-xl px-2.5 focus:outline-none"
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
                  PC Top 10 Rank
                </label>
                <select
                  value={editTop10Rank}
                  onChange={(e) => setEditTop10Rank(e.target.value)}
                  className="w-full h-10 bg-black/70 border border-white/20 text-white text-xs rounded-xl px-2.5 focus:outline-none"
                >
                  <option value="none" className="bg-black text-white">
                    Auto (Not pinned)
                  </option>
                  {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((num) => (
                    <option
                      key={num}
                      value={String(num)}
                      className="bg-black text-white"
                    >
                      Rank #{num}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="space-y-2 pt-1">
              <div className="flex items-center gap-2">
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

              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="editHeroCheck"
                  checked={editShowInHero}
                  onChange={(e) => setEditShowInHero(e.target.checked)}
                  className="h-4 w-4 rounded border-white/30 text-white focus:ring-white bg-black/50 cursor-pointer"
                />
                <label
                  htmlFor="editHeroCheck"
                  className="text-xs font-medium text-white cursor-pointer select-none"
                >
                  Show in PC Top Hero Banner
                </label>
              </div>
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
