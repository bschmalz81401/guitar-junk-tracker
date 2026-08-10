import { NextRequest, NextResponse } from "next/server";
import { isReservedPathSegment } from "@/lib/username";

/**
 * - Exposes the request path as an `x-pathname` header so server components
 *   (the root layout's first-run setup gate) can see which route is rendering.
 * - Rewrites /{username}… public catalog URLs onto internal /u/{username}…
 *   routes so they don't collide with /guitars, /admin, etc.
 */
export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("x-pathname", pathname);
  const passthrough = () => NextResponse.next({ request: { headers: requestHeaders } });

  const parts = pathname.split("/").filter(Boolean);
  if (parts.length === 0) return passthrough();

  const first = parts[0].toLowerCase();
  if (isReservedPathSegment(first)) return passthrough();
  // Only rewrite plausible usernames
  if (!/^[a-z0-9_]{3,30}$/.test(first)) return passthrough();

  const url = request.nextUrl.clone();
  url.pathname = `/u/${parts.join("/")}`;
  return NextResponse.rewrite(url, { request: { headers: requestHeaders } });
}

export const config = {
  matcher: [
    /*
     * Match all pathnames except:
     * - _next static/image
     * - favicon, public files with extensions
     * - api routes
     */
    "/((?!api|_next/static|_next/image|favicon.ico|.*\\..*).*)",
  ],
};
