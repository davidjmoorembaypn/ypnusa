import assert from "node:assert/strict";
import test from "node:test";
import { BUSINESS_LOGO, businessEntityJsonLd } from "./business-profile";

const founder = { "@id": "https://ypnus.com/#person-david-moore", name: "David J. Moore, MBA" };

test("organization node carries a crawlable logo of at least 112x112", () => {
  const node = businessEntityJsonLd(founder);
  assert.equal(node.logo["@type"], "ImageObject");
  assert.equal(node.logo.url, "https://ypnus.com/app-icon/512");
  assert.ok(BUSINESS_LOGO.width >= 112 && BUSINESS_LOGO.height >= 112);
  assert.deepEqual(node.image, { "@id": node.logo["@id"] });
});

test("organization node stays a marketing business, never a lender with licenses", () => {
  const node = businessEntityJsonLd(founder) as Record<string, unknown>;
  const types = node["@type"] as string[];
  assert.ok(!types.includes("FinancialService"));
  assert.equal(node.identifier, undefined);
  assert.equal(node.hasCredential, undefined);
  assert.match(String(node.description), /not a lender/);
});

test("organization node claims no founding date or profiles we have not verified", () => {
  const node = businessEntityJsonLd(founder) as Record<string, unknown>;
  assert.equal(node.foundingDate, undefined);
  assert.deepEqual(node.sameAs, [
    "https://www.linkedin.com/in/davidjmoorembaypninc/",
    "https://www.facebook.com/YPN.Incorporated/",
  ]);
});
