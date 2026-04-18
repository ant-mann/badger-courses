import test, { afterEach } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import {
  getDatabasePath,
  getCourseDatabaseConfig,
  getMadgradesDatabaseConfig,
  getSupabaseDatabaseUrl,
  isSupabaseRuntimeEnabled,
} from "./env";

const ORIGINAL_ENV = {
  MADGRADES_DB_PATH: process.env.MADGRADES_DB_PATH,
  SUPABASE_DATABASE_URL: process.env.SUPABASE_DATABASE_URL,
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

function withTempDir(fn: (dir: string) => void) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "madgrades-env-"));

  try {
    fn(dir);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
}

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

test("getDatabasePath resolves to the course replica path", () => {
  process.env.TURSO_COURSE_DATABASE_URL = "libsql://course-db.example.turso.io";
  process.env.TURSO_COURSE_AUTH_TOKEN = "course-token";
  process.env.MADGRADES_COURSE_REPLICA_PATH = "./tmp/course-replica.db";

  assert.equal(
    getDatabasePath("/repo/web"),
    path.join("/repo/web", "tmp", "course-replica.db"),
  );
});

test("getDatabasePath still honors MADGRADES_DB_PATH when it is set", () => {
  process.env.MADGRADES_DB_PATH = "./custom.sqlite";

  assert.equal(getDatabasePath("/repo/web"), path.join("/repo/web", "custom.sqlite"));
});

test("getDatabasePath still defaults to local sqlite when SUPABASE_DATABASE_URL is absent", () => {
  delete process.env.SUPABASE_DATABASE_URL;
  process.env.MADGRADES_DB_PATH = "./custom.sqlite";

  assert.equal(getDatabasePath("/repo/web"), path.join("/repo/web", "custom.sqlite"));
});

test("getSupabaseDatabaseUrl returns the trimmed connection string when present", () => {
  process.env.SUPABASE_DATABASE_URL = " postgres://example ";

  assert.equal(getSupabaseDatabaseUrl(), "postgres://example");
});

test("getSupabaseDatabaseUrl returns null when absent", () => {
  delete process.env.SUPABASE_DATABASE_URL;

  assert.equal(getSupabaseDatabaseUrl(), null);
});

test("isSupabaseRuntimeEnabled returns true when SUPABASE_DATABASE_URL is present", () => {
  process.env.SUPABASE_DATABASE_URL = "postgres://example";

  assert.equal(isSupabaseRuntimeEnabled(), true);
});

test("Supabase env tests restore SUPABASE_DATABASE_URL after each case", () => {
  assert.equal(process.env.SUPABASE_DATABASE_URL, ORIGINAL_ENV.SUPABASE_DATABASE_URL);
});

test("isSupabaseRuntimeEnabled returns false when SUPABASE_DATABASE_URL is absent", () => {
  delete process.env.SUPABASE_DATABASE_URL;

  assert.equal(isSupabaseRuntimeEnabled(), false);
});

test("getDatabasePath falls back to the first existing local sqlite path", () => {
  withTempDir((dir) => {
    const packagedDbPath = path.join(dir, "web", "data", "fall-2026.sqlite");
    const repoDbPath = path.join(dir, "data", "fall-2026.sqlite");

    fs.mkdirSync(path.dirname(packagedDbPath), { recursive: true });
    fs.mkdirSync(path.dirname(repoDbPath), { recursive: true });
    fs.writeFileSync(packagedDbPath, "");
    fs.writeFileSync(repoDbPath, "");

    assert.equal(getDatabasePath(dir), packagedDbPath);
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

test("getCourseDatabaseConfig does not require a course auth token for file urls", () => {
  process.env.TURSO_COURSE_DATABASE_URL = "file:/repo/data/course.db";
  delete process.env.TURSO_COURSE_AUTH_TOKEN;
  process.env.MADGRADES_COURSE_REPLICA_PATH = "./tmp/course-replica.db";

  assert.deepEqual(getCourseDatabaseConfig("/repo/web"), {
    url: "file:/repo/data/course.db",
    authToken: undefined,
    replicaPath: path.join("/repo/web", "tmp", "course-replica.db"),
  });
});

test("getCourseDatabaseConfig still uses Turso settings when explicitly requested by local replica config", () => {
  process.env.TURSO_COURSE_DATABASE_URL = "libsql://course-db.example.turso.io";
  process.env.TURSO_COURSE_AUTH_TOKEN = "course-token";
  process.env.MADGRADES_COURSE_REPLICA_PATH = "./tmp/course-replica.db";

  assert.equal(
    getCourseDatabaseConfig("/repo/web").url,
    "libsql://course-db.example.turso.io",
  );
});

test("getMadgradesDatabaseConfig does not require a Madgrades auth token for file urls", () => {
  process.env.TURSO_MADGRADES_DATABASE_URL = "file:/repo/data/madgrades.db";
  delete process.env.TURSO_MADGRADES_AUTH_TOKEN;
  process.env.MADGRADES_MADGRADES_REPLICA_PATH = "./tmp/madgrades-replica.db";

  assert.deepEqual(getMadgradesDatabaseConfig("/repo/web"), {
    url: "file:/repo/data/madgrades.db",
    authToken: undefined,
    replicaPath: path.join("/repo/web", "tmp", "madgrades-replica.db"),
  });
});

test("getCourseDatabaseConfig throws when course env is incomplete", () => {
  delete process.env.TURSO_COURSE_DATABASE_URL;
  process.env.TURSO_COURSE_AUTH_TOKEN = "course-token";
  process.env.MADGRADES_COURSE_REPLICA_PATH = "./tmp/course-replica.db";

  assert.throws(() => getCourseDatabaseConfig("/repo/web"), /TURSO_COURSE_DATABASE_URL/);
});

test("getCourseDatabaseConfig still requires a course auth token for remote urls", () => {
  process.env.TURSO_COURSE_DATABASE_URL = "libsql://course-db.example.turso.io";
  delete process.env.TURSO_COURSE_AUTH_TOKEN;
  process.env.MADGRADES_COURSE_REPLICA_PATH = "./tmp/course-replica.db";

  assert.throws(() => getCourseDatabaseConfig("/repo/web"), /TURSO_COURSE_AUTH_TOKEN/);
});

test("getMadgradesDatabaseConfig throws when the replica path is missing", () => {
  process.env.TURSO_MADGRADES_DATABASE_URL = "libsql://madgrades-db.example.turso.io";
  process.env.TURSO_MADGRADES_AUTH_TOKEN = "madgrades-token";
  delete process.env.MADGRADES_MADGRADES_REPLICA_PATH;

  assert.throws(() => getMadgradesDatabaseConfig("/repo/web"), /MADGRADES_MADGRADES_REPLICA_PATH/);
});

test("getMadgradesDatabaseConfig still requires a Madgrades auth token for remote urls", () => {
  process.env.TURSO_MADGRADES_DATABASE_URL = "libsql://madgrades-db.example.turso.io";
  delete process.env.TURSO_MADGRADES_AUTH_TOKEN;
  process.env.MADGRADES_MADGRADES_REPLICA_PATH = "./tmp/madgrades-replica.db";

  assert.throws(() => getMadgradesDatabaseConfig("/repo/web"), /TURSO_MADGRADES_AUTH_TOKEN/);
});
