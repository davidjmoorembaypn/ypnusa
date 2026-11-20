/**
 * What Cerebro does, as stated on /cerebro. One source for the page and for the MCP server
 * (src/lib/mcp/server.ts), so the two can't describe different products.
 */

/** Only what Cerebro does today. Anything not live yet belongs in COMING_SOON. */
export const CEREBRO_TODAY: Array<[string, string]> = [
  [
    "Answers borrowers 24/7",
    "On your site, under your brand, Cerebro explains programs and next steps in plain language at any hour, so a 9 PM question gets an answer at 9 PM.",
  ],
  [
    "Qualifies and hands off",
    "It asks what you would ask: purchase or refinance, timeline, price range, area and how to reach them, with consent. Ready borrowers go to you with a summary.",
  ],
  [
    "Looks up live data",
    "It checks live ZIP code availability and quotes YPN USA plans from the current price list instead of guessing.",
  ],
  [
    "Records every conversation",
    "What the borrower said is saved to your account, so your first call starts where the conversation left off, not from zero.",
  ],
  [
    "Builds your growth plan",
    "Tell it your market and your biggest challenge, and it maps out next steps for your ZIP code.",
  ],
  [
    "Drafts your marketing",
    "Local social posts, Google Business Profile updates and Realtor co-marketing copy, written for you to review and edit before anything goes out.",
  ],
];

export const CEREBRO_HANDOFF_STEPS: Array<[string, string]> = [
  ["A borrower asks a question", "On your page or website, at any hour. Cerebro answers right away."],
  ["Cerebro qualifies the inquiry", "Goal, timeline, price range, area and contact details, with the borrower's consent."],
  ["You get the hand-off", "The borrower and a summary of the conversation are routed to you, the licensed loan officer, never to another lender."],
  ["You take it from there", "Every application, rate and credit decision is yours. Cerebro's job ends where licensed advice begins."],
];

export const CEREBRO_DASHBOARD: Array<[string, string]> = [
  ["Growth plan", "A plan for your ZIP code, built from what you tell Cerebro about your market and goals."],
  ["Pipeline", "Who reached out, what they asked and who needs a call today, with follow-up drafted for your review."],
  ["Marketing drafts", "Posts and profile updates ready to edit and publish, so you're never starting from a blank page."],
];

export const CEREBRO_NEVER = [
  "Offer or lock rates. It can explain how programs work, but it never presents a rate as an offer.",
  "Make credit decisions. Qualifying questions help you prepare; approval is always a licensed decision.",
  "Give legal or tax advice. It points borrowers to you or a qualified professional instead.",
  "Keep a borrower from you. Every conversation is handed to you, the licensed loan officer.",
];

export const CEREBRO_COMING_SOON: Array<[string, string]> = [
  ["Done-for-you Google profile setup", "Cerebro setting up and filling in your Google Business Profile for you."],
  ["Local Visibility Score", "A simple score for how visible you are in local search in your ZIP code, with what to fix first."],
  ["Multi-task agentic mode", "Cerebro working through several tasks in a row on its own, with you approving each result."],
];
