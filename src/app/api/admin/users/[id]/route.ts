import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { hashPassword } from "@/lib/password";
import { sendPasswordResetForUser } from "@/lib/passwordReset";
import {
  processPendingPhotoCleanup,
  queuePhotosThenDeleteUser,
} from "@/lib/photoCleanupDb";
import { prisma } from "@/lib/prisma";
import { normalizeUsername, validateUsername } from "@/lib/username";

type Params = { params: Promise<{ id: string }> };

function userSelect() {
  return {
    id: true,
    email: true,
    username: true,
    name: true,
    role: true,
    catalogPublic: true,
    createdAt: true,
    _count: { select: { items: true } },
  } as const;
}

function serializeUser(u: {
  id: number;
  email: string;
  username: string;
  name: string | null;
  role: string;
  catalogPublic: boolean;
  createdAt: Date;
  _count: { items: number };
}) {
  return {
    id: u.id,
    email: u.email,
    username: u.username,
    name: u.name,
    role: u.role,
    catalogPublic: u.catalogPublic,
    createdAt: u.createdAt,
    itemCount: u._count.items,
  };
}

export async function PATCH(request: NextRequest, { params }: Params) {
  const auth = await requireAdmin();
  if ("error" in auth) return auth.error;

  const { id } = await params;
  const userId = Number(id);
  if (!Number.isInteger(userId)) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const existing = await prisma.user.findUnique({ where: { id: userId } });
  if (!existing) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const body = await request.json().catch(() => null);
  if (!body || typeof body !== "object") {
    return NextResponse.json({ error: "Invalid body" }, { status: 400 });
  }

  // Admin-triggered password reset email
  if (body.action === "sendPasswordReset") {
    try {
      await sendPasswordResetForUser({
        id: existing.id,
        email: existing.email,
      });
      return NextResponse.json({
        success: true,
        message: `Password reset email sent to ${existing.email}.`,
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to send reset email";
      console.error("[admin-reset]", message);
      return NextResponse.json({ error: message }, { status: 400 });
    }
  }

  const data: {
    name?: string | null;
    email?: string;
    username?: string;
    role?: "admin" | "user";
    passwordHash?: string;
    catalogPublic?: boolean;
  } = {};

  if (typeof body.name === "string") {
    data.name = body.name.trim() || null;
  }

  if (typeof body.email === "string") {
    const email = body.email.trim().toLowerCase();
    if (!email.includes("@")) {
      return NextResponse.json({ error: "A valid email is required." }, { status: 400 });
    }
    const taken = await prisma.user.findUnique({ where: { email } });
    if (taken && taken.id !== userId) {
      return NextResponse.json(
        { error: "That email is already used by another account." },
        { status: 409 }
      );
    }
    data.email = email;
  }

  if (typeof body.username === "string") {
    const username = normalizeUsername(body.username);
    const err = validateUsername(username);
    if (err) return NextResponse.json({ error: err }, { status: 400 });
    const taken = await prisma.user.findUnique({ where: { username } });
    if (taken && taken.id !== userId) {
      return NextResponse.json({ error: "That username is already taken." }, { status: 409 });
    }
    data.username = username;
  }

  if (body.role === "admin" || body.role === "user") {
    if (existing.id === auth.user.id && body.role !== "admin") {
      return NextResponse.json(
        { error: "You can't remove your own admin role." },
        { status: 400 }
      );
    }
    data.role = body.role;
  }

  if (body.catalogPublic !== undefined) {
    data.catalogPublic = Boolean(body.catalogPublic);
  }

  if (typeof body.password === "string" && body.password.length > 0) {
    if (body.password.length < 8) {
      return NextResponse.json(
        { error: "Password must be at least 8 characters." },
        { status: 400 }
      );
    }
    data.passwordHash = hashPassword(body.password);
  }

  const user = await prisma.user.update({
    where: { id: userId },
    data,
    select: userSelect(),
  });

  return NextResponse.json(serializeUser(user));
}

export async function DELETE(_request: NextRequest, { params }: Params) {
  const auth = await requireAdmin();
  if ("error" in auth) return auth.error;

  const { id } = await params;
  const userId = Number(id);
  if (!Number.isInteger(userId)) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  if (userId === auth.user.id) {
    return NextResponse.json({ error: "You can't delete your own account." }, { status: 400 });
  }

  const existing = await prisma.user.findUnique({ where: { id: userId } });
  if (!existing) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  await queuePhotosThenDeleteUser(userId);
  try {
    await processPendingPhotoCleanup();
  } catch (err) {
    console.error("[photo-cleanup] after user delete", err);
  }
  return NextResponse.json({ success: true });
}
