/**
 * 2024 HMDA numbers for the core county of each big-city market page (src/content/metro-markets.ts).
 *
 * Source: CFPB / FFIEC HMDA Data Browser aggregations API
 * (https://ffiec.cfpb.gov/v2/data-browser-api/view/aggregations), originated loans only
 * (actions_taken=1), year 2024, fetched 2026-11-18, one query by loan_types=1,2,3,4 and one by
 * loan_purposes=1,2,31,32,4 per county. Raw responses are in the project files under
 * ypnus/hmda/metro-2024.tsv. The total is the sum of the four loan types (every originated loan
 * has one); purposes can sum to slightly less because code 5 (not applicable) is not queried.
 * Dollar sums are HMDA public loan amounts, banded to the midpoint of $10,000 ranges.
 */
import type { CountSum } from "@/content/market-report";

export interface MetroYear {
  total: CountSum;
  loanTypes: { conventional: CountSum; fha: CountSum; va: CountSum; usda: CountSum };
  purposes: { purchase: CountSum; homeImprovement: CountSum; refinance: CountSum; cashOutRefinance: CountSum; other: CountSum };
}

export const METRO_DATA_FETCHED_ON = "2026-11-18";
export const METRO_DATA_YEAR = 2024;

const cs = (count: number, sum: number): CountSum => ({ count, sum });

/** Keyed by five-digit county FIPS code. */
export const METRO_HMDA_2024: Readonly<Record<string, MetroYear>> = {
  "04013": {
    total: cs(102128, 39136830000),
    loanTypes: { conventional: cs(78952, 29685440000), fha: cs(15936, 6066060000), va: cs(7226, 3384090000), usda: cs(14, 1240000) },
    purposes: {
      purchase: cs(54313, 25554855000),
      homeImprovement: cs(10714, 1344270000),
      refinance: cs(11482, 6360480000),
      cashOutRefinance: cs(13287, 4284985000),
      other: cs(12314, 1581960000),
    },
  },
  "04019": {
    total: cs(21937, 6226435000),
    loanTypes: { conventional: cs(14873, 3907365000), fha: cs(4050, 1200450000), va: cs(3003, 1115535000), usda: cs(11, 3085000) },
    purposes: {
      purchase: cs(12435, 4185815000),
      homeImprovement: cs(1903, 181195000),
      refinance: cs(2071, 937685000),
      cashOutRefinance: cs(3301, 680825000),
      other: cs(2223, 238375000),
    },
  },
  "06037": {
    total: cs(95267, 63727945000),
    loanTypes: { conventional: cs(84414, 56760980000), fha: cs(8748, 5469090000), va: cs(2089, 1494005000), usda: cs(16, 3870000) },
    purposes: {
      purchase: cs(43093, 36672265000),
      homeImprovement: cs(10713, 2263335000),
      refinance: cs(12255, 11587595000),
      cashOutRefinance: cs(18638, 10288350000),
      other: cs(10432, 2731990000),
    },
  },
  "06067": {
    total: cs(26134, 10007550000),
    loanTypes: { conventional: cs(21787, 7964595000), fha: cs(3100, 1416090000), va: cs(1233, 626165000), usda: cs(14, 700000) },
    purposes: {
      purchase: cs(14587, 6968155000),
      homeImprovement: cs(2823, 312845000),
      refinance: cs(2464, 1451800000),
      cashOutRefinance: cs(3802, 993600000),
      other: cs(2447, 277425000),
    },
  },
  "06073": {
    total: cs(46847, 30320135000),
    loanTypes: { conventional: cs(38715, 24520965000), fha: cs(3160, 1989260000), va: cs(4957, 3807495000), usda: cs(15, 2415000) },
    purposes: {
      purchase: cs(21968, 20006890000),
      homeImprovement: cs(6353, 1211455000),
      refinance: cs(6339, 4803135000),
      cashOutRefinance: cs(7581, 3216795000),
      other: cs(4559, 1039905000),
    },
  },
  "06085": {
    total: cs(21200, 22025300000),
    loanTypes: { conventional: cs(20718, 21654790000), fha: cs(351, 247925000), va: cs(131, 122585000), usda: cs(0, 0) },
    purposes: {
      purchase: cs(11482, 14425970000),
      homeImprovement: cs(1938, 510380000),
      refinance: cs(4048, 5082000000),
      cashOutRefinance: cs(2113, 1423255000),
      other: cs(1607, 573175000),
    },
  },
  "11001": {
    total: cs(8361, 5800385000),
    loanTypes: { conventional: cs(7473, 5262485000), fha: cs(427, 218065000), va: cs(461, 319835000), usda: cs(0, 0) },
    purposes: {
      purchase: cs(5447, 4029885000),
      homeImprovement: cs(649, 170275000),
      refinance: cs(910, 982370000),
      cashOutRefinance: cs(886, 491260000),
      other: cs(468, 123590000),
    },
  },
  "12031": {
    total: cs(20955, 6320035000),
    loanTypes: { conventional: cs(13575, 4006605000), fha: cs(3832, 1075620000), va: cs(3529, 1237305000), usda: cs(19, 505000) },
    purposes: {
      purchase: cs(13165, 4224185000),
      homeImprovement: cs(1326, 207980000),
      refinance: cs(1539, 698165000),
      cashOutRefinance: cs(3473, 1025285000),
      other: cs(1441, 161515000),
    },
  },
  "12095": {
    total: cs(24205, 9055215000),
    loanTypes: { conventional: cs(19161, 7106625000), fha: cs(3683, 1287375000), va: cs(1357, 661155000), usda: cs(4, 60000) },
    purposes: {
      purchase: cs(14689, 6451485000),
      homeImprovement: cs(1981, 259405000),
      refinance: cs(1687, 916915000),
      cashOutRefinance: cs(3427, 1050605000),
      other: cs(2414, 374060000),
    },
  },
  "16001": {
    total: cs(13409, 4933795000),
    loanTypes: { conventional: cs(11215, 3984945000), fha: cs(1197, 471275000), va: cs(988, 475800000), usda: cs(9, 1775000) },
    purposes: {
      purchase: cs(7599, 3285745000),
      homeImprovement: cs(1913, 247975000),
      refinance: cs(1007, 501885000),
      cashOutRefinance: cs(1921, 767215000),
      other: cs(964, 129330000),
    },
  },
  "17031": {
    total: cs(73060, 26136580000),
    loanTypes: { conventional: cs(62947, 23116715000), fha: cs(8046, 2280500000), va: cs(2063, 739315000), usda: cs(4, 50000) },
    purposes: {
      purchase: cs(46797, 17176715000),
      homeImprovement: cs(5023, 738665000),
      refinance: cs(8129, 5427845000),
      cashOutRefinance: cs(8037, 2148205000),
      other: cs(5071, 644525000),
    },
  },
  "18097": {
    total: cs(20959, 5095295000),
    loanTypes: { conventional: cs(16024, 3923510000), fha: cs(3782, 861880000), va: cs(1146, 309810000), usda: cs(7, 95000) },
    purposes: {
      purchase: cs(12077, 3290665000),
      homeImprovement: cs(1922, 225920000),
      refinance: cs(2164, 787820000),
      cashOutRefinance: cs(2998, 603430000),
      other: cs(1692, 164720000),
    },
  },
  "26163": {
    total: cs(30371, 5482315000),
    loanTypes: { conventional: cs(24863, 4363875000), fha: cs(4428, 853170000), va: cs(1037, 264045000), usda: cs(43, 1225000) },
    purposes: {
      purchase: cs(16361, 3585195000),
      homeImprovement: cs(3081, 247385000),
      refinance: cs(3121, 674775000),
      cashOutRefinance: cs(4670, 693730000),
      other: cs(3133, 280265000),
    },
  },
  "32003": {
    total: cs(48834, 18160280000),
    loanTypes: { conventional: cs(34478, 12437570000), fha: cs(8935, 3277885000), va: cs(5360, 2442810000), usda: cs(61, 2015000) },
    purposes: {
      purchase: cs(30760, 12899550000),
      homeImprovement: cs(2919, 323905000),
      refinance: cs(4342, 2715380000),
      cashOutRefinance: cs(6070, 1645670000),
      other: cs(4681, 555005000),
    },
  },
  "35001": {
    total: cs(13423, 3183195000),
    loanTypes: { conventional: cs(10168, 2180910000), fha: cs(1962, 553620000), va: cs(1198, 447730000), usda: cs(95, 935000) },
    purposes: {
      purchase: cs(7694, 2093010000),
      homeImprovement: cs(1140, 113800000),
      refinance: cs(1346, 488300000),
      cashOutRefinance: cs(1695, 349825000),
      other: cs(1547, 138155000),
    },
  },
  "36047": {
    total: cs(11232, 12871510000),
    loanTypes: { conventional: cs(10727, 12394945000), fha: cs(456, 437800000), va: cs(49, 38765000), usda: cs(0, 0) },
    purposes: {
      purchase: cs(7124, 6624410000),
      homeImprovement: cs(799, 226885000),
      refinance: cs(1210, 3766370000),
      cashOutRefinance: cs(1471, 1990265000),
      other: cs(628, 263580000),
    },
  },
  "37119": {
    total: cs(27658, 11810580000),
    loanTypes: { conventional: cs(23737, 10375565000), fha: cs(2692, 902830000), va: cs(1223, 532095000), usda: cs(6, 90000) },
    purposes: {
      purchase: cs(15526, 7217920000),
      homeImprovement: cs(2954, 432380000),
      refinance: cs(3214, 2121450000),
      cashOutRefinance: cs(3258, 1603280000),
      other: cs(2698, 433860000),
    },
  },
  "37183": {
    total: cs(29977, 11233725000),
    loanTypes: { conventional: cs(26431, 9842915000), fha: cs(2099, 716355000), va: cs(1387, 655825000), usda: cs(60, 18630000) },
    purposes: {
      purchase: cs(17338, 7630680000),
      homeImprovement: cs(3510, 494830000),
      refinance: cs(3739, 1855815000),
      cashOutRefinance: cs(2414, 785320000),
      other: cs(2974, 433780000),
    },
  },
  "39035": {
    total: cs(24095, 5130255000),
    loanTypes: { conventional: cs(20400, 4375910000), fha: cs(2737, 513985000), va: cs(958, 240360000), usda: cs(0, 0) },
    purposes: {
      purchase: cs(12824, 3084320000),
      homeImprovement: cs(2821, 245715000),
      refinance: cs(2925, 698525000),
      cashOutRefinance: cs(2896, 833440000),
      other: cs(2593, 248245000),
    },
  },
  "41051": {
    total: cs(12754, 5023210000),
    loanTypes: { conventional: cs(11117, 4313975000), fha: cs(1219, 515485000), va: cs(418, 193750000), usda: cs(0, 0) },
    purposes: {
      purchase: cs(7405, 3480785000),
      homeImprovement: cs(1754, 185100000),
      refinance: cs(1433, 899185000),
      cashOutRefinance: cs(1058, 328270000),
      other: cs(1102, 129080000),
    },
  },
  "45019": {
    total: cs(10376, 5166200000),
    loanTypes: { conventional: cs(8966, 4571920000), fha: cs(738, 256010000), va: cs(668, 337740000), usda: cs(4, 530000) },
    purposes: {
      purchase: cs(5852, 3588930000),
      homeImprovement: cs(1170, 206890000),
      refinance: cs(1078, 609450000),
      cashOutRefinance: cs(1449, 533765000),
      other: cs(823, 225305000),
    },
  },
  "47037": {
    total: cs(15497, 6984325000),
    loanTypes: { conventional: cs(13079, 6048915000), fha: cs(1815, 664305000), va: cs(583, 270795000), usda: cs(20, 310000) },
    purposes: {
      purchase: cs(9472, 4727530000),
      homeImprovement: cs(1145, 266415000),
      refinance: cs(1700, 1093010000),
      cashOutRefinance: cs(1792, 622460000),
      other: cs(1384, 273100000),
    },
  },
  "48201": {
    total: cs(58870, 21074580000),
    loanTypes: { conventional: cs(43578, 16313190000), fha: cs(11755, 3489805000), va: cs(3389, 1266605000), usda: cs(148, 4980000) },
    purposes: {
      purchase: cs(43503, 16209695000),
      homeImprovement: cs(2310, 330240000),
      refinance: cs(4193, 2228565000),
      cashOutRefinance: cs(5761, 1785095000),
      other: cs(3080, 470930000),
    },
  },
  "48439": {
    total: cs(33668, 12094790000),
    loanTypes: { conventional: cs(24199, 8837865000), fha: cs(6549, 2078905000), va: cs(2883, 1176745000), usda: cs(37, 1275000) },
    purposes: {
      purchase: cs(23374, 8793240000),
      homeImprovement: cs(1766, 214620000),
      refinance: cs(2743, 1463545000),
      cashOutRefinance: cs(3809, 1345515000),
      other: cs(1959, 273665000),
    },
  },
  "48453": {
    total: cs(19709, 11238845000),
    loanTypes: { conventional: cs(17066, 10167400000), fha: cs(1850, 678300000), va: cs(760, 387150000), usda: cs(33, 5995000) },
    purposes: {
      purchase: cs(14197, 7723255000),
      homeImprovement: cs(870, 176060000),
      refinance: cs(1417, 1632315000),
      cashOutRefinance: cs(2139, 1347995000),
      other: cs(1056, 341880000),
    },
  },
};

