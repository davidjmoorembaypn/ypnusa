import { storageMode } from "@/lib/db";
import { jsonError, jsonOk, logApiError } from "@/lib/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    // Public endpoint: report storage health only, never server paths or raw error text
    // (the storage layer already logs the details when the error occurs).
    const { persistent, error } = storageMode();

    return jsonOk({
      service: "ypnusa-app",
      storage: { persistent, degraded: Boolean(error) },
      build: { commit: process.env.APP_COMMIT, builtAt: process.env.APP_BUILT_AT },
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    logApiError("/api/health", error);
    return jsonError("Health check failed.", 500, "HEALTH_CHECK_FAILED");
  }
}
