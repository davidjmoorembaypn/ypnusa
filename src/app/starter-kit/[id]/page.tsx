import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";
import { FREE_SIGNUP_HREF } from "@/lib/checkout";
import { LOCKED_KIT_PIECES } from "@/lib/ai/public-agent-tools";
import { readStarterKit } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Props = { params: Promise<{ id: string }> };

/** A private draft page: never indexed, reachable only by its unguessable link. */
export const metadata: Metadata = {
  title: "Your starter kit | YPN USA",
  robots: { index: false, follow: false },
};

function Piece({ title, text, hint }: { title: string; text: string; hint?: string }) {
  return (
    <section className="rounded-2xl border border-white/15 bg-white/5 p-6">
      <h2 className="text-lg font-semibold">{title}</h2>
      {hint ? <p className="mt-1 text-sm text-white/70">{hint}</p> : null}
      <pre className="mt-4 whitespace-pre-wrap break-words font-sans text-base leading-7 text-white/90">{text}</pre>
    </section>
  );
}

/** A paid-plan piece the free preview names but does not write. */
function LockedPiece({ title }: { title: string }) {
  return (
    <section className="relative overflow-hidden rounded-2xl border border-white/15 bg-white/5 p-6">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-lg font-semibold">{title}</h2>
        <span className="inline-flex items-center gap-1 rounded-full border border-violet-300/40 bg-violet-400/15 px-3 py-1 text-xs font-semibold text-violet-100">
          <svg aria-hidden="true" viewBox="0 0 20 20" className="h-3.5 w-3.5 fill-current">
            <path d="M10 2a4 4 0 0 0-4 4v2H5a1 1 0 0 0-1 1v8a1 1 0 0 0 1 1h10a1 1 0 0 0 1-1V9a1 1 0 0 0-1-1h-1V6a4 4 0 0 0-4-4Zm-2 6V6a2 2 0 1 1 4 0v2H8Z" />
          </svg>
          Paid plans
        </span>
      </div>
      <div aria-hidden="true" className="mt-4 space-y-2 blur-sm select-none">
        <div className="h-3 w-11/12 rounded bg-white/20" />
        <div className="h-3 w-10/12 rounded bg-white/20" />
        <div className="h-3 w-9/12 rounded bg-white/20" />
      </div>
      <p className="mt-4 text-sm text-white/75">Cerebro writes this for you, in your voice, once you&rsquo;re on a paid plan.</p>
    </section>
  );
}

export default async function StarterKitPage({ params }: Props) {
  const { id } = await params;
  if (!/^kit_[0-9a-f-]{36}$/.test(id)) notFound();
  const kit = readStarterKit(id);
  if (!kit) notFound();

  return (
    <div className="flex min-h-full flex-col bg-[#09081b] text-white">
      <SiteHeader />
      <main id="main-content" className="flex-1">
        <div className="mx-auto flex w-full max-w-3xl flex-col gap-6 px-5 py-14">
          <header>
            <p className="text-sm font-semibold uppercase tracking-wide text-cyan-300">Drafted by Cerebro</p>
            <h1 className="mt-2 text-3xl font-semibold leading-tight md:text-4xl">
              {kit.officerName}&rsquo;s starter kit for {kit.city}, {kit.state}
            </h1>
            <p className="mt-3 text-white/80">
              Copy any piece below. These are drafts: nothing has been published or sent.
            </p>
          </header>

          <Piece title="Your bio" text={kit.bio} hint="For your website, LinkedIn and email signature." />
          {kit.preview ? (
            <>
              <Piece
                title={`Blog post: ${kit.blogTitle}`}
                text={`${kit.blogOpening ?? ""}\n\n…`}
                hint="The opening paragraph. The full post is part of a paid plan."
              />
              {LOCKED_KIT_PIECES.filter((piece) => piece !== "The rest of the blog post").map((piece) => (
                <LockedPiece key={piece} title={piece} />
              ))}
              <section className="rounded-2xl border border-violet-300/30 bg-violet-500/10 p-6">
                <h2 className="text-lg font-semibold">Want the whole kit written for you?</h2>
                <p className="mt-2 text-white/85">
                  On a paid plan Cerebro finishes the blog post, writes your Google Business Profile description and first
                  post and your welcome email, and keeps your marketing going every week. Your plan also locks your
                  exclusive ZIP code.
                </p>
                <Link
                  href="/pricing"
                  className="mt-4 inline-flex rounded-full bg-violet-500 px-6 py-3 font-semibold text-white hover:bg-violet-400"
                >
                  See plans and unlock the full kit
                </Link>
              </section>
            </>
          ) : (
            <>
              <Piece
                title="Google Business Profile description"
                text={kit.gbpDescription}
                hint="Paste into the 'from the business' field (750 characters max)."
              />
              <Piece title="First Google Business Profile post" text={kit.gbpPost} />
              <Piece title={`Blog post: ${kit.blogTitle}`} text={kit.blogPost} />
              <Piece title={`Welcome email: ${kit.welcomeEmailSubject}`} text={kit.welcomeEmailBody} />
            </>
          )}

          <section className="rounded-2xl border border-amber-300/30 bg-amber-300/10 p-6 text-sm leading-6 text-amber-50">
            <h2 className="text-base font-semibold">Before you use these</h2>
            <ul className="mt-2 list-disc space-y-1 pl-5">
              {kit.complianceNotes.map((note) => (
                <li key={note}>{note}</li>
              ))}
            </ul>
          </section>

          <div className="flex flex-wrap gap-3">
            <Link
              href={FREE_SIGNUP_HREF}
              className="rounded-full bg-cyan-400 px-6 py-3 font-semibold text-slate-950 hover:bg-cyan-300"
            >
              Start free and keep building
            </Link>
            <Link
              href={kit.zip ? `/check-zip?zip=${kit.zip}` : "/check-zip"}
              className="rounded-full border border-white/30 px-6 py-3 font-semibold hover:bg-white/10"
            >
              Check your ZIP code
            </Link>
          </div>
        </div>
      </main>
      <SiteFooter />
    </div>
  );
}
