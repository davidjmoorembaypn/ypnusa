import { BUSINESS_EMAIL } from "@/lib/author";
import { CUSTOMER_PORTAL_URL, marketingUrl } from "@/lib/site";
import type { AiToolDefinition } from "./provider";

/**
 * Cerebro's two answer books, served as tools so the model answers from checked text instead
 * of memory:
 * - platform_help: how YPN USA works, for loan officers (signed in, or shopping on the site).
 * - mortgage_guide: general home-loan education for borrowers. No rates, payments,
 *   percentages or dollar amounts (advertising trigger terms), no advice for one person's
 *   situation: each topic ends by handing that part to the loan officer.
 *
 * Plain data, no I/O. Prices and plan contents come from get_pricing, not from here, so there is
 * one source for them.
 */

export interface KnowledgeTopic {
  id: string;
  title: string;
  /** Words people use when asking about it. */
  keywords: string[];
  answer: string;
  /** A page on ypnus.com to point to, when there is one. */
  link?: string;
}

export const PLATFORM_HELP: KnowledgeTopic[] = [
  {
    id: "what_is_ypn",
    title: "What YPN USA is",
    keywords: ["what is", "how does it work", "ypn", "platform", "cerebro", "what do i get"],
    answer:
      "YPN USA gives mortgage loan officers borrower leads from the ZIP codes they hold, plus Cerebro, an AI assistant that answers borrowers on ypnus.com, qualifies them, routes them to the officer for that ZIP code, and handles follow-up email. Officers also get a public profile page and marketing drafts (bio, Google Business Profile, posts, emails).",
  },
  {
    id: "plans",
    title: "Plans and prices",
    keywords: ["price", "cost", "plan", "pro", "growth", "exclusive", "free", "upgrade", "downgrade", "trial", "prepaid"],
    answer:
      "Call get_pricing for the current plans, what each includes, the 15-day trial, pay-now and 5-year prepaid options. Quote only what it returns.",
    link: "/pricing",
  },
  {
    id: "zip_codes",
    title: "ZIP code exclusivity",
    keywords: ["zip", "territory", "exclusive", "lock", "lockout", "area", "claim", "who owns"],
    answer:
      "Each ZIP code goes to one loan officer. It locks only when their first payment goes through; a free account or a trial never reserves it, so whoever pays first gets it. Borrowers who ask for help in a ZIP code you hold are routed to you. Call check_territory_availability for any ZIP code.",
    link: "/check-zip",
  },
  {
    id: "setup",
    title: "Getting set up",
    keywords: ["set up", "setup", "onboarding", "profile", "nmls", "license", "photo", "start", "get started", "page"],
    answer:
      "Finish the setup steps at /onboarding: your name, company, NMLS ID, the states you're licensed in (and your California DRE or CFL license if you have one), your photo. Your public page then goes live at ypnus.com/lo/your-name. Without your NMLS ID and licensed states, Cerebro can't send borrower emails for you on its own.",
    link: "/onboarding",
  },
  {
    id: "leads",
    title: "How leads reach you",
    keywords: ["lead", "leads", "borrower", "routing", "how many", "where do leads come from", "pipeline"],
    answer:
      "Borrowers talk to Cerebro on ypnus.com. Cerebro asks what they want (buy, refinance), their ZIP code and how to reach them, and needs their OK before anyone contacts them. Leads in your ZIP codes come to you with a quality score, urgency and a suggested next step. Ask Cerebro \"show my pipeline\" to see yours.",
    link: "/dashboard",
  },
  {
    id: "follow_ups",
    title: "Borrower follow-up (live or approve first)",
    keywords: ["follow up", "follow-up", "email", "auto", "reply", "live", "approve", "sends", "talk to customers", "busy", "nudge", "rate alert"],
    answer:
      "In live mode (the default), Cerebro emails your borrowers check-ins, first replies and rate alerts on its own, as your AI assistant, only to borrowers who agreed to be contacted and only when every compliance check passes; replies come to your email. Prequal letters, callbacks, texts and calls always wait for you. Say \"approve first\" to have Cerebro hold every email for your OK, or \"go live\" to switch back.",
  },
  {
    id: "compliance",
    title: "Compliance and disclosures",
    keywords: ["compliance", "disclosure", "respa", "nmls", "equal housing", "dre", "legal", "tcpa", "opt out", "unsubscribe"],
    answer:
      "Every message Cerebro sends or drafts for you carries your name and NMLS ID, your company's NMLS ID, state lines such as your California DRE number, and Equal Housing wording. It quotes no rates or payments, makes no approval promises, and won't email a borrower in a state you aren't licensed in. Borrowers can unsubscribe from any email. YPN USA pays no referral fees. You remain responsible for your own advertising; this is not legal advice.",
    link: "/licensing-disclosures",
  },
  {
    id: "billing",
    title: "Billing, receipts and cancelling",
    keywords: ["billing", "invoice", "receipt", "card", "cancel", "refund", "payment method", "subscription"],
    answer:
      `Manage your card, receipts or cancel any time in the billing portal (${CUSTOMER_PORTAL_URL}). The 5-year prepaid plan is fully refundable within 30 days of purchase and not after; a refund releases the ZIP code. For anything else, email ${BUSINESS_EMAIL}.`,
    link: "/billing",
  },
  {
    id: "website",
    title: "Your page and website help",
    keywords: ["website", "seo", "google", "page", "landing page", "blog", "google business profile", "gbp", "marketing"],
    answer:
      "Cerebro drafts your bio, Google Business Profile text and posts, blog posts and landing pages, and suggests fixes to your page. Drafts wait for your approval; nothing is published or posted for you without it.",
  },
  {
    id: "support",
    title: "Getting help",
    keywords: ["help", "support", "contact", "human", "bug", "problem", "not working", "error"],
    answer: `Email ${BUSINESS_EMAIL} and a person at YPN USA will answer.`,
  },
];

export const MORTGAGE_GUIDE: KnowledgeTopic[] = [
  {
    id: "process",
    title: "How getting a mortgage works",
    keywords: ["process", "steps", "how does", "how long", "start", "first step", "timeline"],
    answer:
      "The usual path: talk to a loan officer about your goals, get prequalified (a quick estimate) or preapproved (your income, assets and credit are checked), shop for a home or decide on a refinance, apply, then the lender orders an appraisal and underwriting reviews your file before closing, where you sign and get the keys or the new loan. How long each step takes depends on the loan and the people involved; your loan officer can give you a timeline for your case.",
  },
  {
    id: "prequal_vs_preapproval",
    title: "Prequalified vs preapproved",
    keywords: ["prequal", "prequalified", "pre-qualified", "preapproval", "pre-approval", "preapproved", "letter"],
    answer:
      "A prequalification is an early estimate based on what you tell the loan officer. A preapproval goes further: the lender checks your credit and documents, so sellers usually take it more seriously. Neither is a promise to lend; the final approval comes after underwriting and the appraisal. Your loan officer decides what letter they can issue for you.",
  },
  {
    id: "loan_types",
    title: "Common loan types",
    keywords: ["fha", "va", "usda", "conventional", "jumbo", "loan type", "program", "which loan", "first-time", "first time"],
    answer:
      "Conventional loans follow Fannie Mae and Freddie Mac rules. FHA loans are insured by the government and are often used by first-time buyers. VA loans are for eligible veterans, service members and some surviving spouses. USDA loans are for eligible homes in rural and some suburban areas. Jumbo loans are for amounts above the conforming limit. Which fits you depends on your situation, so your loan officer will compare them with you.",
  },
  {
    id: "documents",
    title: "Documents you'll usually need",
    keywords: ["documents", "paperwork", "what do i need", "pay stubs", "w2", "tax returns", "bank statements", "self-employed"],
    answer:
      "Lenders usually ask for photo ID, recent pay stubs, W-2s or tax returns (more years of returns if you're self-employed), recent bank statements, and details of any debts. Your loan officer will give you the exact list for your loan. Never send documents or your Social Security number through this chat.",
  },
  {
    id: "credit",
    title: "Credit and your mortgage",
    keywords: ["credit", "score", "credit check", "bad credit", "improve credit", "hard pull", "soft pull"],
    answer:
      "Your credit history affects which loans you can get and the terms offered. Paying bills on time, keeping card balances low and not opening new credit before you close all help. Checking with a loan officer early lets them tell you where you stand. Cerebro can't review your credit or give credit advice; your loan officer can.",
  },
  {
    id: "down_payment",
    title: "Down payment and closing costs",
    keywords: ["down payment", "closing costs", "how much", "assistance", "dpa", "gift", "cash to close", "save"],
    answer:
      "Some loan programs allow a small down payment, and some areas have down payment assistance programs. Closing costs are separate from the down payment and can include lender, title, escrow and government fees. Gifts from family are often allowed with the right paperwork. The amounts depend on your loan and location, so ask your loan officer for an estimate.",
  },
  {
    id: "rates",
    title: "Interest rates",
    keywords: ["rate", "rates", "interest", "apr", "lock", "rate lock", "points", "today's rate", "current rate"],
    answer:
      "Rates change daily and depend on the loan type, your credit, the down payment, the property and the market. A rate lock holds a quoted rate for a set time while your loan closes. Cerebro can't quote rates; your loan officer can give you a current quote for your situation. You can also sign up for rate alerts here.",
  },
  {
    id: "refinance",
    title: "Refinancing",
    keywords: ["refinance", "refi", "cash out", "cash-out", "lower payment", "lower my rate", "remove pmi", "streamline"],
    answer:
      "Refinancing replaces your current mortgage with a new one, for example to change the rate or term, take cash out of your equity, or move from one loan type to another. Whether it makes sense depends on your current loan, your plans and the costs of the new loan. Your loan officer can run the comparison with you.",
  },
  {
    id: "costs_and_insurance",
    title: "What's in a monthly payment",
    keywords: ["payment", "monthly", "escrow", "taxes", "insurance", "pmi", "mip", "hoa"],
    answer:
      "A monthly mortgage payment usually includes principal and interest, and often property taxes and homeowners insurance held in escrow. Some loans add mortgage insurance, and some homes have HOA dues paid separately. Your loan officer can estimate the payment for a specific home and loan.",
  },
];

function score(topic: KnowledgeTopic, question: string): number {
  const q = question.toLowerCase();
  let points = 0;
  for (const keyword of topic.keywords) if (q.includes(keyword)) points += keyword.includes(" ") ? 3 : 2;
  for (const word of topic.title.toLowerCase().split(/\W+/)) if (word.length > 3 && q.includes(word)) points += 1;
  return points;
}

/** The best-matching topics (up to 3); every topic title when nothing matches, so the model can pick. */
export function lookUp(book: KnowledgeTopic[], question: string): { topics: Array<Omit<KnowledgeTopic, "keywords">>; otherTopics: string[] } {
  const ranked = book
    .map((topic) => ({ topic, points: score(topic, question) }))
    .filter((item) => item.points > 0)
    .sort((a, b) => b.points - a.points)
    .slice(0, 3)
    .map((item) => item.topic);
  const shown = new Set(ranked.map((topic) => topic.id));
  return {
    topics: ranked.map(({ keywords: _keywords, link, ...rest }) => ({ ...rest, ...(link ? { link: marketingUrl(link) } : {}) })),
    otherTopics: book.filter((topic) => !shown.has(topic.id)).map((topic) => topic.title),
  };
}

export const PLATFORM_HELP_TOOL: AiToolDefinition = {
  name: "platform_help",
  description:
    "Look up how YPN USA works for loan officers: what it is, plans, ZIP code exclusivity, setup, how leads arrive, Cerebro's borrower follow-up, compliance, billing and cancelling, website help, support. Call for any how-does-it-work question from a loan officer and answer from what it returns.",
  inputSchema: {
    type: "object",
    properties: { question: { type: "string", description: "The officer's question in their words." } },
    required: ["question"],
    additionalProperties: false,
  },
};

export const MORTGAGE_GUIDE_TOOL: AiToolDefinition = {
  name: "mortgage_guide",
  description:
    "Look up general home-loan education for a borrower: the mortgage process, prequal vs preapproval, loan types, documents, credit, down payment and closing costs, rates, refinancing, what's in a payment. Call for any general mortgage question from a borrower and answer from what it returns, in plain words. It never covers one person's numbers: hand those to the loan officer.",
  inputSchema: {
    type: "object",
    properties: { question: { type: "string", description: "The borrower's question in their words." } },
    required: ["question"],
    additionalProperties: false,
  },
};

export function executeKnowledgeTool(toolName: string, question: unknown): string {
  const text = typeof question === "string" ? question.slice(0, 500) : "";
  if (toolName === "platform_help") {
    return JSON.stringify({ ...lookUp(PLATFORM_HELP, text), note: "Answer briefly from these topics. If none fits, say you'll pass it to the YPN USA team at support@ypnus.com." });
  }
  return JSON.stringify({
    ...lookUp(MORTGAGE_GUIDE, text),
    note: "General education only. No rates, payments, percentages or dollar amounts, and no advice for their own case: offer to connect them with a loan officer (request_callback) for that.",
  });
}
