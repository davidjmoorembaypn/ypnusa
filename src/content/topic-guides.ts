/**
 * Long-form intros for the topic pillars (Nov 2026 SEO plan, section 13: "Add a 600 to
 * 900 word intro above the guide list that answers the cluster's main question, link
 * each supporting post in context, and keep the FAQ").
 *
 * Plain, accurate copy: no invented statistics, prices or results. Every /blog link must
 * point at an indexable post (checked in topic-guides.test.ts).
 */
export interface TopicGuideSection {
  heading: string;
  html: string;
}

export const TOPIC_GUIDES: Readonly<Record<string, readonly TopicGuideSection[]>> = {
  "exclusive-mortgage-leads": [
    {
      heading: "Exclusive vs shared leads",
      html: `<p>A mortgage lead is a person who asked about a loan and agreed to be contacted. The difference between lead types is who else gets that same person. A <strong>shared lead</strong> is sold to several loan officers at once, so the borrower often hears from three or four lenders within minutes. An <strong>exclusive lead</strong> goes to one loan officer only.</p>
<p>Shared leads usually cost less per lead, but you pay in other ways: you race to call first, the borrower is tired of calls by the time you reach them, and conversations tend to start with rate shopping instead of advice. Exclusive leads cost more per lead, but you get time to have a real conversation. Neither is automatically better. What matters is your cost per closed loan, not your cost per lead. We walk through that math in <a href="/blog/exclusive-vs-shared-mortgage-leads-real-cost-math">exclusive vs shared mortgage leads: real cost math</a>.</p>`,
    },
    {
      heading: "What mortgage leads cost",
      html: `<p>Lead prices vary by source, loan type, state and how fresh the lead is, and they change often, so treat any price list as a starting point. Our guide to <a href="/blog/what-do-mortgage-leads-cost-pricing-benchmarks-by-source">what mortgage leads cost by source</a> covers the common pricing models: per lead, per live transfer, monthly subscriptions and pay-per-click advertising you run yourself.</p>
<p>To compare sources fairly, use one formula for all of them: <strong>total spend ÷ loans closed = cost per funded loan</strong>. Include your time, any software you need to work the leads, and the leads that never answer. A cheap source with a low closing rate can cost more per loan than an expensive one. <a href="/blog/calculating-true-mlo-lead-acquisition-roi-across-multiple-marketing-channels">Calculating lead ROI across channels</a> shows how to track it, and our <a href="/roi">ROI calculator</a> shows how many extra loans would cover a YPN USA plan.</p>`,
    },
    {
      heading: "How to judge a mortgage leads company",
      html: `<p>Before you sign with any lead company, ask how leads are generated, whether each one is sold once or several times, how consent to contact is collected and stored, what happens to bad or duplicate leads, and whether there is a long contract. Be careful with any pricing tied to closed loans: paying a fee that depends on a loan closing can raise RESPA questions, so check with your compliance team. Our checklist on <a href="/blog/how-to-evaluate-the-best-mortgage-lead-generation-companies">how to evaluate mortgage lead generation companies</a> goes question by question, and <a href="/blog/mortgage-lead-channels-ranked-for-2026">mortgage lead channels ranked for 2026</a> compares buying leads with building your own.</p>`,
    },
    {
      heading: "Trigger, aged and live transfer leads",
      html: `<p>Three lead types come up often. <strong>Trigger leads</strong> come from credit bureaus when someone applies for a mortgage elsewhere; they are fast but competitive and come with their own rules, explained in <a href="/blog/mortgage-trigger-leads-how-they-work">how mortgage trigger leads work</a>. <strong>Aged leads</strong> are older inquiries sold at a discount; they reward a patient, compliant follow-up plan, covered in <a href="/blog/aged-mortgage-leads-roi-math-cadence-compliance">aged mortgage leads: ROI math, cadence and compliance</a>. <strong>Live transfer leads</strong> connect a borrower to you by phone in real time, at a higher price; see <a href="/blog/live-transfer-mortgage-leads-worth-the-premium">whether live transfers are worth the premium</a>.</p>
<p>Refinance leads follow the same rules with their own signals and timing. Our guide to <a href="/blog/mortgage-refinance-leads-types-signals-and-qualifying">mortgage refinance leads</a> covers the types and how to qualify them.</p>`,
    },
    {
      heading: "Owning a ZIP code",
      html: `<p>Buying leads means renting demand: when you stop paying, the flow stops. The other path is to build demand you keep, with local pages, a Google Business Profile, referral partners and fast follow-up. That's the idea behind YPN USA's exclusive ZIP codes. Each paid plan (Pro $99, Growth $199 or Exclusive $299 a month) includes one ZIP code. While you hold it, no other YPN USA loan officer can claim it, and borrower inquiries that come through YPN USA pages for that ZIP code route to you. It's exclusive within YPN USA; other lenders can still market in your area. The ZIP code locks when your first payment goes through; a 15-day free trial lets you try the tools first.</p>
<p>Cerebro, the AI assistant included with YPN USA, answers and qualifies borrowers who reach your pages, day or night, and hands the ready ones to you. To compare the two approaches side by side, read <a href="/blog/exclusive-zip-territory-vs-shared-mortgage-leads">exclusive ZIP code territory vs shared mortgage leads</a> or <a href="/blog/direct-to-borrower-pipeline-stop-buying-shared-leads">building a direct-to-borrower pipeline</a>. When you're ready, <a href="/claim-territory">check whether your ZIP code is open</a>; checking is free.</p>`,
    },
  ],
  "ai-lead-automation": [
    {
      heading: "Mortgage CRM or AI assistant?",
      html: `<p>A <strong>mortgage CRM</strong> is a system of record: it stores your borrowers, past clients and referral partners, tracks each loan from pre-approval to closing, and sends scheduled emails and texts. An <strong>AI assistant</strong> is a front door: it answers a new borrower in conversation, asks the questions you would ask, records the answers and hands the borrower to you. Most growing loan officers end up using both. We compare them in detail in <a href="/blog/mortgage-crm-vs-ai-assistant">mortgage CRM vs AI assistant</a>.</p>
<p>Whatever CRM you choose, ask who owns the data if you change companies, whether it tracks texting consent, how it connects to your loan origination system (LOS), and whether pricing is per seat or per lead. Per-lead pricing adds up fast.</p>`,
    },
    {
      heading: "Speed to lead",
      html: `<p>The first useful answer a borrower gets often decides who they work with, which is why response time matters so much. Fast does not have to mean you answer every call at 10 PM. It means someone, or something, answers right away and a licensed loan officer follows up while the borrower still remembers asking. <a href="/blog/speed-to-lead-for-mortgage-loan-officers">Speed to lead for loan officers</a> explains how to measure and improve it, and <a href="/blog/integrating-ai-chatbots-on-mortgage-websites-for-instant-engagement">adding an AI chat assistant to your site</a> covers the setup.</p>`,
    },
    {
      heading: "AI borrower intake",
      html: `<p>AI intake replaces a long web form with a short conversation: purchase or refinance, timeline, price range, area and how the borrower would like to be contacted. Done well, the borrower gets answers right away and you start the first call already knowing the basics. Read <a href="/blog/ai-borrower-intake-for-loan-officers">AI borrower intake for loan officers</a> and <a href="/blog/ai-lead-qualification-for-high-volume-mlos">AI lead qualification</a> for what to ask and what to leave to you.</p>
<p>An assistant should never quote rates as offers, make credit decisions or give legal or tax advice. Every borrower should be handed to a licensed loan officer. Cerebro, YPN USA's assistant, is built on those rules; <a href="/cerebro">see what Cerebro does today</a>.</p>`,
    },
    {
      heading: "Follow-up automation",
      html: `<p>Most deals are won in follow-up, not on the first call. Automation keeps follow-up consistent: a confirmation right after an inquiry, reminders for documents, check-ins for borrowers who aren't ready yet, and rate-watch or anniversary notes for past clients. Start with <a href="/blog/crm-drip-workflows-for-mlo-follow-up">five CRM drip workflows</a> and <a href="/blog/email-follow-up-sequences-for-loan-officers-with-templates">email follow-up sequences with templates</a>. For the plumbing between tools, <a href="/blog/mortgage-crm-webhooks-instant-lead-routing">CRM webhooks and instant lead routing</a> shows how new inquiries reach the right person in seconds, and <a href="/blog/database-reactivation-turn-cold-mortgage-leads-into-active-deals">database reactivation</a> covers waking up older contacts.</p>`,
    },
    {
      heading: "What to automate first",
      html: `<p>Automate the steps that are the same every time and leave judgment to people. A good order for most loan officers: first, an instant reply to every new inquiry, day or night; second, a short qualifying conversation so you know who is ready; third, reminders and status updates during the loan; fourth, long-term nurture for borrowers who aren't ready yet and for past clients. Keep a human review on anything that sounds like advice, a rate or a credit decision. Start small, check the hand-offs every week for a month, and only then add more. <a href="/blog/mlo-marketing-automation">Marketing automation for loan officers</a> and <a href="/blog/automated-follow-up-workflows-for-unqualified-mortgage-leads">follow-up for borrowers who aren't ready</a> show what that looks like in practice.</p>`,
    },
    {
      heading: "TCPA and RESPA compliance",
      html: `<p>Automation only scales safely when consent and disclosures are built in. Marketing texts and automated calls generally require the borrower's prior express written consent under the TCPA, and you must honor opt-outs quickly. RESPA Section 8 bars paying or accepting anything of value for referrals of settlement-service business, which matters for lead-sharing and co-marketing arrangements. Our guides to <a href="/blog/tcpa-compliance-automated-lead-consent-for-mortgage-loan-officers">TCPA compliance and automated consent</a> and <a href="/blog/managing-regulatory-friction-staying-audit-ready-in-2026">staying audit-ready</a> cover the basics. They are educational, not legal advice; confirm your process with your compliance team or counsel.</p>
<p>When you want the assistant without building it yourself, YPN USA includes Cerebro on every plan, with paid plans from $99 a month. <a href="/pricing">Compare plans</a> or <a href="/claim-territory">check your ZIP code</a> first.</p>`,
    },
  ],
  "loan-officer-marketing": [
    {
      heading: "What a loan officer marketing strategy needs",
      html: `<p>Marketing that works for a loan officer is consistent, local and measurable. Consistent, because borrowers and referral partners remember the loan officer they keep seeing. Local, because people buy homes in a place, and the loan officer who knows that place earns trust faster. Measurable, because you should know which activities bring conversations and which only bring likes. A simple plan covers five areas: being found locally, useful content, referral partners, your past-client database, and fast follow-up on every inquiry. <a href="/blog/loan-officer-marketing-in-2026-the-complete-strategy-guide">The complete loan officer marketing strategy guide</a> walks through each one.</p>
<p>If you're starting from zero, pick one activity in each area and do it every week for three months before judging it. For a list of options that cost nothing but time, see <a href="/blog/mortgage-marketing-ideas-for-loan-officers">27 mortgage marketing ideas for loan officers</a>. New to the business with no database? Start with <a href="/blog/how-to-get-clients-as-a-new-loan-officer-no-database-no-budget">how to get clients as a new loan officer</a>.</p>`,
    },
    {
      heading: "Local content and video",
      html: `<p>The best content answers the questions borrowers already ask you: how much they need to buy in your town, how assistance programs work, what happens after pre-approval. Each answer can become a short video, a blog post and a social post. Phone video with captions is fine; clear and helpful beats polished. <a href="/blog/video-marketing-for-loan-officers-ideas-and-simple-scripts">Video marketing for loan officers</a> has simple scripts, and <a href="/blog/content-repurposing-strategies-turning-mlo-blog-posts-into-omnichannel-leads">content repurposing</a> shows how one answer becomes several pieces.</p>`,
    },
    {
      heading: "Social media",
      html: `<p>Social media works best as a place to be useful in public, not a place to post rates. Two to four helpful posts a week is plenty if you can keep it up. Our guides on <a href="/blog/social-media-marketing-for-loan-officers-what-actually-works-in-2026">social media marketing for loan officers</a>, <a href="/blog/how-often-should-a-loan-officer-post-on-social-media">how often to post</a> and <a href="/blog/30-social-media-post-ideas-for-loan-officers-copy-use">30 post ideas</a> give you a starting calendar, and the free <a href="/tools/social-writer">AI social post writer</a> drafts local posts you can edit. Instagram and Facebook each have their own playbook: see <a href="/blog/instagram-for-loan-officers-how-to-get-clients-not-just-likes">Instagram for loan officers</a> and <a href="/blog/facebook-marketing-for-loan-officers-the-2026-step-by-step-playbook">the Facebook playbook</a>.</p>`,
    },
    {
      heading: "Referral partners",
      html: `<p>Real estate agents, CPAs, financial planners and attorneys all have clients who need financing. The loan officers they refer to are the ones who make their clients' experience easy: quick pre-approvals, clear communication and no surprises at closing. Teach a short financing update at an agent office, offer a co-branded one-pager for a listing, or host a free homebuyer class together. Keep every arrangement RESPA-compliant: no payments or gifts for referrals, and split shared marketing costs by actual use. <a href="/blog/5-ways-loan-officers-can-pitch-value-to-top-producing-real-estate-agents">Five ways to pitch value to agents</a> and the <a href="/topics/realtor-referral-partnerships">referral partnerships guides</a> go deeper.</p>`,
    },
    {
      heading: "Email, text and your database",
      html: `<p>Your past clients and partners are the cheapest source of your next loan. A short monthly email, an annual mortgage review call and a note on each home anniversary keep you top of mind. Text messages need written consent before you send marketing, and every marketing email needs an unsubscribe link and your physical address. <a href="/blog/text-message-marketing-for-loan-officers">Text message marketing for loan officers</a> includes compliant scripts. Put your NMLS ID on every ad, post and page that promotes your services, and include the required disclosures whenever you mention rates or payment terms.</p>`,
    },
    {
      heading: "Measuring what works",
      html: `<p>Track one number per channel: conversations started, not impressions. Then compare what each channel costs in money and time against the loans it produces. Our <a href="/roi">ROI calculator</a> shows how many extra closed loans a year would cover a YPN USA plan, using your own loan size and compensation. When marketing starts producing inquiries, make sure none go unanswered: <a href="/cerebro">Cerebro</a> answers and qualifies borrowers on your site day or night and hands the ready ones to you. You can <a href="/claim-territory">check whether your ZIP code is open</a> for free.</p>`,
    },
  ],
  "local-seo-for-loan-officers": [
    {
      heading: "Why local SEO matters for loan officers",
      html: `<p>When someone searches for a mortgage lender or loan officer near them, Google shows a map with a few local profiles and a list of pages. Showing up there brings borrowers who are already looking, and it keeps working without paying for each click. Local SEO for loan officers comes down to four things: a complete Google Business Profile, a useful page for each area you serve, a fast and well-structured website, and content that answers real local questions. None of it is quick, but all of it builds on itself.</p>
<p>It also outlasts any one job. Your company profile page belongs to your employer, but a profile, pages and reviews built under your own name stay with your career. Start with the profile, add one local page a month, and check your progress in Google Search Console every few weeks.</p>`,
    },
    {
      heading: "Google Business Profile",
      html: `<p>Your Google Business Profile is the most valuable free listing you have. Fill in every field: categories, service areas, hours, photos, your NMLS ID in the description and a booking link. Post a short update every week and ask every closed borrower for a review the day after closing. <a href="/blog/how-to-optimize-your-google-business-profile-as-a-loan-officer-2026-checklist">The Google Business Profile checklist for loan officers</a> covers each field, and <a href="/blog/20-google-business-profile-post-ideas-for-loan-officers">20 post ideas</a> keeps the updates coming. The free <a href="/tools/gbp-optimizer">Google Business Profile optimizer</a> drafts a description, post ideas and next steps from what you tell it; it does not log in to or change your profile.</p>`,
    },
    {
      heading: "Local pages that rank",
      html: `<p>A page for each city or ZIP code you serve gives Google and borrowers a clear answer to "loan officer in [place]." Each page needs local details a template can't fake: neighborhoods, typical buyers, local programs and how you help. Thin pages with only the city name swapped tend to do poorly. See <a href="/blog/how-localized-mortgage-landing-pages-outrank-national-lead-portals">how localized mortgage pages compete with national portals</a> and <a href="/blog/hyper-local-seo-silos-for-regional-mortgage-markets">hyper-local SEO silos</a> for structure. Our own <a href="/loan-officers/visalia-ca">Visalia loan officer page</a> is an example, and the <a href="/loan-officers">loan officer markets hub</a> lists every city page.</p>`,
    },
    {
      heading: "Schema and site speed",
      html: `<p>Structured data (schema) tells search engines what a page is about: your business, your services, your FAQ. It can make your results more informative, but only when it matches what's visible on the page. <a href="/blog/schema-markup-for-loan-officers-how-to-win-rich-snippets-on-google">Schema markup for loan officers</a> covers the types that matter. Speed matters too, especially on phones: compress images, avoid heavy scripts above the fold and keep pages simple. <a href="/blog/maximizing-site-speed-core-web-vitals-for-high-converting-mlo-websites">Site speed and Core Web Vitals</a> explains what to measure, and <a href="/blog/technical-seo-audits-for-mortgage-websites-dominating-local-search">technical SEO audits</a> gives you a checklist.</p>`,
    },
    {
      heading: "Content that answers local questions",
      html: `<p>Local pages rank better when the rest of your site supports them. Write short articles that answer the questions people in your area actually ask: how much they need to buy in a given town, which assistance programs apply, how long a purchase usually takes. Publish a monthly market snapshot with inventory and days on market, and include the required disclosures if you mention rates or payment terms. Link each article to the matching local page so search engines see how your site fits together. <a href="/blog/how-to-create-local-homebuyer-market-snapshots-that-convert-cold-prospects">How to create local market snapshots</a> and <a href="/blog/hyper-local-mortgage-marketing-how-to-target-high-intent-buyers-in-specific-neighborhoods">hyper-local mortgage marketing</a> show the format.</p>`,
    },
    {
      heading: "Showing up in AI search answers",
      html: `<p>More people now ask AI assistants and AI search results where to find a loan officer or how a program works. Those answers draw on pages that state facts plainly, answer one question at a time, and show who wrote them and why they're qualified. Clear headings, a visible FAQ, your NMLS ID and an author bio help. <a href="/blog/the-generative-engine-optimization-geo-playbook-for-2026">The generative engine optimization (GEO) playbook</a> and <a href="/blog/how-localized-mlo-content-dominates-ai-search-voice-queries">local content for AI and voice search</a> go further.</p>
<p>YPN USA builds on the same ideas: each paid plan includes an exclusive ZIP code within YPN USA, local pages, and Cerebro to answer the borrowers those pages bring in. <a href="/claim-territory">Check your ZIP code</a> for free.</p>`,
    },
  ],
};
