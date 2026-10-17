import { notFound } from "next/navigation";
import { requireUser } from "@/lib/auth/session";
import { withUser } from "@/lib/server/db";
import { Card, PageHeader } from "@/components/erp/ui";
import { updateInvestor } from "../../actions";
import { InvestorForm } from "../../InvestorForm";

export const metadata = { title: "Edit investor" };

export default async function EditInvestor({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await requireUser("investors.write");
  const inv = await withUser(user.id, async (db) => (await db.query("select * from hv.investors where id = $1", [id])).rows[0]);
  if (!inv) notFound();
  return (
    <div className="max-w-3xl">
      <PageHeader title={`Edit ${inv.full_legal_name}`} crumbs={[{ href: "/management/investors", label: "Investors" }, { href: `/management/investors/${id}`, label: inv.code }]} />
      <Card><InvestorForm action={updateInvestor.bind(null, id)} investor={inv} /></Card>
    </div>
  );
}
