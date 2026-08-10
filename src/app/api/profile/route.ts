import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { hashPassword, verifyPassword } from "@/lib/password";
import { normalizeUsername, validateUsername } from "@/lib/username";

export async function GET() {
  const auth = await requireUser();
  if ("error" in auth) return auth.error;

  const user = await prisma.user.findUnique({
    where: { id: auth.user.id },
    select: {
      id: true,
      email: true,
      username: true,
      name: true,
      bio: true,
      location: true,
      catalogPublic: true,
      role: true,
      createdAt: true,
      _count: { select: { items: true } },
    },
  });
  if (!user) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  return NextResponse.json({
    id: user.id,
    email: user.email,
    username: user.username,
    name: user.name,
    bio: user.bio,
    location: user.location,
    catalogPublic: user.catalogPublic,
    role: user.role,
    createdAt: user.createdAt,
    itemCount: user._count.items,
  });
}

export async function PUT(request: NextRequest) {
  const auth = await requireUser();
  if ("error" in auth) return auth.error;

  const body = await request.json().catch(() => null);
  if (!body || typeof body !== "object") {
    return NextResponse.json({ error: "Invalid body" }, { status: 400 });
  }

  const data: {
    name?: string | null;
    bio?: string | null;
    location?: string | null;
    username?: string;
    catalogPublic?: boolean;
  } = {};

  if (body.name !== undefined) {
    data.name = typeof body.name === "string" ? body.name.trim() || null : null;
  }
  if (body.bio !== undefined) {
    data.bio = typeof body.bio === "string" ? body.bio.trim().slice(0, 2000) || null : null;
  }
  if (body.location !== undefined) {
    data.location =
      typeof body.location === "string" ? body.location.trim().slice(0, 120) || null : null;
  }
  if (body.catalogPublic !== undefined) {
    data.catalogPublic = Boolean(body.catalogPublic);
  }
  if (body.username !== undefined) {
    if (typeof body.username !== "string") {
      return NextResponse.json({ error: "Invalid username." }, { status: 400 });
    }
    const username = normalizeUsername(body.username);
    const err = validateUsername(username);
    if (err) return NextResponse.json({ error: err }, { status: 400 });

    const taken = await prisma.user.findUnique({ where: { username } });
    if (taken && taken.id !== auth.user.id) {
      return NextResponse.json({ error: "That username is already taken." }, { status: 409 });
    }
    data.username = username;
  }

  if (data.catalogPublic === true) {
    const current = await prisma.user.findUnique({
      where: { id: auth.user.id },
      select: { username: true },
    });
    const username = data.username ?? current?.username;
    if (!username || validateUsername(username)) {
      return NextResponse.json(
        { error: "Set a valid username before making your catalog public." },
        { status: 400 }
      );
    }
  }

  const user = await prisma.user.update({
    where: { id: auth.user.id },
    data,
    select: {
      id: true,
      email: true,
      username: true,
      name: true,
      bio: true,
      location: true,
      catalogPublic: true,
      role: true,
      createdAt: true,
    },
  });

  return NextResponse.json(user);
}

export async function POST(request: NextRequest) {
  const auth = await requireUser();
  if ("error" in auth) return auth.error;

  const body = await request.json().catch(() => null);
  const currentPassword = typeof body?.currentPassword === "string" ? body.currentPassword : "";
  const newPassword = typeof body?.newPassword === "string" ? body.newPassword : "";

  if (!currentPassword || !newPassword) {
    return NextResponse.json(
      { error: "Current and new passwords are required." },
      { status: 400 }
    );
  }
  if (newPassword.length < 8) {
    return NextResponse.json(
      { error: "New password must be at least 8 characters." },
      { status: 400 }
    );
  }

  const user = await prisma.user.findUnique({ where: { id: auth.user.id } });
  if (!user || !verifyPassword(currentPassword, user.passwordHash)) {
    return NextResponse.json({ error: "Current password is incorrect." }, { status: 400 });
  }

  await prisma.user.update({
    where: { id: user.id },
    data: { passwordHash: hashPassword(newPassword) },
  });

  return NextResponse.json({ success: true, message: "Password updated." });
}
