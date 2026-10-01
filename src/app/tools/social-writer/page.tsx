import type { Metadata } from "next";
import Link from "next/link";
import { MarketingToolForm } from "@/components/marketing-tool-form";

export const metadata: Metadata = { title: "AI Social Media Marketing Writer for Mortgage & Real Estate", description: "Generate local social media post drafts, hooks, CTAs and campaign ideas for mortgage loan officers and real estate professionals." };

export default function SocialWriterPage() {
 return <main className="min-h-screen ypn-aurora px-4 py-10 text-white sm:px-6"><div className="mx-auto max-w-6xl">
  <nav className="flex items-center justify-between"><Link href="/" className="font-bold">YPN <span className="text-violet-300">USA</span></Link><Link href="/tools/gbp-optimizer" className="text-sm text-white/65 hover:text-white">GBP Optimizer →</Link></nav>
  <header className="mx-auto max-w-3xl py-12 text-center sm:py-16"><p className="text-xs font-bold uppercase tracking-[.24em] text-violet-300">Free AI marketing tool</p><h1 className="mt-4 text-4xl font-semibold tracking-tight sm:text-6xl">Social Media Marketing Writer</h1><p className="mx-auto mt-5 max-w-2xl text-lg leading-8 text-white/65">Create locally relevant post drafts, hooks, calls to action and follow-up ideas for mortgage and real estate audiences without staring at a blank screen.</p></header>
  <MarketingToolForm tool="social" />
  <section className="mx-auto mt-14 max-w-3xl text-center"><h2 className="text-2xl font-semibold">Turn isolated posts into an ongoing growth system.</h2><p className="mt-3 text-white/55">Use YPN USA's AI growth tools to connect content, local visibility and follow-up around your market.</p><Link href="/#territories" className="mt-6 inline-flex rounded-full bg-white px-6 py-3 font-bold text-[#17152f]">Check Your ZIP — Free</Link></section>
 </div></main>;
}
