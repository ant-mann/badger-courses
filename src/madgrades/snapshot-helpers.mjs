import path from 'node:path';
import { mkdir, readdir, readFile, rename, rm, writeFile } from 'node:fs/promises';

export const MADGRADES_SNAPSHOT_FILES = {
  manifest: 'manifest.json',
  courses: 'courses.json',
  courseGrades: 'course-grades.json',
  courseOfferings: 'course-offerings.json',
  courseGradeDistributions: 'course-grade-distributions.json',
  instructors: 'instructors.json',
  instructorGrades: 'instructor-grades.json',
  instructorGradeDistributions: 'instructor-grade-distributions.json',
  matchReport: 'match-report.json',
};

function padSnapshotPart(value) {
  return String(value).padStart(2, '0');
}

function getSnapshotDir(snapshotRoot, snapshotId) {
  return path.join(snapshotRoot, snapshotId);
}

function isMissingSnapshotFileError(error) {
  return error?.code === 'ENOENT';
}

function isSnapshotIdDirectoryName(name) {
  return /^\d{8}T\d{6}Z$/.test(name);
}

function requireSnapshotId(snapshotId) {
  if (!isSnapshotIdDirectoryName(snapshotId)) {
    throw new Error(`Invalid Madgrades snapshotId: ${snapshotId}`);
  }

  return snapshotId;
}

function validateSnapshot(snapshot) {
  for (const key of Object.keys(MADGRADES_SNAPSHOT_FILES)) {
    if (snapshot?.[key] === undefined) {
      throw new Error(`Madgrades snapshot is missing required field: ${key}`);
    }
  }
}

async function writeSnapshotFile(snapshotDir, fileName, value) {
  await writeFile(path.join(snapshotDir, fileName), `${JSON.stringify(value, null, 2)}\n`);
}

async function readSnapshotFile(snapshotDir, fileName) {
  return JSON.parse(await readFile(path.join(snapshotDir, fileName), 'utf8'));
}

export function makeMadgradesSnapshotId(now = new Date()) {
  return [
    now.getUTCFullYear(),
    padSnapshotPart(now.getUTCMonth() + 1),
    padSnapshotPart(now.getUTCDate()),
    'T',
    padSnapshotPart(now.getUTCHours()),
    padSnapshotPart(now.getUTCMinutes()),
    padSnapshotPart(now.getUTCSeconds()),
    'Z',
  ].join('');
}

export async function writeMadgradesSnapshot({
  snapshotRoot,
  snapshotId = makeMadgradesSnapshotId(),
  snapshot,
}) {
  const normalizedSnapshotId = requireSnapshotId(snapshotId);
  validateSnapshot(snapshot);

  const snapshotDir = getSnapshotDir(snapshotRoot, normalizedSnapshotId);
  const tempSnapshotDir = getSnapshotDir(snapshotRoot, `${normalizedSnapshotId}.tmp-${process.pid}-${Date.now()}`);
  const backupSnapshotDir = getSnapshotDir(snapshotRoot, `${normalizedSnapshotId}.bak-${process.pid}-${Date.now()}`);
  await mkdir(snapshotRoot, { recursive: true });
  await mkdir(tempSnapshotDir, { recursive: true });

  let hadExistingSnapshot = false;
  try {
    for (const [key, fileName] of Object.entries(MADGRADES_SNAPSHOT_FILES)) {
      await writeSnapshotFile(tempSnapshotDir, fileName, snapshot[key]);
    }

    try {
      await rename(snapshotDir, backupSnapshotDir);
      hadExistingSnapshot = true;
    } catch (error) {
      if (!isMissingSnapshotFileError(error)) {
        throw error;
      }
    }

    await rename(tempSnapshotDir, snapshotDir);
  } catch (error) {
    try {
      await rename(backupSnapshotDir, snapshotDir);
    } catch (restoreError) {
      if (!isMissingSnapshotFileError(restoreError)) {
        throw restoreError;
      }
    }

    await rm(tempSnapshotDir, { recursive: true, force: true });
    await rm(backupSnapshotDir, { recursive: true, force: true });
    throw error;
  }

  if (hadExistingSnapshot) {
    await rm(backupSnapshotDir, { recursive: true, force: true });
  }

  return { snapshotId: normalizedSnapshotId, snapshotDir };
}

export async function readMadgradesSnapshot({ snapshotRoot, snapshotId }) {
  const normalizedSnapshotId = requireSnapshotId(snapshotId);
  const snapshotDir = getSnapshotDir(snapshotRoot, normalizedSnapshotId);
  const snapshot = {
    snapshotId: normalizedSnapshotId,
    snapshotDir,
  };

  for (const [key, fileName] of Object.entries(MADGRADES_SNAPSHOT_FILES)) {
    snapshot[key] = await readSnapshotFile(snapshotDir, fileName);
  }

  return snapshot;
}

export async function readLatestMadgradesSnapshot({ snapshotRoot }) {
  let entries;
  try {
    entries = await readdir(snapshotRoot, { withFileTypes: true });
  } catch (error) {
    if (!isMissingSnapshotFileError(error)) {
      throw error;
    }

    throw new Error(`No Madgrades snapshots found in ${snapshotRoot}`);
  }

  const snapshotIds = entries
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .filter((name) => isSnapshotIdDirectoryName(name))
    .sort();

  for (const snapshotId of [...snapshotIds].reverse()) {
    try {
      return await readMadgradesSnapshot({ snapshotRoot, snapshotId });
    } catch (error) {
      if (!isMissingSnapshotFileError(error)) {
        throw error;
      }

      continue;
    }
  }

  throw new Error(`No Madgrades snapshots found in ${snapshotRoot}`);
}
