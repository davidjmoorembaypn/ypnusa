import type { Metadata } from "next";
import { SiloNav } from "@/components/silo-nav";
import Link from "next/link";
import { notFound } from "next/navigation";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import { ALL_BLOG_POSTS, getAnyBlogPost } from "@/content/blog-all";
import { Breadcrumbs } from "@/components/seo/breadcrumbs";
import { PostAuthorBox } from "@/components/seo/post-author-box";
import { FOUNDER_ID, ORGANIZATION_ID, faqJsonLd, jsonLdScript, pageTitle, socialImageFor } from "@/lib/seo";
import { homeTrail, topicTrail } from "@/lib/seo/breadcrumbs";
import { AUTHOR_NAME } from "@/lib/author";
import { MARKETING_SITE_URL } from "@/lib/site";
import { getPostCluster, getRelatedPosts, isThinPost } from "@/lib/seo/clusters";
import { prepareWpHtml } from "@/lib/wp-html";

export function generateStaticParams() {
  return ALL_BLOG_POSTS.map((post) => ({ slug: post.slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const post = getAnyBlogPost(slug);
  if (!post) return {};
  const origin = MARKETING_SITE_URL;
  const url = `${origin}/blog/${post.slug}`;
  const title = post.metaTitle ? { absolute: post.metaTitle } : pageTitle(post.title);
  if (isThinPost(post)) {
    return { title, robots: { index: false, follow: true }, alternates: { canonical: url } };
  }
  const image = socialImageFor(origin);
  const socialTitle = post.metaTitle ?? post.title;
  return {
    title,
    description: post.description,
    alternates: { canonical: url },
    openGraph: {
      type: "article",
      title: socialTitle,
      description: post.description,
      publishedTime: post.date,
      authors: [post.author],
      url,
      siteName: "YPN USA",
      images: [image],
    },
    twitter: { card: "summary_large_image", title: socialTitle, description: post.description, images: [image.url] },
  };
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

const PROSE = `space-y-6 text-[15px] leading-7 text-slate-700
  [&_h2]:mt-10 [&_h2]:text-2xl [&_h2]:font-semibold [&_h2]:tracking-tight [&_h2]:text-slate-900
  [&_h3]:mt-6 [&_h3]:text-lg [&_h3]:font-semibold [&_h3]:text-slate-900
  [&_p]:leading-7
  [&_ul]:list-disc [&_ul]:space-y-2 [&_ul]:pl-5
  [&_ol]:list-decimal [&_ol]:space-y-2 [&_ol]:pl-5
  [&_li]:leading-7
  [&_a]:text-violet-700 [&_a]:font-semibold [&_a]:underline [&_a:hover]:text-violet-900
  [&_strong]:font-semibold [&_strong]:text-slate-900
  [&_blockquote]:border-l-4 [&_blockquote]:border-violet-200 [&_blockquote]:bg-violet-50 [&_blockquote]:px-5 [&_blockquote]:py-3 [&_blockquote]:rounded-r-xl [&_blockquote]:italic
  [&_.btn-primary]:not-italic [&_.btn-primary]:mt-2 [&_.btn-primary]:inline-flex [&_.btn-primary]:rounded-full [&_.btn-primary]:bg-amber-400 [&_.btn-primary]:px-6 [&_.btn-primary]:py-3 [&_.btn-primary]:text-sm [&_.btn-primary]:font-semibold [&_.btn-primary]:text-[#09081b] [&_.btn-primary]:no-underline
  [&_figure]:my-8 [&_figure]:mx-0
  [&_img]:w-full [&_img]:h-auto [&_img]:rounded-2xl [&_img]:shadow-sm
  [&_figcaption]:mt-2 [&_figcaption]:text-center [&_figcaption]:text-xs [&_figcaption]:text-slate-500
  [&_table]:w-full [&_table]:my-8 [&_table]:border-collapse [&_table]:overflow-hidden [&_table]:rounded-xl [&_table]:border [&_table]:border-slate-200 [&_table]:text-sm
  [&_thead]:bg-slate-50
  [&_th]:border [&_th]:border-slate-200 [&_th]:px-4 [&_th]:py-2.5 [&_th]:text-left [&_th]:font-semibold [&_th]:text-slate-900
  [&_td]:border [&_td]:border-slate-200 [&_td]:px-4 [&_td]:py-2.5 [&_td]:align-top [&_td]:text-slate-700
  [&_[style]]:![font-size:inherit] [&_[style]]:![color:inherit] [&_[style]]:![background:transparent]`;

export default async function BlogPostPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const post = getAnyBlogPost(slug);
  if (!post) notFound();

  const origin = MARKETING_SITE_URL;
  const cluster = getPostCluster(post.slug);
  const related = getRelatedPosts(post.slug, 5);
  const byFounder = post.author === AUTHOR_NAME;
  // Home > Topics > Pillar > Post (the plan's trail); Home > Blog > Post when the post has no pillar.
  const crumbs = cluster
    ? topicTrail(cluster, post)
    : homeTrail({ name: "Blog", href: "/blog" }, { name: post.title, href: `/blog/${post.slug}` });
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "BlogPosting",
    ...(cluster ? { articleSection: cluster.name } : {}),
    headline: post.title,
    description: post.description,
    datePublished: post.date,
    dateModified: post.date,
    // The full Person node (with credentials) comes from the author box below.
    author: byFounder
      ? { "@type": "Person", "@id": FOUNDER_ID, name: post.author, url: `${MARKETING_SITE_URL}/about` }
      : { "@type": "Person", name: post.author },
    // Always the marketing-site entity id (see layout.tsx's @graph).
    publisher: { "@id": ORGANIZATION_ID },
    image: `${origin}/opengraph-image`,
    mainEntityOfPage: `${origin}/blog/${post.slug}`,
  };

  return (
    <div className="flex min-h-full flex-col bg-[#09081b] text-white">
      <SiteHeader />

      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLdScript(jsonLd) }} />
      {post.faq?.length ? (
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLdScript(faqJsonLd(post.faq)) }} />
      ) : null}

      <main id="main-content" className="flex-1 bg-white text-slate-900">
        <article className="mx-auto w-full max-w-3xl px-6 py-12 sm:py-16">
          <Breadcrumbs items={crumbs} tone="light" />
          <p className="mt-6 text-xs font-semibold uppercase tracking-wide text-violet-700">
            {formatDate(post.date)} · {post.readingMinutes} min read · {post.author}
          </p>
          <h1 className="mt-3 text-3xl font-semibold tracking-tight text-slate-900 sm:text-4xl">{post.title}</h1>
          {post.byline ? <p className="mt-3 text-sm text-slate-600">{post.byline}</p> : null}
          <div className={`mt-10 ${PROSE}`} dangerouslySetInnerHTML={{ __html: prepareWpHtml(post.html, true).html }} />
          {post.faq?.length ? (
            <section aria-labelledby="post-faq-heading" className="mt-12">
              <h2 id="post-faq-heading" className="text-2xl font-semibold tracking-tight text-slate-900">
                Frequently asked questions
              </h2>
              <dl className="mt-6 space-y-6 text-[15px] leading-7 text-slate-700">
                {post.faq.map((item) => (
                  <div key={item.q}>
                    <dt className="font-semibold text-slate-900">{item.q}</dt>
                    {item.html ? (
                      <dd
                        className="mt-1 [&_a]:font-semibold [&_a]:text-violet-700 [&_a]:underline"
                        dangerouslySetInnerHTML={{ __html: item.html }}
                      />
                    ) : (
                      <dd className="mt-1">{item.a}</dd>
                    )}
                  </div>
                ))}
              </dl>
            </section>
          ) : null}
          {post.closingHtml ? (
            <div
              className="mt-10 rounded-2xl border border-violet-200 bg-violet-50 p-5 text-[15px] text-slate-800 [&_a]:font-semibold [&_a]:text-violet-800 [&_a]:underline"
              dangerouslySetInnerHTML={{ __html: post.closingHtml }}
            />
          ) : null}
          {byFounder ? <PostAuthorBox /> : null}
        </article>
        {cluster ? (
          <aside aria-labelledby="related-heading" className="mx-auto w-full max-w-3xl px-6 pb-10">
            <h2 id="related-heading" className="text-xl font-semibold text-slate-900">
              More in{" "}
              <Link href={`/topics/${cluster.slug}`} className="text-violet-700 underline">
                {cluster.name}
              </Link>
            </h2>
            <ul className="mt-4 space-y-2">
              {related.map((r) => (
                <li key={r.slug}>
                  <Link href={`/blog/${r.slug}`} className="font-semibold text-violet-700 hover:underline">
                    {r.title}
                  </Link>
                </li>
              ))}
            </ul>
          </aside>
        ) : null}
        <div className="mx-auto w-full max-w-3xl px-6 pb-16">
          <SiloNav silo="growth" currentPath={`/blog/${post.slug}`} tone="light" />
        </div>
      </main>

      <SiteFooter />
    </div>
  );
}
