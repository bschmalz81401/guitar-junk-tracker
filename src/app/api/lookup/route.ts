import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import {
  lookupProductFromBrowserCapture,
  lookupProductFromUrl,
} from "@/lib/productLookup";
import { categoryByKey, categoryBySlug } from "@/types/categories";

export async function POST(request: NextRequest) {
  const auth = await requireUser();
  if ("error" in auth) return auth.error;

  const body = await request.json().catch(() => null);
  const url = typeof body?.url === "string" ? body.url.trim() : "";
  const text = typeof body?.text === "string" ? body.text : "";
  const html = typeof body?.html === "string" ? body.html : "";
  const hasCapture = Boolean(text.trim() || html.trim());

  if (!url && !hasCapture) {
    return NextResponse.json(
      { error: "A product URL or pasted page content is required." },
      { status: 400 }
    );
  }

  const category =
    categoryBySlug(String(body?.category ?? "")) ??
    categoryByKey(String(body?.category ?? ""));
  if (!category) {
    return NextResponse.json(
      { error: "A valid category is required (guitar, amp, cab, pedal, multifx or other)." },
      { status: 400 }
    );
  }

  try {
    // Browser-captured content skips the server-side fetch (works for
    // Sweetwater / Guitar Center / other bot-walled stores).
    if (hasCapture) {
      const result = lookupProductFromBrowserCapture(
        { url: url || undefined, text: text || undefined, html: html || undefined },
        category
      );
      return NextResponse.json({ ...result, mode: "browser-capture" });
    }

    const result = await lookupProductFromUrl(url, category);
    return NextResponse.json({ ...result, mode: "fetch" });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to look up that product";
    // Signal the client to offer browser-assisted capture for bot walls.
    const blocked = /403|401|bot-check|blocked automated|captcha|denied/i.test(message);
    return NextResponse.json(
      { error: message, blocked },
      { status: 400 }
    );
  }
}
