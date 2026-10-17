import type { Metadata } from "next";
import { SiloNav } from "@/components/silo-nav";
import Link from "next/link";
import { MarketingToolForm } from "@/components/marketing-tool-form";
import { serializeJsonLd } from "@/lib/local-seo";
import { MARKETING_SITE_URL } from "@/lib/site";
import { getSiteOrigin } from "@/lib/request-host";

export async function generateMetadata(): Promise<Metadata> {
  const origin = await getSiteOrigin();
  return {
    title: "AI Social Media Marketing Writer for Mortgage & Real Estate",
    description:
      "Generate local social media post drafts, hooks, CTAs and campaign ideas for mortgage loan officers and real estate professionals.",
    alternates: { canonical: `${origin}/tools/social-writer` },
    robots: { index: true, follow: true },
  };
}

export default async function SocialWriterPage() {
  const origin = await getSiteOrigin();
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "WebApplication",
    "@id": `${origin}/tools/social-writer#app`,
    name: "YPN USA Social Media Marketing Writer",
    url: `${origin}/tools/social-writer`,
    applicationCategory: "BusinessApplication",
    operatingSystem: "Web",
    isPartOf: { "@id": `${MARKETING_SITE_URL}/#organization` },
    isAccessibleForFree: true,
    description:
      "Free tool that generates local social media post drafts, hooks, CTAs and campaign ideas for mortgage loan officers and real estate professionals.",
  };
 return <main className="min-h-screen ypn-aurora px-4 py-10 text-white sm:px-6">
  <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: serializeJsonLd(jsonLd) }} />
  <div className="mx-auto max-w-6xl">
  <nav className="flex items-center justify-between"><Link href="/" className="font-bold">YPN <span className="text-violet-300">USA</span></Link><Link href="/tools/gbp-optimizer" className="text-sm text-white/65 hover:text-white">GBP Optimizer →</Link></nav>
  <header className="mx-auto max-w-3xl py-12 text-center sm:py-16"><p className="text-xs font-bold uppercase tracking-[.24em] text-violet-300">Free AI marketing tool</p><h1 className="mt-4 text-4xl font-semibold tracking-tight sm:text-6xl">Social Media Marketing Writer</h1><p className="mx-auto mt-5 max-w-2xl text-lg leading-8 text-white/65">Create locally relevant post drafts, hooks, calls to action and follow-up ideas for mortgage and real estate audiences without staring at a blank screen.</p></header>
  <MarketingToolForm tool="social" />
  <section className="mx-auto mt-14 max-w-3xl text-center"><h2 className="text-2xl font-semibold">Turn isolated posts into an ongoing growth system.</h2><p className="mt-3 text-white/55">Use YPN USA&apos;s AI growth tools to connect content, local visibility and follow-up around your market.</p><div className="mt-6 flex flex-wrap items-center justify-center gap-4"><Link href="/#territories" className="inline-flex rounded-full bg-white px-6 py-3 font-bold text-[#17152f]">Check Your ZIP — Free</Link><Link href="/pricing" className="inline-flex rounded-full border border-white/25 px-6 py-3 font-semibold text-white/85 hover:bg-white/10">See paid plans →</Link></div></section>

  <SiloNav silo="growth" currentPath="/tools/social-writer" className="mx-auto mt-12 max-w-3xl" />
 </div></main>;
}
