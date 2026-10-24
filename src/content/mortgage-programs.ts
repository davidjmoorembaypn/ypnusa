import type { LoanProgram } from "@/lib/types";

export type ProgramContent = {
  label: string;
  /** One-sentence summary used in metadata descriptions and JSON-LD. */
  summary: string;
  /** Longer intro paragraph for the page body. */
  intro: string;
  idealFor: string[];
  keyFeatures: { title: string; body: string }[];
  faqs: { q: string; a: string }[];
};

/**
 * General, educational program content — not rates, not eligibility
 * determinations, not a commitment to lend. Figures here (down payment
 * minimums, program mechanics) are stable, publicly documented program
 * rules (HUD/VA/GSE guidelines), not current pricing. Each program page
 * still carries the standard "not an offer of credit" disclosure.
 */
export const PROGRAM_CONTENT: Record<LoanProgram, ProgramContent> = {
  FHA: {
    label: "FHA Loans",
    summary:
      "FHA loans are government-backed mortgages designed for lower down payments and more flexible credit requirements than a typical conventional loan.",
    intro:
      "FHA loans are insured by the Federal Housing Administration, which lets lenders offer more flexible qualifying guidelines than a conventional loan. They're one of the most common paths to homeownership for first-time buyers and anyone working with a smaller down payment or a less-than-perfect credit history.",
    idealFor: [
      "First-time homebuyers",
      "Buyers with a smaller down payment saved",
      "Borrowers rebuilding or still building credit history",
    ],
    keyFeatures: [
      { title: "Low down payment", body: "FHA allows down payments as low as 3.5% for borrowers who meet the program's credit guidelines." },
      { title: "Flexible credit guidelines", body: "FHA underwriting generally allows lower credit scores and higher debt-to-income ratios than many conventional programs." },
      { title: "Mortgage insurance required", body: "FHA loans require both an upfront and an annual mortgage insurance premium (MIP), which factors into the total cost of the loan." },
      { title: "Primary residences", body: "FHA financing is available for 1–4 unit primary residences, including some condos on HUD's approved list." },
    ],
    faqs: [
      { q: "Is an FHA loan only for first-time buyers?", a: "No. FHA loans are open to repeat buyers too, as long as the property will be the borrower's primary residence and the loan meets FHA guidelines." },
      { q: "Does FHA mortgage insurance go away?", a: "Depending on the down payment and loan term, annual MIP may be required for the life of the loan or may be removable — a loan officer can walk through which applies to your scenario." },
    ],
  },
  VA: {
    label: "VA Loans",
    summary:
      "VA loans are a benefit for eligible veterans, active-duty service members, and certain surviving spouses, often available with no down payment required.",
    intro:
      "VA loans are guaranteed by the U.S. Department of Veterans Affairs as a benefit earned through military service. They're built to reduce the cost of homeownership for those who've served, most notably by removing the down payment requirement that applies to most other loan types.",
    idealFor: [
      "Eligible active-duty service members and veterans",
      "Certain surviving spouses of veterans",
      "Buyers who want to avoid a down payment and avoid monthly mortgage insurance",
    ],
    keyFeatures: [
      { title: "No down payment required", body: "Most eligible borrowers can finance 100% of the purchase price, subject to the lender's and VA's guidelines." },
      { title: "No monthly mortgage insurance", body: "Unlike FHA and most conventional loans with less than 20% down, VA loans don't carry monthly mortgage insurance." },
      { title: "VA funding fee", body: "Most borrowers pay a one-time VA funding fee, which can often be financed into the loan; some borrowers (such as those receiving VA disability compensation) are exempt." },
      { title: "Certificate of Eligibility", body: "Eligibility is confirmed through a Certificate of Eligibility (COE), which your loan officer can help you request." },
    ],
    faqs: [
      { q: "Can I use my VA benefit more than once?", a: "Yes, in many cases. VA entitlement can potentially be reused or restored — the specifics depend on your service history and any prior VA loans." },
      { q: "Is a VA loan only for buying a home?", a: "No. The VA program also supports refinancing, including the VA Interest Rate Reduction Refinance Loan (IRRRL) for existing VA borrowers." },
    ],
  },
  CONVENTIONAL: {
    label: "Conventional Loans",
    summary:
      "Conventional loans are not government-backed and typically follow Fannie Mae or Freddie Mac guidelines, offering competitive terms for well-qualified borrowers.",
    intro:
      "Conventional loans are the most common mortgage type and are not insured or guaranteed by a government agency. Most follow underwriting guidelines set by Fannie Mae or Freddie Mac, which makes them a flexible option across a wide range of borrower profiles, down payment amounts, and property types.",
    idealFor: [
      "Buyers with stronger credit and stable income documentation",
      "Buyers who want to avoid FHA's mortgage insurance structure",
      "Second-home and investment-property purchases",
    ],
    keyFeatures: [
      { title: "Down payments from as low as 3%", body: "Certain conventional programs allow down payments as low as 3% for qualifying first-time buyers, though 5–20% is common." },
      { title: "Private mortgage insurance (PMI)", body: "PMI typically applies below 20% down, but — unlike FHA's MIP — it can usually be removed once sufficient equity is reached." },
      { title: "Fixed and adjustable-rate options", body: "Conventional loans are available in a range of fixed-rate terms and adjustable-rate structures." },
      { title: "Used for more than primary residences", body: "Conventional guidelines support primary residences, second homes, and investment properties." },
    ],
    faqs: [
      { q: "What credit score do I need for a conventional loan?", a: "Minimums vary by lender and loan scenario; a licensed loan officer can review your specific credit profile against current guidelines." },
      { q: "Can PMI be removed later?", a: "Generally yes, once the loan balance reaches a certain equity threshold — your loan officer can explain the specific path for your loan." },
    ],
  },
  DSCR: {
    label: "DSCR Loans",
    summary:
      "DSCR (Debt Service Coverage Ratio) loans qualify investment-property borrowers based on the property's rental income rather than personal income documentation.",
    intro:
      "DSCR loans are built for real estate investors. Instead of qualifying a borrower on personal income (W-2s, tax returns, pay stubs), underwriting is based on whether the property's rental income covers its own debt obligations — the debt service coverage ratio. That makes DSCR financing a popular option for self-employed investors, those with complex tax returns, or anyone scaling a rental portfolio.",
    idealFor: [
      "Real estate investors buying or refinancing rental property",
      "Self-employed borrowers with tax returns that understate cash flow",
      "Investors scaling beyond what personal-income qualification supports",
    ],
    keyFeatures: [
      { title: "Qualify on the property, not your paystub", body: "The core metric is the ratio of the property's rental income to its debt obligations (principal, interest, taxes, insurance), not personal income documentation." },
      { title: "No tax returns required in most cases", body: "Most DSCR programs skip traditional income verification, which speeds up the process for investors with complex finances." },
      { title: "Designed for investment property", body: "DSCR loans are structured for non-owner-occupied investment properties, not primary residences." },
      { title: "Portfolio-friendly", body: "Because qualification isn't tied to personal debt-to-income limits, DSCR financing is commonly used by investors acquiring multiple properties." },
    ],
    faqs: [
      { q: "What DSCR ratio do I need to qualify?", a: "Requirements vary by lender and property; some programs allow a ratio below 1.0 with adjusted terms. A loan officer can review your specific property's numbers." },
      { q: "Can I use a DSCR loan for my primary residence?", a: "No — DSCR programs are designed for investment property, not owner-occupied homes." },
    ],
  },
  HELOC: {
    label: "HELOC",
    summary:
      "A Home Equity Line of Credit (HELOC) lets homeowners borrow against their home's equity as a revolving credit line, rather than a one-time lump sum.",
    intro:
      "A HELOC is a revolving line of credit secured by your home's equity — similar in structure to a credit card, but typically with a much lower rate because it's secured by real estate. It's commonly used for renovations, debt consolidation, or as a flexible source of funds drawn only as needed.",
    idealFor: [
      "Homeowners with built-up equity who want flexible access to funds",
      "Renovation and home-improvement projects",
      "Borrowers who want to draw funds over time rather than all at once",
    ],
    keyFeatures: [
      { title: "Revolving credit line", body: "Borrow, repay, and borrow again up to your credit limit during the draw period, rather than receiving one lump sum." },
      { title: "Draw period and repayment period", body: "Most HELOCs have a draw period (often 10 years) followed by a repayment period — your loan officer will walk through how yours is structured." },
      { title: "Variable rates are common", body: "Many HELOCs carry a variable interest rate tied to an index, which means your payment can change over time." },
      { title: "Secured by your home", body: "Because a HELOC is secured by your property, it's important to understand the terms fully before drawing funds." },
    ],
    faqs: [
      { q: "How much can I borrow with a HELOC?", a: "It depends on your home's current value, your existing mortgage balance, and the lender's combined loan-to-value guidelines — our home equity snapshot tool can give you a first-pass estimate." },
      { q: "Is a HELOC the same as a home equity loan?", a: "No. A home equity loan is a one-time lump sum with a fixed rate; a HELOC is a revolving line you draw from as needed." },
    ],
  },
  REFI: {
    label: "Refinance",
    summary:
      "Refinancing replaces your existing mortgage with a new loan — commonly used to change your rate or term, tap equity through a cash-out refi, or remove mortgage insurance.",
    intro:
      "Refinancing means replacing your current mortgage with a new one. People refinance for a range of reasons: to pursue a lower monthly payment, shorten or extend the loan term, consolidate debt, remove mortgage insurance, or access home equity through a cash-out refinance.",
    idealFor: [
      "Homeowners looking to change their rate or loan term",
      "Borrowers who want to tap built-up equity (cash-out refinance)",
      "Homeowners looking to remove FHA mortgage insurance or PMI by moving to a different loan",
    ],
    keyFeatures: [
      { title: "Rate-and-term refinance", body: "Replaces your existing loan with a new one to adjust the rate, the term, or both — without taking cash out." },
      { title: "Cash-out refinance", body: "Lets you borrow against your home's equity and receive the difference in cash at closing, typically for renovations, debt consolidation, or other major expenses." },
      { title: "VA and FHA streamline options", body: "Borrowers with an existing VA or FHA loan may qualify for a streamlined refinance with reduced documentation requirements." },
      { title: "Closing costs apply", body: "Refinancing involves closing costs similar to a purchase loan — your loan officer can walk through the break-even math for your situation." },
    ],
    faqs: [
      { q: "How soon can I refinance after buying?", a: "It depends on the loan type and any seasoning requirements — a loan officer can confirm the timeline for your specific loan." },
      { q: "Does refinancing restart my 30-year clock?", a: "It can, depending on the new loan's term. You can also choose a shorter term if your goal is to avoid extending your payoff timeline." },
    ],
  },
  JUMBO: {
    label: "Jumbo Loans",
    summary:
      "Jumbo loans finance properties above the conforming loan limits set for Fannie Mae and Freddie Mac loans, commonly used for higher-value homes.",
    intro:
      "Jumbo loans are mortgages that exceed the conforming loan limits set each year by the Federal Housing Finance Agency. Because they aren't eligible for purchase by Fannie Mae or Freddie Mac, jumbo loans typically carry their own underwriting guidelines, often with more emphasis on reserves, credit profile, and documentation.",
    idealFor: [
      "Buyers purchasing above the conforming loan limit for their county",
      "Higher-value primary residences, second homes, and investment properties",
      "Borrowers with strong credit and documented reserves",
    ],
    keyFeatures: [
      { title: "Finances above conforming limits", body: "Conforming loan limits vary by county and are set annually — a loan officer can confirm the current limit for your target property's location." },
      { title: "Often requires larger reserves", body: "Jumbo underwriting commonly looks for larger cash reserves after closing compared to a conforming loan." },
      { title: "Flexible property use", body: "Jumbo financing is available for primary residences, second homes, and in some cases investment properties." },
      { title: "Fixed and adjustable structures available", body: "Jumbo loans are offered in a range of fixed-rate and adjustable-rate structures, similar to conforming loans." },
    ],
    faqs: [
      { q: "What counts as a jumbo loan?", a: "Any loan amount above the conforming loan limit for the property's county — these limits change annually and vary by location." },
      { q: "Do jumbo loans require a bigger down payment?", a: "Often yes, though requirements vary by lender and borrower profile — a loan officer can review the specifics for your scenario." },
    ],
  },
};
