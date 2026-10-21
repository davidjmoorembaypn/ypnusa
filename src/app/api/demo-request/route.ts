import { appendAnalytics, appendDemoRequest } from "@/lib/db";
import { isRecord, jsonError, jsonOk, logApiError, parseJsonBody } from "@/lib/http";
import { generateId } from "@/lib/id";
import { enforceRateLimit } from "@/lib/rate-limit";
import { MARKETING_SITE_URL } from "@/lib/site";
import { isValidZip, normalizeZip } from "@/lib/territory";
import { fetchLiveTerritory } from "@/lib/live-territory";
import type { DemoRequestRecord } from "@/lib/types";
import { isValidEmail, optionalText } from "@/lib/validation";
import { escapeHtml, notifyOwnerOfLead } from "@/lib/email";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * CORS for ypnus.com marketing forms posting leads directly to this endpoint
 * client-side. Restricted to the marketing origin — not a wildcard.
 */
const CORS_HEADERS = {
  "Access-Control-Allow-Origin": MARKETING_SITE_URL,
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
  Vary: "Origin",
};

export async function OPTIONS() {
  return new Response(null, { status: 204, headers: CORS_HEADERS });
}

export async function POST(request: Request) {
  const response = await handlePost(request);
  for (const [key, value] of Object.entries(CORS_HEADERS)) {
    response.headers.set(key, value);
  }
  return response;
}

async function handlePost(request: Request) {
  try {
    const limited = enforceRateLimit(request, {
      scope: "demo",
      limit: 5,
      message: "Too many requests — please slow down and try again shortly.",
    });
    if (limited) return limited;

    const parsed = await parseJsonBody(request);
    if (!parsed.ok) {
      return jsonError(parsed.error, 400, parsed.code);
    }

    if (!isRecord(parsed.data)) {
      return jsonError("Request body must be a JSON object.", 400, "INVALID_BODY");
    }

    const body = parsed.data;
    const name = optionalText(body.name, 120);
    const workEmail = optionalText(body.workEmail, 160);
    const company = optionalText(body.company, 160);

    if (!name || !workEmail || !company) {
      return jsonError("Name, work email, and company are required.", 400, "MISSING_FIELDS");
    }

    if (!isValidEmail(workEmail)) {
      return jsonError("Enter a valid work email address.", 400, "INVALID_EMAIL");
    }

    const zip = normalizeZip(body.zip);
    if (zip && !isValidZip(zip)) {
      return jsonError("Enter a valid 5-digit ZIP code.", 400, "INVALID_ZIP");
    }

    const consent = body.consent === true;

    const record: DemoRequestRecord = {
      id: generateId("demo"),
      createdAt: new Date().toISOString(),
      name,
      workEmail,
      company,
      phone: optionalText(body.phone, 40),
      role: optionalText(body.role, 80),
      zip: zip || undefined,
      monthlyLeadVolume: optionalText(body.monthlyLeadVolume, 40),
      message: optionalText(body.message, 1000),
      source: optionalText(body.source, 80) ?? "marketing_site",
      status: "new",
      // Not rejected when absent yet: ypnus.com's own marketing forms call this
      // endpoint directly (see CORS_HEADERS above) and may not send this field
      // yet. Captured so it's recorded whenever a caller does send it, without
      // silently breaking live lead capture from callers that don't. See
      // docs/PRODUCTION_LAUNCH_CHECKLIST.md for the follow-up to enforce this
      // once every caller is confirmed to send it.
      consent: consent || undefined,
      consentAt: consent ? new Date().toISOString() : undefined,
    };

    // This captures interest only. The live ledger, not seeded demo reservations,
    // determines availability; saving an inquiry must not claim paid exclusivity.
    const territory = zip ? await fetchLiveTerritory(zip) : null;
    appendDemoRequest(record);

    appendAnalytics({
      type: "demo_requested",
      payload: {
        demoRequestId: record.id,
        company: record.company,
        zip: record.zip,
        territoryAvailable: territory?.available ?? null,
      },
    });

    // Not awaited: this replaces what WordPress's WP Mail SMTP plugin did for
    // WPForms submissions, and must never delay or fail the visitor's response —
    // notifyOwnerOfLead() already degrades to a logged no-op without
    // RESEND_API_KEY configured or if Resend itself errors.
    void notifyOwnerOfLead({
      kind: "demo_request",
      replyTo: record.workEmail,
      summaryHtml: `
        <h2>New demo request</h2>
        <p><strong>${escapeHtml(record.name)}</strong> (${escapeHtml(record.company)})</p>
        <p>Email: ${escapeHtml(record.workEmail)}</p>
        ${record.phone ? `<p>Phone: ${escapeHtml(record.phone)}</p>` : ""}
        ${record.zip ? `<p>ZIP: ${escapeHtml(record.zip)} — ${territory?.available ? "available" : territory ? "already claimed" : "not checked"}</p>` : ""}
        ${record.role ? `<p>Role: ${escapeHtml(record.role)}</p>` : ""}
        ${record.monthlyLeadVolume ? `<p>Team size: ${escapeHtml(record.monthlyLeadVolume)}</p>` : ""}
        ${record.message ? `<p>Message: ${escapeHtml(record.message)}</p>` : ""}
        <p>Source: ${escapeHtml(record.source ?? "marketing_site")}</p>
      `,
    });

    return jsonOk({
      id: record.id,
      territory: territory
        ? { zip: territory.zip, available: territory.available }
        : null,
      message:
        territory && !territory.available
          ? "We've logged your request and added you to the waitlist for that territory."
          : "Your inquiry is saved. This does not reserve a ZIP. Availability and paid-plan activation must be confirmed before exclusivity begins.",
    });
  } catch (error) {
    logApiError("/api/demo-request", error);
    return jsonError("Demo request could not be saved.", 500, "DEMO_REQUEST_FAILED");
  }
}
