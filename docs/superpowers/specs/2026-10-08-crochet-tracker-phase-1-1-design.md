# Crochet Tracker — Phase 1.1 Design

Date: 2026-10-08
Status: Draft, pending user review
Builds on: `docs/superpowers/specs/2026-09-24-crochet-tracker-design.md` (Phase 1, implemented). Everything in that spec still applies unless this document changes it.

## Purpose

Changes requested after the first hands-on test of Phase 1:

1. Per-part **instructions** on patterns (PDF pages or photos), shown on the part page while crocheting.
2. A **photo of the finished result** on patterns.
3. **Add skeins** to a known yarn without editing it.
4. A clearer **yarn photo** field.
5. **Number fields** that can be cleared and re-typed.
6. **Remove a planned yarn** from a project.
7. **Start / stop the timer** from the part page.

## Success criteria

1. On a pattern part, entering pages "3-4" shows two page images on the part page of every project part made from it (e.g. "Leg 1" and "Leg 2").
2. Photos and PDF pages appear in the same list and open full screen with pinch-zoom.
3. Editing and saving a pattern keeps the instructions of its unchanged parts.
4. "+ Add skeins" with 2 raises "Owned" by 2 and "Free" by 2 without opening the yarn form.
5. Every number field can be emptied and re-typed; leaving "How many" empty restores 1.
6. A planned yarn can be removed from a project after confirmation; its reservation disappears from the stash.
7. The timer can be started and stopped from the part page.

## Scope

**In:** the seven items above.

**Out:** framing a sub-area of a PDF page; re-converting pages automatically when a pattern's PDF is replaced; reordering instruction pictures; several photos per yarn; Phase 2 "Fill from PDF".

## Data model changes

All new tables follow the Phase 1 conventions: `id`, `user_id` (default `auth.uid()`), `created_at`, `updated_at`, row-level security "owner only", `updated_at` trigger.

### New table: part_instructions
| Column | Type | Notes |
|---|---|---|
| pattern_part_id | uuid, required | references `pattern_parts`, cascade delete |
| position | int, required | display order; new pictures go last |
| kind | text, required | `pdf_page` or `photo` (check constraint) |
| pdf_page | int, nullable | page number; required and ≥ 1 when `kind = 'pdf_page'`, null for photos (check constraint) |
| image_path | text, required | path in the `pattern-instructions` bucket |

Index on `pattern_part_id`.

### Changed tables
- `patterns.photo_path` (text, nullable): finished-result photo in the `pattern-photos` bucket.
- `patterns.pdf_updated_at` (timestamptz, nullable): set by a trigger to `now()` whenever `pdf_path` changes (insert or update).
- `parts.pattern_part_id` (uuid, nullable, references `pattern_parts`, `on delete set null`): the template part a project part was copied from. Index on it.

### Backfill (in the migration)
For existing project parts whose project has a pattern, set `pattern_part_id` by name: a part named `N` links to the pattern part named `N`; a part named `N k` (k a number) links to the pattern part named `N` with `count > 1`. Parts that match nothing stay unlinked.

### Function changes
- `start_project_from_pattern` also sets `parts.pattern_part_id` on every copied part. Everything else is unchanged (including the "Main" part for a pattern with no parts).
- New `add_skeins(p_yarn_id uuid, p_amount numeric) returns void`, security invoker: `skeins_owned = skeins_owned + p_amount` in one statement; raises an error when `p_amount <= 0`.

### Storage
Two new private buckets, objects under `<user_id>/…`, same per-folder policies as Phase 1:
- `pattern-instructions`: JPEG, ≤ 5 MB.
- `pattern-photos`: JPEG, ≤ 5 MB.

### Saving a pattern
Saving a pattern no longer replaces all its parts (that would delete their instructions). The form keeps each existing part's id. On save:
1. update the existing parts that are still listed (name, count, total_rows, position);
2. insert the new rows;
3. delete the parts removed from the form (their instructions go with them).

In the form, removing a part that has instructions asks for confirmation ("Its instructions are deleted too.").

## Screens

### Pattern page
- The finished-result photo at the top (placeholder when none).
- Each template part row gets an **"Instructions · n"** button opening the part instructions screen.

### Part instructions screen (new) — `/patterns/:id/parts/:partId`
- Title: pattern name · part name. Back link to the pattern.
- **Add PDF pages**: a text field accepting `3`, `3-4`, `3, 5, 7-8`. Each page is rendered in the browser from the pattern's PDF at 1600 px width, JPEG quality 0.8, uploaded, and stored as a `pdf_page` row. Disabled with the hint "Attach a PDF to the pattern first" when the pattern has none. Invalid input or pages outside the PDF show a message and add nothing.
- **Add photos**: pick or take one or several photos; each is resized like other photos (1600 px, JPEG 0.8) and stored as a `photo` row.
- The list of pictures in order, each a thumbnail labelled "page 3" or "photo" with a remove × (confirmed). A spinner shows while pages are being converted.
- When `patterns.pdf_updated_at` is later than the `created_at` of any `pdf_page` picture of this part, a note says: "The PDF was replaced — re-add pages if they changed."

### Pattern form
- **Result photo**: a "Take or choose a photo" button with a preview and "Remove photo".
- Removing a part that has instructions asks for confirmation.

### Patterns list and New project picker
- Pattern cards and picker tiles show the result photo when set (soft placeholder otherwise).

### Part page — new order
1. Back link, part name (rename), Done.
2. **Timer button**: large, full width, color `timer`. Idle: "▶ Start timing". Running for this part: elapsed clock and "■ Stop". Starting stops any other running timer (existing rule).
3. Row counter and "Where I stopped".
4. **Instructions**: the pictures of the linked pattern part, full width, in order. Tap → full-screen viewer (pinch-zoom, close button, previous / next buttons between pictures). Hidden when the part has no linked pattern part or no pictures.
5. Time sessions, Yarn used, Delete part (unchanged).

### Yarn page
- **"+ Add skeins"** next to the stock summary. It reveals a number field (default 1, step 0.25, > 0) and "Add"; uses `add_skeins`.

### Yarn form
- The Photo field becomes a "Take or choose a photo" button with a preview of the current or new photo and "Remove photo".

### Project page
- Each line of "Yarn · used / planned" that has a plan gets a **×** (confirmed: "Remove the plan for <yarn>?") that deletes the `project_yarns` row. Used amounts are untouched (they belong to parts).

### Number fields (everywhere)
A shared `NumberField` component replaces every `type="number"` input: it keeps the typed text while editing, selects its content on focus, allows an empty field while typing, and commits on blur or Enter. Each use declares what an empty field means (e.g. "How many" → 1, "Rows" → none, "Skeins owned" → required).

## Error handling
- Failed uploads, conversions and saves show a message (ErrorBox), as in Phase 1.
- A PDF page that fails to render stops the batch at that page; pages already added stay, and the message names the failing page.
- Deletes (instruction pictures, planned yarns, parts with instructions) are always confirmed.

## Architecture notes
- PDF rendering uses `pdfjs-dist` in the browser (worker loaded from the bundle), only on the part instructions screen.
- New code lives in `src/features/instructions/` (api, screen, viewer, page-range parser) and `src/components/NumberField.tsx`, `src/components/PhotoField.tsx` (shared by yarn and pattern forms).
- Query keys: `['instructions', patternPartId]`; all mutations use the shared `useInvalidateAll` (extended with `['instructions']`).

## Testing
- **Unit:** page-range parser (`"3"`, `"3-4"`, `"3, 5, 7-8"`, invalid input, out-of-range pages); NumberField behaviour (select on focus, empty while typing, commit rules).
- **Component:** part instructions screen (add pages calls the renderer per page, remove confirms), part page instructions section and viewer, part page timer button (start / stop states), yarn page "+ Add skeins", project page plan removal (confirmed), pattern form part removal confirmation.
- **Database (local stack):** `part_instructions` RLS and check constraints; `start_project_from_pattern` sets `pattern_part_id`; backfill links "Leg 1"/"Leg 2" to "Leg"; pattern save keeps instructions of kept parts; `add_skeins` adds and rejects ≤ 0; `pdf_updated_at` changes only when `pdf_path` changes; new buckets accept own-folder JPEG and refuse others.
- **End-to-end:** extend the main flow — attach a small test PDF to the pattern, add page 1 to "Leg", start the project, open "Leg 1", and see the instruction picture; add skeins on the yarn page.
