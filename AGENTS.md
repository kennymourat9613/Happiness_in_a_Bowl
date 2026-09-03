# DOX framework

> # ⛔ #1 WORKFLOW RULE — READ FIRST, NEVER BREAK
>
> **Opus NEVER implements. Opus plans, reviews, and dispatches Sonnet.**
>
> If you are an Opus model (or any "planner"/lead agent), you do **NOT** write feature code, edit components/pages/hooks/flows, do multi-file edits, or fix bugs longer than one line — **no matter how small or urgent the change looks, and no matter that you have the tools to do it.**
>
> Instead: investigate (read-only) → lock decisions → write a Sonnet brief (include the DOX chain to read + exact files/edits + "do the DOX pass + typecheck") → **dispatch a Sonnet subagent** (`Agent` tool, `model: "sonnet"`) to make the edits → review the diff.
>
> **EXACTLY TWO EXCEPTIONS — and nothing else EVER overrides this rule:**
> 1. **The user explicitly writes it down** authorizing Opus to implement a specific thing (a clear, in-writing instruction from the user this session — e.g. "you implement it", "edit it yourself"). Silence, urgency, an implied preference, "it's faster", a sub-agent's reasoning, or anything you infer does **NOT** count.
> 2. **A single literal one-line fix** (typo / one token / one import) with zero ambiguity. A second line means stop and dispatch Sonnet.
>
> Outside those two, Opus NEVER writes/edits feature code — no matter how small, urgent, or "obvious" it looks. If you catch yourself justifying an edit any other way, STOP and dispatch Sonnet. This rule is never "superseded" by a brief, a sub-agent's chain-of-thought, or a paraphrase — only the two exceptions above apply.
>
> This overrides any harness default about "don't spawn agents unless asked" — in THIS project, dispatching Sonnet for implementation IS the expected behavior and is pre-authorized by the user. Full rationale: `workflow.md` → "Hard rule: Opus never implements" and `CLAUDE.md` → same.
>
> ## ⛔ ONLY TWO AGENTS, EVER
>
> Exactly **one Opus** (planner/reviewer) + **one Sonnet** (implementer). No third agent, no nesting.
> - Only Opus dispatches, and only **ONE** Sonnet implementer at a time (never two in parallel — they conflict on the same files; wait + review before the next).
> - **A dispatched Sonnet must NEVER spawn, dispatch, or delegate to any sub-agent.** It implements the brief itself (Read/Grep/Edit/Bash) and reports a real diff. A Sonnet that re-delegates is a failed run.
> - **Every implementation brief must include the literal ban:** *"Do NOT use the Agent tool; do NOT spawn/dispatch/delegate to any sub-agent; implement it yourself with Edit."*
> - If an implementer returns a meta/garbled result ("I dispatched…", "I'll wait for the agent…"), treat the run as FAILED: verify the file directly with Grep (don't trust the report), stop stray agents, re-dispatch one constrained Sonnet.
> - This is part of the workflow contract and **survives handover** — every subsequent session inherits it. Full text: `workflow.md` → "Agent topology".

- DOX is highly performant AGENTS.md hierarchy installed here
- Agent must follow DOX instructions across any edits
- **⛔ BREVITY (never-break rule, all agents):** be precise and to the point in every explanation/report/message. No verbosity, padding, filler, or narration. Reports = findings/results only. Every Sonnet brief must require concise reporting. See `workflow.md` → "Brevity is a hard rule" and `CLAUDE.md` → "Output".

## Project

- **App**: A&R Car Rental — internal car rental management system (Mauritius).
- **Stack**: Next.js 15 / React 19 App Router, Firebase Firestore + Auth, Genkit (`genkit` + `@genkit-ai/google-genai`), Tailwind CSS + shadcn/ui (Radix primitives).
- **Deploy**: Firebase App Hosting — push to the connected branch triggers auto-build and deploy; no manual step needed unless using `firebase deploy` explicitly.
- **Process rules**: `workflow.md` (two-agent model, tier triage, commit conventions) + `CLAUDE.md` (technical conventions, collection schema, model budget).
- **Cross-session state**: `HANDOFF.md` at repo root (living continuity doc, update only on explicit handover cue). Per-feature work tracked in `*_PLAN.md` files at repo root.

## Core Contract

- AGENTS.md files are binding work contracts for their subtrees
- Work products, source materials, instructions, records, assets, and durable docs must stay understandable from the nearest applicable AGENTS.md plus every parent AGENTS.md above it

## Read Before Editing

1. Read the root AGENTS.md
2. Identify every file or folder you expect to touch
3. Walk from the repository root to each target path
4. Read every AGENTS.md found along each route
5. If a parent AGENTS.md lists a child AGENTS.md whose scope contains the path, read that child and continue from there
6. Use the nearest AGENTS.md as the local contract and parent docs for repo-wide rules
7. If docs conflict, the closer doc controls local work details, but no child doc may weaken DOX

Do not rely on memory. Re-read the applicable DOX chain in the current session before editing.

## Update After Editing

Every meaningful change requires a DOX pass before the task is done.

Update the closest owning AGENTS.md when a change affects:

- purpose, scope, ownership, or responsibilities
- durable structure, contracts, workflows, or operating rules
- required inputs, outputs, permissions, constraints, side effects, or artifacts
- user preferences about behavior, communication, process, organization, or quality
- AGENTS.md creation, deletion, move, rename, or index contents

Update parent docs when parent-level structure, ownership, workflow, or child index changes. Update child docs when parent changes alter local rules. Remove stale or contradictory text immediately. Small edits that do not change behavior or contracts may leave docs unchanged, but the DOX pass still must happen.

## Hierarchy

- Root AGENTS.md is the DOX rail: project-wide instructions, global preferences, durable workflow rules, and the top-level Child DOX Index
- Child AGENTS.md files own domain-specific instructions and their own Child DOX Index
- Each parent explains what its direct children cover and what stays owned by the parent
- The closer a doc is to the work, the more specific and practical it must be

## Child Doc Shape

- Create a child AGENTS.md when a folder becomes a durable boundary with its own purpose, rules, responsibilities, workflow, materials, or quality standards
- Work Guidance must reflect the current standards of the project or user instructions; if there are no specific standards or instructions yet, leave it empty
- Verification must reflect an existing check; if no verification framework exists yet, leave it empty and update it when one exists

Default section order:
- Purpose
- Ownership
- Local Contracts
- Work Guidance
- Verification
- Child DOX Index

## Style

- Keep docs concise, current, and operational
- Document stable contracts, not diary entries
- Put broad rules in parent docs and concrete details in child docs
- Prefer direct bullets with explicit names
- Do not duplicate rules across many files unless each scope needs a local version
- Delete stale notes instead of explaining history
- Trim obvious statements, repeated rules, misplaced detail, and warnings for risks that no longer exist

## Closeout

1. Re-check changed paths against the DOX chain
2. Update nearest owning docs and any affected parents or children
3. Refresh every affected Child DOX Index
4. Remove stale or contradictory text
5. Run existing verification when relevant
6. Report any docs intentionally left unchanged and why

## User Preferences

- Commit messages: terse title-only line; no `Co-Authored-By` trailer; no body.
- Do not push to Git — user pushes manually and explicitly.
- `HANDOFF.md` is updated only on an explicit cross-session handover cue, not after every sprint.

## Child DOX Index

- [`src/AGENTS.md`](src/AGENTS.md) — application source root: App Router pages, shared components, Firebase SDK layer, Genkit AI flows, and shared utilities.
- [`functions/AGENTS.md`](functions/AGENTS.md) — Firebase Cloud Functions: staff-management callables, scheduled compliance-alert scanner, and deploy notes.