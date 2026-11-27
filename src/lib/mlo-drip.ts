import crypto from "node:crypto";
import { entitlementForEmail, normalizeEmail } from "@/lib/accounts";
import { BUSINESS_EMAIL } from "@/lib/author";
import { readDb, StoreNotDurableError, writeDb, writeDbDurably } from "@/lib/db";
import { escapeHtml, sendEmail } from "@/lib/email";
import { getPublicBusinessProfile } from "@/lib/local-seo";
import { getPricingTier, PLAN_ENTITLEMENTS, TRIAL_DAYS } from "@/lib/pricing";
import { signValue, verifySignedValue } from "@/lib/session";
import { checkLedgerTerritory } from "@/lib/territory-ledger";
import { MARKETING_SITE_URL } from "@/lib/site";
import type { MloDripEnrollmentRecord, MloDripStepId } from "@/lib/types";
import type { UnsubscribeOutcome } from "@/lib/unsubscribe";
import { DEMAND_ESTIMATE_LABEL, estimateZipDemand } from "@/lib/zip-demand";

/**
 * A short email series for loan officers who opened a free account and have not bought a plan.
 *
 * Off unless the server sets MLO_DRIP_ENABLED=true.
 *
 * Who gets it: a free account (self-serve sign-up) that has signed in through its emailed link,
 * so the mailbox is known to be theirs. Not admins, not accounts created by a Stripe checkout,
 * and nobody paying or on a trial. People who only filled in a form or chatted with Cerebro are
 * NOT enrolled: those addresses were typed and never confirmed.
 *
 * No backfill: only accounts created after the series was first switched on are enrolled, so
 * turning it on never emails the existing list.
 *
 * Every email carries a one-click unsubscribe link and the business's postal address. An
 * unsubscribe is kept against the address for good; the account itself is untouched and can
 * still sign in.
 *
 * At most one email per person per run, and a step that is more than STALE_AFTER_DAYS overdue is
 * skipped, never sent late in a burst. A step is recorded as sent only when the mail provider
 * accepted it. Nothing here logs or reports an email address.
 */

const DAY_MS = 24 * 60 * 60 * 1000;

export const MLO_DRIP_STEPS: ReadonlyArray<{ id: MloDripStepId; afterDays: number }> = [
  { id: "day_1_free_account", afterDays: 1 },
  { id: "day_3_exclusive_zip", afterDays: 3 },
  { id: "day_6_cerebro", afterDays: 6 },
  { id: "day_10_plans", afterDays: 10 },
  { id: "day_14_last_note", afterDays: 14 },
];

/** A step this late is skipped instead of sent (for example after an outage). */
export const STALE_AFTER_DAYS = 3;
/** A claim older than this is treated as abandoned (the process died mid-send) and may be retried. */
const CLAIM_TIMEOUT_MS = 15 * 60 * 1000;
/** Keeps a run short and volume low; these share a sender with the sign-in links. */
const MAX_SENDS_PER_RUN = 20;

export function mloDripEnabled(env: NodeJS.ProcessEnv = process.env): boolean {
  return env.MLO_DRIP_ENABLED?.trim().toLowerCase() === "true";
}

// --- Unsubscribe links ---------------------------------------------------------------------------

const tokenFor = (enrollmentId: string) => signValue(`mlo-drip-unsub:${enrollmentId}`);

function link(path: string, enrollmentId: string): string {
  const params = new URLSearchParams({ m: enrollmentId, t: tokenFor(enrollmentId) });
  return `${MARKETING_SITE_URL}${path}?${params.toString()}`;
}

/** The page a person opens; it shows a confirm button, so a link scanner cannot unsubscribe anyone. */
export const mloDripUnsubscribeUrl = (enrollmentId: string) => link("/unsubscribe", enrollmentId);
/** The address mail apps POST to for one-click unsubscribe (RFC 8058). */
export const mloDripOneClickUrl = (enrollmentId: string) => link("/api/unsubscribe", enrollmentId);

/**
 * Stops the series for the address behind this enrollment when the signed link checks out.
 * "invalid" for a bad or unknown link without saying which; "not_saved" when the link is good but
 * the data file could not be written (see UnsubscribeOutcome).
 */
export function unsubscribeMloDrip(enrollmentId: string, token: string): UnsubscribeOutcome {
  if (!/^[\w-]{1,80}$/.test(enrollmentId) || !token || !verifySignedValue(`mlo-drip-unsub:${enrollmentId}`, token)) return "invalid";
  let found = false;
  // Confirmed only once it is on disk. An opt-out that stayed in memory would be lost on a
  // restart and the emails would start again, so a failed write is reported as not saved.
  // A retry writes the snapshot again even when memory already says "unsubscribed".
  try {
    writeDbDurably((db) => {
      const enrollment = db.mloDrip.enrollments.find((item) => item.id === enrollmentId);
      if (!enrollment) return;
      found = true;
      if (enrollment.status !== "unsubscribed") {
        enrollment.status = "unsubscribed";
        enrollment.statusAt = new Date().toISOString();
        delete enrollment.sending;
      }
    });
  } catch (error) {
    // An unknown enrollment stays "invalid"; any other failure (the write, or reading the store)
    // asks the person to try again rather than telling them the link is bad.
    return error instanceof StoreNotDurableError && !found ? "invalid" : "not_saved";
  }
  return found ? "unsubscribed" : "invalid";
}

// --- The emails ----------------------------------------------------------------------------------

export interface MloDripEmail {
  subject: string;
  /** Plain paragraphs and bullet lists; rendered to HTML with the footer by renderMloDripEmail. */
  blocks: Array<{ p: string } | { list: string[] } | { link: { label: string; href: string } }>;
}

const url = (path: string) => `${MARKETING_SITE_URL}${path}`;

function plansBlock(): string[] {
  const pro = getPricingTier("growth");
  const growth = getPricingTier("pro");
  const exclusive = getPricingTier("elite");
  // Only the rows where the three paid plans differ, straight from the comparison table.
  // Never the life-event row: no feed of probate, divorce or deed records exists, so it must not
  // be sold here even if the comparison table still lists it.
  const differences = PLAN_ENTITLEMENTS.filter((row) => !(row.growth === row.pro && row.pro === row.elite) && !/life-event/i.test(row.label));
  // "Portable MLO website" -> "portable MLO website": lower the first letter only.
  const inSentence = (labels: string[]) => labels.map((label) => label.charAt(0).toLowerCase() + label.slice(1)).join("; ");
  const has = (value: string) => value !== "—";
  const extras = (pick: (row: (typeof PLAN_ENTITLEMENTS)[number]) => string) =>
    differences.filter((row) => has(pick(row))).map((row) => row.label);
  const growthOnly = extras((row) => row.pro).filter((label) => !extras((row) => row.growth).includes(label));
  const exclusiveOnly = extras((row) => row.elite).filter((label) => !extras((row) => row.pro).includes(label));
  return [
    `${pro.name}, ${pro.price} a month: one exclusive ZIP code, live lead delivery, Cerebro's email follow-up and text drafts, calendar booking.`,
    `${growth.name}, ${growth.price} a month: everything in ${pro.name}, plus ${inSentence(growthOnly)}.`,
    `${exclusive.name}, ${exclusive.price} a month: everything in ${growth.name}, plus ${inSentence(exclusiveOnly)}.`,
  ];
}

/**
 * The text of one step. `zip` is the ZIP code the officer entered during setup, if any. Anything
 * said about that ZIP code is checked at the moment of sending and worded as of that moment.
 * No rates, no promises of leads, no countdowns or "others are looking" lines.
 */
export function buildMloDripEmail(step: MloDripStepId, context: { zip?: string } = {}): MloDripEmail {
  const zip = context.zip && /^\d{5}$/.test(context.zip) ? context.zip : undefined;
  switch (step) {
    case "day_1_free_account":
      return {
        subject: "What your free YPN USA account includes",
        blocks: [
          { p: "Thanks for opening a free YPN USA account. Here is what it does and does not do, so there are no surprises." },
          { list: [
            "It includes Cerebro's growth diagnostic and a preview of the AI borrower intake.",
            "It does not lock a ZIP code. Another loan officer can claim yours until you make a first payment on a paid plan.",
            "Live lead delivery starts with a paid plan.",
          ] },
          { p: "If you have not finished setting up your profile, that is the best next step. It takes a few minutes." },
          { link: { label: "Finish setting up", href: url("/onboarding") } },
        ],
      };
    case "day_3_exclusive_zip": {
      const blocks: MloDripEmail["blocks"] = [
        { p: "YPN USA gives one loan officer each ZIP code. While you hold a ZIP code, borrower inquiries from YPN USA's pages for it go only to you." },
        { list: [
          "A ZIP code locks to you at your first payment on a paid plan.",
          `The ${TRIAL_DAYS}-day trial lets you try the tools. It does not lock the ZIP code.`,
          "To lock it the same day, choose the pay-now option or a prepaid plan.",
        ] },
      ];
      // The same check the site's ZIP checker uses. A five-digit number that is not a real ZIP
      // code (00000, a typo) gets no sentence at all, never "nobody holds it".
      const territory = zip ? checkLedgerTerritory(zip) : null;
      if (zip && territory?.valid) {
        const demand = estimateZipDemand(zip);
        const open = territory.available;
        if (open) blocks.push({ p: `When this email was sent, ZIP code ${zip} was not held by anyone on YPN USA. That can change at any time.` });
        if (demand && demand.basis === "census_acs" && demand.total > 0) {
          blocks.push({ p: `For ${zip}, Census survey data suggests about ${demand.buyers} households move into a home they own in a typical 60 days. ${DEMAND_ESTIMATE_LABEL}` });
        }
      }
      blocks.push({ link: { label: "Check a ZIP code", href: url("/check-zip") } });
      return { subject: "How exclusive ZIP codes work on YPN USA", blocks };
    }
    case "day_6_cerebro":
      return {
        subject: "What Cerebro does with a borrower inquiry",
        blocks: [
          { p: "Cerebro is the AI assistant on your YPN USA pages. On a paid plan, this is what happens when a borrower writes in:" },
          { list: [
            "It answers their questions at any hour and asks what you would ask first.",
            "It emails borrowers who agreed to be contacted.",
            "It drafts texts and call notes for you. Those are never sent without your approval.",
            "No texts or calls go out between 9pm and 8am, and all contact stops as soon as someone opts out.",
            "Every message it sends is checked against mortgage advertising rules first.",
          ] },
          { p: "You review what is waiting for you in one place, and edit or dismiss anything before it is sent." },
          { link: { label: "See how Cerebro works", href: url("/cerebro") } },
        ],
      };
    case "day_10_plans":
      return {
        subject: "The three YPN USA plans, side by side",
        blocks: [
          { p: "Every paid plan includes one exclusive ZIP code and Cerebro's follow-up. Here is where they differ." },
          { list: plansBlock() },
          { p: `Each has a ${TRIAL_DAYS}-day trial. Remember that the trial does not lock your ZIP code; the first payment does.` },
          { link: { label: "Compare the plans", href: url("/pricing") } },
        ],
      };
    case "day_14_last_note":
      return {
        subject: "A last note about your YPN USA account",
        blocks: [
          { p: "This is the last email in this short series. Your free account stays open, and nothing changes if you do nothing." },
          { p: "If a paid plan is not right for you now, that is fine. If you have a question we did not answer, reply to this email and a person will read it." },
          { link: { label: "See the plans", href: url("/pricing") } },
        ],
      };
  }
}

/** Why they are getting it, how to stop it, and the sender's postal address (required on commercial email). */
function footerHtml(enrollmentId: string): string {
  const business = getPublicBusinessProfile();
  const address = [business.streetAddress, business.locality, [business.region, business.postalCode].filter(Boolean).join(" ")].filter(Boolean).join(", ");
  return [
    `<p style="margin:24px 0 0;color:#64748b;font-size:12px;line-height:18px">`,
    `You are getting this because you opened a free YPN USA account. `,
    `<a href="${escapeHtml(mloDripUnsubscribeUrl(enrollmentId))}" style="color:#64748b">Unsubscribe from these emails</a>. `,
    `You can still sign in after unsubscribing.<br>`,
    `${escapeHtml(business.name)}, ${escapeHtml(address)}`,
    `</p>`,
  ].join("");
}

export function renderMloDripEmail(email: MloDripEmail, enrollmentId: string): string {
  const body = email.blocks
    .map((block) => {
      if ("p" in block) return `<p style="margin:0 0 14px">${escapeHtml(block.p)}</p>`;
      if ("list" in block) return `<ul style="margin:0 0 14px;padding-left:20px">${block.list.map((item) => `<li style="margin:0 0 6px">${escapeHtml(item)}</li>`).join("")}</ul>`;
      return `<p style="margin:0 0 14px"><a href="${escapeHtml(block.link.href)}" style="color:#13254a;font-weight:600">${escapeHtml(block.link.label)}</a></p>`;
    })
    .join("");
  return `<div style="font-family:Arial,Helvetica,sans-serif;font-size:15px;line-height:22px;color:#0f172a;max-width:560px">${body}<p style="margin:0">David Moore<br>YPN USA</p>${footerHtml(enrollmentId)}</div>`;
}

// --- Enrolling and sending -----------------------------------------------------------------------

/**
 * Records the first time the series ran switched on, then enrolls every qualifying account
 * created after that moment. One enrollment per address, ever: an address that unsubscribed or
 * finished is never enrolled again.
 */
export function syncMloDripEnrollments(now: Date = new Date()): number {
  let added = 0;
  writeDb((db) => {
    if (!db.mloDrip.enabledAt) db.mloDrip.enabledAt = now.toISOString();
    const enabledAt = db.mloDrip.enabledAt;
    const known = new Set(db.mloDrip.enrollments.map((item) => item.email));
    for (const account of db.accounts) {
      const email = normalizeEmail(account.email);
      if (!email || known.has(email)) continue;
      if (account.role !== "mlo" || account.source !== "email_signup") continue;
      // Signed in through the emailed link at least once: the mailbox is theirs.
      if (!account.lastLoginAt) continue;
      if (account.createdAt < enabledAt) continue;
      db.mloDrip.enrollments.push({ id: `mdrip_${crypto.randomUUID()}`, email, enrolledAt: account.createdAt, sent: [], skipped: [], status: "active" });
      known.add(email);
      added += 1;
    }
  });
  return added;
}

/**
 * The step due now for an enrollment, or null. Steps too late to send are returned in `skip`
 * so the caller can record them.
 */
export function dueMloDripStep(enrollment: MloDripEnrollmentRecord, now: Date): { step: MloDripStepId | null; skip: MloDripStepId[]; finished: boolean } {
  const done = new Set<MloDripStepId>([...enrollment.sent.map((item) => item.step), ...enrollment.skipped]);
  const enrolled = Date.parse(enrollment.enrolledAt);
  const skip: MloDripStepId[] = [];
  for (const step of MLO_DRIP_STEPS) {
    if (done.has(step.id)) continue;
    const dueAt = enrolled + step.afterDays * DAY_MS;
    if (now.getTime() < dueAt) return { step: null, skip, finished: false };
    if (now.getTime() - dueAt > STALE_AFTER_DAYS * DAY_MS) {
      skip.push(step.id);
      continue;
    }
    return { step: step.id, skip, finished: false };
  }
  return { step: null, skip, finished: true };
}

export interface MloDripRunSummary {
  enabled: boolean;
  enrolled: number;
  sent: number;
  failed: number;
  skipped: number;
  converted: number;
  completed: number;
}

/** One pass: enroll new accounts, then send whatever is due. Safe to call every few minutes. */
export async function processMloDrip(options: { now?: Date; send?: typeof sendEmail } = {}): Promise<MloDripRunSummary> {
  const summary: MloDripRunSummary = { enabled: mloDripEnabled(), enrolled: 0, sent: 0, failed: 0, skipped: 0, converted: 0, completed: 0 };
  if (!summary.enabled) return summary;
  const now = options.now ?? new Date();
  const send = options.send ?? sendEmail;
  summary.enrolled = syncMloDripEnrollments(now);

  const active = readDb().mloDrip.enrollments.filter((item) => item.status === "active").map((item) => item.id);
  for (const id of active) {
    if (summary.sent + summary.failed >= MAX_SENDS_PER_RUN) break;
    const snapshot = readDb().mloDrip.enrollments.find((item) => item.id === id);
    if (!snapshot || snapshot.status !== "active") continue;

    // Paying or on a trial: the series is over for them.
    if (entitlementForEmail(snapshot.email).tier !== "free") {
      writeDb((db) => {
        const enrollment = db.mloDrip.enrollments.find((item) => item.id === id);
        if (enrollment && enrollment.status === "active") Object.assign(enrollment, { status: "converted", statusAt: now.toISOString() });
      });
      summary.converted += 1;
      continue;
    }

    // Decide and claim in one locked write, so two runs can never both send the same step.
    let claimed: MloDripStepId | null = null;
    writeDb((db) => {
      const enrollment = db.mloDrip.enrollments.find((item) => item.id === id);
      if (!enrollment || enrollment.status !== "active") return;
      if (enrollment.sending && now.getTime() - Date.parse(enrollment.sending.at) < CLAIM_TIMEOUT_MS) return;
      const due = dueMloDripStep(enrollment, now);
      if (due.skip.length > 0) {
        enrollment.skipped.push(...due.skip);
        summary.skipped += due.skip.length;
      }
      if (due.finished) {
        Object.assign(enrollment, { status: "completed", statusAt: now.toISOString() });
        delete enrollment.sending;
        summary.completed += 1;
        return;
      }
      if (!due.step) return;
      enrollment.sending = { step: due.step, at: now.toISOString() };
      claimed = due.step;
    });
    const step = claimed as MloDripStepId | null;
    if (!step) continue;

    const db = readDb();
    const onboarding = db.agentOnboarding.find((item) => normalizeEmail(item.email) === snapshot.email);
    const email = buildMloDripEmail(step, { zip: onboarding?.territoryZip });
    const result = await send({
      to: snapshot.email,
      subject: email.subject,
      html: renderMloDripEmail(email, id),
      replyTo: BUSINESS_EMAIL,
      headers: { "List-Unsubscribe": `<${mloDripOneClickUrl(id)}>`, "List-Unsubscribe-Post": "List-Unsubscribe=One-Click" },
    });

    writeDb((store) => {
      const enrollment = store.mloDrip.enrollments.find((item) => item.id === id);
      if (!enrollment) return;
      delete enrollment.sending;
      // Recorded as sent only when the provider accepted it. A failure is tried again on a later
      // run, until the step goes stale and is skipped.
      if (result.sent && !enrollment.sent.some((item) => item.step === step)) enrollment.sent.push({ step, at: now.toISOString() });
    });
    if (result.sent) summary.sent += 1;
    else summary.failed += 1;
  }
  return summary;
}
