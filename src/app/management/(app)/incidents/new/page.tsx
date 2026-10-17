import { requireUser } from "@/lib/auth/session";
import { withUser } from "@/lib/server/db";
import { param, type SearchParams } from "@/lib/erp/list";
import { animalOptions } from "@/lib/erp/options";
import { Alert, Card, PageHeader } from "@/components/erp/ui";
import { IncidentForm } from "./IncidentForm";

export const metadata = { title: "Report incident" };

export default async function NewIncident({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const user = await requireUser("incidents.write");
  const sp = await searchParams;
  const animals = await withUser(user.id, (db) => animalOptions(db, "status not in ('sold','deceased')"));
  return (
    <div className="max-w-2xl">
      <PageHeader title="Report an incident" crumbs={[{ href: "/management/incidents", label: "Incidents" }]} />
      <div className="mb-4"><Alert tone="warn">Reporting a death marks the animal as deceased and ends its farmer allocation. All history and transactions are kept.</Alert></div>
      <Card><IncidentForm animals={animals} defaultAnimal={param(sp, "animal")} /></Card>
    </div>
  );
}
