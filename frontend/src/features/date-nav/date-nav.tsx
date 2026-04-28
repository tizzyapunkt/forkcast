import { formatISODate } from '../../domain/date';

interface DateNavProps {
  date: string;
  onPrev: () => void;
  onNext: () => void;
  onToday: () => void;
}

function formatDisplay(dateStr: string): string {
  const d = new Date(dateStr + 'T00:00:00');
  return d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
}

export function DateNav({ date, onPrev, onNext, onToday }: DateNavProps) {
  const isToday = date === formatISODate(new Date());

  return (
    <div className="flex items-center gap-2">
      <button
        onClick={onPrev}
        aria-label="Prev"
        className="rounded px-2 text-base leading-none text-white/90 hover:bg-white/10"
      >
        ‹
      </button>
      <span className="min-w-[120px] text-center text-sm font-medium">{formatDisplay(date)}</span>
      <button
        onClick={onNext}
        aria-label="Next"
        className="rounded px-2 text-base leading-none text-white/90 hover:bg-white/10"
      >
        ›
      </button>
      {!isToday && (
        <button
          onClick={onToday}
          aria-label="Today"
          className="rounded px-2 py-0.5 text-xs text-white/80 hover:bg-white/10"
        >
          Today
        </button>
      )}
    </div>
  );
}
