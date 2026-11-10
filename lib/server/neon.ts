/**
 * lib/server/neon.ts  -  server-only helpers for the Neon database.
 * Used by the API routes in app/api/*. Never import this from a client component.
 */
import { headers } from "next/headers";
import { neon } from "@neondatabase/serverless";
import { auth } from "@/lib/auth/server";

export function getSql() {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL is not set");
  return neon(url);
}

export interface SessionUser {
  id: string;
  email: string;
  name: string;
  isAdmin: boolean;
}

/** Who is logged in right now (from the Neon Auth cookie). Null if nobody. */
export async function getSessionUser(): Promise<SessionUser | null> {
  // Safety: if the request comes from ANOTHER website, never treat it as logged in.
  // (Stops other sites from using a visitor's login cookie to act on their behalf.)
  const h = await headers();
  const origin = h.get("origin");
  const host = h.get("x-forwarded-host") || h.get("host");
  if (origin) {
    try {
      if (new URL(origin).host !== host) return null;
    } catch {
      return null;
    }
  }

  const { data: session } = await auth.getSession();
  const u = session?.user;
  if (!u?.id) return null;
  const email = String(u.email || "").toLowerCase();
  const admins = (process.env.ADMIN_EMAILS || "")
    .split(",")
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
  return {
    id: String(u.id),
    email,
    name: String(u.name || ""),
    // admin = on the ADMIN_EMAILS list AND the email is verified
    isAdmin: !!email && admins.includes(email) && (u as any).emailVerified !== false,
  };
}

export function json(data: unknown, status = 200) {
  return Response.json(data, { status, headers: { "Cache-Control": "no-store" } });
}

export const fail = (message: string, status = 400) => json({ error: message }, status);
