import Database from "better-sqlite3";
import { createClient, type Client } from "@libsql/client";

import {
  getCourseDatabaseConfig,
  getDatabasePath,
  getMadgradesDatabaseConfig,
  type LibsqlDatabaseConfig,
} from "./env";

let cachedDb: Database.Database | null = null;
let cachedCourseDb: Client | null = null;
let cachedMadgradesDb: Client | null = null;

function createReplicaClient(config: LibsqlDatabaseConfig): Client {
  if (config.url.startsWith("file:")) {
    return createClient({
      url: config.url,
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

export function getDb(): Database.Database {
  if (!cachedDb) {
    cachedDb = new Database(getDatabasePath(), {
      readonly: true,
      fileMustExist: true,
    });
  }

  return cachedDb;
}

export function getCourseDb(): Client {
  if (!cachedCourseDb) {
    try {
      cachedCourseDb = createReplicaClient(getCourseDatabaseConfig());
    } catch {
      cachedCourseDb = createClient({
        url: `file:${getDatabasePath()}`,
      });
    }
  }

  return cachedCourseDb;
}

export function getMadgradesDb(): Client {
  if (!cachedMadgradesDb) {
    cachedMadgradesDb = createReplicaClient(getMadgradesDatabaseConfig());
  }

  return cachedMadgradesDb;
}

export function __resetDbsForTests(): void {
  cachedDb?.close();
  cachedCourseDb?.close();
  cachedMadgradesDb?.close();
  cachedDb = null;
  cachedCourseDb = null;
  cachedMadgradesDb = null;
}
