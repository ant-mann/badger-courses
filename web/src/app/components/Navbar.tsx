import Link from "next/link";
import { NavLinks } from "./NavLinks";
import { ThemeToggle } from "./ThemeToggle";

export function Navbar() {
  return (
    <nav className="sticky top-0 z-50 border-b border-border bg-bg/90 backdrop-blur-sm">
      <div className="mx-auto flex h-14 max-w-screen-2xl items-center justify-between px-6 sm:px-10">
        <Link href="/" className="flex items-center gap-2">
          <span className="h-2 w-2 rounded-full bg-blue" />
          <span className="font-semibold text-navy">Badger Courses</span>
        </Link>
        <div className="flex items-center gap-1">
          <NavLinks />
          <ThemeToggle />
        </div>
      </div>
    </nav>
  );
}
