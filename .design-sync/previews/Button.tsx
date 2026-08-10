import { Button } from '@forkcast/frontend';

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
      <Button size="icon" aria-label="Eintrag entfernen">
        ×
      </Button>
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
