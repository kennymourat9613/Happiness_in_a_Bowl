# Setup Guide

How to run and develop this project on a new device.

## Stack
- Vite + React 19 + TypeScript + Tailwind CSS
- Supabase backend (hosted Postgres + Auth) — client code in `src/lib/`
- Deployed to GitHub Pages via `.github/workflows/deploy.yml` (auto-deploys on push to `main`)

## 1. Clone
```
git clone https://github.com/kennymourat9613/Happiness_in_a_Bowl.git
cd Happiness_in_a_Bowl
```

## 2. Install Node + dependencies
Install the Node.js LTS from https://nodejs.org, then:
```
npm install
```

## 3. Create `.env.local`
This file is gitignored, so it is **not** included in the clone. Without it, local dev/build has no Supabase config and the app will not connect. Create `.env.local` in the project root:
```
VITE_SUPABASE_URL=<your Supabase project URL>
VITE_SUPABASE_ANON_KEY=<your Supabase anon/publishable key>
```
Get both values from the Supabase dashboard: **Settings → Data API** (Project URL) and **Settings → API Keys** (the `anon` / publishable key — never the `service_role`/secret key). The publishable key is safe in the browser; data is protected by Row Level Security + login.

## 4. Run locally
```
npm run dev          # dev server (unminified)
npm run build        # production build into dist/
npm run preview      # serve the production build locally
```
Note: some bugs only appear in the minified production build. Test data-dependent changes with `npm run build` + `npm run preview` (logged in) before pushing.

## 5. Auth & deploy
- **Pushing:** authenticate git with a GitHub token (set as the `HIAB_GIT` env var) or the `gh` CLI / a git credential manager.
- **Deploying:** pushing to `main` triggers the GitHub Pages deploy automatically. The build reads `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` from **repo Settings → Secrets and variables → Actions** — already configured server-side, no per-device setup needed.

## Login accounts
The app is login-gated (no public signup). Create accounts in the Supabase dashboard: **Authentication → Users → Add user**.

## Database
A single shared table `app_data(key text pk, value jsonb, updated_at timestamptz)` with Row Level Security allowing read/write to authenticated users only. See the storage layer in `src/lib/storage.ts`.
