import { CATEGORY_LIST } from "@/types/categories";

/** Static paths and system names that cannot be claimed as usernames. */
const STATIC_RESERVED = [
  "admin",
  "api",
  "login",
  "logout",
  "signup",
  "sign-up",
  "register",
  "setup",
  "profile",
  "settings",
  "forgot-password",
  "reset-password",
  "u",
  "user",
  "users",
  "public",
  "static",
  "assets",
  "covers",
  "favicon.ico",
  "robots.txt",
  "sitemap.xml",
  "compare",
  "new",
  "edit",
  "auth",
  "health",
  "status",
  "app",
  "www",
  "mail",
  "support",
  "help",
  "about",
  "root",
  "null",
  "undefined",
] as const;

/** Category slugs and keys so /{username} never steals /guitars, /multi-fx, etc. */
const CATEGORY_RESERVED = CATEGORY_LIST.flatMap((c) => [c.slug, c.key]);

export const RESERVED_USERNAMES = new Set<string>([
  ...STATIC_RESERVED,
  ...CATEGORY_RESERVED,
]);

const USERNAME_RE = /^[a-z0-9_]{3,30}$/;

export function normalizeUsername(raw: string): string {
  return raw.trim().toLowerCase();
}

/** Returns an error message, or null if valid. */
export function validateUsername(raw: string): string | null {
  const username = normalizeUsername(raw);
  if (!username) return "Username is required.";
  if (!USERNAME_RE.test(username)) {
    return "Username must be 3–30 characters: lowercase letters, numbers, and underscores only.";
  }
  if (RESERVED_USERNAMES.has(username)) {
    return "That username is reserved. Pick another.";
  }
  if (/^[0-9]+$/.test(username)) {
    return "Username cannot be only numbers.";
  }
  return null;
}

export function isReservedPathSegment(segment: string): boolean {
  const s = segment.toLowerCase();
  return RESERVED_USERNAMES.has(s) || s.startsWith("_next");
}
