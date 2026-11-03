"use client";

import React from "react";
import type { AppUser } from "@/lib/db";
import { Upload, Settings, User as UserIcon } from "lucide-react";
import { GlassButton } from "@/components/liquid-glass/LiquidGlass";
import { AvatarBadge } from "@/components/avatars";

interface UserProfile {
  id: string;
  display_name: string;
}

interface HeaderProps {
  isLight: boolean;
  user: AppUser | null;
  profile: UserProfile | null;
  activeTab: string;
  isAdmin: boolean;
  onHomeClick: () => void;
  onProfileClick: () => void;
  onSettingsClick: () => void;
  onUploadClick: () => void;
  onSignInClick: () => void;
}

export default function Header({
  isLight,
  user,
  profile,
  activeTab,
  isAdmin,
  onHomeClick,
  onProfileClick,
  onSettingsClick,
  onUploadClick,
  onSignInClick,
}: HeaderProps) {
  return (
    <header
      className={`sticky top-0 z-30 backdrop-blur-xl px-3 md:px-4 pt-3 pb-2.5 border-b transition-colors ${
        isLight
          ? "bg-[#F4FEFF]/80 border-[#0E2F76]/10 shadow-[0_2px_12px_rgba(14,47,118,0.08)]"
          : "bg-black/70 border-white/10"
      }`}
    >
      <div className="max-w-6xl mx-auto flex items-center justify-between">
        <button
          type="button"
          onClick={onHomeClick}
          className="flex items-center gap-2.5 text-left focus:outline-none group active:scale-95 transition-transform"
        >
          <div className="h-8 w-8 rounded-xl bg-white/5 border border-white/20 flex items-center justify-center overflow-hidden shrink-0">
            <img
              src="/logo.webp"
              alt="Fusion Logo"
              className="h-full w-full object-cover"
            />
          </div>
          <span
            className={`text-base sm:text-lg font-black tracking-[0.22em] uppercase ${
              isLight ? "text-[#0E2F76]" : "text-white"
            }`}
          >
            FUSION
          </span>
        </button>

        <div className="flex items-center gap-2">
          {isAdmin && (
            <GlassButton
              typeShape="pill"
              activeWhite={true}
              onClick={onUploadClick}
              className="px-3.5 h-9 text-xs font-bold"
            >
              <Upload className="h-3.5 w-3.5" />
              <span>Upload</span>
            </GlassButton>
          )}

          {user && activeTab === "profile" ? (
            <GlassButton
              typeShape="pill"
              tintOpacity={0.14}
              aria-label="Open settings"
              onClick={onSettingsClick}
              className="h-9 px-4 gap-2 text-xs font-semibold shrink-0"
            >
              <Settings className={`h-4 w-4 ${isLight ? "text-[#0E2F76]" : "text-white"}`} />
              <span>Settings</span>
            </GlassButton>
          ) : user ? (
            <GlassButton
              typeShape="pill"
              tintOpacity={0.14}
              onClick={onProfileClick}
              className="px-3.5 h-9 text-xs font-semibold"
            >
              <AvatarBadge id={user.avatarId} name={profile?.display_name} size={20} />
              <span className="max-w-[85px] truncate">
                {profile?.display_name || "Shadow"}
              </span>
            </GlassButton>
          ) : (
            <GlassButton
              typeShape="pill"
              tintOpacity={0.14}
              onClick={onSignInClick}
              className="px-4 h-9 text-xs font-semibold"
            >
              <UserIcon className="h-3.5 w-3.5" />
              <span>Sign In</span>
            </GlassButton>
          )}
        </div>
      </div>
    </header>
  );
}
