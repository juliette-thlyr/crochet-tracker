# Crochet Tracker (Phase 1) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a phone-first, installable web app that tracks crochet patterns, projects (with parts, timers and row counters) and a yarn stash, synced through Supabase.

**Architecture:** A Vite + React + TypeScript single-page app talks directly to Supabase (Postgres, Auth, Storage) through `@supabase/supabase-js`. Integrity logic (stock and summary views, project creation from a pattern, one running timer, default pattern types) lives in SQL migrations so every device sees the same result. Pure calculations live in `src/lib/calc.ts`; each feature folder owns its screens, data hooks and tests.

**Tech Stack:** Node 22 LTS, Vite 6, React 19, TypeScript 5, React Router 7, TanStack Query 5, Tailwind CSS 4, vite-plugin-pwa, @supabase/supabase-js 2, Supabase CLI 2, Vitest 3, React Testing Library 16, Playwright.

**Spec:** `docs/superpowers/specs/2026-09-24-crochet-tracker-design.md`
**Mockup (layout reference):** https://claude.ai/artifact/XwxHQ2Qk3YJK54R1mTSrwJ

## Global Constraints

- Single user per account; every table has `user_id` defaulting to `auth.uid()` and row-level security "owner only".
- Yarn quantities are in skeins, `numeric(6,2)`, never negative.
- Stash counts (used / reserved / free) are computed by the `yarn_stock` view, never stored.
- At most one running timer (`ended_at is null`) per user, enforced by a unique partial index.
- `current_row` ≥ 0, `total_rows` ≥ 1, pattern part `count` ≥ 1; `ended_at > started_at`.
- `done` is only ever set by the user.
- Hook sizes: `numeric(3,1)`, 1.0–12.0 mm in 0.5 mm steps, chosen from a dropdown. The pattern's is the *recommended* hook; the project's is the hook *used* (copied at start, then editable). Neither ever changes the other afterwards.
- Pattern types: one optional type per pattern; every new user starts with Amigurumi, Clothes, Accessories, Bag, Home, Baby.
- Photos resized on device to max 1600 px long edge, JPEG quality 0.8. PDFs max 20 MB.
- Storage buckets `pattern-pdfs`, `project-photos`, `yarn-photos`, private, objects under `<user_id>/…`.
- Prices displayed in euros.
- Visual design: font **Indie Flower** for all text; colors only through the Tailwind theme tokens defined in Task 1 (never raw hex in components). Tab colors: Projects `projects`, Patterns `patterns`, Stash `stash`, Timer `timer`; "+ row" buttons `row` with `row-ink` text. Tab icons: grid, crochet hook, yarn ball, hourglass. Touch targets ≥ 44 px.
- Database tests run only against the **test** Supabase project (`.env.test`), never the real one.
- Secrets (`.env`, `.env.test`) are never committed.
- Phase 1 requires internet; no offline mode.

## Prerequisites (done by the user, once)

1. **Upgrade Node to 22 LTS.** This machine has 18.16, which is end-of-life and too old for Tailwind 4 and Vite 6. Install from https://nodejs.org, then check `node --version` prints `v22.x`.
2. Create a free account at https://supabase.com and **two projects**: `crochet` (real) and `crochet-test` (tests only). For each, copy from *Project Settings → API*: Project URL, `anon` key, `service_role` key; and from *Connect → Session pooler*: the Postgres connection string with the database password filled in.
3. In both projects, *Authentication → Providers → Email*: keep Email enabled. In the real project, *Authentication → URL Configuration*: add `http://localhost:5173` (and later the Netlify URL) to Redirect URLs.
4. Create a free Netlify account (needed only in Task 15).

---

## File Structure

```
.env.example                  documented env vars (committed)
.env / .env.test              real / test secrets (ignored)
index.html                    loads Indie Flower, mounts the app
vite.config.ts                Vite + React + Tailwind + PWA + Vitest (unit) config
vitest.db.config.ts           Vitest config for database tests
playwright.config.ts
netlify.toml                  build + SPA redirect
public/icons/                 PWA icons
scripts/
  db.mjs                      push migrations / generate types, for the real or test project
src/
  main.tsx                    React root, QueryClient, Router
  App.tsx                     routes + auth guard
  index.css                   Tailwind import + theme tokens
  test/setup.ts               jest-dom matchers
  test/render.tsx             render helper with QueryClient + MemoryRouter
  lib/
    supabase.ts               typed Supabase client
    database.types.ts         generated from the schema
    calc.ts                   pure functions (durations, parts, rows, stock badges, hooks, money)
    images.ts                 photo resize
    storage.ts                upload / signed URL helpers
  components/
    Layout.tsx                page shell: outlet + timer bar + tab bar
    TabBar.tsx
    icons.tsx                 tab icons
    ConfirmDialog.tsx
    ErrorBox.tsx
    HookSelect.tsx            1.0–12.0 mm dropdown
  features/
    auth/      Login.tsx, useSession.ts
    stash/     api.ts, StashList.tsx, YarnForm.tsx, YarnPage.tsx
    patterns/  api.ts, TypeChips.tsx, PatternList.tsx, PatternForm.tsx, PatternPage.tsx
    projects/  api.ts, ProjectList.tsx, NewProject.tsx, ProjectPage.tsx
    parts/     api.ts, PartPage.tsx, RowCounter.tsx, SessionForm.tsx, YarnUsageForm.tsx
    timer/     api.ts, useNow.ts, TimerBar.tsx, TimerTab.tsx
supabase/
  config.toml
  migrations/
    20260924000001_schema.sql
    20260924000002_views.sql
    20260924000003_functions.sql
    20260924000004_storage.sql
  tests/
    helpers.ts                test users + clients
    schema.test.ts
    views.test.ts
    functions.test.ts
    storage.test.ts
e2e/
  main-flow.spec.ts
```

Commands used throughout:

- Unit/component tests: `npm test` (Vitest, `src/**`)
- Database tests: `npm run test:db` (Vitest, `supabase/tests/**`, reads `.env.test`)
- Push migrations to the test project: `npm run db:push:test`
- Push migrations to the real project: `npm run db:push`
- Regenerate TypeScript types from the test project: `npm run db:types`
- End-to-end: `npm run e2e`

---

### Task 1: Project scaffold, theme and test setup

**Files:**
- Create: `package.json`, `.gitignore`, `.env.example`, `index.html`, `vite.config.ts`, `tsconfig.json`, `src/vite-env.d.ts`, `src/index.css`, `src/main.tsx`, `src/App.tsx`, `src/test/setup.ts`, `src/test/render.tsx`
- Test: `src/App.test.tsx`

**Interfaces:**
- Produces: Tailwind theme tokens used by every later task: colors `bg`, `surface`, `line`, `divider`, `ink`, `muted`, `projects`/`projects-dark`/`projects-soft`, `patterns`/`patterns-dark`/`patterns-soft`, `stash`/`stash-dark`/`stash-soft`, `timer`/`timer-dark`/`timer-darker`, `row`, `row-ink`, `sun`, `sun-track`; font `hand`. So classes like `bg-projects`, `text-muted`, `border-line`, `font-hand` exist.
- Produces: `renderWithProviders(ui: ReactElement, { route?: string, path?: string }): RenderResult` in `src/test/render.tsx`.

- [ ] **Step 1: Create `package.json`**

```json
{
  "name": "crochet-tracker",
  "private": true,
  "version": "0.1.0",
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "tsc -b && vite build",
    "preview": "vite preview",
    "test": "vitest run",
    "test:watch": "vitest",
    "test:db": "vitest run --config vitest.db.config.ts",
    "db:push": "node scripts/db.mjs push .env",
    "db:push:test": "node scripts/db.mjs push .env.test",
    "db:types": "node scripts/db.mjs types .env.test",
    "e2e": "playwright test"
  },
  "dependencies": {
    "@supabase/supabase-js": "^2.45.0",
    "@tanstack/react-query": "^5.59.0",
    "react": "^19.0.0",
    "react-dom": "^19.0.0",
    "react-router": "^7.0.0"
  },
  "devDependencies": {
    "@playwright/test": "^1.48.0",
    "@tailwindcss/vite": "^4.0.0",
    "@testing-library/jest-dom": "^6.6.0",
    "@testing-library/react": "^16.1.0",
    "@testing-library/user-event": "^14.5.0",
    "@types/react": "^19.0.0",
    "@types/react-dom": "^19.0.0",
    "@vitejs/plugin-react": "^4.3.0",
    "dotenv": "^16.4.0",
    "jsdom": "^25.0.0",
    "supabase": "^2.0.0",
    "tailwindcss": "^4.0.0",
    "typescript": "^5.6.0",
    "vite": "^6.0.0",
    "vite-plugin-pwa": "^1.0.0",
    "vitest": "^3.0.0"
  }
}
```

- [ ] **Step 2: Create config files**

`.gitignore`:
```
node_modules
dist
.env
.env.test
test-results
playwright-report
supabase/.temp
```

`.env.example`:
```
# Real project (.env): used by the app and `npm run db:push`
VITE_SUPABASE_URL=https://<ref>.supabase.co
VITE_SUPABASE_ANON_KEY=<anon key>
DB_URL=postgresql://postgres.<ref>:<password>@<host>:5432/postgres

# Test project (.env.test): used by `npm run test:db`, `db:push:test`, `db:types`, `e2e`
# The same three names, plus:
# SUPABASE_SERVICE_ROLE_KEY=<service_role key>
```

`tsconfig.json`:
```json
{
  "compilerOptions": {
    "target": "ES2022",
    "lib": ["ES2022", "DOM", "DOM.Iterable"],
    "module": "ESNext",
    "moduleResolution": "Bundler",
    "jsx": "react-jsx",
    "strict": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "skipLibCheck": true,
    "resolveJsonModule": true,
    "isolatedModules": true,
    "noEmit": true,
    "types": ["vitest/globals", "@testing-library/jest-dom"]
  },
  "include": ["src", "supabase/tests", "e2e", "vite.config.ts", "vitest.db.config.ts", "playwright.config.ts"]
}
```

`vite.config.ts`:
```ts
/// <reference types="vitest/config" />
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
  plugins: [react(), tailwindcss()],
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['src/test/setup.ts'],
    include: ['src/**/*.test.{ts,tsx}'],
  },
});
```

`index.html`:
```html
<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
    <meta name="theme-color" content="#E4EEF9" />
    <link rel="preconnect" href="https://fonts.googleapis.com" />
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
    <link href="https://fonts.googleapis.com/css2?family=Indie+Flower&display=swap" rel="stylesheet" />
    <title>Crochet Tracker</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.tsx"></script>
  </body>
</html>
```

`src/vite-env.d.ts`:
```ts
/// <reference types="vite/client" />
```

- [ ] **Step 3: Create the theme in `src/index.css`**

```css
@import "tailwindcss";

@theme {
  --font-hand: "Indie Flower", cursive;

  --color-bg: #E4EEF9;
  --color-surface: #FFFFFF;
  --color-line: #D3E0EE;
  --color-divider: #E6EEF7;
  --color-ink: #2B1E2F;
  --color-muted: #6E5C6B;

  --color-projects: #B8336A;
  --color-projects-dark: #85204A;
  --color-projects-soft: #FBE3EC;
  --color-patterns: #6D4BC3;
  --color-patterns-dark: #4F3A8F;
  --color-patterns-soft: #E9E2FA;
  --color-stash: #0E7C7B;
  --color-stash-dark: #0B5B5A;
  --color-stash-soft: #D5F0EC;
  --color-timer: #4169E1;
  --color-timer-dark: #3457C8;
  --color-timer-darker: #2A48B0;
  --color-row: #7DB8F2;
  --color-row-ink: #0A2A52;
  --color-sun: #F6B93B;
  --color-sun-track: #FDEFC8;
}

html, body {
  background: var(--color-bg);
  color: var(--color-ink);
  font-family: var(--font-hand);
  font-size: 16px;
  margin: 0;
}

button, input, select, textarea {
  font: inherit;
  color: inherit;
}
```

- [ ] **Step 4: Create the test setup and render helper**

`src/test/setup.ts`:
```ts
import '@testing-library/jest-dom/vitest';
```

`src/test/render.tsx`:
```tsx
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render } from '@testing-library/react';
import type { ReactElement } from 'react';
import { MemoryRouter, Route, Routes } from 'react-router';

export function renderWithProviders(
  ui: ReactElement,
  { route = '/', path = '/' }: { route?: string; path?: string } = {},
) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={[route]}>
        <Routes>
          <Route path={path} element={ui} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}
```

- [ ] **Step 5: Write the failing smoke test in `src/App.test.tsx`**

```tsx
import { render, screen } from '@testing-library/react';
import App from './App';

test('renders the app name', () => {
  render(<App />);
  expect(screen.getByText('Crochet Tracker')).toBeInTheDocument();
});
```

- [ ] **Step 6: Install, then run the test to verify it fails**

Run: `npm install`, then `npm test`
Expected: FAIL with `Failed to resolve import "./App"`.

- [ ] **Step 7: Create `src/App.tsx` and `src/main.tsx`**

`src/App.tsx` (Task 8 replaces it with the router):
```tsx
export default function App() {
  return <h1 className="p-4 text-4xl text-projects">Crochet Tracker</h1>;
}
```

`src/main.tsx`:
```tsx
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router';
import App from './App';
import './index.css';

const queryClient = new QueryClient({
  defaultOptions: { queries: { staleTime: 30_000, retry: 1 } },
});

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <App />
      </BrowserRouter>
    </QueryClientProvider>
  </StrictMode>,
);
```

- [ ] **Step 8: Run the tests and the build**

Run: `npm test`. Expected: PASS (1 test).
Run: `npm run build`. Expected: completes with no TypeScript errors.
Run: `npm run dev` and open http://localhost:5173. Expected: "Crochet Tracker" in Indie Flower, berry-colored, on a pastel blue page.

- [ ] **Step 9: Commit**

```bash
git add .
git commit -m "chore: scaffold Vite React app with theme and test setup"
```

---

### Task 2: Time calculations

**Files:**
- Create: `src/lib/calc.ts`
- Test: `src/lib/calc.test.ts`

**Interfaces:**
- Produces (in `src/lib/calc.ts`):
  - `type SessionLike = { started_at: string; ended_at: string | null }`
  - `sessionSeconds(s: SessionLike, now: Date): number`: whole seconds; a running session counts up to `now`; never negative.
  - `sumSeconds(sessions: SessionLike[], now: Date): number`
  - `formatDuration(seconds: number): string`: `"0m"`, `"42m"`, `"1h 05m"`, `"11h 20m"`.
  - `formatClock(seconds: number): string`: `"0:00:00"`, `"0:42:10"`, `"12:03:09"`.

- [ ] **Step 1: Write the failing tests**

```ts
import { formatClock, formatDuration, sessionSeconds, sumSeconds } from './calc';

const now = new Date('2026-09-24T20:30:00Z');

describe('sessionSeconds', () => {
  test('closed session', () => {
    expect(sessionSeconds({ started_at: '2026-09-24T20:00:00Z', ended_at: '2026-09-24T20:25:30Z' }, now)).toBe(1530);
  });
  test('running session counts up to now', () => {
    expect(sessionSeconds({ started_at: '2026-09-24T20:10:00Z', ended_at: null }, now)).toBe(1200);
  });
  test('never negative', () => {
    expect(sessionSeconds({ started_at: '2026-09-24T21:00:00Z', ended_at: null }, now)).toBe(0);
  });
});

test('sumSeconds adds closed and running sessions', () => {
  expect(
    sumSeconds(
      [
        { started_at: '2026-09-24T19:00:00Z', ended_at: '2026-09-24T19:25:00Z' },
        { started_at: '2026-09-24T20:10:00Z', ended_at: null },
      ],
      now,
    ),
  ).toBe(1500 + 1200);
  expect(sumSeconds([], now)).toBe(0);
});

test.each([
  [0, '0m'],
  [59, '0m'],
  [42 * 60, '42m'],
  [65 * 60, '1h 05m'],
  [11 * 3600 + 20 * 60 + 59, '11h 20m'],
])('formatDuration(%i) = %s', (s, out) => {
  expect(formatDuration(s)).toBe(out);
});

test.each([
  [0, '0:00:00'],
  [42 * 60 + 10, '0:42:10'],
  [12 * 3600 + 3 * 60 + 9, '12:03:09'],
])('formatClock(%i) = %s', (s, out) => {
  expect(formatClock(s)).toBe(out);
});
```

- [ ] **Step 2: Run to verify failure**

Run: `npm test -- src/lib/calc.test.ts`
Expected: FAIL with `Failed to resolve import "./calc"`.

- [ ] **Step 3: Implement**

```ts
export type SessionLike = { started_at: string; ended_at: string | null };

export function sessionSeconds(s: SessionLike, now: Date): number {
  const start = new Date(s.started_at).getTime();
  const end = s.ended_at ? new Date(s.ended_at).getTime() : now.getTime();
  return Math.max(0, Math.floor((end - start) / 1000));
}

export function sumSeconds(sessions: SessionLike[], now: Date): number {
  return sessions.reduce((total, s) => total + sessionSeconds(s, now), 0);
}

const pad = (n: number) => String(n).padStart(2, '0');

export function formatDuration(seconds: number): string {
  const minutes = Math.floor(seconds / 60);
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return h === 0 ? `${m}m` : `${h}h ${pad(m)}m`;
}

export function formatClock(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  return `${h}:${pad(m)}:${pad(s)}`;
}
```

- [ ] **Step 4: Run to verify pass**

Run: `npm test -- src/lib/calc.test.ts`. Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/calc.ts src/lib/calc.test.ts
git commit -m "feat: add duration calculations"
```

---

### Task 3: Part, row, stock, hook and money helpers

**Files:**
- Modify: `src/lib/calc.ts` (append)
- Test: `src/lib/calc.test.ts` (append)

**Interfaces:**
- Produces (in `src/lib/calc.ts`):
  - `type PatternPartLike = { name: string; count: number; total_rows: number | null }`
  - `expandPatternParts(parts: PatternPartLike[]): { name: string; total_rows: number | null }[]`: same naming rule as the SQL function (count 1 keeps the name; count n becomes "Leg 1" … "Leg n").
  - `clampRow(n: number): number`: never below 0, integers only.
  - `rowLabel(current: number | null, total: number | null): string`: `"—"`, `"Row 12"`, `"Row 12/18"`.
  - `rowProgress(current: number | null, total: number | null): number`: 0–100, 0 when unknown.
  - `stockBadge(free: number): 'low' | 'out' | null`: "out" when ≤ 0, "low" when < 1.
  - `HOOK_MIN = 1`, `HOOK_MAX = 12`, `HOOK_STEP = 0.5`
  - `hookSizeOptions(): number[]`: `[1, 1.5, …, 12]` (23 values).
  - `formatHook(mm: number | null): string`: `"3.5 mm"` or `"—"`.
  - `hookLabel(used: number | null, recommended: number | null): string`: `"hook 4.0 mm (pattern: 3.5 mm)"` when both are set and differ, `"hook 3.5 mm"` when equal or there's no recommendation, `"hook —"` when no hook is set for the project.
  - `formatSkeins(n: number): string`: `"0.25 sk"`, `"2 sk"`.
  - `formatEuros(n: number | null): string`: `"4,50 €"` (fr-FR), `"—"` for null.

- [ ] **Step 1: Write the failing tests (append to `src/lib/calc.test.ts`; merge the import into the existing import line)**

```ts
import {
  clampRow, expandPatternParts, formatEuros, formatHook, formatSkeins, hookLabel,
  hookSizeOptions, rowLabel, rowProgress, stockBadge,
} from './calc';

test('expandPatternParts names repeated parts', () => {
  expect(
    expandPatternParts([
      { name: 'Head', count: 1, total_rows: 24 },
      { name: 'Leg', count: 2, total_rows: 18 },
      { name: 'Spikes', count: 1, total_rows: null },
    ]),
  ).toEqual([
    { name: 'Head', total_rows: 24 },
    { name: 'Leg 1', total_rows: 18 },
    { name: 'Leg 2', total_rows: 18 },
    { name: 'Spikes', total_rows: null },
  ]);
});

test('clampRow', () => {
  expect(clampRow(-1)).toBe(0);
  expect(clampRow(3.7)).toBe(3);
  expect(clampRow(20)).toBe(20);
});

test('rowLabel', () => {
  expect(rowLabel(null, 18)).toBe('—');
  expect(rowLabel(12, null)).toBe('Row 12');
  expect(rowLabel(12, 18)).toBe('Row 12/18');
  expect(rowLabel(20, 18)).toBe('Row 20/18');
});

test('rowProgress', () => {
  expect(rowProgress(9, 18)).toBe(50);
  expect(rowProgress(20, 18)).toBe(100);
  expect(rowProgress(null, 18)).toBe(0);
  expect(rowProgress(5, null)).toBe(0);
});

test('stockBadge', () => {
  expect(stockBadge(2)).toBeNull();
  expect(stockBadge(1)).toBeNull();
  expect(stockBadge(0.6)).toBe('low');
  expect(stockBadge(0)).toBe('out');
  expect(stockBadge(-0.5)).toBe('out');
});

test('hookSizeOptions has 23 values from 1.0 to 12.0', () => {
  const opts = hookSizeOptions();
  expect(opts).toHaveLength(23);
  expect(opts[0]).toBe(1);
  expect(opts[1]).toBe(1.5);
  expect(opts[22]).toBe(12);
});

test('formatHook and hookLabel', () => {
  expect(formatHook(3.5)).toBe('3.5 mm');
  expect(formatHook(4)).toBe('4.0 mm');
  expect(formatHook(null)).toBe('—');
  expect(hookLabel(4, 3.5)).toBe('hook 4.0 mm (pattern: 3.5 mm)');
  expect(hookLabel(3.5, 3.5)).toBe('hook 3.5 mm');
  expect(hookLabel(3.5, null)).toBe('hook 3.5 mm');
  expect(hookLabel(null, 3.5)).toBe('hook —');
});

test('formatSkeins and formatEuros', () => {
  expect(formatSkeins(0.25)).toBe('0.25 sk');
  expect(formatSkeins(2)).toBe('2 sk');
  expect(formatEuros(4.5).replace(/\s/g, ' ')).toBe('4,50 €');
  expect(formatEuros(null)).toBe('—');
});
```

- [ ] **Step 2: Run to verify failure**

Run: `npm test -- src/lib/calc.test.ts`
Expected: FAIL with `expandPatternParts is not a function` (and the other new names).

- [ ] **Step 3: Implement (append to `src/lib/calc.ts`)**

```ts
export type PatternPartLike = { name: string; count: number; total_rows: number | null };

export function expandPatternParts(parts: PatternPartLike[]) {
  return parts.flatMap((p) =>
    p.count <= 1
      ? [{ name: p.name, total_rows: p.total_rows }]
      : Array.from({ length: p.count }, (_, i) => ({ name: `${p.name} ${i + 1}`, total_rows: p.total_rows })),
  );
}

export function clampRow(n: number): number {
  return Math.max(0, Math.floor(n));
}

export function rowLabel(current: number | null, total: number | null): string {
  if (current === null) return '—';
  return total === null ? `Row ${current}` : `Row ${current}/${total}`;
}

export function rowProgress(current: number | null, total: number | null): number {
  if (current === null || total === null || total <= 0) return 0;
  return Math.min(100, Math.round((current / total) * 100));
}

export function stockBadge(free: number): 'low' | 'out' | null {
  if (free <= 0) return 'out';
  if (free < 1) return 'low';
  return null;
}

export const HOOK_MIN = 1;
export const HOOK_MAX = 12;
export const HOOK_STEP = 0.5;

export function hookSizeOptions(): number[] {
  const count = (HOOK_MAX - HOOK_MIN) / HOOK_STEP + 1;
  return Array.from({ length: count }, (_, i) => HOOK_MIN + i * HOOK_STEP);
}

export function formatHook(mm: number | null): string {
  return mm === null ? '—' : `${mm.toFixed(1)} mm`;
}

export function hookLabel(used: number | null, recommended: number | null): string {
  if (used === null) return 'hook —';
  if (recommended === null || recommended === used) return `hook ${formatHook(used)}`;
  return `hook ${formatHook(used)} (pattern: ${formatHook(recommended)})`;
}

export function formatSkeins(n: number): string {
  return `${Number(n.toFixed(2))} sk`;
}

const euros = new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' });

export function formatEuros(n: number | null): string {
  return n === null ? '—' : euros.format(n);
}
```

- [ ] **Step 4: Run to verify pass**

Run: `npm test -- src/lib/calc.test.ts`. Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/calc.ts src/lib/calc.test.ts
git commit -m "feat: add part, row, stock, hook and money helpers"
```

---

### Task 4: Supabase setup, schema and database test harness

**Files:**
- Create: `supabase/config.toml` (via `supabase init`), `scripts/db.mjs`, `vitest.db.config.ts`, `supabase/migrations/20260924000001_schema.sql`, `supabase/tests/helpers.ts`
- Test: `supabase/tests/schema.test.ts`

**Interfaces:**
- Produces tables (all with `id`, `user_id default auth.uid()`, `created_at`, `updated_at`, RLS "owner only"): `pattern_types`, `patterns`, `pattern_parts`, `yarns`, `projects`, `project_photos`, `parts`, `time_sessions`, `part_yarns`, `project_yarns`; enums `yarn_weight`, `project_status`. Column names exactly as in the spec's data model (hook column is `hook_size_mm`).
- Produces: trigger that gives each new auth user the six default pattern types.
- Produces (in `supabase/tests/helpers.ts`): `admin: SupabaseClient` (service role), `type TestUser = { id: string; email: string; client: SupabaseClient }`, `createTestUser(): Promise<TestUser>`, `deleteTestUser(u: TestUser): Promise<void>`.

**Before starting:** `.env.test` must exist with `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY` and `DB_URL` of the **crochet-test** project. `.env` must exist with the three variables of the **crochet** project (no service key). Docker Desktop must be running for `npm run db:types`.

- [ ] **Step 1: Initialise Supabase and add the helper scripts**

Run: `npx supabase init` (answer "N" to the VS Code / IntelliJ settings questions). Expected: `supabase/config.toml` created.

`scripts/db.mjs`:
```js
import { spawnSync } from 'node:child_process';
import { writeFileSync } from 'node:fs';
import { config } from 'dotenv';

const [cmd, envFile] = process.argv.slice(2);
config({ path: envFile });
const url = process.env.DB_URL;
if (!url) {
  console.error(`DB_URL is missing in ${envFile}`);
  process.exit(1);
}
const run = (args, opts) => spawnSync('npx', ['supabase', ...args], { shell: true, ...opts });

if (cmd === 'push') {
  const r = run(['db', 'push', '--include-all', '--db-url', `"${url}"`], { stdio: 'inherit' });
  process.exit(r.status ?? 1);
} else if (cmd === 'types') {
  const r = run(['gen', 'types', 'typescript', '--schema', 'public', '--db-url', `"${url}"`], { encoding: 'utf8' });
  if (r.status !== 0) {
    console.error(r.stderr);
    process.exit(r.status ?? 1);
  }
  writeFileSync('src/lib/database.types.ts', r.stdout);
  console.log('wrote src/lib/database.types.ts');
} else {
  console.error('usage: node scripts/db.mjs push|types <env file>');
  process.exit(1);
}
```

`vitest.db.config.ts`:
```ts
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['supabase/tests/**/*.test.ts'],
    testTimeout: 30_000,
    hookTimeout: 60_000,
    fileParallelism: false,
  },
});
```

- [ ] **Step 2: Write the test helpers in `supabase/tests/helpers.ts`**

```ts
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { config } from 'dotenv';

config({ path: '.env.test' });

const url = process.env.VITE_SUPABASE_URL;
const anonKey = process.env.VITE_SUPABASE_ANON_KEY;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !anonKey || !serviceKey) {
  throw new Error('Fill .env.test with the crochet-test project keys before running database tests');
}

const noSession = { auth: { persistSession: false, autoRefreshToken: false } };

export const admin = createClient(url, serviceKey, noSession);

export type TestUser = { id: string; email: string; client: SupabaseClient };

export async function createTestUser(): Promise<TestUser> {
  const email = `test-${crypto.randomUUID()}@example.com`;
  const password = `pw-${crypto.randomUUID()}`;
  const { data, error } = await admin.auth.admin.createUser({ email, password, email_confirm: true });
  if (error) throw error;
  const client = createClient(url!, anonKey!, noSession);
  const { error: signInError } = await client.auth.signInWithPassword({ email, password });
  if (signInError) throw signInError;
  return { id: data.user.id, email, client };
}

export async function deleteTestUser(user: TestUser): Promise<void> {
  await admin.auth.admin.deleteUser(user.id);
}
```

- [ ] **Step 3: Write the failing tests in `supabase/tests/schema.test.ts`**

```ts
import { createTestUser, deleteTestUser, type TestUser } from './helpers';

let a: TestUser;
let b: TestUser;

beforeAll(async () => {
  a = await createTestUser();
  b = await createTestUser();
});
afterAll(async () => {
  await deleteTestUser(a);
  await deleteTestUser(b);
});

async function newPart(u: TestUser) {
  const { data: project } = await u.client.from('projects').insert({ name: 'P' }).select().single();
  const { data: part, error } = await u.client
    .from('parts').insert({ project_id: project!.id, name: 'Body', position: 0 }).select().single();
  if (error) throw error;
  return { project: project!, part: part! };
}

test('a new user gets the six default pattern types in order', async () => {
  const { data } = await a.client.from('pattern_types').select('name').order('position');
  expect(data!.map((t) => t.name)).toEqual(['Amigurumi', 'Clothes', 'Accessories', 'Bag', 'Home', 'Baby']);
});

test('row-level security hides other users rows', async () => {
  await a.client.from('yarns').insert({ name: 'Fern green', skeins_owned: 3 });
  const { data } = await b.client.from('yarns').select();
  expect(data).toEqual([]);
});

test('a user cannot write rows for someone else', async () => {
  const { error } = await b.client.from('yarns').insert({ name: 'Stolen', skeins_owned: 1, user_id: a.id });
  expect(error).not.toBeNull();
});

test.each([
  [3.5, true],
  [1, true],
  [12, true],
  [3.3, false],
  [0.5, false],
  [12.5, false],
])('hook size %d accepted: %s', async (mm, ok) => {
  const { error } = await a.client.from('patterns').insert({ name: 'H', hook_size_mm: mm });
  expect(error === null).toBe(ok);
});

test('negative skeins are rejected', async () => {
  const { error } = await a.client.from('yarns').insert({ name: 'Neg', skeins_owned: -1 });
  expect(error).not.toBeNull();
});

test('only one running timer per user', async () => {
  const { part } = await newPart(a);
  const first = await a.client.from('time_sessions').insert({ part_id: part.id });
  expect(first.error).toBeNull();
  const second = await a.client.from('time_sessions').insert({ part_id: part.id });
  expect(second.error).not.toBeNull();
  await a.client.from('time_sessions').update({ ended_at: new Date(Date.now() + 1000).toISOString() }).eq('part_id', part.id);
});

test('a session cannot end before it starts', async () => {
  const { part } = await newPart(a);
  const { error } = await a.client.from('time_sessions').insert({
    part_id: part.id,
    started_at: '2026-09-24T20:00:00Z',
    ended_at: '2026-09-24T19:00:00Z',
  });
  expect(error).not.toBeNull();
});

test('current_row cannot be negative', async () => {
  const { part } = await newPart(a);
  const { error } = await a.client.from('parts').update({ current_row: -1 }).eq('id', part.id);
  expect(error).not.toBeNull();
});

test('a yarn used by a part cannot be deleted', async () => {
  const { part } = await newPart(a);
  const { data: yarn } = await a.client.from('yarns').insert({ name: 'Used', skeins_owned: 2 }).select().single();
  await a.client.from('part_yarns').insert({ part_id: part.id, yarn_id: yarn!.id, skeins_used: 0.5 });
  const { error } = await a.client.from('yarns').delete().eq('id', yarn!.id);
  expect(error).not.toBeNull();
});

test('deleting a pattern keeps its projects', async () => {
  const { data: pattern } = await a.client.from('patterns').insert({ name: 'Gone' }).select().single();
  const { data: project } = await a.client
    .from('projects').insert({ name: 'Kept', pattern_id: pattern!.id }).select().single();
  await a.client.from('patterns').delete().eq('id', pattern!.id);
  const { data } = await a.client.from('projects').select('pattern_id').eq('id', project!.id).single();
  expect(data!.pattern_id).toBeNull();
});

test('deleting a pattern type leaves its patterns untyped', async () => {
  const { data: type } = await a.client.from('pattern_types').insert({ name: 'Temp', position: 9 }).select().single();
  const { data: pattern } = await a.client
    .from('patterns').insert({ name: 'Typed', pattern_type_id: type!.id }).select().single();
  await a.client.from('pattern_types').delete().eq('id', type!.id);
  const { data } = await a.client.from('patterns').select('pattern_type_id').eq('id', pattern!.id).single();
  expect(data!.pattern_type_id).toBeNull();
});
```

- [ ] **Step 4: Run to verify failure**

Run: `npm run test:db`
Expected: FAIL. The first test fails because `relation "public.pattern_types" does not exist` (the schema hasn't been pushed yet).

- [ ] **Step 5: Write the migration `supabase/migrations/20260924000001_schema.sql`**

```sql
create type public.yarn_weight as enum
  ('lace', 'fingering', 'sport', 'dk', 'worsted', 'aran', 'bulky', 'super_bulky', 'jumbo');
create type public.project_status as enum ('idea', 'in_progress', 'finished', 'frogged');

create function public.set_updated_at() returns trigger
language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end $$;

create table public.pattern_types (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  name text not null check (length(trim(name)) > 0),
  position int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, name)
);

create table public.patterns (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  name text not null check (length(trim(name)) > 0),
  pattern_type_id uuid references public.pattern_types on delete set null,
  designer text,
  url text,
  hook_size_mm numeric(3,1)
    check (hook_size_mm between 1.0 and 12.0 and hook_size_mm * 2 = floor(hook_size_mm * 2)),
  yarn_weight public.yarn_weight,
  notes text,
  pdf_path text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.pattern_parts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  pattern_id uuid not null references public.patterns on delete cascade,
  name text not null check (length(trim(name)) > 0),
  position int not null default 0,
  count int not null default 1 check (count >= 1),
  total_rows int check (total_rows >= 1),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.yarns (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  brand text,
  name text not null check (length(trim(name)) > 0),
  color text,
  yarn_weight public.yarn_weight,
  fiber text,
  skeins_owned numeric(6,2) not null default 0 check (skeins_owned >= 0),
  photo_path text,
  bought_at text,
  price_per_skein numeric(8,2) check (price_per_skein >= 0),
  bought_on date,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.projects (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  name text not null check (length(trim(name)) > 0),
  pattern_id uuid references public.patterns on delete set null,
  status public.project_status not null default 'idea',
  start_date date,
  finish_date date,
  hook_size_mm numeric(3,1)
    check (hook_size_mm between 1.0 and 12.0 and hook_size_mm * 2 = floor(hook_size_mm * 2)),
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.project_photos (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  project_id uuid not null references public.projects on delete cascade,
  path text not null,
  caption text,
  taken_on date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.parts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  project_id uuid not null references public.projects on delete cascade,
  name text not null check (length(trim(name)) > 0),
  position int not null default 0,
  done boolean not null default false,
  current_row int check (current_row >= 0),
  total_rows int check (total_rows >= 1),
  resume_note text,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.time_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  part_id uuid not null references public.parts on delete cascade,
  started_at timestamptz not null default now(),
  ended_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (ended_at is null or ended_at > started_at)
);
create unique index one_running_timer on public.time_sessions (user_id) where ended_at is null;

create table public.part_yarns (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  part_id uuid not null references public.parts on delete cascade,
  yarn_id uuid not null references public.yarns on delete restrict,
  skeins_used numeric(6,2) not null default 0 check (skeins_used >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (part_id, yarn_id)
);

create table public.project_yarns (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  project_id uuid not null references public.projects on delete cascade,
  yarn_id uuid not null references public.yarns on delete restrict,
  skeins_planned numeric(6,2) not null check (skeins_planned >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (project_id, yarn_id)
);

create index on public.patterns (pattern_type_id);
create index on public.pattern_parts (pattern_id);
create index on public.projects (pattern_id);
create index on public.project_photos (project_id);
create index on public.parts (project_id);
create index on public.time_sessions (part_id);
create index on public.part_yarns (yarn_id);
create index on public.project_yarns (yarn_id);

do $$
declare t text;
begin
  foreach t in array array['pattern_types', 'patterns', 'pattern_parts', 'yarns', 'projects',
                           'project_photos', 'parts', 'time_sessions', 'part_yarns', 'project_yarns']
  loop
    execute format('alter table public.%I enable row level security', t);
    execute format(
      'create policy owner_all on public.%I for all to authenticated
         using (user_id = auth.uid()) with check (user_id = auth.uid())', t);
    execute format(
      'create trigger set_updated_at before update on public.%I
         for each row execute function public.set_updated_at()', t);
  end loop;
end $$;

create function public.seed_pattern_types() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into public.pattern_types (user_id, name, position) values
    (new.id, 'Amigurumi', 0), (new.id, 'Clothes', 1), (new.id, 'Accessories', 2),
    (new.id, 'Bag', 3), (new.id, 'Home', 4), (new.id, 'Baby', 5);
  return new;
end $$;

create trigger seed_pattern_types after insert on auth.users
  for each row execute function public.seed_pattern_types();
```

- [ ] **Step 6: Push to the test project and run the tests**

Run: `npm run db:push:test`. Expected: `Applying migration 20260924000001_schema.sql... Finished supabase db push.`
Run: `npm run test:db`. Expected: PASS (all schema tests).

- [ ] **Step 7: Generate the TypeScript types**

Run: `npm run db:types`. Expected: `wrote src/lib/database.types.ts`, which contains `pattern_types`, `hook_size_mm` and `project_status`.

- [ ] **Step 8: Commit**

```bash
git add supabase scripts vitest.db.config.ts src/lib/database.types.ts
git commit -m "feat: add database schema with RLS and default pattern types"
```

---

### Task 5: Stock, project summary and pattern stats views

**Files:**
- Create: `supabase/migrations/20260924000002_views.sql`
- Test: `supabase/tests/views.test.ts`
- Modify: `src/lib/database.types.ts` (regenerated)

**Interfaces:**
- Consumes: tables from Task 4; `createTestUser`, `deleteTestUser` from `supabase/tests/helpers.ts`.
- Produces views (all `security_invoker = true`):
  - `yarn_stock(yarn_id, user_id, owned, used, reserved, free)`
  - `project_summary(project_id, user_id, parts_total, parts_done, seconds, skeins)`: `seconds` includes a running session up to `now()`.
  - `pattern_stats(pattern_id, user_id, times_made, avg_seconds, avg_skeins)`: over `finished` projects only; averages are null when `times_made = 0`.

- [ ] **Step 1: Write the failing tests in `supabase/tests/views.test.ts`**

```ts
import { createTestUser, deleteTestUser, type TestUser } from './helpers';

let u: TestUser;
beforeAll(async () => { u = await createTestUser(); });
afterAll(async () => { await deleteTestUser(u); });

// Returns the project with exactly one part. From Task 6 on, blank projects get a "Main"
// part automatically, so reuse it when present instead of adding a second one.
async function project(name: string, status: string, pattern_id: string | null = null) {
  const { data, error } = await u.client.from('projects').insert({ name, status, pattern_id }).select().single();
  if (error) throw error;
  const { data: existing } = await u.client.from('parts').select().eq('project_id', data.id);
  if (existing && existing.length > 0) return { project: data, part: existing[0] };
  const { data: part } = await u.client
    .from('parts').insert({ project_id: data.id, name: 'Body', position: 0 }).select().single();
  return { project: data, part: part! };
}

describe('yarn_stock', () => {
  test('used, reserved and free follow the spec rules', async () => {
    const { data: yarn } = await u.client.from('yarns').insert({ name: 'Fern', skeins_owned: 3 }).select().single();
    const active = await project('Active', 'in_progress');
    const frogged = await project('Frogged', 'frogged');
    const finished = await project('Finished', 'finished');

    await u.client.from('part_yarns').insert([
      { part_id: active.part.id, yarn_id: yarn!.id, skeins_used: 1.1 },
      { part_id: frogged.part.id, yarn_id: yarn!.id, skeins_used: 0.5 },
      { part_id: finished.part.id, yarn_id: yarn!.id, skeins_used: 0.3 },
    ]);
    await u.client.from('project_yarns').insert([
      { project_id: active.project.id, yarn_id: yarn!.id, skeins_planned: 2 },
      { project_id: finished.project.id, yarn_id: yarn!.id, skeins_planned: 1 },
    ]);

    const { data: s } = await u.client.from('yarn_stock').select().eq('yarn_id', yarn!.id).single();
    expect(Number(s!.owned)).toBe(3);
    expect(Number(s!.used)).toBeCloseTo(1.4);
    expect(Number(s!.reserved)).toBeCloseTo(0.9);
    expect(Number(s!.free)).toBeCloseTo(0.7);

    await u.client.from('projects').update({ status: 'frogged' }).eq('id', active.project.id);
    const { data: after } = await u.client.from('yarn_stock').select().eq('yarn_id', yarn!.id).single();
    expect(Number(after!.used)).toBeCloseTo(0.3);
    expect(Number(after!.reserved)).toBe(0);
    expect(Number(after!.free)).toBeCloseTo(2.7);
  });

  test('a yarn nobody uses is entirely free', async () => {
    const { data: yarn } = await u.client.from('yarns').insert({ name: 'Idle', skeins_owned: 2 }).select().single();
    const { data: s } = await u.client.from('yarn_stock').select().eq('yarn_id', yarn!.id).single();
    expect(Number(s!.used)).toBe(0);
    expect(Number(s!.reserved)).toBe(0);
    expect(Number(s!.free)).toBe(2);
  });
});

test('project_summary counts parts, time and skeins', async () => {
  const { project: p, part } = await project('Summary', 'in_progress');
  await u.client.from('parts').insert({ project_id: p.id, name: 'Head', position: 1, done: true });
  await u.client.from('time_sessions').insert({
    part_id: part.id, started_at: '2026-09-24T20:00:00Z', ended_at: '2026-09-24T20:25:00Z',
  });
  const { data: yarn } = await u.client.from('yarns').insert({ name: 'Y', skeins_owned: 5 }).select().single();
  await u.client.from('part_yarns').insert({ part_id: part.id, yarn_id: yarn!.id, skeins_used: 0.75 });

  const { data: s } = await u.client.from('project_summary').select().eq('project_id', p.id).single();
  expect(s!.parts_total).toBe(2);
  expect(s!.parts_done).toBe(1);
  expect(Number(s!.seconds)).toBe(1500);
  expect(Number(s!.skeins)).toBeCloseTo(0.75);
});

test('pattern_stats averages finished projects only', async () => {
  const { data: pattern } = await u.client.from('patterns').insert({ name: 'Stat' }).select().single();
  const one = await project('One', 'finished', pattern!.id);
  const two = await project('Two', 'finished', pattern!.id);
  const wip = await project('Wip', 'in_progress', pattern!.id);
  await u.client.from('time_sessions').insert([
    { part_id: one.part.id, started_at: '2026-09-01T10:00:00Z', ended_at: '2026-09-01T11:00:00Z' },
    { part_id: two.part.id, started_at: '2026-09-02T10:00:00Z', ended_at: '2026-09-02T10:30:00Z' },
    { part_id: wip.part.id, started_at: '2026-09-03T10:00:00Z', ended_at: '2026-09-03T15:00:00Z' },
  ]);

  const { data: s } = await u.client.from('pattern_stats').select().eq('pattern_id', pattern!.id).single();
  expect(s!.times_made).toBe(2);
  expect(Number(s!.avg_seconds)).toBe(2700);

  const { data: fresh } = await u.client.from('patterns').insert({ name: 'Never' }).select().single();
  const { data: none } = await u.client.from('pattern_stats').select().eq('pattern_id', fresh!.id).single();
  expect(none!.times_made).toBe(0);
  expect(none!.avg_seconds).toBeNull();
});
```

- [ ] **Step 2: Run to verify failure**

Run: `npm run test:db -- supabase/tests/views.test.ts`
Expected: FAIL with `relation "public.yarn_stock" does not exist`.

- [ ] **Step 3: Write `supabase/migrations/20260924000002_views.sql`**

```sql
create view public.yarn_stock with (security_invoker = true) as
with usage as (
  select pt.project_id, pr.status, py.yarn_id, sum(py.skeins_used) as used
  from public.part_yarns py
  join public.parts pt on pt.id = py.part_id
  join public.projects pr on pr.id = pt.project_id
  group by pt.project_id, pr.status, py.yarn_id
),
used as (
  select yarn_id, sum(used) as used
  from usage
  where status <> 'frogged'
  group by yarn_id
),
reserved as (
  select pj.yarn_id, sum(greatest(pj.skeins_planned - coalesce(u.used, 0), 0)) as reserved
  from public.project_yarns pj
  join public.projects pr on pr.id = pj.project_id
  left join usage u on u.project_id = pj.project_id and u.yarn_id = pj.yarn_id
  where pr.status in ('idea', 'in_progress')
  group by pj.yarn_id
)
select
  y.id as yarn_id,
  y.user_id,
  y.skeins_owned as owned,
  coalesce(u.used, 0) as used,
  coalesce(r.reserved, 0) as reserved,
  y.skeins_owned - coalesce(u.used, 0) - coalesce(r.reserved, 0) as free
from public.yarns y
left join used u on u.yarn_id = y.id
left join reserved r on r.yarn_id = y.id;

create view public.project_summary with (security_invoker = true) as
select
  pr.id as project_id,
  pr.user_id,
  (select count(*) from public.parts p where p.project_id = pr.id)::int as parts_total,
  (select count(*) from public.parts p where p.project_id = pr.id and p.done)::int as parts_done,
  (select coalesce(sum(extract(epoch from coalesce(ts.ended_at, now()) - ts.started_at)), 0)
     from public.time_sessions ts join public.parts p on p.id = ts.part_id
     where p.project_id = pr.id)::bigint as seconds,
  (select coalesce(sum(py.skeins_used), 0)
     from public.part_yarns py join public.parts p on p.id = py.part_id
     where p.project_id = pr.id) as skeins
from public.projects pr;

create view public.pattern_stats with (security_invoker = true) as
select
  pa.id as pattern_id,
  pa.user_id,
  count(ps.project_id)::int as times_made,
  round(avg(ps.seconds))::bigint as avg_seconds,
  round(avg(ps.skeins), 2) as avg_skeins
from public.patterns pa
left join public.projects pr on pr.pattern_id = pa.id and pr.status = 'finished'
left join public.project_summary ps on ps.project_id = pr.id
group by pa.id, pa.user_id;
```

- [ ] **Step 4: Push and run the tests**

Run: `npm run db:push:test`, then `npm run test:db`. Expected: PASS (schema and views tests).

- [ ] **Step 5: Regenerate types and commit**

Run: `npm run db:types`

```bash
git add supabase src/lib/database.types.ts
git commit -m "feat: add yarn stock, project summary and pattern stats views"
```

---

### Task 6: Database functions and triggers

**Files:**
- Create: `supabase/migrations/20260924000003_functions.sql`
- Test: `supabase/tests/functions.test.ts`
- Modify: `src/lib/database.types.ts` (regenerated)

**Interfaces:**
- Consumes: tables from Task 4.
- Produces RPCs (called as `supabase.rpc(name, args)`):
  - `start_project_from_pattern({ p_pattern_id: string }): string` (new project id)
  - `start_timer({ p_part_id: string }): time_sessions row`: stops the running session first.
  - `stop_timer(): void`
- Produces triggers: a blank project (`pattern_id is null` at insert) gets a part named "Main"; `finish_date` becomes today when the status changes to `finished` and it is empty.

- [ ] **Step 1: Write the failing tests in `supabase/tests/functions.test.ts`**

```ts
import { createTestUser, deleteTestUser, type TestUser } from './helpers';

let u: TestUser;
let other: TestUser;
beforeAll(async () => {
  u = await createTestUser();
  other = await createTestUser();
});
afterAll(async () => {
  await deleteTestUser(u);
  await deleteTestUser(other);
});

async function tRexPattern(client = u.client) {
  const { data: pattern } = await client
    .from('patterns').insert({ name: 'T-rex', hook_size_mm: 3.5 }).select().single();
  await client.from('pattern_parts').insert([
    { pattern_id: pattern!.id, name: 'Head', position: 0, count: 1, total_rows: 24 },
    { pattern_id: pattern!.id, name: 'Leg', position: 1, count: 2, total_rows: 18 },
    { pattern_id: pattern!.id, name: 'Spikes', position: 2, count: 1 },
  ]);
  return pattern!;
}

describe('start_project_from_pattern', () => {
  test('creates the project and copies expanded parts in order', async () => {
    const pattern = await tRexPattern();
    const { data: projectId, error } = await u.client.rpc('start_project_from_pattern', { p_pattern_id: pattern.id });
    expect(error).toBeNull();

    const { data: project } = await u.client.from('projects').select().eq('id', projectId).single();
    expect(project).toMatchObject({
      name: 'T-rex', pattern_id: pattern.id, status: 'in_progress', start_date: new Date().toISOString().slice(0, 10),
    });
    expect(Number(project!.hook_size_mm)).toBe(3.5);

    const { data: parts } = await u.client
      .from('parts').select('name, position, total_rows, current_row, done').eq('project_id', projectId).order('position');
    expect(parts).toEqual([
      { name: 'Head', position: 0, total_rows: 24, current_row: null, done: false },
      { name: 'Leg 1', position: 1, total_rows: 18, current_row: null, done: false },
      { name: 'Leg 2', position: 2, total_rows: 18, current_row: null, done: false },
      { name: 'Spikes', position: 3, total_rows: null, current_row: null, done: false },
    ]);
  });

  test('changing the project hook leaves the pattern recommendation alone', async () => {
    const pattern = await tRexPattern();
    const { data: projectId } = await u.client.rpc('start_project_from_pattern', { p_pattern_id: pattern.id });
    await u.client.from('projects').update({ hook_size_mm: 4 }).eq('id', projectId);
    const { data } = await u.client.from('patterns').select('hook_size_mm').eq('id', pattern.id).single();
    expect(Number(data!.hook_size_mm)).toBe(3.5);
  });

  test('fails for a pattern the user cannot see, creating nothing', async () => {
    const foreign = await tRexPattern(other.client);
    const before = await u.client.from('projects').select('id', { count: 'exact', head: true });
    const { error } = await u.client.rpc('start_project_from_pattern', { p_pattern_id: foreign.id });
    expect(error).not.toBeNull();
    const after = await u.client.from('projects').select('id', { count: 'exact', head: true });
    expect(after.count).toBe(before.count);
  });
});

test('a blank project gets a "Main" part', async () => {
  const { data: project } = await u.client.from('projects').insert({ name: 'Blank' }).select().single();
  const { data: parts } = await u.client.from('parts').select('name').eq('project_id', project!.id);
  expect(parts).toEqual([{ name: 'Main' }]);
});

test('finishing a project sets finish_date once', async () => {
  const { data: project } = await u.client.from('projects').insert({ name: 'Done soon' }).select().single();
  await u.client.from('projects').update({ status: 'finished' }).eq('id', project!.id);
  const { data } = await u.client.from('projects').select('finish_date').eq('id', project!.id).single();
  expect(data!.finish_date).toBe(new Date().toISOString().slice(0, 10));

  await u.client.from('projects').update({ finish_date: '2026-01-01' }).eq('id', project!.id);
  await u.client.from('projects').update({ status: 'finished', notes: 'x' }).eq('id', project!.id);
  const { data: again } = await u.client.from('projects').select('finish_date').eq('id', project!.id).single();
  expect(again!.finish_date).toBe('2026-01-01');
});

describe('timer', () => {
  test('start_timer stops the running session before starting a new one', async () => {
    const { data: project } = await u.client.from('projects').insert({ name: 'Timed' }).select().single();
    const { data: parts } = await u.client.from('parts').select('id').eq('project_id', project!.id);
    const { data: second } = await u.client
      .from('parts').insert({ project_id: project!.id, name: 'Second', position: 1 }).select().single();

    const first = await u.client.rpc('start_timer', { p_part_id: parts![0].id });
    expect(first.error).toBeNull();
    await new Promise((r) => setTimeout(r, 1100));
    const next = await u.client.rpc('start_timer', { p_part_id: second!.id });
    expect(next.error).toBeNull();

    const { data: running } = await u.client.from('time_sessions').select('part_id').is('ended_at', null);
    expect(running).toEqual([{ part_id: second!.id }]);

    await new Promise((r) => setTimeout(r, 1100));
    const stop = await u.client.rpc('stop_timer');
    expect(stop.error).toBeNull();
    const { data: none } = await u.client.from('time_sessions').select('id').is('ended_at', null);
    expect(none).toEqual([]);
  });
});
```

- [ ] **Step 2: Run to verify failure**

Run: `npm run test:db -- supabase/tests/functions.test.ts`
Expected: FAIL with `Could not find the function public.start_project_from_pattern`.

- [ ] **Step 3: Write `supabase/migrations/20260924000003_functions.sql`**

```sql
create function public.start_project_from_pattern(p_pattern_id uuid) returns uuid
language plpgsql security invoker set search_path = public as $$
declare
  v_pattern public.patterns%rowtype;
  v_project uuid;
  v_part record;
  v_pos int := 0;
begin
  select * into v_pattern from public.patterns where id = p_pattern_id;
  if not found then
    raise exception 'pattern % not found', p_pattern_id using errcode = 'P0002';
  end if;

  insert into public.projects (name, pattern_id, status, start_date, hook_size_mm)
  values (v_pattern.name, v_pattern.id, 'in_progress', current_date, v_pattern.hook_size_mm)
  returning id into v_project;

  for v_part in
    select name, count, total_rows from public.pattern_parts
    where pattern_id = p_pattern_id order by position, created_at
  loop
    for i in 1..v_part.count loop
      insert into public.parts (project_id, name, position, total_rows)
      values (
        v_project,
        case when v_part.count = 1 then v_part.name else v_part.name || ' ' || i end,
        v_pos,
        v_part.total_rows
      );
      v_pos := v_pos + 1;
    end loop;
  end loop;

  return v_project;
end $$;

create function public.add_main_part() returns trigger
language plpgsql security invoker set search_path = public as $$
begin
  if new.pattern_id is null then
    insert into public.parts (project_id, user_id, name, position) values (new.id, new.user_id, 'Main', 0);
  end if;
  return new;
end $$;

create trigger add_main_part after insert on public.projects
  for each row execute function public.add_main_part();

create function public.set_finish_date() returns trigger
language plpgsql as $$
begin
  if new.status = 'finished' and new.finish_date is null
     and (tg_op = 'INSERT' or old.status is distinct from 'finished') then
    new.finish_date := current_date;
  end if;
  return new;
end $$;

create trigger set_finish_date before insert or update on public.projects
  for each row execute function public.set_finish_date();

create function public.start_timer(p_part_id uuid) returns public.time_sessions
language plpgsql security invoker set search_path = public as $$
declare
  v_session public.time_sessions;
begin
  update public.time_sessions set ended_at = now()
  where user_id = auth.uid() and ended_at is null;

  insert into public.time_sessions (part_id) values (p_part_id)
  returning * into v_session;
  return v_session;
end $$;

create function public.stop_timer() returns void
language sql security invoker set search_path = public as $$
  update public.time_sessions set ended_at = now()
  where user_id = auth.uid() and ended_at is null;
$$;
```

Note on `start_timer`: `now()` is the transaction start time, so the stopped session always ends strictly after it started (it began in an earlier transaction), which satisfies the `ended_at > started_at` check.

- [ ] **Step 4: Push and run the tests**

Run: `npm run db:push:test`, then `npm run test:db`. Expected: PASS (all database tests so far).

- [ ] **Step 5: Regenerate types and commit**

Run: `npm run db:types`

```bash
git add supabase src/lib/database.types.ts
git commit -m "feat: add project-from-pattern, timer and project triggers"
```

---

### Task 7: Storage buckets and policies

**Files:**
- Create: `supabase/migrations/20260924000004_storage.sql`
- Test: `supabase/tests/storage.test.ts`

**Interfaces:**
- Produces private buckets `pattern-pdfs` (PDF, ≤ 20 MB), `project-photos` and `yarn-photos` (JPEG, ≤ 5 MB). A user may read and write only objects whose first folder is their user id.

- [ ] **Step 1: Write the failing tests in `supabase/tests/storage.test.ts`**

```ts
import { createTestUser, deleteTestUser, type TestUser } from './helpers';

let a: TestUser;
let b: TestUser;
beforeAll(async () => {
  a = await createTestUser();
  b = await createTestUser();
});
afterAll(async () => {
  await a.client.storage.from('yarn-photos').remove([`${a.id}/ball.jpg`]);
  await deleteTestUser(a);
  await deleteTestUser(b);
});

const jpeg = new Blob([new Uint8Array([0xff, 0xd8, 0xff, 0xd9])], { type: 'image/jpeg' });

test('a user can upload and read in their own folder', async () => {
  const up = await a.client.storage.from('yarn-photos').upload(`${a.id}/ball.jpg`, jpeg, { contentType: 'image/jpeg' });
  expect(up.error).toBeNull();
  const signed = await a.client.storage.from('yarn-photos').createSignedUrl(`${a.id}/ball.jpg`, 60);
  expect(signed.error).toBeNull();
});

test('a user cannot upload into someone else folder', async () => {
  const up = await b.client.storage.from('yarn-photos').upload(`${a.id}/intruder.jpg`, jpeg, { contentType: 'image/jpeg' });
  expect(up.error).not.toBeNull();
});

test('a user cannot read someone else file', async () => {
  const signed = await b.client.storage.from('yarn-photos').createSignedUrl(`${a.id}/ball.jpg`, 60);
  expect(signed.error).not.toBeNull();
});

test('pattern-pdfs only accepts PDFs', async () => {
  const up = await a.client.storage.from('pattern-pdfs').upload(`${a.id}/x.jpg`, jpeg, { contentType: 'image/jpeg' });
  expect(up.error).not.toBeNull();
});
```

- [ ] **Step 2: Run to verify failure**

Run: `npm run test:db -- supabase/tests/storage.test.ts`
Expected: FAIL with `Bucket not found`.

- [ ] **Step 3: Write `supabase/migrations/20260924000004_storage.sql`**

```sql
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types) values
  ('pattern-pdfs', 'pattern-pdfs', false, 20971520, array['application/pdf']),
  ('project-photos', 'project-photos', false, 5242880, array['image/jpeg']),
  ('yarn-photos', 'yarn-photos', false, 5242880, array['image/jpeg']);

create policy "own folder read" on storage.objects for select to authenticated
  using (bucket_id in ('pattern-pdfs', 'project-photos', 'yarn-photos')
         and (storage.foldername(name))[1] = auth.uid()::text);

create policy "own folder insert" on storage.objects for insert to authenticated
  with check (bucket_id in ('pattern-pdfs', 'project-photos', 'yarn-photos')
              and (storage.foldername(name))[1] = auth.uid()::text);

create policy "own folder update" on storage.objects for update to authenticated
  using (bucket_id in ('pattern-pdfs', 'project-photos', 'yarn-photos')
         and (storage.foldername(name))[1] = auth.uid()::text);

create policy "own folder delete" on storage.objects for delete to authenticated
  using (bucket_id in ('pattern-pdfs', 'project-photos', 'yarn-photos')
         and (storage.foldername(name))[1] = auth.uid()::text);
```

- [ ] **Step 4: Push and run the tests**

Run: `npm run db:push:test`, then `npm run test:db`. Expected: PASS (all database tests).

- [ ] **Step 5: Push everything to the real project and commit**

Run: `npm run db:push`. Expected: the four migrations applied to the **crochet** project.

```bash
git add supabase
git commit -m "feat: add private storage buckets with per-user folders"
```

---

### Task 8: Supabase client, sign-in and app shell

**Files:**
- Create: `src/lib/supabase.ts`, `src/features/auth/useSession.ts`, `src/features/auth/Login.tsx`, `src/components/icons.tsx`, `src/components/TabBar.tsx`, `src/components/Layout.tsx`
- Modify: `src/App.tsx` (replace), `src/App.test.tsx` (replace)
- Test: `src/features/auth/Login.test.tsx`, `src/components/TabBar.test.tsx`

**Interfaces:**
- Consumes: `Database` type from `src/lib/database.types.ts`.
- Produces:
  - `supabase` (typed client), `type Tables<'yarns'>`-style row helper `Tables<T>`, and `Views<T>` in `src/lib/supabase.ts`.
  - `useSession(): Session | null | undefined` (`undefined` while loading).
  - `GridIcon`, `HookIcon`, `YarnIcon`, `HourglassIcon` (`(props: { className?: string }) => JSX.Element`) in `src/components/icons.tsx`.
  - `TabBar`, and `Layout` (renders `<Outlet />`, then a fixed bottom stack with the tab bar). Task 14 adds the timer bar to `Layout`.
  - Routes in `App.tsx` inside `<Route element={<Layout />}>`. Later tasks add their routes there.

- [ ] **Step 1: Create `src/lib/supabase.ts`**

```ts
import { createClient } from '@supabase/supabase-js';
import type { Database } from './database.types';

const url = import.meta.env.VITE_SUPABASE_URL;
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
if (!url || !anonKey) {
  throw new Error('Missing VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY (see .env.example)');
}

export const supabase = createClient<Database>(url, anonKey);

export type Tables<T extends keyof Database['public']['Tables']> = Database['public']['Tables'][T]['Row'];
export type Views<T extends keyof Database['public']['Views']> = Database['public']['Views'][T]['Row'];
```

- [ ] **Step 2: Write the failing tests**

`src/features/auth/Login.test.tsx`:
```tsx
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import Login from './Login';

const signInWithOtp = vi.fn();
vi.mock('../../lib/supabase', () => ({ supabase: { auth: { signInWithOtp: (...a: unknown[]) => signInWithOtp(...a) } } }));

beforeEach(() => signInWithOtp.mockReset());

test('sends a magic link and confirms', async () => {
  signInWithOtp.mockResolvedValue({ error: null });
  render(<Login />);
  await userEvent.type(screen.getByLabelText('Email'), 'me@example.com');
  await userEvent.click(screen.getByRole('button', { name: 'Send me a link' }));
  expect(signInWithOtp).toHaveBeenCalledWith({
    email: 'me@example.com',
    options: { emailRedirectTo: window.location.origin },
  });
  expect(await screen.findByText('Check your email for the sign-in link.')).toBeInTheDocument();
});

test('shows the error when sending fails', async () => {
  signInWithOtp.mockResolvedValue({ error: { message: 'Rate limit exceeded' } });
  render(<Login />);
  await userEvent.type(screen.getByLabelText('Email'), 'me@example.com');
  await userEvent.click(screen.getByRole('button', { name: 'Send me a link' }));
  expect(await screen.findByRole('alert')).toHaveTextContent('Rate limit exceeded');
});
```

`src/components/TabBar.test.tsx`:
```tsx
import { screen } from '@testing-library/react';
import { renderWithProviders } from '../test/render';
import TabBar from './TabBar';

test('highlights the section of the current page', () => {
  renderWithProviders(<TabBar />, { route: '/patterns/abc', path: '/patterns/:id' });
  const patterns = screen.getByRole('link', { name: 'Patterns' });
  expect(patterns).toHaveAttribute('aria-current', 'page');
  expect(patterns).toHaveClass('text-patterns');
  expect(screen.getByRole('link', { name: 'Projects' })).toHaveClass('text-muted');
});

test('part pages belong to Projects', () => {
  renderWithProviders(<TabBar />, { route: '/parts/xyz', path: '/parts/:id' });
  expect(screen.getByRole('link', { name: 'Projects' })).toHaveAttribute('aria-current', 'page');
});
```

`src/App.test.tsx` (replace):
```tsx
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import App from './App';

const session = vi.hoisted(() => ({ value: null as unknown }));
vi.mock('./features/auth/useSession', () => ({ useSession: () => session.value }));
vi.mock('./lib/supabase', () => ({ supabase: { auth: { signInWithOtp: vi.fn() } } }));

function renderApp() {
  return render(
    <QueryClientProvider client={new QueryClient()}>
      <MemoryRouter><App /></MemoryRouter>
    </QueryClientProvider>,
  );
}

test('signed out shows the login screen', () => {
  session.value = null;
  renderApp();
  expect(screen.getByRole('heading', { name: 'Crochet Tracker' })).toBeInTheDocument();
});

test('signed in shows the tab bar', () => {
  session.value = { user: { id: 'u1' } };
  renderApp();
  expect(screen.getByRole('link', { name: 'Stash' })).toBeInTheDocument();
});
```

- [ ] **Step 3: Run to verify failure**

Run: `npm test`
Expected: FAIL with `Failed to resolve import "./Login"` and `"./TabBar"`.

- [ ] **Step 4: Implement sign-in**

`src/features/auth/useSession.ts`:
```ts
import type { Session } from '@supabase/supabase-js';
import { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';

export function useSession(): Session | null | undefined {
  const [session, setSession] = useState<Session | null | undefined>(undefined);
  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSession(data.session));
    const { data } = supabase.auth.onAuthStateChange((_event, s) => setSession(s));
    return () => data.subscription.unsubscribe();
  }, []);
  return session;
}
```

`src/features/auth/Login.tsx`:
```tsx
import { useState, type FormEvent } from 'react';
import { supabase } from '../../lib/supabase';

export default function Login() {
  const [email, setEmail] = useState('');
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: { emailRedirectTo: window.location.origin },
    });
    if (error) setError(error.message);
    else setSent(true);
  }

  return (
    <main className="mx-auto flex min-h-dvh max-w-sm flex-col justify-center gap-6 p-6">
      <h1 className="text-5xl text-projects">Crochet Tracker</h1>
      {sent ? (
        <p className="text-xl">Check your email for the sign-in link.</p>
      ) : (
        <form onSubmit={submit} className="flex flex-col gap-4">
          <label className="flex flex-col gap-2 text-lg text-muted">
            Email
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="h-12 rounded-xl border border-line bg-surface px-3 text-ink"
            />
          </label>
          <button type="submit" className="h-12 rounded-full bg-projects text-lg text-white">
            Send me a link
          </button>
          {error && <p role="alert" className="text-projects-dark">{error}</p>}
        </form>
      )}
    </main>
  );
}
```

- [ ] **Step 5: Implement the icons, tab bar and layout**

`src/components/icons.tsx`:
```tsx
type IconProps = { className?: string };

const base = {
  width: 24, height: 24, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor',
  strokeWidth: 1.8, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const, 'aria-hidden': true,
};

export function GridIcon({ className }: IconProps) {
  return (
    <svg {...base} className={className}>
      <rect x="3" y="3" width="7" height="7" rx="2" /><rect x="14" y="3" width="7" height="7" rx="2" />
      <rect x="3" y="14" width="7" height="7" rx="2" /><rect x="14" y="14" width="7" height="7" rx="2" />
    </svg>
  );
}

export function HookIcon({ className }: IconProps) {
  return (
    <svg {...base} className={className}>
      <path d="M5 19 16.5 7.5" />
      <path d="M16.5 7.5c1.2-1.2 1.6-3.2.6-4.2s-2.9-.4-3.4.8c-.3.7.3 1.4 1.1 1.1" />
      <path d="M3.5 20.5 7 17" />
    </svg>
  );
}

export function YarnIcon({ className }: IconProps) {
  return (
    <svg {...base} className={className}>
      <circle cx="12" cy="12" r="8.5" /><path d="M5 8c4 1 10 1 14 0" />
      <path d="M4 13c5 1.5 11 1.5 16 0" /><path d="M7 18.5c3.5 1 7 1 10 0" />
    </svg>
  );
}

export function HourglassIcon({ className }: IconProps) {
  return (
    <svg {...base} className={className}>
      <path d="M6 3h12" /><path d="M6 21h12" />
      <path d="M7.5 3v2c0 3 4.5 5 4.5 7s-4.5 4-4.5 7v2" />
      <path d="M16.5 3v2c0 3-4.5 5-4.5 7s4.5 4 4.5 7v2" />
      <path d="M9.5 19h5" />
    </svg>
  );
}
```

`src/components/TabBar.tsx`:
```tsx
import { Link, useLocation } from 'react-router';
import { GridIcon, HookIcon, HourglassIcon, YarnIcon } from './icons';

const tabs = [
  { to: '/', label: 'Projects', Icon: GridIcon, on: 'text-projects',
    match: (p: string) => p === '/' || p.startsWith('/projects') || p.startsWith('/parts') },
  { to: '/patterns', label: 'Patterns', Icon: HookIcon, on: 'text-patterns', match: (p: string) => p.startsWith('/patterns') },
  { to: '/stash', label: 'Stash', Icon: YarnIcon, on: 'text-stash', match: (p: string) => p.startsWith('/stash') },
  { to: '/timer', label: 'Timer', Icon: HourglassIcon, on: 'text-timer', match: (p: string) => p.startsWith('/timer') },
];

export default function TabBar() {
  const { pathname } = useLocation();
  return (
    <nav className="flex h-[72px] border-t border-line bg-surface">
      {tabs.map(({ to, label, Icon, on, match }) => {
        const active = match(pathname);
        return (
          <Link
            key={to}
            to={to}
            aria-current={active ? 'page' : undefined}
            className={`flex flex-1 flex-col items-center justify-center gap-1 text-xs ${active ? on : 'text-muted'}`}
          >
            <Icon />
            {label}
          </Link>
        );
      })}
    </nav>
  );
}
```

`src/components/Layout.tsx`:
```tsx
import { Outlet } from 'react-router';
import TabBar from './TabBar';

export default function Layout() {
  return (
    <div className="mx-auto min-h-dvh max-w-md">
      <div className="pb-36">
        <Outlet />
      </div>
      <div className="fixed inset-x-0 bottom-0 mx-auto max-w-md">
        <TabBar />
      </div>
    </div>
  );
}
```

`src/App.tsx` (replace):
```tsx
import { Route, Routes } from 'react-router';
import Layout from './components/Layout';
import Login from './features/auth/Login';
import { useSession } from './features/auth/useSession';

export default function App() {
  const session = useSession();
  if (session === undefined) return <p className="p-6 text-muted">Loading…</p>;
  if (session === null) return <Login />;
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route index element={<h1 className="p-4 text-3xl">Projects</h1>} />
      </Route>
    </Routes>
  );
}
```

- [ ] **Step 6: Run the tests and try it**

Run: `npm test`. Expected: PASS.
Run: `npm run dev` with `.env` filled. Expected: login screen; entering your email sends a magic link; clicking it signs you in and shows "Projects" with the tab bar.

- [ ] **Step 7: Commit**

```bash
git add src
git commit -m "feat: add magic-link sign-in, tab bar and layout"
```

---

### Task 9: Shared components, image resize and storage helpers

**Files:**
- Create: `src/components/ErrorBox.tsx`, `src/components/ConfirmDialog.tsx`, `src/components/HookSelect.tsx`, `src/lib/images.ts`, `src/lib/storage.ts`
- Test: `src/components/HookSelect.test.tsx`, `src/components/ConfirmDialog.test.tsx`, `src/components/ErrorBox.test.tsx`, `src/lib/images.test.ts`

**Interfaces:**
- Consumes: `hookSizeOptions`, `formatHook` from `src/lib/calc.ts`; `supabase` from `src/lib/supabase.ts`.
- Produces:
  - `ErrorBox({ error: unknown, onRetry?: () => void })`: shows "Something went wrong: <message>" plus a **Try again** button; also used for the offline case.
  - `ConfirmDialog({ open: boolean, title: string, message: string, confirmLabel: string, onConfirm: () => void, onCancel: () => void })`
  - `HookSelect({ label: string, value: number | null, onChange: (mm: number | null) => void })`: options "—" plus 1.0 mm to 12.0 mm.
  - `fitWithin(width: number, height: number, max: number): { width: number; height: number }`
  - `resizeImage(file: Blob): Promise<Blob>`: JPEG, max 1600 px, quality 0.8.
  - `type Bucket = 'pattern-pdfs' | 'project-photos' | 'yarn-photos'`
  - `uploadFile(bucket: Bucket, file: Blob, ext: 'jpg' | 'pdf'): Promise<string>`: returns the stored path `<user_id>/<uuid>.<ext>`.
  - `removeFile(bucket: Bucket, path: string): Promise<void>`
  - `useSignedUrl(bucket: Bucket, path: string | null): string | undefined`
  - `MAX_PDF_BYTES = 20 * 1024 * 1024`

- [ ] **Step 1: Write the failing tests**

`src/lib/images.test.ts`:
```ts
import { fitWithin } from './images';

test.each([
  [4000, 3000, 1600, { width: 1600, height: 1200 }],
  [3000, 4000, 1600, { width: 1200, height: 1600 }],
  [800, 600, 1600, { width: 800, height: 600 }],
])('fitWithin(%i, %i, %i)', (w, h, max, out) => {
  expect(fitWithin(w, h, max)).toEqual(out);
});
```

`src/components/HookSelect.test.tsx`:
```tsx
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import HookSelect from './HookSelect';

test('offers — and 1.0 to 12.0 mm, and reports numbers', async () => {
  const onChange = vi.fn();
  render(<HookSelect label="Recommended hook" value={3.5} onChange={onChange} />);
  const select = screen.getByLabelText('Recommended hook');
  expect(screen.getAllByRole('option')).toHaveLength(24);
  expect(select).toHaveValue('3.5');
  await userEvent.selectOptions(select, '4.0 mm');
  expect(onChange).toHaveBeenLastCalledWith(4);
  await userEvent.selectOptions(select, '—');
  expect(onChange).toHaveBeenLastCalledWith(null);
});
```

`src/components/ConfirmDialog.test.tsx`:
```tsx
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import ConfirmDialog from './ConfirmDialog';

test('confirm and cancel call their handlers', async () => {
  const onConfirm = vi.fn();
  const onCancel = vi.fn();
  render(
    <ConfirmDialog open title="Delete part?" message="Its time is deleted too." confirmLabel="Delete"
      onConfirm={onConfirm} onCancel={onCancel} />,
  );
  expect(screen.getByRole('dialog', { name: 'Delete part?' })).toBeInTheDocument();
  await userEvent.click(screen.getByRole('button', { name: 'Delete' }));
  await userEvent.click(screen.getByRole('button', { name: 'Cancel' }));
  expect(onConfirm).toHaveBeenCalledOnce();
  expect(onCancel).toHaveBeenCalledOnce();
});

test('renders nothing when closed', () => {
  render(<ConfirmDialog open={false} title="X" message="Y" confirmLabel="OK" onConfirm={vi.fn()} onCancel={vi.fn()} />);
  expect(screen.queryByRole('dialog')).toBeNull();
});
```

`src/components/ErrorBox.test.tsx`:
```tsx
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import ErrorBox from './ErrorBox';

test('shows the message and retries', async () => {
  const onRetry = vi.fn();
  render(<ErrorBox error={new Error('Failed to fetch')} onRetry={onRetry} />);
  expect(screen.getByRole('alert')).toHaveTextContent('Something went wrong: Failed to fetch');
  await userEvent.click(screen.getByRole('button', { name: 'Try again' }));
  expect(onRetry).toHaveBeenCalledOnce();
});
```

- [ ] **Step 2: Run to verify failure**

Run: `npm test`
Expected: FAIL with unresolved imports `./images`, `./HookSelect`, `./ConfirmDialog`, `./ErrorBox`.

- [ ] **Step 3: Implement**

`src/lib/images.ts`:
```ts
export function fitWithin(width: number, height: number, max: number) {
  const scale = Math.min(1, max / Math.max(width, height));
  return { width: Math.round(width * scale), height: Math.round(height * scale) };
}

export async function resizeImage(file: Blob): Promise<Blob> {
  const bitmap = await createImageBitmap(file);
  const { width, height } = fitWithin(bitmap.width, bitmap.height, 1600);
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  canvas.getContext('2d')!.drawImage(bitmap, 0, 0, width, height);
  bitmap.close();
  return new Promise((resolve, reject) =>
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('Could not resize image'))), 'image/jpeg', 0.8),
  );
}
```

`src/lib/storage.ts`:
```ts
import { useQuery } from '@tanstack/react-query';
import { supabase } from './supabase';

export type Bucket = 'pattern-pdfs' | 'project-photos' | 'yarn-photos';
export const MAX_PDF_BYTES = 20 * 1024 * 1024;

export async function uploadFile(bucket: Bucket, file: Blob, ext: 'jpg' | 'pdf'): Promise<string> {
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) throw new Error('Not signed in');
  const path = `${auth.user.id}/${crypto.randomUUID()}.${ext}`;
  const contentType = ext === 'pdf' ? 'application/pdf' : 'image/jpeg';
  const { error } = await supabase.storage.from(bucket).upload(path, file, { contentType });
  if (error) throw error;
  return path;
}

export async function removeFile(bucket: Bucket, path: string): Promise<void> {
  const { error } = await supabase.storage.from(bucket).remove([path]);
  if (error) throw error;
}

export function useSignedUrl(bucket: Bucket, path: string | null): string | undefined {
  const { data } = useQuery({
    queryKey: ['signed-url', bucket, path],
    enabled: path !== null,
    staleTime: 50 * 60 * 1000,
    queryFn: async () => {
      const { data, error } = await supabase.storage.from(bucket).createSignedUrl(path!, 60 * 60);
      if (error) throw error;
      return data.signedUrl;
    },
  });
  return data;
}
```

`src/components/ErrorBox.tsx`:
```tsx
export default function ErrorBox({ error, onRetry }: { error: unknown; onRetry?: () => void }) {
  const message = error instanceof Error ? error.message : String(error);
  return (
    <div role="alert" className="m-4 flex flex-col gap-3 rounded-2xl border border-line bg-surface p-4">
      <p>Something went wrong: {message}</p>
      {onRetry && (
        <button type="button" onClick={onRetry} className="h-11 self-start rounded-full bg-ink px-5 text-white">
          Try again
        </button>
      )}
    </div>
  );
}
```

`src/components/ConfirmDialog.tsx`:
```tsx
import { useId } from 'react';

type Props = {
  open: boolean; title: string; message: string; confirmLabel: string;
  onConfirm: () => void; onCancel: () => void;
};

export default function ConfirmDialog({ open, title, message, confirmLabel, onConfirm, onCancel }: Props) {
  const titleId = useId();
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-ink/40 p-4">
      <div role="dialog" aria-modal="true" aria-labelledby={titleId}
        className="flex w-full max-w-md flex-col gap-3 rounded-3xl bg-surface p-5">
        <h2 id={titleId} className="text-2xl">{title}</h2>
        <p className="text-muted">{message}</p>
        <div className="flex justify-end gap-2">
          <button type="button" onClick={onCancel} className="h-11 rounded-full border border-line px-5">Cancel</button>
          <button type="button" onClick={onConfirm} className="h-11 rounded-full bg-projects px-5 text-white">
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
```

`src/components/HookSelect.tsx`:
```tsx
import { useId } from 'react';
import { formatHook, hookSizeOptions } from '../lib/calc';

type Props = { label: string; value: number | null; onChange: (mm: number | null) => void };

export default function HookSelect({ label, value, onChange }: Props) {
  const id = useId();
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className="text-sm text-muted">{label}</label>
      <select
        id={id}
        value={value === null ? '' : String(value)}
        onChange={(e) => onChange(e.target.value === '' ? null : Number(e.target.value))}
        className="h-12 rounded-xl border border-line bg-surface px-3"
      >
        <option value="">—</option>
        {hookSizeOptions().map((mm) => (
          <option key={mm} value={String(mm)}>{formatHook(mm)}</option>
        ))}
      </select>
    </div>
  );
}
```

- [ ] **Step 4: Run to verify pass**

Run: `npm test`. Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src
git commit -m "feat: add shared dialog, error box, hook select, image and storage helpers"
```

---

### Task 10: Stash (yarn list, form and page)

**Files:**
- Create: `src/lib/labels.ts`, `src/features/stash/logic.ts`, `src/features/stash/api.ts`, `src/features/stash/StashList.tsx`, `src/features/stash/YarnForm.tsx`, `src/features/stash/YarnPage.tsx`
- Modify: `src/App.tsx` (routes)
- Test: `src/features/stash/logic.test.ts`, `src/features/stash/StashList.test.tsx`, `src/features/stash/YarnPage.test.tsx`

**Interfaces:**
- Consumes: `supabase`, `Tables`, `Views` (Task 8); `stockBadge`, `formatSkeins`, `formatEuros` (Task 3); `ErrorBox`, `ConfirmDialog`, `resizeImage`, `uploadFile`, `useSignedUrl` (Task 9).
- Produces:
  - `src/lib/labels.ts`: `WEIGHTS: { value: YarnWeight; label: string }[]`, `weightLabel(w: YarnWeight | null): string`, `STATUS_LABELS: Record<ProjectStatus, string>` (`idea` "Ideas", `in_progress` "In progress", `finished` "Finished", `frogged` "Frogged"), types `YarnWeight`, `ProjectStatus`.
  - `src/features/stash/logic.ts`: `type YarnWithStock = Yarn & { owned: number; used: number; reserved: number; free: number }`, `filterYarns(yarns, { weight: YarnWeight | 'all'; fiber: string | 'all'; lowOnly: boolean })`, `type YarnUsageRow = { projectId: string; name: string; status: ProjectStatus; planned: number; used: number }`, `mergeYarnUsage(planned, used): YarnUsageRow[]`.
  - `src/features/stash/api.ts`: `useYarns()`, `useYarn(id: string | undefined)` (disabled when undefined), `toYarnInput(y)`, `useYarnUsage(id)`, `useSaveYarn()`, `useDeleteYarn()`. Query key `['yarns']` (every yarn and stock query key starts with it, so invalidating `['yarns']` refreshes all stash data). Later tasks invalidate `['yarns']` after changing yarn usage or plans.
  - Routes: `/stash`, `/stash/new`, `/stash/:id`, `/stash/:id/edit`.

- [ ] **Step 1: Create `src/lib/labels.ts`**

```ts
import type { Database } from './database.types';

export type YarnWeight = Database['public']['Enums']['yarn_weight'];
export type ProjectStatus = Database['public']['Enums']['project_status'];

export const WEIGHTS: { value: YarnWeight; label: string }[] = [
  { value: 'lace', label: 'Lace' },
  { value: 'fingering', label: 'Fingering' },
  { value: 'sport', label: 'Sport' },
  { value: 'dk', label: 'DK' },
  { value: 'worsted', label: 'Worsted' },
  { value: 'aran', label: 'Aran' },
  { value: 'bulky', label: 'Bulky' },
  { value: 'super_bulky', label: 'Super bulky' },
  { value: 'jumbo', label: 'Jumbo' },
];

export function weightLabel(w: YarnWeight | null): string {
  return WEIGHTS.find((x) => x.value === w)?.label ?? '';
}

export const STATUS_LABELS: Record<ProjectStatus, string> = {
  idea: 'Ideas',
  in_progress: 'In progress',
  finished: 'Finished',
  frogged: 'Frogged',
};
```

- [ ] **Step 2: Write the failing logic tests in `src/features/stash/logic.test.ts`**

```ts
import { filterYarns, mergeYarnUsage, type YarnWithStock } from './logic';

const yarn = (over: Partial<YarnWithStock>): YarnWithStock => ({
  id: 'y', user_id: 'u', brand: null, name: 'Y', color: null, yarn_weight: null, fiber: null,
  skeins_owned: 1, photo_path: null, bought_at: null, price_per_skein: null, bought_on: null, notes: null,
  created_at: '', updated_at: '', owned: 1, used: 0, reserved: 0, free: 1, ...over,
});

const yarns = [
  yarn({ id: 'a', yarn_weight: 'dk', fiber: 'Cotton', free: 3 }),
  yarn({ id: 'b', yarn_weight: 'worsted', fiber: 'Merino', free: 0.6 }),
  yarn({ id: 'c', yarn_weight: 'dk', fiber: 'Merino', free: 0 }),
];

test('filterYarns by weight, fiber and low stock', () => {
  const ids = (f: Parameters<typeof filterYarns>[1]) => filterYarns(yarns, f).map((y) => y.id);
  expect(ids({ weight: 'all', fiber: 'all', lowOnly: false })).toEqual(['a', 'b', 'c']);
  expect(ids({ weight: 'dk', fiber: 'all', lowOnly: false })).toEqual(['a', 'c']);
  expect(ids({ weight: 'all', fiber: 'Merino', lowOnly: false })).toEqual(['b', 'c']);
  expect(ids({ weight: 'all', fiber: 'all', lowOnly: true })).toEqual(['b', 'c']);
});

test('mergeYarnUsage combines planned and used per project', () => {
  const rows = mergeYarnUsage(
    [{ skeins_planned: 2, project: { id: 'p1', name: 'T-rex', status: 'in_progress' } }],
    [
      { skeins_used: 0.6, part: { project: { id: 'p1', name: 'T-rex', status: 'in_progress' } } },
      { skeins_used: 0.5, part: { project: { id: 'p1', name: 'T-rex', status: 'in_progress' } } },
      { skeins_used: 0.3, part: { project: { id: 'p2', name: 'Coasters', status: 'finished' } } },
    ],
  );
  expect(rows).toEqual([
    { projectId: 'p1', name: 'T-rex', status: 'in_progress', planned: 2, used: 1.1 },
    { projectId: 'p2', name: 'Coasters', status: 'finished', planned: 0, used: 0.3 },
  ]);
});
```

- [ ] **Step 3: Run to verify failure**

Run: `npm test -- src/features/stash`
Expected: FAIL with `Failed to resolve import "./logic"`.

- [ ] **Step 4: Implement `src/features/stash/logic.ts`**

```ts
import { stockBadge } from '../../lib/calc';
import type { ProjectStatus, YarnWeight } from '../../lib/labels';
import type { Tables } from '../../lib/supabase';

export type Yarn = Tables<'yarns'>;
export type YarnWithStock = Yarn & { owned: number; used: number; reserved: number; free: number };

export function filterYarns(
  yarns: YarnWithStock[],
  f: { weight: YarnWeight | 'all'; fiber: string | 'all'; lowOnly: boolean },
): YarnWithStock[] {
  return yarns.filter(
    (y) =>
      (f.weight === 'all' || y.yarn_weight === f.weight) &&
      (f.fiber === 'all' || y.fiber === f.fiber) &&
      (!f.lowOnly || stockBadge(y.free) !== null),
  );
}

type ProjectRef = { id: string; name: string; status: ProjectStatus } | null;
export type YarnUsageRow = { projectId: string; name: string; status: ProjectStatus; planned: number; used: number };

export function mergeYarnUsage(
  planned: { skeins_planned: number; project: ProjectRef }[],
  used: { skeins_used: number; part: { project: ProjectRef } | null }[],
): YarnUsageRow[] {
  const rows = new Map<string, YarnUsageRow>();
  const row = (p: NonNullable<ProjectRef>) => {
    if (!rows.has(p.id)) rows.set(p.id, { projectId: p.id, name: p.name, status: p.status, planned: 0, used: 0 });
    return rows.get(p.id)!;
  };
  for (const pl of planned) if (pl.project) row(pl.project).planned += Number(pl.skeins_planned);
  for (const u of used) if (u.part?.project) row(u.part.project).used += Number(u.skeins_used);
  return [...rows.values()].map((r) => ({ ...r, used: Math.round(r.used * 100) / 100 }));
}
```

- [ ] **Step 5: Run the logic tests**

Run: `npm test -- src/features/stash/logic.test.ts`. Expected: PASS.

- [ ] **Step 6: Implement `src/features/stash/api.ts`**

```ts
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../../lib/supabase';
import { mergeYarnUsage, type Yarn, type YarnWithStock } from './logic';

export type YarnInput = Omit<Yarn, 'id' | 'user_id' | 'created_at' | 'updated_at'> & { id?: string };

async function fetchYarns(id?: string): Promise<YarnWithStock[]> {
  let yq = supabase.from('yarns').select().order('name');
  let sq = supabase.from('yarn_stock').select();
  if (id) {
    yq = yq.eq('id', id);
    sq = sq.eq('yarn_id', id);
  }
  const [y, s] = await Promise.all([yq, sq]);
  if (y.error) throw y.error;
  if (s.error) throw s.error;
  const stock = new Map(s.data.map((r) => [r.yarn_id, r]));
  return y.data.map((yarn) => {
    const st = stock.get(yarn.id);
    return {
      ...yarn,
      owned: Number(yarn.skeins_owned),
      used: Number(st?.used ?? 0),
      reserved: Number(st?.reserved ?? 0),
      free: Number(st?.free ?? yarn.skeins_owned),
    };
  });
}

export function useYarns() {
  return useQuery({ queryKey: ['yarns'], queryFn: () => fetchYarns() });
}

export function useYarn(id: string | undefined) {
  return useQuery({
    queryKey: ['yarns', id],
    enabled: id !== undefined,
    queryFn: async () => {
      const [yarn] = await fetchYarns(id!);
      if (!yarn) throw new Error('Yarn not found');
      return yarn;
    },
  });
}

export function useYarnUsage(id: string) {
  return useQuery({
    queryKey: ['yarns', id, 'usage'],
    queryFn: async () => {
      const [planned, used] = await Promise.all([
        supabase.from('project_yarns').select('skeins_planned, project:projects(id, name, status)').eq('yarn_id', id),
        supabase.from('part_yarns').select('skeins_used, part:parts(project:projects(id, name, status))').eq('yarn_id', id),
      ]);
      if (planned.error) throw planned.error;
      if (used.error) throw used.error;
      return mergeYarnUsage(planned.data, used.data);
    },
  });
}

export function toYarnInput(y: YarnWithStock): YarnInput {
  return {
    id: y.id, brand: y.brand, name: y.name, color: y.color, yarn_weight: y.yarn_weight, fiber: y.fiber,
    skeins_owned: Number(y.skeins_owned), photo_path: y.photo_path, bought_at: y.bought_at,
    price_per_skein: y.price_per_skein, bought_on: y.bought_on, notes: y.notes,
  };
}

export function useSaveYarn() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...fields }: YarnInput): Promise<string> => {
      const q = id
        ? supabase.from('yarns').update(fields).eq('id', id).select('id').single()
        : supabase.from('yarns').insert(fields).select('id').single();
      const { data, error } = await q;
      if (error) throw error;
      return data.id;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['yarns'] }),
  });
}

export function useDeleteYarn() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('yarns').delete().eq('id', id);
      if (error?.code === '23503') {
        throw new Error('This yarn is used or planned in a project. Set "owned" to 0 instead.');
      }
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['yarns'] }),
  });
}
```

- [ ] **Step 7: Write the failing component tests**

`src/features/stash/StashList.test.tsx`:
```tsx
import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderWithProviders } from '../../test/render';
import type { YarnWithStock } from './logic';
import StashList from './StashList';

const base = {
  user_id: 'u', brand: 'Drops', color: null, photo_path: null, bought_at: null, price_per_skein: null,
  bought_on: null, notes: null, created_at: '', updated_at: '', used: 0, reserved: 0,
};
const data: YarnWithStock[] = [
  { ...base, id: 'a', name: 'Fern green', yarn_weight: 'dk', fiber: 'Cotton', skeins_owned: 3, owned: 3, free: 1 },
  { ...base, id: 'b', name: 'Rust', yarn_weight: 'worsted', fiber: 'Merino', skeins_owned: 2, owned: 2, free: 0.6 },
  { ...base, id: 'c', name: 'Charcoal', yarn_weight: 'worsted', fiber: 'Merino', skeins_owned: 1, owned: 1, free: 0 },
];
vi.mock('./api', () => ({ useYarns: () => ({ data, isPending: false, error: null, refetch: vi.fn() }) }));
vi.mock('../../lib/storage', () => ({ useSignedUrl: () => undefined }));

test('lists yarns with free / owned and stock badges', () => {
  renderWithProviders(<StashList />);
  expect(screen.getByRole('link', { name: /Fern green/ })).toHaveTextContent('1 sk free / 3 sk');
  expect(screen.getByRole('link', { name: /Rust/ })).toHaveTextContent('Low');
  expect(screen.getByRole('link', { name: /Charcoal/ })).toHaveTextContent('Out');
});

test('filters by weight and low stock', async () => {
  renderWithProviders(<StashList />);
  await userEvent.click(screen.getByRole('button', { name: 'DK' }));
  expect(screen.queryByRole('link', { name: /Rust/ })).toBeNull();
  await userEvent.click(screen.getByRole('button', { name: 'All weights' }));
  await userEvent.click(screen.getByRole('button', { name: 'Low' }));
  expect(screen.queryByRole('link', { name: /Fern green/ })).toBeNull();
  expect(screen.getByRole('link', { name: /Rust/ })).toBeInTheDocument();
});
```

`src/features/stash/YarnPage.test.tsx`:
```tsx
import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderWithProviders } from '../../test/render';
import YarnPage from './YarnPage';

const remove = vi.fn();
vi.mock('./api', () => ({
  useYarn: () => ({
    data: {
      id: 'y1', user_id: 'u', brand: 'Drops Paris', name: 'Fern green', color: 'green', yarn_weight: 'dk',
      fiber: '100% cotton', skeins_owned: 3, photo_path: null, bought_at: 'Wool shop', price_per_skein: 4.5,
      bought_on: '2026-09-03', notes: null, created_at: '', updated_at: '', owned: 3, used: 1.1, reserved: 0.9, free: 1,
    },
    isPending: false, error: null, refetch: vi.fn(),
  }),
  useYarnUsage: () => ({
    data: [{ projectId: 'p1', name: 'T-rex for Léo', status: 'in_progress', planned: 2, used: 1.1 }],
  }),
  useDeleteYarn: () => ({ mutate: remove, error: new Error('This yarn is used or planned in a project. Set "owned" to 0 instead.') }),
}));
vi.mock('../../lib/storage', () => ({ useSignedUrl: () => undefined }));

test('shows stock, usage and purchase details', () => {
  renderWithProviders(<YarnPage />, { route: '/stash/y1', path: '/stash/:id' });
  expect(screen.getByRole('heading', { name: 'Fern green' })).toBeInTheDocument();
  expect(screen.getByText('Reserved').parentElement).toHaveTextContent('0.9');
  expect(screen.getByRole('link', { name: /T-rex for Léo/ })).toHaveTextContent('1.1 used · 2 planned');
  expect(screen.getByText(/4,50/)).toBeInTheDocument();
});

test('delete asks for confirmation and shows why it is blocked', async () => {
  renderWithProviders(<YarnPage />, { route: '/stash/y1', path: '/stash/:id' });
  await userEvent.click(screen.getByRole('button', { name: 'Delete yarn' }));
  await userEvent.click(screen.getByRole('button', { name: 'Delete' }));
  expect(remove).toHaveBeenCalledWith('y1', expect.anything());
  expect(screen.getByRole('alert')).toHaveTextContent('Set "owned" to 0 instead');
});
```

- [ ] **Step 8: Run to verify failure**

Run: `npm test -- src/features/stash`
Expected: FAIL with unresolved `./StashList` and `./YarnPage`.

- [ ] **Step 9: Implement the screens**

`src/features/stash/StashList.tsx`:
```tsx
import { useState } from 'react';
import { Link } from 'react-router';
import ErrorBox from '../../components/ErrorBox';
import { formatSkeins, stockBadge } from '../../lib/calc';
import { WEIGHTS, weightLabel, type YarnWeight } from '../../lib/labels';
import { useSignedUrl } from '../../lib/storage';
import { useYarns } from './api';
import { filterYarns, type YarnWithStock } from './logic';

const chip = (on: boolean) =>
  `h-9 shrink-0 rounded-full px-3.5 text-sm ${on ? 'bg-stash text-white' : 'border border-line bg-surface'}`;

export default function StashList() {
  const { data, isPending, error, refetch } = useYarns();
  const [weight, setWeight] = useState<YarnWeight | 'all'>('all');
  const [fiber, setFiber] = useState<string>('all');
  const [lowOnly, setLowOnly] = useState(false);

  if (error) return <ErrorBox error={error} onRetry={() => refetch()} />;
  if (isPending) return <p className="p-4 text-muted">Loading…</p>;

  const weights = WEIGHTS.filter((w) => data.some((y) => y.yarn_weight === w.value));
  const fibers = [...new Set(data.map((y) => y.fiber).filter((f): f is string => !!f))].sort();
  const shown = filterYarns(data, { weight, fiber, lowOnly });

  return (
    <div className="flex flex-col gap-3 p-4">
      <header className="flex items-center justify-between pt-2">
        <h1 className="text-4xl">Stash</h1>
        <Link to="/stash/new" className="flex h-11 items-center rounded-full bg-stash px-5 text-white">+ Yarn</Link>
      </header>
      <div className="flex gap-2 overflow-x-auto">
        <button type="button" className={chip(weight === 'all')} onClick={() => setWeight('all')}>All weights</button>
        {weights.map((w) => (
          <button key={w.value} type="button" className={chip(weight === w.value)} onClick={() => setWeight(w.value)}>
            {w.label}
          </button>
        ))}
        <button type="button" className={chip(lowOnly)} aria-pressed={lowOnly} onClick={() => setLowOnly(!lowOnly)}>
          Low
        </button>
      </div>
      {fibers.length > 1 && (
        <label className="flex items-center gap-2 text-sm text-muted">
          Fiber
          <select value={fiber} onChange={(e) => setFiber(e.target.value)}
            className="h-9 rounded-xl border border-line bg-surface px-2 text-ink">
            <option value="all">All fibers</option>
            {fibers.map((f) => <option key={f} value={f}>{f}</option>)}
          </select>
        </label>
      )}
      {shown.length === 0 ? (
        <p className="text-muted">No yarn here yet.</p>
      ) : (
        <div className="grid grid-cols-2 gap-2.5">
          {shown.map((y) => <YarnCard key={y.id} yarn={y} />)}
        </div>
      )}
    </div>
  );
}

function YarnCard({ yarn }: { yarn: YarnWithStock }) {
  const photo = useSignedUrl('yarn-photos', yarn.photo_path);
  const badge = stockBadge(yarn.free);
  return (
    <Link to={`/stash/${yarn.id}`} className="flex flex-col overflow-hidden rounded-2xl border border-line bg-surface">
      <div className="relative h-20 bg-stash-soft">
        {photo && <img src={photo} alt="" className="h-full w-full object-cover" />}
        {badge && (
          <span className={`absolute right-2 top-2 rounded-lg px-2 py-0.5 text-xs ${badge === 'low' ? 'bg-sun text-ink' : 'bg-ink text-white'}`}>
            {badge === 'low' ? 'Low' : 'Out'}
          </span>
        )}
      </div>
      <div className="flex flex-col gap-0.5 px-3 py-2.5">
        <span className="text-base">{yarn.name}</span>
        <span className="text-xs text-muted">{[yarn.brand, weightLabel(yarn.yarn_weight)].filter(Boolean).join(' · ')}</span>
        <span className="mt-1 text-sm">{formatSkeins(yarn.free)} free <span className="text-muted">/ {formatSkeins(yarn.owned)}</span></span>
      </div>
    </Link>
  );
}
```

`src/features/stash/YarnPage.tsx`:
```tsx
import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router';
import ConfirmDialog from '../../components/ConfirmDialog';
import ErrorBox from '../../components/ErrorBox';
import { formatEuros } from '../../lib/calc';
import { STATUS_LABELS, weightLabel } from '../../lib/labels';
import { useSignedUrl } from '../../lib/storage';
import { useDeleteYarn, useYarn, useYarnUsage } from './api';

export default function YarnPage() {
  const { id } = useParams() as { id: string };
  const navigate = useNavigate();
  const { data: yarn, isPending, error, refetch } = useYarn(id);
  const usage = useYarnUsage(id);
  const del = useDeleteYarn();
  const [confirming, setConfirming] = useState(false);
  const photo = useSignedUrl('yarn-photos', yarn?.photo_path ?? null);

  if (error) return <ErrorBox error={error} onRetry={() => refetch()} />;
  if (isPending) return <p className="p-4 text-muted">Loading…</p>;

  const stats = [
    { label: 'Owned', value: yarn.owned },
    { label: 'Used', value: yarn.used },
    { label: 'Reserved', value: yarn.reserved },
    { label: 'Free', value: yarn.free },
  ];

  return (
    <div className="flex flex-col">
      <div className="relative h-44 bg-stash">
        {photo && <img src={photo} alt="" className="h-full w-full object-cover" />}
        <div className="absolute inset-x-0 top-0 flex justify-between p-2">
          <Link to="/stash" className="flex min-h-11 items-center px-2 text-white">‹ Stash</Link>
          <Link to={`/stash/${id}/edit`} className="flex min-h-11 items-center px-2 text-white">Edit</Link>
        </div>
      </div>
      <div className="flex flex-col gap-3.5 p-4">
        <div>
          <h1 className="text-3xl">{yarn.name}</h1>
          <p className="text-sm text-muted">{[yarn.brand, weightLabel(yarn.yarn_weight), yarn.fiber].filter(Boolean).join(' · ')}</p>
        </div>
        <div className="grid grid-cols-4 gap-1.5">
          {stats.map((s) => (
            <div key={s.label} className={`flex flex-col rounded-xl p-2 ${s.label === 'Free' ? 'bg-stash-soft' : 'border border-line bg-surface'}`}>
              <span className="text-xs text-muted">{s.label}</span>
              <span className="text-xl">{Number(s.value.toFixed(2))}</span>
            </div>
          ))}
        </div>
        {yarn.free < 0 && <p className="text-sm text-projects-dark">More used than owned: update the owned count.</p>}

        <h2 className="text-sm uppercase tracking-wide text-muted">Used in</h2>
        {(usage.data ?? []).map((u) => (
          <Link key={u.projectId} to={`/projects/${u.projectId}`}
            className="flex items-center justify-between rounded-2xl border border-line bg-surface px-3.5 py-3 text-sm">
            <span>{u.name}<br /><span className="text-muted">{STATUS_LABELS[u.status]}</span></span>
            <span>{u.used} used · {u.planned} planned</span>
          </Link>
        ))}

        <h2 className="text-sm uppercase tracking-wide text-muted">Purchase</h2>
        <dl className="rounded-2xl border border-line bg-surface text-sm">
          <div className="flex justify-between border-b border-divider px-3.5 py-3"><dt className="text-muted">Shop</dt><dd>{yarn.bought_at ?? '—'}</dd></div>
          <div className="flex justify-between border-b border-divider px-3.5 py-3"><dt className="text-muted">Price per skein</dt><dd>{formatEuros(yarn.price_per_skein)}</dd></div>
          <div className="flex justify-between px-3.5 py-3"><dt className="text-muted">Bought on</dt><dd>{yarn.bought_on ?? '—'}</dd></div>
        </dl>

        <button type="button" onClick={() => setConfirming(true)} className="h-11 self-start rounded-full border border-line px-5">
          Delete yarn
        </button>
        {del.error && <p role="alert" className="text-projects-dark">{del.error.message}</p>}
      </div>
      <ConfirmDialog
        open={confirming}
        title={`Delete ${yarn.name}?`}
        message="This cannot be undone."
        confirmLabel="Delete"
        onCancel={() => setConfirming(false)}
        onConfirm={() => {
          setConfirming(false);
          del.mutate(id, { onSuccess: () => navigate('/stash') });
        }}
      />
    </div>
  );
}
```

`src/features/stash/YarnForm.tsx`:
```tsx
import { useState, type FormEvent } from 'react';
import { useNavigate, useParams } from 'react-router';
import ErrorBox from '../../components/ErrorBox';
import { resizeImage } from '../../lib/images';
import { WEIGHTS, type YarnWeight } from '../../lib/labels';
import { uploadFile } from '../../lib/storage';
import { toYarnInput, useSaveYarn, useYarn, type YarnInput } from './api';

const empty: YarnInput = {
  brand: null, name: '', color: null, yarn_weight: null, fiber: null, skeins_owned: 1, photo_path: null,
  bought_at: null, price_per_skein: null, bought_on: null, notes: null,
};

const input = 'h-12 rounded-xl border border-line bg-surface px-3';
const label = 'flex flex-col gap-1.5 text-sm text-muted';
const text = (v: string) => (v.trim() === '' ? null : v);

export default function YarnForm() {
  const { id } = useParams();
  const existing = useYarn(id);
  if (id && existing.error) return <ErrorBox error={existing.error} onRetry={() => existing.refetch()} />;
  if (id && !existing.data) return <p className="p-4 text-muted">Loading…</p>;
  return <YarnFormBody initial={existing.data ? toYarnInput(existing.data) : empty} />;
}

function YarnFormBody({ initial }: { initial: YarnInput }) {
  const navigate = useNavigate();
  const save = useSaveYarn();
  const [y, setY] = useState<YarnInput>(initial);
  const [photo, setPhoto] = useState<File | null>(null);
  const set = <K extends keyof YarnInput>(k: K, v: YarnInput[K]) => setY({ ...y, [k]: v });

  async function submit(e: FormEvent) {
    e.preventDefault();
    const photo_path = photo ? await uploadFile('yarn-photos', await resizeImage(photo), 'jpg') : y.photo_path;
    save.mutate({ ...y, photo_path }, { onSuccess: (newId) => navigate(`/stash/${newId}`) });
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-3 p-4">
      <header className="flex items-center justify-between">
        <button type="button" onClick={() => navigate(-1)} className="min-h-11 text-stash">Cancel</button>
        <h1 className="text-2xl">{initial.id ? 'Edit yarn' : 'New yarn'}</h1>
        <button type="submit" disabled={save.isPending} className="min-h-11 text-stash">Save</button>
      </header>
      {save.error && <ErrorBox error={save.error} />}
      <label className={label}>Name<input required className={input} value={y.name} onChange={(e) => set('name', e.target.value)} /></label>
      <label className={label}>Brand<input className={input} value={y.brand ?? ''} onChange={(e) => set('brand', text(e.target.value))} /></label>
      <label className={label}>Color<input className={input} value={y.color ?? ''} onChange={(e) => set('color', text(e.target.value))} /></label>
      <div className="flex gap-2">
        <label className={`${label} flex-1`}>Weight
          <select className={input} value={y.yarn_weight ?? ''} onChange={(e) => set('yarn_weight', (e.target.value || null) as YarnWeight | null)}>
            <option value="">—</option>
            {WEIGHTS.map((w) => <option key={w.value} value={w.value}>{w.label}</option>)}
          </select>
        </label>
        <label className={`${label} flex-1`}>Fiber<input className={input} value={y.fiber ?? ''} onChange={(e) => set('fiber', text(e.target.value))} /></label>
      </div>
      <label className={label}>Skeins owned
        <input required type="number" min={0} step={0.25} className={input} value={y.skeins_owned}
          onChange={(e) => set('skeins_owned', Number(e.target.value))} />
      </label>
      <label className={label}>Photo<input type="file" accept="image/*" onChange={(e) => setPhoto(e.target.files?.[0] ?? null)} /></label>
      <label className={label}>Shop<input className={input} value={y.bought_at ?? ''} onChange={(e) => set('bought_at', text(e.target.value))} /></label>
      <div className="flex gap-2">
        <label className={`${label} flex-1`}>Price per skein (€)
          <input type="number" min={0} step={0.01} className={input} value={y.price_per_skein ?? ''}
            onChange={(e) => set('price_per_skein', e.target.value === '' ? null : Number(e.target.value))} />
        </label>
        <label className={`${label} flex-1`}>Bought on
          <input type="date" className={input} value={y.bought_on ?? ''} onChange={(e) => set('bought_on', e.target.value || null)} />
        </label>
      </div>
      <label className={label}>Notes<textarea rows={3} className="rounded-xl border border-line bg-surface p-3" value={y.notes ?? ''} onChange={(e) => set('notes', text(e.target.value))} /></label>
    </form>
  );
}
```

- [ ] **Step 10: Add the routes to `src/App.tsx`**

Add the imports:
```tsx
import StashList from './features/stash/StashList';
import YarnForm from './features/stash/YarnForm';
import YarnPage from './features/stash/YarnPage';
```
Inside `<Route element={<Layout />}>`, after the index route:
```tsx
<Route path="stash" element={<StashList />} />
<Route path="stash/new" element={<YarnForm />} />
<Route path="stash/:id" element={<YarnPage />} />
<Route path="stash/:id/edit" element={<YarnForm />} />
```

- [ ] **Step 11: Run the tests and try it**

Run: `npm test`. Expected: PASS.
Run: `npm run dev`. Expected: add a yarn with a photo, see it in the grid with "free / owned", open it, edit it, delete it.

- [ ] **Step 12: Commit**

```bash
git add src
git commit -m "feat: add stash list, yarn form and yarn page"
```

---

### Task 11: Patterns, pattern types and "start a project"

**Files:**
- Create: `src/features/patterns/logic.ts`, `src/features/patterns/api.ts`, `src/features/patterns/TypeChips.tsx`, `src/features/patterns/PatternList.tsx`, `src/features/patterns/PatternForm.tsx`, `src/features/patterns/PatternPage.tsx`
- Modify: `src/App.tsx` (routes)
- Test: `src/features/patterns/logic.test.ts`, `src/features/patterns/PatternList.test.tsx`, `src/features/patterns/PatternForm.test.tsx`

**Interfaces:**
- Consumes: `supabase`, `Tables` (Task 8); `expandPatternParts`, `formatDuration`, `formatHook`, `formatSkeins` (Tasks 2–3); `HookSelect`, `ErrorBox`, `ConfirmDialog`, `uploadFile`, `useSignedUrl`, `MAX_PDF_BYTES` (Task 9); `WEIGHTS`, `weightLabel`, `YarnWeight` (Task 10).
- Produces:
  - `logic.ts`: `type PartDraft = { name: string; count: number; total_rows: number | null }`, `type TypeChip = { id: string | 'all'; label: string }`, `buildTypeChips(types: { id: string; name: string }[], patternTypeIds: (string | null)[]): TypeChip[]`, `cleanPartDrafts(drafts: PartDraft[]): (PartDraft & { position: number })[]`.
  - `api.ts`: `usePatternTypes()`, `useCreatePatternType()`, `usePatterns()` returning `PatternListItem[]`, `usePattern(id)` returning `PatternDetail`, `useSavePattern()`, `useDeletePattern()`, `useStartProject()` (mutation `(patternId) => Promise<projectId>`, invalidates `['projects']`). Query keys `['patterns']`, `['pattern-types']`.
    - `type PatternListItem = Pattern & { type: PatternType | null; parts: PatternPart[]; timesMade: number; avgSeconds: number | null; avgSkeins: number | null }`
    - `type PatternDetail = PatternListItem`
  - `TypeChips({ chips: TypeChip[]; selected: string | 'all'; onSelect: (id) => void; tone: 'patterns' | 'projects' })`: also used by the New project screen in Task 12.
  - Routes: `/patterns`, `/patterns/new`, `/patterns/:id`, `/patterns/:id/edit`.

- [ ] **Step 1: Write the failing logic tests in `src/features/patterns/logic.test.ts`**

```ts
import { buildTypeChips, cleanPartDrafts } from './logic';

const types = [
  { id: 't1', name: 'Amigurumi' },
  { id: 't2', name: 'Clothes' },
  { id: 't3', name: 'Baby' },
];

test('buildTypeChips counts patterns and hides empty types', () => {
  expect(buildTypeChips(types, ['t1', 't1', 't2', null])).toEqual([
    { id: 'all', label: 'All · 4' },
    { id: 't1', label: 'Amigurumi · 2' },
    { id: 't2', label: 'Clothes · 1' },
  ]);
});

test('cleanPartDrafts drops blank rows, trims names, numbers positions', () => {
  expect(
    cleanPartDrafts([
      { name: ' Head ', count: 1, total_rows: 24 },
      { name: '', count: 1, total_rows: null },
      { name: 'Leg', count: 0, total_rows: null },
    ]),
  ).toEqual([
    { name: 'Head', count: 1, total_rows: 24, position: 0 },
    { name: 'Leg', count: 1, total_rows: null, position: 1 },
  ]);
});
```

- [ ] **Step 2: Run to verify failure**

Run: `npm test -- src/features/patterns`
Expected: FAIL with `Failed to resolve import "./logic"`.

- [ ] **Step 3: Implement `src/features/patterns/logic.ts`**

```ts
export type PartDraft = { name: string; count: number; total_rows: number | null };
export type TypeChip = { id: string | 'all'; label: string };

export function buildTypeChips(types: { id: string; name: string }[], patternTypeIds: (string | null)[]): TypeChip[] {
  const counts = new Map<string, number>();
  for (const id of patternTypeIds) if (id) counts.set(id, (counts.get(id) ?? 0) + 1);
  return [
    { id: 'all', label: `All · ${patternTypeIds.length}` },
    ...types.filter((t) => counts.has(t.id)).map((t) => ({ id: t.id, label: `${t.name} · ${counts.get(t.id)}` })),
  ];
}

export function cleanPartDrafts(drafts: PartDraft[]) {
  return drafts
    .map((d) => ({ ...d, name: d.name.trim(), count: Math.max(1, Math.floor(d.count || 1)) }))
    .filter((d) => d.name !== '')
    .map((d, position) => ({ ...d, position }));
}
```

- [ ] **Step 4: Run the logic tests**

Run: `npm test -- src/features/patterns/logic.test.ts`. Expected: PASS.

- [ ] **Step 5: Implement `src/features/patterns/api.ts`**

```ts
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase, type Tables } from '../../lib/supabase';
import { cleanPartDrafts, type PartDraft } from './logic';

export type Pattern = Tables<'patterns'>;
export type PatternType = Tables<'pattern_types'>;
export type PatternPart = Tables<'pattern_parts'>;
export type PatternListItem = Pattern & {
  type: PatternType | null;
  parts: PatternPart[];
  timesMade: number;
  avgSeconds: number | null;
  avgSkeins: number | null;
};
export type PatternDetail = PatternListItem;
export type PatternInput = Omit<Pattern, 'id' | 'user_id' | 'created_at' | 'updated_at'> & { id?: string };

export function usePatternTypes() {
  return useQuery({
    queryKey: ['pattern-types'],
    queryFn: async () => {
      const { data, error } = await supabase.from('pattern_types').select().order('position');
      if (error) throw error;
      return data;
    },
  });
}

export function useCreatePatternType() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ name, position }: { name: string; position: number }) => {
      const { data, error } = await supabase.from('pattern_types').insert({ name: name.trim(), position }).select().single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['pattern-types'] }),
  });
}

async function fetchPatterns(id?: string): Promise<PatternListItem[]> {
  let pq = supabase.from('patterns').select('*, type:pattern_types(*), parts:pattern_parts(*)').order('name');
  let sq = supabase.from('pattern_stats').select();
  if (id) {
    pq = pq.eq('id', id);
    sq = sq.eq('pattern_id', id);
  }
  const [p, s] = await Promise.all([pq, sq]);
  if (p.error) throw p.error;
  if (s.error) throw s.error;
  const stats = new Map(s.data.map((r) => [r.pattern_id, r]));
  return p.data.map((pattern) => {
    const st = stats.get(pattern.id);
    return {
      ...pattern,
      parts: [...pattern.parts].sort((a, b) => a.position - b.position),
      timesMade: st?.times_made ?? 0,
      avgSeconds: st?.avg_seconds ?? null,
      avgSkeins: st?.avg_skeins === null || st?.avg_skeins === undefined ? null : Number(st.avg_skeins),
    };
  });
}

export function usePatterns() {
  return useQuery({ queryKey: ['patterns'], queryFn: () => fetchPatterns() });
}

export function usePattern(id: string | undefined) {
  return useQuery({
    queryKey: ['patterns', id],
    enabled: id !== undefined,
    queryFn: async () => {
      const [pattern] = await fetchPatterns(id!);
      if (!pattern) throw new Error('Pattern not found');
      return pattern;
    },
  });
}

export function useSavePattern() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ pattern, parts }: { pattern: PatternInput; parts: PartDraft[] }): Promise<string> => {
      const { id, ...fields } = pattern;
      const saved = id
        ? await supabase.from('patterns').update(fields).eq('id', id).select('id').single()
        : await supabase.from('patterns').insert(fields).select('id').single();
      if (saved.error) throw saved.error;
      const patternId = saved.data.id;
      // Template parts are copied into projects at start, so replacing them never touches existing projects.
      const del = await supabase.from('pattern_parts').delete().eq('pattern_id', patternId);
      if (del.error) throw del.error;
      const rows = cleanPartDrafts(parts).map((p) => ({ ...p, pattern_id: patternId }));
      if (rows.length > 0) {
        const ins = await supabase.from('pattern_parts').insert(rows);
        if (ins.error) throw ins.error;
      }
      return patternId;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['patterns'] }),
  });
}

export function useDeletePattern() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('patterns').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['patterns'] }),
  });
}

export function useStartProject() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (patternId: string): Promise<string> => {
      const { data, error } = await supabase.rpc('start_project_from_pattern', { p_pattern_id: patternId });
      if (error) throw error;
      return data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['projects'] }),
  });
}
```

- [ ] **Step 6: Write the failing component tests**

`src/features/patterns/PatternList.test.tsx`:
```tsx
import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderWithProviders } from '../../test/render';
import PatternList from './PatternList';

const types = [
  { id: 't1', name: 'Amigurumi', position: 0 },
  { id: 't2', name: 'Clothes', position: 1 },
];
const p = (id: string, name: string, typeId: string | null, timesMade: number) => ({
  id, name, pattern_type_id: typeId, type: types.find((t) => t.id === typeId) ?? null,
  designer: null, url: null, hook_size_mm: 3.5, yarn_weight: 'dk', notes: null, pdf_path: null,
  parts: [{ id: `${id}-p`, name: 'Body', count: 2, total_rows: 10, position: 0 }],
  timesMade, avgSeconds: timesMade ? 7200 : null, avgSkeins: timesMade ? 2.4 : null,
});
vi.mock('./api', () => ({
  usePatternTypes: () => ({ data: types }),
  usePatterns: () => ({
    data: [p('a', 'T-rex', 't1', 1), p('b', 'Teddy bear', 't1', 0), p('c', 'Scarf 1', 't2', 0)],
    isPending: false, error: null, refetch: vi.fn(),
  }),
}));

test('shows type chips with counts and filters by type', async () => {
  renderWithProviders(<PatternList />);
  expect(screen.getByRole('button', { name: 'All · 3' })).toHaveAttribute('aria-pressed', 'true');
  await userEvent.click(screen.getByRole('button', { name: 'Clothes · 1' }));
  expect(screen.getByRole('link', { name: /Scarf 1/ })).toBeInTheDocument();
  expect(screen.queryByRole('link', { name: /T-rex/ })).toBeNull();
});

test('cards show type, parts, hook and stats', () => {
  renderWithProviders(<PatternList />);
  const card = screen.getByRole('link', { name: /T-rex/ });
  expect(card).toHaveTextContent('Amigurumi');
  expect(card).toHaveTextContent('2 parts · DK · 3.5 mm');
  expect(card).toHaveTextContent('Made 1× · avg 2h 00m · 2.4 sk');
  expect(screen.getByRole('link', { name: /Teddy bear/ })).toHaveTextContent('Not made yet');
});
```

`src/features/patterns/PatternForm.test.tsx`:
```tsx
import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderWithProviders } from '../../test/render';
import PatternForm from './PatternForm';

const save = vi.fn();
vi.mock('./api', () => ({
  usePatternTypes: () => ({ data: [{ id: 't1', name: 'Amigurumi', position: 0 }, { id: 't2', name: 'Clothes', position: 1 }] }),
  useCreatePatternType: () => ({ mutate: vi.fn() }),
  usePattern: () => ({ data: undefined, isPending: false, error: null }),
  useSavePattern: () => ({ mutate: save, isPending: false, error: null }),
}));
vi.mock('../../lib/storage', () => ({ uploadFile: vi.fn(), MAX_PDF_BYTES: 20 * 1024 * 1024 }));

test('saves the pattern with type, recommended hook and parts', async () => {
  renderWithProviders(<PatternForm />, { route: '/patterns/new', path: '/patterns/new' });
  await userEvent.type(screen.getByLabelText('Name'), 'T-rex');
  await userEvent.click(screen.getByRole('radio', { name: 'Amigurumi' }));
  await userEvent.selectOptions(screen.getByLabelText('Recommended hook'), '3.5 mm');

  const names = screen.getAllByLabelText('Part name');
  await userEvent.type(names[0], 'Head');
  await userEvent.type(screen.getAllByLabelText('Rows')[0], '24');
  await userEvent.click(screen.getByRole('button', { name: '+ Add part' }));
  await userEvent.type(screen.getAllByLabelText('Part name')[1], 'Leg');
  const counts = screen.getAllByLabelText('How many');
  await userEvent.clear(counts[1]);
  await userEvent.type(counts[1], '2');

  await userEvent.click(screen.getByRole('button', { name: 'Save' }));
  expect(save).toHaveBeenCalledWith(
    {
      pattern: expect.objectContaining({ name: 'T-rex', pattern_type_id: 't1', hook_size_mm: 3.5 }),
      parts: [
        { name: 'Head', count: 1, total_rows: 24 },
        { name: 'Leg', count: 2, total_rows: null },
      ],
    },
    expect.anything(),
  );
});

test('tapping the selected type again clears it', async () => {
  renderWithProviders(<PatternForm />, { route: '/patterns/new', path: '/patterns/new' });
  const chip = screen.getByRole('radio', { name: 'Clothes' });
  await userEvent.click(chip);
  expect(chip).toHaveAttribute('aria-checked', 'true');
  await userEvent.click(chip);
  expect(chip).toHaveAttribute('aria-checked', 'false');
});
```

- [ ] **Step 7: Run to verify failure**

Run: `npm test -- src/features/patterns`
Expected: FAIL with unresolved `./PatternList` and `./PatternForm`.

- [ ] **Step 8: Implement the components**

`src/features/patterns/TypeChips.tsx`:
```tsx
import type { TypeChip } from './logic';

const onClass = { patterns: 'bg-patterns text-white', projects: 'bg-projects text-white' };

type Props = {
  chips: TypeChip[];
  selected: string;
  onSelect: (id: string) => void;
  tone: 'patterns' | 'projects';
};

export default function TypeChips({ chips, selected, onSelect, tone }: Props) {
  return (
    <div role="group" aria-label="Filter by type" className="-mx-4 flex gap-2 overflow-x-auto px-4">
      {chips.map((c) => (
        <button
          key={c.id}
          type="button"
          aria-pressed={c.id === selected}
          onClick={() => onSelect(c.id)}
          className={`h-9 shrink-0 rounded-full px-3.5 text-sm ${c.id === selected ? onClass[tone] : 'border border-line bg-surface'}`}
        >
          {c.label}
        </button>
      ))}
    </div>
  );
}
```

`src/features/patterns/PatternList.tsx`:
```tsx
import { useState } from 'react';
import { Link } from 'react-router';
import ErrorBox from '../../components/ErrorBox';
import { expandPatternParts, formatDuration, formatHook, formatSkeins } from '../../lib/calc';
import { weightLabel } from '../../lib/labels';
import { usePatterns, usePatternTypes, type PatternListItem } from './api';
import { buildTypeChips } from './logic';
import TypeChips from './TypeChips';

export function patternMeta(p: PatternListItem): string {
  const n = expandPatternParts(p.parts).length;
  return [`${n} ${n === 1 ? 'part' : 'parts'}`, weightLabel(p.yarn_weight), p.hook_size_mm === null ? '' : formatHook(p.hook_size_mm)]
    .filter(Boolean).join(' · ');
}

export function patternStats(p: PatternListItem): string {
  if (p.timesMade === 0) return 'Not made yet';
  return [`Made ${p.timesMade}×`, p.avgSeconds !== null && `avg ${formatDuration(p.avgSeconds)}`,
    p.avgSkeins !== null && formatSkeins(p.avgSkeins)].filter(Boolean).join(' · ');
}

export default function PatternList() {
  const { data, isPending, error, refetch } = usePatterns();
  const types = usePatternTypes();
  const [selected, setSelected] = useState<string>('all');

  if (error) return <ErrorBox error={error} onRetry={() => refetch()} />;
  if (isPending) return <p className="p-4 text-muted">Loading…</p>;

  const chips = buildTypeChips(types.data ?? [], data.map((p) => p.pattern_type_id));
  const shown = selected === 'all' ? data : data.filter((p) => p.pattern_type_id === selected);

  return (
    <div className="flex flex-col gap-2.5 p-4">
      <header className="flex items-center justify-between pt-2">
        <h1 className="text-4xl">Patterns</h1>
        <Link to="/patterns/new" className="flex h-11 items-center rounded-full bg-patterns px-5 text-white">+ Add</Link>
      </header>
      <TypeChips chips={chips} selected={selected} onSelect={setSelected} tone="patterns" />
      {shown.map((p) => (
        <Link key={p.id} to={`/patterns/${p.id}`} className="flex items-center gap-3 rounded-2xl border border-line bg-surface p-2.5">
          <div className="h-16 w-16 shrink-0 rounded-xl bg-patterns-soft" />
          <div className="flex min-w-0 flex-1 flex-col gap-1">
            <span className="flex items-center justify-between gap-2">
              <span className="text-lg">{p.name}</span>
              {p.type && <span className="rounded-lg bg-patterns-soft px-2 text-xs text-patterns-dark">{p.type.name}</span>}
            </span>
            <span className="text-sm text-muted">{patternMeta(p)}</span>
            <span className="text-sm text-stash">{patternStats(p)}</span>
          </div>
        </Link>
      ))}
      {data.length === 0 && <p className="text-muted">No patterns yet. Add your first one.</p>}
    </div>
  );
}
```

`src/features/patterns/PatternForm.tsx`:
```tsx
import { useState, type FormEvent } from 'react';
import { useNavigate, useParams } from 'react-router';
import ErrorBox from '../../components/ErrorBox';
import HookSelect from '../../components/HookSelect';
import { WEIGHTS, type YarnWeight } from '../../lib/labels';
import { MAX_PDF_BYTES, uploadFile } from '../../lib/storage';
import { useCreatePatternType, usePattern, usePatternTypes, useSavePattern, type PatternDetail, type PatternInput } from './api';
import type { PartDraft } from './logic';

const input = 'h-12 rounded-xl border border-line bg-surface px-3';
const label = 'flex flex-col gap-1.5 text-sm text-muted';
const text = (v: string) => (v.trim() === '' ? null : v);
const emptyPart = (): PartDraft => ({ name: '', count: 1, total_rows: null });

function toInput(p: PatternDetail | undefined): PatternInput {
  if (!p) {
    return { name: '', pattern_type_id: null, designer: null, url: null, hook_size_mm: null, yarn_weight: null, notes: null, pdf_path: null };
  }
  return {
    id: p.id, name: p.name, pattern_type_id: p.pattern_type_id, designer: p.designer, url: p.url,
    hook_size_mm: p.hook_size_mm === null ? null : Number(p.hook_size_mm), yarn_weight: p.yarn_weight,
    notes: p.notes, pdf_path: p.pdf_path,
  };
}

export default function PatternForm() {
  const { id } = useParams();
  const existing = usePattern(id);
  if (id && existing.error) return <ErrorBox error={existing.error} />;
  if (id && !existing.data) return <p className="p-4 text-muted">Loading…</p>;
  const parts = existing.data?.parts.map((p) => ({ name: p.name, count: p.count, total_rows: p.total_rows }));
  return <PatternFormBody initial={toInput(existing.data)} initialParts={parts ?? [emptyPart()]} />;
}

function PatternFormBody({ initial, initialParts }: { initial: PatternInput; initialParts: PartDraft[] }) {
  const navigate = useNavigate();
  const types = usePatternTypes();
  const createType = useCreatePatternType();
  const save = useSavePattern();
  const [p, setP] = useState(initial);
  const [parts, setParts] = useState(initialParts);
  const [pdf, setPdf] = useState<File | null>(null);
  const [pdfError, setPdfError] = useState<string | null>(null);
  const [newType, setNewType] = useState<string | null>(null);
  const set = <K extends keyof PatternInput>(k: K, v: PatternInput[K]) => setP({ ...p, [k]: v });
  const setPart = (i: number, patch: Partial<PartDraft>) => setParts(parts.map((x, j) => (j === i ? { ...x, ...patch } : x)));

  function pickPdf(file: File | null) {
    setPdfError(null);
    if (file && file.size > MAX_PDF_BYTES) {
      setPdfError('This PDF is larger than 20 MB.');
      return;
    }
    setPdf(file);
  }

  function addType() {
    if (!newType?.trim()) return;
    createType.mutate(
      { name: newType, position: types.data?.length ?? 0 },
      { onSuccess: (t) => { set('pattern_type_id', t.id); setNewType(null); } },
    );
  }

  async function submit(e: FormEvent) {
    e.preventDefault();
    const pdf_path = pdf ? await uploadFile('pattern-pdfs', pdf, 'pdf') : p.pdf_path;
    save.mutate({ pattern: { ...p, pdf_path }, parts }, { onSuccess: (newId) => navigate(`/patterns/${newId}`) });
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-3 p-4">
      <header className="flex items-center justify-between">
        <button type="button" onClick={() => navigate(-1)} className="min-h-11 text-patterns">Cancel</button>
        <h1 className="text-2xl">{initial.id ? 'Edit pattern' : 'New pattern'}</h1>
        <button type="submit" disabled={save.isPending} className="min-h-11 text-patterns">Save</button>
      </header>
      {save.error && <ErrorBox error={save.error} />}

      <div className="flex gap-2">
        <label className="flex h-12 flex-1 cursor-pointer items-center justify-center rounded-xl border-[1.5px] border-dashed border-muted bg-surface text-sm">
          {pdf ? pdf.name : p.pdf_path ? 'Replace PDF' : 'Attach PDF'}
          <input type="file" accept="application/pdf" className="sr-only" onChange={(e) => pickPdf(e.target.files?.[0] ?? null)} />
        </label>
        <button type="button" disabled className="h-12 flex-1 rounded-xl border border-line bg-divider text-sm text-muted">
          Fill from PDF · soon
        </button>
      </div>
      {pdfError && <p role="alert" className="text-projects-dark">{pdfError}</p>}

      <label className={label}>Name<input required className={input} value={p.name} onChange={(e) => set('name', e.target.value)} /></label>

      <div className="flex flex-col gap-1.5">
        <span className="text-sm text-muted">Type</span>
        <div role="radiogroup" aria-label="Type" className="flex flex-wrap gap-1.5">
          {(types.data ?? []).map((t) => {
            const on = p.pattern_type_id === t.id;
            return (
              <button key={t.id} type="button" role="radio" aria-checked={on}
                onClick={() => set('pattern_type_id', on ? null : t.id)}
                className={`h-9 rounded-full px-3 text-sm ${on ? 'bg-patterns text-white' : 'border border-line bg-surface'}`}>
                {t.name}
              </button>
            );
          })}
          {newType === null ? (
            <button type="button" onClick={() => setNewType('')}
              className="h-9 rounded-full border-[1.5px] border-dashed border-muted px-3 text-sm text-patterns">+ New type</button>
          ) : (
            <span className="flex gap-1.5">
              <input autoFocus aria-label="New type name" value={newType} onChange={(e) => setNewType(e.target.value)}
                className="h-9 w-32 rounded-full border border-line bg-surface px-3 text-sm" />
              <button type="button" onClick={addType} className="h-9 rounded-full bg-patterns px-3 text-sm text-white">Add</button>
            </span>
          )}
        </div>
      </div>

      <div className="flex gap-2">
        <div className="flex-1">
          <HookSelect label="Recommended hook" value={p.hook_size_mm} onChange={(mm) => set('hook_size_mm', mm)} />
        </div>
        <label className={`${label} flex-1`}>Yarn weight
          <select className={input} value={p.yarn_weight ?? ''} onChange={(e) => set('yarn_weight', (e.target.value || null) as YarnWeight | null)}>
            <option value="">—</option>
            {WEIGHTS.map((w) => <option key={w.value} value={w.value}>{w.label}</option>)}
          </select>
        </label>
      </div>
      <label className={label}>Designer<input className={input} value={p.designer ?? ''} onChange={(e) => set('designer', text(e.target.value))} /></label>
      <label className={label}>Link<input type="url" placeholder="https://…" className={input} value={p.url ?? ''} onChange={(e) => set('url', text(e.target.value))} /></label>

      <div className="mt-1 flex items-center justify-between">
        <h2 className="text-sm uppercase tracking-wide text-muted">Parts</h2>
        <span className="text-xs text-muted">name · how many · rows</span>
      </div>
      {parts.map((part, i) => (
        <div key={i} className="flex items-center gap-1.5">
          <input aria-label="Part name" value={part.name} onChange={(e) => setPart(i, { name: e.target.value })}
            className="h-11 min-w-0 flex-1 rounded-xl border border-line bg-surface px-2.5" />
          <input aria-label="How many" type="number" min={1} value={part.count}
            onChange={(e) => setPart(i, { count: Number(e.target.value) })}
            className="h-11 w-12 rounded-xl border border-line bg-surface text-center" />
          <input aria-label="Rows" type="number" min={1} value={part.total_rows ?? ''}
            onChange={(e) => setPart(i, { total_rows: e.target.value === '' ? null : Number(e.target.value) })}
            className="h-11 w-14 rounded-xl border border-line bg-surface text-center" />
          <button type="button" aria-label="Remove part" onClick={() => setParts(parts.filter((_, j) => j !== i))}
            className="h-11 w-9 text-muted">×</button>
        </div>
      ))}
      <button type="button" onClick={() => setParts([...parts, emptyPart()])} className="h-11 self-start text-patterns">+ Add part</button>

      <label className={label}>Notes<textarea rows={3} className="rounded-xl border border-line bg-surface p-3" value={p.notes ?? ''} onChange={(e) => set('notes', text(e.target.value))} /></label>
    </form>
  );
}
```

Note: `submit` sends the part drafts exactly as typed; `useSavePattern` cleans them with `cleanPartDrafts` (drops blank rows, trims names, numbers positions).

`src/features/patterns/PatternPage.tsx`:
```tsx
import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router';
import ConfirmDialog from '../../components/ConfirmDialog';
import ErrorBox from '../../components/ErrorBox';
import { expandPatternParts, formatDuration, formatHook } from '../../lib/calc';
import { weightLabel } from '../../lib/labels';
import { useSignedUrl } from '../../lib/storage';
import { useDeletePattern, usePattern, useStartProject } from './api';

export default function PatternPage() {
  const { id } = useParams() as { id: string };
  const navigate = useNavigate();
  const { data: p, isPending, error, refetch } = usePattern(id);
  const start = useStartProject();
  const del = useDeletePattern();
  const [confirming, setConfirming] = useState(false);
  const pdfUrl = useSignedUrl('pattern-pdfs', p?.pdf_path ?? null);

  if (error) return <ErrorBox error={error} onRetry={() => refetch()} />;
  if (isPending) return <p className="p-4 text-muted">Loading…</p>;

  const meta = [p.designer && `by ${p.designer}`, weightLabel(p.yarn_weight),
    p.hook_size_mm !== null && `recommended hook ${formatHook(Number(p.hook_size_mm))}`].filter(Boolean).join(' · ');

  return (
    <div className="flex flex-col gap-3 p-4">
      <header className="flex items-center justify-between">
        <Link to="/patterns" className="flex min-h-11 items-center text-patterns">‹ Patterns</Link>
        <Link to={`/patterns/${id}/edit`} className="flex min-h-11 items-center text-patterns">Edit</Link>
      </header>
      <h1 className="text-4xl">{p.name}</h1>
      {p.type && <span className="self-start rounded-lg bg-patterns-soft px-2.5 py-0.5 text-sm text-patterns-dark">{p.type.name}</span>}
      {meta && <p className="text-sm text-muted">{meta}</p>}

      <div className="grid grid-cols-3 gap-2">
        {[
          ['Made', `${p.timesMade}×`],
          ['Avg time', p.avgSeconds === null ? '—' : formatDuration(p.avgSeconds)],
          ['Avg yarn', p.avgSkeins === null ? '—' : `${p.avgSkeins} sk`],
        ].map(([k, v]) => (
          <div key={k} className="flex flex-col rounded-2xl bg-stash-soft p-3">
            <span className="text-xs text-stash-dark">{k}</span>
            <span className="text-xl">{v}</span>
          </div>
        ))}
      </div>

      {pdfUrl && (
        <a href={pdfUrl} target="_blank" rel="noreferrer"
          className="flex items-center gap-3 rounded-2xl border border-line bg-surface px-3.5 py-3">
          <span className="flex h-12 w-10 items-center justify-center rounded-md bg-patterns-soft text-xs text-patterns">PDF</span>
          <span className="flex-1">Open pattern</span>
          <span className="text-patterns">›</span>
        </a>
      )}

      <h2 className="text-sm uppercase tracking-wide text-muted">Parts · {expandPatternParts(p.parts).length} when started</h2>
      <ul className="rounded-2xl border border-line bg-surface">
        {p.parts.map((part) => (
          <li key={part.id} className="flex justify-between border-b border-divider px-3.5 py-2.5 last:border-b-0">
            <span>{part.name} {part.count > 1 && <span className="text-patterns">×{part.count}</span>}</span>
            <span className="text-muted">{part.total_rows === null ? '—' : `${part.total_rows} rows`}</span>
          </li>
        ))}
      </ul>

      {start.error && <ErrorBox error={start.error} />}
      <button type="button" disabled={start.isPending}
        onClick={() => start.mutate(id, { onSuccess: (projectId) => navigate(`/projects/${projectId}`) })}
        className="h-14 rounded-full bg-patterns text-lg text-white">
        Start a project from this pattern
      </button>
      <button type="button" onClick={() => setConfirming(true)} className="h-11 self-start rounded-full border border-line px-5">
        Delete pattern
      </button>
      <ConfirmDialog
        open={confirming}
        title={`Delete ${p.name}?`}
        message="Projects made from it are kept."
        confirmLabel="Delete"
        onCancel={() => setConfirming(false)}
        onConfirm={() => { setConfirming(false); del.mutate(id, { onSuccess: () => navigate('/patterns') }); }}
      />
    </div>
  );
}
```

- [ ] **Step 9: Add the routes to `src/App.tsx`**

Imports:
```tsx
import PatternForm from './features/patterns/PatternForm';
import PatternList from './features/patterns/PatternList';
import PatternPage from './features/patterns/PatternPage';
```
Routes inside the layout route:
```tsx
<Route path="patterns" element={<PatternList />} />
<Route path="patterns/new" element={<PatternForm />} />
<Route path="patterns/:id" element={<PatternPage />} />
<Route path="patterns/:id/edit" element={<PatternForm />} />
```

- [ ] **Step 10: Run the tests and try it**

Run: `npm test`. Expected: PASS.
Run: `npm run dev`. Expected: the six default type chips appear in the form; create "T-rex" (Amigurumi, 3.5 mm, Head 24 rows, Leg ×2 18 rows), see it in the list under "Amigurumi · 1", open it and press **Start a project from this pattern**. You land on `/projects/<id>` (built in Task 12).

- [ ] **Step 11: Commit**

```bash
git add src
git commit -m "feat: add patterns with types, filters, PDF and start-project"
```

---

### Task 12: Projects (list, new project, project page)

**Files:**
- Create: `src/features/projects/logic.ts`, `src/features/projects/api.ts`, `src/features/projects/ProjectList.tsx`, `src/features/projects/NewProject.tsx`, `src/features/projects/ProjectPage.tsx`
- Modify: `src/App.tsx` (routes; the index route now renders `ProjectList`)
- Test: `src/features/projects/logic.test.ts`, `src/features/projects/NewProject.test.tsx`, `src/features/projects/ProjectPage.test.tsx`

**Interfaces:**
- Consumes: `sumSeconds`, `formatDuration`, `rowLabel`, `hookLabel`, `formatSkeins`, `hookSizeOptions`, `formatHook` (Tasks 2–3); `ErrorBox`, `ConfirmDialog`, `resizeImage`, `uploadFile`, `useSignedUrl` (Task 9); `STATUS_LABELS`, `ProjectStatus` (Task 10); `useYarns` (Task 10); `usePatterns`, `usePatternTypes`, `useStartProject`, `buildTypeChips`, `TypeChips` (Task 11).
- Produces:
  - `logic.ts`: `STATUS_ORDER: ProjectStatus[]` (`in_progress`, `idea`, `finished`, `frogged`), `groupProjects<T extends { status: ProjectStatus }>(list: T[]): { status: ProjectStatus; items: T[] }[]` (empty groups omitted), `type YarnLine = { yarnId: string; name: string; used: number; planned: number | null }`, `projectYarnLines(parts, plans): YarnLine[]`.
  - `api.ts`: `useProjects()` returning `ProjectListItem[]`, `useProject(id)` returning `ProjectDetail`, `useUpdateProject()`, `useCreateBlankProject()`, `useDeleteProject()`, `useAddPart()`, `useUpdatePart()`, `useDeletePart()`, `useMovePart()`, `usePlanYarn()`, `useAddProjectPhoto()`. Query key `['projects']` (all project queries start with it).
    - `type ProjectPart = Part & { time_sessions: { id: string; started_at: string; ended_at: string | null }[]; part_yarns: { id: string; skeins_used: number; yarn: { id: string; name: string } | null }[] }`
    - `type ProjectDetail = Project & { pattern: { id: string; name: string; hook_size_mm: number | null } | null; parts: ProjectPart[]; project_yarns: { id: string; skeins_planned: number; yarn: { id: string; name: string } | null }[]; project_photos: ProjectPhoto[] }`
    - `useUpdatePart()` takes `{ id: string; patch: Partial<Part> }` and is reused by Task 13 (row counter, resume note, rename, done).
  - Routes: `/` (list), `/projects/new`, `/projects/:id`.

- [ ] **Step 1: Write the failing logic tests in `src/features/projects/logic.test.ts`**

```ts
import { groupProjects, projectYarnLines } from './logic';

test('groupProjects orders groups and omits empty ones', () => {
  const groups = groupProjects([
    { id: 'a', status: 'finished' as const },
    { id: 'b', status: 'in_progress' as const },
    { id: 'c', status: 'in_progress' as const },
  ]);
  expect(groups.map((g) => [g.status, g.items.map((i) => i.id)])).toEqual([
    ['in_progress', ['b', 'c']],
    ['finished', ['a']],
  ]);
});

test('projectYarnLines adds usage across parts and joins plans', () => {
  const fern = { id: 'y1', name: 'Fern green' };
  const cream = { id: 'y2', name: 'Cream' };
  const lines = projectYarnLines(
    [
      { part_yarns: [{ id: 'u1', skeins_used: 0.6, yarn: fern }] },
      { part_yarns: [{ id: 'u2', skeins_used: 0.5, yarn: fern }, { id: 'u3', skeins_used: 0.2, yarn: cream }] },
    ],
    [{ id: 'pl1', skeins_planned: 2, yarn: fern }],
  );
  expect(lines).toEqual([
    { yarnId: 'y1', name: 'Fern green', used: 1.1, planned: 2 },
    { yarnId: 'y2', name: 'Cream', used: 0.2, planned: null },
  ]);
});
```

- [ ] **Step 2: Run to verify failure**

Run: `npm test -- src/features/projects`
Expected: FAIL with `Failed to resolve import "./logic"`.

- [ ] **Step 3: Implement `src/features/projects/logic.ts`**

```ts
import type { ProjectStatus } from '../../lib/labels';

export const STATUS_ORDER: ProjectStatus[] = ['in_progress', 'idea', 'finished', 'frogged'];

export function groupProjects<T extends { status: ProjectStatus }>(list: T[]) {
  return STATUS_ORDER
    .map((status) => ({ status, items: list.filter((p) => p.status === status) }))
    .filter((g) => g.items.length > 0);
}

type YarnRef = { id: string; name: string } | null;
export type YarnLine = { yarnId: string; name: string; used: number; planned: number | null };

export function projectYarnLines(
  parts: { part_yarns: { id: string; skeins_used: number; yarn: YarnRef }[] }[],
  plans: { id: string; skeins_planned: number; yarn: YarnRef }[],
): YarnLine[] {
  const lines = new Map<string, YarnLine>();
  const line = (y: NonNullable<YarnRef>) => {
    if (!lines.has(y.id)) lines.set(y.id, { yarnId: y.id, name: y.name, used: 0, planned: null });
    return lines.get(y.id)!;
  };
  for (const p of plans) if (p.yarn) line(p.yarn).planned = Number(p.skeins_planned);
  for (const part of parts) for (const u of part.part_yarns) if (u.yarn) line(u.yarn).used += Number(u.skeins_used);
  return [...lines.values()]
    .map((l) => ({ ...l, used: Math.round(l.used * 100) / 100 }))
    .sort((a, b) => b.used - a.used || a.name.localeCompare(b.name));
}
```

- [ ] **Step 4: Run the logic tests**

Run: `npm test -- src/features/projects/logic.test.ts`. Expected: PASS.

- [ ] **Step 5: Implement `src/features/projects/api.ts`**

```ts
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { resizeImage } from '../../lib/images';
import { uploadFile } from '../../lib/storage';
import { supabase, type Tables } from '../../lib/supabase';

export type Project = Tables<'projects'>;
export type Part = Tables<'parts'>;
export type ProjectPhoto = Tables<'project_photos'>;
export type ProjectPart = Part & {
  time_sessions: { id: string; started_at: string; ended_at: string | null }[];
  part_yarns: { id: string; skeins_used: number; yarn: { id: string; name: string } | null }[];
};
export type ProjectDetail = Project & {
  pattern: { id: string; name: string; hook_size_mm: number | null } | null;
  parts: ProjectPart[];
  project_yarns: { id: string; skeins_planned: number; yarn: { id: string; name: string } | null }[];
  project_photos: ProjectPhoto[];
};
export type ProjectListItem = Project & {
  pattern: { name: string } | null;
  photo: string | null;
  partsTotal: number;
  partsDone: number;
  seconds: number;
};

function useInvalidate() {
  const qc = useQueryClient();
  return () => Promise.all([
    qc.invalidateQueries({ queryKey: ['projects'] }),
    qc.invalidateQueries({ queryKey: ['yarns'] }),
    qc.invalidateQueries({ queryKey: ['patterns'] }),
  ]);
}

export function useProjects() {
  return useQuery({
    queryKey: ['projects'],
    queryFn: async (): Promise<ProjectListItem[]> => {
      const [p, s] = await Promise.all([
        supabase.from('projects').select('*, pattern:patterns(name), project_photos(path, created_at)').order('updated_at', { ascending: false }),
        supabase.from('project_summary').select(),
      ]);
      if (p.error) throw p.error;
      if (s.error) throw s.error;
      const summary = new Map(s.data.map((r) => [r.project_id, r]));
      return p.data.map(({ project_photos, ...project }) => {
        const sm = summary.get(project.id);
        const first = [...project_photos].sort((a, b) => a.created_at.localeCompare(b.created_at))[0];
        return {
          ...project,
          photo: first?.path ?? null,
          partsTotal: sm?.parts_total ?? 0,
          partsDone: sm?.parts_done ?? 0,
          seconds: Number(sm?.seconds ?? 0),
        };
      });
    },
  });
}

export function useProject(id: string) {
  return useQuery({
    queryKey: ['projects', id],
    queryFn: async (): Promise<ProjectDetail> => {
      const { data, error } = await supabase
        .from('projects')
        .select(`*, pattern:patterns(id, name, hook_size_mm),
          parts(*, time_sessions(id, started_at, ended_at), part_yarns(id, skeins_used, yarn:yarns(id, name))),
          project_yarns(id, skeins_planned, yarn:yarns(id, name)),
          project_photos(*)`)
        .eq('id', id)
        .single();
      if (error) throw error;
      return { ...data, parts: [...data.parts].sort((a, b) => a.position - b.position) } as ProjectDetail;
    },
  });
}

export function useUpdateProject() {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: async ({ id, patch }: { id: string; patch: Partial<Project> }) => {
      const { error } = await supabase.from('projects').update(patch).eq('id', id);
      if (error) throw error;
    },
    onSuccess: invalidate,
  });
}

export function useCreateBlankProject() {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: async (): Promise<string> => {
      const { data, error } = await supabase
        .from('projects')
        .insert({ name: 'New project', status: 'in_progress', start_date: new Date().toISOString().slice(0, 10) })
        .select('id').single();
      if (error) throw error;
      return data.id;
    },
    onSuccess: invalidate,
  });
}

export function useDeleteProject() {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('projects').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: invalidate,
  });
}

export function useAddPart() {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: async ({ projectId, name, position }: { projectId: string; name: string; position: number }) => {
      const { error } = await supabase.from('parts').insert({ project_id: projectId, name: name.trim(), position });
      if (error) throw error;
    },
    onSuccess: invalidate,
  });
}

export function useUpdatePart() {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: async ({ id, patch }: { id: string; patch: Partial<Part> }) => {
      const { error } = await supabase.from('parts').update(patch).eq('id', id);
      if (error) throw error;
    },
    onSuccess: invalidate,
  });
}

export function useDeletePart() {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('parts').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: invalidate,
  });
}

/** Swaps the positions of two parts. */
export function useMovePart() {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: async ({ a, b }: { a: Part; b: Part }) => {
      const one = await supabase.from('parts').update({ position: b.position }).eq('id', a.id);
      if (one.error) throw one.error;
      const two = await supabase.from('parts').update({ position: a.position }).eq('id', b.id);
      if (two.error) throw two.error;
    },
    onSuccess: invalidate,
  });
}

export function usePlanYarn() {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: async ({ projectId, yarnId, skeins }: { projectId: string; yarnId: string; skeins: number }) => {
      const { error } = await supabase
        .from('project_yarns')
        .upsert({ project_id: projectId, yarn_id: yarnId, skeins_planned: skeins }, { onConflict: 'project_id,yarn_id' });
      if (error) throw error;
    },
    onSuccess: invalidate,
  });
}

export function useAddProjectPhoto() {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: async ({ projectId, file }: { projectId: string; file: File }) => {
      const path = await uploadFile('project-photos', await resizeImage(file), 'jpg');
      const { error } = await supabase
        .from('project_photos').insert({ project_id: projectId, path, taken_on: new Date().toISOString().slice(0, 10) });
      if (error) throw error;
    },
    onSuccess: invalidate,
  });
}
```

- [ ] **Step 6: Write the failing component tests**

`src/features/projects/NewProject.test.tsx`:
```tsx
import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderWithProviders } from '../../test/render';
import NewProject from './NewProject';

const startProject = vi.fn();
const createBlank = vi.fn();
vi.mock('../patterns/api', () => ({
  usePatternTypes: () => ({ data: [{ id: 't1', name: 'Amigurumi' }, { id: 't2', name: 'Bag' }] }),
  usePatterns: () => ({
    data: [
      { id: 'p1', name: 'T-rex', pattern_type_id: 't1', type: { name: 'Amigurumi' }, parts: [{ count: 2 }, { count: 1 }] },
      { id: 'p2', name: 'Bag A', pattern_type_id: 't2', type: { name: 'Bag' }, parts: [{ count: 3 }] },
    ],
    isPending: false, error: null,
  }),
  useStartProject: () => ({ mutate: startProject, isPending: false, error: null }),
}));
vi.mock('./api', () => ({ useCreateBlankProject: () => ({ mutate: createBlank, isPending: false, error: null }) }));

test('search and type chips narrow the patterns', async () => {
  renderWithProviders(<NewProject />);
  await userEvent.click(screen.getByRole('button', { name: 'Bag · 1' }));
  expect(screen.queryByRole('button', { name: /T-rex/ })).toBeNull();
  await userEvent.click(screen.getByRole('button', { name: 'All · 2' }));
  await userEvent.type(screen.getByLabelText('Search patterns'), 'rex');
  expect(screen.queryByRole('button', { name: /Bag A/ })).toBeNull();
});

test('tapping a pattern starts a project from it; blank starts a blank one', async () => {
  renderWithProviders(<NewProject />);
  await userEvent.click(screen.getByRole('button', { name: /T-rex/ }));
  expect(startProject).toHaveBeenCalledWith('p1', expect.anything());
  await userEvent.click(screen.getByRole('button', { name: 'Start a blank project' }));
  expect(createBlank).toHaveBeenCalled();
});
```

`src/features/projects/ProjectPage.test.tsx`:
```tsx
import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderWithProviders } from '../../test/render';
import ProjectPage from './ProjectPage';

const updatePart = vi.fn();
const updateProject = vi.fn();
const part = (id: string, name: string, position: number, extra = {}) => ({
  id, name, position, project_id: 'pr1', done: false, current_row: null, total_rows: null, resume_note: null,
  notes: null, time_sessions: [], part_yarns: [], ...extra,
});
vi.mock('./api', () => ({
  useProject: () => ({
    data: {
      id: 'pr1', name: 'T-rex for Léo', status: 'in_progress', start_date: '2026-09-12', finish_date: null,
      hook_size_mm: 4, notes: null, pattern: { id: 'pa1', name: 'T-rex', hook_size_mm: 3.5 },
      parts: [
        part('a', 'Head', 0, { done: true, current_row: 24, total_rows: 24 }),
        part('b', 'Leg 1', 1, { current_row: 12, total_rows: 18, resume_note: 'after 2nd increase' }),
      ],
      project_yarns: [], project_photos: [],
    },
    isPending: false, error: null, refetch: vi.fn(),
  }),
  useUpdateProject: () => ({ mutate: updateProject }),
  useUpdatePart: () => ({ mutate: updatePart }),
  useAddPart: () => ({ mutate: vi.fn() }),
  useDeletePart: () => ({ mutate: vi.fn() }),
  useMovePart: () => ({ mutate: vi.fn() }),
  usePlanYarn: () => ({ mutate: vi.fn() }),
  useAddProjectPhoto: () => ({ mutate: vi.fn(), isPending: false }),
  useDeleteProject: () => ({ mutate: vi.fn() }),
}));
vi.mock('../stash/api', () => ({ useYarns: () => ({ data: [] }) }));
vi.mock('../../lib/storage', () => ({ useSignedUrl: () => undefined }));

test('shows parts with rows, resume notes and progress', () => {
  renderWithProviders(<ProjectPage />, { route: '/projects/pr1', path: '/projects/:id' });
  expect(screen.getByRole('heading', { name: 'T-rex for Léo' })).toBeInTheDocument();
  expect(screen.getByText('Parts · 1 of 2 done')).toBeInTheDocument();
  expect(screen.getByRole('link', { name: /Leg 1/ })).toHaveTextContent('after 2nd increase');
  expect(screen.getByText('Row 12/18')).toBeInTheDocument();
});

test('shows the hook used against the pattern recommendation and saves a change', async () => {
  renderWithProviders(<ProjectPage />, { route: '/projects/pr1', path: '/projects/:id' });
  expect(screen.getByText('hook 4.0 mm (pattern: 3.5 mm) ▾')).toBeInTheDocument();
  await userEvent.selectOptions(screen.getByLabelText('Hook used'), '3.5 mm');
  expect(updateProject).toHaveBeenCalledWith({ id: 'pr1', patch: { hook_size_mm: 3.5 } });
});

test('ticking a part marks it done; status changes are saved', async () => {
  renderWithProviders(<ProjectPage />, { route: '/projects/pr1', path: '/projects/:id' });
  await userEvent.click(screen.getByRole('checkbox', { name: 'Leg 1 done' }));
  expect(updatePart).toHaveBeenCalledWith({ id: 'b', patch: { done: true } });
  await userEvent.selectOptions(screen.getByLabelText('Status'), 'Finished');
  expect(updateProject).toHaveBeenCalledWith({ id: 'pr1', patch: { status: 'finished' } });
});
```

- [ ] **Step 7: Run to verify failure**

Run: `npm test -- src/features/projects`
Expected: FAIL with unresolved `./NewProject` and `./ProjectPage`.

- [ ] **Step 8: Implement the screens**

`src/features/projects/ProjectList.tsx`:
```tsx
import { Link } from 'react-router';
import ErrorBox from '../../components/ErrorBox';
import { formatDuration } from '../../lib/calc';
import { STATUS_LABELS } from '../../lib/labels';
import { useSignedUrl } from '../../lib/storage';
import { useProjects, type ProjectListItem } from './api';
import { groupProjects } from './logic';

export default function ProjectList() {
  const { data, isPending, error, refetch } = useProjects();
  if (error) return <ErrorBox error={error} onRetry={() => refetch()} />;
  if (isPending) return <p className="p-4 text-muted">Loading…</p>;

  return (
    <div className="flex flex-col gap-3 p-4">
      <header className="flex items-center justify-between pt-2">
        <h1 className="text-4xl">Projects</h1>
        <Link to="/projects/new" className="flex h-11 items-center rounded-full bg-projects px-5 text-white">+ New</Link>
      </header>
      {data.length === 0 && <p className="text-muted">No projects yet. Start one from a pattern.</p>}
      {groupProjects(data).map((g) => (
        <section key={g.status} className="flex flex-col gap-2.5">
          <h2 className="mt-2 text-sm uppercase tracking-wide text-muted">{STATUS_LABELS[g.status]} · {g.items.length}</h2>
          {g.items.map((p) => <ProjectCard key={p.id} project={p} />)}
        </section>
      ))}
    </div>
  );
}

function ProjectCard({ project: p }: { project: ProjectListItem }) {
  const photo = useSignedUrl('project-photos', p.photo);
  const pct = p.partsTotal ? Math.round((p.partsDone / p.partsTotal) * 100) : 0;
  return (
    <Link to={`/projects/${p.id}`} className="flex gap-3 rounded-2xl border border-line bg-surface p-3">
      <div className="h-[76px] w-[76px] shrink-0 overflow-hidden rounded-xl bg-projects-soft">
        {photo && <img src={photo} alt="" className="h-full w-full object-cover" />}
      </div>
      <div className="flex min-w-0 flex-1 flex-col gap-1.5">
        <span className="flex items-baseline justify-between gap-2">
          <span className="text-lg">{p.name}</span>
          <span className="text-sm text-muted">{formatDuration(p.seconds)}</span>
        </span>
        <span className="text-sm text-muted">{p.pattern?.name ?? 'No pattern'}</span>
        <div className="h-1.5 overflow-hidden rounded bg-sun-track"><div className="h-1.5 bg-stash" style={{ width: `${pct}%` }} /></div>
        <span className="text-sm text-stash">{p.partsDone} of {p.partsTotal} parts done</span>
      </div>
    </Link>
  );
}
```

`src/features/projects/NewProject.tsx`:
```tsx
import { useState } from 'react';
import { Link, useNavigate } from 'react-router';
import ErrorBox from '../../components/ErrorBox';
import { expandPatternParts } from '../../lib/calc';
import { usePatterns, usePatternTypes, useStartProject } from '../patterns/api';
import { buildTypeChips } from '../patterns/logic';
import TypeChips from '../patterns/TypeChips';
import { useCreateBlankProject } from './api';

export default function NewProject() {
  const navigate = useNavigate();
  const patterns = usePatterns();
  const types = usePatternTypes();
  const start = useStartProject();
  const blank = useCreateBlankProject();
  const [search, setSearch] = useState('');
  const [type, setType] = useState('all');
  const open = { onSuccess: (id: string) => navigate(`/projects/${id}`) };

  if (patterns.error) return <ErrorBox error={patterns.error} />;
  const all = patterns.data ?? [];
  const shown = all.filter(
    (p) => (type === 'all' || p.pattern_type_id === type) && p.name.toLowerCase().includes(search.trim().toLowerCase()),
  );

  return (
    <div className="flex flex-col gap-3 p-4">
      <Link to="/" className="flex min-h-11 items-center self-start text-projects">‹ Cancel</Link>
      <h1 className="text-4xl">New project</h1>
      <p className="text-muted">Pick a pattern: its parts are copied in.</p>
      <input type="search" aria-label="Search patterns" placeholder="Search patterns" value={search}
        onChange={(e) => setSearch(e.target.value)} className="h-12 rounded-full border border-line bg-surface px-4" />
      <TypeChips chips={buildTypeChips(types.data ?? [], all.map((p) => p.pattern_type_id))}
        selected={type} onSelect={setType} tone="projects" />
      {(start.error || blank.error) && <ErrorBox error={start.error ?? blank.error} />}
      <div className="grid grid-cols-2 gap-2.5">
        {shown.map((p) => (
          <button key={p.id} type="button" disabled={start.isPending} onClick={() => start.mutate(p.id, open)}
            className="flex flex-col gap-2 rounded-2xl border border-line bg-surface p-2.5 text-left">
            <div className="h-24 rounded-xl bg-patterns-soft" />
            <span className="text-base">{p.name}</span>
            <span className="text-xs text-muted">
              {[p.type?.name, `${expandPatternParts(p.parts).length} parts`].filter(Boolean).join(' · ')}
            </span>
          </button>
        ))}
      </div>
      <button type="button" disabled={blank.isPending} onClick={() => blank.mutate(undefined, open)}
        className="h-13 rounded-full border-[1.5px] border-dashed border-muted py-3">
        Start a blank project
      </button>
    </div>
  );
}
```

`src/features/projects/ProjectPage.tsx`:
```tsx
import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router';
import ConfirmDialog from '../../components/ConfirmDialog';
import ErrorBox from '../../components/ErrorBox';
import { formatDuration, formatHook, formatSkeins, hookLabel, hookSizeOptions, rowLabel, sumSeconds } from '../../lib/calc';
import { STATUS_LABELS, type ProjectStatus } from '../../lib/labels';
import { useSignedUrl } from '../../lib/storage';
import { useYarns } from '../stash/api';
import {
  useAddPart, useAddProjectPhoto, useDeletePart, useDeleteProject, useMovePart, usePlanYarn, useProject,
  useUpdatePart, useUpdateProject, type ProjectPart,
} from './api';
import { projectYarnLines, STATUS_ORDER } from './logic';

const h2 = 'text-sm uppercase tracking-wide text-muted';

export default function ProjectPage() {
  const { id } = useParams() as { id: string };
  const navigate = useNavigate();
  const { data: p, isPending, error, refetch } = useProject(id);
  const updateProject = useUpdateProject();
  const updatePart = useUpdatePart();
  const addPart = useAddPart();
  const deletePart = useDeletePart();
  const movePart = useMovePart();
  const planYarn = usePlanYarn();
  const addPhoto = useAddProjectPhoto();
  const deleteProject = useDeleteProject();
  const yarns = useYarns();
  const [editing, setEditing] = useState(false);
  const [newPart, setNewPart] = useState<string | null>(null);
  const [plan, setPlan] = useState<{ yarnId: string; skeins: number } | null>(null);
  const [confirm, setConfirm] = useState<null | { kind: 'project' } | { kind: 'part'; part: ProjectPart }>(null);
  const cover = useSignedUrl('project-photos', p?.project_photos[0]?.path ?? null);

  if (error) return <ErrorBox error={error} onRetry={() => refetch()} />;
  if (isPending) return <p className="p-4 text-muted">Loading…</p>;

  const now = new Date();
  const total = p.parts.reduce((s, part) => s + sumSeconds(part.time_sessions, now), 0);
  const lines = projectYarnLines(p.parts, p.project_yarns);
  const skeins = lines.reduce((s, l) => s + l.used, 0);
  const done = p.parts.filter((x) => x.done).length;
  const save = (patch: Parameters<typeof updateProject.mutate>[0]['patch']) => updateProject.mutate({ id, patch });

  return (
    <div className="flex flex-col gap-2.5 p-4">
      <Link to="/" className="flex min-h-11 items-center self-start text-projects">‹ Projects</Link>
      <div className="flex items-center gap-3">
        <div className="h-16 w-16 shrink-0 overflow-hidden rounded-xl bg-projects-soft">
          {cover && <img src={cover} alt="" className="h-full w-full object-cover" />}
        </div>
        <div className="flex flex-col gap-1">
          <h1 className="text-3xl">{p.name}</h1>
          <span className="text-sm text-muted">
            {p.pattern ? <>From <Link to={`/patterns/${p.pattern.id}`} className="text-projects">{p.pattern.name}</Link></> : 'No pattern'}
            {p.start_date && ` · since ${p.start_date}`}
          </span>
          <label className="relative self-start rounded-xl border border-line bg-surface px-2.5 py-0.5 text-sm">
            <span>{hookLabel(p.hook_size_mm === null ? null : Number(p.hook_size_mm),
              p.pattern?.hook_size_mm == null ? null : Number(p.pattern.hook_size_mm))} ▾</span>
            <select aria-label="Hook used" className="absolute inset-0 opacity-0"
              value={p.hook_size_mm === null ? '' : String(Number(p.hook_size_mm))}
              onChange={(e) => save({ hook_size_mm: e.target.value === '' ? null : Number(e.target.value) })}>
              <option value="">—</option>
              {hookSizeOptions().map((mm) => <option key={mm} value={String(mm)}>{formatHook(mm)}</option>)}
            </select>
          </label>
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        <label className="relative rounded-full bg-stash-soft px-3 py-1 text-sm text-stash-dark">
          <span>{STATUS_LABELS[p.status]} ▾</span>
          <select aria-label="Status" className="absolute inset-0 opacity-0" value={p.status}
            onChange={(e) => save({ status: e.target.value as ProjectStatus })}>
            {STATUS_ORDER.map((s) => <option key={s} value={s}>{STATUS_LABELS[s]}</option>)}
          </select>
        </label>
        <span className="rounded-full border border-line bg-surface px-3 py-1 text-sm">{formatDuration(total)} total</span>
        <span className="rounded-full border border-line bg-surface px-3 py-1 text-sm">{formatSkeins(skeins)}</span>
      </div>

      <div className="flex items-baseline justify-between">
        <h2 className={h2}>Parts · {done} of {p.parts.length} done</h2>
        <span className="flex gap-3">
          <button type="button" onClick={() => setEditing(!editing)} className="min-h-11 text-projects">{editing ? 'Done' : 'Edit'}</button>
          <button type="button" onClick={() => setNewPart('')} className="min-h-11 text-projects">+ Add part</button>
        </span>
      </div>
      <ul className="overflow-hidden rounded-2xl border border-line bg-surface">
        {p.parts.map((part, i) => (
          <li key={part.id} className="flex items-center gap-2 border-b border-divider py-1 pl-1 pr-2 last:border-b-0">
            <label className="flex h-11 w-11 items-center justify-center">
              <input type="checkbox" aria-label={`${part.name} done`} checked={part.done}
                onChange={(e) => updatePart.mutate({ id: part.id, patch: { done: e.target.checked } })}
                className="h-5 w-5 accent-stash" />
            </label>
            <Link to={`/parts/${part.id}`} className="flex min-h-11 flex-1 flex-col justify-center">
              <span>{part.name}</span>
              <span className="text-xs text-muted">
                {part.resume_note ?? (part.time_sessions.length ? formatDuration(sumSeconds(part.time_sessions, now)) : 'not started')}
              </span>
            </Link>
            <span className={`text-sm ${part.done ? 'text-stash' : ''}`}>{rowLabel(part.current_row, part.total_rows)}</span>
            {editing && (
              <span className="flex">
                <button type="button" aria-label={`Move ${part.name} up`} disabled={i === 0}
                  onClick={() => movePart.mutate({ a: part, b: p.parts[i - 1] })} className="h-11 w-8">↑</button>
                <button type="button" aria-label={`Move ${part.name} down`} disabled={i === p.parts.length - 1}
                  onClick={() => movePart.mutate({ a: part, b: p.parts[i + 1] })} className="h-11 w-8">↓</button>
                <button type="button" aria-label={`Delete ${part.name}`}
                  onClick={() => setConfirm({ kind: 'part', part })} className="h-11 w-8 text-projects">×</button>
              </span>
            )}
          </li>
        ))}
        {newPart !== null && (
          <li className="flex gap-2 p-2">
            <input autoFocus aria-label="New part name" value={newPart} onChange={(e) => setNewPart(e.target.value)}
              className="h-11 flex-1 rounded-xl border border-line px-3" />
            <button type="button" className="h-11 rounded-full bg-projects px-4 text-white"
              onClick={() => {
                if (newPart.trim()) addPart.mutate({ projectId: id, name: newPart, position: p.parts.length });
                setNewPart(null);
              }}>Add</button>
          </li>
        )}
      </ul>

      <div className="flex items-baseline justify-between">
        <h2 className={h2}>Yarn · used / planned</h2>
        <button type="button" onClick={() => setPlan({ yarnId: '', skeins: 1 })} className="min-h-11 text-projects">Plan yarn</button>
      </div>
      <div className="grid grid-cols-2 gap-2">
        {lines.map((l) => (
          <Link key={l.yarnId} to={`/stash/${l.yarnId}`} className="rounded-xl border border-line bg-surface p-2.5 text-sm">
            {l.name}<br />{l.used} / {l.planned ?? '—'}
          </Link>
        ))}
      </div>
      {plan && (
        <div className="flex items-end gap-2 rounded-2xl border border-line bg-surface p-3">
          <label className="flex flex-1 flex-col gap-1 text-sm text-muted">Yarn
            <select value={plan.yarnId} onChange={(e) => setPlan({ ...plan, yarnId: e.target.value })}
              className="h-11 rounded-xl border border-line px-2 text-ink">
              <option value="">Choose…</option>
              {(yarns.data ?? []).map((y) => <option key={y.id} value={y.id}>{y.name}</option>)}
            </select>
          </label>
          <label className="flex w-24 flex-col gap-1 text-sm text-muted">Skeins
            <input type="number" min={0} step={0.25} value={plan.skeins}
              onChange={(e) => setPlan({ ...plan, skeins: Number(e.target.value) })}
              className="h-11 rounded-xl border border-line px-2 text-ink" />
          </label>
          <button type="button" disabled={!plan.yarnId} className="h-11 rounded-full bg-projects px-4 text-white"
            onClick={() => { planYarn.mutate({ projectId: id, yarnId: plan.yarnId, skeins: plan.skeins }); setPlan(null); }}>
            Save
          </button>
        </div>
      )}

      <h2 className={h2}>Photos</h2>
      <div className="grid grid-cols-3 gap-2">
        {p.project_photos.map((ph) => <Photo key={ph.id} path={ph.path} />)}
        <label className="flex h-24 cursor-pointer items-center justify-center rounded-xl border-[1.5px] border-dashed border-muted text-sm">
          {addPhoto.isPending ? 'Uploading…' : '+ Photo'}
          <input type="file" accept="image/*" className="sr-only"
            onChange={(e) => { const f = e.target.files?.[0]; if (f) addPhoto.mutate({ projectId: id, file: f }); }} />
        </label>
      </div>

      <h2 className={h2}>Notes</h2>
      <textarea aria-label="Project notes" rows={3} defaultValue={p.notes ?? ''}
        onBlur={(e) => { if (e.target.value !== (p.notes ?? '')) save({ notes: e.target.value || null }); }}
        className="rounded-xl border border-line bg-surface p-3" />

      <button type="button" onClick={() => setConfirm({ kind: 'project' })} className="h-11 self-start rounded-full border border-line px-5">
        Delete project
      </button>
      <ConfirmDialog
        open={confirm !== null}
        title={confirm?.kind === 'part' ? `Delete ${confirm.part.name}?` : `Delete ${p.name}?`}
        message={confirm?.kind === 'part' ? 'Its time and yarn records are deleted too.' : 'All its parts, time and photos are deleted.'}
        confirmLabel="Delete"
        onCancel={() => setConfirm(null)}
        onConfirm={() => {
          if (confirm?.kind === 'part') deletePart.mutate(confirm.part.id);
          else deleteProject.mutate(id, { onSuccess: () => navigate('/') });
          setConfirm(null);
        }}
      />
    </div>
  );
}

function Photo({ path }: { path: string }) {
  const url = useSignedUrl('project-photos', path);
  return <div className="h-24 overflow-hidden rounded-xl bg-projects-soft">{url && <img src={url} alt="" className="h-full w-full object-cover" />}</div>;
}
```

- [ ] **Step 9: Update the routes in `src/App.tsx`**

Imports:
```tsx
import NewProject from './features/projects/NewProject';
import ProjectList from './features/projects/ProjectList';
import ProjectPage from './features/projects/ProjectPage';
```
Replace the index route and add:
```tsx
<Route index element={<ProjectList />} />
<Route path="projects/new" element={<NewProject />} />
<Route path="projects/:id" element={<ProjectPage />} />
```

- [ ] **Step 10: Run the tests and try it**

Run: `npm test`. Expected: PASS.
Run: `npm run dev`. Expected: start a project from "T-rex"; its page shows Head, Leg 1, Leg 2, Spikes and "hook 3.5 mm". Change the hook to 4.0 mm: the chip reads "hook 4.0 mm (pattern: 3.5 mm)". Tick a part, plan yarn, add a photo; the list shows the project under "In progress".

- [ ] **Step 11: Commit**

```bash
git add src
git commit -m "feat: add project list, new project picker and project page"
```

---

### Task 13: Part page (row counter, resume note, time sessions, yarn used)

**Files:**
- Create: `src/features/parts/api.ts`, `src/features/parts/RowCounter.tsx`, `src/features/parts/SessionForm.tsx`, `src/features/parts/YarnUsageForm.tsx`, `src/features/parts/PartPage.tsx`
- Modify: `src/App.tsx` (route)
- Test: `src/features/parts/RowCounter.test.tsx`, `src/features/parts/SessionForm.test.tsx`, `src/features/parts/YarnUsageForm.test.tsx`, `src/features/parts/PartPage.test.tsx`

**Interfaces:**
- Consumes: `clampRow`, `rowProgress`, `sessionSeconds`, `sumSeconds`, `formatDuration`, `formatSkeins` (Tasks 2–3); `ErrorBox`, `ConfirmDialog` (Task 9); `useYarns` (Task 10); `useUpdatePart`, `useDeletePart` (Task 12).
- Produces:
  - `RowCounter({ current: number | null; total: number | null; onChange: (row: number) => void })`: − / number / +; tapping the number lets you type it; never below 0.
  - `SessionForm({ initial?: { started_at: string; minutes: number }; onSave: (s: { started_at: string; ended_at: string }) => void; onCancel: () => void })`
  - `YarnUsageForm({ yarns: { id: string; name: string }[]; onSave: (u: { yarnId: string; skeins: number }) => void; onCancel: () => void })`
  - `parts/api.ts`: `usePart(id)` returning `PartDetail`, `useSaveSession()`, `useDeleteSession()`, `useSetYarnUsage()`, `useRemoveYarnUsage()`. Query key `['parts', id]`; all mutations also invalidate `['projects']`, `['yarns']` and `['timer']`.
    - `type PartDetail = Part & { project: { id: string; name: string }; time_sessions: Session[]; part_yarns: { id: string; skeins_used: number; yarn: { id: string; name: string; brand: string | null } | null }[] }` with sessions newest first.
  - Route: `/parts/:id`.

- [ ] **Step 1: Write the failing component tests**

`src/features/parts/RowCounter.test.tsx`:
```tsx
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import RowCounter from './RowCounter';

test('plus and minus change the row, never below 0', async () => {
  const onChange = vi.fn();
  const { rerender } = render(<RowCounter current={12} total={18} onChange={onChange} />);
  expect(screen.getByText('/ 18')).toBeInTheDocument();
  await userEvent.click(screen.getByRole('button', { name: 'Next row' }));
  expect(onChange).toHaveBeenLastCalledWith(13);
  await userEvent.click(screen.getByRole('button', { name: 'Previous row' }));
  expect(onChange).toHaveBeenLastCalledWith(11);

  rerender(<RowCounter current={0} total={18} onChange={onChange} />);
  onChange.mockClear();
  await userEvent.click(screen.getByRole('button', { name: 'Previous row' }));
  expect(onChange).not.toHaveBeenCalled();
});

test('starts at row 1 when nothing was counted yet', async () => {
  const onChange = vi.fn();
  render(<RowCounter current={null} total={null} onChange={onChange} />);
  await userEvent.click(screen.getByRole('button', { name: 'Next row' }));
  expect(onChange).toHaveBeenCalledWith(1);
});

test('tapping the number lets you type it', async () => {
  const onChange = vi.fn();
  render(<RowCounter current={12} total={18} onChange={onChange} />);
  await userEvent.click(screen.getByRole('button', { name: 'Row 12, tap to type' }));
  const input = screen.getByLabelText('Row number');
  await userEvent.clear(input);
  await userEvent.type(input, '15{Enter}');
  expect(onChange).toHaveBeenLastCalledWith(15);
});
```

`src/features/parts/SessionForm.test.tsx`:
```tsx
import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import SessionForm from './SessionForm';

test('computes the end from start and duration', async () => {
  const onSave = vi.fn();
  render(<SessionForm onSave={onSave} onCancel={vi.fn()} />);
  // datetime-local inputs cannot be typed into character by character in jsdom
  fireEvent.change(screen.getByLabelText('Started'), { target: { value: '2026-09-22T21:05' } });
  const minutes = screen.getByLabelText('Duration (minutes)');
  await userEvent.clear(minutes);
  await userEvent.type(minutes, '25');
  await userEvent.click(screen.getByRole('button', { name: 'Save time' }));
  const { started_at, ended_at } = onSave.mock.calls[0][0];
  expect(new Date(ended_at).getTime() - new Date(started_at).getTime()).toBe(25 * 60 * 1000);
  expect(new Date(started_at).getTime()).toBe(new Date('2026-09-22T21:05').getTime());
});

test('refuses a duration of 0', async () => {
  const onSave = vi.fn();
  render(<SessionForm onSave={onSave} onCancel={vi.fn()} />);
  const minutes = screen.getByLabelText('Duration (minutes)');
  await userEvent.clear(minutes);
  await userEvent.type(minutes, '0');
  await userEvent.click(screen.getByRole('button', { name: 'Save time' }));
  expect(onSave).not.toHaveBeenCalled();
  expect(screen.getByRole('alert')).toHaveTextContent('at least 1 minute');
});
```

`src/features/parts/YarnUsageForm.test.tsx`:
```tsx
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import YarnUsageForm from './YarnUsageForm';

test('picks a stash yarn and a number of skeins', async () => {
  const onSave = vi.fn();
  render(<YarnUsageForm yarns={[{ id: 'y1', name: 'Fern green' }]} onSave={onSave} onCancel={vi.fn()} />);
  await userEvent.selectOptions(screen.getByLabelText('Yarn'), 'Fern green');
  const skeins = screen.getByLabelText('Skeins used');
  await userEvent.clear(skeins);
  await userEvent.type(skeins, '0.25');
  await userEvent.click(screen.getByRole('button', { name: 'Save yarn' }));
  expect(onSave).toHaveBeenCalledWith({ yarnId: 'y1', skeins: 0.25 });
});
```

`src/features/parts/PartPage.test.tsx`:
```tsx
import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderWithProviders } from '../../test/render';
import PartPage from './PartPage';

const updatePart = vi.fn();
vi.mock('./api', () => ({
  usePart: () => ({
    data: {
      id: 'pt1', name: 'Leg 1', project_id: 'pr1', position: 1, done: false, current_row: 12, total_rows: 18,
      resume_note: 'After the 2nd increase round', notes: null,
      project: { id: 'pr1', name: 'T-rex for Léo' },
      time_sessions: [
        { id: 's1', started_at: '2026-09-23T21:05:00Z', ended_at: '2026-09-23T21:30:00Z' },
      ],
      part_yarns: [{ id: 'u1', skeins_used: 0.15, yarn: { id: 'y1', name: 'Fern green', brand: 'Drops Paris' } }],
    },
    isPending: false, error: null, refetch: vi.fn(),
  }),
  useSaveSession: () => ({ mutate: vi.fn() }),
  useDeleteSession: () => ({ mutate: vi.fn() }),
  useSetYarnUsage: () => ({ mutate: vi.fn() }),
  useRemoveYarnUsage: () => ({ mutate: vi.fn() }),
}));
vi.mock('../projects/api', () => ({ useUpdatePart: () => ({ mutate: updatePart }), useDeletePart: () => ({ mutate: vi.fn() }) }));
vi.mock('../stash/api', () => ({ useYarns: () => ({ data: [] }) }));

test('shows the counter, resume note, time and yarn', () => {
  renderWithProviders(<PartPage />, { route: '/parts/pt1', path: '/parts/:id' });
  expect(screen.getByRole('heading', { name: 'Leg 1' })).toBeInTheDocument();
  expect(screen.getByLabelText('Where I stopped')).toHaveValue('After the 2nd increase round');
  expect(screen.getByText('Time · 25m')).toBeInTheDocument();
  expect(screen.getByText('0.15 sk')).toBeInTheDocument();
});

test('the + button saves the next row', async () => {
  renderWithProviders(<PartPage />, { route: '/parts/pt1', path: '/parts/:id' });
  await userEvent.click(screen.getByRole('button', { name: 'Next row' }));
  expect(updatePart).toHaveBeenCalledWith({ id: 'pt1', patch: { current_row: 13 } });
});

test('the resume note is saved when leaving the field', async () => {
  renderWithProviders(<PartPage />, { route: '/parts/pt1', path: '/parts/:id' });
  const note = screen.getByLabelText('Where I stopped');
  await userEvent.clear(note);
  await userEvent.type(note, 'Switch to cream');
  await userEvent.tab();
  expect(updatePart).toHaveBeenCalledWith({ id: 'pt1', patch: { resume_note: 'Switch to cream' } });
});
```

- [ ] **Step 2: Run to verify failure**

Run: `npm test -- src/features/parts`
Expected: FAIL with unresolved `./RowCounter`, `./SessionForm`, `./YarnUsageForm`, `./PartPage`.

- [ ] **Step 3: Implement the forms and the counter**

`src/features/parts/RowCounter.tsx`:
```tsx
import { useState } from 'react';
import { clampRow, rowProgress } from '../../lib/calc';

type Props = { current: number | null; total: number | null; onChange: (row: number) => void };

export default function RowCounter({ current, total, onChange }: Props) {
  const [typing, setTyping] = useState(false);
  const [draft, setDraft] = useState('');
  const row = current ?? 0;

  function commit() {
    setTyping(false);
    if (draft.trim() !== '' && !Number.isNaN(Number(draft))) onChange(clampRow(Number(draft)));
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <button type="button" aria-label="Previous row" onClick={() => row > 0 && onChange(row - 1)}
          className="h-16 w-16 rounded-full border border-line bg-bg text-3xl">−</button>
        <div className="flex flex-col items-center">
          <span className="text-sm uppercase tracking-wide text-muted">Row</span>
          {typing ? (
            <input autoFocus aria-label="Row number" type="number" min={0} value={draft}
              onChange={(e) => setDraft(e.target.value)} onBlur={commit}
              onKeyDown={(e) => { if (e.key === 'Enter') commit(); }}
              className="h-16 w-24 rounded-xl border border-line text-center text-4xl" />
          ) : (
            <button type="button" aria-label={`Row ${row}, tap to type`}
              onClick={() => { setDraft(String(row)); setTyping(true); }} className="text-6xl leading-none">
              {row}{total !== null && <span className="text-2xl text-muted"> / {total}</span>}
            </button>
          )}
        </div>
        <button type="button" aria-label="Next row" onClick={() => onChange(row + 1)}
          className="h-16 w-16 rounded-full bg-projects text-3xl text-white">+</button>
      </div>
      <div className="h-1.5 overflow-hidden rounded bg-sun-track">
        <div className="h-1.5 bg-stash" style={{ width: `${rowProgress(current, total)}%` }} />
      </div>
    </div>
  );
}
```

Note: the "/ 18" suffix sits inside the number button, so the test's `getByText('/ 18')` finds the inner span.

`src/features/parts/SessionForm.tsx`:
```tsx
import { useState, type FormEvent } from 'react';

type Props = {
  initial?: { started_at: string; minutes: number };
  onSave: (s: { started_at: string; ended_at: string }) => void;
  onCancel: () => void;
};

/** "2026-09-22T21:05" in local time, the format of <input type="datetime-local">. */
function toLocalInput(d: Date): string {
  const off = d.getTimezoneOffset() * 60_000;
  return new Date(d.getTime() - off).toISOString().slice(0, 16);
}

export default function SessionForm({ initial, onSave, onCancel }: Props) {
  const [start, setStart] = useState(toLocalInput(initial ? new Date(initial.started_at) : new Date(Date.now() - 30 * 60_000)));
  const [minutes, setMinutes] = useState(String(initial?.minutes ?? 30));
  const [error, setError] = useState<string | null>(null);

  function submit(e: FormEvent) {
    e.preventDefault();
    const m = Number(minutes);
    if (!Number.isFinite(m) || m < 1) {
      setError('The duration must be at least 1 minute.');
      return;
    }
    const startDate = new Date(start);
    onSave({ started_at: startDate.toISOString(), ended_at: new Date(startDate.getTime() + m * 60_000).toISOString() });
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-2 rounded-2xl border border-line bg-surface p-3">
      <label className="flex flex-col gap-1 text-sm text-muted">Started
        <input type="datetime-local" required value={start} onChange={(e) => setStart(e.target.value)}
          className="h-11 rounded-xl border border-line px-2 text-ink" />
      </label>
      <label className="flex flex-col gap-1 text-sm text-muted">Duration (minutes)
        <input type="number" min={1} value={minutes} onChange={(e) => setMinutes(e.target.value)}
          className="h-11 rounded-xl border border-line px-2 text-ink" />
      </label>
      {error && <p role="alert" className="text-projects-dark">{error}</p>}
      <div className="flex justify-end gap-2">
        <button type="button" onClick={onCancel} className="h-11 rounded-full border border-line px-4">Cancel</button>
        <button type="submit" className="h-11 rounded-full bg-projects px-4 text-white">Save time</button>
      </div>
    </form>
  );
}
```

`src/features/parts/YarnUsageForm.tsx`:
```tsx
import { useState, type FormEvent } from 'react';

type Props = {
  yarns: { id: string; name: string }[];
  onSave: (u: { yarnId: string; skeins: number }) => void;
  onCancel: () => void;
};

export default function YarnUsageForm({ yarns, onSave, onCancel }: Props) {
  const [yarnId, setYarnId] = useState('');
  const [skeins, setSkeins] = useState('0.25');

  function submit(e: FormEvent) {
    e.preventDefault();
    if (yarnId && Number(skeins) >= 0) onSave({ yarnId, skeins: Number(skeins) });
  }

  return (
    <form onSubmit={submit} className="flex items-end gap-2 rounded-2xl border border-line bg-surface p-3">
      <label className="flex flex-1 flex-col gap-1 text-sm text-muted">Yarn
        <select required value={yarnId} onChange={(e) => setYarnId(e.target.value)}
          className="h-11 rounded-xl border border-line px-2 text-ink">
          <option value="">Choose…</option>
          {yarns.map((y) => <option key={y.id} value={y.id}>{y.name}</option>)}
        </select>
      </label>
      <label className="flex w-24 flex-col gap-1 text-sm text-muted">Skeins used
        <input type="number" min={0} step={0.05} value={skeins} onChange={(e) => setSkeins(e.target.value)}
          className="h-11 rounded-xl border border-line px-2 text-ink" />
      </label>
      <button type="button" onClick={onCancel} className="h-11 px-2 text-muted">Cancel</button>
      <button type="submit" className="h-11 rounded-full bg-projects px-4 text-white">Save yarn</button>
    </form>
  );
}
```

- [ ] **Step 4: Implement `src/features/parts/api.ts`**

```ts
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../../lib/supabase';
import type { Part } from '../projects/api';

export type Session = { id: string; started_at: string; ended_at: string | null };
export type PartDetail = Part & {
  project: { id: string; name: string };
  time_sessions: Session[];
  part_yarns: { id: string; skeins_used: number; yarn: { id: string; name: string; brand: string | null } | null }[];
};

export function usePart(id: string) {
  return useQuery({
    queryKey: ['parts', id],
    queryFn: async (): Promise<PartDetail> => {
      const { data, error } = await supabase
        .from('parts')
        .select('*, project:projects(id, name), time_sessions(id, started_at, ended_at), part_yarns(id, skeins_used, yarn:yarns(id, name, brand))')
        .eq('id', id)
        .single();
      if (error) throw error;
      const sessions = [...data.time_sessions].sort((a, b) => b.started_at.localeCompare(a.started_at));
      return { ...data, time_sessions: sessions } as PartDetail;
    },
  });
}

function useInvalidate() {
  const qc = useQueryClient();
  return () => Promise.all(['parts', 'projects', 'yarns', 'timer'].map((k) => qc.invalidateQueries({ queryKey: [k] })));
}

export function useSaveSession() {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: async (s: { id?: string; part_id: string; started_at: string; ended_at: string }) => {
      const { id, ...fields } = s;
      const { error } = id
        ? await supabase.from('time_sessions').update(fields).eq('id', id)
        : await supabase.from('time_sessions').insert(fields);
      if (error) throw error;
    },
    onSuccess: invalidate,
  });
}

export function useDeleteSession() {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('time_sessions').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: invalidate,
  });
}

export function useSetYarnUsage() {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: async ({ partId, yarnId, skeins }: { partId: string; yarnId: string; skeins: number }) => {
      const { error } = await supabase
        .from('part_yarns')
        .upsert({ part_id: partId, yarn_id: yarnId, skeins_used: skeins }, { onConflict: 'part_id,yarn_id' });
      if (error) throw error;
    },
    onSuccess: invalidate,
  });
}

export function useRemoveYarnUsage() {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('part_yarns').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: invalidate,
  });
}
```

- [ ] **Step 5: Implement `src/features/parts/PartPage.tsx`**

```tsx
import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router';
import ConfirmDialog from '../../components/ConfirmDialog';
import ErrorBox from '../../components/ErrorBox';
import { formatDuration, formatSkeins, sessionSeconds, sumSeconds } from '../../lib/calc';
import { useDeletePart, useUpdatePart } from '../projects/api';
import { useYarns } from '../stash/api';
import { useDeleteSession, usePart, useRemoveYarnUsage, useSaveSession, useSetYarnUsage, type Session } from './api';
import RowCounter from './RowCounter';
import SessionForm from './SessionForm';
import YarnUsageForm from './YarnUsageForm';

const h2 = 'text-sm uppercase tracking-wide text-muted';
const when = (iso: string) =>
  new Date(iso).toLocaleString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });

export default function PartPage() {
  const { id } = useParams() as { id: string };
  const navigate = useNavigate();
  const { data: part, isPending, error, refetch } = usePart(id);
  const updatePart = useUpdatePart();
  const deletePart = useDeletePart();
  const saveSession = useSaveSession();
  const deleteSession = useDeleteSession();
  const setYarn = useSetYarnUsage();
  const removeYarn = useRemoveYarnUsage();
  const yarns = useYarns();
  const [sessionForm, setSessionForm] = useState<null | 'new' | Session>(null);
  const [addingYarn, setAddingYarn] = useState(false);
  const [renaming, setRenaming] = useState<string | null>(null);
  const [confirming, setConfirming] = useState(false);

  if (error) return <ErrorBox error={error} onRetry={() => refetch()} />;
  if (isPending) return <p className="p-4 text-muted">Loading…</p>;

  const now = new Date();
  const patch = (p: Parameters<typeof updatePart.mutate>[0]['patch']) => updatePart.mutate({ id, patch: p });

  return (
    <div className="flex flex-col gap-3 p-4">
      <Link to={`/projects/${part.project.id}`} className="flex min-h-11 items-center self-start text-projects">‹ {part.project.name}</Link>
      <div className="flex items-center justify-between">
        {renaming === null ? (
          <button type="button" onClick={() => setRenaming(part.name)} className="text-left">
            <h1 className="text-4xl">{part.name}</h1>
          </button>
        ) : (
          <input autoFocus aria-label="Part name" value={renaming} onChange={(e) => setRenaming(e.target.value)}
            onBlur={() => { if (renaming.trim()) patch({ name: renaming.trim() }); setRenaming(null); }}
            className="h-12 flex-1 rounded-xl border border-line px-3 text-2xl" />
        )}
        <label className="flex min-h-11 items-center gap-2">
          <input type="checkbox" checked={part.done} onChange={(e) => patch({ done: e.target.checked })} className="h-5 w-5 accent-stash" />
          Done
        </label>
      </div>

      <section className="flex flex-col gap-3 rounded-3xl border border-line bg-surface p-4">
        <RowCounter current={part.current_row} total={part.total_rows} onChange={(row) => patch({ current_row: row })} />
        <label className="flex flex-col gap-1.5 text-sm text-muted">Where I stopped
          <textarea rows={2} defaultValue={part.resume_note ?? ''}
            onBlur={(e) => { if (e.target.value !== (part.resume_note ?? '')) patch({ resume_note: e.target.value || null }); }}
            className="resize-none rounded-xl border border-line bg-bg p-2.5 text-base text-ink" />
        </label>
      </section>

      <div className="flex items-center justify-between">
        <h2 className={h2}>Time · {formatDuration(sumSeconds(part.time_sessions, now))}</h2>
        <button type="button" onClick={() => setSessionForm('new')} className="min-h-11 text-projects">+ Add time manually</button>
      </div>
      {sessionForm && (
        <SessionForm
          initial={sessionForm === 'new' ? undefined : { started_at: sessionForm.started_at, minutes: Math.round(sessionSeconds(sessionForm, now) / 60) }}
          onCancel={() => setSessionForm(null)}
          onSave={(s) => {
            saveSession.mutate({ ...s, part_id: id, id: sessionForm === 'new' ? undefined : sessionForm.id });
            setSessionForm(null);
          }}
        />
      )}
      <ul className="rounded-2xl border border-line bg-surface">
        {part.time_sessions.map((s) => (
          <li key={s.id} className="flex items-center justify-between border-b border-divider px-3.5 py-2 last:border-b-0">
            <span>{when(s.started_at)}</span>
            {s.ended_at === null ? (
              <span className="text-projects">running · {formatDuration(sessionSeconds(s, now))}</span>
            ) : (
              <span className="flex items-center gap-1">
                {formatDuration(sessionSeconds(s, now))}
                <button type="button" aria-label="Edit time" onClick={() => setSessionForm(s)} className="h-11 w-9 text-muted">✎</button>
                <button type="button" aria-label="Delete time" onClick={() => deleteSession.mutate(s.id)} className="h-11 w-9 text-muted">×</button>
              </span>
            )}
          </li>
        ))}
        {part.time_sessions.length === 0 && <li className="px-3.5 py-3 text-muted">No time yet.</li>}
      </ul>

      <div className="flex items-center justify-between">
        <h2 className={h2}>Yarn used</h2>
        <button type="button" onClick={() => setAddingYarn(true)} className="min-h-11 text-projects">+ Add yarn</button>
      </div>
      {addingYarn && (
        <YarnUsageForm
          yarns={yarns.data ?? []}
          onCancel={() => setAddingYarn(false)}
          onSave={({ yarnId, skeins }) => { setYarn.mutate({ partId: id, yarnId, skeins }); setAddingYarn(false); }}
        />
      )}
      {part.part_yarns.map((u) => (
        <div key={u.id} className="flex items-center gap-2.5 rounded-2xl border border-line bg-surface px-3.5 py-2">
          <span className="flex-1">{u.yarn?.name}{u.yarn?.brand && ` · ${u.yarn.brand}`}</span>
          <span>{formatSkeins(Number(u.skeins_used))}</span>
          <button type="button" aria-label={`Remove ${u.yarn?.name}`} onClick={() => removeYarn.mutate(u.id)} className="h-11 w-9 text-muted">×</button>
        </div>
      ))}

      <button type="button" onClick={() => setConfirming(true)} className="h-11 self-start rounded-full border border-line px-5">Delete part</button>
      <ConfirmDialog
        open={confirming}
        title={`Delete ${part.name}?`}
        message="Its time and yarn records are deleted too."
        confirmLabel="Delete"
        onCancel={() => setConfirming(false)}
        onConfirm={() => { setConfirming(false); deletePart.mutate(id, { onSuccess: () => navigate(`/projects/${part.project.id}`) }); }}
      />
    </div>
  );
}
```

- [ ] **Step 6: Add the route to `src/App.tsx`**

Import `PartPage from './features/parts/PartPage'` and add inside the layout route:
```tsx
<Route path="parts/:id" element={<PartPage />} />
```

- [ ] **Step 7: Run the tests and try it**

Run: `npm test`. Expected: PASS.
Run: `npm run dev`. Expected: open "Leg 1" from the project page; + / − change the row and the project page shows "Row n/18"; the resume note shows under the part name on the project page; add 25 minutes by hand; add 0.25 skein of a stash yarn and see the stash's "free" count drop.

- [ ] **Step 8: Commit**

```bash
git add src
git commit -m "feat: add part page with row counter, resume note, time and yarn used"
```

---

### Task 14: Timer (timer bar, Timer tab, start buttons)

**Files:**
- Create: `src/features/timer/logic.ts`, `src/features/timer/api.ts`, `src/features/timer/useNow.ts`, `src/features/timer/StartTimerButton.tsx`, `src/features/timer/TimerBar.tsx`, `src/features/timer/TimerTab.tsx`
- Modify: `src/components/Layout.tsx` (timer bar), `src/features/projects/ProjectPage.tsx` (▶ per part), `src/features/projects/ProjectPage.test.tsx` (mock the button), `src/App.tsx` (route)
- Test: `src/features/timer/logic.test.ts`, `src/features/timer/TimerBar.test.tsx`, `src/features/timer/TimerTab.test.tsx`

**Interfaces:**
- Consumes: `sessionSeconds`, `sumSeconds`, `formatClock`, `formatDuration`, `rowLabel` (Tasks 2–3); `HourglassIcon` (Task 8).
- Produces:
  - `logic.ts`: `type RecentRow = { started_at: string; part: RecentPart | null }`, `type RecentPart = { id: string; name: string; done: boolean; current_row: number | null; total_rows: number | null; resume_note: string | null; project: { name: string } | null }`, `recentParts(rows: RecentRow[], excludePartId: string | null, limit?: number): (RecentPart & { lastWorked: string })[]`.
  - `api.ts`: `useRunningSession()` (query key `['timer', 'running']`, data `RunningSession | null`), `useRecentParts()` (`['timer', 'recent']`), `useStartTimer()` (`(partId) => void`), `useStopTimer()`, `useSetRow()` (`({ partId, row })`). All mutations invalidate `['timer']`, `['projects']` and `['parts']`.
    - `type RunningSession = { id: string; started_at: string; part: { id: string; name: string; current_row: number | null; total_rows: number | null; project: { id: string; name: string }; time_sessions: { started_at: string; ended_at: string | null }[] } }`
  - `useNow(intervalMs?: number): Date`: re-renders every second.
  - `StartTimerButton({ partId, label }: { partId: string; label: string })`: ▶ "Start timer for <label>", or ■ "Stop timer" when this part is running.
  - Route: `/timer`.

- [ ] **Step 1: Write the failing tests**

`src/features/timer/logic.test.ts`:
```ts
import { recentParts, type RecentRow } from './logic';

const part = (id: string, name: string) => ({
  id, name, done: false, current_row: null, total_rows: null, resume_note: null, project: { name: 'P' },
});

test('recentParts keeps the latest session per part, skips the running part, and limits', () => {
  const rows: RecentRow[] = [
    { started_at: '2026-09-24T20:00:00Z', part: part('a', 'Leg 1') },
    { started_at: '2026-09-24T19:00:00Z', part: part('b', 'Main') },
    { started_at: '2026-09-23T19:00:00Z', part: part('a', 'Leg 1') },
    { started_at: '2026-09-22T19:00:00Z', part: null },
    { started_at: '2026-09-21T19:00:00Z', part: part('c', 'Arm 2') },
  ];
  expect(recentParts(rows, 'b').map((p) => [p.id, p.lastWorked])).toEqual([
    ['a', '2026-09-24T20:00:00Z'],
    ['c', '2026-09-21T19:00:00Z'],
  ]);
  expect(recentParts(rows, null, 1).map((p) => p.id)).toEqual(['a']);
});
```

`src/features/timer/TimerBar.test.tsx`:
```tsx
import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderWithProviders } from '../../test/render';
import TimerBar from './TimerBar';

const setRow = vi.fn();
const stop = vi.fn();
const running = vi.hoisted(() => ({ value: null as unknown }));
vi.mock('./api', () => ({
  useRunningSession: () => ({ data: running.value }),
  useSetRow: () => ({ mutate: setRow }),
  useStopTimer: () => ({ mutate: stop }),
}));

const session = {
  id: 's1', started_at: new Date(Date.now() - 12 * 60_000).toISOString(),
  part: {
    id: 'pt1', name: 'Leg 1', current_row: 12, total_rows: 18, project: { id: 'pr1', name: 'T-rex' },
    time_sessions: [{ started_at: '2026-09-23T21:00:00Z', ended_at: '2026-09-23T21:30:00Z' }],
  },
};

test('hidden when nothing is being timed', () => {
  running.value = null;
  const { container } = renderWithProviders(<TimerBar />);
  expect(container).toBeEmptyDOMElement();
});

test('shows the running part and adds a row', async () => {
  running.value = session;
  renderWithProviders(<TimerBar />);
  expect(screen.getByRole('link', { name: /Leg 1 · T-rex/ })).toHaveTextContent('Row 12/18');
  await userEvent.click(screen.getByRole('button', { name: '+ row' }));
  expect(setRow).toHaveBeenCalledWith({ partId: 'pt1', row: 13 });
  await userEvent.click(screen.getByRole('button', { name: 'Stop timer' }));
  expect(stop).toHaveBeenCalled();
});

test('hidden on the Timer tab itself', () => {
  running.value = session;
  const { container } = renderWithProviders(<TimerBar />, { route: '/timer', path: '/timer' });
  expect(container).toBeEmptyDOMElement();
});
```

`src/features/timer/TimerTab.test.tsx`:
```tsx
import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderWithProviders } from '../../test/render';
import TimerTab from './TimerTab';

const start = vi.fn();
vi.mock('./api', () => ({
  useRunningSession: () => ({ data: null, isPending: false }),
  useRecentParts: () => ({
    data: [{ started_at: '2026-09-23T19:00:00Z', part: {
      id: 'pt9', name: 'Main', done: false, current_row: 64, total_rows: 120, resume_note: null, project: { name: 'Winter scarf' },
    } }],
  }),
  useStartTimer: () => ({ mutate: start }),
  useStopTimer: () => ({ mutate: vi.fn() }),
  useSetRow: () => ({ mutate: vi.fn() }),
}));

test('when idle, lists parts to pick up again and starts one', async () => {
  renderWithProviders(<TimerTab />, { route: '/timer', path: '/timer' });
  expect(screen.getByText('Nothing is being timed.')).toBeInTheDocument();
  expect(screen.getByText('Main · Winter scarf')).toBeInTheDocument();
  expect(screen.getByText(/Row 64\/120/)).toBeInTheDocument();
  await userEvent.click(screen.getByRole('button', { name: 'Start timer for Main' }));
  expect(start).toHaveBeenCalledWith('pt9');
});
```

- [ ] **Step 2: Run to verify failure**

Run: `npm test -- src/features/timer`
Expected: FAIL with unresolved `./logic`, `./TimerBar`, `./TimerTab`.

- [ ] **Step 3: Implement the logic, hook and API**

`src/features/timer/logic.ts`:
```ts
export type RecentPart = {
  id: string; name: string; done: boolean; current_row: number | null; total_rows: number | null;
  resume_note: string | null; project: { name: string } | null;
};
export type RecentRow = { started_at: string; part: RecentPart | null };

export function recentParts(rows: RecentRow[], excludePartId: string | null, limit = 5) {
  const seen = new Set<string>();
  const out: (RecentPart & { lastWorked: string })[] = [];
  for (const r of rows) {
    if (!r.part || r.part.id === excludePartId || seen.has(r.part.id)) continue;
    seen.add(r.part.id);
    out.push({ ...r.part, lastWorked: r.started_at });
    if (out.length === limit) break;
  }
  return out;
}
```

`src/features/timer/useNow.ts`:
```ts
import { useEffect, useState } from 'react';

export function useNow(intervalMs = 1000): Date {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), intervalMs);
    return () => clearInterval(t);
  }, [intervalMs]);
  return now;
}
```

`src/features/timer/api.ts`:
```ts
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../../lib/supabase';
import type { RecentRow } from './logic';

export type RunningSession = {
  id: string;
  started_at: string;
  part: {
    id: string; name: string; current_row: number | null; total_rows: number | null;
    project: { id: string; name: string };
    time_sessions: { started_at: string; ended_at: string | null }[];
  };
};

export function useRunningSession() {
  return useQuery({
    queryKey: ['timer', 'running'],
    queryFn: async (): Promise<RunningSession | null> => {
      const { data, error } = await supabase
        .from('time_sessions')
        .select('id, started_at, part:parts(id, name, current_row, total_rows, project:projects(id, name), time_sessions(started_at, ended_at))')
        .is('ended_at', null)
        .maybeSingle();
      if (error) throw error;
      return data as RunningSession | null;
    },
    refetchOnWindowFocus: true,
  });
}

export function useRecentParts() {
  return useQuery({
    queryKey: ['timer', 'recent'],
    queryFn: async (): Promise<RecentRow[]> => {
      const { data, error } = await supabase
        .from('time_sessions')
        .select('started_at, part:parts(id, name, done, current_row, total_rows, resume_note, project:projects(name))')
        .order('started_at', { ascending: false })
        .limit(30);
      if (error) throw error;
      return data as RecentRow[];
    },
  });
}

function useInvalidate() {
  const qc = useQueryClient();
  return () => Promise.all(['timer', 'projects', 'parts'].map((k) => qc.invalidateQueries({ queryKey: [k] })));
}

export function useStartTimer() {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: async (partId: string) => {
      const { error } = await supabase.rpc('start_timer', { p_part_id: partId });
      if (error) throw error;
    },
    onSuccess: invalidate,
  });
}

export function useStopTimer() {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: async () => {
      const { error } = await supabase.rpc('stop_timer');
      if (error) throw error;
    },
    onSuccess: invalidate,
  });
}

export function useSetRow() {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: async ({ partId, row }: { partId: string; row: number }) => {
      const { error } = await supabase.from('parts').update({ current_row: Math.max(0, row) }).eq('id', partId);
      if (error) throw error;
    },
    onSuccess: invalidate,
  });
}
```

- [ ] **Step 4: Implement the components**

`src/features/timer/StartTimerButton.tsx`:
```tsx
import { useRunningSession, useStartTimer, useStopTimer } from './api';

export default function StartTimerButton({ partId, label }: { partId: string; label: string }) {
  const running = useRunningSession();
  const start = useStartTimer();
  const stop = useStopTimer();
  const isRunning = running.data?.part.id === partId;
  return isRunning ? (
    <button type="button" aria-label="Stop timer" onClick={() => stop.mutate()}
      className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-timer">
      <svg width="12" height="12" viewBox="0 0 12 12" aria-hidden="true"><rect width="12" height="12" rx="2" fill="#FFFFFF" /></svg>
    </button>
  ) : (
    <button type="button" aria-label={`Start timer for ${label}`} onClick={() => start.mutate(partId)}
      className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-line bg-surface text-timer">
      <svg width="14" height="14" viewBox="0 0 14 14" aria-hidden="true"><path d="M3 1.5v11l9-5.5z" fill="currentColor" /></svg>
    </button>
  );
}
```

`src/features/timer/TimerBar.tsx`:
```tsx
import { Link, useLocation } from 'react-router';
import { formatClock, rowLabel, sumSeconds } from '../../lib/calc';
import { useRunningSession, useSetRow, useStopTimer } from './api';
import { useNow } from './useNow';

export default function TimerBar() {
  const { pathname } = useLocation();
  const { data: running } = useRunningSession();
  const setRow = useSetRow();
  const stop = useStopTimer();
  const now = useNow();
  if (!running || pathname.startsWith('/timer')) return null;

  const { part } = running;
  const others = part.time_sessions.filter((s) => s.ended_at !== null);
  const seconds = sumSeconds([...others, { started_at: running.started_at, ended_at: null }], now);

  return (
    <div className="flex h-14 items-center gap-2.5 bg-timer pl-4 pr-2.5 text-white">
      <Link to={`/parts/${part.id}`} className="flex min-h-11 flex-1 items-center gap-2.5">
        <span className="h-2.5 w-2.5 rounded-full bg-row" />
        <span className="flex flex-col">
          <span className="text-sm">{part.name} · {part.project.name}</span>
          <span className="text-xs opacity-90">{formatClock(seconds)} · {rowLabel(part.current_row, part.total_rows)}</span>
        </span>
      </Link>
      <button type="button" onClick={() => setRow.mutate({ partId: part.id, row: (part.current_row ?? 0) + 1 })}
        className="h-11 rounded-full bg-row px-3.5 text-sm text-row-ink">+ row</button>
      <button type="button" aria-label="Stop timer" onClick={() => stop.mutate()}
        className="flex h-11 w-11 items-center justify-center rounded-full bg-surface">
        <svg width="14" height="14" viewBox="0 0 14 14" aria-hidden="true"><rect x="1" y="1" width="12" height="12" rx="2" fill="#4169E1" /></svg>
      </button>
    </div>
  );
}
```

`src/features/timer/TimerTab.tsx`:
```tsx
import { Link } from 'react-router';
import { formatClock, formatDuration, rowLabel, sessionSeconds, sumSeconds } from '../../lib/calc';
import { useRecentParts, useRunningSession, useSetRow, useStopTimer, type RunningSession } from './api';
import { recentParts } from './logic';
import StartTimerButton from './StartTimerButton';
import { useNow } from './useNow';

export default function TimerTab() {
  const { data: running } = useRunningSession();
  const recent = useRecentParts();
  const setRow = useSetRow();
  const stop = useStopTimer();
  const now = useNow();
  const list = recentParts(recent.data ?? [], running?.part.id ?? null);

  return (
    <div className="flex flex-col gap-4 p-4">
      <h1 className="pt-2 text-4xl">Timer</h1>
      {running ? (
        runningCard(running)
      ) : (
        <p className="rounded-3xl border border-line bg-surface p-5 text-muted">Nothing is being timed.</p>
      )}
      <h2 className="text-sm uppercase tracking-wide text-muted">Pick up again</h2>
      <ul className="rounded-2xl border border-line bg-surface">
        {list.map((p) => (
          <li key={p.id} className="flex items-center gap-2.5 border-b border-divider py-1.5 pl-3.5 pr-2 last:border-b-0">
            <span className="flex flex-1 flex-col">
              <span>{p.name} · {p.project?.name}</span>
              <span className="text-xs text-muted">
                {p.done ? 'Done' : rowLabel(p.current_row, p.total_rows)}
                {p.resume_note && ` · ${p.resume_note}`}
              </span>
            </span>
            <StartTimerButton partId={p.id} label={p.name} />
          </li>
        ))}
        {list.length === 0 && <li className="px-3.5 py-3 text-muted">Start a timer from a project's parts.</li>}
      </ul>
    </div>
  );

  // A plain render helper (not a component) so the card isn't remounted on every clock tick.
  function runningCard(r: RunningSession) {
    const { part } = r;
    const closed = part.time_sessions.filter((s) => s.ended_at !== null);
    const current = { started_at: r.started_at, ended_at: null };
    return (
      <section className="flex flex-col items-center gap-4 rounded-3xl bg-timer px-5 py-6 text-white">
        <Link to={`/parts/${part.id}`} className="flex min-h-11 items-center">{part.project.name} · {part.name} ›</Link>
        <span className="text-7xl leading-none">{formatClock(sumSeconds([...closed, current], now))}</span>
        <span className="text-sm opacity-90">
          This session {formatDuration(sessionSeconds(current, now))} · part total {formatDuration(sumSeconds([...closed, current], now))}
        </span>
        <div className="flex w-full items-center justify-between rounded-2xl bg-timer-dark p-3">
          <button type="button" aria-label="Previous row"
            onClick={() => setRow.mutate({ partId: part.id, row: (part.current_row ?? 0) - 1 })}
            className="h-13 w-13 rounded-full bg-timer-darker text-2xl">−</button>
          <span className="text-lg">Row <b className="text-3xl">{part.current_row ?? 0}</b>{part.total_rows !== null && ` / ${part.total_rows}`}</span>
          <button type="button" onClick={() => setRow.mutate({ partId: part.id, row: (part.current_row ?? 0) + 1 })}
            className="h-13 rounded-full bg-row px-5 text-lg text-row-ink">+ row</button>
        </div>
        <button type="button" onClick={() => stop.mutate()} className="h-14 w-full rounded-full bg-sun text-lg text-ink">Stop</button>
      </section>
    );
  }
}
```

- [ ] **Step 5: Wire the timer into the app**

`src/components/Layout.tsx`: import `TimerBar from '../features/timer/TimerBar'` and render it just above `<TabBar />`:
```tsx
      <div className="fixed inset-x-0 bottom-0 mx-auto max-w-md">
        <TimerBar />
        <TabBar />
      </div>
```

`src/features/projects/ProjectPage.tsx`: import `StartTimerButton from '../timer/StartTimerButton'` and, in each part row, right after the row label `<span>`, add:
```tsx
            {!editing && <StartTimerButton partId={part.id} label={part.name} />}
```

`src/features/projects/ProjectPage.test.tsx`: add next to the other mocks:
```tsx
vi.mock('../timer/StartTimerButton', () => ({ default: () => null }));
```

`src/App.test.tsx`: add a mock so the layout's timer bar doesn't query the database:
```tsx
vi.mock('./features/timer/TimerBar', () => ({ default: () => null }));
```

`src/App.tsx`: import `TimerTab from './features/timer/TimerTab'` and add inside the layout route:
```tsx
<Route path="timer" element={<TimerTab />} />
```

- [ ] **Step 6: Run the tests and try it**

Run: `npm test`. Expected: PASS.
Run: `npm run dev`. Expected: press ▶ on "Leg 1": the royal blue timer bar appears on every screen with "0:00:01 · Row 12/18"; "+ row" (light blue) adds a row; ▶ on another part stops the first; the Timer tab shows the big clock and "Pick up again"; close the tab and open the app on your phone: the same timer is still running.

- [ ] **Step 7: Commit**

```bash
git add src
git commit -m "feat: add timer bar, timer tab and per-part start buttons"
```

---

### Task 15: Installable app, deployment and end-to-end test

**Files:**
- Create: `public/icons/icon.svg`, generated `public/icons/*.png`, `netlify.toml`, `playwright.config.ts`, `e2e/main-flow.spec.ts`
- Modify: `vite.config.ts` (PWA plugin), `index.html` (icons)

**Interfaces:**
- Consumes: the whole app; `admin`-style user creation as in `supabase/tests/helpers.ts`.
- Produces: a PWA manifest (name "Crochet Tracker", short name "Crochet", `display: standalone`, theme and background `#E4EEF9`), a Netlify deployment, and `npm run e2e`.

- [ ] **Step 1: Create the icon and generate the PNGs**

`public/icons/icon.svg`:
```svg
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">
  <rect width="512" height="512" rx="112" fill="#E4EEF9"/>
  <g fill="none" stroke="#B8336A" stroke-width="26" stroke-linecap="round">
    <circle cx="256" cy="256" r="150"/>
    <path d="M136 186c80 22 160 22 240 0"/>
    <path d="M114 276c95 30 189 30 284 0"/>
    <path d="M166 356c60 18 120 18 180 0"/>
  </g>
</svg>
```

Run: `npx @vite-pwa/assets-generator --preset minimal-2023 public/icons/icon.svg`
Expected: `pwa-64x64.png`, `pwa-192x192.png`, `pwa-512x512.png`, `maskable-icon-512x512.png`, `apple-touch-icon-180x180.png` and `favicon.ico` in `public/icons/`.

- [ ] **Step 2: Add the PWA plugin**

`vite.config.ts`:
```ts
/// <reference types="vitest/config" />
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      registerType: 'autoUpdate',
      manifest: {
        name: 'Crochet Tracker',
        short_name: 'Crochet',
        start_url: '/',
        display: 'standalone',
        theme_color: '#E4EEF9',
        background_color: '#E4EEF9',
        icons: [
          { src: '/icons/pwa-192x192.png', sizes: '192x192', type: 'image/png' },
          { src: '/icons/pwa-512x512.png', sizes: '512x512', type: 'image/png' },
          { src: '/icons/maskable-icon-512x512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
    }),
  ],
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['src/test/setup.ts'],
    include: ['src/**/*.test.{ts,tsx}'],
  },
});
```

`index.html`: add inside `<head>`:
```html
    <link rel="icon" href="/icons/favicon.ico" sizes="48x48" />
    <link rel="apple-touch-icon" href="/icons/apple-touch-icon-180x180.png" />
```

Run: `npm run build`. Expected: build succeeds and prints `PWA v1.x … files generated dist/sw.js dist/manifest.webmanifest`.

- [ ] **Step 3: Configure Netlify**

`netlify.toml`:
```toml
[build]
  command = "npm run build"
  publish = "dist"

[build.environment]
  NODE_VERSION = "22"

[[redirects]]
  from = "/*"
  to = "/index.html"
  status = 200
```

- [ ] **Step 4: Write the end-to-end test**

`playwright.config.ts`:
```ts
import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: 'e2e',
  timeout: 60_000,
  use: { ...devices['Pixel 7'], baseURL: 'http://localhost:5174' },
  webServer: {
    // "--mode test" makes Vite read .env.test, so the app talks to the crochet-test project
    command: 'npx vite --mode test --port 5174 --strictPort',
    url: 'http://localhost:5174',
    reuseExistingServer: false,
  },
});
```

`e2e/main-flow.spec.ts`:
```ts
import { expect, test } from '@playwright/test';
import { createClient } from '@supabase/supabase-js';
import { config } from 'dotenv';

config({ path: '.env.test' });
const url = process.env.VITE_SUPABASE_URL!;
const anonKey = process.env.VITE_SUPABASE_ANON_KEY!;
const admin = createClient(url, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false } });
const storageKey = `sb-${new URL(url).hostname.split('.')[0]}-auth-token`;
let userId: string;

test.beforeEach(async ({ page }) => {
  const email = `e2e-${crypto.randomUUID()}@example.com`;
  const password = `pw-${crypto.randomUUID()}`;
  const { data } = await admin.auth.admin.createUser({ email, password, email_confirm: true });
  userId = data.user!.id;
  const client = createClient(url, anonKey, { auth: { persistSession: false } });
  const { data: signIn } = await client.auth.signInWithPassword({ email, password });
  // Sign the browser in without an email round-trip by seeding supabase-js's stored session.
  await page.addInitScript(([key, value]) => localStorage.setItem(key, value), [storageKey, JSON.stringify(signIn.session)]);
});

test.afterEach(async () => {
  await admin.auth.admin.deleteUser(userId);
});

test('pattern → project → timer → rows → yarn → stash', async ({ page }) => {
  // A yarn in the stash
  await page.goto('/stash/new');
  await page.getByLabel('Name', { exact: true }).fill('Fern green');
  await page.getByLabel('Skeins owned').fill('3');
  await page.getByRole('button', { name: 'Save' }).click();
  await expect(page.getByRole('heading', { name: 'Fern green' })).toBeVisible();

  // A pattern with a type, a recommended hook and parts
  await page.goto('/patterns/new');
  await page.getByLabel('Name', { exact: true }).fill('T-rex');
  await page.getByRole('radio', { name: 'Amigurumi' }).click();
  await page.getByLabel('Recommended hook').selectOption({ label: '3.5 mm' });
  await page.getByLabel('Part name').first().fill('Head');
  await page.getByLabel('Rows', { exact: true }).first().fill('24');
  await page.getByRole('button', { name: '+ Add part' }).click();
  await page.getByLabel('Part name').nth(1).fill('Leg');
  await page.getByLabel('How many').nth(1).fill('2');
  await page.getByLabel('Rows', { exact: true }).nth(1).fill('18');
  await page.getByRole('button', { name: 'Save' }).click();

  // Start a project from it
  await page.getByRole('button', { name: 'Start a project from this pattern' }).click();
  await expect(page.getByRole('link', { name: /Leg 2/ })).toBeVisible();
  await expect(page.getByText('hook 3.5 mm ▾')).toBeVisible();

  // Time Leg 1 and count two rows from the timer bar
  await page.getByRole('button', { name: 'Start timer for Leg 1' }).click();
  const bar = page.getByRole('link', { name: /Leg 1 · T-rex/ });
  await expect(bar).toBeVisible();
  await page.getByRole('button', { name: '+ row' }).click();
  await page.getByRole('button', { name: '+ row' }).click();
  await expect(bar).toContainText('Row 2/18');
  await page.getByRole('button', { name: 'Stop timer' }).first().click();
  await expect(bar).toBeHidden();

  // Record yarn on Leg 1 and check the stash
  await page.getByRole('link', { name: /Leg 1/ }).click();
  await page.getByRole('button', { name: '+ Add yarn' }).click();
  await page.getByLabel('Yarn', { exact: true }).selectOption({ label: 'Fern green' });
  await page.getByLabel('Skeins used').fill('0.5');
  await page.getByRole('button', { name: 'Save yarn' }).click();
  await page.goto('/stash');
  await expect(page.getByRole('link', { name: /Fern green/ })).toContainText('2.5 sk free / 3 sk');
});
```

- [ ] **Step 5: Run the end-to-end test**

Run: `npx playwright install chromium`, then `npm run e2e`.
Expected: `1 passed`.

- [ ] **Step 6: Deploy**

1. Push the repository to GitHub (create an empty private repository, then `git remote add origin <url>` and `git push -u origin main`).
2. In Netlify: *Add new site → Import an existing project →* pick the repository. Netlify reads `netlify.toml`.
3. In *Site configuration → Environment variables*, add `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` of the **crochet** (real) project, then trigger a deploy.
4. In Supabase (real project) *Authentication → URL Configuration*: set *Site URL* to the Netlify URL and add it to *Redirect URLs*.
5. On your phone, open the Netlify URL, sign in with the magic link, then *Share → Add to Home Screen* (iPhone) or *Install app* (Android).

Expected: the app opens full-screen from the home screen icon; a timer started on the phone shows on the PC.

- [ ] **Step 7: Commit**

```bash
git add .
git commit -m "feat: make the app installable, add Netlify config and end-to-end test"
```
