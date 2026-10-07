import { formatISODate } from '../../domain/date';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { Button } from '../../components/ui/button';
import { t } from '../../i18n';
import { formatDayLabel } from '../../i18n/format';

interface DateNavProps {
  date: string;
  onPrev: () => void;
  onNext: () => void;
  onToday: () => void;
}

export function DateNav({ date, onPrev, onNext, onToday }: DateNavProps) {
  const isToday = date === formatISODate(new Date());

  return (
    <div className="flex items-center gap-2">
      <Button variant="onDark" size="iconSm" onClick={onPrev} aria-label={t.dateNav.prev}>
        <ChevronLeft aria-hidden="true" className="h-5 w-5" />
      </Button>
      <span className="min-w-[120px] text-center text-sm font-medium">{formatDayLabel(date)}</span>
      <Button variant="onDark" size="iconSm" onClick={onNext} aria-label={t.dateNav.next}>
        <ChevronRight aria-hidden="true" className="h-5 w-5" />
      </Button>
      {!isToday && (
        <button
          onClick={onToday}
          aria-label={t.dateNav.today}
          className="rounded-md px-2 py-0.5 text-xs text-white/80 hover:bg-white/10"
        >
          {t.dateNav.today}
        </button>
      )}
    </div>
  );
}
