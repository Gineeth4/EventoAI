# EventoAI V2

### From a rough event idea to an intelligent, actionable event plan.

EventoAI is an AI-powered event planning assistant that transforms event ideas into structured, personalized, and actionable plans.

It brings event planning, budget calculations, preparation timelines, recommendations, and change-impact analysis into one integrated workspace.

Whether organizing a birthday, planning a wedding, or coordinating a community gathering, EventoAI helps users understand what needs to happen, what it may cost, and how changes affect the overall plan.

[![CI](https://github.com/Gineeth4/EventoAI/actions/workflows/ci.yml/badge.svg)](https://github.com/Gineeth4/EventoAI/actions/workflows/ci.yml)
![Next.js](https://img.shields.io/badge/Next.js-16.4.2-black?logo=next.js)
![React](https://img.shields.io/badge/React-19-blue?logo=react)
![TypeScript](https://img.shields.io/badge/TypeScript-5.9-blue?logo=typescript)
![Tests](https://img.shields.io/badge/Tests-Vitest%20%7C%20Playwright-6E9F18)
![Accessibility](https://img.shields.io/badge/Accessibility-axe--core-green)

**Live demo:** [https://eventoai.vercel.app](https://eventoai.vercel.app)

**Repository:** [Gineeth4/EventoAI](https://github.com/Gineeth4/EventoAI)

---

## Contents

- [1. Project overview](#1-project-overview)
- [2. The problem](#2-the-problem)
- [3. Features](#3-features)
- [4. How EventoAI works](#4-how-eventoai-works)
- [5. What's improved in V2](#5-whats-improved-in-v2)
- [6. Technology stack](#6-technology-stack)
- [7. Architecture](#7-architecture)
- [8. Project structure](#8-project-structure)
- [9. Getting started](#9-getting-started)
- [10. Environment variables](#10-environment-variables)
- [11. Database and authentication](#11-database-and-authentication)
- [12. Testing and quality assurance](#12-testing-and-quality-assurance)
- [13. Security and privacy](#13-security-and-privacy)
- [14. Current limitations](#14-current-limitations)
- [15. Future improvements](#15-future-improvements)
- [16. Contributing](#16-contributing)
- [17. License](#17-license)

---

## 1. Project overview

EventoAI is designed to make event planning easier to understand, organize, and adapt.

Instead of treating an event plan as a static AI-generated response, the application provides an integrated planning workflow.

Users can describe their event, define their requirements, review a structured plan, understand budget allocations, explore recommendations, and examine the potential impact of changes.

The application combines AI-assisted generation with deterministic calculations, application-side validation, and structured planning utilities.

**The central objective is to turn event planning from a collection of disconnected decisions into one organized and adaptable process.**

## 2. The problem

Planning an event involves many interconnected decisions.

For example, changing the expected guest count can affect:

- Venue requirements
- Catering quantities
- Budget allocation
- Vendor requirements
- Preparation timelines
- Guest experience

Managing these relationships manually can be time-consuming and confusing.

Generic AI responses may provide useful suggestions, but they do not necessarily offer reliable budget calculations, structured timelines, persistent event records, or clear explanations of how planning changes affect other decisions.

EventoAI addresses these challenges through an integrated event-planning workspace.

## 3. Features

### 3.1 AI-assisted event planning

Users can describe their event and provide important details, including:

- Event type and occasion
- Date and location
- Expected guest count
- Spending limit and currency
- Theme and atmosphere
- Planning priorities

The application uses event-brief inference and AI-assisted generation to turn these requirements into a structured planning brief and event plan.

### 3.2 Conversational planning workflow

The planner guides users through eight stages:

1. **Idea:** Describe the event.
2. **Occasion:** Select the event type.
3. **Date:** Define the event date.
4. **Guests:** Specify the expected guest count.
5. **Location:** Provide the city, country, and venue setting.
6. **Budget:** Select currency, spending limit, and contingency reserve.
7. **Style:** Choose themes, atmosphere, and priorities.
8. **Review:** Examine the completed planning brief.

The workflow supports validation, navigation, editing, and persistence of the planning draft.

### 3.3 Budget intelligence

EventoAI includes application-side budget calculations and planning utilities.

Budget functionality supports:

- Total spending limits
- Category-level allocations
- Budget utilization
- Remaining budget calculations
- Contingency reserves
- Budget reconciliation
- Estimated versus verified cost distinctions

Supported currency options include INR, USD, GBP, and EUR.

Important numerical calculations are handled by application logic where appropriate rather than relying entirely on AI-generated arithmetic.

### 3.4 Timelines and preparation tasks

The timeline engine helps organize preparation tasks and event deadlines.

It provides structured task information to make planning responsibilities easier to understand and manage.

### 3.5 Event concepts and recommendations

EventoAI includes event-concept generation, recommendation ranking, planning guidance, and vendor-pricing scenarios.

These features help users explore different event directions and compare planning options.

### 3.6 Plan Impact Simulator

The Plan Impact Simulator is one of the application's key differentiators.

It evaluates supported modifications to an existing plan and helps users understand their potential consequences.

Depending on the proposed change, users can explore implications involving:

- Guest count
- Spending limits
- Event date
- Location
- Budget allocation
- Planning requirements

The intention is to help users understand trade-offs before accepting changes.

### 3.7 Saved events and cloud persistence

EventoAI uses Supabase authentication and account-owned cloud storage.

The persistence layer supports:

- User-owned event records
- Versioned event updates
- Concurrent-update safeguards
- Soft deletion
- Explicit importing of eligible browser-stored events

This allows users to revisit saved plans while reducing the risk of accidental overwrites or unintended restoration of deleted records.

---

## 4. How EventoAI works

The core workflow follows five stages.

**1. Describe**

Users provide an event idea and relevant preferences.

**2. Generate**

The application interprets the brief and creates an AI-assisted event plan.

**3. Review**

Users examine the proposed event structure, budget, timeline, and recommendations.

**4. Refine**

Users explore supported planning changes and evaluate their potential impact.

**5. Save**

Users preserve their event in their authenticated workspace and return to it later.

The workflow combines AI capabilities with deterministic calculations, schema validation, and application-side business logic.

---

## 5. What's improved in V2

V2 focuses on improving maintainability, accessibility, security, and automated verification while preserving existing event-planning functionality.

### 5.1 Planner architecture and maintainability

The conversational planner has been refactored to separate the generated-plan presentation from the main conversational workflow.

The generated-plan display was extracted into a dedicated component:

`src/components/planner/plan-result-panel.tsx`

The main conversational planner was reduced from approximately 2,609 lines to 1,966 lines during this refactoring.

The extracted component retains explicit callbacks for saving, approving, revising, and restarting a plan.

Other planning responsibilities have also been separated into dedicated components, including:

- Conversation budget step
- Conversation review panel
- Plan refinement panel

This improves separation of responsibilities and makes the planner easier to maintain and extend.

### 5.2 Accessibility improvements

Accessibility improvements include:

- Better text contrast in the public landing page
- Better text contrast throughout the authenticated planner
- Accessible labels for review actions
- Semantic groups for budget selections
- `aria-pressed` states for budget and contingency choices
- Visible keyboard focus
- Reduced-motion support
- Automated axe accessibility checks

The authenticated planner has been tested across all eight planning stages.

These automated checks are intended to improve WCAG A/AA accessibility coverage; they do not constitute a formal accessibility certification.

### 5.3 Backend and API safeguards

The planning API includes security and reliability measures such as:

- Authentication verification
- Request-origin validation
- Bounded request-body handling
- Input schema validation
- Rate limiting
- Safe public error responses
- Server-side AI-provider handling

API behavior is covered by dedicated automated tests.

### 5.4 Validation and data correctness

Saved-event validation includes explicit calendar-date checking, including month lengths and leap-year handling.

Planning input validation and event persistence checks are covered by automated tests.

### 5.5 Expanded automated coverage

V2 adds public-page and authenticated planner accessibility coverage, as well as additional API and security tests.

The recorded local verification for the V2 candidate is documented in the testing section below.

---

## 6. Technology stack

| Technology | Purpose |
|---|---|
| Next.js 16 | Application framework, routing, and server endpoints |
| React 19 | Interactive user interface |
| TypeScript | Static typing and maintainability |
| Google Gemini API | AI-assisted event-plan generation |
| Supabase Auth | Authentication |
| Supabase PostgreSQL | Cloud event persistence |
| PostgreSQL Row-Level Security | Database ownership protection |
| Upstash Redis | Rate limiting infrastructure |
| Vitest | Unit testing |
| Playwright | End-to-end browser testing |
| axe-core | Automated accessibility testing |
| ESLint | Code quality and static analysis |
| GitHub Actions | Automated repository checks |
| Vercel | Hosting and deployment platform |

---

## 7. Architecture

EventoAI separates the user interface, domain logic, validation, AI integration, and persistence responsibilities.

The main architectural areas include:

**Presentation layer**

Next.js routes and reusable React components provide the public pages, authenticated planner, event workspace, and user interface.

**Planning layer**

Conversational planning, event-brief inference, plan refinement, and planning intelligence organize user requirements and generated plans.

**Domain logic**

Dedicated utilities handle budget calculations, recommendations, event concepts, timeline generation, and plan-impact assessment.

**AI integration**

Server-side AI utilities handle event-plan generation and provider interaction.

**Security and validation**

Request guards, authentication checks, validation schemas, and rate-limiting utilities protect important application operations.

**Persistence**

Supabase authentication and database operations support account-owned event records.

---

## 8. Project structure

```text
eventoai/
├── .github/
│   └── workflows/
│       └── ci.yml
├── docs/
├── src/
│   ├── app/
│   │   ├── api/
│   │   │   └── ai/
│   │   │       └── plan/
│   │   ├── auth/
│   │   ├── events/
│   │   ├── login/
│   │   └── plan/
│   ├── components/
│   │   ├── auth/
│   │   ├── events/
│   │   ├── planner/
│   │   │   ├── conversation-budget-step.tsx
│   │   │   ├── conversation-review-panel.tsx
│   │   │   ├── conversational-planner.tsx
│   │   │   ├── plan-result-panel.tsx
│   │   │   └── plan-refinement-panel.tsx
│   │   └── ui/
│   ├── lib/
│   │   ├── ai/
│   │   ├── budget-engine/
│   │   ├── event-concepts/
│   │   ├── plan-impact/
│   │   ├── planning-intelligence/
│   │   ├── recommendation-engine/
│   │   ├── security/
│   │   ├── supabase/
│   │   ├── timeline-engine/
│   │   ├── validation/
│   │   └── vendor-pricing/
│   └── types/
├── supabase/
│   └── migrations/
├── tests/
│   ├── e2e/
│   │   ├── accessibility.spec.ts
│   │   ├── planner-accessibility.spec.ts
│   │   └── smoke.spec.ts
│   ├── integration/
│   └── unit/
├── package.json
├── playwright.config.ts
├── vitest.config.ts
└── README.md
```

This is a high-level project map. Additional modules and files exist within these directories.

---

## 9. Getting started

### Prerequisites

- Node.js 24 (used for the current local verification)
- npm
- A Supabase project
- A Google Gemini API key
- An Upstash Redis database for the configured production rate-limiting path

### 9.1 Clone the repository

```bash
git clone https://github.com/Gineeth4/EventoAI.git
cd EventoAI
```

### 9.2 Install dependencies

```bash
npm ci
```

### 9.3 Configure environment variables

Create `.env.local` in the project root.

Configure the required service credentials as described in the next section.

### 9.4 Start the development server

```bash
npm run dev
```

Open:

http://localhost:3000

---

## 10. Environment variables

Configure the required variables in `.env.local` and in your hosting environment.

| Variable | Purpose |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Supabase browser publishable key |
| `GEMINI_API_KEY` | Server-side Gemini API authentication |
| `UPSTASH_REDIS_REST_URL` | Upstash Redis REST endpoint |
| `UPSTASH_REDIS_REST_TOKEN` | Upstash Redis REST authentication |

The authenticated planner end-to-end test also accepts these optional test-session variables:

| Variable | Purpose |
|---|---|
| `E2E_TEST_EMAIL` | Dedicated Supabase test account |
| `E2E_TEST_PASSWORD` | Password for the dedicated test account |

Only use a dedicated test account for automated authentication tests.

Never commit API keys, private tokens, passwords, or production credentials.

The `NEXT_PUBLIC_` prefix is intended only for values that may be exposed to browser code. Gemini and Upstash credentials must remain server-side secrets.

---

## 11. Database and authentication

EventoAI uses Supabase authentication and PostgreSQL for cloud event persistence.

The database layer uses account ownership and row-level security to restrict access to event records.

The persistence implementation includes version-aware updates, concurrency safeguards, and soft deletion.

For a new database:

1. Review the migration history.
2. Apply migrations in the appropriate order.
3. Verify table privileges and row-level security policies.
4. Configure authentication providers and redirect URLs.
5. Test account ownership using separate authenticated accounts.

Do not rerun initial table-creation migrations against an existing database.

For an existing Supabase project, reconcile its migration history with the actual database schema before applying further changes.

Refer to the [Supabase authentication redirect documentation](https://supabase.com/docs/guides/auth/redirect-urls) when configuring application domains.

---

## 12. Testing and quality assurance

EventoAI uses automated tests for important planning logic, API behavior, validation, persistence, security, and browser interactions.

### Run the project checks

```bash
# ESLint
npm run lint

# Unit tests
npm test

# Production build
npm run build

# End-to-end tests
npm run test:e2e
```

### V2 local verification

**Recorded verification: October 31, 2026**

| Validation | Result |
|---|---:|
| ESLint | Passed |
| Production build | Passed |
| TypeScript compilation | Passed |
| Unit test files | 23 passed |
| Unit tests | 182 passed |
| End-to-end tests | 10 passed |
| Authenticated planner journey | Passed |
| Planner accessibility stages | 8 passed |
| Public landing-page accessibility | Passed |
| Login-page accessibility | Passed |
| Production dependency audit | 0 vulnerabilities |

The authenticated planner browser test requires `E2E_TEST_EMAIL` and `E2E_TEST_PASSWORD`. Without these dedicated test credentials, that test is intentionally skipped.

The accessibility tests use axe-core and cover the landing page, login page, keyboard focus, and the eight stages of the authenticated planning workflow.

These results represent local verification of the V2 candidate. They do not imply that a remote CI workflow or a new production deployment has been completed.

---

## 13. Security and privacy

Security is an important part of EventoAI's architecture.

The implementation includes:

- Server-side authentication verification
- Request-origin validation
- Bounded request-body handling
- API rate limiting
- Server-side AI-provider error handling
- Schema validation for planning inputs
- Validation of generated plan data
- Security response headers
- Content Security Policy in report-only mode
- Supabase row-level security
- User-scoped cloud operations
- Version-aware persistence and concurrency checks
- Soft deletion safeguards

**Production dependency security:** The V2 production dependency audit returned zero vulnerabilities during local verification.

The full development dependency audit still reports moderate advisories in the `minimatch` dependency chain used by development tooling. A forced dependency downgrade was deliberately avoided to protect the working ESLint and Next.js toolchain.

A report-only Content Security Policy monitors potential violations; it does not block them.

Security tests and mocked persistence tests do not replace verification against a deployed environment and real authenticated accounts.

Before deployment, verify authentication, account isolation, AI request handling, and rate-limiting configuration.

---

## 14. Current limitations

EventoAI is an evolving project.

The following limitations are important:

- Vendor pricing may be simulated or illustrative and must not be treated as a verified quotation.
- Vendor availability and actual costs must be confirmed directly.
- AI-generated plans may be incomplete or inaccurate and should be reviewed.
- AI generation depends on provider configuration, credentials, quotas, and service availability.
- Automated tests do not establish that every live third-party integration works in production.
- Automated accessibility checks do not guarantee full WCAG conformance.
- The current development dependency audit contains documented moderate advisories.

EventoAI is intended to support planning decisions, not replace confirmation from venues, vendors, or event professionals.

---

## 15. Future improvements

Potential development directions include:

- Further separation of planner workflow and domain responsibilities
- Additional authenticated integration testing
- Expanded accessibility and keyboard-navigation coverage
- More extensive timeline-dependency validation
- Stronger operational monitoring
- More complete live vendor-data integration
- Continued dependency-security improvements
- Improved performance measurement and optimization

Future capabilities will be treated as planned work until implemented and verified.

---

## 16. Contributing

Contributions and issue reports are welcome.

For proposed changes:

1. Describe the problem or improvement.
2. Explain the expected benefit to users.
3. Add relevant tests for changes to application logic.
4. Run lint, unit tests, production build, and applicable browser tests.
5. Document new environment variables or database changes.

Do not include credentials, private user data, or sensitive configuration in commits or test fixtures.

---

## 17. License

No license file has been declared for this repository yet.

Until a license is added, do not assume that the source code is available for unrestricted reuse.

---

**EventoAI V2 — Intelligent planning. Clearer decisions. More actionable events.**