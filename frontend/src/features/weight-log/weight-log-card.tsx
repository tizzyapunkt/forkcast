import { useState } from 'react';
import { Scale } from 'lucide-react';
import { useWeightLog } from '../../queries/use-weight-log';
import { useWeightTrend } from '../../queries/use-weight-trend';
import { useLogWeight } from '../../queries/use-log-weight';
import { de } from '../../i18n/de';
import { today } from '../../domain/date';
import { parseDecimal } from '../../lib/decimal';
import { Button } from '../../components/ui/button';
import { Card } from '../../components/ui/card';
import { Input } from '../../components/ui/input';

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
    const parsed = parseDecimal(draft);
    if (parsed === null || parsed <= 0) return;
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
    <Card aria-label={de.weightLog.cardTitle} padding="sm">
      <div className="flex items-center justify-between gap-2">
        <h3 className="flex items-center gap-2 text-base font-semibold">
          <Scale size={16} aria-hidden="true" className="shrink-0 text-primary" />
          {de.weightLog.cardTitle}
        </h3>
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
          <Input
            aria-label={de.weightLog.cardPromptEmpty}
            type="text"
            inputMode="decimal"
            placeholder={todaysEntry ? todaysEntry.weightKg.toString() : de.weightLog.cardInputPlaceholder}
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            className="flex-1"
          />
          <span className="text-sm text-muted-foreground">{de.weightLog.cardKgSuffix}</span>
          <Button onClick={submit} disabled={logMutation.isPending || draft.trim() === ''} className="px-3">
            {logMutation.isPending ? de.weightLog.cardSubmitting : de.weightLog.cardSubmit}
          </Button>
          {todaysEntry && editing && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setEditing(false);
                setDraft('');
              }}
              className="px-2 py-2"
            >
              {de.weightLog.historyCancel}
            </Button>
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
    </Card>
  );
}
