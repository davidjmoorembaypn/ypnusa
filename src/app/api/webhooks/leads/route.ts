import { persistSession } from "@/lib/db";
import {
  isRecord,
  jsonError,
  jsonOk,
  parseJsonBody,
  requireSecret,
} from "@/lib/http";
import { partnerConsentTime } from "@/lib/consent";
import { generateId } from "@/lib/id";
import { claimKey, leadFingerprint, releaseKey, setKeyRef } from "@/lib/idempotency";
import { finalizeIntakeArtifacts } from "@/lib/intake-pipeline";
import { coerceLoanProgram } from "@/lib/programs";
import { enforceRateLimit } from "@/lib/rate-limit";
import type { BorrowerAnswers, ConsentChannel, IntakeSessionRecord } from "@/lib/types";
import { optionalText } from "@/lib/validation";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const IDEMPOTENCY_SCOPE = "webhooks-leads";

interface InboundLeadPayload {
  name?: unknown;
  email?: unknown;
  phone?: unknown;
  loanProgram?: unknown;
  timeline?: unknown;
  estimatedCreditBand?: unknown;
  purchaseRefiIntent?: unknown;
  funnelSource?: unknown;
  contactConsent?: unknown;
  /** Proof of consent from the sender: the wording the borrower agreed to, when, and where. */
  consentText?: unknown;
  consentCapturedAt?: unknown;
  consentSource?: unknown;
  /** The sender's own id for this lead; the same id is only processed once. */
  externalId?: unknown;
}

export async function POST(request: Request) {
  const unauthorized = requireSecret(request);
  if (unauthorized) return unauthorized;

  const limited = enforceRateLimit(request, {
    scope: "webhooks-leads",
    limit: 30,
    message: "Too many lead events — please slow down and try again shortly.",
  });
  if (limited) return limited;

  const parsed = await parseJsonBody<InboundLeadPayload>(request);
  if (!parsed.ok) return jsonError(parsed.error, 400, parsed.code);
  if (!isRecord(parsed.data)) {
    return jsonError("Request body must be a JSON object.", 400, "INVALID_BODY");
  }

  const program = coerceLoanProgram(parsed.data.loanProgram);
  const name = optionalText(parsed.data.name, 160);
  const email = optionalText(parsed.data.email, 320);
  const phone = optionalText(parsed.data.phone, 40);
  const timeline = optionalText(parsed.data.timeline, 40);
  const estimatedCreditBand = optionalText(parsed.data.estimatedCreditBand, 40);

  if (!program || !name || !email || !phone || !timeline || !estimatedCreditBand) {
    return jsonError(
      "name, email, phone, loanProgram, timeline, and estimatedCreditBand are required.",
      400,
      "INCOMPLETE_LEAD",
    );
  }

  const answers: BorrowerAnswers = {
    loanProgram: program,
    name,
    email,
    phone,
    timeline,
    estimatedCreditBand,
    purchaseRefiIntent:
      parsed.data.purchaseRefiIntent === "purchase" ||
      parsed.data.purchaseRefiIntent === "refinance" ||
      parsed.data.purchaseRefiIntent === "unsure"
        ? parsed.data.purchaseRefiIntent
        : "unsure",
    contactConsent: parsed.data.contactConsent === true,
    funnelSource: optionalText(parsed.data.funnelSource, 160) ?? "lead_webhook",
  };

  // A retried delivery must not create a second lead: dedupe on the sender's
  // Idempotency-Key header or externalId, else on email + phone + program + day.
  const idempotencyKey =
    optionalText(request.headers.get("idempotency-key"), 200) ??
    optionalText(parsed.data.externalId, 200) ??
    leadFingerprint({ email, phone, program });
  const claim = claimKey(IDEMPOTENCY_SCOPE, idempotencyKey);
  if (!claim.claimed) {
    return jsonOk({ duplicate: true, borrowerLeadId: claim.ref ?? null }, { status: 200 });
  }

  // Whatever proof of consent the sender gave is kept with the lead (wording, time, page).
  // A sender that gives none is recorded as exactly that: a bare "lead_webhook" entry.
  const consentCapturedAt = optionalText(parsed.data.consentCapturedAt, 40);
  const consentSource = optionalText(parsed.data.consentSource, 200);
  const session: IntakeSessionRecord = {
    id: generateId("sess"),
    createdAt: new Date().toISOString(),
    funnelSource: answers.funnelSource ?? "lead_webhook",
    loanProgram: program,
    answers,
    status: "qualified",
    ...(answers.contactConsent === true
      ? {
          consentCapture: {
            source: consentSource ? `lead_webhook:${consentSource}` : "lead_webhook",
            textShown: optionalText(parsed.data.consentText, 2000),
            // The partner's own time is kept only when it is not in the future: a clock running
            // ahead must never date a grant after a STOP or unsubscribe recorded on ours.
            at: partnerConsentTime(consentCapturedAt, new Date()),
            channels: ["email", "sms"] as ConsentChannel[],
          },
        }
      : {}),
  };
  let result: Awaited<ReturnType<typeof finalizeIntakeArtifacts>>;
  try {
    persistSession(session);
    result = await finalizeIntakeArtifacts(session);
  } catch (error) {
    releaseKey(IDEMPOTENCY_SCOPE, idempotencyKey);
    throw error;
  }
  if ("message" in result) {
    releaseKey(IDEMPOTENCY_SCOPE, idempotencyKey);
    return jsonError(result.message, 422, "LEAD_FINALIZATION_FAILED");
  }
  if (result.borrowerLeadId) setKeyRef(IDEMPOTENCY_SCOPE, idempotencyKey, result.borrowerLeadId);

  return jsonOk(
    {
      borrowerLeadId: result.borrowerLeadId,
      crmLeadId: result.crmLeadId,
      assignedOfficer: result.assignedOfficer,
      qualification: result.qualification,
      followUpsQueued: result.followUpsQueued ?? 0,
      immediateOutreachSent: result.immediateOutreachSent ?? 0,
    },
    { status: 201 },
  );
}

