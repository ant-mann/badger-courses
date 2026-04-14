import fs from 'node:fs';
import path from 'node:path';

function resolveFromCwd(value: string, cwd = process.cwd()): string {
  return path.resolve(cwd, value);
}

const DEFAULT_DATABASE_PATHS = [
  'web/data/fall-2026.sqlite',
  'data/fall-2026.sqlite',
  '../data/fall-2026.sqlite',
  '../web/data/fall-2026.sqlite',
];

function getEnv(name: string): string | null {
  const value = process.env[name]?.trim();

  return value || null;
}

function resolveFirstExistingPath(paths: string[], cwd = process.cwd()): string | null {
  for (const candidate of paths) {
    const resolvedCandidate = resolveFromCwd(candidate, cwd);

    if (fs.existsSync(resolvedCandidate)) {
      return resolvedCandidate;
    }
  }

  return null;
}

export function getDatabasePath(cwd = process.cwd()): string {
  const dbPath = getEnv('MADGRADES_DB_PATH');

  if (dbPath) {
    return resolveFromCwd(dbPath, cwd);
  }

  const fallbackPath = resolveFirstExistingPath(DEFAULT_DATABASE_PATHS, cwd);

  if (fallbackPath) {
    return fallbackPath;
  }

  throw new Error('MADGRADES_DB_PATH environment variable is required');
}

export function getDatabaseSourcePath(cwd = process.cwd()): string | null {
  const sourcePath = getEnv('MADGRADES_DB_SOURCE_PATH');

  return sourcePath ? resolveFromCwd(sourcePath, cwd) : null;
}

export function getDatabaseSourceUrl(): string | null {
  const sourceUrl = getEnv('MADGRADES_DB_URL');

  return sourceUrl || null;
}
