import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

import Database from 'better-sqlite3';

import { generateSchedules, parseArgs } from '../src/schedule/engine.mjs';

const __filename = fileURLToPath(import.meta.url);

async function main() {
  const options = parseArgs(process.argv);
  const db = new Database(options.db, { readonly: true });

  try {
    const schedules = generateSchedules(db, options);
    process.stdout.write(`${JSON.stringify({ schedules })}\n`);
  } finally {
    db.close();
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === __filename) {
  await main();
}
