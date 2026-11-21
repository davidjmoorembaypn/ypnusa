import { piiEncryptionStatus } from "@/lib/crypto/pii";
import { storageMode } from "@/lib/db";
import { jsonError, jsonOk, logApiError } from "@/lib/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    // Public endpoint: report storage health only, never server paths or raw error text
    // (the storage layer already logs the details when the error occurs).
    const { persistent, error, unavailable, sizeBytes, headroom } = storageMode();

    return jsonOk({
      service: "ypnusa-app",
      storage: {
        persistent,
        degraded: Boolean(error) || unavailable,
        // True while the data file exists but cannot be read: reads and writes are refused, not faked.
        unavailable,
        // Size of the single data file, and how close it is to the size at which it can no
        // longer be saved ("ok" under 64 MB, "warn" under 256 MB, then "critical").
        sizeMb: Math.round((sizeBytes / (1024 * 1024)) * 10) / 10,
        headroom,
        piiEncryption: piiEncryptionStatus(),
      },
      // Whether outgoing email (Cerebro's borrower follow-ups, lead alerts) can send. On/off only.
      email: process.env.RESEND_API_KEY?.trim() ? "on" : "off",
      build: { commit: process.env.APP_COMMIT, builtAt: process.env.APP_BUILT_AT },
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    logApiError("/api/health", error);
    return jsonError("Health check failed.", 500, "HEALTH_CHECK_FAILED");
  }
}
