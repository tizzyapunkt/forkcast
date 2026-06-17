# Design — View Source Photos in the AI Import Review Screen

## Context

`ImportRecipeScreen` (`frontend/src/features/ai-recipe-import/import-recipe-screen.tsx`) is the import flow's container. It holds `photos: StagedPhoto[]` in state and, once the import mutation succeeds, swaps the staging UI for `ReviewImportScreen`, passing only the `draft`. `StagedPhoto` (`photo-staging.tsx`) carries the original `File`, its `mediaType`, a `previewUrl` object URL, and `sizeBytes`.

The constraint that drives this design: `PhotoStaging` registers a `useEffect` cleanup that calls `URL.revokeObjectURL(p.previewUrl)` for every photo when it unmounts. The staging→review swap unmounts `PhotoStaging`, so the `previewUrl`s become invalid exactly when we'd want to reuse them. The `File` objects themselves remain valid, so the review-side viewer must derive **fresh** object URLs from `StagedPhoto.file` and own their lifecycle.

## Goals / Non-Goals

**Goals**
- Let the user see the original photos while reviewing/editing the extracted draft, including a readable fullscreen view.
- Keep photos ephemeral and the change frontend-only.
- No leaked object URLs.

**Non-Goals**
- Persisting photos with the recipe or viewing them after save.
- Any backend, API, or domain-model change.
- Editing/reordering photos from the review screen (that belongs to staging).

## Decisions

### D1 — Forward staged photos into the review screen
`ImportRecipeScreen` passes its `photos` state to `ReviewImportScreen` via a new `photos: StagedPhoto[]` prop. The container already keeps `photos` until the user cancels or the flow ends, so no new ownership is introduced — only the prop wiring. `StagedPhoto` is promoted to a shared shape both screens import (it already lives in `photo-staging.tsx`; keep it there and import the type).

### D2 — Viewer owns its own object URLs (from `File`, not `previewUrl`)
A new `SourcePhotos` component takes `photos: StagedPhoto[]` and builds object URLs in a `useMemo` keyed on the photo `id`s, then revokes them in a `useEffect` cleanup on unmount. It deliberately does **not** consume `StagedPhoto.previewUrl`, which `PhotoStaging` may have revoked. This isolates the lifecycle entirely within `SourcePhotos`. The `photos` array is stable for the review session, so URLs are created once.

### D3 — Placement: a thumbnail strip composed into the form's `headerSlot`
`ReviewImportScreen` already feeds `RecipeForm` a `headerSlot` (currently the unmatched-ingredients panel, or `null`). Compose the photo strip above the unmatched panel into a single fragment passed as `headerSlot`, so the photos sit at the top of the form's scroll area and stay consistent with the existing layout. A horizontally scrollable row of square thumbnails is mobile-first and unobtrusive; it carries a short heading (e.g. „Fotos").

### D4 — Fullscreen viewer is a self-managed overlay, paged through all photos
Tapping a thumbnail opens a fullscreen viewer at that index. The viewer is a fixed inset overlay (not a native `alert`/`confirm`, which freeze the in-browser test harness) with: the current image fit to screen, prev/next controls when there is more than one photo, the position indicator (e.g. „2 / 4"), and an explicit close control plus backdrop-tap to close. State is local to `SourcePhotos` (`openIndex: number | null`). If an existing accessible overlay primitive is already used in the feature (the resolve flow uses a vaul sheet), prefer reusing that pattern for focus handling; otherwise a focused fixed overlay with an aria-labelled close button and `Escape`-to-close is sufficient. Order matches the staged order (the same order sent to the model).

### D5 — Empty/guard behavior
`SourcePhotos` renders nothing when `photos` is empty. `ReviewImportScreen` is only reached through the import flow, which requires at least one photo, so the strip is effectively always present there; the guard keeps the component safe and keeps `RecipeForm`'s manual-create/edit usages (which pass no photos and don't render `SourcePhotos`) unaffected.

### D6 — i18n
Add German strings under `de.aiRecipeImport`: a strip heading, a per-thumbnail "open" aria-label (with index), a viewer close aria-label, prev/next aria-labels, and the „n / m" position format. Mirror the existing aria-label-with-index helpers already in that namespace.

## Risks / Trade-offs

- **Object-URL leak** if cleanup is wired wrong — mitigated by colocating creation and revocation in `SourcePhotos` and a test asserting `revokeObjectURL` is called on unmount.
- **Memory** of holding originals plus a second set of object URLs is bounded by the existing 8-image / 5 MB-per-image staging limits; negligible.
- **Reusing `previewUrl` would be simpler** but is unsafe (D2) — rejected.

## Migration / Rollout

Pure addition; no data or API migration. The feature is inert outside the import review flow.
