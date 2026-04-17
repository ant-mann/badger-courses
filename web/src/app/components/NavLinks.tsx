"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const NAV_ITEMS = [
  { href: "/", label: "Schedule Builder" },
  { href: "/courses", label: "Course Explorer" },
];

export function isNavItemActive(href: string, pathname: string): boolean {
  if (href === "/") {
    return pathname === "/";
  }

  return pathname === href || pathname.startsWith(`${href}/`);
}

export function NavLinks() {
  const pathname = usePathname();

  return (
    <div className="flex flex-wrap items-center gap-1">
      {NAV_ITEMS.map(({ href, label }) => {
        const isActive = isNavItemActive(href, pathname);

        return (
          <Link
            key={href}
            href={href}
            aria-current={isActive ? "page" : undefined}
            className={`inline-flex min-h-11 items-center rounded-lg px-3 text-sm font-medium transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-blue focus-visible:outline-offset-2 ${
              isActive
                ? "bg-blue/10 text-blue"
                : "text-text-weak hover:text-navy"
            }`}
          >
            {label}
          </Link>
        );
      })}
    </div>
  );
}
