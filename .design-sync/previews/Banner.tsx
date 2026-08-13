import { Banner, Button } from '@forkcast/frontend';

export function Tones() {
  return (
    <div className="flex w-80 flex-col gap-2">
      <Banner tone="error">Der Server war nicht erreichbar.</Banner>
      <Banner tone="warning">2 Zutaten ohne Treffer</Banner>
      <Banner tone="success">Gespeichert.</Banner>
    </div>
  );
}

export function WithHintAndRecovery() {
  return (
    <div className="w-80">
      <Banner
        tone="error"
        hint="Achte auf scharfen, vollständig sichtbaren Text und versuche es erneut."
        action={
          <Button variant="outline" size="sm">
            Erneut versuchen
          </Button>
        }
      >
        Aus diesen Fotos ließ sich kein Rezept lesen.
      </Banner>
    </div>
  );
}

export function Dismissible() {
  return (
    <div className="w-80">
      <Banner tone="error" density="sm" onDismiss={() => {}} dismissLabel="Hinweise ausblenden">
        <ul className="space-y-1">
          <li>Foto 3 überschreitet 5 MB.</li>
          <li>Dateityp image/gif wird nicht unterstützt (JPEG, PNG, WebP).</li>
        </ul>
      </Banner>
    </div>
  );
}

export function WarningWithHint() {
  return (
    <div className="w-80">
      <Banner tone="warning" hint="Dein gespeichertes Ziel liegt 180 kcal darunter.">
        Berechnetes Ziel weicht ab
      </Banner>
    </div>
  );
}
