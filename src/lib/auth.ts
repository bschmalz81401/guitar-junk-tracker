import { createHash, createHmac, timingSafeEqual } from "crypto";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSettings } from "@/lib/settings";
import type { UserRole } from "@/generated/prisma/client";

export const AUTH_COOKIE = "gt_session";
const SESSION_MAX_AGE_SECONDS = 30 * 24 * 60 * 60; // 30 days

export type SessionUser = {
  id: number;
  email: string;
  name: string | null;
  role: UserRole;
};

async function signingSecret(): Promise<string> {
  const settings = await getSettings();
  return settings.sessionSecret;
}

function sign(payload: string, secret: string): string {
  return createHmac("sha256", secret).update(payload).digest("hex");
}

/** Session token: userId.expires.signature */
export async function createSessionToken(userId: number): Promise<string> {
  const secret = await signingSecret();
  const expires = Date.now() + SESSION_MAX_AGE_SECONDS * 1000;
  const payload = `${userId}.${expires}`;
  return `${payload}.${sign(payload, secret)}`;
}

export async function verifySessionToken(
  token: string | undefined
): Promise<{ userId: number } | null> {
  if (!token) return null;
  const parts = token.split(".");
  if (parts.length !== 3) return null;
  const [userIdStr, expires, signature] = parts;
  if (!/^\d+$/.test(userIdStr) || !/^\d+$/.test(expires)) return null;
  if (Number(expires) < Date.now()) return null;

  const secret = await signingSecret();
  const payload = `${userIdStr}.${expires}`;
  const expected = sign(payload, secret);
  if (signature.length !== expected.length) return null;
  if (!timingSafeEqual(Buffer.from(signature), Buffer.from(expected))) return null;

  return { userId: Number(userIdStr) };
}

export async function getSessionUser(): Promise<SessionUser | null> {
  const cookieStore = await cookies();
  const parsed = await verifySessionToken(cookieStore.get(AUTH_COOKIE)?.value);
  if (!parsed) return null;

  const user = await prisma.user.findUnique({
    where: { id: parsed.userId },
    select: { id: true, email: true, name: true, role: true },
  });
  return user;
}

export async function isAdmin(): Promise<boolean> {
  const user = await getSessionUser();
  return user?.role === "admin";
}

/**
 * Session cookie flags (see docs/SECURITY.md).
 * - httpOnly: not readable by JS
 * - sameSite=lax: cookies not sent on most cross-site POSTs (CSRF mitigation)
 * - secure: set COOKIE_SECURE=1 behind HTTPS
 */
export const SESSION_COOKIE_OPTIONS = {
  httpOnly: true,
  sameSite: "lax" as const,
  path: "/",
  maxAge: SESSION_MAX_AGE_SECONDS,
  secure: process.env.COOKIE_SECURE === "1",
};

/** Clear the session cookie with the same path/secure attributes used at login. */
export function clearSessionCookie(response: NextResponse): void {
  response.cookies.set(AUTH_COOKIE, "", {
    ...SESSION_COOKIE_OPTIONS,
    maxAge: 0,
  });
}

export async function requireUser(): Promise<
  { user: SessionUser } | { error: NextResponse }
> {
  const user = await getSessionUser();
  if (!user) {
    return { error: NextResponse.json({ error: "Authentication required" }, { status: 401 }) };
  }
  return { user };
}

export async function requireAdmin(): Promise<
  { user: SessionUser } | { error: NextResponse }
> {
  const result = await requireUser();
  if ("error" in result) return result;
  if (result.user.role !== "admin") {
    return { error: NextResponse.json({ error: "Admin access required" }, { status: 403 }) };
  }
  return result;
}

export function resetTokenHash(rawToken: string): string {
  return createHash("sha256").update(rawToken).digest("hex");
}
