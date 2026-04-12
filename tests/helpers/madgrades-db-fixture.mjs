import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

import Database from 'better-sqlite3';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.join(__dirname, '..', '..');

function writeJson(filePath, value) {
  fs.writeFileSync(filePath, JSON.stringify(value, null, 2));
}

export function makeCourse({
  termCode,
  courseId,
  subjectCode,
  catalogNumber,
  courseDesignation,
  title,
}) {
  return {
    termCode,
    courseId,
    catalogNumber,
    courseDesignation,
    title,
    description: `${title} description`,
    minimumCredits: 3,
    maximumCredits: 3,
    enrollmentPrerequisites: null,
    currentlyTaught: true,
    lastTaught: '1264',
    subject: {
      subjectCode,
      shortDescription: subjectCode,
      description: `${subjectCode} subject`,
    },
  };
}

export function buildCourseDbFixture({ courses, packageSnapshot }) {
  const fixtureRoot = fs.mkdtempSync(path.join(repoRoot, '.tmp-madgrades-db-'));
  const fixtureDbDir = path.join(fixtureRoot, 'src', 'db');
  const fixtureDataDir = path.join(fixtureRoot, 'data');

  fs.mkdirSync(fixtureDbDir, { recursive: true });
  fs.mkdirSync(fixtureDataDir, { recursive: true });

  fs.copyFileSync(path.join(repoRoot, 'src/db/build-course-db.mjs'), path.join(fixtureDbDir, 'build-course-db.mjs'));
  fs.copyFileSync(path.join(repoRoot, 'src/db/import-helpers.mjs'), path.join(fixtureDbDir, 'import-helpers.mjs'));
  fs.copyFileSync(path.join(repoRoot, 'src/db/prerequisite-helpers.mjs'), path.join(fixtureDbDir, 'prerequisite-helpers.mjs'));
  fs.copyFileSync(
    path.join(repoRoot, 'src/db/prerequisite-summary-helpers.mjs'),
    path.join(fixtureDbDir, 'prerequisite-summary-helpers.mjs'),
  );
  fs.copyFileSync(path.join(repoRoot, 'src/db/schedule-helpers.mjs'), path.join(fixtureDbDir, 'schedule-helpers.mjs'));
  fs.copyFileSync(path.join(repoRoot, 'src/db/schema.sql'), path.join(fixtureDbDir, 'schema.sql'));

  writeJson(path.join(fixtureDataDir, 'fall-2026-courses.json'), courses);
  writeJson(path.join(fixtureDataDir, 'fall-2026-enrollment-packages.json'), packageSnapshot);

  execFileSync(process.execPath, [path.join(fixtureDbDir, 'build-course-db.mjs')], {
    cwd: fixtureRoot,
    stdio: 'pipe',
  });

  const dbPath = path.join(fixtureDataDir, 'fall-2026.sqlite');
  const db = new Database(dbPath);

  return {
    fixtureRoot,
    db,
    dbPath,
    cleanup() {
      db.close();
      fs.rmSync(fixtureRoot, { recursive: true, force: true });
    },
  };
}
