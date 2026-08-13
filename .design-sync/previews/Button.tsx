import { Button } from '@forkcast/frontend';

/** Inline 16px lucide paths — previews ship self-contained, no icon dependency. */
function Icon({ paths }: { paths: string[] }) {
  return (
    <svg
      viewBox="0 0 24 24"
      width="16"
      height="16"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {paths.map((d) => (
        <path key={d} d={d} />
      ))}
    </svg>
  );
}

const X = ['M18 6 6 18', 'm6 6 12 12'];
const ARROW_UP = ['m5 12 7-7 7 7', 'M12 19V5'];
const PLUS = ['M5 12h14', 'M12 5v14'];
const CHEVRON_LEFT = ['m15 18-6-6 6-6'];

export function Variants() {
  return (
    <div className="flex flex-wrap items-center gap-3">
      <Button variant="primary">Speichern</Button>
      <Button variant="outline">Abbrechen</Button>
      <Button variant="destructive">Endgültig löschen</Button>
      <Button variant="destructiveOutline">Löschen</Button>
      <Button variant="ghost">Manuell eingeben</Button>
    </div>
  );
}

export function Sizes() {
  return (
    <div className="flex flex-wrap items-center gap-3">
      <Button size="md">Profil speichern</Button>
      <Button size="sm">Übernehmen</Button>
      <Button variant="quietDestructive" size="icon" aria-label="Eintrag entfernen">
        <Icon paths={X} />
      </Button>
      <Button variant="quiet" size="iconSm" aria-label="Schritt nach oben">
        <Icon paths={ARROW_UP} />
      </Button>
    </div>
  );
}

export function IconActions() {
  return (
    <div className="flex flex-wrap items-center gap-3">
      <Button variant="quiet" size="iconSm" aria-label="Schritt nach oben">
        <Icon paths={ARROW_UP} />
      </Button>
      <Button variant="quietDestructive" size="iconSm" aria-label="Zutat entfernen">
        <Icon paths={X} />
      </Button>
      <Button variant="accent" size="icon" aria-label="Zum Mittagessen hinzufügen">
        <Icon paths={PLUS} />
      </Button>
    </div>
  );
}

export function OnDarkAndScrim() {
  return (
    <div className="flex flex-wrap items-center gap-3">
      <div
        className="flex items-center gap-2 rounded-md px-3 py-2"
        style={{ backgroundImage: 'var(--header-grad)' }}
      >
        <Button variant="onDark" size="iconSm" aria-label="Vorheriger Tag">
          <Icon paths={CHEVRON_LEFT} />
        </Button>
        <span className="text-sm font-medium text-white">Do. 13. August</span>
      </div>
      {/* Stand-in for a staged recipe photo — the scrim only reads correctly over imagery. */}
      <div
        className="flex items-end justify-end gap-1 rounded-md p-2"
        style={{
          width: '104px',
          height: '104px',
          backgroundImage: 'linear-gradient(135deg, #8a9a6b 0%, #4a5a3a 45%, #2b2f22 100%)',
        }}
      >
        <Button variant="scrim" size="icon" aria-label="Foto nach oben">
          <Icon paths={ARROW_UP} />
        </Button>
        <Button variant="scrim" size="icon" aria-label="Foto entfernen">
          <Icon paths={X} />
        </Button>
      </div>
    </div>
  );
}

export function States() {
  return (
    <div className="flex flex-wrap items-center gap-3">
      <Button variant="primary" disabled>
        Speichern
      </Button>
      <Button variant="outline" disabled>
        Abbrechen
      </Button>
      <Button variant="quiet" size="iconSm" disabled aria-label="Schritt nach oben">
        <Icon paths={ARROW_UP} />
      </Button>
    </div>
  );
}

export function FormActions() {
  return (
    <div className="flex gap-2">
      <Button variant="outline" className="h-12 flex-1 py-0">
        Abbrechen
      </Button>
      <Button variant="primary" className="h-12 flex-[1.5] py-0 font-semibold">
        Bestätigen
      </Button>
    </div>
  );
}
