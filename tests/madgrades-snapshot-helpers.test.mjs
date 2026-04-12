import test from 'node:test';
import assert from 'node:assert/strict';
import os from 'node:os';
import path from 'node:path';
import { createRequire, syncBuiltinESMExports } from 'node:module';
import { mkdtemp, mkdir, rm, readFile, writeFile } from 'node:fs/promises';

const loadSnapshotHelpers = () => import('../src/madgrades/snapshot-helpers.mjs');
const require = createRequire(import.meta.url);
const mutableFsPromises = require('node:fs/promises');

const sampleSnapshot = {
  manifest: {
    generatedAt: '2026-04-11T23:14:05.000Z',
    source: 'test-fixture',
  },
  courses: [{ id: 'COMP SCI 300' }],
  courseGrades: [{ courseId: 'COMP SCI 300', averageGpa: 3.4 }],
  courseOfferings: [{ courseId: 'COMP SCI 300', termCode: '1262' }],
  courseGradeDistributions: [{ courseId: 'COMP SCI 300', sectionCount: 1 }],
  instructors: [{ id: 'instructor-1', name: 'Ada Lovelace' }],
  instructorGrades: [{ instructorId: 'instructor-1', averageGpa: 3.7 }],
  instructorGradeDistributions: [{ instructorId: 'instructor-1', sectionCount: 2 }],
  matchReport: { matched: 1, unmatched: 0 },
};

test('makeMadgradesSnapshotId returns a sortable UTC timestamp', async () => {
  const { makeMadgradesSnapshotId } = await loadSnapshotHelpers();

  assert.equal(
    makeMadgradesSnapshotId(new Date('2026-04-11T23:14:05.678Z')),
    '20260411T231405Z',
  );
});

test('writeMadgradesSnapshot writes normalized snapshot files', async () => {
  const { writeMadgradesSnapshot, MADGRADES_SNAPSHOT_FILES } = await loadSnapshotHelpers();
  const snapshotRoot = await mkdtemp(path.join(os.tmpdir(), 'madgrades-snapshot-write-'));

  try {
    const result = await writeMadgradesSnapshot({
      snapshotRoot,
      snapshotId: '20260411T231405Z',
      snapshot: sampleSnapshot,
    });

    assert.equal(result.snapshotId, '20260411T231405Z');
    assert.equal(result.snapshotDir, path.join(snapshotRoot, '20260411T231405Z'));
    assert.deepEqual(MADGRADES_SNAPSHOT_FILES, {
      manifest: 'manifest.json',
      courses: 'courses.json',
      courseGrades: 'course-grades.json',
      courseOfferings: 'course-offerings.json',
      courseGradeDistributions: 'course-grade-distributions.json',
      instructors: 'instructors.json',
      instructorGrades: 'instructor-grades.json',
      instructorGradeDistributions: 'instructor-grade-distributions.json',
      matchReport: 'match-report.json',
    });

    const courseGrades = JSON.parse(
      await readFile(path.join(result.snapshotDir, 'course-grades.json'), 'utf8'),
    );
    const instructorGrades = JSON.parse(
      await readFile(path.join(result.snapshotDir, 'instructor-grades.json'), 'utf8'),
    );

    assert.deepEqual(courseGrades, sampleSnapshot.courseGrades);
    assert.deepEqual(instructorGrades, sampleSnapshot.instructorGrades);
  } finally {
    await rm(snapshotRoot, { recursive: true, force: true });
  }
});

test('writeMadgradesSnapshot rejects a snapshot missing a required field', async () => {
  const { writeMadgradesSnapshot } = await loadSnapshotHelpers();
  const snapshotRoot = await mkdtemp(path.join(os.tmpdir(), 'madgrades-snapshot-missing-field-'));

  try {
    const { instructorGrades, ...snapshotMissingField } = sampleSnapshot;

    await assert.rejects(
      writeMadgradesSnapshot({
        snapshotRoot,
        snapshotId: '20260411T231405Z',
        snapshot: snapshotMissingField,
      }),
      /Madgrades snapshot is missing required field: instructorGrades/,
    );
  } finally {
    await rm(snapshotRoot, { recursive: true, force: true });
  }
});

test('writeMadgradesSnapshot rejects an invalid snapshotId', async () => {
  const { writeMadgradesSnapshot } = await loadSnapshotHelpers();
  const snapshotRoot = await mkdtemp(path.join(os.tmpdir(), 'madgrades-snapshot-invalid-write-id-'));

  try {
    await assert.rejects(
      writeMadgradesSnapshot({
        snapshotRoot,
        snapshotId: '../bad',
        snapshot: sampleSnapshot,
      }),
      /Invalid Madgrades snapshotId: \.\.\/bad/,
    );
  } finally {
    await rm(snapshotRoot, { recursive: true, force: true });
  }
});

test('writing a duplicate snapshotId preserves the previous valid snapshot if replacement writing fails', async () => {
  const { writeMadgradesSnapshot, readMadgradesSnapshot } = await loadSnapshotHelpers();
  const snapshotRoot = await mkdtemp(path.join(os.tmpdir(), 'madgrades-snapshot-duplicate-failure-'));
  const originalRename = mutableFsPromises.rename;

  try {
    await writeMadgradesSnapshot({
      snapshotRoot,
      snapshotId: '20260411T231405Z',
      snapshot: {
        ...sampleSnapshot,
        manifest: { version: 'original' },
      },
    });

    mutableFsPromises.rename = async (source, destination) => {
      if (
        String(source).includes('.tmp-')
        && destination === path.join(snapshotRoot, '20260411T231405Z')
      ) {
        throw new Error('simulated promotion failure');
      }

      await originalRename(source, destination);
    };
    syncBuiltinESMExports();

    try {
      await assert.rejects(
        writeMadgradesSnapshot({
          snapshotRoot,
          snapshotId: '20260411T231405Z',
          snapshot: {
            ...sampleSnapshot,
            manifest: { version: 'replacement' },
          },
        }),
        /simulated promotion failure/,
      );
    } finally {
      mutableFsPromises.rename = originalRename;
      syncBuiltinESMExports();
    }

    const persistedSnapshot = await readMadgradesSnapshot({
      snapshotRoot,
      snapshotId: '20260411T231405Z',
    });

    assert.deepEqual(persistedSnapshot.manifest, { version: 'original' });
  } finally {
    await rm(snapshotRoot, { recursive: true, force: true });
  }
});

test('writeMadgradesSnapshot surfaces backup cleanup failures without destroying the live snapshot', async () => {
  const { writeMadgradesSnapshot, readMadgradesSnapshot } = await loadSnapshotHelpers();
  const snapshotRoot = await mkdtemp(path.join(os.tmpdir(), 'madgrades-snapshot-backup-cleanup-failure-'));
  const originalRm = mutableFsPromises.rm;

  try {
    await writeMadgradesSnapshot({
      snapshotRoot,
      snapshotId: '20260411T231405Z',
      snapshot: {
        ...sampleSnapshot,
        manifest: { version: 'original' },
      },
    });

    mutableFsPromises.rm = async (target, options) => {
      if (String(target).includes('.bak-')) {
        throw new Error('simulated backup cleanup failure');
      }

      return originalRm(target, options);
    };
    syncBuiltinESMExports();

    try {
      await assert.rejects(
        writeMadgradesSnapshot({
          snapshotRoot,
          snapshotId: '20260411T231405Z',
          snapshot: {
            ...sampleSnapshot,
            manifest: { version: 'replacement' },
          },
        }),
        /simulated backup cleanup failure/,
      );
    } finally {
      mutableFsPromises.rm = originalRm;
      syncBuiltinESMExports();
    }

    const persistedSnapshot = await readMadgradesSnapshot({
      snapshotRoot,
      snapshotId: '20260411T231405Z',
    });

    assert.deepEqual(persistedSnapshot.manifest, { version: 'replacement' });
  } finally {
    mutableFsPromises.rm = originalRm;
    syncBuiltinESMExports();
    await rm(snapshotRoot, { recursive: true, force: true });
  }
});

test('readLatestMadgradesSnapshot loads the lexicographically latest snapshot directory', async () => {
  const { writeMadgradesSnapshot, readLatestMadgradesSnapshot } = await loadSnapshotHelpers();
  const snapshotRoot = await mkdtemp(path.join(os.tmpdir(), 'madgrades-snapshot-latest-'));

  try {
    await writeMadgradesSnapshot({
      snapshotRoot,
      snapshotId: '20260410T231405Z',
      snapshot: {
        ...sampleSnapshot,
        manifest: { version: 'older' },
      },
    });
    await writeMadgradesSnapshot({
      snapshotRoot,
      snapshotId: '20260411T231405Z',
      snapshot: {
        ...sampleSnapshot,
        manifest: { version: 'latest' },
      },
    });

    const latest = await readLatestMadgradesSnapshot({ snapshotRoot });

    assert.equal(latest.snapshotId, '20260411T231405Z');
    assert.equal(latest.snapshotDir, path.join(snapshotRoot, '20260411T231405Z'));
    assert.deepEqual(latest.manifest, { version: 'latest' });
    assert.deepEqual(latest.courseGrades, sampleSnapshot.courseGrades);
    assert.deepEqual(latest.instructorGrades, sampleSnapshot.instructorGrades);
  } finally {
    await rm(snapshotRoot, { recursive: true, force: true });
  }
});

test('readMadgradesSnapshot rejects an invalid snapshotId', async () => {
  const { readMadgradesSnapshot } = await loadSnapshotHelpers();
  const snapshotRoot = await mkdtemp(path.join(os.tmpdir(), 'madgrades-snapshot-invalid-read-id-'));

  try {
    await assert.rejects(
      readMadgradesSnapshot({
        snapshotRoot,
        snapshotId: '../bad',
      }),
      /Invalid Madgrades snapshotId: \.\.\/bad/,
    );
  } finally {
    await rm(snapshotRoot, { recursive: true, force: true });
  }
});

test('readLatestMadgradesSnapshot skips an incomplete latest snapshot directory', async () => {
  const { writeMadgradesSnapshot, readLatestMadgradesSnapshot } = await loadSnapshotHelpers();
  const snapshotRoot = await mkdtemp(path.join(os.tmpdir(), 'madgrades-snapshot-skip-incomplete-'));

  try {
    await writeMadgradesSnapshot({
      snapshotRoot,
      snapshotId: '20260410T231405Z',
      snapshot: {
        ...sampleSnapshot,
        manifest: { version: 'complete' },
      },
    });

    const incompleteSnapshotDir = path.join(snapshotRoot, '20260411T231405Z');
    await mkdir(incompleteSnapshotDir, { recursive: true });
    await writeFile(
      path.join(incompleteSnapshotDir, 'manifest.json'),
      `${JSON.stringify({ version: 'incomplete' }, null, 2)}\n`,
    );

    const latest = await readLatestMadgradesSnapshot({ snapshotRoot });

    assert.equal(latest.snapshotId, '20260410T231405Z');
    assert.equal(latest.snapshotDir, path.join(snapshotRoot, '20260410T231405Z'));
    assert.deepEqual(latest.manifest, { version: 'complete' });
  } finally {
    await rm(snapshotRoot, { recursive: true, force: true });
  }
});

test('readLatestMadgradesSnapshot ignores temporary and backup directories', async () => {
  const { writeMadgradesSnapshot, readLatestMadgradesSnapshot } = await loadSnapshotHelpers();
  const snapshotRoot = await mkdtemp(path.join(os.tmpdir(), 'madgrades-snapshot-ignore-temp-'));

  try {
    await writeMadgradesSnapshot({
      snapshotRoot,
      snapshotId: '20260410T231405Z',
      snapshot: {
        ...sampleSnapshot,
        manifest: { version: 'real-latest' },
      },
    });

    const ignoredSnapshot = {
      ...sampleSnapshot,
      manifest: { version: 'ignored' },
    };
    const ignoredDirs = [
      '20260411T231405Z.tmp-999',
      '20260412T231405Z.bak-999',
    ];

    for (const dirName of ignoredDirs) {
      const dirPath = path.join(snapshotRoot, dirName);
      await mkdir(dirPath, { recursive: true });

      await Promise.all([
        writeFile(path.join(dirPath, 'manifest.json'), `${JSON.stringify(ignoredSnapshot.manifest, null, 2)}\n`),
        writeFile(path.join(dirPath, 'courses.json'), `${JSON.stringify(ignoredSnapshot.courses, null, 2)}\n`),
        writeFile(path.join(dirPath, 'course-grades.json'), `${JSON.stringify(ignoredSnapshot.courseGrades, null, 2)}\n`),
        writeFile(path.join(dirPath, 'course-offerings.json'), `${JSON.stringify(ignoredSnapshot.courseOfferings, null, 2)}\n`),
        writeFile(path.join(dirPath, 'course-grade-distributions.json'), `${JSON.stringify(ignoredSnapshot.courseGradeDistributions, null, 2)}\n`),
        writeFile(path.join(dirPath, 'instructors.json'), `${JSON.stringify(ignoredSnapshot.instructors, null, 2)}\n`),
        writeFile(path.join(dirPath, 'instructor-grades.json'), `${JSON.stringify(ignoredSnapshot.instructorGrades, null, 2)}\n`),
        writeFile(path.join(dirPath, 'instructor-grade-distributions.json'), `${JSON.stringify(ignoredSnapshot.instructorGradeDistributions, null, 2)}\n`),
        writeFile(path.join(dirPath, 'match-report.json'), `${JSON.stringify(ignoredSnapshot.matchReport, null, 2)}\n`),
      ]);
    }

    const latest = await readLatestMadgradesSnapshot({ snapshotRoot });

    assert.equal(latest.snapshotId, '20260410T231405Z');
    assert.deepEqual(latest.manifest, { version: 'real-latest' });
  } finally {
    await rm(snapshotRoot, { recursive: true, force: true });
  }
});

test('readLatestMadgradesSnapshot surfaces corrupted JSON in the latest snapshot', async () => {
  const { writeMadgradesSnapshot, readLatestMadgradesSnapshot } = await loadSnapshotHelpers();
  const snapshotRoot = await mkdtemp(path.join(os.tmpdir(), 'madgrades-snapshot-corrupt-latest-'));

  try {
    await writeMadgradesSnapshot({
      snapshotRoot,
      snapshotId: '20260410T231405Z',
      snapshot: {
        ...sampleSnapshot,
        manifest: { version: 'older' },
      },
    });
    await writeMadgradesSnapshot({
      snapshotRoot,
      snapshotId: '20260411T231405Z',
      snapshot: {
        ...sampleSnapshot,
        manifest: { version: 'latest' },
      },
    });

    await writeFile(path.join(snapshotRoot, '20260411T231405Z', 'manifest.json'), '{');

    await assert.rejects(
      readLatestMadgradesSnapshot({ snapshotRoot }),
      (error) => error instanceof SyntaxError,
    );
  } finally {
    await rm(snapshotRoot, { recursive: true, force: true });
  }
});

test('readLatestMadgradesSnapshot throws when no snapshot directories exist', async () => {
  const { readLatestMadgradesSnapshot } = await loadSnapshotHelpers();
  const snapshotRoot = await mkdtemp(path.join(os.tmpdir(), 'madgrades-snapshot-empty-'));

  try {
    await assert.rejects(
      readLatestMadgradesSnapshot({ snapshotRoot }),
      /No Madgrades snapshots found in /,
    );
  } finally {
    await rm(snapshotRoot, { recursive: true, force: true });
  }
});

test('readLatestMadgradesSnapshot throws a clear error when snapshotRoot does not exist', async () => {
  const { readLatestMadgradesSnapshot } = await loadSnapshotHelpers();
  const parentDir = await mkdtemp(path.join(os.tmpdir(), 'madgrades-snapshot-missing-root-'));
  const snapshotRoot = path.join(parentDir, 'missing-snapshots');

  try {
    await assert.rejects(
      readLatestMadgradesSnapshot({ snapshotRoot }),
      /No Madgrades snapshots found in /,
    );
  } finally {
    await rm(parentDir, { recursive: true, force: true });
  }
});
