import { requireUser } from "@/lib/auth/session";
import { withUser } from "@/lib/server/db";
import { getSettings } from "@/lib/erp/settings";
import { isStorageConfigured } from "@/lib/server/storage";
import { Badge, Card, PageHeader } from "@/components/erp/ui";
import { SettingsForms } from "./SettingsForms";

export const metadata = { title: "Settings" };

export default async function SettingsPage() {
  const user = await requireUser("settings.manage");
  const s = await getSettings();
  const d = await withUser(user.id, async (db) => ({
    categories: (await db.query("select id, label from hv.expense_categories order by label")).rows,
    types: (await db.query("select id, label from hv.livestock_types order by label")).rows,
  }));
  const integrations: Array<[string, boolean, string]> = [
    ["Database (DATABASE_URL)", Boolean(process.env.DATABASE_URL), "PostgreSQL connection for the app role"],
    ["Private file storage (FILE_STORAGE_DIR)", isStorageConfigured(), "Local disk storage; use a persistent volume or replace with a private bucket"],
    ["Enquiry email notifications (RESEND_API_KEY + ENQUIRY_NOTIFY_EMAIL)", Boolean(process.env.RESEND_API_KEY && process.env.ENQUIRY_NOTIFY_EMAIL), "Optional email alert when a website enquiry arrives"],
    ["Email intake webhook (INTAKE_WEBHOOK_SECRET)", Boolean(process.env.INTAKE_WEBHOOK_SECRET), "Needs an inbound-email provider configured to POST to /api/intake/email"],
    ["WhatsApp intake (WHATSAPP_VERIFY_TOKEN + WHATSAPP_APP_SECRET)", Boolean(process.env.WHATSAPP_VERIFY_TOKEN && process.env.WHATSAPP_APP_SECRET), "Needs a WhatsApp Business Platform app pointing to /api/intake/whatsapp"],
  ];
  return (
    <div className="max-w-4xl space-y-6">
      <PageHeader title="Settings" />
      <SettingsForms timezone={s.timezone} dualControl={s.dualControl} categories={d.categories} types={d.types} />
      <Card title="Integrations (server configuration)">
        <ul className="divide-y divide-forest/5 text-sm">
          {integrations.map(([name, ok, hint]) => (
            <li key={name} className="flex items-start justify-between gap-4 py-2.5">
              <span><span className="font-medium text-charcoal">{name}</span><span className="block text-xs text-ink-500">{hint}</span></span>
              <Badge tone={ok ? "green" : "gold"}>{ok ? "Configured" : "Not configured"}</Badge>
            </li>
          ))}
        </ul>
        <p className="mt-3 text-xs text-ink-500">&ldquo;Configured&rdquo; only means the setting is present on this server — it does not prove the external service has been tested end-to-end.</p>
      </Card>
    </div>
  );
}
