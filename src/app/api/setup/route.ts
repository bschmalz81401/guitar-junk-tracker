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
import { updateSettings } from "@/lib/settings";
import { normalizeUsername, validateUsername } from "@/lib/username";
import { isSetupComplete } from "@/lib/setup";

/**
 * First-run setup: create the very first admin account. This endpoint is
 * self-locking — once any admin exists it refuses (403), so it can't be used
 * to add a second admin or take over a running install.
 */
export async function POST(request: NextRequest) {
  const cross = rejectCrossOrigin(request);
  if (cross) return cross;

  const ip = getClientIp(request);
  const limited = enforceRateLimit(
    `setup:ip:${ip}`,
    AUTH_LIMITS.signupIp.limit,
    AUTH_LIMITS.signupIp.windowMs
  );
  if (limited) return limited;

  if (await isSetupComplete()) {
    return NextResponse.json(
      { error: "Setup has already been completed." },
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

  // Re-check inside a transaction so two simultaneous submits can't both create
  // an admin; unique constraints on email/username are the final backstop.
  let user;
  try {
    user = await prisma.$transaction(async (tx) => {
      const admins = await tx.user.count({ where: { role: "admin" } });
      if (admins > 0) throw new Error("ALREADY_SETUP");
      if (await tx.user.findUnique({ where: { email } })) throw new Error("EMAIL_TAKEN");
      if (await tx.user.findUnique({ where: { username } })) throw new Error("USERNAME_TAKEN");
      return tx.user.create({
        data: {
          email,
          username,
          name: name || null,
          passwordHash: hashPassword(password),
          role: "admin",
          catalogPublic: false,
        },
      });
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "";
    if (msg === "ALREADY_SETUP") {
      return NextResponse.json(
        { error: "Setup has already been completed." },
        { status: 403 }
      );
    }
    if (msg === "EMAIL_TAKEN") {
      return NextResponse.json(
        { error: "An account with that email already exists." },
        { status: 409 }
      );
    }
    if (msg === "USERNAME_TAKEN") {
      return NextResponse.json({ error: "That username is already taken." }, { status: 409 });
    }
    return NextResponse.json({ error: "Setup failed. Please try again." }, { status: 500 });
  }

  // Default the guest landing showcase to the new admin's collection.
  await updateSettings({ showcaseEmail: user.email }).catch(() => {});

  const response = NextResponse.json({ success: true });
  response.cookies.set(
    AUTH_COOKIE,
    await createSessionToken(user.id, user.sessionVersion),
    SESSION_COOKIE_OPTIONS
  );
  return response;
}
