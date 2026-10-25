import type { Metadata, Viewport } from "next";
import "./globals.css";
import "./liquid-glass.css";
import { PixelLiquidBg } from "@/components/unlumen-ui/components/backgrounds/pixel-liquid-bg";

export const metadata: Metadata = {
  title: "Fusion Wallpapers",
  description: "Discover and download high-resolution anime wallpapers.",
  applicationName: "Fusion Wallpapers",
  manifest: "/manifest.json",
  icons: {
    icon: "/logo.webp",
    shortcut: "/logo.webp",
    apple: "/logo.webp",
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "Fusion Wallpapers",
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
    <html lang="en">
      <head>
        <link rel="manifest" href="/manifest.json" />
        <link rel="icon" href="/logo.webp" type="image/webp" />
        <link rel="apple-touch-icon" href="/logo.webp" />
      </head>
      <body className="bg-[#000000] text-[#E5E4E2] antialiased min-h-screen relative">
        {/* Fixed OLED Black Pixel Liquid Live Background */}
        <PixelLiquidBg
          className="fixed inset-0 w-full h-full pointer-events-none z-0"
          darkPalette={["#000000", "#16000c", "#b8004c", "#ff2a7a"]}
          pixelSize={3}
          resolution={0.42}
          mouseForce={8}
        />
        <div className="relative z-10">{children}</div>
      </body>
    </html>
  );
}
