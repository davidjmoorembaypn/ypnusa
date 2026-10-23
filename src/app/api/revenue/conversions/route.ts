import { requireAdminSessionOrSecret } from "@/lib/auth";
import { summarizeConversions } from "@/lib/conversions";
import { jsonOk } from "@/lib/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Verified paid-conversion count (admin/secret only). See src/lib/conversions.ts for what counts. */
export async function GET(request: Request) {
  const unauthorized = await requireAdminSessionOrSecret(request);
  if (unauthorized) return unauthorized;
  return jsonOk({ data: summarizeConversions() });
}
