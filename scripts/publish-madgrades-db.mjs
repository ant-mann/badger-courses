import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

import { publishSqliteToTurso } from './publish-course-db.mjs';

const __filename = fileURLToPath(import.meta.url);
const repoRoot = path.resolve(path.dirname(__filename), '..');

export async function publishMadgradesDb({
  env = process.env,
  publishImpl = publishSqliteToTurso,
} = {}) {
  const databaseUrl = env.TURSO_MADGRADES_DATABASE_URL;

  if (!databaseUrl) {
    throw new Error('Missing TURSO_MADGRADES_DATABASE_URL');
  }

  await publishImpl({
    databaseUrl,
    dbPath: path.join(repoRoot, 'data', 'fall-2026-madgrades.sqlite'),
  });
}

async function main() {
  await publishMadgradesDb();
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  await main();
}
