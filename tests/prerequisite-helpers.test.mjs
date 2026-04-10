import test from 'node:test';
import assert from 'node:assert/strict';

import {
  parsePrerequisiteText,
  PARSE_STATUS,
  NODE_TYPE,
} from '../src/db/prerequisite-helpers.mjs';

test('parses simple OR course prerequisite into a graph', () => {
  const result = parsePrerequisiteText('ITALIAN 204 or 205', {
    courseDesignation: 'ITALIAN 230',
    termCode: '1272',
    courseId: '002230',
  });

  assert.equal(result.parseStatus, PARSE_STATUS.PARSED);
  assert.equal(result.unparsedText, null);
  assert.ok(result.nodes.some((node) => node.node_type === NODE_TYPE.OR));
  assert.deepEqual(
    result.nodes
      .filter((node) => node.node_type === NODE_TYPE.COURSE)
      .map((node) => node.normalized_value),
    ['ITALIAN 204', 'ITALIAN 205'],
  );
  assert.deepEqual(
    result.nodes
      .filter((node) => node.node_type === NODE_TYPE.COURSE)
      .map((node) => node.raw_value),
    ['ITALIAN 204', '205'],
  );
  assert.equal(result.edges.length, 2);
});

test('marks consent-only prerequisite as opaque', () => {
  const result = parsePrerequisiteText('Consent of instructor', {
    courseDesignation: 'SLAVIC 560',
    termCode: '1272',
    courseId: '005560',
  });

  assert.equal(result.parseStatus, PARSE_STATUS.UNPARSED);
  assert.equal(result.unparsedText, 'Consent of instructor');
  assert.deepEqual(result.nodes, []);
  assert.deepEqual(result.edges, []);
});

test('keeps mixed prerequisite text as partial when some clauses remain unresolved', () => {
  const result = parsePrerequisiteText(
    'Graduate/professional standing and (ACCT I S 620 or LAW 742), declared in Business: Accounting and Business Analysis MSB, or declared in graduate Business Exchange program',
    {
      courseDesignation: 'ACCT I S 724',
      termCode: '1272',
      courseId: '007724',
    },
  );

  assert.equal(result.parseStatus, PARSE_STATUS.PARTIAL);
  assert.ok(result.nodes.some((node) => node.node_type === NODE_TYPE.STANDING));
  assert.ok(result.nodes.some((node) => node.node_type === NODE_TYPE.COURSE && node.normalized_value === 'ACCT I S 620'));
  assert.ok(result.nodes.some((node) => node.node_type === NODE_TYPE.COURSE && node.normalized_value === 'LAW 742'));
  assert.deepEqual(result.edges, []);
  assert.ok(!result.nodes.some((node) => node.node_type === NODE_TYPE.OR));
  assert.equal(
    result.unparsedText,
    '[STANDING] and ([COURSE] or [COURSE]), declared in Business: Accounting and Business Analysis MSB, or declared in graduate Business Exchange program',
  );
});

test('does not mark disconnected recognized nodes as fully parsed', () => {
  const result = parsePrerequisiteText('Graduate/professional standing and LAW 742', {
    courseDesignation: 'ACCT I S 724',
    termCode: '1272',
    courseId: '007724',
  });

  assert.equal(result.parseStatus, PARSE_STATUS.PARTIAL);
  assert.ok(result.nodes.some((node) => node.node_type === NODE_TYPE.STANDING));
  assert.ok(result.nodes.some((node) => node.node_type === NODE_TYPE.COURSE && node.normalized_value === 'LAW 742'));
  assert.equal(result.unparsedText, '[STANDING] and [COURSE]');
});

test('keeps partial nodes in source order', () => {
  const result = parsePrerequisiteText('LAW 742 and Graduate/professional standing', {
    courseDesignation: 'ACCT I S 724',
    termCode: '1272',
    courseId: '007724',
  });

  assert.equal(result.parseStatus, PARSE_STATUS.PARTIAL);
  assert.equal(result.unparsedText, '[COURSE] and [STANDING]');
  assert.deepEqual(
    result.nodes.map((node) => node.node_type),
    [NODE_TYPE.COURSE, NODE_TYPE.STANDING],
  );
});

test('keeps unresolved relation text for course-only partial cases', () => {
  const result = parsePrerequisiteText('MATH 221 and MATH 222', {
    courseDesignation: 'MATH 500',
    termCode: '1272',
    courseId: '005500',
  });

  assert.equal(result.parseStatus, PARSE_STATUS.PARTIAL);
  assert.deepEqual(
    result.nodes
      .filter((node) => node.node_type === NODE_TYPE.COURSE)
      .map((node) => node.normalized_value),
    ['MATH 221', 'MATH 222'],
  );
  assert.equal(result.unparsedText, '[COURSE] and [COURSE]');
});

test('keeps unresolved repeated OR text for multi-course partial cases', () => {
  const result = parsePrerequisiteText('MATH 221 or MATH 222 or MATH 223', {
    courseDesignation: 'MATH 500',
    termCode: '1272',
    courseId: '005500',
  });

  assert.equal(result.parseStatus, PARSE_STATUS.PARTIAL);
  assert.deepEqual(
    result.nodes
      .filter((node) => node.node_type === NODE_TYPE.COURSE)
      .map((node) => node.normalized_value),
    ['MATH 221', 'MATH 222', 'MATH 223'],
  );
  assert.equal(result.unparsedText, '[COURSE] or [COURSE] or [COURSE]');
});

test('keeps unresolved separator text for standing comma course partial cases', () => {
  const result = parsePrerequisiteText('Graduate/professional standing, LAW 742', {
    courseDesignation: 'ACCT I S 724',
    termCode: '1272',
    courseId: '007724',
  });

  assert.equal(result.parseStatus, PARSE_STATUS.PARTIAL);
  assert.ok(result.nodes.some((node) => node.node_type === NODE_TYPE.STANDING));
  assert.ok(result.nodes.some((node) => node.node_type === NODE_TYPE.COURSE && node.normalized_value === 'LAW 742'));
  assert.equal(result.unparsedText, '[STANDING], [COURSE]');
});

test('keeps unresolved grouping text for standing parenthetical course partial cases', () => {
  const result = parsePrerequisiteText('Graduate/professional standing (LAW 742)', {
    courseDesignation: 'ACCT I S 724',
    termCode: '1272',
    courseId: '007724',
  });

  assert.equal(result.parseStatus, PARSE_STATUS.PARTIAL);
  assert.ok(result.nodes.some((node) => node.node_type === NODE_TYPE.STANDING));
  assert.ok(result.nodes.some((node) => node.node_type === NODE_TYPE.COURSE && node.normalized_value === 'LAW 742'));
  assert.equal(result.unparsedText, '[STANDING] ([COURSE])');
});

test('keeps connective text when opaque text precedes a recognized course', () => {
  const result = parsePrerequisiteText('Declared in program X or MATH 221', {
    courseDesignation: 'MATH 500',
    termCode: '1272',
    courseId: '005500',
  });

  assert.equal(result.parseStatus, PARSE_STATUS.PARTIAL);
  assert.deepEqual(
    result.nodes
      .filter((node) => node.node_type === NODE_TYPE.COURSE)
      .map((node) => node.normalized_value),
    ['MATH 221'],
  );
  assert.equal(result.unparsedText, 'Declared in program X or [COURSE]');
});

test('keeps connective text when opaque text follows a recognized course', () => {
  const result = parsePrerequisiteText('MATH 221 and consent of instructor', {
    courseDesignation: 'MATH 500',
    termCode: '1272',
    courseId: '005500',
  });

  assert.equal(result.parseStatus, PARSE_STATUS.PARTIAL);
  assert.deepEqual(
    result.nodes
      .filter((node) => node.node_type === NODE_TYPE.COURSE)
      .map((node) => node.normalized_value),
    ['MATH 221'],
  );
  assert.equal(result.unparsedText, '[COURSE] and consent of instructor');
});

test('treats a lone recognized course as a fully parsed leaf', () => {
  const result = parsePrerequisiteText('MATH 221', {
    courseDesignation: 'MATH 500',
    termCode: '1272',
    courseId: '005500',
  });

  assert.equal(result.parseStatus, PARSE_STATUS.PARSED);
  assert.deepEqual(
    result.nodes
      .filter((node) => node.node_type === NODE_TYPE.COURSE)
      .map((node) => node.normalized_value),
    ['MATH 221'],
  );
  assert.equal(result.unparsedText, null);
  assert.deepEqual(result.edges, []);
});

test('keeps connective text for trailing parenthesized opaque partials', () => {
  const result = parsePrerequisiteText('MATH 221 and (placement test)', {
    courseDesignation: 'MATH 500',
    termCode: '1272',
    courseId: '005500',
  });

  assert.equal(result.parseStatus, PARSE_STATUS.PARTIAL);
  assert.deepEqual(
    result.nodes
      .filter((node) => node.node_type === NODE_TYPE.COURSE)
      .map((node) => node.normalized_value),
    ['MATH 221'],
  );
  assert.equal(result.unparsedText, '[COURSE] and (placement test)');
});

test('keeps connective text for leading parenthesized opaque partials', () => {
  const result = parsePrerequisiteText('(placement test) or MATH 221', {
    courseDesignation: 'MATH 500',
    termCode: '1272',
    courseId: '005500',
  });

  assert.equal(result.parseStatus, PARSE_STATUS.PARTIAL);
  assert.deepEqual(
    result.nodes
      .filter((node) => node.node_type === NODE_TYPE.COURSE)
      .map((node) => node.normalized_value),
    ['MATH 221'],
  );
  assert.equal(result.unparsedText, '(placement test) or [COURSE]');
});

test('avoids combining incompatible connectives in mixed partial leftovers', () => {
  const result = parsePrerequisiteText('Graduate/professional standing and (LAW 742 or consent of instructor)', {
    courseDesignation: 'ACCT I S 724',
    termCode: '1272',
    courseId: '007724',
  });

  assert.equal(result.parseStatus, PARSE_STATUS.PARTIAL);
  assert.ok(result.nodes.some((node) => node.node_type === NODE_TYPE.STANDING));
  assert.ok(result.nodes.some((node) => node.node_type === NODE_TYPE.COURSE && node.normalized_value === 'LAW 742'));
  assert.equal(result.unparsedText, '[STANDING] and ([COURSE] or consent of instructor)');
});

test('treats a parenthesized lone course as a parsed leaf', () => {
  const result = parsePrerequisiteText('(MATH 221)', {
    courseDesignation: 'MATH 500',
    termCode: '1272',
    courseId: '005500',
  });

  assert.equal(result.parseStatus, PARSE_STATUS.PARSED);
  assert.deepEqual(
    result.nodes
      .filter((node) => node.node_type === NODE_TYPE.COURSE)
      .map((node) => node.normalized_value),
    ['MATH 221'],
  );
  assert.equal(result.unparsedText, null);
});

test('treats parenthesized standing as a parsed leaf', () => {
  const result = parsePrerequisiteText('(Graduate/professional standing)', {
    courseDesignation: 'ACCT I S 724',
    termCode: '1272',
    courseId: '007724',
  });

  assert.equal(result.parseStatus, PARSE_STATUS.PARSED);
  assert.ok(result.nodes.some((node) => node.node_type === NODE_TYPE.STANDING));
  assert.equal(result.unparsedText, null);
});

test('parses simple OR courses through one outer grouping layer', () => {
  const result = parsePrerequisiteText('(ITALIAN 204 or 205)', {
    courseDesignation: 'ITALIAN 230',
    termCode: '1272',
    courseId: '002230',
  });

  assert.equal(result.parseStatus, PARSE_STATUS.PARSED);
  assert.equal(result.unparsedText, null);
  assert.ok(result.nodes.some((node) => node.node_type === NODE_TYPE.OR));
  assert.deepEqual(
    result.nodes
      .filter((node) => node.node_type === NODE_TYPE.COURSE)
      .map((node) => node.normalized_value),
    ['ITALIAN 204', 'ITALIAN 205'],
  );
  assert.equal(result.edges.length, 2);
});

test('keeps unresolved adjacency text for standing plus course partial cases', () => {
  const result = parsePrerequisiteText('Graduate/professional standing LAW 742', {
    courseDesignation: 'ACCT I S 724',
    termCode: '1272',
    courseId: '007724',
  });

  assert.equal(result.parseStatus, PARSE_STATUS.PARTIAL);
  assert.ok(result.nodes.some((node) => node.node_type === NODE_TYPE.STANDING));
  assert.ok(result.nodes.some((node) => node.node_type === NODE_TYPE.COURSE && node.normalized_value === 'LAW 742'));
  assert.equal(result.unparsedText, '[STANDING] [COURSE]');
});

test('keeps unresolved adjacency text for adjacent course partial cases', () => {
  const result = parsePrerequisiteText('MATH 221 LAW 742', {
    courseDesignation: 'MATH 500',
    termCode: '1272',
    courseId: '005500',
  });

  assert.equal(result.parseStatus, PARSE_STATUS.PARTIAL);
  assert.deepEqual(
    result.nodes
      .filter((node) => node.node_type === NODE_TYPE.COURSE)
      .map((node) => node.normalized_value),
    ['MATH 221', 'LAW 742'],
  );
  assert.equal(result.unparsedText, '[COURSE] [COURSE]');
});

test('preserves outer grouping for parenthesized partial skeletons', () => {
  const result = parsePrerequisiteText('(MATH 221 and consent of instructor)', {
    courseDesignation: 'MATH 500',
    termCode: '1272',
    courseId: '005500',
  });

  assert.equal(result.parseStatus, PARSE_STATUS.PARTIAL);
  assert.ok(result.nodes.some((node) => node.node_type === NODE_TYPE.COURSE && node.normalized_value === 'MATH 221'));
  assert.equal(result.unparsedText, '([COURSE] and consent of instructor)');
});

test('does not fabricate a course node from slash-delimited dual subject text', () => {
  const result = parsePrerequisiteText('MATH/STAT 309', {
    courseDesignation: 'MATH 500',
    termCode: '1272',
    courseId: '005500',
  });

  assert.equal(result.parseStatus, PARSE_STATUS.UNPARSED);
  assert.equal(result.unparsedText, 'MATH/STAT 309');
  assert.deepEqual(result.nodes, []);
  assert.deepEqual(result.edges, []);
});

test('does not fabricate a course node from slash-delimited long subject text', () => {
  const result = parsePrerequisiteText('BIOLOGY/ZOOLOGY 151', {
    courseDesignation: 'ZOOLOGY 500',
    termCode: '1272',
    courseId: '005500',
  });

  assert.equal(result.parseStatus, PARSE_STATUS.UNPARSED);
  assert.equal(result.unparsedText, 'BIOLOGY/ZOOLOGY 151');
  assert.deepEqual(result.nodes, []);
  assert.deepEqual(result.edges, []);
});

test('keeps other recognized clauses without fabricating slash-delimited course nodes', () => {
  const result = parsePrerequisiteText('Graduate/professional standing and MATH/STAT 309', {
    courseDesignation: 'ACCT I S 724',
    termCode: '1272',
    courseId: '007724',
  });

  assert.equal(result.parseStatus, PARSE_STATUS.PARTIAL);
  assert.ok(result.nodes.some((node) => node.node_type === NODE_TYPE.STANDING));
  assert.ok(!result.nodes.some((node) => node.node_type === NODE_TYPE.COURSE && node.normalized_value === 'STAT 309'));
  assert.equal(result.unparsedText, '[STANDING] and MATH/STAT 309');
});

test('recognizes repeated standing clauses consistently', () => {
  const result = parsePrerequisiteText('graduate/professional standing or graduate/professional standing', {
    courseDesignation: 'ACCT I S 724',
    termCode: '1272',
    courseId: '007724',
  });

  assert.equal(result.parseStatus, PARSE_STATUS.PARTIAL);
  assert.equal(result.nodes.filter((node) => node.node_type === NODE_TYPE.STANDING).length, 2);
  assert.equal(result.unparsedText, '[STANDING] or [STANDING]');
});

test('does not fabricate a course node from spaced slash-delimited subject text', () => {
  const result = parsePrerequisiteText('MATH / STAT 309', {
    courseDesignation: 'MATH 500',
    termCode: '1272',
    courseId: '005500',
  });

  assert.equal(result.parseStatus, PARSE_STATUS.UNPARSED);
  assert.equal(result.unparsedText, 'MATH / STAT 309');
  assert.deepEqual(result.nodes, []);
  assert.deepEqual(result.edges, []);
});

test('does not fabricate a tail-token course from multi-word subject text', () => {
  const result = parsePrerequisiteText('COMP SCI 200', {
    courseDesignation: 'COMP SCI 300',
    termCode: '1272',
    courseId: '003300',
  });

  assert.equal(result.parseStatus, PARSE_STATUS.UNPARSED);
  assert.equal(result.unparsedText, 'COMP SCI 200');
  assert.deepEqual(result.nodes, []);
  assert.deepEqual(result.edges, []);
});

test('does not fabricate a tail-token course inside mixed expressions', () => {
  const result = parsePrerequisiteText('COMP SCI 200 and MATH 221', {
    courseDesignation: 'COMP SCI 300',
    termCode: '1272',
    courseId: '003300',
  });

  assert.equal(result.parseStatus, PARSE_STATUS.PARTIAL);
  assert.ok(result.nodes.some((node) => node.node_type === NODE_TYPE.COURSE && node.normalized_value === 'MATH 221'));
  assert.ok(!result.nodes.some((node) => node.node_type === NODE_TYPE.COURSE && node.normalized_value === 'SCI 200'));
  assert.equal(result.unparsedText, 'COMP SCI 200 and [COURSE]');
});

test('replaces placeholders at accepted match spans instead of repeated substring text', () => {
  const result = parsePrerequisiteText('COMP SCI 200 and SCI 200', {
    courseDesignation: 'COMP SCI 300',
    termCode: '1272',
    courseId: '003300',
  });

  assert.equal(result.parseStatus, PARSE_STATUS.PARTIAL);
  assert.deepEqual(
    result.nodes
      .filter((node) => node.node_type === NODE_TYPE.COURSE)
      .map((node) => node.normalized_value),
    ['SCI 200'],
  );
  assert.equal(result.unparsedText, 'COMP SCI 200 and [COURSE]');
});

test('preserves raw spacing for a lone recognized course', () => {
  const result = parsePrerequisiteText('MATH   221', {
    courseDesignation: 'MATH 500',
    termCode: '1272',
    courseId: '005500',
  });

  assert.equal(result.parseStatus, PARSE_STATUS.PARSED);
  assert.deepEqual(
    result.nodes
      .filter((node) => node.node_type === NODE_TYPE.COURSE)
      .map((node) => node.raw_value),
    ['MATH   221'],
  );
});

test('preserves raw spacing in the simple OR fast path', () => {
  const result = parsePrerequisiteText('ITALIAN   204 or 205', {
    courseDesignation: 'ITALIAN 230',
    termCode: '1272',
    courseId: '002230',
  });

  assert.equal(result.parseStatus, PARSE_STATUS.PARSED);
  assert.deepEqual(
    result.nodes
      .filter((node) => node.node_type === NODE_TYPE.COURSE)
      .map((node) => node.raw_value),
    ['ITALIAN   204', '205'],
  );
});

test('does not fabricate a course node from slash-delimited shared-subject numbers', () => {
  const result = parsePrerequisiteText('STAT 240/340', {
    courseDesignation: 'STAT 500',
    termCode: '1272',
    courseId: '005500',
  });

  assert.equal(result.parseStatus, PARSE_STATUS.UNPARSED);
  assert.equal(result.unparsedText, 'STAT 240/340');
  assert.deepEqual(result.nodes, []);
  assert.deepEqual(result.edges, []);
});

test('does not fabricate a course node when slash guard sees expanded source spacing', () => {
  const result = parsePrerequisiteText('STAT   240/340', {
    courseDesignation: 'STAT 500',
    termCode: '1272',
    courseId: '005500',
  });

  assert.equal(result.parseStatus, PARSE_STATUS.UNPARSED);
  assert.equal(result.unparsedText, 'STAT 240/340');
  assert.deepEqual(result.nodes, []);
  assert.deepEqual(result.edges, []);
});

test('does not fabricate a course node for slash-delimited full courses with expanded spacing', () => {
  const result = parsePrerequisiteText('MATH   221/MATH 222', {
    courseDesignation: 'MATH 500',
    termCode: '1272',
    courseId: '005500',
  });

  assert.equal(result.parseStatus, PARSE_STATUS.UNPARSED);
  assert.equal(result.unparsedText, 'MATH 221/MATH 222');
  assert.deepEqual(result.nodes, []);
  assert.deepEqual(result.edges, []);
});

test('preserves raw operator and raw course slices for uppercase OR fast path', () => {
  const result = parsePrerequisiteText('ITALIAN 204 OR 205', {
    courseDesignation: 'ITALIAN 230',
    termCode: '1272',
    courseId: '002230',
  });

  assert.equal(result.parseStatus, PARSE_STATUS.PARSED);
  assert.equal(result.nodes.find((node) => node.node_type === NODE_TYPE.OR)?.raw_value, 'OR');
  assert.deepEqual(
    result.nodes
      .filter((node) => node.node_type === NODE_TYPE.COURSE)
      .map((node) => node.raw_value),
    ['ITALIAN 204', '205'],
  );
});

test('preserves raw operator and raw course slices for mixed-case Or fast path', () => {
  const result = parsePrerequisiteText('ITALIAN 204 Or 205', {
    courseDesignation: 'ITALIAN 230',
    termCode: '1272',
    courseId: '002230',
  });

  assert.equal(result.parseStatus, PARSE_STATUS.PARSED);
  assert.equal(result.nodes.find((node) => node.node_type === NODE_TYPE.OR)?.raw_value, 'Or');
  assert.deepEqual(
    result.nodes
      .filter((node) => node.node_type === NODE_TYPE.COURSE)
      .map((node) => node.raw_value),
    ['ITALIAN 204', '205'],
  );
});

test('does not fabricate a course node from slash-delimited full-course pair', () => {
  const result = parsePrerequisiteText('MATH 221/MATH 222', {
    courseDesignation: 'MATH 500',
    termCode: '1272',
    courseId: '005500',
  });

  assert.equal(result.parseStatus, PARSE_STATUS.UNPARSED);
  assert.equal(result.unparsedText, 'MATH 221/MATH 222');
  assert.deepEqual(result.nodes, []);
  assert.deepEqual(result.edges, []);
});

test('does not fabricate a course node from slash-delimited shared-number pair', () => {
  const result = parsePrerequisiteText('ACCT I S 100/200', {
    courseDesignation: 'ACCT I S 300',
    termCode: '1272',
    courseId: '003300',
  });

  assert.equal(result.parseStatus, PARSE_STATUS.UNPARSED);
  assert.equal(result.unparsedText, 'ACCT I S 100/200');
  assert.deepEqual(result.nodes, []);
  assert.deepEqual(result.edges, []);
});
