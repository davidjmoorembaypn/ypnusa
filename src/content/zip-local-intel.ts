import { CALHFA_PROGRAMS, LOAN_LIMITS, PROPERTY_TAX_CONTEXT, flagshipZip, type CentralValleyCounty } from "@/content/zip-flagship";
import { zipPlace } from "@/lib/geo/zip-geo";
import { estimateZipDemand, type ZipDemand } from "@/lib/zip-demand";

/**
 * Local mortgage context for an indexable ZIP code page: loan limits, property tax and down payment
 * help for the four Central Valley counties we have checked, plus the Census-based activity
 * estimate. A ZIP code outside those counties gets NO dollar figures, because limits differ by
 * county and showing the baseline for a high-cost county would be wrong.
 *
 * Never a rate quote, a credit decision or a promise: the page copy says so in plain words.
 */

export interface ZipLocalIntel {
  zip: string;
  city: string;
  state: string;
  /** Set only for ZIP codes in the four checked counties. */
  county: CentralValleyCounty | null;
  demand: ZipDemand;
  faqs: Array<{ q: string; a: string }>;
}

const usd = (n: number) => `$${n.toLocaleString("en-US")}`;

function activityFaq(zip: string, city: string, demand: ZipDemand): { q: string; a: string } {
  const q = `How many households buy or move into ZIP code ${zip} in a typical 60 days?`;
  if (demand.basis === "none") {
    return { q, a: `The U.S. Census Bureau has no residential data for ZIP code ${zip}, so there is no activity estimate for it.` };
  }
  return {
    q,
    a: `In a typical 60 days, about ${demand.buyers} households move into a home they own in ${city} ${zip} and about ${demand.movers_in} move into a rented home. These are YPN USA estimates from U.S. Census Bureau American Community Survey data on households that moved in the past year. They are illustrative market estimates, not a count of leads and not a forecast.`,
  };
}

export function buildZipLocalIntel(zip: string): ZipLocalIntel | null {
  const place = zipPlace(zip);
  const demand = estimateZipDemand(zip);
  if (!place || !demand) return null;
  const flagship = flagshipZip(zip);
  const city = flagship?.city ?? place.city;
  const state = place.state;
  const county = flagship?.county ?? null;

  const faqs: Array<{ q: string; a: string }> = [];
  if (county) {
    faqs.push(
      {
        q: `What are the ${LOAN_LIMITS.year} conforming and FHA loan limits in ${city}, CA ${zip}?`,
        a: `For a one-unit home in ${county}, the ${LOAN_LIMITS.year} conforming loan limit is ${usd(LOAN_LIMITS.conformingOneUnit)} and the FHA limit is ${usd(LOAN_LIMITS.fhaFloorOneUnit)}. A loan above the conforming limit is a jumbo loan. Limits are set each year by FHFA and HUD and are higher for two- to four-unit homes, so confirm the figure for your property with a licensed loan officer.`,
      },
      {
        q: `How much is property tax on a home in ${city} ${zip}?`,
        a: `California's base property tax rate is ${PROPERTY_TAX_CONTEXT.baseRatePct}% of assessed value under Proposition 13. Voter-approved bonds and local assessments are added on top, so a newly purchased home in ${county} often totals about ${PROPERTY_TAX_CONTEXT.typicalLowPct}% to ${PROPERTY_TAX_CONTEXT.typicalHighPct}% of the purchase price a year. That is an estimate. The exact amount depends on the parcel, so check the ${county} tax collector's records for the property.`,
      },
      {
        q: `Is there down payment help for home buyers in ${city} ${zip}?`,
        a: `Eligible California buyers can look at CalHFA programs. The MyHome Assistance Program is a deferred-payment junior loan that can go toward a down payment or closing costs, and the Dream For All Shared Appreciation Loan helps with the down payment in exchange for a share of the home's future appreciation. Both have eligibility and income rules, Dream For All funding is limited and opens in rounds, and terms change, so check CalHFA and a participating lender for what is available now.`,
      },
    );
  } else {
    faqs.push(
      {
        q: `Who can help me with a mortgage in ${city}, ${state} ${zip}?`,
        a: `Start the borrower intake on this page and a licensed mortgage loan officer who serves ZIP code ${zip} will follow up. YPN USA is a marketing technology platform for loan officers. It is not a lender and does not make credit decisions, and nothing on this page is a rate quote or a commitment to lend.`,
      },
      {
        q: `What are the loan limits for a home in ZIP code ${zip}?`,
        a: `Conforming and FHA loan limits are set by county each year, and some counties have higher limits than the national baseline. Look up the county for ${zip} on FHFA's conforming loan limit page and HUD's FHA limits lookup, or ask a licensed loan officer to confirm the limit for your property.`,
      },
      {
        q: `Can a loan officer get exclusive borrower routing for ZIP code ${zip}?`,
        a: `Yes. Licensed loan officers can lock ZIP code ${zip} on YPN USA, and each ZIP code goes to one YPN USA loan officer at a time. Checking whether it is open is free and does not reserve it. Exclusivity applies within YPN USA, and no results or lead volume are guaranteed.`,
      },
    );
  }
  faqs.push(activityFaq(zip, city, demand));

  return { zip, city, state, county, demand, faqs };
}

export { CALHFA_PROGRAMS, LOAN_LIMITS, PROPERTY_TAX_CONTEXT };
