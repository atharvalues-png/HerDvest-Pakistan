import Link from "next/link";
import { requireUser } from "@/lib/auth/session";
import { withUser } from "@/lib/server/db";
import { param, type SearchParams } from "@/lib/erp/list";
import { Badge, Empty, PageHeader } from "@/components/erp/ui";

export const metadata = { title: "Search" };

const hrefFor: Record<string, (id: string) => string> = {
  animal: (id) => `/management/animals/${id}`,
  investor: (id) => `/management/investors/${id}`,
  farmer: (id) => `/management/farmers/${id}`,
  ledger: () => `/management/ledger`,
  purchase: (id) => `/management/purchases/${id}`,
  expense: (id) => `/management/expenses/${id}`,
  sale: (id) => `/management/sales/${id}`,
  task: (id) => `/management/tasks/${id}`,
  enquiry: (id) => `/management/enquiries/${id}`,
};

export default async function SearchPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const user = await requireUser();
  const q = param(await searchParams, "q").slice(0, 80);
  // RLS limits results to records this user is allowed to see.
  const rows = q.length >= 2 ? await withUser(user.id, async (db) => (await db.query("select * from hv.global_search($1)", [q])).rows) : [];

  return (
    <div className="max-w-3xl">
      <PageHeader title="Search" subtitle="Animal ID, tag, investor/farmer ID or name, phone, transaction or purchase reference." />
      <form className="mb-6">
        <input
          name="q"
          defaultValue={q}
          autoFocus
          placeholder="e.g. HV-001, INV-0003, TXN-00012, 0300…"
          className="w-full rounded-xl border border-forest/15 bg-white px-4 py-3 text-base focus:border-emerald focus:outline-none focus:ring-4 focus:ring-emerald/15"
        />
      </form>
      {q.length < 2 ? (
        <p className="text-sm text-ink-500">Type at least two characters.</p>
      ) : rows.length === 0 ? (
        <Empty title="No matching records you can access" />
      ) : (
        <ul className="divide-y divide-forest/5 rounded-2xl border border-forest/10 bg-white">
          {rows.map((r) => (
            <li key={`${r.kind}-${r.id}`}>
              <Link href={hrefFor[r.kind]?.(r.id) ?? "/management"} className="flex items-center justify-between gap-4 px-5 py-3 hover:bg-ivory/60">
                <span className="min-w-0">
                  <span className="font-semibold text-forest">{r.code}</span> <span className="text-charcoal">{r.label}</span>
                  {r.detail && <span className="block truncate text-xs text-ink-500">{r.detail}</span>}
                </span>
                <Badge>{r.kind}</Badge>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
