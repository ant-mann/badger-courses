import { after, test } from "node:test";
import assert from "node:assert/strict";

import { getLastRefreshedAt } from "./course-data";
import { __resetDbForTests } from "./db";
import { withDbRows } from "./db-test-helpers";

after(() => {
  __resetDbForTests();
});

test("getLastRefreshedAt returns the most recent last_refreshed_at as a Date", async () => {
  const result = await withDbRows(
    (sqlText) => {
      assert.match(sqlText, /FROM refresh_runs ORDER BY refresh_id DESC LIMIT 1/);
      return [{ last_refreshed_at: "2026-04-20T00:03:28.449Z" }];
    },
    async () => getLastRefreshedAt(),
  );

  assert.ok(result instanceof Date);
  assert.equal(result.toISOString(), "2026-04-20T00:03:28.449Z");
});

test("getLastRefreshedAt returns null when refresh_runs is empty", async () => {
  const result = await withDbRows(
    () => [],
    async () => getLastRefreshedAt(),
  );

  assert.equal(result, null);
});

test("getLastRefreshedAt returns null when the query fails", async () => {
  const result = await withDbRows(
    () => {
      throw new Error("connection refused");
    },
    async () => getLastRefreshedAt(),
  );

  assert.equal(result, null);
});
