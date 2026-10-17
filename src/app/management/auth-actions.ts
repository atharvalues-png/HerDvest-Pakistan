"use server";

import { redirect } from "next/navigation";
import { anonymous, isDatabaseConfigured, withUser } from "@/lib/server/db";
import { dummyHash, hashPassword, passwordProblems, verifyPassword } from "@/lib/auth/password";
import { clientIp, currentTokenHash, endSession, getSessionUser, startSession } from "@/lib/auth/session";
import type { ActionState } from "@/lib/erp/action";

const GENERIC = "Email or password is incorrect.";

export async function login(_prev: ActionState, fd: FormData): Promise<ActionState> {
  if (!isDatabaseConfigured()) return { ok: false, message: "The management database is not configured on this server." };
  const email = String(fd.get("email") ?? "").trim().toLowerCase();
  const password = String(fd.get("password") ?? "");
  const next = String(fd.get("next") ?? "");
  if (!email || !password || email.length > 200 || password.length > 200) return { ok: false, message: GENERIC };

  const ip = await clientIp();
  const failures = await anonymous(async (db) => (await db.query("select * from hv.auth_recent_failures($1, $2)", [email, ip])).rows[0]);
  if (failures.by_ip >= 20) {
    return { ok: false, message: "Too many failed sign-in attempts from this network. Please wait 15 minutes." };
  }

  const user = await anonymous(async (db) => (await db.query("select * from hv.auth_lookup($1)", [email])).rows[0]);
  // Always run one password check so response time does not reveal whether the email exists.
  const valid = await verifyPassword(password, user?.password_hash ?? (await dummyHash()));

  if (user && user.locked_until && new Date(user.locked_until) > new Date()) {
    await anonymous((db) => db.query("select hv.auth_record_attempt($1, $2, false, $3)", [email, user.id, ip]));
    return { ok: false, message: "This account is temporarily locked after repeated failed attempts. Try again in 15 minutes." };
  }
  if (!user || !valid || !user.is_active) {
    await anonymous((db) => db.query("select hv.auth_record_attempt($1, $2, false, $3)", [email, user?.id ?? null, ip]));
    return { ok: false, message: GENERIC };
  }

  await anonymous((db) => db.query("select hv.auth_record_attempt($1, $2, true, $3)", [email, user.id, ip]));
  await startSession(user.id);
  redirect(next.startsWith("/management") && !next.startsWith("//") ? next : "/management");
}

export async function logout() {
  await endSession();
  redirect("/management/login");
}

export async function changePassword(_prev: ActionState, fd: FormData): Promise<ActionState> {
  const user = await getSessionUser();
  if (!user) return { ok: false, message: "Your session has expired." };
  const current = String(fd.get("current") ?? "");
  const next = String(fd.get("next") ?? "");
  const confirm = String(fd.get("confirm") ?? "");
  const errors: Record<string, string> = {};
  const problem = passwordProblems(next);
  if (problem) errors.next = problem;
  if (next !== confirm) errors.confirm = "Passwords do not match.";
  if (next === current) errors.next = "Choose a password different from your current one.";
  if (Object.keys(errors).length) return { ok: false, errors, message: "Please correct the highlighted fields." };

  const row = await anonymous(async (db) => (await db.query("select password_hash from hv.auth_lookup($1)", [user.email])).rows[0]);
  if (!row || !(await verifyPassword(current, row.password_hash))) {
    return { ok: false, errors: { current: "Current password is incorrect." }, message: "Please correct the highlighted fields." };
  }
  const hash = await hashPassword(next);
  const keep = await currentTokenHash();
  await withUser(user.id, (db) => db.query("select hv.auth_set_password($1, $2, $3)", [user.id, hash, keep]));
  return { ok: true, message: "Password changed. Other signed-in sessions have been ended." };
}
