import { NextRequest, NextResponse } from "next/server";
import { rateLimit, type RateLimitResult } from "@/lib/rateLimit";

/** Best-effort client IP (respects first X-Forwarded-For hop). */
export function getClientIp(request: NextRequest): string {
  const xff = request.headers.get("x-forwarded-for");
  if (xff) {
    const first = xff.split(",")[0]?.trim();
    if (first) return first.slice(0, 128);
  }
  const real = request.headers.get("x-real-ip")?.trim();
  if (real) return real.slice(0, 128);
  return "unknown";
}

/**
 * When Origin is present, require it to match this request's Host.
 * SameSite=Lax already blocks most cookie CSRF; this is defense in depth
 * for browser POSTs that include Origin.
 */
export function rejectCrossOrigin(request: NextRequest): NextResponse | null {
  const origin = request.headers.get("origin");
  if (!origin) return null;

  let originHost: string;
  try {
    originHost = new URL(origin).host;
  } catch {
    return NextResponse.json({ error: "Invalid request origin." }, { status: 403 });
  }

  const host = request.headers.get("host");
  if (!host) return null;

  if (originHost.toLowerCase() !== host.toLowerCase()) {
    return NextResponse.json({ error: "Invalid request origin." }, { status: 403 });
  }
  return null;
}

export function rateLimitResponse(result: Extract<RateLimitResult, { ok: false }>): NextResponse {
  return NextResponse.json(
    {
      error: "Too many attempts. Try again later.",
      retryAfterSec: result.retryAfterSec,
    },
    {
      status: 429,
      headers: {
        "Retry-After": String(result.retryAfterSec),
        "Cache-Control": "no-store",
      },
    }
  );
}

/** Apply rate limit; return 429 response or null if allowed. */
export function enforceRateLimit(
  key: string,
  limit: number,
  windowMs: number
): NextResponse | null {
  const result = rateLimit(key, limit, windowMs);
  if (!result.ok) return rateLimitResponse(result);
  return null;
}

// Auth windows (single-process memory; fine for one Docker replica)
export const AUTH_LIMITS = {
  loginIp: { limit: 20, windowMs: 15 * 60 * 1000 },
  loginEmail: { limit: 10, windowMs: 15 * 60 * 1000 },
  signupIp: { limit: 10, windowMs: 60 * 60 * 1000 },
  forgotIp: { limit: 8, windowMs: 15 * 60 * 1000 },
  resetIp: { limit: 15, windowMs: 15 * 60 * 1000 },
} as const;
