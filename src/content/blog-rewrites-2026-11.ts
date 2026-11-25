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

const CFPB_RESPA_FAQ =
  "https://www.consumerfinance.gov/compliance/compliance-resources/mortgage-resources/real-estate-settlement-procedures-act/real-estate-settlement-procedures-act-faqs/";
const CFPB_1024_14 = "https://www.consumerfinance.gov/rules-policy/regulations/1024/14/";
const FTC_CAN_SPAM = "https://www.ftc.gov/business-guidance/resources/can-spam-act-compliance-guide-business";
const FCC_ROBOTEXTS = "https://www.fcc.gov/consumers/guides/stop-unwanted-robocalls-and-texts";
const FCC_12_21 = "https://docs.fcc.gov/public/attachments/FCC-12-21A1.pdf";
const NAR_2025 = "https://www.nar.realtor/magazine/real-estate-news/nar-2025-profile-of-home-buyers-sellers-reveals-market-extremes";

/**
 * Replaces the imported post of the same slug, which repeated its sections twice, carried an
 * internal "linking map" note and described cost-splitting as safe without a source.
 */
export const RESPA_CO_MARKETING: BlogPost = {
  slug: "respa-compliant-realtor-co-marketing-ideas-for-loan-officers",
  title: "RESPA-Compliant Co-Marketing Ideas for Loan Officers and Realtors",
  metaTitle: "RESPA-Compliant Co-Marketing for Loan Officers",
  description:
    "Co-marketing with a Realtor can be lawful under RESPA when each payment is for marketing actually performed. Ideas, red flags and what to document.",
  date: DATE,
  author: AUTHOR,
  byline: BYLINE,
  readingMinutes: 7,
  cluster: "loan-officer-marketing",
  html: `<p><strong>Short answer:</strong> co-marketing with a real estate agent can be lawful when each side pays only for marketing it actually receives, at a price that reflects what that marketing is worth by itself, and nothing of value changes hands in exchange for referrals. Anything that rewards an agent for sending you borrowers, or you for sending buyers to an agent, is the problem. This is general information, not legal advice: have your compliance team or counsel approve any arrangement before you start.</p>

<h2>The rule in plain English</h2>
<p>Section 8 of the Real Estate Settlement Procedures Act (RESPA), implemented in Regulation X at 12 CFR 1024.14, prohibits giving or accepting a fee, kickback or other thing of value for referring settlement service business on a federally related mortgage loan. A mortgage loan is one of those settlement services.</p>
<p>The regulation also says a payment is not prohibited when it is a bona fide payment for goods or facilities actually furnished or services actually performed, and that a payment with no reasonable relationship to the market value of what was provided is not for services actually performed. The value of any business the payment might bring in cannot be counted when deciding what the service is worth.</p>
<p>The CFPB's RESPA FAQs apply the same idea to marketing arrangements: payments for referrals are prohibited, while payments for marketing services that are actually provided may be permitted, depending on the facts of the arrangement. The CFPB withdrew its 2015 bulletin on marketing services agreements in October 2020 and said that doing so does not make these agreements presumptively legal. Judge each deal by its facts, not by a template.</p>

<h2>Ideas that can fit the rule</h2>
<p>Each idea works only if every party pays for the part that promotes that party, and the price matches what that placement or service would cost on its own. Confirm the structure with compliance before you commit.</p>
<ul>
<li><strong>A co-branded flyer or listing page.</strong> You and the agent each appear, and each pays for the share of the piece that promotes you, priced at what that space would cost without the other party.</li>
<li><strong>A first-time buyer workshop you both present.</strong> Each of you covers your own costs, such as your own materials and your own time. Neither pays for the other's.</li>
<li><strong>Your own education, shared on both channels.</strong> A buyer guide or a market update you produce and pay for, which the agent may share on their own channels at no charge to you and with no payment to them.</li>
<li><strong>A pre-approval process the agent's buyers can use.</strong> This is your own service delivered to the agent's client, not a payment to the agent.</li>
<li><strong>An open house where you answer financing questions.</strong> You attend, answer questions and pay your own costs. See <a href="/blog/how-to-turn-open-house-visitors-into-pre-approved-buyers-with-custom-portals">turning open house visitors into pre-approved buyers</a>.</li>
</ul>

<h2>Red flags</h2>
<ul>
<li><strong>Paying more than the going rate</strong> for ad space, a lead list or a service so the agent comes out ahead.</li>
<li><strong>Paying for marketing that does not promote you,</strong> such as an agent's own listing advertising.</li>
<li><strong>"Marketing" with no deliverable:</strong> no piece, no date, no proof it ran.</li>
<li><strong>Free leads, gifts, trips or event tickets</strong> tied to referrals.</li>
<li><strong>Payment that rises with the number of referrals,</strong> or any tracking of who sent you what next to what you paid them.</li>
<li><strong>Talking about volume while you negotiate the marketing terms.</strong> Keep the two apart, and say so in writing.</li>
</ul>

<h2>What to document</h2>
<ol>
<li>A written agreement that names the marketing service, who receives it, how long it runs and what each side pays.</li>
<li>How the price was set, for example a rate card or two or three comparable quotes for the same placement.</li>
<li>Proof the service was performed: a copy of the piece, the date it ran, photos or screenshots.</li>
<li>Your compliance approval, with the date.</li>
<li>A yearly review. Prices, partners and your referral patterns change, and an arrangement that was fine can stop being fine.</li>
</ol>

<h2>Where this fits in your plan</h2>
<p>Co-marketing is one channel among several, and it depends on one agent staying with you. Pair it with sources you own, such as past clients and your own local pages. Start with <a href="/blog/how-to-approach-a-realtor-as-a-loan-officer-without-getting-brushed-off">how to approach a Realtor without getting brushed off</a>, then read <a href="/blog/co-marketing-compliance-how-mlos-and-agents-can-legally-share-lead-costs">co-marketing compliance and sharing lead costs</a> and <a href="/blog/the-realtor-co-marketing-playbook-how-mlos-build-referral-pipelines-that-work">the Realtor co-marketing playbook</a>. For partners outside real estate, see <a href="/blog/how-to-get-more-mortgage-referrals-beyond-realtors">mortgage referrals beyond Realtors</a>. New to agent outreach? Read <a href="/blog/how-to-get-realtor-referrals">how to get Realtor referrals</a>, and for workshop ideas see <a href="/blog/first-time-homebuyer-marketing-for-loan-officers-2">first-time homebuyer marketing</a>.</p>

<h2>Before you sign: a five-question check</h2>
<ul>
<li>Does each party receive the marketing it pays for?</li>
<li>Is each price one you could defend with a comparable quote?</li>
<li>Would the arrangement look the same if the agent never sent you a borrower?</li>
<li>Is it in writing, and has compliance approved it?</li>
<li>Can you show that the marketing actually ran?</li>
</ul>
<p>If the answer to any of these is no, stop and fix it first.</p>

<h2>Sources</h2>
<ul>
${src(CFPB_RESPA_FAQ, "CFPB: Real Estate Settlement Procedures Act FAQs (Section 8 and marketing services agreements)")}
${src(CFPB_1024_14, "CFPB: 12 CFR 1024.14, prohibition against kickbacks and unearned fees")}
${src("https://www.consumerfinance.gov/compliance/guidance/withdrawn-guidance/", "CFPB: Withdrawn guidance (2015 bulletin on marketing services agreements)")}
</ul>`,
  faq: [
    {
      q: "Is co-marketing with a Realtor legal under RESPA?",
      a: "It can be. RESPA Section 8 prohibits payments or other things of value for referrals, but permits bona fide payments for goods or services actually provided at a price reasonably related to their market value. Each arrangement is judged on its facts, so have compliance or counsel review it.",
    },
    {
      q: "Can I split the cost of a flyer with an agent?",
      a: "Possibly, if each side pays for the part that promotes it at a price that reflects what that placement is worth by itself, and nothing is exchanged for referrals. Paying more than your share, or paying for marketing that does not promote you, is a red flag. Confirm the structure with compliance first.",
    },
    {
      q: "Can I give agents free leads or gifts?",
      a: "Not in exchange for referrals. A thing of value given because an agent sends you business can violate Section 8. Ask compliance before giving agents leads, gifts, tickets or paid services.",
    },
    {
      q: "Do I need a written agreement for co-marketing?",
      a: "It is the safest practice. A written agreement that names the service, the price, how the price was set and the dates, together with proof the marketing ran, makes it much easier to show the payment was for real services.",
    },
    {
      q: "Did the CFPB make marketing services agreements legal?",
      a: "No. The CFPB withdrew its 2015 bulletin on them in October 2020 and said that did not make them presumptively legal. Section 8 and Regulation X still apply.",
    },
  ],
  closingHtml: closing(
    `<p><strong>Want demand that does not depend on one agent?</strong> YPN USA gives one loan officer each ZIP code within YPN USA. <a href="/check-zip">Check if your ZIP code is open</a> or <a href="/pricing">see plans</a>, starting free.</p>`,
  ),
};

export const NEW_LOAN_OFFICER_CLIENTS: BlogPost = {
  slug: "how-to-get-clients-as-a-new-loan-officer-no-database-no-budget",
  title: "How to Get Clients as a New Loan Officer (No Database, No Budget)",
  metaTitle: "How to Get Clients as a New Loan Officer | YPN USA",
  description:
    "New loan officers get clients by working their personal network, one agent relationship and a simple local presence every week. Here is a 30-day plan.",
  date: DATE,
  author: AUTHOR,
  byline: BYLINE,
  readingMinutes: 8,
  cluster: "loan-officer-marketing",
  html: `<p><strong>Short answer:</strong> with no database and no budget, a new loan officer gets clients by talking to people who already know them, building one real relationship with a local agent, answering common borrower questions in public, and doing it every week for at least 90 days. You do not need ad spend to start, but you do need a list, a schedule and a way to track results.</p>

<h2>Before you start</h2>
<p>Your employer's compliance team decides what your emails, social posts and web pages must say and who must approve them. Ask for those rules in your first week, including how to show your NMLS ID. Rules differ by company and state, so check with your state regulator and your company rather than copying another loan officer's materials.</p>

<h2>Week 1: build your list and make 20 conversations</h2>
<p>Write down every person you know who owns a home, rents, or is thinking about moving: family, friends, former coworkers, neighbors, teammates, members of your congregation or gym. Aim for 100 names. You are not selling anything yet; you are telling people what you do and asking who they know.</p>
<p>A message that works is short and personal: "I'm now a loan officer at [company]. If you or someone you know is thinking about buying or refinancing, I'd be glad to help or just answer questions." Send it one person at a time, and follow up by phone with the people who reply.</p>
<p><strong>Email and text rules still apply.</strong> The FTC's CAN-SPAM rules cover commercial email: no misleading subject lines or headers, a valid postal address, a clear way to opt out, and opt-outs honored within 10 business days. The FCC generally requires prior express written consent for marketing calls or texts sent with an autodialer or a prerecorded voice. A one-to-one note to a friend is different from a bulk campaign, so ask compliance where the line is.</p>

<h2>Week 2: build one real relationship with an agent</h2>
<p>In NAR's 2025 Profile of Home Buyers and Sellers, 88% of buyers used a real estate agent or broker, so agents are close to every purchase. They are also a single point of failure: if your only source stops sending you business, so does your pipeline. Pick one agent, not twenty. Offer something useful: a fast pre-approval, a one-page buyer guide the agent can hand out, or an honest answer to a hard financing question. Our guide to <a href="/blog/how-to-approach-a-realtor-as-a-loan-officer-without-getting-brushed-off">approaching a Realtor without getting brushed off</a> has scripts.</p>
<p><strong>Do not pay for referrals.</strong> RESPA Section 8 prohibits fees or other things of value for referrals of settlement business. Read <a href="/blog/respa-compliant-realtor-co-marketing-ideas-for-loan-officers">RESPA-compliant co-marketing ideas</a> before you offer an agent anything beyond your own work.</p>

<h2>Week 3: pick a niche you can explain in one sentence</h2>
<p>A new loan officer cannot out-spend established ones, but can know one group of borrowers better. Pick one or two: first-time buyers, self-employed borrowers, veterans, buyers who need down payment help in your county. Learn the programs and the paperwork for that group, and say it plainly: "I help self-employed buyers in [town] get approved." See <a href="/blog/first-time-homebuyer-marketing-for-loan-officers-2">first-time homebuyer marketing</a> and <a href="/blog/marketing-down-payment-assistance-dpa-programs-to-capture-first-time-homebuyers">marketing down payment assistance programs</a> for two good starting points.</p>

<h2>Week 4: give people somewhere to find you</h2>
<ul>
<li><strong>One page that explains what you do,</strong> with your name, NMLS ID, phone number, a short form and the areas you serve, if your company allows a personal page.</li>
<li><strong>One answer a week.</strong> Pick a question borrowers ask you, such as "pre-qualified or pre-approved?", and answer it in a short post or a 60-second video. See <a href="/blog/video-marketing-for-loan-officers-ideas-and-simple-scripts">video ideas and simple scripts</a>.</li>
<li><strong>Reviews.</strong> After each closing, ask the client for an honest review. See <a href="/blog/how-to-get-more-google-reviews-as-a-loan-officer">how to get more Google reviews</a>.</li>
</ul>

<h2>Reply fast and follow up</h2>
<p>Someone who asks you a question may be asking other lenders too, so a quick, helpful reply wins more often than a polished one. Decide how fast you will answer and track it. Then follow up: many borrowers need weeks or months before they are ready. A simple routine is in <a href="/blog/speed-to-lead-for-mortgage-loan-officers">speed to lead</a> and <a href="/blog/email-follow-up-sequences-for-loan-officers-with-templates">email follow-up sequences</a>.</p>

<h2>Give it 90 days, and measure activity</h2>
<p>Mortgage business arrives slowly, so judge your first 90 days on what you control. Write down each week:</p>
<ul>
<li>Conversations you had with people on your list.</li>
<li>Agents and other partners you met or followed up with.</li>
<li>Pieces of content you published.</li>
<li>Inquiries, applications and closings, and where each came from.</li>
</ul>
<p>After 90 days, keep the two sources that produced inquiries and put more time there. For a fuller menu, see <a href="/blog/how-to-get-mortgage-leads-without-buying-them-a-loan-officers-2026-playbook">how to get mortgage leads without buying them</a> and <a href="/blog/mortgage-marketing-strategies-mlo-growth-and-leads">loan officer marketing strategies</a>.</p>

<h2>Mistakes new loan officers make</h2>
<ul>
<li><strong>Relying on one agent or one platform.</strong></li>
<li><strong>Blasting everyone on a list</strong> instead of starting real conversations.</li>
<li><strong>Quitting in week four,</strong> before any source has had time to work.</li>
<li><strong>Buying leads before you know your own numbers.</strong> See <a href="/blog/is-buying-mortgage-leads-worth-it">is buying mortgage leads worth it?</a></li>
<li><strong>Using ads or pages your compliance team has not approved.</strong></li>
</ul>

<h2>Sources</h2>
<ul>
${src(NAR_2025, "NAR: 2025 Profile of Home Buyers and Sellers (share of buyers who used an agent)")}
${src(CFPB_RESPA_FAQ, "CFPB: Real Estate Settlement Procedures Act FAQs (Section 8)")}
${src(FTC_CAN_SPAM, "FTC: CAN-SPAM Act, a compliance guide for business")}
${src(FCC_ROBOTEXTS, "FCC: Stop unwanted robocalls and texts (consent for marketing calls and texts)")}
${src(FCC_12_21, "FCC 12-21: prior express written consent for autodialed and prerecorded telemarketing calls")}
</ul>`,
  faq: [
    {
      q: "How do new loan officers get their first clients?",
      a: "Mostly from people who already know them: family, friends, former coworkers and neighbors, plus one or two local real estate agents who see how fast and clear they are. Build a list of 100 names, have conversations every week, and ask each person who they know who is thinking about buying or refinancing.",
    },
    {
      q: "How long does it take a new loan officer to get clients?",
      a: "It varies, and there is no reliable benchmark. Mortgage inquiries often take weeks or months to turn into closings, so judge your first 90 days on activity you control, such as conversations, partner meetings and follow-ups, and on where inquiries come from.",
    },
    {
      q: "Do I need a Realtor to start as a loan officer?",
      a: "No. Agents are a common source, but past clients, your personal network, financial advisors, CPAs, local search and your own content can also bring in borrowers. Do not pay an agent for referrals.",
    },
    {
      q: "Can I get mortgage clients with no marketing budget?",
      a: "Yes, to start. Your network, agent relationships, reviews and a weekly piece of useful content cost time, not money. Add paid channels only after you know what a closed loan from each source costs you.",
    },
  ],
  closingHtml: closing(
    `<p><strong>Want local borrowers you don't share with other loan officers?</strong> YPN USA gives one loan officer each ZIP code within YPN USA. <a href="/check-zip">Check if your ZIP code is open</a> or <a href="/pricing">see plans</a>, starting free.</p>`,
  ),
};

export const MORTGAGE_LEAD_GENERATION: BlogPost = {
  slug: "10-proven-strategies-for-mortgage-loan-lead-generation-in-2026",
  title: "Mortgage Lead Generation: 10 Strategies That Work in 2026",
  metaTitle: "Mortgage Lead Generation: 10 Strategies for 2026",
  description:
    "Ten mortgage lead generation strategies for loan officers, each with what to measure and the compliance trap to avoid, from past clients to paid leads.",
  date: DATE,
  author: AUTHOR,
  byline: BYLINE,
  readingMinutes: 9,
  cluster: "loan-officer-marketing",
  html: `<p><strong>Short answer:</strong> the mortgage lead generation strategies that hold up are the ones a loan officer can run every week and measure: past clients, agent and other referral partners, local search, a page that captures inquiries, email follow-up, short educational content, events, paid ads, and purchased leads last. Start with two or three, track cost per closed loan, and drop what does not pay.</p>

<h2>1. Past clients and your database</h2>
<p>People who have already closed with you cost nothing to reach. Contact each at least twice a year with something useful: a check-in on their loan, a note when a refinance may be worth a look, a request for an introduction. <strong>Measure:</strong> conversations per month and referrals received. <strong>Watch out:</strong> email must follow CAN-SPAM; see strategy 6.</p>

<h2>2. Real estate agent partnerships</h2>
<p>In NAR's 2025 Profile of Home Buyers and Sellers, 88% of buyers used an agent or broker, so agents sit next to most purchases. Work with a few agents deeply rather than many lightly. <strong>Measure:</strong> files per partner, and the share of your business any single partner supplies. <strong>Watch out:</strong> RESPA Section 8 prohibits payments or other things of value for referrals. See <a href="/blog/respa-compliant-realtor-co-marketing-ideas-for-loan-officers">RESPA-compliant co-marketing ideas</a> and <a href="/blog/how-loan-officers-get-realtor-referrals-7-co-marketing-plays-that-work-in-2026">7 co-marketing plays</a>.</p>

<h2>3. Referral partners outside real estate</h2>
<p>Financial advisors, CPAs, divorce and estate attorneys, builders and employers meet people before they start house hunting. <strong>Measure:</strong> introductions per partner per quarter. <strong>Watch out:</strong> the same Section 8 rule applies. See <a href="/blog/how-to-get-more-mortgage-referrals-beyond-realtors">mortgage referrals beyond Realtors</a> and <a href="/blog/linkedin-for-loan-officers-how-to-build-referral-partnerships">LinkedIn for referral partnerships</a>.</p>

<h2>4. Local search and reviews</h2>
<p>People searching for a lender near them see the Google Business Profile, the reviews and the pages that answer local questions. <strong>Measure:</strong> reviews added each month, calls and direction requests from your profile. <strong>Watch out:</strong> do not pay for or fake reviews. See the <a href="/blog/how-to-optimize-your-google-business-profile-as-a-loan-officer-2026-checklist">Google Business Profile checklist</a> and <a href="/blog/how-to-get-more-google-reviews-as-a-loan-officer">how to get more reviews</a>.</p>

<h2>5. A page that captures inquiries</h2>
<p>Traffic is wasted without somewhere to send it. A page with a clear offer, your name and NMLS ID, a short form and your phone number turns visits into inquiries. <strong>Measure:</strong> the share of visitors who submit the form. <strong>Watch out:</strong> have compliance approve the wording and the disclosures. See <a href="/blog/how-to-build-a-mortgage-lead-capture-page-no-designer-needed">how to build a lead capture page</a>.</p>

<h2>6. Email follow-up</h2>
<p>Most people who ask about a mortgage are not ready the same day. A short sequence of useful emails keeps you in mind. <strong>Measure:</strong> replies and appointments, not opens. <strong>Watch out:</strong> CAN-SPAM requires accurate headers and subject lines, a valid postal address, a clear opt-out, and honoring opt-outs within 10 business days, and you stay responsible even if a vendor sends the email. See <a href="/blog/email-follow-up-sequences-for-loan-officers-with-templates">email follow-up sequences</a> and <a href="/blog/crm-drip-workflows-for-mlo-follow-up">CRM drip workflows</a>.</p>

<h2>7. Short educational video and social posts</h2>
<p>Answer the question you heard this week in 60 seconds. It builds familiarity before anyone needs a loan. <strong>Measure:</strong> inquiries that mention a post, not likes. <strong>Watch out:</strong> ads and posts that advertise terms or rates have disclosure requirements; ask compliance. See <a href="/blog/video-marketing-for-loan-officers-ideas-and-simple-scripts">video ideas and scripts</a> and <a href="/blog/social-media-marketing-for-loan-officers-what-actually-works-in-2026">what actually works on social media</a>.</p>

<h2>8. Workshops and events</h2>
<p>A first-time buyer class, a lunch for agents, or a Q&amp;A at an open house gives people a reason to meet you. <strong>Measure:</strong> attendees who book a follow-up call. <strong>Watch out:</strong> if an agent co-hosts, each side pays its own costs, and nothing is exchanged for referrals. See <a href="/blog/how-to-turn-open-house-visitors-into-pre-approved-buyers-with-custom-portals">turning open house visitors into pre-approved buyers</a>.</p>

<h2>9. Paid advertising</h2>
<p>Ads can work when your page and follow-up are ready. Start with a small test and a single local offer. <strong>Measure:</strong> cost per inquiry, cost per application and cost per closed loan. <strong>Watch out:</strong> ad claims and disclosures, and the rules on calling or texting people who respond. See the <a href="/blog/facebook-lead-generation-for-mortgage-real-estate-professionals-the-2026-guide">Facebook lead generation guide</a>.</p>

<h2>10. Purchased or exclusive leads, last</h2>
<p>Buy leads only after you know what a closed loan from your own sources costs you. <strong>Measure:</strong> cost per closed loan, over at least 90 days. <strong>Watch out:</strong> do not pay per closed loan to the party that sends you the borrower, which can run into RESPA, and the FCC's consent rules apply to calls and texts to leads. For autodialed or prerecorded marketing calls and texts, the FCC generally requires prior express written consent. See <a href="/blog/is-buying-mortgage-leads-worth-it">is buying mortgage leads worth it?</a> and <a href="/blog/what-to-check-before-buying-mortgage-leads-in-a-zip-code">what to check before buying leads in a ZIP code</a>.</p>

<h2>A simple scorecard</h2>
<ul>
<li><strong>Leads by source,</strong> monthly.</li>
<li><strong>Time to first reply.</strong> See <a href="/blog/speed-to-lead-for-mortgage-loan-officers">speed to lead</a>.</li>
<li><strong>Applications and closed loans by source.</strong></li>
<li><strong>Cost per closed loan</strong> = what you spent on a source ÷ loans closed from it.</li>
</ul>
<p>Example, for the math only: if you spend $2,000 on a channel in 90 days and it produces 2 closed loans, your cost per closed loan is $1,000. Whether that is good depends on what you earn per loan. Keep the sources with the lowest cost per closed loan and cut the weakest.</p>
<p>For the order to start in, read <a href="/blog/mortgage-marketing-strategies-mlo-growth-and-leads">loan officer marketing strategies</a>. For a plan that avoids shared leads, read <a href="/blog/how-to-get-mortgage-leads-without-buying-them-a-loan-officers-2026-playbook">how to get mortgage leads without buying them</a>.</p>

<h2>Sources</h2>
<ul>
${src(NAR_2025, "NAR: 2025 Profile of Home Buyers and Sellers (share of buyers who used an agent)")}
${src(CFPB_RESPA_FAQ, "CFPB: Real Estate Settlement Procedures Act FAQs (Section 8)")}
${src(CFPB_1024_14, "CFPB: 12 CFR 1024.14, prohibition against kickbacks and unearned fees")}
${src(FTC_CAN_SPAM, "FTC: CAN-SPAM Act, a compliance guide for business")}
${src(FCC_ROBOTEXTS, "FCC: Stop unwanted robocalls and texts (consent for marketing calls and texts)")}
</ul>`,
  faq: [
    {
      q: "What is the best way to generate mortgage leads?",
      a: "There is no single best way. The strategies that last are past-client and referral-partner outreach, local search and reviews, and fast follow-up. Run two or three, measure cost per closed loan for each, and drop the weakest.",
    },
    {
      q: "Is it legal to buy mortgage leads?",
      a: "Buying leads is common, but the arrangement has to follow RESPA, which prohibits paying for referrals of settlement business, and the FCC's consent rules for calls and texts. Have compliance review every vendor and contract.",
    },
    {
      q: "How do I measure whether a lead source is working?",
      a: "Track leads, applications and closed loans by source, then divide what you spent by the loans closed. Measure over at least 90 days, because mortgage leads take weeks to months to close.",
    },
    {
      q: "How many mortgage leads does a loan officer need?",
      a: "It depends on how many leads become applications and how many applications close, and both vary by source and by loan officer. Track your own rates for a quarter, then work backward from the number of closings you want.",
    },
  ],
  closingHtml: closing(
    `<p><strong>Want leads you don't share?</strong> YPN USA gives one loan officer each ZIP code within YPN USA. <a href="/check-zip">Check if your ZIP code is open</a> or <a href="/pricing">see plans</a>, starting free.</p>`,
  ),
};

const CFPB_REG_Z_ADS = "https://www.consumerfinance.gov/rules-policy/regulations/1026/24/";
const ECFR_REG_N = "https://www.ecfr.gov/current/title-12/chapter-X/part-1014";
const WEB_VITALS = "https://web.dev/articles/vitals";
const HUD_FHA = "https://answers.hud.gov/FHA/s/article/How-can-FHA-help-me-buy-a-home";
const VA_PURCHASE = "https://www.va.gov/housing-assistance/home-loans/loan-types/purchase-loan/";
const USDA_GUARANTEED = "https://www.rd.usda.gov/programs-services/single-family-housing-programs/single-family-housing-guaranteed-loan-program";
const FANNIE_HOMEREADY = "https://singlefamily.fanniemae.com/originating-underwriting/mortgage-products/homeready-mortgage";
const GOOGLE_SENDERS = "https://support.google.com/mail/answer/81126";

/**
 * Replaces the imported landing-page post: it said faces and one-second load times "measurably"
 * move conversions with no source, quoted an invented testimonial, and ended in a templated
 * "MLO production playbook" section.
 */
export const LANDING_PAGE_EXAMPLES: BlogPost = {
  slug: "9-mortgage-landing-page-examples-that-convert-and-why-they-work",
  title: "Mortgage Landing Page Examples: 9 Page Types for Loan Officers",
  metaTitle: "Mortgage Landing Page Examples for Loan Officers",
  description:
    "Nine mortgage landing page types for loan officers, from local pre-approval to niche pages, with what goes on each and the advertising rules to check first.",
  date: DATE,
  author: AUTHOR,
  byline: BYLINE,
  readingMinutes: 8,
  cluster: "loan-officer-websites",
  html: `<p><strong>Short answer:</strong> a mortgage landing page works best when it makes one promise, asks for one action, shows who you are and that you are licensed, and loads fast on a phone. Below are nine page types loan officers use, what belongs on each, and the advertising rules to check before any of them goes live. Which one performs best for you is something to test with your own traffic, not something any article can promise.</p>

<h2>The pattern behind all nine</h2>
<ul>
<li><strong>One promise</strong> in the headline, in plain words.</li>
<li><strong>One action:</strong> a short form or a call button, not five choices.</li>
<li><strong>Who you are:</strong> your name, a real photo, your NMLS ID and the states you are licensed in.</li>
<li><strong>Local words:</strong> the city or ZIP code the visitor typed.</li>
<li><strong>A fast reply</strong> after the form is sent. See <a href="/blog/speed-to-lead-for-mortgage-loan-officers">speed to lead</a>.</li>
</ul>

<h2>1. The local pre-approval page</h2>
<p><strong>Promise:</strong> "Get pre-approved in [city]." <strong>On the page:</strong> a short form above the fold, what happens after you submit, and the documents you will ask for. <strong>Why it can work:</strong> it matches what a local borrower searched for.</p>

<h2>2. The rate-quote page</h2>
<p><strong>Promise:</strong> a rate quote without a long application. <strong>Watch out:</strong> this is the page most likely to trip advertising rules. If it states a rate, it triggers disclosure rules (see "Rules to check first"). Only promise "no credit impact" if that is true for how you pull credit, and say what the quote assumes.</p>

<h2>3. The first-time buyer page</h2>
<p><strong>Promise:</strong> a plain-English path from "can I afford this?" to keys. <strong>On the page:</strong> the programs you actually offer, a short checklist and one call to action. Pair it with <a href="/blog/marketing-down-payment-assistance-dpa-programs-to-capture-first-time-homebuyers">down payment assistance marketing</a> and <a href="/blog/first-time-homebuyer-marketing-for-loan-officers-2">first-time homebuyer marketing</a>.</p>

<h2>4. The refinance or cash-out page</h2>
<p><strong>Promise:</strong> a review of whether refinancing makes sense for one specific reason, such as shortening the term or using equity. <strong>Why it can work:</strong> it targets a life event instead of everyone. <strong>Watch out:</strong> do not imply a payment or savings figure you cannot back up for that visitor.</p>

<h2>5. The Realtor co-branded page</h2>
<p><strong>Promise:</strong> a financing path for an agent's buyers, with both of you shown. <strong>Watch out:</strong> a co-branded page is co-marketing, so each side should pay for the part that promotes it and nothing should be exchanged for referrals. Read <a href="/blog/respa-compliant-realtor-co-marketing-ideas-for-loan-officers">RESPA-compliant co-marketing ideas</a> and <a href="/blog/how-mlos-can-build-automated-co-branded-landing-pages-for-local-realtors">building co-branded landing pages for local Realtors</a> first.</p>

<h2>6. The speed page</h2>
<p><strong>Promise:</strong> "answers within [X] minutes." <strong>Watch out:</strong> only promise a response time you will keep, and say the hours it applies to. A broken promise on the page is worse than none.</p>

<h2>7. The reviews-first page</h2>
<p><strong>On the page:</strong> a few real client reviews near the form, with the client's permission, a first name and a city. <strong>Watch out:</strong> use only reviews that clients actually wrote, never paid or invented ones. See <a href="/blog/how-to-get-more-google-reviews-as-a-loan-officer">how to get more Google reviews</a>.</p>

<h2>8. The single-question page</h2>
<p><strong>Promise:</strong> one easy first step, such as "Are you buying or refinancing?", then a short form that branches. <strong>Why it can work:</strong> the first step takes a second. Measure completions before you keep it.</p>

<h2>9. The niche page</h2>
<p><strong>Promise:</strong> a page for one kind of borrower, such as self-employed buyers, veterans or buyers in a particular county. It draws less traffic, but speaks directly to one person. See <a href="/blog/bank-statement-loans-for-self-employed-buyers-an-mlo-lead-generation-guide">bank statement loans for self-employed buyers</a>.</p>

<h2>Rules to check first</h2>
<p>Your company's compliance team approves your pages, and state rules vary. Three federal rules come up often:</p>
<ul>
<li><strong>Regulation Z advertising (12 CFR 1026.24).</strong> An ad that states certain terms, such as the amount or percentage of a down payment, the number of payments or repayment period, the amount of a payment or the amount of a finance charge, must also state additional terms. The rule applies even when a term is only implied, for example "80 percent financing." For ads of credit secured by a dwelling, the required terms must appear with equal prominence and in close proximity to the advertised rate.</li>
<li><strong>Regulation N (12 CFR Part 1014).</strong> It prohibits material misrepresentations, express or implied, in commercial communications about the terms of a mortgage credit product, including about rates, fees, and whether a borrower is preapproved. It applies to non-bank lenders and to firms that market mortgage products.</li>
<li><strong>Your license and your state.</strong> Many states require your NMLS ID and licensing details in advertising. Ask your employer's compliance team and your state regulator what your pages must show, including fair housing logos or statements.</li>
</ul>

<h2>Make it fast on a phone</h2>
<p>Most borrowers will open your page on a phone. Google's Core Web Vitals give targets you can measure: Largest Contentful Paint of 2.5 seconds or less, Interaction to Next Paint of 200 milliseconds or less and Cumulative Layout Shift of 0.1 or less, measured at the 75th percentile of visits. Fewer scripts, compressed images and a form that renders immediately help on all three. Run the page through PageSpeed Insights before you send traffic to it.</p>

<h2>How to choose and test</h2>
<ol>
<li>Pick the page type that matches how your best borrowers find you.</li>
<li>Build one page, keep it short, and have compliance approve it.</li>
<li>Send it a small amount of traffic and track visits, form submissions and the share of submissions that become conversations.</li>
<li>Change one thing at a time, such as the headline or the number of form fields, and keep what works.</li>
</ol>
<p>For the build itself, see <a href="/blog/how-to-build-a-mortgage-lead-capture-page-no-designer-needed">how to build a lead capture page</a> and the <a href="/blog/loan-officer-landing-page-checklist">loan officer landing page checklist</a>. The wider picture is in our <a href="/topics/loan-officer-websites">loan officer website guide</a>.</p>

<h2>Sources</h2>
<ul>
${src(CFPB_REG_Z_ADS, "CFPB: 12 CFR 1026.24, Regulation Z advertising")}
${src(ECFR_REG_N, "eCFR: 12 CFR Part 1014, Mortgage Acts and Practices, Advertising (Regulation N)")}
${src(WEB_VITALS, "web.dev: Web Vitals (Core Web Vitals thresholds)")}
${src(CFPB_1024_14, "CFPB: 12 CFR 1024.14, prohibition against kickbacks and unearned fees (co-branded pages)")}
</ul>`,
  faq: [
    {
      q: "What makes a mortgage landing page work?",
      a: "One clear promise, one action, visible licensing details, local wording and a fast reply to the inquiry. Beyond that, results depend on your traffic and offer, so test a short version and keep what brings real conversations.",
    },
    {
      q: "How many form fields should a mortgage landing page have?",
      a: "Start short, such as a name, a phone number and one question, and add fields only if the extra detail is worth losing some submissions. There is no universal number; compare completion rates for each version on your own traffic.",
    },
    {
      q: "What do mortgage landing pages have to disclose?",
      a: "It depends on what the page says and where you are licensed. If an ad states certain terms, such as a down payment amount or a payment amount, Regulation Z requires additional terms. Many states require your NMLS ID. Have your compliance team review every page.",
    },
    {
      q: "Should every landing page name a city or ZIP code?",
      a: "A page that names the visitor's city or ZIP code signals relevance faster than a generic one, and it is how local searches are worded. A generic page can still work as a catch-all.",
    },
    {
      q: "How fast should a mortgage landing page load?",
      a: "Google's Core Web Vitals call Largest Contentful Paint of 2.5 seconds or less good, measured at the 75th percentile of visits. Fewer scripts and compressed images help most.",
    },
  ],
  closingHtml: closing(
    `<p><strong>Want a local page for a ZIP code you own?</strong> YPN USA gives one loan officer each ZIP code within YPN USA, with a local page for it. <a href="/check-zip">Check if your ZIP code is open</a> or <a href="/pricing">see plans</a>, starting free.</p>`,
  ),
};

/**
 * Replaces the imported referrals post: it promised "10 to 30 or more loans per year" from one
 * builder with no source, called past clients "almost always the highest-converting" source
 * and ended in a templated "MLO production playbook" section.
 */
export const MORTGAGE_REFERRALS_BEYOND_REALTORS: BlogPost = {
  slug: "how-to-get-more-mortgage-referrals-beyond-realtors",
  title: "How to Get More Mortgage Referrals (Beyond Realtors)",
  metaTitle: "How to Get More Mortgage Referrals Beyond Realtors",
  description:
    "Mortgage referrals do not have to come from Realtors. Eight referral sources for loan officers, how to work each one, and the RESPA rules to follow.",
  date: DATE,
  author: AUTHOR,
  byline: BYLINE,
  readingMinutes: 8,
  cluster: "realtor-referral-partnerships",
  html: `<p><strong>Short answer:</strong> loan officers get mortgage referrals beyond Realtors from past clients, CPAs, financial advisors, family law and estate attorneys, builders, property managers, insurance agents and home service professionals. The method is the same for each: be useful first, stay in touch on a schedule, make the referrer look good, and never pay or give anything of value for referrals.</p>

<h2>Why look beyond agents</h2>
<p>Agents are close to most purchases: in NAR's 2025 Profile of Home Buyers and Sellers, 88% of buyers used an agent or broker. That is also the risk. If one agent's business slows or that relationship cools, your pipeline slows with it. Other referral sources meet people before they start looking, or at moments an agent never sees. For the agent side, see <a href="/blog/how-to-get-realtor-referrals">how to get Realtor referrals</a>.</p>

<h2>The first rule: RESPA Section 8</h2>
<p>Section 8 of RESPA (12 CFR 1024.14) prohibits giving or accepting a fee, kickback or other thing of value for referring settlement service business on a federally related mortgage loan. That covers more than cash. A payment for services actually performed, at a price reasonably related to market value, is treated differently from a payment for referrals, and the value of the referrals cannot be counted when pricing a service. Your compliance team decides what is safe for you. Professionals such as CPAs and attorneys also have their own rules about referral compensation, so ask them about theirs. Read <a href="/blog/respa-compliant-realtor-co-marketing-ideas-for-loan-officers">RESPA-compliant co-marketing ideas</a> before you offer any partner anything beyond your own work.</p>

<h2>1. Past clients</h2>
<p>People you have closed with already know you, and they know others who are buying or refinancing. Most loan officers go quiet after closing. A simple routine: a short note at the home purchase anniversary, a local market note a few times a year, and a plain question twice a year: "Is anyone you know thinking about buying or refinancing? I'd be glad to help." <strong>Watch out:</strong> marketing emails must follow CAN-SPAM, including a working opt-out.</p>

<h2>2. CPAs and tax professionals</h2>
<p>CPAs see when a client sells a business, gets a raise or plans a large purchase. Offer to be the mortgage resource for their clients: a quick scenario review, or a short talk on topics they get asked about, such as first-time buyer programs or financing an investment property. <strong>Watch out:</strong> a lunch-and-learn that educates is different from meals or gifts given to people who can refer you. Ask compliance.</p>

<h2>3. Financial advisors and wealth managers</h2>
<p>Advisors talk to clients about buying investment property, second homes and moving money for a down payment. Be ready to explain how rental income is counted and what your investor and asset-based programs require. See <a href="/blog/linkedin-for-loan-officers-how-to-build-referral-partnerships">LinkedIn for loan officer referral partnerships</a>.</p>

<h2>4. Estate and divorce attorneys</h2>
<p>Divorce, inheritance and estate settlement often force one person to refinance, buy out another or sell and buy. Attorneys need a lender who can explain those situations clearly and move fast. A one-page guide to mortgage options in a divorce or estate settlement is a good first offer. See <a href="/blog/building-referral-partnerships-with-estate-and-probate-attorneys">referral partnerships with estate and probate attorneys</a>.</p>

<h2>5. Builders and developers</h2>
<p>Every home a builder sells needs financing, and many builders already have a preferred lender. Smaller local builders may not. Be the easiest lender to work with: quick answers, clean closings and clear communication with their buyers. <strong>Watch out:</strong> builder incentives tied to using a particular lender, and any arrangement involving payments, need compliance review.</p>

<h2>6. Property managers and landlords</h2>
<p>Property managers talk to renters every day, some of whom are ready to buy. Landlords think about their next purchase. Offer a short "when you're ready to buy" guide for tenants and a review of financing options for landlords who own property. See <a href="/blog/first-time-homebuyer-marketing-for-loan-officers-2">first-time homebuyer marketing</a>.</p>

<h2>7. Insurance agents</h2>
<p>Buyers need homeowners insurance before closing, so insurance agents meet buyers at the right time. <strong>Watch out:</strong> a referral exchange is not automatically safe under RESPA. Do not set one up without compliance approval, keep it free of payments and gifts, and recommend any provider on the merits.</p>

<h2>8. Home inspectors and service professionals</h2>
<p>Inspectors, contractors and other service professionals are present in many purchases, often before a buyer has chosen a lender. Recommend good ones to your clients on the merits. Let them know how you work. Do not trade anything of value for introductions.</p>

<h2>How to work any referral source</h2>
<ol>
<li><strong>Lead with something useful</strong> before you ask for anything: a guide, a scenario review, a quick answer.</li>
<li><strong>Make a short list</strong> of people to contact and a date for the next touch.</li>
<li><strong>Close cleanly.</strong> A referred client you take good care of makes the referrer look good.</li>
<li><strong>Thank them,</strong> with a note, not a payment or a gift of value.</li>
<li><strong>Track referrals by source</strong> so you know which ones deserve more of your time.</li>
</ol>
<p>For the full picture of building leads from several sources, read our guide to <a href="/blog/how-to-get-mortgage-leads-without-buying-them-a-loan-officers-2026-playbook">getting mortgage leads without buying them</a> and <a href="/blog/mortgage-marketing-strategies-mlo-growth-and-leads">loan officer marketing strategies</a>. For the pillar page on partnerships, see <a href="/topics/realtor-referral-partnerships">Realtor and referral partnerships</a>.</p>

<h2>Sources</h2>
<ul>
${src(CFPB_RESPA_FAQ, "CFPB: Real Estate Settlement Procedures Act FAQs (Section 8)")}
${src(CFPB_1024_14, "CFPB: 12 CFR 1024.14, prohibition against kickbacks and unearned fees")}
${src(NAR_2025, "NAR: 2025 Profile of Home Buyers and Sellers (share of buyers who used an agent)")}
${src(FTC_CAN_SPAM, "FTC: CAN-SPAM Act, a compliance guide for business (emails to past clients)")}
</ul>`,
  faq: [
    {
      q: "Can I pay someone for mortgage referrals?",
      a: "No. RESPA Section 8 prohibits giving or accepting a fee, kickback or other thing of value for referring settlement service business on a federally related mortgage loan. Build relationships based on useful help, and have compliance approve anything beyond your own work.",
    },
    {
      q: "How many referral sources should a loan officer have?",
      a: "There is no fixed number. A practical goal is a handful of active sources in different categories, such as past clients, a few agents, a CPA or advisor and an attorney, so that no single relationship supplies most of your business.",
    },
    {
      q: "How long does it take to build a referral network?",
      a: "It varies. Referral relationships usually take months of consistent, useful contact before introductions arrive, so measure your effort, such as the number of partner touches each month, as well as the referrals you receive.",
    },
    {
      q: "What is the best referral source besides Realtors?",
      a: "Past clients are the easiest to start with because they already know you and cost nothing to contact. Professionals who meet people before they shop, such as CPAs, financial advisors and attorneys, are the next to build. Track referrals by source to see which works for you.",
    },
    {
      q: "Can I take a referral partner to lunch?",
      a: "Whether a meal or event is acceptable depends on its value, the setting and your company's policy, because anything of value given to someone who can refer you can raise RESPA questions. Ask your compliance team before you offer meals, gifts or event tickets.",
    },
  ],
  closingHtml: closing(
    `<p><strong>Want local borrowers who come to you directly?</strong> YPN USA gives one loan officer each ZIP code within YPN USA. <a href="/check-zip">Check if your ZIP code is open</a> or <a href="/pricing">see plans</a>, starting free.</p>`,
  ),
};

/**
 * Replaces the imported email-sequence post: it opened with a stray "n", quoted unsourced
 * statistics ("fewer than 20 percent", best send days), listed loan program numbers without a
 * source and claimed YPN USA automates follow-up and SMS, which it does not.
 */
export const EMAIL_FOLLOW_UP_SEQUENCES: BlogPost = {
  slug: "email-follow-up-sequences-for-loan-officers-with-templates",
  title: "Email Follow-Up Sequences for Loan Officers (With Templates)",
  metaTitle: "Loan Officer Email Follow-Up Sequences and Templates",
  description:
    "A 90-day email follow-up sequence for loan officers with seven ready-to-edit templates, plus the CAN-SPAM, consent and sender rules to follow.",
  date: DATE,
  author: AUTHOR,
  byline: BYLINE,
  readingMinutes: 9,
  cluster: "ai-lead-automation",
  html: `<p><strong>Short answer:</strong> a loan officer follow-up sequence is a short series of timed, useful emails that starts when someone sends an inquiry and runs for about 60 to 90 days, so that people who are not ready today still hear from you when they are. Reply fast, teach something in each email, make opting out easy, and have compliance approve the wording. Seven templates are below.</p>

<h2>Rules before you send</h2>
<ul>
<li><strong>CAN-SPAM (FTC).</strong> A commercial email needs accurate sender and subject lines, your valid postal address, a clear way to opt out and a message that it is an ad unless the person gave prior affirmative consent. Honor opt-outs within 10 business days, and do not charge a fee or ask for more information to opt out. You stay responsible even if a vendor sends the email.</li>
<li><strong>Texts and calls.</strong> The FCC generally requires prior express written consent for marketing calls or texts sent with an autodialer or a prerecorded voice. An email sequence does not give you that consent, so do not add texts to a sequence without it. See <a href="/blog/text-message-marketing-for-loan-officers">text message marketing for loan officers</a>.</li>
<li><strong>Your license and your state.</strong> Many states require licensing details such as your NMLS ID in advertising, and your employer sets what must appear. Ask compliance for the footer to use in every email.</li>
<li><strong>Claims about programs.</strong> Program rules change, and lenders add their own. Check every number against the program's current source before you send, and soften it to "can" or "may" when it depends on the borrower.</li>
</ul>

<h2>The three phases</h2>
<ol>
<li><strong>Immediate (day 0 to 3):</strong> confirm you got the inquiry and say when you will follow up.</li>
<li><strong>Educate (day 4 to 21):</strong> answer the questions every borrower has, one per email.</li>
<li><strong>Re-engage (day 22 to 90):</strong> a short check-in, then one useful note a month.</li>
</ol>
<p>Send the first email within minutes and call as well; email alone is slower than a person. See <a href="/blog/speed-to-lead-for-mortgage-loan-officers">speed to lead</a>. For what to do before a lead is handed to you, see <a href="/blog/what-ai-lead-follow-up-should-do-before-handoff">what AI lead follow-up should do before handoff</a>.</p>

<h2>Email 1: right away</h2>
<p><strong>Subject:</strong> Got your info. Here's what happens next</p>
<blockquote><p>Hi [First name],<br>Thanks for reaching out. I received your information and will [call you by [time] today / reach out on [day]]. While you wait, here is a short overview of how the process works: [link to your process page].<br>[Your name], NMLS #[number]</p></blockquote>

<h2>Email 2: day 2, if you have not connected</h2>
<p><strong>Subject:</strong> One quick question about your home plans</p>
<blockquote><p>Hi [First name],<br>I tried to reach you and know the timing may not be right. One question so I send only what's useful: are you hoping to buy in the next 30 days, in 60 to 90 days, or just exploring? Reply 1, 2 or 3 and I'll follow up accordingly.<br>[Your name]</p></blockquote>

<h2>Email 3: day 4, the down payment question</h2>
<p><strong>Subject:</strong> You may not need 20% down</p>
<blockquote><p>Hi [First name],<br>Many buyers wait because they think they need 20% down. Depending on the program, the amount can be much lower. For example: FHA loans can start at 3.5% down for borrowers with a credit score of 580 or higher; VA loans often need no down payment for eligible veterans; USDA loans can finance 100% of the value in eligible rural areas, with income limits; and some conventional programs, such as Fannie Mae's HomeReady, allow 3% down with a 620 minimum score and income limits. What applies to you depends on your situation. I can walk through your options in about ten minutes. Want to set up a call?<br>[Your name], NMLS #[number]</p></blockquote>
<p><em>Check each program's current rules (see Sources) before you send, and keep or cut examples to match what you offer.</em></p>

<h2>Email 4: day 7, credit questions</h2>
<p><strong>Subject:</strong> What credit score do you need to buy?</p>
<blockquote><p>Hi [First name],<br>There is no single score. FHA looks at a minimum decision score, with 580 or higher for the 3.5% down option; conventional programs often start around 620; and every lender can add its own requirements. If your score is lower than you'd like, a few steps can help, and I'm glad to go over them with you on a short call. Interested?<br>[Your name]</p></blockquote>

<h2>Email 5: day 10, a local update</h2>
<p><strong>Subject:</strong> [Town] homebuying update for [month]</p>
<blockquote><p>Hi [First name],<br>One thing I'm seeing in [town] this month: [a fact you can source, such as a published local statistic with a link]. If it would help, I can run the numbers for a home in your price range.<br>[Your name]</p></blockquote>
<p><em>Do not quote a rate or payment in this email unless compliance has approved the wording; rates and payments trigger disclosure rules.</em></p>

<h2>Email 6: day 14, a client's words</h2>
<p>Use only real reviews, with permission. See <a href="/blog/how-to-get-more-google-reviews-as-a-loan-officer">how to get more Google reviews</a>.</p>
<p><strong>Subject:</strong> What a recent client said</p>
<blockquote><p>Hi [First name],<br>"[Paste a real review, with the client's permission.]" ([Client first name], [city])<br>If you'd like to talk about your plans, I'm here whenever works for you.<br>[Your name]</p></blockquote>

<h2>Email 7: day 22, the check-in</h2>
<p><strong>Subject:</strong> Should I stop reaching out?</p>
<blockquote><p>Hi [First name],<br>I've sent a few notes and haven't heard back, which is fine. If your plans changed or you found a lender, tell me and I'll stop. If you're still planning to buy and the timing wasn't right, I'm happy to help when you are.<br>[Still interested] | [Remove me from your list]<br>[Your name]</p></blockquote>

<h2>Days 30 to 90: one useful note a month</h2>
<p>Alternate between a local update, a short tip, a client story and a question. Keep each to three to five sentences with one low-pressure next step. Stop sending the moment someone asks, and remove them from every list.</p>

<h2>What you need to run it</h2>
<ul>
<li><strong>A CRM or email tool that starts a sequence when a lead is added</strong>, and connects to your form or landing page. See <a href="/blog/crm-drip-workflows-for-mlo-follow-up">CRM drip workflows</a>.</li>
<li><strong>Sender authentication.</strong> Google requires all senders to authenticate with SPF or DKIM, and bulk senders (about 5,000 messages a day or more to Gmail) to use SPF, DKIM and DMARC and one-click unsubscribe. A small sender is unlikely to hit that volume, but authentication helps your email reach the inbox anyway.</li>
<li><strong>A footer compliance has approved</strong> with your name, NMLS ID, postal address and an unsubscribe link.</li>
</ul>
<h2>What to measure</h2>
<ul>
<li><strong>Replies and booked calls,</strong> not opens. Open numbers are unreliable.</li>
<li><strong>Unsubscribes and spam complaints.</strong> A rising rate means the emails are too frequent or too pushy.</li>
<li><strong>Applications by source,</strong> so you can compare email follow-up with your other channels.</li>
</ul>
<p>For a broader plan, read <a href="/blog/mortgage-marketing-strategies-mlo-growth-and-leads">loan officer marketing strategies</a> and <a href="/blog/10-proven-strategies-for-mortgage-loan-lead-generation-in-2026">mortgage lead generation strategies</a>. Our <a href="/topics/ai-lead-automation">mortgage CRM and lead automation guide</a> covers the tools.</p>

<h2>Sources</h2>
<ul>
${src(FTC_CAN_SPAM, "FTC: CAN-SPAM Act, a compliance guide for business")}
${src(FCC_ROBOTEXTS, "FCC: Stop unwanted robocalls and texts (consent for marketing calls and texts)")}
${src(GOOGLE_SENDERS, "Google: Email sender guidelines (SPF, DKIM, DMARC, unsubscribe)")}
${src(HUD_FHA, "HUD: How can FHA help me buy a home?")}
${src(VA_PURCHASE, "VA: Purchase loan")}
${src(USDA_GUARANTEED, "USDA: Single Family Housing Guaranteed Loan Program")}
${src(FANNIE_HOMEREADY, "Fannie Mae: HomeReady mortgage")}
</ul>`,
  faq: [
    {
      q: "How many follow-up emails should a loan officer send?",
      a: "There is no fixed number. A common pattern is about a dozen emails over 60 to 90 days: three in the first week, a few educational ones over the next two weeks, then one a month. Adjust to replies, and stop as soon as someone opts out.",
    },
    {
      q: "What is the best time to send mortgage follow-up emails?",
      a: "There is no universal best time. Test a few send times with your own list and compare replies and booked calls, not opens.",
    },
    {
      q: "Do I need to include my NMLS number in marketing emails?",
      a: "Many states and employers require licensing details such as your NMLS ID in advertising, and emails often count. Rules vary, so ask your compliance team for the exact footer.",
    },
    {
      q: "Do I need consent to email a lead who filled out my form?",
      a: "CAN-SPAM does not require opt-in consent for commercial email, but it requires accurate headers, your postal address and a working opt-out that you honor within 10 business days. Texts and autodialed calls are different: the FCC generally requires prior express written consent.",
    },
    {
      q: "Can YPN USA send these emails for me?",
      a: "In part. Cerebro, YPN USA's AI assistant, can email borrowers check-ins, first replies and rate alerts for you. By default it sends them on its own, only to borrowers who agreed to be contacted and only when its compliance checks pass; in approve-first mode it holds each one for your OK. It sends no texts. The timed sequence in this guide runs in your own CRM or email tool.",
    },
  ],
  closingHtml: closing(
    `<p><strong>Want follow-up drafted for you?</strong> YPN USA gives one loan officer each ZIP code within YPN USA, and Cerebro follows up with borrowers by email, on its own or after your approval. <a href="/check-zip">Check if your ZIP code is open</a> or <a href="/pricing">see plans</a>, starting free.</p>`,
  ),
};

/**
 * Replaces the imported post of the same slug, which had no cited data behind any of its
 * platform or cadence claims. Adds sourced LinkedIn timing data, mortgage-pro platform usage
 * figures, and the link-reach study, so the claims are checkable instead of generic advice.
 */
export const SOCIAL_MEDIA_WHAT_WORKS: BlogPost = {
  slug: "social-media-marketing-for-loan-officers-what-actually-works-in-2026",
  title: "Social Media Marketing for Loan Officers: What Actually Works in 2026",
  description:
    "What the data actually says about social media for loan officers: which platforms mortgage pros use, the best times to post on LinkedIn, and whether a link in your post hurts reach.",
  date: DATE,
  author: AUTHOR,
  byline: BYLINE,
  readingMinutes: 7,
  cluster: "loan-officer-marketing",
  html: `<p><strong>Short answer:</strong> for most loan officers, LinkedIn is the main channel because referral partners (agents, CPAs, planners) use it for work, Facebook groups are worth one post a week because a large share of mortgage pros are active there, and X, Instagram, TikTok and YouTube Shorts are a lower priority because they reach borrowers more than the referral partners who drive most loan officer business. Start with a financial-services-specific morning/midday schedule, test an afternoon slot against it with your own analytics, keep the link in the post text, and spend ten minutes replying to comments after each one goes live.</p>

<h2>Which platforms are actually worth your time</h2>
<p>A rough industry survey puts Facebook use among mortgage professionals at 82% and X at 18%. That gap is bigger than most loan officers assume, and it changes where effort should go:</p>
<ul>
<li><strong>LinkedIn (personal profile):</strong> the main channel for reaching agents, branch managers and other referral partners, who use it for work. People follow people more than they follow company pages.</li>
<li><strong>Facebook groups for loan officers:</strong> worth one post a week, posted by hand. Schedulers can't post into Facebook groups — Meta cut off third-party posting to groups in 2024 — and many groups ban links or self-promotion outright, so read each group's rules before you post.</li>
<li><strong>X, Instagram, TikTok, YouTube Shorts:</strong> lower priority for referral-side marketing. They need a photo or video every time, and they reach borrowers and a general audience more than the agents and other referral partners who send most loan officers their business. Revisit once your LinkedIn and Facebook posts show you which topics land.</li>
</ul>

<h2>Best times to post on LinkedIn</h2>
<p>Two real studies land in different places here, so it's worth knowing which one you're following. Sprout Social's financial-services breakdown (2 billion engagements, 307,000 profiles) gives a specific weekday schedule, with every time in <strong>your audience's own local time zone</strong> — not a fixed zone like Eastern:</p>
<table>
<thead><tr><th>Day</th><th>Time (audience's local time)</th></tr></thead>
<tbody>
<tr><td>Monday</td><td>10 AM and 12–1 PM</td></tr>
<tr><td>Tuesday</td><td>10 AM – 3 PM</td></tr>
<tr><td>Wednesday</td><td>8 AM and 10 AM – 3 PM (ranked LinkedIn's single best day)</td></tr>
<tr><td>Thursday</td><td>8 AM – 2 PM</td></tr>
<tr><td>Friday</td><td>11 AM</td></tr>
</tbody>
</table>
<p>Weekends rank worst. Buffer's larger, industry-general study (4.8 million scheduled posts, no financial-services breakdown) points the other way: it found afternoons and evenings beat mornings across LinkedIn overall, with a peak window of 3 to 8 PM and Wednesday 4 PM as the single strongest slot — also normalized to each poster's own local time zone, not Eastern or Pacific. These two studies don't actually agree with each other. Sprout's is the one built specifically for financial services, so start with its morning/midday schedule, but test an afternoon slot against it with your own analytics after a few weeks, since Buffer's larger dataset found afternoons winning across LinkedIn generally.</p>

<h2>Does a link in the post hurt your reach?</h2>
<p>Many loan officers put their link in the first comment instead of the post, or skip links altogether, because they've heard LinkedIn buries posts that carry one. A 2026 study of 865,980 posts found that's mostly a myth: a URL typed directly into the post text cost only about 2% fewer impressions, described as "no measurable difference," and link-in-comment versus link-in-post also showed no measurable difference.</p>
<p>What did hurt reach: posts where the auto-generated link preview card was the only visual, which saw 35% fewer impressions. The fix is simple — put the link in the text, and attach a real image so the preview card isn't carrying the post alone.</p>

<h2>What actually grows the audience</h2>
<p>Posting is only half the job. LinkedIn's algorithm rewards engagement in the first hour or two, so replying to comments on your own post — about ten minutes after it goes live — is what gets it shown to more people. For growing the audience itself, connection requests and DMs sent through bots or automation tools are explicitly banned under LinkedIn's User Agreement, and accounts get restricted for it. Sending 10 to 20 personal connection requests a week to loan officers, agents and other referral partners in your markets, by hand, is still the most reliable free way to grow who sees your posts.</p>
<p>For the posts themselves and how often to run them, see <a href="/blog/how-often-should-a-loan-officer-post-on-social-media">how often a loan officer should post on social media</a> and <a href="/blog/30-social-media-post-ideas-for-loan-officers-copy-use">30 social media post ideas</a>. Platform-specific playbooks: <a href="/blog/instagram-for-loan-officers-how-to-get-clients-not-just-likes">Instagram for loan officers</a> and <a href="/blog/facebook-marketing-for-loan-officers-the-2026-step-by-step-playbook">the Facebook marketing playbook</a>.</p>

<h2>Sources</h2>
<ul>
${src("https://sproutsocial.com/insights/best-times-to-post-on-linkedin/", "Sprout Social: Best Times to Post on LinkedIn in 2026 (2 billion engagements, 307,000 profiles)")}
${src("https://buffer.com/resources/best-time-to-post-on-linkedin/", "Buffer: Best Time to Post on LinkedIn in 2026 (4.8 million posts scheduled through Buffer)")}
${src("https://contentin.io/blog/should-you-put-links-in-linkedin-posts/", "ContentIn: Should You Put Links in LinkedIn Posts? (865,980-post study)")}
${src("https://www.webtonic.io/blog/mortgage-social-media-marketing-statistics", "Web Tonic: mortgage social media marketing statistics")}
</ul>`,
  faq: [
    {
      q: "What social media platform should a loan officer focus on first?",
      a: "LinkedIn for most loan officers, because it's where referral partners like real estate agents, branch managers and financial planners already are. A survey of mortgage professionals also puts Facebook use at 82%, which makes a weekly post in a Facebook group worth the time.",
    },
    {
      q: "What is the best time to post on LinkedIn?",
      a: "It depends which study you follow. Sprout Social's financial-services breakdown recommends mornings and midday (Tuesday through Thursday, plus Friday at 11 AM, all in your audience's local time), while Buffer's larger, industry-general study found afternoons and evenings (3 to 8 PM local) outperform mornings across LinkedIn overall. Start with Sprout's financial-services schedule and test an afternoon slot against it with your own analytics. Skip weekends either way.",
    },
    {
      q: "Does putting a link in a LinkedIn post hurt its reach?",
      a: "Barely. A 2026 study of 865,980 posts found a link in the post text cost about 2% fewer impressions, called 'no measurable difference.' What actually hurt reach was relying on the auto-generated link preview as the only image — that cost 35% fewer impressions, so attach a real photo instead.",
    },
    {
      q: "Can I automate connection requests on LinkedIn to grow my audience faster?",
      a: "No. LinkedIn's User Agreement bans bots and automation tools for connection requests and DMs, and accounts get restricted for it. Sending 10 to 20 personal requests a week by hand is the reliable free way to grow reach.",
    },
  ],
  closingHtml: closing(
    `<p><strong>Want a local page to back up what you post?</strong> YPN USA gives one loan officer each ZIP code within YPN USA. <a href="/check-zip">Check if your ZIP code is open</a> or <a href="/pricing">see plans</a>, starting free.</p>`,
  ),
};

/**
 * Replaces the imported post of the same slug, which gave a cadence recommendation with no
 * source behind it. Adds the sourced cadence and timing data from SOCIAL_MEDIA_WHAT_WORKS in
 * condensed form, kept distinct so the two posts don't compete for the same search intent.
 */
export const SOCIAL_MEDIA_POSTING_FREQUENCY: BlogPost = {
  slug: "how-often-should-a-loan-officer-post-on-social-media",
  title: "How Often Should a Loan Officer Post on Social Media?",
  description:
    "2 to 5 LinkedIn posts a week is a sustainable starting cadence, and posting more keeps paying off from there, per a study of over 2 million posts. Here's the cadence, the best days and times, and a simple weekly plan.",
  date: DATE,
  author: AUTHOR,
  byline: BYLINE,
  readingMinutes: 5,
  cluster: "loan-officer-marketing",
  html: `<p><strong>Short answer:</strong> 2 to 5 posts a week on your main platform is a sustainable starting cadence, and it's enough to show up consistently in your network's feed. But posting more keeps paying off past that point: Buffer's frequency study, covering more than 2 million LinkedIn posts from over 94,000 accounts, found accounts posting 6 to 10 times a week see a bigger per-post lift than the 2-to-5 tier, and 11+ times a week see the biggest lift of all — though each step up shows smaller added gains than the one before it. Treat 2 to 5 as the floor to build from, not a ceiling, and go higher only as long as you can keep the quality up. Consistency on a schedule you can actually keep beats a burst of daily posts followed by silence.</p>

<h2>What the data says about cadence</h2>
<p>Buffer's analysis of more than 2 million LinkedIn posts from over 94,000 accounts found accounts posting 2 to 5 times a week saw an average per-post lift of about 1,182 extra impressions and 0.23 percentage points of engagement rate, compared with posting once a week. Accounts posting 6 to 10 times a week saw a bigger lift (about 5,001 extra impressions, +0.76 points), and 11+ times a week saw the biggest lift of all (about 16,946 extra impressions, +1.40 points, and roughly 3x more engagements). Buffer calls 2 to 5 posts a week "the sweet spot" for most people — not because frequency stops helping, but because it's the cadence most people can sustain without burning out or dropping quality. If you can only commit to 3 posts a week, do 3 — every week, indefinitely, rather than cycling between daily bursts and weeks of silence.</p>

<h2>Best days and times</h2>
<p>Two real studies point in different directions here, so it's worth knowing which one you're following. Sprout Social's financial-services breakdown (2 billion engagements, 307,000 profiles) recommends mornings and midday, in your audience's own local time zone:</p>
<ul>
<li><strong>Tuesday, Wednesday, Thursday — mornings through early afternoon:</strong> Wednesday at 8 AM is ranked the single best slot overall.</li>
<li><strong>Friday — 11 AM</strong> local time (no afternoon slot is recommended).</li>
<li><strong>Weekends:</strong> skip — ranked lowest.</li>
</ul>
<p>Buffer's larger, industry-general study (4.8 million scheduled posts, no financial-services breakdown) instead found afternoons and evenings — a 3 to 8 PM window, Wednesday 4 PM strongest, in each poster's own local time — beat mornings across LinkedIn as a whole. Sprout's is the one built for financial services, so start there, but test an afternoon slot against it with your own analytics, since Buffer's broader dataset points the other way.</p>

<h2>A simple weekly framework</h2>
<ul>
<li><strong>Tuesday — Educational:</strong> teach one thing (credit, down payment, a loan type).</li>
<li><strong>Wednesday — Trust/proof:</strong> a win, a review, or something behind the scenes.</li>
<li><strong>Thursday or Friday — Engagement or offer:</strong> a question, a poll, or a soft call to action.</li>
</ul>
<p>Batch a week or a month of posts in one sitting so showing up doesn't depend on remembering each day. Whichever days you choose, reply to comments for about ten minutes after each post goes live — LinkedIn's algorithm rewards engagement in the first hour or two, and that's what gets a post shown to more people than the posting time alone. For post ideas, see <a href="/blog/30-social-media-post-ideas-for-loan-officers-copy-use">30 social media post ideas for loan officers</a>, and for the fuller platform breakdown, <a href="/blog/social-media-marketing-for-loan-officers-what-actually-works-in-2026">social media marketing for loan officers: what actually works in 2026</a>.</p>

<h2>Sources</h2>
<ul>
${src("https://buffer.com/resources/how-often-to-post-on-linkedin/", "Buffer: How Often to Post on LinkedIn (2+ million posts, 94,000+ accounts)")}
${src("https://buffer.com/resources/best-time-to-post-on-linkedin/", "Buffer: Best Time to Post on LinkedIn in 2026 (4.8 million posts scheduled through Buffer)")}
${src("https://sproutsocial.com/insights/best-times-to-post-on-linkedin/", "Sprout Social: Best Times to Post on LinkedIn in 2026 (2 billion engagements, 307,000 profiles)")}
</ul>`,
  faq: [
    {
      q: "How many times a week should a loan officer post on social media?",
      a: "2 to 5 posts a week is a sustainable starting cadence, according to a study of over 2 million LinkedIn posts. Posting more keeps paying off past that — 6 to 10 times a week shows a bigger per-post lift, and 11+ the biggest of all — so treat 2 to 5 as a floor, not a ceiling, and go higher only if you can sustain the quality.",
    },
    {
      q: "What are the best days and times to post?",
      a: "It depends which study you follow. Sprout Social's financial-services breakdown recommends mornings and midday (Tuesday through Thursday, plus Friday at 11 AM, in your audience's local time), while Buffer's larger, industry-general study found afternoons and evenings (3 to 8 PM local) win across LinkedIn overall. Start with Sprout's financial-services schedule and test an afternoon slot against it. Skip weekends either way.",
    },
    {
      q: "Is posting more often always better?",
      a: "It keeps helping, per Buffer's study of over 2 million posts, but with diminishing returns — each step up in frequency shows a smaller added gain than the one before it, and quality is harder to sustain at higher volumes. 2 to 5 posts a week is the realistic floor most people can keep up without burning out; go higher only if the quality holds.",
    },
    {
      q: "Does engaging with comments matter as much as the posting time?",
      a: "It matters more. LinkedIn's algorithm rewards engagement in the first hour or two after a post goes live, so replying to comments for about ten minutes is what extends a post's reach beyond whoever sees it at the moment it's posted.",
    },
  ],
  closingHtml: closing(
    `<p><strong>Need a steady source of content ideas?</strong> YPN USA gives one loan officer each ZIP code within YPN USA. <a href="/check-zip">Check if your ZIP code is open</a> or <a href="/pricing">see plans</a>, starting free.</p>`,
  ),
};

export const REWRITTEN_POSTS: readonly BlogPost[] = [
  LOAN_OFFICER_MARKETING_STRATEGIES,
  RESPA_CO_MARKETING,
  NEW_LOAN_OFFICER_CLIENTS,
  MORTGAGE_LEAD_GENERATION,
  LANDING_PAGE_EXAMPLES,
  MORTGAGE_REFERRALS_BEYOND_REALTORS,
  EMAIL_FOLLOW_UP_SEQUENCES,
  SOCIAL_MEDIA_WHAT_WORKS,
  SOCIAL_MEDIA_POSTING_FREQUENCY,
];
