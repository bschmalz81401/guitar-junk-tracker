import { NextRequest, NextResponse } from "next/server";
import {
  AUTH_COOKIE,
  SESSION_COOKIE_OPTIONS,
  createSessionToken,
} from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { hashPassword } from "@/lib/password";
import {
  AUTH_LIMITS,
  enforceRateLimit,
  getClientIp,
  rejectCrossOrigin,
} from "@/lib/requestSecurity";
import { getSettings } from "@/lib/settings";
import { normalizeUsername, validateUsername } from "@/lib/username";

export async function POST(request: NextRequest) {
  const cross = rejectCrossOrigin(request);
  if (cross) return cross;

  const ip = getClientIp(request);
  const limited = enforceRateLimit(
    `auth:signup:ip:${ip}`,
    AUTH_LIMITS.signupIp.limit,
    AUTH_LIMITS.signupIp.windowMs
  );
  if (limited) return limited;

  const settings = await getSettings();
  if (!settings.allowSignup) {
    return NextResponse.json(
      { error: "Public sign-up is currently disabled." },
      { status: 403 }
    );
  }

  const body = await request.json().catch(() => null);
  const email = typeof body?.email === "string" ? body.email.trim().toLowerCase() : "";
  const password = typeof body?.password === "string" ? body.password : "";
  const name = typeof body?.name === "string" ? body.name.trim() : "";
  const username = typeof body?.username === "string" ? normalizeUsername(body.username) : "";

  if (!email || !email.includes("@")) {
    return NextResponse.json({ error: "A valid email is required." }, { status: 400 });
  }
  const usernameError = validateUsername(username);
  if (usernameError) {
    return NextResponse.json({ error: usernameError }, { status: 400 });
  }
  if (password.length < 8) {
    return NextResponse.json(
      { error: "Password must be at least 8 characters." },
      { status: 400 }
    );
  }

  const existingEmail = await prisma.user.findUnique({ where: { email } });
  if (existingEmail) {
    return NextResponse.json(
      { error: "An account with that email already exists." },
      { status: 409 }
    );
  }
  const existingUsername = await prisma.user.findUnique({ where: { username } });
  if (existingUsername) {
    return NextResponse.json({ error: "That username is already taken." }, { status: 409 });
  }

  const user = await prisma.user.create({
    data: {
      email,
      username,
      name: name || null,
      passwordHash: hashPassword(password),
      role: "user",
      catalogPublic: false,
    },
  });

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
