import { requireUser } from "@/lib/auth/session";
import { Alert, Card, DL, PageHeader } from "@/components/erp/ui";
import { ChangePasswordForm } from "./ChangePasswordForm";

export const metadata = { title: "My account" };

export default async function AccountPage({ searchParams }: { searchParams: Promise<{ required?: string }> }) {
  const user = await requireUser();
  const { required } = await searchParams;
  return (
    <div className="max-w-2xl space-y-6">
      <PageHeader title="My account" />
      {(required || user.mustChangePassword) && (
        <Alert tone="warn" title="Please set a new password">
          Your password was set by an administrator. Choose your own password to continue.
        </Alert>
      )}
      <Card title="Profile">
        <DL items={[["Name", user.fullName], ["Email", user.email], ["Role", user.roleName], ["Permissions", `${user.permissions.size} granted by role`]]} />
      </Card>
      <Card title="Change password">
        <ChangePasswordForm />
      </Card>
    </div>
  );
}
