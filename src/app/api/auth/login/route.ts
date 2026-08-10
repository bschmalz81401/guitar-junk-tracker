import { NextRequest, NextResponse } from "next/server";
import {
  AUTH_COOKIE,
  SESSION_COOKIE_OPTIONS,
  createSessionToken,
} from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { verifyPassword } from "@/lib/password";
import {
  AUTH_LIMITS,
  enforceRateLimit,
  getClientIp,
  rejectCrossOrigin,
} from "@/lib/requestSecurity";

export async function POST(request: NextRequest) {
  const cross = rejectCrossOrigin(request);
  if (cross) return cross;

  const ip = getClientIp(request);
  const ipLimit = enforceRateLimit(
    `auth:login:ip:${ip}`,
    AUTH_LIMITS.loginIp.limit,
    AUTH_LIMITS.loginIp.windowMs
  );
  if (ipLimit) return ipLimit;

  const body = await request.json().catch(() => null);
  const email = typeof body?.email === "string" ? body.email.trim().toLowerCase() : "";
  const password = typeof body?.password === "string" ? body.password : "";

  if (!email || !password) {
    return NextResponse.json(
      { error: "Email and password are required." },
      { status: 400 }
    );
  }

  const emailLimit = enforceRateLimit(
    `auth:login:email:${email}`,
    AUTH_LIMITS.loginEmail.limit,
    AUTH_LIMITS.loginEmail.windowMs
  );
  if (emailLimit) return emailLimit;

  const user = await prisma.user.findUnique({ where: { email } });
  // Always run verify path shape: avoid leaking whether email exists via timing
  // of scrypt vs early return — still verify only when user exists.
  const valid = user ? verifyPassword(password, user.passwordHash) : false;
  if (!user || !valid) {
    return NextResponse.json({ error: "Incorrect email or password." }, { status: 401 });
  }

  const response = NextResponse.json({
    success: true,
    user: {
      id: user.id,
      email: user.email,
      username: user.username,
      name: user.name,
      role: user.role,
    },
  });
  response.cookies.set(AUTH_COOKIE, await createSessionToken(user.id), SESSION_COOKIE_OPTIONS);
  return response;
}
