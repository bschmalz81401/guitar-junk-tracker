import { randomBytes } from "crypto";
import { resetTokenHash } from "@/lib/auth";
import { sendMail } from "@/lib/mail";
import { prisma } from "@/lib/prisma";
import { getSettings, isSmtpConfigured } from "@/lib/settings";

const MISSING_ORIGIN =
  "Password reset is not available until APP_PUBLIC_ORIGIN is set to this app's public URL.";
const INVALID_ORIGIN =
  "APP_PUBLIC_ORIGIN must be an origin like http://localhost:3131 or https://gear.example.com (no path).";

/**
 * Canonical public origin for password-reset emails.
 * Never derived from the request or from X-Forwarded-* headers.
 */
export function publicAppOrigin(
  env: NodeJS.ProcessEnv = process.env
): string {
  const raw = env.APP_PUBLIC_ORIGIN?.trim();
  if (!raw) {
    throw new Error(MISSING_ORIGIN);
  }

  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    throw new Error(INVALID_ORIGIN);
  }

  if (url.protocol !== "http:" && url.protocol !== "https:") {
    throw new Error(INVALID_ORIGIN);
  }
  if (url.username || url.password) {
    throw new Error(INVALID_ORIGIN);
  }
  if (url.search || url.hash) {
    throw new Error(INVALID_ORIGIN);
  }
  if (url.pathname !== "/" && url.pathname !== "") {
    throw new Error(INVALID_ORIGIN);
  }

  return url.origin;
}

export function resetPasswordUrl(
  rawToken: string,
  origin: string = publicAppOrigin()
): string {
  return `${origin}/reset-password?token=${rawToken}`;
}

/**
 * Create a one-hour reset token and email the link.
 * Throws if APP_PUBLIC_ORIGIN is missing, SMTP is missing, or send fails.
 */
export async function sendPasswordResetForUser(user: {
  id: number;
  email: string;
}): Promise<void> {
  const origin = publicAppOrigin();
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

  const resetUrl = resetPasswordUrl(rawToken, origin);

  await sendMail(settings, {
    to: user.email,
    subject: "Reset your Guitar Junk Tracker password",
    text: `Reset your password using this link (valid for 1 hour):\n\n${resetUrl}\n\nIf you did not request this, you can ignore this email.`,
    html: `<p>Reset your password using this link (valid for 1 hour):</p><p><a href="${resetUrl}">${resetUrl}</a></p><p>If you did not request this, you can ignore this email.</p>`,
  });
}
