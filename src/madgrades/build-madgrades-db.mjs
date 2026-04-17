import path from 'node:path';
import process from 'node:process';
import { mkdir, readFile, rm } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

import Database from 'better-sqlite3';

import { replaceMadgradesTables } from './import-helpers.mjs';
import { buildSnapshotFromApi } from './import-runner.mjs';
import { readLatestMadgradesSnapshot } from './snapshot-helpers.mjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, '..', '..');
const schemaPath = path.join(__dirname, 'schema.sql');

function readFlagValue(args, flagName) {
  const index = args.indexOf(flagName);
  if (index === -1) {
    return null;
  }

  const value = args[index + 1] ?? null;
  if (value == null || value.startsWith('--')) {
    throw new Error(`Missing value for ${flagName}`);
  }

  return value;
}

function loadLocalIdentityRows(courseDbPath) {
  const courseDb = new Database(courseDbPath, { readonly: true });

  try {
    return {
      courses: courseDb.prepare(`
        SELECT term_code, course_id
        FROM courses
      `).all(),
      instructors: courseDb.prepare(`
        SELECT instructor_key
        FROM instructors
      `).all(),
    };
  } finally {
    courseDb.close();
  }
}

function seedLocalIdentityTables(db, identityRows) {
  db.exec(`
    CREATE TEMP TABLE courses (
      term_code TEXT NOT NULL,
      course_id TEXT NOT NULL,
      PRIMARY KEY (term_code, course_id)
    );
    CREATE TEMP TABLE instructors (
      instructor_key TEXT PRIMARY KEY
    );
  `);

  const insertCourse = db.prepare(`
    INSERT INTO courses (term_code, course_id)
    VALUES (?, ?)
  `);
  const insertInstructor = db.prepare(`
    INSERT INTO instructors (instructor_key)
    VALUES (?)
  `);

  db.transaction(() => {
    for (const row of identityRows.courses) {
      insertCourse.run(row.term_code, row.course_id);
    }

    for (const row of identityRows.instructors) {
      insertInstructor.run(row.instructor_key);
    }
  })();
}

export async function buildMadgradesDb({
  courseDbPath = path.join(repoRoot, 'data', 'fall-2026.sqlite'),
  outputDbPath = path.join(repoRoot, 'data', 'fall-2026-madgrades.sqlite'),
  snapshotRoot = path.join(repoRoot, 'data', 'madgrades'),
  refreshApi = false,
  token = process.env.MADGRADES_API_TOKEN,
  fetchImpl = fetch,
  baseUrl,
  now = new Date(),
  onProgress = () => {},
} = {}) {
  const schemaSql = await readFile(schemaPath, 'utf8');
  const identityRows = loadLocalIdentityRows(courseDbPath);

  let snapshot;
  let snapshotId;

  if (refreshApi) {
    const courseDb = new Database(courseDbPath, { readonly: true });

    try {
      onProgress('Refreshing snapshot from Madgrades API...');
      const built = await buildSnapshotFromApi({ db: courseDb, snapshotRoot, token, fetchImpl, baseUrl, now, onProgress });
      snapshot = built.snapshot;
      snapshotId = built.snapshotId;
    } finally {
      courseDb.close();
    }
  } else {
    onProgress('Loading latest Madgrades snapshot...');
    const latestSnapshot = await readLatestMadgradesSnapshot({ snapshotRoot });
    snapshot = latestSnapshot;
    snapshotId = latestSnapshot.snapshotId;
    onProgress(`Loaded snapshot ${snapshotId}.`);
  }

  await mkdir(path.dirname(outputDbPath), { recursive: true });
  await rm(outputDbPath, { force: true });
  await rm(`${outputDbPath}-wal`, { force: true });
  await rm(`${outputDbPath}-shm`, { force: true });

  const db = new Database(outputDbPath);

  try {
    db.exec(schemaSql);
    seedLocalIdentityTables(db, identityRows);

    onProgress('Importing snapshot into standalone SQLite...');
    const counts = replaceMadgradesTables(db, snapshot, now);
    onProgress('Standalone Madgrades build complete.');

    return {
      outputDbPath,
      snapshotId,
      ...counts,
    };
  } finally {
    db.close();
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === __filename) {
  const args = process.argv.slice(2);
  const refreshApi = args.includes('--refresh-api');

  const result = await buildMadgradesDb({
    courseDbPath: readFlagValue(args, '--course-db') ?? path.join(repoRoot, 'data', 'fall-2026.sqlite'),
    outputDbPath: readFlagValue(args, '--output-db') ?? path.join(repoRoot, 'data', 'fall-2026-madgrades.sqlite'),
    snapshotRoot: readFlagValue(args, '--snapshot-root') ?? path.join(repoRoot, 'data', 'madgrades'),
    refreshApi,
    onProgress(message) {
      process.stderr.write(`${message}\n`);
    },
  });

  process.stdout.write(`${JSON.stringify(result)}\n`);
}
