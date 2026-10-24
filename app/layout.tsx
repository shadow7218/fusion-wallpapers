import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Fusion Wallpapers",
  description: "Discover and download premium anime wallpapers.",
  manifest: "/manifest.json",
  icons: {
    icon: "/logo.webp",
    apple: "/logo.webp",
  },
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
        <meta name="theme-color" content="#070707" />
      </head>
      <body className="bg-[#070707] text-[#E5E4E2] antialiased">
        {children}
      </body>
    </html>
  );
}
