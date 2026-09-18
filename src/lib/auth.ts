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

export type SessionClaims = {
  userId: number;
  expires: number;
  sessionVersion: number;
};

async function signingSecret(): Promise<string> {
  const settings = await getSettings();
  return settings.sessionSecret;
}

function sign(payload: string, secret: string): string {
  return createHmac("sha256", secret).update(payload).digest("hex");
}

function signaturesMatch(actual: string, expected: string): boolean {
  if (actual.length !== expected.length) return false;
  return timingSafeEqual(Buffer.from(actual), Buffer.from(expected));
}

/** Prisma fragment: hash the new password and invalidate existing sessions. */
export function passwordChangeData(passwordHash: string) {
  return { passwordHash, sessionVersion: { increment: 1 as const } };
}

/**
 * Encode a session cookie.
 * Current format: userId.expires.sessionVersion.sig
 * Legacy (pre-revocation) format userId.expires.sig is still accepted as version 0.
 */
export function encodeSessionToken(claims: SessionClaims, secret: string): string {
  const payload = `${claims.userId}.${claims.expires}.${claims.sessionVersion}`;
  return `${payload}.${sign(payload, secret)}`;
}

export function decodeSessionToken(
  token: string | undefined,
  secret: string,
  now: number = Date.now()
): SessionClaims | null {
  if (!token) return null;
  const parts = token.split(".");
  if (parts.length === 3) {
    const [userIdStr, expiresStr, signature] = parts;
    if (!/^\d+$/.test(userIdStr) || !/^\d+$/.test(expiresStr)) return null;
    const expires = Number(expiresStr);
    if (expires < now) return null;
    const payload = `${userIdStr}.${expiresStr}`;
    if (!signaturesMatch(signature, sign(payload, secret))) return null;
    return { userId: Number(userIdStr), expires, sessionVersion: 0 };
  }
  if (parts.length === 4) {
    const [userIdStr, expiresStr, versionStr, signature] = parts;
    if (!/^\d+$/.test(userIdStr) || !/^\d+$/.test(expiresStr) || !/^\d+$/.test(versionStr)) {
      return null;
    }
    const expires = Number(expiresStr);
    if (expires < now) return null;
    const payload = `${userIdStr}.${expiresStr}.${versionStr}`;
    if (!signaturesMatch(signature, sign(payload, secret))) return null;
    return {
      userId: Number(userIdStr),
      expires,
      sessionVersion: Number(versionStr),
    };
  }
  return null;
}

/** Session token: userId.expires.sessionVersion.signature */
export function sessionUserFromClaims(
  claims: SessionClaims | null,
  user: (SessionUser & { sessionVersion: number }) | null
): SessionUser | null {
  if (!claims || !user) return null;
  if (user.sessionVersion !== claims.sessionVersion) return null;
  return { id: user.id, email: user.email, name: user.name, role: user.role };
}

/** Session token: userId.expires.sessionVersion.signature */
export async function createSessionToken(
  userId: number,
  sessionVersion?: number
): Promise<string> {
  const secret = await signingSecret();
  let version = sessionVersion;
  if (version === undefined) {
    const row = await prisma.user.findUnique({
      where: { id: userId },
      select: { sessionVersion: true },
    });
    if (!row) {
      throw new Error("Cannot issue a session for an unknown user");
    }
    version = row.sessionVersion;
  }
  const expires = Date.now() + SESSION_MAX_AGE_SECONDS * 1000;
  return encodeSessionToken({ userId, expires, sessionVersion: version }, secret);
}

export async function verifySessionToken(
  token: string | undefined
): Promise<SessionClaims | null> {
  const secret = await signingSecret();
  return decodeSessionToken(token, secret);
}

export async function getSessionUser(): Promise<SessionUser | null> {
  const cookieStore = await cookies();
  const parsed = await verifySessionToken(cookieStore.get(AUTH_COOKIE)?.value);
  if (!parsed) return null;

  const user = await prisma.user.findUnique({
    where: { id: parsed.userId },
    select: { id: true, email: true, name: true, role: true, sessionVersion: true },
  });
  return sessionUserFromClaims(parsed, user);
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
