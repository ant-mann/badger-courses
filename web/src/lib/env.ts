import path from 'node:path';

export const BUNDLED_DATABASE_PATH = path.join('data', 'fall-2026.sqlite');

function resolveFromCwd(value: string, cwd = process.cwd()): string {
  return path.resolve(cwd, value);
}

function getRequiredEnv(name: string): string {
  const value = process.env[name]?.trim();

  if (!value) {
    throw new Error(`${name} environment variable is required`);
  }

  return value;
}

export function getDatabasePath(cwd = process.cwd()): string {
  const dbPath = getRequiredEnv('MADGRADES_DB_PATH');

  return resolveFromCwd(dbPath, cwd);
}

export function getBundledDatabasePath(cwd = process.cwd()): string {
  return resolveFromCwd(BUNDLED_DATABASE_PATH, cwd);
}

export function getDatabaseSourcePath(cwd = process.cwd()): string | null {
  const sourcePath = process.env.MADGRADES_DB_SOURCE_PATH?.trim();

  return sourcePath ? resolveFromCwd(sourcePath, cwd) : null;
}

export function getDatabaseSourceUrl(): string | null {
  const sourceUrl = process.env.MADGRADES_DB_URL?.trim();

  return sourceUrl || null;
}
