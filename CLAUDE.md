# CLAUDE.md — technical conventions

> # ⛔ #1 WORKFLOW RULE — READ FIRST, NEVER BREAK
>
> **Opus NEVER implements. Opus plans, reviews, and dispatches Sonnet.**
>
> If you are an Opus model (or any "planner"/lead agent), you do **NOT** write feature code, edit components/hooks/flows, do multi-file edits, or fix bugs longer than one line — no matter how small or urgent the change looks.
>
> Instead: investigate (read-only) → lock decisions → write a Sonnet brief (DOX chain to read + exact files/edits + "verify + report") → dispatch a Sonnet subagent (`Agent` tool, `model: "sonnet"`) → review the diff.
>
> **Two exceptions only:** (1) the user explicitly writes down authorization for Opus to implement a specific thing this session; (2) a single literal one-line fix (typo/token/import) with zero ambiguity. A dispatched Sonnet must never spawn its own subagents. Full text: `AGENTS.md` and `general_workflow.md` §1.

Read this file second, after `general_workflow.md` (process) and the DOX chain (`AGENTS.md`).

---

## Architecture

Vite + React 19 + TypeScript SPA (single page, tabbed UI in `src/App.tsx`: Active Batch Processor, Total Cost Calculator, Order Checker). All shared/persistent state is stored in Supabase's single `app_data(key text pk, value jsonb, updated_at)` table via the helpers in `src/lib/storage.ts` (`getItem`/`setItem`/`removeItem`) — never call `supabase.from('app_data')` directly from components. Auth is Supabase email/password, gated by `src/components/AuthGate.tsx`. The app deploys as a static build to GitHub Pages on every push to `main`.

## Key source paths

- `src/App.tsx` — tab shell, Active Batch Processor, Total Cost Calculator, Refrens catalog-sync panel.
- `src/components/AuthGate.tsx` — Supabase auth gate.
- `src/components/OrderChecker.tsx` — Order Checker tab.
- `src/lib/storage.ts` — persistence layer (all reads/writes to `app_data` go through here).
- `src/lib/supabase.ts` — Supabase client init.
- `src/utils/menuMatching.ts` — alias + fuzzy canonical-name matching for menu items.
- `src/utils/orderComparison.ts` — order-vs-menu comparison logic.
- `src/utils/csvParser.ts` — CSV parsing.
- `src/utils/dateUtils.ts` — date/month-key helpers.
- `src/utils/cn.ts` — classname helper.
- `.github/workflows/deploy.yml` — build + deploy pipeline (GitHub Pages).

## Verification commands

- `npx tsc --noEmit` — typecheck (no `typecheck` script exists in `package.json`).
- `npm run build` — full Vite production build; run for route/build-config changes.
- `npm run dev` — dev server, default port 5173.
- `npm run preview` — serve the production build locally for smoke-testing.

## Conventions

Terse, title-only commit messages, no body, no `Co-Authored-By` trailer unless asked. Never `git add -A` — stage explicit paths. Push only when the user says so that turn. Stay in scope: don't refactor adjacent code, add tests, or add docs unless asked; if a fix risks touching more than 3 files, propose the approach first. Full detail: `setup.md` §7 and `general_workflow.md`.

## Model selection

Sonnet is the default for all implementation, exploration, and iterative bug-fixing. Reserve Opus for (a) architectural planning of multi-file work, or (b) reviewing security-critical or architecturally-risky changes — never for codebase exploration or open-ended spelunking. When Opus is used, pre-load all context (research summary, constraints, acceptance criteria) in one message rather than discovering interactively. See `setup.md` §5.

## PowerShell gotchas

- Every command may echo a harmless `cd : Cannot find path ...\Happiness_in_a_Bowl\Happiness_in_a_Bowl` error because the shell is already in the project directory — ignore it; the real command still runs.
- Multi-line commit messages: PowerShell here-strings + inline `;` chaining mangle `-m`. Write the message to a temp file and use `git commit -F <file>`.
- Git push auth: the remote has no stored token. Push using the user-env token `HIAB_GIT` inline, and scrub it from any echoed output:
  ```powershell
  $t=[System.Environment]::GetEnvironmentVariable('HIAB_GIT','User'); git push "https://$t@github.com/kennymourat9613/Happiness_in_a_Bowl.git" main 2>&1 | ForEach-Object { $_ -replace [regex]::Escape($t),'***' }
  ```
