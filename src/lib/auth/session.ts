import "server-only";
import { createHash, randomBytes } from "node:crypto";
import { cache } from "react";
import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { anonymous } from "@/lib/server/db";

export const SESSION_COOKIE = "hv_session";
const SESSION_HOURS = Number(process.env.SESSION_HOURS ?? 12);

export type SessionUser = {
  id: string;
  email: string;
  fullName: string;
  roleId: string;
  roleName: string;
  employeeId: string | null;
  mustChangePassword: boolean;
  permissions: Set<string>;
};

const hashToken = (token: string) => createHash("sha256").update(token).digest("hex");

export async function clientIp() {
  const h = await headers();
  return (h.get("x-forwarded-for")?.split(",")[0] ?? h.get("x-real-ip") ?? "unknown").trim();
}

export async function startSession(userId: string) {
  const token = randomBytes(32).toString("base64url");
  const h = await headers();
  const expires = await anonymous(async (db) => {
    const r = await db.query("select hv.auth_create_session($1, $2, $3, $4, $5) as exp", [
      userId,
      hashToken(token),
      SESSION_HOURS,
      await clientIp(),
      h.get("user-agent") ?? "",
    ]);
    return r.rows[0].exp as Date;
  });
  (await cookies()).set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    expires,
  });
}

/** The signed-in user for this request, or null. Cached per request. */
export const getSessionUser = cache(async (): Promise<SessionUser | null> => {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  if (!token || token.length > 200) return null;
  const row = await anonymous(async (db) => (await db.query("select * from hv.auth_session($1)", [hashToken(token)])).rows[0]);
  if (!row) return null;
  return {
    id: row.user_id,
    email: row.email,
    fullName: row.full_name,
    roleId: row.role_id,
    roleName: row.role_name,
    employeeId: row.employee_id,
    mustChangePassword: row.must_change_password,
    permissions: new Set(row.permissions as string[]),
  };
});

export async function currentTokenHash() {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  return token ? hashToken(token) : null;
}

export async function endSession() {
  const jar = await cookies();
  const token = jar.get(SESSION_COOKIE)?.value;
  if (token) await anonymous((db) => db.query("select hv.auth_revoke_session($1)", [hashToken(token)]));
  jar.delete(SESSION_COOKIE);
}

/** Use at the top of every management page and action. */
export async function requireUser(permission?: string | string[]): Promise<SessionUser> {
  const user = await getSessionUser();
  if (!user) redirect("/management/login");
  if (permission) {
    const needed = Array.isArray(permission) ? permission : [permission];
    if (!needed.some((p) => user.permissions.has(p))) redirect("/management/forbidden");
  }
  return user;
}

export const can = (user: SessionUser, ...perms: string[]) => perms.some((p) => user.permissions.has(p));
