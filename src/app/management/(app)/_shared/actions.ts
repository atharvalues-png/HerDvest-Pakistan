"use server";

import { Form, runAction, type ActionState } from "@/lib/erp/action";

/** Soft-delete an attachment (file stays in storage; history is kept). */
export async function removeAttachment(id: string, path: string, prev: ActionState, fd: FormData) {
  return runAction(prev, async (db) => {
    const f = new Form(fd);
    const reason = f.text("reason", { required: true, max: 300, label: "Reason" });
    f.check();
    const r = await db.query("update hv.attachments set deleted_at = now(), delete_reason = $2 where id = $1 and deleted_at is null", [id, reason]);
    if (r.rowCount === 0) throw Object.assign(new Error("You can't remove this file."), { code: "P0001" });
    return "File removed. It remains in the audit history.";
  }, [path]);
}
