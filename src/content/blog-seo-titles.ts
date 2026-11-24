/**
 * Search-result titles for blog posts whose headline is too long for Google's results
 * page (about 60 characters show; the rest is cut off with "..."). The on-page <h1>
 * keeps the full headline; only the <title> tag changes. Each title keeps the post's
 * main search phrase near the front and promises only what the post covers.
 *
 * Applied in blog-all.ts to posts that have no metaTitle of their own.
 */
export const BLOG_SEO_TITLES: Readonly<Record<string, string>> = {
  "what-ai-lead-follow-up-should-do-before-handoff": "AI Lead Follow-Up Before a Loan Officer Handoff",
  "what-to-check-before-buying-mortgage-leads-in-a-zip-code": "Before You Buy Mortgage Leads in a ZIP Code",
  "buyer-migration-housing-markets": "Homebuyer Migration Trends for Loan Officers",
  "building-referral-partnerships-with-estate-and-probate-attorneys": "Referral Partnerships with Probate Attorneys",
  "the-rise-of-default-and-foreclosure-services-how-mlos-can-help": "Default and Foreclosure: How Loan Officers Can Help",
  "how-mlos-can-build-automated-co-branded-landing-pages-for-local-realtors": "Co-Branded Realtor Landing Pages for Loan Officers",
  "5-ways-loan-officers-can-pitch-value-to-top-producing-real-estate-agents": "5 Ways Loan Officers Can Pitch Top Real Estate Agents",
  "how-loan-originators-can-target-real-estate-investors-with-dscr-loan-marketing": "DSCR Loan Marketing to Real Estate Investors",
  "co-marketing-compliance-how-mlos-and-agents-can-legally-share-lead-costs": "Co-Marketing Compliance: Sharing Lead Costs Legally",
  "how-to-turn-open-house-visitors-into-pre-approved-buyers-with-custom-portals": "Turn Open House Visitors into Pre-Approved Buyers",
  "marketing-down-payment-assistance-dpa-programs-to-capture-first-time-homebuyers": "Marketing DPA Programs to First-Time Homebuyers",
  "bank-statement-loans-for-self-employed-buyers-an-mlo-lead-generation-guide": "Bank Statement Loan Leads: A Loan Officer's Guide",
  "how-mlos-can-win-more-non-qm-loans-in-a-high-interest-rate-environment": "Winning Non-QM Loans When Rates Are High",
  "hyper-local-mortgage-marketing-how-to-target-high-intent-buyers-in-specific-neighborhoods":
    "Hyper-Local Mortgage Marketing by Neighborhood",
  "leveraging-local-housing-market-data-to-win-exclusive-borrower-leads": "Using Local Housing Data to Win Borrower Leads",
  "how-to-create-local-homebuyer-market-snapshots-that-convert-cold-prospects": "Local Homebuyer Market Snapshots That Convert",
  "crm-drip-workflows-for-mlo-follow-up": "5 CRM Drip Workflows for Loan Officer Follow-Up",
  "speed-to-lead-for-mortgage-loan-officers": "Speed to Lead for Mortgage Loan Officers | YPN USA",
  "ai-lead-capture-tools-for-loan-officers": "AI Lead Capture Tools for Loan Officers | YPN USA",
  "direct-to-borrower-pipeline-stop-buying-shared-leads": "Direct-to-Borrower Pipeline: Stop Buying Shared Leads",
  "strategies-for-the-stay-put-economy-tapping-home-equity-in-2026": "Stay-Put Economy: Home Equity Strategies for 2026",
  "modernizing-mlo-workflows-beyond-transactional-lead-automation": "Modernizing Loan Officer Workflows Beyond Automation",
  "easier-mortgage-niches-to-win-divorce-probate-and-self-employed-borrowers":
    "Mortgage Niches: Divorce, Probate, Self-Employed",
  "exclusive-zip-territory-vs-shared-mortgage-leads": "Exclusive ZIP Code vs Shared Mortgage Leads (2026)",
  "ai-borrower-intake-for-loan-officers": "AI Borrower Intake for Loan Officers | YPN USA",
  "dscr-jumbo-fha-va-mlo-product-demand": "DSCR, Jumbo, FHA and VA Demand for Loan Officers",
  "mlo-benefits-of-ypnus-owned-demand": "7 Benefits YPN USA Gives Mortgage Loan Officers",
  "central-valley-financing-hub-fresno-visalia-dinuba": "Fresno, Visalia and Dinuba Mortgages for Loan Officers",
  "the-b2b-real-estate-ecosystem-driving-enterprise-growth-brokerage-scaling-and-institutional-lending":
    "B2B Real Estate: Brokerage Growth and Institutional Lending",
  "automated-programmatic-lead-generation-loan-officers": "Automated Lead Generation for Loan Officers | YPN USA",
  "how-loan-officers-get-realtor-referrals-7-co-marketing-plays-that-work-in-2026":
    "Realtor Referrals: 7 Co-Marketing Plays for 2026",
  "how-to-optimize-your-google-business-profile-as-a-loan-officer-2026-checklist":
    "Google Business Profile for Loan Officers: 2026 Checklist",
  "how-to-approach-a-realtor-as-a-loan-officer-without-getting-brushed-off": "How to Approach a Realtor as a Loan Officer",
  "instagram-for-loan-officers-how-to-get-clients-not-just-likes": "Instagram for Loan Officers: Get Clients, Not Likes",
  "first-time-homebuyer-guide-for-phoenix-mlos-how-to-win-more-fha-clients": "Phoenix Loan Officers: Win More FHA Homebuyers",
  "heloc-renovation-strategy-how-smart-mlos-win-the-home-equity-market": "HELOC Renovation Strategy for Loan Officers",
  "the-probate-mortgage-leads-playbook-how-mlos-win-inherited-property-deals": "Probate Mortgage Leads Playbook for Loan Officers",
  "the-realtor-co-marketing-playbook-how-mlos-build-referral-pipelines-that-work":
    "Realtor Co-Marketing Playbook for Loan Officers",
  "facebook-lead-generation-for-mortgage-real-estate-professionals-the-2026-guide":
    "Facebook Lead Generation for Mortgage Pros (2026)",
  "social-media-marketing-for-loan-officers-what-actually-works-in-2026": "Social Media Marketing for Loan Officers in 2026",
  "facebook-marketing-for-loan-officers-the-2026-step-by-step-playbook": "Facebook Marketing for Loan Officers: 2026 Playbook",
  "streamlining-the-mortgage-loan-process-a-guide-for-loan-officers": "Streamlining the Mortgage Process for Loan Officers",
  "the-blueprint-for-automated-co-marketing-funnels-between-mlos-and-realtors": "Automated Co-Marketing Funnels for MLOs and Realtors",
  "how-high-volume-mlos-scale-zero-click-seo-with-programmatic-landing-pages": "Zero-Click SEO with Programmatic Landing Pages",
  "building-real-time-mlo-pipeline-alerts-for-instant-loan-status-tracking": "Real-Time Pipeline Alerts for Loan Status Tracking",
  "how-high-volume-mlos-monetize-unqualified-leads-via-referral-automation": "Turning Unqualified Mortgage Leads into Referrals",
  "automating-multi-channel-mortgage-pre-screening-sms-email-web-forms": "Automated Mortgage Pre-Screening: SMS, Email, Web",
  "dominating-regional-non-qm-market-share-with-localized-video-landing-pages": "Non-QM Market Share with Local Video Landing Pages",
  "calculating-true-mlo-lead-acquisition-roi-across-multiple-marketing-channels": "Mortgage Lead ROI Across Marketing Channels",
  "scaling-exclusive-territory-authority-for-regional-mortgage-origination": "Building Exclusive Territory Authority as an MLO",
  "how-high-volume-mlos-eliminate-rate-shopper-churn-with-automated-texting": "Stop Rate-Shopper Churn with Automated Texting",
  "maximizing-site-speed-core-web-vitals-for-high-converting-mlo-websites": "Core Web Vitals for Loan Officer Websites",
  "content-repurposing-strategies-turning-mlo-blog-posts-into-omnichannel-leads": "Turn Loan Officer Blog Posts into Multichannel Leads",
};
