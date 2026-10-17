"use server";

import { Form, runAction, type ActionState } from "@/lib/erp/action";
import { hashToken, newToken, portalBaseUrl } from "@/lib/auth/portal-session";
import { deliverNotificationEmails, isEmailConfigured, sendEmail } from "@/lib/server/email";
import { saveFormFile } from "@/lib/server/attachments";
import type { Db } from "@/lib/server/db";

/* Staff-side actions for the investor portal. Every database call re-checks
   the staff member's permissions (portal.manage, portal.publish, …). */

const inv = (id: string) => [`/management/investors/${id}`, "/management/portal"];
const animal = (id: string) => [`/management/animals/${id}`, "/management/portal"];

async function afterPublish(db: Db) {
  await deliverNotificationEmails(db, await portalBaseUrl());
}

/* ------------------------------------------------------ accounts ---- */

export async function inviteInvestor(investorId: string, prev: ActionState, fd: FormData) {
  return runAction(prev, async (db) => {
    const f = new Form(fd);
    const email = f.text("email", { required: true, max: 200, label: "Email" })?.toLowerCase() ?? "";
    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) f.errors.email = "Enter a valid email.";
    f.check();
    const token = newToken();
    await db.query("select hv.portal_invite($1, $2, $3, 168)", [investorId, email, hashToken(token)]);
    const link = `${await portalBaseUrl()}/portal/activate?token=${token}`;
    const name = (await db.query("select full_legal_name from hv.investors where id = $1", [investorId])).rows[0]?.full_legal_name ?? "";
    const sent = await sendEmail(email, "Activate your Herdvest Pakistan investor portal",
      `Dear ${name},\n\nHerdvest Pakistan has created your investor portal account. Use this one-time link within 7 days to choose your password:\n${link}\n\nHerdvest will never ask for your password. If you were not expecting this, please contact us.`);
    return `Invitation created for ${email}. ${sent ? "It has been emailed. " : isEmailConfigured() ? "Email delivery FAILED — " : "Email is not configured — "}` +
      `${sent ? "You can also share" : "Share"} this one-time link with the investor through a trusted channel (it is shown only once and expires in 7 days):\n${link}`;
  }, inv(investorId));
}

export async function issuePortalReset(accountId: string, investorId: string, prev: ActionState) {
  return runAction(prev, async (db) => {
    const token = newToken();
    await db.query("select hv.portal_issue_reset($1, $2)", [accountId, hashToken(token)]);
    const link = `${await portalBaseUrl()}/portal/reset?token=${token}`;
    const email = (await db.query("select email from hv.portal_accounts where id = $1", [accountId])).rows[0]?.email;
    const sent = email ? await sendEmail(email, "Reset your Herdvest investor portal password",
      `A password reset was requested by Herdvest staff. Use this link within 24 hours:\n${link}\n\nIf you did not ask for this, contact Herdvest.`) : false;
    return `Reset link created${sent ? " and emailed" : ""}. ${sent ? "" : "Share it only after confirming the investor's identity. "}It is shown once and expires in 24 hours:\n${link}`;
  }, inv(investorId));
}

export async function setPortalStatus(accountId: string, investorId: string, status: "active" | "suspended" | "revoked", prev: ActionState, fd: FormData) {
  return runAction(prev, async (db) => {
    const f = new Form(fd);
    const reason = f.text("reason", { required: status !== "active", max: 500, label: "Reason" });
    f.check();
    await db.query("select hv.portal_set_status($1, $2, $3)", [accountId, status, reason]);
    return status === "active" ? "Portal access restored. The investor must sign in again." : `Portal access ${status}. All of the investor's sessions have been ended.`;
  }, inv(investorId));
}

export async function resetPortalMfa(accountId: string, investorId: string, prev: ActionState) {
  return runAction(prev, async (db) => {
    await db.query("select hv.portal_reset_mfa($1)", [accountId]);
    return "Two-step verification removed. The investor can set it up again after signing in.";
  }, inv(investorId));
}

export async function resolveChangeRequest(requestId: string, investorId: string, status: "resolved" | "declined", prev: ActionState, fd: FormData) {
  return runAction(prev, async (db) => {
    const f = new Form(fd);
    const note = f.text("note", { required: true, max: 1000, label: "Note" });
    f.check();
    await db.query("select hv.resolve_change_request($1, $2, $3)", [requestId, status, note]);
    return "Request closed. The investor can see your note.";
  }, inv(investorId));
}

export async function setIdentityNumber(investorId: string, prev: ActionState, fd: FormData) {
  return runAction(prev, async (db) => {
    const f = new Form(fd);
    const id = f.text("national_id", { max: 40 });
    if (id && !/^[0-9A-Za-z-]{5,40}$/.test(id)) f.errors.national_id = "Use digits, letters and dashes only, e.g. 35202-1234567-1.";
    f.check();
    await db.query("select hv.set_investor_identity($1, $2)", [investorId, id]);
    return id ? "Identity number saved. It is shown masked everywhere else." : "Identity number removed.";
  }, inv(investorId));
}

export async function setAgreedBudget(accountId: string, investorId: string, prev: ActionState, fd: FormData) {
  return runAction(prev, async (db) => {
    const f = new Form(fd);
    const budget = f.money("agreed_budget");
    f.check();
    await db.query("update hv.investment_accounts set agreed_budget = $2 where id = $1", [accountId, budget]);
    return "Investment budget saved.";
  }, inv(investorId));
}

/* ----------------------------------------------- payment requests ---- */

export async function createPaymentRequest(accountId: string, investorId: string, prev: ActionState, fd: FormData) {
  return runAction(prev, async (db) => {
    const f = new Form(fd);
    const amount = f.money("amount", { required: true });
    const reason = f.text("reason", { required: true, max: 500, label: "Reason" });
    const clause = f.text("agreement_clause", { required: true, max: 200, label: "Agreement clause" });
    const due = f.date("due_date");
    f.check();
    await db.query("select hv.create_payment_request($1, $2, $3, $4, $5)", [accountId, amount, reason, clause, due]);
    return "Draft request saved. It is not visible to the investor until a finance approver issues it.";
  }, inv(investorId));
}

export async function issuePaymentRequest(requestId: string, investorId: string, prev: ActionState) {
  return runAction(prev, async (db) => {
    await db.query("select hv.issue_payment_request($1)", [requestId]);
    await afterPublish(db);
    return "Request issued. The investor has been notified in the portal.";
  }, inv(investorId));
}

export async function closePaymentRequest(requestId: string, investorId: string, status: "paid" | "cancelled", prev: ActionState, fd: FormData) {
  return runAction(prev, async (db) => {
    const f = new Form(fd);
    const ledger = status === "paid" ? f.id("ledger_entry_id", { required: true, label: "the verified deposit" }) : null;
    const note = f.text("note", { required: status === "cancelled", max: 500, label: "Reason" });
    f.check();
    await db.query("select hv.close_payment_request($1, $2, $3, $4)", [requestId, status, ledger, note]);
    return status === "paid" ? "Marked as paid against the verified deposit." : "Request cancelled.";
  }, inv(investorId));
}

/* ---------------------------------------------------- publication ---- */

export async function setVetPublication(vetId: string, visible: boolean, prev: ActionState, fd: FormData) {
  return runAction(prev, async (db) => {
    const f = new Form(fd);
    const summary = f.text("investor_summary", { max: 2000 });
    f.check();
    await db.query("select hv.set_vet_publication($1, $2, $3)", [vetId, visible, summary]);
    if (visible) await afterPublish(db);
    return visible ? "Published to the investor portal." : "Withdrawn from the investor portal.";
  }, [`/management/veterinary/${vetId}`, "/management/portal"]);
}

export async function setFilePublication(fileId: string, visible: boolean, path: string, prev: ActionState) {
  return runAction(prev, async (db) => {
    await db.query("select hv.set_attachment_publication($1, $2)", [fileId, visible]);
    if (visible) await afterPublish(db);
    return visible ? "Shared with the investor." : "No longer shared with the investor.";
  }, [path]);
}

/* ------------------------------------------------- animal monitoring -- */

export async function recordWeight(animalId: string, prev: ActionState, fd: FormData) {
  return runAction(prev, async (db, user) => {
    const f = new Form(fd);
    const date = f.date("measured_on", { required: true });
    const weight = f.number("weight", { required: true, min: 1, max: 2999 });
    const method = f.choice("method", ["scale", "weigh_tape", "visual_estimate", "other"] as const, { required: true });
    const by = f.text("measured_by", { max: 200 });
    const notes = f.text("notes", { max: 1000 });
    const publish = f.bool("publish");
    if (publish && !user.permissions.has("portal.publish")) f.errors.publish = "You don't have permission to publish to investors.";
    f.check();
    const id = (await db.query("select hv.record_weight($1, $2::date, $3, $4, $5, $6, null, $7) id",
      [animalId, date, weight, method, by, notes, publish])).rows[0].id;
    const file = await saveFormFile(db, fd.get("file"), "animal_weight", id, "animal_photo");
    if (publish) await afterPublish(db);
    return `Weight recorded${file ? " with photo" : ""}${publish ? " and published to the investor" : " (not yet published to the investor)"}.`;
  }, animal(animalId));
}

export async function setWeightPublication(weightId: string, animalId: string, visible: boolean, prev: ActionState) {
  return runAction(prev, async (db) => {
    await db.query("select hv.set_weight_publication($1, $2)", [weightId, visible]);
    if (visible) await afterPublish(db);
    return visible ? "Weight published." : "Weight withdrawn from the portal.";
  }, animal(animalId));
}

export async function voidWeight(weightId: string, animalId: string, prev: ActionState, fd: FormData) {
  return runAction(prev, async (db) => {
    const f = new Form(fd);
    const reason = f.text("reason", { required: true, max: 500, label: "Reason" });
    f.check();
    await db.query("select hv.void_weight($1, $2)", [weightId, reason]);
    return "Measurement voided. It stays in the history and is hidden from the investor.";
  }, animal(animalId));
}

export async function setCarePlan(animalId: string, prev: ActionState, fd: FormData) {
  return runAction(prev, async (db) => {
    const f = new Form(fd);
    const interval = f.number("interval", { integer: true, min: 1, max: 24 });
    const due = f.date("next_due");
    const notes = f.text("notes", { max: 1000 });
    f.check();
    await db.query("select hv.set_care_plan($1, $2, $3::date, $4)", [animalId, interval, due, notes]);
    return "Inspection plan saved.";
  }, animal(animalId));
}

export async function createForecast(animalId: string, prev: ActionState, fd: FormData) {
  return runAction(prev, async (db) => {
    const f = new Form(fd);
    const price = f.money("expected_sale_price", { required: true });
    const date = f.date("expected_sale_date");
    const period = f.text("expected_sale_period", { max: 120 });
    const weight = f.number("estimated_weight_kg", { min: 1, max: 2999 });
    const weightDate = f.date("estimated_weight_date");
    const assumptions = f.text("assumptions", { required: true, max: 2000, label: "Assumptions" });
    if (assumptions && assumptions.length < 10) f.errors.assumptions = "Explain the basis of the estimate.";
    if (!date && !period) f.errors.expected_sale_date = "Give an expected sale date or period.";
    if ((weight === null) !== (weightDate === null)) f.errors.estimated_weight_date = "Give both an estimated weight and its date, or neither.";
    f.check();
    await db.query("select hv.create_forecast($1, $2, $3::date, $4, $5, $6::date, $7)", [animalId, price, date, period, weight, weightDate, assumptions]);
    return "Draft forecast saved. Investors see it only after it is published.";
  }, animal(animalId));
}

export async function publishForecast(forecastId: string, animalId: string, prev: ActionState) {
  return runAction(prev, async (db) => {
    await db.query("select hv.publish_forecast($1)", [forecastId]);
    await afterPublish(db);
    return "Forecast published. Any earlier published forecast is marked superseded.";
  }, animal(animalId));
}

export async function withdrawForecast(forecastId: string, animalId: string, prev: ActionState, fd: FormData) {
  return runAction(prev, async (db) => {
    const f = new Form(fd);
    const reason = f.text("reason", { required: true, max: 500, label: "Reason" });
    f.check();
    await db.query("select hv.withdraw_forecast($1, $2)", [forecastId, reason]);
    return "Forecast withdrawn.";
  }, animal(animalId));
}

export async function publishUpdate(animalId: string, prev: ActionState, fd: FormData) {
  return runAction(prev, async (db) => {
    const f = new Form(fd);
    const kind = f.choice("kind", ["health", "progress", "sale", "general"] as const, { required: true });
    const title = f.text("title", { required: true, max: 160, label: "Title" });
    const body = f.text("body", { required: true, max: 4000, label: "Update" });
    f.check();
    await db.query("select hv.publish_animal_update($1, $2, $3, $4)", [animalId, kind, title, body]);
    await afterPublish(db);
    return "Update published to the investor.";
  }, animal(animalId));
}

export async function withdrawUpdate(updateId: string, animalId: string, prev: ActionState, fd: FormData) {
  return runAction(prev, async (db) => {
    const f = new Form(fd);
    const reason = f.text("reason", { required: true, max: 500, label: "Reason" });
    f.check();
    await db.query("select hv.withdraw_animal_update($1, $2)", [updateId, reason]);
    return "Update withdrawn.";
  }, animal(animalId));
}
