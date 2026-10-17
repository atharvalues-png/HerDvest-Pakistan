import "server-only";

export type SearchParams = Record<string, string | string[] | undefined>;

export const param = (sp: SearchParams, key: string) => {
  const v = sp[key];
  return (Array.isArray(v) ? v[0] : v)?.trim() ?? "";
};

/**
 * Parses list-page query parameters into safe SQL fragments. Sort keys are
 * whitelisted, so user input never reaches ORDER BY directly.
 */
export function listParams(
  sp: SearchParams,
  sorts: Record<string, string>,
  defaultSort: string,
  defaultDir: "asc" | "desc" = "desc",
  pageSize = 25,
) {
  const q = param(sp, "q").slice(0, 100);
  const sortKey = sorts[param(sp, "sort")] ? param(sp, "sort") : defaultSort;
  const dir = param(sp, "dir") === "asc" ? "asc" : param(sp, "dir") === "desc" ? "desc" : defaultDir;
  const page = Math.max(1, Math.min(10_000, Number.parseInt(param(sp, "page") || "1", 10) || 1));
  return {
    q,
    like: `%${q}%`,
    sortKey,
    dir,
    page,
    pageSize,
    offset: (page - 1) * pageSize,
    orderBy: `${sorts[sortKey]} ${dir} nulls last`,
  };
}

export type ListMeta = ReturnType<typeof listParams> & { total: number };
