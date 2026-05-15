import { useState } from 'react';
import { useWeightLog } from '../../queries/use-weight-log';
import { useWeightTrend } from '../../queries/use-weight-trend';
import { useLogWeight } from '../../queries/use-log-weight';
import { de } from '../../i18n/de';
import { today } from '../../domain/date';

interface WeightLogCardProps {
  onOpenTracker: () => void;
}

export function WeightLogCard({ onOpenTracker }: WeightLogCardProps) {
  const dateStr = today();
  const { data: entries } = useWeightLog();
  const { data: trend } = useWeightTrend();
  const logMutation = useLogWeight();
  const [draft, setDraft] = useState('');
  const [editing, setEditing] = useState(false);

  const todaysEntry = entries?.find((e) => e.date === dateStr) ?? null;
  const inEditMode = editing || todaysEntry === null;

  function submit() {
    const parsed = Number(draft.replace(',', '.'));
    if (!Number.isFinite(parsed) || parsed <= 0) return;
    logMutation.mutate(
      { date: dateStr, weightKg: parsed },
      {
        onSuccess: () => {
          setDraft('');
          setEditing(false);
        },
      },
    );
  }

  return (
    <section aria-label={de.weightLog.cardTitle} className="rounded-md border border-input bg-card p-3">
      <div className="flex items-center justify-between gap-2">
        <h3 className="text-sm font-semibold">{de.weightLog.cardTitle}</h3>
        <button
          type="button"
          onClick={onOpenTracker}
          className="text-xs text-primary underline-offset-2 hover:underline"
        >
          {de.weightLog.cardOpenTracker}
        </button>
      </div>

      {inEditMode ? (
        <div className="mt-2 flex items-center gap-2">
          <input
            aria-label={de.weightLog.cardPromptEmpty}
            type="number"
            inputMode="decimal"
            pattern="[0-9]*[.,]?[0-9]*"
            step="0.1"
            placeholder={todaysEntry ? todaysEntry.weightKg.toString() : de.weightLog.cardInputPlaceholder}
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            className="flex-1 rounded-md border border-input px-3 py-2 text-base sm:text-sm"
          />
          <span className="text-sm text-muted-foreground">{de.weightLog.cardKgSuffix}</span>
          <button
            type="button"
            onClick={submit}
            disabled={logMutation.isPending || draft.trim() === ''}
            className="rounded-md bg-primary px-3 py-2 text-sm font-medium text-primary-foreground disabled:opacity-50"
          >
            {logMutation.isPending ? de.weightLog.cardSubmitting : de.weightLog.cardSubmit}
          </button>
          {todaysEntry && editing && (
            <button
              type="button"
              onClick={() => {
                setEditing(false);
                setDraft('');
              }}
              className="rounded-md border px-2 py-2 text-xs"
            >
              {de.weightLog.historyCancel}
            </button>
          )}
        </div>
      ) : (
        <div className="mt-2 flex items-center justify-between gap-2">
          <div>
            <p className="text-lg font-semibold tabular-nums">
              {todaysEntry!.weightKg.toFixed(1)} {de.weightLog.cardKgSuffix}
            </p>
            <p className="text-xs text-muted-foreground">
              {trend?.movingAverage7d !== null && trend?.movingAverage7d !== undefined
                ? de.weightLog.averageHint(trend.movingAverage7d.toFixed(1))
                : de.weightLog.statsHintInsufficient}
              {trend?.weeklyRatePercent !== null && trend?.weeklyRatePercent !== undefined && (
                <>
                  {' · '}
                  {de.weightLog.deltaPerWeekShort(
                    `${trend.weeklyRatePercent > 0 ? '+' : ''}${trend.weeklyRatePercent.toFixed(2)}`,
                  )}
                </>
              )}
            </p>
          </div>
          <button
            type="button"
            aria-label={de.weightLog.cardEditAria}
            onClick={() => {
              setDraft(todaysEntry!.weightKg.toString());
              setEditing(true);
            }}
            className="rounded-md border px-3 py-2 text-xs"
          >
            {de.weightLog.cardEdit}
          </button>
        </div>
      )}
    </section>
  );
}
