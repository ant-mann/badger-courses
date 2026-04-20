"use client";

import React from "react";
import { formatRelativeTime } from "@/lib/time";

type LastUpdatedLabelProps = {
  lastRefreshedAt: string;
};

export function LastUpdatedLabel({ lastRefreshedAt }: LastUpdatedLabelProps) {
  const date = new Date(lastRefreshedAt);

  return (
    <time
      className="hidden text-xs text-text-faint sm:block"
      dateTime={lastRefreshedAt}
      suppressHydrationWarning
    >
      {formatRelativeTime(date)}
    </time>
  );
}
