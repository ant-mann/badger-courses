import assert from "node:assert/strict";
import test from "node:test";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";

import Home from "@/app/page";

type ScheduleBuilderPageModule = {
  default:
    | ((props?: {
        searchParams?: Promise<Record<string, string | string[] | undefined>>;
      }) => Promise<React.ReactElement> | React.ReactElement)
    | {
        default: (props?: {
          searchParams?: Promise<Record<string, string | string[] | undefined>>;
        }) => Promise<React.ReactElement> | React.ReactElement;
      };
};

async function invokeScheduleBuilderPageRedirect(searchParams: Record<string, string | string[] | undefined>) {
  try {
    const pageModule = (await import("./page")) as ScheduleBuilderPageModule;
    const Page = typeof pageModule.default === "function" ? pageModule.default : pageModule.default.default;
    await Page({ searchParams: Promise.resolve(searchParams) });
  } catch (error) {
    return error;
  }

  return null;
}

test("home page renders schedule builder content at /", async () => {
  const markup = renderToStaticMarkup(await Home());

  assert.match(markup, /Build Fall 2026 schedules in the browser/i);
  assert.match(
    markup,
    /Add courses, lock or exclude section combinations, and compare ranked schedules with a weekly calendar/i,
  );
});

test("schedule builder route permanently redirects to /", async () => {
  const redirectError = await invokeScheduleBuilderPageRedirect({});
  const digest = (redirectError as { digest?: string } | null)?.digest ?? "";

  assert.match(digest, /NEXT_REDIRECT/);
  assert.match(digest, /;\/;308;/);
});

test("schedule builder route preserves query params in redirect", async () => {
  const redirectError = await invokeScheduleBuilderPageRedirect({
    course: ["COMP SCI 200", "MATH 340"],
    lock: "12345",
    exclude: "67890",
  });
  const digest = (redirectError as { digest?: string } | null)?.digest ?? "";

  assert.match(digest, /NEXT_REDIRECT/);
  assert.match(digest, /;\/\?/);
  assert.match(digest, /course=COMP\+SCI\+200/);
  assert.match(digest, /course=MATH\+340/);
  assert.match(digest, /lock=12345/);
  assert.match(digest, /exclude=67890/);
});
