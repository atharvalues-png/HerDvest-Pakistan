import "server-only";
import { cache } from "react";
import { requireInvestor } from "@/lib/auth/portal-session";
import { withInvestor, type Db } from "@/lib/server/db";

/**
 * Data access for portal pages. Every call runs in the investor's database
 * context (hv.portal_session); the database decides which investor that is.
 */
export async function portalQuery<T>(fn: (db: Db) => Promise<T>): Promise<T> {
  const user = await requireInvestor();
  return withInvestor(user.sessionHash, fn);
}

export const portalTimezone = cache(async () => {
  const tz = await portalQuery(async (db) => (await db.query("select coalesce(hv.setting('timezone') #>> '{}', 'Asia/Karachi') tz")).rows[0].tz);
  return tz as string;
});

export const isUuid = (v: string) => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v);

export const inspectionStateLabel: Record<string, string> = {
  completed: "Completed",
  awaiting_review: "Awaiting review",
  scheduled: "Scheduled",
  pending: "Inspection pending",
  overdue: "Overdue",
  not_planned: "Not yet scheduled",
  closed: "No further inspections",
  cancelled: "Cancelled",
  missed: "Missed",
};

export const animalStatusLabel: Record<string, string> = {
  sourcing: "Being sourced",
  purchased: "Purchased",
  awaiting_allocation: "Awaiting placement with a farmer",
  allocated: "Placed with a partner farmer",
  active: "Active and under care",
  under_treatment: "Under veterinary treatment",
  sale_preparation: "Being prepared for sale",
  sold: "Sold",
  deceased: "Deceased",
  other: "See latest update",
};

export const weightSourceLabel: Record<string, string> = {
  scale: "Weighing scale",
  weigh_tape: "Weigh tape (estimate from girth)",
  visual_estimate: "Visual estimate",
  other: "Other method",
  veterinary_record: "Recorded during veterinary visit",
};

export const ESTIMATE_NOTICE = "Estimated outcomes only. Actual sale prices, timing, and returns may differ. Capital loss is possible.";
