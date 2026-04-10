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
  assert.equal(result.nodes[0].node_type, NODE_TYPE.OR);
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
  assert.match(result.unparsedText, /Consent of instructor/i);
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
  assert.match(result.unparsedText, /Business Exchange program/i);
});
