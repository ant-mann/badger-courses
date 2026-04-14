import test, { afterEach } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import { getDatabasePath } from "./env";

const originalDbPath = process.env.MADGRADES_DB_PATH;

afterEach(() => {
  if (originalDbPath === undefined) {
    delete process.env.MADGRADES_DB_PATH;
    return;
  }

  process.env.MADGRADES_DB_PATH = originalDbPath;
});

function withTempDir(fn: (dir: string) => void) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "madgrades-env-"));

  try {
    fn(dir);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
}

test("getDatabasePath prefers the packaged web data database when present", () => {
  withTempDir((dir) => {
    delete process.env.MADGRADES_DB_PATH;

    const packagedDbPath = path.join(dir, "web", "data", "fall-2026.sqlite");
    fs.mkdirSync(path.dirname(packagedDbPath), { recursive: true });
    fs.writeFileSync(packagedDbPath, "");

    assert.equal(getDatabasePath(dir), packagedDbPath);
  });
});

test("getDatabasePath falls back to the repo data database for local development", () => {
  withTempDir((dir) => {
    delete process.env.MADGRADES_DB_PATH;

    const localDbPath = path.join(dir, "data", "fall-2026.sqlite");
    fs.mkdirSync(path.dirname(localDbPath), { recursive: true });
    fs.writeFileSync(localDbPath, "");

    assert.equal(getDatabasePath(dir), localDbPath);
  });
});

test("getDatabasePath still honors MADGRADES_DB_PATH when it is set", () => {
  withTempDir((dir) => {
    process.env.MADGRADES_DB_PATH = "./custom.sqlite";

    assert.equal(getDatabasePath(dir), path.join(dir, "custom.sqlite"));
  });
});
