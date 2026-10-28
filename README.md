# EventoAI

### From a rough event idea to a plan you can act on.

EventoAI is an AI-powered event planning assistant that helps turn ideas into structured, personalized, and actionable plans. It brings event planning, budget calculations, timelines, recommendations, and change-impact analysis into one workspace.

Whether you are organizing a birthday, planning a wedding, or coordinating a community gathering, EventoAI helps you understand what needs to happen, what it may cost, and what changes when your plans evolve.

[![CI](https://github.com/Gineeth4/EventoAI/actions/workflows/ci.yml/badge.svg)](https://github.com/Gineeth4/EventoAI/actions/workflows/ci.yml)
![Next.js](https://img.shields.io/badge/Next.js-16.4.2-black?logo=next.js)
![TypeScript](https://img.shields.io/badge/TypeScript-5-blue?logo=typescript)
![Testing](https://img.shields.io/badge/Tests-Vitest%20%7C%20Playwright-6E9F18)

> **Live demo:** Coming soon. The public production URL will be added here after deployment and verification.

**Repository:** [Gineeth4/EventoAI](https://github.com/Gineeth4/EventoAI)

---

## Contents

- [Why EventoAI?](#why-eventoai)
- [What it can do](#what-it-can-do)
- [How it works](#how-it-works)
- [What makes it different](#what-makes-it-different)
- [Technology stack](#technology-stack)
- [Project structure](#project-structure)
- [Getting started](#getting-started)
- [Environment variables](#environment-variables)
- [Database and authentication](#database-and-authentication)
- [Testing and quality checks](#testing-and-quality-checks)
- [Security and privacy](#security-and-privacy)
- [Current limitations](#current-limitations)
- [Future direction](#future-direction)
- [Contributing](#contributing)
- [License](#license)

## Why EventoAI?

Planning an event involves many interconnected decisions. A change in guest count can affect the budget, venue requirements, catering, schedule, and vendor needs. Managing those relationships manually can become time-consuming and confusing.

EventoAI is designed to bring those decisions together.

Instead of treating an event plan as a static document, it helps users build a structured plan, examine the numbers, organize preparation tasks, explore options, and reason about proposed changes.

The goal is simple: **make event planning easier to understand, easier to adapt, and easier to act on.**

## What it can do

### 1. Turn event ideas into structured plans

Describe an event and provide details such as its type, date, location, expected guest count, budget, themes, style preferences, and priorities.

EventoAI uses the supplied information to help construct a personalized event brief and a structured event plan.

### 2. Make budgets easier to understand

The budget engine calculates projected spending and supports contingency planning and budget reconciliation.

Budget information is intended to help users understand:

- Projected costs and spending limits
- Category-level allocations
- Remaining budget and budget utilization
- Contingency reserves
- Differences between estimated amounts and verified quotations

Currency formatting supports the currencies offered by the application, including INR, USD, GBP, and EUR.

### 3. Organize preparation with timelines and checklists

EventoAI includes timeline-generation and validation utilities designed to help users organize preparation tasks, understand deadlines, and plan the steps leading up to an event.

The aim is to make the next action clearer rather than leave users with a long, unstructured list of tasks.

### 4. Explore event concepts and vendor options

The application includes event-concept selection, recommendation ranking, planning guidance, and illustrative vendor-pricing scenarios.

Recommendations are intended to help users compare ideas and understand how different choices may fit their preferences and budget.

### 5. Understand the impact of changes

The **Plan Impact Simulator** is one of EventoAI's key differentiators.

Users can explore proposed changes, such as increasing the guest count, changing the spending limit, adjusting the event date, or changing the location.

The impact-assessment logic evaluates supported changes and helps explain their implications for the event plan.

This makes planning more adaptable: users can consider trade-offs before committing to a different direction.

### 6. Save and manage personal event plans

EventoAI uses Supabase authentication and account-owned cloud storage for saved events.

The persistence layer supports versioned event records, concurrent-update safeguards, soft deletion, and explicit importing of eligible browser-stored events.

The intended result is a personal event-planning workspace in which saved plans can be revisited and updated without silently overwriting existing cloud data.

## How it works

1. **Describe:** Enter your event idea, preferences, guest count, budget, date, and other relevant details.
2. **Generate:** Use the AI-assisted planning workflow to build a structured plan from the event brief.
3. **Review:** Examine the proposed plan, projected costs, schedule, and recommendations.
4. **Refine:** Explore supported changes and assess their possible impact on the plan.
5. **Save:** Preserve the event in your authenticated workspace and return to it later.

The workflow combines AI assistance with application-side validation and deterministic calculations where appropriate.

## What makes it different?

EventoAI is built around more than generating an event-planning response.

**AI-assisted planning** helps interpret a user's requirements and organize useful recommendations.

**Deterministic calculations** handle important budget arithmetic and related checks in application code rather than relying entirely on generated numerical answers.

**Change-impact analysis** makes the consequences of supported planning changes part of the workflow.

**Account-owned persistence** provides authenticated event storage, ownership checks, concurrency protection, and safeguards against accidentally restoring soft-deleted events.

**Transparent estimates** distinguish illustrative pricing and estimated allocations from verified vendor quotations.

Together, these elements are intended to make the product useful for the decisions that surround an event, not just the initial generation of a plan.

## Technology stack

| Technology | Purpose |
|---|---|
| Next.js App Router | Application framework, routing, and server-side endpoints |
| React | Interactive user interface |
| TypeScript | Application types and static checking |
| Google Gemini API | AI-assisted event-plan generation |
| Supabase Auth | User authentication |
| Supabase PostgreSQL | Cloud storage for account-owned events |
| PostgreSQL row-level security | Database-level ownership protections |
| Upstash Redis and rate limiting | Production API request-rate controls |
| Vitest | Unit and utility testing |
| Playwright | Browser-level end-to-end smoke tests |
| GitHub Actions | Automated repository checks |
| Vercel | Intended hosting and deployment platform |

## Project structure

The project is organized around the application routes, reusable components, and domain-specific planning utilities.

```text
eventoai/
├── .github/
│   └── workflows/
│       └── ci.yml
├── docs/
│   ├── PROJECT_STRUCTURE.md
│   └── REVISED_ROADMAP.md
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
│   ├── integration/
│   └── unit/
├── .gitignore
├── package.json
├── playwright.config.ts
├── vitest.config.ts
└── README.md
```

This is a high-level map of the project; some directories contain additional files and utilities.

## Getting started

### Prerequisites

Install the following before running the application:

- [Node.js](https://nodejs.org/) — Node.js 24 is the version used for the current local verification.
- npm, included with Node.js
- A Supabase project for authentication and cloud event storage
- A Google Gemini API key for AI-assisted plan generation
- An Upstash Redis database for the configured production rate-limiting path

### 1. Clone the repository

```bash
git clone https://github.com/Gineeth4/EventoAI.git
cd EventoAI
```

### 2. Install dependencies

```bash
npm ci
```

### 3. Configure environment variables

Create a file named `.env.local` in the project root and add the required environment variables.

See [Environment variables](#environment-variables) below.

### 4. Start the development server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

The local development server reads the configured environment variables from `.env.local`.

## Environment variables

Configure the following variables in your local `.env.local` file and in your hosting provider's environment settings.

| Variable | Purpose |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Supabase browser publishable key |
| `GEMINI_API_KEY` | Server-side Gemini API authentication |
| `UPSTASH_REDIS_REST_URL` | Upstash Redis REST endpoint |
| `UPSTASH_REDIS_REST_TOKEN` | Upstash Redis REST authentication |

Use the actual values provided by the relevant services. The names above document the application's expected configuration; verify that all required variables are populated for the environment you are running.

Never commit real API keys, private tokens, or production credentials. The `NEXT_PUBLIC_` prefix is intended only for values that may be exposed to browser code, such as the Supabase URL and publishable key.

The Gemini key and Upstash token must remain server-side secrets.

## Database and authentication

EventoAI's cloud persistence layer uses a PostgreSQL `events` table with user ownership and row-level security.

The database changes are documented under `supabase/migrations/`, including the initial table definition, soft-delete support, and the restriction on physical deletion of event records.

When setting up a new database:

1. Review the existing schema and migration history.
2. Ensure there is only one canonical initial table-creation migration.
3. Apply the schema changes in the correct order.
4. Verify the resulting privileges, row-level security policies, and authentication configuration before allowing real users to access the application.

Do not rerun the initial table-creation SQL against a database that already contains the table. For an existing Supabase project, reconcile the migration history with the actual database before using a migration tool to apply changes.

Authentication redirects must also be configured for the domains used by the application. See the [Supabase redirect URL documentation](https://supabase.com/docs/guides/auth/redirect-urls).

## Testing and quality checks

The project uses automated tests to check important planning logic, validation, persistence behavior, request guards, and browser-level behavior.

Run the checks locally with:

```bash
# Unit tests
npm test

# Lint
npm run lint

# Production build
npm run build

# Browser smoke tests
npm run test:e2e
```

The latest recorded local verification completed with:

- **152 unit tests passing** across 22 test files
- ESLint passing
- The Next.js production build passing
- **5 Playwright end-to-end smoke tests passing**

These are local verification results, not a claim that the remote GitHub Actions workflow or a production deployment has already passed. Check the [GitHub Actions page](https://github.com/Gineeth4/EventoAI/actions) for remote workflow results after the workflow is published and run.

## Security and privacy

Security is an important part of the application architecture.

The implementation includes:

- Server-side authentication checks for the AI planning endpoint
- Request-origin validation and bounded request-body handling
- Rate limiting for the planning API
- Server-side handling of AI-provider errors
- Schema validation for planning inputs and generated outputs
- Security response headers and a Content Security Policy in report-only mode
- Supabase row-level security for account-owned event records
- User-scoped cloud operations and concurrency checks
- Soft deletion to prevent stale copies from silently recreating deleted records

Report-only Content Security Policy does not block violations; it provides a compatibility-monitoring stage before any decision to enforce a policy.

Security tests and mocked persistence tests are useful safeguards, but they do not replace testing with real authenticated accounts, production credentials, and a deployed environment.

Before deployment, verify the live authentication flows, account isolation, AI request behavior, and rate-limiting configuration.

## Current limitations

EventoAI is an evolving project, and several boundaries are important to understand:

- Vendor pricing is currently simulated or illustrative. It must not be treated as a verified quotation from a real provider.
- Vendor availability and final costs must be confirmed directly before a commitment is made.
- AI-generated content can be incomplete or inaccurate and should be reviewed.
- Access to AI plan generation depends on the configured provider, credentials, quotas, and service availability.
- Unit tests do not establish that every live third-party integration will work in production.
- Automated smoke tests cover only a subset of all possible user journeys.

The application is intended to support planning decisions, not replace confirmation from venues, vendors, or event professionals.

## Future direction

The development direction for EventoAI includes:

- More complete end-to-end verification of the authenticated planning workflow
- Continued improvements to accessibility, responsive design, and error recovery
- Stronger integration testing for account isolation and persistence
- More extensive validation of timeline dependencies and plan-change scenarios
- Improved operational monitoring and deployment verification
- Potential future integration with trustworthy live vendor data sources

Future capabilities will be treated as planned work until they are implemented and verified.

## Contributing

Contributions and issue reports are welcome.

For a proposed change:

1. Describe the problem or improvement.
2. Explain its expected benefit to users.
3. Include relevant tests for changes to application logic.
4. Run the unit tests, lint, production build, and applicable browser tests.
5. Document any new environment variables or database changes.

Avoid including credentials, real user data, or sensitive configuration in commits, issue reports, or test fixtures.

## License

No license file has been declared for this repository yet. Until a license is added, do not assume that the source code is available for unrestricted reuse.
