import test from 'node:test';
import assert from 'node:assert/strict';
import os from 'node:os';
import path from 'node:path';
import { mkdtemp, readFile, rm } from 'node:fs/promises';

import { buildCourseDbFixture, makeCourse } from './helpers/madgrades-db-fixture.mjs';

const loadSnapshotHelpers = () => import('../src/madgrades/snapshot-helpers.mjs');
const loadImportRunner = () => import('../src/madgrades/import-runner.mjs');

function buildFixture() {
  return buildCourseDbFixture({
    courses: [
      makeCourse({
        termCode: '1272',
        courseId: '005770',
        subjectCode: '302',
        catalogNumber: '577',
        courseDesignation: 'COMP SCI 577',
        title: 'Algorithms for Large Data',
      }),
    ],
    packageSnapshot: {
      termCode: '1272',
      results: [
        {
          course: {
            termCode: '1272',
            subjectCode: '302',
            courseId: '005770',
          },
          packages: [
            {
              id: 'comp-sci-577-main',
              termCode: '1272',
              subjectCode: '302',
              courseId: '005770',
              enrollmentClassNumber: 57701,
              lastUpdated: 2000,
              onlineOnly: false,
              isAsynchronous: false,
              packageEnrollmentStatus: {
                status: 'OPEN',
                availableSeats: 3,
                waitlistTotal: 0,
              },
              enrollmentStatus: {
                openSeats: 3,
                waitlistCurrentSize: 0,
                capacity: 30,
                currentlyEnrolled: 27,
              },
              sections: [
                {
                  classUniqueId: { termCode: '1272', classNumber: 57701 },
                  sectionNumber: '001',
                  type: 'LEC',
                  instructionMode: 'IN PERSON',
                  sessionCode: '1',
                  published: true,
                  enrollmentStatus: {
                    openSeats: 3,
                    waitlistCurrentSize: 0,
                    capacity: 30,
                    currentlyEnrolled: 27,
                  },
                  instructors: [
                    {
                      name: { first: 'Ada', last: 'Lovelace' },
                      email: 'ada@example.edu',
                    },
                  ],
                  classMeetings: [],
                },
              ],
            },
          ],
        },
      ],
    },
  });
}

function buildMultiMatchFixture() {
  return buildCourseDbFixture({
    courses: [
      makeCourse({
        termCode: '1272',
        courseId: '005770',
        subjectCode: '302',
        catalogNumber: '577',
        courseDesignation: 'COMP SCI 577',
        title: 'Algorithms for Large Data',
      }),
      makeCourse({
        termCode: '1272',
        courseId: '003400',
        subjectCode: '302',
        catalogNumber: '340',
        courseDesignation: 'COMP SCI 340',
        title: 'Introduction to Numerical Methods',
      }),
    ],
    packageSnapshot: {
      termCode: '1272',
      results: [
        {
          course: {
            termCode: '1272',
            subjectCode: '302',
            courseId: '005770',
          },
          packages: [
            {
              id: 'comp-sci-577-main',
              termCode: '1272',
              subjectCode: '302',
              courseId: '005770',
              enrollmentClassNumber: 57701,
              lastUpdated: 2000,
              onlineOnly: false,
              isAsynchronous: false,
              packageEnrollmentStatus: {
                status: 'OPEN',
                availableSeats: 3,
                waitlistTotal: 0,
              },
              enrollmentStatus: {
                openSeats: 3,
                waitlistCurrentSize: 0,
                capacity: 30,
                currentlyEnrolled: 27,
              },
              sections: [
                {
                  classUniqueId: { termCode: '1272', classNumber: 57701 },
                  sectionNumber: '001',
                  type: 'LEC',
                  instructionMode: 'IN PERSON',
                  sessionCode: '1',
                  published: true,
                  enrollmentStatus: {
                    openSeats: 3,
                    waitlistCurrentSize: 0,
                    capacity: 30,
                    currentlyEnrolled: 27,
                  },
                  instructors: [
                    {
                      name: { first: 'Ada', last: 'Lovelace' },
                      email: 'ada@example.edu',
                    },
                  ],
                  classMeetings: [],
                },
              ],
            },
          ],
        },
        {
          course: {
            termCode: '1272',
            subjectCode: '302',
            courseId: '003400',
          },
          packages: [
            {
              id: 'comp-sci-340-main',
              termCode: '1272',
              subjectCode: '302',
              courseId: '003400',
              enrollmentClassNumber: 34001,
              lastUpdated: 2001,
              onlineOnly: false,
              isAsynchronous: false,
              packageEnrollmentStatus: {
                status: 'OPEN',
                availableSeats: 5,
                waitlistTotal: 0,
              },
              enrollmentStatus: {
                openSeats: 5,
                waitlistCurrentSize: 0,
                capacity: 40,
                currentlyEnrolled: 35,
              },
              sections: [
                {
                  classUniqueId: { termCode: '1272', classNumber: 34001 },
                  sectionNumber: '001',
                  type: 'LEC',
                  instructionMode: 'IN PERSON',
                  sessionCode: '1',
                  published: true,
                  enrollmentStatus: {
                    openSeats: 5,
                    waitlistCurrentSize: 0,
                    capacity: 40,
                    currentlyEnrolled: 35,
                  },
                  instructors: [
                    {
                      name: { first: 'Grace', last: 'Hopper' },
                      email: 'grace@example.edu',
                    },
                  ],
                  classMeetings: [],
                },
              ],
            },
          ],
        },
      ],
    },
  });
}

function buildDuplicateLocalCourseFixture() {
  return buildCourseDbFixture({
    courses: [
      makeCourse({
        termCode: '1272',
        courseId: '005770',
        subjectCode: '302',
        catalogNumber: '577',
        courseDesignation: 'COMP SCI 577',
        title: 'Algorithms for Large Data',
      }),
      makeCourse({
        termCode: '1272',
        courseId: '005771',
        subjectCode: '302',
        catalogNumber: '577',
        courseDesignation: 'COMP SCI 577',
        title: 'Algorithms for Large Data',
      }),
    ],
    packageSnapshot: {
      termCode: '1272',
      results: [
        {
          course: {
            termCode: '1272',
            subjectCode: '302',
            courseId: '005770',
          },
          packages: [
            {
              id: 'comp-sci-577-main-a',
              termCode: '1272',
              subjectCode: '302',
              courseId: '005770',
              enrollmentClassNumber: 57701,
              lastUpdated: 2000,
              onlineOnly: false,
              isAsynchronous: false,
              packageEnrollmentStatus: {
                status: 'OPEN',
                availableSeats: 3,
                waitlistTotal: 0,
              },
              enrollmentStatus: {
                openSeats: 3,
                waitlistCurrentSize: 0,
                capacity: 30,
                currentlyEnrolled: 27,
              },
              sections: [
                {
                  classUniqueId: { termCode: '1272', classNumber: 57701 },
                  sectionNumber: '001',
                  type: 'LEC',
                  instructionMode: 'IN PERSON',
                  sessionCode: '1',
                  published: true,
                  enrollmentStatus: {
                    openSeats: 3,
                    waitlistCurrentSize: 0,
                    capacity: 30,
                    currentlyEnrolled: 27,
                  },
                  instructors: [
                    {
                      name: { first: 'Ada', last: 'Lovelace' },
                      email: 'ada@example.edu',
                    },
                  ],
                  classMeetings: [],
                },
              ],
            },
          ],
        },
        {
          course: {
            termCode: '1272',
            subjectCode: '302',
            courseId: '005771',
          },
          packages: [
            {
              id: 'comp-sci-577-main-b',
              termCode: '1272',
              subjectCode: '302',
              courseId: '005771',
              enrollmentClassNumber: 57702,
              lastUpdated: 2001,
              onlineOnly: false,
              isAsynchronous: false,
              packageEnrollmentStatus: {
                status: 'OPEN',
                availableSeats: 2,
                waitlistTotal: 0,
              },
              enrollmentStatus: {
                openSeats: 2,
                waitlistCurrentSize: 0,
                capacity: 20,
                currentlyEnrolled: 18,
              },
              sections: [
                {
                  classUniqueId: { termCode: '1272', classNumber: 57702 },
                  sectionNumber: '002',
                  type: 'LEC',
                  instructionMode: 'IN PERSON',
                  sessionCode: '1',
                  published: true,
                  enrollmentStatus: {
                    openSeats: 2,
                    waitlistCurrentSize: 0,
                    capacity: 20,
                    currentlyEnrolled: 18,
                  },
                  instructors: [
                    {
                      name: { first: 'Ada', last: 'Lovelace' },
                      email: 'ada@example.edu',
                    },
                  ],
                  classMeetings: [],
                },
              ],
            },
          ],
        },
      ],
    },
  });
}

function buildDuplicateLocalInstructorFixture() {
  return buildCourseDbFixture({
    courses: [
      makeCourse({
        termCode: '1272',
        courseId: '005770',
        subjectCode: '302',
        catalogNumber: '577',
        courseDesignation: 'COMP SCI 577',
        title: 'Algorithms for Large Data',
      }),
    ],
    packageSnapshot: {
      termCode: '1272',
      results: [
        {
          course: {
            termCode: '1272',
            subjectCode: '302',
            courseId: '005770',
          },
          packages: [
            {
              id: 'comp-sci-577-dupe-instructors',
              termCode: '1272',
              subjectCode: '302',
              courseId: '005770',
              enrollmentClassNumber: 57701,
              lastUpdated: 2000,
              onlineOnly: false,
              isAsynchronous: false,
              packageEnrollmentStatus: {
                status: 'OPEN',
                availableSeats: 3,
                waitlistTotal: 0,
              },
              enrollmentStatus: {
                openSeats: 3,
                waitlistCurrentSize: 0,
                capacity: 30,
                currentlyEnrolled: 27,
              },
              sections: [
                {
                  classUniqueId: { termCode: '1272', classNumber: 57701 },
                  sectionNumber: '001',
                  type: 'LEC',
                  instructionMode: 'IN PERSON',
                  sessionCode: '1',
                  published: true,
                  enrollmentStatus: {
                    openSeats: 3,
                    waitlistCurrentSize: 0,
                    capacity: 30,
                    currentlyEnrolled: 27,
                  },
                  instructors: [
                    {
                      name: { first: 'Ada', last: 'Lovelace' },
                      email: 'ada@example.edu',
                    },
                    {
                      name: { first: 'Ada', last: 'Lovelace' },
                      email: 'ada.lovelace@example.edu',
                    },
                  ],
                  classMeetings: [],
                },
              ],
            },
          ],
        },
      ],
    },
  });
}

function buildCrossListedAliasFixture() {
  return buildCourseDbFixture({
    courses: [
      makeCourse({
        termCode: '1272',
        courseId: '005770',
        subjectCode: '302',
        catalogNumber: '577',
        courseDesignation: 'COMP SCI 577',
        fullCourseDesignation: 'COMP SCI/MATH 577',
        title: 'Algorithms for Large Data',
      }),
      makeCourse({
        termCode: '1272',
        courseId: '005770',
        subjectCode: '640',
        catalogNumber: '577',
        courseDesignation: 'MATH 577',
        fullCourseDesignation: 'COMP SCI/MATH 577',
        title: 'Algorithms for Large Data',
      }),
    ],
    packageSnapshot: {
      termCode: '1272',
      results: [
        {
          course: {
            termCode: '1272',
            subjectCode: '302',
            courseId: '005770',
          },
          packages: [
            {
              id: 'comp-sci-577-cross-listed',
              termCode: '1272',
              subjectCode: '302',
              courseId: '005770',
              enrollmentClassNumber: 57701,
              lastUpdated: 2000,
              onlineOnly: false,
              isAsynchronous: false,
              packageEnrollmentStatus: {
                status: 'OPEN',
                availableSeats: 3,
                waitlistTotal: 0,
              },
              enrollmentStatus: {
                openSeats: 3,
                waitlistCurrentSize: 0,
                capacity: 30,
                currentlyEnrolled: 27,
              },
              sections: [
                {
                  classUniqueId: { termCode: '1272', classNumber: 57701 },
                  sectionNumber: '001',
                  type: 'LEC',
                  instructionMode: 'IN PERSON',
                  sessionCode: '1',
                  published: true,
                  enrollmentStatus: {
                    openSeats: 3,
                    waitlistCurrentSize: 0,
                    capacity: 30,
                    currentlyEnrolled: 27,
                  },
                  instructors: [
                    {
                      name: { first: 'Ada', last: 'Lovelace' },
                      email: 'ada@example.edu',
                    },
                  ],
                  classMeetings: [],
                },
              ],
            },
          ],
        },
      ],
    },
  });
}

function buildSnapshot({ generatedAt = '2026-04-12T00:00:00.000Z' } = {}) {
  return {
    manifest: {
      generatedAt,
      source: 'test-fixture',
      sourceTermCode: '1272',
      matchedCourseCount: 1,
      matchedInstructorCount: 1,
    },
    courses: [
      {
        madgradesCourseId: 1,
        subjectCode: '302',
        catalogNumber: '577',
        courseDesignation: 'COMP SCI 577',
      },
    ],
    courseGrades: [
      {
        madgradesCourseGradeId: 1,
        madgradesCourseId: 1,
        termCode: '1262',
        avgGpa: 3.1,
      },
      {
        madgradesCourseGradeId: 2,
        madgradesCourseId: 1,
        termCode: '1264',
        avgGpa: 3.6,
      },
    ],
    courseOfferings: [
      {
        madgradesCourseOfferingId: 1,
        madgradesCourseId: 1,
        madgradesInstructorId: 1,
        termCode: '1262',
        sectionType: 'LEC',
        avgGpa: 3.1,
        studentCount: 20,
      },
      {
        madgradesCourseOfferingId: 2,
        madgradesCourseId: 1,
        madgradesInstructorId: 1,
        termCode: '1264',
        sectionType: 'LEC',
        avgGpa: 3.6,
        studentCount: 40,
      },
    ],
    courseGradeDistributions: [
      {
        madgradesCourseGradeDistributionId: 1,
        madgradesCourseGradeId: 1,
        grades: {
          A: 10,
          AB: 5,
          B: 5,
        },
      },
      {
        madgradesCourseGradeDistributionId: 2,
        madgradesCourseGradeId: 2,
        grades: {
          A: 20,
          AB: 10,
          B: 10,
        },
      },
    ],
    instructors: [
      {
        madgradesInstructorId: 1,
        displayName: 'Ada Lovelace',
      },
    ],
    instructorGrades: [
      {
        madgradesInstructorGradeId: 1,
        madgradesInstructorId: 1,
        termCode: '1260',
        avgGpa: 3.0,
      },
      {
        madgradesInstructorGradeId: 2,
        madgradesInstructorId: 1,
        termCode: '1264',
        avgGpa: 3.4,
      },
    ],
    instructorGradeDistributions: [
      {
        madgradesInstructorGradeDistributionId: 1,
        madgradesInstructorGradeId: 1,
        grades: {
          A: 5,
          AB: 5,
          B: 5,
        },
      },
      {
        madgradesInstructorGradeDistributionId: 2,
        madgradesInstructorGradeId: 2,
        grades: {
          A: 15,
          AB: 15,
          B: 15,
        },
      },
    ],
    matchReport: {
      courseMatches: [
        {
          termCode: '1272',
          courseId: '005770',
          madgradesCourseId: 1,
          matchStatus: 'matched',
          matchedAt: generatedAt,
        },
      ],
      instructorMatches: [
        {
          instructorKey: 'email:ada@example.edu',
          madgradesInstructorId: 1,
          matchStatus: 'matched',
          matchedAt: generatedAt,
        },
      ],
    },
  };
}

function createJsonResponse(payload) {
  return {
    ok: true,
    status: 200,
    statusText: 'OK',
    async text() {
      return JSON.stringify(payload);
    },
  };
}

function delay(milliseconds) {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

test('runMadgradesImport loads the latest saved snapshot into SQLite overview views', async () => {
  const fixture = buildFixture();
  const snapshotRoot = await mkdtemp(path.join(os.tmpdir(), 'madgrades-import-latest-'));
  const { writeMadgradesSnapshot } = await loadSnapshotHelpers();
  const { runMadgradesImport } = await loadImportRunner();

  try {
    await writeMadgradesSnapshot({
      snapshotRoot,
      snapshotId: '20260411T231405Z',
      snapshot: buildSnapshot({ generatedAt: '2026-04-11T23:14:05.000Z' }),
    });
    await writeMadgradesSnapshot({
      snapshotRoot,
      snapshotId: '20260412T010203Z',
      snapshot: buildSnapshot({ generatedAt: '2026-04-12T01:02:03.000Z' }),
    });

    const result = await runMadgradesImport({
      dbPath: fixture.dbPath,
      snapshotRoot,
      refreshApi: false,
    });

    assert.equal(result.snapshotId, '20260412T010203Z');

    const overview = fixture.db.prepare(`
      SELECT
        course_designation,
        instructor_display_name,
        same_course_prior_offering_count,
        same_course_student_count,
        same_course_gpa,
        course_historical_gpa,
        instructor_match_status
      FROM current_term_section_instructor_grade_overview_v
      WHERE term_code = ? AND course_id = ? AND section_class_number = ?
    `).get('1272', '005770', 57701);

    assert.deepEqual(overview, {
      course_designation: 'COMP SCI 577',
      instructor_display_name: 'Ada Lovelace',
      same_course_prior_offering_count: 2,
      same_course_student_count: 60,
      same_course_gpa: 3.433333333333333,
      course_historical_gpa: 3.433333333333333,
      instructor_match_status: 'matched',
    });
  } finally {
    fixture.cleanup();
    await rm(snapshotRoot, { recursive: true, force: true });
  }
});

test('runMadgradesImport rejects saved snapshots with broken foreign-key references', async () => {
  const fixture = buildFixture();
  const snapshotRoot = await mkdtemp(path.join(os.tmpdir(), 'madgrades-import-invalid-fk-'));
  const { writeMadgradesSnapshot } = await loadSnapshotHelpers();
  const { runMadgradesImport } = await loadImportRunner();

  try {
    const snapshot = buildSnapshot({ generatedAt: '2026-04-12T09:08:07.000Z' });
    snapshot.courseOfferings = [
      {
        madgradesCourseOfferingId: 1,
        madgradesCourseId: 1,
        madgradesInstructorId: 999,
        termCode: '1262',
        sectionType: 'LEC',
        avgGpa: 3.1,
        studentCount: 20,
      },
    ];

    await writeMadgradesSnapshot({
      snapshotRoot,
      snapshotId: '20260412T090807Z',
      snapshot,
    });

    await assert.rejects(
      runMadgradesImport({
        dbPath: fixture.dbPath,
        snapshotRoot,
        refreshApi: false,
      }),
      /FOREIGN KEY constraint failed/,
    );
  } finally {
    fixture.cleanup();
    await rm(snapshotRoot, { recursive: true, force: true });
  }
});

test('runMadgradesImport rehydrates Madgrades tables into a rebuilt base DB from a saved snapshot', async () => {
  const snapshotRoot = await mkdtemp(path.join(os.tmpdir(), 'madgrades-import-rehydrate-'));
  const { writeMadgradesSnapshot } = await loadSnapshotHelpers();
  const { runMadgradesImport } = await loadImportRunner();
  const firstFixture = buildFixture();

  try {
    await writeMadgradesSnapshot({
      snapshotRoot,
      snapshotId: '20260412T020304Z',
      snapshot: buildSnapshot({ generatedAt: '2026-04-12T02:03:04.000Z' }),
    });

    await runMadgradesImport({
      dbPath: firstFixture.dbPath,
      snapshotRoot,
      refreshApi: false,
    });

    const firstRunCounts = firstFixture.db.prepare(`
      SELECT
        (SELECT COUNT(*) FROM madgrades_refresh_runs) AS refresh_runs,
        (SELECT COUNT(*) FROM madgrades_courses) AS courses,
        (SELECT COUNT(*) FROM madgrades_course_grades) AS course_grades,
        (SELECT COUNT(*) FROM madgrades_instructor_grades) AS instructor_grades
    `).get();

    assert.deepEqual(firstRunCounts, {
      refresh_runs: 1,
      courses: 1,
      course_grades: 2,
      instructor_grades: 2,
    });
  } finally {
    firstFixture.cleanup();
  }

  const rebuiltFixture = buildFixture();

  try {
    const result = await runMadgradesImport({
      dbPath: rebuiltFixture.dbPath,
      snapshotRoot,
      refreshApi: false,
    });

    assert.equal(result.snapshotId, '20260412T020304Z');

    const overview = rebuiltFixture.db.prepare(`
      SELECT course_grade_term_count, historical_student_count, historical_gpa
      FROM course_grade_overview_v
      WHERE madgrades_course_id = ?
    `).get(1);

    assert.deepEqual(overview, {
      course_grade_term_count: 2,
      historical_student_count: 60,
      historical_gpa: 3.433333333333333,
    });
  } finally {
    rebuiltFixture.cleanup();
    await rm(snapshotRoot, { recursive: true, force: true });
  }
});

test('runMadgradesImport recomputes saved snapshot GPAs from grade distributions when stored GPAs are zero', async () => {
  const fixture = buildFixture();
  const snapshotRoot = await mkdtemp(path.join(os.tmpdir(), 'madgrades-import-recompute-gpa-'));
  const { writeMadgradesSnapshot } = await loadSnapshotHelpers();
  const { runMadgradesImport } = await loadImportRunner();

  const snapshot = {
    manifest: {
      generatedAt: '2026-04-12T14:15:16.000Z',
      source: 'madgrades-api',
      sourceTermCode: '1272',
      matchedCourseCount: 1,
      matchedInstructorCount: 1,
    },
    courses: [
      {
        madgradesCourseId: 1,
        subjectCode: '302',
        catalogNumber: '577',
        courseDesignation: 'COMP SCI 577',
      },
    ],
    courseGrades: [
      {
        madgradesCourseGradeId: 1,
        madgradesCourseId: 1,
        termCode: '1264',
        avgGpa: 0,
        studentCount: 30,
      },
    ],
    courseOfferings: [],
    courseGradeDistributions: [
      {
        madgradesCourseGradeDistributionId: 1,
        madgradesCourseGradeId: 1,
        grades: {
          a: 18,
          ab: 6,
          b: 6,
        },
      },
    ],
    instructors: [
      {
        madgradesInstructorId: 99,
        displayName: 'Ada Lovelace',
      },
    ],
    instructorGrades: [
      {
        madgradesInstructorGradeId: 1,
        madgradesInstructorId: 99,
        termCode: '1264',
        avgGpa: 0,
        studentCount: 30,
      },
    ],
    instructorGradeDistributions: [
      {
        madgradesInstructorGradeDistributionId: 1,
        madgradesInstructorGradeId: 1,
        grades: {
          a: 15,
          ab: 10,
          b: 5,
        },
      },
    ],
    matchReport: {
      courseMatches: [
        {
          termCode: '1272',
          courseId: '005770',
          madgradesCourseId: 1,
          matchStatus: 'matched',
          matchedAt: '2026-04-12T14:15:16.000Z',
        },
      ],
      instructorMatches: [
        {
          instructorKey: 'email:ada@example.edu',
          madgradesInstructorId: 99,
          matchStatus: 'matched',
          matchedAt: '2026-04-12T14:15:16.000Z',
        },
      ],
    },
  };

  try {
    await writeMadgradesSnapshot({
      snapshotRoot,
      snapshotId: '20260412T141516Z',
      snapshot,
    });

    await runMadgradesImport({
      dbPath: fixture.dbPath,
      snapshotRoot,
      refreshApi: false,
      now: new Date('2026-04-12T14:15:17.000Z'),
    });

    const courseOverview = fixture.db.prepare(`
      SELECT historical_gpa
      FROM course_grade_overview_v
      WHERE madgrades_course_id = 1
    `).get();
    const instructorOverview = fixture.db.prepare(`
      SELECT overall_gpa
      FROM instructor_grade_overview_v
      WHERE madgrades_instructor_id = 99
    `).get();

    assert.equal(courseOverview.historical_gpa, 3.7);
    assert.equal(instructorOverview.overall_gpa, 3.6666666666666665);
  } finally {
    fixture.cleanup();
    await rm(snapshotRoot, { recursive: true, force: true });
  }
});

test('runMadgradesImport with refreshApi writes a snapshot and imports matched rows from mocked API responses', async () => {
  const fixture = buildFixture();
  const snapshotRoot = await mkdtemp(path.join(os.tmpdir(), 'madgrades-import-refresh-'));
  const { runMadgradesImport } = await loadImportRunner();
  const fetchCalls = [];

  const fetchImpl = async (url) => {
    fetchCalls.push(url);

    if (url === 'https://example.test/api/courses?per_page=200&page=1') {
      return createJsonResponse({
        results: [
          {
            uuid: 'course-577',
            subject: '302',
            number: '577',
            name: 'Algorithms for Large Data',
          },
        ],
        currentPage: 1,
        totalPages: 1,
      });
    }

    if (url === 'https://example.test/api/instructors?per_page=200&page=1') {
      return createJsonResponse({
        results: [
          {
            id: 99,
            name: 'Ada Lovelace',
            url: 'https://example.test/api/instructors/99',
          },
        ],
        currentPage: 1,
        totalPages: 1,
      });
    }

    if (url === 'https://example.test/api/courses/course-577') {
      return createJsonResponse({
        course: {
          uuid: 'course-577',
          subject: '302',
          number: '577',
          abbreviation: 'COMP SCI 577',
        },
        grades: [
          {
            uuid: 'course-grade-1',
            term: '1264',
            average_gpa: 3.7,
            distributions: {
              A: 18,
              AB: 6,
              B: 6,
            },
          },
        ],
        offerings: [
          {
            uuid: 'course-offering-1',
            instructor_id: 99,
            term: '1264',
            section_type: 'LEC',
            student_count: 30,
            average_gpa: 3.7,
          },
        ],
      });
    }

    if (url === 'https://example.test/api/instructors/99/grades') {
      return createJsonResponse({
        instructorId: 99,
        cumulative: { total: 30, aCount: 15, abCount: 10, bCount: 5 },
        courseOfferings: [
          {
            termCode: '1264',
            courseUuid: 'course-577',
            courseOfferingUuid: 'course-offering-1',
            cumulative: { total: 30, aCount: 15, abCount: 10, bCount: 5 },
            sections: [
              {
                sectionNumber: 1,
                instructors: [{ id: 99, name: 'Ada Lovelace' }],
                total: 30,
                aCount: 15,
                abCount: 10,
                bCount: 5,
              },
            ],
          },
        ],
      });
    }

    throw new Error(`Unexpected fetch URL: ${url}`);
  };

  try {
    const result = await runMadgradesImport({
      dbPath: fixture.dbPath,
      snapshotRoot,
      refreshApi: true,
      token: 'test-token',
      fetchImpl,
      baseUrl: 'https://example.test/api',
      now: new Date('2026-04-12T03:04:05.000Z'),
    });

    assert.equal(result.snapshotId, '20260412T030405Z');
    assert.equal(result.courses, 1);
    assert.equal(result.instructors, 1);
    assert.equal(result.courseMatches, 1);
    assert.equal(result.instructorMatches, 1);

    const savedManifest = JSON.parse(
      await readFile(path.join(snapshotRoot, '20260412T030405Z', 'manifest.json'), 'utf8'),
    );
    assert.equal(savedManifest.matchedCourseCount, 1);
    assert.equal(savedManifest.matchedInstructorCount, 1);

    const importedOverview = fixture.db.prepare(`
      SELECT course_grade_term_count, historical_student_count, historical_gpa
      FROM course_grade_overview_v
      WHERE madgrades_course_id = ?
    `).get(1);
    const importedMatch = fixture.db.prepare(`
      SELECT match_status
      FROM madgrades_instructor_matches
      WHERE instructor_key = ?
    `).get('email:ada@example.edu');

    assert.deepEqual(importedOverview, {
      course_grade_term_count: 1,
      historical_student_count: 30,
      historical_gpa: 3.7,
    });
    assert.deepEqual(importedMatch, { match_status: 'matched' });
    assert.deepEqual(fetchCalls, [
      'https://example.test/api/courses?per_page=200&page=1',
      'https://example.test/api/instructors?per_page=200&page=1',
      'https://example.test/api/courses/course-577',
      'https://example.test/api/instructors/99/grades',
    ]);
  } finally {
    fixture.cleanup();
    await rm(snapshotRoot, { recursive: true, force: true });
  }
});

test('runMadgradesImport with refreshApi keeps generated IDs unique across multiple matched detail payloads', async () => {
  const fixture = buildMultiMatchFixture();
  const snapshotRoot = await mkdtemp(path.join(os.tmpdir(), 'madgrades-import-refresh-multi-'));
  const { runMadgradesImport } = await loadImportRunner();

  const fetchImpl = async (url) => {
    if (url === 'https://example.test/api/courses?per_page=200&page=1') {
      return createJsonResponse({
        results: [
          {
            uuid: 'course-577',
            subject: '302',
            number: '577',
            name: 'Algorithms for Large Data',
          },
          {
            uuid: 'course-340',
            subject: '302',
            number: '340',
            name: 'Introduction to Numerical Methods',
          },
        ],
        currentPage: 1,
        totalPages: 1,
      });
    }

    if (url === 'https://example.test/api/instructors?per_page=200&page=1') {
      return createJsonResponse({
        results: [
          {
            id: 99,
            name: 'Ada Lovelace',
            url: 'https://example.test/api/instructors/99',
          },
          {
            id: 100,
            name: 'Grace Hopper',
          },
        ],
        currentPage: 1,
        totalPages: 1,
      });
    }

    if (url === 'https://example.test/api/courses/course-577') {
      return createJsonResponse({
        course: {
          uuid: 'course-577',
          subject: '302',
          number: '577',
          abbreviation: 'COMP SCI 577',
        },
        grades: [
          {
            uuid: 'course-grade-577',
            term: '1264',
            average_gpa: 3.7,
            distributions: {
              A: 18,
              AB: 6,
              B: 6,
            },
          },
        ],
        offerings: [
          {
            uuid: 'course-offering-577',
            instructor_id: 99,
            term: '1264',
            section_type: 'LEC',
            student_count: 30,
            average_gpa: 3.7,
          },
        ],
      });
    }

    if (url === 'https://example.test/api/courses/course-340') {
      return createJsonResponse({
        course: {
          uuid: 'course-340',
          subject: '302',
          number: '340',
          abbreviation: 'COMP SCI 340',
        },
        grades: [
          {
            uuid: 'course-grade-340',
            term: '1264',
            average_gpa: 3.2,
            distributions: {
              A: 8,
              AB: 8,
              B: 8,
            },
          },
        ],
        offerings: [
          {
            uuid: 'course-offering-340',
            instructor_id: 100,
            term: '1264',
            section_type: 'LEC',
            student_count: 24,
            average_gpa: 3.2,
          },
        ],
      });
    }

    if (url === 'https://example.test/api/instructors/99/grades') {
      return createJsonResponse({
        instructorId: 99,
        cumulative: { total: 30, aCount: 15, abCount: 10, bCount: 5 },
        courseOfferings: [
          {
            termCode: '1264',
            courseUuid: 'course-577',
            courseOfferingUuid: 'course-offering-577',
            cumulative: { total: 30, aCount: 15, abCount: 10, bCount: 5 },
            sections: [
              {
                sectionNumber: 1,
                instructors: [{ id: 99, name: 'Ada Lovelace' }],
                total: 30,
                aCount: 15,
                abCount: 10,
                bCount: 5,
              },
            ],
          },
        ],
      });
    }

    if (url === 'https://example.test/api/instructors/100') {
      return createJsonResponse({
        instructor: {
          id: 100,
          name: 'Grace Hopper',
        },
        grades: [
          {
            id: 'instructor-grade-100',
            term: '1264',
            average_gpa: 3.1,
            distributions: {
              A: 10,
              AB: 7,
              B: 3,
            },
          },
        ],
      });
    }

    throw new Error(`Unexpected fetch URL: ${url}`);
  };

  try {
    const result = await runMadgradesImport({
      dbPath: fixture.dbPath,
      snapshotRoot,
      refreshApi: true,
      token: 'test-token',
      fetchImpl,
      baseUrl: 'https://example.test/api',
      now: new Date('2026-04-12T04:05:06.000Z'),
    });

    assert.equal(result.snapshotId, '20260412T040506Z');

    const counts = fixture.db.prepare(`
      SELECT
        (SELECT COUNT(*) FROM madgrades_course_grades) AS course_grades,
        (SELECT COUNT(*) FROM madgrades_course_grade_distributions) AS course_grade_distributions,
        (SELECT COUNT(*) FROM madgrades_course_offerings) AS course_offerings,
        (SELECT COUNT(*) FROM madgrades_instructor_grades) AS instructor_grades,
        (SELECT COUNT(*) FROM madgrades_instructor_grade_distributions) AS instructor_grade_distributions
    `).get();
    const linkedCourseDistributions = fixture.db.prepare(`
      SELECT
        mcg.madgrades_course_id,
        mcg.student_count,
        SUM(mcgd.student_count) AS distribution_student_count
      FROM madgrades_course_grades mcg
      JOIN madgrades_course_grade_distributions mcgd
        ON mcgd.madgrades_course_grade_id = mcg.madgrades_course_grade_id
      GROUP BY mcg.madgrades_course_grade_id, mcg.madgrades_course_id, mcg.student_count
      ORDER BY mcg.madgrades_course_id
    `).all();
    const linkedInstructorDistributions = fixture.db.prepare(`
      SELECT
        mig.madgrades_instructor_id,
        mig.student_count,
        SUM(migd.student_count) AS distribution_student_count
      FROM madgrades_instructor_grades mig
      JOIN madgrades_instructor_grade_distributions migd
        ON migd.madgrades_instructor_grade_id = mig.madgrades_instructor_grade_id
      GROUP BY mig.madgrades_instructor_grade_id, mig.madgrades_instructor_id, mig.student_count
      ORDER BY mig.madgrades_instructor_id
    `).all();

    assert.deepEqual(counts, {
      course_grades: 2,
      course_grade_distributions: 6,
      course_offerings: 2,
      instructor_grades: 2,
      instructor_grade_distributions: 6,
    });
    assert.deepEqual(
      linkedCourseDistributions
        .map((row) => ({
          student_count: row.student_count,
          distribution_student_count: row.distribution_student_count,
        }))
        .sort((left, right) => left.student_count - right.student_count),
      [
        {
          student_count: 24,
          distribution_student_count: 24,
        },
        {
          student_count: 30,
          distribution_student_count: 30,
        },
      ],
    );
    assert.equal(new Set(linkedCourseDistributions.map((row) => row.madgrades_course_id)).size, 2);
    assert.deepEqual(
      linkedInstructorDistributions
        .map((row) => ({
          student_count: row.student_count,
          distribution_student_count: row.distribution_student_count,
        }))
        .sort((left, right) => left.student_count - right.student_count),
      [
        {
          student_count: 20,
          distribution_student_count: 20,
        },
        {
          student_count: 30,
          distribution_student_count: 30,
        },
      ],
    );
    assert.equal(new Set(linkedInstructorDistributions.map((row) => row.madgrades_instructor_id)).size, 2);
  } finally {
    fixture.cleanup();
    await rm(snapshotRoot, { recursive: true, force: true });
  }
});

test('runMadgradesImport with refreshApi overlaps detail fetches instead of running them fully serially', async () => {
  const fixture = buildMultiMatchFixture();
  const snapshotRoot = await mkdtemp(path.join(os.tmpdir(), 'madgrades-import-refresh-concurrency-'));
  const { runMadgradesImport } = await loadImportRunner();
  const detailEvents = [];

  const fetchImpl = async (url) => {
    if (url === 'https://example.test/api/courses?per_page=200&page=1') {
      return createJsonResponse({
        results: [
          {
            uuid: 'course-577',
            subject: '302',
            number: '577',
            name: 'Algorithms for Large Data',
          },
          {
            uuid: 'course-340',
            subject: '302',
            number: '340',
            name: 'Introduction to Numerical Methods',
          },
        ],
        currentPage: 1,
        totalPages: 1,
      });
    }

    if (url === 'https://example.test/api/instructors?per_page=200&page=1') {
      return createJsonResponse({
        results: [
          {
            id: 99,
            name: 'Ada Lovelace',
          },
          {
            id: 100,
            name: 'Grace Hopper',
          },
        ],
        currentPage: 1,
        totalPages: 1,
      });
    }

    if (url === 'https://example.test/api/courses/course-577') {
      detailEvents.push(`start:${url}`);
      await delay(60);
      detailEvents.push(`finish:${url}`);
      return createJsonResponse({
        course: {
          uuid: 'course-577',
          subject: '302',
          number: '577',
          abbreviation: 'COMP SCI 577',
        },
        grades: [],
        offerings: [],
      });
    }

    if (url === 'https://example.test/api/courses/course-340') {
      detailEvents.push(`start:${url}`);
      await delay(60);
      detailEvents.push(`finish:${url}`);
      return createJsonResponse({
        course: {
          uuid: 'course-340',
          subject: '302',
          number: '340',
          abbreviation: 'COMP SCI 340',
        },
        grades: [],
        offerings: [],
      });
    }

    if (url === 'https://example.test/api/instructors/99') {
      detailEvents.push(`start:${url}`);
      await delay(60);
      detailEvents.push(`finish:${url}`);
      return createJsonResponse({
        instructor: {
          id: 99,
          name: 'Ada Lovelace',
        },
        grades: [],
      });
    }

    if (url === 'https://example.test/api/instructors/100') {
      detailEvents.push(`start:${url}`);
      await delay(60);
      detailEvents.push(`finish:${url}`);
      return createJsonResponse({
        instructor: {
          id: 100,
          name: 'Grace Hopper',
        },
        grades: [],
      });
    }

    throw new Error(`Unexpected fetch URL: ${url}`);
  };

  try {
    await runMadgradesImport({
      dbPath: fixture.dbPath,
      snapshotRoot,
      refreshApi: true,
      token: 'test-token',
      fetchImpl,
      baseUrl: 'https://example.test/api',
      now: new Date('2026-04-12T10:11:12.000Z'),
    });

    assert.equal(detailEvents.filter((event) => event.startsWith('start:')).length, 4);
    assert.equal(detailEvents.filter((event) => event.startsWith('finish:')).length, 4);
    assert.ok(
      detailEvents.some(
        (event, index) => event.startsWith('start:') && detailEvents[index + 1]?.startsWith('start:'),
      ),
      `expected overlapping detail fetches, got event order: ${detailEvents.join(', ')}`,
    );
  } finally {
    fixture.cleanup();
    await rm(snapshotRoot, { recursive: true, force: true });
  }
});

test('runMadgradesImport with refreshApi dedupes matched course detail fetches by Madgrades UUID', async () => {
  const fixture = buildDuplicateLocalCourseFixture();
  const snapshotRoot = await mkdtemp(path.join(os.tmpdir(), 'madgrades-import-refresh-dedup-course-'));
  const { runMadgradesImport } = await loadImportRunner();
  const fetchCalls = [];

  const fetchImpl = async (url) => {
    fetchCalls.push(url);

    if (url === 'https://example.test/api/courses?per_page=200&page=1') {
      return createJsonResponse({
        results: [
          {
            uuid: 'course-577',
            subject: '302',
            number: '577',
            name: 'Algorithms for Large Data',
          },
        ],
        currentPage: 1,
        totalPages: 1,
      });
    }

    if (url === 'https://example.test/api/instructors?per_page=200&page=1') {
      return createJsonResponse({
        results: [
          {
            id: 99,
            name: 'Ada Lovelace',
            url: 'https://example.test/api/instructors/99',
          },
        ],
        currentPage: 1,
        totalPages: 1,
      });
    }

    if (url === 'https://example.test/api/courses/course-577') {
      return createJsonResponse({
        course: {
          uuid: 'course-577',
          subject: '302',
          number: '577',
          abbreviation: 'COMP SCI 577',
        },
        grades: [
          {
            uuid: 'course-grade-577',
            term: '1264',
            average_gpa: 3.7,
            distributions: {
              A: 18,
              AB: 6,
              B: 6,
            },
          },
        ],
        offerings: [
          {
            uuid: 'course-offering-577',
            instructor_id: 99,
            term: '1264',
            section_type: 'LEC',
            student_count: 30,
            average_gpa: 3.7,
          },
        ],
      });
    }

    if (url === 'https://example.test/api/instructors/99/grades') {
      return createJsonResponse({
        instructorId: 99,
        cumulative: { total: 30, aCount: 15, abCount: 10, bCount: 5 },
        courseOfferings: [
          {
            termCode: '1264',
            courseUuid: 'course-577',
            courseOfferingUuid: 'course-offering-577-unknown',
            cumulative: { total: 30, aCount: 15, abCount: 10, bCount: 5 },
            sections: [
              {
                sectionNumber: 1,
                instructors: [{ id: 99, name: 'Ada Lovelace' }],
                total: 30,
                aCount: 15,
                abCount: 10,
                bCount: 5,
              },
            ],
          },
        ],
      });
    }

    throw new Error(`Unexpected fetch URL: ${url}`);
  };

  try {
    const result = await runMadgradesImport({
      dbPath: fixture.dbPath,
      snapshotRoot,
      refreshApi: true,
      token: 'test-token',
      fetchImpl,
      baseUrl: 'https://example.test/api',
      now: new Date('2026-04-12T05:06:07.000Z'),
    });

    assert.equal(result.courses, 1);
    assert.equal(result.courseMatches, 2);
    assert.equal(
      fetchCalls.filter((url) => url === 'https://example.test/api/courses/course-577').length,
      1,
    );
    assert.deepEqual(
      fixture.db.prepare(`
        SELECT
          (SELECT COUNT(*) FROM madgrades_courses) AS courses,
          (SELECT COUNT(*) FROM madgrades_course_grades) AS course_grades,
          (SELECT COUNT(*) FROM madgrades_course_matches) AS course_matches
      `).get(),
      {
        courses: 1,
        course_grades: 1,
        course_matches: 2,
      },
    );
  } finally {
    fixture.cleanup();
    await rm(snapshotRoot, { recursive: true, force: true });
  }
});

test('runMadgradesImport with refreshApi omits course offerings for instructors not imported into Madgrades tables', async () => {
  const fixture = buildFixture();
  const snapshotRoot = await mkdtemp(path.join(os.tmpdir(), 'madgrades-import-refresh-offering-fk-'));
  const { runMadgradesImport } = await loadImportRunner();

  const fetchImpl = async (url) => {
    if (url === 'https://example.test/api/courses?per_page=200&page=1') {
      return createJsonResponse({
        results: [
          {
            uuid: 'course-577',
            subject: '302',
            number: '577',
            name: 'Algorithms for Large Data',
          },
        ],
        currentPage: 1,
        totalPages: 1,
      });
    }

    if (url === 'https://example.test/api/instructors?per_page=200&page=1') {
      return createJsonResponse({
        results: [
          {
            id: 99,
            name: 'Ada Lovelace',
            url: 'https://example.test/api/instructors/99',
          },
        ],
        currentPage: 1,
        totalPages: 1,
      });
    }

    if (url === 'https://example.test/api/courses/course-577') {
      return createJsonResponse({
        course: {
          uuid: 'course-577',
          subject: '302',
          number: '577',
          abbreviation: 'COMP SCI 577',
        },
        grades: [
          {
            uuid: 'course-grade-577',
            term: '1264',
            average_gpa: 3.7,
            distributions: {
              A: 18,
              AB: 6,
              B: 6,
            },
          },
        ],
        offerings: [
          {
            uuid: 'course-offering-577-unknown',
            instructor_id: 404,
            term: '1264',
            section_type: 'LEC',
            student_count: 30,
            average_gpa: 3.7,
          },
        ],
      });
    }

    if (url === 'https://example.test/api/instructors/99/grades') {
      return createJsonResponse({
        instructorId: 99,
        cumulative: { total: 30, aCount: 15, abCount: 10, bCount: 5 },
        courseOfferings: [
          {
            termCode: '1264',
            courseUuid: 'course-577',
            courseOfferingUuid: 'course-offering-577',
            cumulative: { total: 30, aCount: 15, abCount: 10, bCount: 5 },
            sections: [
              {
                sectionNumber: 1,
                instructors: [{ id: 99, name: 'Ada Lovelace' }],
                total: 30,
                aCount: 15,
                abCount: 10,
                bCount: 5,
              },
            ],
          },
        ],
      });
    }

    throw new Error(`Unexpected fetch URL: ${url}`);
  };

  try {
    const result = await runMadgradesImport({
      dbPath: fixture.dbPath,
      snapshotRoot,
      refreshApi: true,
      token: 'test-token',
      fetchImpl,
      baseUrl: 'https://example.test/api',
      now: new Date('2026-04-12T06:07:08.000Z'),
    });

    assert.equal(result.courses, 1);
    assert.equal(result.instructors, 1);
    assert.equal(result.courseOfferings, 0);
    assert.deepEqual(
      fixture.db.prepare(`
        SELECT
          (SELECT COUNT(*) FROM madgrades_course_offerings) AS course_offerings,
          (SELECT COUNT(*) FROM madgrades_course_grades) AS course_grades,
          (SELECT COUNT(*) FROM madgrades_instructors) AS instructors
      `).get(),
      {
        course_offerings: 0,
        course_grades: 1,
        instructors: 1,
      },
    );
  } finally {
    fixture.cleanup();
    await rm(snapshotRoot, { recursive: true, force: true });
  }
});

test('runMadgradesImport with refreshApi dedupes matched instructor detail fetches by Madgrades instructor ID', async () => {
  const fixture = buildDuplicateLocalInstructorFixture();
  const snapshotRoot = await mkdtemp(path.join(os.tmpdir(), 'madgrades-import-refresh-dedup-instructor-'));
  const { runMadgradesImport } = await loadImportRunner();
  const fetchCalls = [];

  const fetchImpl = async (url) => {
    fetchCalls.push(url);

    if (url === 'https://example.test/api/courses?per_page=200&page=1') {
      return createJsonResponse({
        results: [
          {
            uuid: 'course-577',
            subject: '302',
            number: '577',
            name: 'Algorithms for Large Data',
          },
        ],
        currentPage: 1,
        totalPages: 1,
      });
    }

    if (url === 'https://example.test/api/instructors?per_page=200&page=1') {
      return createJsonResponse({
        results: [
          {
            id: 99,
            name: 'Ada Lovelace',
          },
        ],
        currentPage: 1,
        totalPages: 1,
      });
    }

    if (url === 'https://example.test/api/courses/course-577') {
      return createJsonResponse({
        course: {
          uuid: 'course-577',
          subject: '302',
          number: '577',
          abbreviation: 'COMP SCI 577',
        },
        grades: [
          {
            uuid: 'course-grade-577',
            term: '1264',
            average_gpa: 3.7,
            distributions: {
              A: 18,
              AB: 6,
              B: 6,
            },
          },
        ],
        offerings: [
          {
            uuid: 'course-offering-577',
            instructor_id: 99,
            term: '1264',
            section_type: 'LEC',
            student_count: 30,
            average_gpa: 3.7,
          },
        ],
      });
    }

    if (url === 'https://example.test/api/instructors/99') {
      return createJsonResponse({
        instructor: {
          id: 99,
          name: 'Ada Lovelace',
        },
        grades: [
          {
            id: 'instructor-grade-99',
            term: '1264',
            average_gpa: 3.5,
            distributions: {
              A: 15,
              AB: 10,
              B: 5,
            },
          },
        ],
      });
    }

    throw new Error(`Unexpected fetch URL: ${url}`);
  };

  try {
    const result = await runMadgradesImport({
      dbPath: fixture.dbPath,
      snapshotRoot,
      refreshApi: true,
      token: 'test-token',
      fetchImpl,
      baseUrl: 'https://example.test/api',
      now: new Date('2026-04-12T07:08:09.000Z'),
    });

    assert.equal(result.instructors, 1);
    assert.equal(result.instructorMatches, 2);
    assert.equal(
      fetchCalls.filter((url) => url === 'https://example.test/api/instructors/99').length,
      1,
    );
    assert.deepEqual(
      fixture.db.prepare(`
        SELECT
          (SELECT COUNT(*) FROM madgrades_instructors) AS instructors,
          (SELECT COUNT(*) FROM madgrades_instructor_grades) AS instructor_grades,
          (SELECT COUNT(*) FROM madgrades_instructor_matches) AS instructor_matches
      `).get(),
      {
        instructors: 1,
        instructor_grades: 1,
        instructor_matches: 2,
      },
    );
  } finally {
    fixture.cleanup();
    await rm(snapshotRoot, { recursive: true, force: true });
  }
});

test('runMadgradesImport with refreshApi rejects when a matched instructor grades endpoint returns 404', async () => {
  const fixture = buildFixture();
  const snapshotRoot = await mkdtemp(path.join(os.tmpdir(), 'madgrades-import-refresh-stale-instructor-'));
  const { runMadgradesImport } = await loadImportRunner();

  const fetchImpl = async (url) => {
    if (url === 'https://example.test/api/courses?per_page=200&page=1') {
      return createJsonResponse({
        results: [
          {
            uuid: 'course-577',
            subject: '302',
            number: '577',
            name: 'Algorithms for Large Data',
          },
        ],
        currentPage: 1,
        totalPages: 1,
      });
    }

    if (url === 'https://example.test/api/instructors?per_page=200&page=1') {
      return createJsonResponse({
        results: [
          {
            id: 99,
            name: 'Ada Lovelace',
            url: 'https://example.test/api/instructors/99',
          },
        ],
        currentPage: 1,
        totalPages: 1,
      });
    }

    if (url === 'https://example.test/api/courses/course-577') {
      return createJsonResponse({
        course: {
          uuid: 'course-577',
          subject: '302',
          number: '577',
          abbreviation: 'COMP SCI 577',
        },
        grades: [
          {
            uuid: 'course-grade-1',
            term: '1264',
            average_gpa: 3.7,
            distributions: {
              A: 18,
              AB: 6,
              B: 6,
            },
          },
        ],
        offerings: [
          {
            uuid: 'course-offering-1',
            instructor_id: 99,
            term: '1264',
            section_type: 'LEC',
            student_count: 30,
            average_gpa: 3.7,
          },
        ],
      });
    }

    if (url === 'https://example.test/api/instructors/99/grades') {
      return {
        ok: false,
        status: 404,
        statusText: 'Not Found',
        async text() {
          return JSON.stringify({ error: 'Not found' });
        },
      };
    }

    throw new Error(`Unexpected fetch URL: ${url}`);
  };

  try {
    await assert.rejects(
      runMadgradesImport({
        dbPath: fixture.dbPath,
        snapshotRoot,
        refreshApi: true,
        token: 'test-token',
        fetchImpl,
        baseUrl: 'https://example.test/api',
        now: new Date('2026-04-12T09:10:11.000Z'),
      }),
      /404 Not Found.*\/instructors\/99\/grades/,
    );
  } finally {
    fixture.cleanup();
    await rm(snapshotRoot, { recursive: true, force: true });
  }
});

test('runMadgradesImport with refreshApi supports live-style top-level detail payloads and separate grades endpoints', async () => {
  const fixture = buildFixture();
  const snapshotRoot = await mkdtemp(path.join(os.tmpdir(), 'madgrades-import-refresh-live-shape-'));
  const { runMadgradesImport } = await loadImportRunner();

  const fetchImpl = async (url) => {
    if (url === 'https://example.test/api/courses?per_page=200&page=1') {
      return createJsonResponse({
        results: [
          {
            uuid: 'course-577',
            number: '577',
            name: 'Algorithms for Large Data',
            subjects: [
              {
                code: '302',
                abbreviation: 'COMP SCI',
              },
            ],
          },
        ],
        currentPage: 1,
        totalPages: 1,
      });
    }

    if (url === 'https://example.test/api/instructors?per_page=200&page=1') {
      return createJsonResponse({
        results: [
          {
            id: 99,
            name: 'Ada Lovelace',
            url: 'https://example.test/api/instructors/99',
          },
        ],
        currentPage: 1,
        totalPages: 1,
      });
    }

    if (url === 'https://example.test/api/courses/course-577') {
      return createJsonResponse({
        uuid: 'course-577',
        number: '577',
        name: 'Algorithms for Large Data',
        subjects: [
          {
            code: '302',
            abbreviation: 'COMP SCI',
          },
        ],
        courseOfferings: [
          {
            uuid: 'offering-577-1264',
            termCode: '1264',
            sections: [
              {
                sectionType: 'LEC',
                number: 1,
                instructors: [
                  {
                    id: 99,
                    name: 'Ada Lovelace',
                  },
                ],
              },
            ],
          },
        ],
      });
    }

    if (url === 'https://example.test/api/courses/course-577/grades') {
      return createJsonResponse({
        courseUuid: 'course-577',
        cumulative: {
          total: 30,
          aCount: 18,
          abCount: 6,
          bCount: 6,
        },
        courseOfferings: [
          {
            termCode: '1264',
            cumulative: {
              total: 30,
              aCount: 18,
              abCount: 6,
              bCount: 6,
            },
            sections: [
              {
                sectionNumber: 1,
                instructors: [
                  {
                    id: 99,
                    name: 'Ada Lovelace',
                  },
                ],
                total: 30,
                aCount: 18,
                abCount: 6,
                bCount: 6,
              },
            ],
          },
        ],
      });
    }

    if (url === 'https://example.test/api/instructors/99') {
      return createJsonResponse({
        id: 99,
        name: 'Ada Lovelace',
        sections: [],
      });
    }

    if (url === 'https://example.test/api/instructors/99/grades') {
      return createJsonResponse({
        instructorId: 99,
        cumulative: {
          total: 30,
          aCount: 15,
          abCount: 10,
          bCount: 5,
        },
        courseOfferings: [
          {
            termCode: '1264',
            courseUuid: 'course-577',
            courseOfferingUuid: 'offering-577-1264',
            cumulative: {
              total: 30,
              aCount: 15,
              abCount: 10,
              bCount: 5,
            },
            sections: [
              {
                sectionNumber: 1,
                instructors: [
                  {
                    id: 99,
                    name: 'Ada Lovelace',
                  },
                ],
                total: 30,
                aCount: 15,
                abCount: 10,
                bCount: 5,
              },
            ],
          },
        ],
      });
    }

    throw new Error(`Unexpected fetch URL: ${url}`);
  };

  try {
    const result = await runMadgradesImport({
      dbPath: fixture.dbPath,
      snapshotRoot,
      refreshApi: true,
      token: 'test-token',
      fetchImpl,
      baseUrl: 'https://example.test/api',
      now: new Date('2026-04-12T11:12:13.000Z'),
    });

    assert.equal(result.courses, 1);
    assert.equal(result.instructors, 1);

    const courseOverview = fixture.db.prepare(`
      SELECT course_grade_term_count, historical_student_count, historical_gpa
      FROM course_grade_overview_v
      WHERE madgrades_course_id = 1
    `).get();
    const instructorOverview = fixture.db.prepare(`
      SELECT instructor_grade_term_count, historical_student_count, overall_gpa
      FROM instructor_grade_overview_v
      WHERE madgrades_instructor_id = 99
    `).get();

    assert.deepEqual(courseOverview, {
      course_grade_term_count: 1,
      historical_student_count: 30,
      historical_gpa: 3.7,
    });
    assert.deepEqual(instructorOverview, {
      instructor_grade_term_count: 1,
      historical_student_count: 30,
      overall_gpa: 3.6666666666666665,
    });
  } finally {
    fixture.cleanup();
    await rm(snapshotRoot, { recursive: true, force: true });
  }
});

test('runMadgradesImport with refreshApi emits richer forward progress messages', async () => {
  const fixture = buildFixture();
  const snapshotRoot = await mkdtemp(path.join(os.tmpdir(), 'madgrades-import-refresh-progress-'));
  const { runMadgradesImport } = await loadImportRunner();
  const progressMessages = [];

  const fetchImpl = async (url) => {
    if (url === 'https://example.test/api/courses?per_page=200&page=1') {
      return createJsonResponse({
        results: [
          {
            uuid: 'course-577',
            number: '577',
            name: 'Algorithms for Large Data',
            subjects: [
              {
                code: '302',
                abbreviation: 'COMP SCI',
              },
            ],
          },
        ],
        currentPage: 1,
        totalPages: 1,
      });
    }

    if (url === 'https://example.test/api/instructors?per_page=200&page=1') {
      return createJsonResponse({
        results: [
          {
            id: 99,
            name: 'Ada Lovelace',
            url: 'https://example.test/api/instructors/99',
          },
        ],
        currentPage: 1,
        totalPages: 1,
      });
    }

    if (url === 'https://example.test/api/courses/course-577/grades') {
      return createJsonResponse({
        courseUuid: 'course-577',
        cumulative: {
          total: 30,
          A: 18,
          AB: 6,
          B: 6,
        },
        courseOfferings: [
          {
            termCode: '1264',
            cumulative: {
              total: 30,
              A: 18,
              AB: 6,
              B: 6,
            },
            sections: [
              {
                sectionNumber: 1,
                instructors: [
                  {
                    id: 99,
                    name: 'Ada Lovelace',
                  },
                ],
                total: 30,
                A: 18,
                AB: 6,
                B: 6,
              },
            ],
          },
        ],
      });
    }

    if (url === 'https://example.test/api/instructors/99/grades') {
      return createJsonResponse({
        instructorId: 99,
        cumulative: {
          total: 30,
          A: 15,
          AB: 10,
          B: 5,
        },
        courseOfferings: [
          {
            termCode: '1264',
            courseUuid: 'course-577',
            courseOfferingUuid: 'offering-577-1264',
            cumulative: {
              total: 30,
              A: 15,
              AB: 10,
              B: 5,
            },
            sections: [
              {
                sectionNumber: 1,
                instructors: [
                  {
                    id: 99,
                    name: 'Ada Lovelace',
                  },
                ],
                total: 30,
                A: 15,
                AB: 10,
                B: 5,
              },
            ],
          },
        ],
      });
    }

    throw new Error(`Unexpected fetch URL: ${url}`);
  };

  try {
    await runMadgradesImport({
      dbPath: fixture.dbPath,
      snapshotRoot,
      refreshApi: true,
      token: 'test-token',
      fetchImpl,
      baseUrl: 'https://example.test/api',
      now: new Date('2026-04-12T13:14:15.000Z'),
      onProgress(message) {
        progressMessages.push(message);
      },
    });

    assert.ok(
      progressMessages.some((message) => /Loaded \d+ local courses and \d+ local instructors\./.test(message)),
      `expected local identity counts in progress output, got: ${progressMessages.join(' | ')}`,
    );
    assert.ok(
      progressMessages.some((message) => /Fetched Madgrades indexes: \d+ courses, \d+ instructors\./.test(message)),
      `expected remote index counts in progress output, got: ${progressMessages.join(' | ')}`,
    );
    assert.ok(progressMessages.includes('Matching local records against Madgrades indexes...'));
    assert.ok(
      progressMessages.some((message) => /Deduped to \d+ unique course fetches and \d+ unique instructor fetches\./.test(message)),
      `expected dedupe counts in progress output, got: ${progressMessages.join(' | ')}`,
    );
    assert.ok(
      progressMessages.some((message) => /Normalizing \d+ matched courses\.\.\./.test(message)),
      `expected course normalization progress output, got: ${progressMessages.join(' | ')}`,
    );
    assert.ok(
      progressMessages.some((message) => /Prepared snapshot rows:/.test(message)),
      `expected snapshot row summary in progress output, got: ${progressMessages.join(' | ')}`,
    );
  } finally {
    fixture.cleanup();
    await rm(snapshotRoot, { recursive: true, force: true });
  }
});

test('runMadgradesImport with refreshApi reuses list metadata and skips live detail endpoints when grades endpoints are sufficient', async () => {
  const fixture = buildFixture();
  const snapshotRoot = await mkdtemp(path.join(os.tmpdir(), 'madgrades-import-refresh-skip-details-'));
  const { runMadgradesImport } = await loadImportRunner();
  const fetchCalls = [];

  const fetchImpl = async (url) => {
    fetchCalls.push(url);

    if (url === 'https://example.test/api/courses?per_page=200&page=1') {
      return createJsonResponse({
        results: [
          {
            uuid: 'course-577',
            number: '577',
            name: 'Algorithms for Large Data',
            subjects: [{ code: '302', abbreviation: 'COMP SCI' }],
          },
        ],
        currentPage: 1,
        totalPages: 1,
      });
    }

    if (url === 'https://example.test/api/instructors?per_page=200&page=1') {
      return createJsonResponse({
        results: [
          {
            id: 99,
            name: 'Ada Lovelace',
            url: 'https://example.test/api/instructors/99',
          },
        ],
        currentPage: 1,
        totalPages: 1,
      });
    }

    if (url === 'https://example.test/api/courses/course-577/grades') {
      return createJsonResponse({
        courseUuid: 'course-577',
        cumulative: { total: 30, aCount: 18, abCount: 6, bCount: 6 },
        courseOfferings: [
          {
            termCode: '1264',
            cumulative: { total: 30, aCount: 18, abCount: 6, bCount: 6 },
            sections: [
              {
                sectionNumber: 1,
                instructors: [{ id: 99, name: 'Ada Lovelace' }],
                total: 30,
                aCount: 18,
                abCount: 6,
                bCount: 6,
              },
            ],
          },
        ],
      });
    }

    if (url === 'https://example.test/api/instructors/99/grades') {
      return createJsonResponse({
        instructorId: 99,
        cumulative: { total: 30, aCount: 15, abCount: 10, bCount: 5 },
        courseOfferings: [
          {
            termCode: '1264',
            courseUuid: 'course-577',
            courseOfferingUuid: 'offering-577-1264',
            cumulative: { total: 30, aCount: 15, abCount: 10, bCount: 5 },
            sections: [
              {
                sectionNumber: 1,
                instructors: [{ id: 99, name: 'Ada Lovelace' }],
                total: 30,
                aCount: 15,
                abCount: 10,
                bCount: 5,
              },
            ],
          },
        ],
      });
    }

    throw new Error(`Unexpected fetch URL: ${url}`);
  };

  try {
    const result = await runMadgradesImport({
      dbPath: fixture.dbPath,
      snapshotRoot,
      refreshApi: true,
      token: 'test-token',
      fetchImpl,
      baseUrl: 'https://example.test/api',
      now: new Date('2026-04-12T12:13:14.000Z'),
    });

    assert.equal(result.courses, 1);
    assert.equal(result.instructors, 1);
    assert.deepEqual(fetchCalls, [
      'https://example.test/api/courses?per_page=200&page=1',
      'https://example.test/api/instructors?per_page=200&page=1',
      'https://example.test/api/courses/course-577/grades',
      'https://example.test/api/instructors/99/grades',
    ]);
  } finally {
    fixture.cleanup();
    await rm(snapshotRoot, { recursive: true, force: true });
  }
});

test('runMadgradesImport with refreshApi overlaps course-grade and instructor-grade fetch phases', async () => {
  const fixture = buildFixture();
  const snapshotRoot = await mkdtemp(path.join(os.tmpdir(), 'madgrades-import-refresh-phase-overlap-'));
  const { runMadgradesImport } = await loadImportRunner();
  const events = [];

  const fetchImpl = async (url) => {
    if (url === 'https://example.test/api/courses?per_page=200&page=1') {
      return createJsonResponse({
        results: [
          {
            uuid: 'course-577',
            number: '577',
            name: 'Algorithms for Large Data',
            subjects: [{ code: '302', abbreviation: 'COMP SCI' }],
          },
        ],
        currentPage: 1,
        totalPages: 1,
      });
    }

    if (url === 'https://example.test/api/instructors?per_page=200&page=1') {
      return createJsonResponse({
        results: [
          {
            id: 99,
            name: 'Ada Lovelace',
            url: 'https://example.test/api/instructors/99',
          },
        ],
        currentPage: 1,
        totalPages: 1,
      });
    }

    if (url === 'https://example.test/api/courses/course-577/grades') {
      events.push('start:course-grades');
      await delay(60);
      events.push('finish:course-grades');
      return createJsonResponse({
        courseUuid: 'course-577',
        cumulative: { total: 30, aCount: 18, abCount: 6, bCount: 6 },
        courseOfferings: [
          {
            termCode: '1264',
            cumulative: { total: 30, aCount: 18, abCount: 6, bCount: 6 },
            sections: [
              {
                sectionNumber: 1,
                instructors: [{ id: 99, name: 'Ada Lovelace' }],
                total: 30,
                aCount: 18,
                abCount: 6,
                bCount: 6,
              },
            ],
          },
        ],
      });
    }

    if (url === 'https://example.test/api/instructors/99/grades') {
      events.push('start:instructor-grades');
      await delay(60);
      events.push('finish:instructor-grades');
      return createJsonResponse({
        instructorId: 99,
        cumulative: { total: 30, aCount: 15, abCount: 10, bCount: 5 },
        courseOfferings: [
          {
            termCode: '1264',
            courseUuid: 'course-577',
            courseOfferingUuid: 'offering-577-1264',
            cumulative: { total: 30, aCount: 15, abCount: 10, bCount: 5 },
            sections: [
              {
                sectionNumber: 1,
                instructors: [{ id: 99, name: 'Ada Lovelace' }],
                total: 30,
                aCount: 15,
                abCount: 10,
                bCount: 5,
              },
            ],
          },
        ],
      });
    }

    throw new Error(`Unexpected fetch URL: ${url}`);
  };

  try {
    await runMadgradesImport({
      dbPath: fixture.dbPath,
      snapshotRoot,
      refreshApi: true,
      token: 'test-token',
      fetchImpl,
      baseUrl: 'https://example.test/api',
      now: new Date('2026-04-12T12:45:00.000Z'),
    });

    assert.ok(
      events.some(
        (event, index) => event.startsWith('start:') && events[index + 1]?.startsWith('start:'),
      ),
      `expected overlapping phase fetches, got event order: ${events.join(', ')}`,
    );
  } finally {
    fixture.cleanup();
    await rm(snapshotRoot, { recursive: true, force: true });
  }
});

test('runMadgradesImport with refreshApi matches cross-listed local courses through course_cross_listings aliases', async () => {
  const fixture = buildCrossListedAliasFixture();
  const snapshotRoot = await mkdtemp(path.join(os.tmpdir(), 'madgrades-import-refresh-cross-listed-'));
  const { runMadgradesImport } = await loadImportRunner();

  const fetchImpl = async (url) => {
    if (url === 'https://example.test/api/courses?per_page=200&page=1') {
      return createJsonResponse({
        results: [
          {
            uuid: 'course-math-577',
            subject: '640',
            number: '577',
            name: 'Algorithms for Large Data',
          },
        ],
        currentPage: 1,
        totalPages: 1,
      });
    }

    if (url === 'https://example.test/api/instructors?per_page=200&page=1') {
      return createJsonResponse({
        results: [
          {
            id: 99,
            name: 'Ada Lovelace',
            url: 'https://example.test/api/instructors/99',
          },
        ],
        currentPage: 1,
        totalPages: 1,
      });
    }

    if (url === 'https://example.test/api/courses/course-math-577') {
      return createJsonResponse({
        course: {
          uuid: 'course-math-577',
          subject: '640',
          number: '577',
          abbreviation: 'MATH 577',
        },
        grades: [
          {
            uuid: 'course-grade-math-577',
            term: '1264',
            average_gpa: 3.7,
            distributions: {
              A: 18,
              AB: 6,
              B: 6,
            },
          },
        ],
        offerings: [
          {
            uuid: 'course-offering-math-577',
            instructor_id: 99,
            term: '1264',
            section_type: 'LEC',
            student_count: 30,
            average_gpa: 3.7,
          },
        ],
      });
    }

    if (url === 'https://example.test/api/instructors/99/grades') {
      return createJsonResponse({
        instructorId: 99,
        cumulative: { total: 30, aCount: 15, abCount: 10, bCount: 5 },
        courseOfferings: [
          {
            termCode: '1264',
            courseUuid: 'course-math-577',
            courseOfferingUuid: 'course-offering-math-577',
            cumulative: { total: 30, aCount: 15, abCount: 10, bCount: 5 },
            sections: [
              {
                sectionNumber: 1,
                instructors: [{ id: 99, name: 'Ada Lovelace' }],
                total: 30,
                aCount: 15,
                abCount: 10,
                bCount: 5,
              },
            ],
          },
        ],
      });
    }

    throw new Error(`Unexpected fetch URL: ${url}`);
  };

  try {
    const result = await runMadgradesImport({
      dbPath: fixture.dbPath,
      snapshotRoot,
      refreshApi: true,
      token: 'test-token',
      fetchImpl,
      baseUrl: 'https://example.test/api',
      now: new Date('2026-04-12T08:09:10.000Z'),
    });

    assert.equal(result.courses, 1);
    assert.equal(result.courseMatches, 1);
    assert.deepEqual(
      fixture.db.prepare(`
        SELECT match_status, madgrades_course_id
        FROM madgrades_course_matches
        WHERE term_code = ? AND course_id = ?
      `).get('1272', '005770'),
      {
        match_status: 'matched',
        madgrades_course_id: 1,
      },
    );
    assert.deepEqual(
      fixture.db.prepare(`
        SELECT subject_code, catalog_number, course_designation
        FROM madgrades_courses
        WHERE madgrades_course_id = 1
      `).get(),
      {
        subject_code: '640',
        catalog_number: '577',
        course_designation: 'MATH 577',
      },
    );
  } finally {
    fixture.cleanup();
    await rm(snapshotRoot, { recursive: true, force: true });
  }
});

test('runMadgradesImport with refreshApi dedupes normalized course offerings at the schema grain', async () => {
  const fixture = buildFixture();
  const snapshotRoot = await mkdtemp(path.join(os.tmpdir(), 'madgrades-import-refresh-offering-dedupe-'));
  const { runMadgradesImport } = await loadImportRunner();

  const fetchImpl = async (url) => {
    if (url === 'https://example.test/api/courses?per_page=200&page=1') {
      return createJsonResponse({
        results: [
          {
            uuid: 'course-577',
            subject: '302',
            number: '577',
            name: 'Algorithms for Large Data',
          },
        ],
        currentPage: 1,
        totalPages: 1,
      });
    }

    if (url === 'https://example.test/api/instructors?per_page=200&page=1') {
      return createJsonResponse({
        results: [
          {
            id: 99,
            name: 'Ada Lovelace',
            url: 'https://example.test/api/instructors/99',
          },
        ],
        currentPage: 1,
        totalPages: 1,
      });
    }

    if (url === 'https://example.test/api/courses/course-577') {
      return createJsonResponse({
        course: {
          uuid: 'course-577',
          subject: '302',
          number: '577',
          abbreviation: 'COMP SCI 577',
        },
        grades: [
          {
            uuid: 'course-grade-577',
            term: '1264',
            average_gpa: 3.7,
            distributions: {
              A: 18,
              AB: 6,
              B: 6,
            },
          },
        ],
        offerings: [
          {
            uuid: 'course-offering-577-a',
            instructor_id: 99,
            term: '1264',
            section_type: 'LEC',
            student_count: 30,
            average_gpa: 3.7,
          },
          {
            uuid: 'course-offering-577-b',
            instructor_id: 99,
            term: '1264',
            section_type: 'LEC',
            student_count: 30,
            average_gpa: 3.7,
          },
        ],
      });
    }

    if (url === 'https://example.test/api/instructors/99/grades') {
      return createJsonResponse({
        instructorId: 99,
        cumulative: { total: 60, aCount: 30, abCount: 20, bCount: 10 },
        courseOfferings: [
          {
            termCode: '1264',
            courseUuid: 'course-577',
            courseOfferingUuid: 'course-offering-577-a',
            cumulative: { total: 30, aCount: 15, abCount: 10, bCount: 5 },
            sections: [
              {
                sectionNumber: 1,
                instructors: [{ id: 99, name: 'Ada Lovelace' }],
                total: 30,
                aCount: 15,
                abCount: 10,
                bCount: 5,
              },
            ],
          },
          {
            termCode: '1264',
            courseUuid: 'course-577',
            courseOfferingUuid: 'course-offering-577-b',
            cumulative: { total: 30, aCount: 15, abCount: 10, bCount: 5 },
            sections: [
              {
                sectionNumber: 2,
                instructors: [{ id: 99, name: 'Ada Lovelace' }],
                total: 30,
                aCount: 15,
                abCount: 10,
                bCount: 5,
              },
            ],
          },
        ],
      });
    }

    throw new Error(`Unexpected fetch URL: ${url}`);
  };

  try {
    const result = await runMadgradesImport({
      dbPath: fixture.dbPath,
      snapshotRoot,
      refreshApi: true,
      token: 'test-token',
      fetchImpl,
      baseUrl: 'https://example.test/api',
      now: new Date('2026-04-12T09:10:11.000Z'),
    });

    assert.equal(result.courseOfferings, 1);
    assert.deepEqual(
      fixture.db.prepare(`
        SELECT
          (SELECT COUNT(*) FROM madgrades_course_offerings) AS course_offerings,
          (SELECT COUNT(*) FROM madgrades_course_grades) AS course_grades
      `).get(),
      {
        course_offerings: 1,
        course_grades: 1,
      },
    );
  } finally {
    fixture.cleanup();
    await rm(snapshotRoot, { recursive: true, force: true });
  }
});
