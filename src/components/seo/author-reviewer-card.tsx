import Image from "next/image";
import Link from "next/link";
import { AUTHOR_NAME, AUTHOR_PROFILES, BOOK_AMAZON_URL, BOOK_TITLE, CA_DRE_ID, NMLS_CONSUMER_ACCESS_URL, NMLS_ID } from "@/lib/author";
import { jsonLdScript } from "@/lib/seo";
import { authorReviewerGraphJsonLd } from "@/lib/seo/founder-credentials";
import { MARKETING_SITE_URL } from "@/lib/site";

interface Props {
  /** Site-relative path of the page, e.g. "/research". Used for the WebPage node's URL. */
  path: string;
  /** Page name for the WebPage node. */
  pageName: string;
  /** False when the founder reviewed the page but someone else wrote it (shows "Reviewed by"). */
  written?: boolean;
  /** @id of the node this page already emits for itself, so author/reviewer merge into it. */
  pageId?: string;
  /** @type of that node (default WebPage). */
  pageType?: string;
  tone?: "light" | "dark";
  className?: string;
}

/**
 * "Written & Reviewed by" card with the founder's verifiable credentials, plus one connected
 * @graph (Organization, Person, Book, WebPage) that says the same thing to search engines.
 * The facts match /about; do not add reviews, awards or numbers that are not there.
 */
export function AuthorReviewerCard({ path, pageName, written = true, pageId, pageType, tone = "light", className = "" }: Props) {
  const dark = tone === "dark";
  const link = dark ? "text-violet-200 underline hover:text-white" : "text-violet-700 underline hover:text-violet-900";
  return (
    <aside
      aria-label={written ? "Author and reviewer" : "Reviewer"}
      className={`rounded-2xl border p-5 text-sm ${dark ? "border-white/15 bg-white/5 text-white/85" : "border-slate-200 bg-slate-50 text-slate-700"} ${className}`}
    >
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: jsonLdScript(authorReviewerGraphJsonLd({ url: `${MARKETING_SITE_URL}${path}`, name: pageName, written, pageId, pageType })) }}
      />
      <div className="flex gap-4">
        <Image
          src="/images/david-j-moore-mba.jpg"
          alt={`Portrait of ${AUTHOR_NAME}`}
          width={64}
          height={75}
          className="h-16 w-14 flex-shrink-0 rounded-xl object-cover"
        />
        <div>
          <p className={`leading-6 ${dark ? "text-white" : "text-slate-900"}`}>
            <span className="font-semibold">{written ? "Written & Reviewed by" : "Reviewed by"}</span>{" "}
            <Link href="/about" rel="author" className={`font-semibold ${link}`}>
              {AUTHOR_NAME}
            </Link>{" "}
            &mdash; Licensed Mortgage Loan Officer (NMLS #{NMLS_ID}) &amp; California DRE Broker (#{CA_DRE_ID}) &middot; 25+ Years Experience &middot; 2,000+ Loans
            Closed &middot; Formerly Wells Fargo &amp; JPMorgan Chase.
          </p>
          <p className={`mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs ${dark ? "text-white/70" : "text-slate-600"}`}>
            <a href={NMLS_CONSUMER_ACCESS_URL} target="_blank" rel="noopener noreferrer" className={link}>
              Verify on NMLS Consumer Access
            </a>
            <a href={AUTHOR_PROFILES.linkedin} target="_blank" rel="noopener noreferrer" className={link}>
              LinkedIn
            </a>
            <a href={AUTHOR_PROFILES.orcid} target="_blank" rel="noopener noreferrer" className={link}>
              ORCID
            </a>
            <a href={AUTHOR_PROFILES.facebook} target="_blank" rel="noopener noreferrer" className={link}>
              Facebook
            </a>
            <a href={BOOK_AMAZON_URL} target="_blank" rel="noopener noreferrer" className={link} title={BOOK_TITLE}>
              Published book
            </a>
          </p>
        </div>
      </div>
    </aside>
  );
}
