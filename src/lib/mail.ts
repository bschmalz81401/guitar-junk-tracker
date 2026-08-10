import nodemailer from "nodemailer";
import type { AppSettings } from "@/generated/prisma/client";
import { isSmtpConfigured } from "@/lib/settings";

export type SmtpConfig = {
  smtpHost: string | null;
  smtpPort: number | null;
  smtpSecure: boolean;
  smtpUser: string | null;
  smtpPassword: string | null;
  smtpFrom: string | null;
};

function formatSmtpError(err: unknown): string {
  if (!err || typeof err !== "object") {
    return err instanceof Error ? err.message : "SMTP failed";
  }
  const e = err as {
    message?: string;
    code?: string;
    response?: string;
    responseCode?: number;
  };
  const parts: string[] = [];
  if (e.code) parts.push(e.code);
  if (e.responseCode) parts.push(String(e.responseCode));
  if (e.response) parts.push(String(e.response).trim());
  else if (e.message) parts.push(e.message);
  return parts.filter(Boolean).join(" — ") || "SMTP failed";
}

/**
 * Build a nodemailer transport.
 * - Port 465: implicit TLS (secure: true)
 * - Port 587/25/2525: STARTTLS (secure: false, requireTLS)
 * - "TLS/SSL" checkbox forces secure when checked on non-465 ports only if user insists
 */
export function createTransport(settings: SmtpConfig) {
  const host = settings.smtpHost?.trim();
  const port = Number(settings.smtpPort) || 587;
  if (!host) throw new Error("SMTP host is required.");

  const useImplicitTls = port === 465 || (settings.smtpSecure && port !== 587 && port !== 25);

  return nodemailer.createTransport({
    host,
    port,
    secure: useImplicitTls,
    requireTLS: !useImplicitTls && (port === 587 || port === 25 || port === 2525),
    tls: { minVersion: "TLSv1.2" },
    auth:
      settings.smtpUser && settings.smtpPassword
        ? { user: settings.smtpUser, pass: settings.smtpPassword }
        : undefined,
    connectionTimeout: 15_000,
    greetingTimeout: 15_000,
    socketTimeout: 20_000,
  });
}

export async function sendMail(
  settings: AppSettings | SmtpConfig,
  options: { to: string; subject: string; text: string; html?: string }
): Promise<void> {
  if (!isSmtpConfigured(settings as AppSettings)) {
    throw new Error(
      "SMTP is not configured. Set host, port, and from-address, then save."
    );
  }

  const transporter = createTransport(settings);
  try {
    await transporter.sendMail({
      from: settings.smtpFrom!,
      to: options.to,
      subject: options.subject,
      text: options.text,
      html: options.html,
    });
  } catch (err) {
    throw new Error(formatSmtpError(err));
  } finally {
    transporter.close();
  }
}

export async function verifySmtp(settings: AppSettings | SmtpConfig): Promise<void> {
  if (!isSmtpConfigured(settings as AppSettings)) {
    throw new Error("SMTP host, port, and from-address are required.");
  }
  const transporter = createTransport(settings);
  try {
    await transporter.verify();
  } catch (err) {
    throw new Error(formatSmtpError(err));
  } finally {
    transporter.close();
  }
}
