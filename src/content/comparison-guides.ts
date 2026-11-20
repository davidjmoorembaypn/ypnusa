/**
 * "Best X" and "X alternatives" guides for loan officers, rendered by
 * src/components/comparison-guide/comparison-guide-page.tsx.
 *
 * Rules (see comparison-guides.test.ts):
 * - Every fact about another company comes from that company's own website (or a named trade
 *   outlet), read on the `checked` date of the source listed under the option. Paraphrase; no
 *   invented stats, awards, customer counts or results for anyone, YPN USA included.
 * - YPN USA facts match the live /pricing, /features and /cerebro pages.
 * - User-facing text says "ZIP code" and uses no em or en dashes.
 */

export interface GuideSource {
  label: string;
  url: string;
  /** YYYY-MM-DD the page was read. */
  checked: string;
}

export interface GuideOption {
  id: string;
  name: string;
  /** Name for the trademark notice when it differs from `name`. */
  trademarkName?: string;
  /** Official site (absolute) or a ypnus.com path. */
  website: string;
  category: string;
  summary: string;
  bestFor: string;
  notFor: string;
  highlights: string[];
  pricing: string;
  /** Cells for the comparison table, keyed by ComparisonGuide.columns[].key. */
  table: Record<string, string>;
  sources: GuideSource[];
  isYpn?: boolean;
}

/** A photo from the blog library (src/content/blog-images/photos.json, Unsplash License, files in public/images/blog). */
export interface GuideImage {
  key: string;
  /** Alt text written for this page. */
  alt: string;
}

export interface ComparisonGuide {
  slug: string;
  path: string;
  /** <title>, brand included, 60 characters or fewer. */
  title: string;
  /** Meta description, 155 characters or fewer. */
  description: string;
  h1: string;
  breadcrumb: string;
  eyebrow: string;
  intro: string;
  datePublished: string;
  dateModified: string;
  about: string[];
  shortAnswer: string[];
  tableCaption: string;
  columns: { key: string; label: string }[];
  /** Header photo, then up to two in-body photos (after the table, before "How to choose"). */
  images: { hero: GuideImage; inline: GuideImage[] };
  /** The product the page is about, when it is an "alternatives" page. Shown first, not in the ItemList. */
  baseline?: GuideOption;
  options: GuideOption[];
  howToChoose: string[];
  faq: { q: string; a: string }[];
  method: string;
  related: { label: string; href: string }[];
}

const CHECKED = "2026-11-17";

const YPN_SOURCES: GuideSource[] = [
  { label: "YPN USA pricing", url: "/pricing", checked: CHECKED },
  { label: "What Cerebro does today", url: "/cerebro", checked: CHECKED },
  { label: "YPN USA features", url: "/features", checked: CHECKED },
];

const YPN_PRICING =
  "Free plan at $0 with Cerebro and the AI borrower intake assistant, no card needed and no ZIP code. Pro $99 a month, Growth $199 a month and Exclusive $299 a month each include one ZIP code and a 15-day free trial. The ZIP code locks at your first payment. Five-year prepaid plans are also offered.";

const YPN_HIGHLIGHTS = [
  "Cerebro answers borrower questions on your page or website at any hour, under your brand.",
  "It asks what you would ask (purchase or refinance, timeline, price range, area and contact details, with consent) and hands ready borrowers to you with a summary.",
  "Every conversation is saved to your account, and borrowers you capture stay with you if you change brokerages.",
  "Drafts local social posts, Google Business Profile updates and Realtor co-marketing copy for you to review before anything goes out.",
  "Paid plans add one ZIP code that no other YPN USA loan officer can claim, SMS and email nurture, and calendar booking with CRM mirroring.",
  "Cerebro never quotes or locks rates and never makes credit decisions; those stay with you.",
];

const LOANOFFICER_AI_SOURCES: GuideSource[] = [
  { label: "LoanOfficer.ai home page", url: "https://loanofficer.ai", checked: CHECKED },
  { label: "LoanOfficer.ai pricing", url: "https://loanofficer.ai/pricing", checked: CHECKED },
];

const SHAPE_SOURCES: GuideSource[] = [
  { label: "Shape AI for mortgage", url: "https://setshape.com/shape-ai-mortgage", checked: CHECKED },
  { label: "Shape pricing", url: "https://setshape.com/pricing", checked: CHECKED },
];

const BONZO_SOURCES: GuideSource[] = [
  { label: "Bonzo home page", url: "https://www.getbonzo.com", checked: CHECKED },
  { label: "Bonzo pricing", url: "https://getbonzo.com/pricing", checked: CHECKED },
];

const HOMEBOT_SOURCES: GuideSource[] = [
  { label: "Homebot home page", url: "https://homebot.ai", checked: CHECKED },
  { label: "Homebot loan officer pricing", url: "https://homebot.ai/pricing/loan-officer", checked: CHECKED },
];

/* ------------------------------------------------------------------ */
/* 1. Best AI assistants for loan officers                             */
/* ------------------------------------------------------------------ */

const AI_COLUMNS = [
  { key: "type", label: "What the AI does" },
  { key: "borrowers", label: "Talks to borrowers" },
  { key: "price", label: "Published price" },
  { key: "bestFor", label: "Best for" },
];

export const BEST_AI_ASSISTANTS_GUIDE: ComparisonGuide = {
  slug: "best-ai-assistants-for-loan-officers",
  path: "/best-ai-assistants-for-loan-officers",
  title: "Best AI Assistants for Loan Officers (2026) | YPN USA",
  description:
    "Seven AI assistants for mortgage loan officers compared: what each AI does, whether it talks to borrowers, published pricing and who each fits best.",
  h1: "Best AI assistants for mortgage loan officers (2026)",
  breadcrumb: "Best AI assistants for loan officers",
  eyebrow: "Comparison guide",
  intro:
    "\"AI assistant\" means very different things in mortgage software. Some answer and book new borrowers, some run inside a full CRM with AI calling, some help you work your past clients, and some speed up processing. This guide compares seven, using each company's own website, so you can match the tool to the job you need done.",
  datePublished: CHECKED,
  dateModified: CHECKED,
  about: ["AI assistant", "Mortgage loan officer", "Mortgage CRM", "Lead follow-up"],
  shortAnswer: [
    "Need an AI to answer and qualify new borrowers inside a full CRM, with database reactivation and published prices? LoanOfficer.ai starts at $197 a month for two seats.",
    "Want AI phone calls and texts with warm transfers inside an established mortgage CRM? Shape offers AI calling, priced by quote.",
    "Want to start free, with an AI that answers borrowers on your own page and a ZIP code no other YPN USA loan officer can claim? YPN USA with Cerebro has a $0 plan and paid plans from $99 a month.",
    "Working mainly with past clients rather than new inquiries? Homebot's HomebotAI focuses on client signals and referral partners.",
    "Buying for a whole lender, bank or credit union? Total Expert and Addy AI are built and sold for institutions.",
  ],
  images: {
    hero: { key: "photo-1758519288445-5847dd89f313", alt: "Loan officer in a suit on a phone call at his desk, laptop open beside him" },
    inline: [
      { key: "photo-1744640326166-433469d102f2", alt: "Circuit board with a glowing chip labeled AI" },
      { key: "photo-1568658176307-bfbd2873abda", alt: "Two colleagues comparing software options on a laptop" },
    ],
  },
  tableCaption: "AI assistants for mortgage loan officers compared on what the AI does, borrower contact, published price and fit",
  columns: AI_COLUMNS,
  options: [
    {
      id: "loanofficer-ai",
      name: "LoanOfficer.ai",
      website: "https://loanofficer.ai",
      category: "AI mortgage CRM",
      summary:
        "LoanOfficer.ai describes itself as an AI mortgage CRM that answers leads, books appointments and reactivates your past database. It says every inquiry is answered, qualified and worked around the clock, and adds email and text campaigns, rate drop alerts and property value monitoring.",
      bestFor: "Loan officers and small teams with a steady flow of inquiries and a past-client database who want one AI CRM to work both.",
      notFor: "You mainly need more new local inquiries in the first place, or you want to keep the CRM you already use.",
      highlights: [
        "AI answers and qualifies new inquiries 24/7 and books consultations on your calendar.",
        "Reactivates past borrowers with email and text campaigns.",
        "Rate drop alerts, property value and equity monitoring, and referral partner nurture.",
        "Branded loan officer website available as an add-on.",
      ],
      pricing:
        "Starter $197 a month (2 seats), Team $397 a month (5 seats), Brokerage $697 a month (10 seats), Enterprise custom. Every plan starts at $1 for 14 days, then a one-time $299 setup fee. No contract. Website add-on $99 a month plus $299 setup.",
      table: {
        type: "Answers, qualifies and books inquiries; reactivates your database",
        borrowers: "Yes, new inquiries and past clients",
        price: "From $197/mo (2 seats) plus $299 setup",
        bestFor: "LOs with steady inquiries and a database",
      },
      sources: LOANOFFICER_AI_SOURCES,
    },
    {
      id: "shape",
      name: "Shape",
      website: "https://setshape.com",
      category: "Mortgage CRM with AI calling and texting",
      summary:
        "Shape is a mortgage CRM with an AI suite. Its AI calling answers calls, qualifies borrowers, schedules consultations and warm transfers ready prospects to the loan officer; its AI also calls and texts new inquiries within seconds, scores leads and summarizes calls. It syncs with loan origination systems and tracks referrals.",
      bestFor: "Loan officers, teams and broker shops that want AI phone and text follow-up built into a full CRM.",
      notFor: "You want to see prices before a sales call, or you don't want to move to a new CRM.",
      highlights: [
        "AI calling that answers, qualifies, books and warm transfers to you.",
        "AI texting, call transcription, scoring and summaries.",
        "AI lead scoring, pipelines, LOS sync and referral tracking.",
        "On the Core plan, AI calling and texting come through the AI Suite add-on; the Complete plan includes the AI calling bot.",
      ],
      pricing:
        "No dollar prices published. Core is priced per user by quote, Complete includes 5 users by quote, Enterprise is custom. Calling, texting and email usage is billed as you go. Shape says paying annually saves up to 20%.",
      table: {
        type: "AI calling and texting inside a full mortgage CRM",
        borrowers: "Yes, by phone and text",
        price: "Quote only; usage billed as you go",
        bestFor: "Teams wanting AI calls inside a CRM",
      },
      sources: SHAPE_SOURCES,
    },
    {
      id: "ypn-usa",
      name: "YPN USA with Cerebro",
      trademarkName: "YPN USA",
      website: "/cerebro",
      category: "AI assistant plus local visibility and an exclusive ZIP code",
      summary:
        "YPN USA is marketing software for licensed loan officers, published by the company behind this page. Its AI assistant, Cerebro, answers borrower questions on your page or website day and night, qualifies them, records the conversation and hands ready borrowers to you with a summary. It is not a CRM: if you have one, paid plans mirror leads to it.",
      bestFor: "Loan officers who want to start free and have an AI answer and qualify borrowers on their own local page, with one ZIP code no other YPN USA loan officer can claim.",
      notFor:
        "You want a full CRM with database reactivation or AI phone calls. YPN USA does not sell lead lists, so inquiries come from your own pages and profile and build over time. Done-for-you Google Business Profile setup is still marked coming soon.",
      highlights: YPN_HIGHLIGHTS,
      pricing: YPN_PRICING,
      table: {
        type: "Answers and qualifies borrowers on your page; drafts your marketing",
        borrowers: "Yes, on your page or website",
        price: "Free plan; paid from $99/mo, 15-day trial",
        bestFor: "Solo LOs starting free who want local visibility",
      },
      sources: YPN_SOURCES,
      isYpn: true,
    },
    {
      id: "homebot",
      name: "Homebot",
      website: "https://homebot.ai",
      category: "Client engagement with HomebotAI",
      summary:
        "Homebot keeps loan officers in touch with past clients through home finance reports and flags clients showing signals to buy or sell. HomebotAI, its built-in assistant, answers market and partner questions with charts, suggests referral partners and drafts texts and emails. Homebot's product notes say HomebotAI is live for self-serve loan officers.",
      bestFor: "Loan officers whose growth comes from past clients and Realtor partners.",
      notFor: "You want an AI that talks with new borrowers on your website; Homebot's pages don't describe that.",
      highlights: [
        "Branded home finance reports and email nurture for your database.",
        "Alerts when clients show buy or sell signals.",
        "HomebotAI chat for market and partner questions, partner suggestions and draft messages.",
      ],
      pricing:
        "Loan officer plans: Starter $125 a month, Pro $225 a month, Unlimited $300 a month, each with a one-time $100 setup fee. Annual billing saves up to 16%. Teams and Enterprise are custom. The pricing page doesn't say which plans include HomebotAI.",
      table: {
        type: "Assistant for your data: market answers, partners, draft messages",
        borrowers: "No live borrower chat described",
        price: "From $125/mo plus $100 setup",
        bestFor: "Past-client and partner focused LOs",
      },
      sources: [...HOMEBOT_SOURCES, { label: "Homebot Q3 2026 product releases", url: "https://homebot.ai/blog/q3-2026-product-releases", checked: CHECKED }],
    },
    {
      id: "bonzo",
      name: "Bonzo",
      website: "https://www.getbonzo.com",
      category: "Follow-up software with an AI data assistant",
      summary:
        "Bonzo is conversation and follow-up software that keeps texting, emailing, sending video and dropping voicemails until a lead is ready to talk. Its AI feature, ChatMMI, lets you ask plain-language questions about MMI data and push matching contacts into Bonzo; it needs an MMI Data Center account.",
      bestFor: "Loan officers who want automated multi-channel follow-up and already use MMI data.",
      notFor: "You want an AI that holds conversations with borrowers for you; Bonzo's home page doesn't describe one.",
      highlights: [
        "Automated follow-up by text, video, email and voicemail.",
        "Campaign builder, pipelines, LOS and lead source sync.",
        "ChatMMI for plain-language questions about MMI data (MMI account required).",
      ],
      pricing:
        "Solo $150 per seat per month. Small team price not shown. Enterprise custom. Bonzo's pages don't say whether ChatMMI costs extra.",
      table: {
        type: "Automated follow-up; AI questions over MMI data",
        borrowers: "Automated messages, not an AI conversation",
        price: "$150 per seat per month (Solo)",
        bestFor: "LOs focused on follow-up who use MMI",
      },
      sources: [
        ...BONZO_SOURCES,
        { label: "Bonzo help: ChatMMI in Bonzo", url: "https://support.getbonzo.com/hc/en-us/articles/32873253351826-ChatMMI-in-Bonzo", checked: CHECKED },
      ],
    },
    {
      id: "total-expert",
      name: "Total Expert",
      website: "https://www.totalexpert.com",
      category: "Enterprise customer platform with an AI Sales Assistant",
      summary:
        "Total Expert calls itself a customer operating system for financial services. Its AI Sales Assistant engages contacts by voice, gauges intent, schedules appointments and transfers to the loan officer, and Total Expert says it is trained on RESPA, TILA, TCPA and 10DLC rules. It is sold to lenders, banks, credit unions and insurers.",
      bestFor: "Mortgage lenders, banks and credit unions rolling out AI and marketing to many loan officers.",
      notFor: "You are an individual loan officer buying for yourself; it is sold to institutions by demo.",
      highlights: [
        "AI Sales Assistant that calls, qualifies, books and transfers.",
        "Marketing journeys and campaigns across the institution.",
        "Built for compliance teams at financial institutions.",
      ],
      pricing: "Not published. Book a demo.",
      table: {
        type: "Voice AI that engages, qualifies, books and transfers",
        borrowers: "Yes, by voice",
        price: "Not published (demo)",
        bestFor: "Lenders, banks and credit unions",
      },
      sources: [
        { label: "Total Expert home page", url: "https://www.totalexpert.com", checked: CHECKED },
        { label: "Total Expert AI Sales Assistant", url: "https://www.totalexpert.com/features/ai-sales-assistant", checked: CHECKED },
      ],
    },
    {
      id: "addy-ai",
      name: "Addy AI",
      website: "https://addy.com",
      category: "AI agents for loan processing and borrower questions",
      summary:
        "Addy AI builds custom AI agents for the mortgage process: checking loans against guidelines, resolving conditions and AUS findings, and requesting missing documents, including by calling borrowers. It also offers a 24/7 assistant that answers borrower questions using your guidelines and rate sheets, and connects to your LOS, POS and Microsoft Teams.",
      bestFor: "Lenders and branches that want AI to speed up processing and answer borrower questions during the loan.",
      notFor: "You need lead generation or marketing; Addy focuses on the loan process after the borrower arrives.",
      highlights: [
        "Loan pre-check against guidelines, with citations.",
        "Condition, AUS and document request agents.",
        "24/7 borrower question answering trained on your guidelines.",
        "LOS, POS and Microsoft Teams integrations; Addy states SOC 2 Type 2 compliance.",
      ],
      pricing: "Not published. Book a demo.",
      table: {
        type: "Processing agents and borrower Q&A",
        borrowers: "Yes, questions and document requests",
        price: "Not published (demo)",
        bestFor: "Lenders speeding up processing",
      },
      sources: [
        { label: "Addy AI home page", url: "https://addy.com", checked: CHECKED },
        { label: "Addy AI loan officer assistant", url: "https://addy.com/ai-loan-officer-assistant", checked: CHECKED },
      ],
    },
  ],
  howToChoose: [
    "Start with the job. Answering new inquiries fast, working past clients, and speeding up processing are three different tools.",
    "Check whether the AI talks to borrowers or only helps you. A chat on your page, AI phone calls and an assistant for your own questions are not the same thing.",
    "Count the full cost: seats, setup fees, usage charges and any add-on the AI needs.",
    "Ask how it hands off. Rates, credit decisions and loan advice must stay with you, the licensed loan officer.",
    "If you already pay for a CRM, ask whether the AI works alongside it or replaces it.",
  ],
  faq: [
    {
      q: "What is the best AI assistant for a mortgage loan officer?",
      a: "It depends on the job. For an AI CRM that answers inquiries and reactivates your database with published prices, LoanOfficer.ai starts at $197 a month. For AI calling inside a CRM, Shape. To start free with an AI that answers borrowers on your own page plus a ZIP code no other YPN USA loan officer can claim, YPN USA with Cerebro. For past clients, Homebot.",
    },
    {
      q: "Can an AI assistant talk to borrowers for me?",
      a: "Yes. LoanOfficer.ai, Shape, Total Expert, Addy AI and YPN USA's Cerebro all describe AI that answers borrower questions or inquiries. None of them should quote rates or make credit decisions; those stay with the licensed loan officer.",
    },
    {
      q: "Is there a free AI assistant for loan officers?",
      a: "YPN USA has a free plan with Cerebro and the AI borrower intake assistant, no card needed. LoanOfficer.ai starts with $1 for 14 days. The others in this guide either publish paid plans or quote by demo.",
    },
    {
      q: "Do I need to replace my CRM to use an AI assistant?",
      a: "Not always. LoanOfficer.ai and Shape are CRMs themselves. YPN USA is not a CRM and mirrors leads to yours on paid plans. Homebot and Bonzo work alongside a loan officer's existing systems.",
    },
  ],
  method:
    "We read each company's own website on November 17, 2026 and describe only what those pages say, in our own words. We did not test the products or receive anything to list them. Prices change, so confirm on each company's site. YPN Inc. publishes this page and sells YPN USA.",
  related: [
    { label: "Homebot vs Cerebro AI", href: "/compare/homebot-vs-cerebro-ai" },
    { label: "All YPN USA comparisons", href: "/compare" },
    { label: "YPN USA vs LoanOfficer.ai", href: "/ypnus-vs-loanofficer-ai" },
    { label: "YPN USA vs Total Expert", href: "/vs/total-expert" },
    { label: "LeadPops alternatives", href: "/leadpops-alternatives" },
    { label: "Zillow alternatives for loan officers", href: "/zillow-alternatives-for-loan-officers" },
  ],
};

/* ------------------------------------------------------------------ */
/* 2. LeadPops alternatives                                            */
/* ------------------------------------------------------------------ */

const LEADPOPS_COLUMNS = [
  { key: "what", label: "What you get" },
  { key: "website", label: "Website and lead capture" },
  { key: "price", label: "Published price" },
  { key: "bestFor", label: "Best for" },
];

export const LEADPOPS_ALTERNATIVES_GUIDE: ComparisonGuide = {
  slug: "leadpops-alternatives",
  path: "/leadpops-alternatives",
  title: "LeadPops Alternatives for Loan Officers (2026) | YPN USA",
  description:
    "Six LeadPops alternatives for loan officers compared: mortgage websites, lead capture, AI follow-up, published prices and who each one fits.",
  h1: "LeadPops alternatives for loan officers (2026)",
  breadcrumb: "LeadPops alternatives",
  eyebrow: "Comparison guide",
  intro:
    "LeadPops builds mortgage websites and lead capture funnels that feed your CRM, and it is aimed at loan officers closing two or more loans a month who fund paid ads. If you want published prices, an AI that answers borrowers, a lower starting cost or a different kind of tool, here are six alternatives compared from each company's own website.",
  datePublished: CHECKED,
  dateModified: CHECKED,
  about: ["LeadPops", "Mortgage website", "Mortgage lead generation", "Loan officer marketing"],
  shortAnswer: [
    "Closest like-for-like: LenderHomePage, with mortgage websites, funnels and forms, and published plans from $127 a month billed annually.",
    "Want a website plus an AI CRM that answers and books inquiries? LoanOfficer.ai, from $197 a month plus a $99 a month website add-on.",
    "Want to start free, with no ad budget, an AI that answers borrowers on your own local page and a ZIP code no other YPN USA loan officer can claim? YPN USA, free or from $99 a month.",
    "Want landing pages inside a full CRM with AI calling? Shape, priced by quote.",
    "Already have leads and need follow-up or past-client engagement, not a website? Bonzo or Homebot.",
  ],
  images: {
    hero: { key: "photo-1558174685-430919a96c8d", alt: "Laptop showing a website on a sunny desk with plants and a coffee mug" },
    inline: [
      { key: "photo-1551288049-bebda4e38f71", alt: "Website traffic and conversion charts on a laptop screen" },
      { key: "photo-1713946598501-d6b32e7c2464", alt: "Loan officer smiling on a phone call while working on her laptop" },
    ],
  },
  tableCaption: "LeadPops and six alternatives compared on what you get, website and lead capture, published price and fit",
  columns: LEADPOPS_COLUMNS,
  baseline: {
    id: "leadpops",
    name: "LeadPops",
    website: "https://leadpops.com",
    category: "Mortgage websites and lead capture funnels",
    summary:
      "LeadPops describes itself as complete mortgage marketing software for loan officers and brokers: websites, landing pages and funnels with multi-step forms that start with a ZIP code, instant automated responses, and leads sent into your CRM or through Zapier. It says it is not a CRM, and that it is built for loan officers closing two or more loans a month, teams and brokers, not brand-new loan officers.",
    bestFor: "Experienced loan officers and brokers funding paid ads who want conversion-focused websites and funnels feeding their CRM.",
    notFor: "You are new, have no ad budget, or want to see a price list before a demo.",
    highlights: [
      "Mortgage websites, landing pages and funnels.",
      "Multi-step forms that start with a ZIP code; calculators and calendar booking.",
      "Leads sent to your CRM or anywhere through Zapier.",
    ],
    pricing:
      "No price list; the pricing link opens a demo booking. LeadPops' FAQ mentions starter options from $200 to $1,000 a month and suggests planning on $1,000 to $5,000 a month in total marketing spend, ad spend included.",
    table: {
      what: "Websites, landing pages and funnels that feed your CRM",
      website: "Yes, its core product",
      price: "Custom; FAQ cites $200 to $1,000/mo starter options",
      bestFor: "Experienced LOs funding paid ads",
    },
    sources: [
      { label: "LeadPops home page and FAQ", url: "https://leadpops.com", checked: CHECKED },
      { label: "LeadPops mortgage websites", url: "https://leadpops.com/mortgage-websites", checked: CHECKED },
      { label: "LeadPops guide to mortgage CRM software", url: "https://leadpops.com/guide/best-mortgage-crm-software-2026", checked: CHECKED },
    ],
  },
  options: [
    {
      id: "lenderhomepage",
      name: "LenderHomePage",
      website: "https://lenderhomepage.com",
      category: "Mortgage websites, funnels and point of sale",
      summary:
        "LenderHomePage calls itself an all-in-one AI-powered mortgage marketing platform built for loan officers. It offers mortgage websites, lead funnels, a form builder, e-book lead magnets, pre-qualification calculators, an AI blog, review showcases, the Loanzify point of sale and mobile app, and a compliance engine.",
      bestFor: "Loan officers who want the closest match to LeadPops (a website plus funnels) with a published price list.",
      notFor: "You don't want a one-year agreement; LenderHomePage plans renew annually.",
      highlights: [
        "Mortgage websites and lead funnels, forms and lead magnets.",
        "Pre-qualification calculators and review showcases.",
        "Loanzify point of sale and mobile app; co-branding and a success coach.",
      ],
      pricing:
        "Loan officer plans: Starter $127, Growth $199 and Win $289 a month billed annually, or $139, $238 and $347 a month billed monthly plus a $199, $299 or $399 onboarding fee. Plans are a one-year agreement that renews annually; a 14-day free trial is offered. Team and broker plans are priced separately.",
      table: {
        what: "Websites, funnels, forms and a point of sale app",
        website: "Yes, its core product",
        price: "From $127/mo billed annually",
        bestFor: "A like-for-like swap with a price list",
      },
      sources: [
        { label: "LenderHomePage home page", url: "https://lenderhomepage.com", checked: CHECKED },
        { label: "LenderHomePage website pricing", url: "https://www.lenderhomepage.com/pricing/mortgage-websites/", checked: CHECKED },
      ],
    },
    {
      id: "loanofficer-ai",
      name: "LoanOfficer.ai",
      website: "https://loanofficer.ai",
      category: "AI mortgage CRM with a website add-on",
      summary:
        "LoanOfficer.ai is an AI mortgage CRM that answers and qualifies inquiries around the clock, books appointments and reactivates past borrowers. Its branded loan officer website is an add-on that plugs straight into the CRM, with lead capture, a compliance footer, testimonials and an AI assistant, so leads don't pass through Zapier.",
      bestFor: "Loan officers who want a website and an AI CRM on one platform instead of a website feeding a separate CRM.",
      notFor: "You want landing pages and funnels for paid campaigns; we didn't find those on its site.",
      highlights: [
        "Branded website add-on with lead capture and an AI assistant, hosting and SSL included.",
        "AI answers, qualifies and books inquiries; reactivates your database.",
        "Passes leads to loan origination systems such as LendingPad, Arive and Byte.",
      ],
      pricing:
        "Starter $197 a month (2 seats), Team $397, Brokerage $697, Enterprise custom. $1 for 14 days, then a one-time $299 setup fee. Website add-on $99 a month plus $299 setup. No contract.",
      table: {
        what: "AI CRM plus a branded website add-on",
        website: "Website add-on; no funnels found",
        price: "From $197/mo plus $99/mo website",
        bestFor: "One platform for site and AI CRM",
      },
      sources: [...LOANOFFICER_AI_SOURCES, { label: "LoanOfficer.ai websites", url: "https://loanofficer.ai/websites", checked: CHECKED }],
    },
    {
      id: "ypn-usa",
      name: "YPN USA",
      website: "/pricing",
      category: "Local pages, AI intake and an exclusive ZIP code",
      summary:
        "YPN USA is marketing software for licensed loan officers, published by the company behind this page. Instead of funnels for paid ads, it gives you a local page for your ZIP code, Cerebro to answer and qualify borrowers on it at any hour, and one ZIP code no other YPN USA loan officer can claim. A portable loan officer website comes with the Growth and Exclusive plans.",
      bestFor: "Loan officers who want to start free with no ad budget, build local visibility under their own name and let an AI answer borrowers.",
      notFor:
        "You run paid ad campaigns and want conversion funnels tuned for that traffic, or you want a CRM. YPN USA does not sell leads, so inquiries come from your own pages and profile and build over time.",
      highlights: YPN_HIGHLIGHTS,
      pricing: YPN_PRICING,
      table: {
        what: "Local ZIP code page, AI intake, exclusive ZIP code",
        website: "ZIP code page on paid plans; full website on Growth and Exclusive",
        price: "Free plan; paid from $99/mo",
        bestFor: "Starting free with no ad budget",
      },
      sources: YPN_SOURCES,
      isYpn: true,
    },
    {
      id: "shape",
      name: "Shape",
      website: "https://setshape.com",
      category: "Mortgage CRM with landing pages and AI",
      summary:
        "Shape is an AI-powered mortgage CRM for lenders and brokers. Its lead engine designs and builds landing pages and survey-style funnels that send leads into the CRM, where AI follows up, alongside a dialer, texting, drip campaigns and LOS integrations.",
      bestFor: "Teams that want landing pages, funnels and AI calling in the same CRM.",
      notFor: "You want published prices or a simple site that works with the CRM you already have.",
      highlights: [
        "Landing pages and survey-style funnels; included on Complete, an add-on on Core.",
        "AI follow-up, dialer, texting and drip campaigns.",
        "Integrations with Encompass, Blend, Arive, LendingPad and nCino.",
      ],
      pricing:
        "No dollar prices published. Core priced per user by quote, Complete includes 5 users by quote, Enterprise custom. Calls, texts and email billed as you go. Onboarding package included.",
      table: {
        what: "CRM with landing pages, funnels and AI calling",
        website: "Landing pages and funnels",
        price: "Quote only",
        bestFor: "Teams wanting funnels inside a CRM",
      },
      sources: [{ label: "Shape home page", url: "https://setshape.com", checked: CHECKED }, ...SHAPE_SOURCES.slice(1)],
    },
    {
      id: "bonzo",
      name: "Bonzo",
      website: "https://www.getbonzo.com",
      category: "Follow-up and conversation software",
      summary:
        "Bonzo captures, sorts and follows up with leads automatically by text, video, email, calls and voicemail drops, with a campaign builder, pipelines and LOS sync. We didn't find websites or landing pages on its site, so it pairs with lead capture rather than replacing it.",
      bestFor: "Loan officers who already get leads and lose them to slow follow-up.",
      notFor: "You need a website or funnels to capture leads in the first place.",
      highlights: [
        "Automated follow-up across text, video, email and voicemail.",
        "Campaign builder and pipelines.",
        "LOS sync and past loan data from MMI.",
      ],
      pricing: "Solo $150 per seat per month. Small team price not shown. Enterprise custom.",
      table: {
        what: "Automated multi-channel follow-up",
        website: "Not offered",
        price: "$150 per seat per month (Solo)",
        bestFor: "LOs with leads but slow follow-up",
      },
      sources: BONZO_SOURCES,
    },
    {
      id: "homebot",
      name: "Homebot",
      website: "https://homebot.ai",
      category: "Past-client engagement",
      summary:
        "Homebot sends your clients branded home finance reports and alerts you when they show signals to buy or sell, with a referral network and home search. It works your existing database rather than capturing new web leads.",
      bestFor: "Loan officers who want more repeat and referral business from past clients.",
      notFor: "You need a website or lead capture funnels.",
      highlights: [
        "Branded home finance reports and email nurture.",
        "Buy and sell signals from your clients.",
        "Referral network and home search.",
      ],
      pricing: "Loan officer plans: Starter $125, Pro $225 and Unlimited $300 a month, each with a one-time $100 setup fee.",
      table: {
        what: "Client reports and buy or sell signals",
        website: "Not offered",
        price: "From $125/mo plus $100 setup",
        bestFor: "Repeat and referral business",
      },
      sources: HOMEBOT_SOURCES,
    },
  ],
  howToChoose: [
    "Decide where your borrowers will come from. Funnels pay off when you fund ads; local pages and a Google Business Profile build over time without an ad budget.",
    "Compare the full monthly cost, including ad spend, setup or onboarding fees and contract length.",
    "Check whether the tool includes a CRM, replaces yours, or sends leads to the one you use.",
    "Look at response speed. An AI or automation that answers within minutes matters more than the page itself.",
  ],
  faq: [
    {
      q: "What is the best LeadPops alternative?",
      a: "For the closest match (mortgage websites and funnels) with published pricing, LenderHomePage, from $127 a month billed annually. For a website plus an AI CRM, LoanOfficer.ai. To start free without ad spend, with an AI that answers borrowers on your own local page and an exclusive ZIP code within YPN USA, YPN USA.",
    },
    {
      q: "How much does LeadPops cost?",
      a: "LeadPops doesn't publish a price list; it quotes after a demo. Its FAQ mentions starter options from $200 to $1,000 a month and suggests planning on $1,000 to $5,000 a month in total marketing, ad spend included (checked November 17, 2026).",
    },
    {
      q: "Is LeadPops a CRM?",
      a: "No. LeadPops says it is a lead generation platform and sends leads into your CRM or through Zapier.",
    },
    {
      q: "Which LeadPops alternative works without an ad budget?",
      a: "YPN USA is built around local pages and an AI assistant rather than paid traffic, and has a free plan. Homebot and Bonzo also don't need ad spend, but they work leads and clients you already have.",
    },
  ],
  method:
    "We read LeadPops' website and each alternative's own website on November 17, 2026 and describe only what those pages say, in our own words. HousingWire lists LeadPops among its 9 top places to buy mortgage leads. We did not test the products or receive anything to list them. Prices change, so confirm on each company's site. YPN Inc. publishes this page and sells YPN USA.",
  related: [
    { label: "All YPN USA comparisons", href: "/compare" },
    { label: "YPN USA vs LeadPops", href: "/vs/leadpops" },
    { label: "YPN USA vs Bonzo", href: "/vs/bonzo" },
    { label: "YPN USA vs Homebot", href: "/vs/homebot" },
    { label: "Best AI assistants for loan officers", href: "/best-ai-assistants-for-loan-officers" },
    { label: "Zillow alternatives for loan officers", href: "/zillow-alternatives-for-loan-officers" },
  ],
};

/* ------------------------------------------------------------------ */
/* 3. Zillow alternatives for loan officers                            */
/* ------------------------------------------------------------------ */

const ZILLOW_COLUMNS = [
  { key: "source", label: "Where leads come from" },
  { key: "shared", label: "Shared or exclusive" },
  { key: "price", label: "How you pay" },
  { key: "bestFor", label: "Best for" },
];

const HOUSINGWIRE_LEADS: GuideSource = {
  label: "HousingWire: 9 top places to buy mortgage leads in 2026",
  url: "https://www.housingwire.com/articles/buy-mortgage-leads/",
  checked: CHECKED,
};

export const ZILLOW_ALTERNATIVES_GUIDE: ComparisonGuide = {
  slug: "zillow-alternatives-for-loan-officers",
  path: "/zillow-alternatives-for-loan-officers",
  title: "Zillow Alternatives for Loan Officers (2026) | YPN USA",
  description:
    "Mortgage lead sources for loan officers besides Zillow: LendingTree, Bankrate, FreeRateUpdate, LeadPops, Homebot and YPN USA, with sharing and pricing.",
  h1: "Zillow alternatives for loan officers: where to get mortgage leads (2026)",
  breadcrumb: "Zillow alternatives for loan officers",
  eyebrow: "Comparison guide",
  intro:
    "Zillow sells mortgage leads to lenders on a cost per lead basis, publishes no rate card, and runs its own lender, Zillow Home Loans. If you want a different source of borrowers, the options fall into three groups: lead marketplaces, ads and funnels run for you, and demand you build and own. This guide compares six, using each company's own website.",
  datePublished: CHECKED,
  dateModified: CHECKED,
  about: ["Zillow", "Mortgage leads", "Mortgage lead generation", "Loan officer marketing"],
  shortAnswer: [
    "Want the most volume from a big marketplace? LendingTree and Bankrate sell leads from their rate shopping sites; LendingTree says it matches each borrower with up to five lenders.",
    "Want leads that are yours alone from ads run for you? LeadPops says its ad leads go to one lender only, with monthly tiers starting at $500 to $1,500.",
    "Want to stop renting leads and build demand under your own name? YPN USA gives you a local page, an AI that answers borrowers and a ZIP code no other YPN USA loan officer can claim, starting free.",
    "Want more business from people who already know you? Homebot works your past clients instead of buying leads.",
  ],
  images: {
    hero: { key: "photo-1758304480344-f8d0de5f4f25", alt: "Aerial view of a suburban neighborhood with homes, trees and hills" },
    inline: [
      { key: "photo-1725379448168-e33c5e09d47e", alt: "For sale sign in front of a home" },
      { key: "photo-1722680001761-75450b9f085e", alt: "Hand placing colored pins on a city map to mark local areas" },
    ],
  },
  tableCaption: "Zillow and six alternatives compared on lead source, sharing, how you pay and fit",
  columns: ZILLOW_COLUMNS,
  baseline: {
    id: "zillow",
    name: "Zillow (lender marketplace)",
    trademarkName: "Zillow",
    website: "https://www.zillow.com",
    category: "Mortgage marketplace with pay per lead advertising",
    summary:
      "Zillow's SEC filings say its mortgages revenue includes advertising sold to mortgage lenders and other mortgage professionals on a cost per lead basis, through Connect, its mortgage marketplace where consumers find lenders for purchase and refinance loans. Zillow also originates loans itself through Zillow Home Loans, which its 2025 annual report says is available in 49 states and the District of Columbia, and HousingWire has reported that Zillow wants agents to refer buyers to Zillow Home Loans. Zillow Flex is a separate, invitation-only program for real estate agents that charges a fee when a deal closes; it is not a loan officer program.",
    bestFor: "Lenders with the budget and pricing setup to compete in a large national marketplace.",
    notFor: "You want a published price, leads only you receive, or a source that doesn't also run its own mortgage lender.",
    highlights: [
      "Consumers connect with lenders through Zillow's mortgage marketplace.",
      "Lenders pay per lead; Zillow does not publish a rate card.",
      "Zillow Home Loans, Zillow's own lender, competes for the same borrowers.",
    ],
    pricing:
      "Cost per lead, not published by Zillow. LeadPops, which sells a competing service, claims a $2,500 monthly minimum; we could not confirm that on Zillow's site.",
    table: {
      source: "Zillow's mortgage marketplace (Connect)",
      shared: "Not stated by Zillow",
      price: "Cost per lead; no published rate card",
      bestFor: "Lenders built to compete nationally",
    },
    sources: [
      {
        label: "Zillow Group 2025 annual report (Form 10-K)",
        url: "https://www.sec.gov/Archives/edgar/data/1617640/000161764026000015/z-20251231.htm",
        checked: CHECKED,
      },
      {
        label: "Zillow Group Form 10-Q, quarter ended September 30, 2025 (filing text)",
        url: "https://www.pubt.io/view/CC5557A5AF8AFFB738291CB6A6498F9582CD5FB8",
        checked: CHECKED,
      },
      { label: "Zillow Flex FAQ", url: "https://www.zillow.com/z/flex-performance-terms/flex-faq/", checked: CHECKED },
      {
        label: "HousingWire: Zillow's mortgage business is growing",
        url: "https://www.housingwire.com/articles/zillows-mortgage-business-is-growing-lenders-beware/",
        checked: CHECKED,
      },
      { label: "LeadPops: Zillow mortgage leads review", url: "https://leadpops.com/blog/zillow-mortgage-leads-review-2026", checked: CHECKED },
    ],
  },
  options: [
    {
      id: "lendingtree",
      name: "LendingTree",
      website: "https://www.lendingtree.com/join-our-network/",
      category: "Shared lead marketplace",
      summary:
        "LendingTree is a loan marketplace. A borrower fills out a qualification form and reviews offers, and LendingTree says it finds up to five lenders that best match and shares the borrower's information with each of them. Lenders join its network to get leads.",
      bestFor: "Loan officers and lenders with fast follow-up who want volume and accept competing for each borrower.",
      notFor: "You want leads no other lender receives.",
      highlights: [
        "Borrowers compare offers from several lenders.",
        "Up to five matched lenders receive each borrower's information.",
        "Lenders apply through LendingTree's partner network.",
      ],
      pricing: "Not published by LendingTree. HousingWire reports about $30 to $100 per lead.",
      table: {
        source: "Borrowers comparing offers on LendingTree",
        shared: "Shared with up to five lenders",
        price: "Per lead; not published (HousingWire: $30 to $100)",
        bestFor: "Volume with fast follow-up",
      },
      sources: [
        { label: "LendingTree: join our network", url: "https://www.lendingtree.com/join-our-network/", checked: CHECKED },
        { label: "LendingTree FAQ", url: "https://www.lendingtree.com/about/faq/", checked: CHECKED },
        HOUSINGWIRE_LEADS,
      ],
    },
    {
      id: "bankrate",
      name: "Bankrate",
      website: "https://www.bankrate.com/media-kit",
      category: "Rate table advertising, paid per lead",
      summary:
        "Bankrate sells placements on its mortgage rate tables. Its media kit says mortgage advertisers pay only for leads after a consumer works through its funnel, priced by a Smart Pricing algorithm. It doesn't say whether leads are shared or whether individual loan officers can advertise.",
      bestFor: "Lenders with a marketing budget who want to appear where borrowers compare rates.",
      notFor: "You are a solo loan officer with a small budget; HousingWire reports a high monthly minimum.",
      highlights: [
        "Listings on Bankrate's mortgage rate tables.",
        "Pay for leads after the consumer completes Bankrate's funnel.",
        "Pricing set by Bankrate's algorithm.",
      ],
      pricing: "Not published by Bankrate. HousingWire reports about $100 to $200 per lead and a $20,000 monthly minimum.",
      table: {
        source: "Borrowers comparing rates on Bankrate",
        shared: "Not stated",
        price: "Per lead; not published (HousingWire: $100 to $200)",
        bestFor: "Lenders with a large budget",
      },
      sources: [{ label: "Bankrate media kit", url: "https://www.bankrate.com/media-kit", checked: CHECKED }, HOUSINGWIRE_LEADS],
    },
    {
      id: "freerateupdate",
      name: "FreeRateUpdate",
      website: "https://www.freerateupdate.com/mortgage-leads",
      category: "Pay as you go lead seller",
      summary:
        "FreeRateUpdate sells mortgage leads that it says come mainly from Google Search rather than from third parties. You fund a balance and pay one lead at a time, with no minimum deposit and no commitment. Buyers must be licensed mortgage lenders or brokers with an NMLS number.",
      bestFor: "Loan officers who want to test bought leads without a contract or minimum.",
      notFor: "You need a published per lead price or guaranteed exclusivity; its page states neither.",
      highlights: [
        "Leads generated mainly from Google Search.",
        "Prepaid balance, one lead at a time, no minimum or commitment.",
        "Licensed lenders and brokers only.",
      ],
      pricing: "Per lead from a prepaid balance; no per lead price published. No minimum deposit.",
      table: {
        source: "FreeRateUpdate's own search traffic",
        shared: "Not stated",
        price: "Per lead, prepaid; no minimum",
        bestFor: "Testing leads without a contract",
      },
      sources: [{ label: "FreeRateUpdate mortgage leads", url: "https://www.freerateupdate.com/mortgage-leads", checked: CHECKED }, HOUSINGWIRE_LEADS],
    },
    {
      id: "leadpops",
      name: "LeadPops",
      website: "https://leadpops.com/mortgage-leads",
      category: "Ads and funnels run for you",
      summary:
        "LeadPops runs ads for you on Google, Facebook, Instagram and display networks and sends the traffic to its mortgage funnels. It says those leads are generated for one lender only and never shared or resold. Its pricing page says packages are custom.",
      bestFor: "Experienced loan officers who want exclusive leads from paid ads without running the ads themselves.",
      notFor: "You have no ad budget, or you want one clear price before a call.",
      highlights: [
        "Ads on Google, Facebook, Instagram and display networks.",
        "Mortgage funnels with forms that start with a ZIP code.",
        "Leads sent to your CRM; LeadPops says they are never shared.",
      ],
      pricing:
        "LeadPops' mortgage leads page lists monthly tiers from $500 to $1,500 (about 10 to 30 leads) up to $5,000 or more; its pricing page says packages are custom. It doesn't say whether ad spend is included.",
      table: {
        source: "Paid ads sent to LeadPops funnels",
        shared: "Exclusive, per LeadPops",
        price: "Monthly tiers from $500 to $1,500; custom packages",
        bestFor: "Exclusive leads from paid ads",
      },
      sources: [
        { label: "LeadPops mortgage leads", url: "https://leadpops.com/mortgage-leads", checked: CHECKED },
        { label: "LeadPops pricing", url: "https://leadpops.com/pricing", checked: CHECKED },
      ],
    },
    {
      id: "ypn-usa",
      name: "YPN USA",
      website: "/pricing",
      category: "Build and own local demand",
      summary:
        "YPN USA, published by the company behind this page, is not a lead marketplace. It gives licensed loan officers a local page for their ZIP code, Cerebro to answer and qualify borrowers on it at any hour, and one ZIP code no other YPN USA loan officer can claim. Borrowers who come in through your pages route to you and stay in your account.",
      bestFor: "Loan officers who want to stop competing for shared leads and build demand under their own name, starting free.",
      notFor:
        "You need a large number of leads this month. YPN USA does not sell leads, so volume depends on how visible your pages and Google Business Profile become, and that builds over time.",
      highlights: YPN_HIGHLIGHTS,
      pricing: YPN_PRICING,
      table: {
        source: "Your own local page, website and profile",
        shared: "Yours; one YPN USA loan officer per ZIP code",
        price: "Free plan; paid from $99/mo, not per lead",
        bestFor: "Owning local demand, starting free",
      },
      sources: YPN_SOURCES,
      isYpn: true,
    },
    {
      id: "homebot",
      name: "Homebot",
      website: "https://homebot.ai/lead-generation",
      category: "Leads from your own database",
      summary:
        "Homebot watches your borrower database and alerts you when clients look ready to refinance, buy or sell, while sending them branded home finance reports. It says it uses no trigger leads, no bought lists and no shared prospects.",
      bestFor: "Loan officers with a past-client database who want repeat and referral business instead of bought leads.",
      notFor: "You are new and don't have a database yet.",
      highlights: [
        "Alerts when past clients look ready to refinance, buy or sell.",
        "Branded home finance reports and email nurture.",
        "No trigger leads, bought lists or shared prospects, per Homebot.",
      ],
      pricing: "Loan officer plans: Starter $125, Pro $225 and Unlimited $300 a month, each with a one-time $100 setup fee.",
      table: {
        source: "Your own past clients",
        shared: "Yours; not bought or shared, per Homebot",
        price: "From $125/mo plus $100 setup",
        bestFor: "LOs with a past-client database",
      },
      sources: [{ label: "Homebot lead generation", url: "https://homebot.ai/lead-generation", checked: CHECKED }, HOMEBOT_SOURCES[1]],
    },
  ],
  howToChoose: [
    "Ask whether a lead goes to you alone or to several lenders. Shared leads reward whoever calls first.",
    "Work out your real cost per closed loan, not per lead: price, minimum spend, and how many leads actually close.",
    "Weigh renting against owning. Bought leads stop when you stop paying; pages, a Google Business Profile and a client database keep working.",
    "Check who else the source works for. A marketplace that also runs its own lender is competing for the same borrower.",
    "Paying for advertising or leads is different from paying for a referral. RESPA Section 8 prohibits kickbacks for referrals, and the CFPB has warned comparison platforms against steering borrowers for higher fees. Run any lead program past your compliance team.",
  ],
  faq: [
    {
      q: "What is the best Zillow alternative for loan officers?",
      a: "For marketplace volume, LendingTree or Bankrate. For exclusive leads from paid ads run for you, LeadPops. To build demand you own, starting free, with an AI that answers borrowers on your own local page and a ZIP code no other YPN USA loan officer can claim, YPN USA. For past clients, Homebot.",
    },
    {
      q: "Does Zillow still sell mortgage leads to loan officers?",
      a: "Zillow's SEC filings say it sells advertising to mortgage lenders and other mortgage professionals on a cost per lead basis through its Connect marketplace. Zillow does not publish lead prices.",
    },
    {
      q: "Is Zillow Flex for loan officers?",
      a: "No. Zillow Flex is an invitation-only program for real estate agents. There is no upfront cost, and Zillow collects a fee when a deal closes that varies by location and price.",
    },
    {
      q: "Are mortgage leads shared or exclusive?",
      a: "It depends on the source. LendingTree says it shares each borrower with up to five matched lenders. LeadPops says its ad leads go to one lender only. Bankrate, Zillow and FreeRateUpdate don't state it on the pages we read, so ask before you buy.",
    },
    {
      q: "Is buying mortgage leads allowed under RESPA?",
      a: "Paying a fair price for advertising or leads is different from paying for a referral, which RESPA Section 8 prohibits. The CFPB has said a platform that steers borrowers toward a provider in return for higher fees can create an illegal referral fee. Check any program with your compliance team.",
    },
  ],
  method:
    "We read each company's own website on November 17, 2026 and describe only what those pages say, in our own words. Zillow's lender pages were not available to us, so Zillow facts come from its SEC filings, its Flex FAQ and HousingWire's reporting. Where a company publishes no price, we cite HousingWire's reported figures and say so. We did not test the products or receive anything to list them. YPN Inc. publishes this page and sells YPN USA.",
  related: [
    { label: "LendingTree vs exclusive ZIP code mortgage leads", href: "/compare/lendingtree-vs-exclusive-zip-mortgage-leads" },
    { label: "Zillow Premier Lender alternatives", href: "/compare/zillow-premier-lender-alternatives" },
    { label: "All YPN USA comparisons", href: "/compare" },
    { label: "YPN USA vs Zillow Flex", href: "/vs/zillow-flex" },
    { label: "YPN USA vs LendingTree", href: "/vs/lendingtree" },
    { label: "LeadPops alternatives", href: "/leadpops-alternatives" },
    { label: "Best AI assistants for loan officers", href: "/best-ai-assistants-for-loan-officers" },
  ],
};

/* ------------------------------------------------------------------ */
/* 4. Best CRM for loan officers                                       */
/* ------------------------------------------------------------------ */

const CRM_CHECKED = "2026-11-20";

const CRM_COLUMNS = [
  { key: "what", label: "What it is" },
  { key: "ai", label: "AI and texting" },
  { key: "price", label: "Published price" },
  { key: "bestFor", label: "Best for" },
];

export const BEST_CRM_GUIDE: ComparisonGuide = {
  slug: "best-crm-for-loan-officers",
  path: "/best-crm-for-loan-officers",
  title: "Best CRM for Loan Officers (2026), Compared | YPN USA",
  description:
    "Six mortgage CRMs for loan officers and brokers compared on price, AI, texting and LOS sync, plus what to add when your CRM has no new borrowers in it.",
  h1: "Best CRM for mortgage loan officers (2026)",
  breadcrumb: "Best CRM for loan officers",
  eyebrow: "Comparison guide",
  intro:
    "A mortgage CRM is the system of record for your contacts, pipeline and follow-up. The right one depends on how many loan officers will use it, whether you want AI to answer leads for you, which loan origination system (LOS) it has to sync with, and whether you can see the price before a sales call. This guide compares six loan officer CRMs using each company's own website, then covers the one gap most of them share: a CRM organizes borrowers, but it rarely brings new ones in.",
  datePublished: CRM_CHECKED,
  dateModified: CRM_CHECKED,
  about: ["Mortgage CRM", "Loan officer CRM", "CRM for mortgage brokers", "Mortgage loan officer"],
  shortAnswer: [
    "Want an AI CRM that answers and books new leads around the clock, with prices on the page? LoanOfficer.ai starts at $197 a month for two seats.",
    "Want a mortgage-only CRM with texting and two-way LOS sync at a published price? BNTouch is $165 a month for one user, or $95 per user for 2 to 10 users.",
    "Want a CRM built on Salesforce with direct LOS integrations? Jungo starts at $96 per user a month, billed annually.",
    "Want AI phone calls and texts inside the CRM? Shape offers both, priced by quote.",
    "Already happy with your CRM but short on new borrowers? YPN USA is not a CRM. Its AI assistant, Cerebro, answers borrowers on your own page and paid plans pass leads to your CRM. There is a free plan.",
  ],
  images: {
    hero: { key: "photo-1526628953301-3e589a6a8b74", alt: "Mortgage CRM dashboard with pipeline charts on a computer screen" },
    inline: [
      { key: "photo-1554224155-cfa08c2a758f", alt: "Loan forms, a pen and a coffee mug on a dark desk" },
      { key: "photo-1763038311036-6d18805537e5", alt: "Loan officer reviewing pipeline charts on her laptop" },
    ],
  },
  tableCaption: "Mortgage CRMs for loan officers compared on what each is, AI and texting, published price and fit",
  columns: CRM_COLUMNS,
  options: [
    {
      id: "loanofficer-ai",
      name: "LoanOfficer.ai",
      website: "https://loanofficer.ai",
      category: "AI mortgage CRM",
      summary:
        "LoanOfficer.ai calls itself the AI mortgage CRM built for loan officers. It says its AI follows up on every new lead around the clock, qualifies it and books consultations on your calendar, and it adds email and text automation, nurture and referral partner tools.",
      bestFor: "Solo loan officers and small teams with a steady flow of leads who want the AI to make the first contact.",
      notFor: "You want to keep the CRM you already use, or you need more new leads before you need a CRM to work them.",
      highlights: [
        "AI lead follow-up that answers and qualifies new leads 24/7.",
        "AI appointment setter that books consultations.",
        "Email and text automation, nurture and referral partner tools.",
        "Setup includes LOS, lead provider, email and calendar integrations, according to its pricing page.",
      ],
      pricing:
        "Starter $197 a month for 2 seats, Team $397 a month for 5 seats, Brokerage $697 a month for 10 seats, Enterprise custom. Every plan starts at $1 for 14 days, then a one-time $299 setup fee. Branded website add-on $99 a month plus $299 setup.",
      table: {
        what: "AI CRM built for loan officers",
        ai: "AI answers, qualifies and books new leads; email and text",
        price: "From $197/mo (2 seats) plus $299 setup",
        bestFor: "Solo LOs and small teams with steady leads",
      },
      sources: [
        { label: "LoanOfficer.ai home page", url: "https://loanofficer.ai", checked: CRM_CHECKED },
        { label: "LoanOfficer.ai pricing", url: "https://loanofficer.ai/pricing", checked: CRM_CHECKED },
      ],
    },
    {
      id: "bntouch",
      name: "BNTouch",
      website: "https://bntouch.com",
      category: "Mortgage-only CRM with texting and LOS sync",
      summary:
        "BNTouch says it has been built only for mortgage since 2004. It combines a CRM with texting, campaigns and two-way LOS sync, and offers a White Glove team that runs the system for you. Its Mortgage AI drafts follow-ups and suggests who to contact next.",
      bestFor: "Loan officers, brokers and small teams who want a mortgage-specific CRM with LOS sync and a price on the page.",
      notFor: "You want to try it before paying; BNTouch says it does not offer a free trial. Its AI call assistant is listed as coming soon.",
      highlights: [
        "Two-way LOS sync with Encompass, Calyx, BytePro, MeridianLink and LendingPad.",
        "Automated two-way texting and marketing campaigns.",
        "Mortgage AI drafts follow-ups and prioritizes who to contact.",
        "Connects to more than 100 lead providers, including Zillow and LendingTree.",
      ],
      pricing:
        "$165 a month for a single user; $95 per user a month for 2 to 10 users; custom for 10 or more. Includes 5,000 records per user and 100 texts or minutes a month, with usage beyond that billed extra. White Glove, credit checks and equity alerts are priced separately. Month to month; no free trial.",
      table: {
        what: "Mortgage-only CRM since 2004",
        ai: "AI drafts follow-ups; automated two-way texting",
        price: "$165/mo single user; $95/user for 2 to 10",
        bestFor: "LOs and brokers who want LOS sync",
      },
      sources: [
        { label: "BNTouch home page", url: "https://bntouch.com/", checked: CRM_CHECKED },
        { label: "BNTouch pricing and features", url: "https://bntouch.com/pricing/", checked: CRM_CHECKED },
      ],
    },
    {
      id: "jungo",
      name: "Jungo",
      website: "https://ijungo.com",
      category: "Mortgage CRM built on Salesforce",
      summary:
        "Jungo is a mortgage CRM built on Salesforce that keeps borrowers informed during the loan and keeps referral partners engaged. It says it suits a solo loan officer or an enterprise, and its Bundle plan adds Jungo SMS with automated, trigger-based texts.",
      bestFor: "Loan officers and teams who want Salesforce underneath, direct LOS integrations and loan milestone updates for borrowers and partners.",
      notFor: "You want AI that talks to borrowers; Jungo's pages don't describe one. Plans carry a setup fee.",
      highlights: [
        "Direct LOS integrations with Encompass, Calyx, LendingPad, Velocity and Byte; Arive through Zapier.",
        "Borrower and referral partner updates through the loan.",
        "Automated texts with custom triggers on the Bundle plan.",
        "Connects to Floify, BombBomb, Mortgage Coach, Homebot, Blend and Optimal Blue.",
      ],
      pricing:
        "Billed annually: Jungo Lite $96 per user a month, Bundle $125 per user a month. Billed monthly: Lite $119, Bundle $149 per user a month. Enterprise custom. Setup fee of $249 to $299 depending on plan. Check Jungo's page for contract terms.",
      table: {
        what: "Mortgage CRM on Salesforce",
        ai: "No AI described; automated texts on Bundle",
        price: "From $96/user/mo billed annually, plus setup",
        bestFor: "Teams wanting Salesforce and LOS links",
      },
      sources: [
        { label: "Jungo home page", url: "https://ijungo.com/", checked: CRM_CHECKED },
        { label: "Jungo pricing", url: "https://ijungo.com/pricing/", checked: CRM_CHECKED },
      ],
    },
    {
      id: "shape",
      name: "Shape",
      website: "https://setshape.com",
      category: "AI CRM with calling and texting",
      summary:
        "Shape is an AI-powered CRM it markets to mortgage lenders and brokers, with separate offers for solo and growing teams and for multi-branch lenders. Its AI calls and texts new leads and follows up right away, and it integrates with loan origination systems.",
      bestFor: "Brokers and lenders who want AI phone calls and texts inside the CRM.",
      notFor: "You want to see a price before a sales call. Calling, texting and email are billed by usage on top of the plan.",
      highlights: [
        "AI calling and AI texting for new leads.",
        "Native LOS integrations including Encompass, LendingPad, LendingDox and Arive.",
        "Core plan priced per user; Complete includes 5 users and the AI calling bot.",
      ],
      pricing:
        "No dollar prices published. Core is per user, Complete includes 5 users, Enterprise is custom, all by quote. Calling, texting and email are pay as you go. Shape says paying annually saves up to 20%.",
      table: {
        what: "AI CRM for mortgage lenders and brokers",
        ai: "AI calling and texting to new leads",
        price: "Quote only; usage billed as you go",
        bestFor: "Brokers wanting AI calls in the CRM",
      },
      sources: [
        { label: "Shape for mortgage", url: "https://setshape.com/shape-ai-mortgage", checked: CRM_CHECKED },
        { label: "Shape pricing", url: "https://setshape.com/pricing", checked: CRM_CHECKED },
      ],
    },
    {
      id: "surefire",
      name: "Surefire",
      trademarkName: "Surefire CRM",
      website: "https://mortgagetech.ice.com/products/surefire",
      category: "Mortgage marketing CRM from ICE Mortgage Technology",
      summary:
        "Surefire, from ICE Mortgage Technology, focuses on automating mortgage marketing and deepening relationships. It runs set-and-forget workflows across social, text and print aimed at borrowers, recruits, brokers and real estate agents.",
      bestFor: "Mortgage marketers and loan officers whose company already runs on ICE and wants polished automated marketing.",
      notFor: "You want published prices or AI that responds to leads; the product page shows neither.",
      highlights: [
        "Automated marketing workflows across social, text and print.",
        "Content for borrowers, recruits, brokers and real estate agents.",
        "Part of ICE Mortgage Technology, the company behind Encompass.",
      ],
      pricing: "Not published. Contact ICE to get started.",
      table: {
        what: "Mortgage marketing CRM from ICE",
        ai: "No AI described; automated text and social",
        price: "Not published",
        bestFor: "Companies already on ICE",
      },
      sources: [{ label: "ICE Mortgage Technology: Surefire", url: "https://mortgagetech.ice.com/products/surefire", checked: CRM_CHECKED }],
    },
    {
      id: "total-expert",
      name: "Total Expert",
      website: "https://www.totalexpert.com",
      category: "Customer platform for financial institutions",
      summary:
        "Total Expert calls itself the customer operating system for financial services and sells to mortgage lenders, banks, credit unions and insurers. Its AI Sales Assistant nurtures and qualifies leads by voice, and it adds an AI SMS assistant.",
      bestFor: "Lenders, banks and credit unions rolling out one platform to many loan officers.",
      notFor: "You are an individual loan officer buying for yourself; it is sold to institutions by demo.",
      highlights: [
        "AI Sales Assistant that nurtures and qualifies leads by voice.",
        "AI SMS assistant and SMS engagement.",
        "Built for institutions and their compliance teams.",
      ],
      pricing: "Not published. Schedule a demo.",
      table: {
        what: "Customer platform for lenders and banks",
        ai: "Voice AI and AI texting",
        price: "Not published (demo)",
        bestFor: "Lenders, banks and credit unions",
      },
      sources: [{ label: "Total Expert home page", url: "https://www.totalexpert.com/", checked: CRM_CHECKED }],
    },
    {
      id: "ypn-usa",
      name: "YPN USA with Cerebro",
      trademarkName: "YPN USA",
      website: "/cerebro",
      category: "Not a CRM: the front door that brings borrowers to yours",
      summary:
        "YPN USA is marketing software for licensed loan officers, published by the company behind this page, and it is not a CRM. It fills the gap a CRM leaves: Cerebro, its AI assistant, answers borrower questions on your own page or website day and night, qualifies them and hands ready borrowers to you with a summary. Paid plans pass those leads to the CRM you already use.",
      bestFor: "Loan officers who are happy with their CRM, or don't have one yet, and need more new borrowers coming in under their own name.",
      notFor:
        "You need a full CRM for your pipeline and past clients. Keep or pick one of the CRMs above for that. YPN USA does not sell lead lists, so inquiries build over time from your own pages and profile.",
      highlights: YPN_HIGHLIGHTS,
      pricing: YPN_PRICING,
      table: {
        what: "AI assistant and local visibility; not a CRM",
        ai: "Cerebro answers and qualifies borrowers 24/7; emails follow-ups on its own or after your OK",
        price: "Free plan; paid from $99/mo, 15-day trial",
        bestFor: "LOs who need new borrowers feeding their CRM",
      },
      sources: [...YPN_SOURCES.map((s) => ({ ...s, checked: CRM_CHECKED })), { label: "YPN USA alongside your CRM", url: "/platform/loan-officer-crm", checked: CRM_CHECKED }],
      isYpn: true,
    },
  ],
  howToChoose: [
    "Count the users first. Prices here run from one seat to per-user plans to institution contracts, and the cheapest option for one loan officer is rarely the cheapest for ten.",
    "Check the LOS sync by name. Ask whether it is two-way and whether your LOS is on the list, not just \"integrations available\".",
    "Decide who makes the first contact. Some CRMs have AI that calls or texts new leads; others only send automated messages you set up.",
    "Add up the full cost: setup fees, per-user seats, texting and calling usage, and add-ons such as websites or credit checks.",
    "Ask where your new borrowers will come from. A CRM organizes leads you already have; you still need a source of new ones under your name.",
  ],
  faq: [
    {
      q: "What is the best CRM for a mortgage loan officer?",
      a: "It depends on team size and what you want automated. LoanOfficer.ai is an AI CRM with published prices from $197 a month for two seats. BNTouch is a mortgage-only CRM at $165 a month for one user with LOS sync. Jungo runs on Salesforce from $96 per user a month billed annually. Shape adds AI calling, priced by quote.",
    },
    {
      q: "What is the best CRM for mortgage brokers?",
      a: "Brokers usually want LOS sync and per-user pricing that scales. BNTouch lists $95 per user a month for 2 to 10 users with two-way LOS sync, Jungo lists direct LOS integrations including Encompass and Arive through Zapier, and Shape offers separate plans for solo and growing broker teams by quote.",
    },
    {
      q: "Is there a free CRM for loan officers?",
      a: "None of the mortgage CRMs in this guide lists a free plan. LoanOfficer.ai starts at $1 for 14 days. YPN USA has a free plan, but it is an AI assistant and lead capture tool that works alongside a CRM, not a CRM itself.",
    },
    {
      q: "Is YPN USA a CRM?",
      a: "No. YPN USA brings in and qualifies new borrowers through Cerebro on your own page, then paid plans pass those leads to the CRM you use. Your CRM stays the home for your pipeline and past clients, and your LOS stays the system of record for the loan.",
    },
    {
      q: "Do I need a CRM and an AI assistant?",
      a: "Many loan officers use both. The CRM keeps your database and follow-up; the AI assistant answers new borrowers the moment they reach out, including at night. Some CRMs, such as LoanOfficer.ai and Shape, build the AI in.",
    },
  ],
  method:
    "We read each company's own website on November 20, 2026 and describe only what those pages say, in our own words. We did not test the products or receive anything to list them. Prices and features change, so confirm on each company's site before you buy. YPN Inc. publishes this page and sells YPN USA.",
  related: [
    { label: "YPN USA alongside your CRM", href: "/platform/loan-officer-crm" },
    { label: "Mortgage CRM vs AI assistant", href: "/blog/mortgage-crm-vs-ai-assistant" },
    { label: "Comparing CRMs: solo loan officer vs team", href: "/blog/mortgage-crm-solo-loan-officer-vs-team" },
    { label: "Best AI assistants for loan officers", href: "/best-ai-assistants-for-loan-officers" },
    { label: "YPN USA vs BNTouch", href: "/vs/bntouch" },
    { label: "YPN USA vs Jungo", href: "/vs/jungo" },
    { label: "YPN USA vs LoanOfficer.ai", href: "/ypnus-vs-loanofficer-ai" },
  ],
};

export const COMPARISON_GUIDES: readonly ComparisonGuide[] = [
  BEST_AI_ASSISTANTS_GUIDE,
  LEADPOPS_ALTERNATIVES_GUIDE,
  ZILLOW_ALTERNATIVES_GUIDE,
  BEST_CRM_GUIDE,
];

/** Content review date for the sitemap's lastModified. */
export const COMPARISON_GUIDES_LAST_MODIFIED = CRM_CHECKED;
