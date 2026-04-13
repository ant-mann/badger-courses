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

const LONG_SUBJECT_TOKEN_PATTERN = '(?!AND\\b|OR\\b)(?:[A-Z]{2,}(?:&[A-Z]{2,})*|[A-Z](?:&[A-Z]{1,})+)';
const SHORT_SUBJECT_TOKEN_PATTERN = '(?!AND\\b|OR\\b)[A-Z]';
const FOLLOWING_SUBJECT_TOKEN_PATTERN = `(?:${LONG_SUBJECT_TOKEN_PATTERN}|${SHORT_SUBJECT_TOKEN_PATTERN})`;
const SPACED_AMPERSAND_SUBJECT_PATTERN = `${SHORT_SUBJECT_TOKEN_PATTERN}(?:\\s+${SHORT_SUBJECT_TOKEN_PATTERN})*\\s+&\\s+${FOLLOWING_SUBJECT_TOKEN_PATTERN}(?:\\s+${FOLLOWING_SUBJECT_TOKEN_PATTERN})*`;
const MULTI_TOKEN_SUBJECT_PATTERN = `(?:${LONG_SUBJECT_TOKEN_PATTERN}(?:\\s+${FOLLOWING_SUBJECT_TOKEN_PATTERN})+|${SHORT_SUBJECT_TOKEN_PATTERN}(?:\\s+${SHORT_SUBJECT_TOKEN_PATTERN})+(?:\\s+${FOLLOWING_SUBJECT_TOKEN_PATTERN})*|${SPACED_AMPERSAND_SUBJECT_PATTERN})`;
const SUBJECT_PATTERN = `(?:${LONG_SUBJECT_TOKEN_PATTERN}|${MULTI_TOKEN_SUBJECT_PATTERN})`;
const MULTI_WORD_SUBJECT_PATTERN = MULTI_TOKEN_SUBJECT_PATTERN;
const COURSE_REFERENCE_PATTERN = new RegExp(`\\b(${SUBJECT_PATTERN})\\s+(\\d{3}[A-Z]?)\\b`, 'g');
const SHARED_NUMBER_SLASH_SUBJECT_PATTERN = new RegExp(`\\b((${SUBJECT_PATTERN})(?:\\/(${SUBJECT_PATTERN}))+?)\\s+(\\d{3}[A-Z]?)\\b`, 'g');
let nextNodeId = 1;

function createNode(node_type, normalized_value, raw_value = normalized_value) {
  return {
    id: `node-${nextNodeId++}`,
    node_type,
    normalized_value,
    raw_value,
  };
}

function createResult(parseStatus, unparsedText, nodes = [], edges = [], rootNodeId = null) {
  return {
    parseStatus,
    unparsedText,
    nodes,
    edges,
    rootNodeId,
  };
}

function normalizeText(text) {
  return text.replace(/\s+/g, ' ').trim();
}

function isPlausibleCourseSubject(subject) {
  const tokens = normalizeText(subject).split(' ');
  const disallowedProseTokens = new Set(['TO', 'OF', 'IN', 'OPEN', 'FRESHMEN', 'SOPHOMORES', 'JUNIORS', 'SENIORS', 'MEMBER', 'MEMBERS', 'GUEST', 'STUDENTS', 'INSTRUCTOR', 'CONSENT', 'DECLARED']);

  if (tokens.length <= 1) {
    return true;
  }

  return !tokens.some((token) => disallowedProseTokens.has(token));
}

function isSingleTokenCourseSubject(subject) {
  return normalizeText(subject).split(' ').length === 1;
}

function hasShadowedSlashSubjectOrdering(subjects) {
  for (let index = 0; index < subjects.length; index += 1) {
    for (let laterIndex = index + 1; laterIndex < subjects.length; laterIndex += 1) {
      const earlierSubject = subjects[index];
      const laterSubject = subjects[laterIndex];
      const earlierTokens = normalizeText(earlierSubject).split(' ');

      if (
        earlierSubject !== laterSubject
        && subjectTokensEndWith(earlierSubject, laterSubject)
        && earlierTokens.length <= normalizeText(laterSubject).split(' ').length + 1
      ) {
        return true;
      }
    }
  }

  return false;
}

function isInsideAttachedParentheticalNote(text, index) {
  const prefixText = text.slice(0, index);
  const openParenIndexes = [];

  for (let prefixIndex = 0; prefixIndex < prefixText.length; prefixIndex += 1) {
    if (prefixText[prefixIndex] === '(') {
      openParenIndexes.push(prefixIndex);
    } else if (prefixText[prefixIndex] === ')' && openParenIndexes.length > 0) {
      openParenIndexes.pop();
    }
  }

  if (openParenIndexes.length === 0) {
    return false;
  }

  const nearestOpenParenIndex = openParenIndexes.at(-1);
  const beforeOpenParenText = prefixText.slice(0, nearestOpenParenIndex);
  return !/(?:^|[,(])\s*$/.test(beforeOpenParenText) && !/\b(?:or|and)\s*$/i.test(beforeOpenParenText);
}

function isInsideConnectiveIntroducedParentheticalNote(text, index, matchLength) {
  const prefixText = text.slice(0, index);
  const openParenIndexes = [];

  for (let prefixIndex = 0; prefixIndex < prefixText.length; prefixIndex += 1) {
    if (prefixText[prefixIndex] === '(') {
      openParenIndexes.push(prefixIndex);
    } else if (prefixText[prefixIndex] === ')' && openParenIndexes.length > 0) {
      openParenIndexes.pop();
    }
  }

  if (openParenIndexes.length === 0) {
    return false;
  }

  const nearestOpenParenIndex = openParenIndexes.at(-1);
  const beforeOpenParenText = prefixText.slice(0, nearestOpenParenIndex);
  if (!/\b(?:or|and)\s*$/i.test(beforeOpenParenText)) {
    return false;
  }

  let depth = 1;
  let closeParenIndex = -1;
  for (let textIndex = nearestOpenParenIndex + 1; textIndex < text.length; textIndex += 1) {
    if (text[textIndex] === '(') {
      depth += 1;
    } else if (text[textIndex] === ')') {
      depth -= 1;
      if (depth === 0) {
        closeParenIndex = textIndex;
        break;
      }
    }
  }

  if (closeParenIndex < 0) {
    return false;
  }

  const trailingInnerText = text.slice(index + matchLength, closeParenIndex);
  const trimmedTrailingInnerText = trailingInnerText.trimStart();
  if (trimmedTrailingInnerText.length === 0) {
    return false;
  }

  if (/^(?:or|and)\s+equivalent\b/i.test(trimmedTrailingInnerText) || /^equivalent\b/i.test(trimmedTrailingInnerText)) {
    return true;
  }

  if (/^,/.test(trimmedTrailingInnerText)) {
    return !new RegExp(String.raw`^,\s*(?:(?:or|and)\s+)?(?:(${SUBJECT_PATTERN})\s+)?\d{3}[A-Z]?\b`, 'i').test(trimmedTrailingInnerText);
  }

  return false;
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

  if (depth !== 0) {
    return null;
  }

  return {
    normalizedInnerText: normalizeText(normalized.slice(1, -1)),
    rawInnerText: text.slice(text.indexOf('(') + 1, text.lastIndexOf(')')),
  };
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

function splitTopLevelBooleanExpression(text, sourceText, offsets) {
  const lowercaseText = text.toLowerCase();
  const parts = [];
  let depth = 0;
  let cursor = 0;
  let operator = null;
  let operatorRaw = null;

  for (let index = 0; index < text.length; index += 1) {
    if (text[index] === '(') {
      depth += 1;
      continue;
    }

    if (text[index] === ')') {
      depth -= 1;
      if (depth < 0) {
        return null;
      }
      continue;
    }

    if (depth !== 0) {
      continue;
    }

    let matchedOperator = null;
    if (lowercaseText.startsWith(' and ', index)) {
      matchedOperator = 'AND';
    } else if (lowercaseText.startsWith(' or ', index)) {
      matchedOperator = 'OR';
    }

    if (!matchedOperator) {
      continue;
    }

    const partLength = index - cursor;
    const partText = text.slice(cursor, index).trim();
    if (!partText) {
      return null;
    }

    parts.push({
      text: partText,
      rawText: getSourceSlice(sourceText, offsets, cursor, partLength).trim(),
    });

    if (operator && operator !== matchedOperator) {
      return null;
    }

    operator = matchedOperator;
    operatorRaw ??= getSourceSlice(sourceText, offsets, index + 1, matchedOperator.length);
    cursor = index + matchedOperator.length + 2;
    index = cursor - 1;
  }

  if (depth !== 0 || !operator) {
    return null;
  }

  const trailingText = text.slice(cursor).trim();
  if (!trailingText) {
    return null;
  }

  parts.push({
    text: trailingText,
    rawText: getSourceSlice(sourceText, offsets, cursor, text.length - cursor).trim(),
  });

  return {
    operator,
    operatorRaw,
    parts,
  };
}

function parseSimpleOrCourseClause(text, sourceText, offsets) {
  const uppercaseText = text.toUpperCase();
  const match = uppercaseText.match(new RegExp(`^(${SUBJECT_PATTERN})\\s+(\\d{3}[A-Z]?)\\s+OR\\s+((?:${SUBJECT_PATTERN})\\s+)?(\\d{3}[A-Z]?)$`));

  if (!match) {
    return null;
  }

  const leftSubject = normalizeText(match[1].toUpperCase());
  const leftNumber = match[2].toUpperCase();
  const rightSubject = normalizeText((match[3] ?? match[1]).toUpperCase());
  const rightNumber = match[4].toUpperCase();

  if (!isPlausibleCourseSubject(leftSubject) || !isPlausibleCourseSubject(rightSubject)) {
    return null;
  }

  const operatorMatch = match[0].match(/\s+(or)\s+/i);
  const operatorIndex = operatorMatch?.index ?? -1;
  const leftRawLength = operatorIndex;
  const leftRaw = getSourceSlice(sourceText, offsets, 0, leftRawLength);
  const operatorRawStart = operatorIndex + (operatorMatch?.[0].indexOf(operatorMatch[1]) ?? 0);
  const operatorRaw = getSourceSlice(sourceText, offsets, operatorRawStart, operatorMatch?.[1].length ?? 0);
  const rightRawText = match[3] ? `${match[3]}${match[4]}` : match[4];
  const rightRawStart = match[0].length - rightRawText.length;
  const rightRaw = getSourceSlice(sourceText, offsets, rightRawStart, rightRawText.length);

  return {
    left: `${leftSubject} ${leftNumber}`,
    right: `${rightSubject} ${rightNumber}`,
    leftRaw,
    operatorRaw,
    rightRaw,
  };
}

function extractGroupedSimpleOrCourseMatches(text, sourceText, offsets) {
  const matches = [];
  const groupedPattern = /\(([^()]+)\)/g;

  for (const groupedMatch of text.matchAll(groupedPattern)) {
    const groupedIndex = groupedMatch.index ?? -1;
    if (groupedIndex < 0) {
      continue;
    }

    const innerIndex = groupedIndex + 1;
    const innerText = groupedMatch[1];
    const innerSourceText = getSourceSlice(sourceText, offsets, innerIndex, innerText.length);
    const innerOffsets = buildNormalizedTextWithOffsets(innerSourceText);
    const simpleOrCourses = parseSimpleOrCourseClause(innerText, innerSourceText, innerOffsets);

    if (!simpleOrCourses) {
      continue;
    }

    const operatorMatch = innerText.match(/\s+(or)\s+/i);
    const operatorIndex = operatorMatch?.index ?? -1;
    if (operatorIndex < 0) {
      continue;
    }

    const rightRawText = simpleOrCourses.rightRaw;
    const rightIndex = innerText.length - normalizeText(rightRawText).length;

    matches.push({
      index: innerIndex,
      normalizedLength: operatorIndex,
      groupStart: innerIndex,
      groupEnd: innerIndex + innerText.length,
      matchedText: simpleOrCourses.leftRaw,
      node: createNode(NODE_TYPE.COURSE, simpleOrCourses.left, simpleOrCourses.leftRaw),
    });
    matches.push({
      index: innerIndex + rightIndex,
      normalizedLength: innerText.length - rightIndex,
      groupStart: innerIndex,
      groupEnd: innerIndex + innerText.length,
      matchedText: simpleOrCourses.rightRaw,
      node: createNode(NODE_TYPE.COURSE, simpleOrCourses.right, simpleOrCourses.rightRaw),
    });
  }

  return matches;
}

function extractStandingNodes(text, sourceText, offsets) {
  const matches = [];
  const standingPattern = /\bgraduate\/professional standing\b/gi;

  for (const standingMatch of text.matchAll(standingPattern)) {
    const matchedText = getSourceSlice(sourceText, offsets, standingMatch.index ?? -1, standingMatch[0].length);
    matches.push({
      index: standingMatch.index ?? -1,
      normalizedLength: standingMatch[0].length,
      matchedText,
      node: createNode(NODE_TYPE.STANDING, 'Graduate/professional standing', matchedText),
    });
  }

  return matches;
}

function extractSharedNumberSlashSubjectNodes(text, sourceText, offsets) {
  const matches = [];
  const singleTokenListTailPattern = new RegExp(`^\\s*(?:,\\s*(?:or\\s+|and\\s+)?|\\s+(?:or|and)\\s+)(?:(${SUBJECT_PATTERN})\\s+)?\\d{3}[A-Z]?\\b`, 'i');
  const singleTokenListLeadPattern = /\b\d{3}[A-Z]?\s*(?:,\s*(?:or\s+|and\s+)?|\s+(?:or|and)\s+)$/i;
  const parentheticalCourseAliasLeadPattern = new RegExp(`(?:${SUBJECT_PATTERN})\\s+\\d{3}[A-Z]?\\s*\\((?:${SUBJECT_PATTERN})\\s+\\d{3}[A-Z]?[^()]*(?:\\))\\s*(?:,\\s*(?:or\\s+|and\\s+)?|\\s+(?:or|and)\\s+)$`, 'i');
  const protectedSingleTokenSlashPrefixPattern = new RegExp(`(?:^|[^A-Z])${LONG_SUBJECT_TOKEN_PATTERN}\\s+[^,()]+/$`, 'i');

  for (const match of text.matchAll(SHARED_NUMBER_SLASH_SUBJECT_PATTERN)) {
    const matchIndex = match.index ?? -1;
    const leadingText = matchIndex > 0 ? text.slice(0, matchIndex) : '';
    if (/\/\s*$/.test(leadingText)) {
      continue;
    }

    if (isInsideAttachedParentheticalNote(text, matchIndex)) {
      continue;
    }

    if (isInsideConnectiveIntroducedParentheticalNote(text, matchIndex, match[0].length)) {
      continue;
    }

    const matchedText = getSourceSlice(sourceText, offsets, matchIndex, match[0].length);
    const trailingText = text.slice(matchIndex + match[0].length);
    if (/^\s*\//.test(trailingText)) {
      continue;
    }

    const slashSubjects = match[1].split('/').map((subject) => normalizeText(subject.toUpperCase()));
    const number = match[4].toUpperCase();

    if (!slashSubjects.every(isPlausibleCourseSubject)) {
      continue;
    }

    if (new Set(slashSubjects).size !== slashSubjects.length) {
      continue;
    }

    const allowsReversedShadowedFamily = hasShadowedSlashSubjectOrdering(slashSubjects)
      && startsAtTextOrGroupBoundary(leadingText);

    if (hasShadowedSlashSubjectOrdering(slashSubjects) && !allowsReversedShadowedFamily) {
      continue;
    }

    if (slashSubjects.every(isSingleTokenCourseSubject)) {
      if (protectedSingleTokenSlashPrefixPattern.test(leadingText)) {
        continue;
      }

      const isListConnected = singleTokenListLeadPattern.test(leadingText)
        || singleTokenListTailPattern.test(trailingText)
        || parentheticalCourseAliasLeadPattern.test(leadingText);
      if (!isListConnected) {
        continue;
      }
    }

    const subjectRawText = matchedText.slice(0, matchedText.length - match[4].length).trimEnd();
    const rawSubjects = subjectRawText.split('/');
    let subjectOffset = 0;

    for (let index = 0; index < slashSubjects.length; index += 1) {
      const rawSubject = rawSubjects[index];
      const normalizedLength = rawSubject.length + (index === slashSubjects.length - 1 ? 1 + match[4].length : 0);
      const rawValue = index === slashSubjects.length - 1 ? `${rawSubject} ${match[4]}` : rawSubject;

      matches.push({
        index: matchIndex + subjectOffset,
        normalizedLength,
        matchedText: rawValue,
        node: createNode(NODE_TYPE.COURSE, `${slashSubjects[index]} ${number}`, rawValue),
      });

      subjectOffset += rawSubject.length + 1;
    }
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

    if (matchIndex > 0 && /[A-Z]{1,2}\s+$/.test(leadingText)) {
      continue;
    }

    if (/\b(?:[A-Z][A-Z]+|[A-Z](?:\s+[A-Z])+)(?:\s+[A-Z]+)*\s+(?:and|or)\s*$/.test(leadingText)) {
      continue;
    }

    if (isInsideConnectiveIntroducedParentheticalNote(text, matchIndex, match[0].length)) {
      continue;
    }

    const matchedText = getSourceSlice(sourceText, offsets, matchIndex, match[0].length);
    const trailingText = text.slice(matchIndex + match[0].length);
    if (/^\s*\//.test(trailingText)) {
      continue;
    }

    const subject = normalizeText(match[1].toUpperCase());
    const number = match[2].toUpperCase();

    if (!isPlausibleCourseSubject(subject)) {
      continue;
    }

    matches.push({
      index: matchIndex,
      normalizedLength: match[0].length,
      matchedText,
      node: createNode(NODE_TYPE.COURSE, `${subject} ${number}`, matchedText),
    });
  }

  return matches;
}

function getCourseSubject(normalizedCourseValue) {
  const match = normalizedCourseValue.match(/^(.*)\s+(\d{3}[A-Z]?)$/);
  return match?.[1] ?? null;
}

function subjectTokensEndWith(candidateSubject, suffixSubject) {
  const candidateTokens = normalizeText(candidateSubject).split(' ');
  const suffixTokens = normalizeText(suffixSubject).split(' ');

  if (suffixTokens.length > candidateTokens.length) {
    return false;
  }

  return suffixTokens.every((token, index) => (
    candidateTokens[candidateTokens.length - suffixTokens.length + index] === token
  ));
}

function isDetachedCourseReference(text, matchIndex, matchLength) {
  const leadingText = matchIndex > 0 ? text.slice(0, matchIndex) : '';
  const trailingText = text.slice(matchIndex + matchLength);
  return !(/\/\s*$/.test(leadingText) || /^\s*\//.test(trailingText));
}

function getCurrentCommaSegmentText(text) {
  const segmentMatch = text.match(/(?:^|,\s*)([^,()]*)$/);
  return segmentMatch?.[1] ?? text;
}

function startsAtTrueClauseBoundary(text) {
  return text.length === 0 || /(?:^|[,(])\s*$/.test(text);
}

function startsAtTextOrGroupBoundary(text) {
  return text.length === 0 || (/\(\s*$/.test(text) && !/\b(?:or|and)\s*\(\s*$/i.test(text));
}

function getLocalExplicitCourseAnchorSubject(text) {
  const segmentText = normalizeText(getCurrentCommaSegmentText(text));
  const explicitCourseMatch = segmentText.match(new RegExp(`^(${SUBJECT_PATTERN})\\s+\\d{3}[A-Z]?(?:,\\s*[^,()]+)?$`));

  if (!explicitCourseMatch) {
    return null;
  }

  if (/\b(?:or|and)\b/i.test(segmentText)) {
    return null;
  }

  const matchedSubject = normalizeText(explicitCourseMatch[1].toUpperCase());
  return isPlausibleCourseSubject(matchedSubject) ? matchedSubject : null;
}

function startsWithExplicitCourseSubjectAnchor(text, subject) {
  const leadingCoursePattern = new RegExp(`^(?:\\s*,\\s*(?:or\\s+|and\\s+)?|\\s+(?:or|and)\\s+)(${SUBJECT_PATTERN})\\s+\\d{3}[A-Z]?\\b`, 'i');
  const match = text.match(leadingCoursePattern);

  if (!match) {
    return false;
  }

  const matchedSubject = normalizeText(match[1].toUpperCase());
  return matchedSubject === subject && isPlausibleCourseSubject(matchedSubject);
}

function startsWithAmbiguousSlashClause(text) {
  const leadingSlashClauseMatch = text.match(/^(?:\s*,\s*(?:or|and)\s+|\s+(?:or|and)\s+)([^,()]+?)\s+\d{3}[A-Z]?(?=\s*(?:,|$))/i);
  if (!leadingSlashClauseMatch) {
    return false;
  }

  const slashClauseText = leadingSlashClauseMatch[1];
  if (!slashClauseText.includes('/')) {
    return false;
  }

  const slashSubjects = slashClauseText
    .split('/')
    .map((subject) => normalizeText(subject.toUpperCase()));

  return hasShadowedSlashSubjectOrdering(slashSubjects) || slashSubjects.every(isSingleTokenCourseSubject);
}

function inferSharedSlashClauseSubject(prefixText, suffixText = '') {
  const trailingClauseMatch = prefixText.match(/(?:^|[,(]\s*)([^,()]+?)\s+(\d{3}[A-Z]?)\s*,\s*(?:(?:or|and)\s+)?$/i);
  if (!trailingClauseMatch) {
    return null;
  }

  const slashClauseText = trailingClauseMatch[1];
  if (!slashClauseText.includes('/')) {
    return null;
  }

  if (/\b(?:or|and)\b/i.test(slashClauseText)) {
    return null;
  }

  const slashSubjects = slashClauseText
    .split('/')
    .map((subject) => normalizeText(subject.toUpperCase()));

  if (!slashSubjects.every(isPlausibleCourseSubject)) {
    return null;
  }

  const finalSubject = slashSubjects.at(-1);
  if (!finalSubject || !isPlausibleCourseSubject(finalSubject)) {
    return null;
  }

  const allSlashSubjectsAreSingleToken = slashSubjects.every(isSingleTokenCourseSubject);
  const sharedSuffixSubject = allSlashSubjectsAreSingleToken
    ? finalSubject
    : slashSubjects.find((candidateSubject) => (
      slashSubjects.every((subject) => subjectTokensEndWith(subject, candidateSubject))
    ));

  const reversedShadowSuffixSubject = !allSlashSubjectsAreSingleToken && hasShadowedSlashSubjectOrdering(slashSubjects)
    ? finalSubject
    : null;

  const inferredSubject = reversedShadowSuffixSubject ?? sharedSuffixSubject;

  if (!inferredSubject || !isPlausibleCourseSubject(inferredSubject)) {
    return null;
  }

  const clauseStartIndex = prefixText.length - trailingClauseMatch[0].length;
  const beforeSlashClauseText = clauseStartIndex > 0 ? prefixText.slice(0, clauseStartIndex) : '';
  const hasExplicitAnchor = getLocalExplicitCourseAnchorSubject(beforeSlashClauseText) === inferredSubject
    || startsWithExplicitCourseSubjectAnchor(suffixText, inferredSubject);

  if (startsWithAmbiguousSlashClause(suffixText)) {
    return null;
  }

  if (!hasExplicitAnchor) {
    const isAtTrueClauseBoundary = startsAtTrueClauseBoundary(beforeSlashClauseText);
    const hasInlineSharedSuffixAnchor = !allSlashSubjectsAreSingleToken
      && (
        (!hasShadowedSlashSubjectOrdering(slashSubjects) && slashSubjects.some((subject) => subject === inferredSubject))
        || (hasShadowedSlashSubjectOrdering(slashSubjects) && isAtTrueClauseBoundary)
      );

    if (!hasInlineSharedSuffixAnchor) {
      return null;
    }
  }

  return inferredSubject;
}

function overlapsRecognizedMatch(candidateIndex, candidateLength, recognizedMatches) {
  return recognizedMatches.some((match) => (
    candidateIndex < match.index + match.normalizedLength
    && candidateIndex + candidateLength > match.index
  ));
}

function isSlashDerivedMatch(text, match) {
  return /\/\s*$/.test(text.slice(0, match.index)) || /^\s*\//.test(text.slice(match.index + match.normalizedLength));
}

function extractTrailingShorthandCourseNodes(text, sourceText, offsets, recognizedMatches) {
  const shorthandMatches = [];
  const numberPattern = /\b(\d{3}[A-Z]?)\b/g;
  const sortedMatches = [...recognizedMatches].sort((left, right) => left.index - right.index);

  for (const numberMatch of text.matchAll(numberPattern)) {
    const matchIndex = numberMatch.index ?? -1;
    if (matchIndex < 0 || overlapsRecognizedMatch(matchIndex, numberMatch[0].length, [...sortedMatches, ...shorthandMatches])) {
      continue;
    }

    const priorMatches = [...sortedMatches, ...shorthandMatches]
      .sort((left, right) => left.index - right.index);
    const previousCourseMatch = priorMatches
      .filter((match) => match.node.node_type === NODE_TYPE.COURSE && match.index + match.normalizedLength <= matchIndex)
      .at(-1);

    let subject = null;
    if (previousCourseMatch) {
      const separatorText = text.slice(previousCourseMatch.index + previousCourseMatch.normalizedLength, matchIndex);
      if (/^\s*,\s*(?:(?:or|and)\s+)?$/i.test(separatorText)) {
        const previousCourseSubject = getCourseSubject(previousCourseMatch.node.normalized_value);
        const previousCourseIsSlashDerived = isSlashDerivedMatch(text, previousCourseMatch);

        if (!previousCourseIsSlashDerived) {
          subject = previousCourseSubject;
        }
      }
    }

    if (!subject) {
      subject = inferSharedSlashClauseSubject(text.slice(0, matchIndex), text.slice(matchIndex + numberMatch[0].length));
    }

    if (!subject || !isPlausibleCourseSubject(subject)) {
      continue;
    }

    const matchedText = getSourceSlice(sourceText, offsets, matchIndex, numberMatch[0].length);
    shorthandMatches.push({
      index: matchIndex,
      normalizedLength: numberMatch[0].length,
      matchedText,
      node: createNode(NODE_TYPE.COURSE, `${subject} ${numberMatch[1].toUpperCase()}`, matchedText),
    });
  }

  return shorthandMatches;
}

function buildUnparsedText(text, recognizedMatches) {
  let skeleton = '';
  let cursor = 0;

  for (const match of recognizedMatches) {
    skeleton += text.slice(cursor, match.index);
    skeleton += getPlaceholderForNode(match.node);
    cursor = match.index + match.normalizedLength;
  }

  skeleton += text.slice(cursor);

  const normalized = normalizeText(skeleton.replace(/\s*,\s*/g, ', '));
  return normalized === text ? null : normalized;
}

function parseRecognizedPrerequisiteText(text) {
  const sourceText = text ?? '';
  const offsets = buildNormalizedTextWithOffsets(sourceText);
  const normalizedText = offsets.normalizedText;

  if (!normalizedText) {
    return createResult(PARSE_STATUS.UNPARSED, null);
  }

  if (/^consent of instructor$/i.test(normalizedText)) {
    return createResult(PARSE_STATUS.UNPARSED, normalizedText);
  }

  const unwrappedText = stripOneOuterParenthesisPair(sourceText);
  if (unwrappedText) {
    const innerResult = parsePrerequisiteTextInternal(unwrappedText.rawInnerText);

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
  const sharedNumberSlashMatches = extractSharedNumberSlashSubjectNodes(normalizedText, sourceText, offsets);
  const groupedSimpleOrMatches = extractGroupedSimpleOrCourseMatches(normalizedText, sourceText, offsets);
  const courseMatches = extractCourseNodes(normalizedText, sourceText, offsets)
    .filter((courseMatch) => !groupedSimpleOrMatches.some((groupedMatch) => (
      courseMatch.index >= groupedMatch.groupStart
      && courseMatch.index < groupedMatch.groupEnd
    )))
    .filter((courseMatch) => !sharedNumberSlashMatches.some((slashMatch) => (
      courseMatch.index >= slashMatch.index
      && courseMatch.index < slashMatch.index + slashMatch.normalizedLength
    )));
  const shorthandCourseMatches = extractTrailingShorthandCourseNodes(
    normalizedText,
    sourceText,
    offsets,
    [...standingMatches, ...sharedNumberSlashMatches, ...groupedSimpleOrMatches, ...courseMatches],
  );
  const recognizedMatches = [...standingMatches, ...sharedNumberSlashMatches, ...groupedSimpleOrMatches, ...courseMatches, ...shorthandCourseMatches]
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
    return createResult(PARSE_STATUS.PARSED, null, nodes, [], nodes[0].id);
  }

  return createResult(
    PARSE_STATUS.PARTIAL,
    unparsedText,
    nodes,
    [],
  );
}

function isSafeStructuredCourseLeaf(result) {
  if (!result || !result.nodes.every((node) => node.node_type === NODE_TYPE.COURSE)) {
    return false;
  }

  if (result.parseStatus === PARSE_STATUS.PARSED) {
    return true;
  }

  return /^\[COURSE\](?:\s*\/\s*\[COURSE\])*$/.test(result.unparsedText ?? '');
}

function isSingleLeafResult(result, nodeType) {
  return result?.rootNodeId
    && result.nodes.length === 1
    && result.nodes[0].id === result.rootNodeId
    && result.nodes[0].node_type === nodeType;
}

function isParsedCourseOnlyResult(result) {
  return result?.parseStatus === PARSE_STATUS.PARSED
    && result.nodes.every((node) => (
      node.node_type === NODE_TYPE.COURSE
      || node.node_type === NODE_TYPE.AND
      || node.node_type === NODE_TYPE.OR
    ));
}

function getCourseSubjectsFromResult(result) {
  return result.nodes
    .filter((node) => node.node_type === NODE_TYPE.COURSE)
    .map((node) => getCourseSubject(node.normalized_value))
    .filter(Boolean);
}

function isDirectSingleCourseLeaf(result) {
  return result.parseStatus === PARSE_STATUS.PARSED
    && !result.rootNodeId
    && result.nodes.length === 1
    && result.nodes[0].node_type === NODE_TYPE.COURSE;
}

function isDirectSlashCourseLeaf(result) {
  return !result.rootNodeId && /^\[COURSE\](?:\s*\/\s*\[COURSE\])+$/.test(result.unparsedText ?? '');
}

function isStructuredCourseRoot(result) {
  return Boolean(result?.rootNodeId)
    && result.nodes.every((node) => (
      node.node_type === NODE_TYPE.COURSE
      || node.node_type === NODE_TYPE.AND
      || node.node_type === NODE_TYPE.OR
    ));
}

function isParsedStructuredBooleanResult(result) {
  return result?.parseStatus === PARSE_STATUS.PARSED
    && Boolean(result?.rootNodeId)
    && result.nodes.some((node) => node.id === result.rootNodeId && (
      node.node_type === NODE_TYPE.AND || node.node_type === NODE_TYPE.OR
    ));
}

function isSpecificOpaqueStructuredLeaf(result) {
  return isSingleLeafResult(result, NODE_TYPE.CONSENT)
    || isSingleLeafResult(result, NODE_TYPE.CONCURRENT)
    || isSingleLeafResult(result, NODE_TYPE.STANDING);
}

function isParenthesizedOpaqueStructuredLeaf(result) {
  return isSingleLeafResult(result, NODE_TYPE.TEXT)
    && Boolean(stripOneOuterParenthesisPair(result.nodes[0].raw_value));
}

function isPlainOpaqueStructuredLeaf(result) {
  return isSingleLeafResult(result, NODE_TYPE.TEXT)
    && !Boolean(stripOneOuterParenthesisPair(result.nodes[0].raw_value));
}

function isProseLikeOpaqueTextLeaf(result) {
  if (!isPlainOpaqueStructuredLeaf(result)) {
    return false;
  }

  const normalizedValue = result.nodes[0].normalized_value ?? '';
  return /[a-z]/.test(normalizedValue) && normalizedValue.trim().split(/\s+/).length >= 2;
}

function isSimpleStructuredAnchorLeaf(result) {
  return result?.rootNodeId && (
    isSingleLeafResult(result, NODE_TYPE.COURSE)
    || isSingleLeafResult(result, NODE_TYPE.STANDING)
    || isSingleLeafResult(result, NODE_TYPE.CONSENT)
    || isSingleLeafResult(result, NODE_TYPE.CONCURRENT)
  );
}

function hasCourseBearingStructuredAnchor(result) {
  return isSingleLeafResult(result, NODE_TYPE.COURSE)
    || isDirectSlashCourseLeaf(result)
    || result?.nodes?.some((node) => node.node_type === NODE_TYPE.COURSE);
}

function isAttachableNonCourseStructuredSubtree(result) {
  return Boolean(result?.rootNodeId)
    && result.nodes.some((node) => node.id === result.rootNodeId && (
      node.node_type === NODE_TYPE.AND || node.node_type === NODE_TYPE.OR
    ))
    && !hasCourseBearingStructuredAnchor(result);
}

function isStructuredBooleanSubtree(result) {
  return Boolean(result?.rootNodeId)
    && result.nodes.some((node) => node.id === result.rootNodeId && (
      node.node_type === NODE_TYPE.AND || node.node_type === NODE_TYPE.OR
    ));
}

function hasPotentialCourseBearingSiblingPart(rawText) {
  const structuredChild = parseStructuredCourseExpression(rawText);
  if (structuredChild && hasCourseBearingStructuredAnchor(structuredChild)) {
    return true;
  }

  const recognizedChild = parseRecognizedPrerequisiteText(rawText);
  return isSafeStructuredCourseLeaf(recognizedChild) || isSingleLeafResult(recognizedChild, NODE_TYPE.STANDING);
}

function parseGroupedNonCourseStructuredSubtree(text) {
  const sourceText = text ?? '';
  const unwrappedText = stripOneOuterParenthesisPair(sourceText);
  if (!unwrappedText) {
    return null;
  }

  const innerOffsets = buildNormalizedTextWithOffsets(unwrappedText.rawInnerText);
  const splitExpression = splitTopLevelBooleanExpression(
    innerOffsets.normalizedText,
    unwrappedText.rawInnerText,
    innerOffsets,
  );
  if (!splitExpression) {
    return null;
  }

  const childResults = [];
  for (const part of splitExpression.parts) {
    const nestedGroupedChild = parseGroupedNonCourseStructuredSubtree(part.rawText);
    if (nestedGroupedChild) {
      childResults.push(nestedGroupedChild);
      continue;
    }

    const recognizedChild = parseRecognizedPrerequisiteText(part.rawText);
    if (
      isSingleLeafResult(recognizedChild, NODE_TYPE.STANDING)
      || isSingleLeafResult(recognizedChild, NODE_TYPE.CONSENT)
      || isSingleLeafResult(recognizedChild, NODE_TYPE.CONCURRENT)
    ) {
      childResults.push(recognizedChild);
      continue;
    }

    if (recognizedChild.parseStatus !== PARSE_STATUS.UNPARSED) {
      return null;
    }

    const opaqueLeaf = parseOpaqueStructuredLeaf(part.rawText);
    if (!opaqueLeaf || hasCourseBearingStructuredAnchor(opaqueLeaf)) {
      return null;
    }

    childResults.push(opaqueLeaf);
  }

  if (!childResults.every((result) => result.rootNodeId)) {
    return null;
  }

  const rootNode = createNode(NODE_TYPE[splitExpression.operator], splitExpression.operator, splitExpression.operatorRaw);
  const nodes = [rootNode];
  const edges = [];

  for (const childResult of childResults) {
    nodes.push(...childResult.nodes);
    edges.push(...childResult.edges);
    edges.push({ source: rootNode.id, target: childResult.rootNodeId });
  }

  return createResult(
    PARSE_STATUS.PARTIAL,
    getStructuredDisplayText(sourceText),
    nodes,
    edges,
    rootNode.id,
  );
}

function parseGroupedStructuredSubtree(text) {
  const sourceText = text ?? '';
  const unwrappedText = stripOneOuterParenthesisPair(sourceText);
  if (!unwrappedText) {
    return null;
  }

  const groupedResult = parseStructuredCourseExpression(unwrappedText.rawInnerText);
  if (!groupedResult?.rootNodeId) {
    return null;
  }

  return createResult(
    groupedResult.parseStatus,
    getStructuredDisplayText(sourceText),
    groupedResult.nodes,
    groupedResult.edges,
    groupedResult.rootNodeId,
  );
}

function canAttachStructuredExpression(splitExpression, childResults) {
  const allChildrenAttachable = splitExpression.operator === NODE_TYPE.OR
    ? childResults.every((result) => result.rootNodeId || isDirectSlashCourseLeaf(result))
    : childResults.every((result) => result.rootNodeId);

  if (!allChildrenAttachable) {
    return false;
  }

  if (!childResults.some(hasCourseBearingStructuredAnchor)) {
    return false;
  }

  if (childResults.some(isStructuredBooleanSubtree)) {
    return true;
  }

  if (childResults.some(isAttachableNonCourseStructuredSubtree)) {
    return true;
  }

  if (canFullyParseStructuredExpression(splitExpression, childResults)) {
    return true;
  }

  if (
    childResults.some(isParsedStructuredBooleanResult)
    || childResults.some(isSpecificOpaqueStructuredLeaf)
    || childResults.some(isParenthesizedOpaqueStructuredLeaf)
  ) {
    return true;
  }

  const plainOpaqueLeaves = childResults.filter(isProseLikeOpaqueTextLeaf);
  return splitExpression.parts.length === 2
    && plainOpaqueLeaves.length === 1
    && childResults.filter((result) => !isProseLikeOpaqueTextLeaf(result)).length === 1
    && childResults.filter((result) => !isProseLikeOpaqueTextLeaf(result)).every(isSimpleStructuredAnchorLeaf);
}

function canFullyParseStructuredExpression(splitExpression, childResults) {
  if (childResults.every(isStructuredCourseRoot)) {
    return true;
  }

  if (splitExpression.operator === NODE_TYPE.AND && childResults.every(isParsedCourseOnlyResult)) {
    return true;
  }

  if (splitExpression.operator === NODE_TYPE.OR && childResults.every(isDirectSlashCourseLeaf)) {
    return true;
  }

  if (!childResults.every(isDirectSingleCourseLeaf)) {
    return false;
  }

  if (splitExpression.operator === NODE_TYPE.OR) {
    return true;
  }

  const subjects = childResults
    .map((result) => getCourseSubject(result.nodes[0].normalized_value))
    .filter(Boolean);

  return subjects.length === childResults.length && new Set(subjects).size === 1;
}

function parseOpaqueStructuredLeaf(text) {
  const sourceText = text ?? '';
  const rawText = sourceText.trim();
  const normalizedText = normalizeText(text ?? '');
  if (!normalizedText) {
    return null;
  }

  let nodeType = NODE_TYPE.TEXT;
  let normalizedValue = normalizedText;

  if (/^consent of instructor$/i.test(normalizedText)) {
    nodeType = NODE_TYPE.CONSENT;
    normalizedValue = 'Consent of instructor';
  } else if (/^concurrent enrollment$/i.test(normalizedText)) {
    nodeType = NODE_TYPE.CONCURRENT;
    normalizedValue = 'Concurrent enrollment';
  }

  const node = createNode(nodeType, normalizedValue, rawText);
  return createResult(PARSE_STATUS.PARTIAL, normalizedText, [node], [], node.id);
}

function getStructuredDisplayText(text) {
  const sourceText = text ?? '';
  const normalizedText = normalizeText(sourceText);

  if (!normalizedText) {
    return normalizedText;
  }

  const unwrappedText = stripOneOuterParenthesisPair(sourceText);
  if (unwrappedText) {
    return `(${getStructuredDisplayText(unwrappedText.rawInnerText)})`;
  }

  const offsets = buildNormalizedTextWithOffsets(sourceText);
  const simpleOrCourses = parseSimpleOrCourseClause(offsets.normalizedText, sourceText, offsets);
  if (simpleOrCourses) {
    return `[COURSE] ${simpleOrCourses.operatorRaw} [COURSE]`;
  }

  const splitExpression = splitTopLevelBooleanExpression(offsets.normalizedText, sourceText, offsets);
  if (splitExpression) {
    return splitExpression.parts
      .map((part) => getStructuredDisplayText(part.rawText))
      .join(` ${splitExpression.operatorRaw} `);
  }

  const recognizedResult = parseRecognizedPrerequisiteText(sourceText);
  if (recognizedResult.unparsedText) {
    return recognizedResult.unparsedText;
  }

  if (isSingleLeafResult(recognizedResult, NODE_TYPE.COURSE)) {
    return '[COURSE]';
  }

  if (isSingleLeafResult(recognizedResult, NODE_TYPE.STANDING)) {
    return '[STANDING]';
  }

  return normalizedText;
}

function parseStructuredCourseExpression(text) {
  const sourceText = text ?? '';
  const offsets = buildNormalizedTextWithOffsets(sourceText);
  const normalizedText = offsets.normalizedText;

  if (!normalizedText) {
    return null;
  }

  const unwrappedText = stripOneOuterParenthesisPair(sourceText);
  if (unwrappedText) {
    return parseStructuredCourseExpression(unwrappedText.rawInnerText);
  }

  const simpleOrCourses = parseSimpleOrCourseClause(normalizedText, sourceText, offsets);

  if (simpleOrCourses) {
    const orNode = createNode(NODE_TYPE.OR, 'OR', simpleOrCourses.operatorRaw);
    const leftCourse = createNode(NODE_TYPE.COURSE, simpleOrCourses.left, simpleOrCourses.leftRaw);
    const rightCourse = createNode(NODE_TYPE.COURSE, simpleOrCourses.right, simpleOrCourses.rightRaw);

    return createResult(PARSE_STATUS.PARSED, null, [orNode, leftCourse, rightCourse], [
      { source: orNode.id, target: leftCourse.id },
      { source: orNode.id, target: rightCourse.id },
    ], orNode.id);
  }

  const splitExpression = splitTopLevelBooleanExpression(normalizedText, sourceText, offsets);
  if (!splitExpression) {
    return null;
  }

  const childResults = [];
  for (const part of splitExpression.parts) {
    const structuredChild = parseStructuredCourseExpression(part.rawText);
    if (structuredChild) {
      childResults.push(structuredChild);
      continue;
    }

    childResults.push(null);
  }

  const hasCourseBearingSibling = splitExpression.parts.some((part, index) => (
    childResults[index]
      ? hasCourseBearingStructuredAnchor(childResults[index])
      : hasPotentialCourseBearingSiblingPart(part.rawText)
  ));

  for (let index = 0; index < splitExpression.parts.length; index++) {
    if (childResults[index]) {
      continue;
    }

    const part = splitExpression.parts[index];
    if (hasCourseBearingSibling) {
      const groupedStructuredChild = parseGroupedStructuredSubtree(part.rawText);
      if (groupedStructuredChild) {
        childResults[index] = groupedStructuredChild;
        continue;
      }

      const groupedNonCourseStructuredChild = parseGroupedNonCourseStructuredSubtree(part.rawText);
      if (groupedNonCourseStructuredChild) {
        childResults[index] = groupedNonCourseStructuredChild;
        continue;
      }
    }

    const recognizedChild = parseRecognizedPrerequisiteText(part.rawText);
    if (
      isSafeStructuredCourseLeaf(recognizedChild)
      || isSingleLeafResult(recognizedChild, NODE_TYPE.STANDING)
    ) {
      childResults[index] = recognizedChild;
      continue;
    }

    if (recognizedChild.parseStatus !== PARSE_STATUS.UNPARSED) {
      return null;
    }

    childResults[index] = parseOpaqueStructuredLeaf(part.rawText);
  }

  if (!canAttachStructuredExpression(splitExpression, childResults)) {
    return null;
  }

  const rootNode = createNode(NODE_TYPE[splitExpression.operator], splitExpression.operator, splitExpression.operatorRaw);
  const nodes = [rootNode];
  const edges = [];

  for (const childResult of childResults) {
    nodes.push(...childResult.nodes);
    edges.push(...childResult.edges);

    const childTargetIds = childResult.rootNodeId
      ? [childResult.rootNodeId]
      : childResult.nodes.map((node) => node.id);

    for (const childTargetId of childTargetIds) {
      edges.push({ source: rootNode.id, target: childTargetId });
    }
  }

  const isParsedCourseOnly = canFullyParseStructuredExpression(splitExpression, childResults);
  const unparsedText = isParsedCourseOnly
    ? null
    : splitExpression.parts
      .map((part) => getStructuredDisplayText(part.rawText))
      .join(` ${splitExpression.operatorRaw} `);

  return createResult(
    isParsedCourseOnly ? PARSE_STATUS.PARSED : PARSE_STATUS.PARTIAL,
    unparsedText,
    nodes,
    edges,
    rootNode.id,
  );
}

function parsePrerequisiteTextInternal(text) {
  const sourceText = text ?? '';
  const normalizedText = normalizeText(sourceText);

  if (!normalizedText) {
    return createResult(PARSE_STATUS.UNPARSED, null);
  }

  if (/^consent of instructor$/i.test(normalizedText)) {
    return createResult(PARSE_STATUS.UNPARSED, normalizedText);
  }

  const unwrappedText = stripOneOuterParenthesisPair(sourceText);
  if (unwrappedText) {
    const innerResult = parsePrerequisiteTextInternal(unwrappedText.rawInnerText);

    if (innerResult.parseStatus === PARSE_STATUS.PARSED) {
      return innerResult;
    }

    return reapplyOuterParentheses(innerResult);
  }

  return parseStructuredCourseExpression(sourceText) ?? parseRecognizedPrerequisiteText(sourceText);
}

export function parsePrerequisiteText(text) {
  nextNodeId = 1;
  return parsePrerequisiteTextInternal(text);
}
