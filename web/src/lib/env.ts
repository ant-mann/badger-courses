import path from 'node:path';
import fs from 'node:fs';

function resolveFromCwd(value: string, cwd = process.cwd()): string {
  return path.resolve(cwd, value);
}

function requireEnv(name: string): string {
  const value = process.env[name]?.trim();

  if (!value) {
    throw new Error(`${name} environment variable is required`);
  }

  return value;
}

function getOptionalEnv(name: string): string | null {
  const value = process.env[name]?.trim();

  return value || null;
}

const DEFAULT_DATABASE_PATHS = [
  'web/data/fall-2026.sqlite',
  'data/fall-2026.sqlite',
  '../data/fall-2026.sqlite',
  '../web/data/fall-2026.sqlite',
];

function resolveFirstExistingPath(paths: string[], cwd = process.cwd()): string | null {
  for (const candidate of paths) {
    const resolvedCandidate = resolveFromCwd(candidate, cwd);

    if (fs.existsSync(resolvedCandidate)) {
      return resolvedCandidate;
    }
  }

  return null;
}

export type LibsqlDatabaseConfig = {
  url: string;
  authToken?: string;
  replicaPath: string;
};

function resolveAuthToken(url: string, envName: string): string | undefined {
  if (url.startsWith("file:")) {
    return undefined;
  }

  return requireEnv(envName);
}

export function getCourseDatabaseConfig(cwd = process.cwd()): LibsqlDatabaseConfig {
  const url = requireEnv("TURSO_COURSE_DATABASE_URL");

  return {
    url,
    authToken: resolveAuthToken(url, "TURSO_COURSE_AUTH_TOKEN"),
    replicaPath: resolveFromCwd(requireEnv("MADGRADES_COURSE_REPLICA_PATH"), cwd),
  };
}

export function getSupabaseDatabaseUrl(): string | null {
  return getOptionalEnv("SUPABASE_DATABASE_URL");
}

export function isSupabaseRuntimeEnabled(): boolean {
  return getSupabaseDatabaseUrl() !== null;
}

export function getDatabasePath(cwd = process.cwd()): string {
  const dbPath = getOptionalEnv('MADGRADES_DB_PATH');

  if (dbPath) {
    return resolveFromCwd(dbPath, cwd);
  }

  const fallbackPath = resolveFirstExistingPath(DEFAULT_DATABASE_PATHS, cwd);

  if (fallbackPath) {
    return fallbackPath;
  }

  return getCourseDatabaseConfig(cwd).replicaPath;
}

export function getMadgradesDatabaseConfig(cwd = process.cwd()): LibsqlDatabaseConfig {
  const url = requireEnv("TURSO_MADGRADES_DATABASE_URL");

  return {
    url,
    authToken: resolveAuthToken(url, "TURSO_MADGRADES_AUTH_TOKEN"),
    replicaPath: resolveFromCwd(requireEnv("MADGRADES_MADGRADES_REPLICA_PATH"), cwd),
  };
}
