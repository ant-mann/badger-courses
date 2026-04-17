import path from 'node:path';
import process from 'node:process';
import { mkdir, readFile, rename, rm } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

import Database from 'better-sqlite3';

import { runMadgradesImport } from './import-runner.mjs';

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

async function removeSqliteArtifacts(basePath) {
  await rm(basePath, { force: true });
  await rm(`${basePath}-wal`, { force: true });
  await rm(`${basePath}-shm`, { force: true });
}

async function moveSqliteArtifacts(sourcePath, destinationPath) {
  let movedMainFile = false;

  for (const suffix of ['', '-wal', '-shm']) {
    try {
      await rename(`${sourcePath}${suffix}`, `${destinationPath}${suffix}`);
      if (suffix === '') {
        movedMainFile = true;
      }
    } catch (error) {
      if (error?.code !== 'ENOENT') {
        throw error;
      }
    }
  }

  return movedMainFile;
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
  if (path.resolve(courseDbPath) === path.resolve(outputDbPath)) {
    throw new Error('outputDbPath must be different from courseDbPath');
  }

  const schemaSql = await readFile(schemaPath, 'utf8');
  const tempOutputDbPath = `${outputDbPath}.tmp-${process.pid}-${Date.now()}`;
  const backupOutputDbPath = `${outputDbPath}.bak-${process.pid}-${Date.now()}`;

  await mkdir(path.dirname(outputDbPath), { recursive: true });
  await removeSqliteArtifacts(tempOutputDbPath);
  await removeSqliteArtifacts(backupOutputDbPath);

  const db = new Database(tempOutputDbPath);

  try {
    db.exec(schemaSql);
  } finally {
    db.close();
  }

  try {
    const result = await runMadgradesImport({
      dbPath: tempOutputDbPath,
      courseDbPath,
      snapshotRoot,
      refreshApi,
      token,
      fetchImpl,
      baseUrl,
      now,
      onProgress,
    });

    const hadExistingOutput = await moveSqliteArtifacts(outputDbPath, backupOutputDbPath);

    try {
      await moveSqliteArtifacts(tempOutputDbPath, outputDbPath);
    } catch (error) {
      if (hadExistingOutput) {
        await moveSqliteArtifacts(backupOutputDbPath, outputDbPath);
      }

      throw error;
    }

    await removeSqliteArtifacts(backupOutputDbPath);

    return {
      outputDbPath,
      ...result,
    };
  } catch (error) {
    await removeSqliteArtifacts(tempOutputDbPath);
    throw error;
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
