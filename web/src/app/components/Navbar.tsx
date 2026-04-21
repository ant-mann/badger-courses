import Link from "next/link";
import { unstable_noStore as noStore } from "next/cache";
import { NavLinks } from "./NavLinks";
import { ThemeToggle } from "./ThemeToggle";
import { LastUpdatedLabel } from "./LastUpdatedLabel";
import { getLastRefreshedAt } from "@/lib/course-data";

export async function Navbar() {
  noStore();
  const lastRefreshedAt = await getLastRefreshedAt();

  return (
    <nav className="sticky top-0 z-50 border-b border-border bg-bg/90 backdrop-blur-sm">
      <div className="mx-auto flex max-w-screen-2xl flex-wrap items-center justify-between gap-x-4 gap-y-3 px-6 py-3 sm:flex-nowrap sm:px-10 sm:py-0">
        <Link href="/" className="flex items-center gap-2">
          <span className="h-2 w-2 rounded-full bg-blue" />
          <span className="font-semibold text-navy">Badger Courses</span>
        </Link>
        <div className="flex w-full items-center justify-between gap-2 sm:w-auto sm:justify-end sm:gap-1">
          <NavLinks />
          {lastRefreshedAt && <LastUpdatedLabel lastRefreshedAt={lastRefreshedAt.toISOString()} />}
          <ThemeToggle />
        </div>
      </div>
    </nav>
  );
}
