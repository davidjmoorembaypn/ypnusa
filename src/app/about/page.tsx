import type { Metadata } from "next";
import Link from "next/link";
import { Breadcrumbs } from "@/components/seo/breadcrumbs";
import { AboutProfilePageSchema } from "@/components/seo/silo-schema";

export const metadata: Metadata = {
  title: "About David J. Moore, MBA — Founder, YPN USA",
  description:
    "David J. Moore, MBA is the CEO of YPN Inc, founder of ToInvested.com, and creator of the YPN USA Agentic AI System — built on a track record of thousands of closed home loans at JPMorgan Chase and Wells Fargo Home Mortgage.",
  alternates: { canonical: "/about" },
  openGraph: {
    type: "profile",
    title: "About David J. Moore, MBA — Founder, YPN USA",
    description:
      "CEO of YPN Inc, founder of ToInvested.com, and creator of the YPN USA Agentic AI System.",
  },
};

const BREADCRUMB_ITEMS = [
  { name: "Home", href: "/" },
  { name: "About", href: "/about" },
];

const CREDENTIALS = [
  { label: "CEO", detail: "YPN Inc." },
  { label: "Founder", detail: "ToInvested.com" },
  { label: "Owner", detail: "YPNUS.com" },
  { label: "MBA", detail: "California State University, Fresno" },
  { label: "NMLS #787257", detail: "DRE #01852847" },
];

export default function AboutPage() {
  return (
    <div className="mx-auto max-w-3xl px-6 py-16 sm:py-20">
      <Breadcrumbs items={BREADCRUMB_ITEMS} />
      <AboutProfilePageSchema />

      <p className="mt-6 text-xs font-semibold uppercase tracking-[0.3em] text-violet-300">
        Author Hub
      </p>
      <h1 className="mt-3 text-3xl font-semibold tracking-tight sm:text-4xl">
        David J. Moore, MBA
      </h1>
      <p className="mt-3 text-sm text-white/50">
        CEO of YPN Inc &middot; Founder of ToInvested.com &middot; Owner of YPNUS.com
      </p>

      <div className="mt-8 flex h-20 w-20 items-center justify-center rounded-full bg-gradient-to-br from-violet-500 to-violet-700 text-2xl font-black text-white">
        DM
      </div>

      <div className="mt-8 flex flex-wrap gap-2">
        {CREDENTIALS.map((item) => (
          <span
            key={item.label}
            className="inline-flex items-center gap-1.5 rounded-full border border-white/15 bg-white/5 px-3 py-1.5 text-xs text-white/70"
          >
            <span className="font-semibold text-white">{item.label}</span>
            <span className="text-white/40">&middot;</span>
            {item.detail}
          </span>
        ))}
      </div>

      <div
        className="mt-10 space-y-6 text-sm leading-7 text-white/70
          [&_h2]:mt-10 [&_h2]:text-xl [&_h2]:font-semibold [&_h2]:tracking-tight [&_h2]:text-white
          [&_p]:leading-7
          [&_a]:text-violet-300 [&_a]:underline [&_a:hover]:text-violet-200
          [&_strong]:font-semibold [&_strong]:text-white/90"
      >
        <h2>Leadership</h2>
        <p>
          David J. Moore, MBA is the <strong>CEO of YPN Inc</strong>, the company behind YPN USA
          and the <strong>Agentic AI System</strong> that powers it. He is also the{" "}
          <strong>founder of ToInvested.com</strong> and the <strong>owner of YPNUS.com</strong>,
          where he built the exclusive-ZIP-territory model that lets a single loan officer own
          every borrower conversation in their market — without bidding against other agents for
          the same lead.
        </p>

        <h2>Academic background</h2>
        <p>
          He holds an <strong>MBA from California State University, Fresno</strong>, and has
          spent his career applying that training to the mortgage and real-estate-technology
          industries, most recently in designing the automation and qualification logic behind
          YPN USA&apos;s Agentic AI System.
        </p>

        <h2>Track record</h2>
        <p>
          Before founding YPN Inc, David closed <strong>thousands of home loans</strong> as a
          top-producing loan officer at <strong>JPMorgan Chase</strong> and{" "}
          <strong>Wells Fargo Home Mortgage</strong>. That volume of borrower conversations —
          what qualifies a lead, what stalls a deal, what a loan officer actually needs on their
          calendar to close — is what the Agentic AI System is built to replicate at scale. He is
          also a <strong>nationwide industry speaker</strong>, presenting on lead generation and
          AI-driven borrower capture to loan officer audiences across the country.
        </p>

        <h2>Author</h2>
        <p>
          David is an <strong>Amazon-published author of three real estate and lead-acquisition
          books</strong>, including{" "}
          <em>&quot;Top 9 Secret Online Real Estate Leads Even the Gurus Do Not Know
          About.&quot;</em> His writing focuses on the same problem YPN USA solves in software:
          how a real estate or mortgage professional wins a local market without depending on
          referral gatekeepers.
        </p>

        <h2>Why this matters</h2>
        <p>
          YPN USA&apos;s Agentic AI System isn&apos;t a generic chatbot bolted onto a lead form —
          it&apos;s built by someone who spent years closing the loans it now helps originate.
          Every paid ZIP-territory subscription locks that territory to one loan officer, and the
          same AI system that captures, qualifies, and nurtures each borrower reflects the
          qualification instincts David built over thousands of real closings.
        </p>
      </div>

      <div className="mt-10 flex flex-wrap gap-x-6 gap-y-2 text-sm">
        <Link href="/" className="text-violet-300 underline hover:text-violet-200">
          See the Agentic AI System
        </Link>
        <Link href="/real-estate-leads/book-funnel" className="text-violet-300 underline hover:text-violet-200">
          Read the books
        </Link>
        <Link href="/mortgage-loans" className="text-violet-300 underline hover:text-violet-200">
          Mortgage loan programs
        </Link>
      </div>
    </div>
  );
}
