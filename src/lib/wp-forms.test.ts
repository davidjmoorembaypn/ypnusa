import { test } from "node:test";
import assert from "node:assert/strict";
import { WP_FORMS, wpFormPayload } from "@/lib/wp-forms";
import { LEAD_MESSAGE_MAX_LENGTH } from "@/lib/lead-sources";
import { WP_TOP_PAGES } from "@/content/wp-import";
import { prepareWpHtml } from "@/lib/wp-html";

const contact = WP_FORMS.find((f) => f.formId === "contact-form")!;
const hub = WP_FORMS.find((f) => f.formId === "ypnHubBrief")!;

test("every bridged form exists in an imported page with the fields the bridge reads", () => {
  for (const spec of WP_FORMS) {
    const page = WP_TOP_PAGES.find((p) => p.html.includes(`id="${spec.formId}"`));
    assert.ok(page, `${spec.formId} is on a live page`);
    const html = prepareWpHtml(page.html, false).html;
    for (const name of Object.values(spec.fields)) assert.match(html, new RegExp(`name="${name}"`), `${spec.formId}: ${name}`);
    if (spec.requiredCheckbox) assert.match(html, new RegExp(`name="${spec.requiredCheckbox}"`));
    if (spec.successId) assert.match(html, new RegExp(`id="${spec.successId}"`));
  }
});

test("contact form sends name, email, message and phone to the lead inbox", () => {
  const check = wpFormPayload(contact, {
    name: " Pat ",
    email: "pat@example.com",
    message: "Is 93277 open?",
    phone: "(559) 555-0100",
    smsConsent: true,
  });
  assert.deepEqual(check, {
    ok: true,
    payload: {
      name: "Pat",
      workEmail: "pat@example.com",
      phone: "(559) 555-0100",
      message: "Is 93277 open?",
      source: "contact_page",
      consent: true,
    },
  });
});

test("SMS consent only counts with a phone number", () => {
  const check = wpFormPayload(contact, { name: "Pat", email: "pat@example.com", message: "Hi", smsConsent: true });
  assert.ok(check.ok && check.payload.consent === false);
});

test("contact form needs a message, a name and a valid email", () => {
  assert.equal(wpFormPayload(contact, { name: "Pat", email: "pat@example.com", message: "  " }).ok, false);
  assert.equal(wpFormPayload(contact, { name: "", email: "pat@example.com", message: "Hi" }).ok, false);
  assert.equal(wpFormPayload(contact, { name: "Pat", email: "pat@", message: "Hi" }).ok, false);
});

test("briefing form needs the email permission box and notes what was asked for", () => {
  assert.equal(wpFormPayload(hub, { name: "Pat", email: "pat@example.com" }).ok, false);
  const check = wpFormPayload(hub, { name: "Pat", email: "pat@example.com", checkboxTicked: true });
  assert.ok(check.ok);
  assert.equal(check.payload.source, "mlo_hub_briefing");
  assert.match(String(check.payload.message), /briefing/);
});

test("a filled honeypot is treated as spam and never sent", () => {
  const check = wpFormPayload(hub, { name: "Bot", email: "bot@example.com", checkboxTicked: true, honeypot: "http://spam" });
  assert.deepEqual(check, { ok: false, spam: true });
});

test("a contact message over the stored length is refused with a clear note, not cut short", () => {
  const long = "x".repeat(LEAD_MESSAGE_MAX_LENGTH + 200);
  const check = wpFormPayload(contact, { name: "Pat", email: "pat@example.com", message: long });
  assert.equal(check.ok, false);
  assert.ok(!check.ok && !check.spam && /shorten your message/.test(check.error));
  const fits = wpFormPayload(contact, { name: "Pat", email: "pat@example.com", message: "x".repeat(LEAD_MESSAGE_MAX_LENGTH) });
  assert.equal(fits.ok, true);
});
