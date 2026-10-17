"use server";

import { randomBytes } from "node:crypto";
import { Form, runAction, type ActionState } from "@/lib/erp/action";
import { hashPassword } from "@/lib/auth/password";

const tempPassword = () => `Hv-${randomBytes(9).toString("base64url")}7`;

export async function createUser(prev: ActionState, fd: FormData) {
  return runAction(prev, async (db) => {
    const f = new Form(fd);
    const email = f.text("email", { required: true, max: 200, label: "Email" })?.toLowerCase();
    const name = f.text("full_name", { required: true, max: 200, label: "Name" });
    const role = f.text("role_id", { required: true, max: 60, label: "Role" });
    const employee = f.id("employee_id");
    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) f.errors.email = "Enter a valid email.";
    f.check();
    const pw = tempPassword();
    await db.query("select hv.admin_create_user($1, $2, $3, $4, $5)", [email, name, role, employee, await hashPassword(pw)]);
    return `User created. Temporary password (shown once — share it securely): ${pw}`;
  }, ["/management/users"]);
}

export async function updateUser(id: string, prev: ActionState, fd: FormData) {
  return runAction(prev, async (db) => {
    const f = new Form(fd);
    const name = f.text("full_name", { required: true, max: 200, label: "Name" });
    const role = f.text("role_id", { required: true, max: 60, label: "Role" });
    const employee = f.id("employee_id");
    const active = f.bool("is_active");
    f.check();
    const r = await db.query("update hv.users set full_name = $2, role_id = $3, employee_id = $4, is_active = $5 where id = $1", [id, name, role, employee, active]);
    if (r.rowCount === 0) throw Object.assign(new Error("You can't edit this user."), { code: "P0001" });
    return "User updated.";
  }, ["/management/users"]);
}

export async function resetPassword(id: string, prev: ActionState) {
  return runAction(prev, async (db) => {
    const pw = tempPassword();
    await db.query("select hv.auth_set_password($1, $2, null)", [id, await hashPassword(pw)]);
    return `Password reset and all sessions ended. Temporary password (shown once): ${pw}`;
  }, ["/management/users"]);
}

export async function togglePermission(roleId: string, permission: string, grant: boolean, prev: ActionState) {
  return runAction(prev, async (db) => {
    if (grant) await db.query("insert into hv.role_permissions (role_id, permission_id) values ($1, $2) on conflict do nothing", [roleId, permission]);
    else await db.query("delete from hv.role_permissions where role_id = $1 and permission_id = $2", [roleId, permission]);
    return grant ? "Permission granted." : "Permission removed.";
  }, ["/management/users/roles"]);
}

export async function createRole(prev: ActionState, fd: FormData) {
  return runAction(prev, async (db) => {
    const f = new Form(fd);
    const id = f.text("id", { required: true, max: 40, label: "Role ID" });
    const name = f.text("name", { required: true, max: 80, label: "Name" });
    const description = f.text("description", { max: 300 });
    if (id && !/^[a-z][a-z0-9_]{2,39}$/.test(id)) f.errors.id = "Use lowercase letters, numbers and underscores.";
    f.check();
    await db.query("insert into hv.roles (id, name, description) values ($1, $2, coalesce($3, ''))", [id, name, description]);
    return "Role created. Grant its permissions below.";
  }, ["/management/users/roles"]);
}
