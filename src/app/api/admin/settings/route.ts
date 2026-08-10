import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { sendMail, verifySmtp } from "@/lib/mail";
import { prisma } from "@/lib/prisma";
import { getSettings, isSmtpConfigured, updateSettings } from "@/lib/settings";

function publicSettings(settings: Awaited<ReturnType<typeof getSettings>>) {
  return {
    allowSignup: settings.allowSignup,
    showcaseEmail: settings.showcaseEmail ?? "",
    smtpHost: settings.smtpHost ?? "",
    smtpPort: settings.smtpPort ?? 587,
    smtpSecure: settings.smtpSecure,
    smtpUser: settings.smtpUser ?? "",
    smtpPasswordSet: Boolean(settings.smtpPassword),
    smtpFrom: settings.smtpFrom ?? "",
    smtpConfigured: isSmtpConfigured(settings),
  };
}

export async function GET() {
  const auth = await requireAdmin();
  if ("error" in auth) return auth.error;

  const settings = await getSettings();
  return NextResponse.json(publicSettings(settings));
}

export async function PUT(request: NextRequest) {
  const auth = await requireAdmin();
  if ("error" in auth) return auth.error;

  const body = await request.json().catch(() => null);
  if (!body || typeof body !== "object") {
    return NextResponse.json({ error: "Invalid body" }, { status: 400 });
  }

  const current = await getSettings();
  const allowSignup = Boolean(body.allowSignup);
  const showcaseEmail =
    typeof body.showcaseEmail === "string"
      ? body.showcaseEmail.trim().toLowerCase() || null
      : current.showcaseEmail;
  const smtpHost =
    typeof body.smtpHost === "string" ? body.smtpHost.trim() || null : current.smtpHost;
  const smtpPort =
    body.smtpPort === "" || body.smtpPort == null ? null : Number(body.smtpPort);
  const smtpSecure = body.smtpSecure !== false && body.smtpSecure !== "false";
  const smtpUser =
    typeof body.smtpUser === "string" ? body.smtpUser.trim() || null : current.smtpUser;
  const smtpFrom =
    typeof body.smtpFrom === "string" ? body.smtpFrom.trim() || null : current.smtpFrom;

  let smtpPassword = current.smtpPassword;
  if (typeof body.smtpPassword === "string" && body.smtpPassword.length > 0) {
    smtpPassword = body.smtpPassword;
  }
  if (body.clearSmtpPassword === true) {
    smtpPassword = null;
  }

  if (showcaseEmail) {
    const exists = await prisma.user.findUnique({
      where: { email: showcaseEmail },
      select: { id: true },
    });
    if (!exists) {
      return NextResponse.json(
        { error: `No user with email ${showcaseEmail}.` },
        { status: 400 }
      );
    }
  }

  const settings = await updateSettings({
    allowSignup,
    showcaseEmail,
    smtpHost,
    smtpPort: Number.isFinite(smtpPort as number) ? (smtpPort as number) : null,
    smtpSecure,
    smtpUser,
    smtpPassword,
    smtpFrom,
  });

  return NextResponse.json(publicSettings(settings));
}

/**
 * POST { action: "test" }
 * Saves optional SMTP fields from the form body first (so you can test without
 * a separate Save), then verifies the connection and sends a test email.
 */
export async function POST(request: NextRequest) {
  const auth = await requireAdmin();
  if ("error" in auth) return auth.error;

  const body = await request.json().catch(() => null);
  const action = body?.action;

  if (action !== "test") {
    return NextResponse.json({ error: "Unknown action" }, { status: 400 });
  }

  // Optionally persist form values so Test works with just-entered settings.
  let settings = await getSettings();
  if (body && typeof body === "object") {
    const hasSmtpFields =
      body.smtpHost !== undefined ||
      body.smtpPort !== undefined ||
      body.smtpFrom !== undefined ||
      body.smtpUser !== undefined ||
      body.smtpPassword !== undefined ||
      body.smtpSecure !== undefined;

    if (hasSmtpFields) {
      const smtpHost =
        typeof body.smtpHost === "string"
          ? body.smtpHost.trim() || null
          : settings.smtpHost;
      const smtpPort =
        body.smtpPort === "" || body.smtpPort == null
          ? settings.smtpPort
          : Number(body.smtpPort);
      const smtpSecure =
        body.smtpSecure === undefined
          ? settings.smtpSecure
          : body.smtpSecure !== false && body.smtpSecure !== "false";
      const smtpUser =
        typeof body.smtpUser === "string"
          ? body.smtpUser.trim() || null
          : settings.smtpUser;
      const smtpFrom =
        typeof body.smtpFrom === "string"
          ? body.smtpFrom.trim() || null
          : settings.smtpFrom;

      let smtpPassword = settings.smtpPassword;
      if (typeof body.smtpPassword === "string" && body.smtpPassword.length > 0) {
        smtpPassword = body.smtpPassword;
      }

      settings = await updateSettings({
        smtpHost,
        smtpPort: Number.isFinite(smtpPort as number) ? (smtpPort as number) : null,
        smtpSecure,
        smtpUser,
        smtpPassword,
        smtpFrom,
      });
    }
  }

  if (!isSmtpConfigured(settings)) {
    return NextResponse.json(
      {
        error:
          "SMTP incomplete — enter host, port, and from address (and Save/Test again).",
        settings: publicSettings(settings),
      },
      { status: 400 }
    );
  }

  if (!settings.smtpUser || !settings.smtpPassword) {
    // Many servers require auth; warn but still try.
    console.warn("[smtp-test] No SMTP username/password stored; attempting anonymous send");
  }

  console.log(
    `[smtp-test] Connecting to ${settings.smtpHost}:${settings.smtpPort} secure=${settings.smtpSecure} as ${settings.smtpUser || "(no auth)"} from ${settings.smtpFrom} → ${auth.user.email}`
  );

  try {
    await verifySmtp(settings);
    console.log("[smtp-test] verify() OK");
    await sendMail(settings, {
      to: auth.user.email,
      subject: "Guitar Junk Tracker — SMTP test",
      text: "Your SMTP settings work. Password resets and mail from this app can be delivered.",
    });
    console.log(`[smtp-test] Test email accepted for delivery to ${auth.user.email}`);
    return NextResponse.json({
      success: true,
      message: `Test email sent to ${auth.user.email}. Check that inbox (and spam).`,
      settings: publicSettings(settings),
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "SMTP test failed";
    console.error("[smtp-test] failed:", message);
    return NextResponse.json(
      { error: message, settings: publicSettings(settings) },
      { status: 400 }
    );
  }
}
