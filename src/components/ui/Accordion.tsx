"use client";

import { useId, useState } from "react";
import { Plus } from "lucide-react";
import { cn } from "@/lib/format";

export type AccordionItem = { q: string; a: React.ReactNode };

/** Accessible accordion (WAI-ARIA disclosure pattern). */
export function Accordion({ items, className }: { items: AccordionItem[]; className?: string }) {
  const [open, setOpen] = useState<number | null>(0);
  const baseId = useId();

  return (
    <div className={cn("divide-y divide-forest/10 rounded-2xl border border-forest/10 bg-white", className)}>
      {items.map((item, i) => {
        const isOpen = open === i;
        const btnId = `${baseId}-btn-${i}`;
        const panelId = `${baseId}-panel-${i}`;
        return (
          <div key={item.q}>
            <h3>
              <button
                id={btnId}
                type="button"
                aria-expanded={isOpen}
                aria-controls={panelId}
                onClick={() => setOpen(isOpen ? null : i)}
                className="flex w-full items-center justify-between gap-6 px-6 py-5 text-left text-base font-semibold text-forest transition-colors hover:bg-ivory/60 sm:px-7"
              >
                {item.q}
                <span
                  aria-hidden
                  className={cn(
                    "inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-forest/15 transition-transform duration-200",
                    isOpen && "rotate-45 border-emerald bg-emerald text-ivory",
                  )}
                >
                  <Plus className="h-4 w-4" />
                </span>
              </button>
            </h3>
            <div
              id={panelId}
              role="region"
              aria-labelledby={btnId}
              hidden={!isOpen}
              className="px-6 pb-6 text-[0.95rem] leading-relaxed text-ink-600 sm:px-7"
            >
              {item.a}
            </div>
          </div>
        );
      })}
    </div>
  );
}
