"use server";

import { redirect } from "next/navigation";
import { anonymous, isDatabaseConfigured, withInvestor } from "@/lib/server/db";
import { dummyHash, hashPassword, passwordProblems, verifyPassword } from "@/lib/auth/password";
import { clientIp } from "@/lib/auth/session";
import {
  PORTAL_SESSION_HOURS, endPortalSession, extendPortalCookie, getPortalSession, hashToken, newToken, portalBaseUrl, startPortalSession,
} from "@/lib/auth/portal-session";
import { newTotpSecret, verifyTotp } from "@/lib/auth/totp";
import { isEmailConfigured, sendEmail } from "@/lib/server/email";
import { FieldErrors, Form, type ActionState } from "@/lib/erp/action";
import { runPortalAction } from "@/lib/portal/action";

const GENERIC = "Email or password is incorrect.";
const safeNext = (n: string) => (n.startsWith("/portal") && !n.startsWith("//") && !n.startsWith("/portal/login") ? n : "/portal");

export async function portalLogin(_prev: ActionState, fd: FormData): Promise<ActionState> {
  if (!isDatabaseConfigured()) return { ok: false, message: "The investor portal is not configured on this server." };
  const email = String(fd.get("email") ?? "").trim().toLowerCase();
  const password = String(fd.get("password") ?? "");
  const next = String(fd.get("next") ?? "");
  if (!email || !password || email.length > 200 || password.length > 200) return { ok: false, message: GENERIC };

  const ip = await clientIp();
  const failures = await anonymous(async (db) => (await db.query("select * from hv.portal_auth_failures($1, $2)", [email, ip])).rows[0]);
  if (failures.by_ip >= 20) return { ok: false, message: "Too many failed sign-in attempts from this network. Please wait 15 minutes." };

  const acc = await anonymous(async (db) => (await db.query("select * from hv.portal_auth_lookup($1)", [email])).rows[0]);
  // Always run one password check so response time does not reveal whether the email exists.
  const valid = await verifyPassword(password, acc?.password_hash ?? (await dummyHash()));

  if (acc?.locked_until && new Date(acc.locked_until) > new Date()) {
    await anonymous((db) => db.query("select hv.portal_auth_record($1, $2, false, $3)", [email, acc.id, ip]));
    return { ok: false, message: "This account is temporarily locked after repeated failed attempts. Try again in 15 minutes." };
  }
  if (!acc || !acc.password_hash || !valid) {
    await anonymous((db) => db.query("select hv.portal_auth_record($1, $2, false, $3)", [email, acc?.id ?? null, ip]));
    return { ok: false, message: GENERIC };
  }
  if (acc.status !== "active") {
    await anonymous((db) => db.query("select hv.portal_auth_record($1, $2, false, $3)", [email, acc.id, ip]));
    return { ok: false, message: "Portal access for this account is currently suspended. Please contact Herdvest Pakistan." };
  }

  await anonymous((db) => db.query("select hv.portal_auth_record($1, $2, true, $3)", [email, acc.id, ip]));
  await startPortalSession(acc.id, !acc.mfa_enabled);
  if (acc.mfa_enabled) redirect(`/portal/verify?next=${encodeURIComponent(safeNext(next))}`);
  redirect(safeNext(next));
}

export async function portalVerify(_prev: ActionState, fd: FormData): Promise<ActionState> {
  const s = await getPortalSession();
  if (!s) return { ok: false, message: "Your sign-in has expired. Please start again." };
  const code = String(fd.get("code") ?? "");
  const next = String(fd.get("next") ?? "");
  const pending = await anonymous(async (db) => (await db.query("select * from hv.portal_mfa_pending($1)", [s.sessionHash])).rows[0]);
  if (!pending) return { ok: false, message: "Your sign-in has expired. Please start again." };
  const ok = verifyTotp(pending.secret, code);
  await anonymous((db) => db.query("select hv.portal_mfa_result($1, $2, $3)", [s.sessionHash, ok, PORTAL_SESSION_HOURS]));
  if (!ok) {
    return { ok: false, errors: { code: "That code is not correct." }, message: pending.attempts >= 4 ? "Too many attempts. Please sign in again." : "That code is not correct." };
  }
  await extendPortalCookie();
  redirect(safeNext(next));
}

export async function portalLogout() {
  await endPortalSession();
  redirect("/portal/login?signed_out=1");
}

/** Self-service reset. The reply is identical whether or not the email has an account. */
export async function requestPasswordReset(_prev: ActionState, fd: FormData): Promise<ActionState> {
  const email = String(fd.get("email") ?? "").trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 200) {
    return { ok: false, errors: { email: "Enter the email address you use to sign in." }, message: "Please correct the highlighted field." };
  }
  if (!isEmailConfigured()) {
    return {
      ok: true,
      message: "Online password reset emails are not switched on yet. Please contact Herdvest Pakistan from your registered phone number or email and we will send you a secure reset link.",
    };
  }
  const token = newToken();
  const created = await anonymous(async (db) => (await db.query("select hv.portal_request_reset($1, $2) v", [email, hashToken(token)])).rows[0].v);
  if (created) {
    const link = `${await portalBaseUrl()}/portal/reset?token=${token}`;
    await sendEmail(email, "Reset your Herdvest investor portal password",
      `Use this link within one hour to choose a new password:\n${link}\n\nIf you did not ask for this, ignore this email — your password has not changed.`);
  }
  return { ok: true, message: "If an investor account uses this email, a reset link has been sent. It expires in one hour." };
}

/** Activation and reset links both end here. */
export async function completeTokenPassword(token: string, _prev: ActionState, fd: FormData): Promise<ActionState> {
  const password = String(fd.get("password") ?? "");
  const confirm = String(fd.get("confirm") ?? "");
  const errors: Record<string, string> = {};
  const problem = passwordProblems(password);
  if (problem) errors.password = problem;
  if (password !== confirm) errors.confirm = "Passwords do not match.";
  if (Object.keys(errors).length) return { ok: false, errors, message: "Please correct the highlighted fields." };
  try {
    const hash = await hashPassword(password);
    await anonymous((db) => db.query("select hv.portal_use_token($1, $2)", [hashToken(token), hash]));
  } catch (err) {
    return { ok: false, message: (err as Error).message.includes("link") ? (err as Error).message : "This link is invalid or has expired." };
  }
  redirect("/portal/login?done=password");
}

export async function changePortalPassword(prev: ActionState, fd: FormData) {
  return runPortalAction(prev, async (db) => {
    const f = new Form(fd);
    const current = String(fd.get("current") ?? "");
    const next = String(fd.get("next") ?? "");
    const problem = passwordProblems(next);
    if (problem) f.errors.next = problem;
    if (next !== String(fd.get("confirm") ?? "")) f.errors.confirm = "Passwords do not match.";
    if (next && next === current) f.errors.next = "Choose a password different from your current one.";
    f.check();
    const email = (await db.query("select hv.portal_self_email() e")).rows[0].e;
    const row = (await db.query("select password_hash from hv.portal_auth_lookup($1)", [email])).rows[0];
    if (!row?.password_hash || !(await verifyPassword(current, row.password_hash))) {
      f.errors.current = "Current password is incorrect.";
      f.check();
    }
    await db.query("select hv.portal_self_password($1)", [await hashPassword(next)]);
    return "Password changed. Other signed-in devices have been signed out.";
  });
}

/* --------------------------------------------- two-step verification -- */

export async function startMfaSetup(prev: ActionState) {
  return runPortalAction(prev, async (db) => {
    const on = (await db.query("select mfa_enabled from hv.portal_profile()")).rows[0]?.mfa_enabled;
    if (on) throw new FieldErrors({ code: "Two-step verification is already on. Turn it off first to move it to a new phone." });
    await db.query("select hv.portal_self_mfa($1, false)", [newTotpSecret()]);
    return "Scan the code or enter the key in your authenticator app, then confirm with a 6-digit code.";
  }, ["/portal/profile"]);
}

export async function confirmMfaSetup(prev: ActionState, fd: FormData) {
  return runPortalAction(prev, async (db) => {
    const f = new Form(fd);
    const secret = (await db.query("select hv.portal_self_mfa_secret() s")).rows[0].s;
    if (!secret) throw new FieldErrors({ code: "Start the setup again." });
    if (!verifyTotp(secret, String(fd.get("code") ?? ""))) f.errors.code = "That code is not correct. Check your phone's time is set automatically.";
    f.check();
    await db.query("select hv.portal_self_mfa($1, true)", [secret]);
    return "Two-step verification is on. You will be asked for a code each time you sign in.";
  }, ["/portal/profile"]);
}

export async function disableMfa(prev: ActionState, fd: FormData) {
  return runPortalAction(prev, async (db) => {
    const f = new Form(fd);
    const secret = (await db.query("select hv.portal_self_mfa_secret() s")).rows[0].s;
    if (!secret || !verifyTotp(secret, String(fd.get("code") ?? ""))) f.errors.code = "Enter a current code from your authenticator app.";
    f.check();
    await db.query("select hv.portal_self_mfa(null, false)");
    return "Two-step verification has been turned off.";
  }, ["/portal/profile"]);
}

/* ------------------------------------------------------- profile etc. -- */

const FIELDS = ["full_legal_name", "phone", "email", "address", "city", "country", "contact_preference", "national_id", "other"] as const;

export async function requestCorrection(prev: ActionState, fd: FormData) {
  return runPortalAction(prev, async (db) => {
    const f = new Form(fd);
    const field = f.choice("field", FIELDS, { required: true });
    const value = f.text("requested_value", { max: 500 });
    const message = f.text("message", { max: 2000 });
    if (!value && !message) f.errors.requested_value = "Tell us the correct details.";
    f.check();
    await db.query("select hv.portal_request_change($1, $2, $3)", [field, value, message]);
    return "Request sent. Herdvest will verify the change before updating your record.";
  }, ["/portal/profile"]);
}

export async function markNotificationsRead(prev: ActionState, fd: FormData) {
  return runPortalAction(prev, async (db) => {
    const id = String(fd.get("id") ?? "");
    await db.query("select hv.portal_mark_read($1)", [/^[0-9a-f-]{36}$/i.test(id) ? id : null]);
    return "Marked as read.";
  }, ["/portal", "/portal/notifications"]);
}

/** Used by the notifications link: mark one as read, then open its target. */
export async function openNotification(id: string, link: string) {
  const s = await getPortalSession();
  if (s?.mfaPassed && /^[0-9a-f-]{36}$/i.test(id)) {
    await withInvestor(s.sessionHash, (db) => db.query("select hv.portal_mark_read($1)", [id]));
  }
  redirect(link.startsWith("/portal") ? link : "/portal");
}
