# Location page template (one ZIP code or city)

> **Do NOT publish until each page has unique local data.** A page that only swaps the city name is a
> doorway page. Google can drop the whole site's local pages for it. The live metro and county pages
> (`src/components/metro-area`, `src/components/market-report`, `src/components/local-seo`) are built
> from HMDA and Census data for exactly this reason; prefer extending those over hand-written pages.

## Required before publishing (every item must be real and sourced)

- [ ] At least three local numbers with a source and "retrieved" date (for example HMDA application
      count and loan purpose mix for the county, median home value from Census ACS, the share of FHA
      or VA loans). No estimates presented as facts.
- [ ] One paragraph only a local would write: neighborhoods, the price bands buyers actually shop,
      the dominant loan types and why.
- [ ] ZIP code availability is shown live from the ledger (the ZIP code check component), never typed in.
- [ ] No testimonials, lead counts, rankings or results unless they are real and documented.

## Page outline

- **Title (≤ 60 chars):** `[City], [ST] Loan Officers: Exclusive ZIP Code Leads`
- **Meta (140-155 chars):** For [City] loan officers: hold one ZIP code exclusively within YPN USA,
  get a local page, and let Cerebro answer borrowers 24/7. Check yours free.
- **H1:** Mortgage marketing for loan officers in [City], [ST]
- **Short answer box (2-3 sentences):** who it is for, what you get, how the ZIP code locks
  (at the first payment on a paid plan; exclusivity applies within YPN USA).
- **H2: The [City] mortgage market in numbers** (sourced table, retrieved date)
- **H2: Which borrowers search in [City]** (loan types, price bands, first-time buyer share)
- **H2: How a [City] ZIP code works with YPN USA** (1 loan officer per ZIP code, Cerebro, CRM)
- **H2: Check a [City] ZIP code** (the ZIP code check component; single primary CTA)
- **H2: FAQ** (3-5 questions, mirrored as FAQPage JSON-LD)
- **Related reading:** the county report, the nearest metro page, `/topics/local-seo-for-loan-officers`
- **Footer disclosure:** YPN Inc. is a marketing technology company, not a lender; not a commitment to
  lend; NMLS #787257; CA DRE #01852847; Equal Housing Opportunity.
- **Schema:** WebPage + BreadcrumbList + FAQPage. No LocalBusiness: the only real business address is
  the Dinuba, CA headquarters.
