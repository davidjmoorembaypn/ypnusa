import type { BlogPost } from "@/content/blog";

/**
 * Answer-first posts (Nov 17 2026) for the questions loan officers ask ChatGPT, Gemini,
 * Perplexity and Google, picked from OpenSEO prompt research, keyword research and Search
 * Console. Each post opens with a two-to-three sentence answer an AI engine can quote, then the
 * detail, an FAQ (rendered on the page and as FAQPage JSON-LD) and a Sources list. Facts come
 * only from the sources listed in each post; worked examples are labeled as examples.
 * YPN USA claims are limited to what /cerebro and /pricing say today.
 */

const BYLINE = "By David J. Moore, MBA · 25+ years as a loan officer, 2,000+ loans closed · NMLS #787257";
const DATE = "2026-11-17";
const AUTHOR = "David J. Moore, MBA";

/** Shown after every post's FAQ: the call to action and the author link. */
function closing(cta: string): string {
  return `${cta}
<p class="text-sm">Written by <a href="/about-david-moore" rel="author">David J. Moore, MBA</a>, founder of YPN USA (YPN Inc.), a loan officer for 25+ years. NMLS #787257, CA DRE #01852847.</p>`;
}

/** External source link: opens in a new tab, passes no ranking credit. */
function src(url: string, label: string): string {
  return `<li><a href="${url}" target="_blank" rel="noopener nofollow">${label}</a></li>`;
}

export const IS_BUYING_MORTGAGE_LEADS_WORTH_IT: BlogPost = {
  slug: "is-buying-mortgage-leads-worth-it",
  title: "Is Buying Mortgage Leads Worth It? The Math Every Loan Officer Should Run First",
  metaTitle: "Is Buying Mortgage Leads Worth It? | Loan Officer Math | YPN USA",
  description:
    "Buying mortgage leads is worth it only when your cost per closed loan stays well below what you earn per loan and you can answer every lead in minutes. Here's the math.",
  date: DATE,
  author: AUTHOR,
  byline: BYLINE,
  readingMinutes: 7,
  cluster: "exclusive-mortgage-leads",
  html: `<p><strong>Short answer:</strong> buying mortgage leads is worth it when your cost per closed loan (what you spend on leads divided by the loans they produce) stays well below what you earn on a closed loan, and you can reach every lead within minutes. If you can't measure your close rate or can't follow up fast, bought leads usually lose money. Most loan officers do best treating bought leads as one channel next to <a href="/topics/exclusive-mortgage-leads">exclusive, owned demand</a>, not as the whole business.</p>

<h2>The one number that decides it: cost per closed loan</h2>
<p>A lead's price tells you almost nothing on its own. A $15 lead that never closes is more expensive than a $150 lead that closes one time in ten. Run this before you buy anything:</p>
<ol>
<li><strong>Cost per closed loan</strong> = monthly lead spend ÷ loans closed from those leads.</li>
<li><strong>Break-even close rate</strong> = price per lead ÷ what you earn per closed loan.</li>
<li><strong>Your real close rate</strong> = loans closed ÷ leads bought, measured over at least 90 days, because mortgage leads take weeks to months to close.</li>
</ol>
<p>If your real close rate is under the break-even rate, the source loses money no matter how good the leads feel.</p>

<h2>A worked example</h2>
<p>These numbers are an example to show the method, not a benchmark. Use your own prices and results.</p>
<table>
<thead><tr><th>Input</th><th>Shared leads</th><th>Exclusive leads</th></tr></thead>
<tbody>
<tr><td>Price per lead (example)</td><td>$40</td><td>$150</td></tr>
<tr><td>Leads bought per month</td><td>100</td><td>25</td></tr>
<tr><td>Monthly spend</td><td>$4,000</td><td>$3,750</td></tr>
<tr><td>Close rate (example)</td><td>1.5%</td><td>8%</td></tr>
<tr><td>Loans closed per month</td><td>1.5</td><td>2</td></tr>
<tr><td>Cost per closed loan</td><td>$2,667</td><td>$1,875</td></tr>
</tbody>
</table>
<p>In this example the cheaper lead is the more expensive way to close a loan, because several other lenders are calling the same shared borrower. The point isn't that exclusive always wins. It's that you only know after you measure close rate by source. Our breakdown of <a href="/blog/exclusive-vs-shared-mortgage-leads-real-cost-math">exclusive vs shared lead math</a> and the <a href="/blog/what-do-mortgage-leads-cost-pricing-benchmarks-by-source">price benchmarks by lead source</a> go deeper.</p>

<h2>When buying leads is worth it</h2>
<ul>
<li><strong>You answer in minutes, every time.</strong> Bought leads are often filling out forms with several lenders. The first useful reply usually gets the conversation. If you can't be there at 9 PM, an assistant has to be.</li>
<li><strong>You track every lead to a result.</strong> Source, date, contact attempts, application, close. Without this you're guessing.</li>
<li><strong>You have a follow-up plan for months, not days.</strong> Many buyers are 3 to 12 months out. The leads that close often close late.</li>
<li><strong>The lead type matches what you do well.</strong> A VA specialist buying general refinance leads pays for conversations they won't win.</li>
<li><strong>You can afford a 90-day test.</strong> One month of data is too little to judge a mortgage lead source.</li>
</ul>

<h2>When it usually isn't</h2>
<ul>
<li>You're already too busy to call new leads the same day.</li>
<li>The vendor won't say how many other lenders get the same lead.</li>
<li>The contract locks you in before you've seen results, or there's no credit for bad contact information.</li>
<li>The vendor can't show how borrowers gave consent to be contacted by text or call.</li>
<li>Your company's compliance team hasn't approved the vendor.</li>
</ul>

<h2>Questions to ask any lead vendor</h2>
<ol>
<li>How many lenders receive each lead, and is that in writing?</li>
<li>Where do the leads come from (search ads, social, comparison sites, aged lists)?</li>
<li>How was consent to call and text collected, and can I see the form?</li>
<li>Is pricing a flat fee per lead or per month? (Payments tied to closed loans can raise RESPA problems.)</li>
<li>What's the minimum term, and what happens to bad or duplicate leads?</li>
</ol>

<h2>Stay inside RESPA</h2>
<p>RESPA Section 8 prohibits paying or accepting anything of value for referrals of settlement service business. Paying a fair, fixed price for a marketing service is different from paying for a referral, but the line depends on the facts. Avoid any arrangement where your payment depends on whether a loan closes, and run every lead vendor past your company's compliance team before you sign.</p>

<h2>The alternative: build demand you own</h2>
<p>The lead you don't have to share is the one a borrower sends you directly: from your local pages, your Google Business Profile, your past clients and your referral partners. It takes longer to build, but it compounds instead of resetting every month. See <a href="/blog/how-to-get-mortgage-leads-without-buying-them-a-loan-officers-2026-playbook">how to get mortgage leads without buying them</a>. Whichever mix you choose, answer fast: <a href="/cerebro">Cerebro</a> answers and qualifies borrower questions on your own page at any hour and hands each conversation to you with a summary.</p>

<h2>Sources</h2>
<ul>
${src("https://www.consumerfinance.gov/compliance/compliance-resources/mortgage-resources/real-estate-settlement-procedures-act/real-estate-settlement-procedures-act-faqs/", "CFPB: Real Estate Settlement Procedures Act FAQs (Section 8 referral fees)")}
${src("https://www.housingwire.com/articles/buy-mortgage-leads/", "HousingWire: 9 top places to buy mortgage leads in 2026")}
</ul>`,
  faq: [
    {
      q: "Is it worth buying mortgage leads as a loan officer?",
      a: "It's worth it when your cost per closed loan stays well below what you earn per loan and you can contact every lead within minutes. Measure close rate by source for at least 90 days before deciding.",
    },
    {
      q: "What is a good close rate on bought mortgage leads?",
      a: "There's no single good number. Work out your break-even close rate (price per lead divided by what you earn per loan) and compare your real close rate to it. Shared leads usually need a lower price to break even than exclusive ones.",
    },
    {
      q: "Are exclusive mortgage leads better than shared leads?",
      a: "Exclusive leads cost more each but you're the only lender calling, so they often close at a higher rate. Compare cost per closed loan, not price per lead. Our exclusive vs shared lead math walks through it.",
      html: 'Exclusive leads cost more each but you\'re the only lender calling, so they often close at a higher rate. Compare cost per closed loan, not price per lead. Our <a href="/blog/exclusive-vs-shared-mortgage-leads-real-cost-math">exclusive vs shared lead math</a> walks through it.',
    },
    {
      q: "Is buying mortgage leads legal under RESPA?",
      a: "Paying a fair, fixed price for a marketing service is generally treated differently from paying for referrals, but RESPA Section 8 bars payments for referrals of settlement business. Avoid pay-per-closed-loan deals and have your compliance team approve every vendor.",
    },
  ],
  closingHtml: closing(
    `<p><strong>Want leads you don't share?</strong> YPN USA gives one loan officer each ZIP code within YPN USA. <a href="/check-zip">Check if your ZIP code is open</a> or <a href="/pricing">see plans</a>, starting free.</p>`,
  ),
};

export const ZIP_CODE_LEAD_CHECKLIST: BlogPost = {
  slug: "what-to-check-before-buying-mortgage-leads-in-a-zip-code",
  title: "What to Check Before You Pay for Mortgage Leads in a ZIP Code",
  metaTitle: "What to Check Before Paying for Mortgage Leads in a ZIP Code | YPN USA",
  description:
    "Before paying for mortgage leads in a ZIP code, check local loan demand in HMDA data, your license, who else gets the leads, how consent was collected and the contract terms.",
  date: DATE,
  author: AUTHOR,
  byline: BYLINE,
  readingMinutes: 7,
  cluster: "exclusive-mortgage-leads",
  html: `<p><strong>Short answer:</strong> before you pay for mortgage leads in a specific ZIP code, check five things: how many home loans are actually made there (public HMDA data shows this), whether you're licensed to lend there, how many other lenders get the same leads, how borrowers gave consent to be contacted, and what the contract commits you to. A ZIP code with real demand, exclusive leads and clean consent is worth testing. One that fails any of these usually isn't.</p>

<h2>1. Is there enough loan demand in that area?</h2>
<p>Lead vendors sell ZIP codes by population. You need loans. The Home Mortgage Disclosure Act (HMDA) requires most lenders to report every application, and the CFPB publishes the results. In the <a href="https://ffiec.cfpb.gov/data-browser/" target="_blank" rel="noopener nofollow">FFIEC HMDA Data Browser</a> you can filter by state, county or census tract and see originated loans by purpose and type.</p>
<p>For example, lenders reported 13,027 originated home loans in Fresno County, California in 2024, up from 11,015 in 2023. Of those, 7,623 were home purchases, 2,580 were FHA and 708 were VA. A county-level view like our <a href="/research/fresno-county-ca">Fresno County loan officer market report</a> tells you which programs carry the area. A single ZIP code is a slice of that, so check the census tracts that make it up before you assume volume.</p>
<p>Look at three things:</p>
<ul>
<li><strong>Purchase vs refinance mix.</strong> Purchase demand is steadier; refinance demand moves with rates.</li>
<li><strong>Loan types.</strong> An FHA- or VA-heavy area rewards loan officers who know those programs.</li>
<li><strong>Trend.</strong> Compare at least two years. A shrinking market makes every lead more contested.</li>
</ul>

<h2>2. Can you lend there?</h2>
<p>Check that your state license (or your federal registration through your bank) covers the property's state, and that your company offers the programs that area uses. Look yourself up on <a href="https://www.nmlsconsumeraccess.org/" target="_blank" rel="noopener nofollow">NMLS Consumer Access</a> if you're unsure which states you're licensed in. Leads you can't close are pure cost.</p>

<h2>3. Who else gets the same lead?</h2>
<p>This is the question vendors least like to answer in writing. Ask:</p>
<ul>
<li>How many lenders receive each lead (one, three, "up to" some number)?</li>
<li>Is the ZIP code exclusive to you, and exclusive within what? Most "exclusive territory" programs mean exclusive within that vendor only. Other lenders can still market in the same ZIP code through other channels.</li>
<li>Are aged leads resold later to other buyers?</li>
</ul>

<h2>4. How was consent collected?</h2>
<p>If you'll call or text with an autodialer or prerecorded message, the Telephone Consumer Protection Act generally requires the borrower's prior express written consent. Ask to see the actual form the borrower filled out, what it said, and whether your company (or the vendor on your behalf) is the party named. Our guide to <a href="/blog/text-message-marketing-for-loan-officers">TCPA consent for loan officers</a> covers what to look for.</p>

<h2>5. What does the contract commit you to?</h2>
<ul>
<li>Price per lead or per month, and whether it can change.</li>
<li>Minimum term and cancellation terms.</li>
<li>Credits for bad numbers, duplicates or borrowers outside your area.</li>
<li>Who owns the borrower data if you leave.</li>
<li>No pricing tied to closed loans (a RESPA red flag).</li>
</ul>

<h2>6. Can you work the leads?</h2>
<p>Even a strong ZIP code fails if leads wait hours for a reply. Before you pay, decide who answers at night and on weekends and how fast. See <a href="/blog/speed-to-lead-for-mortgage-loan-officers">speed to lead for loan officers</a>.</p>

<h2>A quick scorecard</h2>
<table>
<thead><tr><th>Check</th><th>Pass</th><th>Walk away</th></tr></thead>
<tbody>
<tr><td>Local demand (HMDA)</td><td>Steady or growing originations in programs you know</td><td>Shrinking, or concentrated in programs you don't offer</td></tr>
<tr><td>License</td><td>Licensed and your company offers the products</td><td>Not licensed there</td></tr>
<tr><td>Sharing</td><td>Exclusive, in writing</td><td>Vendor won't say</td></tr>
<tr><td>Consent</td><td>You've seen the form</td><td>"It's compliant, trust us"</td></tr>
<tr><td>Contract</td><td>Short term, bad-lead credits</td><td>Long lock-in, pay per closed loan</td></tr>
<tr><td>Capacity</td><td>Replies in minutes, 7 days a week</td><td>Callbacks next business day</td></tr>
</tbody>
</table>

<h2>How YPN USA handles ZIP codes</h2>
<p>YPN USA gives one loan officer each ZIP code at a time, and borrower inquiries from YPN USA pages for that ZIP code go to that loan officer. That exclusivity applies within YPN USA; other lenders still market in your area. You can <a href="/check-zip">check whether a ZIP code is open</a> before you pay anything, and <a href="/cerebro">Cerebro</a> answers borrowers on your page at any hour so leads don't wait. Plans are on the <a href="/pricing">pricing page</a>, starting with a free plan.</p>

<h2>Sources</h2>
<ul>
${src("https://ffiec.cfpb.gov/data-browser/", "FFIEC / CFPB HMDA Data Browser (originated loans by county and tract)")}
${src("https://www.nmlsconsumeraccess.org/", "NMLS Consumer Access (license lookup)")}
${src("https://www.law.cornell.edu/cfr/text/47/64.1200", "47 CFR 64.1200: TCPA prior express written consent")}
${src("https://www.consumerfinance.gov/compliance/compliance-resources/mortgage-resources/real-estate-settlement-procedures-act/real-estate-settlement-procedures-act-faqs/", "CFPB: RESPA FAQs")}
</ul>`,
  faq: [
    {
      q: "How do I know if a ZIP code has enough mortgage demand?",
      a: "Look up originated loans for the county and census tracts in the FFIEC HMDA Data Browser. Compare at least two years and check the purchase vs refinance mix and loan types.",
    },
    {
      q: "Are exclusive ZIP code leads really exclusive?",
      a: "Usually only within the vendor that sells them. Other lenders can still advertise in the same ZIP code. Ask the vendor to put in writing how many lenders receive each lead.",
    },
    {
      q: "What consent do I need to text mortgage leads?",
      a: "For marketing calls or texts sent with an autodialer or prerecorded message, the TCPA generally requires prior express written consent. Ask to see the exact form the borrower completed.",
    },
    {
      q: "How can I check if a ZIP code is available on YPN USA?",
      a: "Use the free ZIP code check on ypnus.com. One loan officer holds each ZIP code within YPN USA, and it locks at your first payment.",
      html: 'Use the free <a href="/check-zip">ZIP code check</a>. One loan officer holds each ZIP code within YPN USA, and it locks at your first payment.',
    },
  ],
  closingHtml: closing(`<p><strong>Ready to see if your ZIP code is open?</strong> <a href="/check-zip">Check it free</a>.</p>`),
};

export const AI_FOLLOW_UP_BEFORE_HANDOFF: BlogPost = {
  slug: "what-ai-lead-follow-up-should-do-before-handoff",
  title: "What Should AI Lead Follow-Up Do Before Handing a Borrower to a Loan Officer?",
  metaTitle: "What AI Follow-Up Should Do Before a Loan Officer Handoff | YPN USA",
  description:
    "Automated mortgage follow-up should reply in minutes, get consent, ask five qualifying questions, answer general questions without quoting rates, then hand off with a summary.",
  date: DATE,
  author: AUTHOR,
  byline: BYLINE,
  readingMinutes: 6,
  cluster: "ai-lead-automation",
  html: `<p><strong>Short answer:</strong> before handing a prospect to a loan officer, automated mortgage follow-up should do five things: reply within minutes, confirm consent to keep in touch, ask a short set of qualifying questions (purpose, timeline, price range, area, best way to reach them), answer general program questions without quoting rates, and pass the borrower to the loan officer with a written summary. It should stop before anything that requires a license: taking an application, offering or negotiating terms, or making a credit decision.</p>

<h2>1. Reply right away, at any hour</h2>
<p>A borrower who fills out a form at 9 PM is often talking to more than one lender. The first reply that actually helps usually gets the conversation. Automation's first job is simply to answer, by chat, text or email, in the channel the borrower used. More on why in <a href="/blog/speed-to-lead-for-mortgage-loan-officers">speed to lead for loan officers</a>.</p>

<h2>2. Confirm consent and how to reach them</h2>
<p>Before follow-up texts or calls, the system should confirm the borrower agreed to be contacted that way and record it. For marketing calls and texts sent with an autodialer or prerecorded voice, the TCPA generally requires prior express written consent. Let the borrower pick text, call or email, and honor "stop" immediately.</p>

<h2>3. Ask only what the loan officer needs for a good first call</h2>
<p>Keep it to the questions a loan officer would ask in the first two minutes:</p>
<ul>
<li>Buying or refinancing?</li>
<li>Timeline: now, 1 to 3 months, later?</li>
<li>Rough price range or loan amount?</li>
<li>Where (city or ZIP code)?</li>
<li>Best way and time to reach them.</li>
</ul>
<p>Ask the same questions of every borrower. Varying questions by who someone seems to be creates fair-lending risk under the Equal Credit Opportunity Act. Don't ask for Social Security numbers, account numbers or anything else a borrower shouldn't type into a chat.</p>

<h2>4. Answer general questions, not rate questions</h2>
<p>Good automation explains how FHA, VA or conventional loans work, what pre-approval means, or which documents to gather. It does not quote a rate, payment or approval as an offer. Those depend on the borrower's full file and come from the licensed loan officer, with the disclosures the law requires. When the borrower asks "what's my rate?", the right answer is a friendly handoff, not a number.</p>

<h2>5. Hand off with a summary the loan officer can use</h2>
<p>The handoff is where most systems fail: the loan officer gets a name and phone number and starts from zero. A useful handoff includes:</p>
<table>
<thead><tr><th>Field</th><th>Example</th></tr></thead>
<tbody>
<tr><td>Goal</td><td>Buying first home</td></tr>
<tr><td>Timeline</td><td>Wants to buy in 2 to 3 months</td></tr>
<tr><td>Price range</td><td>Around $400,000</td></tr>
<tr><td>Area</td><td>Clovis, 93611</td></tr>
<tr><td>Questions asked</td><td>Down payment assistance, FHA vs conventional</td></tr>
<tr><td>Contact preference</td><td>Text after 5 PM, consent recorded</td></tr>
<tr><td>Urgency flag</td><td>Has an accepted offer / just browsing</td></tr>
</tbody>
</table>

<h2>What automation should never do</h2>
<ul>
<li><strong>Take a loan application or offer or negotiate terms.</strong> Under the SAFE Act those are loan originator activities that require a licensed or registered person.</li>
<li><strong>Quote or lock rates.</strong> A rate stated as an offer belongs to the licensed loan officer.</li>
<li><strong>Make or hint at credit decisions.</strong> "You'll be approved" is never the bot's line.</li>
<li><strong>Keep the borrower from a human.</strong> Anyone who asks for a person should get one.</li>
<li><strong>Route the borrower to another lender.</strong> The conversation goes to the loan officer whose page the borrower came from.</li>
</ul>

<h2>How Cerebro does it</h2>
<p><a href="/cerebro">Cerebro</a>, the AI assistant in YPN USA, follows this pattern. On your page, under your brand, it answers at any hour, asks about purchase or refinance, timeline, price range, area and how to reach the borrower, with consent, and routes the borrower to you with a summary of the conversation. It never offers or locks rates, makes credit decisions or gives legal or tax advice. You can try it free; plans are on the <a href="/pricing">pricing page</a>. For how this fits next to a CRM, see <a href="/blog/mortgage-crm-vs-ai-assistant">mortgage CRM vs AI assistant</a>, or read the wider <a href="/topics/ai-lead-automation">AI lead automation guide</a>.</p>

<h2>Sources</h2>
<ul>
${src("https://files.consumerfinance.gov/f/documents/cfpb_chatbot-issue-spotlight_2023-06.pdf", "CFPB: Chatbots in consumer finance (2023 issue spotlight)")}
${src("https://www.consumerfinance.gov/rules-policy/regulations/1026/36/", "CFPB: Regulation Z §1026.36, loan originator definition and compensation rules")}
${src("https://www.law.cornell.edu/cfr/text/47/64.1200", "47 CFR 64.1200: TCPA prior express written consent")}
${src("https://www.consumerfinance.gov/rules-policy/regulations/1002/", "CFPB: Regulation B (Equal Credit Opportunity Act)")}
</ul>`,
  faq: [
    {
      q: "How quickly should an AI assistant respond to a new mortgage inquiry?",
      a: "Within minutes, at any hour. The borrower is often contacting several lenders, and the first helpful reply usually wins the conversation.",
    },
    {
      q: "Can a chatbot qualify mortgage leads?",
      a: "It can ask basic qualifying questions such as purpose, timeline, price range and area. Taking an application, offering terms or making credit decisions must stay with the licensed loan officer.",
    },
    {
      q: "Should a mortgage chatbot quote interest rates?",
      a: "No. Rates depend on the borrower's full file and come from the licensed loan officer with required disclosures. The bot should explain how programs work and hand rate questions to the loan officer.",
    },
    {
      q: "What should a lead handoff summary include?",
      a: "Goal, timeline, price range, area, the questions the borrower asked, contact preference with consent, and anything urgent such as an accepted offer.",
    },
  ],
  closingHtml: closing(
    `<p><strong>Want every borrower answered in minutes and handed to you with a summary?</strong> <a href="/cerebro">Try Cerebro free</a>, then <a href="/check-zip">check if your ZIP code is open</a>.</p>`,
  ),
};

export const CRM_SOLO_VS_TEAM: BlogPost = {
  slug: "mortgage-crm-solo-loan-officer-vs-team",
  title: "How to Compare Mortgage CRMs for a Solo Loan Officer vs a Lending Team",
  metaTitle: "Mortgage CRM: Solo Loan Officer vs Team | YPN USA",
  description:
    "A solo loan officer needs a mortgage CRM that's fast, mobile and cheap to run; a team needs routing, permissions, reporting and compliance controls. A checklist for both.",
  date: DATE,
  author: AUTHOR,
  byline: BYLINE,
  readingMinutes: 6,
  cluster: "ai-lead-automation",
  html: `<p><strong>Short answer:</strong> a solo loan officer should pick the mortgage CRM they'll actually use every day: fast follow-up, simple automations, a good phone app and a price that fits one person. A lending team needs more: lead routing, user permissions, manager reporting, marketing approvals and a clean connection to the loan origination system. Compare CRMs on the jobs you need done, then make sure new borrowers get answered in minutes, which most CRMs don't do on their own.</p>

<h2>What a solo loan officer needs</h2>
<ul>
<li><strong>Speed to first contact.</strong> New-lead alerts on your phone and one-tap call or text.</li>
<li><strong>Simple, ready-made follow-up.</strong> Drip campaigns for new leads, pre-approvals that didn't buy, and past clients, without building them from scratch.</li>
<li><strong>Consent tracking.</strong> Who agreed to texts and calls, and when, plus automatic opt-out handling.</li>
<li><strong>A clean database you can export.</strong> Your past clients are your biggest asset. Make sure you can export them.</li>
<li><strong>Predictable cost.</strong> A per-seat price with no setup fee you can't recover in a few months.</li>
</ul>

<h2>What a lending team needs</h2>
<ul>
<li><strong>Lead routing.</strong> Round-robin or rules by area, program or language, with reassignment when nobody responds.</li>
<li><strong>Roles and permissions.</strong> Loan officers, assistants, processors and managers see what they need, nothing more.</li>
<li><strong>Manager reporting.</strong> Response times, contact rates and conversion by loan officer and lead source.</li>
<li><strong>Marketing approvals.</strong> Templates compliance has approved, and a record of what went out.</li>
<li><strong>LOS and pricing connections.</strong> Status updates from the loan origination system so marketing stops when a loan closes.</li>
<li><strong>Admin controls.</strong> Who owns data when a loan officer leaves, and how records are kept for exams.</li>
</ul>

<h2>Side-by-side checklist</h2>
<table>
<thead><tr><th>Question</th><th>Solo loan officer</th><th>Lending team</th></tr></thead>
<tbody>
<tr><td>Who answers a new lead at 9 PM?</td><td>You, or an assistant that answers for you</td><td>Routing rules plus an after-hours assistant</td></tr>
<tr><td>Most important report</td><td>Close rate by lead source</td><td>Response time and conversion by loan officer</td></tr>
<tr><td>Must-have integration</td><td>Phone, email, calendar</td><td>LOS, pricing engine, single sign-on</td></tr>
<tr><td>Compliance needs</td><td>Consent and opt-out tracking</td><td>Approved templates, audit trail, retention</td></tr>
<tr><td>Typical buying process</td><td>Free trial, self-serve</td><td>Demo, security review, contract</td></tr>
</tbody>
</table>

<h2>Questions to ask in every demo</h2>
<ol>
<li>Show me what happens in the first five minutes after a lead comes in.</li>
<li>How is texting consent captured and stored?</li>
<li>Can I export every contact and note, any time, without a fee?</li>
<li>What does it cost all-in for the first year, including setup and texting?</li>
<li>Which loan origination systems do you connect to, and how often does data sync?</li>
</ol>

<h2>Where an AI assistant fits</h2>
<p>A CRM is the system of record: it stores contacts and runs follow-up once someone is in it. It doesn't usually hold a real conversation with a borrower who shows up on your site at night. That front-door job is what an AI assistant does. <a href="/cerebro">Cerebro</a> answers borrowers on your page at any hour, asks purpose, timeline, price range, area and contact details with consent, and hands each one to you with a summary. Many loan officers keep the CRM they like and add Cerebro in front of it. We compare the two in <a href="/blog/mortgage-crm-vs-ai-assistant">mortgage CRM vs AI assistant</a>, and the <a href="/best-ai-assistants-for-loan-officers">best AI assistants for loan officers</a> guide compares tools by name.</p>

<h2>Sources</h2>
<ul>
${src("https://www.law.cornell.edu/cfr/text/47/64.1200", "47 CFR 64.1200: TCPA consent and opt-out rules")}
${src("https://www.consumerfinance.gov/compliance/compliance-resources/mortgage-resources/", "CFPB: Mortgage compliance resources")}
</ul>`,
  faq: [
    {
      q: "What is the best CRM for an independent loan officer?",
      a: "The one you'll use daily: fast lead alerts, ready-made follow-up, consent tracking, easy export and a price that fits one person. Try two or three with a free trial on your own leads before committing.",
    },
    {
      q: "What does a mortgage team need in a CRM that a solo loan officer doesn't?",
      a: "Lead routing, roles and permissions, manager reporting, approved marketing templates with an audit trail, and a connection to the loan origination system.",
    },
    {
      q: "Do I need a CRM and an AI assistant?",
      a: "Many loan officers use both. The CRM stores your database and runs follow-up; an AI assistant answers and qualifies new borrowers the moment they reach out, then hands them to you.",
    },
  ],
  closingHtml: closing(
    `<p><strong>Keep your CRM and add a front door that never sleeps.</strong> <a href="/cerebro">Try Cerebro free</a>, <a href="/pricing">see plans</a> or <a href="/check-zip">check if your ZIP code is open</a>.</p>`,
  ),
};

export const CAN_AI_CHATBOT_TALK_TO_BORROWERS: BlogPost = {
  slug: "can-an-ai-chatbot-talk-to-mortgage-borrowers",
  title: "Can an AI Chatbot Talk to Mortgage Borrowers? The Compliance Rules Loan Officers Need to Know",
  metaTitle: "Can an AI Chatbot Talk to Mortgage Borrowers?",
  description:
    "Yes, an AI chatbot can answer and qualify mortgage borrowers, within limits: no application-taking or term negotiation, no rates without Reg Z disclosures, TCPA consent and fair-lending care.",
  date: DATE,
  author: AUTHOR,
  byline: BYLINE,
  readingMinutes: 8,
  cluster: "ai-lead-automation",
  html: `<p><strong>Short answer:</strong> yes, an AI chatbot can talk to mortgage borrowers, answer general questions and collect basic qualifying information, as long as it stays out of the work that requires a mortgage license and follows the same consumer-protection rules a loan officer does. In practice that means no taking applications or negotiating terms, no rate or payment quotes without the disclosures Regulation Z requires, consent before marketing texts and calls, the same questions for every borrower, and a clear path to a human.</p>
<p>This is a practical summary for loan officers, not legal advice. Your company's compliance team and your state regulator have the final word.</p>

<h2>1. Licensing: the bot can't do what a loan originator does</h2>
<p>Under the SAFE Act and the CFPB's rules that implement it, a loan originator is someone who takes a residential mortgage loan application <em>and</em> offers or negotiates loan terms for compensation. Those activities belong to a licensed or registered loan officer. A chatbot can explain programs, gather contact details and preferences, and schedule a conversation. It should not collect a full application, present terms as an offer, or negotiate.</p>

<h2>2. Advertising rules apply to what the bot says</h2>
<p>A chatbot on your website is part of your advertising. Regulation Z's advertising rules (12 CFR 1026.24) apply:</p>
<ul>
<li>If it states a rate of finance charge, it must also state the APR.</li>
<li>If it uses a "triggering term", such as a down payment amount or percentage, the number of payments or repayment period, a payment amount or a finance charge amount, it must also disclose the down payment, the repayment terms and the APR (and that the rate may increase, if it can).</li>
</ul>
<p>The simplest safe design: the bot explains how programs work in general terms and hands any "what would my rate or payment be?" question to the loan officer.</p>

<h2>3. Consent before texts and calls</h2>
<p>The Telephone Consumer Protection Act generally requires a borrower's prior express written consent before marketing calls or texts sent with an autodialer or an artificial or prerecorded voice. If your chatbot collects a phone number for follow-up, it should capture clear consent language, record when and how it was given, and honor opt-outs like "STOP" right away. See our <a href="/blog/text-message-marketing-for-loan-officers">TCPA consent guide for loan officers</a>.</p>

<h2>4. Fair lending: same questions, same treatment</h2>
<p>The Equal Credit Opportunity Act and Regulation B prohibit discrimination on bases such as race, religion, national origin, sex, marital status and age, and Regulation B also bars discouraging people from applying on those bases. A chatbot should ask every borrower the same qualifying questions, never ask about protected characteristics, and never steer people away from applying. Review transcripts from time to time to make sure it behaves the same way for everyone.</p>

<h2>5. Accuracy: the CFPB's chatbot warning</h2>
<p>In its 2023 report on chatbots in consumer finance, the CFPB warned that chatbots can give wrong information, leave customers stuck in loops without reaching a human, and fail to recognize when someone is invoking their rights, and that using a chatbot doesn't excuse a company from federal consumer financial law. Practical guardrails:</p>
<ul>
<li>Give the bot approved, current content to answer from, and keep it to general education.</li>
<li>Make "talk to a person" work on the first request.</li>
<li>Escalate complaints, disputes and errors to a human immediately.</li>
<li>Keep transcripts so you can review what was said.</li>
</ul>

<h2>6. Privacy and data security</h2>
<p>Borrower information collected in chat is customer information. Non-bank mortgage companies fall under the FTC's Safeguards Rule, which requires a written security program. Collect only what you need for the first conversation. Don't let borrowers paste Social Security numbers, account numbers or documents into an open chat.</p>

<h2>7. Tell people it's automated</h2>
<p>Be upfront that the borrower is talking with an AI assistant. California's bot disclosure law (Business and Professions Code sections 17940 to 17943) makes it unlawful to use a bot to mislead someone in California about its artificial identity to encourage a sale, unless the bot is disclosed. A clear label is good practice everywhere.</p>

<h2>Checklist for a compliant mortgage chatbot</h2>
<table>
<thead><tr><th>Area</th><th>The chatbot should</th><th>The chatbot should not</th></tr></thead>
<tbody>
<tr><td>Licensing</td><td>Explain programs, collect contact and preferences</td><td>Take an application, offer or negotiate terms</td></tr>
<tr><td>Advertising</td><td>Speak in general terms</td><td>Quote rates or payments without required disclosures</td></tr>
<tr><td>Consent</td><td>Record texting and calling consent, honor STOP</td><td>Text borrowers who never agreed</td></tr>
<tr><td>Fair lending</td><td>Ask everyone the same questions</td><td>Ask about protected characteristics or discourage applying</td></tr>
<tr><td>Accuracy</td><td>Answer from approved content, hand off easily</td><td>Trap people in loops or guess</td></tr>
<tr><td>Privacy</td><td>Collect only what the first call needs</td><td>Accept SSNs or account numbers in chat</td></tr>
<tr><td>Disclosure</td><td>Say it's an AI assistant</td><td>Pretend to be a person</td></tr>
</tbody>
</table>

<h2>How Cerebro is built around these rules</h2>
<p><a href="/cerebro">Cerebro</a>, the AI assistant in YPN USA, answers borrower questions on your page at any hour, asks purpose, timeline, price range, area and contact details with consent, and hands every conversation to you, the licensed loan officer. It doesn't offer or lock rates, make credit decisions, or give legal or tax advice. You still own compliance for your business and should have your company review any tool before you use it. You can try Cerebro free; see <a href="/pricing">plans</a>. For what good handoffs look like, read <a href="/blog/what-ai-lead-follow-up-should-do-before-handoff">what AI follow-up should do before handing a borrower to you</a>.</p>

<h2>Sources</h2>
<ul>
${src("https://www.ecfr.gov/current/title-12/chapter-X/part-1008/subpart-B/section-1008.103", "eCFR: 12 CFR 1008.103, SAFE Act loan originator licensing")}
${src("https://www.consumerfinance.gov/rules-policy/regulations/1026/24/", "CFPB: Regulation Z §1026.24, advertising and triggering terms")}
${src("https://files.consumerfinance.gov/f/documents/cfpb_chatbot-issue-spotlight_2023-06.pdf", "CFPB: Chatbots in consumer finance (2023)")}
${src("https://www.consumerfinance.gov/rules-policy/regulations/1002/4/", "CFPB: Regulation B §1002.4, general rules against discrimination and discouragement")}
${src("https://www.law.cornell.edu/cfr/text/47/64.1200", "47 CFR 64.1200: TCPA rules")}
${src("https://www.ftc.gov/business-guidance/resources/ftc-safeguards-rule-what-your-business-needs-know", "FTC: Safeguards Rule, what your business needs to know")}
${src("https://leginfo.legislature.ca.gov/faces/codes_displaySection.xhtml?lawCode=BPC&sectionNum=17941", "California Business and Professions Code §17941 (bot disclosure)")}
</ul>`,
  faq: [
    {
      q: "Is it legal to use an AI chatbot on a mortgage website?",
      a: "Yes, for general information and basic intake, as long as it doesn't take applications or negotiate terms, follows Regulation Z advertising rules, gets consent before marketing texts and calls, treats every borrower the same and hands off to a licensed loan officer.",
    },
    {
      q: "Can a mortgage chatbot quote interest rates?",
      a: "Stating a rate in an ad requires the APR, and other terms trigger more disclosures under Regulation Z. Most loan officers keep the bot to general education and route rate questions to the licensed loan officer.",
    },
    {
      q: "Does a chatbot need an NMLS license?",
      a: "A chatbot isn't licensed, so it must stay out of loan originator activities: taking applications and offering or negotiating terms. Those belong to a licensed or registered loan officer.",
    },
    {
      q: "Do I have to tell borrowers they're talking to a bot?",
      a: "California law requires disclosing a bot used to encourage a sale when it could mislead someone about being a person, and it's good practice everywhere to label the assistant clearly.",
    },
  ],
  closingHtml: closing(
    `<p><strong>Want an AI assistant built to stay in its lane?</strong> <a href="/cerebro">See what Cerebro does and doesn't do</a>, then <a href="/check-zip">check if your ZIP code is open</a>.</p>`,
  ),
};

export const LOAN_OFFICER_PAY_PER_LOAN: BlogPost = {
  slug: "how-much-do-loan-officers-make-per-loan",
  title: "How Much Do Loan Officers Make Per Loan? Basis Points, Pay Rules and Real Math",
  metaTitle: "How Much Do Loan Officers Make Per Loan?",
  description:
    "Most loan officers earn a commission of roughly 50 to 150 basis points of the loan amount, so about $2,500 to $7,500 on a $500,000 loan. How LO pay works and what federal rules allow.",
  date: DATE,
  author: AUTHOR,
  byline: BYLINE,
  readingMinutes: 7,
  cluster: "loan-officer-marketing",
  html: `<p><strong>Short answer:</strong> most mortgage loan officers are paid a commission set as a percentage of the loan amount, and commonly quoted ranges run from about 0.50% to 1.50% (50 to 150 basis points), depending on the company and the pay plan. On a $500,000 loan that's roughly $2,500 to $7,500 before taxes and any split. Federal rules let a company pay a fixed percentage of the loan amount but bar pay that changes with the interest rate or other loan terms. The U.S. Bureau of Labor Statistics put the median pay for loan officers at $76,690 a year in May 2025.</p>

<h2>What a loan officer earns per loan</h2>
<p>A basis point is one hundredth of a percent, so 100 basis points (bps) is 1% of the loan amount. Here's what common commission levels pay on typical loan sizes. These are gross commissions before taxes, splits and expenses, not take-home pay.</p>
<table>
<thead><tr><th>Loan amount</th><th>50 bps (0.50%)</th><th>100 bps (1.00%)</th><th>150 bps (1.50%)</th></tr></thead>
<tbody>
<tr><td>$300,000</td><td>$1,500</td><td>$3,000</td><td>$4,500</td></tr>
<tr><td>$400,000</td><td>$2,000</td><td>$4,000</td><td>$6,000</td></tr>
<tr><td>$500,000</td><td>$2,500</td><td>$5,000</td><td>$7,500</td></tr>
<tr><td>$750,000</td><td>$3,750</td><td>$7,500</td><td>$11,250</td></tr>
</tbody>
</table>
<p>Ranges vary by source. Morty says most loan officers earn 0.50% to 1.00% of the loan amount, while Aceable says many companies pay in the range of 100 to 150 basis points. Your actual rate is whatever your compensation plan says, and many plans also set a minimum and maximum dollar amount per loan.</p>

<h2>What federal rules allow</h2>
<p>Loan originator pay is governed by Regulation Z, 12 CFR 1026.36(d):</p>
<ul>
<li><strong>A fixed percentage of the loan amount is allowed.</strong> The rule says the amount of credit isn't a "term of the transaction", so pay can be a fixed percentage of the amount financed, with a minimum or maximum dollar amount.</li>
<li><strong>Pay can't vary with the loan's terms.</strong> A loan officer can't earn more for putting a borrower in a higher rate or a particular product.</li>
<li><strong>No double dipping.</strong> If the borrower pays the loan originator directly, no one else (such as the lender) can also pay that originator for the same loan, with a narrow exception for a broker company paying its own employee.</li>
</ul>
<p>The CFPB explains it for consumers this way: lenders can pay a fixed percentage of the loan amount, and federal law prohibits commissions from varying based on the terms of the mortgage.</p>

<h2>Common pay structures</h2>
<ul>
<li><strong>Commission only.</strong> Typical at independent mortgage companies and brokerages. Highest upside, no floor.</li>
<li><strong>Base salary plus commission.</strong> Common at banks and credit unions, often with a lower commission rate.</li>
<li><strong>Salary or hourly.</strong> Common in call-center or consumer-direct roles where the company supplies the leads.</li>
<li><strong>Broker loan officers.</strong> The brokerage is paid by the lender or the borrower, and the loan officer receives a share under the brokerage's plan.</li>
</ul>

<h2>From per-loan pay to yearly income</h2>
<p>Yearly income is per-loan pay times units. An example, not a benchmark: a loan officer earning 100 bps who closes two $400,000 loans a month makes $8,000 a month in gross commission, or $96,000 a year. Add one more loan a month and it's $144,000. That's why the biggest lever for most loan officers isn't the commission rate. It's how many borrowers they talk to and how many of those close.</p>

<h2>How loan officers raise their income</h2>
<ul>
<li><strong>Close more of the leads you already have</strong> by answering every inquiry within minutes, including nights and weekends. See <a href="/blog/speed-to-lead-for-mortgage-loan-officers">speed to lead</a>.</li>
<li><strong>Build demand you don't share</strong>: local pages, a strong Google Business Profile, past-client follow-up and referral partners. Our <a href="/topics/loan-officer-marketing">loan officer marketing guide</a> covers each.</li>
<li><strong>Know your cost per closed loan</strong> for every lead source, so marketing spend goes where it pays. See <a href="/blog/is-buying-mortgage-leads-worth-it">is buying mortgage leads worth it</a>.</li>
</ul>
<p>YPN USA helps with the first two. <a href="/cerebro">Cerebro</a> answers borrowers on your page at any hour and hands them to you with a summary, and each paid plan includes one ZIP code that's yours alone within YPN USA. <a href="/check-zip">Check if your ZIP code is open</a> or <a href="/pricing">see plans</a>.</p>

<h2>Sources</h2>
<ul>
${src("https://www.bls.gov/ooh/business-and-financial/loan-officers.htm", "U.S. Bureau of Labor Statistics: Loan Officers, Occupational Outlook Handbook (median pay, May 2025)")}
${src("https://www.ecfr.gov/current/title-12/chapter-X/part-1026/subpart-E/section-1026.36", "eCFR: 12 CFR 1026.36, loan originator compensation")}
${src("https://www.consumerfinance.gov/ask-cfpb/is-my-broker-being-paid-for-getting-me-a-mortgage-loan-en-132/", "CFPB: How is my broker or loan officer being paid?")}
${src("https://www.morty.com/resources/?p=15627", "Morty: How much do loan officers make in commission")}
${src("https://mortgage.aceable.com/resources/pre-license/what-does-mortgage-loan-officer-commission-actually-look-like/", "Aceable: What mortgage loan officer commission actually looks like")}
</ul>`,
  faq: [
    {
      q: "How much does a loan officer make on a $500,000 loan?",
      a: "At commonly quoted commission levels of 50 to 150 basis points, about $2,500 to $7,500 in gross commission, before taxes and any split. The exact amount depends on the loan officer's compensation plan.",
    },
    {
      q: "How many basis points do loan officers get?",
      a: "It varies by company. Morty cites 0.50% to 1.00% of the loan amount for most loan officers, and Aceable says many companies pay 100 to 150 basis points.",
    },
    {
      q: "Can a loan officer be paid more for a higher interest rate?",
      a: "No. Regulation Z bars loan originator pay that varies with the loan's terms, including the interest rate. Pay can be a fixed percentage of the loan amount.",
    },
    {
      q: "What is the average loan officer salary?",
      a: "The Bureau of Labor Statistics reports a median of $76,690 a year for loan officers in May 2025. That figure covers all loan officers, including consumer and commercial lending, not only mortgage.",
    },
  ],
  closingHtml: closing(
    `<p><strong>More units is the fastest raise.</strong> <a href="/cerebro">Try Cerebro free</a> so no borrower waits, then <a href="/check-zip">check if your ZIP code is open</a>.</p>`,
  ),
};

export const WILL_AI_REPLACE_LOAN_OFFICERS: BlogPost = {
  slug: "will-ai-replace-mortgage-loan-officers",
  title: "Will AI Replace Mortgage Loan Officers? What Changes and What Stays Human",
  metaTitle: "Will AI Replace Mortgage Loan Officers? | YPN USA",
  description:
    "AI won't replace licensed mortgage loan officers: federal law reserves taking applications and negotiating terms for licensed people. AI is taking over tasks around them.",
  date: DATE,
  author: AUTHOR,
  byline: BYLINE,
  readingMinutes: 6,
  cluster: "ai-lead-automation",
  html: `<p><strong>Short answer:</strong> no, AI isn't replacing licensed mortgage loan officers, but it is replacing a lot of the tasks around them. Federal law requires a licensed or registered person to take mortgage applications and offer or negotiate loan terms, and borrowers still want a person they trust for the largest purchase of their lives. What's changing is who wins: loan officers who let AI answer, qualify and follow up will out-produce those who don't.</p>

<h2>Why the loan officer role stays</h2>
<ul>
<li><strong>The law reserves the core job for licensed people.</strong> Under the SAFE Act, someone who takes a residential mortgage loan application and offers or negotiates its terms for compensation must be licensed or registered through NMLS. Software can support that work but can't hold the license.</li>
<li><strong>Advice is judgment.</strong> Structuring a loan for a self-employed borrower, a divorce or a probate sale means weighing trade-offs with the borrower, not just looking up an answer.</li>
<li><strong>Trust closes loans.</strong> Borrowers and real estate agents pick the person they believe will get them to closing on time.</li>
</ul>
<p>The Bureau of Labor Statistics projects loan officer employment to grow about 1% from 2025 to 2035, slower than average, from 283,000 jobs in 2025. Slow growth isn't disappearance. It means fewer people doing the job, each doing more of it with better tools.</p>

<h2>What AI is already doing</h2>
<table>
<thead><tr><th>Task</th><th>AI does it well today</th><th>Stays with the loan officer</th></tr></thead>
<tbody>
<tr><td>First reply to a new inquiry</td><td>Yes, in seconds, at any hour</td><td>The first real advice call</td></tr>
<tr><td>Basic qualifying questions</td><td>Yes: purpose, timeline, price, area</td><td>Reviewing the full file</td></tr>
<tr><td>Explaining programs in plain language</td><td>Yes, from approved content</td><td>Recommending the right loan</td></tr>
<tr><td>Follow-up drafts and reminders</td><td>Yes, for your review</td><td>The relationship</td></tr>
<tr><td>Social posts and marketing copy</td><td>Yes, drafts to edit</td><td>Approving what goes out</td></tr>
<tr><td>Rates, terms and credit decisions</td><td>No</td><td>Always</td></tr>
</tbody>
</table>
<p>Consumers already use these tools: the CFPB estimated that more than 98 million people, about 37% of the U.S. population, interacted with a bank's chatbot in 2022. It also warned that chatbots must comply with federal consumer financial law and can go wrong when they give inaccurate answers or trap people without a way to reach a human. That's the line between AI that helps a loan officer and AI that hurts one.</p>

<h2>What loan officers should do now</h2>
<ol>
<li><strong>Put an AI assistant at your front door</strong> so no borrower waits until morning. See <a href="/blog/what-ai-lead-follow-up-should-do-before-handoff">what AI follow-up should do before handing a borrower to you</a>.</li>
<li><strong>Let AI do the first draft, you stay in charge.</strong> Posts and agent co-marketing copy wait for your review. Cerebro emails routine follow-ups on its own by default, or holds them for your OK if you choose approve-first.</li>
<li><strong>Keep the licensed work human.</strong> Rates, terms, applications and credit decisions stay with you. Our <a href="/blog/can-an-ai-chatbot-talk-to-mortgage-borrowers">chatbot compliance guide</a> lists the rules.</li>
<li><strong>Spend the saved hours on relationships</strong>: past clients, agents and the borrowers who need real advice.</li>
</ol>

<h2>How YPN USA uses AI</h2>
<p><a href="/cerebro">Cerebro</a> is built to assist loan officers, not replace them. It answers borrowers on your page at any hour, asks qualifying questions with consent, hands every borrower to you with a summary, and drafts local posts and Google Business Profile updates for you to review. It never offers or locks rates or makes credit decisions. You can start free; see <a href="/pricing">plans</a> or the wider <a href="/topics/ai-lead-automation">AI lead automation guide</a>.</p>

<h2>Sources</h2>
<ul>
${src("https://www.bls.gov/ooh/business-and-financial/loan-officers.htm", "U.S. Bureau of Labor Statistics: Loan Officers, Occupational Outlook Handbook (jobs 2025, outlook 2025-35)")}
${src("https://www.ecfr.gov/current/title-12/chapter-X/part-1008/subpart-B/section-1008.103", "eCFR: 12 CFR 1008.103, SAFE Act loan originator licensing")}
${src("https://files.consumerfinance.gov/f/documents/cfpb_chatbot-issue-spotlight_2023-06.pdf", "CFPB: Chatbots in consumer finance (June 2023)")}
</ul>`,
  faq: [
    {
      q: "Will AI replace mortgage loan officers?",
      a: "Not the licensed role. Federal law requires a licensed or registered person to take mortgage applications and offer or negotiate terms. AI is taking over surrounding tasks such as first replies, basic qualifying and follow-up drafts.",
    },
    {
      q: "Is mortgage loan officer a good career with AI coming?",
      a: "The Bureau of Labor Statistics projects about 1% job growth from 2025 to 2035, slower than average. The work is shifting toward advice and relationships, and loan officers who use AI tools can handle more borrowers.",
    },
    {
      q: "What can AI do for a loan officer today?",
      a: "Answer new inquiries instantly, ask basic qualifying questions, explain programs in general terms, draft follow-ups and marketing posts, and summarize conversations. Rates, terms and credit decisions stay with the loan officer.",
    },
  ],
  closingHtml: closing(
    `<p><strong>Let AI handle the front door while you handle the advice.</strong> <a href="/cerebro">Try Cerebro free</a>, then <a href="/check-zip">check if your ZIP code is open</a>.</p>`,
  ),
};

export const LOAN_OFFICER_PRODUCTION_LOOKUP: BlogPost = {
  slug: "how-to-look-up-a-loan-officers-production",
  title: "How to Look Up a Loan Officer's Production (and What Public Data Can't Tell You)",
  metaTitle: "How to Look Up a Loan Officer's Production or Volume | YPN USA",
  description:
    "No free public database shows an individual loan officer's volume. HMDA shows lenders, NMLS shows licenses, and recorded deeds of trust carry the loan officer's NMLS ID. Here's how to use each.",
  date: DATE,
  author: AUTHOR,
  byline: BYLINE,
  readingMinutes: 6,
  cluster: "loan-officer-marketing",
  html: `<p><strong>Short answer:</strong> there's no free public database that shows an individual loan officer's loan volume. Public HMDA data shows production by lender, because the loan officer's NMLS ID is one of the fields removed before release, and NMLS Consumer Access shows licenses, employment history and public regulatory actions, not volume. Individual production can be pieced together from recorded mortgage documents, which must list the loan originator's name and NMLS ID, and that's the public record commercial data providers compile.</p>

<h2>What each public source shows</h2>
<table>
<thead><tr><th>Source</th><th>Shows</th><th>Doesn't show</th></tr></thead>
<tbody>
<tr><td>NMLS Consumer Access</td><td>NMLS ID, names used, license status by state, current and past employers, public regulatory actions</td><td>Loan count or volume</td></tr>
<tr><td>HMDA public data (FFIEC)</td><td>Applications and originations by lender, county and census tract, with loan type and purpose</td><td>The individual loan officer (the NMLS ID field is removed)</td></tr>
<tr><td>County recorder records</td><td>Recorded deeds of trust or mortgages, which include the loan originator's name and NMLS ID</td><td>A ready-made total: you have to compile records yourself</td></tr>
</tbody>
</table>

<h2>Step 1: Confirm the license on NMLS Consumer Access</h2>
<p>Search the loan officer's name or NMLS ID on <a href="https://www.nmlsconsumeraccess.org/" target="_blank" rel="noopener nofollow">NMLS Consumer Access</a>. You'll see which states they're licensed in, the company sponsoring each license, their employment history and any public regulatory actions. It's the right first check for any loan officer you're hiring, partnering with or comparing yourself to.</p>

<h2>Step 2: Use HMDA for the lender's production</h2>
<p>The <a href="https://ffiec.cfpb.gov/data-browser/" target="_blank" rel="noopener nofollow">HMDA Data Browser</a> lets you filter originated loans by lender and area. You'll see how many loans a company made in a county, and how many were purchase, refinance, FHA or VA. To protect borrower privacy, the public file drops 27 fields, including the Mortgage Loan Originator NMLSR Identifier, so you can't filter by individual. Our <a href="/research/fresno-county-ca">Fresno County market report</a> is an example of what county-level HMDA data shows.</p>

<h2>Step 3: Individual volume comes from recorded documents</h2>
<p>Regulation Z (12 CFR 1026.36(g)) requires the lender or broker to put the individual loan officer's name and NMLS ID on the credit application, the Loan Estimate and Closing Disclosure, the note and the security instrument. The security instrument (the deed of trust or mortgage) is recorded with the county, so recorded documents can be tied back to a loan officer. Counting those by hand is slow. Commercial mortgage data providers, often used by recruiters and lenders, compile recorded loans and match them to loan officers for a fee. Treat their numbers as estimates and ask how they handle loans recorded under a team lead or a company.</p>

<h2>Step 4: Ask</h2>
<p>When you're evaluating a referral partner, a hire or a mentor, the simplest route is to ask for their units and volume over the last 12 months and the main loan types. Most producing loan officers know their numbers and will share them.</p>

<h2>Why loan officers look this up</h2>
<ul>
<li><strong>Recruiting and job moves.</strong> Companies use production data to recruit; you can use the same sources to judge a branch or team.</li>
<li><strong>Finding agent partners.</strong> Recorded loans show which lenders an agent's buyers use.</li>
<li><strong>Sizing your market.</strong> County HMDA data shows how many loans are made where you work, by program.</li>
</ul>
<p>If you're sizing a market to grow in, YPN USA gives one loan officer each ZIP code within YPN USA, and <a href="/cerebro">Cerebro</a> answers borrowers on your page at any hour. <a href="/check-zip">Check if your ZIP code is open</a> or <a href="/pricing">see plans</a>.</p>

<h2>Sources</h2>
<ul>
${src("https://ffiec.cfpb.gov/documentation/publications/modified-lar/resources/using-mlar-data", "FFIEC: Using modified LAR data (fields removed for privacy)")}
${src("https://www.nmlsconsumeraccess.org/", "NMLS Consumer Access")}
${src("https://files.consumerfinance.gov/f/documents/cfpb_instructions-viewing-state-regulatory-actions-nmls.pdf", "CFPB: Viewing state regulatory actions in NMLS (2024)")}
${src("https://www.ecfr.gov/current/title-12/chapter-X/part-1026/subpart-E/section-1026.36", "eCFR: 12 CFR 1026.36(g), loan officer name and NMLS ID on loan documents")}
${src("https://ffiec.cfpb.gov/data-browser/", "FFIEC / CFPB HMDA Data Browser")}
</ul>`,
  faq: [
    {
      q: "Can I look up how many loans a loan officer has closed?",
      a: "Not from a free government database. HMDA public data removes the loan officer's NMLS ID, and NMLS Consumer Access doesn't show volume. Recorded deeds of trust list the loan originator's NMLS ID, and commercial data providers compile those for a fee.",
    },
    {
      q: "What does NMLS Consumer Access show about a loan officer?",
      a: "Their NMLS ID, names used, license status by state, sponsoring companies, employment history and public regulatory actions.",
    },
    {
      q: "Does HMDA data show individual loan officers?",
      a: "No. The public modified LAR drops 27 fields for privacy, including the Mortgage Loan Originator NMLSR Identifier, so HMDA shows production by lender, not by loan officer.",
    },
  ],
  closingHtml: closing(`<p><strong>Sizing up your own market?</strong> <a href="/check-zip">Check if your ZIP code is open</a>.</p>`),
};

export const HOW_MANY_LOAN_OFFICERS: BlogPost = {
  slug: "how-many-mortgage-loan-officers-are-there",
  title: "How Many Mortgage Loan Officers Are There in the U.S.?",
  metaTitle: "How Many Mortgage Loan Officers Are in the U.S.? (2026) | YPN USA",
  description:
    "About 550,000 people held mortgage loan originator licenses or registrations in NMLS in 2025, while BLS counts 283,000 loan officer jobs. What the numbers mean for competition.",
  date: DATE,
  author: AUTHOR,
  byline: BYLINE,
  readingMinutes: 5,
  cluster: "loan-officer-marketing",
  html: `<p><strong>Short answer:</strong> more than 550,000 people were licensed or registered as mortgage loan originators through NMLS in 2025, according to the Conference of State Bank Supervisors (CSBS). That count includes state-licensed loan officers and federally registered bank loan officers, and many are licensed but not actively producing. The Bureau of Labor Statistics counts 283,000 loan officer jobs in 2025 across all lending, not only mortgages.</p>

<h2>The numbers, side by side</h2>
<table>
<thead><tr><th>Measure</th><th>Figure</th><th>Source</th></tr></thead>
<tbody>
<tr><td>People licensed or registered as mortgage loan originators in NMLS</td><td>More than 550,000 (2025)</td><td>CSBS Annual Report 2025</td></tr>
<tr><td>Individuals who requested renewal of state MLO licenses for 2026</td><td>158,260</td><td>National Mortgage News, citing CSBS (Feb 2026)</td></tr>
<tr><td>Loan officer jobs, all lending types</td><td>283,000 (2025)</td><td>BLS Occupational Outlook Handbook</td></tr>
<tr><td>Projected loan officer job growth</td><td>About 1%, 2025 to 2035</td><td>BLS</td></tr>
<tr><td>Institutions reporting HMDA data</td><td>5,113 (2023 data)</td><td>CFPB</td></tr>
<tr><td>Home loans originated</td><td>About 5.69 million (2023 data)</td><td>CFPB</td></tr>
</tbody>
</table>

<h2>Why the counts don't match</h2>
<ul>
<li><strong>Licensed isn't the same as producing.</strong> NMLS counts everyone with an active license or federal registration, including part-time, new and inactive loan officers.</li>
<li><strong>State-licensed vs federally registered.</strong> Loan officers at nonbank lenders and brokers hold state licenses (often several states each). Loan officers at banks and credit unions register with NMLS instead of getting a state license.</li>
<li><strong>BLS counts jobs, not licenses.</strong> Its "loan officers" category includes consumer and commercial lending, and it counts each job once.</li>
</ul>

<h2>How busy is the market?</h2>
<p>The CFPB's report on 2023 HMDA data counted about 5.69 million originated loans from 5,113 reporting institutions. The Mortgage Bankers Association's October 2026 forecast estimated $2.1 trillion in single-family originations for 2026 and just under $2 trillion for 2027, with rates expected to stay above 7%. Fewer loans spread across a large licensed workforce is why winning the borrowers in your own area matters more than ever.</p>

<h2>What it means for competition where you work</h2>
<p>National totals don't tell you how crowded your ZIP code is. Two better questions:</p>
<ol>
<li><strong>How many loans are made in your area, by program?</strong> County and census tract HMDA data answers this. For example, lenders reported 13,027 originated loans in Fresno County, California in 2024; see our <a href="/research/fresno-county-ca">Fresno County market report</a>.</li>
<li><strong>Who else is going after the same borrowers?</strong> Shared leads go to several lenders at once. See our checklist of <a href="/blog/what-to-check-before-buying-mortgage-leads-in-a-zip-code">what to check before paying for leads in a ZIP code</a>.</li>
</ol>
<p>YPN USA gives one loan officer each ZIP code within YPN USA, so borrower inquiries from YPN USA pages for that ZIP code go only to you, and <a href="/cerebro">Cerebro</a> answers them at any hour. Other lenders still market in your area. <a href="/check-zip">Check if your ZIP code is open</a> or <a href="/pricing">see plans</a>.</p>

<h2>Sources</h2>
<ul>
${src("https://www.csbs.org/sites/default/files/reports/CSBS_AnnualReport%202025%20Web%20version_080526_vfinal.pdf", "CSBS: Annual Report 2025 (NMLS licensing figures)")}
${src("https://www.nationalmortgagenews.com/news/mortgage-licensing-ticks-up-as-industry-eyes-2026-reset", "National Mortgage News: Mortgage licensing ticks up as industry eyes 2026 reset (Feb 2026)")}
${src("https://www.bls.gov/ooh/business-and-financial/loan-officers.htm", "U.S. Bureau of Labor Statistics: Loan Officers, Occupational Outlook Handbook")}
${src("https://files.consumerfinance.gov/f/documents/cfpb_2023-mortgage-market-activity-and-trends_2024-12.pdf", "CFPB: Data Point, 2023 Mortgage Market Activity and Trends (Dec 2024)")}
${src("https://newslink.mba.org/cmf-newslinks/2026/october/mba-commercial-multifamily-newslink-thursday-oct-15-2026/mba-forecast-mortgage-originations-to-decrease-5-in-2027-as-mortgage-rates-remain-above-7/", "MBA: Forecast, mortgage originations to decrease 5% in 2027 (Oct 2026)")}
</ul>`,
  faq: [
    {
      q: "How many licensed mortgage loan officers are there in the U.S.?",
      a: "More than 550,000 people were licensed or registered as mortgage loan originators through NMLS in 2025, according to CSBS. That includes federally registered bank loan officers and many who aren't actively producing.",
    },
    {
      q: "How many loan officer jobs are there?",
      a: "The Bureau of Labor Statistics counts 283,000 loan officer jobs in 2025, across mortgage, consumer and commercial lending, and projects about 1% growth from 2025 to 2035.",
    },
    {
      q: "How many mortgages are originated each year?",
      a: "The CFPB counted about 5.69 million originated loans in 2023 HMDA data. The MBA estimated $2.1 trillion in single-family originations for 2026 in its October 2026 forecast.",
    },
  ],
  closingHtml: closing(`<p><strong>Want a ZIP code no other YPN USA loan officer can claim?</strong> <a href="/check-zip">Check it free</a>.</p>`),
};

export const CAN_YPNUS_HELP_WITH_MORTGAGE_MARKETING: BlogPost = {
  slug: "can-ypnus-help-with-mortgage-marketing",
  title: "Can ypnus.com Help With Mortgage Marketing? What YPN USA Does (and Doesn't Do)",
  metaTitle: "Can ypnus.com Help With Mortgage Marketing? | YPN USA",
  description:
    "Yes. YPN USA (ypnus.com) is marketing technology for licensed loan officers: an exclusive ZIP code, local pages and Cerebro, an AI assistant that answers and qualifies borrowers.",
  date: "2026-11-25",
  author: AUTHOR,
  byline: BYLINE,
  readingMinutes: 6,
  cluster: "loan-officer-marketing",
  html: `<p><strong>Short answer:</strong> yes. ypnus.com is YPN USA, a mortgage marketing platform built only for licensed mortgage loan officers. It gives you one ZIP code that no other YPN USA loan officer can claim, local pages for that market, and Cerebro, an AI assistant that answers borrower questions 24/7, qualifies them and hands them to you with a summary. It's marketing technology, not a lender: you stay responsible for licensing, rates and compliance. You can start free with no card.</p>

<h2>What is ypnus.com?</h2>
<p>ypnus.com is the website of YPN USA, a marketing technology company operated by YPN Inc. It was founded by David J. Moore, MBA, a mortgage loan officer for 25+ years (NMLS #787257). YPN USA sells to loan officers, branch managers and mortgage teams. It does not make loans, broker loans or service loans, and nothing on the site is a commitment to lend. See our <a href="/licensing-disclosures">licensing and disclosures</a>.</p>

<h2>How does YPN USA help with mortgage marketing?</h2>
<p>Everything below is live today. Plan limits apply; <a href="/pricing">pricing</a> shows what each plan includes.</p>
<ul>
<li><strong>An exclusive ZIP code within YPN USA.</strong> Each paid plan includes one ZIP code. Borrower inquiries from YPN USA pages for that ZIP code go only to you. It locks at your first payment, first come, first served. <a href="/check-zip">Check if your ZIP code is open</a>.</li>
<li><strong>Local pages that borrowers can find.</strong> Paid plans include a local page for your ZIP code. Growth and Exclusive add local city pages for your market on a <a href="/features/branded-mlo-website">portable MLO website</a> tied to you, not your company.</li>
<li><strong>An AI assistant that answers and qualifies.</strong> <a href="/cerebro">Cerebro</a> answers borrower questions at any hour, asks your first questions (purchase or refinance, timeline, price range, area, contact details, with consent), records the conversation and routes the borrower and a summary to you.</li>
<li><strong>Follow-up that doesn't wait on you.</strong> On paid plans, Cerebro emails borrowers who opted in and drafts your texts for your approval, with calendar booking and CRM mirroring.</li>
<li><strong>Marketing drafts.</strong> Cerebro drafts local social posts, Google Business Profile updates and Realtor co-marketing copy for you to review and edit before anything goes out. Two free tools do the same without an account: the <a href="/tools/social-writer">social media marketing writer</a> and the <a href="/tools/gbp-optimizer">Google Business Profile optimizer</a>.</li>
<li><strong>A growth plan and market data.</strong> Cerebro builds a plan for your ZIP code from what you tell it about your market. Our <a href="/markets">mortgage market pages</a> and the <a href="/markets/metro">top 100 metro mortgage markets</a> show public HMDA loan data, so you can see how many loans are actually made where you work.</li>
<li><strong>Life-event signals (Growth and Exclusive).</strong> Where supported public-record data exists, YPN USA organizes life-event signals in your territory. Availability varies by county.</li>
<li><strong>Teams.</strong> Each loan officer on a team gets their own ZIP code, pages and Cerebro follow-up, so they don't compete for the same borrowers. See <a href="/teams">YPN USA for teams</a>.</li>
</ul>

<h2>What's coming soon (not live yet)</h2>
<p>Cerebro is not a fully autonomous agent today. These are in development and not available yet: done-for-you Google Business Profile setup, a Local Visibility Score for your ZIP code, and a multi-task agentic mode where Cerebro works through several tasks in a row with you approving each result. The <a href="/cerebro">Cerebro page</a> marks each one live when it ships.</p>

<h2>What does YPN USA cost?</h2>
<p>Prices from the <a href="/pricing">pricing page</a> on November 25, 2026 (launch rates):</p>
<table>
<thead><tr><th>Plan</th><th>Price</th><th>What it adds</th></tr></thead>
<tbody>
<tr><td>Free</td><td>$0, no card</td><td>Cerebro growth diagnostic and AI borrower intake. Does not lock a ZIP code.</td></tr>
<tr><td>Pro</td><td>$99/mo or $990/yr</td><td>1 exclusive ZIP code, live lead delivery, Cerebro email follow-up and text drafts, calendar booking and CRM mirroring, a local page for your ZIP code</td></tr>
<tr><td>Growth</td><td>$199/mo</td><td>Pro plus a portable MLO website, local city pages, priority lead delivery and life-event signals</td></tr>
<tr><td>Exclusive</td><td>$299/mo</td><td>Growth plus unlimited automation runs, priority ZIP code add-on access and white-glove onboarding</td></tr>
</tbody>
</table>
<p>Every paid plan has a 15-day free trial, but the trial doesn't lock your ZIP code; your first payment does. An extra ZIP code is $79 a month or $790 a year. Five-year prepaid plans are also on the pricing page. To see what one extra loan a year covers, try the <a href="/roi">ROI calculator</a>.</p>

<h2>Does YPN USA replace my CRM?</h2>
<p>No. YPN USA brings in and answers new local borrowers; your CRM keeps your full pipeline and past clients, and your loan origination system stays the record for the loan file. Paid plans mirror leads to your CRM. If you rely on a specific CRM, ask us about your setup before you buy. Our guide to <a href="/blog/mortgage-crm-vs-ai-assistant">mortgage CRM vs AI assistant</a> explains how the two fit together.</p>

<h2>What stays your responsibility</h2>
<ul>
<li><strong>Licensing and advertising.</strong> Your NMLS ID belongs on the pages and marketing that promote you, and your company may need to approve your marketing.</li>
<li><strong>Rates and credit decisions.</strong> Cerebro never presents a rate as an offer, makes credit decisions or gives legal or tax advice. Every application, rate and approval is yours.</li>
<li><strong>RESPA and TCPA.</strong> Borrowers are asked for consent before they're contacted by text or email, and texts tell them how to opt out. You remain responsible for RESPA, TCPA and state licensing compliance.</li>
</ul>

<h2>Questions to ask before you subscribe</h2>
<ol>
<li><strong>Are the leads exclusive or shared?</strong> Inquiries from YPN USA pages for your ZIP code go only to you. Exclusivity applies within YPN USA; other lenders can still market in your area.</li>
<li><strong>How many leads will I get?</strong> Nobody can honestly promise a number. It depends on your market, your pages and how fast you follow up. Start with the loan volume in your area: our <a href="/markets">market data</a> shows it.</li>
<li><strong>Who owns the leads if I cancel?</strong> You do. Every borrower Cerebro captures is yours, exported and portable, on every plan. Canceling stops new capture and your ZIP code exclusivity.</li>
<li><strong>Will I still need to drive traffic?</strong> Usually yes. Local pages build over time; your Google Business Profile, past clients and Realtor partners speed it up.</li>
<li><strong>Can my compliance team review it?</strong> Yes. <a href="/teams">Book a team walkthrough</a> to go through Cerebro's guardrails, consent handling and hand-off.</li>
</ol>

<h2>Is YPN USA a good fit for you?</h2>
<p>It fits a licensed loan officer who wants to own demand in a specific ZIP code instead of buying shared leads, and wants borrowers answered at 9 PM without being on the phone at 9 PM. It's a weaker fit if you want a full CRM, someone to run paid ads for you, or done-for-you sales calls. Want the other options side by side? See the <a href="/best-ai-assistants-for-loan-officers">best AI assistants for loan officers</a> and <a href="/blog/how-to-get-mortgage-leads-without-buying-them-a-loan-officers-2026-playbook">how to get mortgage leads without buying them</a>.</p>

<h2>Sources</h2>
<ul>
${src("https://www.consumerfinance.gov/compliance/compliance-resources/mortgage-resources/real-estate-settlement-procedures-act/real-estate-settlement-procedures-act-faqs/", "CFPB: Real Estate Settlement Procedures Act FAQs")}
${src("https://www.fcc.gov/general/telemarketing-and-robocalls", "FCC: Telemarketing and robocalls (TCPA consent rules)")}
${src("https://www.nmlsconsumeraccess.org/EntityDetails.aspx/individual/787257", "NMLS Consumer Access: David J. Moore, NMLS #787257")}
</ul>`,
  faq: [
    {
      q: "What is ypnus.com?",
      a: "ypnus.com is YPN USA, a mortgage marketing platform for licensed loan officers operated by YPN Inc. It provides an exclusive ZIP code within YPN USA, local pages and Cerebro, an AI assistant that answers and qualifies borrowers. It is not a lender.",
    },
    {
      q: "Can ypnus.com help me with mortgage marketing?",
      a: "Yes, if you're a licensed mortgage loan officer. YPN USA gives you local pages for an exclusive ZIP code, 24/7 AI intake and follow-up through Cerebro, and drafts of local social posts, Google Business Profile updates and Realtor co-marketing copy.",
    },
    {
      q: "How much does YPN USA cost?",
      a: "Free is $0 with no card. Pro is $99 a month ($990 a year), Growth is $199 and Exclusive is $299 a month, each with a 15-day free trial. Your ZIP code locks at your first payment.",
      html: 'Free is $0 with no card. Pro is $99 a month ($990 a year), Growth is $199 and Exclusive is $299 a month, each with a 15-day free trial. Your ZIP code locks at your first payment. See <a href="/pricing">pricing</a>.',
    },
    {
      q: "Are YPN USA leads exclusive or shared?",
      a: "Borrower inquiries from YPN USA pages for your ZIP code go only to you, because one YPN USA loan officer holds each ZIP code. Exclusivity applies within YPN USA; other lenders can still market in the same area.",
      html: 'Borrower inquiries from YPN USA pages for your ZIP code go only to you, because one YPN USA loan officer holds each ZIP code. Exclusivity applies within YPN USA; other lenders can still market in the same area. <a href="/check-zip">Check your ZIP code</a>.',
    },
    {
      q: "Does YPN USA replace my CRM?",
      a: "No. It works alongside your CRM: YPN USA attracts and answers new local borrowers, and paid plans mirror leads to your CRM, which keeps your full pipeline and past clients.",
    },
    {
      q: "What AI tools can a loan officer use to close more loans?",
      a: "The tools that help most answer new borrowers right away, follow up for weeks without you, and draft your local marketing. Cerebro does all three inside YPN USA. Compare options in our guide to the best AI assistants for loan officers.",
      html: 'The tools that help most answer new borrowers right away, follow up for weeks without you, and draft your local marketing. <a href="/cerebro">Cerebro</a> does all three inside YPN USA. Compare options in our guide to the <a href="/best-ai-assistants-for-loan-officers">best AI assistants for loan officers</a>.',
    },
  ],
  closingHtml: closing(
    `<p><strong>See it on your own market.</strong> <a href="/check-zip">Check if your ZIP code is open</a>, <a href="/cerebro">talk to Cerebro</a> or <a href="/pricing">see plans</a>, starting free.</p>`,
  ),
};

export const ANSWER_POSTS: readonly BlogPost[] = [
  CAN_YPNUS_HELP_WITH_MORTGAGE_MARKETING,
  IS_BUYING_MORTGAGE_LEADS_WORTH_IT,
  LOAN_OFFICER_PAY_PER_LOAN,
  WILL_AI_REPLACE_LOAN_OFFICERS,
  ZIP_CODE_LEAD_CHECKLIST,
  AI_FOLLOW_UP_BEFORE_HANDOFF,
  CAN_AI_CHATBOT_TALK_TO_BORROWERS,
  LOAN_OFFICER_PRODUCTION_LOOKUP,
  HOW_MANY_LOAN_OFFICERS,
  CRM_SOLO_VS_TEAM,
];
