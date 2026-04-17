import path from 'node:path';

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

export type LibsqlDatabaseConfig = {
  url: string;
  authToken: string;
  replicaPath: string;
};

export function getCourseDatabaseConfig(cwd = process.cwd()): LibsqlDatabaseConfig {
  return {
    url: requireEnv('TURSO_COURSE_DATABASE_URL'),
    authToken: requireEnv('TURSO_COURSE_AUTH_TOKEN'),
    replicaPath: resolveFromCwd(requireEnv('MADGRADES_COURSE_REPLICA_PATH'), cwd),
  };
}

export function getDatabasePath(cwd = process.cwd()): string {
  return getCourseDatabaseConfig(cwd).replicaPath;
}

export function getMadgradesDatabaseConfig(cwd = process.cwd()): LibsqlDatabaseConfig {
  return {
    url: requireEnv('TURSO_MADGRADES_DATABASE_URL'),
    authToken: requireEnv('TURSO_MADGRADES_AUTH_TOKEN'),
    replicaPath: resolveFromCwd(requireEnv('MADGRADES_MADGRADES_REPLICA_PATH'), cwd),
  };
}
