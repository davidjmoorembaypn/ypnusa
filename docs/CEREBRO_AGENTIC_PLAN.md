# Cerebro: from chat assistant to an agent that runs on its own

Gap check of the code on `main` (6d82bf5, 2026-11-26) against the goal "Cerebro runs the loan
officer's marketing and follow-up automatically, with the officer approving results", followed by
the build order.

Scope of the check: the code on `main` only. Unmerged branches were not read, and whether a server
timer is switched on in production cannot be seen from the repo.

## Where Cerebro is today

Cerebro is a chat assistant that can call real functions, in three modes: public visitor, borrower
on a loan officer's page, and signed-in loan officer. It emails routine follow-ups on its own every
five minutes after consent and compliance checks. It does not start work on its own for a loan
officer: nothing runs per officer on a schedule, and nothing runs when an officer pays.

The public site already says so: `/cerebro` and the home page list "Multi-task agentic mode",
"Local Visibility Score" and "Done-for-you Google profile setup" as in development.

## Gap check

| # | Capability | State | What exists | What is missing |
|---|---|---|---|---|
| 1 | Tools Cerebro can call | Exists | `src/lib/ai/chat-agent.ts` `toolsForMode()`; 13 public, 8 borrower, 18 officer tools, each re-checked for the session's mode | Nothing |
| 2 | Multi-step loop | Partial | `runWithTools()`, up to 5 tool rounds inside one chat turn, 50-second budget | No goal that outlives the chat turn; no background run |
| 3 | Approval queue | Partial, improved by this branch | `cerebroActions` queue; send-time re-check of edited text in `decideDispatch` | Before this branch the queue could only be worked through chat. Website changes still have no approve buttons |
| 4a | Payment starts onboarding | Partial | Stripe webhook locks the ZIP code and creates a placeholder officer record | No welcome, no page build, no first drafts |
| 4b | Chat lead gets follow-ups | Partial | Lead is routed and the officer alerted; a draft is queued only if the model calls `request_callback` | The scheduled journey (`scheduleBorrowerJourney`) runs for form leads only, not chat leads |
| 4c | Scheduled run per officer | Missing | Global timers only: 5-minute email sender (`instrumentation.ts`), 5-minute journey processor (`aws/ops/systemd/ypnusa-followups.timer`), weekly optimizer for ypnus.com's own titles | Nothing wakes up per paid officer |
| 5 | Compliance in code | Partial | Outbound email: `checkMarketingCompliance` and `applyComplianceGuardrails`, plus consent (`canContact`) | Live chat replies and `draft_marketing_content` output are not run through the checker; legal and tax advice limits are prompt-only; email still passes on a bare consent flag when no ledger record exists; only California has a state rule |
| 6 | Local Visibility Score | Partial | `visibility-score.ts`: percentage of setup steps completed | Uses no search, map or ranking data |
| 7 | Marketing drafts | Partial, draft-only | `draft_marketing_content` (social, email, ad, Google profile post and description), LinkedIn articles, landing-page drafts | Nothing posts to Google Business Profile; no Realtor outreach draft; no flyer |
| 8 | Per-ZIP pages and calculator | Partial | `/zip/[zipcode]` is generic; `/lo/[slug]` has the officer's details and chat | The ZIP page does not show its owner; the branded payment calculator is a preview only and is not on the officer's page; no QR code |
| 9 | Borrower intake chat | Partial | Captures name, contact, ZIP, goal, urgency and consent | Every chat lead is filed as refinance or conventional; no investor (DSCR) questions |
| 10 | Follow-up sequences | Partial | Day 0, 1, 3, 5, 30, 60, 90 journey with consent and opt-out checks | Form leads only; rate alerts only when the officer asks; life-event data is a placeholder; Cerebro never sends texts |
| 11 | Subscription lifecycle | Mostly exists | Cancel or full refund releases the ZIP code; `past_due` keeps it while Stripe retries; billing portal link | No notice to the officer when a payment fails |
| 12 | Extra ZIP codes | Exists | Add-on Payment Links from the dashboard, neighbor suggestions | Nothing |
| 13 | Activity log | Partial | Scattered records (`autopilotRuns`, queue statuses, `siteOverrides`) | No single "what Cerebro did" view |

Not confirmed from code: which AI provider is live in production, whether the follow-ups timer is
enabled on the server, and whether an email or texting provider is configured.

## Build order

Each step is its own branch and pull request, off by default where it changes what gets sent.

1. **Approval inbox in the dashboard (done, #256).** `/dashboard/approvals`. Everything later
   needs somewhere for results to land and be approved.
2. **Check drafts before the officer sees them (done).** `draft_marketing_content` and
   `draft_landing_page` run `checkMarketingCompliance` on the finished draft. A draft that fails
   is not returned: Cerebro gets the list of problems and rewords the request. These drafts are
   built from templates, so there is nothing to regenerate; the fix is in the request wording.
3. **Chat leads get the same follow-up journey as form leads.** Call `scheduleBorrowerJourney`
   from `linkQualifiedLead` when consent is on record. Behind a setting, because it increases
   email volume.
4. **Marketing drafts in the queue.** A new queue kind for a Google profile post, a social post
   and a Realtor outreach email, each addressed to the officer (they post or send it themselves).
5. **Weekly run per paid officer.** A scheduled pass that, for each officer on a paid plan, checks
   the pipeline for leads needing a follow-up and drafts the week's marketing into the queue.
   Driven by the existing server timer and secret. Capped per officer and per pass.
6. **First payment starts onboarding.** When the ZIP code locks: welcome email, the first weekly
   run, and a checklist of what the officer still has to fill in.
7. **Officer's details on the ZIP page and a calculator on the officer's page.** Show the owning
   officer on `/zip/[zipcode]`; put the payment calculator, with their name and NMLS ID, on
   `/lo/[slug]`.
8. **Failed-payment notice.** Email the officer on `invoice.payment_failed` with the billing
   portal link.
9. **Activity view.** One page listing what Cerebro drafted, sent and held, and each scheduled run.
10. **Then update the public pages.** Mark "Multi-task agentic mode" live only after step 5 ships.

Deliberately not planned yet:

- **Posting to Google Business Profile.** Needs Google API access and each officer's permission.
- **A visibility score built on real search data.** Needs a data source per officer.
- **Texts sent by Cerebro.** Needs carrier registration to finish first.
- **A rate feed.** Rate alerts stay officer-triggered.

## Rules that stay fixed

- Cerebro never quotes or locks a rate, makes a credit decision, or gives legal or tax advice.
- Nothing is sent to a borrower without recorded consent for that channel.
- Anything the compliance checker stops goes to the officer with the reason.
- A new automatic behaviour ships switched off and is turned on per officer or by a server setting.
