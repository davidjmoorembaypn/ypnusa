import Link from "next/link";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import { BreadcrumbSchema } from "@/components/seo/breadcrumbs";
import type { WpImportedPage } from "@/content/wp-import";

/**
 * Renders a page migrated from ypnus.com's WordPress (see
 * src/content/wp-import/index.ts). Unlike native blog posts, these are
 * self-contained landing pages — each brings its own <style> block scoped to
 * a wrapper id/class — so they're dropped in as-is rather than wrapped in the
 * blog's prose styling, which would double-style them.
 */
export function WpImportedPageView({
  page,
  path,
  breadcrumbLabel,
}: {
  page: WpImportedPage;
  path: string;
  breadcrumbLabel: string;
}) {
  return (
    <div className="flex min-h-full flex-col bg-white text-slate-900">
      <SiteHeader />
      <BreadcrumbSchema
        items={[
          { name: "Home", href: "/" },
          { name: breadcrumbLabel, href: path },
          { name: page.title, href: path },
        ]}
      />
      <main id="main-content" className="flex-1">
        <div className="mx-auto w-full max-w-3xl px-6 pt-4">
          <Link href="/" className="text-sm font-semibold text-violet-700 hover:underline">
            ← Back home
          </Link>
        </div>
        <div dangerouslySetInnerHTML={{ __html: page.html }} />
      </main>
      <SiteFooter />
    </div>
  );
}
