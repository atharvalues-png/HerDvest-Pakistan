import { NextResponse, type NextRequest } from "next/server";

/**
 * First line of defence for the two private areas:
 *   /management — staff (cookie hv_session)
 *   /portal     — investors (cookie hv_portal)
 * No cookie → that area's own sign-in page. The real checks (valid, unexpired
 * session, permissions, investor ownership) happen on the server in every page,
 * action and route handler, and again in PostgreSQL.
 */
const PORTAL_PUBLIC = new Set(["/portal/login", "/portal/activate", "/portal/forgot", "/portal/reset"]);

export function middleware(req: NextRequest) {
  const { pathname, search } = req.nextUrl;
  const isStaff = pathname.startsWith("/management");
  const isPortal = pathname === "/portal" || pathname.startsWith("/portal/");

  if (isStaff && pathname !== "/management/login" && !req.cookies.get("hv_session")) {
    const url = req.nextUrl.clone();
    url.pathname = "/management/login";
    url.search = `?next=${encodeURIComponent(pathname + search)}`;
    return NextResponse.redirect(url);
  }
  if (isPortal && !PORTAL_PUBLIC.has(pathname) && !req.cookies.get("hv_portal")) {
    const url = req.nextUrl.clone();
    url.pathname = "/portal/login";
    url.search = pathname === "/portal" ? "" : `?next=${encodeURIComponent(pathname + search)}`;
    return NextResponse.redirect(url);
  }

  const headers = new Headers(req.headers);
  headers.set("x-hv-path", pathname);
  const res = NextResponse.next({ request: { headers } });
  res.headers.set("Cache-Control", "private, no-store");
  res.headers.set("X-Frame-Options", "DENY");
  res.headers.set("Referrer-Policy", "same-origin");
  res.headers.set("X-Content-Type-Options", "nosniff");
  return res;
}

export const config = { matcher: ["/management/:path*", "/portal", "/portal/:path*"] };
