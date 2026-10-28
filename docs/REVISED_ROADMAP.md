# EventoAI — Revised Implementation Roadmap

## Product vision

EventoAI is an Agentic Event Experience Studio. Users describe an event
in natural language, compare distinct concepts, refine a plan with an AI
planning companion, approve a version, and manage the real work through
an interactive event workspace.

## Phase status

- [x] Phase 0 — Protect the Existing Foundation
- [ ] Phase 1 — Premium Design System and Application Shell
- [ ] Phase 2 — Conversational Onboarding
- [ ] Phase 3 — Structured Event Brief and Planning Intelligence
- [ ] Phase 4 — Three Concepts and Interactive Selection
- [ ] Phase 5 — Agentic Refinement and Plan Approval
- [ ] Phase 6 — Visual Event Workspace
- [ ] Phase 7 — Secure Persistence and Event Versioning
- [ ] Phase 8 — External Integrations and Security Hardening
- [ ] Phase 9 — Comprehensive Testing and Deployment

## Current baseline

- Next.js 16.4.2
- React 19
- TypeScript
- Gemini generation with local fallback
- Deterministic budget calculation and validation
- Timeline generation and recommendation logic
- Browser-local saved events
- Event viewing, editing, regeneration, and deletion UI
- Last reported checks: lint passed, 69 tests passed, production build passed

## Existing architecture to preserve

- `src/app/layout.tsx`
- `src/app/globals.css`
- `src/app/page.tsx`
- `src/app/plan/`
- `src/app/events/`
- `src/app/api/ai/plan/route.ts`
- `src/components/planner/event-planner.tsx`
- `src/components/events/event-actions.tsx`
- `src/lib/ai/`
- `src/lib/budget-engine/`
- `src/lib/validation/`
- `src/lib/timeline-engine/`
- `src/lib/recommendation-engine/`
- `src/lib/saved-events.ts`
- `src/types/`

## Phase 1 acceptance criteria

- Establish reusable styling tokens and interaction primitives.
- Keep the existing forest-green and sage identity.
- Introduce refined hover, focus, selected, loading, and reduced-motion states.
- Avoid replacing global styles or working page components wholesale.
- Pass lint, tests, and production build.
- Migrate existing pages to the new design system in controlled steps.

## Implementation rules

1. Inspect existing code before replacing a file.
2. Preserve working AI, budget, validation, and persistence behavior.
3. Validate money totals in application code, not in AI output.
4. Keep assumptions, estimates, quotes, and actual expenses distinct.
5. Keep generated concepts and proposed revisions separate from confirmed plans.
6. Run lint, tests, and build after meaningful changes.
7. Mark a phase complete only after its acceptance criteria are met.