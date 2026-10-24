# Nurse Worry Layer — Nurse App

Mobile-web PWA. The one-tap "I'm worried" signal.

Vite + React 19 + TypeScript + Tailwind v4, installable to a phone home screen
via `vite-plugin-pwa`. Not React Native and not Next.js: this is a fully
authenticated internal tool, so SSR buys nothing while costing the Supabase
cookie dance, and a PWA gets you a home-screen icon without a build pipeline.

## Setup

```bash
npm install
cp .env.example .env.local   # fill in the Supabase URL and ANON key
npm run dev                  # http://localhost:5173
```

The backend must be running on `:5001` (or set `VITE_API_URL`).

## Screens

| Route | Purpose |
|---|---|
| `/` | My patients — assigned patients, worry flags, risk bars |
| `/worry/:patientId` | The tap: level, optional quick-pick reasons, optional note |

## Design constraints on the tap screen

1. Selecting a level submits nothing. A nurse who taps the wrong level can
   correct it without having already paged someone.
2. Reasons and notes are optional. The flow completes in about two seconds for
   a nurse who has nothing to add beyond "something is off".
3. Capture time is measured and sent as `capture_ms`. "Will nurses actually use
   it?" is answerable with a median, and that only works if it is instrumented.
4. The confirmation screen says plainly when nothing escalated, and shows the
   score breakdown. Silently swallowing a nurse's signal is how trust in these
   systems dies.

## Why the env guard looks odd

`src/lib/supabase.ts` spreads `import.meta.env` into a plain object rather than
reading it directly. Vite inlines `import.meta.env.VITE_*` as build-time
literals, so a guard derived from them folds to a constant and the minifier
dead-code-eliminates the entire app behind it — producing a bundle with React
and nothing else, while still reporting a successful build. The spread defeats
that folding. Don't remove it.

## Build

```bash
npm run build     # ~491 kB raw / ~142 kB gzipped
```
