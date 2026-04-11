# Headless Extractor CloudFront Hardening Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the existing Playwright extractor succeed in headless mode against the UW enrollment site without adding new dependencies or introducing repo-wide Playwright config.

**Architecture:** Keep the fix local to `scripts/extract-fall-2026-courses.mjs`. Replace direct `browser.newPage()` usage with a realistic browser context plus a minimal init-script fingerprint patch, and add one small helper-level test plus a headless smoke verification command.

**Tech Stack:** Node.js, raw Playwright (`chromium.launch`), node:test

---

### Task 1: Add extractor-only headless context hardening

**Files:**
- Modify: `scripts/extract-fall-2026-courses.mjs`
- Test: `tests/extractor.test.mjs`

- [ ] **Step 1: Write the failing test**

Add a test that asserts the extractor's context options switch to a headed-like profile in headless mode.

```js
test('makeExtractionContextOptions returns a realistic desktop profile for headless mode', () => {
  const options = makeExtractionContextOptions({ headless: true });

  assert.match(options.userAgent, /Chrome\//);
  assert.deepEqual(options.viewport, { width: 1280, height: 720 });
  assert.equal(options.locale, 'en-US');
  assert.equal(options.timezoneId, 'America/Chicago');
  assert.equal(options.extraHTTPHeaders['Accept-Language'], 'en-US,en;q=0.9');
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test tests/extractor.test.mjs`
Expected: FAIL because `makeExtractionContextOptions` does not exist yet.

- [ ] **Step 3: Write the minimal implementation**

Update the extractor to:

```js
function makeExtractionContextOptions({ headless }) {
  if (!headless) {
    return {};
  }

  return {
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36',
    viewport: { width: 1280, height: 720 },
    locale: 'en-US',
    timezoneId: 'America/Chicago',
    extraHTTPHeaders: {
      Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
      'Accept-Language': 'en-US,en;q=0.9',
    },
  };
}
```

And switch setup to:

```js
const browser = await chromium.launch({ headless: runHeadless });
const context = await browser.newContext(makeExtractionContextOptions({ headless: runHeadless }));

if (runHeadless) {
  await context.addInitScript(() => {
    Object.defineProperty(navigator, 'webdriver', { get: () => undefined });
    Object.defineProperty(navigator, 'languages', { get: () => ['en-US', 'en'] });
    Object.defineProperty(navigator, 'platform', { get: () => 'Win32' });
    window.chrome = window.chrome || { runtime: {} };
  });
}

const page = await context.newPage();
```

- [ ] **Step 4: Improve parse-failure diagnostics**

Change the non-JSON error path to include status and a short response body preview.

```js
throw new Error(
  `Expected JSON from ${endpoint} but got status ${response.status}: ${response.text.slice(0, 240)}`,
);
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `node --test tests/extractor.test.mjs`
Expected: PASS

### Task 2: Verify the real headless path

**Files:**
- Modify: none
- Test: existing extractor script

- [ ] **Step 1: Run a headless API smoke test**

Run:

```bash
node --input-type=module -e 'import { chromium } from "playwright"; import { buildSearchRequest } from "./src/extractor-helpers.mjs";'
```

Expected: The real smoke command using the updated extractor context reaches `/api/search/v1` and returns HTTP `200` JSON.

- [ ] **Step 2: Run the extractor in headless mode without packages**

Run: `npm run extract:fall-2026 -- --headless`
Expected: PASS, writes `data/fall-2026-courses.json`

- [ ] **Step 3: Rebuild the database**

Run: `npm run build:course-db`
Expected: PASS

- [ ] **Step 4: Commit**

```bash
git add scripts/extract-fall-2026-courses.mjs tests/extractor.test.mjs docs/superpowers/plans/2026-04-11-headless-extractor-cloudfront-hardening.md data/fall-2026-courses.json data/fall-2026.sqlite
git commit -m "Harden headless course extraction against CloudFront"
```
