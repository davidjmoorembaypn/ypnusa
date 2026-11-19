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

export const REWRITTEN_POSTS: readonly BlogPost[] = [
  LOAN_OFFICER_MARKETING_STRATEGIES,
  RESPA_CO_MARKETING,
  NEW_LOAN_OFFICER_CLIENTS,
  MORTGAGE_LEAD_GENERATION,
];
