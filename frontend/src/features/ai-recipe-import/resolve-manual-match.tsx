import { Button } from '../../components/ui/button';
import { SearchPanel } from '../log-ingredient/search-panel';
import { de } from '../../i18n/de';
import type { IngredientSearchResult } from '../../domain/ingredient-search';

const t = de.aiRecipeImport.resolve;

export function ManualMatch({
  onPick,
  onBack,
  rawName,
  learnSynonym,
  setLearnSynonym,
}: {
  onPick: (r: IngredientSearchResult) => void;
  onBack: () => void;
  /** The unmatched line being resolved — offered as an alias of whatever gets picked. */
  rawName: string;
  learnSynonym: boolean;
  setLearnSynonym: (v: boolean) => void;
}) {
  return (
    <div className="flex min-h-0 flex-col gap-2">
      <span className="text-xs font-semibold uppercase tracking-wide text-primary">{t.manualEyebrow}</span>
      {rawName.trim().length > 0 && (
        <label className="flex items-start gap-2 rounded-md border border-input bg-accent/40 p-2.5 text-sm">
          <input
            type="checkbox"
            checked={learnSynonym}
            onChange={(e) => setLearnSynonym(e.target.checked)}
            aria-label={t.learnSynonymToggle(rawName)}
            className="mt-0.5 h-4 w-4 rounded-sm"
          />
          <span className="min-w-0">
            {t.learnSynonymToggle(rawName)}
            <span className="block text-[11px] text-muted-foreground">{t.learnSynonymHint}</span>
          </span>
        </label>
      )}
      <SearchPanel onSelect={onPick} />
      <Button variant="ghost" onClick={onBack} className="self-start p-0">
        {t.manualBack}
      </Button>
    </div>
  );
}
