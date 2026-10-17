import Link from "next/link";
import { FileBarChart } from "lucide-react";
import { can, requireUser } from "@/lib/auth/session";
import { reports } from "@/lib/erp/reports";
import { PageHeader } from "@/components/erp/ui";

export const metadata = { title: "Reports" };

export default async function ReportsPage() {
  const user = await requireUser(["reports.operational", "reports.financial"]);
  const visible = reports.filter((r) => can(user, ...r.perms));
  return (
    <div>
      <PageHeader title="Reports" subtitle="Filter, review, and export to CSV or PDF. Exports are recorded in the audit log." />
      <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {visible.map((r) => (
          <li key={r.slug}>
            <Link href={`/management/reports/${r.slug}`} className="flex h-full gap-3 rounded-2xl border border-forest/10 bg-white p-4 hover:border-emerald/40">
              <FileBarChart aria-hidden className="mt-0.5 h-5 w-5 shrink-0 text-emerald" />
              <span>
                <span className="block font-semibold text-forest">{r.title}</span>
                <span className="mt-0.5 block text-xs leading-relaxed text-ink-500">{r.description}</span>
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
