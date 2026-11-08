import type { BlogPost } from "@/content/blog";

/**
 * Posts from the Nov 2026 SEO plan (sections 14 and 15), published as written. Each one
 * links up to its pillar on first mention, to one related post, and to /claim-territory
 * or /pricing at the end. The FAQ is rendered from `faq` (visible on the page and in the
 * FAQPage JSON-LD), so the two can't drift apart.
 */

const BYLINE = "By David J. Moore, MBA · 25+ years as a loan officer, 2,000+ loans closed · NMLS #787257";

export const MORTGAGE_MARKETING_IDEAS: BlogPost = {
  slug: "mortgage-marketing-ideas-for-loan-officers",
  title: "27 Mortgage Marketing Ideas for Loan Officers That Cost Nothing",
  metaTitle: "27 Mortgage Marketing Ideas for Loan Officers | YPN USA",
  description:
    "27 free mortgage marketing ideas for loan officers: local search, video, referral partners, past clients and community, from a 25-year loan officer.",
  date: "2026-11-08",
  author: "David J. Moore, MBA",
  byline: BYLINE,
  readingMinutes: 8,
  cluster: "loan-officer-marketing",
  html: `<p>You don't need an ad budget to fill your pipeline. Most of the loan officers I've watched grow steadily did it with consistent, local, unglamorous work that costs time instead of money. Here are 27 ideas you can start this week, grouped so you can pick one from each section and build a routine. They fit inside a broader <a href="/topics/loan-officer-marketing">loan officer marketing</a> strategy, but each one works on its own.</p>

<h2>Get found locally</h2>
<ol>
<li><strong>Finish your Google Business Profile.</strong> Fill in every field: categories, service areas, hours, photos, your NMLS ID in the description, and a booking link. It's the single most valuable free listing a loan officer has.</li>
<li><strong>Post on your Google profile every week.</strong> A short update about a program, a local market note or a closing (with the client's permission) keeps the profile active.</li>
<li><strong>Ask every closed borrower for a review.</strong> Send the review link the day after closing, while the experience is fresh. Make it a step in your closing checklist so it never gets skipped.</li>
<li><strong>Claim Bing Places and Apple Business Connect.</strong> Same information as Google. Ten minutes each, and they feed Bing, Copilot and Apple Maps.</li>
<li><strong>Build a page for each area you serve.</strong> One page per city or ZIP code, with local details a template can't fake: neighborhoods, typical buyers, local programs. See our guide to <a href="/topics/local-seo-for-loan-officers">local SEO for loan officers</a>.</li>
</ol>

<h2>Create content people actually search for</h2>
<ol start="6">
<li><strong>Answer the 10 questions borrowers ask you most.</strong> Write them down this week. Each one becomes a short video, a blog post and a social post.</li>
<li><strong>Turn every answer into a Short or a Reel.</strong> Thirty to sixty seconds, one question, captions on. Phone video is fine.</li>
<li><strong>Publish a monthly local market snapshot.</strong> Inventory, days on market and price trends for your area. If you mention rates or payment terms, include the required disclosures.</li>
<li><strong>Write a first-time buyer guide.</strong> A plain-language PDF covering credit, down payment, assistance programs and timelines. Use it as a free download on your site.</li>
<li><strong>Post one useful article a week.</strong> Pick a local question ("How much do I need to buy in Visalia?") and answer it honestly. Consistency beats volume.</li>
<li><strong>Use LinkedIn for referral partners.</strong> Agents, CPAs and planners are there. Share what you're seeing in the market and how you help their clients.</li>
</ol>

<h2>Build referral partnerships</h2>
<ol start="12">
<li><strong>Teach a free homebuyer class.</strong> Libraries and community centers often host these at no cost. Bring an agent and keep it educational.</li>
<li><strong>Offer agents something useful.</strong> A co-branded financing one-pager for their listings, or a quick pre-approval turnaround. Keep everything RESPA-compliant: no payments or gifts for referrals, and split any shared marketing costs fairly.</li>
<li><strong>Teach a financing update for agent offices.</strong> Ten minutes at a sales meeting on programs, credit or down payment assistance. You become the loan officer they think of first.</li>
<li><strong>Partner with professionals beyond agents.</strong> CPAs, financial planners, divorce attorneys and estate attorneys all have clients who need financing. We wrote about <a href="/blog/building-referral-partnerships-with-estate-and-probate-attorneys">building referral partnerships with estate and probate attorneys</a>.</li>
<li><strong>Show up at free local networking events.</strong> Pick one group and go every time. Being a familiar face matters more than being everywhere once.</li>
</ol>

<h2>Work the database you already have</h2>
<ol start="17">
<li><strong>Call past clients for an annual mortgage review.</strong> Check their goals, equity and rate situation once a year. It's service, and it brings referrals.</li>
<li><strong>Remember home anniversaries.</strong> A personal note or text (with their consent) on the anniversary of closing keeps you top of mind.</li>
<li><strong>Send a short monthly email.</strong> One market note, one tip, one story. Free email tools are enough at the start, and include an unsubscribe link and your address.</li>
<li><strong>Revisit old pre-approvals.</strong> People who got pre-approved six to twelve months ago and didn't buy are often still looking. A friendly check-in can restart the conversation.</li>
</ol>

<h2>Be part of the community</h2>
<ol start="21">
<li><strong>Volunteer where homeownership happens.</strong> Housing nonprofits and build days put you next to future buyers and the agents who serve them.</li>
<li><strong>Teach credit basics at schools and colleges.</strong> Many welcome a guest speaker on credit and first homes.</li>
<li><strong>Serve borrowers in their language.</strong> If you speak Spanish or another language common in your area, say so on your profile, site and videos.</li>
<li><strong>Help in local online groups.</strong> Answer homebuying questions in local Facebook groups and Nextdoor. Follow each group's rules and lead with help, not pitches.</li>
<li><strong>Answer homebuying questions on public forums.</strong> Thoughtful, specific answers build a reputation that outlasts any ad.</li>
<li><strong>Get quoted by reporters.</strong> Free journalist request services connect experts with reporters writing about housing. A quote with a link helps your search rankings too.</li>
</ol>

<h2>Win the leads you already get</h2>
<ol start="27">
<li><strong>Reply to every inquiry within minutes, even after hours.</strong> Many borrowers go with whoever answers first. If you can't always be there, an AI assistant can answer, qualify and hand the conversation to you. <a href="/cerebro">Cerebro does this</a>, and you can start free.</li>
</ol>

<h2>Stay compliant while you market</h2>
<ul>
<li>Put your NMLS ID on every ad, post and page that promotes your services.</li>
<li>If you mention rates or payment terms, include the required disclosures.</li>
<li>Get written consent before texting borrowers.</li>
<li>Never pay or accept anything for referrals of settlement-service business (RESPA Section 8).</li>
<li>Include an unsubscribe link and your physical address in marketing emails.</li>
</ul>`,
  faq: [
    {
      q: "What is the best free marketing for a loan officer?",
      a: "A complete, active Google Business Profile with steady reviews, plus a page for each area you serve. They work around the clock and cost nothing.",
    },
    {
      q: "How often should a loan officer post on social media?",
      a: "Two to four times a week is plenty if each post helps someone. One useful video a week beats daily filler.",
    },
    {
      q: "Do I need a website as a loan officer?",
      a: "Yes. Your profile on your company's site helps, but your own local pages are what rank and what you keep if you change companies.",
    },
    {
      q: "How can loan officers get leads without buying them?",
      a: "Combine local search, referral partners and your past-client database, then make sure every inquiry gets an answer fast. Our breakdown of mortgage lead channels ranked for 2026 compares the options.",
      html: 'Combine local search, referral partners and your past-client database, then make sure every inquiry gets an answer fast. Our breakdown of <a href="/blog/mortgage-lead-channels-ranked-for-2026">mortgage lead channels ranked for 2026</a> compares the options.',
    },
  ],
  closingHtml: `<p><strong>Want to know if your ZIP code is open?</strong> <a href="/claim-territory">Check it free</a>.</p>`,
};

export const MORTGAGE_CRM_VS_AI_ASSISTANT: BlogPost = {
  slug: "mortgage-crm-vs-ai-assistant",
  title: "Mortgage CRM vs AI Assistant: What Loan Officers Actually Need in 2026",
  metaTitle: "Mortgage CRM vs AI Assistant for Loan Officers | YPN USA",
  description:
    "A loan officer CRM tracks your pipeline; an AI assistant answers borrowers in minutes. What each does, where each falls short, and when you need both.",
  date: "2026-11-08",
  author: "David J. Moore, MBA",
  byline: BYLINE,
  readingMinutes: 6,
  cluster: "ai-lead-automation",
  html: `<p>Every loan officer I know has paid for <a href="/topics/ai-lead-automation">a mortgage CRM</a> at some point, and plenty of them still lose deals to the loan officer who simply answered first. That's the gap an AI assistant is built to close. They're different tools for different jobs, and knowing which job you're short on saves money and leads.</p>

<h2>What a mortgage CRM does well</h2>
<p>A CRM is your system of record. A good loan officer CRM:</p>
<ul>
<li>Stores every contact, borrower and referral partner in one place.</li>
<li>Tracks where each borrower sits in your pipeline, from pre-approval to closing.</li>
<li>Sends scheduled email and text campaigns, like rate-watch updates or home anniversary notes (see <a href="/blog/crm-drip-workflows-for-mlo-follow-up">five drip workflows worth automating</a>).</li>
<li>Reminds you who to call and when.</li>
<li>Connects to your loan origination system (LOS) and pricing tools, depending on the product.</li>
</ul>
<p>If you have a database of past clients and partners, a CRM is how you keep it working for you.</p>

<h2>Where a CRM falls short</h2>
<p>A CRM only works when you work it. Someone has to enter the data, write the messages, and pick up the phone when a new inquiry comes in at 9 PM. The drip campaign doesn't answer a borrower's question about down payment assistance in the moment, and it can't tell a ready buyer from someone who's just browsing.</p>
<p>That's why many loan officers have a CRM full of contacts and still feel like leads slip away.</p>

<h2>What an AI assistant does well</h2>
<p>An AI assistant is your front door. A good one for loan officers:</p>
<ul>
<li>Answers borrower questions in conversation, day or night, within seconds.</li>
<li>Asks the qualifying questions you'd ask: purchase or refinance, timeline, price range, credit picture, area.</li>
<li>Records what the borrower says so you don't start from zero.</li>
<li>Hands ready borrowers to you, the licensed loan officer, to take it from there.</li>
<li>Drafts follow-up messages and marketing content so you're not staring at a blank screen.</li>
</ul>
<p>Speed is the point. When someone fills out a form on a Sunday night, the first useful answer they get often decides who they work with.</p>

<h2>Where an AI assistant falls short</h2>
<p>An AI assistant is not a loan officer. It shouldn't quote rates as offers, make credit decisions or give legal or tax advice, and every real decision belongs with you. It also isn't a full pipeline system for a large database. Be wary of any tool that promises to replace you or that has no clear hand-off to a licensed human.</p>

<h2>Side by side</h2>
<table>
<thead><tr><th scope="col"><span class="sr-only">Question</span></th><th scope="col">Mortgage CRM</th><th scope="col">AI assistant</th></tr></thead>
<tbody>
<tr><th scope="row">Main job</th><td>Organize contacts and pipeline</td><td>Answer and qualify new inquiries fast</td></tr>
<tr><th scope="row">Works after hours</th><td>Only scheduled messages</td><td>Yes, in live conversation</td></tr>
<tr><th scope="row">Needs your time</th><td>Data entry, writing, follow-up calls</td><td>Review hand-offs and take over</td></tr>
<tr><th scope="row">Best for</th><td>Past clients, partners, long nurture</td><td>New leads, website and local traffic</td></tr>
<tr><th scope="row">Main risk</th><td>Leads go cold before you call</td><td>Weak guardrails or no human hand-off</td></tr>
</tbody>
</table>

<h2>Do you need both?</h2>
<p>Many loan officers do, and they work well together: the AI assistant catches and qualifies new borrowers in the moment, and the CRM keeps the long relationship going after that.</p>
<p>If you're newer and your database is small, start where the leads are lost. For most loan officers, that's response time on new inquiries, not organizing a list that's still short.</p>

<h2>Questions to ask before you buy either</h2>
<ul>
<li><strong>Who owns the data if you change companies?</strong> Your contacts and your website traffic should follow your career.</li>
<li><strong>Does it track texting consent?</strong> Texting borrowers without consent creates TCPA risk.</li>
<li><strong>What are the AI's guardrails?</strong> It should never present rates as offers or make credit decisions, and it should hand every borrower to you.</li>
<li><strong>Is pricing per seat, per lead or flat?</strong> Per-lead pricing adds up fast and can create RESPA questions in some models.</li>
<li><strong>Does it connect to what you already use?</strong> Ask about your LOS, calendar and email before you sign.</li>
<li><strong>Can you try it free?</strong> You'll know within a week whether it saves you time.</li>
</ul>

<h2>Where Cerebro fits</h2>
<p><a href="/cerebro">Cerebro</a> is the AI assistant inside YPN USA. On your site it answers and qualifies borrowers day or night and hands the ready ones to you; inside your dashboard it builds your growth plan, works your pipeline and drafts your marketing. If you already use a CRM you like, keep it. Cerebro is designed to be the front door that keeps new leads from going cold. You can start free, no credit card needed.</p>`,
  faq: [
    {
      q: "What is the best CRM for loan officers?",
      // The comparison post isn't published yet, so it's named in plain text, not linked.
      a: "It depends on your volume, your company's LOS and whether you need team features. We compare the main options in our guide to the best CRM for loan officers (coming soon).",
    },
    {
      q: "Can an AI assistant replace a mortgage CRM?",
      a: "Not entirely. An AI assistant handles fast answers and qualifying; a CRM handles your long-term database and pipeline. Many loan officers use both.",
    },
    {
      q: "Is it compliant to use AI with borrowers?",
      a: "It can be, with the right guardrails: no rate offers, no credit decisions, clear disclosures, consent for texting, and a licensed loan officer handling every application.",
    },
    {
      q: "How fast should a loan officer respond to a new lead?",
      a: "As fast as possible. Minutes matter, which is why after-hours coverage is where an AI assistant earns its keep.",
    },
  ],
  closingHtml: `<p><strong>See how Cerebro would answer your borrowers:</strong> <a href="/cerebro">talk to Cerebro</a>, or <a href="/pricing">compare plans</a>.</p>`,
};

export const PLAN_POSTS: readonly BlogPost[] = [MORTGAGE_MARKETING_IDEAS, MORTGAGE_CRM_VS_AI_ASSISTANT];
