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
  assert.match(JSON.stringify(request.filters), /OPEN WAITLISTED CLOSED/);
});
