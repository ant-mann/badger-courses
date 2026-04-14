import assert from "node:assert/strict";
import test from "node:test";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";

import Home from "@/app/page";

type ScheduleBuilderPageModule = {
  default:
    | (() => Promise<React.ReactElement> | React.ReactElement)
    | {
        default: () => Promise<React.ReactElement> | React.ReactElement;
      };
};

async function renderScheduleBuilderPage(): Promise<string> {
  try {
    const pageModule = (await import("./page")) as ScheduleBuilderPageModule;
    const Page = typeof pageModule.default === "function" ? pageModule.default : pageModule.default.default;
    const page = await Page();
    const layout = (page.props as { children?: React.ReactElement }).children;

    if (!layout) {
      return "";
    }

    const [intro] = React.Children.toArray((layout.props as { children?: React.ReactNode }).children);
    return intro ? renderToStaticMarkup(intro) : "";
  } catch {
    return "";
  }
}

async function loadScheduleBuilderPage(): Promise<React.ReactElement | null> {
  try {
    const pageModule = (await import("./page")) as ScheduleBuilderPageModule;
    const Page = typeof pageModule.default === "function" ? pageModule.default : pageModule.default.default;
    return await Page();
  } catch {
    return null;
  }
}

test("home page links to the schedule builder", async () => {
  const markup = renderToStaticMarkup(await Home({ searchParams: Promise.resolve({}) }));

  assert.match(markup, /href="\/schedule-builder"/i);
  assert.match(markup, /Build your schedule/i);
});

test("schedule builder page renders the dedicated heading and intro copy", async () => {
  const markup = await renderScheduleBuilderPage();

  assert.match(markup, /Build Fall 2026 schedules in the browser/i);
  assert.match(
    markup,
    /Add courses, lock or exclude section combinations, and compare ranked schedules with a weekly calendar/i,
  );
});

test("schedule builder page wraps the interactive builder in suspense", async () => {
  const page = await loadScheduleBuilderPage();
  const layout = page ? (page.props as { children?: React.ReactElement }).children : null;
  const children = layout
    ? React.Children.toArray((layout.props as { children?: React.ReactNode }).children)
    : [];
  const builderShell = children[1] as React.ReactElement | undefined;

  assert.equal(builderShell?.type, React.Suspense);
});
