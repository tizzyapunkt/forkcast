import { formatISODate } from '../../domain/date';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { Button } from '../../components/ui/button';
import { de } from '../../i18n/de';

interface DateNavProps {
  date: string;
  onPrev: () => void;
  onNext: () => void;
  onToday: () => void;
}

function formatDisplay(dateStr: string): string {
  const d = new Date(dateStr + 'T00:00:00');
  // "Do., 11. Juni" → "Do. 11. Juni" (the design drops the comma after the weekday)
  return d.toLocaleDateString('de-DE', { weekday: 'short', day: 'numeric', month: 'short' }).replace(',', '');
}

export function DateNav({ date, onPrev, onNext, onToday }: DateNavProps) {
  const isToday = date === formatISODate(new Date());

  return (
    <div className="flex items-center gap-2">
      <Button variant="onDark" size="iconSm" onClick={onPrev} aria-label={de.dateNav.prev}>
        <ChevronLeft aria-hidden="true" className="h-5 w-5" />
      </Button>
      <span className="min-w-[120px] text-center text-sm font-medium">{formatDisplay(date)}</span>
      <Button variant="onDark" size="iconSm" onClick={onNext} aria-label={de.dateNav.next}>
        <ChevronRight aria-hidden="true" className="h-5 w-5" />
      </Button>
      {!isToday && (
        <button
          onClick={onToday}
          aria-label={de.dateNav.today}
          className="rounded-md px-2 py-0.5 text-xs text-white/80 hover:bg-white/10"
        >
          {de.dateNav.today}
        </button>
      )}
    </div>
  );
}
