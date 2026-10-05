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
  await page.getByRole('button', { name: 'Stop timer', exact: true }).click();
  await expect(bar).toBeHidden();

  // Record yarn on Leg 1 and check the stash
  await page.getByRole('link', { name: /Leg 1/ }).click();
  await page.getByRole('button', { name: '+ Add yarn' }).click();
  await page.getByRole('combobox', { name: 'Yarn' }).selectOption({ label: 'Fern green' });
  await page.getByLabel('Skeins used').fill('0.5');
  await page.getByRole('button', { name: 'Save yarn' }).click();
  await page.goto('/stash');
  await expect(page.getByRole('link', { name: /Fern green/ })).toContainText('2.5 sk free / 3 sk');
});
