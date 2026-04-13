import test from 'node:test';
import assert from 'node:assert/strict';

const loadMatchHelpers = () => import('../src/madgrades/match-helpers.mjs');

test('normalizeMadgradesText trims uppercases and collapses whitespace', async () => {
  const { normalizeMadgradesText } = await loadMatchHelpers();

  assert.equal(normalizeMadgradesText('  Intro   to  Ai  '), 'INTRO TO AI');
  assert.equal(normalizeMadgradesText(null), '');
});

test('matchLocalCourse matches by subject code and catalog number when unique', async () => {
  const { matchLocalCourse } = await loadMatchHelpers();

  const result = matchLocalCourse(
    {
      termCode: '1262',
      courseId: 'local-course-1',
      title: 'Introduction to Programming',
      subjectCatalogPairs: [{ subjectCode: 'COMP SCI', catalogNumber: '300' }],
    },
    [
      {
        uuid: 'mg-course-300',
        subject: 'COMP SCI',
        number: '300',
        name: 'Introduction to Programming',
      },
      {
        uuid: 'mg-course-240',
        subject: 'COMP SCI',
        number: '240',
        name: 'Discrete Mathematics',
      },
    ],
  );

  assert.deepEqual(result, {
    termCode: '1262',
    courseId: 'local-course-1',
    matchStatus: 'matched',
    matchMethod: 'subject-code+catalog-number',
    madgradesCourseUuid: 'mg-course-300',
    matchNote: null,
  });
});

test('matchLocalCourse marks unresolved duplicates as ambiguous', async () => {
  const { matchLocalCourse } = await loadMatchHelpers();

  const result = matchLocalCourse(
    {
      termCode: '1262',
      courseId: 'local-course-2',
      title: 'Topics in Computing',
      subjectCatalogPairs: [{ subjectCode: 'COMP SCI', catalogNumber: '699' }],
    },
    [
      {
        uuid: 'mg-course-699-a',
        subject: 'COMP SCI',
        number: '699',
        name: 'Topics in Computing',
      },
      {
        uuid: 'mg-course-699-b',
        subject: 'COMP SCI',
        number: '699',
        name: '  Topics   in   Computing ',
      },
    ],
  );

  assert.deepEqual(result, {
    termCode: '1262',
    courseId: 'local-course-2',
    matchStatus: 'ambiguous',
    matchMethod: null,
    madgradesCourseUuid: null,
    matchNote: 'Multiple Madgrades courses matched subject/code and title filters',
  });
});

test('matchLocalCourse uses normalized title alignment to resolve duplicate subject code matches', async () => {
  const { matchLocalCourse } = await loadMatchHelpers();

  const result = matchLocalCourse(
    {
      termCode: '1262',
      courseId: 'local-course-3',
      title: '  Machine   Learning ',
      subjectCatalogPairs: [{ subjectCode: 'COMP SCI', catalogNumber: '540' }],
    },
    [
      {
        uuid: 'mg-course-540-a',
        subject: 'COMP SCI',
        number: '540',
        name: 'MACHINE LEARNING',
      },
      {
        uuid: 'mg-course-540-b',
        subject: 'COMP SCI',
        number: '540',
        name: 'Artificial Intelligence',
      },
    ],
  );

  assert.deepEqual(result, {
    termCode: '1262',
    courseId: 'local-course-3',
    matchStatus: 'matched',
    matchMethod: 'subject-code+catalog-number+title',
    madgradesCourseUuid: 'mg-course-540-a',
    matchNote: null,
  });
});

test('matchLocalCourse returns unmatched when no subject code candidate exists', async () => {
  const { matchLocalCourse } = await loadMatchHelpers();

  const result = matchLocalCourse(
    {
      termCode: '1262',
      courseId: 'local-course-4',
      title: 'Linear Algebra',
      subjectCatalogPairs: [{ subjectCode: 'MATH', catalogNumber: '340' }],
    },
    [
      {
        uuid: 'mg-course-320',
        subject: 'MATH',
        number: '320',
        name: 'Linear Algebra and Differential Equations',
      },
    ],
  );

  assert.deepEqual(result, {
    termCode: '1262',
    courseId: 'local-course-4',
    matchStatus: 'unmatched',
    matchMethod: null,
    madgradesCourseUuid: null,
    matchNote: 'No Madgrades course matched any subject/code pair',
  });
});

test('matchLocalCourse returns unmatched when subjectCatalogPairs is missing', async () => {
  const { matchLocalCourse } = await loadMatchHelpers();

  const result = matchLocalCourse(
    {
      termCode: '1262',
      courseId: 'local-course-missing-pairs',
      title: 'Linear Algebra',
    },
    [
      {
        uuid: 'mg-course-340-a',
        subject: 'MATH',
        number: '340',
        name: 'Linear Algebra',
      },
    ],
  );

  assert.deepEqual(result, {
    termCode: '1262',
    courseId: 'local-course-missing-pairs',
    matchStatus: 'unmatched',
    matchMethod: null,
    madgradesCourseUuid: null,
    matchNote: 'No Madgrades course matched any subject/code pair',
  });
});

test('matchLocalCourse returns unmatched when title alignment eliminates duplicate subject code candidates', async () => {
  const { matchLocalCourse } = await loadMatchHelpers();

  const result = matchLocalCourse(
    {
      termCode: '1262',
      courseId: 'local-course-5',
      title: 'Linear Algebra',
      subjectCatalogPairs: [{ subjectCode: 'MATH', catalogNumber: '340' }],
    },
    [
      {
        uuid: 'mg-course-340-a',
        subject: 'MATH',
        number: '340',
        name: 'Abstract Algebra',
      },
      {
        uuid: 'mg-course-340-b',
        subject: 'MATH',
        number: '340',
        name: 'Number Theory',
      },
    ],
  );

  assert.deepEqual(result, {
    termCode: '1262',
    courseId: 'local-course-5',
    matchStatus: 'unmatched',
    matchMethod: null,
    madgradesCourseUuid: null,
    matchNote: 'No Madgrades course matched the normalized title after subject/code filtering',
  });
});

test('matchLocalCourse does not auto-match a unique subject code candidate when the title differs', async () => {
  const { matchLocalCourse } = await loadMatchHelpers();

  const result = matchLocalCourse(
    {
      termCode: '1272',
      courseId: 'local-course-title-mismatch',
      title: 'Special Topics in Computing',
      subjectCatalogPairs: [{ subjectCode: 'COMP SCI', catalogNumber: '777' }],
    },
    [
      {
        uuid: 'mg-course-777',
        subject: 'COMP SCI',
        number: '777',
        name: 'Introduction to Compilers',
      },
    ],
  );

  assert.deepEqual(result, {
    termCode: '1272',
    courseId: 'local-course-title-mismatch',
    matchStatus: 'unmatched',
    matchMethod: null,
    madgradesCourseUuid: null,
    matchNote: 'Unique subject/code candidate did not match the normalized title',
  });
});

test('matchLocalCourse matches a renamed unique subject code candidate when an alternate Madgrades name aligns', async () => {
  const { matchLocalCourse } = await loadMatchHelpers();

  const result = matchLocalCourse(
    {
      termCode: '1272',
      courseId: '024185',
      title: 'Molecules to Life and the Nature of Science',
      subjectCatalogPairs: [{ subjectCode: 'BIOCHEM', catalogNumber: '104' }],
    },
    [
      {
        uuid: 'mg-biochem-104',
        subject: 'BIOCHEM',
        number: '104',
        name: 'Molecular Mechanisms, Human Health & You',
        names: ['Molecules to Life and the Nature of Science'],
      },
    ],
  );

  assert.deepEqual(result, {
    termCode: '1272',
    courseId: '024185',
    matchStatus: 'matched',
    matchMethod: 'subject-code+catalog-number',
    madgradesCourseUuid: 'mg-biochem-104',
    matchNote: null,
  });
});

test('matchLocalInstructor requires an exact normalized full-name match', async () => {
  const { matchLocalInstructor } = await loadMatchHelpers();

  const result = matchLocalInstructor(
    {
      instructorKey: 'instr-1',
      displayName: '  Ada   Lovelace ',
    },
    [
      { id: 17, name: 'ADA LOVELACE' },
      { id: 18, name: 'Ada Byron' },
    ],
  );

  assert.deepEqual(result, {
    instructorKey: 'instr-1',
    matchStatus: 'matched',
    matchMethod: 'normalized-name-exact',
    madgradesInstructorId: 17,
    matchNote: null,
  });
});

test('matchLocalInstructor marks duplicate exact-name candidates as ambiguous', async () => {
  const { matchLocalInstructor } = await loadMatchHelpers();

  const result = matchLocalInstructor(
    {
      instructorKey: 'instr-2',
      displayName: 'Grace Hopper',
    },
    [
      { id: 27, name: 'GRACE HOPPER' },
      { id: 28, name: ' Grace   Hopper ' },
      { id: 29, name: 'Grace M. Hopper' },
    ],
  );

  assert.deepEqual(result, {
    instructorKey: 'instr-2',
    matchStatus: 'ambiguous',
    matchMethod: null,
    madgradesInstructorId: null,
    matchNote: 'Multiple Madgrades instructors matched the normalized full name',
  });
});

test('matchLocalInstructor returns unmatched when no exact normalized full-name candidate exists', async () => {
  const { matchLocalInstructor } = await loadMatchHelpers();

  const result = matchLocalInstructor(
    {
      instructorKey: 'instr-3',
      displayName: 'Katherine Johnson',
    },
    [{ id: 31, name: 'Katherine G. Johnson' }],
  );

  assert.deepEqual(result, {
    instructorKey: 'instr-3',
    matchStatus: 'unmatched',
    matchMethod: null,
    madgradesInstructorId: null,
    matchNote: 'No Madgrades instructor matched the normalized full name',
  });
});
