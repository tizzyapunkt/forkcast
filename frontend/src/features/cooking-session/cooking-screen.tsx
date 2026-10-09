import { useEffect, useMemo, useState } from 'react';
import { Check, ChevronRight, Plus, Sun } from 'lucide-react';
import {
  addToPot,
  buildPot,
  canLeaveOut,
  changeAmount,
  defaultSelection,
  extendSnapshot,
  identityKey,
  leaveOut,
  recipeBatchesInWeek,
  restoreRow,
  selectedBatches,
  snapshotRow,
  swapInPot,
  type BatchIngredientChange,
  type IngredientIdentity,
  type PotInput,
  type PotRow,
  type RowSnapshot,
} from '../../domain/cooking-session';
import type { IngredientSearchResult } from '../../domain/ingredient-search';
import { addDays, today } from '../../domain/date';
import { ApiError } from '../../api/client';
import { AppHeader } from '../../components/app/app-header';
import { ErrorBanner } from '../../components/app/error-banner';
import { Banner } from '../../components/ui/banner';
import { Button } from '../../components/ui/button';
import { Card } from '../../components/ui/card';
import { Stepper } from '../../components/ui/stepper';
import { useWeekLog } from '../../queries/use-week-log';
import { useRecipe } from '../../queries/use-recipe';
import { useSetBatchIngredients } from '../../queries/use-set-batch-ingredients';
import { useScreenWakeLock } from '../../hooks/use-screen-wake-lock';
import { LogIngredientDrawer } from '../log-ingredient/log-ingredient-drawer';
import { formatWeekRange } from '../../i18n/format';
import { AmountStep } from './amount-step';
import { formatPotAmount, weekdayIndex } from './cooking-format';
import { LeftOutRow, PotRowView } from './pot-row';
import type { CookingSession } from './cooking-url';
import { cn } from '../../lib/cn';
import { formatDecimal } from '../../lib/decimal';
import { t } from '../../i18n';

interface CookingScreenProps {
  session: CookingSession;
  onSessionChange: (next: CookingSession) => void;
  onBack: () => void;
}

/** A row changed in this session: what it was before its first change, and how to get back there. */
interface ChangedRow {
  name: string;
  snapshot: RowSnapshot;
  before: string;
  leftOut: boolean;
}

type Picking = { mode: 'swap'; from: PotRow } | { mode: 'add' };

const eyebrow = 'text-[11px] font-semibold tracking-wider text-muted-foreground uppercase';

/** "vorher 200 ml"; after a swap the old food is named, since the row now shows another one. */
function beforeText(origin: PotRow | undefined, swapped: boolean): string {
  if (!origin) return t.cooking.beforeAbsent;
  const amount = formatPotAmount(origin.potAmount, origin.unit);
  return t.cooking.before(swapped ? `${origin.name} ${amount}` : amount);
}

/**
 * Cooking one planned recipe for the chosen meals of the week and the people eating along. Shows the whole
 * pot; every edit is written back to the chosen meals by portion. Undo state lives only as long as the view.
 */
export function CookingScreen({ session, onSessionChange, onBack }: CookingScreenProps) {
  const week = useWeekLog(session.weekStart);
  const recipeQuery = useRecipe(session.recipeId);
  const mutation = useSetBatchIngredients();
  const wakeLockHeld = useScreenWakeLock(true);

  const [portionsOpen, setPortionsOpen] = useState(false);
  const [changed, setChanged] = useState<Record<string, ChangedRow>>({});
  const [pendingKey, setPendingKey] = useState<string | null>(null);
  const [failure, setFailure] = useState<string | null>(null);
  const [announcement, setAnnouncement] = useState('');
  const [picking, setPicking] = useState<Picking | null>(null);

  const recipeMissing = recipeQuery.error instanceof ApiError && recipeQuery.error.status === 404;
  const recipe = recipeQuery.data ?? null;
  const batches = useMemo(
    () => (week.data ? recipeBatchesInWeek(week.data, session.recipeId) : []),
    [week.data, session.recipeId],
  );

  // The session's batch refs from the URL, minus any that no longer exist; the default when none are left.
  const known = new Set(batches.map((b) => b.key));
  const kept = (session.batches ?? []).filter((key) => known.has(key));
  const selected = kept.length > 0 ? kept : defaultSelection(batches, today());

  useEffect(() => {
    if (!week.data || batches.length === 0) return;
    if (session.batches === null || kept.length !== session.batches.length) {
      onSessionChange({ ...session, batches: selected });
    }
    // Only when the loaded batches change: writing the default selection back into the URL once.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [week.data, batches.length]);

  const input: PotInput = { batches, selected, extraPortions: session.extra, recipe };
  const pot = buildPot(input);
  const chosen = selectedBatches(input);
  const loading = week.isLoading || (recipeQuery.isLoading && !recipeMissing);
  const title = recipe?.name ?? t.entryList.fallbackRecipeName;
  const range = formatWeekRange(session.weekStart, addDays(session.weekStart, 6));

  function toggleBatch(key: string) {
    const next = selected.includes(key) ? selected.filter((k) => k !== key) : [...selected, key];
    if (next.length === 0) return;
    onSessionChange({ ...session, batches: batches.map((b) => b.key).filter((k) => next.includes(k)) });
  }

  /**
   * Write one change. `originKey` is the row as it was (its undo state moves along), `rowKey` the row it
   * becomes, `identities` every food the change touches — what undo has to put back.
   */
  function apply(
    changes: BatchIngredientChange[],
    opts: {
      originKey: string;
      rowKey: string;
      name: string;
      result: string; // what the row reads afterwards, for the announcement
      identities: IngredientIdentity[];
      leftOut?: boolean;
    },
  ) {
    const origin = pot.rows.find((r) => r.key === opts.originKey);
    const previous = changed[opts.originKey];
    const record: ChangedRow = {
      name: opts.name,
      snapshot: previous
        ? extendSnapshot(input, previous.snapshot, opts.identities)
        : snapshotRow(input, opts.identities),
      before: previous?.before ?? beforeText(origin, opts.originKey !== opts.rowKey),
      leftOut: opts.leftOut ?? false,
    };
    const failedAmount = origin ? formatPotAmount(origin.potAmount, origin.unit) : '—';

    setFailure(null);
    setPendingKey(opts.rowKey);
    mutation.mutate(changes, {
      onSuccess: () => {
        setChanged((prev) => {
          const next = { ...prev };
          delete next[opts.originKey];
          next[opts.rowKey] = record;
          return next;
        });
        setAnnouncement(t.cooking.saved(opts.name, opts.result));
      },
      onError: () => setFailure(t.cooking.saveFailed(opts.name, failedAmount)),
      onSettled: () => setPendingKey(null),
    });
  }

  function undo(key: string) {
    const record = changed[key];
    if (!record) return;
    setFailure(null);
    setPendingKey(key);
    mutation.mutate(restoreRow(record.snapshot), {
      onSuccess: () => {
        setChanged((prev) => {
          const next = { ...prev };
          delete next[key];
          return next;
        });
        setAnnouncement(t.cooking.undone(record.name));
      },
      onError: () => setFailure(t.cooking.saveFailed(record.name, record.before)),
      onSettled: () => setPendingKey(null),
    });
  }

  function confirmPick(food: IngredientSearchResult, potAmount: number) {
    const target = { name: food.name, unit: food.unit, macrosPerUnit: food.macrosPerUnit };
    const rowKey = identityKey(target);
    if (picking?.mode === 'swap') {
      const from = picking.from;
      apply(swapInPot(input, from, target, potAmount), {
        originKey: from.key,
        rowKey,
        name: food.name,
        result: formatPotAmount(potAmount, food.unit),
        identities: [from, target],
      });
    } else {
      apply(addToPot(input, target, potAmount), {
        originKey: rowKey,
        rowKey,
        name: food.name,
        result: formatPotAmount(potAmount, food.unit),
        identities: [target],
      });
    }
  }

  const leftOutRows = Object.entries(changed).filter(([key, c]) => c.leftOut && !pot.rows.some((r) => r.key === key));

  return (
    <>
      <AppHeader title={title} subtitle={t.cooking.subtitle(range)} onBack={onBack} backAria={t.cooking.backAria}>
        {wakeLockHeld && (
          <span
            title={t.cooking.wakeLockTitle}
            className="mt-1 inline-flex shrink-0 items-center gap-1 rounded-full bg-white/12 px-2 py-0.5 text-[11px] font-semibold whitespace-nowrap text-white/90"
          >
            <Sun size={14} aria-hidden="true" />
            <span aria-hidden="true">{t.cooking.wakeLock}</span>
            <span className="sr-only">{t.cooking.wakeLockTitle}</span>
          </span>
        )}
      </AppHeader>

      <div className="space-y-4 p-4">
        <p role="status" aria-live="polite" className="sr-only">
          {announcement}
        </p>
        {week.error && <ErrorBanner error={week.error} />}
        {loading && (
          <div aria-hidden="true" className="space-y-3">
            <div className="h-14 animate-pulse rounded-lg bg-muted" />
            <div className="h-24 animate-pulse rounded-lg bg-muted" />
            <div className="h-4 w-2/5 animate-pulse rounded-sm bg-muted" />
            <div className="h-40 animate-pulse rounded-lg bg-muted" />
          </div>
        )}
        {!loading && week.data && batches.length === 0 && <Banner tone="warning">{t.cooking.notFound}</Banner>}

        {!loading && batches.length > 0 && (
          <>
            {recipeMissing && <Banner tone="warning">{t.cooking.recipeMissing}</Banner>}

            <Card padding="none" aria-label={t.cooking.potPortions(pot.potPortions)}>
              <button
                type="button"
                onClick={() => setPortionsOpen((open) => !open)}
                aria-expanded={portionsOpen}
                className="flex min-h-14 w-full items-center gap-3 py-2 pr-3 pl-4 text-left"
              >
                <span className="min-w-0 flex-1">
                  <span className="block text-lg leading-7 font-semibold tabular-nums">
                    {t.cooking.potPortions(pot.potPortions)}
                  </span>
                  <span className="block text-xs text-muted-foreground">
                    <span className="font-medium text-foreground">
                      {chosen.map((b) => t.planner.weekdays[weekdayIndex(b.date)]).join(', ')}
                    </span>
                    {' · '}
                    <span>{t.cooking.split(pot.loggedPortions, pot.extraPortions)}</span>
                  </span>
                </span>
                <span className="inline-flex items-center gap-1 text-sm font-medium text-primary">
                  {t.cooking.adjust}
                  <ChevronRight
                    size={16}
                    aria-hidden="true"
                    className={cn('transition-transform', portionsOpen && 'rotate-90')}
                  />
                </span>
              </button>
              {portionsOpen && (
                <div className="space-y-4 border-t px-4 pt-3 pb-4">
                  <div className="space-y-2">
                    <h2 className={eyebrow}>{t.cooking.batchesHeading}</h2>
                    <div className="flex flex-wrap gap-2">
                      {batches.map((b) => {
                        const on = selected.includes(b.key);
                        const last = on && selected.length === 1;
                        return (
                          <button
                            key={b.key}
                            type="button"
                            aria-pressed={on}
                            aria-disabled={last || undefined}
                            title={last ? t.cooking.lastBatchHint : undefined}
                            onClick={() => toggleBatch(b.key)}
                            className={cn(
                              'inline-flex min-h-11 items-center gap-2 rounded-md border px-3 text-sm',
                              on
                                ? 'border-primary bg-accent/10 font-semibold'
                                : 'border-input bg-background text-muted-foreground',
                            )}
                          >
                            {on && <Check size={16} aria-hidden="true" className="text-primary" />}
                            <span>
                              {t.cooking.batchLabel(t.planner.weekdays[weekdayIndex(b.date)]!, t.slotLabels[b.slot])}
                            </span>
                            <span className="font-normal text-muted-foreground tabular-nums">
                              {t.cooking.batchPortions(b.portions)}
                            </span>
                            {!on && b.date < today() && (
                              <span className="text-[11px] text-[#8a8a8a]">{t.cooking.past}</span>
                            )}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <div className="text-sm font-medium">{t.cooking.extraLabel}</div>
                      <div className="text-xs text-muted-foreground">{t.cooking.extraHint}</div>
                    </div>
                    <Stepper
                      size="touch"
                      value={session.extra}
                      onChange={(extra) => onSessionChange({ ...session, batches: selected, extra })}
                      label={t.cooking.extraLabel}
                      decrementLabel={t.cooking.extraDecrement}
                      incrementLabel={t.cooking.extraIncrement}
                    />
                  </div>
                </div>
              )}
            </Card>

            <section
              aria-label={t.cooking.perPortion}
              className="rounded-lg border border-border/60 bg-gradient-to-b from-accent/10 to-card px-4 py-3 tabular-nums"
            >
              <span className="text-[11px] font-semibold tracking-wider text-primary uppercase">
                {t.cooking.perPortion}
              </span>
              <p className="mt-1">
                <span className="text-3xl font-extrabold tracking-tight">
                  {Math.round(pot.macrosPerPortion.calories)}
                </span>{' '}
                <span className="text-sm text-muted-foreground">{t.recipeTotals.kcalUnit}</span>
              </p>
              <p className="mt-1.5 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm">
                {(
                  [
                    ['bg-macro-p', t.dayTotals.protein, pot.macrosPerPortion.protein],
                    ['bg-macro-c', t.dayTotals.carbs, pot.macrosPerPortion.carbs],
                    ['bg-macro-f', t.dayTotals.fat, pot.macrosPerPortion.fat],
                  ] as const
                ).map(([color, label, grams]) => (
                  <span key={label} className="inline-flex items-center gap-1.5">
                    <span aria-hidden="true" className={cn('h-2 w-2 rounded-full', color)} />
                    <span className="text-muted-foreground">{label}</span>
                    <span className="font-semibold">{Math.round(grams)} g</span>
                  </span>
                ))}
              </p>
              <p className="mt-1.5 text-xs text-muted-foreground">{t.cooking.perPortionHint}</p>
            </section>

            {failure && (
              <Banner tone="error" onDismiss={() => setFailure(null)} dismissLabel={t.groceryList.close}>
                {failure}
              </Banner>
            )}

            <section aria-label={t.cooking.potHeading} className="space-y-2">
              <div className="flex items-baseline justify-between">
                <h2 className={eyebrow}>{t.cooking.potHeading}</h2>
                <span className="text-xs text-muted-foreground tabular-nums">
                  {t.cooking.potPortions(pot.potPortions)}
                </span>
              </div>
              <ul className="rounded-lg border bg-card">
                {pot.rows.map((row, index) => (
                  <PotRowView
                    key={row.key}
                    row={row}
                    divided={index > 0}
                    potPortions={pot.potPortions}
                    selectedBatches={pot.selectedBatches}
                    before={changed[row.key]?.before}
                    pending={pendingKey === row.key}
                    canLeaveOut={canLeaveOut(input, row)}
                    onAmount={(amount) =>
                      apply(changeAmount(input, row, amount), {
                        originKey: row.key,
                        rowKey: row.key,
                        name: row.name,
                        result: formatPotAmount(amount, row.unit),
                        identities: [row],
                      })
                    }
                    onSwap={() => setPicking({ mode: 'swap', from: row })}
                    onLeaveOut={() =>
                      apply(leaveOut(input, row), {
                        originKey: row.key,
                        rowKey: row.key,
                        name: row.name,
                        result: t.cooking.leftOut,
                        identities: [row],
                        leftOut: true,
                      })
                    }
                    onUndo={() => undo(row.key)}
                  />
                ))}
                {leftOutRows.map(([key, c]) => (
                  <LeftOutRow key={key} name={c.name} pending={pendingKey === key} onUndo={() => undo(key)} />
                ))}
              </ul>
              <Button variant="accent" onClick={() => setPicking({ mode: 'add' })} className="min-h-11 w-full">
                <Plus size={16} aria-hidden="true" />
                {t.cooking.addIngredient}
              </Button>
            </section>

            {pot.untracked.length > 0 && (
              <section aria-label={t.cooking.untrackedHeading} className="space-y-2">
                <h2 className={eyebrow}>{t.cooking.untrackedHeading}</h2>
                <ul className="rounded-lg border px-4 py-1">
                  {pot.untracked.map((u) => (
                    <li
                      key={u.name}
                      className="flex items-baseline justify-between gap-3 py-2 text-sm text-muted-foreground"
                    >
                      <span>{u.name}</span>
                      <span className="text-right tabular-nums">
                        {u.amount === null
                          ? (u.label ?? t.cooking.toTaste)
                          : u.label && u.labelAmount !== undefined
                            ? `${formatDecimal(Math.round(u.labelAmount * 2) / 2)} ${u.label}`
                            : formatPotAmount(u.amount, u.unit)}
                      </span>
                    </li>
                  ))}
                </ul>
              </section>
            )}

            {pot.steps.length > 0 && recipe && (
              <section aria-label={t.cooking.stepsHeading} className="space-y-2">
                <h2 className={eyebrow}>{t.cooking.stepsHeading}</h2>
                <ol className="space-y-3">
                  {pot.steps.map((step, index) => (
                    <li key={index} className="flex gap-3">
                      <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-muted text-xs font-semibold">
                        {index + 1}
                      </span>
                      <span className="text-base">{step}</span>
                    </li>
                  ))}
                </ol>
                <p className="text-xs text-muted-foreground">{t.cooking.stepsNote(recipe.yield)}</p>
              </section>
            )}
          </>
        )}
      </div>

      {chosen[0] && (
        <LogIngredientDrawer
          open={picking !== null}
          slot={chosen[0].slot}
          date={chosen[0].date}
          onClose={() => setPicking(null)}
          target={{
            kind: 'pick',
            title: picking?.mode === 'swap' ? t.cooking.swapTitle(picking.from.name) : t.cooking.addTitle,
            renderAmountStep: (food, done) => (
              <AmountStep
                food={food}
                from={picking?.mode === 'swap' ? picking.from : undefined}
                pot={pot}
                batches={chosen}
                onConfirm={(amount) => {
                  confirmPick(food, amount);
                  done();
                }}
              />
            ),
          }}
        />
      )}
    </>
  );
}
