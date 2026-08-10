import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSettings, isSmtpConfigured } from "@/lib/settings";
import { requestOrigin, sendPasswordResetForUser } from "@/lib/passwordReset";
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
  const limited = enforceRateLimit(
    `auth:forgot:ip:${ip}`,
    AUTH_LIMITS.forgotIp.limit,
    AUTH_LIMITS.forgotIp.windowMs
  );
  if (limited) return limited;

  const settings = await getSettings();
  if (!isSmtpConfigured(settings)) {
    return NextResponse.json(
      { error: "Password reset is not available until an admin configures SMTP." },
      { status: 503 }
    );
  }

  const body = await request.json().catch(() => null);
  const email = typeof body?.email === "string" ? body.email.trim().toLowerCase() : "";
  if (!email) {
    return NextResponse.json({ error: "Email is required." }, { status: 400 });
  }

  // Always return success to avoid email enumeration (except SMTP failures).
  const user = await prisma.user.findUnique({ where: { email } });
  if (user) {
    try {
      await sendPasswordResetForUser(user, requestOrigin(request));
    } catch (err) {
      console.error("Failed to send reset email:", err);
      return NextResponse.json(
        {
          error:
            err instanceof Error
              ? err.message
              : "Could not send the reset email. Check SMTP settings.",
        },
        { status: 500 }
      );
    }
  }

  return NextResponse.json({
    success: true,
    message: "If that email is registered, a reset link has been sent.",
  });
}
