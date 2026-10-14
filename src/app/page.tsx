import type { Metadata } from "next";
import { PredictiveHomepageEngine } from "@/components/homepage/PredictiveHomepageEngine";
import { FloatingAssistantWidget } from "@/components/assistant/floating-assistant-widget";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import { Hero } from "@/components/home/hero";
import { HowItWorks } from "@/components/home/how-it-works";
import { IntakeSimulator } from "@/components/home/intake-simulator";
import { PiCalculator } from "@/components/home/pi-calculator";
import { PricingMatrix } from "@/components/home/pricing-matrix";
import { Ownership } from "@/components/home/ownership";
import { Faq, FAQ_ITEMS, FinalCta } from "@/components/home/faq";
import { SectionHeading } from "@/components/home/section-heading";

export const metadata: Metadata = {
  title: "YPN USA | Exclusive ZIP Territories + AI Borrower Intake for Loan Officers",
  description:
    "Lock exclusive mortgage demand in your ZIP, let an AI intake agent qualify and book borrowers 24/7, and keep 100% ownership of your leads, domain, and funnels. 15-day free trial.",
  alternates: { canonical: "/" },
};

const faqJsonLd = {
  "@context": "https://schema.org",
  "@type": "FAQPage",
  mainEntity: FAQ_ITEMS.map((item) => ({
    "@type": "Question",
    name: item.q,
    acceptedAnswer: { "@type": "Answer", text: item.a },
  })),
};

export default function Home() {
  return (
    <div className="ypn-ink flex min-h-full flex-col overflow-x-clip pb-24 text-white md:pb-0">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(faqJsonLd) }} />
      <SiteHeader />

      <main id="main-content" className="flex-1">
        <Hero />
        <div className="mx-auto w-full max-w-6xl px-4 sm:px-6">
          <PredictiveHomepageEngine />
        </div>

        <HowItWorks />

        <section aria-labelledby="intake-title" id="ai-agent" className="scroll-mt-24 px-4 py-24 sm:px-6">
          <div className="mx-auto max-w-6xl">
            <SectionHeading
              id="intake-title"
              eyebrow="Live demo · Your AI intake agent"
              title="See how your agent qualifies borrowers for you"
              description="Step into your borrower's shoes. Pick a loan lane and answer the way a visitor to your site would. Your agent adapts its questions, scores the lead in real time, and books the consult on your calendar."
            />
            <div className="mt-14">
              <IntakeSimulator />
            </div>
          </div>
        </section>

        <section aria-labelledby="calc-title" id="calculator" className="scroll-mt-24 px-4 py-24 sm:px-6">
          <div className="mx-auto max-w-6xl">
            <SectionHeading
              id="calc-title"
              eyebrow="Included on your MLO site"
              title="Lead-capturing tools your borrowers actually use"
              description="This principal & interest calculator comes with your branded site. Borrowers run their numbers, and the ones who are serious go straight into your intake pipeline."
            />
            <div className="mt-14">
              <PiCalculator />
            </div>
          </div>
        </section>

        <Ownership />

        <section aria-labelledby="pricing-title" id="pricing" className="scroll-mt-24 px-4 py-24 sm:px-6">
          <div className="mx-auto max-w-6xl">
            <SectionHeading
              id="pricing-title"
              eyebrow="Pricing"
              title="Start free. Lock your ZIP when you're ready."
              description="Every paid plan includes one exclusive ZIP and a 15-day free trial. Cancel anytime."
            />
            <div className="mt-12">
              <PricingMatrix />
            </div>
          </div>
        </section>

        <Faq />
        <FinalCta />
      </main>

      <SiteFooter />

      {/* Mobile sticky conversion bar */}
      <div className="fixed inset-x-0 bottom-0 z-30 border-t border-white/10 bg-[#070816]/95 px-4 pb-[calc(0.75rem+env(safe-area-inset-bottom))] pt-3 backdrop-blur md:hidden">
        <a
          href="#zip-check"
          className="flex w-full items-center justify-center gap-2 rounded-full bg-gradient-to-r from-violet-500 to-indigo-500 px-6 py-3 text-sm font-semibold text-white shadow-lg shadow-indigo-600/30 transition active:scale-[0.99] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-300"
        >
          Check ZIP availability
        </a>
      </div>

      <FloatingAssistantWidget />
    </div>
  );
}
