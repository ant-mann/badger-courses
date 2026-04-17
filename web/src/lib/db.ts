import { createClient, type Client } from "@libsql/client";

import { getCourseDatabaseConfig, getMadgradesDatabaseConfig, type LibsqlDatabaseConfig } from "./env";

let cachedCourseDb: Client | null = null;
let cachedMadgradesDb: Client | null = null;

function createReplicaClient(config: LibsqlDatabaseConfig): Client {
  if (config.url.startsWith("file:")) {
    return createClient({
      url: `file:${config.replicaPath}`,
    });
  }

  return createClient({
    url: `file:${config.replicaPath}`,
    syncUrl: config.url,
    authToken: config.authToken,
    syncInterval: 60,
    offline: true,
  });
}

export function getCourseDb(): Client {
  if (!cachedCourseDb) {
    cachedCourseDb = createReplicaClient(getCourseDatabaseConfig());
  }

  return cachedCourseDb;
}

export function getMadgradesDb(): Client {
  if (!cachedMadgradesDb) {
    cachedMadgradesDb = createReplicaClient(getMadgradesDatabaseConfig());
  }

  return cachedMadgradesDb;
}

export function getDb(): Client {
  return getCourseDb();
}

export function __resetDbsForTests(): void {
  cachedCourseDb?.close();
  cachedMadgradesDb?.close();
  cachedCourseDb = null;
  cachedMadgradesDb = null;
}

export function __resetDbForTests(): void {
  __resetDbsForTests();
}
