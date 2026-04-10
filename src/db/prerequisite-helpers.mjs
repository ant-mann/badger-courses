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

function pickNearestConnective(connectives, side) {
  const parts = normalizeText(connectives).toLowerCase().split(' ');

  if (parts.length === 0) {
    return null;
  }

  return side === 'prefix' ? parts.at(-1) : parts[0];
}

function stripOneOuterParenthesisPair(text) {
  const normalized = normalizeText(text);

  if (!normalized.startsWith('(') || !normalized.endsWith(')')) {
    return null;
  }

  let depth = 0;
  for (let index = 0; index < normalized.length; index += 1) {
    const char = normalized[index];

    if (char === '(') {
      depth += 1;
    } else if (char === ')') {
      depth -= 1;
      if (depth === 0 && index < normalized.length - 1) {
        return null;
      }
    }

    if (depth < 0) {
      return null;
    }
  }

  return depth === 0 ? normalizeText(normalized.slice(1, -1)) : null;
}

function reapplyOuterParentheses(result) {
  return {
    ...result,
    unparsedText: result.unparsedText ? `(${result.unparsedText})` : null,
  };
}

function formatStructuralRemainder(text) {
  const normalized = normalizeText(text);

  if (!normalized) {
    return null;
  }

  const relationOnlyText = normalizeText(text.replace(/[(),]/g, ' '));

  if (/^(?:and|or)(?:\s+(?:and|or))*$/i.test(relationOnlyText)) {
    return relationOnlyText.toLowerCase();
  }

  if (/^,+$/.test(normalized.replace(/\s+/g, ''))) {
    return ',';
  }

  if (/^[()\s]+$/.test(normalized) && normalized.includes('(') && normalized.includes(')')) {
    return '( )';
  }

  return null;
}

function getPlaceholderForNode(node) {
  if (node.node_type === NODE_TYPE.COURSE) {
    return '[COURSE]';
  }

  if (node.node_type === NODE_TYPE.STANDING) {
    return '[STANDING]';
  }

  return '[TEXT]';
}

function isSingleRecognizedPlaceholder(text) {
  return /^(?:\[COURSE\]|\[STANDING\])$/.test(text);
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

function buildUnparsedText(text, recognizedMatches) {
  let skeleton = text;

  for (const match of recognizedMatches) {
    skeleton = skeleton.replace(
      new RegExp(escapeRegExp(match.matchedText), 'i'),
      getPlaceholderForNode(match.node),
    );
  }

  const normalized = normalizeText(skeleton.replace(/\s*,\s*/g, ', '));
  return normalized === text ? null : normalized;
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

  const unwrappedText = stripOneOuterParenthesisPair(normalizedText);
  if (unwrappedText) {
    const innerResult = parsePrerequisiteText(unwrappedText);

    if (innerResult.parseStatus === PARSE_STATUS.PARSED) {
      return innerResult;
    }

    return reapplyOuterParentheses(innerResult);
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
    recognizedMatches,
  );

  if (recognizedMatches.length === 1 && (!unparsedText || isSingleRecognizedPlaceholder(unparsedText))) {
    return createResult(PARSE_STATUS.PARSED, null, nodes, []);
  }

  return createResult(
    PARSE_STATUS.PARTIAL,
    unparsedText,
    nodes,
    [],
  );
}
