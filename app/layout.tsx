import type { Metadata, Viewport } from "next";
import "./globals.css";
import "./liquid-glass.css";

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
  themeColor: "#070707",
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
      <body className="bg-[#070707] text-[#E5E4E2] antialiased">
        {children}
      </body>
    </html>
  );
}
