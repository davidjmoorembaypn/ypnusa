import Link from "next/link";
import type { Metadata } from "next";
import { ApprovalItem } from "@/components/portal/approval-item";
import { SessionBar } from "@/components/session-bar";
import { requireSession } from "@/lib/auth";
import { MAX_EDITED_BODY, officerForEmail, QUEUE_KIND_LABEL, queueViewFor } from "@/lib/cerebro-queue";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Waiting for your OK | YPN USA",
  robots: { index: false, follow: false },
};

const CHANNEL_LABEL = { email: "Email", text: "Text message", phone: "Phone call" } as const;

const dateFormat = new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit", timeZone: "America/Los_Angeles", timeZoneName: "short" });

function when(iso: string | undefined): string {
  const time = iso ? Date.parse(iso) : Number.NaN;
  return Number.isNaN(time) ? "" : dateFormat.format(new Date(time));
}

/** Everything Cerebro drafted for this loan officer and is waiting on them for, with what it sent on its own. */
export default async function DashboardApprovalsPage() {
  const session = await requireSession("/dashboard/approvals");
  const officer = officerForEmail(session.email);
  const view = officer ? queueViewFor(officer) : null;

  return (
    <main className="min-h-full bg-slate-50 px-4 py-10 text-slate-900 sm:px-6 sm:py-12">
      <div className="mx-auto flex max-w-3xl flex-col gap-8">
        <nav className="flex flex-wrap items-center justify-between gap-3 text-sm">
          <Link href="/dashboard" className="font-semibold text-violet-700 hover:text-violet-900">
            Back to dashboard
          </Link>
          <SessionBar />
        </nav>

        <header>
          <h1 className="text-3xl font-semibold tracking-tight">Waiting for your OK</h1>
          <p className="mt-2 text-slate-700">
            Messages Cerebro drafted for your borrowers. Read each one, change the wording if you like, then approve or
            dismiss it. Cerebro never quotes a rate or makes a loan decision.
          </p>
        </header>

        {!view ? (
          <section className="rounded-2xl border border-slate-200 bg-white p-6">
            <h2 className="text-lg font-semibold">Finish your profile first</h2>
            <p className="mt-2 text-slate-700">
              Cerebro drafts messages once your loan officer profile is set up with your name and NMLS ID.
            </p>
            <Link href="/onboarding" className="mt-4 inline-block rounded-lg bg-violet-700 px-4 py-2.5 text-sm font-semibold text-white hover:bg-violet-800">
              Set up your profile
            </Link>
          </section>
        ) : (
          <>
            <section aria-labelledby="mode-heading" className="rounded-2xl border border-slate-200 bg-white p-5">
              <h2 id="mode-heading" className="text-base font-semibold">
                {view.replyMode === "live" ? "Cerebro sends routine emails on its own" : "Cerebro waits for your OK on every email"}
              </h2>
              <p className="mt-1 text-sm text-slate-700">
                {view.replyMode === "live"
                  ? "First replies, check-ins and rate alerts go out by email when the borrower agreed to be contacted and every compliance check passes. Anything else, and anything a check stops, waits here."
                  : "Nothing is emailed to a borrower until you approve it here."}{" "}
                To change this, tell Cerebro in your dashboard chat: &ldquo;{view.replyMode === "live" ? "Ask me before sending emails" : "Send routine emails on your own"}&rdquo;.
              </p>
              {view.waitingToSend > 0 ? (
                <p className="mt-2 text-sm text-slate-700">
                  {view.waitingToSend} more {view.waitingToSend === 1 ? "message is" : "messages are"} approved or automatic and waiting to send (for example, outside 8am to 9pm). Nothing is needed from you for {view.waitingToSend === 1 ? "it" : "them"}.
                </p>
              ) : null}
            </section>

            <section aria-labelledby="waiting-heading">
              <h2 id="waiting-heading" className="text-lg font-semibold">
                {view.waiting.length === 0 ? "Nothing is waiting on you" : `${view.waiting.length} waiting on you`}
              </h2>
              {view.waiting.length === 0 ? (
                <p className="mt-2 text-slate-700">New drafts appear here when a borrower asks for a callback or a follow-up needs your review.</p>
              ) : (
                <ul className="mt-4 flex flex-col gap-4">
                  {[...view.waiting].reverse().map((item) => (
                    <ApprovalItem
                      key={item.id}
                      id={item.id}
                      kindLabel={QUEUE_KIND_LABEL[item.kind]}
                      borrower={item.borrower}
                      channelLabel={CHANNEL_LABEL[item.channel]}
                      createdLabel={when(item.createdAt)}
                      preferredWindow={item.preferredWindow}
                      needsYou={item.needsYou}
                      subject={item.subject}
                      body={item.body}
                      cerebroSends={item.cerebroSends}
                      maxLength={MAX_EDITED_BODY}
                    />
                  ))}
                </ul>
              )}
            </section>

            <section aria-labelledby="sent-heading" className="rounded-2xl border border-slate-200 bg-white p-5">
              <h2 id="sent-heading" className="text-lg font-semibold">
                Recently sent by Cerebro
              </h2>
              {view.recentlySent.length === 0 ? (
                <p className="mt-2 text-slate-700">Cerebro has not emailed a borrower for you yet.</p>
              ) : (
                <ul className="mt-3 divide-y divide-slate-100 text-sm">
                  {[...view.recentlySent].reverse().map((item, index) => (
                    <li key={`${item.sentAt ?? ""}-${index}`} className="flex flex-wrap items-baseline justify-between gap-2 py-2.5">
                      <span>
                        <span className="font-semibold">{QUEUE_KIND_LABEL[item.kind]}</span> to {item.borrower}
                        {item.subject ? <span className="text-slate-600">: {item.subject}</span> : null}
                      </span>
                      <span className="text-slate-600">{when(item.sentAt)}</span>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          </>
        )}
      </div>
    </main>
  );
}
