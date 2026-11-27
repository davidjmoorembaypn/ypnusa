#!/usr/bin/env node
// Builds src/lib/geo/area-data.generated.ts: the county each ZIP code is in, owner and renter
// households per ZIP code, county births, deaths and migration, and state marriage and divorce
// rates. Area-level figures only: nothing in these files describes a person or a household.
//
// Put these seven public files in one folder (none needs an account or a key):
//   US.txt                    GeoNames US postal codes (CC BY 4.0)
//                             https://download.geonames.org/export/zip/US.zip
//   acsdt5y2023-b25003.dat    Census ACS 2019-2023 5-year, tenure (owner and renter households)
//   acsdt5y2023-b07013.dat    ... people in households, and how many moved in the past year
//   acsdt5y2023-b07013pr.dat  ... the same table for Puerto Rico
//   acsdt5y2023-b12503.dat    ... divorces in the last year (published for states, not counties)
//   acsdt5y2023-b12501.dat    ... marriages in the last year (published for states, not counties)
//                             https://www2.census.gov/programs-surveys/acs/summary_file/2023/table-based-SF/data/5YRData/
//   co-est2025-alldata.csv    Census Population Estimates, Vintage 2025, county components of change
//                             https://www2.census.gov/programs-surveys/popest/datasets/2020-2025/counties/totals/
//
//   node scripts/build-area-data.mjs path/to/folder
//
// To move to a newer release, change the constants below and the labels in src/lib/area-data.ts.
// Server-only module: never import it from a client component.

import fs from "node:fs";
import path from "node:path";
import zlib from "node:zlib";
import { fileURLToPath } from "node:url";

const dir = process.argv[2];
if (!dir) {
  console.error("Usage: node scripts/build-area-data.mjs path/to/folder");
  process.exit(1);
}

const ACS_PREFIX = "acsdt5y2023-";
const ACS_VINTAGE = "2019-2023";
const PEP_FILE = "co-est2025-alldata.csv";
const PEP_YEAR = "2025";
const PEP_PERIOD = "July 1, 2024 to June 30, 2025";

const STATE_FIPS = {
  AL: "01", AK: "02", AZ: "04", AR: "05", CA: "06", CO: "08", CT: "09", DE: "10", DC: "11", FL: "12",
  GA: "13", HI: "15", ID: "16", IL: "17", IN: "18", IA: "19", KS: "20", KY: "21", LA: "22", ME: "23",
  MD: "24", MA: "25", MI: "26", MN: "27", MS: "28", MO: "29", MT: "30", NE: "31", NV: "32", NH: "33",
  NJ: "34", NM: "35", NY: "36", NC: "37", ND: "38", OH: "39", OK: "40", OR: "41", PA: "42", RI: "44",
  SC: "45", SD: "46", TN: "47", TX: "48", UT: "49", VT: "50", VA: "51", WA: "53", WV: "54", WI: "55",
  WY: "56", PR: "72",
};
const ABBR_BY_FIPS = Object.fromEntries(Object.entries(STATE_FIPS).map(([abbr, fips]) => [fips, abbr]));

function read(file, encoding = "utf8") {
  const full = path.join(dir, file);
  if (!fs.existsSync(full)) throw new Error(`Missing ${full}. See the list at the top of this script.`);
  return fs.readFileSync(full, encoding);
}

const clean = (value) => String(value ?? "").replace(/[|\n\r]/g, " ").trim();
const count = (value) => {
  const n = Number(value);
  return Number.isFinite(n) && n >= 0 ? Math.round(n) : 0;
};
/**
 * An ACS estimate, or null when it was not published. The Census marks an unavailable estimate
 * with a negative code (such as -666666666) or leaves it empty; neither is a measured zero.
 */
const estimate = (value) => {
  if (value === undefined || String(value).trim() === "") return null;
  const n = Number(value);
  return Number.isFinite(n) && n >= 0 ? Math.round(n) : null;
};

/** One ACS table: Map<GEO_ID, Record<column, number>> for rows whose GEO_ID starts with `prefix`. */
function acsTable(file, prefix, columns) {
  const lines = read(`${ACS_PREFIX}${file}`).split(/\r?\n/);
  const header = lines[0].split("|");
  const at = columns.map((c) => {
    const i = header.indexOf(c);
    if (i < 0) throw new Error(`${file} has no column ${c}`);
    return i;
  });
  const out = new Map();
  for (const line of lines) {
    if (!line.startsWith(prefix)) continue;
    const f = line.split("|");
    out.set(f[0].slice(prefix.length), Object.fromEntries(columns.map((c, k) => [c, estimate(f[at[k]])])));
  }
  return out;
}

// --- Counties and the nation: population estimates and components of change ----------------------
// A quoted-field-aware split is not needed: the only quoted values would be names with commas, and
// this file has none. The check below fails loudly if that ever changes.
// The estimates file is Latin-1 (for example "Doña Ana County").
const pepLines = read(PEP_FILE, "latin1").split(/\r?\n/).filter(Boolean);
const pepHeader = pepLines[0].split(",");
const col = (name) => {
  const i = pepHeader.indexOf(name);
  if (i < 0) throw new Error(`${PEP_FILE} has no column ${name}`);
  return i;
};
const P = {
  sumlev: col("SUMLEV"), state: col("STATE"), county: col("COUNTY"), stname: col("STNAME"), ctyname: col("CTYNAME"),
  pop: col(`POPESTIMATE${PEP_YEAR}`), births: col(`BIRTHS${PEP_YEAR}`), deaths: col(`DEATHS${PEP_YEAR}`),
  dom: col(`DOMESTICMIG${PEP_YEAR}`), intl: col(`INTERNATIONALMIG${PEP_YEAR}`),
};
const signed = (value) => {
  const n = Number(value);
  return Number.isFinite(n) ? Math.round(n) : 0;
};

const counties = new Map();
const stateNames = new Map();
const nation = { population: 0, births: 0, deaths: 0, internationalMigration: 0 };
for (const line of pepLines.slice(1)) {
  const f = line.split(",");
  if (f.length !== pepHeader.length) throw new Error(`${PEP_FILE}: a row has ${f.length} fields, expected ${pepHeader.length}`);
  const stateFips = f[P.state];
  if (f[P.sumlev] === "040") {
    stateNames.set(stateFips, clean(f[P.stname]));
    nation.population += count(f[P.pop]);
    nation.births += count(f[P.births]);
    nation.deaths += count(f[P.deaths]);
    // Moves between states cancel out across the country; moves to and from abroad do not.
    nation.internationalMigration += signed(f[P.intl]);
    continue;
  }
  if (f[P.sumlev] !== "050") continue;
  const fips = `${stateFips}${f[P.county]}`;
  counties.set(fips, {
    name: clean(f[P.ctyname]),
    state: ABBR_BY_FIPS[stateFips] ?? "",
    population: count(f[P.pop]),
    births: count(f[P.births]),
    deaths: count(f[P.deaths]),
    domesticMigration: signed(f[P.dom]),
    internationalMigration: signed(f[P.intl]),
  });
}

// --- States and the nation: marriages and divorces in the last year -------------------------------
// E001 people aged 15 and over; E005 men and E010 women who married (B12501) or divorced (B12503)
// in the last year. The Census does not publish these 5-year tables for counties.
const maritalColumns = (t) => [`${t}_E001`, `${t}_E005`, `${t}_E010`];
const divorces = { state: acsTable("b12503.dat", "0400000US", maritalColumns("B12503")), us: acsTable("b12503.dat", "0100000US", maritalColumns("B12503")).get("") };
const marriages = { state: acsTable("b12501.dat", "0400000US", maritalColumns("B12501")), us: acsTable("b12501.dat", "0100000US", maritalColumns("B12501")).get("") };
if (!divorces.us || !marriages.us) throw new Error("The marriage or divorce table has no national row.");

const complete = (row) => Boolean(row) && Object.values(row).every((value) => value !== null);
if (!complete(divorces.us) || !complete(marriages.us)) throw new Error("The national marriage or divorce row has an unpublished value.");

const states = [];
for (const [fips, d] of divorces.state) {
  const m = marriages.state.get(fips);
  const abbr = ABBR_BY_FIPS[fips];
  // A state with any unpublished value is left out, so it shows as "no data", never as zero.
  if (!abbr || !complete(d) || !complete(m)) continue;
  states.push(`${fips}|${abbr}|${stateNames.get(fips) ?? abbr}|${d.B12503_E001}|${d.B12503_E005 + d.B12503_E010}|${m.B12501_E005 + m.B12501_E010}`);
}
states.sort();

// --- ZIP codes: county, tenure and mobility ------------------------------------------------------
const tenure = acsTable("b25003.dat", "860Z200US", ["B25003_E002", "B25003_E003"]);
// E001 people aged 1 and over living in households; E004 of those, in the same house a year ago.
// The table leaves out people in group quarters (dormitories, barracks, care homes), so the
// mobility share must be worked out against E001, never against total population.
const mobility = acsTable("b07013.dat", "860Z200US", ["B07013_E001", "B07013_E004"]);
for (const [zip, row] of acsTable("b07013pr.dat", "860Z200US", ["B07013PR_E001", "B07013PR_E004"])) {
  if (!mobility.has(zip)) mobility.set(zip, { B07013_E001: row.B07013PR_E001, B07013_E004: row.B07013PR_E004 });
}
const zipCounty = new Map();
for (const line of read("US.txt").split(/\r?\n/)) {
  // country, postal code, place, state name, state code, county name, county code, ...
  const f = line.split("\t");
  const zip = f[1];
  if (!/^\d{5}$/.test(zip ?? "") || zipCounty.has(zip)) continue;
  const stateFips = STATE_FIPS[f[4]];
  const fips = stateFips && /^\d{3}$/.test(f[6] ?? "") ? `${stateFips}${f[6]}` : "";
  zipCounty.set(zip, { fips, name: clean(f[5]) });
}

const zipRows = [];
let noCounty = 0;
let countyNotInEstimates = 0;
for (const zip of new Set([...zipCounty.keys(), ...tenure.keys(), ...mobility.keys()])) {
  if (!/^\d{5}$/.test(zip)) continue;
  const c = zipCounty.get(zip) ?? { fips: "", name: "" };
  if (!c.fips) noCounty += 1;
  else if (!counties.has(c.fips)) countyNotInEstimates += 1;
  const t = tenure.get(zip);
  const m = mobility.get(zip);
  // Empty, not 0, when the Census published no figure for the ZIP code.
  const owner = t && t.B25003_E002 !== null && t.B25003_E003 !== null ? t.B25003_E002 : "";
  const renter = owner === "" ? "" : t.B25003_E003;
  const inHouseholds = m && m.B07013_E001 !== null && m.B07013_E004 !== null ? m.B07013_E001 : "";
  const movers = inHouseholds === "" ? "" : Math.max(0, m.B07013_E001 - m.B07013_E004);
  zipRows.push(`${zip}|${c.fips}|${c.name}|${owner}|${renter}|${inHouseholds}|${movers}`);
}
zipRows.sort();

const countyRows = [...counties.entries()]
  .map(([fips, c]) => `${fips}|${c.name}|${c.state}|${c.population}|${c.births}|${c.deaths}|${c.domesticMigration}|${c.internationalMigration}`)
  .sort();

const gz = (rows) => zlib.gzipSync(Buffer.from(rows.join("\n"), "utf8"), { level: 9 }).toString("base64");
const national = {
  population: nation.population,
  births: nation.births,
  deaths: nation.deaths,
  netInternationalMigration: nation.internationalMigration,
  adults15Plus: divorces.us.B12503_E001,
  divorcedLastYear: divorces.us.B12503_E005 + divorces.us.B12503_E010,
  marriedLastYear: marriages.us.B12501_E005 + marriages.us.B12501_E010,
};

const out = `// GENERATED by scripts/build-area-data.mjs. Do not edit by hand.
// Area-level public data: ${zipRows.length} ZIP codes, ${countyRows.length} counties, ${states.length} states.
// County for each ZIP code: © GeoNames (https://www.geonames.org), CC BY 4.0.
// Owner and renter households, movers, marriages and divorces: U.S. Census Bureau, American Community
// Survey ${ACS_VINTAGE} 5-year estimates (tables B25003, B07013, B12501, B12503). Public domain.
// County population, births, deaths and migration: U.S. Census Bureau, Population Estimates
// Program, Vintage ${PEP_YEAR} (${PEP_PERIOD}). Public domain.
// Server-only: importing this from a client component would ship it to the browser.
export const AREA_ACS_VINTAGE = "${ACS_VINTAGE}";
export const AREA_ESTIMATES_VINTAGE = "${PEP_YEAR}";
export const AREA_ESTIMATES_PERIOD = "${PEP_PERIOD}";
/** National totals from the same files, for comparing an area with the country. */
export const AREA_NATIONAL = ${JSON.stringify(national)} as const;
/** "zip|countyFips|countyName|ownerHouseholds|renterHouseholds|peopleInHouseholds|movedInPastYear"; a field is empty when not published. */
export const AREA_ZIP_GZ_BASE64 =
  "${gz(zipRows)}";
/** "fips|name|ST|population|births|deaths|netDomesticMigration|netInternationalMigration" */
export const AREA_COUNTY_GZ_BASE64 =
  "${gz(countyRows)}";
/** "stateFips|ST|name|peopleAged15Plus|divorcedLastYear|marriedLastYear" */
export const AREA_STATE_GZ_BASE64 =
  "${gz(states)}";
`;

const target = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "src", "lib", "geo", "area-data.generated.ts");
fs.writeFileSync(target, out);
console.log(`${noCounty} ZIP codes have no county in GeoNames; ${countyNotInEstimates} have a county code the estimates file does not list (boundaries change; those ZIP codes still get state figures).`);
console.log(`National: ${JSON.stringify(national)}`);
console.log(`Wrote ${zipRows.length} ZIP codes, ${countyRows.length} counties, ${states.length} states (${(out.length / 1024).toFixed(0)} KB) to ${path.relative(process.cwd(), target)}`);
