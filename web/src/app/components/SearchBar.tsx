"use client";

import { useEffect, useState, useTransition } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

type SearchBarProps = {
  initialQuery?: string;
};

export function SearchBar({ initialQuery = "" }: SearchBarProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [query, setQuery] = useState(initialQuery);
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    setQuery(searchParams.get("q") ?? "");
  }, [searchParams]);

  function updateQuery(nextQuery: string) {
    setQuery(nextQuery);

    startTransition(() => {
      const nextSearchParams = new URLSearchParams(searchParams.toString());
      const trimmed = nextQuery.trim();

      if (trimmed) {
        nextSearchParams.set("q", trimmed);
      } else {
        nextSearchParams.delete("q");
      }

      const nextUrl = nextSearchParams.toString();
      router.replace(nextUrl ? `${pathname}?${nextUrl}` : pathname, { scroll: false });
    });
  }

  return (
    <section className="flex flex-col gap-3 rounded-3xl border border-border bg-surface p-4 shadow-soft backdrop-blur sm:p-5">
      <label className="text-sm font-medium text-text-weak" htmlFor="course-search">
        Search courses
      </label>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <input
          id="course-search"
          name="q"
          type="search"
          value={query}
          onChange={(event) => updateQuery(event.target.value)}
          placeholder="COMP SCI 577"
          className="min-h-12 flex-1 rounded-2xl border border-border bg-transparent px-4 text-base outline-none transition focus:border-blue"
        />
        {isPending ? (
          <div className="min-w-24 text-sm text-text-faint">Loading...</div>
        ) : null}
      </div>
    </section>
  );
}
