/**
 * Where a cooking session lives between reloads: recipe, week, chosen batches and people eating along,
 * kept in the page's query string. Nothing about the session is stored on the server.
 */
export interface CookingSession {
  recipeId: string;
  weekStart: string;
  /** Batch keys (`date~recipeBatchId`); `null` until the view has applied its default selection. */
  batches: string[] | null;
  extra: number;
}

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

export function parseCookingSearch(search: string): CookingSession | null {
  const params = new URLSearchParams(search);
  const recipeId = params.get('cook');
  const weekStart = params.get('week');
  if (!recipeId || !weekStart || !ISO_DATE.test(weekStart)) return null;

  const rawBatches = params.get('b');
  const batches = rawBatches
    ? rawBatches.split(',').filter((key) => {
        const [date, id] = key.split('~');
        return !!id && !!date && ISO_DATE.test(date);
      })
    : [];
  const extra = Number(params.get('extra') ?? '0');

  return {
    recipeId,
    weekStart,
    batches: batches.length > 0 ? batches : null,
    extra: Number.isInteger(extra) && extra >= 0 ? extra : 0,
  };
}

export function cookingSearch(session: CookingSession): string {
  const params = new URLSearchParams({ cook: session.recipeId, week: session.weekStart });
  if (session.batches && session.batches.length > 0) params.set('b', session.batches.join(','));
  if (session.extra > 0) params.set('extra', String(session.extra));
  return `?${params.toString()}`;
}
