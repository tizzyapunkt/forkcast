import { formatISODate } from '../../domain/date';
import { de } from '../../i18n/de';

interface DateNavProps {
  date: string;
  onPrev: () => void;
  onNext: () => void;
  onToday: () => void;
}

function formatDisplay(dateStr: string): string {
  const d = new Date(dateStr + 'T00:00:00');
  return d.toLocaleDateString('de-DE', { weekday: 'short', day: 'numeric', month: 'short' });
}

export function DateNav({ date, onPrev, onNext, onToday }: DateNavProps) {
  const isToday = date === formatISODate(new Date());

  return (
    <div className="flex items-center gap-2">
      <button
        onClick={onPrev}
        aria-label={de.dateNav.prev}
        className="rounded px-2 text-base leading-none text-white/90 hover:bg-white/10"
      >
        ‹
      </button>
      <span className="min-w-[120px] text-center text-sm font-medium">{formatDisplay(date)}</span>
      <button
        onClick={onNext}
        aria-label={de.dateNav.next}
        className="rounded px-2 text-base leading-none text-white/90 hover:bg-white/10"
      >
        ›
      </button>
      {!isToday && (
        <button
          onClick={onToday}
          aria-label={de.dateNav.today}
          className="rounded px-2 py-0.5 text-xs text-white/80 hover:bg-white/10"
        >
          {de.dateNav.today}
        </button>
      )}
    </div>
  );
}
