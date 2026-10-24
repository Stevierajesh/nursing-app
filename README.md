# Nurse Worry Layer — Nurse App

Mobile-web PWA. The one-tap "I'm worried" signal.

Vite + React 19 + TypeScript + Tailwind v4, installable to a phone home screen
via `vite-plugin-pwa`. Not React Native and not Next.js: this is a fully
authenticated internal tool, so SSR buys nothing while costing the Supabase
cookie dance, and a PWA gets you a home-screen icon without a build pipeline.

## Running it

```bash
make dev        # http://localhost:5173, foreground
make start      # background
make stop
make help       # all targets
```

**The API must already be running on :5001.** `make dev` checks and warns you
if it is not — start it with `cd ../nursing-backend && make start`.

Port is pinned with `strictPort`, so a clash fails loudly rather than drifting
to 5174 and falling outside the API's CORS allowlist.

Fresh clone:

```bash
make install    # npm install + creates .env.local from the example
```
Then fill in `VITE_SUPABASE_ANON_KEY`.

## Sign in

**Password for every account: `WorryLayer!2026`**

| Email | Name | Assigned patients |
|---|---|---|
| `maria@mercygeneral.example` | Maria Santos | Robert Ellis (412), Yolanda Price (408), Mei-Ling Chen (403) |
| `james@mercygeneral.example` | James Okonkwo | Henry Okafor (415), Carlos Represa (410) |
| `lin@mercygeneral.example` | Lin Zhao | Dorothy Whitfield (601), Aisha Rahman (604), Frank Delacroix (607) |

Use **Maria** for the demo — Robert Ellis is the hero case (NEWS 4, drifting)
and Yolanda Price is the stable counter-example.

`charge@` and `admin@` can sign in here too, but they belong on the dashboard
at :5174. A nurse signing into the dashboard is redirected back here.

A nurse sees **only** patients they are assigned to on an open shift. That is
enforced at the API and again by RLS in Postgres, so Maria genuinely cannot
read Henry Okafor.

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
make build        # ~491 kB raw / ~142 kB gzipped
make check        # typecheck + lint + build
```
