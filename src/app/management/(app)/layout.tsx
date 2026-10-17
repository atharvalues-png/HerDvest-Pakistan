import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Shell } from "@/components/erp/Shell";
import { requireUser } from "@/lib/auth/session";
import { visibleNav } from "@/lib/erp/nav";
import { headers } from "next/headers";
import { logout } from "../auth-actions";

export const metadata: Metadata = {
  title: { default: "Herdvest Management System", template: "%s · Herdvest MS" },
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

export default async function ManagementLayout({ children }: { children: React.ReactNode }) {
  const user = await requireUser();
  const path = (await headers()).get("x-hv-path") ?? "";
  if (user.mustChangePassword && path !== "/management/account") redirect("/management/account?required=1");
  return (
    <Shell nav={visibleNav(user.permissions, !!user.employeeId)} user={{ name: user.fullName, role: user.roleName }} signOut={logout}>
      {children}
    </Shell>
  );
}
