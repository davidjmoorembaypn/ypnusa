/**
 * Borrower guides for the life changes that most often lead to a mortgage question:
 * /mortgage-loans/life-events and /mortgage-loans/life-events/[slug].
 *
 * Every rule stated here was checked against the primary text listed in the guide's `sources`
 * on LIFE_EVENT_REVIEWED_ON (Fannie Mae Selling Guide published Nov 4, 2026; HUD Handbook 4000.1
 * Update 18; the U.S. Code and CFR; IRS Publications 523 and 551). Rules change: re-check the
 * sources and move the date before editing a figure. Left out on purpose because they could not be
 * confirmed from primary text: Freddie Mac guide sections, USDA terms, VA handbook wording, and
 * 2027 FHA loan limits.
 *
 * These are general program rules, not rates, not eligibility decisions and not legal or tax
 * advice. A lender may be stricter than the agency rule; the copy says so. No rate, payment
 * amount or approval promise belongs here (see the test next to this file).
 */

export const LIFE_EVENT_HUB_PATH = "/mortgage-loans/life-events";
export const LIFE_EVENT_REVIEWED_ON = "2026-11-27";

export interface LifeEventGuide {
  slug: string;
  /** Page heading. */
  title: string;
  /** Short name for breadcrumbs. */
  shortTitle: string;
  /** Browser and search title. */
  metaTitle: string;
  description: string;
  intro: string;
  keyPoints: string[];
  sections: { heading: string; paragraphs: string[]; bullets?: string[] }[];
  documents: string[];
  faqs: { q: string; a: string }[];
  sources: { label: string; url: string }[];
  relatedPrograms: { label: string; href: string }[];
}

export const lifeEventGuidePath = (guide: Pick<LifeEventGuide, "slug">) => `${LIFE_EVENT_HUB_PATH}/${guide.slug}`;

/** Lead-source tag for the borrower intake, e.g. "life-event-inherited-home". It records which guide the borrower came from, by their own choice of page. */
export const lifeEventFunnelSource = (guide?: Pick<LifeEventGuide, "slug">) => (guide ? `life-event-${guide.slug}` : "life-events");

/** The borrower intake flow (not /consultation, which is the sales page for loan officers). */
export const lifeEventIntakeHref = (guide?: Pick<LifeEventGuide, "slug">) => `/embed/intake?funnelSource=${encodeURIComponent(lifeEventFunnelSource(guide))}`;

const HUD_HANDBOOK = {
  label: "HUD Handbook 4000.1, FHA Single Family Housing Policy Handbook (Update 18)",
  url: "https://www.hud.gov/sites/default/files/Housing/documents/40001-hsgh-Update-18.pdf",
};
const LENDER_NOTE = "These are the agencies' rules. An individual lender can set stricter ones.";

export const LIFE_EVENT_GUIDES: LifeEventGuide[] = [
  {
    slug: "after-divorce",
    title: "Mortgages During and After a Divorce",
    shortTitle: "Divorce",
    metaTitle: "Mortgage After Divorce: Buyouts, Support Income and the Old Loan",
    description:
      "How lenders treat alimony and child support, how one spouse can buy out the other, and why a divorce decree does not take your name off the mortgage.",
    intro:
      "A divorce raises three mortgage questions at once: who keeps the house, how the other person gets paid for their share, and whether each of you can qualify for a loan alone. The rules below come from the Fannie Mae Selling Guide, the FHA handbook and federal law. " + LENDER_NOTE,
    keyPoints: [
      "A divorce decree can give you the house, but it does not remove either spouse from the existing loan. Only the lender can do that, through a written release of liability or a refinance.",
      "Alimony and child support you receive can count as income once you can show a history of receiving them and that they will continue for at least three years.",
      "Under Fannie Mae rules, a refinance used to buy out a co-owner can be treated as a limited cash-out refinance instead of a cash-out refinance.",
      "A debt the court assigned to your former spouse can usually be left out of your debt-to-income ratio, even though the creditor can still hold you to it.",
    ],
    sections: [
      {
        heading: "Keeping the house: three ways to deal with the old loan",
        paragraphs: [
          "Federal law stops a lender from calling the loan due just because a divorce decree or settlement transferred the home to one spouse who lives there. That protection keeps the existing loan in place. It does not release the spouse who moved out, who remains liable until the lender agrees otherwise.",
          "To get a name off the loan, the usual routes are:",
        ],
        bullets: [
          "Refinance in one name. The spouse keeping the home qualifies alone and the old loan is paid off.",
          "Assume the loan. FHA allows an assumption without a credit review when the spouse staying on title keeps living in the home and can show six months of making the payments. An assumption on its own does not release the spouse who is leaving: ask the servicer for a written release of liability as part of it. VA rules let a servicer release a spouse from a VA-backed loan after a divorce without a full assumption when the property is awarded to the veteran whose entitlement backs the loan.",
          "Ask the servicer for a release of liability. On loans Fannie Mae owns, the servicer must find the remaining owner's credit and finances acceptable before it releases the other borrower.",
        ],
      },
      {
        heading: "Buying out your spouse's share",
        paragraphs: [
          "Fannie Mae lists buying out a co-owner under an agreement as an acceptable use of a limited cash-out refinance. The home must have been jointly owned for at least 12 months before the new loan funds, all parties must sign a written agreement stating the terms of the transfer and where the money goes, and the borrower who ends up as sole owner may not receive any of the refinance proceeds.",
          "If the buyout does not fit those terms, a cash-out refinance is the alternative. Fannie Mae normally requires six months on title before a cash-out refinance, but there is no waiting period when the borrower was legally awarded the property in a divorce, separation or dissolution of a domestic partnership.",
        ],
      },
      {
        heading: "Qualifying on one income",
        paragraphs: [
          "Support you receive: for a conventional loan, Fannie Mae asks for the most recent six months of full, regular payments and evidence they will continue for three years from the application date. The payments must rest on a decree, separation agreement or court order; proposed or voluntary payments do not count. FHA asks for three months of receipt when payments are court-ordered, 12 months when they are voluntary, and the same three years of continuance. Federal credit law requires a lender to count support as income to the extent it is likely to be paid consistently.",
          "Support you pay: child support is counted as a monthly debt. Alimony can be treated either as a debt or as a reduction of your income, under both Fannie Mae and FHA rules. Which treatment a lender uses changes your debt-to-income ratio, so it is worth asking.",
          "Debts your former spouse now pays: when a court order assigns a debt to the other party, Fannie Mae does not require the lender to count it against you, and FHA does not require the usual 12-month payment history from the other party. The lender will want a copy of the order. You are still legally liable to the creditor, and late payments on a joint account can still reach your credit report.",
        ],
      },
      {
        heading: "Buying a different home",
        paragraphs: [
          "Timing matters. A lender underwrites the facts on paper at the time of application, so a signed settlement that fixes support amounts and assigns the debts gives you something a lender can use. Applying before the terms are final often means applying twice.",
          "If you sell the marital home later, tax law has a rule for the spouse who moved out: you are treated as using the home as your principal residence for any period your spouse or former spouse is granted use of it under a divorce or separation instrument. That can preserve your share of the home-sale exclusion. Ask a tax professional how it applies to you.",
        ],
      },
    ],
    documents: [
      "The recorded divorce decree and the full property settlement or separation agreement",
      "Proof of support received: six months of bank statements for a conventional loan",
      "The current mortgage statement and the names on the loan and on title",
      "A written buyout agreement signed by both of you, if one spouse is buying out the other",
      "Statements for every joint debt, showing who the court made responsible",
    ],
    faqs: [
      {
        q: "Does a divorce decree remove my name from the mortgage?",
        a: "No. The decree binds you and your former spouse, not the lender. You stay liable on the loan until the lender releases you in writing or the loan is paid off by a refinance or sale.",
      },
      {
        q: "Can I use alimony or child support to qualify for a mortgage?",
        a: "Yes, if it is documented. Fannie Mae asks for six months of receipt and three years of expected continuance. FHA asks for three months of receipt when payments are court-ordered and 12 months when they are voluntary, plus three years of continuance.",
      },
      {
        q: "Do I have to wait six months after the divorce to refinance?",
        a: "Not under Fannie Mae's title rule: the six-month wait for a cash-out refinance does not apply when the property was legally awarded to you in a divorce. A lender can still have its own requirements.",
      },
      {
        q: "Will a debt my ex-spouse is supposed to pay count against me?",
        a: "Usually not in the debt-to-income ratio, if a court order assigned it to them and you provide the order. You remain liable to the creditor until the account is paid off or refinanced.",
      },
    ],
    sources: [
      { label: "Fannie Mae Selling Guide B3-3.4-02, Alimony, Child Support, Equalization Payments or Separate Maintenance", url: "https://selling-guide.fanniemae.com/sel/b3-3.4-02/alimony-child-support-equalization-payments-or-separate-maintenance" },
      { label: "Fannie Mae Selling Guide B3-6-05, Monthly Debt Obligations", url: "https://selling-guide.fanniemae.com/sel/b3-6-05/monthly-debt-obligations" },
      { label: "Fannie Mae Selling Guide B2-1.3-02, Limited Cash-Out Refinance Transactions", url: "https://selling-guide.fanniemae.com/sel/b2-1.3-02/limited-cash-out-refinance-transactions" },
      { label: "Fannie Mae Selling Guide B2-1.3-03, Cash-Out Refinance Transactions", url: "https://selling-guide.fanniemae.com/sel/b2-1.3-03/cash-out-refinance-transactions" },
      { label: "Fannie Mae Servicing Guide D1-4.1-02, Allowable Exemptions Due to the Type of Transfer", url: "https://servicing-guide.fanniemae.com/svc/d1-4.1-02/allowable-exemptions-due-type-transfer" },
      HUD_HANDBOOK,
      { label: "12 U.S.C. 1701j-3, due-on-sale clauses (Garn-St Germain Act)", url: "https://www.law.cornell.edu/uscode/text/12/1701j-3" },
      { label: "12 CFR 1002.6, Regulation B: rules concerning evaluation of applications", url: "https://www.consumerfinance.gov/rules-policy/regulations/1002/6/" },
      { label: "VA Circular 26-23-10, assumptions and release of liability", url: "https://www.benefits.va.gov/HOMELOANS/documents/circulars/26-23-10.pdf" },
      { label: "26 U.S.C. 121, exclusion of gain from sale of principal residence", url: "https://www.law.cornell.edu/uscode/text/26/121" },
    ],
    relatedPrograms: [
      { label: "Refinance loans", href: "/mortgage-loans/refi" },
      { label: "FHA loans", href: "/mortgage-loans/fha" },
    ],
  },
  {
    slug: "inherited-home",
    title: "Mortgages on an Inherited Home",
    shortTitle: "Inherited home",
    metaTitle: "Inherited a House With a Mortgage? Your Loan Options",
    description:
      "What happens to the mortgage when a homeowner dies, the rights an heir has with the loan servicer, and how to finance a buyout of the other heirs.",
    intro:
      "Inheriting a home often means inheriting a decision: keep it, sell it, or buy out the other heirs. If there is a mortgage, the first worry is usually whether the lender can demand the full balance. For a relative who will live in the home, federal law says it cannot. " + LENDER_NOTE,
    keyPoints: [
      "A lender may not call a loan due because the home passed to a relative on the borrower's death, when that relative occupies or will occupy the home.",
      "Once the servicer confirms you as a successor in interest, you have a borrower's servicing rights without having to assume the loan.",
      "Fannie Mae waives its six-month title wait for a cash-out refinance on an inherited home, and treats a buyout of other heirs as a limited cash-out refinance.",
      "A reverse mortgage works differently: the loan comes due, and heirs have short deadlines to pay it off, sell, or hand over the property.",
    ],
    sections: [
      {
        heading: "The existing mortgage does not have to be paid off at once",
        paragraphs: [
          "The Garn-St Germain Act bars a lender from using a due-on-sale clause when a home of fewer than five units passes by will, by inheritance law or by survivorship to a joint owner, or passes to a relative because the borrower died. The federal regulation adds a condition: the person receiving the home occupies or will occupy it.",
          "Two limits are worth knowing. The protection only stops the lender from demanding the balance; the payments still have to be made. And an heir who is not a relative, or a relative who will rent the home out, is not clearly covered.",
        ],
      },
      {
        heading: "Your rights with the loan servicer",
        paragraphs: [
          "Mortgage servicing rules treat an heir as a \"successor in interest\". If you write to the servicer, it must tell you in writing which documents it reasonably needs to confirm your identity and your ownership. Examples in the rule's commentary are a death certificate and a will or court order. A servicer generally cannot insist on probate papers where state law does not require probate.",
          "Once confirmed, you are treated as a borrower for servicing purposes: you can get information about the loan and be reviewed for help if the payments are a problem. The servicer may not make you assume the loan first. Confirmation does not make you personally liable for the debt, and it does not promise a loan modification.",
          "An FHA-insured loan can also be assumed without a credit review when the home passed by inheritance and the person assuming it can show six months of making the payments.",
        ],
      },
      {
        heading: "Buying out the other heirs",
        paragraphs: [
          "When several people inherit and one wants to keep the home, that person usually needs a new loan to pay the others. Under Fannie Mae rules this can be a limited cash-out refinance: all parties sign a written agreement on the transfer and the proceeds, and the usual requirement to show 12 months of joint ownership does not apply to a recent inheritance. A borrower who is not yet on title can still qualify when the property was acquired through inheritance.",
          "A cash-out refinance is the other route. Fannie Mae has no six-month title wait when the home was inherited. If the new loan pays off an existing first mortgage, that mortgage generally still has to be at least 12 months old.",
          "FHA normally requires that a borrower has owned and lived in the home for 12 months before a cash-out refinance. It waives the occupancy period for an inherited home, provided the home has not been treated as an investment property since the inheritance. If it was rented out, the heir must live in it for 12 months first. The home must be the heir's principal residence, and the loan is limited to 80 percent of the home's adjusted value.",
        ],
      },
      {
        heading: "If the loan is a reverse mortgage",
        paragraphs: [
          "A reverse mortgage (HECM) becomes due when the last borrower dies. The servicer must notify the estate or heirs, who then have 30 days from that notice to respond. The choices are to pay the balance in full, sell the home for at least the lesser of the loan balance or 95 percent of its current appraised value, or give the lender a deed in lieu of foreclosure. A surviving spouse who was not a borrower may qualify to stay under a deferral.",
          "The servicer is required to start foreclosure within six months of the due date unless HUD approves more time. The Consumer Financial Protection Bureau says the timeline can sometimes be extended up to six months. Contact the servicer as soon as you can, in writing, and keep copies.",
        ],
      },
      {
        heading: "A note on taxes",
        paragraphs: [
          "The tax basis of inherited property is generally its fair market value on the date of death, not what the owner originally paid. That often reduces the taxable gain when heirs sell soon after. An estate can elect a different valuation date, and community property has its own rule, so confirm the figures with a tax professional.",
        ],
      },
    ],
    documents: [
      "A certified death certificate",
      "The will and any court order or letters naming the executor or administrator, or the affidavit your state uses when there is no probate",
      "The most recent mortgage statement and the servicer's contact details",
      "A written agreement among the heirs if one is buying out the others",
      "Proof of your own income and assets, as for any new loan",
    ],
    faqs: [
      {
        q: "Can the lender demand the full balance when the owner dies?",
        a: "Not from a relative who inherits the home and lives in it, for a home of fewer than five units. Federal law bars the lender from using the due-on-sale clause in that case. The regular payments still have to be made.",
      },
      {
        q: "Do I have to assume the mortgage to deal with the servicer?",
        a: "No. Once the servicer confirms you as a successor in interest, it must treat you as a borrower for servicing purposes and may not require you to assume the loan first.",
      },
      {
        q: "How long do I have to wait before refinancing an inherited house?",
        a: "Fannie Mae has no six-month title wait for a cash-out refinance on an inherited home. FHA waives its 12-month occupancy rule for an inherited home that has not been rented out since the inheritance.",
      },
      {
        q: "How long do heirs have to pay off a reverse mortgage?",
        a: "The rule gives 30 days from the servicer's notice to respond, and requires foreclosure to start within six months of the due date unless HUD allows more time. Extensions are possible but not automatic.",
      },
    ],
    sources: [
      { label: "12 U.S.C. 1701j-3, due-on-sale clauses (Garn-St Germain Act)", url: "https://www.law.cornell.edu/uscode/text/12/1701j-3" },
      { label: "12 CFR 191.5, limitation on exercise of due-on-sale clauses", url: "https://www.law.cornell.edu/cfr/text/12/191.5" },
      { label: "12 CFR 1024.31, Regulation X definitions (successor in interest)", url: "https://www.consumerfinance.gov/rules-policy/regulations/1024/31/" },
      { label: "Fannie Mae Selling Guide B2-1.3-02, Limited Cash-Out Refinance Transactions", url: "https://selling-guide.fanniemae.com/sel/b2-1.3-02/limited-cash-out-refinance-transactions" },
      { label: "Fannie Mae Selling Guide B2-1.3-03, Cash-Out Refinance Transactions", url: "https://selling-guide.fanniemae.com/sel/b2-1.3-03/cash-out-refinance-transactions" },
      HUD_HANDBOOK,
      { label: "24 CFR 206.125, HECM: acquisition and sale of the property", url: "https://www.law.cornell.edu/cfr/text/24/206.125" },
      { label: "CFPB: Will my children be able to keep my home after I die if I have a reverse mortgage?", url: "https://www.consumerfinance.gov/ask-cfpb/will-my-children-be-able-to-keep-my-home-after-i-die-if-i-have-a-reverse-mortgage-loan-en-242/" },
      { label: "IRS Publication 551, Basis of Assets", url: "https://www.irs.gov/publications/p551" },
    ],
    relatedPrograms: [
      { label: "Refinance loans", href: "/mortgage-loans/refi" },
      { label: "FHA loans", href: "/mortgage-loans/fha" },
    ],
  },
  {
    slug: "getting-married",
    title: "Buying a Home When You Get Married",
    shortTitle: "Getting married",
    metaTitle: "Buying a House as a Couple: Credit Scores, Gifts and Down Payments",
    description:
      "How lenders combine two credit scores, when a spouse's debts count even if they are not on the loan, and the gift and down payment rules for a first home.",
    intro:
      "Applying together means two incomes, and also two credit histories and two sets of debts. Some of the advice couples hear about this is out of date. Here is how the main loan programs handle it. " + LENDER_NOTE,
    keyPoints: [
      "Each borrower gets one score (the middle of three, or the lower of two). How the two are combined depends on the program.",
      "Fannie Mae no longer sets a minimum credit score for loans run through its automated underwriting system; the system weighs the whole file.",
      "In a community property state, FHA counts a spouse's debts even when that spouse is not on the loan.",
      "Wedding gifts and family help can fund a down payment if the gift is documented and does not have to be repaid.",
    ],
    sections: [
      {
        heading: "Two borrowers, two credit scores",
        paragraphs: [
          "For each borrower, lenders take the middle score when three are reported and the lower when two are. What happens next differs by program.",
          "Fannie Mae: the lowest of the borrowers' scores is the loan's representative score and is used for pricing. For eligibility, loans run through Fannie Mae's automated system have no minimum score; the system assesses overall risk. For loans underwritten by hand, eligibility uses the average of the borrowers' scores, with a minimum of 620 for fixed-rate loans.",
          "FHA: the loan uses the lowest borrower's score. A score of 580 or higher qualifies for FHA's maximum financing, scores from 500 to 579 are limited to 90 percent of the home's value, and below 500 is not eligible. For FHA case numbers assigned on or after January 1, 2027, lenders may also submit newer score models; the minimum thresholds stay the same.",
          "In practice, one partner's low score costs more on some programs than on others, so the answer to \"should we both be on the loan?\" depends on which program fits you.",
        ],
      },
      {
        heading: "When only one of you is on the loan",
        paragraphs: [
          "Leaving one spouse off the loan leaves off their income as well as their score. In most states their debts are left out too. Community property states are the exception.",
          "For an FHA loan where the borrower lives in, or the property is in, a community property state, the non-borrowing spouse's debts must be included in the borrower's ratios unless state law excludes them. The lender pulls a credit report on that spouse to find the debts, but their credit history is not a reason to deny the loan.",
          "For a VA loan in a community property state, the lender may ask for and consider information about the spouse in the same way as for the applicant. In other states, fair-lending rules bar the lender from asking about a spouse who will not be on the loan.",
        ],
      },
      {
        heading: "Gifts toward the down payment",
        paragraphs: [
          "Fannie Mae accepts gifts from relatives by blood, marriage, adoption or guardianship, from a domestic partner, and from a fiance or fiancee. For a one-unit home you will live in, the whole down payment can be a gift. The donor signs a letter stating that the money does not have to be repaid.",
          "FHA accepts gifts from family members, an employer or labor union, a close friend with a documented interest in the borrower, a charity, or a government agency. The gift cannot come from the seller or anyone else who gains from the sale, and a donor's cash on hand is not an acceptable source.",
        ],
      },
      {
        heading: "First-time buyer rules and down payments",
        paragraphs: [
          "\"First-time buyer\" does not mean you have never owned. The common definition is no ownership interest in a home during the past three years. If one of you owned recently and the other did not, ask how the program you want applies the rule.",
        ],
        bullets: [
          "Fannie Mae's standard 97 percent loan requires at least one borrower to be a first-time buyer.",
          "Fannie Mae's HomeReady loan also goes to 97 percent for a purchase. It has an income limit of 80 percent of the area median, and it does not require first-time buyer status.",
          "FHA finances up to 96.5 percent of the home's value for borrowers with scores of 580 or higher, and is not limited to first-time buyers.",
          "VA purchase loans often need no down payment when the price is not above the appraised value and the veteran or service member has enough available entitlement for the loan.",
        ],
      },
    ],
    documents: [
      "Recent pay stubs, W-2s and tax returns for each person who will be on the loan",
      "Bank statements showing the down payment, with large deposits explained",
      "A signed gift letter and the donor's proof of funds for any gift",
      "A list of each person's debts, including a non-borrowing spouse's in a community property state",
      "Your marriage date and any name change, so records can be matched",
    ],
    faqs: [
      {
        q: "Do lenders use the lower credit score when a couple applies?",
        a: "For pricing a Fannie Mae loan and for FHA eligibility, the lower borrower's score is used. For Fannie Mae loans underwritten by hand, eligibility uses the average of the two. Fannie Mae's automated system sets no minimum score.",
      },
      {
        q: "Should my spouse stay off the loan if their credit is poor?",
        a: "It can help the score used, but their income is left out too. In a community property state, FHA still counts their debts. Run the numbers both ways with a loan officer.",
      },
      {
        q: "Can we use wedding gift money for a down payment?",
        a: "Yes, if it is documented. Lenders want a gift letter saying the money is not a loan, and evidence of the transfer. Deposit gifts early and keep the paper trail.",
      },
      {
        q: "Are we first-time buyers if one of us has owned a home before?",
        a: "It depends on the program and on when. The usual test is no ownership interest in the past three years. Fannie Mae's standard 97 percent loan needs only one borrower to meet it.",
      },
    ],
    sources: [
      { label: "Fannie Mae Selling Guide B3-5.1-01, General Requirements for Credit Scores", url: "https://selling-guide.fanniemae.com/sel/b3-5.1-01/general-requirements-credit-scores" },
      { label: "Fannie Mae Selling Guide B3-5.1-02, Determining the Credit Score for a Mortgage Loan", url: "https://selling-guide.fanniemae.com/sel/b3-5.1-02/determining-credit-score-mortgage-loan" },
      { label: "Fannie Mae Selling Guide B3-4.3-04, Personal Gifts", url: "https://selling-guide.fanniemae.com/sel/b3-4.3-04/personal-gifts" },
      { label: "Fannie Mae Selling Guide B5-6-01, HomeReady Mortgage Loan and Borrower Eligibility", url: "https://selling-guide.fanniemae.com/sel/b5-6-01/homeready-mortgage-loan-and-borrower-eligibility" },
      HUD_HANDBOOK,
      { label: "HUD Mortgagee Letter 2026-11, credit score models", url: "https://www.hud.gov/sites/default/files/hudclips/documents/2026-11hsgml.pdf" },
      { label: "38 CFR 36.4340, VA underwriting standards", url: "https://www.law.cornell.edu/cfr/text/38/36.4340" },
      { label: "VA: Purchase loan", url: "https://www.va.gov/housing-assistance/home-loans/loan-types/purchase-loan/" },
    ],
    relatedPrograms: [
      { label: "FHA loans", href: "/mortgage-loans/fha" },
      { label: "VA loans", href: "/mortgage-loans/va" },
      { label: "Conventional loans", href: "/mortgage-loans/conventional" },
    ],
  },
  {
    slug: "growing-family",
    title: "Moving Up to a Bigger Home for a Growing Family",
    shortTitle: "Growing family",
    metaTitle: "Buying a Bigger Home: Parental Leave, Two Mortgages and FHA Rules",
    description:
      "How parental leave income is counted, how to buy before your current home sells, and when FHA allows a second loan because your family has outgrown the house.",
    intro:
      "A new child often means a move, and it tends to arrive alongside parental leave and a home that has not sold yet. Lenders have specific rules for each of those. " + LENDER_NOTE,
    keyPoints: [
      "If you will be back at work by the first payment date, a lender can use your regular income even though you are on leave now.",
      "If you buy before selling, both housing payments count unless the current home is under contract with its financing contingencies cleared.",
      "FHA lets a borrower take a second FHA loan when the number of dependents has grown and the current home no longer fits, if the current loan is at or below 75 percent of the home's value.",
      "FHA does not count child care as a debt. The VA's loan analysis lists job-related child care among a borrower's obligations.",
    ],
    sections: [
      {
        heading: "Qualifying while on parental leave",
        paragraphs: [
          "Fannie Mae: if you return to work by the date of the first mortgage payment, the lender uses your regular income. If you return later, it uses the lower of your leave income or your regular income, and that can be topped up from your available liquid savings up to the regular amount. The file needs your written statement that you intend to return, your employer's confirmation of the return date, and a verbal check of your employment.",
          "FHA works the same way: pre-leave income can be used for a borrower who is back at work by the first payment due date. After that date the lender uses current income plus surplus savings, up to the pre-leave amount.",
          "A lender should not ask whether you plan to take leave in the future.",
        ],
      },
      {
        heading: "Buying before your current home sells",
        paragraphs: [
          "Under Fannie Mae rules the payment on your current home counts in your debt-to-income ratio along with the new one. The exception is when the lender has a signed sales contract for the current home and confirmation that the buyer's financing contingencies have been cleared. A bridge loan payment is counted on the same terms.",
          "If you plan to keep the current home and rent it out, the two main programs take opposite approaches.",
        ],
        bullets: [
          "Fannie Mae does not accept a lease for a home you are leaving. Market rent is shown by an appraisal or comparable rentals, 75 percent of it is used, and it can only offset that home's own payment. If you have managed property for less than 12 months, expect to show six months of that home's payments in reserve.",
          "FHA counts rent on the home you are leaving only if you are moving more than 100 miles away, have a lease of at least one year with proof of the deposit or first month's rent, and have at least 25 percent equity in it.",
        ],
      },
      {
        heading: "A second FHA loan because the family has grown",
        paragraphs: [
          "FHA normally insures one loan per borrower at a time. One of its listed exceptions is an increase in legal dependents that leaves the current home unable to meet the family's needs. To use it, the loan on the current home must be at or below 75 percent of its value, based on the outstanding balance and a current appraisal, or be paid down to that level.",
        ],
      },
      {
        heading: "Child care and your ratios",
        paragraphs: [
          "FHA's handbook lists child care among obligations that are not treated as debt. Fannie Mae's list of monthly debt obligations does not include it. The VA's loan analysis form includes a line for job-related expenses such as child care, and that line feeds the ratio the VA calculates. Whatever the program, the cost is real, so work it into your own budget before you settle on a price range.",
        ],
      },
    ],
    documents: [
      "Your employer's written confirmation of your return-to-work date, if you are on leave",
      "Pay stubs from before the leave and proof of any leave pay",
      "The current mortgage statement and an estimate of your home's value",
      "The signed sales contract for your current home, if it is under contract",
      "Statements for savings you would rely on between the two homes",
    ],
    faqs: [
      {
        q: "Can I get a mortgage while on maternity or paternity leave?",
        a: "Yes. If you will be back at work by the first payment date, Fannie Mae and FHA both allow the lender to use your regular income. If you return later, the lender uses your leave income, which savings can supplement.",
      },
      {
        q: "Do I have to sell my house before I buy the next one?",
        a: "No, but both payments count toward your ratios unless the current home is under contract with financing contingencies cleared. Many buyers qualify carrying both for a short time; others make the purchase depend on the sale.",
      },
      {
        q: "Can I have two FHA loans at once?",
        a: "Generally no, with listed exceptions. One is a larger family: more legal dependents, a current home that no longer fits, and a current loan at or below 75 percent of the home's value.",
      },
      {
        q: "Does day care count as a debt on a mortgage application?",
        a: "Not for FHA, and it is not on Fannie Mae's list of monthly debts. The VA's loan analysis does include job-related child care among obligations.",
      },
    ],
    sources: [
      { label: "Fannie Mae Selling Guide B3-3.3-09, Temporary Leave Income", url: "https://selling-guide.fanniemae.com/sel/b3-3.3-09/temporary-leave-income" },
      { label: "Fannie Mae Selling Guide B3-6-06, Qualifying Impact of Other Real Estate Owned", url: "https://selling-guide.fanniemae.com/sel/b3-6-06/qualifying-impact-other-real-estate-owned" },
      { label: "Fannie Mae Selling Guide B3-3.8-05, Rental Income: Departing Residence", url: "https://selling-guide.fanniemae.com/sel/b3-3.8-05/rental-income-non-subject-property-departing-residence" },
      { label: "Fannie Mae Selling Guide B3-6-05, Monthly Debt Obligations", url: "https://selling-guide.fanniemae.com/sel/b3-6-05/monthly-debt-obligations" },
      HUD_HANDBOOK,
      { label: "VA Form 26-6393, Loan Analysis", url: "https://www.vba.va.gov/pubs/forms/VBA-26-6393-ARE.pdf" },
    ],
    relatedPrograms: [
      { label: "FHA loans", href: "/mortgage-loans/fha" },
      { label: "Conventional loans", href: "/mortgage-loans/conventional" },
      { label: "Jumbo loans", href: "/mortgage-loans/jumbo" },
    ],
  },
  {
    slug: "relocating-for-work",
    title: "Buying a Home When You Relocate for a Job",
    shortTitle: "Job relocation",
    metaTitle: "Mortgage With a Job Offer Letter: Relocating for Work",
    description:
      "How to qualify for a mortgage on an offer letter before you start, the 60-day occupancy rule, and what happens to the home and the loan you leave behind.",
    intro:
      "A job move compresses everything: you may need to buy in a new city before your first paycheck, while still owning a home in the old one. Lenders can work with that, within limits. " + LENDER_NOTE,
    keyPoints: [
      "You can qualify on a signed job offer. Fannie Mae allows closing up to 90 days before your start date under set conditions.",
      "FHA counts income from a new job if the employer confirms in writing that it will begin within 60 days of closing.",
      "Both programs expect you to move into the new home within 60 days of signing.",
      "A move of more than 100 miles opens two FHA doors: a second FHA loan, and counting rent on the home you leave.",
    ],
    sections: [
      {
        heading: "Qualifying before you start the new job",
        paragraphs: [
          "Fannie Mae gives lenders two ways to use a job offer. The first is a signed offer with no open contingencies, followed by a pay stub from the new job before the lender delivers the loan. The second needs no pay stub: it is for the purchase of a one-unit home you will live in, uses fixed base pay only, and requires a start date no earlier than 30 days before and no later than 90 days after the loan's note date. That option also requires extra savings, either six months of the housing payment or enough to cover your bills from closing to your start date plus one month. It is not available when the employer is a family member or a party to the sale.",
          "FHA treats pay from a new job as expected income. The employer must verify in writing the amount and that it will begin within 60 days of closing. It is not allowed when the job is with a family-owned business.",
        ],
      },
      {
        heading: "Moving in on time",
        paragraphs: [
          "A home financed as a principal residence has to become one. Fannie Mae defines it as a home you occupy within 60 days of signing, and FHA requires at least one borrower to move in within 60 days and to intend to stay at least a year. If your family will follow later, or your start date is months out, tell the loan officer before you apply.",
        ],
      },
      {
        heading: "The home you are leaving",
        paragraphs: [
          "If the old home has not sold, its payment counts in your ratios unless there is a signed sales contract with the buyer's financing contingencies cleared. When an employer's relocation plan pays off your existing mortgage, the lender will ask for the signed buyout agreement.",
          "If you keep it as a rental, Fannie Mae uses 75 percent of market rent, supported by an appraisal or comparable rentals instead of a lease, and only to offset that home's own payment. FHA counts the rent only when the move is more than 100 miles, there is a lease of at least one year, and you have at least 25 percent equity.",
          "FHA normally allows one FHA loan at a time. An employment-related move to a new home more than 100 miles from the current one is a listed exception, so you may be able to buy with FHA without selling first.",
        ],
      },
      {
        heading: "Using a VA loan again",
        paragraphs: [
          "VA entitlement can be reused. If the earlier VA loan was paid in full but you still own that home, entitlement can be restored one time. If the earlier loan is still open, you may have remaining entitlement, and a down payment may be needed so that entitlement plus down payment covers at least a quarter of the loan. You must be able to afford both loans, and the new home must become your residence.",
        ],
      },
      {
        heading: "Selling sooner than you planned",
        paragraphs: [
          "The home-sale tax exclusion normally needs two years of ownership and use. If you sell earlier because of a job transfer to a workplace at least 50 miles farther from the home, a partial exclusion can apply. A tax professional can work out the amount.",
        ],
      },
    ],
    documents: [
      "The signed offer letter or employment contract, with start date and base pay",
      "Your employer's written relocation package, including any home buyout agreement",
      "The current mortgage statement and any sales contract or lease for the home you are leaving",
      "Bank statements showing reserves, especially if you close before your first paycheck",
      "For a VA loan, your Certificate of Eligibility",
    ],
    faqs: [
      {
        q: "Can I get a mortgage with just an offer letter?",
        a: "Often, yes. Fannie Mae allows it with a signed, non-contingent offer, and in some cases lets you close up to 90 days before you start if you have enough reserves. FHA needs the employer's written confirmation that pay begins within 60 days of closing.",
      },
      {
        q: "How soon do I have to move into the new house?",
        a: "Within 60 days of signing, under both Fannie Mae and FHA rules for a principal residence.",
      },
      {
        q: "Can I keep my old house and rent it out?",
        a: "Yes, and the rent may help you qualify. Fannie Mae uses market rent without a lease; FHA requires a move of more than 100 miles, a one-year lease and 25 percent equity.",
      },
      {
        q: "Can I use a VA loan a second time?",
        a: "Yes. Entitlement can be restored once when the first loan is paid off but the home is kept, and remaining entitlement can be used while an earlier VA loan is still open, sometimes with a down payment.",
      },
    ],
    sources: [
      { label: "Fannie Mae Selling Guide B3-3.3-03, Employment Offers or Contracts", url: "https://selling-guide.fanniemae.com/sel/b3-3.3-03/employment-offers-or-contracts" },
      { label: "Fannie Mae Selling Guide B2-1.1-01, Occupancy Types", url: "https://selling-guide.fanniemae.com/sel/b2-1.1-01/occupancy-types" },
      { label: "Fannie Mae Selling Guide B3-6-06, Qualifying Impact of Other Real Estate Owned", url: "https://selling-guide.fanniemae.com/sel/b3-6-06/qualifying-impact-other-real-estate-owned" },
      { label: "Fannie Mae Selling Guide B3-3.8-05, Rental Income: Departing Residence", url: "https://selling-guide.fanniemae.com/sel/b3-3.8-05/rental-income-non-subject-property-departing-residence" },
      HUD_HANDBOOK,
      { label: "VA: Eligibility for VA home loan programs", url: "https://www.va.gov/housing-assistance/home-loans/eligibility/" },
      { label: "VA: Home loan limits", url: "https://www.va.gov/housing-assistance/home-loans/loan-limits/" },
      { label: "IRS Publication 523, Selling Your Home", url: "https://www.irs.gov/publications/p523" },
    ],
    relatedPrograms: [
      { label: "VA loans", href: "/mortgage-loans/va" },
      { label: "Conventional loans", href: "/mortgage-loans/conventional" },
      { label: "FHA loans", href: "/mortgage-loans/fha" },
    ],
  },
  {
    slug: "downsizing-in-retirement",
    title: "Downsizing and Getting a Mortgage in Retirement",
    shortTitle: "Retirement",
    metaTitle: "Mortgage in Retirement: Social Security, Pensions and Savings",
    description:
      "How Social Security, pensions and retirement savings count as mortgage income, how the home-sale tax exclusion works, and what a reverse mortgage purchase is.",
    intro:
      "Retiring does not rule out a mortgage. Lenders may not hold your age against you, and they have set ways to count Social Security, pensions and savings. What changes is the paperwork. " + LENDER_NOTE,
    keyPoints: [
      "A lender may not discount income because it comes from a pension, an annuity or another retirement benefit, and may not take your age into account against you.",
      "Your own Social Security retirement benefit needs no history, and you do not have to prove it will continue.",
      "Fannie Mae lets a lender turn retirement account balances into qualifying income by dividing them over the loan term.",
      "When you sell your home, up to $250,000 of gain, or $500,000 for a married couple filing jointly, can be excluded from tax if you meet the ownership and use tests.",
    ],
    sections: [
      {
        heading: "Your age and your income source are protected",
        paragraphs: [
          "Under the Equal Credit Opportunity Act's rules, a lender may not take an applicant's age into account, as long as the applicant is old enough to sign a contract, and may not discount or exclude income because it comes from part-time work, an annuity, a pension or another retirement benefit. A lender may look at the amount of the income and how likely it is to continue. That is why the documents below matter.",
        ],
      },
      {
        heading: "How retirement income is counted",
        paragraphs: [
          "Social Security: Fannie Mae accepts an award letter, a Form SSA-1099, tax returns or proof of current receipt, with no minimum history. For your own retirement benefit, continuance does not have to be documented. Benefits drawn on someone else's record need evidence of three years' continuance. FHA likewise treats an award with no stated end date as likely to continue and may not ask for more proof.",
          "Pensions and annuities: a fixed monthly payment is used at its documented amount with no minimum history under Fannie Mae rules. FHA looks for payments likely to continue at least three years.",
          "Retirement account withdrawals: both programs want distributions that are expected to continue for at least three years. Fannie Mae averages variable withdrawals over 12 months; FHA averages fluctuating amounts over two years.",
          "Income that is not taxed can be \"grossed up\". Fannie Mae lets a lender add 25 percent to verified non-taxable income, and allows part of a Social Security benefit to be treated that way without extra documentation.",
        ],
      },
      {
        heading: "Qualifying on savings instead of monthly income",
        paragraphs: [
          "Fannie Mae has a method called employment-related assets as qualifying income. The lender takes the balance of eligible accounts (401(k), IRA, SEP and Keogh accounts, and lump-sum retirement or severance payments), subtracts any early-withdrawal penalty and the money you need to close, and divides the rest by the number of months in the loan term. The result counts as monthly income.",
          "It has limits. It is for a purchase or a limited cash-out refinance of a principal residence or second home. The loan can be at most 70 percent of the home's value, or 80 percent when the account owner is at least 62 at closing. Proceeds from selling real estate, inheritances, divorce proceeds and stock options are not eligible assets.",
        ],
      },
      {
        heading: "Selling the family home: the tax exclusion",
        paragraphs: [
          "Federal tax law excludes up to $250,000 of gain on the sale of a principal residence, or up to $500,000 on a qualifying joint return, when the home was owned and used as your principal residence for at least two of the five years before the sale. On a joint return either spouse can meet the ownership test, but both must meet the use test. The exclusion can generally be used once in any two-year period.",
          "A surviving spouse who has not remarried can still use the $500,000 limit when the sale takes place within two years of the spouse's death and the couple would have qualified immediately before it. The survivor can also count the late spouse's time owning and living in the home. Confirm your own figures with a tax professional before you list.",
        ],
      },
      {
        heading: "A reverse mortgage to buy the next home",
        paragraphs: [
          "A Home Equity Conversion Mortgage for Purchase lets a buyer aged 62 or older use a reverse mortgage to buy a one- to four-unit home and live in one unit. Every borrower must be at least 62 at closing, and the home must be occupied within 60 days. You bring cash to cover the difference between the amount the reverse mortgage provides and the price, plus any loan costs that are not financed. Counseling from a HUD-approved agency is required before you apply. There is no monthly principal and interest payment, but property taxes, insurance and upkeep remain yours, and the loan comes due when the last borrower leaves the home.",
        ],
      },
    ],
    documents: [
      "Your Social Security award letter or most recent Form SSA-1099",
      "Pension or annuity award letters and recent statements showing the payments",
      "Statements for retirement accounts, showing balances and any regular withdrawals",
      "The last two years of tax returns",
      "The closing statement or contract for the home you are selling, if its proceeds fund the purchase",
    ],
    faqs: [
      {
        q: "Can I get a mortgage if I am retired?",
        a: "Yes. A lender may not hold your age against you or discount pension and retirement income. It will look at the amount of your income and whether it is likely to continue.",
      },
      {
        q: "Does Social Security count as income for a mortgage?",
        a: "Yes. Fannie Mae requires no minimum history for it, and for your own retirement benefit you do not have to document that it will continue.",
      },
      {
        q: "Can I qualify using my IRA or 401(k) balance?",
        a: "Under Fannie Mae's asset method, yes: eligible balances, less any penalty and the funds you need to close, are divided by the loan term in months to produce a monthly income figure. Loan-to-value limits of 70 or 80 percent apply.",
      },
      {
        q: "Will I owe tax when I sell my house to downsize?",
        a: "Up to $250,000 of gain, or $500,000 for a qualifying joint return, is excluded if you owned and lived in the home for two of the last five years. Gain above that can be taxable. Ask a tax professional about your numbers.",
      },
    ],
    sources: [
      { label: "12 CFR 1002.6, Regulation B: rules concerning evaluation of applications", url: "https://www.consumerfinance.gov/rules-policy/regulations/1002/6/" },
      { label: "Fannie Mae Selling Guide B3-3.4-15, Social Security Income", url: "https://selling-guide.fanniemae.com/sel/b3-3.4-15/social-security-income" },
      { label: "Fannie Mae Selling Guide B3-3.4-03, Annuity, Pension or Retirement Income", url: "https://selling-guide.fanniemae.com/sel/b3-3.4-03/annuity-pension-or-retirement-income" },
      { label: "Fannie Mae Selling Guide B3-3.4-06, Employment-Related Assets as Qualifying Income", url: "https://selling-guide.fanniemae.com/sel/b3-3.4-06/employment-related-assets-qualifying-income" },
      HUD_HANDBOOK,
      { label: "26 U.S.C. 121, exclusion of gain from sale of principal residence", url: "https://www.law.cornell.edu/uscode/text/26/121" },
      { label: "IRS Publication 523, Selling Your Home", url: "https://www.irs.gov/publications/p523" },
      { label: "24 CFR 206.44, HECM for Purchase: monetary investment", url: "https://www.law.cornell.edu/cfr/text/24/206.44" },
    ],
    relatedPrograms: [
      { label: "Conventional loans", href: "/mortgage-loans/conventional" },
      { label: "Refinance loans", href: "/mortgage-loans/refi" },
    ],
  },
];
