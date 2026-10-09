import { useEffect, useRef, useState } from 'react';
import { ArrowLeftRight, Check, CircleMinus, EllipsisVertical, LoaderCircle, Undo2 } from 'lucide-react';
import type { PotRow } from '../../domain/cooking-session';
import { Button } from '../../components/ui/button';
import { DecimalInput } from '../../components/ui/decimal-input';
import { formatMeasure, formatPotAmount } from './cooking-format';
import { cn } from '../../lib/cn';
import { t } from '../../i18n';

interface PotRowViewProps {
  row: PotRow;
  potPortions: number;
  selectedBatches: number;
  /** "vorher 200 ml" once the row was changed in this session; `undefined` while unchanged. */
  before?: string;
  pending: boolean;
  canLeaveOut: boolean;
  onAmount: (potAmount: number) => void;
  onSwap: () => void;
  onLeaveOut: () => void;
  onUndo: () => void;
  divided: boolean;
}

/** One ingredient of the pot: the amount for the whole pot, edited in place, plus swap / leave out / undo. */
export function PotRowView({
  row,
  potPortions,
  selectedBatches,
  before,
  pending,
  canLeaveOut,
  onAmount,
  onSwap,
  onLeaveOut,
  onUndo,
  divided,
}: PotRowViewProps) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState<number | null>(row.potAmount);
  const [menuOpen, setMenuOpen] = useState(false);
  const menuButton = useRef<HTMLButtonElement>(null);
  const menu = useRef<HTMLDivElement>(null);
  const amountText = formatPotAmount(row.potAmount, row.unit);
  const measure = formatMeasure(row);

  function startEditing() {
    setDraft(Math.round(row.potAmount * 10) / 10);
    setEditing(true);
  }

  function commit() {
    setEditing(false);
    if (draft === null || !(draft > 0)) return;
    if (Math.abs(draft - row.potAmount) < 0.05) return;
    onAmount(draft);
  }

  useEffect(() => {
    if (!menuOpen) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        setMenuOpen(false);
        menuButton.current?.focus();
      }
    }
    function onPointerDown(e: PointerEvent) {
      const target = e.target as Node;
      if (!menu.current?.contains(target) && !menuButton.current?.contains(target)) setMenuOpen(false);
    }
    document.addEventListener('keydown', onKey);
    document.addEventListener('pointerdown', onPointerDown);
    return () => {
      document.removeEventListener('keydown', onKey);
      document.removeEventListener('pointerdown', onPointerDown);
    };
  }, [menuOpen]);

  const perPortionText = formatPotAmount((draft ?? 0) / Math.max(potPortions, 1), row.unit);

  return (
    <li className={cn('relative flex items-start gap-2 py-2.5 pr-1 pl-4', divided && 'border-t')}>
      <div className="min-w-0 flex-1 pt-1.5">
        <div className="flex flex-wrap items-center gap-1.5">
          {before !== undefined && <span aria-hidden="true" className="h-1.5 w-1.5 shrink-0 rounded-full bg-accent" />}
          <span className="text-base leading-6 font-medium">{row.name}</span>
          {row.added && (
            <span className="rounded-sm bg-accent/10 px-1.5 text-[11px] leading-4 font-semibold text-primary">
              {t.cooking.added}
            </span>
          )}
        </div>
        {editing ? (
          <p className="text-xs text-muted-foreground tabular-nums">
            {t.cooking.amountCaption(potPortions, perPortionText)}
          </p>
        ) : (
          <>
            {row.note && <p className="text-xs text-muted-foreground">{row.note}</p>}
            {row.inBatches < selectedBatches && (
              <p className="text-xs text-muted-foreground">{t.cooking.partial(row.inBatches, selectedBatches)}</p>
            )}
          </>
        )}
        {before !== undefined && !editing && (
          <div className="flex items-center gap-2">
            <span className="text-xs text-[#8a8a8a] tabular-nums">{before}</span>
            <Button
              variant="quiet"
              size="sm"
              onClick={onUndo}
              disabled={pending}
              aria-label={t.cooking.undoAria(row.name)}
              className="-ml-2 min-h-8 px-2"
            >
              <Undo2 size={14} aria-hidden="true" />
              {t.cooking.undo}
            </Button>
          </div>
        )}
      </div>

      {editing ? (
        <div className="flex items-center gap-1">
          <div className="flex items-center gap-1">
            <DecimalInput
              value={draft}
              onValueChange={setDraft}
              autoFocus
              aria-label={t.cooking.amountLabel(row.name)}
              onBlur={commit}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  commit();
                }
                if (e.key === 'Escape') setEditing(false);
              }}
              className="w-24 text-right text-lg font-semibold sm:text-lg"
            />
            <span className="text-sm text-muted-foreground">{t.groceryList.units[row.unit]}</span>
          </div>
          <Button
            variant="quiet"
            size="touch"
            // Mouse down would blur the input first; commit happens there.
            onMouseDown={(e) => e.preventDefault()}
            onClick={commit}
            aria-label={t.cooking.commit}
            className="text-primary"
          >
            <Check size={18} aria-hidden="true" />
          </Button>
        </div>
      ) : (
        <>
          <Button
            variant="outline"
            onClick={startEditing}
            disabled={pending}
            aria-label={t.cooking.editAria(row.name, amountText)}
            className="min-h-11 min-w-22 flex-col items-end gap-0 px-2.5 py-0.5 tabular-nums disabled:opacity-100"
          >
            <span className="flex items-center gap-1.5 text-lg leading-6 font-semibold">
              {pending && <LoaderCircle size={14} aria-hidden="true" className="animate-spin text-muted-foreground" />}
              {amountText}
            </span>
            {measure && <span className="text-xs leading-4 font-normal text-muted-foreground">{measure}</span>}
          </Button>
          <Button
            ref={menuButton}
            variant="quiet"
            size="touch"
            onClick={() => setMenuOpen((open) => !open)}
            aria-label={t.cooking.moreAria(row.name)}
            aria-haspopup="menu"
            aria-expanded={menuOpen}
            className={cn(menuOpen && 'bg-muted text-foreground')}
          >
            <EllipsisVertical size={18} aria-hidden="true" />
          </Button>
        </>
      )}

      {menuOpen && (
        <div
          ref={menu}
          role="menu"
          aria-label={t.cooking.moreAria(row.name)}
          className="absolute top-14 right-1 z-10 w-56 rounded-lg border bg-card p-1 shadow-xs"
        >
          <button
            type="button"
            role="menuitem"
            autoFocus
            onClick={() => {
              setMenuOpen(false);
              onSwap();
            }}
            className="flex min-h-11 w-full items-center gap-2.5 rounded-md px-3 text-left text-sm hover:bg-muted"
          >
            <ArrowLeftRight size={16} aria-hidden="true" />
            {t.cooking.swap}
          </button>
          <button
            type="button"
            role="menuitem"
            disabled={!canLeaveOut}
            onClick={() => {
              setMenuOpen(false);
              onLeaveOut();
            }}
            className="flex min-h-11 w-full items-center gap-2.5 rounded-md px-3 text-left text-sm text-destructive hover:bg-destructive/10 disabled:pointer-events-none disabled:opacity-50"
          >
            <CircleMinus size={16} aria-hidden="true" />
            {t.cooking.leaveOut}
          </button>
          {!canLeaveOut && <p className="px-3 pb-2 text-xs text-muted-foreground">{t.cooking.leaveOutBlocked}</p>}
        </div>
      )}
    </li>
  );
}

/** A row left out in this session: struck through, with its own undo. */
export function LeftOutRow({ name, onUndo, pending }: { name: string; onUndo: () => void; pending: boolean }) {
  return (
    <li className="flex items-center gap-2 border-t py-2 pr-1 pl-4">
      <span className="flex-1 text-muted-foreground line-through">{name}</span>
      <span className="text-xs text-muted-foreground">{t.cooking.leftOut}</span>
      <Button variant="quiet" size="sm" onClick={onUndo} disabled={pending} aria-label={t.cooking.undoAria(name)}>
        <Undo2 size={14} aria-hidden="true" />
        {t.cooking.undo}
      </Button>
    </li>
  );
}
