import { notFound } from "next/navigation";
import { requireUser } from "@/lib/auth/session";
import { withUser } from "@/lib/server/db";
import { Card, PageHeader } from "@/components/erp/ui";
import { updateFarmer } from "../../actions";
import { FarmerForm } from "../../FarmerForm";

export const metadata = { title: "Edit farmer" };

export default async function EditFarmer({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await requireUser("farmers.write");
  const f = await withUser(user.id, async (db) => (await db.query("select * from hv.farmers where id = $1", [id])).rows[0]);
  if (!f) notFound();
  return (
    <div className="max-w-3xl">
      <PageHeader title={`Edit ${f.full_name}`} crumbs={[{ href: "/management/farmers", label: "Farmers" }, { href: `/management/farmers/${id}`, label: f.code }]} />
      <Card><FarmerForm action={updateFarmer.bind(null, id)} farmer={f} /></Card>
    </div>
  );
}
