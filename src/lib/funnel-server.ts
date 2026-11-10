import { createHash } from "node:crypto";
import { sanitizeFunnelParams, type FunnelEventName } from "@/lib/funnel-events";

/**
 * Server-side funnel events (e.g. first_payment_succeeded, which only Stripe's
 * webhook knows about). Always writes one structured log line; also sends the
 * event to GA4 through the Measurement Protocol when both NEXT_PUBLIC_GA_ID and
 * GA_MEASUREMENT_API_SECRET are set. Best-effort: never throws.
 *
 * `subjectId` (e.g. a Stripe customer id) is hashed into the GA client id so
 * nothing identifying is sent.
 */
export async function sendServerFunnelEvent(
  name: FunnelEventName,
  params: Record<string, unknown>,
  subjectId: string,
): Promise<void> {
  const clean = sanitizeFunnelParams(params);
  try {
    console.info(JSON.stringify({ funnel: name, ...clean }));
    const measurementId = process.env.NEXT_PUBLIC_GA_ID?.trim();
    const apiSecret = process.env.GA_MEASUREMENT_API_SECRET?.trim();
    if (!measurementId || !apiSecret) return;
    const digest = createHash("sha256").update(`ypnus-funnel:${subjectId}`).digest();
    const clientId = `${digest.readUInt32BE(0)}.${digest.readUInt32BE(4)}`;
    const url = `https://www.google-analytics.com/mp/collect?measurement_id=${encodeURIComponent(measurementId)}&api_secret=${encodeURIComponent(apiSecret)}`;
    await fetch(url, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ client_id: clientId, events: [{ name, params: clean }] }),
      signal: AbortSignal.timeout(2000),
    });
  } catch {
    /** analytics must never break a webhook */
  }
}
