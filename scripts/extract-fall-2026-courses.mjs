import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

import {
  buildEnrollmentPackagesPath,
  buildSearchRequest,
  extractSearchPage,
  normalizeCourseSummary,
} from '../src/extractor-helpers.mjs';

const TERM_CODE = '1272';
const PAGE_SIZE = 50;
const SEARCH_URL = `https://public.enroll.wisc.edu/search?orderBy=subject&term=${TERM_CODE}&closed=true`;
const OUTPUT_DIR = new URL('../data/', import.meta.url);
const COURSES_PATH = new URL('../data/fall-2026-courses.json', import.meta.url);
const PACKAGES_PATH = new URL('../data/fall-2026-enrollment-packages.json', import.meta.url);
const includePackages = process.argv.includes('--include-packages');
const runHeadless = process.argv.includes('--headless');
const __filename = fileURLToPath(import.meta.url);

const HEADLESS_DESKTOP_CONTEXT = {
  userAgent:
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36',
  viewport: { width: 1280, height: 720 },
  locale: 'en-US',
  timezoneId: 'America/Chicago',
  extraHTTPHeaders: {
    Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
    'Accept-Language': 'en-US,en;q=0.9',
  },
};

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export function makeExtractionContextOptions({ headless }) {
  return headless ? HEADLESS_DESKTOP_CONTEXT : {};
}

async function fetchJson(page, endpoint, options = {}) {
  const response = await page.evaluate(
    async ({ endpoint: pageEndpoint, options: pageOptions }) => {
      const result = await fetch(pageEndpoint, pageOptions);
      const text = await result.text();

      return {
        status: result.status,
        text,
      };
    },
    { endpoint, options },
  );

  let json;

  try {
    json = JSON.parse(response.text);
  } catch (error) {
    throw new Error(
      `Expected JSON from ${endpoint} but got status ${response.status}: ${response.text.slice(0, 240)}`,
    );
  }

  return {
    status: response.status,
    json,
  };
}

async function fetchSearchPage(page, pageNumber) {
  const payload = buildSearchRequest({
    termCode: TERM_CODE,
    page: pageNumber,
    pageSize: PAGE_SIZE,
  });

  const response = await fetchJson(page, '/api/search/v1', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(payload),
  });

  if (response.status !== 200) {
    throw new Error(`Search request for page ${pageNumber} failed with status ${response.status}`);
  }

  return extractSearchPage(response.json);
}

async function fetchEnrollmentPackages(page, course) {
  const endpoint = buildEnrollmentPackagesPath(course);
  const response = await fetchJson(page, endpoint);

  if (response.status !== 200) {
    throw new Error(`Package request failed with status ${response.status}`);
  }

  if (!Array.isArray(response.json)) {
    throw new Error('Package response must be an array');
  }

  return {
    course: normalizeCourseSummary(course),
    endpoint,
    packages: response.json,
  };
}

async function main() {
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

  try {
    console.log(`Opening ${SEARCH_URL}`);
    console.log(`Browser mode: ${runHeadless ? 'headless' : 'headed'}`);
    await page.goto(SEARCH_URL, { waitUntil: 'domcontentloaded' });
    await page.waitForLoadState('networkidle');

    const firstPage = await fetchSearchPage(page, 1);
    const totalPages = Math.ceil(firstPage.found / PAGE_SIZE);
    const courses = [...firstPage.hits];

    console.log(`Found ${firstPage.found} Fall 2026 course records across ${totalPages} pages`);

    for (let pageNumber = 2; pageNumber <= totalPages; pageNumber += 1) {
      const nextPage = await fetchSearchPage(page, pageNumber);
      courses.push(...nextPage.hits);

      if (pageNumber % 10 === 0 || pageNumber === totalPages) {
        console.log(`Fetched page ${pageNumber}/${totalPages}`);
      }
    }

    if (courses.length !== firstPage.found) {
      throw new Error(`Expected ${firstPage.found} courses but collected ${courses.length}`);
    }

    await mkdir(OUTPUT_DIR, { recursive: true });
    await writeFile(COURSES_PATH, `${JSON.stringify(courses, null, 2)}\n`);
    console.log(`Wrote ${courses.length} courses to ${COURSES_PATH.pathname}`);

    if (!includePackages) {
      return;
    }

    const packageResults = [];
    const packageFailures = [];

    console.log('Fetching enrollment package details');

    for (const [index, course] of courses.entries()) {
      try {
        const detail = await fetchEnrollmentPackages(page, course);
        packageResults.push(detail);
      } catch (error) {
        packageFailures.push({
          course: normalizeCourseSummary(course),
          error: error instanceof Error ? error.message : String(error),
        });
      }

      if ((index + 1) % 100 === 0 || index + 1 === courses.length) {
        console.log(`Fetched package details for ${index + 1}/${courses.length} courses`);
      }

      await sleep(100);
    }

    const packageSnapshot = {
      termCode: TERM_CODE,
      courseCount: courses.length,
      packageResultCount: packageResults.length,
      packageFailureCount: packageFailures.length,
      packageFailures,
      results: packageResults,
    };

    await writeFile(PACKAGES_PATH, `${JSON.stringify(packageSnapshot, null, 2)}\n`);
    console.log(
      `Wrote ${packageResults.length} package-detail entries to ${PACKAGES_PATH.pathname} (${packageFailures.length} failures)`,
    );
  } finally {
    await context.close();
    await browser.close();
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === __filename) {
  await main();
}
