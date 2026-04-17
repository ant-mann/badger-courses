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

function writeMadgradesSnapshot(snapshotRoot, snapshot, snapshotId = '20260411T231405Z') {
  const snapshotDir = path.join(snapshotRoot, snapshotId);

  fs.mkdirSync(snapshotDir, { recursive: true });
  writeJson(path.join(snapshotDir, 'manifest.json'), snapshot.manifest);
  writeJson(path.join(snapshotDir, 'courses.json'), snapshot.courses);
  writeJson(path.join(snapshotDir, 'course-grades.json'), snapshot.courseGrades);
  writeJson(path.join(snapshotDir, 'course-offerings.json'), snapshot.courseOfferings);
  writeJson(path.join(snapshotDir, 'course-grade-distributions.json'), snapshot.courseGradeDistributions);
  writeJson(path.join(snapshotDir, 'instructors.json'), snapshot.instructors);
  writeJson(path.join(snapshotDir, 'instructor-grades.json'), snapshot.instructorGrades);
  writeJson(path.join(snapshotDir, 'instructor-grade-distributions.json'), snapshot.instructorGradeDistributions);
  writeJson(path.join(snapshotDir, 'match-report.json'), snapshot.matchReport);

  return snapshotDir;
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

export function buildCourseDbFixture({ courses, packageSnapshot, madgradesSnapshot = null }) {
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
  const madgradesDbPath = path.join(fixtureDataDir, 'fall-2026-madgrades.sqlite');
  const db = new Database(dbPath);

  if (madgradesSnapshot) {
    writeMadgradesSnapshot(fixtureRoot, madgradesSnapshot);
  }

  return {
    fixtureRoot,
    fixtureDataDir,
    db,
    dbPath,
    madgradesDbPath,
    cleanup() {
      db.close();
      fs.rmSync(fixtureRoot, { recursive: true, force: true });
    },
  };
}
