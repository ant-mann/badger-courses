import { test, afterEach } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import Database from "better-sqlite3";
import { __resetDbsForTests } from "./db";
import { getLastRefreshedAt } from "./course-data";

let tmpDbPath = "";
const originalSupabaseDatabaseUrl = process.env.SUPABASE_DATABASE_URL;
const originalTursoCourseDatabaseUrl = process.env.TURSO_COURSE_DATABASE_URL;
const originalMadgradesCourseReplicaPath = process.env.MADGRADES_COURSE_REPLICA_PATH;

function setupTmpDb(rows: Array<{ snapshot_run_at: string; last_refreshed_at: string }>) {
  tmpDbPath = path.join(os.tmpdir(), `test-refresh-runs-${Date.now()}.sqlite`);
  const db = new Database(tmpDbPath);
  db.exec(`
    CREATE TABLE refresh_runs (
      refresh_id INTEGER PRIMARY KEY AUTOINCREMENT,
      snapshot_run_at TEXT NOT NULL,
      last_refreshed_at TEXT NOT NULL,
      source_term_code TEXT NOT NULL,
      snapshot_kind TEXT NOT NULL
    )
  `);
  const stmt = db.prepare(
    `INSERT INTO refresh_runs (snapshot_run_at, last_refreshed_at, source_term_code, snapshot_kind)
     VALUES (?, ?, '1272', 'fall-2026-enrollment-packages')`
  );
  for (const row of rows) {
    stmt.run(row.snapshot_run_at, row.last_refreshed_at);
  }
  db.close();

  delete process.env.SUPABASE_DATABASE_URL;
  process.env.TURSO_COURSE_DATABASE_URL = `file:${tmpDbPath}`;
  process.env.MADGRADES_COURSE_REPLICA_PATH = tmpDbPath;
  __resetDbsForTests();
}

afterEach(() => {
  __resetDbsForTests();
  if (originalSupabaseDatabaseUrl !== undefined) {
    process.env.SUPABASE_DATABASE_URL = originalSupabaseDatabaseUrl;
  } else {
    delete process.env.SUPABASE_DATABASE_URL;
  }
  if (originalTursoCourseDatabaseUrl !== undefined) {
    process.env.TURSO_COURSE_DATABASE_URL = originalTursoCourseDatabaseUrl;
  } else {
    delete process.env.TURSO_COURSE_DATABASE_URL;
  }
  if (originalMadgradesCourseReplicaPath !== undefined) {
    process.env.MADGRADES_COURSE_REPLICA_PATH = originalMadgradesCourseReplicaPath;
  } else {
    delete process.env.MADGRADES_COURSE_REPLICA_PATH;
  }
  if (tmpDbPath) {
    fs.rmSync(tmpDbPath, { force: true });
    tmpDbPath = "";
  }
});

test("getLastRefreshedAt returns the most recent last_refreshed_at as a Date", async () => {
  setupTmpDb([
    { snapshot_run_at: "2026-04-18T10:00:00.000Z", last_refreshed_at: "2026-04-18T10:05:00.000Z" },
    { snapshot_run_at: "2026-04-19T23:48:26.379Z", last_refreshed_at: "2026-04-20T00:03:28.449Z" },
  ]);
  const result = await getLastRefreshedAt();
  assert.ok(result instanceof Date);
  assert.equal(result.toISOString(), "2026-04-20T00:03:28.449Z");
});

test("getLastRefreshedAt returns null when refresh_runs is empty", async () => {
  setupTmpDb([]);
  const result = await getLastRefreshedAt();
  assert.equal(result, null);
});
