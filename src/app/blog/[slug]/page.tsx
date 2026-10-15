import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import { BLOG_POSTS, getBlogPost } from "@/content/blog";
import { BreadcrumbSchema } from "@/components/seo/breadcrumbs";
import { socialImageFor } from "@/lib/seo";
import { MARKETING_SITE_URL } from "@/lib/site";
import { getSiteOrigin } from "@/lib/request-host";

export function generateStaticParams() {
  return BLOG_POSTS.map((post) => ({ slug: post.slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const post = getBlogPost(slug);
  if (!post) return {};
  const origin = await getSiteOrigin();
  const url = `${origin}/blog/${post.slug}`;
  const image = socialImageFor(origin);
  return {
    title: post.title,
    description: post.description,
    alternates: { canonical: url },
    openGraph: {
      type: "article",
      title: post.title,
      description: post.description,
      publishedTime: post.date,
      authors: [post.author],
      url,
      siteName: "YPN USA",
      images: [image],
    },
    twitter: { card: "summary_large_image", title: post.title, description: post.description, images: [image.url] },
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

export default async function BlogPostPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const post = getBlogPost(slug);
  if (!post) notFound();

  const origin = await getSiteOrigin();
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "BlogPosting",
    headline: post.title,
    description: post.description,
    datePublished: post.date,
    dateModified: post.date,
    author: { "@type": "Person", name: post.author },
    // Always the marketing-site entity id (see layout.tsx's @graph) — the canonical
    // Organization node regardless of which host served this page.
    publisher: { "@id": `${MARKETING_SITE_URL}/#organization` },
    image: `${origin}/opengraph-image`,
    mainEntityOfPage: `${origin}/blog/${post.slug}`,
  };

  return (
    <div className="flex min-h-full flex-col bg-[#09081b] text-white">
      <SiteHeader />

      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      <BreadcrumbSchema
        items={[
          { name: "Home", href: "/" },
          { name: "Blog", href: "/blog" },
          { name: post.title, href: `/blog/${post.slug}` },
        ]}
      />

      <main id="main-content" className="flex-1 bg-white text-slate-900">
        <article className="mx-auto w-full max-w-3xl px-6 py-16 sm:py-20">
          <Link href="/blog" className="text-sm font-semibold text-violet-700 hover:underline">
            ← Back to the blog
          </Link>
          <p className="mt-6 text-xs font-semibold uppercase tracking-wide text-violet-600">
            {formatDate(post.date)} · {post.readingMinutes} min read · {post.author}
          </p>
          <h1 className="mt-3 text-3xl font-semibold tracking-tight text-slate-900 sm:text-4xl">{post.title}</h1>
          <div
            className="mt-10 space-y-6 text-[15px] leading-7 text-slate-700
              [&_h2]:mt-10 [&_h2]:text-2xl [&_h2]:font-semibold [&_h2]:tracking-tight [&_h2]:text-slate-900
              [&_h3]:mt-6 [&_h3]:text-lg [&_h3]:font-semibold [&_h3]:text-slate-900
              [&_p]:leading-7
              [&_ul]:list-disc [&_ul]:space-y-2 [&_ul]:pl-5
              [&_ol]:list-decimal [&_ol]:space-y-2 [&_ol]:pl-5
              [&_li]:leading-7
              [&_a]:text-violet-700 [&_a]:font-semibold [&_a]:underline [&_a:hover]:text-violet-900
              [&_strong]:font-semibold [&_strong]:text-slate-900
              [&_blockquote]:border-l-4 [&_blockquote]:border-violet-200 [&_blockquote]:bg-violet-50 [&_blockquote]:px-5 [&_blockquote]:py-3 [&_blockquote]:rounded-r-xl [&_blockquote]:italic
              [&_.btn-primary]:not-italic [&_.btn-primary]:mt-2 [&_.btn-primary]:inline-flex [&_.btn-primary]:rounded-full [&_.btn-primary]:bg-amber-400 [&_.btn-primary]:px-6 [&_.btn-primary]:py-3 [&_.btn-primary]:text-sm [&_.btn-primary]:font-semibold [&_.btn-primary]:text-[#09081b] [&_.btn-primary]:no-underline"
            dangerouslySetInnerHTML={{ __html: post.html }}
          />
        </article>
      </main>

      <SiteFooter />
    </div>
  );
}
