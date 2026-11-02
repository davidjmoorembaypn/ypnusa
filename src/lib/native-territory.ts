import { readDb, storageMode } from "@/lib/db";
import { nativeSubscriptionGrantsAccess } from "@/lib/native-billing";
import { isValidZip, type TerritoryCheckResult } from "@/lib/territory";

export function checkNativeTerritory(raw: unknown): TerritoryCheckResult | null {
  const zip = typeof raw === "string" ? raw.trim() : "";
  if (!isValidZip(zip)) return { ok: true, zip, valid: false, available: false, totalClaimed: 0, message: "Enter a valid 5-digit ZIP code." };
  // Explicit reconciliation attestation prevents an empty new store advertising every ZIP as free.
  if (process.env.YPNUS_NATIVE_LEDGER_READY !== "true" || !storageMode().persistent || storageMode().error) return null;
  const claimed = new Set(readDb().revenueSubscriptions
    .filter((row) => row.status === "active" && nativeSubscriptionGrantsAccess(row))
    .flatMap((row) => row.claimedZips).filter(isValidZip));
  return { ok: true, zip, valid: true, available: !claimed.has(zip), totalClaimed: claimed.size, message: claimed.has(zip) ? `ZIP ${zip} is already claimed.` : `ZIP ${zip} is available. Exclusivity begins after payment and confirmation.` };
}
