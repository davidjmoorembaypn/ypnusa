import { piiEncryptionStatus } from "@/lib/crypto/pii";
import { storageMode } from "@/lib/db";
import { jsonError, jsonOk, logApiError } from "@/lib/http";
import { persistenceStatus } from "@/lib/repositories";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    // Public endpoint: report storage health only, never server paths or raw error text
    // (the storage layer already logs the details when the error occurs).
    const { persistent, error, unavailable, sizeBytes, headroom } = storageMode();
    const database = persistenceStatus();

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
      // The move to PostgreSQL (see docs/POSTGRES_PHASE1.md). Modes and counts only: never a
      // host name, a record or an error message. "json" for both means the data file alone.
      database: {
        configured: database.configured,
        ready: database.ready,
        ledger: database.ledger,
        subscriptions: database.subscriptions,
        // True while PostgreSQL's copy has not been brought back after it was in charge: payment
        // events are refused (Stripe sends them again) until it is.
        handoverPending: database.handoverPending,
        // True when a switch to PostgreSQL was refused because some records could not be copied.
        handoverBlocked: database.handoverBlocked,
        // The two stores are compared at start and every few minutes. null until the first time.
        parityClean: database.parity?.clean ?? null,
        parityMismatches: database.parity?.mismatches ?? null,
        parityCheckedAt: database.parity?.checkedAt ?? null,
        // Differences found by a comparison (before it repaired them), since this process started.
        driftDetected: database.driftDetected,
        mirrorFailures: database.mirrorFailures,
        writeFailures: database.writeFailures,
        readMismatches: database.readMismatches,
        ledgerMismatches: database.ledgerMismatches,
        ledgerFallbacks: database.ledgerFallbacks,
        unstorableRecords: database.unstorableRecords,
        refusedClaims: database.refusedClaims,
        duplicateStripeSubscriptions: database.duplicateStripeSubscriptions,
        // Milliseconds, since this process started: PostgreSQL writes and reads in the payment
        // path, and copies to the other store.
        latencyMs: database.latency,
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
