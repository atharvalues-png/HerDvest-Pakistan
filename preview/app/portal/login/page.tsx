import type { Metadata } from "next";
import { PreviewNotice } from "../../PreviewNotice";

export const metadata: Metadata = { title: { absolute: "Investor Portal — preview" }, robots: { index: false } };

export default function Page() {
  return <PreviewNotice area="Investor Portal" />;
}
