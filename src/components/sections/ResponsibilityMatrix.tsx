import { Check, Minus } from "lucide-react";
import { responsibilities } from "@/content/model";

const cols = [
  { key: "investor", label: "Investor" },
  { key: "farmer", label: "Farmer" },
  { key: "herdvest", label: "Herdvest" },
] as const;

export function ResponsibilityMatrix() {
  return (
    <div className="relative min-w-0 overflow-x-auto rounded-3xl border border-forest/10 bg-white shadow-soft">
      <table className="w-full min-w-[560px] text-left text-sm">
        <caption className="sr-only">Responsibilities of the investor, farmer and Herdvest</caption>
        <thead>
          <tr className="border-b border-forest/10 bg-ivory/60">
            <th scope="col" className="px-6 py-4 font-semibold text-forest">Responsibility</th>
            {cols.map((c) => (
              <th key={c.key} scope="col" className="w-28 px-4 py-4 text-center font-semibold text-forest">
                {c.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-forest/10">
          {responsibilities.map((r) => (
            <tr key={r.task}>
              <th scope="row" className="px-6 py-3.5 font-medium text-charcoal">{r.task}</th>
              {cols.map((c) => (
                <td key={c.key} className="px-4 py-3.5 text-center">
                  {r[c.key] ? (
                    <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-emerald text-ivory">
                      <Check aria-hidden className="h-3.5 w-3.5" strokeWidth={3} />
                      <span className="sr-only">Yes</span>
                    </span>
                  ) : (
                    <span className="inline-flex text-ink-500/40">
                      <Minus aria-hidden className="h-4 w-4" />
                      <span className="sr-only">No</span>
                    </span>
                  )}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
      <p className="border-t border-forest/10 px-6 py-4 text-xs text-ink-500">
        Indicative allocation of roles. The signed agreement is the final reference for each party&apos;s responsibilities.
      </p>
    </div>
  );
}
