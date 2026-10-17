import Link from "next/link";
import { notFound } from "next/navigation";
import { can, requireUser } from "@/lib/auth/session";
import { withUser } from "@/lib/server/db";
import { getSettings } from "@/lib/erp/settings";
import { formatDate, label } from "@/lib/erp/format";
import { Attachments } from "@/components/erp/Attachments";
import { History } from "@/components/erp/History";
import { ConfirmAction, Input } from "@/components/erp/form";
import { Card, DL, Money, PageHeader, StatusBadge } from "@/components/erp/ui";
import { voidPurchase } from "../actions";

export const metadata = { title: "Purchase" };

export default async function PurchasePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await requireUser(["purchases.read", "finance.read"]);
  const { timezone } = await getSettings();
  const d = await withUser(user.id, async (db) => {
    const p = (await db.query(
      `select p.*, i.full_legal_name investor, a.code account_code, u.full_name created_by_name
         from hv.purchases p join hv.investors i on i.id = p.investor_id join hv.investment_accounts a on a.id = p.account_id
         left join hv.users u on u.id = p.created_by where p.id = $1`, [id])).rows[0];
    if (!p) return null;
    const lines = (await db.query(
      `select pl.price, an.* , f.full_name farmer from hv.purchase_lines pl join hv.animals an on an.id = pl.animal_id
         left join hv.farmers f on f.id = an.current_farmer_id where pl.purchase_id = $1 order by an.code`, [id])).rows;
    const ledger = (await db.query("select code, status, amount from hv.ledger_entries where purchase_id = $1 order by created_at", [id])).rows;
    return { p, lines, ledger };
  });
  if (!d) notFound();
  const { p } = d;

  return (
    <div className="space-y-6">
      <PageHeader title={`Purchase ${p.code}`} subtitle={<span className="flex items-center gap-2">{formatDate(p.purchase_date, timezone)} <StatusBadge status={p.status} /></span>}
        crumbs={[{ href: "/management/purchases", label: "Purchases" }]}
        actions={can(user, "finance.approve") && p.status === "completed" && (
          <ConfirmAction action={voidPurchase.bind(null, id)} trigger="Void purchase" triggerVariant="danger" variant="danger" confirmLabel="Void purchase"
            title="Void this purchase?" description="Only possible while its animals are not yet allocated. The funding allocation is reversed; nothing is deleted.">
            <Input name="reason" label="Reason" required />
          </ConfirmAction>
        )} />
      <div className="grid gap-6 lg:grid-cols-3">
        <Card title="Purchase details" className="lg:col-span-2">
          <DL cols={3} items={[
            ["Investor", <Link key="i" href={`/management/investors/${p.investor_id}`} className="text-emerald hover:underline">{p.investor}</Link>],
            ["Funding account", <Link key="a" href={`/management/accounts/${p.account_id}`} className="text-emerald hover:underline">{p.account_code}</Link>],
            ["Total cost", <Money key="t" value={p.total_cost} strong />],
            ["Seller", p.seller_name], ["Seller contact", p.seller_contact], ["Location", p.location],
            ["Recorded by", p.created_by_name], ["Recorded", formatDate(p.created_at, timezone, true)], ["Void reason", p.void_reason],
          ]} />
          {p.notes && <p className="mt-4 whitespace-pre-line text-sm text-ink-600">{p.notes}</p>}
        </Card>
        <Card title="Funding allocation">
          {d.ledger.length === 0 ? <p className="text-sm text-ink-500">Visible to Finance only.</p> : (
            <ul className="space-y-2 text-sm">
              {d.ledger.map((l) => <li key={l.code} className="flex justify-between"><span>{l.code}</span><span className="flex items-center gap-2"><Money value={l.amount} /><StatusBadge status={l.status} /></span></li>)}
            </ul>
          )}
        </Card>
      </div>
      <Card title={`Animals (${d.lines.length})`} bodyClassName="p-0">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[640px] text-sm">
            <thead className="bg-ivory/70 text-left text-xs text-ink-600"><tr><th className="px-5 py-2">Animal</th><th className="px-3 py-2">Type / breed</th><th className="px-3 py-2">Tag</th><th className="px-3 py-2">Farmer</th><th className="px-3 py-2">Status</th><th className="px-3 py-2 text-right">Price</th></tr></thead>
            <tbody className="divide-y divide-forest/5">
              {d.lines.map((a) => (
                <tr key={a.id}>
                  <td className="px-5 py-2.5"><Link href={`/management/animals/${a.id}`} className="font-semibold text-forest hover:underline">{a.code}</Link></td>
                  <td className="px-3 py-2.5">{label(a.species)} {a.breed ?? ""}</td>
                  <td className="px-3 py-2.5">{a.tag_number ?? "—"}</td>
                  <td className="px-3 py-2.5">{a.farmer ?? "—"}</td>
                  <td className="px-3 py-2.5"><StatusBadge status={a.status} /></td>
                  <td className="px-3 py-2.5 text-right"><Money value={a.price} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
      <Attachments user={user} entityType="purchase" entityId={id} path={`/management/purchases/${id}`} timeZone={timezone} defaultCategory="purchase_receipt" title="Receipts & documents" />
      <History user={user} ids={[id]} timeZone={timezone} />
    </div>
  );
}
