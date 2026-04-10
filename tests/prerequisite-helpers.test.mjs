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
  assert.match(result.unparsedText, /Accounting and Business Analysis MSB/i);
  assert.match(result.unparsedText, /Business Exchange program/i);
  assert.doesNotMatch(result.unparsedText, /^and\s+or\b/i);
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
  assert.equal(result.unparsedText, 'and');
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
  assert.equal(result.unparsedText, 'and');
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
  assert.equal(result.unparsedText, 'or or');
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
  assert.equal(result.unparsedText, ',');
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
  assert.equal(result.unparsedText, '( )');
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
  assert.equal(result.unparsedText, 'Declared in program X or');
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
  assert.equal(result.unparsedText, 'and consent of instructor');
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
