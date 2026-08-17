export const DEFAULT_PAGE_SIZE = 20;

/**
 * Helper to compute 0-indexed range values (from, to) for Supabase .range() query
 * and offset/limit values based on 1-indexed page.
 */
export function getPaginationRange(page: number, pageSize: number = DEFAULT_PAGE_SIZE) {
  const limit = Math.min(100, Math.max(1, pageSize));
  const activePage = Math.max(1, page);
  const offset = (activePage - 1) * limit;
  return {
    from: offset,
    to: offset + limit - 1,
    limit,
    offset,
  };
}
