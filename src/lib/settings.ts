import { randomBytes } from "crypto";
import { prisma } from "@/lib/prisma";
import type { AppSettings } from "@/generated/prisma/client";

/** Always read from DB so toggles like allowSignup show up immediately. */
export async function getSettings(): Promise<AppSettings> {
  let settings = await prisma.appSettings.findUnique({ where: { id: 1 } });
  if (!settings) {
    settings = await prisma.appSettings.create({
      data: {
        id: 1,
        sessionSecret: randomBytes(32).toString("hex"),
        allowSignup: false,
        smtpSecure: true,
      },
    });
  }
  return settings;
}

export async function updateSettings(
  data: Partial<{
    allowSignup: boolean;
    smtpHost: string | null;
    smtpPort: number | null;
    smtpSecure: boolean;
    smtpUser: string | null;
    smtpPassword: string | null;
    smtpFrom: string | null;
    showcaseEmail: string | null;
    sessionSecret: string;
  }>
): Promise<AppSettings> {
  return prisma.appSettings.upsert({
    where: { id: 1 },
    create: {
      id: 1,
      sessionSecret: data.sessionSecret || randomBytes(32).toString("hex"),
      allowSignup: data.allowSignup ?? false,
      smtpHost: data.smtpHost ?? null,
      smtpPort: data.smtpPort ?? null,
      smtpSecure: data.smtpSecure ?? true,
      smtpUser: data.smtpUser ?? null,
      smtpPassword: data.smtpPassword ?? null,
      smtpFrom: data.smtpFrom ?? null,
      showcaseEmail: data.showcaseEmail ?? null,
    },
    update: data,
  });
}

export function isSmtpConfigured(settings: AppSettings): boolean {
  return Boolean(settings.smtpHost && settings.smtpPort && settings.smtpFrom);
}
