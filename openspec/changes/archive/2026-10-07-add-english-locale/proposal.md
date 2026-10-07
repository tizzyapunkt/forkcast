## Why

forkcast's UI is German only (`frontend/src/i18n/de.ts`), and so is its food catalog. The public website (`website/`) targets an English-first audience, including a possible Hacker News submission, and must show real English screenshots of the app. It should not show German screens with a disclaimer. An English locale also opens the app to anyone who doesn't read German.

## What Changes

- New **English UI locale** next to German. Every user-facing string in the frontend gets an English counterpart with the same shape as `de`. Missing keys are a type error.
- **Locale selection:** on first load the app follows the browser language (`de*` → German, anything else → English). The user can override it in Einstellungen/Settings. The choice is stored on the device and applied on every start.
- **Locale-aware formatting:** dates, times, decimals and file sizes use the active locale instead of the hard-coded `de-DE`. `<html lang>` follows the locale.
- **Macro triplet in English** reads `52 P · 0 C · 30 F`. German keeps `52 P · 0 KH · 30 F`.
- **Catalog entries gain English names.** An entry can carry an optional English display name next to the canonical German name. Search matches the query against both names. Results are returned in the requested locale and fall back to German when no English name exists.
- **Bundled seed** (`backend/data/catalog.json`) gets an English name for every entry. The seed-only-when-absent rule stays, so an existing catalog file is not touched.
- **Catalog manager and AI fill** expose the English name. AI-drafted and AI-resolved new foods propose both names.
- **Not changed:** Open Food Facts lookups keep their German-market query (`countries_tags:"en:germany"`). That is a market choice, not a UI-language one. The Bring! export keeps its German lines, because Bring!'s parser expects German. Recipe photo import is unchanged: it keeps the recipe's own wording, matches against German catalog names and writes German system labels (`nach Geschmack`, spoon labels). Localizing it is a follow-up. Names already stored in logged days, recipes and grocery lists are snapshots and are not translated after the fact.

## Capabilities

### New Capabilities

- `ui-locale`: the supported locales, how the active locale is chosen and persisted, locale-aware formatting, and the requirement that both message sets cover the same keys.

### Modified Capabilities

- `food-catalog`: entries carry an optional English name. Name search matches both names. Search results are localized with a German fallback. The catalog manager and the AI fill handle the English name.
- `meal-log-display`: the per-entry macro suffix labels carbs `KH` in German and `C` in English.

## Impact

- **Frontend:** `src/i18n/` gains `en.ts`, a shared message type and the locale resolution. About 59 modules that import `de` switch to the active message set. `toLocale*('de-DE')` call sites and `lib/decimal.ts` read the active locale. The settings screen gains a language control. The catalog manager editor gains an English name field. The search request passes the locale.
- **Backend:** `FoodEntry` gains optional English fields (`domain/foods/types.ts`), catalog validation and indexing cover them, and `GET /search-ingredients` accepts a `locale` parameter. The AI drafting and resolution schemas (`infrastructure/food-drafting/`, `infrastructure/food-resolution/`) request an English name. The grocery list's piece-size lookup (`build-grocery-list.use-case.ts`) also indexes English names, so English-named log entries still get piece hints.
- **Data:** `backend/data/catalog.json` (tracked seed, ~190 entries) gains English names. Existing runtime catalogs keep working without them, because the new field is optional.
- **Website:** unblocks English screenshots for the landing page.
- **Known limitation:** names are snapshotted when food is logged or added to a recipe. A user who switches locale mid-week can see mixed-language names, and the grocery list may then list the same food once per language.
