import { spawnSync } from 'node:child_process';
import { writeFileSync } from 'node:fs';
import { config } from 'dotenv';

const run = (args, opts) => spawnSync('npx', ['supabase', ...args], { shell: true, ...opts });
const cmd = process.argv[2];

if (cmd === 'push') {
  // Applies pending migrations to the REAL project named in .env.
  config({ path: '.env' });
  const url = process.env.DB_URL;
  if (!url) {
    console.error('DB_URL is missing in .env');
    process.exit(1);
  }
  const r = run(['db', 'push', '--include-all', '--db-url', `"${url}"`], { stdio: 'inherit' });
  process.exit(r.status ?? 1);
} else if (cmd === 'types') {
  // Reads the schema from the LOCAL stack (npm run db:start).
  const r = run(['gen', 'types', 'typescript', '--local', '--schema', 'public'], { encoding: 'utf8' });
  if (r.status !== 0) {
    console.error(r.stderr);
    process.exit(r.status ?? 1);
  }
  writeFileSync('src/lib/database.types.ts', r.stdout);
  console.log('wrote src/lib/database.types.ts');
} else {
  console.error('usage: node scripts/db.mjs push|types');
  process.exit(1);
}
