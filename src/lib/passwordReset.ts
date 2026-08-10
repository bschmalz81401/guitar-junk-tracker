import { randomBytes } from "crypto";
import { resetTokenHash } from "@/lib/auth";
import { sendMail } from "@/lib/mail";
import { prisma } from "@/lib/prisma";
import { getSettings, isSmtpConfigured } from "@/lib/settings";

/**
 * Create a one-hour reset token and email the link.
 * Throws if SMTP is missing or send fails.
 */
export async function sendPasswordResetForUser(
  user: { id: number; email: string },
  origin: string
): Promise<void> {
  const settings = await getSettings();
  if (!isSmtpConfigured(settings)) {
    throw new Error("SMTP is not configured. Set it up in Admin first.");
  }

  await prisma.passwordResetToken.deleteMany({ where: { userId: user.id } });

  const rawToken = randomBytes(32).toString("hex");
  const expiresAt = new Date(Date.now() + 60 * 60 * 1000);
  await prisma.passwordResetToken.create({
    data: {
      userId: user.id,
      tokenHash: resetTokenHash(rawToken),
      expiresAt,
    },
  });

  const resetUrl = `${origin.replace(/\/$/, "")}/reset-password?token=${rawToken}`;

  await sendMail(settings, {
    to: user.email,
    subject: "Reset your Guitar Junk Tracker password",
    text: `Reset your password using this link (valid for 1 hour):\n\n${resetUrl}\n\nIf you did not request this, you can ignore this email.`,
    html: `<p>Reset your password using this link (valid for 1 hour):</p><p><a href="${resetUrl}">${resetUrl}</a></p><p>If you did not request this, you can ignore this email.</p>`,
  });
}

export function requestOrigin(request: { headers: Headers; url: string }): string {
  const forwardedHost = request.headers.get("x-forwarded-host");
  const forwardedProto = request.headers.get("x-forwarded-proto");
  if (forwardedHost && forwardedProto) {
    return `${forwardedProto}://${forwardedHost}`;
  }
  return new URL(request.url).origin;
}
