import { useState } from 'react';
import type {
  IngredientMatchDebug,
  RawIngredientDebug,
  RecipeDraftDebug,
  SearchCandidateDebug,
} from '../../domain/recipes';

interface Props {
  debug: RecipeDraftDebug;
}

export function DebugBox({ debug }: Props) {
  const [open, setOpen] = useState(false);

  return (
    <div
      data-testid="import-debug-box"
      className="mx-4 mb-4 rounded-md border border-dashed border-muted-foreground/40 bg-muted/30 text-xs"
    >
      <button
        type="button"
        data-testid="import-debug-toggle"
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center justify-between px-3 py-2 font-mono text-muted-foreground hover:text-foreground"
      >
        <span>Debug · ingredient matching ({debug.ingredients.length})</span>
        <span aria-hidden>{open ? '▾' : '▸'}</span>
      </button>
      {open && (
        <ul className="space-y-3 border-t border-muted-foreground/20 p-3 font-mono">
          {debug.ingredients.map((entry, i) => (
            <li key={i} data-testid={`import-debug-entry-${i}`} className="space-y-1">
              <DebugEntry entry={entry} />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function DebugEntry({ entry }: { entry: IngredientMatchDebug }) {
  const flags = activeFlags(entry.flags);
  return (
    <>
      <div>
        <span className="text-muted-foreground">raw:</span> <span>{formatRaw(entry.raw)}</span>
      </div>
      <div>
        <span className="text-muted-foreground">chosen:</span>{' '}
        <span>{entry.chosen ? formatCandidate(entry.chosen) : 'unmatched'}</span>
        {flags.length > 0 && <span className="ml-2 text-amber-600 dark:text-amber-400">[{flags.join(', ')}]</span>}
      </div>
      <div>
        <span className="text-muted-foreground">candidates:</span>
        {entry.candidates.length === 0 ? (
          <span> none</span>
        ) : (
          <ol className="ml-4 list-decimal">
            {entry.candidates.map((c, i) => (
              <li key={i}>{formatCandidate(c)}</li>
            ))}
          </ol>
        )}
      </div>
    </>
  );
}

function formatRaw(raw: RawIngredientDebug): string {
  const parts: string[] = [raw.name];
  if (raw.amount !== undefined || raw.unit !== undefined) {
    parts.push(`(${raw.amount ?? '—'} ${raw.unit ?? ''})`.trim());
  }
  if (raw.pieceQuantity) {
    const p = raw.pieceQuantity;
    parts.push(`[piece: ${p.amount} ${p.unitLabel} @ ${p.gramsPerPiece}g]`);
  }
  if (raw.rawDisplayUnitLabel) {
    parts.push(`[display: ${raw.rawDisplayAmount ?? 1} ${raw.rawDisplayUnitLabel}]`);
  }
  return parts.join(' ');
}

function formatCandidate(c: SearchCandidateDebug): string {
  const tag = c.untracked ? ', untracked' : '';
  return `${c.name} (${c.source}, ${c.unit}${tag})`;
}

function activeFlags(flags: IngredientMatchDebug['flags']): string[] {
  const out: string[] = [];
  if (flags.unitOverridden) out.push('unitOverridden');
  if (flags.pieceQuantityDropped) out.push('pieceQuantityDropped');
  if (flags.untrackedInherited) out.push('untrackedInherited');
  return out;
}
