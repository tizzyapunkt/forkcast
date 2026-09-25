import { useState } from 'react';
import { Minus, Plus } from 'lucide-react';
import { BottomSheet } from '../../components/app/bottom-sheet';
import { ErrorBanner } from '../../components/app/error-banner';
import { Button } from '../../components/ui/button';
import { useSetCookedPortions } from '../../queries/use-set-cooked-portions';
import { de } from '../../i18n/de';

interface CookedPortionsSheetProps {
  open: boolean;
  recipeBatchId: string;
  date: string;
  recipeName: string;
  loggedPortions: number;
  cookedPortions: number;
  onClose: () => void;
}

/** Stepper for how many portions of a logged recipe are cooked — never below what was logged as eaten. */
export function CookedPortionsSheet({
  open,
  recipeBatchId,
  date,
  recipeName,
  loggedPortions,
  cookedPortions,
  onClose,
}: CookedPortionsSheetProps) {
  const [value, setValue] = useState(cookedPortions);
  const mutation = useSetCookedPortions();

  function save() {
    mutation.mutate({ recipeBatchId, date, cookedPortions: value }, { onSuccess: onClose });
  }

  return (
    <BottomSheet
      open={open}
      onClose={onClose}
      ariaLabel={de.entryList.cookedTitle(recipeName)}
      heightClassName="max-h-[60dvh]"
    >
      <div className="space-y-4 px-4 pt-3 pb-6">
        <div className="space-y-1">
          <h2 className="text-sm font-semibold">{de.entryList.cookedTitle(recipeName)}</h2>
          <p className="text-xs text-muted-foreground">{de.entryList.cookedHint(loggedPortions)}</p>
        </div>

        {mutation.error && <ErrorBanner error={mutation.error} />}

        <div className="flex items-center justify-center gap-6">
          <Button
            variant="outline"
            size="icon"
            onClick={() => setValue((v) => Math.max(loggedPortions, v - 1))}
            disabled={value - 1 < loggedPortions}
            aria-label={de.entryList.cookedDecrease}
          >
            <Minus size={18} aria-hidden="true" />
          </Button>
          <output
            aria-label={de.entryList.cookedValueAria}
            className="min-w-12 text-center text-3xl font-extrabold tabular-nums"
          >
            {value}
          </output>
          <Button
            variant="outline"
            size="icon"
            onClick={() => setValue((v) => v + 1)}
            aria-label={de.entryList.cookedIncrease}
          >
            <Plus size={18} aria-hidden="true" />
          </Button>
        </div>

        <div className="flex gap-2">
          <Button variant="outline" onClick={onClose} className="flex-1">
            {de.entryList.cookedCancel}
          </Button>
          <Button onClick={save} disabled={mutation.isPending} className="flex-1">
            {de.entryList.cookedSave}
          </Button>
        </div>
      </div>
    </BottomSheet>
  );
}
