"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useId, useState } from "react";
import Logo from "@/components/ui/Logo";
import LogoutButton from "@/components/LogoutButton";
import CategoryIcon from "@/components/CategoryIcon";
import type { CategoryKey } from "@/types/categories";

export type HeaderCategory = {
  key: CategoryKey;
  slug: string;
  plural: string;
};

export type HeaderUser = {
  email: string;
  name: string | null;
  role: string;
} | null;

function navLinkClass(active: boolean) {
  return [
    "inline-flex items-center min-h-11 px-2 rounded-md text-sm cursor-pointer transition-colors duration-150",
    active
      ? "text-[var(--accent)] font-medium bg-[var(--accent)]/10"
      : "text-[var(--muted)] hover:text-[var(--foreground)] hover:bg-[var(--surface-hover)]",
  ].join(" ");
}

export default function SiteHeader({
  user,
  allowSignup,
  categories,
}: {
  user: HeaderUser;
  allowSignup: boolean;
  categories: HeaderCategory[];
}) {
  const pathname = usePathname() || "/";
  // Menu is open only for the path it was opened on — auto-closes on navigation.
  const [menuPath, setMenuPath] = useState<string | null>(null);
  const menuOpen = menuPath === pathname;
  const menuId = useId();

  useEffect(() => {
    if (!menuOpen) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setMenuPath(null);
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [menuOpen]);

  function isActive(href: string) {
    if (href === "/") return pathname === "/";
    return pathname === href || pathname.startsWith(`${href}/`);
  }

  function toggleMenu() {
    setMenuPath((p) => (p === pathname ? null : pathname));
  }

  function closeMenu() {
    setMenuPath(null);
  }

  const categoryLinks = user
    ? categories.map((c) => (
        <Link
          key={c.key}
          href={`/${c.slug}`}
          className={navLinkClass(isActive(`/${c.slug}`))}
          onClick={closeMenu}
        >
          <span className="inline-flex items-center gap-1.5">
            <CategoryIcon category={c.key} className="w-4 h-4 hidden xl:inline" />
            {c.plural}
          </span>
        </Link>
      ))
    : null;

  return (
    <header className="border-b border-[var(--border)] sticky top-0 z-40 bg-[var(--background)]/95 backdrop-blur-sm">
      <div className="mx-auto max-w-6xl px-4 py-3 flex items-center justify-between gap-3">
        <Logo />

        <nav
          className="hidden lg:flex items-center gap-1 text-sm flex-wrap justify-end"
          aria-label="Main"
        >
          {categoryLinks}
          {user?.role === "admin" && (
            <Link href="/admin" className={navLinkClass(isActive("/admin"))}>
              Admin
            </Link>
          )}
          {user ? (
            <>
              <Link href="/profile" className={navLinkClass(isActive("/profile"))}>
                Profile
              </Link>
              <span className="hidden xl:inline text-xs text-[var(--muted)] max-w-[10rem] truncate px-2">
                {user.name || user.email}
              </span>
              <LogoutButton />
            </>
          ) : (
            <>
              <Link href="/login" className={navLinkClass(isActive("/login"))}>
                Log in
              </Link>
              {allowSignup && (
                <Link
                  href="/signup"
                  className="inline-flex items-center min-h-11 rounded-md bg-[var(--accent)] px-3 py-1.5 text-sm font-medium text-[var(--background)] hover:bg-[var(--accent-hover)] cursor-pointer transition-colors duration-150"
                >
                  Sign up
                </Link>
              )}
            </>
          )}
        </nav>

        <button
          type="button"
          className="lg:hidden inline-flex items-center justify-center min-h-11 min-w-11 rounded-md border border-[var(--border)] text-[var(--foreground)] hover:bg-[var(--surface-hover)] cursor-pointer"
          aria-expanded={menuOpen}
          aria-controls={menuId}
          aria-label={menuOpen ? "Close menu" : "Open menu"}
          onClick={toggleMenu}
        >
          {menuOpen ? (
            <svg
              viewBox="0 0 24 24"
              className="w-5 h-5"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.5"
              aria-hidden
            >
              <path d="M6 6l12 12M18 6L6 18" strokeLinecap="round" />
            </svg>
          ) : (
            <svg
              viewBox="0 0 24 24"
              className="w-5 h-5"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.5"
              aria-hidden
            >
              <path d="M4 7h16M4 12h16M4 17h16" strokeLinecap="round" />
            </svg>
          )}
        </button>
      </div>

      {menuOpen && (
        <div
          id={menuId}
          className="lg:hidden border-t border-[var(--border)] bg-[var(--background)]"
        >
          <nav className="mx-auto max-w-6xl px-4 py-3 flex flex-col gap-1" aria-label="Mobile">
            {user &&
              categories.map((c) => (
                <Link
                  key={c.key}
                  href={`/${c.slug}`}
                  onClick={closeMenu}
                  className={`${navLinkClass(isActive(`/${c.slug}`))} w-full justify-start gap-2`}
                >
                  <CategoryIcon category={c.key} className="w-5 h-5 text-[var(--accent)]" />
                  {c.plural}
                </Link>
              ))}
            {user?.role === "admin" && (
              <Link
                href="/admin"
                onClick={closeMenu}
                className={`${navLinkClass(isActive("/admin"))} w-full justify-start`}
              >
                Admin
              </Link>
            )}
            {user ? (
              <>
                <Link
                  href="/profile"
                  onClick={closeMenu}
                  className={`${navLinkClass(isActive("/profile"))} w-full justify-start`}
                >
                  Profile
                </Link>
                <div className="px-2 py-2 text-xs text-[var(--muted)] truncate">
                  {user.name || user.email}
                </div>
                <div className="px-2 py-1">
                  <LogoutButton />
                </div>
              </>
            ) : (
              <>
                <Link
                  href="/login"
                  onClick={closeMenu}
                  className={`${navLinkClass(isActive("/login"))} w-full justify-start`}
                >
                  Log in
                </Link>
                {allowSignup && (
                  <Link
                    href="/signup"
                    onClick={closeMenu}
                    className="inline-flex items-center justify-center min-h-11 rounded-md bg-[var(--accent)] px-3 py-2 text-sm font-medium text-[var(--background)] hover:bg-[var(--accent-hover)] cursor-pointer"
                  >
                    Sign up
                  </Link>
                )}
              </>
            )}
          </nav>
        </div>
      )}
    </header>
  );
}
