import { test } from "node:test";
import assert from "node:assert/strict";
import { formatRelativeTime } from "./time";

const BASE = new Date("2026-04-20T12:00:00.000Z");
const at = (offsetMs: number) => new Date(BASE.getTime() - offsetMs);

test("returns 'Updated just now' for 0 seconds ago", () => {
  assert.equal(formatRelativeTime(BASE, BASE), "Updated just now");
});

test("returns 'Updated just now' for 59 seconds ago", () => {
  assert.equal(formatRelativeTime(at(59_000), BASE), "Updated just now");
});

test("returns 'Updated 1 minute ago' for exactly 60 seconds ago", () => {
  assert.equal(formatRelativeTime(at(60_000), BASE), "Updated 1 minute ago");
});

test("returns 'Updated 2 minutes ago' for 2 minutes ago", () => {
  assert.equal(formatRelativeTime(at(2 * 60_000), BASE), "Updated 2 minutes ago");
});

test("returns 'Updated 1 hour ago' for exactly 60 minutes ago", () => {
  assert.equal(formatRelativeTime(at(60 * 60_000), BASE), "Updated 1 hour ago");
});

test("returns 'Updated 5 hours ago' for 5 hours ago", () => {
  assert.equal(formatRelativeTime(at(5 * 60 * 60_000), BASE), "Updated 5 hours ago");
});

test("returns 'Updated 1 day ago' for exactly 24 hours ago", () => {
  assert.equal(formatRelativeTime(at(24 * 60 * 60_000), BASE), "Updated 1 day ago");
});

test("returns 'Updated 3 days ago' for 3 days ago", () => {
  assert.equal(formatRelativeTime(at(3 * 24 * 60 * 60_000), BASE), "Updated 3 days ago");
});

test("returns 'Updated just now' when date is in the future", () => {
  assert.equal(formatRelativeTime(new Date("2026-04-20T12:05:00.000Z"), BASE), "Updated just now");
});
