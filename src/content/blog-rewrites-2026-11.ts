import type { BlogPost } from "@/content/blog";

/**
 * Rewrites of imported WordPress posts that were meant to rank but were broken or thin.
 *
 * A native post with the same slug replaces the imported one (src/content/blog-all.ts), so the
 * URL, its redirects and its place in the sitemap stay as they were. Same standard as the
 * answer-first posts (blog-answers-2026-11.ts): facts come only from the sources listed in the
 * post, worked examples are labeled as examples, and YPN USA claims are limited to what /cerebro,
 * /check-zip and /pricing say today.
 */

const BYLINE = "By David J. Moore, MBA · 25+ years as a loan officer, 2,000+ loans closed · NMLS #787257";
const DATE = "2026-11-19";
const AUTHOR = "David J. Moore, MBA";

/** Shown after the FAQ: the call to action and the author link. */
function closing(cta: string): string {
  return `${cta}
<p class="text-sm">Written by <a href="/about-david-moore" rel="author">David J. Moore, MBA</a>, founder of YPN USA (YPN Inc.), a loan officer for 25+ years. NMLS #787257, CA DRE #01852847.</p>`;
}

/** External source link: opens in a new tab, passes no ranking credit. */
function src(url: string, label: string): string {
  return `<li><a href="${url}" target="_blank" rel="noopener nofollow">${label}</a></li>`;
}

/**
 * Replaces the imported post of the same slug, which showed raw JSON-LD, an unrelated
 * "VA Loan Fresno" heading, "[1, 2, 3]" citation markers and an internal "linking map" note
 * in its body text.
 */
export const LOAN_OFFICER_MARKETING_STRATEGIES: BlogPost = {
  slug: "mortgage-marketing-strategies-mlo-growth-and-leads",
  title: "Loan Officer Marketing Strategies: What to Do First in 2026",
  metaTitle: "Loan Officer Marketing Strategies for 2026 | YPN USA",
  description:
    "Loan officer marketing works when you run two or three channels every week: past clients, referral partners and local search. Here is the order to start in.",
  date: DATE,
  author: AUTHOR,
  byline: BYLINE,
  readingMinutes: 8,
  cluster: "loan-officer-marketing",
  html: `<p><strong>Short answer:</strong> loan officer marketing works best when you pick two or three channels you can run every week and answer every inquiry quickly. For most loan officers the order is past clients first, referral partners second, local search third, and paid leads only after you know your cost per closed loan.</p>

<h2>1. Start with people who already know you</h2>
<p>Past clients and your personal network cost nothing to reach and already trust you. Give each past client a reason to hear from you at least twice a year: a short check-in on how the loan is going, a note when rates have moved enough that a refinance is worth a look for them, and a simple request for a review or an introduction.</p>
<p>Keep a list and a date for each contact. If you can't say how many past clients you spoke with last month, this is the channel to fix first.</p>

<h2>2. Build a small referral-partner list you actually work</h2>
<p>A handful of partners you contact on a schedule beats dozens you never talk to. Common partners are real estate agents, financial advisors and CPAs, divorce and estate attorneys, and builders. Give them something useful: a pre-approval process that makes their buyers' offers stronger, a plain-English guide they can hand to clients, and a fast answer when they call.</p>
<p><strong>Mind RESPA Section 8.</strong> The CFPB treats payments for referrals of settlement business as prohibited. A marketing arrangement can be lawful when it is for marketing services actually performed and the payments are reasonably related to the value of those services, but the CFPB looks at the facts of each arrangement. Have your compliance team approve any co-marketing deal before you sign it. Our guide to <a href="/blog/how-to-get-more-mortgage-referrals-beyond-realtors">getting mortgage referrals beyond Realtors</a> covers partners outside real estate.</p>

<h2>3. Show up where borrowers search</h2>
<p>Local search is slow to build and cheap to keep. Claim your Google Business Profile, keep your name, address and phone number identical everywhere, ask every happy client for a review, and publish pages that answer local questions: how much a buyer needs in your town, which assistance programs apply, and what happens between pre-approval and closing. See our <a href="/blog/how-to-optimize-your-google-business-profile-as-a-loan-officer-2026-checklist">Google Business Profile checklist for loan officers</a> and how to <a href="/blog/how-to-get-more-google-reviews-as-a-loan-officer">get more Google reviews</a>.</p>

<h2>4. Answer the questions borrowers already ask</h2>
<p>You answer the same questions every week: how much do I need down, what is the difference between pre-qualified and pre-approved, how long does closing take. Each one can be a short page or a 60-second video. Start with the three questions you hear most and publish one a week. More ideas are in our <a href="/blog/mortgage-marketing-ideas-for-loan-officers">mortgage marketing ideas for loan officers</a> and <a href="/blog/video-marketing-for-loan-officers-ideas-and-simple-scripts">video ideas and simple scripts</a>.</p>

<h2>5. Decide on paid leads with math, not hope</h2>
<p>Buying leads can work, but only when your cost per closed loan stays below what you earn on a closed loan. <a href="/blog/is-buying-mortgage-leads-worth-it">Is buying mortgage leads worth it?</a> shows the calculation, and <a href="/blog/what-to-check-before-buying-mortgage-leads-in-a-zip-code">what to check before buying mortgage leads in a ZIP code</a> lists what to ask a vendor. Avoid any deal where you pay per closed loan to the party that sends you the borrower, which can run into RESPA, and have compliance review every vendor.</p>

<h2>6. Follow up fast, and get consent first</h2>
<p>A borrower who fills out a form may be contacting other lenders too, so a quick, helpful reply matters more than a clever one. Set a target for how fast you answer and measure it. Our guide to <a href="/blog/speed-to-lead-for-mortgage-loan-officers">speed to lead</a> shows how.</p>
<p>If you will call or text borrowers with an autodialer or a prerecorded voice, the FCC's rules under the Telephone Consumer Protection Act generally require the borrower's prior express written consent for marketing messages. Keep a record of each consent, and read <a href="/blog/text-message-marketing-for-loan-officers">text message marketing for loan officers</a> before you start.</p>

<h2>What to track each month</h2>
<ul>
<li><strong>Leads by source:</strong> where each inquiry came from.</li>
<li><strong>Time to first reply:</strong> how long a new inquiry waits for you.</li>
<li><strong>Applications and closed loans by source.</strong></li>
<li><strong>Cost per closed loan</strong> = what you spent on a channel ÷ loans closed from it. Measure over at least 90 days, because mortgage leads take weeks to months to close.</li>
</ul>
<p>Drop the channel with the weakest results, and spend that time on the one with the best.</p>

<h2>A 30-day plan</h2>
<ol>
<li><strong>Week 1:</strong> list your past clients and contact the first twenty. Ask each for a review or an introduction.</li>
<li><strong>Week 2:</strong> pick four referral partners and set up one useful thing for each: a guide, a call, or a coffee.</li>
<li><strong>Week 3:</strong> claim or clean up your Google Business Profile and publish your first local page.</li>
<li><strong>Week 4:</strong> set up the tracking list above and write down your reply-time target. Review what worked, then keep two channels and add a third.</li>
</ol>

<h2>Mistakes to avoid</h2>
<ul>
<li><strong>Running too many channels at once.</strong> Two done every week beat six done when you remember.</li>
<li><strong>Buying leads before you know your numbers.</strong> Price per lead is not the cost that matters.</li>
<li><strong>Leaving inquiries unanswered overnight or over the weekend.</strong></li>
<li><strong>Paying for referrals,</strong> directly or through a marketing arrangement that is not for real services.</li>
<li><strong>Leaving out required licensing information.</strong> Check with your state regulator and your company what your ads and web pages must show, such as your NMLS ID.</li>
</ul>

<h2>Sources</h2>
<ul>
${src("https://www.consumerfinance.gov/compliance/compliance-resources/mortgage-resources/real-estate-settlement-procedures-act/real-estate-settlement-procedures-act-faqs/", "CFPB: Real Estate Settlement Procedures Act FAQs (Section 8, marketing services agreements)")}
${src("https://www.consumerfinance.gov/rules-policy/regulations/1024/14/", "CFPB: 12 CFR 1024.14, prohibition against kickbacks and unearned fees")}
${src("https://www.fcc.gov/consumers/guides/stop-unwanted-robocalls-and-texts", "FCC: Stop unwanted robocalls and texts (consent for marketing calls and texts)")}
${src("https://docs.fcc.gov/public/attachments/FCC-12-21A1.pdf", "FCC 12-21: prior express written consent for autodialed and prerecorded telemarketing calls")}
</ul>`,
  faq: [
    {
      q: "What are some effective marketing ideas for loan officers?",
      a: "Contact past clients at least twice a year, build a small list of referral partners you work on a schedule, keep your Google Business Profile and reviews current, publish pages that answer local borrower questions, and reply to every inquiry quickly. Pick two or three and run them every week.",
    },
    {
      q: "How do loan officers get customers?",
      a: "Mostly through referrals from past clients and partners such as real estate agents, through local search, and through paid or portal leads. The mix matters less than measuring each source's cost per closed loan.",
    },
    {
      q: "How much does a loan officer make on a $500,000 loan?",
      a: "It depends on the compensation plan, which varies by employer and loan type. Pay is often a percentage of the loan amount, so the dollar figure is the loan amount times your rate. As an example of the math only, 0.50% of $500,000 is $2,500 and 1.00% is $5,000. These are not typical pay figures.",
      html: 'It depends on the compensation plan, which varies by employer and loan type. Pay is often a percentage of the loan amount, so the dollar figure is the loan amount times your rate. As an example of the math only, 0.50% of $500,000 is $2,500 and 1.00% is $5,000. These are not typical pay figures. See <a href="/blog/how-much-do-loan-officers-make-per-loan">how much loan officers make per loan</a>.',
    },
    {
      q: "Do I need real estate agents to get mortgage leads?",
      a: "No. Agents are a common source, but past clients, financial advisors, CPAs, attorneys, local search and your own content can also bring in borrowers.",
      html: 'No. Agents are a common source, but past clients, financial advisors, CPAs, attorneys, local search and your own content can also bring in borrowers. See <a href="/blog/how-to-get-more-mortgage-referrals-beyond-realtors">how to get mortgage referrals beyond Realtors</a>.',
    },
  ],
  closingHtml: closing(
    `<p><strong>Want leads you don't share?</strong> YPN USA gives one loan officer each ZIP code within YPN USA. <a href="/check-zip">Check if your ZIP code is open</a> or <a href="/pricing">see plans</a>, starting free.</p>`,
  ),
};

export const REWRITTEN_POSTS: readonly BlogPost[] = [LOAN_OFFICER_MARKETING_STRATEGIES];
