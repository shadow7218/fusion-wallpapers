import { neon } from "@neondatabase/serverless";
import { betterAuth } from "better-auth";

if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL environment variable is missing.");
}

export const sql = neon(process.env.DATABASE_URL);

export const auth = betterAuth({
  database: sql,
  emailAndPassword: {
    enabled: true,
  },
  socialProviders: {
    google: {
      enabled: true,
      clientId: process.env.GOOGLE_CLIENT_ID || "",
      clientSecret: process.env.GOOGLE_CLIENT_SECRET || "",
    },
  },
});
