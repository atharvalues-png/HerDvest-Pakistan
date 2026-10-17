import { NextResponse, type NextRequest } from "next/server";

/**
 * First line of defence for the management app: no session cookie → sign-in
 * page. The real check (valid, unexpired session + permissions) happens on the
 * server in every page, action and route handler, and again in PostgreSQL RLS.
 */
export function middleware(req: NextRequest) {
  const { pathname, search } = req.nextUrl;
  const isLogin = pathname === "/management/login";
  if (pathname.startsWith("/management") && !isLogin && !req.cookies.get("hv_session")) {
    const url = req.nextUrl.clone();
    url.pathname = "/management/login";
    url.search = `?next=${encodeURIComponent(pathname + search)}`;
    return NextResponse.redirect(url);
  }
  const headers = new Headers(req.headers);
  headers.set("x-hv-path", pathname);
  const res = NextResponse.next({ request: { headers } });
  if (pathname.startsWith("/management")) {
    res.headers.set("Cache-Control", "private, no-store");
    res.headers.set("X-Frame-Options", "DENY");
    res.headers.set("Referrer-Policy", "same-origin");
    res.headers.set("X-Content-Type-Options", "nosniff");
  }
  return res;
}

export const config = { matcher: ["/management/:path*"] };
