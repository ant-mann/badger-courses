import fs from "node:fs";

import Database from "better-sqlite3";
import { createClient, type Client } from "@libsql/client";

import {
  getCourseDatabaseConfig,
  getDatabasePath,
  getMadgradesDatabaseConfig,
  type LibsqlDatabaseConfig,
} from "./env";

let cachedDb: Database.Database | null = null;
let cachedCourseSqliteDb: Database.Database | null = null;
let cachedCourseDb: Client | null = null;
let cachedMadgradesDb: Client | null = null;
let courseReplicaEnsured = false;

function hasValue(name: string): boolean {
  return Boolean(process.env[name]?.trim());
}

function hasCompleteCourseReplicaConfig(): boolean {
  return [
    "TURSO_COURSE_DATABASE_URL",
    "TURSO_COURSE_AUTH_TOKEN",
    "MADGRADES_COURSE_REPLICA_PATH",
  ].every(hasValue);
}

function hasAnyCourseReplicaConfig(): boolean {
  return [
    "TURSO_COURSE_DATABASE_URL",
    "TURSO_COURSE_AUTH_TOKEN",
    "MADGRADES_COURSE_REPLICA_PATH",
  ].some(hasValue);
}

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

async function ensureCourseReplicaFile(): Promise<void> {
  if (courseReplicaEnsured || !hasCompleteCourseReplicaConfig()) {
    return;
  }

  const client = createReplicaClient(getCourseDatabaseConfig());

  try {
    await client.sync();
    courseReplicaEnsured = true;
  } finally {
    client.close();
  }
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

export async function getCourseSqliteDb(): Promise<Database.Database> {
  if (!cachedCourseSqliteDb) {
    if (hasCompleteCourseReplicaConfig()) {
      const config = getCourseDatabaseConfig();

      if (!config.url.startsWith("file:")) {
        await ensureCourseReplicaFile();
      }

      cachedCourseSqliteDb = new Database(config.replicaPath, {
        readonly: true,
        fileMustExist: true,
      });
    } else {
      cachedCourseSqliteDb = getDb();
    }
  }

  return cachedCourseSqliteDb;
}

export function getCourseDb(): Client {
  if (!cachedCourseDb) {
    if (hasCompleteCourseReplicaConfig()) {
      cachedCourseDb = createReplicaClient(getCourseDatabaseConfig());
    } else if (hasAnyCourseReplicaConfig()) {
      cachedCourseDb = createReplicaClient(getCourseDatabaseConfig());
    } else {
      const databasePath = getDatabasePath();

      if (!fs.existsSync(databasePath)) {
        throw new Error(`Database file does not exist: ${databasePath}`);
      }

      cachedCourseDb = createClient({
        url: `file:${databasePath}`,
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
  if (cachedCourseSqliteDb && cachedCourseSqliteDb !== cachedDb) {
    cachedCourseSqliteDb.close();
  }
  cachedCourseDb?.close();
  cachedMadgradesDb?.close();
  cachedDb = null;
  cachedCourseSqliteDb = null;
  cachedCourseDb = null;
  cachedMadgradesDb = null;
  courseReplicaEnsured = false;
}
