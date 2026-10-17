"use server";

import { Form, runAction, type ActionState } from "@/lib/erp/action";

export async function saveSettings(prev: ActionState, fd: FormData) {
  return runAction(prev, async (db) => {
    const f = new Form(fd);
    const tz = f.text("timezone", { required: true, max: 60, label: "Timezone" });
    const dual = f.bool("dual_control");
    if (tz) {
      try {
        new Intl.DateTimeFormat("en", { timeZone: tz });
      } catch {
        f.errors.timezone = "Unknown timezone. Use an IANA name such as Asia/Karachi.";
      }
    }
    f.check();
    await db.query("update hv.settings set value = to_jsonb($1::text), updated_at = now() where key = 'timezone'", [tz]);
    await db.query("update hv.settings set value = to_jsonb($1::boolean), updated_at = now() where key = 'dual_control'", [dual]);
    return "Settings saved.";
  }, ["/management/settings"]);
}

export async function addCategory(prev: ActionState, fd: FormData) {
  return runAction(prev, async (db) => {
    const f = new Form(fd);
    const id = f.text("id", { required: true, max: 40, label: "ID" });
    const lbl = f.text("label", { required: true, max: 100, label: "Label" });
    if (id && !/^[a-z][a-z0-9_]+$/.test(id)) f.errors.id = "Lowercase letters, numbers and underscores only.";
    f.check();
    await db.query("insert into hv.expense_categories (id, label) values ($1, $2)", [id, lbl]);
    return "Category added.";
  }, ["/management/settings"]);
}

export async function addLivestockType(prev: ActionState, fd: FormData) {
  return runAction(prev, async (db) => {
    const f = new Form(fd);
    const id = f.text("id", { required: true, max: 40, label: "ID" });
    const lbl = f.text("label", { required: true, max: 100, label: "Label" });
    if (id && !/^[a-z][a-z0-9_]+$/.test(id)) f.errors.id = "Lowercase letters, numbers and underscores only.";
    f.check();
    await db.query("insert into hv.livestock_types (id, label) values ($1, $2)", [id, lbl]);
    return "Livestock type added.";
  }, ["/management/settings"]);
}
