import { createNeonAuth } from "@neon/auth/next/server";

// Neon Auth (login + sign-up) on the server.
// Needs: NEON_AUTH_BASE_URL and NEON_AUTH_COOKIE_SECRET (32+ random characters).
export const auth = createNeonAuth({
  baseUrl: process.env.NEON_AUTH_BASE_URL!,
  cookies: {
    secret: process.env.NEON_AUTH_COOKIE_SECRET!,
    // "lax" lets the login cookie survive the trip to Google and back
    // (the default "strict" can drop it on that cross-site return).
    sameSite: "lax",
  },
});
