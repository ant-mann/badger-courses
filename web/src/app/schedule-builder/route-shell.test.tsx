import assert from "node:assert/strict";
import test from "node:test";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";

import Home from "@/app/page";

async function renderScheduleBuilderPage(): Promise<string> {
  try {
    const module = await import("./page");
    return renderToStaticMarkup(await module.default());
  } catch {
    return "";
  }
}

test("home page links to the schedule builder", async () => {
  const markup = renderToStaticMarkup(await Home({ searchParams: Promise.resolve({}) }));

  assert.match(markup, /href="\/schedule-builder"/i);
  assert.match(markup, /Build schedules/i);
});

test("schedule builder page renders the dedicated heading and intro copy", async () => {
  const markup = await renderScheduleBuilderPage();

  assert.match(markup, /Build Fall 2026 schedules in the browser/i);
  assert.match(
    markup,
    /Add courses, lock or exclude section combinations, and compare ranked schedules with a weekly calendar/i,
  );
});
