"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { FREE_SIGNUP_HREF } from "@/lib/checkout";

/**
 * Unified header nav (Cerebro | Features | Pricing | Teams | About | Blog | Free Tools | Log In | Start free).
 * ypnus.com and app.ypnus.com are the same Next.js app, so every item is an
 * internal route.
 */
const NAV: Array<{ href: string; label: string; internal?: boolean }> = [
  { href: "/cerebro", label: "Cerebro", internal: true },
  { href: "/features", label: "Features", internal: true },
  { href: "/pricing", label: "Pricing", internal: true },
  { href: "/teams", label: "Teams", internal: true },
  { href: "/about", label: "About", internal: true },
  { href: "/blog", label: "Blog", internal: true },
  { href: "/tools/equity", label: "Free Tools", internal: true },
];

/**
 * `variant="focused"` is for conversion landing pages (/claim-territory, /check-zip): logo,
 * sign-in and one call to action only, with no nav links competing with the page's form.
 */
export function SiteHeader({
  variant = "full",
  tone = "dark",
}: { variant?: "full" | "focused"; /** "light" is the homepage's white header; every other page keeps the dark one. */ tone?: "dark" | "light" } = {}) {
  const focused = variant === "focused";
  const light = tone === "light";
  const navLink = light
    ? "transition hover:text-slate-950 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-700"
    : "transition hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-300";
  const mobileLink = light
    ? "rounded-2xl px-4 py-3 transition hover:bg-slate-100 hover:text-slate-950 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-700"
    : "rounded-2xl px-4 py-3 transition hover:bg-white/10 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-300";
  const bar = light ? "bg-slate-900" : "bg-white";
  const [mobileOpen, setMobileOpen] = useState(false);
  const [hasSession, setHasSession] = useState(false);
  const signupHref = FREE_SIGNUP_HREF;
  const loginHref = "/login";

  useEffect(() => {
    let cancelled = false;
    // ypnus_session is host-only + httpOnly (docs/sso-handoff.md) — can't be read
    // client-side, so ask the app instead. Matches the shape /api/auth/session
    // actually returns: { ok: true, session: { email, role } | null }.
    fetch("/api/auth/session")
      .then((response) => response.json())
      .then((body: { session: { email: string; role: string } | null }) => {
        if (!cancelled) setHasSession(Boolean(body.session));
      })
      .catch(() => {
        if (!cancelled) setHasSession(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <header className={`sticky top-0 z-50 border-b backdrop-blur-md ${light ? "border-slate-200 bg-white/95" : "border-white/10 bg-[#09081b]/85"}`}>
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-2 focus:z-[60] focus:rounded-full focus:bg-amber-400 focus:px-4 focus:py-2 focus:text-sm focus:font-semibold focus:text-[#09081b]"
      >
        Skip to main content
      </a>
      <div className="mx-auto flex w-full max-w-6xl items-center justify-between gap-3 px-4 py-2.5 sm:gap-4 sm:px-6 sm:py-3">
        <Link href="/" className="flex min-w-0 items-center gap-2" onClick={() => setMobileOpen(false)}>
          <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-violet-500 to-violet-700 text-sm font-black text-white">
            Y
          </span>
          <span className={`text-sm font-semibold tracking-tight ${light ? "text-slate-900" : "text-white"}`}>
            YPN<span className={light ? "text-violet-700" : "text-violet-300"}> USA</span>
          </span>
        </Link>

        {focused ? null : (
        <nav aria-label="Main" className={`hidden items-center gap-5 text-sm font-medium xl:gap-7 lg:flex ${light ? "text-slate-700" : "text-white/80"}`}>
          {NAV.map((item) =>
            item.internal ? (
              <Link key={item.href} href={item.href} className={navLink}>
                {item.label}
              </Link>
            ) : (
              <a key={item.href} href={item.href} className={navLink}>
                {item.label}
              </a>
            ),
          )}
          {!hasSession ? (
            <Link href={loginHref} className={navLink}>
              Log In
            </Link>
          ) : null}
        </nav>
        )}

        <div className="flex items-center gap-2">
          {focused && !hasSession ? (
            <Link
              href={loginHref}
              className={`inline-flex min-h-[44px] items-center px-2 text-sm font-medium ${light ? "text-slate-700" : "text-white/80"} ${navLink}`}
            >
              Log In
            </Link>
          ) : null}
          {hasSession ? (
            <Link
              href="/dashboard"
              className="inline-flex min-h-[44px] items-center rounded-full bg-emerald-400 px-4 py-2 text-sm font-semibold text-[#09081b] shadow-lg shadow-emerald-500/20 transition duration-200 hover:-translate-y-0.5 hover:brightness-105 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-200"
            >
              Dashboard
            </Link>
          ) : focused ? null : (
            <a
              href={signupHref}
              className="inline-flex min-h-[44px] items-center whitespace-nowrap rounded-full bg-amber-400 px-4 py-2 text-sm font-bold text-[#09081b] shadow-lg shadow-amber-500/20 transition duration-200 hover:-translate-y-0.5 hover:brightness-105 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-200"
            >
              Start free
            </a>
          )}
          {focused ? null : (
          <button
            type="button"
            className={`inline-flex h-11 w-11 items-center justify-center rounded-full border transition focus-visible:outline-none focus-visible:ring-2 lg:hidden ${light ? "border-slate-300 bg-white text-slate-900 hover:bg-slate-100 focus-visible:ring-violet-700" : "border-white/15 bg-white/10 text-white hover:bg-white/15 focus-visible:ring-violet-300"}`}
            aria-label={mobileOpen ? "Close navigation menu" : "Open navigation menu"}
            aria-expanded={mobileOpen}
            aria-controls="mobile-navigation"
            onClick={() => setMobileOpen((open) => !open)}
          >
            <span className="sr-only">{mobileOpen ? "Close menu" : "Open menu"}</span>
            <span aria-hidden className="relative h-4 w-5">
              <span className={`absolute left-0 top-0 h-0.5 w-5 rounded-full ${bar} transition ${mobileOpen ? "translate-y-[7px] rotate-45" : ""}`} />
              <span className={`absolute left-0 top-[7px] h-0.5 w-5 rounded-full ${bar} transition ${mobileOpen ? "opacity-0" : ""}`} />
              <span className={`absolute left-0 top-[14px] h-0.5 w-5 rounded-full ${bar} transition ${mobileOpen ? "-translate-y-[7px] -rotate-45" : ""}`} />
            </span>
          </button>
          )}
        </div>
      </div>

      {focused ? null : (
      <div
        id="mobile-navigation"
        className={`lg:hidden ${mobileOpen ? "block" : "hidden"}`}
      >
        <nav aria-label="Main, mobile" className={`mx-4 mb-4 rounded-3xl border p-4 shadow-2xl ${light ? "border-slate-200 bg-white shadow-slate-900/15" : "border-white/10 bg-[#120f2a]/95 shadow-black/30"}`}>
          <div className={`grid gap-1 text-sm font-medium ${light ? "text-slate-800" : "text-white/80"}`}>
            {NAV.map((item) =>
              item.internal ? (
                <Link
                  key={item.href}
                  href={item.href}
                  className={mobileLink}
                  onClick={() => setMobileOpen(false)}
                >
                  {item.label}
                </Link>
              ) : (
                <a
                  key={item.href}
                  href={item.href}
                  className={mobileLink}
                  onClick={() => setMobileOpen(false)}
                >
                  {item.label}
                </a>
              ),
            )}
            {!hasSession ? (
              <Link
                href={loginHref}
                className={mobileLink}
                onClick={() => setMobileOpen(false)}
              >
                Log In
              </Link>
            ) : null}
          </div>
          {hasSession ? (
            <Link
              href="/dashboard"
              className="mt-3 flex items-center justify-center rounded-full bg-emerald-400 px-5 py-3 text-sm font-semibold text-[#09081b] shadow-lg shadow-emerald-500/20 transition hover:brightness-105 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-200"
              onClick={() => setMobileOpen(false)}
            >
              Go to dashboard
            </Link>
          ) : (
            <a
              href={signupHref}
              className="mt-3 flex items-center justify-center rounded-full bg-amber-400 px-5 py-3 text-sm font-semibold text-[#09081b] shadow-lg shadow-amber-500/20 transition hover:brightness-105 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-200"
              onClick={() => setMobileOpen(false)}
            >
              Start free
            </a>
          )}
        </nav>
      </div>
      )}
    </header>
  );
}
