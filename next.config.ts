import type { NextConfig } from "next";

// Basic browser protections sent with every page.
const securityHeaders = [
  // nobody can show Fusion inside another site's frame (stops clickjacking)
  { key: "X-Frame-Options", value: "DENY" },
  // browsers must trust the file type we send
  { key: "X-Content-Type-Options", value: "nosniff" },
  // don't leak full page addresses to other sites
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  // the site never needs these device features
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), payment=()" },
  // always use https
  { key: "Strict-Transport-Security", value: "max-age=31536000; includeSubDomains" },
];

const nextConfig: NextConfig = {
  async headers() {
    return [{ source: "/:path*", headers: securityHeaders }];
  },
};

export default nextConfig;
