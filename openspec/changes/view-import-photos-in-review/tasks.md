## 1. Source-photo viewer component (frontend)

- [x] 1.1 TDD `features/ai-recipe-import/source-photos.tsx` (`SourcePhotos`): given `photos: StagedPhoto[]`, renders a thumbnail per photo in staged order from object URLs derived from `StagedPhoto.file` (not `previewUrl`); renders nothing for an empty list
- [x] 1.2 TDD object-URL lifecycle: URLs are created from `file` and `URL.revokeObjectURL` is called for each on unmount (no leak); URLs are not re-created on unrelated re-renders
- [x] 1.3 TDD fullscreen viewer: tapping a thumbnail opens a fixed overlay at that index; prev/next paging when >1 photo (clamped at ends) with a „n / m" position indicator; close via close button, backdrop tap, and `Escape`; no native dialog used

## 2. Wire photos through the import flow

- [x] 2.1 Pass `photos` from `ImportRecipeScreen` into `ReviewImportScreen` via a new `photos: StagedPhoto[]` prop (import the shared `StagedPhoto` type)
- [x] 2.2 TDD `ReviewImportScreen`: compose `<SourcePhotos>` above the existing unmatched panel into the `RecipeForm` `headerSlot` fragment; the strip is present when photos exist and the unmatched panel still renders/behaves as before

## 3. i18n

- [x] 3.1 Add German strings under `de.aiRecipeImport` (strip heading, open-photo aria with index, viewer close/prev/next aria, „n / m" position format); reference them from the new component

## 4. Verify

- [x] 4.1 `make check` green (lint + typecheck + fmt-check + tests, both workspaces); frontend 484 tests + backend green, lint/format clean — no new noise
- [ ] 4.2 Browser smoke via `make dev-http`: Rezepte → Aus Fotos → upload a multi-page recipe → on Rezept prüfen the photo strip shows the uploaded photos in order, tapping a thumbnail opens the fullscreen viewer and pages through all photos, closing returns to the review screen with edits intact — _not run in this environment (needs a real `ANTHROPIC_API_KEY` for the extraction call to reach the review screen); recommend a manual pass before release_
