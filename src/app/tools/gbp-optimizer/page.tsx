import type { Metadata } from "next";
import Link from "next/link";
import { MarketingToolForm } from "@/components/marketing-tool-form";

export const metadata: Metadata = { title: "Google Business Profile Optimizer for Mortgage & Real Estate", description: "Generate a practical Google Business Profile audit, optimized business description, post ideas and local SEO actions for mortgage and real estate professionals." };

export default function GbpOptimizerPage() {
 return <main className="min-h-screen ypn-aurora px-4 py-10 text-white sm:px-6"><div className="mx-auto max-w-6xl">
  <nav className="flex items-center justify-between"><Link href="/" className="font-bold">YPN <span className="text-violet-300">USA</span></Link><Link href="/tools/social-writer" className="text-sm text-white/65 hover:text-white">Social Writer →</Link></nav>
  <header className="mx-auto max-w-3xl py-12 text-center sm:py-16"><p className="text-xs font-bold uppercase tracking-[.24em] text-violet-300">Free AI marketing tool</p><h1 className="mt-4 text-4xl font-semibold tracking-tight sm:text-6xl">Google Business Profile Optimizer</h1><p className="mx-auto mt-5 max-w-2xl text-lg leading-8 text-white/65">Turn the information you provide into a clearer local profile strategy, stronger business description, Google Post ideas and prioritized optimization actions.</p><p className="mt-3 text-sm text-white/45">No Google login required. This tool drafts recommendations; it does not access or modify your Google profile.</p></header>
  <MarketingToolForm tool="gbp" />
  <section className="mx-auto mt-14 max-w-3xl text-center"><h2 className="text-2xl font-semibold">Want the AI to keep working after the audit?</h2><p className="mt-3 text-white/55">YPN USA turns one-time recommendations into an ongoing growth workflow for mortgage and real estate professionals.</p><Link href="/#territories" className="mt-6 inline-flex rounded-full bg-white px-6 py-3 font-bold text-[#17152f]">Check Your ZIP — Free</Link></section>
 </div></main>;
}
