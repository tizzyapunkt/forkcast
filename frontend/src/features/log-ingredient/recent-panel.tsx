import { useMemo, useState } from 'react';
import Fuse from 'fuse.js';
import { useRecentlyUsedIngredients } from '../../queries/use-recently-used-ingredients';
import type { IngredientSearchResult } from '../../domain/ingredient-search';
import type { RecentlyUsedIngredient } from '../../domain/meal-log';
import { de } from '../../i18n/de';

interface RecentPanelProps {
  onSelect: (result: IngredientSearchResult) => void;
}

function toSearchResult(recent: RecentlyUsedIngredient): IngredientSearchResult {
  return {
    id: `recent:${recent.name.toLowerCase()}|${recent.unit}`,
    source: 'RECENT',
    name: recent.name,
    unit: recent.unit,
    macrosPerUnit: recent.macrosPerUnit,
  };
}

export function RecentPanel({ onSelect }: RecentPanelProps) {
  const { data: recents, isLoading } = useRecentlyUsedIngredients({ enabled: true });
  const [query, setQuery] = useState('');

  const fuse = useMemo(
    () =>
      new Fuse(recents ?? [], {
        keys: ['name'],
        threshold: 0.4,
        ignoreLocation: true,
      }),
    [recents],
  );

  const trimmed = query.trim();
  const filtered: RecentlyUsedIngredient[] = trimmed ? fuse.search(trimmed).map((r) => r.item) : (recents ?? []);

  return (
    <div className="flex w-full min-w-0 flex-col gap-3 p-4">
      <input
        role="searchbox"
        type="search"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder={de.recentPanel.placeholder}
        className="w-full min-w-0 appearance-none rounded-md border px-3 py-2 text-sm"
      />

      {isLoading && <p className="text-sm text-muted-foreground">{de.recentPanel.loading}</p>}

      {!isLoading && (recents?.length ?? 0) === 0 && (
        <p className="text-sm text-muted-foreground">{de.recentPanel.empty}</p>
      )}

      {!isLoading && (recents?.length ?? 0) > 0 && filtered.length === 0 && (
        <p className="text-sm text-muted-foreground">{de.recentPanel.noMatches(trimmed)}</p>
      )}

      {filtered.length > 0 && (
        <ul className="w-full min-w-0 divide-y">
          {filtered.map((recent) => (
            <li key={`${recent.name.toLowerCase()}|${recent.unit}`} className="min-w-0">
              <button
                onClick={() => onSelect(toSearchResult(recent))}
                className="flex w-full min-w-0 items-center justify-between gap-2 py-2.5 text-left text-sm hover:bg-muted/50"
              >
                <span className="min-w-0 flex-1 truncate font-medium">{recent.name}</span>
                <span className="shrink-0 text-xs text-muted-foreground">
                  {de.recentPanel.kcalPer(recent.macrosPerUnit.calories, recent.unit)}
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
