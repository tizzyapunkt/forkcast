# View Source Photos in the AI Import Review Screen

## Why

When a recipe is imported from photos, the AI's reading is fallible — it can transpose a quantity, miss a line that wraps across a page, or pick the wrong food noun. Today the only place the user sees the photos is the staging screen *before* extraction. The moment the draft arrives and the user lands on **Rezept prüfen** (the review/edit screen), the photos are gone: `ImportRecipeScreen` holds the staged photos in state but never passes them to `ReviewImportScreen`, and `PhotoStaging` revokes its preview object URLs on unmount. So the user is left double-checking the AI's output against memory, not the source. That undermines the whole point of a review step.

## What Changes

- **Surface the source photos on the review screen**: after extraction, the original uploaded photos appear as a thumbnail strip at the top of the review screen, so the user can glance between what the AI understood and what the photo actually says while editing each row.
- **Tap-to-zoom**: tapping a thumbnail opens a fullscreen viewer (paged through all photos, preserving the staged order) for reading fine print; the viewer closes back to the review screen without leaving the import flow.
- **Photos stay ephemeral**: no persistence, no backend call, no recipe domain-model change. The photos remain the same in-memory `StagedPhoto` objects already held during the session; they are simply forwarded into the review screen.
- **Correct object-URL ownership**: the staged photos are passed from `ImportRecipeScreen` into `ReviewImportScreen`, and the new viewer derives and owns its own object URLs from each `StagedPhoto.file` (because `PhotoStaging` revokes its own `previewUrl`s when it unmounts on the staging→review transition).

Explicitly ruled out: persisting photos on the `Recipe`, attaching photos to a saved recipe, re-viewing photos after the recipe is saved, and any backend/API change. This is a review-time comparison aid only.

## Capabilities

### Modified Capabilities

- `ai-recipe-import`: the review-import screen gains a source-photo strip with a fullscreen viewer, fed by the staged photos forwarded from the import screen. No change to extraction, matching, or persistence.

## Impact

- **Frontend**: `ImportRecipeScreen` forwards its `photos` state to `ReviewImportScreen`; `ReviewImportScreen` renders a new source-photo component above the existing review content (composed into the form's `headerSlot` alongside the unmatched panel); a new viewer component owns object URLs derived from `StagedPhoto.file`; new German i18n strings under `de.aiRecipeImport`.
- **Backend / API / domain**: none.
- **Data**: none — photos remain in-memory and transient.
