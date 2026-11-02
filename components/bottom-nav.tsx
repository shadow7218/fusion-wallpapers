"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { Home, Compass, Bookmark, User } from "lucide-react";

interface NavItem {
  name: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
}

const NAV_ITEMS: NavItem[] = [
  { name: "Home", href: "/", icon: Home },
  { name: "Explore", href: "/explore", icon: Compass },
  { name: "Saved", href: "/saved", icon: Bookmark },
  { name: "Profile", href: "/profile", icon: User },
];

export function BottomNav() {
  const pathname = usePathname();
  const [isVisible, setIsVisible] = useState(true);
  const [lastScrollY, setLastScrollY] = useState(0);

  useEffect(() => {
    const handleScroll = () => {
      const currentScrollY = window.scrollY;
      if (currentScrollY > lastScrollY && currentScrollY > 70) {
        // Scrolling down -> smoothly tuck away
        setIsVisible(false);
      } else {
        // Scrolling up -> bring back
        setIsVisible(true);
      }
      setLastScrollY(currentScrollY);
    };

    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, [lastScrollY]);

  return (
    <AnimatePresence>
      <motion.div
        initial={{ y: 80, opacity: 0 }}
        animate={{
          y: isVisible ? 0 : 75,
          opacity: isVisible ? 1 : 0.85,
        }}
        transition={{ type: "spring", stiffness: 350, damping: 28 }}
        className="fixed bottom-5 inset-x-0 z-50 flex justify-center items-center px-4 pointer-events-none select-none"
      >
        <nav
          aria-label="Mobile Navigation"
          className="pointer-events-auto relative flex items-center gap-1.5 px-3 py-2 rounded-full bg-black/75 backdrop-blur-2xl border border-white/[0.12] shadow-[0_8px_32px_0_rgba(0,0,0,0.7)]"
        >
          {NAV_ITEMS.map((item) => {
            const isActive =
              item.href === "/"
                ? pathname === "/"
                : pathname?.startsWith(item.href);
            const Icon = item.icon;

            return (
              <Link
                key={item.name}
                href={item.href}
                className="relative flex flex-col items-center justify-center w-14 h-12 rounded-full text-xs font-medium transition-colors"
              >
                {isActive && (
                  <motion.div
                    layoutId="activeNavPill"
                    transition={{
                      type: "spring",
                      stiffness: 420,
                      damping: 32,
                    }}
                    className="absolute inset-0 rounded-full bg-white/[0.12] border border-white/[0.18]"
                  />
                )}

                <motion.div
                  animate={{
                    scale: isActive ? 1.08 : 1,
                    color: isActive ? "#ffffff" : "#a1a1aa",
                  }}
                  whileTap={{ scale: 0.9 }}
                  transition={{ duration: 0.2 }}
                  className="relative z-10 flex flex-col items-center justify-center gap-0.5"
                >
                  <Icon className="w-5 h-5 transition-transform" />
                  <span className="text-[10px] tracking-tight">
                    {item.name}
                  </span>
                </motion.div>
              </Link>
            );
          })}
        </nav>
      </motion.div>
    </AnimatePresence>
  );
}

export default BottomNav;
