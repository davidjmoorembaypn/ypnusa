/**
 * Import WordPress accounts and ZIP locks into this app's store.
 *
 *   npx tsx scripts/import-wordpress-accounts.ts ypnus-wp-export.json           # dry run, writes nothing
 *   npx tsx scripts/import-wordpress-accounts.ts ypnus-wp-export.json --apply   # writes accounts + plans
 *
 * Run on the app server with the same LOANPILOT_DATA_DIR the app uses. Safe to re-run.
 */
import fs from "fs";
import { applyWordPressImport, planWordPressImport, type WordPressExport } from "@/lib/wordpress-import";

const [file, flag] = process.argv.slice(2);
if (!file) {
  console.error("Usage: tsx scripts/import-wordpress-accounts.ts <export.json> [--apply]");
  process.exit(1);
}

const data = JSON.parse(fs.readFileSync(file, "utf8")) as WordPressExport;
const plan = planWordPressImport(data);

console.log(`Accounts to import: ${plan.accounts.length}`);
console.log(`Paid plans to import: ${plan.subscriptions.length}`);
for (const subscription of plan.subscriptions) {
  console.log(`  ${subscription.ownerEmail}  ${subscription.tier} (${subscription.status})  ZIPs: ${subscription.claimedZips.join(", ") || "none"}`);
}
if (plan.warnings.length > 0) {
  console.log("Warnings:");
  for (const warning of plan.warnings) console.log(`  - ${warning}`);
}

if (flag === "--apply") {
  const result = applyWordPressImport(plan);
  console.log(`Applied: ${result.accounts} accounts, ${result.subscriptions} plans.`);
} else {
  console.log("Dry run only. Re-run with --apply to write.");
}
