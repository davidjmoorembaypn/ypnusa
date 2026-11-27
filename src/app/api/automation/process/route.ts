import { processDueFollowUps } from "@/lib/automation";
import { processDueCrmDeliveries } from "@/lib/integrations/crm/link";
import { processMloDrip } from "@/lib/mlo-drip";
import { jsonError, jsonOk, logApiError, requireSecret } from "@/lib/http";
import { enforceRateLimit } from "@/lib/rate-limit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const unauthorized = requireSecret(request);
    if (unauthorized) return unauthorized;

    const limited = enforceRateLimit(request, {
      scope: "automation",
      limit: 10,
      message: "Too many automation runs — please slow down and try again shortly.",
    });
    if (limited) return limited;

    const summary = await processDueFollowUps();
    const crm = await processDueCrmDeliveries();
    // The free-account email series for loan officers (off unless MLO_DRIP_ENABLED=true). Counts only.
    const mloDrip = await processMloDrip();
    return jsonOk({ ...summary, crmDeliveries: crm, mloDrip });
  } catch (error) {
    logApiError("/api/automation/process", error);
    return jsonError("Automation processing failed.", 500, "AUTOMATION_PROCESS_FAILED");
  }
}
