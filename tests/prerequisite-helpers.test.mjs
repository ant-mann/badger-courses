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

test('parses simple OR shorthand for multi-token subjects', () => {
  const result = parsePrerequisiteText('ACCT I S 100 or 200', {
    courseDesignation: 'ACCT I S 300',
    termCode: '1272',
    courseId: '003300',
  });

  assert.equal(result.parseStatus, PARSE_STATUS.PARSED);
  assert.equal(result.unparsedText, null);
  assert.ok(result.nodes.some((node) => node.node_type === NODE_TYPE.OR));
  assert.deepEqual(
    result.nodes
      .filter((node) => node.node_type === NODE_TYPE.COURSE)
      .map((node) => ({ normalized: node.normalized_value, raw: node.raw_value })),
    [
      { normalized: 'ACCT I S 100', raw: 'ACCT I S 100' },
      { normalized: 'ACCT I S 200', raw: '200' },
    ],
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

test('parses repeated AND course clauses into a rooted tree', () => {
  const result = parsePrerequisiteText('MATH 221 and MATH 222', {
    courseDesignation: 'MATH 500',
    termCode: '1272',
    courseId: '005500',
  });

  assert.equal(result.parseStatus, PARSE_STATUS.PARSED);
  assert.ok(result.rootNodeId);
  assert.equal(result.unparsedText, null);
  assert.equal(result.nodes.find((node) => node.id === result.rootNodeId)?.node_type, NODE_TYPE.AND);
  assert.deepEqual(
    result.nodes
      .filter((node) => node.node_type === NODE_TYPE.COURSE)
      .map((node) => node.normalized_value),
    ['MATH 221', 'MATH 222'],
  );
  assert.equal(result.edges.length, 2);
});

test('keeps unique node ids for parenthesized course leaf clauses', () => {
  for (const [text, rootType] of [
    ['(MATH 221) and (MATH 222)', NODE_TYPE.AND],
    ['(MATH 221) or (MATH 222)', NODE_TYPE.OR],
  ]) {
    const result = parsePrerequisiteText(text, {
      courseDesignation: 'MATH 500',
      termCode: '1272',
      courseId: '005500',
    });

    assert.equal(result.parseStatus, PARSE_STATUS.PARSED);
    assert.equal(result.unparsedText, null);
    assert.equal(result.nodes.find((node) => node.id === result.rootNodeId)?.node_type, rootType);
    assert.deepEqual(
      result.nodes
        .filter((node) => node.node_type === NODE_TYPE.COURSE)
        .map((node) => node.normalized_value),
      ['MATH 221', 'MATH 222'],
    );
    assert.equal(new Set(result.nodes.map((node) => node.id)).size, result.nodes.length);
    assert.deepEqual(
      result.edges.filter((edge) => edge.source === result.rootNodeId).map((edge) => edge.target).sort(),
      result.nodes
        .filter((node) => node.node_type === NODE_TYPE.COURSE)
        .map((node) => node.id)
        .sort(),
    );
  }
});

test('parses parenthesized explicit OR course clauses across subjects into a rooted tree', () => {
  const result = parsePrerequisiteText('(MATH 221) or (LAW 742)', {
    courseDesignation: 'MATH 500',
    termCode: '1272',
    courseId: '005500',
  });

  assert.equal(result.parseStatus, PARSE_STATUS.PARSED);
  assert.equal(result.unparsedText, null);
  assert.equal(result.nodes.find((node) => node.id === result.rootNodeId)?.node_type, NODE_TYPE.OR);
  assert.deepEqual(
    result.nodes
      .filter((node) => node.node_type === NODE_TYPE.COURSE)
      .map((node) => node.normalized_value),
    ['MATH 221', 'LAW 742'],
  );
  assert.equal(result.edges.length, 2);
});

test('parses repeated OR course clauses into a rooted tree', () => {
  const result = parsePrerequisiteText('MATH 221 or MATH 222 or MATH 223', {
    courseDesignation: 'MATH 500',
    termCode: '1272',
    courseId: '005500',
  });

  assert.equal(result.parseStatus, PARSE_STATUS.PARSED);
  assert.ok(result.rootNodeId);
  assert.equal(result.unparsedText, null);
  assert.equal(result.nodes.find((node) => node.id === result.rootNodeId)?.node_type, NODE_TYPE.OR);
  assert.deepEqual(
    result.nodes
      .filter((node) => node.node_type === NODE_TYPE.COURSE)
      .map((node) => node.normalized_value),
    ['MATH 221', 'MATH 222', 'MATH 223'],
  );
  assert.equal(result.edges.length, 3);
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

test('treats a lone multi-word subject course as a parsed leaf', () => {
  const result = parsePrerequisiteText('COMP SCI 367', {
    courseDesignation: 'COMP SCI 577',
    termCode: '1272',
    courseId: '005577',
  });

  assert.equal(result.parseStatus, PARSE_STATUS.PARSED);
  assert.equal(result.unparsedText, null);
  assert.deepEqual(
    result.nodes
      .filter((node) => node.node_type === NODE_TYPE.COURSE)
      .map((node) => ({ normalized: node.normalized_value, raw: node.raw_value })),
    [{ normalized: 'COMP SCI 367', raw: 'COMP SCI 367' }],
  );
  assert.deepEqual(result.edges, []);
});

test('keeps slash subject alternatives with a shared number as a conservative partial', () => {
  const result = parsePrerequisiteText('COMP SCI/MATH 240', {
    courseDesignation: 'COMP SCI 577',
    termCode: '1272',
    courseId: '005577',
  });

  assert.equal(result.parseStatus, PARSE_STATUS.PARTIAL);
  assert.equal(result.unparsedText, '[COURSE]/[COURSE]');
  assert.deepEqual(
    result.nodes
      .filter((node) => node.node_type === NODE_TYPE.COURSE)
      .map((node) => ({ normalized: node.normalized_value, raw: node.raw_value })),
    [
      { normalized: 'COMP SCI 240', raw: 'COMP SCI' },
      { normalized: 'MATH 240', raw: 'MATH 240' },
    ],
  );
  assert.deepEqual(result.edges, []);
});

test('keeps duplicate multi-token slash-subject clauses opaque', () => {
  const result = parsePrerequisiteText('COMP SCI/COMP SCI 240', {
    courseDesignation: 'COMP SCI 577',
    termCode: '1272',
    courseId: '005577',
  });

  assert.equal(result.parseStatus, PARSE_STATUS.UNPARSED);
  assert.equal(result.unparsedText, 'COMP SCI/COMP SCI 240');
  assert.deepEqual(result.nodes, []);
  assert.deepEqual(result.edges, []);
});

test('keeps three-way slash subject alternatives with a shared number as a conservative partial', () => {
  const result = parsePrerequisiteText('COMP SCI/MATH/STAT 475', {
    courseDesignation: 'COMP SCI 577',
    termCode: '1272',
    courseId: '005577',
  });

  assert.equal(result.parseStatus, PARSE_STATUS.PARTIAL);
  assert.equal(result.unparsedText, '[COURSE]/[COURSE]/[COURSE]');
  assert.deepEqual(
    result.nodes
      .filter((node) => node.node_type === NODE_TYPE.COURSE)
      .map((node) => ({ normalized: node.normalized_value, raw: node.raw_value })),
    [
      { normalized: 'COMP SCI 475', raw: 'COMP SCI' },
      { normalized: 'MATH 475', raw: 'MATH' },
      { normalized: 'STAT 475', raw: 'STAT 475' },
    ],
  );
  assert.deepEqual(result.edges, []);
});

test('parses grouped COMP SCI 577 course-only clauses into a rooted tree', () => {
  const result = parsePrerequisiteText('(COMP SCI/MATH 240 or COMP SCI/MATH/STAT 475) and (COMP SCI 367 or 400)', {
    courseDesignation: 'COMP SCI 577',
    termCode: '1272',
    courseId: '005577',
  });

  assert.equal(result.parseStatus, PARSE_STATUS.PARSED);
  assert.ok(result.rootNodeId);
  assert.equal(result.unparsedText, null);
  assert.equal(result.nodes.find((node) => node.id === result.rootNodeId)?.node_type, NODE_TYPE.AND);
  assert.deepEqual(
    result.nodes
      .filter((node) => node.node_type === NODE_TYPE.COURSE)
      .map((node) => node.normalized_value),
    [
      'COMP SCI 240',
      'MATH 240',
      'COMP SCI 475',
      'MATH 475',
      'STAT 475',
      'COMP SCI 367',
      'COMP SCI 400',
    ],
  );
  assert.equal(result.edges.length, 9);
});

test('keeps CS 577 prerequisite text conservative when escape clauses remain', () => {
  const result = parsePrerequisiteText('((COMP SCI/MATH 240 or COMP SCI/MATH/STAT 475) and (COMP SCI 367 or 400)) or graduate/professional standing or member of engineering guest students', {
    courseDesignation: 'COMP SCI 577',
    termCode: '1272',
    courseId: '005577',
  });

  assert.equal(result.parseStatus, PARSE_STATUS.PARTIAL);
  assert.equal(
    result.unparsedText,
    '(([COURSE]/[COURSE] or [COURSE]/[COURSE]/[COURSE]) and ([COURSE] or [COURSE])) or [STANDING] or member of engineering guest students',
  );
  assert.ok(result.nodes.some((node) => node.node_type === NODE_TYPE.STANDING));
  assert.deepEqual(
    result.nodes
      .filter((node) => node.node_type === NODE_TYPE.COURSE)
      .map((node) => node.normalized_value),
    [
      'COMP SCI 240',
      'MATH 240',
      'COMP SCI 475',
      'MATH 475',
      'STAT 475',
      'COMP SCI 367',
      'COMP SCI 400',
    ],
  );
  assert.deepEqual(result.edges, []);
});

test('treats multi-word subject text as a parsed course leaf', () => {
  const result = parsePrerequisiteText('COMP SCI 200', {
    courseDesignation: 'COMP SCI 300',
    termCode: '1272',
    courseId: '003300',
  });

  assert.equal(result.parseStatus, PARSE_STATUS.PARSED);
  assert.equal(result.unparsedText, null);
  assert.deepEqual(
    result.nodes
      .filter((node) => node.node_type === NODE_TYPE.COURSE)
      .map((node) => node.normalized_value),
    ['COMP SCI 200'],
  );
  assert.deepEqual(result.edges, []);
});

test('treats one-letter-leading multi-token subjects as parsed course leaves', () => {
  for (const [rawText, normalized] of [
    ['A A E 101', 'A A E 101'],
    ['L I S 202', 'L I S 202'],
    ['E P D 397', 'E P D 397'],
  ]) {
    const result = parsePrerequisiteText(rawText, {
      courseDesignation: normalized,
      termCode: '1272',
      courseId: `test:${normalized}`,
    });

    assert.equal(result.parseStatus, PARSE_STATUS.PARSED);
    assert.equal(result.unparsedText, null);
    assert.deepEqual(
      result.nodes
        .filter((node) => node.node_type === NODE_TYPE.COURSE)
        .map((node) => ({ normalized: node.normalized_value, raw: node.raw_value })),
      [{ normalized, raw: rawText }],
    );
    assert.deepEqual(result.edges, []);
  }
});

test('parses simple OR shorthand for one-letter-leading multi-token subjects', () => {
  const result = parsePrerequisiteText('(A A E 101 or 215)', {
    courseDesignation: 'A A E 320',
    termCode: '1272',
    courseId: '003320',
  });

  assert.equal(result.parseStatus, PARSE_STATUS.PARSED);
  assert.equal(result.unparsedText, null);
  assert.deepEqual(
    result.nodes
      .filter((node) => node.node_type === NODE_TYPE.COURSE)
      .map((node) => ({ normalized: node.normalized_value, raw: node.raw_value })),
    [
      { normalized: 'A A E 101', raw: 'A A E 101' },
      { normalized: 'A A E 215', raw: '215' },
    ],
  );
});

test('treats ASIAN AM as a plausible multi-word course subject', () => {
  const result = parsePrerequisiteText('ASIAN AM 101', {
    courseDesignation: 'ASIAN AM 500',
    termCode: '1272',
    courseId: '005500',
  });

  assert.equal(result.parseStatus, PARSE_STATUS.PARSED);
  assert.equal(result.unparsedText, null);
  assert.deepEqual(
    result.nodes
      .filter((node) => node.node_type === NODE_TYPE.COURSE)
      .map((node) => ({ normalized: node.normalized_value, raw: node.raw_value })),
    [{ normalized: 'ASIAN AM 101', raw: 'ASIAN AM 101' }],
  );
  assert.deepEqual(result.edges, []);
});

test('treats AFRICAN AMERICAN STUDIES as a plausible multi-word course subject', () => {
  const result = parsePrerequisiteText('AFRICAN AMERICAN STUDIES 101', {
    courseDesignation: 'AFRICAN AMERICAN STUDIES 500',
    termCode: '1272',
    courseId: '005500',
  });

  assert.equal(result.parseStatus, PARSE_STATUS.PARSED);
  assert.equal(result.unparsedText, null);
  assert.deepEqual(
    result.nodes
      .filter((node) => node.node_type === NODE_TYPE.COURSE)
      .map((node) => ({ normalized: node.normalized_value, raw: node.raw_value })),
    [{ normalized: 'AFRICAN AMERICAN STUDIES 101', raw: 'AFRICAN AMERICAN STUDIES 101' }],
  );
  assert.deepEqual(result.edges, []);
});

test('treats AMERICAN INDIAN STUDIES as a plausible multi-word course subject', () => {
  const result = parsePrerequisiteText('AMERICAN INDIAN STUDIES 100', {
    courseDesignation: 'AMERICAN INDIAN STUDIES 500',
    termCode: '1272',
    courseId: '005500',
  });

  assert.equal(result.parseStatus, PARSE_STATUS.PARSED);
  assert.equal(result.unparsedText, null);
  assert.deepEqual(
    result.nodes
      .filter((node) => node.node_type === NODE_TYPE.COURSE)
      .map((node) => ({ normalized: node.normalized_value, raw: node.raw_value })),
    [{ normalized: 'AMERICAN INDIAN STUDIES 100', raw: 'AMERICAN INDIAN STUDIES 100' }],
  );
  assert.deepEqual(result.edges, []);
});

test('does not parse uppercase prose ending in a number as a multi-word course leaf', () => {
  const result = parsePrerequisiteText('INTRO TO MATH 221', {
    courseDesignation: 'COMP SCI 577',
    termCode: '1272',
    courseId: '005577',
  });

  assert.equal(result.parseStatus, PARSE_STATUS.UNPARSED);
  assert.equal(result.unparsedText, 'INTRO TO MATH 221');
  assert.deepEqual(result.nodes, []);
  assert.deepEqual(result.edges, []);
});

test('does not parse exclusion prose ending in a number as a multi-word course leaf', () => {
  const result = parsePrerequisiteText('NOT OPEN TO FRESHMEN 101', {
    courseDesignation: 'COMP SCI 577',
    termCode: '1272',
    courseId: '005577',
  });

  assert.equal(result.parseStatus, PARSE_STATUS.UNPARSED);
  assert.equal(result.unparsedText, 'NOT OPEN TO FRESHMEN 101');
  assert.deepEqual(result.nodes, []);
  assert.deepEqual(result.edges, []);
});

test('recognizes multi-word subject courses inside mixed expressions', () => {
  const result = parsePrerequisiteText('COMP SCI 200 and MATH 221', {
    courseDesignation: 'COMP SCI 300',
    termCode: '1272',
    courseId: '003300',
  });

  assert.equal(result.parseStatus, PARSE_STATUS.PARTIAL);
  assert.ok(result.nodes.some((node) => node.node_type === NODE_TYPE.COURSE && node.normalized_value === 'COMP SCI 200'));
  assert.ok(result.nodes.some((node) => node.node_type === NODE_TYPE.COURSE && node.normalized_value === 'MATH 221'));
  assert.equal(result.unparsedText, '[COURSE] and [COURSE]');
});

test('replaces placeholders at accepted match spans for multi-word subject courses', () => {
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
    ['COMP SCI 200', 'SCI 200'],
  );
  assert.equal(result.unparsedText, '[COURSE] and [COURSE]');
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

test('preserves connective text in partial skeletons when source spacing expands course raw slices', () => {
  const result = parsePrerequisiteText('MATH   221 and LAW 742', {
    courseDesignation: 'MATH 500',
    termCode: '1272',
    courseId: '005500',
  });

  assert.equal(result.parseStatus, PARSE_STATUS.PARTIAL);
  assert.equal(result.unparsedText, '[COURSE] and [COURSE]');
});

test('preserves full rhs raw slice when simple OR fast path has an explicit subject', () => {
  const result = parsePrerequisiteText('ITALIAN 204 or FRENCH 205', {
    courseDesignation: 'ITALIAN 230',
    termCode: '1272',
    courseId: '002230',
  });

  assert.equal(result.parseStatus, PARSE_STATUS.PARSED);
  assert.deepEqual(
    result.nodes
      .filter((node) => node.node_type === NODE_TYPE.COURSE)
      .map((node) => ({ normalized: node.normalized_value, raw: node.raw_value })),
    [
      { normalized: 'ITALIAN 204', raw: 'ITALIAN 204' },
      { normalized: 'FRENCH 205', raw: 'FRENCH 205' },
    ],
  );
});

test('preserves raw spacing for a parenthesized lone course leaf', () => {
  const result = parsePrerequisiteText('(MATH   221)', {
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

test('preserves raw spacing inside parenthesized simple OR clauses', () => {
  const result = parsePrerequisiteText('(ITALIAN 204 or FRENCH   205)', {
    courseDesignation: 'ITALIAN 230',
    termCode: '1272',
    courseId: '002230',
  });

  assert.equal(result.parseStatus, PARSE_STATUS.PARSED);
  assert.deepEqual(
    result.nodes
      .filter((node) => node.node_type === NODE_TYPE.COURSE)
      .map((node) => ({ normalized: node.normalized_value, raw: node.raw_value })),
    [
      { normalized: 'ITALIAN 204', raw: 'ITALIAN 204' },
      { normalized: 'FRENCH 205', raw: 'FRENCH   205' },
    ],
  );
});

test('does not fabricate an OR-tail course node inside grouped mixed expressions', () => {
  const result = parsePrerequisiteText('MATH 221 and (ITALIAN 204 OR 205)', {
    courseDesignation: 'MATH 500',
    termCode: '1272',
    courseId: '005500',
  });

  assert.equal(result.parseStatus, PARSE_STATUS.PARTIAL);
  assert.deepEqual(
    result.nodes
      .filter((node) => node.node_type === NODE_TYPE.COURSE)
      .map((node) => node.normalized_value),
    ['MATH 221', 'ITALIAN 204', 'ITALIAN 205'],
  );
  assert.ok(!result.nodes.some((node) => node.node_type === NODE_TYPE.COURSE && node.normalized_value === 'OR 205'));
  assert.equal(result.unparsedText, '[COURSE] and ([COURSE] OR [COURSE])');
});

test('recognizes grouped shorthand courses inside standing partials', () => {
  const result = parsePrerequisiteText('Graduate/professional standing and (ITALIAN 204 or 205)', {
    courseDesignation: 'ITALIAN 230',
    termCode: '1272',
    courseId: '002230',
  });

  assert.equal(result.parseStatus, PARSE_STATUS.PARTIAL);
  assert.ok(result.nodes.some((node) => node.node_type === NODE_TYPE.STANDING));
  assert.deepEqual(
    result.nodes
      .filter((node) => node.node_type === NODE_TYPE.COURSE)
      .map((node) => node.normalized_value),
    ['ITALIAN 204', 'ITALIAN 205'],
  );
  assert.equal(result.unparsedText, '[STANDING] and ([COURSE] or [COURSE])');
});

test('recognizes grouped shorthand multi-token subjects inside standing partials', () => {
  const result = parsePrerequisiteText('Graduate/professional standing and (ACCT I S 100 or 200)', {
    courseDesignation: 'ACCT I S 300',
    termCode: '1272',
    courseId: '003300',
  });

  assert.equal(result.parseStatus, PARSE_STATUS.PARTIAL);
  assert.ok(result.nodes.some((node) => node.node_type === NODE_TYPE.STANDING));
  assert.deepEqual(
    result.nodes
      .filter((node) => node.node_type === NODE_TYPE.COURSE)
      .map((node) => node.normalized_value),
    ['ACCT I S 100', 'ACCT I S 200'],
  );
  assert.equal(result.unparsedText, '[STANDING] and ([COURSE] or [COURSE])');
});

test('recognizes shorthand course alternatives in partial clauses after a full course reference', () => {
  const result = parsePrerequisiteText('A A E 101 (215 prior to Fall 2024), ECON 101, or 111', {
    courseDesignation: 'A A E 320',
    termCode: '1272',
    courseId: '003320',
  });

  assert.equal(result.parseStatus, PARSE_STATUS.PARTIAL);
  assert.deepEqual(
    result.nodes
      .filter((node) => node.node_type === NODE_TYPE.COURSE)
      .map((node) => ({ normalized: node.normalized_value, raw: node.raw_value })),
    [
      { normalized: 'A A E 101', raw: 'A A E 101' },
      { normalized: 'ECON 101', raw: 'ECON 101' },
      { normalized: 'ECON 111', raw: '111' },
    ],
  );
  assert.equal(result.unparsedText, '[COURSE] (215 prior to Fall 2024), [COURSE], or [COURSE]');
});

test('recognizes comma-separated shorthand course lists after a full course reference', () => {
  const result = parsePrerequisiteText('SOC 134, 210, or 211', {
    courseDesignation: 'SOC 340',
    termCode: '1272',
    courseId: '003340',
  });

  assert.equal(result.parseStatus, PARSE_STATUS.PARTIAL);
  assert.deepEqual(
    result.nodes
      .filter((node) => node.node_type === NODE_TYPE.COURSE)
      .map((node) => ({ normalized: node.normalized_value, raw: node.raw_value })),
    [
      { normalized: 'SOC 134', raw: 'SOC 134' },
      { normalized: 'SOC 210', raw: '210' },
      { normalized: 'SOC 211', raw: '211' },
    ],
  );
  assert.equal(result.unparsedText, '[COURSE], [COURSE], or [COURSE]');
});

test('recognizes shorthand numbers after an unresolved slash-subject clause with an explicit safe subject', () => {
  const result = parsePrerequisiteText('SOC 140, C&E SOC/SOC 181, 210, or 211', {
    courseDesignation: 'SOC 340',
    termCode: '1272',
    courseId: '003340',
  });

  assert.equal(result.parseStatus, PARSE_STATUS.PARTIAL);
  assert.deepEqual(
    result.nodes
      .filter((node) => node.node_type === NODE_TYPE.COURSE)
      .map((node) => ({ normalized: node.normalized_value, raw: node.raw_value })),
    [
      { normalized: 'SOC 140', raw: 'SOC 140' },
      { normalized: 'SOC 210', raw: '210' },
      { normalized: 'SOC 211', raw: '211' },
    ],
  );
  assert.equal(result.unparsedText, '[COURSE], C&E SOC/SOC 181, [COURSE], or [COURSE]');
});

test('recognizes single-token slash-subject alternatives conservatively inside larger course lists', () => {
  const result = parsePrerequisiteText('MATH/STAT 309, 431, STAT 333, or 340', {
    courseDesignation: 'STAT 500',
    termCode: '1272',
    courseId: '005500',
  });

  assert.equal(result.parseStatus, PARSE_STATUS.PARTIAL);
  assert.equal(result.unparsedText, '[COURSE]/[COURSE], [COURSE], [COURSE], or [COURSE]');
  assert.deepEqual(
    result.nodes
      .filter((node) => node.node_type === NODE_TYPE.COURSE)
      .map((node) => ({ normalized: node.normalized_value, raw: node.raw_value })),
    [
      { normalized: 'MATH 309', raw: 'MATH' },
      { normalized: 'STAT 309', raw: 'STAT 309' },
      { normalized: 'STAT 431', raw: '431' },
      { normalized: 'STAT 333', raw: 'STAT 333' },
      { normalized: 'STAT 340', raw: '340' },
    ],
  );
});

test('recognizes shorthand before a later explicit subject anchor in slash-subject lists', () => {
  const result = parsePrerequisiteText('MATH/STAT 309, 431, or STAT 333', {
    courseDesignation: 'STAT 500',
    termCode: '1272',
    courseId: '005500',
  });

  assert.equal(result.parseStatus, PARSE_STATUS.PARTIAL);
  assert.equal(result.unparsedText, '[COURSE]/[COURSE], [COURSE], or [COURSE]');
  assert.deepEqual(
    result.nodes
      .filter((node) => node.node_type === NODE_TYPE.COURSE)
      .map((node) => ({ normalized: node.normalized_value, raw: node.raw_value })),
    [
      { normalized: 'MATH 309', raw: 'MATH' },
      { normalized: 'STAT 309', raw: 'STAT 309' },
      { normalized: 'STAT 431', raw: '431' },
      { normalized: 'STAT 333', raw: 'STAT 333' },
    ],
  );
});

test('does not infer shorthand after ambiguous single-token slash clauses without a later explicit subject', () => {
  const result = parsePrerequisiteText('MATH/STAT 309, 431', {
    courseDesignation: 'STAT 500',
    termCode: '1272',
    courseId: '005500',
  });

  assert.equal(result.parseStatus, PARSE_STATUS.PARTIAL);
  assert.equal(result.unparsedText, '[COURSE]/[COURSE], 431');
  assert.deepEqual(
    result.nodes
      .filter((node) => node.node_type === NODE_TYPE.COURSE)
      .map((node) => ({ normalized: node.normalized_value, raw: node.raw_value })),
    [
      { normalized: 'MATH 309', raw: 'MATH' },
      { normalized: 'STAT 309', raw: 'STAT 309' },
    ],
  );
});

test('does not infer shorthand after ambiguous multi-token slash clauses without a later explicit subject', () => {
  const result = parsePrerequisiteText('COMP SCI/MATH 240, 431', {
    courseDesignation: 'COMP SCI 577',
    termCode: '1272',
    courseId: '005577',
  });

  assert.equal(result.parseStatus, PARSE_STATUS.PARTIAL);
  assert.equal(result.unparsedText, '[COURSE]/[COURSE], 431');
  assert.deepEqual(
    result.nodes
      .filter((node) => node.node_type === NODE_TYPE.COURSE)
      .map((node) => ({ normalized: node.normalized_value, raw: node.raw_value })),
    [
      { normalized: 'COMP SCI 240', raw: 'COMP SCI' },
      { normalized: 'MATH 240', raw: 'MATH 240' },
    ],
  );
});

test('does not infer shorthand after ambiguous slash clauses with and but no later explicit subject', () => {
  const result = parsePrerequisiteText('BIO/ZOO 101, and 102', {
    courseDesignation: 'ZOOLOGY 500',
    termCode: '1272',
    courseId: '005500',
  });

  assert.equal(result.parseStatus, PARSE_STATUS.PARTIAL);
  assert.equal(result.unparsedText, '[COURSE]/[COURSE], and 102');
  assert.deepEqual(
    result.nodes
      .filter((node) => node.node_type === NODE_TYPE.COURSE)
      .map((node) => ({ normalized: node.normalized_value, raw: node.raw_value })),
    [
      { normalized: 'BIO 101', raw: 'BIO' },
      { normalized: 'ZOO 101', raw: 'ZOO 101' },
    ],
  );
});

test('recognizes trailing shorthand numbers introduced by and', () => {
  const result = parsePrerequisiteText('ABT 700, 705, and 710', {
    courseDesignation: 'ABT 800',
    termCode: '1272',
    courseId: '008000',
  });

  assert.equal(result.parseStatus, PARSE_STATUS.PARTIAL);
  assert.equal(result.unparsedText, '[COURSE], [COURSE], and [COURSE]');
  assert.deepEqual(
    result.nodes
      .filter((node) => node.node_type === NODE_TYPE.COURSE)
      .map((node) => ({ normalized: node.normalized_value, raw: node.raw_value })),
    [
      { normalized: 'ABT 700', raw: 'ABT 700' },
      { normalized: 'ABT 705', raw: '705' },
      { normalized: 'ABT 710', raw: '710' },
    ],
  );
});

test('does not emit a trailing course node for unresolved subject OR alternatives', () => {
  const result = parsePrerequisiteText('MATH or STAT 309', {
    courseDesignation: 'MATH 500',
    termCode: '1272',
    courseId: '005500',
  });

  assert.equal(result.parseStatus, PARSE_STATUS.UNPARSED);
  assert.equal(result.unparsedText, 'MATH or STAT 309');
  assert.deepEqual(result.nodes, []);
  assert.deepEqual(result.edges, []);
});

test('does not emit a trailing course node for unresolved subject AND alternatives', () => {
  const result = parsePrerequisiteText('MATH and STAT 309', {
    courseDesignation: 'MATH 500',
    termCode: '1272',
    courseId: '005500',
  });

  assert.equal(result.parseStatus, PARSE_STATUS.UNPARSED);
  assert.equal(result.unparsedText, 'MATH and STAT 309');
  assert.deepEqual(result.nodes, []);
  assert.deepEqual(result.edges, []);
});

test('keeps unresolved subject alternatives opaque while recognizing independent full courses', () => {
  const result = parsePrerequisiteText('MATH or STAT 309 or LAW 200', {
    courseDesignation: 'MATH 500',
    termCode: '1272',
    courseId: '005500',
  });

  assert.equal(result.parseStatus, PARSE_STATUS.PARTIAL);
  assert.equal(result.unparsedText, 'MATH or STAT 309 or [COURSE]');
  assert.deepEqual(
    result.nodes
      .filter((node) => node.node_type === NODE_TYPE.COURSE)
      .map((node) => node.normalized_value),
    ['LAW 200'],
  );
  assert.ok(!result.nodes.some((node) => node.node_type === NODE_TYPE.COURSE && node.normalized_value === 'STAT 309'));
  assert.deepEqual(result.edges, []);
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

test('recognizes ampersand-joined subject tokens without collapsing to the suffix subject', () => {
  const result = parsePrerequisiteText('ANAT&PHY 337 (KINES 337 before fall 2018), or ANATOMY/KINES 328, or concurrent enrollment', {
    courseDesignation: 'ANAT&PHY 338',
    termCode: '1272',
    courseId: '003338',
  });

  assert.equal(result.parseStatus, PARSE_STATUS.PARTIAL);
  assert.deepEqual(
    result.nodes
      .filter((node) => node.node_type === NODE_TYPE.COURSE)
      .map((node) => ({ normalized: node.normalized_value, raw: node.raw_value })),
    [
      { normalized: 'ANAT&PHY 337', raw: 'ANAT&PHY 337' },
      { normalized: 'KINES 337', raw: 'KINES 337' },
      { normalized: 'ANATOMY 328', raw: 'ANATOMY' },
      { normalized: 'KINES 328', raw: 'KINES 328' },
    ],
  );
  assert.ok(!result.nodes.some((node) => node.node_type === NODE_TYPE.COURSE && node.normalized_value === 'PHY 337'));
  assert.equal(
    result.unparsedText,
    '[COURSE] ([COURSE] before fall 2018), or [COURSE]/[COURSE], or concurrent enrollment',
  );
});

test('recognizes standalone shared-number slash clauses conservatively at top-level OR boundaries', () => {
  const result = parsePrerequisiteText('ANAT&PHY 337 or ANATOMY/KINES 328', {
    courseDesignation: 'ANAT&PHY 338',
    termCode: '1272',
    courseId: '003338',
  });

  assert.equal(result.parseStatus, PARSE_STATUS.PARTIAL);
  assert.equal(result.unparsedText, '[COURSE] or [COURSE]/[COURSE]');
  assert.deepEqual(
    result.nodes
      .filter((node) => node.node_type === NODE_TYPE.COURSE)
      .map((node) => ({ normalized: node.normalized_value, raw: node.raw_value })),
    [
      { normalized: 'ANAT&PHY 337', raw: 'ANAT&PHY 337' },
      { normalized: 'ANATOMY 328', raw: 'ANATOMY' },
      { normalized: 'KINES 328', raw: 'KINES 328' },
    ],
  );
  assert.deepEqual(result.edges, []);
});

test('does not emit slash-alternative course nodes from parenthetical alias notes', () => {
  const result = parsePrerequisiteText('MATH 221 (COMP SCI/MATH 240 equivalent), or concurrent enrollment', {
    courseDesignation: 'MATH 500',
    termCode: '1272',
    courseId: '005500',
  });

  assert.equal(result.parseStatus, PARSE_STATUS.PARTIAL);
  assert.deepEqual(
    result.nodes
      .filter((node) => node.node_type === NODE_TYPE.COURSE)
      .map((node) => ({ normalized: node.normalized_value, raw: node.raw_value })),
    [{ normalized: 'MATH 221', raw: 'MATH 221' }],
  );
  assert.equal(result.unparsedText, '[COURSE] (COMP SCI/MATH 240 equivalent), or concurrent enrollment');
  assert.deepEqual(result.edges, []);
});

test('recognizes ampersand-separated multi-token subjects and shorthand numbers conservatively', () => {
  const result = parsePrerequisiteText('M S & E 350, 351, or CBE 440, or member of Engineering Guest Students', {
    courseDesignation: 'M S & E 500',
    termCode: '1272',
    courseId: '005500',
  });

  assert.equal(result.parseStatus, PARSE_STATUS.PARTIAL);
  assert.deepEqual(
    result.nodes
      .filter((node) => node.node_type === NODE_TYPE.COURSE)
      .map((node) => ({ normalized: node.normalized_value, raw: node.raw_value })),
    [
      { normalized: 'M S & E 350', raw: 'M S & E 350' },
      { normalized: 'M S & E 351', raw: '351' },
      { normalized: 'CBE 440', raw: 'CBE 440' },
    ],
  );
  assert.equal(result.unparsedText, '[COURSE], [COURSE], or [COURSE], or member of Engineering Guest Students');
});

test('recognizes compact ampersand subject families in simple OR clauses', () => {
  const result = parsePrerequisiteText('C&E SOC 140 or SOC 181', {
    courseDesignation: 'SOC 500',
    termCode: '1272',
    courseId: '005500',
  });

  assert.equal(result.parseStatus, PARSE_STATUS.PARSED);
  assert.equal(result.unparsedText, null);
  assert.deepEqual(
    result.nodes
      .filter((node) => node.node_type === NODE_TYPE.COURSE)
      .map((node) => ({ normalized: node.normalized_value, raw: node.raw_value })),
    [
      { normalized: 'C&E SOC 140', raw: 'C&E SOC 140' },
      { normalized: 'SOC 181', raw: 'SOC 181' },
    ],
  );
});

test('does not parse college-name prose as a course subject', () => {
  const result = parsePrerequisiteText('COLLEGE OF ENGINEERING 101', {
    courseDesignation: 'COMP SCI 500',
    termCode: '1272',
    courseId: '005500',
  });

  assert.equal(result.parseStatus, PARSE_STATUS.UNPARSED);
  assert.equal(result.unparsedText, 'COLLEGE OF ENGINEERING 101');
  assert.deepEqual(result.nodes, []);
  assert.deepEqual(result.edges, []);
});

test('does not parse school-name prose as a course subject', () => {
  const result = parsePrerequisiteText('SCHOOL OF BUSINESS 200', {
    courseDesignation: 'COMP SCI 500',
    termCode: '1272',
    courseId: '005500',
  });

  assert.equal(result.parseStatus, PARSE_STATUS.UNPARSED);
  assert.equal(result.unparsedText, 'SCHOOL OF BUSINESS 200');
  assert.deepEqual(result.nodes, []);
  assert.deepEqual(result.edges, []);
});

test('does not parse declared-status prose as a course subject while preserving later anchored shorthand courses', () => {
  const result = parsePrerequisiteText('DECLARED IN COMPUTER SCIENCES 240, STAT 309, or 340', {
    courseDesignation: 'COMP SCI 500',
    termCode: '1272',
    courseId: '005500',
  });

  assert.equal(result.parseStatus, PARSE_STATUS.PARTIAL);
  assert.equal(result.unparsedText, 'DECLARED IN COMPUTER SCIENCES 240, [COURSE], or [COURSE]');
  assert.deepEqual(
    result.nodes
      .filter((node) => node.node_type === NODE_TYPE.COURSE)
      .map((node) => ({ normalized: node.normalized_value, raw: node.raw_value })),
    [
      { normalized: 'STAT 309', raw: 'STAT 309' },
      { normalized: 'STAT 340', raw: '340' },
    ],
  );
});

test('recognizes shared-number slash subject families containing compact ampersand subjects inside larger course lists', () => {
  const result = parsePrerequisiteText('SOC/C&E SOC 140, 210, 211', {
    courseDesignation: 'SOC 340',
    termCode: '1272',
    courseId: '003340',
  });

  assert.equal(result.parseStatus, PARSE_STATUS.PARTIAL);
  assert.equal(result.unparsedText, '[COURSE]/[COURSE], [COURSE], [COURSE]');
  assert.deepEqual(
    result.nodes
      .filter((node) => node.node_type === NODE_TYPE.COURSE)
      .map((node) => ({ normalized: node.normalized_value, raw: node.raw_value })),
    [
      { normalized: 'SOC 140', raw: 'SOC' },
      { normalized: 'C&E SOC 140', raw: 'C&E SOC 140' },
      { normalized: 'SOC 210', raw: '210' },
      { normalized: 'SOC 211', raw: '211' },
    ],
  );
});

test('recognizes standalone shared-number slash clauses containing compact ampersand subjects', () => {
  const result = parsePrerequisiteText('AGROECOL/C&E SOC/ENTOM/ENVIR ST 103', {
    courseDesignation: 'ENVIR ST 500',
    termCode: '1272',
    courseId: '005500',
  });

  assert.equal(result.parseStatus, PARSE_STATUS.PARTIAL);
  assert.equal(result.unparsedText, '[COURSE]/[COURSE]/[COURSE]/[COURSE]');
  assert.deepEqual(
    result.nodes
      .filter((node) => node.node_type === NODE_TYPE.COURSE)
      .map((node) => ({ normalized: node.normalized_value, raw: node.raw_value })),
    [
      { normalized: 'AGROECOL 103', raw: 'AGROECOL' },
      { normalized: 'C&E SOC 103', raw: 'C&E SOC' },
      { normalized: 'ENTOM 103', raw: 'ENTOM' },
      { normalized: 'ENVIR ST 103', raw: 'ENVIR ST 103' },
    ],
  );
});

test('recognizes reversed suffix-family slash clauses conservatively while anchoring shorthand siblings', () => {
  const result = parsePrerequisiteText('C&E SOC/SOC 140, 210, or 211', {
    courseDesignation: 'SOC 357',
    termCode: '1272',
    courseId: '003357',
  });

  assert.equal(result.parseStatus, PARSE_STATUS.PARTIAL);
  assert.equal(result.unparsedText, '[COURSE]/[COURSE], [COURSE], or [COURSE]');
  assert.deepEqual(
    result.nodes
      .filter((node) => node.node_type === NODE_TYPE.COURSE)
      .map((node) => ({ normalized: node.normalized_value, raw: node.raw_value })),
    [
      { normalized: 'C&E SOC 140', raw: 'C&E SOC' },
      { normalized: 'SOC 140', raw: 'SOC 140' },
      { normalized: 'SOC 210', raw: '210' },
      { normalized: 'SOC 211', raw: '211' },
    ],
  );
});

test('does not treat reversed suffix-family slash clauses after preceding or text as clause-start anchors', () => {
  const result = parsePrerequisiteText('SOC 100 or C&E SOC/SOC 140, 210', {
    courseDesignation: 'SOC 357',
    termCode: '1272',
    courseId: '003357',
  });

  assert.equal(result.parseStatus, PARSE_STATUS.PARTIAL);
  assert.equal(result.unparsedText, '[COURSE] or C&E SOC/SOC 140, 210');
  assert.deepEqual(
    result.nodes
      .filter((node) => node.node_type === NODE_TYPE.COURSE)
      .map((node) => ({ normalized: node.normalized_value, raw: node.raw_value })),
    [{ normalized: 'SOC 100', raw: 'SOC 100' }],
  );
});

test('does not use a later ambiguous slash clause as an anchor for shorthand after an earlier slash family', () => {
  const result = parsePrerequisiteText('MATH/STAT 309, 431, or PHYS/STAT 240', {
    courseDesignation: 'STAT 500',
    termCode: '1272',
    courseId: '005500',
  });

  assert.equal(result.parseStatus, PARSE_STATUS.PARTIAL);
  assert.equal(result.unparsedText, '[COURSE]/[COURSE], 431, or [COURSE]/[COURSE]');
  assert.deepEqual(
    result.nodes
      .filter((node) => node.node_type === NODE_TYPE.COURSE)
      .map((node) => ({ normalized: node.normalized_value, raw: node.raw_value })),
    [
      { normalized: 'MATH 309', raw: 'MATH' },
      { normalized: 'STAT 309', raw: 'STAT 309' },
      { normalized: 'PHYS 240', raw: 'PHYS' },
      { normalized: 'STAT 240', raw: 'STAT 240' },
    ],
  );
});

test('does not infer shorthand when a mixed later clause is not a true explicit subject anchor', () => {
  const result = parsePrerequisiteText('MATH/STAT 309, 431, LAW 100 or PHYS/STAT 240', {
    courseDesignation: 'STAT 500',
    termCode: '1272',
    courseId: '005500',
  });

  assert.equal(result.parseStatus, PARSE_STATUS.PARTIAL);
  assert.equal(result.unparsedText, '[COURSE]/[COURSE], 431, [COURSE] or [COURSE]/[COURSE]');
  assert.deepEqual(
    result.nodes
      .filter((node) => node.node_type === NODE_TYPE.COURSE)
      .map((node) => ({ normalized: node.normalized_value, raw: node.raw_value })),
    [
      { normalized: 'MATH 309', raw: 'MATH' },
      { normalized: 'STAT 309', raw: 'STAT 309' },
      { normalized: 'LAW 100', raw: 'LAW 100' },
      { normalized: 'PHYS 240', raw: 'PHYS' },
      { normalized: 'STAT 240', raw: 'STAT 240' },
    ],
  );
  assert.ok(!result.nodes.some((node) => node.node_type === NODE_TYPE.COURSE && node.normalized_value === 'STAT 431'));
});

test('still infers shorthand when a later explicit subject anchor starts its own clause', () => {
  const result = parsePrerequisiteText('MATH/STAT 309, 431, or LAW 100', {
    courseDesignation: 'STAT 500',
    termCode: '1272',
    courseId: '005500',
  });

  assert.equal(result.parseStatus, PARSE_STATUS.PARTIAL);
  assert.equal(result.unparsedText, '[COURSE]/[COURSE], 431, or [COURSE]');
  assert.deepEqual(
    result.nodes
      .filter((node) => node.node_type === NODE_TYPE.COURSE)
      .map((node) => ({ normalized: node.normalized_value, raw: node.raw_value })),
    [
      { normalized: 'MATH 309', raw: 'MATH' },
      { normalized: 'STAT 309', raw: 'STAT 309' },
      { normalized: 'LAW 100', raw: 'LAW 100' },
    ],
  );
  assert.ok(!result.nodes.some((node) => node.node_type === NODE_TYPE.COURSE && node.normalized_value === 'STAT 431'));
});

test('does not use a later ambiguous slash clause as an anchor after a reversed suffix-family clause', () => {
  const result = parsePrerequisiteText('C&E SOC/SOC 140, 210, or PHYS/SOC 240', {
    courseDesignation: 'SOC 357',
    termCode: '1272',
    courseId: '003357',
  });

  assert.equal(result.parseStatus, PARSE_STATUS.PARTIAL);
  assert.equal(result.unparsedText, '[COURSE]/[COURSE], 210, or [COURSE]/[COURSE]');
  assert.deepEqual(
    result.nodes
      .filter((node) => node.node_type === NODE_TYPE.COURSE)
      .map((node) => ({ normalized: node.normalized_value, raw: node.raw_value })),
    [
      { normalized: 'C&E SOC 140', raw: 'C&E SOC' },
      { normalized: 'SOC 140', raw: 'SOC 140' },
      { normalized: 'PHYS 240', raw: 'PHYS' },
      { normalized: 'SOC 240', raw: 'SOC 240' },
    ],
  );
});

test('does not reuse a non-local detached single-token subject before an intervening course after a slash clause', () => {
  const result = parsePrerequisiteText('STAT 240, LAW 100, MATH/STAT 309, 431', {
    courseDesignation: 'STAT 500',
    termCode: '1272',
    courseId: '005500',
  });

  assert.equal(result.parseStatus, PARSE_STATUS.PARTIAL);
  assert.equal(result.unparsedText, '[COURSE], [COURSE], [COURSE]/[COURSE], 431');
  assert.deepEqual(
    result.nodes
      .filter((node) => node.node_type === NODE_TYPE.COURSE)
      .map((node) => ({ normalized: node.normalized_value, raw: node.raw_value })),
    [
      { normalized: 'STAT 240', raw: 'STAT 240' },
      { normalized: 'LAW 100', raw: 'LAW 100' },
      { normalized: 'MATH 309', raw: 'MATH' },
      { normalized: 'STAT 309', raw: 'STAT 309' },
    ],
  );
  assert.ok(!result.nodes.some((node) => node.node_type === NODE_TYPE.COURSE && node.normalized_value === 'STAT 431'));
});

test('does not reuse a non-local detached suffix subject before an intervening course after a slash clause', () => {
  const result = parsePrerequisiteText('SOC 140, PHYS 101, C&E SOC/SOC 181, 210', {
    courseDesignation: 'SOC 357',
    termCode: '1272',
    courseId: '003357',
  });

  assert.equal(result.parseStatus, PARSE_STATUS.PARTIAL);
  assert.equal(result.unparsedText, '[COURSE], [COURSE], C&E SOC/SOC 181, 210');
  assert.deepEqual(
    result.nodes
      .filter((node) => node.node_type === NODE_TYPE.COURSE)
      .map((node) => ({ normalized: node.normalized_value, raw: node.raw_value })),
    [
      { normalized: 'SOC 140', raw: 'SOC 140' },
      { normalized: 'PHYS 101', raw: 'PHYS 101' },
    ],
  );
  assert.ok(!result.nodes.some((node) => node.node_type === NODE_TYPE.COURSE && node.normalized_value === 'SOC 210'));
});

test('does not reuse an earlier course anchor across intervening standing text before a slash clause', () => {
  const result = parsePrerequisiteText('STAT 240 or graduate/professional standing, MATH/STAT 309, 431', {
    courseDesignation: 'STAT 500',
    termCode: '1272',
    courseId: '005500',
  });

  assert.equal(result.parseStatus, PARSE_STATUS.PARTIAL);
  assert.equal(result.unparsedText, '[COURSE] or [STANDING], [COURSE]/[COURSE], 431');
  assert.deepEqual(
    result.nodes
      .filter((node) => node.node_type === NODE_TYPE.COURSE)
      .map((node) => ({ normalized: node.normalized_value, raw: node.raw_value })),
    [
      { normalized: 'STAT 240', raw: 'STAT 240' },
      { normalized: 'MATH 309', raw: 'MATH' },
      { normalized: 'STAT 309', raw: 'STAT 309' },
    ],
  );
  assert.ok(!result.nodes.some((node) => node.node_type === NODE_TYPE.COURSE && node.normalized_value === 'STAT 431'));
});

test('does not reuse an earlier course anchor across intervening consent text before a slash clause', () => {
  const result = parsePrerequisiteText('SOC 140 or instructor consent, C&E SOC/SOC 181, 210', {
    courseDesignation: 'SOC 357',
    termCode: '1272',
    courseId: '003357',
  });

  assert.equal(result.parseStatus, PARSE_STATUS.PARTIAL);
  assert.equal(result.unparsedText, '[COURSE] or instructor consent, C&E SOC/SOC 181, 210');
  assert.deepEqual(
    result.nodes
      .filter((node) => node.node_type === NODE_TYPE.COURSE)
      .map((node) => ({ normalized: node.normalized_value, raw: node.raw_value })),
    [{ normalized: 'SOC 140', raw: 'SOC 140' }],
  );
  assert.ok(!result.nodes.some((node) => node.node_type === NODE_TYPE.COURSE && node.normalized_value === 'SOC 210'));
});

test('recognizes reversed suffix-family slash clauses inside grouped sibling clauses', () => {
  const result = parsePrerequisiteText('(C&E SOC/SOC 140, 210) and (SOC 100 or 101)', {
    courseDesignation: 'SOC 357',
    termCode: '1272',
    courseId: '003357',
  });

  assert.equal(result.parseStatus, PARSE_STATUS.PARTIAL);
  assert.equal(result.unparsedText, '([COURSE]/[COURSE], [COURSE]) and ([COURSE] or [COURSE])');
  assert.deepEqual(
    result.nodes
      .filter((node) => node.node_type === NODE_TYPE.COURSE)
      .map((node) => ({ normalized: node.normalized_value, raw: node.raw_value })),
    [
      { normalized: 'C&E SOC 140', raw: 'C&E SOC' },
      { normalized: 'SOC 140', raw: 'SOC 140' },
      { normalized: 'SOC 210', raw: '210' },
      { normalized: 'SOC 100', raw: 'SOC 100' },
      { normalized: 'SOC 101', raw: '101' },
    ],
  );
});

test('recognizes slash-family shorthand salvage inside grouped sibling clauses', () => {
  const result = parsePrerequisiteText('(MATH/STAT 309, 431, or STAT 333) and (COMP SCI 200 or 300)', {
    courseDesignation: 'STAT 500',
    termCode: '1272',
    courseId: '005500',
  });

  assert.equal(result.parseStatus, PARSE_STATUS.PARTIAL);
  assert.equal(result.unparsedText, '([COURSE]/[COURSE], [COURSE], or [COURSE]) and ([COURSE] or [COURSE])');
  assert.deepEqual(
    result.nodes
      .filter((node) => node.node_type === NODE_TYPE.COURSE)
      .map((node) => ({ normalized: node.normalized_value, raw: node.raw_value })),
    [
      { normalized: 'MATH 309', raw: 'MATH' },
      { normalized: 'STAT 309', raw: 'STAT 309' },
      { normalized: 'STAT 431', raw: '431' },
      { normalized: 'STAT 333', raw: 'STAT 333' },
      { normalized: 'COMP SCI 200', raw: 'COMP SCI 200' },
      { normalized: 'COMP SCI 300', raw: '300' },
    ],
  );
});

test('does not emit slash-family course nodes from connective-introduced parenthetical notes', () => {
  const result = parsePrerequisiteText('SOC 100 or (C&E SOC/SOC 140 equivalent)', {
    courseDesignation: 'SOC 357',
    termCode: '1272',
    courseId: '003357',
  });

  assert.equal(result.parseStatus, PARSE_STATUS.PARTIAL);
  assert.equal(result.unparsedText, '[COURSE] or (C&E SOC/SOC 140 equivalent)');
  assert.deepEqual(
    result.nodes
      .filter((node) => node.node_type === NODE_TYPE.COURSE)
      .map((node) => ({ normalized: node.normalized_value, raw: node.raw_value })),
    [{ normalized: 'SOC 100', raw: 'SOC 100' }],
  );
});

test('does not emit multi-token slash-family course nodes from OR-introduced parenthetical notes', () => {
  const result = parsePrerequisiteText('SOC 100 or (COMP SCI/MATH 240 equivalent)', {
    courseDesignation: 'SOC 357',
    termCode: '1272',
    courseId: '003357',
  });

  assert.equal(result.parseStatus, PARSE_STATUS.PARTIAL);
  assert.equal(result.unparsedText, '[COURSE] or (COMP SCI/MATH 240 equivalent)');
  assert.deepEqual(
    result.nodes
      .filter((node) => node.node_type === NODE_TYPE.COURSE)
      .map((node) => ({ normalized: node.normalized_value, raw: node.raw_value })),
    [{ normalized: 'SOC 100', raw: 'SOC 100' }],
  );
});

test('does not emit multi-token slash-family course nodes from AND-introduced parenthetical notes', () => {
  const result = parsePrerequisiteText('SOC 100 and (COMP SCI/MATH 240 equivalent)', {
    courseDesignation: 'SOC 357',
    termCode: '1272',
    courseId: '003357',
  });

  assert.equal(result.parseStatus, PARSE_STATUS.PARTIAL);
  assert.equal(result.unparsedText, '[COURSE] and (COMP SCI/MATH 240 equivalent)');
  assert.deepEqual(
    result.nodes
      .filter((node) => node.node_type === NODE_TYPE.COURSE)
      .map((node) => ({ normalized: node.normalized_value, raw: node.raw_value })),
    [{ normalized: 'SOC 100', raw: 'SOC 100' }],
  );
});

test('does not emit slash-family course nodes from connective-introduced parenthetical notes with comma prose tails', () => {
  const result = parsePrerequisiteText('SOC 100 or (COMP SCI/MATH 240, with instructor consent)', {
    courseDesignation: 'SOC 357',
    termCode: '1272',
    courseId: '003357',
  });

  assert.equal(result.parseStatus, PARSE_STATUS.PARTIAL);
  assert.equal(result.unparsedText, '[COURSE] or (COMP SCI/MATH 240, with instructor consent)');
  assert.deepEqual(
    result.nodes
      .filter((node) => node.node_type === NODE_TYPE.COURSE)
      .map((node) => ({ normalized: node.normalized_value, raw: node.raw_value })),
    [{ normalized: 'SOC 100', raw: 'SOC 100' }],
  );
});

test('does not emit ordinary course nodes from connective-introduced parenthetical notes with comma prose tails', () => {
  const result = parsePrerequisiteText('SOC 100 or (COMP SCI 240, with instructor consent)', {
    courseDesignation: 'SOC 357',
    termCode: '1272',
    courseId: '003357',
  });

  assert.equal(result.parseStatus, PARSE_STATUS.PARTIAL);
  assert.equal(result.unparsedText, '[COURSE] or (COMP SCI 240, with instructor consent)');
  assert.deepEqual(
    result.nodes
      .filter((node) => node.node_type === NODE_TYPE.COURSE)
      .map((node) => ({ normalized: node.normalized_value, raw: node.raw_value })),
    [{ normalized: 'SOC 100', raw: 'SOC 100' }],
  );
});

test('does not emit ordinary course nodes from connective-introduced parenthetical notes with or equivalent tails', () => {
  const result = parsePrerequisiteText('SOC 100 or (COMP SCI 240 or equivalent)', {
    courseDesignation: 'SOC 357',
    termCode: '1272',
    courseId: '003357',
  });

  assert.equal(result.parseStatus, PARSE_STATUS.PARTIAL);
  assert.equal(result.unparsedText, '[COURSE] or (COMP SCI 240 or equivalent)');
  assert.deepEqual(
    result.nodes
      .filter((node) => node.node_type === NODE_TYPE.COURSE)
      .map((node) => ({ normalized: node.normalized_value, raw: node.raw_value })),
    [{ normalized: 'SOC 100', raw: 'SOC 100' }],
  );
});

test('does not emit slash-family course nodes from connective-introduced parenthetical notes with or equivalent tails', () => {
  const result = parsePrerequisiteText('SOC 100 or (COMP SCI/MATH 240 or equivalent)', {
    courseDesignation: 'SOC 357',
    termCode: '1272',
    courseId: '003357',
  });

  assert.equal(result.parseStatus, PARSE_STATUS.PARTIAL);
  assert.equal(result.unparsedText, '[COURSE] or (COMP SCI/MATH 240 or equivalent)');
  assert.deepEqual(
    result.nodes
      .filter((node) => node.node_type === NODE_TYPE.COURSE)
      .map((node) => ({ normalized: node.normalized_value, raw: node.raw_value })),
    [{ normalized: 'SOC 100', raw: 'SOC 100' }],
  );
});

test('parses single-letter spaced subject course references like E C E 340', () => {
  const result = parsePrerequisiteText('E C E 340 or E C E 342', {
    courseDesignation: 'E C E 500',
    termCode: '1272',
    courseId: '005001',
  });

  assert.equal(result.parseStatus, PARSE_STATUS.PARSED);
  assert.equal(result.unparsedText, null);
  assert.ok(result.nodes.some((node) => node.node_type === NODE_TYPE.OR));
  assert.deepEqual(
    result.nodes
      .filter((node) => node.node_type === NODE_TYPE.COURSE)
      .map((node) => node.normalized_value),
    ['E C E 340', 'E C E 342'],
  );
  assert.equal(result.edges.length, 2);
});

test('parses single-letter spaced subject shorthand like L I S 301 or 401', () => {
  const result = parsePrerequisiteText('L I S 301 or 401', {
    courseDesignation: 'L I S 640',
    termCode: '1272',
    courseId: '006400',
  });

  assert.equal(result.parseStatus, PARSE_STATUS.PARSED);
  assert.equal(result.unparsedText, null);
  assert.ok(result.nodes.some((node) => node.node_type === NODE_TYPE.OR));
  assert.deepEqual(
    result.nodes
      .filter((node) => node.node_type === NODE_TYPE.COURSE)
      .map((node) => node.normalized_value),
    ['L I S 301', 'L I S 401'],
  );
  assert.equal(result.edges.length, 2);
});
