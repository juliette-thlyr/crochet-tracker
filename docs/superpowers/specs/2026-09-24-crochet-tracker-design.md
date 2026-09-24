# Crochet Tracker — Design

Date: 2026-09-24
Status: Approved

## Purpose

A personal web app to track crochet projects and yarn inventory. It runs on phone and PC with the same data, for a single user.

Core ideas:

- **Patterns** are reusable templates (e.g. "T-rex", "Bag A"). Starting a project from a pattern copies its parts.
- **Projects** are split into **parts** (head, body, leg 1…). Each part tracks time spent, yarn used and the row you stopped at.
- **Stash** quantities are computed from what projects use and plan to use, never edited by hand.

## Success criteria

1. Starting a project from a pattern takes two taps and creates all its parts.
2. The timer survives closing the app and switching device.
3. Stash shows correct owned / used / reserved / free counts after any edit or delete.
4. A pattern page shows how many times it was made, average time and average skeins.
5. The app installs to a phone home screen and works in a desktop browser.
6. After a break, the project page shows which row each part stopped at.
7. The Patterns list can be filtered by pattern type in one tap.

## Scope

**Phase 1 (this spec's build):** everything below except PDF extraction. Patterns are entered by form; a PDF can be attached for viewing.

**Phase 2:** "Fill from PDF" — Claude reads an uploaded pattern PDF and pre-fills the pattern form (see Phase 2 section).

**Out of scope:** offline mode, multiple users or sharing, grams/length units, shopping lists.

## Data model

All tables have `id` (uuid), `user_id` (uuid, references `auth.users`), `created_at`, `updated_at`. Row-level security on every table: a user can read and write only rows where `user_id = auth.uid()`.

Hook sizes are stored in millimetres as `numeric(3,1)` with the check `hook_size_mm between 1.0 and 12.0 and hook_size_mm * 2 = floor(hook_size_mm * 2)` (1.0, 1.5, … 12.0 — 23 values).

Quantities of yarn are in **skeins**, stored as `numeric(6,2)` (e.g. 0.25).

### patterns
| Column | Type | Notes |
|---|---|---|
| name | text, required | "T-rex" |
| designer | text | |
| url | text | link to the pattern |
| hook_size_mm | numeric(3,1), nullable | **recommended** hook for the pattern; 1.0–12.0 in 0.5 steps |
| yarn_weight | yarn_weight enum | |
| notes | text | |
| pdf_path | text | path in `pattern-pdfs` bucket |
| pattern_type_id | uuid, nullable | `on delete set null`; a pattern has at most one type |

### pattern_types
| Column | Type | Notes |
|---|---|---|
| name | text, required | "Amigurumi"; unique per user |
| position | int, required | order of the filter chips |

Every new user starts with six types: Amigurumi, Clothes, Accessories, Bag, Home, Baby (inserted by a trigger on `auth.users`). The user can add, rename, reorder and delete types; deleting a type leaves its patterns untyped.

### pattern_parts
| Column | Type | Notes |
|---|---|---|
| pattern_id | uuid, required | cascade delete |
| name | text, required | "Leg" |
| position | int, required | display order |
| count | int, required, ≥ 1, default 1 | "Leg ×2" |
| total_rows | int, nullable, ≥ 1 | rows in this part, if known |

### projects
| Column | Type | Notes |
|---|---|---|
| name | text, required | |
| pattern_id | uuid, nullable | `on delete set null`; blank projects have none |
| status | enum `idea`, `in_progress`, `finished`, `frogged` | default `idea` |
| start_date | date | |
| finish_date | date | set to today when status becomes `finished` and it is empty |
| hook_size_mm | numeric(3,1), nullable | hook **used** for this project; copied from the pattern at start, then editable; 1.0–12.0 in 0.5 steps |
| notes | text | |

### project_photos
`project_id` (cascade), `path` (in `project-photos` bucket), `caption`, `taken_on` (date).

### parts
| Column | Type | Notes |
|---|---|---|
| project_id | uuid, required | cascade delete |
| name | text, required | |
| position | int, required | display order |
| done | bool, default false | ticked by the user; never set automatically |
| current_row | int, nullable, ≥ 0 | last row completed; null until counting starts |
| total_rows | int, nullable, ≥ 1 | copied from the pattern part |
| resume_note | text | where exactly you stopped |
| notes | text | |

A project created blank gets one part named "Main", so every new project has somewhere to count rows.

### time_sessions
| Column | Type | Notes |
|---|---|---|
| part_id | uuid, required | cascade delete |
| started_at | timestamptz, required | |
| ended_at | timestamptz, nullable | null = timer running; must be > `started_at` |

A unique partial index on `user_id where ended_at is null` guarantees at most one running timer per user.

A manual entry is a start date/time plus a duration; the app stores `ended_at = started_at + duration`.

### yarns
| Column | Type | Notes |
|---|---|---|
| brand | text | |
| name | text, required | |
| color | text | |
| yarn_weight | yarn_weight enum | |
| fiber | text | "100% cotton" |
| skeins_owned | numeric, required, ≥ 0 | |
| photo_path | text | in `yarn-photos` bucket |
| bought_at | text | shop name |
| price_per_skein | numeric | displayed in euros |
| bought_on | date | |
| notes | text | |

`yarn_weight` enum: `lace`, `fingering`, `sport`, `dk`, `worsted`, `aran`, `bulky`, `super_bulky`, `jumbo`.

### part_yarns
`part_id` (cascade), `yarn_id` (`on delete restrict`), `skeins_used` (≥ 0). Unique on (`part_id`, `yarn_id`).

### project_yarns
`project_id` (cascade), `yarn_id` (`on delete restrict`), `skeins_planned` (≥ 0). Unique on (`project_id`, `yarn_id`). Optional: a project without plans reserves nothing.

### Computed: `yarn_stock` view
Per yarn:

- **used** = sum of `part_yarns.skeins_used` for parts of projects whose status is not `frogged`. Frogging a project returns its yarn to the stash.
- **reserved** = for each project in `idea` or `in_progress`: `max(skeins_planned − skeins used by that project for that yarn, 0)`, summed.
- **free** = `skeins_owned − used − reserved`. May be negative; the UI shows it as a warning ("more used than owned").

The view uses `security_invoker = true` so row-level security applies.

### Computed: rollups
- Part time = sum of its closed sessions, plus elapsed time of a running one.
- Project time and skeins = sums over its parts.
- Pattern stats, over its `finished` projects only: times made, average time, average skeins.

### Database function: `start_project_from_pattern(pattern_id uuid) returns uuid`
In one transaction:

1. Create a project: name = pattern name, `pattern_id`, status `in_progress`, `start_date` today, `hook_size_mm` copied from the pattern's recommended size.
2. Copy parts in order, including `total_rows`. A part with `count = 1` keeps its name; a part with `count = n > 1` becomes `n` parts named "Leg 1" … "Leg n".
3. Return the new project id.

Later edits to the project's parts or hook size never change the pattern, and changing the pattern's recommended hook never changes existing projects.

## Screens

Phone-first. Bottom tab bar: **Projects · Patterns · Stash · Timer**. A thin bar showing the running timer (part name, elapsed time, current row with **+ row**, stop) sits above the tab bar on every screen.

**Login** — email magic link.

**Projects list** — grouped by status, `in_progress` first. Card: photo, name, parts done (3/7), total time. "+ New project" opens the **New project** screen.

**New project** — search box, type filter chips, grid of patterns (tap one to start a project from it) and a **Start a blank project** button.

**Project page** — header (status, dates, **hook used** — same dropdown as the pattern form, shown as "hook 4.0 mm (pattern: 3.5 mm)" when it differs from the pattern's recommendation; link to pattern); parts list with ▶ start timer, ✓ done and "Row 12/18" per part; add, rename, reorder, delete parts; yarn summary per yarn (planned vs used) with "plan yarn" action; photos; notes.

**Part page** — row counter (large number with − and +, tap to type; shows "/ total" when `total_rows` is set) and resume note; time sessions (list, add manual, edit, delete); yarn used (pick a stash yarn, enter skeins).

**Patterns list** — type filter chips ("All · 5", "Amigurumi · 2"…, one selected at a time; chips for types with no patterns are hidden), then cards: name, type label, parts / weight / hook, stats (made N×, average time, average skeins).

**Pattern page** — details, template parts, embedded PDF viewer, **Start project** button.

**Pattern form** — name, type (chips; tap the selected one again to clear; "+ New type"), designer, link, **recommended hook** (dropdown: "—", 1.0 mm … 12.0 mm in 0.5 mm steps), weight, notes, parts with ×count and optional rows, attach PDF. Phase 2 adds "Fill from PDF".

**Stash** — grid of yarn cards (photo, name, color, free / owned). Filters: weight, fiber. Badge "low" when 0 < free < 1, "out" when free ≤ 0.

**Yarn page** — details, purchase info, and projects that use or reserve it.

**Timer tab** — the running part with a large stop button and its row counter with a big **+ row** button; when idle, the five most recently timed parts, each with ▶.

### Timer rules
- Starting a timer while another runs stops the running one first.
- The start time lives in the database, so the timer continues across app restarts and devices.
- A forgotten timer is fixed by editing its session.

### Row counter rules
- The counter never goes below 0.
- It may exceed `total_rows` (patterns are sometimes adjusted); the display then shows e.g. "Row 20/18".
- Reaching `total_rows` does not tick ✓ done.

## Visual design

The approved mockup is the reference for layout: https://claude.ai/artifact/XwxHQ2Qk3YJK54R1mTSrwJ (10 phone screens plus the shared timer bar and tab bar).

**Font:** Indie Flower (Google Fonts) for all text, titles included; single weight, sizes as in the mockup (base 16 px).

**Colors:**

| Token | Hex | Use |
|---|---|---|
| background | `#E4EEF9` | page background (pastel blue) |
| surface | `#FFFFFF` | cards, lists, tab bar |
| border | `#D3E0EE` | card borders; dividers `#E6EEF7` |
| ink | `#2B1E2F` | main text |
| muted | `#6E5C6B` | secondary text |
| projects | `#B8336A` (dark `#85204A`, soft `#FBE3EC`) | Projects tab and its screens |
| patterns | `#6D4BC3` (dark `#4F3A8F`, soft `#E9E2FA`) | Patterns tab and its screens |
| stash | `#0E7C7B` (dark `#0B5B5A`, soft `#D5F0EC`) | Stash tab and its screens; "done" ticks and progress bars everywhere |
| timer | `#4169E1` (darker `#3457C8`, `#2A48B0`) | timer bar, Timer screen card, Timer tab |
| row button | `#7DB8F2` with text `#0A2A52` | **+ row** buttons |
| highlight | `#F6B93B` | Stop button on the Timer screen, "Low" badge, progress track `#FDEFC8` |

White text is used only on the four tab colors and `#2A48B0`/`#3457C8`; every text/background pair meets 4.5:1 contrast.

**Tab icons** (24 px outline, 1.8 px stroke): Projects = four-square grid, Patterns = crochet hook, Stash = yarn ball, Timer = hourglass. The active tab uses its tab color; inactive tabs use muted.

## Architecture

**Frontend:** Vite + React + TypeScript, React Router, TanStack Query, Tailwind CSS, `vite-plugin-pwa`, `@supabase/supabase-js`.

```
src/
  lib/
    supabase.ts      client setup
    calc.ts          pure functions: durations, rollups, part expansion, stock badges, row labels
    images.ts        client-side photo resizing
  features/
    auth/
    projects/
    patterns/
    stash/
    timer/
  components/        shared UI (tab bar, timer bar, forms, confirm dialog)
supabase/
  migrations/        schema, RLS, view, function, buckets
  tests/             database tests
```

Each feature folder holds its screens, its data hooks (queries and mutations) and its tests.

**Supabase:** Postgres, Auth (magic link), Storage with three private buckets — `pattern-pdfs`, `project-photos`, `yarn-photos` — each with objects under `<user_id>/…` and storage policies restricting access to that folder.

**Hosting:** Netlify free tier for the frontend; Supabase free tier for the backend. Environment variables: `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`.

## Error handling

- **No connection:** failed requests show a message with a retry button. Phase 1 requires internet.
- **Validation:** skeins ≥ 0; `ended_at > started_at`; name required on patterns, projects, parts, yarns; pattern part count ≥ 1; `current_row` ≥ 0; `total_rows` ≥ 1; hook size from the dropdown only (1.0–12.0, step 0.5). Checked in the form and enforced by database constraints.
- **Second running timer:** prevented by the unique index; the app stops the current one before starting another.
- **Photos:** resized on the device to a maximum of 1600 px on the long edge, JPEG quality 0.8, before upload.
- **PDFs:** maximum 20 MB.
- **Deletes:** always confirmed. Deleting a yarn used or planned by any project is blocked with a message suggesting setting owned to 0. Deleting a pattern keeps its projects.

## Testing

Test-driven development throughout.

- **Unit (Vitest):** everything in `calc.ts` — durations with running sessions, rollups, part expansion names, stock badges, row counter (no decrement below 0, "Row x/y" label), hook sizes (`hookSizeOptions()` returns the 23 values 1.0…12.0, `formatHook(3.5)` → "3.5 mm", `formatHook(null)` → "—", `hookLabel(project 4.0, pattern 3.5)` → "hook 4.0 mm (pattern: 3.5 mm)", same sizes → "hook 3.5 mm").
- **Component (React Testing Library):** pattern form (parts with count and rows, type chips), pattern type filter, yarn usage entry, manual session entry, row counter.
- **Database:** against a separate Supabase **test** project, never the real one — `yarn_stock` (used, reserved, free, frogged returns yarn), `start_project_from_pattern` (expansion, order, `total_rows` copied, atomicity), blank project gets a "Main" part, new user gets the six default pattern types, one-running-timer index, and RLS (a second user sees nothing).
- **End-to-end (Playwright):** log in, create pattern, start project from it, time a part, record yarn, check the stash numbers.

## Phase 2: Fill from PDF

- A Supabase Edge Function `extract-pattern` receives the storage path of an uploaded PDF, sends the PDF to the Claude API, and returns JSON: `name`, `designer`, `hook_size_mm` (rounded to the nearest 0.5; null if outside 1.0–12.0), `yarn_weight`, `parts[]` (`name`, `count`, `total_rows`).
- The app fills the pattern form with the result; the user reviews and saves. Nothing is saved automatically.
- The Anthropic API key is stored as an Edge Function secret, never in the frontend.
- On failure or empty result, the form stays as it was and shows "Couldn't read this PDF — please fill it in manually."
