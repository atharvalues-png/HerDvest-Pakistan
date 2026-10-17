import { requireUser } from "@/lib/auth/session";
import { withUser } from "@/lib/server/db";
import { getSettings } from "@/lib/erp/settings";
import { formatDate } from "@/lib/erp/format";
import { employeeOptions } from "@/lib/erp/options";
import { ConfirmAction, Checkbox, Input, Select } from "@/components/erp/form";
import { Card, LinkButton, PageHeader, StatusBadge } from "@/components/erp/ui";
import { createUser, resetPassword, updateUser } from "./actions";

export const metadata = { title: "Users & roles" };

export default async function UsersPage() {
  const user = await requireUser("users.manage");
  const { timezone } = await getSettings();
  const d = await withUser(user.id, async (db) => ({
    users: (await db.query(
      `select u.id, u.email, u.full_name, u.role_id, u.employee_id, u.is_active, u.last_login_at, u.locked_until, r.name role, e.code employee_code
         from hv.users u join hv.roles r on r.id = u.role_id left join hv.employees e on e.id = u.employee_id order by u.full_name`)).rows,
    roles: (await db.query("select id, name from hv.roles order by is_system desc, name")).rows.map((r) => [r.id, r.name] as [string, string]),
    employees: await employeeOptions(db),
  }));
  const assignable = user.roleId === "super_admin" ? d.roles : d.roles.filter(([id]) => id !== "super_admin");

  return (
    <div className="space-y-6">
      <PageHeader title="Users & roles" subtitle="Who can sign in, and what their role allows. Nobody can change their own role."
        actions={<>
          <LinkButton href="/management/users/roles" variant="secondary">Role permissions</LinkButton>
          <ConfirmAction action={createUser} keepOpen trigger="New user" triggerVariant="primary" title="Create a user account"
            description="A temporary password is generated and shown once. The user must change it at first sign-in.">
            <Input name="full_name" label="Full name" required />
            <Input name="email" label="Email (sign-in)" type="email" required />
            <Select name="role_id" label="Role" required options={assignable} />
            <Select name="employee_id" label="Linked employee record" options={d.employees} placeholder="None" hint="Required for field staff to receive tasks." />
          </ConfirmAction>
        </>} />
      <Card bodyClassName="p-0">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[720px] text-sm">
            <thead className="bg-ivory/70 text-left text-xs text-ink-600"><tr><th className="px-5 py-2">User</th><th className="px-3 py-2">Role</th><th className="px-3 py-2">Employee</th><th className="px-3 py-2">Last sign-in</th><th className="px-3 py-2">Status</th><th className="px-3 py-2"></th></tr></thead>
            <tbody className="divide-y divide-forest/5">
              {d.users.map((u) => {
                const self = u.id === user.id;
                const protectedUser = u.role_id === "super_admin" && user.roleId !== "super_admin";
                return (
                  <tr key={u.id}>
                    <td className="px-5 py-2.5"><p className="font-semibold text-forest">{u.full_name}{self && " (you)"}</p><p className="text-xs text-ink-500">{u.email}</p></td>
                    <td className="px-3 py-2.5">{u.role}</td>
                    <td className="px-3 py-2.5">{u.employee_code ?? "—"}</td>
                    <td className="px-3 py-2.5 text-xs">{formatDate(u.last_login_at, timezone, true)}{u.locked_until && new Date(u.locked_until) > new Date() && <span className="block text-alert">Locked</span>}</td>
                    <td className="px-3 py-2.5"><StatusBadge status={u.is_active ? "active" : "suspended"} /></td>
                    <td className="px-3 py-2.5 text-right">
                      {!protectedUser && (
                        <span className="inline-flex gap-1">
                          <ConfirmAction action={updateUser.bind(null, u.id)} trigger="Edit" triggerVariant="ghost" title={`Edit ${u.full_name}`}
                            description={self ? "You cannot change your own role or deactivate yourself." : undefined}>
                            <Input name="full_name" label="Full name" required defaultValue={u.full_name} />
                            <Select name="role_id" label="Role" required options={self ? d.roles.filter(([id]) => id === u.role_id) : assignable} defaultValue={u.role_id} placeholder={false} />
                            <Select name="employee_id" label="Linked employee" options={d.employees} defaultValue={u.employee_id} placeholder="None" />
                            {self ? <input type="hidden" name="is_active" value="on" /> : <Checkbox name="is_active" label="Account active" defaultChecked={u.is_active} />}
                          </ConfirmAction>
                          {!self && (
                            <ConfirmAction action={resetPassword.bind(null, u.id)} keepOpen trigger="Reset password" triggerVariant="ghost" title="Reset password?" variant="danger" confirmLabel="Reset"
                              description="Generates a new temporary password, signs the user out everywhere and requires a new password at next sign-in." />
                          )}
                        </span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
