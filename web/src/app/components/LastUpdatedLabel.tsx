"use client";

import { useEffect, useState } from "react";
import { formatRelativeTime } from "@/lib/time";

type LastUpdatedLabelProps = {
  lastRefreshedAtIso: string;
};

function getRelativeUpdatedText(lastRefreshedAtIso: string): string {
  const lastRefreshedAt = new Date(lastRefreshedAtIso);
  if (Number.isNaN(lastRefreshedAt.getTime())) return "";
  return formatRelativeTime(lastRefreshedAt);
}

export function LastUpdatedLabel({ lastRefreshedAtIso }: LastUpdatedLabelProps) {
  const [mounted, setMounted] = useState(false);
  const [updatedText, setUpdatedText] = useState("");

  useEffect(() => {
    setMounted(true);
    const updateText = () => setUpdatedText(getRelativeUpdatedText(lastRefreshedAtIso));

    updateText();
    const intervalId = setInterval(updateText, 60_000);

    return () => clearInterval(intervalId);
  }, [lastRefreshedAtIso]);

  if (!mounted || !updatedText) return null;

  return <span className="hidden text-xs text-text-faint sm:block">{updatedText}</span>;
}
