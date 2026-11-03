import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import { TOPIC_CLUSTERS, getCluster, getClusterPosts } from "@/lib/seo/clusters";
import { faqJsonLd, marketingMetadata } from "@/lib/seo";
import { MARKETING_SITE_URL } from "@/lib/site";
import { getSiteOrigin } from "@/lib/request-host";

export const dynamicParams = false;

export function generateStaticParams() {
  return TOPIC_CLUSTERS.map((c) => ({ cluster: c.slug }));
}

export async function generateMetadata({ params }: { params: Promise<{ cluster: string }> }): Promise<Metadata> {
  const { cluster: slug } = await params;
  const cluster = getCluster(slug);
  if (!cluster) return {};
  const origin = await getSiteOrigin();
  return marketingMetadata({
    title: cluster.title,
    description: cluster.description,
    path: `/topics/${cluster.slug}`,
    origin,
  });
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric", timeZone: "UTC" });
}

export default async function TopicPillarPage({ params }: { params: Promise<{ cluster: string }> }) {
  const { cluster: slug } = await params;
  const cluster = getCluster(slug);
  if (!cluster) notFound();

  const origin = await getSiteOrigin();
  const posts = getClusterPosts(cluster.slug);
  const url = `${origin}/topics/${cluster.slug}`;

  const jsonLd = [
    {
      "@context": "https://schema.org",
      "@type": "CollectionPage",
      "@id": `${url}#page`,
      name: cluster.h1,
      description: cluster.description,
      url,
      isPartOf: { "@type": "WebSite", url: origin },
      publisher: { "@id": `${MARKETING_SITE_URL}/#organization` },
      mainEntity: {
        "@type": "ItemList",
        numberOfItems: posts.length,
        itemListElement: posts.map((p, i) => ({
          "@type": "ListItem",
          position: i + 1,
          url: `${origin}/blog/${p.slug}`,
          name: p.title,
        })),
      },
    },
    {
      "@context": "https://schema.org",
      "@type": "BreadcrumbList",
      itemListElement: [
        { name: "Home", item: origin },
        { name: "Topics", item: `${origin}/topics` },
        { name: cluster.name, item: url },
      ].map((b, i) => ({ "@type": "ListItem", position: i + 1, name: b.name, item: b.item })),
    },
    faqJsonLd(cluster.faq),
  ];

  return (
    <div className="flex min-h-full flex-col bg-[#09081b] text-white">
      <SiteHeader />
      {jsonLd.map((block, i) => (
        <script key={i} type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(block) }} />
      ))}
      <main id="main-content" className="flex-1">
        <section className="mx-auto w-full max-w-4xl px-6 py-14 sm:py-20">
          <nav aria-label="Breadcrumb" className="text-xs text-white/60">
            <Link href="/" className="hover:underline">Home</Link> /{" "}
            <Link href="/topics" className="hover:underline">Topics</Link> / {cluster.name}
          </nav>
          <h1 className="mt-5 text-balance text-4xl font-semibold leading-[1.1] lg:text-5xl">{cluster.h1}</h1>
          {cluster.intro.map((p) => (
            <p key={p} className="mt-5 text-lg leading-8 text-white/85">{p}</p>
          ))}
          <ul className="mt-8 flex flex-wrap gap-3">
            {cluster.pillarLinks.map((l) => (
              <li key={l.href}>
                <Link
                  href={l.href}
                  className="inline-flex rounded-full border border-white/25 bg-white/10 px-4 py-2 text-sm font-semibold hover:bg-white/20"
                >
                  {l.label}
                </Link>
              </li>
            ))}
          </ul>
        </section>

        <section className="bg-white py-14 text-slate-900">
          <div className="mx-auto w-full max-w-4xl px-6">
            <h2 className="text-2xl font-semibold">All {posts.length} guides in this topic</h2>
            <ul className="mt-6 space-y-4">
              {posts.map((post) => (
                <li key={post.slug} className="rounded-2xl border border-slate-200 p-5">
                  <Link href={`/blog/${post.slug}`} className="text-lg font-semibold text-violet-700 hover:underline">
                    {post.title}
                  </Link>
                  <p className="mt-1 text-sm text-slate-600">{post.description}</p>
                  <p className="mt-2 text-xs text-slate-500">{formatDate(post.date)} · {post.readingMinutes} min read</p>
                </li>
              ))}
            </ul>

            <h2 className="mt-14 text-2xl font-semibold">Frequently asked questions</h2>
            <dl className="mt-6 space-y-6">
              {cluster.faq.map((f) => (
                <div key={f.q}>
                  <dt className="font-semibold">{f.q}</dt>
                  <dd className="mt-1 text-slate-700">{f.a}</dd>
                </div>
              ))}
            </dl>

            <h2 className="mt-14 text-2xl font-semibold">Other topics</h2>
            <ul className="mt-4 flex flex-wrap gap-3">
              {TOPIC_CLUSTERS.filter((c) => c.slug !== cluster.slug).map((c) => (
                <li key={c.slug}>
                  <Link href={`/topics/${c.slug}`} className="inline-flex rounded-full border border-slate-300 px-4 py-2 text-sm font-semibold text-violet-700 hover:bg-violet-50">
                    {c.name}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        </section>
      </main>
      <SiteFooter />
    </div>
  );
}
