import Image from "next/image";
import Link from "next/link";
import { AUTHOR_NAME, CA_DRE_ID, NMLS_CONSUMER_ACCESS_URL, NMLS_ID } from "@/lib/author";

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
            <span className="font-semibold text-white">{AUTHOR_NAME}</span> &mdash; 25+ years in
            mortgage lending, former top-producing loan officer at Chase Bank and Wells Fargo Home
            Mortgage, 2,000+ loans closed, and Amazon-published author on real estate lead
            generation. Licensed NMLS #{NMLS_ID} &middot; CA DRE #{CA_DRE_ID}.
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
      </div>
    </section>
  );
}
