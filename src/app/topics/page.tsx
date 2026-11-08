import type { Metadata } from "next";
import Link from "next/link";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import { TOPIC_CLUSTERS, getClusterPosts } from "@/lib/seo/clusters";
import { marketingMetadata } from "@/lib/seo";
import { MARKETING_SITE_URL } from "@/lib/site";

export async function generateMetadata(): Promise<Metadata> {
  const origin = MARKETING_SITE_URL;
  return marketingMetadata({
    title: "Loan Officer Growth Topics: Guides by Subject",
    description:
      "Browse loan officer guides by topic: exclusive leads, AI automation, realtor partnerships, local SEO, loan programs and marketing.",
    path: "/topics",
    origin,
  });
}

export default async function TopicsIndexPage() {
  const origin = MARKETING_SITE_URL;
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "CollectionPage",
    name: "Loan officer growth topics",
    url: `${origin}/topics`,
    hasPart: TOPIC_CLUSTERS.map((c) => ({
      "@type": "CollectionPage",
      name: c.h1,
      url: `${origin}/topics/${c.slug}`,
    })),
  };

  return (
    <div className="flex min-h-full flex-col bg-[#09081b] text-white">
      <SiteHeader />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      <main id="main-content" className="flex-1">
        <section className="mx-auto w-full max-w-4xl px-6 py-16 text-center sm:py-20">
          <h1 className="text-balance text-4xl font-semibold leading-[1.08] lg:text-5xl">
            Loan officer growth guides, organized by topic
          </h1>
          <p className="mx-auto mt-5 max-w-2xl text-lg text-white/85">
            Every guide belongs to one subject hub. Start with a hub for the full picture, then go deep on a single
            guide.
          </p>
        </section>
        <section className="bg-white py-16 text-slate-900">
          <div className="mx-auto grid w-full max-w-5xl gap-6 px-6 sm:grid-cols-2">
            {TOPIC_CLUSTERS.map((cluster) => (
              <Link
                key={cluster.slug}
                href={`/topics/${cluster.slug}`}
                className="block rounded-3xl border border-slate-200 p-6 shadow-sm transition hover:-translate-y-1 hover:shadow-md"
              >
                <p className="text-xs font-semibold uppercase tracking-wide text-violet-600">
                  {getClusterPosts(cluster.slug).length} guides
                </p>
                <h2 className="mt-2 text-xl font-semibold">{cluster.name}</h2>
                <p className="mt-3 text-sm leading-relaxed text-slate-600">{cluster.description}</p>
              </Link>
            ))}
          </div>
        </section>
      </main>
      <SiteFooter />
    </div>
  );
}
