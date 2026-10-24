// Privacy gate. Behavioural segments and user ids are only sent to DSPs when the visitor has
// opted in through the site's consent banner AND no opt-out signal is present.

const US_PRIVACY = /^1[YyNn-]{3}$/;
const GPP = /^[A-Za-z0-9_~.-]{1,2048}$/;
const TCF = /^[A-Za-z0-9_-]{20,1024}$/;

const EEA_UK = new Set(
  "AT BE BG HR CY CZ DK EE FI FR DE GR HU IE IT LV LT LU MT NL PL PT RO SK SI ES SE IS LI NO GB CH".split(" "),
);

/**
 * @returns {{personalize:boolean, reason:string, usPrivacy:string|null, gpp:string|null,
 *            gppSid:number[], gdprApplies:boolean, tcf:string|null, gpc:boolean}}
 */
export function evaluateConsent({ headers = {}, consent = {}, country = "" } = {}) {
  const gpc = String(headers["sec-gpc"] ?? "") === "1";
  const usPrivacy =
    typeof consent.usp === "string" && US_PRIVACY.test(consent.usp) ? consent.usp.toUpperCase() : null;
  const gpp = typeof consent.gpp === "string" && GPP.test(consent.gpp) ? consent.gpp : null;
  const gppSid = Array.isArray(consent.gppSid)
    ? consent.gppSid.filter((n) => Number.isInteger(n) && n >= 0).slice(0, 8)
    : [];
  const tcf = typeof consent.tcf === "string" && TCF.test(consent.tcf) ? consent.tcf : null;
  const gdprApplies = EEA_UK.has(String(country).toUpperCase());

  let personalize = consent.personalize === true;
  let reason = personalize ? "cmp_opt_in" : "no_opt_in";
  if (gpc) {
    personalize = false;
    reason = "gpc";
  } else if (usPrivacy && usPrivacy[2] === "Y") {
    personalize = false;
    reason = "us_privacy_opt_out";
  } else if (gdprApplies && !tcf) {
    personalize = false;
    reason = "gdpr_no_consent";
  }
  return { personalize, reason, usPrivacy, gpp, gppSid, gdprApplies, tcf, gpc };
}
