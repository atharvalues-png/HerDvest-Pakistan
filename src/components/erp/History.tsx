import type { SessionUser } from "@/lib/auth/session";
import { withUser } from "@/lib/server/db";
import { Card, Timeline } from "./ui";

const verbs: Record<string, string> = { INSERT: "Created", UPDATE: "Changed", DELETE: "Deleted" };

function describe(row: { action: string; table_name: string; new_values: Record<string, unknown> | null; old_values: Record<string, unknown> | null; note: string | null }) {
  const verb = verbs[row.action] ?? row.action.replace(/_/g, " ").toLowerCase();
  const table = row.table_name.replace(/_/g, " ");
  if (row.action === "UPDATE" && row.new_values) {
    const keys = Object.keys(row.new_values).filter((k) => k !== "updated_at");
    return {
      title: `${verb} ${table}: ${keys.join(", ")}`,
      body: keys.slice(0, 4).map((k) => `${k}: ${fmt(row.old_values?.[k])} → ${fmt(row.new_values?.[k])}`).join(" · "),
    };
  }
  return { title: `${verb} ${table}`, body: row.note ?? undefined };
}

const fmt = (v: unknown) => (v === null || v === undefined ? "—" : typeof v === "object" ? JSON.stringify(v).slice(0, 60) : String(v).slice(0, 60));

/** Audit trail for one or more record ids (only for users with audit.read). */
export async function History({ user, ids, timeZone, title = "Activity history" }: { user: SessionUser; ids: string[]; timeZone: string; title?: string }) {
  if (!user.permissions.has("audit.read")) return null;
  const rows = await withUser(user.id, async (db) =>
    (await db.query(
      `select a.at, a.action, a.table_name, a.old_values, a.new_values, a.note, u.full_name who
         from hv.audit_log a left join hv.users u on u.id = a.user_id
        where a.record_id = any($1) order by a.at desc limit 50`,
      [ids],
    )).rows,
  );
  return (
    <Card title={title}>
      <Timeline timeZone={timeZone} items={rows.map((r) => ({ at: r.at, who: r.who ?? "System", ...describe(r) }))} />
    </Card>
  );
}
