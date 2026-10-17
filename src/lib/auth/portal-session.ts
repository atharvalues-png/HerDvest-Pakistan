import "server-only";
import { createHash, randomBytes } from "node:crypto";
import { cache } from "react";
import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { anonymous } from "@/lib/server/db";
import { clientIp } from "./session";

/**
 * Investor portal sessions. Completely separate from staff sessions: a
 * different cookie, table and set of database functions. A staff session never
 * grants portal access and an investor session never grants staff access.
 */
export const PORTAL_COOKIE = "hv_portal";
export const PORTAL_SESSION_HOURS = Number(process.env.PORTAL_SESSION_HOURS ?? 8);

export type PortalUser = {
  accountId: string;
  investorId: string;
  investorCode: string;
  investorName: string;
  email: string;
  mfaEnabled: boolean;
  mfaPassed: boolean;
  sessionHash: string;
};

export const hashToken = (token: string) => createHash("sha256").update(token).digest("hex");
export const newToken = () => randomBytes(32).toString("base64url");

export async function startPortalSession(accountId: string, mfaPassed: boolean) {
  const token = newToken();
  const h = await headers();
  const expires = await anonymous(async (db) => {
    const r = await db.query("select hv.portal_create_session($1, $2, $3, $4, $5, $6) exp", [
      accountId, hashToken(token), PORTAL_SESSION_HOURS, mfaPassed, await clientIp(), h.get("user-agent") ?? "",
    ]);
    return r.rows[0].exp as Date;
  });
  (await cookies()).set(PORTAL_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    expires: mfaPassed ? expires : new Date(Date.now() + 10 * 60 * 1000),
  });
}

/** Refreshes the cookie expiry after the second sign-in step. */
export async function extendPortalCookie() {
  const jar = await cookies();
  const token = jar.get(PORTAL_COOKIE)?.value;
  if (!token) return;
  jar.set(PORTAL_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    expires: new Date(Date.now() + PORTAL_SESSION_HOURS * 3600 * 1000),
  });
}

export async function portalSessionHash() {
  const token = (await cookies()).get(PORTAL_COOKIE)?.value;
  return token && token.length <= 200 ? hashToken(token) : null;
}

/** The signed-in investor (session may still be waiting for the second step). Cached per request. */
export const getPortalSession = cache(async (): Promise<PortalUser | null> => {
  const hash = await portalSessionHash();
  if (!hash) return null;
  const row = await anonymous(async (db) => (await db.query("select * from hv.portal_session_info($1)", [hash])).rows[0]);
  if (!row) return null;
  return {
    accountId: row.account_id,
    investorId: row.investor_id,
    investorCode: row.investor_code,
    investorName: row.investor_name,
    email: row.email,
    mfaEnabled: row.mfa_enabled,
    mfaPassed: row.mfa_passed,
    sessionHash: hash,
  };
});

/** Use at the top of every signed-in portal page and action. */
export async function requireInvestor(): Promise<PortalUser> {
  const s = await getPortalSession();
  if (!s) redirect("/portal/login");
  if (!s.mfaPassed) redirect("/portal/verify");
  return s;
}

export async function endPortalSession() {
  const jar = await cookies();
  const token = jar.get(PORTAL_COOKIE)?.value;
  if (token) await anonymous((db) => db.query("select hv.portal_revoke_session($1)", [hashToken(token)]));
  jar.delete(PORTAL_COOKIE);
}

/** Absolute base URL for links in invitations and emails. */
export async function portalBaseUrl() {
  const configured = process.env.PORTAL_BASE_URL || process.env.NEXT_PUBLIC_SITE_URL;
  if (process.env.PORTAL_BASE_URL) return configured!.replace(/\/$/, "");
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host");
  if (host) {
    const proto = h.get("x-forwarded-proto") ?? (host.startsWith("localhost") || host.startsWith("127.") ? "http" : "https");
    return `${proto}://${host}`;
  }
  return (configured ?? "http://localhost:3000").replace(/\/$/, "");
}
