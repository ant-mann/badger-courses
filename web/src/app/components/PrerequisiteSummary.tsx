import React from "react";

import type { PrerequisiteSummary as PrerequisiteSummaryData } from "@/lib/course-data";

type PrerequisiteSummaryProps = {
  prerequisite: PrerequisiteSummaryData | null;
  enrollmentPrerequisites: string | null;
};

export function PrerequisiteSummary({
  prerequisite,
  enrollmentPrerequisites,
}: PrerequisiteSummaryProps) {
  const normalizedCatalogText = enrollmentPrerequisites?.replace(/\s+/g, " ").trim() ?? null;
  const normalizedRawText = prerequisite?.rawText?.replace(/\s+/g, " ").trim() ?? null;
  const shouldShowRawPrerequisiteText =
    prerequisite?.summaryStatus === "partial" &&
    normalizedRawText &&
    normalizedRawText !== normalizedCatalogText;

  if (!prerequisite && !enrollmentPrerequisites) {
    return (
      <div className="rounded-3xl border border-border bg-muted p-5 text-sm text-text-weak">
        No prerequisite information is available.
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4 rounded-3xl border border-border bg-surface p-5">
      {prerequisite?.courseGroups.length ? (
        <div className="flex flex-col gap-2">
          <p className="text-sm font-medium text-text-weak">Required course groups</p>
          <div className="flex flex-col gap-2">
            {prerequisite.courseGroups.map((group, index) => (
              <p key={`${group.join("-")}-${index}`} className="text-sm leading-7 text-text-weak">
                Group {index + 1}: {group.join(" or ")}
              </p>
            ))}
          </div>
        </div>
      ) : null}

      {prerequisite?.escapeClauses.length ? (
        <div className="flex flex-col gap-2">
          <p className="text-sm font-medium text-text-weak">Alternative ways to satisfy prerequisites</p>
          <div className="flex flex-col gap-2 text-sm leading-7 text-text-weak">
            {prerequisite.escapeClauses.map((clause) => (
              <p key={clause}>{clause}</p>
            ))}
          </div>
        </div>
      ) : null}

      {enrollmentPrerequisites ? (
        <div className="flex flex-col gap-2">
          <p className="text-sm leading-7 text-text-weak">{enrollmentPrerequisites}</p>
        </div>
      ) : null}

      {prerequisite?.summaryStatus === "partial" ? (
        <div className="rounded-2xl border border-amber-500/20 bg-amber-500/8 p-4 text-sm leading-7 text-amber-950 dark:text-amber-100">
          Parsed with partial coverage.
          {shouldShowRawPrerequisiteText ? <> Raw prerequisite text: {prerequisite.rawText}</> : null}
        </div>
      ) : null}
    </div>
  );
}
