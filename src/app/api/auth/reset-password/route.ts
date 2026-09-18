import { NextRequest, NextResponse } from "next/server";
import { passwordChangeData, resetTokenHash } from "@/lib/auth";
import { hashPassword } from "@/lib/password";
import { prisma } from "@/lib/prisma";
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
    `auth:reset:ip:${ip}`,
    AUTH_LIMITS.resetIp.limit,
    AUTH_LIMITS.resetIp.windowMs
  );
  if (limited) return limited;

  const body = await request.json().catch(() => null);
  const token = typeof body?.token === "string" ? body.token.trim() : "";
  const password = typeof body?.password === "string" ? body.password : "";

  if (!token) {
    return NextResponse.json({ error: "Reset token is required." }, { status: 400 });
  }
  if (password.length < 8) {
    return NextResponse.json(
      { error: "Password must be at least 8 characters." },
      { status: 400 }
    );
  }

  const record = await prisma.passwordResetToken.findUnique({
    where: { tokenHash: resetTokenHash(token) },
  });
  if (!record || record.expiresAt.getTime() < Date.now()) {
    return NextResponse.json(
      { error: "This reset link is invalid or has expired." },
      { status: 400 }
    );
  }

  await prisma.user.update({
    where: { id: record.userId },
    data: passwordChangeData(hashPassword(password)),
  });
  await prisma.passwordResetToken.deleteMany({ where: { userId: record.userId } });

  return NextResponse.json({ success: true });
}
