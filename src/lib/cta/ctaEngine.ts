import type { Pattern } from "@/lib/agents/contentAgent";
import type { FunnelOutput } from "@/lib/content/funnelBuilder";
import type { PersonalizationSummary } from "@/lib/personalization/personalizationEngine";

/**
 * Composes ZIP/territory state, an optional content Pattern, an optional
 * FunnelOutput, and optional personalization into one CTA set. Pure/
 * synchronous — no I/O — so it can run client-side or server-side.
 */

export interface CtaContext {
  zip?: string;
  county?: string;
  available?: boolean;
  demandTotal?: number;
  pattern?: Pattern;
  funnel?: FunnelOutput;
  personalization?: PersonalizationSummary;
}

export interface CtaEntry {
  label: string;
  href?: string;
}

export interface CtaSet {
  /** The ZIP code this set was built for, or null. A set must only be shown for this ZIP code. */
  zip: string | null;
  /** The demand line inside microNudges, if any, so a screen that already shows demand can skip it. */
  demandNudge: string | null;
  primary: CtaEntry;
  secondary: CtaEntry;
  microNudges: string[];
  socialShare: CtaEntry;
  dashboard: CtaEntry;
}

function primaryCta(context: CtaContext): CtaEntry {
  const funnelCta = context.funnel?.ctaBlocks[0];
  if (funnelCta) return { label: funnelCta.label, href: funnelCta.url };
  if (context.available === false) return { label: "Join the waitlist" };
  if (context.zip) return { label: `Lock ZIP code ${context.zip}` };
  return { label: "Get your free borrower profile" };
}

function secondaryCta(context: CtaContext): CtaEntry {
  if (context.personalization?.rentalDemandTeaser) return { label: "See your rental demand score" };
  return { label: "Unlock your remodel ROI report" };
}

function demandNudge(context: CtaContext): string | null {
  if (typeof context.demandTotal !== "number" || !(context.demandTotal > 0)) return null;
  return `About ${context.demandTotal} households buy, sell or move into this ZIP code in a typical 60 days (Census-based estimate).`;
}

function microNudges(context: CtaContext): string[] {
  const nudges: string[] = [];
  const demand = demandNudge(context);
  if (demand) nudges.push(demand);
  if (context.pattern?.offers[0]) nudges.push(context.pattern.offers[0]);
  if (context.personalization?.whyThisMattersForYou) nudges.push(context.personalization.whyThisMattersForYou);
  nudges.push("Almost there — questions are normal, ask us anything.");
  return nudges;
}

function socialShareCta(context: CtaContext): CtaEntry {
  const post = context.funnel?.socialPosts[0];
  if (post) return { label: `Share: ${post.headline}` };
  return { label: "Share your borrower page" };
}

function dashboardCta(): CtaEntry {
  return { label: "Go to your dashboard", href: "/dashboard" };
}

export function buildCtaSet(context: CtaContext): CtaSet {
  return {
    zip: context.zip && /^\d{5}$/.test(context.zip) ? context.zip : null,
    demandNudge: demandNudge(context),
    primary: primaryCta(context),
    secondary: secondaryCta(context),
    microNudges: microNudges(context),
    socialShare: socialShareCta(context),
    dashboard: dashboardCta(),
  };
}

/**
 * The CTA set to show for `activeZip`, or null. A set built for another ZIP code (an earlier lookup,
 * or a slow response that arrived late) is never shown: its nudges describe the wrong place.
 */
export function ctaForZip(set: CtaSet | null | undefined, activeZip: string | null | undefined): CtaSet | null {
  if (!set || !activeZip) return null;
  return set.zip === activeZip ? set : null;
}

/** Nudges for a screen that already shows the demand figure itself: everything except the demand line. */
export function nudgesWithoutDemand(set: CtaSet): string[] {
  return set.microNudges.filter((nudge) => nudge !== set.demandNudge);
}
