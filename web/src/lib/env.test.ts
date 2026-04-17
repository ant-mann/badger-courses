import test, { afterEach } from "node:test";
import assert from "node:assert/strict";
import path from "node:path";

import {
  getCourseDatabaseConfig,
  getMadgradesDatabaseConfig,
} from "./env";

const ORIGINAL_ENV = {
  TURSO_COURSE_DATABASE_URL: process.env.TURSO_COURSE_DATABASE_URL,
  TURSO_COURSE_AUTH_TOKEN: process.env.TURSO_COURSE_AUTH_TOKEN,
  TURSO_MADGRADES_DATABASE_URL: process.env.TURSO_MADGRADES_DATABASE_URL,
  TURSO_MADGRADES_AUTH_TOKEN: process.env.TURSO_MADGRADES_AUTH_TOKEN,
  MADGRADES_COURSE_REPLICA_PATH: process.env.MADGRADES_COURSE_REPLICA_PATH,
  MADGRADES_MADGRADES_REPLICA_PATH: process.env.MADGRADES_MADGRADES_REPLICA_PATH,
};

afterEach(() => {
  for (const [key, value] of Object.entries(ORIGINAL_ENV)) {
    if (value === undefined) {
      delete process.env[key];
    } else {
      process.env[key] = value;
    }
  }
});

test("getCourseDatabaseConfig resolves the course replica path from cwd", () => {
  process.env.TURSO_COURSE_DATABASE_URL = "libsql://course-db.example.turso.io";
  process.env.TURSO_COURSE_AUTH_TOKEN = "course-token";
  process.env.MADGRADES_COURSE_REPLICA_PATH = "./tmp/course-replica.db";

  assert.deepEqual(getCourseDatabaseConfig("/repo/web"), {
    url: "libsql://course-db.example.turso.io",
    authToken: "course-token",
    replicaPath: path.join("/repo/web", "tmp", "course-replica.db"),
  });
});

test("getMadgradesDatabaseConfig resolves the Madgrades replica path from cwd", () => {
  process.env.TURSO_MADGRADES_DATABASE_URL = "libsql://madgrades-db.example.turso.io";
  process.env.TURSO_MADGRADES_AUTH_TOKEN = "madgrades-token";
  process.env.MADGRADES_MADGRADES_REPLICA_PATH = "./tmp/madgrades-replica.db";

  assert.deepEqual(getMadgradesDatabaseConfig("/repo/web"), {
    url: "libsql://madgrades-db.example.turso.io",
    authToken: "madgrades-token",
    replicaPath: path.join("/repo/web", "tmp", "madgrades-replica.db"),
  });
});

test("getCourseDatabaseConfig throws when course env is incomplete", () => {
  delete process.env.TURSO_COURSE_DATABASE_URL;
  process.env.TURSO_COURSE_AUTH_TOKEN = "course-token";
  process.env.MADGRADES_COURSE_REPLICA_PATH = "./tmp/course-replica.db";

  assert.throws(() => getCourseDatabaseConfig("/repo/web"), /TURSO_COURSE_DATABASE_URL/);
});

test("getMadgradesDatabaseConfig throws when the replica path is missing", () => {
  process.env.TURSO_MADGRADES_DATABASE_URL = "libsql://madgrades-db.example.turso.io";
  process.env.TURSO_MADGRADES_AUTH_TOKEN = "madgrades-token";
  delete process.env.MADGRADES_MADGRADES_REPLICA_PATH;

  assert.throws(() => getMadgradesDatabaseConfig("/repo/web"), /MADGRADES_MADGRADES_REPLICA_PATH/);
});
