import { NextRequest, NextResponse } from "next/server";
import { clearSessionCookie } from "@/lib/auth";
import { rejectCrossOrigin } from "@/lib/requestSecurity";

export async function POST(request: NextRequest) {
  const cross = rejectCrossOrigin(request);
  if (cross) return cross;

  const response = NextResponse.json({ success: true });
  clearSessionCookie(response);
  return response;
}
