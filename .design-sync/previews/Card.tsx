import { Card } from '@forkcast/frontend';

export function Default() {
  return (
    <Card aria-label="Gewichtstracker" className="w-64">
      <h3 className="text-base font-semibold">Gewichtstracker</h3>
      <p className="mt-1 text-sm text-muted-foreground">7-Tage-Trend: 78.4 kg</p>
    </Card>
  );
}

export function CompactPadding() {
  return (
    <Card padding="sm" aria-label="Tageslog" className="w-64">
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium">Mittagessen</span>
        <span className="text-xs text-muted-foreground">612 kcal</span>
      </div>
    </Card>
  );
}

export function NoPadding() {
  return (
    <Card padding="none" className="w-64 divide-y" aria-label="Rezeptliste">
      <div className="p-3 text-sm">Haferflocken mit Beeren</div>
      <div className="p-3 text-sm">Hähnchenbrust mit Reis</div>
      <div className="p-3 text-sm">Griechischer Joghurt</div>
    </Card>
  );
}
