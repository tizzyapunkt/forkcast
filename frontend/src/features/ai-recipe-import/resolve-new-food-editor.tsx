import { useState } from 'react';
import { X } from 'lucide-react';
import { Button } from '../../components/ui/button';
import { DecimalInput } from '../../components/ui/decimal-input';
import { Input } from '../../components/ui/input';
import { de } from '../../i18n/de';
import type { MacrosPerUnit } from '../../domain/meal-log';
import type { FoodEntryDraft } from '../../domain/food-resolution';

const t = de.aiRecipeImport.resolve;

function NumberField({
  label,
  value,
  estimate,
  onChange,
}: {
  label: string;
  value: number;
  estimate: boolean;
  onChange: (v: number) => void;
}) {
  return (
    <label className="flex flex-col gap-1">
      <span className="flex items-center gap-1 text-[11px] font-medium text-muted-foreground">
        {label}
        {estimate && <span className="h-1.5 w-1.5 rounded-full bg-warning" aria-hidden="true" />}
      </span>
      <DecimalInput
        value={Number.isFinite(value) ? value : 0}
        onValueChange={(v) => onChange(v ?? 0)}
        className="h-10 w-full rounded-md border px-2 text-right text-sm"
      />
    </label>
  );
}

function SynonymList({ synonyms, setSynonyms }: { synonyms: string[]; setSynonyms: (next: string[]) => void }) {
  const [entered, setEntered] = useState('');

  function add() {
    const value = entered.trim();
    if (value.length === 0) return;
    setSynonyms([...synonyms, value]);
    setEntered('');
  }

  return (
    <div className="flex flex-col gap-1.5">
      <span className="text-sm font-medium">{t.synonymsLabel}</span>
      {synonyms.length > 0 && (
        <ul className="flex flex-wrap gap-1.5">
          {synonyms.map((s) => (
            <li className="flex items-center gap-1 rounded-full bg-muted py-1 pr-1 pl-2.5 text-xs" key={s}>
              <span className="max-w-[14rem] truncate" title={s}>
                {s}
              </span>
              <button
                type="button"
                onClick={() => setSynonyms(synonyms.filter((x) => x !== s))}
                aria-label={t.synonymRemoveAria(s)}
                className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
              >
                <X aria-hidden="true" className="h-3.5 w-3.5" />
              </button>
            </li>
          ))}
        </ul>
      )}
      <div className="flex gap-2">
        <Input
          value={entered}
          onChange={(e) => setEntered(e.target.value)}
          onKeyDown={(e) => {
            if (e.key !== 'Enter') return;
            e.preventDefault();
            add();
          }}
          placeholder={t.synonymAddPlaceholder}
          aria-label={t.synonymAddPlaceholder}
          className="h-10 flex-1 py-0 text-sm"
        />
        <Button variant="outline" onClick={add} className="h-10 px-3 py-0 text-sm">
          {t.synonymAdd}
        </Button>
      </div>
    </div>
  );
}

export function NewFoodEditor({
  draft,
  setDraft,
  synonyms,
  setSynonyms,
  aiAssisted,
  onManual,
  onBack,
}: {
  draft: FoodEntryDraft;
  setDraft: (d: FoodEntryDraft) => void;
  /** Held by the pane: renaming the entry folds the proposed name in here. */
  synonyms: string[];
  setSynonyms: (next: string[]) => void;
  aiAssisted: boolean;
  onManual: () => void;
  /** Present only when the editor was reached by overriding a proposal — returns to it. */
  onBack?: () => void;
}) {
  const setMacro = (k: keyof MacrosPerUnit, v: number) =>
    setDraft({ ...draft, macrosPer100: { ...draft.macrosPer100, [k]: v } });

  return (
    <div className="flex flex-col gap-3">
      <span className="text-xs font-semibold uppercase tracking-wide text-primary">
        {aiAssisted ? t.newEntryEyebrow : t.newEntryEyebrowManual}
      </span>
      <label className="flex flex-col gap-1">
        <span className="text-sm font-medium">{t.nameLabel}</span>
        <Input
          value={draft.name}
          onChange={(e) => setDraft({ ...draft, name: e.target.value })}
          aria-label={t.nameLabel}
          className="h-11 w-full py-0 font-medium"
        />
      </label>

      <SynonymList synonyms={synonyms} setSynonyms={setSynonyms} />

      <div className="flex items-end justify-between gap-3">
        <div>
          <span className="mb-1 block text-sm font-medium">{t.unitLabel}</span>
          <div className="flex gap-1 rounded-md bg-muted p-1">
            {(['g', 'ml'] as const).map((u) => (
              <button
                key={u}
                type="button"
                onClick={() => setDraft({ ...draft, unit: u })}
                aria-pressed={draft.unit === u}
                className={`rounded-md px-4 py-1.5 text-sm font-medium ${
                  draft.unit === u ? 'bg-background text-primary' : 'text-muted-foreground'
                }`}
              >
                {u}
              </button>
            ))}
          </div>
        </div>
        <label className="flex items-center gap-2 pb-1 text-sm">
          <input
            type="checkbox"
            checked={draft.untracked === true}
            onChange={(e) => setDraft({ ...draft, untracked: e.target.checked || undefined })}
            aria-label={t.untrackedToggle}
            className="h-4 w-4 rounded-sm"
          />
          {t.untrackedToggle}
        </label>
      </div>

      {draft.untracked !== true && (
        <div>
          <span className="mb-1.5 block text-sm font-medium">
            {t.macrosLabel}{' '}
            <span className="text-xs font-normal text-muted-foreground">· {t.macrosPer(draft.unit)}</span>
          </span>
          <div className="grid grid-cols-4 gap-2">
            <NumberField
              label={t.kcalLabel}
              value={draft.macrosPer100.calories}
              estimate={aiAssisted}
              onChange={(v) => setMacro('calories', v)}
            />
            <NumberField
              label={t.proteinLabel}
              value={draft.macrosPer100.protein}
              estimate={aiAssisted}
              onChange={(v) => setMacro('protein', v)}
            />
            <NumberField
              label={t.carbsLabel}
              value={draft.macrosPer100.carbs}
              estimate={aiAssisted}
              onChange={(v) => setMacro('carbs', v)}
            />
            <NumberField
              label={t.fatLabel}
              value={draft.macrosPer100.fat}
              estimate={aiAssisted}
              onChange={(v) => setMacro('fat', v)}
            />
          </div>
          {aiAssisted && <p className="mt-2 text-[11px] text-muted-foreground">{t.aiEstimateHint}</p>}
        </div>
      )}

      <div className="flex flex-col items-start gap-1">
        <Button variant="ghost" onClick={onManual} className="p-0">
          {t.manualLink}
        </Button>
        {onBack && (
          <Button variant="ghost" onClick={onBack} className="p-0">
            {t.manualBack}
          </Button>
        )}
      </div>
    </div>
  );
}
