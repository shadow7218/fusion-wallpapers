"use client";

import { createAuthClient } from "@neon/auth/next";

// Neon Auth in the browser (used only by lib/db.ts).
export const authClient = createAuthClient();
