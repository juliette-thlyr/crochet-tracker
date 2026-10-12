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

test('lists → yarn with suggestions → stash search → pattern materials → project yarns → update from pattern', async ({ page }) => {
  // Paste the user's yarn list
  await page.goto('/stash/lists');
  await page.getByLabel('Paste yarns').fill([
    'Hobbii ; Honey Bunny ; Super Bulky ; Polyester',
    'Hobbii ; Baby Snuggle ; Super Bulky ; Polyester',
    'Hobbii ; Toucan ; Super Bulky ; Polyester',
  ].join('\n'));
  await page.getByRole('button', { name: 'Import yarns' }).click();
  await expect(page.getByRole('status')).toHaveText('3 added, 0 already there');

  // A yarn from the suggestions
  await page.goto('/stash/new');
  await page.getByLabel('Brand').fill('Hob');
  await page.getByRole('option', { name: 'Hobbii' }).click();
  await page.getByLabel('Name', { exact: true }).click();
  await page.getByRole('option', { name: 'Honey Bunny' }).click();
  await expect(page.getByLabel('Weight')).toHaveValue('super_bulky');
  await expect(page.getByLabel('Fiber')).toHaveValue('Polyester');
  await page.getByRole('radio', { name: 'Pink' }).click();
  await page.getByLabel('Skeins owned').fill('3');
  await page.getByRole('button', { name: 'Save' }).click();
  await expect(page.getByRole('heading', { name: 'Honey Bunny' })).toBeVisible();

  // Find it in the stash by search and by colour
  await page.goto('/stash');
  await page.getByLabel('Search yarns').fill('bunny');
  await expect(page.getByRole('link', { name: /Honey Bunny/ })).toBeVisible();
  await page.getByLabel('Search yarns').fill('');
  await page.getByRole('radio', { name: 'Pink' }).click();
  await expect(page.getByRole('link', { name: /Honey Bunny/ })).toBeVisible();

  // A pattern with materials
  await page.goto('/patterns/new');
  await page.getByLabel('Name', { exact: true }).fill('Bunny');
  await page.getByLabel('Part name').first().fill('Body');
  await page.getByRole('button', { name: '+ Yarn' }).click();
  await page.getByLabel('Colour', { exact: true }).fill('Pink');
  await page.getByRole('radio', { name: 'Pink' }).click();
  await page.getByLabel('Skeins', { exact: true }).fill('2');
  await page.getByRole('button', { name: '+ Material' }).click();
  await page.getByLabel('Material', { exact: true }).fill('Safety eyes 10 mm');
  await page.getByLabel('Quantity').fill('2');
  await page.getByRole('button', { name: 'Save' }).click();
  await expect(page.getByText('Pink · 2 skeins')).toBeVisible();
  await expect(page.getByText('Safety eyes 10 mm × 2')).toBeVisible();

  // Start a project, planning Honey Bunny for the pink line
  await page.getByRole('button', { name: 'Start a project from this pattern' }).click();
  await page.getByRole('button', { name: 'Choose yarn for Pink' }).click();
  await page.getByRole('button', { name: /Honey Bunny/ }).click();
  await page.getByRole('button', { name: 'Start project' }).click();
  await expect(page.getByRole('link', { name: /Body/ })).toBeVisible();
  await expect(page.getByRole('link', { name: /Honey Bunny/ })).toContainText('0 / 2');
  const projectUrl = page.url();

  // Add a part to the pattern, then update the project from it
  await page.getByRole('link', { name: 'Bunny', exact: true }).click();
  await page.getByRole('link', { name: 'Edit' }).click();
  await page.getByRole('button', { name: '+ Add part' }).click();
  await page.getByLabel('Part name').nth(1).fill('Tail');
  await page.getByRole('button', { name: 'Save' }).click();
  await expect(page.getByRole('link', { name: 'Instructions · 0' })).toHaveCount(2);
  await page.goto(projectUrl);
  await page.getByRole('button', { name: 'Update from pattern' }).click();
  await expect(page.getByRole('checkbox', { name: 'New part: Tail' })).toBeChecked();
  await page.getByRole('button', { name: 'Apply' }).click();
  await expect(page.getByRole('link', { name: /Tail/ })).toBeVisible();
});
