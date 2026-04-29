# forkcast

A personal meal planning and nutrition tracking PWA — built because existing apps (fddb, yazio, myfitnesspal) make advance meal planning too tedious.

## The Problem

Calorie and macro tracking apps exist, but planning meals a week ahead while hitting specific nutrition goals is clunky in all of them. forkcast is built around that planning-first workflow.

## Core Idea

- Plan meals up to a week in advance
- Track calories and macros against personal goals (user-defined, no fixed diet approach)
- Manage recipes and ingredients
- Generate grocery lists from the weekly plan
- Minimal friction — every interaction should be fast and obvious

## Context

Built for someone with a full-time job, a young family, and serious fitness goals — meaning low time, high standards. Mobile-first PWA so it works on the go (grocery store, meal prep), full desktop support too.

Built for personal use first; designed with future product potential in mind.

## Architecture

### Domain-Driven Design
Pragmatic DDD — the domain model uses the language of nutrition and meal planning (`MealPlan`, `Recipe`, `NutritionGoal`, etc.), organized into bounded contexts. Aggregates and value objects used where they genuinely add clarity, skipped where they don't. Modularization over ceremony.

### Hexagonal Architecture
Domain logic is framework-agnostic and infrastructure-free. Ports define what the domain needs; adapters wire in the database, HTTP layer, and any external services. Nothing flows inward — infrastructure depends on the domain, not the other way around.

### CQRS
Commands express business intent (`PlanMeal`, `AddRecipe`); queries are purpose-built for the UI. Separation of concerns is the goal, not performance optimization. No Event Sourcing.

### API Design
The API speaks the domain language — operations describe business intent (`/plan-meal`, `/add-to-grocery-list`), not database operations.

### Build only what's needed
No speculative infrastructure or abstractions. Things get added when there's a concrete reason.

**Current baseline:** JSON file for persistence, no containerization. Both will be upgraded when the need arises.

## Data

The BLS 4.0 (2025) food composition dataset (`BLS_4_0_Daten_2025_DE.csv`) is pre-baked into `backend/data/bls.json` at build time. To regenerate it after a new BLS release, run:

```bash
pnpm --filter @forkcast/backend build:bls
```
