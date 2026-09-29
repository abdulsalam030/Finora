import { NextResponse, type NextRequest } from "next/server";

// Optimistic redirect only — every page and action still verifies the session server-side.
export function middleware(req: NextRequest) {
  if (!req.cookies.has("session")) {
    return NextResponse.redirect(new URL("/login", req.url));
  }
  return NextResponse.next();
}

export const config = { matcher: ["/dashboard/:path*", "/fund/:path*", "/transfer/:path*", "/transactions/:path*", "/cards/:path*", "/settings/:path*"] };
