/**
 * Dual Pagination Utility (Offset-based & Cursor-based)
 * Supporting deterministic ordering, cursor validation, and strict mode separation.
 */

export const DEFAULT_PAGE_SIZE = 20;
export const MAX_PAGE_SIZE = 100;

/**
 * Parse and validate pagination query parameters.
 * Rejects requests that attempt to supply both `page` and `cursor`.
 */
export function parsePaginationParams(query) {
  const hasPage = query.page !== undefined && query.page !== null && String(query.page).trim() !== '';
  const hasCursorKey = query.cursor !== undefined && query.cursor !== null;
  const isExplicitCursorMode = query.mode === 'cursor' || hasCursorKey;

  // Reject mutual presence of page and cursor
  if (hasPage && hasCursorKey) {
    const error = new Error("Cannot provide both 'page' (offset) and 'cursor' pagination parameters simultaneously.");
    error.statusCode = 400;
    throw error;
  }

  let limit = DEFAULT_PAGE_SIZE;
  if (query.limit !== undefined && query.limit !== null && String(query.limit).trim() !== '') {
    const parsedLimit = parseInt(query.limit, 10);
    if (isNaN(parsedLimit) || parsedLimit < 1) {
      const error = new Error("Pagination 'limit' must be a positive integer.");
      error.statusCode = 400;
      throw error;
    }
    limit = Math.min(parsedLimit, MAX_PAGE_SIZE);
  }

  // Cursor Mode
  if (isExplicitCursorMode) {
    let cursor = null;
    if (hasCursorKey) {
      const raw = String(query.cursor).trim();
      // Values representing page 1 (initial cursor)
      if (raw !== '' && raw !== 'null' && raw !== 'undefined' && raw !== 'true' && raw !== 'start' && raw !== 'first') {
        cursor = raw;
      }
    }

    return {
      mode: 'cursor',
      cursor,
      limit
    };
  }

  // Offset Mode (Default)
  let page = 1;
  if (hasPage) {
    const parsedPage = parseInt(query.page, 10);
    if (isNaN(parsedPage) || parsedPage < 1) {
      const error = new Error("Pagination 'page' must be a positive integer greater than or equal to 1.");
      error.statusCode = 400;
      throw error;
    }
    page = parsedPage;
  }

  return {
    mode: 'offset',
    page,
    limit
  };
}

/**
 * Execute a paginated database query using Prisma delegate.
 *
 * @param {object} modelDelegate - Prisma model client (e.g. prisma.product)
 * @param {object} options
 * @param {object} options.where - Filter conditions
 * @param {object} [options.select] - Prisma select projection
 * @param {object} [options.include] - Prisma include
 * @param {object} options.paginationParams - Parsed pagination params from parsePaginationParams()
 * @param {string} [options.sortBy] - Sort field for offset mode
 * @param {'asc'|'desc'} [options.sortOrder] - Sort direction
 */
export async function paginate({
  modelDelegate,
  where = {},
  select,
  include,
  paginationParams,
  sortBy = 'createdAt',
  sortOrder = 'desc'
}) {
  const { mode, limit } = paginationParams;

  if (mode === 'cursor') {
    const { cursor } = paginationParams;

    // Validate cursor if provided
    if (cursor) {
      const cursorRecord = await modelDelegate.findUnique({
        where: { id: cursor },
        select: { id: true }
      });
      if (!cursorRecord) {
        const error = new Error(`Invalid pagination cursor '${cursor}': Record does not exist or has been deleted.`);
        error.statusCode = 400;
        throw error;
      }
    }

    // Deterministic ordering: primary sort field, fallback to ID
    const orderBy = sortBy === 'createdAt'
      ? [{ createdAt: sortOrder }, { id: sortOrder }]
      : [{ [sortBy]: sortOrder }, { createdAt: 'desc' }, { id: 'desc' }];

    const queryArgs = {
      where,
      orderBy,
      take: limit + 1 // Fetch limit + 1 to detect hasNextPage
    };

    if (select) queryArgs.select = select;
    else if (include) queryArgs.include = include;

    if (cursor) {
      queryArgs.cursor = { id: cursor };
      queryArgs.skip = 1;
    }

    const records = await modelDelegate.findMany(queryArgs);

    const hasNextPage = records.length > limit;
    const items = hasNextPage ? records.slice(0, limit) : records;
    const nextCursor = hasNextPage && items.length > 0 ? items[items.length - 1].id : null;

    return {
      items,
      pagination: {
        mode: 'cursor',
        limit,
        nextCursor: nextCursor || null,
        hasNextPage
      }
    };
  }

  // Offset-based pagination
  const { page } = paginationParams;
  const skip = (page - 1) * limit;

  const orderBy = [{ [sortBy]: sortOrder }, { id: 'desc' }];

  const queryArgs = {
    where,
    skip,
    take: limit,
    orderBy
  };

  if (select) queryArgs.select = select;
  else if (include) queryArgs.include = include;

  const [items, total] = await Promise.all([
    modelDelegate.findMany(queryArgs),
    modelDelegate.count({ where })
  ]);

  const totalPages = Math.ceil(total / limit) || 1;

  return {
    items,
    pagination: {
      mode: 'offset',
      page,
      limit,
      total,
      totalPages,
      hasNextPage: page < totalPages,
      hasPrevPage: page > 1
    }
  };
}
