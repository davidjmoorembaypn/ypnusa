import Image from "next/image";
import Link from "next/link";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";
import { FOUNDER_ID, jsonLdScript, marketingMetadata } from "@/lib/seo";
import { MARKETING_SITE_URL } from "@/lib/site";

const path = "/book/ai-lead-follow-up";
const bookPath = "/book/ai-real-estate-advantage";
const title = "AI Lead Follow-Up for Real Estate Agents";
const description = "Use this real estate lead follow-up workflow to acknowledge new inquiries and handle replies, bookings, opt-outs, and quiet leads.";
const diagram = "/book/second-edition/lead-follow-up.webp";

export const metadata = marketingMetadata({ title, description, path });

export default function LeadFollowUpPage() {
  const article = {
    "@context": "https://schema.org",
    "@type": "Article",
    headline: title,
    description,
    url: `${MARKETING_SITE_URL}${path}`,
    image: `${MARKETING_SITE_URL}${diagram}`,
    author: { "@type": "Person", "@id": FOUNDER_ID, name: "David Jonathan Moore, MBA" },
  };

  return (
    <>
      <SiteHeader />
      <main id="main-content" className="bg-[#09081b] px-5 py-14 text-white sm:px-8">
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLdScript(article) }} />
        <article className="mx-auto max-w-3xl space-y-8">
          <header>
            <p className="mb-3 text-violet-300">
              Sample from <Link href={bookPath} className="underline underline-offset-4">The AI Real Estate Advantage</Link>
            </p>
            <h1 className="text-4xl font-semibold sm:text-5xl">{title}</h1>
            <p className="mt-4 text-lg text-white/85">
              Acknowledge a new inquiry, give the lead one useful next step, and pause when an agent needs to take over.
              Start with one lead source and one approved outreach channel.
            </p>
            <p className="mt-3 text-sm text-white/75">By David Jonathan Moore, MBA</p>
          </header>
          <nav aria-label="On this page" className="rounded-xl border border-white/20 p-5">
            <ul className="space-y-2 text-violet-300 underline underline-offset-4">
              <li><a href="#first-response">Set up the first response</a></li>
              <li><a href="#stop-rules">Decide when automation stops</a></li>
              <li><a href="#measure">Test and measure the workflow</a></li>
            </ul>
          </nav>
          <section id="first-response" className="scroll-mt-24 space-y-3 text-white/85">
            <h2 className="text-2xl font-semibold text-white">Set up the first response</h2>
            <p>Start with one form, such as the inquiry form on a listing. When a message comes in, create or update the CRM record, assign an agent, and send one acknowledgment through an approved channel.</p>
            <blockquote className="border-l-2 border-violet-400 pl-4">
              Hi [first name], I got your question about [property]. I can send the listing details or help you find a time to see it. Which would be more useful?
            </blockquote>
            <p>Submit the form twice after hours. Check that the CRM keeps one contact record, assigns an owner, and avoids duplicate messages.</p>
          </section>
          <section id="stop-rules" className="scroll-mt-24 space-y-3 text-white/85">
            <h2 className="text-2xl font-semibold text-white">Decide when automation stops</h2>
            <ul className="list-disc space-y-2 pl-5">
              <li><strong>Lead replies.</strong> Pause scheduled messages and assign a personal response.</li>
              <li><strong>Showing booked.</strong> End prospecting messages and move to appointment preparation.</li>
              <li><strong>Opt-out received.</strong> Cancel affected marketing and sync the preference across connected tools.</li>
              <li><strong>No reply yet.</strong> Continue only if the lead is still eligible for outreach. Give the next message a specific purpose.</li>
            </ul>
            <figure>
              <Image src={diagram} alt="Follow-up workflow outcomes for a reply, booking, opt-out, or no new activity"
                width={1500} height={545} sizes="(min-width: 800px) 768px, 100vw" className="h-auto w-full rounded-lg" />
              <figcaption className="mt-2 text-sm">Check these four events before the next scheduled message goes out.</figcaption>
            </figure>
          </section>
          <section id="measure" className="scroll-mt-24 space-y-3 text-white/85">
            <h2 className="text-2xl font-semibold text-white">Test and measure the workflow</h2>
            <p>Test a reply just before the next scheduled message and an opt-out from a connected tool. Check the CRM, the message history, and the agent’s task list.</p>
            <p>Divide appointments booked by eligible inquiries from the same source. Twelve bookings from 50 inquiries is 24%. Keep the counts visible, and review opt-outs, duplicate messages, and time to first personal response alongside the rate.</p>
            <Link href={bookPath} className="inline-flex rounded-full bg-amber-400 px-6 py-3 font-semibold text-[#09081b]">Explore the book</Link>
          </section>
        </article>
      </main>
      <SiteFooter />
    </>
  );
}
