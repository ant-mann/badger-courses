# Fall 2026 Course Data Extractor Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a Playwright-based extractor that saves all public UW-Madison Fall 2026 course records and optional enrollment-package details to local JSON files.

**Architecture:** Use a small helper module for request construction and response validation, test that module with Node's built-in test runner, then add a single extraction script that launches Playwright, fetches paginated search results from the live page context, optionally enriches them with enrollment-package detail, and writes JSON snapshots to `data/`.

**Tech Stack:** Node 18, Playwright, Node test runner, JSON file output

---

### Task 1: Scaffold the project and add the first failing test

**Files:**
- Create: `package.json`
- Create: `tests/extractor.test.mjs`
- Test: `tests/extractor.test.mjs`

- [ ] **Step 1: Create `package.json` with test and extract scripts**

```json
{
  "name": "madgrades-fall-2026-extractor",
  "private": true,
  "type": "module",
  "scripts": {
    "test": "node --test",
    "extract:fall-2026": "node scripts/extract-fall-2026-courses.mjs"
  },
  "dependencies": {
    "playwright": "^1.54.0"
  }
}
```

- [ ] **Step 2: Write the failing test in `tests/extractor.test.mjs`**

```js
import test from 'node:test';
import assert from 'node:assert/strict';

import {
  buildEnrollmentPackagesPath,
  buildSearchRequest,
  extractSearchPage,
} from '../src/extractor-helpers.mjs';

test('extractSearchPage returns hits and found from a valid response', () => {
  const page = extractSearchPage({
    success: true,
    found: 2,
    hits: [{ courseId: '1' }, { courseId: '2' }],
  });

  assert.equal(page.found, 2);
  assert.deepEqual(page.hits, [{ courseId: '1' }, { courseId: '2' }]);
});

test('extractSearchPage rejects a response without a hits array', () => {
  assert.throws(
    () => extractSearchPage({ success: true, found: 1, hits: null }),
    /hits array/i,
  );
});

test('buildEnrollmentPackagesPath derives the detail endpoint from a course record', () => {
  const path = buildEnrollmentPackagesPath({
    termCode: '1272',
    courseId: '002983',
    subject: { subjectCode: '232' },
  });

  assert.equal(path, '/api/search/v1/enrollmentPackages/1272/232/002983');
});

test('buildSearchRequest keeps the confirmed browser payload shape', () => {
  const request = buildSearchRequest({ termCode: '1272', page: 3, pageSize: 50 });

  assert.equal(request.selectedTerm, '1272');
  assert.equal(request.page, 3);
  assert.equal(request.pageSize, 50);
  assert.equal(request.sortOrder, 'SUBJECT');
  assert.equal(request.queryString, '*');
  assert.match(
    JSON.stringify(request.filters),
    /OPEN WAITLISTED CLOSED/,
  );
});
```

- [ ] **Step 3: Run the test to verify it fails**

Run: `npm test`

Expected: FAIL with a module-not-found error for `src/extractor-helpers.mjs`

- [ ] **Step 4: Install dependencies**

Run: `npm install`

Expected: `playwright` installed and `package-lock.json` created

- [ ] **Step 5: No commit step**

This workspace is not a git repository, so skip commit steps throughout this plan.

### Task 2: Implement the helper module until the tests pass

**Files:**
- Create: `src/extractor-helpers.mjs`
- Modify: `tests/extractor.test.mjs`
- Test: `tests/extractor.test.mjs`

- [ ] **Step 1: Write the minimal helper implementation in `src/extractor-helpers.mjs`**

```js
export function buildSearchRequest({ termCode, page, pageSize = 50 }) {
  return {
    selectedTerm: termCode,
    queryString: '*',
    filters: [
      {
        has_child: {
          type: 'enrollmentPackage',
          query: {
            bool: {
              must: [
                { match: { 'packageEnrollmentStatus.status': 'OPEN WAITLISTED CLOSED' } },
                { match: { published: true } },
              ],
            },
          },
        },
      },
    ],
    page,
    pageSize,
    sortOrder: 'SUBJECT',
  };
}

export function extractSearchPage(data) {
  if (!data || data.success !== true) {
    throw new Error('Search response was not successful');
  }

  if (!Array.isArray(data.hits)) {
    throw new Error('Search response must include a hits array');
  }

  if (typeof data.found !== 'number') {
    throw new Error('Search response must include a numeric found count');
  }

  return {
    found: data.found,
    hits: data.hits,
  };
}

export function buildEnrollmentPackagesPath(course) {
  const termCode = course?.termCode;
  const subjectCode = course?.subject?.subjectCode;
  const courseId = course?.courseId;

  if (!termCode || !subjectCode || !courseId) {
    throw new Error('Course record is missing termCode, subject.subjectCode, or courseId');
  }

  return `/api/search/v1/enrollmentPackages/${termCode}/${subjectCode}/${courseId}`;
}
```

- [ ] **Step 2: Run the tests to verify they pass**

Run: `npm test`

Expected: PASS for all four tests in `tests/extractor.test.mjs`

- [ ] **Step 3: Refactor only if needed**

Keep the helper module small. Do not add extra abstractions unless a test requires them.

### Task 3: Implement the live extractor script

**Files:**
- Create: `scripts/extract-fall-2026-courses.mjs`
- Modify: `src/extractor-helpers.mjs`
- Test: `tests/extractor.test.mjs`

- [ ] **Step 1: Add one helper for output path creation if it is needed**

```js
export function normalizeCourseSummary(course) {
  return {
    termCode: course.termCode,
    courseId: course.courseId,
    subjectCode: course.subject?.subjectCode ?? null,
    courseDesignation: course.courseDesignation ?? null,
    title: course.title ?? null,
  };
}
```

Only add this helper if the script benefits from better failure logging.

- [ ] **Step 2: Write `scripts/extract-fall-2026-courses.mjs`**

```js
import { mkdir, writeFile } from 'node:fs/promises';
import process from 'node:process';
import { chromium } from 'playwright';

import {
  buildEnrollmentPackagesPath,
  buildSearchRequest,
  extractSearchPage,
  normalizeCourseSummary,
} from '../src/extractor-helpers.mjs';

const TERM_CODE = '1272';
const SEARCH_URL = `https://public.enroll.wisc.edu/search?orderBy=subject&term=${TERM_CODE}&closed=true`;
const OUTPUT_DIR = new URL('../data/', import.meta.url);
const COURSES_PATH = new URL('../data/fall-2026-courses.json', import.meta.url);
const PACKAGES_PATH = new URL('../data/fall-2026-enrollment-packages.json', import.meta.url);
const includePackages = process.argv.includes('--include-packages');

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function fetchSearchPage(page, pageNumber) {
  const response = await page.evaluate(async (payload) => {
    const result = await fetch('/api/search/v1', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(payload),
    });

    return {
      status: result.status,
      json: await result.json(),
    };
  }, buildSearchRequest({ termCode: TERM_CODE, page: pageNumber, pageSize: 50 }));

  if (response.status !== 200) {
    throw new Error(`Search request for page ${pageNumber} failed with status ${response.status}`);
  }

  return extractSearchPage(response.json);
}

async function fetchEnrollmentPackages(page, course) {
  const path = buildEnrollmentPackagesPath(course);
  const response = await page.evaluate(async (endpoint) => {
    const result = await fetch(endpoint);
    return {
      status: result.status,
      json: await result.json(),
    };
  }, path);

  if (response.status !== 200) {
    throw new Error(`Package request failed with status ${response.status}`);
  }

  if (!Array.isArray(response.json)) {
    throw new Error('Package response must be an array');
  }

  return {
    course: normalizeCourseSummary(course),
    endpoint: path,
    packages: response.json,
  };
}

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage();

try {
  await page.goto(SEARCH_URL, { waitUntil: 'networkidle' });

  const firstPage = await fetchSearchPage(page, 1);
  const totalPages = Math.ceil(firstPage.found / 50);
  const courses = [...firstPage.hits];

  for (let pageNumber = 2; pageNumber <= totalPages; pageNumber += 1) {
    const nextPage = await fetchSearchPage(page, pageNumber);
    courses.push(...nextPage.hits);
  }

  if (courses.length !== firstPage.found) {
    throw new Error(`Expected ${firstPage.found} courses but collected ${courses.length}`);
  }

  await mkdir(OUTPUT_DIR, { recursive: true });
  await writeFile(COURSES_PATH, JSON.stringify(courses, null, 2));

  if (includePackages) {
    const packageResults = [];
    const packageFailures = [];

    for (const course of courses) {
      try {
        const detail = await fetchEnrollmentPackages(page, course);
        packageResults.push(detail);
      } catch (error) {
        packageFailures.push({
          course: normalizeCourseSummary(course),
          error: error instanceof Error ? error.message : String(error),
        });
      }

      await sleep(100);
    }

    await writeFile(
      PACKAGES_PATH,
      JSON.stringify(
        {
          termCode: TERM_CODE,
          courseCount: courses.length,
          packageResultCount: packageResults.length,
          packageFailureCount: packageFailures.length,
          packageFailures,
          results: packageResults,
        },
        null,
        2,
      ),
    );
  }
} finally {
  await browser.close();
}
```

- [ ] **Step 3: Run tests again after wiring the script**

Run: `npm test`

Expected: PASS with the helper module still covered after script integration

### Task 4: Run the extractor and verify the outputs

**Files:**
- Create: `data/fall-2026-courses.json`
- Create: `data/fall-2026-enrollment-packages.json` when `--include-packages` is used

- [ ] **Step 1: Run the course-only extraction**

Run: `npm run extract:fall-2026`

Expected:
- exit code `0`
- `data/fall-2026-courses.json` created
- total collected course count matches the API's reported `found` count

- [ ] **Step 2: Verify the course output size and count**

Run: `node -e "const fs=require('fs');const data=JSON.parse(fs.readFileSync('data/fall-2026-courses.json','utf8'));console.log(data.length);"`

Expected: `5625`

- [ ] **Step 3: Run package enrichment**

Run: `npm run extract:fall-2026 -- --include-packages`

Expected:
- exit code `0`
- `data/fall-2026-enrollment-packages.json` created
- summary includes package success and failure counts

- [ ] **Step 4: Verify the package output summary**

Run: `node -e "const fs=require('fs');const data=JSON.parse(fs.readFileSync('data/fall-2026-enrollment-packages.json','utf8'));console.log(JSON.stringify({courseCount:data.courseCount,packageResultCount:data.packageResultCount,packageFailureCount:data.packageFailureCount},null,2));"`

Expected: counts printed as JSON with a low or zero failure count
