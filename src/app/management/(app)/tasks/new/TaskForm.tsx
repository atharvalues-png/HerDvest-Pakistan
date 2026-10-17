"use client";

import { ActionForm, Input, Select, Submit, Textarea } from "@/components/erp/form";
import { createTask } from "../actions";

type Opt = ReadonlyArray<readonly [string, string]>;

export function TaskForm({ employees, animals, farmers, investors, defaults }: { employees: Opt; animals: Opt; farmers: Opt; investors: Opt; defaults: { animal?: string; farmer?: string } }) {
  return (
    <ActionForm action={createTask}>
      <Input name="title" label="Title" required />
      <div className="grid gap-4 sm:grid-cols-2">
        <Select name="task_type" label="Task type" required options={[
          ["farm_inspection", "Farm inspection"], ["animal_photography", "Animal photography"], ["vet_coordination", "Veterinary coordination"],
          ["vaccination_verification", "Vaccination verification"], ["status_check", "Animal status check"], ["receipt_collection", "Receipt collection"],
          ["farmer_verification", "Farmer verification"], ["sale_preparation", "Sale preparation"], ["other", "Other"]]} />
        <Select name="assigned_to" label="Assigned employee" required options={employees} />
        <Input name="due_date" label="Due date" type="date" />
        {animals.length > 0 && <Select name="animal_id" label="Related animal" options={animals} defaultValue={defaults.animal} placeholder="None" />}
        {farmers.length > 0 && <Select name="farmer_id" label="Related farmer" options={farmers} defaultValue={defaults.farmer} placeholder="None" />}
        {investors.length > 0 && <Select name="investor_id" label="Related investor" options={investors} placeholder="None" />}
      </div>
      <Textarea name="instructions" label="Instructions" rows={4} />
      <Submit>Create task</Submit>
    </ActionForm>
  );
}
