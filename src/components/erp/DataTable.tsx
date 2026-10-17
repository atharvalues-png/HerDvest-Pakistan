import Link from "next/link";
import type { ReactNode } from "react";
import { ArrowDown, ArrowUp, ChevronLeft, ChevronRight, Search } from "lucide-react";
import type { ListMeta, SearchParams } from "@/lib/erp/list";
import { cn } from "@/lib/format";
import { Empty } from "./ui";

export type Column<R> = {
  key: string;
  label: string;
  sortable?: boolean;
  align?: "right";
  className?: string;
  render: (row: R) => ReactNode;
};

function qs(base: SearchParams, patch: Record<string, string | null>) {
  const p = new URLSearchParams();
  for (const [k, v] of Object.entries(base)) {
    const val = Array.isArray(v) ? v[0] : v;
    if (val) p.set(k, val);
  }
  for (const [k, v] of Object.entries(patch)) {
    if (v === null || v === "") p.delete(k);
    else p.set(k, v);
  }
  const s = p.toString();
  return s ? `?${s}` : "?";
}

/**
 * Server-rendered table with search, sortable headers and pagination driven
 * entirely by URL parameters (works without JavaScript, shareable links).
 */
export function DataTable<R>({
  rows,
  columns,
  meta,
  sp,
  rowHref,
  searchPlaceholder = "Search…",
  filters,
  emptyTitle = "No records yet",
  emptyBody,
  emptyAction,
}: {
  rows: R[];
  columns: Column<R>[];
  meta: ListMeta;
  sp: SearchParams;
  rowHref?: (row: R) => string;
  searchPlaceholder?: string;
  filters?: ReactNode;
  emptyTitle?: string;
  emptyBody?: ReactNode;
  emptyAction?: ReactNode;
}) {
  const pages = Math.max(1, Math.ceil(meta.total / meta.pageSize));
  const from = meta.total === 0 ? 0 : meta.offset + 1;
  const to = Math.min(meta.total, meta.offset + rows.length);

  return (
    <div>
      <form method="get" className="mb-3 flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center">
        <label className="relative sm:w-72">
          <span className="sr-only">Search</span>
          <Search aria-hidden className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-500" />
          <input
            type="search"
            name="q"
            defaultValue={meta.q}
            placeholder={searchPlaceholder}
            className="w-full rounded-lg border border-forest/15 bg-white py-2 pl-9 pr-3 text-sm focus:border-emerald focus:outline-none focus:ring-4 focus:ring-emerald/15"
          />
        </label>
        {filters}
        {meta.sortKey && <input type="hidden" name="sort" value={meta.sortKey} />}
        <input type="hidden" name="dir" value={meta.dir} />
        <button className="rounded-lg border border-forest/15 bg-white px-3 py-2 text-sm font-semibold text-forest hover:border-forest/40">
          Apply
        </button>
      </form>

      {rows.length === 0 ? (
        <Empty title={meta.q ? "No matching records" : emptyTitle} action={meta.q ? undefined : emptyAction}>
          {meta.q ? "Try a different search or clear the filters." : emptyBody}
        </Empty>
      ) : (
        <div className="overflow-x-auto rounded-2xl border border-forest/10 bg-white">
          <table className="w-full min-w-[640px] text-left text-sm">
            <thead className="border-b border-forest/10 bg-ivory/70 text-xs text-ink-600">
              <tr>
                {columns.map((c) => {
                  const active = meta.sortKey === c.key;
                  const nextDir = active && meta.dir === "asc" ? "desc" : "asc";
                  return (
                    <th
                      key={c.key}
                      scope="col"
                      aria-sort={active ? (meta.dir === "asc" ? "ascending" : "descending") : undefined}
                      className={cn("whitespace-nowrap px-4 py-2.5 font-semibold", c.align === "right" && "text-right")}
                    >
                      {c.sortable ? (
                        <Link href={qs(sp, { sort: c.key, dir: nextDir, page: null })} className="inline-flex items-center gap-1 hover:text-forest">
                          {c.label}
                          {active && (meta.dir === "asc" ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />)}
                        </Link>
                      ) : (
                        c.label
                      )}
                    </th>
                  );
                })}
              </tr>
            </thead>
            <tbody className="divide-y divide-forest/5">
              {rows.map((row, i) => (
                <tr key={i} className={cn(rowHref && "relative hover:bg-ivory/60")}>
                  {columns.map((c, ci) => (
                    <td key={c.key} className={cn("px-4 py-2.5 align-top", c.align === "right" && "text-right", c.className)}>
                      {ci === 0 && rowHref ? (
                        <Link href={rowHref(row)} className="font-semibold text-forest after:absolute after:inset-0 hover:underline">
                          {c.render(row)}
                        </Link>
                      ) : (
                        c.render(row)
                      )}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {meta.total > 0 && (
        <nav aria-label="Pagination" className="mt-3 flex items-center justify-between text-xs text-ink-500">
          <span>
            {from}–{to} of {meta.total}
          </span>
          <span className="flex items-center gap-1">
            {meta.page > 1 ? (
              <Link aria-label="Previous page" href={qs(sp, { page: String(meta.page - 1) })} className="rounded-md border border-forest/15 bg-white p-1.5 hover:border-forest/40">
                <ChevronLeft className="h-4 w-4" />
              </Link>
            ) : (
              <span className="rounded-md border border-forest/10 p-1.5 opacity-40"><ChevronLeft className="h-4 w-4" /></span>
            )}
            <span className="px-2">
              Page {meta.page} of {pages}
            </span>
            {meta.page < pages ? (
              <Link aria-label="Next page" href={qs(sp, { page: String(meta.page + 1) })} className="rounded-md border border-forest/15 bg-white p-1.5 hover:border-forest/40">
                <ChevronRight className="h-4 w-4" />
              </Link>
            ) : (
              <span className="rounded-md border border-forest/10 p-1.5 opacity-40"><ChevronRight className="h-4 w-4" /></span>
            )}
          </span>
        </nav>
      )}
    </div>
  );
}

export function FilterSelect({ name, value, options, allLabel }: { name: string; value: string; options: Array<[string, string]>; allLabel: string }) {
  return (
    <label className="sm:w-48">
      <span className="sr-only">{allLabel}</span>
      <select
        name={name}
        defaultValue={value}
        className="w-full rounded-lg border border-forest/15 bg-white px-3 py-2 text-sm focus:border-emerald focus:outline-none focus:ring-4 focus:ring-emerald/15"
      >
        <option value="">{allLabel}</option>
        {options.map(([v, l]) => (
          <option key={v} value={v}>
            {l}
          </option>
        ))}
      </select>
    </label>
  );
}
