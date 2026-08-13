## forkcast-ui conventions

**No provider wrapper.** None of the eight primitives (`Button`, `Card`, `Field`, `Input`, `DecimalInput`, `Select`, `SegmentedControl`, `Banner`) needs a top-level wrapper — import directly and render:

```tsx
import { Field, DecimalInput, Select, Button, Banner } from '@forkcast/frontend';

<Field label="Gewicht (kg)" htmlFor="weight" hint="7-Tage-Mittel: 78.1 kg">
  <DecimalInput id="weight" value={78.4} onValueChange={() => {}} className="w-full" />
</Field>
<Banner tone="error" hint="Prüfe die Verbindung und versuche es erneut.">
  Der Server war nicht erreichbar.
</Banner>
<Button variant="primary">Speichern</Button>
```

`Field` is the composition root for labelled controls: it generates the control's `id`/`aria-describedby` wiring via context, so wrap `Input`/`DecimalInput`/`Select`/`SegmentedControl` inside it rather than pairing a bare `<label>` with the control by hand.

**Use the primitive, not a class string.** Two mistakes cost the most here: hand-rolling an icon button out of `inline-flex h-9 w-9 …`, and hand-rolling a status message out of a tinted `<div>`. Both are `Button` variants / `Banner` props:

- **Icon buttons** — `<Button variant="quiet|quietDestructive|onDark|scrim|accent" size="icon|iconSm">` with an inline SVG child and an `aria-label`. `icon` is 40px, `iconSm` 36px (the tap-target floor). `quiet` = neutral row action, `quietDestructive` = remove, `onDark` = chrome on the indigo header, `scrim` = a control over a photo, `accent` = the repeating "add here" affordance.
- **Status messages** — `<Banner tone="error|warning|success" hint={…} action={…} onDismiss={…} density="md|sm">`. It picks `role="alert"` for errors and `role="status"` otherwise.

**Styling idiom: Tailwind utility classes over HSL CSS-variable tokens — never invent a hex value.** Every color, radius, and spacing value traces back to a `hsl(var(--token))` or literal in `tokens.css`; author using the Tailwind class names that already resolve against those tokens, not raw colors:

| Purpose | Classes |
|---|---|
| Primary action | `bg-primary text-primary-foreground hover:bg-primary/90` |
| Secondary/outline action | `border border-input bg-background hover:bg-muted` |
| Destructive (committing) | `bg-destructive text-destructive-foreground hover:bg-destructive/90` |
| Destructive (opening, quieter) | `border border-destructive text-destructive hover:bg-destructive/10` |
| Inline/link action | `text-primary hover:text-primary/80` |
| Accent plate (add affordance) | `bg-accent/10 text-primary hover:bg-accent/20` |
| Scrim over a photo | `bg-black/60 text-white backdrop-blur-sm hover:bg-black/75` |
| Error surface | `border-destructive/50 bg-destructive/10 text-destructive` |
| Warning surface | `border-warning/50 bg-warning/10 text-foreground` |
| Success surface | `border-success/50 bg-success/10 text-success-ink` |
| Focus ring | `focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-focus` |
| Surface | `bg-card border rounded-lg` (or `rounded-md` for controls) |
| Muted/secondary text | `text-muted-foreground` |
| Body vs. label text | `text-sm` body, `text-xs` label/hint, `font-medium` label |

Only classes actually consumed by a shipped component or an authored preview compile into `styles.css` — this table lists ones confirmed present. A class you need that isn't here (e.g. a new color) won't render; add real usage of it to a component or preview source to get it compiled, don't assume Tailwind's full utility set is available. Two live examples of that gap: `text-warning-ink` (warning *body copy* uses `text-foreground`, which is what `Banner` does) and the macro-nutrient identity colors (`--macro-p`/`-c`/`-f`, plus brightened `-on` variants) — those ship as CSS custom properties in `tokens.css` with no compiled utility class, so use `style={{ color: 'var(--macro-p)' }}`.

**Where the truth lives**: `styles.css` (imports `tokens.css` then `_ds_bundle.css`) is the full compiled stylesheet — read it before styling anything outside the table above. Each component's `.prompt.md` documents its exact prop contract and variant axis.

**Radii**: `rounded-md` (controls, buttons, banners) and `rounded-lg` (cards). `rounded`, `rounded-sm`, `rounded-xl` and `rounded-full` are not compiled in this bundle — the app reserves them for surfaces that don't ship here (overlays, chips, dots).
