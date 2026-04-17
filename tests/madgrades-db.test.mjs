import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import { buildCourseDbFixture, makeCourse } from './helpers/madgrades-db-fixture.mjs';
import { writeMadgradesSnapshot } from '../src/madgrades/snapshot-helpers.mjs';

function buildInvalidMadgradesSnapshot() {
  return {
    manifest: {
      generatedAt: '2024-01-16T00:00:00Z',
      source: 'fixture',
      sourceTermCode: '1272',
      matchedCourseCount: 1,
      matchedInstructorCount: 0,
    },
    courses: [],
    courseGrades: [],
    courseOfferings: [],
    courseGradeDistributions: [],
    instructors: [],
    instructorGrades: [],
    instructorGradeDistributions: [],
    matchReport: {
      courseMatches: [
        {
          term_code: '1272',
          course_id: '005770',
          madgrades_course_id: 1,
          match_status: 'matched',
          matched_at: '2024-01-16T00:00:00Z',
        },
      ],
      instructorMatches: [],
    },
  };
}

function buildMadgradesOverviewFixture() {
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
    madgradesSnapshot: {
      manifest: {
        generatedAt: '2024-01-16T00:00:00Z',
        source: 'fixture',
        sourceTermCode: '1272',
        matchedCourseCount: 1,
        matchedInstructorCount: 1,
      },
      courses: [
        {
          madgrades_course_id: 1,
          subject_code: '302',
          catalog_number: '577',
          course_designation: 'COMP SCI 577',
        },
      ],
      courseGrades: [
        {
          madgrades_course_grade_id: 1,
          madgrades_course_id: 1,
          term_code: '1264',
          student_count: 40,
          avg_gpa: 3.6,
        },
      ],
      courseOfferings: [
        {
          madgrades_course_offering_id: 1,
          madgrades_course_id: 1,
          madgrades_instructor_id: 1,
          term_code: '1264',
          section_type: 'LEC',
          student_count: 40,
          avg_gpa: 3.6,
        },
      ],
      courseGradeDistributions: [
        {
          madgradesCourseGradeId: 1,
          grades: {
            A: 20,
            AB: 20,
          },
        },
      ],
      instructors: [
        {
          madgrades_instructor_id: 1,
          display_name: 'Ada Lovelace',
        },
      ],
      instructorGrades: [
        {
          madgrades_instructor_grade_id: 1,
          madgrades_instructor_id: 1,
          term_code: '1264',
          student_count: 40,
          avg_gpa: 3.6,
        },
      ],
      instructorGradeDistributions: [
        {
          madgradesInstructorGradeId: 1,
          grades: {
            A: 20,
            AB: 20,
          },
        },
      ],
      matchReport: {
        courseMatches: [
          {
            term_code: '1272',
            course_id: '005770',
            madgrades_course_id: 1,
            match_status: 'matched',
            matched_at: '2024-01-16T00:00:00Z',
          },
        ],
        instructorMatches: [
          {
            instructor_key: 'ada@example.edu',
            madgrades_instructor_id: 1,
            match_status: 'matched',
            matched_at: '2024-01-16T00:00:00Z',
          },
        ],
      },
    },
  });
}

function seedMadgradesMatchRowsWithoutHistory(db) {
  const instructorKey = db.prepare(`
    SELECT instructor_key
    FROM instructors
    WHERE email = ?
  `).pluck().get('ada@example.edu');

  db.prepare(`
    INSERT INTO madgrades_courses (
      madgrades_course_id,
      subject_code,
      catalog_number,
      course_designation
    ) VALUES (?, ?, ?, ?)
  `).run(11, '302', '577', 'COMP SCI 577');

  db.prepare(`
    INSERT INTO madgrades_instructors (
      madgrades_instructor_id,
      display_name
    ) VALUES (?, ?)
  `).run(11, 'Ada Lovelace');

  db.prepare(`
    INSERT INTO madgrades_course_matches (
      term_code,
      course_id,
      madgrades_course_id,
      match_status,
      matched_at
    ) VALUES (?, ?, ?, ?, ?)
  `).run('1272', '005770', 11, 'matched', '2024-01-16T00:00:00Z');

  db.prepare(`
    INSERT INTO madgrades_instructor_matches (
      instructor_key,
      madgrades_instructor_id,
      match_status,
      matched_at
    ) VALUES (?, ?, ?, ?)
  `).run(instructorKey, 11, 'matched', '2024-01-16T00:00:00Z');

  db.prepare(`
    INSERT INTO madgrades_refresh_runs (
      madgrades_refresh_run_id,
      snapshot_run_at,
      last_refreshed_at,
      source_term_code,
      notes
    ) VALUES (?, ?, ?, ?, ?)
  `).run(11, '2024-01-15T00:00:00Z', '2024-01-16T00:00:00Z', '1264', 'instructor only seed');

  db.prepare(`
    INSERT INTO madgrades_instructor_grades (
      madgrades_instructor_grade_id,
      madgrades_refresh_run_id,
      madgrades_instructor_id,
      term_code,
      student_count,
      avg_gpa
    ) VALUES (?, ?, ?, ?, ?, ?)
  `).run(11, 11, 11, '1264', 25, 3.2);
}

function seedMadgradesMatchRowsWithoutSameCourseHistory(db) {
  const instructorKey = db.prepare(`
    SELECT instructor_key
    FROM instructors
    WHERE email = ?
  `).pluck().get('ada@example.edu');

  db.prepare(`
    INSERT INTO madgrades_courses (
      madgrades_course_id,
      subject_code,
      catalog_number,
      course_designation
    ) VALUES (?, ?, ?, ?)
  `).run(13, '302', '577', 'COMP SCI 577');

  db.prepare(`
    INSERT INTO madgrades_instructors (
      madgrades_instructor_id,
      display_name
    ) VALUES (?, ?)
  `).run(13, 'Ada Lovelace');

  db.prepare(`
    INSERT INTO madgrades_instructors (
      madgrades_instructor_id,
      display_name
    ) VALUES (?, ?)
  `).run(14, 'Grace Hopper');

  db.prepare(`
    INSERT INTO madgrades_course_matches (
      term_code,
      course_id,
      madgrades_course_id,
      match_status,
      matched_at
    ) VALUES (?, ?, ?, ?, ?)
  `).run('1272', '005770', 13, 'matched', '2024-01-16T00:00:00Z');

  db.prepare(`
    INSERT INTO madgrades_instructor_matches (
      instructor_key,
      madgrades_instructor_id,
      match_status,
      matched_at
    ) VALUES (?, ?, ?, ?)
  `).run(instructorKey, 13, 'matched', '2024-01-16T00:00:00Z');

  db.prepare(`
    INSERT INTO madgrades_refresh_runs (
      madgrades_refresh_run_id,
      snapshot_run_at,
      last_refreshed_at,
      source_term_code,
      notes
    ) VALUES (?, ?, ?, ?, ?)
  `).run(13, '2024-01-15T00:00:00Z', '2024-01-16T00:00:00Z', '1264', 'course history from other instructor');

  db.prepare(`
    INSERT INTO madgrades_course_grades (
      madgrades_course_grade_id,
      madgrades_refresh_run_id,
      madgrades_course_id,
      term_code,
      student_count,
      avg_gpa
    ) VALUES (?, ?, ?, ?, ?, ?)
  `).run(13, 13, 13, '1264', 30, 3.7);

  db.prepare(`
    INSERT INTO madgrades_course_offerings (
      madgrades_course_offering_id,
      madgrades_course_id,
      madgrades_instructor_id,
      term_code,
      section_type,
      student_count,
      avg_gpa
    ) VALUES (?, ?, ?, ?, ?, ?, ?)
  `).run(13, 13, 14, '1264', 'LEC', 30, 3.7);
}

function seedMadgradesMatchRowsWithoutAnyHistory(db) {
  const instructorKey = db.prepare(`
    SELECT instructor_key
    FROM instructors
    WHERE email = ?
  `).pluck().get('ada@example.edu');

  db.prepare(`
    INSERT INTO madgrades_courses (
      madgrades_course_id,
      subject_code,
      catalog_number,
      course_designation
    ) VALUES (?, ?, ?, ?)
  `).run(12, '302', '577', 'COMP SCI 577');

  db.prepare(`
    INSERT INTO madgrades_instructors (
      madgrades_instructor_id,
      display_name
    ) VALUES (?, ?)
  `).run(12, 'Ada Lovelace');

  db.prepare(`
    INSERT INTO madgrades_course_matches (
      term_code,
      course_id,
      madgrades_course_id,
      match_status,
      matched_at
    ) VALUES (?, ?, ?, ?, ?)
  `).run('1272', '005770', 12, 'matched', '2024-01-16T00:00:00Z');

  db.prepare(`
    INSERT INTO madgrades_instructor_matches (
      instructor_key,
      madgrades_instructor_id,
      match_status,
      matched_at
    ) VALUES (?, ?, ?, ?)
  `).run(instructorKey, 12, 'matched', '2024-01-16T00:00:00Z');
}

function seedMadgradesRows(db) {
  const instructorKey = db.prepare(`
    SELECT instructor_key
    FROM instructors
    WHERE email = ?
  `).pluck().get('ada@example.edu');

  db.prepare(`
    INSERT INTO madgrades_refresh_runs (
      madgrades_refresh_run_id,
      snapshot_run_at,
      last_refreshed_at,
      source_term_code,
      notes
    ) VALUES (?, ?, ?, ?, ?)
  `).run(1, '2024-01-15T00:00:00Z', '2024-01-16T00:00:00Z', '1264', 'seed');

  db.prepare(`
    INSERT INTO madgrades_courses (
      madgrades_course_id,
      subject_code,
      catalog_number,
      course_designation
    ) VALUES (?, ?, ?, ?)
  `).run(1, '302', '577', 'COMP SCI 577');

  db.prepare(`
    INSERT INTO madgrades_instructors (
      madgrades_instructor_id,
      display_name
    ) VALUES (?, ?)
  `).run(1, 'Ada Lovelace');

  db.prepare(`
    INSERT INTO madgrades_course_matches (
      term_code,
      course_id,
      madgrades_course_id,
      match_status,
      matched_at
    ) VALUES (?, ?, ?, ?, ?)
  `).run('1272', '005770', 1, 'matched', '2024-01-16T00:00:00Z');

  db.prepare(`
    INSERT INTO madgrades_instructor_matches (
      instructor_key,
      madgrades_instructor_id,
      match_status,
      matched_at
    ) VALUES (?, ?, ?, ?)
  `).run(instructorKey, 1, 'matched', '2024-01-16T00:00:00Z');

  db.prepare(`
    INSERT INTO madgrades_course_grades (
      madgrades_course_grade_id,
      madgrades_refresh_run_id,
      madgrades_course_id,
      term_code,
      student_count,
      avg_gpa
    ) VALUES (?, ?, ?, ?, ?, ?)
  `).run(1, 1, 1, '1262', 20, 3.1);

  db.prepare(`
    INSERT INTO madgrades_course_grades (
      madgrades_course_grade_id,
      madgrades_refresh_run_id,
      madgrades_course_id,
      term_code,
      student_count,
      avg_gpa
    ) VALUES (?, ?, ?, ?, ?, ?)
  `).run(2, 1, 1, '1264', 40, 3.6);

  db.prepare(`
    INSERT INTO madgrades_instructor_grades (
      madgrades_instructor_grade_id,
      madgrades_refresh_run_id,
      madgrades_instructor_id,
      term_code,
      student_count,
      avg_gpa
    ) VALUES (?, ?, ?, ?, ?, ?)
  `).run(1, 1, 1, '1260', 15, 3.0);

  db.prepare(`
    INSERT INTO madgrades_instructor_grades (
      madgrades_instructor_grade_id,
      madgrades_refresh_run_id,
      madgrades_instructor_id,
      term_code,
      student_count,
      avg_gpa
    ) VALUES (?, ?, ?, ?, ?, ?)
  `).run(2, 1, 1, '1264', 45, 3.4);

  db.prepare(`
    INSERT INTO madgrades_course_offerings (
      madgrades_course_offering_id,
      madgrades_course_id,
      madgrades_instructor_id,
      term_code,
      section_type,
      student_count,
      avg_gpa
    ) VALUES (?, ?, ?, ?, ?, ?, ?)
  `).run(1, 1, 1, '1262', 'LEC', 20, 3.1);

  db.prepare(`
    INSERT INTO madgrades_course_offerings (
      madgrades_course_offering_id,
      madgrades_course_id,
      madgrades_instructor_id,
      term_code,
      section_type,
      student_count,
      avg_gpa
    ) VALUES (?, ?, ?, ?, ?, ?, ?)
  `).run(2, 1, 1, '1264', 'LEC', 40, 3.6);
}

function seedDuplicateMadgradesRefreshRows(db) {
  db.prepare(`
    INSERT INTO madgrades_refresh_runs (
      madgrades_refresh_run_id,
      snapshot_run_at,
      last_refreshed_at,
      source_term_code,
      notes
    ) VALUES (?, ?, ?, ?, ?)
  `).run(2, '2024-02-15T00:00:00Z', '2024-02-16T00:00:00Z', '1264', 'duplicate refresh');

  db.prepare(`
    INSERT INTO madgrades_course_grades (
      madgrades_course_grade_id,
      madgrades_refresh_run_id,
      madgrades_course_id,
      term_code,
      student_count,
      avg_gpa
    ) VALUES (?, ?, ?, ?, ?, ?)
  `).run(3, 2, 1, '1262', 22, 3.9);

  db.prepare(`
    INSERT INTO madgrades_course_grades (
      madgrades_course_grade_id,
      madgrades_refresh_run_id,
      madgrades_course_id,
      term_code,
      student_count,
      avg_gpa
    ) VALUES (?, ?, ?, ?, ?, ?)
  `).run(4, 2, 1, '1264', 41, 3.8);

  db.prepare(`
    INSERT INTO madgrades_instructor_grades (
      madgrades_instructor_grade_id,
      madgrades_refresh_run_id,
      madgrades_instructor_id,
      term_code,
      student_count,
      avg_gpa
    ) VALUES (?, ?, ?, ?, ?, ?)
  `).run(3, 2, 1, '1260', 17, 3.7);

  db.prepare(`
    INSERT INTO madgrades_instructor_grades (
      madgrades_instructor_grade_id,
      madgrades_refresh_run_id,
      madgrades_instructor_id,
      term_code,
      student_count,
      avg_gpa
    ) VALUES (?, ?, ?, ?, ?, ?)
  `).run(4, 2, 1, '1264', 46, 3.9);
}

test('current_term_section_instructor_grade_overview_v exposes current sections with weighted historical madgrades context', () => {
  const fixture = buildMadgradesOverviewFixture();

  try {
    seedMadgradesRows(fixture.db);

    const rows = fixture.db.prepare(`
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
    `).all('1272', '005770', 57701);

    assert.deepEqual(rows, [
      {
        course_designation: 'COMP SCI 577',
        instructor_display_name: 'Ada Lovelace',
        same_course_prior_offering_count: 2,
        same_course_student_count: 60,
        same_course_gpa: 3.433333333333333,
        course_historical_gpa: 3.433333333333333,
        instructor_match_status: 'matched',
      },
    ]);
  } finally {
    fixture.cleanup();
  }
});

test('current-term madgrades overview keeps matched sections when only instructor-wide history exists', () => {
  const fixture = buildMadgradesOverviewFixture();

  try {
    seedMadgradesMatchRowsWithoutHistory(fixture.db);

    const courseOverview = fixture.db.prepare(`
      SELECT course_grade_term_count, historical_student_count, historical_gpa
      FROM course_grade_overview_v
      WHERE madgrades_course_id = ?
    `).get(11);

    const instructorOverview = fixture.db.prepare(`
      SELECT instructor_grade_term_count, historical_student_count, overall_gpa
      FROM instructor_grade_overview_v
      WHERE madgrades_instructor_id = ?
    `).get(11);

    const currentTermOverview = fixture.db.prepare(`
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

    const currentTermOverviewAllFields = fixture.db.prepare(`
      SELECT *
      FROM current_term_section_instructor_grade_overview_v
      WHERE term_code = ? AND course_id = ? AND section_class_number = ?
    `).get('1272', '005770', 57701);

    assert.deepEqual(courseOverview, {
      course_grade_term_count: 0,
      historical_student_count: 0,
      historical_gpa: null,
    });
    assert.deepEqual(instructorOverview, {
      instructor_grade_term_count: 1,
      historical_student_count: 25,
      overall_gpa: 3.2,
    });
    assert.deepEqual(currentTermOverview, {
      course_designation: 'COMP SCI 577',
      instructor_display_name: 'Ada Lovelace',
      same_course_prior_offering_count: null,
      same_course_student_count: null,
      same_course_gpa: null,
      course_historical_gpa: null,
      instructor_match_status: 'matched',
    });
    assert.equal(
      Object.hasOwn(currentTermOverviewAllFields, 'instructor_overall_gpa'),
      false,
    );
  } finally {
    fixture.cleanup();
  }
});

test('current-term madgrades overview preserves course history when same-course instructor history is absent', () => {
  const fixture = buildMadgradesOverviewFixture();

  try {
    seedMadgradesMatchRowsWithoutSameCourseHistory(fixture.db);

    const currentTermOverview = fixture.db.prepare(`
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

    assert.deepEqual(currentTermOverview, {
      course_designation: 'COMP SCI 577',
      instructor_display_name: 'Ada Lovelace',
      same_course_prior_offering_count: null,
      same_course_student_count: null,
      same_course_gpa: null,
      course_historical_gpa: 3.7,
      instructor_match_status: 'matched',
    });
  } finally {
    fixture.cleanup();
  }
});

test('current-term madgrades overview keeps matched sections when no history exists', () => {
  const fixture = buildMadgradesOverviewFixture();

  try {
    seedMadgradesMatchRowsWithoutAnyHistory(fixture.db);

    const courseOverview = fixture.db.prepare(`
      SELECT course_grade_term_count, historical_student_count, historical_gpa
      FROM course_grade_overview_v
      WHERE madgrades_course_id = ?
    `).get(12);

    const instructorOverview = fixture.db.prepare(`
      SELECT instructor_grade_term_count, historical_student_count, overall_gpa
      FROM instructor_grade_overview_v
      WHERE madgrades_instructor_id = ?
    `).get(12);

    const currentTermOverview = fixture.db.prepare(`
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

    assert.deepEqual(courseOverview, {
      course_grade_term_count: 0,
      historical_student_count: 0,
      historical_gpa: null,
    });
    assert.deepEqual(instructorOverview, {
      instructor_grade_term_count: 0,
      historical_student_count: 0,
      overall_gpa: null,
    });
    assert.deepEqual(currentTermOverview, {
      course_designation: 'COMP SCI 577',
      instructor_display_name: 'Ada Lovelace',
      same_course_prior_offering_count: null,
      same_course_student_count: null,
      same_course_gpa: null,
      course_historical_gpa: null,
      instructor_match_status: 'matched',
    });
  } finally {
    fixture.cleanup();
  }
});

test('current term madgrades overview dedupes duplicate historical terms across refresh runs', () => {
  const fixture = buildMadgradesOverviewFixture();

  try {
    seedMadgradesRows(fixture.db);
    seedDuplicateMadgradesRefreshRows(fixture.db);

    const courseOverview = fixture.db.prepare(`
      SELECT course_grade_term_count, historical_student_count, historical_gpa
      FROM course_grade_overview_v
      WHERE madgrades_course_id = ?
    `).get(1);

    const instructorOverview = fixture.db.prepare(`
      SELECT instructor_grade_term_count, historical_student_count, overall_gpa
      FROM instructor_grade_overview_v
      WHERE madgrades_instructor_id = ?
    `).get(1);

    const rows = fixture.db.prepare(`
      SELECT
        same_course_student_count,
        same_course_gpa,
        course_historical_gpa
      FROM current_term_section_instructor_grade_overview_v
      WHERE term_code = ? AND course_id = ? AND section_class_number = ?
    `).all('1272', '005770', 57701);

    assert.deepEqual(courseOverview, {
      course_grade_term_count: 2,
      historical_student_count: 63,
      historical_gpa: 3.834920634920634,
    });
    assert.deepEqual(instructorOverview, {
      instructor_grade_term_count: 2,
      historical_student_count: 63,
      overall_gpa: 3.846031746031746,
    });

    assert.deepEqual(rows, [
      {
        same_course_student_count: 60,
        same_course_gpa: 3.433333333333333,
        course_historical_gpa: 3.834920634920634,
      },
    ]);
  } finally {
    fixture.cleanup();
  }
});

test('buildMadgradesDb creates a standalone database with grade history and matches', async () => {
  const fixture = buildMadgradesOverviewFixture();

  try {
    const { buildMadgradesDb } = await import('../src/madgrades/build-madgrades-db.mjs');
    const madgradesDbPath = fixture.dbPath.replace(/\.sqlite$/, '-madgrades.sqlite');

    await buildMadgradesDb({
      courseDbPath: fixture.dbPath,
      outputDbPath: madgradesDbPath,
      snapshotRoot: fixture.fixtureRoot,
      refreshApi: false,
    });

    const standaloneDb = new (await import('better-sqlite3')).default(madgradesDbPath, { readonly: true });

    assert.equal(
      standaloneDb.prepare('SELECT COUNT(*) FROM madgrades_course_grades').pluck().get(),
      1,
    );
    assert.equal(
      standaloneDb.prepare('SELECT COUNT(*) FROM madgrades_course_matches').pluck().get(),
      1,
    );

    standaloneDb.close();
  } finally {
    fixture.cleanup();
  }
});

test('runMadgradesImport loads standalone madgrades schema when courseDbPath is provided', async () => {
  const fixture = buildMadgradesOverviewFixture();

  try {
    const [{ runMadgradesImport }, Database] = await Promise.all([
      import('../src/madgrades/import-runner.mjs'),
      import('better-sqlite3'),
    ]);
    const standaloneDbPath = fixture.dbPath.replace(/\.sqlite$/, '-standalone.sqlite');
    const standaloneDb = new Database.default(standaloneDbPath);

    try {
      standaloneDb.exec(readFileSync(new URL('../src/madgrades/schema.sql', import.meta.url), 'utf8'));
    } finally {
      standaloneDb.close();
    }

    await runMadgradesImport({
      dbPath: standaloneDbPath,
      courseDbPath: fixture.dbPath,
      snapshotRoot: fixture.fixtureRoot,
      refreshApi: false,
    });

    const importedDb = new Database.default(standaloneDbPath, { readonly: true });

    try {
      assert.equal(
        importedDb.prepare('SELECT COUNT(*) FROM madgrades_course_matches').pluck().get(),
        1,
      );
      assert.equal(
        importedDb.prepare('SELECT COUNT(*) FROM madgrades_course_grades').pluck().get(),
        1,
      );
    } finally {
      importedDb.close();
    }
  } finally {
    fixture.cleanup();
  }
});

test('buildMadgradesDb preserves the existing output when a rebuild fails', async () => {
  const fixture = buildMadgradesOverviewFixture();

  try {
    const { buildMadgradesDb } = await import('../src/madgrades/build-madgrades-db.mjs');
    const madgradesDbPath = fixture.dbPath.replace(/\.sqlite$/, '-madgrades.sqlite');

    await buildMadgradesDb({
      courseDbPath: fixture.dbPath,
      outputDbPath: madgradesDbPath,
      snapshotRoot: fixture.fixtureRoot,
      refreshApi: false,
    });

    await writeMadgradesSnapshot({
      snapshotRoot: fixture.fixtureRoot,
      snapshotId: '20260411T231405Z',
      snapshot: buildInvalidMadgradesSnapshot(),
    });

    await assert.rejects(
      buildMadgradesDb({
        courseDbPath: fixture.dbPath,
        outputDbPath: madgradesDbPath,
        snapshotRoot: fixture.fixtureRoot,
        refreshApi: false,
      }),
      /FOREIGN KEY constraint failed/,
    );

    const standaloneDb = new (await import('better-sqlite3')).default(madgradesDbPath, { readonly: true });

    try {
      assert.equal(
        standaloneDb.prepare('SELECT COUNT(*) FROM madgrades_course_grades').pluck().get(),
        1,
      );
      assert.equal(
        standaloneDb.prepare('SELECT COUNT(*) FROM madgrades_course_matches').pluck().get(),
        1,
      );
    } finally {
      standaloneDb.close();
    }
  } finally {
    fixture.cleanup();
  }
});

test('buildMadgradesDb rejects using the course DB path as the output path', async () => {
  const fixture = buildMadgradesOverviewFixture();

  try {
    const { buildMadgradesDb } = await import('../src/madgrades/build-madgrades-db.mjs');

    await assert.rejects(
      buildMadgradesDb({
        courseDbPath: fixture.dbPath,
        outputDbPath: fixture.dbPath,
        snapshotRoot: fixture.fixtureRoot,
        refreshApi: false,
      }),
      /outputDbPath must be different from courseDbPath/,
    );
  } finally {
    fixture.cleanup();
  }
});

test('documented Madgrades enrichment queries execute against the implemented overview views', () => {
  const fixture = buildMadgradesOverviewFixture();

  try {
    seedMadgradesRows(fixture.db);

    const courseRows = fixture.db.prepare(`
      SELECT course_designation, historical_gpa, historical_student_count, course_grade_term_count
      FROM course_grade_overview_v
      WHERE course_designation = 'COMP SCI 577'
    `).all();

    const historyRows = fixture.db.prepare(`
      SELECT course_designation, instructor_display_name, prior_offering_count,
             student_count, same_course_gpa
      FROM instructor_course_history_overview_v
      WHERE course_designation = 'COMP SCI 577'
      ORDER BY prior_offering_count DESC, student_count DESC
    `).all();

    const currentRows = fixture.db.prepare(`
      SELECT course_designation, section_number, instructor_display_name,
             same_course_prior_offering_count, same_course_student_count,
             same_course_gpa, course_historical_gpa
      FROM current_term_section_instructor_grade_overview_v
      WHERE course_designation = 'COMP SCI 577'
      ORDER BY same_course_prior_offering_count DESC, same_course_student_count DESC
    `).all();

    assert.equal(courseRows.length, 1);
    assert.equal(historyRows.length, 1);
    assert.equal(currentRows.length, 1);

    const queryingCourseDbDocs = readFileSync(
      new URL('../docs/querying-course-db.md', import.meta.url),
      'utf8',
    );

    assert.match(queryingCourseDbDocs, /current_term_section_instructor_grade_overview_v/);
    assert.match(queryingCourseDbDocs, /same_course_prior_offering_count/);
    assert.match(queryingCourseDbDocs, /same_course_student_count/);
    assert.match(queryingCourseDbDocs, /same_course_gpa/);
    assert.match(queryingCourseDbDocs, /course_historical_gpa/);
    assert.doesNotMatch(queryingCourseDbDocs, /\|\s*Historical instructor GPA baseline\s*\|\s*`instructor_grade_overview_v`\s*\|/);
    assert.doesNotMatch(queryingCourseDbDocs, /instructor_overall_gpa/);
  } finally {
    fixture.cleanup();
  }
});
