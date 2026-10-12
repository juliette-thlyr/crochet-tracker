# Crochet Tracker — Phase 1.2 Design

Date: 2026-10-12
Status: Draft, pending user review
Builds on: the Phase 1 spec (`2026-09-24-crochet-tracker-design.md`) and the Phase 1.1 spec (`2026-10-08-crochet-tracker-phase-1-1-design.md`). Everything in them still applies unless this document changes it.

Already shipped before this phase (Part A of the same feedback): form fields stay at ≥ 16px so the iPhone doesn't zoom in on tap, and the pdf.js worker is published as `.js` so Safari can load it.

## Purpose

Changes requested after the first real use of Phase 1.1:

1. **Suggestions** in the yarn form for Brand, Name and Shop, from the user's own lists.
2. **Fiber** as a dropdown.
3. **Find a yarn by colour** in the Stash.
4. **Materials** on a pattern: yarn per colour with skeins, plus other materials (eyes, stuffing…).
5. **Plan stash yarns** for those colours when starting a project.
6. **Update a project** after its pattern changed.

Deleting a project needs no change: the "Delete project" button already exists at the bottom of the project page.

## Success criteria

1. After pasting `Hobbii ; Honey Bunny ; Super Bulky ; Polyester` on the Manage lists page, typing "Hob" in Brand suggests "Hobbii"; with Brand = Hobbii, Name suggests "Honey Bunny", "Baby Snuggle" and "Toucan"; picking "Honey Bunny" sets Weight to Super bulky and Fiber to Polyester when they were empty.
2. A brand, name, shop or fiber typed in the yarn form for the first time is suggested the next time.
3. Fiber is a dropdown of the user's fibers plus "Other…"; choosing Other and typing "Coton bio" saves the yarn with that fiber and adds it to the dropdown.
4. In the Stash, typing "bunny" shows only yarns whose name, brand or colour contains "bunny"; tapping the green dot shows only yarns with colour family green; both combine with the weight chips.
5. A pattern can list "Pink – 2 skeins" and "Safety eyes 10 mm × 2"; both show on the pattern page.
6. Starting a project from that pattern offers a stash yarn for the Pink line, filtered to pink yarns by default; the user can switch colour or search. Picking "Honey Bunny" creates a plan of 2 skeins of Honey Bunny on the new project.
7. After adding a part "Tail" to the pattern and renaming "Leg" to "Back leg", "Update from pattern" on an existing project lists both changes; applying them adds "Tail" and renames "Leg 1"/"Leg 2" to "Back leg 1"/"Back leg 2" without touching rows, time or yarn used.

## Scope

**In:** the six items above.

**Out:** structured fields for eyes or other materials (they stay free lines for now); syncing a project's materials or yarn plans with a later pattern change; merging two list entries; colour swatches beyond the twelve families; renaming existing yarns when a list entry is renamed.

## Data model changes

New tables follow the Phase 1 conventions: `id`, `user_id` (default `auth.uid()`, references `auth.users` on delete cascade), `created_at`, `updated_at`, row-level security "owner only", `updated_at` trigger.

### New enum: colour_family
`red, pink, orange, yellow, green, blue, purple, brown, grey, black, white, multicolour`

### New table: catalog_yarns (brand + yarn name, the "yarn list")
| Column | Type | Notes |
|---|---|---|
| brand | text not null | trimmed, non-empty |
| name | text not null | trimmed, non-empty |
| yarn_weight | yarn_weight | nullable |
| fiber | text | nullable |

Unique per user on `(lower(brand), lower(name))`.

### New table: shops
`name text not null`, unique per user on `lower(name)`.

### New table: fibers
`name text not null`, unique per user on `lower(name)`.

### New table: pattern_yarns (yarn lines of a pattern)
| Column | Type | Notes |
|---|---|---|
| pattern_id | uuid not null | references patterns on delete cascade |
| position | int not null default 0 | |
| color | text not null | e.g. "Pink"; trimmed, non-empty |
| color_family | colour_family | nullable |
| skeins | numeric(6,2) | nullable, ≥ 0 |
| yarn_type | text | nullable, e.g. "Hobbii Honey Bunny" or "cotton DK" |

### New table: pattern_materials (other materials of a pattern)
| Column | Type | Notes |
|---|---|---|
| pattern_id | uuid not null | references patterns on delete cascade |
| position | int not null default 0 | |
| name | text not null | e.g. "Safety eyes 10 mm"; trimmed, non-empty |
| quantity | numeric(6,2) | nullable, > 0 |

### Changed tables
- `yarns.color_family colour_family` — new, nullable.
- `parts.from_pattern boolean not null default false` — true when the part was created from a pattern part. Backfilled to true where `pattern_part_id` is not null. Needed because `pattern_part_id` becomes null when its pattern part is deleted, and "removed from the pattern" must be told apart from "added by hand".

### Function changes
- `start_project_from_pattern(p_pattern_id uuid, p_plans jsonb default '[]')`: as today, plus `from_pattern = true` on copied parts, plus one `project_yarns` row per distinct yarn in `p_plans` (`[{ "yarn_id": uuid, "skeins": number }]`); the same yarn picked for two lines gets the sum of their skeins. Runs in one transaction, so a failed plan creates no project.
- `apply_pattern_update(p_project_id uuid, p_changes jsonb)`: applies the ticked changes of "Update from pattern" in one transaction (see below). Security invoker; row-level security applies.

### How the lists fill up
- Saving a yarn adds its brand + name (with its weight and fiber) to `catalog_yarns` if that pair is new, its shop (`bought_at`) to `shops` if new, and its fiber to `fibers` if new. Existing list entries are never overwritten by a save.
- Suggestions come only from the lists. The Manage lists page is therefore the single place to tidy them: a removed entry stops being suggested even if an old yarn still uses it.
- The migration seeds the lists once from the user's existing yarns.

## Screens

### Yarn form
- **Brand**: text field with suggestions from `catalog_yarns` brands (case-insensitive "contains" match, max 8 shown).
- **Name**: text field with suggestions from `catalog_yarns` names of the typed brand (all names when Brand is empty). Picking a suggestion fills Weight and Fiber from the list entry, only when those fields are empty.
- **Colour** stays a free text field; next to it, **Colour family**: twelve dots with a "none" option.
- **Fiber**: dropdown of the user's fibers (alphabetical) plus "Other…"; Other shows a text field. The yarn's current fiber is always present even if it was removed from the list.
- **Shop** (`bought_at`): text field with suggestions from `shops`.
- Suggestions use a lightweight list under the field (not the native `datalist`, which iOS Safari shows poorly); each suggestion is a ≥ 44px tap target.

### Manage lists — `/stash/lists` (link "Manage lists" on the Stash page)
- Three sections: **Yarns** (grouped by brand, showing weight and fiber), **Shops**, **Fibers**.
- Each entry can be renamed (inline) or removed (with confirmation). Renaming does not change existing yarns.
- **Paste a list**: a text area per section. Yarn lines use `Brand ; Yarn name ; Weight ; Fiber` (weight and fiber optional; weight matched case-insensitively against the app's weight labels; fibers found in yarn lines are added to Fibers). Shops and fibers: one name per line. Duplicates (case-insensitive) are skipped. After import, a summary: "3 added, 1 already there, 1 line not understood (line 4)".

### Stash page
- A **search box** above the weight chips: case-insensitive match on name, brand and colour.
- A row of **colour dots** under it (only families used by at least one yarn); tapping one filters, tapping again clears.
- Search, colour dot and weight chip combine (all must match).
- The yarn card shows a small colour-family dot when set.

### Pattern form
- After "Rows/Parts", a **Materials** section:
  - **Yarns**: lines of Colour (text), Colour family (dots), Skeins (number field), Yarn type (text with suggestions from `catalog_yarns` as "Brand Name"); "+ Yarn" adds a line, × removes it.
  - **Other materials**: lines of Name (text with suggestions from the user's previous material names) and Quantity (number field, optional); "+ Material", ×.
- Saved with the pattern using the same update/insert/delete approach as pattern parts.

### Pattern page
- A **Materials** section: yarn lines as "● Pink · 2 skeins · Hobbii Honey Bunny" and other materials as "Safety eyes 10 mm × 2".

### New project (start from a pattern)
- After picking a pattern that has yarn lines, a **Yarns** step lists each line ("Pink · 2 skeins").
- Each line has a yarn picker: by default it shows stash yarns whose colour family matches the line's family (all yarns when the line has none), with the colour dots and a search box to switch; each yarn shows its free skeins. "Skip" leaves the line unplanned.
- "Start project" calls `start_project_from_pattern` with the picks. Picking more skeins than are free is allowed (the stash then shows a negative free count, as today).

### Project page — Update from pattern
- A button **"Update from pattern"** when the project has a pattern.
- It opens a preview listing the differences between the project's parts and the pattern's current parts, each with a tick box (ticked by default unless noted):
  - **New part** — a pattern part with fewer linked project parts than its count: add the missing ones ("Tail", or "Leg 3" when the count went from 2 to 3), placed after the last part from the same pattern part, else at the end.
  - **Renamed** — a linked project part whose name differs from the name the pattern would now give it ("Back leg 1"): rename it. Not ticked by default when the part has rows done or time recorded.
  - **Rows changed** — a linked part whose `total_rows` differs from the pattern part's: update `total_rows`; `current_row` is kept.
  - **No longer in the pattern** — a part with `from_pattern = true` and no pattern part, or one beyond the pattern part's current count: choice "Keep" (default) or "Delete" (deleting asks for confirmation, as deleting a part does today).
- "Apply" sends the ticked changes to `apply_pattern_update`; "Nothing to update" is shown when there are no differences.
- Rows crocheted, done flags, time sessions, yarn used and instructions are never changed.

## Architecture notes
- The diff is a pure function `diffProjectWithPattern(projectParts, patternParts)` returning a list of typed changes; the preview renders it and `apply_pattern_update` receives the ticked subset. Numbering follows the existing rule: name alone when count is 1, "Name i" otherwise.
- The paste parser is a pure function `parseYarnList(text)` returning parsed entries and rejected line numbers.
- Stash filtering is a pure function over the loaded yarns (no new query).
- New features live in `src/features/lists/` (catalog, shops, fibers, Manage lists page, suggestion field) and `src/features/materials/` (pattern materials form section and display); the colour dots are a shared component.

## Error handling
- Import, save and apply errors show in the existing ErrorBox; a failed `apply_pattern_update` or `start_project_from_pattern` changes nothing.
- Removing a list entry never fails because a yarn uses it (lists are not referenced by yarns).

## Testing
- Unit: `parseYarnList` (the user's three lines, missing weight/fiber, unknown weight, duplicates, blank and malformed lines); stash filter; `diffProjectWithPattern` (new part, count up and down, rename with numbering, rows changed, removed part, hand-added part ignored); suggestion field (filter, pick fills weight/fiber only when empty).
- Database: list uniqueness and RLS; lists filled on yarn save; `start_project_from_pattern` with plans (sum for the same yarn, rollback on bad yarn id); `apply_pattern_update` each change type, and that rows/time/yarn used are untouched.
- End-to-end: paste the user's lists, add a yarn using suggestions, add a pattern with a yarn line and an eyes line, start a project picking a yarn, change the pattern and apply "Update from pattern".

## Test data (from the user)
```
Hobbii ; Honey Bunny ; Super Bulky ; Polyester
Hobbii ; Baby Snuggle ; Super Bulky ; Polyester
Hobbii ; Toucan ; Super Bulky ; Polyester
```
Shops: `Hobbii`. Fibers: `Coton, Polyester, Laine, Acrylique, Alpaga, Laine de mérinos, Nylon, Soie`.
