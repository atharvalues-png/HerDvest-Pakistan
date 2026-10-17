"use client";

import { ActionForm, FileField, Input, Select, Submit, Textarea } from "@/components/erp/form";
import { reportIncident } from "../actions";

export function IncidentForm({ animals, defaultAnimal }: { animals: ReadonlyArray<readonly [string, string]>; defaultAnimal?: string }) {
  return (
    <ActionForm action={reportIncident}>
      <Select name="animal_id" label="Animal" required options={animals} defaultValue={defaultAnimal} />
      <div className="grid gap-4 sm:grid-cols-2">
        <Select name="incident_type" label="Incident type" required options={[["death", "Death"], ["major_injury", "Major injury"], ["serious_illness", "Serious illness"], ["theft_or_loss", "Theft or loss"], ["other", "Other"]]} />
        <Input name="occurred_at" label="Date & time" type="datetime-local" required />
        <Input name="reported_by_name" label="Reported by" required className="sm:col-span-2" />
      </div>
      <Textarea name="description" label="What happened" required rows={4} />
      <Textarea name="vet_findings" label="Veterinary findings (if available)" rows={3} />
      <FileField name="file" label="Photo or document" accept="image/*,application/pdf" capture="environment" />
      <Submit>Report incident</Submit>
    </ActionForm>
  );
}
