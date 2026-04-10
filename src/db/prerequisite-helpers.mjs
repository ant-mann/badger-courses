export const PARSE_STATUS = {
  PARSED: 'parsed',
  PARTIAL: 'partial',
  UNPARSED: 'unparsed',
};

export const NODE_TYPE = {
  AND: 'AND',
  OR: 'OR',
  COURSE: 'COURSE',
  STANDING: 'STANDING',
  CONSENT: 'CONSENT',
  PROGRAM: 'PROGRAM',
  CONCURRENT: 'CONCURRENT',
  PLACEMENT: 'PLACEMENT',
  TEXT: 'TEXT',
};

const COURSE_REFERENCE_PATTERN = /\b([A-Z][A-Z]+(?:\s+[A-Z])*)\s+(\d{3}[A-Z]?)\b/g;
let nextNodeId = 1;

function createNode(node_type, normalized_value, raw_value = normalized_value) {
  return {
    id: `node-${nextNodeId++}`,
    node_type,
    normalized_value,
    raw_value,
  };
}

function createResult(parseStatus, unparsedText, nodes = [], edges = []) {
  return {
    parseStatus,
    unparsedText,
    nodes,
    edges,
  };
}

function normalizeText(text) {
  return text.replace(/\s+/g, ' ').trim();
}

function escapeRegExp(text) {
  return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function parseSimpleOrCourseClause(text) {
  const match = text.match(/^([A-Z][A-Z]+(?:\s+[A-Z])*)\s+(\d{3}[A-Z]?)\s+or\s+((?:[A-Z][A-Z]+(?:\s+[A-Z])*)\s+)?(\d{3}[A-Z]?)$/i);

  if (!match) {
    return null;
  }

  const leftSubject = normalizeText(match[1].toUpperCase());
  const leftNumber = match[2].toUpperCase();
  const rightSubject = normalizeText((match[3] ?? match[1]).toUpperCase());
  const rightNumber = match[4].toUpperCase();

  return {
    left: `${leftSubject} ${leftNumber}`,
    right: `${rightSubject} ${rightNumber}`,
  };
}

function extractStandingNodes(text) {
  const matches = [];
  const standingMatch = text.match(/\bgraduate\/professional standing\b/i);

  if (standingMatch) {
    matches.push({
      matchedText: standingMatch[0],
      node: createNode(NODE_TYPE.STANDING, 'Graduate/professional standing', standingMatch[0]),
    });
  }

  return matches;
}

function extractCourseNodes(text) {
  const matches = [];

  for (const match of text.matchAll(COURSE_REFERENCE_PATTERN)) {
    const subject = normalizeText(match[1].toUpperCase());
    const number = match[2].toUpperCase();

    matches.push({
      matchedText: match[0],
      node: createNode(NODE_TYPE.COURSE, `${subject} ${number}`, match[0]),
    });
  }

  return matches;
}

function buildUnparsedText(text, recognizedSpans) {
  let remainder = text;

  for (const span of recognizedSpans) {
    remainder = remainder.replace(new RegExp(escapeRegExp(span), 'i'), ' ');
  }

  remainder = remainder
    .replace(/[()]/g, ' ')
    .replace(/\s*,\s*/g, ', ')
    .replace(/(^[\s,]+|[\s,]+$)/g, ' ');

  const normalized = normalizeText(remainder.replace(/\s*,\s*/g, ', '));
  return normalized || null;
}

export function parsePrerequisiteText(text) {
  nextNodeId = 1;
  const normalizedText = normalizeText(text ?? '');

  if (!normalizedText) {
    return createResult(PARSE_STATUS.UNPARSED, null);
  }

  if (/^consent of instructor$/i.test(normalizedText)) {
    return createResult(PARSE_STATUS.UNPARSED, normalizedText);
  }

  const simpleOrCourses = parseSimpleOrCourseClause(normalizedText);

  if (simpleOrCourses) {
    const orNode = createNode(NODE_TYPE.OR, 'OR', 'or');
    const leftCourse = createNode(NODE_TYPE.COURSE, simpleOrCourses.left, simpleOrCourses.left);
    const rightCourse = createNode(NODE_TYPE.COURSE, simpleOrCourses.right, simpleOrCourses.right);

    return createResult(PARSE_STATUS.PARSED, null, [orNode, leftCourse, rightCourse], [
      { source: orNode.id, target: leftCourse.id },
      { source: orNode.id, target: rightCourse.id },
    ]);
  }

  const standingMatches = extractStandingNodes(normalizedText);
  const courseMatches = extractCourseNodes(normalizedText);
  const recognizedMatches = [...standingMatches, ...courseMatches];

  if (recognizedMatches.length === 0) {
    return createResult(PARSE_STATUS.UNPARSED, normalizedText);
  }

  const nodes = recognizedMatches.map((match) => match.node);
  const unparsedText = buildUnparsedText(
    normalizedText,
    recognizedMatches.map((match) => match.matchedText),
  );

  return createResult(
    PARSE_STATUS.PARTIAL,
    unparsedText,
    nodes,
    [],
  );
}
