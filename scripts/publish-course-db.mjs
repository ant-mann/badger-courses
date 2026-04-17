import path from 'node:path';
import process from 'node:process';
import { stat, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { execFile as execFileCallback } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';
import os from 'node:os';

import Database from 'better-sqlite3';

const execFileAsync = promisify(execFileCallback);
const __filename = fileURLToPath(import.meta.url);
const repoRoot = path.resolve(path.dirname(__filename), '..');

async function walExists(dbPath) {
  try {
    await stat(`${dbPath}-wal`);
    return true;
  } catch (error) {
    if (error && typeof error === 'object' && 'code' in error && error.code === 'ENOENT') {
      return false;
    }

    throw error;
  }
}

function normalizeDatabaseUrl(databaseUrl) {
  const trimmedUrl = databaseUrl.trim().replace(/\/$/, '');

  if (!trimmedUrl.startsWith('libsql://') && !trimmedUrl.startsWith('https://')) {
    throw new Error('TURSO database URL must use libsql:// or https://');
  }

  return trimmedUrl;
}

function splitTableRows(output) {
  const lines = output
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  if (lines.length <= 1) {
    return [];
  }

  return lines.slice(1).map((line) => line.split(/\s{2,}/));
}

function escapeSqliteIdentifier(identifier) {
  return `"${identifier.replaceAll('"', '""')}"`;
}

function checkpointWal(dbPath) {
  const db = new Database(dbPath, { fileMustExist: true });

  try {
    db.pragma('wal_checkpoint(TRUNCATE)');
  } finally {
    db.close();
  }
}

export async function runCommand(command, args, options = {}) {
  const { input, ...execOptions } = options;

  if (process.env.TURSO_PUBLISH_TEST_MODE === '1') {
    const capture = globalThis.__TURSO_PUBLISH_TEST_CAPTURE__;
    const mock = globalThis.__TURSO_PUBLISH_TEST_MOCK__;
    if (Array.isArray(capture)) {
      capture.push({ command, args, input });
      if (typeof globalThis.__TURSO_PUBLISH_TEST_FLUSH__ === 'function') {
        await globalThis.__TURSO_PUBLISH_TEST_FLUSH__();
      }
    }

    if (typeof mock === 'function') {
      const mockedResult = await mock({ command, args, input, options: execOptions });
      if (mockedResult !== undefined) {
        return mockedResult;
      }
    }
  }

  return execFileAsync(command, args, {
    ...execOptions,
    input,
    maxBuffer: 1024 * 1024 * 50,
  });
}

export async function resolveDatabaseName({
  databaseUrl,
  runCommand: runCommandImpl = runCommand,
}) {
  const normalizedDatabaseUrl = normalizeDatabaseUrl(databaseUrl);
  const { stdout } = await runCommandImpl('turso', ['db', 'list']);

  for (const columns of splitTableRows(stdout)) {
    const [databaseName, , listedUrl] = columns;
    if (listedUrl === normalizedDatabaseUrl) {
      return databaseName;
    }
  }

  throw new Error(
    `Could not find a Turso database matching ${normalizedDatabaseUrl}. Check TURSO_*_DATABASE_URL and \`turso db list\`.`,
  );
}

export async function dumpSqliteDatabase(dbPath, {
  runCommand: runCommandImpl = runCommand,
} = {}) {
  if (await walExists(dbPath)) {
    checkpointWal(dbPath);
  }

  const tempDir = await mkdtemp(path.join(os.tmpdir(), 'turso-publish-dump-'));
  const dumpPath = path.join(tempDir, 'dump.sql');

  try {
    const sqlite3Path = process.env.SQLITE3_BIN ?? 'sqlite3';
    await runCommandImpl('bash', ['-lc', `${sqlite3Path} "${dbPath}" ".dump" > "${dumpPath}"`]);
    return dumpPath;
  } catch (error) {
    await rm(tempDir, { recursive: true, force: true });
    throw error;
  }
}

export async function buildRemoteDropSql(databaseName, {
  runCommand: runCommandImpl = runCommand,
} = {}) {
  const { stdout } = await runCommandImpl('turso', [
    'db',
    'shell',
    databaseName,
    "SELECT type, name FROM sqlite_master WHERE type IN ('view', 'table') AND name NOT LIKE 'sqlite_%' AND name NOT LIKE 'libsql_%' ORDER BY CASE type WHEN 'view' THEN 0 ELSE 1 END, name;",
  ]);
  const rows = splitTableRows(stdout);

  return rows
    .map(([type, name]) => `DROP ${type.toUpperCase()} IF EXISTS ${escapeSqliteIdentifier(name)};`)
    .concat('')
    .join('\n');
}

export async function runShellSql(databaseName, sql, {
  runCommand: runCommandImpl = runCommand,
} = {}) {
  if (runCommandImpl !== runCommand || process.env.TURSO_PUBLISH_TEST_MODE === '1') {
    return runCommandImpl('turso', ['db', 'shell', databaseName], { input: sql });
  }

  const tempDir = await mkdtemp(path.join(os.tmpdir(), 'turso-publish-shell-'));
  const sqlPath = path.join(tempDir, 'command.sql');

  try {
    await writeFile(sqlPath, sql);
    return await runCommandImpl('bash', ['-lc', `turso db shell ${databaseName} < "${sqlPath}"`]);
  } finally {
    await rm(tempDir, { recursive: true, force: true });
  }
}

export async function runShellSqlFile(databaseName, sqlPath, {
  runCommand: runCommandImpl = runCommand,
} = {}) {
  if (runCommandImpl !== runCommand || process.env.TURSO_PUBLISH_TEST_MODE === '1') {
    const fileContents = await import('node:fs/promises').then(({ readFile }) => readFile(sqlPath, 'utf8'));
    return runCommandImpl('turso', ['db', 'shell', databaseName], { input: fileContents });
  }

  return runCommandImpl('bash', ['-lc', `turso db shell ${databaseName} < "${sqlPath}"`]);
}

export async function publishSqliteToTurso({
  databaseUrl,
  dbPath,
  runCommand: runCommandImpl = runCommand,
}) {
  const databaseName = await resolveDatabaseName({
    databaseUrl,
    runCommand: runCommandImpl,
  });
  const dropSql = await buildRemoteDropSql(databaseName, {
    runCommand: runCommandImpl,
  });
  const dumpPath = await dumpSqliteDatabase(dbPath, {
    runCommand: runCommandImpl,
  });

  try {
    if (dropSql.trim()) {
      await runShellSql(databaseName, dropSql, {
        runCommand: runCommandImpl,
      });
    }

    await runShellSqlFile(databaseName, dumpPath, {
      runCommand: runCommandImpl,
    });
  } finally {
    await rm(path.dirname(dumpPath), { recursive: true, force: true });
  }
}

export async function publishCourseDb({
  env = process.env,
  publishImpl = publishSqliteToTurso,
} = {}) {
  const databaseUrl = env.TURSO_COURSE_DATABASE_URL;

  if (!databaseUrl) {
    throw new Error('Missing TURSO_COURSE_DATABASE_URL');
  }

  await publishImpl({
    databaseUrl,
    dbPath: path.join(repoRoot, 'data', 'fall-2026.sqlite'),
  });
}

async function main() {
  await publishCourseDb();
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  await main();
}
