# AI-Friendly Course Database Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a local SQLite database plus AI-friendly views and docs so an LLM in this workspace can query Fall 2026 course data without struggling through massive JSON files.

**Architecture:** Keep the raw JSON snapshots as source inputs, import them into normalized SQLite tables, and expose a small set of flattened read-only views for common LLM questions. Pair the database with a schema guide and refresh metadata so AI can query it safely and understand how fresh the data is.

**Tech Stack:** Node 18, SQLite, existing JSON snapshots, Node test runner, SQL schema file

---

## File Structure

- `package.json`
  Purpose: add scripts and SQLite dependency for database build and inspection.
- `src/db/build-course-db.mjs`
  Purpose: entrypoint that reads JSON snapshots, creates the SQLite file, loads schema, imports rows, and records refresh metadata.
- `src/db/import-helpers.mjs`
  Purpose: pure transformation helpers for flattening JSON into course, package, section, meeting, instructor, and building rows.
- `src/db/schema.sql`
  Purpose: base tables, indexes, metadata tables, and AI-friendly views.
- `tests/db-import.test.mjs`
  Purpose: test the flattening and derived-field logic before implementation.
- `docs/querying-course-db.md`
  Purpose: teach local LLMs how to query the database safely and where to start.
- `data/fall-2026.sqlite`
  Purpose: generated SQLite database file.

### Task 1: Add the failing database import tests

**Files:**
- Modify: `package.json`
- Create: `tests/db-import.test.mjs`
- Test: `tests/db-import.test.mjs`

- [ ] **Step 1: Update `package.json` to include the DB build script and SQLite dependency**

```json
{
  "name": "madgrades-fall-2026-extractor",
  "private": true,
  "type": "module",
  "scripts": {
    "test": "node --test",
    "extract:fall-2026": "node scripts/extract-fall-2026-courses.mjs",
    "build:course-db": "node src/db/build-course-db.mjs"
  },
  "dependencies": {
    "better-sqlite3": "^11.8.1",
    "playwright": "^1.54.0"
  }
}
```

- [ ] **Step 2: Write the failing test file in `tests/db-import.test.mjs`**

```js
import test from 'node:test';
import assert from 'node:assert/strict';

import {
  makeCourseRow,
  makePackageRow,
  makeMeetingRows,
  makeBuildingRows,
  summarizeAvailability,
} from '../src/db/import-helpers.mjs';

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

test('makeCourseRow flattens a course record into one course table row', () => {
  const row = makeCourseRow(sampleCourse);

  assert.equal(row.term_code, '1272');
  assert.equal(row.course_id, '002983');
  assert.equal(row.subject_code, '232');
  assert.equal(row.title, 'Introductory Financial Accounting');
});

test('makePackageRow exposes availability flags for package-level queries', () => {
  const row = makePackageRow(samplePackage);

  assert.equal(row.package_status, 'OPEN');
  assert.equal(row.package_available_seats, 40);
  assert.equal(row.has_open_seats, 1);
  assert.equal(row.is_full, 0);
});

test('makeMeetingRows includes building coordinates for schedule reasoning', () => {
  const rows = makeMeetingRows(samplePackage);

  assert.equal(rows.length, 1);
  assert.equal(rows[0].building_code, '0140');
  assert.equal(rows[0].latitude, 43.0727);
  assert.equal(rows[0].longitude, -89.4015);
});

test('makeBuildingRows deduplicates buildings from repeated meetings', () => {
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

test('summarizeAvailability marks waitlisted or full rows correctly', () => {
  assert.deepEqual(summarizeAvailability({ openSeats: 0, waitlistCurrentSize: 3 }), {
    has_open_seats: 0,
    has_waitlist: 1,
    is_full: 1,
  });
});
```

- [ ] **Step 3: Run the targeted tests to verify they fail**

Run: `node --test tests/db-import.test.mjs`

Expected: FAIL with `ERR_MODULE_NOT_FOUND` for `src/db/import-helpers.mjs`

- [ ] **Step 4: Install dependencies**

Run: `npm install`

Expected: `better-sqlite3` added and `package-lock.json` updated

- [ ] **Step 5: No commit step**

This workspace is not a git repository, so skip commit steps in this plan.

### Task 2: Implement the pure import helpers until the tests pass

**Files:**
- Create: `src/db/import-helpers.mjs`
- Test: `tests/db-import.test.mjs`

- [ ] **Step 1: Create `src/db/import-helpers.mjs` with the minimal flattening helpers**

```js
function toIntFlag(value) {
  return value ? 1 : 0;
}

export function summarizeAvailability(status = {}) {
  const openSeats = status.openSeats ?? 0;
  const waitlistCurrentSize = status.waitlistCurrentSize ?? 0;

  return {
    has_open_seats: toIntFlag(openSeats > 0),
    has_waitlist: toIntFlag(waitlistCurrentSize > 0),
    is_full: toIntFlag(openSeats <= 0),
  };
}

export function makeCourseRow(course) {
  return {
    term_code: course.termCode,
    course_id: course.courseId,
    subject_code: course.subject?.subjectCode ?? null,
    subject_short_description: course.subject?.shortDescription ?? null,
    subject_description: course.subject?.description ?? null,
    catalog_number: course.catalogNumber ?? null,
    course_designation: course.courseDesignation ?? null,
    title: course.title ?? null,
    description: course.description ?? null,
    minimum_credits: course.minimumCredits ?? null,
    maximum_credits: course.maximumCredits ?? null,
    enrollment_prerequisites: course.enrollmentPrerequisites ?? null,
    currently_taught: toIntFlag(course.currentlyTaught),
    last_taught: course.lastTaught ?? null,
  };
}

export function makePackageRow(pkg) {
  const summary = summarizeAvailability(pkg.enrollmentStatus ?? {});

  return {
    package_id: String(pkg.id),
    term_code: pkg.termCode,
    subject_code: pkg.subjectCode,
    course_id: pkg.courseId,
    enrollment_class_number: pkg.enrollmentClassNumber ?? null,
    package_status: pkg.packageEnrollmentStatus?.status ?? null,
    package_available_seats: pkg.packageEnrollmentStatus?.availableSeats ?? 0,
    package_waitlist_total: pkg.packageEnrollmentStatus?.waitlistTotal ?? 0,
    online_only: toIntFlag(pkg.onlineOnly),
    is_asynchronous: toIntFlag(pkg.isAsynchronous),
    open_seats: pkg.enrollmentStatus?.openSeats ?? 0,
    waitlist_current_size: pkg.enrollmentStatus?.waitlistCurrentSize ?? 0,
    capacity: pkg.enrollmentStatus?.capacity ?? 0,
    currently_enrolled: pkg.enrollmentStatus?.currentlyEnrolled ?? 0,
    ...summary,
  };
}

export function makeMeetingRows(pkg) {
  return (pkg.sections ?? []).flatMap((section) =>
    (section.classMeetings ?? []).map((meeting, index) => ({
      package_id: String(pkg.id),
      section_class_number: section.classUniqueId?.classNumber ?? null,
      meeting_index: index,
      meeting_type: meeting.meetingType ?? null,
      meeting_time_start: meeting.meetingTimeStart ?? null,
      meeting_time_end: meeting.meetingTimeEnd ?? null,
      meeting_days: meeting.meetingDays ?? null,
      start_date: meeting.startDate ?? null,
      end_date: meeting.endDate ?? null,
      exam_date: meeting.examDate ?? null,
      room: meeting.room ?? null,
      building_code: meeting.building?.buildingCode ?? null,
      building_name: meeting.building?.buildingName ?? null,
      street_address: meeting.building?.streetAddress ?? null,
      latitude: meeting.building?.latitude ?? null,
      longitude: meeting.building?.longitude ?? null,
      is_exam: toIntFlag(meeting.meetingType === 'EXAM'),
      location_known: toIntFlag(Boolean(meeting.building?.latitude) && Boolean(meeting.building?.longitude)),
    })),
  );
}

export function makeBuildingRows(packages) {
  const byCode = new Map();

  for (const pkg of packages) {
    for (const meeting of makeMeetingRows(pkg)) {
      if (!meeting.building_code) continue;
      if (!byCode.has(meeting.building_code)) {
        byCode.set(meeting.building_code, {
          building_code: meeting.building_code,
          building_name: meeting.building_name,
          street_address: meeting.street_address,
          latitude: meeting.latitude,
          longitude: meeting.longitude,
        });
      }
    }
  }

  return [...byCode.values()];
}
```

- [ ] **Step 2: Run the targeted tests to verify they pass**

Run: `node --test tests/db-import.test.mjs`

Expected: PASS for all five tests

- [ ] **Step 3: Run the full test suite**

Run: `npm test`

Expected: PASS for both the existing extractor tests and the new DB helper tests

### Task 3: Add the SQLite schema with AI-friendly views

**Files:**
- Create: `src/db/schema.sql`
- Test: `src/db/schema.sql`

- [ ] **Step 1: Create `src/db/schema.sql`**

```sql
PRAGMA journal_mode = WAL;
PRAGMA foreign_keys = ON;

DROP VIEW IF EXISTS online_courses_v;
DROP VIEW IF EXISTS schedule_planning_v;
DROP VIEW IF EXISTS availability_v;
DROP VIEW IF EXISTS section_overview_v;
DROP VIEW IF EXISTS course_overview_v;

DROP TABLE IF EXISTS refresh_runs;
DROP TABLE IF EXISTS section_instructors;
DROP TABLE IF EXISTS instructors;
DROP TABLE IF EXISTS meetings;
DROP TABLE IF EXISTS sections;
DROP TABLE IF EXISTS packages;
DROP TABLE IF EXISTS courses;
DROP TABLE IF EXISTS buildings;

CREATE TABLE refresh_runs (
  refresh_id INTEGER PRIMARY KEY,
  snapshot_run_at TEXT NOT NULL,
  last_refreshed_at TEXT NOT NULL,
  source_term_code TEXT NOT NULL,
  snapshot_kind TEXT NOT NULL
);

CREATE TABLE courses (
  term_code TEXT NOT NULL,
  course_id TEXT NOT NULL,
  subject_code TEXT,
  subject_short_description TEXT,
  subject_description TEXT,
  catalog_number TEXT,
  course_designation TEXT,
  title TEXT,
  description TEXT,
  minimum_credits REAL,
  maximum_credits REAL,
  enrollment_prerequisites TEXT,
  currently_taught INTEGER,
  last_taught TEXT,
  PRIMARY KEY (term_code, course_id)
);

CREATE TABLE packages (
  package_id TEXT PRIMARY KEY,
  term_code TEXT NOT NULL,
  subject_code TEXT,
  course_id TEXT NOT NULL,
  enrollment_class_number INTEGER,
  package_status TEXT,
  package_available_seats INTEGER,
  package_waitlist_total INTEGER,
  online_only INTEGER,
  is_asynchronous INTEGER,
  open_seats INTEGER,
  waitlist_current_size INTEGER,
  capacity INTEGER,
  currently_enrolled INTEGER,
  has_open_seats INTEGER,
  has_waitlist INTEGER,
  is_full INTEGER
);

CREATE TABLE sections (
  package_id TEXT NOT NULL,
  section_class_number INTEGER NOT NULL,
  term_code TEXT NOT NULL,
  course_id TEXT NOT NULL,
  section_number TEXT,
  section_type TEXT,
  instruction_mode TEXT,
  session_code TEXT,
  published INTEGER,
  open_seats INTEGER,
  waitlist_current_size INTEGER,
  capacity INTEGER,
  currently_enrolled INTEGER,
  has_open_seats INTEGER,
  has_waitlist INTEGER,
  is_full INTEGER,
  PRIMARY KEY (package_id, section_class_number)
);

CREATE TABLE meetings (
  package_id TEXT NOT NULL,
  section_class_number INTEGER,
  meeting_index INTEGER NOT NULL,
  meeting_type TEXT,
  meeting_time_start INTEGER,
  meeting_time_end INTEGER,
  meeting_days TEXT,
  start_date INTEGER,
  end_date INTEGER,
  exam_date INTEGER,
  room TEXT,
  building_code TEXT,
  building_name TEXT,
  street_address TEXT,
  latitude REAL,
  longitude REAL,
  is_exam INTEGER,
  location_known INTEGER,
  PRIMARY KEY (package_id, section_class_number, meeting_index)
);

CREATE TABLE buildings (
  building_code TEXT PRIMARY KEY,
  building_name TEXT,
  street_address TEXT,
  latitude REAL,
  longitude REAL
);

CREATE TABLE instructors (
  instructor_key TEXT PRIMARY KEY,
  netid TEXT,
  email TEXT,
  first_name TEXT,
  last_name TEXT
);

CREATE TABLE section_instructors (
  package_id TEXT NOT NULL,
  section_class_number INTEGER NOT NULL,
  instructor_key TEXT NOT NULL,
  PRIMARY KEY (package_id, section_class_number, instructor_key)
);

CREATE INDEX idx_courses_subject ON courses(subject_code, catalog_number);
CREATE INDEX idx_packages_course ON packages(term_code, course_id);
CREATE INDEX idx_sections_course ON sections(term_code, course_id, section_type);
CREATE INDEX idx_meetings_building ON meetings(building_code);

CREATE VIEW course_overview_v AS
SELECT
  c.term_code,
  c.subject_code,
  c.catalog_number,
  c.course_id,
  c.course_designation,
  c.title,
  c.minimum_credits,
  c.maximum_credits,
  COUNT(DISTINCT s.section_class_number) AS section_count,
  MAX(s.has_open_seats) AS has_any_open_seats,
  MAX(s.has_waitlist) AS has_any_waitlist,
  MAX(s.is_full) AS has_any_full_section
FROM courses c
LEFT JOIN sections s
  ON s.term_code = c.term_code AND s.course_id = c.course_id
GROUP BY
  c.term_code, c.subject_code, c.catalog_number, c.course_id,
  c.course_designation, c.title, c.minimum_credits, c.maximum_credits;

CREATE VIEW section_overview_v AS
SELECT
  s.term_code,
  c.subject_code,
  c.catalog_number,
  c.course_designation,
  c.title,
  s.section_class_number,
  s.section_number,
  s.section_type,
  s.instruction_mode,
  s.session_code,
  s.open_seats,
  s.waitlist_current_size,
  s.capacity,
  s.currently_enrolled,
  s.has_open_seats,
  s.has_waitlist,
  s.is_full
FROM sections s
JOIN courses c
  ON c.term_code = s.term_code AND c.course_id = s.course_id;

CREATE VIEW availability_v AS
SELECT
  p.term_code,
  c.subject_code,
  c.catalog_number,
  c.course_designation,
  c.title,
  p.package_id,
  p.package_status,
  p.package_available_seats,
  p.package_waitlist_total,
  p.open_seats,
  p.waitlist_current_size,
  p.has_open_seats,
  p.has_waitlist,
  p.is_full,
  p.online_only,
  p.is_asynchronous
FROM packages p
JOIN courses c
  ON c.term_code = p.term_code AND c.course_id = p.course_id;

CREATE VIEW schedule_planning_v AS
SELECT
  s.term_code,
  c.subject_code,
  c.catalog_number,
  c.course_designation,
  c.title,
  s.section_class_number,
  s.section_number,
  s.section_type,
  s.instruction_mode,
  m.meeting_type,
  m.meeting_days,
  m.meeting_time_start,
  m.meeting_time_end,
  m.room,
  m.building_code,
  m.building_name,
  m.street_address,
  m.latitude,
  m.longitude,
  m.location_known,
  s.has_open_seats,
  s.is_full
FROM meetings m
JOIN sections s
  ON s.package_id = m.package_id AND s.section_class_number = m.section_class_number
JOIN courses c
  ON c.term_code = s.term_code AND c.course_id = s.course_id;

CREATE VIEW online_courses_v AS
SELECT *
FROM section_overview_v
WHERE instruction_mode LIKE '%Online%';
```

- [ ] **Step 2: Validate the schema file by reading it for syntax mistakes before wiring it into code**

Run: `sed -n '1,260p' src/db/schema.sql`

Expected: the file includes all base tables and all five views named in the spec

### Task 4: Implement the SQLite build script

**Files:**
- Create: `src/db/build-course-db.mjs`
- Modify: `src/db/import-helpers.mjs`
- Modify: `src/db/schema.sql`
- Test: `tests/db-import.test.mjs`

- [ ] **Step 1: Extend `src/db/import-helpers.mjs` with section and instructor row helpers**

```js
export function makeSectionRows(pkg) {
  return (pkg.sections ?? []).map((section) => {
    const summary = summarizeAvailability(section.enrollmentStatus ?? {});

    return {
      package_id: String(pkg.id),
      section_class_number: section.classUniqueId?.classNumber ?? null,
      term_code: section.classUniqueId?.termCode ?? pkg.termCode,
      course_id: pkg.courseId,
      section_number: section.sectionNumber ?? null,
      section_type: section.type ?? null,
      instruction_mode: section.instructionMode ?? null,
      session_code: section.sessionCode ?? null,
      published: section.published ? 1 : 0,
      open_seats: section.enrollmentStatus?.openSeats ?? 0,
      waitlist_current_size: section.enrollmentStatus?.waitlistCurrentSize ?? 0,
      capacity: section.enrollmentStatus?.capacity ?? 0,
      currently_enrolled: section.enrollmentStatus?.currentlyEnrolled ?? 0,
      ...summary,
    };
  });
}

export function makeInstructorRows(pkg) {
  const rows = [];

  for (const section of pkg.sections ?? []) {
    for (const instructor of section.instructors ?? []) {
      const instructorKey = instructor.netid ?? instructor.email ?? `${instructor.name?.first ?? ''}:${instructor.name?.last ?? ''}`;
      rows.push({
        instructor_key: instructorKey,
        netid: instructor.netid ?? null,
        email: instructor.email ?? null,
        first_name: instructor.name?.first ?? null,
        last_name: instructor.name?.last ?? null,
        package_id: String(pkg.id),
        section_class_number: section.classUniqueId?.classNumber ?? null,
      });
    }
  }

  return rows;
}
```

- [ ] **Step 2: Create `src/db/build-course-db.mjs`**

```js
import fs from 'node:fs';
import path from 'node:path';
import Database from 'better-sqlite3';

import {
  makeBuildingRows,
  makeCourseRow,
  makeInstructorRows,
  makeMeetingRows,
  makePackageRow,
  makeSectionRows,
} from './import-helpers.mjs';

const root = process.cwd();
const dataDir = path.join(root, 'data');
const coursesPath = path.join(dataDir, 'fall-2026-courses.json');
const packagesPath = path.join(dataDir, 'fall-2026-enrollment-packages.json');
const dbPath = path.join(dataDir, 'fall-2026.sqlite');
const schemaPath = path.join(root, 'src', 'db', 'schema.sql');

const courses = JSON.parse(fs.readFileSync(coursesPath, 'utf8'));
const packageSnapshot = JSON.parse(fs.readFileSync(packagesPath, 'utf8'));
const packages = packageSnapshot.results.map((entry) => ({
  ...entry,
  id: entry.package_id ?? entry.packageId ?? entry.endpoint ?? `${entry.course.course_id}:${entry.endpoint}`,
}));

const db = new Database(dbPath);
db.pragma('journal_mode = WAL');

try {
  db.exec(fs.readFileSync(schemaPath, 'utf8'));

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
      package_id, term_code, subject_code, course_id, enrollment_class_number,
      package_status, package_available_seats, package_waitlist_total, online_only,
      is_asynchronous, open_seats, waitlist_current_size, capacity, currently_enrolled,
      has_open_seats, has_waitlist, is_full
    ) VALUES (
      @package_id, @term_code, @subject_code, @course_id, @enrollment_class_number,
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

  const insertMeeting = db.prepare(`
    INSERT INTO meetings (
      package_id, section_class_number, meeting_index, meeting_type, meeting_time_start,
      meeting_time_end, meeting_days, start_date, end_date, exam_date, room,
      building_code, building_name, street_address, latitude, longitude, is_exam, location_known
    ) VALUES (
      @package_id, @section_class_number, @meeting_index, @meeting_type, @meeting_time_start,
      @meeting_time_end, @meeting_days, @start_date, @end_date, @exam_date, @room,
      @building_code, @building_name, @street_address, @latitude, @longitude, @is_exam, @location_known
    )
  `);

  const insertBuilding = db.prepare(`
    INSERT OR REPLACE INTO buildings (
      building_code, building_name, street_address, latitude, longitude
    ) VALUES (
      @building_code, @building_name, @street_address, @latitude, @longitude
    )
  `);

  const insertInstructor = db.prepare(`
    INSERT OR IGNORE INTO instructors (
      instructor_key, netid, email, first_name, last_name
    ) VALUES (
      @instructor_key, @netid, @email, @first_name, @last_name
    )
  `);

  const insertSectionInstructor = db.prepare(`
    INSERT OR IGNORE INTO section_instructors (
      package_id, section_class_number, instructor_key
    ) VALUES (
      @package_id, @section_class_number, @instructor_key
    )
  `);

  const insertRefreshRun = db.prepare(`
    INSERT INTO refresh_runs (
      snapshot_run_at, last_refreshed_at, source_term_code, snapshot_kind
    ) VALUES (
      @snapshot_run_at, @last_refreshed_at, @source_term_code, @snapshot_kind
    )
  `);

  const transaction = db.transaction(() => {
    for (const course of courses) {
      insertCourse.run(makeCourseRow(course));
    }

    const packageRecords = packages.flatMap((entry) => entry.packages ?? []);

    for (const pkg of packageRecords) {
      insertPackage.run(makePackageRow(pkg));
      for (const row of makeSectionRows(pkg)) insertSection.run(row);
      for (const row of makeMeetingRows(pkg)) insertMeeting.run(row);
      for (const row of makeInstructorRows(pkg)) {
        insertInstructor.run(row);
        insertSectionInstructor.run(row);
      }
    }

    for (const row of makeBuildingRows(packageRecords)) {
      insertBuilding.run(row);
    }

    const now = new Date().toISOString();
    insertRefreshRun.run({
      snapshot_run_at: now,
      last_refreshed_at: now,
      source_term_code: '1272',
      snapshot_kind: 'daily_full_refresh',
    });
  });

  transaction();
  console.log(`Built ${dbPath}`);
} finally {
  db.close();
}
```

- [ ] **Step 3: Fix the package record mapping so package IDs stay stable and package arrays flatten correctly**

Replace this line:

```js
const packages = packageSnapshot.results.map((entry) => ({
  ...entry,
  id: entry.package_id ?? entry.packageId ?? entry.endpoint ?? `${entry.course.course_id}:${entry.endpoint}`,
}));
```

With this block:

```js
const packageRecords = packageSnapshot.results.flatMap((entry) =>
  (entry.packages ?? []).map((pkg) => ({
    ...pkg,
    id: pkg.id ?? `${entry.course.course_id}:${pkg.enrollmentClassNumber ?? 'unknown'}`,
  })),
);
```

And replace this line inside the transaction:

```js
const packageRecords = packages.flatMap((entry) => entry.packages ?? []);
```

With:

```js
for (const pkg of packageRecords) {
```

Then delete the now-obsolete loop opener:

```js
for (const pkg of packageRecords) {
```

And keep the body exactly once.

- [ ] **Step 4: Run the full test suite again**

Run: `npm test`

Expected: PASS for all tests

### Task 5: Build the database and verify the AI-facing views

**Files:**
- Create: `data/fall-2026.sqlite`
- Test: `data/fall-2026.sqlite`

- [ ] **Step 1: Build the database**

Run: `npm run build:course-db`

Expected: exit code `0` and `data/fall-2026.sqlite` created

- [ ] **Step 2: Verify the core table counts**

Run: `node -e "const Database=require('better-sqlite3');const db=new Database('data/fall-2026.sqlite',{readonly:true});console.log(JSON.stringify({courses:db.prepare('select count(*) as n from courses').get().n,packages:db.prepare('select count(*) as n from packages').get().n,sections:db.prepare('select count(*) as n from sections').get().n,meetings:db.prepare('select count(*) as n from meetings').get().n},null,2));db.close();"`

Expected: non-zero counts for all four core tables

- [ ] **Step 3: Verify the AI-friendly views answer useful questions**

Run: `node -e "const Database=require('better-sqlite3');const db=new Database('data/fall-2026.sqlite',{readonly:true});console.log(db.prepare('select subject_code,catalog_number,title,has_any_open_seats from course_overview_v order by subject_code,catalog_number limit 5').all());db.close();"`

Expected: five readable rows from `course_overview_v`

- [ ] **Step 4: Verify location data exists for schedule reasoning**

Run: `node -e "const Database=require('better-sqlite3');const db=new Database('data/fall-2026.sqlite',{readonly:true});console.log(db.prepare('select building_name,latitude,longitude from schedule_planning_v where location_known = 1 limit 5').all());db.close();"`

Expected: rows with non-null building names and coordinates

### Task 6: Add the LLM query guide

**Files:**
- Create: `docs/querying-course-db.md`

- [ ] **Step 1: Create `docs/querying-course-db.md`**

```md
# Querying The Course Database

## Start Here

- Primary database: `data/fall-2026.sqlite`
- Query the views first:
  - `course_overview_v`
  - `section_overview_v`
  - `availability_v`
  - `schedule_planning_v`
  - `online_courses_v`
- Use base tables only when a view does not expose the detail you need.

## Freshness

- Availability is snapshot data, not live enrollment truth.
- Check `refresh_runs` to see when the last rebuild happened.

## Useful Queries

### Open sections in a subject

```sql
SELECT *
FROM section_overview_v
WHERE subject_code = '232' AND has_open_seats = 1
ORDER BY catalog_number, section_number;
```

### Full sections with waitlists

```sql
SELECT *
FROM availability_v
WHERE is_full = 1 AND has_waitlist = 1
ORDER BY subject_code, catalog_number;
```

### Online-only sections

```sql
SELECT *
FROM online_courses_v
ORDER BY subject_code, catalog_number, section_number;
```

### Schedule planning rows with known locations

```sql
SELECT *
FROM schedule_planning_v
WHERE location_known = 1
ORDER BY subject_code, catalog_number, section_number;
```
```

- [ ] **Step 2: Verify the guide is readable and points to the right file names**

Run: `sed -n '1,240p' docs/querying-course-db.md`

Expected: the guide names `data/fall-2026.sqlite` and the five views correctly
