import Image from "next/image";
import Link from "next/link";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";
import { FOUNDER_ID, jsonLdScript, marketingMetadata } from "@/lib/seo";
import { MARKETING_SITE_URL } from "@/lib/site";

const path = "/book/ai-real-estate-advantage";
const title = "The AI Real Estate Advantage";
const subtitle = "14 Practical Lead Generation Techniques for Real Estate Agents and Mortgage Loan Officers";
const description = "Learn 14 AI lead-generation techniques for real estate agents and mortgage loan officers, with sample workflows, prompts, and a 30-day plan.";
const cover = "/book/second-edition/cover.webp";
const author = "David Jonathan Moore, MBA";

export const metadata = marketingMetadata({ title, description, path });

export default function SecondEditionPage() {
  const book = {
    "@context": "https://schema.org",
    "@type": "Book",
    "@id": `${MARKETING_SITE_URL}${path}#book`,
    name: title,
    alternateName: subtitle,
    author: { "@type": "Person", "@id": FOUNDER_ID, name: author },
    bookEdition: "2",
    bookFormat: "https://schema.org/EBook",
    inLanguage: "en",
    description,
    url: `${MARKETING_SITE_URL}${path}`,
    image: `${MARKETING_SITE_URL}${cover}`,
  };

  return (
    <>
      <SiteHeader />
      <main id="main-content" className="bg-[#09081b] px-5 py-14 text-white sm:px-8">
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLdScript(book) }} />
        <div className="mx-auto max-w-5xl">
          <Link href="/book" className="text-violet-300 underline underline-offset-4">Books by David Moore</Link>
          <div className="mt-8 grid items-center gap-9 md:grid-cols-[minmax(0,1fr)_240px]">
            <div>
              <p className="font-semibold text-violet-300">Second edition</p>
              <h1 className="mt-2 text-4xl font-semibold sm:text-5xl">{title}</h1>
              <p className="mt-3 text-xl text-white/85">{subtitle}</p>
              <p className="mt-5 max-w-2xl text-white/85">
                Use AI to answer new inquiries, build a follow-up list, and decide when to call someone yourself.
                The book includes a 30-day implementation plan, reusable prompts, and a dedicated mortgage playbook.
              </p>
              <Link href="/book/ai-lead-follow-up" className="mt-6 inline-flex rounded-full bg-amber-400 px-6 py-3 font-semibold text-[#09081b]">
                Read the follow-up sample
              </Link>
            </div>
            <Image src={cover} alt={`Cover of ${title} by ${author}`} width={800} height={1280}
              sizes="(min-width: 768px) 240px, 192px" preload className="w-48 rounded-lg md:w-full" />
          </div>
          <div className="mt-12 max-w-3xl space-y-10">
            <section aria-labelledby="techniques">
              <h2 id="techniques" className="text-2xl font-semibold">What you’ll learn</h2>
              <ul className="mt-3 list-disc space-y-2 pl-5 text-white/85">
                <li>Score leads using the signals you already collect and build a call list you can act on.</li>
                <li>Draft listing descriptions, video scripts, and campaigns from verified facts.</li>
                <li>Set up a chatbot that can answer a question, offer a booking, or hand off to a person.</li>
                <li>Test your follow-up rules and track appointment bookings and response times.</li>
              </ul>
            </section>
            <section aria-labelledby="author">
              <h2 id="author" className="text-2xl font-semibold">About David Jonathan Moore</h2>
              <div className="mt-3 flex items-start gap-4">
                <Image src="/book/second-edition/author.png" alt={author} width={72} height={72} className="rounded-full" />
                <p className="text-white/85">
                  David spent 25 years originating mortgages. He started at Wells Fargo on 90-day probation and
                  used local production reports to decide which agents to meet. That experience informs the book’s
                  approach to following up and building relationships. <Link href="/about" className="text-violet-300 underline">More about David</Link>
                </p>
              </div>
            </section>
            <p className="text-white/85">
              The current Amazon listing is for the earlier edition. <Link href="/book" className="text-violet-300 underline">See the earlier edition</Link>.
            </p>
          </div>
        </div>
      </main>
      <SiteFooter />
    </>
  );
}
