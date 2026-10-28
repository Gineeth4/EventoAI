# EventoAI — Project Structure

## Application routes

- `src/app/layout.tsx`
  Root document, metadata, viewport and global styles.
- `src/app/page.tsx`
  Existing landing page; migrate to the revised design system.
- `src/app/plan/`
  Current event-generation page and planner stylesheet.
- `src/app/events/`
  Saved-event list, saved-plan details and event actions.
- `src/app/dashboard/`
  Reserved dashboard route.
- `src/app/api/ai/plan/route.ts`
  Existing AI plan-generation endpoint.

## Design system

- `src/app/globals.css`
  Existing global styling and brand variables.
- `src/app/design-system.css`
  Shared visual tokens, motion and design primitives.
- `src/components/ui/studio-button.tsx`
  Reusable styled button.
- `src/components/ui/studio-choice-card.tsx`
  Reusable selectable card.
- `src/components/ui/studio-section-heading.tsx`
  Reusable section heading.

## Planner and saved events

- `src/components/planner/event-planner.tsx`
  Existing event form and plan results.
- `src/components/events/event-actions.tsx`
  Saved-event editing, regeneration and deletion.
- `src/lib/saved-events.ts`
  Current browser-local persistence.
- `src/types/saved-event.ts`
  Saved-event data structures.

## Core engines

- `src/lib/ai/`
  Gemini integration, generation, fallback and AI validation.
- `src/lib/budget-engine/`
  Budget calculations, reconciliation and financial validation.
- `src/lib/validation/`
  Input, plan and budget schemas.
- `src/lib/timeline-engine/`
  Timeline generation and validation.
- `src/lib/recommendation-engine/`
  Recommendation ranking.
- `src/lib/plan-impact/`
  Plan-change assessment.

## Shared domain types

- `src/types/event.ts`
- `src/types/event-plan.ts`
- `src/types/recommendation.ts`
- `src/types/saved-event.ts`

## Tests

- `tests/unit/`
  Existing and new unit tests.

## Revised implementation roadmap

See `docs/REVISED_ROADMAP.md`.

Important architectural constraint:
Do not replace existing AI generation or deterministic budget logic
when changing the user interface. Keep presentation, validation,
planning calculations, and persistence as separate responsibilities.