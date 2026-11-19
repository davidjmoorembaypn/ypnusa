import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { neutralizeCell, normalizeContactZip, parseContacts, parseCsv, toCsv } from "./csv";
import { MAILTO_MAX_LENGTH, buildMailto, buildOutreachPayload, fillContactPlaceholders, renderTemplate } from "./outreach-templates";
import { EXPORT_COLUMNS, claimedNeighborZips, indexOpenNeighbors, matchContacts, toExportRows, type ScarcityEventView } from "./scarcity-match";

const vars = { lockedZip: "93618", lockedCity: "Dinuba", targetZip: "93616", targetCity: "Del Rey" };

describe("outreach templates", () => {
  const payload = buildOutreachPayload(vars);

  it("uses the requested subject and names both ZIP codes", () => {
    assert.equal(payload.email_fomo.subject, "Heads up on 93616 (neighboring 93618 just closed)");
    assert.match(payload.email_fomo.body, /93618 \(Dinuba\)/);
    assert.match(payload.email_fomo.body, /93616 \(Del Rey\)/);
    assert.match(payload.linkedin_dm.body, /93616 in Del Rey/);
  });

  it("is signed by the founder with his NMLS number and carries an address and opt-out", () => {
    for (const text of [payload.email_fomo.body, payload.branch_audit_pitch.body]) {
      assert.match(text, /David J\. Moore, MBA/);
      assert.match(text, /Founder, YPN USA \| NMLS #787257/);
      assert.match(text, /247 N L Street, Dinuba, CA 93618/);
      assert.match(text, /unsubscribe/i);
    }
  });

  it("links to real pages with the right utm_source and the target ZIP code", () => {
    const urlOf = (text: string) => new URL(text.match(/https:\/\/\S+/)![0]);
    const email = urlOf(payload.email_fomo.body);
    assert.equal(email.pathname, "/claim-territory");
    assert.equal(email.searchParams.get("zip"), "93616");
    assert.equal(email.searchParams.get("utm_source"), "fomo_email");
    const dm = urlOf(payload.linkedin_dm.body);
    assert.equal(dm.searchParams.get("utm_source"), "linkedin_dm");
    assert.equal(dm.searchParams.get("zip"), "93616");
    const branch = urlOf(payload.branch_audit_pitch.body);
    assert.equal(branch.pathname, "/teams/territory-audit");
    assert.equal(branch.searchParams.get("zip"), "93616");
  });

  it("leaves {{First_Name}} and {{Email}} for the matcher and fills them on request", () => {
    assert.match(payload.email_fomo.body, /\{\{First_Name\}\}/);
    assert.match(payload.email_fomo.body, /\{\{Email\}\}/);
    const filled = fillContactPlaceholders(payload.email_fomo.body, { firstName: "Ana", email: "ana@example.com" });
    assert.match(filled, /^Hi Ana,/);
    assert.match(filled, /sent to ana@example\.com/);
    assert.ok(!filled.includes("{{"));
    assert.match(fillContactPlaceholders(payload.linkedin_dm.body, { firstName: "  ", email: "" }), /^Hi there,/);
  });

  it("reads cleanly when a city is unknown and never promises results or quotes rates", () => {
    const bare = buildOutreachPayload({ ...vars, lockedCity: "", targetCity: "" });
    assert.match(bare.email_fomo.body, /ZIP code 93618 just locked/);
    assert.ok(!bare.email_fomo.body.includes("()"));
    for (const text of [payload.email_fomo.body, payload.linkedin_dm.body, payload.branch_audit_pitch.body]) {
      assert.ok(!/best rate|lowest rate|guaranteed (leads|loans|results)|pre-?approv/i.test(text));
      assert.ok(!/\d(\.\d+)?\s?% (interest )?rate/i.test(text));
    }
    assert.ok(payload.linkedin_dm.body.length < 600);
  });

  it("renderTemplate only replaces the keys it is given", () => {
    assert.equal(renderTemplate("{{a}} and {{b}}", { a: "x" }), "x and {{b}}");
  });
});

describe("mailto links", () => {
  it("encodes recipient, subject and body", () => {
    const link = buildMailto("ana@example.com", "Hi & bye", "Line 1\nLine 2")!;
    assert.ok(link.startsWith("mailto:ana%40example.com?subject=Hi%20%26%20bye&body=Line%201%0ALine%202"));
  });

  it("returns null for a bad address or a link too long for mail clients", () => {
    assert.equal(buildMailto("not-an-email", "s", "b"), null);
    assert.equal(buildMailto("a@b.co", "s", "x".repeat(MAILTO_MAX_LENGTH)), null);
  });
});

describe("csv", () => {
  it("parses quoted fields, escaped quotes, embedded newlines, CRLF and a BOM", () => {
    const rows = parseCsv('﻿a,b\r\n"x, y","say ""hi"""\r\n"line1\nline2",z\r\n');
    assert.deepEqual(rows, [["a", "b"], ["x, y", 'say "hi"'], ["line1\nline2", "z"]]);
  });

  it("skips blank lines and handles a missing trailing newline", () => {
    assert.deepEqual(parseCsv("a,b\n\n1,2"), [["a", "b"], ["1", "2"]]);
  });

  it("normalizes ZIP codes: strips +4, pads a dropped leading zero, rejects junk", () => {
    assert.equal(normalizeContactZip("93618-1234"), "93618");
    assert.equal(normalizeContactZip("936181234"), "93618");
    assert.equal(normalizeContactZip("2108"), "02108");
    assert.equal(normalizeContactZip("93"), "");
    assert.equal(normalizeContactZip("abc"), "");
  });

  it("reads the common header spellings", () => {
    const csv = [
      "First Name,Last Name,Email,Office ZIP,NMLS ID,Company",
      "Ana,Lopez,ana@example.com,93616,123456,Acme Lending",
      ",,,,,",
      "Bo,Chen,,2108,,",
    ].join("\n");
    const parsed = parseContacts(csv);
    assert.equal(parsed.contacts.length, 2);
    assert.deepEqual(parsed.contacts[0], {
      firstName: "Ana", lastName: "Lopez", email: "ana@example.com", zip: "93616", nmlsId: "123456", company: "Acme Lending",
    });
    assert.equal(parsed.contacts[1].zip, "02108");
    assert.equal(parsed.columns.zip, "Office ZIP");

    const snake = parseContacts("first_name,last_name,email,zip,nmls_id,company\nA,B,a@b.co,93616,9,Co");
    assert.equal(snake.contacts[0].zip, "93616");
    assert.equal(snake.contacts[0].nmlsId, "9");
  });

  it("neutralizes spreadsheet formulas on export and quotes awkward cells", () => {
    assert.equal(neutralizeCell("=SUM(A1)"), "'=SUM(A1)");
    assert.equal(neutralizeCell("+1"), "'+1");
    assert.equal(neutralizeCell("@x"), "'@x");
    assert.equal(neutralizeCell("Ana"), "Ana");
    const out = toCsv(["a", "b"], [{ a: "=HYPERLINK(1)", b: 'x, "y"' }]);
    assert.equal(out, `a,b\r\n'=HYPERLINK(1),"x, ""y"""`);
  });
});

describe("contact matcher", () => {
  const event = (id: string, createdAt: string, targetZip: string): ScarcityEventView => ({
    id,
    createdAt,
    lockedZip: "93618",
    lockedCity: "Dinuba",
    lockedState: "CA",
    neighbors: [{ zip: targetZip, city: "Del Rey", state: "CA", miles: 4.2, outreach: buildOutreachPayload({ ...vars, targetZip }) }],
  });
  const contacts = parseContacts("first_name,email,zip\nAna,ana@example.com,93616\nBo,bo@example.com,90210\nCy,,93616").contacts;

  it("matches by ZIP code only, fills the contact in and builds a mailto", () => {
    const rows = matchContacts(contacts, [event("e1", "2026-11-19T00:00:00Z", "93616")]);
    assert.equal(rows.length, 2);
    const ana = rows.find((r) => r.contact.firstName === "Ana")!;
    assert.match(ana.emailBody, /^Hi Ana,/);
    assert.ok(ana.mailto?.startsWith("mailto:ana%40example.com"));
    assert.match(ana.linkedinBody, /^Hi Ana,/);
    assert.equal(rows.find((r) => r.contact.firstName === "Cy")!.mailto, null);
  });

  it("uses the newest event when a ZIP code appears in several, and can filter to one ZIP code", () => {
    const rows = matchContacts(contacts, [event("old", "2026-11-01T00:00:00Z", "93616"), event("new", "2026-11-19T00:00:00Z", "93616")]);
    assert.ok(rows.every((r) => r.eventId === "new"));
    assert.equal(matchContacts(contacts, [event("e1", "2026-11-19T00:00:00Z", "93616")], "99999").length, 0);
  });

  it("skips neighbors a re-check found already claimed", () => {
    const claimed = event("e1", "2026-11-19T00:00:00Z", "93616");
    claimed.neighbors[0].status = "claimed";
    assert.equal(matchContacts(contacts, [claimed]).length, 0);
    claimed.neighbors[0].status = "unknown";
    assert.equal(matchContacts(contacts, [claimed]).length, 2);
  });

  it("treats claimed as ZIP-level: one claimed occurrence removes the ZIP code from every alert", () => {
    // 93616 is a neighbor in an older alert and a newer one. Only the OLDER alert was re-checked.
    const older = event("old", "2026-11-01T00:00:00Z", "93616");
    const newer = event("new", "2026-11-19T00:00:00Z", "93616");
    older.neighbors[0].status = "claimed";
    assert.deepEqual([...claimedNeighborZips([older, newer])], ["93616"]);
    assert.equal(indexOpenNeighbors([older, newer]).size, 0);
    assert.equal(matchContacts(contacts, [older, newer]).length, 0);
    assert.equal(toExportRows(matchContacts(contacts, [older, newer])).length, 0);
    // The same holds whichever alert carries the mark, and with a ZIP filter applied.
    older.neighbors[0].status = undefined;
    newer.neighbors[0].status = "claimed";
    assert.equal(matchContacts(contacts, [older, newer]).length, 0);
    assert.equal(matchContacts(contacts, [older, newer], "93616").length, 0);
    // A different, still-open ZIP code in another alert is unaffected.
    const other = event("other", "2026-11-10T00:00:00Z", "90210");
    assert.deepEqual(matchContacts(contacts, [older, newer, other]).map((r) => r.targetZip), ["90210"]);
  });

  it("exports one row per match with the agreed columns", () => {
    const exported = toExportRows(matchContacts(contacts, [event("e1", "2026-11-19T00:00:00Z", "93616")]));
    assert.equal(exported.length, 2);
    assert.deepEqual(Object.keys(exported[0]), [...EXPORT_COLUMNS]);
    assert.equal(exported[0].target_zip, "93616");
  });
});
