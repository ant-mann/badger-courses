import { NODE_TYPE, PARSE_STATUS } from './prerequisite-helpers.mjs';

function stripOuterParentheses(text) {
  let candidate = text.trim();

  while (candidate.startsWith('(') && candidate.endsWith(')')) {
    let depth = 0;
    let wrapsEntireText = true;

    for (let index = 0; index < candidate.length; index += 1) {
      const char = candidate[index];

      if (char === '(') {
        depth += 1;
      } else if (char === ')') {
        depth -= 1;
        if (depth === 0 && index < candidate.length - 1) {
          wrapsEntireText = false;
          break;
        }
      }

      if (depth < 0) {
        wrapsEntireText = false;
        break;
      }
    }

    if (!wrapsEntireText || depth !== 0) {
      break;
    }

    candidate = candidate.slice(1, -1).trim();
  }

  return candidate;
}

function splitTopLevel(text, operator) {
  const parts = [];
  const lowerText = text.toLowerCase();
  const separator = operator.toLowerCase();
  let depth = 0;
  let cursor = 0;

  for (let index = 0; index < text.length; index += 1) {
    const char = text[index];

    if (char === '(') {
      depth += 1;
      continue;
    }

    if (char === ')') {
      depth -= 1;
      continue;
    }

    const startsSeparator = depth === 0 && lowerText.startsWith(separator, index);
    const beforeChar = index === 0 ? '' : lowerText[index - 1];
    const afterChar = lowerText[index + separator.length] ?? '';
    const hasWordBoundaryBefore = beforeChar === '' || /[\s()]/.test(beforeChar);
    const hasWordBoundaryAfter = afterChar === '' || /[\s()]/.test(afterChar);

    if (startsSeparator && hasWordBoundaryBefore && hasWordBoundaryAfter) {
      parts.push(text.slice(cursor, index).trim());
      cursor = index + separator.length;
      index = cursor - 1;
    }
  }

  parts.push(text.slice(cursor).trim());
  return parts.filter(Boolean);
}

function normalizeEscapeClauseText(text) {
  return text.trim().replace(/[\s,;:.]+$/g, '');
}

function looksCourseBearingClause(text) {
  const normalized = text.trim();
  return /\b[A-Z][A-Z/& ]+\s+\d{3}[A-Z]?\b/.test(normalized)
    || /^\d{3}[A-Z]?(?:\s*,\s*\d{3}[A-Z]?)*(?:\s*,?\s*(?:or|and)\s+\d{3}[A-Z]?)?$/.test(normalized);
}

function isCoursePlaceholderListClause(text) {
  return /^\[COURSE\](?:\/\[COURSE\])*(?:,\s*\[COURSE\](?:\/\[COURSE\])*)*(?:,\s*(?:or|and)\s*\[COURSE\](?:\/\[COURSE\])*|\s+(?:or|and)\s+\[COURSE\](?:\/\[COURSE\])*)?$/i.test(text);
}

function hasSingleUnresolvedSlashClause(text) {
  const normalized = text.trim();
  return /^[A-Z][A-Z/& ]*\/[A-Z][A-Z/& ]+\s+\d{3}[A-Z]?$/i.test(normalized);
}

function isAliasLikeParentheticalNote(text) {
  const normalized = text.trim();
  return /^\[COURSE\]\s+before\b/i.test(normalized)
    || /^\d{3}[A-Z]?\s+prior\s+to\b/i.test(normalized)
    || /\bequivalent\b/i.test(normalized);
}

function buildTreeIndex(parsedRule) {
  const nodesById = new Map(parsedRule.nodes.map((node) => [node.id, node]));
  const outgoingEdgesBySourceId = new Map();

  for (const edge of parsedRule.edges) {
    const edges = outgoingEdgesBySourceId.get(edge.source) ?? [];
    edges.push(edge);
    outgoingEdgesBySourceId.set(edge.source, edges);
  }

  const childrenBySourceId = new Map();
  for (const [sourceId, edges] of outgoingEdgesBySourceId.entries()) {
    childrenBySourceId.set(
      sourceId,
      edges
        .slice()
        .sort((leftEdge, rightEdge) => {
          const leftOrder = leftEdge.sort_order ?? Number.MAX_SAFE_INTEGER;
          const rightOrder = rightEdge.sort_order ?? Number.MAX_SAFE_INTEGER;
          return leftOrder - rightOrder;
        })
        .map((edge) => edge.target),
    );
  }

  return {
    nodesById,
    childrenBySourceId,
  };
}

function normalizePathReduction(reduction) {
  if (reduction.kind === 'option') {
    return {
      kind: 'path',
      courseGroups: [reduction.courses],
      escapeClauses: [],
      isPartial: false,
    };
  }

  return reduction;
}

function createEscapeReduction(clauses, operator) {
  const escapeClauses = clauses.filter(Boolean);
  if (escapeClauses.length === 0) {
    return { kind: 'opaque' };
  }

  if (escapeClauses.length === 1) {
    return {
      kind: 'escape',
      escapeClauses,
    };
  }

  return {
    kind: 'escape',
    escapeClauses: [normalizeEscapeClauseText(stripOuterParentheses(escapeClauses.join(` ${operator} `)))],
  };
}

function hasUnsafeCourseBearingResidue(parsedRule, treeSummary) {
  if (parsedRule.parseStatus !== PARSE_STATUS.PARTIAL || !parsedRule.unparsedText) {
    return false;
  }

  const normalizedText = parsedRule.unparsedText.replace(/\[COURSE\]/g, '').trim();
  if (!normalizedText) {
    return false;
  }

  const escapeClauseSet = new Set(treeSummary.escapeClauses.map((clause) => normalizeEscapeClauseText(clause).toLowerCase()));
  const residueClauses = splitTopLevel(normalizedText, 'or')
    .map((clause) => ({
      rawClause: stripOuterParentheses(clause).trim(),
      normalizedClause: normalizeEscapeClauseText(stripOuterParentheses(clause)),
    }))
    .filter(({ normalizedClause }) => Boolean(normalizedClause));

  return residueClauses.some(({ rawClause, normalizedClause }) => {
    if (escapeClauseSet.has(normalizedClause.toLowerCase())) {
      return false;
    }

    if (/^\d{3}[A-Z]?$/i.test(normalizedClause)) {
      return true;
    }

    return !/[,:;.]\s*$/.test(rawClause) && looksCourseBearingClause(normalizedClause);
  });
}

function summarizeTreeNode(nodeId, treeIndex) {
  const node = treeIndex.nodesById.get(nodeId);
  if (!node) {
    return { kind: 'opaque' };
  }

  if (node.node_type === NODE_TYPE.COURSE) {
    return {
      kind: 'option',
      courses: [node.normalized_value],
    };
  }

  if (![NODE_TYPE.AND, NODE_TYPE.OR].includes(node.node_type)) {
    const clause = normalizeEscapeClauseText(node.raw_value ?? node.normalized_value ?? '');
    if (!clause) {
      return { kind: 'opaque' };
    }

    if ([NODE_TYPE.STANDING, NODE_TYPE.CONCURRENT].includes(node.node_type)) {
      return {
        kind: 'escape',
        escapeClauses: [clause],
      };
    }

    if (node.node_type === NODE_TYPE.CONSENT || /\bapproval\b/i.test(clause)) {
      return {
        kind: 'opaqueNonCourseLeaf',
        text: clause,
      };
    }

    if (looksCourseBearingClause(clause) || /^\d{3}[A-Z]?$/i.test(clause)) {
      return { kind: 'opaqueCourseBearingLeaf' };
    }

    if (/\bmember of\b/i.test(clause) || /\d/.test(clause)) {
      return {
        kind: 'escape',
        escapeClauses: [clause],
      };
    }

    return {
      kind: 'opaqueNonCourseLeaf',
      text: clause,
    };
  }

  const childIds = treeIndex.childrenBySourceId.get(nodeId) ?? [];
  if (childIds.length === 0) {
    return { kind: 'opaque' };
  }

  const childReductions = childIds.map((childId) => summarizeTreeNode(childId, treeIndex));
  if (childReductions.some((reduction) => reduction.kind === 'opaque')) {
    return { kind: 'opaque' };
  }

  const operator = (node.raw_value ?? node.normalized_value ?? node.node_type).toLowerCase();

  if (node.node_type === NODE_TYPE.AND) {
    if (childReductions.every((reduction) => ['escape', 'opaqueNonCourseLeaf'].includes(reduction.kind))) {
      return createEscapeReduction(
        childReductions.flatMap((reduction) => reduction.kind === 'escape'
          ? reduction.escapeClauses
          : [reduction.text]),
        operator,
      );
    }

    if (childReductions.some((reduction) => reduction.kind === 'opaqueCourseBearingLeaf')) {
      return { kind: 'opaque' };
    }

    const pathChildren = childReductions
      .filter((reduction) => reduction.kind !== 'escape')
      .filter((reduction) => reduction.kind !== 'opaqueNonCourseLeaf')
      .map(normalizePathReduction);

    if (pathChildren.length === 0) {
      return { kind: 'opaque' };
    }

    if (pathChildren.some((reduction) => reduction.escapeClauses.length > 0)) {
      return { kind: 'opaque' };
    }

    return {
      kind: 'path',
      courseGroups: pathChildren.flatMap((reduction) => reduction.courseGroups),
      escapeClauses: [],
      isPartial: childReductions.some((reduction) => ['escape', 'opaqueNonCourseLeaf'].includes(reduction.kind))
        || pathChildren.some((reduction) => reduction.isPartial),
    };
  }

  if (childReductions.every((reduction) => reduction.kind === 'escape')) {
    return createEscapeReduction(
      childReductions.flatMap((reduction) => reduction.escapeClauses),
      operator,
    );
  }

  if (childReductions.every((reduction) => reduction.kind === 'option')) {
    return {
      kind: 'option',
      courses: childReductions.flatMap((reduction) => reduction.courses),
    };
  }

  if (childReductions.some((reduction) => reduction.kind === 'opaqueNonCourseLeaf')) {
    return { kind: 'opaque' };
  }

  if (childReductions.some((reduction) => reduction.kind === 'opaqueCourseBearingLeaf')) {
    return { kind: 'opaque' };
  }

  const pathChildren = childReductions
    .filter((reduction) => reduction.kind !== 'escape')
    .filter((reduction) => reduction.kind !== 'opaqueCourseBearingLeaf')
    .map(normalizePathReduction);

  if (pathChildren.length !== 1) {
    return { kind: 'opaque' };
  }

  return {
    kind: 'path',
    courseGroups: pathChildren[0].courseGroups,
    escapeClauses: [
      ...pathChildren[0].escapeClauses,
      ...childReductions.flatMap((reduction) => reduction.kind === 'escape' ? reduction.escapeClauses : []),
    ],
    isPartial: true,
  };
}

function summarizeTreeRoot(parsedRule) {
  if (!parsedRule.rootNodeId) {
    return null;
  }

  const reduction = normalizePathReduction(summarizeTreeNode(parsedRule.rootNodeId, buildTreeIndex(parsedRule)));
  if (reduction.kind === 'escape') {
    return {
      courseGroups: [],
      escapeClauses: reduction.escapeClauses,
      summaryStatus: 'partial',
    };
  }

  if (reduction.kind !== 'path' || reduction.courseGroups.length === 0) {
    return null;
  }

  const treeSummary = {
    courseGroups: reduction.courseGroups,
    escapeClauses: reduction.escapeClauses,
    summaryStatus: reduction.escapeClauses.length > 0 || reduction.isPartial ? 'partial' : 'structured',
  };

  if (hasUnsafeCourseBearingResidue(parsedRule, treeSummary)) {
    return null;
  }

  return treeSummary;
}

function summarizeParsedCourseGraph(parsedRule) {
  const courseNodes = parsedRule.nodes.filter((node) => node.node_type === NODE_TYPE.COURSE);

  if (courseNodes.length === 1 && parsedRule.edges.length === 0) {
    return [courseNodes.map((node) => node.normalized_value)];
  }

  const orNodes = parsedRule.nodes.filter((node) => node.node_type === NODE_TYPE.OR);
  if (orNodes.length !== 1 || courseNodes.length === 0 || parsedRule.edges.length !== courseNodes.length) {
    return null;
  }

  const rootId = orNodes[0].id;
  const childIds = new Set(courseNodes.map((node) => node.id));
  const isFlatOrGraph = parsedRule.edges.every((edge) => edge.source === rootId && childIds.has(edge.target));

  return isFlatOrGraph ? [courseNodes.map((node) => node.normalized_value)] : null;
}

function summarizeGroupedCoursePath(parsedRule) {
  if (parsedRule.parseStatus !== PARSE_STATUS.PARTIAL || !parsedRule.unparsedText) {
    return null;
  }

  const courseNodes = parsedRule.nodes.filter((node) => node.node_type === NODE_TYPE.COURSE);
  if (courseNodes.length === 0) {
    return null;
  }

  const topLevelOrClauses = splitTopLevel(parsedRule.unparsedText, 'or');
  const courseClauseIndex = topLevelOrClauses.findIndex((clause) => clause.includes('[COURSE]'));
  if (courseClauseIndex < 0) {
    return null;
  }

  const siblingClauses = topLevelOrClauses.filter((_, index) => index !== courseClauseIndex);
  if (siblingClauses.some((clause) => clause.includes('[COURSE]'))) {
    return null;
  }

  if (siblingClauses.some((clause) => {
    const strippedClause = stripOuterParentheses(clause);
    return splitTopLevel(strippedClause, 'and').length > 1 || splitTopLevel(strippedClause, 'or').length > 1;
  })) {
    return null;
  }

  const rawCourseClause = topLevelOrClauses[courseClauseIndex];
  const courseSkeleton = stripOuterParentheses(rawCourseClause);
  const groupClauses = splitTopLevel(courseSkeleton, 'and');
  const hasTopLevelOrGroup = splitTopLevel(courseSkeleton, 'or').length > 1;
  const hasExplicitGroupedPath = groupClauses.length > 1 && groupClauses.some((groupClause) => {
    const strippedGroupClause = stripOuterParentheses(groupClause);
    return strippedGroupClause !== groupClause || splitTopLevel(strippedGroupClause, 'or').length > 1;
  });
  const hasExplicitGrouping = hasTopLevelOrGroup || hasExplicitGroupedPath;
  if (!hasExplicitGrouping) {
    return null;
  }

  if (groupClauses.length === 0) {
    return null;
  }

  const courseGroups = [];
  let courseIndex = 0;

  for (const groupClause of groupClauses) {
    const strippedGroupClause = stripOuterParentheses(groupClause);
    const optionClauses = splitTopLevel(strippedGroupClause, 'or');
    if (optionClauses.length === 0) {
      return null;
    }

    if (optionClauses.length === 1 && !isCoursePlaceholderListClause(strippedGroupClause)) {
      return null;
    }

    const group = [];
    for (const optionClause of optionClauses) {
      const normalizedOptionClause = stripOuterParentheses(optionClause);
      if (splitTopLevel(normalizedOptionClause, 'and').length > 1 || splitTopLevel(normalizedOptionClause, 'or').length > 1) {
        return null;
      }

      const placeholderCount = (optionClause.match(/\[COURSE\]/g) ?? []).length;
      if (placeholderCount === 0) {
        return null;
      }

      const nextCourses = courseNodes.slice(courseIndex, courseIndex + placeholderCount);
      if (nextCourses.length !== placeholderCount) {
        return null;
      }

      group.push(...nextCourses.map((node) => node.normalized_value));
      courseIndex += placeholderCount;
    }

    courseGroups.push(group);
  }

  if (courseIndex !== courseNodes.length) {
    return null;
  }

  const standingNodes = parsedRule.nodes.filter((node) => node.node_type === NODE_TYPE.STANDING);
  let standingIndex = 0;
  const normalizedSiblingClauses = siblingClauses
    .map((clause) => clause.replace(/\[STANDING\]/g, () => {
      const replacement = standingNodes[standingIndex]?.raw_value ?? standingNodes[standingIndex]?.normalized_value ?? '[STANDING]';
      standingIndex += 1;
      return replacement;
    }).trim())
    .filter(Boolean);

  if (groupClauses.length > 1 && normalizedSiblingClauses.some((clause) => looksCourseBearingClause(clause))) {
    return null;
  }

  const escapeClauses = normalizedSiblingClauses
    .filter((clause) => !looksCourseBearingClause(clause))
    .map((clause) => normalizeEscapeClauseText(clause))
    .filter(Boolean);

  return {
    courseGroups,
    escapeClauses,
  };
}

function summarizeTrailingCourseList(parsedRule) {
  if (parsedRule.parseStatus !== PARSE_STATUS.PARTIAL || !parsedRule.unparsedText) {
    return null;
  }

  if (parsedRule.nodes.some((node) => ![NODE_TYPE.COURSE, NODE_TYPE.STANDING].includes(node.node_type))) {
    return null;
  }

  const courseNodes = parsedRule.nodes.filter((node) => node.node_type === NODE_TYPE.COURSE);
  const standingNodes = parsedRule.nodes.filter((node) => node.node_type === NODE_TYPE.STANDING);
  let unparsedCourseText = parsedRule.unparsedText;
  let escapeClauses = [];

  if (standingNodes.length > 0) {
    if (standingNodes.length !== 1) {
      return null;
    }

    const trailingStandingPattern = /(?:,\s*|\s+)or\s+\[STANDING\]$/i;
    const trailingStandingMatch = unparsedCourseText.match(trailingStandingPattern);
    if (!trailingStandingMatch) {
      return null;
    }

    unparsedCourseText = unparsedCourseText.slice(0, trailingStandingMatch.index).trim().replace(/,\s*$/, '');
    escapeClauses = [standingNodes[0].raw_value ?? standingNodes[0].normalized_value];
  }

  const courseListItemPattern = '\\[COURSE\\](?:\\/\\[COURSE\\])*';
  const singleCoursePattern = new RegExp(`^${courseListItemPattern}$`, 'i');
  const fullCourseListPattern = new RegExp(`^${courseListItemPattern}(?:,\\s*${courseListItemPattern})*(?:,\\s*(?:or|and)\\s*${courseListItemPattern}|\\s+(?:or|and)\\s+${courseListItemPattern})$`, 'i');
  if (singleCoursePattern.test(unparsedCourseText) || fullCourseListPattern.test(unparsedCourseText)) {
    return {
      courseGroups: [courseNodes.map((node) => node.normalized_value)],
      escapeClauses,
      summaryStatus: escapeClauses.length > 0 ? 'partial' : 'structured',
    };
  }

  const aliasedLeadingCoursePattern = new RegExp(`^(\\[COURSE\\]\\s*\\(([^)]*)\\))(?:,\\s*|\\s+)or\\s+(${courseListItemPattern})(?:,\\s*|\\s+)or\\s+(.+)$`, 'i');
  const aliasedLeadingCourseMatch = unparsedCourseText.match(aliasedLeadingCoursePattern);
  if (aliasedLeadingCourseMatch && isAliasLikeParentheticalNote(aliasedLeadingCourseMatch[2])) {
    const trailingEscapeClause = normalizeEscapeClauseText(aliasedLeadingCourseMatch[4]);
    if (trailingEscapeClause && !/\[(?:COURSE|STANDING)\]/.test(trailingEscapeClause) && !looksCourseBearingClause(trailingEscapeClause)) {
      const placeholderCount = (aliasedLeadingCourseMatch[3].match(/\[COURSE\]/g) ?? []).length;
      return {
        courseGroups: [
          [courseNodes[0]?.normalized_value].filter(Boolean),
          courseNodes.slice(-placeholderCount).map((node) => node.normalized_value),
        ].filter((group) => group.length > 0),
        escapeClauses: [...escapeClauses, trailingEscapeClause],
        summaryStatus: 'partial',
      };
    }
  }

  const parentheticalAliasEscapePattern = /^(\[COURSE\]\s*\(([^\[\]]+)\))(?:,\s*|\s+)or\s+(.+)$/i;
  const parentheticalAliasEscapeMatch = unparsedCourseText.match(parentheticalAliasEscapePattern);
  if (parentheticalAliasEscapeMatch && courseNodes.length > 0 && isAliasLikeParentheticalNote(parentheticalAliasEscapeMatch[2])) {
    const trailingEscapeClause = normalizeEscapeClauseText(parentheticalAliasEscapeMatch[3]);
    if (trailingEscapeClause && !/\[(?:COURSE|STANDING)\]/.test(trailingEscapeClause) && !looksCourseBearingClause(trailingEscapeClause)) {
      return {
        courseGroups: [[courseNodes[0].normalized_value]],
        escapeClauses: [...escapeClauses, trailingEscapeClause],
        summaryStatus: 'partial',
      };
    }
  }

  const trailingEscapeClausePattern = new RegExp(`^(${courseListItemPattern}(?:,\\s*${courseListItemPattern})*(?:,\\s*(?:or|and)\\s*${courseListItemPattern}|\\s+(?:or|and)\\s+${courseListItemPattern}))(?:,\\s*|\\s+)or\\s+(.+)$`, 'i');
  const trailingEscapeClauseMatch = unparsedCourseText.match(trailingEscapeClausePattern);
  if (trailingEscapeClauseMatch && fullCourseListPattern.test(trailingEscapeClauseMatch[1])) {
    const trailingEscapeClause = normalizeEscapeClauseText(trailingEscapeClauseMatch[2]);
    if (trailingEscapeClause && !/\[(?:COURSE|STANDING)\]/.test(trailingEscapeClause) && !looksCourseBearingClause(trailingEscapeClause)) {
      return {
        courseGroups: [courseNodes.map((node) => node.normalized_value)],
        escapeClauses: [...escapeClauses, trailingEscapeClause],
        summaryStatus: 'partial',
      };
    }
  }

  const trailingCourseListPattern = new RegExp(`(${courseListItemPattern}(?:,\\s*${courseListItemPattern})*(?:,\\s*(?:or|and)\\s*${courseListItemPattern}|\\s+(?:or|and)\\s+${courseListItemPattern}))$`, 'i');
  const trailingCourseListMatch = unparsedCourseText.match(trailingCourseListPattern);
  if (trailingCourseListMatch) {
    const leadingText = unparsedCourseText.slice(0, trailingCourseListMatch.index).trim();
    if (!/\[(?:COURSE|STANDING)\]/.test(leadingText)) {
      const placeholderCount = (trailingCourseListMatch[0].match(/\[COURSE\]/g) ?? []).length;
      return {
        courseGroups: [courseNodes.slice(-placeholderCount).map((node) => node.normalized_value)],
        escapeClauses,
        summaryStatus: leadingText || escapeClauses.length > 0 ? 'partial' : 'structured',
      };
    }

    const leadingCourseWithOptionalAliasMatch = leadingText.match(/^\[COURSE\](?:\s*\(([^\[\]]+)\))?,?$/i);
    if (leadingCourseWithOptionalAliasMatch && (!leadingCourseWithOptionalAliasMatch[1] || isAliasLikeParentheticalNote(leadingCourseWithOptionalAliasMatch[1]))) {
      const placeholderCount = (trailingCourseListMatch[0].match(/\[COURSE\]/g) ?? []).length;
      return {
        courseGroups: [
          [courseNodes[0].normalized_value],
          courseNodes.slice(-placeholderCount).map((node) => node.normalized_value),
        ],
        escapeClauses,
        summaryStatus: 'partial',
      };
    }
  }

  if (escapeClauses.length > 0) {
    const trailingCommaSeparatedCourseListPattern = new RegExp(`(${courseListItemPattern}(?:,\\s*${courseListItemPattern})+)$`, 'i');
    const trailingCommaSeparatedCourseListMatch = unparsedCourseText.match(trailingCommaSeparatedCourseListPattern);
    if (trailingCommaSeparatedCourseListMatch) {
      const leadingText = unparsedCourseText.slice(0, trailingCommaSeparatedCourseListMatch.index).trim();
      if (!/\[(?:COURSE|STANDING)\]/.test(leadingText) && /^[A-Z][A-Z/]+\s+\d{3}[A-Z]?,?$/i.test(leadingText)) {
        const placeholderCount = (trailingCommaSeparatedCourseListMatch[0].match(/\[COURSE\]/g) ?? []).length;
        return {
          courseGroups: [courseNodes.slice(-placeholderCount).map((node) => node.normalized_value)],
          escapeClauses,
          summaryStatus: 'partial',
        };
      }
    }
  }

  const interruptedCourseListPattern = new RegExp(`^${courseListItemPattern},\\s*.+?,\\s*${courseListItemPattern}(?:,\\s*${courseListItemPattern})*(?:,\\s*(?:or|and)\\s*${courseListItemPattern}|\\s+(?:or|and)\\s+${courseListItemPattern})$`, 'i');
  if (!interruptedCourseListPattern.test(unparsedCourseText)) {
    return null;
  }

  const interruptedMatch = unparsedCourseText.match(/^(\[COURSE\](?:\/\[COURSE\])*(?:,\s*\[COURSE\](?:\/\[COURSE\])*)*),\s*(.+?),\s*(\[COURSE\](?:\/\[COURSE\])*(?:,\s*\[COURSE\](?:\/\[COURSE\])*)*(?:,\s*(?:or|and)\s*\[COURSE\](?:\/\[COURSE\])*|\s+(?:or|and)\s+\[COURSE\](?:\/\[COURSE\])*))$/i);
  if (!interruptedMatch) {
    return null;
  }

  const leadingCourseClause = interruptedMatch[1];
  const unresolvedMiddleClause = interruptedMatch[2];
  const trailingCourseClause = interruptedMatch[3];

  if (!isCoursePlaceholderListClause(leadingCourseClause) || !isCoursePlaceholderListClause(trailingCourseClause)) {
    return null;
  }

  if (!hasSingleUnresolvedSlashClause(unresolvedMiddleClause)) {
    return null;
  }

  return {
    courseGroups: [courseNodes.map((node) => node.normalized_value)],
    escapeClauses,
    summaryStatus: 'partial',
  };
}

export function summarizePrerequisiteForAi(parsedRule, { rawText } = {}) {
  const summary = {
    summaryStatus: 'opaque',
    courseGroups: [],
    escapeClauses: [],
    rawText,
  };

  if (!parsedRule) {
    return summary;
  }

  if (parsedRule.rootNodeId) {
    const treeSummary = summarizeTreeRoot(parsedRule);
    if (treeSummary) {
      return {
        ...summary,
        summaryStatus: treeSummary.summaryStatus,
        courseGroups: treeSummary.courseGroups,
        escapeClauses: treeSummary.escapeClauses,
      };
    }

    return summary;
  }

  if (parsedRule.parseStatus === PARSE_STATUS.PARSED) {
    const courseGroups = summarizeParsedCourseGraph(parsedRule);
    if (courseGroups) {
      return {
        ...summary,
        summaryStatus: 'structured',
        courseGroups,
      };
    }

    return summary;
  }

  const groupedSummary = summarizeGroupedCoursePath(parsedRule);
  if (groupedSummary) {
    return {
      ...summary,
      summaryStatus: groupedSummary.escapeClauses.length > 0 ? 'partial' : 'structured',
      courseGroups: groupedSummary.courseGroups,
      escapeClauses: groupedSummary.escapeClauses,
    };
  }

  const trailingCourseListSummary = summarizeTrailingCourseList(parsedRule);
  if (!trailingCourseListSummary) {
    return summary;
  }

  return {
    ...summary,
    summaryStatus: trailingCourseListSummary.summaryStatus,
    courseGroups: trailingCourseListSummary.courseGroups,
    escapeClauses: trailingCourseListSummary.escapeClauses,
  };
}
