export type MacroKey = 'p' | 'c' | 'f';

// Macro identity colors (brightened `-on` variants for the dark indigo header) — the dot and
// bar say WHICH macro; the value's color is the caller's concern (status-tinted in the diary,
// neutral in the planner).
const MACRO_ON_CLASS: Record<MacroKey, string> = {
  p: 'bg-macro-p-on',
  c: 'bg-macro-c-on',
  f: 'bg-macro-f-on',
};

interface HeaderMacroCellProps {
  macroKey: MacroKey;
  label: string;
  valueText: string;
  valueClass?: string;
  /** 0–100 fill of the identity-colored bar; omit to render no bar (no goal known). */
  pct?: number;
}

/** One macro column inside the indigo header: identity dot + label, value, identity-colored bar. */
export function HeaderMacroCell({ macroKey, label, valueText, valueClass, pct }: HeaderMacroCellProps) {
  return (
    <div className="flex min-w-0 flex-1 flex-col gap-1 text-xs">
      <span className="flex items-center gap-1.5 text-white/70">
        <span aria-hidden="true" className={`h-1.5 w-1.5 shrink-0 rounded-full ${MACRO_ON_CLASS[macroKey]}`} />
        {label}
      </span>
      <span className={`font-medium tabular-nums ${valueClass ?? 'text-white/90'}`}>{valueText}</span>
      {pct !== undefined && (
        <span className="block h-1 overflow-hidden rounded-full bg-white/20">
          <span
            data-testid={`macro-bar-${macroKey}`}
            className={`block h-1 rounded-full ${MACRO_ON_CLASS[macroKey]}`}
            style={{ width: `${Math.min(100, Math.max(0, pct))}%` }}
          />
        </span>
      )}
    </div>
  );
}
