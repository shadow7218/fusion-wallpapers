import { auth } from "@/lib/auth/server";

// All login / sign-up / OAuth requests go through this proxy.
export const { GET, POST, PUT, PATCH, DELETE } = auth.handler();
