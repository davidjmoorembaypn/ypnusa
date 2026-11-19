/**
 * Realtor co-marketing talking points for each big-city market page, computed only from the
 * county's own 2024 HMDA numbers and how they compare with the other markets on the site.
 * No rates, forecasts, rankings of agents or promises of referrals.
 */
import { METRO_MARKETS, metroData, metroShares, type MetroMarket } from "@/content/metro-markets";
import { averageLoan, formatCount, formatDollars, sharePercent } from "@/content/market-report";
import { METRO_DATA_YEAR } from "@/content/metro-markets-data";

export interface ComarketingStat {
  label: string;
  value: string;
  note?: string;
}

export interface ComarketingAngle {
  title: string;
  body: string;
}

export interface RealtorComarketing {
  stats: ComarketingStat[];
  angles: ComarketingAngle[];
  /** Starter message with [bracketed] placeholders the loan officer fills in. */
  outreachStarter: string;
  complianceNote: string;
}

export const COMARKETING_COMPLIANCE_NOTE =
  "Co-marketing with real estate agents has to follow RESPA Section 8 and your state's rules: no payments or other things of value for referrals, and each party pays its own fair share of any joint marketing. Have your compliance team review before you send anything.";

/** Phrases the generated copy must never contain; checked by the test so edits can't slip them in. */
export const COMARKETING_SITE_BANNED: readonly RegExp[] = [
  /guarantee/i,
  /best rate|lowest rate/i,
  /referral fee|kickback/i,
  /leads? (per|a) (month|week)/i,
  /\d(\.\d+)?\s?% (interest )?rate/i,
];

const fhaVaShare = (m: MetroMarket) => {
  const d = metroData(m);
  return sharePercent(d.loanTypes.fha.count + d.loanTypes.va.count, d.total.count);
};

const average = (values: number[]) => values.reduce((a, b) => a + b, 0) / values.length;

export function realtorComarketing(m: MetroMarket): RealtorComarketing {
  const d = metroData(m);
  const purchaseShare = metroShares.purchaseShare(d);
  const refiShare = sharePercent(d.purposes.refinance.count + d.purposes.cashOutRefinance.count, d.total.count);
  const governmentShare = fhaVaShare(m);
  const avgPurchase = averageLoan(d.purposes.purchase);

  const avgPurchaseShare = average(METRO_MARKETS.map((x) => metroShares.purchaseShare(metroData(x))));
  const avgGovernmentShare = average(METRO_MARKETS.map(fhaVaShare));
  const purchaseHeavy = purchaseShare >= avgPurchaseShare;
  const governmentHeavy = governmentShare >= avgGovernmentShare;

  const angles: ComarketingAngle[] = [
    purchaseHeavy
      ? {
          title: "Lead with buyer pre-approval speed",
          body: `Home purchases were ${purchaseShare}% of ${m.county} loans in ${METRO_DATA_YEAR}, at or above the ${Math.round(avgPurchaseShare)}% average of the ${METRO_MARKETS.length} markets we track. Agents here live on buyer deals, so a fast, clear pre-approval answer is the easiest thing to offer.`,
        }
      : {
          title: "Offer past-client equity check-ins",
          body: `Refinances and cash-outs were ${refiShare}% of ${m.county} loans in ${METRO_DATA_YEAR}, and purchases ${purchaseShare}%, below the ${Math.round(avgPurchaseShare)}% average of the ${METRO_MARKETS.length} markets we track. Agents keep in touch with past buyers, so a co-branded equity check-in gives them a reason to call.`,
        },
    governmentHeavy
      ? {
          title: "Position yourself as the FHA and VA specialist",
          body: `FHA and VA loans were ${governmentShare}% of loans in ${m.county}, above the ${Math.round(avgGovernmentShare)}% average of the markets we track. Agents with first-time and veteran buyers want a loan officer who knows these programs well.`,
        }
      : {
          title: "Pitch your conventional and jumbo depth",
          body: `FHA and VA loans were ${governmentShare}% of loans in ${m.county}, below the ${Math.round(avgGovernmentShare)}% average of the markets we track, so conventional is the larger lane. Agents with move-up and higher-price buyers want a loan officer who can structure those loans.`,
        },
    {
      title: "Anchor a one-page buyer guide on the typical loan",
      body: `The average purchase loan in ${m.county} was about ${formatDollars(avgPurchase)} in ${METRO_DATA_YEAR}. Build a one-page guide for agents to send buyers: what a loan of that size means for the monthly payment, using the co-branded calculator with your name and NMLS #.`,
    },
  ];

  const outreachStarter = [
    "Hi [Agent first name],",
    `I'm [Your name], NMLS #[Your NMLS], a loan officer working in ${m.city}. In ${METRO_DATA_YEAR}, ${m.county} had ${formatCount(d.purposes.purchase.count)} home purchase loans, and ${governmentShare}% of all loans were FHA or VA.`,
    "I'd like to put together a one-page buyer guide and a payment calculator with both our names that you can send your clients. Do you have 15 minutes this week?",
  ].join("\n\n");

  return {
    stats: [
      { label: `Purchase loans ${METRO_DATA_YEAR}`, value: formatCount(d.purposes.purchase.count), note: `${purchaseShare}% of all loans in ${m.county}` },
      { label: "FHA + VA share", value: `${governmentShare}%`, note: `${Math.round(avgGovernmentShare)}% average across ${METRO_MARKETS.length} markets` },
      { label: "Avg purchase loan", value: formatDollars(avgPurchase), note: "HMDA amounts are banded, so close to exact" },
      { label: "Refinance + cash-out", value: `${refiShare}%`, note: `of loans in ${m.county}` },
    ],
    angles,
    outreachStarter,
    complianceNote: COMARKETING_COMPLIANCE_NOTE,
  };
}
