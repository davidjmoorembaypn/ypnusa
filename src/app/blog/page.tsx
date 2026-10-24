import type { Metadata } from "next";
import { SiloNav } from "@/components/silo-nav";
import Link from "next/link";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import { ALL_BLOG_POSTS } from "@/content/blog-all";
import { marketingMetadata } from "@/lib/seo";
import { getSiteOrigin } from "@/lib/request-host";

export async function generateMetadata(): Promise<Metadata> {
  const origin = await getSiteOrigin();
  return marketingMetadata({
    title: "Blog: Loan Officer Growth Guides",
    description:
      "Practical, no-fluff guidance for mortgage loan officers on building referral partnerships, growing a territory, and running a modern lending business.",
    path: "/blog",
    origin,
  });
}

function formatDate(iso: string) {
  // Date-only ISO strings (e.g. "2026-06-01") parse as UTC midnight — format in
  // UTC too, or a US timezone west of UTC displays the previous day.
  return new Date(iso).toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
    timeZone: "UTC",
  });
}

export default function BlogIndexPage() {
  const posts = [...ALL_BLOG_POSTS].sort((a, b) => (a.date < b.date ? 1 : -1));

  return (
    <div className="flex min-h-full flex-col bg-[#09081b] text-white">
      <SiteHeader />

      <main id="main-content" className="flex-1">
        <section className="relative isolate overflow-hidden">
          <div className="ypn-aurora pointer-events-none absolute inset-0" aria-hidden />
          <div className="relative z-10 mx-auto w-full max-w-4xl px-6 py-16 text-center sm:py-20">
            <span className="inline-flex rounded-full border border-white/25 bg-white/10 px-4 py-2 text-[11px] font-semibold uppercase tracking-[0.28em] text-violet-100">
              YPN USA Blog
            </span>
            <h1 className="mt-6 text-balance text-4xl font-semibold leading-[1.08] lg:text-5xl">
              Practical growth playbooks for loan officers
            </h1>
            <p className="mx-auto mt-5 max-w-2xl text-lg text-white/85">
              No fluff, no recycled listicles — just the systems that actually build a referral pipeline.
            </p>
          </div>
        </section>

        <section className="bg-white py-16 text-slate-900 sm:py-20">
          <div className="mx-auto w-full max-w-4xl px-6">
            <div className="space-y-6">
              {posts.map((post) => (
                <Link
                  key={post.slug}
                  href={`/blog/${post.slug}`}
                  className="block rounded-3xl border border-slate-200 bg-white p-6 shadow-sm transition duration-200 hover:-translate-y-1 hover:shadow-md md:p-8"
                >
                  <p className="text-xs font-semibold uppercase tracking-wide text-violet-600">
                    {formatDate(post.date)} · {post.readingMinutes} min read
                  </p>
                  <h2 className="mt-2 text-2xl font-semibold text-slate-900">{post.title}</h2>
                  <p className="mt-3 text-sm leading-relaxed text-slate-600">{post.description}</p>
                  <span className="mt-4 inline-flex text-sm font-semibold text-violet-700">Read the guide →</span>
                </Link>
              ))}
            </div>
          </div>
        </section>
        <div className="mx-auto w-full max-w-4xl px-6 pb-16">
          <SiloNav silo="growth" currentPath="/blog" tone="light" />
        </div>
      </main>

      <SiteFooter />
    </div>
  );
}
