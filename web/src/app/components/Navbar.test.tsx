import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";

import { LastUpdatedLabel } from "./LastUpdatedLabel";

const REAL_DATE = Date;

function collapseWhitespace(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}

function withMockedNow<T>(nowIso: string, callback: () => T): T {
  class MockDate extends REAL_DATE {
    constructor(value?: string | number | Date) {
      super(value ?? nowIso);
    }

    static now() {
      return new REAL_DATE(nowIso).getTime();
    }

    static parse = REAL_DATE.parse;
    static UTC = REAL_DATE.UTC;
  }

  globalThis.Date = MockDate as DateConstructor;

  try {
    return callback();
  } finally {
    globalThis.Date = REAL_DATE;
  }
}

test("LastUpdatedLabel formats the visible label from the current time", () => {
  const markup = withMockedNow("2026-04-20T12:00:00.000Z", () =>
    renderToStaticMarkup(
      <LastUpdatedLabel lastRefreshedAt="2026-04-20T07:00:00.000Z" />,
    ),
  );

  const normalizedMarkup = collapseWhitespace(markup);
  assert.match(normalizedMarkup, />Updated 5 hours ago</i);
  assert.match(normalizedMarkup, /datetime="2026-04-20T07:00:00.000Z"/i);
});

test("Navbar passes the raw refresh timestamp to LastUpdatedLabel", async () => {
  const source = await readFile(new URL("./Navbar.tsx", import.meta.url), "utf8");

  assert.match(source, /import\s+\{\s*LastUpdatedLabel\s*\}\s+from\s+"\.\/LastUpdatedLabel"/);
  assert.match(source, /<LastUpdatedLabel\s+lastRefreshedAt=\{lastRefreshedAt\.toISOString\(\)\}\s*\/>/);
  assert.doesNotMatch(source, /formatRelativeTime\(/);
});

test("LastUpdatedLabel suppresses the expected hydration text mismatch", async () => {
  const source = await readFile(new URL("./LastUpdatedLabel.tsx", import.meta.url), "utf8");

  assert.match(source, /suppressHydrationWarning/);
});
