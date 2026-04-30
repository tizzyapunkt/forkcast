import { BookOpen, ListChecks, Settings } from 'lucide-react';
import { de } from '../../i18n/de';

export type AppView = 'log' | 'recipes' | 'settings';

interface Props {
  active: AppView;
  onChange: (view: AppView) => void;
}

interface Tab {
  view: AppView;
  label: string;
  Icon: typeof BookOpen;
}

const TABS: Tab[] = [
  { view: 'log', label: de.nav.log, Icon: ListChecks },
  { view: 'recipes', label: de.nav.recipes, Icon: BookOpen },
  { view: 'settings', label: de.nav.settings, Icon: Settings },
];

export function BottomNav({ active, onChange }: Props) {
  return (
    <nav
      role="navigation"
      aria-label={de.nav.primary}
      className="fixed inset-x-0 bottom-0 z-30 grid grid-cols-3 border-t bg-background"
    >
      {TABS.map(({ view, label, Icon }) => {
        const isActive = view === active;
        return (
          <button
            key={view}
            type="button"
            onClick={() => onChange(view)}
            aria-current={isActive ? 'page' : undefined}
            aria-label={label}
            className={`flex flex-col items-center gap-0.5 py-2 text-xs ${
              isActive ? 'font-medium text-foreground' : 'text-muted-foreground'
            }`}
          >
            <Icon size={20} aria-hidden="true" />
            {label}
          </button>
        );
      })}
    </nav>
  );
}
