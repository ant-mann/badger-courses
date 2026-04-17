"use client";

import { useEffect, useRef, useState, useTransition } from "react";
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
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    setQuery(searchParams.get("q") ?? "");
  }, [searchParams]);

  useEffect(() => {
    return () => {
      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
        debounceRef.current = null;
      }
    };
  }, []);

  function updateQuery(nextQuery: string) {
    setQuery(nextQuery);

    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
    }

    debounceRef.current = setTimeout(() => {
      debounceRef.current = null;
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
    }, 150);
  }

  return (
    <section className="flex flex-col gap-3 rounded-xl border border-border bg-surface p-4 shadow-soft backdrop-blur sm:p-5">
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
          placeholder="COMP SCI 220, MATH 340, etc."
          className="min-h-12 flex-1 rounded-lg border border-border bg-transparent px-4 text-base outline-none transition focus:border-blue focus-visible:border-blue"
        />
        <div role="status" aria-live="polite" className="min-w-24 text-sm text-text-faint">
          {isPending ? "Searching..." : ""}
        </div>
      </div>
    </section>
  );
}
