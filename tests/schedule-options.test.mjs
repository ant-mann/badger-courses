import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { execFileSync } from 'node:child_process';
import { fileURLToPath, pathToFileURL } from 'node:url';

import Database from 'better-sqlite3';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.join(__dirname, '..');

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
  const fixtureRoot = fs.mkdtempSync(path.join(repoRoot, '.tmp-schedule-options-'));
  const fixtureDbDir = path.join(fixtureRoot, 'src', 'db');
  const fixtureDataDir = path.join(fixtureRoot, 'data');

  fs.mkdirSync(fixtureDbDir, { recursive: true });
  fs.mkdirSync(fixtureDataDir, { recursive: true });

  fs.copyFileSync(path.join(repoRoot, 'src/db/build-course-db.mjs'), path.join(fixtureDbDir, 'build-course-db.mjs'));
  fs.copyFileSync(path.join(repoRoot, 'src/db/import-helpers.mjs'), path.join(fixtureDbDir, 'import-helpers.mjs'));
  fs.copyFileSync(path.join(repoRoot, 'src/db/prerequisite-helpers.mjs'), path.join(fixtureDbDir, 'prerequisite-helpers.mjs'));
  fs.copyFileSync(path.join(repoRoot, 'src/db/prerequisite-summary-helpers.mjs'), path.join(fixtureDbDir, 'prerequisite-summary-helpers.mjs'));
  fs.copyFileSync(path.join(repoRoot, 'src/db/schedule-helpers.mjs'), path.join(fixtureDbDir, 'schedule-helpers.mjs'));
  fs.copyFileSync(path.join(repoRoot, 'src/db/schema.sql'), path.join(fixtureDbDir, 'schema.sql'));

  writeJson(path.join(fixtureDataDir, 'fall-2026-courses.json'), courses);
  writeJson(path.join(fixtureDataDir, 'fall-2026-enrollment-packages.json'), packageSnapshot);

  execFileSync(process.execPath, [path.join(fixtureDbDir, 'build-course-db.mjs')], {
    cwd: fixtureRoot,
    stdio: 'pipe',
  });

  const dbPath = path.join(fixtureDataDir, 'fall-2026.sqlite');
  const db = new Database(dbPath, { readonly: true });

  return {
    db,
    dbPath,
    cleanup() {
      db.close();
      fs.rmSync(fixtureRoot, { recursive: true, force: true });
    },
  };
}

function buildScheduleReadModelFixture() {
  return {
    courses: [
      makeCourse({
        termCode: '1272',
        courseId: '003210',
        subjectCode: '220',
        catalogNumber: '340',
        courseDesignation: 'STAT 340',
        title: 'Data Science Modeling',
      }),
      makeCourse({
        termCode: '1272',
        courseId: '004620',
        subjectCode: '350',
        catalogNumber: '462',
        courseDesignation: 'ENGL 462',
        title: 'Writing for Digital Systems',
      }),
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
            subjectCode: '220',
            courseId: '003210',
          },
          packages: [
            {
              id: 'stat340-main',
              termCode: '1272',
              subjectCode: '220',
              courseId: '003210',
              enrollmentClassNumber: 33210,
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
                  classUniqueId: { termCode: '1272', classNumber: 33211 },
                  sectionNumber: '002',
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
                  classMeetings: [
                    {
                      meetingType: 'CLASS',
                      meetingTimeStart: 75600000,
                      meetingTimeEnd: 81000000,
                      meetingDays: 'MW',
                      startDate: 1788325200000,
                      endDate: 1796796000000,
                      room: '140',
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
                  classUniqueId: { termCode: '1272', classNumber: 33212 },
                  sectionNumber: '323',
                  type: 'DIS',
                  instructionMode: 'Classroom Instruction',
                  sessionCode: 'A1',
                  published: true,
                  enrollmentStatus: {
                    openSeats: 4,
                    waitlistCurrentSize: 0,
                    capacity: 20,
                    currentlyEnrolled: 16,
                  },
                  classMeetings: [
                    {
                      meetingType: 'CLASS',
                      meetingTimeStart: 83100000,
                      meetingTimeEnd: 86700000,
                      meetingDays: 'R',
                      startDate: 1788325200000,
                      endDate: 1796796000000,
                      room: '231',
                      building: {
                        buildingCode: '0020',
                        buildingName: 'Van Vleck Hall',
                        streetAddress: '480 Lincoln Dr.',
                        latitude: 43.0702,
                        longitude: -89.4034,
                      },
                    },
                  ],
                },
              ],
            },
            {
              id: 'stat340-alt',
              termCode: '1272',
              subjectCode: '220',
              courseId: '003210',
              enrollmentClassNumber: 33220,
              lastUpdated: 2000,
              onlineOnly: false,
              isAsynchronous: false,
              packageEnrollmentStatus: {
                status: 'OPEN',
                availableSeats: 6,
                waitlistTotal: 0,
              },
              enrollmentRequirementGroups: {
                catalogRequirementGroups: [
                  {
                    description: 'Restriction will be removed on October 15 for all students.',
                  },
                ],
                classAssociationRequirementGroups: [],
              },
              enrollmentStatus: {
                openSeats: 6,
                waitlistCurrentSize: 0,
                capacity: 30,
                currentlyEnrolled: 24,
              },
              sections: [
                {
                  classUniqueId: { termCode: '1272', classNumber: 33221 },
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
                  classMeetings: [
                    {
                      meetingType: 'CLASS',
                      meetingTimeStart: 100800000,
                      meetingTimeEnd: 106200000,
                      meetingDays: 'MW',
                      startDate: 1788325200000,
                      endDate: 1796796000000,
                      room: '224',
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
                  classUniqueId: { termCode: '1272', classNumber: 33222 },
                  sectionNumber: '324',
                  type: 'DIS',
                  instructionMode: 'Classroom Instruction',
                  sessionCode: 'A1',
                  published: true,
                  enrollmentStatus: {
                    openSeats: 6,
                    waitlistCurrentSize: 0,
                    capacity: 20,
                    currentlyEnrolled: 14,
                  },
                  classMeetings: [
                    {
                      meetingType: 'CLASS',
                      meetingTimeStart: 62700000,
                      meetingTimeEnd: 66300000,
                      meetingDays: 'R',
                      startDate: 1788325200000,
                      endDate: 1796796000000,
                      room: '111',
                      building: {
                        buildingCode: '0251',
                        buildingName: 'Humanities Building',
                        streetAddress: '455 N Park St.',
                        latitude: 43.0723,
                        longitude: -89.4012,
                      },
                    },
                  ],
                },
              ],
            },
          ],
        },
        {
          course: {
            termCode: '1272',
            subjectCode: '350',
            courseId: '004620',
          },
          packages: [
            {
              id: 'engl462-main',
              termCode: '1272',
              subjectCode: '350',
              courseId: '004620',
              enrollmentClassNumber: 44620,
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
                capacity: 25,
                currentlyEnrolled: 20,
              },
              sections: [
                {
                  classUniqueId: { termCode: '1272', classNumber: 44621 },
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
                  classMeetings: [
                    {
                      meetingType: 'CLASS',
                      meetingTimeStart: 57600000,
                      meetingTimeEnd: 62100000,
                      meetingDays: 'TR',
                      startDate: 1788325200000,
                      endDate: 1796796000000,
                      room: '203',
                      building: {
                        buildingCode: '0251',
                        buildingName: 'Humanities Building',
                        streetAddress: '455 N Park St.',
                        latitude: 43.0723,
                        longitude: -89.4012,
                      },
                    },
                  ],
                },
              ],
            },
          ],
        },
        {
          course: {
            termCode: '1272',
            subjectCode: '302',
            courseId: '005770',
          },
          packages: [
            {
              id: 'cs577-main',
              termCode: '1272',
              subjectCode: '302',
              courseId: '005770',
              enrollmentClassNumber: 55770,
              lastUpdated: 2000,
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
                  classUniqueId: { termCode: '1272', classNumber: 55771 },
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
                  classMeetings: [
                    {
                      meetingType: 'CLASS',
                      meetingTimeStart: 78600000,
                      meetingTimeEnd: 84000000,
                      meetingDays: 'MW',
                      startDate: 1788325200000,
                      endDate: 1796796000000,
                      room: '1240',
                      building: {
                        buildingCode: '0231',
                        buildingName: 'Computer Sciences',
                        streetAddress: '1210 W Dayton St.',
                        latitude: 43.0715,
                        longitude: -89.4066,
                      },
                    },
                  ],
                },
              ],
            },
          ],
        },
      ],
    },
  };
}

function buildSharedLecturePackageFixture() {
  return {
    courses: [
      makeCourse({
        termCode: '1272',
        courseId: '009901',
        subjectCode: '220',
        catalogNumber: '555',
        courseDesignation: 'STAT 555',
        title: 'Shared Lecture Packages',
      }),
    ],
    packageSnapshot: {
      termCode: '1272',
      results: [
        {
          course: {
            termCode: '1272',
            subjectCode: '220',
            courseId: '009901',
          },
          packages: [
            {
              id: 'pkg-a',
              termCode: '1272',
              subjectCode: '220',
              courseId: '009901',
              enrollmentClassNumber: 59001,
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
                  classUniqueId: { termCode: '1272', classNumber: 59011 },
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
                  classMeetings: [
                    {
                      meetingType: 'CLASS',
                      meetingTimeStart: 54000000,
                      meetingTimeEnd: 57000000,
                      meetingDays: 'MW',
                      startDate: 1788325200000,
                      endDate: 1796796000000,
                      room: '140',
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
                  classUniqueId: { termCode: '1272', classNumber: 59012 },
                  sectionNumber: '301',
                  type: 'DIS',
                  instructionMode: 'Classroom Instruction',
                  sessionCode: 'A1',
                  published: true,
                  enrollmentStatus: {
                    openSeats: 4,
                    waitlistCurrentSize: 0,
                    capacity: 20,
                    currentlyEnrolled: 16,
                  },
                  classMeetings: [
                    {
                      meetingType: 'CLASS',
                      meetingTimeStart: 68400000,
                      meetingTimeEnd: 71400000,
                      meetingDays: 'T',
                      startDate: 1788325200000,
                      endDate: 1796796000000,
                      room: '231',
                      building: {
                        buildingCode: '0020',
                        buildingName: 'Van Vleck Hall',
                        streetAddress: '480 Lincoln Dr.',
                        latitude: 43.0702,
                        longitude: -89.4034,
                      },
                    },
                  ],
                },
              ],
            },
            {
              id: 'pkg-z',
              termCode: '1272',
              subjectCode: '220',
              courseId: '009901',
              enrollmentClassNumber: 59002,
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
                capacity: 30,
                currentlyEnrolled: 25,
              },
              sections: [
                {
                  classUniqueId: { termCode: '1272', classNumber: 59011 },
                  sectionNumber: '001',
                  type: 'LEC',
                  instructionMode: 'Classroom Instruction',
                  sessionCode: 'A1',
                  published: true,
                  enrollmentStatus: {
                    openSeats: 5,
                    waitlistCurrentSize: 0,
                    capacity: 30,
                    currentlyEnrolled: 25,
                  },
                  classMeetings: [
                    {
                      meetingType: 'CLASS',
                      meetingTimeStart: 54000000,
                      meetingTimeEnd: 57000000,
                      meetingDays: 'MW',
                      startDate: 1788325200000,
                      endDate: 1796796000000,
                      room: '140',
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
                  classUniqueId: { termCode: '1272', classNumber: 59013 },
                  sectionNumber: '302',
                  type: 'DIS',
                  instructionMode: 'Classroom Instruction',
                  sessionCode: 'A1',
                  published: true,
                  enrollmentStatus: {
                    openSeats: 5,
                    waitlistCurrentSize: 0,
                    capacity: 20,
                    currentlyEnrolled: 15,
                  },
                  classMeetings: [
                    {
                      meetingType: 'CLASS',
                      meetingTimeStart: 72000000,
                      meetingTimeEnd: 75000000,
                      meetingDays: 'R',
                      startDate: 1788325200000,
                      endDate: 1796796000000,
                      room: '1240',
                      building: {
                        buildingCode: '0231',
                        buildingName: 'Computer Sciences',
                        streetAddress: '1210 W Dayton St.',
                        latitude: 43.0715,
                        longitude: -89.4066,
                      },
                    },
                  ],
                },
              ],
            },
          ],
        },
      ],
    },
  };
}

async function loadScheduleEngineModule() {
  return import(`${pathToFileURL(path.join(repoRoot, 'src', 'schedule', 'engine.mjs')).href}?cacheBust=${Date.now()}`);
}

function makeTestCandidate(packageId, overrides = {}) {
  return {
    packageId,
    courseDesignation: overrides.courseDesignation ?? packageId.split('-')[0].toUpperCase(),
    title: overrides.title ?? packageId,
    sectionBundleLabel: overrides.sectionBundleLabel ?? packageId,
    openSeats: overrides.openSeats ?? 1,
    isFull: overrides.isFull ?? 0,
    hasWaitlist: overrides.hasWaitlist ?? 0,
    meetingCount: overrides.meetingCount ?? 0,
    campusDayCount: overrides.campusDayCount ?? 0,
    earliestStartMinuteLocal: overrides.earliestStartMinuteLocal ?? null,
    latestEndMinuteLocal: overrides.latestEndMinuteLocal ?? null,
    hasOnlineMeeting: overrides.hasOnlineMeeting ?? 0,
    hasUnknownLocation: overrides.hasUnknownLocation ?? 0,
    restrictionNote: overrides.restrictionNote ?? null,
    hasTemporaryRestriction: overrides.hasTemporaryRestriction ?? 0,
    meetingSummaryLocal: overrides.meetingSummaryLocal ?? null,
    meetings: overrides.meetings ?? [],
  };
}

test('schedule-options returns only conflict-free ranked schedules', () => {
  const fixture = buildCourseDbFixture(buildScheduleReadModelFixture());

  try {
    const output = execFileSync(process.execPath, [
      path.join(repoRoot, 'scripts', 'schedule-options.mjs'),
      '--db',
      fixture.dbPath,
      '--course',
      'STAT 340',
      '--course',
      'ENGL 462',
      '--course',
      'COMP SCI 577',
      '--lock-package',
      '1272:220:003210:stat340-alt',
    ], {
      encoding: 'utf8',
    });

    const parsed = JSON.parse(output);

    assert.equal(parsed.schedules.length > 0, true);
    assert.equal(parsed.schedules.every((schedule) => schedule.conflict_count === 0), true);
    assert.equal(
      parsed.schedules.every((schedule) => schedule.package_ids.includes('1272:220:003210:stat340-alt')),
      true,
    );
    assert.deepEqual(parsed.schedules[0].package_ids, [
      '1272:220:003210:stat340-alt',
      '1272:302:005770:cs577-main',
      '1272:350:004620:engl462-main',
    ]);
    assert.equal(parsed.schedules[0].packages.length, 3);
    assert.equal(parsed.schedules[0].packages[0].section_bundle_label != null, true);
    assert.equal(parsed.schedules[0].packages[0].meeting_summary_local != null, true);
    assert.equal(typeof parsed.schedules[0].packages[0].campus_day_count, 'number');
    assert.equal(typeof parsed.schedules[0].packages[0].earliest_start_minute_local, 'number');
    assert.equal(typeof parsed.schedules[0].packages[0].latest_end_minute_local, 'number');
    assert.equal(typeof parsed.schedules[0].packages[0].has_temporary_restriction, 'number');
  } finally {
    fixture.cleanup();
  }
});

test('buildSchedules uses the default preference order when limit is 1', async () => {
  const scheduleEngine = await loadScheduleEngineModule();
  const schedules = scheduleEngine.buildSchedules({
    orderedGroups: [
      {
        courseDesignation: 'COURSE A',
        candidates: [
          makeTestCandidate('a-early-compact', {
            courseDesignation: 'COURSE A',
            campusDayCount: 1,
            earliestStartMinuteLocal: 480,
            latestEndMinuteLocal: 840,
            meetings: [{ days_mask: 1, start_minute_local: 480, end_minute_local: 540, is_online: 0 }],
          }),
          makeTestCandidate('a-late-spread', {
            courseDesignation: 'COURSE A',
            campusDayCount: 3,
            earliestStartMinuteLocal: 720,
            latestEndMinuteLocal: 900,
            meetings: [
              { days_mask: 1, start_minute_local: 720, end_minute_local: 780, is_online: 0 },
              { days_mask: 2, start_minute_local: 720, end_minute_local: 780, is_online: 0 },
            ],
          }),
        ],
      },
      {
        courseDesignation: 'COURSE B',
        candidates: [
          makeTestCandidate('b-1', {
            courseDesignation: 'COURSE B',
            meetings: [{ days_mask: 2, start_minute_local: 840, end_minute_local: 900, is_online: 0 }],
          }),
        ],
      },
    ],
    lockedByCourse: new Map(),
    conflicts: new Map(),
    transitions: new Map(),
    limit: 1,
  });

  assert.equal(schedules.length, 1);
  assert.deepEqual(schedules[0].package_ids, ['a-late-spread', 'b-1']);
});

test('buildSchedules changes the top result when preferenceOrder changes', async () => {
  const scheduleEngine = await loadScheduleEngineModule();
  const schedules = scheduleEngine.buildSchedules({
    orderedGroups: [
      {
        courseDesignation: 'COURSE A',
        candidates: [
          makeTestCandidate('a-early-compact', {
            courseDesignation: 'COURSE A',
            campusDayCount: 1,
            earliestStartMinuteLocal: 480,
            latestEndMinuteLocal: 840,
            meetings: [{ days_mask: 1, start_minute_local: 480, end_minute_local: 540, is_online: 0 }],
          }),
          makeTestCandidate('a-late-spread', {
            courseDesignation: 'COURSE A',
            campusDayCount: 3,
            earliestStartMinuteLocal: 720,
            latestEndMinuteLocal: 900,
            meetings: [
              { days_mask: 1, start_minute_local: 720, end_minute_local: 780, is_online: 0 },
              { days_mask: 2, start_minute_local: 720, end_minute_local: 780, is_online: 0 },
            ],
          }),
        ],
      },
      {
        courseDesignation: 'COURSE B',
        candidates: [
          makeTestCandidate('b-1', {
            courseDesignation: 'COURSE B',
            meetings: [{ days_mask: 1, start_minute_local: 840, end_minute_local: 900, is_online: 0 }],
          }),
        ],
      },
    ],
    lockedByCourse: new Map(),
    conflicts: new Map(),
    transitions: new Map(),
    preferenceOrder: [
      'fewer-campus-days',
      'later-starts',
      'fewer-long-gaps',
      'earlier-finishes',
    ],
    limit: 1,
  });

  assert.equal(schedules.length, 1);
  assert.deepEqual(schedules[0].package_ids, ['a-early-compact', 'b-1']);
});

test('buildSchedules collapses duplicate visible schedules from equivalent package variants', async () => {
  const scheduleEngine = await loadScheduleEngineModule();
  const schedules = scheduleEngine.buildSchedules({
    orderedGroups: [
      {
        courseDesignation: 'COURSE A',
        candidates: [
          makeTestCandidate('a-crosslist-z', {
            courseDesignation: 'COURSE A',
            sectionBundleLabel: 'COURSE A LEC 001',
            meetingSummaryLocal: 'M 9:00 AM-10:00 AM',
            openSeats: 1,
            campusDayCount: 1,
            earliestStartMinuteLocal: 540,
            latestEndMinuteLocal: 600,
            meetings: [{ days_mask: 1, start_minute_local: 540, end_minute_local: 600, is_online: 0 }],
          }),
          makeTestCandidate('a-crosslist-a', {
            courseDesignation: 'COURSE A',
            sectionBundleLabel: 'COURSE A LEC 001',
            meetingSummaryLocal: 'M 9:00 AM-10:00 AM',
            openSeats: 4,
            campusDayCount: 1,
            earliestStartMinuteLocal: 540,
            latestEndMinuteLocal: 600,
            meetings: [{ days_mask: 1, start_minute_local: 540, end_minute_local: 600, is_online: 0 }],
          }),
        ],
      },
      {
        courseDesignation: 'COURSE B',
        candidates: [
          makeTestCandidate('b-1', {
            courseDesignation: 'COURSE B',
            sectionBundleLabel: 'COURSE B LEC 001',
            meetingSummaryLocal: 'T 11:00 AM-12:00 PM',
            openSeats: 2,
            campusDayCount: 1,
            earliestStartMinuteLocal: 660,
            latestEndMinuteLocal: 720,
            meetings: [{ days_mask: 2, start_minute_local: 660, end_minute_local: 720, is_online: 0 }],
          }),
        ],
      },
    ],
    lockedByCourse: new Map(),
    conflicts: new Map(),
    transitions: new Map(),
    limit: 25,
  });

  assert.equal(schedules.length, 1);
  assert.deepEqual(schedules[0].package_ids, ['a-crosslist-a', 'b-1']);
});

test('compareSchedules falls through null time metrics to later rules and tie-breakers', async () => {
  const scheduleEngine = await loadScheduleEngineModule();

  const laterStartsSchedule = {
    package_ids: ['late-start'],
    campus_day_count: 2,
    earliest_start_minute_local: null,
    large_idle_gap_count: 0,
    tight_transition_count: 0,
    total_walking_distance_meters: 0,
    total_open_seats: 3,
    latest_end_minute_local: 900,
  };
  const fewerCampusDaysSchedule = {
    package_ids: ['fewer-days'],
    campus_day_count: 1,
    earliest_start_minute_local: null,
    large_idle_gap_count: 0,
    tight_transition_count: 0,
    total_walking_distance_meters: 0,
    total_open_seats: 3,
    latest_end_minute_local: 900,
  };

  assert.equal(
    Number.isNaN(
      scheduleEngine.compareSchedules(laterStartsSchedule, fewerCampusDaysSchedule, [
        'later-starts',
        'fewer-campus-days',
      ]),
    ),
    false,
  );
  assert.equal(
    scheduleEngine.compareSchedules(laterStartsSchedule, fewerCampusDaysSchedule, [
      'later-starts',
      'fewer-campus-days',
    ]) > 0,
    true,
  );

  const lexicalFirstSchedule = {
    package_ids: ['aaa'],
    campus_day_count: 1,
    earliest_start_minute_local: null,
    large_idle_gap_count: 0,
    tight_transition_count: 0,
    total_walking_distance_meters: 0,
    total_open_seats: 3,
    latest_end_minute_local: null,
  };
  const lexicalSecondSchedule = {
    package_ids: ['bbb'],
    campus_day_count: 1,
    earliest_start_minute_local: null,
    large_idle_gap_count: 0,
    tight_transition_count: 0,
    total_walking_distance_meters: 0,
    total_open_seats: 3,
    latest_end_minute_local: null,
  };

  assert.equal(
    scheduleEngine.compareSchedules(lexicalFirstSchedule, lexicalSecondSchedule),
    -1,
  );
});

test('normalizePreferenceOrder fills missing rules and ignores unknown values', async () => {
  const scheduleEngine = await loadScheduleEngineModule();

  assert.deepEqual(scheduleEngine.normalizePreferenceOrder(), [
    'later-starts',
    'fewer-campus-days',
    'fewer-long-gaps',
    'earlier-finishes',
  ]);

  assert.deepEqual(
    scheduleEngine.normalizePreferenceOrder([
      'fewer-long-gaps',
      'later-starts',
      'later-starts',
      'not-a-rule',
    ]),
    [
      'fewer-long-gaps',
      'later-starts',
      'fewer-campus-days',
      'earlier-finishes',
    ],
  );
});

test('generateSchedules returns the same schedule payload as the CLI inputs expect', async () => {
  const fixture = buildCourseDbFixture(buildScheduleReadModelFixture());

  try {
    const { generateSchedules } = await loadScheduleEngineModule();
    const schedules = generateSchedules(fixture.db, {
      courses: ['STAT 340', 'ENGL 462', 'COMP SCI 577'],
      lockPackages: ['1272:220:003210:stat340-alt'],
      excludePackages: [],
      limit: 25,
    });

    assert.equal(schedules.length > 0, true);
    assert.equal(schedules.every((schedule) => schedule.conflict_count === 0), true);
    assert.deepEqual(schedules[0].package_ids, [
      '1272:220:003210:stat340-alt',
      '1272:302:005770:cs577-main',
      '1272:350:004620:engl462-main',
    ]);
  } finally {
    fixture.cleanup();
  }
});

test('generateSchedules returns no schedules when courses is empty', async () => {
  const fixture = buildCourseDbFixture(buildScheduleReadModelFixture());

  try {
    const { generateSchedules } = await loadScheduleEngineModule();

    assert.deepEqual(generateSchedules(fixture.db, { courses: [] }), []);
  } finally {
    fixture.cleanup();
  }
});

test('schedule-options honors excluded packages and result limits', () => {
  const fixture = buildCourseDbFixture(buildScheduleReadModelFixture());

  try {
    const output = execFileSync(process.execPath, [
      path.join(repoRoot, 'scripts', 'schedule-options.mjs'),
      '--db',
      fixture.dbPath,
      '--course',
      'STAT 340',
      '--course',
      'ENGL 462',
      '--exclude-package',
      '1272:220:003210:stat340-alt',
      '--limit',
      '1',
    ], {
      encoding: 'utf8',
    });

    const parsed = JSON.parse(output);

    assert.equal(parsed.schedules.length, 1);
    assert.deepEqual(parsed.schedules[0].package_ids, [
      '1272:220:003210:stat340-main',
      '1272:350:004620:engl462-main',
    ]);
    assert.equal(parsed.schedules[0].package_ids.includes('1272:220:003210:stat340-alt'), false);
    assert.equal(parsed.schedules[0].conflict_count, 0);
  } finally {
    fixture.cleanup();
  }
});

test('schedule-options keeps both shared-lecture packages and their full meeting summaries', () => {
  const fixture = buildCourseDbFixture(buildSharedLecturePackageFixture());

  try {
    const output = execFileSync(process.execPath, [
      path.join(repoRoot, 'scripts', 'schedule-options.mjs'),
      '--db',
      fixture.dbPath,
      '--course',
      'STAT 555',
      '--limit',
      '10',
    ], {
      encoding: 'utf8',
    });

    const parsed = JSON.parse(output);

    assert.equal(parsed.schedules.length, 2);
    assert.deepEqual(
      parsed.schedules.map((schedule) => schedule.package_ids[0]).sort(),
      ['1272:220:009901:pkg-a', '1272:220:009901:pkg-z'],
    );
    assert.deepEqual(
      parsed.schedules.map((schedule) => schedule.packages[0].source_package_id).sort(),
      ['1272:220:009901:pkg-a', '1272:220:009901:pkg-z'],
    );
    assert.deepEqual(
      parsed.schedules.map((schedule) => schedule.packages[0].meeting_count).sort((left, right) => left - right),
      [2, 2],
    );

    const summaryByPackage = new Map(
      parsed.schedules.map((schedule) => [schedule.packages[0].source_package_id, schedule.packages[0].meeting_summary_local]),
    );
    assert.equal(
      summaryByPackage.get('1272:220:009901:pkg-a'),
      'MW 9:00 AM-9:50 AM @ Grainger Hall; T 1:00 PM-1:50 PM @ Van Vleck Hall',
    );
    assert.equal(
      summaryByPackage.get('1272:220:009901:pkg-z'),
      'MW 9:00 AM-9:50 AM @ Grainger Hall; R 2:00 PM-2:50 PM @ Computer Sciences',
    );
  } finally {
    fixture.cleanup();
  }
});

test('schedule-options derives candidate-local conflicts and date-aware transitions without global tables', () => {
  const fixture = buildCourseDbFixture({
    courses: [
      makeCourse({
        termCode: '1272',
        courseId: '007701',
        subjectCode: '220',
        catalogNumber: '701',
        courseDesignation: 'STAT 701',
        title: 'First Half Term',
      }),
      makeCourse({
        termCode: '1272',
        courseId: '007702',
        subjectCode: '220',
        catalogNumber: '702',
        courseDesignation: 'STAT 702',
        title: 'Second Half Term',
      }),
    ],
    packageSnapshot: {
      termCode: '1272',
      results: [
        {
          course: { termCode: '1272', subjectCode: '220', courseId: '007701' },
          packages: [
            {
              id: 'half-a',
              termCode: '1272',
              subjectCode: '220',
              courseId: '007701',
              enrollmentClassNumber: 47001,
              lastUpdated: 2000,
              onlineOnly: false,
              isAsynchronous: false,
              packageEnrollmentStatus: { status: 'OPEN', availableSeats: 5, waitlistTotal: 0 },
              enrollmentStatus: { openSeats: 5, waitlistCurrentSize: 0, capacity: 20, currentlyEnrolled: 15 },
              sections: [
                {
                  classUniqueId: { termCode: '1272', classNumber: 47011 },
                  sectionNumber: '001',
                  type: 'LEC',
                  instructionMode: 'Classroom Instruction',
                  sessionCode: 'A1',
                  published: true,
                  enrollmentStatus: { openSeats: 5, waitlistCurrentSize: 0, capacity: 20, currentlyEnrolled: 15 },
                  classMeetings: [
                    {
                      meetingType: 'CLASS',
                      meetingTimeStart: 54000000,
                      meetingTimeEnd: 59400000,
                      meetingDays: 'MW',
                      startDate: 1788325200000,
                      endDate: 1790917200000,
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
          ],
        },
        {
          course: { termCode: '1272', subjectCode: '220', courseId: '007702' },
          packages: [
            {
              id: 'half-b',
              termCode: '1272',
              subjectCode: '220',
              courseId: '007702',
              enrollmentClassNumber: 47002,
              lastUpdated: 2000,
              onlineOnly: false,
              isAsynchronous: false,
              packageEnrollmentStatus: { status: 'OPEN', availableSeats: 5, waitlistTotal: 0 },
              enrollmentStatus: { openSeats: 5, waitlistCurrentSize: 0, capacity: 20, currentlyEnrolled: 15 },
              sections: [
                {
                  classUniqueId: { termCode: '1272', classNumber: 47021 },
                  sectionNumber: '001',
                  type: 'LEC',
                  instructionMode: 'Classroom Instruction',
                  sessionCode: 'B1',
                  published: true,
                  enrollmentStatus: { openSeats: 5, waitlistCurrentSize: 0, capacity: 20, currentlyEnrolled: 15 },
                  classMeetings: [
                    {
                      meetingType: 'CLASS',
                      meetingTimeStart: 54000000,
                      meetingTimeEnd: 59400000,
                      meetingDays: 'MW',
                      startDate: 1791352800000,
                      endDate: 1794204000000,
                      room: '101',
                      building: {
                        buildingCode: '0251',
                        buildingName: 'Humanities Building',
                        streetAddress: '455 N Park St.',
                        latitude: 43.0723,
                        longitude: -89.4012,
                      },
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
    const existingGlobalTables = fixture.db.prepare(`
      SELECT name
      FROM sqlite_master
      WHERE type IN ('table', 'view')
        AND name IN ('schedule_conflicts', 'package_transitions')
      ORDER BY name
    `).all();
    assert.deepEqual(existingGlobalTables, []);

    const output = execFileSync(process.execPath, [
      path.join(repoRoot, 'scripts', 'schedule-options.mjs'),
      '--db',
      fixture.dbPath,
      '--course',
      'STAT 701',
      '--course',
      'STAT 702',
    ], {
      encoding: 'utf8',
    });

    const parsed = JSON.parse(output);
    assert.equal(parsed.schedules.length, 1);
    assert.deepEqual(parsed.schedules[0].package_ids, [
      '1272:220:007701:half-a',
      '1272:220:007702:half-b',
    ]);
    assert.equal(parsed.schedules[0].conflict_count, 0);
  } finally {
    fixture.cleanup();
  }
});

test('root package.json includes a repeatable web test command', async () => {
  const packageJson = JSON.parse(
    fs.readFileSync(path.join(repoRoot, 'package.json'), 'utf8'),
  );
  const webPackageJson = JSON.parse(
    fs.readFileSync(path.join(repoRoot, 'web', 'package.json'), 'utf8'),
  );

  assert.equal(typeof packageJson.scripts?.['test:web'], 'string');
  assert.match(packageJson.scripts?.test ?? '', /test:web/);
  assert.equal(typeof webPackageJson.scripts?.test, 'string');
  assert.match(webPackageJson.scripts.test, /tsx --test/);
});
