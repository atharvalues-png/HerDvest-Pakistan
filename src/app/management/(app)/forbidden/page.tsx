import { Empty, LinkButton } from "@/components/erp/ui";

export const metadata = { title: "Not permitted" };

export default function Forbidden() {
  return (
    <div className="pt-10">
      <Empty title="You don't have access to this area" action={<LinkButton href="/management">Back to dashboard</LinkButton>}>
        Your role does not include the permission needed for this page. Ask an administrator if you need access.
      </Empty>
    </div>
  );
}
