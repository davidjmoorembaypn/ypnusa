import Image from "next/image";
import Link from "next/link";
import { AI_BOOK, AMAZON_ASSOCIATE_DISCLOSURE, AUTHOR_NAME, CA_DRE_ID, NMLS_CONSUMER_ACCESS_URL, NMLS_ID } from "@/lib/author";

/**
 * Compact, real-credentials trust signal for conversion pages (homepage,
 * pricing). Pulls from the same verified facts as /about — never invent a
 * review or testimonial here; this is the honest substitute for one.
 */
export function FounderTrustStrip() {
  return (
    <section className="border-y border-white/10 bg-[#0b0a20] py-10">
      <div className="mx-auto flex w-full max-w-5xl flex-col items-center gap-6 px-4 text-center sm:px-6 md:flex-row md:text-left">
        <Image
          src="/images/david-j-moore-mba.jpg"
          alt={`Portrait of ${AUTHOR_NAME}`}
          width={96}
          height={112}
          className="h-20 w-20 flex-shrink-0 rounded-2xl border border-white/10 object-cover"
        />
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.25em] text-violet-300">
            Built by a licensed loan officer, not a marketing agency
          </p>
          <p className="mt-2 text-base text-white/85">
            <span className="font-semibold text-white">{AUTHOR_NAME}</span> &mdash; 25+ years as a
            loan officer, formerly with Wells Fargo and JPMorgan Chase, 2,000+ loans closed, Fresno
            State MBA, and author of several books on mortgage and real estate. Licensed NMLS #{NMLS_ID} &middot; CA DRE #{CA_DRE_ID}.
          </p>
          <p className="mt-3 flex flex-wrap items-center justify-center gap-x-4 gap-y-1 text-xs text-white/50 md:justify-start">
            <Link href="/about" className="underline hover:text-white">
              Full bio &amp; credentials
            </Link>
            <a
              href={NMLS_CONSUMER_ACCESS_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="underline hover:text-white"
            >
              Verify on NMLS Consumer Access
            </a>
          </p>
        </div>
        <a
          href={AI_BOOK.url}
          target="_blank"
          rel="sponsored noopener noreferrer"
          className="flex flex-shrink-0 items-center gap-3 rounded-2xl border border-white/10 bg-white/[0.04] p-3 text-left transition hover:bg-white/[0.08]"
        >
          <Image
            src={AI_BOOK.cover}
            alt={`Cover of ${AI_BOOK.shortTitle} by David Moore`}
            width={64}
            height={95}
            className="h-[95px] w-16 rounded-md object-cover shadow-lg"
          />
          <span className="max-w-[11rem] text-xs leading-5 text-white/70">
            <span className="block font-semibold text-white">Author of {AI_BOOK.shortTitle}</span>
            Now on Amazon Kindle &rarr;
            <span className="mt-1 block text-[10px] text-white/45">{AMAZON_ASSOCIATE_DISCLOSURE}</span>
          </span>
        </a>
      </div>
    </section>
  );
}
