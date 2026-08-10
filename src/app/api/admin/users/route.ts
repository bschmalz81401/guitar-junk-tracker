import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { hashPassword } from "@/lib/password";
import { prisma } from "@/lib/prisma";
import { normalizeUsername, validateUsername } from "@/lib/username";

export async function GET() {
  const auth = await requireAdmin();
  if ("error" in auth) return auth.error;

  const users = await prisma.user.findMany({
    orderBy: { createdAt: "asc" },
    select: {
      id: true,
      email: true,
      username: true,
      name: true,
      role: true,
      catalogPublic: true,
      createdAt: true,
      _count: { select: { items: true } },
    },
  });

  return NextResponse.json(
    users.map((u) => ({
      id: u.id,
      email: u.email,
      username: u.username,
      name: u.name,
      role: u.role,
      catalogPublic: u.catalogPublic,
      createdAt: u.createdAt,
      itemCount: u._count.items,
    }))
  );
}

export async function POST(request: NextRequest) {
  const auth = await requireAdmin();
  if ("error" in auth) return auth.error;

  const body = await request.json().catch(() => null);
  const email = typeof body?.email === "string" ? body.email.trim().toLowerCase() : "";
  const password = typeof body?.password === "string" ? body.password : "";
  const name = typeof body?.name === "string" ? body.name.trim() : "";
  const username =
    typeof body?.username === "string"
      ? normalizeUsername(body.username)
      : normalizeUsername(email.split("@")[0] || "");
  const role = body?.role === "admin" ? "admin" : "user";

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

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    return NextResponse.json(
      { error: "An account with that email already exists." },
      { status: 409 }
    );
  }
  const existingUsername = await prisma.user.findUnique({ where: { username } });
  if (existingUsername) {
    return NextResponse.json({ error: "That username is already taken." }, { status: 409 });
  }

  const user = await prisma.user.create({
    data: {
      email,
      username,
      name: name || null,
      passwordHash: hashPassword(password),
      role,
      catalogPublic: false,
    },
    select: {
      id: true,
      email: true,
      username: true,
      name: true,
      role: true,
      catalogPublic: true,
      createdAt: true,
    },
  });

  return NextResponse.json({ ...user, itemCount: 0 }, { status: 201 });
}
