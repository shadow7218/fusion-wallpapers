import type { Metadata, Viewport } from "next";
import { ogImg } from "@/lib/img";
import CookieConsent from "@/components/CookieConsent";
import "./globals.css";
import "./liquid-glass.css";

export const metadata: Metadata = {
  metadataBase: new URL("https://fusion-wallpapers.vercel.app"),
  title: "Fusion Wallpapers - Find Your Perfect Anime Wallpaper",
  description:
    "Discover and download high-quality anime, gaming, and aesthetic wallpapers for your phone and PC.",
  applicationName: "Fusion Wallpapers",
  manifest: "/manifest.json",
  icons: { 
    icon: "/logo.webp", 
    shortcut: "/logo.webp", 
    apple: "/app-icon/apple-touch-icon.png" // <-- Updated here
  },
  appleWebApp: { capable: true, statusBarStyle: "black-translucent", title: "Fusion Wallpapers" },
  openGraph: {
    title: "Fusion Wallpapers - Find Your Perfect Anime Wallpaper",
    description:
      "Discover and download high-quality anime, gaming, and aesthetic wallpapers for your phone and PC.",
    url: "/",
    siteName: "Fusion Wallpapers",
    type: "website",
    images: [{ url: ogImg("https://fusion-wallpapers.vercel.app/logo.webp") }],
  },
  twitter: {
    card: "summary",
    title: "Fusion Wallpapers - Find Your Perfect Anime Wallpaper",
    description:
      "Discover and download high-quality anime, gaming, and aesthetic wallpapers for your phone and PC.",
    images: [ogImg("https://fusion-wallpapers.vercel.app/logo.webp")],
  },
};

export const viewport: Viewport = {
  themeColor: "#000000",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="bg-[#000000]">
      <head>
        <link rel="manifest" href="/manifest.json" />
        <link rel="icon" href="/logo.webp" type="image/webp" />
        {/* Updated the apple-touch-icon href below */}
        <link rel="apple-touch-icon" href="/app-icon/apple-touch-icon.png" /> 
      </head>
      <body className="bg-[#000000] text-[#E5E4E2] antialiased min-h-screen relative">
        {children}
        <CookieConsent />
      </body>
    </html>
  );
}
