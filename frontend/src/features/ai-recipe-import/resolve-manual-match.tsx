import { Button } from '../../components/ui/button';
import { SearchPanel } from '../log-ingredient/search-panel';
import { t } from '../../i18n';
import type { IngredientSearchResult } from '../../domain/ingredient-search';

const copy = t.aiRecipeImport.resolve;

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
      <span className="text-xs font-semibold uppercase tracking-wide text-primary">{copy.manualEyebrow}</span>
      {rawName.trim().length > 0 && (
        <label className="flex items-start gap-2 rounded-md border border-input bg-accent/40 p-2.5 text-sm">
          <input
            type="checkbox"
            checked={learnSynonym}
            onChange={(e) => setLearnSynonym(e.target.checked)}
            aria-label={copy.learnSynonymToggle(rawName)}
            className="mt-0.5 h-4 w-4 rounded-sm"
          />
          <span className="min-w-0">
            {copy.learnSynonymToggle(rawName)}
            <span className="block text-[11px] text-muted-foreground">{copy.learnSynonymHint}</span>
          </span>
        </label>
      )}
      <SearchPanel onSelect={onPick} />
      <Button variant="ghost" onClick={onBack} className="self-start p-0">
        {copy.manualBack}
      </Button>
    </div>
  );
}
