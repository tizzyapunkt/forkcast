# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

Single user: the app owner, with a full-time job, a young family, and serious fitness goals. Low time budget, high standards. Auth is a login gate for this one user, not a multi-account system. UI copy is German (`src/i18n/de.ts`, only locale shipped).

## Product Purpose

Weekly meal planning with calorie/macro tracking against user-defined goals, recipe and ingredient management, and grocery list generation from the plan. Success = planning a week of meals stays fast enough to actually do every week, not skipped under time pressure.

## Positioning

Existing tracking apps (fddb, yazio, myfitnesspal) treat weekly-advance planning as an afterthought bolted onto daily logging. forkcast is planning-first: the week is the primary unit, adhoc daily tracking is the secondary flexible path — the opposite emphasis of its competitors.

## Operating Context

Mobile-first installable PWA (offline-capable) with full desktop support. Real usage scenes: planning at a desk/couch ahead of the week, checking the plan and logging food on a phone during the day, using the grocery list while shopping. Backend persists to a JSON file (`backend/data/catalog.json` for the food catalog); no database engine yet.

Recipes can be imported from photos (printed page, Instagram carousel, recipe card front/back) via Claude vision on the backend; the draft is reviewed and confirmed by the user before anything is persisted, and unmatched ingredients get matched against or added to the catalog during that review.

## Capabilities and Constraints

- Weekly meal planning, calorie/macro tracking vs. user-defined goals (no fixed diet template)
- Recipe and ingredient management, food catalog editable in-app (Einstellungen → Katalog verwalten)
- AI recipe import from photos (requires backend `ANTHROPIC_API_KEY`; feature hides itself in the frontend when unconfigured)
- Single-user auth gate, no multi-account/sharing model
- JSON-file persistence; no containerization — both explicitly deferred until a concrete need arises
- Feature folders under `frontend/src/features/` mirror domain language (planning, daily-log, recipes, food-catalog, weight-log, body-profile, etc.)

## Brand Commitments

- Name is fixed: **forkcast** (lowercase, used in manifest and README as-is).
- Primary brand color is fixed: light purple/lilac, currently `--primary: 244 36% 44%` in `src/components/ui/tokens.css`. Must carry forward through any visual work.
- No logo or other visual assets confirmed yet.

## Evidence on Hand

- Working design system in `frontend/src/components/ui/` (Button, Input, DecimalInput, Card, Field, SegmentedControl, etc.) built with CVA variants over tokens in `tokens.css`/`index.css` — treat as incumbent visual authority for refinement work, not a blank slate.
- `frontend/src/components/app/` holds domain-aware composites (header, bottom nav, sheets, error banner).
- No testimonials, case studies, press, or third-party proof exist or should be fabricated — personal-use app, none needed.

## Roadmap

- **Grocery list generation from the weekly plan** — core to the product's pitch (see Product Purpose, README), but not yet built: no code exists in `frontend/src` or `backend/src` for it. Design/build work should not assume it exists today, but should keep the data model open to it (plan → grocery list derivation).

## Product Principles

- Every interaction must be fast and low-friction — the target user has no time to spare.
- Planning-first, not logging-first: the weekly plan is the primary object; adhoc tracking is the flexible secondary path.
- No speculative infrastructure or UI abstractions — build what the current concrete need requires.
- Domain language throughout (DDD) — UI and API vocabulary should read like meal planning, not CRUD.
- Personal-use software built to a product-grade bar, so architecture and design stay clean enough to generalize later without a rewrite.

## Accessibility & Inclusion

No specific personal requirement beyond general good practice (adequate contrast, touch targets, keyboard/screen-reader basics).
