import test from 'node:test';
import assert from 'node:assert/strict';

import { parsePrerequisiteText } from '../src/db/prerequisite-helpers.mjs';
import { summarizePrerequisiteForAi } from '../src/db/prerequisite-summary-helpers.mjs';

test('summarizes a structured grouped prerequisite into course groups', () => {
  const rawText = '(COMP SCI/MATH 240 or COMP SCI/MATH/STAT 475) and (COMP SCI 367 or 400)';
  const parsed = parsePrerequisiteText(rawText);
  const summary = summarizePrerequisiteForAi(parsed, { rawText });

  assert.deepEqual(summary, {
    summaryStatus: 'structured',
    courseGroups: [
      ['COMP SCI 240', 'MATH 240', 'COMP SCI 475', 'MATH 475', 'STAT 475'],
      ['COMP SCI 367', 'COMP SCI 400'],
    ],
    escapeClauses: [],
    rawText,
  });
});

test('summarizes a rooted AND tree into one required course group per child path', () => {
  const rawText = '(COMP SCI/MATH 240 or COMP SCI/MATH/STAT 475) and (COMP SCI 367 or 400)';
  const parsed = parsePrerequisiteText(rawText);

  assert.equal(parsed.rootNodeId, parsed.nodes[0].id);

  const summary = summarizePrerequisiteForAi(parsed, { rawText });

  assert.deepEqual(summary, {
    summaryStatus: 'structured',
    courseGroups: [
      ['COMP SCI 240', 'MATH 240', 'COMP SCI 475', 'MATH 475', 'STAT 475'],
      ['COMP SCI 367', 'COMP SCI 400'],
    ],
    escapeClauses: [],
    rawText,
  });
});

test('summarizes a rooted partial AND tree with a required non-course sibling conservatively', () => {
  const rawText = 'MATH 221 and consent of instructor';
  const parsed = parsePrerequisiteText(rawText);

  assert.ok(parsed.rootNodeId);

  const summary = summarizePrerequisiteForAi(parsed, { rawText });

  assert.deepEqual(summary, {
    summaryStatus: 'partial',
    courseGroups: [['MATH 221']],
    escapeClauses: [],
    rawText,
  });
});

test('summarizes the real comp sci 577 prerequisite into course groups plus escape clauses', () => {
  const rawText = '((COMP SCI/MATH 240 or COMP SCI/MATH/STAT 475) and (COMP SCI 367 or 400)) or graduate/professional standing or member of engineering guest students';
  const parsed = parsePrerequisiteText(rawText);
  const summary = summarizePrerequisiteForAi(parsed, { rawText });

  assert.equal(summary.summaryStatus, 'partial');
  assert.deepEqual(summary.courseGroups, [
    ['COMP SCI 240', 'MATH 240', 'COMP SCI 475', 'MATH 475', 'STAT 475'],
    ['COMP SCI 367', 'COMP SCI 400'],
  ]);
  assert.ok(summary.escapeClauses.includes('graduate/professional standing'));
  assert.ok(summary.escapeClauses.includes('member of engineering guest students'));
  assert.equal(summary.rawText, rawText);
});

test('summarizes a rooted partial OR tree into course groups plus escape clauses', () => {
  const rawText = '((COMP SCI/MATH 240 or COMP SCI/MATH/STAT 475) and (COMP SCI 367 or 400)) or graduate/professional standing or member of engineering guest students';
  const parsed = parsePrerequisiteText(rawText);

  assert.ok(parsed.rootNodeId);
  assert.equal(parsed.nodes.find((node) => node.id === parsed.rootNodeId)?.node_type, 'OR');

  const summary = summarizePrerequisiteForAi(parsed, { rawText });

  assert.deepEqual(summary, {
    summaryStatus: 'partial',
    courseGroups: [
      ['COMP SCI 240', 'MATH 240', 'COMP SCI 475', 'MATH 475', 'STAT 475'],
      ['COMP SCI 367', 'COMP SCI 400'],
    ],
    escapeClauses: ['graduate/professional standing', 'member of engineering guest students'],
    rawText,
  });
});

test('summarizes a rooted partial OR tree when the escape side is a parenthesized non-course boolean expression', () => {
  const rawText = '((COMP SCI/MATH 240 or COMP SCI/MATH/STAT 475) and (COMP SCI 367 or 400)) or (graduate/professional standing and consent of instructor)';
  const parsed = parsePrerequisiteText(rawText);

  assert.ok(parsed.rootNodeId);

  const summary = summarizePrerequisiteForAi(parsed, { rawText });

  assert.deepEqual(summary, {
    summaryStatus: 'partial',
    courseGroups: [
      ['COMP SCI 240', 'MATH 240', 'COMP SCI 475', 'MATH 475', 'STAT 475'],
      ['COMP SCI 367', 'COMP SCI 400'],
    ],
    escapeClauses: ['graduate/professional standing and consent of instructor'],
    rawText,
  });
});

test('preserves rooted child order from edge sort_order when summarizing tree groups', () => {
  const parsed = {
    parseStatus: 'parsed',
    unparsedText: null,
    rootNodeId: 'root',
    nodes: [
      { id: 'root', node_type: 'AND', normalized_value: 'AND', raw_value: 'and' },
      { id: 'right', node_type: 'OR', normalized_value: 'OR', raw_value: 'or' },
      { id: 'left', node_type: 'OR', normalized_value: 'OR', raw_value: 'or' },
      { id: 'left-a', node_type: 'COURSE', normalized_value: 'MATH 221', raw_value: 'MATH 221' },
      { id: 'left-b', node_type: 'COURSE', normalized_value: 'MATH 222', raw_value: '222' },
      { id: 'right-a', node_type: 'COURSE', normalized_value: 'STAT 240', raw_value: 'STAT 240' },
      { id: 'right-b', node_type: 'COURSE', normalized_value: 'STAT 340', raw_value: '340' },
    ],
    edges: [
      { source: 'root', target: 'right', sort_order: 2 },
      { source: 'right', target: 'right-b', sort_order: 2 },
      { source: 'left', target: 'left-b', sort_order: 2 },
      { source: 'root', target: 'left', sort_order: 1 },
      { source: 'right', target: 'right-a', sort_order: 1 },
      { source: 'left', target: 'left-a', sort_order: 1 },
    ],
  };

  const summary = summarizePrerequisiteForAi(parsed, { rawText: 'synthetic sort order tree' });

  assert.deepEqual(summary.courseGroups, [
    ['MATH 221', 'MATH 222'],
    ['STAT 240', 'STAT 340'],
  ]);
});

test('does not misreport an opaque conjunctive sibling as an escape clause in a rooted partial tree', () => {
  const rawText = '(COMP SCI 240 or 367) or (ANATOMY/KINES 328 and concurrent enrollment)';
  const parsed = parsePrerequisiteText(rawText);

  assert.ok(parsed.rootNodeId);

  const summary = summarizePrerequisiteForAi(parsed, { rawText });

  assert.deepEqual(summary, {
    summaryStatus: 'opaque',
    courseGroups: [],
    escapeClauses: [],
    rawText,
  });
});

test('treats uppercase top-level OR as an escape-clause separator', () => {
  const rawText = '((COMP SCI/MATH 240 or COMP SCI/MATH/STAT 475) and (COMP SCI 367 or 400)) OR graduate/professional standing';
  const parsed = parsePrerequisiteText(rawText);
  const summary = summarizePrerequisiteForAi(parsed, { rawText });

  assert.deepEqual(summary, {
    summaryStatus: 'partial',
    courseGroups: [
      ['COMP SCI 240', 'MATH 240', 'COMP SCI 475', 'MATH 475', 'STAT 475'],
      ['COMP SCI 367', 'COMP SCI 400'],
    ],
    escapeClauses: ['graduate/professional standing'],
    rawText,
  });
});

test('finds the course clause when an escape clause appears first', () => {
  const rawText = 'graduate/professional standing or ((COMP SCI/MATH 240 or COMP SCI/MATH/STAT 475) and (COMP SCI 367 or 400))';
  const parsed = parsePrerequisiteText(rawText);
  const summary = summarizePrerequisiteForAi(parsed, { rawText });

  assert.deepEqual(summary, {
    summaryStatus: 'partial',
    courseGroups: [
      ['COMP SCI 240', 'MATH 240', 'COMP SCI 475', 'MATH 475', 'STAT 475'],
      ['COMP SCI 367', 'COMP SCI 400'],
    ],
    escapeClauses: ['graduate/professional standing'],
    rawText,
  });
});

test('treats top-level OR without surrounding spaces as an escape-clause separator', () => {
  const rawText = '((COMP SCI/MATH 240 or COMP SCI/MATH/STAT 475) and (COMP SCI 367 or 400))OR graduate/professional standing';
  const parsed = parsePrerequisiteText(rawText);
  const summary = summarizePrerequisiteForAi(parsed, { rawText });

  assert.deepEqual(summary, {
    summaryStatus: 'partial',
    courseGroups: [
      ['COMP SCI 240', 'MATH 240', 'COMP SCI 475', 'MATH 475', 'STAT 475'],
      ['COMP SCI 367', 'COMP SCI 400'],
    ],
    escapeClauses: ['graduate/professional standing'],
    rawText,
  });
});

test('treats top-level alternatives between full course paths as opaque', () => {
  const rawText = '((COMP SCI/MATH 240 or COMP SCI/MATH/STAT 475) and (COMP SCI 367 or 400)) or ((MATH 221 or 222) and (STAT 240 or 340)) or graduate/professional standing';
  const parsed = parsePrerequisiteText(rawText);
  const summary = summarizePrerequisiteForAi(parsed, { rawText });

  assert.deepEqual(summary, {
    summaryStatus: 'opaque',
    courseGroups: [],
    escapeClauses: [],
    rawText,
  });
});

test('treats sibling top-level course-placeholder branches as opaque', () => {
  const rawText = '(COMP SCI 240 or (COMP SCI 367 and COMP SCI 400)) or graduate/professional standing';
  const parsed = parsePrerequisiteText(rawText);
  const summary = summarizePrerequisiteForAi(parsed, { rawText });

  assert.deepEqual(summary, {
    summaryStatus: 'opaque',
    courseGroups: [],
    escapeClauses: [],
    rawText,
  });
});

test('treats unresolved course-bearing grouped-path siblings as opaque instead of dropping them', () => {
  const rawText = '((COMP SCI/MATH 240 or COMP SCI/MATH/STAT 475) and (COMP SCI 367 or 400)) or C&E SOC/SOC 181';
  const parsed = parsePrerequisiteText(rawText);
  const summary = summarizePrerequisiteForAi(parsed, { rawText });

  assert.deepEqual(summary, {
    summaryStatus: 'opaque',
    courseGroups: [],
    escapeClauses: [],
    rawText,
  });
});

test('keeps shorthand numeric alternatives inside course groups instead of escape clauses', () => {
  const rawText = 'A A E 101 (215 prior to Fall 2024), ECON 101, or 111';
  const parsed = parsePrerequisiteText(rawText);
  const summary = summarizePrerequisiteForAi(parsed, { rawText });

  assert.deepEqual(summary, {
    summaryStatus: 'partial',
    courseGroups: [['A A E 101'], ['ECON 101', 'ECON 111']],
    escapeClauses: [],
    rawText,
  });
});

test('keeps a leading recognized course path alongside a trailing shorthand course list', () => {
  const rawText = 'A A E 101 (215 prior to Fall 2024), ECON 101, 102, or 111';
  const parsed = parsePrerequisiteText(rawText);
  const summary = summarizePrerequisiteForAi(parsed, { rawText });

  assert.deepEqual(summary, {
    summaryStatus: 'partial',
    courseGroups: [['A A E 101'], ['ECON 101', 'ECON 102', 'ECON 111']],
    escapeClauses: [],
    rawText,
  });
});

test('keeps trailing shorthand numbers after an unresolved slash-subject clause out of escape clauses', () => {
  const rawText = 'SOC 140, C&E SOC/SOC 181, 210, or 211';
  const parsed = parsePrerequisiteText(rawText);
  const summary = summarizePrerequisiteForAi(parsed, { rawText });

  assert.deepEqual(summary, {
    summaryStatus: 'partial',
    courseGroups: [['SOC 140', 'SOC 210', 'SOC 211']],
    escapeClauses: [],
    rawText,
  });
});

test('summarizes conservative slash-subject options inside a larger trailing course list', () => {
  const rawText = 'MATH/STAT 309, 431, STAT 333, or 340';
  const parsed = parsePrerequisiteText(rawText);
  const summary = summarizePrerequisiteForAi(parsed, { rawText });

  assert.deepEqual(summary, {
    summaryStatus: 'structured',
    courseGroups: [['MATH 309', 'STAT 309', 'STAT 431', 'STAT 333', 'STAT 340']],
    escapeClauses: [],
    rawText,
  });
});

test('summarizes trailing shorthand numbers introduced by and', () => {
  const rawText = 'ABT 700, 705, and 710';
  const parsed = parsePrerequisiteText(rawText);
  const summary = summarizePrerequisiteForAi(parsed, { rawText });

  assert.deepEqual(summary, {
    summaryStatus: 'structured',
    courseGroups: [['ABT 700', 'ABT 705', 'ABT 710']],
    escapeClauses: [],
    rawText,
  });
});

test('does not mislabel unresolved course-bearing sibling text as an escape clause', () => {
  const rawText = '(COMP SCI 240 or 367) or ANATOMY/KINES 328, or concurrent enrollment';
  const parsed = parsePrerequisiteText(rawText);
  const summary = summarizePrerequisiteForAi(parsed, { rawText });

  assert.deepEqual(summary, {
    summaryStatus: 'partial',
    courseGroups: [['COMP SCI 240', 'COMP SCI 367']],
    escapeClauses: ['concurrent enrollment'],
    rawText,
  });
});

test('summarizes ANAT&PHY 338 conservatively while preserving alias and concurrent enrollment escape clause', () => {
  const rawText = 'ANAT&PHY 337 (KINES 337 before fall 2018), or ANATOMY/KINES 328, or concurrent enrollment';
  const parsed = parsePrerequisiteText(rawText);
  const summary = summarizePrerequisiteForAi(parsed, { rawText });

  assert.deepEqual(summary, {
    summaryStatus: 'partial',
    courseGroups: [['ANAT&PHY 337'], ['ANATOMY 328', 'KINES 328']],
    escapeClauses: ['concurrent enrollment'],
    rawText,
  });
});

test('summarizes a primary course plus escape clause when a parenthetical alias note contains slash text', () => {
  const rawText = 'MATH 221 (COMP SCI/MATH 240 equivalent), or concurrent enrollment';
  const parsed = parsePrerequisiteText(rawText);
  const summary = summarizePrerequisiteForAi(parsed, { rawText });

  assert.deepEqual(summary, {
    summaryStatus: 'partial',
    courseGroups: [['MATH 221']],
    escapeClauses: ['concurrent enrollment'],
    rawText,
  });
});

test('keeps note-bearing trailing course lists opaque when the attached note is not an alias note', () => {
  const rawText = 'MATH 221 (may be taken concurrently), STAT 309, or 340';
  const parsed = parsePrerequisiteText(rawText);
  const summary = summarizePrerequisiteForAi(parsed, { rawText });

  assert.deepEqual(summary, {
    summaryStatus: 'opaque',
    courseGroups: [],
    escapeClauses: [],
    rawText,
  });
});

test('keeps note-bearing escape-clause cases opaque when the attached note is not an alias note', () => {
  const rawText = 'MATH 221 (placement into 221 required), or instructor consent';
  const parsed = parsePrerequisiteText(rawText);
  const summary = summarizePrerequisiteForAi(parsed, { rawText });

  assert.deepEqual(summary, {
    summaryStatus: 'opaque',
    courseGroups: [],
    escapeClauses: [],
    rawText,
  });
});

test('strips trailing punctuation from true escape clauses', () => {
  const rawText = '((COMP SCI/MATH 240 or COMP SCI/MATH/STAT 475) and (COMP SCI 367 or 400)) or graduate/professional standing, or member of engineering guest students';
  const parsed = parsePrerequisiteText(rawText);
  const summary = summarizePrerequisiteForAi(parsed, { rawText });

  assert.deepEqual(summary, {
    summaryStatus: 'partial',
    courseGroups: [
      ['COMP SCI 240', 'MATH 240', 'COMP SCI 475', 'MATH 475', 'STAT 475'],
      ['COMP SCI 367', 'COMP SCI 400'],
    ],
    escapeClauses: ['graduate/professional standing', 'member of engineering guest students'],
    rawText,
  });
});

test('preserves numeric escape clauses after grouped course paths', () => {
  const rawText = '((COMP SCI/MATH 240 or COMP SCI/MATH/STAT 475) and (COMP SCI 367 or 400)) or score of 650 on GMAT';
  const parsed = parsePrerequisiteText(rawText);
  const summary = summarizePrerequisiteForAi(parsed, { rawText });

  assert.deepEqual(summary, {
    summaryStatus: 'partial',
    courseGroups: [
      ['COMP SCI 240', 'MATH 240', 'COMP SCI 475', 'MATH 475', 'STAT 475'],
      ['COMP SCI 367', 'COMP SCI 400'],
    ],
    escapeClauses: ['score of 650 on GMAT'],
    rawText,
  });
});

test('preserves numeric escape clauses after shorthand trailing course lists', () => {
  const rawText = 'ABT 700, 705, and 710, or score of 650 on GMAT';
  const parsed = parsePrerequisiteText(rawText);
  const summary = summarizePrerequisiteForAi(parsed, { rawText });

  assert.deepEqual(summary, {
    summaryStatus: 'partial',
    courseGroups: [['ABT 700', 'ABT 705', 'ABT 710']],
    escapeClauses: ['score of 650 on GMAT'],
    rawText,
  });
});

test('summarizes recognized trailing course alternatives even when an earlier slash clause stays unresolved', () => {
  const rawText = 'BIOLOGY/BOTANY/ZOOLOGY 151, BIOLOGY/BOTANY 130, BIOLOGY/ZOOLOGY 101, BIOCORE 381, or graduate/professional standing';
  const parsed = parsePrerequisiteText(rawText);
  const summary = summarizePrerequisiteForAi(parsed, { rawText });

  assert.deepEqual(summary, {
    summaryStatus: 'partial',
    courseGroups: [['BIOLOGY 130', 'BOTANY 130', 'BIOLOGY 101', 'ZOOLOGY 101', 'BIOCORE 381']],
    escapeClauses: ['graduate/professional standing'],
    rawText,
  });
});

test('does not flatten arbitrary opaque text between recognized course clauses into one salvaged group', () => {
  const rawText = 'MATH 221, concurrent enrollment, STAT 309, or 340';
  const parsed = parsePrerequisiteText(rawText);
  const summary = summarizePrerequisiteForAi(parsed, { rawText });

  assert.deepEqual(summary, {
    summaryStatus: 'opaque',
    courseGroups: [],
    escapeClauses: [],
    rawText,
  });
});

test('does not flatten slash-bearing opaque prose between recognized course clauses into one salvaged group', () => {
  const rawText = 'MATH 221, instructor/advisor approval, STAT 309, or 340';
  const parsed = parsePrerequisiteText(rawText);
  const summary = summarizePrerequisiteForAi(parsed, { rawText });

  assert.deepEqual(summary, {
    summaryStatus: 'opaque',
    courseGroups: [],
    escapeClauses: [],
    rawText,
  });
});

test('summarizes a leading recognized course list followed by a non-course escape clause', () => {
  const rawText = 'M S & E 350, 351, or CBE 440, or member of Engineering Guest Students';
  const parsed = parsePrerequisiteText(rawText);
  const summary = summarizePrerequisiteForAi(parsed, { rawText });

  assert.deepEqual(summary, {
    summaryStatus: 'partial',
    courseGroups: [['M S & E 350', 'M S & E 351', 'CBE 440']],
    escapeClauses: ['member of Engineering Guest Students'],
    rawText,
  });
});
