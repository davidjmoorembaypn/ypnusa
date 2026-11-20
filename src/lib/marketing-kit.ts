import { randomUUID } from "node:crypto";
import { withMarketingDisclosures, type ComplianceOfficer } from "@/lib/compliance/guardrails";
import { checkMarketingCompliance } from "@/lib/ai/marketing-compliance";
import { getAiProvider, type AiProvider } from "@/lib/ai/provider";
import type { Entitlement } from "@/lib/entitlements";
import { isPaidEntitlement } from "@/lib/entitlements";
import { officerPagePath, officerShortId, type PublicOfficerPage } from "@/lib/officer-profile";
import { MARKETING_SITE_URL } from "@/lib/site";
import type { LinkedInArticleRecord, OfficerProfileRecord } from "@/lib/types";

/**
 * Marketing kit for loan officers:
 *
 * 1. The "Powered by YPN USA" website badge. One copy-paste HTML block the officer puts in
 *    their own website's footer. It is plain HTML (an image and two links), so it works in
 *    WordPress, Wix and Squarespace HTML boxes with no script. Both links are in the
 *    officer's own page, which is what makes them count as links to ypnus.com. The link
 *    text is the brand name and the officer's own name only, never keywords: keyword
 *    anchors in a widget are what Google treats as a link scheme.
 *
 * 2. LinkedIn article drafts. Cerebro writes a short article in the officer's voice; the
 *    officer posts it from their own LinkedIn profile (we never post for them). The server
 *    checks the draft for advertising trigger terms and adds the officer's NMLS ID,
 *    company NMLS ID, license lines and Equal Housing line itself.
 */

// ---------------------------------------------------------------------------
// Website badge
// ---------------------------------------------------------------------------

export const BADGE_WIDTH = 320;
export const BADGE_HEIGHT = 100;

export function badgeImageUrl(userId: string): string {
  return `${MARKETING_SITE_URL}/api/badge/${officerShortId(userId)}`;
}

/** Where the badge sends a visitor: the officer's borrower page when it's live, otherwise ypnus.com. */
export function badgeTargetUrl(page: Pick<PublicOfficerPage, "slug"> | null): string {
  return page ? `${MARKETING_SITE_URL}${officerPagePath(page.slug)}` : `${MARKETING_SITE_URL}/`;
}

function escapeAttr(value: string): string {
  return value.replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

/** The badge's alt text: the officer's name and NMLS ID, which is also the image link's text. */
export function badgeAltText(profile: Pick<OfficerProfileRecord, "fullName" | "nmlsId"> | null | undefined): string {
  if (profile?.fullName && profile.nmlsId) {
    return `${profile.fullName}, NMLS #${profile.nmlsId}: chat with Cerebro 24/7`;
  }
  return "Chat with Cerebro 24/7";
}

/** The HTML block the officer copies into their website footer. */
export function badgeSnippet(input: {
  userId: string;
  profile?: Pick<OfficerProfileRecord, "fullName" | "nmlsId"> | null;
  page: Pick<PublicOfficerPage, "slug"> | null;
}): string {
  const target = escapeAttr(badgeTargetUrl(input.page));
  const image = escapeAttr(badgeImageUrl(input.userId));
  const alt = escapeAttr(badgeAltText(input.profile));
  const home = escapeAttr(`${MARKETING_SITE_URL}/`);
  return [
    "<!-- YPN USA badge: paste into your website footer -->",
    `<div style="max-width:${BADGE_WIDTH}px;font-family:Arial,sans-serif;line-height:1.4">`,
    `<a href="${target}" target="_blank" rel="noopener"><img src="${image}" alt="${alt}" width="${BADGE_WIDTH}" height="${BADGE_HEIGHT}" style="display:block;border:0;max-width:100%;height:auto" loading="lazy"></a>`,
    `<a href="${home}" target="_blank" rel="noopener" style="font-size:12px;color:#555">Powered by YPN USA</a>`,
    "</div>",
  ].join("\n");
}

function escapeXml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function clip(value: string, max: number): string {
  return value.length > max ? `${value.slice(0, max - 1).trimEnd()}…` : value;
}

/**
 * The badge picture. Shows the officer's name and NMLS ID, their ZIP code when one is
 * locked to them, and a "Chat with Cerebro 24/7" button. Without a profile it shows a
 * plain Cerebro badge.
 */
export function badgeSvg(input: {
  profile?: Pick<OfficerProfileRecord, "fullName" | "nmlsId"> | null;
  zip?: string;
}): string {
  const name = input.profile?.fullName ? clip(input.profile.fullName, 30) : "Mortgage questions?";
  const sub = input.profile?.nmlsId
    ? input.zip
      ? `NMLS #${input.profile.nmlsId} · Local loan officer, ZIP ${input.zip}`
      : `NMLS #${input.profile.nmlsId} · Mortgage loan officer`
    : "Get answers any time, day or night";
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${BADGE_WIDTH}" height="${BADGE_HEIGHT}" viewBox="0 0 ${BADGE_WIDTH} ${BADGE_HEIGHT}" role="img" aria-label="${escapeXml(name)}">
<rect x="0.5" y="0.5" width="${BADGE_WIDTH - 1}" height="${BADGE_HEIGHT - 1}" rx="14" fill="#17152f" stroke="#6d28d9"/>
<circle cx="30" cy="34" r="14" fill="#7c3aed"/>
<text x="30" y="38" text-anchor="middle" font-family="Arial,Helvetica,sans-serif" font-size="10" font-weight="700" fill="#ffffff">YPN</text>
<text x="54" y="31" font-family="Arial,Helvetica,sans-serif" font-size="15" font-weight="700" fill="#ffffff">${escapeXml(name)}</text>
<text x="54" y="48" font-family="Arial,Helvetica,sans-serif" font-size="11" fill="#c4b5fd">${escapeXml(clip(sub, 46))}</text>
<rect x="16" y="62" width="${BADGE_WIDTH - 32}" height="26" rx="13" fill="#7c3aed"/>
<text x="${BADGE_WIDTH / 2}" y="79" text-anchor="middle" font-family="Arial,Helvetica,sans-serif" font-size="13" font-weight="700" fill="#ffffff">Chat with Cerebro 24/7 →</text>
</svg>`;
}

const OWN_HOSTS = new Set(["ypnus.com", "www.ypnus.com", "app.ypnus.com", "localhost", "127.0.0.1"]);

/** The outside website showing the badge, from the image request's Referer. Null for our own hosts or no Referer. */
export function badgeHostFromReferer(referer: string | null | undefined): string | null {
  if (!referer) return null;
  try {
    const url = new URL(referer);
    if (url.protocol !== "https:" && url.protocol !== "http:") return null;
    const host = url.hostname.toLowerCase();
    if (!host || host.length > 253 || OWN_HOSTS.has(host) || host.endsWith(".ypnus.com")) return null;
    return host;
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// LinkedIn article allowance
// ---------------------------------------------------------------------------

export interface ArticleAllowance {
  /** Articles allowed per calendar month, or null when the allowance is a one-time total. */
  perMonth: number | null;
  /** One-time total (the Pro plan's starter article), or null. */
  total: number | null;
  /** Plain words for the dashboard: "1 article a month". */
  label: string;
}

/**
 * Plan ids are internal: "growth" is the $99 Pro plan, "pro" is the $199 Growth plan and
 * "elite" is the $299 Exclusive plan (see src/lib/pricing.ts).
 */
export function linkedinAllowance(entitlement: Entitlement, isAdmin = false): ArticleAllowance {
  if (isAdmin) return { perMonth: 2, total: null, label: "2 articles a month" };
  if (!isPaidEntitlement(entitlement)) return { perMonth: 0, total: null, label: "Included with Pro and up" };
  switch (entitlement.tier) {
    case "elite":
      return { perMonth: 2, total: null, label: "2 articles a month" };
    case "pro":
      return { perMonth: 1, total: null, label: "1 article a month" };
    case "growth":
      return { perMonth: null, total: 1, label: "1 starter article (Growth and Exclusive get more each month)" };
    default:
      return { perMonth: 0, total: null, label: "Included with Pro and up" };
  }
}

export function monthKey(now: Date): string {
  return now.toISOString().slice(0, 7);
}

/** How many more articles the officer can draft right now. */
export function articlesLeft(allowance: ArticleAllowance, existing: LinkedInArticleRecord[], now: Date): number {
  if (allowance.total !== null) return Math.max(0, allowance.total - existing.length);
  const used = existing.filter((article) => article.month === monthKey(now)).length;
  return Math.max(0, (allowance.perMonth ?? 0) - used);
}

// ---------------------------------------------------------------------------
// LinkedIn article drafting
// ---------------------------------------------------------------------------

interface Topic {
  title: (zip?: string) => string;
  brief: string;
  template: (zip?: string) => string[];
}

const where = (zip?: string) => (zip ? `in ZIP code ${zip}` : "in our area");

/** Rotated by month so an officer's articles don't repeat. Nothing here quotes a rate, payment or approval. */
const TOPICS: Topic[] = [
  {
    title: (zip) => `What I tell every first-time buyer ${where(zip)}`,
    brief: "The questions a first-time homebuyer should ask before applying, and the documents to gather.",
    template: (zip) => [
      `Most of the first-time buyers I talk with ${where(zip)} have the same worry: they don't know where to start. So here is what I tell every one of them.`,
      "First, get clear on your monthly comfort zone before you look at a single listing. The right home is one that still lets you live your life.",
      "Second, gather your paperwork early: recent pay stubs, two years of W-2s or tax returns, and your last two bank statements. Having these ready makes the whole process calmer.",
      "Third, talk to a loan officer before you talk to a seller. A conversation about your goals, your credit and your savings shows you which loan programs fit, and what to work on if you're not quite ready yet.",
      "Buying your first home is a big step, and nobody should take it alone. If you're thinking about it this year, I'm happy to walk you through it.",
    ],
  },
  {
    title: (zip) => `Self-employed? Here's how buying a home really works ${where(zip)}`,
    brief: "How self-employed borrowers and business owners can prepare for a mortgage application.",
    template: (zip) => [
      `I work with a lot of business owners and self-employed borrowers ${where(zip)}. Many of them assume a mortgage is out of reach because their income doesn't fit on a W-2. That's often not true.`,
      "There are loan programs built for people who work for themselves, including options that look at bank statements instead of tax returns. Each has its own rules, so the right fit depends on your situation.",
      "What helps most: keep business and personal accounts separate, keep clean records, and talk to a loan officer a few months before you want to buy, not a few days.",
      "If you run your own business and you've wondered whether owning a home is possible, let's talk it through.",
    ],
  },
  {
    title: () => "Five things that slow down a mortgage (and how to avoid them)",
    brief: "Common delays in the mortgage process and simple ways borrowers can avoid them.",
    template: () => [
      "Most delays in a home loan are avoidable. Here are the five I see most often.",
      "1. Opening new credit cards or financing furniture before closing. Wait until you have the keys.",
      "2. Large deposits nobody can explain. Keep a record of where money comes from.",
      "3. Changing jobs mid-process. If a change is coming, tell your loan officer right away.",
      "4. Slow replies to document requests. A quick answer keeps everything moving.",
      "5. Waiting until the last minute to shop for homeowners insurance.",
      "A little planning goes a long way. If you're getting ready to buy or refinance, I'm glad to help you build a plan.",
    ],
  },
  {
    title: (zip) => `Thinking about refinancing ${where(zip)}? Start with your goal`,
    brief: "How homeowners can decide whether refinancing fits their goals, without quoting any rates.",
    template: (zip) => [
      `Homeowners ${where(zip)} ask me about refinancing all the time. My first question back is always the same: what are you hoping to change?`,
      "Some people want a lower monthly payment. Some want to pay the home off sooner. Others want to use their equity for a renovation, college costs or to consolidate debt.",
      "Each goal points to a different kind of loan, and each comes with closing costs to weigh against the benefit. The right answer depends on how long you plan to stay in the home.",
      "If you've been wondering whether a refinance makes sense for you, let's look at your goal together and run the numbers honestly.",
    ],
  },
];

export function topicForMonth(now: Date, offset = 0): Topic {
  const index = (now.getUTCFullYear() * 12 + now.getUTCMonth() + offset) % TOPICS.length;
  return TOPICS[index];
}

export function complianceOfficerFromProfile(profile: OfficerProfileRecord): ComplianceOfficer {
  return {
    name: profile.fullName,
    nmlsId: profile.nmlsId,
    company: profile.company,
    companyNmlsId: profile.companyNmlsId,
    licenses: profile.licenses,
    equalHousing: profile.equalHousing,
  };
}

function articleSystemPrompt(profile: OfficerProfileRecord, zip: string | undefined, topic: Topic, title: string): string {
  return [
    "You write LinkedIn articles for a US mortgage loan officer, in their own voice (first person).",
    `The officer is ${profile.fullName}${profile.company ? ` at ${profile.company}` : ""}, serving ${zip ? `ZIP code ${zip}` : "their local area"}.`,
    `Topic: ${topic.brief}`,
    `Use this title or a close variation: "${title}".`,
    "Write 350 to 550 words in short paragraphs, warm and practical, for local homebuyers and homeowners.",
    "Rules you must follow:",
    "- No interest rates, APR, percentages, payment amounts or down-payment amounts.",
    "- No guarantees, approval promises, closing-time promises, 'best/lowest rate' claims or false urgency.",
    "- Do not invent years of experience, loan counts, client counts or reviews.",
    "- Do not write any NMLS number, phone number, email address or link. The system adds the officer's contact and license lines.",
    "- Plain text only: no markdown, no hashtags, no emoji.",
    "Reply in exactly this format: the first line is 'TITLE: ' followed by the title, then a blank line, then the article.",
  ].join("\n");
}

function parseDraft(text: string): { title: string; body: string } | null {
  const trimmed = text.trim();
  const match = /^TITLE:\s*(.+)\n+([\s\S]+)$/i.exec(trimmed);
  if (!match) return null;
  const title = match[1].trim().replace(/^["']|["']$/g, "").slice(0, 150);
  const body = match[2].replace(/[*#_`]+/g, "").trim();
  if (title.length < 5 || body.length < 300) return null;
  return { title, body };
}

/** Adds the call to action with the borrower page link and the officer's disclosures. */
export function finishArticle(
  body: string,
  profile: OfficerProfileRecord,
  page: Pick<PublicOfficerPage, "slug"> | null,
  zip?: string,
): string {
  const cta = `Have a question about buying or refinancing ${zip ? `near ${zip}` : "a home"}? You can chat with me any time, day or night: ${badgeTargetUrl(page)}`;
  return withMarketingDisclosures(`${body.trimEnd()}\n\n${cta}`, complianceOfficerFromProfile(profile), "social_caption").text;
}

export interface DraftedArticle {
  title: string;
  body: string;
  source: LinkedInArticleRecord["source"];
}

/**
 * Drafts an article. Cerebro writes it when an AI provider is set up; a draft that breaks a
 * compliance rule goes back once with the list of problems, and if it still fails (or no
 * provider is available) the officer gets the hand-written article for the month's topic.
 */
export async function draftLinkedInArticle(input: {
  profile: OfficerProfileRecord;
  page: Pick<PublicOfficerPage, "slug"> | null;
  zip?: string;
  now?: Date;
  /** Which of this month's articles this is (0 for the first), so a second one gets another topic. */
  indexThisMonth?: number;
  provider?: AiProvider | null;
}): Promise<DraftedArticle> {
  const now = input.now ?? new Date();
  const topic = topicForMonth(now, input.indexThisMonth ?? 0);
  const title = topic.title(input.zip);
  const provider = input.provider === undefined ? getAiProvider() : input.provider;

  if (provider) {
    const system = articleSystemPrompt(input.profile, input.zip, topic, title);
    let request = "Write the article.";
    for (let attempt = 0; attempt < 2; attempt += 1) {
      try {
        const result = await provider.generate({
          system,
          messages: [{ role: "user", content: request }],
          maxTokens: 1500,
          timeoutMs: 45_000,
          toolChoice: "none",
        });
        const draft = parseDraft(result.text);
        if (!draft) {
          request = "Your reply was not in the required format. Start with 'TITLE: ', then a blank line, then the article of 350 to 550 words.";
          continue;
        }
        const problems = checkMarketingCompliance({ fields: { title: draft.title, article: draft.body }, nmlsId: input.profile.nmlsId });
        if (problems.length === 0) {
          return { title: draft.title, body: finishArticle(draft.body, input.profile, input.page, input.zip), source: "ai" };
        }
        request = `Rewrite the article and fix these problems:\n- ${problems.join("\n- ")}`;
      } catch (error) {
        console.error("[marketing-kit] LinkedIn article draft failed", error);
        break;
      }
    }
  }

  return {
    title,
    body: finishArticle(topic.template(input.zip).join("\n\n"), input.profile, input.page, input.zip),
    source: "template",
  };
}

export function newArticleRecord(draft: DraftedArticle, now: Date): LinkedInArticleRecord {
  return {
    id: `li_${randomUUID()}`,
    month: monthKey(now),
    title: draft.title,
    body: draft.body,
    source: draft.source,
    createdAt: now.toISOString(),
  };
}

/** LinkedIn's "Write article" page. The officer pastes the copied article there. */
export const LINKEDIN_NEW_ARTICLE_URL = "https://www.linkedin.com/article/new/";
