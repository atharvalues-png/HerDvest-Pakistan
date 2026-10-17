import { getPortalSession } from "@/lib/auth/portal-session";
import { withInvestor } from "@/lib/server/db";
import { renderReportPdf } from "@/lib/erp/pdf";
import { formatMoney } from "@/lib/erp/format";
import { portalStatementReport, statementRows, type TxRow } from "@/lib/portal/statement";

export const runtime = "nodejs";

/**
 * The signed-in investor's own statement as a PDF. Takes no investor id:
 * the database returns only the transactions of the session's investor.
 */
export async function GET() {
  const s = await getPortalSession();
  if (!s || !s.mfaPassed) return new Response("Not signed in", { status: 401 });

  const d = await withInvestor(s.sessionHash, async (db) => {
    const rows = (await db.query("select * from hv.portal_transactions()")).rows as TxRow[];
    const sum = (await db.query("select * from hv.portal_summary()")).rows[0];
    const tz = (await db.query("select coalesce(hv.setting('timezone') #>> '{}', 'Asia/Karachi') tz")).rows[0].tz as string;
    await db.query("select hv.portal_log('statement')");
    return { rows, sum, tz };
  });
  if (!d.sum) return new Response("Not signed in", { status: 401 });

  const pdf = await renderReportPdf({
    report: portalStatementReport,
    rows: statementRows([...d.rows].reverse()),
    filterSummary: [
      `${s.investorName} (${s.investorCode})`,
      `Verified funds received ${formatMoney(d.sum.funds_received)}`,
      `Unallocated ${formatMoney(d.sum.unallocated)}`,
      "Statement figures are approved calculations, not cash movements; outstanding requests are not payments",
    ],
    generatedBy: "Investor portal",
    timeZone: d.tz,
  });
  const date = new Date().toISOString().slice(0, 10);
  return new Response(new Uint8Array(pdf), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="herdvest-statement-${s.investorCode}-${date}.pdf"`,
      "Cache-Control": "private, no-store",
    },
  });
}
