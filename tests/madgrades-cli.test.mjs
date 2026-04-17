import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import process from 'node:process';
import { execFileSync, spawnSync } from 'node:child_process';
import { mkdtemp, rm } from 'node:fs/promises';

import { writeMadgradesSnapshot } from '../src/madgrades/snapshot-helpers.mjs';
import { buildCourseDbFixture, makeCourse } from './helpers/madgrades-db-fixture.mjs';

function buildFixture() {
  return buildCourseDbFixture({
    courses: [
      makeCourse({
        termCode: '1272',
        courseId: '005770',
        subjectCode: '302',
        catalogNumber: '577',
        courseDesignation: 'COMP SCI 577',
        title: 'Algorithms for Large Data',
      }),
    ],
    packageSnapshot: {
      termCode: '1272',
      results: [
        {
          course: {
            termCode: '1272',
            subjectCode: '302',
            courseId: '005770',
          },
          packages: [
            {
              id: 'comp-sci-577-main',
              termCode: '1272',
              subjectCode: '302',
              courseId: '005770',
              enrollmentClassNumber: 57701,
              lastUpdated: 2000,
              onlineOnly: false,
              isAsynchronous: false,
              packageEnrollmentStatus: {
                status: 'OPEN',
                availableSeats: 3,
                waitlistTotal: 0,
              },
              enrollmentStatus: {
                openSeats: 3,
                waitlistCurrentSize: 0,
                capacity: 30,
                currentlyEnrolled: 27,
              },
              sections: [
                {
                  classUniqueId: { termCode: '1272', classNumber: 57701 },
                  sectionNumber: '001',
                  type: 'LEC',
                  instructionMode: 'IN PERSON',
                  sessionCode: '1',
                  published: true,
                  enrollmentStatus: {
                    openSeats: 3,
                    waitlistCurrentSize: 0,
                    capacity: 30,
                    currentlyEnrolled: 27,
                  },
                  instructors: [
                    {
                      name: { first: 'Ada', last: 'Lovelace' },
                      email: 'ada@example.edu',
                    },
                  ],
                  classMeetings: [],
                },
              ],
            },
          ],
        },
      ],
    },
  });
}

function buildSnapshot() {
  return {
    manifest: {
      generatedAt: '2026-04-11T23:14:05.000Z',
      source: 'snapshot',
      sourceTermCode: '1272',
      matchedCourseCount: 1,
      matchedInstructorCount: 1,
    },
    courses: [
      {
        madgradesCourseId: 1,
        subjectCode: '302',
        catalogNumber: '577',
        courseDesignation: 'COMP SCI 577',
      },
    ],
    courseGrades: [
      {
        madgradesCourseGradeId: 1,
        madgradesCourseId: 1,
        termCode: '1264',
        avgGpa: 2.97,
      },
    ],
    courseOfferings: [],
    courseGradeDistributions: [
      {
        madgradesCourseGradeDistributionId: 1,
        madgradesCourseGradeId: 1,
        grades: {
          A: 20,
          AB: 10,
          B: 10,
        },
      },
    ],
    instructors: [
      {
        madgradesInstructorId: 1,
        displayName: 'Ada Lovelace',
      },
    ],
    instructorGrades: [
      {
        madgradesInstructorGradeId: 1,
        madgradesInstructorId: 1,
        termCode: '1264',
        avgGpa: 3.11,
      },
    ],
    instructorGradeDistributions: [
      {
        madgradesInstructorGradeDistributionId: 1,
        madgradesInstructorGradeId: 1,
        grades: {
          A: 15,
          AB: 10,
          B: 10,
        },
      },
    ],
    matchReport: {
      courseMatches: [
        {
          termCode: '1272',
          courseId: '005770',
          madgradesCourseId: 1,
          matchStatus: 'matched',
          matchedAt: '2026-04-11T23:14:05.000Z',
        },
      ],
      instructorMatches: [
        {
          instructorKey: 'email:ada@example.edu',
          madgradesInstructorId: 1,
          matchStatus: 'matched',
          matchedAt: '2026-04-11T23:14:05.000Z',
        },
      ],
    },
  };
}

test('import-madgrades CLI loads the latest snapshot and prints JSON counts', async () => {
  const fixture = buildFixture();
  const snapshotRoot = await mkdtemp(path.join(process.cwd(), '.tmp-madgrades-cli-'));

  try {
    await writeMadgradesSnapshot({
      snapshotRoot,
      snapshotId: '20260411T231405Z',
      snapshot: buildSnapshot(),
    });

    const output = execFileSync(
      process.execPath,
      [
        path.join(process.cwd(), 'scripts', 'import-madgrades.mjs'),
        '--db', fixture.dbPath,
        '--snapshot-root', snapshotRoot,
      ],
      {
        cwd: process.cwd(),
        encoding: 'utf8',
      },
    );

    const result = JSON.parse(output.trim());
    assert.equal(result.snapshotId, '20260411T231405Z');
    assert.equal(result.courses, 1);
    assert.equal(result.instructors, 1);
    assert.equal(result.courseMatches, 1);
    assert.equal(result.instructorMatches, 1);
  } finally {
    fixture.cleanup();
    await rm(snapshotRoot, { recursive: true, force: true });
  }
});

test('import-madgrades CLI prints progress to stderr and final JSON to stdout', async () => {
  const fixture = buildFixture();
  const snapshotRoot = await mkdtemp(path.join(process.cwd(), '.tmp-madgrades-cli-progress-'));

  try {
    await writeMadgradesSnapshot({
      snapshotRoot,
      snapshotId: '20260411T231405Z',
      snapshot: buildSnapshot(),
    });

    const result = spawnSync(
      process.execPath,
      [
        path.join(process.cwd(), 'scripts', 'import-madgrades.mjs'),
        '--db', fixture.dbPath,
        '--snapshot-root', snapshotRoot,
      ],
      {
        cwd: process.cwd(),
        encoding: 'utf8',
      },
    );

    assert.equal(result.status, 0);
    assert.match(result.stderr, /Loading latest Madgrades snapshot\.\.\./);
    assert.match(result.stderr, /Importing snapshot into SQLite\.\.\./);

    const parsed = JSON.parse(result.stdout.trim());
    assert.equal(parsed.snapshotId, '20260411T231405Z');
    assert.equal(parsed.courses, 1);
  } finally {
    fixture.cleanup();
    await rm(snapshotRoot, { recursive: true, force: true });
  }
});

test('import-madgrades CLI rejects --db without a value', () => {
  assert.throws(
    () => {
      execFileSync(
        process.execPath,
        [
          path.join(process.cwd(), 'scripts', 'import-madgrades.mjs'),
          '--db',
        ],
        {
          cwd: process.cwd(),
          encoding: 'utf8',
          stdio: 'pipe',
        },
      );
    },
    /Missing value for --db/,
  );
});

test('import-madgrades CLI rejects --snapshot-root without a value', () => {
  assert.throws(
    () => {
      execFileSync(
        process.execPath,
        [
          path.join(process.cwd(), 'scripts', 'import-madgrades.mjs'),
          '--snapshot-root',
        ],
        {
          cwd: process.cwd(),
          encoding: 'utf8',
          stdio: 'pipe',
        },
      );
    },
    /Missing value for --snapshot-root/,
  );
});
