# Workflow — how changes ship in this repo

A new agent picking up this codebase should read this file first, then any project-specific conventions file (e.g. `CLAUDE.md`, `CONVENTIONS.md`) for technical details. Together they define what the user expects.

---

## Project identity

**Happiness in a Bowl** — catering order manager (batch processing, cost tracking, order checking).

- **Stack**: Vite / React 19 / TypeScript / Tailwind CSS (SPA).
- **Deployment**: GitHub Pages via `.github/workflows/deploy.yml`, on push to `main`.
- **Database**: Supabase (hosted Postgres), single shared table `app_data(key text pk, value jsonb, updated_at)` with RLS.
- **Auth**: Supabase Auth (email/password), gated via `src/components/AuthGate.tsx`.
- **Dev server**: `npm run dev` (Vite, default port 5173).

---

## Budget reality

Assumes a capped API plan (e.g. Claude Pro). Adjust numbers to your actual limits.

| Resource | Capacity |
|---|---|
| Session window | _[e.g. ~88,000 tokens per 5-hour window]_ |
| Weekly Sonnet | _[e.g. ~40–80 active hours]_ |
| Weekly Opus | _[e.g. ~4–8 hours (~8 messages)]_ |
| Relative Opus cost | ~5× Sonnet |

**Golden rule**: Opus messages are scarce. Every Opus turn must be high-value — never exploratory, never iterative, never raw-context-dumping.

---

## Tier triage — does this task need Opus?

| Tier | When | Opus messages | Flow |
|---|---|---|---|
| **1 — Sonnet only** | bug fix, single-file change, UI tweak, docs, tests, style fix | 0 | Sonnet plans → Sonnet implements → Sonnet self-reviews |
| **2 — Opus plan only** | new feature spanning 2–4 files, moderate refactor, new route, schema change | 1 | Sonnet researches → Opus plans (1 msg) → Sonnet implements → Sonnet self-reviews |
| **3 — Opus bookend** | major architectural decision, cross-cutting redesign, security-critical changes | 2 | Sonnet researches → Opus plans → Sonnet implements → Sonnet verifies → Opus reviews |

Default to Tier 1. Escalate only when the criteria fit. **Iterative debugging never escalates** — Sonnet handles ALL fix cycles, even when the plan came from Opus.

---

## Hard rule: Opus never implements

This is non-negotiable. Opus plans, reviews, and dispatches Sonnet. Opus does **not** write feature code, do refactors, write migrations, build components, or run sprints.

| What Opus *may* do directly | What Opus *must* delegate |
|---|---|
| Write `*_PLAN.md` files | Multi-file changes |
| Review a Sonnet commit against spec | New components, routes, modules, features |
| Write briefs for Sonnet | Refactors of any scope |
| Approve or send-back | Bug fixes longer than one line |
| Apply a **literal one-line fix** (typo, single-token rename, single import) when there is genuinely no diagnostic ambiguity and the fix is obvious from the failure message | Anything where the agent has to *think* about the implementation, even briefly |

The one-line carve-out exists so Opus doesn't have to spawn a Sonnet subagent for the kind of fix a human would make in five seconds. If Opus catches itself writing a second line, **stop and dispatch Sonnet instead**.

Why this rule exists:
- Opus tokens are ~5× Sonnet's cost and severely capped.
- Implementation work scales linearly with edits; Opus's value is in design judgment, which doesn't.
- Sonnet does implementation as well as Opus on most codebases. There is no quality argument for Opus to implement.
- Every Opus message spent implementing is one less Opus message available when an architectural call genuinely matters.

How Opus dispatches to Sonnet:
- Use the Agent tool (or equivalent in the host environment).
- Brief is self-contained per the conventions in this file (read first list, scope, acceptance criteria, guardrails).
- For implementation runs, do not also delegate the planning — Opus has already done that.
- Trust but verify: read the diff Sonnet produced before approving, don't just trust the report.

---

## Anti-patterns that burn budget

- **Opus exploring the codebase.** Sonnet does that; Opus gets the distilled summary.
- **Opus iterating on bug fixes.** One Opus message = ~5 Sonnet messages. Three fix-cycles with Opus = your whole day's Opus budget gone.
- **Sending Opus 15 raw files.** Sonnet condenses to a 50-line summary first.
- **Open-ended Opus prompts** ("what should we do about performance?"). Pre-distil to A/B/C options, ask Opus to pick + plan.
- **Opus reviewing broken code.** Sonnet fixes build errors first; only then Opus reviews.

The one scenario where Opus *saves* budget: a task has gone sideways mid-implementation. One Opus re-plan (5×) << hours of wasted Sonnet implementation on the wrong approach (50×+).

---

## Roles

| Role | Typical agent | Responsibility |
|---|---|---|
| Planner / reviewer | Opus | Reads code, writes plan files, hands off briefs, reviews each commit, approves before the next phase |
| Implementer | Sonnet | Reads plan + brief, ships **one commit at a time**, stops, reports |
| User | (human) | Orchestrates: pastes implementer reports to the planner, runs manual / browser acceptance, decides when to push |

The two agents never talk to each other directly. The user is always in the loop.

---

## Cross-session handoff (`HANDOFF.md`)

When a session is about to end and there's context worth preserving for the next agent (mid-sprint state, open follow-ups, deployment gotchas, account swap), write or update `HANDOFF.md` at repo root so a fresh conversation can resume from just that file path.

**Procedure:**
1. Check if `HANDOFF.md` already exists in the project root.
2. If it exists, **read it first** to understand prior context before updating.
3. Create or update it with the required structure below.
4. The outgoing agent commits `HANDOFF.md`. Tell the user the file path so they can start a fresh conversation with just that path.

**Required structure (these five headings, in order):**
- **Goal** — what we're trying to accomplish.
- **Current Progress** — what's been done so far.
- **What Worked** — approaches that succeeded.
- **What Didn't Work** — approaches that failed (so they're not repeated).
- **Next Steps** — clear, actionable items for continuing.

**Rules:**
- **Exactly one** `HANDOFF.md` exists at any time, at repo root. The incoming agent reads it as part of the standard read order (`workflow.md` → conventions file → `HANDOFF.md` → active `*_PLAN.md`).
- **Update in place** — the incoming agent reads it, acts on the Next Steps, then *updates* `HANDOFF.md` to reflect the new state (refreshing all five sections). Do **not** delete it; it is a living continuity document.
- `HANDOFF.md` is for cross-session continuity. The active `*_PLAN.md` (if any) remains the source of truth for in-flight sprint work.
- Canonical name is `HANDOFF.md` (uppercase). Lowercase `handoff.md` and the old `HANDOVER.md` are deprecated — do not create variants.

---

## The cycle

1. **Plan.** Planner writes `<TOPIC>_PLAN.md` at repo root. Commits the plan first.
2. **Brief.** Planner writes a short hand-off prompt that **points at the plan file** and carries the repo-wide guardrails. The brief does *not* duplicate the plan's content.
3. **Implement.** Implementer reads the plan + brief, executes the first phase, makes one commit, stops, reports back to the user in this format:
   > Commit X.Y done: `<SHA>` — `<commit message>`. <one or two lines on deviations or verification>.
4. **Review.** User pastes that report to the planner. Planner reads the diff against the spec, replies with `Approved` (with optional non-blocking notes and the next-phase brief) or `Send back: <reason>` with a specific corrective ask.
5. **Repeat** until every numbered phase has shipped.
6. **Push / Deploy.** Only when the user says to. If using CI/CD (e.g. Firebase App Hosting, Vercel, etc.), the platform picks up changes from the connected branch automatically on push — no manual deploy step needed unless deploying manually.

---

## Plan file conventions

A plan file at repo root contains, in order:

- **Goal** — one paragraph on what and why.
- **Locked decisions table** — `do NOT re-litigate` items. Saves implementer cycles.
- **Files to read first** — implementer starts cold; tell it which files matter.
- **Numbered phases** (1.1, 1.2, 2.1 ...). One phase = one commit.
- **Per phase:** file path(s), scope, acceptance criteria, exact commit message.
- **Things NOT to do** — explicit scope boundaries.
- **Post-MVP / out-of-scope ideas** — captured but marked clearly as not-now.
- **Verification ritual** — type checks, lint, build, tests as applicable to the stack.
- **Commit-sequence summary table** — quick reference.

---

## Brief conventions

The brief is short. It contains:

- **Read first:** conventions file, the plan file by path.
- The number of commits expected and the **stop-and-report-after-each-commit** rule.
- The repo-wide guardrails (below).
- Any per-job gotchas the implementer might otherwise miss.

If the brief grows past a screen, move the spec into the plan file and shorten the brief.

### Repo-wide guardrails (every brief includes these)

- Don't push to Git. User pushes manually.
- Don't refactor anything outside the listed scope.
- Don't add tests unless explicitly asked.
- Don't add new documentation unless explicitly asked.
- Never commit secrets, API keys, or environment files (`.env`, `.env.local`, etc.).
- All persistence goes through `src/lib/storage.ts` (`getItem`/`setItem`/`removeItem`) — no direct `supabase.from('app_data')` calls scattered in components.
- Never commit `.env.local`.
- Don't add new Supabase tables — the app uses the single shared `app_data(key, value jsonb)` shape.
- New shared state keys go into the `catering_*` namespace to match existing keys (e.g. `catering_menu_aliases`, `catering_refrens_catalog`).

---

## Commit conventions

- Semantic prefix: `feat`, `fix`, `chore`, `docs`. Optional parenthetical scope: `feat(auth)`, `fix(dashboard)`, `chore(deps)`.
- Title under 72 chars, imperative ("add X", not "added X").
- Body explains the *why* and any deviation from spec.
- `Co-Authored-By:` trailer for AI agents is acceptable, not required.
- Always create a **new** commit on hook failure — never `--amend` unless the user explicitly asks.

---

## Verification by change type

| What changed | Run |
|---|---|
| TypeScript logic (state, utils, hooks) | `npx tsc --noEmit` |
| Route / build-config changes (`vite.config.ts`, deploy workflow) | `npx tsc --noEmit` **and** `npm run build` |
| UI behaviour | `npm run dev` + manual happy-path click-through |
| Database schema / RLS | N/A — schema changes are out of scope; the app uses one fixed `app_data` table |

---

## Context discipline

Wasted tokens directly shorten the session window. Non-negotiable:

| Rule | Why |
|---|---|
| `/clear` between unrelated tasks | Stale context costs tokens on every subsequent message |
| `/compact` at ~40% context | Auto-compact at 95% loses detail; manual at 40% is surgical |
| `@file` for surgical loading | "Read the src directory" can burn 20–30% of the window in one prompt |
| Filter terminal output (`grep`, `tail`) | Raw logs are massive token sinks |
| Save plans to `*_PLAN.md`, not memory | File reference = 1 line/message; in-context plan = N lines × every message |
| One session = one task | Context mixing kills both quality and budget |

---

## Environment variables

Secrets and environment-specific config lives in `.env.local` — **never committed**. Required keys:

```
VITE_SUPABASE_URL=
VITE_SUPABASE_ANON_KEY=
```

In production, these are injected by GitHub Actions (`.github/workflows/deploy.yml`) from repo Actions secrets — no per-device setup needed for deploy.

---

## Local development

```powershell
# Install dependencies (first time or after pulling)
npm install

# Start dev server
npm run dev

# Prod smoke test
npm run build
npm run preview
```

---

## Deployment

- **Automatic**: push to `main` triggers `.github/workflows/deploy.yml`, which builds with `npm run build` (Supabase env vars injected from repo Actions secrets) and publishes `dist/` to GitHub Pages.
- **Manual**: no manual deploy step exists or is needed.

---

## Throwaway diagnostic scripts

One-off scripts live in a `scripts/` folder at root (create if needed, underscore prefix marks throwaway: `_name.ts` / `_name.py`). They:

- Load environment variables from `.env.local` (or equivalent).
- Are **deleted after use**. Never committed.
- Run with the project's script runner (e.g. `npx tsx scripts/_name.ts`, `python scripts/_name.py`).

---

## Shell commands given to the user

When handing the user a shell command to run:

- **Prepend the directory** when the command is path-dependent — lead with `cd <project-root>`. Don't assume the user's current folder.
- **Say whether the shell is normal or elevated (Administrator/sudo).** Assume normal by default; flag elevation only when genuinely required.

---

## Communication cadence

- **Implementer report format:** `Commit X.Y done: <SHA> — <commit message>. <one or two lines>.` Nothing else needed.
- **Planner review reply:** `Approved.` + optional non-blocking notes + the next phase's brief. Or `Send back: <reason>` with a corrective ask.
- **No summaries unless requested.** No commit-message tables in chat. No pre-narration ("Now let me...", "Let me check..."). State the verdict and the next step.

---

## Output and style rules

- Default to brevity. Expand only when the user asks for detail.
- No "summary of what changed" tables at the end of commits unless asked.
- No restating what's in the diff after committing.
- One short paragraph after a change is usually enough.

If a chat reply would exceed a screen and isn't reference material the user explicitly asked for, it's too long.
