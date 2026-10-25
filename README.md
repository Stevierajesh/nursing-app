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
| `lin@mercygeneral.example` | Lin Zhao | Dorothy Whitfield (601), Aisha Rahman (604), Frank Delacroix (607), Henry Okafor (415), Carlos Represa (410) |
| `james@mercygeneral.example` | James Okonkwo | **Doctor** — no patients; signs in to the approval queue |

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

## Five-level worry scale and risk display

Worry levels are `0=Not worried`, `1=Slightly`, `2=Somewhat`, `3=Worried`,
`4=Very worried`. Intensity contributes proportionally to fused risk. Levels
1–3 require both elevated NEWS and an upward trend to escalate; level 4 can
pair with either. High NEWS still escalates independently of worry.

The API retains its internal 0–100 risk score. The nurse app displays
`clamp(round(score / 10), 1, 10)` with PDF bands: 1–3 low, 4–5 watch,
6–7 elevated, 8–10 high. NEWS is shown separately on its original scale.

The pending migrations and deployment order are listed below. Migration 007
preserves historical “Very worried” records by moving the old value 2 to 4.

## Mobile workflow

The default page is the unit map (`/`); `/map` redirects there. Board lives at
`/board`. The map shows room/bed occupancy and risk for patients the user can
access. Unassigned occupied beds show occupancy without patient identity.

Navigation opens Board, Patients, Map, Meds, and Alerts. The Board has
inline worry capture and a priority list. Patients supports risk, worry, and
natural bed sorting. Data refreshes every 30 seconds and after mutations.

## Phone, tablet and desktop

One shell, `src/components/AppShell.tsx`, serves both roles at every size.

**Two breakpoints, and the difference between them matters.**

`desk` — defined in `index.css` as `(min-width: 64rem) and (pointer: fine)` —
gates **chrome**: the nav, the brand bar, the content measure, the map panel's
bottom clearance. It is deliberately not `lg`. An iPad in landscape is exactly
1024px, which *is* `lg`, and the 12.9" Pro is 1366px — wider than plenty of
laptops — so width alone put a desktop sidebar on the tablet, where the bottom
pill is the whole point: it sits under the thumb of whoever is holding it.
`pointer: fine` is the honest discriminator. iPadOS reports `coarse` even with
a Magic Keyboard attached; a laptop reports `fine` even when its screen is a
touchscreen.

Plain `lg:` gates **content**: the two-column layouts inside a screen. Whether
two columns fit is a question about width and nothing else, and the tablet has
the width — so the iPad keeps the side-by-side Risk board, worry capture and
Respond.

So: touch devices of any size keep the nurse's floating pill and the doctor's
strip from doc pages 22–26, unchanged. A pointer-driven screen at 1024px or
wider gets a persistent left sidebar carrying the mark, role chip, the five
destinations and the account control, with the brand bar hidden — a pill
centred under a 1512px window is phone chrome stranded on a workstation, and it
floated over the last row of Patients, Meds and Alerts. Content is capped at
`max-w-7xl` and centred; uncapped, the patients table stretched its columns to
the window edge.

**Testing this:** DevTools "Responsive" mode with no device selected reports
`pointer: fine`, so you will get the sidebar at ≥1024px. Pick an actual iPad
preset, or use a real device, to see the tablet layout.

Assigned nurses, charge nurses, and admins can acknowledge and assess an
escalation from Alerts or Respond. Timestamps are server-written and retries
preserve the original assessment. Only charge nurses and admins can edit bed
assignments or add inventory; duplicate active occupancy is rejected by Postgres.

Meds supports blood pressure, blood sugar, and heart rate review requests.
A nurse chooses a patient and prescriber, writes a reason, and sends the request
to the prescriber's in-app queue. Only the assigned prescriber can complete it;
the response returns to the nurse's request list. Requests may be dismissed
with a reason. This workflow records reviews, not medication orders.

An administrator can set the `prescriber` role through dashboard Admin. Future
Python seed runs create `prescriber@mercygeneral.example`; existing live users
are not changed automatically. Never re-run the destructive seed just to add a
prescriber. Assign the role to an appropriate existing user or create a user
through the admin API.

In the live demo org, **James Okonkwo (`james@mercygeneral.example`) is the
prescriber** — promoted from nurse, with his two patients reassigned to Lin
Zhao first so neither was left uncovered.

## Migration status

**All 15 migrations are applied to the live Supabase database**, through
`20261024001500_continuous_simulation.sql`, and all 15 are recorded in `_migrations`.

- 007: five worry levels and historical Very worried preservation.
- 008: patient bed identifiers.
- 009: prescriber role (must commit before migration 010).
- 010: unit bed inventory, demo bed population, unique active bed occupancy,
  glucose observations, medication reviews, and RLS policies.
- 011: patient simulation runs.
- 012: diagnosis, allergies, and the medication-class vocabulary.
- 013: doctor mode — nurse notes, patient history, pain score, and the
  medication approval states and escalation clock.
- 014: "request more info from nurse" on the approval review.
- 015: continuous simulation — runs no longer self-complete at their duration.

Do not re-run the initial migrations or reset demo data. Migration 010
populates known synthetic `mercy-general` bed assignments without resetting
patients; it leaves other organizations' locations untouched.

Note that applied version IDs in the Supabase-side ledger do not match these
local filenames — `supabase/migrations/` and `_migrations` are two separate
records of the same thing. Check both before applying anything.

Remaining work:

- Doctor Patients / Map / Meds still fall back to the nurse screens; doc pages
  23–25 specify a table, a distance panel, and condition tabs.
- A display band for high blood pressure and fever. NEWS2 scores neither, so
  those cards currently show no badge at all.
- Remaining typography, spacing, and detailed visual matching to the PDF.
- Historical-worry escalation and duplicate-escalation feedback issues from the audit.
- External notifications and EHR medication ordering, if those integrations are wanted later.

### Patient priority and combined score

Patient priority uses NEWS warnings and unresolved escalations ahead of the
weighted combined score. Open, acknowledged, and overdue escalations remain red
until assessment or resolution; NEWS totals of 7 or more also display red.
NEWS 5–6 and an individual parameter scoring 3 display an urgent review warning.
The backend supplies individual parameter triggers through `news_alert`, using
its existing NEWS scoring table. Threshold reference:
[RCP NEWS2 Chart 2](https://www.rcplondon.ac.uk/media/2acdezkd/news2-chart-2_news-thresholds-and-triggers_0.pdf).

The weighted combined score remains separately labeled on its 1–10 display scale.
Acknowledging an escalation keeps its red priority visible. Existing escalation
creation rules and persisted model scores retain their current behavior.
Run `npm run test:risk` for priority regression tests (Node 22.6+).
