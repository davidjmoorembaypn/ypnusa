import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { decideQueuedAction, MAX_EDITED_BODY, officerForEmail } from "@/lib/cerebro-queue";
import { isRecord, jsonError, logApiError, parseJsonBody } from "@/lib/http";
import { rateLimit } from "@/lib/rate-limit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const noStore = { headers: { "Cache-Control": "no-store" } };

/**
 * POST /api/cerebro/approvals { actionId, decision: "approve" | "dismiss", body? }
 *
 * The signed-in loan officer approves or dismisses one item Cerebro drafted for them, from
 * /dashboard/approvals. The officer comes from the session, never from the request, so one
 * officer cannot decide another's item. Approving an email does not send it here: Cerebro's
 * sender picks it up within five minutes and runs the consent and compliance checks again.
 */
export async function POST(request: Request) {
  const session = await getSession();
  if (!session?.email) return jsonError("Sign in first.", 401, "UNAUTHENTICATED");

  const limited = rateLimit(`cerebro-approvals:${session.sub}`, 60, 60_000);
  if (!limited.ok) {
    return jsonError("Too many tries - please wait a moment and try again.", 429, "RATE_LIMITED", {
      headers: { "Retry-After": String(limited.retryAfter) },
    });
  }

  try {
    const parsed = await parseJsonBody(request);
    if (!parsed.ok || !isRecord(parsed.data)) return jsonError("Nothing to decide.", 400, "INVALID_BODY");
    const { actionId, decision, body } = parsed.data;
    if (typeof actionId !== "string" || !actionId || (decision !== "approve" && decision !== "dismiss")) {
      return jsonError("Nothing to decide.", 400, "INVALID_BODY");
    }
    if (body !== undefined && typeof body !== "string") return jsonError("Nothing to decide.", 400, "INVALID_BODY");
    if (typeof body === "string" && body.length > MAX_EDITED_BODY) {
      return jsonError(`Keep the message under ${MAX_EDITED_BODY} characters.`, 400, "BODY_TOO_LONG");
    }

    const officer = officerForEmail(session.email);
    if (!officer) return jsonError("Finish your profile first.", 409, "NO_OFFICER_PROFILE");

    const result = decideQueuedAction({ officer, actionId: actionId.slice(0, 120), decision, editedBody: body });
    if (result.ok) return NextResponse.json({ ok: true, decision: result.decision, cerebroSends: result.cerebroSends }, noStore);
    if (result.code === "NEEDS_CHANGES") {
      return NextResponse.json(
        {
          ok: false,
          code: "NEEDS_CHANGES",
          error: "Not approved yet: the wording needs a change.",
          // The checker labels each problem with the field it checked; the officer only sees one field.
          problems: result.problems.map((problem) => problem.replace(/^message:\s*/, "")),
        },
        { status: 422, ...noStore },
      );
    }
    if (result.code === "ALREADY_DECIDED") return jsonError("That one was already handled.", 409, "ALREADY_DECIDED");
    return jsonError("That item is no longer in your queue.", 404, "NOT_FOUND");
  } catch (error) {
    logApiError("/api/cerebro/approvals", error);
    return jsonError("Couldn't save that right now. Please try again shortly.", 500, "DECIDE_FAILED");
  }
}
