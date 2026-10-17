import "server-only";
import { cache } from "react";
import { withUser } from "@/lib/server/db";
import { getSessionUser } from "@/lib/auth/session";

export type ErpSettings = { timezone: string; dualControl: boolean };

/** Business settings for the current request (timezone is configurable, not hard-coded). */
export const getSettings = cache(async (): Promise<ErpSettings> => {
  const user = await getSessionUser();
  const rows = user
    ? await withUser(user.id, async (db) => (await db.query("select key, value from hv.settings")).rows)
    : [];
  const map = Object.fromEntries(rows.map((r) => [r.key, r.value]));
  return {
    timezone: typeof map.timezone === "string" ? map.timezone : process.env.BUSINESS_TIMEZONE ?? "Asia/Karachi",
    dualControl: map.dual_control === true,
  };
});
