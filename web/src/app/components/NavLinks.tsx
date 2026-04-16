"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const NAV_ITEMS = [
  { href: "/", label: "Course Explorer" },
  { href: "/schedule-builder", label: "Schedule Builder" },
];

export function isNavItemActive(href: string, pathname: string): boolean {
  if (href === "/") {
    return pathname === "/" || pathname.startsWith("/courses/");
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
            className={`rounded-lg px-3 py-1.5 text-sm font-medium leading-5 transition-colors ${
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
