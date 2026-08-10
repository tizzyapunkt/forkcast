## forkcast-ui conventions

**No provider wrapper.** None of the six primitives (`Button`, `Card`, `Field`, `Input`, `DecimalInput`, `SegmentedControl`) read from React context — import directly and render, no top-level wrapper needed:

```tsx
import { Field, DecimalInput, Button } from '@forkcast/frontend';

<Field label="Gewicht (kg)" htmlFor="weight" hint="7-Tage-Mittel: 78.1 kg">
  <DecimalInput id="weight" value={78.4} onValueChange={() => {}} className="w-full" />
</Field>
<Button variant="primary">Speichern</Button>
```

`Field` is the composition root for labelled controls: it generates the control's `id`/`aria-describedby` wiring via context, so wrap `Input`/`DecimalInput`/`SegmentedControl` inside it rather than pairing a bare `<label>` with the control by hand.

**Styling idiom: Tailwind utility classes over HSL CSS-variable tokens — never invent a hex value.** Every color, radius, and spacing value traces back to a `hsl(var(--token))` or literal in `tokens.css`; author using the Tailwind class names that already resolve against those tokens, not raw colors:

| Purpose | Classes |
|---|---|
| Primary action | `bg-primary text-primary-foreground hover:bg-primary/90` |
| Secondary/outline action | `border border-input bg-background hover:bg-muted` |
| Destructive (committing) | `bg-destructive text-destructive-foreground hover:bg-destructive/90` |
| Destructive (opening, quieter) | `border border-destructive text-destructive hover:bg-destructive/10` |
| Inline/link action | `text-primary hover:text-primary/80` |
| Surface | `bg-card border rounded-lg` (or `rounded-md` for controls) |
| Muted/secondary text | `text-muted-foreground` |
| Body vs. label text | `text-sm` body, `text-xs` label/hint, `font-medium` label |

Only classes actually consumed by a shipped component or an authored preview compile into `styles.css` — this table lists ones confirmed present. A class you need that isn't here (e.g. a new color) won't render; add real usage of it to a component or preview source to get it compiled, don't assume Tailwind's full utility set is available.

Macro-nutrient identity colors (`--macro-p`/`-c`/`-f`, plus brightened `-on` variants for the dark header) ship as CSS custom properties in `tokens.css` but have no compiled utility class yet — use `style={{ color: 'var(--macro-p)' }}` until a component uses them as a class.

**Where the truth lives**: `styles.css` (imports `tokens.css` then `_ds_bundle.css`) is the full compiled stylesheet — read it before styling anything outside the table above. Each component's `.prompt.md` documents its exact prop contract and variant axis.

**Radii**: `rounded-md` (controls, buttons) and `rounded-lg` (cards) — not `rounded` or `rounded-xl`, which aren't part of this system's vocabulary.
