/**
 * Edge middleware for route protection.
 *
 * Per SRS §10.2 + §10.1. Authenticated routes that don't match the user's
 * role redirect to /signin (server pages then call lib/permissions to
 * enforce finer-grained role/phase/profile checks).
 *
 * Phase-aware profile-setup redirects live in the server pages, not here —
 * the edge runtime can't reach Postgres for an EventPhase lookup.
 */

import { NextResponse, type NextRequest } from "next/server";
import { auth } from "@/auth";

const PROTECTED_PREFIXES = [
  "/admin",
  "/agent",
  "/pod-head",
  "/orch",
  "/profile-setup",
  "/results"
];

export default auth((req: NextRequest & { auth: unknown }) => {
  const { pathname } = req.nextUrl;
  const isProtected = PROTECTED_PREFIXES.some(
    (p) => pathname === p || pathname.startsWith(`${p}/`)
  );
  if (!isProtected) return NextResponse.next();

  if (!req.auth) {
    const url = req.nextUrl.clone();
    url.pathname = "/signin";
    url.searchParams.set("callbackUrl", pathname);
    return NextResponse.redirect(url);
  }
  return NextResponse.next();
});

export const config = {
  matcher: [
    // Skip Next internals, static assets, and the API auth endpoints.
    "/((?!_next/static|_next/image|favicon.ico|api/auth).*)"
  ]
};
