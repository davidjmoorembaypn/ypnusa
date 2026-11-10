import Image from "next/image";
import Link from "next/link";
import { AUTHOR_NAME, CA_DRE_ID, NMLS_CONSUMER_ACCESS_URL, NMLS_ID } from "@/lib/author";
import { jsonLdScript } from "@/lib/seo";
import { founderPersonJsonLd } from "@/lib/seo/founder-credentials";

/**
 * "About the author" box for blog posts, with the founder's Person JSON-LD (credentials,
 * licenses, profiles). Per the SEO plan the Person node lives only here and on /about.
 */
export function PostAuthorBox() {
  return (
    <aside aria-label="About the author" className="mt-12 rounded-2xl border border-slate-200 bg-slate-50 p-5 text-sm text-slate-700">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLdScript(founderPersonJsonLd()) }} />
      <div className="flex gap-4">
        <Image
          src="/images/david-j-moore-mba.jpg"
          alt={`Portrait of ${AUTHOR_NAME}`}
          width={64}
          height={75}
          className="h-16 w-14 flex-shrink-0 rounded-xl object-cover"
        />
        <div>
          <p className="font-semibold text-slate-900">
            <Link href="/about" rel="author" className="text-violet-700 hover:underline">
              {AUTHOR_NAME}
            </Link>{" "}
            · Founder, YPN USA
          </p>
          <p className="mt-1 leading-6">
            Loan officer for 25+ years with 2,000+ loans closed, formerly with Wells Fargo and JPMorgan Chase. Fresno
            State MBA.
          </p>
          <p className="mt-1 text-xs text-slate-600">
            NMLS #{NMLS_ID} (
            <a href={NMLS_CONSUMER_ACCESS_URL} target="_blank" rel="noopener noreferrer" className="underline">
              verify
            </a>
            ) · CA DRE #{CA_DRE_ID}
          </p>
        </div>
      </div>
    </aside>
  );
}
