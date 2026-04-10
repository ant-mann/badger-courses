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

function buildNormalizedTextWithOffsets(sourceText) {
  let normalizedText = '';
  const sourceStarts = [];
  const sourceEnds = [];
  let index = 0;

  while (index < sourceText.length && /\s/.test(sourceText[index])) {
    index += 1;
  }

  while (index < sourceText.length) {
    const segmentStart = index;
    while (index < sourceText.length && !/\s/.test(sourceText[index])) {
      index += 1;
    }

    const segment = sourceText.slice(segmentStart, index);
    for (let segmentIndex = 0; segmentIndex < segment.length; segmentIndex += 1) {
      normalizedText += segment[segmentIndex];
      sourceStarts.push(segmentStart + segmentIndex);
      sourceEnds.push(segmentStart + segmentIndex + 1);
    }

    const whitespaceStart = index;
    while (index < sourceText.length && /\s/.test(sourceText[index])) {
      index += 1;
    }

    if (index < sourceText.length) {
      normalizedText += ' ';
      sourceStarts.push(whitespaceStart);
      sourceEnds.push(index);
    }
  }

  return { normalizedText, sourceStarts, sourceEnds };
}

function getSourceSlice(sourceText, offsets, normalizedIndex, normalizedLength) {
  const sourceStart = offsets.sourceStarts[normalizedIndex];
  const endOffsetIndex = normalizedIndex + normalizedLength - 1;
  const sourceEnd = offsets.sourceEnds[endOffsetIndex];
  return sourceText.slice(sourceStart, sourceEnd);
}

function escapeRegExp(text) {
  return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
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

function parseSimpleOrCourseClause(text, sourceText, offsets) {
  const match = text.match(/^([A-Z][A-Z]+(?:\s+[A-Z])*)\s+(\d{3}[A-Z]?)\s+or\s+((?:[A-Z][A-Z]+(?:\s+[A-Z])*)\s+)?(\d{3}[A-Z]?)$/i);

  if (!match) {
    return null;
  }

  const leftSubject = normalizeText(match[1].toUpperCase());
  const leftNumber = match[2].toUpperCase();
  const rightSubject = normalizeText((match[3] ?? match[1]).toUpperCase());
  const rightNumber = match[4].toUpperCase();
  const operatorMatch = match[0].match(/\s+(or)\s+/i);
  const operatorIndex = operatorMatch?.index ?? -1;
  const leftRawLength = operatorIndex;
  const leftRaw = getSourceSlice(sourceText, offsets, 0, leftRawLength);
  const operatorRawStart = operatorIndex + (operatorMatch?.[0].indexOf(operatorMatch[1]) ?? 0);
  const operatorRaw = getSourceSlice(sourceText, offsets, operatorRawStart, operatorMatch?.[1].length ?? 0);
  const rightRawStart = match[0].lastIndexOf(match[4]);
  const rightRaw = getSourceSlice(sourceText, offsets, rightRawStart, match[4].length);

  return {
    left: `${leftSubject} ${leftNumber}`,
    right: `${rightSubject} ${rightNumber}`,
    leftRaw,
    operatorRaw,
    rightRaw,
  };
}

function extractStandingNodes(text, sourceText, offsets) {
  const matches = [];
  const standingPattern = /\bgraduate\/professional standing\b/gi;

  for (const standingMatch of text.matchAll(standingPattern)) {
    const matchedText = getSourceSlice(sourceText, offsets, standingMatch.index ?? -1, standingMatch[0].length);
    matches.push({
      index: standingMatch.index ?? -1,
      matchedText,
      node: createNode(NODE_TYPE.STANDING, 'Graduate/professional standing', matchedText),
    });
  }

  return matches;
}

function extractCourseNodes(text, sourceText, offsets) {
  const matches = [];

  for (const match of text.matchAll(COURSE_REFERENCE_PATTERN)) {
    const matchIndex = match.index ?? -1;
    const leadingText = matchIndex > 0 ? text.slice(0, matchIndex) : '';
    if (/\/\s*$/.test(leadingText)) {
      continue;
    }

    if (matchIndex > 0 && /[A-Z]\s+$/.test(leadingText)) {
      continue;
    }

    const matchedText = getSourceSlice(sourceText, offsets, matchIndex, match[0].length);
    const trailingText = text.slice(matchIndex + match[0].length);
    if (/^\s*\//.test(trailingText)) {
      continue;
    }

    const subject = normalizeText(match[1].toUpperCase());
    const number = match[2].toUpperCase();

    matches.push({
      index: matchIndex,
      matchedText,
      node: createNode(NODE_TYPE.COURSE, `${subject} ${number}`, matchedText),
    });
  }

  return matches;
}

function buildUnparsedText(text, recognizedMatches) {
  let skeleton = '';
  let cursor = 0;

  for (const match of recognizedMatches) {
    skeleton += text.slice(cursor, match.index);
    skeleton += getPlaceholderForNode(match.node);
    cursor = match.index + match.matchedText.length;
  }

  skeleton += text.slice(cursor);

  const normalized = normalizeText(skeleton.replace(/\s*,\s*/g, ', '));
  return normalized === text ? null : normalized;
}

export function parsePrerequisiteText(text) {
  nextNodeId = 1;
  const sourceText = text ?? '';
  const offsets = buildNormalizedTextWithOffsets(sourceText);
  const normalizedText = offsets.normalizedText;

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

  const simpleOrCourses = parseSimpleOrCourseClause(normalizedText, sourceText, offsets);

  if (simpleOrCourses) {
    const orNode = createNode(NODE_TYPE.OR, 'OR', simpleOrCourses.operatorRaw);
    const leftCourse = createNode(NODE_TYPE.COURSE, simpleOrCourses.left, simpleOrCourses.leftRaw);
    const rightCourse = createNode(NODE_TYPE.COURSE, simpleOrCourses.right, simpleOrCourses.rightRaw);

    return createResult(PARSE_STATUS.PARSED, null, [orNode, leftCourse, rightCourse], [
      { source: orNode.id, target: leftCourse.id },
      { source: orNode.id, target: rightCourse.id },
    ]);
  }

  const standingMatches = extractStandingNodes(normalizedText, sourceText, offsets);
  const courseMatches = extractCourseNodes(normalizedText, sourceText, offsets);
  const recognizedMatches = [...standingMatches, ...courseMatches]
    .sort((left, right) => left.index - right.index);

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
