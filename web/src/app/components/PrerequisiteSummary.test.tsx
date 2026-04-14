import assert from "node:assert/strict";
import test from "node:test";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";

import { PrerequisiteSummary } from "./PrerequisiteSummary";

function collapseWhitespace(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}

test("PrerequisiteSummary does not repeat raw prerequisite text when catalog text already shows it", () => {
  const markup = renderToStaticMarkup(
    <PrerequisiteSummary
      prerequisite={{
        summaryStatus: "partial",
        courseGroups: [["COMP SCI 367", "COMP SCI 400"]],
        escapeClauses: [],
        rawText:
          "(COMP SCI 367 or 400) and (COMP SCI 407, 536, 537, 545, 559, 564, 570, 679 or COMP SCI/E C E 552) or graduate/professional standing",
        unparsedText: null,
      }}
      enrollmentPrerequisites="(COMP SCI 367 or 400) and (COMP SCI 407, 536, 537, 545, 559, 564, 570, 679 or COMP SCI/E C E 552) or graduate/professional standing"
    />,
  );

  const normalizedMarkup = collapseWhitespace(markup);
  assert.match(normalizedMarkup, /graduate\/professional standing/i);
  assert.doesNotMatch(normalizedMarkup, /Catalog text/i);
  assert.match(normalizedMarkup, /Parsed with partial coverage\./i);
  assert.doesNotMatch(normalizedMarkup, /Parsed with partial coverage\. Raw prerequisite text:/i);
});

test("PrerequisiteSummary still shows raw prerequisite text when it adds information beyond catalog text", () => {
  const markup = renderToStaticMarkup(
    <PrerequisiteSummary
      prerequisite={{
        summaryStatus: "partial",
        courseGroups: [],
        escapeClauses: [],
        rawText: "Students must complete the placement interview and instructor consent process.",
        unparsedText: null,
      }}
      enrollmentPrerequisites="Instructor consent required."
    />,
  );

  const normalizedMarkup = collapseWhitespace(markup);
  assert.match(normalizedMarkup, /Parsed with partial coverage\. Raw prerequisite text:/i);
  assert.match(normalizedMarkup, /placement interview and instructor consent process/i);
});
