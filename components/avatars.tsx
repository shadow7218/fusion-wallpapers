"use client";
import {
  Flame, Moon, Zap, Swords, Ghost, Crown, Skull, Star,
  Heart, Sparkles, Cat, Rocket, Eye, Shield,
  type LucideIcon,
} from "lucide-react";

export const AVATARS: { id: string; from: string; to: string; Icon: LucideIcon }[] = [
  { id: "ember", from: "#5a1414", to: "#f0803c", Icon: Flame },
  { id: "moon", from: "#141a3a", to: "#6c7ae0", Icon: Moon },
  { id: "bolt", from: "#3a3000", to: "#f5d142", Icon: Zap },
  { id: "blade", from: "#1a1a1a", to: "#8a8f98", Icon: Swords },
  { id: "ghost", from: "#2a1a3a", to: "#b48cf0", Icon: Ghost },
  { id: "crown", from: "#3a2a00", to: "#e0b040", Icon: Crown },
  { id: "skull", from: "#1a1a1a", to: "#d8d8d8", Icon: Skull },
  { id: "star", from: "#0f2a3a", to: "#5ac8f0", Icon: Star },
  { id: "heart", from: "#3a0f1f", to: "#f06a8a", Icon: Heart },
  { id: "spark", from: "#2a0f3a", to: "#e06af0", Icon: Sparkles },
  { id: "cat", from: "#2a1f0f", to: "#d9a066", Icon: Cat },
  { id: "rocket", from: "#0f2a1f", to: "#5af0a0", Icon: Rocket },
  { id: "eye", from: "#3a0f0f", to: "#f04a4a", Icon: Eye },
  { id: "shield", from: "#0f1f3a", to: "#4a8af0", Icon: Shield },
];

export function AvatarBadge({
  id, name, size = 44,
}: { id?: string | null; name?: string; size?: number }) {
  const a = AVATARS.find((x) => x.id === id);
  if (!a) {
    return (
      <div
        style={{ width: size, height: size }}
        className="rounded-full bg-white/10 border border-white/20 flex items-center justify-center font-bold uppercase text-white shrink-0"
      >
        <span style={{ fontSize: size * 0.4 }}>{(name || "U")[0]}</span>
      </div>
    );
  }
  const I = a.Icon;
  return (
    <div
      style={{ width: size, height: size, background: `linear-gradient(135deg, ${a.from}, ${a.to})` }}
      className="rounded-full border border-white/20 flex items-center justify-center shrink-0"
    >
      <I style={{ width: size * 0.5, height: size * 0.5 }} className="text-white" />
    </div>
  );
}
