/**
 * 2024 (and 2023) HMDA numbers for the 100 metro areas on /markets/metro (src/content/metro-areas.ts).
 * GENERATED from the raw API responses saved in the project files (ypnus/hmda/metro-msamd-2024/).
 *
 * Source: CFPB / FFIEC HMDA Data Browser aggregations API
 * (https://ffiec.cfpb.gov/v2/data-browser-api/view/aggregations), fetched 2026-11-24, one MSA/MD
 * code per query: actions_taken=1..8 (all application outcomes), and for originated loans
 * (actions_taken=1) loan_types=1..4 and loan_purposes=1,2,31,32,4,5. Tests check that loan types
 * and purposes each add up to the originated count for every metro.
 *
 * Which 100: the HMDA metro areas (MSA/MDs) with the most 2024 HMDA records, per the record
 * counts the CFPB publishes with its Data Browser (github.com/cfpb/hmda-frontend,
 * src/data-browser/constants/recordCountsByGeography/msamdCounts2024.json). Names and states come
 * from the same repository (msaToName2024.json, msaToState2024.json).
 *
 * comparableTo2023: the same code and name existed in 2023 and the 2023 record count is within
 * -12% / +20% of 2024, so a boundary change between the 2023 and 2024 delineations is unlikely.
 * Dollar sums are HMDA public loan amounts, banded to the midpoint of $10,000 ranges.
 */
import type { CountSum } from "@/content/market-report";

export const METRO_AREA_DATA_FETCHED_ON = "2026-11-24";

export interface ActionCounts {
  originated: CountSum;
  approvedNotAccepted: CountSum;
  denied: CountSum;
  withdrawn: CountSum;
  incomplete: CountSum;
  purchased: CountSum;
  preapprovalDenied: CountSum;
  preapprovalApprovedNotAccepted: CountSum;
}

export interface MetroAreaHmda {
  y2024: {
    actions: ActionCounts;
    loanTypes: { conventional: CountSum; fha: CountSum; va: CountSum; usda: CountSum };
    purposes: { purchase: CountSum; homeImprovement: CountSum; refinance: CountSum; cashOutRefinance: CountSum; other: CountSum; notApplicable: CountSum };
  };
  y2023?: { actions: ActionCounts };
  comparableTo2023: boolean;
}

export interface MetroAreaMeta {
  /** HMDA MSA/MD code. */
  code: string;
  /** URL slug under /markets/metro. */
  slug: string;
  /** Official HMDA name with states, e.g. "Houston-Pasadena-The Woodlands, TX". */
  name: string;
  /** Short name used in sentences. */
  short: string;
  /** Primary state first. */
  states: string[];
  /** Place names (as in the ZIP code dataset) used to link ZIP code pages both ways. */
  places: string[];
  /** Existing county-level page for the same city, if any. */
  countyPage?: string;
}

const cs = (count: number, sum: number): CountSum => ({ count, sum });

export const METRO_AREA_META: readonly MetroAreaMeta[] = [
  { code: "26420", slug: "houston-tx", name: "Houston-Pasadena-The Woodlands, TX", short: "Houston", states: ["TX"], places: ["Houston", "Pasadena", "The Woodlands"], countyPage: "/markets/houston-tx" },
  { code: "38060", slug: "phoenix-az", name: "Phoenix-Mesa-Chandler, AZ", short: "Phoenix", states: ["AZ"], places: ["Phoenix", "Mesa", "Chandler"], countyPage: "/markets/phoenix-az" },
  { code: "12054", slug: "atlanta-ga", name: "Atlanta-Sandy Springs-Roswell, GA", short: "Atlanta", states: ["GA"], places: ["Atlanta", "Sandy Springs", "Roswell"] },
  { code: "16984", slug: "chicago-il", name: "Chicago-Naperville-Schaumburg, IL", short: "Chicago", states: ["IL"], places: ["Chicago", "Naperville", "Schaumburg"], countyPage: "/markets/chicago-il" },
  { code: "19124", slug: "dallas-tx", name: "Dallas-Plano-Irving, TX", short: "Dallas", states: ["TX"], places: ["Dallas", "Plano", "Irving"], countyPage: "/dallas-tx-mortgage-loan-officer" },
  { code: "31084", slug: "los-angeles-ca", name: "Los Angeles-Long Beach-Glendale, CA", short: "Los Angeles", states: ["CA"], places: ["Los Angeles", "Long Beach", "Glendale"], countyPage: "/markets/los-angeles-ca" },
  { code: "40140", slug: "riverside-ca", name: "Riverside-San Bernardino-Ontario, CA", short: "Riverside", states: ["CA"], places: ["Riverside", "San Bernardino", "Ontario"] },
  { code: "35614", slug: "new-york-ny", name: "New York-Jersey City-White Plains, NY-NJ", short: "New York", states: ["NY", "NJ"], places: ["New York", "Jersey City", "White Plains"], countyPage: "/markets/brooklyn-ny" },
  { code: "16740", slug: "charlotte-nc", name: "Charlotte-Concord-Gastonia, NC-SC", short: "Charlotte", states: ["NC", "SC"], places: ["Charlotte", "Concord", "Gastonia"], countyPage: "/markets/charlotte-nc" },
  { code: "19740", slug: "denver-co", name: "Denver-Aurora-Centennial, CO", short: "Denver", states: ["CO"], places: ["Denver", "Aurora", "Centennial"] },
  { code: "33460", slug: "minneapolis-mn", name: "Minneapolis-St. Paul-Bloomington, MN-WI", short: "Minneapolis", states: ["MN", "WI"], places: ["Minneapolis", "Saint Paul", "Bloomington"] },
  { code: "36740", slug: "orlando-fl", name: "Orlando-Kissimmee-Sanford, FL", short: "Orlando", states: ["FL"], places: ["Orlando", "Kissimmee", "Sanford"], countyPage: "/markets/orlando-fl" },
  { code: "45294", slug: "tampa-fl", name: "Tampa, FL", short: "Tampa", states: ["FL"], places: ["Tampa"] },
  { code: "11694", slug: "arlington-va", name: "Arlington-Alexandria-Reston, VA-WV", short: "Arlington-Alexandria", states: ["VA", "WV"], places: ["Arlington", "Alexandria", "Reston"] },
  { code: "41180", slug: "st-louis-mo", name: "St. Louis, MO-IL", short: "St. Louis", states: ["MO", "IL"], places: ["Saint Louis"] },
  { code: "41700", slug: "san-antonio-tx", name: "San Antonio-New Braunfels, TX", short: "San Antonio", states: ["TX"], places: ["San Antonio", "New Braunfels"] },
  { code: "12580", slug: "baltimore-md", name: "Baltimore-Columbia-Towson, MD", short: "Baltimore", states: ["MD"], places: ["Baltimore", "Columbia", "Towson"] },
  { code: "26900", slug: "indianapolis-in", name: "Indianapolis-Carmel-Greenwood, IN", short: "Indianapolis", states: ["IN"], places: ["Indianapolis", "Carmel", "Greenwood"], countyPage: "/markets/indianapolis-in" },
  { code: "47664", slug: "warren-mi", name: "Warren-Troy-Farmington Hills, MI", short: "Warren-Troy", states: ["MI"], places: ["Warren", "Troy", "Farmington Hills"] },
  { code: "29820", slug: "las-vegas-nv", name: "Las Vegas-Henderson-North Las Vegas, NV", short: "Las Vegas", states: ["NV"], places: ["Las Vegas", "Henderson", "North Las Vegas"], countyPage: "/markets/las-vegas-nv" },
  { code: "34980", slug: "nashville-tn", name: "Nashville-Davidson--Murfreesboro--Franklin, TN", short: "Nashville", states: ["TN"], places: ["Nashville", "Murfreesboro", "Franklin"], countyPage: "/markets/nashville-tn" },
  { code: "17140", slug: "cincinnati-oh", name: "Cincinnati, OH-KY-IN", short: "Cincinnati", states: ["OH", "KY", "IN"], places: ["Cincinnati"] },
  { code: "12420", slug: "austin-tx", name: "Austin-Round Rock-San Marcos, TX", short: "Austin", states: ["TX"], places: ["Austin", "Round Rock", "San Marcos"], countyPage: "/markets/austin-tx" },
  { code: "23104", slug: "fort-worth-tx", name: "Fort Worth-Arlington-Grapevine, TX", short: "Fort Worth", states: ["TX"], places: ["Fort Worth", "Arlington", "Grapevine"], countyPage: "/markets/fort-worth-tx" },
  { code: "18140", slug: "columbus-oh", name: "Columbus, OH", short: "Columbus", states: ["OH"], places: ["Columbus"] },
  { code: "29484", slug: "lakewood-nj", name: "Lakewood-New Brunswick, NJ", short: "Lakewood-New Brunswick", states: ["NJ"], places: ["Lakewood", "New Brunswick"] },
  { code: "41740", slug: "san-diego-ca", name: "San Diego-Chula Vista-Carlsbad, CA", short: "San Diego", states: ["CA"], places: ["San Diego", "Chula Vista", "Carlsbad"], countyPage: "/markets/san-diego-ca" },
  { code: "28140", slug: "kansas-city-mo", name: "Kansas City, MO-KS", short: "Kansas City", states: ["MO", "KS"], places: ["Kansas City"] },
  { code: "27260", slug: "jacksonville-fl", name: "Jacksonville, FL", short: "Jacksonville", states: ["FL"], places: ["Jacksonville"], countyPage: "/markets/jacksonville-fl" },
  { code: "17410", slug: "cleveland-oh", name: "Cleveland, OH", short: "Cleveland", states: ["OH"], places: ["Cleveland"], countyPage: "/markets/cleveland-oh" },
  { code: "47260", slug: "virginia-beach-va", name: "Virginia Beach-Chesapeake-Norfolk, VA-NC", short: "Virginia Beach", states: ["VA", "NC"], places: ["Virginia Beach", "Chesapeake", "Norfolk"] },
  { code: "38900", slug: "portland-or", name: "Portland-Vancouver-Hillsboro, OR-WA", short: "Portland", states: ["OR", "WA"], places: ["Portland", "Vancouver", "Hillsboro"], countyPage: "/markets/portland-or" },
  { code: "38300", slug: "pittsburgh-pa", name: "Pittsburgh, PA", short: "Pittsburgh", states: ["PA"], places: ["Pittsburgh"], countyPage: "/markets/pittsburgh-pa" },
  { code: "33124", slug: "miami-fl", name: "Miami-Miami Beach-Kendall, FL", short: "Miami", states: ["FL"], places: ["Miami", "Miami Beach", "Kendall"] },
  { code: "40900", slug: "sacramento-ca", name: "Sacramento-Roseville-Folsom, CA", short: "Sacramento", states: ["CA"], places: ["Sacramento", "Roseville", "Folsom"], countyPage: "/markets/sacramento-ca" },
  { code: "35004", slug: "nassau-suffolk-ny", name: "Nassau County-Suffolk County, NY", short: "Nassau-Suffolk", states: ["NY"], places: ["Hempstead", "Levittown", "Hicksville", "Huntington", "Brentwood", "Smithtown"] },
  { code: "22744", slug: "fort-lauderdale-fl", name: "Fort Lauderdale-Pompano Beach-Sunrise, FL", short: "Fort Lauderdale", states: ["FL"], places: ["Fort Lauderdale", "Pompano Beach", "Sunrise"] },
  { code: "33874", slug: "montgomery-bucks-chester-pa", name: "Montgomery County-Bucks County-Chester County, PA", short: "Montgomery-Bucks-Chester", states: ["PA"], places: ["Norristown", "Doylestown", "West Chester", "Lansdale"] },
  { code: "11244", slug: "anaheim-ca", name: "Anaheim-Santa Ana-Irvine, CA", short: "Anaheim", states: ["CA"], places: ["Anaheim", "Santa Ana", "Irvine"] },
  { code: "39580", slug: "raleigh-nc", name: "Raleigh-Cary, NC", short: "Raleigh", states: ["NC"], places: ["Raleigh", "Cary"], countyPage: "/markets/raleigh-nc" },
  { code: "35084", slug: "newark-nj", name: "Newark, NJ", short: "Newark", states: ["NJ"], places: ["Newark"] },
  { code: "36084", slug: "oakland-ca", name: "Oakland-Fremont-Berkeley, CA", short: "Oakland", states: ["CA"], places: ["Oakland", "Fremont", "Berkeley"] },
  { code: "37964", slug: "philadelphia-pa", name: "Philadelphia, PA", short: "Philadelphia", states: ["PA"], places: ["Philadelphia"] },
  { code: "15764", slug: "cambridge-ma", name: "Cambridge-Newton-Framingham, MA", short: "Cambridge", states: ["MA"], places: ["Cambridge", "Newton", "Framingham"] },
  { code: "31924", slug: "marietta-ga", name: "Marietta, GA", short: "Marietta", states: ["GA"], places: ["Marietta"] },
  { code: "42644", slug: "seattle-wa", name: "Seattle-Bellevue-Kent, WA", short: "Seattle", states: ["WA"], places: ["Seattle", "Bellevue", "Kent"] },
  { code: "47764", slug: "washington-dc", name: "Washington, DC-MD", short: "Washington, DC", states: ["DC", "MD"], places: ["Washington"], countyPage: "/markets/washington-dc" },
  { code: "39300", slug: "providence-ri", name: "Providence-Warwick, RI-MA", short: "Providence", states: ["RI", "MA"], places: ["Providence", "Warwick"] },
  { code: "48424", slug: "west-palm-beach-fl", name: "West Palm Beach-Boca Raton-Delray Beach, FL", short: "West Palm Beach", states: ["FL"], places: ["West Palm Beach", "Boca Raton", "Delray Beach"] },
  { code: "19804", slug: "detroit-mi", name: "Detroit-Dearborn-Livonia, MI", short: "Detroit", states: ["MI"], places: ["Detroit", "Dearborn", "Livonia"], countyPage: "/markets/detroit-mi" },
  { code: "36420", slug: "oklahoma-city-ok", name: "Oklahoma City, OK", short: "Oklahoma City", states: ["OK"], places: ["Oklahoma City"] },
  { code: "40060", slug: "richmond-va", name: "Richmond, VA", short: "Richmond", states: ["VA"], places: ["Richmond"], countyPage: "/markets/richmond-va" },
  { code: "14454", slug: "boston-ma", name: "Boston, MA", short: "Boston", states: ["MA"], places: ["Boston"], countyPage: "/markets/boston-ma" },
  { code: "31140", slug: "louisville-ky", name: "Louisville/Jefferson County, KY-IN", short: "Louisville", states: ["KY", "IN"], places: ["Louisville"] },
  { code: "15804", slug: "camden-nj", name: "Camden, NJ", short: "Camden", states: ["NJ"], places: ["Camden"] },
  { code: "33340", slug: "milwaukee-wi", name: "Milwaukee-Waukesha, WI", short: "Milwaukee", states: ["WI"], places: ["Milwaukee", "Waukesha"] },
  { code: "41620", slug: "salt-lake-city-ut", name: "Salt Lake City-Murray, UT", short: "Salt Lake City", states: ["UT"], places: ["Salt Lake City", "Murray"] },
  { code: "13820", slug: "birmingham-al", name: "Birmingham, AL", short: "Birmingham", states: ["AL"], places: ["Birmingham"] },
  { code: "35840", slug: "north-port-fl", name: "North Port-Bradenton-Sarasota, FL", short: "North Port", states: ["FL"], places: ["North Port", "Bradenton", "Sarasota"] },
  { code: "32820", slug: "memphis-tn", name: "Memphis, TN-MS-AR", short: "Memphis", states: ["TN", "MS", "AR"], places: ["Memphis"] },
  { code: "29460", slug: "lakeland-fl", name: "Lakeland-Winter Haven, FL", short: "Lakeland", states: ["FL"], places: ["Lakeland", "Winter Haven"] },
  { code: "16700", slug: "charleston-sc", name: "Charleston-North Charleston, SC", short: "Charleston", states: ["SC"], places: ["Charleston", "North Charleston"], countyPage: "/markets/charleston-sc" },
  { code: "15980", slug: "cape-coral-fl", name: "Cape Coral-Fort Myers, FL", short: "Cape Coral", states: ["FL"], places: ["Cape Coral", "Fort Myers"] },
  { code: "24340", slug: "grand-rapids-mi", name: "Grand Rapids-Wyoming-Kentwood, MI", short: "Grand Rapids", states: ["MI"], places: ["Grand Rapids", "Wyoming", "Kentwood"] },
  { code: "46060", slug: "tucson-az", name: "Tucson, AZ", short: "Tucson", states: ["AZ"], places: ["Tucson"], countyPage: "/markets/tucson-az" },
  { code: "28940", slug: "knoxville-tn", name: "Knoxville, TN", short: "Knoxville", states: ["TN"], places: ["Knoxville"] },
  { code: "23224", slug: "frederick-md", name: "Frederick-Gaithersburg-Bethesda, MD", short: "Frederick", states: ["MD"], places: ["Frederick", "Gaithersburg", "Bethesda"] },
  { code: "24860", slug: "greenville-sc", name: "Greenville-Anderson-Greer, SC", short: "Greenville", states: ["SC"], places: ["Greenville", "Anderson", "Greer"] },
  { code: "46140", slug: "tulsa-ok", name: "Tulsa, OK", short: "Tulsa", states: ["OK"], places: ["Tulsa"] },
  { code: "41304", slug: "st-petersburg-fl", name: "St. Petersburg-Clearwater-Largo, FL", short: "St. Petersburg", states: ["FL"], places: ["Saint Petersburg", "Clearwater", "Largo"] },
  { code: "41940", slug: "san-jose-ca", name: "San Jose-Sunnyvale-Santa Clara, CA", short: "San Jose", states: ["CA"], places: ["San Jose", "Sunnyvale", "Santa Clara"], countyPage: "/markets/san-jose-ca" },
  { code: "17900", slug: "columbia-sc", name: "Columbia, SC", short: "Columbia", states: ["SC"], places: ["Columbia"] },
  { code: "19660", slug: "deltona-fl", name: "Deltona-Daytona Beach-Ormond Beach, FL", short: "Deltona", states: ["FL"], places: ["Deltona", "Daytona Beach", "Ormond Beach"] },
  { code: "36540", slug: "omaha-ne", name: "Omaha, NE-IA", short: "Omaha", states: ["NE", "IA"], places: ["Omaha"] },
  { code: "25540", slug: "hartford-ct", name: "Hartford-West Hartford-East Hartford, CT", short: "Hartford", states: ["CT"], places: ["Hartford", "West Hartford", "East Hartford"] },
  { code: "17820", slug: "colorado-springs-co", name: "Colorado Springs, CO", short: "Colorado Springs", states: ["CO"], places: ["Colorado Springs"] },
  { code: "14260", slug: "boise-id", name: "Boise City, ID", short: "Boise", states: ["ID"], places: ["Boise"], countyPage: "/markets/boise-id" },
  { code: "10740", slug: "albuquerque-nm", name: "Albuquerque, NM", short: "Albuquerque", states: ["NM"], places: ["Albuquerque"], countyPage: "/markets/albuquerque-nm" },
  { code: "45104", slug: "tacoma-wa", name: "Tacoma-Lakewood, WA", short: "Tacoma", states: ["WA"], places: ["Tacoma", "Lakewood"] },
  { code: "37340", slug: "palm-bay-fl", name: "Palm Bay-Melbourne-Titusville, FL", short: "Palm Bay", states: ["FL"], places: ["Palm Bay", "Melbourne", "Titusville"] },
  { code: "30780", slug: "little-rock-ar", name: "Little Rock-North Little Rock-Conway, AR", short: "Little Rock", states: ["AR"], places: ["Little Rock", "North Little Rock", "Conway"] },
  { code: "23420", slug: "fresno-ca", name: "Fresno, CA", short: "Fresno", states: ["CA"], places: ["Fresno"], countyPage: "/research/fresno-county-ca" },
  { code: "40380", slug: "rochester-ny", name: "Rochester, NY", short: "Rochester", states: ["NY"], places: ["Rochester"] },
  { code: "19430", slug: "dayton-oh", name: "Dayton-Kettering-Beavercreek, OH", short: "Dayton", states: ["OH"], places: ["Dayton", "Kettering", "Beavercreek"] },
  { code: "10900", slug: "allentown-pa", name: "Allentown-Bethlehem-Easton, PA-NJ", short: "Allentown", states: ["PA", "NJ"], places: ["Allentown", "Bethlehem", "Easton"] },
  { code: "39340", slug: "provo-ut", name: "Provo-Orem-Lehi, UT", short: "Provo", states: ["UT"], places: ["Provo", "Orem", "Lehi"] },
  { code: "21794", slug: "everett-wa", name: "Everett, WA", short: "Everett", states: ["WA"], places: ["Everett"] },
  { code: "19780", slug: "des-moines-ia", name: "Des Moines-West Des Moines, IA", short: "Des Moines", states: ["IA"], places: ["Des Moines", "West Des Moines"] },
  { code: "38940", slug: "port-st-lucie-fl", name: "Port St. Lucie, FL", short: "Port St. Lucie", states: ["FL"], places: ["Port Saint Lucie"] },
  { code: "24660", slug: "greensboro-nc", name: "Greensboro-High Point, NC", short: "Greensboro", states: ["NC"], places: ["Greensboro", "High Point"] },
  { code: "36260", slug: "ogden-ut", name: "Ogden, UT", short: "Ogden", states: ["UT"], places: ["Ogden"] },
  { code: "49340", slug: "worcester-ma", name: "Worcester, MA", short: "Worcester", states: ["MA"], places: ["Worcester"] },
  { code: "29414", slug: "lake-porter-jasper-in", name: "Lake County-Porter County-Jasper County, IN", short: "Northwest Indiana", states: ["IN"], places: ["Gary", "Hammond", "Valparaiso", "Merrillville"] },
  { code: "15380", slug: "buffalo-ny", name: "Buffalo-Cheektowaga, NY", short: "Buffalo", states: ["NY"], places: ["Buffalo", "Cheektowaga"] },
  { code: "48864", slug: "wilmington-de", name: "Wilmington, DE-MD-NJ", short: "Wilmington, DE", states: ["DE", "MD", "NJ"], places: ["Wilmington"] },
  { code: "20994", slug: "elgin-il", name: "Elgin, IL", short: "Elgin", states: ["IL"], places: ["Elgin"] },
  { code: "49180", slug: "winston-salem-nc", name: "Winston-Salem, NC", short: "Winston-Salem", states: ["NC"], places: ["Winston-Salem"] },
  { code: "12940", slug: "baton-rouge-la", name: "Baton Rouge, LA", short: "Baton Rouge", states: ["LA"], places: ["Baton Rouge"] },
  { code: "26620", slug: "huntsville-al", name: "Huntsville, AL", short: "Huntsville", states: ["AL"], places: ["Huntsville"] },
  { code: "48900", slug: "wilmington-nc", name: "Wilmington, NC", short: "Wilmington, NC", states: ["NC"], places: ["Wilmington"] },
];

/** Keyed by HMDA MSA/MD code. */
export const METRO_AREA_HMDA: Readonly<Record<string, MetroAreaHmda>> = {
  "26420": {
    y2024: {
      actions: { originated: cs(114808, 39247400000), approvedNotAccepted: cs(7398, 2114720000), denied: cs(46702, 11514840000), withdrawn: cs(34008, 11939570000), incomplete: cs(12500, 2582000000), purchased: cs(38005, 11946345000), preapprovalDenied: cs(292, 85210000), preapprovalApprovedNotAccepted: cs(594, 207260000) },
      loanTypes: { conventional: cs(81793, 28697925000), fha: cs(24357, 7354115000), va: cs(8279, 3156685000), usda: cs(379, 38675000) },
      purposes: { purchase: cs(86915, 31103165000), homeImprovement: cs(4311, 566725000), refinance: cs(7916, 3837110000), cashOutRefinance: cs(9797, 2746565000), other: cs(5840, 941500000), notApplicable: cs(29, 52335000) },
    },
    y2023: { actions: { originated: cs(106199, 35712405000), approvedNotAccepted: cs(6662, 1908770000), denied: cs(46243, 8865945000), withdrawn: cs(34075, 11245475000), incomplete: cs(11677, 2396595000), purchased: cs(34058, 10270280000), preapprovalDenied: cs(333, 88955000), preapprovalApprovedNotAccepted: cs(327, 96985000) } },
    comparableTo2023: false,
  },
  "38060": {
    y2024: {
      actions: { originated: cs(119147, 44195995000), approvedNotAccepted: cs(7229, 1927505000), denied: cs(35663, 8921505000), withdrawn: cs(28706, 11023670000), incomplete: cs(9049, 2295015000), purchased: cs(27764, 10737410000), preapprovalDenied: cs(86, 29430000), preapprovalApprovedNotAccepted: cs(205, 92775000) },
      loanTypes: { conventional: cs(88406, 32073390000), fha: cs(21368, 7939910000), va: cs(9223, 4143565000), usda: cs(150, 39130000) },
      purposes: { purchase: cs(65618, 29429020000), homeImprovement: cs(11672, 1433140000), refinance: cs(13014, 6885220000), cashOutRefinance: cs(15117, 4702505000), other: cs(13707, 1735475000), notApplicable: cs(19, 10635000) },
    },
    y2023: { actions: { originated: cs(105949, 37965375000), approvedNotAccepted: cs(6133, 1704695000), denied: cs(37297, 8651685000), withdrawn: cs(28523, 10943315000), incomplete: cs(8486, 2158760000), purchased: cs(24233, 14184685000), preapprovalDenied: cs(163, 59195000), preapprovalApprovedNotAccepted: cs(178, 70890000) } },
    comparableTo2023: true,
  },
  "12054": {
    y2024: {
      actions: { originated: cs(104026, 36036050000), approvedNotAccepted: cs(5785, 1762875000), denied: cs(43708, 10117090000), withdrawn: cs(33554, 11764820000), incomplete: cs(11921, 2905095000), purchased: cs(27219, 30298695000), preapprovalDenied: cs(132, 41340000), preapprovalApprovedNotAccepted: cs(279, 111705000) },
      loanTypes: { conventional: cs(75217, 26112645000), fha: cs(20411, 6645045000), va: cs(8151, 3213795000), usda: cs(247, 64565000) },
      purposes: { purchase: cs(59240, 23715290000), homeImprovement: cs(8608, 1027670000), refinance: cs(10180, 5213160000), cashOutRefinance: cs(16775, 4777005000), other: cs(9215, 1301085000), notApplicable: cs(8, 1840000) },
    },
    comparableTo2023: false,
  },
  "16984": {
    y2024: {
      actions: { originated: cs(112406, 37419990000), approvedNotAccepted: cs(5624, 1523710000), denied: cs(39169, 8820255000), withdrawn: cs(32422, 11729220000), incomplete: cs(10493, 2211645000), purchased: cs(25856, 11014040000), preapprovalDenied: cs(221, 45515000), preapprovalApprovedNotAccepted: cs(361, 126055000) },
      loanTypes: { conventional: cs(97246, 32775840000), fha: cs(11657, 3363385000), va: cs(3484, 1277160000), usda: cs(19, 3605000) },
      purposes: { purchase: cs(69048, 24976820000), homeImprovement: cs(8718, 1132970000), refinance: cs(12579, 7006945000), cashOutRefinance: cs(12939, 3188115000), other: cs(9111, 1113435000), notApplicable: cs(11, 1705000) },
    },
    y2023: { actions: { originated: cs(100795, 32039815000), approvedNotAccepted: cs(4362, 1037790000), denied: cs(35071, 6251115000), withdrawn: cs(29797, 10571885000), incomplete: cs(9841, 2212035000), purchased: cs(25157, 8204735000), preapprovalDenied: cs(172, 163610000), preapprovalApprovedNotAccepted: cs(124, 39710000) } },
    comparableTo2023: false,
  },
  "19124": {
    y2024: {
      actions: { originated: cs(101162, 44304120000), approvedNotAccepted: cs(5212, 1881410000), denied: cs(31524, 9077780000), withdrawn: cs(28454, 12700440000), incomplete: cs(9629, 2815005000), purchased: cs(34502, 13409160000), preapprovalDenied: cs(136, 49900000), preapprovalApprovedNotAccepted: cs(461, 180475000) },
      loanTypes: { conventional: cs(77631, 35348705000), fha: cs(17212, 6121670000), va: cs(6139, 2795875000), usda: cs(180, 37870000) },
      purposes: { purchase: cs(72846, 32301390000), homeImprovement: cs(4171, 682655000), refinance: cs(8775, 5853295000), cashOutRefinance: cs(10529, 4190745000), other: cs(4790, 1261670000), notApplicable: cs(51, 14365000) },
    },
    y2023: { actions: { originated: cs(94302, 39804740000), approvedNotAccepted: cs(4974, 1884790000), denied: cs(33063, 7793705000), withdrawn: cs(29434, 12868490000), incomplete: cs(9612, 3021880000), purchased: cs(30150, 11321720000), preapprovalDenied: cs(80, 79810000), preapprovalApprovedNotAccepted: cs(308, 117240000) } },
    comparableTo2023: true,
  },
  "31084": {
    y2024: {
      actions: { originated: cs(95275, 63819805000), approvedNotAccepted: cs(7816, 3851510000), denied: cs(38225, 15867175000), withdrawn: cs(28397, 21025235000), incomplete: cs(11876, 4546190000), purchased: cs(17885, 11280045000), preapprovalDenied: cs(99, 71345000), preapprovalApprovedNotAccepted: cs(402, 285570000) },
      loanTypes: { conventional: cs(84422, 56852840000), fha: cs(8748, 5469090000), va: cs(2089, 1494005000), usda: cs(16, 3870000) },
      purposes: { purchase: cs(43093, 36672265000), homeImprovement: cs(10713, 2263335000), refinance: cs(12260, 11626380000), cashOutRefinance: cs(18638, 10288350000), other: cs(10435, 2785065000), notApplicable: cs(136, 184410000) },
    },
    y2023: { actions: { originated: cs(82682, 55130970000), approvedNotAccepted: cs(6176, 3231650000), denied: cs(35795, 14541905000), withdrawn: cs(24875, 17807375000), incomplete: cs(9049, 3777715000), purchased: cs(32549, 45883745000), preapprovalDenied: cs(60, 181990000), preapprovalApprovedNotAccepted: cs(240, 162410000) } },
    comparableTo2023: true,
  },
  "40140": {
    y2024: {
      actions: { originated: cs(81000, 31758470000), approvedNotAccepted: cs(6395, 2018525000), denied: cs(31857, 7933255000), withdrawn: cs(23572, 9289180000), incomplete: cs(9509, 2434705000), purchased: cs(19465, 8779385000), preapprovalDenied: cs(45, 18125000), preapprovalApprovedNotAccepted: cs(187, 84395000) },
      loanTypes: { conventional: cs(59006, 21056230000), fha: cs(15664, 7285240000), va: cs(6277, 3406035000), usda: cs(53, 10965000) },
      purposes: { purchase: cs(43185, 21054625000), homeImprovement: cs(7350, 896280000), refinance: cs(7735, 4245195000), cashOutRefinance: cs(14148, 4417310000), other: cs(8521, 1115995000), notApplicable: cs(61, 29065000) },
    },
    y2023: { actions: { originated: cs(69229, 26351945000), approvedNotAccepted: cs(4828, 1419920000), denied: cs(30027, 6954285000), withdrawn: cs(21837, 8351735000), incomplete: cs(7731, 1970275000), purchased: cs(18570, 14047810000), preapprovalDenied: cs(66, 26960000), preapprovalApprovedNotAccepted: cs(200, 86190000) } },
    comparableTo2023: true,
  },
  "35614": {
    y2024: {
      actions: { originated: cs(80859, 61025825000), approvedNotAccepted: cs(4746, 2679610000), denied: cs(34039, 17575985000), withdrawn: cs(23803, 19227265000), incomplete: cs(10779, 4976415000), purchased: cs(11131, 15297625000), preapprovalDenied: cs(55, 30215000), preapprovalApprovedNotAccepted: cs(347, 197795000) },
      loanTypes: { conventional: cs(74928, 57231160000), fha: cs(5179, 3343975000), va: cs(727, 449375000), usda: cs(25, 1315000) },
      purposes: { purchase: cs(50173, 36251525000), homeImprovement: cs(7150, 1806500000), refinance: cs(8078, 14496810000), cashOutRefinance: cs(9205, 6523835000), other: cs(6219, 1864145000), notApplicable: cs(34, 83010000) },
    },
    y2023: { actions: { originated: cs(76383, 55105715000), approvedNotAccepted: cs(4179, 2446005000), denied: cs(33188, 14594190000), withdrawn: cs(22000, 15187210000), incomplete: cs(9045, 4382195000), purchased: cs(24705, 22081145000), preapprovalDenied: cs(115, 45155000), preapprovalApprovedNotAccepted: cs(414, 162550000) } },
    comparableTo2023: true,
  },
  "16740": {
    y2024: {
      actions: { originated: cs(72336, 24990090000), approvedNotAccepted: cs(3909, 1110985000), denied: cs(22698, 5145340000), withdrawn: cs(16942, 6220050000), incomplete: cs(6869, 1577215000), purchased: cs(14359, 6081555000), preapprovalDenied: cs(160, 51080000), preapprovalApprovedNotAccepted: cs(230, 91270000) },
      loanTypes: { conventional: cs(58124, 20147520000), fha: cs(9444, 2935510000), va: cs(4606, 1865960000), usda: cs(162, 41100000) },
      purposes: { purchase: cs(40192, 16144180000), homeImprovement: cs(7245, 919515000), refinance: cs(8283, 3862185000), cashOutRefinance: cs(9135, 3013045000), other: cs(7468, 1048490000), notApplicable: cs(13, 2675000) },
    },
    y2023: { actions: { originated: cs(68178, 21858800000), approvedNotAccepted: cs(3295, 988845000), denied: cs(21971, 3952625000), withdrawn: cs(15992, 5132190000), incomplete: cs(6488, 1474440000), purchased: cs(12342, 4751800000), preapprovalDenied: cs(83, 28105000), preapprovalApprovedNotAccepted: cs(77, 26835000) } },
    comparableTo2023: true,
  },
  "19740": {
    y2024: {
      actions: { originated: cs(72222, 31188180000), approvedNotAccepted: cs(3881, 1321525000), denied: cs(21308, 5192770000), withdrawn: cs(19002, 8003620000), incomplete: cs(4906, 1362160000), purchased: cs(13500, 6879190000), preapprovalDenied: cs(45, 19675000), preapprovalApprovedNotAccepted: cs(232, 116030000) },
      loanTypes: { conventional: cs(59192, 24753220000), fha: cs(8930, 4137070000), va: cs(4067, 2295045000), usda: cs(33, 2845000) },
      purposes: { purchase: cs(40220, 21229810000), homeImprovement: cs(6857, 931015000), refinance: cs(7333, 4631645000), cashOutRefinance: cs(9004, 3117020000), other: cs(8798, 1274720000), notApplicable: cs(10, 3970000) },
    },
    y2023: { actions: { originated: cs(68848, 28373940000), approvedNotAccepted: cs(3547, 1250225000), denied: cs(20529, 4851325000), withdrawn: cs(18656, 7513580000), incomplete: cs(4763, 1339525000), purchased: cs(11702, 7200290000), preapprovalDenied: cs(176, 123940000), preapprovalApprovedNotAccepted: cs(160, 74560000) } },
    comparableTo2023: false,
  },
  "33460": {
    y2024: {
      actions: { originated: cs(77009, 22696675000), approvedNotAccepted: cs(3628, 725280000), denied: cs(16732, 3089920000), withdrawn: cs(14398, 4465550000), incomplete: cs(4207, 874305000), purchased: cs(13259, 4380795000), preapprovalDenied: cs(88, 25490000), preapprovalApprovedNotAccepted: cs(168, 53820000) },
      loanTypes: { conventional: cs(68132, 19667610000), fha: cs(5540, 1796780000), va: cs(3107, 1199835000), usda: cs(230, 32450000) },
      purposes: { purchase: cs(47051, 16613135000), homeImprovement: cs(8749, 838325000), refinance: cs(6928, 2440690000), cashOutRefinance: cs(6162, 1548430000), other: cs(8112, 1253340000), notApplicable: cs(7, 2755000) },
    },
    y2023: { actions: { originated: cs(72180, 20476050000), approvedNotAccepted: cs(3374, 646350000), denied: cs(15842, 2559700000), withdrawn: cs(13463, 4047065000), incomplete: cs(3848, 779740000), purchased: cs(12810, 4229710000), preapprovalDenied: cs(47, 11565000), preapprovalApprovedNotAccepted: cs(121, 39235000) } },
    comparableTo2023: true,
  },
  "36740": {
    y2024: {
      actions: { originated: cs(57357, 19869475000), approvedNotAccepted: cs(3689, 946675000), denied: cs(24703, 5666675000), withdrawn: cs(17142, 5914800000), incomplete: cs(6392, 1558360000), purchased: cs(15876, 5498440000), preapprovalDenied: cs(58, 16970000), preapprovalApprovedNotAccepted: cs(153, 58145000) },
      loanTypes: { conventional: cs(42389, 14300315000), fha: cs(10969, 3820425000), va: cs(3952, 1737860000), usda: cs(47, 10875000) },
      purposes: { purchase: cs(36841, 14682805000), homeImprovement: cs(4078, 477490000), refinance: cs(3806, 1913380000), cashOutRefinance: cs(7474, 2064820000), other: cs(5140, 723100000), notApplicable: cs(18, 7880000) },
    },
    y2023: { actions: { originated: cs(55748, 18511440000), approvedNotAccepted: cs(3235, 815755000), denied: cs(25731, 5466695000), withdrawn: cs(18281, 6150645000), incomplete: cs(6076, 1432210000), purchased: cs(15208, 6516400000), preapprovalDenied: cs(65, 74745000), preapprovalApprovedNotAccepted: cs(113, 35515000) } },
    comparableTo2023: true,
  },
  "45294": {
    y2024: {
      actions: { originated: cs(55628, 17688820000), approvedNotAccepted: cs(3383, 888265000), denied: cs(21727, 4530355000), withdrawn: cs(15729, 5346055000), incomplete: cs(6103, 1395995000), purchased: cs(15670, 5563490000), preapprovalDenied: cs(62, 19510000), preapprovalApprovedNotAccepted: cs(155, 55675000) },
      loanTypes: { conventional: cs(38029, 11465905000), fha: cs(11331, 3615605000), va: cs(6205, 2596605000), usda: cs(63, 10705000) },
      purposes: { purchase: cs(35031, 12992455000), homeImprovement: cs(4356, 484300000), refinance: cs(4265, 1830345000), cashOutRefinance: cs(6562, 1676780000), other: cs(5381, 693475000), notApplicable: cs(33, 11465000) },
    },
    comparableTo2023: false,
  },
  "11694": {
    y2024: {
      actions: { originated: cs(61262, 30646940000), approvedNotAccepted: cs(2743, 962025000), denied: cs(17494, 4748670000), withdrawn: cs(15593, 8202455000), incomplete: cs(6054, 1954960000), purchased: cs(13823, 9392785000), preapprovalDenied: cs(81, 43965000), preapprovalApprovedNotAccepted: cs(198, 115410000) },
      loanTypes: { conventional: cs(47704, 22882440000), fha: cs(4830, 2337770000), va: cs(8626, 5400040000), usda: cs(102, 26690000) },
      purposes: { purchase: cs(35261, 21213055000), homeImprovement: cs(6598, 949900000), refinance: cs(6468, 4833080000), cashOutRefinance: cs(6903, 2181655000), other: cs(6026, 1461750000), notApplicable: cs(6, 7500000) },
    },
    comparableTo2023: false,
  },
  "41180": {
    y2024: {
      actions: { originated: cs(61591, 14660775000), approvedNotAccepted: cs(2819, 601945000), denied: cs(15952, 2162210000), withdrawn: cs(12822, 3350200000), incomplete: cs(4880, 847200000), purchased: cs(14394, 3819130000), preapprovalDenied: cs(100, 21040000), preapprovalApprovedNotAccepted: cs(603, 161955000) },
      loanTypes: { conventional: cs(49505, 11584255000), fha: cs(7053, 1564475000), va: cs(4699, 1452085000), usda: cs(334, 59960000) },
      purposes: { purchase: cs(35109, 9694085000), homeImprovement: cs(5718, 486380000), refinance: cs(8467, 2518605000), cashOutRefinance: cs(6660, 1312380000), other: cs(5636, 649010000), notApplicable: cs(1, 315000) },
    },
    y2023: { actions: { originated: cs(55527, 12546865000), approvedNotAccepted: cs(2844, 559920000), denied: cs(15241, 1899785000), withdrawn: cs(11559, 2618875000), incomplete: cs(3839, 642735000), purchased: cs(11525, 2787115000), preapprovalDenied: cs(80, 16650000), preapprovalApprovedNotAccepted: cs(647, 158145000) } },
    comparableTo2023: true,
  },
  "41700": {
    y2024: {
      actions: { originated: cs(51484, 16163920000), approvedNotAccepted: cs(3147, 835045000), denied: cs(17733, 3480135000), withdrawn: cs(14749, 4690665000), incomplete: cs(5640, 1073180000), purchased: cs(19512, 6331920000), preapprovalDenied: cs(61, 16955000), preapprovalApprovedNotAccepted: cs(192, 62120000) },
      loanTypes: { conventional: cs(28468, 8372010000), fha: cs(11787, 3487635000), va: cs(10960, 4245130000), usda: cs(269, 59145000) },
      purposes: { purchase: cs(36732, 12200400000), homeImprovement: cs(1463, 162435000), refinance: cs(4175, 1866705000), cashOutRefinance: cs(6603, 1590415000), other: cs(2499, 340965000), notApplicable: cs(12, 3000000) },
    },
    y2023: { actions: { originated: cs(48936, 15119110000), approvedNotAccepted: cs(2950, 746200000), denied: cs(18943, 3471935000), withdrawn: cs(15662, 4877190000), incomplete: cs(5470, 1043750000), purchased: cs(18028, 5520550000), preapprovalDenied: cs(43, 10135000), preapprovalApprovedNotAccepted: cs(92, 29420000) } },
    comparableTo2023: true,
  },
  "12580": {
    y2024: {
      actions: { originated: cs(53241, 17896235000), approvedNotAccepted: cs(2565, 658325000), denied: cs(17764, 3843660000), withdrawn: cs(13796, 4330260000), incomplete: cs(4487, 1151075000), purchased: cs(13295, 5317605000), preapprovalDenied: cs(44, 14820000), preapprovalApprovedNotAccepted: cs(141, 55375000) },
      loanTypes: { conventional: cs(40781, 12999355000), fha: cs(7453, 2532685000), va: cs(4957, 2353655000), usda: cs(50, 10540000) },
      purposes: { purchase: cs(30255, 12368715000), homeImprovement: cs(4854, 562840000), refinance: cs(5794, 2582790000), cashOutRefinance: cs(7585, 1828835000), other: cs(4747, 551775000), notApplicable: cs(6, 1280000) },
    },
    y2023: { actions: { originated: cs(47815, 14848275000), approvedNotAccepted: cs(2048, 509190000), denied: cs(16982, 3069250000), withdrawn: cs(12888, 3928040000), incomplete: cs(3783, 945745000), purchased: cs(12085, 4326575000), preapprovalDenied: cs(51, 18915000), preapprovalApprovedNotAccepted: cs(75, 22635000) } },
    comparableTo2023: true,
  },
  "26900": {
    y2024: {
      actions: { originated: cs(56021, 15003995000), approvedNotAccepted: cs(2336, 507540000), denied: cs(16066, 2727640000), withdrawn: cs(12702, 3566640000), incomplete: cs(3835, 745585000), purchased: cs(13323, 3758445000), preapprovalDenied: cs(50, 11070000), preapprovalApprovedNotAccepted: cs(177, 51695000) },
      loanTypes: { conventional: cs(43811, 11642805000), fha: cs(8636, 2234000000), va: cs(3425, 1096985000), usda: cs(149, 30205000) },
      purposes: { purchase: cs(31289, 10077075000), homeImprovement: cs(5361, 583225000), refinance: cs(6265, 2141265000), cashOutRefinance: cs(7597, 1540375000), other: cs(5336, 628490000), notApplicable: cs(173, 33565000) },
    },
    y2023: { actions: { originated: cs(51205, 13599955000), approvedNotAccepted: cs(2087, 454735000), denied: cs(14951, 2716715000), withdrawn: cs(11926, 2991410000), incomplete: cs(3719, 666325000), purchased: cs(10589, 2820425000), preapprovalDenied: cs(43, 11175000), preapprovalApprovedNotAccepted: cs(87, 20755000) } },
    comparableTo2023: false,
  },
  "47664": {
    y2024: {
      actions: { originated: cs(58270, 14095230000), approvedNotAccepted: cs(3230, 556810000), denied: cs(18066, 2813550000), withdrawn: cs(12077, 3012595000), incomplete: cs(4632, 808520000), purchased: cs(6653, 1821455000), preapprovalDenied: cs(33, 7275000), preapprovalApprovedNotAccepted: cs(320, 98300000) },
      loanTypes: { conventional: cs(51506, 12268560000), fha: cs(4565, 1119225000), va: cs(2113, 690025000), usda: cs(86, 17420000) },
      purposes: { purchase: cs(29291, 8847475000), homeImprovement: cs(6625, 634015000), refinance: cs(7380, 2187180000), cashOutRefinance: cs(8105, 1641835000), other: cs(6851, 779945000), notApplicable: cs(18, 4780000) },
    },
    y2023: { actions: { originated: cs(52511, 11657985000), approvedNotAccepted: cs(3067, 484975000), denied: cs(17070, 2348350000), withdrawn: cs(11082, 2732760000), incomplete: cs(4046, 915610000), purchased: cs(5927, 1895625000), preapprovalDenied: cs(68, 14070000), preapprovalApprovedNotAccepted: cs(307, 79585000) } },
    comparableTo2023: true,
  },
  "29820": {
    y2024: {
      actions: { originated: cs(49266, 18223330000), approvedNotAccepted: cs(2626, 935190000), denied: cs(17181, 4223405000), withdrawn: cs(13715, 4988875000), incomplete: cs(4045, 968375000), purchased: cs(13197, 5229995000), preapprovalDenied: cs(111, 39975000), preapprovalApprovedNotAccepted: cs(226, 84090000) },
      loanTypes: { conventional: cs(34910, 12500620000), fha: cs(8935, 3277885000), va: cs(5360, 2442810000), usda: cs(61, 2015000) },
      purposes: { purchase: cs(30760, 12899550000), homeImprovement: cs(3113, 343775000), refinance: cs(4342, 2715380000), cashOutRefinance: cs(6070, 1645670000), other: cs(4919, 598185000), notApplicable: cs(62, 20770000) },
    },
    y2023: { actions: { originated: cs(42171, 14198405000), approvedNotAccepted: cs(2161, 719515000), denied: cs(16121, 3439025000), withdrawn: cs(12001, 4376995000), incomplete: cs(3800, 947030000), purchased: cs(11341, 5082345000), preapprovalDenied: cs(85, 29485000), preapprovalApprovedNotAccepted: cs(200, 71470000) } },
    comparableTo2023: false,
  },
  "34980": {
    y2024: {
      actions: { originated: cs(53250, 20727020000), approvedNotAccepted: cs(3577, 1038925000), denied: cs(14372, 3603160000), withdrawn: cs(12585, 5143505000), incomplete: cs(4192, 1149480000), purchased: cs(12090, 5032450000), preapprovalDenied: cs(48, 17170000), preapprovalApprovedNotAccepted: cs(136, 56040000) },
      loanTypes: { conventional: cs(41527, 16175845000), fha: cs(7938, 2911740000), va: cs(3478, 1591390000), usda: cs(307, 48045000) },
      purposes: { purchase: cs(30690, 14331010000), homeImprovement: cs(4224, 666640000), refinance: cs(6316, 2920360000), cashOutRefinance: cs(6729, 1937635000), other: cs(5285, 869165000), notApplicable: cs(6, 2210000) },
    },
    y2023: { actions: { originated: cs(51145, 18755945000), approvedNotAccepted: cs(2668, 738260000), denied: cs(14496, 3308770000), withdrawn: cs(12221, 5019055000), incomplete: cs(3823, 982875000), purchased: cs(11043, 4552825000), preapprovalDenied: cs(34, 10300000), preapprovalApprovedNotAccepted: cs(98, 31360000) } },
    comparableTo2023: true,
  },
  "17140": {
    y2024: {
      actions: { originated: cs(53175, 12849035000), approvedNotAccepted: cs(2638, 479060000), denied: cs(15657, 2218155000), withdrawn: cs(12204, 3007400000), incomplete: cs(3887, 664745000), purchased: cs(10404, 2818100000), preapprovalDenied: cs(37, 9925000), preapprovalApprovedNotAccepted: cs(129, 39345000) },
      loanTypes: { conventional: cs(43611, 10341505000), fha: cs(6509, 1569505000), va: cs(2855, 894775000), usda: cs(200, 43250000) },
      purposes: { purchase: cs(27391, 8355445000), homeImprovement: cs(5657, 549295000), refinance: cs(5859, 1788525000), cashOutRefinance: cs(7301, 1438365000), other: cs(6773, 680325000), notApplicable: cs(194, 37080000) },
    },
    y2023: { actions: { originated: cs(48146, 10992660000), approvedNotAccepted: cs(2054, 390480000), denied: cs(14446, 1943030000), withdrawn: cs(11018, 2770370000), incomplete: cs(3480, 570570000), purchased: cs(8547, 2148415000), preapprovalDenied: cs(30, 5570000), preapprovalApprovedNotAccepted: cs(40, 9750000) } },
    comparableTo2023: true,
  },
  "12420": {
    y2024: {
      actions: { originated: cs(46741, 21564175000), approvedNotAccepted: cs(2577, 953275000), denied: cs(12793, 3539425000), withdrawn: cs(12331, 5960975000), incomplete: cs(4407, 1305375000), purchased: cs(16738, 6852040000), preapprovalDenied: cs(42, 19590000), preapprovalApprovedNotAccepted: cs(173, 79945000) },
      loanTypes: { conventional: cs(36364, 17649100000), fha: cs(6877, 2397635000), va: cs(3212, 1450710000), usda: cs(288, 66730000) },
      purposes: { purchase: cs(35264, 15791950000), homeImprovement: cs(1702, 281700000), refinance: cs(3297, 2987265000), cashOutRefinance: cs(4294, 1909670000), other: cs(2138, 571830000), notApplicable: cs(46, 21760000) },
    },
    y2023: { actions: { originated: cs(46429, 21164235000), approvedNotAccepted: cs(2979, 1214055000), denied: cs(15214, 3877990000), withdrawn: cs(14783, 6854465000), incomplete: cs(5167, 1729045000), purchased: cs(16840, 6966280000), preapprovalDenied: cs(44, 19110000), preapprovalApprovedNotAccepted: cs(78, 29590000) } },
    comparableTo2023: false,
  },
  "23104": {
    y2024: {
      actions: { originated: cs(45383, 16494755000), approvedNotAccepted: cs(2230, 678150000), denied: cs(15090, 3568060000), withdrawn: cs(11896, 4384980000), incomplete: cs(4322, 1016020000), purchased: cs(14680, 4844990000), preapprovalDenied: cs(81, 25265000), preapprovalApprovedNotAccepted: cs(210, 66790000) },
      loanTypes: { conventional: cs(31610, 11605550000), fha: cs(9163, 2984975000), va: cs(4524, 1892060000), usda: cs(86, 12170000) },
      purposes: { purchase: cs(31893, 11867365000), homeImprovement: cs(2592, 438490000), refinance: cs(3793, 1937985000), cashOutRefinance: cs(4805, 1973255000), other: cs(2282, 273150000), notApplicable: cs(18, 4510000) },
    },
    y2023: { actions: { originated: cs(43246, 14758350000), approvedNotAccepted: cs(1893, 589775000), denied: cs(15649, 3184965000), withdrawn: cs(12387, 4120285000), incomplete: cs(3974, 891850000), purchased: cs(13898, 4381130000), preapprovalDenied: cs(55, 16825000), preapprovalApprovedNotAccepted: cs(133, 41485000) } },
    comparableTo2023: true,
  },
  "18140": {
    y2024: {
      actions: { originated: cs(49971, 14761955000), approvedNotAccepted: cs(2582, 776280000), denied: cs(15279, 2670865000), withdrawn: cs(12338, 3888410000), incomplete: cs(3629, 787395000), purchased: cs(9644, 3038080000), preapprovalDenied: cs(22, 6020000), preapprovalApprovedNotAccepted: cs(136, 45050000) },
      loanTypes: { conventional: cs(41835, 12144005000), fha: cs(5433, 1697915000), va: cs(2605, 893945000), usda: cs(98, 26090000) },
      purposes: { purchase: cs(26179, 9235465000), homeImprovement: cs(5778, 661580000), refinance: cs(6074, 2628750000), cashOutRefinance: cs(6441, 1564825000), other: cs(5411, 656105000), notApplicable: cs(88, 15230000) },
    },
    y2023: { actions: { originated: cs(46471, 13003305000), approvedNotAccepted: cs(2352, 531710000), denied: cs(14260, 2179800000), withdrawn: cs(11099, 2968675000), incomplete: cs(3414, 664410000), purchased: cs(7676, 2254220000), preapprovalDenied: cs(30, 7070000), preapprovalApprovedNotAccepted: cs(55, 15545000) } },
    comparableTo2023: true,
  },
  "29484": {
    y2024: {
      actions: { originated: cs(46134, 17577580000), approvedNotAccepted: cs(2692, 835410000), denied: cs(16226, 3940370000), withdrawn: cs(12641, 5390885000), incomplete: cs(5797, 1833985000), purchased: cs(9705, 4464925000), preapprovalDenied: cs(21, 8315000), preapprovalApprovedNotAccepted: cs(128, 61390000) },
      loanTypes: { conventional: cs(41028, 15327400000), fha: cs(3996, 1753590000), va: cs(1052, 492660000), usda: cs(58, 3930000) },
      purposes: { purchase: cs(22811, 11248845000), homeImprovement: cs(5438, 877820000), refinance: cs(5630, 2456800000), cashOutRefinance: cs(6325, 2036095000), other: cs(5907, 948145000), notApplicable: cs(23, 9875000) },
    },
    comparableTo2023: false,
  },
  "41740": {
    y2024: {
      actions: { originated: cs(46852, 30412530000), approvedNotAccepted: cs(3453, 1584995000), denied: cs(16515, 6150455000), withdrawn: cs(13709, 8304145000), incomplete: cs(4888, 1823520000), purchased: cs(7184, 4511100000), preapprovalDenied: cs(71, 48175000), preapprovalApprovedNotAccepted: cs(187, 137585000) },
      loanTypes: { conventional: cs(38720, 24613360000), fha: cs(3160, 1989260000), va: cs(4957, 3807495000), usda: cs(15, 2415000) },
      purposes: { purchase: cs(21968, 20006890000), homeImprovement: cs(6353, 1211455000), refinance: cs(6343, 4853525000), cashOutRefinance: cs(7581, 3216795000), other: cs(4560, 1081910000), notApplicable: cs(47, 41955000) },
    },
    y2023: { actions: { originated: cs(39347, 22120315000), approvedNotAccepted: cs(2436, 1095790000), denied: cs(15539, 5225195000), withdrawn: cs(12008, 7360140000), incomplete: cs(3970, 1430750000), purchased: cs(10844, 11001670000), preapprovalDenied: cs(38, 110580000), preapprovalApprovedNotAccepted: cs(113, 68305000) } },
    comparableTo2023: true,
  },
  "28140": {
    y2024: {
      actions: { originated: cs(50097, 13898785000), approvedNotAccepted: cs(1973, 398195000), denied: cs(12320, 1905530000), withdrawn: cs(11220, 3168520000), incomplete: cs(3139, 578915000), purchased: cs(10766, 3062520000), preapprovalDenied: cs(111, 26365000), preapprovalApprovedNotAccepted: cs(151, 47785000) },
      loanTypes: { conventional: cs(40048, 11059910000), fha: cs(6197, 1571415000), va: cs(3611, 1219335000), usda: cs(241, 48125000) },
      purposes: { purchase: cs(28946, 9356520000), homeImprovement: cs(4733, 487345000), refinance: cs(6185, 1883295000), cashOutRefinance: cs(5861, 1640745000), other: cs(4364, 529220000), notApplicable: cs(8, 1660000) },
    },
    y2023: { actions: { originated: cs(44526, 12315610000), approvedNotAccepted: cs(1615, 347755000), denied: cs(11182, 1579520000), withdrawn: cs(10031, 2599095000), incomplete: cs(3039, 529905000), purchased: cs(8620, 2288330000), preapprovalDenied: cs(56, 13940000), preapprovalApprovedNotAccepted: cs(116, 30260000) } },
    comparableTo2023: true,
  },
  "27260": {
    y2024: {
      actions: { originated: cs(41092, 13216640000), approvedNotAccepted: cs(2414, 684880000), denied: cs(14852, 2993770000), withdrawn: cs(12376, 3904250000), incomplete: cs(4315, 983625000), purchased: cs(12298, 3867610000), preapprovalDenied: cs(48, 15270000), preapprovalApprovedNotAccepted: cs(166, 58320000) },
      loanTypes: { conventional: cs(27173, 8423325000), fha: cs(7014, 2119980000), va: cs(6835, 2662265000), usda: cs(70, 11070000) },
      purposes: { purchase: cs(25850, 9361800000), homeImprovement: cs(2572, 365380000), refinance: cs(3002, 1369430000), cashOutRefinance: cs(6557, 1724325000), other: cs(3095, 390635000), notApplicable: cs(16, 5070000) },
    },
    y2023: { actions: { originated: cs(40008, 12395430000), approvedNotAccepted: cs(2206, 805970000), denied: cs(15986, 3119680000), withdrawn: cs(12683, 3848215000), incomplete: cs(3714, 847770000), purchased: cs(12480, 3941160000), preapprovalDenied: cs(78, 22310000), preapprovalApprovedNotAccepted: cs(175, 51365000) } },
    comparableTo2023: true,
  },
  "17410": {
    y2024: {
      actions: { originated: cs(45649, 9571555000), approvedNotAccepted: cs(2250, 347450000), denied: cs(16098, 2230500000), withdrawn: cs(11022, 2164840000), incomplete: cs(3180, 489370000), purchased: cs(8001, 1778785000), preapprovalDenied: cs(15, 2245000), preapprovalApprovedNotAccepted: cs(112, 26330000) },
      loanTypes: { conventional: cs(38167, 7868675000), fha: cs(5270, 1103640000), va: cs(2155, 589715000), usda: cs(57, 9525000) },
      purposes: { purchase: cs(23232, 5818350000), homeImprovement: cs(5588, 528160000), refinance: cs(5745, 1290325000), cashOutRefinance: cs(5755, 1312575000), other: cs(5289, 600975000), notApplicable: cs(40, 21170000) },
    },
    comparableTo2023: false,
  },
  "47260": {
    y2024: {
      actions: { originated: cs(44621, 13379695000), approvedNotAccepted: cs(2145, 541755000), denied: cs(12435, 2263525000), withdrawn: cs(11831, 3478515000), incomplete: cs(4374, 1052920000), purchased: cs(10665, 12076615000), preapprovalDenied: cs(41, 12585000), preapprovalApprovedNotAccepted: cs(88, 30390000) },
      loanTypes: { conventional: cs(25138, 6427390000), fha: cs(5174, 1535820000), va: cs(14277, 5409865000), usda: cs(32, 6620000) },
      purposes: { purchase: cs(24291, 8425825000), homeImprovement: cs(4608, 423130000), refinance: cs(5799, 2291255000), cashOutRefinance: cs(5244, 1756790000), other: cs(4678, 482250000), notApplicable: cs(1, 445000) },
    },
    y2023: { actions: { originated: cs(39196, 11269700000), approvedNotAccepted: cs(1491, 340025000), denied: cs(12281, 2049425000), withdrawn: cs(11044, 3151990000), incomplete: cs(3333, 670205000), purchased: cs(10557, 3508225000), preapprovalDenied: cs(20, 5180000), preapprovalApprovedNotAccepted: cs(39, 11045000) } },
    comparableTo2023: false,
  },
  "38900": {
    y2024: {
      actions: { originated: cs(46998, 18049600000), approvedNotAccepted: cs(3273, 939795000), denied: cs(12520, 2852990000), withdrawn: cs(10861, 4799205000), incomplete: cs(3198, 873550000), purchased: cs(7601, 3393745000), preapprovalDenied: cs(45, 17845000), preapprovalApprovedNotAccepted: cs(223, 99985000) },
      loanTypes: { conventional: cs(40117, 14867475000), fha: cs(4594, 2028590000), va: cs(2261, 1146065000), usda: cs(26, 7470000) },
      purposes: { purchase: cs(25518, 12504020000), homeImprovement: cs(6376, 707070000), refinance: cs(5302, 2685250000), cashOutRefinance: cs(4586, 1464860000), other: cs(5211, 665695000), notApplicable: cs(5, 22705000) },
    },
    y2023: { actions: { originated: cs(43506, 15597210000), approvedNotAccepted: cs(2743, 763515000), denied: cs(12261, 2638825000), withdrawn: cs(10168, 4084860000), incomplete: cs(2936, 744660000), purchased: cs(8251, 4621775000), preapprovalDenied: cs(40, 14800000), preapprovalApprovedNotAccepted: cs(212, 96340000) } },
    comparableTo2023: true,
  },
  "38300": {
    y2024: {
      actions: { originated: cs(46804, 9320840000), approvedNotAccepted: cs(2124, 326870000), denied: cs(14430, 1823670000), withdrawn: cs(8979, 1940545000), incomplete: cs(3323, 508125000), purchased: cs(7835, 2033495000), preapprovalDenied: cs(22, 4240000), preapprovalApprovedNotAccepted: cs(137, 38645000) },
      loanTypes: { conventional: cs(40244, 7890420000), fha: cs(4361, 861705000), va: cs(1890, 522550000), usda: cs(309, 46165000) },
      purposes: { purchase: cs(22698, 6016530000), homeImprovement: cs(7232, 679390000), refinance: cs(6952, 1293710000), cashOutRefinance: cs(4180, 815080000), other: cs(5738, 515480000), notApplicable: cs(4, 650000) },
    },
    y2023: { actions: { originated: cs(44649, 8351265000), approvedNotAccepted: cs(1862, 288970000), denied: cs(13867, 1935085000), withdrawn: cs(8161, 1756305000), incomplete: cs(3173, 472425000), purchased: cs(7160, 1760810000), preapprovalDenied: cs(10, 1900000), preapprovalApprovedNotAccepted: cs(19, 4095000) } },
    comparableTo2023: true,
  },
  "33124": {
    y2024: {
      actions: { originated: cs(33871, 18042165000), approvedNotAccepted: cs(2908, 1038170000), denied: cs(20868, 6858810000), withdrawn: cs(11709, 6283545000), incomplete: cs(5663, 1809625000), purchased: cs(7593, 4704125000), preapprovalDenied: cs(18, 6980000), preapprovalApprovedNotAccepted: cs(63, 31435000) },
      loanTypes: { conventional: cs(28370, 15424420000), fha: cs(4745, 2229575000), va: cs(737, 387745000), usda: cs(19, 425000) },
      purposes: { purchase: cs(19558, 11768330000), homeImprovement: cs(2871, 533695000), refinance: cs(2605, 2616345000), cashOutRefinance: cs(5894, 2249000000), other: cs(2916, 859030000), notApplicable: cs(27, 15765000) },
    },
    y2023: { actions: { originated: cs(31889, 16003745000), approvedNotAccepted: cs(2428, 994210000), denied: cs(20528, 6822050000), withdrawn: cs(11358, 5767640000), incomplete: cs(4543, 1553675000), purchased: cs(9165, 6050005000), preapprovalDenied: cs(33, 11285000), preapprovalApprovedNotAccepted: cs(50, 21880000) } },
    comparableTo2023: true,
  },
  "40900": {
    y2024: {
      actions: { originated: cs(42980, 17639600000), approvedNotAccepted: cs(2588, 783570000), denied: cs(12833, 3339685000), withdrawn: cs(10724, 4420980000), incomplete: cs(3760, 1008640000), purchased: cs(8621, 3978805000), preapprovalDenied: cs(24, 76950000), preapprovalApprovedNotAccepted: cs(239, 116935000) },
      loanTypes: { conventional: cs(36302, 14339600000), fha: cs(4585, 2170165000), va: cs(2074, 1127450000), usda: cs(19, 2385000) },
      purposes: { purchase: cs(24086, 12242860000), homeImprovement: cs(4565, 545225000), refinance: cs(4229, 2667715000), cashOutRefinance: cs(5914, 1595520000), other: cs(4165, 579495000), notApplicable: cs(21, 8785000) },
    },
    y2023: { actions: { originated: cs(35944, 14030220000), approvedNotAccepted: cs(1945, 672305000), denied: cs(11777, 2769085000), withdrawn: cs(9755, 3994435000), incomplete: cs(3090, 850290000), purchased: cs(7731, 4454695000), preapprovalDenied: cs(24, 12220000), preapprovalApprovedNotAccepted: cs(191, 90435000) } },
    comparableTo2023: true,
  },
  "35004": {
    y2024: {
      actions: { originated: cs(40757, 19631155000), approvedNotAccepted: cs(1863, 937755000), denied: cs(17017, 5027835000), withdrawn: cs(8739, 4415545000), incomplete: cs(4470, 1699710000), purchased: cs(6999, 7670015000), preapprovalDenied: cs(40, 19320000), preapprovalApprovedNotAccepted: cs(202, 114750000) },
      loanTypes: { conventional: cs(36277, 17133095000), fha: cs(3901, 2169295000), va: cs(560, 328170000), usda: cs(19, 595000) },
      purposes: { purchase: cs(21400, 13462730000), homeImprovement: cs(5337, 1016245000), refinance: cs(4100, 2039960000), cashOutRefinance: cs(5544, 2094180000), other: cs(4375, 1017535000), notApplicable: cs(1, 505000) },
    },
    y2023: { actions: { originated: cs(38172, 17626040000), approvedNotAccepted: cs(1918, 924550000), denied: cs(16637, 4616625000), withdrawn: cs(8279, 4186485000), incomplete: cs(4010, 1443960000), purchased: cs(9193, 7157825000), preapprovalDenied: cs(55, 26965000), preapprovalApprovedNotAccepted: cs(151, 76665000) } },
    comparableTo2023: true,
  },
  "22744": {
    y2024: {
      actions: { originated: cs(31825, 14462575000), approvedNotAccepted: cs(2584, 748660000), denied: cs(19048, 5068750000), withdrawn: cs(11481, 4438235000), incomplete: cs(4871, 1575315000), purchased: cs(7229, 3276585000), preapprovalDenied: cs(46, 16550000), preapprovalApprovedNotAccepted: cs(108, 48470000) },
      loanTypes: { conventional: cs(26259, 12029835000), fha: cs(4382, 1843250000), va: cs(1157, 588945000), usda: cs(27, 545000) },
      purposes: { purchase: cs(18707, 9800525000), homeImprovement: cs(2895, 399055000), refinance: cs(2235, 1784855000), cashOutRefinance: cs(5028, 1875140000), other: cs(2946, 595230000), notApplicable: cs(14, 7770000) },
    },
    y2023: { actions: { originated: cs(30925, 11843855000), approvedNotAccepted: cs(2308, 602270000), denied: cs(19115, 4619285000), withdrawn: cs(11423, 4324835000), incomplete: cs(4326, 1108510000), purchased: cs(7801, 5365035000), preapprovalDenied: cs(43, 12055000), preapprovalApprovedNotAccepted: cs(72, 29300000) } },
    comparableTo2023: true,
  },
  "33874": {
    y2024: {
      actions: { originated: cs(41543, 13760155000), approvedNotAccepted: cs(1944, 483620000), denied: cs(11973, 2400735000), withdrawn: cs(8394, 2843100000), incomplete: cs(3602, 852180000), purchased: cs(7442, 2979620000), preapprovalDenied: cs(17, 7995000), preapprovalApprovedNotAccepted: cs(89, 39605000) },
      loanTypes: { conventional: cs(37982, 12455020000), fha: cs(2465, 834655000), va: cs(1043, 466375000), usda: cs(53, 4105000) },
      purposes: { purchase: cs(18916, 8619640000), homeImprovement: cs(6867, 913455000), refinance: cs(5359, 1887805000), cashOutRefinance: cs(5292, 1271670000), other: cs(5104, 1066490000), notApplicable: cs(5, 1095000) },
    },
    y2023: { actions: { originated: cs(39860, 11602930000), approvedNotAccepted: cs(1737, 436545000), denied: cs(11968, 2154060000), withdrawn: cs(7932, 2435730000), incomplete: cs(3426, 787540000), purchased: cs(6190, 2359210000), preapprovalDenied: cs(13, 4775000), preapprovalApprovedNotAccepted: cs(27, 10065000) } },
    comparableTo2023: true,
  },
  "11244": {
    y2024: {
      actions: { originated: cs(39229, 27557545000), approvedNotAccepted: cs(2609, 1390365000), denied: cs(12452, 5758350000), withdrawn: cs(10203, 7325305000), incomplete: cs(4206, 1780970000), purchased: cs(5505, 5304345000), preapprovalDenied: cs(9, 4775000), preapprovalApprovedNotAccepted: cs(116, 98090000) },
      loanTypes: { conventional: cs(36968, 25893620000), fha: cs(1598, 1079650000), va: cs(663, 584275000), usda: cs(0, 0) },
      purposes: { purchase: cs(16522, 15789450000), homeImprovement: cs(5052, 1038680000), refinance: cs(5370, 4736120000), cashOutRefinance: cs(7529, 4481905000), other: cs(4728, 1445270000), notApplicable: cs(28, 66120000) },
    },
    y2023: { actions: { originated: cs(33072, 21067250000), approvedNotAccepted: cs(1890, 1010980000), denied: cs(11444, 4483030000), withdrawn: cs(8889, 6158155000), incomplete: cs(3196, 1329090000), purchased: cs(8328, 12226530000), preapprovalDenied: cs(25, 18195000), preapprovalApprovedNotAccepted: cs(60, 55200000) } },
    comparableTo2023: true,
  },
  "39580": {
    y2024: {
      actions: { originated: cs(39874, 13801000000), approvedNotAccepted: cs(2061, 557355000), denied: cs(10542, 2175510000), withdrawn: cs(8723, 3156445000), incomplete: cs(3435, 868985000), purchased: cs(9041, 4597545000), preapprovalDenied: cs(30, 11100000), preapprovalApprovedNotAccepted: cs(97, 41045000) },
      loanTypes: { conventional: cs(33427, 11378005000), fha: cs(3678, 1258200000), va: cs(2583, 1107025000), usda: cs(186, 57770000) },
      purposes: { purchase: cs(23241, 9530025000), homeImprovement: cs(4412, 575240000), refinance: cs(4828, 2130430000), cashOutRefinance: cs(3476, 1018810000), other: cs(3915, 513195000), notApplicable: cs(2, 33300000) },
    },
    y2023: { actions: { originated: cs(38764, 12691140000), approvedNotAccepted: cs(1742, 491510000), denied: cs(10535, 2064995000), withdrawn: cs(9537, 3370625000), incomplete: cs(3547, 953515000), purchased: cs(6869, 2529585000), preapprovalDenied: cs(27, 9325000), preapprovalApprovedNotAccepted: cs(39, 16295000) } },
    comparableTo2023: true,
  },
  "35084": {
    y2024: {
      actions: { originated: cs(33516, 14782250000), approvedNotAccepted: cs(2141, 726335000), denied: cs(13019, 3641035000), withdrawn: cs(10470, 5192080000), incomplete: cs(4281, 1468385000), purchased: cs(7749, 5604275000), preapprovalDenied: cs(16, 6060000), preapprovalApprovedNotAccepted: cs(107, 52665000) },
      loanTypes: { conventional: cs(28939, 12583205000), fha: cs(3880, 1855590000), va: cs(675, 342285000), usda: cs(22, 1170000) },
      purposes: { purchase: cs(16840, 9431840000), homeImprovement: cs(4202, 733340000), refinance: cs(4268, 2439710000), cashOutRefinance: cs(4660, 1582070000), other: cs(3520, 584110000), notApplicable: cs(26, 11180000) },
    },
    y2023: { actions: { originated: cs(31734, 13121950000), approvedNotAccepted: cs(1773, 686315000), denied: cs(13115, 3153625000), withdrawn: cs(10543, 4423815000), incomplete: cs(3933, 1233275000), purchased: cs(7997, 3586735000), preapprovalDenied: cs(33, 13145000), preapprovalApprovedNotAccepted: cs(52, 20900000) } },
    comparableTo2023: true,
  },
  "36084": {
    y2024: {
      actions: { originated: cs(37132, 24769800000), approvedNotAccepted: cs(2369, 1068445000), denied: cs(11386, 4448690000), withdrawn: cs(9801, 6674285000), incomplete: cs(3977, 1593515000), purchased: cs(5853, 3708505000), preapprovalDenied: cs(29, 21625000), preapprovalApprovedNotAccepted: cs(181, 129405000) },
      loanTypes: { conventional: cs(34360, 22896660000), fha: cs(2101, 1384375000), va: cs(649, 488225000), usda: cs(22, 540000) },
      purposes: { purchase: cs(19508, 16339830000), homeImprovement: cs(3903, 812345000), refinance: cs(5941, 5049195000), cashOutRefinance: cs(4171, 1735925000), other: cs(3592, 823840000), notApplicable: cs(17, 8665000) },
    },
    y2023: { actions: { originated: cs(31763, 19536605000), approvedNotAccepted: cs(1875, 895475000), denied: cs(10739, 3851315000), withdrawn: cs(8823, 5709525000), incomplete: cs(3051, 1308925000), purchased: cs(16184, 12448610000), preapprovalDenied: cs(55, 34635000), preapprovalApprovedNotAccepted: cs(136, 90460000) } },
    comparableTo2023: false,
  },
  "37964": {
    y2024: {
      actions: { originated: cs(34048, 9446580000), approvedNotAccepted: cs(1697, 393425000), denied: cs(14620, 2377740000), withdrawn: cs(9353, 2472185000), incomplete: cs(3292, 602670000), purchased: cs(6252, 1770690000), preapprovalDenied: cs(17, 4605000), preapprovalApprovedNotAccepted: cs(56, 16740000) },
      loanTypes: { conventional: cs(28883, 8158305000), fha: cs(4156, 987500000), va: cs(957, 298585000), usda: cs(52, 2190000) },
      purposes: { purchase: cs(18346, 5984780000), homeImprovement: cs(4194, 425000000), refinance: cs(3496, 1750830000), cashOutRefinance: cs(5375, 993605000), other: cs(2629, 290505000), notApplicable: cs(8, 1860000) },
    },
    y2023: { actions: { originated: cs(32563, 8335355000), approvedNotAccepted: cs(1656, 420290000), denied: cs(14828, 3751650000), withdrawn: cs(8890, 2809650000), incomplete: cs(3217, 571205000), purchased: cs(5710, 1585500000), preapprovalDenied: cs(11, 3115000), preapprovalApprovedNotAccepted: cs(15, 3725000) } },
    comparableTo2023: true,
  },
  "15764": {
    y2024: {
      actions: { originated: cs(38700, 19398660000), approvedNotAccepted: cs(1334, 576880000), denied: cs(10752, 3150930000), withdrawn: cs(7782, 3969380000), incomplete: cs(3276, 1105080000), purchased: cs(6792, 4514940000), preapprovalDenied: cs(38, 20290000), preapprovalApprovedNotAccepted: cs(118, 76660000) },
      loanTypes: { conventional: cs(36106, 17947690000), fha: cs(2002, 1099830000), va: cs(583, 350855000), usda: cs(9, 285000) },
      purposes: { purchase: cs(19967, 13053095000), homeImprovement: cs(5450, 1105140000), refinance: cs(5828, 3140310000), cashOutRefinance: cs(3692, 1342630000), other: cs(3763, 757485000), notApplicable: cs(0, 0) },
    },
    y2023: { actions: { originated: cs(35465, 16837185000), approvedNotAccepted: cs(1193, 536095000), denied: cs(9946, 2698030000), withdrawn: cs(7003, 3717195000), incomplete: cs(3156, 1063650000), purchased: cs(8670, 5848370000), preapprovalDenied: cs(43, 23215000), preapprovalApprovedNotAccepted: cs(43, 26385000) } },
    comparableTo2023: true,
  },
  "31924": {
    y2024: {
      actions: { originated: cs(34015, 11264445000), approvedNotAccepted: cs(1680, 507870000), denied: cs(10773, 2152655000), withdrawn: cs(8939, 2985705000), incomplete: cs(3131, 735265000), purchased: cs(8621, 9787125000), preapprovalDenied: cs(27, 9755000), preapprovalApprovedNotAccepted: cs(87, 34965000) },
      loanTypes: { conventional: cs(26198, 8361540000), fha: cs(5360, 1882470000), va: cs(2373, 997915000), usda: cs(84, 22520000) },
      purposes: { purchase: cs(18803, 7562665000), homeImprovement: cs(3125, 340765000), refinance: cs(3187, 1583045000), cashOutRefinance: cs(5143, 1348385000), other: cs(3754, 428840000), notApplicable: cs(3, 745000) },
    },
    comparableTo2023: false,
  },
  "42644": {
    y2024: {
      actions: { originated: cs(37326, 25101380000), approvedNotAccepted: cs(1658, 777860000), denied: cs(9706, 3363730000), withdrawn: cs(9343, 6866765000), incomplete: cs(2875, 1458535000), purchased: cs(5590, 5788040000), preapprovalDenied: cs(70, 126200000), preapprovalApprovedNotAccepted: cs(290, 196890000) },
      loanTypes: { conventional: cs(34797, 23595975000), fha: cs(1560, 859120000), va: cs(952, 644380000), usda: cs(17, 1905000) },
      purposes: { purchase: cs(21585, 17402575000), homeImprovement: cs(4230, 814310000), refinance: cs(5115, 4378805000), cashOutRefinance: cs(3072, 1649690000), other: cs(3319, 853305000), notApplicable: cs(5, 2695000) },
    },
    y2023: { actions: { originated: cs(49032, 27763570000), approvedNotAccepted: cs(2046, 851830000), denied: cs(14359, 4487615000), withdrawn: cs(11804, 7166190000), incomplete: cs(3539, 1533515000), purchased: cs(7032, 5841730000), preapprovalDenied: cs(173, 86045000), preapprovalApprovedNotAccepted: cs(474, 287410000) } },
    comparableTo2023: false,
  },
  "47764": {
    y2024: {
      actions: { originated: cs(30072, 13261050000), approvedNotAccepted: cs(1651, 675005000), denied: cs(13146, 4243810000), withdrawn: cs(9723, 4283765000), incomplete: cs(3437, 1237015000), purchased: cs(8137, 3707955000), preapprovalDenied: cs(28, 11320000), preapprovalApprovedNotAccepted: cs(71, 35625000) },
      loanTypes: { conventional: cs(20862, 8856930000), fha: cs(5400, 2360890000), va: cs(3778, 2035730000), usda: cs(32, 7500000) },
      purposes: { purchase: cs(17444, 9147050000), homeImprovement: cs(2528, 348580000), refinance: cs(3291, 2029525000), cashOutRefinance: cs(4251, 1402045000), other: cs(2557, 330845000), notApplicable: cs(1, 3005000) },
    },
    comparableTo2023: false,
  },
  "39300": {
    y2024: {
      actions: { originated: cs(32810, 10553880000), approvedNotAccepted: cs(1314, 358250000), denied: cs(11589, 2232005000), withdrawn: cs(6969, 2214075000), incomplete: cs(2958, 698010000), purchased: cs(4897, 2028255000), preapprovalDenied: cs(16, 6790000), preapprovalApprovedNotAccepted: cs(44, 19880000) },
      loanTypes: { conventional: cs(27268, 8091360000), fha: cs(4195, 1875435000), va: cs(1245, 584735000), usda: cs(102, 2350000) },
      purposes: { purchase: cs(14890, 6587010000), homeImprovement: cs(4826, 602280000), refinance: cs(4730, 1591950000), cashOutRefinance: cs(4526, 1221630000), other: cs(3834, 549730000), notApplicable: cs(4, 1280000) },
    },
    y2023: { actions: { originated: cs(30286, 8850840000), approvedNotAccepted: cs(1063, 276065000), denied: cs(11470, 2008100000), withdrawn: cs(6206, 2260560000), incomplete: cs(2570, 601960000), purchased: cs(4073, 1795715000), preapprovalDenied: cs(53, 73685000), preapprovalApprovedNotAccepted: cs(30, 12860000) } },
    comparableTo2023: true,
  },
  "48424": {
    y2024: {
      actions: { originated: cs(26443, 12198915000), approvedNotAccepted: cs(1826, 648490000), denied: cs(13612, 3773040000), withdrawn: cs(8726, 3928670000), incomplete: cs(3733, 1113105000), purchased: cs(5995, 3207365000), preapprovalDenied: cs(29, 11585000), preapprovalApprovedNotAccepted: cs(55, 23135000) },
      loanTypes: { conventional: cs(22500, 10562490000), fha: cs(3093, 1208135000), va: cs(844, 428190000), usda: cs(6, 100000) },
      purposes: { purchase: cs(15029, 8177855000), homeImprovement: cs(2634, 473590000), refinance: cs(2155, 1111275000), cashOutRefinance: cs(4010, 1556320000), other: cs(2608, 877540000), notApplicable: cs(7, 2335000) },
    },
    y2023: { actions: { originated: cs(27137, 11721715000), approvedNotAccepted: cs(1656, 636020000), denied: cs(13870, 3727330000), withdrawn: cs(9106, 4342820000), incomplete: cs(3341, 1026325000), purchased: cs(8472, 6675960000), preapprovalDenied: cs(29, 11625000), preapprovalApprovedNotAccepted: cs(39, 13215000) } },
    comparableTo2023: false,
  },
  "19804": {
    y2024: {
      actions: { originated: cs(30377, 5514635000), approvedNotAccepted: cs(2229, 263945000), denied: cs(13366, 1642560000), withdrawn: cs(7566, 1345820000), incomplete: cs(2548, 341000000), purchased: cs(3281, 691175000), preapprovalDenied: cs(28, 4340000), preapprovalApprovedNotAccepted: cs(168, 39560000) },
      loanTypes: { conventional: cs(24866, 4380510000), fha: cs(4431, 868855000), va: cs(1037, 264045000), usda: cs(43, 1225000) },
      purposes: { purchase: cs(16361, 3585195000), homeImprovement: cs(3081, 247385000), refinance: cs(3126, 703270000), cashOutRefinance: cs(4670, 693730000), other: cs(3134, 284090000), notApplicable: cs(5, 965000) },
    },
    y2023: { actions: { originated: cs(26722, 4721440000), approvedNotAccepted: cs(1958, 209980000), denied: cs(12088, 1315630000), withdrawn: cs(7062, 1209850000), incomplete: cs(2354, 287800000), purchased: cs(2897, 536265000), preapprovalDenied: cs(64, 8960000), preapprovalApprovedNotAccepted: cs(185, 34545000) } },
    comparableTo2023: true,
  },
  "36420": {
    y2024: {
      actions: { originated: cs(30544, 7408050000), approvedNotAccepted: cs(2081, 354025000), denied: cs(8391, 1374015000), withdrawn: cs(7321, 1776235000), incomplete: cs(2476, 478590000), purchased: cs(8618, 2192360000), preapprovalDenied: cs(15, 3335000), preapprovalApprovedNotAccepted: cs(65, 16585000) },
      loanTypes: { conventional: cs(21613, 5037165000), fha: cs(5029, 1173825000), va: cs(3710, 1160700000), usda: cs(192, 36360000) },
      purposes: { purchase: cs(19651, 5405315000), homeImprovement: cs(2226, 165270000), refinance: cs(3253, 951075000), cashOutRefinance: cs(3135, 632875000), other: cs(2274, 252490000), notApplicable: cs(5, 1025000) },
    },
    y2023: { actions: { originated: cs(27862, 6374700000), approvedNotAccepted: cs(1792, 323200000), denied: cs(8224, 1243340000), withdrawn: cs(6731, 1636275000), incomplete: cs(2274, 360850000), purchased: cs(7403, 1803275000), preapprovalDenied: cs(14, 3590000), preapprovalApprovedNotAccepted: cs(39, 8995000) } },
    comparableTo2023: true,
  },
  "40060": {
    y2024: {
      actions: { originated: cs(31181, 9720505000), approvedNotAccepted: cs(1365, 301255000), denied: cs(8866, 1652090000), withdrawn: cs(7038, 2100050000), incomplete: cs(2867, 643025000), purchased: cs(7452, 5052150000), preapprovalDenied: cs(31, 9855000), preapprovalApprovedNotAccepted: cs(48, 17520000) },
      loanTypes: { conventional: cs(23552, 7054860000), fha: cs(4503, 1433915000), va: cs(3038, 1208170000), usda: cs(88, 23560000) },
      purposes: { purchase: cs(17067, 6211605000), homeImprovement: cs(3089, 379435000), refinance: cs(3278, 1580910000), cashOutRefinance: cs(4516, 1131980000), other: cs(3229, 416195000), notApplicable: cs(2, 380000) },
    },
    y2023: { actions: { originated: cs(27256, 7692040000), approvedNotAccepted: cs(1044, 216840000), denied: cs(9314, 1547350000), withdrawn: cs(6291, 1985615000), incomplete: cs(2522, 539570000), purchased: cs(6546, 2181620000), preapprovalDenied: cs(15, 3985000), preapprovalApprovedNotAccepted: cs(20, 5630000) } },
    comparableTo2023: true,
  },
  "14454": {
    y2024: {
      actions: { originated: cs(31866, 16020510000), approvedNotAccepted: cs(1321, 630345000), denied: cs(10356, 4011900000), withdrawn: cs(6788, 3377450000), incomplete: cs(2774, 927850000), purchased: cs(5250, 2990450000), preapprovalDenied: cs(35, 28265000), preapprovalApprovedNotAccepted: cs(92, 56780000) },
      loanTypes: { conventional: cs(29211, 14587435000), fha: cs(1924, 1008220000), va: cs(720, 423590000), usda: cs(11, 1265000) },
      purposes: { purchase: cs(16381, 10593425000), homeImprovement: cs(4360, 918910000), refinance: cs(4762, 2530630000), cashOutRefinance: cs(3157, 1294965000), other: cs(3206, 682580000), notApplicable: cs(0, 0) },
    },
    y2023: { actions: { originated: cs(29889, 14169725000), approvedNotAccepted: cs(1207, 488555000), denied: cs(9864, 2698120000), withdrawn: cs(6192, 3036770000), incomplete: cs(2806, 977890000), purchased: cs(11440, 8144060000), preapprovalDenied: cs(53, 26165000), preapprovalApprovedNotAccepted: cs(37, 19985000) } },
    comparableTo2023: true,
  },
  "31140": {
    y2024: {
      actions: { originated: cs(32749, 7798955000), approvedNotAccepted: cs(1294, 244970000), denied: cs(8859, 1382345000), withdrawn: cs(7129, 1968535000), incomplete: cs(2478, 417150000), purchased: cs(5323, 1439765000), preapprovalDenied: cs(8, 1960000), preapprovalApprovedNotAccepted: cs(58, 14570000) },
      loanTypes: { conventional: cs(25698, 5901240000), fha: cs(4663, 1154775000), va: cs(2165, 693355000), usda: cs(223, 49585000) },
      purposes: { purchase: cs(18344, 5124790000), homeImprovement: cs(3194, 331370000), refinance: cs(3906, 1319960000), cashOutRefinance: cs(3880, 678380000), other: cs(3249, 314615000), notApplicable: cs(176, 29840000) },
    },
    y2023: { actions: { originated: cs(28720, 6535460000), approvedNotAccepted: cs(1037, 207535000), denied: cs(7614, 1077510000), withdrawn: cs(6699, 1559745000), incomplete: cs(2151, 345235000), purchased: cs(3827, 946535000), preapprovalDenied: cs(9, 1075000), preapprovalApprovedNotAccepted: cs(15, 3985000) } },
    comparableTo2023: true,
  },
  "15804": {
    y2024: {
      actions: { originated: cs(28739, 7181065000), approvedNotAccepted: cs(1419, 284795000), denied: cs(10185, 1618545000), withdrawn: cs(7579, 1959585000), incomplete: cs(2887, 518635000), purchased: cs(6560, 1992170000), preapprovalDenied: cs(15, 2895000), preapprovalApprovedNotAccepted: cs(55, 17825000) },
      loanTypes: { conventional: cs(22676, 5148700000), fha: cs(4362, 1418200000), va: cs(1601, 606915000), usda: cs(100, 7250000) },
      purposes: { purchase: cs(14003, 4509645000), homeImprovement: cs(3660, 375130000), refinance: cs(2953, 981505000), cashOutRefinance: cs(5049, 1014005000), other: cs(3067, 296435000), notApplicable: cs(7, 4345000) },
    },
    y2023: { actions: { originated: cs(25731, 6153285000), approvedNotAccepted: cs(1084, 226730000), denied: cs(9682, 1387300000), withdrawn: cs(6957, 1769925000), incomplete: cs(2683, 475535000), purchased: cs(5864, 1622730000), preapprovalDenied: cs(11, 3495000), preapprovalApprovedNotAccepted: cs(26, 7450000) } },
    comparableTo2023: true,
  },
  "33340": {
    y2024: {
      actions: { originated: cs(34321, 8245035000), approvedNotAccepted: cs(1727, 345685000), denied: cs(9048, 1290150000), withdrawn: cs(5888, 1517570000), incomplete: cs(1759, 350775000), purchased: cs(3833, 1156835000), preapprovalDenied: cs(68, 19370000), preapprovalApprovedNotAccepted: cs(147, 50215000) },
      loanTypes: { conventional: cs(31205, 7335265000), fha: cs(1984, 533290000), va: cs(1108, 376050000), usda: cs(24, 430000) },
      purposes: { purchase: cs(15629, 5037475000), homeImprovement: cs(4811, 478525000), refinance: cs(5004, 1467340000), cashOutRefinance: cs(4726, 879110000), other: cs(4119, 371575000), notApplicable: cs(32, 11010000) },
    },
    y2023: { actions: { originated: cs(32581, 7848885000), approvedNotAccepted: cs(1776, 333830000), denied: cs(7923, 1465015000), withdrawn: cs(5200, 1269390000), incomplete: cs(1402, 254950000), purchased: cs(3467, 947105000), preapprovalDenied: cs(52, 13970000), preapprovalApprovedNotAccepted: cs(119, 29535000) } },
    comparableTo2023: true,
  },
  "41620": {
    y2024: {
      actions: { originated: cs(29702, 10057840000), approvedNotAccepted: cs(1614, 525670000), denied: cs(9056, 1996330000), withdrawn: cs(6325, 2314835000), incomplete: cs(2223, 563525000), purchased: cs(4715, 2142825000), preapprovalDenied: cs(13, 5895000), preapprovalApprovedNotAccepted: cs(58, 28010000) },
      loanTypes: { conventional: cs(24382, 7623490000), fha: cs(4268, 1883850000), va: cs(1045, 549615000), usda: cs(7, 885000) },
      purposes: { purchase: cs(13975, 6551665000), homeImprovement: cs(4099, 478035000), refinance: cs(4385, 1549895000), cashOutRefinance: cs(3473, 981975000), other: cs(3767, 495615000), notApplicable: cs(3, 655000) },
    },
    y2023: { actions: { originated: cs(27366, 8825850000), approvedNotAccepted: cs(1383, 387305000), denied: cs(8883, 1782635000), withdrawn: cs(6378, 2353090000), incomplete: cs(2490, 600820000), purchased: cs(3934, 2117730000), preapprovalDenied: cs(9, 3065000), preapprovalApprovedNotAccepted: cs(33, 14805000) } },
    comparableTo2023: false,
  },
  "13820": {
    y2024: {
      actions: { originated: cs(25147, 5851385000), approvedNotAccepted: cs(1690, 285880000), denied: cs(9079, 1456685000), withdrawn: cs(6065, 1450655000), incomplete: cs(2753, 419935000), purchased: cs(5030, 1352450000), preapprovalDenied: cs(30, 9210000), preapprovalApprovedNotAccepted: cs(64, 20920000) },
      loanTypes: { conventional: cs(18543, 4082525000), fha: cs(4354, 1088210000), va: cs(1913, 605615000), usda: cs(337, 75035000) },
      purposes: { purchase: cs(14661, 3954845000), homeImprovement: cs(2166, 201740000), refinance: cs(2699, 839835000), cashOutRefinance: cs(2649, 523905000), other: cs(2966, 330110000), notApplicable: cs(6, 950000) },
    },
    y2023: { actions: { originated: cs(22418, 5493240000), approvedNotAccepted: cs(1360, 240820000), denied: cs(8096, 1197840000), withdrawn: cs(5572, 1286260000), incomplete: cs(2470, 502370000), purchased: cs(3759, 956545000), preapprovalDenied: cs(24, 7090000), preapprovalApprovedNotAccepted: cs(33, 8385000) } },
    comparableTo2023: false,
  },
  "35840": {
    y2024: {
      actions: { originated: cs(24075, 8821415000), approvedNotAccepted: cs(1398, 435120000), denied: cs(8335, 2160575000), withdrawn: cs(6415, 2415325000), incomplete: cs(2314, 631970000), purchased: cs(6389, 2564845000), preapprovalDenied: cs(11, 4505000), preapprovalApprovedNotAccepted: cs(49, 20595000) },
      loanTypes: { conventional: cs(19246, 6910650000), fha: cs(3257, 1194815000), va: cs(1549, 713865000), usda: cs(23, 2085000) },
      purposes: { purchase: cs(15873, 6654705000), homeImprovement: cs(1967, 278585000), refinance: cs(1591, 660255000), cashOutRefinance: cs(2270, 780800000), other: cs(2361, 441785000), notApplicable: cs(13, 5285000) },
    },
    y2023: { actions: { originated: cs(24055, 8671565000), approvedNotAccepted: cs(1341, 453815000), denied: cs(8372, 2065600000), withdrawn: cs(6643, 2509975000), incomplete: cs(2265, 609715000), purchased: cs(6332, 3027360000), preapprovalDenied: cs(23, 9665000), preapprovalApprovedNotAccepted: cs(44, 19540000) } },
    comparableTo2023: false,
  },
  "32820": {
    y2024: {
      actions: { originated: cs(23850, 5812150000), approvedNotAccepted: cs(1681, 308185000), denied: cs(8858, 1271560000), withdrawn: cs(5933, 1403855000), incomplete: cs(2387, 427305000), purchased: cs(6097, 1735205000), preapprovalDenied: cs(43, 8995000), preapprovalApprovedNotAccepted: cs(61, 15715000) },
      loanTypes: { conventional: cs(16609, 3773405000), fha: cs(4823, 1242805000), va: cs(2206, 748810000), usda: cs(212, 47130000) },
      purposes: { purchase: cs(13888, 3866730000), homeImprovement: cs(1696, 141730000), refinance: cs(3100, 907140000), cashOutRefinance: cs(3235, 706155000), other: cs(1915, 186145000), notApplicable: cs(16, 4250000) },
    },
    y2023: { actions: { originated: cs(22545, 5492525000), approvedNotAccepted: cs(1386, 242730000), denied: cs(8677, 1259415000), withdrawn: cs(5834, 1397780000), incomplete: cs(2332, 398340000), purchased: cs(5215, 1521435000), preapprovalDenied: cs(69, 14085000), preapprovalApprovedNotAccepted: cs(58, 15670000) } },
    comparableTo2023: true,
  },
  "29460": {
    y2024: {
      actions: { originated: cs(20938, 5536240000), approvedNotAccepted: cs(1193, 230325000), denied: cs(9487, 1715985000), withdrawn: cs(6004, 1650230000), incomplete: cs(2081, 389795000), purchased: cs(7502, 2444480000), preapprovalDenied: cs(19, 5355000), preapprovalApprovedNotAccepted: cs(24, 7370000) },
      loanTypes: { conventional: cs(11267, 2543995000), fha: cs(7539, 2275755000), va: cs(2063, 699245000), usda: cs(69, 17245000) },
      purposes: { purchase: cs(15152, 4465890000), homeImprovement: cs(1097, 86285000), refinance: cs(1321, 418795000), cashOutRefinance: cs(2054, 440810000), other: cs(1304, 121950000), notApplicable: cs(10, 2510000) },
    },
    y2023: { actions: { originated: cs(20671, 5464205000), approvedNotAccepted: cs(1042, 400230000), denied: cs(9472, 1690070000), withdrawn: cs(6502, 1650960000), incomplete: cs(2060, 375020000), purchased: cs(7705, 2137425000), preapprovalDenied: cs(16, 3530000), preapprovalApprovedNotAccepted: cs(46, 10920000) } },
    comparableTo2023: true,
  },
  "16700": {
    y2024: {
      actions: { originated: cs(23645, 9654775000), approvedNotAccepted: cs(1059, 370305000), denied: cs(6910, 2110080000), withdrawn: cs(6626, 3118220000), incomplete: cs(2426, 596330000), purchased: cs(6269, 2377455000), preapprovalDenied: cs(15, 5475000), preapprovalApprovedNotAccepted: cs(68, 31000000) },
      loanTypes: { conventional: cs(16560, 7079470000), fha: cs(3461, 1135775000), va: cs(3566, 1426640000), usda: cs(58, 12890000) },
      purposes: { purchase: cs(14724, 6926060000), homeImprovement: cs(1881, 283015000), refinance: cs(2255, 1153975000), cashOutRefinance: cs(3203, 929735000), other: cs(1576, 359410000), notApplicable: cs(6, 2580000) },
    },
    y2023: { actions: { originated: cs(21704, 8178290000), approvedNotAccepted: cs(895, 294765000), denied: cs(7137, 1750945000), withdrawn: cs(6050, 2243000000), incomplete: cs(2311, 513835000), purchased: cs(6029, 2202835000), preapprovalDenied: cs(15, 4765000), preapprovalApprovedNotAccepted: cs(46, 16890000) } },
    comparableTo2023: true,
  },
  "15980": {
    y2024: {
      actions: { originated: cs(22229, 7392825000), approvedNotAccepted: cs(1143, 296435000), denied: cs(8647, 2083455000), withdrawn: cs(6212, 2026330000), incomplete: cs(2137, 467505000), purchased: cs(6089, 1905775000), preapprovalDenied: cs(15, 6425000), preapprovalApprovedNotAccepted: cs(47, 20715000) },
      loanTypes: { conventional: cs(16122, 5218680000), fha: cs(4987, 1733285000), va: cs(1119, 440845000), usda: cs(1, 15000) },
      purposes: { purchase: cs(15179, 5762035000), homeImprovement: cs(1433, 222805000), refinance: cs(1320, 514920000), cashOutRefinance: cs(2180, 581840000), other: cs(2102, 305320000), notApplicable: cs(15, 5905000) },
    },
    y2023: { actions: { originated: cs(21103, 6945085000), approvedNotAccepted: cs(1127, 296405000), denied: cs(8703, 1924895000), withdrawn: cs(6236, 2017810000), incomplete: cs(2025, 464815000), purchased: cs(5795, 2229235000), preapprovalDenied: cs(17, 4535000), preapprovalApprovedNotAccepted: cs(40, 15270000) } },
    comparableTo2023: true,
  },
  "24340": {
    y2024: {
      actions: { originated: cs(26734, 6043990000), approvedNotAccepted: cs(1406, 186090000), denied: cs(7625, 991075000), withdrawn: cs(4751, 1133045000), incomplete: cs(1731, 286715000), purchased: cs(2714, 759630000), preapprovalDenied: cs(12, 2980000), preapprovalApprovedNotAccepted: cs(60, 18830000) },
      loanTypes: { conventional: cs(23853, 5239825000), fha: cs(1921, 495025000), va: cs(898, 295590000), usda: cs(62, 13550000) },
      purposes: { purchase: cs(13083, 3930025000), homeImprovement: cs(3704, 316530000), refinance: cs(3981, 921125000), cashOutRefinance: cs(3129, 594175000), other: cs(2835, 281725000), notApplicable: cs(2, 410000) },
    },
    y2023: { actions: { originated: cs(23507, 5304045000), approvedNotAccepted: cs(1412, 156470000), denied: cs(6724, 825000000), withdrawn: cs(4278, 981890000), incomplete: cs(1560, 246200000), purchased: cs(2723, 645705000), preapprovalDenied: cs(17, 3455000), preapprovalApprovedNotAccepted: cs(55, 12155000) } },
    comparableTo2023: false,
  },
  "46060": {
    y2024: {
      actions: { originated: cs(21940, 6258600000), approvedNotAccepted: cs(1464, 288160000), denied: cs(6264, 1098200000), withdrawn: cs(6280, 1821380000), incomplete: cs(2116, 418790000), purchased: cs(5864, 1871500000), preapprovalDenied: cs(14, 3840000), preapprovalApprovedNotAccepted: cs(34, 12760000) },
      loanTypes: { conventional: cs(14875, 3928885000), fha: cs(4051, 1211095000), va: cs(3003, 1115535000), usda: cs(11, 3085000) },
      purposes: { purchase: cs(12435, 4185815000), homeImprovement: cs(1903, 181195000), refinance: cs(2073, 963595000), cashOutRefinance: cs(3301, 680825000), other: cs(2224, 244630000), notApplicable: cs(4, 2540000) },
    },
    y2023: { actions: { originated: cs(19224, 5553740000), approvedNotAccepted: cs(1239, 230785000), denied: cs(5850, 1023040000), withdrawn: cs(5911, 1621455000), incomplete: cs(1966, 388720000), purchased: cs(5541, 1740635000), preapprovalDenied: cs(17, 4475000), preapprovalApprovedNotAccepted: cs(18, 7950000) } },
    comparableTo2023: true,
  },
  "28940": {
    y2024: {
      actions: { originated: cs(23346, 6951720000), approvedNotAccepted: cs(1654, 400000000), denied: cs(6809, 1242635000), withdrawn: cs(5039, 1490965000), incomplete: cs(2701, 479305000), purchased: cs(3954, 1317370000), preapprovalDenied: cs(23, 9525000), preapprovalApprovedNotAccepted: cs(72, 29970000) },
      loanTypes: { conventional: cs(17897, 5223455000), fha: cs(3215, 911055000), va: cs(2044, 774940000), usda: cs(190, 42270000) },
      purposes: { purchase: cs(12495, 4611715000), homeImprovement: cs(2525, 312345000), refinance: cs(2250, 821210000), cashOutRefinance: cs(4096, 837880000), other: cs(1979, 368295000), notApplicable: cs(1, 275000) },
    },
    y2023: { actions: { originated: cs(21013, 5754575000), approvedNotAccepted: cs(1440, 340660000), denied: cs(6146, 1032570000), withdrawn: cs(4428, 1337280000), incomplete: cs(2433, 413845000), purchased: cs(3055, 883495000), preapprovalDenied: cs(23, 5875000), preapprovalApprovedNotAccepted: cs(37, 10435000) } },
    comparableTo2023: true,
  },
  "23224": {
    y2024: {
      actions: { originated: cs(21716, 9817830000), approvedNotAccepted: cs(868, 295180000), denied: cs(6752, 1647760000), withdrawn: cs(5484, 2377820000), incomplete: cs(1946, 632260000), purchased: cs(5134, 2468190000), preapprovalDenied: cs(10, 4940000), preapprovalApprovedNotAccepted: cs(92, 52700000) },
      loanTypes: { conventional: cs(18709, 8283295000), fha: cs(1796, 808260000), va: cs(1194, 720630000), usda: cs(17, 5645000) },
      purposes: { purchase: cs(12545, 7013485000), homeImprovement: cs(2242, 328470000), refinance: cs(2446, 1398350000), cashOutRefinance: cs(2337, 755935000), other: cs(2144, 319510000), notApplicable: cs(2, 2080000) },
    },
    y2023: { actions: { originated: cs(19237, 8509035000), approvedNotAccepted: cs(693, 255615000), denied: cs(6139, 1600075000), withdrawn: cs(4661, 2140745000), incomplete: cs(1588, 526290000), purchased: cs(4762, 2305830000), preapprovalDenied: cs(11, 3865000), preapprovalApprovedNotAccepted: cs(46, 25180000) } },
    comparableTo2023: false,
  },
  "24860": {
    y2024: {
      actions: { originated: cs(21200, 5754570000), approvedNotAccepted: cs(965, 210495000), denied: cs(6992, 1167030000), withdrawn: cs(4731, 1335515000), incomplete: cs(2399, 415505000), purchased: cs(5119, 1496525000), preapprovalDenied: cs(11, 2655000), preapprovalApprovedNotAccepted: cs(50, 14420000) },
      loanTypes: { conventional: cs(15679, 4191865000), fha: cs(3653, 942655000), va: cs(1704, 582280000), usda: cs(164, 37770000) },
      purposes: { purchase: cs(12817, 3977245000), homeImprovement: cs(1685, 191795000), refinance: cs(2064, 695770000), cashOutRefinance: cs(2592, 643360000), other: cs(2041, 246245000), notApplicable: cs(1, 155000) },
    },
    y2023: { actions: { originated: cs(19790, 5462260000), approvedNotAccepted: cs(925, 191905000), denied: cs(6790, 1060920000), withdrawn: cs(4419, 1178865000), incomplete: cs(2260, 375410000), purchased: cs(4224, 1317620000), preapprovalDenied: cs(20, 48640000), preapprovalApprovedNotAccepted: cs(13, 2815000) } },
    comparableTo2023: false,
  },
  "46140": {
    y2024: {
      actions: { originated: cs(19850, 4709940000), approvedNotAccepted: cs(1521, 273335000), denied: cs(6303, 1031065000), withdrawn: cs(5202, 1231960000), incomplete: cs(1877, 312135000), purchased: cs(5728, 1801160000), preapprovalDenied: cs(144, 24670000), preapprovalApprovedNotAccepted: cs(97, 21065000) },
      loanTypes: { conventional: cs(14376, 3323610000), fha: cs(3562, 834990000), va: cs(1669, 504555000), usda: cs(243, 46785000) },
      purposes: { purchase: cs(12430, 3399400000), homeImprovement: cs(2022, 181950000), refinance: cs(1753, 567695000), cashOutRefinance: cs(2077, 426375000), other: cs(1567, 134295000), notApplicable: cs(1, 225000) },
    },
    y2023: { actions: { originated: cs(18237, 4208295000), approvedNotAccepted: cs(1325, 216155000), denied: cs(5913, 766925000), withdrawn: cs(4848, 1151890000), incomplete: cs(1677, 268535000), purchased: cs(4957, 1201535000), preapprovalDenied: cs(32, 6820000), preapprovalApprovedNotAccepted: cs(22, 4600000) } },
    comparableTo2023: true,
  },
  "41304": {
    y2024: {
      actions: { originated: cs(18942, 6461700000), approvedNotAccepted: cs(1325, 336375000), denied: cs(8062, 2134800000), withdrawn: cs(5995, 2069875000), incomplete: cs(2309, 514095000), purchased: cs(3803, 1304925000), preapprovalDenied: cs(21, 7605000), preapprovalApprovedNotAccepted: cs(45, 17975000) },
      loanTypes: { conventional: cs(15939, 5351525000), fha: cs(1781, 568105000), va: cs(1217, 541995000), usda: cs(5, 75000) },
      purposes: { purchase: cs(10452, 4380620000), homeImprovement: cs(2109, 281065000), refinance: cs(1625, 638985000), cashOutRefinance: cs(2642, 755000000), other: cs(2104, 401250000), notApplicable: cs(10, 4780000) },
    },
    comparableTo2023: false,
  },
  "41940": {
    y2024: {
      actions: { originated: cs(22339, 22588675000), approvedNotAccepted: cs(1448, 835600000), denied: cs(5911, 3288705000), withdrawn: cs(5881, 5780505000), incomplete: cs(2085, 1136695000), purchased: cs(2583, 1925185000), preapprovalDenied: cs(10, 8330000), preapprovalApprovedNotAccepted: cs(165, 198875000) },
      loanTypes: { conventional: cs(21613, 22046975000), fha: cs(559, 388535000), va: cs(167, 153165000), usda: cs(0, 0) },
      purposes: { purchase: cs(12157, 14855155000), homeImprovement: cs(2033, 522145000), refinance: cs(4144, 5145990000), cashOutRefinance: cs(2271, 1469135000), other: cs(1722, 585730000), notApplicable: cs(12, 10520000) },
    },
    y2023: { actions: { originated: cs(17105, 16452295000), approvedNotAccepted: cs(1177, 720855000), denied: cs(5109, 2682435000), withdrawn: cs(4583, 4550685000), incomplete: cs(1590, 863550000), purchased: cs(7346, 7503550000), preapprovalDenied: cs(15, 10895000), preapprovalApprovedNotAccepted: cs(66, 49010000) } },
    comparableTo2023: true,
  },
  "17900": {
    y2024: {
      actions: { originated: cs(19642, 5220890000), approvedNotAccepted: cs(1224, 278690000), denied: cs(6552, 1037290000), withdrawn: cs(5456, 1306250000), incomplete: cs(2047, 368395000), purchased: cs(5181, 1428375000), preapprovalDenied: cs(15, 3285000), preapprovalApprovedNotAccepted: cs(56, 14190000) },
      loanTypes: { conventional: cs(12109, 3067965000), fha: cs(3538, 913350000), va: cs(3885, 1214885000), usda: cs(110, 24690000) },
      purposes: { purchase: cs(12053, 3337005000), homeImprovement: cs(1347, 142465000), refinance: cs(2384, 957040000), cashOutRefinance: cs(2478, 641920000), other: cs(1378, 142310000), notApplicable: cs(2, 150000) },
    },
    y2023: { actions: { originated: cs(17935, 4041645000), approvedNotAccepted: cs(1050, 240290000), denied: cs(6521, 951145000), withdrawn: cs(5248, 1172040000), incomplete: cs(2013, 329515000), purchased: cs(4282, 1126530000), preapprovalDenied: cs(29, 6335000), preapprovalApprovedNotAccepted: cs(37, 10295000) } },
    comparableTo2023: true,
  },
  "19660": {
    y2024: {
      actions: { originated: cs(18545, 5294205000), approvedNotAccepted: cs(1171, 238445000), denied: cs(7524, 1478600000), withdrawn: cs(5439, 1588555000), incomplete: cs(1959, 375655000), purchased: cs(5221, 1474735000), preapprovalDenied: cs(21, 5385000), preapprovalApprovedNotAccepted: cs(49, 15265000) },
      loanTypes: { conventional: cs(12601, 3403435000), fha: cs(3799, 1133545000), va: cs(2099, 754405000), usda: cs(46, 2820000) },
      purposes: { purchase: cs(11459, 3686265000), homeImprovement: cs(1339, 129485000), refinance: cs(1341, 403525000), cashOutRefinance: cs(2757, 892285000), other: cs(1642, 178610000), notApplicable: cs(7, 4035000) },
    },
    y2023: { actions: { originated: cs(18538, 4948190000), approvedNotAccepted: cs(1142, 221180000), denied: cs(7900, 1358490000), withdrawn: cs(5618, 1519340000), incomplete: cs(1905, 363125000), purchased: cs(5349, 1913225000), preapprovalDenied: cs(30, 6640000), preapprovalApprovedNotAccepted: cs(41, 10065000) } },
    comparableTo2023: true,
  },
  "36540": {
    y2024: {
      actions: { originated: cs(22872, 5776100000), approvedNotAccepted: cs(908, 166360000), denied: cs(4890, 702460000), withdrawn: cs(4643, 1205555000), incomplete: cs(1388, 236510000), purchased: cs(5010, 1412910000), preapprovalDenied: cs(18, 3860000), preapprovalApprovedNotAccepted: cs(29, 8045000) },
      loanTypes: { conventional: cs(18296, 4422050000), fha: cs(2190, 551310000), va: cs(2311, 793825000), usda: cs(75, 8915000) },
      purposes: { purchase: cs(13308, 4158900000), homeImprovement: cs(2227, 171455000), refinance: cs(2615, 682255000), cashOutRefinance: cs(2229, 480295000), other: cs(2491, 282475000), notApplicable: cs(2, 720000) },
    },
    y2023: { actions: { originated: cs(21068, 5004130000), approvedNotAccepted: cs(858, 136800000), denied: cs(4439, 722935000), withdrawn: cs(3980, 940690000), incomplete: cs(1146, 191330000), purchased: cs(4019, 1054135000), preapprovalDenied: cs(34, 8610000), preapprovalApprovedNotAccepted: cs(36, 8990000) } },
    comparableTo2023: false,
  },
  "25540": {
    y2024: {
      actions: { originated: cs(22428, 5616160000), approvedNotAccepted: cs(835, 175895000), denied: cs(6637, 1093245000), withdrawn: cs(4480, 1196830000), incomplete: cs(1970, 390950000), purchased: cs(2831, 927125000), preapprovalDenied: cs(47, 17705000), preapprovalApprovedNotAccepted: cs(62, 19910000) },
      loanTypes: { conventional: cs(19687, 4727695000), fha: cs(1933, 611265000), va: cs(740, 272190000), usda: cs(68, 5010000) },
      purposes: { purchase: cs(11822, 3771710000), homeImprovement: cs(3089, 325505000), refinance: cs(2507, 673115000), cashOutRefinance: cs(2471, 564225000), other: cs(2539, 281605000), notApplicable: cs(0, 0) },
    },
    y2023: { actions: { originated: cs(22496, 5572320000), approvedNotAccepted: cs(823, 222755000), denied: cs(6591, 1051555000), withdrawn: cs(4542, 1307790000), incomplete: cs(1935, 371205000), purchased: cs(2720, 772500000), preapprovalDenied: cs(31, 6585000), preapprovalApprovedNotAccepted: cs(30, 8180000) } },
    comparableTo2023: false,
  },
  "17820": {
    y2024: {
      actions: { originated: cs(21274, 7788100000), approvedNotAccepted: cs(1899, 578005000), denied: cs(5419, 1172605000), withdrawn: cs(4961, 1932175000), incomplete: cs(1469, 422305000), purchased: cs(3744, 1635690000), preapprovalDenied: cs(11, 3595000), preapprovalApprovedNotAccepted: cs(44, 19290000) },
      loanTypes: { conventional: cs(12876, 3952500000), fha: cs(2125, 792035000), va: cs(6271, 3042745000), usda: cs(2, 820000) },
      purposes: { purchase: cs(11854, 5280240000), homeImprovement: cs(1916, 192250000), refinance: cs(2917, 1368985000), cashOutRefinance: cs(2140, 634770000), other: cs(2444, 310840000), notApplicable: cs(3, 1015000) },
    },
    y2023: { actions: { originated: cs(19921, 6707655000), approvedNotAccepted: cs(1607, 413265000), denied: cs(5200, 1029070000), withdrawn: cs(4514, 1675560000), incomplete: cs(1246, 299790000), purchased: cs(3452, 1526910000), preapprovalDenied: cs(33, 11075000), preapprovalApprovedNotAccepted: cs(28, 9430000) } },
    comparableTo2023: true,
  },
  "14260": {
    y2024: {
      actions: { originated: cs(22144, 7458430000), approvedNotAccepted: cs(1866, 547780000), denied: cs(5033, 1080725000), withdrawn: cs(4231, 1547475000), incomplete: cs(1030, 241770000), purchased: cs(3923, 1898265000), preapprovalDenied: cs(15, 5675000), preapprovalApprovedNotAccepted: cs(41, 15415000) },
      loanTypes: { conventional: cs(17514, 5594990000), fha: cs(2817, 1043685000), va: cs(1792, 816100000), usda: cs(21, 3655000) },
      purposes: { purchase: cs(12779, 5146395000), homeImprovement: cs(2920, 358100000), refinance: cs(1713, 737645000), cashOutRefinance: cs(3208, 1020150000), other: cs(1516, 193650000), notApplicable: cs(8, 2490000) },
    },
    y2023: { actions: { originated: cs(19855, 6359875000), approvedNotAccepted: cs(1661, 564885000), denied: cs(4770, 930530000), withdrawn: cs(4033, 1303065000), incomplete: cs(1074, 267150000), purchased: cs(2579, 1084215000), preapprovalDenied: cs(33, 11785000), preapprovalApprovedNotAccepted: cs(27, 11195000) } },
    comparableTo2023: true,
  },
  "10740": {
    y2024: {
      actions: { originated: cs(20209, 4877205000), approvedNotAccepted: cs(1088, 227960000), denied: cs(6116, 1082860000), withdrawn: cs(5606, 1406050000), incomplete: cs(2155, 393865000), purchased: cs(2870, 943240000), preapprovalDenied: cs(4, 1510000), preapprovalApprovedNotAccepted: cs(23, 8295000) },
      loanTypes: { conventional: cs(14507, 3090615000), fha: cs(3327, 965595000), va: cs(2205, 812495000), usda: cs(170, 8500000) },
      purposes: { purchase: cs(11901, 3289155000), homeImprovement: cs(1600, 153450000), refinance: cs(2003, 721185000), cashOutRefinance: cs(2553, 526655000), other: cs(2151, 186655000), notApplicable: cs(1, 105000) },
    },
    y2023: { actions: { originated: cs(17318, 4354600000), approvedNotAccepted: cs(822, 171410000), denied: cs(5351, 921365000), withdrawn: cs(4853, 1283565000), incomplete: cs(1829, 334085000), purchased: cs(2707, 820995000), preapprovalDenied: cs(9, 2215000), preapprovalApprovedNotAccepted: cs(14, 4990000) } },
    comparableTo2023: true,
  },
  "45104": {
    y2024: {
      actions: { originated: cs(20450, 7822140000), approvedNotAccepted: cs(1096, 344520000), denied: cs(6410, 1436430000), withdrawn: cs(4855, 1975975000), incomplete: cs(1458, 437330000), purchased: cs(3192, 1496380000), preapprovalDenied: cs(58, 26540000), preapprovalApprovedNotAccepted: cs(88, 42570000) },
      loanTypes: { conventional: cs(14778, 4960020000), fha: cs(2781, 1314815000), va: cs(2869, 1545825000), usda: cs(22, 1480000) },
      purposes: { purchase: cs(10725, 5123675000), homeImprovement: cs(2371, 262785000), refinance: cs(2695, 1272365000), cashOutRefinance: cs(2444, 893530000), other: cs(2214, 269450000), notApplicable: cs(1, 335000) },
    },
    y2023: { actions: { originated: cs(17857, 6667165000), approvedNotAccepted: cs(827, 239515000), denied: cs(6193, 1267805000), withdrawn: cs(4491, 1725715000), incomplete: cs(1372, 372070000), purchased: cs(2923, 1868335000), preapprovalDenied: cs(103, 38325000), preapprovalApprovedNotAccepted: cs(135, 59555000) } },
    comparableTo2023: true,
  },
  "37340": {
    y2024: {
      actions: { originated: cs(16944, 4799050000), approvedNotAccepted: cs(1178, 259640000), denied: cs(6177, 1253725000), withdrawn: cs(5285, 1562335000), incomplete: cs(1780, 401350000), purchased: cs(4496, 1741350000), preapprovalDenied: cs(9, 3265000), preapprovalApprovedNotAccepted: cs(56, 21310000) },
      loanTypes: { conventional: cs(11392, 2814680000), fha: cs(2859, 907135000), va: cs(2686, 1077140000), usda: cs(7, 95000) },
      purposes: { purchase: cs(10059, 3514945000), homeImprovement: cs(1531, 147685000), refinance: cs(1418, 470380000), cashOutRefinance: cs(2456, 509290000), other: cs(1477, 155885000), notApplicable: cs(3, 865000) },
    },
    y2023: { actions: { originated: cs(16732, 4647030000), approvedNotAccepted: cs(1054, 264560000), denied: cs(6502, 1179290000), withdrawn: cs(5619, 1615115000), incomplete: cs(1735, 368765000), purchased: cs(4772, 1384930000), preapprovalDenied: cs(13, 3395000), preapprovalApprovedNotAccepted: cs(26, 8650000) } },
    comparableTo2023: true,
  },
  "30780": {
    y2024: {
      actions: { originated: cs(16182, 3611050000), approvedNotAccepted: cs(1434, 279970000), denied: cs(5885, 763195000), withdrawn: cs(4410, 925600000), incomplete: cs(1541, 244345000), purchased: cs(5232, 1247940000), preapprovalDenied: cs(8, 1960000), preapprovalApprovedNotAccepted: cs(54, 13970000) },
      loanTypes: { conventional: cs(11324, 2402290000), fha: cs(2531, 570825000), va: cs(2094, 595810000), usda: cs(233, 42125000) },
      purposes: { purchase: cs(9843, 2570615000), homeImprovement: cs(1345, 105395000), refinance: cs(1745, 485475000), cashOutRefinance: cs(1537, 306785000), other: cs(1711, 142585000), notApplicable: cs(1, 195000) },
    },
    y2023: { actions: { originated: cs(14533, 3160845000), approvedNotAccepted: cs(632, 94940000), denied: cs(5380, 670320000), withdrawn: cs(4300, 940610000), incomplete: cs(1419, 210015000), purchased: cs(3878, 901990000), preapprovalDenied: cs(6, 1470000), preapprovalApprovedNotAccepted: cs(32, 7410000) } },
    comparableTo2023: true,
  },
  "23420": {
    y2024: {
      actions: { originated: cs(16149, 5033265000), approvedNotAccepted: cs(1058, 234540000), denied: cs(6620, 1276520000), withdrawn: cs(4290, 1482600000), incomplete: cs(1648, 361420000), purchased: cs(3988, 1479870000), preapprovalDenied: cs(1, 495000), preapprovalApprovedNotAccepted: cs(48, 16320000) },
      loanTypes: { conventional: cs(11847, 3401735000), fha: cs(3354, 1218150000), va: cs(933, 408525000), usda: cs(15, 4855000) },
      purposes: { purchase: cs(9707, 3624745000), homeImprovement: cs(1274, 131370000), refinance: cs(1238, 561800000), cashOutRefinance: cs(2365, 562525000), other: cs(1547, 147855000), notApplicable: cs(18, 4970000) },
    },
    y2023: { actions: { originated: cs(11020, 3375200000), approvedNotAccepted: cs(661, 141845000), denied: cs(5010, 986550000), withdrawn: cs(3065, 949135000), incomplete: cs(1164, 242120000), purchased: cs(2859, 1138545000), preapprovalDenied: cs(4, 910000), preapprovalApprovedNotAccepted: cs(30, 11280000) } },
    comparableTo2023: false,
  },
  "40380": {
    y2024: {
      actions: { originated: cs(20649, 3926275000), approvedNotAccepted: cs(813, 121535000), denied: cs(5053, 557195000), withdrawn: cs(2236, 418490000), incomplete: cs(1079, 129055000), purchased: cs(3828, 1282760000), preapprovalDenied: cs(12, 2900000), preapprovalApprovedNotAccepted: cs(97, 27845000) },
      loanTypes: { conventional: cs(18985, 3580245000), fha: cs(1188, 223910000), va: cs(445, 117095000), usda: cs(31, 5025000) },
      purposes: { purchase: cs(9325, 2309705000), homeImprovement: cs(3389, 307115000), refinance: cs(2421, 622985000), cashOutRefinance: cs(1907, 342055000), other: cs(3607, 344415000), notApplicable: cs(0, 0) },
    },
    y2023: { actions: { originated: cs(20788, 3547120000), approvedNotAccepted: cs(934, 155720000), denied: cs(5361, 511085000), withdrawn: cs(2264, 415150000), incomplete: cs(1114, 111000000), purchased: cs(4339, 937335000), preapprovalDenied: cs(15, 2995000), preapprovalApprovedNotAccepted: cs(75, 17975000) } },
    comparableTo2023: true,
  },
  "19430": {
    y2024: {
      actions: { originated: cs(18217, 3753415000), approvedNotAccepted: cs(1189, 206545000), denied: cs(5221, 652125000), withdrawn: cs(4094, 858170000), incomplete: cs(1092, 186080000), purchased: cs(3686, 867510000), preapprovalDenied: cs(10, 1490000), preapprovalApprovedNotAccepted: cs(49, 12815000) },
      loanTypes: { conventional: cs(13736, 2631630000), fha: cs(2265, 475525000), va: cs(2166, 637130000), usda: cs(50, 9130000) },
      purposes: { purchase: cs(10200, 2577990000), homeImprovement: cs(2012, 174390000), refinance: cs(2108, 472670000), cashOutRefinance: cs(2051, 380455000), other: cs(1838, 146870000), notApplicable: cs(8, 1040000) },
    },
    y2023: { actions: { originated: cs(16549, 3108305000), approvedNotAccepted: cs(1018, 177030000), denied: cs(4949, 551615000), withdrawn: cs(3699, 733285000), incomplete: cs(979, 152505000), purchased: cs(3190, 699930000), preapprovalDenied: cs(3, 675000), preapprovalApprovedNotAccepted: cs(9, 1585000) } },
    comparableTo2023: false,
  },
  "10900": {
    y2024: {
      actions: { originated: cs(17625, 4210235000), approvedNotAccepted: cs(998, 179430000), denied: cs(6071, 955405000), withdrawn: cs(3780, 961370000), incomplete: cs(1512, 268910000), purchased: cs(3278, 955240000), preapprovalDenied: cs(12, 3920000), preapprovalApprovedNotAccepted: cs(30, 8510000) },
      loanTypes: { conventional: cs(14830, 3415920000), fha: cs(2134, 568800000), va: cs(620, 218650000), usda: cs(41, 6865000) },
      purposes: { purchase: cs(9026, 2826960000), homeImprovement: cs(2267, 195725000), refinance: cs(1916, 561320000), cashOutRefinance: cs(2241, 427415000), other: cs(2172, 198150000), notApplicable: cs(3, 665000) },
    },
    y2023: { actions: { originated: cs(16069, 3490025000), approvedNotAccepted: cs(918, 180310000), denied: cs(5599, 778245000), withdrawn: cs(3509, 811135000), incomplete: cs(1380, 232790000), purchased: cs(2658, 867520000), preapprovalDenied: cs(11, 3575000), preapprovalApprovedNotAccepted: cs(12, 3230000) } },
    comparableTo2023: true,
  },
  "39340": {
    y2024: {
      actions: { originated: cs(18633, 6475705000), approvedNotAccepted: cs(1043, 305245000), denied: cs(4473, 1114405000), withdrawn: cs(3773, 1585225000), incomplete: cs(1171, 332865000), purchased: cs(3559, 1665765000), preapprovalDenied: cs(10, 4880000), preapprovalApprovedNotAccepted: cs(27, 12545000) },
      loanTypes: { conventional: cs(15032, 4856790000), fha: cs(2956, 1282300000), va: cs(622, 329210000), usda: cs(23, 7405000) },
      purposes: { purchase: cs(10435, 4623365000), homeImprovement: cs(2141, 244965000), refinance: cs(2689, 932815000), cashOutRefinance: cs(1476, 436850000), other: cs(1890, 236780000), notApplicable: cs(2, 930000) },
    },
    y2023: { actions: { originated: cs(17385, 6138935000), approvedNotAccepted: cs(908, 253470000), denied: cs(4114, 1091870000), withdrawn: cs(3891, 1607585000), incomplete: cs(1348, 386960000), purchased: cs(3367, 1668515000), preapprovalDenied: cs(6, 1910000), preapprovalApprovedNotAccepted: cs(13, 5555000) } },
    comparableTo2023: false,
  },
  "21794": {
    y2024: {
      actions: { originated: cs(17595, 8472895000), approvedNotAccepted: cs(824, 311800000), denied: cs(4945, 1328615000), withdrawn: cs(4277, 2367185000), incomplete: cs(1381, 545155000), purchased: cs(2762, 1582870000), preapprovalDenied: cs(21, 11765000), preapprovalApprovedNotAccepted: cs(151, 87695000) },
      loanTypes: { conventional: cs(15410, 7226230000), fha: cs(1348, 733580000), va: cs(818, 509590000), usda: cs(19, 3495000) },
      purposes: { purchase: cs(9494, 5994520000), homeImprovement: cs(2133, 293065000), refinance: cs(2259, 1215335000), cashOutRefinance: cs(1794, 691010000), other: cs(1915, 278965000), notApplicable: cs(0, 0) },
    },
    comparableTo2023: false,
  },
  "19780": {
    y2024: {
      actions: { originated: cs(19468, 4423770000), approvedNotAccepted: cs(727, 107195000), denied: cs(3375, 464945000), withdrawn: cs(3666, 790010000), incomplete: cs(1008, 139430000), purchased: cs(3399, 968775000), preapprovalDenied: cs(19, 4015000), preapprovalApprovedNotAccepted: cs(39, 11585000) },
      loanTypes: { conventional: cs(16504, 3622540000), fha: cs(1825, 451295000), va: cs(1038, 334320000), usda: cs(101, 15615000) },
      purposes: { purchase: cs(11460, 3111780000), homeImprovement: cs(1685, 118885000), refinance: cs(2114, 656740000), cashOutRefinance: cs(1538, 291650000), other: cs(2663, 243895000), notApplicable: cs(8, 820000) },
    },
    y2023: { actions: { originated: cs(18162, 3927350000), approvedNotAccepted: cs(530, 83000000), denied: cs(3162, 390790000), withdrawn: cs(3595, 719875000), incomplete: cs(882, 118360000), purchased: cs(3373, 878525000), preapprovalDenied: cs(22, 4230000), preapprovalApprovedNotAccepted: cs(37, 7935000) } },
    comparableTo2023: true,
  },
  "38940": {
    y2024: {
      actions: { originated: cs(13962, 4885640000), approvedNotAccepted: cs(779, 183915000), denied: cs(6233, 1367395000), withdrawn: cs(4208, 1401550000), incomplete: cs(1552, 355720000), purchased: cs(4657, 1522525000), preapprovalDenied: cs(11, 3375000), preapprovalApprovedNotAccepted: cs(38, 14720000) },
      loanTypes: { conventional: cs(9628, 3274770000), fha: cs(3232, 1154840000), va: cs(1099, 455795000), usda: cs(3, 235000) },
      purposes: { purchase: cs(9005, 3406735000), homeImprovement: cs(1162, 128170000), refinance: cs(970, 360810000), cashOutRefinance: cs(1708, 843020000), other: cs(1114, 146130000), notApplicable: cs(3, 775000) },
    },
    y2023: { actions: { originated: cs(13539, 4237745000), approvedNotAccepted: cs(698, 163470000), denied: cs(6406, 1323480000), withdrawn: cs(4321, 1303065000), incomplete: cs(1407, 327075000), purchased: cs(4394, 1469830000), preapprovalDenied: cs(10, 2900000), preapprovalApprovedNotAccepted: cs(19, 12545000) } },
    comparableTo2023: true,
  },
  "24660": {
    y2024: {
      actions: { originated: cs(16248, 3783810000), approvedNotAccepted: cs(837, 157465000), denied: cs(6420, 841990000), withdrawn: cs(3587, 781855000), incomplete: cs(1843, 285165000), purchased: cs(2330, 633980000), preapprovalDenied: cs(16, 4060000), preapprovalApprovedNotAccepted: cs(48, 14840000) },
      loanTypes: { conventional: cs(12664, 2792090000), fha: cs(2265, 595275000), va: cs(1201, 373465000), usda: cs(118, 22980000) },
      purposes: { purchase: cs(8731, 2350125000), homeImprovement: cs(1810, 153720000), refinance: cs(1914, 622040000), cashOutRefinance: cs(1973, 429655000), other: cs(1818, 227780000), notApplicable: cs(2, 490000) },
    },
    y2023: { actions: { originated: cs(15293, 3455945000), approvedNotAccepted: cs(682, 123250000), denied: cs(5827, 739155000), withdrawn: cs(3436, 709340000), incomplete: cs(1780, 268570000), purchased: cs(1910, 480200000), preapprovalDenied: cs(21, 4485000), preapprovalApprovedNotAccepted: cs(31, 7675000) } },
    comparableTo2023: true,
  },
  "36260": {
    y2024: {
      actions: { originated: cs(18148, 5510550000), approvedNotAccepted: cs(1113, 302485000), denied: cs(4456, 1056710000), withdrawn: cs(3138, 1169670000), incomplete: cs(982, 242530000), purchased: cs(2829, 1250725000), preapprovalDenied: cs(10, 3910000), preapprovalApprovedNotAccepted: cs(27, 11085000) },
      loanTypes: { conventional: cs(14440, 3853760000), fha: cs(2292, 964490000), va: cs(1414, 691660000), usda: cs(2, 640000) },
      purposes: { purchase: cs(7782, 3387230000), homeImprovement: cs(2785, 295535000), refinance: cs(3006, 915850000), cashOutRefinance: cs(1996, 598950000), other: cs(2579, 312985000), notApplicable: cs(0, 0) },
    },
    y2023: { actions: { originated: cs(19077, 5084515000), approvedNotAccepted: cs(1024, 241610000), denied: cs(4686, 908580000), withdrawn: cs(3511, 1347785000), incomplete: cs(1076, 271210000), purchased: cs(2662, 1108340000), preapprovalDenied: cs(6, 2260000), preapprovalApprovedNotAccepted: cs(15, 6035000) } },
    comparableTo2023: false,
  },
  "49340": {
    y2024: {
      actions: { originated: cs(16979, 5338265000), approvedNotAccepted: cs(628, 172040000), denied: cs(4984, 1029060000), withdrawn: cs(3585, 1230575000), incomplete: cs(1585, 378225000), purchased: cs(2734, 1126110000), preapprovalDenied: cs(19, 7305000), preapprovalApprovedNotAccepted: cs(74, 29850000) },
      loanTypes: { conventional: cs(14591, 4384375000), fha: cs(1733, 669485000), va: cs(634, 281050000), usda: cs(21, 3355000) },
      purposes: { purchase: cs(8651, 3569085000), homeImprovement: cs(2561, 330965000), refinance: cs(1941, 706315000), cashOutRefinance: cs(2238, 549430000), other: cs(1588, 182470000), notApplicable: cs(0, 0) },
    },
    y2023: { actions: { originated: cs(18057, 5030545000), approvedNotAccepted: cs(585, 162215000), denied: cs(5462, 1040580000), withdrawn: cs(3735, 1159605000), incomplete: cs(1743, 393365000), purchased: cs(2661, 950865000), preapprovalDenied: cs(20, 6450000), preapprovalApprovedNotAccepted: cs(39, 14465000) } },
    comparableTo2023: true,
  },
  "29414": {
    y2024: {
      actions: { originated: cs(16259, 3483035000), approvedNotAccepted: cs(684, 153130000), denied: cs(4995, 646425000), withdrawn: cs(3436, 733300000), incomplete: cs(1276, 206580000), purchased: cs(3772, 942710000), preapprovalDenied: cs(14, 2670000), preapprovalApprovedNotAccepted: cs(29, 7945000) },
      loanTypes: { conventional: cs(12474, 2517870000), fha: cs(2880, 699700000), va: cs(866, 257730000), usda: cs(39, 7735000) },
      purposes: { purchase: cs(8769, 2319345000), homeImprovement: cs(1736, 140030000), refinance: cs(1869, 483255000), cashOutRefinance: cs(2305, 408685000), other: cs(1572, 130480000), notApplicable: cs(8, 1240000) },
    },
    comparableTo2023: false,
  },
  "15380": {
    y2024: {
      actions: { originated: cs(18211, 4625945000), approvedNotAccepted: cs(531, 80235000), denied: cs(5180, 718200000), withdrawn: cs(2469, 492045000), incomplete: cs(1170, 156450000), purchased: cs(2646, 680880000), preapprovalDenied: cs(11, 3195000), preapprovalApprovedNotAccepted: cs(37, 11155000) },
      loanTypes: { conventional: cs(15691, 4021995000), fha: cs(1786, 396070000), va: cs(725, 206075000), usda: cs(9, 1805000) },
      purposes: { purchase: cs(9803, 2615305000), homeImprovement: cs(2565, 234165000), refinance: cs(1780, 478120000), cashOutRefinance: cs(2293, 1099015000), other: cs(1767, 199155000), notApplicable: cs(3, 185000) },
    },
    y2023: { actions: { originated: cs(18093, 4057505000), approvedNotAccepted: cs(479, 107665000), denied: cs(5549, 703795000), withdrawn: cs(2482, 525820000), incomplete: cs(1045, 133495000), purchased: cs(2639, 592245000), preapprovalDenied: cs(10, 1460000), preapprovalApprovedNotAccepted: cs(9, 2045000) } },
    comparableTo2023: true,
  },
  "48864": {
    y2024: {
      actions: { originated: cs(14851, 3867895000), approvedNotAccepted: cs(673, 155425000), denied: cs(5257, 929635000), withdrawn: cs(3508, 1070160000), incomplete: cs(1535, 334635000), purchased: cs(4094, 1331020000), preapprovalDenied: cs(4, 1410000), preapprovalApprovedNotAccepted: cs(51, 14985000) },
      loanTypes: { conventional: cs(11702, 2851470000), fha: cs(2198, 650510000), va: cs(906, 354320000), usda: cs(45, 11595000) },
      purposes: { purchase: cs(7646, 2509690000), homeImprovement: cs(1811, 177725000), refinance: cs(1787, 586685000), cashOutRefinance: cs(2213, 453435000), other: cs(1388, 139120000), notApplicable: cs(6, 1240000) },
    },
    y2023: { actions: { originated: cs(13308, 3617470000), approvedNotAccepted: cs(568, 120170000), denied: cs(4920, 1757490000), withdrawn: cs(3222, 916750000), incomplete: cs(1360, 292030000), purchased: cs(3363, 1001755000), preapprovalDenied: cs(8, 2160000), preapprovalApprovedNotAccepted: cs(17, 5785000) } },
    comparableTo2023: true,
  },
  "20994": {
    y2024: {
      actions: { originated: cs(15840, 4215420000), approvedNotAccepted: cs(709, 140815000), denied: cs(4554, 779200000), withdrawn: cs(3497, 1099335000), incomplete: cs(1262, 236930000), purchased: cs(3710, 1145300000), preapprovalDenied: cs(19, 4215000), preapprovalApprovedNotAccepted: cs(40, 13100000) },
      loanTypes: { conventional: cs(13265, 3397915000), fha: cs(1902, 568240000), va: cs(663, 247305000), usda: cs(10, 1960000) },
      purposes: { purchase: cs(9284, 3017240000), homeImprovement: cs(1248, 123620000), refinance: cs(1763, 534775000), cashOutRefinance: cs(1840, 389450000), other: cs(1704, 150290000), notApplicable: cs(1, 45000) },
    },
    y2023: { actions: { originated: cs(14018, 3427280000), approvedNotAccepted: cs(526, 136590000), denied: cs(3907, 578555000), withdrawn: cs(3272, 937380000), incomplete: cs(1195, 218745000), purchased: cs(3502, 971510000), preapprovalDenied: cs(12, 3430000), preapprovalApprovedNotAccepted: cs(23, 5625000) } },
    comparableTo2023: true,
  },
  "49180": {
    y2024: {
      actions: { originated: cs(16141, 3794755000), approvedNotAccepted: cs(721, 170855000), denied: cs(5320, 1019400000), withdrawn: cs(3457, 747385000), incomplete: cs(1544, 242580000), purchased: cs(2310, 635200000), preapprovalDenied: cs(23, 5815000), preapprovalApprovedNotAccepted: cs(40, 10390000) },
      loanTypes: { conventional: cs(12492, 2802720000), fha: cs(2257, 576995000), va: cs(1306, 397030000), usda: cs(86, 18010000) },
      purposes: { purchase: cs(8629, 2447035000), homeImprovement: cs(1796, 156110000), refinance: cs(2056, 520480000), cashOutRefinance: cs(1856, 499490000), other: cs(1804, 171640000), notApplicable: cs(0, 0) },
    },
    y2023: { actions: { originated: cs(15269, 3250425000), approvedNotAccepted: cs(597, 112095000), denied: cs(5070, 653960000), withdrawn: cs(3175, 663735000), incomplete: cs(1483, 238955000), purchased: cs(2069, 790705000), preapprovalDenied: cs(21, 4755000), preapprovalApprovedNotAccepted: cs(24, 7060000) } },
    comparableTo2023: true,
  },
  "12940": {
    y2024: {
      actions: { originated: cs(13715, 3477745000), approvedNotAccepted: cs(987, 163215000), denied: cs(5427, 824675000), withdrawn: cs(3622, 827920000), incomplete: cs(1456, 234750000), purchased: cs(4170, 1052630000), preapprovalDenied: cs(13, 2995000), preapprovalApprovedNotAccepted: cs(55, 11895000) },
      loanTypes: { conventional: cs(9119, 2328865000), fha: cs(3114, 754320000), va: cs(924, 279260000), usda: cs(558, 115300000) },
      purposes: { purchase: cs(8883, 2365135000), homeImprovement: cs(605, 65115000), refinance: cs(1702, 472770000), cashOutRefinance: cs(1274, 451510000), other: cs(1251, 123215000), notApplicable: cs(0, 0) },
    },
    y2023: { actions: { originated: cs(12548, 3100780000), approvedNotAccepted: cs(782, 128520000), denied: cs(4936, 727530000), withdrawn: cs(3581, 819275000), incomplete: cs(1404, 206770000), purchased: cs(3180, 775010000), preapprovalDenied: cs(12, 2260000), preapprovalApprovedNotAccepted: cs(45, 10115000) } },
    comparableTo2023: true,
  },
  "26620": {
    y2024: {
      actions: { originated: cs(15523, 4159395000), approvedNotAccepted: cs(896, 188160000), denied: cs(3971, 808115000), withdrawn: cs(3208, 933170000), incomplete: cs(1248, 260290000), purchased: cs(4020, 1272730000), preapprovalDenied: cs(4, 850000), preapprovalApprovedNotAccepted: cs(32, 10440000) },
      loanTypes: { conventional: cs(10060, 2340790000), fha: cs(2544, 707280000), va: cs(2683, 1050655000), usda: cs(236, 60670000) },
      purposes: { purchase: cs(9261, 2853415000), homeImprovement: cs(1232, 107170000), refinance: cs(2085, 636995000), cashOutRefinance: cs(1652, 439000000), other: cs(1292, 122640000), notApplicable: cs(1, 175000) },
    },
    y2023: { actions: { originated: cs(14029, 3907935000), approvedNotAccepted: cs(806, 180230000), denied: cs(3846, 585870000), withdrawn: cs(2996, 950520000), incomplete: cs(1203, 222725000), purchased: cs(3214, 967130000), preapprovalDenied: cs(6, 1930000), preapprovalApprovedNotAccepted: cs(6, 1880000) } },
    comparableTo2023: true,
  },
  "48900": {
    y2024: {
      actions: { originated: cs(15254, 5233900000), approvedNotAccepted: cs(710, 194010000), denied: cs(4369, 872905000), withdrawn: cs(3514, 1200220000), incomplete: cs(1429, 300515000), purchased: cs(3504, 3267330000), preapprovalDenied: cs(17, 6345000), preapprovalApprovedNotAccepted: cs(28, 10020000) },
      loanTypes: { conventional: cs(12331, 4247545000), fha: cs(1466, 417650000), va: cs(1425, 559855000), usda: cs(32, 8850000) },
      purposes: { purchase: cs(9100, 3662190000), homeImprovement: cs(1380, 163880000), refinance: cs(1608, 744860000), cashOutRefinance: cs(1386, 363270000), other: cs(1777, 296945000), notApplicable: cs(3, 2755000) },
    },
    y2023: { actions: { originated: cs(7997, 2642185000), approvedNotAccepted: cs(358, 108220000), denied: cs(2476, 531880000), withdrawn: cs(1839, 706575000), incomplete: cs(853, 179005000), purchased: cs(1455, 534465000), preapprovalDenied: cs(4, 2550000), preapprovalApprovedNotAccepted: cs(10, 3390000) } },
    comparableTo2023: false,
  },
};
