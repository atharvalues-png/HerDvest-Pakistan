"use client";

import { useMemo, useState } from "react";
import { Search } from "lucide-react";
import { faqs, type FaqItem } from "@/content/faq";
import { Accordion } from "@/components/ui/Accordion";
import { cn } from "@/lib/format";

const filters: Array<{ key: "all" | FaqItem["tags"][number]; label: string }> = [
  { key: "all", label: "All questions" },
  { key: "general", label: "General" },
  { key: "investor", label: "Investors" },
  { key: "farmer", label: "Farmers" },
  { key: "risk", label: "Risk" },
];

export function FaqBrowser() {
  const [filter, setFilter] = useState<(typeof filters)[number]["key"]>("all");
  const [query, setQuery] = useState("");

  const items = useMemo(() => {
    const q = query.trim().toLowerCase();
    return faqs.filter(
      (f) =>
        (filter === "all" || f.tags.includes(filter)) &&
        (!q || f.q.toLowerCase().includes(q) || f.a.toLowerCase().includes(q)),
    );
  }, [filter, query]);

  return (
    <div>
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div role="group" aria-label="Filter questions" className="flex flex-wrap gap-2">
          {filters.map((f) => (
            <button
              key={f.key}
              type="button"
              aria-pressed={filter === f.key}
              onClick={() => setFilter(f.key)}
              className={cn(
                "rounded-full border px-4 py-2 text-sm font-medium transition-colors",
                filter === f.key
                  ? "border-forest bg-forest text-ivory"
                  : "border-forest/15 bg-white text-ink-600 hover:border-forest/40",
              )}
            >
              {f.label}
            </button>
          ))}
        </div>
        <label className="relative block sm:w-64">
          <span className="sr-only">Search questions</span>
          <Search aria-hidden className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-500" />
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search questions"
            className="w-full rounded-full border border-forest/15 bg-white py-2.5 pl-10 pr-4 text-sm focus:border-emerald focus:outline-none focus:ring-4 focus:ring-emerald/15"
          />
        </label>
      </div>

      <p className="mt-6 text-sm text-ink-500" aria-live="polite">
        Showing {items.length} of {faqs.length} questions
      </p>

      {items.length > 0 ? (
        <Accordion key={`${filter}-${query}`} className="mt-4" items={items.map((f) => ({ q: f.q, a: f.a }))} />
      ) : (
        <p className="mt-4 rounded-2xl border border-dashed border-forest/20 p-8 text-center text-ink-600">
          No questions match your search. Try another word, or contact our team.
        </p>
      )}
    </div>
  );
}
