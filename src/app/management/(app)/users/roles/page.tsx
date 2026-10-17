import { requireUser } from "@/lib/auth/session";
import { withUser } from "@/lib/server/db";
import { ConfirmAction, Input } from "@/components/erp/form";
import { Alert, Card, PageHeader } from "@/components/erp/ui";
import { createRole } from "../actions";
import { PermissionToggle } from "./PermissionToggle";

export const metadata = { title: "Role permissions" };

export default async function RolesPage() {
  const user = await requireUser("users.manage");
  const d = await withUser(user.id, async (db) => ({
    roles: (await db.query("select id, name, description from hv.roles order by is_system desc, name")).rows,
    perms: (await db.query("select id, module, description from hv.permissions order by module, id")).rows,
    grants: new Set((await db.query("select role_id || ':' || permission_id k from hv.role_permissions")).rows.map((r) => r.k as string)),
  }));
  const editable = user.roleId === "super_admin";
  return (
    <div className="space-y-6">
      <PageHeader title="Role permissions" crumbs={[{ href: "/management/users", label: "Users & roles" }]}
        subtitle="Permissions are enforced on the server and in the database. Changing a checkbox here takes effect at the user's next request."
        actions={editable && (
          <ConfirmAction action={createRole} trigger="New role" triggerVariant="primary" title="Create a role">
            <Input name="id" label="Role ID" required hint="e.g. regional_supervisor" />
            <Input name="name" label="Display name" required />
            <Input name="description" label="Description" />
          </ConfirmAction>
        )} />
      {!editable && <Alert tone="info">Only a Super Admin can change role permissions.</Alert>}
      <Card bodyClassName="p-0">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="sticky top-0 bg-ivory text-xs text-ink-600">
              <tr>
                <th className="px-4 py-2 text-left">Permission</th>
                {d.roles.map((r) => <th key={r.id} className="px-2 py-2 text-center" title={r.description}>{r.name}</th>)}
              </tr>
            </thead>
            <tbody className="divide-y divide-forest/5">
              {d.perms.map((p) => (
                <tr key={p.id}>
                  <td className="px-4 py-2"><p className="font-medium text-charcoal">{p.description}</p><p className="font-mono text-[0.65rem] text-ink-500">{p.id}</p></td>
                  {d.roles.map((r) => (
                    <td key={r.id} className="px-2 py-2 text-center">
                      <PermissionToggle roleId={r.id} permission={p.id} granted={d.grants.has(`${r.id}:${p.id}`)} disabled={!editable || r.id === "super_admin"} />
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
