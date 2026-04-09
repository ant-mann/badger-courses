import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath, pathToFileURL } from 'node:url';

import Database from 'better-sqlite3';

const loadHelpers = () => import('../src/db/import-helpers.mjs');
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.join(__dirname, '..');
const schemaPath = path.join(__dirname, '../src/db/schema.sql');

function createSchemaDb() {
  const db = new Database(':memory:');
  db.exec(fs.readFileSync(schemaPath, 'utf8'));
  return db;
}

function writeJson(filePath, value) {
  fs.writeFileSync(filePath, JSON.stringify(value, null, 2));
}

function makeCourse({
  termCode,
  courseId,
  subjectCode,
  catalogNumber,
  courseDesignation,
  title,
}) {
  return {
    termCode,
    courseId,
    catalogNumber,
    courseDesignation,
    title,
    description: `${title} description`,
    minimumCredits: 3,
    maximumCredits: 3,
    enrollmentPrerequisites: null,
    currentlyTaught: true,
    lastTaught: '1264',
    subject: {
      subjectCode,
      shortDescription: subjectCode,
      description: `${subjectCode} subject`,
    },
  };
}

function buildCourseDbFixture({ courses, packageSnapshot }) {
  const fixtureRoot = fs.mkdtempSync(path.join(repoRoot, '.tmp-db-import-'));
  const fixtureDbDir = path.join(fixtureRoot, 'src', 'db');
  const fixtureDataDir = path.join(fixtureRoot, 'data');

  fs.mkdirSync(fixtureDbDir, { recursive: true });
  fs.mkdirSync(fixtureDataDir, { recursive: true });

  fs.copyFileSync(path.join(repoRoot, 'src/db/build-course-db.mjs'), path.join(fixtureDbDir, 'build-course-db.mjs'));
  fs.copyFileSync(path.join(repoRoot, 'src/db/import-helpers.mjs'), path.join(fixtureDbDir, 'import-helpers.mjs'));
  fs.copyFileSync(path.join(repoRoot, 'src/db/schema.sql'), path.join(fixtureDbDir, 'schema.sql'));

  writeJson(path.join(fixtureDataDir, 'fall-2026-courses.json'), courses);
  writeJson(path.join(fixtureDataDir, 'fall-2026-enrollment-packages.json'), packageSnapshot);

  execFileSync(process.execPath, [path.join(fixtureDbDir, 'build-course-db.mjs')], {
    cwd: fixtureRoot,
    stdio: 'pipe',
  });

  const db = new Database(path.join(fixtureDataDir, 'fall-2026.sqlite'), { readonly: true });

  return {
    db,
    cleanup() {
      db.close();
      fs.rmSync(fixtureRoot, { recursive: true, force: true });
    },
  };
}

async function loadBuildCourseDbModule() {
  const fixtureRoot = fs.mkdtempSync(path.join(repoRoot, '.tmp-db-module-'));
  const fixtureDbDir = path.join(fixtureRoot, 'src', 'db');
  const fixtureDataDir = path.join(fixtureRoot, 'data');

  fs.mkdirSync(fixtureDbDir, { recursive: true });
  fs.mkdirSync(fixtureDataDir, { recursive: true });

  fs.copyFileSync(path.join(repoRoot, 'src/db/build-course-db.mjs'), path.join(fixtureDbDir, 'build-course-db.mjs'));
  fs.copyFileSync(path.join(repoRoot, 'src/db/import-helpers.mjs'), path.join(fixtureDbDir, 'import-helpers.mjs'));
  fs.copyFileSync(path.join(repoRoot, 'src/db/schema.sql'), path.join(fixtureDbDir, 'schema.sql'));

  writeJson(path.join(fixtureDataDir, 'fall-2026-courses.json'), []);
  writeJson(path.join(fixtureDataDir, 'fall-2026-enrollment-packages.json'), {
    termCode: '1272',
    results: [],
  });

  const moduleUrl = `${pathToFileURL(path.join(fixtureDbDir, 'build-course-db.mjs')).href}?t=${Date.now()}`;
  const mod = await import(moduleUrl);

  return {
    mod,
    cleanup() {
      fs.rmSync(fixtureRoot, { recursive: true, force: true });
    },
  };
}

function seedCourseAvailability(db) {
  const insertCourse = db.prepare(`
    INSERT INTO courses (
      term_code, course_id, subject_code, subject_short_description, subject_description,
      catalog_number, course_designation, title, description, minimum_credits,
      maximum_credits, enrollment_prerequisites, currently_taught, last_taught
    ) VALUES (
      @term_code, @course_id, @subject_code, @subject_short_description, @subject_description,
      @catalog_number, @course_designation, @title, @description, @minimum_credits,
      @maximum_credits, @enrollment_prerequisites, @currently_taught, @last_taught
    )
  `);
  const insertPackage = db.prepare(`
    INSERT INTO packages (
      package_id, term_code, subject_code, course_id, package_last_updated, enrollment_class_number,
      package_status, package_available_seats, package_waitlist_total, online_only,
      is_asynchronous, open_seats, waitlist_current_size, capacity, currently_enrolled,
      has_open_seats, has_waitlist, is_full
    ) VALUES (
      @package_id, @term_code, @subject_code, @course_id, @package_last_updated, @enrollment_class_number,
      @package_status, @package_available_seats, @package_waitlist_total, @online_only,
      @is_asynchronous, @open_seats, @waitlist_current_size, @capacity, @currently_enrolled,
      @has_open_seats, @has_waitlist, @is_full
    )
  `);
  const insertSection = db.prepare(`
    INSERT INTO sections (
      package_id, section_class_number, term_code, course_id, section_number,
      section_type, instruction_mode, session_code, published, open_seats,
      waitlist_current_size, capacity, currently_enrolled, has_open_seats,
      has_waitlist, is_full
    ) VALUES (
      @package_id, @section_class_number, @term_code, @course_id, @section_number,
      @section_type, @instruction_mode, @session_code, @published, @open_seats,
      @waitlist_current_size, @capacity, @currently_enrolled, @has_open_seats,
      @has_waitlist, @is_full
    )
  `);

  const course = {
    term_code: '1272',
    course_id: '002983',
    subject_code: '232',
    subject_short_description: 'ACCT I S',
    subject_description: 'ACCOUNTING AND INFO SYSTEMS',
    catalog_number: '100',
    course_designation: 'ACCT I S 100',
    title: 'Introductory Financial Accounting',
    description: 'Accounting intro',
    minimum_credits: 3,
    maximum_credits: 3,
    enrollment_prerequisites: null,
    currently_taught: 1,
    last_taught: '1264',
  };
  const stalePackage = {
    package_id: 'pkg-old',
    term_code: '1272',
    subject_code: '232',
    course_id: '002983',
    package_last_updated: 1000,
    enrollment_class_number: 31284,
    package_status: 'OPEN',
    package_available_seats: 40,
    package_waitlist_total: 0,
    online_only: 0,
    is_asynchronous: 0,
    open_seats: 40,
    waitlist_current_size: 0,
    capacity: 50,
    currently_enrolled: 10,
    has_open_seats: 1,
    has_waitlist: 0,
    is_full: 0,
  };
  const canonicalPackage = {
    ...stalePackage,
    package_id: 'pkg-new',
    package_last_updated: 2000,
    package_status: 'FULL',
    package_available_seats: 0,
    package_waitlist_total: 5,
    open_seats: 0,
    waitlist_current_size: 5,
    currently_enrolled: 50,
    has_open_seats: 0,
    has_waitlist: 1,
    is_full: 1,
  };
  const section = {
    section_class_number: 10977,
    term_code: '1272',
    course_id: '002983',
    section_number: '001',
    section_type: 'LEC',
    instruction_mode: 'Classroom Instruction',
    session_code: 'A1',
    published: 1,
    open_seats: 0,
    waitlist_current_size: 5,
    capacity: 50,
    currently_enrolled: 50,
    has_open_seats: 0,
    has_waitlist: 1,
    is_full: 1,
  };
  const staleSection = {
    ...section,
    open_seats: 40,
    waitlist_current_size: 0,
    currently_enrolled: 10,
    has_open_seats: 1,
    has_waitlist: 0,
    is_full: 0,
  };

  db.transaction(() => {
    insertCourse.run(course);
    insertPackage.run(stalePackage);
    insertPackage.run(canonicalPackage);
    insertSection.run({ ...staleSection, package_id: stalePackage.package_id });
    insertSection.run({ ...section, package_id: canonicalPackage.package_id });
  })();
}

const sampleCourse = {
  termCode: '1272',
  courseId: '002983',
  catalogNumber: '100',
  courseDesignation: 'ACCT I S 100',
  title: 'Introductory Financial Accounting',
  description: 'Accounting intro',
  minimumCredits: 3,
  maximumCredits: 3,
  enrollmentPrerequisites: 'Not open to students with credit for ACCT I S 300',
  currentlyTaught: true,
  lastTaught: '1264',
  subject: {
    subjectCode: '232',
    shortDescription: 'ACCT I S',
    description: 'ACCOUNTING AND INFO SYSTEMS',
  },
};

const samplePackage = {
  id: '31284',
  termCode: '1272',
  subjectCode: '232',
  courseId: '002983',
  enrollmentClassNumber: 31284,
  onlineOnly: false,
  isAsynchronous: false,
  packageEnrollmentStatus: {
    status: 'OPEN',
    availableSeats: 40,
    waitlistTotal: 0,
  },
  enrollmentStatus: {
    openSeats: 40,
    waitlistCurrentSize: 0,
    capacity: 50,
    currentlyEnrolled: 10,
  },
  sections: [
    {
      classUniqueId: { termCode: '1272', classNumber: 10977 },
      sectionNumber: '001',
      type: 'LEC',
      instructionMode: 'Classroom Instruction',
      sessionCode: 'A1',
      published: true,
      enrollmentStatus: {
        openSeats: 244,
        waitlistCurrentSize: 0,
        capacity: 245,
        currentlyEnrolled: 1,
      },
      instructors: [
        {
          netid: 'JWANGERIN',
          email: 'JOANNA.WANGERIN@WISC.EDU',
          name: { first: 'Joanna', last: 'Wangerin' },
        },
      ],
      classMeetings: [
        {
          meetingType: 'CLASS',
          meetingTimeStart: 53400000,
          meetingTimeEnd: 56400000,
          meetingDays: 'M',
          startDate: 1788325200000,
          endDate: 1796796000000,
          examDate: null,
          room: '1100',
          building: {
            buildingCode: '0140',
            buildingName: 'Grainger Hall',
            streetAddress: '975 University Ave.',
            latitude: 43.0727,
            longitude: -89.4015,
          },
        },
      ],
    },
  ],
};

test('makeCourseRow flattens a course record into one course table row', async () => {
  const { makeCourseRow } = await loadHelpers();
  const row = makeCourseRow(sampleCourse);

  assert.equal(row.term_code, '1272');
  assert.equal(row.course_id, '002983');
  assert.equal(row.subject_code, '232');
  assert.equal(row.title, 'Introductory Financial Accounting');
});

test('makePackageRow exposes availability flags for package-level queries', async () => {
  const { makePackageRow } = await loadHelpers();
  const row = makePackageRow(samplePackage);

  assert.equal(row.package_status, 'OPEN');
  assert.equal(row.package_available_seats, 40);
  assert.equal(row.has_open_seats, 1);
  assert.equal(row.is_full, 0);
});

test('makeMeetingRows includes building coordinates for schedule reasoning', async () => {
  const { makeMeetingRows } = await loadHelpers();
  const rows = makeMeetingRows(samplePackage);

  assert.equal(rows.length, 1);
  assert.equal(rows[0].building_code, '0140');
  assert.equal(rows[0].latitude, 43.0727);
  assert.equal(rows[0].longitude, -89.4015);
});

test('makeBuildingRows deduplicates buildings from repeated meetings', async () => {
  const { makeBuildingRows } = await loadHelpers();
  const rows = makeBuildingRows([
    samplePackage,
    {
      ...samplePackage,
      id: 'another-package',
    },
  ]);

  assert.equal(rows.length, 1);
  assert.equal(rows[0].building_code, '0140');
});

test('makeBuildingRows prefers fresher building metadata for the same building code', async () => {
  const { makeBuildingRows } = await loadHelpers();
  const [row] = makeBuildingRows([
    {
      ...samplePackage,
      id: 'stale-building',
      lastUpdated: 1000,
      sections: [
        {
          ...samplePackage.sections[0],
          classMeetings: [
            {
              ...samplePackage.sections[0].classMeetings[0],
              building: {
                buildingCode: '0140',
                buildingName: 'Old Hall Name',
                streetAddress: '100 Old Campus Dr.',
                latitude: 43.0,
                longitude: -89.3,
              },
            },
          ],
        },
      ],
    },
    {
      ...samplePackage,
      id: 'fresh-building',
      lastUpdated: 2000,
      sections: [
        {
          ...samplePackage.sections[0],
          classMeetings: [
            {
              ...samplePackage.sections[0].classMeetings[0],
              building: {
                buildingCode: '0140',
                buildingName: 'Grainger Hall',
                streetAddress: '975 University Ave.',
                latitude: 43.0727,
                longitude: -89.4015,
              },
            },
          ],
        },
      ],
    },
  ]);

  assert.deepEqual(row, {
    building_code: '0140',
    building_name: 'Grainger Hall',
    street_address: '975 University Ave.',
    latitude: 43.0727,
    longitude: -89.4015,
  });
});

test('summarizeAvailability marks waitlisted or full rows correctly', async () => {
  const { summarizeAvailability } = await loadHelpers();
  assert.deepEqual(summarizeAvailability({ openSeats: 0, waitlistCurrentSize: 3 }), {
    has_open_seats: 0,
    has_waitlist: 1,
    is_full: 1,
  });
});

test('course_overview_v uses the newest canonical section row for availability', () => {
  const db = createSchemaDb();

  try {
    seedCourseAvailability(db);

    const overview = db.prepare(`
      SELECT section_count, has_any_open_seats, has_any_waitlist, has_any_full_section
      FROM course_overview_v
      WHERE term_code = ? AND course_id = ?
    `).get('1272', '002983');

    const canonicalSection = db.prepare(`
      SELECT source_package_id, has_open_seats, has_waitlist, is_full
      FROM section_overview_v
      WHERE term_code = ? AND course_id = ? AND section_class_number = ?
    `).get('1272', '002983', 10977);

    assert.deepEqual(canonicalSection, {
      source_package_id: 'pkg-new',
      has_open_seats: 0,
      has_waitlist: 1,
      is_full: 1,
    });
    assert.deepEqual(overview, {
      section_count: 1,
      has_any_open_seats: 0,
      has_any_waitlist: 1,
      has_any_full_section: 1,
    });
  } finally {
    db.close();
  }
});

test('build-course-db collapses the same missing-class-number section across packages into one canonical section', () => {
  const fixture = buildCourseDbFixture({
    courses: [
      makeCourse({
        termCode: '1272',
        courseId: '011112',
        subjectCode: '220',
        catalogNumber: '556',
        courseDesignation: 'MATH 556',
        title: 'Cross Package Synthetic Canonicalization',
      }),
    ],
    packageSnapshot: {
      termCode: '1272',
      results: [
        {
          course: {
            termCode: '1272',
            subjectCode: '220',
            courseId: '011112',
          },
          packages: [
            {
              id: 'missing-cross-package-old',
              termCode: '1272',
              subjectCode: '220',
              courseId: '011112',
              enrollmentClassNumber: 51112,
              lastUpdated: 1000,
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
                  classUniqueId: { termCode: '1272' },
                  sectionNumber: '001',
                  type: 'LEC',
                  instructionMode: 'Classroom Instruction',
                  sessionCode: 'A1',
                  published: true,
                  enrollmentStatus: {
                    openSeats: 3,
                    waitlistCurrentSize: 0,
                    capacity: 30,
                    currentlyEnrolled: 27,
                  },
                },
              ],
            },
            {
              id: 'missing-cross-package-new',
              termCode: '1272',
              subjectCode: '220',
              courseId: '011112',
              enrollmentClassNumber: 51113,
              lastUpdated: 2000,
              onlineOnly: false,
              isAsynchronous: false,
              packageEnrollmentStatus: {
                status: 'OPEN',
                availableSeats: 0,
                waitlistTotal: 2,
              },
              enrollmentStatus: {
                openSeats: 0,
                waitlistCurrentSize: 2,
                capacity: 30,
                currentlyEnrolled: 30,
              },
              sections: [
                {
                  classUniqueId: { termCode: '1272' },
                  sectionNumber: '001',
                  type: 'LEC',
                  instructionMode: 'Classroom Instruction',
                  sessionCode: 'A1',
                  published: true,
                  enrollmentStatus: {
                    openSeats: 0,
                    waitlistCurrentSize: 2,
                    capacity: 30,
                    currentlyEnrolled: 30,
                  },
                },
              ],
            },
          ],
        },
      ],
    },
  });

  try {
    const rawSections = fixture.db.prepare(`
      SELECT s.package_id, s.section_class_number, p.package_last_updated
      FROM sections s
      JOIN packages p
        ON p.package_id = s.package_id
      WHERE s.term_code = ? AND s.course_id = ?
      ORDER BY p.package_last_updated
    `).all('1272', '011112');
    const canonicalSections = fixture.db.prepare(`
      SELECT section_class_number, source_package_id, has_open_seats, has_waitlist, is_full
      FROM section_overview_v
      WHERE term_code = ? AND course_id = ?
    `).all('1272', '011112');
    const courseOverview = fixture.db.prepare(`
      SELECT section_count, has_any_open_seats, has_any_waitlist, has_any_full_section
      FROM course_overview_v
      WHERE term_code = ? AND course_id = ?
    `).get('1272', '011112');

    assert.equal(rawSections.length, 2);
    assert.ok(rawSections[0].section_class_number < 0);
    assert.equal(rawSections[0].section_class_number, rawSections[1].section_class_number);
    assert.deepEqual(canonicalSections, [
      {
        section_class_number: rawSections[0].section_class_number,
        source_package_id: '1272:220:011112:missing-cross-package-new',
        has_open_seats: 0,
        has_waitlist: 1,
        is_full: 1,
      },
    ]);
    assert.deepEqual(courseOverview, {
      section_count: 1,
      has_any_open_seats: 0,
      has_any_waitlist: 1,
      has_any_full_section: 1,
    });
  } finally {
    fixture.cleanup();
  }
});

test('build-course-db keeps ambiguous repeated missing-class-number sections separate across packages when section order flips', () => {
  const fixture = buildCourseDbFixture({
    courses: [
      makeCourse({
        termCode: '1272',
        courseId: '011116',
        subjectCode: '220',
        catalogNumber: '560',
        courseDesignation: 'MATH 560',
        title: 'Ambiguous Repeated Synthetic Sections',
      }),
    ],
    packageSnapshot: {
      termCode: '1272',
      results: [
        {
          course: {
            termCode: '1272',
            subjectCode: '220',
            courseId: '011116',
          },
          packages: [
            {
              id: 'ambiguous-missing-old',
              termCode: '1272',
              subjectCode: '220',
              courseId: '011116',
              enrollmentClassNumber: 51117,
              lastUpdated: 1000,
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
                capacity: 40,
                currentlyEnrolled: 38,
              },
              sections: [
                {
                  classUniqueId: { termCode: '1272' },
                  sectionNumber: '001',
                  type: 'DIS',
                  instructionMode: 'Classroom Instruction',
                  sessionCode: 'A1',
                  published: true,
                  enrollmentStatus: {
                    openSeats: 1,
                    waitlistCurrentSize: 0,
                    capacity: 20,
                    currentlyEnrolled: 19,
                  },
                  instructors: [
                    {
                      netid: 'AMBIG001A',
                      email: 'ambig001a@wisc.edu',
                      name: { first: 'Ambig', last: 'Alpha' },
                    },
                  ],
                },
                {
                  classUniqueId: { termCode: '1272' },
                  sectionNumber: '001',
                  type: 'DIS',
                  instructionMode: 'Classroom Instruction',
                  sessionCode: 'A1',
                  published: true,
                  enrollmentStatus: {
                    openSeats: 1,
                    waitlistCurrentSize: 0,
                    capacity: 20,
                    currentlyEnrolled: 19,
                  },
                  instructors: [
                    {
                      netid: 'AMBIG001B',
                      email: 'ambig001b@wisc.edu',
                      name: { first: 'Ambig', last: 'Beta' },
                    },
                  ],
                },
              ],
            },
            {
              id: 'ambiguous-missing-new',
              termCode: '1272',
              subjectCode: '220',
              courseId: '011116',
              enrollmentClassNumber: 51118,
              lastUpdated: 2000,
              onlineOnly: false,
              isAsynchronous: false,
              packageEnrollmentStatus: {
                status: 'OPEN',
                availableSeats: 0,
                waitlistTotal: 4,
              },
              enrollmentStatus: {
                openSeats: 0,
                waitlistCurrentSize: 4,
                capacity: 40,
                currentlyEnrolled: 40,
              },
              sections: [
                {
                  classUniqueId: { termCode: '1272' },
                  sectionNumber: '001',
                  type: 'DIS',
                  instructionMode: 'Classroom Instruction',
                  sessionCode: 'A1',
                  published: true,
                  enrollmentStatus: {
                    openSeats: 0,
                    waitlistCurrentSize: 2,
                    capacity: 20,
                    currentlyEnrolled: 20,
                  },
                  instructors: [
                    {
                      netid: 'AMBIG001B',
                      email: 'ambig001b@wisc.edu',
                      name: { first: 'Ambig', last: 'Beta' },
                    },
                  ],
                },
                {
                  classUniqueId: { termCode: '1272' },
                  sectionNumber: '001',
                  type: 'DIS',
                  instructionMode: 'Classroom Instruction',
                  sessionCode: 'A1',
                  published: true,
                  enrollmentStatus: {
                    openSeats: 0,
                    waitlistCurrentSize: 2,
                    capacity: 20,
                    currentlyEnrolled: 20,
                  },
                  instructors: [
                    {
                      netid: 'AMBIG001A',
                      email: 'ambig001a@wisc.edu',
                      name: { first: 'Ambig', last: 'Alpha' },
                    },
                  ],
                },
              ],
            },
          ],
        },
      ],
    },
  });

  try {
    const rawSections = fixture.db.prepare(`
      SELECT s.package_id, s.section_class_number
      FROM sections s
      WHERE s.term_code = ? AND s.course_id = ?
      ORDER BY s.package_id, s.section_class_number
    `).all('1272', '011116');
    const canonicalSections = fixture.db.prepare(`
      SELECT source_package_id, section_class_number
      FROM section_overview_v
      WHERE term_code = ? AND course_id = ?
      ORDER BY source_package_id, section_class_number
    `).all('1272', '011116');
    const courseOverview = fixture.db.prepare(`
      SELECT section_count
      FROM course_overview_v
      WHERE term_code = ? AND course_id = ?
    `).get('1272', '011116');

    assert.equal(rawSections.length, 4);
    assert.equal(new Set(rawSections.map((row) => row.section_class_number)).size, 4);
    assert.deepEqual(
      canonicalSections.map((row) => row.source_package_id),
      [
        '1272:220:011116:ambiguous-missing-new',
        '1272:220:011116:ambiguous-missing-new',
        '1272:220:011116:ambiguous-missing-old',
        '1272:220:011116:ambiguous-missing-old',
      ],
    );
    assert.equal(courseOverview.section_count, 4);
  } finally {
    fixture.cleanup();
  }
});

test('build-course-db reuses a real class number for a matching missing-class-number package copy when full identity is unique', () => {
  const fixture = buildCourseDbFixture({
    courses: [
      makeCourse({
        termCode: '1272',
        courseId: '011115',
        subjectCode: '220',
        catalogNumber: '559',
        courseDesignation: 'MATH 559',
        title: 'Mixed Real Missing Class Number Canonicalization',
      }),
    ],
    packageSnapshot: {
      termCode: '1272',
      results: [
        {
          course: {
            termCode: '1272',
            subjectCode: '220',
            courseId: '011115',
          },
          packages: [
            {
              id: 'mixed-real-missing-old',
              termCode: '1272',
              subjectCode: '220',
              courseId: '011115',
              enrollmentClassNumber: 51116,
              lastUpdated: 1000,
              onlineOnly: false,
              isAsynchronous: false,
              packageEnrollmentStatus: {
                status: 'OPEN',
                availableSeats: 6,
                waitlistTotal: 0,
              },
              enrollmentStatus: {
                openSeats: 6,
                waitlistCurrentSize: 0,
                capacity: 30,
                currentlyEnrolled: 24,
              },
              sections: [
                {
                  classUniqueId: { termCode: '1272' },
                  sectionNumber: '001',
                  type: 'LEC',
                  instructionMode: 'Classroom Instruction',
                  sessionCode: 'A1',
                  published: true,
                  enrollmentStatus: {
                    openSeats: 6,
                    waitlistCurrentSize: 0,
                    capacity: 30,
                    currentlyEnrolled: 24,
                  },
                  instructors: [
                    {
                      netid: 'MIXED001',
                      email: 'mixed001@wisc.edu',
                      name: { first: 'Mixed', last: 'Fallback' },
                    },
                  ],
                  classMeetings: [
                    {
                      meetingType: 'CLASS',
                      meetingTimeStart: 54000000,
                      meetingTimeEnd: 57000000,
                      meetingDays: 'MWF',
                      startDate: 1788325200000,
                      endDate: 1796796000000,
                      room: '111',
                      building: {
                        buildingCode: '0140',
                        buildingName: 'Grainger Hall',
                        streetAddress: '975 University Ave.',
                        latitude: 43.0727,
                        longitude: -89.4015,
                      },
                    },
                  ],
                },
              ],
            },
            {
              id: 'mixed-real-missing-new',
              termCode: '1272',
              subjectCode: '220',
              courseId: '011115',
              enrollmentClassNumber: 51117,
              lastUpdated: 2000,
              onlineOnly: false,
              isAsynchronous: false,
              packageEnrollmentStatus: {
                status: 'OPEN',
                availableSeats: 0,
                waitlistTotal: 3,
              },
              enrollmentStatus: {
                openSeats: 0,
                waitlistCurrentSize: 3,
                capacity: 30,
                currentlyEnrolled: 30,
              },
              sections: [
                {
                  classUniqueId: { termCode: '1272', classNumber: 61115 },
                  sectionNumber: '001',
                  type: 'LEC',
                  instructionMode: 'Classroom Instruction',
                  sessionCode: 'A1',
                  published: true,
                  enrollmentStatus: {
                    openSeats: 0,
                    waitlistCurrentSize: 3,
                    capacity: 30,
                    currentlyEnrolled: 30,
                  },
                },
              ],
            },
          ],
        },
      ],
    },
  });

  try {
    const rawSections = fixture.db.prepare(`
      SELECT s.package_id, s.section_class_number, p.package_last_updated
      FROM sections s
      JOIN packages p
        ON p.package_id = s.package_id
      WHERE s.term_code = ? AND s.course_id = ?
      ORDER BY p.package_last_updated
    `).all('1272', '011115');
    const canonicalSections = fixture.db.prepare(`
      SELECT section_class_number, source_package_id, has_open_seats, has_waitlist, is_full
      FROM section_overview_v
      WHERE term_code = ? AND course_id = ?
    `).all('1272', '011115');
    const courseOverview = fixture.db.prepare(`
      SELECT section_count, has_any_open_seats, has_any_waitlist, has_any_full_section
      FROM course_overview_v
      WHERE term_code = ? AND course_id = ?
    `).get('1272', '011115');
    const fallbackInstructor = fixture.db.prepare(`
      SELECT instructor_key
      FROM section_instructors
      WHERE package_id = ? AND section_class_number = ?
    `).pluck().get('1272:220:011115:mixed-real-missing-old', 61115);
    const fallbackMeetingCount = fixture.db.prepare(`
      SELECT COUNT(*)
      FROM meetings
      WHERE package_id = ? AND section_class_number = ?
    `).pluck().get('1272:220:011115:mixed-real-missing-old', 61115);

    assert.deepEqual(rawSections, [
      {
        package_id: '1272:220:011115:mixed-real-missing-old',
        section_class_number: 61115,
        package_last_updated: 1000,
      },
      {
        package_id: '1272:220:011115:mixed-real-missing-new',
        section_class_number: 61115,
        package_last_updated: 2000,
      },
    ]);
    assert.deepEqual(canonicalSections, [
      {
        section_class_number: 61115,
        source_package_id: '1272:220:011115:mixed-real-missing-new',
        has_open_seats: 0,
        has_waitlist: 1,
        is_full: 1,
      },
    ]);
    assert.deepEqual(courseOverview, {
      section_count: 1,
      has_any_open_seats: 0,
      has_any_waitlist: 1,
      has_any_full_section: 1,
    });
    assert.equal(fallbackInstructor, 'netid:mixed001');
    assert.equal(fallbackMeetingCount, 1);
  } finally {
    fixture.cleanup();
  }
});

test('build-course-db synthesizes a missing course row from package snapshot metadata when courses.json omits it', () => {
  const fixture = buildCourseDbFixture({
    courses: [],
    packageSnapshot: {
      termCode: '1272',
      results: [
        {
          course: {
            termCode: '1272',
            courseId: '011114',
            subjectCode: '220',
            courseDesignation: 'MATH 558',
            title: 'Package Only Course',
          },
          packages: [
            {
              id: 'package-only-course',
              termCode: '1272',
              subjectCode: '220',
              courseId: '011114',
              catalogNumber: '558',
              enrollmentClassNumber: 51115,
              lastUpdated: 1000,
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
                capacity: 25,
                currentlyEnrolled: 20,
              },
              sections: [
                {
                  classUniqueId: { termCode: '1272', classNumber: 51115 },
                  sectionNumber: '001',
                  type: 'LEC',
                  instructionMode: 'Classroom Instruction',
                  sessionCode: 'A1',
                  published: true,
                  enrollmentStatus: {
                    openSeats: 5,
                    waitlistCurrentSize: 0,
                    capacity: 25,
                    currentlyEnrolled: 20,
                  },
                },
              ],
            },
          ],
        },
      ],
    },
  });

  try {
    const courseRow = fixture.db.prepare(`
      SELECT term_code, course_id, subject_code, catalog_number, course_designation, title
      FROM courses
      WHERE term_code = ? AND course_id = ?
    `).get('1272', '011114');
    const packageRow = fixture.db.prepare(`
      SELECT package_id, term_code, course_id
      FROM packages
      WHERE package_id = ?
    `).get('1272:220:011114:package-only-course');

    assert.deepEqual(courseRow, {
      term_code: '1272',
      course_id: '011114',
      subject_code: '220',
      catalog_number: '558',
      course_designation: 'MATH 558',
      title: 'Package Only Course',
    });
    assert.deepEqual(packageRow, {
      package_id: '1272:220:011114:package-only-course',
      term_code: '1272',
      course_id: '011114',
    });
  } finally {
    fixture.cleanup();
  }
});

test('build-course-db keeps only the newest package snapshot sections while preserving surviving section detail', () => {
  const fixture = buildCourseDbFixture({
    courses: [
      makeCourse({
        termCode: '1272',
        courseId: '000802',
        subjectCode: '156',
        catalogNumber: '101',
        courseDesignation: 'COMP SCI 101',
        title: 'Intro Merge Behavior',
      }),
    ],
    packageSnapshot: {
      termCode: '1272',
      results: [
        {
          course: {
            termCode: '1272',
            subjectCode: '156',
            courseId: '000802',
          },
          packages: [
            {
              id: '12566',
              termCode: '1272',
              subjectCode: '156',
              courseId: '000802',
              enrollmentClassNumber: 12566,
              lastUpdated: 1000,
              onlineOnly: false,
              isAsynchronous: false,
              packageEnrollmentStatus: {
                status: 'OPEN',
                availableSeats: 10,
                waitlistTotal: 0,
              },
              enrollmentStatus: {
                openSeats: 10,
                waitlistCurrentSize: 0,
                capacity: 30,
                currentlyEnrolled: 20,
              },
              sections: [
                {
                  classUniqueId: { termCode: '1272', classNumber: 12561 },
                  sectionNumber: '001',
                  type: 'LEC',
                  instructionMode: 'Classroom Instruction',
                  sessionCode: 'A1',
                  published: true,
                  enrollmentStatus: {
                    openSeats: 1,
                    waitlistCurrentSize: 0,
                    capacity: 10,
                    currentlyEnrolled: 9,
                  },
                },
                {
                  classUniqueId: { termCode: '1272', classNumber: 12562 },
                  sectionNumber: '002',
                  type: 'LEC',
                  instructionMode: 'Classroom Instruction',
                  sessionCode: 'A1',
                  published: true,
                  enrollmentStatus: {
                    openSeats: 2,
                    waitlistCurrentSize: 0,
                    capacity: 25,
                    currentlyEnrolled: 23,
                  },
                  instructors: [
                    {
                      netid: 'KEEPDETAIL',
                      email: 'keepdetail@wisc.edu',
                      name: { first: 'Keep', last: 'Detail' },
                    },
                  ],
                  classMeetings: [
                    {
                      meetingType: 'CLASS',
                      meetingTimeStart: 54000000,
                      meetingTimeEnd: 57000000,
                      meetingDays: 'MWF',
                      startDate: 1788325200000,
                      endDate: 1796796000000,
                      room: '100',
                      building: {
                        buildingCode: '0140',
                        buildingName: 'Grainger Hall',
                        streetAddress: '975 University Ave.',
                        latitude: 43.0727,
                        longitude: -89.4015,
                      },
                    },
                  ],
                },
              ],
            },
            {
              id: '12566',
              termCode: '1272',
              subjectCode: '156',
              courseId: '000802',
              enrollmentClassNumber: 12566,
              lastUpdated: 2000,
              onlineOnly: false,
              isAsynchronous: false,
              packageEnrollmentStatus: {
                status: 'OPEN',
                availableSeats: 6,
                waitlistTotal: 0,
              },
              enrollmentStatus: {
                openSeats: 6,
                waitlistCurrentSize: 0,
                capacity: 30,
                currentlyEnrolled: 24,
              },
              sections: [
                {
                  classUniqueId: { termCode: '1272', classNumber: 12562 },
                  sectionNumber: '002',
                  type: 'LEC',
                  instructionMode: 'Classroom Instruction',
                  sessionCode: 'A1',
                  published: true,
                  enrollmentStatus: {
                    openSeats: 0,
                    waitlistCurrentSize: 3,
                    capacity: 25,
                    currentlyEnrolled: 25,
                  },
                },
                {
                  classUniqueId: { termCode: '1272', classNumber: 12566 },
                  sectionNumber: '003',
                  type: 'LEC',
                  instructionMode: 'Classroom Instruction',
                  sessionCode: 'A1',
                  published: true,
                  enrollmentStatus: {
                    openSeats: 6,
                    waitlistCurrentSize: 0,
                    capacity: 30,
                    currentlyEnrolled: 24,
                  },
                },
              ],
            },
          ],
        },
      ],
    },
  });

  try {
    const sectionNumbers = fixture.db.prepare(`
      SELECT section_class_number
      FROM sections
      WHERE package_id = ?
      ORDER BY section_class_number
    `).pluck().all('1272:156:000802:12566');
    const preservedInstructor = fixture.db.prepare(`
      SELECT instructor_key
      FROM section_instructors
      WHERE package_id = ? AND section_class_number = ?
    `).pluck().get('1272:156:000802:12566', 12562);
    const preservedMeetingCount = fixture.db.prepare(`
      SELECT COUNT(*)
      FROM meetings
      WHERE package_id = ? AND section_class_number = ?
    `).pluck().get('1272:156:000802:12566', 12562);

    assert.deepEqual(sectionNumbers, [12562, 12566]);
    assert.equal(preservedInstructor, 'netid:keepdetail');
    assert.equal(preservedMeetingCount, 1);
  } finally {
    fixture.cleanup();
  }
});

test('build-course-db preserves missing-class-number detail when the newer snapshot omits one identity field', () => {
  const fixture = buildCourseDbFixture({
    courses: [
      makeCourse({
        termCode: '1272',
        courseId: '011113',
        subjectCode: '220',
        catalogNumber: '557',
        courseDesignation: 'MATH 557',
        title: 'Partial Missing-Class Identity Merge',
      }),
    ],
    packageSnapshot: {
      termCode: '1272',
      results: [
        {
          course: {
            termCode: '1272',
            subjectCode: '220',
            courseId: '011113',
          },
          packages: [
            {
              id: 'partial-identity-package',
              termCode: '1272',
              subjectCode: '220',
              courseId: '011113',
              enrollmentClassNumber: 51114,
              lastUpdated: 1000,
              onlineOnly: false,
              isAsynchronous: false,
              packageEnrollmentStatus: {
                status: 'OPEN',
                availableSeats: 8,
                waitlistTotal: 0,
              },
              enrollmentStatus: {
                openSeats: 8,
                waitlistCurrentSize: 0,
                capacity: 30,
                currentlyEnrolled: 22,
              },
              sections: [
                {
                  classUniqueId: { termCode: '1272' },
                  sectionNumber: '001',
                  type: 'LEC',
                  instructionMode: 'Classroom Instruction',
                  sessionCode: 'A1',
                  published: true,
                  enrollmentStatus: {
                    openSeats: 4,
                    waitlistCurrentSize: 0,
                    capacity: 15,
                    currentlyEnrolled: 11,
                  },
                  instructors: [
                    {
                      netid: 'STALE001',
                      email: 'stale001@wisc.edu',
                      name: { first: 'Stale', last: 'One' },
                    },
                  ],
                  classMeetings: [
                    {
                      meetingType: 'CLASS',
                      meetingTimeStart: 54000000,
                      meetingTimeEnd: 57000000,
                      meetingDays: 'MWF',
                      startDate: 1788325200000,
                      endDate: 1796796000000,
                      room: '111',
                      building: {
                        buildingCode: '0140',
                        buildingName: 'Grainger Hall',
                        streetAddress: '975 University Ave.',
                        latitude: 43.0727,
                        longitude: -89.4015,
                      },
                    },
                  ],
                },
                {
                  classUniqueId: { termCode: '1272' },
                  sectionNumber: '002',
                  type: 'LEC',
                  instructionMode: 'Classroom Instruction',
                  sessionCode: 'A1',
                  published: true,
                  enrollmentStatus: {
                    openSeats: 4,
                    waitlistCurrentSize: 0,
                    capacity: 15,
                    currentlyEnrolled: 11,
                  },
                  instructors: [
                    {
                      netid: 'KEEP002',
                      email: 'keep002@wisc.edu',
                      name: { first: 'Keep', last: 'Two' },
                    },
                  ],
                  classMeetings: [
                    {
                      meetingType: 'CLASS',
                      meetingTimeStart: 61200000,
                      meetingTimeEnd: 64200000,
                      meetingDays: 'TR',
                      startDate: 1788325200000,
                      endDate: 1796796000000,
                      room: '222',
                      building: {
                        buildingCode: '0140',
                        buildingName: 'Grainger Hall',
                        streetAddress: '975 University Ave.',
                        latitude: 43.0727,
                        longitude: -89.4015,
                      },
                    },
                  ],
                },
              ],
            },
            {
              id: 'partial-identity-package',
              termCode: '1272',
              subjectCode: '220',
              courseId: '011113',
              enrollmentClassNumber: 51114,
              lastUpdated: 2000,
              onlineOnly: false,
              isAsynchronous: false,
              packageEnrollmentStatus: {
                status: 'OPEN',
                availableSeats: 0,
                waitlistTotal: 2,
              },
              enrollmentStatus: {
                openSeats: 0,
                waitlistCurrentSize: 2,
                capacity: 15,
                currentlyEnrolled: 15,
              },
              sections: [
                {
                  classUniqueId: { termCode: '1272' },
                  sectionNumber: '002',
                  type: 'LEC',
                  instructionMode: 'Classroom Instruction',
                  published: true,
                  enrollmentStatus: {
                    openSeats: 0,
                    waitlistCurrentSize: 2,
                    capacity: 15,
                    currentlyEnrolled: 15,
                  },
                },
              ],
            },
          ],
        },
      ],
    },
  });

  try {
    const sectionRows = fixture.db.prepare(`
      SELECT section_number, session_code, section_class_number
      FROM sections
      WHERE package_id = ?
      ORDER BY section_number
    `).all('1272:220:011113:partial-identity-package');
    const preservedInstructor = fixture.db.prepare(`
      SELECT instructor_key
      FROM section_instructors
      WHERE package_id = ? AND section_class_number = ?
    `).pluck().get('1272:220:011113:partial-identity-package', sectionRows[0].section_class_number);
    const preservedMeetingCount = fixture.db.prepare(`
      SELECT COUNT(*)
      FROM meetings
      WHERE package_id = ? AND section_class_number = ?
    `).pluck().get('1272:220:011113:partial-identity-package', sectionRows[0].section_class_number);

    assert.deepEqual(sectionRows, [
      {
        section_number: '002',
        session_code: 'A1',
        section_class_number: sectionRows[0].section_class_number,
      },
    ]);
    assert.ok(sectionRows[0].section_class_number < 0);
    assert.equal(preservedInstructor, 'netid:keep002');
    assert.equal(preservedMeetingCount, 1);
  } finally {
    fixture.cleanup();
  }
});

test('build-course-db imports multiple sections without class numbers using stable synthetic section identifiers', () => {
  const fixture = buildCourseDbFixture({
    courses: [
      makeCourse({
        termCode: '1272',
        courseId: '011111',
        subjectCode: '220',
        catalogNumber: '555',
        courseDesignation: 'MATH 555',
        title: 'Synthetic Section Identifier Repro',
      }),
    ],
    packageSnapshot: {
      termCode: '1272',
      results: [
        {
          course: {
            termCode: '1272',
            subjectCode: '220',
            courseId: '011111',
          },
          packages: [
            {
              id: 'missing-class-number-package',
              termCode: '1272',
              subjectCode: '220',
              courseId: '011111',
              enrollmentClassNumber: 51111,
              lastUpdated: 1000,
              onlineOnly: false,
              isAsynchronous: false,
              packageEnrollmentStatus: {
                status: 'OPEN',
                availableSeats: 4,
                waitlistTotal: 0,
              },
              enrollmentStatus: {
                openSeats: 4,
                waitlistCurrentSize: 0,
                capacity: 30,
                currentlyEnrolled: 26,
              },
              sections: [
                {
                  classUniqueId: { termCode: '1272' },
                  sectionNumber: '001',
                  type: 'LEC',
                  instructionMode: 'Classroom Instruction',
                  sessionCode: 'A1',
                  published: true,
                  enrollmentStatus: {
                    openSeats: 2,
                    waitlistCurrentSize: 0,
                    capacity: 20,
                    currentlyEnrolled: 18,
                  },
                },
                {
                  classUniqueId: { termCode: '1272' },
                  sectionNumber: '002',
                  type: 'LEC',
                  instructionMode: 'Classroom Instruction',
                  sessionCode: 'A1',
                  published: true,
                  enrollmentStatus: {
                    openSeats: 2,
                    waitlistCurrentSize: 0,
                    capacity: 10,
                    currentlyEnrolled: 8,
                  },
                  instructors: [
                    {
                      netid: 'SYNTH002',
                      email: 'synth002@wisc.edu',
                      name: { first: 'Synth', last: 'Two' },
                    },
                  ],
                  classMeetings: [
                    {
                      meetingType: 'CLASS',
                      meetingTimeStart: 61200000,
                      meetingTimeEnd: 64200000,
                      meetingDays: 'TR',
                      startDate: 1788325200000,
                      endDate: 1796796000000,
                      room: '222',
                      building: {
                        buildingCode: '0140',
                        buildingName: 'Grainger Hall',
                        streetAddress: '975 University Ave.',
                        latitude: 43.0727,
                        longitude: -89.4015,
                      },
                    },
                  ],
                },
              ],
            },
            {
              id: 'missing-class-number-package',
              termCode: '1272',
              subjectCode: '220',
              courseId: '011111',
              enrollmentClassNumber: 51111,
              lastUpdated: 2000,
              onlineOnly: false,
              isAsynchronous: false,
              packageEnrollmentStatus: {
                status: 'OPEN',
                availableSeats: 1,
                waitlistTotal: 2,
              },
              enrollmentStatus: {
                openSeats: 1,
                waitlistCurrentSize: 2,
                capacity: 30,
                currentlyEnrolled: 29,
              },
              sections: [
                {
                  classUniqueId: { termCode: '1272' },
                  sectionNumber: '001',
                  type: 'LEC',
                  instructionMode: 'Classroom Instruction',
                  sessionCode: 'A1',
                  published: true,
                  enrollmentStatus: {
                    openSeats: 0,
                    waitlistCurrentSize: 2,
                    capacity: 20,
                    currentlyEnrolled: 20,
                  },
                },
                {
                  classUniqueId: { termCode: '1272' },
                  sectionNumber: '002',
                  type: 'LEC',
                  instructionMode: 'Classroom Instruction',
                  sessionCode: 'A1',
                  published: true,
                  enrollmentStatus: {
                    openSeats: 1,
                    waitlistCurrentSize: 0,
                    capacity: 10,
                    currentlyEnrolled: 9,
                  },
                },
              ],
            },
          ],
        },
      ],
    },
  });

  try {
    const sectionRows = fixture.db.prepare(`
      SELECT
        s.section_number,
        s.section_class_number,
        COUNT(DISTINCT m.meeting_index) AS meeting_count,
        COUNT(DISTINCT si.instructor_key) AS instructor_count
      FROM sections s
      LEFT JOIN meetings m
        ON m.package_id = s.package_id
       AND m.section_class_number = s.section_class_number
      LEFT JOIN section_instructors si
        ON si.package_id = s.package_id
       AND si.section_class_number = s.section_class_number
      WHERE s.package_id = ?
      GROUP BY s.section_number, s.section_class_number
      ORDER BY s.section_number
    `).all('1272:220:011111:missing-class-number-package');

    assert.equal(sectionRows.length, 2);
    assert.equal(sectionRows[0].section_number, '001');
    assert.equal(sectionRows[1].section_number, '002');
    assert.notEqual(sectionRows[0].section_class_number, sectionRows[1].section_class_number);
    assert.ok(sectionRows[0].section_class_number < 0);
    assert.ok(sectionRows[1].section_class_number < 0);
    assert.deepEqual(
      sectionRows.map((row) => ({
        section_number: row.section_number,
        meeting_count: row.meeting_count,
        instructor_count: row.instructor_count,
      })),
      [
        { section_number: '001', meeting_count: 0, instructor_count: 0 },
        { section_number: '002', meeting_count: 1, instructor_count: 1 },
      ],
    );
  } finally {
    fixture.cleanup();
  }
});

test('mergePackageRecords preserves stale section detail by stable section identity instead of position when class numbers are absent', async () => {
  const fixture = await loadBuildCourseDbModule();

  try {
    const merged = fixture.mod.mergePackageRecords(
      {
        packageId: '1272:220:009998:merge-key-test',
        lastUpdated: 1000,
        sections: [
          {
            sectionNumber: '001',
            type: 'LEC',
            sessionCode: 'A1',
            published: true,
            instructors: [
              {
                netid: 'STALE001',
                email: 'stale001@wisc.edu',
                name: { first: 'Stale', last: 'One' },
              },
            ],
            classMeetings: [
              {
                meetingType: 'CLASS',
                meetingTimeStart: 54000000,
                meetingTimeEnd: 57000000,
                meetingDays: 'MWF',
                room: '111',
              },
            ],
          },
          {
            sectionNumber: '002',
            type: 'LEC',
            sessionCode: 'A1',
            published: true,
            instructors: [
              {
                netid: 'KEEP002',
                email: 'keep002@wisc.edu',
                name: { first: 'Keep', last: 'Two' },
              },
            ],
            classMeetings: [
              {
                meetingType: 'CLASS',
                meetingTimeStart: 61200000,
                meetingTimeEnd: 64200000,
                meetingDays: 'TR',
                room: '222',
              },
            ],
          },
        ],
      },
      {
        packageId: '1272:220:009998:merge-key-test',
        lastUpdated: 2000,
        sections: [
          {
            sectionNumber: '002',
            type: 'LEC',
            sessionCode: 'A1',
            published: true,
            instructionMode: 'Classroom Instruction',
            enrollmentStatus: {
              openSeats: 0,
              waitlistCurrentSize: 2,
              capacity: 30,
              currentlyEnrolled: 30,
            },
          },
        ],
      },
    );

    assert.equal(merged.sections.length, 1);
    assert.equal(merged.sections[0].sectionNumber, '002');
    assert.equal(merged.sections[0].instructors?.[0]?.netid, 'KEEP002');
    assert.equal(merged.sections[0].classMeetings?.[0]?.room, '222');
  } finally {
    fixture.cleanup();
  }
});

test('mergePackageRecords resolves equal-timestamp duplicates deterministically regardless of input order', async () => {
  const fixture = await loadBuildCourseDbModule();

  try {
    const sparse = {
      packageId: '1272:220:009995:equal-timestamp-package',
      lastUpdated: 2000,
      onlineOnly: false,
      isAsynchronous: false,
      packageEnrollmentStatus: {
        status: 'OPEN',
        availableSeats: 8,
        waitlistTotal: 0,
      },
      enrollmentStatus: {
        openSeats: 8,
        waitlistCurrentSize: 0,
        capacity: 30,
        currentlyEnrolled: 22,
      },
      sections: [
        {
          sectionNumber: '001',
          type: 'LEC',
          sessionCode: 'A1',
          published: true,
        },
      ],
    };
    const rich = {
      packageId: '1272:220:009995:equal-timestamp-package',
      lastUpdated: 2000,
      onlineOnly: true,
      isAsynchronous: true,
      packageEnrollmentStatus: {
        status: 'FULL',
        availableSeats: 0,
        waitlistTotal: 4,
      },
      enrollmentStatus: {
        openSeats: 0,
        waitlistCurrentSize: 4,
        capacity: 30,
        currentlyEnrolled: 30,
      },
      sections: [
        {
          sectionNumber: '001',
          type: 'LEC',
          sessionCode: 'A1',
          published: true,
          instructionMode: 'Online',
          instructors: [
            {
              netid: 'RICH001',
              email: 'rich001@wisc.edu',
              name: { first: 'Rich', last: 'One' },
            },
          ],
          classMeetings: [
            {
              meetingType: 'CLASS',
              meetingTimeStart: 54000000,
              meetingTimeEnd: 57000000,
              meetingDays: 'MWF',
              room: 'B10',
            },
          ],
        },
        {
          sectionNumber: '002',
          type: 'DIS',
          sessionCode: 'A1',
          published: true,
          instructionMode: 'Online',
        },
      ],
    };

    const sparseFirst = fixture.mod.mergePackageRecords(sparse, rich);
    const richFirst = fixture.mod.mergePackageRecords(rich, sparse);

    assert.deepEqual(sparseFirst, richFirst);
    assert.equal(sparseFirst.onlineOnly, true);
    assert.equal(sparseFirst.isAsynchronous, true);
    assert.equal(sparseFirst.packageEnrollmentStatus.status, 'FULL');
    assert.deepEqual(
      sparseFirst.sections.map((section) => section.sectionNumber),
      ['001', '002'],
    );
    assert.equal(sparseFirst.sections[0].classMeetings?.[0]?.room, 'B10');
  } finally {
    fixture.cleanup();
  }
});

test('mergePackageRecords collapses overlapping instructor identities when a later snapshot adds richer metadata', async () => {
  const fixture = await loadBuildCourseDbModule();

  try {
    const merged = fixture.mod.mergePackageRecords(
      {
        packageId: '1272:220:009997:instructor-merge-test',
        lastUpdated: 1000,
        sections: [
          {
            classUniqueId: { termCode: '1272', classNumber: 42001 },
            sectionNumber: '001',
            type: 'LEC',
            sessionCode: 'A1',
            published: true,
            instructors: [
              {
                email: 'merge.case@wisc.edu',
              },
            ],
          },
        ],
      },
      {
        packageId: '1272:220:009997:instructor-merge-test',
        lastUpdated: 2000,
        sections: [
          {
            classUniqueId: { termCode: '1272', classNumber: 42001 },
            sectionNumber: '001',
            type: 'LEC',
            sessionCode: 'A1',
            published: true,
            instructors: [
              {
                netid: 'MERGECASE',
                email: 'merge.case@wisc.edu',
                name: { first: 'Merge', last: 'Case' },
              },
            ],
          },
        ],
      },
    );

    assert.equal(merged.sections[0].instructors.length, 1);
    assert.deepEqual(merged.sections[0].instructors[0], {
      netid: 'MERGECASE',
      email: 'merge.case@wisc.edu',
      name: { first: 'Merge', last: 'Case' },
    });
  } finally {
    fixture.cleanup();
  }
});

test('mergePackageRecords collapses overlapping logical meetings when the newer snapshot is sparser', async () => {
  const fixture = await loadBuildCourseDbModule();

  try {
    const merged = fixture.mod.mergePackageRecords(
      {
        packageId: '1272:220:009994:meeting-merge-test',
        lastUpdated: 1000,
        sections: [
          {
            classUniqueId: { termCode: '1272', classNumber: 42003 },
            sectionNumber: '001',
            type: 'LEC',
            sessionCode: 'A1',
            published: true,
            classMeetings: [
              {
                meetingType: 'CLASS',
                meetingTimeStart: 54000000,
                meetingTimeEnd: 57000000,
                meetingDays: 'MWF',
                startDate: 1788325200000,
                endDate: 1796796000000,
                room: 'B10',
                building: {
                  buildingCode: '0140',
                  buildingName: 'Grainger Hall',
                },
              },
            ],
          },
        ],
      },
      {
        packageId: '1272:220:009994:meeting-merge-test',
        lastUpdated: 2000,
        sections: [
          {
            classUniqueId: { termCode: '1272', classNumber: 42003 },
            sectionNumber: '001',
            type: 'LEC',
            sessionCode: 'A1',
            published: true,
            classMeetings: [
              {
                meetingType: 'CLASS',
                meetingTimeStart: 54000000,
                meetingTimeEnd: 57000000,
                meetingDays: 'MWF',
                startDate: 1788325200000,
                endDate: 1796796000000,
              },
            ],
          },
        ],
      },
    );

    assert.equal(merged.sections[0].classMeetings.length, 1);
    assert.deepEqual(merged.sections[0].classMeetings[0], {
      meetingType: 'CLASS',
      meetingTimeStart: 54000000,
      meetingTimeEnd: 57000000,
      meetingDays: 'MWF',
      startDate: 1788325200000,
      endDate: 1796796000000,
      room: 'B10',
      building: {
        buildingCode: '0140',
        buildingName: 'Grainger Hall',
      },
    });
  } finally {
    fixture.cleanup();
  }
});

test('mergePackageRecords keeps same-name instructors distinct when they carry different strong identifiers', async () => {
  const fixture = await loadBuildCourseDbModule();

  try {
    const merged = fixture.mod.mergePackageRecords(
      {
        packageId: '1272:220:009996:instructor-name-collision-test',
        lastUpdated: 1000,
        sections: [
          {
            classUniqueId: { termCode: '1272', classNumber: 42002 },
            sectionNumber: '001',
            type: 'LEC',
            sessionCode: 'A1',
            published: true,
            instructors: [
              {
                netid: 'JSMITH1',
                name: { first: 'Jordan', last: 'Smith' },
              },
            ],
          },
        ],
      },
      {
        packageId: '1272:220:009996:instructor-name-collision-test',
        lastUpdated: 2000,
        sections: [
          {
            classUniqueId: { termCode: '1272', classNumber: 42002 },
            sectionNumber: '001',
            type: 'LEC',
            sessionCode: 'A1',
            published: true,
            instructors: [
              {
                email: 'jordan.smith2@wisc.edu',
                name: { first: 'Jordan', last: 'Smith' },
              },
            ],
          },
        ],
      },
    );

    assert.equal(merged.sections[0].instructors.length, 2);
    const sortInstructors = (instructors) => [...instructors].sort((left, right) => (
      `${left.netid ?? left.email ?? ''}`.localeCompare(`${right.netid ?? right.email ?? ''}`)
    ));
    assert.deepEqual(
      sortInstructors(merged.sections[0].instructors),
      sortInstructors([
      {
        netid: 'JSMITH1',
        name: { first: 'Jordan', last: 'Smith' },
      },
      {
        email: 'jordan.smith2@wisc.edu',
        name: { first: 'Jordan', last: 'Smith' },
      },
      ]),
    );
  } finally {
    fixture.cleanup();
  }
});

test('build-course-db merges richer later instructor metadata into one normalized instructor row', () => {
  const fixture = buildCourseDbFixture({
    courses: [
      makeCourse({
        termCode: '1272',
        courseId: '010020',
        subjectCode: '220',
        catalogNumber: '350',
        courseDesignation: 'MATH 350',
        title: 'Instructor Merge Repro',
      }),
    ],
    packageSnapshot: {
      termCode: '1272',
      results: [
        {
          course: {
            termCode: '1272',
            subjectCode: '220',
            courseId: '010020',
          },
          packages: [
            {
              id: 'instructor-old',
              termCode: '1272',
              subjectCode: '220',
              courseId: '010020',
              enrollmentClassNumber: 42010,
              lastUpdated: 1000,
              onlineOnly: false,
              isAsynchronous: false,
              packageEnrollmentStatus: {
                status: 'OPEN',
                availableSeats: 6,
                waitlistTotal: 0,
              },
              enrollmentStatus: {
                openSeats: 6,
                waitlistCurrentSize: 0,
                capacity: 25,
                currentlyEnrolled: 19,
              },
              sections: [
                {
                  classUniqueId: { termCode: '1272', classNumber: 42010 },
                  sectionNumber: '001',
                  type: 'LEC',
                  instructionMode: 'Classroom Instruction',
                  sessionCode: 'A1',
                  published: true,
                  enrollmentStatus: {
                    openSeats: 6,
                    waitlistCurrentSize: 0,
                    capacity: 25,
                    currentlyEnrolled: 19,
                  },
                  instructors: [
                    {
                      email: 'merge.case@wisc.edu',
                    },
                  ],
                },
              ],
            },
            {
              id: 'instructor-new',
              termCode: '1272',
              subjectCode: '220',
              courseId: '010020',
              enrollmentClassNumber: 42011,
              lastUpdated: 2000,
              onlineOnly: false,
              isAsynchronous: false,
              packageEnrollmentStatus: {
                status: 'OPEN',
                availableSeats: 4,
                waitlistTotal: 0,
              },
              enrollmentStatus: {
                openSeats: 4,
                waitlistCurrentSize: 0,
                capacity: 25,
                currentlyEnrolled: 21,
              },
              sections: [
                {
                  classUniqueId: { termCode: '1272', classNumber: 42011 },
                  sectionNumber: '002',
                  type: 'LEC',
                  instructionMode: 'Classroom Instruction',
                  sessionCode: 'A1',
                  published: true,
                  enrollmentStatus: {
                    openSeats: 4,
                    waitlistCurrentSize: 0,
                    capacity: 25,
                    currentlyEnrolled: 21,
                  },
                  instructors: [
                    {
                      netid: 'MERGECASE',
                      email: 'merge.case@wisc.edu',
                      name: { first: 'Merge', last: 'Case' },
                    },
                  ],
                },
              ],
            },
          ],
        },
      ],
    },
  });

  try {
    const instructors = fixture.db.prepare(`
      SELECT instructor_key, netid, email, first_name, last_name
      FROM instructors
      ORDER BY instructor_key
    `).all();
    const sectionInstructorRows = fixture.db.prepare(`
      SELECT package_id, section_class_number, instructor_key
      FROM section_instructors
      ORDER BY package_id, section_class_number, instructor_key
    `).all();

    assert.deepEqual(instructors, [
      {
        instructor_key: 'netid:mergecase',
        netid: 'MERGECASE',
        email: 'merge.case@wisc.edu',
        first_name: 'Merge',
        last_name: 'Case',
      },
    ]);
    assert.deepEqual(sectionInstructorRows, [
      {
        package_id: '1272:220:010020:instructor-new',
        section_class_number: 42011,
        instructor_key: 'netid:mergecase',
      },
      {
        package_id: '1272:220:010020:instructor-old',
        section_class_number: 42010,
        instructor_key: 'netid:mergecase',
      },
    ]);
  } finally {
    fixture.cleanup();
  }
});

test('build-course-db preserves flat instructor first and last names in the normalized instructors table', () => {
  const fixture = buildCourseDbFixture({
    courses: [
      makeCourse({
        termCode: '1272',
        courseId: '010021',
        subjectCode: '220',
        catalogNumber: '512',
        courseDesignation: 'MATH 512',
        title: 'Flat Instructor Names',
      }),
    ],
    packageSnapshot: {
      termCode: '1272',
      results: [
        {
          course: {
            termCode: '1272',
            subjectCode: '220',
            courseId: '010021',
          },
          packages: [
            {
              id: 'instructor-flat',
              termCode: '1272',
              subjectCode: '220',
              courseId: '010021',
              enrollmentClassNumber: 42012,
              lastUpdated: 2000,
              onlineOnly: false,
              isAsynchronous: false,
              packageEnrollmentStatus: {
                status: 'OPEN',
                availableSeats: 7,
                waitlistTotal: 0,
              },
              enrollmentStatus: {
                openSeats: 7,
                waitlistCurrentSize: 0,
                capacity: 25,
                currentlyEnrolled: 18,
              },
              sections: [
                {
                  classUniqueId: { termCode: '1272', classNumber: 42012 },
                  sectionNumber: '001',
                  type: 'LEC',
                  instructionMode: 'Classroom Instruction',
                  sessionCode: 'A1',
                  published: true,
                  enrollmentStatus: {
                    openSeats: 7,
                    waitlistCurrentSize: 0,
                    capacity: 25,
                    currentlyEnrolled: 18,
                  },
                  instructors: [
                    {
                      netid: 'FLATNAME',
                      email: 'flat.name@wisc.edu',
                      first_name: 'Flat',
                      last_name: 'Name',
                    },
                  ],
                },
              ],
            },
          ],
        },
      ],
    },
  });

  try {
    const instructors = fixture.db.prepare(`
      SELECT instructor_key, netid, email, first_name, last_name
      FROM instructors
      ORDER BY instructor_key
    `).all();

    assert.deepEqual(instructors, [
      {
        instructor_key: 'netid:flatname',
        netid: 'FLATNAME',
        email: 'flat.name@wisc.edu',
        first_name: 'Flat',
        last_name: 'Name',
      },
    ]);
  } finally {
    fixture.cleanup();
  }
});

test('online_courses_v ignores stale non-canonical online package copies', () => {
  const fixture = buildCourseDbFixture({
    courses: [
      makeCourse({
        termCode: '1272',
        courseId: '009999',
        subjectCode: '220',
        catalogNumber: '220',
        courseDesignation: 'MATH 220',
        title: 'Online Canonicalization',
      }),
    ],
    packageSnapshot: {
      termCode: '1272',
      results: [
        {
          course: {
            termCode: '1272',
            subjectCode: '220',
            courseId: '009999',
          },
          packages: [
            {
              id: 'online-old',
              termCode: '1272',
              subjectCode: '220',
              courseId: '009999',
              enrollmentClassNumber: 40001,
              lastUpdated: 1000,
              onlineOnly: true,
              isAsynchronous: true,
              packageEnrollmentStatus: {
                status: 'OPEN',
                availableSeats: 4,
                waitlistTotal: 0,
              },
              enrollmentStatus: {
                openSeats: 4,
                waitlistCurrentSize: 0,
                capacity: 30,
                currentlyEnrolled: 26,
              },
              sections: [
                {
                  classUniqueId: { termCode: '1272', classNumber: 40001 },
                  sectionNumber: '001',
                  type: 'LEC',
                  instructionMode: 'Online',
                  sessionCode: 'A1',
                  published: true,
                  enrollmentStatus: {
                    openSeats: 4,
                    waitlistCurrentSize: 0,
                    capacity: 30,
                    currentlyEnrolled: 26,
                  },
                },
              ],
            },
            {
              id: 'online-new',
              termCode: '1272',
              subjectCode: '220',
              courseId: '009999',
              enrollmentClassNumber: 40002,
              lastUpdated: 2000,
              onlineOnly: false,
              isAsynchronous: false,
              packageEnrollmentStatus: {
                status: 'OPEN',
                availableSeats: 4,
                waitlistTotal: 0,
              },
              enrollmentStatus: {
                openSeats: 4,
                waitlistCurrentSize: 0,
                capacity: 30,
                currentlyEnrolled: 26,
              },
              sections: [
                {
                  classUniqueId: { termCode: '1272', classNumber: 40001 },
                  sectionNumber: '001',
                  type: 'LEC',
                  instructionMode: 'Classroom Instruction',
                  sessionCode: 'A1',
                  published: true,
                  enrollmentStatus: {
                    openSeats: 4,
                    waitlistCurrentSize: 0,
                    capacity: 30,
                    currentlyEnrolled: 26,
                  },
                },
              ],
            },
          ],
        },
      ],
    },
  });

  try {
    const onlineCourseIds = fixture.db.prepare(`
      SELECT course_id
      FROM online_courses_v
      WHERE term_code = ?
      ORDER BY course_id
    `).pluck().all('1272');

    assert.deepEqual(onlineCourseIds, []);
  } finally {
    fixture.cleanup();
  }
});

test('online_courses_v ignores online-only sections that exist only in an older dropped package snapshot', () => {
  const fixture = buildCourseDbFixture({
    courses: [
      makeCourse({
        termCode: '1272',
        courseId: '010010',
        subjectCode: '220',
        catalogNumber: '340',
        courseDesignation: 'MATH 340',
        title: 'Dropped Online Section Repro',
      }),
    ],
    packageSnapshot: {
      termCode: '1272',
      results: [
        {
          course: {
            termCode: '1272',
            subjectCode: '220',
            courseId: '010010',
          },
          packages: [
            {
              id: 'online-old',
              termCode: '1272',
              subjectCode: '220',
              courseId: '010010',
              enrollmentClassNumber: 41000,
              lastUpdated: 1000,
              onlineOnly: true,
              isAsynchronous: true,
              packageEnrollmentStatus: {
                status: 'OPEN',
                availableSeats: 8,
                waitlistTotal: 0,
              },
              enrollmentStatus: {
                openSeats: 8,
                waitlistCurrentSize: 0,
                capacity: 40,
                currentlyEnrolled: 32,
              },
              sections: [
                {
                  classUniqueId: { termCode: '1272', classNumber: 41010 },
                  sectionNumber: '010',
                  type: 'LEC',
                  instructionMode: 'Online',
                  sessionCode: 'A1',
                  published: true,
                  enrollmentStatus: {
                    openSeats: 8,
                    waitlistCurrentSize: 0,
                    capacity: 40,
                    currentlyEnrolled: 32,
                  },
                },
                {
                  classUniqueId: { termCode: '1272', classNumber: 41011 },
                  sectionNumber: '011',
                  type: 'DIS',
                  instructionMode: 'Online',
                  sessionCode: 'A1',
                  published: true,
                  enrollmentStatus: {
                    openSeats: 8,
                    waitlistCurrentSize: 0,
                    capacity: 40,
                    currentlyEnrolled: 32,
                  },
                },
              ],
            },
            {
              id: 'inperson-new',
              termCode: '1272',
              subjectCode: '220',
              courseId: '010010',
              enrollmentClassNumber: 41010,
              lastUpdated: 2000,
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
                  classUniqueId: { termCode: '1272', classNumber: 41010 },
                  sectionNumber: '010',
                  type: 'LEC',
                  instructionMode: 'Classroom Instruction',
                  sessionCode: 'A1',
                  published: true,
                  enrollmentStatus: {
                    openSeats: 5,
                    waitlistCurrentSize: 0,
                    capacity: 40,
                    currentlyEnrolled: 35,
                  },
                },
              ],
            },
          ],
        },
      ],
    },
  });

  try {
    const onlineCourseIds = fixture.db.prepare(`
      SELECT course_id
      FROM online_courses_v
      WHERE term_code = ?
      ORDER BY course_id
    `).pluck().all('1272');

    assert.deepEqual(onlineCourseIds, []);
  } finally {
    fixture.cleanup();
  }
});

test('online_courses_v includes courses when the freshest qualifying package is canonical', () => {
  const fixture = buildCourseDbFixture({
    courses: [
      makeCourse({
        termCode: '1272',
        courseId: '010011',
        subjectCode: '220',
        catalogNumber: '341',
        courseDesignation: 'MATH 341',
        title: 'Fresh Online Section Repro',
      }),
    ],
    packageSnapshot: {
      termCode: '1272',
      results: [
        {
          course: {
            termCode: '1272',
            subjectCode: '220',
            courseId: '010011',
          },
          packages: [
            {
              id: 'inperson-old',
              termCode: '1272',
              subjectCode: '220',
              courseId: '010011',
              enrollmentClassNumber: 41020,
              lastUpdated: 1000,
              onlineOnly: false,
              isAsynchronous: false,
              packageEnrollmentStatus: {
                status: 'OPEN',
                availableSeats: 8,
                waitlistTotal: 0,
              },
              enrollmentStatus: {
                openSeats: 8,
                waitlistCurrentSize: 0,
                capacity: 40,
                currentlyEnrolled: 32,
              },
              sections: [
                {
                  classUniqueId: { termCode: '1272', classNumber: 41020 },
                  sectionNumber: '001',
                  type: 'LEC',
                  instructionMode: 'Classroom Instruction',
                  sessionCode: 'A1',
                  published: true,
                  enrollmentStatus: {
                    openSeats: 8,
                    waitlistCurrentSize: 0,
                    capacity: 40,
                    currentlyEnrolled: 32,
                  },
                },
              ],
            },
            {
              id: 'online-new',
              termCode: '1272',
              subjectCode: '220',
              courseId: '010011',
              enrollmentClassNumber: 41020,
              lastUpdated: 2000,
              onlineOnly: true,
              isAsynchronous: true,
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
                  classUniqueId: { termCode: '1272', classNumber: 41020 },
                  sectionNumber: '001',
                  type: 'LEC',
                  instructionMode: 'Online',
                  sessionCode: 'A1',
                  published: true,
                  enrollmentStatus: {
                    openSeats: 5,
                    waitlistCurrentSize: 0,
                    capacity: 40,
                    currentlyEnrolled: 35,
                  },
                },
              ],
            },
          ],
        },
      ],
    },
  });

  try {
    const onlineCourses = fixture.db.prepare(`
      SELECT course_id, title
      FROM online_courses_v
      WHERE term_code = ?
      ORDER BY course_id
    `).all('1272');

    assert.deepEqual(onlineCourses, [
      {
        course_id: '010011',
        title: 'Fresh Online Section Repro',
      },
    ]);
  } finally {
    fixture.cleanup();
  }
});

test('online_courses_v includes courses when any freshest package is online despite section tie-breaks', () => {
  const fixture = buildCourseDbFixture({
    courses: [
      makeCourse({
        termCode: '1272',
        courseId: '010012',
        subjectCode: '220',
        catalogNumber: '342',
        courseDesignation: 'MATH 342',
        title: 'Freshest Package Set Repro',
      }),
    ],
    packageSnapshot: {
      termCode: '1272',
      results: [
        {
          course: {
            termCode: '1272',
            subjectCode: '220',
            courseId: '010012',
          },
          packages: [
            {
              id: 'pkg-online-a',
              termCode: '1272',
              subjectCode: '220',
              courseId: '010012',
              enrollmentClassNumber: 41030,
              lastUpdated: 2000,
              onlineOnly: true,
              isAsynchronous: true,
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
                  classUniqueId: { termCode: '1272', classNumber: 41030 },
                  sectionNumber: '001',
                  type: 'LEC',
                  instructionMode: 'Online',
                  sessionCode: 'A1',
                  published: true,
                  enrollmentStatus: {
                    openSeats: 5,
                    waitlistCurrentSize: 0,
                    capacity: 40,
                    currentlyEnrolled: 35,
                  },
                },
              ],
            },
            {
              id: 'pkg-z-inperson',
              termCode: '1272',
              subjectCode: '220',
              courseId: '010012',
              enrollmentClassNumber: 41030,
              lastUpdated: 2000,
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
                  classUniqueId: { termCode: '1272', classNumber: 41030 },
                  sectionNumber: '001',
                  type: 'LEC',
                  instructionMode: 'Classroom Instruction',
                  sessionCode: 'A1',
                  published: true,
                  enrollmentStatus: {
                    openSeats: 5,
                    waitlistCurrentSize: 0,
                    capacity: 40,
                    currentlyEnrolled: 35,
                  },
                },
              ],
            },
          ],
        },
      ],
    },
  });

  try {
    const canonicalSourcePackageId = fixture.db.prepare(`
      SELECT source_package_id
      FROM section_overview_v
      WHERE term_code = ?
        AND course_id = ?
        AND section_class_number = ?
    `).pluck().get('1272', '010012', 41030);

    const onlineCourses = fixture.db.prepare(`
      SELECT course_id, title
      FROM online_courses_v
      WHERE term_code = ?
      ORDER BY course_id
    `).all('1272');

    assert.equal(canonicalSourcePackageId, '1272:220:010012:pkg-z-inperson');
    assert.deepEqual(onlineCourses, [
      {
        course_id: '010012',
        title: 'Freshest Package Set Repro',
      },
    ]);
  } finally {
    fixture.cleanup();
  }
});
